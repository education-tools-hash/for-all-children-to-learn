// Real-browser (Playwright / Chromium) test for the thank-you voice of ringo-potton-app.html
// (the farmer says "ありがとう！" once when the delivery is completed; the bubble shows it too).
// It is thanks for the child's delivery, not praise for a correct answer: one fixed phrase.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-thanks-voice-test.js
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
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, hasTouch: !!opts.touch, reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference' });
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

const THANKS = 'ありがとう！';
const thanksN = async (page) => (await spoken(page)).filter((t) => t === THANKS).length;
const bubbleVisibleText = (page) => page.evaluate(() => {
  const b = document.getElementById('bubble'); let t = '';
  b.querySelectorAll('span').forEach((s) => { if (!s.children.length && s.offsetParent !== null && getComputedStyle(s).display !== 'none') t += s.textContent; });
  return t.replace(/\s+/g, '');
});
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);
async function harvestAll(page, n, how) {
  await sleep(700);
  for (let i = 0; i < n; i++) {
    if (how === 'surface') await page.click('#surface', { position: { x: 30, y: 300 } });
    else await page.click('.apple[data-status="ripe"]');
    await landWait();
  }
  await sleep(700);   // complete-phase guard
}
const toCelebrate = (page) => page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- H1 goals 1 / 3 / 10: one thanks at delivery; bubble shows only "ありがとう！" ---------- */
  for (const g of [1, 3, 10]) {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: g } });
    await page.click('#startBtn');
    await harvestAll(page, g);
    ok('H1 goal ' + g + ': complete phase, no thanks yet', (await phase(page)) === 'complete' && (await thanksN(page)) === 0 && !(await visible(page, '#bubbleThanks')));
    await page.click('#deliverBtn'); await sleep(150);
    ok('H1 goal ' + g + ': while delivering, no thanks yet', (await thanksN(page)) === 0);
    await toCelebrate(page); await sleep(300);
    ok('H1 goal ' + g + ': exactly one "ありがとう！" after delivery', (await thanksN(page)) === 1, J(await spoken(page)));
    ok('H1 goal ' + g + ': bubble shows only "ありがとう！"', (await bubbleVisibleText(page)) === THANKS, await bubbleVisibleText(page));
    ok('H1 goal ' + g + ': request parts and pictures hidden while thanking', !(await visible(page, '#bubbleLead')) && !(await visible(page, '#reqNum')) && !(await visible(page, '#bubbleTail')) && !(await visible(page, '#reqPics')));
    ok('H1 goal ' + g + ': existing done note unchanged', (await page.textContent('#doneNote')) === g + 'こ、うけとりました。ありがとう。', await page.textContent('#doneNote'));
    const seq = await spoken(page);
    ok('H1 goal ' + g + ': order = request, counts 1..' + g + ', thanks', seq[0] === EXPECTED[g] && seq[seq.length - 1] === THANKS && seq.length === g + 2, J(seq));
    ok('H1 goal ' + g + ': no error', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- H2 duplicate deliver activations, redraw and rotation never repeat it ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.evaluate(() => { const b = document.getElementById('deliverBtn'); for (let i = 0; i < 6; i++) b.click(); });
    for (let i = 0; i < 10; i++) { await page.evaluate(() => document.getElementById('deliverBtn').click()); await sleep(80); }
    await toCelebrate(page); await sleep(300);
    ok('H2 deliver burst (6 in one tick + 10 more): one thanks', (await thanksN(page)) === 1, J(await spoken(page)));
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400);
    ok('H2 rotation / resize while thanking: still one thanks, bubble still "ありがとう！"', (await thanksN(page)) === 1 && (await bubbleVisibleText(page)) === THANKS);
    await context.close();
  }

  /* ---------- H3 again: thanks is cut, bubble back to the request, next delivery thanks once more ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(700);
    const before = (await raw(page)).length;
    await page.click('#againBtn'); await sleep(400);
    const after = (await raw(page)).slice(before);
    ok('H3 again: speech cancelled first, then the new request', after[0] === 'CANCEL' && after.filter((t) => t.trim() && t !== 'CANCEL').join() === EXPECTED[1], J(after));
    ok('H3 again: bubble back to the request ("りんごを1こ、とってね")', (await bubbleVisibleText(page)) === 'りんごを1こ、とってね' && !(await visible(page, '#bubbleThanks')), await bubbleVisibleText(page));
    await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H3 second delivery: thanks once more (2 in total)', (await thanksN(page)) === 2, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H4 restart from settings during celebrate ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    if (await page.isVisible('#settingsConfirm')) await page.click('#scOpen');
    await page.click('#restartBtn'); await sleep(400);
    ok('H4 restart: request bubble back, no extra thanks', (await phase(page)) === 'harvest' && (await bubbleVisibleText(page)) === 'りんごを1こ、とってね' && (await thanksN(page)) === 1, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H5 voice OFF: silent but the bubble still says "ありがとう！" ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, voice: false } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H5 voice OFF: nothing spoken at all', (await spoken(page)).length === 0, J(await spoken(page)));
    ok('H5 voice OFF: bubble still shows "ありがとう！"', (await bubbleVisibleText(page)) === THANKS);
    await context.close();
  }

  /* ---------- H6 voice OFF during the delivery flight: the thanks never plays ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn'); await harvestAll(page, 3);
    await page.evaluate(() => { document.getElementById('deliverBtn').click(); document.querySelector('[data-voice="0"]').click(); });
    await toCelebrate(page); await sleep(300);
    ok('H6 voice OFF during delivering: no thanks spoken, bubble shows it', (await thanksN(page)) === 0 && (await bubbleVisibleText(page)) === THANKS, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H7 voice ON -> OFF -> ON across activities ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, voice: false } });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(700);
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    if (await page.isVisible('#settingsConfirm')) await page.click('#scOpen');
    await page.click('[data-voice="1"]'); await page.click('#settingsClose'); await sleep(700);
    await page.click('#againBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H7 voice turned ON again: next delivery thanks once', (await thanksN(page)) === 1, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H8 anywhere mode: surface deliver, whole-screen again ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, operation: 'anywhere', againAnywhere: true } });
    await page.click('#startBtn'); await harvestAll(page, 2, 'surface');
    for (let i = 0; i < 5; i++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(40); }
    await toCelebrate(page); await sleep(300);
    ok('H8 anywhere: 5 surface taps on complete => one thanks', (await thanksN(page)) === 1 && (await bubbleVisibleText(page)) === THANKS, J(await spoken(page)));
    await sleep(500); await page.click('#surface', { position: { x: 30, y: 300 } }); await sleep(400);
    ok('H8 whole-screen again works after thanks', (await phase(page)) === 'harvest' && (await bubbleVisibleText(page)) === 'りんごを2こ、とってね');
    await context.close();
  }

  /* ---------- H9 keyboard ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await sleep(700);
    await page.focus('.apple[data-status="ripe"]'); await page.keyboard.press('Enter'); await landWait(); await sleep(700);
    ok('H9 keyboard: focus on deliver', (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'deliverBtn');
    await page.keyboard.press('Enter'); await toCelebrate(page); await sleep(300);
    ok('H9 keyboard Enter delivers: one thanks', (await thanksN(page)) === 1);
    await page.keyboard.down('Enter'); for (let i = 0; i < 5; i++) { await page.keyboard.down('Enter'); await sleep(150); } await page.keyboard.up('Enter'); await sleep(300);
    ok('H9 holding Enter afterwards: still one thanks', (await thanksN(page)) === 1, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H10 Switch Scan: deliver by one press, again stays operable ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1, scanSpeed: 'fast' } });
    await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy');
    await page.click('[data-scan-on="1"]'); await page.click('#settingsClose'); await sleep(500);
    await page.focus('#startBtn'); await page.keyboard.press('Enter'); await sleep(1200);
    await page.keyboard.press('Space'); await sleep(1900);
    ok('H10 scan: harvested 1, complete, deliver is the scan target', (await phase(page)) === 'complete' && await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'deliverBtn'));
    await page.keyboard.press('Space'); await toCelebrate(page); await sleep(300);
    ok('H10 scan: one press delivers, one thanks', (await thanksN(page)) === 1, J(await spoken(page)));
    await sleep(500);
    ok('H10 scan: candidates during thanks = [again]; the thanks bubble is not a candidate', await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id).join() === 'againBtn'));
    await page.keyboard.press('Space'); await sleep(500);
    ok('H10 scan: one press on again restarts', (await phase(page)) === 'harvest');
    await context.close();
  }

  /* ---------- H11 reduced motion (no flight): one thanks ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, reducedMotion: true });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H11 reduced motion: one thanks, bubble shows it', (await thanksN(page)) === 1 && (await bubbleVisibleText(page)) === THANKS, J(await spoken(page)));
    await context.close();
  }

  /* ---------- H12 speed / count of operations never changes the thanks ---------- */
  {
    const texts = [];
    for (const fast of [false, true]) {
      const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
      await page.click('#startBtn');
      if (fast) {
        const t0 = Date.now();
        while ((await phase(page)) !== 'complete' && Date.now() - t0 < 6000) { await page.evaluate(() => document.querySelectorAll('.apple').forEach((a) => a.click())); await sleep(50); }
        await sleep(700);
        for (let i = 0; i < 5; i++) { await page.evaluate(() => document.getElementById('deliverBtn').click()); await sleep(30); }
      } else {
        await sleep(3000); await harvestAll(page, 3); await sleep(2000); await page.click('#deliverBtn');
      }
      await toCelebrate(page); await sleep(300);
      texts.push(J([(await spoken(page)).filter((t) => t === THANKS), await bubbleVisibleText(page), await page.textContent('#doneNote')]));
      await context.close();
    }
    ok('H12 slow vs rapid activity: identical thanks speech, bubble and note', texts[0] === texts[1], texts.join(' vs '));
  }

  /* ---------- H13 no speech API / speak() throws: activity continues, bubble shows thanks ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 }, noSpeech: true });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H13 no speech API: celebrate, bubble "ありがとう！", no error', (await bubbleVisibleText(page)) === THANKS && page.__errors.length === 0, page.__errors.join('|'));
    await sleep(400);   // past the 600ms celebrate guard
    await page.click('#againBtn'); await sleep(400);
    ok('H13 no speech API: again works', (await phase(page)) === 'harvest');
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.evaluate(() => { window.__spThrow = true; });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H13 speak() throws: celebrate reached, no error', (await phase(page)) === 'celebrate' && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- H14 number display OFF: request still says the number; thanks unchanged ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4, showNumber: false } });
    await page.click('#startBtn'); await sleep(300);
    ok('H14 showNumber OFF: request voice still says the number', J(await requests(page)) === J([EXPECTED[4]]), J(await spoken(page)));
    await harvestAll(page, 4);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('H14 showNumber OFF: thanks once, bubble "ありがとう！", note without number', (await thanksN(page)) === 1 && (await bubbleVisibleText(page)) === THANKS && (await page.textContent('#doneNote')) === 'うけとりました。ありがとう。');
    await context.close();
  }

  /* ---------- H15 VoiceOver-related: no new live text, bubble is not a live region ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(400);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('H15 live regions: only the existing "2こ、うけとりました。ありがとう。" (no extra "ありがとう！")', !/ありがとう！/.test(live) && /2こ、うけとりました。ありがとう。/.test(live), live);
    ok('H15 bubble / thanks text are not live regions', await page.evaluate(() => { const b = document.getElementById('bubble'); return !b.closest('[aria-live]') && !b.querySelector('[aria-live]') && !b.getAttribute('role'); }));
    ok('H15 thanks text is not focusable', await page.evaluate(() => document.getElementById('bubbleThanks').tabIndex === -1 && !document.getElementById('bubbleThanks').closest('button')));
    ok('H15 thanks wording has no praise / scoring words', !/すごい|えらい|じょうず|よくできました|せいかい|正解|はやい|てんすう|スコア/.test(await page.textContent('#bubbleThanks')));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
