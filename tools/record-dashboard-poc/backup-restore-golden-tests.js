#!/usr/bin/env node
// Phase LEARNING-RECORD-STORAGE-BACKUP-RESTORE-IMPLEMENTATION-1 — Restore golden tests.
//
// Usage: node tools/record-dashboard-poc/backup-restore-golden-tests.js
//
// Pure-function tests (no browser) for FOUNDATION.checkBackupFileSize /
// planBackupRestore / executeBackupRestore, using injected stub storages so
// every failure path (quota, security, unknown, stale, read-back mismatch,
// rollback failure) is exercised deterministically. Design source of truth:
// docs/records/learning-record-storage-backup-restore-design-v1_0.md.
// All fixtures are synthetic. Nothing here touches a real localStorage.

'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
global.donomanaNazoriRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'nazori-record-detail.js'));
global.donomanaKanaRecordTraceRenderer = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-trace-renderer.js'));
global.donomanaKanaRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-detail.js'));
global.donomanaOkaneRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'okane-record-detail.js'));
global.donomanaTokeiRecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'tokei-record-detail.js'));
global.donomanaShiritori2RecordDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'shiritori2-record-detail.js'));
const sawatteDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'sawatte-hirogaru-record-detail.js'));
global.donomanaSawatteHirogaruRecordDetail = sawatteDetail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));

let totalChecks = 0, failedChecks = 0;
function check(label, ok, detail) {
  totalChecks++;
  if (!ok) failedChecks++;
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  return ok;
}
function section(title) { console.log(`\n=== ${title} ===`); }
function deepEqual(a, b) { try { assert.deepStrictEqual(a, b); return true; } catch (e) { return false; } }

// ---------------------------------------------------------------------------
// Stub storages
// ---------------------------------------------------------------------------
function mem(initial) {
  const m = Object.assign({}, initial || {});
  return {
    m, sets: 0, removes: 0,
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { this.sets++; m[k] = String(v); },
    removeItem(k) { this.removes++; delete m[k]; }
  };
}
function errNamed(name, code) { const e = new Error('synthetic ' + name); e.name = name; if (code !== undefined) e.code = code; return e; }
function failingSet(initial, err) { const s = mem(initial); s.setItem = function () { this.sets++; throw err; }; return s; }

// ---------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------
const PNG_HEAD = 'data:image/png;base64,iVBORw0KGgoAAAAN';   // 16 base64 chars: PNG magic, length % 4 === 0
const png = (quads) => PNG_HEAD + 'AAAA'.repeat(quads || 4);
const ISO = (d) => new Date(Date.UTC(2026, 2, 1, 0, d, 0)).toISOString();   // d minutes after 2026-03-01T00:00Z
const kanaTime = (d) => '2026/3/' + (1 + Math.floor(d / 1440)) + ' ' + String(Math.floor((d % 1440) / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0');

const nazoriRec = (i, over) => Object.assign({ id: 'nz-' + i, sessionId: 's-' + i, timestamp: ISO(i), mode: 'wide', allChars: 'あ', charCount: 1, sessionDone: 1, sessionTotal: 1, image: png(2) }, over || {});
const kanaRec = (i, over) => Object.assign({ time: kanaTime(i), type: 'trace', data: { kana: 'あ', tracingJudgmentLevel: 'easy', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[1, 2, 3, 4]] } }, schemaVersion: 1 }, over || {});
const sawRec = (i, over) => Object.assign({ timestamp: ISO(i), appId: 'sawatte-hirogaru-app', activity: 'reaction', inputMethod: 'touch', schemaVersion: 1, payload: { startTime: 1, durationMs: 5000, totalInteractions: 3, tapCount: 3, swipeCount: 1, inputMethods: ['touch'], trace: { traceSchemaVersion: 1, pointLimit: 1000, trimmed: false, taps: [1, 2, 3, 4, 5, 6], swipes: [[10, 20, 30, 40, 50, 60]] } } }, over || {});

const APPS = {
  'nazori-app': { key: 'nazori_records', rec: nazoriRec, cap: 60 },
  'hiragana-learn': { key: 'hiragana_log', rec: kanaRec, cap: null },
  'katakana-app': { key: 'katakana_log', rec: kanaRec, cap: null },
  'sawatte-hirogaru-app': { key: 'sawatte_hirogaru_log', rec: sawRec, cap: 200 }
};
function envelope(appId, records, over) {
  return Object.assign({
    backupFormatVersion: 1, exportedAt: '2026-03-15T03:00:00.000Z', appId: appId, appName: 'x',
    storageKey: APPS[appId].key, recordCount: records.length, records: records
  }, over || {});
}
const txt = (o) => JSON.stringify(o);
function plan(appId, records, existing, over) {
  const s = mem(existing === undefined ? {} : { [APPS[appId].key]: JSON.stringify(existing) });
  const r = dash.planBackupRestore(txt(envelope(appId, records, over)), { storage: s });
  return { r, s };
}
function rej(r, code) { return r.ok === false && r.code === code; }

// ═══════════════════════════════════════════════════════════════
section('1. File size gate (checked BEFORE the file is read or parsed)');
// ═══════════════════════════════════════════════════════════════
{
  const MB = 1024 * 1024;
  check('0 bytes: ok', dash.checkBackupFileSize(0).level === 'ok');
  check('exactly 3MB: ok (warning starts ABOVE 3MB)', dash.checkBackupFileSize(3 * MB).level === 'ok');
  check('3MB + 1 byte: warn', dash.checkBackupFileSize(3 * MB + 1).level === 'warn');
  check('exactly 10MB: warn (allowed)', dash.checkBackupFileSize(10 * MB).level === 'warn');
  check('10MB + 1 byte: reject', dash.checkBackupFileSize(10 * MB + 1).level === 'reject');
  check('negative / NaN / Infinity / string / undefined: reject', [-1, NaN, Infinity, '5', undefined, null].every((v) => dash.checkBackupFileSize(v).level === 'reject'));
  check('limits reported: 3MB warn / 10MB max', dash.checkBackupFileSize(1).warnBytes === 3 * MB && dash.checkBackupFileSize(1).maxBytes === 10 * MB);
  const s = mem();
  check('text longer than the hard limit is rejected by the planner too (defence in depth)', rej(dash.planBackupRestore('x'.repeat(10 * MB + 1), { storage: s }), 'file-too-large'));
}

