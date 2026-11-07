//! Any file through the player's decode path, as the waveform under the table
//! reads it: the AIFF padding view (#525) and the decoder behind it. A file
//! the decoder refuses is fine; a panic or a hang is not.
#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| tagrex_fuzz::run(|| {
    let Some(path) = tagrex_fuzz::input_file(data) else {
        return;
    };
    let _ = tagrex_player::waveform(&path);
}));
