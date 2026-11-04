'use strict';
const vscode = require('vscode');
const { ToolsView } = require('./tools-view');
const { PinManager, PinRedirect } = require('./pins');
const { createCommandApi } = require('./commands');
const catalog = require('../media/pin-catalog');

// The VS Code API cannot choose where a view container lands in the Activity Bar (new ones go to the end), so the
// first activation opens the panel once and says where it is.
async function welcome(context) {
  const state = context.globalState;
  if (!state || state.get('welcomed')) return;
  await state.update('welcomed', true); // before anything else: at most once, even if the next steps fail
  await vscode.commands.executeCommand('workbench.view.extension.groupedTools');
  vscode.window.showInformationMessage('group tools está na barra de atividades. Arraste o ícone para onde quiser.', 'Entendi');
}

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
    vscode.workspace.onDidGrantWorkspaceTrust(update),
    vscode.commands.registerCommand('groupedTools.configure', () => provider.openEditor()),
    vscode.commands.registerCommand('groupedTools.openGroup', groupId => provider.openGroup(groupId)),
    vscode.commands.registerCommand('groupedTools.manageGroup', groupId => provider.openGroup(groupId)),
    vscode.commands.registerCommand('groupedTools.runById', (groupId, itemId) => provider.runPinnedItem(groupId, itemId)),
    vscode.commands.registerCommand('groupedTools.toggleFold', () => provider.toggleFold()),
    { dispose: () => pins.dispose() }
  );
  pins.update();
  provider.migrateState().catch(() => {});
  welcome(context).catch(() => {});
}

function deactivate() {}

module.exports = { activate, deactivate };