// ═══════════════════════════════════════════════════════════════
section('2. Envelope validation: fail closed, nothing written');
// ═══════════════════════════════════════════════════════════════
{
  const good = envelope('nazori-app', [nazoriRec(1)]);
  const t = (mut) => { const o = JSON.parse(JSON.stringify(good)); mut(o); const s = mem(); const r = dash.planBackupRestore(JSON.stringify(o), { storage: s }); return { r, s }; };
  check('valid envelope is accepted', dash.planBackupRestore(txt(good), { storage: mem() }).ok === true);
  for (const [label, text] of [['empty string', ''], ['whitespace', '   '], ['malformed JSON', '{not json'], ['truncated JSON', txt(good).slice(0, 40)], ['plain text', 'hello']]) {
    check('not JSON (' + label + ') -> not-json', rej(dash.planBackupRestore(text, { storage: mem() }), 'not-json'));
  }
  check('non-string input -> not-json', rej(dash.planBackupRestore(undefined, { storage: mem() }), 'not-json') && rej(dash.planBackupRestore(null, { storage: mem() }), 'not-json'));
  for (const [label, text] of [['array root', '[]'], ['null root', 'null'], ['number root', '5'], ['string root', '"x"']]) {
    check('root is not an object (' + label + ') -> bad-envelope', rej(dash.planBackupRestore(text, { storage: mem() }), 'bad-envelope'));
  }
  // version
  check('backupFormatVersion missing -> unsupported-version', rej(t((o) => { delete o.backupFormatVersion; }).r, 'unsupported-version'));
  check('backupFormatVersion 0 -> unsupported-version', rej(t((o) => { o.backupFormatVersion = 0; }).r, 'unsupported-version'));
  check('backupFormatVersion "1" (string) -> unsupported-version', rej(t((o) => { o.backupFormatVersion = '1'; }).r, 'unsupported-version'));
  check('backupFormatVersion 1.5 -> unsupported-version', rej(t((o) => { o.backupFormatVersion = 1.5; }).r, 'unsupported-version'));
  const fut = t((o) => { o.backupFormatVersion = 2; }).r;
  check('future version 2 -> unsupported-version flagged future', rej(fut, 'unsupported-version') && fut.future === true);
  check('older/garbage version -> unsupported-version NOT flagged future', t((o) => { o.backupFormatVersion = -3; }).r.future === undefined);
  // app
  for (const bad of ['janken-app', 'tokei-app', 'unknown-app', '', 'NAZORI-APP', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'nazori-app ']) {
    check('appId ' + JSON.stringify(bad) + ' -> wrong-app', rej(t((o) => { o.appId = bad; }).r, 'wrong-app'));
  }
  for (const bad of [null, 5, {}, [], true]) {
    check('appId non-string ' + JSON.stringify(bad) + ' -> wrong-app', rej(t((o) => { o.appId = bad; }).r, 'wrong-app'));
  }
  check('appId missing -> wrong-app', rej(t((o) => { delete o.appId; }).r, 'wrong-app'));
  // key
  check('storageKey of another app (hiragana_log) -> wrong-key', rej(t((o) => { o.storageKey = 'hiragana_log'; }).r, 'wrong-key'));
  check('storageKey missing -> wrong-key', rej(t((o) => { delete o.storageKey; }).r, 'wrong-key'));
  check('storageKey unrelated site key -> wrong-key, and that key is untouched', (() => {
    const s = mem({ donomana_settings: 'KEEP' });
    const o = JSON.parse(txt(good)); o.storageKey = 'donomana_settings';
    const r = dash.planBackupRestore(JSON.stringify(o), { storage: s });
    return rej(r, 'wrong-key') && s.m.donomana_settings === 'KEEP' && s.sets === 0 && s.removes === 0;
  })());
  check('storageKey "nazori_records " (trailing space) -> wrong-key', rej(t((o) => { o.storageKey = 'nazori_records '; }).r, 'wrong-key'));
  // records / count
  check('records missing -> bad-envelope', rej(t((o) => { delete o.records; }).r, 'bad-envelope'));
  check('records null -> bad-envelope', rej(t((o) => { o.records = null; }).r, 'bad-envelope'));
  check('records object -> bad-envelope', rej(t((o) => { o.records = {}; }).r, 'bad-envelope'));
  check('recordCount mismatch (too small) -> bad-envelope', rej(t((o) => { o.recordCount = 0; }).r, 'bad-envelope'));
  check('recordCount mismatch (too large: truncated file) -> bad-envelope', rej(t((o) => { o.recordCount = 9; }).r, 'bad-envelope'));
  check('recordCount string "1" -> bad-envelope', rej(t((o) => { o.recordCount = '1'; }).r, 'bad-envelope'));
  check('recordCount missing -> bad-envelope', rej(t((o) => { delete o.recordCount; }).r, 'bad-envelope'));
  // exportedAt
  check('exportedAt missing -> bad-envelope', rej(t((o) => { delete o.exportedAt; }).r, 'bad-envelope'));
  check('exportedAt unparseable -> bad-envelope', rej(t((o) => { o.exportedAt = 'yesterday-ish'; }).r, 'bad-envelope'));
  check('exportedAt number -> bad-envelope', rej(t((o) => { o.exportedAt = 12345; }).r, 'bad-envelope'));
  // appName is display only
  check('appName wrong/missing does NOT matter (display only)', t((o) => { o.appName = 'ほかのアプリ'; }).r.ok === true && t((o) => { delete o.appName; }).r.ok === true);
  // too many records
  const many = { backupFormatVersion: 1, exportedAt: good.exportedAt, appId: 'hiragana-learn', storageKey: 'hiragana_log', recordCount: 20001, records: new Array(20001).fill(0) };
  check('more than 20000 records -> bad-envelope (before any per-record work)', rej(dash.planBackupRestore(JSON.stringify(many), { storage: mem() }), 'bad-envelope'));
  // rejection never writes
  check('every rejection above left storage untouched (no writes at all)', (() => {
    const s = mem();
    ['{', '[]', '{"backupFormatVersion":9}', txt(envelope('nazori-app', [nazoriRec(1)], { appId: 'janken-app' }))].forEach((x) => dash.planBackupRestore(x, { storage: s }));
    return s.sets === 0 && s.removes === 0;
  })());
}

// ═══════════════════════════════════════════════════════════════
section('3. Untrusted-JSON safety (prototype pollution, depth, odd values)');
// ═══════════════════════════════════════════════════════════════
{
  const s = mem();
  const raw = '{"backupFormatVersion":1,"exportedAt":"2026-03-15T03:00:00.000Z","appId":"nazori-app","appName":"x","storageKey":"nazori_records","recordCount":1,"records":[{"timestamp":"2026-03-01T00:00:00.000Z","__proto__":{"polluted":"yes"}}]}';
  const r = dash.planBackupRestore(raw, { storage: s });
  check('record with a "__proto__" key -> rejected', r.ok === false);
  check('Object.prototype was not polluted', ({}).polluted === undefined);
  check('"constructor" key inside a record -> rejected', dash.planBackupRestore(txt(envelope('nazori-app', [Object.assign(nazoriRec(1), { constructor: { prototype: { x: 1 } } })])).replace('"constructor"', '"constructor"'), { storage: mem() }).ok === false);
  check('"prototype" key deep inside a record -> rejected', dash.planBackupRestore(txt(envelope('hiragana-learn', [kanaRec(1, { data: { kana: 'あ', a: { b: { prototype: 1 } } } })])), { storage: mem() }).ok === false);
  check('"__proto__" at the envelope root -> rejected', dash.planBackupRestore(raw.replace('"appName":"x"', '"__proto__":{"a":1}'), { storage: mem() }).ok === false);
  let deep = {}; let cur = deep; for (let i = 0; i < 40; i++) { cur.n = {}; cur = cur.n; }
  check('nesting deeper than the limit -> rejected (no stack blowup)', dash.planBackupRestore(txt(envelope('hiragana-learn', [kanaRec(1, { data: { kana: 'あ', deep: deep } })])), { storage: mem() }).ok === false);
  // Built as text: JSON.stringify() itself would overflow the stack on this input.
  const bomb = '{"backupFormatVersion":1,"records":' + '['.repeat(100000) + ']'.repeat(100000) + '}';
  let survived = true, bombResult = null;
  try { bombResult = dash.planBackupRestore(bomb, { storage: mem() }); } catch (e) { survived = false; }
  check('a 100000-level nested-array bomb is rejected cleanly (no throw, no stack overflow)', survived && bombResult && bombResult.ok === false);
  check('Object.prototype still clean after all of the above', Object.keys(Object.prototype).length === 0 && ({}).polluted === undefined && ({}).x === undefined);
}

