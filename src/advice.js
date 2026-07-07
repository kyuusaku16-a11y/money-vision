// グラフ結果へのひとこと解説と「💡次の一手」を作る純粋関数。
// 方針(§1): 責めない。提案は別シナリオを実計算し「〜する計算です」という
// シミュレーション上の事実として伝える（投資助言にしない）。改善しない提案は出さない。

import { projectAssets, deriveKpis, educationCostAt } from './calc.js';
import { fmtMoney } from './format.js';

// 資産寿命を比較可能な数値に（終了年齢まで持つ=endAge+1 扱い）
const lifeOf = (k, endAge) => (k.survivesToEnd ? endAge + 1 : (k.lifetimeAge ?? 0));

const pick = (pool, seed) => pool[Math.min(pool.length - 1, Math.floor(seed * pool.length))];
const SESSION_SEED = Math.random();

export function findEducationPeak(params) {
  if ((params.children ?? []).length === 0) return null;

  let peakAge = null;
  let peak = 0;
  for (let age = params.currentAge + 1; age <= params.endAge; age++) {
    let delta = 0;
    for (const c of params.children) {
      delta += educationCostAt(c.age + (age - params.currentAge)) - educationCostAt(c.age);
    }
    if (delta > peak) {
      peak = delta;
      peakAge = age;
    }
  }

  return peakAge === null ? null : { age: peakAge, amount: peak };
}

// グラフ下の先頭に出す、3〜4行のまとまった診断コメント。
// 「評価 → 理由 → 山場 → 次の一手」の順で、読めば結果の意味がわかる形にする。
export function buildNarrativeReport(params, series, kpis, adviceItems = [], seed = SESSION_SEED) {
  const lines = [];
  const surplus = params.annualIncome - params.annualExpense;
  const savingsRate = params.annualIncome > 0 ? surplus / params.annualIncome : null;
  const atRetire = series.find((p) => p.age === params.retireAge);
  const firstTip = adviceItems.find((a) => a.type === 'tip');
  const peak = findEducationPeak(params);
  const upcomingEvent = (params.events ?? [])
    .filter((e) => e.age > params.currentAge && e.age <= params.endAge)
    .sort((a, b) => a.age - b.age)[0];

  if (kpis.targetAge !== null && kpis.survivesToEnd) {
    lines.push(pick([
      `全体として、目標到達と${params.endAge}歳までの資産寿命が両方見えている、かなり安定したプランです。`,
      `このグラフは「育てる時期」と「使う時期」のバランスがよく、将来の安心を作りやすい形です。`,
      `いまの条件では、目標と老後資金の両方に手が届く見込みがあり、土台はしっかりしています。`,
    ], seed));
  } else if (kpis.survivesToEnd) {
    lines.push(pick([
      `目標金額にはまだ届いていませんが、資産寿命は${params.endAge}歳まで持つ計算です。`,
      `このプランは大きく増やすよりも、老後まで資産を守る力が出ているタイプです。`,
      `目標到達はこれからですが、生活を支える資産の持久力はしっかり残っています。`,
    ], seed));
  } else if (kpis.lifetimeAge !== null) {
    lines.push(pick([
      `このプランは約${kpis.lifetimeAge}歳ごろまで資産が持つ計算で、まだ伸ばせる余地があります。`,
      `今のままだと後半で資産が細くなるため、少しだけ条件を整えると安心感が増します。`,
      `グラフの後半で取り崩しが強く出ています。ここは支出や退職時期の調整が効きやすい部分です。`,
    ], seed));
  } else {
    lines.push('このプランは早い段階で資産が小さくなりやすい計算です。まずは毎年の収支を整えるところから見ると改善しやすいです。');
  }

  if (savingsRate !== null && savingsRate >= 0.3) {
    lines.push(`手取りの約${Math.round(savingsRate * 100)}%を将来に残せていて、家計の余力はかなり強めです。`);
  } else if (savingsRate !== null && savingsRate >= 0.1) {
    lines.push(`手取りの約${Math.round(savingsRate * 100)}%を将来に回せていて、無理なく続けやすいバランスです。`);
  } else if (params.annualIncome === 0) {
    lines.push('収入0円の取り崩し前提で計算しているため、資産寿命は支出額と運用利回りの影響を強く受けます。');
  } else if (surplus > 0) {
    lines.push('黒字は出ていますが、将来に残る割合は控えめです。小さな固定費の見直しでもグラフが変わりやすい状態です。');
  } else {
    lines.push('年間収支が赤字寄りなので、投資額より先に生活費と収入のバランスを見ると結果が安定しやすいです。');
  }

  if (atRetire && params.retireAge > params.currentAge) {
    const finalRatio = atRetire.assets > 0 ? kpis.finalAssets / atRetire.assets : 0;
    if (finalRatio >= 0.8) {
      lines.push(`${params.retireAge}歳時点では約${fmtMoney(atRetire.assets)}まで育ち、その後も資産を大きく崩さずに進む見込みです。`);
    } else if (kpis.finalAssets > 0) {
      lines.push(`${params.retireAge}歳時点では約${fmtMoney(atRetire.assets)}ありますが、退職後は取り崩しが進むため、老後支出の前提が大事です。`);
    } else {
      lines.push(`${params.retireAge}歳時点の見込みは約${fmtMoney(atRetire.assets)}です。退職後の支出が続くと後半で資産が薄くなります。`);
    }
  }

  if (peak) {
    lines.push(`教育費は${peak.age}歳ごろが山場で、今より年約+${fmtMoney(peak.amount)}の負担を見込んでいます。ここを越えると家計は軽くなります。`);
  } else if (upcomingEvent) {
    lines.push(`${upcomingEvent.age}歳の「${upcomingEvent.label || 'イベント'}」で約${fmtMoney(upcomingEvent.amount)}の支出を入れています。大きな支出の年だけ資金繰りを確認しておくと安心です。`);
  } else if (firstTip) {
    lines.push(firstTip.text);
  } else {
    lines.push('大きな支出予定がない場合でも、年に1回だけ入力を更新すると、現実とのズレを小さくできます。');
  }

  return { type: 'diagnosis', title: '今回の診断', lines };
}

