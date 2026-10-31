const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const svgSafe = require('../media/svg-safe');
const { resolveIcon, MAX_PNG } = require('../src/ext-icons');
const { checkBody } = require('../scripts/svg-allowlist');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const ROOT = path.resolve('/ext');
// in-memory fs: { relativePath: Buffer|string }
function fsOf(files) {
  const find = p => files[path.relative(ROOT, p).split(path.sep).join('/')];
  return {
    statSync: p => { const f = find(p); if (f === undefined) throw new Error('ENOENT'); return { isFile: () => true, size: Buffer.byteLength(f) }; },
    readFileSync: p => Buffer.from(find(p)),
    realpathSync: p => p
  };
}
const ext = (contributes, icon) => ({ id: 'p.e', extensionPath: ROOT, packageJSON: { icon, contributes } });
const bar = icon => ({ viewsContainers: { activitybar: [{ id: 'c1', title: 'C', icon }] } });
const GOOD = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff"><path d="M2 2h20"/></svg>';

test('ext-icons: container SVG is preferred, rebuilt from the allowlist and monochrome', () => {
  const r = resolveIcon(ext(bar('media/c.svg'), 'icon.png'), 'c1', fsOf({ 'media/c.svg': GOOD, 'icon.png': PNG }));
  assert.equal(r.kind, 'svg'); assert.equal(r.viewBox, '0 0 24 24');
  assert.ok(r.body.includes('<path d="M2 2h20"'));
  assert.ok(!/#fff|fff/.test(r.body), 'colors become currentColor');
  assert.equal(svgSafe.checkImage(r).kind, 'svg');
});

test('ext-icons: hostile SVG is rejected (script, onload, foreignObject, external href, use, style, entities)', () => {
  const hostile = [
    '<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><foreignObject><div/></foreignObject><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><use href="http://evil/x.svg#a"/><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><image href="http://evil/x.png"/><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><a href="javascript:alert(1)"><path d="M0 0h1"/></a></svg>',
    '<svg viewBox="0 0 24 24"><style>*{background:url(http://evil)}</style><path d="M0 0h1"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 24 24"><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><svg><path d="M0 0h1"/></svg></svg>',
    '<svg viewBox="0 0 24 24"><path d="M0 0h1"/>'
  ];
  for (const markup of hostile) {
    assert.equal(svgSafe.sanitizeSvg(markup), null, markup);
    assert.equal(resolveIcon(ext(bar('c.svg')), 'c1', fsOf({ 'c.svg': markup })), null, markup);
  }
});

test('ext-icons: attribute tricks inside an accepted shape never reach the output', () => {
  const r = svgSafe.sanitizeSvg('<svg viewBox="0 0 24 24"><path d="M0 0h1" onmouseover="x()" fill="url(#a)" href="http://e"/></svg>');
  if (r) { assert.ok(!/on\w+=|href|url\(|script|http/i.test(r.body)); checkBody(r.body); }
  // webview side: a forged image object must not pass the re-check
  assert.equal(svgSafe.checkImage({ kind: 'svg', viewBox: '0 0 24 24', body: '<path d="M0 0h1" onload="x()"/>' }), null);
  assert.equal(svgSafe.checkImage({ kind: 'svg', viewBox: '0 0 24 24', body: '<script>x</script>' }), null);
  assert.equal(svgSafe.checkImage({ kind: 'png', src: 'data:image/svg+xml;base64,AAAA' }), null);
  assert.equal(svgSafe.checkImage({ kind: 'png', src: 'https://evil/x.png' }), null);
  assert.equal(svgSafe.checkImage('x'), null);
});

test('ext-icons: PNG falls back to a signed, size-limited data URI; other files never load', () => {
  const r = resolveIcon(ext({}, 'icon.png'), undefined, fsOf({ 'icon.png': PNG }));
  assert.equal(r.kind, 'png'); assert.match(r.src, /^data:image\/png;base64,/);
  assert.equal(svgSafe.checkImage(r).kind, 'png');
  assert.equal(resolveIcon(ext({}, 'icon.png'), undefined, fsOf({ 'icon.png': Buffer.from('not a png at all, just text') })), null, 'signature');
  assert.equal(resolveIcon(ext({}, 'icon.png'), undefined, fsOf({ 'icon.png': Buffer.concat([PNG, Buffer.alloc(MAX_PNG)]) })), null, 'size');
  assert.equal(resolveIcon(ext({}, 'icon.gif'), undefined, fsOf({ 'icon.gif': PNG })), null, 'only svg and png');
});

test('ext-icons: paths cannot leave the extension folder', () => {
  const fsx = { statSync: () => ({ isFile: () => true, size: 10 }), readFileSync: () => Buffer.from(GOOD) };
  for (const icon of ['../x.svg', '../../etc/a.svg', '/abs/a.svg', 'a/../../b.svg']) assert.equal(resolveIcon(ext(bar(icon)), 'c1', fsx), null, icon);
});

test('ext-icons: $(codicon) maps to the catalog icon or falls back; unknown container uses the PNG', () => {
  assert.deepEqual(resolveIcon(ext(bar('$(database)')), 'c1', fsOf({})), { kind: 'lucide', name: 'database' });
  assert.equal(resolveIcon(ext(bar('$(nonexistent-codicon)')), 'c1', fsOf({})), null);
  assert.equal(resolveIcon(ext(bar('c.svg'), 'icon.png'), 'other', fsOf({ 'icon.png': PNG })).kind, 'png');
  assert.equal(resolveIcon(null, 'c1'), null);
});

test('ext-icons: event handlers and style attributes are stripped, never copied', () => {
  for (const markup of [
    '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0h1"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M0 0h1" onclick="x()" style="fill:url(http://evil)"/></svg>'
  ]) {
    const r = svgSafe.sanitizeSvg(markup);
    assert.ok(r && !/on[a-z]+=|style|url\(|http|alert/i.test(r.body), markup);
    checkBody(r.body);
  }
});
