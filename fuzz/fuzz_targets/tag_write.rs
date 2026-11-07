//! Any file that reads, written back with a few changed fields. Two promises
//! are checked on top of "no panic, no hang":
//!
//! - a write that succeeds leaves the file readable, since it was before;
//! - a write that fails leaves the file exactly as it was.
#![no_main]

use libfuzzer_sys::fuzz_target;
use tagrex_core::model::{TagEngine, TagField};

fuzz_target!(|data: &[u8]| tagrex_fuzz::run(|| {
    let Some(path) = tagrex_fuzz::input_file(data) else {
        return;
    };
    let Ok(mut file) = TagEngine::read(&path) else {
        return;
    };
    let before = std::fs::read(&path).expect("the input file was just written");
    file.tags
        .insert(TagField::Artist, "Fuzzed Artist".to_string());
    file.tags
        .insert(TagField::Album, "Fuzzed Album".to_string());
    file.tags.insert(TagField::TrackNumber, "7".to_string());
    file.tags
        .insert(TagField::Custom("FUZZ".into()), "value".to_string());
    match TagEngine::write(&file) {
        Ok(()) => {
            if let Err(err) = TagEngine::read(&path) {
                panic!("a successful write left a readable file unreadable: {err}");
            }
        }
        Err(_) => {
            let after = std::fs::read(&path).expect("the input file is still there");
            assert!(
                after == before,
                "a failed write changed the file ({} bytes before, {} after)",
                before.len(),
                after.len()
            );
        }
    }
}));