// params: paramsOf(state) 相当 / series: メイン系列 / kpis: deriveKpis の結果
// 返り値: [{ type: 'good'|'info'|'tip', text }]（tipは最大2件）
export function buildAdvice(params, series, kpis) {
  const insights = [];
  const tips = [];
  const rate = params.expectedReturn / 100;
  const surplus = params.annualIncome - params.annualExpense;

  // 貯蓄率（<10%は何も言わない＝責めない）
  if (params.annualIncome > 0 && surplus > 0) {
    const pct = Math.round((surplus / params.annualIncome) * 100);
    if (pct >= 30) {
      insights.push({ type: 'good', text: `手取りの${pct}%を将来に残せています。かなり良いペースです。` });
    } else if (pct >= 10) {
      insights.push({ type: 'info', text: `手取りの${pct}%を将来に回せています。無理なく続けやすいバランスです。` });
    }
  }

  // 退職時点の見込み
  const atRetire = series.find((p) => p.age === params.retireAge);
  if (atRetire && params.retireAge > params.currentAge) {
    insights.push({
      type: 'info',
      text: `退職する${params.retireAge}歳時点では、約${fmtMoney(atRetire.assets)}（うち投資 約${fmtMoney(atRetire.invested)}）になる見込みです。`,
    });
  }

  // 教育費のピーク予告
  const peak = findEducationPeak(params);
  if (peak) {
    insights.push({
      type: 'info',
      text: `${peak.age}歳ごろが教育費のピーク（年 約+${fmtMoney(peak.amount)}）です。ここを越えると家計は軽くなります。`,
    });
  }

  // 💡次の一手: 逆算・比較・下振れ検査による分析（最大3件・改善しない提案は出さない）

  // ① 逆算: 目標に届くために必要な毎月の上乗せ額
  if (kpis.targetAge === null && rate > 0 && surplus > 0) {
    const extra = solveExtraMonthlyInvest(params, rate);
    if (extra !== null) {
      const total = params.monthlyInvest + extra;
      tips.push({
        type: 'tip',
        title: '改善のヒント',
        text: `目標の${fmtMoney(params.targetAmount)}には、毎月あと約${fmtMoney(extra)}の積み立て（合計 約${fmtMoney(total)}/月）で届く計算です。`,
      });
    } else {
      tips.push({
        type: 'tip',
        title: '改善のヒント',
        text: '積み立ての上乗せだけでは目標に届きにくいプランです。支出の見直しや目標額・時期の調整を組み合わせるのが近道です。',
      });
    }
  }

  // ② 逆算: 終了年齢まで資産が持つ「生き残りライン」
  if (!kpis.survivesToEnd) {
    const cut = solveMonthlyExpenseCut(params, rate);
    if (cut !== null) {
      tips.push({
        type: 'tip',
        title: '改善のヒント',
        text: `毎月の支出を約${fmtMoney(cut)}しぼると、${params.endAge}歳まで資産が持つ計算です。`,
      });
    }
  }

  // ③ 効き目くらべ: 同じ月1万円なら、どのレバーが効くプランか
  if (!kpis.survivesToEnd) {
    const gain = (patch) => {
      const v = { ...params, ...patch };
      return lifeOf(deriveKpis(projectAssets(v, rate), v), params.endAge) - lifeOf(kpis, params.endAge);
    };
    const canInvest = rate > 0 && (params.monthlyInvest + 10000) * 12 <= Math.max(0, surplus);
    const canCut = params.annualExpense >= 1200000;
    if (canInvest && canCut) {
      const byInvest = gain({ monthlyInvest: params.monthlyInvest + 10000 });
      const byCut = gain({ annualExpense: params.annualExpense - 120000 });
      if (byInvest > 0 && byCut > 0 && Math.abs(byInvest - byCut) >= 2) {
        const [winner, w, l] = byCut > byInvest
          ? ['支出の見直し', byCut, byInvest]
          : ['積み立ての上乗せ', byInvest, byCut];
        tips.push({
          type: 'tip',
          title: '改善のヒント',
          text: `同じ月1万円でも、このプランでは「${winner}」のほうが効きます（資産寿命 +${w}歳 vs +${l}歳）。老後の支出も一緒に下がるためです。`,
        });
      }
    }
  }

  // ④ 下振れチェック: 利回りが2%低かったら
  if (params.expectedReturn >= 3) {
    const downRate = params.expectedReturn - 2;
    const v = { ...params, expectedReturn: downRate };
    const sKpis = deriveKpis(projectAssets(v, downRate / 100), v);
    if (kpis.survivesToEnd && sKpis.survivesToEnd) {
      tips.push({
        type: 'tip',
        title: '安心材料',
        text: `利回りが${downRate}%に下がっても、資産は${params.endAge}歳まで持つ計算です。下振れにも粘り強いプランです。`,
      });
    } else if (kpis.survivesToEnd && !sKpis.survivesToEnd && sKpis.lifetimeAge !== null) {
      tips.push({
        type: 'tip',
        title: '改善のヒント',
        text: `利回りが${downRate}%だと、資産寿命は約${sKpis.lifetimeAge}歳までになります。利回り頼みをへらすなら、積み立てや支出の調整が効きます。`,
      });
    }
  }

  return [...insights, ...tips.slice(0, 3)];
}

