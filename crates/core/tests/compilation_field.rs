use tagrex_core::model::{
    AudioFormat, AudioProps, TagBlock, TagBlockKind, TagMap, TrackFile, TrackRead,
};

fn read(format: AudioFormat, blocks: Vec<TagBlock>) -> TrackRead {
    TrackRead {
        file: TrackFile {
            path: "unused".into(),
            format,
            tags: TagMap::new(),
        },
        props: AudioProps {
            duration_secs: 0,
            bitrate_kbps: None,
            sample_rate_hz: None,
            channels: None,
        },
        blocks,
        has_cover: false,
    }
}

#[test]
fn untagged_files_report_the_native_primary_compilation_key() {
    for (format, key) in [
        (AudioFormat::Mp3, "custom:TCMP"),
        (AudioFormat::Flac, "custom:COMPILATION"),
        (AudioFormat::M4a, "custom:cpil"),
    ] {
        assert_eq!(
            read(format, vec![])
                .compilation_field()
                .unwrap()
                .to_storage_key(),
            key
        );
    }
}

#[test]
fn the_read_block_controls_support_instead_of_an_unrelated_block() {
    let blocks = vec![
        TagBlock {
            kind: TagBlockKind::Id3v2,
            read_from: false,
        },
        TagBlock {
            kind: TagBlockKind::Id3v1,
            read_from: true,
        },
    ];
    assert!(read(AudioFormat::Mp3, blocks).compilation_field().is_none());
    let blocks = vec![TagBlock {
        kind: TagBlockKind::VorbisComments,
        read_from: true,
    }];
    assert_eq!(
        read(AudioFormat::Mp3, blocks)
            .compilation_field()
            .unwrap()
            .to_storage_key(),
        "custom:COMPILATION"
    );
}
