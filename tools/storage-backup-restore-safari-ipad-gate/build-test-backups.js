#!/usr/bin/env node
// Restore Safari/iPad Gate (LEARNING-RECORD-STORAGE-BACKUP-RESTORE-SAFARI-IPAD-GATE-1):
// builds the synthetic backup files the iPad will restore.
//
// Usage: node tools/storage-backup-restore-safari-ipad-gate/build-test-backups.js [outDir]
//
// The files are produced by the REAL Production export code
// (FOUNDATION.getBackupAction(appId).buildBackup(), serialised exactly like the
// page's downloadCommonAppBackup(): JSON.stringify(obj, null, 2)), fed with
// synthetic records only. No learner name, school name or any personal data.
// Only the deliberately-broken negative cases (wrong app / wrong key / future
// version / malformed / oversize) are derived by editing a real export.
//
// Output goes OUTSIDE the repo by default (a temp directory), never into the
// working tree (the repo has no .gitignore and CI runs `git add -A`).

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));

const outDir = process.argv[2] || path.join(os.tmpdir(), 'donomana-restore-gate-files');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) { if (/^(\d\d-.*\.json|manifest\.json)$/.test(f)) fs.unlinkSync(path.join(outDir, f)); }

// ---------------------------------------------------------------- PNG (real, deterministic, no deps)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const p = pixel(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]).toString('base64');
}
// A clearly recognisable picture per record, so a person can SEE that the right image came back:
// a coloured square with a white diagonal, and a thick border.
const pictureA = png(96, 96, (x, y) => (x < 6 || y < 6 || x > 89 || y > 89) ? [20, 20, 20] : (Math.abs(x - y) < 6 ? [255, 255, 255] : [220, 60, 60]));
const pictureB = png(96, 96, (x, y) => (x < 6 || y < 6 || x > 89 || y > 89) ? [20, 20, 20] : (Math.abs(x + y - 95) < 6 ? [255, 255, 255] : [50, 90, 220]));
const pictureC = png(96, 96, (x, y) => (x < 6 || y < 6 || x > 89 || y > 89) ? [20, 20, 20] : (((x >> 4) + (y >> 4)) % 2 ? [60, 170, 90] : [240, 240, 240]));
// incompressible pseudo-random picture (deterministic LCG): ~90KB of base64 each, for the 3MB-class file
function noisePicture(seed) {
  let s = (seed * 2654435761) >>> 0;
  return png(150, 150, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return [s >>> 24, (s >>> 16) & 255, (s >>> 8) & 255]; });
}

// ---------------------------------------------------------------- synthetic records (all clearly fake)
const DAY = 86400000;
// FIXED anchor (not "now - 40 days"): rebuilding the files (e.g. after a server restart) must never change
// a record's content, otherwise a file restored earlier and the same file downloaded later would differ
// (a "duplicate" test would silently become a "conflict"). 2026-08-10 is far outside the dashboard's
// default 7-day window, which is what Case T needs.
const OLD = Date.parse('2026-08-10T01:47:33.360Z');
const iso = (ms) => new Date(ms).toISOString();
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const kanaTime = (ms) => { const d = new Date(ms); return d.toLocaleDateString('ja-JP') + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

const nazori = (n, ms, image, over) => Object.assign({ id: 'gate-nz-' + n, sessionId: 'gate-session-' + n, timestamp: iso(ms), mode: 'wide', allChars: 'テスト' + n, charCount: 3, sessionDone: 1, sessionTotal: 1, image: image }, over || {});
const kana = (ms, ch, strokes) => ({ time: kanaTime(ms), type: 'trace', data: { kana: ch, tracingJudgmentLevel: 'standard', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: strokes } }, schemaVersion: 1 });
const sawatte = (ms) => ({
  timestamp: iso(ms), appId: 'sawatte-hirogaru-app', activity: 'reaction', inputMethod: 'touch', schemaVersion: 1,
  payload: { startTime: 1, durationMs: 8000, totalInteractions: 6, tapCount: 3, swipeCount: 2, inputMethods: ['touch'],
    trace: { traceSchemaVersion: 1, pointLimit: 1000, trimmed: false,
      taps: [120, 200, 300, 500, 480, 1200, 800, 700, 2400],
      swipes: [[100, 100, 4000, 200, 220, 4200, 300, 340, 4400, 400, 460, 4600], [900, 100, 5000, 700, 300, 5200, 500, 500, 5400]] } }
});

