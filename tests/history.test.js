import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthOf,
  loadHistory,
  recordSnapshot,
  previousSnapshot,
  buildWelcomeBack,
  markRecorded,
  recordStreak,
  latestRecordBefore,
  buildRecordDelta,
  buildYearReview,
  importHistory,
} from '../src/history.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const kpis = (lifetimeAge, survivesToEnd) => ({ lifetimeAge, survivesToEnd, targetAge: 60 });

test('monthOf は YYYY-MM 形式（月ゼロ埋め）', () => {
  assert.equal(monthOf(new Date(2026, 6, 7)), '2026-07');
  assert.equal(monthOf(new Date(2026, 10, 1)), '2026-11');
});

test('loadHistory: 未保存・壊れたJSON・配列以外は空配列', () => {
  assert.deepEqual(loadHistory(fakeStorage()), []);
  const s = fakeStorage();
  s.setItem('money-vision-history', '{oops');
  assert.deepEqual(loadHistory(s), []);
  s.setItem('money-vision-history', '{"a":1}');
  assert.deepEqual(loadHistory(s), []);
});

test('recordSnapshot: 同じ月は上書き・別の月は追記', () => {
  const s = fakeStorage();
  recordSnapshot(kpis(80, false), s, '2026-06');
  recordSnapshot(kpis(82, false), s, '2026-06'); // 同月更新
  recordSnapshot(kpis(85, false), s, '2026-07');
  const h = loadHistory(s);
  assert.equal(h.length, 2);
  assert.equal(h[0].ym, '2026-06');
  assert.equal(h[0].lifetimeAge, 82);
  assert.equal(h[1].ym, '2026-07');
});

