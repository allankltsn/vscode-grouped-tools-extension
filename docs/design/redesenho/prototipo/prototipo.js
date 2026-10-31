/* Protótipo do painel redesenhado - Ferramentas agrupadas.
   Tudo é simulado em memória; nada é gravado. Sem dependências (usa window.toolIcons de icons-subset.js). */
(function () {
'use strict';

/* ---------- utilitários ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var I = window.toolIcons || {};
var T = window.toolIconTags || {};
/* ícones extras (Lucide, ISC) que o subconjunto não traz */
var EXTRA = {
  'circle-dashed': '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  'search-x': '<path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'loader': '<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'pin': '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  'chevrons-down-up': '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  'chevrons-up-down': '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'
};
/* Catálogo curado de "ícones fixáveis": um contêiner estático da Activity Bar por ícone (groupedTools.pin.<icone>).
   Na extensão virá de um único módulo; aqui só usa ícones presentes em icons-subset.js. */
var PIN_NAME = {
  'sparkles': 'IA', 'bot': 'Robô', 'git-branch': 'Git', 'git-pull-request': 'Pull requests', 'database': 'Banco de dados', 'server': 'Servidor',
  'container': 'Contêiner', 'box': 'Caixa', 'cloud': 'Nuvem', 'terminal': 'Terminal', 'code': 'Código', 'folder': 'Pasta', 'kanban': 'Quadro',
  'workflow': 'Fluxo', 'flask-conical': 'Laboratório', 'bug': 'Depuração', 'shield': 'Segurança', 'rocket': 'Foguete', 'puzzle': 'Extensões',
  'settings': 'Configurações', 'wrench': 'Ferramenta', 'package': 'Pacote', 'layers': 'Camadas', 'palette': 'Paleta', 'notebook-pen': 'Caderno',
  'calendar': 'Calendário', 'headphones': 'Música', 'mail': 'E-mail', 'message-square': 'Mensagens', 'chart-bar': 'Gráficos', 'globe': 'Web',
  'network': 'Rede', 'cpu': 'Processador', 'brain': 'Cérebro', 'key': 'Chave', 'star': 'Estrela', 'heart': 'Coração', 'bookmark': 'Marcador',
  'zap': 'Raio', 'flame': 'Chama'
};
var PIN_CAT = Object.keys(PIN_NAME);
Object.keys(EXTRA).forEach(function (k) { if (!I[k]) I[k] = EXTRA[k]; });
if (!I.files) I.files = '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>';
if (!I['sliders-horizontal']) I['sliders-horizontal'] = '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>';
function ic(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (I[name] || I.puzzle || '') + '</svg>';
}
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fold(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function pl(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function cssq(v) { return (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'); }

/* ---------- dados de exemplo (pt-BR) ---------- */
var COLORS = [['g-1', 'Azul'], ['g-2', 'Violeta'], ['g-3', 'Rosa'], ['g-4', 'Vermelho'], ['g-5', 'Laranja'],
  ['g-6', 'Âmbar'], ['g-7', 'Verde'], ['g-8', 'Turquesa'], ['g-9', 'Ciano'], ['g-10', 'Ardósia (sem cor)']];
function cname(k) { for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0] === k) return COLORS[i][1]; return COLORS[9][1]; }

var EXT = [
  { id: 'claude-code', name: 'Claude Code', icon: 'sparkles' },
  { id: 'copilot', name: 'GitHub Copilot', icon: 'bot' },
  { id: 'continue', name: 'Continue', icon: 'brain' },
  { id: 'cline', name: 'Cline', icon: 'bot-message-square' },
  { id: 'gitlens', name: 'GitLens', icon: 'git-compare' },
  { id: 'git-graph', name: 'Git Graph', icon: 'git-graph' },
  { id: 'gh-prs', name: 'GitHub Pull Requests', icon: 'git-pull-request' },
  { id: 'gh-actions', name: 'GitHub Actions', icon: 'workflow' },
  { id: 'postgres', name: 'PostgreSQL', icon: 'database' },
  { id: 'prisma', name: 'Prisma', icon: 'diamond' },
  { id: 'sqltools', name: 'SQLTools', icon: 'table-2' },
  { id: 'mongodb', name: 'MongoDB', icon: 'leaf' },
  { id: 'redis', name: 'Redis', icon: 'server', inst: false },
  { id: 'docker', name: 'Docker', icon: 'container' },
  { id: 'devcontainers', name: 'Dev Containers', icon: 'boxes' },
  { id: 'remote-ssh', name: 'Remote - SSH', icon: 'cable' },
  { id: 'k8s', name: 'Kubernetes', icon: 'hexagon' },
  { id: 'wsl', name: 'WSL', icon: 'laptop' },
  { id: 'drawio', name: 'Draw.io Integration', icon: 'pen-tool' },
  { id: 'mermaid', name: 'Mermaid Preview', icon: 'waypoints' },
  { id: 'project-manager', name: 'Project Manager', icon: 'kanban' },
  { id: 'todo-tree', name: 'Todo Tree', icon: 'list-checks' },
  { id: 'plantuml', name: 'PlantUML', icon: 'network', inst: false },
  { id: 'python', name: 'Python', icon: 'code-xml' },
  { id: 'jupyter', name: 'Jupyter', icon: 'notebook-pen' },
  { id: 'rust-analyzer', name: 'rust-analyzer', icon: 'hammer' },
  { id: 'spotify', name: 'Spotify', icon: 'headphones' },
  { id: 'thunder', name: 'Thunder Client', icon: 'send' },
  { id: 'live-share', name: 'Live Share', icon: 'users' },
  /* não agrupadas */
  { id: 'go', name: 'Go', icon: 'code' },
  { id: 'postman', name: 'Postman', icon: 'rocket' },
  { id: 'error-lens', name: 'Error Lens', icon: 'triangle-alert' },
  { id: 'peacock', name: 'Peacock', icon: 'palette' },
  { id: 'wakatime', name: 'WakaTime', icon: 'clock' },
  { id: 'excalidraw', name: 'Excalidraw', icon: 'pen-tool' },
  { id: 'bookmarks', name: 'Bookmarks', icon: 'bookmark' },
  { id: 'pomodoro', name: 'Pomodoro Timer', icon: 'timer' },
  { id: 'markdown-aio', name: 'Markdown All in One', icon: 'file-text' }
];
var EXTMAP = {}; EXT.forEach(function (e) { EXTMAP[e.id] = e; });

function mk(e) { return { id: 'i-' + e.id, ext: e.id, name: e.name, icon: e.icon, fav: false, inst: e.inst !== false }; }
function seedGroups(withItems) {
  function G(id, name, icon, color, ids) { return { id: id, name: name, icon: icon, color: color, items: withItems ? ids.map(function (x) { return typeof x === 'string' ? mk(EXTMAP[x]) : x; }) : [] }; }
  var cmd = { id: 'i-cmd-paleta', name: 'Paleta de comandos', icon: 'square-terminal', cmd: true, fav: false, inst: true };
  var gs = [
    G('g-claude', 'Claude e IA', 'sparkles', 'g-2', ['claude-code', 'copilot', 'continue', 'cline']),
    G('g-git', 'Git e GitHub', 'git-branch', 'g-1', ['gitlens', 'git-graph', 'gh-prs', 'gh-actions']),
    G('g-db', 'Bancos de dados', 'database', 'g-8', ['postgres', 'prisma', 'sqltools', 'mongodb', 'redis']),
    G('g-cont', 'Containers e remoto', 'container', 'g-9', ['docker', 'devcontainers', 'remote-ssh', 'k8s', 'wsl']),
    G('g-diag', 'Diagramas e planejamento', 'workflow', 'g-5', ['drawio', 'mermaid', 'project-manager', 'todo-tree', 'plantuml']),
    G('g-lang', 'Linguagens e notebooks', 'notebook-pen', 'g-3', ['python', 'jupyter', 'rust-analyzer']),
    G('g-misc', 'Variados', 'puzzle', 'g-10', ['spotify', 'thunder', 'live-share', cmd])
  ];
  if (withItems) { ['i-claude-code', 'i-gitlens', 'i-docker'].forEach(function (id) { gs.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) it.fav = true; }); }); }); }
  return gs;
}

/* sinônimos pt-BR para a busca de ícones (as tags do catálogo são em inglês) */
var PT = { 'database': 'banco dados', 'git-branch': 'ramo ramificacao versao', 'container': 'conteiner contêiner caixa', 'cloud': 'nuvem', 'folder': 'pasta', 'folder-open': 'pasta aberta',
  'calendar': 'calendario agenda', 'star': 'estrela favorito', 'bot': 'robo', 'sparkles': 'ia estrelas brilho magica', 'code': 'codigo', 'terminal': 'terminal console',
  'settings': 'configuracoes engrenagem', 'search': 'buscar lupa pesquisar', 'lock': 'cadeado segredo', 'key': 'chave', 'image': 'imagem foto', 'headphones': 'fone musica audio',
  'mail': 'email correio', 'bell': 'sino notificacao', 'clock': 'relogio hora', 'users': 'pessoas equipe', 'user': 'pessoa usuario', 'rocket': 'foguete lancar',
  'bug': 'inseto erro depurar', 'shield': 'escudo seguranca', 'workflow': 'fluxo diagrama', 'kanban': 'quadro tarefas planejamento', 'list-checks': 'tarefas lista',
  'notebook-pen': 'caderno notebook', 'chart-bar': 'grafico barras', 'table-2': 'tabela', 'server': 'servidor', 'network': 'rede', 'globe': 'mundo web',
  'puzzle': 'quebra-cabeca extensao', 'package': 'pacote', 'wrench': 'ferramenta chave', 'hammer': 'martelo construir', 'palette': 'paleta cores', 'pen-tool': 'caneta desenho',
  'flask-conical': 'experimento laboratorio', 'book-open': 'livro leitura', 'file-text': 'arquivo documento texto', 'layers': 'camadas', 'zap': 'raio energia rapido',
  'heart': 'coracao', 'bookmark': 'marcador', 'tag': 'etiqueta', 'send': 'enviar', 'timer': 'cronometro', 'laptop': 'notebook computador', 'cable': 'cabo conexao remoto' };

/* ---------- estado ---------- */
var S = {};
var uid = 100, lastSaved = '', lastUndo = null, rendering = false, drag = null;
var app = $('#app'), scrollEl = $('#scroll'), overlay = $('#overlay'), live = $('#live'), footEl = $('#foot');
var qEl = $('#q'), btnOrg = $('#btnOrg'), btnScope = $('#btnScope'), btnFold = $('#btnFold');
scrollEl.tabIndex = -1;

function cur() { return S.data[S.scope]; }
function allItems() { return cur().groups.reduce(function (a, g) { return a.concat(g.items); }, []); }
function unassigned() {
  var used = {}; allItems().forEach(function (i) { if (i.ext) used[i.ext] = 1; });
  return EXT.filter(function (e) { return e.inst !== false && !used[e.id]; });
}
function findItem(id) {
  var gs = cur().groups;
  for (var a = 0; a < gs.length; a++) for (var b = 0; b < gs[a].items.length; b++) if (gs[a].items[b].id === id) return { g: gs[a], i: b, it: gs[a].items[b] };
  return null;
}
function gById(id) { var gs = cur().groups; for (var i = 0; i < gs.length; i++) if (gs[i].id === id) return gs[i]; return null; }
function scopeName() { return S.scope === 'global' ? 'Global' : 'Este projeto'; }
function snap() { return JSON.stringify({ data: S.data, own: S.projectOwn }); }
function restore(s) {
  var o = JSON.parse(s); S.data = o.data; S.projectOwn = o.own;
  if (S.scope === 'project' && !S.data.project) S.scope = 'global';
  S.edit = null; S.confirmDel = null; S.kb = null;
}

/* ---------- anúncios (aria-live) e toast ---------- */
function announce(msg) {
  if (!msg) return;
  live.textContent = '';
  setTimeout(function () { live.textContent = msg; }, 30);
  var log = $('#pvLog'); if (!log) return;
  if (log.firstChild && log.firstChild.textContent === 'Nenhum anúncio ainda.') log.innerHTML = '';
  var li = document.createElement('li'); li.textContent = msg; log.insertBefore(li, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}
var toastT = null;
function toast(o) {
  clearTimeout(toastT);
  var old = $('.toast', overlay); if (old) old.remove();
  var kind = o.kind || 'ok', acts = o.actions || [];
  var n = document.createElement('div'); n.className = 'toast ' + kind; n.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  n.innerHTML = ic(kind === 'err' ? 'circle-alert' : kind === 'info' ? 'info' : 'check', 'sm lead') + '<span class="tx">' + esc(o.text) + '</span>' +
    acts.map(function (a, i) { return '<button type="button" class="ta" data-ti="' + i + '">' + esc(a.label) + '</button>'; }).join('') +
    '<button type="button" class="tx2" aria-label="Dispensar aviso" data-tx>' + ic('x', 'xs') + '</button>';
  overlay.appendChild(n);
  n.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-tx')) { n.remove(); return; }
    var a = acts[+b.dataset.ti]; n.remove(); clearTimeout(toastT); if (a) a.fn();
  });
  if (!o.sticky) toastT = setTimeout(function () { n.remove(); }, o.ttl || (acts.length ? 8000 : 3000));
}

