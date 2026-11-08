// Real-browser (Playwright / Chromium) test for the teacher's「ランダム」goal MODE of ringo-potton-app.html.
// settings.goalMode = 'fixed' | 'random'. In random mode every activity start draws a goal 1..10 that differs
// from the activity started just before; in fixed mode「もう いちど」keeps the same number. Selecting the mode
// never starts, stops or restarts an activity; the drawn number is decided at the start of the next activity.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-random-goal-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a stubbed speechSynthesis. It proves what the app asks the speech
// engine to say and what the ARIA live regions / aria-pressed receive; it is NOT an iPad Safari, VoiceOver,
// Bluetooth-switch or real-touch result and must never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const EXPECTED = ['', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'].map((r) => r && 'りんごを ' + r + '、とってね');

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

// same stub as the other ringo-potton suites: records speak() text and cancel(), never fires onend
const SPEECH_STUB = `
  (function () {
    window.__sp = [];
    function U(t) { this.text = t; this.lang = ''; this.rate = 1; this.volume = 1; }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speaking: false, pending: false,
      speak: function (u) { window.__sp.push(u.text); },
      cancel: function () { window.__sp.push('CANCEL'); },
      getVoices: function () { return []; },
      addEventListener: function () {}, removeEventListener: function () {}
    } });
  })();
`;

async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(SPEECH_STUB);
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
const requests = async (page) => (await spoken(page)).filter((t) => /とってね$/.test(t));
const saved = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return 'ERR'; } }, SETTINGS_KEY);
const pressed = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#goalGroup button')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-goal') || b.id));
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
    ok('R1 selecting the mode speaks nothing and starts nothing', (await spoken(page)).length === 0 && (await phase(page)) === 'start');
    await closeSettings(page);
    await startRun(page);
    const s1 = await synced(page);
    ok('R1 first random activity: goal 1..10, apples / slots / number / request voice all = N', s1.ok, J(s1));
    ok('R1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R2 fixed mode:「もう いちど」never changes the number ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, reducedMotion: true });
    await startRun(page);
    for (let i = 0; i < 3; i++) await finishAndAgain(page);
    const reqs = await requests(page);
    ok('R2 fixed 2, three times「もう いちど」: goal stays 2, all four requests say にこ', (await dataGoal(page)) === 2 && reqs.length === 4 && reqs.every((t) => t === EXPECTED[2]), J(reqs));
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
    ok('R3 every activity in sync (apples = slots = number = request voice)', allSynced);
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
    const before = await spoken(page);
    await openSettings(page);
    await page.click('#goalRandomBtn'); await sleep(150);
    ok('R4 mid-activity: pending note shown, activity untouched (goal 3, 3 apples, 1 harvested, harvest)', await page.isVisible('#pendingNote') && (await dataGoal(page)) === 3 && (await counts(page)).apples === 3 && (await harvested(page)) === 1 && (await phase(page)) === 'harvest');
    ok('R4 mid-activity: ARIA「つぎの かつどうから ランダム」, no new utterance', (await polite(page)) === 'つぎの かつどうから ランダム' && J(await spoken(page)) === J(before), await polite(page));
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
    ok('R5 last request voice matches the current goal (old run never speaks into the new one)', (await synced(page)).ok, J(await synced(page)));
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
    ok('R13 voice OFF: nothing spoken, ARIA「ランダムに しました」', (await spoken(page)).length === 0 && (await polite(page)) === 'ランダムに しました', await polite(page));
    await closeSettings(page); await startRun(page);
    ok('R13 voice OFF: random activity starts silently with a valid goal', inRange(await dataGoal(page)) && (await spoken(page)).length === 0);
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

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
