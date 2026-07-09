// ミラため性格診断（16タイプ・入力値ベース）とシェアカード（1200×630）。
// 仕様: miratame-16types-spec.md（2026-07-09）
// - 質問なし。シミュレーターの入力値のみから4軸を自動判定（実データなので正直）
// - 全タイプ前向き・のばしどころは提案の口調・金額推奨や銘柄名は出さない
// - 入力を変えるとタイプが変わるのは機能（タイプ進化=再訪の動機）

// しきい値は1箇所に集約（リリース後、分布を見て1行で調整できるように）
export const THRESHOLDS = {
  savingsRate: 0.2, // 軸1 ため力: 貯蓄率
  investRatio: 0.3, // 軸2 そだて方: 投資比率
  bufferMonths: 6, // 軸3 そなえ: 生活防衛月数
  commitRate: 0.5, // 軸4 しこみ: 積立強度
};

// 軸の値ラベル（カードのタグ表示用）
const AXIS_LABELS = {
  C: 'コツコツ',
  Y: 'ゆとり',
  G: 'そだてる',
  M: 'まもる',
  S: 'しっかり備え',
  L: 'みがる',
  F: '先どり',
  N: 'いま満喫',
};

// 16タイプ定義（イラストは新規制作中。それまでは絵文字が代役）
const TYPES = {
  CGSF: {
    name: '森をつくるビーバー',
    emoji: '🦫',
    hitokoto: '未来の森を、設計図つきで育てる建築家。',
    tsuyomi: '貯める・育てる・備える・先どり、全部そろった安定感。資産寿命が最も伸びやすい型。',
    nobashi: '完璧ゆえに頑張りすぎ注意。「使う楽しみ」も予算に入れると長続きする。',
  },
  CGSN: {
    name: '実りわけのリス',
    emoji: '🐿️',
    hitokoto: 'どんぐりを蓄えながら、今日のぶんもちゃんと味わう。',
    tsuyomi: '貯めて育てて備えたうえで、余りは今の暮らしに。メリハリの達人。',
    nobashi: '余剰の一部だけ自動積立にすると、迷わず未来にも回せる。',
  },
  CGLF: {
    name: '風にのるワシ',
    emoji: '🦅',
    hitokoto: '身軽な装備で、高く遠くへ飛ぶ。',
    tsuyomi: '現金を寝かせず効率よく増やす攻めの飛行力。',
    nobashi: '急な向かい風（臨時出費）用に、現金のとまり木を数ヶ月分そなえると安心。',
  },
  CGLN: {
    name: '好奇心のキツネ',
    emoji: '🦊',
    hitokoto: '面白そうな方へ、貯めた力で踏み込める。',
    tsuyomi: '貯める力と攻める感覚の両立。チャンスに強い。',
    nobashi: '勘の良さに「自動積立」という保険をかけると無敵に近づく。',
  },
  CMSF: {
    name: '石橋をわたるカメ',
    emoji: '🐢',
    hitokoto: 'ゆっくり、でも絶対に進む。',
    tsuyomi: '現金の厚い甲羅と先どり貯金。何が起きても崩れない。',
    nobashi: '備えが十分なら、余剰の一部をつみたて投資に。甲羅は軽くならない。',
  },
  CMSN: {
    name: '冬支度のクマ',
    emoji: '🐻',
    hitokoto: 'たっぷり蓄えて、今の季節もちゃんと楽しむ。',
    tsuyomi: '厚い備えと生活の満足度を両立できる懐の深さ。',
    nobashi: '蓄えの置き場所を見直すと、蓄えが自分で育ち始める。',
  },
  CMLF: {
    name: 'はたらきもののアリ',
    emoji: '🐜',
    hitokoto: '毎日コツコツ、列を乱さず未来へ運ぶ。',
    tsuyomi: '先どりの積立習慣。仕組みで貯められる強さ。',
    nobashi: '巣の食料（現金の備え）を先に数ヶ月分。そこから先は育てる番。',
  },
  CMLN: {
    name: 'しなやかなネコ',
    emoji: '🐈',
    hitokoto: '身軽に暮らして、必要なぶんはちゃんと残す。',
    tsuyomi: 'ムダのない家計。固定費が軽く、変化に強い。',
    nobashi: '残せる力があるので、行き先（積立先・備え）を決めてあげるだけで一気に伸びる。',
  },
  YGSF: {
    name: '波間のイルカ',
    emoji: '🐬',
    hitokoto: '楽しみながら、ちゃんと沖（未来）も見ている。',
    tsuyomi: '今の生活を大切にしつつ、投資と積立は仕組みで継続。',
    nobashi: '支出をあと少し整えると、同じ暮らしのまま積立余力が生まれる。',
  },
  YGSN: {
    name: 'おおらかなゾウ',
    emoji: '🐘',
    hitokoto: '大きな安心を背に、ゆったり歩く。',
    tsuyomi: '厚い備えと育てる資産を持ちながら、今を我慢しない度量。',
    nobashi: '毎月の「余り」を先どりに変えるだけで、歩みがさらに確かになる。',
  },
  YGLF: {
    name: '波乗りのペンギン',
    emoji: '🐧',
    hitokoto: '小さな体で、大きな海に漕ぎ出している。',
    tsuyomi: '先どり積立と投資への一歩をすでに踏み出している行動力。',
    nobashi: '氷の上の休憩所（現金の備え）を少しずつ。波に乗り続けるための足場になる。',
  },
  YGLN: {
    name: '自由なカモメ',
    emoji: '🐦',
    hitokoto: '風まかせに見えて、飛び方は自分で選んでいる。',
    tsuyomi: '経験や挑戦にお金を使える柔軟さ。攻めの感覚もある。',
    nobashi: '月1回の「きろく帳」だけ習慣にすると、自由なまま現在地がわかる。',
  },
  YMSF: {
    name: '見守りのフクロウ',
    emoji: '🦉',
    hitokoto: '夜でも遠くまで見えている、慎重な賢者。',
    tsuyomi: '厚い備えと先どり習慣。守りの完成度が高い。',
    nobashi: '備えは十分。ほんの一部を「育つ場所」に移すと、見守る楽しみが増える。',
  },
  YMSN: {
    name: 'あったかコアラ',
    emoji: '🐨',
    hitokoto: '安心の木の上で、たいせつな時間をゆっくり過ごす。',
    tsuyomi: '現金の備えが厚く、暮らしの満足度も高い。心の安定型。',
    nobashi: '木の実（余剰）が出た月だけでも積立に回すと、木がもう1本育つ。',
  },
  YMLF: {
    name: '芽吹きのヒヨコ',
    emoji: '🐥',
    hitokoto: 'まだ小さくても、もう歩き出している。',
    tsuyomi: '先どりの意志がある。ここからの伸びしろが16タイプで一番大きい。',
    nobashi: 'まず生活防衛資金を少しずつ。土ができれば芽はすぐ伸びる。',
  },
  YMLN: {
    name: 'ひなたのカピバラ',
    emoji: '🦦',
    hitokoto: '今この時間をいちばん大切にできる名人。',
    tsuyomi: '日々を楽しむ力はお金に換えられない資産。ストレスの少ない家計。',
    nobashi: '楽しみはそのままに、「先取り1,000円」から。小さく始めるのがカピバラ流。',
  },
};

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

