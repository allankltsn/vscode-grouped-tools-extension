const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runItem } = require('../src/commands');

function fakeApi(fail) {
  const executed = [], errors = [];
  return { executed, errors,
    executeCommand: async (...a) => { executed.push(a); if (fail) throw new Error('boom'); },
    showErrorMessage: m => errors.push(m) };
}

test('runItem: recursive groupedTools.run is never executed', async () => {
  const api = fakeApi();
  await runItem(api, { command: 'groupedTools.run', name: 'x' });
  assert.equal(api.executed.length, 0);
});

test('runItem: ignores missing item or non-string command', async () => {
  const api = fakeApi();
  await runItem(api, undefined);
  await runItem(api, { command: 5 });
  assert.equal(api.executed.length, 0);
});

test('runItem: executes command with args, surfaces failures', async () => {
  const api = fakeApi();
  await runItem(api, { command: 'a.b', args: [1, 2], name: 'n' });
  await runItem(api, { command: 'a.c', args: 'nope', name: 'n' });
  assert.deepEqual(api.executed, [['a.b', 1, 2], ['a.c']]);
  const bad = fakeApi(true);
  await runItem(bad, { command: 'a.b', name: 'Tool' });
  assert.match(bad.errors[0], /Tool.*boom/);
});