/* ---------- salvar simulado, desfazer ---------- */
var saveT, saveT2;
function simulateSave() {
  S.save = 'saving'; renderFoot(); clearTimeout(saveT); clearTimeout(saveT2);
  saveT = setTimeout(function () {
    if (S.errSim) {
      S.save = 'error'; S.errBanner = true; render(); renderFoot();
      announce('Não foi possível salvar: sem permissão para gravar em groupedTools.groups. Suas alterações continuam na tela.');
      return;
    }
    var had = S.errBanner;
    S.save = 'saved'; S.errBanner = false; lastSaved = snap(); if (had) render(); renderFoot();
    announce('Salvo em ' + scopeName());
    saveT2 = setTimeout(function () { S.save = ''; renderFoot(); }, 3000);
  }, 900);
}
function undo() {
  if (!lastUndo) { announce('Nada para desfazer.'); return; }
  var u = lastUndo; lastUndo = null; closePop(false);
  restore(u.s); S.errBanner = false; render(null); syncTop(); renderFoot();
  announce('Desfeito: ' + u.op); toast({ text: 'Desfeito.' }); simulateSave();
}
function commit(fn, o) {
  var s = snap(); var r = fn() || {};
  if (r.skip) { if (r.say) announce(r.say); render(r.focus === undefined ? undefined : r.focus); return; }
  var own = false;
  if (S.scope === 'project' && !S.projectOwn) { S.projectOwn = true; own = true; }
  render(r.focus);
  syncTop(); renderFoot();
  announce(r.say || r.op);
  lastUndo = { s: s, op: r.op };
  var acts = [{ label: 'Desfazer', fn: undo }];
  var text = r.op;
  if (own) { text += '. Este projeto agora tem organização própria.'; acts.push({ label: 'Voltar ao global', fn: askReset }); }
  toast({ text: text, actions: acts });
  simulateSave();
}
function askReset() {
  openDialog(btnScope, { text: 'A organização própria deste projeto será descartada e o painel volta a seguir o global.', btns: [
    { label: 'Descartar e voltar ao global', cls: 'danger', go: function () {
      S.data.project = null; S.projectOwn = false; S.scope = 'global'; announce('Voltou ao global.'); render(null); syncTop(); renderFoot(); toast({ text: 'Voltou ao global.' });
    } },
    { label: 'Cancelar' }
  ] });
}

/* ---------- renderização ---------- */
function hl(t) {
  var q = fold(S.q.trim()); if (!q) return esc(t);
  var f = fold(t), i = f.indexOf(q); if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
}
function visItems(g, q) {
  var its = g.items;
  if (S.tab === 'fav') its = its.filter(function (i) { return i.fav; });
  if (S.brokenOnly) its = its.filter(function (i) { return i.inst === false; });
  if (q && fold(g.name).indexOf(q) < 0) its = its.filter(function (i) { return fold(i.name).indexOf(q) >= 0 || (i.ext && fold(i.ext).indexOf(q) >= 0); });
  return its;
}
function gripBtn(kind, id, label, role, picked) {
  return '<button type="button" class="icbtn grip act" data-fid="' + kind + ':' + id + '" data-kb="' + (kind === 'gg' ? 'group' : 'item') + ':' + esc(id) + '" data-kbpick="1" aria-roledescription="' + role + '" aria-describedby="kbhelp" aria-pressed="' + (picked ? 'true' : 'false') + '" aria-label="Alça: mover ' + esc(label) + '" title="Arrastar para mover (ou Espaço)">' + ic('grip-vertical', 'xs') + '</button>';
}
function itemHTML(it, g, org, dragOn) {
  var editing = S.edit && S.edit.type === 'item' && S.edit.id === it.id;
  var broken = it.inst === false;
  var picked = S.kb && S.kb.type === 'item' && S.kb.id === it.id;
  var h = '<li class="item' + (broken ? ' is-broken' : '') + (picked ? ' is-picked' : '') + '" data-iid="' + esc(it.id) + '" data-gid="' + esc(g.id) + '"' + (dragOn && !editing ? ' draggable="true"' : '') + '>';
  if (org && !editing) h += gripBtn('gr', it.id, it.name, 'item reordenável', picked);
  if (editing) {
    var err = S.edit.err, val = S.edit.val != null ? S.edit.val : it.name;
    h += '<div class="rn-wrap"><div class="rn-line"><span class="iico">' + ic(it.icon) + '</span><input class="field" data-edit="item" data-fid="rn" maxlength="100" value="' + esc(val) + '" aria-label="Nome do item"' + (err ? ' aria-invalid="true" aria-describedby="rn-err"' : '') + '></div>' +
      (err ? '<div class="field-err" id="rn-err">' + ic('circle-alert', 'xs') + 'Dê um nome ao item</div>' : '') + '<div class="field-n" data-n' + (val.length >= 80 ? '' : ' hidden') + '>' + val.length + '/100</div></div>';
  } else {
    h += '<button type="button" class="ibtn" data-act="run" data-iid="' + esc(it.id) + '" data-fid="ib:' + esc(it.id) + '"' +
      (org ? ' data-kb="item:' + esc(it.id) + '" data-kbpick="1" aria-describedby="kbhelp"' : '') +
      (broken ? ' aria-label="' + esc(it.name) + ', não instalada"' : '') + ' title="' + esc(it.name) + (broken ? ' (não instalada)' : '') + '">' +
      '<span class="iico"' + (org ? ' data-iconedit="' + esc(it.id) + '" title="Trocar ícone"' : '') + '>' + ic(it.icon) + '</span><span class="iname">' + hl(it.name) + '</span>' +
      (broken ? '<span class="miss">' + ic('circle-dashed', 'xxs') + '<span class="t">Não instalado</span></span>' : '') + '</button>';
    if (org) h += '<button type="button" class="icbtn act kebab" data-act="imenu" data-iid="' + esc(it.id) + '" data-fid="ik:' + esc(it.id) + '" aria-haspopup="menu" aria-label="Ações de ' + esc(it.name) + '">' + ic('ellipsis', 'sm') + '</button>';
    h += '<button type="button" class="icbtn act star" data-act="star" data-iid="' + esc(it.id) + '" data-fid="st:' + esc(it.id) + '" aria-pressed="' + (it.fav ? 'true' : 'false') + '" aria-label="Favorito: ' + esc(it.name) + '" title="' + (it.fav ? 'Remover dos favoritos' : 'Favoritar') + '">' + ic('star', 'sm') + '</button>';
  }
  return h + '</li>';
}
function groupHTML(g, vis, filtered, q, org, dragOn) {
  var col = S.collapsed[g.id] && !q && !S.brokenOnly;
  var editing = S.edit && S.edit.type === 'group' && S.edit.id === g.id;
  var confirming = S.confirmDel === g.id;
  var picked = S.kb && S.kb.type === 'group' && S.kb.id === g.id;
  var cnt = filtered ? vis.length + ' de ' + g.items.length : String(g.items.length);
  var head = '';
  if (confirming) {
    head = '<div class="confirm" role="group" aria-label="Confirmar exclusão"><span>Excluir “' + esc(g.name) + '” e seus ' + g.items.length + ' itens? Extensões voltam à bandeja.</span><div class="acts"><button type="button" class="btn danger" data-act="del-ok" data-gid="' + esc(g.id) + '">Excluir</button><button type="button" class="btn" data-act="del-cancel" data-gid="' + esc(g.id) + '" data-fid="dc:' + esc(g.id) + '">Cancelar</button></div></div>';
  } else {
    if (org && !editing) head += gripBtn('gg', g.id, g.name, 'grupo reordenável', picked);
    if (editing) {
      var err = S.edit.err, val = S.edit.val != null ? S.edit.val : g.name;
      head += '<div class="rn-wrap"><div class="rn-line"><span class="chip">' + ic(g.icon, 'sm') + '</span><input class="field" data-edit="group" data-fid="rn" maxlength="100" value="' + esc(val) + '" aria-label="Nome do grupo"' + (err ? ' aria-invalid="true" aria-describedby="rn-err"' : '') + '></div>' +
        (err ? '<div class="field-err" id="rn-err">' + ic('circle-alert', 'xs') + 'Dê um nome ao grupo</div>' : '') + '<div class="field-n" data-n' + (val.length >= 80 ? '' : ' hidden') + '>' + val.length + '/100</div></div>';
    } else {
      head += '<button type="button" class="gtoggle" data-act="toggle" data-gid="' + esc(g.id) + '" data-fid="gt:' + esc(g.id) + '" data-kb="group:' + esc(g.id) + '" aria-expanded="' + (col ? 'false' : 'true') + '" aria-controls="p-' + esc(g.id) + '">' +
        '<span class="chev">' + ic('chevron-down', 'xs') + '</span><span class="chip"' + (org ? ' data-style="' + esc(g.id) + '" title="Cor e ícone"' : '') + '>' + ic(g.icon, 'sm') + '</span>' +
        '<span class="gname" title="' + esc(g.name) + '">' + hl(g.name) + '</span>' +
        (globalPinned(g) ? '<span class="pinbadge" role="img" aria-label="Fixado na barra de atividades" title="Fixado na barra de atividades com o ícone deste grupo. Vale para todos os projetos; o ícone da barra abre este grupo e recolhe os outros.">' + ic('pin', 'xxs') + '</span>' : '') +
        '<span class="count" aria-label="' + esc(cnt) + ' itens">' + esc(cnt) + '</span></button>' +
        '<button type="button" class="icbtn act kebab" data-act="gmenu" data-gid="' + esc(g.id) + '" data-fid="gk:' + esc(g.id) + '" aria-haspopup="menu" aria-label="Ações do grupo ' + esc(g.name) + '">' + ic('ellipsis', 'sm') + '</button>';
    }
  }
  var body;
  if (!vis.length && !filtered) {
    body = '<li class="empty"><span>Vazio. Arraste uma extensão aqui ou use</span><button type="button" class="lk" data-act="gadd" data-gid="' + esc(g.id) + '" data-fid="ga:' + esc(g.id) + '" aria-haspopup="menu">Adicionar item</button></li>';
  } else body = vis.map(function (it) { return itemHTML(it, g, org, dragOn); }).join('');
  return '<section class="group grp ' + esc(g.color) + (col ? ' is-collapsed' : '') + (picked ? ' is-picked' : '') + '" data-gid="' + esc(g.id) + '" aria-label="' + esc(g.name) + '">' +
    '<div class="ghead"' + (dragOn && !editing && !confirming ? ' draggable="true"' : '') + '>' + head + '</div>' +
    '<div class="panel" id="p-' + esc(g.id) + '"><div><ul class="items" data-gid="' + esc(g.id) + '" aria-label="Itens de ' + esc(g.name) + '">' + body + '</ul></div></div></section>';
}
function trayHTML(un, q, forceOpen) {
  var list = un;
  if (q) list = un.filter(function (e) { return fold(e.name).indexOf(q) >= 0; });
  var tq = fold(S.trayQ.trim());
  if (tq) list = list.filter(function (e) { return fold(e.name).indexOf(tq) >= 0; });
  var collapsed = S.trayCollapsed === null ? (un.length === 0) : S.trayCollapsed;
  if (forceOpen && un.length) collapsed = false;
  var dragOn = app.classList.contains('is-drag-on');
  var h = '<section class="tray grp g-10' + (collapsed ? ' is-collapsed' : '') + '" aria-label="Não agrupadas" id="tray"><div class="tray-h"><button type="button" class="tt" data-act="tray-toggle" data-fid="tt" aria-expanded="' + (collapsed ? 'false' : 'true') + '"><span class="chev">' + ic('chevron-down', 'xs') + '</span><span>Não agrupadas</span><span class="ncount">' + un.length + '</span></button></div><div class="tray-body">';
  if (!un.length) h += '<p class="tray-ok">' + ic('check', 'sm') + 'Tudo agrupado.</p>';
  else {
    if (un.length > 8) h += '<input class="tray-filter" data-fid="tf" id="trayQ" type="search" placeholder="Filtrar não agrupadas…" aria-label="Filtrar não agrupadas" value="' + esc(S.trayQ) + '">';
    h += '<ul class="tray-list" aria-label="Extensões não agrupadas">';
    if (!list.length) h += '<li class="tray-ok">Nada encontrado.</li>';
    h += list.map(function (e) {
      return '<li class="item tray-item" data-ext="' + esc(e.id) + '"' + (dragOn ? ' draggable="true"' : '') + '><span class="ibtn" title="' + esc(e.name) + '"><span class="iico">' + ic(e.icon) + '</span><span class="iname">' + hl(e.name) + '</span></span>' +
        '<button type="button" class="add" data-act="addto" data-ext="' + esc(e.id) + '" data-fid="ad:' + esc(e.id) + '" aria-haspopup="menu" aria-label="Adicionar ' + esc(e.name) + ' a um grupo" title="Adicionar a…">' + ic('plus', 'xs') + '<span class="t">Adicionar a…</span></button></li>';
    }).join('') + '</ul>';
  }
  return h + '</div></section>';
}
function zoneHTML() {
  return '<button type="button" class="newzone" data-act="newgroup" data-fid="nz"><span class="when-idle">' + ic('plus', 'sm') + 'Novo grupo</span><span class="when-drag">' + ic('plus', 'sm') + 'Solte aqui para criar um grupo</span></button>';
}
function illustration() {
  return '<svg class="ill" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="8" width="36" height="10" rx="3"/><rect x="14" y="22" width="28" height="8" rx="3"/><rect x="14" y="34" width="28" height="8" rx="3"/><path d="M8 24v14"/></svg>';
}
function tipsHTML(withClose) {
  return '<div class="tips">' + (withClose ? '<button type="button" class="x" data-act="dismiss-hint" aria-label="Dispensar dica">' + ic('x', 'xs') + '</button>' : '') +
    '<span><b>Arraste</b> uma extensão para um grupo.</span><span>Ou use <b>⋯ &gt; Mover para…</b> (teclado: Espaço e setas).</span><span>Tudo é salvo sozinho e dá para <b>Desfazer</b>.</span></div>';
}
function skeleton() {
  var h = '';
  for (var i = 0; i < 3; i++) h += '<div class="sk"></div><div class="sk s"></div><div class="sk s"></div>';
  return h;
}
function build() {
  var d = cur(), un = unassigned(), org = S.mode === 'org', noG = !d.groups.length;
  var allEmpty = !noG && d.groups.every(function (g) { return !g.items.length; });
  var q = fold(S.q.trim());
  var dragOn = org || noG || allEmpty;
  app.classList.toggle('is-drag-on', dragOn);
  scrollEl.setAttribute('aria-busy', S.loading ? 'true' : 'false');
  if (S.loading) return skeleton();
  var h = '';
  if (S.errBanner) h += '<div class="errbar" role="alert"><div class="t">' + ic('circle-alert', 'sm') + '<span>Não foi possível salvar: sem permissão para gravar em groupedTools.groups. Suas alterações continuam aqui como rascunho.</span></div><div class="acts"><button type="button" class="btn" data-act="retry" data-fid="rt">Tentar de novo</button><button type="button" class="btn danger" data-act="discard">Descartar alterações</button></div></div>';
  if (S.notice) h += '<div class="infobar" role="status">' + ic('info', 'sm') + '<span class="txt">' + esc(S.notice) + '</span><button type="button" class="btn" data-act="dismiss-notice" data-fid="nt">Entendi</button></div>';
  if (S.readOnly) h += '<div class="infobar">' + ic('info', 'sm') + '<span class="txt">Há configuração por pasta; ajuste no Settings. Aqui só leitura.</span><button type="button" class="btn" data-act="settings">Abrir Settings</button></div>';
  if (noG) {
    if (!S.welcomeDone) {
      h += '<section class="empty-state" aria-labelledby="wt">' + illustration() + '<h2 id="wt">Organize suas extensões em grupos.</h2><p>Crie grupos por assunto e chegue a cada ferramenta em um clique.</p><div class="acts"><button type="button" class="btn primary" data-act="suggest" data-fid="sg">Criar grupos sugeridos</button><button type="button" class="btn" data-act="zero">Começar do zero</button></div></section>' + tipsHTML(false);
    } else {
      h += '<section class="empty-state" aria-labelledby="wt">' + illustration() + '<h2 id="wt">Nenhum grupo ainda</h2><p>Comece com um grupo vazio e arraste extensões para ele.</p><div class="acts"><button type="button" class="btn primary" data-act="newgroup" data-fid="cf">Criar primeiro grupo</button><button type="button" class="btn link" data-act="suggest">Usar grupos sugeridos</button></div></section>';
    }
    return h + zoneHTML() + trayHTML(un, '', true);
  }
  var broken = allItems().filter(function (i) { return i.inst === false; }).length;
  var showTray = S.tab === 'all' && (org || allEmpty || (S.searchTray && !!q));
  var al = '';
  if (broken && !S.dismissed.broken) al += '<div class="alert">' + ic('circle-alert', 'sm') + '<span class="txt">' + pl(broken, 'item quebrado', 'itens quebrados') + '</span><button type="button" class="lk" data-act="show-broken" data-fid="al1">' + (S.brokenOnly ? 'Mostrar todos' : 'Ver') + '</button><button type="button" class="x" data-act="dismiss-broken" aria-label="Dispensar aviso de itens quebrados">' + ic('x', 'xs') + '</button></div>';
  if (un.length && !S.dismissed.un && !showTray && S.tab === 'all') al += '<div class="alert">' + ic('info', 'sm') + '<span class="txt">' + pl(un.length, 'extensão fora de grupos', 'extensões fora de grupos') + '</span><button type="button" class="lk" data-act="show-tray" data-fid="al2">Ver</button><button type="button" class="x" data-act="dismiss-un" aria-label="Dispensar aviso de extensões fora de grupos">' + ic('x', 'xs') + '</button></div>';
  if (al) h += '<div class="alerts">' + al + '</div>';
  if (allEmpty && !S.dismissed.hint && !q) h += '<div class="tips" style="margin:0 0 8px"><button type="button" class="x" data-act="dismiss-hint" aria-label="Dispensar dica">' + ic('x', 'xs') + '</button><span><b>Todos os grupos estão vazios.</b> Arraste uma extensão da bandeja para um grupo, ou use <b>⋯ &gt; Mover para…</b>.</span>' + (org ? '' : '<span><button type="button" class="btn" data-act="enter-org" data-fid="eo">Organizar</button></span>') + '</div>';
  var filtered = !!q || S.tab === 'fav' || S.brokenOnly, gl = '', total = 0;
  d.groups.forEach(function (g) {
    var vis = visItems(g, q);
    if (filtered && !vis.length) return;
    total += vis.length; gl += groupHTML(g, vis, filtered, q, org, dragOn);
  });
  S.resCount = total;
  if (!gl) {
    var trayHits = q ? un.filter(function (e) { return fold(e.name).indexOf(q) >= 0; }).length : 0;
    if (q) h += '<section class="empty-state small">' + ic('search-x', 'ill') + '<h2>Nada para “' + esc(S.q.trim()) + '”</h2><div class="acts"><button type="button" class="btn" data-act="clear-q" data-fid="cq">Limpar busca</button>' + (trayHits ? '<button type="button" class="btn link" data-act="search-tray">Procurar também nas não agrupadas (' + trayHits + ')</button>' : '') + '</div></section>';
    else if (S.brokenOnly) h += '<section class="empty-state small">' + ic('check', 'ill') + '<h2>Nenhum item quebrado</h2><div class="acts"><button type="button" class="btn" data-act="show-broken">Mostrar todos</button></div></section>';
    else h += '<section class="empty-state small">' + ic('star', 'ill') + '<h2>Sem favoritos</h2><p>Toque na estrela de um item para fixá-lo aqui.</p></section>';
  } else h += '<div class="groups" id="groups">' + gl + '</div>';
  if (dragOn && !q && S.tab === 'all') h += zoneHTML();
  if (showTray) h += trayHTML(un, S.searchTray ? q : '', false);
  return h;
}
function render(focusFid) {
  var act = document.activeElement, fid = focusFid, hadFocus = false;
  if (fid === undefined && act && scrollEl.contains(act)) { hadFocus = true; if (act.dataset && act.dataset.fid) fid = act.dataset.fid; }
  var st = scrollEl.scrollTop;
  rendering = true;
  scrollEl.innerHTML = build();
  scrollEl.scrollTop = st;
  var inp = S.edit ? $('[data-edit]', scrollEl) : null;
  if (inp) {
    inp.focus();
    if (S.edit.sel) { inp.select(); S.edit.sel = false; } else inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.scrollIntoView({ block: 'nearest' });
  } else if (fid) {
    var el = $('[data-fid="' + cssq(fid) + '"]', app);
    if (el) { el.focus(); if (el.tagName === 'INPUT') el.setSelectionRange(el.value.length, el.value.length); }
    else if (hadFocus || focusFid) scrollEl.focus({ preventScroll: true });
  }
  rendering = false;
}
function renderFoot() {
  var d = cur(), n = allItems().length;
  var sum = pl(n, 'item', 'itens') + ' · ' + pl(d.groups.length, 'grupo', 'grupos') + ' · ' + pl(unassigned().length, 'não agrupada', 'não agrupadas');
  var st = '';
  if (S.save === 'saving') st = '<span class="st" title="Salvando…">' + ic('loader', 'xs') + '<span class="tt">Salvando…</span></span>';
  else if (S.save === 'saved') st = '<span class="st" title="Salvo em ' + scopeName() + '">' + ic('check', 'xs') + '<span class="tt">Salvo em ' + scopeName() + '</span></span>';
  else if (S.save === 'error') st = '<span class="st err" title="Erro ao salvar">' + ic('circle-alert', 'xs') + '<span class="tt">Erro ao salvar</span></span>';
  footEl.innerHTML = '<span class="sum" title="' + esc(sum) + '">' + esc(sum) + '</span>' + st + '<button type="button" class="icbtn" data-act="settings" aria-label="Abrir Settings" title="Abrir Settings">' + ic('settings', 'sm') + '</button>';
}
function syncTop() {
  var org = S.mode === 'org', q = S.q.trim();
  var dis = !!q || S.tab === 'fav' || S.readOnly || S.loading;
  btnOrg.disabled = dis;
  btnOrg.setAttribute('aria-pressed', org ? 'true' : 'false');
  btnOrg.innerHTML = ic(org ? 'check' : 'sliders-horizontal', 'sm') + '<span class="lbl">' + (org ? 'Concluir' : 'Organizar') + '</span>';
  btnOrg.setAttribute('aria-label', org ? 'Concluir organização' : 'Organizar');
  btnOrg.title = q ? 'Limpe a busca para organizar (evita reordenar uma lista filtrada).' : S.tab === 'fav' ? 'Organizar fica disponível na aba Todas.' : S.readOnly ? 'Configuração por pasta: somente leitura. Ajuste no Settings.' : org ? 'Concluir organização' : 'Organizar: arrastar, renomear, cor e ícone';
  $('#segAll').setAttribute('aria-pressed', S.tab === 'all' ? 'true' : 'false');
  $('#segFav').setAttribute('aria-pressed', S.tab === 'fav' ? 'true' : 'false');
  btnScope.innerHTML = ic(S.scope === 'global' ? 'globe' : 'folder', 'xs') + '<span class="lbl">' + scopeName() + '</span><span class="chev">' + ic('chevron-down', 'xs') + '</span>';
  btnScope.setAttribute('aria-label', 'Escopo: ' + scopeName());
  btnScope.title = 'Escopo: ' + scopeName() + (S.scope === 'project' ? '. Itens fixados na barra de atividades valem para todos os projetos; edite no escopo Global.' : '. Itens fixados na barra de atividades são definidos aqui.');
  app.classList.toggle('is-org', org);
  $('#qClear').hidden = !S.q;
  var gs = cur().groups, allCol = gs.length > 0 && gs.every(function (g) { return S.collapsed[g.id]; });
  var fl = allCol ? 'Expandir todos' : 'Recolher todos';
  btnFold.innerHTML = ic(allCol ? 'chevrons-up-down' : 'chevrons-down-up', 'sm') + '<span class="lbl">' + (allCol ? 'Expandir' : 'Recolher') + '</span>';
  btnFold.disabled = !gs.length || !!q;
  btnFold.setAttribute('aria-label', fl);
  btnFold.title = !gs.length ? 'Não há grupos' : q ? 'Indisponível durante a busca' : fl + ' (Alt+Shift+C)';
  renderAct();
}

