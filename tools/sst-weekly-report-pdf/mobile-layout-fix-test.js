// Phase SST-MONTHLY-TREND-MOBILE-LAYOUT-FIX-1: regression test for the real
// iPhone-reported overlap bugs between the viewport-fixed chrome buttons
// (#donomanaHomeBtn / #donomanaA11yBtn / #donomanaRecordNavBtn, all injected
// by generate.js) and the #s-trend ("4週間のふりかえり") / #s-report (週次レポート)
// screens:
//   A) #donomanaRecordNavBtn (bottom-fixed) overlapped #bottom-back-bar
//      (also bottom-fixed) whenever a report screen's back bar was shown.
//   B) #donomanaHomeBtn (top-fixed) stayed at the same viewport coordinate
//      through scrolling, repeatedly colliding with week headings / answer
//      detail text as the user scrolled #s-trend / #s-report.
// The fix (see the "REPORT SCREEN MOBILE LAYOUT FIX" CSS block in
// sst-app.html, scoped via `body:has(#s-trend.on)` / `body:has(#s-report.on)`
// under `@supports selector(:has(a))`) switches these 3 buttons from
// position:fixed to position:absolute (!important -- required because
// generate.js's own generated blocks set position/top/left/right/bottom via
// inline style="", which otherwise always wins over any stylesheet rule
// regardless of selector specificity) only while a report screen is shown,
// and reserves a dedicated top area so they never overlap report content.
// Read-only w.r.t. sst-app.html (never edits it). Drives the real,
// user-reachable path with genuine clicks only.
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail: detail !== undefined ? detail : null });
  console.log((ok ? '[OK  ] ' : '[FAIL] ') + label + (detail !== undefined ? ' -- ' + JSON.stringify(detail) : ''));
}

// Real, synthetic-only SST records spanning the 4-week window, sized to make
// #s-trend tall enough to require scrolling (matching the real-device report).
function syntheticRecords(now) {
  const day = 24 * 60 * 60 * 1000;
  return [
    { ts: now - 25 * day, type: 'rp', lv: 1, result: 'best', schemaVersion: 1, promptTitle: '友だちに借りたものを返す場面' },
    { ts: now - 18 * day, type: 'wq', lv: 1, result: 'best', schemaVersion: 1 },
    { ts: now - 11 * day, type: 'story', lv: 1, result: 'complete', schemaVersion: 1 },
    { ts: now - 10 * day, type: 'emotion', lv: 1, result: 'select', schemaVersion: 1 },
    { ts: now - 2 * day, type: 'quiz', lv: 1, result: 'best', total: 1, correct: 1, schemaVersion: 1 },
    { ts: now - 1 * day, type: 'branch', lv: 1, result: 'ending', schemaVersion: 1 },
  ];
}

