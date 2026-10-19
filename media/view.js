/* global acquireVsCodeApi */
const api = acquireVsCodeApi();
const saved = api.getState() || {};
let groups = [], mode = saved.mode === 'favorites' ? 'favorites' : 'all';
const collapsed = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
const search = document.getElementById('search');
search.value = typeof saved.query === 'string' ? saved.query : '';
const paths = window.toolIcons;
function persist() { api.setState({mode, query: search.value, collapsed: [...collapsed]}); }
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function makeIcon(name) {
  const icon = element('span', 'icon'); icon.setAttribute('aria-hidden', 'true');
  // Only static trusted SVG strings are inserted; configuration text uses textContent.
  icon.innerHTML = `<svg viewBox="0 0 24 24">${Object.hasOwn(paths, name) ? paths[name] : paths.extensions}</svg>`;
  return icon;
}
function render() {
  const active = document.activeElement;
  const focusId = active && active.dataset.focusId;
  const root = document.getElementById('groups'); root.replaceChildren();
  const query = search.value.trim().toLocaleLowerCase('pt-BR');
  document.getElementById('all').setAttribute('aria-pressed', String(mode === 'all'));
  document.getElementById('favorites').setAttribute('aria-pressed', String(mode === 'favorites'));
  let count = 0;
  for (const group of groups) {
    const items = group.items.filter(i => (mode === 'all' || i.favorite) && (!query || `${group.name} ${i.name} ${i.command}`.toLocaleLowerCase('pt-BR').includes(query)));
    if (!items.length) continue;
    count += items.length;
    const section = element('section', 'group');
    const button = element('button', 'group-heading'); button.type = 'button'; button.dataset.focusId = group.id;
    const expanded = Boolean(query) || !collapsed.has(group.id);
    button.setAttribute('aria-expanded', String(expanded)); button.setAttribute('aria-controls', `items-${group.id}`);
    const arrow = element('span', 'chevron', '›'); arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow, makeIcon(group.icon), element('span', 'group-name', group.name), element('span', 'count', String(items.length)));
    const list = element('div'); list.id = `items-${group.id}`; list.hidden = !expanded;
    button.addEventListener('click', () => { if (collapsed.has(group.id)) collapsed.delete(group.id); else collapsed.add(group.id); persist(); render(); });
    for (const item of items) {
      const row = element('div', 'row'); const launch = element('button', 'launch'); launch.type = 'button';
      launch.title = item.command; launch.dataset.focusId = `run-${item.id}`;
      const icon = makeIcon(item.icon);
      launch.append(icon, element('span', 'name', item.name)); launch.addEventListener('click', () => api.postMessage({type:'run', id:item.id}));
      const star = element('button', 'star', item.favorite ? '★' : '☆'); star.type = 'button'; star.dataset.focusId = `star-${item.id}`;
      star.setAttribute('aria-pressed', String(item.favorite)); star.setAttribute('aria-label', `${item.favorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${item.name}`); star.title = star.getAttribute('aria-label');
      star.addEventListener('click', () => api.postMessage({type:'favorite', id:item.id})); row.append(launch, star); list.append(row);
    }
    section.append(button, list); root.append(section);
  }
  const empty = document.getElementById('empty'); empty.hidden = count > 0; root.hidden = count === 0;
  empty.textContent = query ? 'Nenhuma ferramenta encontrada.' : mode === 'favorites' ? 'Marque a estrela de uma ferramenta para adicioná-la aqui.' : 'Adicione ferramentas em Personalizar grupos.';
  document.getElementById('summary').textContent = `${count} ferramenta${count === 1 ? '' : 's'}`;
  document.getElementById('live').textContent = `${count} ferramentas disponíveis`;
  if (focusId) [...root.querySelectorAll('button')].find(b => b.dataset.focusId === focusId)?.focus();
}
search.addEventListener('input', () => { persist(); render(); });
for (const id of ['all', 'favorites']) document.getElementById(id).addEventListener('click', () => { mode = id; persist(); render(); });
document.getElementById('configure').addEventListener('click', () => api.postMessage({type:'configure'}));
window.addEventListener('message', e => {
  if (e.data.type === 'openEditor') {
    document.getElementById('editor').open = true;
    document.getElementById('editor').scrollIntoView();
    document.getElementById('group-name').focus();
    return;
  }
  if (e.data.type === 'saved' || e.data.type === 'saveError') {
    document.getElementById('form-status').textContent = e.data.text;
    document.getElementById('save').disabled = false;
    return;
  }
  if (e.data.type !== 'data') return;
  groups = e.data.groups; document.getElementById('workspace').textContent = e.data.workspace; render();
  updateEditor(e.data);
});
let editorData, draftItems = [], dirty = false;
const scope = document.getElementById('scope');
const groupSelect = document.getElementById('edit-group');
const iconSelect = document.getElementById('group-icon');
for (const name of Object.keys(paths)) iconSelect.append(new Option(name, name));
function sourceGroups() { return editorData?.[scope.value === 'workspace' ? 'workspaceGroups' : 'globalGroups'] || []; }
function previewIcon() { document.getElementById('icon-preview').replaceChildren(makeIcon(iconSelect.value)); }
function loadGroup() {
  const group = sourceGroups()[Number(groupSelect.value)];
  document.getElementById('group-name').value = group?.name || '';
  if (group?.icon && ![...iconSelect.options].some(o => o.value === group.icon)) iconSelect.append(new Option(group.icon, group.icon));
  iconSelect.value = group?.icon || 'plus';
  draftItems = structuredClone(group?.items || []);
  document.getElementById('delete-group').disabled = !group;
  dirty = false; previewIcon(); renderItems();
}
function rebuildGroups() {
  const previous = groupSelect.value;
  groupSelect.replaceChildren(new Option('Novo grupo', 'new'));
  sourceGroups().forEach((g,i) => groupSelect.append(new Option(g.name, String(i))));
  if ([...groupSelect.options].some(o => o.value === previous)) groupSelect.value = previous;
  loadGroup();
}
function updateEditor(data) {
  editorData = data;
  scope.querySelector('[value="workspace"]').disabled = !data.hasWorkspace;
  document.getElementById('scope-note').textContent = data.folderOverride ? 'Há uma configuração de pasta. Ajuste-a no Settings para alterar o painel.' : data.projectOverride ? 'Este projeto possui configuração própria; ela prevalece sobre a global.' : 'A configuração global vale para todos os projetos.';
  document.getElementById('reset-project').hidden = scope.value !== 'workspace' || !data.projectOverride;
  const picker = document.getElementById('extension-picker');
  picker.replaceChildren(new Option('Escolha uma extensão instalada', ''));
  data.extensions.forEach((ext,i) => picker.append(new Option(`${ext.name} (${ext.views})`, String(i))));
  if (!dirty) rebuildGroups();
}
function renderItems() {
  const root = document.getElementById('edit-items'); root.replaceChildren();
  draftItems.forEach((item,index) => {
    const row = element('div','edit-item');
    const nameLabel = element('label', '', 'Ferramenta');
    const name = element('input'); name.value = item.name; name.required = true;
    name.addEventListener('input', () => { item.name = name.value; dirty = true; }); nameLabel.append(name);
    const commandLabel = element('label', '', 'Comando');
    const command = element('input'); command.value = item.command; command.required = true;
    command.addEventListener('input', () => { item.command = command.value; dirty = true; }); commandLabel.append(command);
    const remove = element('button','secondary','Remover'); remove.type = 'button'; remove.setAttribute('aria-label', `Remover ${item.name || 'ferramenta'}`);
    remove.addEventListener('click', () => { draftItems.splice(index,1); dirty = true; renderItems(); });
    row.append(nameLabel,commandLabel,remove); root.append(row);
  });
}
scope.addEventListener('change', () => { dirty = false; updateEditor(editorData); });
groupSelect.addEventListener('change', loadGroup);
iconSelect.addEventListener('change', () => { dirty = true; previewIcon(); });
document.getElementById('group-name').addEventListener('input', () => { dirty = true; });
document.getElementById('extension-picker').addEventListener('change', e => {
  if (e.target.value === '') return;
  const ext = editorData.extensions[Number(e.target.value)];
  if (!draftItems.some(i => i.command === ext.command)) draftItems.push({name:ext.name,command:ext.command,icon:ext.icon});
  dirty = true; renderItems(); e.target.value = '';
});
document.getElementById('add-command').addEventListener('click', () => { draftItems.push({name:'',command:'',icon:'terminal'}); dirty = true; renderItems(); });
function saveGroups(value) {
  document.getElementById('save').disabled = true;
  document.getElementById('form-status').textContent = 'Salvando…';
  api.postMessage({type:'saveGroups',scope:scope.value,groups:value});
}
document.getElementById('group-form').addEventListener('submit', e => {
  e.preventDefault();
  const next = structuredClone(sourceGroups());
  const group = {name:document.getElementById('group-name').value,icon:iconSelect.value,items:draftItems};
  if (groupSelect.value === 'new') next.push(group); else next[Number(groupSelect.value)] = group;
  dirty = false; saveGroups(next);
});
document.getElementById('delete-group').addEventListener('click', () => {
  if (groupSelect.value === 'new') return;
  const next = structuredClone(sourceGroups()); next.splice(Number(groupSelect.value),1);
  dirty = false; groupSelect.value = 'new'; saveGroups(next);
});
document.getElementById('reset-project').addEventListener('click', () => {
  dirty = false; api.postMessage({type:'resetGroups',scope:'workspace'});
});
api.postMessage({type:'ready'});
