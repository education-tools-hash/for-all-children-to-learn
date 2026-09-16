/*
 * どのまな Record Trace Renderer — Shared Trace Schema Validation / Canvas
 * Rendering (Phase SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1)
 *
 * 「操作の軌跡」（traceSchemaVersion:1、
 * docs/design-system/donomana-sawatte-hirogaru-trace-record-contract-v1_0.md
 * §7 Trace Schema）の検証・canvas描画を、App-local Viewer（sawatte-hirogaru-
 * app.html）と共通「学習の記録」（learning-records.html）の両方から呼べる
 * 独立moduleとして提供する（Cross-App Detail Contract §10 Shared Trace
 * Renderer Architecture）。
 *
 * 責務（Contract §23/§24）: trace schemaの検証・canvas描画（tap dot／swipe
 * path）・trimmed判定・text fallback用の生カウントのみ。日本語ラベル・
 * 文言・App固有のUI構成は一切持たない（それはCommon Detail／App-local側の
 * 責務、§24）。将来「なぞり」系など他のtrace/drawing教材でも、schemaが
 * 合致すれば再利用できる汎用性を持たせるが、今回のReference Implementation
 * 以外のアプリへの適用は行わない（Cross-App Contract §15 Over-abstraction禁止）。
 *
 * Runtime: ブラウザ(window.donomanaRecordTraceRenderer)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー（既存record-dashboard-foundation.js／
 * record-dashboard-ui.jsと同じパターン）。canvas 2D contextを必要とする
 * render()のみブラウザ専用。純粋なデータ計算（buildDrawOps/isValidTrace/
 * describeCounts等）はNode.js golden testで検証できる形に分離する。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaRecordTraceRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SUPPORTED_SCHEMA_VERSION = 1;

  // ────────────────────────────────────────────────────────────
  //  Trace Schema Validation（さわってひろがる Trace Record Contract §7/§11
  //  と同一の検証。field-presence + shape validationのみ、version番号分岐は
  //  traceSchemaVersionのチェック自体のみ）
  // ────────────────────────────────────────────────────────────

  function validFlatArray(arr) {
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (typeof v !== 'number' || !isFinite(v)) return false;
      if (i % 3 !== 2 && (v < 0 || v > 1000)) return false; // x/y: 0-1000 quantized
      if (i % 3 === 2 && v < 0) return false; // t: elapsed ms, never negative
    }
    return true;
  }

  // 未知のtraceSchemaVersionはinvalid扱い（Cross-App Contract §15/§27: Common
  // Record自体は表示を維持し、Trace Viewerボタンのみdisabledにする判断材料として
  // 呼び出し側がこの結果を使う。ここでは検証のみ行い、UI側のfallback文言は持たない）。
  function isValidTrace(trace) {
    if (!trace || typeof trace !== 'object') return false;
    if (trace.traceSchemaVersion !== SUPPORTED_SCHEMA_VERSION) return false;
    if (!Array.isArray(trace.taps) || !Array.isArray(trace.swipes)) return false;
    if (trace.taps.length % 3 !== 0) return false;
    if (!validFlatArray(trace.taps)) return false;
    for (var s = 0; s < trace.swipes.length; s++) {
      var stroke = trace.swipes[s];
      if (!Array.isArray(stroke) || stroke.length === 0 || stroke.length % 3 !== 0) return false;
      if (!validFlatArray(stroke)) return false;
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  //  Counts（text fallback用の生数値のみ。日本語文言化は呼び出し側の責務、§24）
  // ────────────────────────────────────────────────────────────

  function describeCounts(trace) {
    if (!isValidTrace(trace)) return { tapCount: 0, swipeCount: 0, trimmed: false };
    return {
      tapCount: trace.taps.length / 3,
      swipeCount: trace.swipes.length,
      trimmed: trace.trimmed === true
    };
  }

  // ────────────────────────────────────────────────────────────
  //  Draw ops（純粋関数。canvas 2D contextを持たないNode.js環境でも
  //  幾何演算・alpha計算を検証できるよう、描画コマンドの配列として返す）
  // ────────────────────────────────────────────────────────────

  // sawatte-hirogaru-app.htmlのtraceCanvasAlphaForTと同一の式（開始→終了で
  // 薄い色から濃い色へのグラデーション、Trace Record Contract §15.1）。
  function alphaForT(t, minT, maxT) {
    if (maxT === minT) return 0.75;
    return 0.35 + 0.55 * ((t - minT) / (maxT - minT));
  }

  function computeTimeRange(trace) {
    var minT = Infinity, maxT = -Infinity;
    for (var i = 2; i < trace.taps.length; i += 3) {
      minT = Math.min(minT, trace.taps[i]);
      maxT = Math.max(maxT, trace.taps[i]);
    }
    trace.swipes.forEach(function (stroke) {
      for (var j = 2; j < stroke.length; j += 3) {
        minT = Math.min(minT, stroke[j]);
        maxT = Math.max(maxT, stroke[j]);
      }
    });
    if (!isFinite(minT)) { minT = 0; maxT = 0; }
    return { minT: minT, maxT: maxT };
  }

  function toXY(qx, qy, cssW, cssH) {
    return [(qx / 1000) * cssW, (qy / 1000) * cssH];
  }

  // sawatte-hirogaru-app.htmlのrenderTraceCanvasと同一の描画仕様（タップ=
  // 点+波紋、スワイプ=線、色・太さ・凡例の意味は変更しない）。戻り値は
  // 実際のcanvas描画コマンド列（{type:'swipeSegment'|'tapDot', ...}）で、
  // render()がこれをそのままcontextへ適用する。
  function buildDrawOps(trace, cssW, cssH) {
    var range = computeTimeRange(trace);
    var ops = [];
    trace.swipes.forEach(function (stroke) {
      var n = stroke.length / 3;
      for (var idx = 0; idx < n - 1; idx++) {
        var i0 = idx * 3, i1 = (idx + 1) * 3;
        var p1 = toXY(stroke[i0], stroke[i0 + 1], cssW, cssH);
        var p2 = toXY(stroke[i1], stroke[i1 + 1], cssW, cssH);
        var a = alphaForT(stroke[i0 + 2], range.minT, range.maxT);
        ops.push({ type: 'swipeSegment', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], alpha: a });
      }
    });
    for (var m = 0; m < trace.taps.length; m += 3) {
      var pt = toXY(trace.taps[m], trace.taps[m + 1], cssW, cssH);
      var ta = alphaForT(trace.taps[m + 2], range.minT, range.maxT);
      ops.push({ type: 'tapDot', x: pt[0], y: pt[1], alpha: ta });
    }
    return ops;
  }

  // ────────────────────────────────────────────────────────────
  //  Canvas Render（ブラウザ専用。canvasはCSS px幅/高さを持つ<canvas>要素。
  //  devicePixelRatio対応・座標系はsawatte-hirogaru-app.htmlのrenderTrace
  //  Canvasと同一）
  // ────────────────────────────────────────────────────────────

  function render(canvas, trace) {
    if (!canvas || !isValidTrace(trace)) return false;
    var cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW || !cssH) return false;
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var ops = buildDrawOps(trace, cssW, cssH);
    ops.forEach(function (op) {
      if (op.type === 'swipeSegment') {
        ctx.strokeStyle = 'rgba(120,220,210,' + op.alpha.toFixed(2) + ')';
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
      } else if (op.type === 'tapDot') {
        ctx.beginPath(); ctx.fillStyle = 'rgba(255,214,120,' + op.alpha.toFixed(2) + ')';
        ctx.arc(op.x, op.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255,214,120,' + (op.alpha * 0.6).toFixed(2) + ')'; ctx.lineWidth = 2;
        ctx.arc(op.x, op.y, 13, 0, Math.PI * 2); ctx.stroke();
      }
    });
    return true;
  }

  return {
    VERSION: VERSION,
    SUPPORTED_SCHEMA_VERSION: SUPPORTED_SCHEMA_VERSION,
    isValidTrace: isValidTrace,
    describeCounts: describeCounts,
    alphaForT: alphaForT,
    computeTimeRange: computeTimeRange,
    toXY: toXY,
    buildDrawOps: buildDrawOps,
    render: render
  };
});
