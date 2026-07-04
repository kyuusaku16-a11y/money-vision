import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildComments } from '../src/comments.js';

const params = { endAge: 100, currentAge: 35 };

test('buildComments: 目標到達年があれば good コメントに年齢が入る', () => {
  const kpis = { targetAge: 55, yearsToTarget: 20, survivesToEnd: true, lifetimeAge: null, currentAssets: 5000000, finalAssets: 200000000 };
  const cs = buildComments(kpis, params);
  assert.ok(cs.some((c) => c.type === 'good' && c.text.includes('55歳')));
});

test('buildComments: 終了年齢まで持つなら大丈夫圏内メッセージ', () => {
  const kpis = { targetAge: 55, yearsToTarget: 20, survivesToEnd: true, lifetimeAge: null, currentAssets: 5000000, finalAssets: 200000000 };
  const cs = buildComments(kpis, params);
  assert.ok(cs.some((c) => c.type === 'good' && c.text.includes('100歳') && c.text.includes('大丈夫圏内')));
});

test('buildComments: 枯渇するなら資産寿命の年齢を示す', () => {
  const kpis = { targetAge: null, yearsToTarget: null, survivesToEnd: false, lifetimeAge: 78, currentAssets: 5000000, finalAssets: 0 };
  const cs = buildComments(kpis, params);
  assert.ok(cs.some((c) => c.type === 'info' && c.text.includes('約78歳')));
  assert.ok(cs.some((c) => c.type === 'info' && c.text.includes('目標')));
});

test('buildComments: 資産寿命が算出できない場合も責めない warning を返す', () => {
  const kpis = { targetAge: null, yearsToTarget: null, survivesToEnd: false, lifetimeAge: null, currentAssets: 1000000, finalAssets: 0 };
  const cs = buildComments(kpis, params);
  const w = cs.find((c) => c.type === 'warning');
  assert.ok(w, 'warning コメントが存在する');
  assert.ok(!w.text.includes('尽きる') && !w.text.includes('危険'));
});
