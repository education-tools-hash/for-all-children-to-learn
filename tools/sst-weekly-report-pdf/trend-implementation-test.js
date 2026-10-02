// Phase SST-MONTHLY-TREND-IMPLEMENTATION-1: verifies the new "4週間のふりかえり"
// (#s-trend) screen added to sst-app.html, per
// docs/design-system/donomana-sst-monthly-trend-design-contract-v1_0.md
// (Correction適用済み) and the Implementation Phase's own corrections (focus
// management, type/timestamp classification, UTC-vs-local week keys, print
// isolation). Read-only w.r.t. sst-app.html (never edits it). Drives the real,
// user-reachable path (home -> .mc-report -> #trend-nav-btn -> #s-trend) with
// genuine clicks/keyboard only. Seeds localStorage['sst_activity_log_v1']
// directly (same shape recordActivity() itself writes, plus deliberately
// malformed/edge-case entries) to exercise classification, read-failure,
// empty-state, focus, print and accessibility behavior without needing to
// play through every SST activity screen.
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KNOWN_ENV_NOISE = [/ERR_CERT_AUTHORITY_INVALID/, /ERR_TUNNEL_CONNECTION_FAILED/, /ERR_FILE_NOT_FOUND/];
const isEnvNoise = (t) => KNOWN_ENV_NOISE.some((re) => re.test(t));

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail: detail !== undefined ? detail : null });
  console.log((ok ? '[OK  ] ' : '[FAIL] ') + label + (detail !== undefined ? ' -- ' + JSON.stringify(detail) : ''));
}

function collectErrors(page, bucket) {
  page.on('console', (msg) => { if (msg.type() === 'error') { const t = msg.text(); if (!isEnvNoise(t)) bucket.consoleErrors.push(t); } });
  page.on('pageerror', (err) => bucket.pageErrors.push(String(err && err.message ? err.message : err)));
}

