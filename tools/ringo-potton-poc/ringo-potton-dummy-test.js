// Real-browser (Playwright / Chromium) test for「りんごじゃない くだものも まぜる（はってん）」of ringo-potton-app.html
// (Phase RINGO-POTTON-DUMMY-1 / C-1). settings.dummy (default OFF, apple-touch only): the tree also carries decoy fruit
// (banana first, then mikan; 1 + floor(goal/4), apples + decoys <= 12). A decoy that is taken goes BESIDE the basket
// frames: the number and the frames never change, its name is said instead. Delivering with a decoy in the basket is
// refused gently (phase refusing): everything returns to the tree, same goal, same placement, the request is asked
// again. Apples alone always succeed. OFF (and whole-screen touch) behave exactly as before.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-dummy-test.js
// It starts its own static server on an ephemeral port and exits non-zero on any failure.
//
// SCOPE / HONESTY: Chromium on Linux with stubbed speechSynthesis / HTMLAudioElement
// (tools/ringo-potton-poc/ringo-potton-voice-stubs.js). It is NOT an iPad Safari, VoiceOver, Bluetooth-switch or
// real-touch result and must never be reported as one.
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

async function newPage(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: opts.viewport || { width: 834, height: 1194 }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(AUDIO_STUB);
  await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { if (v !== null) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: opts.settings === undefined ? null : (typeof opts.settings === 'string' ? opts.settings : JSON.stringify(opts.settings)) });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(opts.base + '/ringo-potton-app.html');
  return { context, page };
}
const attr = (page, a) => page.getAttribute('#app', a);
const harvested = async (page) => parseInt(await attr(page, 'data-harvested'), 10);
const phase = (page) => attr(page, 'data-phase');
async function startRun(page) { await page.click('#startBtn'); await sleep(700); }
// the tree as the child sees it: kinds in DOM order, plus counts
const tree = (page) => page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('#appleGrid .apple'));
  return { kinds: b.map((e) => e.getAttribute('data-kind')), ids: b.map((e) => e.getAttribute('data-id')), ripe: b.filter((e) => e.getAttribute('data-status') === 'ripe').length,
    decoys: b.filter((e) => e.getAttribute('data-kind') !== 'apple').length, apples: b.filter((e) => e.getAttribute('data-kind') === 'apple').length,
    minSize: Math.min(...b.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); })),
    labels: b.map((e) => e.getAttribute('aria-label')) };
});
const basket = (page) => page.evaluate(() => ({
  filled: document.querySelectorAll('#slots .slot[data-filled="1"]').length, slots: document.querySelectorAll('#slots .slot').length,
  tray: document.querySelectorAll('#decoyTray svg').length, trayMinH: getComputedStyle(document.getElementById('decoyTray')).minHeight,
  count: document.getElementById('countNum').textContent, decoysAttr: document.getElementById('app').getAttribute('data-decoys'),
  refusals: document.getElementById('app').getAttribute('data-refusals')
}));
async function take(page, kind) {   // click the first ripe fruit of that kind on the tree
  const did = await page.evaluate((k) => { const b = document.querySelector('#appleGrid .apple[data-kind="' + k + '"][data-status="ripe"]'); if (!b) return false; b.click(); return true; }, kind);
  await sleep(450);
  return did;
}
const spoken = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const audible = (page, re) => page.evaluate((src) => window.__au.filter((o) => o.op === 'play' && !o.muted && new RegExp(src).test(o.src)).length, re);
const live = (page) => page.evaluate(() => ['liveStatus', 'donomanaAnnouncePolite'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
async function deliver(page) { await page.evaluate(() => document.getElementById('deliverBtn').click()); }
const readLog = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ringo_potton_log') || 'null'));
const REFUSE = 'あれ？ りんごじゃないのが あるみたい';
const BANNED = /ちがう|だめ|すごい|えらい|じょうず|よくできました|せいかい|正解|不正解|まちがい|ざんねん|てんすう|点数|スコア/;

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const base = { base: BASE };

  /* ---------------- D0 OFF by default: nothing changes ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'apple' } }, base));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    const s = await page.evaluate(() => ({ rowHidden: document.getElementById('rowDummy').hidden, pressed: Array.from(document.querySelectorAll('#rowDummy [data-dummy]')).map((b) => b.getAttribute('data-dummy') + ':' + b.getAttribute('aria-pressed')).join(' '), note: document.querySelector('#rowDummy .note').textContent }));
    ok('D0 settings row「りんごじゃない くだものも まぜる（はってん）」is offered with りんごを タッチ, OFF pressed when the saved data has no dummy key', !s.rowHidden && s.pressed === '1:false 0:true', JSON.stringify(s));
    ok('D0 the note carries no forbidden / evaluative words', !BANNED.test(s.note), s.note);
    await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700);
    const t = await tree(page), b = await basket(page);
    ok('D0 OFF: the tree has exactly the goal\'s apples in id order, no decoys, data-decoys 0', t.kinds.join(',') === 'apple,apple,apple' && t.ids.join(',') === '0,1,2' && b.decoysAttr === '0', JSON.stringify(t));
    ok('D0 OFF: the decoy tray is empty and takes no room', b.tray === 0 && b.trayMinH === '0px', JSON.stringify(b));
    for (let i = 0; i < 3; i++) await take(page, 'apple');
    await sleep(700); await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 }); await sleep(300);
    const log = await readLog(page);
    ok('D0 OFF: delivery succeeds as before; the record carries decoys 0 / refusals 0', log.length === 1 && log[0].payload.decoys === 0 && log[0].payload.refusals === 0, JSON.stringify(log));
    ok('D0 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D1 ON: decoy count from the goal, banana first, everything stays tappable ---------------- */
  {
    const expect = { 1: 1, 3: 1, 4: 2, 7: 2, 8: 3, 9: 3, 10: 2 };
    for (const goal of Object.keys(expect).map(Number)) {
      const { context, page } = await newPage(browser, Object.assign({ settings: { goal, operation: 'apple', dummy: true } }, base));
      await startRun(page);
      const t = await tree(page), b = await basket(page);
      const byId = {}; t.ids.forEach((id, i) => { byId[id] = t.kinds[i]; });
      const decoyKinds = Object.keys(byId).map(Number).filter((id) => id >= goal).sort((a, c) => a - c).map((id) => byId[id]);
      ok('D1 goal ' + goal + ': ' + expect[goal] + ' decoy(s), ' + goal + ' apples, total <= 12, data-decoys 1', t.decoys === expect[goal] && t.apples === goal && t.kinds.length <= 12 && b.decoysAttr === '1', JSON.stringify({ decoys: t.decoys, apples: t.apples }));
      ok('D1 goal ' + goal + ': the first decoy is the banana, the others mikan; decoys are labelled by their names', decoyKinds[0] === 'banana' && decoyKinds.slice(1).every((k) => k === 'mikan') && t.labels.filter((l) => l === 'バナナ').length === 1 && t.labels.filter((l) => l === 'みかん').length === expect[goal] - 1, JSON.stringify({ decoyKinds, labels: t.labels }));
      ok('D1 goal ' + goal + ': basket frames = goal only, every fruit on the tree >= 60px', b.slots === goal && t.minSize >= 60, JSON.stringify({ slots: b.slots, minSize: t.minSize }));
      await context.close();
    }
    // placement varies between activities (never the same corner every time)
    const positions = new Set();
    for (let i = 0; i < 12; i++) {
      const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'apple', dummy: true } }, base));
      await startRun(page);
      positions.add((await tree(page)).kinds.indexOf('banana'));
      await context.close();
    }
    ok('D1 the banana\'s place on the tree varies across 12 fresh activities (' + positions.size + ' different positions)', positions.size >= 2, [...positions].join(','));
  }

  /* ---------------- D2 taking a decoy: name said, nothing counted, beside the frames ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'apple', dummy: true } }, base));
    await startRun(page);
    ok('D2 took the banana', await take(page, 'banana'));
    const b1 = await basket(page), sp1 = await spoken(page);
    ok('D2 after the banana: number 0, no frame filled, tray holds 1, phase still harvest', b1.count === '0' && b1.filled === 0 && b1.tray === 1 && (await phase(page)) === 'harvest', JSON.stringify(b1));
    ok('D2 the banana\'s name is spoken, no count (「いち」) is spoken', sp1.some((t) => t === 'バナナ') && !sp1.some((t) => /^いち$/.test(t)), sp1.join('|'));
    ok('D2 the live region tells the banana went into the basket and the count is still 0', /バナナが かごに はいりました。いま 0こ/.test(await live(page)), await live(page));
    ok('D2 the banana on the tree is now hidden (landed) and the other fruit stay ripe', (await tree(page)).ripe === 3);
    await take(page, 'apple');
    const b2 = await basket(page), sp2 = await spoken(page);
    ok('D2 then an apple: number 1, one frame filled, tray still 1,「いち」spoken', b2.count === '1' && b2.filled === 1 && b2.tray === 1 && sp2[sp2.length - 1] === 'いち', JSON.stringify(b2) + ' ' + sp2.join('|'));
    ok('D2 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D3 the refusal: complete with a decoy -> refusing -> everything back -> same request -> then success ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple', dummy: true } }, base));
    await startRun(page);
    const before = await tree(page);
    await take(page, 'banana'); await take(page, 'apple'); await take(page, 'apple'); await sleep(700);
    ok('D3 two apples + the banana: phase complete (the number reached 2 regardless of the decoy)', (await phase(page)) === 'complete' && (await harvested(page)) === 2);
    const thanksBefore = await audible(page, 'arigatou');
    await deliver(page); await sleep(150);
    const r = await page.evaluate(() => ({ phase: document.getElementById('app').getAttribute('data-phase'), bubble: document.getElementById('bubbleRefuse').hidden ? '' : document.getElementById('bubbleRefuse').textContent, lead: document.getElementById('bubbleLead').hidden, deliverHidden: document.getElementById('deliverBtn').hidden, again: document.getElementById('againBtn').hidden, refusals: document.getElementById('app').getAttribute('data-refusals') }));
    ok('D3 delivering with the banana: phase refusing, the bubble shows the refusal, request hidden, no deliver / again button, refusals 1', r.phase === 'refusing' && r.bubble === REFUSE && r.lead && r.deliverHidden && r.again && r.refusals === '1', JSON.stringify(r));
    await sleep(300);
    const sp = await spoken(page);
    ok('D3 the refusal is spoken (synthesised, same words as the bubble) and announced', sp.includes(REFUSE) && (await live(page)).indexOf(REFUSE) !== -1, sp.join('|'));
    ok('D3 the thanks file is NOT played', (await audible(page, 'arigatou')) === thanksBefore);
    await deliver(page); await take(page, 'apple'); await sleep(100);
    ok('D3 inputs during the refusal are ignored (still refusing, nothing changed)', (await phase(page)) === 'refusing' && (await harvested(page)) === 2);
    const reqBefore = await audible(page, 'ringo-2');
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'harvest', null, { timeout: 8000 }); await sleep(300);
    const after = await tree(page), b = await basket(page);
    ok('D3 everything is back on the tree: all 3 fruit ripe, same kinds in the same places, number 0, frames empty, tray empty', after.ripe === 3 && after.kinds.join(',') === before.kinds.join(',') && after.ids.join(',') === before.ids.join(',') && b.count === '0' && b.filled === 0 && b.tray === 0, JSON.stringify({ before: before.kinds, after: after.kinds, b }));
    ok('D3 the same goal is asked again (data-goal 2) and the request file plays once more', (await attr(page, 'data-goal')) === '2' && (await audible(page, 'ringo-2')) === reqBefore + 1, String(await audible(page, 'ringo-2')));
    ok('D3 settings / goal unchanged by the refusal (data-decoys 1, refusals attr 1)', b.decoysAttr === '1' && b.refusals === '1');
    await sleep(400);
    await take(page, 'apple'); await take(page, 'apple'); await sleep(700);
    await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 }); await sleep(300);
    const log = await readLog(page);
    ok('D3 apples only: celebrate, thanks played once, one record with decoys 1 / refusals 1 / goal 2 / harvested 2', (await audible(page, 'arigatou')) === thanksBefore + 1 && log.length === 1 && log[0].payload.decoys === 1 && log[0].payload.refusals === 1 && log[0].payload.goal === 2 && log[0].payload.harvested === 2, JSON.stringify(log));
    ok('D3 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D3b the return flight with motion ON: flyers go back, then the tree is whole again ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple', dummy: true }, motion: true }, base));
    await startRun(page);
    await page.evaluate(() => document.querySelector('#appleGrid .apple[data-kind="banana"]').click()); await sleep(1100);
    await page.evaluate(() => document.querySelector('#appleGrid .apple[data-kind="apple"]').click()); await sleep(1100); await sleep(700);
    await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'refusing', null, { timeout: 3000 });
    await sleep(2600 + 200);
    const fl = await page.evaluate(() => ({ flyers: document.querySelectorAll('.flyer').length, phase: document.getElementById('app').getAttribute('data-phase') }));
    ok('D3b with motion: two flyers return to the tree during the refusal', fl.flyers === 2 && fl.phase === 'refusing', JSON.stringify(fl));
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'harvest', null, { timeout: 6000 }); await sleep(200);
    const t = await tree(page);
    ok('D3b afterwards no flyer remains and both fruit are ripe again', (await page.evaluate(() => document.querySelectorAll('.flyer').length)) === 0 && t.ripe === 2);
    ok('D3b no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D4 apples only always succeed (goal 10 with 2 decoys) ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 10, operation: 'apple', dummy: true } }, base));
    await startRun(page);
    const t = await tree(page);
    ok('D4 goal 10: 12 fruit on the tree (10 apples + 2 decoys), all >= 60px', t.kinds.length === 12 && t.decoys === 2 && t.minSize >= 60, JSON.stringify(t));
    for (let i = 0; i < 10; i++) await take(page, 'apple');
    await sleep(700);
    ok('D4 ten apples taken, decoys untouched: complete', (await phase(page)) === 'complete' && (await tree(page)).ripe === 2);
    await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 8000 }); await sleep(200);
    const log = await readLog(page);
    ok('D4 celebrate, refusals 0, decoys 2 recorded', log.length === 1 && log[0].payload.refusals === 0 && log[0].payload.decoys === 2, JSON.stringify(log));
    ok('D4 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D5 whole-screen touch: the option is kept but inactive ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 3, operation: 'anywhere', dummy: true } }, base));
    await startRun(page);
    const t = await tree(page), b = await basket(page);
    ok('D5 anywhere + dummy ON: no decoy on the tree, data-decoys 0', t.decoys === 0 && t.kinds.length === 3 && b.decoysAttr === '0', JSON.stringify(t));
    for (let i = 0; i < 3; i++) { await page.evaluate(() => document.getElementById('surface').click()); await sleep(450); }
    await sleep(700); await page.evaluate(() => document.getElementById('surface').click());
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 6000 });
    const log = await readLog(page);
    ok('D5 anywhere: delivery succeeds; the record says decoys 0 / refusals 0 (the saved dummy value is still true)', log.length === 1 && log[0].payload.decoys === 0 && log[0].payload.refusals === 0 && (await page.evaluate(() => JSON.parse(localStorage.getItem('donomana-ringo-potton-settings-v1')).dummy === true)));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    ok('D5 the settings row is hidden while「どこでも タッチ」is selected', await page.evaluate(() => document.getElementById('rowDummy').hidden));
    ok('D5 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D6 random goal + decoys: the refusal keeps the drawn goal ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 5, goalMode: 'random', operation: 'apple', dummy: true } }, base));
    await startRun(page);
    const g = parseInt(await attr(page, 'data-goal'), 10), t = await tree(page);
    ok('D6 random goal ' + g + ': decoy count matches the drawn goal', t.decoys === Math.min(1 + Math.floor(g / 4), 12 - g) && t.apples === g, JSON.stringify(t));
    await take(page, 'banana');
    for (let i = 0; i < g; i++) await take(page, 'apple');
    await sleep(700); await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'harvest', null, { timeout: 8000 }); await sleep(300);
    ok('D6 after the refusal the SAME goal (' + g + ') is asked again, not a new draw', parseInt(await attr(page, 'data-goal'), 10) === g && (await tree(page)).kinds.join(',') === t.kinds.join(','));
    await sleep(400);
    for (let i = 0; i < g; i++) await take(page, 'apple');
    await sleep(700); await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'celebrate', null, { timeout: 8000 }); await sleep(200);
    const log = await readLog(page);
    ok('D6 then success: record goal ' + g + ', goalMode random, refusals 1', log.length === 1 && log[0].payload.goal === g && log[0].payload.goalMode === 'random' && log[0].payload.refusals === 1, JSON.stringify(log));
    ok('D6 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D7 settings: migration, row visibility, pending note, next activity ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple', dummy: 'yes' } }, base));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    ok('D7 a non-boolean saved value sanitises to OFF', (await page.getAttribute('#rowDummy [data-dummy="0"]', 'aria-pressed')) === 'true');
    await page.click('[data-op="anywhere"]'); await sleep(150);
    ok('D7 choosing「どこでも タッチ」hides the row; back to「りんごを タッチ」shows it', await page.evaluate(() => document.getElementById('rowDummy').hidden));
    await page.click('[data-op="apple"]'); await sleep(150);
    ok('D7 (shown again)', await page.evaluate(() => !document.getElementById('rowDummy').hidden));
    await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(700);
    ok('D7 activity started OFF: no decoys', (await tree(page)).decoys === 0);
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150); await page.click('#scOpen'); await sleep(200);
    await page.click('#rowDummy [data-dummy="1"]'); await sleep(150);
    const s = await page.evaluate(() => ({ pending: !document.getElementById('pendingNote').hidden, saved: JSON.parse(localStorage.getItem('donomana-ringo-potton-settings-v1')).dummy, decoysNow: document.getElementById('app').getAttribute('data-decoys') }));
    ok('D7 switching ON mid-activity: saved as boolean true, the「つぎの かつどうから」note shows, the current activity is unchanged', s.saved === true && s.pending && s.decoysNow === '0', JSON.stringify(s));
    await page.click('#restartBtn'); await sleep(700);
    ok('D7 the next activity has decoys (goal 2 -> 1 banana)', (await tree(page)).decoys === 1 && (await basket(page)).decoysAttr === '1');
    ok('D7 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D8 switch scan / keyboard: decoys are candidates and take with Enter ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 2, operation: 'apple', dummy: true } }, base));
    await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(200);
    await page.click('[data-scan-on="1"]'); await sleep(300); await page.click('#settingsClose'); await sleep(500);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(800);
    const items = await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.getAttribute('data-kind') + '#' + e.getAttribute('data-id')));
    ok('D8 scan candidates on harvest = every ripe fruit including the banana (3)', items.length === 3 && items.some((i) => i.startsWith('banana#')), items.join(','));
    await page.focus('#appleGrid .apple[data-kind="banana"]'); await page.keyboard.press('Enter'); await sleep(500);
    const b = await basket(page);
    ok('D8 Enter on the banana takes it: tray 1, number 0', b.tray === 1 && b.count === '0', JSON.stringify(b));
    const items2 = await page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.getAttribute('data-kind')));
    ok('D8 the banana leaves the candidate list (2 apples remain)', items2.join(',') === 'apple,apple', items2.join(','));
    ok('D8 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- D9 voice OFF: the refusal still proceeds, silently; wording check ---------------- */
  {
    const { context, page } = await newPage(browser, Object.assign({ settings: { goal: 1, operation: 'apple', dummy: true, voice: false } }, base));
    await startRun(page);
    await take(page, 'banana'); await take(page, 'apple'); await sleep(700); await deliver(page);
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'refusing', null, { timeout: 3000 });
    await page.waitForFunction(() => document.getElementById('app').getAttribute('data-phase') === 'harvest', null, { timeout: 8000 });
    const sp = await spoken(page), au = await page.evaluate(() => window.__au.filter((o) => o.op === 'play' && !o.muted).length);
    ok('D9 voice OFF: refusing -> harvest happens with nothing spoken or played', sp.length === 0 && au === 0, sp.join('|') + ' plays=' + au);
    const texts = await page.evaluate(() => ({ settings: document.getElementById('settingsSheet').textContent, help: document.getElementById('helpSheet').textContent, bubble: document.getElementById('bubble').textContent }));
    // two pre-existing help sentences name words only to deny them or in another sense:「点数・時間・正解や まちがいは ありません」
    // and the random-mode「まえと ちがう かずに なります」(a different number, not a verdict) — neither is this Phase's text
    const helpText = texts.help.replace('点数・時間・正解や まちがいは ありません', '').replace('まえと ちがう かずに なります', '');
    ok('D9 no「ちがう」「だめ」or evaluative words in the settings sheet, the help or the bubble', !BANNED.test(texts.settings.replace('ひかる はやさ', '')) && !BANNED.test(helpText) && !BANNED.test(texts.bubble), JSON.stringify({ s: (texts.settings.match(BANNED) || [])[0], h: (helpText.match(BANNED) || [])[0], b: (texts.bubble.match(BANNED) || [])[0] }));
    ok('D9 the help explains the option (banana / mikan, beside the frames, everything returns, same count again, apple-touch only)', /バナナや みかん/.test(texts.help) && /わくの そと/.test(texts.help) && /ぜんぶ 木に もどり/.test(texts.help) && /もういちど たのまれます/.test(texts.help) && /「がめんの どこでも タッチ」では つかえません/.test(texts.help));
    ok('D9 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
