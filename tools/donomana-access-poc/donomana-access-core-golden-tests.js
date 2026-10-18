// Donomana Access Phase 2 — Golden tests for assets/js/donomana-access-core.js
// DOM操作・実ブラウザ検証はここでは行わない
// (tools/donomana-access-poc/donomana-access-realbrowser-test.py が担当)。
// このファイルはNode.js単体で完結する純粋関数のみを検証する
// (tools/record-dashboard-poc/ui-golden-tests.jsと同じ慣習)。
'use strict';

const path = require('path');
const Core = require(path.join(__dirname, '..', '..', 'assets', 'js', 'donomana-access-core.js'));

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { pass++; console.log('  [OK  ]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}

console.log('=== 1. makeEvent(): schema準拠・null保持 ===');
(function () {
  const e1 = Core.makeEvent({ type: 'activate', inputMethod: 'touch', timestamp: 100, position: { x: 10, y: 20 } });
  check('type/inputMethod/timestampが保持される', e1.type === 'activate' && e1.inputMethod === 'touch' && e1.timestamp === 100);
  check('positionがそのまま保持される', e1.position.x === 10 && e1.position.y === 20);
  check('durationは未指定ならnull（0等で代用しない）', e1.duration === null);
  check('movementは未指定ならnull', e1.movement === null);

  const e2 = Core.makeEvent({ type: 'activate', inputMethod: 'switch', timestamp: 200 });
  check('switch入力でpositionを渡さない場合、nullのまま（推定しない）', e2.position === null);

  let threw = false;
  try { Core.makeEvent({ type: 'bogus', inputMethod: 'touch' }); } catch (err) { threw = true; }
  check('不正なtypeはエラーになる', threw);

  threw = false;
  try { Core.makeEvent({ type: 'activate', inputMethod: 'mouse' }); } catch (err) { threw = true; }
  check('不正なinputMethodはエラーになる', threw);

  const e3 = Core.makeEvent({ type: 'move', inputMethod: 'touch', position: { x: 1, y: 2 }, movement: { dx: 3, dy: 4 } });
  check('movementが数値ペアとして保持される', e3.movement.dx === 3 && e3.movement.dy === 4);

  const e4 = Core.makeEvent({ type: 'move', inputMethod: 'touch', position: { x: 'a', y: 2 } });
  check('position.xが数値でない場合はnullへフォールバックする（不正値を保持しない）', e4.position === null);
})();

console.log('\n=== 2. computeDuration(): 欠損をnullのまま扱う ===');
(function () {
  check('正常な2点からdurationを計算', Core.computeDuration(100, 250) === 150);
  check('開始・終了が同一なら0', Core.computeDuration(500, 500) === 0);
  check('終了が開始より前でも負値を返さない（0でクランプ）', Core.computeDuration(500, 400) === 0);
  check('開始がnullならnull（代用値を作らない）', Core.computeDuration(null, 500) === null);
  check('終了がundefinedならnull', Core.computeDuration(100, undefined) === null);
})();

console.log('\n=== 3. createRepeatGuard(): OSキーリピート・二重押下開始の抑制 ===');
(function () {
  const g = Core.createRepeatGuard();
  check('最初のkeydown(非repeat)はactivateを許可する', g.onKeyDown(' ', false) === true);
  check('同じキーが押されたままのisPressed()はtrue', g.isPressed(' ') === true);
  check('OSのキーリピート(repeat=true)はactivateを拒否する（長押し誤発火防止）', g.onKeyDown(' ', true) === false);
  check('keyupを取り逃した状態での非repeat二度目のkeydownも拒否する（二重押下開始防止）', g.onKeyDown(' ', false) === false);
  check('releaseは押されていたキーのみ許可する', g.onKeyUp(' ') === true);
  check('release後のisPressed()はfalse', g.isPressed(' ') === false);
  check('押されていないキーのkeyupは拒否する(二重解除防止)', g.onKeyUp(' ') === false);

  const g2 = Core.createRepeatGuard();
  g2.onKeyDown('Enter', false);
  g2.onKeyDown('Space', false);
  const leaked = g2.releaseAll();
  check('releaseAll()は押されていたキー全てを返す', leaked.length === 2 && leaked.indexOf('Enter') !== -1 && leaked.indexOf('Space') !== -1);
  check('releaseAll()後は全キーが解除される', g2.isPressed('Enter') === false && g2.isPressed('Space') === false);

  const g3 = Core.createRepeatGuard();
  check('releaseAll()を空の状態で呼んでもエラーにならない', JSON.stringify(g3.releaseAll()) === '[]');
})();

console.log('\n=== 4. buildScanItems(): DOM非依存部分の防御的挙動 ===');
(function () {
  check('querySelectorAllを持たないrootには空配列を返す(クラッシュしない)', JSON.stringify(Core.buildScanItems(null)) === '[]');
  check('undefinedを渡してもクラッシュしない', JSON.stringify(Core.buildScanItems(undefined)) === '[]');
})();

// MockStorage: Node.jsにはlocalStorageが存在しないため、Web Storage APIの
// 最小限の挙動(getItem/setItem/removeItem)を模したモックを用いる。
function makeMockStorage(initial) {
  var data = Object.assign({}, initial || {});
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    _raw: function () { return data; }
  };
}
function makeThrowingStorage(error) {
  return {
    getItem: function () { return null; },
    setItem: function () { throw error; },
    removeItem: function () { throw error; }
  };
}

console.log('\n=== 5. buildSessionRecord(): 観測データschema、教師の記録を含まない ===');
(function () {
  const events = [Core.makeEvent({ type: 'activate', inputMethod: 'touch', timestamp: 1, position: { x: 1, y: 2 } })];
  const rec = Core.buildSessionRecord({ sessionId: 's1', inputMethod: 'touch', startedAt: '2026-10-18T00:00:00.000Z', endedAt: '2026-10-18T00:01:00.000Z', events: events });
  check('schemaVersion=1が付与される', rec.schemaVersion === 1);
  check('sessionId/inputMethod/startedAt/endedAtが保持される', rec.sessionId === 's1' && rec.inputMethod === 'touch' && rec.startedAt === '2026-10-18T00:00:00.000Z' && rec.endedAt === '2026-10-18T00:01:00.000Z');
  check('eventsがそのまま保持される', rec.events.length === 1 && rec.events[0].type === 'activate');
  check('教師の解釈・メモ用フィールド(note等)を持たない(観測データと教師の記録を分離)', !('note' in rec) && !('teacherNote' in rec));
  check('主体性・意欲を評価するフィールドを持たない', !('intentLevel' in rec) && !('engagementScore' in rec));

  let threw = false;
  try { Core.buildSessionRecord({ sessionId: '', inputMethod: 'touch' }); } catch (e) { threw = true; }
  check('sessionId欠落はエラーになる', threw);

  threw = false;
  try { Core.buildSessionRecord({ sessionId: 's2', inputMethod: 'mouse' }); } catch (e) { threw = true; }
  check('不正なinputMethodはエラーになる', threw);

  const recNoEvents = Core.buildSessionRecord({ sessionId: 's3', inputMethod: 'switch' });
  check('eventsを渡さない場合は空配列になる(undefinedのまま保持しない)', Array.isArray(recNoEvents.events) && recNoEvents.events.length === 0);
})();

console.log('\n=== 6. safeReadSessions(): record-dashboard-foundation.js safeReadArray()と同じ防御方針 ===');
(function () {
  const empty = Core.safeReadSessions(makeMockStorage({}));
  check('キー未設定はitems:[]・anomaly:null(正常な未使用状態)', empty.items.length === 0 && empty.anomaly === null);

  const malformed = Core.safeReadSessions(makeMockStorage({ [Core.STORAGE_KEY]: '{not json' }));
  check('malformed JSONはitems:[]・anomaly:malformed-json', malformed.items.length === 0 && malformed.anomaly === 'malformed-json');

  const nonArray = Core.safeReadSessions(makeMockStorage({ [Core.STORAGE_KEY]: JSON.stringify({ a: 1 }) }));
  check('non-arrayはitems:[]・anomaly:non-array', nonArray.items.length === 0 && nonArray.anomaly === 'non-array');

  const valid = Core.safeReadSessions(makeMockStorage({ [Core.STORAGE_KEY]: JSON.stringify([{ sessionId: 'x' }]) }));
  check('正常なJSON配列はそのまま読み取れる', valid.items.length === 1 && valid.items[0].sessionId === 'x' && valid.anomaly === null);

  check('storageが無い場合もクラッシュしない', Core.safeReadSessions(null).items.length === 0);
})();

console.log('\n=== 7. appendSession(): 容量上限への対処(古いものから切り捨て) ===');
(function () {
  const appended = Core.appendSession([{ sessionId: 'a' }], { sessionId: 'b' });
  check('既存配列の末尾に追加される', appended.length === 2 && appended[1].sessionId === 'b');
  check('元の配列を破壊しない(純粋関数)', appended !== undefined); // 下の別アサーションで確認

  const original = [{ sessionId: 'a' }];
  Core.appendSession(original, { sessionId: 'b' });
  check('appendSession()は引数の配列を変更しない', original.length === 1);

  const many = [];
  for (let i = 0; i < 5; i++) many.push({ sessionId: 's' + i });
  const capped = Core.appendSession(many, { sessionId: 'new' }, 3);
  check('上限を超えると古いものから切り捨てられる(件数)', capped.length === 3);
  check('切り捨て後も最新のものが残る', capped[capped.length - 1].sessionId === 'new');
  check('切り捨て後、最も古いものは残らない', capped.findIndex(function (s) { return s.sessionId === 's0'; }) === -1);
})();

console.log('\n=== 8. writeSessions(): 保存失敗をsilentに握りつぶさない ===');
(function () {
  const storage = makeMockStorage({});
  const okResult = Core.writeSessions(storage, [{ sessionId: 'a' }]);
  check('正常な書き込みはok:true', okResult.ok === true && okResult.reason === null);
  check('書き込んだ内容が実際に読み取れる', JSON.parse(storage.getItem(Core.STORAGE_KEY)).length === 1);

  const quotaError = new Error('quota');
  quotaError.name = 'QuotaExceededError';
  const quotaResult = Core.writeSessions(makeThrowingStorage(quotaError), [{ sessionId: 'a' }]);
  check('QuotaExceededErrorはreason:quotaとして分類される', quotaResult.ok === false && quotaResult.reason === 'quota');

  const securityError = new Error('blocked');
  securityError.name = 'SecurityError';
  const securityResult = Core.writeSessions(makeThrowingStorage(securityError), [{ sessionId: 'a' }]);
  check('SecurityErrorはreason:securityとして分類される', securityResult.ok === false && securityResult.reason === 'security');

  const unknownResult = Core.writeSessions(makeThrowingStorage(new Error('something else')), [{ sessionId: 'a' }]);
  check('未知のエラーはreason:unknownとして分類される(黒塗りせず記録する)', unknownResult.ok === false && unknownResult.reason === 'unknown');

  check('storageが無い場合もクラッシュせずok:falseを返す', Core.writeSessions(null, []).ok === false);
})();

console.log('\n=== 9. clearSessions(): 記録削除 ===');
(function () {
  const storage = makeMockStorage({ [Core.STORAGE_KEY]: JSON.stringify([{ sessionId: 'a' }]) });
  const result = Core.clearSessions(storage);
  check('削除は成功する', result.ok === true);
  check('削除後はキーが存在しない', storage.getItem(Core.STORAGE_KEY) === null);

  const failResult = Core.clearSessions(makeThrowingStorage(new Error('x')));
  check('削除失敗もクラッシュせずok:falseを返す', failResult.ok === false);
})();

console.log('\n=== 10. summarizeSessions(): 件数のみの客観的集計(評価を付与しない) ===');
(function () {
  const sessions = [
    { inputMethod: 'touch', events: [{ type: 'activate' }, { type: 'release' }, { type: 'activate' }] },
    { inputMethod: 'switch', events: [{ type: 'activate' }] },
    { inputMethod: 'touch', events: [] }
  ];
  const summary = Core.summarizeSessions(sessions);
  check('sessionCountは記録件数', summary.sessionCount === 3);
  check('totalActivateCountはactivateイベントのみを数える(release等は数えない)', summary.totalActivateCount === 3);
  check('inputMethod別の内訳を持つ(比較用の順位付けはしない、単純な集計のみ)', summary.byInputMethod.touch === 2 && summary.byInputMethod.switch === 1);
  check('評価的なフィールド(engagementLevel等)を持たない', !('engagementLevel' in summary) && !('motivationScore' in summary));

  const emptySummary = Core.summarizeSessions([]);
  check('空配列でもクラッシュせずsessionCount:0', emptySummary.sessionCount === 0 && emptySummary.totalActivateCount === 0);

  const malformedSummary = Core.summarizeSessions(null);
  check('null入力でもクラッシュしない', malformedSummary.sessionCount === 0);
})();

console.log('\n=== 11. Phase 5A: スワイプ入力方式の追加(Design v2.0 1.2節) ===');
(function () {
  check("VALID_INPUT_METHODSに'swipe'が追加されている", Core.VALID_INPUT_METHODS.indexOf('swipe') !== -1);
  check("既存の'touch'/'switch'/'keyboard'は変更されていない", Core.VALID_INPUT_METHODS.indexOf('touch') !== -1 && Core.VALID_INPUT_METHODS.indexOf('switch') !== -1 && Core.VALID_INPUT_METHODS.indexOf('keyboard') !== -1);

  const swipeEvt = Core.makeEvent({ type: 'activate', inputMethod: 'swipe', timestamp: 10, position: { x: 1, y: 1 } });
  check("makeEvent()はinputMethod:'swipe'を受理する", swipeEvt.inputMethod === 'swipe' && swipeEvt.type === 'activate');

  const swipeMove = Core.makeEvent({ type: 'move', inputMethod: 'swipe', position: { x: 1, y: 1 }, movement: { dx: 10, dy: 0 } });
  check("swipeのmoveイベントも既存schemaのまま記録できる(新しい専用フィールドを追加しない)", swipeMove.movement.dx === 10 && Object.keys(swipeMove).length === 6);

  const swipeRelease = Core.makeEvent({ type: 'release', inputMethod: 'swipe', timestamp: 20, duration: 10 });
  check("swipeのreleaseイベントも既存schemaのまま記録できる", swipeRelease.type === 'release' && swipeRelease.duration === 10);

  const swipeCancel = Core.makeEvent({ type: 'cancel', inputMethod: 'swipe', timestamp: 30 });
  check("swipeのcancelイベントも既存schemaのまま記録できる(「スワイプ不成立」という独自イベントは追加しない)", swipeCancel.type === 'cancel');

  const swipeRecord = Core.buildSessionRecord({ sessionId: 'swipe-1', inputMethod: 'swipe', startedAt: '2026-10-18T00:00:00.000Z', endedAt: '2026-10-18T00:01:00.000Z', events: [swipeEvt, swipeMove, swipeRelease] });
  check("buildSessionRecord()はinputMethod:'swipe'を受理する", swipeRecord.inputMethod === 'swipe' && swipeRecord.schemaVersion === 1);
})();

console.log('\n=== 12. Phase 5A: meetsMoveThreshold()・10px/12px境界値(Design v2.0 1.2節) ===');
(function () {
  check('定数TOUCH_MOVE_THRESHOLD_PXは既存どおり12(変更しない)', Core.TOUCH_MOVE_THRESHOLD_PX === 12);
  check('定数SWIPE_MOVE_THRESHOLD_PXは未検証の暫定初期値10', Core.SWIPE_MOVE_THRESHOLD_PX === 10);

  // スワイプ(10px)の境界値: dx=10,dy=0 -> 距離=10 (ちょうどしきい値、記録する)
  check('距離がしきい値ちょうど(10px)の場合は記録する(境界値を含む)', Core.meetsMoveThreshold(10, 0, Core.SWIPE_MOVE_THRESHOLD_PX) === true);
  // dx=9,dy=0 -> 距離=9 (しきい値未満、記録しない)
  check('距離がしきい値未満(9px)の場合は記録しない', Core.meetsMoveThreshold(9, 0, Core.SWIPE_MOVE_THRESHOLD_PX) === false);
  // dx=9.99... 境界近傍（3-4-5相当で6,8->距離10）
  check('3:4比の移動(dx=6,dy=8、距離10)でも境界値どおり記録する', Core.meetsMoveThreshold(6, 8, Core.SWIPE_MOVE_THRESHOLD_PX) === true);
  check('距離がしきい値をわずかに超えない場合(dx=6,dy=7.9)は記録しない', Core.meetsMoveThreshold(6, 7.9, Core.SWIPE_MOVE_THRESHOLD_PX) === false);

  // タッチ(12px)の既存挙動が変化していないことの回帰確認
  check('タッチの既存しきい値(12px)ちょうどは記録する(回帰確認)', Core.meetsMoveThreshold(12, 0, Core.TOUCH_MOVE_THRESHOLD_PX) === true);
  check('タッチの既存しきい値(12px)未満(11px)は記録しない(回帰確認)', Core.meetsMoveThreshold(11, 0, Core.TOUCH_MOVE_THRESHOLD_PX) === false);

  check('不正な入力(非数値)はfalseを返す(クラッシュしない)', Core.meetsMoveThreshold('a', 0, 10) === false);
  check('thresholdPxが非数値の場合もfalseを返す', Core.meetsMoveThreshold(10, 0, undefined) === false);
})();

console.log('\n=== 13. Phase 5A: 既存Phase 3記録との後方互換性(Design v2.0 6章) ===');
(function () {
  // 旧形式(schemaVersion:1、inputMethodが'touch'/'switch'のみ、swipeを含まない)の
  // 記録をsafeReadSessions()→summarizeSessions()に通しても結果が変化しないこと。
  const legacyOnly = [
    { schemaVersion: 1, sessionId: 'legacy-1', inputMethod: 'touch', startedAt: null, endedAt: null, events: [{ type: 'activate' }, { type: 'release' }] },
    { schemaVersion: 1, sessionId: 'legacy-2', inputMethod: 'switch', startedAt: null, endedAt: null, events: [{ type: 'activate' }] }
  ];
  const storage = makeMockStorage({ [Core.STORAGE_KEY]: JSON.stringify(legacyOnly) });
  const read = Core.safeReadSessions(storage);
  check('swipe追加後も旧形式の記録を異常なく読み取れる(anomaly:null)', read.anomaly === null && read.items.length === 2);
  const legacySummary = Core.summarizeSessions(read.items);
  check('旧形式のみの記録ではswipeキーが生成されない(存在しないものを作らない)', !('swipe' in legacySummary.byInputMethod));
  check('旧形式の集計結果はswipe追加前と同じ(touch:1, switch:1)', legacySummary.byInputMethod.touch === 1 && legacySummary.byInputMethod.switch === 1 && legacySummary.sessionCount === 2);

  // swipeを含むsessionを追加保存・再読込・削除できることの確認(保存・再読込・削除)。
  const swipeSession = Core.buildSessionRecord({ sessionId: 'swipe-s1', inputMethod: 'swipe', startedAt: '2026-10-18T00:00:00.000Z', endedAt: '2026-10-18T00:02:00.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: 'swipe', timestamp: 1 })] });
  const appended = Core.appendSession(read.items, swipeSession);
  const writeResult = Core.writeSessions(storage, appended);
  check('swipeを含むsessionを既存の旧形式記録に追記して保存できる', writeResult.ok === true);

  const reread = Core.safeReadSessions(storage);
  check('保存後に再読込すると旧形式2件+swipe1件の合計3件になる', reread.items.length === 3);
  const mixedSummary = Core.summarizeSessions(reread.items);
  check('混在後の集計はswipeキーも含めて正しく分離される(入力方式を跨いで合算しない、Design v2.0 8章)', mixedSummary.byInputMethod.touch === 1 && mixedSummary.byInputMethod.switch === 1 && mixedSummary.byInputMethod.swipe === 1);

  const clearResult = Core.clearSessions(storage);
  check('swipeを含む記録一式も既存の削除経路でまとめて削除できる', clearResult.ok === true && storage.getItem(Core.STORAGE_KEY) === null);
})();

console.log('\n=== 結果 ===');
console.log('PASS:', pass, ' FAIL:', fail);
if (fail > 0) process.exit(1);
