// Playwright test for cashless-app.html (Phase 1 + 2-device reading with real codes).
// Pinned timezone/locale; the clock is frozen except in the camera sections (the camera
// is replaced by a canvas stream that shows a QR code, so the real getUserMedia -> video
// -> canvas -> jsQR path of the app runs end to end, deterministically).
// usage (from the repository root): node tools/cashless-app-poc/cashless-app-test.js
//   (needs the `playwright` package and its Chromium; e.g. NODE_PATH="$(npm root -g)")
// Headless Chromium only: not a real-device result (iPad Safari, real cameras, two devices,
// printed cards, switch / gaze are the user's Real Device Gate).
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const APP = 'file://' + path.join(ROOT, 'cashless-app.html');
const RECORDS = 'file://' + path.join(ROOT, 'learning-records.html');
const FIXED = new Date('2026-11-23T10:00:00+09:00');
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('  [OK  ] ' + name); } else { fail++; console.log('  [FAIL] ' + name + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); } }

async function newPage(browser, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: opts.viewport || { width: 1024, height: 768 }, reducedMotion: opts.reducedMotion || 'no-preference', acceptDownloads: true });
  const page = await ctx.newPage();
  if (!opts.realClock) await page.clock.install({ time: FIXED });
  if (opts.fakeCam) await page.addInitScript(FAKE_CAM);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}
const state = p => p.evaluate(() => window.cashlessTest.state());
const log = p => p.evaluate(() => JSON.parse(localStorage.getItem('cashless_log') || '[]'));
// a camera that shows whatever QR text the test asks for (canvas.captureStream)
const FAKE_CAM = `(() => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 480;
  const x = c.getContext('2d'); let text = null, tick = 0;
  function draw() {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 480, 480);
    if (text !== null && window.qrcode) {
      const q = window.qrcode(0, 'M'); q.addData(text); q.make();
      const n = q.getModuleCount(), cell = Math.floor(400 / (n + 8)), off = Math.floor((480 - cell * n) / 2);
      x.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(off + k * cell, off + r * cell, cell, cell);
    }
    x.fillStyle = (tick++ % 2) ? '#fefefe' : '#fff'; x.fillRect(0, 0, 2, 2);   // keep frames coming
  }
  setInterval(draw, 80);
  window.__cam = { calls: 0, mode: 'ok', streams: [], show(t) { text = t; }, blank() { text = null; } };
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = (constraints) => {
    window.__cam.calls++; window.__cam.constraints = constraints;
    const m = window.__cam.mode;
    if (m === 'denied') return Promise.reject(new DOMException('denied', 'NotAllowedError'));
    if (m === 'nocamera') return Promise.reject(new DOMException('none', 'NotFoundError'));
    const st = c.captureStream(15); window.__cam.streams.push(st); return Promise.resolve(st);
  };
})();`;
// decode the QR drawn inside `selector` with the app's own jsQR (SVG -> image -> canvas -> jsQR)
async function decodeQr(p, selector) {
  return p.evaluate(async (sel) => {
    const svg = document.querySelector(sel + ' svg'); if (!svg) return null;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
    const c = document.createElement('canvas'); c.width = c.height = 420;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 420, 420); x.drawImage(img, 0, 0, 420, 420);
    const d = x.getImageData(0, 0, 420, 420); const r = jsQR(d.data, 420, 420);
    return r ? r.data : null;
  }, selector);
}
async function back(p, scr) { await p.waitForTimeout(400); await p.evaluate(sel => document.querySelector(sel + ' [data-back]').click(), scr); await p.waitForTimeout(50); }
const camText = (p, id) => p.textContent('#' + id);
async function waitText(p, id, re) { await p.waitForFunction(([i, src]) => new RegExp(src).test(document.getElementById(i).textContent), [id, re.source], { timeout: 8000 }); }
async function setSettings(p, fn) { await settings(p); await fn(); await closeSettings(p); }
async function waitScreen(p, name) {
  try { await p.waitForFunction(n => window.cashlessTest.state().screen === n, name, { timeout: 8000 }); }
  catch (e) { throw new Error('waitScreen(' + name + ') timed out; state=' + JSON.stringify(await p.evaluate(() => window.cashlessTest.state()))); }
}
async function tap(p, sel) { await p.waitForTimeout(400); await p.click(sel); }
async function settings(p) { await p.evaluate(() => document.getElementById('cashlessSettingsBtn').click()); await p.waitForTimeout(50); }
async function closeSettings(p) { await p.click('#settingsClose'); await p.waitForTimeout(450); }
async function typeAmount(p, n) { for (const d of String(n)) await tap(p, `#qrKeypad [data-key="${d}"]`); }

