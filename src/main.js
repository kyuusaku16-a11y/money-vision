import { projectAssets, deriveKpis, educationCostAt, monthsToTarget, nearWindowYears, EDUCATION_COURSES } from './calc.js';
import { buildComments } from './comments.js';
import { loadState, saveState, normalizeState, addScenario, removeScenario, DEFAULT_ADVANCED } from './storage.js';
import { renderChart } from './chart.js';
import { fmtMoney, manToYen, yenToMan } from './format.js';
import { deriveValidation } from './validation.js';
import { buildReaction } from './reactions.js';
import { buildSchedule } from './schedule.js';
import { judgeType, buildShareText, renderShareCard, buildAxisDetails } from './share.js';
import { buildAdvice, buildNarrativeReport, findEducationPeak } from './advice.js';
import {
  loadHistory,
  recordSnapshot,
  previousSnapshot,
  buildWelcomeBack,
  markRecorded,
  recordStreak,
  latestRecordBefore,
  buildRecordDelta,
  ymLabel,
  buildYearReview,
  importHistory,
  monthOf,
} from './history.js';
import { seasonalMessage } from './seasonal.js';
import {
  stampsThisMonth,
  stampToday,
  stampCharFor,
  milestoneMessage,
  dailyQuote,
  loadStamps,
  importStamps,
  takeMonthlyRecap,
} from './stamps.js';
import { UPDATES, NOTE_ARTICLES, COLUMNS } from './updates.js';

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
  { id: 'loanMonthly', section: 'advanced', unit: 'man' },
  { id: 'loanEndAge', section: 'advanced', unit: 'raw' },
  { id: 'endAge', section: 'advanced', unit: 'raw' },
];

// スライダーは state 単位（円・歳）で動き、同名 id の数値入力と双方向同期（§5）
const SLIDERS = ['monthlyInvest', 'annualIncome', 'annualExpense', 'retireAge'];

let state = null;
let chart = null;
let prevKpis = null;
let reactionTimer = null;

const $ = (id) => document.getElementById(id);
// index.html冒頭のSVGスプライトを参照する（固定IDのみ・ユーザー入力は通さない）
const icoUse = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
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

// 「ちかい目標」の残り期間の言い方（月精度）
function nearGoalText(months) {
  if (months === null) return 'いまの計画では\n未到達';
  if (months === 0) return '達成ずみ🎉';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `あと${m}ヶ月🎉`;
  return m === 0 ? `あと${y}年ちょうど` : `あと${y}年${m}ヶ月`;
}

