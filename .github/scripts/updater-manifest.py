#!/usr/bin/env python3
"""Write the in-app updater's latest.json for a release (#601).

Reads the update signatures the release builds produced, one artifact folder
per build (`tagrex-<matrix name>/…/<asset>.sig`), and names, per updater target,
the release asset to download and its signature. The plugin looks up
`{os}-{arch}-{installer}` first and `{os}-{arch}` second; Linux gets only the
installer keys, so a build that was not installed from a package finds nothing
and keeps the notice that opens the release page.

Usage: updater-manifest.py <artifacts dir> <tag> <owner/repo> <out file>
"""
import datetime
import json
import pathlib
import sys

ARCH = {"x64": "x86_64", "arm64": "aarch64"}

# Every key a complete release has; a missing one fails the job rather than
# publishing a manifest that silently leaves a platform behind.
EXPECTED = {
    "darwin-aarch64",
    "darwin-x86_64",
    "windows-x86_64",
    "windows-x86_64-nsis",
    "windows-aarch64",
    "windows-aarch64-nsis",
    "linux-x86_64-deb",
    "linux-x86_64-rpm",
    "linux-aarch64-deb",
    "linux-aarch64-rpm",
}


def targets(build, asset):
    """The updater targets an asset of `build` serves."""
    if build == "macos-universal" and asset.endswith(".app.tar.gz"):
        # One universal app for both architectures (#509).
        return ["darwin-aarch64", "darwin-x86_64"]
    kind, _, arch = build.partition("-")
    arch = ARCH.get(arch)
    if kind == "windows" and arch and asset.endswith("-setup.exe"):
        return [f"windows-{arch}-nsis", f"windows-{arch}"]
    if kind == "linux" and arch and asset.endswith(".deb"):
        return [f"linux-{arch}-deb"]
    if kind == "linux" and arch and asset.endswith(".rpm"):
        return [f"linux-{arch}-rpm"]
    raise SystemExit(f"no updater target for {asset} from {build}")


def main(artifacts, tag, repo, out):
    root = pathlib.Path(artifacts)
    base = f"https://github.com/{repo}/releases/download/{tag}/"
    platforms = {}
    for sig in sorted(root.rglob("*.sig")):
        build = sig.relative_to(root).parts[0].removeprefix("tagrex-")
        asset = sig.name[: -len(".sig")]
        if not sig.with_name(asset).is_file():
            raise SystemExit(f"{sig} has no bundle beside it")
        entry = {"signature": sig.read_text().strip(), "url": base + asset}
        for key in targets(build, asset):
            if key in platforms:
                raise SystemExit(f"two bundles for {key}")
            platforms[key] = entry
    missing = EXPECTED - platforms.keys()
    if missing:
        raise SystemExit(f"no bundle for {', '.join(sorted(missing))}")
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    manifest = {
        "version": tag.removeprefix("v"),
        "pub_date": now.isoformat().replace("+00:00", "Z"),
        "platforms": dict(sorted(platforms.items())),
    }
    pathlib.Path(out).write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
