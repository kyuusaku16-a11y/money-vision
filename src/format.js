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

// 入力欄の文字列を Number() に渡せる形へ正規化する。
// 全角数字・全角小数点は打ち間違いでなく環境差（IME）なので受け入れ、
// カンマと空白は「読みやすく書いただけ」とみなして取り除く。
// 数字にならない文字はあえて残す（上流で NaN → 入力途中として無視される）。
export function normalizeNumInput(str) {
  return String(str)
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/[,，]/g, '')
    .replace(/[\s　]/g, '');
}

// 入力欄に書き戻すときの表示。整数部だけカンマ区切りにし、小数は丸めない。
export function formatNumInput(n) {
  const [int, frac] = String(n).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac != null ? `${grouped}.${frac}` : grouped;
}
