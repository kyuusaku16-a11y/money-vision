// ライフプラン表（A4・1枚）の年表データを組み立てる純粋関数。
// グラフを「紙の上で読める年表」に翻訳する: 5年刻みのグリッド＋節目の年（退職・年金・
// 教育費ピーク・ライフイベント・目標達成・資産が尽きる年）。§1: 尽きる年も正直に、でも責めない。

import { findEducationPeak } from './advice.js';
import { fmtMoney } from './format.js';

const MAX_ROWS = 24; // A4縦に無理なく収まる行数

export function buildLifeplanRows(params, series, kpis, { baseYear = null } = {}) {
  const notesByAge = new Map();
  const note = (age, text) => {
    if (age == null || age < params.currentAge || age > params.endAge) return;
    if (!notesByAge.has(age)) notesByAge.set(age, []);
    notesByAge.get(age).push(text);
  };

  // 節目を集める（時系列に並んだとき読みやすい言い方で）
  if (params.retireAge > params.currentAge) note(params.retireAge, '退職の予定（収入が変わる）');
  if (params.pensionStartAge > params.currentAge) note(params.pensionStartAge, '年金の受け取り開始');
  for (const e of params.events ?? []) {
    note(e.age, `${e.label || 'ライフイベント'}（約${fmtMoney(e.amount)}）`);
  }
  const eduPeak = findEducationPeak(params);
  if (eduPeak) note(eduPeak.age, `教育費のピーク（今より年約+${fmtMoney(eduPeak.amount)}）`);
  if (kpis.targetAge !== null && kpis.targetAge > params.currentAge) {
    note(kpis.targetAge, `🎉 目標の${fmtMoney(params.targetAmount)}に到達する見込み`);
  }
  if (!kpis.survivesToEnd && kpis.lifetimeAge !== null) {
    note(kpis.lifetimeAge, 'ここで資産が尽きる計算（前提を変えると動きます）');
  }

  // 行にする年齢: 現在・終了・5年刻み・節目。多すぎる場合はグリッドを10年刻みに間引く
  const buildAges = (step) => {
    const ages = new Set([params.currentAge, params.endAge, ...notesByAge.keys()]);
    for (let age = Math.ceil(params.currentAge / step) * step; age < params.endAge; age += step) {
      if (age > params.currentAge) ages.add(age);
    }
    return [...ages].sort((a, b) => a - b);
  };
  let ages = buildAges(5);
  if (ages.length > MAX_ROWS) ages = buildAges(10);

  const assetsByAge = new Map(series.map((p) => [p.age, p.assets]));
  return ages.map((age) => ({
    age,
    year: baseYear === null ? null : baseYear + (age - params.currentAge),
    assets: assetsByAge.get(age) ?? null,
    notes: notesByAge.get(age) ?? [],
  }));
}
