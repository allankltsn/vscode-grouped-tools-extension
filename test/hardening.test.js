const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const SY = require('../media/sync');
const M = require('../media/model');
const config = require('../src/config');
const catalog = require('../media/pin-catalog');
const { checkBody } = require('../scripts/svg-allowlist');
const { measure } = require('../scripts/contrast');

// ---- REV-3: save/undo/merge state machine ----------------------------------------------------------------

const entry = (scope, tag = '') => ({ type: 'saveGroups', scope, op: tag, groups: [{ name: scope + tag }] });

test('sync: saves of the same scope coalesce into the latest one', () => {
  const s = SY.create();
  assert.equal(SY.enqueue(s, entry('global', 'a')), false);
  assert.equal(SY.enqueue(s, entry('global', 'b')), false);
  assert.equal(s.queue.length, 1);
  assert.equal(SY.take(s).op, 'b');
  assert.equal(SY.take(s), null, 'one in flight at a time');
});

test('sync: race save/scope - a pending save survives a scope switch while another is in flight', () => {
  const s = SY.create();
  SY.enqueue(s, entry('global', '1'));
  assert.equal(SY.take(s).scope, 'global'); // in flight
  SY.enqueue(s, entry('global', '2')); // edited again while saving
  assert.equal(SY.enqueue(s, entry('workspace', '3')), true, 'two scopes waiting: flush without debounce');
  assert.equal(SY.take(s), null, 'in flight blocks');
  let r = SY.saved(s);
  assert.deepEqual([r.again, r.waiting, r.settled], [true, false, false]);
  assert.equal(SY.take(s).op, '2');
  r = SY.saved(s);
  assert.equal(r.again, true);
  assert.equal(SY.take(s).op, '3', 'no edit was dropped');
  r = SY.saved(s);
  assert.deepEqual([r.again, r.waiting, r.settled], [false, false, true]);
  assert.equal(s.draft, false);
});

test('sync: saved while the debounce timer is running keeps the draft', () => {
  const s = SY.create();
  SY.enqueue(s, entry('global', '1')); SY.take(s);
  s.draft = true; SY.enqueue(s, entry('global', '2')); s.timer = 7;
  const r = SY.saved(s);
  assert.deepEqual([r.again, r.waiting, r.settled], [false, true, false]);
  assert.equal(s.draft, true);
});

test('sync: a failed save returns to the queue unless a newer one of that scope exists; retry clears the error', () => {
  const s = SY.create();
  SY.enqueue(s, entry('global', '1')); SY.take(s);
  SY.failed(s, 'Sem permissão');
  assert.equal(s.error, 'Sem permissão');
  assert.equal(s.queue[0].op, '1');
  SY.retry(s); assert.equal(s.error, null);
  assert.equal(SY.take(s).op, '1');
  SY.enqueue(s, entry('global', 'newer'));
  SY.failed(s, undefined);
  assert.equal(s.error, 'Erro desconhecido.');
  assert.deepEqual(s.queue.map(e => e.op), ['newer'], 'the newer payload wins');
  SY.discard(s);
  assert.deepEqual([s.queue.length, s.error, s.draft], [0, null, false]);
});

test('sync: data merge - draft in the same scope only takes favorites; other scope or no draft replaces', () => {
  const s = SY.create();
  const local = { groups: [{ id: 'g', name: 'edited', items: [{ id: 'i', favorite: false }] }], scope: 'global' };
  const message = { scope: { active: 'global' }, groups: [{ id: 'g', name: 'saved', items: [{ id: 'i', favorite: true }] }] };
  s.draft = true;
  let out = SY.merge(s, local, message);
  assert.equal(out.groups[0].name, 'edited');
  assert.equal(out.groups[0].items[0].favorite, true);
  assert.equal(s.draft, true);
  out = SY.merge(s, local, { ...message, scope: { active: 'workspace' } });
  assert.equal(out.groups[0].name, 'saved');
  assert.equal(out.scope, 'workspace');
  assert.equal(s.draft, false, 'switching scope drops the draft flag');
  out = SY.merge(s, local, message);
  assert.equal(out.groups[0].name, 'saved');
  assert.notEqual(out.groups, message.groups, 'cloned, never shared');
});

// ---- REV-6: duplicated constants between src/ and media/ -----------------------------------------------

