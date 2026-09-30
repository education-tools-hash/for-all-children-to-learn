// Phase APP-RECOMMENDER-INPUT-CATEGORY-HARDENING-1: real-browser (Playwright)
// regression test for the apps-data.json-driven wizard.html recommender and
// its consistency with apps-data.json / switch-gaze-guide.html.
// Updated by Phase APP-RECOMMENDER-TOUCH-SEMANTICS-IMPLEMENTATION-1: Q1 no
// longer offers 'touch' as a filter value (Design Option B -- touch is now
// the standardized default, not a Q1 hard-filter choice). Per Design
// conformance (docs/design-system/donomana-app-recommender-touch-semantics-
// design-v1_0.md §6 Option B's own example), 'keyboard' was NOT added to Q1
// either -- only switch/gaze/any remain as Q1 values.
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
    await answerAll(page, 'switch', '学習アプリ', 'none');
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
    await answerAll(page, 'gaze', '学習アプリ', 'none');
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

  // ============= 4. Q1 structural conformance: touch removed, keyboard NOT added =============
  // Design Option B (docs/design-system/donomana-app-recommender-touch-
  // semantics-design-v1_0.md): touch is standardized, so it must not appear
  // as a selectable Q1 filter value. keyboard is intentionally NOT added to
  // Q1 either -- Option B's own concrete example (§6) lists only switch/gaze/
  // any, with "(+keyboard)" mentioned only under the non-selected Option A.
  // keyboard's metadata truth (24/36) itself is untouched by this Phase and
  // is verified separately in the metadata-consistency block (§17 below).
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const q1radios = await page.locator('#q1 [role="radio"]').count();
    check('Q1 has exactly 3 role=radio options (switch/gaze/any)', q1radios === 3, q1radios);

    const q1Onclicks = await page.$$eval('#q1 [role="radio"]', (els) => els.map((e) => e.getAttribute('onclick')));
    check('Q1: touch option does not exist', !q1Onclicks.some((s) => /answer\(this,\s*1,\s*'touch'\)/.test(s)), q1Onclicks);
    check('Q1: keyboard option does not exist (Design conformance -- Option B example omits it)', !q1Onclicks.some((s) => /answer\(this,\s*1,\s*'keyboard'\)/.test(s)), q1Onclicks);
    check('Q1: switch option exists', q1Onclicks.some((s) => /answer\(this,\s*1,\s*'switch'\)/.test(s)));
    check('Q1: gaze option exists', q1Onclicks.some((s) => /answer\(this,\s*1,\s*'gaze'\)/.test(s)));
    check('Q1: any option exists', q1Onclicks.some((s) => /answer\(this,\s*1,\s*'any'\)/.test(s)));

    const q1Text = await page.locator('#q1 .question-text').innerText();
    check('Q1 question text no longer asks "which input method" as a plain choice (reframed around additional methods)', !q1Text.includes('どうやって'), q1Text);

    check('Q1 structural block: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 4b. Q1 invalid-value handling: unrecognized value yields 0 matches, no crash =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const total = await page.evaluate(() => {
      var apps = window.ALL_APPS;
      var result = filterAndRank(apps, { q1: 'bogus-legacy-value', q2: null, q3: null });
      return result.total;
    });
    check('Q1: an unrecognized/legacy value (e.g. stale "touch") filters to 0 matches, not a crash', total === 0, total);
    check('4b: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 5. Q1 = any: no input-based exclusion =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '学習アプリ', 'none');
    const names = await resultAppNames(page);
    check('Q1=any: all 36 apps included regardless of input array', names.length === 36, names.length);
    check('Q1=any: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 6. Q2 filter: category groups "recommended" first =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '創作表現', 'none');
    const groupTitle = await page.locator('.result-group-title').innerText().catch(() => null);
    check('Q2=創作表現: "おすすめ" group heading present', groupTitle === '✨ おすすめ', groupTitle);
    const recCategories = await page.locator('.result-group-title + .app-card .tag').first().innerText().catch(() => null);
    check('Q2=創作表現: first recommended card is tagged 創作表現', recCategories === '創作表現', recCategories);
    check('Q2 filter: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 7. Q3 re-ranks results (same membership, different order) =============
  // Phase APP-RECOMMENDER-INPUT-CATEGORY-FINALIZE-2: Q3's options map directly
  // to apps-data.json's need values (no inferred "usage scene" semantics), and
  // software.required is never used in ranking (per §12/§13 of the Phase spec).
  {
    const q3vals = ['literacy', 'time', 'communicate', 'life_social', 'none'];
    const names = {};
    for (const q3 of q3vals) {
      const { context, page } = await freshPage(browser);
      await answerAll(page, 'any', '学習アプリ', q3);
      names[q3] = await resultAppNames(page);
      await context.close();
    }

    const counts = q3vals.map((q3) => names[q3].length);
    check('Q3 does not change result count (any+学習アプリ, all 5 Q3 answers)', counts.every((c) => c === counts[0]), counts);

    const sortedSets = q3vals.map((q3) => [...names[q3]].sort().join('|'));
    check('Q3 does not change result membership (same apps, only order changes)', sortedSets.every((s) => s === sortedSets[0]));

    check('Q3=literacy: literacy-need app ranked before a non-literacy app', names.literacy.indexOf('ひらがな まなぼう！') < names.literacy.indexOf('とけい'), { hiragana: names.literacy.indexOf('ひらがな まなぼう！'), tokei: names.literacy.indexOf('とけい') });
    check('Q3=time: time-need app ranked before a literacy-only app', names.time.indexOf('とけい') < names.time.indexOf('ひらがな まなぼう！'), { tokei: names.time.indexOf('とけい'), hiragana: names.time.indexOf('ひらがな まなぼう！') });
    check('Q3=communicate: communicate-need app ranked before a literacy-only app', names.communicate.indexOf('よみかき サポートエディタ') < names.communicate.indexOf('ひらがな まなぼう！'), { yomikaki: names.communicate.indexOf('よみかき サポートエディタ'), hiragana: names.communicate.indexOf('ひらがな まなぼう！') });
    check('Q3=life_social: life-need app ranked before a literacy-only app', names.life_social.indexOf('おかねのおべんきょう') < names.life_social.indexOf('ひらがな まなぼう！'), { okane: names.life_social.indexOf('おかねのおべんきょう'), hiragana: names.life_social.indexOf('ひらがな まなぼう！') });

    check('literacy vs time order actually differs (Q3 has a visible effect)', names.literacy.join('|') !== names.time.join('|'));
    check('literacy vs communicate order actually differs (Q3 has a visible effect)', names.literacy.join('|') !== names.communicate.join('|'));
    check('literacy vs life_social order actually differs (Q3 has a visible effect)', names.literacy.join('|') !== names.life_social.join('|'));

    // Q3=none should apply no scoring at all: the recommended (学習アプリ) group's
    // order should exactly match apps-data.json's own array order for that
    // category, followed by the "others" group in apps-data.json's own order.
    const expectedBaseline = APPS.filter((a) => a.category === '学習アプリ').map((a) => a.title)
      .concat(APPS.filter((a) => a.category !== '学習アプリ').map((a) => a.title));
    check('Q3=none: order matches apps-data.json\'s own order exactly (no reordering applied)', names.none.join('|') === expectedBaseline.join('|'), { none: names.none, expectedBaseline });

    const tagTextsNone = await (async () => {
      const { context, page } = await freshPage(browser);
      await answerAll(page, 'any', '学習アプリ', 'none');
      const t = await page.locator('.result-tag').allInnerTexts();
      await context.close();
      return t;
    })();
    check('Q3=none answer is shown as a result tag ("こだわらない")', tagTextsNone.some((t) => t.includes('こだわらない')), tagTextsNone);
  }

  // ============= 7b. Q3=life_social matches BOTH life and social need values =============
  // sst-app has need=['social'] only (no 'life'); this confirms the combined
  // option actually matches either value, not just one of the two.
  {
    const { context: c1, page: pageNone } = await freshPage(browser);
    await answerAll(pageNone, 'any', '自立活動', 'none');
    const namesNone = await resultAppNames(pageNone);
    await c1.close();

    const { context: c2, page: pageLS, bucket } = await freshPage(browser);
    await answerAll(pageLS, 'any', '自立活動', 'life_social');
    const namesLS = await resultAppNames(pageLS);
    await c2.close();

    check('Q3=life_social: social-need app (SST) moves earlier than its Q1/Q2-only baseline position', namesLS.indexOf('SST ソーシャルスキルトレーニング') < namesNone.indexOf('SST ソーシャルスキルトレーニング'), { baseline: namesNone.indexOf('SST ソーシャルスキルトレーニング'), life_social: namesLS.indexOf('SST ソーシャルスキルトレーニング') });
    check('7b: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
  }

  // ============= 7c. software.required is never used in Q3 ranking (§12/§13) =============
  // cup_game (software.required=true, need=[]) must NOT be pushed to the back
  // under any Q3 answer -- it should stay exactly where apps-data.json's own
  // order (and the neutral need=[] score of 0) places it, same as any other
  // unmatched app.
  {
    const { context: c1, page: pageNone } = await freshPage(browser);
    await answerAll(pageNone, 'any', '認知支援', 'none');
    const namesNone = await resultAppNames(pageNone);
    await c1.close();

    const { context: c2, page: pageCom } = await freshPage(browser);
    await answerAll(pageCom, 'any', '認知支援', 'communicate');
    const namesCom = await resultAppNames(pageCom);
    await c2.close();

    check('cup_game (software.required, need=[]) position is unaffected by Q3 (no ranking penalty)', namesNone.indexOf('どこかな？カップゲーム') === namesCom.indexOf('どこかな？カップゲーム'), { none: namesNone.indexOf('どこかな？カップゲーム'), communicate: namesCom.indexOf('どこかな？カップゲーム') });
  }

  // ============= 7d. need=[] apps are not excluded by any Q3 answer =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '認知支援', 'literacy');
    const names = await resultAppNames(page);
    const NEED_EMPTY_IN_COGNITIVE = ['ひかるボタン（注視訓練）', 'けずりえ', 'もぐらたたき', 'どこかな？カップゲーム'];
    check('need=[] apps remain present regardless of Q3 answer (no exclusion)', NEED_EMPTY_IN_COGNITIVE.every((n) => names.includes(n)), { missing: NEED_EMPTY_IN_COGNITIVE.filter((n) => !names.includes(n)) });
    check('7d: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 7e. Q3 accessibility: 5 options, radio semantics =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.click(`button[onclick*="answer(this, 1, 'any')"]`);
    await page.waitForTimeout(100);
    await page.click(`button[onclick*="answer(this, 2, '学習アプリ')"]`);
    await page.waitForTimeout(100);
    const q3radios = await page.locator('#q3 [role="radio"]').count();
    check('Q3 has exactly 5 role=radio options', q3radios === 5, q3radios);
    await page.click(`button[onclick*="answer(this, 3, 'life_social')"]`);
    await page.waitForTimeout(100);
    const checkedCount = await page.locator('#q3 [role="radio"][aria-checked="true"]').count();
    check('Q3: exactly one option is aria-checked=true after selection', checkedCount === 1, checkedCount);
    check('7e: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 7f. Q3 responsive: 5 options fit without horizontal overflow =============
  {
    const widths = { mobile: 375, tablet: 768, desktop: 1280 };
    for (const [name, width] of Object.entries(widths)) {
      const { context, page } = await freshPage(browser, { viewport: { width, height: 900 } });
      await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(200);
      await page.click(`button[onclick*="answer(this, 1, 'any')"]`);
      await page.waitForTimeout(100);
      await page.click(`button[onclick*="answer(this, 2, '学習アプリ')"]`);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`Q3 responsive [${name} ${width}px]: no horizontal overflow with 5 options`, overflow <= 1, overflow);
      const btnBox = await page.locator('#q3 .option-btn').first().boundingBox();
      check(`Q3 responsive [${name} ${width}px]: option-btn meets 44px min height`, btnBox && btnBox.height >= 44, btnBox);
      await context.close();
    }
  }

  // ============= 8. 0-result empty state (mocked data) =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.route('**/apps-data.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'x', filename: 'x', title: 'X', category: '学習アプリ', input: ['touch'], icon: '📱', tags_display: 't' }]),
    }));
    await answerAll(page, 'gaze', '学習アプリ', 'none');
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
    await answerAll(page, 'any', '学習アプリ', 'none');
    const errorState = await page.locator('.error-state').count();
    check('fetch failure: error-state shown, not a broken/empty result list', errorState > 0);
    check('fetch failure: no pageerror thrown (caught gracefully)', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ============= 10. Input badges on result cards =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'gaze', '自立活動', 'none');
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
    check('a11y: Q1 has 3 role=radio options (post Option B: switch/gaze/any, touch removed)', radios === 3, radios);

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
    await answerAll(page, 'switch', '学習アプリ', 'none');
    await page.click('.retry-btn');
    await page.waitForTimeout(200);
    const q1Active = await page.locator('#q1.active').count();
    const anyChecked = await page.locator('[role="radio"][aria-checked="true"]').count();
    check('restart: returns to Q1', q1Active === 1, q1Active);
    check('restart: all radio selections cleared', anyChecked === 0, anyChecked);
    check('restart block: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 12b. "戻る" (back) navigation from Q2 to Q1 works with the new 3-option Q1 =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.click("button[onclick*=\"answer(this, 1, 'gaze')\"]");
    await page.waitForTimeout(100);
    const q2ActiveBefore = await page.locator('#q2.active').count();
    await page.click('#q2 .back-btn');
    await page.waitForTimeout(150);
    const q1ActiveAfter = await page.locator('#q1.active').count();
    const q1CheckedAfterBack = await page.locator('#q1 [role="radio"][aria-checked="true"]').count();
    check('goBack: Q2 was active before pressing back', q2ActiveBefore === 1, q2ActiveBefore);
    check('goBack: returns to Q1', q1ActiveAfter === 1, q1ActiveAfter);
    check('goBack: previous Q1 selection (gaze) remains visibly checked (can be changed, not lost)', q1CheckedAfterBack === 1, q1CheckedAfterBack);
    // re-select a different Q1 option to confirm the flow still advances correctly
    await page.click("button[onclick*=\"answer(this, 1, 'switch')\"]");
    await page.waitForTimeout(100);
    const q2ActiveAgain = await page.locator('#q2.active').count();
    check('goBack then re-answer: advances to Q2 again', q2ActiveAgain === 1, q2ActiveAgain);
    check('12b: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 13. Responsive: mobile / tablet / desktop =============
  {
    const widths = { mobile: 375, tablet: 768, desktop: 1280 };
    for (const [name, width] of Object.entries(widths)) {
      const { context, page, bucket } = await freshPage(browser, { viewport: { width, height: 900 } });
      await answerAll(page, 'switch', '自立活動', 'none');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`responsive [${name} ${width}px]: no horizontal overflow`, overflow <= 1, overflow);
      const btnBox = await page.locator('.open-btn').first().boundingBox();
      check(`responsive [${name} ${width}px]: open-btn meets 44px min height`, btnBox && btnBox.height >= 44, btnBox);
      check(`responsive [${name} ${width}px]: no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
      await context.close();
    }
  }

  // ============= 13b. Q1-specific mobile-width verification (new 3-option layout + question-sub) =============
  {
    const widths = { mobile: 375, tablet: 768, desktop: 1280 };
    for (const [name, width] of Object.entries(widths)) {
      const { context, page, bucket } = await freshPage(browser, { viewport: { width, height: 900 } });
      await page.goto(`${BASE}/wizard.html`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`Q1 [${name} ${width}px]: no horizontal overflow with question-sub + 3 options`, overflow <= 1, overflow);
      const boxes = await page.locator('#q1 .option-btn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
      check(`Q1 [${name} ${width}px]: all 3 option-btns meet 44px min tap-target height`, boxes.every((b) => b.height >= 44), boxes);
      check(`Q1 [${name} ${width}px]: all 3 option-btns fit within viewport width (no clipping)`, boxes.every((b) => b.width <= width), boxes);
      const subVisible = await page.locator('#q1 .question-sub').isVisible();
      check(`Q1 [${name} ${width}px]: question-sub explanatory line is visible (not clipped/hidden)`, subVisible);
      await context.close();
    }
  }

  // ============= 14. Broken link check: wizard result app links resolve to real files =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await answerAll(page, 'any', '学習アプリ', 'none');
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

  // ============= 16b. Switch coverage: switch-gaze-guide.html switch section == apps-data.json switch set =============
  // Phase APP-RECOMMENDER-INPUT-CATEGORY-FINALIZE-1 Goal B: wizard.html and
  // switch-gaze-guide.html should show the same set of apps for a given input method.
  {
    const html = fs.readFileSync(path.join(ROOT, 'switch-gaze-guide.html'), 'utf-8');
    const switchSection = html.match(/<section id="switch-apps">([\s\S]*?)<\/section>/)[1];
    const switchCardCount = (switchSection.match(/class="app-card"/g) || []).length;
    const expectedSwitchCount = appsWithInput('switch').length;
    check('switch-gaze-guide.html switch section: full parity with apps-data.json input=switch count', switchCardCount === expectedSwitchCount, { shown: switchCardCount, expected: expectedSwitchCount });

    const switchHrefs = [...switchSection.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const dupHrefs = switchHrefs.filter((h, i) => switchHrefs.indexOf(h) !== i);
    check('switch-gaze-guide.html switch section: no duplicate app-card hrefs', dupHrefs.length === 0, dupHrefs);
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

    // Phase APP-RECOMMENDER-TOUCH-SEMANTICS-IMPLEMENTATION-1 touches only
    // wizard.html/tests; apps-data.json itself must remain byte-identical to
    // the Touch Correction checkpoint (e46035c). Re-verify the truth-corrected
    // counts this Phase depends on, independent of any Q1 UI change above.
    check('metadata: touch count is 36/36 (unchanged from Touch Correction checkpoint)', appsWithInput('touch').length === 36, appsWithInput('touch').length);
    check('metadata: switch count is 28/36 (unchanged)', appsWithInput('switch').length === 28, appsWithInput('switch').length);
    check('metadata: gaze count is 16/36 (unchanged)', appsWithInput('gaze').length === 16, appsWithInput('gaze').length);
    check('metadata: keyboard count is 24/36 (unchanged; preserved for app-detail/Input Support Guide/future use even though not a Q1 filter)', appsWithInput('keyboard').length === 24, appsWithInput('keyboard').length);
    check('metadata: gamepad count is 2/36 (unchanged)', appsWithInput('gamepad').length === 2, appsWithInput('gamepad').length);
    check('metadata: total app count is 36', APPS.length === 36, APPS.length);
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
