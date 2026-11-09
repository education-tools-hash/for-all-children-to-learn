// Real-browser (Playwright / Chromium) test for the farmer's THANKS of ringo-potton-app.html.
// Since the voice-files Phase the thanks is a recorded file, assets/ringo-potton/voice/arigatou.mp3, played
// once on the delivering -> celebrate transition; the bubble shows「ありがとう！」too. If the file cannot play,
// the app falls back to the synthesised「ありがとう！」(candidate B). The thanks is gratitude for the delivery,
// not praise for a correct answer: one fixed phrase.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-thanks-voice-test.js
//
// SCOPE / HONESTY: Chromium on Linux with stubbed HTMLAudioElement / speechSynthesis
// (tools/ringo-potton-poc/ringo-potton-voice-stubs.js). Not an iPad Safari or real-audio result.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB, NO_AUDIO_STUB, base } = require('./ringo-potton-voice-stubs');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const THANKS = 'ありがとう！';
const TFILE = 'arigatou.mp3';
const FILE = (g) => 'ringo-' + g + '.mp3';

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
  await context.addInitScript(opts.noAudio ? NO_AUDIO_STUB : AUDIO_STUB);
  if (opts.auFail) await context.addInitScript(() => { window.__auFail = true; });
  if (opts.auErrorSrc) await context.addInitScript((s) => { window.__auErrorSrc = s; }, opts.auErrorSrc);
  if (opts.settings !== undefined) {
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
const phase = (page) => attr(page, 'data-phase');
const au = (page) => page.evaluate(() => (window.__au || []).slice());
const plays = async (page) => (await au(page)).filter((e) => e.op === 'play' && !e.muted).map((e) => base(e.src));
const thanksPlays = async (page) => (await plays(page)).filter((f) => f === TFILE).length;
const spoken = (page) => page.evaluate(() => (window.__sp || []).filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const synthThanks = async (page) => (await spoken(page)).filter((t) => t === THANKS).length;
const bubbleVisibleText = (page) => page.evaluate(() => {
  const b = document.getElementById('bubble'); let t = '';
  b.querySelectorAll('span').forEach((s) => { if (!s.children.length && s.offsetParent !== null && getComputedStyle(s).display !== 'none') t += s.textContent; });
  return t.replace(/\s+/g, '');
});
const landWait = () => sleep(1100);
async function harvestAll(page, n, how) {
  await sleep(700);
  for (let i = 0; i < n; i++) {
    if (how === 'surface') await page.click('#surface', { position: { x: 30, y: 300 } });
    else await page.click('.apple[data-status="ripe"]');
    await landWait();
  }
  await sleep(700);
}
const toCelebrate = (page) => page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
async function openSettings(page) {
  await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await sleep(150);
  if (await page.isVisible('#settingsConfirm')) { await page.click('#scOpen'); await sleep(150); }
}

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- F1 goals 1 / 3 / 10: one play of arigatou.mp3 exactly at the celebrate transition; bubble; order ---------- */
  for (const g of [1, 3, 10]) {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: g } });
    await page.click('#startBtn');
    await harvestAll(page, g);
    ok('F1 goal ' + g + ': complete phase, arigatou not played yet', (await phase(page)) === 'complete' && (await thanksPlays(page)) === 0 && !(await page.isVisible('#bubbleThanks')));
    await page.click('#deliverBtn'); await sleep(150);
    ok('F1 goal ' + g + ': while delivering, not played yet', (await thanksPlays(page)) === 0);
    await toCelebrate(page); await sleep(300);
    ok('F1 goal ' + g + ': exactly one audible play of arigatou.mp3 after the delivery', (await thanksPlays(page)) === 1, J(await plays(page)));
    ok('F1 goal ' + g + ': no synthesised thanks (the file played)', (await synthThanks(page)) === 0, J(await spoken(page)));
    ok('F1 goal ' + g + ': bubble shows only「ありがとう！」', (await bubbleVisibleText(page)) === THANKS, await bubbleVisibleText(page));
    const files = await plays(page); const cnt = (await spoken(page)).filter((t) => t !== THANKS && !/とってね$/.test(t));
    ok('F1 goal ' + g + ': files = [request, thanks]; synthesised = counts 1..' + g, J(files) === J([FILE(g), TFILE]) && cnt.length === g, J(files) + ' ' + J(cnt));
    ok('F1 goal ' + g + ': existing done note unchanged', (await page.textContent('#doneNote')) === g + 'こ、うけとりました。ありがとう。');
    ok('F1 goal ' + g + ': no error', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- F2 deliver burst, redraw and rotation never replay the thanks ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.evaluate(() => { const b = document.getElementById('deliverBtn'); for (let i = 0; i < 6; i++) b.click(); });
    for (let i = 0; i < 10; i++) { await page.evaluate(() => document.getElementById('deliverBtn').click()); await sleep(80); }
    await toCelebrate(page); await sleep(300);
    ok('F2 deliver burst: one thanks play', (await thanksPlays(page)) === 1, J(await plays(page)));
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    ok('F2 rotation while thanking: still one play, bubble still「ありがとう！」', (await thanksPlays(page)) === 1 && (await bubbleVisibleText(page)) === THANKS);
    await context.close();
  }

  /* ---------- F3 again: the thanks file is paused, then the new request plays; the next delivery thanks again ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(700);
    const before = (await au(page)).length;
    await page.click('#againBtn'); await sleep(400);
    const after = (await au(page)).slice(before);
    const pi = after.findIndex((e) => e.op === 'pause' && base(e.src) === TFILE), ri = after.findIndex((e) => e.op === 'play' && !e.muted && base(e.src) === FILE(1));
    ok('F3 again: arigatou paused first, then ringo-1 played', pi !== -1 && ri !== -1 && pi < ri, J(after));
    ok('F3 again: bubble back to the request', !(await page.isVisible('#bubbleThanks')));
    await harvestAll(page, 1); await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('F3 second delivery: thanks played once more (2 in total)', (await thanksPlays(page)) === 2, J(await plays(page)));
    await context.close();
  }

  /* ---------- F4 voice OFF: no play at all, bubble still shows the thanks ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, voice: false } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('F4 voice OFF: no play (audible or muted), nothing synthesised', (await au(page)).filter((e) => e.op === 'play').length === 0 && (await spoken(page)).length === 0, J(await au(page)));
    ok('F4 voice OFF: bubble still shows「ありがとう！」', (await bubbleVisibleText(page)) === THANKS);
    await context.close();
  }

  /* ---------- F5 voice turned OFF during the delivery flight: the thanks is not played; ON again: played next time ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn'); await harvestAll(page, 3);
    await page.evaluate(() => { document.getElementById('deliverBtn').click(); document.querySelector('[data-voice="0"]').click(); });
    await toCelebrate(page); await sleep(300);
    ok('F5 voice OFF during delivering: no thanks play, bubble shows it', (await thanksPlays(page)) === 0 && (await synthThanks(page)) === 0 && (await bubbleVisibleText(page)) === THANKS, J(await plays(page)));
    await openSettings(page); await page.click('[data-voice="1"]'); await page.click('#settingsClose'); await sleep(700);
    await page.click('#againBtn'); await harvestAll(page, 3); await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('F5 voice ON again: next delivery plays the thanks once', (await thanksPlays(page)) === 1, J(await plays(page)));
    await context.close();
  }

  /* ---------- F6 anywhere mode: surface deliver, whole-screen again ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, operation: 'anywhere', againAnywhere: true } });
    await page.click('#startBtn'); await harvestAll(page, 2, 'surface');
    for (let i = 0; i < 5; i++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(40); }
    await toCelebrate(page); await sleep(300);
    ok('F6 anywhere: 5 surface taps on complete => one thanks play', (await thanksPlays(page)) === 1, J(await plays(page)));
    await sleep(500); await page.click('#surface', { position: { x: 30, y: 300 } }); await sleep(400);
    ok('F6 whole-screen again: new request file plays after the thanks', (await phase(page)) === 'harvest' && (await plays(page)).slice(-1)[0] === FILE(2), J(await plays(page)));
    await context.close();
  }

  /* ---------- F7 speed / count of operations never changes the thanks ---------- */
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
      texts.push(J([(await plays(page)).filter((f) => f === TFILE), await bubbleVisibleText(page), await page.textContent('#doneNote')]));
      await context.close();
    }
    ok('F7 slow vs rapid activity: identical thanks play, bubble and note', texts[0] === texts[1], texts.join(' vs '));
  }

  /* ---------- F8 fallback B: play() rejected -> synthesised「ありがとう！」 ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 }, auFail: true });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(400);
    ok('F8 play() rejected: file attempted, then exactly one synthesised「ありがとう！」', (await thanksPlays(page)) === 1 && (await synthThanks(page)) === 1, J(await plays(page)) + ' ' + J(await spoken(page)));
    ok('F8 progression unaffected, no error', (await phase(page)) === 'celebrate' && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- F9 fallback B: arigatou never loaded (.error) -> synthesised without a play attempt ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 }, auErrorSrc: 'arigatou' });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(400);
    ok('F9 load error on arigatou: no audible play, synthesised thanks once; request file unaffected', (await thanksPlays(page)) === 0 && (await synthThanks(page)) === 1 && J(await plays(page)) === J([FILE(1)]), J(await plays(page)) + ' ' + J(await spoken(page)));
    await context.close();
  }

  /* ---------- F10 no Audio API: synthesised thanks, cycle works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 }, noAudio: true });
    await page.click('#startBtn'); await harvestAll(page, 1);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(400);
    ok('F10 no Audio API: synthesised「ありがとう！」once, bubble shows it, no error', (await synthThanks(page)) === 1 && (await bubbleVisibleText(page)) === THANKS && page.__errors.length === 0, page.__errors.join('|'));
    await sleep(400); await page.click('#againBtn'); await sleep(400);
    ok('F10 no Audio API: again works', (await phase(page)) === 'harvest');
    await context.close();
  }

  /* ---------- F11 reduced motion (no flight): one thanks play ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, reducedMotion: true });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(300);
    ok('F11 reduced motion: one thanks play', (await thanksPlays(page)) === 1, J(await plays(page)));
    await context.close();
  }

  /* ---------- F12 live regions / wording ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 } });
    await page.click('#startBtn'); await harvestAll(page, 2);
    await page.click('#deliverBtn'); await toCelebrate(page); await sleep(400);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('F12 live regions: only the existing "2こ、うけとりました。ありがとう。"', !/ありがとう！/.test(live) && /2こ、うけとりました。ありがとう。/.test(live), live);
    ok('F12 thanks wording has no praise / scoring words', !/すごい|えらい|じょうず|よくできました|せいかい|正解|はやい|てんすう|スコア/.test(await page.textContent('#bubbleThanks')));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