/* ---------- Activity Bar simulada ---------- */
function actBtn(id, inner, title, on) {
  return '<button type="button" class="vact" data-a="' + id + '" title="' + esc(title) + '" aria-label="' + esc(title) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + inner + '</button>';
}
function renderAct() {
  var host = $('#vscAct'); if (!host) return;
  var pins = pinnedGroups();
  if (/^pin:/.test(S.act) && !pins.some(function (g) { return 'pin:' + g.id === S.act; })) S.act = 'tools';
  /* capacidade vertical: o que não cabe vai para o "…" (como o VS Code faz) */
  var room = Math.floor((host.clientHeight - 8 - 48) / 48) - 5, shown = pins, hidden = [];
  if (pins.length > room) { var keep = Math.max(0, room - 1); shown = pins.slice(0, keep); hidden = pins.slice(keep); }
  var h = actBtn('explorer', ic('files'), 'Explorador', S.act === 'explorer') + actBtn('search', ic('search'), 'Pesquisar', S.act === 'search') +
    actBtn('scm', ic('git-branch'), 'Controle do Código-Fonte', S.act === 'scm') + actBtn('ext', ic('puzzle'), 'Extensões', S.act === 'ext') +
    actBtn('tools', ic('blocks'), 'Ferramentas agrupadas', S.act === 'tools');
  shown.forEach(function (g) {
    h += actBtn('pin:' + g.id, ic(g.icon), 'Ferramentas · ' + pinName(g.icon), S.act === 'pin:' + g.id);
  });
  if (hidden.length) {
    var hOn = hidden.some(function (g) { return 'pin:' + g.id === S.act; });
    h += '<button type="button" class="vact" data-a="more" data-fid="actmore" aria-haspopup="menu" title="Mais itens (' + hidden.length + ' ocultos)" aria-label="Mais itens (' + hidden.length + ' ocultos)" aria-pressed="' + (hOn ? 'true' : 'false') + '">' + ic('ellipsis') + '</button>';
  }
  h += '<span class="gap"></span>' + actBtn('gear', ic('settings'), 'Gerenciar', false);
  var focusA = document.activeElement && host.contains(document.activeElement) ? document.activeElement.dataset.a : null;
  host.innerHTML = h;
  host._hidden = hidden;
  if (focusA) { var el = $('[data-a="' + cssq(focusA) + '"]', host); if (el) el.focus(); }
  var side = $('#vscSide'), away = !(S.act === 'tools' || /^pin:/.test(S.act));
  side.classList.toggle('away', away);
  renderStatus();
  var tit = { explorer: 'Explorador', search: 'Pesquisar', scm: 'Controle do Código-Fonte', ext: 'Extensões' }[S.act];
  $('#vscTitle').textContent = tit || 'Ferramentas agrupadas';
}
/* ---------- Barra de status simulada + card de hover nativo (MarkdownString) ---------- */
/* Na barra de status só existem codicons ($(nome)); Lucide não é possível. Aproximação por ícone do catálogo. */
var CODICON = { 'sparkles': 'sparkle', 'bot': 'hubot', 'git-branch': 'git-branch', 'git-pull-request': 'git-pull-request', 'database': 'database', 'server': 'server',
  'container': 'package', 'box': 'package', 'cloud': 'cloud', 'terminal': 'terminal', 'code': 'code', 'folder': 'folder', 'kanban': 'project', 'workflow': 'type-hierarchy',
  'flask-conical': 'beaker', 'bug': 'bug', 'shield': 'shield', 'rocket': 'rocket', 'puzzle': 'extensions', 'settings': 'settings-gear', 'wrench': 'tools', 'package': 'package',
  'layers': 'layers', 'palette': 'symbol-color', 'notebook-pen': 'notebook', 'calendar': 'calendar', 'headphones': 'unmute', 'mail': 'mail', 'message-square': 'comment',
  'chart-bar': 'graph', 'globe': 'globe', 'network': 'remote', 'cpu': 'chip', 'brain': 'lightbulb', 'key': 'key', 'star': 'star-full', 'heart': 'heart', 'bookmark': 'bookmark',
  'zap': 'zap', 'flame': 'flame' };
