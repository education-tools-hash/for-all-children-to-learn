// Phase SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1: verifies the new
// "選択の履歴" (#s-answer-history-list / #s-answer-history-detail) screens added
// to sst-app.html, per
// docs/design-system/donomana-sst-answer-change-visualization-design-v1_0.md
// and the Implementation Phase's own §3 A-F corrections (state-4 messaging,
// non-guessed exclusion denominators, <thead> print-repeat, list-screen bottom
// back-nav, hardened validation, broken cross-reference cleanup).
//
// Read-only w.r.t. sst-app.html (never edits it). Drives the real,
// user-reachable path (home -> .mc-report -> #trend-nav-btn -> #ahist-nav-btn)
// with genuine clicks/keyboard only. Seeds localStorage['sst_activity_log_v1']
// directly (same shape recordActivity() itself writes, plus deliberately
// malformed/edge-case entries) to exercise comparison-key/signature
// extraction, validation, grouping, the 6-state taxonomy, focus management,
// print isolation and accessibility behavior without needing to play through
// every SST activity screen.
//
// Real multi-page PDF generation/verification (page count, <thead> repeat
// across pages, extracted text, rendered page images) was performed ad hoc
// with Playwright's page.pdf() + poppler-utils (pdfinfo/pdftotext/pdftoppm)
// during this Phase and is reported in the Phase's final report, not
// reproduced here as a committed artifact (PDFs/images must not be added to
// git, per this Phase's Allowed Files note).
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

async function openReport(page) {
  await page.locator('.mc-report').click({ timeout: 5000 });
  await page.waitForTimeout(150);
}
async function openTrend(page) {
  await page.locator('#trend-nav-btn').click({ timeout: 5000 });
  await page.waitForTimeout(150);
}
async function openAhistList(page) {
  await page.locator('#ahist-nav-btn').click({ timeout: 5000 });
  await page.waitForTimeout(150);
}

// Pins window.Date/Date.now() to a fixed instant (see trend-implementation-test.js
// for the same pattern/rationale).
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

