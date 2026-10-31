'use strict';
// Measures the contrast of the group palette (media/view.css) against the Light+ and Dark+ sidebar
// backgrounds: the 2px group bar and the group name text. Usage: node scripts/contrast.js [--check]
// WCAG 2.x relative luminance; non-text elements need 3:1, text 4.5:1. `--check` exits 1 below that.
const fs = require('fs'), path = require('path');

const THEMES = {
  'Light+': { bg: '#f3f3f3', fg: '#3b3b3b', selector: ':is(body.vscode-light)' },
  'Dark+': { bg: '#252526', fg: '#cccccc', selector: '' }
};

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, pct) => a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)));

// `.g-N{--g:#hex}` rules; a rule prefixed with `body.vscode-light` overrides the base value in Light+.
function palette(css) {
  const base = {}, light = {};
  for (const m of css.matchAll(/(body\.vscode-light\s+)?\.g-(\d+)\{--g:(#[0-9a-fA-F]{6})\}/g)) (m[1] ? light : base)[`g-${m[2]}`] = m[3];
  return { base, light };
}

function measure(css = fs.readFileSync(path.join(__dirname, '..', 'media', 'view.css'), 'utf8')) {
  const { base, light } = palette(css);
  const rows = [];
  for (const [theme, t] of Object.entries(THEMES)) {
    const bg = rgb(t.bg), fg = rgb(t.fg);
    for (const [name, baseHex] of Object.entries(base)) {
      const hex = theme === 'Light+' && light[name] ? light[name] : baseHex, g = rgb(hex);
      const gbg = mix(g, bg, 0.16), text = mix(g, fg, 0.55);
      rows.push({ theme, group: name, hex, bar: ratio(g, bg), text: ratio(text, gbg) });
    }
  }
  return rows;
}

function main() {
  const rows = measure();
  console.log('tema    grupo  cor      barra  texto');
  for (const r of rows) console.log(`${r.theme.padEnd(7)} ${r.group.padEnd(6)} ${r.hex}  ${r.bar.toFixed(2)}   ${r.text.toFixed(2)}`);
  const bad = rows.filter(r => r.bar < 3 || r.text < 4.5);
  if (process.argv.includes('--check') && bad.length) { console.error(`Abaixo do mínimo: ${bad.map(r => `${r.theme}/${r.group}`).join(', ')}`); process.exit(1); }
}

if (require.main === module) main();
module.exports = { measure, palette };
