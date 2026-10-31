const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readGroups, validateGroups, favoriteKey, extensionContainer, pinnedGroups, COLORS, NEUTRAL_COLOR } = require('../src/config');

test('config module loads with vscode blocked (pure)', () => {
  const Module = require('node:module');
  const file = require.resolve('../src/config');
  delete require.cache[file];
  const original = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'vscode') throw new Error('vscode must not be required');
    return original.call(this, request, ...rest);
  };
  try { assert.equal(typeof require('../src/config').readGroups, 'function'); } finally { Module._load = original; }
});

test('readGroups: non-array input yields empty list', () => {
  for (const raw of [undefined, null, {}, 'x', 5]) assert.deepEqual(readGroups(raw), []);
});

test('readGroups: drops malformed groups and items, assigns stable ids, default icon and neutral color', () => {
  const result = readGroups([
    null, { name: 1, items: [] }, { name: 'NoItems' },
    { name: 'A', items: [
      { name: 'ok', command: 'c.one', args: [1] },
      { name: 'rec', command: 'groupedTools.run' },
      { name: 'nocmd' }, { command: 'noname' }, null
    ] },
    { name: 'B', icon: 'plus', items: [{ name: 'x', command: 'c.two' }] }
  ]);
  assert.equal(result.length, 2);
  const [a, b] = result;
  assert.equal(a.name, 'A'); assert.equal(a.icon, 'extensions'); assert.equal(a.color, NEUTRAL_COLOR);
  assert.match(a.id, /^grp-/); assert.notEqual(a.id, b.id);
  assert.equal(a.items.length, 1);
  assert.deepEqual({ ...a.items[0], id: undefined }, { id: undefined, name: 'ok', command: 'c.one', icon: 'extensions', args: [1] });
  assert.match(a.items[0].id, /^it-/);
  assert.equal(b.icon, 'plus');
});

test('favoriteKey: stable, depends on command, name and args', () => {
  const base = { command: 'c', name: 'n' };
  assert.equal(favoriteKey(base), '["c","n",[]]');
  assert.equal(favoriteKey({ ...base, args: [] }), favoriteKey(base));
  assert.notEqual(favoriteKey({ ...base, args: [1] }), favoriteKey(base));
  assert.notEqual(favoriteKey({ ...base, name: 'm' }), favoriteKey(base));
});

test('validateGroups: rejects non-array and more than 100 groups', () => {
  for (const bad of [undefined, null, {}, 'x']) assert.throws(() => validateGroups(bad), /Lista de grupos inválida/);
  const many = Array.from({ length: 101 }, (_, i) => ({ name: `g${i}`, items: [] }));
  assert.throws(() => validateGroups(many), /Lista de grupos inválida/);
  assert.equal(validateGroups(many.slice(0, 100)).length, 100);
});

test('validateGroups: group-level errors', () => {
  const msg = /Informe o nome e os atalhos/;
  assert.throws(() => validateGroups([null]), msg);
  assert.throws(() => validateGroups([{ items: [] }]), msg);
  assert.throws(() => validateGroups([{ name: '   ', items: [] }]), msg);
  assert.throws(() => validateGroups([{ name: 'a' }]), msg);
  assert.throws(() => validateGroups([{ name: 'a', items: 'x' }]), msg);
  assert.throws(() => validateGroups([{ name: 'a', icon: 5, items: [] }]), /Ícone inválido/);
});

test('validateGroups: item-level errors', () => {
  const msg = /nome e comando válidos/;
  const wrap = item => [{ name: 'a', items: [item] }];
  assert.throws(() => validateGroups(wrap(null)), msg);
  assert.throws(() => validateGroups(wrap({ name: ' ', command: 'c' })), msg);
  assert.throws(() => validateGroups(wrap({ name: 'n', command: '  ' })), msg);
  assert.throws(() => validateGroups(wrap({ name: 'n' })), msg);
  assert.throws(() => validateGroups(wrap({ name: 'n', command: 'groupedTools.run' })), msg);
  assert.throws(() => validateGroups(wrap({ name: 'n', command: 'c', icon: 1 })), /Ícone inválido/);
  assert.throws(() => validateGroups(wrap({ name: 'n', command: 'c', args: 'x' })), /Argumentos devem ser uma lista/);
});

test('validateGroups: trims, defaults icons, keeps args only when present', () => {
  const out = validateGroups([{ name: '  G  ', items: [
    { name: '  A ', command: ' c.one ', icon: 'play', args: [1, 'x'] },
    { name: 'B', command: 'c.two' }
  ] }]);
  assert.deepEqual(out, [{ name: 'G', icon: 'extensions', items: [
    { name: 'A', command: 'c.one', icon: 'play', args: [1, 'x'] },
    { name: 'B', command: 'c.two', icon: 'extensions' }
  ] }]);
});

