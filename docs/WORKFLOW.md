# Contribution workflow

Agents and orchestrators must read this file before planning, delegation, commit
proposals, PR work or branch retirement. Explicit user instructions take priority.
This is an agent working agreement; it does not install an automatic GitHub bridge.

## 1. Scope the change

Record the intended behavior, the files owned, the completion condition, required
verification and upstream classification in the task/PR description. One branch
should deliver one independently reviewable concern. Workers implement their
assigned scope; the orchestrator reviews, resolves integration issues and verifies
the combined result. Delegation requires authorization from the current task.

Use the fork's current remote `main` as the base for personal work. Check the remote
URL explicitly: this workspace's `origin` can refer to upstream and `fork` to the
personal repository. Use an isolated checkout and preserve other threads' edits.

Keep at most three active personal feature branches by default. Waiting upstream
contribution branches are tracked separately and retained while their PRs are open.
Complete or explicitly park an existing personal task before starting a fourth.
A parked task must have a recovery ref and a short resumption note.

## 2. Reach a feature checkpoint

Offer a commit message only when the scoped feature or code change is complete:

- The intended behavior works and the diff contains only that concern.
- Appropriate checks have actually run on the candidate and their results are read.
- Review findings are resolved, or accepted limitations are explicitly recorded.
- User-visible changes preserve the required features and interaction boundaries.
  Ask for user judgment only where the task requires it or the intended behavior
  cannot reasonably be determined. Existing authorization remains valid.

At that point report `Checkpoint ready`, the completed behavior, verification
evidence and one feature-focused commit subject. Commit if the user has already
authorized commits; otherwise present the proposal. Keep incomplete iterations
in the working branch and describe what remains without proposing a completion
commit. An explicitly requested recovery/WIP commit is labeled as such and is
not a completed-feature checkpoint.

A large feature can have several checkpoints when each one is coherent, tested
and independently reviewable. Commit around behavior, not elapsed time or every
agent handoff. Keep private audit/history and generated build output out of PRs.

## 3. Review and publish

Open a focused PR into `djhappyman/tagrex:main`. Explain the problem, resulting
behavior, verification and material risks. A local passing result permits
publication; merge readiness requires hosted results on the exact pushed head.

Require Linux `check`, `windows`, `macos` and all applicable audit/check results to
pass. Pending, missing, cancelled, skipped and approval-required results remain
unverified. Inspect failed logs, fix the cause and verify the new pushed head.
Use the workspace's `tools/check-pr-ci.py` gate when available; otherwise inspect
the complete current-head matrix directly.

Where the host provides event-driven PR watches, retain one while checks/reviews
are pending. Read old comments before watching. Link newly created/pushed PRs as
required by the host. A new push invalidates an old head's green result.

## 4. Offer eligible work upstream

Classify every completed change, including fixes made during review:

| Classification | Route |
| --- | --- |
| Shared interface behavior | Curated PR to `tagrex/tagrex:next` |
| Standalone shared backend fix | Curated PR to `tagrex/tagrex:main` |
| Personal identity, releases, updater policy or incompatible fork-only storage | Fork only, with the reason recorded |

Read upstream's current `next/docs/next.md` before preparing a UI contribution.
Use explicit `--base next` or `--base main`. Prepare from a clean upstream base;
copy only the intended changes and verify the resulting diff. A dependent UI PR
must name its foundation and merge order while #729 remains unmerged. After the
foundation lands, base ordinary follow-ups on the actual upstream branch.

Record the fork commit, corresponding upstream PR and status in the PR body or
[upstream ledger](UPSTREAM.md). Statuses are proposed, waiting, accepted, adapted,
declined or fork-only. PR submission is not upstream acceptance.

Prepare the corresponding upstream PR as part of authorized eligible work.
Maintain deliberate compatibility differences: upstream journal images stay
inline and its stable waveform API remains available. Personal branding and
release configuration stay in the fork. Explain conflicting interaction choices
through behavior, safety checks and tradeoffs. The fork can progress while
upstream review is pending.

## 5. Merge and retire

Before merging, check current base/head, review disposition, full hosted gate and
remaining task-specific acceptance criteria. Merge within existing authorization.
For a stack, preserve ancestry, retarget the next layer and verify its new base
and checks. Remove only branches whose final heads have been accounted for.

Retire a merged personal branch after confirming its tip is included in the
merged history. For squash/adapted changes, retain a recovery bundle/ref and
verify the integration before retirement. Keep open upstream PR head branches.
Check for uncommitted work and dependent branches/worktrees before local cleanup;
never force-delete active work. Record retired branch names, SHAs and recovery
location. Delete remote refs with their expected SHA to avoid removing new work.

Update branch/PR status when work merges. Review the active personal branch list
after each merge; avoid creating a new checkpoint branch for every minor edit.

## 6. Verify delivery

A green PR proves its checked scope. A merged `main` commit also needs its
[Build and release](BUILDING.md) validation and package matrix checked before
installers are described as available or a release milestone is complete.

Use independent numeric app versions and `personal-v<VERSION>` tags. Publish a
release only when requested; a normal merge produces development artifacts.
Keep existing portable releases and state intact. After outputs are verified,
remove task-owned disposable build/probe output and retain compact evidence.

## Handoff

Report the completed behavior, exact commit/PR, verified checks, upstream route
and remaining blockers. Use `Implementing`, `Checkpoint ready`, `CI pending`,
`Merged` or `Packages verified` accurately; each describes a different gate.
