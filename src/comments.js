// KPI結果からやさしい前向きなコメントを生成する純粋関数。
// 方針(§1): ユーザーを責めない／褒める・励ます／断定せず改善余地をやさしく伝える。

import { fmtMoney } from './format.js';

// kpis: { currentAssets, finalAssets, targetAge, yearsToTarget, lifetimeAge, survivesToEnd }
// params: { endAge, ... }
// 返り値: [{ type: 'good'|'info'|'warning', text }]
export function buildComments(kpis, params) {
  const comments = [];

  // 目標到達
  if (kpis.targetAge !== null) {
    comments.push({
      type: 'good',
      text: `このペースなら約${kpis.targetAge}歳ごろに目標へ届きそうです。いい流れです。`,
    });
  } else {
    comments.push({
      type: 'info',
      text: '目標到達はまだ先に見えていますが、積立額や利回りを少し変えると届くこともあります。焦らず続けていきましょう。',
    });
  }

  // 資産寿命（主役）
  if (kpis.survivesToEnd) {
    comments.push({
      type: 'good',
      text: `あなたの資産は${params.endAge}歳まで持ちそうです。何歳まで生きても大丈夫圏内ですね♪`,
    });
  } else if (kpis.lifetimeAge !== null) {
    comments.push({
      type: 'info',
      text: `いまのペースだと資産は約${kpis.lifetimeAge}歳まで持つ見込みです。積立額や支出を少し見直すと、この年齢はもっと延ばせます。`,
    });
  } else {
    comments.push({
      type: 'warning',
      text: 'このままだと早い時期に資産が心もとなくなりそうです。ただ、積立や支出の見直しで大きく変わる余地があります。',
    });
  }

  // 終了年齢時点の残高（プラスなら安心材料として添える）
  if (kpis.finalAssets > 0) {
    comments.push({
      type: 'info',
      text: `${params.endAge}歳時点でも約${fmtMoney(kpis.finalAssets)}残る見込みです。今の積み上げが効いています。`,
    });
  }

  return comments;
}
