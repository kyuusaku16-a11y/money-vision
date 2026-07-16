const KEY = 'money-vision-state';
export const SIMULATION_END_AGE = 100;

function deepFreeze(o) {
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') deepFreeze(v);
  }
  return Object.freeze(o);
}

// 基本入力（常時表示・仕様§4.1）。円・歳・%。
// 初期値は想定読者（20代後半・貯金これから）に寄せる。目標も「まず届く」1,000万円に
// （遠すぎる初期目標は達成演出が夢物語になり、数字への信頼を下げるため）
export const DEFAULT_INPUTS = deepFreeze({
  currentAge: 28,
  totalAsset: 1000000,
  investedAsset: 250000,
  monthlyInvest: 30000,
  annualIncome: 3500000,
  annualExpense: 2500000,
  expectedReturn: 5,
  targetAmount: 10000000,
});

// 詳しく設定（アコーディオン・仕様§4.2）
export const DEFAULT_ADVANCED = deepFreeze({
  retireAge: 65,
  pensionAnnual: 1800000,
  pensionStartAge: 65,
  retirementBonus: 0,
  retiredExpenseRatio: 0.7,
  endAge: 100,
  loanMonthly: 0, // 住宅ローンの月々返済（未入力=0。返済額は年間支出に含めて入力する前提）
  loanEndAge: 65,
});

// 保存データ構造（仕様§8）
export const DEFAULT_STATE = deepFreeze({
  version: 1,
  inputs: { ...DEFAULT_INPUTS },
  advanced: { ...DEFAULT_ADVANCED },
  events: [],
  children: [],
  settings: { themeId: 'sprout', viewMode: 'life' },
  scenarios: [],
});

function freshDefault() {
  return {
    version: 1,
    inputs: { ...DEFAULT_INPUTS },
    advanced: { ...DEFAULT_ADVANCED },
    events: [],
    children: [],
    settings: { themeId: 'sprout', viewMode: 'life' },
    scenarios: [],
  };
}

// 保存データ・読み込みファイルを正しい形に整える（欠けはデフォルトで補完）
export function normalizeState(p) {
  if (!p || typeof p !== 'object') return freshDefault();
  // 旧データの endAge は受け入れるが、現行の計算期間は常に100歳にそろえる。
  const advanced = { ...DEFAULT_ADVANCED, ...(p.advanced || {}), endAge: SIMULATION_END_AGE };
  const inputs = { ...DEFAULT_INPUTS, ...(p.inputs || {}) };
  const settings = { themeId: 'sprout', viewMode: 'life', ...(p.settings || {}) };
  if (inputs.targetAmount <= 0) settings.viewMode = 'life';
  return {
    version: 1,
    inputs,
    advanced,
    events: Array.isArray(p.events) ? p.events : [],
    children: Array.isArray(p.children) ? p.children : [],
    settings,
    scenarios: Array.isArray(p.scenarios) ? p.scenarios : [],
  };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return freshDefault();
    return normalizeState(JSON.parse(raw));
  } catch {
    return freshDefault();
  }
}

// シナリオ保存（仕様§9）: いまの入力一式をスナップショットとして持つ。最大3つ
const MAX_SCENARIOS = 3;

export function addScenario(state, name, now = Date.now()) {
  if (state.scenarios.length >= MAX_SCENARIOS) {
    return { state, error: '保存できるのは3つまで。いらないプランを削除してね' };
  }
  const scenario = {
    id: `s${now}-${state.scenarios.length}`,
    name,
    savedAt: now,
    inputs: { ...state.inputs },
    advanced: { ...state.advanced },
    events: state.events.map((e) => ({ ...e })),
    children: state.children.map((c) => ({ ...c })),
  };
  return { state: { ...state, scenarios: [...state.scenarios, scenario] }, scenario };
}

export function removeScenario(state, id) {
  return { ...state, scenarios: state.scenarios.filter((s) => s.id !== id) };
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* localStorage 使用不可でも無視 */
  }
}

// アプリが端末に保存するキーの一覧（「すべてのデータを削除」で消す対象）。
// 新しいキーを追加したら、ここにも必ず足すこと
const APP_KEYS = [
  KEY,
  'money-vision-history',
  'money-vision-stamps',
  'money-vision-stamp-recap',
  'money-vision-monthly-actions',
  'mv-hero-done',
  'mv-visited',
  'mv-pwa-hint-done',
  'mv-revealed',
  'mv-planbook-voted',
  'mv-planbook-seen',
  'mv-next-step-tried',
];

export function clearAllData(storage = globalThis.localStorage) {
  try {
    for (const k of APP_KEYS) storage?.removeItem(k);
  } catch {
    /* localStorage 使用不可でも無視 */
  }
}
