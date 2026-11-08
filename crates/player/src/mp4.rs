//! A look at an MP4 file's sample tables before the decoder opens it (#727).
//!
//! Symphonia's MP4 demuxer reserves room for a sample table from the entry
//! count the file states, before it reads a single entry. A damaged count asks
//! for tens of gigabytes up front. macOS hands that out lazily and the open
//! just fails, but on Windows and Linux an allocation that large can be
//! refused, and a refused allocation aborts the whole app: it is not a panic
//! that [`std::panic::catch_unwind`] could stop.
//!
//! [`check_sample_tables`] walks the boxes down to each `stbl` and refuses the
//! file when a table states more entries than the bytes left for it could
//! hold. Such a table cannot be read to its end anyway, so no file that plays
//! is turned away. Only box headers and table counts are read.

use std::fs::File;
use std::io::{self, BufReader, Read, Seek, SeekFrom};
use std::path::Path;

/// How far into the file the `ftyp` box is looked for. The decoder finds the
/// format by that marker, so a file that does not have one early on is not
/// opened as MP4.
const FTYP_SEARCH: u64 = 64 * 1024;

/// Boxes that hold the boxes on the way down to the sample tables.
const CONTAINERS: [&[u8; 4]; 5] = [b"moov", b"trak", b"mdia", b"minf", b"stbl"];

/// Refuses an MP4 file whose sample tables state more entries than the file
/// holds. Any other file, and any MP4 that cannot be walked, passes: the
/// decoder decides about those.
pub fn check_sample_tables(path: &Path) -> Result<(), String> {
    let Ok(file) = File::open(path) else {
        return Ok(());
    };
    let Ok(len) = file.metadata().map(|meta| meta.len()) else {
        return Ok(());
    };
    check(&mut BufReader::new(file), len)
}

fn check<R: Read + Seek>(reader: &mut R, len: u64) -> Result<(), String> {
    let Ok(Some(start)) = find_ftyp(reader, len) else {
        return Ok(());
    };
    match walk(reader, start, len, len, 0) {
        Ok(true) => Err(
            "the file is damaged: its sample tables state more entries than the file holds"
                .to_string(),
        ),
        _ => Ok(()),
    }
}

/// Where the box the decoder takes the file for starts: four bytes before the
/// first `ftyp`, which is the box type, not its start.
fn find_ftyp<R: Read + Seek>(reader: &mut R, len: u64) -> io::Result<Option<u64>> {
    let mut head = Vec::new();
    reader.seek(SeekFrom::Start(0))?;
    reader
        .by_ref()
        .take(FTYP_SEARCH.min(len))
        .read_to_end(&mut head)?;
    Ok(head
        .windows(4)
        .position(|window| window == b"ftyp")
        .filter(|&at| at >= 4)
        .map(|at| at as u64 - 4))
}

/// Walks the boxes from `pos` to `end`, going down into the containers on the
/// way to the sample tables. True when a table is found that cannot fit.
fn walk<R: Read + Seek>(
    reader: &mut R,
    mut pos: u64,
    end: u64,
    len: u64,
    depth: usize,
) -> io::Result<bool> {
    while pos + 8 <= end {
        reader.seek(SeekFrom::Start(pos))?;
        let mut header = [0u8; 8];
        reader.read_exact(&mut header)?;
        let size = u64::from(u32::from_be_bytes([
            header[0], header[1], header[2], header[3],
        ]));
        let kind = [header[4], header[5], header[6], header[7]];
        let (box_len, header_len) = match size {
            0 => (end - pos, 8),
            1 => {
                let mut large = [0u8; 8];
                reader.read_exact(&mut large)?;
                (u64::from_be_bytes(large), 16)
            }
            size => (size, 8),
        };
        if box_len < header_len {
            return Ok(false);
        }
        let body = pos + header_len;
        // What the table can be read from: its own box, but never past the
        // end of the file.
        let body_end = pos.saturating_add(box_len).min(len);
        if depth < CONTAINERS.len() && CONTAINERS.contains(&&kind) {
            if walk(reader, body, body_end, len, depth + 1)? {
                return Ok(true);
            }
        } else if let Some(entry_len) = entry_len(&kind, reader)? {
            let (count, fields_len) = entry_count(&kind, reader)?;
            let room = body_end.saturating_sub(body + fields_len);
            if count.saturating_mul(entry_len) > room {
                return Ok(true);
            }
        }
        pos = pos.saturating_add(box_len);
    }
    Ok(false)
}

