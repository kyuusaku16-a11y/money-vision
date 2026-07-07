import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadStamps,
  stampToday,
  stampsThisMonth,
  stampCharFor,
  milestoneMessage,
  dailyQuote,
} from '../src/stamps.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('stampToday: 1日1回だけ押せる', () => {
  const s = fakeStorage();
  const d = new Date(2026, 6, 8);
  const first = stampToday(s, d);
  assert.equal(first.added, true);
  assert.equal(first.count, 1);
  const second = stampToday(s, d);
  assert.equal(second.added, false);
  assert.equal(second.count, 1);
  assert.deepEqual(stampsThisMonth(s, d), [8]);
});

test('stampToday: 別の日は追記され、日付順に並ぶ', () => {
  const s = fakeStorage();
  stampToday(s, new Date(2026, 6, 10));
  stampToday(s, new Date(2026, 6, 3));
  assert.deepEqual(stampsThisMonth(s, new Date(2026, 6, 20)), [3, 10]);
});

test('stampToday: 月が変わればゼロから・古い月は3ヶ月分だけ保持', () => {
  const s = fakeStorage();
  for (let m = 0; m < 5; m++) stampToday(s, new Date(2026, m, 1));
  const all = loadStamps(s);
  assert.equal(Object.keys(all).length, 3); // 直近3ヶ月だけ
  assert.deepEqual(stampsThisMonth(s, new Date(2026, 4, 15)), [1]);
});

test('loadStamps: 壊れたデータは空オブジェクト', () => {
  const s = fakeStorage();
  s.setItem('money-vision-stamps', '{oops');
  assert.deepEqual(loadStamps(s), {});
  s.setItem('money-vision-stamps', '[1,2]');
  assert.deepEqual(loadStamps(s), {});
});

test('stampCharFor: 日付で安定してキャラが決まり、3種が循環する', () => {
  const a = stampCharFor(1);
  assert.equal(stampCharFor(1), a); // 安定
  const set = new Set([stampCharFor(1), stampCharFor(2), stampCharFor(3)]);
  assert.equal(set.size, 3);
  for (let d = 1; d <= 31; d++) assert.ok(stampCharFor(d).startsWith('assets/'));
});

test('milestoneMessage: 節目だけ特別に褒める', () => {
  assert.ok(milestoneMessage(5));
  assert.ok(milestoneMessage(10));
  assert.ok(milestoneMessage(20));
  assert.equal(milestoneMessage(3), null);
  assert.equal(milestoneMessage(11), null);
});

test('dailyQuote: 同じ日は同じひとこと・金額や不安を煽る言葉は無し', () => {
  const d = new Date(2026, 6, 8);
  assert.equal(dailyQuote(d), dailyQuote(d));
  // 年間を通して中身チェック
  const seen = new Set();
  for (let i = 0; i < 366; i++) {
    const q = dailyQuote(new Date(2026, 0, 1 + i));
    assert.ok(q.length > 0);
    assert.ok(!/[0-9０-９]+万円/.test(q));
    assert.ok(!q.includes('損'));
    seen.add(q);
  }
  assert.ok(seen.size >= 10); // ちゃんとバリエーションがある
});
