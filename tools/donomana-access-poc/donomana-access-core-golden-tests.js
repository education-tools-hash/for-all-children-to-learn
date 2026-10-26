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

console.log('\n=== 14. Phase 5B-1: buildNoteRecord()・isValidNoteRecord()（Design v2.1 §4） ===');
(function () {
  const note = Core.buildNoteRecord({ sessionId: 'n1', recordedAt: '2026-10-18T00:00:00.000Z' });
  check('schemaVersion=1が付与される', note.schemaVersion === 1);
  check('sessionIdが保持される', note.sessionId === 'n1');
  check('未指定のpostureは未記録にフォールバックする', note.posture === '未記録');
  check('未指定のoperationPartは未記録にフォールバックする', note.operationPart === '未記録');
  check('未指定のsupportは{recorded:false,types:[]}にフォールバックする', note.support.recorded === false && note.support.types.length === 0);
  check('未指定のteacherImpressionは{recorded:false,observations:[]}にフォールバックする', note.teacherImpression.recorded === false && note.teacherImpression.observations.length === 0);
  check('初期状態のnoteはisValidNoteRecord()でtrue(有効な最小形)', Core.isValidNoteRecord(note) === true);

  let threw = false;
  try { Core.buildNoteRecord({ sessionId: '' }); } catch (e) { threw = true; }
  check('sessionId欠落はエラーになる', threw);

  const noteWithUnknownPosture = Core.buildNoteRecord({ sessionId: 'n2', posture: 'ベッド上', recordedAt: '2026-10-18T00:00:00.000Z' });
  check('許容値外のpostureは未記録にフォールバックする(ホワイトリスト検証)', noteWithUnknownPosture.posture === '未記録');

  check('schemaVersionが異なるレコードはisValidNoteRecord()でfalse(未知schemaVersionの保全対象)',
    Core.isValidNoteRecord(Object.assign({}, note, { schemaVersion: 2 })) === false);
  check('sessionId欠落のレコードはisValidNoteRecord()でfalse', Core.isValidNoteRecord(Object.assign({}, note, { sessionId: '' })) === false);
  check('recordedAt欠落のレコードはisValidNoteRecord()でfalse', Core.isValidNoteRecord(Object.assign({}, note, { recordedAt: null })) === false);
  check('nullはisValidNoteRecord()でfalse(クラッシュしない)', Core.isValidNoteRecord(null) === false);
})();

console.log('\n=== 15. Phase 5B-1: isValidSupport() 3状態・クロスフィールド制約（Design v2.1 §3-B・§4.1） ===');
(function () {
  check('未記録 {recorded:false,types:[]} は有効', Core.isValidSupport({ recorded: false, types: [] }) === true);
  check('特になし確認済み {recorded:true,types:[]} は有効', Core.isValidSupport({ recorded: true, types: [] }) === true);
  check('具体的支援あり {recorded:true,types:[1件]} は有効', Core.isValidSupport({ recorded: true, types: ['身体的な支援'] }) === true);
  check('複数選択 {recorded:true,types:[2件]} は有効', Core.isValidSupport({ recorded: true, types: ['身体的な支援', '声かけ・音声による促し'] }) === true);

  check('recorded=falseかつtypesが非空は矛盾として無効(§4.1)', Core.isValidSupport({ recorded: false, types: ['身体的な支援'] }) === false);
  check('許容値以外の文字列を含むtypesは無効', Core.isValidSupport({ recorded: true, types: ['添い寝'] }) === false);
  check('typesに重複があれば無効(§4.1)', Core.isValidSupport({ recorded: true, types: ['身体的な支援', '身体的な支援'] }) === false);
  check('recordedが非boolean型は無効', Core.isValidSupport({ recorded: 'yes', types: [] }) === false);
  check('typesが配列でない場合は無効', Core.isValidSupport({ recorded: true, types: '身体的な支援' }) === false);
  check('nullは無効(クラッシュしない)', Core.isValidSupport(null) === false);
})();

console.log('\n=== 16. Phase 5B-1: isValidTeacherImpression() 複数選択・「判断が難しい」排他（Design v2.1 §3-D・§4.1） ===');
(function () {
  check('未記録 {recorded:false,observations:[]} は有効', Core.isValidTeacherImpression({ recorded: false, observations: [] }) === true);
  check('単独観察 {recorded:true,observations:[1件]} は有効', Core.isValidTeacherImpression({ recorded: true, observations: ['自分から働きかける様子が見られた'] }) === true);
  check('2つの積極的観察の複数選択は許容される(序列化回避、同時両立可)',
    Core.isValidTeacherImpression({ recorded: true, observations: ['自分から働きかける様子が見られた', '促しをきっかけに働きかける様子が見られた'] }) === true);
  check('「判断が難しい」単独は有効', Core.isValidTeacherImpression({ recorded: true, observations: ['判断が難しい'] }) === true);

  check('「判断が難しい」と他の観察の同時選択はデータ層でも拒否される(§4.1)',
    Core.isValidTeacherImpression({ recorded: true, observations: ['判断が難しい', '自分から働きかける様子が見られた'] }) === false);
  check('recorded=falseかつobservationsが非空は矛盾として無効', Core.isValidTeacherImpression({ recorded: false, observations: ['判断が難しい'] }) === false);
  check('recorded=trueかつobservationsが空は無効(未記録と判断困難を区別、§4.1)', Core.isValidTeacherImpression({ recorded: true, observations: [] }) === false);
  check('許容値以外の文字列は無効', Core.isValidTeacherImpression({ recorded: true, observations: ['意欲的だった'] }) === false);
  check('observations内の重複は無効', Core.isValidTeacherImpression({ recorded: true, observations: ['判断が難しい', '判断が難しい'] }) === false);
})();

console.log('\n=== 17. Phase 5B-1: isNoteContentEmpty()（Design v2.1 §4、空レコードを作らない） ===');
(function () {
  const blank = Core.buildNoteRecord({ sessionId: 'e1', recordedAt: '2026-10-18T00:00:00.000Z' });
  check('全フィールド初期状態はisNoteContentEmpty()でtrue', Core.isNoteContentEmpty(blank) === true);

  const withPosture = Core.buildNoteRecord({ sessionId: 'e2', posture: '座位', recordedAt: '2026-10-18T00:00:00.000Z' });
  check('postureのみ記録された場合はfalse(部分入力も保存対象、§4)', Core.isNoteContentEmpty(withPosture) === false);

  const withSupportConfirmed = Core.buildNoteRecord({ sessionId: 'e3', support: { recorded: true, types: [] }, recordedAt: '2026-10-18T00:00:00.000Z' });
  check('支援「特になし確認済み」のみでもfalse(確認済みという事実そのものが内容を持つ)', Core.isNoteContentEmpty(withSupportConfirmed) === false);

  const withImpression = Core.buildNoteRecord({ sessionId: 'e4', teacherImpression: { recorded: true, observations: ['判断が難しい'] }, recordedAt: '2026-10-18T00:00:00.000Z' });
  check('teacherImpressionのみ記録された場合はfalse', Core.isNoteContentEmpty(withImpression) === false);

  check('nullはisNoteContentEmpty()でtrue(クラッシュしない)', Core.isNoteContentEmpty(null) === true);
})();

