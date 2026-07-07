import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadState,
  saveState,
  normalizeState,
  DEFAULT_STATE,
  DEFAULT_INPUTS,
  DEFAULT_ADVANCED,
} from '../src/storage.js';

function mockStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  };
}

test('loadState: 空なら既定の状態オブジェクトを返す', () => {
  assert.deepEqual(loadState(mockStorage()), DEFAULT_STATE);
});

test('DEFAULT_STATE: 仕様§8の骨格を持つ', () => {
  assert.equal(DEFAULT_STATE.version, 1);
  assert.deepEqual(DEFAULT_STATE.inputs, DEFAULT_INPUTS);
  assert.deepEqual(DEFAULT_STATE.advanced, DEFAULT_ADVANCED);
  assert.deepEqual(DEFAULT_STATE.events, []);
  assert.equal(DEFAULT_STATE.settings.themeId, 'sprout');
  assert.deepEqual(DEFAULT_STATE.scenarios, []);
});

test('saveState→loadState: 保存した inputs が復元される', () => {
  const s = mockStorage();
  const state = { ...DEFAULT_STATE, inputs: { ...DEFAULT_INPUTS, currentAge: 40 } };
  saveState(state, s);
  assert.equal(loadState(s).inputs.currentAge, 40);
});

test('loadState: 部分保存でも inputs/advanced を既定値で補完する', () => {
  const s = mockStorage();
  s.setItem('money-vision-state', JSON.stringify({ inputs: { currentAge: 50 } }));
  const got = loadState(s);
  assert.equal(got.inputs.currentAge, 50);
  assert.equal(got.inputs.totalAsset, DEFAULT_INPUTS.totalAsset);
  assert.equal(got.advanced.retireAge, DEFAULT_ADVANCED.retireAge);
});

test('loadState: settings.themeId を既定値で補完する', () => {
  const s = mockStorage();
  s.setItem('money-vision-state', JSON.stringify({ settings: {} }));
  assert.equal(loadState(s).settings.themeId, 'sprout');
});

test('loadState: 壊れたJSONなら既定の状態を返す', () => {
  const s = mockStorage();
  s.setItem('money-vision-state', '{壊れた');
  assert.deepEqual(loadState(s), DEFAULT_STATE);
});

test('DEFAULT_STATE: children は空配列', () => {
  assert.deepEqual(DEFAULT_STATE.children, []);
});

test('loadState: children を配列に正規化・保存分を復元する', () => {
  const s = mockStorage();
  s.setItem('money-vision-state', JSON.stringify({ children: [{ age: 5 }] }));
  assert.deepEqual(loadState(s).children, [{ age: 5 }]);
  s.setItem('money-vision-state', JSON.stringify({ children: 'broken' }));
  assert.deepEqual(loadState(s).children, []);
});

test('DEFAULT_ADVANCED: 住宅ローンの既定値（未入力=0円・65歳）を持つ', () => {
  assert.equal(DEFAULT_ADVANCED.loanMonthly, 0);
  assert.equal(DEFAULT_ADVANCED.loanEndAge, 65);
});

test('normalizeState: 読み込みファイルの欠けをデフォルトで補完する', () => {
  const st = normalizeState({ inputs: { currentAge: 42 } });
  assert.equal(st.inputs.currentAge, 42);
  assert.equal(st.inputs.annualIncome, DEFAULT_INPUTS.annualIncome);
  assert.equal(st.advanced.retireAge, DEFAULT_ADVANCED.retireAge);
  assert.deepEqual(st.events, []);
  assert.deepEqual(st.children, []);
});

test('normalizeState: オブジェクト以外はまるごとデフォルト', () => {
  assert.deepEqual(normalizeState(null), DEFAULT_STATE);
  assert.deepEqual(normalizeState('text'), DEFAULT_STATE);
  assert.deepEqual(normalizeState(42), DEFAULT_STATE);
});

test('normalizeState: 配列フィールドの型崩れは空配列に直す', () => {
  const st = normalizeState({ events: 'x', children: { a: 1 }, scenarios: 9 });
  assert.deepEqual(st.events, []);
  assert.deepEqual(st.children, []);
  assert.deepEqual(st.scenarios, []);
});
