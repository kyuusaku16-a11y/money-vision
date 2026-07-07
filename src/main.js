import { projectAssets, deriveKpis, educationCostAt } from './calc.js';
import { buildComments } from './comments.js';
import { loadState, saveState, DEFAULT_ADVANCED } from './storage.js';
import { renderChart } from './chart.js';
import { fmtMoney, manToYen, yenToMan } from './format.js';
import { deriveValidation } from './validation.js';
import { buildReaction } from './reactions.js';
import { buildSchedule } from './schedule.js';
import { buildAdvice, buildNarrativeReport, findEducationPeak } from './advice.js';

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

// 予定表「詳しく見る」の開閉状態（再描画をまたいで保持）
let timelineOpen = false;

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
  return { ...s.inputs, ...s.advanced, events: s.events, children: s.children };
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

function makeCommentCard(c) {
  const card = document.createElement('div');
  card.className = `comment ${c.type}`;
  if (c.leadIcon || c.leadImg) {
    const lead = document.createElement('span');
    lead.className = 'comment-lead';
    lead.setAttribute('aria-hidden', 'true');
    if (c.leadImg) {
      const img = document.createElement('img');
      img.src = c.leadImg;
      img.alt = '';
      img.loading = 'lazy';
      lead.appendChild(img);
    } else {
      lead.textContent = c.leadIcon;
    }
    card.appendChild(lead);
  }
  const content = document.createElement('div');
  content.className = 'comment-content';
  if (c.title) {
    const t = document.createElement('strong');
    t.className = 'comment-title';
    t.textContent = c.title;
    content.appendChild(t);
  }
  if (c.lines?.length) {
    const lines = document.createElement('div');
    lines.className = 'comment-lines';
    for (const line of c.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      lines.appendChild(p);
    }
    content.appendChild(lines);
  } else {
    const body = document.createElement('span');
    body.textContent = c.text;
    content.appendChild(body);
  }
  if (c.actions?.length) {
    const row = document.createElement('div');
    row.className = 'comment-actions';
    for (const a of c.actions) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = a.label;
      chip.addEventListener('click', () => {
        const el = $(a.targetId);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      });
      row.appendChild(chip);
    }
    content.appendChild(row);
  }
  if (c.noDecor) {
    card.append(content);
    return card;
  }
  const visual = document.createElement('span');
  visual.className = 'comment-visual';
  visual.setAttribute('aria-hidden', 'true');
  if (c.decorImg) {
    const img = document.createElement('img');
    img.src = c.decorImg;
    img.alt = '';
    img.loading = 'lazy';
    visual.appendChild(img);
  } else {
    visual.textContent = c.decorIcon ?? iconForComment(c);
  }
  card.append(content, visual);
  return card;
}

function renderComments(cards, summary) {
  const box = $('comments');
  box.innerHTML = '';
  for (const c of cards) box.appendChild(makeCommentCard(c));

  const summaryBox = $('summaryComment');
  summaryBox.innerHTML = '';
  if (summary) summaryBox.appendChild(makeCommentCard(summary));
}

