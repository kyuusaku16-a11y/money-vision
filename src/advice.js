// グラフ結果へのひとこと解説と「💡次の一手」を作る純粋関数。
// 方針(§1): 責めない。提案は別シナリオを実計算し「〜する計算です」という
// シミュレーション上の事実として伝える（投資助言にしない）。改善しない提案は出さない。

import { projectAssets, deriveKpis, educationCostAt } from './calc.js';
import { fmtMoney } from './format.js';

// 資産寿命を比較可能な数値に（終了年齢まで持つ=endAge+1 扱い）
export const lifeOf = (k, endAge) => (k.survivesToEnd ? endAge + 1 : (k.lifetimeAge ?? 0));

const pick = (pool, seed) => pool[Math.min(pool.length - 1, Math.floor(seed * pool.length))];
const SESSION_SEED = Math.random();

function fmtMonthlyHintMoney(yen) {
  if (yen <= 0) return fmtMoney(yen);
  return fmtMoney(Math.max(10000, yen));
}

export function findEducationPeak(params) {
  if ((params.children ?? []).length === 0) return null;

  let peakAge = null;
  let peak = 0;
  for (let age = params.currentAge + 1; age <= params.endAge; age++) {
    let delta = 0;
    for (const c of params.children) {
      delta += educationCostAt(c.age + (age - params.currentAge), c.course) - educationCostAt(c.age, c.course);
    }
    if (delta > peak) {
      peak = delta;
      peakAge = age;
    }
  }

  return peakAge === null ? null : { age: peakAge, amount: peak };
}

