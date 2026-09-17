/*
 * どのまな なぞり書き練習ツール — Record Detail / Rich Visualization / CSV
 * Shared Logic (Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1)
 *
 * nazori-app.html（App-local「活動記録」タブ＝renderRecordsList()、CSV＝
 * exportRecordsBtnのクリックハンドラ）とlearning-records.html（共通「学習の
 * 記録」）の両方から読み込み、Level 2/3行・CSV行の組み立てを**同一関数**
 * として共有する（Cross-App Detail Contract §9/§11、他App-specific shared
 * moduleと同じパターン）。
 *
 * 保存schema実測（nazori-app.html:3047-3084）: 2つの独立したentry shapeが
 * ある。
 *   - 'wide'モード(続けて書く)の1クリック = 1 entry:
 *     {id, sessionId, timestamp, mode:'wide', allChars, charCount,
 *      sessionDone, sessionTotal, image}
 *     `image`は合成canvasの単一PNG dataURL(captureCanvas('wide'))。
 *   - 'single'モード(一文字ずつ)のセッション完了 = 1 entry:
 *     {id, sessionId, timestamp, mode:'single', isComplete:true, allChars,
 *      charCount, sessionDone, sessionTotal, startTime, durationMin,
 *      charImages:[{char, image}, ...]}
 *     `charImages`は文字ごとのPNG dataURL配列(captureCanvas('single')を
 *     文字ごとに蓄積)。トップレベルの`image`は持たない。
 *
 * Level 2について(重要な既存事実): `mode`('single'/'wide')は既に
 * record-dashboard-ui.jsのACTIVITY_LABELSで「一文字ずつ」/「続けて書く」に
 * 変換され、`sessionDone`/`sessionTotal`/`durationMin`も既にnormalize()の
 * `metrics`経由でCommon Detail modalへ表示されている(既存の汎用metrics
 * passthrough、getDetails()実装前から機能済み)。したがってLevel 2の主要
 * テキスト情報はこのPhase以前から実質的に充足している(tokei-app/shiritori2
 * と同型の「隠れたLevel 1.5」)。本fileのgetDetailRows()は、既存経路で
 * カバーされない「画像記録の有無・枚数」という1点のみを追加する
 * (重複行を増やさない、Matrix Gap定義の最小差分方針)。
 *
 * `allChars`(練習した文字、自由入力で名前・漢字も入りうる)は、既存Adapter
 * のコメントが明記するとおり「既定summaryには含めない」という確立済みの
 * Privacy判断(record-dashboard-foundation.js既存コメント、privacyLevel:
 * 'medium'の理由そのもの)を、getDetailRows()(常時表示されるDetail欄)にも
 * 同じ理由で適用し、含めない。CSV(教師の明示的な書き出し操作)は既存
 * App-local CSVが`allChars`を含めている実態に合わせ、Commonも同じ列を含める
 * (register-appと同型の「既定view=除外、明示export=含む」区別)。
 *
 * Runtime: ブラウザ(window.donomanaNazoriRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaNazoriRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // captureCanvas()(nazori-app.html:2993-3029)が生成する形式のみを許可する
  // (§21 Data URL validation: 実保存形式に限定、任意のdata:/javascript:等を
  // 通さない、§58 malicious src safety)。ヘッダ以降にbase64らしき文字列が
  // 続くことも確認する(空文字列や明らかに壊れた値を弾く)。
  var VALID_IMAGE_PREFIX = 'data:image/png;base64,';

  function isValidImage(value) {
    return typeof value === 'string'
      && value.indexOf(VALID_IMAGE_PREFIX) === 0
      && value.length > VALID_IMAGE_PREFIX.length;
  }

  // 1 entryから「表示可能な画像」の配列を取り出す。App-local
  // renderRecordsList()(nazori-app.html:3130-3188)と同じ2分岐(isComplete
  // か否か)、同じalt文言(char単位ラベル、または汎用「なぞり書き」)。
  // 不正な画像は個別にskipする(1枚壊れていても他の正常な画像は表示する、
  // §36 Legacy safety)。
  function getImages(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var out = [];
    if (entry.isComplete && Array.isArray(entry.charImages)) {
      entry.charImages.forEach(function (ci) {
        if (ci && isValidImage(ci.image)) {
          out.push({ alt: (typeof ci.char === 'string' && ci.char) ? ci.char : 'なぞり書き', image: ci.image });
        }
      });
    } else if (isValidImage(entry.image)) {
      out.push({ alt: 'なぞり書き', image: entry.image });
    }
    return out;
  }

  function hasAnyValidImage(entry) {
    return getImages(entry).length > 0;
  }

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows(上記コメントのとおり、既存metrics/activity経路で
  //  充足済みのfieldは重複させない。画像記録の有無・枚数のみ追加する)。
  // ────────────────────────────────────────────────────────────

  function getDetailRows(entry) {
    var rows = [];
    var images = getImages(entry);
    pushIf(rows, '画像記録', images.length > 0 ? ('あり（' + images.length + '枚）') : 'なし');
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  Level 3 Rich Visualization(Contract §10/§12)。canvas演算は不要——
  //  保存済みPNG dataURLをそのまま<img>で表示するのみ(Sawatteのtap/swipe
  //  座標renderer、hiragana/katakanaの将来のstroke rendererとは異なる
  //  「Raster Image Reference」実装、Matrix該当メモ参照)。
  //  text fallback(枚数)を必ず併設し、canvas-onlyにしない(§12/§25)。
  // ────────────────────────────────────────────────────────────

  function supportsRichVisualization(entry) {
    return hasAnyValidImage(entry);
  }

  // target: 呼び出し側(learning-records.html)が用意したcontainer要素。
  // 検証済みの画像だけを<img>として追加する(innerHTMLへ生文字列を渡さない、
  // §22 XSS safety——src属性へは検証済みdata: URLのみを代入し、alt文言は
  // 既存のescapeHtml相当が不要なDOM API(textContent/setAttribute)経由で
  // 設定する)。
  function renderRichVisualization(target, entry) {
    if (!target || typeof document === 'undefined') return;
    var images = getImages(entry);
    if (images.length === 0) return;

    images.forEach(function (img) {
      var wrap = document.createElement('div');
      wrap.className = 'rich-viz-nazori-image-wrap';
      var el = document.createElement('img');
      el.src = img.image;
      el.alt = img.alt + 'のなぞり結果';
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
      el.style.display = 'block';
      el.style.borderRadius = '12px';
      wrap.appendChild(el);

      var caption = document.createElement('p');
      caption.className = 'rich-viz-hint';
      caption.textContent = '「' + img.alt + '」';
      wrap.appendChild(caption);

      target.appendChild(wrap);
    });

    var countText = document.createElement('p');
    countText.className = 'rich-viz-hint';
    countText.textContent = '画像 ' + images.length + '枚';
    target.appendChild(countText);
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（nazori-app.html:3204-3215 exportRecordsBtnハンドラと完全に同一の
  //  7列・行内容。画像データはCSVへ含めない(§30-32、App-local既存CSVも
  //  画像を含まない——画像の閲覧はVisualization actionとして分離)。
  //  App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ(重複実装禁止)。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', '練習した文字', 'モード', '取り組んだ文字数', '全体の文字数', '活動時間（分）'];
  var MODE_LABEL = { wide: '続けて書く', single: '一文字ずつ' };

  // register-app.htmlのregisterCsvSafeCellと同じ方式(§9 Shared Formatter
  // 方針、CSV Formula Injection対策、allCharsが自由入力のため必要)。
  function csvSafeCell(value) {
    var s = (value === null || value === undefined) ? '' : String(value);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function formatCsvDateTime(timeValue) {
    if (timeValue === null || timeValue === undefined || timeValue === '') return { date: '', time: '' };
    var d = (timeValue instanceof Date) ? timeValue : new Date(timeValue);
    if (isNaN(d.getTime())) return { date: String(timeValue), time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return {
      date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()),
      time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
    };
  }

  function buildDetailCsvRows(log) {
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (r) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return;
      var dt = formatCsvDateTime(r.timestamp);
      var modeLabel = MODE_LABEL[r.mode] || r.mode || '';
      var doneCount = (typeof r.sessionDone === 'number') ? r.sessionDone : '';
      var totalCount = (typeof r.sessionTotal === 'number') ? r.sessionTotal : '';
      var duration = (r.isComplete && typeof r.durationMin === 'number') ? r.durationMin : '';
      rows.push([dt.date, dt.time, csvSafeCell(r.allChars), modeLabel, doneCount, totalCount, duration]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    isValidImage: isValidImage,
    getImages: getImages,
    hasAnyValidImage: hasAnyValidImage,
    getDetailRows: getDetailRows,
    supportsRichVisualization: supportsRichVisualization,
    renderRichVisualization: renderRichVisualization,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