// ═══════════════════════════════════════════════════════════════
section('4. Nazori record validation');
// ═══════════════════════════════════════════════════════════════
{
  const ok = (rec) => plan('nazori-app', [rec]).r.ok === true;
  const bad = (rec) => rej(plan('nazori-app', [rec]).r, 'invalid-records');
  check('valid record accepted', ok(nazoriRec(1)));
  check('record without id (legacy) accepted', ok((() => { const r = nazoriRec(1); delete r.id; return r; })()));
  check('record without image accepted (image is optional)', ok((() => { const r = nazoriRec(1); delete r.image; return r; })()));
  check('unknown extra fields are preserved and accepted', ok(nazoriRec(1, { futureField: { a: 1 } })));
  check('missing timestamp rejected', bad((() => { const r = nazoriRec(1); delete r.timestamp; return r; })()));
  check('unparseable timestamp rejected', bad(nazoriRec(1, { timestamp: 'later' })));
  check('numeric timestamp rejected', bad(nazoriRec(1, { timestamp: 1700000000000 })));
  check('id of wrong type rejected', bad(nazoriRec(1, { id: 5 })) && bad(nazoriRec(1, { id: '' })) && bad(nazoriRec(1, { id: 'x'.repeat(201) })));
  check('sessionId of wrong type rejected', bad(nazoriRec(1, { sessionId: 5 })));
  check('schemaVersion 2 rejected; absent/1 accepted', bad(nazoriRec(1, { schemaVersion: 2 })) && ok(nazoriRec(1, { schemaVersion: 1 })));
  for (const [label, image] of [
    ['SVG data URL', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['JPEG data URL', 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
    ['javascript: URL', 'javascript:alert(1)'],
    ['http URL', 'http://example.com/a.png'],
    ['non-base64 payload', 'data:image/png;base64,iVBORw0KGgo!!!!'],
    ['base64 with whitespace', 'data:image/png;base64,iVBORw0KGgoAAAAN AAAA'],
    ['length not a multiple of 4', 'data:image/png;base64,iVBORw0KGgoAAAANAAA'],
    ['no PNG magic (valid base64)', 'data:image/png;base64,AAAAAAAAAAAAAAAA'],
    ['empty payload', 'data:image/png;base64,'],
    ['prefix only wrong case', 'DATA:image/png;base64,iVBORw0KGgoAAAAN'],
    ['non-string', 12345],
    ['null', null],
    ['object', { a: 1 }]
  ]) check('image rejected: ' + label, bad(nazoriRec(1, { image })));
  check('padded base64 (= / ==) accepted', ok(nazoriRec(1, { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' })));
  check('multi-image record (isComplete + charImages) accepted', ok(nazoriRec(1, { isComplete: true, charImages: [{ char: 'あ', image: png(2) }, { char: 'い', image: png(3) }] })));
  check('charImages not an array rejected', bad(nazoriRec(1, { charImages: 'x' })));
  check('charImages containing a bad image rejected (whole backup rejected)', bad(nazoriRec(1, { charImages: [{ char: 'あ', image: png(2) }, { char: 'い', image: 'javascript:1' }] })));
  check('charImages entry that is not an object rejected', bad(nazoriRec(1, { charImages: ['x'] })));
  check('charImages char of wrong type rejected', bad(nazoriRec(1, { charImages: [{ char: 5, image: png(2) }] })));
  check('non-object records rejected (null, number, string, array)', [null, 5, 'x', [], true].every((v) => bad(v)));
  check('image larger than the per-image limit rejected', bad(nazoriRec(1, { image: PNG_HEAD + 'AAAA'.repeat(2100000) })));
  // cross-check with the app's own display validators: what Restore accepts must render
  check('accepted Nazori image is also valid for the dashboard renderer (donomanaNazoriRecordDetail)', global.donomanaNazoriRecordDetail.hasAnyValidImage(nazoriRec(1)) === true);
}

// ═══════════════════════════════════════════════════════════════
section('5. Hiragana / Katakana record validation');
// ═══════════════════════════════════════════════════════════════
for (const appId of ['hiragana-learn', 'katakana-app']) {
  const ok = (rec) => plan(appId, [rec]).r.ok === true;
  const bad = (rec) => rej(plan(appId, [rec]).r, 'invalid-records');
  const withTs = (ts) => kanaRec(1, { data: { kana: 'あ', traceSample: ts } });
  const TS = () => ({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[1, 2, 3, 4]] });
  check(appId + ': valid trace record accepted', ok(kanaRec(1)));
  check(appId + ': multi-stroke trace accepted', ok(withTs({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[0, 0, 1000, 1000], [500, 500, 10, 20, 30, 40]] })));
  check(appId + ': legacy trace record with no traceSample accepted', ok(kanaRec(1, { data: { kana: 'あ' } })));
  check(appId + ': quiz record accepted', ok(kanaRec(1, { type: 'quiz', data: { kana: 'あ', answer: 'あ', correct: true, correct_ans: 'あ' } })));
  check(appId + ': record with no schemaVersion (legacy v1) accepted', ok((() => { const r = kanaRec(1); delete r.schemaVersion; return r; })()));
  check(appId + ': schemaVersion 2 rejected', bad(kanaRec(1, { schemaVersion: 2 })));
  check(appId + ': time missing/unparseable/number rejected', bad((() => { const r = kanaRec(1); delete r.time; return r; })()) && bad(kanaRec(1, { time: 'あした' })) && bad(kanaRec(1, { time: 20260301 })));
  check(appId + ': type missing/empty/non-string rejected', bad((() => { const r = kanaRec(1); delete r.type; return r; })()) && bad(kanaRec(1, { type: '' })) && bad(kanaRec(1, { type: 7 })));
  check(appId + ': data missing/array/null/string rejected', [undefined, [], null, 'x'].every((d) => bad(kanaRec(1, { data: d }))));
  check(appId + ': traceSample null rejected', bad(withTs(null)));
  check(appId + ': traceSample not an object rejected', bad(withTs('x')) && bad(withTs([])));
  check(appId + ': version 2 / missing rejected', bad(Object.assign(TS(), { version: 2 })) && bad((() => { const t = TS(); delete t.version; return withTs(t); })().data.traceSample ? withTs((() => { const t = TS(); delete t.version; return t; })()) : null));
  check(appId + ': wrong coordinateSpace rejected', bad(withTs(Object.assign(TS(), { coordinateSpace: 'pixels' }))));
  check(appId + ': strokes empty / not array rejected', bad(withTs(Object.assign(TS(), { strokes: [] }))) && bad(withTs(Object.assign(TS(), { strokes: 'x' }))));
  check(appId + ': a stroke that is empty / not an array rejected', bad(withTs(Object.assign(TS(), { strokes: [[]] }))) && bad(withTs(Object.assign(TS(), { strokes: ['ab'] }))));
  check(appId + ': odd-length stroke (x without y) rejected', bad(withTs(Object.assign(TS(), { strokes: [[1, 2, 3]] }))));
  check(appId + ': non-numeric coordinate rejected', bad(withTs(Object.assign(TS(), { strokes: [[1, 2, '3', 4]] }))) && bad(withTs(Object.assign(TS(), { strokes: [[1, 2, null, 4]] }))));
  check(appId + ': out-of-range coordinates rejected (-1, 1001)', bad(withTs(Object.assign(TS(), { strokes: [[-1, 2, 3, 4]] }))) && bad(withTs(Object.assign(TS(), { strokes: [[1, 2, 3, 1001]] }))));
  check(appId + ': boundary coordinates 0 and 1000 accepted', ok(withTs(Object.assign(TS(), { strokes: [[0, 1000, 1000, 0]] }))));
  check(appId + ': too many strokes (101) rejected', bad(withTs(Object.assign(TS(), { strokes: new Array(101).fill([1, 2]) }))));
  check(appId + ': absurdly long stroke (2002 numbers) rejected', bad(withTs(Object.assign(TS(), { strokes: [new Array(2002).fill(5)] }))));
  check(appId + ': accepted record is also a valid trace for the dashboard renderer (donomanaKanaRecordDetail)', global.donomanaKanaRecordDetail.hasAnyValidTrace(kanaRec(1)) === true);
  check(appId + ': every real-shape stroke the app writes (24 points = 48 numbers) accepted', ok(withTs(Object.assign(TS(), { strokes: [new Array(48).fill(500), new Array(48).fill(0)] }))));
}

// ═══════════════════════════════════════════════════════════════
section('6. Sawatte Hirogaru record validation');
// ═══════════════════════════════════════════════════════════════
{
  const ok = (rec) => plan('sawatte-hirogaru-app', [rec]).r.ok === true;
  const bad = (rec) => rej(plan('sawatte-hirogaru-app', [rec]).r, 'invalid-records');
  const tr = (over) => ({ traceSchemaVersion: 1, pointLimit: 1000, trimmed: false, taps: [1, 2, 3], swipes: [[1, 2, 3]] , ...(over || {}) });
  const withTrace = (t) => sawRec(1, { payload: { startTime: 1, durationMs: 5, trace: t } });
  check('valid record accepted', ok(sawRec(1)));
  check('record with NO trace accepted (no interactions)', ok(sawRec(1, { payload: { startTime: 1, durationMs: 0 } })));
  check('empty taps + empty swipes accepted', ok(withTrace(tr({ taps: [], swipes: [] }))));
  check('trimmed=true accepted', ok(withTrace(tr({ trimmed: true }))));
  check('wrong record appId rejected', bad(sawRec(1, { appId: 'janken-app' })));
  check('missing/unparseable timestamp rejected', bad((() => { const r = sawRec(1); delete r.timestamp; return r; })()) && bad(sawRec(1, { timestamp: 'x' })));
  check('activity missing/empty rejected', bad((() => { const r = sawRec(1); delete r.activity; return r; })()) && bad(sawRec(1, { activity: '' })));
  check('payload missing/array/null rejected', [undefined, [], null, 'x'].every((p) => bad(sawRec(1, { payload: p }))));
  check('schemaVersion 2 rejected', bad(sawRec(1, { schemaVersion: 2 })));
  check('traceSchemaVersion 2 / missing rejected', bad(withTrace(tr({ traceSchemaVersion: 2 }))) && bad(withTrace((() => { const t = tr(); delete t.traceSchemaVersion; return t; })())));
  check('pointLimit missing/non-number/0/10001 rejected', [undefined, '1000', 0, 10001, -5].every((v) => bad(withTrace(tr({ pointLimit: v })))));
  check('trimmed non-boolean rejected', bad(withTrace(tr({ trimmed: 'no' }))) && bad(withTrace(tr({ trimmed: 0 }))));
  check('taps length not a multiple of 3 rejected', bad(withTrace(tr({ taps: [1, 2, 3, 4] }))));
  check('taps not an array rejected', bad(withTrace(tr({ taps: 'x' }))) && bad(withTrace(tr({ taps: null }))));
  check('tap x/y out of 0..1000 rejected; t may exceed 1000 but not be negative', bad(withTrace(tr({ taps: [1001, 2, 3] }))) && bad(withTrace(tr({ taps: [-1, 2, 3] }))) && ok(withTrace(tr({ taps: [10, 20, 99999] }))) && bad(withTrace(tr({ taps: [10, 20, -1] }))));
  check('non-numeric tap value rejected', bad(withTrace(tr({ taps: [1, 2, '3'] }))));
  check('swipes not an array rejected', bad(withTrace(tr({ swipes: 'x' }))) && bad(withTrace(tr({ swipes: {} }))));
  check('a swipe that is empty / not an array / bad length / bad value rejected', bad(withTrace(tr({ swipes: [[]] }))) && bad(withTrace(tr({ swipes: ['abc'] }))) && bad(withTrace(tr({ swipes: [[1, 2]] }))) && bad(withTrace(tr({ swipes: [[1, 2, 'x']] }))));
  check('too many swipes (2001) rejected', bad(withTrace(tr({ swipes: new Array(2001).fill([1, 2, 3]) }))));
  check('trace as a non-object rejected', bad(withTrace('x')) && bad(withTrace(null)) && bad(withTrace([])));
  check('accepted trace is also valid for the dashboard renderer (isValidTrace)', sawatteDetail.isValidTrace(sawRec(1).payload.trace) === true);
}

// ═══════════════════════════════════════════════════════════════
section('7. Invalid records: ONE bad record rejects the whole backup (Gate C), nothing written');
// ═══════════════════════════════════════════════════════════════
{
  for (const appId of Object.keys(APPS)) {
    const recs = [1, 2, 3, 4, 5].map((i) => APPS[appId].rec(i));
    const key = appId === 'nazori-app' ? 'image' : (appId === 'sawatte-hirogaru-app' ? 'payload' : 'data');
    recs[2] = Object.assign({}, recs[2], { [key]: null });
    const s = mem();
    const r = dash.planBackupRestore(txt(envelope(appId, recs)), { storage: s });
    check(appId + ': 1 bad record among 5 -> rejected as invalid-records with invalidCount 1', rej(r, 'invalid-records') && r.invalidCount === 1, JSON.stringify(r));
    check(appId + ': no valid-only partial restore is offered (no plan returned) and storage untouched', r.plan === undefined && s.sets === 0 && s.removes === 0);
  }
  const s2 = mem();
  const r2 = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1, { image: 'x' }), nazoriRec(2, { image: 'y' }), nazoriRec(3)])), { storage: s2 });
  check('invalidCount counts every bad record (2 of 3)', rej(r2, 'invalid-records') && r2.invalidCount === 2);
}