test('recordSnapshot: 24ヶ月分より古いものは捨てる', () => {
  const s = fakeStorage();
  for (let i = 0; i < 30; i++) {
    const ym = `20${20 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    recordSnapshot(kpis(80 + i, false), s, ym);
  }
  const h = loadHistory(s);
  assert.equal(h.length, 24);
  assert.equal(h[h.length - 1].lifetimeAge, 109);
});

test('previousSnapshot: 今月を除いた直近の記録を返す', () => {
  const hist = [
    { ym: '2026-04', lifetimeAge: 78 },
    { ym: '2026-06', lifetimeAge: 80 },
    { ym: '2026-07', lifetimeAge: 83 },
  ];
  assert.equal(previousSnapshot(hist, '2026-07').ym, '2026-06');
  assert.equal(previousSnapshot([{ ym: '2026-07' }], '2026-07'), null);
  assert.equal(previousSnapshot([], '2026-07'), null);
});

test('buildWelcomeBack: 前回記録なしは null', () => {
  assert.equal(buildWelcomeBack(null, kpis(80, false)), null);
});

test('buildWelcomeBack: 資産寿命がのびたら喜ぶ（差の歳数入り）', () => {
  const msg = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(83, false));
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('3歳'));
});

test('buildWelcomeBack: 最後まで持つようになった変化を祝う', () => {
  const msg = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(null, true));
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('最後まで'));
});

test('buildWelcomeBack: 悪化は責めずに見直しを促す', () => {
  const down = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 83, survivesToEnd: false }, kpis(80, false));
  assert.equal(down.type, 'gentle');
  assert.ok(!down.text.includes('悪'));
  const lost = buildWelcomeBack({ ym: '2026-06', lifetimeAge: null, survivesToEnd: true }, kpis(80, false));
  assert.equal(lost.type, 'gentle');
});

test('buildWelcomeBack: 変化なしはキープを褒める', () => {
  const same = buildWelcomeBack({ ym: '2026-06', lifetimeAge: 80, survivesToEnd: false }, kpis(80, false));
  assert.equal(same.type, 'improved');
  const bothOk = buildWelcomeBack({ ym: '2026-06', lifetimeAge: null, survivesToEnd: true }, kpis(null, true));
  assert.equal(bothOk.type, 'improved');
});

// ---- 実績記録（毎月の資産きろく） ----

test('recordSnapshot: 同月上書きでも記録済みフィールドは保持する', () => {
  const s = fakeStorage();
  recordSnapshot(kpis(80, false), s, '2026-07');
  markRecorded(s, { totalAsset: 5000000, projected1y: 5600000 }, '2026-07');
  recordSnapshot(kpis(82, false), s, '2026-07'); // 自動スナップショットで上書き
  const h = loadHistory(s);
  assert.equal(h[0].lifetimeAge, 82);
  assert.equal(h[0].recordedAsset, 5000000);
  assert.equal(h[0].projected1y, 5600000);
});

test('markRecorded: その月のエントリが無ければ作る', () => {
  const s = fakeStorage();
  markRecorded(s, { totalAsset: 3000000, projected1y: 3300000 }, '2026-07');
  const h = loadHistory(s);
  assert.equal(h.length, 1);
  assert.equal(h[0].ym, '2026-07');
  assert.equal(h[0].recordedAsset, 3000000);
});

test('recordStreak: 今月から連続して記録した月数を数える', () => {
  const mk = (ym, rec) => (rec ? { ym, recordedAsset: 1 } : { ym });
  assert.equal(recordStreak([mk('2026-05', true), mk('2026-06', true), mk('2026-07', true)], '2026-07'), 3);
  assert.equal(recordStreak([mk('2026-04', true), mk('2026-06', true), mk('2026-07', true)], '2026-07'), 2); // 5月が抜け
  assert.equal(recordStreak([mk('2026-07', false)], '2026-07'), 0);
  assert.equal(recordStreak([], '2026-07'), 0);
  // 年またぎ
  assert.equal(recordStreak([mk('2025-12', true), mk('2026-01', true)], '2026-01'), 2);
});

test('latestRecordBefore: 今月より前の直近の記録済みエントリ', () => {
  const h = [
    { ym: '2026-04', recordedAsset: 100 },
    { ym: '2026-05' },
    { ym: '2026-06', recordedAsset: 200 },
    { ym: '2026-07', recordedAsset: 300 },
  ];
  assert.equal(latestRecordBefore(h, '2026-07').ym, '2026-06');
  assert.equal(latestRecordBefore(h, '2026-05').ym, '2026-04');
  assert.equal(latestRecordBefore([], '2026-07'), null);
});

test('buildRecordDelta: 前回の記録との実額差をシンプルに伝える', () => {
  const prev = { ym: '2026-06', recordedAsset: 5000000 };
  const up = buildRecordDelta(prev, { ym: '2026-07', recordedAsset: 5120000 });
  assert.equal(up.type, 'improved');
  assert.ok(up.text.includes('+12万円'));
  assert.ok(up.text.includes('6月')); // 前回がいつかを添える
  const down = buildRecordDelta(prev, { ym: '2026-07', recordedAsset: 4800000 });
  assert.equal(down.type, 'gentle');
  assert.ok(down.text.includes('20万円'));
  assert.ok(!down.text.includes('遅れ')); // 責めない
  const same = buildRecordDelta(prev, { ym: '2026-07', recordedAsset: 5004000 }); // ±1万未満
  assert.equal(same.type, 'improved');
  assert.ok(same.text.includes('同じ'));
});

test('buildRecordDelta: データ不足は null', () => {
  assert.equal(buildRecordDelta(null, { ym: '2026-07', recordedAsset: 1 }), null);
  assert.equal(buildRecordDelta({ ym: '2026-06' }, { ym: '2026-07', recordedAsset: 1 }), null);
});

// ---- 答え合わせ（1年前の計画 vs 実績） ----

test('buildYearReview: 計画を上回ったら両方の額を添えて祝う', () => {
  const hist = [
    { ym: '2025-07', recordedAsset: 3000000, projected1y: 3250000 },
    { ym: '2026-07', recordedAsset: 3500000 },
  ];
  const msg = buildYearReview(hist, '2026-07');
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('325万円'));
  assert.ok(msg.text.includes('350万円'));
});

test('buildYearReview: ±5%以内は「計画どおり」を褒める', () => {
  const hist = [
    { ym: '2025-07', recordedAsset: 3000000, projected1y: 3200000 },
    { ym: '2026-07', recordedAsset: 3300000 }, // +3.1%
  ];
  const msg = buildYearReview(hist, '2026-07');
  assert.equal(msg.type, 'improved');
  assert.ok(msg.text.includes('計画どおり'));
});

test('buildYearReview: 下回っても責めずに見直しを誘う', () => {
  const hist = [
    { ym: '2025-07', recordedAsset: 3000000, projected1y: 3600000 },
    { ym: '2026-07', recordedAsset: 3300000 },
  ];
  const msg = buildYearReview(hist, '2026-07');
  assert.equal(msg.type, 'gentle');
  assert.ok(msg.text.includes('見直'));
  assert.ok(!msg.text.includes('遅れ'));
  assert.ok(!msg.text.includes('失敗'));
});

test('buildYearReview: 12ヶ月前を最優先、なければ13→11ヶ月前で代用', () => {
  const hist = [
    { ym: '2025-06', recordedAsset: 1, projected1y: 20000000 }, // 13ヶ月前
    { ym: '2025-08', recordedAsset: 1, projected1y: 30000000 }, // 11ヶ月前
    { ym: '2026-07', recordedAsset: 50000000 },
  ];
  assert.ok(buildYearReview(hist, '2026-07').text.includes('2000万円')); // 13ヶ月前を採用
  const withExact = [...hist, { ym: '2025-07', recordedAsset: 1, projected1y: 10000000 }];
  assert.ok(buildYearReview(withExact, '2026-07').text.includes('1000万円')); // 12ヶ月前を最優先
});

test('buildYearReview: 対象データがなければ null', () => {
  assert.equal(buildYearReview([], '2026-07'), null);
  // 今月の記録がない
  assert.equal(buildYearReview([{ ym: '2025-07', recordedAsset: 1, projected1y: 100 }], '2026-07'), null);
  // 1年前に計画値がない
  assert.equal(
    buildYearReview(
      [
        { ym: '2025-07', recordedAsset: 100 },
        { ym: '2026-07', recordedAsset: 100 },
      ],
      '2026-07'
    ),
    null
  );
  // 近すぎる（10ヶ月前）
  assert.equal(
    buildYearReview(
      [
        { ym: '2025-09', recordedAsset: 1, projected1y: 100 },
        { ym: '2026-07', recordedAsset: 100 },
      ],
      '2026-07'
    ),
    null
  );
});

// ---- データ引っ越し（読み込み側の検証） ----

test('importHistory: 正しいエントリだけ採用して保存する', () => {
  const s = fakeStorage();
  const saved = importHistory(
    [
      { ym: '2026-06', recordedAsset: 100 },
      { ym: 'oops' }, // 形式不正
      'not-an-object',
      { ym: '2026-07', recordedAsset: 200 },
    ],
    s
  );
  assert.equal(saved.length, 2);
  assert.deepEqual(loadHistory(s).map((x) => x.ym), ['2026-06', '2026-07']);
});

test('importHistory: 配列以外は既存データを壊さない', () => {
  const s = fakeStorage();
  markRecorded(s, { totalAsset: 100, projected1y: 110 }, '2026-07');
  importHistory({ evil: true }, s);
  importHistory(null, s);
  assert.equal(loadHistory(s).length, 1);
});
