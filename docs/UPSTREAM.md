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
| Display metadata cache | [#741](https://github.com/tagrex/tagrex/pull/741), open/proposed, `main` |
| Shared artwork transport and encoding reuse | [#742](https://github.com/tagrex/tagrex/pull/742), open/proposed, `main` |
| Guarded/staged exports | [#743](https://github.com/tagrex/tagrex/pull/743), open/proposed, `main` |
| Linux experimental compositor workaround | [#744](https://github.com/tagrex/tagrex/pull/744), open/proposed, `next` |
| Allocation-free natural comparison | [#750](https://github.com/tagrex/tagrex/pull/750), accepted/merged into `main` |
| Sidecar filename filtering and per-preview directory batching | [#751](https://github.com/tagrex/tagrex/pull/751), accepted/merged into `main` |

These are submitted/proposed changes, not a claim that upstream has accepted them. The older combined #734 overlaps the focused native split and is not an additional implementation to merge. The maintainer controls merges into upstream `next`; this fork cannot make that branch current unilaterally.

The foundation is intentionally the one broad exception while it remains unmerged. Subsequent interface work should be small follow-ups once that base is available. Backend PRs must land on `main` and flow to `next`; the foundation's bundled native snapshot must be reconciled with the reviewed implementations before merge. The open proposals retain their documented platform/evaluation gates; ready-for-review status does not imply acceptance.

## Workbench/theme checkpoint reconciliation (2026-11-14)

Fork [#11](https://github.com/djhappyman/tagrex/pull/11) publishes all six source checkpoints through `b8199e44617da0180932e0fd766afd9f372a8080` into fork `main`. The publication branch also corrects six English staging-key quotes so the existing native catalogue validator sees them. Exact-head hosted Linux, Windows, macOS and advisory results are required before merge; the first source head failed that catalogue test and is not merge-ready.

The native compilation-field metadata is separately proposed to upstream `main` in [#761](https://github.com/tagrex/tagrex/pull/761), head `86aa61a3a2b88245ec1f69b3634ba7c126a81fbb`. It adds optional metadata for the existing Preview/Apply path, without new file writes or journal/player changes. It must flow from `main` to `next` before the dependent inspector is treated as complete.

The following focused Next branches are **prepared locally, not submitted upstream PRs**. Foundation #729 is still unmerged; opening each against current `next` would repeat its entire foundation. Publish them sequentially from actual upstream `next` after #729 and the native dependencies are reconciled, reapplying and verifying each patch. Their order is the table order; each row depends on the preceding row, starting at #729 head `0e103998bc4665d6b9c410089185435e817c4e0d`.

| Fork source | Prepared branch | Exact head |
| --- | --- | --- |
| `3294b25` | `contribution/followup-workbench-surfaces` | `bd3b4b09e8d0feb76ff3c2bc768b4698c43f4483` |
| `2eff3ae` | `contribution/followup-inspector-previews` | `3d7832026155f71358165da393494a9dfc0e7b22` |
| `56a3c56` | `contribution/followup-visual-fonts` | `0f4aac1221670fb021123b3ce50d449ec5050348` |
| `cef52f1` | `contribution/followup-menu-behaviour` | `53c408321d9c12693c795ef83889f2db970cd47b` |
| `fe75c3b` | `contribution/followup-staged-review` | `1f3f76026f1f60fff6ce67ec3ac0bf4eedddb560` |
| `b8199e4` | `contribution/followup-theme-presets` | `43987a6784a3ac80d1b67c810b33d1a2cbe91071` |
| Catalogue validation correction | `contribution/followup-catalogue-format` | `a35b36116ad4c4e3d523fa5a928b09a27dc24ca1` |

The prepared stack retains Next's settings controls, identity, updater guard, release workflow, inline journal, cross-version probe and stable waveform API. Blob comparisons verify those compatibility files are unchanged from #729. The six original UI commits are covered as prepared patches, **not yet proposed upstream**; that is the remaining publication gap. Personal branding/releases, updater policy and pooled on-disk journal records remain fork-only.

Fresh local checks: fork source has 91 unit tests and 404 browser tests passing (6 optional skips), Svelte check/build and 617 core/commands tests passing (9 ignored). Prepared Next source has 85 unit and 403 browser tests passing (6 optional skips), Svelte check/build; the subsequent quote-only correction passes native and JS catalogue checks. These Linux checks do not establish native Windows/macOS appearance or hosted success.

#741, #742 and #743 are open, not drafts. Maintainer reconciliation of their shared FileContext/docs, artwork simplification and FAT fallback/filesystem CI is owned separately; this publication does not alter those heads. #744 remains a separate open compositor proposal with native-rendering gates. #729 still needs accepted backend reconciliation before merge. No upstream branch is merged by this delivery.

## Explaining intentional differences

- Table dragging is designed around model-order selection, including grouped/offscreen rows. Filename-area gestures select rather than silently reorder files; spreadsheet editing and existing modifier semantics remain explicit. Preserve the tests for this workflow when reconciling main's different drag implementation.
- Automatic previews enable fast comparisons, but staged tagging/artwork/rename changes still require Apply. Validity and scope guards keep invalid or pending filters from applying a misleading selection; Apply retains an independent freshness/validity boundary.
- The component interface adds npm/build dependencies in exchange for retained controls, keyboard/focus behavior and consistent interaction surfaces. Its performance and maintenance costs must be measured rather than assumed better.
- A UI-specific workaround should not be imposed on stable main without a reproduction there. The compositor draft remains scoped to Next and retains launch-path and native-rendering acceptance gates.

When implementations conflict, document the concrete behavior, the reason it fits this interface, the safeguards/tests, and the tradeoffs. Do not replace an upstream interaction simply because it is newer, or describe this fork as universally more robust without evidence.

## Deliberate compatibility boundaries

The personal branch retains its existing pooled-artwork journal implementation. That on-disk format is not submitted as part of the Next refresh: upstream explicitly requires stable-readable inline image records, and those records and the cross-version probe are preserved there. No existing journal is silently converted. Sharing artwork in memory/transport and encoding reuse are separate from the journal format.

The compact personal player no longer uses the waveform analysis API. The upstream refresh retains that shared API and its tests because stable main still uses it; removing the control from one interface does not justify removing another interface's backend capability. These are intentional differences, so interface parity does not mean byte-identical Rust/configuration trees.
