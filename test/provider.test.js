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
  const store = {}, calls = [], updates = [], messages = [];
  const handlers = { config: [], extensions: [], editor: [], folders: [] };
  const groups = JSON.parse(JSON.stringify(require('../package.json').contributes.configuration.properties['groupedTools.groups'].default));
  const created = [];
  const mk = () => { const d = { dispose() {} }; created.push(d); return d; };
  const disposable = { dispose() {} };
  const config = { get: () => groups, inspect: () => ({ defaultValue: groups }), update: async (...args) => updates.push(args) };
  const reads = [];
  let provider;
  const vscode = {
    ConfigurationTarget: { Global: 1, Workspace: 2 },
    extensions: {
      all: [{ id: 'test.spotify', packageJSON: { name: 'Spotify', contributes: { views: { 'vscode-spotify': [{ name: 'Playlists' }] } } } }],
      onDidChange: f => (handlers.extensions.push(f), mk())
    },
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), toString() { return this.fsPath; } }) },
    workspace: {
      name: 'AuraFit', workspaceFolders: [{}], getConfiguration: () => config,
      onDidChangeConfiguration: f => (handlers.config.push(f), mk()),
      onDidChangeWorkspaceFolders: f => (handlers.folders.push(f), mk()),
      fs: overrides.fs || { readFile: async uri => { reads.push(uri.fsPath); return fsp.readFile(uri.fsPath); } }
    },
    window: {
      registerWebviewViewProvider: (id, p) => (provider = p, mk()),
      onDidChangeActiveTextEditor: f => (handlers.editor.push(f), disposable),
      showErrorMessage: async m => calls.push(m)
    },
    commands: { registerCommand: () => mk(), executeCommand: async (...args) => calls.push(args) }
  };
  const context = { extensionUri: { fsPath: root }, subscriptions: [], workspaceState: { get: (k, d) => store[k] || d, update: async (k, v) => { store[k] = v; } } };
  load(vscode).activate(context);
  let onMessage, onDispose;
  const view = {
    webview: { asWebviewUri: u => u, cspSource: 'local', postMessage: m => messages.push(m), onDidReceiveMessage: f => (onMessage = f, disposable) },
    onDidDispose: f => { onDispose = f; return disposable; }
  };
  return { vscode, provider, view, groups, config, calls, updates, messages, handlers, reads, context, created,
    send: m => onMessage(m), dispose: () => onDispose() };
}

test('provider: data, favorites, command whitelist and configuration refresh', async () => {
  const { vscode, provider, view, groups, config, calls, updates, messages, handlers, send } = setup();
  await provider.resolveWebviewView(view);
  assert.ok(!view.webview.html.includes('{{'));
  assert.ok(view.webview.html.includes("default-src 'none'"));
  await send({ type: 'ready' });
  const variados = messages.at(-1).groups.find(g => g.name === 'Variados');
  assert.equal(variados.icon, 'plus');
  assert.equal(variados.items.length, 2);
  for (const item of variados.items) await send({ type: 'run', id: item.id });
  assert.deepEqual(calls.splice(0), [
    ['workbench.view.extension.vscode-spotify'],
    ['workbench.view.extension.clickup-kanban-sidebar-view']
  ]);
  assert.equal(messages.at(-1).groups[0].items[0].favorite, false);
  await send({ type: 'favorite', id: '0:0' });
  assert.equal(messages.at(-1).groups[0].items[0].favorite, true);
  await send({ type: 'run', id: 'invented', command: 'untrusted' });
  assert.equal(calls.length, 0);
  await send({ type: 'run', id: '0:0' });
  assert.equal(calls[0][0], 'workbench.action.showCommands');
  await send({ type: 'favorite', id: '0:0' });
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

test('activate: every disposable ends up in context.subscriptions', () => {
  const { context, created } = setup();
  assert.equal(created.length, 6);
  assert.equal(context.subscriptions.length, created.length);
  for (const d of created) assert.ok(context.subscriptions.includes(d));
});

test('template: read once per provider and cached across webviews', async () => {
  const { provider, view, reads } = setup();
  await provider.resolveWebviewView(view);
  const first = view.webview.html;
  await provider.resolveWebviewView(view);
  assert.equal(reads.length, 1);
  assert.notEqual(view.webview.html, first, 'a fresh nonce is generated per resolve');
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