console.log('\n=== 18. Phase 5B-1: safeReadNotes()（malformed JSON/non-array、§5冒頭） ===');
(function () {
  const empty = Core.safeReadNotes(makeMockStorage({}));
  check('キー未設定はitems:[]・anomaly:null', empty.items.length === 0 && empty.anomaly === null);

  const malformed = Core.safeReadNotes(makeMockStorage({ [Core.NOTES_STORAGE_KEY]: '{not json' }));
  check('malformed JSONはitems:[]・anomaly:malformed-json', malformed.items.length === 0 && malformed.anomaly === 'malformed-json');

  const nonArray = Core.safeReadNotes(makeMockStorage({ [Core.NOTES_STORAGE_KEY]: JSON.stringify({ a: 1 }) }));
  check('non-arrayはitems:[]・anomaly:non-array', nonArray.items.length === 0 && nonArray.anomaly === 'non-array');

  const valid = Core.safeReadNotes(makeMockStorage({ [Core.NOTES_STORAGE_KEY]: JSON.stringify([{ sessionId: 'x' }]) }));
  check('正常なJSON配列はそのまま読み取れる', valid.items.length === 1 && valid.anomaly === null);

  check('notes側storageキーはlog側と完全分離されている', Core.NOTES_STORAGE_KEY !== Core.STORAGE_KEY);
  check('storageが無い場合もクラッシュしない', Core.safeReadNotes(null).items.length === 0);
})();

console.log('\n=== 19. Phase 5B-1: partitionNotes()（レコード単位の読込時検証、§5-10） ===');
(function () {
  const goodNote = Core.buildNoteRecord({ sessionId: 'g1', posture: '座位', recordedAt: '2026-10-18T00:00:00.000Z' });
  const unknownSchema = Object.assign({}, goodNote, { sessionId: 'u1', schemaVersion: 2 });
  const malformedSupport = Object.assign({}, goodNote, { sessionId: 'm1', support: { recorded: false, types: ['身体的な支援'] } });

  const result = Core.partitionNotes([goodNote, unknownSchema, malformedSupport]);
  check('正常レコードのみvalidへ分類される', result.valid.length === 1 && result.valid[0].sessionId === 'g1');
  check('未知schemaVersionはquarantinedへ分類される(削除しない、保全のみ)', result.quarantined.some(function (n) { return n.sessionId === 'u1'; }));
  check('クロスフィールド不正レコードもquarantinedへ分類される', result.quarantined.some(function (n) { return n.sessionId === 'm1'; }));
  check('quarantined側も含めて3件すべてが保全される(配列から消えない)', result.valid.length + result.quarantined.length === 3);
  check('不正レコードが1件あってもクラッシュしない(空配列入力でも同様)', JSON.stringify(Core.partitionNotes([])) === JSON.stringify({ valid: [], quarantined: [] }));
})();

console.log('\n=== 20. Phase 5B-1: upsertNote()（新規追加・既存置換・既存レコード保護、§4・§4.2） ===');
(function () {
  const note1 = Core.buildNoteRecord({ sessionId: 's1', posture: '座位', recordedAt: '2026-10-18T00:00:00.000Z' });
  const added = Core.upsertNote([], note1);
  check('空配列への新規追加は成功する', added.ok === true && added.items.length === 1);

  const note1Updated = Core.buildNoteRecord({ sessionId: 's1', posture: '立位', recordedAt: '2026-10-18T00:01:00.000Z' });
  const replaced = Core.upsertNote(added.items, note1Updated);
  check('既存の正常レコードは同一sessionIdで置換される(upsert)', replaced.ok === true && replaced.items.length === 1 && replaced.items[0].posture === '立位');

  const note2 = Core.buildNoteRecord({ sessionId: 's2', recordedAt: '2026-10-18T00:02:00.000Z' });
  const addedSecond = Core.upsertNote(replaced.items, note2);
  check('異なるsessionIdは新規レコードとして追加される(既存を上書きしない)', addedSecond.ok === true && addedSecond.items.length === 2);

  // §4.2: 既存レコードが不正・未知schemaVersionの場合、upsertを保留する
  const invalidExisting = [{ sessionId: 's3', schemaVersion: 2, posture: '座位' }];
  const newNoteForS3 = Core.buildNoteRecord({ sessionId: 's3', posture: '立位', recordedAt: '2026-10-18T00:03:00.000Z' });
  const blockedByInvalidExisting = Core.upsertNote(invalidExisting, newNoteForS3);
  check('既存レコードが未知schemaVersionの場合、upsertは保留される(無断上書きしない、§4.2)', blockedByInvalidExisting.ok === false && blockedByInvalidExisting.reason === 'existing-record-invalid');
  check('保留時も既存レコードは配列内にそのまま残る(消去しない)', blockedByInvalidExisting.items.length === 1 && blockedByInvalidExisting.items[0].sessionId === 's3');

  // §4.2: 既存配列内にsessionIdを安全に解釈できないレコードがあり、対象sessionIdの
  // 完全一致レコードが見つからない場合は、重複追加を避けるため保留する。
  const unsafeExisting = [{ sessionId: null, posture: '座位' }];
  const newNoteForS4 = Core.buildNoteRecord({ sessionId: 's4', recordedAt: '2026-10-18T00:04:00.000Z' });
  const blockedByUnsafe = Core.upsertNote(unsafeExisting, newNoteForS4);
  check('既存レコードのsessionIdが安全に解釈できない場合、upsertは保留される(安全側、§4.2)', blockedByUnsafe.ok === false && blockedByUnsafe.reason === 'unsafe-existing-sessionid');

  const invalidNewNote = Core.upsertNote([], { posture: '座位' });
  check('新規noteにsessionIdが無い場合は拒否される', invalidNewNote.ok === false && invalidNewNote.reason === 'invalid-new-note');
})();

