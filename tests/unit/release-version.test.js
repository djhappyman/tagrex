import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

test('personal releases use a numeric RPM-compatible version consistently', async () => {
  const config = JSON.parse(await readFile(new URL('app/tauri.conf.json', root), 'utf8'));
  assert.match(config.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    'use a numeric app version; personal tags and the GitHub prerelease flag identify preview releases');
  const manifest = await readFile(new URL('Cargo.toml', root), 'utf8');
  const workspace = manifest.split('[workspace.package]')[1]?.split(/\n\[/)[0];
  assert.ok(workspace, 'workspace package metadata exists');
  assert.equal(workspace.match(/^version = "([^"]+)"/m)?.[1], config.version);
  const lock = await readFile(new URL('Cargo.lock', root), 'utf8');
  const packages = lock.split('[[package]]').filter(block => /^name = "tagrex(?:-[^"]+)?"$/m.test(block));
  assert.ok(packages.length > 0, 'workspace packages exist in the lockfile');
  for (const block of packages) {
    assert.equal(block.match(/^version = "([^"]+)"/m)?.[1], config.version,
      block.match(/^name = "([^"]+)"/m)?.[1]);
  }
});
