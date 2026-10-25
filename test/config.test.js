const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readGroups, validateGroups, favoriteKey } = require('../src/config');

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

test('readGroups: drops malformed groups and items, assigns ids and default icon', () => {
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
  assert.deepEqual(result[0], { name: 'A', icon: 'extensions', id: 'g0', items: [{ name: 'ok', command: 'c.one', args: [1], id: '0:0' }] });
  assert.equal(result[1].id, 'g1');
  assert.equal(result[1].icon, 'plus');
  assert.equal(result[1].items[0].id, '1:0');
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
  const msg = /Informe o nome e as ferramentas/;
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