// 「お金の一生の時間割」: 資産のピーク・現役の積み上げ・退職後の取り崩し構造・谷と持ち直し。
// グラフを目で読まないとわからない転換点を、本人の数字で文章化する
function buildTimelineSection(params, series, kpis) {
  const lines = [];
  const surplus = params.annualIncome - params.annualExpense;
  const last = series[series.length - 1];

  // 現役の積み上げ（絶対額。率は総合評価側が言う）
  if (params.currentAge < params.retireAge && surplus > 0) {
    const tsumitate = params.monthlyInvest > 0 ? `（うち積立に${fmtMoney(params.monthlyInvest * 12)}）` : '';
    lines.push(`現役のあいだは、年に約${fmtMoney(surplus)}が手元に積み上がっていく計算です${tsumitate}。`);
  }

  // 目標到達の時期（届く見込みがあるプランだけ）
  if (params.targetAmount > 0 && kpis.targetAge !== null && kpis.yearsToTarget > 0) {
    lines.push(`目標の${fmtMoney(params.targetAmount)}には、${kpis.targetAge}歳ごろ（あと${kpis.yearsToTarget}年）に届く見込みです。`);
  }

  // 資産のピーク
  let peak = series[0];
  for (const p of series) if (p.assets > peak.assets) peak = p;
  if (peak.age >= last.age && kpis.survivesToEnd) {
    lines.push(`このプランでは、資産は${params.endAge}歳まで増え続ける計算です。「使う楽しみ」を足す余地もありそうです。`);
  } else if (peak.age <= params.currentAge) {
    lines.push('資産はいまがいちばん大きく、ここからは蓄えを計画的に使っていく形です。');
  } else if (peak.assets > 0) {
    lines.push(
      `資産のピークは${peak.age}歳ごろで、約${fmtMoney(peak.assets)}。そこまでが「育てる時期」、そこからが「使う時期」です。`
    );
  }

  // 退職・年金の取り崩し構造（グラフの傾きの言語化）
  const loanAnnual = Math.min(Math.max(0, params.loanMonthly ?? 0) * 12, params.annualExpense);
  const drawPre = Math.round((params.annualExpense - loanAnnual) * params.retiredExpenseRatio);
  const drawPost = drawPre - params.pensionAnnual;
  if (drawPre > 0) {
    if (params.currentAge < params.retireAge) {
      if (params.pensionStartAge > params.retireAge) {
        lines.push(
          drawPost > 0
            ? `退職（${params.retireAge}歳）から年金開始（${params.pensionStartAge}歳）までは年約${fmtMoney(drawPre)}ずつ、年金開始後は年約${fmtMoney(drawPost)}ずつ蓄えから取り崩す計算です。`
            : `退職（${params.retireAge}歳）から年金開始（${params.pensionStartAge}歳）までは年約${fmtMoney(drawPre)}ずつの取り崩し。年金が始まれば、日々の支出はその範囲でまかなえる計算です。`
        );
      } else {
        lines.push(
          drawPost > 0
            ? `退職（${params.retireAge}歳）からは、年金でまかなえないぶん年約${fmtMoney(drawPost)}ずつを蓄えから取り崩す計算です。`
            : `退職（${params.retireAge}歳）後は、日々の支出を年金の範囲でまかなえる計算です。蓄えは主に、もしもの備えと楽しみに回せます。`
        );
      }
    } else if (params.pensionStartAge > params.currentAge) {
      lines.push(
        `年金開始（${params.pensionStartAge}歳）までは年約${fmtMoney(drawPre)}ずつ、` +
          (drawPost > 0
            ? `開始後は年約${fmtMoney(drawPost)}ずつの取り崩しになる計算です。`
            : '開始後は年金の範囲で日々の支出をまかなえる計算です。')
      );
    } else if (drawPost > 0) {
      lines.push(`年金でまかなえないぶん、年約${fmtMoney(drawPost)}ずつを蓄えから取り崩す計算です。`);
    }
  }

  // 最後にいくら残るか（持つプランだけ。「持つ」の中身を金額で見せる）
  if (kpis.survivesToEnd && kpis.finalAssets > 0) {
    lines.push(`${params.endAge}歳の時点では、約${fmtMoney(kpis.finalAssets)}が手元に残る計算です。`);
  }

  // 谷: 一度薄くなってから持ち直すプランは、その転換点を予告する（不安の正体を先に見せる）
  if (kpis.survivesToEnd) {
    let valley = null;
    for (const p of series) {
      if (p.age <= params.currentAge) continue;
      if (!valley || p.assets < valley.assets) valley = p;
    }
    // 「いまより一度下がってから持ち直す」形だけを谷と呼ぶ（右肩上がりの1年目を誤検出しない）
    if (
      valley &&
      valley.age < last.age &&
      valley.assets < series[0].assets &&
      last.assets > valley.assets * 1.2 &&
      valley.assets < peak.assets * 0.9
    ) {
      lines.push(
        `いちばん薄くなるのは${valley.age}歳ごろ（約${fmtMoney(valley.assets)}）。そこから先は持ち直していく計算なので、この谷さえ見えていれば慌てずにすみます。`
      );
    }
  }

  return { h: 'お金の一生の時間割', lines };
}

// 「もしもテスト」: 下振れ・長生き・臨時出費の3本を実計算で検査する。
// 土台のプランが持たない場合は出さない（追い打ちをかけない — §1）
function buildStressSection(params, kpis) {
  if (!kpis.survivesToEnd) return null;
  const lines = [];

  // ① 利回りの下振れ（buildAdviceのヒントと同一文言にして、二重表示を自動排除）
  if (params.expectedReturn >= 3) {
    const downRate = params.expectedReturn - 2;
    const v = { ...params, expectedReturn: downRate };
    const s = deriveKpis(projectAssets(v, downRate / 100), v);
    if (s.survivesToEnd) {
      lines.push(`利回りが${downRate}%に下がっても、資産は${params.endAge}歳まで持つ計算です。下振れにも粘り強いプランです。`);
    } else if (s.lifetimeAge !== null) {
      lines.push(`利回りが${downRate}%だと、資産寿命は約${s.lifetimeAge}歳までになります。利回り頼みをへらすなら、積み立てや支出の調整が効きます。`);
    }
  }

  // ② 長生きテスト（+5歳）
  if (params.endAge < 105) {
    const v = { ...params, endAge: Math.min(params.endAge + 5, 105) };
    const s = deriveKpis(projectAssets(v, params.expectedReturn / 100), v);
    lines.push(
      s.survivesToEnd
        ? `${v.endAge}歳まで長生きしても、資産は持つ計算です。このプランでは、長寿はリスクではなくごほうびです。`
        : `${params.endAge}歳までは持ちますが、${v.endAge}歳まで生きた場合は少し足りなくなる計算です。長生きへの備えは、年金の受け取り方や退職時期が効きやすい部分です。`
    );
  }

  // ③ 臨時出費テスト（来年100万円）
  const v = {
    ...params,
    events: [...(params.events ?? []), { age: params.currentAge + 1, amount: 1000000, label: '臨時出費' }],
  };
  const s = deriveKpis(projectAssets(v, params.expectedReturn / 100), v);
  lines.push(
    s.survivesToEnd
      ? `来年、急な出費が100万円あっても、資産寿命は${params.endAge}歳まで揺らがない計算です。`
      : `急な出費が100万円あると、後半が少し細くなる計算です。現金の備えを別の置き場所に分けておくと安心です。`
  );

  return lines.length ? { h: 'もしもテスト', lines } : null;
}

