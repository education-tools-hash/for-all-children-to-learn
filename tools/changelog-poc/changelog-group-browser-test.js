// Real-browser (Playwright / Chromium) test for the top-page changelog "same day, same app" grouping
// (Phase CHANGELOG-SAME-DAY-APP-GROUP-1; expectations made data-independent in CHANGELOG-POC-DATA-INDEPENDENT-1)
// as rendered by index.html's hand-written changelog functions.
//
// Usage (repository root, Node 20 + a globally available `playwright`):
//   node tools/changelog-poc/changelog-group-browser-test.js
// It serves the repository on an ephemeral local port and exits non-zero on any failure.
//
// No expected value is hard-coded from one day's data: the「最新3件」order, month label and count, item and group
// counts, group sizes and the original texts are all derived from MANUAL_CHANGELOG / generateChangelog (the real
// code, evaluated by changelog-test-helpers.js). The page is checked with the committed index.html (real data) and,
// for every data variation in helpers.VARIANTS, with an in-memory index.html whose CHANGELOG generate.js's own
// updateChangelog wrote for that variation (served instead of the file; nothing on disk changes).
//
// Checks, at 375px and 1280px: the「最新3件」area shows the first three items, a group as ONE item; a group's toggle
// is a >= 44px button with aria-expanded / aria-controls, opens and closes with Enter and Space, and reveals its
// original texts each with its type badge; the monthly area shows the 2026-11-12 りんごポットン group (history) as one
// item with its originals and the month count = the data's sum; the「これまでの更新履歴」button and the month headers
// carry aria-expanded; no horizontal overflow, also in high-contrast mode; ids are unique; no page errors.
// SCOPE / HONESTY: Chromium on Linux. It is NOT an iPad Safari or VoiceOver result and must never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const H = require('./changelog-test-helpers');
const { ROOT, APPS, HISTORICAL, isGroup } = H;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const LABEL = { new: '新規', update: '更新', fix: '修正', design: 'デザイン' };   // index.html labelForType

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);

let overrideIndex = null;   // index.html text served for the current variation (null = the committed file)
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      if (p === '/index.html' && overrideIndex !== null) { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(overrideIndex); return; }
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// state of the nth group item (.is-group, DOM order) inside a list
const groupState = ({ sel, nth }) => {
  const li = document.querySelectorAll(sel + ' .changelog-item.is-group')[nth];
  if (!li) return null;
  const btn = li.querySelector('.changelog-detail-toggle');
  const list = document.getElementById(btn.getAttribute('aria-controls'));
  const r = btn.getBoundingClientRect();
  return {
    head: btn.querySelector('span').textContent, count: btn.querySelector('.changelog-detail-count').textContent,
    expanded: btn.getAttribute('aria-expanded'), controls: btn.getAttribute('aria-controls'), listFound: !!list && li.contains(list),
    visible: !!list && getComputedStyle(list).display !== 'none', h: r.height, badge: li.querySelector(':scope > .changelog-badge').textContent,
    entries: list ? Array.from(list.querySelectorAll(':scope > .changelog-group-entry')).map((e) => ({ badge: e.querySelector('.changelog-badge').textContent, cls: e.querySelector('.changelog-badge').className, text: e.querySelector('.changelog-group-entry-text').textContent })) : []
  };
};
const toggleHandle = (page, sel, nth) => page.evaluateHandle(({ sel, nth }) => document.querySelectorAll(sel + ' .changelog-item.is-group')[nth].querySelector('.changelog-detail-toggle'), { sel, nth });

