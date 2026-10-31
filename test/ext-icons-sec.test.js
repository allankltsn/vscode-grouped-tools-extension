const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const svgSafe = require('../media/svg-safe');
const { resolveIcon } = require('../src/ext-icons');

const ROOT = path.resolve('/ext');
function fsOf(files) {
  const find = p => files[path.relative(ROOT, p).split(path.sep).join('/')];
  return {
    statSync: p => { const f = find(p); if (f === undefined) throw new Error('ENOENT'); return { isFile: () => true, size: Buffer.byteLength(f) }; },
    readFileSync: p => Buffer.from(find(p))
  };
}
const ext = contributes => ({ id: 'p.e', extensionPath: ROOT, packageJSON: { contributes } });
const bar = icon => ({ viewsContainers: { activitybar: [{ id: 'c1', title: 'C', icon }] } });
const GOOD = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff"><path d="M2 2h20"/></svg>';
const wrap = attrs => `<svg viewBox="0 0 24 24"><path d="M0 0h1" ${attrs}/></svg>`;
const time = fn => { const t = process.hrtime.bigint(); const r = fn(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };

// ---- SEC-19: regex audit (linear time on hostile input) --------------------------------------------------
test('SEC-19: pathological 20000-char inputs are rejected or dropped in under 50 ms each', () => {
  const cases = {
    'transform rotate chain': wrap(`transform="${'rotate(  )  '.repeat(2000)}"`),
    'transform spaces': wrap(`transform="rotate(${' '.repeat(20000)}"`),
    'stroke-width digits': wrap(`stroke-width="${'1'.repeat(20000)}x"`),
    'opacity digits': wrap(`opacity="${'1'.repeat(20000)}."`),
    'viewBox digits': `<svg viewBox="${'1 '.repeat(10000)}x"><path d="M0 0h1"/></svg>`,
    'd': `<svg viewBox="0 0 24 24"><path d="${'M1 '.repeat(6000)}x"/></svg>`,
    'points': `<svg viewBox="0 0 24 24"><polyline points="${'1,'.repeat(10000)}x"/></svg>`,
    'attribute soup': `<svg viewBox="0 0 24 24"><path d="M0 0h1" ${'a=1 '.repeat(5000)}`,
    'unterminated comments': `<svg>${'<!--'.repeat(5000)}`,
    'unterminated xml prolog': `<svg>${'<?xml '.repeat(3300)}`,
    'unterminated doctype': `<svg>${'<!DOCTYPE '.repeat(2000)}`,
    'unclosed tags': `<svg viewBox="0 0 24 24">${'<g '.repeat(6000)}`,
    'name chars': `<svg ${'x'.repeat(20000)}`,
    'spaces before =': `<svg ${'a '.repeat(10000)}`
  };
  for (const [name, markup] of Object.entries(cases)) {
    const { r, ms } = time(() => svgSafe.sanitizeSvg(markup.slice(0, 20000)));
    assert.ok(ms < 50, `${name}: ${ms.toFixed(1)} ms`);
    assert.ok(r === null || !/transform=|stroke-width="1{20}/.test(r.body), name);
  }
});

test('SEC-19: the exact attack (rotate(  ) chain, 223 chars) is dropped quickly and leaves a clean icon', () => {
  const attack = `rotate(  )${'  rotate(  )'.repeat(17)}x`;
  assert.ok(attack.length > 200);
  const { r, ms } = time(() => svgSafe.sanitizeSvg(wrap(`transform="${attack}"`)));
  assert.ok(ms < 50, `${ms} ms`);
  assert.ok(!r.body.includes('transform'));
  const longer = time(() => svgSafe.sanitizeSvg(wrap(`transform="${'rotate(  )  '.repeat(2000)}"`)));
  assert.ok(longer.ms < 50, `${longer.ms} ms`);
  assert.ok(svgSafe.sanitizeSvg(wrap('transform="translate(1 2) rotate(45)"')).body.includes('transform="translate(1 2) rotate(45)"'));
  assert.ok(!svgSafe.sanitizeSvg(wrap(`transform="${'rotate(1) '.repeat(9)}"`)).body.includes('transform'), 'at most 8 functions');
  assert.ok(!svgSafe.sanitizeSvg(wrap('transform="rotate(1) evil(2)"')).body.includes('transform'));
});

test('SEC-19: numbers are strict and length-limited', () => {
  for (const good of ['1', '-1.5', '.5', '1e3', '2.']) assert.ok(svgSafe.sanitizeSvg(wrap(`opacity="${good}"`)).body.includes('opacity='), good);
  for (const bad of ['1e', '--1', '1..2', 'a', '', '1'.repeat(33)]) assert.ok(!svgSafe.sanitizeSvg(wrap(`opacity="${bad}"`)).body.includes('opacity='), bad);
});

test('SEC-19: unterminated prolog, comment or doctype rejects the icon; closed ones are stripped', () => {
  for (const pre of ['<?xml version="1.0"', '<!-- never closed', '<!DOCTYPE svg [<!ENTITY x "y">]>']) assert.equal(svgSafe.sanitizeSvg(`${pre}${GOOD}`), null, pre);
  assert.ok(svgSafe.sanitizeSvg(`<?xml version="1.0"?><!-- c --><!DOCTYPE svg>${GOOD}`));
});

// ---- QA-14 / QA-15 --------------------------------------------------------------------------------------
test('QA-14: lucide images are accepted only with a plain catalog-style name', () => {
  assert.deepEqual(svgSafe.checkImage({ kind: 'lucide', name: 'database' }), { kind: 'lucide', name: 'database' });
  for (const bad of ['', 'A', '../x', 'a b', 'x'.repeat(65), 5, undefined]) assert.equal(svgSafe.checkImage({ kind: 'lucide', name: bad }), null, String(bad));
  assert.deepEqual(resolveIcon(ext(bar('$(database)')), 'c1', fsOf({})), { kind: 'lucide', name: 'database' });
});

test('QA-15: only the default icon is generic; a deliberate puzzle stays', () => {
  assert.equal(svgSafe.isGenericIcon('extensions'), true);
  assert.equal(svgSafe.isGenericIcon(undefined), true);
  assert.equal(svgSafe.isGenericIcon(''), true);
  assert.equal(svgSafe.isGenericIcon('puzzle'), false);
  assert.equal(svgSafe.isGenericIcon('database'), false);
});

// ---- SEC-21: symlinks and junctions ------------------------------------------------------------------------
test('SEC-21: an icon reached through a link that points outside the extension is refused (injected realpath)', () => {
  const fake = { ...fsOf({ 'media/c.svg': GOOD, 'link/a.svg': GOOD }), realpathSync: p => (p.includes('link') ? path.resolve('/outside/a.svg') : p) };
  assert.equal(resolveIcon(ext(bar('link/a.svg')), 'c1', fake), null);
  assert.equal(resolveIcon(ext(bar('media/c.svg')), 'c1', fake).kind, 'svg');
  const boom = { ...fsOf({ 'media/c.svg': GOOD }), realpathSync: () => { throw new Error('EACCES'); } };
  assert.equal(resolveIcon(ext(bar('media/c.svg')), 'c1', boom), null, 'unresolvable real path is refused');
});

test('SEC-21: a real junction to an outside folder is refused', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-sec21-'));
  try {
    fs.mkdirSync(path.join(dir, 'ext', 'media'), { recursive: true }); fs.mkdirSync(path.join(dir, 'outside'));
    fs.writeFileSync(path.join(dir, 'outside', 'a.svg'), GOOD); fs.writeFileSync(path.join(dir, 'ext', 'media', 'ok.svg'), GOOD);
    try { fs.symlinkSync(path.join(dir, 'outside'), path.join(dir, 'ext', 'link'), 'junction'); } catch (e) { t.skip(`links not allowed here: ${e.code}`); return; }
    const real = { id: 'p.e', extensionPath: path.join(dir, 'ext'), packageJSON: { contributes: bar('link/a.svg') } };
    assert.equal(resolveIcon(real, 'c1'), null);
    real.packageJSON.contributes = bar('media/ok.svg');
    assert.equal(resolveIcon(real, 'c1').kind, 'svg');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
