// Real-browser (Playwright / Chromium) test for the level「2しゅるい ぴったり」(settings.level = 'kinds2extra') of
// ringo-potton-app.html (Phase RINGO-POTTON-LEVEL-UP-AB-1): the levels「くだものを 2 しゅるい」and「おおめから ぴったり」together.
//
// The asked number (the goal) is the total, split over two of the three kinds as in「くだものを 2 しゅるい」(each 1..5).
// The tree carries MORE than asked, of those two kinds only: the おおめの かず (+1..+3, the same setting as「おおめから
// ぴったり」) is split as evenly as it goes, an odd one going to either kind; never more than 12 fruit (the extras give
// way, never below one). The basket has a frame for every fruit on the tree, split by kind, each frame at least 44px
// (a row that does not fit on one line wraps); a fruit in the basket goes back to the tree when it is touched, and
// the count of ITS kind is spoken. 「とどける」and「たのまれた かずが かごに はいりました。」are shown only while BOTH kinds
// are exactly as asked (the total alone is not enough). Counting and the numbers are per kind; decoys never appear.
// The request is two files: the first kind's opening piece (a-banana-<n>.mp3 / a-mikan-<n>.mp3), then the closing
// piece that ends with「ぴったり おねがいね」(ringo-b-<n>.mp3 for apples, a-mikan-pittari-<n>.mp3 for mikan); the bubble
// says the same sentence and the synthesised voice says it whole if a file cannot be played. The whole-screen touch
// takes each kind only up to the asked number, in the order of the request. A goal of 1 is one apple plus the
// extras, exactly as「おおめから ぴったり」with the goal 1. The record gets level kinds2extra, extra and the per-kind
// counts; its「学習のきろく」summary is the one of「くだものを 2 しゅるい」.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-level-up-ab-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with stubbed speechSynthesis / HTMLAudioElement
// (tools/ringo-potton-poc/ringo-potton-voice-stubs.js). It proves WHICH files the app plays, in which order and when,
// not how they sound. It is NOT an iPad Safari, real-audio, VoiceOver, Bluetooth-switch or real-touch result and must
// never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB, NO_AUDIO_STUB } = require('./ringo-potton-voice-stubs.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const squash = (t) => String(t).replace(/\s+/g, '');
const ORDER = ['banana', 'mikan', 'apple'];                                   // the spoken order
const NAME = { banana: 'バナナ', mikan: 'みかん', apple: 'りんご' };
const KANA = ['', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'];
// what the request must be for a pair [{kind, n}, {kind, n}], written independently of the app
const firstFile = (q) => 'a-' + q.kind + '-' + q.n + '.mp3';
const lastFile = (q) => (q.kind === 'apple' ? 'ringo-b-' + q.n + '.mp3' : 'a-' + q.kind + '-pittari-' + q.n + '.mp3');
const bubbleOf = (req) => squash(req.map((q) => NAME[q.kind] + 'を ' + q.n + 'こ').join('、') + ' とってね。ぴったり おねがいね');
const saidOf = (req) => req.map((q) => NAME[q.kind] + 'を ' + KANA[q.n]).join('、') + ' とってね。ぴったり おねがいね';
const summaryOf = (req) => req.map((q) => NAME[q.kind] + 'を ' + q.n + 'こ').join('、') + ' とって とどけました';
const KEYS15 = 'decoys,durationSec,extra,goal,goalMax,goalMin,goalMode,harvested,level,moveSpeed,operation,refusals,showNumber,swipe,switchScan';
const KEYS18 = 'decoys,durationSec,extra,goal,goalMax,goalMin,goalMode,harvested,kindApple,kindBanana,kindMikan,level,moveSpeed,operation,refusals,showNumber,swipe,switchScan';

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// the「学習のきろく」summary of a stored record, through the real adapter (Node side, as the golden tests load it)
global.donomanaNazoriRecordDetail = require(path.join(ROOT, 'assets', 'js', 'nazori-record-detail.js'));
global.donomanaKanaRecordTraceRenderer = require(path.join(ROOT, 'assets', 'js', 'kana-record-trace-renderer.js'));
global.donomanaKanaRecordDetail = require(path.join(ROOT, 'assets', 'js', 'kana-record-detail.js'));
global.donomanaOkaneRecordDetail = require(path.join(ROOT, 'assets', 'js', 'okane-record-detail.js'));
global.donomanaTokeiRecordDetail = require(path.join(ROOT, 'assets', 'js', 'tokei-record-detail.js'));
global.donomanaShiritori2RecordDetail = require(path.join(ROOT, 'assets', 'js', 'shiritori2-record-detail.js'));
const dash = require(path.join(ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage } = require(path.join(ROOT, 'tools', 'record-dashboard-poc', 'fixtures.js'));
function summaries(log) {
  const st = new FakeStorage();
  st.setItem('ringo_potton_log', JSON.stringify(log));
  const res = dash.readAppRecords('ringo-potton-app', { storage: st });           // read as the page reads it (storage -> raw records)
  return (res && res.ok ? res.rawRecords : []).map((raw) => dash.normalizeRecord('ringo-potton-app', raw).summary);
}

// options: settings, viewport, motion, init (extra init script, e.g. the stubs' failure switches), noAudio
async function newPage(browser, base, o) {
  o = o || {};
  const context = await browser.newContext({ viewport: o.viewport || { width: 834, height: 1194 }, reducedMotion: o.motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(o.noAudio ? NO_AUDIO_STUB : AUDIO_STUB);
  // window.__rq: numbers the next Math.random() calls return (then the real generator again), so a test can
  // choose the split and the two kinds; window.__auDur: a file whose name contains a key ends that long after play()
  await context.addInitScript(() => { window.__rq = []; const real = Math.random; Math.random = function () { return window.__rq.length ? window.__rq.shift() : real(); }; window.__auDur = { okotowari: 700 }; });
  if (o.init) await context.addInitScript(o.init);
  await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { if (v !== null) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: o.settings === undefined ? null : J(o.settings) });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(base + '/ringo-potton-app.html'); await sleep(250);
  return { context, page };
}
const attr = (page, a) => page.getAttribute('#app', a);
const phase = (page) => attr(page, 'data-phase');
const harvested = async (page) => parseInt(await attr(page, 'data-harvested'), 10);
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SETTINGS_KEY);
const readLog = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ringo_potton_log') || '[]'));
const live = (page) => page.evaluate(() => ['liveStatus', 'donomanaAnnouncePolite', 'donomanaAnnounceAssertive'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
const spoken = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const base = (s) => String(s).split('/').pop();
const plays = (page) => page.evaluate(() => window.__au.filter((o) => o.op === 'play' && !o.muted).map((o) => String(o.src).split('/').pop()));
const audioLog = (page) => page.evaluate(() => window.__au.filter((o) => o.op !== 'new' && !o.muted).map((o) => o.op + ':' + String(o.src).split('/').pop()));
const bubbleSaid = (page) => page.evaluate(() => Array.from(document.getElementById('bubble').children).filter((e) => !e.hidden).map((e) => e.textContent).join('').replace(/\s+/g, ''));
// the next activity's draw: the first kind (in spoken order) gets `first`, and `skip` names the kind left out
// oddTo (0 | 1, only when the extras are an odd number): which of the two kinds gets the odd one
async function force(page, goal, first, skip, oddTo) {
  const lo = Math.max(1, goal - 5), hi = Math.min(5, goal - 1);
  const q = [(first - lo + 0.5) / (hi - lo + 1), (ORDER.indexOf(skip) + 0.5) / 3];
  if (oddTo === 0 || oddTo === 1) q.push(oddTo === 0 ? 0.25 : 0.75);
  await page.evaluate((x) => { window.__rq = x; }, q);
}
// everything the level shows about the request
const state = (page) => page.evaluate(() => {
  const app = document.getElementById('app');
  const tree = Array.from(document.querySelectorAll('#appleGrid .apple'));
  const slots = Array.from(document.querySelectorAll('#slots .slot'));
  const rows = Array.from(document.querySelectorAll('#kindCounts .kind-count'));
  const kinds = {}; tree.forEach((e) => { const k = e.getAttribute('data-kind'); kinds[k] = (kinds[k] || 0) + 1; });
  return {
    phase: app.getAttribute('data-phase'), goal: parseInt(app.getAttribute('data-goal'), 10), level: app.getAttribute('data-level'), decoysAttr: app.getAttribute('data-decoys'),
    treeKinds: kinds, treeOrder: tree.map((e) => e.getAttribute('data-kind')), treeLabels: Array.from(new Set(tree.map((e) => e.getAttribute('aria-label')))).sort(),
    ripe: tree.filter((e) => e.getAttribute('data-status') === 'ripe').map((e) => e.getAttribute('data-kind')),
    frames: slots.map((e) => ({ kind: e.getAttribute('data-kind'), row: e.style.gridRow || null, col: e.style.gridColumn || null, filled: e.getAttribute('data-filled'), ret: e.getAttribute('data-ret'), label: e.getAttribute('aria-label'), tag: e.tagName, icon: (e.querySelector('use') || { getAttribute() { return ''; } }).getAttribute('href') })),
    slotsKinds: document.getElementById('slots').getAttribute('data-kinds'),
    rows: rows.map((e) => ({ kind: e.getAttribute('data-kind'), num: e.querySelector('.count-num').textContent, numShown: !e.querySelector('.count-num').hidden, icon: e.querySelector('use').getAttribute('href') })),
    countBoxShown: !document.getElementById('countBox').hidden, hasBubbleKinds: !!document.getElementById('bubbleKinds'),
    clauses: Array.from(document.querySelectorAll('#bubbleKinds .req-clause')).map((c) => ({ kind: c.getAttribute('data-kind'), num: (c.querySelector('.req-num') || {}).textContent || null, pics: c.querySelectorAll('.req-pics svg').length, picKinds: Array.from(new Set(Array.from(c.querySelectorAll('.req-pics use')).map((u) => u.getAttribute('href')))).join() })),
    reqPics: document.querySelectorAll('#reqPics svg').length, deliver: !document.getElementById('deliverBtn').hidden,
    note: document.getElementById('doneNote').hidden ? null : document.getElementById('doneNote').textContent, basketRole: document.getElementById('basket').getAttribute('role'), basketLabel: document.getElementById('basket').getAttribute('aria-label'),
    tray: document.querySelectorAll('#decoyTray svg').length, overflowX: document.documentElement.scrollWidth > innerWidth
  };
});
// the request of this activity, read from the screen: [{kind, n: asked (the bubble's pictures), t: on the tree = frames of that kind}, ...]
const reqOf = (s) => s.clauses.map((c) => ({ kind: c.kind, n: c.pics, t: s.frames.filter((f) => f.kind === c.kind).length }));
const asked = (s) => s.clauses.map((c) => ({ kind: c.kind, n: c.pics }));
async function start(page) { await page.click('#startBtn'); await sleep(700); }
// click the first ripe fruit of a kind (or any kind) and wait until it is in the basket
async function take(page, kind) {
  await page.evaluate((k) => new Promise((res, rej) => {
    const app = document.getElementById('app'), h0 = app.getAttribute('data-harvested'), t0 = performance.now();
    const iv = setInterval(() => {
      if (app.getAttribute('data-harvested') !== h0) { clearInterval(iv); return res(); }
      if (performance.now() - t0 > 10000) { clearInterval(iv); return rej(new Error('take(' + k + ') timed out in phase ' + app.getAttribute('data-phase'))); }
      const b = document.querySelector('#appleGrid .apple' + (k ? '[data-kind="' + k + '"]' : '') + '[data-status="ripe"]'); if (b) b.click();
    }, 15);
  }), kind || null);
  await sleep(80);
}
async function waitPhase(page, ph, t) { await page.waitForFunction((x) => document.getElementById('app').getAttribute('data-phase') === x, ph, { timeout: t || 15000 }); }
// take exactly what was asked for, kind by kind
async function takeAsked(page) { const s = await state(page); for (const c of s.clauses) for (let i = 0; i < c.pics; i++) await take(page, c.kind); await waitPhase(page, 'complete'); await sleep(150); }
// touch the fruit in the i-th filled frame of a kind (a real pointer click at its centre), then wait until it hangs on the tree again
async function giveBack(page, kind, i) {
  await sleep(700);
  const c = await page.evaluate(({ kind, i }) => { const s = Array.from(document.querySelectorAll('#slots .slot[data-filled="1"]' + (kind ? '[data-kind="' + kind + '"]' : '')))[i || 0]; if (!s) return null; const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { x, y, onSlot: !!top && !!top.closest && top.closest('.slot') === s }; }, { kind, i });
  if (!c) throw new Error('giveBack: there is no filled frame ' + kind + ' ' + i);
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150);
  return c;
}
async function finish(page) { await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click()); await waitPhase(page, 'celebrate'); await sleep(700); }
async function again(page) { await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(800); }
async function restart(page) { await page.evaluate(() => document.getElementById('restartBtn').click()); await sleep(700); }
async function openPanel(page) { await page.click('#ringoLevelBtn'); await sleep(150); }
async function choose(page, v) { await page.click('#ringoLevelPanel [data-level-opt="' + v + '"]'); await sleep(150); }
async function closePanel(page) { await page.click('#ringoLevelClose'); await sleep(550); }
const scanCand = (page) => page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id || (e.classList.contains('slot') ? 'slot:' + e.getAttribute('data-kind') : e.getAttribute('data-kind'))));