function buildGuidanceCards(params, series, comments, advice) {
  // あなたの積み立て: 累計と複利の育ちを実数で見せる
  const years = params.retireAge - params.currentAge;
  const contribTotal = params.monthlyInvest * 12 * Math.max(0, years);
  const atRetire = series.find((p) => p.age === params.retireAge);
  let investText;
  if (years > 0 && params.monthlyInvest > 0 && atRetire) {
    investText = `毎月${fmtMoney(params.monthlyInvest)} × ${params.retireAge}歳までの${years}年で、積み立て総額は約${fmtMoney(contribTotal)}。元手と合わせて、退職時の投資資産は約${fmtMoney(atRetire.invested)}に育つ計算です。`;
  } else if (years > 0) {
    investText = 'いまは積み立てなしのプランです。スライダーで少し足すと、複利でどれくらい育つかをすぐ確かめられます。';
  } else {
    investText = '積み立て期間は終了し、育てた資産を使っていく時期のプランです。';
  }

  // お子さまの教育費: これからの見込み総額とピーク
  const children = params.children ?? [];
  let eduText;
  if (children.length > 0) {
    let eduTotal = 0;
    for (const c of children) {
      for (let a = Math.max(0, c.age); a <= 21; a++) eduTotal += educationCostAt(a);
    }
    if (eduTotal > 0) {
      const peak = findEducationPeak(params);
      eduText =
        `お子さま${children.length}人の これからの教育費は、合計 約${fmtMoney(eduTotal)}の見込みです。` +
        (peak ? `ピークは${peak.age}歳ごろ（年 約+${fmtMoney(peak.amount)}）。` : '') +
        '差分方式なので二重計上はありません。';
    } else {
      eduText = 'お子さまはみんな独立後の想定です。教育費の見込みはもうありません。';
    }
  } else {
    eduText = 'お子さまを追加すると、年齢だけで将来の教育費を自動で概算します（高校まで公立・大学は私立文系の目安）。';
  }

  const cards = [
    {
      type: 'note money-note',
      leadImg: 'assets/coins.png',
      decorImg: 'assets/bear-book.png',
      title: 'あなたの積み立て',
      text: investText,
    },
    {
      type: 'note education-note',
      leadImg: 'assets/grad-cap.png',
      decorImg: 'assets/rabbit-note.png',
      title: 'お子さまの教育費',
      text: eduText,
    },
  ];

  const result = comments.find((c) => c.type !== 'cheer') ?? advice[0];
  const cheer = comments.find((c) => c.type === 'cheer');
  const summaryText = result?.text ?? cheer?.text;
  const summary = summaryText
    ? { type: 'summary', leadImg: 'assets/bulb.png', decorImg: 'assets/pair-sit.png', title: result?.title, text: summaryText, actions: result?.actions }
    : null;

  return { cards, summary };
}

