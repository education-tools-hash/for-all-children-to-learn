// Phase T6-A — 「やさしく」(easy) 較正・回帰テスト(ひらがな46文字)
//
// 何を確かめるか(すべて満たさないと exit 1):
//   1. 件数: easy-calibration-cases.js の定義から導いた件数 == 実際に評価した件数
//   2. 本番エンジン(HTML内) と 参照実装(tools/tracing-poc/engine*.js) の判定結果が全件一致
//   3. 変更前の「やさしく」で合格していたなぞりが、不合格に変わっていない(0件)
//   4. 止めたい側(本命)で新しく合格になったものが、User承認済みの一覧と完全に一致
//   5. 境界枠で新しく合格になったものの内訳(定義ごとの件数)が、User承認済みの内訳と一致
//   6. 「ひょうじゅん」で通るのに「やさしく」で落ちる逆転が、承認済みの例外を除き 0 件
//   7. 救いたい側(+指が離れる条件)の合格率が、承認時の較正値を下回らない
//
// 判定の設定値はこのファイルに写さず、本番HTMLの TRACING_JUDGMENT_PROFILES をそのまま読む。
// 「変更前」は、同じ本番エンジンに LEGACY_EASY_OVERRIDES(Phase T6-A 以前の値)を重ねて再現する。
// 承認値(APPROVED)は 2026-11-28 の設計報告(Phase 2)でUserが承認した較正結果。ここを書き換える
// のは、再較正の結果をUserが承認したときだけ。
//
// 実行: node tools/tracing-poc/golden-tests-easy46.js            (ひらがな)
//       node tools/tracing-poc/golden-tests-katakana-easy46.js   (カタカナ)
// 1文字あたりの評価が重いため、CPU数ぶんの子プロセスに文字を分けて並列実行する(数分かかる)。
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const Cases = require('./easy-calibration-cases.js');

const REPO_ROOT = path.join(__dirname, '..', '..');

// Phase T6-A 以前の「やさしく」: 到達 0.60/0.52、Smooth Path なし。
const LEGACY_EASY_OVERRIDES = { STROKE_COMPLETION_MIN_SPAN: 0.60, STROKE_COMPLETION_CATASTROPHIC: 0.52, SMOOTH_PATH: false };

const CONFIGS = {
  hiragana: {
    title: 'Phase T6-A Easy Calibration Regression — ひらがな',
    html: 'hiragana-learn.html',
    pocEngine: './engine.js',
    fixture: './fixtures/reference-data-full.generated.js',
    APPROVED: {
      // 止めたい側(本命)の新規合格。1画の文字で形がもともと0.78すれすれだった線4件と、4往復ジグザグ1件。
      stopNewPasses: ['く:N2:scribble#1', 'く:N4:vlines', 'そ:Z1:zig30x4#0', 'の:N5:circles', 'へ:N2:scribble#1'],
      boundaryNewPassesByDef: { B3a: 7, B3b: 3, B5: 14, B5a: 4 },
      inversionExceptions: ['も:J2:mixMod#3'],
      minSavePassRatePct: 85.2,
    },
  },
  katakana: {
    title: 'Phase T6-A Easy Calibration Regression — カタカナ',
    html: 'katakana-app.html',
    pocEngine: './engine-katakana.js',
    fixture: './fixtures/reference-data-katakana.generated.js',
    APPROVED: {
      // 「ミ」を横線3本・「リ」を縦線2本(文字の形そのものに近い)と、到達の変更による中程度のずれ2件。
      stopNewPasses: ['エ:W2m:W2m#1', 'ソ:W2m:W2m#0', 'ミ:N3:hlines', 'リ:N4:vlines'],
      boundaryNewPassesByDef: { B3b: 1, B5: 10, B5a: 12 },
      inversionExceptions: [],
      minSavePassRatePct: 84.7,
    },
  },
};

