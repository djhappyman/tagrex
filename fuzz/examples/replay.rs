//! Replays a fuzz input outside the fuzzer and says what each step did, keeping
//! the file as it was before and after the write for a closer look.
//!
//!     cargo +nightly run --example replay -- <input> <out dir>

use std::path::Path;

use tagrex_core::model::{TagEngine, TagField};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [input, out] = args.as_slice() else {
        panic!("usage: replay <input> <out dir>");
    };
    let data = std::fs::read(input).expect("read the input");
    let path = tagrex_fuzz::input_file(&data).expect("an input of at least one byte");
    let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    let out = Path::new(out);
    std::fs::create_dir_all(out).expect("create the output folder");
    let before = std::fs::read(&path).expect("read the written input");
    std::fs::write(out.join(format!("before.{ext}")), &before).expect("keep the input");
    println!("as .{ext}, {} bytes", before.len());

    let mut file = match TagEngine::read(&path) {
        Ok(file) => file,
        Err(err) => {
            println!("read: error: {err}");
            return;
        }
    };
    println!(
        "read: {:?}, {} tags: {:?}",
        file.format,
        file.tags.len(),
        file.tags
    );
    file.tags
        .insert(TagField::Artist, "Fuzzed Artist".to_string());
    file.tags
        .insert(TagField::Album, "Fuzzed Album".to_string());
    file.tags.insert(TagField::TrackNumber, "7".to_string());
    file.tags
        .insert(TagField::Custom("FUZZ".into()), "value".to_string());
    let written = TagEngine::write(&file);
    let after = std::fs::read(&path).expect("read the file after the write");
    std::fs::write(out.join(format!("after.{ext}")), &after).expect("keep the result");
    println!(
        "write: {written:?}, {} bytes after, {}",
        after.len(),
        if after == before {
            "unchanged"
        } else {
            "changed"
        }
    );
    match TagEngine::read(&path) {
        Ok(again) => println!("read again: {:?}, {} tags", again.format, again.tags.len()),
        Err(err) => println!("read again: error: {err}"),
    }
}
