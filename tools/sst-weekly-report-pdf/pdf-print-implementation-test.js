// Phase SST-WEEKLY-REPORT-PDF-IMPLEMENTATION-1: verifies the new print/PDF
// export added to sst-app.html's "今週のできたことレポート" (#s-report) screen.
// Read-only w.r.t. sst-app.html (never edits it). Drives the real,
// user-reachable path (home -> .mc-report card -> #s-report) with genuine
// clicks only. Seeds localStorage['sst_activity_log_v1'] directly (same
// shape recordActivity() itself writes) to exercise 0/1/multiple/long/large
// record-count scenarios without needing to play through every SST activity
// screen. Uses page.emulateMedia({media:'print'}) to verify print CSS, and a
// window.print() spy (never a real print dialog) to verify invocation count.
const fs = require('fs');
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

async function freshPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const bucket = { consoleErrors: [], pageErrors: [] };
  collectErrors(page, bucket);
  await page.goto('file://' + path.join(ROOT, 'sst-app.html'), { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(300);
  return { context, page, bucket };
}

// Compute a timestamp guaranteed to fall inside "this week" exactly the way
// the app itself defines it (getWeekRange(), Monday-start), by calling the
// app's own already-loaded function rather than reimplementing the rule.
async function seedThisWeek(page, records) {
  const bounds = await page.evaluate(() => {
    const r = getWeekRange();
    const start = new Date(r.mon).setHours(0, 0, 0, 0);
    const end = new Date(r.sun).setHours(23, 59, 59, 999);
    return { start, end };
  });
  const withTs = records.map((r, i) => ({ ...r, ts: bounds.start + 3600 * 1000 * (i % 20) + Math.floor((i / 20)) * 26 * 3600 * 1000 }));
  // Clamp into range defensively (large i could exceed the week window).
  const clamped = withTs.map((r) => ({ ...r, ts: Math.min(Math.max(r.ts, bounds.start + 1000), bounds.end - 1000) }));
  await page.evaluate((recs) => localStorage.setItem('sst_activity_log_v1', JSON.stringify(recs)), clamped);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  return clamped;
}

async function openReportScreen(page) {
  await page.locator('.mc-report').click({ timeout: 5000 });
  await page.waitForTimeout(300);
}

function longText(n, word) {
  return Array.from({ length: n }, (_, i) => `${word}${i + 1}`).join('。') + '。';
}

// ---- fixtures ----------------------------------------------------------

const FIX_ONE = [
  { type: 'rp', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'roleplay_choice', scenario: { title: '友だちに借りたものを返す' }, choices: [{ id: 1, text: 'すぐに謝って返す' }, { id: 2, text: '黙って返す' }], selected: { id: 1, text: 'すぐに謝って返す', level: 'best' } } },
];

const FIX_MULTI = [
  { type: 'rp', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'roleplay_choice', scenario: { title: '友だちに借りたものを返す' }, choices: [{ id: 1, text: 'すぐに謝って返す' }, { id: 2, text: '黙って返す' }], selected: { id: 1, text: 'すぐに謝って返す', level: 'best' } } },
  { type: 'branch', lv: 2, result: 'good', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'branch_ending', scenario: { title: '休み時間のできごと' }, route: ['声をかける', '一緒に遊ぶ'], ending: { title: 'なかよく遊べた', level: 'good' } } },
  { type: 'wq', lv: 1, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'word_quiz_session', answers: [{ question: { prompt: 'ありがとうと言われたら？' }, selected: { text: 'どういたしまして', level: 'best' } }] } },
  { type: 'quiz', lv: 2, result: 'good', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'sst_quiz_session', answers: [{ question: { prompt: '順番はまもるべき？' }, selected: { text: 'まもる', level: 'best' } }] } },
  { type: 'story', lv: 1, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'social_story_completion', story: { title: 'きゅうしょくのじかん' }, answers: [{ prompt: { text: 'どうする？' }, selected: { text: 'ならんでまつ', level: 'best' } }] } },
  { type: 'emotion', lv: 0, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'emotion_selection', selected: { face: '😊', label: 'うれしい' } } },
  { type: 'phrase', lv: 0, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'phrase_action', category: 'help', phrase: 'てつだってください', action: 'spoken' } },
  { type: 'breath', lv: 0, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'breathing_activity', completionStatus: 'done' } },
  { type: 'diary', lv: 0, result: 'done', schemaVersion: 1 },
  { type: 'photo', lv: 0, result: 'done', schemaVersion: 1 },
];