console.log('\n=== 21. Phase 5B-1: pruneOrphanNotes()（軸A・軸Bの分離、§5-4・§5-12） ===');
(function () {
  const n1 = Core.buildNoteRecord({ sessionId: 'live-1', recordedAt: '2026-10-18T00:00:00.000Z' });
  const n2 = Core.buildNoteRecord({ sessionId: 'orphan-1', recordedAt: '2026-10-18T00:00:00.000Z' });
  const pruned = Core.pruneOrphanNotes(['live-1'], [n1, n2]);
  check('現在のlogに存在しないsessionIdの記録が除去される(軸Aのみが削除基準)', pruned.ok === true && pruned.items.length === 1 && pruned.items[0].sessionId === 'live-1');

  // 軸B: レコード自体が不正でも、sessionIdがlogに存在する限りpruneで消してはならない
  const invalidButLive = Object.assign({}, n1, { sessionId: 'live-2', schemaVersion: 2 });
  const prunedWithInvalidLive = Core.pruneOrphanNotes(['live-2'], [invalidButLive]);
  check('レコード自体が不正でもsessionIdがlogに存在すれば削除されない(軸Bだけでは削除しない、§5-12)', prunedWithInvalidLive.ok === true && prunedWithInvalidLive.items.length === 1);

  // 軸Aを安全に判定できないレコードが1件でもあれば、prune全体を保留する
  const unsafeSessionId = [{ sessionId: '' }, n1];
  const held = Core.pruneOrphanNotes(['live-1'], unsafeSessionId);
  check('sessionIdを安全に解釈できないレコードが含まれる場合、prune全体が何も削除せず保留される(§5-12)', held.ok === false && held.reason === 'unsafe-sessionid');
  check('保留時はitemsが変更されずそのまま返る', held.items.length === 2);

  check('validSessionIdsが配列でない場合はinvalid-inputとして保留する', Core.pruneOrphanNotes(null, [n1]).ok === false);
  check('notesが空配列でもクラッシュしない', Core.pruneOrphanNotes(['live-1'], []).ok === true);
})();

console.log('\n=== 22. Phase 5B-1: writeNotes()・clearNotes()・clearAllAccessData()（§5-1、notes→logs順の全件削除） ===');
(function () {
  const storage = makeMockStorage({});
  const writeResult = Core.writeNotes(storage, [{ sessionId: 'a' }]);
  check('正常な書き込みはok:true', writeResult.ok === true);
  check('書き込んだ内容が実際に読み取れる', JSON.parse(storage.getItem(Core.NOTES_STORAGE_KEY)).length === 1);

  const quotaError = new Error('quota');
  quotaError.name = 'QuotaExceededError';
  const quotaResult = Core.writeNotes(makeThrowingStorage(quotaError), [{ sessionId: 'a' }]);
  check('writeNotes()の失敗もclassifySaveError()で分類される', quotaResult.ok === false && quotaResult.reason === 'quota');

  const clearStorage = makeMockStorage({ [Core.NOTES_STORAGE_KEY]: JSON.stringify([{ sessionId: 'a' }]) });
  const clearResult = Core.clearNotes(clearStorage);
  check('clearNotes()は成功する', clearResult.ok === true);
  check('削除後はnotesキーが存在しない', clearStorage.getItem(Core.NOTES_STORAGE_KEY) === null);

  // clearAllAccessData(): notesを先に削除し、成功確認後にlogsを削除する(§5-1)
  const bothStorage = makeMockStorage({
    [Core.NOTES_STORAGE_KEY]: JSON.stringify([{ sessionId: 'a' }]),
    [Core.STORAGE_KEY]: JSON.stringify([{ sessionId: 'a' }])
  });
  const bothResult = Core.clearAllAccessData(bothStorage);
  check('両方の削除が成功した場合のみok:true', bothResult.ok === true && bothResult.notes.ok === true && bothResult.logs.ok === true);
  check('削除後は両キーとも存在しない', bothStorage.getItem(Core.NOTES_STORAGE_KEY) === null && bothStorage.getItem(Core.STORAGE_KEY) === null);

  // notes削除が失敗した場合、logs側の削除は試行されない(中断時「notesは消えたがlogsが残る」という安全側の失敗モード)
  const notesFailStorage = {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function (k) {
      if (k === Core.NOTES_STORAGE_KEY) throw new Error('fail');
      this._logsRemoved = true;
    }
  };
  const notesFailResult = Core.clearAllAccessData(notesFailStorage);
  check('notes削除が失敗した場合はok:falseで、logs削除は試行されない(§5-1)', notesFailResult.ok === false && notesFailResult.notes.ok === false && notesFailResult.logs.reason === 'not-attempted' && !notesFailStorage._logsRemoved);
})();

console.log('\n=== 23. Phase 5B-1: prune失敗時の既存データ非破壊（§5-8） ===');
(function () {
  const existingNotes = [Core.buildNoteRecord({ sessionId: 'orphan-x', recordedAt: '2026-10-18T00:00:00.000Z' })];
  const storage = makeMockStorage({ [Core.NOTES_STORAGE_KEY]: JSON.stringify(existingNotes) });

  const pruneResult = Core.pruneOrphanNotes([], existingNotes);
  check('孤立記録はpruneOrphanNotes()自体では正しく除去対象と判定される', pruneResult.ok === true && pruneResult.items.length === 0);

  // 書込(writeNotes)が失敗した場合、setItem()は呼ばれるがその場で例外を投げるため、
  // storage上の既存内容(JSON文字列)自体は変更されない(localStorageのsetItem()の
  // 全体成功/例外のいずれかという性質に基づく保証、§5-8)。
  const throwingButReadable = {
    getItem: storage.getItem,
    setItem: function () { throw new Error('quota'); },
    removeItem: storage.removeItem
  };
  const writeAfterPrune = Core.writeNotes(throwingButReadable, pruneResult.items);
  check('prune書込失敗時はok:falseを返す(失敗を成功と報告しない)', writeAfterPrune.ok === false);
  const rereadAfterFailure = Core.safeReadNotes(storage);
  check('書込失敗後も元のstorage内容(既存の保存済みnote)はそのまま読み取れる(非破壊、§5-8)',
    rereadAfterFailure.items.length === 1 && rereadAfterFailure.items[0].sessionId === 'orphan-x');
})();

console.log('\n=== 24. Phase 5B-1: MAX_SESSIONS境界 + prune連携（孤立観察記録の実際の整理フロー） ===');
(function () {
  const logStorage = makeMockStorage({});
  let logs = [];
  for (let i = 0; i < 200; i++) {
    logs = Core.appendSession(logs, Core.buildSessionRecord({ sessionId: 'sess-' + i, inputMethod: 'touch' }), Core.MAX_SESSIONS);
  }
  check('200件目まではappendSession()で全件保持される', logs.length === 200);
  check('先頭(sess-0)はまだ存在する(201件目追加前)', logs.some(function (s) { return s.sessionId === 'sess-0'; }));

  const notesForAll = logs.map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, recordedAt: '2026-10-18T00:00:00.000Z' });
  });

  // 201件目を追加 → sess-0がappendSession()により切り捨てられる
  logs = Core.appendSession(logs, Core.buildSessionRecord({ sessionId: 'sess-200', inputMethod: 'touch' }), Core.MAX_SESSIONS);
  check('201件目追加後も件数はMAX_SESSIONS(200)で維持される', logs.length === 200);
  check('最古のsess-0はログから切り捨てられている', !logs.some(function (s) { return s.sessionId === 'sess-0'; }));

  const validIds = logs.map(function (s) { return s.sessionId; });
  const pruneResult = Core.pruneOrphanNotes(validIds, notesForAll);
  check('ログから切り捨てられたsess-0に対応する観察記録のみがpruneされる', pruneResult.ok === true && pruneResult.items.length === 199);
  check('切り捨てられたsess-0のnoteはprune後に存在しない', !pruneResult.items.some(function (n) { return n.sessionId === 'sess-0'; }));
  check('残っているsess-1のnoteはprune後も存在する(軸Aの対応関係どおり)', pruneResult.items.some(function (n) { return n.sessionId === 'sess-1'; }));

  // anomaly発生時(malformed JSON)はこの層ではprune判定自体を行わない設計であり、
  // 呼び出し側(donomana-access.html のattemptNotesPrune())がsafeReadSessions()/
  // safeReadNotes()のanomalyを確認してから本関数を呼ぶ責務を持つ(§5-5〜§5-7)。
  const logReadAnomaly = Core.safeReadSessions(makeMockStorage({ [Core.STORAGE_KEY]: '{bad' }));
  check('ログ側がmalformed JSONの場合、safeReadSessions()はanomalyを返す(呼び出し側がpruneをスキップする判断材料になる)', logReadAnomaly.anomaly === 'malformed-json');
})();

