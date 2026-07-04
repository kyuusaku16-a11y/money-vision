// 入力バリデーション（§3.4）。責めないトーンで警告を返す純粋関数。

// params: { annualIncome, annualExpense, monthlyInvest }（円）
// 返り値: { surplus, investCapMonthly, overInvest, message, incomeNotice }
export function deriveValidation({ annualIncome, annualExpense, monthlyInvest }) {
  const surplus = annualIncome - annualExpense;
  const investCapMonthly = Math.max(0, Math.floor(surplus / 12));
  const overInvest = monthlyInvest > 0 && monthlyInvest * 12 > surplus;
  const message = overInvest
    ? '毎月の投資額が収入の余剰を少し超えています。無理のない範囲に調整すると、現金も一緒に育てられますよ。'
    : null;
  const incomeNotice = annualIncome === 0
    ? '年収0円として計算中です。収入を入れると結果が大きく変わります。'
    : null;
  return { surplus, investCapMonthly, overInvest, message, incomeNotice };
}
