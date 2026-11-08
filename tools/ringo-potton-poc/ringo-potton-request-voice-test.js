// Real-browser (Playwright / Chromium) test for the request voice of ringo-potton-app.html
// ("りんごを ○こ、とってね", spoken once when an activity starts).
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-request-voice-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a stubbed speechSynthesis that records the text passed to
// speak() and never fires onend. It proves WHEN and WHAT the app asks the speech engine to say; it is
// NOT an iPad Safari, VoiceOver, Bluetooth-switch or real-audio result (voice quality, real timing,
// whether Safari actually plays the utterance) and must never be reported as one.
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

// same stub as ringo-potton-realbrowser-test.js: records speak() text and cancel(), never fires onend
const SPEECH_STUB = `
  (function () {
    window.__sp = [];
    window.__spThrow = false;
    function U(t) { this.text = t; this.lang = ''; this.rate = 1; this.volume = 1; }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speaking: false, pending: false,
      speak: function (u) { if (window.__spThrow) throw new Error('speak failed'); window.__sp.push(u.text); },
      cancel: function () { window.__sp.push('CANCEL'); },
      getVoices: function () { return []; },
      addEventListener: function () {}, removeEventListener: function () {}
    } });
  })();
`;
// Web Speech API absent entirely
const NO_SPEECH = `
  (function () {
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }); } catch (e) {}
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined }); } catch (e) {}
  })();
`;