// ═══════════════════════════════════════════════════════════════
section('8. Duplicate / conflict / new classification');
// ═══════════════════════════════════════════════════════════════
{
  // Case A: empty target
  let { r } = plan('nazori-app', [1, 2, 3].map(nazoriRec));
  check('A: existing 0, backup 3 -> 3 new, 0 duplicates, 0 conflicts', r.ok && r.plan.addCount === 3 && r.plan.duplicateCount === 0 && r.plan.conflictCount === 0 && r.plan.newCount === 3);
  // Case B: exact duplicates
  r = plan('nazori-app', [1, 2, 3].map(nazoriRec), [1, 2, 3].map(nazoriRec)).r;
  check('B: identical existing -> 0 added, 3 duplicates skipped, nothing to write', r.ok && r.plan.addCount === 0 && r.plan.duplicateCount === 3 && r.plan.serialized === null);
  // Case C: partial
  r = plan('nazori-app', [1, 2, 3, 4, 5].map(nazoriRec), [1, 2, 3].map(nazoriRec)).r;
  check('C: existing 3, backup 5 (2 new) -> 2 added, 3 duplicates', r.ok && r.plan.addCount === 2 && r.plan.duplicateCount === 3 && r.plan.finalCount === 5);
  // canonical equality: key order must not matter
  const reordered = (o) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(o).reverse())));
  r = plan('nazori-app', [reordered(nazoriRec(1))], [nazoriRec(1)]).r;
  check('duplicate detection ignores object KEY ORDER (stable normalization)', r.ok && r.plan.duplicateCount === 1 && r.plan.addCount === 0);
  // array order is meaningful
  const k1 = kanaRec(1, { data: { kana: 'あ', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[1, 2, 3, 4], [5, 6, 7, 8]] } } });
  const k2 = kanaRec(1, { data: { kana: 'あ', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[5, 6, 7, 8], [1, 2, 3, 4]] } } });
  r = plan('hiragana-learn', [k2], [k1]).r;
  check('stroke ORDER is content: reordered strokes are NOT a duplicate (both kept)', r.ok && r.plan.duplicateCount === 0 && r.plan.addCount === 1);
  // Case D: same id, different content => conflict (Nazori)
  r = plan('nazori-app', [nazoriRec(1, { allChars: 'い' })], [nazoriRec(1)]).r;
  check('D (Nazori): same id, different content -> CONFLICT, not written', r.ok && r.plan.conflictCount === 1 && r.plan.addCount === 0 && r.plan.serialized === null);
  r = plan('nazori-app', [nazoriRec(1, { image: png(9) })], [nazoriRec(1)]).r;
  check('D (Nazori): same id, different IMAGE -> CONFLICT (existing image never replaced)', r.ok && r.plan.conflictCount === 1 && r.plan.addCount === 0);
  // Sawatte same timestamp
  r = plan('sawatte-hirogaru-app', [sawRec(1, { activity: 'other' })], [sawRec(1)]).r;
  check('D (Sawatte): same timestamp, different content -> CONFLICT, not written', r.ok && r.plan.conflictCount === 1 && r.plan.addCount === 0);
  // Kana: same time different content is NOT a conflict
  for (const appId of ['hiragana-learn', 'katakana-app']) {
    r = plan(appId, [kanaRec(1, { data: { kana: 'い' } })], [kanaRec(1)]).r;
    check(appId + ': same time, different content is NOT a conflict -> added as a distinct record', r.ok && r.plan.conflictCount === 0 && r.plan.addCount === 1 && r.plan.finalCount === 2);
    r = plan(appId, [kanaRec(1)], [kanaRec(1)]).r;
    check(appId + ': fully identical kana record -> duplicate (skipped)', r.ok && r.plan.duplicateCount === 1 && r.plan.addCount === 0);
  }
  // Case E: same sessionId is NOT an identity
  r = plan('nazori-app', [nazoriRec(2, { sessionId: 's-1' })], [nazoriRec(1)]).r;
  check('E: same sessionId but different id/content -> new (sessionId is not an identity)', r.ok && r.plan.addCount === 1 && r.plan.conflictCount === 0);
  // duplicates INSIDE the backup file
  r = plan('nazori-app', [nazoriRec(1), nazoriRec(1), nazoriRec(2)]).r;
  check('exact duplicate inside the backup itself -> counted once, second skipped', r.ok && r.plan.addCount === 2 && r.plan.duplicateCount === 1);
  r = plan('nazori-app', [nazoriRec(1), nazoriRec(1, { allChars: 'い' })]).r;
  check('same id twice inside the backup with different content -> 1 new + 1 conflict', r.ok && r.plan.addCount === 1 && r.plan.conflictCount === 1);
  // mixture
  r = plan('nazori-app', [nazoriRec(1), nazoriRec(2, { allChars: 'X' }), nazoriRec(3), nazoriRec(4)], [nazoriRec(1), nazoriRec(2)]).r;
  check('mixture: 1 duplicate + 1 conflict + 2 new -> total 4, added 2', r.ok && r.plan.total === 4 && r.plan.duplicateCount === 1 && r.plan.conflictCount === 1 && r.plan.addCount === 2);
  // Case F (mixed learners) is undetectable by design: a foreign-looking but valid record simply restores
  r = plan('katakana-app', [kanaRec(50, { data: { kana: 'ヲ' } })], [kanaRec(1)]).r;
  check('F: valid records from "another child" are indistinguishable by design (no learner id) -> restored; Gate F is a UX warning, not code', r.ok && r.plan.addCount === 1);
  // conflict summary is exposed
  r = plan('nazori-app', [nazoriRec(1, { allChars: 'い' })], [nazoriRec(1)]).r;
  check('plan exposes total/new/duplicate/conflict/invalid/overLimit counts for the preview', ['total', 'newCount', 'duplicateCount', 'conflictCount', 'invalidCount', 'overLimitCount', 'addCount', 'existingCount', 'finalCount'].every((k) => typeof r.plan[k] === 'number'));
}