const HIRA_STROKES = [[300, 200, 400, 260, 520, 330, 640, 420, 700, 540, 640, 660, 520, 720, 400, 700], [520, 120, 500, 260, 480, 420, 470, 600, 480, 760, 520, 860]];
const KATA_STROKES = [[200, 260, 420, 250, 640, 240, 820, 250], [560, 250, 500, 430, 420, 600, 300, 760], [360, 520, 520, 560, 700, 620, 800, 700]];

const exportOf = (appId, records) => JSON.parse(JSON.stringify(dash.getBackupAction(appId).buildBackup(records)));
const text = (obj) => JSON.stringify(obj, null, 2);

const nz1 = nazori(1, OLD, pictureA);
const nz2 = nazori(2, OLD + 3600000, pictureB);
const valid = {
  nazori: exportOf('nazori-app', [nz1, nz2]),
  hiragana: exportOf('hiragana-learn', [kana(OLD, 'あ', HIRA_STROKES)]),
  katakana: exportOf('katakana-app', [kana(OLD + 60000, 'ア', KATA_STROKES)]),
  sawatte: exportOf('sawatte-hirogaru-app', [sawatte(OLD)])
};
// conflict: gate-nz-1 again with DIFFERENT content (same id), plus one genuinely new record
const conflictNazori = exportOf('nazori-app', [nazori(1, OLD, pictureA, { allChars: 'ちがう内容' }), nazori(3, OLD + 7200000, pictureC)]);
const wrongApp = { backupFormatVersion: 1, exportedAt: valid.nazori.exportedAt, appId: 'janken-app', appName: 'じゃんけん まなぼう！', storageKey: 'janken_log', recordCount: 1,
  records: [{ timestamp: iso(OLD), inputMethod: null, schemaVersion: 1, payload: { mode: 'both', total: 5, correct: 4, mistakes: [] } }] };
const wrongKey = Object.assign({}, valid.nazori, { storageKey: 'gate_injected_key' });
const futureVersion = Object.assign({}, valid.nazori, { backupFormatVersion: 2 });
const malformed = text(valid.nazori).slice(0, Math.floor(text(valid.nazori).length * 0.6));   // truncated JSON

const bigRecords = []; for (let i = 1; i <= 40; i++) bigRecords.push(nazori(100 + i, OLD + i * 60000, noisePicture(i)));
const warn = exportOf('nazori-app', bigRecords);
const rejectPad = '{"note":"Restore Gate synthetic oversize file. Rejected on size alone, before any parsing.","padding":"' + 'x'.repeat(10 * 1024 * 1024 + 4096) + '"}';

const FILES = [
  ['01-nazori-valid.json', text(valid.nazori), 'nazori-app', 'ok', '新しく2件を追加（赤い画像と青い画像）'],
  ['02-hiragana-valid.json', text(valid.hiragana), 'hiragana-learn', 'ok', '新しく1件を追加（「あ」のなぞり）'],
  ['03-katakana-valid.json', text(valid.katakana), 'katakana-app', 'ok', '新しく1件を追加（「ア」のなぞり）'],
  ['04-sawatte-valid.json', text(valid.sawatte), 'sawatte-hirogaru-app', 'ok', '新しく1件を追加'],
  ['06-nazori-conflict.json', text(conflictNazori), 'nazori-app', 'partial', '01を復元済みのとき: 1件は「今の記録と内容が異なる」ため復元しない／緑の画像の1件だけ追加'],
  ['07-wrong-app.json', text(wrongApp), 'janken-app', 'reject', '復元できない（対応教材ではない）'],
  ['08-wrong-key.json', text(wrongKey), 'nazori-app', 'reject', '復元できない（対応教材ではない）。何も書き込まれない'],
  ['09-unsupported-version.json', text(futureVersion), 'nazori-app', 'reject', '「新しいバージョンで作成」と表示され復元できない'],
  ['10-malformed.json', malformed, '-', 'reject', '「読み込めませんでした」と表示され復元できない'],
  ['11-warn-3mb.json', text(warn), 'nazori-app', 'warn', '「ファイルが大きい」警告つきでプレビューまで進む（40件）'],
  ['12-reject-10mb.json', rejectPad, '-', 'reject', '「ファイルが大きすぎる」と表示され復元できない（読み込み前に拒否）']
];

