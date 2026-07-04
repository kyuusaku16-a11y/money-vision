// 金額表示と 万円⇄円 変換の共通ユーティリティ（純粋関数）。
// 状態は常に円で持ち、UIだけが万円を扱う（変換はここに集約）。

export function fmtMoney(yen) {
  if (yen >= 100000000) return `${(yen / 100000000).toFixed(2)}億円`;
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}

// UI入力（万円）→ 保存値（円）。7.5万円のような小数入力も整数円に丸める。
export function manToYen(man) {
  return Math.round(Number(man) * 10000);
}

// 保存値（円）→ UI表示（万円）。スライダー最小刻み5,000円=0.5万円を保てる小数1桁。
export function yenToMan(yen) {
  return Math.round((yen / 10000) * 10) / 10;
}