function renderKpis(kpis, params, { near = false, windowYears = 5, assetsWindow = null, goalMonths = null, masked = false } = {}) {
  if (masked) {
    // 初回ベール中: 答えは「めくってのお楽しみ」
    for (const id of ['kpi-current', 'kpi-final', 'kpi-target']) $(id).textContent = '？';
    $('kpi-lifetime').textContent = '？歳まで';
    $('kpi-lifetime').classList.remove('warn');
    $('lifetimeBarValue').textContent = '？歳まで';
    $('lifetimeBarValue').classList.remove('warn');
    return;
  }
  $('kpi-current').textContent = fmtMoney(kpis.currentAssets);
  const life = $('kpi-lifetime');
  const bar = $('lifetimeBarValue');
  if (near) {
    // ちかい目標モード: 目標に合わせた年数スケールのKPIに差し替え（資産寿命は出さない）
    $('kpi-final-label').textContent = `${windowYears}年後の資産`;
    $('kpi-final').textContent = fmtMoney(assetsWindow ?? kpis.finalAssets);
    $('kpi-target-label').textContent = '毎月のつみたて';
    $('kpi-target').textContent = `${yenToMan(params.monthlyInvest)}万円`;
    $('kpi-lifetime-label').textContent = '目標まで';
    life.textContent = nearGoalText(goalMonths);
    life.classList.toggle('warn', goalMonths === null);
    $('lifetimeBarLabel').textContent = '目標まで';
    bar.textContent = life.textContent.replace('\n', '');
    bar.classList.toggle('warn', goalMonths === null);
    return;
  }
  $('kpi-final-label').textContent = `${params.endAge}歳時点の資産`;
  $('kpi-final').textContent = fmtMoney(kpis.finalAssets);
  $('kpi-target-label').textContent = '目標到達まで';
  $('kpi-lifetime-label').textContent = '資産寿命';
  $('lifetimeBarLabel').textContent = '資産寿命';
  // 改行位置は \n で明示（.kpi-value は white-space: pre-line。単語の途中で折れないように）
  $('kpi-target').textContent =
    kpis.yearsToTarget === null
      ? `${params.endAge}歳までに\n未到達`
      : `あと${kpis.yearsToTarget}年\n（${kpis.targetAge}歳）`;
  life.textContent = kpis.survivesToEnd
    ? `${params.endAge}歳まで\n安心圏`
    : kpis.lifetimeAge === null
      ? '見直しの\n余地あり'
      : `約${kpis.lifetimeAge}歳まで`;
  life.classList.toggle('warn', !kpis.survivesToEnd);
  // スマホの固定バーにも同じ値を（こちらは1行で）
  bar.textContent = life.textContent.replace('\n', '');
  bar.classList.toggle('warn', !kpis.survivesToEnd);
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
  if (c.lines?.length || c.sections?.length) {
    const lines = document.createElement('div');
    lines.className = 'comment-lines';
    for (const line of c.lines ?? []) {
      const p = document.createElement('p');
      p.textContent = line;
      lines.appendChild(p);
    }
    // 章立てレポート（今回の診断）: 小見出し＋本文のくり返し
    for (const sec of c.sections ?? []) {
      if (!sec.lines?.length) continue;
      const h = document.createElement('strong');
      h.className = 'comment-sec-h';
      h.textContent = sec.h;
      lines.appendChild(h);
      for (const line of sec.lines) {
        const p = document.createElement('p');
        p.textContent = line;
        lines.appendChild(p);
      }
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
  if (c.decorFloat) {
    // 回り込み配置: 冒頭の数行だけが飾りを避け、続きの章は全幅を使える（長いレポート用）
    content.prepend(visual);
    card.append(content);
  } else {
    card.append(content, visual);
  }
  return card;
}

function renderComments(cards, summary) {
  const box = $('comments');
  box.innerHTML = '';
  for (const c of cards) box.appendChild(makeCommentCard(c));

  const summaryBox = $('summaryComment');
  summaryBox.innerHTML = '';
  if (summary) summaryBox.appendChild(makeCommentCard(summary));
  // 初回ベール中は「答えはめくってのお楽しみ」— 総評も見せない
  summaryBox.hidden = veiled;
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
      for (let a = Math.max(0, c.age); a <= 21; a++) eduTotal += educationCostAt(a, c.course);
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
      decorImg: 'assets/piyo-note.png',
      title: 'あなたの積み立て',
      text: investText,
    },
    {
      type: 'note education-note',
      leadImg: 'assets/grad-cap.png',
      decorImg: 'assets/piyo-idea.png',
      title: 'お子さまの教育費',
      text: eduText,
    },
  ];

  const result = comments.find((c) => c.type !== 'cheer') ?? advice[0];
  const cheer = comments.find((c) => c.type === 'cheer');
  const summaryText = result?.text ?? cheer?.text;
  const summary = summaryText
    ? { type: 'summary', leadImg: 'assets/bulb.png', decorImg: 'assets/piyo-happy.png', title: result?.title, text: summaryText, actions: result?.actions }
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
    for (let a = Math.max(0, c.age); a <= 21; a++) eduTotal += educationCostAt(a, c.course);
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
    (() => {
      const loan = state.advanced.loanMonthly;
      if (homeEvents.length > 0) {
        return { cls: 'home registered', iconImg: 'assets/house.png', title: '住まいの費用', sub: eventLabel(homeEvents), amount: `合計 約${fmtMoney(sumOf(homeEvents))}`, btn: '編集する', onClick: () => jumpTo('addEvent') };
      }
      if (loan > 0) {
        return { cls: 'home registered', iconImg: 'assets/house.png', title: '住まいの費用', sub: `ローン返済 月${fmtMoney(loan)}`, amount: `${state.advanced.loanEndAge}歳で完済予定`, btn: '編集する', onClick: () => jumpTo('loanMonthly') };
      }
      return { cls: 'home', iconImg: 'assets/house.png', title: '住まいの費用', sub: '購入・建て替えなどの目安', amount: '約 2,000〜4,000万円', btn: '＋ 追加する', onClick: () => jumpTo('addEvent') };
    })(),
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
  box.appendChild(makeCommentCard({ ...report, decorImg: 'assets/piyo-search.png', decorFloat: true }));
  const reportLines = [...report.lines, ...(report.sections ?? []).flatMap((s) => s.lines)];
  for (const t of tips) {
    // 診断本文に同じ文を借りているヒントは、二重表示になるのでカード側を出さない
    if (reportLines.includes(t.text)) continue;
    box.appendChild(makeCommentCard({ ...t, noDecor: true }));
  }
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

    // 進路コース（大学費用だけが変わる。既定=私立文系・自宅）
    const course = document.createElement('select');
    course.className = 'course';
    course.setAttribute('aria-label', '進路コース');
    for (const [value, def] of Object.entries(EDUCATION_COURSES)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = def.label;
      course.appendChild(opt);
    }
    course.value = child.course ?? 'private-arts';
    course.addEventListener('input', () => {
      child.course = course.value;
      update();
    });

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

    row.append(who, age, unit, course, del);
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

function renderReaction(reaction, duration = 4000) {
  const box = $('reaction');
  clearTimeout(reactionTimer);
  if (!reaction) {
    box.hidden = true;
    return;
  }
  // 改善はバンザイ、ゆっくりペースはサムズアップのぴよためが寄り添う（img指定があればそちら優先）
  $('reactionImg').src = reaction.img ?? (reaction.type === 'improved' ? 'assets/piyo-yatta.png' : 'assets/piyo-rest.png');
  $('reactionText').textContent = reaction.text;
  box.hidden = false;
  reactionTimer = setTimeout(() => {
    box.hidden = true;
  }, duration);
}

// スクロール補正: 再描画で操作中の入力欄より上の高さが変わっても、
// 入力欄が画面上で動かないようにする（Safariはスクロールアンカリング非対応）
let anchorEl = null;

function withScrollAnchor(fn) {
  const el = anchorEl?.isConnected ? anchorEl : null;
  const before = el ? el.getBoundingClientRect().top : 0;
  fn();
  if (!el) return;
  const delta = el.getBoundingClientRect().top - before;
  if (Math.abs(delta) > 1) window.scrollBy(0, delta);
}

// light: スライダーのドラッグ中はKPI・グラフだけ即時更新し、
// 重いコメント欄の作り直し（高さが変わる=チラつきの原因）はドラッグ後に1回だけ
function update({ withReaction = false, light = false } = {}) {
  state = readForm();
  saveState(state);

  const params = paramsOf(state);
  const mainSeries = projectAssets(params, params.expectedReturn / 100);

  const kpis = deriveKpis(mainSeries, params);
  const near = state.settings.viewMode === 'near';
  const goalMonths = near ? monthsToTarget(mainSeries, params.targetAmount) : null;
  const windowYears = nearWindowYears(goalMonths);
  withScrollAnchor(() => {
    renderKpis(kpis, params, {
      near,
      masked: veiled,
      windowYears,
      assetsWindow: mainSeries[windowYears]?.assets ?? null,
      goalMonths,
    });
    renderValidation(deriveValidation(params));
    renderAdvancedSummary();
    if (!light) {
      const advice = buildAdvice(params, mainSeries, kpis);
      const comments = buildComments(kpis, params);
      const guidance = buildGuidanceCards(params, mainSeries, comments, advice);
      renderComments(guidance.cards, guidance.summary);
      renderDiagnosis(buildNarrativeReport(params, mainSeries, kpis, advice), advice.filter((a) => a.type === 'tip'));
      renderSchedule(buildSchedule(params));
      if (withReaction) renderReaction(buildReaction(prevKpis, kpis));
    }
  });
  if (!light) {
    // 変化リアクションはドラッグ前→後の比較にしたいので、途中経過では更新しない
    prevKpis = kpis;
    recordSnapshot(kpis); // 今月分のスナップショットを常に最新へ（来月の「前回とくらべて」用）
  }
  syncSliders();

  // 保存プランとの比較線（選択中のときだけ）
  let compare = null;
  const compareSc = state.scenarios.find((s) => s.id === compareId) ?? null;
  if (compareSc) {
    const cp = { ...compareSc.inputs, ...compareSc.advanced, events: compareSc.events, children: compareSc.children };
    const cSeries = projectAssets(cp, cp.expectedReturn / 100);
    compare = { label: `保存: ${compareSc.name}`, series: cSeries };
    const cKpis = deriveKpis(cSeries, cp);
    $('scenarioMsg').textContent =
      `${compareSc.name}: ${lifeText(cKpis, cp.endAge)} ／ いまのプラン: ${lifeText(kpis, params.endAge)}`;
    $('scenarioMsg').hidden = false;
  } else {
    $('scenarioMsg').hidden = true;
  }
  // ちかい目標モードはグラフを目標に合わせた年数（5〜10年）だけに
  const chartSeries = near ? mainSeries.slice(0, windowYears + 1) : mainSeries;
  chart = renderChart($('chart'), chartSeries, params, chart, compare);
}

// 資産寿命の短い言い方（シナリオ比較用）
function lifeText(kpis, endAge) {
  if (kpis.survivesToEnd) return `${endAge}歳まで安心圏`;
  return kpis.lifetimeAge === null ? '要見直し' : `資産寿命 約${kpis.lifetimeAge}歳`;
}

// シナリオ保存・比較（仕様§9）
let compareId = null;

function renderScenarios() {
  const list = $('scenarioList');
  list.textContent = '';
  for (const sc of state.scenarios) {
    const chip = document.createElement('span');
    chip.className = `scenario-chip${sc.id === compareId ? ' active' : ''}`;
    const name = document.createElement('button');
    name.type = 'button';
    name.textContent = sc.id === compareId ? `📊 ${sc.name}` : sc.name;
    name.title = 'タップでグラフにくらべる線を表示/非表示';
    name.addEventListener('click', () => {
      compareId = compareId === sc.id ? null : sc.id;
      renderScenarios();
      update();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'x';
    del.textContent = '×';
    del.setAttribute('aria-label', `${sc.name}を削除`);
    del.addEventListener('click', () => {
      state = removeScenario(state, sc.id);
      if (compareId === sc.id) compareId = null;
      saveState(state);
      renderScenarios();
      update();
    });
    chip.append(name, del);
    list.appendChild(chip);
  }
}

function saveCurrentScenario() {
  trackEvent('scenario-save');
  const name = `積立${yenToMan(state.inputs.monthlyInvest)}万・利回り${state.inputs.expectedReturn}%`;
  const res = addScenario(state, name);
  if (res.error) {
    $('scenarioMsg').textContent = res.error;
    $('scenarioMsg').hidden = false;
    return;
  }
  state = res.state;
  saveState(state);
  compareId = res.scenario.id; // 保存した線をすぐグラフに出す
  renderScenarios();
  update();
  renderReaction({ type: 'improved', text: 'プランを保存したよ！スライダーを動かして、未来をくらべてみて🌱' }, 6000);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function init() {
  // 保存データが無い＝初めての訪問。診断バナーを見せる判定は loadState より先に取る
  let firstVisit = false;
  try {
    const isNewVisitor = !localStorage.getItem('money-vision-state');
    veiled = isNewVisitor && !localStorage.getItem('mv-revealed');
    // 診断バナーは「自分の数字で結果をめくった後」のごほうび
    // （数字を入れる前に診断すると全員同じタイプになり冷めるため）
    firstVisit = !veiled && !!localStorage.getItem('mv-revealed') && !localStorage.getItem('mv-hero-done');
  } catch {
    /* localStorage 不可なら常に非表示 */
  }
  state = loadState();
  // デプロイ直後の新旧モジュール混在キャッシュ対策: 配列フィールドを保証する
  state.events ??= [];
  state.children ??= [];
  writeForm();
  renderEvents();
  renderChildren();

  const onType = debounce(() => update({ withReaction: true }), 150);
  for (const f of FIELDS)
    $(f.id).addEventListener('input', (e) => {
      anchorEl = e.target;
      noteVeilEdit(f.id);
      onType();
    });

  // スライダーはドラッグ中も毎回即時再計算（§5、debounceなし）。
  // ただしKPI・グラフだけの軽い更新にして、重い部分は指を止めてから1回
  const heavyUpdate = debounce(() => update({ withReaction: true }), 300);
  for (const id of SLIDERS) {
    const f = fieldOf(id);
    $(`${id}Slider`).addEventListener('input', (e) => {
      anchorEl = e.target;
      noteVeilEdit(id);
      $(id).value = toUi(f, Number(e.target.value));
      update({ light: true });
      heavyUpdate();
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
  $('shareBtn').addEventListener('click', openShareDialog);
  $('jumpFormBtn').addEventListener('click', () => {
    trackEvent('jump-form');
    document.querySelector('.panel.form').scrollIntoView({ behavior: 'smooth' });
  });
  if (veiled) $('chartVeil').hidden = false;
  $('veilJumpBtn').addEventListener('click', () => {
    document.querySelector('.panel.form').scrollIntoView({ behavior: 'smooth' });
  });
  $('veilRevealBtn').addEventListener('click', () => revealResults(false));
  $('veilSampleBtn').addEventListener('click', () => revealResults(true));
  if (firstVisit) $('diagnosisHero').hidden = false;
  $('heroDiagnoseBtn').addEventListener('click', () => {
    try {
      localStorage.setItem('mv-hero-done', '1');
    } catch {
      /* 保存できなくても診断は続行 */
    }
    $('diagnosisHero').hidden = true;
    openShareDialog();
  });
  $('palBerry').addEventListener('click', () => paintShareCard('berry'));
  $('palForest').addEventListener('click', () => paintShareCard('forest'));
  $('themeBerry').addEventListener('click', () => setTheme('berry'));
  $('themeForest').addEventListener('click', () => setTheme('forest'));
  applyTheme(state.settings.themeId);
  $('shareDoBtn').addEventListener('click', doShare);
  $('shareSaveBtn').addEventListener('click', saveShareImage);
  $('shareCloseBtn').addEventListener('click', () => $('shareDialog').close());

  $('exportBtn').addEventListener('click', exportState);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importStateFile(file);
    e.target.value = ''; // 同じファイルの再選択でも change を発火させる
  });

  // スマホの資産寿命バー: KPIカードもグラフも見えていない時だけ出す
  $('lifetimeBar').addEventListener('click', () => {
    document.querySelector('.chart-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  const visible = new Map();
  const barObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      $('lifetimeBar').hidden = [...visible.values()].some(Boolean);
    },
    { threshold: 0.15 },
  );
  barObserver.observe(document.querySelector('.kpis'));
  barObserver.observe(document.querySelector('.chart-wrap'));

  // スマホでは「これからの大きな支出」を折りたたみ（CSSがスマホ幅でのみ効く）
  $('schedule').classList.add('collapsed');
  $('scheduleToggle').addEventListener('click', () => {
    if (!matchMedia('(max-width: 940px)').matches) return;
    $('schedule').classList.toggle('collapsed');
  });

  renderGoalPresets();
  $('modeLife').addEventListener('click', () => setViewMode('life'));
  $('modeNear').addEventListener('click', () => setViewMode('near'));
  syncModeButtons();

  renderStamps();
  // 月が変わって最初に開いたときだけ、先月のスタンプをねぎらう
  const recap = takeMonthlyRecap();
  if (recap) {
    $('stampQuote').textContent = recap;
    $('stampQuote').hidden = false;
  }
  $('stampBtn').addEventListener('click', pressStamp);
  $('recordBtn').addEventListener('click', openRecordDialog);
  // ライフプラン表も、数字を入れる前はお楽しみに取っておく
  $('lifeplanBtn').addEventListener('click', (e) => {
    if (blockWhileVeiled('ライフプラン表は、数字を入れてからのお楽しみ📄')) {
      e.preventDefault();
      trackEvent('lifeplan-blocked');
    } else {
      trackEvent('lifeplan');
    }
  });
  $('recordDoBtn').addEventListener('click', doRecord);
  $('recordCancelBtn').addEventListener('click', () => $('recordDialog').close());
  $('recordDoneBtn').addEventListener('click', () => $('recordDialog').close());
  $('saveScenarioBtn').addEventListener('click', saveCurrentScenario);
  renderScenarios();

  // きょうのよみもの: ローカル日付基準の日替わりで1本（同じ日は誰でも同じ記事）
  if (COLUMNS.length > 0) {
    const now = new Date();
    const dayKey = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate();
    const pick = COLUMNS[dayKey % COLUMNS.length];
    $('dailyReading').href = pick.href;
    $('dailyReadingTitle').textContent = pick.title;
    $('dailyReadingDesc').textContent = pick.desc;
    $('dailyReading').hidden = false;
  }

  // お知らせ（最新3件）と、noteの記事リンク
  for (const u of UPDATES.slice(0, 3)) {
    const li = document.createElement('li');
    const [, m, d] = u.date.split('-');
    li.textContent = `${Number(m)}/${Number(d)} ${u.text}`;
    $('updatesList').appendChild(li);
  }
  for (const a of NOTE_ARTICLES) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = a.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `${a.title}（note）`;
    li.appendChild(link);
    $('readingList').appendChild(li);
  }

  if (FEEDBACK_URL) {
    $('feedbackLink').href = FEEDBACK_URL;
    $('feedbackRow').hidden = false;
  }

  // ホーム画面追加のヒント: 2回目以降の訪問・スマホ・ブラウザ表示のときだけ
  let pwaHintDone = false;
  try {
    pwaHintDone = !!localStorage.getItem('mv-pwa-hint-done');
  } catch {
    /* ignore */
  }
  const inStandalone = matchMedia('(display-mode: standalone)').matches;
  const onMobile = matchMedia('(max-width: 940px)').matches;
  if (!firstVisit && onMobile && !inStandalone && !pwaHintDone) $('pwaHint').hidden = false;
  $('pwaHintClose').addEventListener('click', () => {
    try {
      localStorage.setItem('mv-pwa-hint-done', '1');
    } catch {
      /* ignore */
    }
    $('pwaHint').hidden = true;
  });

  // 「前回とくらべて」: 先月以前の記録を、update() が今月分を書く前に読んでおく
  const prevSnap = previousSnapshot(loadHistory());

  update();
  renderTrack();

  // 声かけの優先順: 前回との比較 > 季節のひとこと
  const welcome = prevSnap && prevKpis ? buildWelcomeBack(prevSnap, prevKpis) : null;
  const seasonal = seasonalMessage();
  if (welcome) renderReaction(welcome, 8000);
  else if (seasonal) renderReaction({ type: 'improved', ...seasonal }, 8000);

  // 図鑑ページの「診断する」リンクから来たら、すぐ結果を見せる
  // （リロードのたびに再表示されないよう、開いたらURLからは消す）
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('diagnose')) {
    openShareDialog();
    searchParams.delete('diagnose');
    const rest = searchParams.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  }
  // コラム等の「◯◯モードで計算」リンク（?goal=first100 など）
  const goalId = new URLSearchParams(location.search).get('goal');
  const goalPreset = GOAL_PRESETS.find((g) => g.id === goalId);
  if (goalPreset) applyGoalPreset(goalPreset);
}

// 感想・要望フォームのURL（用意できたらここに貼るだけでフッターに現れる）
const FEEDBACK_URL = '';

// きせかえ（🍓ベリー/🌲フォレスト）。配色はCSS変数、選択は settings.themeId に保存
function applyTheme(id) {
  const forest = id === 'forest';
  document.documentElement.dataset.theme = forest ? 'forest' : '';
  $('themeBerry').classList.toggle('active', !forest);
  $('themeForest').classList.toggle('active', forest);
}

function setTheme(id) {
  state.settings.themeId = id;
  saveState(state);
  applyTheme(id);
  trackEvent(`theme-${id}`);
  update(); // グラフの塗り色をテーマに追従させる
}

// 初回訪問のベール（結果を自分でめくる演出）
let veiled = false;
const veilEdited = new Set();

function noteVeilEdit(fieldId) {
  if (!veiled) return;
  veilEdited.add(fieldId);
  if (veilEdited.size >= 2) {
    $('veilJumpBtn').hidden = true;
    $('veilRevealBtn').hidden = false;
  }
}

function revealResults(fromSample = false) {
  if (!veiled) return;
  veiled = false;
  try {
    localStorage.setItem('mv-revealed', '1');
  } catch {
    /* ignore */
  }
  trackEvent(fromSample ? 'veil-sample' : 'veil-reveal');
  const veil = $('chartVeil');
  veil.classList.add('lifting');
  setTimeout(() => {
    veil.hidden = true;
  }, 450);
  update();
  if (!fromSample) {
    try {
      if (!localStorage.getItem('mv-hero-done')) $('diagnosisHero').hidden = false;
    } catch {
      /* ignore */
    }
  }
  document.querySelector('.chart-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  renderReaction(
    {
      type: 'improved',
      text: fromSample
        ? 'これはサンプルの未来だよ。数字をあなたのものにすると、自分事になるよ🌱'
        : 'はじめまして！これがあなたの未来の形だよ🌱 スライダーで動かしてみて',
    },
    9000,
  );
}

// 匿名イベント計測: 何回使われたかの回数だけをGoatCounterに送る。
// 入力値・診断結果などの中身は一切送らない（フッターの明記どおり）
function trackEvent(name) {
  try {
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  } catch {
    /* 解析が使えなくても機能には影響させない */
  }
}

// ちかい目標モード（若い層向け）: プリセット＋目標連動の5〜10年スケール表示
const GOAL_PRESETS = [
  { id: 'first100', label: 'はじめの100万', man: 100 },
  { id: 'hitori', label: '一人暮らし資金', man: 50 },
  { id: 'tabi', label: '旅・留学', man: 80 },
  { id: 'kekkon', label: '結婚・将来資金', man: 300 },
];

function syncModeButtons() {
  const near = state.settings.viewMode === 'near';
  $('modeNear').classList.toggle('active', near);
  $('modeLife').classList.toggle('active', !near);
}

function setViewMode(mode) {
  state.settings.viewMode = mode;
  saveState(state);
  syncModeButtons();
  update();
}

function applyGoalPreset(preset) {
  trackEvent(`goal-${preset.id}`);
  $('targetAmount').value = preset.man;
  setViewMode('near');
}

function renderGoalPresets() {
  const box = $('goalPresets');
  for (const preset of GOAL_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = preset.label;
    b.addEventListener('click', () => applyGoalPreset(preset));
    box.appendChild(b);
  }
}

// ログインスタンプ帳: 1日1回自分で押す。連続日数では縛らない（月間集計のみ）
function renderStamps({ justAdded = false } = {}) {
  const now = new Date();
  const days = stampsThisMonth(globalThis.localStorage, now);
  $('stampCount').textContent = days.length
    ? `${now.getMonth() + 1}月 ${days.length}個`
    : `${now.getMonth() + 1}月`;
  const row = $('stampsRow');
  row.textContent = '';
  for (const day of days) {
    const img = document.createElement('img');
    img.src = stampCharFor(day);
    img.alt = '';
    img.title = `${day}日`;
    img.className = 'stamp-icon';
    row.appendChild(img);
  }
  if (justAdded && row.lastChild) row.lastChild.classList.add('pop');
  const stampedToday = days.includes(now.getDate());
  const btn = $('stampBtn');
  btn.disabled = stampedToday;
  btn.innerHTML = icoUse('i-flower') + (stampedToday ? '今日のスタンプは押したよ' : '今日のスタンプを押す');
}

function pressStamp() {
  const now = new Date();
  const res = stampToday(globalThis.localStorage, now);
  if (!res.added) return;
  trackEvent('stamp');
  renderStamps({ justAdded: true });
  // ごほうび: 節目なら特別メッセージ、ふだんは日替わりひとこと
  const quote = $('stampQuote');
  quote.textContent = milestoneMessage(res.count) ?? dailyQuote(now);
  quote.hidden = false;
}

// 今月の資産チェック: パネルは状況表示だけ。入力→記録→ごほうびはダイアログで完結
function renderTrack() {
  const ymNow = monthOf();
  const hist = loadHistory();
  const cur = hist.find((s) => s.ym === ymNow);
  const recorded = cur?.recordedAsset != null;
  const streak = recordStreak(hist, ymNow);
  const status = $('trackStatus');
  if (recorded) {
    const delta = buildRecordDelta(latestRecordBefore(hist, ymNow), cur);
    let text = streak >= 2 ? `✅ 今月はチェックずみ（${streak}ヶ月連続🌱）` : '✅ 今月はチェックずみ';
    if (delta) text += ` — ${delta.text}`;
    status.textContent = text;
    $('recordBtn').innerHTML = icoUse('i-note') + '記録を見る・直す';
  } else {
    status.textContent = latestRecordBefore(hist, ymNow)
      ? 'まだ今月のチェックがないよ。1分で終わります'
      : '月に1回きろくすると、「ふえた・減った」が見えるようになるよ';
    $('recordBtn').innerHTML = icoUse('i-note') + '今月の資産をチェック';
  }
}

function openRecordDialog() {
  trackEvent('record-open');
  const ymNow = monthOf();
  const hist = loadHistory();
  const prev = latestRecordBefore(hist, ymNow);
  const cur = hist.find((s) => s.ym === ymNow);
  $('recordAsset').value = yenToMan(state.inputs.totalAsset);
  const note = $('recordPrevNote');
  if (cur?.recordedAsset != null) {
    note.textContent = `今月の記録: ${yenToMan(cur.recordedAsset)}万円（きろくし直すと上書きされます）`;
  } else if (prev) {
    note.textContent = `前回（${Number(prev.ym.split('-')[1])}月）の記録: ${yenToMan(prev.recordedAsset)}万円`;
  } else {
    note.textContent = 'はじめてのきろく。来月から「ふえた・減った」が見えるようになるよ';
  }
  $('recordFormZone').hidden = false;
  $('recordResultZone').hidden = true;
  $('recordDialog').showModal();
}

function doRecord() {
  const man = Number($('recordAsset').value);
  if (!Number.isFinite(man) || man < 0) return;
  trackEvent('record');
  const ymNow = monthOf();
  const prev = latestRecordBefore(loadHistory(), ymNow);

  // 「現在の資産」の入力欄にも反映してから再計算（二度手間をなくす）
  $('totalAsset').value = man;
  update();

  const params = paramsOf(state);
  const series = projectAssets(params, params.expectedReturn / 100);
  markRecorded(globalThis.localStorage, {
    totalAsset: params.totalAsset,
    projected1y: series[1]?.assets ?? params.totalAsset,
  });
  renderTrack();

  // ごほうび画面: 前回比 → 連続 → 推移
  const hist = loadHistory();
  const cur = hist.find((s) => s.ym === ymNow);
  const delta = buildRecordDelta(prev, cur);
  const streak = recordStreak(hist, ymNow);
  $('recordChar').src = delta?.type === 'gentle' ? 'assets/piyo-good.png' : 'assets/piyo-yatta.png';
  const lines = [delta ? delta.text : 'きろくしたよ！来月もいっしょに見よう🌱'];
  // 答え合わせ: 約1年前に記録した「計画上の1年後資産」があれば実績と見くらべる
  const yearReview = buildYearReview(hist, ymNow);
  if (yearReview) lines.push(yearReview.text);
  if (streak >= 2) lines.push(`${streak}ヶ月連続でチェック中🌱`);
  const stampCount = stampsThisMonth().length;
  if (stampCount >= 5) lines.push(`今月は${stampCount}回も会えたね🌸`);
  $('recordResultText').textContent = lines.join('\n');
  const recs = hist.filter((s) => s.recordedAsset != null).slice(-6);
  const trend = $('recordTrend');
  if (recs.length >= 2) {
    // 記録が年をまたいだら「25年7月」表記にして、去年の7月と今年の7月を見分けられるように
    const multiYear = new Set(recs.map((r) => r.ym.slice(0, 4))).size > 1;
    trend.textContent =
      recs.map((r) => `${ymLabel(r.ym, multiYear)} ${yenToMan(r.recordedAsset)}`).join(' → ') + '（万円）';
    trend.hidden = false;
  } else {
    trend.hidden = true;
  }
  $('recordFormZone').hidden = true;
  $('recordResultZone').hidden = false;
}

// データの引っ越し（書き出し/読み込み。ファイルは端末内で完結）
let backupMsgTimer = null;

function showBackupMsg(text) {
  const el = $('backupMsg');
  clearTimeout(backupMsgTimer);
  el.textContent = text;
  el.hidden = false;
  backupMsgTimer = setTimeout(() => {
    el.hidden = true;
  }, 8000);
}

function exportState() {
  trackEvent('backup-export');
  // v2形式: 入力設定に加えて、資産チェック履歴とスタンプも一緒に引っ越しできるように
  const payload = { app: 'miratame', version: 2, state, history: loadHistory(), stamps: loadStamps() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ミラため設定.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showBackupMsg('書き出しました。機種変更のときは新しい端末でこのファイルを読み込んでね');
}

function importStateFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(reader.result);
      // v2形式（state+履歴+スタンプ）と旧形式（stateのみ）の両対応
      const st = p?.state?.inputs ? p.state : p;
      if (!st || typeof st !== 'object' || !st.inputs) throw new Error('not a backup');
      state = normalizeState(st);
      saveState(state);
      if (p.history) importHistory(p.history);
      if (p.stamps) importStamps(p.stamps);
      writeForm();
      renderEvents();
      renderChildren();
      update();
      renderTrack();
      renderStamps();
      trackEvent('backup-import');
      showBackupMsg('読み込みました！グラフに反映されています');
    } catch {
      showBackupMsg('このファイルは読み込めませんでした。「設定を書き出す」で作ったファイルを選んでください');
    }
  };
  reader.readAsText(file);
}

// あなたの4軸: メーター（実数と境目）。数字の見える化のみで、
// 「こうすれば別タイプ」の類いは出さない。カード画像には含めない
function renderAxisMeters(params) {
  const details = buildAxisDetails(params);
  const list = $('shareAxesList');
  list.textContent = '';
  for (const a of details) {
    const row = document.createElement('div');
    row.className = 'axis-row';
    const head = document.createElement('div');
    head.className = 'axis-head';
    const label = document.createElement('span');
    label.className = 'axis-label';
    label.textContent = a.label;
    const side = document.createElement('span');
    side.className = 'axis-side';
    side.textContent = a.sideLabel;
    head.append(label, side);
    row.appendChild(head);
    if (a.missing) {
      const note = document.createElement('p');
      note.className = 'axis-note';
      note.textContent = a.missing;
      row.appendChild(note);
    } else {
      const gauge = document.createElement('div');
      gauge.className = 'axis-gauge';
      const fill = document.createElement('div');
      fill.className = 'axis-fill';
      fill.style.width = `${Math.round(a.ratio * 100)}%`;
      const mark = document.createElement('span');
      mark.className = 'axis-mark';
      gauge.append(fill, mark);
      const note = document.createElement('p');
      note.className = 'axis-note';
      note.textContent = `${a.valueText}（${a.thresholdText}）`;
      row.append(gauge, note);
    }
    list.appendChild(row);
  }
  $('shareAxes').hidden = false;
}

// 診断→ポップアップで結果カードを見せる→そこからシェア/保存
let currentShare = null; // { blob, file, text, url }

// ベール中のお預け演出（診断・ライフプラン表で共用）。ブロックしたら true
function blockWhileVeiled(message) {
  if (!veiled) return false;
  const veil = $('chartVeil');
  const title = veil.querySelector('.veil-title');
  const original = title.innerHTML;
  // お預けの間だけ、ぴよもびっくり顔に
  const veilImg = veil.querySelector('img');
  const originalImg = veilImg?.src;
  if (veilImg) veilImg.src = 'assets/piyo-surprised.png';
  title.textContent = message;
  veil.classList.add('veil-shake');
  veil.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    veil.classList.remove('veil-shake');
    title.innerHTML = original;
    if (veilImg && originalImg) veilImg.src = originalImg;
  }, 2600);
  return true;
}