function iconForComment(c) {
  if (c.icon) return c.icon;
  if (c.type === 'diagnosis') return '🌱';
  if (c.type === 'tip') return '💡';
  if (c.type === 'good') return '🌿';
  if (c.type === 'warning') return '⚠️';
  if (c.type === 'cheer') return '🌸';
  if (c.title?.includes('目標')) return '🎯';
  if (c.title?.includes('資産') || c.title?.includes('残高')) return '🪙';
  return '📌';
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

function renderSchedule(rows) {
  const panel = $('schedule');
  const list = $('scheduleList');
  list.innerHTML = '';
  panel.hidden = false;
  // 登録内容を集計して「あなたの数字」を出すミニダッシュボード
  const children = state.children ?? [];
  let eduTotal = 0;
  for (const c of children) {
    for (let a = Math.max(0, c.age); a <= 21; a++) eduTotal += educationCostAt(a);
  }
  const HOME_WORDS = ['住', '家', '頭金', 'リフォーム', 'マンション', '引越', '引っ越'];
  const isHome = (ev) => HOME_WORDS.some((w) => (ev.label ?? '').includes(w));
  const events = state.events ?? [];
  const homeEvents = events.filter(isHome);
  const otherEvents = events.filter((ev) => !isHome(ev));
  const sumOf = (list) => list.reduce((s, e) => s + (e.amount || 0), 0);

  const jumpTo = (id) => {
    $('advanced').open = true;
    $(id).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const openTimeline = () => {
    timelineOpen = true;
    const det = document.querySelector('.timeline-details');
    if (det) {
      det.open = true;
      det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  const eventLabel = (list) =>
    `登録${list.length}件（${(list[0].label || 'イベント').slice(0, 8)}${list.length > 1 ? ' ほか' : ''}）`;

  const cards = [
    children.length > 0 && eduTotal > 0
      ? { cls: 'edu registered', iconImg: 'assets/grad-cap.png', title: '教育費', sub: `お子さま${children.length}人 登録済み`, amount: `これから 合計 約${fmtMoney(eduTotal)}`, btn: '内訳を見る', onClick: openTimeline }
      : { cls: 'edu', iconImg: 'assets/grad-cap.png', title: '教育費', sub: 'お子さま1人あたりの目安', amount: '約 1,000〜1,500万円', btn: '＋ 子どもを追加', onClick: () => jumpTo('addChild') },
    homeEvents.length > 0
      ? { cls: 'home registered', iconImg: 'assets/house.png', title: '住まいの費用', sub: eventLabel(homeEvents), amount: `合計 約${fmtMoney(sumOf(homeEvents))}`, btn: '編集する', onClick: () => jumpTo('addEvent') }
      : { cls: 'home', iconImg: 'assets/house.png', title: '住まいの費用', sub: '購入・建て替えなどの目安', amount: '約 2,000〜4,000万円', btn: '＋ 追加する', onClick: () => jumpTo('addEvent') },
    otherEvents.length > 0
      ? { cls: 'other registered', iconImg: 'assets/bag.png', title: 'その他の大型支出', sub: eventLabel(otherEvents), amount: `合計 約${fmtMoney(sumOf(otherEvents))}`, btn: '編集する', onClick: () => jumpTo('addEvent') }
      : { cls: 'other', iconImg: 'assets/bag.png', title: 'その他の大型支出', sub: '車の買替え・介護費用など', amount: '数百〜数千万円', btn: '＋ 追加する', onClick: () => jumpTo('addEvent') },
  ];

  const grid = document.createElement('div');
  grid.className = 'expense-cards';
  for (const c of cards) {
    const card = document.createElement('div');
    card.className = `expense-card ${c.cls}`;
    const title = document.createElement('strong');
    const iconImg = document.createElement('img');
    iconImg.src = c.iconImg;
    iconImg.alt = '';
    iconImg.loading = 'lazy';
    title.append(iconImg, document.createTextNode(c.title));
    const sub = document.createElement('span');
    sub.className = 'expense-sub';
    sub.textContent = c.sub;
    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = c.amount;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = c.btn;
    button.addEventListener('click', c.onClick);
    card.append(title, sub, amount, button);
    grid.appendChild(card);
  }
  const note = document.createElement('p');
  note.className = 'expense-note';
  note.textContent = '※未登録の項目は一般的な目安を表示しています。登録すると、あなたの合計に変わります。';
  list.append(grid, note);
  if (rows.length === 0) return;
  // 「詳しく見る」開閉式の予定表（再描画をまたいで開閉状態を保つ）
  const details = document.createElement('details');
  details.className = 'timeline-details';
  details.open = timelineOpen;
  details.addEventListener('toggle', () => {
    timelineOpen = details.open;
  });
  const toggleLabel = document.createElement('summary');
  toggleLabel.textContent = '📅 詳しく見る（何年に・いくら）';
  details.appendChild(toggleLabel);
  const timeline = document.createElement('div');
  timeline.className = 'schedule-timeline';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'sched-row';
    const when = document.createElement('span');
    when.className = 'sched-when';
    when.textContent = `${r.year}年（${r.age}歳）`;
    const items = document.createElement('div');
    items.className = 'sched-items';
    for (const t of r.items) {
      const item = document.createElement('div');
      item.textContent = t;
      items.appendChild(item);
    }
    row.append(when, items);
    timeline.appendChild(row);
  }
  details.appendChild(timeline);
  list.appendChild(details);
}

// 一番下の「今回の診断」カード＋💡ちょこっとアドバイス
function renderDiagnosis(report, tips) {
  const box = $('diagnosis');
  box.innerHTML = '';
  // 診断カードの挿絵は「芽に水をやるくま」＝資産を育てる世界観
  box.appendChild(makeCommentCard({ ...report, decorImg: 'assets/bear-watering.png' }));
  for (const t of tips) box.appendChild(makeCommentCard({ ...t, noDecor: true }));
}

// --- 子どもの教育費 ---
// 行の再描画は追加/削除時のみ（ライフイベントと同じ流儀）。
function renderChildren() {
  const list = $('childList');
  list.innerHTML = '';
  state.children.forEach((child, i) => {
    const row = document.createElement('div');
    row.className = 'child-row';

    // 名前は任意。未入力なら予定表・グラフでは「子どもN」と表示される
    const who = document.createElement('input');
    who.type = 'text';
    who.className = 'who';
    who.placeholder = `子ども${i + 1}（名前・任意）`;
    who.value = child.name ?? '';
    who.addEventListener('input', () => {
      child.name = who.value;
      update();
    });

    const age = document.createElement('input');
    age.type = 'number';
    age.min = '0';
    age.max = '30';
    age.value = child.age;
    age.addEventListener('input', () => {
      child.age = Math.max(0, Number(age.value) || 0);
      update();
    });

    const unit = document.createElement('span');
    unit.textContent = '歳';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'event-del';
    del.setAttribute('aria-label', '子どもを削除');
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.children.splice(state.children.indexOf(child), 1);
      renderChildren();
      update();
    });

    row.append(who, age, unit, del);
    list.appendChild(row);
  });
}

// --- ライフイベント（§4.2）---
// 行の再描画は追加/削除時のみ（入力中のフォーカスを守る）。並び替えもしない。
// ラベルはユーザー入力文字列のため createElement + value のみで扱う（innerHTML禁止）。

// よく使うイベントのプリセット（金額は目安。追加後に自由に編集できる）
const EVENT_PRESETS = [
  { label: '住宅頭金', amountMan: 1000, offsetYears: 5 },
  { label: '車の買い替え', amountMan: 250, offsetYears: 3 },
  { label: '旅行・記念', amountMan: 50, offsetYears: 1 },
];

function addEventRow({ label = '', amountMan = 100, offsetYears = 10 } = {}) {
  const age = Math.max(
    state.inputs.currentAge + 1,
    Math.min(state.inputs.currentAge + offsetYears, state.advanced.endAge),
  );
  state.events.push({ age, amount: manToYen(amountMan), label });
  renderEvents();
  update();
}

function renderEventPresets() {
  const box = $('eventPresets');
  for (const p of EVENT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'event-preset';
    btn.textContent = `＋${p.label}`;
    btn.addEventListener('click', () => addEventRow(p));
    box.appendChild(btn);
  }
}

function renderEvents() {
  const list = $('eventList');
  list.innerHTML = '';
  for (const ev of state.events) {
    const row = document.createElement('div');
    row.className = 'event-row';

    const label = document.createElement('input');
    label.type = 'text';
    label.placeholder = 'イベント名';
    label.value = ev.label ?? '';
    label.addEventListener('input', () => {
      ev.label = label.value;
      saveState(state);
    });

    const age = document.createElement('input');
    age.type = 'number';
    age.min = '18';
    age.max = '110';
    age.value = ev.age;
    age.addEventListener('input', () => {
      ev.age = Math.max(0, Number(age.value) || 0);
      update();
    });

    const ageUnit = document.createElement('span');
    ageUnit.textContent = '歳';

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '0';
    amount.step = '10';
    amount.value = yenToMan(ev.amount);
    amount.addEventListener('input', () => {
      ev.amount = manToYen(Math.max(0, Number(amount.value) || 0));
      update();
    });

    const amountUnit = document.createElement('span');
    amountUnit.textContent = '万円';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'event-del';
    del.setAttribute('aria-label', 'イベントを削除');
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.events.splice(state.events.indexOf(ev), 1);
      renderEvents();
      update();
    });

    row.append(label, age, ageUnit, amount, amountUnit, del);
    list.appendChild(row);
  }
}