var MAX_ROWS = 15, hv = { t: null, h: null, gid: null, anchor: null };
var frameEl = $('#vscFrame'), sbar = $('#sbar'), hvEl = $('#sbHover');
function extHue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function extIconHTML(it) {
  var key = it.ext || it.id;
  if (it.cmd || extHue(key) % 3 === 0) return '<span class="xi gen">' + ic('puzzle', 'xxs') + '</span>'; /* sem package.json.icon: ícone genérico */
  return '<span class="xi" style="background:hsl(' + extHue(key) + ',45%,38%)">' + esc(it.name.charAt(0).toUpperCase()) + '</span>'; /* simula a imagem do package.json */
}
function statusItems() {
  return pinnedGroups().map(function (g) { return { g: g, c: g.items.length }; });
}
function renderStatus() {
  if (!sbar) return;
  var list = statusItems();
  var h = '<div class="sb-l" id="sbL">' + list.map(function (o) {
    var gl = CODICON[o.g.icon] || 'folder';
    return '<button type="button" class="sbi" data-sg="' + esc(o.g.id) + '" aria-label="' + esc(o.g.name) + ', ' + pl(o.c, 'extensão', 'extensões') + '. Grupo fixado; Enter abre o grupo." aria-haspopup="true">' +
      ic(o.g.icon) + '<span>' + esc(o.g.name) + ' (' + o.c + ')</span></button>';
  }).join('') + '</div><div class="sb-r"><span class="sbi static">Ln 42, Col 8</span><span class="sbi static">UTF-8</span><span class="sbi static">{ } TypeScript</span></div>';
  var f = document.activeElement && sbar.contains(document.activeElement) ? document.activeElement.dataset.sg : null;
  sbar.innerHTML = h;
  if (f) { var el = $('[data-sg="' + cssq(f) + '"]', sbar); if (el) el.focus(); }
  /* excedente é cortado (como o VS Code); contagem só para o protótipo */
  var L = $('#sbL'), cut = 0;
  $$('.sbi', L).forEach(function (b) { var r = b.getBoundingClientRect(), lr = L.getBoundingClientRect(); if (r.right > lr.right + 1) { b.style.visibility = 'hidden'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); cut++; } });
  var note = $('#sbCut');
  if (!note) { note = document.createElement('p'); note.id = 'sbCut'; note.className = 'sb-cut'; frameEl.parentNode.appendChild(note); }
  var gl2 = list.length ? 'Glifo simulado: na barra de status real o ícone é um codicon (ex.: $(' + (CODICON[list[0].g.icon] || 'folder') + ') para “' + pinName(list[0].g.icon) + '”), não o Lucide.' : 'Nenhum grupo fixado: nenhum item na barra de status.';
  note.textContent = gl2 + (cut ? ' ' + pl(cut, 'item cortado', 'itens cortados') + ' por falta de largura (o VS Code real corta o excedente; o usuário oculta itens pelo menu de contexto da barra).' : '');
  if (hv.gid && !$('[data-sg="' + cssq(hv.gid) + '"]', sbar)) hideHover(true);
}
function hoverHTML(g) {
  var its = g.items, rows = its.slice(0, MAX_ROWS), rest = its.length - rows.length;
  var h = '<h4>' + esc(g.name) + ' <span class="nin" style="padding:0;font-weight:400">· ' + pl(its.length, 'extensão', 'extensões') + '</span></h4>';
  if (!its.length) h += '<div class="dim">Grupo vazio.</div>';
  else h += '<table role="presentation">' + rows.map(function (it) {
    var off = it.inst === false;
    return '<tr' + (off ? ' class="dim"' : '') + '><td class="i">' + extIconHTML(it) + '</td><td><button type="button" class="lnk" data-hl="' + esc(it.id) + '" tabindex="-1" title="command:' + (it.cmd ? 'workbench.action.showCommands' : 'workbench.view.extension.' + esc(it.ext)) + '">' + esc(it.name) + '</button>' + (off ? '<span class="nin">Não instalado</span>' : '') + '</td></tr>';
  }).join('') + '</table>';
  if (rest > 0) h += '<div class="more"><span class="dim">+' + rest + ' ' + (rest === 1 ? 'extensão' : 'extensões') + '</span> · <button type="button" class="lnk" data-hl="all" tabindex="-1">Ver todas</button></div>';
  h += '<hr><div class="foot"><button type="button" class="lnk" data-hl="open" tabindex="-1">Abrir no Ferramentas</button><span aria-hidden="true">|</span><button type="button" class="lnk" data-hl="manage" tabindex="-1">Gerenciar grupo</button></div>';
  return h;
}
function showHover(btn, byKey) {
  var g = pinnedGroups().filter(function (x) { return x.id === btn.dataset.sg; })[0]; if (!g) return;
  clearTimeout(hv.t); clearTimeout(hv.h);
  if (hv.gid === g.id && !hvEl.hidden) return;
  hv.gid = g.id; hv.anchor = btn;
  hvEl.innerHTML = hoverHTML(g);
  hvEl.hidden = false;
  hvEl.setAttribute('role', 'tooltip'); hvEl.id = 'sbHoverCard';
  $$('.sbi.hot', sbar).forEach(function (b) { b.classList.remove('hot'); }); btn.classList.add('hot');
  btn.setAttribute('aria-describedby', 'sbHoverCard');
  var fr = frameEl.getBoundingClientRect(), br = btn.getBoundingClientRect();
  var left = Math.max(4, Math.min(br.left - fr.left, fr.width - hvEl.offsetWidth - 4));
  hvEl.style.left = left + 'px'; hvEl.style.top = (br.top - fr.top - hvEl.offsetHeight - 2) + 'px';
  if (byKey) announce(g.name + ': ' + pl(g.items.length, 'extensão', 'extensões') + '. Seta para cima navega pelos links; Esc fecha.');
}
function hideHover(now) {
  clearTimeout(hv.t); clearTimeout(hv.h);
  var go = function () { hvEl.hidden = true; $$('.sbi.hot', sbar).forEach(function (b) { b.classList.remove('hot'); b.removeAttribute('aria-describedby'); }); hv.gid = null; hv.anchor = null; };
  if (now) go(); else hv.h = setTimeout(go, 300);
}
sbar.addEventListener('pointerover', function (e) { var b = e.target.closest('[data-sg]'); if (!b) return; clearTimeout(hv.h); clearTimeout(hv.t); hv.t = setTimeout(function () { showHover(b, false); }, 300); });
sbar.addEventListener('pointerout', function (e) { if (e.target.closest('[data-sg]')) { clearTimeout(hv.t); hideHover(false); } });
hvEl.addEventListener('pointerenter', function () { clearTimeout(hv.h); });
hvEl.addEventListener('pointerleave', function () { hideHover(false); });
sbar.addEventListener('focusin', function (e) { var b = e.target.closest('[data-sg]'); if (b) showHover(b, true); });
sbar.addEventListener('focusout', function (e) { if (!hvEl.contains(e.relatedTarget)) hideHover(false); });
hvEl.addEventListener('focusout', function (e) { if (!hvEl.contains(e.relatedTarget) && !(hv.anchor && hv.anchor === e.relatedTarget)) hideHover(false); });
sbar.addEventListener('click', function (e) { var b = e.target.closest('[data-sg]'); if (b) { hideHover(true); openPin(b.dataset.sg); } });
sbar.addEventListener('keydown', function (e) {
  var b = e.target.closest('[data-sg]'); if (!b) return;
  if (e.key === 'Escape' && !hvEl.hidden) { e.preventDefault(); hideHover(true); }
  else if (e.key === 'ArrowUp' && !hvEl.hidden) { e.preventDefault(); var f = $('.lnk', hvEl); if (f) { f.tabIndex = 0; f.focus(); } }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    var vis = $$('.sbi[data-sg]', sbar).filter(function (x) { return x.style.visibility !== 'hidden'; }), i = vis.indexOf(b), n = vis[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (n) { e.preventDefault(); n.focus(); }
  }
});
hvEl.addEventListener('keydown', function (e) {
  var ls = $$('.lnk', hvEl), i = ls.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); var a = hv.anchor; hideHover(true); if (a) a.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = ls[(i + (e.key === 'ArrowDown' ? 1 : -1) + ls.length) % ls.length]; ls.forEach(function (x) { x.tabIndex = -1; }); n.tabIndex = 0; n.focus(); }
});
hvEl.addEventListener('click', function (e) {
  var b = e.target.closest('[data-hl]'); if (!b) return;
  var k = b.dataset.hl, gid = hv.gid, g = pinnedGroups().filter(function (x) { return x.id === gid; })[0];
  hideHover(true);
  if (k === 'open' || k === 'all') { openPin(gid); }
  else if (k === 'manage') { openPin(gid); S.mode = 'org'; fullRender(null); announce('Modo Organizar ativado para gerenciar o grupo ' + (g ? g.name : '') + '.'); }
  else { var it = g && g.items.filter(function (x) { return x.id === k; })[0]; if (it) { toast({ kind: 'info', text: 'Abriria o painel de ' + it.name + ' (command: link, simulado).' }); announce('Abrindo ' + it.name); } }
});
function reducedMotion() { return window.matchMedia('(prefers-reduced-motion:reduce)').matches || document.documentElement.classList.contains('pv-reduce'); }
function openPin(gid) {
  var g = gById(gid), og = S.data.global.groups.filter(function (x) { return x.id === gid; })[0];
  if (!g) {
    /* escopo "Este projeto" sem o grupo fixado (fixados vêm da configuração global) */
    S.act = 'pin:' + gid; S.notice = 'Este grupo não existe neste projeto.';
    fullRender(null);
    announce('Este grupo não existe neste projeto' + (og ? ': ' + og.name : '') + '.');
    return;
  }
  if (!S.prevCollapsed) S.prevCollapsed = clone(S.collapsed);
  S.notice = null;
  S.act = 'pin:' + gid; S.tab = 'all'; S.q = ''; qEl.value = ''; S.brokenOnly = false; S.searchTray = false; S.edit = null; S.confirmDel = null;
  S.collapsed = {}; cur().groups.forEach(function (x) { S.collapsed[x.id] = x.id !== g.id; });
  fullRender(null);
  var sec = $('.group[data-gid="' + cssq(g.id) + '"]', scrollEl);
  if (sec) {
    scrollEl.scrollTo({ top: Math.max(0, sec.offsetTop - scrollEl.offsetTop - 4), behavior: reducedMotion() ? 'auto' : 'smooth' });
    sec.classList.add('pin-flash'); setTimeout(function () { sec.classList.remove('pin-flash'); }, 1600);
    var tg = $('.gtoggle', sec); if (tg) tg.focus({ preventScroll: true });
  }
  announce('Ferramentas · ' + pinName(g.icon) + ': grupo ' + g.name + ' aberto; os outros grupos estão recolhidos.');
}
function openTools() {
  var had = !!S.prevCollapsed;
  S.act = 'tools'; S.notice = null;
  if (had) { S.collapsed = S.prevCollapsed; S.prevCollapsed = null; }
  fullRender(null);
  announce(had ? 'Ferramentas agrupadas. Recolhimento anterior restaurado.' : 'Ferramentas agrupadas.');
}
$('#vscAct').addEventListener('click', function (e) {
  var b = e.target.closest('[data-a]'); if (!b) return;
  var a = b.dataset.a;
  if (a !== 'more') closePop(false);
  if (a === 'tools') openTools();
  else if (/^pin:/.test(a)) openPin(a.slice(4));
  else if (a === 'more') {
    var hid = $('#vscAct')._hidden || [];
    openMenu(b, hid.map(function (g) { return { label: 'Ferramentas · ' + pinName(g.icon), ic: g.icon, go: function () { openPin(g.id); } }; }), { label: 'Itens ocultos da barra de atividades' });
  }
  else if (a === 'gear') { toast({ kind: 'info', text: 'Menu Gerenciar (simulado).' }); }
  else { S.act = a; renderAct(); announce(b.title); }
});
function toggleAll() {
  if (btnFold.disabled) return;
  var gs = cur().groups, allCol = gs.every(function (g) { return S.collapsed[g.id]; });
  gs.forEach(function (g) { S.collapsed[g.id] = !allCol; });
  fullRender(undefined);
  announce(allCol ? 'Todos os grupos expandidos.' : 'Todos os grupos recolhidos.');
}
btnFold.addEventListener('click', toggleAll);
var EXTRA_IDS = { 'g-debug': 1, 'g-sec': 1, 'g-deploy': 1, 'g-comm': 1, 'g-metrics': 1 };
function extraGroups() {
  return [['g-debug', 'Depuração e testes', 'bug', 'g-4'], ['g-sec', 'Segurança', 'shield', 'g-7'], ['g-deploy', 'Deploy', 'rocket', 'g-6'], ['g-comm', 'Comunicação', 'message-square', 'g-1'], ['g-metrics', 'Métricas', 'chart-bar', 'g-8']]
    .map(function (x) { return { id: x[0], name: x[1], icon: x[2], color: x[3], items: [] }; });
}
function makeProject() {
  var p = clone(S.data.global); p.groups.forEach(function (g) { delete g.pinned; });
  if (S.projMissing) { var first = S.data.global.groups.filter(function (g) { return g.pinned; })[0]; if (first) p.groups = p.groups.filter(function (g) { return g.id !== first.id; }); }
  return p;
}
/* fixa os N primeiros grupos com ícone do catálogo e sem repetir ícone */
function pinFirst(gs, n) {
  var seen = {}, c = 0;
  gs.forEach(function (g) { if (c < n && inCat(g.icon) && !seen[g.icon]) { g.pinned = true; seen[g.icon] = 1; c++; } else delete g.pinned; });
}
function withExtras(gs, n) {
  if (!gs.length || n <= 7) return gs;
  var have = {}; gs.forEach(function (g) { have[g.id] = 1; });
  return gs.concat(extraGroups().filter(function (g) { return !have[g.id]; }));
}
function setPinCount(n) {
  S.scope = 'global'; S.data.project = null; S.projectOwn = false; S.notice = null;
  var gs = S.data.global.groups.filter(function (g) { return !EXTRA_IDS[g.id] || g.items.length; });
  gs = withExtras(gs, n); pinFirst(gs, n); S.data.global.groups = gs;
  lastSaved = snap(); fullRender(null);
  announce(n ? pl(n, 'grupo fixado', 'grupos fixados') + ' na barra de atividades.' : 'Nenhum grupo fixado.');
}
function fullRender(focus) { render(focus); syncTop(); renderFoot(); }

