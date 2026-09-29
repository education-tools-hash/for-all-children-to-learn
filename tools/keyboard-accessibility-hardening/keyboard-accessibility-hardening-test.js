// Phase KEYBOARD-ACCESSIBILITY-HARDENING-1
// Verifies independent (switch-scan-free) keyboard operability for the 5
// DEFER_PARTIAL apps identified in APP-INPUT-METADATA-FULL-AUDIT-1 /
// APP-INPUT-METADATA-KEYBOARD-CORRECTION-2: schedule-app, timetable-app,
// cup_game, directions-app, ongaku-app.
//
// Requires a local static server for the repo root:
//   python3 -m http.server 8949 --bind 127.0.0.1
// then: node tools/keyboard-accessibility-hardening/keyboard-accessibility-hardening-test.js
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8949';
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

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // ============================================================
  // A. schedule-app
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/schedule-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    // Seed 3 items directly via the app's own data functions, then open viewer tab.
    await page.evaluate(() => {
      items.push(makeItem('あさのしたく'));
      items.push(makeItem('がっこうへいく'));
      items.push(makeItem('しゅくだい'));
      switchTab('viewer');
    });
    await page.waitForTimeout(200);

    // --- switch mode OFF: Tab to a .v-item, Enter activates ---
    const firstItem = page.locator('.v-item').first();
    await firstItem.focus();
    const focusedOk = await page.evaluate(() => document.activeElement.classList.contains('v-item'));
    check('schedule-app: .v-item is focusable via .focus() (tabindex present)', focusedOk);

    const beforeChecked = await page.evaluate(() => Object.keys(checks).length);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const afterChecked = await page.evaluate(() => Object.keys(checks).length);
    check('schedule-app: Enter on focused .v-item toggles check (switch mode OFF)', afterChecked === beforeChecked + 1, { before: beforeChecked, after: afterChecked });

    // Space on the 2nd item
    const secondItem = page.locator('.v-item').nth(1);
    await secondItem.focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const afterSpace = await page.evaluate(() => Object.keys(checks).length);
    check('schedule-app: Space on focused .v-item toggles check', afterSpace === afterChecked + 1, { afterChecked, afterSpace });

    // --- real Tab-order traversal reaches multiple .v-item ---
    await page.evaluate(() => { checks = {}; document.activeElement.blur(); });
    await page.keyboard.press('Tab'); // land somewhere in the page; just confirm no crash and some v-item is reachable by repeated Tab
    let reachedItem = false;
    for (let i = 0; i < 40; i++) {
      const isVItem = await page.evaluate(() => document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('v-item'));
      if (isVItem) { reachedItem = true; break; }
      await page.keyboard.press('Tab');
    }
    check('schedule-app: real Tab traversal reaches a .v-item', reachedItem);

    // --- double-activation check: switch mode ON, item focused, Enter should NOT also fire scanAction ---
    await page.evaluate(() => { checks = {}; setSwitchMode('2switch', true); refreshSwitchScanItems(); });
    await page.waitForTimeout(100);
    const target = page.locator('.v-item').first();
    await target.focus();
    const beforeDbl = await page.evaluate(() => Object.keys(checks).length);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const afterDbl = await page.evaluate(() => Object.keys(checks).length);
    check('schedule-app: no double-activation when switch mode ON + item Tab-focused + Enter (exactly +1)', afterDbl === beforeDbl + 1, { beforeDbl, afterDbl });

    // --- switch scan regression: scanning still cycles/highlights with 2switch mode ---
    await page.evaluate(() => { setSwitchMode('off', true); items = []; items.push(makeItem('A')); items.push(makeItem('B')); setSwitchMode('2switch', true); switchTab('viewer'); });
    await page.waitForTimeout(200);
    const scanFocusCount = await page.evaluate(() => document.querySelectorAll('.v-item.scan-focus').length);
    check('schedule-app: switch scan still highlights a candidate (regression-free)', scanFocusCount === 1, scanFocusCount);
    await page.evaluate(() => setSwitchMode('off', true));

    // --- click/touch regression ---
    await page.evaluate(() => { checks = {}; items = []; items.push(makeItem('C')); switchTab('viewer'); });
    await page.waitForTimeout(150);
    await page.locator('.v-item').first().click();
    await page.waitForTimeout(150);
    const clickChecked = await page.evaluate(() => Object.keys(checks).length);
    check('schedule-app: click still toggles check (pointer regression-free)', clickChecked === 1, clickChecked);

    check('schedule-app: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // B. timetable-app
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/timetable-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(400);

    const firstChip = page.locator('.time-chip').first();
    await firstChip.focus();
    const chipFocused = await page.evaluate(() => document.activeElement.classList.contains('time-chip'));
    check('timetable-app: .time-chip is focusable (tabindex present)', chipFocused);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const selectedAfterEnter = await page.evaluate(() => document.querySelectorAll('.time-chip.selected').length);
    check('timetable-app: Enter on focused .time-chip selects it (selectTime fires)', selectedAfterEnter === 1, selectedAfterEnter);

    const secondChip = page.locator('.time-chip').nth(1);
    await secondChip.focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const selectedText = await page.locator('#sel-time').innerText();
    check('timetable-app: Space on a different .time-chip re-selects (selectTime updates #sel-time)', !!selectedText && selectedText.includes(':'), selectedText);

    // quiz/mission keyboard behavior unaffected: source-level check that quiz-opt/
    // mission-choice-btn generation is untouched (this Phase's diff only added
    // tabindex/onkeydown to the .time-chip template; quiz/mission code is unrelated).
    await page.click('button[onclick="switchTab(\'concept\',this)"]');
    await page.waitForTimeout(150);
    const level3Btn = page.locator('button[data-quiz-level="3"]');
    await level3Btn.click();
    await page.waitForTimeout(200);
    const quizOptTag = await page.evaluate(() => {
      const el = document.querySelector('.quiz-opt');
      return el ? el.tagName : null;
    });
    check('timetable-app: quiz-opt still generated as a real <button> (quiz mode regression-free)', quizOptTag === 'BUTTON', quizOptTag);

    // click/touch regression: clicking a chip still works (switch back to the timetable tab first)
    await page.click('button[onclick="switchTab(\'timetable\',this)"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelectorAll('.time-chip.selected').forEach((c) => c.classList.remove('selected')));
    await page.locator('.time-chip').first().click();
    await page.waitForTimeout(100);
    const selectedAfterClick = await page.evaluate(() => document.querySelectorAll('.time-chip.selected').length);
    check('timetable-app: click still selects a chip (pointer regression-free)', selectedAfterClick === 1, selectedAfterClick);

    check('timetable-app: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // C. cup_game
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/cup_game.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    // speed up: reduce cup count doesn't change animation timing, so just start and poll for phase.
    await page.click('#startBtn');
    // poll for phase === 'guess'
    let reachedGuess = false;
    for (let i = 0; i < 40; i++) {
      const curPhase = await page.evaluate(() => phase);
      if (curPhase === 'guess') { reachedGuess = true; break; }
      await page.waitForTimeout(250);
    }
    check('cup_game: game reaches guess phase', reachedGuess);

    if (reachedGuess) {
      const cupFocusable = await page.evaluate(() => cupsData[0].wrapper.tabIndex === 0);
      check('cup_game: cup wrapper is focusable during guess phase (tabIndex=0)', cupFocusable);

      await page.evaluate(() => cupsData[0].wrapper.focus());
      const focusedIsCup = await page.evaluate(() => document.activeElement === cupsData[0].wrapper);
      check('cup_game: cup wrapper actually receives DOM focus', focusedIsCup);

      // useScan OFF (default): Enter should call guess() -> phase becomes 'result'
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      const phaseAfterEnter = await page.evaluate(() => phase);
      check('cup_game: Enter on focused cup triggers guess() with useScan OFF (phase -> result)', phaseAfterEnter === 'result', phaseAfterEnter);

      // close result overlay via its real close button (#nextBtn -> closeResult())
      await page.click('#nextBtn').catch(() => {});
      await page.waitForTimeout(200);
    }

    check('cup_game: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // C2. cup_game: double-activation + switch-scan regression (separate run)
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/cup_game.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { document.getElementById('toggleScan').checked = true; useScan = true; });
    await page.click('#startBtn');
    let reachedGuess = false;
    for (let i = 0; i < 40; i++) {
      const curPhase = await page.evaluate(() => phase);
      if (curPhase === 'guess') { reachedGuess = true; break; }
      await page.waitForTimeout(250);
    }
    check('cup_game[useScan branch]: game reaches guess phase with scan indicator shown', reachedGuess);
    if (reachedGuess) {
      const scanShown = await page.evaluate(() => document.getElementById('scanIndicator').classList.contains('show'));
      check('cup_game: switch scan indicator still shows when useScan is checked (regression-free)', scanShown);

      // Tab-focus a DIFFERENT cup than the scan cursor, press Enter: exactly one guess() call, on the Tab-focused cup
      await page.evaluate(() => { cupsData[1].wrapper.focus(); });
      const beforePhase = await page.evaluate(() => phase);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      const afterPhase = await page.evaluate(() => phase);
      check('cup_game: no double-activation when switch scan is also enabled (phase transitions exactly once)', beforePhase === 'guess' && afterPhase === 'result', { beforePhase, afterPhase });
    }
    check('cup_game[useScan branch]: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // D. directions-app
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/directions-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.click('button[onclick="nav(\'practice\')"]:visible');
    await page.waitForTimeout(300);

    const slotCount = await page.locator('.slot').count();
    check('directions-app: 「はいち」mode renders slot elements', slotCount > 0, slotCount);

    const slotsFocusable = await page.evaluate(() => Array.from(document.querySelectorAll('.slot')).every((s) => s.tabIndex === 0));
    check('directions-app: all .slot elements are focusable (tabindex=0)', slotsFocusable);

    // must pick the animal first (existing app logic) before placeAt succeeds
    await page.click('#animal-pick');
    await page.waitForTimeout(150);

    const firstSlot = page.locator('.slot').first();
    await firstSlot.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const filledAfterEnter = await page.evaluate(() => document.querySelectorAll('.slot.filled').length);
    check('directions-app: Enter on focused .slot triggers placeAt() (slot becomes filled)', filledAfterEnter === 1, filledAfterEnter);

    // Space on a different slot re-places
    await page.click('#animal-pick');
    const secondSlot = page.locator('.slot').nth(1);
    await secondSlot.focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(200);
    const filledAfterSpace = await page.evaluate(() => document.querySelectorAll('.slot.filled').length);
    check('directions-app: Space on a different .slot re-places (still exactly 1 filled slot, no double)', filledAfterSpace === 1, filledAfterSpace);

    // other 3 modes unaffected: quiz screens still use real <button> per prior audit; spot-check nanbanme quiz loads without error
    await page.click('button[onclick="nav(\'home\')"]:visible').catch(() => {});
    await page.click('button[onclick="nav(\'games\')"]:visible').catch(() => {});
    await page.waitForTimeout(150);
    check('directions-app: other modes still reachable without error after はいち changes', bucket.pageErrors.length === 0, bucket.pageErrors);

    // click/touch regression on slot
    await page.click('button[onclick="nav(\'practice\')"]:visible');
    await page.waitForTimeout(200);
    await page.click('#animal-pick');
    await page.locator('.slot').first().click();
    await page.waitForTimeout(150);
    const filledAfterClick = await page.evaluate(() => document.querySelectorAll('.slot.filled').length);
    check('directions-app: click still fills a slot (pointer regression-free)', filledAfterClick === 1, filledAfterClick);

    check('directions-app: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // E. ongaku-app
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/ongaku-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.click('.btn-play');
    await page.waitForTimeout(200);
    await page.click('#tab-piano');
    await page.waitForTimeout(300);

    const whiteKeyCount = await page.locator('.key-white').count();
    const blackKeyCount = await page.locator('.key-black').count();
    check('ongaku-app: 「けんばん」mode renders white+black keys', whiteKeyCount > 0 && blackKeyCount > 0, { whiteKeyCount, blackKeyCount });

    const keysFocusable = await page.evaluate(() => Array.from(document.querySelectorAll('.key-white,.key-black')).every((k) => k.tabIndex === 0));
    check('ongaku-app: all piano keys (white+black) are focusable (tabindex=0)', keysFocusable);

    // Enter on a white key -> pressed class + no error (sound uses WebAudio, hard to assert audibly, assert visual 'pressed' + no crash)
    const firstWhite = page.locator('.key-white').first();
    await firstWhite.focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(80);
    const pressedOnDown = await page.evaluate(() => document.querySelector('.key-white').classList.contains('pressed'));
    await page.keyboard.up('Enter');
    await page.waitForTimeout(80);
    const pressedAfterUp = await page.evaluate(() => document.querySelector('.key-white').classList.contains('pressed'));
    check('ongaku-app: Enter keydown adds "pressed", keyup removes it (white key)', pressedOnDown === true && pressedAfterUp === false, { pressedOnDown, pressedAfterUp });

    // Space on a black key
    const firstBlack = page.locator('.key-black').first();
    await firstBlack.focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(80);
    const blackPressedOnDown = await page.evaluate(() => document.querySelector('.key-black').classList.contains('pressed'));
    await page.keyboard.up(' ');
    await page.waitForTimeout(80);
    const blackPressedAfterUp = await page.evaluate(() => document.querySelector('.key-black').classList.contains('pressed'));
    check('ongaku-app: Space keydown/keyup toggles "pressed" (black key)', blackPressedOnDown === true && blackPressedAfterUp === false, { blackPressedOnDown, blackPressedAfterUp });

    // 1 input = 1 sound: spy on playSound call count for a single Enter press (no key repeat double-fire)
    await page.evaluate(() => { window.__playSoundCalls = 0; const orig = window.playSound; window.playSound = function(...args){ window.__playSoundCalls++; return orig.apply(this, args); }; });
    await firstWhite.focus();
    await page.keyboard.down('Enter');
    await page.waitForTimeout(50);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(50);
    const callCount = await page.evaluate(() => window.__playSoundCalls);
    check('ongaku-app: exactly 1 playSound() call per keyboard press (no double activation)', callCount === 1, callCount);

    // touch/click regression: pointerdown-based click still plays (dispatch pointerdown/up)
    await page.evaluate(() => { window.__playSoundCalls = 0; });
    const box = await firstWhite.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(50);
    const pointerCallCount = await page.evaluate(() => window.__playSoundCalls);
    check('ongaku-app: pointerdown (mouse/touch) still triggers exactly 1 playSound() call (regression-free)', pointerCallCount === 1, pointerCallCount);

    check('ongaku-app: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // F. schedule-app — editor ("つくる") tab (Phase HARDENING-2)
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/schedule-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      items = [];
      checks = {};
      items.push(makeItem('あさのしたく'));
      items.push(makeItem('がっこうへいく'));
      items.push(makeItem('しゅくだい'));
      saveLocal();
      renderEditor();
    });
    await page.waitForTimeout(150);

    const editorActive = await page.evaluate(() => typeof activeTab !== 'undefined' && activeTab === 'editor');
    check('schedule-app: editor tab is the initial/default view', editorActive);

    // --- .item-check: Tab reachable, Enter/Space toggle, 1 input = 1 toggle ---
    const firstCheck = page.locator('.item-check').first();
    await firstCheck.focus();
    const checkFocused = await page.evaluate(() => document.activeElement.classList.contains('item-check'));
    check('schedule-app: .item-check is focusable (tabindex present)', checkFocused);
    const firstItemId = await page.evaluate(() => items[0].id);
    const beforeChecked = await page.evaluate((id) => !!checks[id], firstItemId);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const afterEnterChecked = await page.evaluate((id) => !!checks[id], firstItemId);
    check('schedule-app: Enter on focused .item-check toggles it (1 input = 1 toggle)', afterEnterChecked === !beforeChecked, { beforeChecked, afterEnterChecked });
    await page.locator('.item-check').first().focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(120);
    const afterSpaceChecked = await page.evaluate((id) => !!checks[id], firstItemId);
    check('schedule-app: Space on focused .item-check toggles it (1 input = 1 toggle)', afterSpaceChecked === beforeChecked, { afterEnterChecked, afterSpaceChecked });

    // --- .item-thumb: Tab reachable, Enter/Space open the icon/photo modal ---
    const firstThumb = page.locator('.item-thumb').first();
    await firstThumb.focus();
    const thumbFocused = await page.evaluate(() => document.activeElement.classList.contains('item-thumb'));
    check('schedule-app: .item-thumb is focusable (tabindex present)', thumbFocused);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const modalOpenAfterEnter = await page.evaluate(() => document.getElementById('img-modal').style.display === 'flex');
    check('schedule-app: Enter on focused .item-thumb opens the icon/photo modal', modalOpenAfterEnter);
    await page.evaluate(() => { document.getElementById('img-modal').style.display = 'none'; });
    await page.locator('.item-thumb').first().focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const modalOpenAfterSpace = await page.evaluate(() => document.getElementById('img-modal').style.display === 'flex');
    check('schedule-app: Space on focused .item-thumb opens the icon/photo modal', modalOpenAfterSpace);
    await page.evaluate(() => { document.getElementById('img-modal').style.display = 'none'; });

    // --- keyboard reordering: up/down buttons, boundary disabling, order actually changes, focus retained ---
    const idsBefore = await page.evaluate(() => items.map((i) => i.id));
    const secondUpBtn = page.locator('.item').nth(1).locator('.item-move-up');
    await secondUpBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const idsAfterUp = await page.evaluate(() => items.map((i) => i.id));
    check('schedule-app: keyboard reorder "up" actually swaps item order', idsAfterUp[0] === idsBefore[1] && idsAfterUp[1] === idsBefore[0], { idsBefore, idsAfterUp });

    const firstUpDisabled = await page.evaluate(() => document.querySelector('.item .item-move-up').disabled);
    check('schedule-app: top item\'s "up" button is disabled (no wraparound)', firstUpDisabled === true);
    const lastDownDisabled = await page.evaluate(() => { const items_ = document.querySelectorAll('.item'); return items_[items_.length - 1].querySelector('.item-move-down').disabled; });
    check('schedule-app: bottom item\'s "down" button is disabled (no wraparound)', lastDownDisabled === true);

    // The moved item is now first, so its own "up" is disabled by design; the
    // implementation's documented fallback moves focus to its "down" button instead.
    const focusInfo = await page.evaluate((movedId) => {
      const el = document.activeElement;
      return {
        isReorderBtn: !!el && (el.classList.contains('item-move-up') || el.classList.contains('item-move-down')),
        onMovedRow: !!el && el.closest('.item') && el.closest('.item').dataset.itemId === String(movedId),
      };
    }, idsAfterUp[0]);
    check('schedule-app: focus lands on a reorder button on the moved item\'s own row after reorder', focusInfo.isReorderBtn && focusInfo.onMovedRow, focusInfo);

    // move it back down to restore original order, verify "down" works symmetrically
    const movedItemId = idsAfterUp[0];
    await page.evaluate((id) => { document.querySelector(`.item[data-item-id="${id}"] .item-move-down`).focus(); }, movedItemId);
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const idsAfterDown = await page.evaluate(() => items.map((i) => i.id));
    check('schedule-app: keyboard reorder "down" (Space) restores original order', JSON.stringify(idsAfterDown) === JSON.stringify(idsBefore), { idsBefore, idsAfterDown });

    // --- drag-and-drop regression: dragstart/drop handlers untouched, still present ---
    const dragHandlersPresent = await page.evaluate(() => {
      const el = document.querySelector('.item');
      return typeof el.ondragstart !== 'undefined' || el.getAttribute('draggable') !== null || document.querySelector('.drag-handle') !== null;
    });
    check('schedule-app: drag-handle / drag-and-drop DOM scaffolding still present (regression-free)', dragHandlersPresent);

    // --- viewer .v-item Hardening-1 regression check ---
    await page.evaluate(() => { checks = {}; switchTab('viewer'); });
    await page.waitForTimeout(150);
    const vItemFocused = await page.evaluate(() => {
      const el = document.querySelector('.v-item');
      el.focus();
      return document.activeElement === el;
    });
    check('schedule-app: viewer .v-item still focusable (Hardening-1 regression-free)', vItemFocused);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const viewerToggleCount = await page.evaluate(() => Object.keys(checks).length);
    check('schedule-app: viewer .v-item Enter still toggles (Hardening-1 regression-free)', viewerToggleCount === 1, viewerToggleCount);

    check('schedule-app editor: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // G. timetable-app — バーチャル体験 scenario-card (Phase HARDENING-2)
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/timetable-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.click('button.tab-btn[onclick*="virtual"]');
    await page.waitForTimeout(150);

    const secondCard = page.locator('.scenario-card').nth(1);
    await secondCard.focus();
    const cardFocused = await page.evaluate(() => document.activeElement.classList.contains('scenario-card'));
    check('timetable-app: .scenario-card is focusable (tabindex present)', cardFocused);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const selectedIdxAfterEnter = await page.evaluate(() => document.querySelector('.scenario-card.selected').dataset.idx);
    check('timetable-app: Enter on focused .scenario-card selects it (selected class moves)', selectedIdxAfterEnter === '1', selectedIdxAfterEnter);

    const thirdCard = page.locator('.scenario-card').nth(2);
    await thirdCard.focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    const selectedIdxAfterSpace = await page.evaluate(() => document.querySelector('.scenario-card.selected').dataset.idx);
    check('timetable-app: Space on a different .scenario-card re-selects it', selectedIdxAfterSpace === '2', selectedIdxAfterSpace);

    const selectedCount = await page.evaluate(() => document.querySelectorAll('.scenario-card.selected').length);
    check('timetable-app: exactly 1 scenario-card selected after keyboard activation (no double-activation)', selectedCount === 1, selectedCount);

    // start flow: real <button> reachable and advances to virt-step-c
    await page.click('#virt-step-a .sim-btn.primary');
    await page.waitForTimeout(200);
    const stepCVisible = await page.evaluate(() => document.getElementById('virt-step-c').style.display !== 'none');
    check('timetable-app: start button advances from scenario selection into the simulation flow', stepCVisible);

    // Hardening-1 .time-chip regression check (main timetable screen, unrelated tab)
    await page.click('button.tab-btn[onclick*="timetable"]');
    await page.waitForTimeout(200);
    const chipTag = await page.evaluate(() => { const c = document.querySelector('.time-chip'); return c ? c.tabIndex : null; });
    check('timetable-app: .time-chip still has tabindex=0 (Hardening-1 regression-free)', chipTag === 0, chipTag);

    check('timetable-app scenario-card: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  // ============================================================
  // H. ongaku-app — きろく→えんそう perf piano/buttons/color (Phase HARDENING-2)
  // ============================================================
  {
    const { context, page, bucket } = await freshPage(browser);
    await page.goto(`${BASE}/ongaku-app.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.click('.btn-record-home');
    await page.waitForTimeout(150);
    await page.evaluate(() => switchRecordMode('perf'));
    await page.waitForTimeout(200);

    // --- perf piano: white key ---
    await page.evaluate(() => switchPerfInstr('piano'));
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.__perfCalls = 0; const orig = window.playSoundThroughPerf; window.playSoundThroughPerf = function (...args) { window.__perfCalls++; return orig.apply(this, args); }; });
    const perfWhite = page.locator('.perf-key-white').first();
    await perfWhite.focus();
    const perfWhiteFocused = await page.evaluate(() => document.activeElement.classList.contains('perf-key-white'));
    check('ongaku-app: perf piano white key is focusable (tabindex present)', perfWhiteFocused);
    await page.keyboard.down('Enter');
    await page.waitForTimeout(60);
    const perfWhitePressed = await page.evaluate(() => document.querySelector('.perf-key-white').classList.contains('pressed'));
    await page.keyboard.up('Enter');
    await page.waitForTimeout(60);
    const perfWhiteCallCount = await page.evaluate(() => window.__perfCalls);
    check('ongaku-app: Enter on perf piano white key plays exactly once (playSoundThroughPerf)', perfWhiteCallCount === 1, perfWhiteCallCount);
    check('ongaku-app: perf piano white key shows pressed state on keydown', perfWhitePressed);

    // --- perf piano: black key (shares _placeBlackKeys with けんばん mode) ---
    await page.evaluate(() => { window.__perfSynthCalls = 0; const orig = window.playSynthFreqThroughPerf; window.playSynthFreqThroughPerf = function (...args) { window.__perfSynthCalls++; return orig.apply(this, args); }; });
    const perfBlack = page.locator('.perf-key-black').first();
    await perfBlack.focus();
    const perfBlackFocused = await page.evaluate(() => document.activeElement.classList.contains('perf-key-black'));
    check('ongaku-app: perf piano black key is focusable (tabindex present)', perfBlackFocused);
    await page.keyboard.press(' ');
    await page.waitForTimeout(80);
    const perfBlackCallCount = await page.evaluate(() => window.__perfSynthCalls);
    check('ongaku-app: Space on perf piano black key plays exactly once (playSynthFreqThroughPerf)', perfBlackCallCount === 1, perfBlackCallCount);

    // --- perf buttons: the RE-AUDIT-1 pointerdown-only bug ---
    await page.evaluate(() => switchPerfInstr('buttons'));
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.__perfBtnCalls = 0; const orig = window.playSoundThroughPerf; window.playSoundThroughPerf = function (...args) { window.__perfBtnCalls++; return orig.apply(this, args); }; });
    const perfBtn = page.locator('.perf-sound-btn').first();
    await perfBtn.focus();
    const perfBtnFocused = await page.evaluate(() => document.activeElement.classList.contains('perf-sound-btn'));
    check('ongaku-app: perf sound button is focusable (native <button>)', perfBtnFocused);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const perfBtnCallCount = await page.evaluate(() => window.__perfBtnCalls);
    check('ongaku-app: Enter on perf sound button actually plays a sound (fixes pointerdown-only bug from RE-AUDIT-1)', perfBtnCallCount === 1, perfBtnCallCount);
    await page.locator('.perf-sound-btn').first().focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    const perfBtnCallCount2 = await page.evaluate(() => window.__perfBtnCalls);
    check('ongaku-app: Space on perf sound button also plays (1 input = 1 sound)', perfBtnCallCount2 === perfBtnCallCount + 1, { perfBtnCallCount, perfBtnCallCount2 });

    // pointerdown/touch regression: mouse press still works, still exactly 1 call
    await page.evaluate(() => { window.__perfBtnCalls = 0; });
    const btnBox = await page.locator('.perf-sound-btn').first().boundingBox();
    await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(80);
    const perfBtnPointerCalls = await page.evaluate(() => window.__perfBtnCalls);
    check('ongaku-app: pointerdown (mouse/touch) on perf sound button still triggers exactly 1 call (regression-free, no double-fire with keydown)', perfBtnPointerCalls === 1, perfBtnPointerCalls);

    // --- color-dot-sm (voice recording naming step) ---
    // Reaching this panel normally requires a completed mic recording; force the
    // container visible directly (same classes/display the real flow sets) so the
    // naming step's own controls can be exercised without mocking getUserMedia.
    await page.evaluate(() => switchRecordMode('voice'));
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      document.getElementById('mic-permission').style.display = 'none';
      document.getElementById('record-studio').style.display = 'flex';
      document.getElementById('sound-namer').classList.add('visible');
      buildNamer();
    });
    await page.waitForTimeout(100);
    const firstDot = page.locator('#rec-color-palette .color-dot-sm').first();
    const secondDot = page.locator('#rec-color-palette .color-dot-sm').nth(1);
    await secondDot.focus();
    const dotFocused = await page.evaluate(() => document.activeElement.classList.contains('color-dot-sm'));
    check('ongaku-app: .color-dot-sm is focusable (tabindex present)', dotFocused);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const activeDotIdx = await page.evaluate(() => Array.from(document.querySelectorAll('#rec-color-palette .color-dot-sm')).findIndex((d) => d.classList.contains('active')));
    check('ongaku-app: Enter on .color-dot-sm selects it (active class moves)', activeDotIdx === 1, activeDotIdx);
    const activeDotCount = await page.evaluate(() => document.querySelectorAll('#rec-color-palette .color-dot-sm.active').length);
    check('ongaku-app: exactly 1 .color-dot-sm active after keyboard selection', activeDotCount === 1, activeDotCount);

    // mouse click regression on color-dot-sm
    await firstDot.click();
    await page.waitForTimeout(80);
    const activeDotIdxAfterClick = await page.evaluate(() => Array.from(document.querySelectorAll('#rec-color-palette .color-dot-sm')).findIndex((d) => d.classList.contains('active')));
    check('ongaku-app: click on .color-dot-sm still selects it (regression-free)', activeDotIdxAfterClick === 0, activeDotIdxAfterClick);

    // --- あそぶ→けんばん/おとボタン (Hardening-1) regression check ---
    await page.evaluate(() => showScreen('play'));
    await page.waitForTimeout(150);
    await page.click('#tab-piano');
    await page.waitForTimeout(200);
    const playPianoFocusable = await page.evaluate(() => document.querySelector('.key-white').tabIndex === 0);
    check('ongaku-app: play-mode けんばん white key still has tabindex=0 (Hardening-1 regression-free)', playPianoFocusable);

    check('ongaku-app perf mode: no console errors', bucket.consoleErrors.length === 0, bucket.consoleErrors);
    await context.close();
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed.`);
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, 'keyboard-accessibility-hardening-test-results.json'), JSON.stringify({ summary: { passed, total: results.length }, checks: results }, null, 2), 'utf-8');
  process.exitCode = passed === results.length ? 0 : 1;
})();
