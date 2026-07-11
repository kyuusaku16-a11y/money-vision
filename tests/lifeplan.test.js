import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLifeplanRows } from '../src/lifeplan.js';
import { projectAssets, deriveKpis } from '../src/calc.js';

const base = {
  currentAge: 27, totalAsset: 3000000, investedAsset: 1000000,
  monthlyInvest: 30000, annualIncome: 3500000, annualExpense: 2800000,
  expectedReturn: 3, targetAmount: 20000000,
  retireAge: 65, pensionAnnual: 1800000, pensionStartAge: 68,
  retirementBonus: 0, retiredExpenseRatio: 0.7, endAge: 100,
  events: [{ age: 30, amount: 1000000, label: '結婚' }], children: [],
};

const run = (params) => {
  const series = projectAssets(params, params.expectedReturn / 100);
  const kpis = deriveKpis(series, params);
  return { series, kpis, rows: buildLifeplanRows(params, series, kpis, { baseYear: 2026 }) };
};

test('buildLifeplanRows: 年齢順・重複なしで、現在と終了年齢を必ず含む', () => {
  const { rows } = run(base);
  const ages = rows.map((r) => r.age);
  assert.equal(ages[0], 27);
  assert.equal(ages[ages.length - 1], 100);
  assert.deepEqual([...ages].sort((a, b) => a - b), ages);
  assert.equal(new Set(ages).size, ages.length);
});

test('buildLifeplanRows: 節目の年に「できごと」が付く', () => {
  const { rows } = run(base);
  const noteAt = (age) => rows.find((r) => r.age === age)?.notes.join(' ') ?? '';
  assert.ok(noteAt(30).includes('結婚'));
  assert.ok(noteAt(30).includes('100万円'));
  assert.ok(noteAt(65).includes('退職'));
  assert.ok(noteAt(68).includes('年金'));
});

test('buildLifeplanRows: 目標到達の年を祝う行がある', () => {
  const { rows, kpis } = run(base);
  assert.notEqual(kpis.targetAge, null);
  const row = rows.find((r) => r.age === kpis.targetAge);
  assert.ok(row.notes.join(' ').includes('目標'));
});

test('buildLifeplanRows: 資産が尽きるプランは、その年に正直な注意が付く', () => {
  const tight = { ...base, annualExpense: 3400000, monthlyInvest: 0, targetAmount: 999999999999 };
  const { rows, kpis } = run(tight);
  assert.equal(kpis.survivesToEnd, false);
  const row = rows.find((r) => r.age === kpis.lifetimeAge);
  assert.ok(row, '資産寿命の行がある');
  assert.ok(row.notes.join(' ').includes('尽きる'));
  const all = rows.flatMap((r) => r.notes).join(' ');
  assert.ok(!all.includes('失敗') && !all.includes('危険'), '責めない');
});

test('buildLifeplanRows: 西暦と資産見込みが引ける', () => {
  const { rows, series } = run(base);
  const r30 = rows.find((r) => r.age === 30);
  assert.equal(r30.year, 2029);
  assert.equal(r30.assets, series.find((p) => p.age === 30).assets);
});

test('buildLifeplanRows: 行数はA4に収まる範囲（24行以下）に間引かれる', () => {
  const long = { ...base, currentAge: 22, endAge: 105, events: [
    { age: 25, amount: 1, label: 'a' }, { age: 26, amount: 1, label: 'b' },
    { age: 31, amount: 1, label: 'c' }, { age: 33, amount: 1, label: 'd' },
  ] };
  const { rows } = run(long);
  assert.ok(rows.length <= 24, `rows=${rows.length}`);
  // 節目は間引かれない
  assert.ok(rows.some((r) => r.age === 33));
});

test('buildLifeplanRows: 教育費ピークの年が載る', () => {
  const withChild = { ...base, currentAge: 30, children: [{ age: 2, course: 'private-arts' }] };
  const { rows } = run(withChild);
  assert.ok(rows.some((r) => r.notes.join(' ').includes('教育費')));
});
