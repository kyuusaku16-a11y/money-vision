import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReaction } from '../src/reactions.js';

const kpi = (targetAge, survivesToEnd, lifetimeAge) => ({ targetAge, survivesToEnd, lifetimeAge });

test('buildReaction: 初回（prevなし）は null', () => {
  assert.equal(buildReaction(null, kpi(60, true, null)), null);
});

test('buildReaction: 目標到達が早まったら improved と年数', () => {
  const r = buildReaction(kpi(60, true, null), kpi(57, true, null));
  assert.equal(r.type, 'improved');
  assert.ok(r.text.includes('3年早く'));
});

test('buildReaction: 未達→到達に変わったら improved', () => {
  const r = buildReaction(kpi(null, true, null), kpi(65, true, null));
  assert.equal(r.type, 'improved');
});

test('buildReaction: 資産寿命が延びたら improved', () => {
  const r = buildReaction(kpi(null, false, 80), kpi(null, false, 85));
  assert.equal(r.type, 'improved');
});

test('buildReaction: 悪化したら slower（責めない文言）', () => {
  const r = buildReaction(kpi(60, true, null), kpi(63, true, null));
  assert.equal(r.type, 'slower');
  assert.ok(!r.text.includes('ダメ') && !r.text.includes('遅すぎ'));
});

test('buildReaction: 変化なしは null', () => {
  assert.equal(buildReaction(kpi(60, true, null), kpi(60, true, null)), null);
});
