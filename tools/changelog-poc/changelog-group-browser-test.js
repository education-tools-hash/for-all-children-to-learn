// Real-browser (Playwright / Chromium) test for the top-page changelog "same day, same app" grouping
// (Phase CHANGELOG-SAME-DAY-APP-GROUP-1) as rendered by index.html's hand-written changelog functions.
//
// Usage (repository root, Node 20 + a globally available `playwright`):
//   node tools/changelog-poc/changelog-group-browser-test.js
// It serves the repository on an ephemeral local port and exits non-zero on any failure.
//
// Checks, at 375px and 1280px: the「最新3件」area shows the りんごポットン group as ONE of three items; the monthly
// area shows the same group under 2026年11月 with the month count unchanged; the group toggle is a >= 44px button
// with aria-expanded / aria-controls, opens and closes with Enter and Space, and reveals the four original texts
// each with its type badge; the「これまでの更新履歴」button and the month headers now carry aria-expanded; no
// horizontal overflow, also in high-contrast mode; ids are unique; no page errors.
// SCOPE / HONESTY: Chromium on Linux. It is NOT an iPad Safari or VoiceOver result and must never be reported as one.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const ORIGINALS = [
  '「りんごポットン」に「りんごじゃない くだものも まぜる（はってん）」を追加しました',
  '「りんごポットン」に「なでて とる（スワイプ）」を追加しました',
  '「りんごポットン」で学習の記録が残せるようになりました',
  '「りんごポットン」のおじいさんを大きくし、見やすくしました'
];
const HEAD = '「りんごポットン」を更新しました';

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

// state of one group toggle (by its owning list)
const groupState = (root) => (function (sel) {
  const li = document.querySelector(sel + ' .changelog-item.is-group');
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
})(root);

