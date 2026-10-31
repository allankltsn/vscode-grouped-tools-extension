'use strict';
// Allowlist for the SVG fragments that end up in media/icons.js (inserted with innerHTML in the webview)
// and in media/pin/*.svg. Anything outside it makes the generator and the tests fail.
const TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon']);
const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points']);
// Lucide marks a few filled dots with fill="currentColor"; no other fill value is accepted.
const FIXED = { fill: new Set(['currentColor']) };
const VALUE = /^[A-Za-z0-9 .,+-]*$/;

// Checks a body made only of self-closing allowed elements, e.g. `<path d="M0 0"/><circle cx="1" cy="1" r="2"/>`.
// Returns a list of problems (empty when the body is safe).
function checkBody(body) {
  const problems = [], element = /<([A-Za-z0-9]+)((?:\s+[A-Za-z0-9:_-]+="[^"]*")*)\s*\/>/y;
  let at = 0;
  while (at < body.length) {
    element.lastIndex = at;
    const m = element.exec(body);
    if (!m) { problems.push(`conteúdo inesperado em "${body.slice(at, at + 30)}"`); break; }
    if (!TAGS.has(m[1])) problems.push(`tag não permitida: ${m[1]}`);
    for (const a of m[2].matchAll(/\s+([A-Za-z0-9:_-]+)="([^"]*)"/g)) {
      if (FIXED[a[1]]) { if (!FIXED[a[1]].has(a[2])) problems.push(`valor não permitido em ${a[1]}: ${a[2].slice(0, 30)}`); continue; }
      if (!ATTRS.has(a[1])) problems.push(`atributo não permitido: ${a[1]} em <${m[1]}>`);
      if (!VALUE.test(a[2])) problems.push(`valor não permitido em ${a[1]}: ${a[2].slice(0, 30)}`);
    }
    at = element.lastIndex;
  }
  return problems;
}

module.exports = { checkBody, TAGS, ATTRS };