/* ---------- popovers e menus ---------- */
var pop = null;
function placePop(node, anchor) {
  var pr = app.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
  var w = node.offsetWidth, h = node.offsetHeight;
  var left = ar.left - pr.left, top = ar.bottom - pr.top + 4;
  left = Math.max(8, Math.min(left, pr.width - w - 8));
  if (top + h > pr.height - 8) { var up = ar.top - pr.top - h - 4; top = up > 8 ? up : Math.max(8, pr.height - h - 8); }
  node.style.left = left + 'px'; node.style.top = top + 'px';
}
function openPop(anchor, node, onClose) {
  closePop(false);
  overlay.appendChild(node);
  pop = { node: node, anchor: anchor, fid: anchor && anchor.dataset ? anchor.dataset.fid : null, onClose: onClose };
  placePop(node, anchor);
  return pop;
}
function closePop(refocus) {
  if (!pop) return;
  var p = pop; pop = null; p.node.remove(); if (p.onClose) p.onClose();
  if (refocus && p.fid) { var el = $('[data-fid="' + cssq(p.fid) + '"]', app); if (el) el.focus(); }
}
document.addEventListener('pointerdown', function (e) {
  if (pop && !pop.node.contains(e.target) && !(pop.anchor && pop.anchor.contains && pop.anchor.contains(e.target))) closePop(false);
}, true);
scrollEl.addEventListener('scroll', function () { if (pop) closePop(false); });

function openMenu(anchor, items, o) {
  o = o || {};
  if (pop && pop.fid && anchor.dataset.fid && pop.fid === anchor.dataset.fid) { closePop(true); return; }
  var m = document.createElement('div'); m.className = 'pop menu'; m.setAttribute('role', 'menu');
  if (o.label) m.setAttribute('aria-label', o.label);
  function fill(its) {
    m._items = its;
    m.innerHTML = its.map(function (it, i) {
      if (it.sep) return '<div class="sep" role="separator"></div>';
      if (it.head) return '<div class="mh" role="presentation">' + esc(it.head) + '</div>';
      var lead = it.ic ? ic(it.ic, 'sm') : (it.radio ? '<span class="ck">' + (it.checked ? ic('check', 'sm') : '') + '</span>' : '');
      return '<button type="button" role="' + (it.radio ? 'menuitemradio' : 'menuitem') + '"' + (it.radio ? ' aria-checked="' + (it.checked ? 'true' : 'false') + '"' : '') + ' class="' + (it.danger ? 'danger' : '') + '" data-i="' + i + '" tabindex="-1"' + (it.disabled ? ' disabled' : '') + (it.soft ? ' aria-disabled="true"' : '') + '>' + lead +
        '<span class="mi-t"><span>' + esc(it.label) + '</span>' + (it.hint ? '<span class="mi-h">' + esc(it.hint) + '</span>' : '') + '</span></button>';
    }).join('');
    if (pop) placePop(m, anchor);
    var b = $('button:not([disabled])', m); if (b) b.focus();
  }
  m.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    var it = m._items[+b.dataset.i];
    if (it.soft) { announce(it.hint || 'Indisponível.'); return; }
    if (it.sub) { fill(it.sub()); return; }
    closePop(false); if (it.go) it.go();
  });
  m.addEventListener('keydown', function (e) {
    var bs = $$('button:not([disabled])', m), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); bs[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); bs[bs.length - 1].focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); closePop(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(true); }
  });
  openPop(anchor, m);
  fill(items);
}
function openDialog(anchor, o) {
  var n = document.createElement('div'); n.className = 'pop dlg'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', o.title || 'Confirmação');
  n.innerHTML = '<p>' + esc(o.text) + '</p><div class="acts">' + o.btns.map(function (b, i) { return '<button type="button" class="btn ' + (b.cls || '') + '" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div>';
  n.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var def = o.btns[+b.dataset.i]; closePop(!def.go); if (def.go) def.go();
  });
  n.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(true); } });
  openPop(anchor, n);
  var last = n.querySelectorAll('button'); last[last.length - 1].focus();
}

/* seletor de cor e ícone do grupo */
function openStylePop(anchor, gid) {
  var g = gById(gid); if (!g) return;
  var n = document.createElement('div'); n.className = 'pop stylepop grp ' + g.color; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', 'Cor e ícone de ' + g.name);
  function paint() {
    n.className = 'pop stylepop grp ' + g.color;
    n.innerHTML = '<div><div class="pop-t">Cor do grupo</div><div class="swatches" role="radiogroup" aria-label="Cor do grupo">' + COLORS.map(function (c) {
      return '<button type="button" role="radio" class="sw grp ' + c[0] + '" data-c="' + c[0] + '" aria-checked="' + (c[0] === g.color) + '" aria-label="' + c[1] + '" title="' + c[1] + '" tabindex="' + (c[0] === g.color ? 0 : -1) + '">' + ic('check') + '</button>';
    }).join('') + '</div></div><div><div class="pop-t">Ícone</div><button type="button" class="btn" data-ico>' + ic(g.icon, 'sm') + '<span>Ícone: ' + esc(g.icon) + '</span>' + ic('chevron-right', 'xs') + '</button></div>';
  }
  paint();
  function pick(k) {
    if (k === g.color) return;
    commit(function () { g.color = k; return { op: 'Cor de “' + g.name + '”: ' + cname(k), say: 'Cor de ' + g.name + ': ' + cname(k) + ' (selecionada)', focus: null }; });
    paint(); var sw = $('.sw[data-c="' + k + '"]', n); if (sw) sw.focus();
  }
  n.addEventListener('click', function (e) {
    var s = e.target.closest('.sw'); if (s) { pick(s.dataset.c); return; }
    if (e.target.closest('[data-ico]')) { closePop(false); openPicker(anchor, { kind: 'group', id: gid }); }
  });
  n.addEventListener('keydown', function (e) {
    var s = e.target.closest('.sw');
    if (e.key === 'Escape') { e.stopPropagation(); closePop(true); return; }
    if (!s) return;
    var all = $$('.sw', n), i = all.indexOf(s), nx = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nx = all[(i + 1) % all.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nx = all[(i - 1 + all.length) % all.length];
    if (nx) { e.preventDefault(); pick(nx.dataset.c); }
  });
  openPop(anchor, n);
  var f = $('.sw[aria-checked="true"]', n) || $('.sw', n); f.focus();
}
var ICONS = Object.keys(I).filter(function (k) { return !/^(files|loader|chevron-left)$/.test(k) || true; }).sort();
function openPicker(anchor, target) {
  var obj = target.kind === 'group' ? gById(target.id) : (findItem(target.id) || {}).it;
  if (!obj) return;
  var colorCls = target.kind === 'group' ? obj.color : (findItem(target.id).g.color);
  var isGroup = target.kind === 'group', locked = isGroup && (target.pin || globalPinned(obj));
  var base = target.pin ? ICONS.filter(inCat) : ICONS;
  function blocked(k) {
    if (!locked) return '';
    var o = pinOwner(k, obj.id);
    if (o) return 'Em uso por “' + o.name + '” (fixado)';
    if (!target.pin && !inCat(k)) return 'Não fixável: desafixe o grupo para usar este ícone';
    return '';
  }
  var note = target.pin ? 'Escolha um ícone fixável. Ele também passa a ser o ícone do grupo (uma operação só, com Desfazer).' : locked ? 'Este grupo está fixado: só ícones fixáveis e livres. Desafixe para usar outros.' : '';
  var n = document.createElement('div'); n.className = 'pop picker grp ' + colorCls; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', (target.pin ? 'Escolha um ícone fixável para ' : 'Escolher ícone para ') + obj.name);
  n.innerHTML = '<div class="search"><span class="s-ic">' + ic('search', 'sm') + '</span><input type="search" placeholder="Buscar ícone (ex.: git, banco, nuvem)…" aria-label="Buscar ícone" autocomplete="off"></div>' +
    (note ? '<p class="pk-note">' + ic('info', 'xs') + '<span>' + esc(note) + '</span></p>' : '') +
    '<div class="pk-cur">' + ic(obj.icon, 'pk-preview') + '<span>Atual: ' + esc(obj.icon) + '</span></div><div data-rec></div><div class="pk-sec" data-lbl>Todos os ícones</div><div class="pk-grid" role="listbox" aria-label="Ícones" data-grid></div><div data-more></div>';
  var inp = $('input', n), grid = $('[data-grid]', n), more = $('[data-more]', n), rec = $('[data-rec]', n), lbl = $('[data-lbl]', n);
  var shown = 60, query = '';
  function matches() {
    var f = fold(query.trim()); if (!f) return base;
    var toks = f.split(/\s+/);
    return base.filter(function (k) { var hay = fold(k.replace(/-/g, ' ') + ' ' + (T[k] || '') + ' ' + (PT[k] || '')); return toks.every(function (t) { return hay.indexOf(t) >= 0; }); });
  }
  function cell(k, tab) {
    var why = blocked(k);
    return '<button type="button" class="pk-cell' + (why ? ' blocked' : '') + '" role="option" data-k="' + k + '" aria-selected="' + (k === obj.icon) + '"' + (why ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(k.replace(/-/g, ' ') + (inCat(k) ? ' (' + pinName(k) + ')' : '') + (why ? ', indisponível: ' + why : '')) + '" title="' + esc(why || (locked && inCat(k) ? pinName(k) + ' (fixável)' : k)) + '" tabindex="' + (tab ? 0 : -1) + '">' + ic(k) + (why ? '<span class="lk">' + ic('lock', 'xxs') + '</span>' : '') + '</button>';
  }
  function draw(announceIt) {
    var list = matches(), part = list.slice(0, shown);
    var rc = S.recents.filter(function (k) { return I[k] && (!target.pin || inCat(k)); });
    rec.innerHTML = (!query.trim() && rc.length) ? '<div class="pk-sec">Recentes</div><div class="pk-grid small" role="listbox" aria-label="Ícones recentes">' + rc.map(function (k) { return cell(k, false); }).join('') + '</div>' : '';
    lbl.hidden = !!(!query.trim() && !rc.length) && false;
    lbl.textContent = query.trim() ? list.length + (list.length === 1 ? ' ícone' : ' ícones') : (target.pin ? 'Ícones fixáveis (' + base.length + ')' : 'Todos os ícones');
    grid.innerHTML = part.length ? part.map(function (k, i) { return cell(k, i === 0); }).join('') : '<p class="pk-empty">Nenhum ícone para “' + esc(query.trim()) + '”. Tente em inglês, ex.: git.</p>';
    more.innerHTML = list.length > shown ? '<button type="button" class="pk-more" style="width:100%" data-more-btn>Mostrar mais (' + (list.length - shown) + ')</button>' : '';
    if (announceIt) announce(list.length ? list.length + (list.length === 1 ? ' ícone' : ' ícones') : 'Nenhum ícone encontrado');
  }
  draw(false);
  var t; inp.addEventListener('input', function () { query = inp.value; shown = 60; clearTimeout(t); t = setTimeout(function () { draw(true); }, 120); });
  function choose(k) {
    var why = blocked(k); if (why) { announce(why); return; }
    S.recents = [k].concat(S.recents.filter(function (x) { return x !== k; })).slice(0, 12);
    var focus = target.kind === 'group' ? 'gt:' + target.id : 'ib:' + target.id;
    closePop(false);
    if (target.pin) {
      commit(function () {
        obj.icon = k; obj.pinned = true;
        return { op: '“' + obj.name + '” fixado na barra de atividades com o ícone “' + pinName(k) + '”', say: 'Grupo ' + obj.name + ' fixado na barra de atividades. O ícone do grupo agora é ' + pinName(k) + '.', focus: 'gk:' + target.id };
      });
      return;
    }
    if (k === obj.icon) { render(focus); return; }
    commit(function () { obj.icon = k; return { op: 'Ícone de “' + obj.name + '”: ' + k, say: 'Ícone de ' + obj.name + ' alterado para ' + k.replace(/-/g, ' '), focus: focus }; });
  }
  n.addEventListener('click', function (e) {
    var c = e.target.closest('.pk-cell'); if (c) { choose(c.dataset.k); return; }
    if (e.target.closest('[data-more-btn]')) { shown += 60; draw(false); var cells = $$('.pk-cell', grid); if (cells[shown - 60]) cells[shown - 60].focus(); }
  });
  n.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePop(true); return; }
    if (e.target === inp) {
      if (e.key === 'ArrowDown') { e.preventDefault(); var f = $('.pk-cell', grid); if (f) f.focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); var l = matches().filter(function (k) { return !blocked(k); }); if (l.length && query.trim()) choose(l[0]); }
      return;
    }
    var cur0 = e.target.closest('.pk-cell'); if (!cur0) return;
    var g2 = cur0.parentElement, cells = $$('.pk-cell', g2), i = cells.indexOf(cur0);
    var cols = getComputedStyle(g2).gridTemplateColumns.split(' ').length || 1, ni = -1;
    if (e.key === 'ArrowRight') ni = i + 1; else if (e.key === 'ArrowLeft') ni = i - 1;
    else if (e.key === 'ArrowDown') ni = i + cols; else if (e.key === 'ArrowUp') ni = i - cols;
    else if (e.key === 'Home') ni = 0; else if (e.key === 'End') ni = cells.length - 1;
    else return;
    e.preventDefault();
    if (ni < 0 && e.key === 'ArrowUp') { inp.focus(); return; }
    if (ni >= 0 && ni < cells.length) { cells.forEach(function (c) { c.tabIndex = -1; }); cells[ni].tabIndex = 0; cells[ni].focus(); }
  });
  openPop(anchor, n);
  inp.focus();
}