(async () => {
  const srv = await startServer();
  const URL = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const [w, h] of [[375, 812], [1280, 900]]) {
    const tag = w + 'px';
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
    ok(tag + ' L1 最新3件 = 3 items: the りんごポットン group (11/12), then 11/11, then 11/10', latest.length === 3 && latest[0].group && latest[0].text === HEAD && latest[0].date === '2026年11月12日' && latest[1].date === '2026年11月11日' && latest[2].date === '2026年11月10日', JSON.stringify(latest));
    const s0 = await page.evaluate(groupState, '#changelogLatest');
    ok(tag + ' L2 group toggle: heading, badge 更新, count 4件, closed, aria-controls points to its own hidden list', s0 && s0.head === HEAD && s0.badge === '更新' && s0.count === '4件' && s0.expanded === 'false' && s0.listFound && !s0.visible, JSON.stringify(s0));
    ok(tag + ' L3 the toggle is at least 44px tall', s0 && s0.h >= 44, s0 && String(s0.h));
    await page.focus('#changelogLatest .is-group .changelog-detail-toggle');
    await page.keyboard.press('Enter'); await sleep(100);
    const s1 = await page.evaluate(groupState, '#changelogLatest');
    ok(tag + ' L4 Enter opens it: aria-expanded true, list visible', s1.expanded === 'true' && s1.visible, JSON.stringify(s1));
    ok(tag + ' L5 the 4 original texts, unchanged and in order, each with a「更新」type badge', s1.entries.length === 4 && s1.entries.every((e, k) => e.text === ORIGINALS[k] && e.badge === '更新' && /\bupdate\b/.test(e.cls)), JSON.stringify(s1.entries));
    const ovOpen = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, sec: (function () { const s = document.querySelector('.changelog-section'); return s.scrollWidth - s.clientWidth; })() }));
    ok(tag + ' L6 no horizontal overflow with the group open (page and changelog section)', ovOpen.doc <= 0 && ovOpen.sec <= 0, JSON.stringify(ovOpen));
    await page.keyboard.press('Space'); await sleep(100);
    const s2 = await page.evaluate(groupState, '#changelogLatest');
    ok(tag + ' L7 Space closes it again', s2.expanded === 'false' && !s2.visible, JSON.stringify(s2));

    /* ---- M: the monthly area ---- */
    const top0 = await page.getAttribute('#changelogBtn', 'aria-expanded');
    await page.click('#changelogBtn'); await sleep(150);
    const top1 = await page.getAttribute('#changelogBtn', 'aria-expanded');
    ok(tag + ' M1「これまでの更新履歴」button: aria-expanded false -> true', top0 === 'false' && top1 === 'true', top0 + ' -> ' + top1);
    const m0 = await page.evaluate(() => {
      const g = document.querySelector('#changelogList > .changelog-month-group'); const hb = g.querySelector('.changelog-month-header');
      const firstDay = g.querySelector('.changelog-date-group');
      return { label: g.querySelector('.changelog-month-label').textContent, count: g.querySelector('.changelog-month-count').textContent, expanded: hb.getAttribute('aria-expanded'), h: hb.getBoundingClientRect().height,
        firstDay: firstDay.querySelector('.changelog-date').textContent, firstDayItems: firstDay.querySelectorAll('.changelog-date-items > li').length,
        others: Array.from(document.querySelectorAll('#changelogList .changelog-month-header')).slice(1).map((b) => b.getAttribute('aria-expanded')) };
    });
    ok(tag + ' M2 first month 2026年11月, count 8件 (unchanged), header expanded with aria-expanded true, >= 44px', m0.label === '2026年11月' && m0.count === '8件' && m0.expanded === 'true' && m0.h >= 44, JSON.stringify(m0));
    ok(tag + ' M3 the other month headers say aria-expanded false', m0.others.length > 0 && m0.others.every((x) => x === 'false'), m0.others.join(','));
    ok(tag + ' M4 2026年11月12日 holds exactly one item (the group)', m0.firstDay === '2026年11月12日' && m0.firstDayItems === 1, JSON.stringify(m0));
    const sm = await page.evaluate(groupState, '#changelogList');
    ok(tag + ' M5 the same group in the monthly area: heading, 4件, its own aria-controls (different id from 最新3件)', sm && sm.head === HEAD && sm.count === '4件' && sm.listFound && sm.controls !== s0.controls, JSON.stringify(sm));
    await page.click('#changelogList .is-group .changelog-detail-toggle'); await sleep(100);
    const sm1 = await page.evaluate(groupState, '#changelogList');
    ok(tag + ' M6 opening it (pointer) shows the same 4 originals with badges', sm1.expanded === 'true' && sm1.visible && sm1.entries.map((e) => e.text).join('|') === ORIGINALS.join('|') && sm1.entries.every((e) => e.badge === '更新'), JSON.stringify(sm1.entries));
    await page.click('#changelogList .changelog-month-header'); await sleep(100);
    const mClosed = await page.evaluate(() => { const hb = document.querySelector('#changelogList .changelog-month-header'); return { expanded: hb.getAttribute('aria-expanded'), open: hb.nextElementSibling.classList.contains('open') }; });
    ok(tag + ' M7 toggling the month header updates aria-expanded (true -> false) with the body', mClosed.expanded === 'false' && !mClosed.open, JSON.stringify(mClosed));
    await page.click('#changelogList .changelog-month-header'); await sleep(100);

    /* ---- O: other items untouched, ids, overflow, high contrast ---- */
    const o = await page.evaluate(() => ({
      monthItems: document.querySelectorAll('#changelogList .changelog-date-items > li').length,
      groups: document.querySelectorAll('#changelogList .is-group').length,
      dupIds: (function () { const seen = {}; let d = 0; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) d++; seen[e.id] = 1; }); return d; })()
    }));
    ok(tag + ' O1 the monthly area renders all 73 items, exactly one of them a group; no duplicate ids', o.monthItems === 73 && o.groups === 1 && o.dupIds === 0, JSON.stringify(o));
    await page.evaluate(() => document.body.classList.add('hc-mode')); await sleep(100);
    const hc = await page.evaluate(() => {
      const t = document.querySelector('#changelogList .is-group .changelog-group-entry-text');
      const list = t.closest('.changelog-details');
      return { color: getComputedStyle(t.closest('li')).color, bg: getComputedStyle(list).backgroundColor, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    ok(tag + ' O2 high contrast: the open group list is dark with white entry text, still no horizontal overflow', hc.color === 'rgb(255, 255, 255)' && hc.bg === 'rgb(34, 34, 34)' && hc.doc <= 0, JSON.stringify(hc));
    await page.screenshot({ path: '/tmp/claude-0/-home-user/484078a9-ffd2-5b18-a550-1453abff3226/scratchpad/cl/changelog-' + w + '-hc.png', fullPage: false }).catch(() => {});
    ok(tag + ' O3 no page / console errors', errors.length === 0, errors.join('|'));
    await context.close();
  }

  await browser.close(); srv.close();
  console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