async function openShareDialog() {
  // ベール中（数字を入れる前）は診断もお楽しみに取っておく
  // （初期値のままだと全員同じタイプになってしまうため）
  if (blockWhileVeiled('診断は、数字を入れてからのお楽しみ🌰')) {
    trackEvent('diagnosis-blocked');
    return;
  }
  trackEvent('diagnosis');
  const type = judgeType(paramsOf(state));
  trackEvent(`type-${type.code}`); // タイプ分布の計測（しきい値チューニング用）
  const text = buildShareText(type);
  const url = 'https://kyuusaku16-a11y.github.io/miratame/';

  currentShare = { text, url, code: type.code, type };
  $('shareTsuyomi').textContent = type.tsuyomi;
  $('shareNobashi').textContent = type.nobashi;
  renderAxisMeters(paramsOf(state));
  // 詳細説明文（v3ロング版）は診断を開いたときだけ読み込む（初期ロードを増やさない）
  try {
    const { DESCRIPTIONS } = await import('./descriptions.js');
    const paras = DESCRIPTIONS[type.code] ?? [];
    const more = $('shareDescMore');
    more.querySelectorAll('p').forEach((p) => p.remove());
    if (paras.length) {
      for (const text of paras) {
        const p = document.createElement('p');
        p.textContent = text;
        more.appendChild(p);
      }
      more.open = false;
      $('shareDesc').hidden = false;
    } else {
      $('shareDesc').hidden = true;
    }
  } catch {
    $('shareDesc').hidden = true; // 読み込みに失敗しても診断自体は続行
  }
  // カードの色は現在のテーマに合わせて開く（ダイアログ内で切替可）
  await paintShareCard(state.settings.themeId === 'forest' ? 'forest' : 'berry');
  $('shareDialog').showModal();
}

