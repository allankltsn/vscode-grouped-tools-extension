'use strict';
const { RECURSIVE_COMMAND } = require('./config');

// `api` supplies { executeCommand, showErrorMessage } so this module stays vscode-free.
// Callers must pass items resolved from configuration, never a raw webview payload.
async function runItem(api, item) {
  if (!item || typeof item.command !== 'string' || item.command === RECURSIVE_COMMAND) return;
  try {
    // Execute directly: commands contributed by an inactive extension may activate it.
    await api.executeCommand(item.command, ...(Array.isArray(item.args) ? item.args : []));
  } catch (error) {
    api.showErrorMessage(`Não foi possível abrir ${item.name}: ${error.message || error}. Confira o ID do comando e a extensão necessária.`);
  }
}

// Adapts the vscode module to the minimal API runItem needs.
function createCommandApi(vscode) {
  return {
    executeCommand: (...args) => vscode.commands.executeCommand(...args),
    showErrorMessage: message => vscode.window.showErrorMessage(message)
  };
}

module.exports = { runItem, createCommandApi };
