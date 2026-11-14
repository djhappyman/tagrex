# Upstream relationship and contribution ledger

TagRex Personal builds on [tagrex/tagrex](https://github.com/tagrex/tagrex). This fork's `main` is the canonical personal interface; upstream contributions use separate, curated branches. Personal branding, README, roadmap, versioning and release automation stay in the fork.

## Current coverage

| Concern | Upstream route |
| --- | --- |
| Component workbench, spreadsheet, workspace and artwork interface | [#729](https://github.com/tagrex/tagrex/pull/729), refreshed as the one-time foundation against `next` |
| Blocking command queues | [#737](https://github.com/tagrex/tagrex/pull/737), accepted/merged into `main` |
| Interrupted rollback recovery | [#738](https://github.com/tagrex/tagrex/pull/738), accepted/merged into `main` |
| Metadata-only Undo history | [#739](https://github.com/tagrex/tagrex/pull/739), accepted/merged into `main` |
| Provider clients and streamed duplicate hashes | [#740](https://github.com/tagrex/tagrex/pull/740), accepted/merged into `main` |
| Display metadata cache | [#741](https://github.com/tagrex/tagrex/pull/741), accepted/merged into `main` |
| Shared artwork transport and encoding reuse | [#742](https://github.com/tagrex/tagrex/pull/742), open/proposed, `main` |
| Guarded/staged exports | [#743](https://github.com/tagrex/tagrex/pull/743), open/proposed, `main` |
| Linux experimental compositor workaround | [#744](https://github.com/tagrex/tagrex/pull/744), Draft, `next`; native evidence pending |
| Allocation-free natural comparison | [#750](https://github.com/tagrex/tagrex/pull/750), accepted/merged into `main` |
| Sidecar filename filtering and per-preview directory batching | [#751](https://github.com/tagrex/tagrex/pull/751), accepted/merged into `main` |

These are submitted/proposed changes, not a claim that upstream has accepted them. The older combined #734 overlaps the focused native split and is not an additional implementation to merge. The maintainer controls merges into upstream `next`; this fork cannot make that branch current unilaterally.

The foundation is intentionally the one broad exception while it remains unmerged. Subsequent interface work should be small follow-ups once that base is available. Backend PRs must land on `main` and flow to `next`; the foundation's bundled native snapshot must be reconciled with the reviewed implementations before merge. The open proposals retain their documented platform/evaluation gates; ready-for-review status does not imply acceptance.

## Workbench/theme checkpoint reconciliation (2026-11-14)

Fork [#11](https://github.com/djhappyman/tagrex/pull/11) is merged into fork `main` at `a1a2ad31046dbcab1e3278c2e3421b2cac200f0d`. All four checks passed on head `0e35c26`: Linux, Windows, macOS and advisories. It carries all six UI checkpoints, staging catalogue quoting and a Chromium-compatible input-width assertion; the assertion retains its original threshold and changes no production layout. Compatibility follow-up [#12](https://github.com/djhappyman/tagrex/pull/12) now targets actual fork `main` and requires its own exact-head platform/filesystem gate before merge.

The native compilation-field metadata is separately proposed to upstream `main` in [#761](https://github.com/tagrex/tagrex/pull/761), head `e4b9f93`. It adds optional metadata for the existing Preview/Apply path, without new file writes or journal/player changes. It is included as an explicit pending-main dependency in #729. The latest review adds fallback from an incapable read block to the primary write tag type, with real-file cached-row wiring and key-mapping regressions.

All six workbench/theme UI checkpoints and their catalogue correction are now proposed within the existing one-time foundation [#729](https://github.com/tagrex/tagrex/pull/729), at `b938880b0cfe4e7a5aa7adc762e3651954b5aef8`. The additive compilation-field metadata from #761 is included as an explicit pending-main dependency. This closes the UI publication gap without opening follow-ups that repeat the entire unmerged foundation. Its native snapshot now reconciles accepted main/cache changes with the artwork/export proposals, compilation metadata and primary-writer fallback. Upstream approval of pending native proposals and the experiment's platform/performance evaluation remain gates; publication does not mean acceptance. Prepared intermediate refs remain in the verified recovery bundle and are historical, not separate open PRs. Future contributions should be small once the foundation lands.

Fresh local checks: fork source has 91 unit tests and 404 browser tests passing (6 optional skips), Svelte check/build and 617 core/commands tests passing (9 ignored). Prepared Next source has 85 unit and 403 browser tests passing (6 optional skips), Svelte check/build; the subsequent quote-only correction passes native and JS catalogue checks. These Linux checks do not establish native Windows/macOS appearance or hosted success.

## Maintainer review follow-ups (2026-11-14)

- #741: cache documentation restored; helper/item documentation and spacing added. Current-main reconciliation retains both cache and sidecar modules. The optional core constructor refactor is deferred to keep the reviewed change narrow. The same documentation correction is in the fork.
- #742: upstream uses a simpler request-scoped SHA-256 encoding map, with current-main conflicts resolved. The personal fork deliberately retains its faster identity-cache implementation: a release helper comparison at 100 references to one 1.9 MB image measured 3.26 ms versus 88.84 ms, median of nine runs, with identical output. This is not app-level timing. The [maintainer was informed](https://github.com/tagrex/tagrex/pull/742#issuecomment-6879665997).
- #743: guarded exports now support Unix filesystems without exclusive rename or hard links through a checked rename fallback. The last fallback has an explicitly documented race between absence check and rename; permission errors and pre-existing targets do not enter it. Windows cloud tags are distinguished from path-redirecting reparse tags; traverse rights replace directory-list access for ancestor pins. FAT/exFAT CI is separate from ordinary platform CI. macOS FAT32 and Windows exFAT passed on the first revision; corrected ExFAT-image/PowerShell test setup still needs exact-head hosted verification. These fixes are also in the fork follow-up.
- #744 is now accurately marked Draft. Native flash and restart/launch-path evidence remain outstanding; a green build does not close them.
- New upstream Ogg-codec refusal, AppleDouble scanning and dependency safeguards are adopted in the fork without changing its interface, identity or release policy. They refuse unsupported Ogg FLAC before an unsafe AAC misidentification, exclude macOS `._` files, enable the trash 5.3 Linux backend explicitly, and keep incompatible Windows/zbus major updates out of automated proposals.

The maintainer has now merged #741 into main. #742, #743 and #761 remain open for maintainer review. No upstream merge was performed by this agent. Fork follow-ups require their own full hosted gate before merging.

## Explaining intentional differences

- Table dragging is designed around model-order selection, including grouped/offscreen rows. Filename-area gestures select rather than silently reorder files; spreadsheet editing and existing modifier semantics remain explicit. Preserve the tests for this workflow when reconciling main's different drag implementation.
- Automatic previews enable fast comparisons, but staged tagging/artwork/rename changes still require Apply. Validity and scope guards keep invalid or pending filters from applying a misleading selection; Apply retains an independent freshness/validity boundary.
- The component interface adds npm/build dependencies in exchange for retained controls, keyboard/focus behavior and consistent interaction surfaces. Its performance and maintenance costs must be measured rather than assumed better.
- A UI-specific workaround should not be imposed on stable main without a reproduction there. The compositor draft remains scoped to Next and retains launch-path and native-rendering acceptance gates.

When implementations conflict, document the concrete behavior, the reason it fits this interface, the safeguards/tests, and the tradeoffs. Do not replace an upstream interaction simply because it is newer, or describe this fork as universally more robust without evidence.

## Deliberate compatibility boundaries

The personal branch retains its existing pooled-artwork journal implementation. That on-disk format is not submitted as part of the Next refresh: upstream explicitly requires stable-readable inline image records, and those records and the cross-version probe are preserved there. No existing journal is silently converted. Sharing artwork in memory/transport and encoding reuse are separate from the journal format.

The compact personal player no longer uses the waveform analysis API. The upstream refresh retains that shared API and its tests because stable main still uses it; removing the control from one interface does not justify removing another interface's backend capability. These are intentional differences, so interface parity does not mean byte-identical Rust/configuration trees.
