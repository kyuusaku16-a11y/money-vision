// app/src/chart.js
// Chart.js rendering wrapper.
// Uses the browser global `Chart` (loaded via CDN in index.html — no import needed).

/* global Chart */

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
 * @param {{ targetAmount: number, retireAge: number, expectedReturn: number }} params
 * @param {Chart|null|undefined} existingChart — previous Chart instance to destroy first
 * @returns {Chart}
 */
export function renderChart(canvas, mainSeries, params, existingChart) {
  if (existingChart) existingChart.destroy();

  const labels  = mainSeries.map((p) => p.age);
  const mainData = mainSeries.map((p) => p.assets);

  // --- highlighted point at retireAge ---
  const retirementIdx = mainSeries.findIndex((p) => p.age === params.retireAge);
  const pointRadius = mainSeries.map((_, i) => (i === retirementIdx ? 7 : 0));
  const pointBg     = mainSeries.map((_, i) => (i === retirementIdx ? '#f59e0b' : 'transparent'));
  const pointBorder = mainSeries.map((_, i) => (i === retirementIdx ? '#fff'    : 'transparent'));

  // --- target horizontal line (constant across all labels) ---
  const targetData = mainSeries.map(() => params.targetAmount);

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        // 1. Main line — thick, segment-colored green (gain) / red (loss)
        {
          label:                `あなたのプラン（利回り${params.expectedReturn}%）`,
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
              ctx.p1.parsed.y >= ctx.p0.parsed.y ? '#10b981' : '#ef4444',
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
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtYen(ctx.parsed.y)}円`,
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
