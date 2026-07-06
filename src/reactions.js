// スライダー操作の前後KPIを比べてキャラの短い反応を返す純粋関数（§5）。
// 改善は褒める・悪化は責めない（§1）。

// prev/next: deriveKpis の結果（targetAge, survivesToEnd, lifetimeAge を参照）
// 返り値: { type: 'improved'|'slower', text } | null
export function buildReaction(prev, next) {
  if (!prev) return null;

  if (prev.targetAge !== null && next.targetAge !== null && prev.targetAge > next.targetAge) {
    return { type: 'improved', text: `${prev.targetAge - next.targetAge}年早く目標に届く見込みです。` };
  }
  if (prev.targetAge === null && next.targetAge !== null) {
    return { type: 'improved', text: '目標に手が届く見込みが出てきました。' };
  }

  const life = (k) => (k.survivesToEnd ? Infinity : (k.lifetimeAge ?? -Infinity));
  if (life(next) > life(prev)) {
    return { type: 'improved', text: '資産寿命が延びる見込みです。' };
  }

  const targetWorse =
    (prev.targetAge !== null && next.targetAge === null) ||
    (prev.targetAge !== null && next.targetAge !== null && next.targetAge > prev.targetAge);
  if (life(next) < life(prev) || targetWorse) {
    return { type: 'slower', text: '少しゆっくりしたペースです。無理のない範囲で調整しましょう。' };
  }
  return null;
}
