#!/usr/bin/env node
// Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1 — Golden Test
// Harness for nazori-app's Level 2 Detail Parity + Level 3 Rich
// Visualization Parity ("Raster Image Reference", distinct from Sawatte's
// Interactive Trace Reference and the future hiragana/katakana Polyline
// Canvas Reference).
//
// Usage: node tools/record-dashboard-poc/nazori-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by
// golden-tests.js / ui-golden-tests.js / sawatte-common-detail-golden-tests.js
// / sst-common-detail-golden-tests.js / directions-common-detail-golden-tests.js
// / kurabeyou-common-detail-golden-tests.js / katachi-awase-common-detail-golden-tests.js
// (re-run alongside this file, not duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const NazoriDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'nazori-record-detail.js'));
// record-dashboard-foundation.js's nazori adapter references the shared
// module as a bare global (browser <script src> convention) — expose it
// the same way here for Node.
global.donomanaNazoriRecordDetail = NazoriDetail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage } = require('./fixtures.js');

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'nazori-app');

// captureCanvas()(nazori-app.html)が実際に返す形式に揃えた、短い合法PNG
// dataURLのfake値(実バイト列である必要はない。isValidImage()はprefixと
// 長さのみを検証する実装のため、テストはこのfakeで十分に実挙動を検証できる)。
function fakePng(tag) { return 'data:image/png;base64,' + Buffer.from('fake-png-' + tag).toString('base64'); }

