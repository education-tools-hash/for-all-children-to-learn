// LEARNING-RECORD-STORAGE-CAPACITY-AUDIT-1 — synthetic, offline, Node-only measurement.
// No browser, no localStorage, no Production code path is touched. Pure JSON byte-size
// arithmetic over fixture objects that mirror the *real* field shapes found in the app
// source (verified by direct code reading — see the audit report for citations).
//
// Byte-size methodology (kept consistent with the phase spec):
//   utf8  = Buffer.byteLength(json, 'utf8')      -- what actually lands on disk/in quota
//   utf16 = json.length * 2                      -- V8 in-memory approximation (upper bound)

function sizes(label, obj) {
  const json = JSON.stringify(obj);
  const utf8 = Buffer.byteLength(json, 'utf8');
  const utf16 = json.length * 2;
  return { label, utf8, utf16, json };
}

function printRow(r) {
  console.log(`${r.label.padEnd(42)} utf8=${String(r.utf8).padStart(8)}B  utf16approx=${String(r.utf16).padStart(8)}B`);
}

// ---------------------------------------------------------------------------
// 1. "Simple" flat-field records (janken / okane / tokei / shiritori2 shape family)
// ---------------------------------------------------------------------------
const jankenEntry = { timestamp: new Date().toISOString(), inputMethod: 'touch', schemaVersion: 1, payload: { mode: 'both', total: 5, correct: 4, mistakes: [] } };
const okaneEntry = { ts: new Date().toISOString(), type: 'shop', detail: '¥300のおかいもの（おつり ¥200）', schemaVersion: 1 };
const tokeiEntry = { timestamp: new Date().toISOString(), activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'normal', mode: 'both', total: 8, correct: 6, retried: 2, avgTimeSec: 3.4, durationSec: 42 } };
const shiritoriEntry = { timestamp: new Date().toISOString(), activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 10, total: 10, correct: 8, score: 90, maxStreak: 6, chainLength: 8, outcome: 'completed', durationSec: 45 } };

// ---------------------------------------------------------------------------
// 2. Sawatte "Timed Interaction Trace" (sawatte-hirogaru-app.html) — code-verified shape:
//    traceBuffer = { taps:[x,y,t,...], swipes:[[x,y,t,...],...], totalPoints, trimmed }
//    TRACE_HARD_CAP = 1000 total points (already bounded in Production code today).
// ---------------------------------------------------------------------------
function makeTraceBuffer(totalPoints, swipeCount) {
  const taps = [];
  const swipes = [];
  let remaining = totalPoints;
  const perSwipe = Math.max(3, Math.floor((totalPoints * 0.7) / Math.max(1, swipeCount)));
  for (let s = 0; s < swipeCount && remaining > 0; s++) {
    const n = Math.min(perSwipe, remaining);
    const stroke = [];
    for (let i = 0; i < n; i++) { stroke.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), 100 + i * 33); }
    swipes.push(stroke);
    remaining -= n;
  }
  for (let i = 0; i < remaining; i++) { taps.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), 50 + i * 20); }
  return { taps, swipes, totalPoints, trimmed: false };
}
const sawatteTypical = { activity: 'reaction', inputMethod: 'touch', schemaVersion: 1, payload: { startTime: Date.now(), tapCount: 40, swipeCount: 8, totalInteractions: 48, inputMethods: ['touch'], durationSec: 90, trace: makeTraceBuffer(150, 8) } };
const sawatteHardCap = { activity: 'reaction', inputMethod: 'touch', schemaVersion: 1, payload: { startTime: Date.now(), tapCount: 200, swipeCount: 40, totalInteractions: 240, inputMethods: ['touch', 'keyboard'], durationSec: 300, trace: makeTraceBuffer(1000, 40) } };

// ---------------------------------------------------------------------------
// 3. Hiragana/Katakana "Canvas Stroke Trace" (hiragana-learn.html) — code-verified shape:
//    traceSample = { version:1, coordinateSpace:'normalized-1000', strokes:[[48 ints],...] }
//    TRACE_SAMPLE_POINTS_PER_STROKE = 24 (=> 48 quantized ints per stroke).
// ---------------------------------------------------------------------------
function makeTraceSample(strokeCount) {
  const strokes = [];
  for (let s = 0; s < strokeCount; s++) {
    const flat = [];
    for (let i = 0; i < 24; i++) flat.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000));
    strokes.push(flat);
  }
  return { version: 1, coordinateSpace: 'normalized-1000', strokes };
}
const kanaEntry2stroke = { timestamp: new Date().toISOString(), activity: 'trace', inputMethod: 'touch', schemaVersion: 1, payload: { kana: 'あ', level: 'easy', pass: true, score: 92, durationSec: 12, traceSample: makeTraceSample(2) } };
const kanaEntry4stroke = { timestamp: new Date().toISOString(), activity: 'trace', inputMethod: 'touch', schemaVersion: 1, payload: { kana: 'ま', level: 'normal', pass: true, score: 78, durationSec: 18, traceSample: makeTraceSample(4) } };

// ---------------------------------------------------------------------------
// 4. Nazori "Raster Image" — real image byte size is measured separately in a real
//    browser (see quota-exhaustion-test.py, which also reports actual toDataURL()
//    sizes for representative 1-cell and 5-cell-wide canvases). Placeholder sizes
//    below use those browser-measured base64 lengths, substituted by hand after
//    running that script once (documented in the audit report, not invented here).
// ---------------------------------------------------------------------------
function makeNazoriEntry(fakeImageBytes) {
  const b64 = 'A'.repeat(fakeImageBytes); // placeholder body of the right LENGTH only, for wrapper-overhead measurement
  return { timestamp: new Date().toISOString(), kana: 'あ', sessionDone: 3, sessionTotal: 5, image: 'data:image/png;base64,' + b64 };
}

const rows = [
  sizes('janken (L1, no L3)', jankenEntry),
  sizes('okane (L1/L2 minimal)', okaneEntry),
  sizes('tokei (L1/L2)', tokeiEntry),
  sizes('shiritori2 (L1/L2)', shiritoriEntry),
  sizes('sawatte typical session (150pt trace)', sawatteTypical),
  sizes('sawatte TRACE_HARD_CAP session (1000pt)', sawatteHardCap),
  sizes('hiragana/katakana 2-stroke char', kanaEntry2stroke),
  sizes('hiragana/katakana 4-stroke char', kanaEntry4stroke),
];

console.log('=== Per-record JSON byte size (single record, as it would sit inside the storageKey array) ===');
rows.forEach(printRow);

console.log('\n=== Nazori wrapper overhead (excluding image payload itself; see browser measurement for real image bytes) ===');
const nazoriWrapper = sizes('nazori entry wrapper only (0-byte image)', makeNazoriEntry(0));
printRow(nazoriWrapper);

module.exports = { sizes, rows, nazoriWrapperOverhead: nazoriWrapper.utf8 };