// ═══════════════════════════════════════════════════════════════
section('9. Retention caps (never evict; newest-first into the free slots)');
// ═══════════════════════════════════════════════════════════════
{
  // drift guard: the mirrored constants must equal the apps' real caps
  const nazoriSrc = fs.readFileSync(path.join(REPO_ROOT, 'nazori-app.html'), 'utf8');
  const sawSrc = fs.readFileSync(path.join(REPO_ROOT, 'sawatte-hirogaru-app.html'), 'utf8');
  const nazCap = Number((nazoriSrc.match(/const\s+NAZORI_MAX_RECORDS\s*=\s*(\d+)/) || [])[1]);
  const sawCap = Number((sawSrc.match(/var\s+RECORD_LOG_CAP\s*=\s*(\d+)/) || [])[1]);
  check('DRIFT GUARD: nazori-app.html NAZORI_MAX_RECORDS is 60 (the value Restore mirrors)', nazCap === 60, 'found ' + nazCap);
  check('DRIFT GUARD: sawatte-hirogaru-app.html RECORD_LOG_CAP is 200 (the value Restore mirrors)', sawCap === 200, 'found ' + sawCap);
  check('DRIFT GUARD: Restore behaves per those caps (Nazori 60 / Sawatte 200)', plan('nazori-app', Array.from({ length: 61 }, (_, i) => nazoriRec(i + 1))).r.plan.addCount === nazCap && plan('sawatte-hirogaru-app', Array.from({ length: 201 }, (_, i) => sawRec(i + 1))).r.plan.addCount === sawCap);
  const kanaSrc = fs.readFileSync(path.join(REPO_ROOT, 'hiragana-learn.html'), 'utf8') + fs.readFileSync(path.join(REPO_ROOT, 'katakana-app.html'), 'utf8');
  check('DRIFT GUARD: Kana apps still have no retention cap in their save path (no slice/shift on learningLog)', !/learningLog\.(shift|splice)\(|learningLog\s*=\s*learningLog\.slice\(/.test(kanaSrc));

  // Nazori
  let r = plan('nazori-app', Array.from({ length: 3 }, (_, i) => nazoriRec(100 + i)), Array.from({ length: 59 }, (_, i) => nazoriRec(i + 1))).r;
  check('Nazori: existing 59 + 3 new -> only 1 added (the NEWEST), 2 over limit', r.ok && r.plan.addCount === 1 && r.plan.overLimitCount === 2 && r.plan.finalCount === 60);
  check('Nazori: the one that fits is the newest backup record', JSON.parse(r.plan.serialized).some((x) => x.id === 'nz-102') && !JSON.parse(r.plan.serialized).some((x) => x.id === 'nz-100' || x.id === 'nz-101'));
  r = plan('nazori-app', [nazoriRec(200)], Array.from({ length: 60 }, (_, i) => nazoriRec(i + 1))).r;
  check('Nazori: existing exactly at the cap -> 0 added, all reported over limit, no write', r.ok && r.plan.addCount === 0 && r.plan.overLimitCount === 1 && r.plan.serialized === null);
  r = plan('nazori-app', Array.from({ length: 70 }, (_, i) => nazoriRec(i + 1))).r;
  check('Nazori: empty target + 70 backup -> the newest 60 added, 10 over limit', r.ok && r.plan.addCount === 60 && r.plan.overLimitCount === 10 && r.plan.finalCount === 60);
  const ids = JSON.parse(r.plan.serialized).map((x) => x.id);
  check('Nazori: the 60 kept are nz-11..nz-70 (oldest 10 dropped from the RESTORE, not from the device)', ids.length === 60 && ids.includes('nz-70') && ids.includes('nz-11') && !ids.includes('nz-10'));
  check('Nazori: kept records stay in chronological order', deepEqual(ids, ids.slice().sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))));
  const existing = Array.from({ length: 58 }, (_, i) => nazoriRec(i + 1));
  r = plan('nazori-app', [nazoriRec(1000), nazoriRec(1001), nazoriRec(1002)], existing).r;
  check('Nazori: existing records are NEVER removed or altered by a capped restore', r.ok && existing.every((e) => JSON.parse(r.plan.serialized).some((x) => deepEqual(x, e))) && r.plan.finalCount === 60);
  r = plan('nazori-app', [1, 2, 3].map((i) => nazoriRec(i)), [nazoriRec(1)]).r;
  check('Nazori: duplicates are removed BEFORE the cap is applied (2 new fit; nothing is over limit)', r.ok && r.plan.addCount === 2 && r.plan.overLimitCount === 0);
  r = plan('nazori-app', Array.from({ length: 5 }, (_, i) => nazoriRec(i + 1)), Array.from({ length: 62 }, (_, i) => nazoriRec(i + 500))).r;
  check('Nazori: existing already ABOVE the cap (legacy) -> nothing added, nothing removed', r.ok && r.plan.addCount === 0 && r.plan.overLimitCount === 5 && r.plan.existingCount === 62);
  // Sawatte
  r = plan('sawatte-hirogaru-app', Array.from({ length: 5 }, (_, i) => sawRec(300 + i)), Array.from({ length: 198 }, (_, i) => sawRec(i + 1))).r;
  check('Sawatte: existing 198 + 5 new -> 2 added (newest), 3 over limit, final 200', r.ok && r.plan.addCount === 2 && r.plan.overLimitCount === 3 && r.plan.finalCount === 200);
  r = plan('sawatte-hirogaru-app', Array.from({ length: 205 }, (_, i) => sawRec(i + 1))).r;
  check('Sawatte: empty target + 205 -> newest 200 added, 5 over limit', r.ok && r.plan.addCount === 200 && r.plan.overLimitCount === 5);
  // Kana has no cap
  for (const appId of ['hiragana-learn', 'katakana-app']) {
    r = plan(appId, Array.from({ length: 500 }, (_, i) => kanaRec(i))).r;
    check(appId + ': no cap -> all 500 added, none over limit', r.ok && r.plan.addCount === 500 && r.plan.overLimitCount === 0 && r.plan.retentionCap === null);
  }
  // ties: equal timestamps, later backup index counts as newer
  r = plan('nazori-app', [nazoriRec(1, { id: 'a', timestamp: ISO(5) }), nazoriRec(2, { id: 'b', timestamp: ISO(5) }), nazoriRec(3, { id: 'c', timestamp: ISO(5) })], Array.from({ length: 58 }, (_, i) => nazoriRec(i + 100))).r;
  check('ties on timestamp: later position in the backup is treated as newer (deterministic)', r.ok && r.plan.addCount === 2 && JSON.parse(r.plan.serialized).some((x) => x.id === 'c') && JSON.parse(r.plan.serialized).some((x) => x.id === 'b') && !JSON.parse(r.plan.serialized).some((x) => x.id === 'a'));
}

