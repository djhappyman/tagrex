# Personal fork releases

This branch builds **TagRex Personal**, identifier `com.djhappyman.tagrex.personal`.
Its version line is independent of upstream. The first performance-checkpoint
release is `1.4.0-personal.1`; future bumps are chosen for this fork's changes.
Upstream version tags are not release instructions for this fork.

Fork release tags use `personal-v<VERSION>`, for example
`personal-v1.4.0-personal.1`. The release workflow builds ordinary installers,
without updater signatures or `latest.json`. A local build/tag does not publish
a GitHub release. Hosted publication still needs the applicable platform checks.

There is no in-app update service yet. Startup/manual frontend checks are inert,
the settings controls are hidden, native check/install commands are guarded off,
and the original updater plugin registration, endpoint and public key are absent
from this build's configuration. A future fork updater must use its own feed and
keys; do not re-enable the original project's feed.

The bundle identifier keeps installed state separate from upstream and Next.
The local portable launcher additionally keeps its state under the personal
release directory, separate from the existing portable app and its Undo history.
No automatic migration or overwriting of those existing files is performed.

Upstream provider fixes #746, #747 and #748 are integrated selectively. Existing
drag behavior, cached provider clients, command queues and performance changes
remain. A separate fix prevents superseded provider replies from repopulating
the next search's caches.
