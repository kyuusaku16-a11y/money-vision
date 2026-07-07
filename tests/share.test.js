import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAxes, diagnoseType, buildShareText, ANIMALS, PERSONAS } from '../src/share.js';

const base = {
  currentAge: 35, annualIncome: 5000000, annualExpense: 3000000,
  monthlyInvest: 50000, expectedReturn: 5, targetAmount: 100000000,
  endAge: 100, children: [], events: [], loanMonthly: 0,
};
const kpis = { survivesToEnd: true, lifetimeAge: null, targetAge: 65 };

test('deriveAxes: 貯蓄率20%以上は「ためる」・未満は「まわす」', () => {
  assert.equal(deriveAxes(kpis, base).flow, 'ためる'); // 40%
  assert.equal(deriveAxes(kpis, { ...base, annualExpense: 4200000 }).flow, 'まわす'); // 16%
});

test('deriveAxes: 余剰の半分以上を投資 or 利回り6%以上は「そだてる」', () => {
  assert.equal(deriveAxes(kpis, { ...base, monthlyInvest: 100000 }).grow, 'そだてる'); // 60%投資
  assert.equal(deriveAxes(kpis, { ...base, expectedReturn: 7 }).grow, 'そだてる');
  assert.equal(deriveAxes(kpis, base).grow, 'まもる'); // 30%投資・5%
});

test('deriveAxes: 何か登録していれば「地図」・空なら「コンパス」', () => {
  assert.equal(deriveAxes(kpis, base).plan, 'コンパス');
  assert.equal(deriveAxes(kpis, { ...base, children: [{ age: 5 }] }).plan, '地図');
  assert.equal(deriveAxes(kpis, { ...base, loanMonthly: 100000 }).plan, '地図');
});

test('deriveAxes: 目標が年収15倍以上は「大志」', () => {
  assert.equal(deriveAxes(kpis, base).dream, '大志'); // 1億 = 年収20倍
  assert.equal(deriveAxes(kpis, { ...base, targetAmount: 30000000 }).dream, '満ち足り');
});

test('diagnoseType: 軸の組み合わせが正しい動物と性格になる', () => {
  // ためる×まもる×コンパス×大志 = 冒険家ハムスター
  const t = diagnoseType(kpis, base);
  assert.equal(t.name, '冒険家ハムスター');
  assert.deepEqual(t.tags, ['ためる', 'まもる', 'コンパス', '大志']);
  // まわす×そだてる×地図×満ち足り = 庭師ミツバチ
  const t2 = diagnoseType(kpis, {
    ...base, annualExpense: 4200000, expectedReturn: 7,
    children: [{ age: 5 }], targetAmount: 30000000,
  });
  assert.equal(t2.name, '庭師ミツバチ');
});

test('16タイプ全てに固有の名言があり、責める言葉を含まない', () => {
  const seen = new Set();
  for (const animal of Object.values(ANIMALS)) {
    for (const persona of Object.values(PERSONAS)) {
      const params = {
        ...base,
        annualExpense: animal.id === 'squirrel' || animal.id === 'hamster' ? 3000000 : 4200000,
        expectedReturn: animal.id === 'squirrel' || animal.id === 'bee' ? 7 : 3,
        monthlyInvest: 10000,
        children: persona.id === 'strategist' || persona.id === 'gardener' ? [{ age: 5 }] : [],
        targetAmount: persona.id === 'strategist' || persona.id === 'adventurer' ? 100000000 : 30000000,
      };
      const t = diagnoseType(kpis, params);
      assert.equal(t.name, `${persona.label}${animal.label}`);
      assert.ok(t.quote.length >= 15, `${t.name} の名言が短すぎ`);
      assert.ok(!seen.has(t.quote), `${t.name} の名言が重複`);
      seen.add(t.quote);
      for (const ng of ['ダメ', '不足', '危険', '失敗', '浪費']) {
        assert.ok(!t.quote.includes(ng), `${t.name} に責める語`);
      }
    }
  }
  assert.equal(seen.size, 16);
});

test('buildShareText: タイプ名・4タグ入り、金額なし', () => {
  const t = buildShareText(kpis, base);
  assert.ok(t.includes('冒険家ハムスター'));
  assert.ok(t.includes('ためる') && t.includes('大志'));
  assert.ok(!t.includes('万円') && !t.includes('億円'));
  assert.ok(t.includes('#マネービジョン'));
});