function fixLong() {
  const answers = Array.from({ length: 20 }, (_, i) => ({
    question: { prompt: `問題${i + 1}: ${longText(8, 'とても長い状況説明の単語')}` },
    selected: { text: longText(6, 'かなり長い回答テキストの単語'), level: i % 3 === 0 ? 'best' : (i % 3 === 1 ? 'good' : 'try') },
  }));
  return [{ type: 'wq', lv: 3, result: 'best', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'word_quiz_session', answers } }];
}

function fixBulk(n) {
  const types = ['rp', 'wq', 'story', 'branch', 'quiz', 'diary', 'thermo', 'breath', 'photo', 'emotion', 'phrase'];
  return Array.from({ length: n }, (_, i) => ({ type: types[i % types.length], lv: (i % 3), result: 'done', schemaVersion: 1 }));
}

// ---- scenario runner -----------------------------------------------------

async function runScenario(browser, name, records) {
  const { context, page, bucket } = await freshPage(browser);
  const out = { name, recordCount: records.length };
  try {
    if (records.length) await seedThisWeek(page, records);
    await openReportScreen(page);

    out.screenOpened = await page.evaluate(() => document.getElementById('s-report').classList.contains('on'));
    check(`[${name}] #s-report opened via real .mc-report click`, out.screenOpened);

    out.printBtnVisible = await page.locator('#report-print-btn').isVisible().catch(() => false);
    check(`[${name}] print/PDF button visible`, out.printBtnVisible);

    // ---- empty-state / non-empty-state content sanity ----
    const activityText = await page.locator('#report-activity-list').innerText().catch(() => '');
    out.activityListText = activityText.slice(0, 60);
    if (records.length === 0) {
      check(`[${name}] empty-state message shown ("今週のきろくがないよ")`, activityText.includes('今週のきろくがないよ'), activityText);
    } else {
      check(`[${name}] activity list is non-empty`, activityText.trim().length > 0 && !activityText.includes('今週のきろくがないよ'), out.activityListText);
    }

    const total = await page.locator('#rpt-total').innerText().catch(() => '');
    out.rptTotal = total;
    check(`[${name}] #rpt-total reflects seeded record count`, Number(total) === records.length, { total, expected: records.length });

    // ---- print-media CSS verification (page.emulateMedia, no real dialog) ----
    await page.emulateMedia({ media: 'print' });
    // Empirically confirmed test-environment artifact (not a real print/CSS defect):
    // this headless Chromium build's getComputedStyle() can read a stale
    // pre-emulateMedia value for a brief window after Emulation.setEmulatedMedia,
    // even though the actual compositor paint (page.screenshot()) is correct
    // immediately. A short wait lets the style cache catch up before assertions
    // that read getComputedStyle(); confirmed necessary and sufficient via a
    // ground-truth screenshot diff during investigation of this Phase.
    await page.waitForTimeout(800);
    const printState = await page.evaluate(() => {
      function vis(sel) { const el = document.querySelector(sel); return el ? getComputedStyle(el).visibility : null; }
      function disp(sel) { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : null; }
      function color(sel) { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null; }
      const hiddenBodies = Array.from(document.querySelectorAll('#report-detail-list .report-detail-body[hidden]'));
      return {
        reportCardVisibility: vis('#report-card'),
        backBtnVisibility: vis('.back'),
        homeBtnVisibility: vis('#donomanaHomeBtn'),
        a11yBtnVisibility: vis('#donomanaA11yBtn'),
        printBtnVisibility: vis('.report-print-btn'),
        shareBtnVisibility: vis('.report-share-btn'),
        csvBtnVisibility: vis('.report-csv-btn'),
        nameRowVisibility: vis('.report-name-row'),
        teacherNoticeVisibility: vis('.teacher-notice'),
        detailToggleDisplay: disp('.report-detail-toggle'),
        headerTitleColor: color('.report-title'),
        hiddenDetailBodyCount: hiddenBodies.length,
        hiddenDetailBodyForcedDisplay: hiddenBodies.map((el) => getComputedStyle(el).display),
      };
    });
    out.printState = printState;
    check(`[${name}] print media: #report-card stays visible`, printState.reportCardVisibility === 'visible', printState.reportCardVisibility);
    check(`[${name}] print media: back button hidden`, printState.backBtnVisibility === 'hidden', printState.backBtnVisibility);
    check(`[${name}] print media: home button hidden`, printState.homeBtnVisibility === 'hidden', printState.homeBtnVisibility);
    check(`[${name}] print media: A11y button hidden`, printState.a11yBtnVisibility === 'hidden', printState.a11yBtnVisibility);
    check(`[${name}] print media: PDF button itself hidden`, printState.printBtnVisibility === 'hidden', printState.printBtnVisibility);
    check(`[${name}] print media: share button hidden`, printState.shareBtnVisibility === 'hidden', printState.shareBtnVisibility);
    check(`[${name}] print media: CSV button hidden`, printState.csvBtnVisibility === 'hidden', printState.csvBtnVisibility);
    check(`[${name}] print media: name input row hidden`, printState.nameRowVisibility === 'hidden', printState.nameRowVisibility);
    check(`[${name}] print media: teacher-notice hidden`, printState.teacherNoticeVisibility === 'hidden', printState.teacherNoticeVisibility);
    check(`[${name}] print media: header title color is NOT white (readable without background graphics)`, printState.headerTitleColor !== 'rgb(255, 255, 255)', printState.headerTitleColor);
    if (printState.hiddenDetailBodyCount > 0) {
      check(`[${name}] print media: collapsed detail bodies force-expanded (display != none)`, printState.hiddenDetailBodyForcedDisplay.every((d) => d !== 'none'), printState.hiddenDetailBodyForcedDisplay);
    }
    await page.emulateMedia({ media: null });

    // ---- screen state NOT mutated by emulateMedia (no beforeprint/afterprint used) ----
    const stillHiddenAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#report-detail-list .report-detail-body[hidden]')).length);
    check(`[${name}] screen state unchanged after print-media check (detail bodies still collapsed on screen)`, stillHiddenAfter === printState.hiddenDetailBodyCount, { before: printState.hiddenDetailBodyCount, after: stillHiddenAfter });

    // ---- window.print() invocation count (spy, never a real dialog) ----
    await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });

    await page.locator('#report-print-btn').click();
    await page.waitForTimeout(50);
    let calls = await page.evaluate(() => window.__printCalls);
    check(`[${name}] window.print() called exactly once on mouse click`, calls === 1, calls);

    await page.evaluate(() => { window.__printCalls = 0; });
    await page.locator('#report-print-btn').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    calls = await page.evaluate(() => window.__printCalls);
    check(`[${name}] window.print() called exactly once on keyboard Enter (native button, no custom keydown)`, calls === 1, calls);

    await page.evaluate(() => { window.__printCalls = 0; });
    await page.keyboard.press(' ');
    await page.waitForTimeout(50);
    calls = await page.evaluate(() => window.__printCalls);
    check(`[${name}] window.print() called exactly once on keyboard Space (Switch-control equivalent)`, calls === 1, calls);

    // ---- Tab reachability (native button participates in normal tab order) ----
    const isFocusable = await page.evaluate(() => {
      const btn = document.getElementById('report-print-btn');
      return btn.tabIndex >= 0 && !btn.disabled;
    });
    check(`[${name}] PDF button is a native, keyboard-focusable button (no tabindex=-1, not disabled)`, isFocusable);
  } catch (e) {
    check(`[${name}] scenario threw`, false, String(e && e.message ? e.message : e));
  }
  out.consoleErrors = bucket.consoleErrors;
  out.pageErrors = bucket.pageErrors;
  check(`[${name}] no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
  check(`[${name}] no pageerror`, bucket.pageErrors.length === 0, bucket.pageErrors);
  await context.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const scenarios = [];

  scenarios.push(await runScenario(browser, 'CaseA-0records', []));
  scenarios.push(await runScenario(browser, 'CaseB-1record', FIX_ONE));
  scenarios.push(await runScenario(browser, 'CaseC-multipleTypes', FIX_MULTI));
  scenarios.push(await runScenario(browser, 'CaseD-longFeedback', fixLong()));
  scenarios.push(await runScenario(browser, 'CaseE-10records', fixBulk(10)));
  scenarios.push(await runScenario(browser, 'CaseF-30records', fixBulk(30)));

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  fs.writeFileSync(path.join(__dirname, 'pdf-print-implementation-results.json'), JSON.stringify({ summary: { passed, total: results.length }, checks: results, scenarios }, null, 2), 'utf-8');
  process.exitCode = passed === results.length ? 0 : 1;
})();
