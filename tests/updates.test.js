import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UPDATES, NOTE_ARTICLES, COLUMNS } from '../src/updates.js';

test('UPDATES: 日付形式が正しく・新しい順に並んでいる', () => {
  assert.ok(UPDATES.length >= 1);
  for (const u of UPDATES) {
    assert.match(u.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(u.text.length > 0);
  }
  const sorted = [...UPDATES].sort((a, b) => (a.date < b.date ? 1 : -1));
  assert.deepEqual(UPDATES.map((u) => u.date), sorted.map((u) => u.date));
});

test('NOTE_ARTICLES: 追加されたら title と url を持つ', () => {
  for (const a of NOTE_ARTICLES) {
    assert.ok(a.title);
    assert.ok(a.url.startsWith('https://'));
  }
});

test('COLUMNS: title と desc を持ち、リンク先のHTMLが実在する', () => {
  assert.ok(COLUMNS.length >= 1);
  for (const c of COLUMNS) {
    assert.ok(c.title.length > 0);
    assert.ok(c.desc.length > 0);
    const file = fileURLToPath(new URL(`../${c.href}`, import.meta.url));
    assert.ok(existsSync(file), `リンク切れ: ${c.href}`);
  }
});
