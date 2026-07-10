// ログインスタンプ帳: 1日1回、自分でポンと押す（ラジオ体操カード方式）。
// 連続日数では縛らない（休んでも何も失わない・月間の集計だけ）— §1 責めない。
// データは端末内のみ。保存形: { "2026-07": [1, 3, 8, ...] } 直近3ヶ月分。

const KEY = 'money-vision-stamps';
const KEEP_MONTHS = 3;

const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function loadStamps(storage = globalThis.localStorage) {
  try {
    const o = JSON.parse(storage?.getItem(KEY) ?? '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

export function stampsThisMonth(storage = globalThis.localStorage, d = new Date()) {
  const days = loadStamps(storage)[ymOf(d)] ?? [];
  return [...days].sort((a, b) => a - b);
}

export function stampToday(storage = globalThis.localStorage, d = new Date()) {
  const all = loadStamps(storage);
  const ym = ymOf(d);
  const days = all[ym] ?? [];
  if (days.includes(d.getDate())) {
    return { added: false, days: [...days].sort((a, b) => a - b), count: days.length };
  }
  const next = [...days, d.getDate()].sort((a, b) => a - b);
  all[ym] = next;
  const keep = Object.keys(all).sort().slice(-KEEP_MONTHS);
  const trimmed = Object.fromEntries(keep.map((k) => [k, all[k]]));
  try {
    storage?.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
  return { added: true, days: next, count: next.length };
}

// データ引っ越しの読み込み用。YYYY-MM キー＋1〜31の整数配列だけ採用して保存する
export function importStamps(obj, storage = globalThis.localStorage) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return loadStamps(storage);
  const clean = {};
  for (const [ym, days] of Object.entries(obj)) {
    if (!/^\d{4}-\d{2}$/.test(ym) || !Array.isArray(days)) continue;
    clean[ym] = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31))].sort((a, b) => a - b);
  }
  const keep = Object.keys(clean).sort().slice(-KEEP_MONTHS);
  const trimmed = Object.fromEntries(keep.map((k) => [k, clean[k]]));
  try {
    storage?.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
  return trimmed;
}

// スタンプの絵柄は日付で決まる（うさぎ・くま・小鳥のローテーション）
const STAMP_CHARS = ['assets/piyo-good.png', 'assets/piyo-yatta.png', 'assets/piyo-memo.png', 'assets/piyo-wave2.png'];

export function stampCharFor(day) {
  return STAMP_CHARS[day % STAMP_CHARS.length];
}

// 節目のごほうびメッセージ（月間個数）
const MILESTONES = {
  5: '今月5個め！いいペースだね🌸',
  10: '10個たまったよ！お金との距離がちぢまってる🌱',
  15: '15個！もう習慣って呼んでいいやつだ🎉',
  20: '20個…！ここまで来る人、なかなかいないよ👑',
  25: '25個！あなたの継続力、ほんもの✨',
};

export function milestoneMessage(count) {
  return MILESTONES[count] ?? null;
}

// 日替わりのひとこと（豆知識・励まし・小ネタ。金額なし・煽りなし）
const QUOTES = [
  '複利はね、玉の大きさより坂の長さが大事なんだって🐿️',
  '固定費をひとつ見直すと、効果はずっと続くよ',
  'つもり貯金っていう貯金術もあるんだよ。我慢したら貯まったつもり🌰',
  '今日もよく来たね。それだけで、お金との距離が近づいてる',
  'ボーナスは楽しむ分を最初に決めると、罪悪感が消えるらしい',
  '資産寿命は「いくら」より「何歳まで」で考えると気がラクだよ',
  '教育費の山は、位置がわかっていればこわくないんだ',
  '休むのも家計のうち。あせらない、あせらない🐻',
  'ねんきん定期便、誕生月に届くの知ってた？',
  '値上げの日は、固定費見直しのチャンスの日でもあるよ',
  '貯金がへる月があっても大丈夫。使う月もあるさ',
  '将来の自分は、いまの自分の味方だよ🌱',
  '小さな積み立ては、未来への仕送りなんだって',
  'グラフをながめるだけの日があってもいいんだよ',
  'お金の話、家族としてみるのもいいかも。今日はどう？',
  'ノーマネーデーって知ってる？お金を使わない日を数える遊び',
];

export function dailyQuote(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
