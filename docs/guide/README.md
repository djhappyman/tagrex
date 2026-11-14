# Tagnetic user guide

How to use Tagnetic day to day. If you are looking for how the code is put
together, that is [docs/architecture.md](../architecture.md); for what changed
between releases, [CHANGELOG.md](../../CHANGELOG.md).

## Edit, preview, apply

Choose files, make edits and review them in **Staged** before saving. You can
keep editing to build up a set of tag, rename, artwork and transformation
changes. **Apply** writes those changes to your music files and records the
batch for **Undo**. Previewing alone does not write to your music files.

Files and Staged share the same table and edits. Use Staged to review
before-and-after values and refine a cell before applying the batch.
See [Change plans, Apply and Undo](change-plans.md) for the underlying model.

This guide is adapted from the TagRex documentation. Some detailed sections
still describe the inherited interface; the [project README](../../README.md)
describes Tagnetic’s current workflow and development status.

## Contents

1. [Getting started](getting-started.md) — open a folder, make one edit, undo it
2. [The file table](file-table.md) — columns, grouping, filtering, selection, the player
3. [Change plans, Apply and Undo](change-plans.md) — the preview gate and the undo journal
4. [TAGGER](tagger.md) — edit tags by hand, or pull them from an online source
5. [RENAMER](renamer.md) — rename files and reorganize them into folders
6. [Mask reference](masks.md) — the placeholder language, in both directions
7. [GENERATOR](generator.md) — transform presets, track numbering
8. [DEDUPLICATOR and EXPORTER](duplicates-and-export.md) — find duplicates, write playlists and reports
9. [Settings](settings.md) — every preference, keyboard shortcuts, and where they are stored

## Conventions in this guide

- **⌘** means Command on macOS and **Ctrl** on Windows and Linux. Where a
  shortcut differs, both are given.
- Names in **bold** are things you can click. Names in `code` are literal text
  you type — a mask, a filter query, a field name.
- "The selection" always means the rows currently selected in the file table.
  Almost every operation acts on it, and every panel that does says how many
  files it is about to touch.