// ═══════════════════════════════════════════════════════════════
section('10. Ordered merge (existing order preserved, new inserted by time)');
// ═══════════════════════════════════════════════════════════════
{
  const existing = [nazoriRec(10), nazoriRec(30), nazoriRec(50)];
  const r = plan('nazori-app', [nazoriRec(20), nazoriRec(40), nazoriRec(60), nazoriRec(5)], existing).r;
  const ids = JSON.parse(r.plan.serialized).map((x) => x.id);
  check('new records are interleaved chronologically', deepEqual(ids, ['nz-5', 'nz-10', 'nz-20', 'nz-30', 'nz-40', 'nz-50', 'nz-60']), ids.join(','));
  const odd = [nazoriRec(50), nazoriRec(10), nazoriRec(30)];   // existing is NOT sorted
  const r2 = plan('nazori-app', [nazoriRec(20)], odd).r;
  const ids2 = JSON.parse(r2.plan.serialized).map((x) => x.id);
  check('an existing NON-monotonic order is preserved exactly (never re-sorted)', ids2.filter((i) => i !== 'nz-20').join(',') === 'nz-50,nz-10,nz-30', ids2.join(','));
  const r3 = plan('hiragana-learn', [kanaRec(5), kanaRec(500)], [kanaRec(100), kanaRec(200)]).r;
  check('kana records are ordered by their parsed `time`', r3.ok && JSON.parse(r3.plan.serialized).map((x) => x.time).join('|') === [5, 100, 200, 500].map(kanaTime).join('|'));
  const tie = plan('nazori-app', [nazoriRec(1, { id: 'new', timestamp: ISO(10) })], [nazoriRec(10, { id: 'old', timestamp: ISO(10) })]).r;
  check('equal timestamps: the existing record stays first', JSON.parse(tie.plan.serialized).map((x) => x.id).join(',') === 'old,new');
  const oddExisting = [{ weird: true }, 'a string', 42, null, nazoriRec(10)];
  const r4 = plan('nazori-app', [nazoriRec(20)], oddExisting).r;
  check('existing records of ANY shape (even unparseable/invalid) are kept verbatim in the merged output', r4.ok && deepEqual(JSON.parse(r4.plan.serialized).slice(0, 5), oddExisting) && r4.plan.finalCount === 6);
  const r5 = plan('nazori-app', [nazoriRec(20)], [nazoriRec(10, { extra: { deep: [1, { a: 2 }] } })]).r;
  check('existing record contents survive the merge round-trip unchanged (deep equal)', deepEqual(JSON.parse(r5.plan.serialized)[0], nazoriRec(10, { extra: { deep: [1, { a: 2 }] } })));
}

// ═══════════════════════════════════════════════════════════════
section('11. Planning is READ-ONLY and never overwrites unreadable data');
// ═══════════════════════════════════════════════════════════════
{
  for (const appId of Object.keys(APPS)) {
    const key = APPS[appId].key;
    const s = mem({ [key]: JSON.stringify([APPS[appId].rec(1)]) });
    dash.planBackupRestore(txt(envelope(appId, [APPS[appId].rec(2), APPS[appId].rec(3)])), { storage: s });
    check(appId + ': planning performed ZERO writes/removes (spy)', s.sets === 0 && s.removes === 0);
  }
  const key = 'nazori_records';
  for (const [label, raw] of [['malformed JSON', '{not json'], ['object instead of array', '{"a":1}'], ['a JSON string', '"x"'], ['a number', '5'], ['JSON null', 'null']]) {
    const s = mem({ [key]: raw });
    const r = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: s });
    check('existing storage is ' + label + ' -> existing-unreadable, value untouched', rej(r, 'existing-unreadable') && s.m[key] === raw && s.sets === 0);
  }
  const sAbs = mem();
  const rAbs = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: sAbs });
  check('key absent -> treated as empty; plan.existingRaw is null', rAbs.ok && rAbs.plan.existingRaw === null && rAbs.plan.existingCount === 0);
  const sEmpty = mem({ [key]: '' });
  const rEmpty = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: sEmpty });
  check('key present but empty string -> treated as empty; plan.existingRaw is ""', rEmpty.ok && rEmpty.plan.existingRaw === '' && rEmpty.plan.existingCount === 0);
  const sThrow = mem(); sThrow.getItem = () => { throw errNamed('SecurityError'); };
  check('storage.getItem throws -> storage-unavailable (no crash, no write)', rej(dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: sThrow }), 'storage-unavailable'));
  check('no storage available at all -> a clean failure, never an uncaught exception', (() => { try { const r = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: { getItem() { throw new Error('x'); } } }); return r.ok === false; } catch (e) { return false; } })());
  const sEmptyArr = mem({ [key]: '[]' });
  check('existing "[]" -> ok, 0 existing', dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: sEmptyArr }).plan.existingCount === 0);
  const rPre = plan('nazori-app', [nazoriRec(2)], [nazoriRec(1)]).r;
  check('plan carries the raw pre-restore value for the stale-preview gate', rPre.plan.existingRaw === JSON.stringify([nazoriRec(1)]));
  check('plan reports the estimated size of the merged value', rPre.plan.estimatedChars === rPre.plan.serialized.length && rPre.plan.estimatedChars > 0);
  check('plan reports the backup date range (earliest/latest)', rPre.plan.earliestMs === Date.parse(ISO(2)) && rPre.plan.latestMs === Date.parse(ISO(2)));
  check('plan reports exportedAt / version / appName / storageKey', rPre.plan.exportedAt === '2026-03-15T03:00:00.000Z' && rPre.plan.backupFormatVersion === 1 && rPre.plan.storageKey === 'nazori_records' && typeof rPre.plan.appName === 'string' && rPre.plan.appName.length > 0);
}

