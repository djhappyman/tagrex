import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { planRelease, verifyBundles, assertAssets } from '../../tools/personal-release.mjs';
const env = { GITHUB_REPOSITORY: 'djhappyman/tagrex', GITHUB_SHA: 'a'.repeat(40), GITHUB_REF: 'refs/heads/main' };

test('manual publication requires a personal fork, numeric version and exact version tag', () => {
  assert.equal(planRelease('1.4.1', env).publish, false);
  assert.equal(planRelease('1.4.1', { ...env, PUBLISH_RELEASE: 'true' }).publish, true);
  assert.equal(planRelease('1.4.1', { ...env, GITHUB_REF: 'refs/tags/personal-v1.4.1' }).publish, true);
  assert.throws(() => planRelease('1.4.1', { ...env, GITHUB_REPOSITORY: 'tagrex/tagrex' }));
  assert.throws(() => planRelease('1.4.1', { ...env, GITHUB_REF: 'refs/tags/personal-v1.4.2' }));
  assert.throws(() => planRelease('1.4.1-personal.1', env));
});
function fixture(t) {
  const root = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'personal-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const matrix = {
    'linux-x64': ['amd64.deb', 'x86_64.rpm', 'amd64.AppImage'],
    'linux-arm64': ['arm64.deb', 'aarch64.rpm'],
    'macos-universal': ['universal.dmg'], 'windows-x64': ['x64.exe'], 'windows-arm64': ['arm64.exe'],
  };
  for (const [name, types] of Object.entries(matrix)) {
    const dir = join(root, `tagnetic-${name}`, 'nested'); mkdirSync(dir, { recursive: true });
    for (const type of types) writeFileSync(join(dir, `Tagnetic_1.4.1_${type}`), 'package');
  }
  return root;
}
test('full installer set is required, including both Linux formats and AppImage', t => {
  const root = fixture(t); const files = verifyBundles(root, '1.4.1'); assert.equal(files.length, 8);
  rmSync(files.find(f => f.endsWith('.AppImage')));
  assert.throws(() => verifyBundles(root, '1.4.1'));
});
test('wrong versions, empty packages and unexpected duplicate formats are rejected', t => {
  const root = fixture(t); assert.throws(() => verifyBundles(root, '1.4.10'));
  const files = verifyBundles(root, '1.4.1'); writeFileSync(files[0], ''); assert.throws(() => verifyBundles(root, '1.4.1'));
  writeFileSync(files[0], 'package'); writeFileSync(join(root, 'tagnetic-linux-x64', 'duplicate.deb'), 'extra');
  assert.throws(() => verifyBundles(root, '1.4.1'));
});
test('published draft assets must match every file size and SHA-256 digest', t => {
  const root = fixture(t); const files = verifyBundles(root, '1.4.1');
  const assets = files.map(f => ({ name: basename(f), size: statSync(f).size, digest: `sha256:${createHash('sha256').update(readFileSync(f)).digest('hex')}` }));
  assertAssets(assets, files);
  assert.throws(() => assertAssets(assets.slice(1), files));
  assets[0].digest = 'sha256:wrong'; assert.throws(() => assertAssets(assets, files));
});
