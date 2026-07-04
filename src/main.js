import { projectAssets, deriveKpis } from './calc.js';
import { buildComments } from './comments.js';
import { loadState, saveState, DEFAULT_ADVANCED } from './storage.js';
import { renderChart } from './chart.js';
import { fmtMoney, manToYen, yenToMan } from './format.js';
import { deriveValidation } from './validation.js';
import { buildReaction } from './reactions.js';

// フォーム定義。id は state のキー名と一致。unit は UI⇄state の変換則
// （man=万円⇄円 / pct100=%⇄比率 / raw=そのまま）。
const FIELDS = [
  { id: 'currentAge', section: 'inputs', unit: 'raw' },
  { id: 'totalAsset', section: 'inputs', unit: 'man' },
  { id: 'investedAsset', section: 'inputs', unit: 'man' },
  { id: 'monthlyInvest', section: 'inputs', unit: 'man' },
  { id: 'annualIncome', section: 'inputs', unit: 'man' },
  { id: 'annualExpense', section: 'inputs', unit: 'man' },
  { id: 'expectedReturn', section: 'inputs', unit: 'raw' },
  { id: 'targetAmount', section: 'inputs', unit: 'man' },
  { id: 'retireAge', section: 'advanced', unit: 'raw' },
  { id: 'pensionAnnual', section: 'advanced', unit: 'man' },
  { id: 'pensionStartAge', section: 'advanced', unit: 'raw' },
  { id: 'retirementBonus', section: 'advanced', unit: 'man' },
  { id: 'retiredExpenseRatio', section: 'advanced', unit: 'pct100' },
  { id: 'endAge', section: 'advanced', unit: 'raw' },
];

// スライダーは state 単位（円・歳）で動き、同名 id の数値入力と双方向同期（§5）
const SLIDERS = ['monthlyInvest', 'annualIncome', 'annualExpense', 'retireAge'];

let state = null;
let chart = null;
let prevKpis = null;
let reactionTimer = null;

const $ = (id) => document.getElementById(id);
const fieldOf = (id) => FIELDS.find((f) => f.id === id);
const sectionOf = (s, f) => (f.section === 'inputs' ? s.inputs : s.advanced);

function toState(field, uiValue) {
  const v = Number(uiValue);
  if (uiValue === '' || Number.isNaN(v)) return null;
  if (field.unit === 'man') return manToYen(v);
  if (field.unit === 'pct100') return v / 100;
  return v;
}

function toUi(field, stateValue) {
  if (field.unit === 'man') return yenToMan(stateValue);
  if (field.unit === 'pct100') return Math.round(stateValue * 100);
  return stateValue;
}

function readForm() {
  const inputs = { ...state.inputs };
  const advanced = { ...state.advanced };
  for (const f of FIELDS) {
    const v = toState(f, $(f.id).value);
    if (v === null) continue; // 空欄・入力途中は直前の値を維持
    (f.section === 'inputs' ? inputs : advanced)[f.id] = v;
  }
  // 投資に回している額は総資産を超えない
  if (inputs.investedAsset > inputs.totalAsset) inputs.investedAsset = inputs.totalAsset;
  return { ...state, inputs, advanced };
}

function writeForm() {
  for (const f of FIELDS) $(f.id).value = toUi(f, sectionOf(state, f)[f.id]);
  syncSliders();
}

function paramsOf(s) {
  return { ...s.inputs, ...s.advanced };
}

function syncSliders() {
  // 毎月投資スライダーの上限は余剰額で動的制限（§3.4）
  const cap = deriveValidation(paramsOf(state)).investCapMonthly;
  $('monthlyInvestSlider').max = Math.max(0, Math.min(300000, cap));
  for (const id of SLIDERS) {
    $(`${id}Slider`).value = sectionOf(state, fieldOf(id))[id];
  }
}

function renderKpis(kpis, params) {
  $('kpi-current').textContent = fmtMoney(kpis.currentAssets);
  $('kpi-final-label').textContent = `${params.endAge}歳時点の資産`;
  $('kpi-final').textContent = fmtMoney(kpis.finalAssets);
  $('kpi-target').textContent =
    kpis.yearsToTarget === null ? `${params.endAge}歳までに未到達` : `あと${kpis.yearsToTarget}年（${kpis.targetAge}歳）`;
  const life = $('kpi-lifetime');
  life.textContent = kpis.survivesToEnd
    ? `${params.endAge}歳まで安心圏`
    : kpis.lifetimeAge === null
      ? '見直しの余地あり'
      : `約${kpis.lifetimeAge}歳まで`;
  life.classList.toggle('warn', !kpis.survivesToEnd);
}

function renderComments(comments) {
  const box = $('comments');
  box.innerHTML = '';
  for (const c of comments) {
    const p = document.createElement('p');
    p.className = `comment ${c.type}`;
    p.textContent = c.text;
    box.appendChild(p);
  }
}

function renderValidation(v) {
  const el = $('validationMsg');
  el.hidden = !v.message;
  el.textContent = v.message ?? '';
  const income = $('incomeNotice');
  income.hidden = !v.incomeNotice;
  income.textContent = v.incomeNotice ?? '';
}

function renderAdvancedSummary() {
  const a = state.advanced;
  $('advancedSummary').textContent =
    `年金${yenToMan(a.pensionAnnual)}万円・${a.pensionStartAge}歳から / 老後支出は現役の${Math.round(a.retiredExpenseRatio * 100)}%`;
  // 既定値のままなら「平均値で計算中」注記を出す（§4.3。変更したら即時消える）
  const isDefault = Object.keys(DEFAULT_ADVANCED).every((k) => a[k] === DEFAULT_ADVANCED[k]);
  $('defaultsNote').hidden = !isDefault;
}

function renderReaction(reaction) {
  const box = $('reaction');
  clearTimeout(reactionTimer);
  if (!reaction) {
    box.hidden = true;
    return;
  }
  $('reactionText').textContent = reaction.text;
  box.hidden = false;
  reactionTimer = setTimeout(() => {
    box.hidden = true;
  }, 4000);
}

function update({ withReaction = false } = {}) {
  state = readForm();
  saveState(state);

  const params = paramsOf(state);
  const mainSeries = projectAssets(params, params.expectedReturn / 100);

  const kpis = deriveKpis(mainSeries, params);
  renderKpis(kpis, params);
  renderComments(buildComments(kpis, params));
  renderValidation(deriveValidation(params));
  renderAdvancedSummary();
  if (withReaction) renderReaction(buildReaction(prevKpis, kpis));
  prevKpis = kpis;
  syncSliders();
  chart = renderChart($('chart'), mainSeries, params, chart);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function init() {
  state = loadState();
  writeForm();

  const onType = debounce(() => update({ withReaction: true }), 150);
  for (const f of FIELDS) $(f.id).addEventListener('input', onType);

  // スライダーはドラッグ中も毎回即時再計算（§5、debounceなし）
  for (const id of SLIDERS) {
    const f = fieldOf(id);
    $(`${id}Slider`).addEventListener('input', (e) => {
      $(id).value = toUi(f, Number(e.target.value));
      update({ withReaction: true });
    });
  }

  $('defaultsNote').addEventListener('click', () => {
    $('advanced').open = true;
    $('pensionAnnual').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  update();
}

document.addEventListener('DOMContentLoaded', init);
