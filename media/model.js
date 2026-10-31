/* Pure group model and icon search for the panel. No DOM access, so it is unit-tested under Node. */
(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./pin-catalog') : root.pinCatalog;

  const COLORS = ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6', 'g-7', 'g-8', 'g-9', 'g-10'];
  const COLOR_NAMES = ['Azul', 'Violeta', 'Rosa', 'Vermelho', 'Laranja', 'Âmbar', 'Verde', 'Turquesa', 'Ciano', 'Ardósia'];
  const NEUTRAL = 'g-10';
  const MAX_GROUPS = 100; // same limit as src/config.js (a test keeps them equal)
  const clone = value => JSON.parse(JSON.stringify(value));
  let counter = 0;
  function newId(prefix) {
    counter += 1;
    return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
  function normalize(text) { return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function colorOf(group) { return COLORS.includes(group && group.color) ? group.color : NEUTRAL; }

  function locate(groups, itemId) {
    for (let gi = 0; gi < groups.length; gi++) {
      const ii = groups[gi].items.findIndex(i => i.id === itemId);
      if (ii >= 0) return { gi, ii };
    }
    return null;
  }
  const NOOP = groups => ({ groups, changed: false });

  // Moves an item to `index` (position in the target list once the item has been removed).
  function moveItemToIndex(groups, itemId, toGroupId, index) {
    const from = locate(groups, itemId);
    const to = groups.findIndex(g => g.id === toGroupId);
    if (!from || to < 0) return NOOP(groups);
    const next = clone(groups);
    const [item] = next[from.gi].items.splice(from.ii, 1);
    const target = next[to].items;
    const at = index == null ? target.length : Math.max(0, Math.min(index, target.length));
    target.splice(at, 0, item);
    const changed = from.gi !== to || from.ii !== at;
    return { groups: changed ? next : groups, changed, item, group: next[to], fromGroup: groups[from.gi], index: at, total: target.length };
  }

  // Same, but positioned before `beforeId` (null = at the end).
  function moveItem(groups, itemId, toGroupId, beforeId) {
    if (beforeId === itemId) return NOOP(groups);
    const target = groups.find(g => g.id === toGroupId);
    if (!target) return NOOP(groups);
    const rest = target.items.filter(i => i.id !== itemId);
    const at = beforeId == null ? rest.length : rest.findIndex(i => i.id === beforeId);
    return moveItemToIndex(groups, itemId, toGroupId, at < 0 ? rest.length : at);
  }

  // Keyboard step: up/down walk the item list and cross into the neighbour group at the edges;
  // left/right jump to the previous/next group keeping the position when possible.
  function stepItem(groups, itemId, dir) {
    const at = locate(groups, itemId);
    if (!at) return NOOP(groups);
    const { gi, ii } = at;
    if (dir === 'up') {
      if (ii > 0) return moveItemToIndex(groups, itemId, groups[gi].id, ii - 1);
      if (gi > 0) return moveItemToIndex(groups, itemId, groups[gi - 1].id, null);
    } else if (dir === 'down') {
      if (ii < groups[gi].items.length - 1) return moveItemToIndex(groups, itemId, groups[gi].id, ii + 1);
      if (gi < groups.length - 1) return moveItemToIndex(groups, itemId, groups[gi + 1].id, 0);
    } else if (dir === 'left' && gi > 0) return moveItemToIndex(groups, itemId, groups[gi - 1].id, ii);
    else if (dir === 'right' && gi < groups.length - 1) return moveItemToIndex(groups, itemId, groups[gi + 1].id, ii);
    return NOOP(groups);
  }

  function moveGroupToIndex(groups, groupId, index) {
    const from = groups.findIndex(g => g.id === groupId);
    if (from < 0) return NOOP(groups);
    const next = clone(groups);
    const [group] = next.splice(from, 1);
    const at = index == null ? next.length : Math.max(0, Math.min(index, next.length));
    next.splice(at, 0, group);
    const changed = at !== from;
    return { groups: changed ? next : groups, changed, group, index: at, total: next.length };
  }
  function moveGroup(groups, groupId, beforeId) {
    if (beforeId === groupId) return NOOP(groups);
    const rest = groups.filter(g => g.id !== groupId);
    const at = beforeId == null ? rest.length : rest.findIndex(g => g.id === beforeId);
    return moveGroupToIndex(groups, groupId, at < 0 ? rest.length : at);
  }
  function stepGroup(groups, groupId, dir) {
    const at = groups.findIndex(g => g.id === groupId);
    if (at < 0) return NOOP(groups);
    if (dir === 'up' && at > 0) return moveGroupToIndex(groups, groupId, at - 1);
    if (dir === 'down' && at < groups.length - 1) return moveGroupToIndex(groups, groupId, at + 1);
    return NOOP(groups);
  }

  function itemFromExtension(ext) {
    return { id: newId('new-'), name: ext.name, command: ext.command, icon: ext.icon || 'extensions', favorite: false,
      kind: 'extension', extensionId: ext.extensionId, installed: true };
  }

  function insertItem(groups, groupId, item, beforeId) {
    const to = groups.findIndex(g => g.id === groupId);
    if (to < 0) return NOOP(groups);
    const next = clone(groups);
    const copy = { ...item, id: item.id || newId('new-') };
    const items = next[to].items;
    const at = beforeId == null ? items.length : items.findIndex(i => i.id === beforeId);
    items.splice(at < 0 ? items.length : at, 0, copy);
    return { groups: next, changed: true, item: copy, group: next[to], index: at < 0 ? items.length - 1 : at, total: items.length };
  }

  function createGroup(groups, props = {}, at) {
    const group = { id: newId('grp-'), name: props.name || 'Novo grupo', icon: props.icon || 'folder', color: props.color || COLORS[groups.length % 9], items: props.items || [] };
    if (groups.length >= MAX_GROUPS) return { groups, changed: false };
    const next = clone(groups);
    next.splice(at == null ? next.length : at, 0, group);
    return { groups: next, changed: true, group };
  }

  function removeItem(groups, itemId) {
    const at = locate(groups, itemId);
    if (!at) return NOOP(groups);
    const next = clone(groups);
    const [item] = next[at.gi].items.splice(at.ii, 1);
    return { groups: next, changed: true, item, group: next[at.gi], index: at.ii };
  }
  function removeGroup(groups, groupId) {
    const at = groups.findIndex(g => g.id === groupId);
    if (at < 0) return NOOP(groups);
    const next = clone(groups);
    const [group] = next.splice(at, 1);
    return { groups: next, changed: true, group, index: at };
  }
  function updateGroup(groups, groupId, patch) {
    const at = groups.findIndex(g => g.id === groupId);
    if (at < 0) return NOOP(groups);
    const next = clone(groups);
    Object.assign(next[at], patch);
    return { groups: next, changed: true, group: next[at] };
  }
  function updateItem(groups, itemId, patch) {
    const at = locate(groups, itemId);
    if (!at) return NOOP(groups);
    const next = clone(groups);
    Object.assign(next[at.gi].items[at.ii], patch);
    return { groups: next, changed: true, item: next[at.gi].items[at.ii], group: next[at.gi] };
  }

  // Shape persisted in groupedTools.groups (UI-only fields such as favorite/installed are dropped).
  // `pinned` only exists in the Global scope.
  function serialize(groups, scope = 'global') {
    return groups.map(g => ({
      id: g.id, name: g.name, icon: g.icon, color: colorOf(g),
      ...(scope === 'global' && g.pinned ? { pinned: true } : {}),
      items: g.items.map(i => ({
        name: i.name, command: i.command, icon: i.icon,
        ...(Array.isArray(i.args) ? { args: i.args } : {}),
        ...(i.extensionId ? { extensionId: i.extensionId } : {})
      }))
    }));
  }

  // ---- pinned groups (Global scope): one group per catalog icon -----------------------------------
  const pinKey = icon => catalog.pinIcon(icon);
  function pinOwner(groups, icon, exceptId) {
    const key = pinKey(icon);
    return key ? groups.find(g => g.pinned && g.id !== exceptId && pinKey(g.icon) === key) || null : null;
  }
  // State of the "Fixar" action: scope | pinned | needs-icon | conflict | free.
  function pinState(groups, group, scope) {
    if (scope !== 'global') return { state: 'scope' };
    if (group.pinned) return { state: 'pinned' };
    if (!pinKey(group.icon)) return { state: 'needs-icon' };
    const owner = pinOwner(groups, group.icon, group.id);
    return owner ? { state: 'conflict', owner } : { state: 'free' };
  }
  function setPinned(groups, groupId, on) {
    const group = groups.find(g => g.id === groupId);
    if (!group || Boolean(group.pinned) === Boolean(on)) return NOOP(groups);
    if (on && (!pinKey(group.icon) || pinOwner(groups, group.icon, groupId))) return NOOP(groups);
    if (on) return updateGroup(groups, groupId, { pinned: true });
    const next = clone(groups);
    delete next.find(g => g.id === groupId).pinned;
    return { groups: next, changed: true, group: next.find(g => g.id === groupId) };
  }
  // Unpins `ownerId` and pins `groupId` (same icon) in one operation.
  function replacePin(groups, ownerId, groupId) {
    const owner = groups.find(g => g.id === ownerId), group = groups.find(g => g.id === groupId);
    if (!owner || !group || !owner.pinned || !pinKey(group.icon) || pinKey(owner.icon) !== pinKey(group.icon)) return NOOP(groups);
    const next = clone(groups);
    delete next.find(g => g.id === ownerId).pinned;
    next.find(g => g.id === groupId).pinned = true;
    return { groups: next, changed: true, group: next.find(g => g.id === groupId), owner: next.find(g => g.id === ownerId) };
  }
  // Chooses a pinnable icon for the group and pins it in one operation.
  function pinWithIcon(groups, groupId, icon) {
    const group = groups.find(g => g.id === groupId);
    if (!group || !pinKey(icon) || pinOwner(groups, icon, groupId)) return NOOP(groups);
    return updateGroup(groups, groupId, { icon, pinned: true });
  }
  // Why a picker cell cannot be chosen ('' = free). mode: 'pin' (choosing the pin icon), 'locked' (group is pinned), 'free'.
  function iconBlock(groups, group, icon, mode) {
    if (mode === 'free') return '';
    const owner = pinOwner(groups, icon, group.id);
    if (owner) return `Em uso por “${owner.name}” (fixado)`;
    if (mode === 'locked' && !pinKey(icon)) return 'Não fixável: desafixe o grupo para usar este ícone';
    if (mode === 'pin' && !pinKey(icon)) return 'Ícone não fixável';
    return '';
  }

  function computeUnassigned(extensions, groups) {
    const used = new Set(groups.flatMap(g => g.items.map(i => i.command)));
    return extensions.filter(e => !used.has(e.command));
  }

  // Portuguese words mapped to English terms present in Lucide names and tags.
  const SYNONYMS = {
    banco: 'database', dados: 'database', pasta: 'folder', arquivo: 'file', configuracao: 'settings', engrenagem: 'settings',
    usuario: 'user', casa: 'home', buscar: 'search', pesquisa: 'search', nuvem: 'cloud', codigo: 'code', estrela: 'star',
    coracao: 'heart', calendario: 'calendar', email: 'mail', mensagem: 'message', livro: 'book', musica: 'music',
    foto: 'image', imagem: 'image', relogio: 'clock', alerta: 'alert', aviso: 'triangle-alert', teste: 'flask',
    grafico: 'chart', rede: 'network', servidor: 'server', seguranca: 'shield', chave: 'key', cadeado: 'lock',
    lixo: 'trash', editar: 'pencil', adicionar: 'plus', remover: 'minus', ferramenta: 'wrench', martelo: 'hammer',
    caixa: 'box', pacote: 'package', robo: 'bot', cerebro: 'brain', mapa: 'map', globo: 'globe', bandeira: 'flag',
    docker: 'container', terminal: 'terminal', ia: 'sparkles', faisca: 'sparkles', planejamento: 'kanban', quadro: 'kanban'
  };

  // Ranks icon names: exact name, prefix, substring, then tags. Every word must match somewhere.
  function searchIcons(names, tags, query, synonyms = SYNONYMS) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return names.slice();
    const alternatives = words.map(w => [w, ...(synonyms[w] ? [synonyms[w]] : [])]);
    const scored = [];
    for (const name of names) {
      const spaced = name.replace(/-/g, ' ');
      const tagText = normalize((tags && tags[name]) || '');
      let total = 0;
      for (const alts of alternatives) {
        let best = 0;
        for (const alt of alts) {
          const score = name === alt ? 4 : name.startsWith(alt) ? 3 : spaced.includes(alt) ? 2 : tagText.includes(alt) ? 1 : 0;
          if (score > best) best = score;
        }
        if (!best) { total = 0; break; }
        total += best;
      }
      if (total) scored.push([total, name]);
    }
    return scored.sort((a, b) => b[0] - a[0]).map(entry => entry[1]);
  }

  const api = {
    COLORS, COLOR_NAMES, NEUTRAL, clone, newId, normalize, colorOf, locate,
    moveItem, moveItemToIndex, stepItem, moveGroup, moveGroupToIndex, stepGroup,
    itemFromExtension, insertItem, createGroup, removeItem, removeGroup, updateGroup, updateItem,
    MAX_GROUPS, serialize, computeUnassigned, searchIcons,
    pinKey, pinOwner, pinState, setPinned, replacePin, pinWithIcon, iconBlock
  };
  root.groupModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
