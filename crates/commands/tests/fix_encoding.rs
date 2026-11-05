//! The "Fix encoding" plan (#698). The code page is process-wide, so this has a
//! test binary of its own, and its tests take turns.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use tagrex_commands::{App, PlanDto, SettingsDto};
use tagrex_core::model::{TagBlockKind, TagEngine, TagField};

/// "Кино" in cp1251.
const KINO: &[u8] = &[0xCA, 0xE8, 0xED, 0xEE];

static TURN: Mutex<()> = Mutex::new(());

struct Library {
    dir: PathBuf,
    app: App,
    _turn: MutexGuard<'static, ()>,
}

impl Library {
    fn open(name: &str, code_page: &str) -> Self {
        let turn = TURN.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let dir = std::env::temp_dir().join(format!(
            "tagrex-fix-encoding-test-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let app = App::open(dir.clone(), &dir.join("journal.sqlite")).unwrap();
        app.apply_settings(&SettingsDto {
            legacy_code_page: code_page.to_string(),
            ..SettingsDto::default()
        });
        Self {
            dir,
            app,
            _turn: turn,
        }
    }
}

impl Drop for Library {
    fn drop(&mut self) {
        tagrex_core::model::set_legacy_code_page("");
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

fn audio() -> Vec<u8> {
    let mut frame = vec![0xFF, 0xFB, 0x90, 0x00];
    frame.resize(417, 0);
    frame.repeat(20)
}

fn id3v2_with_title(title: &[u8]) -> Vec<u8> {
    let mut body = b"TIT2".to_vec();
    body.extend_from_slice(&((title.len() + 1) as u32).to_be_bytes());
    body.extend_from_slice(&[0, 0, 0]);
    body.extend_from_slice(title);
    let mut bytes = b"ID3\x03\x00\x00\x00\x00\x00".to_vec();
    bytes.push(body.len() as u8);
    bytes.extend_from_slice(&body);
    bytes
}

fn id3v1_with_title(title: &[u8]) -> Vec<u8> {
    let mut block = vec![0u8; 128];
    block[..3].copy_from_slice(b"TAG");
    block[3..3 + title.len()].copy_from_slice(title);
    block[127] = 255;
    block
}

fn contains(path: &Path, needle: &[u8]) -> bool {
    std::fs::read(path)
        .unwrap()
        .windows(needle.len())
        .any(|window| window == needle)
}

fn latin1_title() -> Vec<u8> {
    [&[0][..], KINO].concat()
}

fn preview(library: &Library, paths: &[PathBuf]) -> PlanDto {
    library.app.preview_fix_encoding(paths).unwrap()
}

#[test]
fn it_touches_only_the_files_with_text_to_fix_and_undoes() {
    let mut library = Library::open("plan", "windows-1251");
    let legacy = library.dir.join("legacy.mp3");
    std::fs::write(&legacy, [id3v2_with_title(KINO), audio()].concat()).unwrap();
    let plain = library.dir.join("plain.mp3");
    std::fs::write(&plain, [id3v2_with_title(b"Plain"), audio()].concat()).unwrap();
    let untagged = library.dir.join("untagged.mp3");
    std::fs::write(&untagged, audio()).unwrap();

    let plan = preview(&library, &[legacy.clone(), plain, untagged]);
    assert_eq!(plan.changes.len(), 1);
    assert_eq!(plan.changes[0].path, legacy.to_string_lossy());
    assert!(plan.changes[0].block_changes[0].text_to_unicode);

    let batch = library.app.apply(&plan).unwrap();
    assert!(!contains(&legacy, &latin1_title()));
    assert_eq!(
        TagEngine::read(&legacy)
            .unwrap()
            .tags
            .get(&TagField::Title)
            .map(String::as_str),
        Some("Кино")
    );
    assert!(
        preview(&library, std::slice::from_ref(&legacy))
            .changes
            .is_empty(),
        "nothing left to fix"
    );

    library.app.undo(batch.id).unwrap();
    assert!(
        contains(&legacy, &latin1_title()),
        "undo put the bytes back"
    );
}

#[test]
fn a_file_with_only_id3v1_gets_an_id3v2_tag_and_keeps_its_id3v1_tag() {
    let mut library = Library::open("id3v1", "windows-1251");
    let path = library.dir.join("old.mp3");
    let original = [audio(), id3v1_with_title(KINO)].concat();
    std::fs::write(&path, &original).unwrap();

    let plan = preview(&library, std::slice::from_ref(&path));
    assert_eq!(plan.changes.len(), 1);
    let batch = library.app.apply(&plan).unwrap();

    let id3v2 = TagEngine::read_block(&path, TagBlockKind::Id3v2)
        .unwrap()
        .expect("the text has somewhere to be Unicode now");
    assert_eq!(
        id3v2.tags.get(&TagField::Title).map(String::as_str),
        Some("Кино")
    );
    let raw = std::fs::read(&path).unwrap();
    assert_eq!(&raw[raw.len() - 125..raw.len() - 121], KINO);
    assert!(
        preview(&library, std::slice::from_ref(&path))
            .changes
            .is_empty(),
        "nothing left to fix"
    );

    library.app.undo(batch.id).unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), original);
}

#[test]
fn without_a_code_page_nothing_is_offered() {
    let library = Library::open("off", "");
    let path = library.dir.join("legacy.mp3");
    std::fs::write(&path, [id3v2_with_title(KINO), audio()].concat()).unwrap();
    assert!(preview(&library, std::slice::from_ref(&path))
        .changes
        .is_empty());
}

#[test]
fn a_code_page_the_app_does_not_offer_reads_as_latin1() {
    let library = Library::open("unknown", "utf-8");
    let path = library.dir.join("legacy.mp3");
    std::fs::write(&path, [id3v2_with_title(KINO), audio()].concat()).unwrap();
    assert_eq!(
        TagEngine::read(&path)
            .unwrap()
            .tags
            .get(&TagField::Title)
            .map(String::as_str),
        Some("Êèíî")
    );
}
