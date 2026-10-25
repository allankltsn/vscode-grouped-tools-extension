'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const { readGroups, validateGroups, favoriteKey } = require('./config');
const { runItem } = require('./commands');

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

class ToolsView {
  constructor(context, commandApi) { this.context = context; this.commandApi = commandApi; }

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
      if (!disposed) vscode.window.showErrorMessage(`Não foi possível carregar o painel de ferramentas: ${error.message || error}`);
      return;
    }
    if (disposed) return;
    const nonce = crypto.randomBytes(16).toString('hex');
    const uri = file => view.webview.asWebviewUri(this.mediaUri(file));
    view.webview.html = template
      .replaceAll('{{nonce}}', nonce).replaceAll('{{csp}}', view.webview.cspSource)
      .replace('{{css}}', String(uri('view.css'))).replace('{{icons}}', String(uri('icons.js'))).replace('{{js}}', String(uri('view.js')));
  }

  currentGroups() {
    return readGroups(vscode.workspace.getConfiguration('groupedTools').get('groups', []));
  }

  async handleMessage(view, message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'ready') { this.refresh(); return; }
    if (message.type === 'configure') { await vscode.commands.executeCommand('workbench.action.openSettings', 'groupedTools.groups'); return; }
    if (message.type === 'saveGroups' || message.type === 'resetGroups') {
      try {
        if (!['global', 'workspace'].includes(message.scope)) throw new Error('Escopo inválido.');
        if (message.scope === 'workspace' && !vscode.workspace.workspaceFolders?.length) throw new Error('Abra um projeto para salvar nele.');
        const target = message.scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
        const value = message.type === 'resetGroups' ? undefined : validateGroups(message.groups);
        await vscode.workspace.getConfiguration('groupedTools').update('groups', value, target);
        this.refresh();
        view.webview.postMessage({type:'saved', text: message.type === 'resetGroups' ? 'Configuração restaurada.' : 'Grupos salvos.'});
      } catch (error) { view.webview.postMessage({type:'saveError', text:error.message || String(error)}); }
      return;
    }
    // Whitelist: only items resolved from configuration by id are ever executed.
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

  refresh() {
    if (!this.view) return;
    const favorites = new Set(this.context.workspaceState.get('favorites', []));
    const groups = this.currentGroups().map(g => ({ ...g, items: g.items.map(i => ({
      id: i.id, name: i.name, command: i.command, icon: i.icon || 'extensions', favorite: favorites.has(favoriteKey(i))
    })) }));
    const inspected = vscode.workspace.getConfiguration('groupedTools').inspect('groups') || {};
    this.view.webview.postMessage({ type: 'data', groups, workspace: vscode.workspace.name || 'Pessoal',
      hasWorkspace: Boolean(vscode.workspace.workspaceFolders?.length), extensions: listViewExtensions(),
      globalGroups: inspected.globalValue ?? inspected.defaultValue ?? [],
      workspaceGroups: inspected.workspaceValue ?? inspected.globalValue ?? inspected.defaultValue ?? [],
      projectOverride: inspected.workspaceValue !== undefined || inspected.workspaceFolderValue !== undefined,
      folderOverride: inspected.workspaceFolderValue !== undefined });
  }
}

module.exports = { ToolsView, listViewExtensions };