/// The length on disk of one entry of a sample table, or `None` for a box
/// that is not one of them. The reader is at the start of the box's body.
fn entry_len<R: Read + Seek>(kind: &[u8; 4], reader: &mut R) -> io::Result<Option<u64>> {
    Ok(match kind {
        b"stts" => Some(8),
        b"stsc" => Some(12),
        b"stco" => Some(4),
        b"co64" => Some(8),
        b"stsz" => {
            // A table of sizes only when there is no one size for all samples.
            let mut fields = [0u8; 8];
            reader.read_exact(&mut fields)?;
            reader.seek(SeekFrom::Current(-8))?;
            let sample_size = u32::from_be_bytes([fields[4], fields[5], fields[6], fields[7]]);
            (sample_size == 0).then_some(4)
        }
        _ => None,
    })
}

/// The table's entry count, and how many bytes of fields come before its
/// entries. The reader is at the start of the box's body.
fn entry_count<R: Read>(kind: &[u8; 4], reader: &mut R) -> io::Result<(u64, u64)> {
    // Version and flags, then for `stsz` the one size for all samples.
    let fields_len = if kind == b"stsz" { 12 } else { 8 };
    let mut fields = [0u8; 12];
    reader.read_exact(&mut fields[..fields_len])?;
    let count = &fields[fields_len - 4..fields_len];
    Ok((
        u64::from(u32::from_be_bytes([count[0], count[1], count[2], count[3]])),
        fields_len as u64,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn boxed(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
        let mut out = ((body.len() + 8) as u32).to_be_bytes().to_vec();
        out.extend_from_slice(kind);
        out.extend_from_slice(body);
        out
    }

    fn table(count: u32, entries: &[u8]) -> Vec<u8> {
        let mut body = vec![0, 0, 0, 0];
        body.extend_from_slice(&count.to_be_bytes());
        body.extend_from_slice(entries);
        body
    }

    fn file_with(stbl_children: &[u8]) -> Vec<u8> {
        let stbl = boxed(b"stbl", stbl_children);
        let minf = boxed(b"minf", &stbl);
        let mdia = boxed(b"mdia", &minf);
        let trak = boxed(b"trak", &mdia);
        let moov = boxed(b"moov", &trak);
        let mut file = boxed(b"ftyp", b"M4A \0\0\0\0");
        file.extend_from_slice(&moov);
        file
    }

    fn checked(bytes: &[u8]) -> Result<(), String> {
        check(&mut Cursor::new(bytes), bytes.len() as u64)
    }

    #[test]
    fn tables_that_fit_pass() {
        let mut children = boxed(b"stsc", &table(1, &[0; 12]));
        children.extend(boxed(b"stco", &table(2, &[0; 8])));
        children.extend(boxed(b"stts", &table(1, &[0; 8])));
        let mut stsz = vec![0; 4];
        stsz.extend_from_slice(&0u32.to_be_bytes());
        stsz.extend_from_slice(&3u32.to_be_bytes());
        stsz.extend_from_slice(&[0; 12]);
        children.extend(boxed(b"stsz", &stsz));
        assert_eq!(checked(&file_with(&children)), Ok(()));
    }

    #[test]
    fn a_count_past_the_end_of_the_file_is_refused() {
        for kind in [b"stsc", b"stco", b"co64", b"stts"] {
            let children = boxed(kind, &table(0x6f6f_7600, &[0; 12]));
            assert!(
                checked(&file_with(&children)).is_err(),
                "{} with an impossible count passed",
                String::from_utf8_lossy(kind)
            );
        }
    }

    #[test]
    fn a_size_table_is_only_counted_when_there_is_one() {
        // One size for all samples: the count says how many samples, not
        // how many entries follow.
        let mut stsz = vec![0; 4];
        stsz.extend_from_slice(&1024u32.to_be_bytes());
        stsz.extend_from_slice(&0x6f6f_7600u32.to_be_bytes());
        assert_eq!(checked(&file_with(&boxed(b"stsz", &stsz))), Ok(()));
        // No one size: a table of that many sizes would have to follow.
        let mut stsz = vec![0; 4];
        stsz.extend_from_slice(&0u32.to_be_bytes());
        stsz.extend_from_slice(&0x6f6f_7600u32.to_be_bytes());
        assert!(checked(&file_with(&boxed(b"stsz", &stsz))).is_err());
    }

    #[test]
    fn a_file_that_is_not_mp4_passes() {
        assert_eq!(checked(b"ID3\x04\0\0\0\0\0\0stsc\xff\xff\xff\xff"), Ok(()));
        assert_eq!(checked(b""), Ok(()));
    }
}
