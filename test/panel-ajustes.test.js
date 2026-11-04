const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../media/model');
const config = require('../src/config');

const G = () => [
  { id: 'a', name: 'A', icon: 'database', color: 'g-1', items: [] },
  { id: 'c', name: 'C', icon: 'folder', color: 'g-3', items: [] }
];

// ---- AJ-5: random color for new groups -----------------------------------------------------------------

test('AJ-5: new group color is random from the palette, never neutral, not the neighbour above', () => {
  const g = G(); // last group is g-3
  for (let i = 0; i < 20; i++) {
    const r = M.createGroup(g, { name: 'N' }, undefined, () => i / 20);
    assert.ok(M.COLORS.includes(r.group.color) && r.group.color !== M.NEUTRAL);
    assert.notEqual(r.group.color, 'g-3');
  }
  assert.equal(M.randomColor([], () => 0), 'g-1');
  assert.equal(M.randomColor([], () => 0.999999), 'g-9');
  assert.equal(M.randomColor([{ color: 'g-1' }], () => 0), 'g-2', 'skips the previous color');
  assert.equal(M.randomColor(g, () => 0, 0), 'g-1', 'inserted first: no neighbour above');
  assert.ok(M.COLORS.includes(M.randomColor(g, () => NaN)), 'a broken generator still yields a palette color');
  assert.equal(M.createGroup(g, { name: 'N', color: '#aabbcc' }).group.color, '#aabbcc');
  assert.notEqual(M.createGroup(g, { name: 'N', color: 'red' }).group.color, 'red');
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(M.createGroup(g, { name: 'N' }).group.color);
  assert.ok(seen.size > 3, 'Math.random default really varies');
});

// ---- AJ-6: color by code -------------------------------------------------------------------------------

test('AJ-6: colors are palette ids or #rrggbb lowercase, in the model and in the host', () => {
  for (const ok of ['#3b82f6', '#000000', 'g-1', 'g-10']) { assert.equal(M.colorOf({ color: ok }), ok); assert.equal(config.validColor(ok), true); }
  const bads = ['#3B82F6', '#fff', '#12345g', '#3b82f6 ', '#3b82f6\n', 'red', 'rgb(1,2,3)', 'url(x)', '#3b82f6;x', 'g-11', '', null, undefined, 5, {}, ['#3b82f6']];
  for (const bad of bads) { assert.equal(M.colorOf({ color: bad }), M.NEUTRAL, String(bad)); assert.equal(config.validColor(bad), false, String(bad)); }
  assert.equal(M.HEX_COLOR.source, config.HEX_COLOR.source);
  assert.equal(M.colorClass({ color: '#3b82f6' }), 'g-custom');
  assert.equal(M.colorClass({ color: 'g-4' }), 'g-4');
  assert.equal(M.colorClass({ color: '<script>' }), 'g-10');
  assert.equal(M.serialize([{ id: 'a', name: 'A', icon: 'x', color: '#3b82f6', items: [] }])[0].color, '#3b82f6');
  assert.equal(M.serialize([{ id: 'a', name: 'A', icon: 'x', color: '#3B82F6', items: [] }])[0].color, 'g-10');
  const group = color => ({ name: 'G', color, items: [] });
  assert.equal(config.readGroups([group('#3b82f6')])[0].color, '#3b82f6');
  assert.equal(config.readGroups([group('#3B82F6')])[0].color, config.NEUTRAL_COLOR);
  assert.equal(config.readGroups([group('red; background:url(x)')])[0].color, config.NEUTRAL_COLOR);
  assert.equal(config.validateGroups([group('#3b82f6')])[0].color, '#3b82f6');
  assert.throws(() => config.validateGroups([group('#3B82F6')]), /Cor inválida/);
  assert.throws(() => config.validateGroups([group('javascript:1')]), /Cor inválida/);
});