// ---- 本番HTMLから、エンジン・筆順データ・判定プロファイルをメモリ上に読み込む(HTMLは書き換えない) ----
function sliceBetween(s, startMarker, endRe) {
  const a = s.indexOf(startMarker);
  if (a < 0) throw new Error('marker not found in production HTML: ' + startMarker);
  endRe.lastIndex = a;
  const m = endRe.exec(s);
  if (!m) throw new Error('end marker not found after: ' + startMarker);
  return s.slice(a, m.index + m[0].length);
}
function loadProductionApp(htmlFile) {
  const html = fs.readFileSync(path.join(REPO_ROOT, htmlFile), 'utf8');
  const engSrc = sliceBetween(html, 'const TracingEngine = (function () {', /return \{ THRESHOLDS, sampleReferencePath, evaluateCharacter, computeBBox \};\s*\}\)\(\);/g);
  const sdSrc = sliceBetween(html, 'const strokeData = {', /\n\};/g);
  const pfSrc = sliceBetween(html, 'const TRACING_JUDGMENT_PROFILES = {', /\n\};/g);
  return {
    Engine: new Function(engSrc + '\nreturn TracingEngine;')(),
    strokeData: new Function(sdSrc + '\nreturn strokeData;')(),
    profiles: new Function(pfSrc + '\nreturn TRACING_JUDGMENT_PROFILES;')(),
  };
}
const canon = (r) => JSON.stringify(r, (k, v) => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v));
const isSaveSide = (side) => side === 'save' || side === 'lift' || side === 'saveExtra';

// ---- 子プロセス: 渡された文字だけ評価して結果を親へ返す ----
function runWorker(cfg, chars) {
  const app = loadProductionApp(cfg.html);
  const Poc = require(cfg.pocEngine);
  const FIXTURE = require(cfg.fixture);
  const easy = app.profiles.easy;
  const legacy = Object.assign({}, easy, LEGACY_EASY_OVERRIDES);
  const rows = Cases.buildCases(app.Engine, app.strokeData, chars).map((c) => {
    const defs = app.strokeData[c.ch];
    const now = app.Engine.evaluateCharacter(c.strokes, defs, { allCharacters: app.strokeData, targetChar: c.ch, judgmentProfile: easy });
    const poc = Poc.evaluateCharacter(c.strokes, FIXTURE[c.ch], { allCharacters: FIXTURE, targetChar: c.ch, judgmentProfile: easy });
    const before = app.Engine.evaluateCharacter(c.strokes, defs, { allCharacters: app.strokeData, targetChar: c.ch, judgmentProfile: legacy });
    const std = isSaveSide(c.side)
      ? app.Engine.evaluateCharacter(c.strokes, defs, { allCharacters: app.strokeData, targetChar: c.ch, judgmentProfile: app.profiles.standard }).pass
      : null;
    return { id: c.id, def: c.def, side: c.side, now: now.pass, path: now.acceptancePath || 'none', before: before.pass, std, pocSame: canon(now) === canon(poc) };
  });
  process.send({ rows }, () => process.exit(0));
}

// ---- 親: 並列実行して集計・判定 ----
function main(which) {
  const cfg = CONFIGS[which];
  const t0 = Date.now();
  const app = loadProductionApp(cfg.html);
  const FIXTURE = require(cfg.fixture);
  const chars = Object.keys(app.strokeData);
  const expected = Cases.expectedCount(app.strokeData);
  const strokeDataSame = JSON.stringify(chars.map((c) => app.strokeData[c].map((s) => s.d)))
    === JSON.stringify(Object.keys(FIXTURE).map((c) => FIXTURE[c].map((s) => s.d)));

  const nWorkers = Math.max(1, Math.min(os.cpus().length, 8, chars.length));
  const chunks = Array.from({ length: nWorkers }, () => []);
  // 画数の多い文字(=評価が重い)から順に配って偏りを減らす
  chars.slice().sort((a, b) => app.strokeData[b].length - app.strokeData[a].length).forEach((ch, i) => chunks[i % nWorkers].push(ch));
  let rows = []; let done = 0; let failedWorker = false;
  chunks.forEach((chunk) => {
    const child = fork(__filename, ['--worker', which, JSON.stringify(chunk)]);
    let got = false;
    child.on('message', (m) => { got = true; rows = rows.concat(m.rows); });
    child.on('exit', (code) => {
      if (code !== 0 || !got) failedWorker = true;
      if (++done === nWorkers) report(cfg, { rows, expected, strokeDataSame, failedWorker, chars, app, ms: Date.now() - t0 });
    });
  });
}

