import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectAssets, deriveKpis, educationCostAt, monthsToTarget, nearWindowYears } from '../src/calc.js';

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

// --- ライフイベント（§4.2: 年齢+金額の一時支出）---

test('projectAssets: イベント年齢のスナップショットで現金から一時支出が引かれる', () => {
  const inputs = { ...base, events: [{ age: 40, amount: 3000000, label: '車' }] };
  const s = projectAssets(inputs, 0.0);
  // base(r=0): 年間余剰 5,000,000-3,000,000-600,000 = 1,400,000
  // age40 現金 = 1,400,000×5 - 3,000,000 = 4,000,000 / 投資は影響なし 5,000,000+600,000×5
  const p40 = s.find((p) => p.age === 40);
  assert.equal(p40.cash, 4000000);
  assert.equal(p40.invested, 8000000);
});

test('projectAssets: 現金不足のイベントは投資から取り崩される', () => {
  const inputs = { ...base, events: [{ age: 36, amount: 5000000, label: '家' }] };
  const s = projectAssets(inputs, 0.0);
  // age36: 現金 1,400,000-5,000,000 = -3,600,000 → 投資 5,600,000-3,600,000 = 2,000,000
  assert.equal(s[1].cash, 0);
  assert.equal(s[1].invested, 2000000);
});

test('projectAssets: 同年齢の複数イベントは合算される', () => {
  const inputs = { ...base, events: [{ age: 40, amount: 1000000 }, { age: 40, amount: 2000000 }] };
  const s = projectAssets(inputs, 0.0);
  assert.equal(s.find((p) => p.age === 40).cash, 4000000);
});

test('projectAssets: 現在年齢以前・終了年齢超のイベントは無視される', () => {
  const inputs = { ...base, events: [
    { age: 35, amount: 9999999 }, { age: 20, amount: 9999999 }, { age: 101, amount: 9999999 },
  ] };
  assert.deepEqual(projectAssets(inputs, 0.0), projectAssets({ ...base, events: [] }, 0.0));
});

test('projectAssets: events未指定は従来挙動と完全一致（後方互換）', () => {
  assert.deepEqual(projectAssets(base, 0.05), projectAssets({ ...base, events: [] }, 0.05));
});

// --- 子どもの教育費（差分方式）---

test('educationCostAt: テーブル境界値', () => {
  const cases = [
    [0, 100000], [2, 100000], [3, 300000], [5, 300000],
    [6, 400000], [11, 400000], [12, 600000], [14, 600000],
    [15, 700000], [17, 700000], [18, 1800000], [19, 1300000],
    [21, 1300000], [22, 0], [30, 0], [-1, 0],
  ];
  for (const [age, cost] of cases) assert.equal(educationCostAt(age), cost, `age ${age}`);
});

test('projectAssets: 子17歳 — 18歳到達年に差分110万だけ支出が増える', () => {
  const inputs = { ...base, children: [{ age: 17 }] };
  const s = projectAssets(inputs, 0.0);
  // 現在(17歳)費用70万は既に年間支出に含まれる前提
  // 35歳の年: 子17, delta 0 → cash 1,400,000
  assert.equal(s[1].cash, 1400000);
  // 36歳の年: 子18, delta 1,800,000-700,000=1,100,000 → 1,400,000+1,400,000-1,100,000
  assert.equal(s[2].cash, 1700000);
  // 37歳の年: 子19, delta 600,000 → +800,000
  assert.equal(s[3].cash, 2500000);
});

test('projectAssets: 卒業後(22歳以降)は差分が負になり支出が減る', () => {
  const inputs = { ...base, children: [{ age: 17 }] };
  const s = projectAssets(inputs, 0.0);
  // 38歳:子20 delta600k(+800k)→3,300,000 / 39歳:子21 delta600k→4,100,000
  // 40歳:子22 delta -700,000 → +2,100,000 → 6,200,000
  assert.equal(s[6].cash, 6200000);
});

test('projectAssets: 複数の子どもの差分は合算される', () => {
  const inputs = { ...base, children: [{ age: 5 }, { age: 17 }] };
  const s = projectAssets(inputs, 0.0);
  // 36歳の年: 子6(delta 100,000) + 子18(delta 1,100,000) → 1,400,000+1,400,000-1,200,000
  assert.equal(s[2].cash, 1600000);
});

test('projectAssets: 退職後の教育費差分は70%換算されない', () => {
  const inputs = { ...base, currentAge: 64, retireAge: 65, children: [{ age: 17 }] };
  const s = projectAssets(inputs, 0.0);
  // 64歳の年(現役, 子17, delta0): cash 0+1,400,000 / 投資 5,600,000
  // 65歳の年(退職, 子18, delta 1,100,000): cash += (1,800,000-2,100,000)-1,100,000 = -1,400,000 → ちょうど0
  assert.equal(s[2].age, 66);
  assert.equal(s[2].cash, 0);
  assert.equal(s[2].invested, 5600000);
});

test('projectAssets: children未指定・22歳以上のみは従来挙動と一致', () => {
  assert.deepEqual(projectAssets(base, 0.05), projectAssets({ ...base, children: [] }, 0.05));
  assert.deepEqual(projectAssets({ ...base, children: [{ age: 25 }] }, 0.05), projectAssets(base, 0.05));
});

// --- 進路コース（大学費用のみコース別。既定=私立文系・自宅） ---