async function runScenario(browser, name, fn, contextOptions) {
  const { context, page, bucket } = await freshPage(browser, contextOptions);
  try {
    await fn(page);
  } catch (e) {
    check(`[${name}] scenario threw`, false, String(e && e.stack ? e.stack : e));
  }
  check(`[${name}] no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
  check(`[${name}] no pageerror`, bucket.pageErrors.length === 0, bucket.pageErrors);
  await context.close();
}

// Fixture builders -----------------------------------------------------------
// All timestamps are relative to a fixed "now" = 2026-10-02 (Fri) 10:00 JST,
// whose Monday-aligned "this week" start is 2026-09-28.
const NOW_MS = new Date(2026, 9, 2, 10, 0, 0).getTime();
const THIS_MONDAY = new Date(2026, 8, 28).getTime();
const day = (n, h) => THIS_MONDAY + n * 86400000 + (h === undefined ? 3600000 : h * 3600000);

function rpRecord(ts, { sceneId = 'rp_1_01', title = 'あいさつ', situation = '友だちに会いました', choices, selected, custom = false } = {}) {
  const ch = choices || [{ id: 'c1', text: 'こんにちは', level: 'good' }, { id: 'c2', text: 'だまる', level: 'try' }];
  return { ts, type: 'rp', lv: 2, result: 2, schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'roleplay_choice', custom,
    scenario: { id: sceneId, title, situation },
    choices: ch,
    selected: selected || ch[0]
  }};
}

function wqRecord(ts, answers) {
  return { ts, type: 'wq', lv: 1, result: 'done', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'word_quiz_session', answers
  }};
}
function wqAnswer({ qid = 'wq_1_01', situation = '朝のあいさつ', prompt = 'なんと言いますか？', choices, selected } = {}) {
  const ch = choices || [{ id: 'c1', text: 'おはよう' }, { id: 'c2', text: 'だまる' }];
  return { question: { id: qid, situation, prompt }, choices: ch, selected: selected || ch[0] };
}

function quizRecord(ts, answers) {
  return { ts, type: 'quiz', lv: 1, result: '100%', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'sst_quiz_session', answers
  }};
}
function quizAnswer({ qid = 'qz_1_01', text = 'こまったときはどうする？', choices, selected } = {}) {
  const ch = choices || [{ id: 'c1', text: 'せんせいに言う' }, { id: 'c2', text: 'がまんする' }];
  return { question: { id: qid, text }, choices: ch, selected: selected || ch[0] };
}

function storyRecord(ts, { storyId = 'st_1_01', title = 'きゅうしょく', answers } = {}) {
  return { ts, type: 'story', lv: 1, result: 'done', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'social_story_completion',
    story: { id: storyId, title }, answers
  }};
}
function storyAnswer({ pageIndex = 0, text = 'どうしますか？', choices, selected } = {}) {
  const ch = choices || [{ id: 'c1', text: 'たべる' }, { id: 'c2', text: 'のこす' }];
  return { pageIndex, prompt: { text }, choices: ch, selected: selected || ch[0] };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ---- Navigation / scaffolding -------------------------------------------
  await runScenario(browser, 'Nav-basic', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page);
    await openTrend(page);
    check('[Nav-basic] #ahist-nav-btn visible on #s-trend', await page.locator('#ahist-nav-btn').isVisible());

    await openAhistList(page);
    check('[Nav-basic] #s-answer-history-list becomes active', await page.evaluate(() => document.getElementById('s-answer-history-list').classList.contains('on')));
    check('[Nav-basic] #s-trend becomes inactive', await page.evaluate(() => !document.getElementById('s-trend').classList.contains('on')));
    const focusedList = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] list heading receives focus on open', focusedList === 'ahist-list-title', focusedList);
    check('[Nav-basic] list heading has tabindex=-1', (await page.evaluate(() => document.getElementById('ahist-list-title').tabIndex)) === -1);

    check('[Nav-basic] exactly 1 group formed', (await page.locator('.ahist-group-btn').count()) === 1);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    check('[Nav-basic] #s-answer-history-detail becomes active', await page.evaluate(() => document.getElementById('s-answer-history-detail').classList.contains('on')));
    const focusedDetail = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] detail heading receives focus on open', focusedDetail === 'ahist-detail-title', focusedDetail);

    // top back: detail -> list, focus restored to the clicked group button
    await page.locator('#s-answer-history-detail .back').click();
    await page.waitForTimeout(150);
    check('[Nav-basic] top back (detail) returns to list', await page.evaluate(() => document.getElementById('s-answer-history-list').classList.contains('on')));
    let f = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] top back (detail) restores focus to the clicked group button', f === 'ahist-group-btn-0', f);

    // bottom back: list -> #s-trend (Implementation Phase §3D)
    check('[Nav-basic] bottom-back-bar shown on list', await page.evaluate(() => document.getElementById('bottom-back-bar').classList.contains('show')));
    await page.locator('#bottom-back-btn').click();
    await page.waitForTimeout(150);
    check('[Nav-basic] bottom back (list) returns to #s-trend', await page.evaluate(() => document.getElementById('s-trend').classList.contains('on')));
    f = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] bottom back (list) restores focus to #ahist-nav-btn (same destination/focus as top back)', f === 'ahist-nav-btn', f);

    // detail screen bottom back bar as well
    await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    await page.locator('#bottom-back-btn').click();
    await page.waitForTimeout(150);
    check('[Nav-basic] bottom back (detail) returns to list', await page.evaluate(() => document.getElementById('s-answer-history-list').classList.contains('on')));
    f = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Nav-basic] bottom back (detail) restores focus same as top back', f === 'ahist-group-btn-0', f);
  });

  // ---- Focus-restore fallback when origin element has disappeared --------
  await runScenario(browser, 'Focus-fallback', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    // Simulate the clicked origin element having vanished (re-render could remove it).
    await page.evaluate(() => { document.getElementById('ahist-group-btn-0').remove(); });
    await page.locator('#s-answer-history-detail .back').click();
    await page.waitForTimeout(150);
    const f = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Focus-fallback] falls back to list heading when origin element is gone', f === 'ahist-list-title', f);
  });

  // ---- Comparability core: per-type grouping correctness ------------------
  await runScenario(browser, 'Comparability-core', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      // rp answered twice, same scenario, choice order shuffled differently -> 1 group, 2 events
      rpRecord(day(0), { choices: [{ id: 'c2', text: 'だまる' }, { id: 'c1', text: 'こんにちは' }], selected: { id: 'c2', text: 'だまる' } }),
      rpRecord(day(1), { choices: [{ id: 'c1', text: 'こんにちは' }, { id: 'c2', text: 'だまる' }], selected: { id: 'c1', text: 'こんにちは' } }),
      // wq: 2 different questions in one session -> 2 separate groups
      wqRecord(day(2), [wqAnswer({ qid: 'wq_1_01' }), wqAnswer({ qid: 'wq_1_02', situation: '夜のあいさつ' })]),
      // quiz: 1 question -> 1 group
      quizRecord(day(3), [quizAnswer()]),
      // story: 1 page -> 1 group
      storyRecord(day(4), { answers: [storyAnswer()] }),
      // out-of-scope type (ineligible, must not form a group or crash)
      { ts: day(1), type: 'photo', lv: 1, result: 1, schemaVersion: 1, detail: null }
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const titles = await page.locator('.ahist-group-btn .ahist-group-title').allTextContents();
    check('[Comparability-core] exactly 5 groups (rp x1 merged, wq x2 separate, quiz x1, story x1)', titles.length === 5, titles);

    const rpIdx = titles.findIndex((t) => t.includes('ロールプレイ'));
    await page.locator('.ahist-group-btn').nth(rpIdx).click();
    await page.waitForTimeout(150);
    check('[Comparability-core] rp group has 2 rows despite shuffled choice order (shuffle-only diff stays in same group)', (await page.locator('.ahist-grid tbody tr').count()) === 2, await page.locator('.ahist-grid tbody tr').count());
  });

  // ---- WQ scene-only vs question-only changed -> different groups --------
  await runScenario(browser, 'WQ-field-sensitivity', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      wqRecord(day(0), [wqAnswer({ qid: 'wq_x', situation: 'A', prompt: 'P' })]),
      // same qid, situation changed only -> different condition signature -> different group
      wqRecord(day(1), [wqAnswer({ qid: 'wq_x', situation: 'B', prompt: 'P' })]),
      // same qid, prompt changed only -> different condition signature -> different group
      wqRecord(day(2), [wqAnswer({ qid: 'wq_x', situation: 'A', prompt: 'Q' })])
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const count = await page.locator('.ahist-group-btn').count();
    check('[WQ-field-sensitivity] situation-only and prompt-only changes each produce a distinct group (3 total)', count === 3, count);
  });

  // ---- Delimiter-safe signature (no string-concat corruption) -------------
  await runScenario(browser, 'Delimiter-safety', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      quizRecord(day(0), [quizAnswer({ qid: 'qz_d', text: 'A:B|C"D', choices: [{ id: 'c1', text: 'x:y|z' }, { id: 'c2', text: 'normal' }], selected: { id: 'c1', text: 'x:y|z' } })]),
      quizRecord(day(1), [quizAnswer({ qid: 'qz_d', text: 'A:B|C"D', choices: [{ id: 'c1', text: 'x:y|z' }, { id: 'c2', text: 'normal' }], selected: { id: 'c2', text: 'normal' } })])
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    check('[Delimiter-safety] identical delimiter-laden text still groups into exactly 1 group', (await page.locator('.ahist-group-btn').count()) === 1, await page.locator('.ahist-group-btn').count());
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    check('[Delimiter-safety] both answer events present in the single group', (await page.locator('.ahist-grid tbody tr').count()) === 2);
  });

  // ---- Validation hardening: malformed data excluded, not coerced --------
  await runScenario(browser, 'Validation-hardening', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      // whitespace-only choice id -> excluded (record-level for rp)
      rpRecord(day(0), { sceneId: 'rp_v1', choices: [{ id: ' ', text: 'A' }, { id: 'c2', text: 'B' }], selected: { id: ' ', text: 'A' } }),
      // duplicate choice ids -> excluded
      rpRecord(day(0), { sceneId: 'rp_v2', choices: [{ id: 'c1', text: 'A' }, { id: 'c1', text: 'B' }], selected: { id: 'c1', text: 'A' } }),
      // selected.id not present in choices -> excluded
      rpRecord(day(0), { sceneId: 'rp_v3', selected: { id: 'nope', text: 'x' } }),
      // selected.text mismatched vs the matching choice's text -> excluded
      rpRecord(day(0), { sceneId: 'rp_v4', selected: { id: 'c1', text: 'wrong-text' } }),
      // missing parent scene id (empty string) -> excluded
      rpRecord(day(0), { sceneId: '' }),
      // custom RP (not built-in) -> excluded
      rpRecord(day(0), { sceneId: 'rp_v5', custom: true }),
      // non-integer pageIndex for story -> that one answer-event excluded, not the session
      storyRecord(day(1), { storyId: 'st_v1', answers: [storyAnswer({ pageIndex: 1.5 }), storyAnswer({ pageIndex: 0 })] }),
      // whitespace-only required context text (situation) -> excluded
      rpRecord(day(0), { sceneId: 'rp_v6', situation: '   ' }),
      // one genuinely valid record, to confirm the suite isn't vacuously passing
      rpRecord(day(2), { sceneId: 'rp_valid' })
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const titles = await page.locator('.ahist-group-btn .ahist-group-title').allTextContents();
    check('[Validation-hardening] only 2 groups survive (rp_valid + story page0; all other malformed variants excluded)', titles.length === 2, titles);

    const storyIdx = titles.findIndex((t) => t.includes('ソーシャルストーリー'));
    check('[Validation-hardening] story group found', storyIdx >= 0, titles);
    await page.locator('.ahist-group-btn').nth(storyIdx).click();
    await page.waitForTimeout(150);
    check('[Validation-hardening] story group has exactly 1 row (the pageIndex:1.5 answer-event excluded, pageIndex:0 kept -- single-answer exclusion granularity)', (await page.locator('.ahist-grid tbody tr').count()) === 1, await page.locator('.ahist-grid tbody tr').count());
  });

  // ---- Single malformed answer inside an otherwise-valid WQ session -------
  await runScenario(browser, 'Partial-session-exclusion', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      wqRecord(day(0), [
        wqAnswer({ qid: 'wq_p1' }),                                   // valid
        { question: { id: 'wq_p2', situation: 'x', prompt: 'y' }, choices: [{ id: 'c1', text: 'A' }], selected: { id: 'bad', text: 'A' } }, // invalid: selected.id not in choices
        wqAnswer({ qid: 'wq_p3' })                                    // valid
      ])
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    check('[Partial-session-exclusion] 2 groups survive (wq_p1, wq_p3); wq_p2 excluded without affecting siblings', (await page.locator('.ahist-group-btn').count()) === 2, await page.locator('.ahist-group-btn').count());
  });

  // ---- 6-state taxonomy ----------------------------------------------------
  await runScenario(browser, 'State-1-read-failure', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, 'not-json{{{');
    await openReport(page); await openTrend(page); await openAhistList(page);
    check('[State-1] failure area shown', await page.locator('#ahist-list-failure-area').isVisible());
    check('[State-1] empty area hidden', !(await page.locator('#ahist-list-empty-area').isVisible()));
    check('[State-1] no group buttons rendered', (await page.locator('.ahist-group-btn').count()) === 0);
  });

  await runScenario(browser, 'State-2-no-records-in-period', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(THIS_MONDAY - 40 * 86400000)]); // before the 4-week window
    await openReport(page); await openTrend(page); await openAhistList(page);
    const txt = await page.locator('#ahist-list-empty-area').textContent();
    check('[State-2] empty area shown with "no records in period" message', txt.includes('この期間に保存された記録はありません'), txt);
  });

  await runScenario(browser, 'State-3-no-eligible-type', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [{ ts: day(0), type: 'emotion', lv: 1, result: 1, schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'emotion_selection', selected: { label: 'x' } } }]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const txt = await page.locator('#ahist-list-empty-area').textContent();
    check('[State-3] empty area shown with "no target-type activity" message (distinct from state 2)', txt.includes('対象となる活動') && !txt.includes('保存された記録はありません'), txt);
  });

  await runScenario(browser, 'State-4-no-comparable-answers', async (page) => {
    await pinDate(page, NOW_MS);
    // eligible type, but every record fails comparison validation
    await seedRaw(page, [rpRecord(day(0), { sceneId: '' }), rpRecord(day(1), { custom: true })]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const txt = await page.locator('#ahist-list-empty-area').textContent();
    check('[State-4] dedicated message shown (Implementation Phase §3A), no empty list shown as if "no records"', txt.includes('比較に必要な情報が不足している'), txt);
    check('[State-4] message has no guessed denominator (no "件中" phrasing)', !txt.includes('件中'), txt);
  });

  await runScenario(browser, 'State-5-comparable', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    check('[State-5] 1 group rendered, no failure/empty areas shown', (await page.locator('.ahist-group-btn').count()) === 1 && !(await page.locator('#ahist-list-empty-area').isVisible()) && !(await page.locator('#ahist-list-failure-area').isVisible()));
  });

  // ---- Record-level vs answer-event-level notice separation (§3B) --------
  await runScenario(browser, 'Notice-separation', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      rpRecord(day(0)), // 1 valid, comparable group
      // record-level exclusion: answers not an array at all (denominator unknown)
      { ts: day(1), type: 'wq', lv: 1, result: 'done', schemaVersion: 1, detail: { detailSchemaVersion: 1, type: 'word_quiz_session', answers: 'not-an-array' } },
      // answer-event-level exclusion inside an otherwise-valid session
      quizRecord(day(2), [quizAnswer(), { question: { id: 'qz_bad', text: 'x' }, choices: [{ id: 'c1', text: 'A' }], selected: null }])
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const noticeTxt = await page.locator('#ahist-list-notice-area').textContent();
    check('[Notice-separation] list shows a state-6 style generic exclusion notice, not a specific "全X件中Y件" count', noticeTxt.includes('一部の記録') && !noticeTxt.includes('件中'), noticeTxt);
    // the valid rp + valid quiz answer still form their own groups and are shown
    const groupCount = await page.locator('.ahist-group-btn').count();
    check('[Notice-separation] valid groups (rp + quiz) still shown despite other records having exclusions', groupCount === 2, groupCount);
  });

  // ---- 3-key sort / ts semantics ------------------------------------------
  await runScenario(browser, 'Order-ts-semantics', async (page) => {
    await pinDate(page, NOW_MS);
    const log = [
      rpRecord(day(3)),
      rpRecord(day(1)),
      rpRecord(day(2))
    ];
    await seedRaw(page, log);
    await openReport(page); await openTrend(page); await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    const rowTexts = await page.locator('.ahist-grid tbody tr th').allTextContents();
    const isAscending = rowTexts.every((t, i) => i === 0 || new Date(t.match(/(\d{4})\/(\d+)\/(\d+) (\d+):(\d+)/).slice(1).join('-')) >= 0);
    check('[Order-ts-semantics] 3 rows rendered in ts-ascending order', rowTexts.length === 3 && rowTexts[0].includes('9/29') && rowTexts[2].includes('10/1'), rowTexts);
  });

  // ---- Single storage read / no mutation (§14.4) ---------------------------
  await runScenario(browser, 'Single-read-no-mutation', async (page) => {
    await pinDate(page, NOW_MS);
    const recs = [rpRecord(day(0))];
    await seedRaw(page, recs);
    await openReport(page); await openTrend(page);

    await page.evaluate(() => {
      let n = 0;
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) { if (k === 'sst_activity_log_v1') n++; return orig.call(this, k); };
      window.__ahistReadCounter = () => n;
    });
    await openAhistList(page);
    const readsAfterList = await page.evaluate(() => window.__ahistReadCounter());
    check('[Single-read-no-mutation] sst_activity_log_v1 read exactly once on flow entry', readsAfterList === 1, readsAfterList);

    // navigating list -> detail -> list must NOT re-read storage
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    await page.locator('#s-answer-history-detail .back').click();
    await page.waitForTimeout(150);
    const readsAfterRoundTrip = await page.evaluate(() => window.__ahistReadCounter());
    check('[Single-read-no-mutation] no re-read across list<->detail navigation', readsAfterRoundTrip === 1, readsAfterRoundTrip);

    const storageUnchanged = await page.evaluate((expected) => localStorage.getItem('sst_activity_log_v1') === JSON.stringify(expected), recs);
    check('[Single-read-no-mutation] localStorage content unchanged after rendering', storageUnchanged);
  });

  // ---- Grid / correspondence table / history mutual consistency ----------
  await runScenario(browser, 'Grid-corr-history-consistency', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [
      rpRecord(day(0), { selected: { id: 'c2', text: 'だまる' } }),
      rpRecord(day(1), { selected: { id: 'c1', text: 'こんにちは' } })
    ]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);

    const corrLabels = await page.locator('.ahist-corr-table tbody th').allTextContents();
    check('[Grid-corr-history] correspondence table has 選択肢A/選択肢B rows', corrLabels.join(',') === '選択肢A,選択肢B', corrLabels);

    const histTexts = await page.locator('.ahist-history-item').allTextContents();
    check('[Grid-corr-history] history shows both answers with matching labels', histTexts[0].includes('選択肢B') && histTexts[1].includes('選択肢A'), histTexts);

    // table semantics: caption, not aria-hidden as a whole
    check('[Grid-corr-history] grid <table> is not aria-hidden', (await page.locator('.ahist-grid').first().getAttribute('aria-hidden')) === null);
    check('[Grid-corr-history] mark glyph is aria-hidden (decorative)', (await page.locator('.ahist-mark-sel').first().getAttribute('aria-hidden')) === 'true');
    const srTexts = await page.locator('.ahist-grid tbody tr').first().locator('.ahist-cell-sr').allTextContents();
    check('[Grid-corr-history] every cell has a 選択/未選択 screen-reader text (no silent empty cells)', srTexts.every((t) => t === '選択' || t === '未選択') && srTexts.length === 2, srTexts);

    // grid row-header link -> focuses the matching individual history entry
    await page.locator('.ahist-grid tbody tr').first().locator('th a').click();
    await page.waitForTimeout(100);
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('[Grid-corr-history] row-header link focuses a .ahist-history-item', /^ahist-hist-/.test(focusedId || ''), focusedId);
    const isHistItem = await page.evaluate((id) => document.getElementById(id).classList.contains('ahist-history-item'), focusedId);
    check('[Grid-corr-history] focused element is indeed a history item', isHistItem);
  });

  // ---- Legend text contains no leaked internal section references --------
  await runScenario(browser, 'Legend-no-section-leak', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    const legendTxt = await page.locator('#ahist-detail-legend').textContent();
    check('[Legend-no-section-leak] legend text contains no "§" character', !legendTxt.includes('§'), legendTxt);
    const compTxt = await page.locator('#ahist-card .report-comment-area').first().textContent();
    check('[Legend-no-section-leak] snapshot-vs-material-condition sentence present, no "§"', compTxt.includes('保存された場面・質問・選択肢が一致する記録') && !compTxt.includes('§'), compTxt);
  });

  // ---- Narrow width: no horizontal overflow at 320px/390px ---------------
  for (const w of [320, 390]) {
    await runScenario(browser, `Narrow-width-${w}`, async (page) => {
      await pinDate(page, NOW_MS);
      await seedRaw(page, [rpRecord(day(0)), rpRecord(day(1))]);
      await openReport(page); await openTrend(page); await openAhistList(page);
      await page.locator('.ahist-group-btn').first().click();
      await page.waitForTimeout(150);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      check(`[Narrow-width-${w}] no horizontal page overflow`, scrollWidth <= innerWidth + 2, { scrollWidth, innerWidth });
    }, { viewport: { width: w, height: 844 } });
  }

  // ---- Fixed buttons do not overlap the new screens (callback to
  //      SST-MONTHLY-TREND-MOBILE-LAYOUT-FIX-1's bug class) -----------------
  await runScenario(browser, 'Fixed-buttons-no-overlap', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    const posList = await page.evaluate(() => getComputedStyle(document.getElementById('donomanaHomeBtn')).position);
    check('[Fixed-buttons-no-overlap] #donomanaHomeBtn becomes position:absolute on the list screen', posList === 'absolute', posList);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    const posDetail = await page.evaluate(() => getComputedStyle(document.getElementById('donomanaHomeBtn')).position);
    check('[Fixed-buttons-no-overlap] #donomanaHomeBtn becomes position:absolute on the detail screen', posDetail === 'absolute', posDetail);
    const padTop = await page.evaluate(() => getComputedStyle(document.getElementById('s-answer-history-detail')).paddingTop);
    check('[Fixed-buttons-no-overlap] detail screen reserves top padding for the fixed-button row', parseFloat(padTop) >= 100, padTop);
  });

  // ---- Print isolation ------------------------------------------------------
  await runScenario(browser, 'Print-isolation', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [rpRecord(day(0))]);
    await openReport(page); await openTrend(page); await openAhistList(page);
    await page.locator('.ahist-group-btn').first().click();
    await page.waitForTimeout(150);
    await page.emulateMedia({ media: 'print' });
    check('[Print-isolation] #ahist-card visible under print media', await page.locator('#ahist-card').isVisible());
    check('[Print-isolation] operation button (#ahist-print-btn) hidden under print media', !(await page.locator('#ahist-print-btn').isVisible()));
    check('[Print-isolation] .back button hidden under print media', !(await page.locator('#s-answer-history-detail .back').isVisible()));
    await page.emulateMedia({ media: 'screen' });
  });

  // ---- generate.js-block independence: focus helpers are reachable --------
  await runScenario(browser, 'Focus-helpers-reachable', async (page) => {
    check('[Focus-helpers-reachable] trendIsFocusable reachable (reused, no 3rd duplicate created)', (await page.evaluate(() => typeof trendIsFocusable)) === 'function');
    check('[Focus-helpers-reachable] trendFirstFocusable reachable (reused, no 3rd duplicate created)', (await page.evaluate(() => typeof trendFirstFocusable)) === 'function');
    check('[Focus-helpers-reachable] openAnswerHistoryList reachable', (await page.evaluate(() => typeof openAnswerHistoryList)) === 'function');
    check('[Focus-helpers-reachable] groupComparisonAnswerEvents reachable via donomanaSstRecordDetail', (await page.evaluate(() => typeof donomanaSstRecordDetail.groupComparisonAnswerEvents)) === 'function');
  });

  // ---- Non-regression: existing #s-trend unaffected -----------------------
  await runScenario(browser, 'NonRegression-existing-trend', async (page) => {
    await pinDate(page, NOW_MS);
    await seedRaw(page, [{ ts: day(0), type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }]);
    await openReport(page); await openTrend(page);
    check('[NonRegression-existing-trend] existing #trend-print-btn still present', await page.locator('#trend-print-btn').isVisible());
    check('[NonRegression-existing-trend] #trend-table-wrap still renders', (await page.locator('.trend-table').count()) === 1);
    await page.locator('#s-trend .back').click();
    await page.waitForTimeout(150);
    check('[NonRegression-existing-trend] #s-trend back button still returns to #s-report', await page.evaluate(() => document.getElementById('s-report').classList.contains('on')));
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