async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, hasTouch: !!opts.touch });
  await context.addInitScript(opts.noSpeech ? NO_SPEECH : SPEECH_STUB);
  if (opts.settings) {
    await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: JSON.stringify(opts.settings) });
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
const raw = (page) => page.evaluate(() => window.__sp.slice());
const spoken = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const requests = async (page) => (await spoken(page)).filter((t) => /とってね$/.test(t));
const counts = async (page) => (await spoken(page)).filter((t) => !/とってね$/.test(t));
const bubble = (page) => page.evaluate(() => document.getElementById('bubble').innerText.replace(/\s+/g, ''));
const landWait = () => sleep(1100);
const J = JSON.stringify;

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- R1 goal 1..10: exactly one request with the right reading; display unchanged ---------- */
  for (let g = 1; g <= 10; g++) {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: g } });
    ok('R1 goal ' + g + ': nothing spoken on the start screen', (await spoken(page)).length === 0);
    await page.click('#startBtn'); await sleep(300);
    ok('R1 goal ' + g + ': exactly one request "' + EXPECTED[g] + '"', J(await requests(page)) === J([EXPECTED[g]]), J(await spoken(page)));
    ok('R1 goal ' + g + ': bubble text unchanged ("りんごを' + g + 'こ、とってね")', (await bubble(page)) === 'りんごを' + g + 'こ、とってね', await bubble(page));
    ok('R1 goal ' + g + ': no error', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R2 the request is never re-spoken by redraws / resize / rotation ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4 } });
    await page.click('#startBtn'); await sleep(300);
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400);
    ok('R2 rotate / resize: still exactly one request', J(await requests(page)) === J([EXPECTED[4]]), J(await spoken(page)));
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('R2 a harvest (re-render) does not repeat the request', J(await requests(page)) === J([EXPECTED[4]]) && J(await counts(page)) === J(['いち']), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R3 harvest while the request may still be playing: request is cut, counting is clean ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn'); await sleep(700);   // just past the 600ms screen-change guard
    const before = (await raw(page)).length;
    await page.click('.apple[data-status="ripe"]');
    const atIntent = (await raw(page)).slice(before);
    ok('R3 the harvest input itself cancels the request (before the apple lands)', atIntent.includes('CANCEL') && (await harvested(page)) === 0, J(atIntent));
    await landWait();
    const seq = (await raw(page)).filter((t) => t.trim() !== '');
    const ri = seq.indexOf(EXPECTED[3]), ci = seq.indexOf('いち');
    ok('R3 order: request -> CANCEL -> "いち"', ri !== -1 && ci > ri && seq.slice(ri + 1, ci).includes('CANCEL'), J(seq));
    ok('R3 the harvest itself is not delayed or blocked by the request (count 1)', (await harvested(page)) === 1);
    await context.close();
  }

  /* ---------- R4 rapid input during / after the request: counting exact, one request ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn');
    const t0 = Date.now();
    while (Date.now() - t0 < 4500) { await page.evaluate(() => document.querySelectorAll('.apple').forEach((a) => a.click())); await sleep(60); }
    ok('R4 rapid clicking from the first moment: goal reached, never exceeded', (await harvested(page)) === 3 && (await phase(page)) === 'complete');
    ok('R4 one request, counts exactly いち, に, さん', J(await requests(page)) === J([EXPECTED[3]]) && J(await counts(page)) === J(['いち', 'に', 'さん']), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R5 keyboard during the request window ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.click('#startBtn'); await sleep(700);
    await page.focus('.apple[data-status="ripe"]');
    await page.keyboard.press('Enter'); await landWait();
    ok('R5 Enter right after the request => 1 harvest, counting "いち"', (await harvested(page)) === 1 && J(await counts(page)) === J(['いち']), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R6 Switch Scan: the request does not interfere with the scan / one press ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, scanSpeed: 'fast' } });
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    await page.click('[data-scan-on="1"]'); await page.click('#settingsClose'); await sleep(500);
    await page.focus('#startBtn');
    await page.keyboard.press('Enter'); await sleep(900);
    ok('R6 scan: one press starts, one request spoken', (await phase(page)) === 'harvest' && J(await requests(page)) === J([EXPECTED[3]]), J(await spoken(page)));
    await sleep(500);
    ok('R6 scan: exactly one highlighted apple while/after the request', (await page.locator('.scan-focus').count()) === 1);
    await page.keyboard.press('Space'); await sleep(1300);
    ok('R6 scan: one switch press => exactly one harvest, counting "いち"', (await harvested(page)) === 1 && J(await counts(page)) === J(['いち']), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R7 anywhere mode (どこでもタップ) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, operation: 'anywhere' } });
    await page.click('#startBtn'); await sleep(700);
    ok('R7 anywhere: one request', J(await requests(page)) === J([EXPECTED[2]]));
    await page.click('#surface', { position: { x: 30, y: 300 } }); await landWait();
    ok('R7 anywhere: surface tap harvests and counts', (await harvested(page)) === 1 && J(await counts(page)) === J(['いち']), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R8 voice OFF (saved): no request, no count, activity works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, voice: false } });
    await page.click('#startBtn'); await sleep(700);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('R8 voice OFF: nothing spoken at all, harvest works', (await spoken(page)).length === 0 && (await harvested(page)) === 1, J(await spoken(page)));
    await context.close();
  }

  /* ---------- R9 voice turned OFF mid-activity: no request on the next activity; ON again: back ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await sleep(700);
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await page.click('#scOpen');
    await page.click('[data-voice="0"]'); await page.click('#settingsClose'); await sleep(700);
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    await page.click('#deliverBtn'); await sleep(1500); await page.click('#againBtn'); await sleep(700);
    ok('R9 voice OFF: the next activity speaks no request', J(await requests(page)) === J([EXPECTED[1]]) && (await counts(page)).length === 0, J(await spoken(page)));
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await page.click('#scOpen');
    await page.click('[data-voice="1"]'); await page.click('#settingsClose'); await sleep(700);
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    await page.click('#deliverBtn'); await sleep(1500); await page.click('#againBtn'); await sleep(400);
    ok('R9 voice ON again: the next activity speaks the request again', J(await requests(page)) === J([EXPECTED[1], EXPECTED[1]]), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R10 voice OFF while the request is pending (before it fires): it never plays ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.evaluate(() => { document.getElementById('startBtn').click(); document.querySelector('[data-voice="0"]').click(); });
    await sleep(400);
    ok('R10 voice OFF within the 60ms gap: request never spoken', (await requests(page)).length === 0, J(await raw(page)));
    await context.close();
  }

  /* ---------- R11 again / restart: a fresh request with the NEW goal; old one never repeats ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await sleep(700);
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await page.click('#scOpen');
    await page.click('[data-goal="5"]'); await page.click('#settingsClose'); await sleep(700);
    ok('R11 goal change mid-activity: no extra request now', J(await requests(page)) === J([EXPECTED[1]]), J(await spoken(page)));
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    await page.click('#deliverBtn'); await sleep(1500); await page.click('#againBtn'); await sleep(400);
    ok('R11 again: request for the new goal (ごこ), in order', J(await requests(page)) === J([EXPECTED[1], EXPECTED[5]]), J(await spoken(page)));
    ok('R11 again: 5 apples', (await page.locator('.apple').count()) === 5);
    // restart from the settings sheet mid-activity
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await page.click('#scOpen');
    await page.click('[data-goal="2"]');
    await page.click('#restartBtn'); await sleep(400);
    ok('R11 restart: request for the restarted goal (にこ)', J(await requests(page)) === J([EXPECTED[1], EXPECTED[5], EXPECTED[2]]), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R12 whole-screen "again" ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, operation: 'anywhere', againAnywhere: true } });
    await page.click('#startBtn'); await sleep(700);
    await page.click('#surface', { position: { x: 30, y: 300 } }); await landWait(); await sleep(700);
    await page.click('#surface', { position: { x: 30, y: 300 } });
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 5000 });
    await sleep(700); await page.click('#surface', { position: { x: 30, y: 300 } }); await sleep(400);
    ok('R12 whole-screen again: exactly one new request', (await phase(page)) === 'harvest' && J(await requests(page)) === J([EXPECTED[1], EXPECTED[1]]), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R13 number display OFF: request still says the number (voice is its own setting) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4, showNumber: false } });
    await page.click('#startBtn'); await sleep(300);
    ok('R13 showNumber OFF: bubble unchanged ("りんごをとってね")', (await bubble(page)) === 'りんごをとってね', await bubble(page));
    ok('R13 showNumber OFF: request still spoken with the number', J(await requests(page)) === J([EXPECTED[4]]), J(await spoken(page)));
    await context.close();
  }

  /* ---------- R14 speech API absent: silent, whole cycle completes, no error ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, noSpeech: true });
    ok('R14 no speechSynthesis in this page', await page.evaluate(() => !window.speechSynthesis));
    await page.click('#startBtn'); await sleep(700);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    await page.click('#deliverBtn'); await sleep(1500);
    ok('R14 no speech API: harvest -> complete -> deliver -> celebrate', (await phase(page)) === 'celebrate');
    await page.click('#againBtn'); await sleep(400);
    ok('R14 no speech API: again works, no error', (await phase(page)) === 'harvest' && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R15 speak() throws: silent, activity continues ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.evaluate(() => { window.__spThrow = true; });
    await page.click('#startBtn'); await sleep(700);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('R15 speak() throws: activity continues, no error', (await phase(page)) === 'harvest' && (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- R16 the request is not put into the polite live region (no new VoiceOver text) ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn'); await sleep(400);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('R16 live regions carry only the existing start announcement (no "とってね" text added)', !/とってね/.test(live), live);
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
