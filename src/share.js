// お金の性格診断（16タイプ）とシェアカード（1200×630）の生成。
// 4軸（お金の流れ×運用姿勢×進み方×夢の大きさ）→ 動物4種×性格4種 = 16タイプ。
// 方針: 金額は一切載せない・全タイプ褒める（§1: 責めない）・
// 「私は◯◯型」と名乗りたくなる固有の名言をタイプごとに持つ。

// 動物 = お金の流れ × 運用姿勢
export const ANIMALS = {
  squirrel: { id: 'squirrel', label: 'リス', flow: 'ためる', grow: 'そだてる' },   // どんぐりを埋めて森を育てる
  hamster: { id: 'hamster', label: 'ハムスター', flow: 'ためる', grow: 'まもる' }, // ほお袋にコツコツ
  bee: { id: 'bee', label: 'ミツバチ', flow: 'まわす', grow: 'そだてる' },         // 回して蜜を生む
  capybara: { id: 'capybara', label: 'カピバラ', flow: 'まわす', grow: 'まもる' }, // 今を満喫する余裕
};

// 性格 = 進み方 × 夢の大きさ
export const PERSONAS = {
  strategist: { id: 'strategist', label: '軍師', plan: '地図', dream: '大志' },
  gardener: { id: 'gardener', label: '庭師', plan: '地図', dream: '満ち足り' },
  adventurer: { id: 'adventurer', label: '冒険家', plan: 'コンパス', dream: '大志' },
  poet: { id: 'poet', label: '詩人', plan: 'コンパス', dream: '満ち足り' },
};

// タイプ別の名言（16種・すべて前向き）
const QUOTES = {
  軍師リス: 'どんぐり1つにも作戦がある。森の設計図は、もう頭の中。',
  庭師リス: '埋めたどんぐりに毎日水をやる。急がない、でも止まらない。',
  冒険家リス: '埋めた場所を忘れても大丈夫。いつか森になってるから。',
  詩人リス: 'どんぐりが芽を出す音を、聞いたことがある気がする。',
  軍師ハムスター: 'ほお袋の中身は全部把握済み。備えあれば、憂いなし。',
  庭師ハムスター: '今日もコツコツ、ほお袋に一粒。積み重ねがいちばん強い。',
  冒険家ハムスター: 'ほお袋いっぱいの安心を持って、どこへでも行ける。',
  詩人ハムスター: 'たくわえは、未来の自分への手紙みたいなもの。',
  軍師ミツバチ: 'どの花にいつ行くか、飛ぶ前に決めてる。効率は羽の一部。',
  庭師ミツバチ: '花から花へ、ちょうどいいペースで。蜜は焦らず貯まる。',
  冒険家ミツバチ: '知らない花畑ほど、いい蜜がある。今日も初めての道へ。',
  詩人ミツバチ: '働いているつもりはない。花が好きなだけ。',
  軍師カピバラ: 'のんびりして見えて、温泉の予約は3ヶ月先まで完璧。',
  庭師カピバラ: 'あわてない、あわてない。育つものは、ちゃんと育つ。',
  冒険家カピバラ: '流されてるんじゃない。流れを選んでるんだ。',
  詩人カピバラ: 'お湯につかって考えた。足るを知る者は、あったかい。',
};

// 専用アート到着までのプレースホルダー（assets/types/ に置けば自動で置き換わる）
const PLACEHOLDER_IMG = {
  squirrel: 'assets/bear-watering.png',
  hamster: 'assets/bear-thumbs.png',
  bee: 'assets/bird-pink.png',
  capybara: 'assets/bear.png',
};

// 4軸の判定（入力とKPIから。すべて実データ由来）
export function deriveAxes(kpis, params) {
  const income = params.annualIncome;
  const surplus = income - params.annualExpense;
  const savingsRate = income > 0 ? surplus / income : 1; // 収入0(FIRE)は蓄え型とみなす
  const investShare = surplus > 0 ? (params.monthlyInvest * 12) / surplus : 0;
  const planned =
    (params.children?.length ?? 0) + (params.events?.length ?? 0) + (params.loanMonthly > 0 ? 1 : 0);
  const bigDream =
    income > 0 ? params.targetAmount >= income * 15 : params.targetAmount >= 100000000;

  return {
    flow: savingsRate >= 0.2 ? 'ためる' : 'まわす',
    grow: investShare >= 0.5 || params.expectedReturn >= 6 ? 'そだてる' : 'まもる',
    plan: planned > 0 ? '地図' : 'コンパス',
    dream: bigDream ? '大志' : '満ち足り',
  };
}