// ═══════════════════════════════════════════════════════════════
section('12. executeBackupRestore: one write, stale gate, read-back, rollback, failures');
// ═══════════════════════════════════════════════════════════════
{
  const mk = (existingArr) => { const s = mem(existingArr ? { nazori_records: JSON.stringify(existingArr) } : {}); const r = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5), nazoriRec(6)])), { storage: s }); return { s, plan: r.plan, before: s.m.nazori_records }; };

  // success
  let { s, plan: p } = mk([nazoriRec(1)]);
  let w = dash.executeBackupRestore(p, { storage: s });
  check('success: ok, added 2, ONE setItem call, zero removes', w.ok === true && w.added === 2 && s.sets === 1 && s.removes === 0, JSON.stringify(w));
  check('success: storage holds exactly the planned merged value', s.m.nazori_records === p.serialized && JSON.parse(s.m.nazori_records).length === 3);
  check('success: result carries duplicates/conflicts/overLimit/finalCount for the summary', w.duplicates === 0 && w.conflicts === 0 && w.overLimit === 0 && w.finalCount === 3);
  // empty target
  ({ s, plan: p } = mk(null));
  w = dash.executeBackupRestore(p, { storage: s });
  check('success into an empty (absent) key: ok and stored', w.ok === true && JSON.parse(s.m.nazori_records).length === 2 && s.sets === 1);

  // stale gate
  ({ s, plan: p } = mk([nazoriRec(1)]));
  s.m.nazori_records = JSON.stringify([nazoriRec(1), nazoriRec(99)]);   // another tab wrote after the preview
  w = dash.executeBackupRestore(p, { storage: s });
  check('STALE: storage changed after the preview -> code "stale", ZERO writes, other tab\'s data intact', w.ok === false && w.code === 'stale' && s.sets === 0 && s.removes === 0 && JSON.parse(s.m.nazori_records).some((x) => x.id === 'nz-99'));
  ({ s, plan: p } = mk(null));
  s.m.nazori_records = '[]';
  w = dash.executeBackupRestore(p, { storage: s });
  check('STALE: absent at preview, present at confirm -> stale (no write)', w.ok === false && w.code === 'stale' && s.sets === 0);
  ({ s, plan: p } = mk([nazoriRec(1)]));
  delete s.m.nazori_records;
  check('STALE: present at preview, removed at confirm -> stale (no write)', dash.executeBackupRestore(p, { storage: s }).code === 'stale' && s.sets === 0);
  ({ s, plan: p } = mk([nazoriRec(1)]));
  s.getItem = () => { throw errNamed('SecurityError'); };
  w = dash.executeBackupRestore(p, { storage: s });
  check('getItem throws at confirm time -> failure "security", no write', w.ok === false && w.code === 'security' && s.sets === 0);

  // write failures: all leave storage exactly as it was and never report success
  const failCases = [
    ['QuotaExceededError', errNamed('QuotaExceededError'), 'quota'],
    ['Firefox NS_ERROR_DOM_QUOTA_REACHED', errNamed('NS_ERROR_DOM_QUOTA_REACHED'), 'quota'],
    ['legacy code 22', errNamed('DOMException', 22), 'quota'],
    ['legacy code 1014', errNamed('DOMException', 1014), 'quota'],
    ['SecurityError', errNamed('SecurityError'), 'security'],
    ['unknown DOMException (InvalidStateError)', errNamed('InvalidStateError'), 'unknown'],
    ['plain Error', new Error('boom'), 'unknown'],
    ['thrown string', 'oops', 'unknown']
  ];
  for (const [label, err, code] of failCases) {
    const before = JSON.stringify([nazoriRec(1)]);
    const st = failingSet({ nazori_records: before }, err);
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('write failure ' + label + ' -> ok:false code "' + code + '"', res.ok === false && res.code === code, JSON.stringify(res));
    check('write failure ' + label + ' -> existing storage byte-identical, no success fields', st.m.nazori_records === before && res.added === undefined && res.finalCount === undefined);
  }

  // read-back mismatch -> rollback
  {
    const before = JSON.stringify([nazoriRec(1)]);
    const st = mem({ nazori_records: before });
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    let n = 0; const origSet = st.setItem.bind(st);
    st.setItem = function (k, v) { n++; origSet(k, n === 1 ? v.slice(0, -2) : v); };   // first write is silently truncated
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('READ-BACK MISMATCH: not reported as success; code "verify-failed"', res.ok === false && res.code === 'verify-failed' && res.rolledBack === true, JSON.stringify(res));
    check('READ-BACK MISMATCH: previous value restored exactly (rollback)', st.m.nazori_records === before);
  }
  {
    const st = mem();
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const origSet = st.setItem.bind(st);
    st.setItem = function (k, v) { origSet(k, v.slice(0, -2)); };
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('READ-BACK MISMATCH from an absent key: rollback removes the key (previous state = absent)', res.ok === false && res.code === 'verify-failed' && res.rolledBack === true && !('nazori_records' in st.m));
  }
  {
    const before = JSON.stringify([nazoriRec(1)]);
    const st = mem({ nazori_records: before });
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const origSet = st.setItem.bind(st);
    st.setItem = function (k, v) { origSet(k, v.slice(0, -2)); };   // EVERY write is corrupted, including the rollback
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('ROLLBACK FAILS TOO -> code "critical" (never success, never silent)', res.ok === false && res.code === 'critical' && res.rolledBack === false, JSON.stringify(res));
  }
  {
    const st = mem();
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const origSet = st.setItem.bind(st);
    st.setItem = function (k, v) { origSet(k, v.slice(0, -2)); };
    st.removeItem = function () { this.removes++; /* removal silently does nothing */ };
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('ROLLBACK by removeItem fails -> "critical"', res.ok === false && res.code === 'critical');
  }
  {
    const st = mem({ nazori_records: '[]' });
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const origGet = st.getItem.bind(st); let g = 0;
    st.getItem = function (k) { g++; if (g >= 2) throw errNamed('SecurityError'); return origGet(k); };   // read-back throws
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('read-back itself throws -> not success (verify-failed / critical)', res.ok === false && (res.code === 'verify-failed' || res.code === 'critical'));
  }

  // nothing to write
  {
    const st = mem({ nazori_records: JSON.stringify([nazoriRec(1)]) });
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: st }).plan;
    const res = dash.executeBackupRestore(pl, { storage: st });
    check('addCount 0 -> noWrite:true, ZERO setItem calls', res.ok === true && res.noWrite === true && res.added === 0 && st.sets === 0);
  }
  // bad plan
  check('null / malformed plan -> "bad-plan", no write', dash.executeBackupRestore(null, { storage: mem() }).code === 'bad-plan' && dash.executeBackupRestore({ storageKey: '' }, { storage: mem() }).code === 'bad-plan');
  check('write target is the plan\'s adapter-derived key, never anything else', (() => {
    const st = mem();
    const pl = dash.planBackupRestore(txt(envelope('hiragana-learn', [kanaRec(1)])), { storage: st }).plan;
    dash.executeBackupRestore(pl, { storage: st });
    return Object.keys(st.m).join(',') === 'hiragana_log';
  })());

  // recovery after a failure
  {
    const before = JSON.stringify([nazoriRec(1)]);
    const st = mem({ nazori_records: before });
    const first = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const okSet = st.setItem.bind(st);
    st.setItem = function () { this.sets++; throw errNamed('QuotaExceededError'); };
    const bad = dash.executeBackupRestore(first, { storage: st });
    st.setItem = okSet;   // space freed
    const again = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(5)])), { storage: st }).plan;
    const good = dash.executeBackupRestore(again, { storage: st });
    check('RECOVERY: quota failure, then retry after space is freed -> succeeds', bad.ok === false && good.ok === true && JSON.parse(st.m.nazori_records).length === 2);
  }

  // repeated import is idempotent
  {
    const st = mem();
    const text = txt(envelope('nazori-app', [nazoriRec(1), nazoriRec(2), nazoriRec(3)]));
    const p1 = dash.planBackupRestore(text, { storage: st }).plan;
    const w1 = dash.executeBackupRestore(p1, { storage: st });
    const after1 = st.m.nazori_records;
    const p2 = dash.planBackupRestore(text, { storage: st }).plan;
    const w2 = dash.executeBackupRestore(p2, { storage: st });
    const p3 = dash.planBackupRestore(text, { storage: st }).plan;
    check('REPEATED IMPORT: 1st adds 3; 2nd and 3rd add 0 (all duplicates) and do not write', w1.added === 3 && w2.added === 0 && p2.duplicateCount === 3 && p3.addCount === 0 && st.sets === 1 && st.m.nazori_records === after1);
  }
  // the same plan cannot be applied twice (second apply sees stale storage)
  {
    const st = mem();
    const pl = dash.planBackupRestore(txt(envelope('nazori-app', [nazoriRec(1)])), { storage: st }).plan;
    const a = dash.executeBackupRestore(pl, { storage: st });
    const b = dash.executeBackupRestore(pl, { storage: st });
    check('double-submit of the SAME plan: the second call is refused as stale (single write only)', a.ok === true && b.ok === false && b.code === 'stale' && st.sets === 1);
  }
}

