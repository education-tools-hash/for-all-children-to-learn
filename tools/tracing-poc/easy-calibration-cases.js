// Phase T6-A — 「やさしく」(easy) 較正・回帰テスト用の条件定義データ
//
// golden-tests-easy46.js / golden-tests-katakana-easy46.js が読み込む、合成なぞりの
// 「定義の一覧」。件数はこのファイルの定義 × 文字 × 画の位置 × 同画数の他文字 から実行時に
// 導く(expectedCount)。テスト側に件数を直接書かないこと。条件を足す場合は DEFINITIONS に
// 1件足すだけで、件数・集計は自動で追随する。
//
// side:
//   'save'     救いたい側(子どもらしい揺れ・短い線・はみ出し・位置ずれ・複合)
//   'saveExtra' 救いたい側の追加条件(Phase 2 の承認値の集計には含めない参考枠。合格率は別表示)
//   'lift'     途中で指が離れて画が2つに割れた場合(アプリは期待画数に達した時点で判定する
//              ため、割れた前半までが評価対象になる)。進行の仕組みの問題で別Phase扱いのため
//              合格率の集計には含めるが、救いたい側とは分けて表示する
//   'stop'     止めたい側・本命(別の文字・鏡像・強いジグザグ・打ち切り・無関係な線など)
//   'boundary' 境界枠(教育的な線引きで扱いが決まるもの。2026-11-28 User承認の線引き①〜④)
//
// 生成は決定的(mulberry32 + 文字とタグから作るseed)。Engine.evaluateCharacter は一切呼ばない
// (independent-wrong-trace.js と同じ「判定結果を見ずに作る」原則)。
// 生成ルール・seed・点数は Phase 1/2 の較正(2026-11-28)と同一。ここを変えると承認済みの
// 基準値(golden-tests-*-easy46.js の APPROVED)と比較できなくなるので、既存定義の変更は
// 再較正とUser承認を伴う変更として扱うこと(定義の追加は可)。
'use strict';

const IW = require('./independent-wrong-trace.js');

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (pts) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });
const pathLen = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]); return l; };
function resample(pts, n) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1]; const out = [];
  if (total <= 0) { for (let i = 0; i < n; i++) out.push({ x: pts[0].x, y: pts[0].y }); return out; }
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const target = total * i / (n - 1);
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;
    const sl = cum[seg + 1] - cum[seg]; const t = sl > 0 ? (target - cum[seg]) / sl : 0;
    const a = pts[seg], b = pts[Math.min(seg + 1, pts.length - 1)];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 変形(strokes[] -> strokes[])。救いたい側。
