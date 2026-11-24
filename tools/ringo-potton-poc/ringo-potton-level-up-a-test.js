// Real-browser (Playwright / Chromium) test for the level「くだものを 2 しゅるい」(settings.level = 'kinds2') of
// ringo-potton-app.html (Phase RINGO-POTTON-LEVEL-UP-A-1, レベルアップ Phase 3).
//
// In that level the asked number (the goal) stays the TOTAL. At the start of every activity it is split over two of
// the three kinds (banana, mikan, apple), each kind 1..5; which two kinds and how they share the total are drawn
// anew each time. A goal of 1 is one apple, asked for with the ordinary request. The request is spoken as two files
// one after the other, in the fixed order banana -> mikan -> apple: the first kind's opening piece
// (a-banana-<n>.mp3 / a-mikan-<n>.mp3), then the last kind's closing piece (a-mikan-last-<n>.mp3, or the ordinary
// ringo-<n>.mp3 for apples); the bubble shows the same joined sentence, and if a file cannot be played the
// synthesised voice says that whole sentence. The count is said and shown per kind, the basket's frames are split
// by kind, decoys never appear (also with the dummy option ON), the whole-screen touch takes the fruit in the order
// of the request, and the record gets the per-kind counts (kindBanana / kindMikan / kindApple), which the
// 「学習のきろく」summary (assets/js/record-dashboard-foundation.js) turns into
// 「バナナを 2こ、りんごを 3こ とって とどけました」. The levels ふつう and おおめから ぴったり are not changed by any of this.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-level-up-a-test.js
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
const COUNT = ['', 'いち', 'に', 'さん', 'よん', 'ご'];
// what the request must be for a pair [{kind, n}, {kind, n}], written independently of the app
const firstFile = (q) => 'a-' + q.kind + '-' + q.n + '.mp3';
const lastFile = (q) => (q.kind === 'apple' ? 'ringo-' + q.n + '.mp3' : 'a-' + q.kind + '-last-' + q.n + '.mp3');
const bubbleOf = (req) => squash(req.map((q) => NAME[q.kind] + 'を ' + q.n + 'こ').join('、') + '、とってね');
const saidOf = (req) => req.map((q) => NAME[q.kind] + 'を ' + KANA[q.n]).join('、') + '、とってね';
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
async function force(page, goal, first, skip) {
  const lo = Math.max(1, goal - 5), hi = Math.min(5, goal - 1);
  await page.evaluate((q) => { window.__rq = q; }, [(first - lo + 0.5) / (hi - lo + 1), (ORDER.indexOf(skip) + 0.5) / 3]);
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
    frames: slots.map((e) => ({ kind: e.getAttribute('data-kind'), row: e.style.gridRow || null, col: e.style.gridColumn || null, filled: e.getAttribute('data-filled'), tag: e.tagName, icon: (e.querySelector('use') || { getAttribute() { return ''; } }).getAttribute('href') })),
    slotsKinds: document.getElementById('slots').getAttribute('data-kinds'),
    rows: rows.map((e) => ({ kind: e.getAttribute('data-kind'), num: e.querySelector('.count-num').textContent, numShown: !e.querySelector('.count-num').hidden, icon: e.querySelector('use').getAttribute('href') })),
    countBoxShown: !document.getElementById('countBox').hidden, hasBubbleKinds: !!document.getElementById('bubbleKinds'),
    clauses: Array.from(document.querySelectorAll('#bubbleKinds .req-clause')).map((c) => ({ kind: c.getAttribute('data-kind'), pics: c.querySelectorAll('.req-pics svg').length, picKinds: Array.from(new Set(Array.from(c.querySelectorAll('.req-pics use')).map((u) => u.getAttribute('href')))).join() })),
    reqPics: document.querySelectorAll('#reqPics svg').length, deliver: !document.getElementById('deliverBtn').hidden,
    note: document.getElementById('doneNote').hidden ? null : document.getElementById('doneNote').textContent, basketRole: document.getElementById('basket').getAttribute('role'), basketLabel: document.getElementById('basket').getAttribute('aria-label'),
    tray: document.querySelectorAll('#decoyTray svg').length, overflowX: document.documentElement.scrollWidth > innerWidth
  };
});
// the request of this activity, read from the screen: [{kind, n}, ...] in the order the frames' rows show it
const reqOf = (s) => s.rows.map((r) => ({ kind: r.kind, n: s.frames.filter((f) => f.kind === r.kind).length }));
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
async function takeAll(page) { const n = (await state(page)).ripe.length; for (let i = 0; i < n; i++) await take(page); await waitPhase(page, 'complete'); await sleep(150); }
async function finish(page) { await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click()); await waitPhase(page, 'celebrate'); await sleep(700); }
async function again(page) { await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(800); }
async function restart(page) { await page.evaluate(() => document.getElementById('restartBtn').click()); await sleep(700); }
async function openPanel(page) { await page.click('#ringoLevelBtn'); await sleep(150); }
async function choose(page, v) { await page.click('#ringoLevelPanel [data-level-opt="' + v + '"]'); await sleep(150); }
async function closePanel(page) { await page.click('#ringoLevelClose'); await sleep(550); }
const scanCand = (page) => page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id || (e.classList.contains('slot') ? 'slot' : e.getAttribute('data-kind'))));

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------------- A0 the fifteen files exist and are preloaded with the others (37 in all) ---------------- */
  {
    const dir = path.join(ROOT, 'assets', 'ringo-potton', 'voice');
    const want = []; ['a-banana-', 'a-mikan-', 'a-mikan-last-'].forEach((p) => { for (let n = 1; n <= 5; n++) want.push(p + n + '.mp3'); });
    const onDisk = fs.readdirSync(dir).filter((f) => /^a-/.test(f)).sort();
    ok('A0 assets/ringo-potton/voice/ holds exactly the 15 files of this level (a-banana-1..5, a-mikan-1..5, a-mikan-last-1..5)', J(onDisk) === J(want.slice().sort()), J(onDisk));
    ok('A0 ... and 37 voice files in all', fs.readdirSync(dir).length === 37, String(fs.readdirSync(dir).length));
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 4, level: 'kinds2' } });
    const made = await page.evaluate(() => window.__au.filter((o) => o.op === 'new').map((o) => String(o.src).split('/').pop()));
    ok('A0 the app creates 37 Audio objects at load, each file once, the 15 new ones among them', made.length === 37 && new Set(made).size === 37 && want.every((f) => made.includes(f)), J(made));
    ok('A0 nothing is played before the first gesture', (await page.evaluate(() => window.__au.filter((o) => o.op === 'play').length)) === 0);
    await start(page);
    const primed = await page.evaluate(() => window.__au.filter((o) => o.op === 'play' && o.muted).map((o) => String(o.src).split('/').pop()));
    ok('A0「はじめる」primes all 37 files with a muted play (so the second piece may start outside the gesture)', primed.length === 37 && want.every((f) => primed.includes(f)), String(primed.length));
    await context.close();
  }

  /* ---------------- A1 the option can be chosen now; saved; next activity /「いますぐ はじめなおす」 ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 4 } });
    await openPanel(page);
    const opt = await page.evaluate(() => { const b = document.querySelector('#ringoLevelPanel [data-level-opt="kinds2"]'); return { disabled: b.disabled, text: b.textContent.replace(/\s+/g, ' ').trim(), soonHidden: b.querySelector('.level-soon').hidden, pressed: b.getAttribute('aria-pressed') }; });
    ok('A1 the option「くだものを 2 しゅるい」is enabled, without「（じゅんびちゅう）」', opt.disabled === false && opt.soonHidden === true && /^くだものを 2 しゅるい/.test(opt.text) && opt.pressed === 'false', J(opt));
    await choose(page, 'kinds2');
    ok('A1 start screen: choosing it saves level kinds2 and shows it pressed; nothing is started, spoken or played', (await saved(page)).level === 'kinds2' && (await page.getAttribute('#ringoLevelPanel [data-level-opt="kinds2"]', 'aria-pressed')) === 'true' && (await phase(page)) === 'start' && (await spoken(page)).length === 0 && (await plays(page)).length === 0 && /くだものを 2 しゅるいに しました/.test(await live(page)), await live(page));
    await closePanel(page); await start(page);
    let s = await state(page);
    ok('A1 the activity that starts now is in that level: two kinds on the tree, 4 fruit in all, data-level kinds2', s.level === 'kinds2' && Object.keys(s.treeKinds).length === 2 && s.treeOrder.length === 4, J(s.treeKinds));
    // back to ふつう during the activity: this activity goes on; the next one is the ordinary one
    await openPanel(page); await choose(page, 'normal');
    ok('A1 mid-activity: choosing「ふつう」saves it and offers「いますぐ はじめなおす」; the running activity is untouched', (await saved(page)).level === 'normal' && await page.isVisible('#ringoLevelRestart') && (await state(page)).level === 'kinds2' && Object.keys((await state(page)).treeKinds).length === 2);
    await page.click('#ringoLevelRestart'); await sleep(800);
    s = await state(page);
    ok('A1「いますぐ はじめなおす」: an ordinary activity starts at once (4 apples), and nothing of the other level is left on the screen', s.level === 'normal' && J(s.treeKinds) === J({ apple: 4 }) && !s.hasBubbleKinds && s.rows.length === 0 && s.slotsKinds === null && s.countBoxShown && s.reqPics === 4 && s.frames.every((f) => f.kind === null && f.row === null && f.tag === 'DIV') && (await bubbleSaid(page)) === squash('りんごを 4こ、とってね') && (await plays(page)).slice(-1)[0] === 'ringo-4.mp3', J(s.frames[0]) + ' ' + await bubbleSaid(page));
    await openPanel(page); await choose(page, 'kinds2'); await closePanel(page);
    await takeAll(page); await finish(page); await again(page);
    ok('A1 chosen again mid-activity:「もう いちど」starts the next activity in that level; the finished one was recorded as ふつう (15 keys)', (await state(page)).level === 'kinds2' && (await readLog(page)).length === 1 && (await readLog(page))[0].payload.level === 'normal' && Object.keys((await readLog(page))[0].payload).sort().join() === KEYS15);
    await page.reload(); await sleep(300); await start(page);
    ok('A1 after a reload the saved level is still kinds2 and the first activity is in it', (await saved(page)).level === 'kinds2' && (await state(page)).level === 'kinds2' && Object.keys((await state(page)).treeKinds).length === 2);
    ok('A1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- A2 how the total is split: two of three kinds, each 1..5, the total unchanged; goal 1 = one apple ---------------- */
  {
    const pairsSeen = new Set(), firstByGoal = {};
    for (let goal = 2; goal <= 10; goal++) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal, level: 'kinds2', dummy: true, voice: false } });
      await start(page);
      const draws = await page.evaluate((n) => {
        const out = [];
        for (let i = 0; i < n; i++) {
          if (i) document.getElementById('restartBtn').click();
          const tree = Array.from(document.querySelectorAll('#appleGrid .apple')).map((e) => e.getAttribute('data-kind'));
          const frames = Array.from(document.querySelectorAll('#slots .slot')).map((e) => e.getAttribute('data-kind') + e.style.gridRow);
          const rows = Array.from(document.querySelectorAll('#kindCounts .kind-count')).map((e) => e.getAttribute('data-kind'));
          const clauses = Array.from(document.querySelectorAll('#bubbleKinds .req-clause')).map((c) => c.getAttribute('data-kind') + ':' + c.querySelectorAll('.req-pics svg').length);
          out.push({ tree, frames, rows, clauses, goalAttr: document.getElementById('app').getAttribute('data-goal'), decoys: document.getElementById('app').getAttribute('data-decoys') });
        }
        return out;
      }, 60);
      let bad = null; const firsts = new Set(), orders = new Set();
      for (const d of draws) {
        const cnt = {}; d.tree.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; });
        const kinds = Object.keys(cnt).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
        const fine = kinds.length === 2 && kinds.every((k) => ORDER.includes(k) && cnt[k] >= 1 && cnt[k] <= 5) && d.tree.length === goal && d.goalAttr === String(goal) && d.decoys === '0'
          && J(d.rows) === J(kinds)                                                                             // the rows are in the spoken order
          && J(d.frames) === J([].concat(Array(cnt[kinds[0]]).fill(kinds[0] + '1'), Array(cnt[kinds[1]]).fill(kinds[1] + '2')))   // a frame for every fruit, split by kind
          && J(d.clauses) === J(kinds.map((k) => k + ':' + cnt[k]));                                            // the bubble asks for exactly that
        if (!fine && !bad) bad = d;
        if (fine) { pairsSeen.add(kinds.join('+')); firsts.add(cnt[kinds[0]]); orders.add(d.tree.join()); }
      }
      firstByGoal[goal] = [...firsts].sort((a, b) => a - b);
      const lo = Math.max(1, goal - 5), hi = Math.min(5, goal - 1), all = []; for (let v = lo; v <= hi; v++) all.push(v);
      ok('A2 goal ' + goal + ', 60 activities: always two kinds, each 1..5, ' + goal + ' fruit in all, no decoy (dummy option ON), frames / rows / bubble agree', bad === null, J(bad));
      ok('A2 goal ' + goal + ': every allowed share of the first kind is drawn (' + all.join(', ') + ') and no other', J(firstByGoal[goal]) === J(all), J(firstByGoal[goal]));
      if (goal >= 4) ok('A2 goal ' + goal + ': the places on the tree are mixed (more than one arrangement in 60 activities)', orders.size > 1, String(orders.size));
      ok('A2 goal ' + goal + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
      await context.close();
    }
    ok('A2 all three pairs of kinds are drawn: banana+mikan, banana+apple, mikan+apple', J([...pairsSeen].sort()) === J(['banana+apple', 'banana+mikan', 'mikan+apple']), J([...pairsSeen]));
    ok('A2 (the rule) goal 10 is always 5 + 5, goal 2 always 1 + 1, goal 9 is 4 + 5 or 5 + 4', J(firstByGoal[10]) === J([5]) && J(firstByGoal[2]) === J([1]) && J(firstByGoal[9]) === J([4, 5]));
    // the goal 1: one apple, the ordinary request, the ordinary screen
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 1, level: 'kinds2', dummy: true } });
    await start(page);
    const s = await state(page);
    ok('A2 goal 1: one apple on the tree, one plain frame, the ordinary number box, no per-kind pieces, no decoy', J(s.treeKinds) === J({ apple: 1 }) && s.frames.length === 1 && s.frames[0].kind === null && s.rows.length === 0 && !s.hasBubbleKinds && s.countBoxShown && s.reqPics === 1 && s.decoysAttr === '0' && s.level === 'kinds2', J(s));
    ok('A2 goal 1: the ordinary request (ringo-1.mp3 once,「りんごを 1こ、とってね」), nothing synthesised', J(await plays(page)) === J(['ringo-1.mp3']) && (await bubbleSaid(page)) === squash('りんごを 1こ、とってね') && (await spoken(page)).length === 0, J(await plays(page)));
    await takeAll(page);
    ok('A2 goal 1: the count「いち」, the ordinary note', J(await spoken(page)) === J(['いち']) && (await state(page)).note === 'りんごが ぜんぶ かごに はいりました。');
    await finish(page);
    const log = await readLog(page);
    ok('A2 goal 1: recorded as level kinds2 with kindApple 1 (18 keys); the summary stays「りんごを 1こ とって とどけました」', log.length === 1 && log[0].payload.level === 'kinds2' && log[0].payload.kindApple === 1 && log[0].payload.kindBanana === 0 && log[0].payload.kindMikan === 0 && Object.keys(log[0].payload).sort().join() === KEYS18 && J(summaries(log)) === J(['りんごを 1こ とって とどけました']), J(log[0].payload) + ' ' + J(summaries(log)));
    ok('A2 goal 1: no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    // the random goal: the drawn number is what gets split
    const r = await newPage(browser, BASE, { settings: { goal: 3, goalMode: 'random', goalMin: 7, goalMax: 9, level: 'kinds2' } });
    await start(r.page);
    const rs = await state(r.page), rq = reqOf(rs);
    ok('A2 random goal 7..9: the drawn number (' + rs.goal + ') is split into two kinds, each 1..5', rs.goal >= 7 && rs.goal <= 9 && rq.length === 2 && rq[0].n + rq[1].n === rs.goal && rq.every((q) => q.n >= 1 && q.n <= 5) && r.page.__errors.length === 0, J(rq));
    await r.context.close();
  }

  /* ---------------- A3 the request: two files, one after the other; the bubble says the same sentence ---------------- */
  {
    // every file of the level, and every pairing: the first kind n = 1..5, the second 6 - n
    for (const c of [{ skip: 'apple', kinds: ['banana', 'mikan'] }, { skip: 'mikan', kinds: ['banana', 'apple'] }, { skip: 'banana', kinds: ['mikan', 'apple'] }]) {
      for (let n = 1; n <= 5; n++) {
        const req = [{ kind: c.kinds[0], n }, { kind: c.kinds[1], n: 6 - n }];
        const { context, page } = await newPage(browser, BASE, { settings: { goal: 6, level: 'kinds2' }, init: 'window.__auDur = { "a-banana": 350, "a-mikan": 350 };' });
        await force(page, 6, n, c.skip);
        await page.click('#startBtn'); await sleep(150);
        const early = await audioLog(page);
        await sleep(700);
        const lg = (await audioLog(page)).filter((e) => !/^pause:/.test(e) && e !== 'ended:' + lastFile(req[1]));
        const tag = 'A3 ' + NAME[req[0].kind] + ' ' + n + ' + ' + NAME[req[1].kind] + ' ' + (6 - n);
        ok(tag + ': the request on the screen is that pair, in the spoken order', J(reqOf(await state(page))) === J(req), J(reqOf(await state(page))));
        ok(tag + ': first ' + firstFile(req[0]) + ' alone; when it has ended, ' + lastFile(req[1]) + ' -- two audible plays, in that order', J(early.filter((e) => /^play:/.test(e))) === J(['play:' + firstFile(req[0])]) && J(lg) === J(['play:' + firstFile(req[0]), 'ended:' + firstFile(req[0]), 'play:' + lastFile(req[1])]), J(lg));
        ok(tag + ': nothing synthesised; the bubble says「' + req.map((q) => NAME[q.kind] + 'を ' + q.n + 'こ').join('、') + '、とってね」', (await spoken(page)).length === 0 && (await bubbleSaid(page)) === bubbleOf(req) && page.__errors.length === 0, await bubbleSaid(page));
        await context.close();
      }
    }
    // the second piece waits for the END of the first (never a timer): a first piece that never ends is not followed
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2' } });
      await force(page, 5, 2, 'mikan');
      await start(page); await sleep(1500);
      ok('A3 the second piece starts only when the first reports its end (first still playing after 2 s: one play, a-banana-2.mp3)', J(await plays(page)) === J(['a-banana-2.mp3']), J(await plays(page)));
      await context.close();
    }
    // the first fruit taken cuts the request, whichever piece is playing; the other piece is never started
    for (const when of ['first', 'second']) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2' }, init: 'window.__auDur = { "a-banana": ' + (when === 'first' ? 5000 : 200) + ' };' });
      await force(page, 5, 2, 'apple');                                  // banana 2 + mikan 3
      await start(page); await sleep(when === 'first' ? 0 : 300);
      const before = (await audioLog(page)).length;
      await take(page); await sleep(900);
      const after = (await audioLog(page)).slice(before);
      ok('A3 a fruit taken during the ' + when + ' piece: that piece is paused' + (when === 'first' ? ' and the second is never played' : '') + '; the count is spoken instead', after.includes('pause:' + (when === 'first' ? 'a-banana-2.mp3' : 'a-mikan-last-3.mp3')) && !after.some((e) => /^play:/.test(e)) && (await plays(page)).length === (when === 'first' ? 1 : 2) && J(await spoken(page)) === J(['いち']), J(after) + ' ' + J(await plays(page)));
      await context.close();
    }
    // a restart while the request is being said: only the new request goes on
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2' }, init: 'window.__auDur = { "a-banana": 400, "a-mikan": 400 };' });
      await force(page, 5, 2, 'mikan');                                  // banana 2 + apple 3
      await page.click('#startBtn'); await sleep(150);
      await force(page, 5, 4, 'banana');                                 // then mikan 4 + apple 1
      await page.evaluate(() => document.getElementById('restartBtn').click()); await sleep(1200);
      ok('A3 a restart during the first piece: the old request stops there (its second piece is never played) and the new one is said in full', J(await plays(page)) === J(['a-banana-2.mp3', 'a-mikan-4.mp3', 'ringo-1.mp3']), J(await plays(page)));
      await context.close();
    }
    // number hidden: the same files, the bubble without the numbers
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2', showNumber: false }, init: 'window.__auDur = { "a-banana": 200 };', viewport: { width: 390, height: 844 } });
      await force(page, 5, 2, 'mikan');
      await start(page); await sleep(300);
      const s = await state(page);
      ok('A3 number hidden: the bubble says「バナナを りんごを とってね」with each kind\'s pictures (2 and 3); the files are the same', (await bubbleSaid(page)) === squash('バナナを りんごを とってね') && J(s.clauses) === J([{ kind: 'banana', pics: 2, picKinds: '#ic-banana' }, { kind: 'apple', pics: 3, picKinds: '#ic-apple' }]) && J(await plays(page)) === J(['a-banana-2.mp3', 'ringo-3.mp3']), await bubbleSaid(page) + ' ' + J(s.clauses));
      ok('A3 number hidden: each row keeps its kind\'s picture, the numbers are hidden; the ordinary number box stays hidden; nothing overflows', s.rows.length === 2 && s.rows.every((r) => !r.numShown) && J(s.rows.map((r) => r.icon)) === J(['#ic-banana', '#ic-apple']) && !s.countBoxShown && !s.overflowX, J(s.rows));
      await context.close();
    }
  }

  /* ---------------- A4 when a file cannot be played: the synthesised voice says the whole sentence ---------------- */
  {
    const req = [{ kind: 'banana', n: 2 }, { kind: 'mikan', n: 3 }];
    // tried: the play() calls the app makes (the stub records a refused play() too)
    for (const c of [{ name: 'play() is refused', init: 'window.__auFail = true;', tried: ['a-banana-2.mp3'], what: 'the first piece is tried once and refused, the second is never tried' },
      { name: 'the first file never loaded', init: 'window.__auErrorSrc = "a-banana-2";', tried: [], what: 'no file is played at all' },
      { name: 'the second file never loaded', init: 'window.__auErrorSrc = "a-mikan-last-3"; window.__auDur = { "a-banana": 200 };', tried: ['a-banana-2.mp3'], what: 'only the first piece was played' }]) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2' }, init: c.init });
      await force(page, 5, 2, 'apple');
      await start(page); await sleep(500);
      ok('A4 ' + c.name + ': the synthesised voice says the whole sentence「' + saidOf(req) + '」, once', J(await spoken(page)) === J([saidOf(req)]), J(await spoken(page)));
      ok('A4 ' + c.name + ': ' + c.what + ' (no other file instead); the bubble is the same; no error', J(await plays(page)) === J(c.tried) && (await bubbleSaid(page)) === bubbleOf(req) && page.__errors.length === 0, J(await plays(page)) + ' ' + page.__errors.join('|'));
      await take(page); await sleep(300);
      ok('A4 ' + c.name + ': the first fruit taken cuts that sentence too and the count is spoken', (await spoken(page)).slice(-1)[0] === 'いち', J(await spoken(page)));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2' }, noAudio: true });
      await force(page, 5, 2, 'apple');
      await start(page); await sleep(400);
      ok('A4 no Audio API at all: the synthesised voice says the whole sentence; no error', J(await spoken(page)) === J([saidOf(req)]) && page.__errors.length === 0, J(await spoken(page)) + ' ' + page.__errors.join('|'));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2', voice: false }, init: 'window.__auDur = { "a-banana": 200 };' });
      await force(page, 5, 2, 'apple');
      await start(page); await sleep(500);
      await take(page);
      ok('A4 voice OFF: nothing is played (not even muted), nothing is spoken; the bubble and the rows still show the request', (await page.evaluate(() => window.__au.filter((o) => o.op === 'play').length)) === 0 && (await spoken(page)).length === 0 && (await bubbleSaid(page)) === bubbleOf(req) && (await state(page)).rows.length === 2);
      await context.close();
    }
  }

  /* ---------------- A5 counting per kind; the frames split by kind; the note; delivery; the record and its summary ---------------- */
  for (const motion of [false, true]) {
    const tag = motion ? 'motion ON' : 'reduced motion';
    const req = [{ kind: 'mikan', n: 3 }, { kind: 'apple', n: 2 }];
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2', dummy: true }, motion, init: 'window.__auDur = { "a-mikan": 150 };' });
    await force(page, 5, 3, 'banana');
    await start(page); await sleep(300);
    let s = await state(page);
    ok('A5 ' + tag + ': 3 mikan + 2 apples on the tree and nothing else (the dummy option is ON); each is labelled by its kind', J(s.treeKinds) === J(s.treeOrder.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {})) && s.treeKinds.mikan === 3 && s.treeKinds.apple === 2 && s.treeOrder.length === 5 && s.decoysAttr === '0' && J(s.treeLabels) === J(['みかんを とる', 'りんごを とる']), J(s.treeKinds) + ' ' + J(s.treeLabels));
    ok('A5 ' + tag + ': the frames are split by kind: row 1 = 3 mikan frames, row 2 = 2 apple frames (plain markers), each row with its kind\'s picture and the number 0', J(s.frames.map((f) => f.kind + f.row + f.col)) === J(['mikan11', 'mikan12', 'mikan13', 'apple21', 'apple22']) && s.frames.every((f) => f.tag === 'DIV' && f.filled === '0' && f.icon === '#ic-' + f.kind) && J(s.rows) === J([{ kind: 'mikan', num: '0', numShown: true, icon: '#ic-mikan' }, { kind: 'apple', num: '0', numShown: true, icon: '#ic-apple' }]) && s.slotsKinds === '1' && !s.countBoxShown && s.basketRole === 'img' && s.basketLabel === 'くだものを いれる かご', J(s.frames) + J(s.rows));
    ok('A5 ' + tag + ': the request was the two pieces (a-mikan-3.mp3, then ringo-2.mp3)', J(await plays(page)) === J(['a-mikan-3.mp3', 'ringo-2.mp3']), J(await plays(page)));
    // mikan, apple, mikan, apple, mikan: each kind is counted on its own
    const seq = ['mikan', 'apple', 'mikan', 'apple', 'mikan'], said = [], nums = [], lives = [];
    for (const k of seq) {
      await take(page, k); await sleep(motion ? 250 : 60);
      said.push((await spoken(page)).slice(-1)[0]); const st = await state(page); nums.push(st.rows.map((r) => r.num).join('/')); lives.push(await live(page));
      if (said.length === 3) {
        ok('A5 ' + tag + ': after mikan, apple, mikan: the mikan row has 2 (frames 110), the apple row 1 (frames 10); 3 in all; no「とどける」yet', J(st.frames.map((f) => f.filled).join('')) === J('11010') && st.rows[0].num === '2' && st.rows[1].num === '1' && (await harvested(page)) === 3 && !st.deliver && st.note === null && st.tray === 0, J(st.frames.map((f) => f.kind[0] + f.filled)));
      }
    }
    ok('A5 ' + tag + ': the counting starts again for each kind: mikan いち, apple いち, mikan に, apple に, mikan さん', J(said) === J(['いち', 'いち', 'に', 'に', 'さん']) && J(await spoken(page)) === J(['いち', 'いち', 'に', 'に', 'さん']), J(await spoken(page)));
    ok('A5 ' + tag + ': the numbers beside the rows follow (mikan / apple): 1/0, 1/1, 2/1, 2/2, 3/2', J(nums) === J(['1/0', '1/1', '2/1', '2/2', '3/2']), J(nums));
    ok('A5 ' + tag + ': the live region names the kind and its count (「みかん 3こ。」at the end)', /みかん 3こ。/.test(lives[4]) && /りんご 2こ。/.test(lives[3]) && /みかん 1こ。/.test(lives[0]), lives[4]);
    await waitPhase(page, 'complete'); await sleep(200);
    s = await state(page);
    ok('A5 ' + tag + ': every fruit is in the basket -> phase complete,「とどける」shown, the note says「くだものが ぜんぶ かごに はいりました。」', s.phase === 'complete' && s.deliver && s.note === 'くだものが ぜんぶ かごに はいりました。' && s.ripe.length === 0 && s.frames.every((f) => f.filled === '1'), J(s.note));
    // a touch on a fruit in the basket does nothing here (the frames are markers, not controls)
    const f0 = await page.evaluate(() => { const r = document.querySelector('#slots .slot[data-filled="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, controls: document.querySelectorAll('#basket button, #basket [tabindex]').length }; });
    await sleep(700); await page.mouse.click(f0.x, f0.y); await sleep(300);
    ok('A5 ' + tag + ': a touch on a fruit in the basket does nothing (no control in the basket; still 5, complete)', f0.controls === 0 && (await harvested(page)) === 5 && (await phase(page)) === 'complete' && (await state(page)).frames.every((f) => f.filled === '1'));
    await page.evaluate(() => document.getElementById('deliverBtn').click());
    if (motion) {
      await sleep(250);
      const fly = await page.evaluate(() => Array.from(document.querySelectorAll('.flyer use')).map((u) => u.getAttribute('href')));
      ok('A5 motion ON: the fruit that fly to the farmer are the kinds that were in the frames (mikan first)', fly.length >= 1 && fly.every((h) => h === '#ic-mikan' || h === '#ic-apple') && fly[0] === '#ic-mikan', J(fly));
    }
    await waitPhase(page, 'celebrate'); await sleep(700);
    const log = await readLog(page), pl = log[0].payload;
    ok('A5 ' + tag + ': delivered (celebrate, thanks played, never a refusal)', (await phase(page)) === 'celebrate' && (await plays(page)).slice(-1)[0] === 'arigatou.mp3' && (await attr(page, 'data-refusals')) === '0' && !(await plays(page)).includes('okotowari.mp3'));
    ok('A5 ' + tag + ': one record: level kinds2, goal 5, harvested 5, kindMikan 3, kindApple 2, kindBanana 0, decoys 0, extra 0, refusals 0 -- 18 keys, schemaVersion 1', log.length === 1 && pl.level === 'kinds2' && pl.goal === 5 && pl.harvested === 5 && pl.kindMikan === 3 && pl.kindApple === 2 && pl.kindBanana === 0 && pl.decoys === 0 && pl.extra === 0 && pl.refusals === 0 && log[0].schemaVersion === 1 && Object.keys(pl).sort().join() === KEYS18, J(pl));
    ok('A5 ' + tag + ': the「学習のきろく」summary of that record is「' + summaryOf(req) + '」', J(summaries(log)) === J([summaryOf(req)]), J(summaries(log)));
    await again(page);
    s = await state(page);
    ok('A5 ' + tag + ':「もう いちど」starts a new activity in the same level with a fresh draw (two kinds, 5 in all, rows back to 0)', s.level === 'kinds2' && s.treeOrder.length === 5 && Object.keys(s.treeKinds).length === 2 && s.rows.every((r) => r.num === '0') && s.frames.every((f) => f.filled === '0'));
    ok('A5 ' + tag + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- A6 the whole-screen touch (and strokes): the fruit are taken in the order of the request ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 5, level: 'kinds2', operation: 'anywhere' }, init: 'window.__auDur = { "a-banana": 150 };' });
    await force(page, 5, 2, 'mikan');                                    // banana 2 + apple 3
    await start(page); await sleep(300);
    const order = [];
    for (let i = 0; i < 5; i++) {
      const h0 = await harvested(page);
      for (let k = 0; k < 40 && (await harvested(page)) === h0; k++) { await page.mouse.click(300, 500); await sleep(150); }
      const st = await state(page); order.push(st.rows.map((r) => r.num).join('/'));
    }
    ok('A6 anywhere: five taps take the 2 bananas first, then the 3 apples (rows banana / apple: 1/0, 2/0, 2/1, 2/2, 2/3)', J(order) === J(['1/0', '2/0', '2/1', '2/2', '2/3']), J(order));
    ok('A6 anywhere: the counting is per kind (いち, に, いち, に, さん)', J(await spoken(page)) === J(['いち', 'に', 'いち', 'に', 'さん']), J(await spoken(page)));
    await waitPhase(page, 'complete'); await sleep(750);
    ok('A6 anywhere: the Switch Scan candidate at the count is「とどける」only', J(await scanCand(page)) === J(['deliverBtn']), J(await scanCand(page)));
    await page.mouse.click(300, 500); await waitPhase(page, 'celebrate'); await sleep(300);
    const log = await readLog(page);
    ok('A6 anywhere: the next tap delivers; record operation anywhere, kindBanana 2, kindApple 3; summary「' + summaryOf([{ kind: 'banana', n: 2 }, { kind: 'apple', n: 3 }]) + '」', log.length === 1 && log[0].payload.operation === 'anywhere' && log[0].payload.kindBanana === 2 && log[0].payload.kindApple === 3 && J(summaries(log)) === J([summaryOf([{ kind: 'banana', n: 2 }, { kind: 'apple', n: 3 }])]), J(log[0].payload));
    ok('A6 anywhere: no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    // strokes ON + Switch Scan ON
    const q = await newPage(browser, BASE, { settings: { goal: 4, level: 'kinds2', operation: 'anywhere', swipe: true } });
    await force(q.page, 4, 1, 'banana');                                  // mikan 1 + apple 3
    await start(q.page); await sleep(200);
    ok('A6 anywhere: while taking, the only Switch Scan candidate is the screen itself (no frame, no single fruit)', J(await scanCand(q.page)) === J(['surface']), J(await scanCand(q.page)));
    const stroke = async () => { await q.page.mouse.move(300, 500); await q.page.mouse.down(); await q.page.mouse.move(460, 500, { steps: 6 }); await q.page.mouse.up(); await sleep(900); };
    await stroke(); await stroke();
    const st = await state(q.page);
    ok('A6 strokes ON: two strokes take the mikan, then one apple (rows 1/1)', st.rows.map((r) => r.num).join('/') === '1/1' && (await harvested(q.page)) === 2 && q.page.__errors.length === 0, J(st.rows));
    await q.context.close();
  }

  /* ---------------- A7 Switch Scan with「りんごを タッチ」: the fruit on the tree, then「とどける」; never stuck ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, level: 'kinds2' } });
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
    await page.click('#settingsSheet [data-scan-on="1"]'); await sleep(300);
    await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550);
    await force(page, 3, 1, 'mikan');                                    // banana 1 + apple 2
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(800);
    const c0 = (await scanCand(page)).slice().sort();
    ok('A7 scan: the candidates are the three fruit on the tree (1 banana, 2 apples), no frame', J(c0) === J(['apple', 'apple', 'banana']), J(c0));
    for (let i = 0; i < 3; i++) { await sleep(400); await page.evaluate(() => { document.querySelector('#appleGrid .apple[data-status="ripe"]').focus(); }); const h0 = await harvested(page); for (let k = 0; k < 30 && (await harvested(page)) === h0; k++) { await page.keyboard.press('Enter'); await sleep(150); } if (i === 0) ok('A7 scan: after one fruit the candidates are the two left on the tree', (await scanCand(page)).length === 2 && !(await scanCand(page)).includes('slot'), J(await scanCand(page))); }
    await waitPhase(page, 'complete'); await sleep(200);
    ok('A7 scan: all three taken with the switch (Enter) -> the candidate is「とどける」and it has the highlight', J(await scanCand(page)) === J(['deliverBtn']) && await page.evaluate(() => document.activeElement === document.getElementById('deliverBtn')));
    await finish(page);
    ok('A7 scan: delivered; record switchScan true, level kinds2; no errors', (await readLog(page))[0].payload.switchScan === true && (await readLog(page))[0].payload.level === 'kinds2' && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- A8 layout: two rows that never wrap, each beside its own count, at four screen sizes ---------------- */
  for (const vp of [{ n: 'iPad portrait', w: 820, h: 1180 }, { n: 'iPad landscape', w: 1180, h: 820 }, { n: 'phone portrait', w: 390, h: 844 }, { n: 'phone landscape', w: 844, h: 390 }, { n: 'small phone portrait', w: 320, h: 568 }]) {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 10, level: 'kinds2', voice: false }, viewport: { width: vp.w, height: vp.h } });
    await start(page);
    const g = await page.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const slots = Array.from(document.querySelectorAll('#slots .slot')).map((e) => Object.assign(R(e), { row: e.style.gridRow }));
      const rows = Array.from(document.querySelectorAll('#kindCounts .kind-count')).map(R), basket = R(document.getElementById('basket'));
      const tops = (r) => Array.from(new Set(slots.filter((s) => s.row === r).map((s) => Math.round(s.t))));
      const mid = (r) => { const s = slots.find((x) => x.row === r); return s.t + s.h / 2; };
      return { tops1: tops('1'), tops2: tops('2'), size: Math.round(Math.min(...slots.map((s) => Math.min(s.w, s.h)))), inBasket: slots.every((s) => s.l >= basket.l - 1 && s.r <= basket.r + 1 && s.t >= basket.t - 1 && s.b <= basket.b + 1),
        align: [Math.abs((rows[0].t + rows[0].h / 2) - mid('1')), Math.abs((rows[1].t + rows[1].h / 2) - mid('2'))].map(Math.round), countsLeft: rows.every((r) => r.r <= basket.l + 1 && r.l >= 0),
        overflowX: document.documentElement.scrollWidth > innerWidth, minFruit: Math.round(Math.min(...Array.from(document.querySelectorAll('#appleGrid .apple')).map((e) => e.getBoundingClientRect().width))) };
    });
    ok('A8 ' + vp.n + ', 5 + 5: each kind\'s five frames sit on one line, the two lines are different, all inside the basket (frame ' + g.size + 'px)', g.tops1.length === 1 && g.tops2.length === 1 && g.tops1[0] < g.tops2[0] && g.inBasket && g.size >= 24, J(g));
    ok('A8 ' + vp.n + ': each count stands beside its own row (left of the basket, centre within 6px of the row\'s centre); no horizontal overflow; the fruit on the tree are at least 60px', g.align.every((d) => d <= 6) && g.countsLeft && !g.overflowX && g.minFruit >= 60, J(g));
    ok('A8 ' + vp.n + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- A9 the other levels are not changed: ふつう and おおめから ぴったり, with the dummy option ---------------- */
  {
    const n = await newPage(browser, BASE, { settings: { goal: 3, level: 'normal', dummy: true } });
    await start(n.page);
    let s = await state(n.page);
    ok('A9 level ふつう + dummy: 3 apples and a decoy on the tree as before, 3 plain frames, the ordinary number box, the ordinary request (ringo-3.mp3)', s.treeKinds.apple === 3 && s.treeOrder.length === 4 && s.decoysAttr === '1' && s.frames.length === 3 && s.frames.every((f) => f.kind === null && f.tag === 'DIV') && s.rows.length === 0 && !s.hasBubbleKinds && s.countBoxShown && s.basketLabel === 'りんごを いれる かご' && J(await plays(n.page)) === J(['ringo-3.mp3']) && (await bubbleSaid(n.page)) === squash('りんごを 3こ、とってね'), J(s.treeKinds));
    for (let i = 0; i < 3; i++) await take(n.page, 'apple');
    await waitPhase(n.page, 'complete'); await finish(n.page);
    let log = await readLog(n.page);
    ok('A9 level ふつう: counted いち, に, さん; the record has the 15 keys as before (no kind counts); summary「りんごを 3こ とって とどけました」', J(await spoken(n.page)) === J(['いち', 'に', 'さん']) && Object.keys(log[0].payload).sort().join() === KEYS15 && log[0].payload.level === 'normal' && J(summaries(log)) === J(['りんごを 3こ とって とどけました']) && n.page.__errors.length === 0, J(log[0].payload));
    await n.context.close();
    const b = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, dummy: true } });
    await start(b.page);
    s = await state(b.page);
    ok('A9 level おおめから ぴったり + dummy: 3 apples and a decoy, 3 frames that are buttons, its own request (ringo-b-2.mp3)', s.treeKinds.apple === 3 && s.treeOrder.length === 4 && s.decoysAttr === '1' && s.frames.length === 3 && s.frames.every((f) => f.tag === 'BUTTON' && f.kind === null) && s.rows.length === 0 && !s.hasBubbleKinds && J(await plays(b.page)) === J(['ringo-b-2.mp3']), J(s.treeKinds));
    await take(b.page, 'apple'); await take(b.page, 'apple'); await waitPhase(b.page, 'complete'); await finish(b.page);
    log = await readLog(b.page);
    ok('A9 level おおめから ぴったり: the record has the 15 keys as before; summary「りんごを 2こ とって とどけました」', Object.keys(log[0].payload).sort().join() === KEYS15 && log[0].payload.level === 'extra' && log[0].payload.extra === 1 && J(summaries(log)) === J(['りんごを 2こ とって とどけました']) && b.page.__errors.length === 0, J(log[0].payload));
    await b.context.close();
  }

  /* ---------------- A10 the「学習のきろく」summary (assets/js/record-dashboard-foundation.js), record by record ---------------- */
  {
    const rec = (payload) => ({ timestamp: '2026-11-25T00:00:00.000Z', appId: 'ringo-potton-app', activity: 'ringo-delivery', inputMethod: null, schemaVersion: 1, payload });
    const one = (payload) => summaries([rec(payload)])[0];
    ok('A10 kinds2, banana 2 + apple 3 ->「バナナを 2こ、りんごを 3こ とって とどけました」', one({ goal: 5, level: 'kinds2', kindBanana: 2, kindMikan: 0, kindApple: 3, harvested: 5 }) === 'バナナを 2こ、りんごを 3こ とって とどけました', one({ goal: 5, level: 'kinds2', kindBanana: 2, kindMikan: 0, kindApple: 3, harvested: 5 }));
    ok('A10 kinds2, banana 5 + mikan 5 ->「バナナを 5こ、みかんを 5こ とって とどけました」', one({ goal: 10, level: 'kinds2', kindBanana: 5, kindMikan: 5, kindApple: 0 }) === 'バナナを 5こ、みかんを 5こ とって とどけました');
    ok('A10 kinds2, mikan 1 + apple 4, random goal ->「みかんを 1こ、りんごを 4こ とって とどけました（ランダム）」', one({ goal: 5, goalMode: 'random', level: 'kinds2', kindBanana: 0, kindMikan: 1, kindApple: 4 }) === 'みかんを 1こ、りんごを 4こ とって とどけました（ランダム）');
    ok('A10 kinds2 with the goal 1 (one apple) -> the ordinary sentence「りんごを 1こ とって とどけました」', one({ goal: 1, level: 'kinds2', kindBanana: 0, kindMikan: 0, kindApple: 1 }) === 'りんごを 1こ とって とどけました');
    ok('A10 kinds2 without the kind counts, or with values that are not numbers -> the ordinary sentence (never a broken one)', one({ goal: 4, level: 'kinds2' }) === 'りんごを 4こ とって とどけました' && one({ goal: 4, level: 'kinds2', kindBanana: '2', kindMikan: null, kindApple: NaN }) === 'りんごを 4こ とって とどけました');
    ok('A10 the other levels and old records are as before, also if kind counts were present by mistake', one({ goal: 3, level: 'normal' }) === 'りんごを 3こ とって とどけました' && one({ goal: 3, level: 'extra', extra: 2 }) === 'りんごを 3こ とって とどけました' && one({ goal: 3 }) === 'りんごを 3こ とって とどけました' && one({ goal: 3, goalMode: 'random' }) === 'りんごを 3こ とって とどけました（ランダム）' && one({ goal: 3, level: 'normal', kindBanana: 1, kindApple: 2 }) === 'りんごを 3こ とって とどけました' && one({}) === 'りんごの おつかいに 取り組みました');
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
