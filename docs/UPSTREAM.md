# Upstream relationship and contribution ledger

TagRex Personal builds on [tagrex/tagrex](https://github.com/tagrex/tagrex). This fork's `main` is the canonical personal interface; upstream contributions use separate, curated branches. Personal branding, README, roadmap, versioning and release automation stay in the fork.

## Current coverage

| Concern | Upstream route |
| --- | --- |
| Component workbench, spreadsheet, workspace and artwork interface | [#729](https://github.com/tagrex/tagrex/pull/729), refreshed as the one-time foundation against `next` |
| Blocking command queues | [#737](https://github.com/tagrex/tagrex/pull/737), `main` |
| Interrupted rollback recovery | [#738](https://github.com/tagrex/tagrex/pull/738), `main` |
| Metadata-only Undo history | [#739](https://github.com/tagrex/tagrex/pull/739), `main` |
| Provider clients and streamed duplicate hashes | [#740](https://github.com/tagrex/tagrex/pull/740), `main` |
| Display metadata cache | [#741](https://github.com/tagrex/tagrex/pull/741), draft, `main` |
| Shared artwork transport and encoding reuse | [#742](https://github.com/tagrex/tagrex/pull/742), draft, `main` |
| Guarded/staged exports | [#743](https://github.com/tagrex/tagrex/pull/743), draft, `main` |
| Linux experimental compositor workaround | [#744](https://github.com/tagrex/tagrex/pull/744), draft, `next` |
| Allocation-free natural comparison | [#750](https://github.com/tagrex/tagrex/pull/750), `main` |
| Sidecar filename filtering and per-preview directory batching | [#751](https://github.com/tagrex/tagrex/pull/751), `main` |

These are submitted/proposed changes, not a claim that upstream has accepted them. The older combined #734 overlaps the focused native split and is not an additional implementation to merge. The maintainer controls merges into upstream `next`; this fork cannot make that branch current unilaterally.

The foundation is intentionally the one broad exception while it remains unmerged. Subsequent interface work should be small follow-ups once that base is available. Backend PRs must land on `main` and flow to `next`; the foundation's bundled native snapshot must be reconciled with the reviewed implementations before merge. Drafts retain their documented platform/evaluation gates.

## Explaining intentional differences

- Table dragging is designed around model-order selection, including grouped/offscreen rows. Filename-area gestures select rather than silently reorder files; spreadsheet editing and existing modifier semantics remain explicit. Preserve the tests for this workflow when reconciling main's different drag implementation.
- Automatic previews enable fast comparisons, but staged tagging/artwork/rename changes still require Apply. Validity and scope guards keep invalid or pending filters from applying a misleading selection; Apply retains an independent freshness/validity boundary.
- The component interface adds npm/build dependencies in exchange for retained controls, keyboard/focus behavior and consistent interaction surfaces. Its performance and maintenance costs must be measured rather than assumed better.
- A UI-specific workaround should not be imposed on stable main without a reproduction there. The compositor draft remains scoped to Next and retains launch-path and native-rendering acceptance gates.

When implementations conflict, document the concrete behavior, the reason it fits this interface, the safeguards/tests, and the tradeoffs. Do not replace an upstream interaction simply because it is newer, or describe this fork as universally more robust without evidence.

## Deliberate compatibility boundaries

The personal branch retains its existing pooled-artwork journal implementation. That on-disk format is not submitted as part of the Next refresh: upstream explicitly requires stable-readable inline image records, and those records and the cross-version probe are preserved there. No existing journal is silently converted. Sharing artwork in memory/transport and encoding reuse are separate from the journal format.

The compact personal player no longer uses the waveform analysis API. The upstream refresh retains that shared API and its tests because stable main still uses it; removing the control from one interface does not justify removing another interface's backend capability. These are intentional differences, so interface parity does not mean byte-identical Rust/configuration trees.
