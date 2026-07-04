import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectAssets, deriveKpis } from '../src/calc.js';

const base = {
  currentAge: 35,
  totalAsset: 5000000,
  investedAsset: 5000000,
  monthlyInvest: 50000,
  annualIncome: 5000000,
  annualExpense: 3000000,
  targetAmount: 100000000,
  retireAge: 65,
  pensionAnnual: 1800000,
  pensionStartAge: 65,
  retirementBonus: 0,
  retiredExpenseRatio: 0.7,
  endAge: 100,
};

test('projectAssets: 初年度は現金0・投資=investedAsset', () => {
  const s = projectAssets(base, 0.05);
  assert.equal(s[0].age, 35);
  assert.equal(s[0].invested, 5000000);
  assert.equal(s[0].cash, 0);
  assert.equal(s[0].assets, 5000000);
});

test('projectAssets: 現役1年で投資は利回り+積立、現金は収支余剰が乗る', () => {
  const s = projectAssets(base, 0.05);
  // 投資: 5,000,000*1.05 + 600,000 = 5,850,000
  assert.equal(s[1].invested, 5850000);
  // 現金: 0 + (5,000,000 - 3,000,000 - 600,000) = 1,400,000
  assert.equal(s[1].cash, 1400000);
  assert.equal(s[1].assets, 7250000);
});

test('projectAssets: currentAge〜endAge を含む（既定100歳=66件）', () => {
  const s = projectAssets(base, 0.05);
  assert.equal(s[s.length - 1].age, 100);
  assert.equal(s.length, 66);
});

test('projectAssets: 退職年齢の年に退職金を現金へ一括加算', () => {
  const inputs = { ...base, currentAge: 64, retireAge: 65, retirementBonus: 10000000, totalAsset: 0, investedAsset: 0 };
  const s = projectAssets(inputs, 0.0);
  // 現役最終年 age64: 投資 0+600,000=600,000 / 現金 0+(5,000,000-3,000,000-600,000)=1,400,000 → +退職金10,000,000
  assert.equal(s[1].age, 65);
  assert.equal(s[1].cash, 11400000);
  assert.equal(s[1].invested, 600000);
  assert.equal(s[1].assets, 12000000);
});

test('projectAssets: 退職後は年金-老後支出、不足は投資から現金優先取り崩し', () => {
  const inputs = { ...base, currentAge: 65, retireAge: 65 };
  const s = projectAssets(inputs, 0.0);
  // 老後支出=3,000,000*0.7=2,100,000 / 年金 age65>=65 =1,800,000
  // 現金 0+(1,800,000-2,100,000)=-300,000 → 投資から取り崩し: 投資 5,000,000-300,000=4,700,000, 現金0
  assert.equal(s[1].age, 66);
  assert.equal(s[1].cash, 0);
  assert.equal(s[1].invested, 4700000);
  assert.equal(s[1].assets, 4700000);
});

test('projectAssets: 年金開始年齢前は年金0で取り崩しが大きい', () => {
  const inputs = { ...base, currentAge: 65, retireAge: 65, pensionStartAge: 70 };
  const s = projectAssets(inputs, 0.0);
  // 年金0: 現金 0-2,100,000=-2,100,000 → 投資 5,000,000-2,100,000=2,900,000
  assert.equal(s[1].invested, 2900000);
  assert.equal(s[1].cash, 0);
});

test('projectAssets: 総資産は0で下げ止まる（負にならない）', () => {
  const inputs = { ...base, currentAge: 80, retireAge: 65, totalAsset: 1000000, investedAsset: 1000000, annualExpense: 8000000, pensionAnnual: 0 };
  const s = projectAssets(inputs, 0.0);
  assert.ok(s.every((p) => p.assets >= 0));
});

test('deriveKpis: 目標到達年齢と残り年数を返す', () => {
  const s = projectAssets(base, 0.07);
  const k = deriveKpis(s, base);
  assert.notEqual(k.targetAge, null);
  assert.equal(k.yearsToTarget, k.targetAge - base.currentAge);
});

test('deriveKpis: 未達なら targetAge / yearsToTarget は null', () => {
  const low = { ...base, monthlyInvest: 0, totalAsset: 1000000, investedAsset: 1000000, annualIncome: 3000000 };
  const k = deriveKpis(projectAssets(low, 0.0), low);
  assert.equal(k.targetAge, null);
  assert.equal(k.yearsToTarget, null);
});

