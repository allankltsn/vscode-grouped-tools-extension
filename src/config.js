'use strict';
// Pure configuration helpers: no dependency on the vscode module.

const MAX_GROUPS = 100;
const RECURSIVE_COMMAND = 'groupedTools.run';

function readGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];
  return rawGroups.filter(g => g && typeof g.name === 'string' && Array.isArray(g.items))
    .map((group, gi) => ({ name: group.name, icon: group.icon || 'extensions', id: `g${gi}`, items: group.items
      .filter(i => i && typeof i.name === 'string' && typeof i.command === 'string' && i.command !== RECURSIVE_COMMAND)
      .map((item, ii) => ({ ...item, id: `${gi}:${ii}` })) }));
}

function favoriteKey(item) { return JSON.stringify([item.command, item.name, item.args || []]); }

function validateGroups(groups) {
  if (!Array.isArray(groups) || groups.length > MAX_GROUPS) throw new Error('Lista de grupos inválida.');
  for (const group of groups) {
    if (!group || typeof group.name !== 'string' || !group.name.trim() || !Array.isArray(group.items)) throw new Error('Informe o nome e as ferramentas de cada grupo.');
    if (group.icon !== undefined && typeof group.icon !== 'string') throw new Error('Ícone inválido.');
    for (const item of group.items) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.command !== 'string' || !item.command.trim() || item.command === RECURSIVE_COMMAND) throw new Error('Informe nome e comando válidos para cada ferramenta.');
      if (item.icon !== undefined && typeof item.icon !== 'string') throw new Error('Ícone inválido.');
      if (item.args !== undefined && !Array.isArray(item.args)) throw new Error('Argumentos devem ser uma lista.');
    }
  }
  return groups.map(g => ({name:g.name.trim(), icon:g.icon || 'extensions', items:g.items.map(i => ({name:i.name.trim(),command:i.command.trim(),icon:i.icon || 'extensions', ...(i.args ? {args:i.args} : {})}))}));
}

module.exports = { readGroups, validateGroups, favoriteKey, RECURSIVE_COMMAND };