console.log('\n=== 25. Phase 6: computeLayer1Metrics() — 入力方式別集計・欠損値・境界値 ===');
(function () {
  const s1 = Core.buildSessionRecord({
    sessionId: 'p6-t1', inputMethod: 'touch', startedAt: '2026-10-20T00:00:00.000Z', endedAt: '2026-10-20T00:00:10.000Z',
    events: [
      Core.makeEvent({ type: 'activate', inputMethod: 'touch' }),
      Core.makeEvent({ type: 'activate', inputMethod: 'touch' }),
      Core.makeEvent({ type: 'cancel', inputMethod: 'touch' }),
      Core.makeEvent({ type: 'move', inputMethod: 'touch' })
    ]
  });
  const s2 = Core.buildSessionRecord({
    sessionId: 'p6-t2', inputMethod: 'touch', startedAt: '2026-10-20T00:01:00.000Z', endedAt: '2026-10-20T00:01:20.000Z',
    events: [Core.makeEvent({ type: 'activate', inputMethod: 'touch' }), Core.makeEvent({ type: 'release', inputMethod: 'touch' })]
  });
  // startedAt/endedAtが欠損したセッション(欠損値・旧データ想定)。activateは算出できるが
  // 活動時間は算出できない。
  const s3 = Core.buildSessionRecord({ sessionId: 'p6-t3', inputMethod: 'touch', events: [Core.makeEvent({ type: 'activate', inputMethod: 'touch' })] });
  const s4 = Core.buildSessionRecord({
    sessionId: 'p6-sw1', inputMethod: 'switch', startedAt: '2026-10-20T00:02:00.000Z', endedAt: '2026-10-20T00:02:05.000Z',
    events: [Core.makeEvent({ type: 'activate', inputMethod: 'switch' })]
  });

  const metrics = Core.computeLayer1Metrics([s1, s2, s3, s4]);
  check('touch方式のsessionCountは3(欠損セッションも数える)', metrics.touch.sessionCount === 3);
  check('touch方式のactivateCountは4(全セッション分の合計)', metrics.touch.activateCount === 4);
  check('touch方式のcancelCountは1(入力方式ごとに独立)', metrics.touch.cancelCount === 1);
  check('touch方式のreleaseCountは1', metrics.touch.releaseCount === 1);
  check('touch方式のmovedSessionCountは1(moveが観測されたセッション数)', metrics.touch.movedSessionCount === 1);
  check('averageActivateCountの分母は欠損を除外しない全セッション数(4/3)', Math.abs(metrics.touch.averageActivateCount - (4 / 3)) < 1e-9);
  check('averageDurationMsの分母は有効な時間データを持つセッション数のみ(s3を除く2件)', metrics.touch.totalDurationMs === 10000 + 20000);
  check('averageDurationMsはs3を除外して算出される', metrics.touch.averageDurationMs === 15000);
  check('switch方式は別キーとして分離集計される', metrics.switch.sessionCount === 1 && metrics.switch.activateCount === 1);

  const empty = Core.computeLayer1Metrics([]);
  check('空配列は{}を返す', Object.keys(empty).length === 0);
  const nonArray = Core.computeLayer1Metrics('not-an-array');
  check('配列でない入力はクラッシュせず{}を返す(エラー時の安全側)', Object.keys(nonArray).length === 0);

  // 旧データ(Phase 3時点、swipe区分が存在しない記録)との後方互換性。
  const legacy = Core.buildSessionRecord({ sessionId: 'legacy-1', inputMethod: 'touch', events: [] });
  const legacyMetrics = Core.computeLayer1Metrics([legacy]);
  check('Phase 3時点の旧データ(スワイプ区分なし)もそのまま集計対象になる', legacyMetrics.touch.sessionCount === 1 && legacyMetrics.touch.activateCount === 0);
})();

