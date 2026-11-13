# Agent entry point

Before planning a change, delegating work, proposing a commit, opening or merging
a PR, or retiring a branch, read [docs/WORKFLOW.md](docs/WORKFLOW.md).
Orchestrators must include its scope, completion gate and upstream route in each
worker brief and check the worker's evidence before integration.

Use the installed `codebase-memory` skill for structural code discovery, checking
coverage and reading source where coverage is incomplete. Use `tagrex-ui-iteration`
for interface changes and `tagrex-safe-audio-testing` for tag/artwork/rename/Undo
verification. Preserve active user work, portable builds, runtime state and Undo
history; test writes only against disposable fixtures.
