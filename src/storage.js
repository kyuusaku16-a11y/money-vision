const KEY = 'money-vision-state';

function deepFreeze(o) {
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') deepFreeze(v);
  }
  return Object.freeze(o);
}

// 基本入力（常時表示・仕様§4.1）。円・歳・%。
export const DEFAULT_INPUTS = deepFreeze({
  currentAge: 35,
  totalAsset: 5000000,
  investedAsset: 5000000, // 既定は totalAsset と同額（現在の資産はすべて投資済みとみなす暫定値）
  monthlyInvest: 50000,
  annualIncome: 5000000,
  annualExpense: 3000000,
  expectedReturn: 5,
  targetAmount: 100000000,
});

// 詳しく設定（アコーディオン・仕様§4.2）
export const DEFAULT_ADVANCED = deepFreeze({
  retireAge: 65,
  pensionAnnual: 1800000,
  pensionStartAge: 65,
  retirementBonus: 0,
  retiredExpenseRatio: 0.7,
  endAge: 100,
});

// 保存データ構造（仕様§8）
export const DEFAULT_STATE = deepFreeze({
  version: 1,
  inputs: { ...DEFAULT_INPUTS },
  advanced: { ...DEFAULT_ADVANCED },
  events: [],
  settings: { themeId: 'sprout' },
  scenarios: [],
});

function freshDefault() {
  return {
    version: 1,
    inputs: { ...DEFAULT_INPUTS },
    advanced: { ...DEFAULT_ADVANCED },
    events: [],
    settings: { themeId: 'sprout' },
    scenarios: [],
  };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return freshDefault();
    const p = JSON.parse(raw);
    return {
      version: 1,
      inputs: { ...DEFAULT_INPUTS, ...(p.inputs || {}) },
      advanced: { ...DEFAULT_ADVANCED, ...(p.advanced || {}) },
      events: Array.isArray(p.events) ? p.events : [],
      settings: { themeId: 'sprout', ...(p.settings || {}) },
      scenarios: Array.isArray(p.scenarios) ? p.scenarios : [],
    };
  } catch {
    return freshDefault();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
}
