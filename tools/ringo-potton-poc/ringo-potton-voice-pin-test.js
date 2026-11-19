// Real-browser (Playwright / Chromium) test for the PINNED synthesised voice of ringo-potton-app.html
// (Phase RINGO-POTTON-VOICE-PIN-1).
//
// The counting voice (いち, に, ...), the decoy names (バナナ / みかん) and the fallbacks of the recorded files are spoken
// by the browser's speech engine. The app used to pick "the first ja-JP voice of getVoices()" anew for every
// utterance, so the voice changed when the engine's list went from empty to loaded or changed its order. Now one voice
// is decided as soon as a list is there -- (1) a ja-JP voice marked `default`, else (2) the first ja-JP voice -- and
// kept (by voiceURI, else name + lang). While the list is empty no voice is named (engine default) and nothing is
// decided; a decided voice that leaves a non-empty list is decided again by the same rule.
// Unchanged and checked here too: lang ja-JP, rate 0.8, cancel() + 60 ms before every utterance, the silent unlock.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-voice-pin-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with a recording speechSynthesis (SPEECH_VOICE_STUB) and the stubbed
// HTMLAudioElement. It proves which voice / rate / lang the app ASKS the engine for under controlled voice lists.
// It is NOT an iPad Safari result: which voices an iPad lists, in which order, which one it marks default and how
// they sound can only be checked on the device.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SPEECH_VOICE_STUB, AUDIO_STUB } = require('./ringo-potton-voice-stubs.js');

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

// synthetic voices (names are made up; no real engine voice is implied)
const V = (name, lang, o) => Object.assign({ name, lang, voiceURI: 'uri:' + name, default: false, localService: true }, o || {});
const A = V('JaVoiceA', 'ja-JP'), B = V('JaVoiceB', 'ja-JP'), C = V('JaVoiceC', 'ja-JP'), EN = V('EnVoice', 'en-US');
const def = (v) => Object.assign({}, v, { default: true });

