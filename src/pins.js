'use strict';
// Pinned groups: context keys that reveal the static Activity Bar containers, one status bar item per
// pinned group (with a native Markdown hover) and the redirect view hosted by each pin container.
// Everything that does not need the vscode module is exported separately and unit-tested.
const catalog = require('../media/pin-catalog');
const { cleanText } = require('./config');

const MAX_ROWS = 15;
// Commands the hover may run. Their arguments are plain strings resolved against the configuration.
const TRUSTED_COMMANDS = ['groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup'];
const MAX_HOVER_NAME = 100;

// Fallback names when a name has nothing visible left after cleaning (empty, blanks, zero-width, bidi, control).
const FALLBACK_GROUP = 'Novo grupo', FALLBACK_ITEM = 'Extensão sem nome';
const visibleName = (name, fallback) => cleanText(String(name == null ? '' : name).slice(0, MAX_HOVER_NAME * 2)).slice(0, MAX_HOVER_NAME) || fallback;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Escapes text for Markdown (and for `$(icon)` syntax) so a group or item name can never become a link.
function escapeMarkdown(text) {
  return cleanText(String(text).slice(0, MAX_HOVER_NAME * 2)).slice(0, MAX_HOVER_NAME).replace(/[\\`*_{}[\]()#+\-.!|<>~$&:]/g, '\\$&');
}

function commandUri(command, args) { return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`; }

// Plain, one-line name for labels (control, zero-width and bidi characters removed, capped).
const plainName = name => visibleName(name, FALLBACK_GROUP);
// Status bar shows only the group icon and the item count; the name lives in the hover and in the accessible label.
function statusText(group, count) { return `$(${catalog.pinCodicon(group.icon)}) ${count}`; }

// Markdown source of the hover card. Rows use codicons only: an image from a local path (file://) does not render in a hover,
// and a `|` inside `![alt|width=..]` would split the table cell. Each installed item is a link that opens it.
function tooltipSource(group, items) {
  const open = commandUri('groupedTools.openGroup', [group.id]);
  const lines = [`**${escapeMarkdown(visibleName(group.name, FALLBACK_GROUP))}** · ${plural(items.length, 'extensão', 'extensões')}`, ''];
  if (!items.length) lines.push('Grupo vazio.', '');
  else {
    lines.push('| | |', '|:-:|---|');
    for (const item of items.slice(0, MAX_ROWS)) {
      const icon = item.kind === 'command' ? '$(terminal)' : '$(extensions)';
      const shown = visibleName(item.name, FALLBACK_ITEM), name = escapeMarkdown(shown);
      const cell = item.installed === false
        ? `${name} *\\(não instalado\\)*`
        : `[${name}](${commandUri('groupedTools.runById', [group.id, item.id])} "Abrir ${shown.replace(/[^\p{L}\p{N} ._-]/gu, '')}")`;
      lines.push(`| ${icon} | ${cell} |`);
    }
    lines.push('');
    if (items.length > MAX_ROWS) lines.push(`+${items.length - MAX_ROWS} ${items.length - MAX_ROWS === 1 ? 'extensão' : 'extensões'} · [Ver todas](${open})`, '');
  }
  lines.push('---', '', `[Abrir no group tools](${open}) | [Gerenciar grupo](${commandUri('groupedTools.manageGroup', [group.id])})`);
  return lines.join('\n');
}

function tooltip(vscode, group, items) {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = { enabledCommands: TRUSTED_COMMANDS.slice() };
  md.supportHtml = false;
  md.appendMarkdown(tooltipSource(group, items));
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
      item.name = `group tools: ${plainName(group.name)}`;
      item.text = statusText(group, group.items.length);
      item.tooltip = tooltip(vscode, group, group.items);
      item.command = { command: 'groupedTools.openGroup', title: 'Abrir grupo no group tools', arguments: [group.id] };
      item.accessibilityInformation = { label: `${plainName(group.name)}, ${plural(group.items.length, 'extensão', 'extensões')}. Abre o grupo no painel group tools.`, role: 'button' };
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
    view.webview.html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';"><title>group tools</title></head><body><p>Abrindo o grupo no painel group tools…</p></body></html>';
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

module.exports = { plainName, PinManager, PinRedirect, tooltip, tooltipSource, statusText, escapeMarkdown, commandUri, MAX_ROWS, TRUSTED_COMMANDS };
