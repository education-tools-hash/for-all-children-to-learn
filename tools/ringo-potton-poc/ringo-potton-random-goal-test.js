// Real-browser (Playwright / Chromium) test for the teacher's "ランダム" goal button of ringo-potton-app.html.
// The button is an ACTION, not a mode: one press picks a new goal 1..10 that differs from the selected goal
// (and, during an activity, from the goal being played) and stores it exactly like a pressed number button.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-random-goal-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a stubbed speechSynthesis. It proves what the app asks the speech
// engine to say and what the ARIA live regions receive; it is NOT an iPad Safari, VoiceOver, Bluetooth-switch
// or real-touch result and must never be reported as one.
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
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
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
const savedGoal = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).goal; } catch (e) { return 'ERR'; } }, SETTINGS_KEY);
const pressedGoal = (page) => page.evaluate(() => { const b = document.querySelector('#goalGroup [data-goal][aria-pressed="true"]'); return b ? parseInt(b.getAttribute('data-goal'), 10) : null; });
const polite = (page) => page.evaluate(() => (document.getElementById('donomanaAnnouncePolite') || {}).textContent || '');
const counts = (page) => page.evaluate(() => ({ apples: document.querySelectorAll('.apple').length, slots: document.querySelectorAll('.slot').length, reqNum: document.getElementById('reqNum').textContent }));
const landWait = () => sleep(1100);
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
// the real teacher entry: common A11y panel -> proxy -> (mid-activity: confirmation) -> sheet
async function openSettings(page) {
  await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await sleep(150);
  if (await page.isVisible('#settingsConfirm')) { await page.click('#scOpen'); await sleep(150); }
}
async function closeSettings(page) { await page.click('#settingsClose'); await sleep(600); }
async function pressRandom(page) { await page.click('#goalRandomBtn'); await sleep(150); }
async function finishAndAgain(page, n) {
  for (let i = 0; i < n; i++) { await page.click('.apple[data-status="ripe"]'); await landWait(); }
  await sleep(700); await page.click('#deliverBtn');
  await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
  await sleep(700); await page.click('#againBtn'); await sleep(700);
}
const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= 10;

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- G0 the feature must exist (explicit failure on a build without the button, no harness exception) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    const present = await page.evaluate(() => { const b = document.getElementById('goalRandomBtn'); return !!b && b.closest('#goalGroup') === document.getElementById('goalGroup'); });
    ok('G0 #goalRandomBtn exists inside #goalGroup', present);
    await context.close();
    if (!present) {
      console.log('G0 failed: the random button is absent, so G1..G12 cannot run on this build.');
      await browser.close(); srv.close();
      console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
      process.exit(1);
    }
  }

  /* ---------- G1 start screen: immediate effect, saved, announced, no speech; the next activity is in sync ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    const btn = await page.evaluate(() => { const b = document.getElementById('goalRandomBtn'); const kids = Array.from(document.getElementById('goalGroup').children); return { type: b.type, label: b.getAttribute('aria-label'), text: b.textContent, pressed: b.getAttribute('aria-pressed'), index: kids.indexOf(b), count: kids.length, prevGoal: kids[kids.indexOf(b) - 1].getAttribute('data-goal') }; });
    ok('G1 button: 11th item of the goal row, after "10", text ランダム, aria-label, no aria-pressed', btn.type === 'button' && btn.text === 'ランダム' && !!btn.label && btn.pressed === null && btn.index === 10 && btn.count === 11 && btn.prevGoal === '10', J(btn));
    await pressRandom(page);
    const g1 = await savedGoal(page);
    ok('G1 start screen: new goal is 1..10 and differs from 3', inRange(g1) && g1 !== 3, String(g1));
    ok('G1 start screen: applied immediately (data-goal, pressed number, start info)', (await dataGoal(page)) === g1 && (await pressedGoal(page)) === g1 && (await page.textContent('#startInfo')) === 'いまの もくひょう：' + g1 + 'こ');
    ok('G1 start screen: ARIA announcement "Nこに しました", no pending note', (await polite(page)) === g1 + 'こに しました' && await page.isHidden('#pendingNote'), await polite(page));
    ok('G1 random press speaks nothing', (await spoken(page)).length === 0, J(await spoken(page)));
    await closeSettings(page);
    await startRun(page);
    const c = await counts(page);
    ok('G1 next activity: apples, slots, number and request voice all = N', c.apples === g1 && c.slots === g1 && c.reqNum === String(g1) && J(await spoken(page)) === J([EXPECTED[g1]]), J(c) + ' ' + J(await spoken(page)));
    ok('G1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- G2 mid-activity: pending only, activity untouched, applied by "again" ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    const before = await spoken(page);
    await openSettings(page);
    await pressRandom(page);
    const g2 = await savedGoal(page);
    ok('G2 mid-activity: new goal 1..10, differs from 3', inRange(g2) && g2 !== 3, String(g2));
    ok('G2 mid-activity: pending note shown, current activity untouched (goal 3, 3 apples, 1 harvested, harvest phase)', await page.isVisible('#pendingNote') && (await dataGoal(page)) === 3 && (await counts(page)).apples === 3 && (await harvested(page)) === 1 && (await phase(page)) === 'harvest');
    ok('G2 mid-activity: ARIA announcement "つぎの かつどうは Nこ"', (await polite(page)) === 'つぎの かつどうは ' + g2 + 'こ', await polite(page));
    ok('G2 mid-activity: no new utterance (request voice not replayed)', J(await spoken(page)) === J(before), J(await spoken(page)));
    await closeSettings(page);
    await finishAndAgain(page, 2);
    const c = await counts(page);
    ok('G2 after "again": N applied; apples, slots, number and request voice in sync', (await dataGoal(page)) === g2 && c.apples === g2 && c.slots === g2 && c.reqNum === String(g2) && (await spoken(page)).slice(-1)[0] === EXPECTED[g2], J(c) + ' ' + J(await spoken(page)));
    ok('G2 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- G3 "again" alone never changes the goal ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await startRun(page);
    for (let i = 0; i < 3; i++) await finishAndAgain(page, 2);
    const reqs = (await spoken(page)).filter((t) => /とってね$/.test(t));
    ok('G3 three "again" without random: goal stays 2, every request says にこ', (await dataGoal(page)) === 2 && (await counts(page)).apples === 2 && reqs.length === 4 && reqs.every((t) => t === EXPECTED[2]), J(reqs));
    await context.close();
  }

  /* ---------- G4 exclusion: selected goal AND the goal being played ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4 } });
    await startRun(page);                                   // active.goal = 4
    await openSettings(page);
    await page.click('[data-goal="7"]'); await sleep(100);  // settings.goal = 7, active 4
    let okAll = true, log = [];
    let prev = 7;
    for (let i = 0; i < 30; i++) {
      await pressRandom(page);
      const g = await savedGoal(page); log.push(g);
      if (!inRange(g) || g === prev || g === 4) okAll = false;
      prev = g;
    }
    ok('G4 30 presses during an activity: always 1..10, never the selected goal, never the played goal (4)', okAll, J(log));
    await context.close();
  }

  /* ---------- G5 distribution on the start screen ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 5 } });
    await openSettings(page);
    const res = await page.evaluate(async (k) => {
      const seen = {}; let prev = JSON.parse(localStorage.getItem(k)).goal; let bad = 0;
      for (let i = 0; i < 200; i++) {
        document.getElementById('goalRandomBtn').click();
        const g = JSON.parse(localStorage.getItem(k)).goal;
        if (!(g >= 1 && g <= 10) || g === prev) bad++;
        seen[g] = 1; prev = g;
      }
      return { bad, distinct: Object.keys(seen).length, pressedOk: document.querySelectorAll('#goalGroup [data-goal][aria-pressed="true"]').length === 1 };
    }, SETTINGS_KEY);
    ok('G5 200 presses: all 1..10, never equal to the previous value, >= 8 distinct values, exactly one pressed number', res.bad === 0 && res.distinct >= 8 && res.pressedOk, J(res));
    ok('G5 no speech after 200 presses', (await spoken(page)).length === 0);
    await context.close();
  }

  /* ---------- G6 random + teacher restart during a flight: clean new run with the new goal ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await startRun(page);
    await page.evaluate(() => {
      document.querySelector('.apple').click();
      document.getElementById('ringoSettingsBtn').click();
      document.getElementById('scOpen').click();
      document.getElementById('goalRandomBtn').click();
      document.getElementById('restartBtn').click();
    });
    await sleep(1600);
    const g6 = await savedGoal(page); const c = await counts(page);
    ok('G6 restart right after random (old apple in flight): new run with N, 0 harvested, no flyer', inRange(g6) && g6 !== 3 && (await dataGoal(page)) === g6 && c.apples === g6 && (await harvested(page)) === 0 && (await phase(page)) === 'harvest' && (await page.locator('.flyer').count()) === 0, String(g6) + ' ' + J(c));
    ok('G6 request voice of the new run says N', (await spoken(page)).slice(-1)[0] === EXPECTED[g6], J(await spoken(page)));
    await context.close();
  }

  /* ---------- G7 voice OFF: still silent, ARIA announcement still works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, voice: false } });
    await openSettings(page);
    await pressRandom(page);
    const g7 = await savedGoal(page);
    ok('G7 voice OFF: nothing spoken, ARIA announcement present', (await spoken(page)).length === 0 && (await polite(page)) === g7 + 'こに しました', await polite(page));
    await closeSettings(page);
    await startRun(page);
    ok('G7 voice OFF: activity starts with N, still silent', (await counts(page)).apples === g7 && (await spoken(page)).length === 0);
    await context.close();
  }

  /* ---------- G8 storage: same key set, reload restores N, corrupt value tolerated ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await openSettings(page); await pressRandom(page);
    const g8 = await savedGoal(page);
    const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
    ok('G8 no new localStorage key', J(keysBefore) === J(keysAfter) && keysAfter.includes(SETTINGS_KEY), J(keysAfter));
    await page.reload(); await sleep(300);
    ok('G8 reload: N restored as a plain fixed goal', (await page.textContent('#startInfo')) === 'いまの もくひょう：' + g8 + 'こ' && (await dataGoal(page)) === g8);
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: '{"goal":"abc","voice":true}' });
    ok('G8 corrupt goal falls back to 3', (await dataGoal(page)) === 3);
    await openSettings(page); await pressRandom(page);
    const g = await savedGoal(page);
    ok('G8 random after a corrupt value: valid N != 3', inRange(g) && g !== 3 && page.__errors.length === 0, String(g) + ' ' + page.__errors.join('|'));
    await context.close();
  }

  /* ---------- G9 keyboard: Tab order and Enter / Space ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page);
    await page.focus('[data-goal="10"]'); await page.keyboard.press('Tab');
    ok('G9 Tab from "10" lands on the random button', (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'goalRandomBtn');
    const a = await savedGoal(page);
    await page.keyboard.press('Enter'); await sleep(100);
    const b = await savedGoal(page);
    await page.keyboard.press('Space'); await sleep(100);
    const c = await savedGoal(page);
    ok('G9 Enter and Space each pick a new goal (!= previous, 1..10)', inRange(b) && inRange(c) && b !== a && c !== b, [a, b, c].join('>'));
    await context.close();
  }

  /* ---------- G10 Switch Scan candidates: in the sheet, right after "10"; not when the sheet is closed ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, scanSpeed: 'fast' } });
    await openSettings(page);
    await page.click('[data-scan-on="1"]'); await sleep(200);
    const order = await page.evaluate(() => { const i = window.ringoScan.buildScanItems(); const r = i.indexOf(document.getElementById('goalRandomBtn')); return { r, prev: r > 0 ? i[r - 1].getAttribute('data-goal') : null, n: i.length }; });
    ok('G10 scan ON + sheet open: random button is a candidate immediately after "10"', order.r > 0 && order.prev === '10', J(order));
    await page.click('[data-scan-on="0"]'); await closeSettings(page);
    ok('G10 sheet closed: random button is not a candidate (start screen = [start])', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'startBtn'));
    await context.close();
  }

  /* ---------- G11 anywhere mode: the sheet and the surface do not interfere ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, viewport: { width: 1366, height: 1024 }, settings: { goal: 2, operation: 'anywhere' } });
    await startRun(page);
    const p = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); return { x: Math.floor(s.left / 2), y: Math.floor(innerHeight / 2) }; });
    await openSettings(page);
    await page.mouse.click(p.x, 200); await sleep(400);
    ok('G11 sheet open: a background (margin) tap does not harvest', (await harvested(page)) === 0);
    const hit = await page.evaluate(() => { const b = document.getElementById('goalRandomBtn'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); });
    ok('G11 random button is on top (not under the surface)', hit);
    await pressRandom(page);
    const g11 = await savedGoal(page);
    await closeSettings(page);
    await page.mouse.click(p.x, p.y); await landWait();
    ok('G11 after closing: whole-screen tap harvests as before (current goal 2 still played)', (await harvested(page)) === 1 && (await dataGoal(page)) === 2 && inRange(g11) && g11 !== 2);
    await context.close();
  }

  /* ---------- G12 wording / live regions / help ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await openSettings(page); await pressRandom(page);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('G12 live regions: no request text, no evaluative words', !/とってね/.test(live) && !/すごい|えらい|じょうず|せいかい|正解|てんすう|スコア/.test(live), live);
    // the help sheet legitimately says「正解や まちがいは ありません」, so the evaluative-word check is applied to the settings sheet only
    const texts = await page.evaluate(() => ({ settings: document.getElementById('settingsSheet').innerText, help: document.getElementById('helpSheet').textContent }));
    ok('G12 help mentions the random button; no evaluative words in the settings sheet', /「ランダム」を おすと/.test(texts.help) && !/すごい|えらい|じょうず|せいかい|正解|てんすう|スコア/.test(texts.settings), J(texts.settings).slice(0, 120));
    ok('G12 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