// ────────────────────────────────────────────────────────────
section('1. Adapter registration (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('nazori-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'nazori-app' && meta.appName === 'なぞり書き練習ツール' && meta.category === '学習アプリ' && meta.storageKey === 'nazori_records');
check('privacyLevel is medium (allChars is free-text input)', meta && meta.privacyLevel === 'medium', meta && meta.privacyLevel);
check('includeInDefaultTimeline is true', meta && meta.includeInDefaultTimeline === true);

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — wide-mode / single-mode-complete');
// ────────────────────────────────────────────────────────────
// nazori-app.html実測shapeをそのまま使う(架空schema禁止)。
const FIXTURES = {
  // 'wide'(続けて書く)モード、1クリック=1entry、image(単一合成canvas)。
  wide_normal: { id: 'w1', sessionId: 's1', timestamp: '2026-09-17T01:00:00.000Z', mode: 'wide', allChars: 'あいう', charCount: 3, sessionDone: 1, sessionTotal: 1, image: fakePng('wide1') },
  // 'single'(一文字ずつ)モード、セッション完了時=1entry、charImages配列。
  single_complete: {
    id: 's1', sessionId: 's2', timestamp: '2026-09-17T02:00:00.000Z', mode: 'single', isComplete: true,
    allChars: 'あいう', charCount: 3, sessionDone: 3, sessionTotal: 3, startTime: '2026-09-17T01:55:00.000Z', durationMin: 5,
    charImages: [{ char: 'あ', image: fakePng('a') }, { char: 'い', image: fakePng('i') }, { char: 'う', image: fakePng('u') }]
  },
  // 画像なし(wide、キャプチャ失敗などでimageがnull)。
  missing_image: { id: 'm1', sessionId: 's3', timestamp: '2026-09-17T03:00:00.000Z', mode: 'wide', allChars: 'え', charCount: 1, sessionDone: 1, sessionTotal: 1, image: null },
  // 壊れたimage文字列(prefixだけ、または全く別の文字列)。
  malformed_image: { id: 'mf1', sessionId: 's4', timestamp: '2026-09-17T04:00:00.000Z', mode: 'wide', allChars: 'お', charCount: 1, sessionDone: 1, sessionTotal: 1, image: 'not-a-data-url' },
  // 未対応MIME(実保存形式=PNGのみ許可。JPEG/SVG等は許可しない)。
  unsupported_mime: { id: 'um1', sessionId: 's5', timestamp: '2026-09-17T05:00:00.000Z', mode: 'wide', allChars: 'か', charCount: 1, sessionDone: 1, sessionTotal: 1, image: 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64') },
  // 悪意あるsrc値(XSS注入試行)。
  malicious_javascript_uri: { id: 'mal1', sessionId: 's6', timestamp: '2026-09-17T06:00:00.000Z', mode: 'wide', allChars: 'き', charCount: 1, sessionDone: 1, sessionTotal: 1, image: 'javascript:alert(1)' },
  malicious_data_html: { id: 'mal2', sessionId: 's7', timestamp: '2026-09-17T07:00:00.000Z', mode: 'wide', allChars: 'く', charCount: 1, sessionDone: 1, sessionTotal: 1, image: 'data:text/html;base64,' + Buffer.from('<script>window.__xss=true</script>').toString('base64') },
  // legacy(schemaVersion以前、image/charImages/allChars/sessionDone等が
  // 一切ないごく最小のentry)。
  legacy_minimal: { id: 'leg1', timestamp: '2026-09-17T08:00:00.000Z' },
  // 自由入力(allChars)が非常に長い場合(名前欄などを想定)。
  long_text: { id: 'lt1', sessionId: 's8', timestamp: '2026-09-17T09:00:00.000Z', mode: 'wide', allChars: 'あ'.repeat(500), charCount: 1, sessionDone: 1, sessionTotal: 1, image: fakePng('lt') },
  // allCharsにHTML-likeな文字列が入る場合(自由入力欄のため起こり得る)。
  html_like_text: { id: 'ht1', sessionId: 's9', timestamp: '2026-09-17T10:00:00.000Z', mode: 'wide', allChars: '<img src=x onerror="window.__xss=true">', charCount: 1, sessionDone: 1, sessionTotal: 1, image: fakePng('ht') },
  // 未知schema(将来の新規fieldや全く異質な形)でもcrashしないことの確認。
  unknown_schema: { id: 'us1', timestamp: '2026-09-17T11:00:00.000Z', somethingTotallyNew: { nested: true }, image: 123, charImages: 'not-an-array' },
  // 一部の画像だけ壊れているsingle-complete(1枚だけ表示できればよい)。
  single_partial_valid: {
    id: 'spv1', sessionId: 's10', timestamp: '2026-09-17T12:00:00.000Z', mode: 'single', isComplete: true,
    allChars: 'さしす', charCount: 3, sessionDone: 3, sessionTotal: 3, durationMin: 4,
    charImages: [{ char: 'さ', image: fakePng('sa') }, { char: 'し', image: 'broken' }, { char: 'す', image: null }]
  }
};

const storage = new FakeStorage();
storage.setItem('nazori_records', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['nazori-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. hasMedia bug fix regression (must check charImages[], not only image)');
// ────────────────────────────────────────────────────────────
{
  // collectRecordsはtimestamp順にソートするため、複数fixtureをまとめて
  // 収集した配列から探すより、1件ずつcollectRecordsし直して確認する方が
  // 意図が明確(このテストの主目的はhasMedia判定そのもの)。
  function hasMediaSingle(fixture) {
    const s = new FakeStorage();
    s.setItem('nazori_records', JSON.stringify([fixture]));
    const res = dash.collectRecords({ storage: s, appIds: ['nazori-app'], maxPerApp: 5 });
    return res.records[0] && res.records[0].hasMedia;
  }
  check('wide_normal (top-level image only): hasMedia true', hasMediaSingle(FIXTURES.wide_normal) === true);
  check('single_complete (charImages only, NO top-level image): hasMedia true (this was the pre-existing bug)', hasMediaSingle(FIXTURES.single_complete) === true);
  check('missing_image: hasMedia false', hasMediaSingle(FIXTURES.missing_image) === false);
  check('malformed_image (not a data URL): hasMedia false', hasMediaSingle(FIXTURES.malformed_image) === false);
  check('unsupported_mime (jpeg, not png): hasMedia false', hasMediaSingle(FIXTURES.unsupported_mime) === false);
  check('malicious_javascript_uri: hasMedia false', hasMediaSingle(FIXTURES.malicious_javascript_uri) === false);
  check('malicious_data_html: hasMedia false', hasMediaSingle(FIXTURES.malicious_data_html) === false);
  check('legacy_minimal: hasMedia false, no crash', hasMediaSingle(FIXTURES.legacy_minimal) === false);
  check('unknown_schema (image:123, charImages:string): hasMedia false, no crash', hasMediaSingle(FIXTURES.unknown_schema) === false);
  check('single_partial_valid (1 valid + 2 broken charImages): hasMedia true', hasMediaSingle(FIXTURES.single_partial_valid) === true);
}

// ────────────────────────────────────────────────────────────
section('4. getImages()/isValidImage() — direct validation of the new shared module');
// ────────────────────────────────────────────────────────────
check('isValidImage: valid PNG dataURL -> true', NazoriDetail.isValidImage(fakePng('x')) === true);
check('isValidImage: undefined -> false', NazoriDetail.isValidImage(undefined) === false);
check('isValidImage: null -> false', NazoriDetail.isValidImage(null) === false);
check('isValidImage: empty string -> false', NazoriDetail.isValidImage('') === false);
check('isValidImage: bare prefix with nothing after -> false', NazoriDetail.isValidImage('data:image/png;base64,') === false);
check('isValidImage: non-string (number) -> false', NazoriDetail.isValidImage(123) === false);
check('isValidImage: jpeg mime -> false', NazoriDetail.isValidImage('data:image/jpeg;base64,AAAA') === false);
check('isValidImage: javascript: URI -> false', NazoriDetail.isValidImage('javascript:alert(1)') === false);
check('isValidImage: data:text/html -> false', NazoriDetail.isValidImage('data:text/html;base64,AAAA') === false);

check('getImages(wide_normal): 1 image, generic alt', JSON.stringify(NazoriDetail.getImages(FIXTURES.wide_normal)) === JSON.stringify([{ alt: 'なぞり書き', image: FIXTURES.wide_normal.image }]));
check('getImages(single_complete): 3 images, per-char alt', NazoriDetail.getImages(FIXTURES.single_complete).map(i => i.alt).join('') === 'あいう');
check('getImages(missing_image): 0 images', NazoriDetail.getImages(FIXTURES.missing_image).length === 0);
check('getImages(single_partial_valid): only the 1 valid image survives', NazoriDetail.getImages(FIXTURES.single_partial_valid).length === 1 && NazoriDetail.getImages(FIXTURES.single_partial_valid)[0].alt === 'さ');
check('getImages(null): [] , no crash', JSON.stringify(NazoriDetail.getImages(null)) === '[]');
check('getImages(unknown_schema): [] , no crash', JSON.stringify(NazoriDetail.getImages(FIXTURES.unknown_schema)) === '[]');

// ────────────────────────────────────────────────────────────
section('5. getDetails() via the real public API — Level 2 (minimal: image count only)');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('nazori-app', fixture); }
{
  const rows = detailsFor(FIXTURES.single_complete);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('single_complete: 画像記録 = あり（3枚）', map['画像記録'] === 'あり（3枚）', map);
  check('single_complete: allChars (練習した文字) is NOT in Detail rows (existing privacy exclusion)', !('練習した文字' in map) && !Object.keys(map).some(k => rows.find(r => r.label === k).value === 'あいう'), map);
}
{
  const rows = detailsFor(FIXTURES.wide_normal);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('wide_normal: 画像記録 = あり（1枚）', map['画像記録'] === 'あり（1枚）', map);
}
{
  const rows = detailsFor(FIXTURES.missing_image);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('missing_image: 画像記録 = なし', map['画像記録'] === 'なし', map);
}
{
  const rows = detailsFor(FIXTURES.single_partial_valid);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('single_partial_valid: 画像記録 = あり（1枚） (2 broken images excluded from count)', map['画像記録'] === 'あり（1枚）', map);
}
check('getRecordDetails never throws on null/undefined/unknown_schema entry', (function () {
  try {
    dash.getRecordDetails('nazori-app', null);
    dash.getRecordDetails('nazori-app', undefined);
    dash.getRecordDetails('nazori-app', FIXTURES.unknown_schema);
    dash.getRecordDetails('nazori-app', FIXTURES.legacy_minimal);
    return true;
  } catch (e) { return false; }
})());

// ────────────────────────────────────────────────────────────
section('6. Rich Visualization — Level 3, raster <img>-based (valid / missing / malformed / partial / malicious)');
// ────────────────────────────────────────────────────────────
{
  check('supports true: wide_normal (1 valid image)', dash.supportsRichVisualization('nazori-app', FIXTURES.wide_normal) === true);
  check('supports true: single_complete (3 valid images)', dash.supportsRichVisualization('nazori-app', FIXTURES.single_complete) === true);
  check('supports true: single_partial_valid (1 of 3 valid)', dash.supportsRichVisualization('nazori-app', FIXTURES.single_partial_valid) === true);
  check('supports false: missing_image', dash.supportsRichVisualization('nazori-app', FIXTURES.missing_image) === false);
  check('supports false: malformed_image', dash.supportsRichVisualization('nazori-app', FIXTURES.malformed_image) === false);
  check('supports false: unsupported_mime', dash.supportsRichVisualization('nazori-app', FIXTURES.unsupported_mime) === false);
  check('supports false: malicious_javascript_uri', dash.supportsRichVisualization('nazori-app', FIXTURES.malicious_javascript_uri) === false);
  check('supports false: malicious_data_html', dash.supportsRichVisualization('nazori-app', FIXTURES.malicious_data_html) === false);
  check('supports false: legacy_minimal', dash.supportsRichVisualization('nazori-app', FIXTURES.legacy_minimal) === false);
  check('supports false: unknown_schema', dash.supportsRichVisualization('nazori-app', FIXTURES.unknown_schema) === false);
  check('supports false: unregistered appId', dash.supportsRichVisualization('does-not-exist', FIXTURES.wide_normal) === false);

  // Minimal fake DOM (Cross-App Contract §12/§25: img + text fallback,
  // never image-only; src must be assigned via a validated string, never
  // via innerHTML with raw content).
  function FakeEl(tag) {
    this.tag = tag; this.style = {}; this._attrs = {}; this.children = []; this.textContent = ''; this.className = '';
    this.setAttribute = (k, v) => { this._attrs[k] = v; };
    this.appendChild = (c) => { this.children.push(c); };
  }
  const fakeDocument = { createElement(tag) { return new FakeEl(tag); } };
  global.document = fakeDocument;

  // renderRichVisualization()は各<img>を<div class="rich-viz-nazori-image-wrap">
  // で包んでtargetへ追加するため(キャプション同梱のため)、直接の子ではなく
  // 全descendantを再帰的に走査する。
  function findAll(el, tag) {
    var out = [];
    (el.children || []).forEach(function (c) {
      if (c.tag === tag) out.push(c);
      out = out.concat(findAll(c, tag));
    });
    return out;
  }

  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.wide_normal);
    const imgs = findAll(target, 'img');
    check('wide_normal render: 1 <img> appended', imgs.length === 1, imgs.length);
    check('wide_normal render: img.src is exactly the validated dataURL (no transformation)', imgs[0] && imgs[0].src === FIXTURES.wide_normal.image);
    check('wide_normal render: img has non-empty alt text (no image-only)', imgs[0] && typeof imgs[0].alt === 'string' && imgs[0].alt.length > 0, imgs[0] && imgs[0].alt);
    check('wide_normal render: text fallback (count) also appended, not image-only', target.children.some(c => c.tag === 'p' && /画像/.test(c.textContent)));
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.single_complete);
    const imgs = findAll(target, 'img');
    check('single_complete render: 3 <img> appended (one per char)', imgs.length === 3, imgs.length);
    check('single_complete render: each img has a distinct per-char alt', imgs.map(i => i.alt).join('|').indexOf('あ') !== -1 && imgs.map(i => i.alt).join('|').indexOf('い') !== -1 && imgs.map(i => i.alt).join('|').indexOf('う') !== -1, imgs.map(i => i.alt));
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.single_partial_valid);
    const imgs = findAll(target, 'img');
    check('single_partial_valid render: only 1 <img> (2 broken skipped, none crash)', imgs.length === 1, imgs.length);
  }
  {
    const target = new FakeEl('div');
    let threw = false;
    try { dash.renderRichVisualization('nazori-app', target, FIXTURES.missing_image); } catch (e) { threw = true; }
    check('missing_image render: does not throw', threw === false);
    check('missing_image render: appends nothing (supports() already false, UI would not call this, but even direct call is a safe no-op)', target.children.length === 0);
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.malicious_javascript_uri);
    check('malicious_javascript_uri render: no <img> appended (rejected by isValidImage, never reaches src)', findAll(target, 'img').length === 0);
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.malicious_data_html);
    check('malicious_data_html render: no <img> appended', findAll(target, 'img').length === 0);
  }
  {
    // html_like_text puts markup into allChars, which is NOT used by
    // getImages/renderRichVisualization at all — confirms no path exists
    // for allChars to reach src/innerHTML in the visualization layer.
    const target = new FakeEl('div');
    dash.renderRichVisualization('nazori-app', target, FIXTURES.html_like_text);
    const imgs = findAll(target, 'img');
    check('html_like_text render: normal image still renders, alt is the fixed generic label (not allChars)', imgs.length === 1 && imgs[0].alt.indexOf('<img') === -1, imgs[0] && imgs[0].alt);
  }

  delete global.document;
}

