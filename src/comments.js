// KPI結果から「見出し＋本文」の励ましコメントを生成する純粋関数。
// 方針(§1): 責めない／褒める・励ます／不安を煽らない。
// 同じ状況でも言い回しが変わる文例プール方式。seed はセッション中固定にして
// スライダー操作のたびに文面がチラつかないようにする（次に開いたとき変わる）。

import { fmtMoney } from './format.js';

// 締めのひとこと（毎回1つ、最後に付く）
export const CHEERS = [
  '今日の一歩が、10年後の安心につながります。',
  '小さな積み重ねが、将来の選択肢を広げます。',
  '未来は、少しずつ調整しながら変えていけます。',
  'グラフを動かして、将来の形を確認できます。',
  '続けやすい形を見つけることが大切です。',
  'コツコツ続けることが、いちばんの近道です。',
];

// 未達のとき提案する見直しアクション（タップで入力欄へ移動）
const REVIEW_ACTIONS = [
  { label: '積立額を増やす', targetId: 'monthlyInvest' },
  { label: '利回りを見直す', targetId: 'expectedReturn' },
  { label: '支出を見直す', targetId: 'annualExpense' },
];

const pick = (pool, seed) => pool[Math.min(pool.length - 1, Math.floor(seed * pool.length))];
const derive = (seed, salt) => (seed * salt) % 1;

const SESSION_SEED = Math.random();

// kpis: deriveKpis の結果 / params: { endAge, targetAmount, ... } / seed: 0〜1（テスト用に注入可）
// 返り値: [{ type: 'good'|'info'|'warning'|'cheer', title?, text, actions? }]
export function buildComments(kpis, params, seed = SESSION_SEED) {
  const comments = [];

  // 目標到達
  if (kpis.targetAge !== null) {
    comments.push(pick([
      {
        type: 'good',
        title: '目標到達が見えています',
        text: `このペースなら、約${kpis.targetAge}歳ごろに目標へ届く見込みです。順調な流れです。`,
      },
      {
        type: 'good',
        title: '順調なペースです',
        text: `約${kpis.targetAge}歳ごろに目標へ到達する計算です。これまでの積み重ねが効いています。`,
      },
      {
        type: 'good',
        title: '良い流れです',
        text: `目標には約${kpis.targetAge}歳ごろ到達する見込みです。今の方向性は十分に評価できます。`,
      },
    ], seed));
  } else {
    comments.push(pick([
      {
        type: 'info',
        title: '目標到達はこれからです',
        text: `目標の${fmtMoney(params.targetAmount)}にはまだ届いていませんが、積立額や利回りを少し見直すだけで近づける可能性があります。`,
        actions: REVIEW_ACTIONS,
      },
      {
        type: 'info',
        title: '見直し余地があります',
        text: '目標まではこれからです。小さな見直しを重ねることで、将来の資産推移は変わります。',
        actions: REVIEW_ACTIONS,
      },
    ], seed));
  }

  // 資産寿命（主役）
  if (kpis.survivesToEnd) {
    comments.push(pick([
      {
        type: 'good',
        title: '長く持つ見込みです',
        text: `資産は${params.endAge}歳まで持つ計算です。老後資金の持久力はしっかり出ています。`,
      },
      {
        type: 'good',
        title: '老後も安心ペース',
        text: `${params.endAge}歳までしっかり持つ計算です。今のペースで良い部分が多くあります。`,
      },
    ], seed));
  } else if (kpis.lifetimeAge !== null) {
    comments.push(pick([
      {
        type: 'info',
        title: '見直しの余地があります',
        text: `いまのペースだと、資産は約${kpis.lifetimeAge}歳まで持つ計算です。積立や支出の調整で、ここは延ばせる可能性があります。`,
      },
      {
        type: 'info',
        title: '資産寿命を延ばせます',
        text: `約${kpis.lifetimeAge}歳まで持つ計算です。無理のない範囲で、できるところから調整すると改善しやすいです。`,
      },
    ], seed));
  } else {
    comments.push({
      type: 'warning',
      title: '収支の見直しが必要です',
      text: 'このままだと、資産の持続性に不安が残ります。積立や支出の見直しで大きく変えられるため、まずは調整しやすい項目から確認しましょう。',
    });
  }

  // 終了年齢時点の残高（プラスなら安心材料として添える）
  if (kpis.finalAssets > 0) {
    comments.push(pick([
      {
        type: 'info',
        title: `${params.endAge}歳時点の見込み`,
        text: `${params.endAge}歳時点でも約${fmtMoney(kpis.finalAssets)}残る見込みです。現在の積み上げが将来に効いています。`,
      },
      {
        type: 'info',
        title: '残高は確保できています',
        text: `${params.endAge}歳時点の見込みは約${fmtMoney(kpis.finalAssets)}です。無理なく続けることが、将来の安心につながります。`,
      },
    ], seed));
  }

  // 締めの標語（本文プールとは独立に回す）
  comments.push({ type: 'cheer', text: pick(CHEERS, derive(seed, 7.13)) });

  return comments;
}