// ---------------------------------------------------------------------------
const iidWobble = (st, amp, rng) => st.map((pts) => pts.map((p) => ({ x: p.x + (rng() - 0.5) * 2 * amp, y: p.y + (rng() - 0.5) * 2 * amp })));
// 手のゆっくりした揺れ(線の法線方向へ低周波で振れる) + ごく小さな細かい震え
const humanWobble = (st, amp, rng) => st.map((pts) => {
  const f1 = 0.7 + rng() * 0.8, f2 = 2 + rng() * 1.5, ph1 = rng() * 6.283, ph2 = rng() * 6.283;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1e-9; tx /= tl; ty /= tl;
    const t = i / (n - 1);
    const d = amp * (0.7 * Math.sin(6.283 * f1 * t + ph1) + 0.3 * Math.sin(6.283 * f2 * t + ph2));
    const jx = (rng() - 0.5) * amp * 0.3, jy = (rng() - 0.5) * amp * 0.3;
    return { x: p.x - ty * d + jx, y: p.y + tx * d + jy };
  });
});
// 細かい震えを含まない、滑らかな揺れだけ
const smoothSway = (st, amp, rng) => st.map((pts) => {
  const f1 = 0.7 + rng() * 0.8, f2 = 2 + rng() * 1.5, p1 = rng() * 6.283, p2 = rng() * 6.283, m = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(m - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1e-9; tx /= tl; ty /= tl;
    const t = i / (m - 1);
    const dd = amp * (0.7 * Math.sin(6.283 * f1 * t + p1) + 0.3 * Math.sin(6.283 * f2 * t + p2));
    return { x: p.x - ty * dd, y: p.y + tx * dd };
  });
});
const rotateEach = (st, maxAng, rng) => st.map((pts) => {
  const c = centroid(pts); const ang = (rng() < 0.5 ? -1 : 1) * maxAng * (0.6 + 0.4 * rng());
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * cs - (p.y - c.y) * sn, y: c.y + (p.x - c.x) * sn + (p.y - c.y) * cs }));
});
const cutEnd = (pts, frac) => pts.slice(0, Math.max(2, Math.round(pts.length * frac)));
const cutStart = (pts, frac) => pts.slice(Math.min(pts.length - 2, Math.round(pts.length * frac)));
const shortAll = (st, frac) => st.map((pts) => cutEnd(pts, frac));
const shortOne = (st, frac, rng) => { const k = Math.floor(rng() * st.length); return st.map((pts, i) => (i === k ? cutEnd(pts, frac) : pts)); };
const lateStartAll = (st, frac) => st.map((pts) => cutStart(pts, frac));
const overshoot = (st, frac) => st.map((pts) => {
  const n = pts.length, a = pts[n - 4], b = pts[n - 1];
  let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1e-9; tx /= tl; ty /= tl;
  const L = pathLen(pts) * frac, k = Math.max(2, Math.round(n * frac));
  return pts.concat(Array.from({ length: k }, (_, i) => ({ x: b.x + tx * L * (i + 1) / k, y: b.y + ty * L * (i + 1) / k })));
});
const hook = (st, frac) => st.map((pts) => {
  const n = pts.length, a = pts[n - 4], b = pts[n - 1];
  let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1e-9; tx /= tl; ty /= tl;
  const cs = Math.cos(2.4), sn = Math.sin(2.4); const hx = tx * cs - ty * sn, hy = tx * sn + ty * cs;
  const L = pathLen(pts) * frac;
  return pts.concat(Array.from({ length: 5 }, (_, i) => ({ x: b.x + hx * L * (i + 1) / 5, y: b.y + hy * L * (i + 1) / 5 })));
});
const offsetAll = (st, dx, dy) => st.map((pts) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy })));
const scaleAll = (st, f, bb) => st.map((pts) => pts.map((p) => ({ x: bb.cx + (p.x - bb.cx) * f, y: bb.cy + (p.y - bb.cy) * f })));
const drift = (st, amp, rng) => st.map((pts) => { const dx = (rng() - 0.5) * 2 * amp, dy = (rng() - 0.5) * 2 * amp; return pts.map((p) => ({ x: p.x + dx, y: p.y + dy })); });
const roundCorners = (st, wFrac) => st.map((pts) => {
  const n = pts.length, w = Math.max(1, Math.round(n * wFrac / 2));
  return pts.map((_, i) => { let sx = 0, sy = 0, c = 0; for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { sx += pts[j].x; sy += pts[j].y; c++; } return { x: sx / c, y: sy / c }; });
});
const pauseJitter = (st, rng) => st.map((pts) => { const m = Math.floor(pts.length / 2), q = pts[m]; const blob = Array.from({ length: 20 }, () => ({ x: q.x + (rng() - 0.5) * 0.02, y: q.y + (rng() - 0.5) * 0.02 })); return pts.slice(0, m).concat(blob, pts.slice(m)); });
const tremor = (st, amp, freq, rng) => st.map((pts) => pts.map((p, i) => ({ x: p.x + Math.sin(i * freq + rng() * 6.28) * amp, y: p.y + Math.cos(i * freq + rng() * 6.28) * amp })));
const pause = (st) => st.map((pts) => { const m = Math.floor(pts.length / 2); return pts.slice(0, m).concat(Array.from({ length: 6 }, () => ({ x: pts[m].x, y: pts[m].y })), pts.slice(m)); });
const backtrack = (st) => st.map((pts) => { const m = Math.floor(pts.length / 2); return pts.slice(0, m).concat(pts.slice(Math.max(0, m - 4), m).reverse(), pts.slice(m)); });
// 画kの途中(50%)で指が離れた: 入力は n+1 画になるが、アプリが判定するのは最初の n 画
const liftSplit = (st, k) => { const pts = st[k], m = Math.floor(pts.length / 2); return st.slice(0, k).concat([pts.slice(0, m + 1), pts.slice(m)], st.slice(k + 1)).slice(0, st.length); };

