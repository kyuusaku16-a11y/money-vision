// 「今月の一歩」— 未来チェック完了後に提案する、小さな行動ひとつ（仕様: docs/superpowers/specs/2026-07-12-future-check-design.md）
// ルール: 責めない・断定助言をしない（「見てみよう」「試しに入力してみよう」まで）。
// 状況にマッチする提案を優先し、どれにも当てはまらなければ月替わりのローテーション。

export const FALLBACK_STEPS = [
  { id: 'subsc', text: '使っていないサブスクがないか、1つだけ確認してみよう' },
  { id: 'atm', text: '今月ATM手数料を払ったか、思い出してみよう。払っていたら、引き出す曜日をひとつ決める' },
  { id: 'point', text: '期限の近いポイントがないか、いちばん使うアプリだけのぞいてみよう' },
  { id: 'sumaho', text: 'スマホ料金のプラン、1年見ていなければ今の使い方に合っているかだけ眺めてみよう' },
];

// params: { annualIncome, annualExpense, monthlyInvest, children }（円）
// kpis: { survivesToEnd, finalAssets } ／ surplus: 年間余剰（円） ／ ym: 'YYYY-MM'
export function pickMonthlyStep({ params, kpis, surplus, ym }) {
  const investYear = (params.monthlyInvest ?? 0) * 12;
  const room = surplus - investYear;

  if (!kpis.survivesToEnd) {
    return { id: 'retire', text: '「詳しく設定」で退職年齢を1年変えると、資産寿命がどう動くか見てみよう' };
  }
  if (params.annualIncome > 0 && params.annualExpense / params.annualIncome > 0.85) {
    return {
      id: 'fixed',
      text: '毎月決まって出ていくお金を、ひとつだけ確認してみよう',
      href: 'columns/setsuyaku.html',
      linkLabel: '固定費の見直し方を読む',
    };
  }
  if ((params.children ?? []).length > 0) {
    return { id: 'edu', text: 'グラフにマウス（タップ）をのせて、教育費の山がいつ来るか確認してみよう' };
  }
  if (room >= 240000) {
    return { id: 'invest-try', text: '積立を月1,000円だけ増やすと未来がどうなるか、試しに入力して見るだけ見てみよう' };
  }
  if (kpis.finalAssets >= 50_000_000) {
    return { id: 'fun', text: '余裕は十分。今月の「楽しみ予算」を先に決めて、堂々と使おう' };
  }
  const idx = Number(ym.split('-')[1] ?? 1) % FALLBACK_STEPS.length;
  return FALLBACK_STEPS[idx];
}
