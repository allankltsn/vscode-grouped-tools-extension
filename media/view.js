/* Ferramentas agrupadas - interface do painel (webview).
   Segue o protótipo aprovado em docs/design/redesenho/prototipo. Todo texto dinâmico passa por esc();
   os ícones vêm do catálogo local (icons.js). Sem estilos inline: a cor do grupo é uma classe g-N. */
/* global acquireVsCodeApi */
(function () {
  'use strict';
  const api = acquireVsCodeApi();
  const M = window.groupModel, SY = window.syncState, CAT = window.pinCatalog;
  const I = window.toolIcons || {}, TAGS = window.toolIconTags || {}, ALIASES = window.toolIconAliases || {};
  const ICON_NAMES = Object.keys(I).sort();
  const PAGE = 60, SAVE_DELAY = 400;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  // ---- helpers ------------------------------------------------------------------------------------
  function iconBody(name) {
    const n = typeof name === 'string' ? name : '';
    if (Object.hasOwn(I, n)) return I[n];
    if (Object.hasOwn(ALIASES, n) && Object.hasOwn(I, ALIASES[n])) return I[ALIASES[n]];
    return I.puzzle || '';
  }
  function ic(name, cls) {
    return `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconBody(name)}</svg>`;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fold(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function pl(n, a, b) { return `${n} ${n === 1 ? a : b}`; }
  function cssq(v) { return (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'); }
  const list = v => (Array.isArray(v) ? v : []);
  const cname = k => { const i = M.COLORS.indexOf(k); return i < 0 ? M.COLOR_NAMES[9] : M.COLOR_NAMES[i]; };

  // ---- state ----------------------------------------------------------------------------------------
  const saved = api.getState() || {};
  const asMap = v => (Array.isArray(v) ? Object.fromEntries(v.filter(x => typeof x === 'string').map(x => [x, true])) : (v && typeof v === 'object' ? { ...v } : {}));
  const S = {
    mode: 'use', tab: saved.tab === 'fav' ? 'fav' : 'all', q: typeof saved.q === 'string' ? saved.q : '',
    collapsed: asMap(saved.collapsed), prevCollapsed: saved.prevCollapsed ? asMap(saved.prevCollapsed) : null,
    trayCollapsed: typeof saved.trayCollapsed === 'boolean' ? saved.trayCollapsed : null, trayQ: '', searchTray: false, brokenOnly: false,
    dismissed: { hint: saved.hintDismissed === true }, welcomeDone: false, edit: null, confirmDel: null, kb: null, notice: null, save: '',
    recents: list(saved.recents).filter(n => typeof n === 'string').slice(0, 12), scopePref: saved.scope === 'workspace' || saved.scope === 'global' ? saved.scope : undefined,
    slow: '', resCount: 0
  };
  let data = null, lastData = null, groups = [], groupsScope = null;
  let drag = null, rendering = false, pop = null, undoSnap = null, ownShown = false;
  let toastT = null, saveT = null, liveT = null, lastRun = { id: null, at: 0 };
  const sync = SY.create();
  const app = $('#app'), scrollEl = $('#scroll'), overlay = $('#overlay'), live = $('#live'), footEl = $('#foot');
  const qEl = $('#q'), btnOrg = $('#btnOrg'), btnScope = $('#btnScope'), btnFold = $('#btnFold');
  scrollEl.tabIndex = -1;
  qEl.value = S.q;

  function persist() {
    api.setState({ tab: S.tab, q: S.q, collapsed: S.collapsed, prevCollapsed: S.prevCollapsed, trayCollapsed: S.trayCollapsed, hintDismissed: S.dismissed.hint === true, recents: S.recents, scope: S.scopePref });
  }
  const activeScope = () => (data && data.scope ? data.scope.active : 'global');
  const scopeName = () => (activeScope() === 'global' ? 'Global' : 'Este projeto');
  const allItems = () => groups.flatMap(g => g.items);
  const gById = id => groups.find(g => g.id === id) || null;
  function findItem(id) {
    const at = M.locate(groups, id);
    return at ? { g: groups[at.gi], i: at.ii, it: groups[at.gi].items[at.ii] } : null;
  }
  const snap = () => JSON.stringify(groups);
  function restoreSnap(s) { groups = JSON.parse(s); S.edit = null; S.confirmDel = null; S.kb = null; }
  const extByCommand = command => list(data && data.extensions).find(e => e.command === command) || null;
  const unassigned = () => (data ? M.computeUnassigned(list(data.extensions), groups) : []);

  // ---- announcements and toast ------------------------------------------------------------------------
  function announce(msg) {
    if (!msg) return;
    live.textContent = '';
    clearTimeout(liveT); liveT = setTimeout(() => { live.textContent = msg; }, 30);
  }
  function hideToast() { clearTimeout(toastT); const old = $('.toast', overlay); if (old) old.remove(); }
  function toast(o) {
    hideToast();
    const kind = o.kind || 'ok', acts = o.actions || [];
    const n = document.createElement('div'); n.className = `toast ${kind}`; n.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    n.innerHTML = `${ic(kind === 'err' ? 'circle-alert' : kind === 'info' ? 'info' : 'check', 'sm lead')}<span class="tx">${esc(o.text)}</span>${
      acts.map((a, i) => `<button type="button" class="ta" data-ti="${i}">${esc(a.label)}</button>`).join('')
    }<button type="button" class="tx2" aria-label="Dispensar aviso" data-tx>${ic('x', 'xs')}</button>`;
    overlay.appendChild(n);
    n.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-tx')) { n.remove(); return; }
      const a = acts[Number(b.dataset.ti)]; n.remove(); clearTimeout(toastT); if (a) a.fn();
    });
    if (!o.sticky) toastT = setTimeout(() => n.remove(), o.ttl || (acts.length ? 8000 : 3000));
  }

  // ---- saving: one gesture, one save (debounced), one level of undo ---------------------------------------
  function setSave(state, clearAfter) {
    S.save = state; renderFoot(); clearTimeout(saveT);
    if (clearAfter) saveT = setTimeout(() => { S.save = ''; renderFoot(); }, clearAfter);
  }
  function queueSave(type, op) {
    const scope = activeScope();
    const other = SY.enqueue(sync, { type, scope, op, groups: M.serialize(groups, scope) });
    clearTimeout(sync.timer); sync.timer = setTimeout(flush, SAVE_DELAY);
    if (other) flush();
    setSave('saving');
  }
  function flush() {
    clearTimeout(sync.timer); sync.timer = null;
    const entry = SY.take(sync); if (!entry) return;
    api.postMessage({ type: entry.type, scope: entry.scope, groups: entry.groups, op: entry.op });
    if (SY.hasPending(sync)) sync.timer = setTimeout(flush, SAVE_DELAY);
  }
  function onSaved(message) {
    const r = SY.saved(sync), done = r.done;
    if (r.again) { flush(); return; }
    if (r.waiting) return;
    if (lastData && (!done || done.scope === activeScope())) { groups = M.clone(lastData.groups); groupsScope = activeScope(); }
    setSave('saved', 3000);
    render(); syncTop();
    announce(`Salvo em ${scopeName()}`);
    const reason = message.reason || {};
    if (reason.type === 'reset' || reason.type === 'suggested') toast({ text: message.text || 'Salvo.' });
  }
  function onSaveError(message) {
    SY.failed(sync, (message.reason && message.reason.text) || message.text);
    S.save = 'error'; render(); renderFoot();
    announce(`Não foi possível salvar: ${sync.error}. Suas alterações continuam na tela.`);
  }
  function retrySave() { SY.retry(sync); S.save = 'saving'; flush(); render(); renderFoot(); announce('Tentando salvar de novo.'); }
  function discardDraft() {
    clearTimeout(sync.timer); sync.timer = null; SY.discard(sync); undoSnap = null;
    if (lastData) { groups = M.clone(lastData.groups); groupsScope = activeScope(); }
    S.save = ''; S.edit = null; S.kb = null; fullRender(null); announce('Alterações descartadas.');
  }
  function undo() {
    if (!undoSnap) { announce('Nada para desfazer.'); return; }
    const u = undoSnap; undoSnap = null; closePop(false); hideToast();
    if (u.scope !== activeScope()) return;
    groups = u.groups; S.edit = null; S.kb = null; S.confirmDel = null; sync.draft = true;
    fullRender(null); announce(`Desfeito: ${u.op}`); toast({ text: 'Desfeito.' });
    queueSave('undo', 'Alteração desfeita.');
  }
  // `before` is the JSON snapshot taken before the gesture; r = { op, say, focus }.
  function finish(before, r) {
    const own = activeScope() === 'workspace' && data && !data.scope.projectOverride && !ownShown;
    if (own) ownShown = true;
    undoSnap = { groups: JSON.parse(before), scope: activeScope(), op: r.op };
    sync.draft = true; groupsScope = activeScope();
    render(r.focus); syncTop(); renderFoot();
    announce(r.say || r.op);
    const acts = [{ label: 'Desfazer', fn: undo }];
    let text = r.op;
    if (own) { text += '. Este projeto agora tem organização própria.'; acts.push({ label: 'Voltar ao global', fn: askReset }); }
    toast({ text, actions: acts });
    queueSave('saveGroups', r.op);
  }
  function commit(fn) {
    const before = snap(); const r = fn() || {};
    if (r.skip) { if (r.say) announce(r.say); render(r.focus === undefined ? undefined : r.focus); return; }
    finish(before, r);
  }
  function askReset() {
    openDialog(btnScope, { text: 'A organização própria deste projeto será descartada e o painel volta a seguir o global.', btns: [
      { label: 'Descartar e voltar ao global', cls: 'danger', go() {
        if (SY.hasPending(sync)) flush();
        api.postMessage({ type: 'resetGroups', scope: 'workspace', op: 'Organização do projeto descartada' });
        undoSnap = null; ownShown = false; S.scopePref = 'global'; persist(); api.postMessage({ type: 'setScope', scope: 'global' }); announce('Voltando ao global.');
      } },
      { label: 'Cancelar' }
    ] });
  }

  // ---- rendering ---------------------------------------------------------------------------------------
  function hl(t) {
    const q = fold(S.q.trim()); if (!q) return esc(t);
    const f = fold(t), i = f.indexOf(q); if (i < 0 || f.length !== String(t).length) return esc(t);
    return `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + q.length))}</mark>${esc(t.slice(i + q.length))}`;
  }
  function visItems(g, q) {
    let its = g.items;
    if (S.tab === 'fav') its = its.filter(i => i.favorite);
    if (S.brokenOnly) its = its.filter(i => i.installed === false);
    if (q && fold(g.name).indexOf(q) < 0) its = its.filter(i => fold(`${i.name} ${i.command}`).indexOf(q) >= 0);
    return its;
  }
  function gripBtn(kind, id, label, role, picked) {
    return `<button type="button" class="icbtn grip act" data-fid="${kind}:${esc(id)}" data-kb="${kind === 'gg' ? 'group' : 'item'}:${esc(id)}" data-kbpick="1" aria-roledescription="${role}" aria-describedby="kbhelp" aria-pressed="${picked ? 'true' : 'false'}" aria-label="Alça: mover ${esc(label)}" title="Arrastar para mover (ou Espaço)">${ic('grip-vertical', 'xs')}</button>`;
  }
  function renameHTML(type, label, icon, name) {
    const err = S.edit.err, val = S.edit.val != null ? S.edit.val : name;
    return `<div class="rn-wrap"><div class="rn-line">${icon}<input class="field" data-edit="${type}" data-fid="rn" maxlength="100" value="${esc(val)}" aria-label="${label}"${err ? ' aria-invalid="true" aria-describedby="rn-err"' : ''}></div>${
      err ? `<div class="field-err" id="rn-err">${ic('circle-alert', 'xs')}Dê um nome ${type === 'group' ? 'ao grupo' : 'ao item'}</div>` : ''
    }<div class="field-n" data-n${val.length >= 80 ? '' : ' hidden'}>${val.length}/100</div></div>`;
  }
  function itemHTML(it, g, org, dragOn) {
    const editing = S.edit && S.edit.type === 'item' && S.edit.id === it.id;
    const broken = it.installed === false;
    const picked = S.kb && S.kb.type === 'item' && S.kb.id === it.id;
    let h = `<li class="item${broken ? ' is-broken' : ''}${picked ? ' is-picked' : ''}" data-iid="${esc(it.id)}" data-gid="${esc(g.id)}"${dragOn && !editing ? ' draggable="true"' : ''}>`;
    if (org && !editing) h += gripBtn('gr', it.id, it.name, 'item reordenável', picked);
    if (editing) h += renameHTML('item', 'Nome do item', `<span class="iico">${ic(it.icon)}</span>`, it.name);
    else {
      h += `<button type="button" class="ibtn" data-act="run" data-iid="${esc(it.id)}" data-fid="ib:${esc(it.id)}"${org ? ` data-kb="item:${esc(it.id)}" data-kbpick="1" aria-describedby="kbhelp"` : ''}${broken ? ` aria-label="${esc(it.name)}, não instalada"` : ''} title="${esc(it.name)} · ${esc(it.command)}${Array.isArray(it.args) && it.args.length ? ' (com argumentos)' : ''}${broken ? ' (não instalada)' : ''}">` +
        `<span class="iico"${org ? ` data-iconedit="${esc(it.id)}" title="Trocar ícone"` : ''}>${ic(it.icon)}</span><span class="iname">${hl(it.name)}</span>${
          broken ? `<span class="miss">${ic('circle-dashed', 'xxs')}<span class="t">Não instalado</span></span>` : ''}</button>`;
      if (org) h += `<button type="button" class="icbtn act kebab" data-act="imenu" data-iid="${esc(it.id)}" data-fid="ik:${esc(it.id)}" aria-haspopup="menu" aria-label="Ações de ${esc(it.name)}">${ic('ellipsis', 'sm')}</button>`;
      h += `<button type="button" class="icbtn act star" data-act="star" data-iid="${esc(it.id)}" data-fid="st:${esc(it.id)}" aria-pressed="${it.favorite ? 'true' : 'false'}" aria-label="Favorito: ${esc(it.name)}" title="${it.favorite ? 'Remover dos favoritos' : 'Favoritar'}">${ic('star', 'sm')}</button>`;
    }
    return `${h}</li>`;
  }
  function groupHTML(g, vis, filtered, q, org, dragOn) {
    const col = S.collapsed[g.id] && !q && !S.brokenOnly;
    const editing = S.edit && S.edit.type === 'group' && S.edit.id === g.id;
    const confirming = S.confirmDel === g.id;
    const picked = S.kb && S.kb.type === 'group' && S.kb.id === g.id;
    const cnt = filtered ? `${vis.length} de ${g.items.length}` : String(g.items.length);
    let head = '';
    if (confirming) {
      head = `<div class="confirm" role="group" aria-label="Confirmar exclusão"><span>Excluir “${esc(g.name)}” e seus ${g.items.length} itens? Extensões voltam à bandeja.</span><div class="acts"><button type="button" class="btn danger" data-act="del-ok" data-gid="${esc(g.id)}">Excluir</button><button type="button" class="btn" data-act="del-cancel" data-gid="${esc(g.id)}" data-fid="dc:${esc(g.id)}">Cancelar</button></div></div>`;
    } else {
      if (org && !editing) head += gripBtn('gg', g.id, g.name, 'grupo reordenável', picked);
      if (editing) head += renameHTML('group', 'Nome do grupo', `<span class="chip">${ic(g.icon, 'sm')}</span>`, g.name);
      else {
        head += `<button type="button" class="gtoggle" data-act="toggle" data-gid="${esc(g.id)}" data-fid="gt:${esc(g.id)}" data-kb="group:${esc(g.id)}" aria-expanded="${col ? 'false' : 'true'}" aria-controls="p-${esc(g.id)}">` +
          `<span class="chev">${ic('chevron-down', 'xs')}</span><span class="chip"${org ? ` data-style="${esc(g.id)}" title="Cor e ícone"` : ''}>${ic(g.icon, 'sm')}</span>` +
          `<span class="gname" title="${esc(g.name)}">${hl(g.name)}</span>${
            isPinned(g) ? `<span class="pinbadge" role="img" aria-label="Fixado na barra de atividades" title="Fixado na barra de atividades com o ícone deste grupo. Vale para todos os projetos; o ícone da barra abre este grupo e recolhe os outros.">${ic('pin', 'xxs')}</span>` : ''}` +
          `<span class="count" aria-label="${esc(cnt)} itens">${esc(cnt)}</span></button>` +
          `<button type="button" class="icbtn act kebab" data-act="gmenu" data-gid="${esc(g.id)}" data-fid="gk:${esc(g.id)}" aria-haspopup="menu" aria-label="Ações do grupo ${esc(g.name)}">${ic('ellipsis', 'sm')}</button>`;
      }
    }
    let body;
    if (!vis.length && !filtered) {
      body = `<li class="empty"><span>Vazio. Arraste uma extensão aqui ou use</span><button type="button" class="lk" data-act="gadd" data-gid="${esc(g.id)}" data-fid="ga:${esc(g.id)}" aria-haspopup="menu">Adicionar item</button></li>`;
    } else body = vis.map(it => itemHTML(it, g, org, dragOn)).join('');
    return `<section class="group grp ${M.colorOf(g)}${col ? ' is-collapsed' : ''}${picked ? ' is-picked' : ''}" data-gid="${esc(g.id)}" aria-label="${esc(g.name)}">` +
      `<div class="ghead"${dragOn && !editing && !confirming ? ' draggable="true"' : ''}>${head}</div>` +
      `<div class="panel" id="p-${esc(g.id)}"><div><ul class="items" data-gid="${esc(g.id)}" aria-label="Itens de ${esc(g.name)}">${body}</ul></div></div></section>`;
  }
  function trayHTML(un, q, forceOpen) {
    let items = un;
    if (q) items = un.filter(e => fold(e.name).indexOf(q) >= 0);
    const tq = fold(S.trayQ.trim());
    if (tq) items = items.filter(e => fold(e.name).indexOf(tq) >= 0);
    let collapsed = S.trayCollapsed === null ? un.length === 0 : S.trayCollapsed;
    if (forceOpen && un.length) collapsed = false;
    const dragOn = app.classList.contains('is-drag-on');
    let h = `<section class="tray grp g-10${collapsed ? ' is-collapsed' : ''}" aria-label="Não agrupadas" id="tray"><div class="tray-h"><button type="button" class="tt" data-act="tray-toggle" data-fid="tt" aria-expanded="${collapsed ? 'false' : 'true'}"><span class="chev">${ic('chevron-down', 'xs')}</span><span>Não agrupadas</span><span class="ncount">${un.length}</span></button></div><div class="tray-body">`;
    if (!list(data && data.extensions).length) h += '<p class="tray-ok">Nenhuma extensão com painel encontrada.</p>';
    else if (!un.length) h += `<p class="tray-ok">${ic('check', 'sm')}Tudo agrupado.</p>`;
    else {
      if (un.length > 8) h += `<input class="tray-filter" data-fid="tf" id="trayQ" type="search" placeholder="Filtrar não agrupadas…" aria-label="Filtrar não agrupadas" value="${esc(S.trayQ)}">`;
      h += '<ul class="tray-list" aria-label="Extensões não agrupadas">';
      if (!items.length) h += '<li class="tray-ok">Nada encontrado.</li>';
      h += items.map(e => `<li class="item tray-item" data-ext="${esc(e.command)}"${dragOn ? ' draggable="true"' : ''}><span class="ibtn" title="${esc(e.views ? `${e.name}: ${e.views}` : e.name)}"><span class="iico">${ic(e.icon)}</span><span class="iname">${hl(e.name)}</span></span>` +
        `<button type="button" class="add" data-act="addto" data-ext="${esc(e.command)}" data-fid="ad:${esc(e.command)}" aria-haspopup="menu" aria-label="Adicionar ${esc(e.name)} a um grupo" title="Adicionar a…">${ic('plus', 'xs')}<span class="t">Adicionar a…</span></button></li>`).join('');
      h += '</ul>';
    }
    return `${h}</div></section>`;
  }
  const zoneHTML = () => `<button type="button" class="newzone" data-act="newgroup" data-fid="nz"><span class="when-idle">${ic('plus', 'sm')}Novo grupo</span><span class="when-drag">${ic('plus', 'sm')}Solte aqui para criar um grupo</span></button>`;
  const illustration = () => '<svg class="ill" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="8" width="36" height="10" rx="3"/><rect x="14" y="22" width="28" height="8" rx="3"/><rect x="14" y="34" width="28" height="8" rx="3"/><path d="M8 24v14"/></svg>';
  const tipsHTML = (withClose, inline) => `<div class="tips${inline ? ' inline' : ''}">${withClose ? `<button type="button" class="x" data-act="dismiss-hint" aria-label="Dispensar dica">${ic('x', 'xs')}</button>` : ''}<span><b>Arraste</b> uma extensão para um grupo.</span><span>Ou use <b>⋯ &gt; Mover para…</b> (teclado: Espaço e setas).</span><span>Tudo é salvo sozinho e dá para <b>Desfazer</b>.</span></div>`;
  function skeleton() {
    let h = '';
    for (let i = 0; i < 3; i++) h += '<div class="sk"></div><div class="sk s"></div><div class="sk s"></div>';
    if (S.slow) h += `<div class="slow"><span>${esc(S.slow)}</span>${S.slow.startsWith('O painel') ? '<button type="button" class="btn" data-act="reload" data-fid="rl">Recarregar</button>' : ''}</div>`;
    return h;
  }
  function build() {
    app.classList.toggle('is-drag-on', false);
    scrollEl.setAttribute('aria-busy', data ? 'false' : 'true');
    if (!data) return skeleton();
    const org = S.mode === 'org', noG = !groups.length;
    const allEmpty = !noG && groups.every(g => !g.items.length);
    const q = fold(S.q.trim());
    const dragOn = org || noG || allEmpty;
    app.classList.toggle('is-drag-on', dragOn);
    const un = unassigned();
    let h = '';
    if (sync.error) h += `<div class="errbar" role="alert"><div class="t">${ic('circle-alert', 'sm')}<span>Não foi possível salvar: ${esc(sync.error)}. Suas alterações continuam aqui como rascunho.</span></div><div class="acts"><button type="button" class="btn" data-act="retry" data-fid="rt">Tentar de novo</button><button type="button" class="btn danger" data-act="discard">Descartar alterações</button></div></div>`;
    const inv = data && data.stats ? data.stats.invalid : 0;
    if (inv > 0) h += `<div class="infobar" role="status">${ic('circle-alert', 'sm')}<span class="txt">${pl(inv, 'grupo ou item inválido não é exibido', 'grupos ou itens inválidos não são exibidos')}. Salvar remove isso da configuração. Confira no Settings (groupedTools.groups).</span><button type="button" class="btn" data-act="settings">Abrir Settings</button></div>`;
    if (S.notice) h += `<div class="infobar" role="status">${ic('info', 'sm')}<span class="txt">${esc(S.notice)}</span><button type="button" class="btn" data-act="dismiss-notice" data-fid="nt">Entendi</button></div>`;
    if (noG) {
      if (!S.welcomeDone) {
        h += `<section class="empty-state" aria-labelledby="wt">${illustration()}<h2 id="wt">Organize suas extensões em grupos.</h2><p>Crie grupos por assunto e chegue a cada ferramenta em um clique.</p><div class="acts"><button type="button" class="btn primary" data-act="suggest" data-fid="sg">Criar grupos sugeridos</button><button type="button" class="btn" data-act="zero">Começar do zero</button></div></section>${tipsHTML(false)}`;
      } else {
        h += `<section class="empty-state" aria-labelledby="wt">${illustration()}<h2 id="wt">Nenhum grupo ainda</h2><p>Comece com um grupo vazio e arraste extensões para ele.</p><div class="acts"><button type="button" class="btn primary" data-act="newgroup" data-fid="cf">Criar primeiro grupo</button><button type="button" class="btn link" data-act="suggest">Usar grupos sugeridos</button></div></section>`;
      }
      return h + zoneHTML() + trayHTML(un, '', true);
    }
    const broken = allItems().filter(i => i.installed === false).length;
    const showTray = S.tab === 'all' && (org || allEmpty || (S.searchTray && Boolean(q)));
    let al = '';
    if (broken && !S.dismissed.broken) al += `<div class="alert">${ic('circle-alert', 'sm')}<span class="txt">${pl(broken, 'item quebrado', 'itens quebrados')}</span><button type="button" class="lk" data-act="show-broken" data-fid="al1">${S.brokenOnly ? 'Mostrar todos' : 'Ver'}</button><button type="button" class="x" data-act="dismiss-broken" aria-label="Dispensar aviso de itens quebrados">${ic('x', 'xs')}</button></div>`;
    if (un.length && !S.dismissed.un && !showTray && S.tab === 'all') al += `<div class="alert">${ic('info', 'sm')}<span class="txt">${pl(un.length, 'extensão fora de grupos', 'extensões fora de grupos')}</span><button type="button" class="lk" data-act="show-tray" data-fid="al2">Ver</button><button type="button" class="x" data-act="dismiss-un" aria-label="Dispensar aviso de extensões fora de grupos">${ic('x', 'xs')}</button></div>`;
    if (al) h += `<div class="alerts">${al}</div>`;
    if (allEmpty && !S.dismissed.hint && !q) h += `<div class="tips inline"><button type="button" class="x" data-act="dismiss-hint" aria-label="Dispensar dica">${ic('x', 'xs')}</button><span><b>Todos os grupos estão vazios.</b> Arraste uma extensão da bandeja para um grupo, ou use <b>⋯ &gt; Mover para…</b>.</span>${org ? '' : '<span><button type="button" class="btn" data-act="enter-org" data-fid="eo">Organizar</button></span>'}</div>`;
    const filtered = Boolean(q) || S.tab === 'fav' || S.brokenOnly;
    let gl = '', total = 0;
    groups.forEach(g => {
      const vis = visItems(g, q);
      if (filtered && !vis.length) return;
      total += vis.length; gl += groupHTML(g, vis, filtered, q, org, dragOn);
    });
    S.resCount = total;
    if (!gl) {
      const trayHits = q ? un.filter(e => fold(e.name).indexOf(q) >= 0).length : 0;
      if (q) h += `<section class="empty-state small">${ic('search-x', 'ill')}<h2>Nada para “${esc(S.q.trim())}”</h2><div class="acts"><button type="button" class="btn" data-act="clear-q" data-fid="cq">Limpar busca</button>${trayHits ? `<button type="button" class="btn link" data-act="search-tray">Procurar também nas não agrupadas (${trayHits})</button>` : ''}</div></section>`;
      else if (S.brokenOnly) h += `<section class="empty-state small">${ic('check', 'ill')}<h2>Nenhum item quebrado</h2><div class="acts"><button type="button" class="btn" data-act="show-broken">Mostrar todos</button></div></section>`;
      else h += `<section class="empty-state small">${ic('star', 'ill')}<h2>Sem favoritos</h2><p>Toque na estrela de um item para fixá-lo aqui.</p></section>`;
    } else h += `<div class="groups" id="groups">${gl}</div>`;
    if (dragOn && !q && S.tab === 'all') h += zoneHTML();
    if (showTray) h += trayHTML(un, S.searchTray ? q : '', false);
    return h;
  }
  function render(focusFid) {
    const act = document.activeElement; let fid = focusFid, hadFocus = false;
    if (fid === undefined && act && scrollEl.contains(act)) { hadFocus = true; if (act.dataset && act.dataset.fid) fid = act.dataset.fid; }
    const st = scrollEl.scrollTop;
    rendering = true;
    scrollEl.innerHTML = build();
    scrollEl.scrollTop = st;
    const inp = S.edit ? $('[data-edit]', scrollEl) : null;
    if (inp) {
      inp.focus();
      if (S.edit.sel) { inp.select(); S.edit.sel = false; } else inp.setSelectionRange(inp.value.length, inp.value.length);
      inp.scrollIntoView({ block: 'nearest' });
    } else if (fid) {
      const el = $(`[data-fid="${cssq(fid)}"]`, app);
      if (el) { el.focus(); if (el.tagName === 'INPUT') el.setSelectionRange(el.value.length, el.value.length); }
      else if (hadFocus || focusFid) scrollEl.focus({ preventScroll: true });
    }
    rendering = false;
  }
  function renderFoot() {
    if (!data) { footEl.innerHTML = ''; return; }
    const n = allItems().length;
    const sum = `${pl(n, 'item', 'itens')} · ${pl(groups.length, 'grupo', 'grupos')} · ${pl(unassigned().length, 'não agrupada', 'não agrupadas')}`;
    let st = '';
    if (S.save === 'saving') st = `<span class="st" title="Salvando…">${ic('loader', 'xs spin')}<span class="tt">Salvando…</span></span>`;
    else if (S.save === 'saved') st = `<span class="st" title="Salvo em ${scopeName()}">${ic('check', 'xs')}<span class="tt">Salvo em ${scopeName()}</span></span>`;
    else if (S.save === 'error') st = `<span class="st err" title="Erro ao salvar">${ic('circle-alert', 'xs')}<span class="tt">Erro ao salvar</span></span>`;
    footEl.innerHTML = `<span class="sum" title="${esc(sum)}">${esc(sum)}</span>${st}<button type="button" class="icbtn" data-act="settings" aria-label="Abrir Settings" title="Abrir Settings">${ic('settings', 'sm')}</button>`;
  }
  function syncTop() {
    const org = S.mode === 'org', q = S.q.trim();
    const dis = Boolean(q) || S.tab === 'fav' || !data;
    btnOrg.disabled = dis;
    btnOrg.setAttribute('aria-pressed', org ? 'true' : 'false');
    btnOrg.innerHTML = `${ic(org ? 'check' : 'sliders-horizontal', 'sm')}<span class="lbl">${org ? 'Concluir' : 'Organizar'}</span>`;
    btnOrg.setAttribute('aria-label', org ? 'Concluir organização' : 'Organizar');
    btnOrg.title = q ? 'Limpe a busca para organizar (evita reordenar uma lista filtrada).' : S.tab === 'fav' ? 'Organizar fica disponível na aba Todas.' : org ? 'Concluir organização' : 'Organizar: arrastar, renomear, cor e ícone';
    $('#segAll').setAttribute('aria-pressed', S.tab === 'all' ? 'true' : 'false');
    $('#segFav').setAttribute('aria-pressed', S.tab === 'fav' ? 'true' : 'false');
    btnScope.innerHTML = `${ic(activeScope() === 'global' ? 'globe' : 'folder', 'xs')}<span class="lbl">${scopeName()}</span><span class="chev">${ic('chevron-down', 'xs')}</span>`;
    btnScope.setAttribute('aria-label', `Escopo: ${scopeName()}`);
    btnScope.title = `Escopo: ${scopeName()}${activeScope() === 'workspace' ? '. Itens fixados na barra de atividades valem para todos os projetos; edite no escopo Global.' : '. Itens fixados na barra de atividades são definidos aqui.'}`;
    app.classList.toggle('is-org', org);
    $('#qClear').hidden = !S.q;
    const allCol = groups.length > 0 && groups.every(g => S.collapsed[g.id]);
    const fl = allCol ? 'Expandir todos' : 'Recolher todos';
    btnFold.innerHTML = `${ic(allCol ? 'chevrons-up-down' : 'chevrons-down-up', 'sm')}<span class="lbl">${allCol ? 'Expandir' : 'Recolher'}</span>`;
    btnFold.disabled = !groups.length || Boolean(q) || !data;
    btnFold.setAttribute('aria-label', fl);
    btnFold.title = !groups.length ? 'Não há grupos' : q ? 'Indisponível durante a busca' : `${fl} (Alt+Shift+C)`;
  }
  function fullRender(focus) { render(focus); syncTop(); renderFoot(); }

  // ---- pinned groups (Global scope) -------------------------------------------------------------------------
  const inCat = k => CAT.PIN_ICONS.indexOf(k) >= 0;
  const pinName = k => CAT.pinName(k);
  // The badge reads the Global pins: the draft in Global scope, the extension's list in the project scope.
  function isPinned(g) { return activeScope() === 'global' ? Boolean(g.pinned) : list(data && data.pins).some(p => p.groupId === g.id); }
  function pinAnchor(gid) { return $(`[data-fid="gk:${cssq(gid)}"]`, app) || btnOrg; }
  function pinMenuItems(g) {
    const st = M.pinState(groups, g, activeScope());
    if (st.state === 'scope') return [{ label: isPinned(g) ? 'Desafixar da barra de atividades' : 'Fixar na barra de atividades', hint: 'Itens fixados valem para todos os projetos; edite no escopo Global', ic: 'pin', soft: true }];
    if (st.state === 'pinned') return [{ label: 'Desafixar da barra de atividades', hint: `O ícone “${pinName(g.icon)}” sai da barra e fica livre`, ic: 'pin', go() { unpinGroup(g.id); } }];
    if (st.state === 'free') return [{ label: 'Fixar na barra de atividades', hint: `Aparece na barra com o ícone “${pinName(g.icon)}”`, ic: 'pin', go() { pinGroup(g.id); } }];
    if (st.state === 'conflict') {
      return [
        { label: 'Fixar na barra de atividades', hint: `O ícone “${pinName(g.icon)}” já é usado por “${st.owner.name}” (fixado).`, ic: 'pin', soft: true },
        { label: 'Trocar o ícone deste grupo…', ic: 'palette', go() { openPicker(pinAnchor(g.id), { kind: 'group', id: g.id, pin: true }); } },
        { label: `Desafixar “${st.owner.name}” e fixar este`, ic: 'pin', go() { replacePin(st.owner.id, g.id); } }
      ];
    }
    return [{ label: 'Fixar na barra de atividades', hint: 'O ícone atual não é fixável: você escolherá um da lista e ele vira o ícone do grupo.', ic: 'pin', go() { openPicker(pinAnchor(g.id), { kind: 'group', id: g.id, pin: true }); } }];
  }
  function pinGroup(gid) {
    commit(() => {
      const g = gById(gid), r = M.setPinned(groups, gid, true); if (!r.changed) return { skip: true };
      groups = r.groups;
      return { op: `“${g.name}” fixado na barra de atividades`, say: `Grupo ${g.name} fixado na barra de atividades com o ícone ${pinName(g.icon)}.`, focus: `gk:${gid}` };
    });
  }
  function unpinGroup(gid) {
    commit(() => {
      const g = gById(gid), r = M.setPinned(groups, gid, false); if (!r.changed) return { skip: true };
      groups = r.groups;
      return { op: `“${g.name}” desafixado da barra de atividades`, say: `Grupo ${g.name} desafixado. O ícone ${pinName(g.icon)} saiu da barra e ficou livre.`, focus: `gk:${gid}` };
    });
  }
  function replacePin(ownerId, gid) {
    commit(() => {
      const o = gById(ownerId), g = gById(gid), r = M.replacePin(groups, ownerId, gid); if (!r.changed) return { skip: true };
      groups = r.groups;
      return { op: `“${o.name}” desafixado; “${g.name}” fixado`, say: `${o.name} desafixado. ${g.name} fixado com o ícone ${pinName(g.icon)}.`, focus: `gk:${gid}` };
    });
  }

  // ---- popovers and menus ------------------------------------------------------------------------------------
  function placePop(node, anchor) {
    const pr = app.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const w = node.offsetWidth, h = node.offsetHeight;
    let left = ar.left - pr.left, top = ar.bottom - pr.top + 4;
    left = Math.max(8, Math.min(left, pr.width - w - 8));
    if (top + h > pr.height - 8) { const up = ar.top - pr.top - h - 4; top = up > 8 ? up : Math.max(8, pr.height - h - 8); }
    // CSSOM (not a style attribute): allowed by the CSP and only used for popover coordinates.
    node.style.setProperty('left', `${Math.round(left)}px`); node.style.setProperty('top', `${Math.round(top)}px`);
  }
  function openPop(anchor, node, onClose) {
    closePop(false);
    overlay.appendChild(node);
    pop = { node, anchor, fid: anchor && anchor.dataset ? anchor.dataset.fid : null, onClose };
    placePop(node, anchor);
    return pop;
  }
  function closePop(refocus) {
    if (!pop) return;
    const p = pop; pop = null; p.node.remove(); if (p.onClose) p.onClose();
    if (refocus && p.fid) { const el = $(`[data-fid="${cssq(p.fid)}"]`, app); if (el) el.focus(); }
  }
  document.addEventListener('pointerdown', e => {
    if (pop && !pop.node.contains(e.target) && !(pop.anchor && pop.anchor.contains && pop.anchor.contains(e.target))) closePop(false);
  }, true);
  scrollEl.addEventListener('scroll', () => { if (pop) closePop(false); });
  window.addEventListener('resize', () => { if (pop) placePop(pop.node, pop.anchor); });

  function openMenu(anchor, items, o) {
    o = o || {};
    if (pop && pop.fid && anchor.dataset.fid && pop.fid === anchor.dataset.fid) { closePop(true); return; }
    const m = document.createElement('div'); m.className = 'pop menu'; m.setAttribute('role', 'menu');
    if (o.label) m.setAttribute('aria-label', o.label);
    function fill(its) {
      m._items = its;
      m.innerHTML = its.map((it, i) => {
        if (it.sep) return '<div class="sep" role="separator"></div>';
        if (it.head) return `<div class="mh" role="presentation">${esc(it.head)}</div>`;
        const lead = it.ic ? ic(it.ic, 'sm') : (it.radio ? `<span class="ck">${it.checked ? ic('check', 'sm') : ''}</span>` : '');
        return `<button type="button" role="${it.radio ? 'menuitemradio' : 'menuitem'}"${it.radio ? ` aria-checked="${it.checked ? 'true' : 'false'}"` : ''} class="${it.danger ? 'danger' : ''}" data-i="${i}" tabindex="-1"${it.disabled ? ' disabled' : ''}${it.soft ? ' aria-disabled="true"' : ''}>${lead}` +
          `<span class="mi-t"><span>${esc(it.label)}</span>${it.hint ? `<span class="mi-h">${esc(it.hint)}</span>` : ''}</span></button>`;
      }).join('');
      if (pop) placePop(m, anchor);
      const b = $('button:not([disabled])', m); if (b) b.focus();
    }
    m.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const it = m._items[Number(b.dataset.i)];
      if (it.soft) { announce(it.hint || 'Indisponível.'); return; }
      if (it.sub) { fill(it.sub()); return; }
      closePop(false); if (it.go) it.go();
    });
    m.addEventListener('keydown', e => {
      const bs = $$('button:not([disabled])', m), i = bs.indexOf(document.activeElement);
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
    const n = document.createElement('div'); n.className = 'pop dlg'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', o.title || 'Confirmação');
    n.innerHTML = `<p>${esc(o.text)}</p><div class="acts">${o.btns.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
    n.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const def = o.btns[Number(b.dataset.i)]; closePop(!def.go); if (def.go) def.go();
    });
    n.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(true); } });
    openPop(anchor, n);
    const last = n.querySelectorAll('button'); last[last.length - 1].focus();
  }

  // color and icon of a group
  function openStylePop(anchor, gid) {
    if (!gById(gid)) return;
    const n = document.createElement('div'); n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', `Cor e ícone de ${gById(gid).name}`);
    function paint() {
      const g = gById(gid);
      n.className = `pop stylepop grp ${M.colorOf(g)}`;
      n.innerHTML = `<div><div class="pop-t">Cor do grupo</div><div class="swatches" role="radiogroup" aria-label="Cor do grupo">${M.COLORS.map(c =>
        `<button type="button" role="radio" class="sw grp ${c}" data-c="${c}" aria-checked="${c === M.colorOf(g)}" aria-label="${cname(c)}" title="${cname(c)}" tabindex="${c === M.colorOf(g) ? 0 : -1}">${ic('check')}</button>`).join('')
      }</div></div><div><div class="pop-t">Ícone</div><button type="button" class="btn" data-ico>${ic(g.icon, 'sm')}<span>Ícone: ${esc(g.icon)}</span>${ic('chevron-right', 'xs')}</button></div>`;
    }
    paint();
    function pick(k) {
      if (!gById(gid) || k === M.colorOf(gById(gid))) return;
      commit(() => { const g = gById(gid); g.color = k; return { op: `Cor de “${g.name}”: ${cname(k)}`, say: `Cor de ${g.name}: ${cname(k)} (selecionada)`, focus: null }; });
      paint(); const sw = $(`.sw[data-c="${k}"]`, n); if (sw) sw.focus();
    }
    n.addEventListener('click', e => {
      const s = e.target.closest('.sw'); if (s) { pick(s.dataset.c); return; }
      if (e.target.closest('[data-ico]')) { closePop(false); openPicker(anchor, { kind: 'group', id: gid }); }
    });
    n.addEventListener('keydown', e => {
      const s = e.target.closest('.sw');
      if (e.key === 'Escape') { e.stopPropagation(); closePop(true); return; }
      if (!s) return;
      const all = $$('.sw', n), i = all.indexOf(s); let nx = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nx = all[(i + 1) % all.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nx = all[(i - 1 + all.length) % all.length];
      if (nx) { e.preventDefault(); pick(nx.dataset.c); }
    });
    openPop(anchor, n);
    (($('.sw[aria-checked="true"]', n)) || $('.sw', n)).focus();
  }

  // icon picker: every Lucide icon, searched and paged (never all rendered at once)
  function openPicker(anchor, target) {
    const isGroup = target.kind === 'group';
    const obj = isGroup ? gById(target.id) : (findItem(target.id) || {}).it;
    if (!obj) return;
    const colorCls = isGroup ? M.colorOf(obj) : M.colorOf(findItem(target.id).g);
    const mode = target.pin ? 'pin' : (isGroup && activeScope() === 'global' && obj.pinned ? 'locked' : 'free');
    const base = target.pin ? ICON_NAMES.filter(inCat) : ICON_NAMES;
    const blocked = k => (isGroup ? M.iconBlock(groups, obj, k, mode) : '');
    const note = target.pin ? 'Escolha um ícone fixável. Ele também passa a ser o ícone do grupo (uma operação só, com Desfazer).' : mode === 'locked' ? 'Este grupo está fixado: só ícones fixáveis e livres. Desafixe para usar outros.' : '';
    const n = document.createElement('div'); n.className = `pop picker grp ${colorCls}`; n.setAttribute('role', 'dialog');
    n.setAttribute('aria-label', `${target.pin ? 'Escolha um ícone fixável para ' : 'Escolher ícone para '}${obj.name}`);
    n.innerHTML = `<div class="search"><span class="s-ic">${ic('search', 'sm')}</span><input type="search" placeholder="Buscar ícone (ex.: git, banco, nuvem)…" aria-label="Buscar ícone" autocomplete="off"></div>${
      note ? `<p class="pk-note">${ic('info', 'xs')}<span>${esc(note)}</span></p>` : ''
    }<div class="pk-cur">${ic(obj.icon, 'pk-preview')}<span>Atual: ${esc(obj.icon)}</span></div><div data-rec></div><div class="pk-sec" data-lbl></div><div class="pk-grid" role="listbox" aria-label="Ícones" data-grid></div><div data-more></div>`;
    const inp = $('input', n), grid = $('[data-grid]', n), more = $('[data-more]', n), rec = $('[data-rec]', n), lbl = $('[data-lbl]', n);
    let shown = PAGE, query = '', results = base;
    function cell(k, tab) {
      const why = blocked(k);
      const label = `${k.replace(/-/g, ' ')}${inCat(k) ? ` (${pinName(k)})` : ''}${why ? `, indisponível: ${why}` : ''}`;
      return `<button type="button" class="pk-cell${why ? ' blocked' : ''}" role="option" data-k="${esc(k)}" aria-selected="${k === obj.icon}"${why ? ' aria-disabled="true"' : ''} aria-label="${esc(label)}" title="${esc(why || (mode !== 'free' && inCat(k) ? `${pinName(k)} (fixável)` : k))}" tabindex="${tab ? 0 : -1}">${ic(k)}${why ? `<span class="lk">${ic('lock', 'xxs')}</span>` : ''}</button>`;
    }
    function draw(say) {
      const part = results.slice(0, shown);
      const rc = S.recents.filter(k => Object.hasOwn(I, k) && (!target.pin || inCat(k)));
      rec.innerHTML = (!query.trim() && rc.length) ? `<div class="pk-sec">Recentes</div><div class="pk-grid small" role="listbox" aria-label="Ícones recentes">${rc.map((k, i) => cell(k, i === 0)).join('')}</div>` : '';
      lbl.textContent = query.trim() ? pl(results.length, 'ícone', 'ícones') : (target.pin ? `Ícones fixáveis (${base.length})` : `Todos os ícones (${base.length})`);
      grid.innerHTML = part.length ? part.map((k, i) => cell(k, i === 0)).join('') : `<p class="pk-empty">Nenhum ícone para “${esc(query.trim())}”. Tente em inglês, ex.: git.</p>`;
      more.innerHTML = results.length > shown ? `<button type="button" class="pk-more" data-more-btn>Mostrar mais (${results.length - shown})</button>` : '';
      if (say) announce(results.length ? pl(results.length, 'ícone', 'ícones') : 'Nenhum ícone encontrado');
    }
    draw(false);
    let t; inp.addEventListener('input', () => {
      query = inp.value; shown = PAGE; clearTimeout(t);
      t = setTimeout(() => { results = query.trim() ? M.searchIcons(base, TAGS, query) : base; draw(true); }, 120);
    });
    function choose(k) {
      const why = blocked(k); if (why) { announce(why); return; }
      S.recents = [k].concat(S.recents.filter(x => x !== k)).slice(0, 12); persist();
      const focus = isGroup ? `gt:${target.id}` : `ib:${target.id}`;
      closePop(false);
      if (target.pin) {
        commit(() => {
          const r = M.pinWithIcon(groups, target.id, k); if (!r.changed) return { skip: true, say: 'Não foi possível fixar com esse ícone.' };
          groups = r.groups;
          return { op: `“${obj.name}” fixado na barra de atividades com o ícone “${pinName(k)}”`, say: `Grupo ${obj.name} fixado na barra de atividades. O ícone do grupo agora é ${pinName(k)}.`, focus: `gk:${target.id}` };
        });
        return;
      }
      if (k === obj.icon) { render(focus); return; }
      commit(() => { const cur = isGroup ? gById(target.id) : findItem(target.id).it; cur.icon = k; return { op: `Ícone de “${obj.name}”: ${k}`, say: `Ícone de ${obj.name} alterado para ${k.replace(/-/g, ' ')}`, focus }; });
    }
    n.addEventListener('click', e => {
      const c = e.target.closest('.pk-cell'); if (c) { choose(c.dataset.k); return; }
      if (e.target.closest('[data-more-btn]')) { shown += PAGE; draw(false); const cells = $$('.pk-cell', grid); if (cells[shown - PAGE]) cells[shown - PAGE].focus(); }
    });
    n.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePop(true); return; }
      if (e.target === inp) {
        if (e.key === 'ArrowDown') { e.preventDefault(); const f = $('.pk-cell', rec) || $('.pk-cell', grid); if (f) f.focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); const l = results.filter(k => !blocked(k)); if (l.length && query.trim()) choose(l[0]); }
        return;
      }
      const cur0 = e.target.closest('.pk-cell'); if (!cur0) return;
      const g2 = cur0.parentElement, cells = $$('.pk-cell', g2), i = cells.indexOf(cur0);
      const cols = getComputedStyle(g2).gridTemplateColumns.split(' ').length || 1; let ni = -1;
      if (e.key === 'ArrowRight') ni = i + 1; else if (e.key === 'ArrowLeft') ni = i - 1;
      else if (e.key === 'ArrowDown') ni = i + cols; else if (e.key === 'ArrowUp') ni = i - cols;
      else if (e.key === 'Home') ni = 0; else if (e.key === 'End') ni = cells.length - 1;
      else return;
      e.preventDefault();
      const first = $('.pk-cell', rec);
      if (ni < 0 && e.key === 'ArrowUp') { if (g2 === grid && first) first.focus(); else inp.focus(); return; }
      if (ni >= cells.length && g2 !== grid && e.key === 'ArrowDown') { const mainFirst = $('.pk-cell', grid); if (mainFirst) mainFirst.focus(); return; }
      if (ni >= cells.length && g2 === grid && shown < results.length) { shown += PAGE; draw(false); const again = $$('.pk-cell', grid); if (again[ni]) { again[ni].tabIndex = 0; again[ni].focus(); } return; }
      if (ni >= 0 && ni < cells.length) { cells.forEach(c => { c.tabIndex = -1; }); cells[ni].tabIndex = 0; cells[ni].focus(); }
    });
    openPop(anchor, n);
    inp.focus();
  }

  // add a free VS Code command as an item
  function openCommandForm(anchor, gid) {
    const g = gById(gid); if (!g) return;
    const n = document.createElement('div'); n.className = 'pop fm'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', `Adicionar comando a ${g.name}`);
    n.innerHTML = '<label for="cmdName">Nome</label><input id="cmdName" maxlength="100" autocomplete="off"><label for="cmdId">Comando do VS Code</label><input id="cmdId" autocomplete="off" spellcheck="false" placeholder="ex.: workbench.action.terminal.toggleTerminal"><div class="field-err" id="cmdErr" hidden></div><div class="acts"><button type="button" class="btn primary" data-ok>Adicionar</button><button type="button" class="btn" data-cancel>Cancelar</button></div>';
    const name = $('#cmdName', n), cmd = $('#cmdId', n), err = $('#cmdErr', n);
    function submit() {
      const nm = name.value.trim(), cm = cmd.value.trim();
      const problem = !nm ? 'Dê um nome ao item.' : !cm ? 'Informe o comando.' : M.BLOCKED_COMMANDS.includes(cm) ? 'Esse comando não pode ser usado.' : '';
      name.setAttribute('aria-invalid', String(!nm)); cmd.setAttribute('aria-invalid', String(Boolean(nm) && !cm));
      err.hidden = !problem; err.innerHTML = problem ? `${ic('circle-alert', 'xs')}${esc(problem)}` : '';
      if (problem) { (nm ? cmd : name).focus(); return; }
      closePop(false);
      placeItem({ type: 'command', name: nm, command: cm }, gid, Infinity);
    }
    n.addEventListener('click', e => { if (e.target.closest('[data-ok]')) submit(); else if (e.target.closest('[data-cancel]')) closePop(true); });
    n.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(true); } else if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    openPop(anchor, n);
    name.focus();
  }

  // ---- menus of group and item ---------------------------------------------------------------------------------
  function groupChoices(onPick, includeNew, current) {
    const items = groups.map(g => ({ label: g.name, radio: true, checked: g.id === current, go() { onPick(g.id); } }));
    if (includeNew) { items.push({ sep: true }); items.push({ label: 'Novo grupo', ic: 'plus', go() { onPick(null); } }); }
    return items;
  }
  function addItemMenu(gid) {
    const un = unassigned();
    const entries = [{ head: 'Adicionar item a este grupo' }];
    if (un.length) un.forEach(e => entries.push({ label: e.name, ic: e.icon, go() { placeItem({ type: 'tray', ext: e.command }, gid, Infinity); } }));
    else entries.push({ label: 'Todas as extensões já estão em grupos.', ic: 'check', disabled: true });
    entries.push({ sep: true }, { label: 'Comando do VS Code…', ic: 'terminal', go() { openCommandForm(pinAnchor(gid), gid); } });
    return entries;
  }
  function groupMenu(gid) {
    const g = gById(gid), idx = groups.indexOf(g);
    return [
      { label: 'Renomear', ic: 'pencil', go() { S.edit = { type: 'group', id: gid, sel: true }; render(null); announce(`Renomear grupo ${g.name}. Enter confirma, Esc cancela.`); } },
      { label: 'Cor e ícone', ic: 'palette', go() { openStylePop(pinAnchor(gid), gid); } },
      { label: 'Mover para cima', ic: 'arrow-up', disabled: idx === 0, go() { moveGroupBy(gid, -1); } },
      { label: 'Mover para baixo', ic: 'arrow-down', disabled: idx === groups.length - 1, go() { moveGroupBy(gid, 1); } },
      { label: 'Adicionar item…', ic: 'plus', sub() { return addItemMenu(gid); } }
    ].concat(pinMenuItems(g), [{ sep: true }, { label: 'Excluir grupo', ic: 'trash', danger: true, go() { deleteGroup(gid); } }]);
  }
  function itemMenu(iid) {
    const f = findItem(iid); if (!f) return [];
    const back = () => itemMenu(iid);
    function posMenu(gid) {
      const g = gById(gid);
      return [{ head: `Posição em ${g.name}` }, { label: 'No fim', go() { placeItem({ type: 'item', id: iid }, gid, Infinity); } }, { label: 'No início', go() { placeItem({ type: 'item', id: iid }, gid, 0); } }, { sep: true }, { label: 'Voltar', ic: 'chevron-left', sub: moveMenu }];
    }
    function moveMenu() {
      const here = findItem(iid);
      const entries = [{ head: 'Mover para…' }];
      groups.forEach(g => entries.push({ label: g.name, radio: true, checked: here && g.id === here.g.id, sub() { return posMenu(g.id); } }));
      entries.push({ sep: true }, { label: 'Novo grupo', ic: 'plus', go() { placeItem({ type: 'item', id: iid }, null, 0); } }, { label: 'Voltar', ic: 'chevron-left', sub: back });
      return entries;
    }
    return [
      { label: 'Mover para…', ic: 'move', sub: moveMenu },
      { label: 'Trocar ícone', ic: 'palette', go() { openPicker($(`[data-fid="ik:${cssq(iid)}"]`, app) || btnOrg, { kind: 'item', id: iid }); } },
      { label: 'Renomear', ic: 'pencil', go() { S.edit = { type: 'item', id: iid, sel: true }; render(null); announce('Renomear item. Enter confirma, Esc cancela.'); } },
      { sep: true },
      { label: 'Remover do grupo', ic: 'trash', danger: true, go() { removeItem(iid); } }
    ];
  }

  // ---- mutations ------------------------------------------------------------------------------------------------
  function takeItem(d) {
    if (d.type === 'tray') { const ext = extByCommand(d.ext); return ext ? M.itemFromExtension(ext) : null; }
    if (d.type === 'command') return { id: M.newId('new-'), name: d.name, command: d.command, icon: 'terminal', favorite: false, kind: 'command', installed: null };
    const f = findItem(d.id); if (!f) return null;
    f.g.items.splice(f.i, 1); return f.it;
  }
  function newGroup() { return { id: M.newId('grp-'), name: 'Novo grupo', icon: 'folder', color: M.COLORS[groups.length % 9], items: [] }; }
  function placeItem(d, gid, index) {
    const pre = d.type === 'item' ? findItem(d.id) : null;
    if (gid === null && groups.length >= M.MAX_GROUPS) { announce(`Limite de ${M.MAX_GROUPS} grupos atingido.`); return; }
    commit(() => {
      const it = takeItem(d); if (!it) return { skip: true };
      let g;
      if (gid === null) { g = newGroup(); groups.push(g); S.edit = { type: 'group', id: g.id, sel: true, fresh: true }; } else g = gById(gid);
      const at = Math.max(0, Math.min(index, g.items.length));
      g.items.splice(at, 0, it); S.collapsed[g.id] = false; persist();
      if (pre && pre.g.id === g.id && pre.i === at) return { skip: true, focus: `ib:${it.id}` };
      const verb = d.type === 'item' ? 'movido para' : 'adicionado a';
      return { op: `${it.name} ${verb} ${g.name}`, say: `${it.name} ${verb} ${g.name}, posição ${at + 1} de ${g.items.length}${gid === null ? '. Digite o nome do novo grupo.' : ''}`, focus: gid === null ? null : `ib:${it.id}` };
    });
  }
  function removeItem(iid) {
    if (!findItem(iid)) return;
    commit(() => {
      const f = findItem(iid); f.g.items.splice(f.i, 1);
      const nb = f.g.items[f.i] || f.g.items[f.i - 1];
      const back = f.it.kind === 'extension' && f.it.installed !== false;
      return { op: `${f.it.name} removido de ${f.g.name}`, say: `${f.it.name} removido de ${f.g.name}${back ? '; voltou às não agrupadas' : ''}`, focus: nb ? `ib:${nb.id}` : `gt:${f.g.id}` };
    });
  }
  function moveGroupBy(id, dir) {
    const i = groups.findIndex(g => g.id === id), n = i + dir;
    if (i < 0 || n < 0 || n >= groups.length) return;
    commit(() => {
      const g = groups.splice(i, 1)[0]; groups.splice(n, 0, g);
      const m = `Grupo ${g.name} movido para posição ${n + 1} de ${groups.length}`;
      return { op: m, say: m, focus: `gk:${id}` };
    });
  }
  function moveGroup(id, index) {
    commit(() => {
      const i = groups.findIndex(g => g.id === id); if (i < 0) return { skip: true };
      const g = groups.splice(i, 1)[0]; groups.splice(index, 0, g);
      if (i === index) return { skip: true };
      const m = `Grupo ${g.name} movido para posição ${index + 1} de ${groups.length}`;
      return { op: m, say: m, focus: S.mode === 'org' ? `gg:${id}` : `gt:${id}` };
    });
  }
  function deleteGroup(gid) {
    const g = gById(gid); if (!g) return;
    if (g.items.length) { S.confirmDel = gid; render(`dc:${gid}`); announce(`Excluir ${g.name} e seus ${g.items.length} itens? Escolha Excluir ou Cancelar.`); return; }
    doDelete(gid);
  }
  function doDelete(gid) {
    commit(() => {
      const i = groups.findIndex(g => g.id === gid); if (i < 0) return { skip: true };
      const g = groups.splice(i, 1)[0]; S.confirmDel = null;
      const nb = groups[i] || groups[i - 1];
      const back = g.items.filter(x => x.kind === 'extension' && x.installed !== false).length;
      return { op: `Grupo “${g.name}” excluído`, say: `Grupo ${g.name} excluído${back ? `; ${pl(back, 'extensão voltou', 'extensões voltaram')} à bandeja` : ''}${g.pinned ? `; o ícone ${pinName(g.icon)} saiu da barra de atividades` : ''}`, focus: nb ? `gt:${nb.id}` : 'org' };
    });
  }
  function createGroup() {
    if (groups.length >= M.MAX_GROUPS) { announce(`Limite de ${M.MAX_GROUPS} grupos atingido.`); toast({ text: `Limite de ${M.MAX_GROUPS} grupos atingido. Exclua um grupo para criar outro.` }); return; }
    commit(() => {
      const g = newGroup(); groups.push(g); S.edit = { type: 'group', id: g.id, sel: true, fresh: true };
      return { op: 'Grupo criado', say: 'Grupo criado. Digite o nome e tecle Enter.', focus: null };
    });
  }
  function suggest() {
    sync.draft = false;
    api.postMessage({ type: 'useSuggested', scope: activeScope(), op: 'Grupos sugeridos' });
    S.welcomeDone = true; setSave('saving'); announce('Criando os grupos sugeridos.');
  }
  function finishEdit(mode) {
    const ed = S.edit; if (!ed) return;
    const inp = $('[data-edit]', scrollEl), raw = inp ? inp.value : (ed.val || ''), val = raw.trim();
    const focus = ed.type === 'group' ? `gt:${ed.id}` : `ib:${ed.id}`;
    if (!mode) { S.edit = null; render(focus); announce('Edição cancelada'); return; }
    if (!val) {
      if (mode === 'blur') { S.edit = null; render(null); return; }
      ed.err = true; ed.val = raw; ed.sel = false; render(); announce(`Dê um nome ao ${ed.type === 'group' ? 'grupo' : 'item'}.`); return;
    }
    S.edit = null;
    const obj = ed.type === 'group' ? gById(ed.id) : (findItem(ed.id) || {}).it;
    if (!obj || obj.name === val) { render(focus); return; }
    commit(() => { obj.name = val; return { op: `${ed.type === 'group' ? 'Grupo' : 'Item'} renomeado para “${val}”`, focus }; });
  }

  // ---- drag and drop (HTML5) --------------------------------------------------------------------------------------
  function mkLine(tag, text) {
    const l = document.createElement(tag); l.className = 'drop-line'; l.setAttribute('aria-hidden', 'true');
    const i = document.createElement('i'), s = document.createElement('small'); s.textContent = text || ''; l.append(i, s); return l;
  }
  function clearHints(keepTimer) {
    $$('.drop-line', scrollEl).forEach(l => l.remove());
    $$('.drag-over,.is-over', scrollEl).forEach(x => x.classList.remove('drag-over', 'is-over'));
    if (!keepTimer && drag && drag.expT) { clearTimeout(drag.expT); drag.expT = null; drag.exp = null; }
  }
  const canUnassign = id => { const f = findItem(id); return Boolean(f && f.it.kind === 'extension'); };
  function computeTarget(e) {
    const el = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement); if (!el) return null;
    const y = e.clientY;
    if (drag.type === 'group') {
      const gs = $('#groups', scrollEl); if (!gs || !el.closest('.scroll')) return null;
      const secs = $$('.group', gs).filter(s => !s.classList.contains('is-source'));
      for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return { kind: 'group', index: i, ref: secs[i], gs }; }
      return { kind: 'group', index: secs.length, ref: null, gs };
    }
    if (el.closest('.newzone')) return { kind: 'new' };
    if (el.closest('.tray')) return (drag.type === 'item' && canUnassign(drag.id)) ? { kind: 'tray' } : null;
    const sec = el.closest('.group');
    if (!sec) return el.closest('.groups') ? drag.target : null;
    const gid = sec.dataset.gid, collapsed = sec.classList.contains('is-collapsed');
    if (el.closest('.ghead') || collapsed) return { kind: 'end', gid, sec, expand: collapsed };
    const ul = $('ul.items', sec); if (!ul) return null;
    const lis = $$(':scope > li.item', ul).filter(l => !l.classList.contains('is-source'));
    for (let j = 0; j < lis.length; j++) { const r = lis[j].getBoundingClientRect(); if (y < r.top + r.height / 2) return { kind: 'item', gid, index: j, ref: lis[j], ul, sec }; }
    return { kind: 'item', gid, index: lis.length, ref: null, ul, sec };
  }
  function showHints(t) {
    const keep = t.kind === 'end' && t.expand;
    clearHints(keep);
    if (t.kind === 'group') t.gs.insertBefore(mkLine('div', `posição ${t.index + 1}`), t.ref);
    else if (t.kind === 'new') $('.newzone', scrollEl).classList.add('is-over');
    else if (t.kind === 'tray') $('.tray', scrollEl).classList.add('is-over');
    else if (t.kind === 'end') {
      t.sec.classList.add('drag-over');
      if (t.expand && drag.exp !== t.gid) {
        drag.exp = t.gid; clearTimeout(drag.expT);
        drag.expT = setTimeout(() => {
          S.collapsed[t.gid] = false; persist(); t.sec.classList.remove('is-collapsed');
          const tg = $('.gtoggle', t.sec); if (tg) tg.setAttribute('aria-expanded', 'true');
        }, 600);
      } else if (!t.expand && drag.expT) { clearTimeout(drag.expT); drag.expT = null; drag.exp = null; }
    } else if (t.kind === 'item') {
      const g = gById(t.gid);
      t.ul.insertBefore(mkLine('li', `em ${g ? g.name : ''} · posição ${t.index + 1}`), t.ref);
    }
  }
  function endDrag() {
    if (!drag) return;
    clearHints(); clearTimeout(drag.expT);
    $$('.is-source,.is-lifted', scrollEl).forEach(x => x.classList.remove('is-source', 'is-lifted'));
    const gs = $('#groups', scrollEl); if (gs) gs.classList.remove('reorder');
    app.classList.remove('is-dragging'); drag = null;
  }
  scrollEl.addEventListener('dragstart', e => {
    const li = e.target.closest && e.target.closest('li.item[draggable="true"]');
    const gh = e.target.closest && e.target.closest('.ghead[draggable="true"]');
    if (li && li.classList.contains('tray-item')) drag = { type: 'tray', ext: li.dataset.ext, el: li };
    else if (li) drag = { type: 'item', id: li.dataset.iid, el: li };
    else if (gh) drag = { type: 'group', id: gh.parentElement.dataset.gid, el: gh.parentElement };
    else return;
    drag.dropped = false; drag.target = null;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', drag.id || drag.ext); } catch (x) { /* ignore */ }
    const el = drag.el; el.classList.add('is-lifted');
    setTimeout(() => {
      if (!drag) return;
      el.classList.remove('is-lifted'); el.classList.add('is-source'); app.classList.add('is-dragging');
      if (drag.type === 'group') { const gs = $('#groups', scrollEl); if (gs) gs.classList.add('reorder'); }
    }, 0);
  });
  scrollEl.addEventListener('dragover', e => {
    if (!drag) return;
    const t = computeTarget(e); drag.target = t;
    if (!t) { e.dataTransfer.dropEffect = 'none'; clearHints(); return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    showHints(t);
    const r = scrollEl.getBoundingClientRect();
    if (e.clientY < r.top + 40) scrollEl.scrollTop -= 10; else if (e.clientY > r.bottom - 40) scrollEl.scrollTop += 10;
  });
  scrollEl.addEventListener('drop', e => {
    if (!drag) return;
    e.preventDefault();
    const d = { type: drag.type, id: drag.id, ext: drag.ext }, t = drag.target;
    drag.dropped = true; endDrag();
    if (!t) { announce('Movimento cancelado'); return; }
    if (d.type === 'group') { if (t.kind === 'group') moveGroup(d.id, t.index); return; }
    if (t.kind === 'new') placeItem(d, null, 0);
    else if (t.kind === 'tray') removeItem(d.id);
    else if (t.kind === 'end') placeItem(d, t.gid, Infinity);
    else if (t.kind === 'item') placeItem(d, t.gid, t.index);
  });
  scrollEl.addEventListener('dragend', () => { if (drag && !drag.dropped) { endDrag(); announce('Movimento cancelado'); } else endDrag(); });

  // ---- keyboard: pick up, move, drop --------------------------------------------------------------------------------
  function kbShift(type, id, dx, dy) {
    if (type === 'item') {
      const f = findItem(id); if (!f) return null;
      const gi = groups.indexOf(f.g), i = f.i; let ng = gi, ni = i;
      if (dy) {
        ni = i + dy;
        if (ni < 0) { if (gi === 0) return 'edge'; ng = gi - 1; ni = groups[ng].items.length; }
        else if (ni >= f.g.items.length) { if (gi === groups.length - 1) return 'edge'; ng = gi + 1; ni = 0; }
      }
      if (dx) { ng = gi + dx; if (ng < 0 || ng >= groups.length) return 'edge'; ni = Math.min(i, groups[ng].items.length); }
      f.g.items.splice(i, 1); groups[ng].items.splice(ni, 0, f.it); S.collapsed[groups[ng].id] = false;
      const tg = groups[ng];
      return { op: `${f.it.name} movido para ${tg.name}`, msg: `${f.it.name}: posição ${ni + 1} de ${tg.items.length} em ${tg.name}` };
    }
    const gi2 = groups.findIndex(g => g.id === id), n2 = gi2 + dy;
    if (!dy || gi2 < 0 || n2 < 0 || n2 >= groups.length) return 'edge';
    const g = groups.splice(gi2, 1)[0]; groups.splice(n2, 0, g);
    const m = `Grupo ${g.name} movido para posição ${n2 + 1} de ${groups.length}`;
    return { op: m, msg: m };
  }
  function nameOf(type, id) { if (type === 'item') { const f = findItem(id); return f ? f.it.name : ''; } const g = gById(id); return g ? g.name : ''; }
  function kbKey(e) {
    if (e.target.matches && e.target.matches('input,textarea,select')) return;
    const t = e.target.closest('[data-kb]'); if (!t) return;
    const p = t.dataset.kb.split(':'), type = p[0], id = p.slice(1).join(':'), k = e.key;
    const kind = t.dataset.fid ? t.dataset.fid.split(':')[0] : (type === 'item' ? 'ib' : 'gt');
    const fidNow = `${kind}:${id}`;
    if (S.kb && S.kb.type === type && S.kb.id === id) {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (map[k]) {
        e.preventDefault();
        if (type === 'group' && map[k][0]) return;
        const r = kbShift(type, id, map[k][0], map[k][1]);
        if (r === 'edge') { announce('Não dá para mover mais nessa direção.'); return; }
        if (r) { render(`${S.kb.kind}:${id}`); announce(r.msg); }
        return;
      }
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        const s0 = S.kb.s, kd = S.kb.kind; S.kb = null;
        if (snap() === s0) { render(`${kd}:${id}`); announce(`${nameOf(type, id)} solto sem mudança.`); return; }
        const nm = nameOf(type, id); let op, say;
        if (type === 'item') { const f = findItem(id); op = `${nm} movido para ${f.g.name}`; say = `${nm} solto em ${f.g.name}, posição ${f.i + 1} de ${f.g.items.length}`; }
        else { const gi = groups.findIndex(g => g.id === id); op = `Grupo ${nm} movido para posição ${gi + 1} de ${groups.length}`; say = op; }
        finish(s0, { op, say, focus: `${kd}:${id}` });
        return;
      }
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); const s1 = S.kb.s, kd2 = S.kb.kind; restoreSnap(s1); render(`${kd2}:${id}`); announce('Movimento cancelado'); }
      return;
    }
    if (S.mode !== 'org') return;
    const pickKey = (k === ' ' && t.dataset.kbpick) || (k === 'Enter' && t.classList.contains('grip'));
    if (S.kb && !pickKey) return;
    if (e.altKey && !S.kb && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      commit(() => {
        const r = kbShift(type, id, 0, k === 'ArrowUp' ? -1 : 1);
        if (r === 'edge') return { skip: true, say: 'Não dá para mover mais nessa direção.', focus: fidNow };
        return { op: r.op, say: r.msg, focus: fidNow };
      });
      return;
    }
    if (pickKey) {
      e.preventDefault();
      // Picking another element while one is held cancels the first one (its move is undone) and says so.
      let cancelled = '';
      if (S.kb) { cancelled = `Movimento de ${nameOf(S.kb.type, S.kb.id)} cancelado. `; restoreSnap(S.kb.s); S.kb = null; }
      S.kb = { type, id, s: snap(), kind };
      render(fidNow);
      announce(`${cancelled}${nameOf(type, id)} pego. Use as setas para cima e para baixo para mover${type === 'item' ? ', as setas para a direita e esquerda trocam de grupo' : ''}, Espaço solta, Esc cancela.`);
    }
  }
  app.addEventListener('keydown', kbKey);

  // ---- clicks and editing ---------------------------------------------------------------------------------------------
  app.addEventListener('click', e => {
    const t = e.target;
    const sty = t.closest('[data-style]');
    if (sty && S.mode === 'org') { e.preventDefault(); openStylePop(sty.closest('.gtoggle'), sty.dataset.style); return; }
    const ie = t.closest('[data-iconedit]');
    if (ie && S.mode === 'org') { e.preventDefault(); openPicker(ie.closest('.ibtn'), { kind: 'item', id: ie.dataset.iconedit }); return; }
    const b = t.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, gid = b.dataset.gid, iid = b.dataset.iid;
    switch (a) {
      case 'toggle': {
        S.collapsed[gid] = !S.collapsed[gid]; persist();
        b.closest('.group').classList.toggle('is-collapsed', Boolean(S.collapsed[gid]));
        b.setAttribute('aria-expanded', S.collapsed[gid] ? 'false' : 'true');
        announce(`${gById(gid).name}${S.collapsed[gid] ? ' recolhido' : ' expandido'}`); syncTop(); break;
      }
      case 'tray-toggle': {
        const c = S.trayCollapsed === null ? unassigned().length === 0 : S.trayCollapsed;
        S.trayCollapsed = !c; persist(); $('#tray', scrollEl).classList.toggle('is-collapsed', S.trayCollapsed); b.setAttribute('aria-expanded', S.trayCollapsed ? 'false' : 'true'); break;
      }
      case 'run': {
        const f = findItem(iid); if (!f || S.mode === 'org') return;
        if (f.it.installed === false) {
          openDialog(b, { title: 'Extensão não instalada', text: `“${f.it.name}”: esta extensão não está instalada.`, btns: [
            ...(f.it.extensionId ? [{ label: 'Ver no Marketplace', go() { api.postMessage({ type: 'openMarketplace', extensionId: f.it.extensionId }); } }] : []),
            { label: 'Remover do grupo', cls: 'danger', go() { removeItem(iid); } },
            { label: 'Cancelar' }
          ] });
          break;
        }
        const now = Date.now(); if (lastRun.id === iid && now - lastRun.at < 400) return;
        lastRun = { id: iid, at: now }; api.postMessage({ type: 'run', id: iid }); break;
      }
      case 'star': {
        const fi = findItem(iid); if (!fi) return;
        fi.it.favorite = !fi.it.favorite; api.postMessage({ type: 'favorite', id: iid });
        announce(`${fi.it.name}${fi.it.favorite ? ' adicionado aos favoritos' : ' removido dos favoritos'}`);
        render(S.tab === 'fav' && !fi.it.favorite ? null : undefined);
        if (S.tab === 'fav' && !fi.it.favorite) { const nx = $('.star', scrollEl); (nx || scrollEl).focus(); }
        break;
      }
      case 'gmenu': openMenu(b, groupMenu(gid), { label: 'Ações do grupo' }); break;
      case 'imenu': openMenu(b, itemMenu(iid), { label: 'Ações do item' }); break;
      case 'gadd': openMenu(b, addItemMenu(gid), { label: 'Adicionar item' }); break;
      case 'addto': {
        const ext = b.dataset.ext;
        openMenu(b, [{ head: 'Adicionar a…' }].concat(groupChoices(g => placeItem({ type: 'tray', ext }, g, Infinity), true, null)), { label: 'Adicionar a um grupo' }); break;
      }
      case 'newgroup': createGroup(); break;
      case 'del-ok': doDelete(gid); break;
      case 'del-cancel': S.confirmDel = null; render(`gk:${gid}`); announce('Exclusão cancelada'); break;
      case 'dismiss-notice': S.notice = null; render(null); break;
      case 'dismiss-broken': S.dismissed.broken = true; render(null); break;
      case 'dismiss-un': S.dismissed.un = true; render(null); break;
      case 'dismiss-hint': S.dismissed.hint = true; persist(); render(null); break;
      case 'show-broken': S.brokenOnly = !S.brokenOnly; render(); syncTop(); announce(S.brokenOnly ? 'Mostrando só itens quebrados' : 'Mostrando todos os itens'); break;
      case 'show-tray': {
        S.mode = 'org'; fullRender(null);
        const tr = $('#tray', scrollEl); if (tr) { tr.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); const ad = $('.add', tr); if (ad) ad.focus({ preventScroll: true }); }
        announce('Modo Organizar. Extensões não agrupadas à mostra.'); break;
      }
      case 'enter-org': S.mode = 'org'; fullRender('org'); announce('Modo Organizar ativado.'); break;
      case 'retry': retrySave(); break;
      case 'discard': discardDraft(); break;
      case 'suggest': suggest(); break;
      case 'zero': S.welcomeDone = true; render('cf'); announce('Começando do zero. Nenhum grupo ainda.'); break;
      case 'clear-q': clearSearch(); break;
      case 'search-tray': S.searchTray = true; render(); announce('Mostrando também as não agrupadas.'); break;
      case 'settings': api.postMessage({ type: 'configure' }); break;
      case 'reload': S.slow = 'Carregando extensões…'; render(); waitForData(); api.postMessage({ type: 'ready', scope: S.scopePref }); break;
      default: break;
    }
  });
  scrollEl.addEventListener('dblclick', e => {
    const gn = e.target.closest('.gname');
    if (gn && S.mode === 'org') { S.edit = { type: 'group', id: gn.closest('.group').dataset.gid, sel: true }; render(null); }
  });
  scrollEl.addEventListener('keydown', e => {
    const inp = e.target.closest && e.target.closest('[data-edit]'); if (!inp) return;
    if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdit(false); }
  });
  scrollEl.addEventListener('input', e => {
    if (e.target.id === 'trayQ') { S.trayQ = e.target.value; render('tf'); return; }
    const inp = e.target.closest && e.target.closest('[data-edit]'); if (!inp || !S.edit) return;
    S.edit.val = inp.value;
    if (S.edit.err) { S.edit.err = false; inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); const er = $('#rn-err', scrollEl); if (er) er.remove(); }
    const n = $('[data-n]', scrollEl); if (n) { n.hidden = inp.value.length < 80; n.textContent = `${inp.value.length}/100`; }
  });
  scrollEl.addEventListener('focusout', e => {
    if (rendering || !S.edit) return;
    if (e.target.matches && e.target.matches('[data-edit]') && !(e.relatedTarget && scrollEl.contains(e.relatedTarget) && e.relatedTarget.matches('[data-edit]'))) finishEdit('blur');
  });

  // ---- top bar ------------------------------------------------------------------------------------------------------------
  let searchT;
  qEl.addEventListener('input', () => {
    S.q = qEl.value; S.searchTray = false; persist();
    if (S.q.trim()) S.mode = 'use';
    S.edit = null; render(); syncTop();
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      if (!S.q.trim()) return;
      announce(S.resCount ? pl(S.resCount, 'resultado', 'resultados') : `Nenhum resultado para ${S.q.trim()}`);
    }, 500);
  });
  qEl.addEventListener('keydown', e => { if (e.key === 'Escape' && qEl.value) { e.preventDefault(); e.stopPropagation(); clearSearch(true); } });
  function clearSearch(keepFocus) { qEl.value = ''; S.q = ''; S.searchTray = false; persist(); render(null); syncTop(); if (keepFocus) qEl.focus(); announce('Busca limpa'); }
  $('#qClear').addEventListener('click', () => clearSearch(true));
  btnOrg.addEventListener('click', () => {
    if (btnOrg.disabled) return;
    S.mode = S.mode === 'org' ? 'use' : 'org'; S.edit = null; S.kb = null; S.confirmDel = null; closePop(false);
    fullRender(null);
    announce(S.mode === 'org' ? 'Modo Organizar ativado. Arraste pela alça, ou use Espaço e setas, ou o menu ⋯ Mover para.' : 'Modo Organizar concluído.');
  });
  function setTab(v) {
    S.tab = v; persist(); if (v === 'fav') { S.mode = 'use'; S.edit = null; }
    fullRender(null); announce(v === 'fav' ? 'Mostrando favoritos' : 'Mostrando todas');
  }
  $('#segAll').addEventListener('click', () => setTab('all'));
  $('#segFav').addEventListener('click', () => setTab('fav'));
  btnScope.addEventListener('click', () => {
    if (!data) return;
    const s = data.scope;
    const entries = [
      { label: 'Global', hint: 'Vale para todos os projetos', radio: true, checked: s.active === 'global', go() { setScope('global'); } },
      { label: 'Este projeto', hint: !s.hasWorkspace ? 'Abra uma pasta para usar este escopo.' : s.trusted === false ? 'Pasta não confiável: confie na pasta para usar este escopo.' : 'Só neste projeto; prevalece sobre o global', radio: true, checked: s.active === 'workspace', disabled: !s.hasWorkspace || s.trusted === false, go() { setScope('workspace'); } }
    ];
    if (s.active === 'workspace' && s.projectOverride) entries.push({ sep: true }, { label: 'Voltar ao global…', ic: 'undo-2', go() { askReset(); } });
    openMenu(btnScope, entries, { label: 'Escopo' });
  });
  function setScope(s) {
    if (data && s === activeScope()) { btnScope.focus(); return; }
    if (SY.hasPending(sync)) flush(); // a pending save keeps the scope it was made in
    S.scopePref = s; undoSnap = null; hideToast(); S.edit = null; S.kb = null; S.confirmDel = null; S.notice = null; persist();
    api.postMessage({ type: 'setScope', scope: s }); btnScope.focus();
    announce(`Escopo: ${s === 'global' ? 'Global' : 'Este projeto'}.`);
  }
  function reducedMotion() { return window.matchMedia('(prefers-reduced-motion:reduce)').matches; }

  // ---- collapse all, pinned group focus --------------------------------------------------------------------------------------
  function toggleAll() {
    if (btnFold.disabled) return;
    const allCol = groups.every(g => S.collapsed[g.id]);
    groups.forEach(g => { S.collapsed[g.id] = !allCol; });
    persist(); fullRender(undefined);
    announce(allCol ? 'Todos os grupos expandidos.' : 'Todos os grupos recolhidos.');
  }
  btnFold.addEventListener('click', toggleAll);
  function onFocusGroup(m) {
    closePop(false);
    const g = typeof m.groupId === 'string' ? gById(m.groupId) : null;
    if (!g) {
      S.notice = activeScope() === 'workspace' ? 'Este grupo não existe neste projeto.' : 'Este grupo não existe mais.';
      fullRender(null); announce(S.notice); return;
    }
    S.notice = null;
    if (m.collapseOthers !== false) {
      if (!S.prevCollapsed) S.prevCollapsed = M.clone(S.collapsed);
      S.collapsed = {}; groups.forEach(x => { S.collapsed[x.id] = x.id !== g.id; });
    } else S.collapsed[g.id] = false;
    S.tab = 'all'; S.q = ''; qEl.value = ''; S.brokenOnly = false; S.searchTray = false; S.edit = null; S.confirmDel = null; S.kb = null;
    S.mode = m.organize ? 'org' : 'use';
    persist(); fullRender(null);
    const sec = $(`.group[data-gid="${cssq(g.id)}"]`, scrollEl);
    if (sec) {
      scrollEl.scrollTo({ top: Math.max(0, sec.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop - 4), behavior: reducedMotion() ? 'auto' : 'smooth' });
      sec.classList.add('pin-flash'); setTimeout(() => sec.classList.remove('pin-flash'), 1600);
      const tg = $('.gtoggle', sec); if (tg) tg.focus({ preventScroll: true });
    }
    announce(`Ferramentas: grupo ${g.name} aberto; os outros grupos estão recolhidos.${m.organize ? ' Modo Organizar ativado.' : ''}`);
  }
  function onRestoreFold() {
    if (!S.prevCollapsed) return;
    S.collapsed = S.prevCollapsed; S.prevCollapsed = null; persist(); fullRender(null);
    announce('Ferramentas agrupadas. Recolhimento anterior restaurado.');
  }

  // ---- shortcuts ---------------------------------------------------------------------------------------------------------------
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop) { closePop(true); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !(e.target.matches && e.target.matches('input,textarea'))) { e.preventDefault(); undo(); }
  });

  // ---- messages from the extension ------------------------------------------------------------------------------------------------
  let slowTimers = [];
  function waitForData() {
    slowTimers.forEach(clearTimeout);
    slowTimers = [setTimeout(() => { if (!data) { S.slow = 'Carregando extensões…'; render(); } }, 3000),
      setTimeout(() => { if (!data) { S.slow = 'O painel não recebeu os dados.'; render(); } }, 5000)];
  }
  function onData(message) {
    lastData = message; data = message;
    const scope = message.scope.active;
    const merged = SY.merge(sync, { groups, scope: groupsScope }, message);
    groups = merged.groups; groupsScope = merged.scope;
    slowTimers.forEach(clearTimeout); S.slow = '';
    app.setAttribute('aria-busy', 'false');
    fullRender();
  }
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'data') onData(m);
    else if (m.type === 'saved') onSaved(m);
    else if (m.type === 'saveError') onSaveError(m);
    else if (m.type === 'toggleFold') toggleAll();
    else if (m.type === 'focusGroup' || m.type === 'restoreFold' || m.type === 'openEditor') {
      // Without data there is nothing to focus: no ack, so the extension resends after the next `ready`.
      if (!data && m.type !== 'restoreFold') return;
      if (m.type === 'focusGroup') onFocusGroup(m);
      else if (m.type === 'restoreFold') onRestoreFold();
      else if (data) { S.mode = 'org'; fullRender('org'); announce('Modo Organizar ativado.'); }
      if (typeof m.seq === 'number') api.postMessage({ type: 'focusAck', seq: m.seq });
    }
  });

  // ---- start --------------------------------------------------------------------------------------------------------------------------
  $$('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic, el.dataset.icsm ? 'sm' : ''); });
  syncTop(); render();
  waitForData();
  api.postMessage({ type: 'ready', scope: S.scopePref });
})();
