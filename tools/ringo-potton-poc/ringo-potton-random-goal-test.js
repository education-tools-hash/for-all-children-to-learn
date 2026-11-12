// Real-browser (Playwright / Chromium) test for the teacher's「ランダム」goal MODE of ringo-potton-app.html.
// settings.goalMode = 'fixed' | 'random'. In random mode every activity start draws a goal from the teacher's range
// settings.goalMin..goalMax (default 1..10, both ends included) that differs from the activity started just before
// (a one-number range always gives that number); in fixed mode「もう いちど」keeps the same number. Selecting the mode
// never starts, stops or restarts an activity; the drawn number is decided at the start of the next activity.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-random-goal-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// Since the voice-files Phase the request is a recorded file (assets/ringo-potton/voice/ringo-<goal>.mp3); this
// suite checks WHICH file is played at each activity start (stubbed HTMLAudioElement) instead of a synthesised text.
// SCOPE / HONESTY: Chromium on Linux with a stubbed speechSynthesis and a stubbed HTMLAudioElement. It proves what the app asks the speech
// engine to say and what the ARIA live regions / aria-pressed receive; it is NOT an iPad Safari, VoiceOver,
// Bluetooth-switch or real-touch result and must never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB, base } = require('./ringo-potton-voice-stubs');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const EXPECTED = ['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => g && 'ringo-' + g + '.mp3');   // the request FILE for each goal

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;

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
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(AUDIO_STUB);
  // optional deterministic Math.random: values are taken from opts.rand in order (then the real generator); calls are counted
  await context.addInitScript((q) => { const real = Math.random; window.__randQ = (q || []).slice(); window.__randCalls = 0; Math.random = function () { window.__randCalls++; return window.__randQ.length ? window.__randQ.shift() : real(); }; }, opts.rand || []);
  if (opts.settings !== undefined) {
    await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: typeof opts.settings === 'string' ? opts.settings : JSON.stringify(opts.settings) });
  }
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(opts.url);
  return { context, page };
}
const attr = (page, a) => page.getAttribute('#app', a);
const harvested = async (page) => parseInt(await attr(page, 'data-harvested'), 10);
const phase = (page) => attr(page, 'data-phase');
const dataGoal = async (page) => parseInt(await attr(page, 'data-goal'), 10);
const spoken = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const plays = async (page) => (await page.evaluate(() => (window.__au || []).slice())).filter((e) => e.op === 'play' && !e.muted).map((e) => base(e.src));
const requests = async (page) => (await plays(page)).filter((f) => /^ringo-\d+\.mp3$/.test(f));   // audible request files, in order
const saved = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return 'ERR'; } }, SETTINGS_KEY);
const pressed = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#goalGroup button')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-goal') || b.id));
const rangePressed = (page) => page.evaluate(() => ({
  min: Array.from(document.querySelectorAll('#goalMinGroup [data-goal-min]')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => +b.getAttribute('data-goal-min')),
  max: Array.from(document.querySelectorAll('#goalMaxGroup [data-goal-max]')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => +b.getAttribute('data-goal-max')),
  rowsHidden: [document.getElementById('rowGoalMin').hidden, document.getElementById('rowGoalMax').hidden] }));
