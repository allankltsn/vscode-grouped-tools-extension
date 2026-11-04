'use strict';
// Generates what the pin containers need, from the single catalog (media/pin-catalog.js) and media/icons.js:
//   media/pin/<icon>.svg                       static Activity Bar icons
//   package.json contributes.viewsContainers   one container per pinnable icon (after the main one)
//   package.json contributes.views             one hidden-by-default webview per container
// Idempotent: running it twice changes nothing. `--check` writes nothing and exits 1 when files are stale.
const fs = require('fs'), path = require('path'), vm = require('vm');
const catalog = require('../media/pin-catalog');

const root = path.join(__dirname, '..');
const MAIN_CONTAINER = 'groupedTools';
const TOOLS_ICON = 'boxes';

function loadIcons() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'media', 'icons.js'), 'utf8'), sandbox);
  return sandbox.window.toolIcons;
}

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
}

function build(icons = loadIcons()) {
  const svgs = {}, containers = [], views = [];
  for (const icon of catalog.PIN_ICONS) {
    if (!icons[icon]) throw new Error(`Ícone fixável ausente em media/icons.js: ${icon}`);
    const title = `group tools · ${catalog.pinName(icon)}`;
    svgs[`${icon}.svg`] = svg(icons[icon]);
    containers.push({ id: catalog.containerId(icon), title, icon: `media/pin/${icon}.svg` });
    views.push([catalog.containerId(icon), [{ id: catalog.viewId(icon), name: title, type: 'webview', when: catalog.contextKey(icon) }]]);
  }
  // Main container icon: the Lucide `boxes` icon (extension identity in the Activity Bar).
  if (!icons[TOOLS_ICON]) throw new Error(`Ícone ausente em media/icons.js: ${TOOLS_ICON}`);
  return { svgs, containers, views, tools: svg(icons[TOOLS_ICON]) };
}

// Applies the generated sections to a parsed package.json, keeping every other entry untouched.
function apply(pkg, generated = build()) {
  const next = JSON.parse(JSON.stringify(pkg));
  const contributes = next.contributes;
  const generatedIds = new Set(generated.containers.map(c => c.id));
  contributes.viewsContainers.activitybar = [
    ...contributes.viewsContainers.activitybar.filter(c => c.id === MAIN_CONTAINER),
    ...generated.containers
  ];
  const views = {};
  for (const [id, list] of Object.entries(contributes.views)) if (!generatedIds.has(id)) views[id] = list;
  for (const [id, list] of generated.views) views[id] = list;
  contributes.views = views;
  return next;
}

function main() {
  const check = process.argv.includes('--check');
  const generated = build();
  const pkgFile = path.join(root, 'package.json'), dir = path.join(root, 'media', 'pin');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const nextText = `${JSON.stringify(apply(pkg, generated), null, 2)}\n`;
  const stale = [];
  if (fs.readFileSync(pkgFile, 'utf8') !== nextText) stale.push('package.json');
  for (const [file, text] of Object.entries(generated.svgs)) {
    const target = path.join(dir, file);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) stale.push(`media/pin/${file}`);
  }
  const toolsFile = path.join(root, 'media', 'tools.svg');
  if (!fs.existsSync(toolsFile) || fs.readFileSync(toolsFile, 'utf8') !== generated.tools) stale.push('media/tools.svg');
  const extra = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !(f in generated.svgs)) : [];
  for (const f of extra) stale.push(`media/pin/${f} (fora do catálogo)`);
  if (check) {
    if (stale.length) { console.error(`Desatualizado: ${stale.join(', ')}. Rode node scripts/build-pins.js.`); process.exit(1); }
    console.log('Pins em dia.');
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const f of extra) fs.unlinkSync(path.join(dir, f));
  for (const [file, text] of Object.entries(generated.svgs)) fs.writeFileSync(path.join(dir, file), text);
  fs.writeFileSync(toolsFile, generated.tools);
  fs.writeFileSync(pkgFile, nextText);
  console.log(`${catalog.PIN_ICONS.length} contêineres, ${stale.length} arquivos atualizados.`);
}

if (require.main === module) main();
module.exports = { build, apply };