// ---------------------------------------------------------------------------
// 1画を置き換える変形(止めたい側・境界枠)。
// ---------------------------------------------------------------------------
// 画の始点→終点の直線に沿ったジグザグ(振幅=その画のbbox対角線×ampFrac、osc往復)
const zigChord = (s, ampFrac, osc) => {
  const p0 = s[0], p1 = s[s.length - 1]; const b = IW.bboxOf(s);
  const amp = (Math.hypot(b.width, b.height) || 1e-6) * ampFrac;
  const dx = p1.x - p0.x, dy = p1.y - p0.y; const len = Math.hypot(dx, dy) || 1e-6; const nx = -dy / len, ny = dx / len; const m = osc * 2;
  return Array.from({ length: m }, (_, i) => { const t = i / (m - 1); const sg = i % 2 === 0 ? 1 : -1; return { x: p0.x + dx * t + nx * sg * amp, y: p0.y + dy * t + ny * sg * amp }; });
};
// お手本の線に沿ったジグザグ(幅=amp(0..1座標)、osc往復)
const zigOnRef = (s, amp, osc) => {
  const p = resample(s, osc * 2 + 1);
  return p.map((q, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1e-9; tx /= tl; ty /= tl; const sg = i % 2 === 0 ? 1 : -1; return { x: q.x - ty * amp * sg, y: q.y + tx * amp * sg }; });
};
const chord = (s) => Array.from({ length: 20 }, (_, i) => ({ x: s[0].x + (s[s.length - 1].x - s[0].x) * i / 19, y: s[0].y + (s[s.length - 1].y - s[0].y) * i / 19 }));
const truncate = (s, frac) => s.slice(0, Math.max(2, Math.round(s.length * frac)));

// ---------------------------------------------------------------------------
// DEFINITIONS
//   per: 'char'    1文字につき variants の数だけ
//        'stroke'  1文字につき variants × 画数
//        'sibling' 1文字につき variants × 同じ画数の他の文字の数
//   multiStrokeOnly: true なら 2画以上の文字だけ
//   variants[].make(c, k, src): c=文脈(下の context())、k=画の位置(per:'stroke')、src=他の文字(per:'sibling')
// ---------------------------------------------------------------------------
const one = (c, k, fn) => c.ideal().map((s, i) => (i === k ? fn(s, k) : s));
const seeds = [1, 2, 3];
const V = (label, make) => ({ label, make });

