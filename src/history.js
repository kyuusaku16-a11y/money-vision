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

function saveHistory(hist, storage) {
  hist.sort((a, b) => (a.ym < b.ym ? -1 : 1));
  const trimmed = hist.slice(-KEEP_MONTHS);
  try {
    storage?.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
  return trimmed;
}

export function recordSnapshot(kpis, storage = globalThis.localStorage, ym = monthOf()) {
  const hist = loadHistory(storage);
  const existing = hist.find((s) => s.ym === ym) ?? {};
  const rest = hist.filter((s) => s.ym !== ym);
  // 同月上書きでも「今月の記録」（recordedAsset 等）は消さない
  rest.push({
    ...existing,
    ym,
    lifetimeAge: kpis.lifetimeAge,
    survivesToEnd: kpis.survivesToEnd,
    targetAge: kpis.targetAge,
  });
  return saveHistory(rest, storage);
}

// 「今月の資産を記録する」ボタン（実績記録）。projected1y は記録時点の計画上の1年後資産
export function markRecorded(storage = globalThis.localStorage, { totalAsset, projected1y }, ym = monthOf()) {
  const hist = loadHistory(storage);
  const existing = hist.find((s) => s.ym === ym) ?? { ym };
  const rest = hist.filter((s) => s.ym !== ym);
  rest.push({ ...existing, ym, recordedAsset: totalAsset, projected1y });
  return saveHistory(rest, storage);
}

const ymToNum = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

// 今月から途切れず記録し続けている月数
export function recordStreak(history, ym = monthOf()) {
  const recorded = new Set(history.filter((s) => s.recordedAsset != null).map((s) => ymToNum(s.ym)));
  let n = 0;
  let cur = ymToNum(ym);
  while (recorded.has(cur)) {
    n++;
    cur--;
  }
  return n;
}

// 指定月より前の、いちばん新しい記録済みエントリ
export function latestRecordBefore(history, ym = monthOf()) {
  const prior = history.filter((s) => s.ym < ym && s.recordedAsset != null);
  return prior.length ? prior[prior.length - 1] : null;
}

// 前回の記録との実額差をシンプルに伝える（難しい月割り計算はしない・責めない）
export function buildRecordDelta(prev, curr) {
  if (!prev || prev.recordedAsset == null || curr?.recordedAsset == null) return null;
  const prevMonth = `${Number(prev.ym.split('-')[1])}月`;
  const diffMan = Math.round((curr.recordedAsset - prev.recordedAsset) / 10000);
  if (Math.abs(diffMan) < 1) {
    return { type: 'improved', text: `前回（${prevMonth}）とほぼ同じ。キープも立派！` };
  }
  if (diffMan > 0) {
    return { type: 'improved', text: `前回（${prevMonth}）より +${diffMan}万円 ふえたよ！` };
  }
  return { type: 'gentle', text: `前回（${prevMonth}）より −${-diffMan}万円。使う月もあるさ、だいじょうぶ` };
}

// 約1年前（11〜13ヶ月前・12ヶ月を最優先）に立てた計画と今月の実績の答え合わせ。
// ±5%以内は「計画どおり」を褒める。下回っても事実+見直しの誘いだけ（§1 責めない）
export function buildYearReview(history, ym = monthOf()) {
  const cur = history.find((s) => s.ym === ym && s.recordedAsset != null);
  if (!cur) return null;
  const now = ymToNum(ym);
  const base = history
    .filter((s) => s.projected1y != null)
    .map((s) => ({ s, age: now - ymToNum(s.ym) }))
    .filter(({ age }) => age >= 11 && age <= 13)
    .sort((a, b) => Math.abs(a.age - 12) - Math.abs(b.age - 12) || b.age - a.age)[0];
  if (!base) return null;
  const plan = base.s.projected1y;
  const actual = cur.recordedAsset;
  const planMan = Math.round(plan / 10000);
  const actualMan = Math.round(actual / 10000);
  const onPlan = plan > 0 ? Math.abs(actual - plan) / plan <= 0.05 : actual === 0;
  if (onPlan) {
    return { type: 'improved', text: '去年立てた計画どおりに進んでるよ。これ、いちばんすごいことかも' };
  }
  if (actual > plan) {
    return {
      type: 'improved',
      text: `去年の計画では${planMan}万円の予定だったけど、実際は${actualMan}万円。計画より上をいってるよ🌱`,
    };
  }
  return {
    type: 'gentle',
    text: `去年の計画は${planMan}万円、実際は${actualMan}万円。予定どおりにいかない年もあるさ。計画を見直すチャンスだよ`,
  };
}

// データ引っ越しの読み込み用。ymが YYYY-MM のエントリだけ採用して保存する
export function importHistory(arr, storage = globalThis.localStorage) {
  if (!Array.isArray(arr)) return loadHistory(storage);
  const ok = arr.filter((s) => s && typeof s === 'object' && /^\d{4}-\d{2}$/.test(s.ym));
  return saveHistory(ok, storage);
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
