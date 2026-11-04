const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../media/model');

const G = () => [
  { id: 'a', name: 'A', icon: 'database', color: 'g-1', pinned: true, items: [{ id: 'i1', name: 'x', command: 'c1', icon: 'x' }, { id: 'i2', name: 'y', command: 'c2', icon: 'y' }] },
  { id: 'b', name: 'B', icon: 'database', color: 'g-2', items: [] },
  { id: 'c', name: 'C', icon: 'not-pinnable', color: 'g-3', items: [{ id: 'i3', name: 'z', command: 'c3', icon: 'z' }] }
];

test('model: moveItem and stepItem keep ids and report the new position', () => {
  const r = M.moveItem(G(), 'i1', 'b', null);
  assert.equal(r.changed, true); assert.equal(r.group.id, 'b'); assert.equal(r.index, 0);
  assert.deepEqual(r.groups[0].items.map(i => i.id), ['i2']);
  assert.equal(M.moveItem(G(), 'i1', 'a', 'i1').changed, false);
  const down = M.stepItem(G(), 'i2', 'down');
  assert.equal(down.group.id, 'b', 'crosses into the next group at the edge');
  assert.equal(M.stepItem(G(), 'i1', 'up').changed, false);
});

test('model: moveGroup, createGroup, removeGroup and updateGroup do not mutate the input', () => {
  const g = G(); const before = JSON.stringify(g);
  assert.deepEqual(M.moveGroup(g, 'c', 'a').groups.map(x => x.id), ['c', 'a', 'b']);
  assert.equal(M.createGroup(g, { name: 'N' }).groups.length, 4);
  assert.equal(M.removeGroup(g, 'b').groups.length, 2);
  assert.equal(M.updateGroup(g, 'b', { name: 'Q' }).group.name, 'Q');
  assert.equal(JSON.stringify(g), before);
});

test('model: serialize keeps pinned only in Global and drops UI-only fields', () => {
  const g = G(); g[0].items[0].favorite = true; g[0].items[0].installed = false;
  const global = M.serialize(g, 'global'), project = M.serialize(g, 'workspace');
  assert.equal(global[0].pinned, true);
  assert.equal('pinned' in project[0], false);
  assert.deepEqual(Object.keys(global[0].items[0]).sort(), ['command', 'icon', 'name']);
  assert.equal(global[1].color, 'g-2');
});

test('model: pin state machine (free, pinned, conflict, needs-icon, scope)', () => {
  const g = G();
  assert.equal(M.pinState(g, g[0], 'global').state, 'pinned');
  const conflict = M.pinState(g, g[1], 'global');
  assert.equal(conflict.state, 'conflict'); assert.equal(conflict.owner.id, 'a');
  assert.equal(M.pinState(g, g[2], 'global').state, 'needs-icon');
  assert.equal(M.pinState(g, g[1], 'workspace').state, 'scope');
  g[1].icon = 'cloud';
  assert.equal(M.pinState(g, g[1], 'global').state, 'free');
});

test('model: setPinned, replacePin and pinWithIcon enforce one group per icon', () => {
  const g = G();
  assert.equal(M.setPinned(g, 'b', true).changed, false, 'icon already pinned by a');
  assert.equal(M.setPinned(g, 'c', true).changed, false, 'icon not pinnable');
  const off = M.setPinned(g, 'a', false);
  assert.equal(off.changed, true); assert.equal('pinned' in off.groups[0], false);
  const swap = M.replacePin(g, 'a', 'b');
  assert.equal(swap.groups[0].pinned, undefined); assert.equal(swap.groups[1].pinned, true);
  assert.equal(M.replacePin(g, 'a', 'c').changed, false);
  assert.equal(M.pinWithIcon(g, 'c', 'database').changed, false, 'in use by a');
  const ok = M.pinWithIcon(g, 'c', 'cloud');
  assert.equal(ok.group.icon, 'cloud'); assert.equal(ok.group.pinned, true);
  assert.equal(M.pinWithIcon(g, 'c', 'nope').changed, false);
});

test('model: iconBlock explains why a picker cell is unavailable', () => {
  const g = G();
  assert.match(M.iconBlock(g, g[1], 'database', 'pin'), /Em uso por “A”/);
  assert.match(M.iconBlock(g, g[1], 'nope', 'pin'), /não fixável/i);
  assert.match(M.iconBlock(g, g[0], 'nope', 'locked'), /desafixe/);
  assert.equal(M.iconBlock(g, g[0], 'cloud', 'locked'), '');
  assert.equal(M.iconBlock(g, g[1], 'database', 'free'), '');
});

test('model: searchIcons ranks exact names first, accepts pt-BR words and tags', () => {
  const names = ['database', 'database-backup', 'git-branch', 'folder'], tags = { folder: 'directory pasta' };
  assert.equal(M.searchIcons(names, tags, 'database')[0], 'database');
  assert.deepEqual(M.searchIcons(names, tags, 'banco'), ['database', 'database-backup']);
  assert.deepEqual(M.searchIcons(names, tags, 'directory'), ['folder']);
  assert.deepEqual(M.searchIcons(names, tags, 'zzz'), []);
  assert.equal(M.searchIcons(names, tags, '').length, 4);
});

