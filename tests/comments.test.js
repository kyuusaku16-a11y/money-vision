import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildComments, CHEERS } from '../src/comments.js';

const params = { endAge: 100, currentAge: 35, targetAmount: 100000000 };
const okKpis = { targetAge: 55, yearsToTarget: 20, survivesToEnd: true, lifetimeAge: null, currentAssets: 5000000, finalAssets: 200000000 };
const behindKpis = { targetAge: null, yearsToTarget: null, survivesToEnd: false, lifetimeAge: 78, currentAssets: 5000000, finalAssets: 0 };

const all = (c) => `${c.title ?? ''} ${c.text}`;

test('buildComments: 見出し＋本文の2段構成で返す', () => {
  const cs = buildComments(okKpis, params, 0);
  assert.ok(cs.filter((c) => c.type !== 'cheer').every((c) => typeof c.title === 'string' && c.title.length > 0));
  assert.ok(cs.every((c) => c.text.length > 0));
});

test('buildComments: 目標到達なら good に年齢が入る', () => {
  const cs = buildComments(okKpis, params, 0);
  assert.ok(cs.some((c) => c.type === 'good' && all(c).includes('55歳')));
});

test('buildComments: 未達なら見直しアクションチップが3つ付く', () => {
  const cs = buildComments(behindKpis, params, 0);
  const c = cs.find((x) => x.actions);
  assert.ok(c, 'actions付きコメントがある');
  assert.deepEqual(c.actions.map((a) => a.label), ['積立額を増やす', '利回りを見直す', '支出を見直す']);
  assert.deepEqual(c.actions.map((a) => a.targetId), ['monthlyInvest', 'expectedReturn', 'annualExpense']);
});

test('buildComments: 到達済みならアクションチップは出ない', () => {
  const cs = buildComments(okKpis, params, 0);
  assert.ok(!cs.some((c) => c.actions));
});

test('buildComments: 資産寿命・残高のメッセージが状況に応じて出る', () => {
  const ok = buildComments(okKpis, params, 0);
  assert.ok(ok.some((c) => all(c).includes('100歳') && all(c).includes('持つ計算')));
  const behind = buildComments(behindKpis, params, 0);
  assert.ok(behind.some((c) => all(c).includes('約78歳')));
});

test('buildComments: seed で言い回しが変わる（同じ状況でも別の文面）', () => {
  const a = buildComments(okKpis, params, 0);
  const b = buildComments(okKpis, params, 0.9);
  assert.notEqual(a[0].title, b[0].title);
});

test('buildComments: 締めの標語（cheer）が最後に1つ付く', () => {
  const cs = buildComments(okKpis, params, 0);
  const last = cs[cs.length - 1];
  assert.equal(last.type, 'cheer');
  assert.ok(CHEERS.includes(last.text));
});

test('buildComments: 責めない・不安を煽らない（枯渇不明ケース）', () => {
  const kpis = { ...behindKpis, lifetimeAge: null };
  const cs = buildComments(kpis, params, 0);
  const w = cs.find((c) => c.type === 'warning');
  assert.ok(w);
  assert.ok(!all(w).includes('尽きる') && !all(w).includes('危険'));
});
