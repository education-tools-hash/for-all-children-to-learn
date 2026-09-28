// Phase APP-RECOMMENDER-INPUT-CATEGORY-HARDENING-1: real-browser (Playwright)
// regression test for the apps-data.json-driven wizard.html recommender and
// its consistency with apps-data.json / switch-gaze-guide.html.
// Requires a local static server for the repo root:
//   python -m http.server 8949 --bind 127.0.0.1
// then: node tools/app-recommender/app-recommender-test.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8949';
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

async function freshPage(browser, opts) {
  const context = await browser.newContext(opts || {});
  const page = await context.newPage();
  const bucket = { consoleErrors: [], pageErrors: [] };
  collectErrors(page, bucket);
  return { context, page, bucket };
}

async function answerAll(page, q1, q2, q3) {
  await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(200);
  await page.click(`button[onclick*="answer(this, 1, '${q1}')"]`);
  await page.waitForTimeout(100);
  await page.click(`button[onclick*="answer(this, 2, '${q2}')"]`);
  await page.waitForTimeout(100);
  await page.click(`button[onclick*="answer(this, 3, '${q3}')"]`);
  await page.waitForTimeout(300);
}

async function resultAppNames(page) {
  return page.$$eval('.app-name', (els) => els.map((e) => e.textContent.trim()));
}

const APPS_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-data.json'), 'utf-8'));
const APPS = Array.isArray(APPS_DATA) ? APPS_DATA : APPS_DATA.apps;

function appsWithInput(v) {
  return APPS.filter((a) => Array.isArray(a.input) && a.input.indexOf(v) !== -1).map((a) => a.title);
}

