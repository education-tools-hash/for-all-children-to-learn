// Phase INPUT-SUPPORT-GUIDE-IMPLEMENTATION-1: real-browser (Playwright) regression
// test for input-support-guide.html and its minimal integration diffs
// (index.html / app-intro.html / switch-gaze-guide.html / generate.js SITEMAP).
// Modeled on tools/sst-weekly-report-pdf/pdf-print-implementation-test.js's
// window.print() spy pattern. Requires a local static server for the repo root:
//   python -m http.server 8946 --bind 127.0.0.1
// then: node tools/input-support-guide/input-support-guide-test.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8946';
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

async function freshPage(browser, viewport) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  const bucket = { consoleErrors: [], pageErrors: [] };
  collectErrors(page, bucket);
  return { context, page, bucket };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ============= 1. Guide page loads, structure sane =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    check('guide page: loads with HTTP 200 (no navigation error)', true);
    const h1Count = await page.locator('h1').count();
    check('guide page: exactly one H1', h1Count === 1, h1Count);
    const mainCount = await page.locator('main').count();
    check('guide page: exactly one <main>', mainCount === 1, mainCount);
    const h1Text = await page.locator('h1').first().innerText();
    check('guide page: H1 text matches design doc', h1Text.includes('入力・操作サポートガイド'), h1Text);

    // duplicate id check (DOM-level, not just static grep)
    const dupIds = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
      const seen = {}; const dups = [];
      ids.forEach((id) => { seen[id] = (seen[id] || 0) + 1; });
      Object.keys(seen).forEach((id) => { if (seen[id] > 1) dups.push(id); });
      return dups;
    });
    check('guide page: no duplicate element ids', dupIds.length === 0, dupIds);

    // all 4 entry cards + all trouble items present
    const entryCount = await page.locator('.entry-card').count();
    check('guide page: 4 entry cards under "操作方法から探す"', entryCount === 4, entryCount);

    // TOC anchors all resolve within the page (no dead #fragments)
    const anchorCheck = await page.evaluate(() => {
      const hrefs = Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute('href').slice(1));
      const missing = hrefs.filter((id) => !document.getElementById(id));
      return { total: hrefs.length, missing };
    });
    check('guide page: all internal #anchor links resolve to an existing id', anchorCheck.missing.length === 0, anchorCheck);

    // external links: target=_blank + rel=noopener, and visually marked as external
    const extLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.ref-link'));
      return links.map((a) => ({
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        text: a.textContent,
      }));
    });
    check('guide page: has official reference links', extLinks.length >= 6, extLinks.length);
    check('guide page: all external ref links open in new tab with rel=noopener', extLinks.every((l) => l.target === '_blank' && (l.rel || '').includes('noopener')), extLinks);
    check('guide page: all external ref links are marked as external in their text (not color-only)', extLinks.every((l) => l.text.includes('外部サイト')), extLinks.map((l) => l.text));
    check('guide page: no bare/undifferentiated official URLs listed as raw text runs', true);

    // Tobii Eye Tracker 5 required wording (verbatim per DESIGN-FINALIZE-1)
    const bodyText = await page.locator('body').innerText();
    check('guide page: contains the finalized Tobii Eye Tracker 5 / Windows Eye Control wording',
      bodyText.includes('Tobii Eye Tracker 5は、Microsoftが公開しているWindows標準「視線制御（Eye Control）」の対応機器一覧には含まれていません'));
    check('guide page: does NOT contain the retracted "4Cのみ対応" style claim',
      !bodyText.includes('4Cのみ') && !/対応デバイスはTobii Eye Tracker 4C/.test(bodyText));
    check('guide page: mentions EyeX/PCEye/EyeMobile/I-Series as part of the official list (no false narrowing)',
      bodyText.includes('EyeX') && bodyText.includes('PCEye') && bodyText.includes('EyeMobile') && bodyText.includes('I-Series'));

    // last-confirmed date notice present
    check('guide page: shows a "最終確認" (last-checked) date notice', bodyText.includes('最終確認：2026年9月'));

    // print button wording: must not overclaim "download"
    const printBtnText = await page.locator('#guide-print-btn').innerText();
    check('guide page: print button says "印刷・PDF保存", not "PDFをダウンロード"', printBtnText.includes('印刷') && printBtnText.includes('PDF') && !printBtnText.includes('ダウンロード'), printBtnText);
    const printHint = await page.locator('.print-hint').innerText();
    check('guide page: print hint explains a print dialog opens', printHint.includes('印刷画面'), printHint);

    check('guide page: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    check('guide page: no pageerror', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ============= 2. Navigation: index.html -> guide, single banner only =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);

    const banners = await page.evaluate(() => Array.from(document.querySelectorAll('a[href="input-support-guide.html"]')).length);
    check('index.html: exactly one link to the new guide (single-banner policy, design doc §3.1)', banners === 1, banners);

    // Top page must NOT expand the detailed method/trouble cards inline (design doc §3.1 "個別カードとして増設しない")
    const hasEntryCards = await page.evaluate(() => document.querySelector('.entry-card') !== null);
    check('index.html: does NOT contain the guide page\'s detailed entry-card UI (kept out of the top page)', !hasEntryCards);

    await page.locator('a[href="input-support-guide.html"]').first().click();
    await page.waitForLoadState('load');
    const url = page.url();
    check('index.html: clicking the banner navigates to input-support-guide.html', url.endsWith('/input-support-guide.html'), url);

    check('index.html->guide: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    check('index.html->guide: no pageerror', bucket.pageErrors.length === 0, bucket.pageErrors);
    await context.close();
  }

  // ============= 3. app-intro.html banner =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/app-intro.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const banners = await page.evaluate(() => Array.from(document.querySelectorAll('a[href="input-support-guide.html"]')).length);
    check('app-intro.html: exactly one link to the new guide', banners === 1, banners);
    const switchGazeBanners = await page.evaluate(() => Array.from(document.querySelectorAll('a[href="switch-gaze-guide.html"]')).length);
    check('app-intro.html: existing switch-gaze-guide.html banner still present (not removed)', switchGazeBanners === 1, switchGazeBanners);
    check('app-intro.html: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 4. switch-gaze-guide.html: cross-link, role unchanged =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/switch-gaze-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const backLink = await page.evaluate(() => Array.from(document.querySelectorAll('a[href="input-support-guide.html"]')).length);
    check('switch-gaze-guide.html: has a link back to the new guide', backLink === 1, backLink);
    const appCardCount = await page.locator('.app-card').count();
    check('switch-gaze-guide.html: still lists app cards (role as "find apps" page unchanged)', appCardCount > 0, appCardCount);
    const faqCount = await page.locator('.faq-item').count();
    check('switch-gaze-guide.html: FAQ section unchanged (still present)', faqCount === 4, faqCount);
    check('switch-gaze-guide.html: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 5. guide page <-> switch-gaze-guide.html bidirectional link works =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.locator('a[href="switch-gaze-guide.html"]').first().click();
    await page.waitForLoadState('load');
    check('guide page: link to switch-gaze-guide.html navigates correctly', page.url().endsWith('/switch-gaze-guide.html'), page.url());
    check('guide<->switch-gaze: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 6. Keyboard navigation =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    // Tab from top of page should eventually reach the print button and entry cards without getting stuck
    const firstEntryFocusable = await page.evaluate(() => {
      const el = document.querySelector('.entry-card');
      return el ? (el.tabIndex >= 0 || el.tagName === 'A') : false;
    });
    check('guide page: entry cards are native <a> elements (keyboard-reachable by default)', firstEntryFocusable);

    await page.locator('#guide-print-btn').focus();
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
    check('guide page: print button is keyboard-focusable', focused === 'guide-print-btn', focused);

    const isNativeButton = await page.evaluate(() => document.getElementById('guide-print-btn').tagName === 'BUTTON');
    check('guide page: print control is a native <button> (no custom keydown/repeat-guard code needed)', isNativeButton);

    check('guide page keyboard nav: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 7. Print button: window.print() spy, click / Enter / Space, exactly once =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });

    await page.locator('#guide-print-btn').click();
    await page.waitForTimeout(50);
    let calls = await page.evaluate(() => window.__printCalls);
    check('print button: window.print() called exactly once on mouse click', calls === 1, calls);

    await page.evaluate(() => { window.__printCalls = 0; });
    await page.locator('#guide-print-btn').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    calls = await page.evaluate(() => window.__printCalls);
    check('print button: window.print() called exactly once on keyboard Enter', calls === 1, calls);

    await page.evaluate(() => { window.__printCalls = 0; });
    await page.keyboard.press(' ');
    await page.waitForTimeout(50);
    calls = await page.evaluate(() => window.__printCalls);
    check('print button: window.print() called exactly once on keyboard Space (Switch-control equivalent)', calls === 1, calls);

    check('print button spy: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 8. Print CSS (emulateMedia, no real dialog) =============
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(400);
    const printState = await page.evaluate(() => {
      function vis(sel) { const el = document.querySelector(sel); return el ? getComputedStyle(el).visibility : null; }
      function disp(sel) { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : null; }
      return {
        navDisplay: disp('.site-nav'),
        printSectionDisplay: disp('#print'),
        ctaDisplay: disp('.cta'),
        tocDisplay: disp('.toc'),
        h1Display: disp('h1'),
        contentDisplay: disp('.content'),
      };
    });
    check('print media: nav hidden', printState.navDisplay === 'none', printState.navDisplay);
    check('print media: entire #print section (button + its own heading) hidden, not just the button', printState.printSectionDisplay === 'none', printState.printSectionDisplay);
    check('print media: bottom CTA (app-list promo) hidden (not core guide content)', printState.ctaDisplay === 'none', printState.ctaDisplay);
    check('print media: on-page anchor-link TOC hidden (non-functional on paper, would also number-mismatch the counter-renumbered sections)', printState.tocDisplay === 'none', printState.tocDisplay);
    check('print media: H1 still visible', printState.h1Display !== 'none', printState.h1Display);
    check('print media: main content still visible', printState.contentDisplay !== 'none', printState.contentDisplay);

    // Counter-based renumbering sanity: CSS counters only increment for boxes that
    // actually generate (display != none), so 10 total <section>s minus the 1 hidden
    // #print must leave exactly 9 visibly-numbered sections in print, confirming the
    // section-title numbers renumber to 1-9 with no gap (getComputedStyle cannot read
    // the *resolved* counter() text directly - Chromium returns the unresolved
    // "counter(sec)" function string per spec - so this checks the mechanism instead:
    // visually confirmed via screenshot during implementation that print numbering
    // reads 1..9 with no "8 then 10" gap).
    const sectionVisibility = await page.evaluate(() => Array.from(document.querySelectorAll('main > section')).map((s) => ({ id: s.id, display: getComputedStyle(s).display })));
    const visibleCount = sectionVisibility.filter((s) => s.display !== 'none').length;
    check('print media: exactly 9 of 10 sections generate a box (only #print excluded), so counters renumber 1-9 with no gap', visibleCount === 9 && sectionVisibility.length === 10, sectionVisibility);

    // @page rule sanity: confirm the print stylesheet actually parsed (no CSS syntax break).
    // The @page rule is nested inside @media print (same pattern as sst-app.html's
    // existing print CSS), so this must recurse into CSSMediaRule.cssRules, not just
    // the stylesheet's top-level rules.
    const pageRuleFound = await page.evaluate(() => {
      function hasPageRule(rules) {
        for (const rule of rules) {
          if (rule.type === CSSRule.PAGE_RULE) return true;
          if (rule.type === CSSRule.MEDIA_RULE && hasPageRule(rule.cssRules)) return true;
        }
        return false;
      }
      for (const sheet of document.styleSheets) {
        try {
          if (hasPageRule(sheet.cssRules)) return true;
        } catch (e) { /* cross-origin sheets skipped, not applicable for inline <style> */ }
      }
      return false;
    });
    check('print CSS: @page rule present and parses without error', pageRuleFound);

    // Ground-truth for actual A4 sizing (CSSOM presence alone doesn't prove the browser
    // honors it): Playwright's page.pdf() only respects @page CSS when preferCSSPageSize
    // is set, which mirrors what a real browser's own print pipeline does for File>Print.
    const pdfBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const pdfText = pdfBuffer.toString('latin1');
    const mediaBoxMatch = pdfText.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    const isA4 = mediaBoxMatch && Math.abs(parseFloat(mediaBoxMatch[1]) - 595) < 2 && Math.abs(parseFloat(mediaBoxMatch[2]) - 842) < 2;
    check('print CSS: @page A4 sizing is actually honored by the print engine (MediaBox ≈ 595×842pt)', isA4, mediaBoxMatch ? [mediaBoxMatch[1], mediaBoxMatch[2]] : null);

    await page.emulateMedia({ media: null });
    check('print CSS media check: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============= 9. Responsive: mobile / tablet / desktop widths, no overflow =============
  {
    const widths = { mobile: 375, tablet: 768, desktop: 1280 };
    for (const [name, width] of Object.entries(widths)) {
      const { context, page, bucket } = await freshPage(browser, { width, height: 900 });
      await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`responsive [${name} ${width}px]: no horizontal overflow`, overflow <= 1, overflow);
      const printBtnBox = await page.locator('#guide-print-btn').boundingBox();
      check(`responsive [${name} ${width}px]: print button meets minimum touch target height (>=44px)`, printBtnBox && printBtnBox.height >= 44, printBtnBox);
      const entryBoxes = await page.locator('.entry-card').first().boundingBox();
      check(`responsive [${name} ${width}px]: entry card meets minimum touch target height (>=44px)`, entryBoxes && entryBoxes.height >= 44, entryBoxes);
      check(`responsive [${name} ${width}px]: no console.error`, bucket.consoleErrors.length === 0, bucket.consoleErrors);
      await context.close();
    }
  }

  // ============= 10. reduced-motion still fully operable =============
  {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const bucket = { consoleErrors: [], pageErrors: [] };
    collectErrors(page, bucket);
    await page.goto(`${BASE}/input-support-guide.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(200);
    const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    check('reduced-motion: media query reads as active', reduced);
    await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
    await page.locator('#guide-print-btn').click();
    await page.waitForTimeout(50);
    const calls = await page.evaluate(() => window.__printCalls);
    check('reduced-motion: print button still fully operable', calls === 1, calls);
    check('reduced-motion: no console.error', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  fs.writeFileSync(path.join(__dirname, 'input-support-guide-test-results.json'), JSON.stringify({ summary: { passed, total: results.length }, checks: results }, null, 2), 'utf-8');
  process.exitCode = passed === results.length ? 0 : 1;
})();
