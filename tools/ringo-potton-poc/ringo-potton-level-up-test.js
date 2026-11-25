// Real-browser (Playwright / Chromium) test for「レベルアップ」of ringo-potton-app.html, Phase 1
// (Phase RINGO-POTTON-LEVEL-UP-1 and its revision): the teacher's レベルアップ button + panel, and the level「おおめから ぴったり」(extra).
//
// settings.level = 'normal' (default, the activity as before) | 'kinds2' (「くだものを 2 しゅるい」, available since
// レベルアップ Phase 3 and tested in ringo-potton-level-up-a-test.js; here only that it can be chosen and loaded) |
// 'extra' (「おおめから ぴったり」). settings.extra = 1..3
// (default 2). In the level extra the tree carries goal + extra apples and the basket has ONE FRAME FOR EVERY APPLE
// on the tree (decoys still go beside the frames); the tree never holds more than 12 fruit (decoys give way first,
// never below one while the dummy option is on; then the extras, never below one). The count can pass the asked
// number:「とどける」and the note「たのまれた かずが かごに はいりました。」are shown exactly while the count IS the asked
// number, not while it is too high. An apple in the basket goes back to the tree when it is touched (in every
// operation mode: the filled frame is a button in front of the whole-screen surface; also a Switch Scan candidate),
// the count is one less and the new count is spoken. There is no "full basket" reaction any more. The request of
// this level has its own files (assets/ringo-potton/voice/ringo-b-<goal>.mp3) and its own words
// (「りんごを ○こ とってね。ぴったり おねがいね」), also after a refusal and as the synthesised fallback.
// In the level ふつう nothing of this exists: frames = the goal (plain markers), a touch on the basket does nothing,
// the request is ringo-<goal>.mp3 /「りんごを ○こ、とってね」, the note stays「りんごが ぜんぶ かごに はいりました。」.
// The record gets level and extra (15 keys, schemaVersion 1); apples that were sent back are not recorded.
// The button is teacher-facing: never a Switch Scan candidate, above the whole-screen surface (never a harvest), and
// while its panel is open the activity does not react. A level applies from the next activity, or with
// 「いますぐ はじめなおす」.
//
// Run from the repository root (no package.json; Node 20 + a globally available `playwright`):
//   node tools/ringo-potton-poc/ringo-potton-level-up-test.js
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
const J = JSON.stringify;
const NOTE_NORMAL = 'りんごが ぜんぶ かごに はいりました。';        // the note when the count is reached, as before (level ふつう)
const NOTE_EXTRA = 'たのまれた かずが かごに はいりました。';       // ... in the level extra only
const doneNote = (page) => page.evaluate(() => { const e = document.getElementById('doneNote'); return { text: e.textContent, shown: !e.hidden && getComputedStyle(e).display !== 'none' }; });

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

async function newPage(browser, base, o) {
  o = o || {};
  const context = await browser.newContext({ viewport: o.viewport || { width: 834, height: 1194 }, reducedMotion: o.motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(SPEECH_STUB);
  await context.addInitScript(AUDIO_STUB);
  await context.addInitScript(() => { window.__auDur = { okotowari: 700 }; });
  if (o.init) await context.addInitScript(o.init);   // e.g. 'window.__auFail = true;' (the stubs' failure switches)
  await context.addInitScript(({ k, v }) => { if (!sessionStorage.getItem('__seeded')) { if (v !== null) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, { k: SETTINGS_KEY, v: o.settings === undefined ? null : (typeof o.settings === 'string' ? o.settings : J(o.settings)) });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g/.test(m.text())) page.__errors.push('console: ' + m.text()); });
  await page.goto(base + '/ringo-potton-app.html'); await sleep(250);
  return { context, page };
}
const attr = (page, a) => page.getAttribute('#app', a);
const phase = (page) => attr(page, 'data-phase');
const harvested = async (page) => parseInt(await attr(page, 'data-harvested'), 10);
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SETTINGS_KEY);
const readLog = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ringo_potton_log') || 'null'));
const live = (page) => page.evaluate(() => ['liveStatus', 'donomanaAnnouncePolite', 'donomanaAnnounceAssertive'].map((i) => (document.getElementById(i) || {}).textContent || '').join('|'));
const spoken = (page) => page.evaluate(() => window.__sp.filter((t) => t !== 'CANCEL' && t.trim() !== ''));
const audible = (page, re) => page.evaluate((src) => window.__au.filter((o) => o.op === 'play' && !o.muted && new RegExp(src).test(o.src)).length, re || '.');
// the tree as the child sees it
const tree = (page) => page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('#appleGrid .apple'));
  const vis = (e) => getComputedStyle(e).visibility !== 'hidden';
  return { total: b.length, apples: b.filter((e) => e.getAttribute('data-kind') === 'apple').length, decoys: b.filter((e) => e.getAttribute('data-kind') !== 'apple').length,
    ripe: b.filter((e) => e.getAttribute('data-status') === 'ripe').length, ripeApples: b.filter((e) => e.getAttribute('data-kind') === 'apple' && e.getAttribute('data-status') === 'ripe').length,
    visible: b.filter(vis).length, minSize: Math.round(Math.min(...b.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }))),
    slots: document.querySelectorAll('#slots .slot').length, filled: document.querySelectorAll('#slots .slot[data-filled="1"]').length, count: document.getElementById('countNum').textContent };
});
async function start(page) { await page.click('#startBtn'); await sleep(700); }
const page0Kinds = (page) => page.evaluate(() => new Set(Array.from(document.querySelectorAll('#appleGrid .apple')).map((e) => e.getAttribute('data-kind'))).size);   // how many kinds of fruit the tree carries
// click the first ripe fruit of a kind and wait until it is in the basket (count or tray changed)
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
  }), kind || 'apple');
  await sleep(80);
}
async function waitPhase(page, ph, t) { await page.waitForFunction((x) => document.getElementById('app').getAttribute('data-phase') === x, ph, { timeout: t || 15000 }); }
async function harvest(page, n) { for (let i = 0; i < n; i++) await take(page, 'apple'); await waitPhase(page, 'complete'); await sleep(150); }
async function deliver(page) { await sleep(700); await page.evaluate(() => document.getElementById('deliverBtn').click()); }
async function finish(page) { await deliver(page); await waitPhase(page, 'celebrate'); await sleep(700); }
async function again(page) { await page.evaluate(() => document.getElementById('againBtn').click()); await sleep(800); }
const panel = (page) => page.evaluate(() => {
  const p = document.getElementById('ringoLevelPanel'), b = document.getElementById('ringoLevelBtn');
  return { open: !p.hidden, expanded: b.getAttribute('aria-expanded'),
    opts: Array.from(p.querySelectorAll('[data-level-opt]')).map((e) => ({ v: e.getAttribute('data-level-opt'), text: e.textContent.replace(/\s+/g, ' ').trim(), pressed: e.getAttribute('aria-pressed'), disabled: e.disabled })),
    note: !document.getElementById('ringoLevelNote').hidden, restart: !document.getElementById('ringoLevelRestart').hidden, close: !!document.getElementById('ringoLevelClose') };
});
async function openPanel(page) { await page.click('#ringoLevelBtn'); await sleep(150); }
async function choose(page, v) { await page.click('#ringoLevelPanel [data-level-opt="' + v + '"]'); await sleep(150); }
async function closePanel(page) { await page.click('#ringoLevelClose'); await sleep(550); }
async function openSettings(page) {
  await page.evaluate(() => document.getElementById('ringoSettingsBtn').click()); await sleep(150);
  if (await page.evaluate(() => document.getElementById('settingsSheet').hidden)) { await page.evaluate(() => document.getElementById('scOpen').click()); await sleep(150); }
}
async function closeSettings(page) { await page.evaluate(() => document.getElementById('settingsClose').click()); await sleep(550); }
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null; }, sel);
const hit = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
// the basket as the child sees it: the frames in order (filled: 1 / 0 per frame; ret: 1 where the frame is the control
// that sends its apple back, '-' where the frame has no such attribute at all), the decoys beside them,「とどける」
const basket = (page) => page.evaluate(() => {
  const s = Array.from(document.querySelectorAll('#slots .slot'));
  return { n: s.length, tags: Array.from(new Set(s.map((e) => e.tagName))).join(), filled: s.map((e) => e.getAttribute('data-filled')).join(''), ret: s.map((e) => e.getAttribute('data-ret') || '-').join(''),
    controls: s.filter((e) => e.tagName === 'BUTTON' && e.tabIndex === 0 && e.getAttribute('aria-hidden') !== 'true').length, role: document.getElementById('basket').getAttribute('role'),
    minSize: Math.round(Math.min(...s.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }))), deliver: !document.getElementById('deliverBtn').hidden, tray: document.querySelectorAll('#decoyTray svg').length };
});
// touch the apple in the i-th FILLED frame with a real pointer click at its centre (after the landing / screen-change
// guard), then wait until it hangs on the tree again. onSlot: the frame itself is the topmost element at that point.
async function giveBack(page, i, o) {
  o = o || {};
  await sleep(700);
  const c = await page.evaluate((k) => { const s = Array.from(document.querySelectorAll('#slots .slot[data-filled="1"]'))[k || 0]; if (!s) return null; const r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { x, y, onSlot: !!top && !!top.closest && top.closest('.slot') === s }; }, i);
  if (!c) throw new Error('giveBack: there is no filled frame ' + i);
  await page.mouse.click(c.x, c.y);
  if (o.wait !== false) { await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150); }
  return c;
}
// the "full basket" reaction of the first version of this level must be gone: no nudge, no light, no announcement
const noFullReaction = async (page) => (await page.evaluate(() => !document.querySelector('.apple.is-nudge') && !document.getElementById('basket').classList.contains('is-full-flash') && getComputedStyle(document.getElementById('basket')).boxShadow === 'none' && Array.from(document.querySelectorAll('#appleGrid .apple')).every((a) => getComputedStyle(a).animationName === 'none'))) && !/いっぱい/.test(await live(page));
// the request: files played audibly (in order), what the bubble shows (visible pieces, whitespace removed), the words
const plays = (page) => page.evaluate(() => window.__au.filter((o) => o.op === 'play' && !o.muted).map((o) => String(o.src).split('/').pop()));
const squash = (t) => String(t).replace(/\s+/g, '');
const bubbleSaid = (page) => page.evaluate(() => Array.from(document.getElementById('bubble').children).filter((e) => !e.hidden).map((e) => e.textContent).join('').replace(/\s+/g, ''));
const KANA = ['', 'いっこ', 'にこ', 'さんこ', 'よんこ', 'ごこ', 'ろっこ', 'ななこ', 'はっこ', 'きゅうこ', 'じゅっこ'];
const B_BUBBLE_TEXT = (g) => 'りんごを ' + g + 'こ とってね。ぴったり おねがいね';   // the level extra
const N_BUBBLE_TEXT = (g) => 'りんごを ' + g + 'こ、とってね';                       // the level ふつう, as before
const B_SAID = (g) => 'りんごを ' + KANA[g] + ' とってね。ぴったり おねがいね';       // the synthesised fallback of the level extra
// Switch Scan candidates right now (the app's own list), named: an id, a fruit on the tree, or a basket frame
const scanCand = (page) => page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id || (e.classList.contains('slot') ? 'slot#' + e.getAttribute('data-id') : e.getAttribute('data-kind') + '#' + e.getAttribute('data-id'))));
// the expected plan, written independently of the app: goal + decoys + extras <= 12; decoys give way first (>= 1 while on), then extras (>= 1)
function expectPlan(goal, want, dummy) {
  let d = dummy ? Math.max(0, Math.min(1 + Math.floor(goal / 4), 12 - goal)) : 0, e = want;
  const room = 12 - goal;
  if (d + e > room) { d = Math.max(d > 0 ? 1 : 0, room - e); e = Math.max(1, Math.min(e, room - d)); }
  return { decoys: d, extra: e };
}

