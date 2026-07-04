// スライダー操作の前後KPIを比べてキャラの短い反応を返す純粋関数（§5）。
// 改善は褒める・悪化は責めない（§1）。

// prev/next: deriveKpis の結果（targetAge, survivesToEnd, lifetimeAge を参照）
// 返り値: { type: 'improved'|'slower', text } | null
export function buildReaction(prev, next) {
  if (!prev) return null;

  if (prev.targetAge !== null && next.targetAge !== null && prev.targetAge > next.targetAge) {
    return { type: 'improved', text: `${prev.targetAge - next.targetAge}年早く目標に届くようになったよ！` };
  }
  if (prev.targetAge === null && next.targetAge !== null) {
    return { type: 'improved', text: '目標に手が届く見込みが出てきたよ！' };
  }

  const life = (k) => (k.survivesToEnd ? Infinity : (k.lifetimeAge ?? -Infinity));
  if (life(next) > life(prev)) {
    return { type: 'improved', text: '資産寿命がのびたよ！いい調子！' };
  }

  const targetWorse =
    (prev.targetAge !== null && next.targetAge === null) ||
    (prev.targetAge !== null && next.targetAge !== null && next.targetAge > prev.targetAge);
  if (life(next) < life(prev) || targetWorse) {
    return { type: 'slower', text: '少しゆっくりペースだね。じっくりいこう。' };
  }
  return null;
}
