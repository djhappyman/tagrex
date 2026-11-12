//! Cross-version Undo smoke test. `write DIR` requires a new directory;
//! `read-undo DIR` is run using the stable crate against the same synthetic files.
use std::path::PathBuf;
use tagrex_core::journal::{SqliteJournal, UndoJournal};
use tagrex_core::model::{CoverArt, CoverKind, TagEngine, TagField};
use tagrex_core::plan::{ChangePlan, CoverChange, Executor, FieldChange, FileChange};
const MINIMAL_FLAC: [u8; 76] = [
    0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22, 0x10, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x0a, 0xc4, 0x42, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x81, 0x00, 0x00, 0x10, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // One audio frame (#416): 4096 samples of stereo silence, two CONSTANT
    // subframes, with their CRCs. A file is tags followed by audio, and a
    // tag write is only ever tested against that shape.
    0xff, 0xf8, 0xc9, 0x18, 0x00, 0xc2, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xb8, 0xee,
];
fn art(byte: u8, kind: CoverKind, description: &str) -> CoverArt {
    CoverArt {
        mime: "image/jpeg".into(),
        data: vec![byte; 65536].into(),
        kind,
        description: description.into(),
    }
}
fn main() {
    let mut args = std::env::args().skip(1);
    let mode = args.next().expect("write or read-undo");
    let root = PathBuf::from(args.next().expect("synthetic fixture directory"));
    assert!(root.is_absolute(), "use an absolute fixture path");
    let path = root.join("track.flac");
    let before = vec![
        art(7, CoverKind::Front, "Original front"),
        art(8, CoverKind::Back, "Original back"),
    ];
    let after = vec![art(9, CoverKind::Front, "Replacement front")];
    if mode == "write" {
        std::fs::create_dir(&root).expect("fixture directory must not already exist");
        std::fs::write(&path, MINIMAL_FLAC).unwrap();
        let mut journal = SqliteJournal::open(&root.join("journal.sqlite")).unwrap();
        for (description, old, new, old_art, new_art) in [
            ("baseline", None, Some("Before"), vec![], before.clone()),
            (
                "candidate",
                Some("Before"),
                Some("After"),
                before.clone(),
                after.clone(),
            ),
        ] {
            let plan = ChangePlan {
                description: description.into(),
                changes: vec![FileChange {
                    path: path.clone(),
                    tag_changes: vec![FieldChange {
                        field: TagField::Artist,
                        old: old.map(str::to_string),
                        new: new.map(str::to_string),
                    }],
                    cover_change: Some(CoverChange {
                        old: old_art,
                        new: new_art,
                    }),
                    ..Default::default()
                }],
                ..Default::default()
            };
            Executor::apply(&plan, &mut journal, std::slice::from_ref(&root)).unwrap();
        }
        println!("new writer: two persistent batches with inline artwork");
    } else {
        assert_eq!(mode, "read-undo");
        let mut journal = SqliteJournal::open(&root.join("journal.sqlite")).unwrap();
        let batches = journal.batches().unwrap();
        assert_eq!(batches.len(), 2);
        let batch = batches
            .iter()
            .find(|batch| batch.description == "candidate")
            .unwrap();
        let covers = batch.plan.changes[0].cover_change.as_ref().unwrap();
        assert_eq!(covers.old, before);
        assert_eq!(covers.new, after);
        Executor::undo(&mut journal, batch.id, std::slice::from_ref(&root)).unwrap();
        assert_eq!(TagEngine::read_covers(&path).unwrap(), before);
        assert_eq!(
            TagEngine::read(&path)
                .unwrap()
                .tags
                .get(&TagField::Artist)
                .map(String::as_str),
            Some("Before")
        );
        println!("stable reader: exact artwork metadata/bytes loaded and tags/artwork undone");
    }
}