async function freshPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto('file://' + path.join(ROOT, 'sst-app.html'), { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(200);
  await page.evaluate((records) => {
    localStorage.setItem('sst_activity_log_v1', JSON.stringify(records));
  }, syntheticRecords(Date.now()));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  return { context, page };
}

async function rectsOverlap(page, selA, selB) {
  return page.evaluate(([a, b]) => {
    const elA = document.querySelector(a), elB = document.querySelector(b);
    if (!elA || !elB) return null;
    const ra = elA.getBoundingClientRect(), rb = elB.getBoundingClientRect();
    if (getComputedStyle(elA).visibility === 'hidden' || getComputedStyle(elB).visibility === 'hidden') return false;
    if (ra.width === 0 || ra.height === 0 || rb.width === 0 || rb.height === 0) return false;
    const ox = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
    const oy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
    return ox > 0 && oy > 0;
  }, [selA, selB]);
}

const FIXED_BTNS = ['#donomanaHomeBtn', '#donomanaA11yBtn', '#donomanaRecordNavBtn'];
const WIDTHS = [
  { name: '320', viewport: { width: 320, height: 760 } },
  { name: '390', viewport: { width: 390, height: 844 } },
  { name: '430', viewport: { width: 430, height: 932 } },
  { name: 'ipad-landscape', viewport: { width: 1024, height: 768 } },
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  for (const w of WIDTHS) {
    const { context, page } = await freshPage(browser, w.viewport);
    try {
      await page.locator('.mc-report').click({ timeout: 5000 });
      await page.waitForTimeout(150);
      await page.locator('#trend-nav-btn').click({ timeout: 5000 });
      await page.waitForTimeout(150);
      check(`[${w.name}] #s-trend becomes active`, await page.evaluate(() => document.getElementById('s-trend').classList.contains('on')));

      for (const btn of FIXED_BTNS) {
        const ov = await rectsOverlap(page, btn, '#s-trend .back');
        check(`[${w.name}] ${btn} does not overlap #s-trend .back`, ov === false, ov);
      }

      await page.evaluate(() => { document.getElementById('s-trend').scrollTop = Math.round(document.getElementById('s-trend').scrollHeight * 0.4); });
      await page.waitForTimeout(100);
      for (const btn of FIXED_BTNS) {
        const ov = await rectsOverlap(page, btn, '.trend-week-section-title');
        check(`[${w.name}] ${btn} does not overlap week heading mid-scroll`, ov === false, ov);
      }

      await page.evaluate(() => { document.getElementById('s-trend').scrollTop = document.getElementById('s-trend').scrollHeight; });
      await page.waitForTimeout(100);
      check(`[${w.name}] #trend-print-btn reachable at bottom`, await page.locator('#trend-print-btn').isVisible());
      for (const btn of FIXED_BTNS) {
        const ov = await rectsOverlap(page, btn, '#bottom-back-bar');
        check(`[${w.name}] ${btn} does not overlap #bottom-back-bar`, ov === false, ov);
      }
      const printBtnOv = await rectsOverlap(page, '#trend-print-btn', '#bottom-back-bar');
      check(`[${w.name}] #trend-print-btn does not overlap #bottom-back-bar`, printBtnOv === false, printBtnOv);

      // real click, not force -- proves the back button is not pointer-intercepted
      // by a fixed button sitting on top of it (this is how the original bug was
      // independently confirmed: Playwright's own actionability check failed).
      await page.locator('#s-trend .back').click({ timeout: 5000 });
      await page.waitForTimeout(150);
      check(`[${w.name}] #s-trend .back is clickable (not pointer-intercepted)`, await page.evaluate(() => document.getElementById('s-report').classList.contains('on')));
      const focusedAfterTrendBack = await page.evaluate(() => document.activeElement && document.activeElement.id);
      check(`[${w.name}] focus restored to #trend-nav-btn after #s-trend back`, focusedAfterTrendBack === 'trend-nav-btn', focusedAfterTrendBack);

      await page.locator('#s-report .back').click({ timeout: 5000 });
      await page.waitForTimeout(150);
      check(`[${w.name}] #s-report .back is clickable (not pointer-intercepted)`, await page.evaluate(() => document.getElementById('s-home').classList.contains('on')));

      // Scoping must release outside report screens: the 3 buttons must be
      // position:fixed again on the normal/home screen (unaffected elsewhere).
      for (const btn of FIXED_BTNS) {
        const pos = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).position, btn);
        check(`[${w.name}] ${btn} is position:fixed again on home screen (scoping released)`, pos === 'fixed', pos);
      }
    } catch (e) {
      check(`[${w.name}] scenario threw`, false, String(e && e.stack ? e.stack : e));
    }
    await context.close();
  }

  // #s-report (週次レポート) reached directly, without going through #s-trend,
  // must also get the dedicated button area / no-overlap treatment.
  {
    const { context, page } = await freshPage(browser, { width: 390, height: 844 });
    try {
      await page.locator('.mc-report').click({ timeout: 5000 });
      await page.waitForTimeout(150);
      check('[s-report-direct] #s-report becomes active', await page.evaluate(() => document.getElementById('s-report').classList.contains('on')));
      for (const btn of FIXED_BTNS) {
        const ov = await rectsOverlap(page, btn, '#s-report .back');
        check(`[s-report-direct] ${btn} does not overlap #s-report .back`, ov === false, ov);
      }
    } catch (e) {
      check('[s-report-direct] scenario threw', false, String(e && e.stack ? e.stack : e));
    }
    await context.close();
  }

  await browser.close();

  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${total} checks passed.`);
  if (passed !== total) {
    console.log('\nFailures:');
    results.filter((r) => !r.ok).forEach((r) => console.log(' - ' + r.label + (r.detail !== null ? ' :: ' + JSON.stringify(r.detail) : '')));
    process.exit(1);
  }
})();