// グラフ下の先頭に出す診断レポート。
// 「総合評価 → 時間割 → 山場 → もしもテスト」の章立てで、読めばグラフの意味がわかる形にする
export function buildNarrativeReport(params, series, kpis, adviceItems = [], seed = SESSION_SEED) {
  const lines = [];
  const sections = [];
  const surplus = params.annualIncome - params.annualExpense;
  const savingsRate = params.annualIncome > 0 ? surplus / params.annualIncome : null;
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

  // 章1: お金の一生の時間割
  const timeline = buildTimelineSection(params, series, kpis);
  if (timeline.lines.length) sections.push(timeline);

  // 章2: 山場と備え（教育費・イベントがあるときだけ。埋め草で章を作らない）
  const yamaba = [];
  if (peak) {
    yamaba.push(`教育費は${peak.age}歳ごろが山場で、今より年約+${fmtMoney(peak.amount)}の負担を見込んでいます。ここを越えると家計は軽くなります。`);
  }
  if (upcomingEvent) {
    yamaba.push(`${upcomingEvent.age}歳の「${upcomingEvent.label || 'イベント'}」で約${fmtMoney(upcomingEvent.amount)}の支出を入れています。大きな支出の年だけ資金繰りを確認しておくと安心です。`);
  }
  if (yamaba.length) sections.push({ h: '山場と備え', lines: yamaba });

  // 章3: もしもテスト（下振れ・長生き・臨時出費。土台が持たないプランには出さない）
  const stress = buildStressSection(params, kpis);
  if (stress) sections.push(stress);

  return { type: 'diagnosis', title: '今回の診断', lines, sections };
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
        text: `目標の${fmtMoney(params.targetAmount)}には、毎月あと約${fmtMonthlyHintMoney(extra)}の積み立て（合計 約${fmtMonthlyHintMoney(total)}/月）で届く計算です。`,
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
        text: `毎月の支出を約${fmtMonthlyHintMoney(cut)}しぼると、${params.endAge}歳まで資産が持つ計算です。`,
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

  // ⑤ フォールバック: 状況が厳しすぎて逆算ソルバーが具体額を出せない場合でも、
  // ユーザーには次に見るべき方向性が必要。改善系のヒントを最低1つ補う。
  const hasImprovementTip = tips.some((t) => t.title === '改善のヒント');
  if (!hasImprovementTip && (kpis.targetAge === null || !kpis.survivesToEnd)) {
    let text;
    if (surplus <= 0) {
      text = '年間支出が収入を上回っているため、投資額より先に毎年の収支を整えると改善しやすい状態です。固定費や大きな支出予定を少しずつ見直すと、資産寿命が伸びやすくなります。';
    } else if (!kpis.survivesToEnd) {
      text = '月5万円までの支出見直しだけでは100歳まで届きにくい計算です。支出の調整に加えて、退職時期・年金開始までの期間・目標額を一緒に見ると改善案を作りやすくなります。';
    } else {
      text = '資産寿命は見えていますが、目標額には届きにくい計算です。毎月の積み立てだけで届かない場合は、目標額や達成時期を少し調整すると現実的なプランに近づきます。';
    }
    tips.push({ type: 'tip', title: '改善のヒント', text });
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
