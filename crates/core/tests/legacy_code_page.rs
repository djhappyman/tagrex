//! Latin-1 tag text read in a chosen code page (#698).
//!
//! The code page is process-wide, so this has a test binary of its own, and its
//! tests take turns.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use tagrex_core::journal::SqliteJournal;
use tagrex_core::model::{
    set_legacy_code_page, TagBlockKind, TagEngine, TagField, LEGACY_CODE_PAGES,
};
use tagrex_core::plan::{BlockChange, ChangePlan, Executor, FileChange};

/// "Кино" in cp1251.
const KINO: &[u8] = &[0xCA, 0xE8, 0xED, 0xEE];
/// "Кино" in Latin-1, which is how the same bytes read by default.
const KINO_LATIN1: &str = "Êèíî";

static TURN: Mutex<()> = Mutex::new(());

/// Holds the code page for one test, and goes back to Latin-1 at the end of it.
struct CodePage(#[allow(dead_code)] MutexGuard<'static, ()>);

impl CodePage {
    fn set(label: &str) -> Self {
        let turn = TURN.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        set_legacy_code_page(label);
        Self(turn)
    }
}

impl Drop for CodePage {
    fn drop(&mut self) {
        set_legacy_code_page("");
    }
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "tagrex-code-page-test-{}-{name}",
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir.join("track.mp3")
}

fn frame(id: &[u8], encoding: u8, text: &[u8]) -> Vec<u8> {
    let mut f = id.to_vec();
    f.extend_from_slice(&((text.len() + 1) as u32).to_be_bytes());
    f.extend_from_slice(&[0, 0, encoding]);
    f.extend_from_slice(text);
    f
}

fn utf16(text: &str) -> Vec<u8> {
    [0xFF, 0xFE]
        .into_iter()
        .chain(text.encode_utf16().flat_map(u16::to_le_bytes))
        .collect()
}

fn silent_audio() -> Vec<u8> {
    let mut bytes = Vec::new();
    for _ in 0..20 {
        let mut audio = vec![0u8; 417];
        audio[..4].copy_from_slice(&[0xFF, 0xFB, 0x90, 0x00]);
        bytes.extend_from_slice(&audio);
    }
    bytes
}

/// An MP3 with an ID3v2.3 tag made of `frames`.
fn mp3_with_frames(path: &Path, frames: &[Vec<u8>]) {
    let body = frames.concat();
    let size = body.len() as u32;
    let mut bytes = b"ID3\x03\x00\x00".to_vec();
    bytes.extend_from_slice(&[
        ((size >> 21) & 0x7f) as u8,
        ((size >> 14) & 0x7f) as u8,
        ((size >> 7) & 0x7f) as u8,
        (size & 0x7f) as u8,
    ]);
    bytes.extend_from_slice(&body);
    bytes.extend_from_slice(&silent_audio());
    std::fs::write(path, bytes).unwrap();
}

fn id3v1_block(title: &[u8], artist: &[u8]) -> Vec<u8> {
    let mut block = b"TAG".to_vec();
    for (text, width) in [(title, 30), (artist, 30), (b"".as_slice(), 30)] {
        let mut field = text.to_vec();
        field.resize(width, 0);
        block.extend_from_slice(&field);
    }
    block.extend_from_slice(b"1986");
    block.extend_from_slice(&[0; 30]);
    block.push(255);
    assert_eq!(block.len(), 128);
    block
}

fn contains(path: &Path, needle: &[u8]) -> bool {
    std::fs::read(path)
        .unwrap()
        .windows(needle.len())
        .any(|window| window == needle)
}

fn value(path: &Path, field: &TagField) -> Option<String> {
    TagEngine::read(path).unwrap().tags.get(field).cloned()
}

fn with_encoding_byte(encoding: u8, text: &[u8]) -> Vec<u8> {
    let mut bytes = vec![encoding];
    bytes.extend_from_slice(text);
    bytes
}

#[test]
fn latin1_text_stays_latin1_until_a_code_page_is_chosen() {
    let path = scratch("default");
    mp3_with_frames(&path, &[frame(b"TIT2", 0, KINO)]);

    let _page = CodePage::set("");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some(KINO_LATIN1));
    set_legacy_code_page("not-a-code-page");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some(KINO_LATIN1));
}

