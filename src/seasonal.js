// 季節のひとこと: 月に応じてキャラの声かけが変わる（再訪時の「開くたびに違う」感）。
// 金額は出さない・責めない（§1）。該当しない月は null。

const MESSAGES = {
  1: { text: 'あけましておめでとう！今年のお金の計画、いっしょに見直そう🎍', img: 'assets/piyo-yatta.png' },
  4: { text: '新年度だね🌸 収入や支出が変わったら、入力を最新にしてみよう', img: 'assets/bird-pink.png' },
  6: { text: 'ボーナスの季節！使い道をシミュレーションしてみない？', img: 'assets/piyo-good.png' },
  9: { text: '今年も後半戦。積み立て、いいペースで続いてる？', img: 'assets/piyo-watering.png' },
  12: { text: 'ボーナスと年末🎄 今年の資産をふりかえってみよう', img: 'assets/piyo-happy.png' },
};

export function seasonalMessage(d = new Date()) {
  return MESSAGES[d.getMonth() + 1] ?? null;
}
