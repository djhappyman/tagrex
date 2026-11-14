import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadFunction } from './interaction-codex-harness.js';

function harness(groupBy = 'folder') {
  const context = vm.createContext({
    groupBy, sortKey: 'file', sortDir: 1, folderSortOrders: new Map(),
    tracks: [
      { path: 'Z/take10', folder: 'Z', name: 'take10' },
      { path: 'Z/take2', folder: 'Z', name: 'take2' },
      { path: 'A/take10', folder: 'A', name: 'take10' },
      { path: 'A/take2', folder: 'A', name: 'take2' },
    ],
    groupKeyOf: track => track.folder,
    sortValue: track => track.name,
    coverState: () => 'embedded',
    setManualOrder: () => {}, reindexTracks: () => {},
    numericCollator: new Intl.Collator(undefined, { numeric: true }),
  });
  vm.runInContext(loadFunction('app/ui/app.js', 'folderOrderForSort') + '\n' + loadFunction('app/ui/app.js', 'sortTracks'), context);
  return context;
}
const paths = context => Array.from(context.tracks, track => track.path);

for (const groupBy of ['folder', 'drop']) test(`${groupBy} order stays fixed across direction changes, readback and new folders`, () => {
  const context = harness(groupBy);
  context.sortTracks();
  assert.deepEqual(paths(context), ['Z/take2', 'Z/take10', 'A/take2', 'A/take10']);
  context.sortDir = -1; context.sortTracks();
  assert.deepEqual(paths(context), ['Z/take10', 'Z/take2', 'A/take10', 'A/take2']);
  // Disk readback need not arrive in the session's folder order.
  context.tracks.reverse();
  context.tracks.unshift({ path: 'B/take1', folder: 'B', name: 'take1' });
  context.sortTracks();
  assert.deepEqual(paths(context), ['Z/take10', 'Z/take2', 'A/take10', 'A/take2', 'B/take1']);
  context.folderSortOrders.clear(); context.tracks.reverse(); context.sortTracks();
  assert.equal(paths(context)[0], 'B/take1'); // a new session gets its own order
});

test('ungrouped sorting still sorts the full list', () => {
  const context = harness('');
  context.sortTracks();
  assert.deepEqual(paths(context), ['Z/take2', 'A/take2', 'Z/take10', 'A/take10']);
});
