# Contribution coverage

## Current interface proposal

[Upstream #729](https://github.com/tagrex/tagrex/pull/729) remains the one-time component-interface foundation against `next`. Its original head `0e103998bc4665d6b9c410089185435e817c4e0d` included the earlier workbench, selection, filters, compact player, settings and transformation-preset work. The following fork checkpoints are now included as distinct review commits on that foundation, without duplicate PRs:

| Fork checkpoint | Proposed behavior | Curated commit |
| --- | --- | --- |
| `3294b25` | Shared workbench surfaces and action footer | `bd3b4b09e8d0feb76ff3c2bc768b4698c43f4483` |
| `2eff3ae` | Tagging inspector and grouped previews | `3d7832026155f71358165da393494a9dfc0e7b22` |
| `56a3c56` | Visual system and four offline font families | `0f4aac1221670fb021123b3ce50d449ec5050348` |
| `cef52f1` | Dropdown/context-menu positioning and focus | `53c408321d9c12693c795ef83889f2db970cd47b` |
| `fe75c3b` | Files/Staged review and inspector refinements | `1f3f76026f1f60fff6ce67ec3ac0bf4eedddb560` |
| `b8199e4` | Ten paired light/dark theme presets | `43987a6784a3ac80d1b67c810b33d1a2cbe91071` |
| Catalogue validation correction | Six staging-key quotes recognized by native validation | `a35b36116ad4c4e3d523fa5a928b09a27dc24ca1` |

The additive compilation metadata and regressions from [#761](https://github.com/tagrex/tagrex/pull/761), head `86aa61a3a2b88245ec1f69b3634ba7c126a81fbb`, are included as an explicit **pending-main dependency** so this inspector's compilation controls have complete backend support. The standalone proposal must be reviewed through `main`, then integrated into `next` and reconciled with this copy. Inclusion here is not upstream acceptance.

## Shared native proposals and merge order

| Proposal | Route / status |
| --- | --- |
| [#737](https://github.com/tagrex/tagrex/pull/737) command queues | accepted/merged, `main` |
| [#738](https://github.com/tagrex/tagrex/pull/738) rollback recovery | accepted/merged, `main` |
| [#739](https://github.com/tagrex/tagrex/pull/739) metadata-only history | accepted/merged, `main` |
| [#740](https://github.com/tagrex/tagrex/pull/740) provider clients/streamed hashes | accepted/merged, `main` |
| [#750](https://github.com/tagrex/tagrex/pull/750) natural comparison | accepted/merged, `main` |
| [#751](https://github.com/tagrex/tagrex/pull/751) sidecar batching | accepted/merged, `main` |
| [#741](https://github.com/tagrex/tagrex/pull/741) display cache | open/proposed, `main`; separate maintainer reconciliation |
| [#742](https://github.com/tagrex/tagrex/pull/742) shared artwork | open/proposed, `main`; separate maintainer reconciliation |
| [#743](https://github.com/tagrex/tagrex/pull/743) guarded exports | open/proposed, `main`; separate filesystem/maintainer gates |
| [#761](https://github.com/tagrex/tagrex/pull/761) native compilation metadata | open/proposed, `main`; pending dependency included here |
| [#744](https://github.com/tagrex/tagrex/pull/744) compositor workaround | open/proposed, `next`; separate native-rendering gates |

All listed open proposals are ready-for-review rather than draft as of this refresh; this is not approval. Closed #734 is superseded by focused native proposals and must not be merged as additional coverage.

The native snapshot already bundled by the old foundation is **not** replaced by this UI refresh. The separately revised #741/#742/#743 heads are not integrated or modified here. Review/merge native changes through `main`, flow accepted `main` into `next`, then reconcile this foundation's bundled implementations and pending #761 copy before merging #729. Upstream main observed at `0b8029a8a2617bd5fdc93aee5f6f17ac9b7aa279`; current-main adoption remains an explicit gate. Future UI contributions should be focused follow-ups once this initial foundation lands.

## Compatibility and outstanding evaluation

This refresh preserves #729's inline stable-readable journal, cross-version probe/tests, stable waveform APIs, Next identity (`com.tagrex.next`), disabled native updater and release workflow. The fork's pooled journal format, personal branding, versions, releases and updater policy are excluded. No existing journal is converted. The source checkpoint stops at `b8199e4`; later parent UI/native changes need separate coverage.

Files/Staged views share a draft and retain explicit Preview/Apply/Undo. Table gestures retain model-order selection including grouped/offscreen rows; pending/invalid-filter guards remain. These workflow choices need their own evaluation, rather than replacing stable main's policies by assertion.

Exact-head hosted Linux, Windows, macOS and advisory gates remain required after publication. Local Linux checks do not establish native Windows/macOS appearance, native webview/input-to-paint comparison, large-library performance parity, packaging or releases. Maintainer judgment, backend reconciliation and the `docs/next.md` experiment measurements remain separate blockers even with green CI.