async function runVariant(browser, URL, variant) {
  const P = '[' + variant.name + '] ';
  const M = H.loadVariant(variant);
  const out = M.generateChangelog(APPS);
  overrideIndex = variant.delta === 0 ? null : M.buildIndexHtml(APPS);
  if (variant.delta === 0) ok(P + 'P0 the committed index.html is what generate.js writes for the current data', M.buildIndexHtml(APPS) === H.INDEX_HTML);

  // expectations, all from the data
  const fmt = (i) => M.formatDateJP(i.date);
  const latestExp = out.slice(0, 3).map((i) => ({ date: fmt(i), text: i.text, group: isGroup(i) }));
  const latestGroupIdx = out.slice(0, 3).map((i, k) => k).filter((k) => isGroup(out[k]));
  const groupsAll = out.filter(isGroup);
  const members = M.MANUAL_CHANGELOG.filter((e) => e.date === HISTORICAL.date && e.app === HISTORICAL.app);
  const histNth = groupsAll.findIndex((i) => i.date === HISTORICAL.date && i.text === HISTORICAL.head);   // DOM order in the monthly area = output order
  const hist = groupsAll[histNth];
  const histMonthKey = (function () { const m = fmt(hist || { date: HISTORICAL.date }).match(/^(\d+)年(\d+)月/); return m[1] + '年' + m[2] + '月'; })();
  const firstMonth = out[0].date.slice(0, 7);
  const firstMonthLabel = (function () { const m = fmt(out[0]).match(/^(\d+)年(\d+)月/); return m[1] + '年' + m[2] + '月'; })();
  const firstMonthCount = out.filter((i) => i.date.slice(0, 7) === firstMonth).reduce((s, i) => s + i.updateCount, 0);
  const histDayCount = out.filter((i) => i.date === HISTORICAL.date).length;
  ok(P + 'P1 the data still has the ' + HISTORICAL.date + ' りんごポットン group (' + members.length + ' entries)', members.length >= 2 && !!hist && hist.entries.length === members.length, J({ members: members.length, hist: hist && hist.entries.length }));

  for (const [w, h] of [[375, 812], [1280, 900]]) {
    const tag = P + w + 'px';
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|fonts\.g|googletagmanager|gtag/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await sleep(400);

    /* ---- L: the「最新3件」area ---- */
    // (the toggle button itself also has class changelog-text, so a toggle item is read from its first <span>)
    const latest = await page.evaluate(() => Array.from(document.querySelectorAll('#changelogLatest > li')).map((li) => {
      const toggle = li.querySelector('.changelog-detail-toggle');
      return { date: (li.querySelector('.changelog-date') || {}).textContent, text: (toggle ? toggle.querySelector('span') : li.querySelector('.changelog-text')).textContent, group: li.classList.contains('is-group') };
    }));
    ok(tag + ' L1 最新3件 = the first 3 items of the data, groups as one item: ' + latestExp.map((x) => x.date.replace(/^\d+年/, '') + (x.group ? '(group)' : '')).join(', '), J(latest) === J(latestExp), J(latest) + ' vs ' + J(latestExp));
    const latestControls = [];
    if (latestGroupIdx.length === 0) {
      console.log('INFO - ' + tag + ' no group among 最新3件 for this data: L2-L7 run in the variants that put a group there');
    }
    for (let nth = 0; nth < latestGroupIdx.length; nth++) {
      const item = out[latestGroupIdx[nth]];
      const L = tag + ' L(' + item.date + ' ' + item.text + ')';
      const s0 = await page.evaluate(groupState, { sel: '#changelogLatest', nth });
      if (s0) latestControls.push(s0.controls);
      ok(L + ' L2 toggle: heading, badge ' + LABEL[item.type] + ', count ' + item.updateCount + '件, closed, aria-controls points to its own hidden list', s0 && s0.head === item.text && s0.badge === LABEL[item.type] && s0.count === item.updateCount + '件' && s0.expanded === 'false' && s0.listFound && !s0.visible, J(s0));
      ok(L + ' L3 the toggle is at least 44px tall', s0 && s0.h >= 44, s0 && String(s0.h));
      const btn = await toggleHandle(page, '#changelogLatest', nth);
      await btn.focus();
      await page.keyboard.press('Enter'); await sleep(100);
      const s1 = await page.evaluate(groupState, { sel: '#changelogLatest', nth });
      ok(L + ' L4 Enter opens it: aria-expanded true, list visible', s1.expanded === 'true' && s1.visible, J(s1));
      ok(L + ' L5 the ' + item.entries.length + ' original texts, unchanged and in order, each with its type badge', s1.entries.length === item.entries.length && s1.entries.every((e, k) => e.text === item.entries[k].text && e.badge === LABEL[item.entries[k].type] && new RegExp('\\b' + item.entries[k].type + '\\b').test(e.cls)), J(s1.entries));
      const ovOpen = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, sec: (function () { const s = document.querySelector('.changelog-section'); return s.scrollWidth - s.clientWidth; })() }));
      ok(L + ' L6 no horizontal overflow with the group open (page and changelog section)', ovOpen.doc <= 0 && ovOpen.sec <= 0, J(ovOpen));
      await page.keyboard.press('Space'); await sleep(100);
      const s2 = await page.evaluate(groupState, { sel: '#changelogLatest', nth });
      ok(L + ' L7 Space closes it again', s2.expanded === 'false' && !s2.visible, J(s2));
      await btn.dispose();
    }

    /* ---- M: the monthly area ---- */
    const top0 = await page.getAttribute('#changelogBtn', 'aria-expanded');
    await page.click('#changelogBtn'); await sleep(150);
    const top1 = await page.getAttribute('#changelogBtn', 'aria-expanded');
    ok(tag + ' M1「これまでの更新履歴」button: aria-expanded false -> true', top0 === 'false' && top1 === 'true', top0 + ' -> ' + top1);
    const m0 = await page.evaluate(() => {
      const g = document.querySelector('#changelogList > .changelog-month-group'); const hb = g.querySelector('.changelog-month-header');
      return { label: g.querySelector('.changelog-month-label').textContent, count: g.querySelector('.changelog-month-count').textContent, expanded: hb.getAttribute('aria-expanded'), h: hb.getBoundingClientRect().height,
        others: Array.from(document.querySelectorAll('#changelogList .changelog-month-header')).slice(1).map((b) => b.getAttribute('aria-expanded')) };
    });
    ok(tag + ' M2 first month ' + firstMonthLabel + ', count ' + firstMonthCount + '件 (= sum of the data), header expanded with aria-expanded true, >= 44px', m0.label === firstMonthLabel && m0.count === firstMonthCount + '件' && m0.expanded === 'true' && m0.h >= 44, J(m0));
    ok(tag + ' M3 the other month headers say aria-expanded false', m0.others.length > 0 && m0.others.every((x) => x === 'false'), m0.others.join(','));
    const histDay = await page.evaluate((dateText) => {
      const dg = Array.from(document.querySelectorAll('#changelogList .changelog-date-group')).find((x) => x.querySelector('.changelog-date').textContent === dateText);
      return dg ? { items: dg.querySelectorAll('.changelog-date-items > li').length, groups: dg.querySelectorAll('.changelog-date-items > li.is-group').length } : null;
    }, M.formatDateJP(HISTORICAL.date));
    const histDayGroups = out.filter((i) => i.date === HISTORICAL.date && isGroup(i)).length;
    ok(tag + ' M4 ' + M.formatDateJP(HISTORICAL.date) + ' holds ' + histDayCount + ' item(s) as in the data, ' + histDayGroups + ' of them a group', histDay && histDay.items === histDayCount && histDay.groups === histDayGroups, J(histDay));
    const sm = await page.evaluate(groupState, { sel: '#changelogList', nth: histNth });
    ok(tag + ' M5 the 2026-11-12 group in the monthly area: heading, ' + hist.updateCount + '件, its own aria-controls (not one of 最新3件)', sm && sm.head === HISTORICAL.head && sm.count === hist.updateCount + '件' && sm.listFound && latestControls.indexOf(sm.controls) === -1, J(sm));
    // open its month first when it is not the first (open) one
    if (histMonthKey !== firstMonthLabel) {
      await page.evaluate((key) => { const g = Array.from(document.querySelectorAll('#changelogList > .changelog-month-group')).find((x) => x.querySelector('.changelog-month-label').textContent === key); const b = g.querySelector('.changelog-month-header'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); }, histMonthKey);
      await sleep(100);
    }
    const hb = await toggleHandle(page, '#changelogList', histNth);
    await hb.click(); await sleep(100); await hb.dispose();
    const sm1 = await page.evaluate(groupState, { sel: '#changelogList', nth: histNth });
    ok(tag + ' M6 opening it (pointer) shows the ' + members.length + ' originals from MANUAL_CHANGELOG with badges', sm1.expanded === 'true' && sm1.visible && sm1.entries.map((e) => e.text).join('|') === members.map((e) => e.text).join('|') && sm1.entries.every((e, k) => e.badge === LABEL[members[k].type]), J(sm1.entries));
    await page.click('#changelogList .changelog-month-header'); await sleep(100);
    const mClosed = await page.evaluate(() => { const hb = document.querySelector('#changelogList .changelog-month-header'); return { expanded: hb.getAttribute('aria-expanded'), open: hb.nextElementSibling.classList.contains('open') }; });
    ok(tag + ' M7 toggling the month header updates aria-expanded (true -> false) with the body', mClosed.expanded === 'false' && !mClosed.open, J(mClosed));
    await page.click('#changelogList .changelog-month-header'); await sleep(100);

    /* ---- O: other items untouched, ids, overflow, high contrast ---- */
    const o = await page.evaluate(() => ({
      monthItems: document.querySelectorAll('#changelogList .changelog-date-items > li').length,
      groups: document.querySelectorAll('#changelogList .is-group').length,
      dupIds: (function () { const seen = {}; let d = 0; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) d++; seen[e.id] = 1; }); return d; })()
    }));
    ok(tag + ' O1 the monthly area renders all ' + out.length + ' items, ' + groupsAll.length + ' of them group(s); no duplicate ids', o.monthItems === out.length && o.groups === groupsAll.length && o.dupIds === 0, J(o));
    await page.evaluate(() => document.body.classList.add('hc-mode')); await sleep(100);
    const hc = await page.evaluate((nth) => {
      const t = document.querySelectorAll('#changelogList .changelog-item.is-group')[nth].querySelector('.changelog-group-entry-text');
      const list = t.closest('.changelog-details');
      return { color: getComputedStyle(t.closest('li')).color, bg: getComputedStyle(list).backgroundColor, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, histNth);
    ok(tag + ' O2 high contrast: the open group list is dark with white entry text, still no horizontal overflow', hc.color === 'rgb(255, 255, 255)' && hc.bg === 'rgb(34, 34, 34)' && hc.doc <= 0, J(hc));
    ok(tag + ' O3 no page / console errors', errors.length === 0, errors.join('|'));
    await context.close();
  }
}

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const v of H.VARIANTS) await runVariant(browser, URL, v);
  await browser.close(); srv.close();
  console.log('\nvariants: ' + H.VARIANTS.map((v) => v.name).join(' / '));
  console.log('result: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
