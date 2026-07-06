import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvice, buildNarrativeReport } from '../src/advice.js';
import { projectAssets, deriveKpis } from '../src/calc.js';

const base = {
  currentAge: 35, totalAsset: 5000000, investedAsset: 5000000,
  monthlyInvest: 50000, annualIncome: 5000000, annualExpense: 3000000,
  expectedReturn: 5, targetAmount: 100000000,
  retireAge: 65, pensionAnnual: 1800000, pensionStartAge: 65,
  retirementBonus: 0, retiredExpenseRatio: 0.7, endAge: 100,
  events: [], children: [],
};

const run = (params) => {
  const series = projectAssets(params, params.expectedReturn / 100);
  const kpis = deriveKpis(series, params);
  const advice = buildAdvice(params, series, kpis);
  const report = buildNarrativeReport(params, series, kpis, advice, 0);
  return { series, kpis, advice, report };
};

test('buildAdvice: 貯蓄率40%を good でほめる', () => {
  const { advice } = run(base);
  const r = advice.find((a) => a.text.includes('40%'));
  assert.ok(r && r.type === 'good');
});

test('buildAdvice: 退職時点の見込み額を伝える', () => {
  const { series, advice } = run(base);
  const at65 = series.find((p) => p.age === 65);
  const r = advice.find((a) => a.text.includes('65歳時点'));
  assert.ok(r && r.type === 'info');
  assert.ok(r.text.includes('約') && at65.assets > 0);
});

test('buildAdvice: 教育費ピークの年齢と金額を予告する', () => {
  const { advice } = run({ ...base, children: [{ age: 5 }] });
  const r = advice.find((a) => a.text.includes('教育費のピーク'));
  // 子5歳→18歳(大学入学, +150万)は親48歳
  assert.ok(r && r.text.includes('48歳') && r.text.includes('150万円'));
});

test('buildAdvice: 投資+1万円の what-if は実計算した年数で提案する', () => {
  const { kpis, advice } = run(base);
  const variant = { ...base, monthlyInvest: base.monthlyInvest + 10000 };
  const vKpis = deriveKpis(projectAssets(variant, 0.05), variant);
  const expectYears = kpis.targetAge - vKpis.targetAge;
  const r = advice.find((a) => a.text.includes('投資をあと1万円'));
  if (expectYears > 0) {
    assert.ok(r && r.type === 'tip' && r.text.includes(`約${expectYears}年早まる`));
  } else {
    assert.equal(r, undefined); // 改善しないなら提案しない
  }
});

test('buildAdvice: tip は最大2件・改善しない提案は出ない', () => {
  const { advice } = run(base);
  assert.ok(advice.filter((a) => a.type === 'tip').length <= 2);
  // base は survivesToEnd=true なので退職+2年 tip は出ない
  assert.ok(!advice.some((a) => a.text.includes('退職を2年')));
});

test('buildAdvice: 収入0なら貯蓄率・投資tipを出さない／悪化する退職提案も出ない', () => {
  const fire = { ...base, annualIncome: 0, annualExpense: 6000000, totalAsset: 60000000, investedAsset: 55000000, monthlyInvest: 0, currentAge: 39 };
  const { advice } = run(fire);
  assert.ok(!advice.some((a) => a.text.includes('%を将来')));
  assert.ok(!advice.some((a) => a.text.includes('投資をあと1万円')));
  // 収入0では退職を遅らせても改善しない（現役支出600万>老後支出420万）ので出ない
  assert.ok(!advice.some((a) => a.text.includes('退職を2年')));
});

test('buildAdvice: 資産寿命が持たない人には延びる提案が数字つきで出る', () => {
  // 支出を高くして未達&枯渇にする（支出−1万tipか退職+2年tipのどちらかが資産寿命の延びを言う）
  const tight = { ...base, annualExpense: 4800000, monthlyInvest: 0, expectedReturn: 3 };
  const { kpis, advice } = run(tight);
  assert.equal(kpis.survivesToEnd, false);
  const tipTexts = advice.filter((a) => a.type === 'tip').map((a) => a.text);
  assert.ok(tipTexts.length >= 1);
  assert.ok(tipTexts.some((t) => t.includes('資産寿命') || t.includes('目標')));
});

test('buildNarrativeReport: 3行以上の診断コメントを返す', () => {
  const { report } = run(base);
  assert.equal(report.type, 'diagnosis');
  assert.equal(report.title, '今回の診断');
  assert.ok(report.lines.length >= 3);
  assert.ok(report.lines.every((line) => line.length >= 20));
});

test('buildNarrativeReport: 家計評価・退職時点・次の一手を含める', () => {
  const { report } = run(base);
  const text = report.lines.join('\n');
  assert.ok(text.includes('40%'));
  assert.ok(text.includes('65歳時点'));
  assert.ok(text.includes('投資をあと1万円') || text.includes('年に1回'));
});

test('buildNarrativeReport: 教育費ピークがある場合は診断内で山場を伝える', () => {
  const { report } = run({ ...base, children: [{ age: 5 }] });
  const text = report.lines.join('\n');
  assert.ok(text.includes('教育費') && text.includes('48歳') && text.includes('150万円'));
});

test('buildNarrativeReport: 資産寿命が持たない場合は見直し余地を伝える', () => {
  const tight = { ...base, annualExpense: 4800000, monthlyInvest: 0, expectedReturn: 3 };
  const { kpis, report } = run(tight);
  assert.equal(kpis.survivesToEnd, false);
  assert.ok(report.lines.join('\n').includes(`${kpis.lifetimeAge}歳`));
});