const manifest = { builtAt: new Date().toISOString(), oldRecordsDate: iso(OLD), files: [] };
for (const [name, body, appId, expect, note] of FILES) {
  fs.writeFileSync(path.join(outDir, name), body);
  manifest.files.push({ file: name, bytes: Buffer.byteLength(body), appId, expect, note });
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// ---------------------------------------------------------------- self-check with the REAL restore planner
const MB = 1024 * 1024;
function mem() { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
const bytes = (n) => manifest.files.find((f) => f.file === n).bytes;
const plan = (name, storage) => dash.planBackupRestore(fs.readFileSync(path.join(outDir, name), 'utf8'), { storage: storage || mem() });
let bad = [];
const ok = (label, cond) => { if (!cond) bad.push(label); console.log((cond ? '  [OK  ] ' : '  [FAIL] ') + label); };
console.log('\nself-check against the real planBackupRestore():');
for (const n of ['01-nazori-valid.json', '02-hiragana-valid.json', '03-katakana-valid.json', '04-sawatte-valid.json']) { const r = plan(n); ok(n + ' is accepted (' + (r.ok ? r.plan.addCount + ' new' : r.code) + ')', r.ok && r.plan.addCount === (n.startsWith('01') ? 2 : 1)); }
{ const s = mem(); const p1 = plan('01-nazori-valid.json', s); dash.executeBackupRestore(p1.plan, { storage: s });
  const p2 = plan('01-nazori-valid.json', s); ok('01 restored twice: 2nd time = 2 duplicates, 0 new', p2.ok && p2.plan.duplicateCount === 2 && p2.plan.addCount === 0);
  const pc = plan('06-nazori-conflict.json', s); ok('06 after 01: 1 conflict, 1 new', pc.ok && pc.plan.conflictCount === 1 && pc.plan.addCount === 1); }
ok('07 wrong app rejected', plan('07-wrong-app.json').code === 'wrong-app');
ok('08 wrong key rejected', plan('08-wrong-key.json').code === 'wrong-key');
ok('09 future version rejected', plan('09-unsupported-version.json').code === 'unsupported-version' && plan('09-unsupported-version.json').future === true);
ok('10 malformed rejected', plan('10-malformed.json').code === 'not-json');
ok('11 is in the warning band (3MB < size <= 10MB) and restorable (' + (bytes('11-warn-3mb.json') / MB).toFixed(2) + ' MB)', bytes('11-warn-3mb.json') > 3 * MB && bytes('11-warn-3mb.json') <= 10 * MB && dash.checkBackupFileSize(bytes('11-warn-3mb.json')).level === 'warn' && plan('11-warn-3mb.json').ok && plan('11-warn-3mb.json').plan.addCount === 40);
ok('12 is over the hard limit (' + (bytes('12-reject-10mb.json') / MB).toFixed(2) + ' MB) and rejected by the size gate', dash.checkBackupFileSize(bytes('12-reject-10mb.json')).level === 'reject');
console.log('\nfiles written to: ' + outDir);
for (const f of manifest.files) console.log('  ' + f.file.padEnd(30) + String(f.bytes).padStart(10) + ' bytes  [' + f.expect + ']');
if (bad.length) { console.error('\nSELF-CHECK FAILED: ' + bad.join('; ')); process.exit(1); }
console.log('\nSELF-CHECK PASSED');
