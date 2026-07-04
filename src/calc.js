// 2バケツ（現金/投資）＋収入モデルで currentAge〜endAge を1年刻みで計算する純粋関数。
// params: { currentAge, totalAsset, investedAsset, monthlyInvest, annualIncome,
//           annualExpense, retireAge, pensionAnnual, pensionStartAge,
//           retirementBonus, retiredExpenseRatio, endAge }
// rate: 年利（小数）
// 返り値: [{ age, cash, invested, assets }]（各整数、assets = max(0, cash+invested)）
export function projectAssets(params, rate) {
  const {
    currentAge, totalAsset, investedAsset, monthlyInvest, annualIncome,
    annualExpense, retireAge, pensionAnnual, pensionStartAge,
    retirementBonus, retiredExpenseRatio, endAge,
  } = params;

  const annualInvest = monthlyInvest * 12;
  const retiredExpense = annualExpense * retiredExpenseRatio;

  let invested = investedAsset;
  let cash = totalAsset - investedAsset;
  const series = [];

  for (let age = currentAge; age <= endAge; age++) {
    const assets = Math.max(0, cash + invested);
    series.push({
      age,
      cash: Math.round(cash),
      invested: Math.round(invested),
      assets: Math.round(assets),
    });

    if (age === endAge) break;

    if (age < retireAge) {
      // 現役: 投資に利回り+積立、現金に収支余剰
      invested = invested * (1 + rate) + annualInvest;
      cash = cash + (annualIncome - annualExpense - annualInvest);
    } else {
      // 退職後: 投資は利回りのみ、現金は年金-老後支出
      invested = invested * (1 + rate);
      const pension = age >= pensionStartAge ? pensionAnnual : 0;
      cash = cash + (pension - retiredExpense);
    }

    // 退職年齢の年に退職金を現金へ一括加算
    if (age + 1 === retireAge) cash += retirementBonus;

    // 現金不足は投資から現金優先で取り崩す（現役・退職後とも。
    // 使った分に利回りが付き続ける過大評価を防ぐ — 2026-07-04修正）
    if (cash < 0) {
      invested += cash; // cash は負
      cash = 0;
      if (invested < 0) invested = 0;
    }
  }

  return series;
}

// series: projectAssets の結果, params: 入力
export function deriveKpis(series, params) {
  const currentAssets = series[0].assets;
  const finalAssets = series[series.length - 1].assets;

  let targetAge = null;
  for (const p of series) {
    if (p.assets >= params.targetAmount) {
      targetAge = p.age;
      break;
    }
  }
  const yearsToTarget = targetAge === null ? null : targetAge - params.currentAge;

  const survivesToEnd = finalAssets > 0;
  let lifetimeAge = null;
  if (!survivesToEnd) {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].assets > 0) {
        lifetimeAge = series[i].age;
        break;
      }
    }
  }

  return { currentAssets, finalAssets, targetAge, yearsToTarget, lifetimeAge, survivesToEnd };
}
