// Real-browser (Playwright / Chromium) test for ringo-potton-app.html (Phase 1).
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-realbrowser-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: this is Chromium on Linux with a stubbed speechSynthesis. It is NOT an iPad Safari,
// VoiceOver, Bluetooth-switch or real-touch result and must never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };

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

// speechSynthesis stub: records everything, NEVER fires onend (worst case for progression).
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

async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    hasTouch: !!opts.touch,
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference'
  });
  await context.addInitScript(SPEECH_STUB);
  if (opts.settings) {
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
const speech = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
// wait until an apple has landed (flight 650ms + margin)
const landWait = () => sleep(1100);

async function harvestN(page, n, how) {
  for (let i = 0; i < n; i++) {
    if (how === 'surface') await page.click('#surface', { position: { x: 60, y: 60 } });
    else await page.click('.apple[data-status="ripe"]');
    await landWait();
  }
}

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const URL = BASE + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const base = { url: URL };

  /* ---------------- T1 load / structure ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    ok('T1 start screen visible, no errors', await page.isVisible('#startBtn') && page.__errors.length === 0, page.__errors.join('|'));
    const dup = await page.evaluate(() => { const ids = {}; let d = 0; document.querySelectorAll('[id]').forEach((e) => { if (ids[e.id]) d++; ids[e.id] = 1; }); return d; });
    ok('T1 duplicate ids = 0', dup === 0, String(dup));
    ok('T1 exactly one h1', (await page.locator('h1').count()) === 1);
    ok('T1 injected common chrome present (home/lock/fs/a11y/help)', await page.evaluate(() => ['donomanaHomeBtn', 'donomanaLockBtn', 'donomanaFsBtn', 'donomanaA11yBtn', 'donomanaHelpBtn'].every((i) => !!document.getElementById(i))));
    // chrome order: Lock -> Fullscreen -> Help in DOM / Tab order
    const order = await page.evaluate(() => { const a = ['donomanaLockBtn', 'donomanaFsBtn', 'donomanaHelpBtn'].map((i) => document.getElementById(i)); return a[0].compareDocumentPosition(a[1]) & 4 && a[1].compareDocumentPosition(a[2]) & 4 ? true : false; });
    ok('T1 Help ordered after Lock and Fullscreen', order);
    ok('T1 settings entry is hidden / not tabbable', await page.evaluate(() => { const b = document.getElementById('ringoSettingsBtn'); const cs = getComputedStyle(b); return b.tabIndex === -1 && (cs.opacity === '0' || cs.display === 'none'); }));
    ok('T1 common settings proxy exists in A11y panel', (await page.locator('#donomanaSettingsProxy').count()) === 1);
    ok('T1 default goal is 3 (data-goal after start)', (await startRun(page), await attr(page, 'data-goal')) === '3');
    ok('T1 apples = slots = goal', await page.evaluate(() => document.querySelectorAll('.apple').length === 3 && document.querySelectorAll('.slot').length === 3));
    await context.close();
  }

  /* ---------------- T2/T3 one tap = one harvest, order, speech ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await startRun(page);
    ok('T2 phase harvest, harvested 0', (await phase(page)) === 'harvest' && (await harvested(page)) === 0);
    await page.click('.apple[data-status="ripe"]');
    await sleep(150);
    ok('T3 during flight: nothing counted yet (count/slot/speech all wait for the landing)', (await harvested(page)) === 0 && (await page.textContent('#countNum')) === '0' && (await speech(page)).length === 0);
    await sleep(900);
    ok('T3 after landing: count 1, one slot filled, number shown', (await harvested(page)) === 1 && (await page.textContent('#countNum')) === '1' && (await page.locator('.slot[data-filled="1"]').count()) === 1);
    await sleep(200);
    ok('T3 exactly one utterance "いち" (and unlock utterance excluded)', JSON.stringify(await speech(page)) === JSON.stringify(['いち']), JSON.stringify(await speech(page)));
    ok('T3 speech onend never fired but progression continues', (await phase(page)) === 'harvest');
    await context.close();
  }

  /* ---------------- T4/T5 duplicate-activation + overshoot ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await startRun(page);
    // three clicks on the same apple in one tick, plus clicks on the other two
    await page.evaluate(() => { const a = document.querySelectorAll('.apple'); a[0].click(); a[0].click(); a[0].click(); a[1].click(); a[2].click(); });
    await sleep(1300);
    ok('T4 burst of 5 clicks in one tick => exactly 1 harvest', (await harvested(page)) === 1, String(await harvested(page)));
    await page.click('.apple[data-status="ripe"]'); await landWait();
    // rapid clicking for 5 seconds must still never exceed the goal
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) { await page.evaluate(() => document.querySelectorAll('.apple').forEach((a) => a.click())); await sleep(60); }
    const h = await harvested(page);
    ok('T5 spamming never exceeds goal (3) and completes', h === 3 && (await phase(page)) === 'complete', h + ' / ' + (await phase(page)));
    ok('T5 speech is exactly いち, に, さん in order', JSON.stringify(await speech(page)) === JSON.stringify(['いち', 'に', 'さん']), JSON.stringify(await speech(page)));
    ok('T5 all slots filled, no ripe apple left', (await page.locator('.slot[data-filled="1"]').count()) === 3 && (await page.locator('.apple[data-status="ripe"]').count()) === 0);
    await context.close();
  }

  /* ---------------- T4b touch tap ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, touch: true });
    await startRun(page);
    await page.tap('.apple[data-status="ripe"]'); await landWait();
    ok('T4b touch tap => 1 harvest', (await harvested(page)) === 1);
    await context.close();
  }

  /* ---------------- T6/T7 anywhere mode: harvest, deliver, again; carry-over guard ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, operation: 'anywhere', againAnywhere: false } });
    await startRun(page);
    ok('T6 surface visible and operable in anywhere mode', await page.isVisible('#surface') && (await attr(page, 'data-op')) === 'anywhere');
    for (let i = 0; i < 10; i++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(30); }
    await sleep(1200);
    ok('T6 10 rapid surface clicks in 0.3s => 1 harvest', (await harvested(page)) === 1, String(await harvested(page)));
    await page.click('#surface', { position: { x: 20, y: 300 } }); await landWait();
    ok('T6 goal reached => complete, harvest stops', (await phase(page)) === 'complete' && (await harvested(page)) === 2);
    await page.evaluate(() => document.getElementById('surface').click());
    await sleep(100);
    ok('T7 tap right after completion is ignored (carry-over guard)', (await phase(page)) === 'complete');
    await sleep(700);
    await page.click('#surface', { position: { x: 20, y: 300 } });
    await sleep(100);
    ok('T6 anywhere deliver works after the guard', ['delivering', 'celebrate'].includes(await phase(page)));
    await sleep(1500);
    ok('T6 celebrate reached; "again" button visible; no auto-restart', (await phase(page)) === 'celebrate' && await page.isVisible('#againBtn'));
    ok('T19 slots emptied after delivery and no flyer left', (await page.locator('.slot[data-filled="1"]').count()) === 0 && (await page.locator('.flyer').count()) === 0);
    await page.evaluate(() => document.getElementById('app').click());
    await sleep(1500);
    ok('T6 againAnywhere=false: a stage tap does not restart', (await phase(page)) === 'celebrate');
    await page.click('#againBtn'); await sleep(700);
    ok('T6 again button starts a new activity (harvest, 0)', (await phase(page)) === 'harvest' && (await harvested(page)) === 0);
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, operation: 'anywhere', againAnywhere: true } });
    await startRun(page);
    await page.click('#surface', { position: { x: 30, y: 200 } }); await landWait();
    await sleep(700); await page.click('#surface', { position: { x: 30, y: 200 } });
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 5000 });
    ok('T6b celebrate reached with againAnywhere=true', (await phase(page)) === 'celebrate');
    await page.evaluate(() => document.getElementById('surface').click()); await sleep(100);
    ok('T6b tap right after celebrate is ignored (guard)', (await phase(page)) === 'celebrate');
    await sleep(700); await page.click('#surface', { position: { x: 30, y: 200 } }); await sleep(300);
    ok('T6b after the guard, whole-screen "again" restarts', (await phase(page)) === 'harvest');
    await context.close();
  }

  /* ---------------- T8 keyboard ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await startRun(page);
    await page.focus('.apple[data-status="ripe"]');
    await page.keyboard.press('Enter'); await landWait();
    ok('T8 Enter => 1 harvest', (await harvested(page)) === 1);
    ok('T8 focus moves to the next ripe apple after a keyboard harvest', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('apple') && document.activeElement.getAttribute('data-status') === 'ripe'));
    await page.keyboard.press('Space'); await landWait();
    ok('T8 Space => 1 more harvest (2)', (await harvested(page)) === 2);
    // hold Enter: key auto-repeat must not harvest again
    await page.keyboard.down('Enter');
    for (let i = 0; i < 6; i++) { await page.keyboard.down('Enter'); await sleep(250); }
    await page.keyboard.up('Enter'); await sleep(1500);
    ok('T8 holding Enter harvests at most once more (goal 3 reached, never exceeded)', (await harvested(page)) === 3, String(await harvested(page)));
    ok('T8 complete: focus moved to the deliver button', (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'deliverBtn');
    await context.close();
  }

  /* ---------------- T9/T10 voice off (immediate) and speech failure ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('T9 voice on: spoken', (await speech(page)).length === 1);
    // teacher turns voice OFF mid-activity (through the real entry: A11y panel -> proxy -> confirm -> open)
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    ok('T11 mid-activity: confirmation shown first, settings not yet open', await page.isVisible('#settingsConfirm') && await page.isHidden('#settingsSheet'));
    await page.click('#scOpen');
    ok('T11 after confirming, settings sheet opens', await page.isVisible('#settingsSheet'));
    await page.click('[data-voice="0"]');
    ok('T9 voice OFF applies immediately (cancel issued, setting saved)', await page.evaluate((k) => window.__sp.includes('CANCEL') && JSON.parse(localStorage.getItem(k)).voice === false, SETTINGS_KEY));
    await page.click('[data-goal="5"]');
    ok('T11 goal change shows the "next activity" note and does not change the current activity', await page.isVisible('#pendingNote') && (await attr(page, 'data-goal')) === '3');
    await page.click('#settingsClose'); await sleep(600);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('T9 voice OFF: no new utterance on the next harvest, count still advances', (await speech(page)).length === 1 && (await harvested(page)) === 2);
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    await page.click('#deliverBtn'); await sleep(1500); await page.click('#againBtn'); await sleep(700);
    ok('T11 changed goal (5) is applied from the next activity', (await attr(page, 'data-goal')) === '5' && (await page.locator('.apple').count()) === 5);
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, base);
    await page.evaluate(() => { window.__spThrow = true; });
    await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('T10 speech failure (speak throws) does not stop the activity', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript('delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;');
    const page = await ctx.newPage(); page.__errors = []; page.on('pageerror', (e) => page.__errors.push(e.message));
    await page.goto(URL); await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('T10 no Web Speech API at all: still works, no error', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await ctx.close();
  }

  /* ---------------- T11 idle: settings open directly; overlays block the activity ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    ok('T11 on the start screen settings open directly (no confirmation)', await page.isVisible('#settingsSheet') && await page.isHidden('#settingsConfirm'));
    ok('T11 stage is inert while settings are open', (await page.getAttribute('#stage', 'inert')) !== null);
    ok('T11 focus is inside the settings sheet', await page.evaluate(() => document.getElementById('settingsSheet').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    ok('T11 Escape closes settings; focus returns to the A11y launcher', await page.isHidden('#settingsSheet') && (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'donomanaA11yBtn');
    await startRun(page);
    // A11y panel open: tapping the stage must neither harvest nor be treated as a harvest when it closes the panel
    await page.click('#donomanaA11yBtn');
    await page.evaluate(() => document.querySelector('.apple').click());
    await sleep(1200);
    ok('T12 A11y panel open: apple click is ignored', (await harvested(page)) === 0);
    await page.keyboard.press('Escape'); await sleep(500);
    // confirmation open: stage inert + clicks ignored
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click());
    await page.evaluate(() => document.querySelector('.apple').click());
    await sleep(1200);
    ok('T11 confirmation open: apple click ignored, stage inert', (await harvested(page)) === 0 && (await page.getAttribute('#stage', 'inert')) !== null);
    await page.click('#scCancel'); await sleep(600);
    ok('T11 cancel closes the confirmation, activity untouched and operable', await page.isHidden('#settingsConfirm') && (await page.getAttribute('#stage', 'inert')) === null);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('T11 harvest works after cancel', (await harvested(page)) === 1);
    await context.close();
  }

  /* ---------------- T12 chrome / settings / home never act as harvest ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, operation: 'anywhere' } });
    await startRun(page);
    const hit = await page.evaluate(() => {
      const out = {};
      ['donomanaHomeBtn', 'donomanaLockBtn', 'donomanaFsBtn', 'donomanaHelpBtn', 'donomanaA11yBtn'].forEach((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out[id] = !!el && (el.id === id || document.getElementById(id).contains(el));
      });
      return out;
    });
    ok('T12 each common-chrome button is the topmost element at its centre (never under the surface)', Object.values(hit).every(Boolean), JSON.stringify(hit));
    await page.click('#donomanaHelpBtn'); await sleep(300);
    ok('T12 Help button does not harvest', (await harvested(page)) === 0 && await page.isVisible('#helpSheet'));
    await page.click('#helpClose'); await sleep(600);
    await context.close();
  }

  /* ---------------- T13 help ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await page.click('#donomanaHelpBtn');
    ok('T13 Help opens, aria-expanded=true, stage inert', await page.isVisible('#helpSheet') && (await page.getAttribute('#donomanaHelpBtn', 'aria-expanded')) === 'true' && (await page.getAttribute('#stage', 'inert')) !== null);
    const heads = await page.evaluate(() => Array.from(document.querySelectorAll('#helpSheet h2,#helpSheet h3,#helpSheet h4')).map((h) => +h.tagName[1]));
    let skip = false; for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) skip = true;
    ok('T13 Help heading levels never skip (h2->h3->h4)', heads[0] === 2 && !skip, heads.join(''));
    const txt = await page.textContent('#helpSheet');
    ok('T13 Help has no technical terms', !/IndexedDB|localStorage|DOM|ARIA|state machine|Web Speech/.test(txt));
    await page.keyboard.press('Escape');
    ok('T13 Escape closes Help and focus returns to the Help button', await page.isHidden('#helpSheet') && (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'donomanaHelpBtn');
    await context.close();
  }

  /* ---------------- T13b the sheets' close buttons are never hidden under the common chrome ---------------- */
  for (const [w, h] of [[375, 667], [667, 375], [812, 375], [768, 1024], [1280, 900]]) {
    const { context, page } = await newPage(browser, { url: URL, viewport: { width: w, height: h } });
    await page.click('#donomanaHelpBtn'); await sleep(200);
    const helpOk = await page.evaluate(() => { const b = document.getElementById('helpClose'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); });
    await page.click('#helpClose');
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await sleep(200);
    const setOk = await page.evaluate(() => { const b = document.getElementById('settingsClose'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); });
    ok('T13b ' + w + 'x' + h + ': Help and Settings close buttons are tappable (not under common chrome)', helpOk && setOk, helpOk + '/' + setOk);
    await context.close();
  }

  /* ---------------- T14 Switch Scan ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3, scanSpeed: 'fast' } });
    ok('T14 scan items on the start screen = [start]', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'startBtn'));
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    await page.click('[data-scan-on="1"]'); await page.click('#settingsClose'); await sleep(500);
    await page.focus('#startBtn');
    await page.keyboard.press('Enter'); await sleep(900);   // start via the scanned/highlighted item
    ok('T14 scan ON: the highlighted start item starts the activity with one press', (await phase(page)) === 'harvest');
    await sleep(500);
    ok('T14 scan candidates in apple mode = the 3 ripe apples; common chrome excluded', await page.evaluate(() => { const i = window.ringoScan.buildScanItems(); return i.length === 3 && i.every((e) => e.classList.contains('apple')); }));
    const a = await page.evaluate(() => document.querySelector('.scan-focus') && document.querySelector('.scan-focus').getAttribute('data-id'));
    await sleep(1800);
    const b = await page.evaluate(() => document.querySelector('.scan-focus') && document.querySelector('.scan-focus').getAttribute('data-id'));
    ok('T14 the highlight advances on its own', a !== null && b !== null && a !== b, a + '->' + b);
    ok('T14 exactly one highlighted element', (await page.locator('.scan-focus').count()) === 1);
    await page.keyboard.press('Space'); await sleep(1300);
    ok('T14 one switch press => exactly one harvest', (await harvested(page)) === 1, String(await harvested(page)));
    // OFF cleanup
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await page.click('#scOpen');
    await page.click('[data-scan-on="0"]'); await page.click('#settingsClose'); await sleep(300);
    const before = await page.evaluate(() => document.querySelectorAll('.scan-focus').length);
    await sleep(1800);
    ok('T14 scan OFF leaves no highlight and no moving highlight', before === 0 && (await page.locator('.scan-focus').count()) === 0);
    await context.close();
  }
  {
    // anywhere mode: the single candidate is the surface; deliver/again are candidates in their phases
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, operation: 'anywhere' } });
    await startRun(page);
    ok('T14b anywhere + scan: candidate list = [surface]', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'surface'));
    await page.click('#surface', { position: { x: 30, y: 200 } }); await landWait(); await sleep(500);
    ok('T14b complete: candidate = [deliver button]', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'deliverBtn'));
    await context.close();
  }

  /* ---------------- T15 reduced motion ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, reducedMotion: true });
    await startRun(page);
    await page.click('.apple[data-status="ripe"]');
    await sleep(200);
    ok('T15 reduced motion: lands without a flying clone', (await harvested(page)) === 1 && (await page.locator('.flyer').count()) === 0);
    await context.close();
  }

  /* ---------------- T16 responsive / overflow / sizes / chrome overlap ---------------- */
  {
    const vps = [[375, 667], [375, 812], [390, 844], [768, 1024], [1280, 900], [667, 375], [812, 375], [1024, 768]];
    for (const goal of [1, 3, 10]) {
      for (const [w, h] of vps) {
        const { context, page } = await newPage(browser, { url: URL, viewport: { width: w, height: h }, settings: { goal, operation: 'apple' } });
        await startRun(page);
        const m = await page.evaluate(() => {
          const rect = (e) => e.getBoundingClientRect();
          const chrome = ['donomanaHomeBtn', 'donomanaLockBtn', 'donomanaFsBtn', 'donomanaHelpBtn', 'donomanaA11yBtn'].map((i) => rect(document.getElementById(i)));
          const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const apples = Array.from(document.querySelectorAll('.apple')).map(rect);
          const slots = Array.from(document.querySelectorAll('.slot')).map(rect);
          const interactive = apples.concat([rect(document.getElementById('countNum'))]);
          let overlap = 0; interactive.forEach((r) => chrome.forEach((c) => { if (hit(r, c)) overlap++; }));
          const minApple = Math.min.apply(null, apples.map((r) => Math.min(r.width, r.height)));
          const farRight = Math.max.apply(null, apples.concat(slots).map((r) => r.right));
          const offscreenX = apples.concat(slots).some((r) => r.left < -1 || r.right > innerWidth + 1);
          return { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, overlap: overlap, minApple: Math.round(minApple), offscreenX: offscreenX, scrollH: document.documentElement.scrollHeight - innerHeight };
        });
        const tag = 'T16 goal=' + goal + ' ' + w + 'x' + h;
        ok(tag + ': no horizontal overflow', m.overflowX <= 0, JSON.stringify(m));
        ok(tag + ': apples >= 60px, nothing off-screen horizontally', m.minApple >= 60 && !m.offscreenX, JSON.stringify(m));
        ok(tag + ': apples do not overlap common chrome', m.overlap === 0, JSON.stringify(m));
        if (m.scrollH > 0) console.log('INFO ' + tag + ': page scrolls vertically by ' + m.scrollH + 'px (allowed by standard 32)');
        await context.close();
      }
    }
  }

  /* ---------------- T16c the deliver / again buttons must be reachable without hunting for them ---------------- */
  {
    const vps = [[375, 667], [375, 812], [390, 844], [768, 1024], [667, 375], [812, 375], [1024, 768]];
    for (const goal of [1, 10]) {
      for (const [w, h] of vps) {
        const { context, page } = await newPage(browser, { url: URL, viewport: { width: w, height: h }, reducedMotion: true, settings: { goal, operation: 'anywhere' } });
        await startRun(page);
        // all apples and the last basket slot must be on screen while harvesting
        const inView = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('.apple, .slot'));
          return els.every((e) => { const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1; });
        });
        for (let i = 0; i < goal; i++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(480); }
        await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'complete', null, { timeout: 8000 });
        await sleep(300);
        const dv = await page.evaluate(() => { const r = document.getElementById('deliverBtn').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight }; });
        const tag = 'T16c goal=' + goal + ' ' + w + 'x' + h;
        ok(tag + ': all apples + slots on screen while harvesting', inView);
        ok(tag + ': deliver button fully on screen when it appears', dv.top >= 0 && dv.bottom <= dv.vh + 1 && dv.h >= 80, JSON.stringify(dv));
        await sleep(400);
        await page.evaluate(() => document.getElementById('deliverBtn').click());
        await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 5000 });
        await sleep(300);
        const ag = await page.evaluate(() => { const r = document.getElementById('againBtn').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
        ok(tag + ': again button fully on screen', ag.top >= 0 && ag.bottom <= ag.vh + 1, JSON.stringify(ag));
        await context.close();
      }
    }
  }

  /* ---------------- T16b font scale / high contrast do not break layout ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, viewport: { width: 375, height: 667 }, settings: { goal: 5 } });
    await startRun(page);
    await page.click('#donomanaA11yBtn'); await page.click('[data-a11y-font="xlarge"]'); await page.click('[data-a11y-contrast="hc"]');
    await page.keyboard.press('Escape'); await sleep(300);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('T16b xlarge font + high contrast: no horizontal overflow', o <= 0, String(o));
    await context.close();
  }

  /* ---------------- T17 persistence / corruption ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: '{"goal": 999, "operation": "x", "voice": 3, ' });
    ok('T17 corrupted settings JSON: no crash, defaults used', page.__errors.length === 0 && (await page.textContent('#startInfo')).includes('3'));
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 7, operation: 'anywhere', voice: false, showNumber: false } });
    await startRun(page);
    ok('T17 saved settings are restored (goal 7, anywhere)', (await attr(page, 'data-goal')) === '7' && (await attr(page, 'data-op')) === 'anywhere');
    ok('T17 number display OFF hides the numerals', await page.isHidden('#countBox') && (await page.textContent('#reqNum')) === '');
    await page.click('#surface', { position: { x: 30, y: 200 } }); await landWait();
    ok('T17 voice OFF from storage: silent', (await speech(page)).length === 0 && (await harvested(page)) === 1);
    ok('T17 scan mode is never restored ON', await page.evaluate(() => document.querySelectorAll('.scan-focus').length === 0 && !document.body.classList.contains('scan-mode')));
    await context.close();
  }

  /* ---------------- T18 stale callbacks after restart ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    await startRun(page);
    await page.evaluate(() => {
      document.querySelector('.apple').click();
      document.getElementById('ringoSettingsBtn').click();
      document.getElementById('scOpen').click();
      document.getElementById('restartBtn').click();
    });
    await sleep(1600);
    ok('T18 restart during a flight: the old landing never touches the new run', (await harvested(page)) === 0 && (await phase(page)) === 'harvest' && (await page.locator('.apple[data-status="ripe"]').count()) === 3 && (await page.locator('.flyer').count()) === 0);
    await context.close();
  }

  /* ---------------- T20 no evaluative language anywhere ---------------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    let all = await page.evaluate(() => document.body.innerText);
    await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait(); await sleep(700);
    all += await page.evaluate(() => document.body.innerText);
    await page.click('#deliverBtn'); await sleep(1500);
    all += await page.evaluate(() => document.body.innerText);
    ok('T20 no praise / scoring / error words in any activity state', !/すごい|えらい|じょうず|よくできました|せいかい|正解|不正解|まちがい|ざんねん|てんすう|点数|スコア|はやい！/.test(all.replace('ひかる はやさ', '').replace(/はやい/g, '')), '');
    await context.close();
  }

  /* ---------------- final: errors ---------------- */
  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
