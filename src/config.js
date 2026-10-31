'use strict';
// Pure configuration helpers: no dependency on the vscode module.
const { pinIcon } = require('../media/pin-catalog');

const MAX_GROUPS = 100;
const MAX_NAME = 100;
const MAX_ITEM_NAME = 100;
const MAX_COMMAND = 200;
// Commands of this extension that must never run as an item (recursion, or the hover-only entry points).
const RECURSIVE_COMMAND = 'groupedTools.run';
const BLOCKED_COMMANDS = [RECURSIVE_COMMAND, 'groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup'];
const isBlockedCommand = command => BLOCKED_COMMANDS.includes(String(command).trim());

// Plain one-line text: whitespace collapsed, control, zero-width and bidi override characters removed.
function cleanText(text) {
  return String(text).replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '').trim();
}

// Fixed palette (classes g-1..g-10 in media/view.css). Anything else falls back to neutral (slate).
const COLORS = Array.from({ length: 10 }, (_, i) => `g-${i + 1}`);
const NEUTRAL_COLOR = 'g-10';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EXTENSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CONTAINER_PREFIX = 'workbench.view.extension.';

function favoriteKey(item) { return JSON.stringify([item.command, item.name, item.args || []]); }

function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function uniqueId(base, used) {
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

// Container id of a `workbench.view.extension.<container>` command, or null for any other command.
function extensionContainer(command) {
  return typeof command === 'string' && command.startsWith(CONTAINER_PREFIX) && command.length > CONTAINER_PREFIX.length
    ? command.slice(CONTAINER_PREFIX.length) : null;
}

function validColor(color) { return typeof color === 'string' && COLORS.includes(color); }
function validId(id) { return typeof id === 'string' && ID_PATTERN.test(id); }
function validExtensionId(id) { return typeof id === 'string' && EXTENSION_ID_PATTERN.test(id); }

// Stable ids: a group keeps its persisted `id`; otherwise it is derived from its name. An item id is
// derived from its favoriteKey (command, name, args), so reordering or moving never changes it.
// `pins` enables the pinned flag (Global scope only): it needs a pinnable icon and at most one group
// per icon; anything else is ignored when reading hand-edited settings.
function readGroups(rawGroups, { pins = false } = {}) {
  if (!Array.isArray(rawGroups)) return [];
  // Same rules as validateGroups: at most MAX_GROUPS groups, trimmed non-empty names within the limits.
  const valid = rawGroups.filter(g => g && typeof g.name === 'string' && Array.isArray(g.items) && cleanText(g.name))
    .slice(0, MAX_GROUPS).map(g => ({ ...g, name: cleanText(g.name).slice(0, MAX_NAME) }));
  const groupIds = new Set(), itemIds = new Set(), pinnedIcons = new Set();
  const persisted = valid.map(g => (validId(g.id) && !groupIds.has(g.id) ? (groupIds.add(g.id), g.id) : null));
  return valid.map((group, gi) => {
    const icon = typeof group.icon === 'string' && group.icon ? group.icon : 'extensions';
    const key = pins && group.pinned === true ? pinIcon(icon) : null;
    const pinned = key !== null && !pinnedIcons.has(key);
    if (pinned) pinnedIcons.add(key);
    return {
      id: persisted[gi] ?? uniqueId(`grp-${hash(group.name)}`, groupIds),
      name: group.name,
      icon,
      color: validColor(group.color) ? group.color : NEUTRAL_COLOR,
      ...(pinned ? { pinned: true } : {}),
      items: group.items
        .filter(i => i && typeof i.name === 'string' && typeof i.command === 'string' && cleanText(i.name) && i.command.trim() && i.command.trim().length <= MAX_COMMAND && !isBlockedCommand(i.command))
        .map(raw => ({ ...raw, name: cleanText(raw.name).slice(0, MAX_ITEM_NAME), command: raw.command.trim() }))
        .map(item => ({
          id: uniqueId(`it-${hash(favoriteKey(item))}`, itemIds),
          name: item.name, command: item.command,
          icon: typeof item.icon === 'string' && item.icon ? item.icon : 'extensions',
          ...(Array.isArray(item.args) ? { args: item.args } : {}),
          ...(validExtensionId(item.extensionId) ? { extensionId: item.extensionId } : {})
        }))
    };
  });
}

// Validates a list coming from the webview. `scope` is 'global' (pins allowed) or 'workspace' (pins ignored).
function validateGroups(groups, { scope = 'global' } = {}) {
  if (!Array.isArray(groups)) throw new Error('Lista de grupos inválida.');
  if (groups.length > MAX_GROUPS) throw new Error(`No máximo ${MAX_GROUPS} grupos. Exclua alguns para salvar.`);
  const ids = new Set(), pinnedIcons = new Set();
  for (const [gi, group] of groups.entries()) {
    if (!group || typeof group.name !== 'string' || !cleanText(group.name) || !Array.isArray(group.items)) throw new Error(`O grupo nº ${gi + 1} precisa de um nome. Informe o nome e os atalhos de cada grupo.`);
    const where = `Grupo “${cleanText(group.name).slice(0, 40)}”`;
    if (cleanText(group.name).length > MAX_NAME) throw new Error(`${where}: o nome pode ter até ${MAX_NAME} caracteres.`);
    if (group.icon !== undefined && typeof group.icon !== 'string') throw new Error('Ícone inválido.');
    if (group.color !== undefined && group.color !== null && !validColor(group.color)) throw new Error('Cor inválida.');
    if (group.pinned !== undefined && group.pinned !== null && typeof group.pinned !== 'boolean') throw new Error('Valor inválido para fixar o grupo.');
    if (group.id !== undefined && group.id !== null) {
      if (!validId(group.id)) throw new Error('Identificador de grupo inválido.');
      if (ids.has(group.id)) throw new Error('Identificador de grupo repetido.');
      ids.add(group.id);
    }
    if (scope === 'global' && group.pinned === true) {
      const icon = group.icon || 'extensions';
      const key = pinIcon(icon);
      if (key === null) throw new Error(`O ícone “${icon}” não pode ser fixado na barra de atividades.`);
      if (pinnedIcons.has(key)) throw new Error(`Só um grupo pode ser fixado por ícone (“${key}”).`);
      pinnedIcons.add(key);
    }
    for (const [ii, item] of group.items.entries()) {
      const label = item && typeof item.name === 'string' && cleanText(item.name) ? `item “${cleanText(item.name).slice(0, 40)}”` : `item nº ${ii + 1}`;
      const at = `${where}, ${label}`;
      if (!item || typeof item.name !== 'string' || !cleanText(item.name)) throw new Error(`${at}: informe o nome.`);
      if (cleanText(item.name).length > MAX_ITEM_NAME) throw new Error(`${at}: o nome pode ter até ${MAX_ITEM_NAME} caracteres.`);
      if (typeof item.command !== 'string' || !item.command.trim()) throw new Error(`${at}: informe o comando.`);
      if (item.command.trim().length > MAX_COMMAND) throw new Error(`${at}: o comando pode ter até ${MAX_COMMAND} caracteres.`);
      if (isBlockedCommand(item.command)) throw new Error(`${at}: esse comando não pode ser usado como item.`);
      if (item.icon !== undefined && typeof item.icon !== 'string') throw new Error('Ícone inválido.');
      if (item.args !== undefined && !Array.isArray(item.args)) throw new Error('Argumentos devem ser uma lista.');
      if (item.extensionId !== undefined && item.extensionId !== null && !validExtensionId(item.extensionId)) throw new Error('Identificador de extensão inválido.');
    }
  }
  return groups.map(g => ({
    ...(validId(g.id) ? { id: g.id } : {}),
    name: cleanText(g.name), icon: g.icon || 'extensions', ...(validColor(g.color) ? { color: g.color } : {}),
    ...(scope === 'global' && g.pinned === true ? { pinned: true } : {}),
    items: g.items.map(i => ({
      name: cleanText(i.name), command: i.command.trim(), icon: i.icon || 'extensions',
      ...(i.args ? { args: i.args } : {}),
      ...(validExtensionId(i.extensionId) ? { extensionId: i.extensionId } : {})
    }))
  }));
}

function pinnedGroups(groups) { return groups.filter(g => g.pinned === true); }

module.exports = { readGroups, validateGroups, favoriteKey, extensionContainer, pinnedGroups, cleanText, isBlockedCommand, BLOCKED_COMMANDS, RECURSIVE_COMMAND, COLORS, NEUTRAL_COLOR, ID_PATTERN, MAX_GROUPS, MAX_NAME, MAX_ITEM_NAME, MAX_COMMAND };
