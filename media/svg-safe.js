/* Sanitizer for third-party SVG icons (container icons of other extensions). Pure, shared by the extension (src/)
   and the webview. It never copies the input: it parses it and REBUILDS a new fragment from an allowlist of shapes
   and presentation attributes, so scripts, event handlers, foreignObject, <use>/<image>, hrefs, styles and entities
   cannot survive. Anything outside the allowlist (an unknown tag, a nested <svg>, malformed markup) rejects the
   whole icon and the caller falls back to the generic icon. Colors are mapped to currentColor (monochrome). */
(function (root) {
  'use strict';

  const MAX_SVG = 20000, MAX_ELEMENTS = 300, MAX_PATH = 10000;
  const SHAPES = {
    path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'],
    ellipse: ['cx', 'cy', 'rx', 'ry'], polyline: ['points'], polygon: ['points']
  };
  const IGNORED = new Set(['title', 'desc', 'metadata']); // their text is never output
  // Every attribute is length-checked BEFORE any regex runs, and every pattern below is unambiguous (no nested or
  // overlapping quantifiers), so matching time is linear in the (bounded) input.
  const MAX_NUM = 32, MAX_TRANSFORM = 200, MAX_FUNCS = 8, MAX_VIEWBOX = 120, MAX_GEOMETRY = 4000;
  const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
  const num = v => typeof v === 'string' && v.length <= MAX_NUM && NUMBER.test(v);
  const GEOMETRY = /^[-0-9.eE+ ,]*$/;
  const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-., \t\r\n]*$/;
  const TRANSFORM_FN = /\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([-0-9.eE+ ,]*\)/y;
  // Manual tokenizer: sticky matches from a moving index, at most MAX_FUNCS functions, nothing else allowed.
  function validTransform(v) {
    if (typeof v !== 'string' || v.length > MAX_TRANSFORM) return false;
    let at = 0, n = 0;
    while (v.slice(at).trim() !== '') {
      TRANSFORM_FN.lastIndex = at;
      if (!TRANSFORM_FN.test(v) || ++n > MAX_FUNCS) return false;
      at = TRANSFORM_FN.lastIndex;
    }
    return true;
  }
  const ENUMS = {
    'stroke-linecap': ['butt', 'round', 'square'], 'stroke-linejoin': ['miter', 'round', 'bevel', 'miter-clip', 'arcs'],
    'fill-rule': ['nonzero', 'evenodd'], 'clip-rule': ['nonzero', 'evenodd']
  };
  const NUMERIC = ['stroke-width', 'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity'];

  // Presentation attributes allowed on <svg>, <g> and shapes. Returns an attribute string or null for a bad value.
  function presentation(attrs) {
    let out = '';
    for (const name of ['fill', 'stroke']) {
      if (attrs[name] === undefined) continue;
      out += ` ${name}="${attrs[name].trim() === 'none' ? 'none' : 'currentColor'}"`;
    }
    for (const name of NUMERIC) if (attrs[name] !== undefined && num(attrs[name].trim())) out += ` ${name}="${attrs[name].trim()}"`;
    for (const name of Object.keys(ENUMS)) if (attrs[name] !== undefined && ENUMS[name].includes(attrs[name].trim())) out += ` ${name}="${attrs[name].trim()}"`;
    if (validTransform(attrs.transform)) out += ` transform="${attrs.transform.trim()}"`;
    return out;
  }

  function parseAttrs(text) {
    const attrs = Object.create(null), re = /([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
    let m;
    while ((m = re.exec(text))) {
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!(m[1] in attrs) && !value.includes('&')) attrs[m[1]] = value;
    }
    return attrs;
  }

  function viewBoxOf(attrs) {
    const vb = attrs.viewBox;
    if (typeof vb === 'string' && vb.length <= MAX_VIEWBOX) {
      const n = vb.trim().split(/[\s,]+/);
      if (n.length === 4 && n.every(num) && Number(n[2]) > 0 && Number(n[3]) > 0) return n.join(' ');
    }
    const w = parseFloat(String(attrs.width).slice(0, MAX_NUM)), h = parseFloat(String(attrs.height).slice(0, MAX_NUM));
    if (w > 0 && h > 0 && w <= 4096 && h <= 4096) return `0 0 ${w} ${h}`;
    return '0 0 24 24';
  }

  // Removes every `open ... close` block with indexOf (linear, unlike a lazy regex retried at each opener);
  // an unterminated block rejects the icon. A DOCTYPE with an internal subset (`[`) is rejected as well.
  function stripBlocks(text, open, close, ci) {
    const hay = ci ? text.replace(/[A-Z]/g, c => c.toLowerCase()) : text;
    let out = '', at = 0;
    for (;;) {
      const i = hay.indexOf(open, at);
      if (i < 0) return out + text.slice(at);
      const j = hay.indexOf(close, i + open.length);
      if (j < 0) return null;
      if (ci && text.slice(i, j).includes('[')) return null;
      out += text.slice(at, i); at = j + close.length;
    }
  }

  // Returns { viewBox, body } or null when the icon is rejected.
  function sanitizeSvg(text, limit = MAX_SVG) {
    if (typeof text !== 'string' || text.length > limit) return null;
    let src = text.replace(/^﻿/, '');
    if (/<!ENTITY|<!\[CDATA\[/i.test(src)) return null;
    src = stripBlocks(src, '<?xml', '?>');
    if (src !== null) src = stripBlocks(src, '<!--', '-->');
    if (src !== null) src = stripBlocks(src, '<!doctype', '>', true);
    if (src === null) return null;
    const tag = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:\s+[^\s=<>"'/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*(\/?)>/y;
    const stack = []; let at = 0, body = '', rootAttrs = null, count = 0, closed = false;
    while (at < src.length) {
      const lt = src.indexOf('<', at);
      if (lt < 0) break;
      if (src.slice(at, lt).trim() && !stack.some(n => IGNORED.has(n)) && !stack.length) return null; // stray text outside the root
      tag.lastIndex = lt;
      const m = tag.exec(src);
      if (!m) return null; // malformed markup
      at = tag.lastIndex;
      const [, closing, name, attrText, selfClosing] = m;
      if (closing) {
        if (!stack.length || stack.pop() !== name) return null;
        if (name === 'g') body += '</g>';
        if (name === 'svg') { closed = true; body += '</g>'; }
        continue;
      }
      if (closed) return null;
      if (++count > MAX_ELEMENTS) return null;
      const attrs = parseAttrs(attrText);
      if (name === 'svg') {
        if (rootAttrs || stack.length) return null; // one root, no nesting
        rootAttrs = attrs;
        const wrap = presentation(attrs);
        body += wrap ? `<g${wrap}>` : '<g>';
      } else if (!stack.includes('svg')) return null;
      else if (name === 'g') body += `<g${presentation(attrs)}>`;
      else if (SHAPES[name]) {
        if (stack.some(n => IGNORED.has(n))) return null;
        let out = `<${name}`;
        for (const a of SHAPES[name]) {
          const v = attrs[a];
          if (v === undefined) continue;
          if (a === 'd' ? v.length <= MAX_PATH && PATH_DATA.test(v) : v.length <= MAX_GEOMETRY && GEOMETRY.test(v)) out += ` ${a}="${v.trim()}"`;
        }
        body += `${out}${presentation(attrs)}/>`;
      } else if (!IGNORED.has(name)) return null; // script, foreignObject, use, image, style, a, animate, defs...
      if (selfClosing) { if (name === 'svg') { closed = true; body += '</g>'; } if (name === 'g') body += '</g>'; } else stack.push(name);
    }
    if (!rootAttrs || stack.length || !closed) return null;
    const out = { viewBox: viewBoxOf(rootAttrs), body };
    return /<(?:path|circle|rect|line|ellipse|polyline|polygon)\b/.test(out.body) ? out : null;
  }

  // Defense in depth in the webview: the markup it receives must survive the sanitizer unchanged.
  function checkImage(img) {
    if (!img || typeof img !== 'object') return null;
    if (img.kind === 'lucide') return typeof img.name === 'string' && /^[a-z0-9-]{1,64}$/.test(img.name) ? img : null; // the webview renders it only if its local catalog has the name
    if (img.kind === 'png') return typeof img.src === 'string' && img.src.length <= 24000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(img.src) ? img : null;
    if (img.kind === 'svg') {
      const again = typeof img.viewBox === 'string' && typeof img.body === 'string' ? sanitizeSvg(`<svg viewBox="${img.viewBox}">${img.body}</svg>`, Math.floor(MAX_SVG * 1.5)) : null;
      return again && again.body === `<g>${img.body}</g>` && again.viewBox === img.viewBox ? img : null;
    }
    return null;
  }

  // Only the default icon of an item is replaced by the extension's original; a deliberate choice (even 'puzzle') stays.
  const isGenericIcon = icon => !icon || icon === 'extensions';

  const api = { sanitizeSvg, checkImage, isGenericIcon, MAX_SVG };
  root.svgSafe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
