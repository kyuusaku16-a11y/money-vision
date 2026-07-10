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

test('buildComments: 途中で尽きるプランは先頭が注意コメントになり、褒めの総評にならない', () => {
  const kpis = { targetAge: 47, yearsToTarget: 7, survivesToEnd: false, lifetimeAge: 55, recoversAfterDepletion: true, currentAssets: 5000000, finalAssets: 3000000 };
  const comments = buildComments(kpis, { endAge: 100, targetAmount: 3000000, retireAge: 65 }, 0.1);
  assert.equal(comments[0].type, 'warning'); // 退職前に尽きる → はっきり注意
  assert.match(comments[0].text, /55歳/);
  assert.match(comments[0].text, /持ち直す/); // 復活する事実にも触れる
  // 目標到達コメントは褒めない
  const target = comments.find((c) => /目標/.test(c.title ?? ''));
  assert.equal(target.type, 'info');
  // 「残高は確保できています」系の安心材料は出さない
  assert.equal(comments.some((c) => /残る見込み|残高は確保/.test(c.text)), false);
});

test('buildComments: 退職後に尽きるケースは warning ではなく info の見直し提案', () => {
  const kpis = { targetAge: null, yearsToTarget: null, survivesToEnd: false, lifetimeAge: 78, recoversAfterDepletion: false, currentAssets: 5000000, finalAssets: 0 };
  const comments = buildComments(kpis, { endAge: 100, targetAmount: 30000000, retireAge: 65 }, 0.1);
  assert.equal(comments[0].type, 'info');
  assert.match(comments[0].text, /78歳/);
});
