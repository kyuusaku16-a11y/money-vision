// 月次スナップショット履歴と「おかえり」メッセージ。
// 再訪時に前回（先月以前）とのKPI差分を見せて、毎月開く理由をつくる。
// 保存するのは判定に使うKPIだけ（金額は含めない）。

const KEY = 'money-vision-history';
const KEEP_MONTHS = 24;

export function monthOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function loadHistory(storage = globalThis.localStorage) {
  try {
    const arr = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordSnapshot(kpis, storage = globalThis.localStorage, ym = monthOf()) {
  const hist = loadHistory(storage).filter((s) => s.ym !== ym);
  hist.push({
    ym,
    lifetimeAge: kpis.lifetimeAge,
    survivesToEnd: kpis.survivesToEnd,
    targetAge: kpis.targetAge,
  });
  hist.sort((a, b) => (a.ym < b.ym ? -1 : 1));
  const trimmed = hist.slice(-KEEP_MONTHS);
  try {
    storage?.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
  return trimmed;
}

// 今月分を除いた、いちばん新しい記録
export function previousSnapshot(history, ym = monthOf()) {
  const prior = history.filter((s) => s.ym < ym);
  return prior.length ? prior[prior.length - 1] : null;
}

// 前回との比較メッセージ（§1: 責めない。悪化しても事実+見直しの誘いだけ）
export function buildWelcomeBack(prev, kpis) {
  if (!prev) return null;
  if (!prev.survivesToEnd && kpis.survivesToEnd) {
    return { type: 'improved', text: 'おかえり！前回より計画が良くなって、資産が最後まで持つようになったよ🌱' };
  }
  if (prev.survivesToEnd && !kpis.survivesToEnd) {
    return { type: 'gentle', text: 'おかえり！前回と少し変わったみたい。グラフで確認してみよう' };
  }
  if (!prev.survivesToEnd && !kpis.survivesToEnd) {
    const diff = (kpis.lifetimeAge ?? 0) - (prev.lifetimeAge ?? 0);
    if (diff > 0) return { type: 'improved', text: `おかえり！前回より資産寿命が${diff}歳のびてるよ🌱` };
    if (diff < 0) return { type: 'gentle', text: 'おかえり！前回と少し変わったみたい。数字を見直してみよう' };
  }
  return { type: 'improved', text: 'おかえり！前回のいい調子をキープできてるよ♪' };
}
