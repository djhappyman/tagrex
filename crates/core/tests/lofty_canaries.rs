//! Canaries for behaviour of the tag backend that TagRex works around (#671).
//!
//! Each test exercises the backend alone and asserts the behaviour as it is
//! today. One failing after a dependency upgrade does not mean TagRex is
//! broken: it means the backend changed, and the workaround its message names
//! has to be revisited, and most likely removed, before the upgrade ships.

use std::borrow::Cow;
use std::io::Cursor;

use lofty::config::{ParseOptions, WriteOptions};
use lofty::file::AudioFile;
use lofty::id3::v2::{BinaryFrame, Frame, FrameId, Id3v2Tag, TextInformationFrame, TimestampFrame};
use lofty::mpeg::MpegFile;
use lofty::prelude::*;
use lofty::tag::items::Timestamp;
use lofty::TextEncoding;

/// A few silent MPEG frames, for a tag to sit in front of.
fn silence() -> Vec<u8> {
    let mut frame = vec![0xFF, 0xFB, 0x90, 0x00];
    frame.resize(417, 0);
    frame.repeat(5)
}

/// The frame ids of the ID3v2 tag at the head of `file`.
fn frame_ids(file: Vec<u8>) -> Vec<String> {
    MpegFile::read_from(&mut Cursor::new(file), ParseOptions::new())
        .unwrap()
        .id3v2()
        .map(|tag| {
            tag.into_iter()
                .map(|frame| frame.id_str().to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// The ids the 2.3 writer discards, which `splice_v23_frames` puts back
/// (#667). Should the writer keep any of them, the splice writes it twice.
#[test]
fn the_backend_still_discards_these_frames_from_a_v23_write() {
    let id = |id: &'static str| FrameId::Valid(Cow::Borrowed(id));
    let mut tag = Id3v2Tag::new();
    tag.set_title(String::from("Title"));
    for text in ["TMOO", "TPRO", "TSOA", "TSOP", "TSOT", "TSST"] {
        tag.insert(Frame::Text(TextInformationFrame::new(
            id(text),
            TextEncoding::UTF8,
            String::from("value"),
        )));
    }
    for timestamp in ["TDEN", "TDRL", "TDTG"] {
        tag.insert(Frame::Timestamp(TimestampFrame::new(
            id(timestamp),
            TextEncoding::UTF8,
            Timestamp {
                year: 2022,
                ..Timestamp::default()
            },
        )));
    }
    for binary in ["ASPI", "EQU2", "SEEK", "SIGN"] {
        tag.insert(Frame::Binary(BinaryFrame::new(
            id(binary),
            vec![0, 1, 2, 3],
        )));
    }
    // A volume adjustment the reader accepts: an identification, then one
    // channel with no change and no peak.
    tag.insert(Frame::Binary(BinaryFrame::new(
        id("RVA2"),
        vec![b'x', 0, 1, 0, 0, 0],
    )));

    let mut v24 = Vec::new();
    tag.dump_to(&mut v24, WriteOptions::default()).unwrap();
    v24.extend(silence());
    assert_eq!(frame_ids(v24).len(), 15, "the fixture itself is off");

    let mut v23 = Vec::new();
    tag.dump_to(&mut v23, WriteOptions::default().use_id3v23(true))
        .unwrap();
    v23.extend(silence());
    let kept: Vec<String> = frame_ids(v23)
        .into_iter()
        .filter(|id| id != "TIT2")
        .collect();
    assert!(
        kept.is_empty(),
        "the backend now keeps {kept:?} on a 2.3 write: drop those ids from \
         FRAMES_A_V23_WRITE_DROPS in model.rs, or `splice_v23_frames` writes \
         them twice (#667, #671)"
    );
}

/// A 2.3 `TYER` holding a full date, which the read deletes and
/// `lost_v23_year` recovers (#668). Should the read keep it, the recovery is
/// dead code.
#[test]
fn the_backend_still_drops_a_v23_tyer_holding_a_full_date() {
    let frame = |id: &[u8; 4], body: &[u8]| {
        let mut frame = id.to_vec();
        frame.extend_from_slice(&(body.len() as u32).to_be_bytes());
        frame.extend_from_slice(&[0, 0]);
        frame.extend_from_slice(body);
        frame
    };
    let frames = [
        frame(b"TIT2", b"\x00Title"),
        frame(b"TYER", b"\x002021-09-08"),
    ]
    .concat();
    let size = frames.len() as u32;
    let mut file = vec![b'I', b'D', b'3', 3, 0, 0];
    file.extend_from_slice(&[
        ((size >> 21) & 0x7F) as u8,
        ((size >> 14) & 0x7F) as u8,
        ((size >> 7) & 0x7F) as u8,
        (size & 0x7F) as u8,
    ]);
    file.extend_from_slice(&frames);
    file.extend(silence());

    let ids = frame_ids(file);
    assert_eq!(
        ids,
        vec!["TIT2".to_string()],
        "the backend now keeps a full-date TYER: `lost_v23_year` in model.rs \
         is dead code and can go (#668, #671)"
    );
}