// the extras the tree gets beside the asked number: the setting, but never more than 12 fruit in all (and at least one)
const extrasFor = (goal, want) => Math.max(1, Math.min(want, 12 - goal));

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const L = 'kinds2extra';

  /* ---------------- AB0 the five new files exist and are preloaded with the others (42 in all) ---------------- */
  {
    const dir = path.join(ROOT, 'assets', 'ringo-potton', 'voice');
    const want = [1, 2, 3, 4, 5].map((n) => 'a-mikan-pittari-' + n + '.mp3');
    const onDisk = fs.readdirSync(dir).filter((f) => /pittari/.test(f)).sort();
    ok('AB0 assets/ringo-potton/voice/ holds exactly the 5 files a-mikan-pittari-1..5.mp3, and 42 voice files in all', J(onDisk) === J(want) && fs.readdirSync(dir).length === 42, J(onDisk) + ' ' + fs.readdirSync(dir).length);
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 4, level: L } });
    const made = await page.evaluate(() => window.__au.filter((o) => o.op === 'new').map((o) => String(o.src).split('/').pop()));
    ok('AB0 the app creates 42 Audio objects at load, each file once, the 5 new ones among them; nothing is played yet', made.length === 42 && new Set(made).size === 42 && want.every((f) => made.includes(f)) && (await page.evaluate(() => window.__au.filter((o) => o.op === 'play').length)) === 0, J(made));
    await start(page);
    const primed = await page.evaluate(() => window.__au.filter((o) => o.op === 'play' && o.muted).map((o) => String(o.src).split('/').pop()));
    ok('AB0「はじめる」primes all 42 files with a muted play', primed.length === 42 && want.every((f) => primed.includes(f)), String(primed.length));
    await context.close();
  }

  /* ---------------- AB1 the fourth option in the panel; saved; next activity /「いますぐ はじめなおす」; the settings row ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 4 } });
    await openPanel(page);
    const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#ringoLevelPanel [data-level-opt]')).map((b) => ({ v: b.getAttribute('data-level-opt'), text: b.textContent.replace(/（じゅんびちゅう）/, '').replace(/\s+/g, ' ').trim(), disabled: b.disabled, pressed: b.getAttribute('aria-pressed') })));
    ok('AB1 the panel offers four levels in this order: ふつう / くだものを 2 しゅるい / おおめから ぴったり / 2しゅるい ぴったり; none disabled', J(opts.map((o) => o.v)) === J(['normal', 'kinds2', 'extra', 'kinds2extra']) && J(opts.map((o) => o.text)) === J(['ふつう', 'くだものを 2 しゅるい', 'おおめから ぴったり', '2しゅるい ぴったり']) && opts.every((o) => !o.disabled) && opts[0].pressed === 'true', J(opts));
    await choose(page, L);
    ok('AB1 start screen: choosing「2しゅるい ぴったり」saves level kinds2extra and shows it pressed (only it); nothing is started, spoken or played', (await saved(page)).level === L && (await page.evaluate(() => Array.from(document.querySelectorAll('#ringoLevelPanel [aria-pressed="true"]')).map((b) => b.getAttribute('data-level-opt')).join())) === L && (await phase(page)) === 'start' && (await spoken(page)).length === 0 && (await plays(page)).length === 0 && /2しゅるい ぴったりに しました/.test(await live(page)), await live(page));
    await closePanel(page);
    // the settings row「おおめの かず」is offered for this level too
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    const row = await page.evaluate(() => ({ hidden: document.getElementById('rowExtra').hidden, label: document.getElementById('lblExtra').textContent, pressed: Array.from(document.querySelectorAll('#rowExtra [data-extra]')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-extra')).join() }));
    ok('AB1 settings: the row「おおめの かず（ぴったりの レベル）」is shown for this level, ＋2 pressed by default', !row.hidden && row.label === 'おおめの かず（ぴったりの レベル）' && row.pressed === '2', J(row));
    await page.click('#rowExtra [data-extra="3"]'); await sleep(150);
    await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550);
    await start(page);
    let s = await state(page), rq = reqOf(s);
    ok('AB1 the activity that starts now is in that level: two kinds, asked 4 in all, 4 + 3 fruit on the tree (extra 3), data-level kinds2extra', s.level === L && rq.length === 2 && rq[0].n + rq[1].n === 4 && s.treeOrder.length === 7 && rq[0].t + rq[1].t === 7, J(rq));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
    await page.evaluate(() => { if (document.getElementById('settingsSheet').hidden) document.getElementById('scOpen').click(); }); await sleep(150);
    const pend0 = await page.isHidden('#pendingNote');
    await page.click('#rowExtra [data-extra="1"]'); await sleep(150);
    ok('AB1 mid-activity: changing the おおめの かず shows the「つぎの かつどうから」note and leaves the tree alone (7 fruit)', pend0 && await page.isVisible('#pendingNote') && (await state(page)).treeOrder.length === 7);
    await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550);
    await openPanel(page); await choose(page, 'normal');
    ok('AB1 mid-activity: choosing「ふつう」saves it and offers「いますぐ はじめなおす」; the running activity is untouched', (await saved(page)).level === 'normal' && await page.isVisible('#ringoLevelRestart') && (await state(page)).level === L && (await state(page)).treeOrder.length === 7);
    await page.click('#ringoLevelRestart'); await sleep(800);
    s = await state(page);
    ok('AB1「いますぐ はじめなおす」: an ordinary activity starts at once (4 apples) and nothing of the other level is left on the screen', s.level === 'normal' && J(s.treeKinds) === J({ apple: 4 }) && !s.hasBubbleKinds && s.rows.length === 0 && s.slotsKinds === null && s.countBoxShown && s.reqPics === 4 && s.frames.every((f) => f.kind === null && f.row === null && f.tag === 'DIV') && (await page.evaluate(() => !document.getElementById('bubbleExact'))) && (await bubbleSaid(page)) === squash('りんごを 4こ、とってね') && (await plays(page)).slice(-1)[0] === 'ringo-4.mp3', J(s.frames[0]) + ' ' + await bubbleSaid(page));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
    await page.evaluate(() => { if (document.getElementById('settingsSheet').hidden) document.getElementById('scOpen').click(); }); await sleep(150);
    ok('AB1 level ふつう: the settings row is hidden again (the number is kept: extra 1)', await page.evaluate(() => document.getElementById('rowExtra').hidden) && (await saved(page)).extra === 1);
    await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550);
    ok('AB1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    for (const c of [{ level: 'extra', shown: true }, { level: 'kinds2', shown: false }]) {
      const q = await newPage(browser, BASE, { settings: { goal: 3, level: c.level } });
      await q.page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
      const r2 = await q.page.evaluate(() => ({ hidden: document.getElementById('rowExtra').hidden, label: document.getElementById('lblExtra').textContent }));
      ok('AB1 settings row in the level ' + c.level + ': ' + (c.shown ? 'shown, with the same heading「おおめの かず（ぴったりの レベル）」' : 'hidden, as before'), r2.hidden === !c.shown && r2.label === 'おおめの かず（ぴったりの レベル）', J(r2));
      await q.context.close();
    }
  }
  // the panel with four options: a column, or ONE line of four on a short screen
  for (const vp of [{ n: 'iPad portrait', w: 820, h: 1180, line: false }, { n: 'iPad landscape', w: 1180, h: 820, line: false }, { n: 'phone portrait', w: 390, h: 844, line: false }, { n: 'phone landscape', w: 844, h: 390, line: true }, { n: 'small phone landscape', w: 667, h: 375, line: true }]) {
    for (const st of ['start', 'mid-activity']) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, voice: false }, viewport: { width: vp.w, height: vp.h } });
      if (st !== 'start') { await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700); }
      await page.evaluate(() => document.getElementById('ringoLevelBtn').click()); await sleep(200);
      if (st !== 'start') { await page.evaluate(() => document.querySelector('#ringoLevelPanel [data-level-opt="kinds2extra"]').click()); await sleep(200); }
      const g = await page.evaluate(() => {
        const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; }, hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        const pn = document.getElementById('ringoLevelPanel'), pr = R(pn), os = Array.from(pn.querySelectorAll('[data-level-opt]'));
        return { inside: pr.l >= 0 && pr.r <= innerWidth + 0.5 && pr.b <= innerHeight + 0.5, scrolls: pn.scrollHeight > pn.clientHeight + 1, lines: new Set(os.map((e) => Math.round(e.getBoundingClientRect().top))).size,
          covers: ['donomanaHomeBtn', 'donomanaLockBtn', 'donomanaFsBtn', 'donomanaHelpBtn', 'donomanaA11yBtn', 'donomanaRecordNavBtn'].filter((c) => hit(pr, R(document.getElementById(c)))),
          minH: Math.round(Math.min(...Array.from(pn.querySelectorAll('button')).filter((e) => !e.hidden).map((e) => e.getBoundingClientRect().height))), restart: !document.getElementById('ringoLevelRestart').hidden, clipped: os.filter((e) => e.scrollWidth > e.clientWidth + 1).length };
      });
      ok('AB1 panel, ' + vp.n + ', ' + st + ': the four levels ' + (vp.line ? 'on ONE line' : 'in a column') + ', inside the screen, no scrolling inside, no common button covered, every button >= 44px, no name cut off', g.lines === (vp.line ? 1 : 4) && g.inside && !g.scrolls && g.covers.length === 0 && g.minH >= 44 && g.clipped === 0 && g.restart === (st !== 'start'), J(g));
      await context.close();
    }
  }

  /* ---------------- AB2 the split and the extras: two kinds only, extras as even as they go, never more than 12 ---------------- */
  {
    const oddSeen = new Set();
    for (let goal = 2; goal <= 10; goal++) {
      for (const want of [1, 2, 3]) {
        const { context, page } = await newPage(browser, BASE, { settings: { goal, level: L, extra: want, dummy: true, voice: false } });
        await start(page);
        const draws = await page.evaluate((n) => {
          const out = [];
          for (let i = 0; i < n; i++) {
            if (i) document.getElementById('restartBtn').click();
            const cnt = (list) => { const c = {}; list.forEach((k) => { c[k] = (c[k] || 0) + 1; }); return c; };
            out.push({ tree: cnt(Array.from(document.querySelectorAll('#appleGrid .apple')).map((e) => e.getAttribute('data-kind'))), frames: cnt(Array.from(document.querySelectorAll('#slots .slot')).map((e) => e.getAttribute('data-kind'))),
              asked: Array.from(document.querySelectorAll('#bubbleKinds .req-clause')).map((c) => [c.getAttribute('data-kind'), c.querySelectorAll('.req-pics svg').length]), rows: Array.from(document.querySelectorAll('#kindCounts .kind-count')).map((e) => e.getAttribute('data-kind')),
              buttons: Array.from(document.querySelectorAll('#slots .slot')).every((e) => e.tagName === 'BUTTON'), decoys: document.getElementById('app').getAttribute('data-decoys'), goalAttr: document.getElementById('app').getAttribute('data-goal') });
          }
          return out;
        }, 40);
        const E = extrasFor(goal, want);
        let bad = null;
        for (const d of draws) {
          const kinds = d.asked.map((a) => a[0]), n = d.asked.map((a) => a[1]);
          const share = kinds.map((k, i) => (d.tree[k] || 0) - n[i]);
          const fine = kinds.length === 2 && ORDER.indexOf(kinds[0]) < ORDER.indexOf(kinds[1]) && n.every((x) => x >= 1 && x <= 5) && n[0] + n[1] === goal && d.goalAttr === String(goal)
            && J(Object.keys(d.tree).sort()) === J(kinds.slice().sort())                         // the extras are of the two asked kinds only
            && share[0] + share[1] === E && share.every((x) => x >= 0) && Math.abs(share[0] - share[1]) <= 1   // as even as it goes
            && kinds.every((k) => d.frames[k] === d.tree[k]) && d.buttons && J(d.rows) === J(kinds)   // a frame (a button) for every fruit, split by kind
            && goal + E <= 12 && d.decoys === '0';
          if (!fine && !bad) bad = d;
          if (fine && E % 2 === 1) oddSeen.add(share[0] > share[1] ? 'first' : 'second');
        }
        ok('AB2 goal ' + goal + ', おおめ +' + want + ' (' + E + ' extra' + (E === want ? '' : ', cut down to stay at 12') + '), 40 activities: two kinds each 1..5 asked; ' + (goal + E) + ' fruit of those two kinds only; shares ' + Math.ceil(E / 2) + ' + ' + Math.floor(E / 2) + '; a button frame per fruit; no decoy', bad === null && page.__errors.length === 0, J(bad) + page.__errors.join('|'));
        await context.close();
      }
    }
    ok('AB2 an odd extra goes to either kind (both seen over the activities above)', oddSeen.has('first') && oddSeen.has('second'), J([...oddSeen]));
    ok('AB2 (the rule) 12 at the most: goal 10 gets 2 extras with +2 and +3, 1 with +1; goal 9 gets 3 with +3', extrasFor(10, 3) === 2 && extrasFor(10, 2) === 2 && extrasFor(10, 1) === 1 && extrasFor(9, 3) === 3);
    // the odd one can be steered (the generator's next number), so the cases below can choose it
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 3, voice: false } });
    await force(page, 5, 2, 'mikan', 0); await start(page);
    const a = reqOf(await state(page));
    await force(page, 5, 2, 'mikan', 1); await restart(page);
    const b = reqOf(await state(page));
    ok('AB2 goal 5 = banana 2 + apple 3, +3: the tree carries 4 + 4 (odd one to the banana) or 3 + 5 (to the apple)', J(a) === J([{ kind: 'banana', n: 2, t: 4 }, { kind: 'apple', n: 3, t: 4 }]) && J(b) === J([{ kind: 'banana', n: 2, t: 3 }, { kind: 'apple', n: 3, t: 5 }]), J([a, b]));
    await context.close();
    // the random goal
    const r = await newPage(browser, BASE, { settings: { goal: 3, goalMode: 'random', goalMin: 8, goalMax: 10, level: L, extra: 3, voice: false } });
    await start(r.page);
    const rs = await state(r.page), rq = reqOf(rs);
    ok('AB2 random goal 8..10: the drawn number (' + rs.goal + ') is split, and the tree carries ' + (rs.goal + extrasFor(rs.goal, 3)) + ' fruit', rs.goal >= 8 && rs.goal <= 10 && rq[0].n + rq[1].n === rs.goal && rq[0].t + rq[1].t === rs.goal + extrasFor(rs.goal, 3) && rs.treeOrder.length <= 12 && r.page.__errors.length === 0, J(rq));
    await r.context.close();
  }

  /* ---------------- AB3 the goal 1: one apple plus the extras, exactly as「おおめから ぴったり」with the goal 1 ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 1, level: L, extra: 2, dummy: true } });
    await start(page);
    let s = await state(page);
    ok('AB3 goal 1: 3 apples on the tree (1 + 2), 3 plain button frames in one group, the ordinary number box, no per-kind pieces, no decoy', J(s.treeKinds) === J({ apple: 3 }) && s.frames.length === 3 && s.frames.every((f) => f.kind === null && f.tag === 'BUTTON') && s.rows.length === 0 && !s.hasBubbleKinds && s.countBoxShown && s.reqPics === 1 && s.decoysAttr === '0' && s.level === L, J(s.frames));
    ok('AB3 goal 1: the request of「おおめから ぴったり」(ringo-b-1.mp3 once,「りんごを 1こ とってね。ぴったり おねがいね」)', J(await plays(page)) === J(['ringo-b-1.mp3']) && (await bubbleSaid(page)) === squash('りんごを 1こ とってね。ぴったり おねがいね') && (await spoken(page)).length === 0, J(await plays(page)) + ' ' + await bubbleSaid(page));
    await take(page, 'apple'); await waitPhase(page, 'complete'); await sleep(150);
    ok('AB3 goal 1: one apple ->「とどける」and「たのまれた かずが かごに はいりました。」', (await state(page)).deliver && (await state(page)).note === 'たのまれた かずが かごに はいりました。');
    await sleep(700); await take(page, 'apple');
    ok('AB3 goal 1: a second apple can be taken -> too many, no「とどける」', (await harvested(page)) === 2 && !(await state(page)).deliver && (await phase(page)) === 'harvest');
    await giveBack(page, null, 0);
    ok('AB3 goal 1: sent back by a touch -> 1 again,「とどける」shown; counted いち, に, いち', (await harvested(page)) === 1 && (await state(page)).deliver && J(await spoken(page)) === J(['いち', 'に', 'いち']), J(await spoken(page)));
    await finish(page);
    const log = await readLog(page);
    ok('AB3 goal 1: recorded as level kinds2extra, extra 2, kindApple 1 (18 keys); the summary is「りんごを 1こ とって とどけました」', log.length === 1 && log[0].payload.level === L && log[0].payload.extra === 2 && log[0].payload.kindApple === 1 && log[0].payload.kindBanana === 0 && log[0].payload.kindMikan === 0 && log[0].payload.harvested === 1 && Object.keys(log[0].payload).sort().join() === KEYS18 && J(summaries(log)) === J(['りんごを 1こ とって とどけました']) && page.__errors.length === 0, J(log[0].payload) + ' ' + J(summaries(log)));
    await context.close();
  }

  /* ---------------- AB4 the request: two files, the second ending with「ぴったり おねがいね」; the bubble; the fallback ---------------- */
  {
    for (const c of [{ skip: 'apple', kinds: ['banana', 'mikan'] }, { skip: 'mikan', kinds: ['banana', 'apple'] }, { skip: 'banana', kinds: ['mikan', 'apple'] }]) {
      for (let n = 1; n <= 5; n++) {
        const req = [{ kind: c.kinds[0], n }, { kind: c.kinds[1], n: 6 - n }];
        const { context, page } = await newPage(browser, BASE, { settings: { goal: 6, level: L, extra: 2 }, init: 'window.__auDur = { "a-banana": 350, "a-mikan-1": 350, "a-mikan-2": 350, "a-mikan-3": 350, "a-mikan-4": 350, "a-mikan-5": 350 };' });
        await force(page, 6, n, c.skip);
        await page.click('#startBtn'); await sleep(150);
        const early = await audioLog(page);
        await sleep(700);
        const lg = (await audioLog(page)).filter((e) => !/^pause:/.test(e));
        const tag = 'AB4 ' + NAME[req[0].kind] + ' ' + n + ' + ' + NAME[req[1].kind] + ' ' + (6 - n);
        ok(tag + ': asked as that pair; the tree carries one more of each (+2)', J(reqOf(await state(page))) === J(req.map((q) => ({ kind: q.kind, n: q.n, t: q.n + 1 }))), J(reqOf(await state(page))));
        ok(tag + ': first ' + firstFile(req[0]) + ' alone; when it has ended, ' + lastFile(req[1]) + ' -- two audible plays, in that order', J(early.filter((e) => /^play:/.test(e))) === J(['play:' + firstFile(req[0])]) && J(lg) === J(['play:' + firstFile(req[0]), 'ended:' + firstFile(req[0]), 'play:' + lastFile(req[1])]), J(lg));
        ok(tag + ': nothing synthesised; the bubble says「' + req.map((q) => NAME[q.kind] + 'を ' + q.n + 'こ').join('、') + ' とってね。ぴったり おねがいね」', (await spoken(page)).length === 0 && (await bubbleSaid(page)) === bubbleOf(req) && page.__errors.length === 0, await bubbleSaid(page));
        await context.close();
      }
    }
    const req = [{ kind: 'banana', n: 2 }, { kind: 'mikan', n: 3 }];
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2, showNumber: false }, init: 'window.__auDur = { "a-banana": 200 };', viewport: { width: 390, height: 844 } });
      await force(page, 5, 2, 'mikan');
      await start(page); await sleep(300);
      const s = await state(page);
      ok('AB4 number hidden: the bubble says「バナナと りんごを とってね。ぴったり おねがいね」with each kind\'s pictures (2 and 3); the files are the same', (await bubbleSaid(page)) === squash('バナナと りんごを とってね。ぴったり おねがいね') && J(s.clauses.map((c) => [c.kind, c.num, c.pics])) === J([['banana', null, 2], ['apple', null, 3]]) && J(await plays(page)) === J(['a-banana-2.mp3', 'ringo-b-3.mp3']) && !s.overflowX, await bubbleSaid(page) + ' ' + J(s.clauses));
      ok('AB4 number hidden: each row keeps its kind\'s picture, the numbers are hidden', s.rows.length === 2 && s.rows.every((r) => !r.numShown) && !s.countBoxShown, J(s.rows));
      await context.close();
    }
    for (const when of ['first', 'second']) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2 }, init: 'window.__auDur = { "a-banana": ' + (when === 'first' ? 5000 : 200) + ' };' });
      await force(page, 5, 2, 'apple');
      await start(page); await sleep(when === 'first' ? 0 : 300);
      const before = (await audioLog(page)).length;
      await take(page); await sleep(900);
      const after = (await audioLog(page)).slice(before);
      ok('AB4 a fruit taken during the ' + when + ' piece: that piece is paused' + (when === 'first' ? ' and the second is never played' : '') + '; the count is spoken instead', after.includes('pause:' + (when === 'first' ? 'a-banana-2.mp3' : 'a-mikan-pittari-3.mp3')) && !after.some((e) => /^play:/.test(e)) && (await plays(page)).length === (when === 'first' ? 1 : 2) && J(await spoken(page)) === J(['いち']), J(after) + ' ' + J(await plays(page)));
      await context.close();
    }
    for (const c of [{ name: 'play() is refused', init: 'window.__auFail = true;', tried: ['a-banana-2.mp3'] },
      { name: 'the first file never loaded', init: 'window.__auErrorSrc = "a-banana-2";', tried: [] },
      { name: 'the second file (a-mikan-pittari-3.mp3) never loaded', init: 'window.__auErrorSrc = "a-mikan-pittari-3"; window.__auDur = { "a-banana": 200 };', tried: ['a-banana-2.mp3'] }]) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2 }, init: c.init });
      await force(page, 5, 2, 'apple');
      await start(page); await sleep(500);
      ok('AB4 ' + c.name + ': the synthesised voice says the whole sentence「' + saidOf(req) + '」, once; no other file instead; no error', J(await spoken(page)) === J([saidOf(req)]) && J(await plays(page)) === J(c.tried) && (await bubbleSaid(page)) === bubbleOf(req) && page.__errors.length === 0, J(await spoken(page)) + ' ' + J(await plays(page)));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2 }, init: 'window.__auErrorSrc = "ringo-b-3"; window.__auDur = { "a-banana": 200 };' });
      await force(page, 5, 2, 'mikan');
      await start(page); await sleep(500);
      ok('AB4 the second file (ringo-b-3.mp3) never loaded: the whole sentence「' + saidOf([{ kind: 'banana', n: 2 }, { kind: 'apple', n: 3 }]) + '」is synthesised', J(await spoken(page)) === J([saidOf([{ kind: 'banana', n: 2 }, { kind: 'apple', n: 3 }])]) && J(await plays(page)) === J(['a-banana-2.mp3']), J(await spoken(page)));
      await context.close();
      const q = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2 }, noAudio: true });
      await force(q.page, 5, 2, 'apple');
      await start(q.page); await sleep(400);
      ok('AB4 no Audio API at all: the synthesised voice says the whole sentence; no error', J(await spoken(q.page)) === J([saidOf(req)]) && q.page.__errors.length === 0, J(await spoken(q.page)));
      await q.context.close();
      const v = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2, voice: false } });
      await force(v.page, 5, 2, 'apple');
      await start(v.page); await sleep(400);
      await take(v.page);
      ok('AB4 voice OFF: nothing is played (not even muted), nothing is spoken; the bubble still shows the request', (await v.page.evaluate(() => window.__au.filter((o) => o.op === 'play').length)) === 0 && (await spoken(v.page)).length === 0 && (await bubbleSaid(v.page)) === bubbleOf(req));
      await v.context.close();
    }
  }

  /* ---------------- AB5 exactly as asked, KIND BY KIND; sending back; counting per kind; delivery; record; summary ---------------- */
  for (const motion of [false, true]) {
    const tag = motion ? 'motion ON' : 'reduced motion', settle = motion ? 300 : 120;
    const req = [{ kind: 'banana', n: 2 }, { kind: 'apple', n: 3 }];
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 2, dummy: true }, motion, init: 'window.__auDur = { "a-banana": 150 };' });
    await force(page, 5, 2, 'mikan');                                    // banana 2 + apple 3, one more of each on the tree
    await start(page); await sleep(300);
    const hHarvest = await page.evaluate(() => document.getElementById('canopy').getBoundingClientRect().height);
    let s = await state(page);
    ok('AB5 ' + tag + ': asked banana 2 + apple 3; the tree carries 3 bananas + 4 apples and nothing else (dummy option ON)', J(reqOf(s)) === J([{ kind: 'banana', n: 2, t: 3 }, { kind: 'apple', n: 3, t: 4 }]) && J(s.treeKinds) === J(s.treeOrder.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {})) && s.treeOrder.length === 7 && s.decoysAttr === '0', J(s.treeKinds));
    ok('AB5 ' + tag + ': a frame for every fruit, split by kind: 3 banana frames, then 4 apple frames -- buttons, none holding a fruit, none a control yet; each row with its picture and 0', J(s.frames.map((f) => f.kind)) === J(['banana', 'banana', 'banana', 'apple', 'apple', 'apple', 'apple']) && s.frames.every((f) => f.tag === 'BUTTON' && f.filled === '0' && f.ret === '0' && f.icon === '#ic-' + f.kind) && new Set(s.frames.filter((f) => f.kind === 'banana').map((f) => f.row)).size === 1 && J(s.rows.map((r) => [r.kind, r.num])) === J([['banana', '0'], ['apple', '0']]) && !s.countBoxShown && s.basketRole === 'group' && !s.deliver, J(s.frames.map((f) => f.kind[0] + f.row)));
    await take(page, 'banana'); await take(page, 'banana'); await take(page, 'apple'); await take(page, 'apple'); await sleep(settle);
    s = await state(page);
    ok('AB5 ' + tag + ': banana 2, apple 2 (4 in all): no「とどける」yet', J(s.rows.map((r) => r.num)) === J(['2', '2']) && !s.deliver && s.note === null && s.phase === 'harvest');
    await take(page, 'banana'); await sleep(settle);
    s = await state(page);
    ok('AB5 ' + tag + ': a third banana: the TOTAL is 5 = the asked total, but banana 3 (one too many) and apple 2 (one short) -> no「とどける」, no note', (await harvested(page)) === 5 && J(s.rows.map((r) => r.num)) === J(['3', '2']) && !s.deliver && s.note === null && s.phase === 'harvest', J(s.rows));
    await take(page, 'apple'); await sleep(settle);
    s = await state(page);
    ok('AB5 ' + tag + ': a third apple: banana 3, apple 3 (6 in all) -> still no「とどける」', J(s.rows.map((r) => r.num)) === J(['3', '3']) && !s.deliver && s.phase === 'harvest');
    ok('AB5 ' + tag + ': counted per kind so far: banana いち に, apple いち に, banana さん, apple さん', J(await spoken(page)) === J(['いち', 'に', 'いち', 'に', 'さん', 'さん']), J(await spoken(page)));
    ok('AB5 ' + tag + ': the frames that hold a fruit are the controls, each labelled with its kind', J(s.frames.map((f) => f.ret).join('')) === J('1111110') && s.frames.filter((f) => f.kind === 'banana' && f.ret === '1').every((f) => f.label === 'かごの バナナを きに もどす') && s.frames.filter((f) => f.kind === 'apple' && f.ret === '1').every((f) => f.label === 'かごの りんごを きに もどす'), J(s.frames.map((f) => f.label)));
    const sp0 = (await spoken(page)).length, au0 = (await plays(page)).length;
    const c1 = await giveBack(page, 'banana', 0);
    s = await state(page);
    ok('AB5 ' + tag + ': a touch on a banana in the basket (the frame itself is hit): it is back on the tree; banana 2, apple 3 = exactly as asked ->「とどける」and「たのまれた かずが かごに はいりました。」', c1.onSlot && J(s.rows.map((r) => r.num)) === J(['2', '3']) && s.deliver && s.note === 'たのまれた かずが かごに はいりました。' && s.phase === 'complete' && s.ripe.filter((k) => k === 'banana').length === 1, J(s.rows) + ' ' + s.note);
    ok('AB5 ' + tag + ': the count of THAT kind is spoken (banana: に); no file is played; the live region tells it', J((await spoken(page)).slice(sp0)) === J(['に']) && (await plays(page)).length === au0 && /バナナを きに もどしました。バナナ 2こ。/.test(await live(page)), J((await spoken(page)).slice(sp0)) + ' ' + await live(page));
    const canopyNow = await page.evaluate(() => document.getElementById('canopy').getBoundingClientRect().height);
    ok('AB5 ' + tag + ': the tree is not shrunk while fruit is still on it (' + Math.round(hHarvest) + 'px -> ' + Math.round(canopyNow) + 'px) and its 2 fruit are visible', canopyNow >= hHarvest * 0.6 && (await page.evaluate(() => Array.from(document.querySelectorAll('#appleGrid .apple[data-status="ripe"]')).filter((e) => getComputedStyle(e).visibility !== 'hidden').length)) === 2);
    await sleep(700); await take(page, 'apple'); await sleep(settle);
    s = await state(page);
    ok('AB5 ' + tag + ': a fourth apple can still be taken: apple 4 (too many) ->「とどける」and the note are gone;「よん」', J(s.rows.map((r) => r.num)) === J(['2', '4']) && !s.deliver && s.note === null && (await spoken(page)).slice(-1)[0] === 'よん');
    await giveBack(page, 'apple', 0);
    s = await state(page);
    ok('AB5 ' + tag + ': one apple sent back: exactly as asked again ->「とどける」shown; the apple count「さん」is spoken', J(s.rows.map((r) => r.num)) === J(['2', '3']) && s.deliver && (await spoken(page)).slice(-1)[0] === 'さん' && /りんご 3こ。/.test(await live(page)));
    await giveBack(page, 'banana', 0); await giveBack(page, 'banana', 0);
    s = await state(page);
    ok('AB5 ' + tag + ': both bananas sent back: banana 0 (「いち」, then「ぜろ」), no「とどける」; the banana frames are empty and no control', J(s.rows.map((r) => r.num)) === J(['0', '3']) && !s.deliver && J((await spoken(page)).slice(-2)) === J(['いち', 'ぜろ']) && s.frames.filter((f) => f.kind === 'banana').every((f) => f.filled === '0' && f.ret === '0'), J((await spoken(page)).slice(-2)));
    await sleep(500); await take(page, 'banana'); await take(page, 'banana'); await waitPhase(page, 'complete'); await sleep(settle);
    s = await state(page);
    ok('AB5 ' + tag + ': two bananas taken again -> exactly as asked,「とどける」shown; the bananas sit in the first two banana frames', s.deliver && J(s.frames.filter((f) => f.kind === 'banana').map((f) => f.filled).join('')) === J('110') && J(s.rows.map((r) => r.num)) === J(['2', '3']));
    await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click());
    if (motion) { await sleep(250); const fly = await page.evaluate(() => Array.from(document.querySelectorAll('.flyer use')).map((u) => u.getAttribute('href'))); ok('AB5 motion ON: the fruit that fly to the farmer are the kinds that were in the frames', fly.length >= 1 && fly.every((h) => h === '#ic-banana' || h === '#ic-apple') && fly[0] === '#ic-banana', J(fly)); }
    await waitPhase(page, 'celebrate'); await sleep(700);
    const log = await readLog(page), pl = log[0].payload;
    ok('AB5 ' + tag + ': delivered (celebrate, thanks played, never a refusal); the frames are empty, the 2 fruit left on the tree are still shown', (await phase(page)) === 'celebrate' && (await plays(page)).slice(-1)[0] === 'arigatou.mp3' && (await attr(page, 'data-refusals')) === '0' && (await state(page)).frames.every((f) => f.filled === '0' && f.ret === '0') && (await state(page)).ripe.length === 2);
    ok('AB5 ' + tag + ': one record: level kinds2extra, goal 5, harvested 5, extra 2, kindBanana 2, kindApple 3, kindMikan 0, decoys 0, refusals 0 -- 18 keys, schemaVersion 1', log.length === 1 && pl.level === L && pl.goal === 5 && pl.harvested === 5 && pl.extra === 2 && pl.kindBanana === 2 && pl.kindApple === 3 && pl.kindMikan === 0 && pl.decoys === 0 && pl.refusals === 0 && log[0].schemaVersion === 1 && Object.keys(pl).sort().join() === KEYS18, J(pl));
    ok('AB5 ' + tag + ': the「学習のきろく」summary is「' + summaryOf(req) + '」(no「ぴったり」)', J(summaries(log)) === J([summaryOf(req)]), J(summaries(log)));
    await again(page);
    s = await state(page);
    ok('AB5 ' + tag + ':「もう いちど」starts a new activity in the same level (two kinds, 5 asked, 7 on the tree, rows back to 0); no errors', s.level === L && s.treeOrder.length === 7 && s.rows.every((r) => r.num === '0') && s.frames.every((f) => f.filled === '0') && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- AB6 the whole-screen touch: each kind only up to the asked number, in the order of the request ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: L, extra: 3, operation: 'anywhere' }, init: 'window.__auDur = { "a-banana": 150 };' });
    await force(page, 5, 2, 'mikan', 0);                                 // banana 2 + apple 3; the tree: 4 bananas + 4 apples
    await start(page); await sleep(300);
    ok('AB6 anywhere: 4 bananas + 4 apples on the tree (asked 2 + 3)', J(reqOf(await state(page))) === J([{ kind: 'banana', n: 2, t: 4 }, { kind: 'apple', n: 3, t: 4 }]));
    const c0 = await scanCand(page);
    const tap = async () => { const h0 = await harvested(page); for (let k = 0; k < 40 && (await harvested(page)) === h0; k++) { await page.mouse.click(300, 500); await sleep(150); } };
    const order = [];
    for (let i = 0; i < 5; i++) { await tap(); order.push((await state(page)).rows.map((r) => r.num).join('/')); }
    ok('AB6 anywhere: five taps take 2 bananas, then 3 apples (rows banana / apple: 1/0, 2/0, 2/1, 2/2, 2/3) -- never a third banana', J(order) === J(['1/0', '2/0', '2/1', '2/2', '2/3']), J(order));
    await waitPhase(page, 'complete'); await sleep(750);
    let s = await state(page);
    ok('AB6 anywhere: exactly as asked ->「とどける」; 2 bananas + 1 apple are still on the tree; counted いち, に, いち, に, さん', s.deliver && s.ripe.length === 3 && J(await spoken(page)) === J(['いち', 'に', 'いち', 'に', 'さん']), J(await spoken(page)));
    const c2 = await scanCand(page);
    // a fruit in the basket is in front of the whole-screen surface: a touch sends it back
    const cb = await giveBack(page, 'apple', 0);
    s = await state(page);
    const c1 = await scanCand(page);
    ok('AB6 anywhere: a touch on an apple in the basket reaches the fruit, not the surface: apple 2, no「とどける」;「に」is spoken', cb.onSlot && J(s.rows.map((r) => r.num)) === J(['2', '2']) && !s.deliver && s.phase === 'harvest' && (await spoken(page)).slice(-1)[0] === 'に');
    await sleep(500); await tap(); await waitPhase(page, 'complete'); await sleep(750);
    ok('AB6 anywhere: the next tap on the screen takes an APPLE again (the kind that is short), not one of the bananas left on the tree', J((await state(page)).rows.map((r) => r.num)) === J(['2', '3']) && (await state(page)).deliver);
    ok('AB6 anywhere: Switch Scan candidates -- the screen; then the screen and the fruit in the basket (banana row first); at the count「とどける」and the fruit in the basket', J(c0) === J(['surface']) && J(c1) === J(['surface', 'slot:banana', 'slot:banana', 'slot:apple', 'slot:apple']) && J(c2) === J(['deliverBtn', 'slot:banana', 'slot:banana', 'slot:apple', 'slot:apple', 'slot:apple']), J([c0, c1, c2]));
    await page.mouse.click(300, 500); await waitPhase(page, 'celebrate'); await sleep(300);
    const log = await readLog(page);
    ok('AB6 anywhere: the next tap delivers; record operation anywhere, extra 3, kindBanana 2, kindApple 3; no errors', log.length === 1 && log[0].payload.operation === 'anywhere' && log[0].payload.extra === 3 && log[0].payload.kindBanana === 2 && log[0].payload.kindApple === 3 && page.__errors.length === 0, J(log[0].payload));
    await context.close();
    // strokes ON
    const q = await newPage(browser, BASE, { settings: { goal: 2, level: L, extra: 2, operation: 'anywhere', swipe: true, voice: false } });
    await force(q.page, 2, 1, 'banana');                                  // mikan 1 + apple 1; 2 + 2 on the tree
    await start(q.page); await sleep(200);
    const stroke = async () => { await q.page.mouse.move(300, 500); await q.page.mouse.down(); await q.page.mouse.move(460, 500, { steps: 6 }); await q.page.mouse.up(); await sleep(900); };
    await stroke(); await stroke();
    ok('AB6 strokes ON: two strokes take 1 mikan and 1 apple -> exactly as asked (the third stroke would deliver, never take a third fruit)', J((await state(q.page)).rows.map((r) => r.num)) === J(['1', '1']) && (await state(q.page)).deliver && (await harvested(q.page)) === 2 && q.page.__errors.length === 0);
    await q.context.close();
  }

  /* ---------------- AB7 Switch Scan with「りんごを タッチ」: the tree, then the basket (first kind's row first); at the count「とどける」first ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: L, extra: 2 } });
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
    await page.click('#settingsSheet [data-scan-on="1"]'); await sleep(300);
    await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550);
    await force(page, 2, 1, 'mikan');                                    // banana 1 + apple 1; 2 + 2 on the tree
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(800);
    const c0 = await scanCand(page);
    ok('AB7 scan: before anything is taken the candidates are the four fruit on the tree', c0.length === 4 && J(c0.slice().sort()) === J(['apple', 'apple', 'banana', 'banana']), J(c0));
    const press = async (sel) => { await sleep(400); await page.evaluate((x) => { document.querySelector(x).focus(); }, sel); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="falling"], #appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(250); };
    await press('#appleGrid .apple[data-kind="apple"][data-status="ripe"]');
    await press('#appleGrid .apple[data-kind="banana"][data-status="ripe"]');
    await waitPhase(page, 'complete'); await sleep(200);
    const c1 = await scanCand(page);
    ok('AB7 scan: banana 1 + apple 1 taken with the switch -> candidates:「とどける」, the 2 fruit left on the tree, then the fruit in the basket with the banana row first; the highlight is on「とどける」', c1[0] === 'deliverBtn' && J(c1.slice(1, 3).sort()) === J(['apple', 'banana']) && J(c1.slice(3)) === J(['slot:banana', 'slot:apple']) && await page.evaluate(() => document.activeElement === document.getElementById('deliverBtn')), J(c1));
    await press('#slots .slot[data-kind="apple"][data-ret="1"]');
    const c2 = await scanCand(page);
    ok('AB7 scan: Enter on the apple in the basket sends it back (apple 0, no「とどける」); candidates: the tree first (3 fruit), then the banana in the basket; the highlight is on a fruit of the tree', J((await state(page)).rows.map((r) => r.num)) === J(['1', '0']) && !(await state(page)).deliver && c2.length === 4 && c2[3] === 'slot:banana' && !c2.slice(0, 3).some((x) => /slot|deliver/.test(x)) && await page.evaluate(() => { const a = document.activeElement; return !!a && a.classList.contains('apple') && a.getAttribute('data-status') === 'ripe'; }), J(c2));
    await press('#appleGrid .apple[data-kind="apple"][data-status="ripe"]');
    await waitPhase(page, 'complete'); await finish(page);
    ok('AB7 scan: delivered; record switchScan true, level kinds2extra; no errors', (await readLog(page))[0].payload.switchScan === true && (await readLog(page))[0].payload.level === L && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- AB8 layout: frames of at least 44px, a kind on one line where it fits and wrapped where it does not ---------------- */
  for (const vp of [{ n: 'iPad portrait', w: 820, h: 1180, oneLine: true }, { n: 'iPad landscape', w: 1180, h: 820, oneLine: true }, { n: 'phone portrait', w: 390, h: 844, oneLine: false }, { n: 'phone landscape', w: 844, h: 390, oneLine: false }, { n: 'small phone portrait', w: 320, h: 568, oneLine: false }]) {
    for (const c of [{ name: '7 + 5', goal: 9, first: 5, odd: 0, t: [7, 5] }, { name: '6 + 6', goal: 10, first: 5, odd: undefined, t: [6, 6], extra: 2 }]) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: c.goal, level: L, extra: c.extra || 3, voice: false }, viewport: { width: vp.w, height: vp.h } });
      await force(page, c.goal, c.first, 'mikan', c.odd);
      await start(page);
      const g = await page.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
        const slots = Array.from(document.querySelectorAll('#slots .slot')).map((e) => Object.assign(R(e), { kind: e.getAttribute('data-kind') }));
        const kinds = Array.from(new Set(slots.map((s) => s.kind))), basket = R(document.getElementById('basket')), rows = Array.from(document.querySelectorAll('#kindCounts .kind-count')).map(R);
        const block = (k) => { const ss = slots.filter((s) => s.kind === k); return { n: ss.length, lines: new Set(ss.map((s) => Math.round(s.t))).size, top: Math.min(...ss.map((s) => s.t)), bottom: Math.max(...ss.map((s) => s.b)), perLine: Math.max(...Object.values(ss.reduce((a, s) => { a[Math.round(s.t)] = (a[Math.round(s.t)] || 0) + 1; return a; }, {}))) }; };
        const b0 = block(kinds[0]), b1 = block(kinds[1]);
        const overlap = slots.some((a, i) => slots.some((b, j) => j > i && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1));
        return { counts: [b0.n, b1.n], lines: [b0.lines, b1.lines], perLine: [b0.perLine, b1.perLine], size: Math.round(Math.min(...slots.map((s) => Math.min(s.w, s.h)))), inBasket: slots.every((s) => s.l >= basket.l - 1 && s.r <= basket.r + 1 && s.t >= basket.t - 1 && s.b <= basket.b + 1), overlap,
          blocksApart: b0.bottom <= b1.top + 1, align: [Math.abs((rows[0].t + rows[0].h / 2) - (b0.top + b0.bottom) / 2), Math.abs((rows[1].t + rows[1].h / 2) - (b1.top + b1.bottom) / 2)].map(Math.round), countsLeft: rows.every((r) => r.r <= basket.l + 1 && r.l >= 0),
          overflowX: document.documentElement.scrollWidth > innerWidth, minFruit: Math.round(Math.min(...Array.from(document.querySelectorAll('#appleGrid .apple')).map((e) => e.getBoundingClientRect().width))) };
      });
      ok('AB8 ' + vp.n + ', ' + c.name + ' frames: every frame at least 44px (' + g.size + 'px), inside the basket, none overlapping; ' + (vp.oneLine ? 'each kind on ONE line' : 'a kind wraps (' + g.perLine.join(' / ') + ' per line), the second kind starts below the first'), J(g.counts) === J(c.t) && g.size >= 44 && g.inBasket && !g.overlap && g.blocksApart && (vp.oneLine ? J(g.lines) === J([1, 1]) : g.lines[0] >= 2), J(g));
      ok('AB8 ' + vp.n + ', ' + c.name + ': each count stands beside its own kind\'s frames (centre within 6px); no horizontal overflow; the fruit on the tree are at least 60px; no errors', g.align.every((d) => d <= 6) && g.countsLeft && !g.overflowX && g.minFruit >= 60 && page.__errors.length === 0, J(g) + page.__errors.join('|'));
      // exactly as asked ->「とどける」is brought onto the screen
      await takeAsked(page);
      const dv = await page.evaluate(() => { const r = document.getElementById('deliverBtn').getBoundingClientRect(); return { shown: !document.getElementById('deliverBtn').hidden, top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; });
      ok('AB8 ' + vp.n + ', ' + c.name + ': when both kinds are exactly as asked,「とどける」is shown inside the screen', dv.shown && dv.top >= 0 && dv.bottom <= dv.h + 1, J(dv));
      await context.close();
    }
  }

  /* ---------------- AB9 the other three levels are not changed by this one ---------------- */
  {
    const n = await newPage(browser, BASE, { settings: { goal: 3, level: 'normal', dummy: true } });
    await start(n.page);
    let s = await state(n.page);
    ok('AB9 level ふつう + dummy: 3 apples and a decoy, 3 plain frames (div), the ordinary request (ringo-3.mp3,「りんごを 3こ、とってね」)', s.treeKinds.apple === 3 && s.treeOrder.length === 4 && s.decoysAttr === '1' && s.frames.length === 3 && s.frames.every((f) => f.kind === null && f.tag === 'DIV') && s.rows.length === 0 && !s.hasBubbleKinds && J(await plays(n.page)) === J(['ringo-3.mp3']) && (await bubbleSaid(n.page)) === squash('りんごを 3こ、とってね'), J(s.treeKinds));
    for (let i = 0; i < 3; i++) await take(n.page, 'apple');
    await waitPhase(n.page, 'complete'); await finish(n.page);
    let log = await readLog(n.page);
    ok('AB9 level ふつう: 15 record keys as before; summary「りんごを 3こ とって とどけました」', Object.keys(log[0].payload).sort().join() === KEYS15 && log[0].payload.level === 'normal' && J(summaries(log)) === J(['りんごを 3こ とって とどけました']) && n.page.__errors.length === 0, J(log[0].payload));
    await n.context.close();
    const a = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2', extra: 3 }, init: 'window.__auDur = { "a-banana": 150 };' });
    await force(a.page, 5, 2, 'mikan');
    await start(a.page); await sleep(300);
    s = await state(a.page);
    ok('AB9 level くだものを 2 しゅるい (with a saved おおめ +3): no extras -- 2 bananas + 3 apples, 5 marker frames (div, no control), its own request (a-banana-2.mp3, ringo-3.mp3; no「ぴったり」)', s.treeKinds.banana === 2 && s.treeKinds.apple === 3 && s.treeOrder.length === 5 && s.frames.length === 5 && s.frames.every((f) => f.tag === 'DIV' && f.ret === null) && J(await plays(a.page)) === J(['a-banana-2.mp3', 'ringo-3.mp3']) && (await bubbleSaid(a.page)) === squash('バナナを 2こ、りんごを 3こ とってね') && (await a.page.evaluate(() => !document.getElementById('bubbleExact'))), J(s.treeKinds) + ' ' + await bubbleSaid(a.page));
    for (const k of ['banana', 'banana', 'apple', 'apple', 'apple']) await take(a.page, k);
    await waitPhase(a.page, 'complete'); await sleep(150);
    const f0 = await a.page.evaluate(() => { const r = document.querySelector('#slots .slot[data-filled="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await sleep(700); await a.page.mouse.click(f0.x, f0.y); await sleep(300);
    ok('AB9 level くだものを 2 しゅるい: the note is「くだものが ぜんぶ かごに はいりました。」; a touch on a fruit in the basket does nothing', (await state(a.page)).note === 'くだものが ぜんぶ かごに はいりました。' && (await harvested(a.page)) === 5 && (await phase(a.page)) === 'complete');
    await finish(a.page);
    log = await readLog(a.page);
    ok('AB9 level くだものを 2 しゅるい: record level kinds2, extra 0 (18 keys)', log[0].payload.level === 'kinds2' && log[0].payload.extra === 0 && Object.keys(log[0].payload).sort().join() === KEYS18 && a.page.__errors.length === 0, J(log[0].payload));
    await a.context.close();
    const b = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, dummy: true } });
    await start(b.page);
    s = await state(b.page);
    ok('AB9 level おおめから ぴったり + dummy: 3 apples and a decoy, 3 button frames in one group, its own request (ringo-b-2.mp3)', s.treeKinds.apple === 3 && s.treeOrder.length === 4 && s.decoysAttr === '1' && s.frames.length === 3 && s.frames.every((f) => f.tag === 'BUTTON' && f.kind === null) && s.rows.length === 0 && !s.hasBubbleKinds && J(await plays(b.page)) === J(['ringo-b-2.mp3']), J(s.treeKinds));
    await take(b.page, 'apple'); await take(b.page, 'apple'); await waitPhase(b.page, 'complete'); await sleep(150);
    ok('AB9 level おおめから ぴったり: the frame that holds an apple is labelled「かごの りんごを きに もどす」as before', (await state(b.page)).frames.filter((f) => f.ret === '1').every((f) => f.label === 'かごの りんごを きに もどす') && (await state(b.page)).frames.filter((f) => f.ret === '1').length === 2);
    await finish(b.page);
    log = await readLog(b.page);
    ok('AB9 level おおめから ぴったり: 15 record keys as before; summary「りんごを 2こ とって とどけました」', Object.keys(log[0].payload).sort().join() === KEYS15 && log[0].payload.level === 'extra' && log[0].payload.extra === 1 && J(summaries(log)) === J(['りんごを 2こ とって とどけました']) && b.page.__errors.length === 0, J(log[0].payload));
    await b.context.close();
  }

  /* ---------------- AB10 the「学習のきろく」summary (assets/js/record-dashboard-foundation.js), record by record ---------------- */
  {
    const rec = (payload) => ({ timestamp: '2026-11-25T00:00:00.000Z', appId: 'ringo-potton-app', activity: 'ringo-delivery', inputMethod: null, schemaVersion: 1, payload });
    const one = (payload) => summaries([rec(payload)])[0];
    ok('AB10 kinds2extra, banana 2 + apple 3 ->「バナナを 2こ、りんごを 3こ とって とどけました」(the same sentence as kinds2, no「ぴったり」)', one({ goal: 5, level: L, extra: 2, kindBanana: 2, kindMikan: 0, kindApple: 3, harvested: 5 }) === 'バナナを 2こ、りんごを 3こ とって とどけました' && one({ goal: 5, level: 'kinds2', kindBanana: 2, kindMikan: 0, kindApple: 3 }) === 'バナナを 2こ、りんごを 3こ とって とどけました');
    ok('AB10 kinds2extra, mikan 1 + apple 4, random goal ->「みかんを 1こ、りんごを 4こ とって とどけました（ランダム）」', one({ goal: 5, goalMode: 'random', level: L, extra: 3, kindBanana: 0, kindMikan: 1, kindApple: 4 }) === 'みかんを 1こ、りんごを 4こ とって とどけました（ランダム）');
    ok('AB10 kinds2extra with the goal 1, or without the kind counts -> the ordinary sentence', one({ goal: 1, level: L, extra: 2, kindBanana: 0, kindMikan: 0, kindApple: 1 }) === 'りんごを 1こ とって とどけました' && one({ goal: 4, level: L }) === 'りんごを 4こ とって とどけました');
    ok('AB10 the other levels are as before', one({ goal: 3, level: 'normal' }) === 'りんごを 3こ とって とどけました' && one({ goal: 3, level: 'extra', extra: 2 }) === 'りんごを 3こ とって とどけました' && one({ goal: 3, level: 'extra', extra: 2, kindBanana: 1, kindApple: 2 }) === 'りんごを 3こ とって とどけました' && one({ goal: 3 }) === 'りんごを 3こ とって とどけました');
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
