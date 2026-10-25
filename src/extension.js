'use strict';
const vscode = require('vscode');
const { ToolsView } = require('./tools-view');
const { runItem, createCommandApi } = require('./commands');

function activate(context) {
  const commandApi = createCommandApi(vscode);
  const provider = new ToolsView(context, commandApi);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('groupedTools.view', provider),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('groupedTools.groups')) provider.refresh(); }),
    vscode.extensions.onDidChange(() => provider.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()),
    vscode.commands.registerCommand('groupedTools.run', item => runItem(commandApi, item)),
    vscode.commands.registerCommand('groupedTools.configure', async () => {
      await vscode.commands.executeCommand('groupedTools.view.focus');
      provider.view?.webview.postMessage({type:'openEditor'});
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