// 目標到達に必要な毎月の上乗せ額を二分探索で逆算する（1,000円刻み・余剰の範囲内）。
// 届き得ない場合は null。
export function solveExtraMonthlyInvest(params, rate) {
  const surplus = params.annualIncome - params.annualExpense;
  const maxExtra = Math.floor(Math.max(0, surplus / 12 - params.monthlyInvest) / 1000) * 1000;
  if (maxExtra < 1000) return null;
  const reaches = (extra) => {
    const v = { ...params, monthlyInvest: params.monthlyInvest + extra };
    return deriveKpis(projectAssets(v, rate), v).targetAge !== null;
  };
  if (!reaches(maxExtra)) return null;
  let lo = 0; // 届かない側（現状）
  let hi = maxExtra; // 届く側
  while (hi - lo > 1000) {
    let mid = lo + Math.floor((hi - lo) / 2 / 1000) * 1000;
    if (mid === lo) mid = lo + 1000;
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// 終了年齢まで資産が持つために必要な、毎月の支出削減額を二分探索で逆算する
// （1,000円刻み・上限は月5万円。それでも持たない/支出が小さすぎる場合は null）。
export function solveMonthlyExpenseCut(params, rate) {
  const MAX_CUT = 50000;
  if (params.annualExpense - MAX_CUT * 12 < 600000) return null;
  const survives = (cutMonthly) => {
    const v = { ...params, annualExpense: params.annualExpense - cutMonthly * 12 };
    return deriveKpis(projectAssets(v, rate), v).survivesToEnd;
  };
  if (!survives(MAX_CUT)) return null;
  let lo = 0; // 持たない側（現状）
  let hi = MAX_CUT; // 持つ側
  while (hi - lo > 1000) {
    let mid = lo + Math.floor((hi - lo) / 2 / 1000) * 1000;
    if (mid === lo) mid = lo + 1000;
    if (survives(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
