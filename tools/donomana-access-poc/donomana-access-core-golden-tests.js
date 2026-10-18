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

console.log('\n=== 結果 ===');
console.log('PASS:', pass, ' FAIL:', fail);
if (fail > 0) process.exit(1);
