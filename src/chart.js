// app/src/chart.js
// Chart.js rendering wrapper.
// Uses the browser global `Chart` (loaded via CDN in index.html — no import needed).

/* global Chart */

import { educationCostAt } from './calc.js';

// 目標達成バッジの喜ぶ2人（読み込み完了後の再描画から表示される）
const JOY_IMG = new Image();
JOY_IMG.src = 'assets/pair-joy.png';

/**
 * Format a yen value as 万 / 億 label (no trailing "円").
 * @param {number} yen
 * @returns {string}
 */
function fmtYen(yen) {
  if (yen >= 1_0000_0000) return `${(yen / 1_0000_0000).toFixed(1)}億`;
  if (yen >= 1_0000)      return `${Math.round(yen / 1_0000)}万`;
  return String(yen);
}

/**
 * Render (or re-render) the asset projection chart onto `canvas`.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ age: number, assets: number }[]} mainSeries  — user's projected series
 * @param {{ targetAmount: number, retireAge: number, expectedReturn: number, events?: Array<{age: number, label?: string, amount: number}> }} params
 * @param {Chart|null|undefined} existingChart — previous Chart instance to destroy first
 * @returns {Chart}
 */
export function renderChart(canvas, mainSeries, params, existingChart) {
  if (existingChart) existingChart.destroy();

  const labels  = mainSeries.map((p) => p.age);
  const mainData = mainSeries.map((p) => p.assets);

  // --- highlighted points: retirement (orange) + life events (green) ---
  const retirementIdx = mainSeries.findIndex((p) => p.age === params.retireAge);
  const eventAges = new Set(
    (params.events ?? [])
      .filter((e) => e.age > mainSeries[0].age && e.age <= mainSeries[mainSeries.length - 1].age)
      .map((e) => e.age),
  );
  // --- goal-reached point: first year assets touch the target ---
  const goalIdx = mainSeries.findIndex((p) => p.assets >= params.targetAmount);

  const pointRadius = mainSeries.map((p, i) =>
    i === retirementIdx ? 7 : i === goalIdx ? 6 : eventAges.has(p.age) ? 5 : 0);
  const pointBg = mainSeries.map((p, i) =>
    i === retirementIdx ? '#f59e0b' : i === goalIdx ? '#ffd97d' : eventAges.has(p.age) ? '#a5cbe8' : 'transparent');
  const pointBorder = mainSeries.map((p, i) =>
    i === retirementIdx || i === goalIdx || eventAges.has(p.age) ? '#fff' : 'transparent');

  // --- target horizontal line (constant across all labels) ---
  const targetData = mainSeries.map(() => params.targetAmount);

  // 目標に初めて届く年の上に、喜ぶ2人と「🎉 目標達成！」を描くインラインプラグイン
  const goalBadge = {
    id: 'goalBadge',
    afterDatasetsDraw(chart) {
      if (goalIdx < 0) return;
      const pt = chart.getDatasetMeta(0).data[goalIdx];
      if (!pt) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.font = 'bold 13px "Zen Maru Gothic", "Hiragino Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c96079';
      const x = Math.min(Math.max(pt.x, chartArea.left + 60), chartArea.right - 60);
      const y = Math.max(pt.y - 16, chartArea.top + 58);
      if (JOY_IMG.complete && JOY_IMG.naturalWidth > 0) {
        ctx.drawImage(JOY_IMG, x - 39, y - 60, 78, 44);
      }
      ctx.fillText('🎉 目標達成！', x, y);
      ctx.restore();
    },
  };

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        // 1. Main line — thick, segment-colored green (gain) / red (loss)
        {
          label:                `現在のプラン（利回り${params.expectedReturn}%）`,
          data:                 mainData,
          borderWidth:          3,
          pointRadius,
          pointBackgroundColor: pointBg,
          pointBorderColor:     pointBorder,
          pointBorderWidth:     2,
          pointHoverRadius:     7,
          fill:                 false,
          tension:              0.3,
          segment: {
            borderColor: (ctx) =>
              ctx.p1.parsed.y >= ctx.p0.parsed.y ? '#ec8fa3' : '#c9a086',
          },
        },
        // 2. Target dashed line
        {
          label:       `目標 ${fmtYen(params.targetAmount)}円`,
          data:        targetData,
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderDash:  [8, 4],
          pointRadius: 0,
          fill:        false,
          tension:     0,
        },
      ],
    },
    plugins: [goalBadge],
    options: {
      animation: { duration: 200 },
      responsive:  true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels:   { boxWidth: 16, font: { size: 12 } },
        },
        tooltip: {
          // 年齢と資産を主役に、支出の内訳だけを添える（目標・利回りは出さない）
          displayColors: false,
          filter: (item) => item.datasetIndex === 0,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) =>
              items.length ? [`${items[0].label}歳`, `資産 ${fmtYen(items[0].parsed.y)}円`] : '',
            label: (ctx) => {
              const age = Number(ctx.label);
              const startAge = mainSeries[0].age;
              const notes = (params.events ?? [])
                .filter((e) => e.age === age && e.age > startAge)
                .map((e) => `▼ ${e.label || 'イベント'} −${fmtYen(e.amount)}円`);
              if (age > startAge) {
                (params.children ?? []).forEach((c, i) => {
                  const childAge = c.age + (age - startAge);
                  const delta = educationCostAt(childAge) - educationCostAt(c.age);
                  if (delta !== 0) {
                    const name = c.name || `子ども${i + 1}`;
                    const who = childAge >= 22 ? `${name}: 独立後` : `${name}: ${childAge}歳`;
                    notes.push(`▼ 教育費 ${delta > 0 ? '+' : '−'}${fmtYen(Math.abs(delta))}円/年（${who}）`);
                  }
                });
              }
              return notes;
            },
          },
        },
      },
      scales: {
        x: {
          title:  { display: true, text: '年齢' },
          ticks:  { maxTicksLimit: 12 },
        },
        y: {
          title: { display: true, text: '資産額' },
          ticks: {
            callback: (value) => fmtYen(value),
          },
        },
      },
    },
  });
}