/* ---------- menus de grupo e item ---------- */
function groupChoices(onPick, includeNew, current) {
  var items = cur().groups.map(function (g) { return { label: g.name, radio: true, checked: g.id === current, go: function () { onPick(g.id); } }; });
  if (includeNew) { items.push({ sep: true }); items.push({ label: 'Novo grupo', ic: 'plus', go: function () { onPick(null); } }); }
  return items;
}
function addItemMenu(gid) {
  var un = unassigned();
  if (!un.length) return [{ head: 'Adicionar item' }, { label: 'Tudo agrupado.', ic: 'check', disabled: true }];
  return [{ head: 'Adicionar item a este grupo' }].concat(un.map(function (e) { return { label: e.name, ic: e.icon, go: function () { placeItem({ type: 'tray', ext: e.id }, gid, Infinity); } }; }));
}
function groupMenu(gid) {
  var g = gById(gid), gs = cur().groups, idx = gs.indexOf(g);
  return [
    { label: 'Renomear', ic: 'pencil', go: function () { S.edit = { type: 'group', id: gid, sel: true }; render(null); announce('Renomear grupo ' + g.name + '. Enter confirma, Esc cancela.'); } },
    { label: 'Cor e ícone', ic: 'palette', go: function () { var a = $('[data-fid="gk:' + cssq(gid) + '"]', app); openStylePop(a || btnOrg, gid); } },
    { label: 'Mover para cima', ic: 'arrow-up', disabled: idx === 0, go: function () { moveGroupBy(gid, -1); } },
    { label: 'Mover para baixo', ic: 'arrow-down', disabled: idx === gs.length - 1, go: function () { moveGroupBy(gid, 1); } },
    { label: 'Adicionar item…', ic: 'plus', sub: function () { return addItemMenu(gid); } }
  ].concat(pinMenuItems(g), [
    { sep: true },
    { label: 'Excluir grupo', ic: 'trash-2', danger: true, go: function () { deleteGroup(gid); } }
  ]);
}
/* fixar na barra de atividades: um contêiner por ícone do catálogo; só no escopo Global */
function inCat(k) { return PIN_CAT.indexOf(k) >= 0; }
function pinName(k) { return PIN_NAME[k] || k; }
function pinnedGroups() { return S.data.global.groups.filter(function (g) { return g.pinned; }); }
function globalPinned(g) { var o = S.data.global.groups.filter(function (x) { return x.id === g.id; })[0]; return !!(o && o.pinned); }
function pinOwner(icon, exceptId) { return pinnedGroups().filter(function (x) { return x.icon === icon && x.id !== exceptId; })[0] || null; }
function pinAnchor(gid) { return $('[data-fid="gk:' + cssq(gid) + '"]', app) || btnOrg; }
function pinMenuItems(g) {
  var gp = globalPinned(g);
  if (S.scope !== 'global') return [{ label: gp ? 'Desafixar da barra de atividades' : 'Fixar na barra de atividades', hint: 'Itens fixados valem para todos os projetos; edite no escopo Global', ic: 'pin', soft: true }];
  if (g.pinned) return [{ label: 'Desafixar da barra de atividades', hint: 'O ícone “' + pinName(g.icon) + '” sai da barra e fica livre', ic: 'pin', go: function () { unpinGroup(g.id); } }];
  var owner = pinOwner(g.icon, g.id);
  if (inCat(g.icon) && !owner) return [{ label: 'Fixar na barra de atividades', hint: 'Aparece na barra com o ícone “' + pinName(g.icon) + '”', ic: 'pin', go: function () { pinGroup(g.id); } }];
  if (owner) return [
    { label: 'Fixar na barra de atividades', hint: 'O ícone “' + pinName(g.icon) + '” já é usado por “' + owner.name + '” (fixado).', ic: 'pin', soft: true },
    { label: 'Trocar o ícone deste grupo…', ic: 'palette', go: function () { openPinPicker(pinAnchor(g.id), g.id); } },
    { label: 'Desafixar “' + owner.name + '” e fixar este', ic: 'pin', go: function () { replacePin(owner.id, g.id); } }
  ];
  return [{ label: 'Fixar na barra de atividades', hint: 'O ícone atual não é fixável: você escolherá um da lista e ele vira o ícone do grupo.', ic: 'pin', go: function () { openPinPicker(pinAnchor(g.id), g.id); } }];
}
function openPinPicker(anchor, gid) { openPicker(anchor, { kind: 'group', id: gid, pin: true }); }
function pinGroup(gid) {
  commit(function () {
    var g = gById(gid); g.pinned = true;
    return { op: '“' + g.name + '” fixado na barra de atividades', say: 'Grupo ' + g.name + ' fixado na barra de atividades com o ícone ' + pinName(g.icon) + '.', focus: 'gk:' + gid };
  });
}
function unpinGroup(gid) {
  commit(function () {
    var g = gById(gid); delete g.pinned;
    return { op: '“' + g.name + '” desafixado da barra de atividades', say: 'Grupo ' + g.name + ' desafixado. O ícone ' + pinName(g.icon) + ' saiu da barra e ficou livre.', focus: 'gk:' + gid };
  });
}
function replacePin(otherId, gid) {
  commit(function () {
    var o = gById(otherId), g = gById(gid); delete o.pinned; g.pinned = true;
    return { op: '“' + o.name + '” desafixado; “' + g.name + '” fixado', say: o.name + ' desafixado. ' + g.name + ' fixado com o ícone ' + pinName(g.icon) + '.', focus: 'gk:' + gid };
  });
}
function itemMenu(iid) {
  var f = findItem(iid); if (!f) return [];
  function back() { return itemMenu(iid); }
  function posMenu(gid) {
    var g = gById(gid);
    return [{ head: 'Posição em ' + g.name }, { label: 'No fim', go: function () { placeItem({ type: 'item', id: iid }, gid, Infinity); } }, { label: 'No início', go: function () { placeItem({ type: 'item', id: iid }, gid, 0); } }, { sep: true }, { label: 'Voltar', ic: 'chevron-left', sub: moveMenu }];
  }
  function moveMenu() {
    var cur1 = findItem(iid); var list = [{ head: 'Mover para…' }];
    list = list.concat(cur().groups.map(function (g) { return { label: g.name, radio: true, checked: g.id === cur1.g.id, sub: function () { return posMenu(g.id); } }; }));
    list.push({ sep: true }); list.push({ label: 'Novo grupo', ic: 'plus', go: function () { placeItem({ type: 'item', id: iid }, null, 0); } });
    list.push({ label: 'Voltar', ic: 'chevron-left', sub: back });
    return list;
  }
  return [
    { label: 'Mover para…', ic: 'move', sub: moveMenu },
    { label: 'Trocar ícone', ic: 'palette', go: function () { var a = $('[data-fid="ik:' + cssq(iid) + '"]', app); openPicker(a || btnOrg, { kind: 'item', id: iid }); } },
    { label: 'Renomear', ic: 'pencil', go: function () { S.edit = { type: 'item', id: iid, sel: true }; render(null); announce('Renomear item. Enter confirma, Esc cancela.'); } },
    { sep: true },
    { label: 'Remover do grupo', ic: 'trash-2', danger: true, go: function () { removeItem(iid); } }
  ];
}

/* ---------- mutações ---------- */
function takeItem(d) {
  if (d.type === 'tray') return mk(EXTMAP[d.ext]);
  var f = findItem(d.id); f.g.items.splice(f.i, 1); return f.it;
}
function placeItem(d, gid, index) {
  var pre = d.type === 'item' ? findItem(d.id) : null;
  commit(function () {
    var it = takeItem(d), g;
    if (gid === null) {
      g = { id: 'g-' + (++uid), name: 'Novo grupo', icon: 'folder', color: COLORS[cur().groups.length % 9][0], items: [] };
      cur().groups.push(g);
      S.edit = { type: 'group', id: g.id, sel: true, fresh: true };
    } else g = gById(gid);
    var at = Math.max(0, Math.min(index, g.items.length));
    g.items.splice(at, 0, it); S.collapsed[g.id] = false;
    if (pre && pre.g.id === g.id && pre.i === at) return { skip: true, focus: 'ib:' + it.id };
    var verb = d.type === 'tray' ? 'adicionado a' : 'movido para';
    var pos = ', posição ' + (at + 1) + ' de ' + g.items.length;
    return { op: it.name + ' ' + verb + ' ' + g.name, say: it.name + ' ' + verb + ' ' + g.name + pos + (gid === null ? '. Digite o nome do novo grupo.' : ''), focus: gid === null ? null : 'ib:' + it.id };
  });
}
function removeItem(iid) {
  var f0 = findItem(iid); if (!f0) return;
  commit(function () {
    var f = findItem(iid); f.g.items.splice(f.i, 1);
    var nb = f.g.items[f.i] || f.g.items[f.i - 1];
    var back = f.it.ext && f.it.inst !== false;
    return { op: f.it.name + ' removido de ' + f.g.name, say: f.it.name + ' removido de ' + f.g.name + (back ? '; voltou às não agrupadas' : ''), focus: nb ? 'ib:' + nb.id : 'gt:' + f.g.id };
  });
}
function moveGroup(id, index) {
  commit(function () {
    var gs = cur().groups, i = gs.findIndex(function (g) { return g.id === id; }), g = gs.splice(i, 1)[0];
    gs.splice(index, 0, g);
    if (i === index) return { skip: true };
    var m = 'Grupo ' + g.name + ' movido para posição ' + (index + 1) + ' de ' + gs.length;
    return { op: m, say: m, focus: S.mode === 'org' ? 'gg:' + id : 'gt:' + id };
  });
}
function moveGroupBy(id, dir) {
  var gs = cur().groups, i = gs.findIndex(function (g) { return g.id === id; }), n = i + dir;
  if (n < 0 || n >= gs.length) return;
  commit(function () {
    var g = gs.splice(i, 1)[0]; gs.splice(n, 0, g);
    var m = 'Grupo ' + g.name + ' movido para posição ' + (n + 1) + ' de ' + gs.length;
    return { op: m, say: m, focus: 'gk:' + id };
  });
}
function deleteGroup(gid) {
  var g = gById(gid);
  if (g.items.length) { S.confirmDel = gid; render('dc:' + gid); announce('Excluir ' + g.name + ' e seus ' + g.items.length + ' itens? Escolha Excluir ou Cancelar.'); return; }
  doDelete(gid);
}
function doDelete(gid) {
  commit(function () {
    var gs = cur().groups, i = gs.findIndex(function (g) { return g.id === gid; }), g = gs.splice(i, 1)[0];
    S.confirmDel = null;
    var nb = gs[i] || gs[i - 1];
    var back = g.items.filter(function (x) { return x.ext && x.inst !== false; }).length;
    return { op: 'Grupo “' + g.name + '” excluído', say: 'Grupo ' + g.name + ' excluído' + (back ? '; ' + pl(back, 'extensão voltou', 'extensões voltaram') + ' à bandeja' : '') + (globalPinned(g) ? '; o ícone ' + pinName(g.icon) + ' saiu da barra de atividades' : ''), focus: nb ? 'gt:' + nb.id : 'org' };
  });
}
function createGroup() {
  commit(function () {
    var g = { id: 'g-' + (++uid), name: 'Novo grupo', icon: 'folder', color: COLORS[cur().groups.length % 9][0], items: [] };
    cur().groups.push(g); S.edit = { type: 'group', id: g.id, sel: true, fresh: true };
    return { op: 'Grupo criado', say: 'Grupo criado. Digite o nome e tecle Enter.', focus: null };
  });
}
function suggest() {
  commit(function () { cur().groups = seedGroups(true).map(function (g) { g.items.forEach(function (i) { i.fav = false; }); return g; }); S.welcomeDone = true; return { op: 'Grupos sugeridos criados', say: 'Grupos sugeridos criados: 7 grupos.', focus: 'org' }; });
}
function finishEdit(save) {
  var ed = S.edit; if (!ed) return;
  var inp = $('[data-edit]', scrollEl), raw = inp ? inp.value : (ed.val || ''), val = raw.trim();
  var focus = ed.type === 'group' ? 'gt:' + ed.id : 'ib:' + ed.id;
  if (!save) { S.edit = null; render(focus); announce('Edição cancelada'); return; }
  if (!val) {
    if (save === 'blur') { S.edit = null; render(null); return; }
    ed.err = true; ed.val = raw; ed.sel = false; render(); announce('Dê um nome ao ' + (ed.type === 'group' ? 'grupo' : 'item') + '.'); return;
  }
  S.edit = null;
  var obj = ed.type === 'group' ? gById(ed.id) : (findItem(ed.id) || {}).it;
  if (!obj || obj.name === val) { render(focus); return; }
  commit(function () { obj.name = val; return { op: (ed.type === 'group' ? 'Grupo' : 'Item') + ' renomeado para “' + val + '”', focus: focus }; });
}