const polite = (page) => page.evaluate(() => (document.getElementById('donomanaAnnouncePolite') || {}).textContent || '');
const counts = (page) => page.evaluate(() => ({ apples: document.querySelectorAll('.apple').length, slots: document.querySelectorAll('.slot').length, reqNum: document.getElementById('reqNum').textContent }));
const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= 10;
const landWait = () => sleep(1100);
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
// the real teacher entry: common A11y panel -> proxy -> (mid-activity: confirmation) -> sheet
async function openSettings(page) {
  await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await sleep(150);
  if (await page.isVisible('#settingsConfirm')) { await page.click('#scOpen'); await sleep(150); }
}
async function closeSettings(page) { await page.click('#settingsClose'); await sleep(600); }
// synced view of one activity: display + the LAST request utterance must all say the same number
async function synced(page) {
  const g = await dataGoal(page); const c = await counts(page); const r = await requests(page);
  return { g, c, lastReq: r[r.length - 1], ok: inRange(g) && c.apples === g && c.slots === g && c.reqNum === String(g) && r[r.length - 1] === EXPECTED[g] };
}
// finish the current activity (reduced motion: no flight) and press「もう いちど」
async function finishAndAgain(page) {
  const n = await dataGoal(page);
  for (let i = 0; i < n; i++) { await page.evaluate(() => { const a = document.querySelector('.apple[data-status="ripe"]'); if (a) a.click(); }); await sleep(420); }
  await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click());
  await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
  await sleep(700); await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(700);
}

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- R0 the feature must exist (explicit failure on a build without the mode, no harness exception) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    const present = await page.evaluate(() => { const b = document.getElementById('goalRandomBtn'); return !!b && b.closest('#goalGroup') === document.getElementById('goalGroup') && b.hasAttribute('aria-pressed'); });
    ok('R0 #goalRandomBtn exists in #goalGroup and carries aria-pressed (mode button)', present);
    await context.close();
    if (!present) {
      console.log('R0 failed: the random MODE button is absent, so R1..R15 cannot run on this build.');
      await browser.close(); srv.close();
      console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
      process.exit(1);
    }
  }

  /* ---------- R1 start screen: selecting the mode (no number yet), then the first activity draws one ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    ok('R1 before: fixed 3 is the only pressed goal button', J(await pressed(page)) === J(['3']), J(await pressed(page)));
    await page.click('#goalRandomBtn'); await sleep(150);
    const sv = await saved(page);
    ok('R1 random selected: goalMode random, saved goal 3 kept', sv.goalMode === 'random' && sv.goal === 3, J(sv));
    ok('R1 random selected: ランダム is the only pressed button', J(await pressed(page)) === J(['goalRandomBtn']), J(await pressed(page)));
    ok('R1 start info says ランダム（1〜10）, no pending note, ARIA「ランダムに しました」', (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（1〜10）' && await page.isHidden('#pendingNote') && (await polite(page)) === 'ランダムに しました', await polite(page));
    ok('R1 selecting the mode speaks nothing, plays nothing and starts nothing', (await spoken(page)).length === 0 && (await plays(page)).length === 0 && (await phase(page)) === 'start');
    await closeSettings(page);
    await startRun(page);
    const s1 = await synced(page);
    ok('R1 first random activity: goal 1..10, apples / slots / number / request file all = N', s1.ok, J(s1));
    ok('R1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R2 fixed mode:「もう いちど」never changes the number ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, reducedMotion: true });
    await startRun(page);
    for (let i = 0; i < 3; i++) await finishAndAgain(page);
    const reqs = await requests(page);
    ok('R2 fixed 2, three times「もう いちど」: goal stays 2, all four request files are ringo-2.mp3', (await dataGoal(page)) === 2 && reqs.length === 4 && reqs.every((t) => t === EXPECTED[2]), J(reqs));
    await context.close();
  }

  /* ---------- R3 random mode: 30 consecutive activities via「もう いちど」, each 1..10 and != the previous one, always in sync ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random' }, reducedMotion: true });
    await startRun(page);
    const seq = [await dataGoal(page)]; let allSynced = (await synced(page)).ok;
    for (let i = 0; i < 30; i++) {
      await finishAndAgain(page);
      const s = await synced(page); seq.push(s.g); if (!s.ok) allSynced = false;
    }
    const distinct = new Set(seq).size;
    const okSeq = seq.every(inRange) && seq.every((g, i) => i === 0 || g !== seq[i - 1]);
    ok('R3 31 random activities: all 1..10, never equal to the previous activity', okSeq, J(seq));
    ok('R3 every activity in sync (apples = slots = number = request file)', allSynced);
    ok('R3 at least 7 distinct goals over 31 activities', distinct >= 7, String(distinct));
    await openSettings(page);
    ok('R3 after 31 activities: ランダム still the only pressed button, no pending note', J(await pressed(page)) === J(['goalRandomBtn']) && await page.isHidden('#pendingNote'), J(await pressed(page)));
    ok('R3 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R4 mid-activity: selecting random does not touch the running activity; applied by「もう いちど」 ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 }, reducedMotion: true });
    await startRun(page);
    await page.evaluate(() => document.querySelector('.apple[data-status="ripe"]').click()); await sleep(500);
    const before = J([await spoken(page), await plays(page)]);
    await openSettings(page);
    await page.click('#goalRandomBtn'); await sleep(150);
    ok('R4 mid-activity: pending note shown, activity untouched (goal 3, 3 apples, 1 harvested, harvest)', await page.isVisible('#pendingNote') && (await dataGoal(page)) === 3 && (await counts(page)).apples === 3 && (await harvested(page)) === 1 && (await phase(page)) === 'harvest');
    ok('R4 mid-activity: ARIA「つぎの かつどうから ランダム」, no new utterance and no new file play', (await polite(page)) === 'つぎの かつどうから ランダム' && J([await spoken(page), await plays(page)]) === before, await polite(page));
    await closeSettings(page);
    await finishAndAgain(page);
    const a = await synced(page);
    ok('R4 after「もう いちど」: random activity, != 3, in sync', a.ok && a.g !== 3, J(a));
    await finishAndAgain(page);
    const b = await synced(page);
    ok('R4 next「もう いちど」: != previous, in sync', b.ok && b.g !== a.g, a.g + '->' + b.g);
    await context.close();
  }

  /* ---------- R5 teacher restart during harvest / during a flight: new goal != the one being played, clean run ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random' } });
    await startRun(page);
    const seq = [await dataGoal(page)]; let clean = true;
    for (let i = 0; i < 15; i++) {
      // tap an apple (flight starts) and restart right away, like T18
      await page.evaluate(() => {
        document.querySelector('.apple[data-status="ripe"]').click();
        document.getElementById('ringoSettingsBtn').click();
        document.getElementById('scOpen').click();
        document.getElementById('restartBtn').click();
      });
      await sleep(1500);
      const g = await dataGoal(page); seq.push(g);
      const st = await page.evaluate(() => ({ h: document.getElementById('app').dataset.harvested, ph: document.getElementById('app').dataset.phase, fl: document.querySelectorAll('.flyer').length, apples: document.querySelectorAll('.apple').length, ripe: document.querySelectorAll('.apple[data-status="ripe"]').length }));
      if (!(st.h === '0' && st.ph === 'harvest' && st.fl === 0 && st.apples === g && st.ripe === g)) clean = false;
    }
    ok('R5 15 restarts mid-flight: every new goal 1..10 and != the activity just restarted', seq.every(inRange) && seq.every((g, i) => i === 0 || g !== seq[i - 1]), J(seq));
    ok('R5 each restarted run is clean (0 harvested, no flyer, apples = goal, all ripe)', clean);
    ok('R5 last request file matches the current goal (old run never plays into the new one)', (await synced(page)).ok, J(await synced(page)));
    ok('R5 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R6 whole-screen「もう いちど」(anywhere + againAnywhere) also draws a new goal ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, goalMode: 'random', operation: 'anywhere', againAnywhere: true }, reducedMotion: true });
    await startRun(page);
    const seq = [await dataGoal(page)];
    for (let i = 0; i < 6; i++) {
      const n = await dataGoal(page);
      for (let k = 0; k < n; k++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(420); }
      await sleep(700); await page.evaluate(() => document.getElementById('surface').click());
      await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
      await sleep(700); await page.evaluate(() => document.getElementById('surface').click()); await sleep(600);
      seq.push(await dataGoal(page));
    }
    ok('R6 whole-screen again x6: each goal 1..10 and != previous, phase harvest', seq.every(inRange) && seq.every((g, i) => i === 0 || g !== seq[i - 1]) && (await phase(page)) === 'harvest', J(seq));
    await context.close();
  }

  /* ---------- R7 pending rule: no spurious note in random mode; a number during a random activity is pending ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random' } });
    await startRun(page);
    await openSettings(page);
    ok('R7 random activity, settings unchanged: no pending note (drawn number is not a "change")', await page.isHidden('#pendingNote'));
    await page.click('#goalGroup [data-goal="4"]'); await sleep(100);
    ok('R7 number 4 chosen during a random activity: fixed 4 pressed, pending note shown, activity untouched', J(await pressed(page)) === J(['4']) && await page.isVisible('#pendingNote') && (await phase(page)) === 'harvest');
    await page.click('#goalRandomBtn'); await sleep(100);
    ok('R7 back to random: pending note hidden again (mode equals the running mode)', await page.isHidden('#pendingNote') && J(await pressed(page)) === J(['goalRandomBtn']));
    await context.close();
  }

  /* ---------- R8 storage: same key set, mode survives reload, old data restores as fixed, corrupt values tolerated ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await openSettings(page); await page.click('#goalRandomBtn'); await sleep(100);
    const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
    ok('R8 no new localStorage key', J(keysBefore) === J(keysAfter) && keysAfter.includes(SETTINGS_KEY), J(keysAfter));
    await page.reload(); await sleep(300);
    ok('R8 reload: random mode kept (start info ランダム), fixed goal 3 still saved', (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（1〜10）' && (await saved(page)).goal === 3 && (await saved(page)).goalMode === 'random');
    await openSettings(page);
    ok('R8 reload: ランダム pressed, numbers not', J(await pressed(page)) === J(['goalRandomBtn']));
    await page.click('#goalGroup [data-goal="3"]'); await sleep(100);
    ok('R8 pressing a number returns to fixed mode', (await saved(page)).goalMode === 'fixed' && J(await pressed(page)) === J(['3']));
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 7, operation: 'apple' } });   // pre-mode saved data (no goalMode)
    ok('R8 old saved data without goalMode: fixed 7', (await page.textContent('#startInfo')) === 'いまの もくひょう：7こ' && (await dataGoal(page)) === 7);
    await openSettings(page);
    ok('R8 old saved data: 7 pressed, ランダム not pressed', J(await pressed(page)) === J(['7']));
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: '{"goal":"abc","goalMode":"xyz"}' });
    ok('R8 corrupt values: fixed 3, no error', (await dataGoal(page)) === 3 && (await page.textContent('#startInfo')) === 'いまの もくひょう：3こ' && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R9 ARIA: exactly one pressed goal button at all times ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 5 } });
    await openSettings(page);
    const states = [];
    states.push(await pressed(page));
    await page.click('#goalRandomBtn'); await sleep(80); states.push(await pressed(page));
    await page.click('#goalRandomBtn'); await sleep(80); states.push(await pressed(page));
    await page.click('#goalGroup [data-goal="10"]'); await sleep(80); states.push(await pressed(page));
    await page.click('#goalGroup [data-goal="1"]'); await sleep(80); states.push(await pressed(page));
    await page.click('#goalRandomBtn'); await sleep(80); states.push(await pressed(page));
    ok('R9 pressed sequence 5 -> random -> random -> 10 -> 1 -> random, always exactly one', J(states) === J([['5'], ['goalRandomBtn'], ['goalRandomBtn'], ['10'], ['1'], ['goalRandomBtn']]), J(states));
    ok('R9 random button has an aria-label naming the mode', /ランダム/.test(await page.getAttribute('#goalRandomBtn', 'aria-label')));
    await context.close();
  }

  /* ---------- R10 keyboard ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    await page.focus('#goalGroup [data-goal="10"]'); await page.keyboard.press('Tab');
    ok('R10 Tab from "10" lands on the random button', (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'goalRandomBtn');
    await page.keyboard.press('Enter'); await sleep(100);
    ok('R10 Enter selects random mode', (await saved(page)).goalMode === 'random' && J(await pressed(page)) === J(['goalRandomBtn']));
    await page.focus('#goalGroup [data-goal="5"]'); await page.keyboard.press('Space'); await sleep(100);
    ok('R10 Space on "5" returns to fixed 5', (await saved(page)).goalMode === 'fixed' && (await saved(page)).goal === 5 && J(await pressed(page)) === J(['5']));
    await context.close();
  }

  /* ---------- R11 Switch Scan candidates: in the sheet right after "10"; not when closed ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, scanSpeed: 'fast' } });
    await openSettings(page);
    await page.click('[data-scan-on="1"]'); await sleep(200);
    const order = await page.evaluate(() => { const i = window.ringoScan.buildScanItems(); const r = i.indexOf(document.getElementById('goalRandomBtn')); return { r, prev: r > 0 ? i[r - 1].getAttribute('data-goal') : null }; });
    ok('R11 scan ON + sheet open: random button is a candidate right after "10"', order.r > 0 && order.prev === '10', J(order));
    await page.click('[data-scan-on="0"]'); await closeSettings(page);
    ok('R11 sheet closed: not a candidate', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'startBtn'));
    await context.close();
  }

  /* ---------- R12 anywhere mode: the sheet and the surface do not interfere ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, viewport: { width: 1366, height: 1024 }, settings: { goal: 2, operation: 'anywhere' } });
    await startRun(page);
    const p = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); return { x: Math.floor(s.left / 2), y: Math.floor(innerHeight / 2) }; });
    await openSettings(page);
    await page.mouse.click(p.x, 200); await sleep(400);
    ok('R12 sheet open: a background (margin) tap does not harvest', (await harvested(page)) === 0);
    await page.click('#goalRandomBtn'); await sleep(100);
    await closeSettings(page);
    await page.mouse.click(p.x, p.y); await landWait();
    ok('R12 after closing: whole-screen tap still harvests the running fixed-2 activity', (await harvested(page)) === 1 && (await dataGoal(page)) === 2);
    await context.close();
  }

  /* ---------- R13 voice OFF: still silent; ARIA announcement works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, voice: false } });
    await openSettings(page); await page.click('#goalRandomBtn'); await sleep(150);
    ok('R13 voice OFF: nothing spoken or played, ARIA「ランダムに しました」', (await spoken(page)).length === 0 && (await plays(page)).length === 0 && (await polite(page)) === 'ランダムに しました', await polite(page));
    await closeSettings(page); await startRun(page);
    ok('R13 voice OFF: random activity starts silently with a valid goal (no file, no synth)', inRange(await dataGoal(page)) && (await spoken(page)).length === 0 && (await plays(page)).length === 0);
    await context.close();
  }

  /* ---------- R14 wording / live regions / help ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page); await page.click('#goalRandomBtn'); await sleep(150);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('R14 live regions: no request text, no evaluative words', !/とってね/.test(live) && !/すごい|えらい|じょうず|せいかい|正解|てんすう|スコア/.test(live), live);
    const texts = await page.evaluate(() => ({ settings: document.getElementById('settingsSheet').innerText, help: document.getElementById('helpSheet').textContent }));
    ok('R14 help explains the mode; no evaluative words in the settings sheet', /「ランダム」を えらぶと、かつどうの たびに/.test(texts.help) && !/すごい|えらい|じょうず|せいかい|正解|てんすう|スコア/.test(texts.settings));
    ok('R14 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R15 first activity after a fresh load in random mode: all ten are possible (lastGoal unset) ---------- */
  {
    const seen = new Set();
    for (let i = 0; i < 12 && seen.size < 3; i++) {
      const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random' } });
      await startRun(page); seen.add(await dataGoal(page)); await context.close();
    }
    ok('R15 fresh loads in random mode draw from all ten (>= 3 distinct first goals in <= 12 loads)', seen.size >= 3, J([...seen]));
  }

  /* ---------- R16 range 1〜3: every draw stays in the range and both ends appear ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random', goalMin: 1, goalMax: 3 }, reducedMotion: true });
    ok('R16 start info shows the range「ランダム（1〜3）」', (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（1〜3）', await page.textContent('#startInfo'));
    await startRun(page);
    const goals = []; let allSynced = true, prevDiff = true;
    for (let i = 0; i < 24; i++) {
      const s = await synced(page); goals.push(s.g); if (!s.ok) allSynced = false;
      if (i > 0 && goals[i] === goals[i - 1]) prevDiff = false;
      if (i >= 9 && goals.includes(1) && goals.includes(3)) break;
      await finishAndAgain(page);
    }
    ok('R16 all draws are within 1..3 (' + goals.length + ' activities)', goals.every((g) => g >= 1 && g <= 3), J(goals));
    ok('R16 both ends of the range (1 and 3) are drawn', goals.includes(1) && goals.includes(3), J(goals));
    ok('R16 each activity stays synced (apples / slots / number / request file) and never repeats the previous goal', allSynced && prevDiff, J(goals));
    ok('R16 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R17 Math.random edge values map to the ends of the range (both included) ---------- */
  {
    // fresh load (no previous goal): pool 2..7; 0 -> 2. Next activity (previous 2): pool 3..7; just below 1 -> 7
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random', goalMin: 2, goalMax: 7 }, reducedMotion: true, rand: [0, 0.9999999999999999] });
    await startRun(page);
    const g1 = await dataGoal(page);
    await finishAndAgain(page);
    const g2 = await dataGoal(page);
    ok('R17 Math.random() = 0 -> the minimum (2)', g1 === 2, String(g1));
    ok('R17 Math.random() just below 1 -> the maximum (7)', g2 === 7, String(g2));
    const { context: c2, page: p2 } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random', goalMin: 2, goalMax: 7 }, rand: [0.9999999999999999] });
    await startRun(p2);
    ok('R17 fresh load, Math.random() just below 1 -> the maximum (7), never 8', (await dataGoal(p2)) === 7, String(await dataGoal(p2)));
    ok('R17 no errors', page.__errors.length === 0 && p2.__errors.length === 0, page.__errors.concat(p2.__errors).join('|'));
    await context.close(); await c2.close();
  }

  /* ---------- R18 min = max: the goal is always that number ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random', goalMin: 4, goalMax: 4 }, reducedMotion: true });
    ok('R18 start info「ランダム（4〜4）」', (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（4〜4）', await page.textContent('#startInfo'));
    await startRun(page);
    const goals = []; let allSynced = true;
    for (let i = 0; i < 4; i++) { const s = await synced(page); goals.push(s.g); if (!s.ok) allSynced = false; if (i < 3) await finishAndAgain(page); }
    ok('R18 four activities in a row are all 4 (request file ringo-4.mp3 each time)', goals.every((g) => g === 4) && allSynced && (await requests(page)).every((f) => f === 'ringo-4.mp3'), J(goals) + ' ' + J(await requests(page)));
    ok('R18 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R19 sanitize: rounding, clamping, reversed range, non-numbers, old data ---------- */
  {
    const cases = [
      { name: 'reversed 7..3 -> max follows the min (7〜7)', s: { goalMode: 'random', goalMin: 7, goalMax: 3 }, min: 7, max: 7 },
      { name: 'decimals 2.6..8.4 -> rounded (3〜8)', s: { goalMode: 'random', goalMin: 2.6, goalMax: 8.4 }, min: 3, max: 8 },
      { name: 'out of range 0..99 -> clamped (1〜10)', s: { goalMode: 'random', goalMin: 0, goalMax: 99 }, min: 1, max: 10 },
      { name: 'negative / 11 -> clamped (1〜10)', s: { goalMode: 'random', goalMin: -5, goalMax: 11 }, min: 1, max: 10 },
      { name: 'numeric strings "5".."6" -> 5〜6', s: { goalMode: 'random', goalMin: '5', goalMax: '6' }, min: 5, max: 6 },
      { name: 'non-numbers "abc" / null -> defaults (1〜10)', s: { goalMode: 'random', goalMin: 'abc', goalMax: null }, min: 1, max: 10 },
      { name: 'old data without the keys -> 1〜10', s: { goal: 3, goalMode: 'random' }, min: 1, max: 10 },
      { name: 'reversed after rounding 9.6..9.4 -> 10〜10', s: { goalMode: 'random', goalMin: 9.6, goalMax: 9.4 }, min: 10, max: 10 }
    ];
    for (const c of cases) {
      const { context, page } = await newPage(browser, { url: URL, settings: c.s });
      const info = await page.textContent('#startInfo');
      await openSettings(page);
      const rp = await rangePressed(page);
      ok('R19 ' + c.name + ': start info and pressed buttons', info === 'いまの もくひょう：ランダム（' + c.min + '〜' + c.max + '）' && J(rp.min) === J([c.min]) && J(rp.max) === J([c.max]), info + ' ' + J(rp));
      await closeSettings(page);
      await startRun(page);
      const g = await dataGoal(page);
      ok('R19 ' + c.name + ': the drawn goal is inside the normalised range', g >= c.min && g <= c.max && page.__errors.length === 0, String(g) + ' ' + page.__errors.join('|'));
      await context.close();
    }
    // a saved setting written after a click carries the normalised values
    const { context, page } = await newPage(browser, { url: URL, settings: { goalMode: 'random', goalMin: 7, goalMax: 3 } });
    await openSettings(page); await page.click('[data-voice="1"]'); await sleep(150);
    const sv = await saved(page);
    ok('R19 after any settings click the stored range is the normalised one (7, 7)', sv.goalMin === 7 && sv.goalMax === 7, J(sv));
    await context.close();
  }

  /* ---------- R20 the range rows appear only in random mode ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    ok('R20 fixed mode: both range rows hidden', J((await rangePressed(page)).rowsHidden) === J([true, true]) && await page.isHidden('#rowGoalMin') && await page.isHidden('#rowGoalMax'));
    await page.click('#goalRandomBtn'); await sleep(150);
    ok('R20 ランダム selected: both rows shown, 1..10 buttons each, default 1 and 10 pressed', await page.isVisible('#rowGoalMin') && await page.isVisible('#rowGoalMax')
      && (await page.$$('#goalMinGroup [data-goal-min]')).length === 10 && (await page.$$('#goalMaxGroup [data-goal-max]')).length === 10
      && J(await rangePressed(page)) === J({ min: [1], max: [10], rowsHidden: [false, false] }), J(await rangePressed(page)));
    const a11y = await page.evaluate(() => ['goalMinGroup', 'goalMaxGroup'].map((id) => { const g = document.getElementById(id); const l = document.getElementById(g.getAttribute('aria-labelledby')); return g.getAttribute('role') + ':' + (l ? l.textContent : ''); }));
    ok('R20 each row is a labelled group (role=group + aria-labelledby)', a11y[0] === 'group:ランダムの はんい：いちばん すくない かず' && a11y[1] === 'group:ランダムの はんい：いちばん おおい かず', J(a11y));
    await page.click('[data-scan-on="1"]'); await sleep(200);
    const scan = await page.evaluate(() => { const i = window.ringoScan.buildScanItems(); const r = i.indexOf(document.getElementById('goalRandomBtn')); return { next: i[r + 1] && i[r + 1].getAttribute('data-goal-min'), mins: i.filter((e) => e.hasAttribute('data-goal-min')).length, maxs: i.filter((e) => e.hasAttribute('data-goal-max')).length }; });
    ok('R20 scan ON + random: the 10 + 10 range buttons are candidates right after ランダム', scan.next === '1' && scan.mins === 10 && scan.maxs === 10, J(scan));
    await page.click('[data-goal="5"]'); await sleep(150);
    ok('R20 a fixed number chosen again: rows hidden again (and the range buttons leave the scan)', await page.isHidden('#rowGoalMin') && await page.isHidden('#rowGoalMax') && await page.evaluate(() => !window.ringoScan.buildScanItems().some((e) => e.hasAttribute('data-goal-min') || e.hasAttribute('data-goal-max'))));
    await page.click('[data-scan-on="0"]'); await sleep(100);
    const help = await page.evaluate(() => document.getElementById('helpSheet').textContent);
    ok('R20 help mentions the range', /でる かずの はんい/.test(help));
    ok('R20 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R21 the other bound follows (no error) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random' } });
    await openSettings(page);
    await page.click('[data-goal-min="6"]'); await sleep(150);
    let sv = await saved(page), rp = await rangePressed(page);
    ok('R21 min 6 (max 10 stays): saved 6..10, pressed 6 / 10, start info（6〜10）', sv.goalMin === 6 && sv.goalMax === 10 && J(rp.min) === '[6]' && J(rp.max) === '[10]' && (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（6〜10）', J(sv) + J(rp));
    await page.click('[data-goal-max="4"]'); await sleep(150);
    sv = await saved(page); rp = await rangePressed(page);
    ok('R21 max 4 below min 6: min follows to 4 (4〜4), polite「いちばん すくない かずも 4に なりました」', sv.goalMin === 4 && sv.goalMax === 4 && J(rp.min) === '[4]' && J(rp.max) === '[4]' && (await page.textContent('#startInfo')) === 'いまの もくひょう：ランダム（4〜4）' && (await polite(page)) === 'いちばん すくない かずも 4に なりました', J(sv) + ' ' + await polite(page));
    await page.click('[data-goal-min="8"]'); await sleep(150);
    sv = await saved(page); rp = await rangePressed(page);
    ok('R21 min 8 above max 4: max follows to 8 (8〜8), polite「いちばん おおい かずも 8に なりました」', sv.goalMin === 8 && sv.goalMax === 8 && J(rp.min) === '[8]' && J(rp.max) === '[8]' && (await polite(page)) === 'いちばん おおい かずも 8に なりました', J(sv) + ' ' + await polite(page));
    await page.click('[data-goal-max="10"]'); await sleep(150);
    sv = await saved(page);
    ok('R21 max 10 (above min): only max changes (8〜10), mode stays random, goal 3 kept', sv.goalMin === 8 && sv.goalMax === 10 && sv.goalMode === 'random' && sv.goal === 3, J(sv));
    const err = await page.evaluate(() => Array.from(document.querySelectorAll('#settingsSheet [role="alert"], #settingsSheet .error')).filter((e) => e.offsetParent && e.textContent.trim()).length);
    ok('R21 no error display in the sheet; nothing spoken or played; still on the start screen', err === 0 && (await spoken(page)).length === 0 && (await plays(page)).length === 0 && (await phase(page)) === 'start');
    await closeSettings(page); await startRun(page);
    const g = await dataGoal(page);
    ok('R21 the next activity draws inside 8..10', g >= 8 && g <= 10 && page.__errors.length === 0, String(g));
    await context.close();
  }

  /* ---------- R22 pending note: a range change during an activity applies from the next one ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, goalMode: 'random', goalMin: 6, goalMax: 8 }, reducedMotion: true });
    await startRun(page);
    const g0 = await dataGoal(page);
    await openSettings(page);
    ok('R22 random activity, nothing changed: no pending note', await page.isHidden('#pendingNote'));
    await page.click('[data-goal-max="9"]'); await sleep(150);
    ok('R22 max changed mid-activity: pending note shown, activity untouched', await page.isVisible('#pendingNote') && (await dataGoal(page)) === g0 && (await phase(page)) === 'harvest');
    await page.click('[data-goal-max="8"]'); await sleep(150);
    ok('R22 max set back: pending note hidden', await page.isHidden('#pendingNote'));
    await page.click('[data-goal-min="1"]'); await page.click('[data-goal-max="2"]'); await sleep(150);
    ok('R22 range 1..2 chosen: pending note shown, still goal ' + g0, await page.isVisible('#pendingNote') && (await dataGoal(page)) === g0);
    await closeSettings(page);
    await finishAndAgain(page);
    const g1 = await dataGoal(page); const s1 = await synced(page);
    ok('R22 next activity uses the new range (1..2) and is synced', (g1 === 1 || g1 === 2) && s1.ok, J(s1));
    await openSettings(page);
    ok('R22 after it applied: no pending note', await page.isHidden('#pendingNote'));
    await closeSettings(page);
    ok('R22 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R23 fixed mode is unaffected by a saved range ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4, goalMode: 'fixed', goalMin: 7, goalMax: 9 }, reducedMotion: true });
    ok('R23 fixed 4 with a saved range 7..9: start info「4こ」', (await page.textContent('#startInfo')) === 'いまの もくひょう：4こ', await page.textContent('#startInfo'));
    await startRun(page);
    const goals = [];
    for (let i = 0; i < 3; i++) { goals.push(await dataGoal(page)); if (i < 2) await finishAndAgain(page); }
    ok('R23 fixed mode: every activity is 4, Math.random is never called for the goal', goals.every((g) => g === 4) && (await page.evaluate(() => window.__randCalls)) === 0, J(goals) + ' calls=' + await page.evaluate(() => window.__randCalls));
    await openSettings(page);
    ok('R23 fixed mode: range rows hidden, fixed 4 pressed', await page.isHidden('#rowGoalMin') && await page.isHidden('#rowGoalMax') && J(await pressed(page)) === J(['4']));
    await page.click('#goalRandomBtn'); await sleep(150);
    ok('R23 switching to random shows the saved range 7..9', J(await rangePressed(page)) === J({ min: [7], max: [9], rowsHidden: [false, false] }), J(await rangePressed(page)));
    ok('R23 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
