// ミラため性格診断（16タイプ・入力値ベース）とシェアカード（1200×630）。
// 仕様: miratame-16types-spec.md（2026-07-09）
// - 質問なし。シミュレーターの入力値のみから4軸を自動判定（実データなので正直）
// - 全タイプ前向き・ごきげんルール（nobashi）は提案の口調・金額推奨や銘柄名は出さない
// - 表示ラベルは「財布のクセ」（tsuyomi=笑える具体的な一場面）と「ごきげんルール」（nobashi=明日できる一手）。
//   フィールド名は互換のため変更しない。クセは動物の比喩と日常のお金の場面を二重写しにする。
//   ルールは16タイプすべて別の行動にする（「ときどき全体を見る」の言い換えを並べない）
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
    tsuyomi: '給料日の夜、振り分けを終えてからやっと一息。お金の配属先は、本人が休むより先に決まっています。',
    nobashi: '「使ってよし」の枠も先取りで確保すること。遊び場のあるダムのほうが、長持ちします。',
  },
  CGSN: {
    name: '実りわけのリス',
    emoji: '🐿️',
    hitokoto: 'どんぐりを蓄えながら、今日のぶんもちゃんと味わう。',
    tsuyomi: '口座にポイントに積立にと上手に分けた結果、どこに何を埋めたか、ときどき自分でも分からない。',
    nobashi: '月に一度の「どんぐり地図」の更新。ぜんぶでいくらかが見えると、安心まで増えます。',
  },
  CGLF: {
    name: '風にのるワシ',
    emoji: '🦅',
    hitokoto: '身軽な装備で、高く遠くへ飛ぶ。',
    tsuyomi: '証券アプリは毎朝開くのに、財布の中身は知らない。資産は上空、現金は地面すれすれの飛行です。',
    nobashi: '急な出費の着地点（すぐ使える現金）をひと確認。降りる場所のあるワシほど、高く飛べます。',
  },
  CGLN: {
    name: '好奇心のキツネ',
    emoji: '🦊',
    hitokoto: '面白そうな方へ、貯めた力で踏み込める。',
    tsuyomi: '面白そうなサービスは即・体験。無料期間の終了日だけが、あとから静かに追いかけてきます。',
    nobashi: '冒険を始めた日に、終了日もカレンダーへ埋めておくこと。掘り返す日の自分がよろこびます。',
  },
  CMSF: {
    name: '石橋をわたるカメ',
    emoji: '🐢',
    hitokoto: 'ゆっくり、でも絶対に進む。',
    tsuyomi: '比較サイトを5つ見て、結論は「もう少し調べる」。慎重さは満点、出発日は未定。',
    nobashi: '調べる期限を先に決めること。期限までに「見送る」と決めたなら、それも立派な一歩です。',
  },
  CMSN: {
    name: '冬支度のクマ',
    emoji: '🐻',
    hitokoto: 'たっぷり蓄えて、今の季節もちゃんと楽しむ。',
    tsuyomi: '給料日の夜、残高を確かめて「よし」。蓄えはたっぷり——ただし全部、同じ巣穴で冬眠中。',
    nobashi: '「すぐ使う分」と「出番の遠い分」で巣穴を分けること。冬の心配が、ひとつ減ります。',
  },
  CMLF: {
    name: 'はたらきもののアリ',
    emoji: '🐜',
    hitokoto: '毎日コツコツ、列を乱さず未来へ運ぶ。',
    tsuyomi: '積立の引き落とし日は即答できるのに、「何のため？」と聞かれると列が一瞬止まる。',
    nobashi: '半年に一度、運んでいる荷物の荷札（積立の目的）だけ確認。歩き方は、もう完璧なのですから。',
  },
  CMLN: {
    name: 'しなやかなネコ',
    emoji: '🐈',
    hitokoto: '身軽に暮らして、必要なぶんはちゃんと残す。',
    tsuyomi: '無駄遣いは、しない。家計簿も、つけない。面倒な設定も、見事にしない。',
    nobashi: '一度きりで済む手続きだけ、元気な日に予約すること。終わったら、また日なたで寝ていて大丈夫。',
  },
  YGSF: {
    name: '波間のイルカ',
    emoji: '🐬',
    hitokoto: '楽しみながら、ちゃんと沖（未来）も見ている。',
    tsuyomi: '「積立は自動で回ってるし」を浮き輪に、楽しい予定がすこしずつ沖へ。今日もいい波が来ています。',
    nobashi: '月に一度だけ、カードの明細に顔を出すこと。岸の位置さえ見えれば、また沖まで遊べます。',
  },
  YGSN: {
    name: 'おおらかなゾウ',
    emoji: '🐘',
    hitokoto: '大きな安心を背に、ゆったり歩く。',
    tsuyomi: '大きな買い物は外さない。でも小さなサブスクの群れは、大きな足の下を静かに通過していきます。',
    nobashi: '誕生月に固定費をひと回り点検。年に一度で十分です、ゾウの歩幅なら。',
  },
  YGLF: {
    name: '波乗りのペンギン',
    emoji: '🐧',
    hitokoto: '小さな体で、大きな海に漕ぎ出している。',
    tsuyomi: '飛び込む勇気はもう出した。戻る氷の厚さ（給料日前の残高）は、飛び込んでから考えるタイプ。',
    nobashi: 'すぐ使える「足場のお金」を氷の上に少しずつ。戻る場所があるペンギンほど、深く潜れます。',
  },
  YGLN: {
    name: '自由なカモメ',
    emoji: '🐦',
    hitokoto: '風まかせに見えて、飛び方は自分で選んでいる。',
    tsuyomi: '「今しかない」と思った瞬間、残高より先に予約ボタンを押している。残高は帰ってから見る派。',
    nobashi: '月末に残高を1枚だけスクショすること。家計簿はいりません。灯台がひとつあれば飛べます。',
  },
  YMSF: {
    name: '見守りのフクロウ',
    emoji: '🦉',
    hitokoto: '夜でも遠くまで見えている、慎重な賢者。',
    tsuyomi: '本は3冊読んだ。口座も作った。判断材料だけが、今夜も枝の上で静かに増え続けています。',
    nobashi: '「いつまでに決めるか」を先に決めること。見極めきった夜の一撃は、外れないのですから。',
  },
  YMSN: {
    name: 'あったかコアラ',
    emoji: '🐨',
    hitokoto: '安心の木の上で、たいせつな時間をゆっくり過ごす。',
    tsuyomi: '銀行もカードもスーパーも、ずっと同じ木。安心だけど、隣の枝に若葉が出ても気づきにくい。',
    nobashi: '年に一度だけ、隣の枝（別のプランや料金）を眺めること。移るかどうかは、そのあとで。',
  },
  YMLF: {
    name: '芽吹きのヒヨコ',
    emoji: '🐥',
    hitokoto: 'まだ小さくても、もう歩き出している。',
    tsuyomi: '積立は始めた。なのにSNSの「資産1,000万円」を見て、そっと殻に戻りたくなる夜がある。',
    nobashi: '比べる相手は昨日の自分だけ。金額より「続いた月」に丸をつけると、羽が生えるのが早まります。',
  },
  YMLN: {
    name: 'ひなたのカピバラ',
    emoji: '🦦',
    hitokoto: '今この時間をいちばん大切にできる名人。',
    tsuyomi: '残高照会の一歩手前で、指が止まる。「今日じゃなくてもいいか」。お湯かげんは、今日も最高。',
    nobashi: '給料日に少しだけ、自動で明日側へ流れる仕組みをひとつ。のんびりは、仕組みに守ってもらえます。',
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