// 16タイプ診断
export function diagnoseType(kpis, params) {
  const axes = deriveAxes(kpis, params);
  const animal = Object.values(ANIMALS).find((a) => a.flow === axes.flow && a.grow === axes.grow);
  const persona = Object.values(PERSONAS).find((p) => p.plan === axes.plan && p.dream === axes.dream);
  const name = `${persona.label}${animal.label}`;
  return {
    animal,
    persona,
    name,
    tags: [axes.flow, axes.grow, axes.plan, axes.dream],
    quote: QUOTES[name],
    img: `assets/types/${animal.id}-${persona.id}.png`,
    placeholder: PLACEHOLDER_IMG[animal.id],
  };
}

// シェア文（金額なし・タイプ名と4タグ入り）
export function buildShareText(kpis, params) {
  const t = diagnoseType(kpis, params);
  return `私のお金の性格は【${t.name}】でした🌰（${t.tags.join('×')}）あなたは16タイプのどれ？ #マネービジョン #お金の性格診断`;
}

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';

function drawTag(ctx, text, cx, y) {
  ctx.font = `700 26px ${FONT}`;
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = '#fdeef1';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 26, w, 44, 22);
  ctx.fill();
  ctx.strokeStyle = '#f0a3b4';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#c96079';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 4);
  return w;
}

// 診断カード（1200×630）
export async function renderShareCard(kpis, params) {
  const type = diagnoseType(kpis, params);
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await document.fonts.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fbe6e4');
  bg.addColorStop(1, '#fdf3f1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(56, 56, W - 112, H - 168, 32);
  ctx.fill();
  ctx.strokeStyle = '#f5c7d2';
  ctx.lineWidth = 3;
  ctx.stroke();

  const textCenterX = 430;
  ctx.textAlign = 'center';

  ctx.fillStyle = '#c96079';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('わたしのお金の性格', textCenterX, 150);

  ctx.fillStyle = '#5c4a44';
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(`【${type.name}】`, textCenterX, 252);

  // 4タグ（中央寄せで横並び）
  ctx.font = `700 26px ${FONT}`;
  const gaps = 14;
  const widths = type.tags.map((t) => ctx.measureText(t).width + 36);
  const totalW = widths.reduce((a, b) => a + b, 0) + gaps * 3;
  let x = textCenterX - totalW / 2;
  for (let i = 0; i < type.tags.length; i++) {
    drawTag(ctx, type.tags[i], x + widths[i] / 2, 316);
    x += widths[i] + gaps;
  }

  // 名言（「。」で2行に割る）
  ctx.fillStyle = '#8a6f66';
  ctx.font = `500 30px ${FONT}`;
  const parts = type.quote.split('。').filter(Boolean);
  const line1 = `${parts[0]}。`;
  const line2 = parts.length > 1 ? `${parts.slice(1).join('。')}。` : '';
  ctx.fillText(line1, textCenterX, 396);
  if (line2) ctx.fillText(line2, textCenterX, 442);

  ctx.fillStyle = '#c96079';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText('あなたは16タイプのどれ？', textCenterX, 500);

  // タイプのキャラ（専用アート優先・なければプレースホルダー）
  try {
    let img;
    try {
      img = await loadImg(type.img);
    } catch {
      img = await loadImg(type.placeholder);
    }
    const box = { x: 810, y: 120, w: 320, h: 330 };
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  } catch {
    /* テキストだけでも成立 */
  }

  ctx.fillStyle = '#a2887f';
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('マネービジョン — 未来の資産を、見える化する。', W / 2, H - 62);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('kyuusaku16-a11y.github.io/money-vision', W / 2, H - 26);

  return canvas;
}