test('palette: ten fixed ids g-1..g-10, neutral is g-10', () => {
  assert.deepEqual(COLORS, ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6', 'g-7', 'g-8', 'g-9', 'g-10']);
  assert.equal(NEUTRAL_COLOR, 'g-10');
});

test('readGroups: preserves valid color and extensionId, invalid color falls back to neutral', () => {
  const [g, bad, none] = readGroups([
    { name: 'G', color: 'g-3', items: [{ name: 'i', command: 'workbench.view.extension.x', extensionId: 'pub.ext' }] },
    { name: 'Bad', color: 'red; background:url(x)', items: [{ name: 'j', command: 'c', extensionId: 'not valid' }] },
    { name: 'None', items: [] }
  ]);
  assert.equal(g.color, 'g-3');
  assert.equal(g.items[0].extensionId, 'pub.ext');
  assert.equal(bad.color, NEUTRAL_COLOR);
  assert.equal('extensionId' in bad.items[0], false);
  assert.equal(none.color, NEUTRAL_COLOR);
});

test('readGroups: ids are stable across reorder and moves between groups', () => {
  const x = { name: 'X', command: 'c.x' }, y = { name: 'Y', command: 'c.y', args: [1] }, z = { name: 'Z', command: 'c.z' };
  const before = readGroups([{ name: 'A', items: [x, y] }, { name: 'B', items: [z] }]);
  const after = readGroups([{ name: 'B', items: [z, x] }, { name: 'A', items: [y] }]);
  const ids = gs => Object.fromEntries(gs.flatMap(g => g.items).map(i => [i.name, i.id]));
  assert.deepEqual(ids(after), ids(before));
  assert.equal(after[0].id, before[1].id);
  assert.equal(after[1].id, before[0].id);
});

test('readGroups: persisted group id wins; duplicates and duplicate items get unique ids', () => {
  const out = readGroups([
    { id: 'mine', name: 'A', items: [{ name: 'n', command: 'c' }, { name: 'n', command: 'c' }] },
    { id: 'mine', name: 'B', items: [] },
    { id: 'bad id!', name: 'B', items: [] }
  ]);
  assert.equal(out[0].id, 'mine');
  assert.notEqual(out[1].id, 'mine');
  assert.equal(new Set(out.map(g => g.id)).size, 3);
  assert.notEqual(out[0].items[0].id, out[0].items[1].id);
});

test('validateGroups: accepts and preserves id, color and extensionId', () => {
  const out = validateGroups([{ id: 'grp-1', name: 'G', color: 'g-4', items: [{ name: 'A', command: 'c', extensionId: 'pub.ext', id: 'dropped', junk: 1 }] }]);
  assert.deepEqual(out, [{ id: 'grp-1', name: 'G', icon: 'extensions', color: 'g-4', items: [{ name: 'A', command: 'c', icon: 'extensions', extensionId: 'pub.ext' }] }]);
});

test('validateGroups: rejects invalid color, id, extensionId, repeated id and long names', () => {
  const g = extra => [{ name: 'G', items: [], ...extra }];
  assert.throws(() => validateGroups(g({ color: 'red' })), /Cor inválida/);
  assert.throws(() => validateGroups(g({ color: 5 })), /Cor inválida/);
  assert.throws(() => validateGroups(g({ id: 'a b' })), /Identificador de grupo inválido/);
  assert.throws(() => validateGroups([{ id: 'a', name: 'G', items: [] }, { id: 'a', name: 'H', items: [] }]), /repetido/);
  assert.throws(() => validateGroups(g({ name: 'x'.repeat(101) })), /100 caracteres/);
  assert.throws(() => validateGroups([{ name: 'G', items: [{ name: 'n', command: 'c', extensionId: 'nope' }] }]), /extensão inválido/);
  assert.doesNotThrow(() => validateGroups(g({ color: null })));
});

test('extensionContainer: only workbench.view.extension.<id> commands', () => {
  assert.equal(extensionContainer('workbench.view.extension.gitlens'), 'gitlens');
  assert.equal(extensionContainer('workbench.view.scm'), null);
  assert.equal(extensionContainer('workbench.view.extension.'), null);
  assert.equal(extensionContainer(undefined), null);
});

test('readGroups: pinned needs the pins option, a catalog icon and is unique per icon', () => {
  const raw = [
    { id: 'a', name: 'A', icon: 'database', pinned: true, items: [] },
    { id: 'b', name: 'B', icon: 'database', pinned: true, items: [] },
    { id: 'c', name: 'C', icon: 'not-in-catalog', pinned: true, items: [] },
    { id: 'd', name: 'D', icon: 'sparkle', pinned: true, items: [] },
    { id: 'e', name: 'E', icon: 'cloud', pinned: 'yes', items: [] }
  ];
  assert.deepEqual(readGroups(raw).map(g => g.pinned), [undefined, undefined, undefined, undefined, undefined]);
  assert.deepEqual(readGroups(raw, { pins: true }).map(g => g.pinned), [true, undefined, undefined, true, undefined]);
  assert.deepEqual(pinnedGroups(readGroups(raw, { pins: true })).map(g => g.id), ['a', 'd']);
});

test('validateGroups: pinned is kept in Global, dropped in project scope, and checked', () => {
  const g = extra => [{ id: 'a', name: 'G', icon: 'database', items: [], ...extra }];
  assert.equal(validateGroups(g({ pinned: true }))[0].pinned, true);
  assert.equal('pinned' in validateGroups(g({ pinned: false }))[0], false);
  assert.equal('pinned' in validateGroups(g({ pinned: true }), { scope: 'workspace' })[0], false);
  assert.doesNotThrow(() => validateGroups(g({ pinned: true, icon: 'not-in-catalog' }), { scope: 'workspace' }));
  assert.throws(() => validateGroups(g({ pinned: 'yes' })), /Valor inválido para fixar/);
  assert.throws(() => validateGroups(g({ pinned: true, icon: 'not-in-catalog' })), /não pode ser fixado/);
  assert.doesNotThrow(() => validateGroups(g({ pinned: true, icon: undefined })), 'default icon extensions maps to puzzle');
  assert.throws(() => validateGroups([...g({ pinned: true }), { id: 'b', name: 'H', icon: 'database', pinned: true, items: [] }]), /Só um grupo pode ser fixado por ícone/);
  assert.throws(() => validateGroups([...g({ pinned: true }), { id: 'b', name: 'H', icon: 'sparkle', pinned: true, items: [] }, { id: 'c', name: 'I', icon: 'sparkles', pinned: true, items: [] }]), /Só um grupo/, 'aliases share the catalog icon');
});
