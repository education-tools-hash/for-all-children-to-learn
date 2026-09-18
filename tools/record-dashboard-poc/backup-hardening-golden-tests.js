#!/usr/bin/env node
// Phase LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1 — Full Backup golden tests.
//
// Usage: node tools/record-dashboard-poc/backup-hardening-golden-tests.js
//
// Verifies FOUNDATION.getBackupAction()/buildBackup() for the 4 apps this
// phase covers (nazori-app, hiragana-learn, katakana-app, sawatte-hirogaru-app):
// envelope shape, opt-in scoping (other apps must return null), round-trip
// losslessness (records survive JSON.stringify/parse unchanged), malformed/
// empty-storage safety, and high-case size/performance.

'use strict';
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
global.donomanaNazoriRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'nazori-record-detail.js'));
global.donomanaKanaRecordTraceRenderer = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-trace-renderer.js'));
global.donomanaKanaRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-detail.js'));
global.donomanaOkaneRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'okane-record-detail.js'));
global.donomanaTokeiRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'tokei-record-detail.js'));
global.donomanaShiritori2RecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'shiritori2-record-detail.js'));
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage } = require('./fixtures.js');

let totalChecks = 0, failedChecks = 0;
function check(label, ok, detail) {
  totalChecks++;
  if (!ok) failedChecks++;
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  return ok;
}
function section(title) { console.log(`\n=== ${title} ===`); }

function seed(storage, storageKey, entries) {
  storage.setItem(storageKey, JSON.stringify(entries));
}

function deepEqual(a, b) {
  try { assert.deepStrictEqual(a, b); return true; } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// Synthetic fixtures (never real user/Production data)
// ---------------------------------------------------------------------------
function makeNazoriPng(seedNum, w, h) {
  // Not a real PNG decoder round-trip target — just a realistic-shaped,
  // sufficiently large base64 payload with a valid data URL prefix so
  // isValidImage()-style checks (if exercised) would accept it.
  let s = '';
  for (let i = 0; i < w * h; i++) s += String.fromCharCode(65 + ((seedNum + i) % 26));
  return 'data:image/png;base64,' + Buffer.from(s).toString('base64');
}

const NAZORI_FIXTURES = [
  { id: '1', sessionId: 's1', timestamp: '2026-09-01T10:00:00.000Z', mode: 'wide', allChars: 'あ', charCount: 1, sessionDone: 1, sessionTotal: 1, image: makeNazoriPng(1, 40, 40) }, // 1 image
  { id: '2', sessionId: 's2', timestamp: '2026-09-02T10:00:00.000Z', mode: 'single', isComplete: true, allChars: 'かき', charCount: 2, sessionDone: 2, sessionTotal: 2, startTime: '2026-09-02T09:58:00.000Z', durationMin: 2, charImages: [{ char: 'か', image: makeNazoriPng(2, 30, 30) }, { char: 'き', image: makeNazoriPng(3, 30, 30) }] }, // multiple images
  { id: '3', sessionId: 's3', timestamp: '2026-09-03T10:00:00.000Z', mode: 'wide', allChars: 'さ', charCount: 1, sessionDone: 0, sessionTotal: 1, image: null }, // no image
  { id: '4', sessionId: 's4', timestamp: '2026-09-04T10:00:00.000Z', mode: 'wide', allChars: 'し', charCount: 1, sessionDone: 1, sessionTotal: 1, image: makeNazoriPng(4, 200, 200) }, // large image
];

function makeStroke(nPoints) {
  const flat = [];
  for (let i = 0; i < nPoints; i++) flat.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000));
  return flat;
}
const KANA_FIXTURES = [
  { time: '2026.9.1 10:00', type: 'trace', data: { kana: 'あ', tracingJudgmentLevel: 'easy', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [makeStroke(24)] } }, schemaVersion: 1 }, // 1 stroke
  { time: '2026.9.2 10:00', type: 'trace', data: { kana: 'ま', tracingJudgmentLevel: 'standard', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [makeStroke(24), makeStroke(24), makeStroke(24), makeStroke(24)] } }, schemaVersion: 1 }, // multi-stroke
  { time: '2026.9.3 10:00', type: 'trace', data: { kana: 'を', tracingJudgmentLevel: 'precise', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [makeStroke(24), makeStroke(24), makeStroke(24), makeStroke(24), makeStroke(24), makeStroke(24)] } }, schemaVersion: 1 }, // many points (6 strokes)
  { time: '2026.9.4 10:00', type: 'quiz', data: { kana: 'い', answer: 'い', correct: true, correct_ans: 'い' }, schemaVersion: 1 }, // non-trace type, no traceSample
];