console.log('\n=== 26. Phase 6: classifySupportCondition() — 3区分への分類 ===');
(function () {
  const unrecordedNote = Core.buildNoteRecord({ sessionId: 'n1', recordedAt: '2026-10-20T00:00:00.000Z' });
  check('未記録(support.recorded=false)は"unrecorded"に分類される', Core.classifySupportCondition(unrecordedNote) === 'unrecorded');

  const noneConfirmedNote = Core.buildNoteRecord({ sessionId: 'n2', support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' });
  check('特になし確認済み(recorded=true・types空)は"none-confirmed"に分類される', Core.classifySupportCondition(noneConfirmedNote) === 'none-confirmed');

  const supportGivenNote = Core.buildNoteRecord({ sessionId: 'n3', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-20T00:00:00.000Z' });
  check('具体的支援あり(recorded=true・types非空)は"support-given"に分類される', Core.classifySupportCondition(supportGivenNote) === 'support-given');

  check('noteがnullの場合はnullを返す(クラッシュしない)', Core.classifySupportCondition(null) === null);
  check('不正なnote(オブジェクトでない)はnullを返す', Core.classifySupportCondition('not-a-note') === null);
})();

console.log('\n=== 27. Phase 6: evaluateGates() — C1・C2境界値 ===');
(function () {
  function sessWithDuration(id, method, startIso, endIso) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: startIso, endedAt: endIso, events: [Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }

  // C1: 両方式とも2件以上 → passed
  const touchOk = [sessWithDuration('c1-t1', 'touch', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:10.000Z'), sessWithDuration('c1-t2', 'touch', '2026-10-20T00:01:00.000Z', '2026-10-20T00:01:10.000Z')];
  const swipeOk = [sessWithDuration('c1-s1', 'swipe', '2026-10-20T00:02:00.000Z', '2026-10-20T00:02:10.000Z'), sessWithDuration('c1-s2', 'swipe', '2026-10-20T00:03:00.000Z', '2026-10-20T00:03:10.000Z')];
  const r1 = Core.evaluateGates({ touch: touchOk, swipe: swipeOk }, []);
  check('両方式とも2件以上ならC1はpassed', r1.C1.state === 'passed' && r1.C1.blocks === false);

  // C1: 片方が1件のみ → failed、該当方式名を含む
  const swipeShort = [sessWithDuration('c1-s3', 'swipe', '2026-10-20T00:02:00.000Z', '2026-10-20T00:02:10.000Z')];
  const r2 = Core.evaluateGates({ touch: touchOk, swipe: swipeShort }, []);
  check('片方が1件のみならC1はfailed', r2.C1.state === 'failed' && r2.C1.blocks === true);
  check('C1のreasonに不足している方式名が含まれる', r2.C1.reason.indexOf('swipe') !== -1);

  // C1: 両方式とも1件以下 → 両方の方式名を含む
  const r3 = Core.evaluateGates({ touch: [touchOk[0]], swipe: swipeShort }, []);
  check('両方式とも1件以下の場合、両方の方式名がreasonに含まれる', r3.C1.reason.indexOf('touch') !== -1 && r3.C1.reason.indexOf('swipe') !== -1);

  // C2: 活動時間が揃っている(10秒 vs 10秒) → passed
  check('活動時間が揃っている場合C2はpassed', r1.C2.state === 'passed' && r1.C2.blocks === false);

  // C2: 活動時間が大きく異なる(10秒 vs 100秒) → failed
  const swipeLong = [sessWithDuration('c2-s1', 'swipe', '2026-10-20T00:02:00.000Z', '2026-10-20T00:03:40.000Z'), sessWithDuration('c2-s2', 'swipe', '2026-10-20T00:04:00.000Z', '2026-10-20T00:05:40.000Z')];
  const r4 = Core.evaluateGates({ touch: touchOk, swipe: swipeLong }, []);
  check('活動時間が±30%を超えて異なる場合C2はfailed', r4.C2.state === 'failed' && r4.C2.blocks === true);

  // C2: 片方に有効な活動時間データが全くない → unknown(ブロックする)
  const swipeNoDuration = [
    Core.buildSessionRecord({ sessionId: 'c2-nd1', inputMethod: 'swipe', events: [Core.makeEvent({ type: 'activate', inputMethod: 'swipe' })] }),
    Core.buildSessionRecord({ sessionId: 'c2-nd2', inputMethod: 'swipe', events: [Core.makeEvent({ type: 'activate', inputMethod: 'swipe' })] })
  ];
  const r5 = Core.evaluateGates({ touch: touchOk, swipe: swipeNoDuration }, []);
  check('活動時間データが皆無の場合C2はunknown(passedとみなさない)', r5.C2.state === 'unknown' && r5.C2.blocks === true);

  // 比較対象が2方式でない場合は安全にブロックする
  const r6 = Core.evaluateGates({ touch: touchOk }, []);
  check('比較対象が1方式のみの場合はクラッシュせずcanShowSuggestion:falseを返す', r6.canShowSuggestion === false);
  const r7 = Core.evaluateGates('not-an-object', []);
  check('sessionsByMethodが不正な型でもクラッシュしない', r7.canShowSuggestion === false);
})();

console.log('\n=== 28. Phase 6: evaluateGates() — C3（スキャン速度は常にunknown） ===');
(function () {
  function sess(id, method) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: '2026-10-20T00:00:00.000Z', endedAt: '2026-10-20T00:00:10.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }
  const touchPair = [sess('c3-t1', 'touch'), sess('c3-t2', 'touch')];
  const swipePair = [sess('c3-s1', 'swipe'), sess('c3-s2', 'swipe')];
  const switchPair = [sess('c3-sw1', 'switch'), sess('c3-sw2', 'switch')];

  const noSwitch = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, []);
  check('switch方式を含まない比較ではC3はnot_applicable', noSwitch.C3.state === 'not_applicable' && noSwitch.C3.blocks === false);

  const withSwitch = Core.evaluateGates({ touch: touchPair, switch: switchPair }, []);
  check('switch方式を含む比較ではC3は常にunknown(ブロックする)', withSwitch.C3.state === 'unknown' && withSwitch.C3.blocks === true);

  // 単純なboolean宣言をpassedの根拠として受け取る引数は存在しない(FINAL-CONTRACT-1第1節)。
  const withSwitchAndFlag = Core.evaluateGates({ touch: touchPair, switch: switchPair }, [], { scanSpeedAssumedUniform: true });
  check('余分な第3引数を渡してもC3はunknownのまま変わらない(passedへの経路がない)', withSwitchAndFlag.C3.state === 'unknown');
})();

console.log('\n=== 29. Phase 6: evaluateGates() — C4（支援の有無のみで判定） ===');
(function () {
  function sess(id, method) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: '2026-10-20T00:00:00.000Z', endedAt: '2026-10-20T00:00:10.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }
  const touchPair = [sess('c4-t1', 'touch'), sess('c4-t2', 'touch')];
  const swipePair = [sess('c4-s1', 'swipe'), sess('c4-s2', 'swipe')];

  // not_applicable: noteが1件も存在しない
  const r1 = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, []);
  check('対応するnoteが一切ない場合C4はnot_applicable', r1.C4.state === 'not_applicable' && r1.C4.blocks === false);

  // unknown: noteは存在するがsupportが未記録
  const unrecordedNotes = [].concat(touchPair, swipePair).map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, recordedAt: '2026-10-20T00:00:00.000Z' });
  });
  const r2 = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, unrecordedNotes);
  check('noteはあるがsupportが未記録ならC4はunknown', r2.C4.state === 'unknown' && r2.C4.blocks === false);

  // passed: 全セッションが「特になし確認済み」
  const noneNotes = [].concat(touchPair, swipePair).map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' });
  });
  const r3 = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, noneNotes);
  check('全セッションが「特になし確認済み」ならC4はpassed', r3.C4.state === 'passed' && r3.C4.blocks === false);

  // passed: 全セッションが「具体的支援あり」だが、種類(types)が互いに異なる場合も
  // passed(本Phaseでは種類どうしの同等性を判定しない、Implementation-1補足条件2)。
  const mixedTypeSupportNotes = [
    Core.buildNoteRecord({ sessionId: 'c4-t1', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-t2', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-s1', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-s2', support: { recorded: true, types: ['身体的な支援', '姿勢・機器配置などの環境調整'] }, recordedAt: '2026-10-20T00:00:00.000Z' })
  ];
  const r4 = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, mixedTypeSupportNotes);
  check('「具体的支援あり」同士で種類(types)が異なってもC4はpassed(種類の同等性は判定しない)', r4.C4.state === 'passed' && r4.C4.blocks === false);

  // failed: 「特になし確認済み」と「具体的支援あり」が混在する場合
  const mixedPresenceNotes = [
    Core.buildNoteRecord({ sessionId: 'c4-t1', support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-t2', support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-s1', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4-s2', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-20T00:00:00.000Z' })
  ];
  const r5 = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, mixedPresenceNotes);
  check('支援の有無(特になし確認済み／具体的支援あり)が混在する場合C4はfailed', r5.C4.state === 'failed' && r5.C4.blocks === true);
  check('C4のreasonはv2.0の文言どおり', r5.C4.reason === '支援の有無が異なる記録が含まれています');
})();

