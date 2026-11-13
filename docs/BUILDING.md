# Builds and personal releases

## Routine development

Push a feature branch and open a PR against this fork's `main`. GitHub Actions checks Linux, Windows and macOS, runs the frontend tests and audits dependencies. Exact-head results matter: a new push invalidates an older green result.

A push to `main` runs those same reusable CI checks through **Build and release**, then packages the same commit into development artifacts. PR validation contains only applicable checks; packaging is a dependent job in the separate build workflow. Download them from the successful **Build and release** run's **Artifacts** section. These are development builds, not published releases.

## Publish a personal pre-release

1. Set matching personal versions in `Cargo.toml`, workspace entries in `Cargo.lock`, and `app/tauri.conf.json`. Add a matching changelog heading.
2. Merge the reviewed change only after applicable checks pass.
3. Push a matching tag, for example `personal-v1.4.0-personal.2`. Alternatively publish a GitHub release using that personal tag. A published release triggers the same validation/package path.
4. Wait for all validation and all package jobs. The publication job attaches packages only after the complete build matrix succeeds; it is not marked Latest and does not generate an updater manifest.

Do not create an upstream-style `v*` tag for personal builds. The tag version is checked against the app configuration before packaging.

## Package targets

- Windows x64/ARM64: NSIS `.exe`.
- macOS: universal Apple Silicon/Intel `.dmg`.
- Linux x64: `.deb`, `.rpm` and AppImage; ARM64: `.deb` and `.rpm`.

The workflow uses native GitHub runners and caches dependencies. A cancelled/no-step runner allocation is an infrastructure blocker, not a successful platform check. The macOS CI job is explicitly pinned to an Intel macOS 15 runner rather than the floating label previously cancelled before executing steps; the release runner remains the pinned Apple Silicon runner for the universal build.

Current builds have no paid Windows signing or Apple notarization, and in-app updates remain disabled. Those can be added with this fork's own credentials/feed later. They are not required to compile and package the application.

## Local Linux build

```sh
npm ci
npm run build
npx tauri build --bundles appimage --ci -- --locked
```

Keep personal state separate from upstream and test writes on disposable media. Build caches and generated installers are not source files to commit.

GitHub documentation: [workflow triggers](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), [artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data).

For feature checkpoints, paired upstream contributions and branch retirement,
see the [contribution workflow](WORKFLOW.md).