async function newPage(browser, base, o) {
  o = o || {};
  const context = await browser.newContext({ viewport: { width: 834, height: 1194 }, reducedMotion: 'reduce' });
  // stub options first (the stubs read them when they install themselves)
  await context.addInitScript((c) => { window.__voices = c.voices; if (typeof c.lazy === 'number') window.__lazyVoicesMs = c.lazy; if (c.noVc) window.__noVcEvents = true; if (typeof c.spEnd === 'number') window.__spEndMs = c.spEnd; }, { voices: o.voices || [], lazy: o.lazy, noVc: !!o.noVc, spEnd: o.spEnd });
  await context.addInitScript(SPEECH_VOICE_STUB);
  await context.addInitScript(AUDIO_STUB);
  await context.addInitScript((c) => { if (c.auFail) window.__auFail = true; window.__auDur = { okotowari: 900 }; }, { auFail: !!o.auFail });
  await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { if (v) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: o.settings ? J(o.settings) : null });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(base + '/ringo-potton-app.html'); await sleep(250);
  return { context, page };
}
const vlog = (page) => page.evaluate(() => window.__vlog.slice());
const mark = (page) => page.evaluate(() => window.__vlog.length);
const since = async (page, n) => (await vlog(page)).slice(n);
const said = (l) => l.filter((e) => e.op === 'speak' && e.volume > 0 && e.text.trim() !== '');   // audible utterances
const voices = (l) => said(l).map((e) => e.voice);
const brief = (l) => said(l).map((e) => e.text + '=' + e.voice);
const setVoices = (page, list, fireEvent) => page.evaluate(({ list, fireEvent }) => { window.__voices = list; if (fireEvent) window.__fireVoicesChanged(); }, { list, fireEvent: fireEvent !== false });
async function waitPhase(page, ph, t) { await page.waitForFunction((x) => document.getElementById('app').getAttribute('data-phase') === x, ph, { timeout: t || 15000 }); }
// take the next ripe fruit of a kind as soon as the app accepts it; resolves when it has landed (count or tray changed)
async function take(page, kind) {
  await page.evaluate((k) => new Promise((res, rej) => {
    const app = document.getElementById('app');
    const key = () => app.getAttribute('data-harvested') + '/' + document.querySelectorAll('#decoyTray svg').length;
    const k0 = key(), t0 = performance.now();
    const iv = setInterval(() => {
      if (key() !== k0) { clearInterval(iv); return res(); }
      if (performance.now() - t0 > 10000) { clearInterval(iv); return rej(new Error('take(' + k + ') timed out in phase ' + app.getAttribute('data-phase'))); }
      const b = document.querySelector('#appleGrid .apple[data-kind="' + k + '"][data-status="ripe"]'); if (b) b.click();
    }, 15);
  }), kind);
  await sleep(120);   // the utterance is handed to the engine 60 ms after the landing
}
async function start(page) { await page.click('#startBtn'); await sleep(700); }
async function harvest(page, goal, banana) { if (banana) await take(page, 'banana'); for (let i = 0; i < goal; i++) await take(page, 'apple'); await waitPhase(page, 'complete'); }
async function deliver(page) { await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click()); }
async function finish(page) { await deliver(page); await waitPhase(page, 'celebrate'); await sleep(700); }
async function again(page) { await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(800); }
async function openSettings(page) {
  await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
  if (await page.evaluate(() => document.getElementById('settingsSheet').hidden)) { await page.evaluate(() => document.getElementById('scOpen').click()); await sleep(150); }
}
async function setting(page, sel) { await page.evaluate((s) => { const el = document.querySelector('#settingsSheet ' + s); if (!el) throw new Error('no control ' + s); el.click(); }, sel); await sleep(100); }
async function closeSettings(page) { await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550); }

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------------- P1 the rule: a ja-JP voice marked default, else the first ja-JP voice ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [def(EN), A, def(B), C], settings: { goal: 2 } });
    const atLoad = await vlog(page);
    ok('P1 at load the page asks for the voice list once and listens for voiceschanged (nothing is spoken)', atLoad.some((e) => e.op === 'getVoices') && !atLoad.some((e) => e.op === 'speak') && (await page.evaluate(() => window.__vcListeners)) >= 1, J(atLoad.map((e) => e.op)));
    await start(page); await harvest(page, 2);
    ok('P1 [en(default), A, B(default), C]: counting uses B -- the ja-JP default, not the first ja-JP voice and not a non-Japanese default', J(voices(await vlog(page))) === J(['JaVoiceB', 'JaVoiceB']), J(brief(await vlog(page))));
    await context.close();
    const p2 = await newPage(browser, BASE, { voices: [EN, A, B, C], settings: { goal: 2 } });
    await start(p2.page); await harvest(p2.page, 2);
    ok('P1 [en, A, B, C] with no default mark: the first ja-JP voice (A), as before', J(voices(await vlog(p2.page))) === J(['JaVoiceA', 'JaVoiceA']), J(brief(await vlog(p2.page))));
    await p2.context.close();
    const p3 = await newPage(browser, BASE, { voices: [EN, V('OnlyJa', 'ja'), V('Underscore', 'ja_JP'), A], settings: { goal: 1 } });
    await start(p3.page); await harvest(p3.page, 1);
    ok('P1 lang matching as before: "ja_JP" counts as ja-JP, a bare "ja" does not', J(voices(await vlog(p3.page))) === J(['Underscore']), J(brief(await vlog(p3.page))));
    await p3.context.close();
    const p4 = await newPage(browser, BASE, { voices: [def(EN), V('OnlyJa', 'ja')], settings: { goal: 1 } });
    await start(p4.page); await harvest(p4.page, 1);
    const l4 = said(await vlog(p4.page));
    ok('P1 a list without any ja-JP voice: no voice is named (never the English default), still spoken as ja-JP', l4.length === 1 && l4[0].voice === null && l4[0].lang === 'ja-JP' && l4[0].text === 'いち', J(l4));
    await p4.context.close();
  }

  /* ---------------- P2 (1) the list is empty at first and arrives later ---------------- */
  {
    // engines that load lazily: the list appears 400 ms after the first getVoices() call. The page asks at load, so
    // the voice is decided before the first counting word (before this Phase:「いち」default,「に」「さん」first voice).
    const { context, page } = await newPage(browser, BASE, { voices: [EN, B, A], lazy: 400, settings: { goal: 3 } });
    await sleep(500);
    await start(page); await harvest(page, 3);
    ok('P2a lazy list (ready 400 ms after the first request): all three counting words use the same voice (B)', J(voices(await vlog(page))) === J(['JaVoiceB', 'JaVoiceB', 'JaVoiceB']), J(brief(await vlog(page))));
    await context.close();
  }
  {
    // the list arrives in the middle of an activity
    const { context, page } = await newPage(browser, BASE, { voices: [], settings: { goal: 3 } });
    await start(page); await take(page, 'apple');
    const first = said(await vlog(page));
    ok('P2b list still empty:「いち」names no voice (engine default), lang ja-JP, rate 0.8', first.length === 1 && first[0].voice === null && first[0].lang === 'ja-JP' && first[0].rate === 0.8, J(first));
    await setVoices(page, [EN, B, def(A), C]);            // voices become available now (voiceschanged)
    await take(page, 'apple'); await take(page, 'apple'); await waitPhase(page, 'complete');
    ok('P2b after the list arrived:「に」「さん」use the decided voice (A, the ja-JP default)', J(voices(await vlog(page))) === J([null, 'JaVoiceA', 'JaVoiceA']), J(brief(await vlog(page))));
    await finish(page);
    for (let k = 0; k < 2; k++) { await again(page); await harvest(page, 3); await finish(page); }
    const all = voices(await vlog(page)).slice(1);
    ok('P2b two more activities: every later counting word keeps that voice (' + all.length + ' utterances)', all.length === 8 && all.every((v) => v === 'JaVoiceA'), J(all));
    ok('P2b no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // the list arrives but the engine never reports it (no voiceschanged): the next utterance decides
    const { context, page } = await newPage(browser, BASE, { voices: [], settings: { goal: 3 } });
    await start(page); await take(page, 'apple');
    await setVoices(page, [B, A], false);
    await take(page, 'apple'); await take(page, 'apple');
    ok('P2c list arrives without a voiceschanged event: decided at the next utterance and kept (null, B, B)', J(voices(await vlog(page))) === J([null, 'JaVoiceB', 'JaVoiceB']), J(brief(await vlog(page))));
    await context.close();
  }

  /* ---------------- P3 (2) the list changes its order / its default mark: the decided voice stays ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [A, B, EN], settings: { goal: 2 } });
    await start(page); await harvest(page, 2); await finish(page);
    await setVoices(page, [B, A, EN]);
    await again(page); await harvest(page, 2); await finish(page);
    await setVoices(page, [EN, def(B), C, A]);            // B is now first AND marked default; A moved to the end
    await again(page); await take(page, 'apple');
    await setVoices(page, [C, B, A], false);              // reordered again in the middle of the activity, no event
    await take(page, 'apple');
    const v = voices(await vlog(page));
    ok('P3 decided on A; list reordered, B made default, reordered mid-activity: all 6 counting words stay on A', v.length === 6 && v.every((x) => x === 'JaVoiceA'), J(v));
    await context.close();
    // identity is the voiceURI: two voices with the same name and lang are still told apart
    const K1 = V('SameName', 'ja-JP', { voiceURI: 'uri:compact' }), K2 = V('SameName', 'ja-JP', { voiceURI: 'uri:enhanced' });
    const p2 = await newPage(browser, BASE, { voices: [K1, K2], settings: { goal: 2 } });
    await start(p2.page); await take(p2.page, 'apple');
    await setVoices(p2.page, [K2, K1]);
    await take(p2.page, 'apple');
    const u = said(await vlog(p2.page)).map((e) => e.uri);
    ok('P3 same name, different voiceURI: the decided one (uri:compact) is kept after a reorder', J(u) === J(['uri:compact', 'uri:compact']), J(u));
    await p2.context.close();
    // no voiceURI at all: name + lang identify the voice
    const N1 = { name: 'NoUriA', lang: 'ja-JP', default: false }, N2 = { name: 'NoUriB', lang: 'ja-JP', default: false };
    const p3 = await newPage(browser, BASE, { voices: [N1, N2], settings: { goal: 2 } });
    await start(p3.page); await take(p3.page, 'apple');
    await setVoices(p3.page, [N2, N1]);
    await take(p3.page, 'apple');
    ok('P3 voices without a voiceURI: kept by name + lang after a reorder', J(voices(await vlog(p3.page))) === J(['NoUriA', 'NoUriA']), J(brief(await vlog(p3.page))));
    await p3.context.close();
  }

  /* ---------------- P4 (3) the decided voice leaves the list: decided again by the same rule ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [A, B, C], settings: { goal: 2 } });
    await start(page); await harvest(page, 2); await finish(page);                      // A, A
    await setVoices(page, [EN, B, def(C)]);                                             // A is gone; C is the ja-JP default
    await again(page); await harvest(page, 2); await finish(page);                      // C, C
    await setVoices(page, [A, B, C]);                                                   // A is back, nothing marked default
    await again(page); await harvest(page, 2); await finish(page);                      // still C (the new decision is kept)
    await setVoices(page, [A, B]);                                                      // C is gone, no default -> first ja-JP
    await again(page); await harvest(page, 2); await finish(page);                      // A, A
    const v = voices(await vlog(page));
    ok('P4 A decided; A removed -> the ja-JP default C; A returns -> still C; C removed -> the first ja-JP voice A', J(v) === J(['JaVoiceA', 'JaVoiceA', 'JaVoiceC', 'JaVoiceC', 'JaVoiceC', 'JaVoiceC', 'JaVoiceA', 'JaVoiceA']), J(v));
    // the list is empty for a moment: no voice can be named, but the decision is not thrown away
    await setVoices(page, []);
    await again(page); await take(page, 'apple');
    await setVoices(page, [B, A]);
    await take(page, 'apple'); await waitPhase(page, 'complete'); await finish(page);
    const w = voices(await vlog(page)).slice(8);
    ok('P4 list empty for a moment (no voice named), then back with A second: A again, not the now-first B', J(w) === J([null, 'JaVoiceA']), J(w));
    // only non-Japanese voices are left: nothing to decide; a Japanese voice that appears later is decided then
    await setVoices(page, [EN]);
    await again(page); await take(page, 'apple');
    await setVoices(page, [EN, C, B]);
    await take(page, 'apple');
    const x = voices(await vlog(page)).slice(10);
    ok('P4 no ja-JP voice left -> no voice named; ja-JP voices appear again -> decided anew by the rule (C, the first)', J(x) === J([null, 'JaVoiceC']), J(x));
    ok('P4 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- P5 (4) the list stays empty for good: no voice named, everything is spoken as before ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [], settings: { goal: 3, dummy: true } });
    await start(page); await harvest(page, 3, true); await sleep(200);
    const l = said(await vlog(page));
    ok('P5 empty list:「バナナ」「いち」「に」「さん」are all spoken, no voice named, lang ja-JP, rate 0.8', J(l.map((e) => e.text)) === J(['バナナ', 'いち', 'に', 'さん']) && l.every((e) => e.voice === null && e.lang === 'ja-JP' && e.rate === 0.8), J(l));
    ok('P5 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    // an engine without voiceschanged support at all: decided at the first utterance, kept afterwards
    const p2 = await newPage(browser, BASE, { voices: [B, A], noVc: true, settings: { goal: 2 } });
    ok('P5 engine without addEventListener / onvoiceschanged: the page loads without error', p2.page.__errors.length === 0 && (await p2.page.evaluate(() => window.__vcListeners)) === 0, p2.page.__errors.join('|'));
    await start(p2.page); await take(p2.page, 'apple');
    await setVoices(p2.page, [A, B], false);
    await take(p2.page, 'apple');
    ok('P5 ... and the voice is still decided once and kept (B, B after a reorder)', J(voices(await vlog(p2.page))) === J(['JaVoiceB', 'JaVoiceB']), J(brief(await vlog(p2.page))));
    await p2.context.close();
  }

  /* ---------------- P6 (5) settings changes never change the decided voice ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [EN, A, B], settings: { goal: 2 } });
    await start(page); await harvest(page, 2); await finish(page);
    const steps = [
      { name: 'うごきの はやさ=とても ゆっくり -> ダミー ON', clicks: ['[data-move-speed="veryslow"]', '[data-dummy="1"]'], banana: true },
      { name: 'ダミー OFF -> どこでも タッチ -> スワイプ ON -> ゆっくり', clicks: ['[data-dummy="0"]', '[data-op="anywhere"]', '[data-swipe="1"]', '[data-move-speed="slow"]'], anywhere: true },
      { name: 'スワイプ OFF -> りんごを タッチ -> ダミー ON -> ふつう', clicks: ['[data-swipe="0"]', '[data-op="apple"]', '[data-dummy="1"]', '[data-move-speed="normal"]'], banana: true },
      { name: 'すうじ OFF -> こえ OFF -> こえ ON -> ランダム -> ダミー OFF', clicks: ['[data-num="0"]', '[data-voice="0"]', '[data-voice="1"]', '#goalRandomBtn', '[data-goal-min="2"]', '[data-goal-max="2"]', '[data-dummy="0"]'] }
    ];
    for (const st of steps) {
      await openSettings(page);
      const n = await mark(page);
      for (const c of st.clicks) await setting(page, c);
      const inSheet = (await since(page, n)).filter((e) => e.op !== 'cancel');
      await closeSettings(page);
      await setVoices(page, st.banana ? [B, EN, A] : [EN, A, B], false);              // and the list order moves under it as well
      const m = await mark(page);
      await again(page);
      if (st.anywhere) { for (let i = 0; i < 2; i++) { const h0 = await page.getAttribute('#app', 'data-harvested'); for (let k = 0; k < 40 && (await page.getAttribute('#app', 'data-harvested')) === h0; k++) { await page.mouse.move(300, 600); await page.mouse.down(); await page.mouse.move(420, 600, { steps: 6 }); await page.mouse.up(); await sleep(150); } } await waitPhase(page, 'complete'); await sleep(150); }
      else await harvest(page, 2, st.banana);
      const l = said(await since(page, m));
      const want = st.banana ? ['バナナ', 'いち', 'に'] : ['いち', 'に'];
      ok('P6 after ' + st.name + ': ' + want.join(' ') + ' in the decided voice A (rate 0.8, ja-JP); the sheet itself asks the engine for nothing', J(l.map((e) => e.text)) === J(want) && l.every((e) => e.voice === 'JaVoiceA' && e.rate === 0.8 && e.lang === 'ja-JP' && e.pitch === 1 && e.volume === 1) && inSheet.length === 0, J(brief(l)) + ' sheet=' + J(inSheet.map((e) => e.op)));
      if (st.banana) {   // the refusal (recorded file) and the same request again, then apples only
        await deliver(page); await waitPhase(page, 'harvest', 20000); await sleep(500);
        const k = await mark(page);
        await harvest(page, 2);
        ok('P6 ... and after the refusal the counting voice is still A', J(voices(await since(page, k))) === J(['JaVoiceA', 'JaVoiceA']), J(brief(await since(page, k))));
      }
      await finish(page);
    }
    ok('P6 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- P7 the fallbacks of the recorded files use the same decided voice ---------------- */
  {
    // every play() of a recorded file is rejected, so the request, the refusal and the thanks are all synthesised
    const { context, page } = await newPage(browser, BASE, { voices: [EN, B, def(A)], auFail: true, spEnd: 700, settings: { goal: 1, dummy: true } });
    await start(page); await harvest(page, 1, true);
    await deliver(page); await waitPhase(page, 'harvest', 20000); await sleep(500);
    await harvest(page, 1); await finish(page);
    const l = said(await vlog(page));
    const texts = l.map((e) => e.text);
    ok('P7 files blocked: request, fruit name, count, refusal, request again, count, thanks are all synthesised', J(texts) === J(['りんごを いっこ、とってね', 'バナナ', 'いち', 'あれ？ りんごじゃないのが あるみたい。りんごだけ、もういちど おねがいね', 'りんごを いっこ、とってね', 'いち', 'ありがとう！']), J(texts));
    ok('P7 ... every one of them in the decided voice (A, the ja-JP default), rate 0.8, lang ja-JP', l.every((e) => e.voice === 'JaVoiceA' && e.rate === 0.8 && e.lang === 'ja-JP'), J(brief(l)));
    ok('P7 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- P8 what must not change: the silent unlock, cancel + 60 ms, voice OFF ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { voices: [A, B], settings: { goal: 3 } });
    const n = await mark(page);
    await page.click('#startBtn'); await sleep(300);
    const st = (await since(page, n)).filter((e) => e.op === 'speak');
    ok('P8「はじめる」: one silent unlock utterance as before (text " ", volume 0, lang ja-JP, no voice named)', st.length === 1 && st[0].text === ' ' && st[0].volume === 0 && st[0].lang === 'ja-JP' && st[0].voice === null, J(st));
    await sleep(400); await harvest(page, 3);
    const l = await vlog(page);
    const gaps = l.map((e, i) => (e.op === 'speak' && e.volume > 0) ? (() => { for (let k = i - 1; k >= 0; k--) if (l[k].op === 'cancel') return e.t - l[k].t; return -1; })() : null).filter((g) => g !== null);
    ok('P8 each counting word is handed over about 60 ms after a cancel() (' + gaps.map((g) => Math.round(g)).join(', ') + ' ms)', gaps.length === 3 && gaps.every((g) => g >= 55 && g < 200), J(gaps));
    ok('P8 rate 0.8, pitch 1, volume 1, lang ja-JP on every counting word', said(l).every((e) => e.rate === 0.8 && e.pitch === 1 && e.volume === 1 && e.lang === 'ja-JP'), J(said(l)));
    await finish(page);
    await openSettings(page); await setting(page, '[data-voice="0"]'); await closeSettings(page);
    const m = await mark(page);
    await again(page); await harvest(page, 3);
    ok('P8 こえ OFF: nothing is handed to the speech engine', (await since(page, m)).filter((e) => e.op === 'speak').length === 0, J(await since(page, m)));
    ok('P8 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