console.log('\n=== 30. Phase 6: generateReferenceMessages() — unverifiedConditionsの常時生成 ===');
(function () {
  function sess(id, method) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: '2026-10-20T00:00:00.000Z', endedAt: '2026-10-20T00:00:10.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: method }), Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }
  const touchPair = [sess('u-t1', 'touch'), sess('u-t2', 'touch')];
  const swipePair = [sess('u-s1', 'swipe'), sess('u-s2', 'swipe')];
  const layer1 = { touch: Core.computeLayer1Metrics(touchPair).touch, swipe: Core.computeLayer1Metrics(swipePair).swipe };

  // C4がnot_applicable、他ゲートはpassed → canShowSuggestion:trueだがunverifiedConditionsも生成される
  const gateNotApplicable = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, []);
  check('前提: このケースではcanShowSuggestionはtrue', gateNotApplicable.canShowSuggestion === true);
  const msgsNotApplicable = Core.generateReferenceMessages(gateNotApplicable, layer1);
  check('canShowSuggestion:trueでも、C4がnot_applicableならunverifiedConditionsが生成される', msgsNotApplicable.unverifiedConditions.length === 1);
  check('messagesも同時に生成される(両立する)', msgsNotApplicable.messages.length >= 1);

  // C4がfailed(ブロックする)場合はunverifiedConditionsではなくholdReasonsに入る
  const mixedPresenceNotes = [
    Core.buildNoteRecord({ sessionId: 'u-t1', support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'u-t2', support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'u-s1', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-20T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'u-s2', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-20T00:00:00.000Z' })
  ];
  const gateFailed = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, mixedPresenceNotes);
  const msgsFailed = Core.generateReferenceMessages(gateFailed, layer1);
  check('C4がfailedの場合はcanShowSuggestionがfalseになる', gateFailed.canShowSuggestion === false);
  check('failed時はholdReasonsにC4の理由が入る', msgsFailed.holdReasons.indexOf('支援の有無が異なる記録が含まれています') !== -1);
  check('failed時はunverifiedConditionsは生成されない(stateがunknown/not_applicableではないため)', msgsFailed.unverifiedConditions.length === 0);

  check('不正なgateResultでもクラッシュせず空の結果を返す', (function () { const r = Core.generateReferenceMessages(null, layer1); return r.messages.length === 0 && r.holdReasons.length === 0 && r.unverifiedConditions.length === 0; })());
})();

console.log('\n=== 31. Phase 6: generateReferenceMessages() — R1文言(入力開始イベントのみ)・holdReasons ===');
(function () {
  function sess(id, method) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: '2026-10-20T00:00:00.000Z', endedAt: '2026-10-20T00:00:10.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: method }), Core.makeEvent({ type: 'cancel', inputMethod: method })] });
  }
  const touchPair = [sess('r1-t1', 'touch'), sess('r1-t2', 'touch')];
  const swipePair = [sess('r1-s1', 'swipe'), sess('r1-s2', 'swipe')];
  const noneNotes = [].concat(touchPair, swipePair).map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, support: { recorded: true, types: [] }, recordedAt: '2026-10-20T00:00:00.000Z' });
  });
  const gate = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, noneNotes);
  const layer1 = { touch: Core.computeLayer1Metrics(touchPair).touch, swipe: Core.computeLayer1Metrics(swipePair).swipe };
  const msgs = Core.generateReferenceMessages(gate, layer1);

  check('canShowSuggestion:trueの場合R1メッセージが1件生成される', msgs.messages.length === 1 && msgs.messages[0].code === 'R1');
  check('R1文言は「入力開始イベント(activate)」という表記を含む', msgs.messages[0].text.indexOf('入力開始イベント(activate)') !== -1);
  check('R1文言に"cancel"や"キャンセル"という語を含まない(activateのみを集計対象とする)', msgs.messages[0].text.indexOf('cancel') === -1 && msgs.messages[0].text.indexOf('キャンセル') === -1);
  check('R1文言に"はたらきかけ"という表現を使わない(主体性を暗示する語を避ける)', msgs.messages[0].text.indexOf('はたらきかけ') === -1);

  // ブロックされた場合: holdReasonsが生成され、messagesは空
  const shortTouch = [touchPair[0]];
  const gateBlocked = Core.evaluateGates({ touch: shortTouch, swipe: swipePair }, noneNotes);
  const msgsBlocked = Core.generateReferenceMessages(gateBlocked, layer1);
  check('ブロックされた場合messagesは空', msgsBlocked.messages.length === 0);
  check('ブロックされた場合holdReasonsに理由が入る', msgsBlocked.holdReasons.length >= 1);

  // averageActivateCountが数値でない場合のフォールバック文言
  const brokenLayer1 = { touch: { averageActivateCount: null }, swipe: { averageActivateCount: null } };
  const msgsFallback = Core.generateReferenceMessages(gate, brokenLayer1);
  check('averageActivateCountが算出できない場合、数値を0等で代用せずフォールバック文言になる', msgsFallback.messages[0].text.indexOf('算出できませんでした') !== -1);
})();

console.log('\n=== 32. Phase 6: 入力方式間cancel合算禁止・R3非対象の回帰テスト ===');
(function () {
  const touchSessions = [
    Core.buildSessionRecord({ sessionId: 'reg-t1', inputMethod: 'touch', events: [Core.makeEvent({ type: 'cancel', inputMethod: 'touch' }), Core.makeEvent({ type: 'cancel', inputMethod: 'touch' })] })
  ];
  const switchSessions = [
    Core.buildSessionRecord({ sessionId: 'reg-sw1', inputMethod: 'switch', events: [Core.makeEvent({ type: 'cancel', inputMethod: 'switch' })] })
  ];
  const metrics = Core.computeLayer1Metrics(touchSessions.concat(switchSessions));
  check('cancelCountは入力方式別に保持される(touch=2, switch=1)', metrics.touch.cancelCount === 2 && metrics.switch.cancelCount === 1);
  check('出力オブジェクトに入力方式を跨いだ合算フィールドが存在しない', Object.keys(metrics).indexOf('totalCancelCount') === -1 && Object.keys(metrics).indexOf('cancelRanking') === -1);

  const gate = Core.evaluateGates({ touch: [Core.buildSessionRecord({ sessionId: 'r3-t1', inputMethod: 'touch' }), Core.buildSessionRecord({ sessionId: 'r3-t2', inputMethod: 'touch' })], switch: [Core.buildSessionRecord({ sessionId: 'r3-s1', inputMethod: 'switch' }), Core.buildSessionRecord({ sessionId: 'r3-s2', inputMethod: 'switch' })] }, []);
  const msgs = Core.generateReferenceMessages(gate, {});
  const allCodes = msgs.messages.map(function (m) { return m.code; });
  check('生成されるメッセージのcodeにR3は含まれない(R1/R2のみ)', allCodes.indexOf('R3') === -1);
  check('cancel比率に関するフィールドが一切出力されない', JSON.stringify(gate).indexOf('cancelRatio') === -1 && JSON.stringify(msgs).indexOf('cancelRatio') === -1);
})();