test('AJ-6: parseColorInput normalizes HEX, RGB and HSL to #rrggbb and rejects the rest', () => {
  const hex = v => M.parseColorInput('hex', v), rgb = v => M.parseColorInput('rgb', v), hsl = v => M.parseColorInput('hsl', v);
  assert.deepEqual(hex('#3B82F6'), { ok: true, hex: '#3b82f6' });
  assert.deepEqual(hex('#38F'), { ok: true, hex: '#3388ff' });
  assert.deepEqual(hex('3b82f6'), { ok: true, hex: '#3b82f6' });
  for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', '#GGGGGG', '#12 456']) assert.equal(hex(bad).ok, false, bad);
  assert.deepEqual(rgb('59, 130, 246'), { ok: true, hex: '#3b82f6' });
  assert.deepEqual(rgb('0 0 0'), { ok: true, hex: '#000000' });
  assert.deepEqual(rgb('255,255,255'), { ok: true, hex: '#ffffff' });
  for (const bad of ['256, 0, 0', '1, 2', '1, 2, 3, 4', '-1, 0, 0', '1.5, 2, 3', 'a, b, c', '']) assert.equal(rgb(bad).ok, false, bad);
  assert.deepEqual(hsl('0, 100%, 50%'), { ok: true, hex: '#ff0000' });
  assert.deepEqual(hsl('120 100 25'), { ok: true, hex: '#008000' });
  assert.deepEqual(hsl('360, 100%, 50%'), { ok: true, hex: '#ff0000' });
  assert.deepEqual(hsl('0, 0%, 100%'), { ok: true, hex: '#ffffff' });
  for (const bad of ['361, 0%, 0%', '0, 101%, 0%', '0, 0%, 101%', '0, 0%', '']) assert.equal(hsl(bad).ok, false, bad);
  assert.match(hsl('1').error, /HSL/);
  assert.equal(M.parseColorInput('css', '#fff').ok, false);
  for (const f of ['hex', 'rgb', 'hsl']) {
    for (let i = 0; i < 300; i++) {
      const noise = Array.from({ length: 12 }, () => String.fromCharCode(32 + Math.floor(Math.random() * 95))).join('');
      const r = M.parseColorInput(f, noise);
      if (r.ok) assert.match(r.hex, /^#[0-9a-f]{6}$/);
    }
  }
});

test('AJ-6: maskColorInput keeps only valid characters and ranges per format', () => {
  const m = (f, v, d) => M.maskColorInput(f, v, d);
  assert.equal(m('hex', 'zz#3b82f6ff'), '#3B82F6');
  assert.equal(m('hex', 'xyz'), '');
  assert.equal(m('hex', '#'), '#');
  assert.equal(m('rgb', 'abc59,130 ,246x9'), '59, 130, 246');
  assert.equal(m('rgb', '256'), '25', 'a digit that would pass 255 is ignored');
  assert.equal(m('rgb', '300'), '30, 0', 'a field that cannot grow closes and the next digit opens the next field');
  assert.equal(m('rgb', '59,'), '59, ');
  assert.equal(m('rgb', '59,', true), '59', 'erasing does not bring the separator back');
  assert.equal(m('hsl', '361'), '36');
  assert.equal(m('hsl', '217 91 60'), '217, 91%, 60%');
  assert.equal(m('hsl', '0,0,0,0'), '0, 0%, 0%');
  assert.equal(m('hsl', '-5'), '5');
  for (const f of ['rgb', 'hsl']) for (const v of [m(f, '999999999999999'), m(f, '1,2,3,4,5')]) assert.ok((v.match(/\d+/g) || []).length <= 3);
  for (const f of ['rgb', 'hsl']) for (let i = 0; i < 200; i++) {
    const noise = Array.from({ length: 20 }, () => String.fromCharCode(32 + Math.floor(Math.random() * 95))).join('');
    const out = m(f, noise);
    assert.match(out, /^[0-9, %]*$/);
    for (const [idx, t] of (out.match(/\d+/g) || []).entries()) assert.ok(Number(t) <= [f === 'rgb' ? 255 : 360, f === 'rgb' ? 255 : 100, f === 'rgb' ? 255 : 100][idx]);
  }
  assert.equal(m('nope', '12'), '');
});

test('QA-1: every format can be erased key by key (the mask never puts back what was removed)', () => {
  for (const [f, v] of [['hsl', '217, 91%, 60%'], ['hsl', '0, 0%, 0%'], ['rgb', '59, 130, 246'], ['rgb', '255, 255, 255'], ['hex', '#3B82F6'], ['hex', '#38F']]) {
    let t = M.maskColorInput(f, v); assert.ok(t, `${f} ${v}`);
    for (let guard = 0; t && guard < 40; guard++) {
      const next = M.maskColorInput(f, t.slice(0, -1), 'delete');
      assert.ok(next.length < t.length, `${f}: stuck at "${t}" -> "${next}"`);
      t = next;
    }
    assert.equal(t, '', `${f} ${v} reaches empty`);
  }
  assert.equal(M.maskColorInput('hsl', '217, 91%, 60', true), '217, 91%, 60', 'legacy boolean still means deleting');
  assert.equal(M.maskColorInput('hsl', '217, 91%, 60'), '217, 91%, 60%', 'typing still completes the percent');
});

test('QA-3: unknown or prototype-like format names always yield an error', () => {
  for (const f of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', undefined, null, 5, {}]) {
    const r = M.parseColorInput(f, '#fff');
    assert.equal(r.ok, false); assert.equal(typeof r.error, 'string'); assert.ok(r.error.length > 0);
    assert.equal(M.maskColorInput(f, '12'), '');
  }
});

test('QA-4: pasting clamps each number to its maximum instead of splitting it', () => {
  const p = (f, v) => M.maskColorInput(f, v, 'paste');
  assert.equal(p('rgb', '300'), '255');
  assert.equal(p('rgb', '300 99 1000'), '255, 99, 255');
  assert.equal(p('rgb', 'rgb(59, 130, 246)'), '59, 130, 246');
  assert.equal(p('hsl', '999 999 999'), '360, 100%, 100%');
  assert.equal(p('hsl', 'hsl(217, 91%, 60%)'), '217, 91%, 60%');
  assert.equal(p('rgb', '1,2,3,4'), '1, 2, 3');
  assert.equal(p('rgb', 'abc'), '');
  assert.equal(p('rgb', '9'.repeat(40)), '255');
  assert.equal(p('hex', 'xx#3b82f6ff'), '#3B82F6');
  assert.equal(M.parseColorInput('rgb', p('rgb', '300 99 1000')).hex, '#ff63ff');
});

test('QA-2 / SEC-1: the custom color stays in the swatches while the popover is open; data attributes are escaped', () => {
  const view = media('view.js');
  assert.ok(view.includes('lastCustom'));
  const interpolated = view.match(/ data-(?:gc|c)=\\?"\$\{[^}]*\}/g) || [];
  assert.ok(interpolated.length >= 3, 'the color attributes are still rendered');
  for (const m of interpolated) assert.match(m, /\$\{esc\(/, m);
});

test('REV-2: the dead organize flag is gone from the host', () => {
  for (const f of ['src/extension.js', 'src/tools-view.js']) assert.ok(!/organize/.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')), f);
});

test('AJ-6: onColor and readableTone give legible text over any custom color', () => {
  assert.equal(M.onColor('#ffffff'), '#000000');
  assert.equal(M.onColor('#000000'), '#ffffff');
  assert.equal(M.onColor('#ffeb3b'), '#000000');
  assert.equal(M.onColor('#1e3a8a'), '#ffffff');
  for (const c of ['#ffeb3b', '#1e3a8a', '#ff0000', '#00ff00', '#7f7f7f', '#000000', '#ffffff']) {
    for (const [bg, fg] of [['#252526', '#cccccc'], ['#f3f3f3', '#3b3b3b']]) assert.ok(M.contrast(M.readableTone(c, bg, fg), bg) >= 4.5, `${c} on ${bg}`);
  }
  assert.equal(M.readableTone('bad', '#000000', '#ffffff'), '#ffffff');
});

// ---- AJ-2 / AJ-1 / AJ-4 / AJ-8: static checks of the panel sources ---------------------------------------

const media = f => fs.readFileSync(path.join(__dirname, '..', 'media', f), 'utf8');

test('AJ-2: organize mode and its button are gone; reordering stays; custom colors use the CSSOM only', () => {
  const view = media('view.js'), html = media('view.html');
  assert.ok(!/S\.mode|btnOrg|enter-org|Concluir organização/.test(view));
  assert.ok(!html.includes('btnOrg') && !html.includes('Organizar'));
  assert.ok(view.includes("el.style.setProperty('--g', hex)") && view.includes('M.isHexColor(hex)'));
  assert.ok(!/style="|setAttribute\('style'|cssText/.test(view), 'no inline style markup');
});

test('AJ-1: tray items are draggable whenever they are shown (not only in a mode)', () => {
  assert.match(media('view.js'), /class="item tray-item" data-ext="\$\{esc\(e\.command\)\}" draggable="true"/);
});

test('AJ-1: drop target survives the hint rebuild (dragenter cancelled, hint ignores the pointer)', () => {
  assert.match(media('view.js'), /addEventListener\('dragenter', e => \{ if \(drag\) e\.preventDefault\(\); \}\)/);
  assert.match(media('view.css'), /\.drop-line\{pointer-events:none;/);
});

test('AJ-4: swatch grid follows the popover width, not the panel width', () => {
  const css = media('view.css');
  assert.match(css, /\.swatches\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(28px,1fr\)\)/);
  assert.ok(!/\.swatches\{grid-template-columns:repeat\(10/.test(css));
  assert.match(css, /\.stylepop\{[^}]*width:min\(264px,calc\(100% - 16px\)\)/);
});

test('AJ-8: display name and container titles say group tools', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.displayName, 'group tools');
  assert.equal(pkg.name, 'grouped-tools');
  assert.equal(pkg.contributes.viewsContainers.activitybar[0].title, 'group tools');
  assert.ok(pkg.contributes.viewsContainers.activitybar.slice(1).every(c => c.title.startsWith('group tools · ')));
  assert.ok(pkg.contributes.viewsContainers.activitybar[0].id === 'groupedTools' && pkg.contributes.views.groupedTools[0].id === 'groupedTools.view');
  const html = media('view.html');
  assert.ok(html.includes('<title>group tools</title>') && html.includes('aria-label="group tools"'));
  assert.ok(!JSON.stringify(pkg.contributes).includes('Ferramentas'));
});