test('educationCostAt: コースで18歳・19〜21歳の費用が変わる（0〜17歳は共通）', () => {
  assert.equal(educationCostAt(18), 1800000); // 既定=私立文系
  assert.equal(educationCostAt(18, 'national'), 1000000);
  assert.equal(educationCostAt(20, 'national'), 800000);
  assert.equal(educationCostAt(18, 'private-science-away'), 2500000);
  assert.equal(educationCostAt(20, 'private-science-away'), 2200000);
  assert.equal(educationCostAt(10, 'national'), 400000); // 大学前はコース共通
  assert.equal(educationCostAt(22, 'private-science-away'), 0);
});

test('projectAssets: 子どものコースが差分計算に反映される', () => {
  const inputs = { ...base, children: [{ age: 17, course: 'national' }] };
  const s = projectAssets(inputs, 0.0);
  // 36歳の年: 子18(国公立 100万) - 現在17歳(70万) = 差分30万
  // cash: 1,400,000 + 1,400,000 - 300,000 = 2,500,000
  assert.equal(s[2].cash, 2500000);
});

test('projectAssets: コース未指定は従来（私立文系）と完全一致', () => {
  assert.deepEqual(
    projectAssets({ ...base, children: [{ age: 17 }] }, 0.05),
    projectAssets({ ...base, children: [{ age: 17, course: 'private-arts' }] }, 0.05),
  );
});

// --- 住宅ローン（返済額は支出に含まれている前提・完済後に自動で軽くなる・老後70%換算の対象外） ---

test('projectAssets: 完済前は従来と同一、完済後は年間返済額ぶん現金が増える', () => {
  const loan = { ...base, loanMonthly: 100000, loanEndAge: 50 };
  const s = projectAssets(loan, 0.0);
  const plain = projectAssets(base, 0.0);
  // 完済前（〜50歳のスナップショットまで）は完全一致
  for (let i = 0; i <= 15; i++) assert.deepEqual(s[i], plain[i]);
  // 50歳の年から毎年+120万円軽くなる（51歳スナップショット以降）
  assert.equal(s[16].cash, plain[16].cash + 1200000);
  assert.equal(s[17].cash, plain[17].cash + 2400000);
});

test('projectAssets: ローンは老後70%換算の対象外（完済まで満額、完済後は0.7×(支出-ローン)のみ）', () => {
  const inputs = { ...base, currentAge: 64, retireAge: 65, loanMonthly: 100000, loanEndAge: 70 };
  const s = projectAssets(inputs, 0.0);
  // 64歳の年(現役・ローンは支出に込み): cash 0+1,400,000 → s[1](65歳)
  assert.equal(s[1].cash, 1400000);
  // 65〜69歳の年: 支出 = (300万-120万)×0.7 + 120万 = 246万, 年金180万 → 年−66万
  assert.equal(s[2].cash, 740000);   // 66歳
  assert.equal(s[3].cash, 80000);    // 67歳
  // 68歳: 80,000-660,000=-580,000 → 投資5,600,000から取り崩し
  assert.equal(s[4].cash, 0);
  assert.equal(s[4].invested, 5020000);
  // 70歳の年（完済）: 支出 = 126万のみ, 年金180万 → 年+54万
  assert.equal(s[6].invested, 3700000); // 69歳の年まで取り崩し累計
  assert.equal(s[7].cash, 540000);      // 71歳スナップショット
});

test('projectAssets: 返済額が支出を超える入力は支出額までに丸める', () => {
  const inputs = { ...base, currentAge: 64, retireAge: 65, loanMonthly: 300000, loanEndAge: 70 };
  const s = projectAssets(inputs, 0.0);
  // ローン扱い分=支出全額300万 → 65歳の年: (300万-300万)×0.7+300万=300万, 年金180万 → −120万
  assert.equal(s[2].cash, 1400000 - 1200000);
});

test('projectAssets: loanMonthly 0（未入力）は従来挙動と完全一致', () => {
  assert.deepEqual(
    projectAssets({ ...base, loanMonthly: 0, loanEndAge: 65 }, 0.05),
    projectAssets(base, 0.05),
  );
});

test('monthsToTarget: 年次の系列から達成までの月数を補間で出す', () => {
  // 資産 60万→84万→108万 と年24万ペース、目標100万
  const series = [
    { age: 25, assets: 600000 },
    { age: 26, assets: 840000 },
    { age: 27, assets: 1080000 },
  ];
  // 2年目の途中 (100-84)/(108-84)=0.67 → 8ヶ月 → 合計 1年+8ヶ月 = 20ヶ月
  assert.equal(monthsToTarget(series, 1000000), 20);
  // 最初から達成していれば 0
  assert.equal(monthsToTarget(series, 500000), 0);
  // 届かなければ null
  assert.equal(monthsToTarget(series, 99999999), null);
  // ちょうど年境で達成
  assert.equal(monthsToTarget(series, 840000), 12);
});

test('nearWindowYears: 5年で届けば5年、届かなければ到達年+1年（上限10年）', () => {
  // 達成ずみ・5年以内はいままで通り5年表示
  assert.equal(nearWindowYears(0), 5);
  assert.equal(nearWindowYears(48), 5);
  // 5年を超えたら到達年+1年まで広げる
  assert.equal(nearWindowYears(72), 7); // 6年 → 7年表示
  assert.equal(nearWindowYears(96), 9); // 8年 → 9年表示
  // 上限は10年（それより先の到達・未到達も10年で見せる）
  assert.equal(nearWindowYears(108), 10);
  assert.equal(nearWindowYears(180), 10);
  assert.equal(nearWindowYears(null), 10);
});