function renderReaction(reaction) {
  const box = $('reaction');
  clearTimeout(reactionTimer);
  if (!reaction) {
    box.hidden = true;
    return;
  }
  // 改善は喜びうさぎ、ゆっくりペースはくまが寄り添う
  $('reactionImg').src = reaction.type === 'improved' ? 'assets/rabbit-joy.png' : 'assets/bear.png';
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
  const advice = buildAdvice(params, mainSeries, kpis);
  const comments = buildComments(kpis, params);
  const guidance = buildGuidanceCards(params, mainSeries, comments, advice);
  renderComments(guidance.cards, guidance.summary);
  renderDiagnosis(buildNarrativeReport(params, mainSeries, kpis, advice), advice.filter((a) => a.type === 'tip'));
  renderValidation(deriveValidation(params));
  renderAdvancedSummary();
  renderSchedule(buildSchedule(params));
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
  // デプロイ直後の新旧モジュール混在キャッシュ対策: 配列フィールドを保証する
  state.events ??= [];
  state.children ??= [];
  writeForm();
  renderEvents();
  renderChildren();

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

  renderEventPresets();
  $('addChild').addEventListener('click', () => {
    state.children.push({ age: 5 });
    renderChildren();
    update();
  });
  $('addEvent').addEventListener('click', () => addEventRow());

  update();
}

document.addEventListener('DOMContentLoaded', init);