(async () => {
  const browser = await chromium.launch();

  console.log('\n=== 1. load / home ===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    const s = await state(page);
    check('home is shown', s.screen === 'home', s);
    check('default balance is 1,000 (normal)', s.balance === 1000, s);
    check('balance bar shows 1,000えん', (await page.textContent('#balanceValue')) === '1,000えん');
    check('exactly one h1', (await page.$$eval('h1', a => a.length)) === 1);
    check('common chrome injected (home / a11y / lock / record nav)', await page.evaluate(() => !!(document.getElementById('donomanaHomeBtn') && document.getElementById('donomanaA11yBtn') && document.getElementById('donomanaLockBtn') && document.getElementById('donomanaRecordNavBtn'))));
    check('Learning Record Foundation present', await page.evaluate(() => typeof donomanaRecordCreate === 'function' && typeof donomanaRecordAddLog === 'function'));
    check('Gaze Shared Foundation present', await page.evaluate(() => typeof hitTestGazeTargets === 'function' && DWELL_MIN_MS === 300 && DWELL_MAX_MS === 3000));
    check('home: barcode, QR, とりひきりれき, おみせの ひとに なる (no experience 3/4 buttons yet)', (await page.$$('#scrHome button')).length === 4);
    check('label is とりひきりれき; no visible「れきし」anywhere', (await page.textContent('#goHistory')).includes('とりひきりれき') && !(await page.evaluate(() => document.getElementById('app').textContent + document.getElementById('settingsSheet').textContent + document.getElementById('helpSheet').textContent)).includes('れきし'));
    { const src = fs.readFileSync(path.join(ROOT, 'cashless-app.html'), 'utf8');
      check('camera is read-only: one getUserMedia call site, no recording / upload / network API', (src.match(/getUserMedia\(\{/g) || []).length === 1 && !/MediaRecorder|toDataURL|toBlob|XMLHttpRequest|sendBeacon|WebSocket|RTCPeerConnection|new Peer\(|\bfetch\(/.test(src));
      check('QR libraries are the vendored local files (no CDN)', src.includes('<script src="assets/js/vendor/qrcode-generator/qrcode.js"></script>') && src.includes('<script src="assets/js/vendor/jsqr/jsQR.js"></script>') && !/<script[^>]+src="https?:/.test(src)); }
    check('vendored libraries loaded', await page.evaluate(() => typeof qrcode === 'function' && typeof jsQR === 'function'));
    check('no runtime errors on load', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 2. 体験1 バーコード（正常系・残高不足で選び直し）===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await tap(page, '#goBarcode'); await waitScreen(page, 'bc-items');
    const cards = await page.$$('#bcItemGrid .item-card');
    check('6 item cards (normal)', cards.length === 6, cards.length);
    await tap(page, '#bcItemGrid .item-card:nth-child(2)'); // おにぎり 140
    await waitScreen(page, 'bc-confirm');
    check('confirm shows price 140えん', (await page.textContent('#bcPrice')) === '140えん');
    check('confirm shows shop name', (await page.textContent('#bcShopName')) === 'まちの おみせ');
    check('confirm shows current balance', (await page.textContent('#bcBalanceNow')) === '1,000えん');
    check('balance unchanged before paying', (await state(page)).balance === 1000);
    await tap(page, '#bcShowCode'); await waitScreen(page, 'bc-code');
    const num = await page.textContent('#barcodeNumber');
    check('barcode number shows the practice prefix (DMC1, never digits only)', /れんしゅう DMC1 /.test(num) && !/^[0-9 ]+$/.test(num), num);
    { const st = await state(page); check('payer QR is a real code: DMCASH1:P:<amount>:<txn>', (await decodeQr(page, '#payQrArt')) === 'DMCASH1:P:140:' + st.flow.txn && /^[0-9]{6}$/.test(st.flow.txn), st.flow); }
    check('1 device (default): only「おみせに みせる」', await page.isVisible('#bcPresent') && await page.isHidden('#bcDoneA1') && await page.isHidden('#bcScanR'));
    check('barcode svg drawn', (await page.$$('#barcodeArt svg rect')).length > 20);
    await tap(page, '#bcPresent'); await waitScreen(page, 'bc-reading');
    check('reading screen has no back button (automatic)', (await page.$$('#scrBcReading [data-back]')).length === 0);
    await page.clock.runFor(3000);
    await waitScreen(page, 'done');
    let s = await state(page);
    check('balance went down to 860', s.balance === 860, s);
    check('done shows paid and left', (await page.textContent('#donePaid')) === '140えん' && (await page.textContent('#doneLeft')) === '860えん');
    await tap(page, '#doneReceipt'); await waitScreen(page, 'receipt');
    const rc = await page.textContent('#receiptBox');
    check('receipt shows item, amount, before/after, practice tag', /おにぎり/.test(rc) && /140えん/.test(rc) && /1,000えん/.test(rc) && /860えん/.test(rc) && /れんしゅうよう/.test(rc), rc);
    check('receipt date uses the frozen clock (11/23 10:0x)', /11\/23 10:0/.test(rc), rc);
    await tap(page, '#receiptHome'); await waitScreen(page, 'home');
    let L = await log(page);
    check('1 learning record', L.length === 1, L.length);
    check('record: Core Schema', L[0].appId === 'cashless-app' && L[0].activity === 'cashless-barcode' && L[0].schemaVersion === 1 && typeof L[0].timestamp === 'string', L[0]);
    check('record payload: amount/balance/result', L[0].payload.amount === 140 && L[0].payload.balanceBefore === 1000 && L[0].payload.balanceAfter === 860 && L[0].payload.result === 'completed' && L[0].payload.shortfallRetries === 0, L[0].payload);
    check('record inputMethod from the real event (mouse click → click)', L[0].inputMethod === 'click', L[0].inputMethod);

    // shortage: 980 > 860 → back to items with the reason, then choose again
    await tap(page, '#goBarcode'); await waitScreen(page, 'bc-items');
    await tap(page, '#bcItemGrid .item-card:nth-child(6)'); // ぼうし 980
    await waitScreen(page, 'bc-confirm');
    await tap(page, '#bcShowCode');
    await waitScreen(page, 'bc-items');
    check('shortage notice shown on the item screen', await page.isVisible('#bcShortNotice') && /たりません/.test(await page.textContent('#bcShortNotice')));
    check('balance unchanged after shortage', (await state(page)).balance === 860);
    await tap(page, '#bcItemGrid .item-card:nth-child(1)'); // あめ 60
    await waitScreen(page, 'bc-confirm');
    await tap(page, '#bcShowCode'); await waitScreen(page, 'bc-code');
    await tap(page, '#bcPresent'); await page.clock.runFor(3000); await waitScreen(page, 'done');
    s = await state(page);
    check('balance 800 after choosing again', s.balance === 800, s);
    L = await log(page);
    check('record counts the shortfall retry', L.length === 2 && L[1].payload.shortfallRetries === 1 && L[1].payload.amount === 60, L[1] && L[1].payload);
    await tap(page, '#doneHome'); await tap(page, '#goHistory'); await waitScreen(page, 'history');
    const hist = await page.$$eval('#historyList li', a => a.map(x => x.textContent));
    check('とりひきりれき has 2 entries, newest first', hist.length === 2 && /あめ/.test(hist[0]) && /おにぎり/.test(hist[1]), hist);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 3. 体験2 QR（正常系・金額の入れ直し・残高不足）===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await tap(page, '#goQr'); await waitScreen(page, 'qr-shop');
    { const st = await state(page); const txt = await decodeQr(page, '#scrQrShop .qr-stand'); const c = await page.evaluate(t => window.cashlessTest.parseCode(t), txt);
      check('virtual stand shows a real shop code (S) with this shop and amount', !!c && c.type === 'S' && c.amount === st.flow.requested && txt === 'DMCASH1:S:' + c.shopId + ':' + st.flow.requested + ':' + st.flow.txn, { txt, flow: st.flow }); }
    await tap(page, '#qrRead'); await waitScreen(page, 'qr-scan');
    await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
    let s = await state(page);
    check('requested amount within normal range and balance', s.flow.requested >= 100 && s.flow.requested <= 999 && s.flow.requested <= 1000, s.flow);
    check('shop name shown on amount screen', (await page.textContent('#qrAmtShop')) === s.flow.readShop);
    check('つぎへ disabled while empty', await page.isDisabled('#qrKeypad [data-key="done"]'));
    await typeAmount(page, 9999);
    check('normal: 3 digits max', (await page.textContent('#qrAmountDisplay')).replace(/[^0-9]/g, '') === '999');
    await tap(page, '#qrKeypad [data-key="del"]'); await tap(page, '#qrKeypad [data-key="del"]'); await tap(page, '#qrKeypad [data-key="del"]');
    check('けす clears digits', /すうじを おしてね/.test(await page.textContent('#qrAmountDisplay')));
    // wrong amount first
    const wrong = s.flow.requested === 990 ? 980 : s.flow.requested + 10;
    await typeAmount(page, wrong); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
    await tap(page, '#qrPay');
    check('wrong amount is not paid; gentle notice', (await state(page)).screen === 'qr-confirm' && (await state(page)).balance === 1000 && /いわれた きんがく/.test(await page.textContent('#qrConfirmNotice')));
    await tap(page, '#qrFix'); await waitScreen(page, 'qr-amount');
    await typeAmount(page, s.flow.requested); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
    check('confirm shows shop and amount', (await page.textContent('#qrConfShop')) === s.flow.readShop && (await page.textContent('#qrConfAmount')) === s.flow.requested.toLocaleString('ja-JP') + 'えん');
    await tap(page, '#qrPay'); await waitScreen(page, 'done');
    let s2 = await state(page);
    check('balance decreased by the requested amount', s2.balance === 1000 - s.flow.requested, { s2, req: s.flow.requested });
    let L = await log(page);
    check('QR record with amountRetries 1', L.length === 1 && L[0].activity === 'cashless-qr' && L[0].payload.amountRetries === 1 && L[0].payload.amount === s.flow.requested && L[0].payload.shop === s.flow.readShop, L[0]);

    // shortage: type more than the balance → back to the amount input
    await tap(page, '#doneHome'); await waitScreen(page, 'home');
    await tap(page, '#goQr'); await tap(page, '#qrRead'); await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
    const bal = (await state(page)).balance, req = (await state(page)).flow.requested;
    if (bal < 999) {
      await typeAmount(page, 999); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
      await tap(page, '#qrPay'); await waitScreen(page, 'qr-amount');
      check('shortage → back to the amount input with the reason', /たりません/.test(await page.textContent('#qrAmountNotice')) && (await state(page)).balance === bal);
      await typeAmount(page, req); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
      await tap(page, '#qrPay'); await waitScreen(page, 'done');
      L = await log(page);
      check('record counts the shortfall retry (QR)', L.length === 2 && L[1].payload.shortfallRetries === 1, L[1] && L[1].payload);
    } else { check('shortage scenario prepared', false, { bal }); }
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 4. やさしい（金額ボタン）・むずかしい（4けた）・かくにんの れんしゅう ===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await settings(page);
    await page.click('[data-level="easy"]');
    await page.click('#resetBtn'); await page.click('#resetYes');
    await closeSettings(page);
    check('easy + もとに もどす (auto) → balance 500', (await state(page)).balance === 500);
    await tap(page, '#goQr'); await tap(page, '#qrRead'); await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
    check('easy: keypad hidden, 3 amount buttons', await page.isHidden('#qrKeypadArea') && (await page.$$('#qrChoices button')).length === 3);
    const req = (await state(page)).flow.requested;
    check('easy amount ≤ 500', req <= 500, req);
    const btns = await page.$$('#qrChoices button');
    for (const b of btns) { if ((await b.textContent()) === req.toLocaleString('ja-JP') + 'えん') { await page.waitForTimeout(400); await b.click(); break; } }
    await waitScreen(page, 'qr-confirm'); await tap(page, '#qrPay'); await waitScreen(page, 'done');
    check('easy paid', (await state(page)).balance === 500 - req);

    await settings(page);
    await page.click('[data-level="hard"]'); await page.click('[data-start="10000"]'); await page.click('[data-check="on"]');
    await page.click('#resetBtn'); await page.click('#resetYes');
    await closeSettings(page);
    check('hard + 10,000 → balance 10000', (await state(page)).balance === 10000);
    // find a run where the stand next door was read
    let found = false;
    for (let i = 0; i < 25 && !found; i++) {
      await page.evaluate(() => document.getElementById('donomanaHomeBtn') && 0);
      if ((await state(page)).screen !== 'home') { await page.evaluate(() => { const b = document.querySelector('#' + document.querySelector('.screen:not([hidden])').id + ' [data-back="home"]'); if (b) b.click(); }); }
      await page.waitForTimeout(400);
      if ((await state(page)).screen !== 'home') await page.goto(APP);
      await tap(page, '#goQr'); await tap(page, '#qrRead'); await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
      const st = await state(page);
      if (st.flow.readShop !== st.flow.shop) {
        found = true;
        await typeAmount(page, 12345);
        check('hard: 4 digits max', (await page.textContent('#qrAmountDisplay')).replace(/[^0-9]/g, '') === '1234');
        for (let k = 0; k < 4; k++) await tap(page, '#qrKeypad [data-key="del"]');
        await typeAmount(page, st.flow.requested); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
        await tap(page, '#qrPay');
        check('wrong shop: not paid, notice names the real shop', (await state(page)).balance === 10000 && (await page.textContent('#qrConfirmNotice')).includes(st.flow.shop));
        await tap(page, '#qrFix'); await waitScreen(page, 'qr-shop');
        check('なおす on a wrong shop → read the QR again (praise)', /よく きづいたね/.test(await page.textContent('#qrShopNotice')));
        await tap(page, '#qrRead'); await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
        const st2 = await state(page);
        check('second read is the right shop', st2.flow.readShop === st2.flow.shop, st2.flow);
        await typeAmount(page, st2.flow.requested); await tap(page, '#qrKeypad [data-key="done"]'); await waitScreen(page, 'qr-confirm');
        await tap(page, '#qrPay'); await waitScreen(page, 'done');
        const L = await log(page);
        const last = L[L.length - 1];
        check('record: wrongShopShown + 1 pay attempt + hard', last.payload.wrongShopShown === true && last.payload.wrongShopPayAttempts === 1 && last.payload.level === 'hard' && last.payload.checkPractice === true, last.payload);
      }
    }
    check('wrong-shop practice appeared within 25 tries', found);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 5. スイッチスキャン（Space だけで 体験1 を最後まで）===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await settings(page); await page.click('[data-scan-on="1"]'); await closeSettings(page);
    await page.clock.runFor(300);
    const items = await page.evaluate(() => window.cashlessScan.buildScanItems().map(b => b.id || b.className));
    check('home scan items: barcode, QR, history, shop mode, balance voice (no common chrome)', JSON.stringify(items) === JSON.stringify(['goBarcode', 'goQr', 'goHistory', 'goShopMode', 'balanceSpeakBtn']), items);
    async function press() { await page.waitForTimeout(400); await page.keyboard.press('Space'); await page.clock.runFor(300); }
    await press(); await waitScreen(page, 'bc-items');
    await press(); await waitScreen(page, 'bc-confirm');
    const firstConfirm = await page.evaluate(() => window.cashlessScan.buildScanItems()[0].id);
    check('confirm: main action highlighted first', firstConfirm === 'bcShowCode', firstConfirm);
    await press(); await waitScreen(page, 'bc-code');
    await press(); await page.clock.runFor(3000); await waitScreen(page, 'done');
    const L = await log(page);
    check('paid via switch; inputMethod switch; switchScan true', L.length === 1 && L[0].inputMethod === 'switch' && L[0].payload.switchScan === true, L[0]);
    await page.clock.runFor(2600);
    check('auto scan moves the highlight', await page.evaluate(() => document.querySelectorAll('.scan-focus').length === 1 && document.activeElement.id === 'doneHome'));
    check('settings persisted (scanOn)', await page.evaluate(() => JSON.parse(localStorage.getItem('donomana-cashless-settings-v1')).scanOn === true));
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 6. 視線入力（ドウェル）===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await settings(page); await page.click('[data-gaze="1"]');
    check('dwell stepper default 0.9秒', (await page.textContent('#dwellVal')) === '0.9秒');
    await closeSettings(page);
    const box = await page.locator('#goBarcode').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.clock.runFor(300);
    check('dwell ring shown while looking', await page.evaluate(() => document.getElementById('goBarcode').classList.contains('gaze-dwell')));
    check('not activated before the dwell time', (await state(page)).screen === 'home');
    await page.clock.runFor(900);
    await waitScreen(page, 'bc-items');
    check('activated by dwell (still pointer)', true);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 7. 設定・つかいかた・永続化 ===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await tap(page, '#goBarcode'); await tap(page, '#bcItemGrid .item-card:nth-child(1)'); await tap(page, '#bcShowCode'); await tap(page, '#bcPresent'); await page.clock.runFor(3000); await waitScreen(page, 'done');
    await page.reload();
    check('balance persists after reload', (await state(page)).balance === 940);
    await page.click('#donomanaHelpBtn');
    check('help opens as a non-modal panel; stage inert', await page.isVisible('#helpSheet') && await page.evaluate(() => document.getElementById('stage').hasAttribute('inert') && !document.getElementById('helpSheet').hasAttribute('role')));
    await page.keyboard.press('Escape');
    check('Esc closes help, focus back to ❓', await page.isHidden('#helpSheet') && await page.evaluate(() => document.activeElement.id === 'donomanaHelpBtn'));
    await page.click('#donomanaA11yBtn');
    const proxy = await page.$('#donomanaA11yPanel button:has-text("このアプリの詳細設定を開く")');
    check('common A11y panel has the settings proxy', !!proxy);
    if (proxy) { await proxy.click(); }
    check('settings open via the proxy', await page.isVisible('#settingsSheet'));
    check('no common 選択読み上げ section (SR_SKIP)', !(await page.$('[data-a11y-sr]')));
    await page.click('#resetBtn');
    check('reset needs a second step', await page.isVisible('#resetConfirm'));
    await page.click('#resetCancel');
    check('cancel keeps the balance', (await state(page)).balance === 940);
    await page.click('#resetBtn'); await page.click('#resetYes');
    check('reset → 1,000 and とりひきりれき cleared, record kept', (await state(page)).balance === 1000 && (await state(page)).history === 0 && (await log(page)).length === 1);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 8. 学習のきろく（共通画面）と CSV ===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    await tap(page, '#goBarcode'); await tap(page, '#bcItemGrid .item-card:nth-child(2)'); await tap(page, '#bcShowCode'); await tap(page, '#bcPresent'); await page.clock.runFor(3000); await waitScreen(page, 'done');
    await page.goto(RECORDS);
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    check('learning-records shows キャッシュレス', body.includes('キャッシュレス'));
    check('activity label mapped', body.includes('バーコードで はらう'));
    check('summary text', body.includes('バーコードで 140円 はらいました'));
    const dl = page.waitForEvent('download');
    await page.click('#csv-export-btn');
    const d = await dl; const p = await d.path(); const csv = fs.readFileSync(p, 'utf8');
    check('CSV contains the cashless row', /キャッシュレス/.test(csv) && /自立活動/.test(csv) && /140円/.test(csv), csv.slice(0, 400));
    check('no runtime errors on records page', errors.filter(e => !/favicon|net::ERR_FILE_NOT_FOUND/.test(e)).length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 9. 部品・ダミー表示・レイアウト ===');
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 375, height: 667 } });
    await page.goto(APP);
    check('375px: no horizontal scroll (home)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await tap(page, '#goQr'); await tap(page, '#qrRead'); await tap(page, '#qrAlign'); await page.clock.runFor(2000); await waitScreen(page, 'qr-amount');
    check('375px: no horizontal scroll (keypad)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const minKey = await page.$$eval('#qrKeypad button', bs => Math.min.apply(null, bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))));
    check('keypad keys ≥ 60px', minKey >= 60, minKey);
    const boxes = await page.evaluate(() => {
      const c = document.createElement('div'), d = document.createElement('div'); document.body.appendChild(d); document.body.appendChild(c);
      const k = window.cashlessTest.createKeypad({ container: c, display: d, maxDigits: 4, mode: 'boxes', doneLabel: 'きめる' });
      ['1', '2', '3', '4', '5'].forEach(x => c.querySelector('[data-key="' + x + '"]').click());
      const r = { value: k.value(), boxes: d.querySelectorAll('.digit-box').length, done: c.querySelector('[data-key="done"]').textContent };
      c.remove(); d.remove(); return r;
    });
    check('keypad boxes mode (for Phase 2): 4 boxes, 4 digits max, custom done label', boxes.value === '1234' && boxes.boxes === 4 && boxes.done === 'きめる', boxes);
    const c128 = await page.evaluate(() => { const T = window.cashlessTest; const d = T.barDigits(480, '123456'); const sy = T.code128Symbols('DMC1', d); return { d, sy, mods: T.code128Modules(sy), svg: T.barcodeSVG(480, '123456', 100) }; });
    { const body = [104, 36, 45, 35, 17, 99, 10, 4, 80, 12, 34, 56]; let sum = body[0]; for (let i = 1; i < body.length; i++) sum += body[i] * i;
      check('Code128: digits = kind 1 + amount 5 + txn 6', c128.d === '100480123456', c128.d);
      check('Code128: symbols (Start B, D M C 1, Code C, 6 pairs), check symbol (mod 103) and Stop', JSON.stringify(c128.sy) === JSON.stringify(body.concat([sum % 103, 106])), c128.sy);
      check('Code128: 156 modules, starts with Start B and ends with Stop', c128.mods.length === 156 && c128.mods.startsWith('11010010000') && c128.mods.endsWith('1100011101011'), c128.mods.length);
      check('barcode svg has a quiet zone (10 modules each side)', c128.svg.includes('viewBox="0 0 176 100"')); }
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }


  console.log('\n=== 10. コード形式（往復・検証）===');
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(APP);
    const rt = await page.evaluate(() => {
      const T = window.cashlessTest, out = [];
      const cases = [['P', { amount: 480, txn: '004711' }], ['S', { shopId: 3, amount: 490, txn: '913542' }], ['S', { shopId: 5, amount: null, txn: '000000' }], ['R', { amount: 9999, txn: '999999' }]];
      const holder = document.createElement('div'); holder.id = 'rtHolder'; document.body.appendChild(holder);
      return cases.map(([t, o]) => ({ t, o, text: T.buildCode(t, o), parsed: T.parseCode(T.buildCode(t, o)) }));
    });
    check('build: P / S / S without amount / R', JSON.stringify(rt.map(r => r.text)) === JSON.stringify(['DMCASH1:P:480:004711', 'DMCASH1:S:3:490:913542', 'DMCASH1:S:5::000000', 'DMCASH1:R:9999:999999']), rt.map(r => r.text));
    check('parse(build(x)) keeps type / amount / txn / shop', rt.every(r => r.parsed && r.parsed.type === r.t && r.parsed.amount === (r.o.amount === undefined ? null : r.o.amount) && r.parsed.txn === r.o.txn && r.parsed.shopId === (r.o.shopId || null)), rt);
    for (const r of rt) {
      await page.evaluate(t => { document.getElementById('rtHolder').innerHTML = window.cashlessTest.qrSVG(t); }, r.text);
      check('QR round trip (generate -> image -> jsQR): ' + r.text, (await decodeQr(page, '#rtHolder')) === r.text);
    }
    const bad = ['', 'HELLO', 'DMREG1:abc', 'DMCASH2:P:480:004711', 'dmcash1:P:480:004711', 'DMCASH1:P:480', 'DMCASH1:P:480:004711:9', 'DMCASH1:P:0:004711', 'DMCASH1:P:10000:004711', 'DMCASH1:P:04:004711', 'DMCASH1:P:4a:004711', 'DMCASH1:P:480:4711', 'DMCASH1:P:480:00471a', 'DMCASH1:S:6:490:913542', 'DMCASH1:S:0:490:913542', 'DMCASH1:S:3:490', 'DMCASH1:X:480:004711', 'DMCASH1:R:480:004711:1', '000201010212', 'DMCASH1:P:' + '9'.repeat(80)];
    const res = await page.evaluate(list => list.map(t => window.cashlessTest.parseCode(t)).concat([window.cashlessTest.parseCode(null), window.cashlessTest.parseCode(42)]), bad);
    check('invalid codes are refused (prefix, item count, amount range, shop number, txn, non-strings)', res.every(x => x === null), res);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 11. 体験1 2台（おみせモード・カメラ・A1/A2・二重受け取り）===');
  {
    const { ctx, page: payer, errors } = await newPage(browser, { realClock: true, fakeCam: true });
    const shop = await ctx.newPage(); await shop.addInitScript(FAKE_CAM);
    const shopErrors = []; shop.on('pageerror', e => shopErrors.push(String(e)));
    await payer.goto(APP);
    await setSettings(payer, () => payer.click('[data-devices="two"]'));
    check('setting saved: devices two', await payer.evaluate(() => JSON.parse(localStorage.getItem('donomana-cashless-settings-v1')).devices === 'two'));
    // payer shows the code
    await tap(payer, '#goBarcode'); await tap(payer, '#bcItemGrid .item-card:nth-child(2)'); await tap(payer, '#bcShowCode'); await waitScreen(payer, 'bc-code');
    check('2 devices: かんりょう (A1) and しるしを よむ (A2); no virtual button', await payer.isHidden('#bcPresent') && await payer.isVisible('#bcDoneA1') && await payer.isVisible('#bcScanR') && await payer.isVisible('#bcTwoLead'));
    const pcode = await decodeQr(payer, '#payQrArt');
    const pflow = (await state(payer)).flow;
    check('payer code: DMCASH1:P:140:<txn>', pcode === 'DMCASH1:P:140:' + pflow.txn, pcode);
    check('barcode + QR shown side by side', (await payer.$$('#barcodeArt svg rect')).length > 20 && !!(await payer.$('#payQrArt svg')));
    // shop reads it
    await shop.goto(APP);
    await tap(shop, '#goShopMode'); await waitScreen(shop, 'shop-home');
    check('shop home: total 0', (await shop.textContent('#shopTotal')) === '0えん' && (await shop.textContent('#shopCount')) === '（0かい）');
    check('camera not started before the button', (await shop.evaluate(() => window.__cam.calls)) === 0);
    await tap(shop, '#shopGoScan'); await waitScreen(shop, 'shop-scan');
    await shop.waitForFunction(() => window.cashlessTest.state().camera === true, null, { timeout: 8000 });
    check('camera asked once: rear camera, video only', await shop.evaluate(() => window.__cam.calls === 1 && window.__cam.constraints.video.facingMode === 'environment' && window.__cam.constraints.audio === false));
    await shop.evaluate(() => window.__cam.show('HELLO WORLD')); await waitText(shop, 'camPStatus', /どのまなの コードでは ありません/);
    check('foreign QR: どのまなの コードでは ありません (still scanning)', (await state(shop)).screen === 'shop-scan');
    await shop.evaluate(() => window.__cam.show('DMCASH1:S:1:300:123456')); await waitText(shop, 'camPStatus', /おきゃくさんの コードでは ありません/);
    check('a shop code is not accepted as a customer code', (await state(shop)).screen === 'shop-scan');
    await shop.evaluate(t => window.__cam.show(t), pcode); await waitScreen(shop, 'shop-ask');
    check('shop sees the amount', (await shop.textContent('#shopAskAmount')) === '140えん');
    check('camera stopped after the read (tracks ended)', await shop.evaluate(() => window.cashlessTest.state().camera === false && window.__cam.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))));
    await tap(shop, '#shopReceive'); await waitScreen(shop, 'shop-received');
    check('shop: うけとりました 140えん', (await shop.textContent('#shopReceivedAmount')) === '140えん');
    const rcode = await decodeQr(shop, '#shopReceiptQr');
    check('received mark: DMCASH1:R:140:<same txn>', rcode === 'DMCASH1:R:140:' + pflow.txn, rcode);
    await tap(shop, '#shopNext'); await waitScreen(shop, 'shop-home');
    check('today total 140 (1 time), kept on this device', (await shop.textContent('#shopTotal')) === '140えん' && (await shop.textContent('#shopCount')) === '（1かい）' && await shop.evaluate(() => JSON.parse(localStorage.getItem('donomana-cashless-shop-v1')).total === 140));
    // the same code again: refused
    await tap(shop, '#shopGoScan'); await shop.evaluate(t => window.__cam.show(t), pcode); await waitText(shop, 'camPStatus', /もう うけとりました/);
    check('double receipt prevented: もう うけとりました', (await state(shop)).screen === 'shop-scan' && (await state(shop)).shop.total === 140);
    // A2: payer reads the mark back
    check('payer balance unchanged while waiting', (await state(payer)).balance === 1000);
    await tap(payer, '#bcScanR'); await waitScreen(payer, 'bc-scanr');
    await payer.evaluate(() => window.__cam.show('DMCASH1:R:140:000001')); await waitText(payer, 'camRStatus', /ほかの しはらいの しるし/);
    check('A2: another payment\'s mark is refused', (await state(payer)).balance === 1000);
    await payer.evaluate(t => window.__cam.show(t), pcode); await waitText(payer, 'camRStatus', /しるしでは ありません/);
    await payer.evaluate(t => window.__cam.show(t), rcode); await waitScreen(payer, 'done');
    check('A2: matching mark completes; balance 860', (await state(payer)).balance === 860 && (await payer.textContent('#doneShop')) === 'まちの おみせ');
    let L = await log(payer);
    check('learning record format unchanged (cashless-barcode, same payload keys)', L.length === 1 && L[0].activity === 'cashless-barcode' && L[0].inputMethod === null && JSON.stringify(Object.keys(L[0].payload)) === JSON.stringify(['result', 'level', 'shop', 'item', 'amount', 'balanceBefore', 'balanceAfter', 'shortfallRetries', 'switchScan', 'gaze']), L[0]);
    // A1: the child presses かんりょう
    await tap(payer, '#doneHome'); await tap(payer, '#goBarcode'); await tap(payer, '#bcItemGrid .item-card:nth-child(1)'); await tap(payer, '#bcShowCode'); await waitScreen(payer, 'bc-code');
    await tap(payer, '#bcDoneA1'); await waitScreen(payer, 'done');
    L = await log(payer);
    check('A1: かんりょう completes; balance 800; inputMethod click', (await state(payer)).balance === 800 && L.length === 2 && L[1].inputMethod === 'click');
    // shop: manual amount when the camera cannot be used
    await shop.evaluate(() => { window.__cam.mode = 'denied'; });
    await shop.goto(APP); await shop.evaluate(() => { window.__cam.mode = 'denied'; });
    await tap(shop, '#goShopMode'); await tap(shop, '#shopGoScan'); await waitText(shop, 'camPStatus', /ゆるされて いません/);
    check('camera denied: message, retry button and manual entry offered', await shop.isVisible('#camPRetry') && await shop.isVisible('#shopManual') && /てで きんがくを いれる/.test(await camText(shop, 'camPStatus')));
    await tap(shop, '#shopManual'); await waitScreen(shop, 'shop-manual');
    for (const d of '60') await tap(shop, `#shopManualKeypad [data-key="${d}"]`);
    await tap(shop, '#shopManualKeypad [data-key="done"]'); await waitScreen(shop, 'shop-ask');
    await tap(shop, '#shopReceive'); await waitScreen(shop, 'shop-received');
    check('manual receipt: total 200, no received mark (no transaction number)', (await state(shop)).shop.total === 200 && await shop.isHidden('#shopReceiptWrap'));
    check('shop mode writes no learning record', (await shop.evaluate(() => JSON.parse(localStorage.getItem('cashless_log') || '[]').length)) === 2);
    await shop.evaluate(() => { const o = JSON.parse(localStorage.getItem('donomana-cashless-shop-v1')); o.date = '2020-01-01'; localStorage.setItem('donomana-cashless-shop-v1', JSON.stringify(o)); });
    await tap(shop, '#shopNext'); await waitScreen(shop, 'shop-home');
    check('a new day starts the total from 0', (await shop.textContent('#shopTotal')) === '0えん');
    check('no runtime errors (payer / shop)', errors.length === 0 && shopErrors.length === 0, { errors, shopErrors });
    await ctx.close();
  }

  console.log('\n=== 12. 体験2 2台（おみせの QR・難易度別の金額・カード・フォールバック）===');
  {
    const { ctx, page: payer, errors } = await newPage(browser, { realClock: true, fakeCam: true });
    const shop = await ctx.newPage(); await shop.addInitScript(FAKE_CAM);
    await payer.goto(APP);
    await setSettings(payer, () => payer.click('[data-devices="two"]'));
    await shop.goto(APP);
    await tap(shop, '#goShopMode'); await tap(shop, '#shopGoQr'); await waitScreen(shop, 'shop-pick');
    check('shop: 5 shops to choose from', (await shop.$$('#shopPickGrid button')).length === 5);
    await tap(shop, '#shopPickGrid button:nth-child(1)'); await waitScreen(shop, 'shop-price');
    for (const d of '320') await tap(shop, `#shopPriceKeypad [data-key="${d}"]`);
    await tap(shop, '#shopPriceKeypad [data-key="done"]'); await waitScreen(shop, 'shop-qr');
    const scode = await decodeQr(shop, '#shopQrArt');
    check('shop code: DMCASH1:S:1:320:<txn>', /^DMCASH1:S:1:320:[0-9]{6}$/.test(scode) && (await shop.textContent('#shopQrSign')) === 'パンやさん' && (await shop.textContent('#shopQrAmount')) === '320えん', scode);
    // payer (ふつう): reads, enters the amount, mismatch is blocked
    await tap(payer, '#goQr'); await waitScreen(payer, 'qr-shop');
    check('2 devices: camera lead instead of the virtual stand', await payer.isVisible('#qrRealLead') && await payer.isHidden('#qrVirtualFront'));
    await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-cam');
    await payer.evaluate(() => window.__cam.show('https://example.com/')); await waitText(payer, 'camSStatus', /どのまなの コードでは ありません/);
    await payer.evaluate(t => window.__cam.show(t), scode); await waitScreen(payer, 'qr-amount');
    check('ふつう: shop name from the QR, amount is NOT shown (ask the shop person), keypad', (await payer.textContent('#qrAmtShop')) === 'パンやさん' && /きんがくを きいて/.test(await payer.textContent('#qrAsk')) && !/320/.test(await payer.textContent('#scrQrAmount')) && await payer.isVisible('#qrKeypadArea'));
    await typeAmount(payer, 330); await tap(payer, '#qrKeypad [data-key="done"]'); await waitScreen(payer, 'qr-confirm');
    await tap(payer, '#qrPay');
    check('ふつう: amount different from the QR is not paid', (await state(payer)).screen === 'qr-confirm' && (await state(payer)).balance === 1000 && /いわれた きんがく/.test(await payer.textContent('#qrConfirmNotice')));
    await tap(payer, '#qrFix'); await typeAmount(payer, 320); await tap(payer, '#qrKeypad [data-key="done"]'); await waitScreen(payer, 'qr-confirm');
    check('confirm: shop and amount', (await payer.textContent('#qrConfShop')) === 'パンやさん' && (await payer.textContent('#qrConfAmount')) === '320えん');
    await tap(payer, '#qrPay'); await waitScreen(payer, 'done');
    check('paid 320; done screen names the shop (to show the shop person)', (await state(payer)).balance === 680 && (await payer.textContent('#doneShop')) === 'パンやさん' && (await payer.textContent('#donePaid')) === '320えん');
    let L = await log(payer);
    check('learning record format unchanged (cashless-qr, same payload keys)', L.length === 1 && L[0].activity === 'cashless-qr' && L[0].payload.amountRetries === 1 && JSON.stringify(Object.keys(L[0].payload)) === JSON.stringify(['result', 'level', 'shop', 'item', 'amount', 'balanceBefore', 'balanceAfter', 'shortfallRetries', 'switchScan', 'gaze', 'amountRetries', 'checkPractice', 'wrongShopShown', 'wrongShopPayAttempts']), L[0]);
    await tap(shop, '#shopQrReceived'); await waitScreen(shop, 'shop-received');
    check('shop: うけとった → total 320, no mark', (await state(shop)).shop.total === 320 && await shop.isHidden('#shopReceiptWrap'));
    // the same shop QR again: already paid
    await tap(payer, '#doneHome'); await tap(payer, '#goQr'); await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-cam');
    await waitText(payer, 'camSStatus', /もう はらいました/);
    check('the same shop QR is not paid twice', (await state(payer)).screen === 'qr-cam');
    // printed card (no amount): ふつう = keypad, any amount, no mismatch check; can be read again
    await payer.evaluate(() => window.__cam.show('DMCASH1:S:2::000000')); await waitScreen(payer, 'qr-amount');
    check('card: shop from the card', (await payer.textContent('#qrAmtShop')) === 'やおやさん');
    await typeAmount(payer, 150); await tap(payer, '#qrKeypad [data-key="done"]'); await tap(payer, '#qrPay'); await waitScreen(payer, 'done');
    check('card: entered amount is paid (530 left)', (await state(payer)).balance === 530);
    await tap(payer, '#doneHome'); await tap(payer, '#goQr'); await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-amount');
    check('card: can be read again (no transaction lock)', (await state(payer)).flow.readShop === 'やおやさん');
    // shortage in the 2-device flow: back to the amount input
    await typeAmount(payer, 999); await tap(payer, '#qrKeypad [data-key="done"]'); await tap(payer, '#qrPay'); await waitScreen(payer, 'qr-amount');
    check('2 devices: shortage → back to the amount input', /たりません/.test(await payer.textContent('#qrAmountNotice')) && (await state(payer)).balance === 530);
    // やさしい: the amount comes from the QR; a card gives amount buttons
    await back(payer, '#scrQrAmount');
    await back(payer, '#scrQrShop'); await waitScreen(payer, 'home');
    await setSettings(payer, () => payer.click('[data-level="easy"]'));
    await tap(payer, '#goQr'); await payer.evaluate(() => window.__cam.show('DMCASH1:S:4:200:555555')); await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-confirm');
    check('やさしい: amount filled in from the QR, straight to the confirmation', (await payer.textContent('#qrConfAmount')) === '200えん' && (await payer.textContent('#qrConfShop')) === 'くだものやさん');
    await tap(payer, '#qrPay'); await waitScreen(payer, 'done');
    check('やさしい: paid 200 (330 left)', (await state(payer)).balance === 330);
    await tap(payer, '#doneHome'); await tap(payer, '#goQr'); await payer.evaluate(() => window.__cam.show('DMCASH1:S:5::000000')); await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-amount');
    const choices = await payer.$$eval('#qrChoices button', bs => bs.map(b => b.textContent));
    check('やさしい + card: amount buttons the balance allows (50..300), no keypad', JSON.stringify(choices) === JSON.stringify(['50えん', '100えん', '150えん', '200えん', '300えん']) && await payer.isHidden('#qrKeypadArea'), choices);
    // camera unavailable → 1-device practice
    await back(payer, '#scrQrAmount');
    await payer.evaluate(() => { window.__cam.mode = 'nocamera'; });
    await tap(payer, '#qrRead'); await waitText(payer, 'camSStatus', /カメラが みつかりません/);
    check('no camera: fallback button offered', await payer.isVisible('#qrCamFallback') && await payer.isVisible('#camSRetry'));
    await tap(payer, '#qrCamFallback'); await waitScreen(payer, 'qr-shop');
    check('fallback: the 1-device practice (virtual stand) with the reason', await payer.isVisible('#qrVirtualFront') && /カメラが つかえない/.test(await payer.textContent('#qrShopNotice')) && (await state(payer)).flow.real === false);
    await tap(payer, '#qrRead'); await waitScreen(payer, 'qr-scan');
    check('fallback continues as the virtual experience', true);
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  console.log('\n=== 13. カメラ非対応・画面を離れると止まる・QRカード ===');
  {
    const { ctx, page, errors } = await newPage(browser, { realClock: true, fakeCam: true });
    await page.addInitScript(() => { if (location.hash === '#nogum') navigator.mediaDevices.getUserMedia = undefined; });
    await page.goto(APP);
    await tap(page, '#goShopMode'); await tap(page, '#shopGoScan'); await page.waitForFunction(() => window.cashlessTest.state().camera === true);
    await back(page, '#scrShopScan'); await waitScreen(page, 'shop-home');
    check('もどる stops the camera', await page.evaluate(() => window.cashlessTest.state().camera === false && window.__cam.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))));
    await tap(page, '#shopGoScan'); await page.waitForFunction(() => window.cashlessTest.state().camera === true);
    await page.click('#donomanaHelpBtn');
    check('opening つかいかた stops the camera; not restarted by itself', await page.evaluate(() => window.cashlessTest.state().camera === false));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    check('after closing: still stopped, 「カメラを つける」 offered', await page.evaluate(() => window.cashlessTest.state().camera === false) && await page.isVisible('#camPRetry'));
    await tap(page, '#camPRetry'); await page.waitForFunction(() => window.cashlessTest.state().camera === true);
    check('「カメラを つける」 restarts it', true);
    await back(page, '#scrShopScan'); await waitScreen(page, 'shop-home');
    // QR cards
    await tap(page, '#shopGoCards'); await waitScreen(page, 'shop-cards');
    const cards = await page.$$('#cardSheet .qr-card');
    check('5 QR cards', cards.length === 5);
    let okCards = true; const texts = [];
    for (let i = 1; i <= 5; i++) { const t = await decodeQr(page, `#cardSheet .qr-card:nth-child(${i})`); texts.push(t); if (t !== `DMCASH1:S:${i}::000000`) okCards = false; }
    check('each card: shop number only, no amount (DMCASH1:S:<n>::000000)', okCards, texts);
    await page.emulateMedia({ media: 'print' });
    check('print: only the cards are visible', await page.evaluate(() => getComputedStyle(document.querySelector('#cardSheet .qr-card')).visibility === 'visible' && getComputedStyle(document.getElementById('shopPrint')).visibility === 'hidden' && getComputedStyle(document.getElementById('donomanaA11yBtn')).visibility === 'hidden' && getComputedStyle(document.getElementById('balanceBar')).visibility === 'hidden'));
    await page.emulateMedia({ media: 'screen' });
    // browser without getUserMedia
    await page.goto('about:blank'); await page.goto(APP + '#nogum');   // a hash-only change would not reload the page
    await tap(page, '#goShopMode'); await tap(page, '#shopGoScan'); await waitText(page, 'camPStatus', /この ブラウザでは カメラが つかえません/);
    check('unsupported browser: clear message, manual entry still possible, no retry', await page.isHidden('#camPRetry') && await page.isVisible('#shopManual'));
    check('no runtime errors', errors.length === 0, errors);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass}/${pass + fail} checks passed.`);
  if (fail) { console.log(fail + ' FAILURES.'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
