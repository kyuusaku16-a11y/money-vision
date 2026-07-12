// 初回ベールと「保存してよいか」の状態遷移（純ロジック・DOMなし）。
//
// 守りたいルール:
// - ベール中（初訪問でまだ結果をめくっていない）は、サンプル初期値を
//   localStorageに保存しない。何もせず離脱した人が再訪したとき、
//   サンプル値が「本人の結果」として復元されるのを防ぐ
// - 「サンプルで見てみる」でめくった場合も保存しない（再訪時はベールに戻る）
// - 自分の数字でめくった時点、またはサンプル閲覧後に自分で入力し始めた時点で
//   初めて保存を開始する
//
// 状態: { veiled: ベール中か, canPersist: 保存してよいか }
// markRevealed が true のとき、呼び出し側は mv-revealed をlocalStorageへ書く。

export function initialVeil({ hasSavedState, revealed }) {
  const veiled = !hasSavedState && !revealed;
  return { veiled, canPersist: !veiled };
}

// 結果をめくる。fromSample=true はサンプル閲覧（保存を始めない）
export function applyReveal(state, fromSample) {
  if (!state.veiled) return { ...state, markRevealed: false };
  if (fromSample) return { veiled: false, canPersist: false, markRevealed: false };
  return { veiled: false, canPersist: true, markRevealed: true };
}

// 入力欄を自分で編集した。サンプル閲覧後（ベールなし・保存なし）なら
// ここから本人の利用として保存を開始する
export function applyEdit(state) {
  if (state.veiled || state.canPersist) return { ...state, markRevealed: false };
  return { veiled: false, canPersist: true, markRevealed: true };
}
