// Real-browser (Playwright / Chromium) test for the LEARNING RECORD of ringo-potton-app.html
// (Phase RINGO-POTTON-LEARNING-RECORD-1).
// One activity = one record in localStorage 'ringo_potton_log', written only when the delivery is
// accepted (delivering -> celebrate). Core Schema: {timestamp ISO, appId 'ringo-potton-app',
// activity 'ringo-delivery', inputMethod null, schemaVersion 1, payload {goal, goalMode, operation,
// showNumber, switchScan, swipe, harvested, durationSec}}. An unfinished activity is never recorded.
// The settings sheet shows the count on this device and offers a two-step "delete all".
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-record-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a stubbed speechSynthesis / HTMLAudioElement
// (tools/ringo-potton-poc/ringo-potton-voice-stubs.js). It proves what the app writes to
// localStorage and when; it is NOT an iPad Safari, VoiceOver, Bluetooth-switch or real-touch result.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB } = require('./ringo-potton-voice-stubs.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const RECORD_KEY = 'ringo_potton_log';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || { width: 834, height: 1194 }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(AUDIO_STUB);
  await context.addInitScript(({ sk, sv, rk, rv }) => {
    if (sessionStorage.getItem('__seeded')) return;
    if (sv !== null) localStorage.setItem(sk, sv);
    if (rv !== null) localStorage.setItem(rk, rv);
    sessionStorage.setItem('__seeded', '1');
  }, { sk: SETTINGS_KEY, sv: opts.settings ? JSON.stringify(opts.settings) : null, rk: RECORD_KEY, rv: (typeof opts.seedLog === 'string') ? opts.seedLog : null });
  const page = await context.newPage();
  page.__errors = []; page.__external = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(opts.base)) page.__external.push(r.url()); });
  await page.goto(opts.base + '/ringo-potton-app.html');
  return { context, page };
}
const phase = (page) => page.getAttribute('#app', 'data-phase');
const readLog = (page) => page.evaluate((k) => { const raw = localStorage.getItem(k); if (raw === null) return null; try { return JSON.parse(raw); } catch (e) { return 'UNPARSABLE:' + raw; } }, RECORD_KEY);
const rawLog = (page) => page.evaluate((k) => localStorage.getItem(k), RECORD_KEY);
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
async function harvestAll(page, goal) {
  for (let i = 0; i < goal; i++) {
    await page.evaluate(() => { const s = document.getElementById('surface'); if (!s.hidden) s.click(); else document.querySelector('.apple[data-status="ripe"]').click(); });
    await sleep(420);
  }
  await sleep(700);
}
async function deliver(page) {
  await page.evaluate(() => document.getElementById('deliverBtn').click());
  await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
  await sleep(700);   // the record is written at the transition itself; the wait only clears PHASE_GUARD for the next input (again)
}
async function completeActivity(page, goal) { await harvestAll(page, goal); await deliver(page); }
async function openSettings(page) {
  await page.evaluate(() => document.getElementById('ringoSettingsBtn').click());
  await sleep(150);
  if (await page.isVisible('#settingsConfirm')) { await page.click('#scOpen'); await sleep(150); }
}
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EVAL_RE = /すごい|えらい|じょうず|よくできました|せいかい|正解|不正解|まちがい|ざんねん|てんすう|点数|スコア/;

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const base = { base: BASE };

  /* ---------------- R0 foundation present ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    const f = await page.evaluate(() => ({
      create: typeof donomanaRecordCreate, add: typeof donomanaRecordAddLog, clear: typeof donomanaRecordClearLog,
      block: !!document.documentElement.innerHTML.match(/<!-- learning-record-foundation-js: 自動挿入 \(generate\.js\) -->/),
      nav: (function () { const a = document.getElementById('donomanaRecordNavBtn'); return a ? { href: a.getAttribute('href'), label: a.getAttribute('aria-label'), supporter: a.getAttribute('data-supporter-only') } : null; })(),
      key: localStorage.getItem('ringo_potton_log')
    }));
    ok('R0 Foundation functions injected by generate.js (Create/AddLog/ClearLog) and the marker block present', f.create === 'function' && f.add === 'function' && f.clear === 'function' && f.block, JSON.stringify(f));
    ok('R0 「学習のきろく」nav button injected as on every Foundation app: href /learning-records.html, supporter-only label (no ringo-specific treatment)', !!f.nav && f.nav.href === '/learning-records.html' && /学習のきろく/.test(f.nav.label) && f.nav.supporter === 'true', JSON.stringify(f.nav));
    ok('R0 fresh device: no record key before any activity', f.key === null, String(f.key));
    // the "anywhere" surface tap points the other suites use must not land on the bottom-left nav pill
    const geo = await page.evaluate(() => { const n = document.getElementById('donomanaRecordNavBtn'); if (!n) return null; const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, vh: innerHeight }; });
    const pts = [[60, 60], [20, 300]];
    ok('R0 nav pill sits at the bottom-left (bottom 16px) and the suites\' surface tap points (60,60) (20,300) are outside it', !!geo && Math.abs(geo.vh - geo.b - 16) < 2 && geo.l >= 14 && pts.every(([x, y]) => !(x >= geo.l && x <= geo.r && y >= geo.t && y <= geo.b)), JSON.stringify(geo));
    // the settings confirmation bar (bottom 72px) must not be covered by that pill (bottom 16px, 44px tall)
    await page.click('#startBtn'); await sleep(700);
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
    const bar = await page.evaluate(() => { const c = document.getElementById('scCancel').getBoundingClientRect(), n = document.getElementById('donomanaRecordNavBtn'); const p = n ? n.getBoundingClientRect() : null; const top = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return { cancelBottom: c.bottom, pillTop: p ? p.top : null, hit: top ? (top.id || top.tagName) : null }; });
    ok('R0 settings confirmation「やめる」is not covered by the nav pill (bar above the pill, hit-test reaches the button)', bar.pillTop !== null && bar.cancelBottom <= bar.pillTop + 0.5 && bar.hit === 'scCancel', JSON.stringify(bar));
    ok('R0 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R1 one completed activity -> one Core Schema record ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'apple' } }, base));
    await startRun(page);
    ok('R1 harvest in progress: still no record', (await readLog(page)) === null);
    await harvestAll(page, 3);
    ok('R1 complete (before delivery): still no record', (await phase(page)) === 'complete' && (await readLog(page)) === null);
    await deliver(page);
    const log = await readLog(page);
    ok('R1 delivery accepted: exactly 1 record', Array.isArray(log) && log.length === 1, JSON.stringify(log));
    const e = Array.isArray(log) ? log[0] : {};
    ok('R1 Core Schema envelope: ISO timestamp, appId, activity, inputMethod null, schemaVersion 1', ISO_RE.test(e.timestamp) && e.appId === 'ringo-potton-app' && e.activity === 'ringo-delivery' && e.inputMethod === null && e.schemaVersion === 1, JSON.stringify(e));
    ok('R1 envelope has exactly the 6 Core Schema keys', Object.keys(e).sort().join(',') === 'activity,appId,inputMethod,payload,schemaVersion,timestamp', Object.keys(e).join(','));
    const p = e.payload || {};
    ok('R1 payload has exactly the 8 agreed keys (7 + swipe since the swipe Phase)', Object.keys(p).sort().join(',') === 'durationSec,goal,goalMode,harvested,operation,showNumber,swipe,switchScan', Object.keys(p).join(','));
    ok('R1 payload values: goal 3, fixed, apple, showNumber true, switchScan false, swipe false, harvested 3', p.goal === 3 && p.goalMode === 'fixed' && p.operation === 'apple' && p.showNumber === true && p.switchScan === false && p.swipe === false && p.harvested === 3, JSON.stringify(p));
    ok('R1 durationSec is a plausible number (0 < d < 60, one decimal)', typeof p.durationSec === 'number' && p.durationSec > 0 && p.durationSec < 60 && Math.round(p.durationSec * 10) === p.durationSec * 10, String(p.durationSec));
    ok('R1 no right/wrong, score or tap-count fields anywhere in the record', !/correct|score|tap|mistake|point|rate/i.test(JSON.stringify(e)), JSON.stringify(e));
    ok('R1 timestamp is "now" (within 60 s)', Math.abs(Date.now() - Date.parse(e.timestamp)) < 60000, e.timestamp);
    ok('R1 settings key untouched by recording', await page.evaluate((k) => localStorage.getItem(k) !== null, SETTINGS_KEY));
    ok('R1 no requests outside the local server (records never leave the device)', page.__external.length === 0, page.__external.join('|'));
    ok('R1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R2 deliver burst -> still one record ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'anywhere' } }, base));
    await startRun(page);
    await harvestAll(page, 2);
    await page.evaluate(() => { const d = document.getElementById('deliverBtn'), s = document.getElementById('surface'); for (let i = 0; i < 5; i++) { d.click(); if (!s.hidden) s.click(); } });
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
    await sleep(300);
    await page.evaluate(() => { const d = document.getElementById('deliverBtn'); for (let i = 0; i < 5; i++) d.click(); });
    await sleep(300);
    const log = await readLog(page);
    ok('R2 5 deliver clicks + 5 surface taps + 5 late clicks: exactly 1 record (anywhere, harvested 2)', Array.isArray(log) && log.length === 1 && log[0].payload.operation === 'anywhere' && log[0].payload.harvested === 2, JSON.stringify(log));
    ok('R2 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R3 again x3: one record per completed activity, in order ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple' } }, base));
    await startRun(page);
    await completeActivity(page, 2);
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);
      ok('R3 again #' + (k + 1) + ': record count unchanged at the start of the new activity (' + (k + 1) + ')', (await readLog(page)).length === k + 1);
      await completeActivity(page, 2);
    }
    const log = await readLog(page);
    ok('R3 4 completed activities -> 4 records, all goal 2 / fixed, timestamps non-decreasing', log.length === 4 && log.every((e) => e.payload.goal === 2 && e.payload.goalMode === 'fixed') && log.every((e, i) => i === 0 || Date.parse(e.timestamp) >= Date.parse(log[i - 1].timestamp)), JSON.stringify(log.map((e) => e.timestamp)));
    ok('R3 the records are appended (oldest first)', Date.parse(log[0].timestamp) <= Date.parse(log[3].timestamp));
    await context.close();
  }

  /* ---------------- R4 random mode: the drawn goal is what gets recorded ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 4, goalMode: 'random', operation: 'anywhere' } }, base));
    const seen = [];
    await startRun(page);
    for (let k = 0; k < 4; k++) {
      const g = parseInt(await page.getAttribute('#app', 'data-goal'), 10);
      await completeActivity(page, g);
      seen.push(g);
      if (k < 3) { await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700); }
    }
    const log = await readLog(page);
    ok('R4 random mode: 4 records, goalMode random, each goal = the number drawn for that activity', log.length === 4 && log.every((e, i) => e.payload.goalMode === 'random' && e.payload.goal === seen[i] && e.payload.harvested === seen[i]), JSON.stringify({ seen, got: log.map((e) => e.payload.goal) }));
    ok('R4 the saved fixed goal (4) is not what is recorded unless drawn', log.every((e) => e.payload.goal >= 1 && e.payload.goal <= 10));
    await context.close();
  }

  /* ---------------- R5 unfinished activities are never recorded ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'apple' } }, base));
    await startRun(page);
    await harvestAll(page, 2);
    await openSettings(page);
    await page.click('#restartBtn'); await sleep(700);           // やめて はじめる: the old activity is abandoned
    ok('R5 restart from settings mid-activity: no record (phase harvest again)', (await phase(page)) === 'harvest' && (await readLog(page)) === null);
    await harvestAll(page, 3);                                       // complete but not delivered
    await page.reload(); await sleep(400);                           // the page is closed / reloaded before「とどける」
    ok('R5 reload while complete (not delivered): no record', (await readLog(page)) === null);
    await startRun(page); await completeActivity(page, 3);
    ok('R5 the next finished activity records normally (1)', (await readLog(page)).length === 1);
    await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);
    await harvestAll(page, 1);
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await sleep(200);
    ok('R5 pagehide / visibilitychange mid-activity: nothing written (still 1)', (await readLog(page)).length === 1);
    ok('R5 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R6 conditions are recorded as facts: anywhere, number hidden, switch scan ON ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'anywhere', showNumber: false } }, base));
    await openSettings(page);
    await page.click('[data-scan-on="1"]'); await sleep(300);
    await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700);
    await completeActivity(page, 1);
    const log = await readLog(page);
    const p = (log && log[0] && log[0].payload) || {};
    ok('R6 payload: anywhere, showNumber false, switchScan true, goal 1, harvested 1', p.operation === 'anywhere' && p.showNumber === false && p.switchScan === true && p.goal === 1 && p.harvested === 1, JSON.stringify(p));
    ok('R6 inputMethod stays null even with switch scanning ON (no guessing)', log[0].inputMethod === null);
    ok('R6 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R7 durationSec counts this activity only ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple' } }, base));
    await startRun(page);
    await sleep(1500);
    await completeActivity(page, 1);
    const d1 = (await readLog(page))[0].payload.durationSec;
    ok('R7 first activity waited 1.5 s before the harvest: durationSec >= 2.0', d1 >= 2.0 && d1 < 30, String(d1));
    await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);
    await completeActivity(page, 1);
    const d2 = (await readLog(page))[1].payload.durationSec;
    ok('R7 the next activity restarts the clock (shorter than the first, not cumulative)', d2 < d1 && d2 > 0, String(d2));
    await context.close();
  }

  /* ---------------- R8 corrupted storage: the activity still runs and the log is rebuilt ---------------- */
  for (const seed of ['{not valid json', '"hello"', '{}', '123']) {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple' }, seedLog: seed }, base));
    await startRun(page);
    ok('R8 seed ' + JSON.stringify(seed) + ': the activity starts (harvest)', (await phase(page)) === 'harvest');
    await completeActivity(page, 1);
    const log = await readLog(page);
    ok('R8 seed ' + JSON.stringify(seed) + ': after delivery the key holds an array with exactly 1 valid record', Array.isArray(log) && log.length === 1 && log[0].appId === 'ringo-potton-app', JSON.stringify(log));
    ok('R8 seed ' + JSON.stringify(seed) + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R9 rolling cap 200 ---------------- */
  {
    const seeded = []; for (let i = 0; i < 200; i++) seeded.push({ timestamp: new Date(1700000000000 + i * 1000).toISOString(), appId: 'ringo-potton-app', activity: 'ringo-delivery', inputMethod: null, schemaVersion: 1, payload: { goal: 1, goalMode: 'fixed', operation: 'apple', showNumber: true, switchScan: false, harvested: 1, durationSec: 1, seedIndex: i } });
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple' }, seedLog: JSON.stringify(seeded) }, base));
    await startRun(page); await completeActivity(page, 1);
    const log = await readLog(page);
    ok('R9 200 existing + 1 new = 200 kept: the oldest is dropped, the new record is last', log.length === 200 && log[0].payload.seedIndex === 1 && log[199].payload.seedIndex === undefined && log[199].payload.goal === 1, JSON.stringify({ len: log.length, first: log[0].payload.seedIndex, last: log[199].payload }));
    await openSettings(page);
    ok('R9 settings row shows the count on this device (200)', (await page.textContent('#recordCount')).replace(/\s/g, '') === 'この端末に200けん', await page.textContent('#recordCount'));
    await context.close();
  }

  /* ---------------- R10 settings row: count + two-step delete all ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple' } }, base));
    await openSettings(page);
    ok('R10 no records yet: count 0 and the delete button is disabled', (await page.textContent('#recordCount')).replace(/\s/g, '') === 'この端末に0けん' && (await page.evaluate(() => document.getElementById('recordClearBtn').disabled)));
    await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700);
    await completeActivity(page, 1);
    await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);
    await completeActivity(page, 1);
    await openSettings(page);
    ok('R10 after 2 deliveries: count 2, delete button enabled, confirmation hidden', (await page.textContent('#recordCount')).replace(/\s/g, '') === 'この端末に2けん' && !(await page.evaluate(() => document.getElementById('recordClearBtn').disabled)) && (await page.evaluate(() => document.getElementById('recordClearConfirm').hidden)));
    await page.click('#recordClearBtn'); await sleep(150);
    ok('R10 first tap: confirmation shown, nothing deleted yet', (await page.evaluate(() => !document.getElementById('recordClearConfirm').hidden && document.getElementById('recordClearBtn').hidden)) && (await readLog(page)).length === 2);
    await page.click('#recordClearCancel'); await sleep(150);
    ok('R10 やめる: confirmation hidden, records kept (2)', (await page.evaluate(() => document.getElementById('recordClearConfirm').hidden && !document.getElementById('recordClearBtn').hidden)) && (await readLog(page)).length === 2);
    await page.evaluate(() => { const l = document.getElementById('liveStatus'); l.textContent = ''; const s = document.getElementById('donomanaA11yStatus'); if (s) s.textContent = ''; const p = document.getElementById('donomanaAnnouncePolite'); if (p) p.textContent = ''; });
    await page.click('#recordClearBtn'); await sleep(150);
    await page.click('#recordClearYes'); await sleep(400);
    const after = await rawLog(page);
    ok('R10 けす: the key now holds an empty array (explicit clear, not a delete), count 0, button disabled again', after === '[]' && (await page.textContent('#recordCount')).replace(/\s/g, '') === 'この端末に0けん' && (await page.evaluate(() => document.getElementById('recordClearBtn').disabled && document.getElementById('recordClearConfirm').hidden)), String(after));
    const live = await page.evaluate(() => ['liveStatus', 'donomanaAnnouncePolite', 'donomanaA11yStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('R10 deletion announced to the live region', /きろくを すべて けしました/.test(live), live);
    ok('R10 settings key survives the record deletion', await page.evaluate((k) => localStorage.getItem(k) !== null, SETTINGS_KEY));
    await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);   // the settings were opened while celebrating
    await completeActivity(page, 1);
    ok('R10 recording works again after a clear (1)', (await readLog(page)).length === 1);
    ok('R10 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R11 scan: the record buttons are candidates only while visible ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple' }, seedLog: JSON.stringify([{ timestamp: '2026-11-12T00:00:00.000Z', appId: 'ringo-potton-app', activity: 'ringo-delivery', inputMethod: null, schemaVersion: 1, payload: { goal: 1, goalMode: 'fixed', operation: 'apple', showNumber: true, switchScan: false, harvested: 1, durationSec: 3 } }]) }, base));
    await openSettings(page);
    await page.click('[data-scan-on="1"]'); await sleep(300);
    const ids1 = await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).filter(Boolean));
    ok('R11 sheet open + scan ON: 「きろくを すべて けす」is a candidate, the confirmation buttons are not', ids1.includes('recordClearBtn') && !ids1.includes('recordClearCancel') && !ids1.includes('recordClearYes'), ids1.join(','));
    await page.click('#recordClearBtn'); await sleep(200);
    const ids2 = await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).filter(Boolean));
    ok('R11 confirmation shown: やめる / けす are candidates, the hidden first button is not', ids2.includes('recordClearCancel') && ids2.includes('recordClearYes') && !ids2.includes('recordClearBtn'), ids2.join(','));
    await page.evaluate(() => document.getElementById('recordClearYes').click()); await sleep(300);
    ok('R11 cleared via click(): [] and the row is back to its idle state', (await rawLog(page)) === '[]' && (await page.evaluate(() => document.getElementById('recordClearConfirm').hidden)));
    await context.close();
  }

  /* ---------------- R12 voice OFF + motion ON: still one record ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple', voice: false }, motion: true }, base));
    await startRun(page);
    for (let i = 0; i < 2; i++) { await page.click('.apple[data-status="ripe"]'); await sleep(1100); }
    await sleep(700);
    await page.evaluate(() => document.getElementById('deliverBtn').click());
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 8000 });
    await sleep(300);
    const log = await readLog(page);
    ok('R12 voice OFF, animations ON: 1 record with goal 2 / harvested 2', log.length === 1 && log[0].payload.goal === 2 && log[0].payload.harvested === 2, JSON.stringify(log));
    ok('R12 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- R13 wording: no evaluative words; the help explains the record ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    const t = await page.evaluate(() => ({
      settings: document.getElementById('settingsSheet').textContent,
      help: document.getElementById('helpSheet').textContent,
      nav: document.getElementById('donomanaRecordNavBtn').textContent + ' ' + document.getElementById('donomanaRecordNavBtn').getAttribute('aria-label')
    }));
    // the help's pre-existing sentence「点数・時間・正解や まちがいは ありません」names those words to deny them; it is not new text
    const helpText = t.help.replace('点数・時間・正解や まちがいは ありません', '');
    ok('R13 settings sheet / help / nav button carry no praise, scoring or error words', !EVAL_RE.test(t.settings) && !EVAL_RE.test(helpText) && !EVAL_RE.test(t.nav), JSON.stringify({ s: (t.settings.match(EVAL_RE) || [])[0], h: (helpText.match(EVAL_RE) || [])[0], n: (t.nav.match(EVAL_RE) || [])[0] }));
    ok('R13 help: the old「学習の記録は のこしません」is gone and the record is explained (saved on this device, unfinished not saved, deletable)', !/のこしません/.test(t.help) && /がくしゅうの きろく/.test(t.help) && /とちゅうで やめた かつどうは ほぞんしません/.test(t.help) && /きろくを すべて けす/.test(t.help));
    ok('R13 settings sheet explains what is saved and where to see it', /がくしゅうの きろく/.test(t.settings) && /学習のきろく/.test(t.settings));
    ok('R13 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
