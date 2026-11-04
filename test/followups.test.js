const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../media/model');
const { tooltipSource, plainName } = require('../src/pins');

const INVISIBLE = {
  empty: '',
  blanks: '   ',
  'zero-width': '​‌‍⁠﻿',
  bidi: '‪‫‬‭‮⁦⁧⁨⁩',
  control: '\u0000\u0001\u0007\u001b',
  mixed: ' ​‮\n\t﻿ '
};

test('QA-7: hover rows and header use a fallback name when the name has nothing visible', () => {
  for (const [label, bad] of Object.entries(INVISIBLE)) {
    const md = tooltipSource({ id: 'g', name: bad }, [
      { id: 'i1', name: bad, command: 'c', kind: 'extension', installed: true },
      { id: 'i2', name: bad, command: 'c', kind: 'extension', installed: false },
      { id: 'i3', name: 'Ok', command: 'c', kind: 'command', installed: null }
    ]);
    const rows = md.split('\n').filter(l => /^\| \$\(/.test(l));
    assert.equal(rows.length, 3, label);
    assert.ok(md.startsWith('**Novo grupo** · 3 extensões'), `${label}: header ${md.split('\n')[0]}`);
    assert.ok(!md.includes('[]('), `${label}: no empty link`);
    assert.ok(!md.includes('****'), `${label}: no empty bold`);
    assert.ok(!/(^|[^\\])\[\]/.test(md), label);
    assert.match(rows[0], /^\| \$\(extensions\) \| \[Extensão sem nome\]\(command:groupedTools\.runById\?[^)]*\)/, `${label}: ${rows[0]}`);
    assert.match(rows[1], /^\| \$\(extensions\) \| Extensão sem nome \*\\\(não instalado\\\)\* \|$/, `${label}: ${rows[1]}`);
    for (const r of rows) assert.equal((r.match(/(?<!\\)\|/g) || []).length, 3, `${label}: two cells in ${r}`);
    assert.ok(!/[‪-‮⁦-⁩​-‏⁠﻿\u0000-\u0008\u001b]/.test(md), `${label}: nothing invisible survives`);
    assert.equal(plainName(bad), 'Novo grupo', label);
  }
  // a normal name is untouched and still escaped
  const md = tooltipSource({ id: 'g', name: 'Git' }, [{ id: 'i', name: 'A [x](command:y)', command: 'c', kind: 'extension', installed: true }]);
  assert.ok(md.startsWith('**Git** ·'));
  assert.ok(md.includes('\\[x\\]'));
  assert.equal(plainName(undefined), 'Novo grupo');
});

test('SEC-2: parseColorInput is bounded for hostile input and unchanged for normal input', () => {
  const hostile = [' '.repeat(100000), '1 '.repeat(50000), `1${' '.repeat(100000)}x`, ',  '.repeat(30000), '9'.repeat(100000), `#${'a'.repeat(100000)}`, `1,${' '.repeat(100000)}`];
  for (const f of ['hex', 'rgb', 'hsl']) {
    for (const input of hostile) {
      const t = process.hrtime.bigint();
      const r = M.parseColorInput(f, input);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      assert.equal(r.ok, false, `${f}`);
      assert.equal(typeof r.error, 'string');
      assert.ok(ms < 50, `${f}: ${ms.toFixed(1)} ms for ${input.length} chars`);
    }
  }
  assert.deepEqual(M.parseColorInput('rgb', '59, 130, 246'), { ok: true, hex: '#3b82f6' });
  assert.deepEqual(M.parseColorInput('hsl', '217, 91%, 60%'), { ok: true, hex: '#3c83f6' });
  assert.deepEqual(M.parseColorInput('hex', '#3B82F6'), { ok: true, hex: '#3b82f6' });
  assert.deepEqual(M.parseColorInput('rgb', '  59,130 ,246,  '), { ok: true, hex: '#3b82f6' });
  assert.equal(M.parseColorInput('rgb', `59, 130, 246${' '.repeat(100)}x`).ok, false);
});
