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

console.log('\n=== 結果 ===');
console.log('PASS:', pass, ' FAIL:', fail);
if (fail > 0) process.exit(1);
