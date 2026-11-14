//! Ogg streams of a codec the tag library cannot read (#762).

use tagrex_core::model::{AudioFormat, TagEngine};

/// #762: an Ogg stream holding FLAC. The backend reads no such thing, but its
/// sniff found an ADTS-looking pair of bytes in the FLAC data and read the file
/// as AAC with no tags, and a write then put an ID3v2 tag in front of the first
/// Ogg page. It is unsupported now, and so is a file such a write already
/// damaged, instead of being read as AAC again.
#[test]
fn an_ogg_flac_file_is_refused_as_unsupported_not_read_as_aac() {
    let fixture: &[u8] = include_bytes!("fixtures/ogg-flac.oga");
    let damaged: Vec<u8> = [b"ID3\x04\x00\x00\x00\x00\x00\x0c".as_slice()]
        .into_iter()
        .chain([b"TCMP\x00\x00\x00\x02\x00\x00\x031".as_slice()])
        .chain([fixture])
        .flatten()
        .copied()
        .collect();
    for (name, bytes) in [("plain", fixture), ("damaged", damaged.as_slice())] {
        let path = std::env::temp_dir().join(format!(
            "tagrex-tag-engine-ogg-flac-{name}-{}.oga",
            std::process::id()
        ));
        std::fs::write(&path, bytes).unwrap();
        let read = TagEngine::read_with_props(&path);
        let after = std::fs::read(&path).unwrap();
        std::fs::remove_file(&path).ok();

        match read {
            Err(tagrex_core::model::TagIoError::UnsupportedFormat(what)) => {
                assert_eq!(what, "Ogg FLAC", "{name}");
            }
            other => panic!(
                "{name}: expected unsupported, got {:?}",
                other.map(|r| r.file.format)
            ),
        }
        assert_eq!(after, bytes, "{name}: reading changed the file");
    }
}

/// #762: the check does not touch the Ogg codecs the backend does read.
#[test]
fn the_ogg_codecs_the_backend_reads_are_still_read() {
    let fixture: &[u8] = include_bytes!("fixtures/damaged-page-gap.spx");
    let path = std::env::temp_dir().join(format!(
        "tagrex-tag-engine-ogg-speex-still-reads-{}.spx",
        std::process::id()
    ));
    std::fs::write(&path, fixture).unwrap();
    let read = TagEngine::read(&path);
    std::fs::remove_file(&path).ok();
    assert_eq!(read.expect("a Speex file reads").format, AudioFormat::Speex);
}
