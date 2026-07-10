import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTRAS } from '../src/extras.js';
import { allTypes } from '../src/share.js';
import { COLUMNS } from '../src/updates.js';

const validHrefs = new Set(COLUMNS.map((c) => c.href));

test('EXTRAS: 16タイプ全部そろっている', () => {
  const codes = allTypes().map((t) => t.code);
  assert.equal(Object.keys(EXTRAS).length, 16);
  for (const code of codes) assert.ok(EXTRAS[code], `${code} がない`);
});

test('EXTRAS: あるあるは3つ・落とし穴は1段落・よみものは2〜3本', () => {
  for (const [code, e] of Object.entries(EXTRAS)) {
    assert.equal(e.aruaru.length, 3, `${code} のあるある`);
    for (const a of e.aruaru) {
      assert.ok(a.length >= 10 && a.length <= 50, `${code} のあるあるの長さ: ${a}`);
    }
    assert.ok(e.otoshiana.length >= 100 && e.otoshiana.length <= 220, `${code} の落とし穴の長さ`);
    assert.ok(e.yomimono.length >= 2 && e.yomimono.length <= 3, `${code} のよみもの本数`);
  }
});

test('EXTRAS: よみものリンクは実在するコラムだけ', () => {
  for (const [code, e] of Object.entries(EXTRAS)) {
    for (const y of e.yomimono) {
      assert.ok(validHrefs.has(y.href), `${code} のリンク切れ: ${y.href}`);
      assert.ok(y.title);
    }
  }
});

test('EXTRAS: 責めない・断定助言しないトーン', () => {
  for (const [code, e] of Object.entries(EXTRAS)) {
    const all = [...e.aruaru, e.otoshiana].join('');
    assert.ok(!all.includes('すべき'), `${code} に断定助言`);
    assert.ok(!all.includes('ダメ'), `${code} に責める言葉`);
    assert.ok(!all.includes('浪費癖'), `${code} に責める言葉`);
  }
});