async function freshPage(browser, contextOptions) {
  const context = await browser.newContext(contextOptions || {});
  const page = await context.newPage();
  const bucket = { consoleErrors: [], pageErrors: [] };
  collectErrors(page, bucket);
  await page.goto('file://' + path.join(ROOT, 'sst-app.html'), { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(200);
  return { context, page, bucket };
}

async function seedRaw(page, value) {
  await page.evaluate((v) => {
    if (v === undefined) { localStorage.removeItem('sst_activity_log_v1'); }
    else if (typeof v === 'string') { localStorage.setItem('sst_activity_log_v1', v); }
    else { localStorage.setItem('sst_activity_log_v1', JSON.stringify(v)); }
  }, value);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
}

// Phase SST-RECORD-NAVIGATION-AND-GUIDANCE-1: the home screen now has 3
// buttons sharing the .mc-report visual-style class (original weekly report,
// plus new direct-entry #home-trend-btn/#home-ahist-btn) -- .mc-report alone
// is no longer a unique selector. Target the original report button by its
// onclick, not by id (it has none, unlike the two new direct-entry buttons).
async function openReport(page) {
  await page.locator('.mc-report[onclick="go(\'s-report\')"]').click({ timeout: 5000 });
  await page.waitForTimeout(200);
}

async function openTrend(page) {
  await page.locator('#trend-nav-btn').click({ timeout: 5000 });
  await page.waitForTimeout(200);
}

// Pins window.Date/Date.now() to a fixed instant, computed via an addInitScript
// so every subsequent navigation in this page sees the same "now". The caller
// must compute `fixedMs` using the page's own context (e.g. page.evaluate with
// new Date(y,m,d,h,...)) so the pinned instant is correct for the context's
// timezoneId (never computed host-side, which may run in a different zone).
async function pinDate(page, fixedMs) {
  await page.addInitScript(`(() => {
    const FIXED = ${fixedMs};
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { if (args.length === 0) { super(FIXED); } else { super(...args); } }
      static now() { return FIXED; }
    }
    window.Date = FixedDate;
  })();`);
}

// ---- scenario runner -----------------------------------------------------

async function runScenario(browser, name, fn) {
  const { context, page, bucket } = await freshPage(browser);
  try {
    await fn(page);
  } catch (e) {
    check(`[${name}] scenario threw`, false, String(e && e.stack ? e.stack : e));
  }
  check(`[${name}] no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
  check(`[${name}] no pageerror`, bucket.pageErrors.length === 0, bucket.pageErrors);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ---- Navigation / scaffolding ------------------------------------------
  await runScenario(browser, 'Nav-basic', async (page) => {
    await seedRaw(page, [{ ts: Date.now(), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]);
    // Regression guard: closeTrendScreen() depends on trendIsFocusable()/
    // trendFirstFocusable() being real, reachable global functions. An earlier
    // checkpoint instead referenced donomanaIsFocusable()/donomanaFirstFocusable()
    // directly -- functions defined inside the `<!-- a11y-panel: 自動挿入
    // (generate.js) -->` block, which generate.js silently regenerates from its
    // own template on every run, discarding any manual edit made inside it
    // (including a `window.donomanaIsFocusable = ...` exposure attempt). That made
    // the "reuse existing helper" branch unreachable dead code, invisible to the
    // focus-restore behavior tests below (which pass either way via the
    // unconditional fallback). trendIsFocusable()/trendFirstFocusable() are
    // defined in sst-app.html's own hand-authored section (outside any generator
    // block), so they must survive a `node generate.js` run -- verified separately
    // in this Phase's diff/regression checks, not by this test file.
    check('[Nav-basic] trendIsFocusable is a reachable global function', (await page.evaluate(() => typeof trendIsFocusable)) === 'function');
    check('[Nav-basic] trendFirstFocusable is a reachable global function', (await page.evaluate(() => typeof trendFirstFocusable)) === 'function');

    await openReport(page);
    check('[Nav-basic] #trend-nav-btn visible', await page.locator('#trend-nav-btn').isVisible());
    await openTrend(page);
    check('[Nav-basic] #s-trend becomes active', await page.evaluate(() => document.getElementById('s-trend').classList.contains('on')));
    check('[Nav-basic] #s-report becomes inactive', await page.evaluate(() => !document.getElementById('s-report').classList.contains('on')));
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] heading receives focus on open', focusedId === 'trend-title', focusedId);
    const headingTabIndex = await page.evaluate(() => document.getElementById('trend-title').tabIndex);
    check('[Nav-basic] heading has tabindex=-1 (not in Tab order, programmatically focusable)', headingTabIndex === -1, headingTabIndex);

    // top back button
    await page.locator('#s-trend .back').click();
    await page.waitForTimeout(150);
    check('[Nav-basic] top back returns to #s-report', await page.evaluate(() => document.getElementById('s-report').classList.contains('on')));
    let focusedAfter = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] top back restores focus to #trend-nav-btn', focusedAfter === 'trend-nav-btn', focusedAfter);

    // bottom back bar (BACK_MAP)
    await openTrend(page);
    check('[Nav-basic] bottom back bar shown on #s-trend', await page.evaluate(() => document.getElementById('bottom-back-bar').classList.contains('show')));
    await page.locator('#bottom-back-btn').click();
    await page.waitForTimeout(150);
    focusedAfter = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] bottom back restores focus to #trend-nav-btn', focusedAfter === 'trend-nav-btn', focusedAfter);

    // no stray focus left inside hidden #s-trend
    const trendStillHasFocus = await page.evaluate(() => document.getElementById('s-trend').contains(document.activeElement));
    check('[Nav-basic] no stray focus remains inside hidden #s-trend', !trendStillHasFocus);
  });

  // Exercises the actual fallback branch of closeTrendScreen() (origin button
  // deliberately made unfocusable via disabled), proving donomanaFirstFocusable()
  // is genuinely invoked and finds a real alternate element -- not just that some
  // element ends up focused by accident.
  await runScenario(browser, 'Nav-focus-fallback-when-origin-unfocusable', async (page) => {
    await seedRaw(page, [{ ts: Date.now(), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]);
    await openReport(page);
    await openTrend(page);
    await page.evaluate(() => { document.getElementById('trend-nav-btn').disabled = true; });
    await page.locator('#s-trend .back').click();
    await page.waitForTimeout(150);
    // The disabled #trend-nav-btn has no id-less sibling guarantee, so identify the
    // focused element by tag/class rather than requiring a non-empty id (the correct
    // fallback target here is #s-report's own `.back` button, which has no id attr).
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el && el.tagName, isBody: el === document.body, inReport: document.getElementById('s-report').contains(el), isOrigin: el === document.getElementById('trend-nav-btn') };
    });
    check('[Nav-focus-fallback-when-origin-unfocusable] focus lands on a real focusable element inside #s-report (not origin, not body)', info.inReport && !info.isBody && !info.isOrigin && info.tag === 'BUTTON', info);
  });

  await runScenario(browser, 'Nav-keyboard', async (page) => {
    await seedRaw(page, [{ ts: Date.now(), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]);
    await openReport(page);
    await page.locator('#trend-nav-btn').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    check('[Nav-keyboard] Enter on nav button opens #s-trend', await page.evaluate(() => document.getElementById('s-trend').classList.contains('on')));
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-keyboard] heading focused after Enter-open', focusedId === 'trend-title', focusedId);
    check('[Nav-keyboard] nav button is native, keyboard-focusable (no tabindex=-1, not disabled)',
      await page.evaluate(() => { const b = document.getElementById('trend-nav-btn'); return b.tagName === 'BUTTON' && b.tabIndex !== -1 && !b.disabled; }));
  });

  // ---- Classification: valid records, 11 types ---------------------------
  await runScenario(browser, 'Classify-11types', async (page) => {
    const DAY = 86400000;
    await page.evaluate(() => {});
    const types = ['rp', 'wq', 'story', 'branch', 'diary', 'quiz', 'thermo', 'breath', 'photo', 'emotion', 'phrase'];
    await seedRaw(page, types.map((t, i) => ({ ts: Date.now() - DAY, type: t, lv: 1, result: 'best', schemaVersion: 1 })));
    await openReport(page);
    await openTrend(page);
    const breakdownText = await page.evaluate(() => document.getElementById('trend-breakdown').textContent);
    const allLabels = ['ロールプレイ', 'ことばクイズ', 'ソーシャルストーリー', '分岐ストーリー', 'きもち日記', 'SSTクイズ', 'きもち温度計', 'きもちを落ち着ける', '写真SST', 'きもちカード', 'フレーズ集'];
    check('[Classify-11types] all 11 known type labels appear in breakdown', allLabels.every((l) => breakdownText.includes(l)), allLabels.filter((l) => !breakdownText.includes(l)));
    const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
    check('[Classify-11types] week4 count = 11 (all seeded this week)', counts[3] === '11', counts);
  });

  await runScenario(browser, 'Classify-session-and-phrase', async (page) => {
    const now = Date.now();
    await seedRaw(page, [
      { ts: now, type: 'wq', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'word_quiz_session', answers: [{ question: { prompt: 'Q1' }, selected: { text: 'A', level: 'best' } }, { question: { prompt: 'Q2' }, selected: { text: 'B', level: 'good' } }, { question: { prompt: 'Q3' }, selected: { text: 'C', level: 'best' } }] } },
      { ts: now - 1000, type: 'phrase', lv: 0, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'phrase_action', category: 'help', phrase: 'てつだって', action: 'spoken' } },
      { ts: now - 2000, type: 'phrase', lv: 0, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'phrase_action', category: 'help', phrase: 'てつだって', action: 'copied' } },
    ]);
    await openReport(page);
    await openTrend(page);
    const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
    // 1 session record (despite 3 embedded answers) + 2 phrase records (spoken, copied separately) = 3
    check('[Classify-session-and-phrase] week4 count = 3 (1 session + 2 phrase actions, not double/triple counted)', counts[3] === '3', counts);
  });

  // ---- Classification: malformed / unsafe data ---------------------------
  await runScenario(browser, 'Classify-malformed', async (page) => {
    const now = Date.now();
    const DAY = 86400000;
    await seedRaw(page, [
      { ts: now - DAY, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },                 // valid, week4
      { ts: now - DAY, type: 'mystery_type', lv: 0, result: 'done', schemaVersion: 1 },        // unknown-but-safe type, still counted
      { ts: now - DAY, type: 'constructor', lv: 0, result: 'done', schemaVersion: 1 },         // dangerous-looking key, must not be misread as known
      { ts: now - DAY, type: '__proto__', lv: 0, result: 'done', schemaVersion: 1 },           // dangerous-looking key
      { ts: now - DAY, type: '', lv: 0, result: 'done', schemaVersion: 1 },                    // empty type -> invalid
      { ts: now - DAY, type: '   ', lv: 0, result: 'done', schemaVersion: 1 },                 // whitespace-only type -> invalid
      { ts: now - DAY, type: null, lv: 0, result: 'done', schemaVersion: 1 },                  // missing type -> invalid
      { ts: now - DAY, type: 42, lv: 0, result: 'done', schemaVersion: 1 },                    // non-string type -> invalid
      { ts: NaN, type: 'rp', lv: 0, result: 'done', schemaVersion: 1 },                        // invalid ts (NaN)
      { ts: 'not-a-number', type: 'rp', lv: 0, result: 'done', schemaVersion: 1 },              // invalid ts (non-number)
      { ts: now + 10 * DAY, type: 'rp', lv: 0, result: 'done', schemaVersion: 1 },              // future ts
      null, 'garbage-string', 42, [1, 2, 3],                                                    // malformed array elements
      { ts: now - 60 * DAY, type: 'rp', lv: 0, result: 'done', schemaVersion: 1 },              // before window (silent exclusion)
    ]);
    await openReport(page);
    await openTrend(page);

    const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
    // rp(known) + mystery_type(unknown-safe) + "constructor"(unknown-safe, not misread as known) +
    // "__proto__"(unknown-safe, not misread as known) = 4. Both dangerous-looking strings are still
    // valid non-empty type values, so they count normally -- only the ACT_LABEL *label lookup* must
    // treat them as unknown, not the record itself as invalid.
    check('[Classify-malformed] week4 count = 4 (1 known + 3 unknown-but-valid types, incl. "constructor"/"__proto__")', counts[3] === '4', counts);

    const notices = await page.$$eval('.trend-notice', (els) => els.map((e) => e.textContent));
    const hasFuture = notices.some((t) => t.includes('未来') || t.includes('現在より後'));
    const hasInvalidTs = notices.some((t) => t.includes('日時を確認できない'));
    const hasInvalid = notices.some((t) => t.includes('不正な記録'));
    check('[Classify-malformed] future-timestamp notice shown', hasFuture, notices);
    check('[Classify-malformed] invalid-timestamp notice shown (distinct from future)', hasInvalidTs, notices);
    check('[Classify-malformed] invalid-record notice shown (distinct from invalid-timestamp)', hasInvalid, notices);

    // exact counts: invalid bucket = '' + '   ' + null + 42 + null-element + 'garbage-string' + 42 + [1,2,3] = 8
    // invalid-ts bucket = NaN + 'not-a-number' = 2
    // future bucket = 1
    const invalidNotice = notices.find((t) => t.includes('不正な記録'));
    const invalidTsNotice = notices.find((t) => t.includes('日時を確認できない'));
    const futureNotice = notices.find((t) => t.includes('現在より後'));
    check('[Classify-malformed] invalid-record count = 8 (no double counting)', /8件/.test(invalidNotice || ''), invalidNotice);
    check('[Classify-malformed] invalid-timestamp count = 2', /2件/.test(invalidTsNotice || ''), invalidTsNotice);
    check('[Classify-malformed] future count = 1', /1件/.test(futureNotice || ''), futureNotice);

    const breakdownHtml = await page.evaluate(() => document.getElementById('trend-breakdown').innerHTML);
    check('[Classify-malformed] raw "mystery_type" string never inserted into HTML', !breakdownHtml.includes('mystery_type'), null);
    check('[Classify-malformed] raw "constructor"/"__proto__" strings never inserted into HTML', !breakdownHtml.includes('>constructor<') && !breakdownHtml.includes('__proto__'), null);
    check('[Classify-malformed] unknown-safe types shown with generic label', breakdownHtml.includes('その他の記録'), null);

    // before-window record: silently excluded, no dedicated notice beyond the 3 above
    check('[Classify-malformed] exactly 3 notices shown (future/invalid-ts/invalid only; before-window is silent)', notices.length === 3, notices);
  });

  // ---- Read states --------------------------------------------------------
  await runScenario(browser, 'Read-unused', async (page) => {
    await seedRaw(page, undefined);
    await openReport(page);
    await openTrend(page);
    const emptyVisible = await page.evaluate(() => getComputedStyle(document.getElementById('trend-empty-area')).display !== 'none');
    const emptyText = await page.locator('#trend-empty-area').textContent();
    check('[Read-unused] shows neutral empty message', emptyVisible && emptyText.includes('この期間に保存された記録はありません'), emptyText);
    const failureVisible = await page.evaluate(() => getComputedStyle(document.getElementById('trend-failure-area')).display !== 'none');
    check('[Read-unused] failure message NOT shown (unused key is not a failure)', !failureVisible);
  });

  await runScenario(browser, 'Read-empty-array', async (page) => {
    await seedRaw(page, []);
    await openReport(page);
    await openTrend(page);
    const emptyVisible = await page.evaluate(() => getComputedStyle(document.getElementById('trend-empty-area')).display !== 'none');
    check('[Read-empty-array] shows neutral empty message', emptyVisible);
  });

  for (const [label, raw] of [['Read-empty-string', ''], ['Read-whitespace-string', '   '], ['Read-bad-json', '{not json'], ['Read-non-array', JSON.stringify({ foo: 'bar' })]]) {
    await runScenario(browser, label, async (page) => {
      await seedRaw(page, raw);
      await openReport(page);
      await openTrend(page);
      const failureVisible = await page.evaluate(() => getComputedStyle(document.getElementById('trend-failure-area')).display !== 'none');
      const failureText = await page.locator('#trend-failure-area').textContent();
      check(`[${label}] shows read-failure message (distinct from empty state)`, failureVisible && failureText.includes('読み込めませんでした'), failureText);
      const emptyVisible = await page.evaluate(() => getComputedStyle(document.getElementById('trend-empty-area')).display !== 'none');
      check(`[${label}] empty-state message NOT shown`, !emptyVisible);
      const chartHtml = await page.evaluate(() => document.getElementById('trend-week-chart').innerHTML);
      check(`[${label}] no chart rendered on read failure`, chartHtml === '', chartHtml);
    });
  }

  // ---- Single-read reuse / no storage mutation ---------------------------
  await runScenario(browser, 'Single-read-no-mutation', async (page) => {
    const now = Date.now();
    const recs = [{ ts: now, type: 'rp', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'roleplay_choice', scenario: { title: 'T' }, choices: [{ id: 1, text: 'A' }], selected: { id: 1, text: 'A', level: 'best' } } }];
    await seedRaw(page, recs);
    await openReport(page);

    const readCountBeforeTrend = await page.evaluate(() => {
      let n = 0;
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) { if (k === 'sst_activity_log_v1') n++; return orig.call(this, k); };
      window.__trendReadCounter = () => n;
      return 0;
    });
    await openTrend(page);
    const reads = await page.evaluate(() => window.__trendReadCounter());
    check('[Single-read-no-mutation] sst_activity_log_v1 read exactly once per buildTrend() call', reads === 1, reads);

    const storageUnchanged = await page.evaluate((expected) => localStorage.getItem('sst_activity_log_v1') === JSON.stringify(expected), recs);
    check('[Single-read-no-mutation] localStorage content unchanged after rendering', storageUnchanged);
  });

  // ---- Print isolation -----------------------------------------------------
  await runScenario(browser, 'Print-isolation', async (page) => {
    const now = Date.now();
    await seedRaw(page, [{ ts: now, type: 'rp', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'roleplay_choice', scenario: { title: 'T' }, choices: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }], selected: { id: 1, text: 'A', level: 'best' } } }]);
    await openReport(page);
    await openTrend(page);

    await page.emulateMedia({ media: 'print' });
    const rectsWhileTrendActive = await page.evaluate(() => ({
      report: document.getElementById('report-card').getClientRects().length,
      trend: document.getElementById('trend-card').getClientRects().length,
    }));
    check('[Print-isolation] #report-card NOT rendered while #s-trend is active', rectsWhileTrendActive.report === 0, rectsWhileTrendActive);
    check('[Print-isolation] #trend-card IS rendered while #s-trend is active', rectsWhileTrendActive.trend === 1, rectsWhileTrendActive);

    const detailExpanded = await page.evaluate(() => {
      const bodies = document.querySelectorAll('#trend-card .report-detail-body[hidden]');
      return bodies.length > 0 && Array.from(bodies).every((b) => getComputedStyle(b).display === 'block');
    });
    check('[Print-isolation] collapsed detail bodies force-expanded in print', detailExpanded);
    const toggleHidden = await page.evaluate(() => Array.from(document.querySelectorAll('#trend-card .report-detail-toggle')).every((t) => getComputedStyle(t).display === 'none'));
    check('[Print-isolation] detail toggle buttons hidden in print', toggleHidden);
    await page.emulateMedia({ media: 'screen' });

    await page.locator('#s-trend .back').click();
    await page.waitForTimeout(150);
    await page.emulateMedia({ media: 'print' });
    const rectsWhileReportActive = await page.evaluate(() => ({
      report: document.getElementById('report-card').getClientRects().length,
      trend: document.getElementById('trend-card').getClientRects().length,
    }));
    check('[Print-isolation] #report-card IS rendered while #s-report is active', rectsWhileReportActive.report === 1, rectsWhileReportActive);
    check('[Print-isolation] #trend-card NOT rendered while #s-report is active (no duplicate printing)', rectsWhileReportActive.trend === 0, rectsWhileReportActive);
    await page.emulateMedia({ media: 'screen' });
  });

  // ---- Accessibility: zoom/narrow width, forced-colors --------------------
  await runScenario(browser, 'A11y-narrow-forced-colors', async (page) => {
    await seedRaw(page, [
      { ts: Date.now(), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },
      { ts: Date.now() - 7 * 86400000, type: 'wq', lv: 1, result: 'best', schemaVersion: 1 },
    ]);
    await page.setViewportSize({ width: 360, height: 800 });
    await openReport(page);
    await openTrend(page);
    const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check('[A11y-narrow-forced-colors] no horizontal overflow at 360px viewport width', !hOverflow);

    await page.emulateMedia({ forcedColors: 'active' });
    const borders = await page.evaluate(() => {
      const bar = document.querySelector('.trend-week-bar');
      const actWrap = document.querySelector('.trend-act-bar-wrap');
      return { bar: bar ? getComputedStyle(bar).borderTopWidth : null, act: actWrap ? getComputedStyle(actWrap).borderTopWidth : null };
    });
    check('[A11y-narrow-forced-colors] week bar has a visible border under forced-colors', borders.bar && borders.bar !== '0px', borders);
    check('[A11y-narrow-forced-colors] activity-type bar has a visible border under forced-colors', borders.act && borders.act !== '0px', borders);
    await page.emulateMedia({ forcedColors: 'none' });
  });

  await runScenario(browser, 'A11y-zero-count-bars', async (page) => {
    const now = Date.now();
    await seedRaw(page, [{ ts: now, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]); // only week4 has records
    await openReport(page);
    await openTrend(page);
    const bars = await page.$$eval('.trend-week-bar-wrap', (els) => els.map((e) => e.innerHTML.trim()));
    check('[A11y-zero-count-bars] 0-count weeks render no bar element', bars.slice(0, 3).every((h) => h === ''), bars);
    check('[A11y-zero-count-bars] non-zero week renders a bar', bars[3] !== '', bars);
    const tableText = await page.locator('#trend-table-wrap').textContent();
    check('[A11y-zero-count-bars] table shows explicit "0（記録なし）" for empty weeks (not blank)', (tableText.match(/0（記録なし）/g) || []).length === 3, tableText);
  });

  await runScenario(browser, 'A11y-aria-expanded-toggle', async (page) => {
    const now = Date.now();
    await seedRaw(page, [{ ts: now, type: 'rp', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'roleplay_choice', scenario: { title: 'T' }, choices: [{ id: 1, text: 'A' }, { id: 2, text: 'B' }], selected: { id: 1, text: 'A', level: 'best' } } }]);
    await openReport(page);
    await openTrend(page);
    const toggle = page.locator('#trend-detail-list .report-detail-toggle').first();
    check('[A11y-aria-expanded-toggle] toggle starts collapsed (aria-expanded=false)', (await toggle.getAttribute('aria-expanded')) === 'false');
    await toggle.click();
    check('[A11y-aria-expanded-toggle] toggle reflects expanded state (aria-expanded=true)', (await toggle.getAttribute('aria-expanded')) === 'true');
  });

  // ---- Week-boundary correctness (timezone-safe pinned-time scenarios) ---
  await runScenario(browser, 'Boundary-exact-monday-and-now', async (page) => {
    const localArgs = [2026, 0, 8, 15, 0, 0]; // Thu Jan 8 2026, 15:00 local (Asia/Tokyo context below)
    const fixedMs = await page.evaluate((a) => new Date(...a).getTime(), localArgs);
    await page.evaluate((fixedMs) => {
      const mon = new Date(2026, 0, 5, 0, 0, 0, 0).getTime(); // Monday 00:00:00.000 local, same week
      localStorage.setItem('sst_activity_log_v1', JSON.stringify([
        { ts: mon, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },       // exact week-start boundary (closed)
        { ts: fixedMs, type: 'wq', lv: 1, result: 'best', schemaVersion: 1 },   // exact "now" boundary (closed)
        { ts: fixedMs + 1, type: 'story', lv: 1, result: 'best', schemaVersion: 1 }, // 1ms after now -> future
      ]));
    }, fixedMs);
    await pinDate(page, fixedMs);
    await page.reload({ waitUntil: 'load' });
    await openReport(page);
    await openTrend(page);
    const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
    check('[Boundary-exact-monday-and-now] week4 = 2 (Monday-00:00 and exact-now both counted inclusively)', counts[3] === '2', counts);
    const notices = await page.$$eval('.trend-notice', (els) => els.map((e) => e.textContent));
    check('[Boundary-exact-monday-and-now] now+1ms correctly excluded as future, even in same calendar week', notices.some((t) => t.includes('現在より後')), notices);
  });

  await runScenario(browser, 'Boundary-year-rollover', async (page) => {
    const localArgs = [2026, 0, 6, 12, 0, 0]; // Tue Jan 6 2026, this week = Mon Jan5-Sun Jan11
    const fixedMs = await page.evaluate((a) => new Date(...a).getTime(), localArgs);
    await page.evaluate((fixedMs) => {
      const mk = (y, m, d, h) => new Date(y, m, d, h).getTime();
      localStorage.setItem('sst_activity_log_v1', JSON.stringify([
        { ts: mk(2025, 11, 15, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }, // week1 Mon Dec15 2025
        { ts: mk(2025, 11, 22, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }, // week2 Mon Dec22 2025
        { ts: mk(2025, 11, 29, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }, // week3 Mon Dec29 2025
        { ts: mk(2026, 0, 5, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },   // week4 Mon Jan5 2026 (this week)
      ]));
    }, fixedMs);
    await pinDate(page, fixedMs);
    await page.reload({ waitUntil: 'load' });
    await openReport(page);
    await openTrend(page);
    const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
    check('[Boundary-year-rollover] all 4 weeks correctly counted across a Dec2025->Jan2026 rollover', counts.join(',') === '1,1,1,1', counts);
  });

  // DST needs its own context with timezoneId set at creation time (America/New_York
  // spring-forward DST transition is 2026-03-08), so it is run as a standalone block
  // below rather than via runScenario() (which always uses the default timezone).
  {
    const { context, page, bucket } = await freshPage(browser, { timezoneId: 'America/New_York' });
    try {
      const localArgs = [2026, 2, 10, 12, 0, 0]; // Tue Mar 10 2026 local NY time (after Mar8 DST transition)
      const fixedMs = await page.evaluate((a) => new Date(...a).getTime(), localArgs);
      await page.evaluate((fixedMs) => {
        const mk = (y, m, d, h) => new Date(y, m, d, h).getTime();
        localStorage.setItem('sst_activity_log_v1', JSON.stringify([
          { ts: mk(2026, 1, 16, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }, // week1 Mon Feb16
          { ts: mk(2026, 1, 23, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }, // week2 Mon Feb23
          { ts: mk(2026, 2, 2, 10), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },  // week3 Mon Mar2 (contains DST transition Mar8)
          { ts: fixedMs - 3600000, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 },   // week4, this week, 1h before now
        ]));
      }, fixedMs);
      await pinDate(page, fixedMs);
      await page.reload({ waitUntil: 'load' });
      await openReport(page);
      await openTrend(page);
      const counts = await page.$$eval('.trend-week-count', (els) => els.map((e) => e.textContent));
      check('[Boundary-dst-america-new-york] all 4 weeks correctly counted across a US DST spring-forward transition', counts.join(',') === '1,1,1,1', counts);
    } catch (e) {
      check('[Boundary-dst-america-new-york] scenario threw', false, String(e && e.stack ? e.stack : e));
    }
    check('[Boundary-dst-america-new-york] no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    check('[Boundary-dst-america-new-york] no pageerror', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ---- Non-regression: existing #s-report / BACK_MAP entries unaffected --
  await runScenario(browser, 'NonRegression-existing-report', async (page) => {
    const now = Date.now();
    await seedRaw(page, [{ ts: now, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]);
    await openReport(page);
    check('[NonRegression-existing-report] existing report-print-btn still present and wired', await page.locator('#report-print-btn').isVisible());
    check('[NonRegression-existing-report] existing report total count unaffected', (await page.locator('#rpt-total').textContent()) === '1');
    // home() still returns to home from #s-report (back button) as before.
    await page.locator('#s-report .back').click();
    await page.waitForTimeout(150);
    check('[NonRegression-existing-report] #s-report back button still goes home', await page.evaluate(() => document.getElementById('s-home').classList.contains('on')));
  });

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
