import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, statSync, appendFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const repository = 'djhappyman/tagrex';
export function planRelease(version, env) {
  assert.equal(env.GITHUB_REPOSITORY, repository, 'Personal builds run only in the personal fork');
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.match(env.GITHUB_SHA, /^[a-f0-9]{40}$/);
  const tag = `personal-v${version}`;
  if (env.GITHUB_REF?.startsWith('refs/tags/')) assert.equal(env.GITHUB_REF, `refs/tags/${tag}`, 'Tag must match app version');
  return { version, tag, sha: env.GITHUB_SHA, publish: env.PUBLISH_RELEASE === 'true' || env.GITHUB_REF === `refs/tags/${tag}` };
}
export function verifyBundles(root, version) {
  const expected = {
    'tagnetic-linux-x64': ['.deb', '.rpm', '.AppImage'],
    'tagnetic-linux-arm64': ['.deb', '.rpm'],
    'tagnetic-windows-x64': ['.exe'],
    'tagnetic-windows-arm64': ['.exe'],
    'tagnetic-macos-universal': ['.dmg'],
  };
  const walk = path => readdirSync(path).flatMap(name => {
    const p = join(path, name); return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const files = [];
  for (const [artifact, extensions] of Object.entries(expected)) {
    const found = walk(join(root, artifact));
    assert.equal(found.length, extensions.length, `Incomplete/unexpected files in ${artifact}`);
    for (const ext of extensions) {
      const matches = found.filter(f => f.endsWith(ext));
      assert.equal(matches.length, 1, `Expected one ${ext} in ${artifact}`);
      const file = matches[0];
      assert.ok(basename(file).includes(`_${version}_`) || basename(file).includes(`-${version}-`), `Wrong version: ${file}`);
      assert.ok(statSync(file).size > 0, `Empty package: ${file}`);
      files.push(file);
    }
  }
  assert.equal(new Set(files.map(f => basename(f))).size, files.length, 'Release asset names must be unique');
  return files.sort((a, b) => basename(a).localeCompare(basename(b)));
}
const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function api(path) {
  try { return JSON.parse(gh(['api', `repos/${repository}/${path}`])); }
  catch (error) { if (String(error.stderr).includes('HTTP 404')) return null; throw error; }
}
function checkUnusedRelease(plan) {
  const ref = api(`git/ref/tags/${plan.tag}`);
  if (ref) {
    let object = ref.object;
    for (let i = 0; object.type === 'tag' && i < 10; i++) object = api(`git/tags/${object.sha}`).object;
    assert.equal(object.type, 'commit');
    assert.equal(object.sha, plan.sha, 'Existing version tag points to different code; bump the app version');
  }
  assert.equal(api(`releases/tags/${plan.tag}`), null, 'Version already has a release/draft; use a new version or explicitly recover the draft');
}
export function assertAssets(assets, files) {
  assert.equal(assets.length, files.length, 'Incomplete uploaded asset set');
  for (const file of files) {
    const asset = assets.find(a => a.name === basename(file));
    assert.ok(asset, `Missing uploaded asset: ${file}`);
    assert.equal(asset.size, statSync(file).size);
    assert.equal(asset.digest, `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`);
  }
}
function main() {
  const plan = planRelease(JSON.parse(readFileSync('app/tauri.conf.json')).version, process.env);
  const command = process.argv[2];
  if (command === 'plan') {
    if (plan.publish) checkUnusedRelease(plan);
    for (const [key, value] of Object.entries(plan)) if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    console.log(JSON.stringify(plan)); return;
  }
  assert.equal(command, 'publish'); assert.ok(plan.publish, 'Publication must be requested');
  checkUnusedRelease(plan);
  const root = resolve(process.argv[3]); const sourceFiles = verifyBundles(root, plan.version);
  const staging = join(root, 'release-assets'); mkdirSync(staging, { recursive: true });
  const files = sourceFiles.map(file => {
    const dest = join(staging, basename(file).replace(/[^A-Za-z0-9._-]/g, '-'));
    return { file, dest };
  });
  assert.equal(new Set(files.map(f => f.dest)).size, files.length, 'Normalized release names must be unique');
  for (const { file, dest } of files) copyFileSync(file, dest);
  const assets = files.map(f => f.dest);
  const sums = join(root, 'SHA256SUMS.txt');
  writeFileSync(sums, assets.map(f => `${createHash('sha256').update(readFileSync(f)).digest('hex')}  ${basename(f)}\n`).join(''));
  const info = join(root, 'build-info.json');
  writeFileSync(info, JSON.stringify({ ...plan, repository, run: process.env.BUILD_RUN_URL || `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}` }, null, 2) + '\n');
  assets.push(sums, info);
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const section = changelog.split(`## [${plan.version}]`)[1]?.split(/\n## \[/)[0]?.replace(/^[^\n]*\n/, '').trim();
  const notes = join(root, 'release-notes.md');
  writeFileSync(notes, `Tagnetic development prerelease.\n\n${section || `Tagnetic ${plan.version}.`}\n\nSource: ${plan.sha}\nBuild: ${process.env.BUILD_RUN_URL || `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`}\n\nWindows x64/ARM64; universal macOS; Linux x64 DEB/RPM/AppImage and ARM64 DEB/RPM. Packages are not notarized or signed with paid desktop certificates. In-app updates remain disabled.\n`);
  let created;
  try {
    created = JSON.parse(gh(['api', '--method', 'POST', `repos/${repository}/releases`, '-f', `tag_name=${plan.tag}`, '-f', `target_commitish=${plan.sha}`, '-f', `name=Tagnetic ${plan.version}`, '-f', `body=${readFileSync(notes, 'utf8')}`, '-F', 'draft=true', '-F', 'prerelease=true', '-f', 'make_latest=false']));
    assert.ok(created?.draft);
    gh(['release', 'upload', plan.tag, '--repo', repository, ...assets]);
    const draft = api(`releases/${created.id}`); assert.equal(draft.id, created.id); assert.ok(draft.draft); assertAssets(draft.assets, assets);
    gh(['release', 'edit', plan.tag, '--repo', repository, '--draft=false', '--prerelease', '--latest=false']);
    console.log(gh(['release', 'view', plan.tag, '--repo', repository, '--json', 'url', '--jq', '.url']));
  } catch (error) {
    // Remove only this invocation's unpublished draft; retain its source tag.
    if (created) {
      const current = api(`releases/${created.id}`);
      if (current?.draft) gh(['api', '--method', 'DELETE', `repos/${repository}/releases/${created.id}`]);
    }
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