/* ---------- arrastar e soltar (HTML5) ---------- */
function mkLine(tag, text) {
  var l = document.createElement(tag); l.className = 'drop-line'; l.setAttribute('aria-hidden', 'true'); l.innerHTML = '<i></i><small>' + esc(text || '') + '</small>'; return l;
}
function clearHints(keepTimer) {
  $$('.drop-line', scrollEl).forEach(function (l) { l.remove(); });
  $$('.drag-over,.is-over', scrollEl).forEach(function (x) { x.classList.remove('drag-over', 'is-over'); });
  if (!keepTimer && drag && drag.expT) { clearTimeout(drag.expT); drag.expT = null; drag.exp = null; }
}
function canUnassign(id) { var f = findItem(id); return !!(f && f.it.ext); }
function computeTarget(e) {
  var el = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement); if (!el) return null;
  var y = e.clientY;
  if (drag.type === 'group') {
    var gs = $('#groups', scrollEl); if (!gs || !el.closest('.scroll')) return null;
    var secs = $$('.group', gs).filter(function (s) { return !s.classList.contains('is-source'); });
    for (var i = 0; i < secs.length; i++) { var r = secs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return { kind: 'group', index: i, ref: secs[i], gs: gs }; }
    return { kind: 'group', index: secs.length, ref: null, gs: gs };
  }
  if (el.closest('.newzone')) return { kind: 'new' };
  if (el.closest('.tray')) return (drag.type === 'item' && canUnassign(drag.id)) ? { kind: 'tray' } : null;
  var sec = el.closest('.group');
  if (!sec) return el.closest('.groups') ? drag.target : null;
  var gid = sec.dataset.gid, collapsed = sec.classList.contains('is-collapsed');
  if (el.closest('.ghead') || collapsed) return { kind: 'end', gid: gid, sec: sec, expand: collapsed };
  var ul = $('ul.items', sec); if (!ul) return null;
  var lis = $$(':scope > li.item', ul).filter(function (l) { return !l.classList.contains('is-source'); });
  for (var j = 0; j < lis.length; j++) { var rr = lis[j].getBoundingClientRect(); if (y < rr.top + rr.height / 2) return { kind: 'item', gid: gid, index: j, ref: lis[j], ul: ul, sec: sec }; }
  return { kind: 'item', gid: gid, index: lis.length, ref: null, ul: ul, sec: sec };
}
function showHints(t) {
  var keep = t.kind === 'end' && t.expand;
  clearHints(keep);
  if (t.kind === 'group') { var l = mkLine('div', 'posição ' + (t.index + 1)); t.gs.insertBefore(l, t.ref); }
  else if (t.kind === 'new') $('.newzone', scrollEl).classList.add('is-over');
  else if (t.kind === 'tray') $('.tray', scrollEl).classList.add('is-over');
  else if (t.kind === 'end') {
    t.sec.classList.add('drag-over');
    if (t.expand && drag.exp !== t.gid) {
      drag.exp = t.gid; clearTimeout(drag.expT);
      drag.expT = setTimeout(function () {
        S.collapsed[t.gid] = false; t.sec.classList.remove('is-collapsed');
        var tg = $('.gtoggle', t.sec); if (tg) tg.setAttribute('aria-expanded', 'true');
      }, 600);
    } else if (!t.expand && drag.expT) { clearTimeout(drag.expT); drag.expT = null; drag.exp = null; }
  } else if (t.kind === 'item') {
    var g = gById(t.gid), ln = mkLine('li', 'em ' + (g ? g.name : '') + ' · posição ' + (t.index + 1));
    t.ul.insertBefore(ln, t.ref);
  }
}
function endDrag() {
  if (!drag) return;
  clearHints(); clearTimeout(drag.expT);
  $$('.is-source,.is-lifted', scrollEl).forEach(function (x) { x.classList.remove('is-source', 'is-lifted'); });
  var gs = $('#groups', scrollEl); if (gs) gs.classList.remove('reorder');
  app.classList.remove('is-dragging'); drag = null;
}
scrollEl.addEventListener('dragstart', function (e) {
  var li = e.target.closest && e.target.closest('li.item[draggable="true"]');
  var gh = e.target.closest && e.target.closest('.ghead[draggable="true"]');
  if (li && li.classList.contains('tray-item')) drag = { type: 'tray', ext: li.dataset.ext, el: li };
  else if (li) drag = { type: 'item', id: li.dataset.iid, el: li };
  else if (gh) drag = { type: 'group', id: gh.parentElement.dataset.gid, el: gh.parentElement };
  else return;
  drag.dropped = false; drag.target = null;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', drag.id || drag.ext); } catch (x) { /* ignore */ }
  var el = drag.el; el.classList.add('is-lifted');
  setTimeout(function () {
    if (!drag) return;
    el.classList.remove('is-lifted'); el.classList.add('is-source'); app.classList.add('is-dragging');
    if (drag.type === 'group') { var gs = $('#groups', scrollEl); if (gs) gs.classList.add('reorder'); }
  }, 0);
});
scrollEl.addEventListener('dragover', function (e) {
  if (!drag) return;
  var t = computeTarget(e); drag.target = t;
  if (!t) { e.dataTransfer.dropEffect = 'none'; clearHints(); return; }
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  showHints(t);
  var r = scrollEl.getBoundingClientRect();
  if (e.clientY < r.top + 40) scrollEl.scrollTop -= 10; else if (e.clientY > r.bottom - 40) scrollEl.scrollTop += 10;
});
scrollEl.addEventListener('drop', function (e) {
  if (!drag) return;
  e.preventDefault();
  var d = { type: drag.type, id: drag.id, ext: drag.ext }, t = drag.target;
  drag.dropped = true; endDrag();
  if (!t) { announce('Movimento cancelado'); return; }
  if (d.type === 'group') { if (t.kind === 'group') moveGroup(d.id, t.index); return; }
  if (t.kind === 'new') placeItem(d, null, 0);
  else if (t.kind === 'tray') removeItem(d.id);
  else if (t.kind === 'end') placeItem(d, t.gid, Infinity);
  else if (t.kind === 'item') placeItem(d, t.gid, t.index);
});
scrollEl.addEventListener('dragend', function () { if (drag && !drag.dropped) { endDrag(); announce('Movimento cancelado'); } else endDrag(); });

/* ---------- teclado: pegar, mover, soltar ---------- */
function kbShift(type, id, dx, dy) {
  var d = cur();
  if (type === 'item') {
    var f = findItem(id); if (!f) return null;
    var gi = d.groups.indexOf(f.g), i = f.i, ng = gi, ni = i;
    if (dy) {
      ni = i + dy;
      if (ni < 0) { if (gi === 0) return 'edge'; ng = gi - 1; ni = d.groups[ng].items.length; }
      else if (ni >= f.g.items.length) { if (gi === d.groups.length - 1) return 'edge'; ng = gi + 1; ni = 0; }
    }
    if (dx) { ng = gi + dx; if (ng < 0 || ng >= d.groups.length) return 'edge'; ni = Math.min(i, d.groups[ng].items.length); }
    f.g.items.splice(i, 1); d.groups[ng].items.splice(ni, 0, f.it); S.collapsed[d.groups[ng].id] = false;
    var tg = d.groups[ng];
    return { op: f.it.name + ' movido para ' + tg.name, msg: f.it.name + ': posição ' + (ni + 1) + ' de ' + tg.items.length + ' em ' + tg.name };
  }
  var gi2 = d.groups.findIndex(function (g) { return g.id === id; }), n2 = gi2 + dy;
  if (!dy || n2 < 0 || n2 >= d.groups.length) return 'edge';
  var g = d.groups.splice(gi2, 1)[0]; d.groups.splice(n2, 0, g);
  var m = 'Grupo ' + g.name + ' movido para posição ' + (n2 + 1) + ' de ' + d.groups.length;
  return { op: m, msg: m };
}
function nameOf(type, id) { if (type === 'item') { var f = findItem(id); return f ? f.it.name : ''; } var g = gById(id); return g ? g.name : ''; }
function kbKey(e) {
  if (e.target.matches && e.target.matches('input,textarea')) return;
  var t = e.target.closest('[data-kb]'); if (!t) return;
  var p = t.dataset.kb.split(':'), type = p[0], id = p.slice(1).join(':'), k = e.key;
  var kind = t.dataset.fid ? t.dataset.fid.split(':')[0] : (type === 'item' ? 'ib' : 'gt');
  var fidNow = kind + ':' + id;
  if (S.kb && S.kb.type === type && S.kb.id === id) {
    var map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (map[k]) {
      e.preventDefault();
      if (type === 'group' && map[k][0]) return;
      var r = kbShift(type, id, map[k][0], map[k][1]);
      if (r === 'edge') { announce('Não dá para mover mais nessa direção.'); return; }
      if (r) { render(S.kb.kind + ':' + id); announce(r.msg); }
      return;
    }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      var s0 = S.kb.s, kd = S.kb.kind; S.kb = null;
      if (snap() === s0) { render(kd + ':' + id); announce(nameOf(type, id) + ' solto sem mudança.'); return; }
      var res; var nm = nameOf(type, id);
      if (type === 'item') { var f = findItem(id); res = { op: nm + ' movido para ' + f.g.name, say: nm + ' solto em ' + f.g.name + ', posição ' + (f.i + 1) + ' de ' + f.g.items.length }; }
      else { var gi = cur().groups.findIndex(function (g) { return g.id === id; }); res = { op: 'Grupo ' + nm + ' movido para posição ' + (gi + 1) + ' de ' + cur().groups.length }; res.say = res.op; }
      var own = false;
      if (S.scope === 'project' && !S.projectOwn) { S.projectOwn = true; own = true; }
      render(kd + ':' + id); announce(res.say); lastUndo = { s: s0, op: res.op };
      var acts = [{ label: 'Desfazer', fn: undo }], tx = res.op;
      if (own) { tx += '. Este projeto agora tem organização própria.'; acts.push({ label: 'Voltar ao global', fn: askReset }); }
      toast({ text: tx, actions: acts }); simulateSave(); return;
    }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); var s1 = S.kb.s, kd2 = S.kb.kind; restore(s1); render(kd2 + ':' + id); announce('Movimento cancelado'); return; }
    return;
  }
  if (S.mode !== 'org' || S.kb) return;
  if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
    e.preventDefault();
    commit(function () {
      var r = kbShift(type, id, 0, k === 'ArrowUp' ? -1 : 1);
      if (r === 'edge') return { skip: true, say: 'Não dá para mover mais nessa direção.', focus: fidNow };
      return { op: r.op, say: r.msg, focus: fidNow };
    });
    return;
  }
  if ((k === ' ' && t.dataset.kbpick) || (k === 'Enter' && t.classList.contains('grip'))) {
    e.preventDefault();
    S.kb = { type: type, id: id, s: snap(), kind: kind };
    render(fidNow);
    announce(nameOf(type, id) + ' pego. Use as setas para cima e para baixo para mover' + (type === 'item' ? ', as setas para a direita e esquerda trocam de grupo' : '') + ', Espaço solta, Esc cancela.');
  }
}
app.addEventListener('keydown', kbKey);