console.log('\n=== 33. Phase 6完了補完: evaluateGates() — C2の境界値・順序不変性 ===');
(function () {
  function sessWithDurationSec(id, method, durationSec) {
    const start = '2026-10-26T00:00:00.000Z';
    const end = new Date(Date.parse(start) + durationSec * 1000).toISOString();
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: start, endedAt: end, events: [Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }

  // a=17秒, b=23秒 → |17-23|/((17+23)/2) = 6/20 = 0.30 ちょうど境界(<=0.30でpassed)。
  const touchAtBoundary = [sessWithDurationSec('c2b-t1', 'touch', 17), sessWithDurationSec('c2b-t2', 'touch', 17)];
  const swipeAtBoundary = [sessWithDurationSec('c2b-s1', 'swipe', 23), sessWithDurationSec('c2b-s2', 'swipe', 23)];
  const atBoundary = Core.evaluateGates({ touch: touchAtBoundary, swipe: swipeAtBoundary }, []);
  check('比率がちょうど0.30(境界)の場合はpassed(<=0.30を満たす側)', atBoundary.C2.state === 'passed' && atBoundary.C2.blocks === false);

  // 境界をわずかに超える(17秒 vs 24秒 → 7/20.5 ≈ 0.3415)場合はfailed。
  const swipeOutside = [sessWithDurationSec('c2o-s1', 'swipe', 24), sessWithDurationSec('c2o-s2', 'swipe', 24)];
  const outsideBoundary = Core.evaluateGates({ touch: touchAtBoundary, swipe: swipeOutside }, []);
  check('境界をわずかに超える場合はfailed(境界外)', outsideBoundary.C2.state === 'failed' && outsideBoundary.C2.blocks === true);

  // 明確に境界内(17秒 vs 20秒 → 3/18.5 ≈ 0.162)。
  const swipeInside = [sessWithDurationSec('c2i-s1', 'swipe', 20), sessWithDurationSec('c2i-s2', 'swipe', 20)];
  const clearlyInside = Core.evaluateGates({ touch: touchAtBoundary, swipe: swipeInside }, []);
  check('明確に境界内の場合はpassed', clearlyInside.C2.state === 'passed');

  // 比較する2方式の順序を入れ替えても、対称な式のためC2の結果は変わらない。
  const swapped = Core.evaluateGates({ swipe: swipeOutside, touch: touchAtBoundary }, []);
  check('2方式の順序を入れ替えてもC2の判定結果(state)は変わらない', swapped.C2.state === outsideBoundary.C2.state);
  check('2方式の順序を入れ替えてもC1の判定結果(state)は変わらない', swapped.C1.state === outsideBoundary.C1.state);
})();

console.log('\n=== 34. Phase 6完了補完: evaluateGates() — C4の追加境界・否定ケース ===');
(function () {
  function sess(id, method) {
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: '2026-10-26T00:00:00.000Z', endedAt: '2026-10-26T00:00:10.000Z', events: [Core.makeEvent({ type: 'activate', inputMethod: method })] });
  }

  // 重複sessionId: 同一IDが比較対象内に複数回出現しても、集合判定(indexOf)の
  // ため結果は崩れない。
  const dupTouch = [sess('c4c-dup1', 'touch'), sess('c4c-dup1', 'touch')];
  const dupSwipe = [sess('c4c-dup2', 'swipe'), sess('c4c-dup2', 'swipe')];
  const dupNotes = [
    Core.buildNoteRecord({ sessionId: 'c4c-dup1', support: { recorded: true, types: [] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-dup2', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-26T00:00:00.000Z' })
  ];
  const dupResult = Core.evaluateGates({ touch: dupTouch, swipe: dupSwipe }, dupNotes);
  check('重複sessionIdが含まれていてもC4の判定(支援の有無相違→failed)は崩れない', dupResult.C4.state === 'failed' && dupResult.C4.blocks === true);

  // 未知schemaVersion等の不正note: isValidNoteRecord()に適合しないため、
  // noteなしと同じnot_applicable扱いになる。
  const touchPair = [sess('c4c-t1', 'touch'), sess('c4c-t2', 'touch')];
  const swipePair = [sess('c4c-s1', 'swipe'), sess('c4c-s2', 'swipe')];
  const malformedNote = {
    schemaVersion: 999, sessionId: 'c4c-t1', posture: '未記録',
    support: { recorded: true, types: [] }, operationPart: '未記録',
    teacherImpression: { recorded: false, observations: [] }, recordedAt: '2026-10-26T00:00:00.000Z'
  };
  const invalidResult = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, [malformedNote]);
  check('未知schemaVersionの不正noteはnoteなしと同じnot_applicable扱いになる', invalidResult.C4.state === 'not_applicable' && invalidResult.C4.blocks === false);

  // support未記録(全セッションでsupport.recorded===false) → unknown。
  const unrecordedNotes = [].concat(touchPair, swipePair).map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, recordedAt: '2026-10-26T00:00:00.000Z' });
  });
  const unrecordedResult = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, unrecordedNotes);
  check('全セッションでsupportが未記録の場合C4はunknown(ブロックしない)', unrecordedResult.C4.state === 'unknown' && unrecordedResult.C4.blocks === false);

  // 支援の有無が異なる場合 → failed。
  const presenceMixedNotes = [
    Core.buildNoteRecord({ sessionId: 'c4c-t1', support: { recorded: true, types: [] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-t2', support: { recorded: true, types: [] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-s1', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-s2', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-26T00:00:00.000Z' })
  ];
  const presenceMixedResult = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, presenceMixedNotes);
  check('支援の有無(特になし確認済み/具体的支援あり)が異なる場合C4はfailed', presenceMixedResult.C4.state === 'failed' && presenceMixedResult.C4.blocks === true);

  // 支援種類のみ異なる場合(全セッションが「具体的支援あり」) → passed。
  const typeOnlyDifferentNotes = [
    Core.buildNoteRecord({ sessionId: 'c4c-t1', support: { recorded: true, types: ['声かけ・音声による促し'] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-t2', support: { recorded: true, types: ['視覚的な提示・促し'] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-s1', support: { recorded: true, types: ['身体的な支援'] }, recordedAt: '2026-10-26T00:00:00.000Z' }),
    Core.buildNoteRecord({ sessionId: 'c4c-s2', support: { recorded: true, types: ['姿勢・機器配置などの環境調整'] }, recordedAt: '2026-10-26T00:00:00.000Z' })
  ];
  const typeOnlyResult = Core.evaluateGates({ touch: touchPair, swipe: swipePair }, typeOnlyDifferentNotes);
  check('支援の種類(types)のみが互いに異なる場合はC4はpassed(種類の同等性は判定しない)', typeOnlyResult.C4.state === 'passed' && typeOnlyResult.C4.blocks === false);
})();