const DEFINITIONS = [
  // ===== 救いたい側 =====
  { id: 'A', side: 'save', name: '既存相当(小さな揺れ等)', per: 'char', variants: [
    V('ideal', (c) => c.base()),
    V('iid.012', (c) => iidWobble(c.base(), 0.012, c.R('a1'))),
    V('iid.018', (c) => iidWobble(c.base(), 0.018, c.R('a2'))),
    V('offset(.03,.02)', (c) => offsetAll(c.base(), 0.03, 0.02)),
    V('scale1.1', (c) => scaleAll(c.base(), 1.1, c.bb)),
    V('tremor.01', (c) => tremor(c.base(), 0.01, 1.2, c.R('a3'))),
    V('pause', (c) => pause(c.base())),
    V('backtrack', (c) => backtrack(c.base())),
  ] },
  { id: 'B', side: 'save', name: '細かい震え(大)', per: 'char', variants: [0.03, 0.05, 0.07].map((a) => V('iid' + a, (c) => iidWobble(c.base(), a, c.R('b' + a)))) },
  { id: 'C', side: 'save', name: 'ゆっくりした揺れ+画の傾き', per: 'char', variants: [0.02, 0.04, 0.06, 0.08].flatMap((a) => seeds.map((s) => V('human' + a + '#' + s, (c) => rotateEach(humanWobble(c.base(), a, c.R('c' + a + s)), 0.06, c.R('cr' + a + s))))) },
  { id: 'C2', side: 'saveExtra', name: '滑らかな揺れだけ(細かい震えなし)', per: 'char', variants: [0.02, 0.04, 0.06, 0.08, 0.10].flatMap((a) => seeds.map((s) => V('sway' + a + '#' + s, (c) => smoothSway(c.base(), a, makeRng(hashStr(c.ch + '|s|' + a + s)))))) },
  { id: 'D', side: 'save', name: '画ごとの傾き', per: 'char', variants: [0.10, 0.20].flatMap((a) => [1, 2].map((s) => V('rot' + a + '#' + s, (c) => rotateEach(c.base(), a, c.R('d' + a + s))))) },
  { id: 'E1', side: 'save', name: '全画が短い', per: 'char', variants: [0.9, 0.8, 0.7, 0.6].map((f) => V('shortAll' + f, (c) => shortAll(c.base(), f))) },
  { id: 'E2', side: 'save', name: '1画だけ短い', per: 'char', variants: [0.8, 0.7, 0.6].flatMap((f) => seeds.map((s) => V('shortOne' + f + '#' + s, (c) => shortOne(c.base(), f, c.R('e' + f + s))))) },
  { id: 'E3', side: 'save', name: '書き始めが遅い', per: 'char', variants: [
    V('lateStart0.15', (c) => lateStartAll(c.base(), 0.15)),
    V('lateStart0.25', (c) => lateStartAll(c.base(), 0.25)),
    V('bothEnds.10', (c) => lateStartAll(shortAll(c.base(), 0.9), 0.1)),
  ] },
  { id: 'F', side: 'save', name: 'はみ出し', per: 'char', variants: [
    V('overshoot0.15', (c) => overshoot(c.base(), 0.15)),
    V('overshoot0.3', (c) => overshoot(c.base(), 0.30)),
    V('hook.12', (c) => hook(c.base(), 0.12)),
  ] },
  { id: 'G1', side: 'save', name: '全体の位置ずれ', per: 'char', variants: [[0.05, 0.03], [0.10, 0.06], [0.15, 0.10]].map(([dx, dy]) => V('offset(' + dx + ',' + dy + ')', (c) => offsetAll(c.base(), dx, dy))) },
  { id: 'G2', side: 'save', name: '全体の大きさ違い', per: 'char', variants: [0.7, 0.8, 1.25, 1.4].map((f) => V('scale' + f, (c) => scaleAll(c.base(), f, c.bb))) },
  { id: 'H', side: 'save', name: '画どうしの位置ずれ', per: 'char', variants: [0.03, 0.05, 0.08].flatMap((a) => seeds.map((s) => V('drift' + a + '#' + s, (c) => drift(c.base(), a, c.R('h' + a + s))))) },
  { id: 'I', side: 'save', name: '角が丸い', per: 'char', variants: [0.10, 0.20].map((w) => V('round' + w, (c) => roundCorners(c.base(), w))) },
  { id: 'J1', side: 'save', name: '複合(軽)', per: 'char', variants: seeds.map((s) => V('mixMild#' + s, (c) => shortOne(drift(humanWobble(c.base(), 0.03, c.R('j1w' + s)), 0.03, c.R('j1d' + s)), 0.85, c.R('j1s' + s)))) },
  { id: 'J2', side: 'save', name: '複合(中)', per: 'char', variants: seeds.map((s) => V('mixMod#' + s, (c) => scaleAll(shortAll(drift(humanWobble(c.base(), 0.05, c.R('j2w' + s)), 0.05, c.R('j2d' + s)), 0.8), 0.9, c.bb))) },
  { id: 'J3', side: 'save', name: '複合(重)', per: 'char', variants: seeds.map((s) => V('mixHeavy#' + s, (c) => offsetAll(shortAll(drift(rotateEach(humanWobble(c.base(), 0.07, c.R('j3w' + s)), 0.12, c.R('j3r' + s)), 0.07, c.R('j3d' + s)), 0.7), 0.08, 0.05))) },
  { id: 'K1', side: 'save', name: '途中で止まる(指は離さない)', per: 'char', variants: [V('pauseJitter', (c) => pauseJitter(c.base(), c.R('k')))] },
  // ===== 途中で指が離れる(別Phase扱い) =====
  { id: 'K2a', side: 'lift', name: '途中で指が離れる(最初の画が割れる)', per: 'char', variants: [V('liftFirst', (c) => liftSplit(c.base(), 0))] },
  { id: 'K2b', side: 'lift', name: '途中で指が離れる(最後の画が割れる)', per: 'char', multiStrokeOnly: true, variants: [V('liftLast', (c) => liftSplit(c.base(), c.n - 1))] },

  // ===== 止めたい側(本命) =====
  { id: 'W1', side: 'stop', name: '1画を直角の線に', per: 'stroke', multiStrokeOnly: true, variants: [V('W1', (c, k) => one(c, k, (s) => IW.w1Perpendicular(s, 20)))] },
  { id: 'W2', side: 'stop', name: '1画を別の場所に', per: 'stroke', multiStrokeOnly: true, variants: [V('W2', (c, k) => one(c, k, (s) => IW.w2Shifted(s, c.bb, k)))] },
  { id: 'W3', side: 'stop', name: '1画を45%で打ち切り', per: 'stroke', multiStrokeOnly: true, variants: [V('W3', (c, k) => one(c, k, (s) => IW.w3Truncated(s)))] },
  { id: 'W4', side: 'stop', name: '1画をジグザグに(振幅30%・10往復)', per: 'stroke', multiStrokeOnly: true, variants: [V('W4', (c, k) => one(c, k, (s) => IW.w4Zigzag(s, 20)))] },
  { id: 'W5s', side: 'stop', name: '1画だけ鏡像', per: 'stroke', multiStrokeOnly: true, variants: [V('W5sH', (c, k) => one(c, k, (s) => IW.w5MirrorHorizontal(s)))] },
  { id: 'W2m', side: 'stop', name: '1画を中程度ずらす(文字枠の35%)', per: 'stroke', multiStrokeOnly: true, variants: [V('W2m', (c, k) => one(c, k, (s) => s.map((p) => ({ x: p.x + (k % 2 === 0 ? 1 : -1) * c.bb.width * 0.35, y: p.y + (k % 3 === 0 ? -1 : 1) * c.bb.height * 0.35 }))))] },
  { id: 'W5', side: 'stop', name: '全体鏡像', per: 'char', variants: [
    V('W5H', (c) => c.ideal().map((s) => IW.w5MirrorHorizontal(s))),
    V('W5V', (c) => c.ideal().map((s) => IW.w5MirrorVertical(s))),
  ] },
  { id: 'W6', side: 'stop', name: '極端な縮小', per: 'char', variants: [
    V('W6.25', (c) => IW.w6WrongScaleWholeCharacter(c.ideal(), 0.25, c.bb)),
    V('W6.40', (c) => IW.w6WrongScaleWholeCharacter(c.ideal(), 0.40, c.bb)),
  ] },
  { id: 'W3a', side: 'stop', name: '全画45%打ち切り', per: 'char', variants: [V('W3all.45', (c) => c.ideal().map((s) => IW.w3Truncated(s)))] },
  { id: 'W3b', side: 'stop', name: '全画35%打ち切り', per: 'char', variants: [V('W3all.35', (c) => c.ideal().map((s) => truncate(s, 0.35)))] },
  { id: 'W4a', side: 'stop', name: '全画ジグザグ', per: 'char', variants: [V('W4all', (c) => c.ideal().map((s) => IW.w4Zigzag(s, 20)))] },
  { id: 'W1a', side: 'stop', name: '全画を直角の線に', per: 'char', variants: [V('W1all', (c) => c.ideal().map((s) => IW.w1Perpendicular(s, 20)))] },
  { id: 'N1', side: 'stop', name: '15%だけ', per: 'char', variants: [V('tiny.15', (c) => c.ideal().map((s) => truncate(s, 0.15)))] },
  { id: 'N2', side: 'stop', name: '無関係ななぐり書き', per: 'char', variants: seeds.map((sd) => V('scribble#' + sd, (c) => {
    const rng = c.RN('scr' + sd); const bb = c.bb;
    return c.defs.map(() => { const pts = []; let x = bb.minX + rng() * bb.width, y = bb.minY + rng() * bb.height; for (let i = 0; i < 12; i++) { x += (rng() - 0.5) * bb.width * 0.6; y += (rng() - 0.5) * bb.height * 0.6; pts.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }); } return pts; });
  })) },
  { id: 'N3', side: 'stop', name: '全画を同じ横線に', per: 'char', variants: [V('hlines', (c) => c.defs.map((_, i) => Array.from({ length: 21 }, (_, j) => ({ x: c.bb.minX + c.bb.width * (0.15 + 0.7 * j / 20), y: c.bb.minY + c.bb.height * (c.n === 1 ? 0.5 : 0.2 + 0.6 * i / (c.n - 1)) }))))] },
  { id: 'N4', side: 'stop', name: '全画を同じ縦線に', per: 'char', variants: [V('vlines', (c) => c.defs.map((_, i) => Array.from({ length: 21 }, (_, j) => ({ y: c.bb.minY + c.bb.height * (0.1 + 0.8 * j / 20), x: c.bb.minX + c.bb.width * (c.n === 1 ? 0.5 : 0.2 + 0.6 * i / (c.n - 1)) }))))] },
  { id: 'N5', side: 'stop', name: '全画を丸に', per: 'char', variants: [V('circles', (c) => c.ideal().map((s) => { const b = IW.bboxOf(s); const r = Math.max(b.width, b.height, 0.08) / 2; return Array.from({ length: 30 }, (_, j) => ({ x: b.cx + r * Math.cos(6.283 * j / 29), y: b.cy + r * Math.sin(6.283 * j / 29) })); }))] },
  { id: 'X', side: 'stop', name: '別の文字(きれいに)', per: 'sibling', variants: [V('X', (c, k, src) => c.refOf(src, 40))] },
  { id: 'X2', side: 'stop', name: '別の文字(揺れ+ずれ)', per: 'sibling', variants: [V('Xw', (c, k, src) => drift(humanWobble(c.refOf(src, 48), 0.04, c.RN('xw' + src)), 0.04, c.RN('xd' + src)))] },
  { id: 'Z1', side: 'stop', name: '1画をジグザグ(振幅30%・4往復)', per: 'stroke', variants: [V('zig30x4', (c, k) => one(c, k, (s) => zigChord(s, 0.30, 4)))] },
  { id: 'Z2', side: 'stop', name: '1画をジグザグ(振幅20%・6往復)', per: 'stroke', variants: [V('zig20x6', (c, k) => one(c, k, (s) => zigChord(s, 0.20, 6)))] },
  { id: 'Z3', side: 'stop', name: '1画をお手本に沿った細かいジグザグ(幅0.03・12往復)', per: 'stroke', variants: [V('zigOn.03x12', (c, k) => one(c, k, (s) => zigOnRef(s, 0.03, 12)))] },
  { id: 'Z4', side: 'stop', name: '1画をお手本に沿ったジグザグ(幅0.05・6往復)', per: 'stroke', variants: [V('zigOn.05x6', (c, k) => one(c, k, (s) => zigOnRef(s, 0.05, 6)))] },
  { id: 'Z5', side: 'stop', name: '全画をお手本に沿ったジグザグ(幅0.04・8往復)', per: 'char', variants: [V('zigOnAll', (c) => c.ideal().map((s) => zigOnRef(s, 0.04, 8)))] },

  // ===== 境界枠 =====
  { id: 'B3a', side: 'boundary', name: '1画を50%で打ち切り', per: 'stroke', multiStrokeOnly: true, variants: [V('W3_.50', (c, k) => one(c, k, (s) => truncate(s, 0.5)))] },
  { id: 'B3b', side: 'boundary', name: '1画を55%で打ち切り', per: 'stroke', multiStrokeOnly: true, variants: [V('W3_.55', (c, k) => one(c, k, (s) => truncate(s, 0.55)))] },
  { id: 'B4', side: 'boundary', name: '1画を弱いジグザグ(振幅15%・10往復)', per: 'stroke', multiStrokeOnly: true, variants: [V('W4mild', (c, k) => one(c, k, (s) => zigChord(s, 0.15, 10)))] },
  { id: 'B5', side: 'boundary', name: '1画をまっすぐな線に', per: 'stroke', multiStrokeOnly: true, variants: [V('chord', (c, k) => one(c, k, chord))] },
  { id: 'B5a', side: 'boundary', name: '全画をまっすぐな線に', per: 'char', variants: [V('chordAll', (c) => c.ideal().map(chord))] },
];

