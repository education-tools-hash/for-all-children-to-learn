/*
 * どのまな Kana Record Trace Renderer — Shared Untimed Stroke Trace
 * Validation / Canvas Rendering (Phase
 * LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1)
 *
 * hiragana-learn.html / katakana-app.htmlが保存する「traceSample」
 * (version:1, coordinateSpace:'normalized-1000', strokes:[[x,y,x,y,...],...]、
 * 24点/stroke・0..1000量子化整数、時刻情報を一切持たないuntimed handwriting
 * trace)の検証・canvas描画を、App-local Viewer（両App自身のtraceSample
 * Viewer）と共通「学習の記録」（learning-records.html）の両方から呼べる
 * 独立moduleとして提供する。
 *
 * hiragana-learn/katakana-appの実コードを確認した結果、両AppのtraceSample
 * schema・isValidTraceSample()・canvas描画ロジックは完全に同一(色のみ異なる、
 * hiragana:#4A6FA5 / katakana:#7b68d4)と確認できたため、1つの共有module
 * として実装する(過度な共通化ではなく、実際に同一のschema/ロジックへの
 * 重複実装排除)。
 *
 * さわってひろがるのassets/js/record-trace-renderer.js（timed tap/swipe
 * interaction trace、traceSchemaVersion:1、点ごとにelapsed msを持つ）とは
 * 意味・schemaが異なるため、無理に統合しない（Cross-App Detail Contract
 * §15 Over-abstraction禁止と同じ判断）。「お手本」ガイド線はKanjiVGの
 * stroke path master data + TracingEngine.sampleReferencePath()という
 * 各App自身の大きなmaster dataに依存するため、このmoduleでは扱わない
 * (Common側はガイドなしで保存済みstrokeのみを描画する、Root Investigation
 * で確認した設計判断)。
 *
 * 責務: trace schemaの検証・canvas描画(stroke polyline)・text fallback用の
 * 生カウントのみ。日本語ラベル・文言はkana-record-detail.js側の責務。
 *
 * Runtime: ブラウザ(window.donomanaKanaRecordTraceRenderer)とNode.js
 * (require)の両方で動作するUMD風の最小ラッパー(既存record-trace-renderer.js
 * と同じパターン)。canvas 2D contextを必要とする関数のみブラウザ専用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaKanaRecordTraceRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SUPPORTED_VERSION = 1;
  var COORDINATE_SPACE = 'normalized-1000';

  // hiragana-learn.html/katakana-app.htmlのisValidTraceSample()と完全に同一の
  // 検証ロジック(Source of Truth、両App実コードから移植)。NaN・文字列・負値・
  // 範囲外・stroke欠落・未知versionを拒否する。
  function isValidTraceSample(sample) {
    if (!sample || typeof sample !== 'object') return false;
    if (sample.version !== SUPPORTED_VERSION) return false;
    if (sample.coordinateSpace !== COORDINATE_SPACE) return false;
    if (!Array.isArray(sample.strokes) || sample.strokes.length === 0) return false;
    for (var i = 0; i < sample.strokes.length; i++) {
      var s = sample.strokes[i];
      if (!Array.isArray(s) || s.length === 0 || s.length % 2 !== 0) return false;
      for (var j = 0; j < s.length; j++) {
        var v = s[j];
        if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1000) return false;
      }
    }
    return true;
  }

  // text fallback用の生カウントのみ(日本語文言化は呼び出し側の責務)。
  function describeCounts(sample) {
    if (!isValidTraceSample(sample)) return { strokeCount: 0 };
    return { strokeCount: sample.strokes.length };
  }

  function clearCanvas(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // strokeのみを描画する(ガイド重ね描きはApp-local側の責務、呼び出し前に
  // 済ませておく)。strokeごとに個別beginPath()するため、別strokeが誤って
  // 線で接続されることはない(順序も保存順のまま、sortし直さない)。
  function drawStrokes(canvas, sample, options) {
    if (!canvas || !isValidTraceSample(sample)) return false;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var color = (options && options.strokeColor) || '#4A6FA5';
    sample.strokes.forEach(function (flat) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = w * 0.045;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < flat.length; i += 2) {
        var x = (flat[i] / 1000) * w, y = (flat[i + 1] / 1000) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });
    return true;
  }

  // Common Detail用の簡易呼び出し(clear + drawStrokes、ガイドなし)。
  function render(canvas, sample, options) {
    if (!canvas || !isValidTraceSample(sample)) return false;
    clearCanvas(canvas);
    return drawStrokes(canvas, sample, options);
  }

  return {
    VERSION: VERSION,
    SUPPORTED_VERSION: SUPPORTED_VERSION,
    COORDINATE_SPACE: COORDINATE_SPACE,
    isValidTraceSample: isValidTraceSample,
    describeCounts: describeCounts,
    clearCanvas: clearCanvas,
    drawStrokes: drawStrokes,
    render: render
  };
});