#[test]
fn only_latin1_frames_are_read_in_the_code_page() {
    let path = scratch("only-latin1");
    mp3_with_frames(
        &path,
        &[
            frame(b"TIT2", 0, KINO),
            // The same letters as a Latin-1 title would hold, but really these
            // letters: this frame says what it is in.
            frame(b"TPE1", 1, &utf16(KINO_LATIN1)),
            frame(b"TALB", 0, b"Plain ASCII"),
        ],
    );

    let _page = CodePage::set("windows-1251");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some("Кино"));
    assert_eq!(
        value(&path, &TagField::Artist).as_deref(),
        Some(KINO_LATIN1)
    );
    assert_eq!(
        value(&path, &TagField::Album).as_deref(),
        Some("Plain ASCII")
    );
}

#[test]
fn comments_lyrics_and_custom_text_are_read_too() {
    let path = scratch("other-frames");
    let comment = [b"rus\0".as_slice(), KINO].concat();
    let lyrics = [b"rus\0".as_slice(), KINO].concat();
    // "Цой" as the name of a custom field, and "Кино" as its value.
    let custom = [&[0xD6, 0xEE, 0xE9, 0x00], KINO].concat();
    mp3_with_frames(
        &path,
        &[
            frame(b"TIT2", 0, b"Title"),
            frame(b"COMM", 0, &comment),
            frame(b"USLT", 0, &lyrics),
            frame(b"TXXX", 0, &custom),
        ],
    );

    let _page = CodePage::set("windows-1251");
    let tags = TagEngine::read(&path).unwrap().tags;
    assert_eq!(
        tags.get(&TagField::Comment).map(String::as_str),
        Some("Кино")
    );
    assert_eq!(
        tags.get(&TagField::Custom("USLT".to_string()))
            .map(String::as_str),
        Some("Кино"),
        "{tags:?}"
    );
    assert_eq!(
        tags.get(&TagField::Custom("Цой".to_string()))
            .map(String::as_str),
        Some("Кино"),
        "{tags:?}"
    );
}

#[test]
fn an_unedited_frame_keeps_its_bytes_and_an_edited_one_becomes_unicode() {
    let path = scratch("edit");
    let comment = [b"rus\0".as_slice(), KINO].concat();
    let custom = [&[0xD6, 0xEE, 0xE9, 0x00], KINO].concat();
    mp3_with_frames(
        &path,
        &[
            frame(b"TIT2", 0, KINO),
            frame(b"TALB", 0, KINO),
            frame(b"COMM", 0, &comment),
            frame(b"TXXX", 0, &custom),
        ],
    );

    let _page = CodePage::set("windows-1251");
    let mut file = TagEngine::read(&path).unwrap();
    file.tags
        .insert(TagField::Album, "Группа крови".to_string());
    file.tags.insert(TagField::Genre, "Rock".to_string());
    TagEngine::write(&file).unwrap();

    assert!(
        contains(&path, &with_encoding_byte(0, KINO)),
        "the title kept its bytes"
    );
    assert!(
        contains(&path, &[0xD6, 0xEE, 0xE9, 0x00, 0xCA, 0xE8, 0xED, 0xEE]),
        "the custom frame kept its bytes"
    );
    assert!(contains(&path, &comment), "the comment kept its bytes");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some("Кино"));
    assert_eq!(
        value(&path, &TagField::Album).as_deref(),
        Some("Группа крови")
    );

    // Unicode is Unicode whatever the setting says.
    set_legacy_code_page("");
    assert_eq!(
        value(&path, &TagField::Album).as_deref(),
        Some("Группа крови")
    );
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some(KINO_LATIN1));
}

#[test]
fn a_write_that_changes_nothing_leaves_the_tag_as_it_was() {
    let path = scratch("no-op");
    mp3_with_frames(&path, &[frame(b"TIT2", 0, KINO), frame(b"TPE1", 0, KINO)]);

    let _page = CodePage::set("windows-1251");
    let file = TagEngine::read(&path).unwrap();
    TagEngine::write(&file).unwrap();
    assert_eq!(TagEngine::read(&path).unwrap().tags, file.tags);
    assert!(contains(&path, &with_encoding_byte(0, KINO)));
}

#[test]
fn bytes_that_are_no_text_in_the_code_page_stay_latin1() {
    let path = scratch("invalid");
    // 0xAA has no character in windows-1253.
    mp3_with_frames(&path, &[frame(b"TIT2", 0, &[0xAA, 0xE1])]);

    let _page = CodePage::set("windows-1253");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some("ªá"));
}