function context(Engine, strokeData, ch) {
  const defs = strokeData[ch];
  const refOf = (d, n) => d.map((s) => Engine.sampleReferencePath(s.d, n).points.map((p) => ({ x: p.x, y: p.y })));
  return {
    ch, defs, n: defs.length, strokeData,
    base: () => refOf(defs, 48),                 // 救いたい側の土台(48点/画)
    ideal: () => refOf(defs, 40),                // 止めたい側の土台(40点/画)
    refOf: (src, n) => refOf(strokeData[src], n),
    bb: IW.bboxOf(refOf(defs, 20).flat()),
    R: (tag) => makeRng(hashStr(ch + '|' + tag)),       // 救いたい側のseed
    RN: (tag) => makeRng(hashStr(ch + '|N|' + tag)),    // 止めたい側のseed
    siblings: Object.keys(strokeData).filter((o) => o !== ch && strokeData[o].length === defs.length),
  };
}

// 定義データから導く件数(Engineを呼ばず、筆順データの画数だけから数える)
function expectedCount(strokeData, filter) {
  const chars = Object.keys(strokeData); let total = 0; const byDef = {};
  chars.forEach((ch) => {
    const n = strokeData[ch].length;
    const sib = chars.filter((o) => o !== ch && strokeData[o].length === n).length;
    DEFINITIONS.forEach((d) => {
      if (filter && !filter(d)) return;
      if (d.multiStrokeOnly && n < 2) return;
      const mult = d.per === 'char' ? 1 : d.per === 'stroke' ? n : sib;
      byDef[d.id] = (byDef[d.id] || 0) + d.variants.length * mult; total += d.variants.length * mult;
    });
  });
  return { total, byDef };
}

// 実際のなぞりデータを作る。chars を渡すとその文字だけ(並列実行用)。
function buildCases(Engine, strokeData, chars) {
  const out = [];
  (chars || Object.keys(strokeData)).forEach((ch) => {
    const c = context(Engine, strokeData, ch);
    DEFINITIONS.forEach((d) => {
      if (d.multiStrokeOnly && c.n < 2) return;
      d.variants.forEach((v) => {
        const push = (label, strokes) => out.push({ id: ch + ':' + d.id + ':' + label, ch, def: d.id, side: d.side, label, strokes });
        if (d.per === 'char') push(v.label, v.make(c));
        else if (d.per === 'stroke') for (let k = 0; k < c.n; k++) push(v.label + '#' + k, v.make(c, k));
        else c.siblings.forEach((src) => push(v.label + '<-' + src, v.make(c, null, src)));
      });
    });
  });
  return out;
}

module.exports = { DEFINITIONS, buildCases, expectedCount };