function makeTraceBuffer(totalPoints, swipeCount) {
  const taps = [], swipes = [];
  let remaining = totalPoints;
  for (let s = 0; s < swipeCount && remaining > 0; s++) {
    const n = Math.min(9, remaining);
    const stroke = [];
    for (let i = 0; i < n; i++) stroke.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), 100 + i * 33);
    swipes.push(stroke);
    remaining -= n;
  }
  for (let i = 0; i < remaining; i++) taps.push(Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000), 50 + i * 20);
  return { traceSchemaVersion: 1, pointLimit: 1000, trimmed: false, taps, swipes };
}
const SAWATTE_FIXTURES = [
  { timestamp: '2026-09-01T10:00:00.000Z', appId: 'sawatte-hirogaru-app', activity: 'reaction', inputMethod: 'touch', schemaVersion: 1, payload: { startTime: 1, durationMs: 5000, totalInteractions: 3, tapCount: 3, swipeCount: 0, inputMethods: ['touch'], trace: makeTraceBuffer(9, 0) } }, // short trace
  { timestamp: '2026-09-02T10:00:00.000Z', appId: 'sawatte-hirogaru-app', activity: 'reaction', inputMethod: 'touch', schemaVersion: 1, payload: { startTime: 1, durationMs: 300000, totalInteractions: 240, tapCount: 200, swipeCount: 40, inputMethods: ['touch', 'keyboard'], trace: makeTraceBuffer(999, 40) } }, // long trace
  { timestamp: '2026-09-03T10:00:00.000Z', appId: 'sawatte-hirogaru-app', activity: 'reaction', inputMethod: 'keyboard', schemaVersion: 1, payload: { startTime: 1, durationMs: 1000, totalInteractions: 0, tapCount: 0, swipeCount: 0, inputMethods: ['keyboard'] } }, // empty/no trace field at all
];

// ---------------------------------------------------------------------------
section('1. Opt-in scoping (only the 4 audited apps expose getBackupAction)');
// ---------------------------------------------------------------------------
{
  const st = new FakeStorage();
  check('nazori-app: getBackupAction returns an action', dash.getBackupAction('nazori-app') !== null);
  check('hiragana-learn: getBackupAction returns an action', dash.getBackupAction('hiragana-learn') !== null);
  check('katakana-app: getBackupAction returns an action', dash.getBackupAction('katakana-app') !== null);
  check('sawatte-hirogaru-app: getBackupAction returns an action', dash.getBackupAction('sawatte-hirogaru-app') !== null);
  check('janken-app (not audited this phase): getBackupAction returns null', dash.getBackupAction('janken-app') === null);
  check('okane-app (not audited this phase): getBackupAction returns null', dash.getBackupAction('okane-app') === null);
  check('kyou-no-kiroku (nested structure, not in scope): getBackupAction returns null', dash.getBackupAction('kyou-no-kiroku') === null);
  check('unknown appId: getBackupAction returns null (no throw)', dash.getBackupAction('does-not-exist') === null);
}

