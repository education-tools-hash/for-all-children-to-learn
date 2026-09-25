// Phase SAWATTE-HIROGARU-RECORD-TRACE-VIEWER-BACKGROUND-ISOLATION-FIX-1:
// verification. Read-only test harness (writes only a JSON report here).
// Drives the real, user-reachable path only (A11y panel -> Teacher
// Settings proxy -> "きろくをみる" -> a real record's trace thumbnail ->
// Trace Viewer), never a synthetic click on a hidden/off-screen element.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KNOWN_ENV_NOISE = [/ERR_CERT_AUTHORITY_INVALID/, /ERR_TUNNEL_CONNECTION_FAILED/, /ERR_FILE_NOT_FOUND/];
const isEnvNoise = (t) => KNOWN_ENV_NOISE.some((re) => re.test(t));

function check(results, label, ok, detail) {
  results.push({ label, ok: !!ok, detail: detail !== undefined ? detail : null });
  console.log((ok ? '[OK  ] ' : '[FAIL] ') + label + (detail !== undefined && !ok ? ' -- ' + JSON.stringify(detail) : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !isEnvNoise(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

  await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(400);

  const results = [];

  async function atVisibleH1() {
    return page.evaluate(() => {
      function atVisible(el) {
        if (el.closest('[hidden]')) return false;
        if (el.closest('[inert]')) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      }
      return [...document.querySelectorAll('h1')].filter(atVisible).map((h) => h.id || h.textContent.trim());
    });
  }
  async function appRootInert() { return page.evaluate(() => { const el = document.querySelector('.app-root'); return el ? el.inert : null; }); }
  async function recordViewerInert() { return page.evaluate(() => { const el = document.getElementById('recordViewerBackdrop'); return el ? el.inert : null; }); }
  async function activeInfo() { return page.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, text: (a.textContent || '').slice(0, 30) } : null; }); }

  // 1. initial h1
  const initial = await atVisibleH1();
  check(results, '1. initial AT-visible h1 == 1', initial.length === 1, initial);

  // Prepare: enable trace recording, run one real trial so Record Viewer has an entry to open
  await page.click('#donomanaA11yBtn'); await page.waitForTimeout(150);
  await page.click('#donomanaSettingsProxy'); await page.waitForTimeout(300);
  await page.check('#traceToggle'); await page.waitForTimeout(100);
  await page.click('#closeTeacherSettingsBtn'); await page.waitForTimeout(300);
  await page.click('#startBtn'); await page.waitForTimeout(300);
  const surfaceBox = await page.locator('#activitySurface').boundingBox();
  await page.mouse.click(surfaceBox.x + surfaceBox.width / 2, surfaceBox.y + surfaceBox.height / 2);
  await page.waitForTimeout(200);
  await page.click('#endBtn', { force: true }); // real button, independently visible; full-bleed surface overlap only blocks Playwright's actionability check, not a real user
  await page.waitForTimeout(300);
  await page.click('#backHomeFromSummaryBtn');
  await page.waitForTimeout(300);

  // 2/3/4. Record Viewer open
  await page.click('#donomanaA11yBtn'); await page.waitForTimeout(150);
  await page.click('#donomanaSettingsProxy'); await page.waitForTimeout(300);
  await page.click('#openRecordViewerBtn'); await page.waitForTimeout(300);
  check(results, '2. Record Viewer open -> .app-root is inert', (await appRootInert()) === true);
  const rvH1 = await atVisibleH1();
  check(results, '4. Record Viewer open -> AT-visible h1 == 1 (background isolated)', rvH1.length === 1 && rvH1[0] === 'recordViewerTitle', rvH1);
  check(results, 'Record Viewer open -> focus on recordViewerTitle', (await activeInfo()).id === 'recordViewerTitle', await activeInfo());

  // 5. Tab containment (existing trap, must still work now that recordViewerBackdrop can itself become inert later)
  const rvFocusableCount = await page.evaluate(() => {
    const m = document.getElementById('recordViewerModal');
    return Array.from(m.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null && !el.disabled).length;
  });
  let rvTabOk = true;
  for (let i = 0; i < rvFocusableCount + 3; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const m = document.getElementById('recordViewerModal'); const t = document.getElementById('recordViewerTitle');
      return m.contains(document.activeElement) || document.activeElement === t;
    });
    if (!inside) { rvTabOk = false; break; }
  }
  check(results, '5. Record Viewer: Tab stays inside modal', rvTabOk);
  let rvShiftTabOk = true;
  for (let i = 0; i < rvFocusableCount + 3; i++) {
    await page.keyboard.press('Shift+Tab');
    const inside = await page.evaluate(() => {
      const m = document.getElementById('recordViewerModal'); const t = document.getElementById('recordViewerTitle');
      return m.contains(document.activeElement) || document.activeElement === t;
    });
    if (!inside) { rvShiftTabOk = false; break; }
  }
  check(results, 'Record Viewer: Shift+Tab stays inside modal', rvShiftTabOk);

  // 8. Record -> Trace open (real click on the trace thumbnail)
  const traceThumb = page.locator('#recordViewerList button, #recordViewerList [role="button"], #recordViewerList .trace-thumb').first();
  const traceThumbCount = await page.locator('#recordViewerList button, #recordViewerList [role="button"], #recordViewerList .trace-thumb').count();
  await traceThumb.click();
  await page.waitForTimeout(300);
  const traceOpened = await page.evaluate(() => !document.getElementById('traceViewerBackdrop').hidden);
  check(results, '8. Trace Viewer reachable via a real click on a record entry', traceOpened, { traceThumbCount });

  // 9/10. Trace open -> h1 count, Record Viewer isolation during Trace
  const tvH1 = await atVisibleH1();
  check(results, '9. Trace Viewer open -> AT-visible h1 == 1 (only traceViewerTitle)', tvH1.length === 1 && tvH1[0] === 'traceViewerTitle', tvH1);
  check(results, '10. Trace Viewer open -> recordViewerBackdrop is inert (Record Viewer isolated underneath)', (await recordViewerInert()) === true);
  check(results, 'Trace Viewer open -> .app-root still inert too', (await appRootInert()) === true);
  check(results, 'Trace Viewer open -> focus on traceViewerTitle', (await activeInfo()).id === 'traceViewerTitle', await activeInfo());

  // 6. Escape (Trace Viewer, priority over Record Viewer's own Escape)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 11/12. Trace close -> Record Viewer re-activation
  const afterTraceCloseH1 = await atVisibleH1();
  check(results, '11. Trace close -> AT-visible h1 == 1 (recordViewerTitle again)', afterTraceCloseH1.length === 1 && afterTraceCloseH1[0] === 'recordViewerTitle', afterTraceCloseH1);
  check(results, '12. Trace close -> recordViewerBackdrop inert cleared (Record Viewer re-activated)', (await recordViewerInert()) === false);
  check(results, 'Trace close -> .app-root still inert (Record Viewer still open)', (await appRootInert()) === true);
  const afterTraceCloseFocus = await activeInfo();
  check(results, 'Trace close -> focus restored to the real trace-thumbnail opener', afterTraceCloseFocus && afterTraceCloseFocus.tag === 'BUTTON', afterTraceCloseFocus);

  // Re-verify Record Viewer Tab trap resumed correctly post Trace close
  await page.keyboard.press('Tab');
  const backInModalAfterTrace = await page.evaluate(() => {
    const m = document.getElementById('recordViewerModal'); const t = document.getElementById('recordViewerTitle');
    return m.contains(document.activeElement) || document.activeElement === t;
  });
  check(results, 'Record Viewer: Tab containment resumes correctly after Trace Viewer closes', backInModalAfterTrace);

  // 7. Escape (Record Viewer)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 13/14. Record close -> .app-root inert cleared
  const afterRecordCloseH1 = await atVisibleH1();
  check(results, '13. Record Viewer closed -> AT-visible h1 == 1 (background)', afterRecordCloseH1.length === 1, afterRecordCloseH1);
  check(results, '14. Record Viewer closed -> .app-root inert cleared', (await appRootInert()) === false);
  check(results, 'Record Viewer closed -> focus restored to donomanaA11yBtn', (await activeInfo()).id === 'donomanaA11yBtn', await activeInfo());

  // Help / Teacher Settings still work (not broken by this Phase)
  await page.click('#donomanaHelpBtn'); await page.waitForTimeout(300);
  check(results, 'Help still opens correctly, still isolates background (unaffected by this Phase)', (await appRootInert()) === true && (await atVisibleH1()).length === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check(results, 'Help close -> .app-root inert cleared', (await appRootInert()) === false);

  await page.click('#donomanaA11yBtn'); await page.waitForTimeout(150);
  await page.click('#donomanaSettingsProxy'); await page.waitForTimeout(300);
  check(results, 'Teacher Settings still opens correctly, still isolates background (unaffected by this Phase)', (await appRootInert()) === true && (await atVisibleH1()).length === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check(results, 'Teacher Settings close -> .app-root inert cleared', (await appRootInert()) === false);

  // 15. 2-trial regression
  await page.click('#startBtn'); await page.waitForTimeout(400);
  await page.click('#endBtn', { force: true }); await page.waitForTimeout(300);
  await page.click('#playAgainBtn'); await page.waitForTimeout(300);
  await page.click('#startBtn'); await page.waitForTimeout(400);
  await page.click('#endBtn', { force: true }); await page.waitForTimeout(300);
  const trial2H1 = await atVisibleH1();
  check(results, '15. 2-trial regression: trial 2 summary shown, AT-visible h1 == 1', trial2H1.length === 1, trial2H1);

  // 16/17. errors
  check(results, '16. no console.error across the whole run (env noise filtered)', consoleErrors.length === 0, consoleErrors);
  check(results, '17. no pageerror across the whole run', pageErrors.length === 0, pageErrors);

  await context.close();
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  fs.writeFileSync(path.join(__dirname, 'sawatte-record-trace-viewer-isolation-fix-results.json'), JSON.stringify(results, null, 2), 'utf-8');
  process.exit(passed === results.length ? 0 : 1);
})();
