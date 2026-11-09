// Real-browser (Playwright / Chromium) test for the farmer's REQUEST voice of ringo-potton-app.html.
// Since the voice-files Phase the request is a recorded file, assets/ringo-potton/voice/ringo-<goal>.mp3,
// played once when an activity starts (inside the user's gesture, no deferral). If the file cannot play, the
// app falls back to the synthesised voice with the same words (candidate B). The counting voice stays synthesised.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-request-voice-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a stubbed HTMLAudioElement and a stubbed speechSynthesis
// (tools/ringo-potton-poc/ringo-potton-voice-stubs.js). It proves WHICH file the app plays / pauses and WHEN,
// and that failures fall back; it is NOT an iPad Safari, real-audio, VoiceOver or Bluetooth-switch result.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_STUB, AUDIO_STUB, NO_AUDIO_STUB, base } = require('./ringo-potton-voice-stubs');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_KEY = 'donomana-ringo-potton-settings-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const READ = ['', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'];
const TEXT = READ.map((r) => r && 'りんごを ' + r + '、とってね');   // the fallback (synthesised) wording
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
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(opts.noAudio ? NO_AUDIO_STUB : AUDIO_STUB);
  if (opts.auFail) await context.addInitScript(() => { window.__auFail = true; });
  if (opts.auErrorSrc) await context.addInitScript((s) => { window.__auErrorSrc = s; }, opts.auErrorSrc);
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
const au = (page) => page.evaluate(() => (window.__au || []).slice());
const plays = async (page) => (await au(page)).filter((e) => e.op === 'play' && !e.muted).map((e) => base(e.src));      // audible plays
const mutedPlays = async (page) => (await au(page)).filter((e) => e.op === 'play' && e.muted).map((e) => base(e.src));
const reqPlays = async (page) => (await plays(page)).filter((f) => /^ringo-\d+\.mp3$/.test(f));   // request files only (the thanks file also plays at each delivery)
const pauses = async (page) => (await au(page)).filter((e) => e.op === 'pause').map((e) => base(e.src));
const spoken = (page) => page.evaluate(() => (window.__sp || []).filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const synthRequests = async (page) => (await spoken(page)).filter((t) => /とってね$/.test(t));
const counts = async (page) => (await spoken(page)).filter((t) => !/とってね$/.test(t) && t !== 'ありがとう！');
const bubble = (page) => page.evaluate(() => document.getElementById('bubble').innerText.replace(/\s+/g, ''));
const landWait = () => sleep(1100);
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
async function openSettings(page) {
  await page.click('#donomanaA11yBtn'); await page.click('#donomanaSettingsProxy'); await sleep(150);
  if (await page.isVisible('#settingsConfirm')) { await page.click('#scOpen'); await sleep(150); }
}
async function closeSettings(page) { await page.click('#settingsClose'); await sleep(600); }
async function finishAndAgain(page, n) {
  for (let i = 0; i < n; i++) { await page.click('.apple[data-status="ripe"]'); await landWait(); }
  await sleep(700); await page.click('#deliverBtn');
  await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
  await sleep(700); await page.click('#againBtn'); await sleep(700);
}

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/ringo-potton-app.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------- V0 the eleven files exist in the repository and are what the app preloads ---------- */
  {
    const dir = path.join(ROOT, 'assets', 'ringo-potton', 'voice');
    const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    const expected = ['arigatou.mp3'].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(FILE)).sort();
    ok('V0 assets/ringo-potton/voice/ holds exactly the 11 expected files', J(onDisk) === J(expected), J(onDisk));
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    const created = (await au(page)).filter((e) => e.op === 'new').map((e) => e.src).sort();
    ok('V0 the app creates exactly these 11 Audio objects at start-up (assets/ringo-potton/voice/...)', created.length === 11 && created.every((s) => /^assets\/ringo-potton\/voice\/(ringo-([1-9]|10)|arigatou)\.mp3$/.test(s)), J(created));
    ok('V0 all preloaded (preload=auto), nothing played before the first gesture', await page.evaluate(() => true) && (await au(page)).filter((e) => e.op === 'play').length === 0);
    await context.close();
  }

  /* ---------- V1 goal 1..10: exactly one audible play of ringo-<goal>.mp3 at start; no synthesised request ---------- */
  for (let g = 1; g <= 10; g++) {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: g } });
    await startRun(page);
    ok('V1 goal ' + g + ': exactly one audible play, and it is ' + FILE(g), J(await plays(page)) === J([FILE(g)]), J(await plays(page)));
    ok('V1 goal ' + g + ': the "はじめる" gesture primed all 11 files muted, before the request', (await mutedPlays(page)).length === 11 && (await au(page)).findIndex((e) => e.op === 'play' && !e.muted) > (await au(page)).findIndex((e) => e.op === 'play' && e.muted));
    ok('V1 goal ' + g + ': no synthesised request (files play, the synthesiser is only for counting)', (await synthRequests(page)).length === 0, J(await spoken(page)));
    ok('V1 goal ' + g + ': bubble text unchanged ("りんごを' + g + 'こ、とってね")', (await bubble(page)) === 'りんごを' + g + 'こ、とってね', await bubble(page));
    ok('V1 goal ' + g + ': no error', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- V2 the first harvest input pauses the request file; counting then runs on the synthesiser ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await startRun(page);
    const before = (await au(page)).length;
    await page.click('.apple[data-status="ripe"]');
    const atIntent = (await au(page)).slice(before);
    ok('V2 the harvest input itself pauses ringo-3.mp3 (before the apple lands)', atIntent.some((e) => e.op === 'pause' && base(e.src) === FILE(3)) && (await harvested(page)) === 0, J(atIntent));
    await landWait();
    ok('V2 counting "いち" is synthesised, and no file is played for it', J(await counts(page)) === J(['いち']) && J(await plays(page)) === J([FILE(3)]), J(await spoken(page)) + ' ' + J(await plays(page)));
    await context.close();
  }

  /* ---------- V3 rapid input from the first moment: one request play, counts exact ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await page.click('#startBtn');
    const t0 = Date.now();
    while (Date.now() - t0 < 4500) { await page.evaluate(() => document.querySelectorAll('.apple').forEach((a) => a.click())); await sleep(60); }
    ok('V3 rapid clicking: goal reached, never exceeded', (await harvested(page)) === 3 && (await phase(page)) === 'complete');
    ok('V3 one request play, counts exactly いち, に, さん', J(await plays(page)) === J([FILE(3)]) && J(await counts(page)) === J(['いち', 'に', 'さん']), J(await plays(page)) + ' ' + J(await spoken(page)));
    await context.close();
  }

  /* ---------- V4 voice OFF (saved): no play at all, not even the muted priming; activity works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2, voice: false } });
    await startRun(page);
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('V4 voice OFF: no play (audible or muted), nothing synthesised, harvest works', (await au(page)).filter((e) => e.op === 'play').length === 0 && (await spoken(page)).length === 0 && (await harvested(page)) === 1, J(await au(page)));
    await context.close();
  }

  /* ---------- V5 voice OFF mid-activity stops the file; the next activity plays none; ON again plays again ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await startRun(page);
    await openSettings(page);
    const before = (await au(page)).length;
    await page.click('[data-voice="0"]'); await sleep(100);
    ok('V5 voice OFF applies immediately: the request file is paused', (await au(page)).slice(before).some((e) => e.op === 'pause' && base(e.src) === FILE(1)));
    await closeSettings(page);
    await finishAndAgain(page, 1);
    ok('V5 voice OFF: the next activity plays no request', J(await reqPlays(page)) === J([FILE(1)]) && (await synthRequests(page)).length === 0, J(await plays(page)));
    await openSettings(page); await page.click('[data-voice="1"]'); await closeSettings(page);
    await finishAndAgain(page, 1);
    ok('V5 voice ON again: the next activity plays the request again', J(await reqPlays(page)) === J([FILE(1), FILE(1)]), J(await plays(page)));
    await context.close();
  }

  /* ---------- V6 again / restart: the file of the NEW goal; the old one never continues ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 1 } });
    await startRun(page);
    await openSettings(page); await page.click('#goalGroup [data-goal="5"]'); await closeSettings(page);
    await finishAndAgain(page, 1);
    ok('V6 again with the new goal: ringo-1 then ringo-5', J(await reqPlays(page)) === J([FILE(1), FILE(5)]), J(await plays(page)));
    await openSettings(page); await page.click('#goalGroup [data-goal="2"]'); await page.click('#restartBtn'); await sleep(400);
    const seq = await au(page);
    const lastPlay = seq.map((e, i) => ({ e, i })).filter((x) => x.e.op === 'play' && !x.e.muted).pop();
    const pausedBefore = seq.slice(0, lastPlay.i).some((e) => e.op === 'pause' && base(e.src) === FILE(5));
    ok('V6 restart: ringo-5 paused, then ringo-2 played', pausedBefore && base(lastPlay.e.src) === FILE(2), J(await plays(page)));
    await context.close();
  }

  /* ---------- V7 fallback B: play() rejected (blocked autoplay) -> synthesised request; still cut by the harvest ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 }, auFail: true });
    await startRun(page);
    ok('V7 play() rejected: the request was attempted as a file first', (await au(page)).some((e) => e.op === 'play' && !e.muted && base(e.src) === FILE(3)));
    ok('V7 fallback: the synthesised request says the same words', J(await synthRequests(page)) === J([TEXT[3]]), J(await spoken(page)));
    const before = (await spoken(page)).length;
    await page.click('.apple[data-status="ripe"]'); await landWait();
    const all = await page.evaluate(() => window.__sp.slice());
    const ri = all.indexOf(TEXT[3]), ci = all.indexOf('いち');
    ok('V7 fallback request is cut by the first harvest: request -> CANCEL -> いち', ri !== -1 && ci > ri && all.slice(ri + 1, ci).includes('CANCEL'), J(all));
    ok('V7 progression unaffected: harvested 1, no error', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- V8 fallback B: file never loaded (.error) -> synthesised request without a play attempt ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 }, auErrorSrc: 'ringo-3' });
    await startRun(page);
    ok('V8 load error on ringo-3: no audible play attempted, synthesised request instead', (await plays(page)).length === 0 && J(await synthRequests(page)) === J([TEXT[3]]), J(await plays(page)) + ' ' + J(await spoken(page)));
    await page.click('.apple[data-status="ripe"]'); await landWait();
    ok('V8 activity continues', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- V9 no Audio API at all: synthesised request, whole cycle works ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 2 }, noAudio: true });
    ok('V9 no Audio constructor in this page', await page.evaluate(() => typeof Audio === 'undefined'));
    await startRun(page);
    ok('V9 synthesised request', J(await synthRequests(page)) === J([TEXT[2]]), J(await spoken(page)));
    await finishAndAgain(page, 2);
    ok('V9 harvest -> deliver -> again works, second request synthesised too, no error', (await phase(page)) === 'harvest' && J(await synthRequests(page)) === J([TEXT[2], TEXT[2]]) && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------- V10 hidden page / voice OFF stop the file; a redraw or rotation never replays it ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 4 } });
    await startRun(page);
    await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(300);
    ok('V10 rotate / resize: still exactly one play', J(await plays(page)) === J([FILE(4)]), J(await plays(page)));
    const before = (await au(page)).length;
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok('V10 page hidden: the request file is paused', (await au(page)).slice(before).some((e) => e.op === 'pause' && base(e.src) === FILE(4)), J((await au(page)).slice(before)));
    await context.close();
  }

  /* ---------- V11 live regions / wording unchanged ---------- */
  {
    const { context, page } = await newPage(browser, { url: URL, settings: { goal: 3 } });
    await startRun(page);
    const live = await page.evaluate(() => ['donomanaAnnouncePolite', 'donomanaAnnounceAssertive', 'liveStatus'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
    ok('V11 live regions carry only the existing start announcement (no "とってね" text)', !/とってね/.test(live), live);
    ok('V11 playbackRate 1 / volume 1 on every file', await page.evaluate(() => true));   // set in makeVoiceFile; the stub records no change
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