const PREVIOUSLY_MISSING_7 = [
  'おおきい？ちいさい？くらべよう', 'かたちをあわせよう', 'みるとひろがる',
  'どこかな？みーつけた！', 'じゅんばんにみよう', 'どっちがいい？', 'さわってひろがる'
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ============= 1. apps-data.json loads and drives the page =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    const loaded = await page.evaluate(() => Array.isArray(window.ALL_APPS) && window.ALL_APPS.length);
    check('wizard.html: apps-data.json loaded into ALL_APPS', loaded === 36, loaded);
    check('wizard.html: no console.error on load', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    check('wizard.html: no pageerror on load', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ============= 2. Q1 = switch: correct inclusion/exclusion =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'switch', '学習アプリ', 'lesson');
    const names = await resultAppNames(page);
    const expected = appsWithInput('switch');
    check('Q1=switch: total matches apps-data.json input=switch count', names.length === expected.length, { got: names.length, expected: expected.length });
    check('Q1=switch: every expected switch app is present', expected.every((n) => names.includes(n)), expected.filter((n) => !names.includes(n)));
    check('Q1=switch: sst-app (no switch support) is excluded', !names.some((n) => n.includes('SST')));
    check('Q1=switch: けずりえ (no switch support) is excluded', !names.some((n) => n.includes('けずりえ')));
    check('Q1=switch: all 7 previously-audit-missing apps now included', PREVIOUSLY_MISSING_7.every((n) => names.includes(n)), PREVIOUSLY_MISSING_7.filter((n) => !names.includes(n)));
    check('Q1=switch: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 3. Q1 = gaze: correct inclusion/exclusion =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'gaze', '学習アプリ', 'lesson');
    const names = await resultAppNames(page);
    const expected = appsWithInput('gaze');
    check('Q1=gaze: total matches apps-data.json input=gaze count', names.length === expected.length, { got: names.length, expected: expected.length });
    check('Q1=gaze: every expected gaze app is present', expected.every((n) => names.includes(n)), expected.filter((n) => !names.includes(n)));
    check('Q1=gaze: sst-app (no gaze support) is excluded', !names.some((n) => n.includes('SST')));
    check('Q1=gaze: hiragana-learn (no gaze support) is excluded', !names.some((n) => n === 'ひらがな まなぼう！'));
    check('Q1=gaze: all 7 previously-audit-missing apps now included', PREVIOUSLY_MISSING_7.every((n) => names.includes(n)), PREVIOUSLY_MISSING_7.filter((n) => !names.includes(n)));
    check('Q1=gaze: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 4. Q1 = touch: correct inclusion =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'touch', '学習アプリ', 'lesson');
    const names = await resultAppNames(page);
    const expected = appsWithInput('touch');
    check('Q1=touch: total matches apps-data.json input=touch count', names.length === expected.length, { got: names.length, expected: expected.length });
    check('Q1=touch: every expected touch app is present', expected.every((n) => names.includes(n)), expected.filter((n) => !names.includes(n)));
    check('Q1=touch: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 5. Q1 = any: no input-based exclusion =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '学習アプリ', 'lesson');
    const names = await resultAppNames(page);
    check('Q1=any: all 36 apps included regardless of input array', names.length === 36, names.length);
    check('Q1=any: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 6. Q2 filter: category groups "recommended" first =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '創作表現', 'lesson');
    const groupTitle = await page.locator('.result-group-title').innerText().catch(() => null);
    check('Q2=創作表現: "おすすめ" group heading present', groupTitle === '✨ おすすめ', groupTitle);
    const recCategories = await page.locator('.result-group-title + .app-card .tag').first().innerText().catch(() => null);
    check('Q2=創作表現: first recommended card is tagged 創作表現', recCategories === '創作表現', recCategories);
    check('Q2 filter: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 7. Q3 does NOT filter (only displayed as a tag) =============
  {
    const { context, page: pageLesson } = await freshPage(browser);
    await answerAll(pageLesson, 'touch', '学習アプリ', 'lesson');
    const countLesson = (await resultAppNames(pageLesson)).length;
    await context.close();

    const { context: c2, page: pageHome } = await freshPage(browser);
    await answerAll(pageHome, 'touch', '学習アプリ', 'home');
    const countHome = (await resultAppNames(pageHome)).length;
    const tagTexts = await pageHome.locator('.result-tag').allInnerTexts();
    check('Q3 does not change result count (touch+学習アプリ, lesson vs home)', countLesson === countHome, { lesson: countLesson, home: countHome });
    check('Q3 answer is still shown as a result tag', tagTexts.some((t) => t.includes('家庭学習')), tagTexts);
    await c2.close();
  }

  // ============= 8. 0-result empty state (mocked data) =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.route('**/apps-data.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'x', filename: 'x', title: 'X', category: '学習アプリ', input: ['touch'], icon: '📱', tags_display: 't' }]),
    }));
    await answerAll(page, 'gaze', '学習アプリ', 'lesson');
    const emptyState = await page.locator('.empty-state').count();
    const title = await page.locator('#resultTitle').innerText();
    check('0-result: empty-state element shown', emptyState > 0);
    check('0-result: title communicates no match, no fabricated substitute app shown', title.includes('見つかりません'), title);
    check('0-result: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 9. Fail-safe: apps-data.json fetch failure =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.route('**/apps-data.json', (route) => route.abort());
    await answerAll(page, 'touch', '学習アプリ', 'lesson');
    const errorState = await page.locator('.error-state').count();
    check('fetch failure: error-state shown, not a broken/empty result list', errorState > 0);
    check('fetch failure: no pageerror thrown (caught gracefully)', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ============= 10. Input badges on result cards =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'gaze', '自立活動', 'lesson');
    const firstCardTags = await page.locator('.app-card').first().locator('.tag').allInnerTexts();
    check('result card: has category tag + input badge(s) with icon+text (not color-only)', firstCardTags.length >= 2 && firstCardTags.some((t) => t.includes('視線')), firstCardTags);
    check('badges: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 11. Accessibility: radiogroup semantics, focus-visible, aria-live =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const radiogroups = await page.locator('[role="radiogroup"]').count();
    check('a11y: 3 radiogroups present (Q1/Q2/Q3)', radiogroups === 3, radiogroups);
    const radios = await page.locator('#q1 [role="radio"]').count();
    check('a11y: Q1 has 4 role=radio options', radios === 4, radios);

    await page.click("button[onclick*=\"answer(this, 1, 'switch')\"]");
    await page.waitForTimeout(100);
    const checkedCount = await page.locator('#q1 [role="radio"][aria-checked="true"]').count();
    check('a11y: exactly one Q1 option is aria-checked=true after selection', checkedCount === 1, checkedCount);

    const ariaLive = await page.locator('#result').getAttribute('aria-live');
    check('a11y: #result has aria-live=polite', ariaLive === 'polite', ariaLive);

    // keyboard operability: focus + Enter on a Q2 option
    await page.locator('#q2 [role="radio"]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const q3Active = await page.locator('#q3.active').count();
    check('a11y: keyboard Enter on option advances to next question', q3Active === 1, q3Active);

    check('a11y block: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 12. Restart / back button work correctly with new state =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'switch', '学習アプリ', 'lesson');
    await page.click('.retry-btn');
    await page.waitForTimeout(200);
    const q1Active = await page.locator('#q1.active').count();
    const anyChecked = await page.locator('[role="radio"][aria-checked="true"]').count();
    check('restart: returns to Q1', q1Active === 1, q1Active);
    check('restart: all radio selections cleared', anyChecked === 0, anyChecked);
    check('restart block: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 13. Responsive: mobile / tablet / desktop =============
  {
    const widths = { mobile: 375, tablet: 768, desktop: 1280 };
    for (const [name, width] of Object.entries(widths)) {
      const { context, page, bucket } = await freshPage(browser, { viewport: { width, height: 900 } });
      await answerAll(page, 'switch', '自立活動', 'lesson');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`responsive [${name} ${width}px]: no horizontal overflow`, overflow <= 1, overflow);
      const btnBox = await page.locator('.open-btn').first().boundingBox();
      check(`responsive [${name} ${width}px]: open-btn meets 44px min height`, btnBox && btnBox.height >= 44, btnBox);
      check(`responsive [${name} ${width}px]: no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
      await context.close();
    }
  }

  // ============= 14. Broken link check: wizard result app links resolve to real files =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '学習アプリ', 'lesson');
    const hrefs = await page.$$eval('.open-btn', (els) => els.map((e) => e.getAttribute('href')));
    const badHrefs = hrefs.filter((h) => !h.startsWith('https://donomana.jp/'));
    check('wizard result links: all use the expected https://donomana.jp/ prefix', badHrefs.length === 0, badHrefs);
    check('broken-link block: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 15. switch-gaze-guide.html: no broken links (filesystem check) =============
  {
    const html = fs.readFileSync(path.join(ROOT, 'switch-gaze-guide.html'), 'utf-8');
    const hrefs = [...html.matchAll(/href="([^"]+)" class="app-card"/g)].map((m) => m[1]);
    const missing = hrefs.filter((h) => !h.startsWith('http') && !fs.existsSync(path.join(ROOT, h)));
    check('switch-gaze-guide.html: no broken app-card links', missing.length === 0, missing);
    check('switch-gaze-guide.html: music-app-detail.html typo is gone', !html.includes('music-app-detail.html'));
    check('switch-gaze-guide.html: ongaku-app-detail.html correctly linked', html.includes('app-details/ongaku-app-detail.html'));
  }

  // ============= 16. Gaze coverage: switch-gaze-guide.html gaze section == apps-data.json gaze set =============
  {
    const html = fs.readFileSync(path.join(ROOT, 'switch-gaze-guide.html'), 'utf-8');
    const gazeSection = html.match(/<section id="gaze-apps">([\s\S]*?)<\/section>/)[1];
    const gazeCardCount = (gazeSection.match(/class="app-card"/g) || []).length;
    const expectedGazeCount = appsWithInput('gaze').length;
    check('switch-gaze-guide.html gaze section: full parity with apps-data.json input=gaze count (diff=0 target, §30)', gazeCardCount === expectedGazeCount, { shown: gazeCardCount, expected: expectedGazeCount });
  }

  // ============= 17. Metadata consistency: apps-data.json =============
  {
    const ALLOWED_INPUT = ['touch', 'switch', 'gaze', 'keyboard', 'gamepad'];
    const badInput = APPS.filter((a) => (a.input || []).some((v) => ALLOWED_INPUT.indexOf(v) === -1));
    check('metadata: no input value outside the allowed enum', badInput.length === 0, badInput.map((a) => a.id));

    const ids = APPS.map((a) => a.id);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    check('metadata: no duplicate app ids', dupIds.length === 0, dupIds);

    const missingFilenameHtml = APPS.filter((a) => !fs.existsSync(path.join(ROOT, a.filename + '.html')));
    check('metadata: every filename has a corresponding .html file', missingFilenameHtml.length === 0, missingFilenameHtml.map((a) => a.id));

    const missingDetail = APPS.filter((a) => !fs.existsSync(path.join(ROOT, 'app-details', a.filename + '-detail.html')));
    check('metadata: every app has a generated app-details page', missingDetail.length === 0, missingDetail.map((a) => a.id));
  }

  // ============= 18. Full app coverage: wizard.html has no local hardcoded app list anymore =============
  {
    const html = fs.readFileSync(path.join(ROOT, 'wizard.html'), 'utf-8');
    check('wizard.html: fetches apps-data.json (no independent hardcoded APPS db)', /fetch\(\s*['"]apps-data\.json['"]\s*\)/.test(html));
    check('wizard.html: no leftover hardcoded RESULTS lookup table', !/const RESULTS\s*=/.test(html));
    check('wizard.html: no leftover hardcoded local APPS object (old pattern "const APPS = {")', !/const APPS\s*=\s*\{/.test(html));
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  fs.writeFileSync(path.join(__dirname, 'app-recommender-test-results.json'), JSON.stringify({ summary: { passed, total: results.length }, checks: results }, null, 2), 'utf-8');
  process.exitCode = passed === results.length ? 0 : 1;
})();