test('deriveKpis: 終了年齢まで資産が残るなら survivesToEnd=true, lifetimeAge=null', () => {
  const k = deriveKpis(projectAssets(base, 0.05), base);
  assert.equal(k.survivesToEnd, true);
  assert.equal(k.lifetimeAge, null);
});

test('deriveKpis: 枯渇するなら survivesToEnd=false, lifetimeAge=最後に資産が正だった年齢', () => {
  // age60から老後支出1,000万・年金0・利回り0 → age60(500万)で保ち、age61で枯渇
  const inputs = { ...base, currentAge: 60, retireAge: 60, totalAsset: 5000000, investedAsset: 5000000, annualExpense: 10000000, retiredExpenseRatio: 1.0, pensionAnnual: 0 };
  const k = deriveKpis(projectAssets(inputs, 0.0), inputs);
  assert.equal(k.survivesToEnd, false);
  assert.equal(k.lifetimeAge, 60);
});

test('deriveKpis: finalAssets は最終年齢スナップショットの資産', () => {
  const s = projectAssets(base, 0.05);
  const k = deriveKpis(s, base);
  assert.equal(k.finalAssets, s[s.length - 1].assets);
  assert.equal(k.currentAssets, s[0].assets);
});

test('deriveKpis: 資産が一度も正でないなら survivesToEnd=false, lifetimeAge=null', () => {
  // 現在の資産0・投資0・毎月投資0・収入=支出 → 全年齢で資産0
  const inputs = { ...base, currentAge: 40, retireAge: 41, totalAsset: 0, investedAsset: 0, monthlyInvest: 0, annualIncome: 3000000, annualExpense: 3000000, pensionAnnual: 0, retiredExpenseRatio: 0, endAge: 60 };
  const series = projectAssets(inputs, 0.0);
  const k = deriveKpis(series, inputs);
  assert.equal(k.survivesToEnd, false);
  assert.equal(k.lifetimeAge, null);
});

// --- 現役期間の取り崩し（2026-07-04 修正: 全期間で現金優先取り崩し）---
// 収入0で資産を取り崩して暮らすケースで、使ったはずのお金に利回りが
// 付き続ける過大評価（U字型グラフ）を防ぐ。

const fire = {
  ...base,
  currentAge: 39,
  totalAsset: 60000000,
  investedAsset: 55000000,
  monthlyInvest: 0,
  annualIncome: 0,
  annualExpense: 6000000,
};

test('projectAssets: 現役でも現金不足は投資から取り崩す（収入0ケース）', () => {
  const s = projectAssets(fire, 0.05);
  // age39→40: 投資 55,000,000*1.05=57,750,000 / 現金 5,000,000-6,000,000=-1,000,000
  // → 取り崩し: 投資 56,750,000, 現金 0
  assert.equal(s[1].age, 40);
  assert.equal(s[1].cash, 0);
  assert.equal(s[1].invested, 56750000);
  assert.equal(s[1].assets, 56750000);
});

test('projectAssets: 現金は全期間でマイナスにならない', () => {
  const s = projectAssets(fire, 0.05);
  assert.ok(s.every((p) => p.cash >= 0));
});

test('projectAssets: 収入0・支出超過ならU字回復せず資産寿命が出る', () => {
  const s = projectAssets(fire, 0.05);
  const maxAssets = Math.max(...s.map((p) => p.assets));
  assert.equal(maxAssets, s[0].assets); // 初年度が最大＝後から盛り返さない
  const k = deriveKpis(s, fire);
  assert.equal(k.survivesToEnd, false);
  assert.notEqual(k.lifetimeAge, null);
});

test('projectAssets: 投資0なら運用益なしで支出分だけ減る（指示書ケース3）', () => {
  const inputs = { ...fire, investedAsset: 0 };
  const s = projectAssets(inputs, 0.05);
  assert.equal(s[1].assets, 54000000); // 60,000,000 - 6,000,000
  const k = deriveKpis(s, inputs);
  assert.equal(k.lifetimeAge, 48); // 6,000万÷600万=10年目(49歳)で枯渇
});

test('projectAssets: 積立は移動であり二重計上しない（指示書ケース2, r=0）', () => {
  const inputs = { ...fire, annualIncome: 9000000, monthlyInvest: 250000 };
  const s = projectAssets(inputs, 0.0);
  // 増加は黒字300万円のみ: 60,000,000 + (900-600-300)+300 = 63,000,000
  assert.equal(s[1].assets, 63000000);
});