// モバイルはネイティブ共有シート、PCはX投稿画面（画像は「保存」ボタンで）
async function doShare() {
  if (!currentShare) return;
  trackEvent('share');
  if (currentShare.code) trackEvent(`type-share-${currentShare.code}`);
  const { file, text, url } = currentShare;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      // url を独立フィールドで渡すと、共有先アプリでリンクとして扱われる
      await navigator.share({ files: [file], text, url });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return; // ユーザーがキャンセル
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      } catch {
        /* PC用フォールバックへ */
      }
    }
  }
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    '_blank',
    'noopener',
  );
}

// カードを指定パレットで描き直し、シェア用blobも差し替える
async function paintShareCard(palette) {
  if (!currentShare?.type) return;
  currentShare.palette = palette;
  $('palBerry').classList.toggle('active', palette === 'berry');
  $('palForest').classList.toggle('active', palette === 'forest');
  const canvas = await renderShareCard(currentShare.type, palette);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  currentShare.blob = blob;
  currentShare.file = new File([blob], 'miratame.png', { type: 'image/png' });
  $('shareCardImg').src = canvas.toDataURL('image/png');
}

function saveShareImage() {
  if (!currentShare) return;
  trackEvent('share-save');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(currentShare.blob);
  a.download = 'miratame.png';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('DOMContentLoaded', init);
