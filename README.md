# TagRex Personal

An opinionated, modern music-tagging workbench built on [TagRex](https://github.com/tagrex/tagrex).

A familiar spreadsheet at the centre, focused tools around it, and a fast preview workflow for trying changes before applying them. This fork is developing its own interface direction while continuing to contribute useful shared fixes upstream.

**Development preview.** The name is provisional. The interface is still being refined; cross-platform builds and automated checks do not replace hands-on testing in each native webview. Fresh screenshots will be added after the next interface review.

## What is here today

- A spreadsheet-style file table with keyboard navigation, range selection, copy/paste, grouping and artwork-status filtering.
- Compact playback, responsive workspace panels and saved layouts.
- A progressive filter bar: start with text, then add field conditions and combine them without leaving the library.
- Automatic transformation previews and a clear Apply boundary for staged tagging, renaming and artwork changes. Toggle transformations to compare results, then use Undo for applied batches.
- An artwork picker with navigation, zoom, pan and rotation, plus online metadata from Discogs, MusicBrainz, Beatport, Bandcamp and Soundeo.
- Work to reduce repeated file reads, folder scans, artwork encoding, suggestion preparation and unchanged DOM updates. Large-library performance remains an active engineering goal.

The underlying Rust tagging, provider, player and recovery capabilities come from TagRex and its contributors, with additional fixes and optimizations in this fork. The inherited [user guide](docs/guide/README.md) remains useful for core operations; interface details can differ.

## Builds and installation

Use this fork's [Releases](https://github.com/djhappyman/tagrex/releases), not the original project's downloads, for this interface. Hosted personal releases begin once the current integration and platform checks pass; an empty releases page means none has been published yet.

The build pipeline is designed to produce:

| Platform | Output |
| --- | --- |
| Windows x64 and ARM64 | NSIS installer (`.exe`) |
| macOS Apple Silicon and Intel | Universal `.dmg` |
| Linux x64 | `.deb`, `.rpm`, AppImage |
| Linux ARM64 | `.deb`, `.rpm` |

Pushes to `main` run checks first, then produce downloadable development artifacts. A `personal-v<VERSION>` tag or published personal release runs the same gates before attaching packages to the release. See [build and release instructions](docs/BUILDING.md). Until these workflows finish successfully on GitHub, the outputs are configured targets rather than verified available downloads.

The app uses a separate identifier, `com.djhappyman.tagrex.personal`, and its own personal version line. **In-app update checking and installation are disabled** until a fork-specific service is introduced. Existing upstream installations and their settings/Undo history are kept separate. Initial packages are not notarized or signed with paid desktop certificates.

## Direction

The aim is a coherent, familiar interface with fast iteration and progressive disclosure: simple common actions up front, deeper controls when needed. Near-native responsiveness on demanding libraries is a goal to measure, not a claim already achieved across every workload.

The [preliminary roadmap](docs/ROADMAP.md) covers large-library performance, clearer A/B previews, filter refinement, accessibility, platform testing and release polish. Screenshots and a visual tour are intentionally deferred until the next hands-on session.

## Development

Use Node 22.12+ and Rust compatible with the workspace minimum, plus the platform's [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run check
npm run test:unit
npm run build
cargo test --workspace --locked
npm run test:ui
```

For native development and the local-only MCP bridge, see [development notes](docs/development.md). Always use disposable media when exercising writes or Undo.

## Upstream, attribution and contributions

This is an independent fork, not an official successor or an upstream-endorsed release. TagRex was created by [ThaVip3r](https://github.com/ThaVip3r) and its contributors. Its Rust/Tauri foundation and existing capabilities make this work possible. Original copyright and [GPL-3.0-only licensing](LICENSE) are retained; the inherited [upstream README](docs/upstream/README.md) is preserved for reference.

Useful shared backend improvements are offered to upstream `main`; interface contributions target upstream `next` under its experimental ground rules. Different interaction choices are explained through their intended workflow, safety boundaries and test evidence, without assuming one approach suits every interface. See [upstream contribution status and policy](docs/UPSTREAM.md).

Please report fork-specific interface problems in [this fork's issues](https://github.com/djhappyman/tagrex/issues). Shared fixes and contributions are welcome, whether or not the interface experiment is ultimately adopted upstream.