function report(cfg, R) {
  const A = cfg.APPROVED; const rows = R.rows; const problems = [];
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
  const defById = {}; Cases.DEFINITIONS.forEach((d) => { defById[d.id] = d; });
  console.log('=== ' + cfg.title + ' ===\n');
  console.log('判定プロファイル(本番HTMLから読み込み) easy: ' + JSON.stringify(R.app.profiles.easy) + '\n');

  // 1. 件数
  console.log('--- 1. 件数(定義データから導いた件数 / 実際に評価した件数) ---');
  console.log('文字数=' + R.chars.length + '  定義数=' + Cases.DEFINITIONS.length + '  導いた件数=' + R.expected.total + '  評価した件数=' + rows.length);
  if (R.failedWorker) problems.push('子プロセスが異常終了した');
  if (rows.length !== R.expected.total) problems.push('件数不一致: 導いた件数 ' + R.expected.total + ' / 評価 ' + rows.length);
  Cases.DEFINITIONS.forEach((d) => { const n = rows.filter((r) => r.def === d.id).length; if (n !== (R.expected.byDef[d.id] || 0)) problems.push('定義 ' + d.id + ' の件数不一致: ' + (R.expected.byDef[d.id] || 0) + ' / ' + n); });

  // 2. 本番エンジンと参照実装
  const pocDiff = rows.filter((r) => !r.pocSame);
  console.log('\n--- 2. 本番エンジン と 参照実装 の一致 ---');
  console.log('筆順データ一致=' + R.strokeDataSame + '  判定結果の不一致=' + pocDiff.length + ' / ' + rows.length);
  if (!R.strokeDataSame) problems.push('本番HTMLの筆順データと fixtures が一致しない');
  if (pocDiff.length) problems.push('本番エンジンと参照実装の結果が不一致: ' + pocDiff.slice(0, 10).map((r) => r.id).join(' '));

  // 集計表
  console.log('\n--- 定義ごとの合格数(変更前のやさしく → 現在のやさしく。かっこ内は経路: 通常/救済/なめらか) ---');
  const sideName = { save: '救いたい側', saveExtra: '救いたい側(参考枠)', lift: '指が離れる', stop: '止めたい側(本命)', boundary: '境界枠' };
  ['save', 'saveExtra', 'lift', 'stop', 'boundary'].forEach((side) => {
    console.log('[' + sideName[side] + ']');
    Cases.DEFINITIONS.filter((d) => d.side === side).forEach((d) => {
      const l = rows.filter((r) => r.def === d.id); if (!l.length) return;
      const p = (k) => l.filter((r) => r.now && r.path === k).length;
      console.log('  ' + (d.id + ' ' + d.name).padEnd(40) + ' n=' + String(l.length).padStart(4) + '  ' + String(l.filter((r) => r.before).length).padStart(4) + ' → ' + String(l.filter((r) => r.now).length).padStart(4)
        + '  (' + p('normal') + '/' + p('beginner_coarse') + '/' + p('smooth') + ')' + (isSaveSide(side) ? '  ' + pct(l.filter((r) => r.before).length, l.length) + ' → ' + pct(l.filter((r) => r.now).length, l.length) : ''));
    });
  });

  // 3. 合格が不合格に変わったもの
  const lost = rows.filter((r) => r.before && !r.now);
  console.log('\n--- 3. 変更前に合格していて、不合格に変わったもの ---');
  console.log('件数=' + lost.length + (lost.length ? '  ' + lost.map((r) => r.id).join(' ') : ''));
  if (lost.length) problems.push('合格→不合格に変わったケースがある: ' + lost.length + '件');

  // 4. 止めたい側(本命)の新規合格
  const stopNew = rows.filter((r) => r.side === 'stop' && !r.before && r.now).map((r) => r.id).sort();
  const stopAll = rows.filter((r) => r.side === 'stop');
  console.log('\n--- 4. 止めたい側(本命)の新規合格(承認済みの一覧と一致すること) ---');
  console.log('評価=' + stopAll.length + '  変更前から合格=' + stopAll.filter((r) => r.before).length + '  新規合格=' + stopNew.length + '  承認済み=' + A.stopNewPasses.length);
  console.log('  新規合格: ' + (stopNew.join(' ') || '(なし)'));
  if (JSON.stringify(stopNew) !== JSON.stringify(A.stopNewPasses.slice().sort())) {
    problems.push('止めたい側の新規合格が承認済みの一覧と不一致。 余分=' + stopNew.filter((x) => !A.stopNewPasses.includes(x)).join(' ') + ' 不足=' + A.stopNewPasses.filter((x) => !stopNew.includes(x)).join(' '));
  }

  // 5. 境界枠の新規合格
  const bNew = rows.filter((r) => r.side === 'boundary' && !r.before && r.now);
  const bByDef = {}; bNew.forEach((r) => { bByDef[r.def] = (bByDef[r.def] || 0) + 1; });
  const sortObj = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  const approvedBoundaryTotal = Object.values(A.boundaryNewPassesByDef).reduce((a, b) => a + b, 0);
  console.log('\n--- 5. 境界枠の新規合格(承認済みの内訳と一致すること) ---');
  console.log('評価=' + rows.filter((r) => r.side === 'boundary').length + '  新規合格=' + bNew.length + '  承認済み=' + approvedBoundaryTotal);
  console.log('  内訳: ' + Object.keys(bByDef).sort().map((k) => k + '(' + defById[k].name + ')=' + bByDef[k]).join('  '));
  console.log('  一覧: ' + bNew.map((r) => r.id).sort().join(' '));
  if (sortObj(bByDef) !== sortObj(A.boundaryNewPassesByDef)) problems.push('境界枠の新規合格の内訳が承認済みと不一致: ' + sortObj(bByDef) + ' / 承認 ' + sortObj(A.boundaryNewPassesByDef));

  // 6. 逆転
  const inv = rows.filter((r) => isSaveSide(r.side) && r.std && !r.now).map((r) => r.id).sort();
  console.log('\n--- 6. 「ひょうじゅん」で合格・「やさしく」で不合格(逆転) ---');
  console.log('件数=' + inv.length + '  承認済みの例外=' + A.inversionExceptions.length + (inv.length ? '\n  ' + inv.join(' ') : ''));
  const invUnexpected = inv.filter((x) => !A.inversionExceptions.includes(x));
  if (invUnexpected.length) problems.push('承認されていない逆転: ' + invUnexpected.join(' '));

  // 7. 合格率
  const save = rows.filter((r) => r.side === 'save' || r.side === 'lift');
  const rate = Math.round(1000 * save.filter((r) => r.now).length / save.length) / 10;
  const rateBefore = Math.round(1000 * save.filter((r) => r.before).length / save.length) / 10;
  const extra = rows.filter((r) => r.side === 'saveExtra');
  console.log('\n--- 7. 救いたい側(+指が離れる条件)の合格率(小数1桁に丸めて承認時の較正値以上であること) ---');
  console.log('n=' + save.length + '  変更前 ' + rateBefore.toFixed(1) + '%  →  現在 ' + rate.toFixed(1) + '%   承認時の較正値 ' + A.minSavePassRatePct.toFixed(1) + '%');
  console.log('(参考枠 n=' + extra.length + '  ' + pct(extra.filter((r) => r.before).length, extra.length) + ' → ' + pct(extra.filter((r) => r.now).length, extra.length) + '  ※承認値との比較対象外)');
  if (rate < A.minSavePassRatePct) problems.push('救いたい側の合格率が承認時の較正値を下回った: ' + rate + '% < ' + A.minSavePassRatePct + '%');

  console.log('\nElapsed: ' + (R.ms / 1000).toFixed(0) + 's');
  console.log('\n=== Result ===');
  if (problems.length) { problems.forEach((p) => console.log('PROBLEM: ' + p)); console.log('PROBLEMS FOUND — see above'); process.exitCode = 1; }
  else console.log('ALL EASY CALIBRATION CHECKS PASSED');
}

function entry(which) {
  const wi = process.argv.indexOf('--worker');
  if (wi >= 0) runWorker(CONFIGS[process.argv[wi + 1]], JSON.parse(process.argv[wi + 2]));
  else main(which);
}

module.exports = { entry, CONFIGS, LEGACY_EASY_OVERRIDES };
if (require.main === module) entry('hiragana');
