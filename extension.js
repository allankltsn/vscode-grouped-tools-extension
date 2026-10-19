const vscode = require('vscode');
const fs = require('fs');
const crypto = require('crypto');

function readGroups() {
  const config = vscode.workspace.getConfiguration('groupedTools');
  const groups = config.get('groups', []);
  if (!Array.isArray(groups)) return [];
  return groups.filter(g => g && typeof g.name === 'string' && Array.isArray(g.items))
    .map((group, gi) => ({ name: group.name, icon: group.icon || 'extensions', id: `g${gi}`, items: group.items
      .filter(i => i && typeof i.name === 'string' && typeof i.command === 'string' && i.command !== 'groupedTools.run')
      .map((item, ii) => ({ ...item, id: `${gi}:${ii}` })) }));
}
function favoriteKey(item) { return JSON.stringify([item.command, item.name, item.args || []]); }

class ToolsView {
  constructor(context) { this.context = context; }
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    const nonce = crypto.randomBytes(16).toString('hex');
    const uri = file => view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', file));
    view.webview.html = fs.readFileSync(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.html').fsPath, 'utf8')
      .replaceAll('{{nonce}}', nonce).replaceAll('{{csp}}', view.webview.cspSource)
      .replace('{{css}}', String(uri('view.css'))).replace('{{icons}}', String(uri('icons.js'))).replace('{{js}}', String(uri('view.js')));
    const subscription = view.webview.onDidReceiveMessage(async message => {
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
      const item = readGroups().flatMap(g => g.items).find(i => i.id === message.id);
      if (!item) return;
      if (message.type === 'run') await runItem(item);
      if (message.type === 'favorite') {
        const favorites = new Set(this.context.workspaceState.get('favorites', []));
        const key = favoriteKey(item);
        if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
        await this.context.workspaceState.update('favorites', [...favorites]);
        this.refresh();
      }
    });
    view.onDidDispose(() => { subscription.dispose(); if (this.view === view) this.view = undefined; });
  }
  refresh() {
    if (!this.view) return;
    const favorites = new Set(this.context.workspaceState.get('favorites', []));
    const groups = readGroups().map(g => ({ ...g, items: g.items.map(i => ({
      id: i.id, name: i.name, command: i.command, icon: i.icon || 'extensions', favorite: favorites.has(favoriteKey(i))
    })) }));
    const config = vscode.workspace.getConfiguration('groupedTools');
    const inspected = config.inspect('groups') || {};
    const extensions = vscode.extensions.all.flatMap(extension => {
      const manifest = extension.packageJSON;
      return Object.entries(manifest.contributes?.views || {}).map(([container, views]) => ({
        name: manifest.displayName || manifest.name, extensionId: extension.id,
        command: `workbench.view.extension.${container}`,
        icon: 'extensions', views: views.map(v => v.name).join(', ')
      }));
    }).sort((a,b) => a.name.localeCompare(b.name));
    this.view.webview.postMessage({ type: 'data', groups, workspace: vscode.workspace.name || 'Pessoal',
      hasWorkspace: Boolean(vscode.workspace.workspaceFolders?.length), extensions,
      globalGroups: inspected.globalValue ?? inspected.defaultValue ?? [],
      workspaceGroups: inspected.workspaceValue ?? inspected.globalValue ?? inspected.defaultValue ?? [],
      projectOverride: inspected.workspaceValue !== undefined || inspected.workspaceFolderValue !== undefined,
      folderOverride: inspected.workspaceFolderValue !== undefined });
  }
}
function validateGroups(groups) {
  if (!Array.isArray(groups) || groups.length > 100) throw new Error('Lista de grupos inválida.');
  for (const group of groups) {
    if (!group || typeof group.name !== 'string' || !group.name.trim() || !Array.isArray(group.items)) throw new Error('Informe o nome e as ferramentas de cada grupo.');
    if (group.icon !== undefined && typeof group.icon !== 'string') throw new Error('Ícone inválido.');
    for (const item of group.items) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.command !== 'string' || !item.command.trim() || item.command === 'groupedTools.run') throw new Error('Informe nome e comando válidos para cada ferramenta.');
      if (item.icon !== undefined && typeof item.icon !== 'string') throw new Error('Ícone inválido.');
      if (item.args !== undefined && !Array.isArray(item.args)) throw new Error('Argumentos devem ser uma lista.');
    }
  }
  return groups.map(g => ({name:g.name.trim(), icon:g.icon || 'extensions', items:g.items.map(i => ({name:i.name.trim(),command:i.command.trim(),icon:i.icon || 'extensions', ...(i.args ? {args:i.args} : {})}))}));
}
async function runItem(item) {
  if (!item || typeof item.command !== 'string' || item.command === 'groupedTools.run') return;
  try {
    // Execute directly: commands contributed by an inactive extension may activate it.
    await vscode.commands.executeCommand(item.command, ...(Array.isArray(item.args) ? item.args : []));
  } catch (error) {
    vscode.window.showErrorMessage(`Não foi possível abrir ${item.name}: ${error.message || error}. Confira o ID do comando e a extensão necessária.`);
  }
}
function activate(context) {
  const provider = new ToolsView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('groupedTools.view', provider),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('groupedTools.groups')) provider.refresh(); }),
    vscode.window.onDidChangeActiveTextEditor(() => provider.refresh()),
    vscode.commands.registerCommand('groupedTools.run', runItem),
    vscode.commands.registerCommand('groupedTools.configure', async () => {
      await vscode.commands.executeCommand('groupedTools.view.focus');
      provider.view?.webview.postMessage({type:'openEditor'});
    })
  );
}
module.exports = { activate };
