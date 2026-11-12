# TagRex Next

`next` is an experimental branch for trying a component-based interface: a
frontend framework and a component library, built with npm, in place of the
static HTML, CSS and ES modules in `app/ui`. Tracking issue:
[#732](https://github.com/tagrex/tagrex/issues/732).

`main` does not change course because of it. It keeps its frontend without npm,
a framework or a build step (see [architecture.md](architecture.md#tech-stack)),
and it keeps shipping releases. The point of `next` is to find out, with
evidence, whether the other approach is better for this app, and by how much.

## Ground rules

- **Only the interface differs.** The Rust crates are shared. `next` merges
  `main` regularly, so every backend fix reaches it without being ported by
  hand. A backend change the new interface needs goes into `main` first, as its
  own issue, unless it only makes sense for the experiment.
- **It never shares state with TagRex.** The build is called *TagRex Next* and
  has its own bundle identifier, `com.tagrex.next`, so its settings, its undo
  journal and its single-instance lock live apart from an installed TagRex:
  - macOS: `~/Library/Application Support/com.tagrex.next/`
  - Linux: `~/.config/com.tagrex.next/`
  - Windows: `%APPDATA%\com.tagrex.next\`

  Both can be installed and run side by side. Do not change the identifier back.
- **No in-app updates.** The releases the updater would find are TagRex's, and
  installing one would replace this build with that one, so the check is
  switched off (`IN_APP_UPDATES` in `app/src/main.rs`). The updater key and
  `latest.json` belong to `main` alone.
- **No `v*` tags from this branch.** A `v*` tag publishes a TagRex release. If
  builds of `next` are shared, they are GitHub pre-releases under a tag of
  their own (`next-YYYY-MM-DD`), never marked Latest.
- **The journal format stays readable by `main`** unless a change is agreed
  first. If the experiment ends, nobody's undo history should be stranded.
- **CI runs on it** like on `main`: fmt, clippy, build and tests on Ubuntu,
  Windows and macOS. Whatever the frontend build adds runs there too.

## How it is judged

Measured on both branches, with the same files and on the same machines:

| Criterion | How |
| --- | --- |
| Scrolling | Frame rate while scrolling a 10,000 and a 20,000 file library, grouped and ungrouped |
| Selection | Time from a click, a Shift-range and a drag selection to the panels being up to date |
| Opening a library | Time from choosing a folder to a usable table, same folder |
| Webviews | Behaviour on WKWebView (macOS), WebView2 (Windows) and WebKitGTK (Linux): rendering, input, drag gestures |
| Size | Installed bundle size per platform |
| Build | Clean build time, and what a contributor has to install |
| Dependencies | Number of npm packages, `npm audit` and `cargo audit` findings |
| Code | Lines of interface code for the same features |
| Use | The maintainer's own judgement after daily use: clearer, faster to work with, more stable |

The comparison is only fair on the same features: what one branch can do and
the other cannot is listed separately rather than counted in the numbers.

## Time box and outcome

The experiment runs until **2026-12-12**. It then ends in one of three ways,
recorded in #732:

1. **Adopt.** The new interface moves into `main` step by step, behind working
   releases, never as one switch-over.
2. **Take ideas.** Individual features or designs from `next` are rebuilt in
   `main`, each as its own issue.
3. **Close.** The branch is archived as a tag and deleted.

The date can be moved once, on purpose, if the numbers are not in yet.

## Building

Until the frontend build lands on this branch, it builds exactly like `main`:

```bash
cargo tauri build --debug --bundles app
```

The bundle is `target/debug/bundle/macos/TagRex Next.app` on macOS.
