import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, judgeType, allTypes, buildShareText, buildAxisDetails } from '../src/share.js';

// 月収40万・月支出24万（貯蓄率40%）・現金700万/投資300万（投資比率30%）
// 防衛月数 700/24≒29ヶ月・積立3万/余剰16万（強度19%）
const base = {
  annualIncome: 4800000,
  annualExpense: 2880000,
  totalAsset: 10000000,
  investedAsset: 3000000,
  monthlyInvest: 30000,
};

test('judgeType: 基準ケースは C-?-S-N 系で4文字コードを返す', () => {
  const t = judgeType(base);
  assert.match(t.code, /^[CY][GM][SL][FN]$/);
  assert.equal(t.code[0], 'C'); // 貯蓄率40% >= 20%
  assert.equal(t.code[2], 'S'); // 防衛29ヶ月 >= 6
  assert.equal(t.code[3], 'N'); // 積立強度19% < 50%
  assert.ok(t.name);
  assert.ok(t.hitokoto);
  assert.ok(t.tsuyomi);
  assert.ok(t.nobashi);
});

test('judgeType: 4軸のしきい値境界', () => {
  // 軸1 貯蓄率: ちょうど20%はC
  const c = judgeType({ ...base, annualExpense: 4800000 * 0.8 });
  assert.equal(c.code[0], 'C');
  const y = judgeType({ ...base, annualExpense: 4800000 * 0.81 });
  assert.equal(y.code[0], 'Y');
  // 軸2 投資比率: ちょうど30%はG
  assert.equal(judgeType(base).code[1], 'G');
  assert.equal(judgeType({ ...base, investedAsset: 2900000 }).code[1], 'M');
  // 軸3 防衛月数: 現金がちょうど6ヶ月分でS・下回るとL
  const sixMonths = ((4800000 * 0.6) / 12) * 6; // 月支出24万×6
  assert.equal(judgeType({ ...base, totalAsset: 3000000 + sixMonths }).code[2], 'S');
  assert.equal(judgeType({ ...base, totalAsset: 3000000 + sixMonths - 10000 }).code[2], 'L');
  // 軸4 積立強度: 余剰16万の50%=月8万でF
  assert.equal(judgeType({ ...base, monthlyInvest: 80000 }).code[3], 'F');
  assert.equal(judgeType({ ...base, monthlyInvest: 79000 }).code[3], 'N');
});

test('judgeType: エッジケース — 収入0は Y に倒す', () => {
  const t = judgeType({ ...base, annualIncome: 0 });
  assert.equal(t.code[0], 'Y');
});

test('judgeType: エッジケース — 赤字家計の軸4は積立の有無で決まる', () => {
  const red = { ...base, annualExpense: 6000000 }; // 支出 > 収入
  assert.equal(judgeType(red).code[0], 'Y');
  assert.equal(judgeType({ ...red, monthlyInvest: 10000 }).code[3], 'F'); // 赤字でも先どり=強い意志
  assert.equal(judgeType({ ...red, monthlyInvest: 0 }).code[3], 'N');
});

test('judgeType: エッジケース — 総資産0はM・支出0はS・負値や欠損でも壊れない', () => {
  assert.equal(judgeType({ ...base, totalAsset: 0, investedAsset: 0 }).code[1], 'M');
  assert.equal(judgeType({ ...base, annualExpense: 0 }).code[2], 'S');
  const broken = judgeType({ annualIncome: -100, annualExpense: -5 });
  assert.match(broken.code, /^[CY][GM][SL][FN]$/); // NaNでカードが壊れない
  for (const v of Object.values(broken)) assert.ok(!String(v).includes('NaN'));
});

test('allTypes: 16タイプすべてユニークで4点セットが揃っている', () => {
  const types = allTypes();
  assert.equal(types.length, 16);
  assert.equal(new Set(types.map((t) => t.code)).size, 16);
  assert.equal(new Set(types.map((t) => t.name)).size, 16);
  for (const t of types) {
    assert.match(t.code, /^[CY][GM][SL][FN]$/);
    assert.ok(t.hitokoto.length > 0);
    assert.ok(t.tsuyomi.length > 0);
    assert.ok(t.nobashi.length > 0);
    // 責めない・断定しない（のばしどころは提案の口調）
    assert.ok(!t.nobashi.includes('べき'));
    // 金額の推奨を書かない（万円単位の推奨は不可）
    assert.ok(!/[0-9０-９]+万円/.test(t.nobashi));
  }
});

test('buildShareText: 仕様のテンプレート・金額なし', () => {
  const text = buildShareText(judgeType(base));
  assert.ok(text.includes('私のお金の性格は『'));
  assert.ok(text.includes('#ミラため'));
  assert.ok(text.includes('30秒'));
  assert.ok(!/[0-9０-９]+万円/.test(text));
  assert.ok(!text.includes('億'));
});

test('THRESHOLDS: 1箇所に定数として定義されている（チューニング用）', () => {
  assert.equal(THRESHOLDS.savingsRate, 0.2);
  assert.equal(THRESHOLDS.investRatio, 0.3);
  assert.equal(THRESHOLDS.bufferMonths, 6);
  assert.equal(THRESHOLDS.commitRate, 0.5);
});

// ---- あなたの4軸メーター＋進化の条件 ----

test('buildAxisDetails: 4軸ぶんの実数と境目を返す', () => {
  // 月収25万・月支出21万（貯蓄率16%）・現金50万/投資10万・積立1万/余剰4万
  const p = {
    annualIncome: 3000000,
    annualExpense: 2520000,
    totalAsset: 600000,
    investedAsset: 100000,
    monthlyInvest: 10000,
  };
  const d = buildAxisDetails(p);
  assert.equal(d.length, 4);
  assert.equal(d[0].label, 'ため力');
  assert.ok(d[0].valueText.includes('16%'));
  assert.ok(d[0].thresholdText.includes('20%'));
  assert.equal(d[0].side, 'Y');
  // 投資比率 10/60 ≒ 17%
  assert.ok(d[1].valueText.includes('17%'));
  assert.equal(d[1].side, 'M');
  // 防衛月数 50/21 ≒ 2.4ヶ月
  assert.ok(d[2].valueText.includes('2.4ヶ月'));
  assert.equal(d[2].side, 'L');
  // 積立強度 1/4 = 25%
  assert.ok(d[3].valueText.includes('25%'));
  assert.equal(d[3].side, 'N');
  // ゲージは0〜1（境目がまんなか=0.5）
  for (const a of d) {
    assert.ok(a.ratio >= 0 && a.ratio <= 1);
  }
});

test('buildAxisDetails: しきい値を満たした軸はしきい値側のラベルになる', () => {
  const p = {
    annualIncome: 4800000,
    annualExpense: 2880000, // 貯蓄率40% → C
    totalAsset: 10000000,
    investedAsset: 3000000, // 30% → G
    monthlyInvest: 160000, // 余剰16万を全部 → F
  };
  const d = buildAxisDetails(p);
  assert.deepEqual(d.map((a) => a.side), ['C', 'G', 'S', 'F']);
});

test('buildAxisDetails: 未入力の軸は責めずに案内する', () => {
  const d = buildAxisDetails({});
  assert.ok(d[0].missing.includes('収入'));
  assert.ok(d[1].missing.includes('資産'));
  assert.ok(d[2].missing.includes('支出'));
});
