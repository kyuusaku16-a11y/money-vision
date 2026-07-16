// 比較から選んだ「今月の一歩」。端末内に行動文だけを保存する。

const KEY = 'money-vision-monthly-actions';

export function actionMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function loadMonthlyActions(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item) => item && /^\d{4}-\d{2}$/.test(item.ym) && typeof item.text === 'string')
      : [];
  } catch {
    return [];
  }
}

export function addMonthlyAction(text, storage = globalThis.localStorage, ym = actionMonth()) {
  const actions = loadMonthlyActions(storage);
  if (actions.some((item) => item.ym === ym && item.text === text)) {
    return { added: false, actions };
  }
  const next = [...actions, { ym, text }];
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    return { added: false, actions };
  }
  return { added: true, actions: next };
}

// バックアップ読み込み用。形式の正しい項目だけを取り込み、保存後の一覧を返す
export function importMonthlyActions(arr, storage = globalThis.localStorage) {
  if (!Array.isArray(arr)) return loadMonthlyActions(storage);
  const ok = arr.filter((item) => item && /^\d{4}-\d{2}$/.test(item.ym) && typeof item.text === 'string');
  try {
    storage?.setItem(KEY, JSON.stringify(ok));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
  return ok;
}

export function hasMonthlyAction(text, storage = globalThis.localStorage, ym = actionMonth()) {
  return loadMonthlyActions(storage).some((item) => item.ym === ym && item.text === text);
}

export function actionsForMonth(storage = globalThis.localStorage, ym = actionMonth()) {
  return loadMonthlyActions(storage).filter((item) => item.ym === ym);
}
