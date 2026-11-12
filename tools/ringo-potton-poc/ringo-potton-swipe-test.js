// Real-browser (Playwright / Chromium) test for「なでて とる（スワイプ）」of ringo-potton-app.html
// (Phase RINGO-POTTON-SWIPE-1). settings.swipe (default OFF) is a sub-option of「がめんの どこでも タッチ」:
// when ON, a pointer stroke on #surface counts once it has moved 24px from where it went down (before the
// finger lifts), any direction, and runs the surface's usual phase routing exactly once per pointer. Taps keep
// working. OFF (and the apple-touch operation) behave exactly as before.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-swipe-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// Touch strokes are synthesised with CDP Input.dispatchTouchEvent (touch emulation on), so Chromium turns them
// into real pointer / touch events and applies its own tap-vs-move click rules; mouse strokes use page.mouse.
// SCOPE / HONESTY: Chromium on Linux with stubbed speechSynthesis / HTMLAudioElement. It proves what the app
// does with the browser's events; it is NOT an iPad Safari, real-finger, VoiceOver or Bluetooth-switch result.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB } = require('./ringo-potton-voice-stubs.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
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

const ANYWHERE_ON = { goal: 3, operation: 'anywhere', swipe: true };
async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || { width: 834, height: 1194 }, hasTouch: true, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(AUDIO_STUB);
  await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { if (v !== null) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: opts.settings === undefined ? null : (typeof opts.settings === 'string' ? opts.settings : JSON.stringify(opts.settings)) });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(opts.base + '/ringo-potton-app.html');
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp };
}
const attr = (page, a) => page.getAttribute('#app', a);
const harvested = async (page) => parseInt(await attr(page, 'data-harvested'), 10);
const phase = (page) => attr(page, 'data-phase');
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
async function touch(cdp, type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id || 0 })) }); }
// a one-finger stroke: touchStart at from, `steps` touchMoves towards to (stepMs apart), then touchEnd unless hold
async function stroke(cdp, from, to, steps, opts) {
  opts = opts || {};
  await touch(cdp, 'touchStart', [from]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(cdp, 'touchMove', [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }]);
    await sleep(opts.stepMs || 15);
  }
  if (!opts.hold) await touch(cdp, 'touchEnd', []);
}
const A = { x: 300, y: 600 };   // on the surface, away from every common chrome button and the bottom-left record pill
const EVAL_RE = /すごい|えらい|じょうず|よくできました|せいかい|正解|不正解|まちがい|ざんねん|てんすう|点数|スコア/;

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const base = { base: BASE };

  /* ---------------- W0 structure / defaults / CSS ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    const s = await page.evaluate(() => {
      const row = document.getElementById('rowSwipe');
      return { rowHidden: row.hidden, note: row.querySelector('.note').textContent, buttons: row.querySelectorAll('[data-swipe]').length,
        dataSwipe: document.getElementById('app').getAttribute('data-swipe'), ta: getComputedStyle(document.getElementById('surface')).touchAction,
        saved: localStorage.getItem('donomana-ringo-potton-settings-v1') };
    });
    ok('W0 settings row「なでて とる（スワイプ）」exists with ON/OFF and the agreed note, hidden while operation = apple', s.rowHidden && s.buttons === 2 && s.note === 'ONにすると、がめんを なでたり はらったり する うごきでも、りんごを 1つ とれます。タッチも そのまま つかえます。', JSON.stringify(s));
    ok('W0 fresh device: data-swipe 0 and the surface keeps touch-action manipulation', s.dataSwipe === '0' && s.ta === 'manipulation', JSON.stringify(s));
    ok('W0 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W1 OFF: a stroke does nothing (as before) ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'anywhere' } }, base));
    await startRun(page);
    ok('W1 anywhere, swipe absent in saved data -> OFF: data-swipe 0, touch-action manipulation', (await attr(page, 'data-swipe')) === '0' && (await page.evaluate(() => getComputedStyle(document.getElementById('surface')).touchAction)) === 'manipulation');
    await stroke(cdp, A, { x: A.x + 80, y: A.y }, 6); await sleep(500);
    ok('W1 OFF: an 80px touch stroke harvests nothing', (await harvested(page)) === 0, String(await harvested(page)));
    await page.touchscreen.tap(A.x, A.y); await sleep(500);
    ok('W1 OFF: a tap still harvests 1', (await harvested(page)) === 1);
    ok('W1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W2 ON: 60px stroke -> one apple, before the finger lifts ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    ok('W2 ON: data-swipe 1 and the surface has touch-action none', (await attr(page, 'data-swipe')) === '1' && (await page.evaluate(() => getComputedStyle(document.getElementById('surface')).touchAction)) === 'none');
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6, { hold: true }); await sleep(150);
    ok('W2 ON: 60px stroke harvests 1 while the finger is still down', (await harvested(page)) === 1, String(await harvested(page)));
    await touch(cdp, 'touchEnd', []); await sleep(500);
    ok('W2 ON: lifting the finger adds nothing (still 1: no click double-fire)', (await harvested(page)) === 1, String(await harvested(page)));
    // 23px stroke: not a swipe; the browser treats it as a (moved) tap or nothing, never two
    await stroke(cdp, A, { x: A.x + 20, y: A.y }, 4); await sleep(500);
    ok('W2 ON: a 20px stroke is below the threshold (harvests 0 or 1 as a tap, never a second apple from the move)', (await harvested(page)) <= 2, String(await harvested(page)));
    ok('W2 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W3 ON: one long stroke that keeps going after the apple landed -> still one ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    await stroke(cdp, { x: 120, y: 500 }, { x: 700, y: 900 }, 30, { stepMs: 35 });   // ~1 s stroke, 700px, well past LAND_GUARD (350 ms)
    await sleep(500);
    ok('W3 ON: a 700px / 1 s stroke harvests exactly 1', (await harvested(page)) === 1, String(await harvested(page)));
    // a second, separate stroke takes the second apple
    await stroke(cdp, A, { x: A.x - 80, y: A.y + 10 }, 6); await sleep(500);
    ok('W3 ON: the next stroke (any direction) takes the next apple (2)', (await harvested(page)) === 2);
    ok('W3 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W4 ON: mouse drag (click fires on mouseup) -> no double; tap-like short press -> 1 ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    await page.mouse.move(A.x, A.y); await page.mouse.down();
    await page.mouse.move(A.x + 80, A.y, { steps: 6 }); await sleep(100);
    ok('W4 ON: mouse drag of 80px harvests 1 before the button is released', (await harvested(page)) === 1, String(await harvested(page)));
    await page.mouse.up(); await sleep(500);
    ok('W4 ON: the click the browser fires on mouseup is suppressed (still 1)', (await harvested(page)) === 1, String(await harvested(page)));
    await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(A.x + 8, A.y + 4, { steps: 2 }); await page.mouse.up(); await sleep(500);
    ok('W4 ON: a short press with 9px of wobble is a tap: harvests 1 more (2)', (await harvested(page)) === 2, String(await harvested(page)));
    ok('W4 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W5 ON: taps keep working; W6 two fingers at once -> one ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: { goal: 5, operation: 'anywhere', swipe: true } }, base));
    await startRun(page);
    await page.touchscreen.tap(A.x, A.y); await sleep(500);
    ok('W5 ON: a plain tap harvests 1', (await harvested(page)) === 1, String(await harvested(page)));
    // two fingers down together, both move 60px, both lift
    await touch(cdp, 'touchStart', [{ x: 250, y: 600, id: 0 }, { x: 450, y: 700, id: 1 }]);
    for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', [{ x: 250 + 10 * i, y: 600, id: 0 }, { x: 450 + 10 * i, y: 700, id: 1 }]); await sleep(15); }
    await touch(cdp, 'touchEnd', []); await sleep(600);
    ok('W6 ON: two fingers stroking together harvest exactly 1 more (2), the second pointer is refused by the guards', (await harvested(page)) === 2, String(await harvested(page)));
    ok('W6 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W7 ON: phase routing — complete -> deliver, celebrate -> again (only with againAnywhere) ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'anywhere', swipe: true, againAnywhere: false } }, base));
    await startRun(page);
    // one long stroke: the apple is taken, the activity completes, the SAME stroke keeps going for 900 ms
    await stroke(cdp, { x: 150, y: 500 }, { x: 650, y: 800 }, 30, { stepMs: 30 }); await sleep(300);
    ok('W7 ON: the stroke that completed the activity does not run on into「とどける」(phase complete)', (await phase(page)) === 'complete', await phase(page));
    await sleep(400);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
    ok('W7 ON: a new stroke on complete delivers (celebrate)', (await phase(page)) === 'celebrate');
    await sleep(700);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(500);
    ok('W7 ON: againAnywhere OFF: a stroke on celebrate does nothing (still celebrate)', (await phase(page)) === 'celebrate');
    ok('W7 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'anywhere', swipe: true, againAnywhere: true } }, base));
    await startRun(page);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(700);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
    await sleep(700);
    await stroke(cdp, A, { x: A.x - 60, y: A.y }, 6); await sleep(700);
    ok('W7 ON: againAnywhere ON: a stroke on celebrate starts the next activity (harvest, 0 harvested)', (await phase(page)) === 'harvest' && (await harvested(page)) === 0, (await phase(page)) + '/' + (await harvested(page)));
    ok('W7 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W8 ON: the existing guards apply to strokes ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await page.click('#startBtn'); await sleep(100);                 // inside PHASE_GUARD (600 ms)
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(300);
    ok('W8 ON: a stroke within 600 ms of「はじめる」is ignored (0)', (await harvested(page)) === 0, String(await harvested(page)));
    await sleep(500);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(500);
    ok('W8 ON: after the guard the stroke counts (1)', (await harvested(page)) === 1);
    await page.click('#donomanaHelpBtn'); await sleep(300);           // help open: the stage is inert
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(400);
    ok('W8 ON: a stroke while the help sheet is open is ignored (still 1)', (await harvested(page)) === 1, String(await harvested(page)));
    await page.keyboard.press('Escape'); await sleep(600);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(500);
    ok('W8 ON: after closing the help the stroke counts again (2)', (await harvested(page)) === 2, String(await harvested(page)));
    ok('W8 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W9 ON: keyboard / scan paths untouched ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    const items = await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id));
    ok('W9 ON: scan candidates on harvest are still exactly [surface]', items.join(',') === 'surface', items.join(','));
    await page.focus('#surface'); await page.keyboard.press('Enter'); await sleep(500);
    ok('W9 ON: Enter on the surface harvests 1 (keyboard click, detail 0)', (await harvested(page)) === 1, String(await harvested(page)));
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6);                 // consumed stroke ...
    await page.evaluate(() => document.getElementById('surface').click());   // ... immediately followed by a click() (switch / VoiceOver path, detail 0)
    await sleep(500);
    ok('W9 ON: a click() right after a stroke is NOT suppressed as a gesture: it is only held by the landing guard (2 or 3, never 1)', (await harvested(page)) >= 2, String(await harvested(page)));
    ok('W9 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W10 settings: row visibility, aria-pressed, saving, sanitize, pending note ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple', swipe: 'yes' } }, base));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    // (#app carries data-swipe too, like data-op: the settings buttons are addressed inside #rowSwipe)
    const s0 = await page.evaluate(() => ({ hidden: document.getElementById('rowSwipe').hidden, pressed: Array.from(document.querySelectorAll('#rowSwipe [data-swipe]')).map((b) => b.getAttribute('data-swipe') + ':' + b.getAttribute('aria-pressed')).join(' ') }));
    ok('W10 operation apple: the swipe row is hidden; a non-boolean saved value sanitises to OFF', s0.hidden && s0.pressed === '1:false 0:true', JSON.stringify(s0));
    await page.click('[data-op="anywhere"]'); await sleep(150);
    ok('W10 choosing「どこでも タッチ」reveals the swipe row (and the again row)', await page.evaluate(() => !document.getElementById('rowSwipe').hidden && !document.getElementById('rowAgain').hidden));
    await page.click('#rowSwipe [data-swipe="1"]'); await sleep(150);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('donomana-ringo-potton-settings-v1')));
    ok('W10 ON saved as a boolean (operation stays the 2-valued anywhere)', saved.swipe === true && saved.operation === 'anywhere', JSON.stringify(saved));
    ok('W10 aria-pressed follows (ON pressed)', (await page.getAttribute('#rowSwipe [data-swipe="1"]', 'aria-pressed')) === 'true' && (await page.getAttribute('#rowSwipe [data-swipe="0"]', 'aria-pressed')) === 'false');
    await page.click('[data-op="apple"]'); await sleep(150);
    ok('W10 back to りんごを タッチ: the row hides again but the saved choice is kept', await page.evaluate(() => document.getElementById('rowSwipe').hidden && JSON.parse(localStorage.getItem('donomana-ringo-potton-settings-v1')).swipe === true));
    await page.click('[data-op="anywhere"]'); await page.click('#rowSwipe [data-swipe="0"]'); await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700);
    ok('W10 activity started with swipe OFF: data-swipe 0', (await attr(page, 'data-swipe')) === '0');
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150); await page.click('#scOpen'); await sleep(200);
    await page.click('#rowSwipe [data-swipe="1"]'); await sleep(150);
    ok('W10 switching ON mid-activity shows the「つぎの かつどうから」note and does not change the current activity', await page.evaluate(() => !document.getElementById('pendingNote').hidden && document.getElementById('app').getAttribute('data-swipe') === '0'));
    await page.click('#restartBtn'); await sleep(700);
    ok('W10 the next activity applies it: data-swipe 1', (await attr(page, 'data-swipe')) === '1');
    ok('W10 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W11 ON: the request voice is cut by the stroke like by a tap ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    const before = await page.evaluate(() => ({ plays: window.__au.filter((o) => o.op === 'play' && !o.muted && /ringo-3\.mp3/.test(o.src)).length, pauses: window.__au.filter((o) => o.op === 'pause' && /ringo-3\.mp3/.test(o.src)).length }));
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(300);
    const after = await page.evaluate(() => ({ pauses: window.__au.filter((o) => o.op === 'pause' && /ringo-3\.mp3/.test(o.src)).length, spoken: window.__sp.filter((t) => t !== 'CANCEL' && t.trim()).join('|') }));
    ok('W11 ON: the request file was playing (1 audible play) and the stroke pauses it, then the count is spoken', before.plays === 1 && after.pauses > before.pauses && /いち/.test(after.spoken), JSON.stringify({ before, after }));
    ok('W11 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W12 ON: the page does not scroll under a stroke ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: ANYWHERE_ON }, base));
    await startRun(page);
    await page.evaluate(() => { document.body.style.minHeight = '4000px'; });   // make the page scrollable on purpose
    await stroke(cdp, { x: 300, y: 900 }, { x: 300, y: 300 }, 12, { stepMs: 20 }); await sleep(500);
    const sc = await page.evaluate(() => ({ y: window.scrollY, h: parseInt(document.getElementById('app').getAttribute('data-harvested'), 10) }));
    ok('W12 ON: an upward 600px stroke harvests 1 and the page stays at scrollY 0 (touch-action none)', sc.h === 1 && sc.y === 0, JSON.stringify(sc));
    ok('W12 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- W13 learning record carries swipe as a fact ---------------- */
  {
    const { context, page, cdp } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'anywhere', swipe: true } }, base));
    await startRun(page);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6); await sleep(700);
    await stroke(cdp, A, { x: A.x + 60, y: A.y }, 6);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
    await sleep(300);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('ringo_potton_log') || 'null'));
    ok('W13 one record with payload.swipe true, schemaVersion still 1, the 10 keys (incl. decoys / refusals since the decoy Phase)', Array.isArray(log) && log.length === 1 && log[0].payload.swipe === true && log[0].schemaVersion === 1 && Object.keys(log[0].payload).sort().join(',') === 'decoys,durationSec,goal,goalMode,harvested,operation,refusals,showNumber,swipe,switchScan', JSON.stringify(log));
    await context.close();
  }

  /* ---------------- W14 wording ---------------- */
  {
    const { context, page } = await newPage(browser, base);
    const t = await page.evaluate(() => ({ settings: document.getElementById('settingsSheet').textContent, help: document.getElementById('helpSheet').textContent }));
    ok('W14 help explains the stroke option (same wording as the settings note)', /なでて とる（スワイプ）/.test(t.help) && /なでたり はらったり する うごきでも りんごを 1つ とれます/.test(t.help) && /タッチも そのまま つかえます/.test(t.help));
    ok('W14 no praise / scoring / error words in the settings sheet or the new help text', !EVAL_RE.test(t.settings.replace('ひかる はやさ', '')) && !EVAL_RE.test(t.help.replace('点数・時間・正解や まちがいは ありません', '')));
    ok('W14 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
