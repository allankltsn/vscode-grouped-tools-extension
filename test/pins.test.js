const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const catalog = require('../media/pin-catalog');
const { build, apply } = require('../scripts/build-pins');
const { escapeMarkdown, tooltipSource, statusText, commandUri } = require('../src/pins');
const pkg = require('../package.json');

function icons() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'media', 'icons.js'), 'utf8'), sandbox);
  return sandbox.window;
}

test('catalog: unique icons, every one exists in icons.js, names and codicons present', () => {
  const lucide = icons();
  assert.equal(new Set(catalog.PIN_ICONS).size, catalog.PIN_ICONS.length);
  assert.ok(catalog.PIN_ICONS.length >= 30 && catalog.PIN_ICONS.length <= 50);
  for (const icon of catalog.PIN_ICONS) {
    assert.ok(lucide.toolIcons[icon], `${icon} missing from icons.js`);
    assert.match(icon, /^[a-z0-9-]+$/);
    assert.ok(catalog.pinName(icon) && catalog.pinName(icon) !== icon, icon);
    assert.match(catalog.pinCodicon(icon), /^[a-z0-9-]+$/);
  }
});

test('catalog: legacy aliases match icons.js and resolve to pinnable icons only', () => {
  assert.deepEqual(catalog.ICON_ALIASES, JSON.parse(JSON.stringify(icons().toolIconAliases)));
  assert.equal(catalog.pinIcon('sparkle'), 'sparkles');
  assert.equal(catalog.pinIcon('extensions'), 'puzzle');
  assert.equal(catalog.pinIcon('warning'), null, 'alias target outside the catalog');
  assert.equal(catalog.pinIcon('nope'), null);
  assert.equal(catalog.pinIcon(undefined), null);
  assert.equal(catalog.pinIcon('constructor'), null, 'no prototype lookups');
  assert.equal(catalog.contextKey('git-branch'), 'groupedTools.pinned.git_branch');
});

test('build-pins: package.json and media/pin/*.svg are in sync with the catalog', () => {
  const generated = build();
  assert.deepEqual(apply(pkg, generated), pkg, 'run node scripts/build-pins.js');
  const files = fs.readdirSync(path.join(root, 'media', 'pin')).sort();
  assert.deepEqual(files, Object.keys(generated.svgs).sort());
  for (const [file, text] of Object.entries(generated.svgs)) assert.equal(fs.readFileSync(path.join(root, 'media', 'pin', file), 'utf8'), text, file);
});

test('build-pins: idempotent and keeps the main container and view', () => {
  const once = apply(pkg), twice = apply(once);
  assert.deepEqual(twice, once);
  assert.equal(pkg.contributes.viewsContainers.activitybar[0].id, 'groupedTools');
  assert.equal(pkg.contributes.viewsContainers.activitybar.length, 1 + catalog.PIN_ICONS.length);
  assert.equal(pkg.contributes.views.groupedTools[0].id, 'groupedTools.view');
});

test('package.json: each pin container has one webview view hidden by its context key', () => {
  for (const icon of catalog.PIN_ICONS) {
    const container = pkg.contributes.viewsContainers.activitybar.find(c => c.id === catalog.containerId(icon));
    assert.ok(container, icon);
    assert.ok(fs.existsSync(path.join(root, container.icon)), container.icon);
    const views = pkg.contributes.views[container.id];
    assert.equal(views.length, 1);
    assert.deepEqual(views[0], { id: catalog.viewId(icon), name: container.title, type: 'webview', when: catalog.contextKey(icon) });
    assert.match(container.title, /^Ferramentas · /);
  }
});

test('pin svg: static, mask-friendly, no script or external reference', () => {
  for (const file of fs.readdirSync(path.join(root, 'media', 'pin'))) {
    const text = fs.readFileSync(path.join(root, 'media', 'pin', file), 'utf8');
    assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24"/);
    assert.ok(!/<script|href=|xlink|style=|url\(/i.test(text), file);
  }
});

test('package.json: settings schema accepts exactly the fields config.js reads', () => {
  const schema = pkg.contributes.configuration.properties['groupedTools.groups'].items;
  assert.deepEqual(Object.keys(schema.properties).sort(), ['color', 'icon', 'id', 'items', 'name', 'pinned']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.color.enum, require('../src/config').COLORS);
  assert.equal(schema.properties.pinned.type, 'boolean');
  assert.deepEqual(Object.keys(schema.properties.items.items.properties).sort(), ['args', 'command', 'extensionId', 'icon', 'name']);
  // the shipped defaults must satisfy the strict validator
  const { validateGroups } = require('../src/config');
  assert.doesNotThrow(() => validateGroups(pkg.contributes.configuration.properties['groupedTools.groups'].default));
});

test('package.json: commands, hidden internals, keybinding and activation', () => {
  const ids = pkg.contributes.commands.map(c => c.command);
  for (const id of ['groupedTools.openGroup', 'groupedTools.manageGroup', 'groupedTools.runById', 'groupedTools.toggleFold']) assert.ok(ids.includes(id), id);
  const hidden = pkg.contributes.menus.commandPalette.filter(m => m.when === 'false').map(m => m.command);
  assert.deepEqual(hidden.sort(), ['groupedTools.manageGroup', 'groupedTools.openGroup', 'groupedTools.runById']);
  assert.deepEqual(pkg.contributes.keybindings, [{ command: 'groupedTools.toggleFold', key: 'alt+shift+c', when: 'focusedView == groupedTools.view' }]);
  assert.ok(!ids.includes('groupedTools.run'), 'the generic run command is gone');
  assert.deepEqual(pkg.capabilities.untrustedWorkspaces, { supported: 'limited', description: pkg.capabilities.untrustedWorkspaces.description, restrictedConfigurations: ['groupedTools.groups'] });
  assert.deepEqual(pkg.activationEvents, ['onStartupFinished']);
});

test('escapeMarkdown: punctuation that could form links, icons or table cells is escaped', () => {
  const out = escapeMarkdown('A | [b](command:x) $(zap) <i> `c`\n*d*');
  for (const ch of ['|', '[', ']', '(', ')', '$', '<', '`', '*', ':']) {
    const bare = [...out].some((c, i) => c === ch && out[i - 1] !== '\\');
    assert.ok(!bare, `${ch} unescaped in ${out}`);
  }
  assert.ok(!out.includes('\n'));
});

test('statusText and commandUri', () => {
  assert.equal(statusText({ name: 'Git', icon: 'git-branch' }, 3), '$(git-branch) Git (3)');
  assert.equal(statusText({ name: 'x'.repeat(40), icon: 'unknown-icon' }, 1), `$(folder) ${'x'.repeat(29)}… (1)`);
  assert.equal(commandUri('a.b', ['x"y']), 'command:a.b?%5B%22x%5C%22y%22%5D');
});

test('tooltipSource: empty group, exactly 15 rows without the "Ver todas" line', () => {
  assert.match(tooltipSource({ id: 'g', name: 'Vazio' }, []), /Grupo vazio\./);
  const items = Array.from({ length: 15 }, (_, i) => ({ id: `i${i}`, name: `n${i}`, kind: 'command', installed: null }));
  const md = tooltipSource({ id: 'g', name: 'G' }, items);
  assert.ok(!md.includes('Ver todas'));
  assert.equal((md.match(/^\| \$\(terminal\)/gm) || []).length, 15);
});
