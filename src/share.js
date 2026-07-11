// ミラため性格診断（16タイプ・入力値ベース）とシェアカード（1200×630）。
// 仕様: miratame-16types-spec.md（2026-07-09）
// - 質問なし。シミュレーターの入力値のみから4軸を自動判定（実データなので正直）
// - 全タイプ前向き・しあわせのコツ（nobashi）は提案の口調・金額推奨や銘柄名は出さない
// - 表示ラベルは「習性」（tsuyomi）と「しあわせのコツ」（nobashi）。フィールド名は互換のため変更しない
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
    tsuyomi: 'もう十分頑丈なダムを、今日も見回りしてしまう几帳面さ。森でいちばん安心な物件です。',
    nobashi: 'たまには自分の池にぷかっと浮かぶこと。ダムは一晩見回らなくても崩れません。',
  },
  CGSN: {
    name: '実りわけのリス',
    emoji: '🐿️',
    hitokoto: 'どんぐりを蓄えながら、今日のぶんもちゃんと味わう。',
    tsuyomi: 'どんぐりは冬のぶんも今日のぶんも。頬袋に両方詰められる塩梅は、森でも指折りの才能です。',
    nobashi: '月に一度だけ、埋めた場所をぐるっとひと回り。眠っていたどんぐりを見つけるのは、リスの特権です。',
  },
  CGLF: {
    name: '風にのるワシ',
    emoji: '🦅',
    hitokoto: '身軽な装備で、高く遠くへ飛ぶ。',
    tsuyomi: '羽ばたかずに上昇気流でぐんと高くへ。流れを見つけて翼を預ける度胸は、空でいちばんの燃費です。',
    nobashi: '帰って羽を休める木を一本だけ決めておくこと。巣が固いワシほど、次の風に大胆に乗れます。',
  },
  CGLN: {
    name: '好奇心のキツネ',
    emoji: '🦊',
    hitokoto: '面白そうな方へ、貯めた力で踏み込める。',
    tsuyomi: '面白いものを嗅ぎつける鼻と、ためらわない足取り。雪の下のごちそうも見逃しません。',
    nobashi: '見つけた獲物のひと切れだけ、先に土へ埋めてから遊ぶこと。掘り返す日の自分がよろこびます。',
  },
  CMSF: {
    name: '石橋をわたるカメ',
    emoji: '🐢',
    hitokoto: 'ゆっくり、でも絶対に進む。',
    tsuyomi: '叩いた石橋しか渡らない2億年ものの用心深さ。ウサギが昼寝している間も、歩みは止まりません。',
    nobashi: 'たまには首をぐっと伸ばして、新しい景色をひとつだけ。カメの首は、意外と遠くまで届きます。',
  },
  CMSN: {
    name: '冬支度のクマ',
    emoji: '🐻',
    hitokoto: 'たっぷり蓄えて、今の季節もちゃんと楽しむ。',
    tsuyomi: 'いちばん脂ののった鮭を選んで味わううちに、気づけば冬支度も終わっている。実りの季節の主です。',
    nobashi: '蓄えをひとつの巣穴にまとめないこと。もうひとつ穴を知っているクマに、こわい冬は来ません。',
  },
  CMLF: {
    name: 'はたらきもののアリ',
    emoji: '🐜',
    hitokoto: '毎日コツコツ、列を乱さず未来へ運ぶ。',
    tsuyomi: 'やる気に頼らず今日も列が続く、仕組みの最高傑作。雨の日も、気分が乗らない日も同じ歩幅です。',
    nobashi: 'たまに列を一歩だけ外れて、荷物の行き先を眺めること。歩き方は、もう完璧なのですから。',
  },
  CMLN: {
    name: 'しなやかなネコ',
    emoji: '🐈',
    hitokoto: '身軽に暮らして、必要なぶんはちゃんと残す。',
    tsuyomi: 'ムダな動きをしない省エネの天才。気づいたら、いちばん高いところ（残高）にいます。',
    nobashi: '面倒な手続きに、ぷいっと顔をそむけないこと。がまんするのは最初の一回だけです。',
  },
  YGSF: {
    name: '波間のイルカ',
    emoji: '🐬',
    hitokoto: '楽しみながら、ちゃんと沖（未来）も見ている。',
    tsuyomi: '全力で波に乗っている間も、脳の半分はちゃんと起きて明日の方角を見ています。',
    nobashi: 'ときどき水面に顔を出して、岸の位置をひと目だけ。それでまた沖まで遊べます。',
  },
  YGSN: {
    name: 'おおらかなゾウ',
    emoji: '🐘',
    hitokoto: '大きな安心を背に、ゆったり歩く。',
    tsuyomi: '水場の場所を何十年も忘れない記憶力。小走りしなくても、一歩が大きいから遠くへ着きます。',
    nobashi: '歩き出す前に鼻を上げて、今日の向きをひとつ。あとはいつもの大股で水場に着きます。',
  },
  YGLF: {
    name: '波乗りのペンギン',
    emoji: '🐧',
    hitokoto: '小さな体で、大きな海に漕ぎ出している。',
    tsuyomi: 'みんなが氷の上で顔を見合わせている間に、もう飛び込んでいる一羽。海の中では速いんです。',
    nobashi: '上がって休める氷の足場を、少しずつ。戻る場所があるペンギンほど、深く潜れます。',
  },
  YGLN: {
    name: '自由なカモメ',
    emoji: '🐦',
    hitokoto: '風まかせに見えて、飛び方は自分で選んでいる。',
    tsuyomi: '風まかせに見えて、翼の角度は自分で決めている達人。あの自由、実は腕前です。',
    nobashi: '月にいちど、灯台のてっぺんでひと休み。現在地さえ分かれば、もっと遠い海へ飛べます。',
  },
  YMSF: {
    name: '見守りのフクロウ',
    emoji: '🦉',
    hitokoto: '夜でも遠くまで見えている、慎重な賢者。',
    tsuyomi: 'おいしそうな獲物が横切っても、枝の上でまばたきひとつ。見送る目の良さが、巣を守ってきました。',
    nobashi: '目が「これだ」と捉えたものへ、一度だけ静かに翼を。賢者の一撃は、外れないのです。',
  },
  YMSN: {
    name: 'あったかコアラ',
    emoji: '🐨',
    hitokoto: '安心の木の上で、たいせつな時間をゆっくり過ごす。',
    tsuyomi: '今日もいつもの木をぎゅっと抱えている安定感。あの抱擁、実はれっきとした生きる知恵です。',
    nobashi: '木は移らなくて大丈夫。いつもの木を抱えたまま、隣の枝の若葉をひとくち。冒険はそれで十分です。',
  },
  YMLF: {
    name: '芽吹きのヒヨコ',
    emoji: '🐥',
    hitokoto: 'まだ小さくても、もう歩き出している。',
    tsuyomi: 'いちばん固い殻を自分の嘴で割ってきた行動力。生まれた時点で、大仕事をひとつ終えています。',
    nobashi: 'ついて歩くのは、昨日の自分だけでいい。ひと粒ずつついばむうちに、羽はちゃんと生えそろいます。',
  },
  YMLN: {
    name: 'ひなたのカピバラ',
    emoji: '🦦',
    hitokoto: '今この時間をいちばん大切にできる名人。',
    tsuyomi: 'お湯に浸かる才能は16タイプ随一。その機嫌の良さ、実はりっぱな資産です。',
    nobashi: '湯上がりに、どんぐりをひとつだけ明日の側へ。それだけで、のんびりは一生守れます。',
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

// 「あなたの4軸」メーター。judgeTypeと同じ材料から、各軸の実数と境目を返す
//（数字の見える化のみ。「こうすれば別タイプ」の類いは出さない — ユーザー判断で不採用）
export function buildAxisDetails(params = {}) {
  const monthlyIncome = num(params.annualIncome) / 12;
  const monthlyExpense = num(params.annualExpense) / 12;
  const invested = num(params.investedAsset);
  const total = Math.max(num(params.totalAsset), invested);
  const cash = total - invested;
  const monthlyInvest = num(params.monthlyInvest);
  const surplus = monthlyIncome - monthlyExpense;

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const axes = [];

  // 軸1 ため力（貯蓄率・境目20%）
  {
    const t = THRESHOLDS.savingsRate;
    const rate = monthlyIncome > 0 ? surplus / monthlyIncome : 0;
    const side = monthlyIncome > 0 && rate >= t ? 'C' : 'Y';
    axes.push({
      key: 'tame',
      label: 'ため力',
      side,
      sideLabel: AXIS_LABELS[side],
      missing: monthlyIncome > 0 ? null : '収入を入れると見えるよ',
      valueText: `貯蓄率 ${Math.round(rate * 100)}%`,
      thresholdText: `コツコツの境目は ${Math.round(t * 100)}%`,
      ratio: clamp01(rate / (t * 2)),
    });
  }

  // 軸2 そだて方（投資比率・境目30%）
  {
    const t = THRESHOLDS.investRatio;
    const ratio = total > 0 ? invested / total : 0;
    const side = total > 0 && ratio >= t ? 'G' : 'M';
    axes.push({
      key: 'sodate',
      label: 'そだて方',
      side,
      sideLabel: AXIS_LABELS[side],
      missing: total > 0 ? null : '資産を入れると見えるよ',
      valueText: `育てる資産の割合 ${Math.round(ratio * 100)}%`,
      thresholdText: `そだてるの境目は ${Math.round(t * 100)}%`,
      ratio: clamp01(ratio / (t * 2)),
    });
  }

  // 軸3 そなえ（生活防衛月数・境目6ヶ月）
  {
    const t = THRESHOLDS.bufferMonths;
    const months = monthlyExpense > 0 ? Math.min(cash / monthlyExpense, 999) : 999;
    const side = months >= t ? 'S' : 'L';
    axes.push({
      key: 'sonae',
      label: 'そなえ',
      side,
      sideLabel: AXIS_LABELS[side],
      missing: monthlyExpense > 0 ? null : '支出を入れると見えるよ',
      valueText: `生活費 ${(Math.round(months * 10) / 10).toFixed(1)}ヶ月分`,
      thresholdText: `しっかり備えの境目は ${t}ヶ月`,
      ratio: clamp01(months / (t * 2)),
    });
  }

  // 軸4 しこみ（積立強度・境目50%）。赤字でも積立していればF（先どりの意志）
  {
    const t = THRESHOLDS.commitRate;
    const strength = surplus > 0 ? monthlyInvest / surplus : 0;
    const side = surplus > 0 ? (strength >= t ? 'F' : 'N') : monthlyInvest > 0 ? 'F' : 'N';
    let valueText = `余剰のうち積立 ${Math.round(strength * 100)}%`;
    if (monthlyIncome <= 0) {
      valueText = `余剰のうち積立 -%`;
    } else if (surplus <= 0 && side === 'N') {
      valueText = 'いまは余剰なし';
    } else if (surplus <= 0 && side === 'F') {
      valueText = '赤字でも先どり中';
    }
    axes.push({
      key: 'shikomi',
      label: 'しこみ',
      side,
      sideLabel: AXIS_LABELS[side],
      missing: monthlyIncome > 0 ? null : '収入を入れると見えるよ',
      valueText,
      thresholdText: `先どりの境目は ${Math.round(t * 100)}%`,
      ratio: clamp01(strength / (t * 2)),
    });
  }

  return axes;
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
