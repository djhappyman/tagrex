# Personal fork releases

This branch builds **Tagnetic**, formerly TagRex Personal. Its version line is
independent of upstream TagRex. Download packages from
[this fork’s releases](https://github.com/djhappyman/tagrex/releases).

New hosted builds use numeric `major.minor.patch` versions. Release tags keep
`personal-v<VERSION>`, for example `personal-v1.4.2`, for compatibility with the
existing publication workflow. See [Builds and releases](BUILDING.md) for the
current process and full package matrix. Existing published versions are not
renamed or replaced by the branding change.

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

The application identifier remains `com.djhappyman.tagrex.personal` so existing
settings and Undo history stay accessible. The visible name, icons, package
product name and future GitHub release titles use Tagnetic. Earlier portable
and hosted builds retain their original names and contents.
