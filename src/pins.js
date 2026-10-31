'use strict';
// Pinned groups: context keys that reveal the static Activity Bar containers, one status bar item per
// pinned group (with a native Markdown hover) and the redirect view hosted by each pin container.
// Everything that does not need the vscode module is exported separately and unit-tested.
const catalog = require('../media/pin-catalog');
const { cleanText } = require('./config');

const MAX_ROWS = 15;
const MAX_STATUS_NAME = 30;
// Commands the hover may run. Their arguments are plain strings resolved against the configuration.
const TRUSTED_COMMANDS = ['groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup'];
// Raster icons only: an SVG may not render inside a hover, so it falls back to a codicon.
const IMAGE_ICON = /\.(png|jpe?g|webp)$/i;
const MAX_HOVER_NAME = 100;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Escapes text for Markdown (and for `$(icon)` syntax) so a group or item name can never become a link.
function escapeMarkdown(text) {
  return cleanText(String(text).slice(0, MAX_HOVER_NAME * 2)).slice(0, MAX_HOVER_NAME).replace(/[\\`*_{}[\]()#+\-.!|<>~$&:]/g, '\\$&');
}

function commandUri(command, args) { return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`; }

function statusName(name) {
  const clean = cleanText(String(name).slice(0, MAX_STATUS_NAME * 4)).replace(/\$\(/g, '$ (');
  return clean.length > MAX_STATUS_NAME ? `${clean.slice(0, MAX_STATUS_NAME - 1)}…` : clean;
}
function statusText(group, count) { return `$(${catalog.pinCodicon(group.icon)}) ${statusName(group.name)} (${count})`; }

// Markdown source of the hover card. `iconOf(item)` returns an image URI string or null.
function tooltipSource(group, items, iconOf = () => null) {
  const open = commandUri('groupedTools.openGroup', [group.id]);
  const lines = [`**${escapeMarkdown(group.name)}** · ${plural(items.length, 'extensão', 'extensões')}`, ''];
  if (!items.length) lines.push('Grupo vazio.', '');
  else {
    lines.push('| | |', '|:-:|---|');
    for (const item of items.slice(0, MAX_ROWS)) {
      const uri = iconOf(item);
      const icon = uri ? `![|width=16,height=16](${uri.replace(/[()\s]/g, c => encodeURIComponent(c))})` : (item.kind === 'command' ? '$(terminal)' : '$(extensions)');
      const name = escapeMarkdown(item.name);
      const cell = item.installed === false
        ? `${name} *\\(não instalado\\)*`
        : `[${name}](${commandUri('groupedTools.runById', [group.id, item.id])} "Abrir ${cleanText(item.name).slice(0, MAX_HOVER_NAME).replace(/[^\p{L}\p{N} ._-]/gu, '')}")`;
      lines.push(`| ${icon} | ${cell} |`);
    }
    lines.push('');
    if (items.length > MAX_ROWS) lines.push(`+${items.length - MAX_ROWS} ${items.length - MAX_ROWS === 1 ? 'extensão' : 'extensões'} · [Ver todas](${open})`, '');
  }
  lines.push('---', '', `[Abrir no Ferramentas](${open}) | [Gerenciar grupo](${commandUri('groupedTools.manageGroup', [group.id])})`);
  return lines.join('\n');
}

function extensionImage(vscode, extensionId) {
  const extension = extensionId && vscode.extensions.getExtension ? vscode.extensions.getExtension(extensionId) : undefined;
  const relative = extension && extension.packageJSON && extension.packageJSON.icon;
  if (typeof relative !== 'string' || !IMAGE_ICON.test(relative) || relative.split(/[\\/]/).includes('..')) return null;
  try { return String(vscode.Uri.joinPath(extension.extensionUri, relative)); } catch { return null; }
}

function tooltip(vscode, group, items) {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = { enabledCommands: TRUSTED_COMMANDS.slice() };
  md.supportHtml = false;
  md.appendMarkdown(tooltipSource(group, items, item => (item.kind === 'extension' ? extensionImage(vscode, item.extensionId) : null)));
  return md;
}

class PinManager {
  // `state()` returns the pinned Global groups with described items: [{ ...group, items: [{...item, installed, kind}] }].
  constructor(vscode, state) {
    this.vscode = vscode; this.state = state;
    this.active = new Set(); this.items = new Map();
  }

  // Idempotent: reconciles context keys and status bar items with the current configuration.
  update() {
    const vscode = this.vscode, groups = this.state();
    const keys = new Set(groups.map(g => catalog.contextKey(catalog.pinIcon(g.icon))));
    for (const key of keys) if (!this.active.has(key)) vscode.commands.executeCommand('setContext', key, true);
    for (const key of this.active) if (!keys.has(key)) vscode.commands.executeCommand('setContext', key, false);
    this.active = keys;
    const seen = new Set();
    groups.forEach((group, index) => {
      seen.add(group.id);
      let item = this.items.get(group.id);
      if (!item) {
        item = vscode.window.createStatusBarItem(`groupedTools.status.${group.id}`, vscode.StatusBarAlignment.Left, 90 - index);
        this.items.set(group.id, item);
      }
      item.name = `Ferramentas: ${group.name}`;
      item.text = statusText(group, group.items.length);
      item.tooltip = tooltip(vscode, group, group.items);
      item.command = { command: 'groupedTools.openGroup', title: 'Abrir grupo no Ferramentas', arguments: [group.id] };
      item.accessibilityInformation = { label: `${group.name}, ${plural(group.items.length, 'extensão', 'extensões')}. Abre o grupo no painel Ferramentas.`, role: 'button' };
      item.show();
    });
    for (const [id, item] of this.items) if (!seen.has(id)) { item.dispose(); this.items.delete(id); }
  }

  dispose() {
    for (const item of this.items.values()) item.dispose();
    this.items.clear();
    for (const key of this.active) this.vscode.commands.executeCommand('setContext', key, false);
    this.active.clear();
  }
}

// View hosted by a pin container: opens the main panel on the pinned group as soon as it becomes visible.
class PinRedirect {
  constructor(vscode, icon, open) { this.vscode = vscode; this.icon = icon; this.open = open; this.busy = false; }

  async resolveWebviewView(view) {
    view.webview.options = { enableScripts: false };
    view.webview.html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';"><title>Ferramentas</title></head><body><p>Abrindo o grupo no painel Ferramentas…</p></body></html>';
    const go = () => {
      if (this.busy || !view.visible) return;
      this.busy = true;
      Promise.resolve(this.open(this.icon)).catch(() => {}).finally(() => { setTimeout(() => { this.busy = false; }, 300); });
    };
    const subscription = view.onDidChangeVisibility(go);
    view.onDidDispose(() => { if (subscription && subscription.dispose) subscription.dispose(); });
    go();
  }
}

module.exports = { PinManager, PinRedirect, tooltip, tooltipSource, statusText, escapeMarkdown, commandUri, MAX_ROWS, TRUSTED_COMMANDS };