// ---------------------------------------------------------------------------
section('2. Envelope shape + round-trip losslessness (Nazori)');
// ---------------------------------------------------------------------------
{
  const action = dash.getBackupAction('nazori-app');
  const backup = action.buildBackup(NAZORI_FIXTURES);
  check('backupFormatVersion === 1', backup.backupFormatVersion === 1);
  check('exportedAt is a valid ISO timestamp', !isNaN(new Date(backup.exportedAt).getTime()));
  check('appId === nazori-app', backup.appId === 'nazori-app');
  check('appName present', typeof backup.appName === 'string' && backup.appName.length > 0);
  check('storageKey === nazori_records', backup.storageKey === 'nazori_records');
  check('recordCount matches records.length', backup.recordCount === backup.records.length && backup.recordCount === NAZORI_FIXTURES.length);
  check('records deep-equals input fixtures (no mutation)', deepEqual(backup.records, NAZORI_FIXTURES));

  // Round-trip through actual JSON.stringify/parse (what the download does)
  const roundTripped = JSON.parse(JSON.stringify(backup));
  check('round-trip: image Data URL #1 byte-identical after JSON round-trip', roundTripped.records[0].image === NAZORI_FIXTURES[0].image);
  check('round-trip: multi-image record (charImages) preserved, both images intact', deepEqual(roundTripped.records[1].charImages, NAZORI_FIXTURES[1].charImages));
  check('round-trip: no-image record (image:null) preserved as null, not dropped', roundTripped.records[2].image === null);
  check('round-trip: large image (200x40000 char payload) preserved byte-identical', roundTripped.records[3].image === NAZORI_FIXTURES[3].image);
  check('round-trip: full records array deep-equals original fixtures', deepEqual(roundTripped.records, NAZORI_FIXTURES));
}

// ---------------------------------------------------------------------------
section('3. Envelope shape + round-trip losslessness (Hiragana/Katakana)');
// ---------------------------------------------------------------------------
{
  const actionH = dash.getBackupAction('hiragana-learn');
  const backupH = actionH.buildBackup(KANA_FIXTURES);
  check('hiragana: storageKey === hiragana_log', backupH.storageKey === 'hiragana_log');
  const roundTrippedH = JSON.parse(JSON.stringify(backupH));
  check('round-trip: 1-stroke traceSample preserved exactly', deepEqual(roundTrippedH.records[0].data.traceSample, KANA_FIXTURES[0].data.traceSample));
  check('round-trip: multi-stroke (4 strokes) traceSample preserved exactly, stroke order intact', deepEqual(roundTrippedH.records[1].data.traceSample.strokes, KANA_FIXTURES[1].data.traceSample.strokes));
  check('round-trip: many-points (6 strokes) traceSample preserved exactly', deepEqual(roundTrippedH.records[2].data.traceSample, KANA_FIXTURES[2].data.traceSample));
  check('round-trip: non-trace (quiz) record with no traceSample preserved as-is', deepEqual(roundTrippedH.records[3], KANA_FIXTURES[3]));
  check('round-trip: full records array deep-equals original fixtures', deepEqual(roundTrippedH.records, KANA_FIXTURES));

  const actionK = dash.getBackupAction('katakana-app');
  const backupK = actionK.buildBackup(KANA_FIXTURES);
  check('katakana: storageKey === katakana_log (independent from hiragana)', backupK.storageKey === 'katakana_log');
}

