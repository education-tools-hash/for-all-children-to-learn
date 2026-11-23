// Real-browser (Playwright / Chromium) test for「レベルアップ」of ringo-potton-app.html, Phase 1
// (Phase RINGO-POTTON-LEVEL-UP-1): the teacher's レベルアップ button + panel, and the level「おおめから ぴったり」(extra).
//
// settings.level = 'normal' (default, the activity as before) | 'kinds2' (「くだものを 2 しゅるい」, NOT available in this
// Phase: shown as unavailable, reads as normal from storage) | 'extra' (「おおめから ぴったり」). settings.extra = 1..3
// (default 2). In the level extra the tree carries goal + extra apples while the basket frames stay at the goal; the
// tree never holds more than 12 fruit (decoys give way first, never below one while the dummy option is on; then
// the extras, never below one). After the count is reached the tree is not shrunk, and touching a fruit that is
// still on it (apple-touch only) takes nothing: the fruit nudges, the basket frame lights once, the live region says
// 「かごは いっぱいです」. Delivery always succeeds. The record gets level and extra (15 keys, schemaVersion 1).
// When the count is reached the note under the basket says「たのまれた かずが かごに はいりました。」in the level extra
// (apples are still on the tree); in the level ふつう it stays「りんごが ぜんぶ かごに はいりました。」.
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
    for (const c of [{ name: 'unknown level "turbo"', s: { goal: 2, level: 'turbo', extra: 3 }, apples: 2, level: 'normal' }, { name: 'level "kinds2" (not available yet)', s: { goal: 2, level: 'kinds2' }, apples: 2, level: 'normal' },
      { name: 'level extra with extra 9 (out of range -> 2)', s: { goal: 2, level: 'extra', extra: 9 }, apples: 4, level: 'extra' }, { name: 'level extra with extra "x" (-> 2)', s: { goal: 2, level: 'extra', extra: 'x' }, apples: 4, level: 'extra' },
      { name: 'level extra with extra 0 (-> 2)', s: { goal: 2, level: 'extra', extra: 0 }, apples: 4, level: 'extra' }, { name: 'level extra without extra (-> 2)', s: { goal: 2, level: 'extra' }, apples: 4, level: 'extra' }]) {
      const q = await newPage(browser, BASE, { settings: c.s });
      await start(q.page);
      const tt = await tree(q.page);
      ok('L1 ' + c.name + ': ' + c.apples + ' apples on the tree, 2 frames, data-level ' + c.level, tt.apples === c.apples && tt.slots === 2 && (await attr(q.page, 'data-level')) === c.level && q.page.__errors.length === 0, J(tt));
      await q.context.close();
    }
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
    ok('L2 ' + vp.n + ': pressing it opens the panel under the button (aria-expanded true), with the three levels and「とじる」', p.open && p.expanded === 'true' && pr.t >= b1.b && p.opts.map((o) => o.v).join() === 'normal,kinds2,extra' && p.opts[0].text === 'ふつう' && /^くだものを 2 しゅるい/.test(p.opts[1].text) && p.opts[2].text === 'おおめから ぴったり' && p.close, J({ p, pr }));
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

  /* ---------------- L3「くだものを 2 しゅるい」cannot be chosen in this Phase ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2 } });
    await openPanel(page);
    const p = await panel(page);
    ok('L3 the option is shown as not available: disabled, labelled（じゅんびちゅう）', p.opts[1].disabled === true && /じゅんびちゅう/.test(p.opts[1].text) && p.opts[0].disabled === false && p.opts[2].disabled === false, J(p.opts));
    const box = await rect(page, '#ringoLevelPanel [data-level-opt="kinds2"]');
    await page.mouse.click(box.l + box.w / 2, box.t + box.h / 2); await sleep(150);
    await page.evaluate(() => document.querySelector('#ringoLevelPanel [data-level-opt="kinds2"]').click()); await sleep(150);
    const p2 = await panel(page), sv = await saved(page);
    ok('L3 pressing it does nothing: nothing saved, still「ふつう」, the panel stays as it was', (sv === null || sv.level === undefined || sv.level === 'normal') && p2.open && p2.opts[0].pressed === 'true' && p2.opts[1].pressed === 'false', J({ sv, p2 }));
    await closePanel(page); await start(page);
    ok('L3 the next activity is the usual one (2 apples)', (await tree(page)).total === 2 && page.__errors.length === 0);
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
    ok('L4 the activity that starts now is in the level extra: 2 + 2 apples, 2 frames', t.apples === 4 && t.slots === 2 && (await attr(page, 'data-level')) === 'extra', J(t));
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
    const reqBefore = await audible(page, 'ringo-2');
    await openPanel(page); await choose(page, 'extra');
    ok('L4 mid-activity: choosing「おおめから ぴったり」again: note + restart shown, activity untouched (2 apples, 1 taken)', (await panel(page)).restart && (await tree(page)).total === 2 && (await harvested(page)) === 1);
    await page.click('#ringoLevelRestart'); await sleep(800);
    t = await tree(page);
    ok('L4「いますぐ はじめなおす」: the panel closes, a new activity starts at once in the level extra (4 apples, none taken, request played again)', !(await panel(page)).open && t.apples === 4 && t.count === '0' && t.ripe === 4 && (await phase(page)) === 'harvest' && (await attr(page, 'data-level')) === 'extra' && (await audible(page, 'ringo-2')) === reqBefore + 1, J(t));
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
      ok('L5 goal ' + goal + ' + extra 3: ' + (goal + ex.extra) + ' apples on the tree (extra ' + ex.extra + '), ' + goal + ' frames, total <= 12', t.apples === goal + ex.extra && t.decoys === 0 && t.slots === goal && t.total <= 12, J(t));
      await context.close();
    }
    ok('L5 (the rule) goal 10 + extra 3 -> 2 extras; goal 9 + extra 3 -> 3', expectPlan(10, 3, false).extra === 2 && expectPlan(9, 3, false).extra === 3);
    for (const c of [{ goal: 10, want: 3 }, { goal: 10, want: 1 }, { goal: 9, want: 3 }, { goal: 9, want: 1 }, { goal: 8, want: 2 }, { goal: 8, want: 3 }, { goal: 7, want: 3 }, { goal: 3, want: 3 }]) {
      const ex = expectPlan(c.goal, c.want, true), usual = Math.max(0, Math.min(1 + Math.floor(c.goal / 4), 12 - c.goal));
      const { context, page } = await newPage(browser, BASE, { settings: { goal: c.goal, level: 'extra', extra: c.want, dummy: true } });
      await start(page);
      const t = await tree(page);
      ok('L5 with decoys, goal ' + c.goal + ' + extra ' + c.want + ': decoys ' + usual + ' -> ' + ex.decoys + ', extras ' + ex.extra + ' (total ' + (c.goal + ex.decoys + ex.extra) + ')', t.apples === c.goal + ex.extra && t.decoys === ex.decoys && t.total <= 12 && ex.extra >= 1 && ex.decoys >= 1 && t.slots === c.goal, J(t));
      await context.close();
    }
    ok('L5 (the rule) goal 10 with decoys: 2 decoys give way to 1 first, and 1 extra is left', J(expectPlan(10, 3, true)) === J({ decoys: 1, extra: 1 }) && J(expectPlan(9, 2, true)) === J({ decoys: 1, extra: 2 }) && J(expectPlan(8, 2, true)) === J({ decoys: 2, extra: 2 }));
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

  /* ---------------- L7 the level extra, apple-touch: stop at the asked count; the tree is not shrunk; the full basket ---------------- */
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
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 2 }, motion });
    await start(page);
    const hHarvest = (await rect(page, '#canopy')).h;
    await harvest(page, 2);
    await sleep(motion ? 300 : 0);
    const t = await tree(page), can = await rect(page, '#canopy'), dl = await rect(page, '#deliverBtn');
    ok('L7 ' + tag + ': two apples taken -> phase complete, number 2, both frames filled, 2 apples still on the tree', (await phase(page)) === 'complete' && t.count === '2' && t.filled === 2 && t.slots === 2 && t.ripeApples === 2 && t.visible === 2, J(t));
    const dn = await doneNote(page);
    ok('L7 ' + tag + ': the note says「' + NOTE_EXTRA + '」(not「ぜんぶ」: apples are still on the tree)', dn.shown && dn.text === NOTE_EXTRA, J(dn));
    ok('L7 ' + tag + ': the tree is not shrunk (' + hHarvest + 'px -> ' + can.h + 'px; the usual shrink would give ' + normalCompleteCanopy + 'px)', can.h > normalCompleteCanopy * 1.5 && can.h >= hHarvest * 0.6, hHarvest + ' -> ' + can.h);
    const inside = await page.evaluate(() => { const c = document.getElementById('canopy').getBoundingClientRect(); return Array.from(document.querySelectorAll('#appleGrid .apple[data-status="ripe"]')).every((e) => { const r = e.getBoundingClientRect(); return r.width >= 60 && r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 && r.bottom <= innerHeight; }); });
    ok('L7 ' + tag + ': the apples left on the tree are fully visible inside the crown (>= 60px) and「とどける」is on the screen', inside && !!dl && dl.b <= 1194 && dl.t >= 0, J({ can, dl }));
    // the full basket: touch a fruit that is still on the tree
    const sp0 = (await spoken(page)).length, au0 = await audible(page);
    const pos = await rect(page, '#appleGrid .apple[data-status="ripe"]');
    await page.mouse.click(pos.l + pos.w / 2, pos.t + pos.h / 2); await sleep(120);
    const r = await page.evaluate(() => { const a = document.querySelector('#appleGrid .apple[data-status="ripe"]'); return { nudge: a.classList.contains('is-nudge'), anim: getComputedStyle(a).animationName, flash: document.getElementById('basket').classList.contains('is-full-flash'), glow: getComputedStyle(document.getElementById('basket')).boxShadow !== 'none' }; });
    const t2 = await tree(page);
    ok('L7 ' + tag + ': touching it takes nothing: still 2 on the tree, number 2, phase complete', t2.ripeApples === 2 && t2.count === '2' && t2.filled === 2 && (await phase(page)) === 'complete' && (await harvested(page)) === 2, J(t2));
    ok('L7 ' + tag + ': the basket frame lights and the live region says「かごは いっぱいです」', r.flash && r.glow && /かごは いっぱいです/.test(await live(page)), J(r) + ' ' + await live(page));
    ok('L7 ' + tag + (motion ? ': the touched apple nudges in place (animation "nudge")' : ': the touched apple does NOT move (no animation class)'), motion ? (r.nudge && r.anim === 'nudge') : (!r.nudge && r.anim === 'none'), J(r));
    ok('L7 ' + tag + ': no voice (nothing spoken, no file played)', (await spoken(page)).length === sp0 && (await audible(page)) === au0);
    await sleep(900);
    const r2 = await page.evaluate(() => ({ flash: document.getElementById('basket').classList.contains('is-full-flash'), nudge: !!document.querySelector('#appleGrid .apple.is-nudge') }));
    ok('L7 ' + tag + ': the light is over after a moment (once), no class is left behind', !r2.flash && !r2.nudge, J(r2));
    for (let i = 0; i < 3; i++) { await page.mouse.click(pos.l + pos.w / 2, pos.t + pos.h / 2); await sleep(150); }
    ok('L7 ' + tag + ': touching again and again never takes one (number 2, 2 on the tree)', (await harvested(page)) === 2 && (await tree(page)).ripeApples === 2);
    await finish(page);
    const log = await readLog(page), keys = Object.keys(log[0].payload).sort().join(',');
    ok('L7 ' + tag + ':「とどける」succeeds (celebrate, thanks played); the tree still shows the 2 apples', (await phase(page)) === 'celebrate' && (await audible(page, 'arigatou')) === 1 && (await tree(page)).visible === 2);
    ok('L7 ' + tag + ': one record: level extra, extra 2, goal 2, harvested 2, refusals 0 -- 15 keys, schemaVersion 1, nothing about the touches on the full basket', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 2 && log[0].payload.goal === 2 && log[0].payload.harvested === 2 && log[0].payload.refusals === 0 && log[0].schemaVersion === 1 && keys === 'decoys,durationSec,extra,goal,goalMax,goalMin,goalMode,harvested,level,moveSpeed,operation,refusals,showNumber,swipe,switchScan', keys + ' ' + J(log[0].payload));
    await again(page);
    ok('L7 ' + tag + ':「もう いちど」starts the next activity in the same level (4 apples, 2 frames, none taken)', (await tree(page)).apples === 4 && (await tree(page)).ripe === 4 && (await tree(page)).count === '0');
    ok('L7 ' + tag + ': no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L8 the level extra with the whole-screen touch: as before, the next tap is「とどける」 ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 2, operation: 'anywhere' } });
    await start(page);
    ok('L8 anywhere: 4 apples on the tree, 2 frames', (await tree(page)).apples === 4 && (await tree(page)).slots === 2);
    for (let i = 0; i < 2; i++) { const h0 = await harvested(page); for (let k = 0; k < 40 && (await harvested(page)) === h0; k++) { await page.mouse.click(300, 600); await sleep(150); } }
    await waitPhase(page, 'complete'); await sleep(750);
    ok('L8 two taps: number 2, complete, 2 apples left on the tree; the note is the level extra one', (await harvested(page)) === 2 && (await tree(page)).ripeApples === 2 && (await doneNote(page)).text === NOTE_EXTRA, J(await doneNote(page)));
    await page.mouse.click(300, 600);
    await waitPhase(page, 'celebrate'); await sleep(300);
    const fl = await page.evaluate(() => document.getElementById('basket').classList.contains('is-full-flash') || !!document.querySelector('.apple.is-nudge'));
    ok('L8 the next tap delivers (celebrate); no full-basket reaction, nothing said about a full basket', (await phase(page)) === 'celebrate' && !fl && !/いっぱい/.test(await live(page)), await live(page));
    const log = await readLog(page);
    ok('L8 record: level extra, extra 2, operation anywhere, harvested 2', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 2 && log[0].payload.operation === 'anywhere' && log[0].payload.harvested === 2, J(log[0].payload));
    ok('L8 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  /* ---------------- L9 the button is not the child's: Switch Scan, whole-screen touch, strokes, the open panel ---------------- */
  {
    // Switch Scan: never a candidate, in any phase; nothing is offered while the panel is open
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'extra', extra: 1 } });
    await openSettings(page); await page.click('#settingsSheet [data-scan-on="1"]'); await sleep(300); await closeSettings(page);
    const cand = () => page.evaluate(() => window.ringoScan.buildScanItems().map((e) => e.id || (e.getAttribute('data-kind') + '#' + e.getAttribute('data-id'))));
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
    ok('L9 level extra, count reached: the only candidate is「とどける」(the apples left on the tree are not offered)', J(await cand()) === J(['deliverBtn']), J(await cand()));
    await finish(page);
    seen.push(['celebrate', await cand(), await inPanel()]);
    ok('L9 the button and the panel are never Switch Scan candidates (start / harvest / complete / celebrate)', seen.every((s) => s[2] === false && !s[1].includes('ringoLevelBtn')) && J(seen[0][1]) === J(['startBtn']) && J(seen[3][1]) === J(['againBtn']), J(seen));
    ok('L9 no errors', page.__errors.length === 0, page.__errors.join('|'));
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
    ok('L10 goal 2 + extra 1 + decoys: 3 apples and 1 banana on the tree, 2 frames', t0.apples === 3 && t0.decoys === 1 && t0.slots === 2, J(t0));
    await take(page, 'banana'); await take(page, 'apple'); await take(page, 'apple'); await waitPhase(page, 'complete');
    await deliver(page); await waitPhase(page, 'refusing', 5000);
    await waitPhase(page, 'harvest', 20000); await sleep(500);
    const t1 = await tree(page);
    ok('L10 delivering with the banana is refused as before; everything is back on the tree (3 apples + banana, number 0)', t1.ripe === 4 && t1.apples === 3 && t1.count === '0' && (await attr(page, 'data-refusals')) === '1', J(t1));
    await harvest(page, 2);
    ok('L10 with decoys in the level extra the note is the level extra one too', (await doneNote(page)).text === NOTE_EXTRA, J(await doneNote(page)));
    await finish(page);
    const log = await readLog(page);
    ok('L10 apples only: delivered; record level extra, extra 1, decoys 1, refusals 1, goal 2', log.length === 1 && log[0].payload.level === 'extra' && log[0].payload.extra === 1 && log[0].payload.decoys === 1 && log[0].payload.refusals === 1 && log[0].payload.goal === 2, J(log[0].payload));
    ok('L10 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
    const r = await newPage(browser, BASE, { settings: { goal: 3, goalMode: 'random', goalMin: 9, goalMax: 10, level: 'extra', extra: 3 } });
    await start(r.page);
    const g = parseInt(await attr(r.page, 'data-goal'), 10), tr = await tree(r.page);
    ok('L10 random goal 9..10 + extra 3: drawn ' + g + ' -> ' + (g + expectPlan(g, 3, false).extra) + ' apples, ' + g + ' frames, never more than 12', (g === 9 || g === 10) && tr.apples === g + expectPlan(g, 3, false).extra && tr.slots === g && tr.total <= 12, J(tr));
    await r.context.close();
  }

  /* ---------------- L11 the level ふつう carries the new record fields and nothing else changes for it ---------------- */
  {
    const { context, page } = await newPage(browser, BASE, { settings: { goal: 2, level: 'normal', extra: 3 } });
    await start(page);
    ok('L11 level ふつう (with a saved extra 3): 2 apples, 2 frames', (await tree(page)).total === 2 && (await tree(page)).slots === 2);
    await harvest(page, 2);
    const fl0 = await page.evaluate(() => document.getElementById('basket').classList.contains('is-full-flash'));
    const n11 = await doneNote(page);
    ok('L11 level ふつう: the note stays「' + NOTE_NORMAL + '」', n11.shown && n11.text === NOTE_NORMAL, J(n11));
    // the note follows the level the ACTIVITY is played in, not the one saved meanwhile
    await openPanel(page); await choose(page, 'extra'); await closePanel(page);
    ok('L11 「おおめから ぴったり」saved during this ふつう activity: its note does not change', (await doneNote(page)).text === NOTE_NORMAL && (await saved(page)).level === 'extra', J(await doneNote(page)));
    await openPanel(page); await choose(page, 'normal'); await closePanel(page);
    await finish(page);
    const log = await readLog(page);
    ok('L11 record: level normal, extra 0 (15 keys)', log.length === 1 && log[0].payload.level === 'normal' && log[0].payload.extra === 0 && Object.keys(log[0].payload).length === 15 && !fl0, J(log[0].payload));
    ok('L11 no errors', page.__errors.length === 0, page.__errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
