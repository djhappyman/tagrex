//! Shared by the fuzz targets: turning a fuzz input into a file on disk, since
//! every entry point under test reads from a path, and telling a panic the app
//! survives from one it does not.

use std::backtrace::Backtrace;
use std::cell::RefCell;
use std::path::PathBuf;
use std::sync::Once;

thread_local! {
    /// The most recent panic on this thread: its message, place and backtrace.
    static LAST_PANIC: RefCell<Option<(String, Backtrace)>> = const { RefCell::new(None) };
}

/// Run one fuzz input through `body`, failing only on a panic that escapes it.
///
/// libfuzzer-sys installs a panic hook that aborts on every panic, caught or
/// not. The app catches panics from the tag library on purpose and reports the
/// file as damaged (`guarded` in the core model), so with that hook every such
/// file would count as a crash and drown out the ones that matter. Here a panic
/// is only recorded when it happens, and the process aborts, printing it, only
/// when it reaches this function: a panic the app would not have survived.
pub fn run(body: impl FnOnce()) {
    static QUIET_HOOK: Once = Once::new();
    QUIET_HOOK.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            // Symbols are resolved only if the panic turns out to escape.
            let report = (info.to_string(), Backtrace::force_capture());
            LAST_PANIC.with(|last| *last.borrow_mut() = Some(report));
        }));
    });
    if std::panic::catch_unwind(std::panic::AssertUnwindSafe(body)).is_err() {
        match LAST_PANIC.with(|last| last.borrow_mut().take()) {
            Some((message, backtrace)) => {
                eprintln!("panic escaped the code under test: {message}\n{backtrace}")
            }
            None => eprintln!("panic escaped the code under test"),
        }
        std::process::abort();
    }
}

/// The extensions an input can be written under. The first byte of the input
/// picks one, so every format's reader gets inputs of its own while the corpus
/// stays one pool.
pub const EXTENSIONS: &[&str] = &[
    "mp3", "flac", "ogg", "opus", "spx", "m4a", "aac", "aiff", "wav", "mpc", "ape", "wv",
];

/// Write `data` after its first byte to a scratch file whose extension that
/// byte picks, and return the path. The same path is reused for every input of
/// a format within one process, so the fuzzer does not litter the disk.
pub fn input_file(data: &[u8]) -> Option<PathBuf> {
    let (&selector, body) = data.split_first()?;
    let ext = EXTENSIONS[usize::from(selector) % EXTENSIONS.len()];
    let dir = std::env::temp_dir().join(format!("tagrex-fuzz-{}", std::process::id()));
    std::fs::create_dir_all(&dir).ok()?;
    let path = dir.join(format!("input.{ext}"));
    std::fs::write(&path, body).ok()?;
    Some(path)
}