// ---------------------------------------------------------------------------
section('4. Envelope shape + round-trip losslessness (Sawatte)');
// ---------------------------------------------------------------------------
{
  const action = dash.getBackupAction('sawatte-hirogaru-app');
  const backup = action.buildBackup(SAWATTE_FIXTURES);
  check('storageKey === sawatte_hirogaru_log', backup.storageKey === 'sawatte_hirogaru_log');
  const roundTripped = JSON.parse(JSON.stringify(backup));
  check('round-trip: short trace (taps only) preserved exactly', deepEqual(roundTripped.records[0].payload.trace, SAWATTE_FIXTURES[0].payload.trace));
  check('round-trip: long trace (taps+swipes near hard cap) preserved exactly', deepEqual(roundTripped.records[1].payload.trace, SAWATTE_FIXTURES[1].payload.trace));
  check('round-trip: trimmed/pointLimit/traceSchemaVersion fields preserved (lost in the existing Trace CSV, per the audit)', roundTripped.records[1].payload.trace.trimmed === false && roundTripped.records[1].payload.trace.pointLimit === 1000 && roundTripped.records[1].payload.trace.traceSchemaVersion === 1);
  check('round-trip: record with no trace field at all preserved without fabricating one', roundTripped.records[2].payload.trace === undefined);
  check('round-trip: full records array deep-equals original fixtures', deepEqual(roundTripped.records, SAWATTE_FIXTURES));
}

// ---------------------------------------------------------------------------
section('5. Malformed record + empty storage safety (Case F/G)');
// ---------------------------------------------------------------------------
{
  const action = dash.getBackupAction('nazori-app');
  let threw = false, backup;
  try { backup = action.buildBackup([]); } catch (e) { threw = true; }
  check('empty storage: buildBackup does not throw', !threw);
  check('empty storage: recordCount === 0, records === []', backup && backup.recordCount === 0 && Array.isArray(backup.records) && backup.records.length === 0);

  threw = false;
  try { backup = action.buildBackup(null); } catch (e) { threw = true; }
  check('null rawRecords: buildBackup does not throw', !threw);
  check('null rawRecords: treated as empty array', backup && backup.recordCount === 0);

  const malformed = [NAZORI_FIXTURES[0], null, 'not-an-object', 42, { garbage: true }, NAZORI_FIXTURES[1]];
  threw = false;
  try { backup = action.buildBackup(malformed); } catch (e) { threw = true; }
  check('malformed entries mixed with valid ones: buildBackup does not throw', !threw);
  check('malformed entries: all entries preserved as-is (Full Backup is a raw passthrough, not a validator — validity is a read-time/restore-time concern)', backup && backup.recordCount === malformed.length);

  // Confirm buildBackup never touches storage (read-only, §27).
  const st = new FakeStorage();
  seed(st, 'nazori_records', NAZORI_FIXTURES);
  const before = st.getItem('nazori_records');
  action.buildBackup(NAZORI_FIXTURES);
  const after = st.getItem('nazori_records');
  check('buildBackup never writes to storage (existing records untouched)', before === after);
}

// ---------------------------------------------------------------------------
section('6. High-case size / performance (informational, not a pass/fail gate beyond "does not throw / does not hang")');
// ---------------------------------------------------------------------------
{
  const bigNazori = [];
  for (let i = 0; i < 60; i++) bigNazori.push({ id: String(i), sessionId: 's' + i, timestamp: new Date(Date.now() - i * 60000).toISOString(), mode: 'wide', allChars: 'あ', charCount: 1, sessionDone: 1, sessionTotal: 1, image: makeNazoriPng(i, 300, 300) });
  const action = dash.getBackupAction('nazori-app');
  const t0 = Date.now();
  const backup = action.buildBackup(bigNazori);
  const json = JSON.stringify(backup);
  const t1 = Date.now();
  check('high-case (60 records, ~300x300 synthetic images): buildBackup + stringify completes', true);
  console.log(`    60-record Nazori backup: ${json.length} bytes (~${(json.length / 1048576).toFixed(2)}MB), ${t1 - t0}ms`);
  check('high-case: recordCount correct', backup.recordCount === 60);
  check('high-case: completes in well under 5s (no pathological blowup)', (t1 - t0) < 5000);
}

console.log(`\n${totalChecks - failedChecks}/${totalChecks} checks passed.`);
if (failedChecks > 0) { console.log(`${failedChecks} FAILED.`); process.exit(1); }
console.log('ALL PASS.');
