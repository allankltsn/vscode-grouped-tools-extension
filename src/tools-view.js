'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const { readGroups, validateGroups, favoriteKey, extensionContainer, pinnedGroups } = require('./config');
const { runItem } = require('./commands');
const catalog = require('../media/pin-catalog');

const SCOPES = ['global', 'workspace'];
const MAX_OP = 200;
const PENDING_MS = 15000;
const GROUP_ID = /^[A-Za-z0-9_-]{1,64}$/;

function listViewExtensions() {
  return vscode.extensions.all.flatMap(extension => {
    const manifest = extension.packageJSON;
    return Object.entries(manifest.contributes?.views || {}).map(([container, views]) => ({
      name: manifest.displayName || manifest.name, extensionId: extension.id,
      command: `workbench.view.extension.${container}`,
      icon: 'extensions', views: views.map(v => v.name).join(', ')
    }));
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Maps every known view-container id to the extension that contributes it (views keys and
// viewsContainers), used to flag `workbench.view.extension.<id>` shortcuts whose extension is gone.
function containerIndex() {
  const index = new Map();
  for (const extension of vscode.extensions.all) {
    const contributes = extension.packageJSON?.contributes || {};
    for (const container of Object.keys(contributes.views || {})) if (!index.has(container)) index.set(container, extension.id);
    for (const list of Object.values(contributes.viewsContainers || {})) {
      if (Array.isArray(list)) for (const c of list) if (c && typeof c.id === 'string' && !index.has(c.id)) index.set(c.id, extension.id);
    }
  }
  return index;
}

// kind/extensionId/installed contract: installed is false only for container shortcuts whose
// container is missing; any other command is not verifiable (null).
function describeItem(item, favorites, containers) {
  const container = extensionContainer(item.command);
  const extensionId = item.extensionId ?? (container !== null ? containers.get(container) : undefined);
  return {
    id: item.id, name: item.name, command: item.command, icon: item.icon || 'extensions',
    favorite: favorites.has(favoriteKey(item)),
    kind: container !== null || item.extensionId ? 'extension' : 'command',
    ...(extensionId ? { extensionId } : {}),
    installed: container !== null ? containers.has(container) : null,
    ...(item.args ? { args: item.args } : {})
  };
}

class ToolsView {
  constructor(context, commandApi) { this.context = context; this.commandApi = commandApi; this.seq = 0; this.pending = null; }

  mediaUri(...parts) { return vscode.Uri.joinPath(this.context.extensionUri, 'media', ...parts); }

  // Raw template is read once per provider instance; placeholders are filled per webview.
  loadTemplate() {
    if (!this.template) {
      this.template = vscode.workspace.fs.readFile(this.mediaUri('view.html'))
        .then(bytes => Buffer.from(bytes).toString('utf8'))
        .catch(error => { this.template = undefined; throw error; });
    }
    return this.template;
  }

  async resolveWebviewView(view) {
    this.view = view;
    let disposed = false;
    view.webview.options = { enableScripts: true, localResourceRoots: [this.mediaUri()] };
    const subscription = view.webview.onDidReceiveMessage(message => this.handleMessage(view, message));
    view.onDidDispose(() => { disposed = true; subscription.dispose(); if (this.view === view) this.view = undefined; });
    let template;
    try { template = await this.loadTemplate(); } catch (error) {
      if (!disposed) vscode.window.showErrorMessage(`Não foi possível carregar o painel de atalhos: ${error.message || error}`);
      return;
    }
    if (disposed) return;
    const nonce = crypto.randomBytes(16).toString('hex');
    const uri = file => String(view.webview.asWebviewUri(this.mediaUri(file)));
    view.webview.html = template
      .replaceAll('{{nonce}}', nonce).replaceAll('{{csp}}', view.webview.cspSource)
      .replace('{{css}}', uri('view.css')).replace('{{icons}}', uri('icons.js')).replace('{{catalog}}', uri('pin-catalog.js'))
      .replace('{{model}}', uri('model.js')).replace('{{js}}', uri('view.js'));
  }

  // Scope state of the panel. The active scope is the one the webview chose; by default it is the
  // effective one (project when it has its own configuration, otherwise global).
  scopeState(inspected) {
    const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length);
    const folderOverride = inspected.workspaceFolderValue !== undefined;
    const projectOverride = inspected.workspaceValue !== undefined || folderOverride;
    let active = this.scope;
    if (!hasWorkspace) active = 'global';
    else if (folderOverride) active = 'workspace';
    else if (!SCOPES.includes(active)) active = projectOverride ? 'workspace' : 'global';
    return { active, hasWorkspace, projectOverride, folderOverride, readOnly: folderOverride };
  }

  inspectGroups() { return vscode.workspace.getConfiguration('groupedTools').inspect('groups') || {}; }

  rawGroups(inspected, scope) {
    if (scope.folderOverride) return vscode.workspace.getConfiguration('groupedTools').get('groups', []);
    if (scope.active === 'workspace') return inspected.workspaceValue ?? inspected.globalValue ?? inspected.defaultValue ?? [];
    return inspected.globalValue ?? inspected.defaultValue ?? [];
  }

  // Groups of the scope shown in the panel; every id sent by the webview is resolved against them.
  currentGroups() {
    const inspected = this.inspectGroups();
    const scope = this.scopeState(inspected);
    return readGroups(this.rawGroups(inspected, scope), { pins: scope.active === 'global' && !scope.folderOverride });
  }

  // Pins always come from the Global configuration, whatever scope the panel shows.
  globalGroups() {
    const inspected = this.inspectGroups();
    return readGroups(inspected.globalValue ?? inspected.defaultValue ?? [], { pins: true });
  }

  // Pinned Global groups with described items, for the status bar items and their hover.
  pinnedState() {
    const favorites = new Set(this.context.workspaceState.get('favorites', []));
    const containers = containerIndex();
    return pinnedGroups(this.globalGroups()).map(g => ({ ...g, items: g.items.map(i => describeItem(i, favorites, containers)) }));
  }

  async persist(view, message) {
    const kind = message.type === 'resetGroups' ? 'reset' : message.type === 'undo' ? 'undo' : message.type === 'useSuggested' ? 'suggested' : 'save';
    const op = typeof message.op === 'string' ? message.op.slice(0, MAX_OP) : '';
    try {
      if (!SCOPES.includes(message.scope)) throw new Error('Escopo inválido.');
      if (message.scope === 'workspace' && !vscode.workspace.workspaceFolders?.length) throw new Error('Abra um projeto para salvar nele.');
      const inspected = this.inspectGroups();
      if (inspected.workspaceFolderValue !== undefined) throw new Error('Há configuração por pasta; ajuste-a no Settings.');
      const target = message.scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      let value;
      if (kind === 'reset') value = undefined;
      else if (kind === 'suggested') value = validateGroups(inspected.defaultValue ?? [], { scope: message.scope });
      else value = validateGroups(message.groups, { scope: message.scope });
      const firstProjectEdit = message.scope === 'workspace' && kind !== 'reset' && inspected.workspaceValue === undefined;
      await vscode.workspace.getConfiguration('groupedTools').update('groups', value, target);
      const text = { reset: 'Configuração restaurada.', undo: 'Alteração desfeita.', suggested: 'Grupos sugeridos criados.', save: 'Grupos salvos.' }[kind];
      this.refresh();
      view.webview.postMessage({ type: 'saved', text, reason: { type: kind, text, op, firstProjectEdit } });
    } catch (error) {
      const text = error.message || String(error);
      view.webview.postMessage({ type: 'saveError', text, reason: { type: 'error', text, op, action: message.type } });
    }
  }

  async handleMessage(view, message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') {
      if (SCOPES.includes(message.scope)) this.scope = message.scope;
      this.refresh();
      this.deliverPending();
      return;
    }
    if (message.type === 'focusAck') {
      if (this.pending && this.pending.message.seq === message.seq) this.pending = null;
      return;
    }
    if (message.type === 'setScope') {
      if (SCOPES.includes(message.scope)) this.scope = message.scope;
      this.refresh();
      return;
    }
    if (message.type === 'configure') { await vscode.commands.executeCommand('workbench.action.openSettings', 'groupedTools.groups'); return; }
    if (['saveGroups', 'undo', 'resetGroups', 'useSuggested'].includes(message.type)) { await this.persist(view, message); return; }
    if (message.type === 'openMarketplace') {
      // Only extension ids that the configuration itself declares are searched.
      const known = this.currentGroups().flatMap(g => g.items).some(i => i.extensionId && i.extensionId === message.extensionId);
      if (known) await vscode.commands.executeCommand('workbench.extensions.search', `@id:${message.extensionId}`);
      return;
    }
    // Whitelist: only items resolved from configuration by id are ever executed.
    if (typeof message.id !== 'string') return;
    const item = this.currentGroups().flatMap(g => g.items).find(i => i.id === message.id);
    if (!item) return;
    if (message.type === 'run') await runItem(this.commandApi, item);
    if (message.type === 'favorite') {
      const favorites = new Set(this.context.workspaceState.get('favorites', []));
      const key = favoriteKey(item);
      if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
      await this.context.workspaceState.update('favorites', [...favorites]);
      this.refresh();
    }
  }

  // Navigation messages (focusGroup, openEditor, toggleFold) survive a webview that does not exist yet or is
  // reloading: they are kept until the webview acknowledges them, and resent after its next `ready`.
  navigate(message) {
    const full = { ...message, seq: ++this.seq };
    this.pending = { message: full, at: Date.now() };
    if (this.view) this.view.webview.postMessage(full);
    return full;
  }

  deliverPending() {
    if (!this.pending || !this.view) return;
    if (Date.now() - this.pending.at > PENDING_MS) { this.pending = null; return; }
    this.view.webview.postMessage(this.pending.message);
  }

  // Opens the panel on a pinned group: every other group collapsed, the group scrolled to, highlighted and focused.
  async openGroup(groupId, { organize = false, missing = false } = {}) {
    if (groupId !== undefined && (typeof groupId !== 'string' || !GROUP_ID.test(groupId))) return;
    this.navigate({ type: 'focusGroup', collapseOthers: true, ...(groupId ? { groupId } : {}), ...(organize ? { organize: true } : {}), ...(missing ? { missing: true } : {}) });
    await vscode.commands.executeCommand('groupedTools.view.focus');
  }

  // Click on a pin container: the pinned Global group of that icon, or the "missing" notice when none.
  async openPinned(icon) {
    const group = pinnedGroups(this.globalGroups()).find(g => catalog.pinIcon(g.icon) === icon);
    await this.openGroup(group ? group.id : undefined, group ? {} : { missing: true });
  }

  async openEditor() {
    this.navigate({ type: 'openEditor' });
    await vscode.commands.executeCommand('groupedTools.view.focus');
  }

  toggleFold() { if (this.view) this.view.webview.postMessage({ type: 'toggleFold' }); }

  // Status bar hover command: runs an item of a pinned Global group, resolved by ids from the configuration.
  async runPinnedItem(groupId, itemId) {
    if (typeof groupId !== 'string' || typeof itemId !== 'string') return;
    const group = pinnedGroups(this.globalGroups()).find(g => g.id === groupId);
    const item = group && group.items.find(i => i.id === itemId);
    if (item) await runItem(this.commandApi, item);
  }

  refresh() {
    if (!this.view) return;
    const favorites = new Set(this.context.workspaceState.get('favorites', []));
    const inspected = this.inspectGroups();
    const scope = this.scopeState(inspected);
    const containers = containerIndex();
    const groups = readGroups(this.rawGroups(inspected, scope), { pins: scope.active === 'global' && !scope.folderOverride }).map(g => ({
      id: g.id, name: g.name, icon: g.icon, color: g.color, ...(g.pinned ? { pinned: true } : {}),
      items: g.items.map(i => describeItem(i, favorites, containers))
    }));
    const assigned = new Map();
    for (const g of groups) for (const i of g.items) if (!assigned.has(i.command)) assigned.set(i.command, g);
    const all = listViewExtensions().map(e => ({ ...e, ...(assigned.has(e.command) ? { groupId: assigned.get(e.command).id, groupName: assigned.get(e.command).name } : {}) }));
    const unassigned = all.filter(e => !assigned.has(e.command)).map(({ extensionId, name, command, icon, views }) => ({ extensionId, name, command, icon, views }));
    const flat = groups.flatMap(g => g.items);
    const pins = pinnedGroups(this.globalGroups()).map(g => ({ groupId: g.id, icon: catalog.pinIcon(g.icon), name: g.name }));
    this.view.webview.postMessage({
      type: 'data', groups, scope, workspace: vscode.workspace.name || 'Pessoal', hasWorkspace: scope.hasWorkspace,
      extensions: all, unassigned, pins,
      stats: { items: flat.length, groups: groups.length, unassigned: unassigned.length, broken: flat.filter(i => i.installed === false).length }
    });
  }
}

module.exports = { ToolsView, listViewExtensions };