test('src and media agree on colors, neutral color, group limit and id format', () => {
  assert.deepEqual(M.COLORS, config.COLORS);
  assert.equal(M.NEUTRAL, config.NEUTRAL_COLOR);
  assert.equal(M.MAX_GROUPS, config.MAX_GROUPS);
  for (let i = 0; i < 50; i++) assert.match(M.newId('grp-'), config.ID_PATTERN);
  assert.ok(M.newId('it-').length <= 64);
  const pkg = require('../package.json').contributes.configuration.properties['groupedTools.groups'];
  assert.deepEqual(pkg.items.properties.color.enum, config.COLORS);
  assert.equal(pkg.maxItems, config.MAX_GROUPS);
  assert.equal(pkg.items.properties.name.maxLength, config.MAX_NAME);
  assert.equal(pkg.items.properties.items.items.properties.name.maxLength, config.MAX_ITEM_NAME);
  assert.equal(pkg.items.properties.items.items.properties.command.maxLength, config.MAX_COMMAND);
});

test('model: createGroup stops at the group limit', () => {
  const full = Array.from({ length: M.MAX_GROUPS }, (_, i) => ({ id: `g${i}`, name: `g${i}`, items: [] }));
  const r = M.createGroup(full, { name: 'x' });
  assert.equal(r.changed, false);
  assert.equal(r.groups.length, M.MAX_GROUPS);
  assert.equal(M.createGroup(full.slice(1), { name: 'x' }).changed, true);
});

// ---- SEC-4: SVG allowlist -------------------------------------------------------------------------------

test('svg allowlist: rejects scripts, handlers, foreign attributes and stray markup', () => {
  assert.deepEqual(checkBody('<path d="M0 0 L1 1"/><circle cx="1" cy="1" r="2"/>'), []);
  assert.match(checkBody('<script/>')[0], /tag não permitida/);
  assert.match(checkBody('<path d="M0" onload="x()"/>')[0], /atributo não permitido: onload/);
  assert.match(checkBody('<path d="url(javascript:x)"/>')[0], /valor não permitido/);
  assert.match(checkBody('<path fill="red" d="M0"/>')[0], /valor não permitido em fill/);
  assert.match(checkBody('<path d="M0"/>text')[0], /conteúdo inesperado/);
  assert.match(checkBody('<foreignObject/>')[0], /tag não permitida/);
});

test('svg allowlist: every icon of media/icons.js and every media/pin/*.svg passes', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'media', 'icons.js'), 'utf8'), sandbox);
  const icons = Object.entries(sandbox.window.toolIcons);
  assert.ok(icons.length > 1000);
  for (const [name, body] of icons) assert.deepEqual(checkBody(body), [], name);
  const dir = path.join(root, 'media', 'pin'), files = fs.readdirSync(dir);
  assert.equal(files.length, catalog.PIN_ICONS.length);
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = /^<svg [^>]*>(.*)<\/svg>\n$/s.exec(text);
    assert.ok(m, f);
    assert.deepEqual(checkBody(m[1]), [], f);
  }
});

// ---- REV-7: codicon names -------------------------------------------------------------------------------

test('every status bar codicon exists in the codicon set shipped with VS Code 1.144.0', () => {
  // test/fixtures/codicons.txt: class names (.codicon-*) of extensions/simple-browser/media/codicon.css from the installed VS Code 1.144.0.
  const known = new Set(fs.readFileSync(path.join(__dirname, 'fixtures', 'codicons.txt'), 'utf8').split('\n').filter(Boolean));
  assert.ok(known.size > 500);
  for (const icon of catalog.PIN_ICONS) assert.ok(known.has(catalog.pinCodicon(icon)), `${icon} -> ${catalog.pinCodicon(icon)}`);
});

// ---- QA-7: palette contrast -----------------------------------------------------------------------------

test('group palette: bar >= 3:1 and group text >= 4.5:1 on Light+ and Dark+ sidebars', () => {
  const rows = measure();
  assert.equal(rows.length, 20);
  for (const r of rows) {
    assert.ok(r.bar >= 3, `${r.theme} ${r.group} bar ${r.bar.toFixed(2)}`);
    assert.ok(r.text >= 4.5, `${r.theme} ${r.group} text ${r.text.toFixed(2)}`);
  }
});
