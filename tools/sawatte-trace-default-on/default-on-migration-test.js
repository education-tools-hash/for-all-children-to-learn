/*
 * さわってひろがる Trace Default-ON Migration + Reliability Regression Test
 * (Phase SAWATTE-TRACE-DEFAULT-ON-AND-RELIABILITY-1)
 *
 * Covers the revised Trace Record Contract §12 default (new device: ON,
 * existing device: preserved as-is, explicit false never auto-flipped,
 * legacy settings without the traceEnabled field: stays OFF) and the
 * settings-save-failure reliability fix (saveSettings() now classifies and
 * announces failures the same way donomanaRecordWriteLog() already does
 * for activity records).
 *
 * Extended in Phase SAWATTE-TRACE-DEFAULT-ON-REVIEW-AND-PREVIEW-DESIGN-1
 * with: corrupt-JSON settings fallback, whole-storage-access-failure
 * fallback, explicit pre-activity ON->new-activity trace save, and the new
 * start-screen trace status indicator added in that Phase (tests 7-10).
 *
 * Corrected in Phase SAWATTE-TRACE-SCOPE-CORRECTION-1: the settings-save
 * failure fix (test 6) originally reused the shared Learning Record
 * Foundation's donomanaRecordNotifySaveFailure() by adding an argument to
 * it, which required hand-editing the generator-injected Foundation block
 * and generate.js's shared template — regenerating the same change into
 * all 21 other Foundation apps. That shared-code change has been reverted;
 * the Foundation function is back to its original, unmodified baseline.
 * Test 6 now verifies an entirely app-local notification
 * (sawatteNotifySettingsSaveFailure() / #sawatteSettingsSaveFailureBanner,
 * defined outside any generated block in sawatte-hirogaru-app.html) that
 * never touches the shared Foundation code or any other app. Test 6b
 * additionally verifies the reload-reverts-the-change behavior the new
 * banner's wording describes.
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function check(label, ok, detail) {
  console.log((ok ? '[OK  ] ' : '[FAIL] ') + label + (detail !== undefined ? ' -- ' + JSON.stringify(detail) : ''));
}

async function freshPage(browser, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1024, height: 768 } }, opts || {}));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return { context, page, pageErrors };
}

async function dispatchPointer(page, type, x, y, pointerId, pointerType) {
  await page.evaluate(({ type, x, y, pointerId, pointerType }) => {
    var el = document.getElementById('activitySurface');
    var rect = el.getBoundingClientRect();
    var ev = new PointerEvent(type, {
      pointerId: pointerId, pointerType: pointerType, bubbles: true, cancelable: true,
      clientX: rect.left + x, clientY: rect.top + y, isPrimary: true
    });
    el.dispatchEvent(ev);
  }, { type, x, y, pointerId, pointerType });
}

async function doOneTouchActivity(page) {
  await page.click('#startBtn');
  await dispatchPointer(page, 'pointerdown', 60, 60, Math.floor(Math.random() * 100000), 'touch');
  await dispatchPointer(page, 'pointerup', 60, 60, Math.floor(Math.random() * 100000) + 1, 'touch');
  await page.click('#endBtn');
  await page.click('#playAgainBtn');
}

async function getLog(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sawatte_hirogaru_log') || '[]'));
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ──────────────────────────────────────────────────────────
  // 1. Truly fresh device: no settings key, no log key -> default ON.
  //    The toggle shows ON before any activity, and activity 1 WITHOUT
  //    touching settings produces a trace.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    const settingsKey = await page.evaluate(() => localStorage.getItem('sawatte_hirogaru_settings'));
    const logKey = await page.evaluate(() => localStorage.getItem('sawatte_hirogaru_log'));
    check('[1-fresh] sanity: no settings key on a fresh page', settingsKey === null, settingsKey);
    check('[1-fresh] sanity: no log key on a fresh page', logKey === null, logKey);

    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[1-fresh] traceToggle shows ON before the first activity, with no prior interaction', checked === true, checked);
    await page.click('#closeTeacherSettingsBtn');

    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    check('[1-fresh] activity 1 (no settings touched) has a valid trace', hasTrace, hasTrace);
    check('[1-fresh] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 2. Explicit stored traceEnabled:false is respected and never
  //    auto-flipped, even though no activity log exists yet.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('sawatte_hirogaru_settings', JSON.stringify({
        mode: 'light_sound', intensity: 'standard', effectWidth: 'normal',
        effectSound: 'soft', soundEnabled: true, gazeEnabled: false, traceEnabled: false
      }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[2-explicit-false] explicit traceEnabled:false is respected, toggle shows OFF', checked === false, checked);
    await page.click('#closeTeacherSettingsBtn');
    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    check('[2-explicit-false] activity has NO trace (explicit OFF never auto-flipped)', !hasTrace, hasTrace);
    check('[2-explicit-false] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 3. Legacy settings object (predates traceEnabled field entirely) ->
  //    stays OFF, is NOT treated as a fresh device.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      // Legacy shape: no traceEnabled key at all (predates this feature).
      localStorage.setItem('sawatte_hirogaru_settings', JSON.stringify({
        mode: 'sound', intensity: 'gentle', effectWidth: 'thin', effectSound: 'pop', soundEnabled: false
      }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[3-legacy-settings] legacy settings object (no traceEnabled field) keeps OFF', checked === false, checked);
    // Also confirm other legacy fields were still correctly loaded (regression check).
    const modeApplied = await page.evaluate(() => document.querySelector('#modeChoiceRow .choice-btn[aria-pressed="true"]').textContent);
    check('[3-legacy-settings] other legacy fields (mode) still load correctly', modeApplied.indexOf('おと') !== -1, modeApplied);
    await page.click('#closeTeacherSettingsBtn');
    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    check('[3-legacy-settings] activity has NO trace', !hasTrace, hasTrace);
    check('[3-legacy-settings] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 4. Device with existing activity records but NO settings key at all
  //    (settings were somehow cleared, or predate the settings feature) ->
  //    NOT treated as fresh, stays OFF.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('sawatte_hirogaru_log', JSON.stringify([
        { timestamp: new Date().toISOString(), appId: 'sawatte-hirogaru-app', activity: 'session', inputMethod: null, schemaVersion: 1,
          payload: { detailSchemaVersion: 1, mode: 'light', durationMs: 5000, totalInteractions: 3, tapCount: 3, swipeCount: 0, inputMethods: ['touch'], soundEnabled: true, intensity: 'standard', effectWidth: 'normal', effectSound: 'soft' } }
      ]));
      // Deliberately no settings key.
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[4-existing-log-no-settings] device with records but no settings key keeps OFF (not treated as new)', checked === false, checked);
    await page.click('#closeTeacherSettingsBtn');
    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[1] && log[1].payload && log[1].payload.trace);
    check('[4-existing-log-no-settings] new activity has NO trace', !hasTrace, hasTrace);
    check('[4-existing-log-no-settings] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 5. Mid-activity toggle still does not retroactively apply, even with
  //    the new default (re-verify this still holds).
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    // Start from explicit OFF so the mid-activity ON-toggle is a real transition.
    await page.evaluate(() => {
      localStorage.setItem('sawatte_hirogaru_settings', JSON.stringify({ traceEnabled: false }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#startBtn');
    await dispatchPointer(page, 'pointerdown', 40, 40, 11, 'touch');
    await dispatchPointer(page, 'pointerup', 40, 40, 11, 'touch');
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    await page.check('#traceToggle');
    await page.click('#closeTeacherSettingsBtn');
    await dispatchPointer(page, 'pointerdown', 50, 50, 12, 'touch');
    await dispatchPointer(page, 'pointerup', 50, 50, 12, 'touch');
    await page.click('#endBtn');
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    check('[5-mid-toggle] mid-activity ON still does not retroactively apply to the current session', !hasTrace, hasTrace);
    check('[5-mid-toggle] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 6. Settings-save failure now produces a visible+announced banner.
  //
  //    Phase SAWATTE-TRACE-SCOPE-CORRECTION-1: this now verifies the
  //    app-local sawatteNotifySettingsSaveFailure()/#sawatteSettingsSave
  //    FailureBanner mechanism instead of a shared-Foundation customMsg
  //    argument (that shared-code change was reverted; the Foundation's
  //    donomanaRecordNotifySaveFailure() is back to its original,
  //    no-argument baseline, used only for activity-record failures,
  //    unchanged for every app). Also verifies: the banner never doubles
  //    up on repeated failures, never blocks screen input, is isolated
  //    from the generic record-save banner, and that the warned-about
  //    "reverts after reload" behavior is literally true.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    // Fresh page now defaults traceEnabled to true (checkbox already ON), so
    // page.uncheck() gives a real OFF transition without first toggling.
    await page.evaluate(() => {
      var orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'sawatte_hirogaru_settings') throw new DOMException('simulated quota', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    await page.uncheck('#traceToggle'); // real ON->OFF transition, will attempt to save and fail

    await page.waitForTimeout(200);
    const checkedInMemory = await page.locator('#traceToggle').isChecked();
    check('[6-settings-save-fail] in-memory/UI already shows the attempted new value despite the save failure', checkedInMemory === false, checkedInMemory);

    const banner = page.locator('#sawatteSettingsSaveFailureBanner');
    const bannerVisible = await banner.isVisible().catch(() => false);
    const bannerText = bannerVisible ? await banner.textContent() : null;
    check('[6-settings-save-fail] FIX VERIFIED: app-local banner fires on settings-save failure', bannerVisible, bannerText);
    check('[6-settings-save-fail] banner text matches actual behavior (mentions reload reverting it)', bannerText && bannerText.indexOf('再読み込み') !== -1 && bannerText.indexOf('せってい') !== -1, bannerText);
    const pe = bannerVisible ? await banner.evaluate(function (el) { return getComputedStyle(el).pointerEvents; }) : null;
    check('[6-settings-save-fail] banner does not block screen operation (pointer-events:none)', pe === 'none', pe);
    const genericBannerCount = await page.locator('#donomanaRecordSaveFailureBanner').count();
    check('[6-settings-save-fail] generic Foundation record-save banner NOT created (isolated from it)', genericBannerCount === 0, genericBannerCount);

    // Repeated failure must reuse the one element, never create a duplicate.
    await page.check('#traceToggle');
    await page.waitForTimeout(200);
    const bannerCount = await page.locator('#sawatteSettingsSaveFailureBanner').count();
    check('[6-settings-save-fail] repeated failures reuse the single banner element (no duplicates)', bannerCount === 1, bannerCount);
    check('[6-settings-save-fail] no uncaught JS exceptions (failure handled gracefully)', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 6b. The reload-reverts-the-change behavior the banner warns about is
  //     literally true: nothing was ever persisted, so after a reload the
  //     setting goes back to the last value that WAS successfully saved.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      var orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'sawatte_hirogaru_settings') throw new DOMException('simulated quota', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    await page.uncheck('#traceToggle'); // fresh device: ON -> OFF, fails to persist
    await page.click('#closeTeacherSettingsBtn');
    await page.reload({ waitUntil: 'load' });
    const settingsKeyAfterReload = await page.evaluate(function () { return localStorage.getItem('sawatte_hirogaru_settings'); });
    check('[6b-reload-reverts] settings key still does not exist after reload (the failed save truly never persisted)', settingsKeyAfterReload === null, settingsKeyAfterReload);
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checkedAfterReload = await page.locator('#traceToggle').isChecked();
    check('[6b-reload-reverts] after reload, setting reverted to the last persisted state (back to ON) exactly as the banner warned', checkedAfterReload === true, checkedAfterReload);
    check('[6b-reload-reverts] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 7. Corrupt JSON in the settings key (not valid JSON at all) falls back
  //    safely: treated as "has settings, not new" -> stays OFF, no crash.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('sawatte_hirogaru_settings', '{this is not valid JSON');
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[7-corrupt-json] corrupt (unparseable) settings JSON falls back safely to OFF', checked === false, checked);
    await page.click('#closeTeacherSettingsBtn');
    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    check('[7-corrupt-json] activity has NO trace', !hasTrace, hasTrace);
    check('[7-corrupt-json] no uncaught JS exceptions (corrupt JSON handled gracefully)', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 8. Whole-storage access failure (e.g. Safari Private Browsing style
  //    SecurityError on every localStorage call) falls back safely to OFF
  //    rather than guessing "new device" when history can't be confirmed.
  //
  //    NOTE: this also surfaces a PRE-EXISTING, out-of-scope-for-this-Phase
  //    finding: the common a11y panel's own bootstrap (generate.js-injected
  //    "a11y-panel" block, lines ~449-457, shared verbatim across ~30 apps)
  //    reads localStorage.getItem(contrast/font/sr) on every page load
  //    without a try/catch, so it throws uncaught under this same total-
  //    storage-failure condition. That is unrelated to the trace feature
  //    this Phase owns (traceEnabled's own load/save path IS fully guarded,
  //    as the toggle-state assertion below confirms) and is not fixed here
  //    — flagged for a separate Phase if the user wants it addressed.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.addInitScript(() => {
      var throwing = function () { throw new DOMException('storage disabled', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: function () { return { getItem: throwing, setItem: throwing, removeItem: throwing }; } });
    });
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    const checked = await page.locator('#traceToggle').isChecked();
    check('[8-storage-inaccessible] localStorage throwing on every call falls back safely to OFF (never assumes "new" when history is unknowable)', checked === false, checked);
    check('[8-storage-inaccessible] KNOWN PRE-EXISTING GAP (not this Phase\'s scope): common a11y-panel bootstrap throws uncaught under total storage failure', pageErrors.length > 0 && pageErrors[0].indexOf('storage disabled') !== -1, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 9. Explicit pre-activity ON (teacher turns it ON before starting, not
  //    mid-activity) on a device that started explicitly OFF -> the very
  //    next NEW activity's finger-touch is saved with a valid trace.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('sawatte_hirogaru_settings', JSON.stringify({ traceEnabled: false }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    await page.check('#traceToggle');
    await page.click('#closeTeacherSettingsBtn');
    await doOneTouchActivity(page);
    const log = await getLog(page);
    const hasTrace = !!(log[0] && log[0].payload && log[0].payload.trace);
    const validTrace = hasTrace && (log[0].payload.trace.taps.length > 0 || log[0].payload.trace.swipes.length > 0);
    check('[9-pre-activity-on] turning ON before starting (not mid-activity), then starting a new activity, saves a valid finger-touch trace', validTrace, log[0] && log[0].payload && log[0].payload.trace);
    check('[9-pre-activity-on] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  // ──────────────────────────────────────────────────────────
  // 10. Start-screen status indicator (Review point 1, Phase
  //     SAWATTE-TRACE-DEFAULT-ON-REVIEW-AND-PREVIEW-DESIGN-1): the current
  //     ON/OFF state is now visible on the start screen without opening
  //     Teacher Settings, and updates after a real toggle.
  // ──────────────────────────────────────────────────────────
  {
    const { context, page, pageErrors } = await freshPage(browser);
    await page.goto('file://' + path.join(ROOT, 'sawatte-hirogaru-app.html'), { waitUntil: 'load' });
    const onText = await page.locator('#startTraceStatus').textContent();
    check('[10-start-status] fresh device: start screen shows ON without opening settings', onText.indexOf('ON') !== -1, onText);
    await page.click('#donomanaA11yBtn');
    await page.click('#donomanaSettingsProxy');
    await page.uncheck('#traceToggle');
    await page.click('#closeTeacherSettingsBtn');
    const offText = await page.locator('#startTraceStatus').textContent();
    check('[10-start-status] after a real toggle OFF, start screen text updates to OFF', offText.indexOf('OFF') !== -1, offText);
    check('[10-start-status] no uncaught JS exceptions', pageErrors.length === 0, pageErrors);
    await context.close();
  }

  await browser.close();
})();
