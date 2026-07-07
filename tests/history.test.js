import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthOf,
  loadHistory,
  recordSnapshot,
  previousSnapshot,
  buildWelcomeBack,
} from '../src/history.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const kpis = (lifetimeAge, survivesToEnd) => ({ lifetimeAge, survivesToEnd, targetAge: 60 });

test('monthOf は YYYY-MM 形式（月ゼロ埋め）', () => {
  assert.equal(monthOf(new Date(2026, 6, 7)), '2026-07');
  assert.equal(monthOf(new Date(2026, 10, 1)), '2026-11');
});

test('loadHistory: 未保存・壊れたJSON・配列以外は空配列', () => {
  assert.deepEqual(loadHistory(fakeStorage()), []);
  const s = fakeStorage();
  s.setItem('money-vision-history', '{oops');
  assert.deepEqual(loadHistory(s), []);
  s.setItem('money-vision-history', '{"a":1}');
  assert.deepEqual(loadHistory(s), []);
});

test('recordSnapshot: 同じ月は上書き・別の月は追記', () => {
  const s = fakeStorage();
  recordSnapshot(kpis(80, false), s, '2026-06');
  recordSnapshot(kpis(82, false), s, '2026-06'); // 同月更新
  recordSnapshot(kpis(85, false), s, '2026-07');
  const h = loadHistory(s);
  assert.equal(h.length, 2);
  assert.equal(h[0].ym, '2026-06');
  assert.equal(h[0].lifetimeAge, 82);
  assert.equal(h[1].ym, '2026-07');
});

test('recordSnapshot: 24ヶ月分より古いものは捨てる', () => {
  const s = fakeStorage();
  for (let i = 0; i < 30; i++) {
    const ym = `20${20 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    recordSnapshot(kpis(80 + i, false), s, ym);
  }
  const h = loadHistory(s);
  assert.equal(h.length, 24);
  assert.equal(h[h.length - 1].lifetimeAge, 109);
});

test('previousSnapshot: 今月を除いた直近の記録を返す', () => {
  const hist = [
    { ym: '2026-04', lifetimeAge: 78 },
    { ym: '2026-06', lifetimeAge: 80 },
    { ym: '2026-07', lifetimeAge: 83 },
  ];
  assert.equal(previousSnapshot(hist, '2026-07').ym, '2026-06');
  assert.equal(previousSnapshot([{ ym: '2026-07' }], '2026-07'), null);
  assert.equal(previousSnapshot([], '2026-07'), null);
});

test('buildWelcomeBack: 前回記録なしは null', () => {
  assert.equal(buildWelcomeBack(null, kpis(80, false)), null);
});

test('buildWelcomeBack: 資産寿命がのびたら喜ぶ（差の歳数入り）', () => {
  const msg = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(83, false));
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('3歳'));
});

test('buildWelcomeBack: 最後まで持つようになった変化を祝う', () => {
  const msg = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(null, true));
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('最後まで'));
});

test('buildWelcomeBack: 悪化は責めずに見直しを促す', () => {
  const down = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 83, survivesToEnd: false }, kpis(80, false));
  assert.equal(down.type, 'gentle');
  assert.ok(!down.text.includes('悪'));
  const lost = buildWelcomeBack({ ym: '2026-06', lifetimeAge: null, survivesToEnd: true }, kpis(80, false));
  assert.equal(lost.type, 'gentle');
});

test('buildWelcomeBack: 変化なしはキープを褒める', () => {
  const same = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(80, false));
  assert.equal(same.type, 'improved');
  const bothOk = buildWelcomeBack({ ym: '2026-06', lifetimeAge: null, survivesToEnd: true }, kpis(null, true));
  assert.equal(bothOk.type, 'improved');
});
