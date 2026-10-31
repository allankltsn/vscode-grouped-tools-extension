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
  const store = {}, calls = [], updates = [], messages = [], contexts = [];
  const handlers = { config: [], extensions: [], editor: [], folders: [] };
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
      all: [{ id: 'test.spotify', packageJSON: { name: 'Spotify', contributes: { views: { 'vscode-spotify': [{ name: 'Playlists' }] } } } }],
      getExtension: id => (id === 'test.spotify' ? { extensionUri: { fsPath: 'C:/ext/spotify', toString() { return 'file:///c%3A/ext/spotify'; } }, packageJSON: { icon: 'img/icon.png' } } : undefined),
      onDidChange: f => (handlers.extensions.push(f), mk())
    },
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), toString() { return `${uri.toString()}/${parts.join('/')}`; } }) },
    workspace: {
      name: 'AuraFit', workspaceFolders: [{}], getConfiguration: () => config,
      onDidChangeConfiguration: f => (handlers.config.push(f), mk()),
      onDidChangeWorkspaceFolders: f => (handlers.folders.push(f), mk()),
      fs: overrides.fs || { readFile: async uri => { reads.push(uri.fsPath); return fsp.readFile(uri.fsPath); } }
    },
    window: {
      registerWebviewViewProvider: (id, p) => (providers.set(id, p), mk()),
      onDidChangeActiveTextEditor: f => (handlers.editor.push(f), disposable),
      showErrorMessage: async m => calls.push(m),
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
  const context = { extensionUri: { fsPath: root }, subscriptions: [], workspaceState: { get: (k, d) => store[k] || d, update: async (k, v) => { store[k] = v; } } };
  load(vscode).activate(context);
  const provider = providers.get('groupedTools.view');
  let onMessage, onDispose;
  const view = {
    webview: { asWebviewUri: u => u, cspSource: 'local', postMessage: m => messages.push(m), onDidReceiveMessage: f => (onMessage = f, disposable) },
    onDidDispose: f => { onDispose = f; return disposable; }
  };
  return { vscode, provider, providers, commandHandlers, statusItems, contexts, view, groups, config, calls, updates, messages, handlers, reads, context, created, inspected,
    send: m => onMessage(m), dispose: () => onDispose() };
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
  const variados = messages.at(-1).groups.find(g => g.name === 'Variados');
  assert.equal(variados.icon, 'plus');
  assert.equal(variados.items.length, 2);
  for (const item of variados.items) await send({ type: 'run', id: item.id });
  assert.deepEqual(calls.splice(0), [
    ['workbench.view.extension.vscode-spotify'],
    ['workbench.view.extension.clickup-kanban-sidebar-view']
  ]);
  assert.equal(first.favorite, false);
  await send({ type: 'favorite', id: first.id });
  assert.equal(messages.at(-1).groups[0].items[0].favorite, true);
  await send({ type: 'run', id: 'invented', command: 'untrusted' });
  assert.equal(calls.length, 0);
  await send({ type: 'run', id: first.id });
  assert.equal(calls[0][0], 'workbench.view.extension.claude-sidebar');
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
  assert.equal(scripts.length, 4);
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
