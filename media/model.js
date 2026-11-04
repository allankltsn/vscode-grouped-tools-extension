/* Pure group model and icon search for the panel. No DOM access, so it is unit-tested under Node. */
(function (root) {
  'use strict';
  const catalog = typeof module !== 'undefined' && module.exports ? require('./pin-catalog') : root.pinCatalog;

  const COLORS = ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6', 'g-7', 'g-8', 'g-9', 'g-10'];
  const COLOR_NAMES = ['Azul', 'Violeta', 'Rosa', 'Vermelho', 'Laranja', 'Âmbar', 'Verde', 'Turquesa', 'Ciano', 'Ardósia'];
  const NEUTRAL = 'g-10';
  // Same list as BLOCKED_COMMANDS in src/config.js (a test keeps them equal).
  const BLOCKED_COMMANDS = ['groupedTools.run', 'groupedTools.runById', 'groupedTools.openGroup', 'groupedTools.manageGroup'];
  const MAX_GROUPS = 100; // same limit as src/config.js (a test keeps them equal)
  const clone = value => JSON.parse(JSON.stringify(value));
  let counter = 0;
  function newId(prefix) {
    counter += 1;
    return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
  function normalize(text) { return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // ---- group color: palette id (g-1..g-10) or a custom '#rrggbb' (lowercase, six digits, nothing else) ----------------
  // Same rule as validColor in src/config.js (a test keeps them equal). Any other string is rejected.
  const HEX_COLOR = /^#[0-9a-f]{6}$/;
  const isHexColor = value => typeof value === 'string' && HEX_COLOR.test(value);
  const isPaletteColor = value => typeof value === 'string' && COLORS.includes(value);
  const isValidColor = value => isPaletteColor(value) || isHexColor(value);
  function normalizeColor(value) { return isValidColor(value) ? value : NEUTRAL; }
  function colorOf(group) { return normalizeColor(group && group.color); }
  // CSS class of a group: the palette class, or 'g-custom' (the value itself is applied through the CSSOM, never in markup).
  function colorClass(group) { return isHexColor(colorOf(group)) ? 'g-custom' : colorOf(group); }

  // New groups get a random palette color (never the neutral slate), avoiding the neighbour above when possible.
  // `rng` is injectable (returns a number in [0, 1)) so tests are deterministic.
  const RANDOM_POOL = COLORS.filter(c => c !== NEUTRAL);
  function randomColor(groups, rng = Math.random, at) {
    const list = Array.isArray(groups) ? groups : [];
    const index = at == null ? list.length : Math.max(0, Math.min(at, list.length));
    const prev = index > 0 && list[index - 1] ? list[index - 1].color : null;
    const pool = RANDOM_POOL.filter(c => c !== prev);
    const r = Number(rng());
    return pool[Number.isFinite(r) ? Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length))) : 0];
  }

  // ---- color by code: HEX, RGB and HSL with an input mask and strict parsing -------------------------------------------
  const COLOR_FORMATS = {
    hex: { label: 'HEX', placeholder: '#3B82F6', example: 'Exemplos: #3B82F6 ou #38F', error: 'HEX precisa de 3 ou 6 dígitos (0 a 9 e A a F).' },
    rgb: { label: 'RGB', placeholder: '59, 130, 246', example: 'Exemplo: 59, 130, 246 (cada valor de 0 a 255)', error: 'RGB precisa de três números inteiros de 0 a 255.' },
    hsl: { label: 'HSL', placeholder: '217, 91%, 60%', example: 'Exemplo: 217, 91%, 60% (H de 0 a 360, S e L de 0 a 100)', error: 'HSL precisa de H de 0 a 360 e de S e L de 0 a 100%.' }
  };
  const FORMAT_LIMITS = { rgb: [255, 255, 255], hsl: [360, 100, 100] };
  const hasFormat = format => typeof format === 'string' && Object.hasOwn(COLOR_FORMATS, format);
  // Splits the typed text into at most three integer tokens. A token closes by itself when it cannot grow
  // (three digits, or one more digit would pass the limit); a digit that would pass the limit is ignored.
  function numberTokens(raw, limits) {
    const tokens = []; let cur = '';
    for (const ch of String(raw)) {
      if (ch >= '0' && ch <= '9') {
        if (tokens.length >= 3) break;
        if (Number(cur + ch) > limits[tokens.length]) continue;
        cur += ch;
        if (cur.length === 3 || Number(cur) * 10 > limits[tokens.length]) { tokens.push(cur); cur = ''; }
      } else if ((ch === ',' || ch === ' ' || ch === ';') && cur) { tokens.push(cur); cur = ''; }
    }
    const open = cur !== '';
    if (open) tokens.push(cur);
    return { tokens: tokens.slice(0, 3), open };
  }
  // Keeps only the characters and ranges valid for the chosen format and lays them out in the canonical mask.
  // `how` is 'delete' (or true) while the user erases: nothing the user just removed is put back (no closing separator,
  // no '%' on the last field). 'paste' treats the text as a whole value and clamps each number to its maximum.
  function maskColorInput(format, raw, how) {
    const deleting = how === true || how === 'delete', pasting = how === 'paste';
    const text = String(raw == null ? '' : raw).slice(0, 64);
    if (format === 'hex') {
      const digits = text.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
      return digits ? `#${digits}` : (text.includes('#') ? '#' : '');
    }
    if (!hasFormat(format) || !Object.hasOwn(FORMAT_LIMITS, format)) return '';
    const limits = FORMAT_LIMITS[format];
    if (pasting) {
      const nums = (text.match(/\d+/g) || []).slice(0, 3).map((t, i) => String(Math.min(limits[i], Number(t.slice(0, 6)))));
      return nums.map((t, i) => (format === 'hsl' && i > 0 ? `${t}%` : t)).join(', ');
    }
    const { tokens, open } = numberTokens(text, limits);
    const pct = (t, i) => (format === 'hsl' && i > 0 && !(deleting && i === tokens.length - 1) ? `${t}%` : t);
    let out = tokens.map((t, i) => pct(t, i)).join(', ');
    if (out && !open && !deleting && tokens.length < 3) out += ', ';
    return out;
  }
  const hex2 = n => n.toString(16).padStart(2, '0');
  const rgbToHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  function hslToHex(h, s, l) {
    const sat = s / 100, lig = l / 100, k = n => (n + h / 30) % 12, a = sat * Math.min(lig, 1 - lig);
    const f = n => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
  }
  // Parses a complete value. Returns { ok: true, hex: '#rrggbb' } or { ok: false, error } (pt-BR). Never throws.
  function parseColorInput(format, text) {
    if (!hasFormat(format)) return { ok: false, error: 'Formato de cor desconhecido.' };
    const spec = COLOR_FORMATS[format];
    const value = String(text == null ? '' : text).trim();
    if (format === 'hex') {
      const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value);
      if (!m) return { ok: false, error: spec.error };
      const d = m[1].toLowerCase();
      return { ok: true, hex: `#${d.length === 3 ? [...d].map(c => c + c).join('') : d}` };
    }
    const re = format === 'rgb' ? /^(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})$/ : /^(\d{1,3})\s*[, ]\s*(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?$/;
    const m = re.exec(value.replace(/[,\s]+$/, ''));
    if (!m) return { ok: false, error: spec.error };
    const n = m.slice(1, 4).map(Number), limits = FORMAT_LIMITS[format];
    if (n.some((v, i) => v > limits[i])) return { ok: false, error: spec.error };
    return { ok: true, hex: format === 'rgb' ? rgbToHex(n[0], n[1], n[2]) : hslToHex(n[0] % 360, n[1], n[2]) };
  }

  // WCAG relative luminance and contrast of '#rrggbb' colors.
  const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  function luminance(hex) {
    const [r, g, b] = channels(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // Black or white, whichever reads better over a custom color (e.g. the check mark on a swatch).
  const onColor = hex => (contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff');
  // Group text color for a custom color: starts from the color and moves toward the theme foreground until it reaches
  // `min` contrast over the panel background tinted by the group color (as the chip is).
  function readableTone(hex, bg, fg, min = 4.5) {
    if (!isHexColor(hex) || !isHexColor(bg) || !isHexColor(fg)) return isHexColor(fg) ? fg : hex;
    const mix = (a, b, t) => { const x = channels(a), y = channels(b); return rgbToHex(...x.map((v, i) => Math.round(v * (1 - t) + y[i] * t))); };
    const surface = mix(bg, hex, 0.16);
    for (let i = 0; i <= 10; i++) { const c = mix(hex, fg, i / 10); if (contrast(c, surface) >= min) return c; }
    return fg;
  }

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
      kind: 'extension', extensionId: ext.extensionId, installed: true, ...(ext.iconKey ? { iconKey: ext.iconKey } : {}) };
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

  function createGroup(groups, props = {}, at, rng = Math.random) {
    if (groups.length >= MAX_GROUPS) return { groups, changed: false };
    const group = { id: newId('grp-'), name: props.name || 'Novo grupo', icon: props.icon || 'folder', color: isValidColor(props.color) ? props.color : randomColor(groups, rng, at), items: props.items || [] };
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
    HEX_COLOR, isHexColor, isValidColor, normalizeColor, colorClass, randomColor,
    COLOR_FORMATS, maskColorInput, parseColorInput, luminance, contrast, onColor, readableTone,
    moveItem, moveItemToIndex, stepItem, moveGroup, moveGroupToIndex, stepGroup,
    itemFromExtension, insertItem, createGroup, removeItem, removeGroup, updateGroup, updateItem,
    MAX_GROUPS, BLOCKED_COMMANDS, serialize, computeUnassigned, searchIcons,
    pinKey, pinOwner, pinState, setPinned, replacePin, pinWithIcon, iconBlock
  };
  root.groupModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