console.log('\n=== 35. Phase 6完了補完: buildComparisonViewModel() — Phase 7向け統合出力契約 ===');
(function () {
  function sess(id, method, startSec, endSec) {
    const start = new Date(Date.parse('2026-10-26T00:00:00.000Z') + startSec * 1000).toISOString();
    const end = new Date(Date.parse('2026-10-26T00:00:00.000Z') + endSec * 1000).toISOString();
    return Core.buildSessionRecord({ sessionId: id, inputMethod: method, startedAt: start, endedAt: end, events: [Core.makeEvent({ type: 'activate', inputMethod: method }), Core.makeEvent({ type: 'cancel', inputMethod: method })] });
  }

  const touchSessions = [sess('vm-t1', 'touch', 0, 17), sess('vm-t2', 'touch', 100, 117)];
  const swipeSessions = [sess('vm-s1', 'swipe', 0, 20), sess('vm-s2', 'swipe', 100, 120)];
  const switchSessions = [sess('vm-sw1', 'switch', 0, 15), sess('vm-sw2', 'switch', 100, 115)];
  const allSessions = touchSessions.concat(swipeSessions, switchSessions);
  const noneNotes = [].concat(touchSessions, swipeSessions).map(function (s) {
    return Core.buildNoteRecord({ sessionId: s.sessionId, support: { recorded: true, types: [] }, recordedAt: '2026-10-26T00:00:00.000Z' });
  });

  // --- A. 必須フィールドがすべて存在すること・比較対象が異なる2方式であること ---
  const vm = Core.buildComparisonViewModel(allSessions, noneNotes, 'touch', 'swipe');
  check('layer1フィールドが存在する', vm.layer1 && typeof vm.layer1 === 'object');
  check('layer1は比較対象外のswitch方式も含む全入力方式を対象に算出される(常時表示の原則)', vm.layer1.switch && vm.layer1.switch.sessionCount === 2);
  check('layer2フィールドが存在する', vm.layer2 && typeof vm.layer2 === 'object');
  check('layer2.comparisonMethodsは異なる2方式の配列', Array.isArray(vm.layer2.comparisonMethods) && vm.layer2.comparisonMethods.length === 2 && vm.layer2.comparisonMethods[0] !== vm.layer2.comparisonMethods[1]);
  check('layer2.comparisonMethodsが指定した2方式と一致する', vm.layer2.comparisonMethods[0] === 'touch' && vm.layer2.comparisonMethods[1] === 'swipe');
  check('layer2.gatesにC1〜C4がすべて存在する', ['C1', 'C2', 'C3', 'C4'].every(function (c) { return vm.layer2.gates[c] && typeof vm.layer2.gates[c].state === 'string'; }));
  check('layer2.canShowSuggestionが真偽値', typeof vm.layer2.canShowSuggestion === 'boolean');
  check('layer2.messages/holdReasons/unverifiedConditionsが配列', Array.isArray(vm.layer2.messages) && Array.isArray(vm.layer2.holdReasons) && Array.isArray(vm.layer2.unverifiedConditions));

  // --- disclaimer / activateCountDisclaimerの存在 ---
  check('disclaimerがDesign v2.0 3.3節の文言を含む(「子ども本人の入力方法の適性や能力」の一節)', typeof vm.disclaimer === 'string' && vm.disclaimer.indexOf('子ども本人の入力方法の適性や能力') !== -1);
  check('activateCountDisclaimerが主体性・意欲・能力の指標ではない旨を含む', typeof vm.activateCountDisclaimer === 'string' && vm.activateCountDisclaimer.indexOf('主体性・意欲・能力を示す指標ではありません') !== -1);

  // --- C4 unknown/not_applicable時のunverifiedConditions維持(canShowSuggestion:trueでも) ---
  const vmNoNotes = Core.buildComparisonViewModel(touchSessions.concat(swipeSessions), [], 'touch', 'swipe');
  check('C4がnot_applicableの場合、canShowSuggestionの値に関わらずunverifiedConditionsが維持される', vmNoNotes.layer2.unverifiedConditions.length === 1);

  // --- C3 unknown時、switch方式を含む比較ではR1/R2を生成しない(提案保留) ---
  const vmSwitch = Core.buildComparisonViewModel(allSessions, noneNotes, 'touch', 'switch');
  check('switch方式を含む比較ではcanShowSuggestionがfalseになる(C3がunknownのため)', vmSwitch.layer2.canShowSuggestion === false);
  check('switch方式を含む比較ではmessagesが生成されない(R1/R2とも保留)', vmSwitch.layer2.messages.length === 0);
  check('switch方式を含む比較ではholdReasonsにC3の理由が含まれる', vmSwitch.layer2.holdReasons.indexOf('スキャン速度が記録からは確認できません') !== -1);

  // --- R3が生成されないこと・cancelの入力方式間合算/ランキングが生成されないこと ---
  const allCodes = vm.layer2.messages.map(function (m) { return m.code; }).concat(vmSwitch.layer2.messages.map(function (m) { return m.code; }));
  check('生成されるメッセージのcodeにR3は含まれない', allCodes.indexOf('R3') === -1);
  const serialized = JSON.stringify(vm) + JSON.stringify(vmSwitch);
  check('出力全体にcancelの入力方式間合算・ランキングに相当するフィールドが存在しない', serialized.indexOf('cancelRatio') === -1 && serialized.indexOf('totalCancelCount') === -1 && serialized.indexOf('cancelRanking') === -1);

  // --- 比較対象が異なる2方式でない場合(同一方式・不正値)の安全な出力 ---
  const vmSameMethod = Core.buildComparisonViewModel(allSessions, noneNotes, 'touch', 'touch');
  check('同一方式どうしの比較指定ではcomparisonMethodsがnullになる', vmSameMethod.layer2.comparisonMethods === null);
  check('同一方式どうしの比較指定ではcanShowSuggestionがfalseになり根拠のない提案を生成しない', vmSameMethod.layer2.canShowSuggestion === false && vmSameMethod.layer2.messages.length === 0);
  const vmInvalid = Core.buildComparisonViewModel(allSessions, noneNotes, 'touch', null);
  check('比較対象の一方が不正な値(非文字列)の場合もクラッシュせず安全な出力になる', vmInvalid.layer2.comparisonMethods === null && vmInvalid.layer2.canShowSuggestion === false);
  const vmNonArray = Core.buildComparisonViewModel('not-an-array', 'not-an-array', 'touch', 'swipe');
  check('sessions/notesが配列でない場合もクラッシュしない', Object.keys(vmNonArray.layer1).length === 0 && vmNonArray.layer2.canShowSuggestion === false);

  // layer1(全体)にtotalCancelCount等の入力方式を跨いだ合算フィールドが存在しないことも確認。
  check('layer1にも入力方式を跨いだ合算フィールドが存在しない', Object.keys(vm.layer1).indexOf('totalCancelCount') === -1);
})();

console.log('\n=== 結果 ===');
console.log('PASS:', pass, ' FAIL:', fail);
if (fail > 0) process.exit(1);
