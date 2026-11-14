# TagScanner sorting and tagging baseline

Researched 2026-11-14. Scope: operational sorting, grouping and online tagging;
research only. Owner: this note only. Completion gate: cited findings with facts,
inferences and unknowns separated. Route: **fork only, explicitly required by
Mike**; no upstream contribution. No application changes or media writes.

## Source limits

The official download page currently lists **6.1.21**. The English PDF identifies
itself as **5.1.594**, so it is historical evidence, not a current UI specification.
The official download page also distributes community-translated French help,
credited to Boissel Claude; its ZIP entries are dated 2018-06-20. Treat that as
officially hosted help, not a newly verified developer statement.
Sources: [downloads](https://www.xdlab.ru/en/download.htm),
[English manual, p. 1](https://xdlab.ru/files/ts_manual.pdf#page=1),
[French help ZIP](https://xdlab.ru/files/fr_help.zip).

Only official site/help/changelogs establish facts below. No secondary tutorial
is used as factual authority. Searches for developer support replies did not
produce an attributable, accessible answer resolving the ordering questions.
A candidate [Hydrogenaudio thread](https://hydrogenaudio.org/index.php/topic,20682.0.html)
returned HTTP 403; its contents and authorship were not verified. The official
[homepage](https://www.xdlab.ru/en/) provides the developer contact, but nobody
was contacted. Absence from the inspected documentation is not proof that a
feature or behavior does not exist.

## Documented evidence

| Topic | Verified documentation | Limit |
| --- | --- | --- |
| Sorting versus grouping | Version 6.0.0 made them independent, with Auto-grouping restoring the older coupling; multiple fields are supported. [Changelog, 6.0.0](https://www.xdlab.ru/en/history.htm) | Independence does **not** prove that groups retain their positions on a column-direction change. |
| Group selection | Double-clicking a group title selects its files. [French help ZIP, `Fileview.html`](https://xdlab.ru/files/fr_help.zip) | This does not establish folder ordering or cross-group sort scope. |
| Natural numbers | The manual's natural-sort option gives 8, 9, 10, 11 instead of lexicographic 10, 11, 8, 9. [Manual, p. 26](https://xdlab.ru/files/ts_manual.pdf#page=26) | Locale, leading-zero ties, and current defaults remain unverified. |
| Destination versus source selection | Select local files to process; online help permits deselecting unwanted source tracks before Save imports into selected files. [French help ZIP, `Getting_started.html`, `mod_online.html`](https://xdlab.ru/files/fr_help.zip) | It does not define pairing order or checkbox-versus-highlight precedence. |
| Online ordering | DiscID lookup requires one album's files in correct order. [Manual, pp. 12–13](https://xdlab.ru/files/ts_manual.pdf#page=12) | This requirement is not a general mapping algorithm for Discogs/MusicBrainz imports. |
| Import subset and manual order | Build 522 added choosing desired web tracks; build 490 allowed manual Freedb track ordering. [Old changelog, 5.0 build 522 and 4.9 build 490](https://www.xdlab.ru/en/history_old.htm) | Neither entry defines today's import mapping or controls for every provider. |
| Local manual order | Alt+Up/Down moves a file up/down. [French help ZIP, `Hotkeys.html`](https://xdlab.ru/files/fr_help.zip) Version 6.0.0 improved moving multiple files with arrows/hotkeys. [Changelog](https://www.xdlab.ru/en/history.htm) | Source-track drag/reorder behavior and interaction with active sorts need live checks. |
| Preview and writes | Renamer Preview does not rename; Rename commits. Tag Editor Save writes selected files. Online import instructs preview then Save. [Manual, pp. 7, 9, 13](https://xdlab.ru/files/ts_manual.pdf#page=7) | Do not assume TagScanner has TagRex's precise preview/Apply/Undo contract. |
| Bulk feedback | Version 4.5 build 452 added a status-bar progress indicator for long operations. [Old changelog](https://www.xdlab.ru/en/history_old.htm) | No verified modern per-file counter, percentage, cancellation or partial-failure semantics. |
| Logs and resilience | Version 6.0.0 introduced one operations log; 6.0.25 improved multi-file saving stability; 6.1.21 added damage protection on tagging errors. [Changelog](https://www.xdlab.ru/en/history.htm) | These do not establish transactional writes or progress granularity. |

## Inference and unknowns

Independent grouping and sorting make separate group and row order a reasonable
design model. That is an **inference**, not evidence of fixed folder positions.
Likewise, source deselection plus selected destinations suggests subset import,
but does not prove sequential compaction around unchecked rows.

The inspected sources do not settle these questions:

- Does clicking a column toggle ascending/descending? What is the first direction?
  Does it sort inside folder groups, reorder groups, or depend on grouping mode?
- How are folder groups initially ordered, and are their positions stable on
  repeated sorting, rescans, filtering, imports and manual reordering?
- Are selected destinations consumed in visible order, click order or another
  internal order? Do unchecked source rows consume a destination slot? Does merely
  highlighting a source row change the mapping?
- What happens with fewer/more checked source tracks than selected files, zero
  checked tracks, missing tracks, multidisc headings or non-track source entries?
- Does manual reordering apply to local files, source tracks, or both? Does a
  subsequent sort discard it? Is there a mapping preview before online Save?
- During a large Save, what feedback remains responsive, what does Cancel stop,
  and how are failures, already-written files and Undo represented?

## Mike's reported expectations

These are task requirements, **not claims about TagScanner**:

1. Folders stay in their current positions; column sorting changes rows only
   within each folder, in either direction.
2. Selected local files map top-to-bottom to checked source tracks top-to-bottom,
   skipping unchecked source tracks. Selection click history must not change it.
3. Establish the TagScanner baseline before building further personal ideas.
4. Preserve TagRex's existing preview, Apply and Undo boundaries and user media.

## Proposed TagRex rules and acceptance checklist

This is a proposed personal-fork contract; unknown TagScanner parity stays labeled
unknown until observed. It does not authorize additional feature implementation.

- [ ] Capture the existing folder sequence separately from the row comparator.
  For folders currently `B, A`, both ascending and descending retain `B, A`.
  Files never migrate across groups when sorting by title, artist, track or filename.
- [ ] Sort numeric filename runs naturally: `take2, take9, take10`; descending
  reverses that order within each folder. Specify stable handling for equal keys,
  missing values and leading-zero ties rather than claiming undocumented parity.
- [ ] At preview creation, take selected file identities in displayed top-to-bottom
  order and checked source identities in displayed top-to-bottom order; zip them.
  Example: files `F1, F3, F4`, checked sources `S1, S3, S4` produce
  `F1←S1, F3←S3, F4←S4`; unchecked `S2` consumes no slot. Reverse-order clicks on
  those files produce the same mapping. Source track numbers are metadata, not
  destination array indexes.
- [ ] Show the actual file/source pairings and both counts before Apply. Proposed
  mismatch policy: require resolving unequal counts; never silently truncate,
  repeat metadata or guess a match. Zero checked sources produces no write plan.
- [ ] Rebuild/invalidate the preview if selection, checking, order or source release
  changes. Apply executes the reviewed mapping, not a newly inferred mapping.
- [ ] Preserve preview/Apply/Undo; sorting and checking do not write tags. Proposed
  bulk feedback shows completed/total files, current operation and failures from
  real execution events, and distinguishes completion from partial failure.
  Cancellation and Undo semantics must follow TagRex's existing safe behavior.

## Live parity checks still required

If a future session is explicitly authorized to run TagScanner, record its exact
version, grouping mode and natural-sort setting. Use disposable fixtures only:
two folders deliberately ordered `B, A`, numeric filenames `2, 9, 10`, duplicate
sort keys and blank fields. Check each column in both directions and try local
manual reordering. Then select nonadjacent destinations in reverse click order;
uncheck a middle source row; inspect Preview and repeat with count mismatches,
multidisc entries and source reordering. Finally test a disposable batch Save,
cancellation/error feedback and independent metadata readback. Capture observed
pairings and UI evidence before calling any of these exact parity.

No TagScanner/Wine installation or execution occurred. The French help ZIP was
read as text in a task-owned temporary directory; the downloaded copy was removed
after verifying this note. No application, test, user media or runtime state was
modified by this research task.

## TagRex baseline implemented in this branch

The fork keeps folder/drop-group sequence separately from the column comparator;
ascending and descending sorts reorder tracks only within each folder. Filtering,
collapse and Apply/Undo readback retain that sequence, and newly encountered folders
append. A newly opened library establishes its own sequence. Filename comparison
uses TagRex's existing natural numeric collator; equal keys retain their previous
order. Other tag-based grouping and ungrouped sorting keep their existing behavior.

Source import pairs selected file identities in full displayed order with checked
source tracks in release order, skipping unchecked tracks. Apply orders its reviewed
changes by the table, and existing native sequential writes drive the current-file
highlight. These rules implement Mike's requirements; exact TagScanner parity for
folder position, mapping and progress is still unverified.

The proposed mismatch blocker, explicit pairing display and broader preview
invalidation above remain proposals, not implemented features in this change.
