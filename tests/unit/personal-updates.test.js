import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('personal startup and manual update APIs schedule no work or network request', async () => {
  const source = readFileSync(new URL('../../app/ui/js/updatecheck.js', import.meta.url), 'utf8');
  const calls = [];
  const context = vm.createContext({
    setTimeout: (...args) => calls.push(['timer', ...args]),
    invoke: (...args) => calls.push(['invoke', ...args]),
    fetch: (...args) => calls.push(['fetch', ...args]),
  });
  vm.runInContext(source.replaceAll('export ', ''), context);
  context.initUpdateCheck();
  await context.checkUpdateNow();
  assert.deepEqual(calls, []);
});