(async () => {
  const srv = await startServer();
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ---------------- L1 saved data without level / extra, and values that are not valid ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, operation: 'apple' } });
    await openPanel(page);
    const p = await panel(page);
    ok('L1 old saved data (no level / extra): the panel shows「ふつう」pressed and nothing else pressed', p.opts.filter((o) => o.pressed === 'true').map((o) => o.v).join() === 'normal', J(p.opts));
    await closePanel(page);
    await start(page);
    const t = await tree(page);
    ok('L1 ... and the activity is the one as before: 3 apples on the tree, 3 frames, data-level normal', t.total === 3 && t.apples === 3 && t.slots === 3 && (await attr(page, 'data-level')) === 'normal', J(t));
    await openSettings(page);
    ok('L1 ... the「おおめの かず」row is not shown', await page.evaluate(() => document.getElementById('rowExtra').hidden));
    await closeSettings(page);
    ok('L1 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    for (const c of [{ name: 'unknown level "turbo"', s: { goal: 2, level: 'turbo', extra: 3 }, apples: 2, level: 'normal' },
      { name: 'level extra with extra 9 (out of range -> 2)', s: { goal: 2, level: 'extra', extra: 9 }, apples: 4, level: 'extra' }, { name: 'level extra with extra "x" (-> 2)', s: { goal: 2, level: 'extra', extra: 'x' }, apples: 4, level: 'extra' },
      { name: 'level extra with extra 0 (-> 2)', s: { goal: 2, level: 'extra', extra: 0 }, apples: 4, level: 'extra' }, { name: 'level extra without extra (-> 2)', s: { goal: 2, level: 'extra' }, apples: 4, level: 'extra' }]) {
      const q = await newPage(browser, BASE, { settings: c.s });
      await start(q.page);
      const tt = await tree(q.page);
      ok('L1 ' + c.name + ': ' + c.apples + ' apples on the tree, ' + (c.level === 'extra' ? c.apples : 2) + ' frames, data-level ' + c.level, tt.apples === c.apples && tt.slots === (c.level === 'extra' ? c.apples : 2) && (await attr(q.page, 'data-level')) === c.level && q.page.__errors.length === 0, J(tt));
      await q.context.close();
    }
  }

  {
    // the saved level「くだものを 2 しゅるい」is a level of its own now (its behaviour: ringo-potton-level-up-a-test.js)
    const q = await newPage(browser, BASE, { settings: { goal: 2, level: 'kinds2' } });
    await start(q.page);
    const tt = await tree(q.page);
    ok('L1 level "kinds2" (available now): it is loaded as kinds2 -- 2 fruit of two kinds on the tree (1 + 1), 2 frames', tt.total === 2 && tt.slots === 2 && tt.apples <= 1 && (await attr(q.page, 'data-level')) === 'kinds2' && (await page0Kinds(q.page)) === 2 && q.page.__errors.length === 0, J(tt));
    await q.context.close();
  }

  /* ---------------- L2 the button and the panel ---------------- */
  for (const vp of [{ n: 'iPad portrait', w: 820, h: 1180 }, { n: 'iPad landscape', w: 1180, h: 820 }, { n: 'phone portrait', w: 390, h: 844 }, { n: 'phone landscape', w: 844, h: 390 }]) {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3 }, viewport: { width: vp.w, height: vp.h } });
    const b0 = await rect(page, '#ringoLevelBtn'), home = await rect(page, '#donomanaHomeBtn');
    const chrome = ['#donomanaHomeBtn', '#donomanaLockBtn', '#donomanaFsBtn', '#donomanaHelpBtn', '#donomanaA11yBtn', '#donomanaRecordNavBtn'];
    const rects = {}; for (const c of chrome) rects[c] = await rect(page, c);
    ok('L2 ' + vp.n + ' start screen: the button「レベルアップ」is shown right of the Home button in the top row (top 12..56px), >= 44px high', !!b0 && (await page.textContent('#ringoLevelBtn')) === 'レベルアップ' && b0.t === 12 && b0.b <= 56 && b0.h >= 44 && b0.l >= home.r && b0.l - home.r <= 12, J({ b0, home }));
    ok('L2 ' + vp.n + ': it covers none of the common buttons and stays inside the screen', chrome.every((c) => !hit(b0, rects[c])) && b0.r <= vp.w, J({ b0, rects }));
    await start(page);
    const b1 = await rect(page, '#ringoLevelBtn'), band = await rect(page, '#requestBand'), tr = await rect(page, '#treeArea');
    ok('L2 ' + vp.n + ' play screen: same place, clear of the request band and the tree', J(b1) === J(b0) && !hit(b1, band) && !hit(b1, tr), J({ b1, band, tr }));
    await openPanel(page);
    const p = await panel(page), pr = await rect(page, '#ringoLevelPanel');
    ok('L2 ' + vp.n + ': pressing it opens the panel under the button (aria-expanded true), with the four levels and「とじる」', p.open && p.expanded === 'true' && pr.t >= b1.b && p.opts.map((o) => o.v).join() === 'normal,kinds2,extra,kinds2extra' && p.opts[3].text === '2しゅるい ぴったり' && p.opts[0].text === 'ふつう' && /^くだものを 2 しゅるい/.test(p.opts[1].text) && p.opts[2].text === 'おおめから ぴったり' && p.close, J({ p, pr }));
    ok('L2 ' + vp.n + ': the panel is inside the screen and covers none of the common buttons; every button in it is >= 44px high', pr.l >= 0 && pr.r <= vp.w && pr.b <= vp.h && chrome.every((c) => !hit(pr, rects[c])) && await page.evaluate(() => Array.from(document.querySelectorAll('#ringoLevelPanel button')).filter((e) => !e.hidden).every((e) => e.getBoundingClientRect().height >= 44)), J({ pr, rects }));
    ok('L2 ' + vp.n + ': focus is on the panel itself, not on one of its buttons', await page.evaluate(() => document.activeElement === document.getElementById('ringoLevelPanel')));
    await page.keyboard.press('Escape'); await sleep(150);
    ok('L2 ' + vp.n + ': Esc closes it (aria-expanded false)', !(await panel(page)).open && (await panel(page)).expanded === 'false');
    await openPanel(page); await page.click('#ringoLevelBtn'); await sleep(150);
    const toggled = !(await panel(page)).open;
    await openPanel(page); await closePanel(page);
    ok('L2 ' + vp.n + ': the button toggles it and「とじる」closes it', toggled && !(await panel(page)).open);
    ok('L2 ' + vp.n + ': no horizontal overflow, no errors', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L3 every level can be chosen (「くだものを 2 しゅるい」since レベルアップ Phase 3;「2しゅるい ぴったり」is tested in ringo-potton-level-up-ab-test.js) ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2 } });
    await openPanel(page);
    const p = await panel(page);
    const soon = await page.evaluate(() => { const e = document.querySelector('#ringoLevelPanel [data-level-opt="kinds2"] .level-soon'); return !!e && (e.hidden || getComputedStyle(e).display === 'none'); });
    ok('L3 no option is disabled any more; the「（じゅんびちゅう）」label of「くだものを 2 しゅるい」is not shown', p.opts.every((o) => o.disabled === false) && soon, J(p.opts));
    const box = await rect(page, '#ringoLevelPanel [data-level-opt="kinds2"]');
    await page.mouse.click(box.l + box.w / 2, box.t + box.h / 2); await sleep(150);
    const p2 = await panel(page), sv = await saved(page);
    ok('L3 pressing it chooses it: level kinds2 saved, shown pressed (only it), the panel stays open', sv.level === 'kinds2' && p2.open && p2.opts.filter((o) => o.pressed === 'true').map((o) => o.v).join() === 'kinds2', J({ sv, p2 }));
    await closePanel(page); await start(page);
    ok('L3 the next activity is in that level (2 fruit of two kinds, data-level kinds2)', (await tree(page)).total === 2 && (await page0Kinds(page)) === 2 && (await attr(page, 'data-level')) === 'kinds2' && page.__errors.length === 0);
    await context.close();
  }

  /* ---------------- L4 choosing a level: saved, applied from the next activity; 「いますぐ はじめなおす」 ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2 } });
    await openPanel(page); await choose(page, 'extra');
    let p = await panel(page), sv = await saved(page);
    ok('L4 start screen: choosing「おおめから ぴったり」saves level extra, shows it pressed (only it), no「つぎの かつどうから」note / restart button', sv.level === 'extra' && sv.goal === 2 && p.opts.filter((o) => o.pressed === 'true').map((o) => o.v).join() === 'extra' && !p.note && !p.restart && p.open, J({ sv, p }));
    ok('L4 start screen: nothing started, nothing spoken or played', (await phase(page)) === 'start' && (await spoken(page)).length === 0 && (await audible(page)) === 0);
    await closePanel(page); await start(page);
    let t = await tree(page);
    ok('L4 the activity that starts now is in the level extra: 2 + 2 apples, 4 frames', t.apples === 4 && t.slots === 4 && (await attr(page, 'data-level')) === 'extra', J(t));
    // back to ふつう during the activity: this activity goes on unchanged
    await take(page, 'apple');
    await openPanel(page); await choose(page, 'normal');
    p = await panel(page); sv = await saved(page); t = await tree(page);
    ok('L4 mid-activity: choosing「ふつう」saves it, shows the「つぎの かつどうから」note and「いますぐ はじめなおす」; the running activity is untouched (4 apples, 1 taken, level extra)', sv.level === 'normal' && p.note && p.restart && p.opts[0].pressed === 'true' && t.apples === 4 && t.count === '1' && (await attr(page, 'data-level')) === 'extra' && (await phase(page)) === 'harvest', J({ sv, p, t }));
    await closePanel(page);
    await take(page, 'apple'); await waitPhase(page, 'complete'); await finish(page);
    let log = await readLog(page);
    ok('L4 that activity is finished and recorded as it was played (level extra, extra 2)', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 2, J(log[0].payload));
    await again(page);
    t = await tree(page);
    ok('L4「もう いちど」: the next activity is the usual one (2 apples), data-level normal', t.total === 2 && (await attr(page, 'data-level')) === 'normal', J(t));
    // いますぐ はじめなおす
    await take(page, 'apple');
    const reqBefore = await audible(page, 'ringo-b-2\\.mp3'), reqNormal = await audible(page, 'ringo-2\\.mp3');
    await openPanel(page); await choose(page, 'extra');
    ok('L4 mid-activity: choosing「おおめから ぴったり」again: note + restart shown, activity untouched (2 apples, 1 taken)', (await panel(page)).restart && (await tree(page)).total === 2 && (await harvested(page)) === 1);
    await page.click('#ringoLevelRestart'); await sleep(800);
    t = await tree(page);
    ok('L4「いますぐ はじめなおす」: the panel closes, a new activity starts at once in the level extra (4 apples, none taken, its own request file played)', !(await panel(page)).open && t.apples === 4 && t.count === '0' && t.ripe === 4 && (await phase(page)) === 'harvest' && (await attr(page, 'data-level')) === 'extra' && (await audible(page, 'ringo-b-2\\.mp3')) === reqBefore + 1 && (await audible(page, 'ringo-2\\.mp3')) === reqNormal, J(t));
    log = await readLog(page);
    ok('L4 the abandoned activity was not recorded (still 1 record)', log.length === 1);
    await page.reload(); await sleep(300);
    await openPanel(page);
    ok('L4 after a reload the saved level is still「おおめから ぴったり」', (await panel(page)).opts.filter((o) => o.pressed === 'true').map((o) => o.v).join() === 'extra' && (await saved(page)).level === 'extra');
    await closePanel(page); await start(page);
    ok('L4 ... and the first activity after the reload is in that level (4 apples)', (await tree(page)).apples === 4);
    ok('L4 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L5 how many fruit the tree carries: goal + extra, never more than 12 ---------------- */
  {
    for (let goal = 1; goal <= 10; goal++) {
      const want = 3, ex = expectPlan(goal, want, false);
      const { context, page } = await newPage(browser, BASE, { settings: { goal, level: 'extra', extra: want } });
      await start(page);
      const t = await tree(page);
      ok('L5 goal ' + goal + ' + extra 3: ' + (goal + ex.extra) + ' apples on the tree (extra ' + ex.extra + ') and as many frames, total <= 12', t.apples === goal + ex.extra && t.decoys === 0 && t.slots === goal + ex.extra && t.total <= 12, J(t));
      await context.close();
    }
    ok('L5 (the rule) goal 10 + extra 3 -> 2 extras; goal 9 + extra 3 -> 3', expectPlan(10, 3, false).extra === 2 && expectPlan(9, 3, false).extra === 3);
    for (const c of [{ goal: 10, want: 3 }, { goal: 10, want: 1 }, { goal: 9, want: 3 }, { goal: 9, want: 1 }, { goal: 8, want: 2 }, { goal: 8, want: 3 }, { goal: 7, want: 3 }, { goal: 3, want: 3 }]) {
      const ex = expectPlan(c.goal, c.want, true), usual = Math.max(0, Math.min(1 + Math.floor(c.goal / 4), 12 - c.goal));
      const { context, page } = await newPage(browser, BASE, { settings: { goal: c.goal, level: 'extra', extra: c.want, dummy: true } });
      await start(page);
      const t = await tree(page);
      ok('L5 with decoys, goal ' + c.goal + ' + extra ' + c.want + ': decoys ' + usual + ' -> ' + ex.decoys + ', extras ' + ex.extra + ' (total ' + (c.goal + ex.decoys + ex.extra) + '); frames = apples (' + (c.goal + ex.extra) + '), none for a decoy', t.apples === c.goal + ex.extra && t.decoys === ex.decoys && t.total <= 12 && ex.extra >= 1 && ex.decoys >= 1 && t.slots === c.goal + ex.extra, J(t));
      await context.close();
    }
    ok('L5 (the rule) goal 10 with decoys: 2 decoys give way to 1 first, and 1 extra is left', J(expectPlan(10, 3, true)) === J({ decoys: 1, extra: 1 }) && J(expectPlan(9, 2, true)) === J({ decoys: 1, extra: 2 }) && J(expectPlan(8, 2, true)) === J({ decoys: 2, extra: 2 }));
    // the example of the specification: asked 5, one more -> 6 apples on the tree, 6 frames; the same 6 frames with decoys
    for (const dummy of [false, true]) {
      const q = await newPage(browser, BASE, { settings: { goal: 5, level: 'extra', extra: 1, dummy } });
      await start(q.page);
      const tq = await tree(q.page), bq = await basket(q.page);
      ok('L5 goal 5 + extra 1' + (dummy ? ' + decoys (2)' : '') + ': 6 apples on the tree, 6 frames in the basket' + (dummy ? ' (the decoys get none)' : ''), tq.apples === 6 && tq.slots === 6 && bq.n === 6 && tq.decoys === (dummy ? 2 : 0) && q.page.__errors.length === 0, J(tq));
      await q.context.close();
    }
    // 12 fruit on the smallest layout: still at least the minimum touch size
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 10, level: 'extra', extra: 3 }, viewport: { width: 844, height: 390 } });
    await start(page);
    const t = await tree(page);
    ok('L5 phone landscape, goal 10 + 2 extras: 12 apples, each at least 60px', t.total === 12 && t.minSize >= 60, J(t));
    await context.close();
  }

  /* ---------------- L6 the「おおめの かず」row in the settings sheet ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2 } });
    await openSettings(page);
    ok('L6 level ふつう: the row is hidden', await page.evaluate(() => document.getElementById('rowExtra').hidden));
    await closeSettings(page);
    await openPanel(page); await choose(page, 'extra'); await closePanel(page);
    await openSettings(page);
    const row = await page.evaluate(() => ({ hidden: document.getElementById('rowExtra').hidden, label: document.getElementById('lblExtra').textContent, group: document.querySelector('#rowExtra .btn-group').getAttribute('aria-labelledby'), btns: Array.from(document.querySelectorAll('#rowExtra [data-extra]')).map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')), h: Math.min(...Array.from(document.querySelectorAll('#rowExtra [data-extra]')).map((b) => b.getBoundingClientRect().height)) }));
    ok('L6 level おおめから ぴったり: the row is shown (labelled group, ＋1 / ＋2 / ＋3, default ＋2 pressed, >= 44px)', !row.hidden && /おおめの かず/.test(row.label) && row.group === 'lblExtra' && row.btns.join() === '＋1:false,＋2:true,＋3:false' && row.h >= 44, J(row));
    await page.click('#rowExtra [data-extra="3"]'); await sleep(150);
    ok('L6 choosing ＋3 saves extra 3 (other settings untouched)', J(await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); return [s.extra, s.level, s.goal]; }, SETTINGS_KEY)) === J([3, 'extra', 2]));
    await closeSettings(page); await start(page);
    ok('L6 the activity has 2 + 3 apples', (await tree(page)).apples === 5);
    await openSettings(page);
    ok('L6 mid-activity, nothing changed: no pending note', await page.isHidden('#pendingNote'));
    await page.click('#rowExtra [data-extra="1"]'); await sleep(150);
    ok('L6 changing the number mid-activity shows the「つぎの かつどうから」note and leaves the tree alone (5 apples)', await page.isVisible('#pendingNote') && (await tree(page)).apples === 5);
    await closeSettings(page);
    await openPanel(page); await choose(page, 'normal'); await closePanel(page);
    await openSettings(page);
    ok('L6 back to ふつう: the row is hidden again and the number is kept (extra 1)', await page.evaluate(() => document.getElementById('rowExtra').hidden) && (await saved(page)).extra === 1 && await page.isVisible('#pendingNote'));
    ok('L6 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L7 the level extra, apple-touch: a frame for every apple;「とどける」only at the exact count; giving back ---------------- */
  let normalCompleteCanopy = 0;
  {
    const n = await newPage(browser, BASE, { settings: { goal: 2 } });
    await start(n.page);
    const h0 = (await rect(n.page, '#canopy')).h;
    await harvest(n.page, 2);
    normalCompleteCanopy = (await rect(n.page, '#canopy')).h;
    const nn = await doneNote(n.page);
    ok('L7 (reference) level ふつう: the note is the one as before「' + NOTE_NORMAL + '」', nn.shown && nn.text === NOTE_NORMAL, J(nn));
    ok('L7 (reference) level ふつう: after the harvest the tree is shrunk as before (' + h0 + 'px -> ' + normalCompleteCanopy + 'px) and is empty', normalCompleteCanopy < h0 * 0.6 && (await tree(n.page)).visible === 0, h0 + ' -> ' + normalCompleteCanopy);
    await n.context.close();
  }
  for (const motion of [false, true]) {
    const tag = motion ? 'motion ON' : 'reduced motion';
    const settle = motion ? 300 : 150;
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 2 }, motion });
    await start(page);
    const hHarvest = (await rect(page, '#canopy')).h;
    let b = await basket(page), t = await tree(page);
    ok('L7 ' + tag + ': 4 apples on the tree and 4 frames in the basket (buttons, none holds an apple, none is a control); no「とどける」', t.apples === 4 && b.n === 4 && b.tags === 'BUTTON' && b.filled === '0000' && b.ret === '0000' && b.controls === 0 && b.role === 'group' && !b.deliver, J({ t, b }));
    await take(page, 'apple');
    b = await basket(page);
    ok('L7 ' + tag + ': one apple: number 1, the first frame holds it, no「とどける」, no note', (await harvested(page)) === 1 && b.filled === '1000' && b.ret === '1000' && !b.deliver && !(await doneNote(page)).shown && (await phase(page)) === 'harvest', J(b));
    await take(page, 'apple'); await waitPhase(page, 'complete'); await sleep(settle);
    t = await tree(page); b = await basket(page);
    const can = await rect(page, '#canopy'), dl = await rect(page, '#deliverBtn');
    ok('L7 ' + tag + ': two apples = the asked count -> phase complete, number 2, frames 1100,「とどける」shown, 2 apples still on the tree', (await phase(page)) === 'complete' && t.count === '2' && b.filled === '1100' && b.deliver && t.ripeApples === 2 && t.visible === 2, J({ t, b }));
    const dn = await doneNote(page);
    ok('L7 ' + tag + ': the note says「' + NOTE_EXTRA + '」', dn.shown && dn.text === NOTE_EXTRA, J(dn));
    ok('L7 ' + tag + ': the tree is not shrunk (' + hHarvest + 'px -> ' + can.h + 'px; the usual shrink would give ' + normalCompleteCanopy + 'px)', can.h > normalCompleteCanopy * 1.5 && can.h >= hHarvest * 0.6, hHarvest + ' -> ' + can.h);
    const inside = await page.evaluate(() => { const c = document.getElementById('canopy').getBoundingClientRect(); return Array.from(document.querySelectorAll('#appleGrid .apple[data-status="ripe"]')).every((e) => { const r = e.getBoundingClientRect(); return r.width >= 60 && r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 && r.bottom <= innerHeight; }); });
    ok('L7 ' + tag + ': the apples left on the tree are fully visible inside the crown (>= 60px) and「とどける」is on the screen', inside && !!dl && dl.b <= 1194 && dl.t >= 0, J({ can, dl }));
    // one more than asked: it can be taken, and「とどける」goes away
    await take(page, 'apple'); await sleep(settle);
    b = await basket(page);
    ok('L7 ' + tag + ': a third apple CAN be taken: number 3, frames 1110, 1 apple left on the tree', (await harvested(page)) === 3 && b.filled === '1110' && (await tree(page)).ripeApples === 1 && (await tree(page)).count === '3', J(b));
    ok('L7 ' + tag + ': too many ->「とどける」and the note are gone (phase harvest)', !b.deliver && !(await doneNote(page)).shown && (await phase(page)) === 'harvest', J(b));
    ok('L7 ' + tag + ': the count is spoken as usual (いち, に, さん)', J(await spoken(page)) === J(['いち', 'に', 'さん']), J(await spoken(page)));
    ok('L7 ' + tag + ': no full-basket reaction (nothing nudges, the basket does not light, nothing is said about a full basket)', await noFullReaction(page), await live(page));
    await take(page, 'apple'); await sleep(settle);
    b = await basket(page); t = await tree(page);
    ok('L7 ' + tag + ': the fourth too: every apple is in the basket (number 4, frames 1111, the tree is empty), still no「とどける」/ note', (await harvested(page)) === 4 && b.filled === '1111' && t.ripe === 0 && t.visible === 0 && !b.deliver && !(await doneNote(page)).shown, J({ b, t }));
    const cp = await rect(page, '#canopy');
    await sleep(700); await page.mouse.click(cp.l + cp.w / 2, cp.t + cp.h / 2); await sleep(200);
    ok('L7 ' + tag + ': with all the apples in the basket there is still no full-basket reaction, also when the empty tree is touched', await noFullReaction(page) && (await harvested(page)) === 4 && J(await spoken(page)) === J(['いち', 'に', 'さん', 'よん']), J(await spoken(page)));
    // touch an apple in the basket: it goes back to the tree
    const sp1 = (await spoken(page)).length, au1 = await audible(page);
    const c1 = await giveBack(page, 1, { wait: false });
    if (motion) {
      await sleep(120);
      const mid = await page.evaluate(() => ({ flyers: document.querySelectorAll('.flyer').length, going: document.querySelectorAll('#appleGrid .apple[data-status="returning"]').length, hidden: Array.from(document.querySelectorAll('#appleGrid .apple[data-status="returning"]')).every((e) => getComputedStyle(e).visibility === 'hidden'), count: document.getElementById('countNum').textContent }));
      ok('L7 motion ON: the apple leaves its frame at once (number 3) and flies back (one flyer; its place on the tree is still empty)', mid.flyers === 1 && mid.going === 1 && mid.hidden && mid.count === '3' && (await basket(page)).filled === '1011', J(mid));
      const other = await page.evaluate(() => { const r = document.querySelector('#slots .slot[data-filled="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.click(other.x, other.y); await sleep(60);
      ok('L7 motion ON: while it is in flight a touch on another apple in the basket is not accepted (still number 3, one apple in flight)', (await harvested(page)) === 3 && (await page.evaluate(() => document.querySelectorAll('#appleGrid .apple[data-status="returning"]').length)) === 1);
    }
    await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150);
    b = await basket(page); t = await tree(page);
    ok('L7 ' + tag + ': a touch on the apple in the 2nd frame (the frame itself is what is hit): that frame is empty (1011), the number is 3, the apple hangs on the tree again', c1.onSlot && b.filled === '1011' && b.ret === '1011' && t.count === '3' && (await harvested(page)) === 3 && t.ripeApples === 1 && t.visible === 1 && (await page.evaluate(() => document.querySelectorAll('.flyer').length)) === 0, J({ c1, b, t }));
    ok('L7 ' + tag + ': the new count is spoken by the synthesised voice (さん); no file is played; the live region tells it', J((await spoken(page)).slice(sp1)) === J(['さん']) && (await audible(page)) === au1 && /もどしました。いま 3こ/.test(await live(page)), J((await spoken(page)).slice(sp1)) + ' ' + await live(page));
    ok('L7 ' + tag + ': still one too many: no「とどける」, no note', !b.deliver && !(await doneNote(page)).shown && (await phase(page)) === 'harvest');
    await giveBack(page, 0);
    b = await basket(page);
    ok('L7 ' + tag + ': one more back (the 1st frame): number 2 = the asked count ->「とどける」and the note are shown again (frames 0011, phase complete)', (await harvested(page)) === 2 && b.filled === '0011' && b.deliver && (await doneNote(page)).shown && (await doneNote(page)).text === NOTE_EXTRA && (await phase(page)) === 'complete' && (await tree(page)).ripeApples === 2, J(b));
    ok('L7 ' + tag + ': ... and「に」is spoken', (await spoken(page)).slice(-1)[0] === 'に', J(await spoken(page)));
    await sleep(700); await take(page, 'apple'); await sleep(settle);
    b = await basket(page);
    ok('L7 ' + tag + ': the next apple taken fills the first empty frame (1011): number 3,「とどける」gone again', b.filled === '1011' && (await harvested(page)) === 3 && !b.deliver && !(await doneNote(page)).shown, J(b));
    // two quick touches on two different apples: only one goes back
    await sleep(700);
    const two = await page.evaluate(() => Array.from(document.querySelectorAll('#slots .slot[data-filled="1"]')).slice(0, 2).map((s) => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    await page.mouse.click(two[0].x, two[0].y); await page.mouse.click(two[1].x, two[1].y);
    await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150);
    ok('L7 ' + tag + ': two touches in a row on two apples in the basket send back only one (number 2, frames 0011)', (await harvested(page)) === 2 && (await basket(page)).filled === '0011', J(await basket(page)));
    await giveBack(page, 0);
    b = await basket(page);
    ok('L7 ' + tag + ': below the asked count again (number 1, frames 0001): no「とどける」, no note,「いち」spoken', (await harvested(page)) === 1 && b.filled === '0001' && !b.deliver && !(await doneNote(page)).shown && (await phase(page)) === 'harvest' && (await spoken(page)).slice(-1)[0] === 'いち', J(b));
    // while the レベルアップ panel is open, nothing goes back
    await openPanel(page);
    await page.evaluate(() => document.querySelector('#slots .slot[data-filled="1"]').click()); await sleep(200);
    ok('L7 ' + tag + ': with the レベルアップ panel open a touch on the apple in the basket does nothing', (await harvested(page)) === 1 && (await basket(page)).filled === '0001');
    await closePanel(page);
    await sleep(300); await take(page, 'apple'); await waitPhase(page, 'complete'); await sleep(settle);
    ok('L7 ' + tag + ': one more taken: exactly 2 again (frames 1001) ->「とどける」shown', (await basket(page)).filled === '1001' && (await basket(page)).deliver && (await harvested(page)) === 2);
    await finish(page);
    const log = await readLog(page), keys = Object.keys(log[0].payload).sort().join(',');
    ok('L7 ' + tag + ':「とどける」succeeds (celebrate, thanks played, frames empty); the tree still shows the 2 apples', (await phase(page)) === 'celebrate' && (await audible(page, 'arigatou')) === 1 && (await tree(page)).visible === 2 && (await basket(page)).filled === '0000' && (await basket(page)).controls === 0, J(await basket(page)));
    ok('L7 ' + tag + ': one record: level extra, extra 2, goal 2, harvested 2, refusals 0 -- 15 keys, schemaVersion 1, nothing about the apples sent back', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 2 && log[0].payload.goal === 2 && log[0].payload.harvested === 2 && log[0].payload.refusals === 0 && log[0].schemaVersion === 1 && keys === 'decoys,durationSec,extra,goal,goalMax,goalMin,goalMode,harvested,level,moveSpeed,operation,refusals,showNumber,swipe,switchScan', keys + ' ' + J(log[0].payload));
    await again(page);
    ok('L7 ' + tag + ':「もう いちど」starts the next activity in the same level (4 apples, 4 empty frames, none taken)', (await tree(page)).apples === 4 && (await tree(page)).ripe === 4 && (await tree(page)).count === '0' && (await basket(page)).filled === '0000');
    ok('L7 ' + tag + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // back to nothing: the count 0 is spoken too; with the voice OFF nothing is spoken or played
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 1, level: 'extra', extra: 1 } });
    await start(page);
    await take(page, 'apple'); await waitPhase(page, 'complete');
    const sp0 = (await spoken(page)).length;
    await giveBack(page, 0);
    ok('L7 goal 1: the only apple sent back -> number 0, both frames empty, no「とどける」;「ぜろ」is spoken', (await harvested(page)) === 0 && (await basket(page)).filled === '00' && !(await basket(page)).deliver && (await phase(page)) === 'harvest' && J((await spoken(page)).slice(sp0)) === J(['ぜろ']), J((await spoken(page)).slice(sp0)));
    ok('L7 goal 1: no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    const q = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, voice: false } });
    await start(q.page);
    await take(q.page, 'apple'); await take(q.page, 'apple'); await take(q.page, 'apple');
    await giveBack(q.page, 0);
    ok('L7 voice OFF: the apple goes back (number 2,「とどける」shown) and nothing is spoken or played', (await harvested(q.page)) === 2 && (await basket(q.page)).deliver && (await spoken(q.page)).length === 0 && (await audible(q.page)) === 0 && q.page.__errors.length === 0, J(await spoken(q.page)));
    await q.context.close();
    // the frames are touch targets in this level: never below 44px, also on the smallest layout with twelve of them
    for (const vp of [{ n: 'phone landscape', w: 844, h: 390 }, { n: 'phone portrait', w: 390, h: 844 }, { n: 'iPad portrait', w: 820, h: 1180 }]) {
      const s = await newPage(browser, BASE, { settings: { goal: 10, level: 'extra', extra: 2 }, viewport: { width: vp.w, height: vp.h } });
      await start(s.page);
      const bb = await basket(s.page);
      ok('L7 ' + vp.n + ', goal 10 + 2: 12 frames, each at least 44px, no horizontal overflow', bb.n === 12 && bb.minSize >= 44 && await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), J(bb));
      await s.context.close();
    }
  }

  /* ---------------- L8 the level extra with the whole-screen touch (and strokes): the apple in the basket is in front of the surface ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 2, operation: 'anywhere' } });
    await start(page);
    ok('L8 anywhere: 4 apples on the tree, 4 frames', (await tree(page)).apples === 4 && (await tree(page)).slots === 4);
    const tap = async () => { const h0 = await harvested(page); for (let k = 0; k < 40 && (await harvested(page)) === h0; k++) { await page.mouse.click(300, 600); await sleep(150); } };
    await tap(); await tap();
    await waitPhase(page, 'complete'); await sleep(750);
    ok('L8 two taps: number 2, complete, 2 apples left on the tree; the note is the level extra one', (await harvested(page)) === 2 && (await tree(page)).ripeApples === 2 && (await doneNote(page)).text === NOTE_EXTRA, J(await doneNote(page)));
    const sp0 = (await spoken(page)).length;
    const c = await giveBack(page, 0);
    let b = await basket(page);
    ok('L8 a touch on the apple in the basket reaches the fruit, not the whole-screen surface: it goes back (number 1, frames 0100, phase harvest, no「とどける」)', c.onSlot && (await harvested(page)) === 1 && b.filled === '0100' && !b.deliver && (await phase(page)) === 'harvest' && (await tree(page)).ripeApples === 3, J({ c, b }));
    ok('L8 ... and the new count is spoken (いち)', J((await spoken(page)).slice(sp0)) === J(['いち']), J((await spoken(page)).slice(sp0)));
    // an EMPTY frame is not in front of the surface: a tap there is the usual whole-screen tap
    await sleep(700);
    const e = await page.evaluate(() => { const s = document.querySelector('#slots .slot[data-filled="0"]'); const r = s.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: top && top.id }; });
    await page.mouse.click(e.x, e.y);
    await waitPhase(page, 'complete'); await sleep(750);
    ok('L8 an empty frame is not a control: a tap on it is the whole-screen tap (the surface is hit) and takes an apple (number 2, complete)', e.top === 'surface' && (await harvested(page)) === 2 && (await basket(page)).deliver, J(e));
    await page.mouse.click(300, 600);
    await waitPhase(page, 'celebrate'); await sleep(300);
    ok('L8 the next tap on the screen delivers (celebrate); no full-basket reaction', (await phase(page)) === 'celebrate' && await noFullReaction(page), await live(page));
    const log = await readLog(page);
    ok('L8 record: level extra, extra 2, operation anywhere, harvested 2', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 2 && log[0].payload.operation === 'anywhere' && log[0].payload.harvested === 2, J(log[0].payload));
    ok('L8 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // strokes ON: a stroke on the screen takes an apple as before; a touch on the apple in the basket still sends it back
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, level: 'extra', extra: 1, operation: 'anywhere', swipe: true } });
    await start(page); await sleep(200);
    const stroke = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 160, y, { steps: 6 }); await page.mouse.up(); await sleep(900); };
    await stroke(300, 500);
    ok('L8 strokes ON: a stroke on the screen takes one apple (number 1)', (await harvested(page)) === 1);
    const f = await page.evaluate(() => { const r = document.querySelector('#slots .slot[data-filled="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await stroke(f.x, f.y);
    ok('L8 strokes ON: a stroke that starts on the apple in the basket takes nothing and sends nothing back (number 1)', (await harvested(page)) === 1 && (await basket(page)).filled === '1000', J(await basket(page)));
    const c = await giveBack(page, 0);
    ok('L8 strokes ON: a touch on the apple in the basket sends it back (number 0)', c.onSlot && (await harvested(page)) === 0 && (await basket(page)).filled === '0000' && (await tree(page)).ripeApples === 4);
    await sleep(500); await stroke(300, 500);
    ok('L8 strokes ON: after that a stroke takes an apple again (number 1); no errors', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L9 the button is not the child's: Switch Scan, whole-screen touch, strokes, the open panel ---------------- */
  {
    // Switch Scan: never a candidate, in any phase; nothing is offered while the panel is open
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1 } });
    await openSettings(page); await page.click('#settingsSheet [data-scan-on="1"]'); await sleep(300); await closeSettings(page);
    const cand = () => scanCand(page);
    const inPanel = () => page.evaluate(() => window.ringoScan.buildScanItems().some((e) => e.id === 'ringoLevelBtn' || !!e.closest('#ringoLevelPanel')));
    const seen = [];
    seen.push(['start', await cand(), await inPanel()]);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(800);
    seen.push(['harvest', await cand(), await inPanel()]);
    await openPanel(page);
    const openItems = await cand();
    const focusBefore = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.press('Enter'); await sleep(100); await page.keyboard.press(' '); await sleep(150);
    ok('L9 scan ON + panel open: no candidate at all; a switch press (Enter / Space) chooses nothing and takes nothing', openItems.length === 0 && (await panel(page)).open && (await saved(page)).level === 'extra' && (await harvested(page)) === 0 && focusBefore === 'ringoLevelPanel', J({ openItems, focusBefore }));
    await sleep(3000);
    ok('L9 ... and the scan highlight never moves into the panel while it is open', await page.evaluate(() => !document.querySelector('#ringoLevelPanel .scan-focus, #ringoLevelBtn.scan-focus')) && (await panel(page)).open);
    await closePanel(page);
    ok('L9 after closing, the scan is back on the fruit at once (focus on a ripe apple, not on the button)', await page.evaluate(() => { const a = document.activeElement; return !!a && a.classList.contains('apple') && a.getAttribute('data-status') === 'ripe'; }));
    for (let i = 0; i < 2; i++) { await page.evaluate(() => { const a = document.querySelector('#appleGrid .apple[data-status="ripe"]'); a.focus(); }); const h0 = await harvested(page); for (let k = 0; k < 30 && (await harvested(page)) === h0; k++) { await page.keyboard.press('Enter'); await sleep(150); } }
    await waitPhase(page, 'complete'); await sleep(200);
    seen.push(['complete', await cand(), await inPanel()]);
    ok('L9 level extra, before anything is taken the candidates are the 3 apples on the tree (no frame holds one yet)', J(seen[1][1]) === J(['apple#0', 'apple#1', 'apple#2']), J(seen[1][1]));
    ok('L9 level extra, count reached: the candidates are「とどける」first, then the apple left on the tree, then the apples in the basket', J(await cand()) === J(['deliverBtn', 'apple#2', 'slot#0', 'slot#1']), J(await cand()));
    // the scan itself reaches an apple in the basket; choosing it there sends that apple back
    await page.evaluate(() => window.ringoScan.refreshSwitchScanItems());
    await page.waitForFunction(() => { const a = document.activeElement; return !!a && a.classList.contains('slot') && a.classList.contains('scan-focus'); }, null, { timeout: 15000 });
    const onSlot = await page.evaluate(() => ({ id: document.activeElement.getAttribute('data-id'), label: document.activeElement.getAttribute('aria-label'), n: document.querySelectorAll('.scan-focus').length }));
    await page.evaluate(() => window.ringoScan.activateCurrentScanItem());
    await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150);
    ok('L9 the scan highlight reaches an apple in the basket (one highlight, labelled); choosing it sends it back: number 1, no「とどける」', onSlot.id === '0' && onSlot.n === 1 && /もどす/.test(onSlot.label || '') && (await harvested(page)) === 1 && !(await basket(page)).deliver && (await phase(page)) === 'harvest', J(onSlot));
    ok('L9 after that the candidates are the apples on the tree first, then the one still in the basket; the highlight is on a tree apple, not on the emptied frame', J(await cand()) === J(['apple#0', 'apple#2', 'slot#1']) && await page.evaluate(() => { const a = document.activeElement; return !!a && a.classList.contains('apple') && a.classList.contains('scan-focus') && a.getAttribute('data-status') === 'ripe'; }), J(await cand()));
    // keyboard on a frame (Enter): the same single path
    await sleep(500);
    await page.evaluate(() => document.querySelector('#slots .slot[data-ret="1"]').focus()); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#appleGrid .apple[data-status="returning"]'), null, { timeout: 10000 }); await sleep(150);
    ok('L9 Enter on the apple in the basket sends it back too (number 0); the candidates are the 3 apples on the tree again', (await harvested(page)) === 0 && J(await cand()) === J(['apple#0', 'apple#1', 'apple#2']), J(await cand()));
    for (let i = 0; i < 2; i++) { await sleep(400); await page.evaluate(() => { const a = document.querySelector('#appleGrid .apple[data-status="ripe"]'); a.focus(); }); const h0 = await harvested(page); for (let k = 0; k < 30 && (await harvested(page)) === h0; k++) { await page.keyboard.press('Enter'); await sleep(150); } }
    await waitPhase(page, 'complete'); await sleep(200);
    ok('L9 two apples taken again: at the count the highlight is on「とどける」', await page.evaluate(() => document.activeElement === document.getElementById('deliverBtn')));
    await finish(page);
    seen.push(['celebrate', await cand(), await inPanel()]);
    ok('L9 the button and the panel are never Switch Scan candidates (start / harvest / complete / celebrate)', seen.every((s) => s[2] === false && !s[1].includes('ringoLevelBtn')) && J(seen[0][1]) === J(['startBtn']) && J(seen[3][1]) === J(['againBtn']), J(seen));
    ok('L9 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // Switch Scan with the whole-screen touch in the level extra: the screen first, then the apples in the basket
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, operation: 'anywhere' } });
    await openSettings(page); await page.click('#settingsSheet [data-scan-on="1"]'); await sleep(300); await closeSettings(page);
    await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(800);
    const c0 = await scanCand(page);
    const press = async () => { const h0 = await harvested(page); for (let k = 0; k < 30 && (await harvested(page)) === h0; k++) { await page.evaluate(() => document.getElementById('surface').focus()); await page.keyboard.press('Enter'); await sleep(150); } };
    await press(); await sleep(500);
    const c1 = await scanCand(page);
    await press(); await waitPhase(page, 'complete'); await sleep(300);
    const c2 = await scanCand(page);
    ok('L9 anywhere + scan, level extra: candidates [surface] -> [surface, the apple in the basket] -> at the count [「とどける」, the apples in the basket]', J(c0) === J(['surface']) && J(c1) === J(['surface', 'slot#0']) && J(c2) === J(['deliverBtn', 'slot#0', 'slot#1']), J([c0, c1, c2]));
    ok('L9 anywhere + scan: no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // whole-screen touch (+ strokes): a tap on the button is not a harvest; with the panel open the screen does not react
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, operation: 'anywhere', swipe: true } });
    await start(page); await sleep(200);
    const b = await rect(page, '#ringoLevelBtn');
    await page.mouse.click(b.l + b.w / 2, b.t + b.h / 2); await sleep(300);
    ok('L9 anywhere: a tap on the button opens the panel and takes no apple', (await panel(page)).open && (await harvested(page)) === 0 && (await page.evaluate(() => document.querySelectorAll('#appleGrid .apple[data-status="falling"]').length)) === 0);
    await page.mouse.click(300, 700); await sleep(400);
    await page.mouse.move(300, 700); await page.mouse.down(); await page.mouse.move(460, 700, { steps: 6 }); await page.mouse.up(); await sleep(500);
    ok('L9 anywhere + panel open: a tap and a stroke on the screen take nothing', (await harvested(page)) === 0 && (await panel(page)).open);
    const opt = await rect(page, '#ringoLevelPanel [data-level-opt="extra"]');
    await page.mouse.click(opt.l + opt.w / 2, opt.t + opt.h / 2); await sleep(200);
    ok('L9 anywhere: a tap on a level in the panel changes the saved level only (activity untouched: 3 apples, none taken)', (await saved(page)).level === 'extra' && (await harvested(page)) === 0 && (await tree(page)).total === 3 && (await attr(page, 'data-level')) === 'normal');
    await closePanel(page); await sleep(100);
    await page.mouse.move(b.l + 4, b.t + b.h / 2); await page.mouse.down(); await page.mouse.move(b.l + b.w - 4, b.t + b.h / 2, { steps: 6 }); await page.mouse.up(); await sleep(500);
    const afterStroke = await harvested(page);
    if ((await panel(page)).open) await closePanel(page);
    ok('L9 anywhere + strokes ON: a stroke that starts on the button takes no apple', afterStroke === 0);
    await page.mouse.click(300, 700); await sleep(900);
    ok('L9 after closing the panel the whole-screen touch works again (1 apple)', (await harvested(page)) === 1);
    ok('L9 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }
  {
    // apple-touch: while the panel is open, the fruit under it or beside it cannot be taken; settings / help close it
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 3 } });
    await start(page);
    await openPanel(page);
    const inert = await page.evaluate(() => document.getElementById('stage').hasAttribute('inert'));
    const a = await rect(page, '#appleGrid .apple[data-status="ripe"]:last-child');
    await page.mouse.click(a.l + a.w / 2, a.t + a.h / 2); await sleep(300);
    await page.evaluate(() => document.querySelector('#appleGrid .apple[data-status="ripe"]').click()); await sleep(300);
    ok('L9 apple-touch + panel open: the stage is inert and a touch on an apple takes nothing', inert && (await harvested(page)) === 0 && (await tree(page)).ripe === 3);
    await page.click('#donomanaHelpBtn'); await sleep(200);
    ok('L9 opening「つかいかた」closes the panel', !(await panel(page)).open && await page.isVisible('#helpSheet'));
    await openPanel(page);
    ok('L9 opening the panel closes「つかいかた」', (await panel(page)).open && await page.isHidden('#helpSheet'));
    await closePanel(page);
    await take(page, 'apple');
    ok('L9 after closing, the apples can be taken again', (await harvested(page)) === 1 && page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L10 the level extra together with the decoys and with the random goal ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, dummy: true } });
    await start(page);
    const t0 = await tree(page);
    ok('L10 goal 2 + extra 1 + decoys: 3 apples and 1 banana on the tree, 3 frames (one for every apple, none for the banana)', t0.apples === 3 && t0.decoys === 1 && t0.slots === 3, J(t0));
    ok('L10 the request is the level extra one: ringo-b-2.mp3 played once, the bubble says「' + B_BUBBLE_TEXT(2) + '」', (await audible(page, 'ringo-b-2\\.mp3')) === 1 && (await audible(page, 'ringo-2\\.mp3')) === 0 && (await bubbleSaid(page)) === squash(B_BUBBLE_TEXT(2)), await bubbleSaid(page));
    await take(page, 'banana'); await take(page, 'apple'); await take(page, 'apple'); await waitPhase(page, 'complete');
    let b = await basket(page);
    ok('L10 banana + 2 apples: the banana is beside the frames (tray 1), frames 110, number 2 ->「とどける」shown as before', b.tray === 1 && b.filled === '110' && b.deliver && (await harvested(page)) === 2, J(b));
    // the banana in the tray is not a control: only the farmer's refusal takes it out
    await sleep(700);
    const tr = await page.evaluate(() => { const s = document.querySelector('#decoyTray svg'); const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, buttons: document.querySelectorAll('#decoyTray button, #decoyTray [tabindex]').length }; });
    await page.mouse.click(tr.x, tr.y); await sleep(300);
    ok('L10 a touch on the banana beside the frames does nothing (still in the tray, number 2, complete)', tr.buttons === 0 && (await basket(page)).tray === 1 && (await harvested(page)) === 2 && (await phase(page)) === 'complete');
    await deliver(page); await waitPhase(page, 'refusing', 5000);
    ok('L10 delivering with the banana is refused as before (okotowari.mp3, the refusal bubble; the request pieces are hidden)', (await audible(page, 'okotowari')) === 1 && await page.isVisible('#bubbleRefuse') && await page.isHidden('#bubbleExact') && await page.isHidden('#bubbleLead'));
    await waitPhase(page, 'harvest', 20000); await sleep(500);
    const t1 = await tree(page);
    ok('L10 ... everything is back on the tree (3 apples + banana, number 0, frames empty)', t1.ripe === 4 && t1.apples === 3 && t1.count === '0' && (await attr(page, 'data-refusals')) === '1' && (await basket(page)).filled === '000' && (await basket(page)).tray === 0, J(t1));
    ok('L10 the request after the refusal is the level extra one again: ringo-b-2.mp3 a second time (never ringo-2.mp3), the same bubble', (await audible(page, 'ringo-b-2\\.mp3')) === 2 && (await audible(page, 'ringo-2\\.mp3')) === 0 && (await bubbleSaid(page)) === squash(B_BUBBLE_TEXT(2)), await bubbleSaid(page));
    // too many, with a banana: an apple sent back makes the count exact; the banana still means a refusal
    await take(page, 'apple'); await take(page, 'apple'); await take(page, 'apple'); await take(page, 'banana');
    b = await basket(page);
    ok('L10 3 apples + banana: number 3 (too many), frames 111, tray 1, no「とどける」', (await harvested(page)) === 3 && b.filled === '111' && b.tray === 1 && !b.deliver && (await phase(page)) === 'harvest', J(b));
    await giveBack(page, 1);
    b = await basket(page);
    ok('L10 one apple sent back: number 2 ->「とどける」shown (frames 101; the banana is still in the tray)', (await harvested(page)) === 2 && b.filled === '101' && b.tray === 1 && b.deliver && (await phase(page)) === 'complete', J(b));
    await deliver(page); await waitPhase(page, 'refusing', 5000);
    await waitPhase(page, 'harvest', 20000); await sleep(500);
    ok('L10「とどける」with the banana in the basket is refused again; everything is back (4 ripe, frames empty, refusals 2)', (await tree(page)).ripe === 4 && (await basket(page)).filled === '000' && (await attr(page, 'data-refusals')) === '2' && (await audible(page, 'ringo-b-2\\.mp3')) === 3);
    await harvest(page, 2);
    ok('L10 with decoys in the level extra the note is the level extra one too', (await doneNote(page)).text === NOTE_EXTRA, J(await doneNote(page)));
    await take(page, 'banana'); await sleep(200);
    ok('L10 a banana taken while the count is exact: the count stays 2 and「とどける」stays', (await harvested(page)) === 2 && (await basket(page)).deliver && (await basket(page)).tray === 1 && (await phase(page)) === 'complete');
    await deliver(page); await waitPhase(page, 'refusing', 5000);
    await waitPhase(page, 'harvest', 20000); await sleep(500);
    await harvest(page, 2);
    await finish(page);
    const log = await readLog(page);
    ok('L10 apples only: delivered; record level extra, extra 1, decoys 1, refusals 3, goal 2, harvested 2', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 1 && log[0].payload.decoys === 1 && log[0].payload.refusals === 3 && log[0].payload.goal === 2 && log[0].payload.harvested === 2, J(log[0].payload));
    ok('L10 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    const r = await newPage(browser, BASE, { settings: { goal: 3, goalMode: 'random', goalMin: 9, goalMax: 10, level: 'extra', extra: 3 } });
    await start(r.page);
    const g = parseInt(await attr(r.page, 'data-goal'), 10), trr = await tree(r.page), ex = expectPlan(g, 3, false).extra;
    ok('L10 random goal 9..10 + extra 3: drawn ' + g + ' -> ' + (g + ex) + ' apples and as many frames, never more than 12', (g === 9 || g === 10) && trr.apples === g + ex && trr.slots === g + ex && trr.total <= 12, J(trr));
    ok('L10 random goal: the request file is the one of the drawn number (ringo-b-' + g + '.mp3), the bubble names it', J(await plays(r.page)) === J(['ringo-b-' + g + '.mp3']) && (await bubbleSaid(r.page)) === squash(B_BUBBLE_TEXT(g)), J(await plays(r.page)));
    await r.context.close();
  }

  /* ---------------- L11 the level ふつう: nothing changes for it (frames = the goal, plain markers; the request as before) ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'normal', extra: 3 } });
    await start(page);
    let b = await basket(page);
    ok('L11 level ふつう (with a saved extra 3): 2 apples, 2 frames -- plain markers (div), the basket is an image as before, no control in it', (await tree(page)).total === 2 && b.n === 2 && b.tags === 'DIV' && b.role === 'img' && b.ret === '--' && b.controls === 0 && (await page.evaluate(() => document.querySelectorAll('#basket button, #basket [tabindex]').length)) === 0, J(b));
    ok('L11 level ふつう: the request is the one as before (ringo-2.mp3 once, no ringo-b file; the bubble says「' + N_BUBBLE_TEXT(2) + '」, no second sentence)', J(await plays(page)) === J(['ringo-2.mp3']) && (await bubbleSaid(page)) === squash(N_BUBBLE_TEXT(2)) && (await page.evaluate(() => !document.getElementById('bubbleExact'))), J(await plays(page)) + ' ' + await bubbleSaid(page));
    await take(page, 'apple');
    const sp0 = (await spoken(page)).length;
    const f = await page.evaluate(() => { const s = document.querySelector('#slots .slot[data-filled="1"]'); const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await sleep(700); await page.mouse.click(f.x, f.y); await sleep(300);
    await page.evaluate(() => document.querySelector('#slots .slot[data-filled="1"]').click()); await sleep(300);
    b = await basket(page);
    ok('L11 level ふつう: a touch on the apple in the basket does nothing (number 1, the frame still holds it, 1 apple on the tree, nothing spoken)', (await harvested(page)) === 1 && b.filled === '10' && (await tree(page)).ripeApples === 1 && (await spoken(page)).length === sp0 && (await page.evaluate(() => document.querySelectorAll('.flyer').length)) === 0, J(b));
    ok('L11 level ふつう: the Switch Scan candidates are the fruit on the tree only (no frame)', J(await scanCand(page)) === J(['apple#1']), J(await scanCand(page)));
    await take(page, 'apple'); await waitPhase(page, 'complete'); await sleep(150);
    ok('L11 level ふつう: at the count the only Switch Scan candidate is「とどける」', J(await scanCand(page)) === J(['deliverBtn']), J(await scanCand(page)));
    const n11 = await doneNote(page);
    ok('L11 level ふつう: the note stays「' + NOTE_NORMAL + '」', n11.shown && n11.text === NOTE_NORMAL, J(n11));
    // the note follows the level the ACTIVITY is played in, not the one saved meanwhile
    await openPanel(page); await choose(page, 'extra'); await closePanel(page);
    ok('L11 「おおめから ぴったり」saved during this ふつう activity: its note does not change', (await doneNote(page)).text === NOTE_NORMAL && (await saved(page)).level === 'extra', J(await doneNote(page)));
    await openPanel(page); await choose(page, 'normal'); await closePanel(page);
    await finish(page);
    const log = await readLog(page);
    ok('L11 record: level normal, extra 0 (15 keys)', log.length === 1 && log[0].payload.level === 'normal' && log[0].payload.extra === 0 && Object.keys(log[0].payload).length === 15, J(log[0].payload));
    // ふつう after おおめから ぴったり in the same page: nothing of that level is left behind
    await openPanel(page); await choose(page, 'extra'); await closePanel(page);
    await again(page);
    ok('L11 (the next activity is in the level extra: 2 + 3 apples, 5 frames, buttons, the second sentence in the bubble)', (await basket(page)).n === 5 && (await basket(page)).tags === 'BUTTON' && await page.isVisible('#bubbleExact'), J(await basket(page)));
    await openPanel(page); await choose(page, 'normal'); await page.click('#ringoLevelRestart'); await sleep(800);
    b = await basket(page);
    ok('L11 back to ふつう with「いますぐ はじめなおす」: 2 frames, plain markers again, the basket an image, the bubble as before (no second sentence), ringo-2.mp3', b.n === 2 && b.tags === 'DIV' && b.role === 'img' && (await bubbleSaid(page)) === squash(N_BUBBLE_TEXT(2)) && (await page.evaluate(() => !document.getElementById('bubbleExact'))) && (await plays(page)).slice(-1)[0] === 'ringo-2.mp3', J(b) + ' ' + J(await plays(page)));
    ok('L11 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L12 the request of the level extra: its own files (ringo-b-<goal>.mp3) and its own words ---------------- */
  {
    for (let g = 1; g <= 10; g++) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: g, level: 'extra', extra: 1 } });
      await start(page);
      ok('L12 goal ' + g + ': exactly one audible play, ringo-b-' + g + '.mp3 (not ringo-' + g + '.mp3); nothing synthesised', J(await plays(page)) === J(['ringo-b-' + g + '.mp3']) && (await spoken(page)).length === 0, J(await plays(page)) + ' ' + J(await spoken(page)));
      ok('L12 goal ' + g + ': the bubble says「' + B_BUBBLE_TEXT(g) + '」', (await bubbleSaid(page)) === squash(B_BUBBLE_TEXT(g)) && page.__errors.length === 0, await bubbleSaid(page));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 3, level: 'extra', extra: 1 } });
      await start(page);
      const lay = await page.evaluate(() => { const bu = document.getElementById('bubble').getBoundingClientRect(), x = document.getElementById('bubbleExact').getBoundingClientRect(), p = document.getElementById('reqPics').getBoundingClientRect(); return { inside: x.left >= bu.left && x.right <= bu.right && x.top >= bu.top && x.bottom <= bu.bottom, beforePics: document.getElementById('bubbleExact').nextElementSibling === document.getElementById('reqPics'), pics: document.querySelectorAll('#reqPics svg').length, overflow: document.documentElement.scrollWidth > innerWidth }; });
      ok('L12 the second sentence sits inside the bubble, between the request and its pictures (3 pictures = the asked count, not the 4 on the tree)', lay.inside && lay.beforePics && lay.pics === 3 && !lay.overflow, J(lay));
      const before = await page.evaluate(() => window.__au.length);
      await take(page, 'apple');
      const cut = await page.evaluate((n) => window.__au.slice(n).some((o) => o.op === 'pause' && /ringo-b-3\.mp3$/.test(o.src)), before);
      ok('L12 the first apple taken cuts the request file (ringo-b-3.mp3 paused) and the count is spoken instead', cut && J(await spoken(page)) === J(['いち']), J(await spoken(page)));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 4, level: 'extra', extra: 1, showNumber: false }, viewport: { width: 390, height: 844 } });
      await start(page);
      ok('L12 number hidden, phone portrait: the bubble says「りんごを とってね。ぴったり おねがいね」, nothing overflows; the file is still ringo-b-4.mp3', (await bubbleSaid(page)) === squash('りんごを とってね。ぴったり おねがいね') && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && J(await plays(page)) === J(['ringo-b-4.mp3']), await bubbleSaid(page));
      await context.close();
    }
    for (const c of [{ name: 'play() is refused', init: 'window.__auFail = true;', g: 5 }, { name: 'the file never loaded', init: 'window.__auErrorSrc = "ringo-b-3";', g: 3 }, { name: 'the file never loaded (10)', init: 'window.__auErrorSrc = "ringo-b-10";', g: 10 }]) {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: c.g, level: 'extra', extra: 1 }, init: c.init });
      await start(page);
      ok('L12 fallback, ' + c.name + ' (goal ' + c.g + '): the synthesised voice says the same sentence「' + B_SAID(c.g) + '」, once', J(await spoken(page)) === J([B_SAID(c.g)]), J(await spoken(page)));
      ok('L12 fallback, ' + c.name + ': the ordinary request file is not used instead, the bubble is the same, no error', (await audible(page, 'ringo-' + c.g + '\\.mp3')) === 0 && (await bubbleSaid(page)) === squash(B_BUBBLE_TEXT(c.g)) && page.__errors.length === 0, page.__errors.join('|'));
      await context.close();
    }
    {
      const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1, voice: false } });
      await start(page);
      ok('L12 voice OFF: nothing is played (not even muted) and nothing is spoken; the bubble still says the level extra request', (await page.evaluate(() => window.__au.filter((o) => o.op === 'play').length)) === 0 && (await spoken(page)).length === 0 && (await bubbleSaid(page)) === squash(B_BUBBLE_TEXT(2)));
      await context.close();
    }
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
