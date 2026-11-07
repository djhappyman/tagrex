//! Any file, read the way the library view reads it: tags, covers and audio
//! properties. Nothing may panic or hang, whatever the bytes are.
#![no_main]

use libfuzzer_sys::fuzz_target;
use tagrex_core::model::TagEngine;

fuzz_target!(|data: &[u8]| tagrex_fuzz::run(|| {
    let Some(path) = tagrex_fuzz::input_file(data) else {
        return;
    };
    if TagEngine::read(&path).is_ok() {
        let _ = TagEngine::read_covers(&path);
    }
}));
