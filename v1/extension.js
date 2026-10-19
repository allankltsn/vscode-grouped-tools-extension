const vscode = require('vscode');

class GroupsProvider {
  constructor() {
    this.changed = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.changed.event;
  }
  refresh() { this.changed.fire(undefined); }
  getTreeItem(node) { return node; }
  getChildren(parent) {
    if (parent) return parent.children || [];
    const groups = vscode.workspace.getConfiguration('groupedTools').get('groups', []);
    if (!Array.isArray(groups)) return [];
    return groups.filter(g => g && typeof g.name === 'string' && Array.isArray(g.items))
      .map((group, index) => {
        const node = new vscode.TreeItem(group.name, vscode.TreeItemCollapsibleState.Collapsed);
        node.id = `group-${index}-${group.name}`;
        node.iconPath = new vscode.ThemeIcon(group.icon || 'folder');
        node.children = group.items.filter(i => i && typeof i.name === 'string' && typeof i.command === 'string')
          .map(item => {
            const child = new vscode.TreeItem(item.name, vscode.TreeItemCollapsibleState.None);
            child.iconPath = new vscode.ThemeIcon(item.icon || 'extensions');
            child.tooltip = item.command;
            child.command = { command: 'groupedTools.run', title: item.name, arguments: [item] };
            return child;
          });
        node.description = String(node.children.length);
        return node;
      });
  }
  dispose() { this.changed.dispose(); }
}

function activate(context) {
  const provider = new GroupsProvider();
  context.subscriptions.push(
    provider,
    vscode.window.registerTreeDataProvider('groupedTools.view', provider),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('groupedTools.groups')) provider.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => provider.refresh()),
    vscode.commands.registerCommand('groupedTools.configure', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'groupedTools.groups')),
    vscode.commands.registerCommand('groupedTools.run', async item => {
      if (!item || typeof item.command !== 'string' || item.command === 'groupedTools.run') return;
      const commands = await vscode.commands.getCommands(true);
      if (!commands.includes(item.command)) {
        vscode.window.showWarningMessage(`Comando indisponível: ${item.command}. Confira o ID e a extensão necessária.`);
        return;
      }
      try {
        await vscode.commands.executeCommand(item.command, ...(Array.isArray(item.args) ? item.args : []));
      } catch (error) {
        vscode.window.showErrorMessage(`Não foi possível abrir ${item.name}: ${error.message || error}`);
      }
    })
  );
}
module.exports = { activate };