#[test]
fn a_multi_byte_code_page_reads_and_keeps_its_bytes() {
    let path = scratch("shift-jis");
    // "映画" in Shift_JIS.
    let eiga = [0x89, 0x66, 0x89, 0xE6];
    mp3_with_frames(&path, &[frame(b"TIT2", 0, &eiga)]);

    let _page = CodePage::set("shift_jis");
    let mut file = TagEngine::read(&path).unwrap();
    assert_eq!(
        file.tags.get(&TagField::Title).map(String::as_str),
        Some("映画")
    );
    file.tags.insert(TagField::Genre, "Rock".to_string());
    TagEngine::write(&file).unwrap();
    assert!(contains(&path, &with_encoding_byte(0, &eiga)));
}

#[test]
fn every_offered_code_page_is_one_the_setting_takes() {
    let path = scratch("all-pages");
    // A byte every one of these reads as something other than Latin-1 does, or
    // at least as something: 0xC0 alone is a lead byte in the multi-byte ones.
    mp3_with_frames(&path, &[frame(b"TIT2", 0, &[0xC0, 0xC0])]);
    let latin1 = {
        let _page = CodePage::set("");
        value(&path, &TagField::Title)
    };
    assert_eq!(latin1.as_deref(), Some("ÀÀ"));
    for label in LEGACY_CODE_PAGES {
        let _page = CodePage::set(label);
        let read = value(&path, &TagField::Title);
        // Windows-1252 and Windows-1254 agree with Latin-1 on this byte, and so
        // they cannot show the setting took.
        if !["windows-1252", "windows-1254"].contains(&label) {
            assert_ne!(read, latin1, "{label}");
        }
    }
}

#[test]
fn an_id3v1_tag_is_read_in_the_code_page_and_keeps_its_bytes() {
    let path = scratch("id3v1");
    // "Цой"
    let tsoy = [0xD6, 0xEE, 0xE9];
    let mut bytes = silent_audio();
    bytes.extend_from_slice(&id3v1_block(KINO, &tsoy));
    std::fs::write(&path, bytes).unwrap();

    let _page = CodePage::set("windows-1251");
    let mut file = TagEngine::read(&path).unwrap();
    assert_eq!(
        file.tags.get(&TagField::Title).map(String::as_str),
        Some("Кино")
    );

    // An edit goes into a new ID3v2 tag in Unicode. ID3v1 keeps what nobody
    // edited, and has the edited value in the same code page.
    file.tags.insert(TagField::Artist, "Виктор".to_string());
    TagEngine::write(&file).unwrap();
    let tail = {
        let raw = std::fs::read(&path).unwrap();
        raw[raw.len() - 128..].to_vec()
    };
    assert_eq!(&tail[3..7], KINO, "the title kept its bytes");
    // "Виктор" in cp1251.
    assert_eq!(&tail[33..39], &[0xC2, 0xE8, 0xEA, 0xF2, 0xEE, 0xF0]);
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some("Кино"));
    assert_eq!(value(&path, &TagField::Artist).as_deref(), Some("Виктор"));
    let block = TagEngine::read_block(&path, TagBlockKind::Id3v1)
        .unwrap()
        .unwrap();
    assert_eq!(
        block.tags.get(&TagField::Artist).map(String::as_str),
        Some("Виктор")
    );
}

#[test]
fn a_cut_in_id3v1_does_not_split_a_character() {
    let path = scratch("id3v1-cut");
    let mut bytes = silent_audio();
    bytes.extend_from_slice(&id3v1_block(b"Old", b"Old"));
    std::fs::write(&path, bytes).unwrap();

    let _page = CodePage::set("shift_jis");
    let mut file = TagEngine::read(&path).unwrap();
    // Sixteen two-byte characters: the thirtieth byte ends the fifteenth.
    file.tags.insert(TagField::Title, "映".repeat(16));
    // And one ASCII letter first, so that it falls in the middle of one.
    file.tags
        .insert(TagField::Artist, format!("a{}", "映".repeat(16)));
    TagEngine::write(&file).unwrap();
    let block = TagEngine::read_block(&path, TagBlockKind::Id3v1)
        .unwrap()
        .unwrap();
    assert_eq!(
        block.tags.get(&TagField::Title).cloned(),
        Some("映".repeat(15))
    );
    assert_eq!(
        block.tags.get(&TagField::Artist).cloned(),
        Some(format!("a{}", "映".repeat(14)))
    );
}