// 入力値のみから4文字コードを判定（質問なし・ゼロ除算は必ずガード）
export function judgeType(params = {}) {
  const monthlyIncome = num(params.annualIncome) / 12;
  const monthlyExpense = num(params.annualExpense) / 12;
  const invested = num(params.investedAsset);
  const total = Math.max(num(params.totalAsset), invested);
  const cash = total - invested;
  const monthlyInvest = num(params.monthlyInvest);

  // 軸1 ため力: 収入0は判定不能 → Y に倒す
  const surplus = monthlyIncome - monthlyExpense;
  const a1 = monthlyIncome > 0 && surplus / monthlyIncome >= THRESHOLDS.savingsRate ? 'C' : 'Y';

  // 軸2 そだて方: 総資産0 → M に倒す
  const a2 = total > 0 && invested / total >= THRESHOLDS.investRatio ? 'G' : 'M';

  // 軸3 そなえ: 支出0 → S に倒す（内部では999ヶ月でキャップ）
  const bufferMonths = monthlyExpense > 0 ? Math.min(cash / monthlyExpense, 999) : 999;
  const a3 = bufferMonths >= THRESHOLDS.bufferMonths ? 'S' : 'L';

  // 軸4 しこみ: 余剰0以下は「積立していれば F（赤字でも先どり=強い意志）」
  const a4 =
    surplus > 0
      ? monthlyInvest / surplus >= THRESHOLDS.commitRate
        ? 'F'
        : 'N'
      : monthlyInvest > 0
        ? 'F'
        : 'N';

  const code = a1 + a2 + a3 + a4;
  return {
    code,
    tags: [...code].map((c) => AXIS_LABELS[c]),
    ...TYPES[code],
  };
}

