// 「あなたの次の一歩」: 入力値に応じた試しボタンの候補を作る純粋関数。
// 方針(§1): 助言ではなく「別の未来を見る操作」。改善しない提案は出さない。
// patch は params にスプレッドする絶対値（フォームや保存 state は書き換えない）。

import { projectAssets, deriveKpis } from './calc.js';
import { lifeOf } from './advice.js';

// 持たないプラン向けの改善レバー3種。ガード条件は advice.js の効き目くらべと同じ基準
function improvementSteps(params, kpis) {
  const surplus = params.annualIncome - params.annualExpense;
  const rate = params.expectedReturn / 100;
  const candidates = [];
  if (rate > 0 && (params.monthlyInvest + 10000) * 12 <= Math.max(0, surplus)) {
    candidates.push({
      id: 'invest', label: '積立を月1万円増やしたら？', short: '積立+1万円',
      patch: { monthlyInvest: params.monthlyInvest + 10000 },
    });
  }
  if (params.annualExpense - 120000 >= 600000) {
    candidates.push({
      id: 'cut', label: '生活費を月1万円見直したら？', short: '支出-1万円',
      patch: { annualExpense: params.annualExpense - 120000 },
    });
  }
  if (params.retireAge >= params.currentAge && params.retireAge + 1 <= params.endAge) {
    candidates.push({
      id: 'retire', label: '退職を1年延ばしたら？', short: '退職+1年',
      patch: { retireAge: params.retireAge + 1 },
    });
  }
  const baseLife = lifeOf(kpis, params.endAge);
  return candidates
    .map((c) => {
      const v = { ...params, ...c.patch };
      const gain = lifeOf(deriveKpis(projectAssets(v, rate), v), params.endAge) - baseLife;
      return { ...c, gain };
    })
    .filter((c) => c.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
}

// 持つプラン向けの軽い比較（余裕の使いみちを見る。煽らない）
function comfortSteps(params) {
  const out = [];
  if (params.retireAge - 1 > params.currentAge) {
    out.push({
      id: 'retire-early', label: '退職を1年早めたら？', short: '退職-1年',
      patch: { retireAge: params.retireAge - 1 },
    });
  }
  if (params.monthlyInvest >= 10000) {
    out.push({
      id: 'invest-less', label: '積立を月1万円へらしても大丈夫？', short: '積立-1万円',
      patch: { monthlyInvest: params.monthlyInvest - 10000 },
    });
  }
  return out.slice(0, 3);
}

export function buildNextSteps(params, kpis) {
  return kpis.survivesToEnd ? comfortSteps(params) : improvementSteps(params, kpis);
}