// ────────────────────────────────────────────────────────────
section('7. CSV Parity — getCsvActions(), exact 7-column shape (App-local CSV header)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('nazori-app');
  check('getCsvActions returns exactly 1 action (detail CSV)', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 7 columns', rows[0].length === 7, rows[0]);
  check('CSV header matches App-local header exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', '練習した文字', 'モード', '取り組んだ文字数', '全体の文字数', '活動時間（分）']), rows[0]);
  check('CSV has 1 data row per fixture', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);
  check('CSV does NOT contain any image dataURL (no base64 image payload embedded)', !rows.some(row => row.some(cell => typeof cell === 'string' && cell.indexOf('base64') !== -1)));

  const wideRowIdx = 1 + Object.keys(FIXTURES).indexOf('wide_normal');
  check('wide_normal CSV row: mode label = 続けて書く', rows[wideRowIdx][3] === '続けて書く', rows[wideRowIdx]);
  check('wide_normal CSV row: duration blank (not isComplete)', rows[wideRowIdx][6] === '', rows[wideRowIdx]);
  const singleRowIdx = 1 + Object.keys(FIXTURES).indexOf('single_complete');
  check('single_complete CSV row: mode label = 一文字ずつ', rows[singleRowIdx][3] === '一文字ずつ', rows[singleRowIdx]);
  check('single_complete CSV row: duration = 5 (durationMin, isComplete)', rows[singleRowIdx][6] === 5, rows[singleRowIdx]);
  check('single_complete CSV row: allChars = あいう (deliberate export includes free text, unlike Detail)', rows[singleRowIdx][2] === 'あいう', rows[singleRowIdx]);

  const htmlRowIdx = 1 + Object.keys(FIXTURES).indexOf('html_like_text');
  check('html_like_text CSV row: raw markup preserved as plain string data (rendering layer/Excel handles safety, not this builder)', rows[htmlRowIdx][2] === '<img src=x onerror="window.__xss=true">', rows[htmlRowIdx]);

  const longRowIdx = 1 + Object.keys(FIXTURES).indexOf('long_text');
  check('long_text CSV row: full 500-char value preserved (no silent truncation)', rows[longRowIdx][2].length === 500, rows[longRowIdx][2].length);

  check('action does not throw on malformed log entries (null/string/number/array)', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('8. CSV Formula Injection safety (allChars is free-text, per csvSafeCell)');
// ────────────────────────────────────────────────────────────
{
  const injectionFixture = { id: 'inj1', timestamp: '2026-09-17T13:00:00.000Z', mode: 'wide', allChars: '=SUM(A1:A9)', sessionDone: 1, sessionTotal: 1 };
  const rows = NazoriDetail.buildDetailCsvRows([injectionFixture]);
  check('formula-like allChars is safe-quoted (leading apostrophe)', rows[1][2] === "'=SUM(A1:A9)", rows[1]);
}

// ────────────────────────────────────────────────────────────
section('9. App-local / Common semantic parity (same record, same values, same function)');
// ────────────────────────────────────────────────────────────
{
  const direct = NazoriDetail.getDetailRows(FIXTURES.single_complete);
  const viaCommon = dash.getRecordDetails('nazori-app', FIXTURES.single_complete);
  check('Common getRecordDetails() output is byte-identical to direct NazoriDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });

  const directCsv = NazoriDetail.buildDetailCsvRows([FIXTURES.wide_normal, FIXTURES.single_complete]);
  const viaCommonCsv = dash.getCsvActions('nazori-app')[0].buildRows([FIXTURES.wide_normal, FIXTURES.single_complete]);
  check('Common CSV action output is byte-identical to direct NazoriDetail.buildDetailCsvRows()', JSON.stringify(directCsv) === JSON.stringify(viaCommonCsv), { directCsv, viaCommonCsv });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