// 図鑑用: 16タイプすべて（仕様書の並び順）
export function allTypes() {
  return Object.entries(TYPES).map(([code, t]) => ({
    code,
    tags: [...code].map((c) => AXIS_LABELS[c]),
    ...t,
  }));
}

// シェア文（仕様§4のテンプレート・金額なし。URLはシェアAPI側で別添え）
export function buildShareText(type) {
  return `私のお金の性格は『${type.name}』でした🌱 あなたの資産寿命とお金の性格が30秒でわかる #ミラため`;
}

const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';

// タイプ別イラスト（512px透過PNG）。図鑑・診断カード共通
export const typeImagePath = (code) => `assets/types/${code}.png`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// カードの配色（🍓ベリー / 🌲フォレスト — ピンクに抵抗がある人向けの選択肢）
const PALETTES = {
  berry: { bgA: '#fbe6e4', bgB: '#fdf3f1', border: '#f5c7d2', accent: '#c96079', tagBg: '#fdeef1', tagBorder: '#f0a3b4', sub: '#8a6f66', footer: '#a2887f' },
  forest: { bgA: '#e7efe6', bgB: '#f3f8f1', border: '#c3d8c6', accent: '#45705f', tagBg: '#ebf3ec', tagBorder: '#9fc8b3', sub: '#6f8577', footer: '#8a9a8a' },
};

function drawTag(ctx, text, cx, y, pal) {
  ctx.font = `700 24px ${FONT}`;
  const w = ctx.measureText(text).width + 32;
  ctx.fillStyle = pal.tagBg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 24, w, 42, 21);
  ctx.fill();
  ctx.strokeStyle = pal.tagBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = pal.accent;
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 4);
  return w;
}

// 診断カード（1200×630）。右側にタイプのイラスト（読めなければ絵文字が代役）
export async function renderShareCard(type, palette = 'berry') {
  const pal = PALETTES[palette] ?? PALETTES.berry;
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await document.fonts.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, pal.bgA);
  bg.addColorStop(1, pal.bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(56, 56, W - 112, H - 168, 32);
  ctx.fill();
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  const textCenterX = 430;
  ctx.textAlign = 'center';

  ctx.fillStyle = pal.accent;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText('ミラため性格診断', textCenterX, 140);

  // 4文字コードのチップ
  ctx.font = `700 26px ${FONT}`;
  const codeText = type.code.split('').join('-');
  const cw = ctx.measureText(codeText).width + 44;
  ctx.fillStyle = '#f7efd0';
  ctx.beginPath();
  ctx.roundRect(textCenterX - cw / 2, 162, cw, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#8a6f4a';
  ctx.fillText(codeText, textCenterX, 192);

  ctx.fillStyle = '#5c4a44';
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText(type.name, textCenterX, 288);

  // 4タグ（中央寄せで横並び）
  ctx.font = `700 24px ${FONT}`;
  const gaps = 12;
  const widths = type.tags.map((t) => ctx.measureText(t).width + 32);
  const totalW = widths.reduce((a, b) => a + b, 0) + gaps * 3;
  let x = textCenterX - totalW / 2;
  for (let i = 0; i < type.tags.length; i++) {
    drawTag(ctx, type.tags[i], x + widths[i] / 2, 352, pal);
    x += widths[i] + gaps;
  }

  ctx.fillStyle = pal.sub;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(type.hitokoto, textCenterX, 424);

  ctx.fillStyle = pal.accent;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('あなたは16タイプのどれ？', textCenterX, 486);

  // 右側: タイプのイラスト
  try {
    const img = await loadImage(typeImagePath(type.code));
    ctx.drawImage(img, 770, 100, 390, 390);
  } catch {
    ctx.font = '190px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(type.emoji, 960, 330);
  }

  ctx.fillStyle = pal.footer;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('ミラため — 未来のために、貯めて育てる', W / 2, H - 62);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('kyuusaku16-a11y.github.io/miratame', W / 2, H - 26);

  return canvas;
}
