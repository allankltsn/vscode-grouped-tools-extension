/* Catalog of "pinnable" icons: single source of truth shared by the extension (src/), the generator
   (scripts/build-pins.js) and the webview. One static Activity Bar container exists per icon, because a
   container icon is a static file declared in package.json. Pure data, no DOM and no vscode access. */
(function (root) {
  'use strict';

  // [lucide icon, pt-BR name used in the container title, closest codicon for the status bar]
  const ROWS = [
    ['sparkles', 'IA', 'sparkle'], ['bot', 'Robô', 'hubot'], ['git-branch', 'Git', 'git-branch'],
    ['git-pull-request', 'Pull requests', 'git-pull-request'], ['database', 'Banco de dados', 'database'],
    ['server', 'Servidor', 'server'], ['container', 'Contêiner', 'package'], ['box', 'Caixa', 'package'],
    ['cloud', 'Nuvem', 'cloud'], ['terminal', 'Terminal', 'terminal'], ['code', 'Código', 'code'],
    ['folder', 'Pasta', 'folder'], ['kanban', 'Quadro', 'project'], ['workflow', 'Fluxo', 'type-hierarchy'],
    ['flask-conical', 'Laboratório', 'beaker'], ['bug', 'Depuração', 'bug'], ['shield', 'Segurança', 'shield'],
    ['rocket', 'Foguete', 'rocket'], ['puzzle', 'Extensões', 'extensions'], ['settings', 'Configurações', 'settings-gear'],
    ['wrench', 'Ferramenta', 'tools'], ['package', 'Pacote', 'package'], ['layers', 'Camadas', 'layers'],
    ['palette', 'Paleta', 'symbol-color'], ['notebook-pen', 'Caderno', 'notebook'], ['calendar', 'Calendário', 'calendar'],
    ['headphones', 'Música', 'unmute'], ['mail', 'E-mail', 'mail'], ['message-square', 'Mensagens', 'comment'],
    ['chart-bar', 'Gráficos', 'graph'], ['globe', 'Web', 'globe'], ['network', 'Rede', 'remote'],
    ['cpu', 'Processador', 'chip'], ['brain', 'Cérebro', 'lightbulb'], ['key', 'Chave', 'key'],
    ['star', 'Estrela', 'star-full'], ['heart', 'Coração', 'heart'], ['bookmark', 'Marcador', 'bookmark'],
    ['zap', 'Raio', 'zap'], ['flame', 'Chama', 'flame']
  ];

  // Legacy icon names (also in media/icons.js, window.toolIconAliases) that map onto catalog icons.
  const ICON_ALIASES = { warning: 'triangle-alert', beaker: 'flask-conical', sparkle: 'sparkles', extensions: 'puzzle', music: 'headphones' };

  const PIN_ICONS = ROWS.map(r => r[0]);
  const NAMES = Object.fromEntries(ROWS.map(r => [r[0], r[1]]));
  const CODICONS = Object.fromEntries(ROWS.map(r => [r[0], r[2]]));
  const known = new Set(PIN_ICONS);

  // Catalog icon for a group icon (resolving legacy aliases), or null when the icon is not pinnable.
  function pinIcon(icon) {
    if (typeof icon !== 'string') return null;
    const name = Object.prototype.hasOwnProperty.call(ICON_ALIASES, icon) ? ICON_ALIASES[icon] : icon;
    return known.has(name) ? name : null;
  }
  const pinName = icon => NAMES[pinIcon(icon) || icon] || String(icon);
  const pinCodicon = icon => CODICONS[pinIcon(icon)] || 'folder';
  // Ids derived from the icon name. Context keys avoid hyphens (safer in `when` clauses).
  const containerId = icon => `groupedTools.pin.${icon}`;
  const viewId = icon => `groupedTools.pin.${icon}.view`;
  const contextKey = icon => `groupedTools.pinned.${String(icon).replace(/-/g, '_')}`;

  const api = { PIN_ICONS, ICON_ALIASES, pinIcon, pinName, pinCodicon, containerId, viewId, contextKey };
  root.pinCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