/* ---------- cliques e edição ---------- */
app.addEventListener('click', function (e) {
  var t = e.target;
  var sty = t.closest('[data-style]');
  if (sty && S.mode === 'org') { e.preventDefault(); openStylePop(sty.closest('.gtoggle'), sty.dataset.style); return; }
  var ie = t.closest('[data-iconedit]');
  if (ie && S.mode === 'org') { e.preventDefault(); openPicker(ie.closest('.ibtn'), { kind: 'item', id: ie.dataset.iconedit }); return; }
  var b = t.closest('[data-act]'); if (!b) return;
  var a = b.dataset.act, gid = b.dataset.gid, iid = b.dataset.iid;
  switch (a) {
    case 'toggle': {
      S.collapsed[gid] = !S.collapsed[gid];
      var sec = b.closest('.group'); sec.classList.toggle('is-collapsed', !!S.collapsed[gid]);
      b.setAttribute('aria-expanded', S.collapsed[gid] ? 'false' : 'true');
      announce(gById(gid).name + (S.collapsed[gid] ? ' recolhido' : ' expandido')); syncTop(); break;
    }
    case 'tray-toggle': {
      var un = unassigned(); var c = S.trayCollapsed === null ? un.length === 0 : S.trayCollapsed;
      S.trayCollapsed = !c; $('#tray', scrollEl).classList.toggle('is-collapsed', S.trayCollapsed); b.setAttribute('aria-expanded', S.trayCollapsed ? 'false' : 'true'); break;
    }
    case 'run': {
      var f = findItem(iid); if (!f || S.mode === 'org') return;
      if (f.it.inst === false) {
        openDialog(b, { title: 'Extensão não instalada', text: '“' + f.it.name + '”: esta extensão não está instalada.', btns: [
          { label: 'Ver no Marketplace', go: function () { toast({ kind: 'info', text: 'Abriria a página de ' + f.it.name + ' no Marketplace (simulado).' }); } },
          { label: 'Remover do grupo', cls: 'danger', go: function () { removeItem(iid); } }
        ] });
        break;
      }
      toast({ kind: 'info', text: 'Abrindo ' + f.it.name + '… (simulado)' }); announce('Abrindo ' + f.it.name); break;
    }
    case 'star': {
      var fi = findItem(iid); fi.it.fav = !fi.it.fav;
      announce(fi.it.name + (fi.it.fav ? ' adicionado aos favoritos' : ' removido dos favoritos'));
      render(S.tab === 'fav' && !fi.it.fav ? null : undefined);
      if (S.tab === 'fav' && !fi.it.fav) { var nx = $('.star', scrollEl); (nx || scrollEl).focus(); }
      break;
    }
    case 'gmenu': openMenu(b, groupMenu(gid), { label: 'Ações do grupo' }); break;
    case 'imenu': openMenu(b, itemMenu(iid), { label: 'Ações do item' }); break;
    case 'gadd': openMenu(b, addItemMenu(gid), { label: 'Adicionar item' }); break;
    case 'addto': {
      var ext = b.dataset.ext;
      openMenu(b, [{ head: 'Adicionar a…' }].concat(groupChoices(function (g) { placeItem({ type: 'tray', ext: ext }, g, Infinity); }, true, null)), { label: 'Adicionar a um grupo' }); break;
    }
    case 'newgroup': createGroup(); break;
    case 'del-ok': doDelete(gid); break;
    case 'del-cancel': S.confirmDel = null; render('gk:' + gid); announce('Exclusão cancelada'); break;
    case 'dismiss-notice': S.notice = null; render(null); break;
    case 'dismiss-broken': S.dismissed.broken = true; render(null); break;
    case 'dismiss-un': S.dismissed.un = true; render(null); break;
    case 'dismiss-hint': S.dismissed.hint = true; render(null); break;
    case 'show-broken': S.brokenOnly = !S.brokenOnly; render(); announce(S.brokenOnly ? 'Mostrando só itens quebrados' : 'Mostrando todos os itens'); break;
    case 'show-tray': S.mode = 'org'; fullRender(null); var tr = $('#tray', scrollEl); if (tr) { tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); var ad = $('.add', tr); if (ad) ad.focus({ preventScroll: true }); } announce('Modo Organizar. Extensões não agrupadas à mostra.'); break;
    case 'enter-org': S.mode = 'org'; fullRender('org'); announce('Modo Organizar ativado.'); break;
    case 'retry': S.errBanner = false; render(null); announce('Tentando salvar de novo.'); simulateSave(); break;
    case 'discard': restore(lastSaved); S.errBanner = false; S.save = ''; fullRender(null); announce('Alterações descartadas.'); break;
    case 'suggest': suggest(); break;
    case 'zero': S.welcomeDone = true; render('cf'); announce('Começando do zero. Nenhum grupo ainda.'); break;
    case 'clear-q': clearSearch(); break;
    case 'search-tray': S.searchTray = true; render(); announce('Mostrando também as não agrupadas.'); break;
    case 'settings': toast({ kind: 'info', text: 'Abriria o Settings do VS Code (simulado).' }); break;
  }
});
scrollEl.addEventListener('dblclick', function (e) {
  var gn = e.target.closest('.gname');
  if (gn && S.mode === 'org') { var sec = gn.closest('.group'); S.edit = { type: 'group', id: sec.dataset.gid, sel: true }; render(null); }
});
scrollEl.addEventListener('keydown', function (e) {
  var inp = e.target.closest && e.target.closest('[data-edit]'); if (!inp) return;
  if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdit(false); }
});
scrollEl.addEventListener('input', function (e) {
  if (e.target.id === 'trayQ') { S.trayQ = e.target.value; render('tf'); return; }
  var inp = e.target.closest && e.target.closest('[data-edit]'); if (!inp || !S.edit) return;
  S.edit.val = inp.value;
  if (S.edit.err) { S.edit.err = false; inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); var er = $('#rn-err', scrollEl); if (er) er.remove(); }
  var n = $('[data-n]', scrollEl); if (n) { n.hidden = inp.value.length < 80; n.textContent = inp.value.length + '/100'; }
});
scrollEl.addEventListener('focusout', function (e) {
  if (rendering || !S.edit) return;
  if (e.target.matches && e.target.matches('[data-edit]') && !(e.relatedTarget && scrollEl.contains(e.relatedTarget) && e.relatedTarget.matches('[data-edit]'))) finishEdit('blur');
});

/* ---------- barra superior ---------- */
var searchT;
qEl.addEventListener('input', function () {
  S.q = qEl.value; S.searchTray = false;
  if (S.q.trim()) S.mode = 'use';
  S.edit = null; render(); syncTop();
  clearTimeout(searchT);
  searchT = setTimeout(function () {
    if (!S.q.trim()) return;
    announce(S.resCount ? pl(S.resCount, 'resultado', 'resultados') : 'Nenhum resultado para ' + S.q.trim());
  }, 500);
});
qEl.addEventListener('keydown', function (e) { if (e.key === 'Escape' && qEl.value) { e.preventDefault(); e.stopPropagation(); clearSearch(true); } });
function clearSearch(keepFocus) { qEl.value = ''; S.q = ''; S.searchTray = false; render(null); syncTop(); if (keepFocus) qEl.focus(); announce('Busca limpa'); }
$('#qClear').addEventListener('click', function () { clearSearch(true); });
btnOrg.addEventListener('click', function () {
  if (btnOrg.disabled) return;
  S.mode = S.mode === 'org' ? 'use' : 'org'; S.edit = null; S.kb = null; S.confirmDel = null; closePop(false);
  fullRender(null);
  announce(S.mode === 'org' ? 'Modo Organizar ativado. Arraste pela alça, ou use Espaço e setas, ou o menu ⋯ Mover para.' : 'Modo Organizar concluído.');
});
function setTab(v) {
  S.tab = v; if (v === 'fav') { S.mode = 'use'; S.edit = null; }
  fullRender(null); announce(v === 'fav' ? 'Mostrando favoritos' : 'Mostrando todas');
}
$('#segAll').addEventListener('click', function () { setTab('all'); });
$('#segFav').addEventListener('click', function () { setTab('fav'); });
btnScope.addEventListener('click', function () {
  openMenu(btnScope, [
    { label: 'Global', hint: 'Vale para todos os projetos', radio: true, checked: S.scope === 'global', go: function () { setScope('global'); } },
    { label: 'Este projeto', hint: S.noWorkspace ? 'Abra uma pasta para usar este escopo.' : 'Só neste projeto; prevalece sobre o global', radio: true, checked: S.scope === 'project', disabled: S.noWorkspace, go: function () { setScope('project'); } }
  ], { label: 'Escopo' });
});
function setScope(s) {
  if (s === S.scope) { btnScope.focus(); return; }
  if (s === 'project' && !S.data.project) { S.data.project = makeProject(); S.projectOwn = false; }
  S.notice = null;
  S.scope = s; S.edit = null; S.kb = null; S.confirmDel = null;
  fullRender(null); btnScope.focus();
  announce('Escopo: ' + scopeName() + '.' + (s === 'project' && !S.projectOwn ? ' Cópia do global até a primeira edição.' : ''));
}

/* ---------- atalhos globais ---------- */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && pop) { closePop(true); return; }
  if (e.altKey && e.shiftKey && e.code === 'KeyC' && !$('#vscSide').classList.contains('away')) { e.preventDefault(); toggleAll(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !(e.target.matches && e.target.matches('input,textarea'))) { e.preventDefault(); undo(); }
});

/* ---------- carga de cenários e controles do protótipo ---------- */
function load(kind) {
  closePop(false); var t0 = $('.toast', overlay); if (t0) t0.remove();
  S = {
    dataset: kind, scope: 'global', mode: 'use', tab: 'all', q: '', collapsed: {}, trayCollapsed: null, trayQ: '', searchTray: false, brokenOnly: false,
    dismissed: {}, welcomeDone: false, edit: null, confirmDel: null, kb: null, errBanner: false, save: '', projectOwn: false, loading: false, resCount: 0,
    act: 'tools', prevCollapsed: null,
    recents: ['git-branch', 'sparkles', 'database'], errSim: $('#pvErr').checked, noWorkspace: $('#pvNoWs').checked, readOnly: $('#pvRo').checked, projMissing: $('#pvMiss').checked, notice: null
  };
  var groups = kind === 'full' ? seedGroups(true) : kind === 'empty' ? seedGroups(false) : [];
  var pc = $('input[name=slots]:checked'), pn = pc ? +pc.value : 0;
  groups = withExtras(groups, pn); pinFirst(groups, pn);
  S.data = { global: { groups: groups }, project: null };
  qEl.value = ''; lastSaved = snap(); lastUndo = null;
  fullRender(null);
  announce({ full: 'Exemplo cheio carregado.', empty: 'Exemplo vazio carregado: grupos sem itens.', first: 'Exemplo de primeira vez carregado: nenhum grupo.' }[kind]);
}
function setTheme(v) {
  document.documentElement.setAttribute('data-theme', v);
  document.body.className = v === 'dark' ? 'vscode-dark' : v === 'light' ? 'vscode-light' : 'vscode-high-contrast';
  if (pop) placePop(pop.node, pop.anchor);
}
function setWidth(w) { $('#vsc').style.setProperty('--w', w + 'px'); $('#pvW').value = w; $('#pvWo').textContent = w + ' px'; if (pop) closePop(false); if (S.data) renderStatus(); hideHover(true); }
$$('input[name=theme]').forEach(function (r) { r.addEventListener('change', function () { setTheme(r.value); announce('Tema: ' + r.nextElementSibling.textContent); }); });
$$('input[name=data]').forEach(function (r) { r.addEventListener('change', function () { load(r.value); }); });
$$('input[name=slots]').forEach(function (r) { r.addEventListener('change', function () { setPinCount(+r.value); }); });
$('#pvW').addEventListener('input', function (e) { setWidth(+e.target.value); });
$$('[data-w]').forEach(function (b) { b.addEventListener('click', function () { setWidth(+b.dataset.w); }); });
$('#pvErr').addEventListener('change', function (e) { S.errSim = e.target.checked; });
$('#pvNoWs').addEventListener('change', function (e) {
  S.noWorkspace = e.target.checked;
  if (S.noWorkspace && S.scope === 'project') setScope('global');
});
$('#pvMiss').addEventListener('change', function (e) {
  S.projMissing = e.target.checked; S.data.project = null; S.projectOwn = false;
  if (S.scope === 'project') setScope('global');
  announce(S.projMissing ? 'Simulação: o primeiro grupo fixado não existe no projeto.' : 'Simulação desligada.');
});
$('#pvRo').addEventListener('change', function (e) {
  S.readOnly = e.target.checked; if (S.readOnly) { S.mode = 'use'; S.edit = null; S.kb = null; }
  fullRender(null);
});
$('#pvRm').addEventListener('change', function (e) { document.documentElement.classList.toggle('pv-reduce', e.target.checked); });
$('#pvLoad').addEventListener('click', function () {
  S.loading = true; fullRender(null); announce('Carregando extensões…');
  setTimeout(function () { S.loading = false; fullRender(null); announce('Dados carregados.'); }, 1800);
});
$('#pvReset').addEventListener('click', function () {
  ['pvErr', 'pvNoWs', 'pvRo', 'pvRm', 'pvMiss'].forEach(function (id) { $('#' + id).checked = false; });
  document.documentElement.classList.remove('pv-reduce');
  var r = $('input[name=data]:checked'); load(r ? r.value : 'full');
});

$$('[data-ic]').forEach(function (el) { el.innerHTML = ic(el.dataset.ic, el.dataset.icsm ? 'sm' : ''); });
window.addEventListener('resize', function () { renderAct(); });
setWidth(320);
load('full');
})();