fn fix_change(path: &Path) -> FileChange {
    let content = TagEngine::read_block(path, TagBlockKind::Id3v2)
        .unwrap()
        .unwrap();
    FileChange {
        path: path.to_path_buf(),
        block_changes: vec![BlockChange {
            kind: TagBlockKind::Id3v2,
            revision: None,
            old_revision: TagEngine::id3v2_revision(path).unwrap(),
            old_bytes: TagEngine::dump_id3v2(path).unwrap(),
            old: Some(content.clone()),
            new: Some(content),
            text_to_unicode: true,
        }],
        ..FileChange::default()
    }
}

#[test]
fn fixing_rewrites_the_text_in_unicode_and_undo_puts_the_bytes_back() {
    let path = scratch("fix");
    // A frame the model has no field for, which only a rewrite of the frames as
    // they are would keep.
    let private = [b"tagrex\0".as_slice(), &[1, 2, 3, 4, 5]].concat();
    mp3_with_frames(
        &path,
        &[
            frame(b"TIT2", 0, KINO),
            frame(b"TPE1", 1, &utf16("Цой")),
            {
                let mut f = b"PRIV".to_vec();
                f.extend_from_slice(&(private.len() as u32).to_be_bytes());
                f.extend_from_slice(&[0, 0]);
                f.extend_from_slice(&private);
                f
            },
        ],
    );

    let journal_dir = scratch("fix-journal");
    let journal_path = journal_dir.with_file_name("journal.sqlite");
    let _ = std::fs::remove_file(&journal_path);
    let _page = CodePage::set("windows-1251");
    assert!(TagEngine::has_legacy_id3v2_text(&path).unwrap());

    let mut journal = SqliteJournal::open(&journal_path).unwrap();
    let plan = ChangePlan {
        description: "fix".to_string(),
        changes: vec![fix_change(&path)],
        ..ChangePlan::default()
    };
    let root = path.parent().unwrap().to_path_buf();
    let batch = Executor::apply(&plan, &mut journal, std::slice::from_ref(&root)).unwrap();

    assert!(!TagEngine::has_legacy_id3v2_text(&path).unwrap());
    assert!(
        !contains(&path, &with_encoding_byte(0, KINO)),
        "no cp1251 title left"
    );
    assert!(contains(&path, &private), "the private frame stayed");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some("Кино"));
    assert_eq!(
        TagEngine::id3v2_revision(&path).unwrap(),
        Some(tagrex_core::model::Id3v2Revision::V3),
        "the revision stayed"
    );
    {
        // Unicode now, so the setting makes no difference to it.
        set_legacy_code_page("");
        assert_eq!(value(&path, &TagField::Title).as_deref(), Some("Кино"));
        set_legacy_code_page("windows-1251");
    }

    // The journal is read back, so this is the flag surviving a restart too.
    let mut journal = SqliteJournal::open(&journal_path).unwrap();
    Executor::undo(&mut journal, batch.id, std::slice::from_ref(&root)).unwrap();
    assert!(
        contains(&path, &with_encoding_byte(0, KINO)),
        "undo put the bytes back"
    );
    assert!(contains(&path, &private));
    assert_eq!(
        TagEngine::id3v2_revision(&path).unwrap(),
        Some(tagrex_core::model::Id3v2Revision::V3)
    );
    set_legacy_code_page("");
    assert_eq!(value(&path, &TagField::Title).as_deref(), Some(KINO_LATIN1));
}

#[test]
fn without_a_code_page_there_is_nothing_to_fix() {
    let path = scratch("fix-off");
    mp3_with_frames(&path, &[frame(b"TIT2", 0, KINO)]);
    let _page = CodePage::set("");
    assert!(!TagEngine::has_legacy_id3v2_text(&path).unwrap());
}

#[test]
fn an_id3v1_only_file_is_told_apart_for_fixing() {
    let path = scratch("fix-id3v1");
    let mut bytes = silent_audio();
    bytes.extend_from_slice(&id3v1_block(KINO, b""));
    std::fs::write(&path, bytes).unwrap();

    let _page = CodePage::set("windows-1251");
    assert!(!TagEngine::has_legacy_id3v2_text(&path).unwrap());
    assert!(TagEngine::has_legacy_id3v1_text_only(&path).unwrap());
}
