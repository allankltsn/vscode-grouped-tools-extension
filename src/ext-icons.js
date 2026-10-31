'use strict';
// Original icons of other extensions, resolved in the extension host (never in the webview):
//   1. the Activity Bar container icon (contributes.viewsContainers.activitybar[].icon): usually a monochrome SVG,
//      sanitized by media/svg-safe.js (rebuilt from an allowlist); `$(codicon)` maps to a catalog icon when one exists;
//   2. otherwise the extension's own `icon` (PNG), sent as a small data URI after a signature check.
// Anything else (too big, outside the extension folder, rejected SVG) yields null: the caller shows the generic icon.
const fs = require('fs');
const path = require('path');
const svgSafe = require('../media/svg-safe');
const catalog = require('../media/pin-catalog');

const MAX_PNG = 16000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readLimited(file, max, fsApi) {
  try {
    const stat = fsApi.statSync(file);
    return stat.isFile() && stat.size <= max ? fsApi.readFileSync(file) : null;
  } catch { return null; }
}

function fromFile(extensionPath, relative, fsApi) {
  if (typeof extensionPath !== 'string' || typeof relative !== 'string' || !relative) return null;
  const base = path.resolve(extensionPath), file = path.resolve(base, relative);
  const inside = path.relative(base, file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return null; // never leaves the extension folder
  const ext = path.extname(file).toLowerCase();
  if (ext === '.svg') {
    const buffer = readLimited(file, svgSafe.MAX_SVG, fsApi);
    const clean = buffer && svgSafe.sanitizeSvg(buffer.toString('utf8'));
    return clean ? { kind: 'svg', ...clean } : null;
  }
  if (ext === '.png') {
    const buffer = readLimited(file, MAX_PNG, fsApi);
    return buffer && buffer.length > PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)
      ? { kind: 'png', src: `data:image/png;base64,${buffer.toString('base64')}` } : null;
  }
  return null;
}

function containerIcon(extension, container, fsApi) {
  const list = extension.packageJSON?.contributes?.viewsContainers?.activitybar;
  const entry = Array.isArray(list) ? list.find(c => c && c.id === container) : undefined;
  const icon = entry && entry.icon;
  if (typeof icon !== 'string') return null;
  const codicon = /^\$\(([a-z0-9-]+)\)$/.exec(icon);
  if (codicon) { const name = catalog.lucideForCodicon(codicon[1]); return name ? { kind: 'lucide', name } : null; }
  return fromFile(extension.extensionPath, icon, fsApi);
}

// `extension` is a vscode.Extension (id, extensionPath, packageJSON); `container` may be undefined.
function resolveIcon(extension, container, fsApi = fs) {
  if (!extension) return null;
  return (container ? containerIcon(extension, container, fsApi) : null) || fromFile(extension.extensionPath, extension.packageJSON?.icon, fsApi);
}

module.exports = { resolveIcon, fromFile, MAX_PNG };
