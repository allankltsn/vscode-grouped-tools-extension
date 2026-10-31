'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const { readGroups, validateGroups, favoriteKey, favoriteHash, HIDDEN, extensionContainer, pinnedGroups } = require('./config');
const { runItem } = require('./commands');
const catalog = require('../media/pin-catalog');
const { resolveIcon } = require('./ext-icons');

const SCOPES = ['global', 'workspace'];
const MAX_OP = 200;
const PENDING_MS = 15000;
// After a navigation (pin click, hover link, gear) the panel becomes visible on purpose: no fold restore then.
// (cap; the focusAck of the navigation ends the window earlier, after a short grace).
const NAVIGATION_MS = 5000;
const NAVIGATION_GRACE_MS = 400;
const ARGS_PREVIEW = 1500;
const MAX_APPROVED = 200;
const MAX_FAVORITES = 500;
// A project (workspace) item runs without asking only when it opens a view container (workbench.view.*) or is
// one of these harmless workbench actions without arguments. Everything else (tasks, debug, terminal,
// runCommands, other extensions' commands, anything with args) asks first.
const SAFE_VIEW_COMMAND = /^workbench\.view\.[A-Za-z0-9_.-]+$/;
const SAFE_ACTIONS = new Set([
  'workbench.action.showCommands', 'workbench.action.quickOpen', 'workbench.action.openSettings', 'workbench.action.openSettings2',
  'workbench.action.toggleSidebarVisibility', 'workbench.action.togglePanel', 'workbench.action.toggleZenMode',
  'workbench.action.toggleMaximizedPanel',
  'workbench.action.focusSideBar', 'workbench.action.focusPanel', 'workbench.action.focusActiveEditorGroup', 'workbench.action.showAllEditors'
]);
const isSafeProjectCommand = command => SAFE_VIEW_COMMAND.test(command) || SAFE_ACTIONS.has(command);
// Hidden characters are shown as an escape sequence so the modal text cannot be disguised.
const visible = text => String(text).replace(HIDDEN, ch => {
  const cp = ch.codePointAt(0), hex = cp.toString(16).toUpperCase();
  return cp > 0xFFFF ? `\\u{${hex}}` : `\\u${hex.padStart(4, '0')}`;
});
// Long runs of blanks would push the payload out of sight in the modal: show them as a counter.
// "Blank" = any Unicode space plus the invisible fillers (braille blank, Hangul fillers) and the JSON escapes of
// tab/newline/return (args are shown as JSON text, so a tab appears as the two characters backslash and t).
const BLANK_UNIT = String.raw`(?:\\[tnr]|[\s⠀ㅤﾠᅟᅠ])`;
const BLANK_RUN = new RegExp(BLANK_UNIT + '{4,}', 'gu');
const BLANK_ANY = new RegExp(BLANK_UNIT, 'gu');
const blankLength = run => run.replace(/\\[tnr]/g, ' ').length;
const collapseBlanks = text => text.replace(BLANK_RUN, run => `␠×${blankLength(run)}`);
const mostlyBlank = text => text.length > 100 && (text.match(BLANK_ANY) || []).length > text.length / 2;
const GROUP_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Workbench containers that extensions only add views to (no `workbench.view.extension.<key>` command), and this
// extension's own containers: they are not worth listing as "not grouped".
const WORKBENCH_CONTAINERS = new Set(['explorer', 'debug', 'scm', 'test', 'remote', 'timeline', 'outline', 'groupedTools']);
const hiddenContainer = key => WORKBENCH_CONTAINERS.has(key) || key.startsWith('groupedTools.pin.');

