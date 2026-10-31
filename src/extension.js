'use strict';
const vscode = require('vscode');
const { ToolsView } = require('./tools-view');
const { PinManager, PinRedirect } = require('./pins');
const { runItem, createCommandApi } = require('./commands');
const catalog = require('../media/pin-catalog');

function activate(context) {
  const commandApi = createCommandApi(vscode);
  const provider = new ToolsView(context, commandApi);
  const pins = new PinManager(vscode, () => provider.pinnedState());
  const update = () => { provider.refresh(); pins.update(); };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('groupedTools.view', provider),
    // One static container per pinnable icon; each hosts a view that redirects to the main panel.
    ...catalog.PIN_ICONS.map(icon => vscode.window.registerWebviewViewProvider(catalog.viewId(icon), new PinRedirect(vscode, icon, i => provider.openPinned(i)))),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('groupedTools.groups')) update(); }),
    vscode.extensions.onDidChange(update),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
    vscode.commands.registerCommand('groupedTools.run', item => runItem(commandApi, item)),
    vscode.commands.registerCommand('groupedTools.configure', () => provider.openEditor()),
    vscode.commands.registerCommand('groupedTools.openGroup', groupId => provider.openGroup(groupId)),
    vscode.commands.registerCommand('groupedTools.manageGroup', groupId => provider.openGroup(groupId, { organize: true })),
    vscode.commands.registerCommand('groupedTools.runById', (groupId, itemId) => provider.runPinnedItem(groupId, itemId)),
    vscode.commands.registerCommand('groupedTools.toggleFold', () => provider.toggleFold()),
    { dispose: () => pins.dispose() }
  );
  pins.update();
}

function deactivate() {}

module.exports = { activate, deactivate };