// ═══════════════════════════════════════════════════════════════
section('13. Allowlist single source of truth + round trip with the real exporter');
// ═══════════════════════════════════════════════════════════════
{
  const adapters = dash.getAdapters();
  let consistent = true; const seen = [];
  for (const a of adapters) {
    const exportable = dash.getBackupAction(a.appId) !== null;
    const env = { backupFormatVersion: 1, exportedAt: '2026-03-15T03:00:00.000Z', appId: a.appId, appName: a.appName, storageKey: a.storageKey, recordCount: 0, records: [] };
    const r = dash.planBackupRestore(JSON.stringify(env), { storage: mem() });
    const restorable = r.ok === true;
    if (exportable !== restorable) { consistent = false; seen.push(a.appId + ':export=' + exportable + ',restore=' + restorable); }
    if (!exportable && !(r.ok === false && r.code === 'wrong-app')) { consistent = false; seen.push(a.appId + ' not rejected as wrong-app'); }
  }
  check('EXACTLY the apps that can be exported can be restored (no more, no less) across all ' + adapters.length + ' adapters', consistent, seen.join('; '));
  check('the restorable set is exactly the 4 Full Backup apps', deepEqual(adapters.filter((a) => dash.getBackupAction(a.appId) !== null).map((a) => a.appId).sort(), ['hiragana-learn', 'katakana-app', 'nazori-app', 'sawatte-hirogaru-app']));

  // real exporter -> real restorer, into a fresh device
  for (const appId of Object.keys(APPS)) {
    const recs = [1, 2, 3].map((i) => APPS[appId].rec(i));
    const exported = dash.getBackupAction(appId).buildBackup(recs);
    const file = JSON.stringify(exported);
    const st = mem();
    const pl = dash.planBackupRestore(file, { storage: st });
    check(appId + ': a file produced by the real Full Backup exporter is accepted by the restorer', pl.ok === true && pl.plan.addCount === 3);
    const w = dash.executeBackupRestore(pl.plan, { storage: st });
    check(appId + ': export -> restore round trip reproduces the original records exactly (deep equal)', w.ok === true && deepEqual(JSON.parse(st.m[APPS[appId].key]), recs));
    check(appId + ': restored records are readable by the dashboard reader', dash.readAppRecords(appId, { storage: st }).rawRecords.length === 3);
  }
  // mismatch between the app the file claims and a valid other-app payload
  check('Nazori file relabelled as Hiragana (right key for Hiragana, wrong payload) is rejected by record validation', (() => {
    const env = envelope('hiragana-learn', [nazoriRec(1)]);
    return rej(dash.planBackupRestore(txt(env), { storage: mem() }), 'invalid-records');
  })());
  check('Nazori file relabelled with the Hiragana appId but Nazori storageKey -> wrong-key', rej(dash.planBackupRestore(txt(envelope('hiragana-learn', [kanaRec(1)], { storageKey: 'nazori_records' })), { storage: mem() }), 'wrong-key'));
}

// ═══════════════════════════════════════════════════════════════
section('14. High case (60 Nazori images, ~3MB) stays fast and bounded');
// ═══════════════════════════════════════════════════════════════
{
  const recs = Array.from({ length: 60 }, (_, i) => nazoriRec(i + 1, { image: png(14000) }));   // ~56KB base64 each
  const text = txt(envelope('nazori-app', recs));
  check('the high-case file is between 3MB and 10MB (exercises the warning band)', text.length > 3 * 1024 * 1024 && dash.checkBackupFileSize(text.length).level === 'warn', 'bytes=' + text.length);
  const st = mem();
  const t0 = Date.now();
  const pl = dash.planBackupRestore(text, { storage: st });
  const w = dash.executeBackupRestore(pl.plan, { storage: st });
  const ms = Date.now() - t0;
  check('plan + execute of 60 large images succeeds', pl.ok && w.ok && JSON.parse(st.m.nazori_records).length === 60);
  check('completes in well under 5s (no pathological blowup)', ms < 5000, ms + 'ms');
  const t1 = Date.now();
  const again = dash.planBackupRestore(text, { storage: st });
  check('re-planning the same big file against the full device finds 60 exact duplicates quickly', again.ok && again.plan.duplicateCount === 60 && again.plan.addCount === 0 && (Date.now() - t1) < 5000);
  const many = Array.from({ length: 5000 }, (_, i) => kanaRec(i));
  const tm = Date.now();
  const rm = dash.planBackupRestore(txt(envelope('hiragana-learn', many)), { storage: mem() });
  check('5000 kana records plan in under 5s', rm.ok && rm.plan.addCount === 5000 && (Date.now() - tm) < 5000, (Date.now() - tm) + 'ms');
}

console.log(`\n${totalChecks - failedChecks}/${totalChecks} checks passed.`);
if (failedChecks > 0) { console.log(`${failedChecks} FAILED.`); process.exit(1); }
console.log('ALL PASS.');