function listViewExtensions() {
  return vscode.extensions.all.flatMap(extension => {
    const manifest = extension.packageJSON;
    return Object.entries(manifest.contributes?.views || {}).filter(([container]) => !hiddenContainer(container)).map(([container, views]) => ({
      name: manifest.displayName || manifest.name, extensionId: extension.id, container,
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
    favorite: favorites.has(favoriteKey(item)) || favorites.has(favoriteHash(item)),
    kind: container !== null || item.extensionId ? 'extension' : 'command',
    ...(extensionId ? { extensionId } : {}),
    installed: container !== null ? containers.has(container) : null,
    ...(item.args ? { args: item.args } : {})
  };
}

class ToolsView {
  constructor(context, commandApi) { this.context = context; this.commandApi = commandApi; this.seq = 0; this.pending = null; this.iconCache = new Map(); this.navigating = false; this.navigationMs = NAVIGATION_MS; this.graceMs = NAVIGATION_GRACE_MS; }

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
    // Showing the panel without a navigation (the main Activity Bar icon) restores the fold state that a pin click changed.
    const visibility = view.onDidChangeVisibility(() => { if (view.visible && !this.navigating) this.navigate({ type: 'restoreFold' }); });
    view.onDidDispose(() => { disposed = true; subscription.dispose(); visibility.dispose(); if (this.view === view) this.view = undefined; });
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
      .replace('{{svg}}', uri('svg-safe.js')).replace('{{model}}', uri('model.js')).replace('{{sync}}', uri('sync.js')).replace('{{js}}', uri('view.js'));
  }

  isTrusted() { return vscode.workspace.isTrusted !== false; }

  // Scope state of the panel. The active scope is the one the webview chose; by default it is the
  // effective one (project when it has its own configuration, otherwise global). In an untrusted
  // workspace only the Global value is read and written (groupedTools.groups is a restricted setting).
  scopeState(inspected) {
    const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length);
    const trusted = this.isTrusted();
    const projectOverride = trusted && inspected.workspaceValue !== undefined;
    let active = this.scope;
    if (!hasWorkspace || !trusted) active = 'global';
    else if (!SCOPES.includes(active)) active = projectOverride ? 'workspace' : 'global';
    return { active, hasWorkspace, trusted, projectOverride };
  }

  inspectGroups() { return vscode.workspace.getConfiguration('groupedTools').inspect('groups') || {}; }

  rawGroups(inspected, scope) {
    if (scope.active === 'workspace') return inspected.workspaceValue ?? inspected.globalValue ?? inspected.defaultValue ?? [];
    return inspected.globalValue ?? inspected.defaultValue ?? [];
  }

  // Groups of the scope shown in the panel; every id sent by the webview is resolved against them.
  currentGroups() {
    const inspected = this.inspectGroups();
    const scope = this.scopeState(inspected);
    return readGroups(this.rawGroups(inspected, scope), { pins: scope.active === 'global' });
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
      if (message.scope === 'workspace' && !this.isTrusted()) throw new Error('Esta pasta não é confiável. Confie na pasta para salvar a organização do projeto.');
      const inspected = this.inspectGroups();
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
      if (this.pending && this.pending.message.seq === message.seq) {
        this.pending = null;
        if (this.navigating) this.markNavigating(this.graceMs); // delivered: only a short grace for the visibility event
      }
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
    if (message.type === 'run' && await this.approve(item)) await runItem(this.commandApi, item);
    if (message.type === 'favorite') {
      const favorites = new Set(this.context.workspaceState.get('favorites', []));
      const old = favoriteKey(item), key = favoriteHash(item); // legacy plain keys are still read and are migrated on toggle
      if (favorites.has(key) || favorites.has(old)) { favorites.delete(key); favorites.delete(old); } else favorites.add(key);
      await this.context.workspaceState.update('favorites', [...favorites].slice(-MAX_FAVORITES));
      this.refresh();
    }
  }

  // Items of the project configuration come from files a repository can ship: unless they are a plain
  // view/action command, the user confirms the exact command once per item (remembered in workspaceState).
  needsApproval(item) {
    if (this.scopeState(this.inspectGroups()).active !== 'workspace') return false;
    return !(isSafeProjectCommand(item.command) &&!(Array.isArray(item.args) && item.args.length));
  }

  async approve(item) {
    if (!this.needsApproval(item)) return true;
    const key = favoriteHash(item);
    const approved = this.context.workspaceState.get('approvedItems', []);
    if (approved.includes(key)) return true;
    const hasArgs = Array.isArray(item.args) && item.args.length > 0;
    const rawArgs = hasArgs ? visible(JSON.stringify(item.args)) : '';
    const fullArgs = collapseBlanks(rawArgs);
    const truncated = fullArgs.length > ARGS_PREVIEW || mostlyBlank(rawArgs);
    const args = !hasArgs ? 'nenhum' : truncated ? `${fullArgs.slice(0, ARGS_PREVIEW)} … (truncado, ${rawArgs.length} caracteres no total)` : fullArgs;
    const remember = 'Executar e lembrar', once = 'Executar uma vez';
    const rule = truncated ? 'Os argumentos são longos demais para revisar: só dá para executar uma vez. ' : '';
    const answer = await vscode.window.showWarningMessage('A configuração deste projeto quer executar um comando.',
      { modal: true, detail: `Comando: ${visible(item.command)}\nArgumentos: ${args}\nNome do item: “${visible(item.name)}”\n\n${rule}Só execute se você confia nesta pasta.` },
      ...(truncated ? [once] : [remember, once]));
    if (answer === once) return true;
    if (answer !== remember || truncated) return false;
    await this.context.workspaceState.update('approvedItems', [key, ...approved].slice(0, MAX_APPROVED));
    return true;
  }

  // Activation: drop approvals that are not hashes, cap favorites, and convert legacy plain favorites to hashes
  // when the item still exists in the current configuration (global or project); other legacy keys are dropped.
  async migrateState() {
    const state = this.context.workspaceState;
    const inspected = this.inspectGroups();
    const items = [inspected.globalValue ?? inspected.defaultValue, inspected.workspaceValue, inspected.workspaceFolderValue]
      .flatMap(raw => readGroups(raw ?? []).flatMap(g => g.items));
    const byPlain = new Map(items.map(i => [favoriteKey(i), favoriteHash(i)]));
    const keep = [];
    for (const key of state.get('favorites', [])) {
      if (typeof key !== 'string') continue;
      const hashed = key.startsWith('h:') ? key : byPlain.get(key);
      if (hashed && !keep.includes(hashed)) keep.push(hashed);
    }
    const favorites = keep.slice(-MAX_FAVORITES); // the newest are kept
    const approved = state.get('approvedItems', []).filter(k => typeof k === 'string' && k.startsWith('h:')).slice(0, MAX_APPROVED);
    if (JSON.stringify(favorites) !== JSON.stringify(state.get('favorites', []))) await state.update('favorites', favorites);
    if (JSON.stringify(approved) !== JSON.stringify(state.get('approvedItems', []))) await state.update('approvedItems', approved);
  }

  markNavigating(ms = this.navigationMs) {
    this.navigating = true;
    clearTimeout(this.navigatingTimer);
    this.navigatingTimer = setTimeout(() => { this.navigating = false; }, ms);
    if (this.navigatingTimer.unref) this.navigatingTimer.unref();
  }

  // Navigation messages (focusGroup, openEditor, restoreFold) survive a webview that does not exist yet or is
  // reloading: they are kept until the webview acknowledges them, and resent after its next `ready`.
  navigate(message) {
    // A restoreFold never replaces a navigation that is still waiting for its ack.
    if (message.type === 'restoreFold' && this.pending && this.pending.message.type !== 'restoreFold' && Date.now() - this.pending.at <= PENDING_MS) return null;
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
    this.markNavigating();
    this.navigate({ type: 'focusGroup', collapseOthers: true, ...(groupId ? { groupId } : {}), ...(organize ? { organize: true } : {}), ...(missing ? { missing: true } : {}) });
    await vscode.commands.executeCommand('groupedTools.view.focus');
  }

  // Click on a pin container: the pinned Global group of that icon, or the "missing" notice when none.
  async openPinned(icon) {
    const group = pinnedGroups(this.globalGroups()).find(g => catalog.pinIcon(g.icon) === icon);
    await this.openGroup(group ? group.id : undefined, group ? {} : { missing: true });
  }

  async openEditor() {
    this.markNavigating();
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

  // Original icon of an extension container, cached per extension version; `icons` collects what the message references.
  iconRef(extensionId, container, icons, byId) {
    const extension = extensionId && byId.get(extensionId);
    if (!extension) return undefined;
    const key = `${extensionId}@${extension.packageJSON?.version || ''}/${container || ''}`;
    if (!this.iconCache.has(key)) {
      if (this.iconCache.size > 500) this.iconCache.clear();
      this.iconCache.set(key, resolveIcon(extension, container));
    }
    const image = this.iconCache.get(key);
    if (!image) return undefined;
    icons[key] = image;
    return key;
  }

  refresh() {
    if (!this.view) return;
    const favorites = new Set(this.context.workspaceState.get('favorites', []));
    const inspected = this.inspectGroups();
    const scope = this.scopeState(inspected);
    const containers = containerIndex();
    const icons = {}, byId = new Map(vscode.extensions.all.map(e => [e.id, e]));
    const report = { dropped: 0 };
    const groups = readGroups(this.rawGroups(inspected, scope), { pins: scope.active === 'global', report }).map(g => ({
      id: g.id, name: g.name, icon: g.icon, color: g.color, ...(g.pinned ? { pinned: true } : {}),
      items: g.items.map(i => {
        const d = describeItem(i, favorites, containers);
        const iconKey = d.kind === 'extension' ? this.iconRef(d.extensionId, extensionContainer(d.command) ?? undefined, icons, byId) : undefined;
        return iconKey ? { ...d, iconKey } : d;
      })
    }));
    const assigned = new Map();
    for (const g of groups) for (const i of g.items) if (!assigned.has(i.command)) assigned.set(i.command, g);
    const all = listViewExtensions().map(e => ({ ...e, ...(this.iconRef(e.extensionId, e.container, icons, byId) ? { iconKey: this.iconRef(e.extensionId, e.container, icons, byId) } : {}), ...(assigned.has(e.command) ? { groupId: assigned.get(e.command).id, groupName: assigned.get(e.command).name } : {}) }));
    const unassigned = all.filter(e => !assigned.has(e.command)).map(({ extensionId, name, command, icon, views, container, iconKey }) => ({ extensionId, name, command, icon, views, container, ...(iconKey ? { iconKey } : {}) }));
    const flat = groups.flatMap(g => g.items);
    const pins = pinnedGroups(this.globalGroups()).map(g => ({ groupId: g.id, icon: catalog.pinIcon(g.icon), name: g.name }));
    this.view.webview.postMessage({
      type: 'data', groups, scope, workspace: vscode.workspace.name || 'Pessoal', hasWorkspace: scope.hasWorkspace,
      extensions: all, unassigned, pins, icons,
      stats: { invalid: report.dropped, items: flat.length, groups: groups.length, unassigned: unassigned.length, broken: flat.filter(i => i.installed === false).length }
    });
  }
}

module.exports = { ToolsView, listViewExtensions };
