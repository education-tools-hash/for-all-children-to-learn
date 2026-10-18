// Donomana Access（開発版）— 入力・反応の純粋ロジック
// DOM操作を直接は行わず、どのまな本体の既存共通基盤には一切変更を加えない
// (Switch Scan仕様書・Learning Record Foundation等、既存ファイルは不変のまま、
// Access側で同等のロジックを新規に実装する)。
// ブラウザの<script>タグからも、Node.jsのrequire()からも読み込める
// (assets/js/record-dashboard-foundation.jsと同じ慣習)。
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DonomanaAccessCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Phase 5A: 'swipe'はタッチとは別の、教師が明示的に選ぶ独立した入力方式
  // として追加する(Design v2.0 1.2節)。既存の'touch'/'switch'/'keyboard'の
  // 値・意味は変更しない。既存のPhase 3記録(inputMethodが'touch'/'switch'の
  // いずれかのみ)はこの追加の影響を受けない(Design v2.0 6章)。
  var VALID_INPUT_METHODS = ['touch', 'switch', 'keyboard', 'swipe'];
  var VALID_TYPES = ['activate', 'move', 'release', 'cancel'];

  // makeEvent(): 共通入力イベントschema（Design Approval文書3章）に準拠したオブジェクトを
  // 生成する。観測できない値はnullのまま保持し、推定・補完しない。入力方式間で無意味な
  // 数値比較をしないという設計原則により、durationは記録するが評価には使わない。
  function makeEvent(opts) {
    opts = opts || {};
    if (VALID_TYPES.indexOf(opts.type) === -1) {
      throw new Error('DonomanaAccessCore.makeEvent: invalid type "' + opts.type + '"');
    }
    if (VALID_INPUT_METHODS.indexOf(opts.inputMethod) === -1) {
      throw new Error('DonomanaAccessCore.makeEvent: invalid inputMethod "' + opts.inputMethod + '"');
    }
    var hasPos = opts.position && typeof opts.position.x === 'number' && typeof opts.position.y === 'number';
    var hasMove = opts.movement && typeof opts.movement.dx === 'number' && typeof opts.movement.dy === 'number';
    return {
      type: opts.type,
      inputMethod: opts.inputMethod,
      timestamp: typeof opts.timestamp === 'number' ? opts.timestamp : null,
      duration: typeof opts.duration === 'number' ? opts.duration : null,
      position: hasPos ? { x: opts.position.x, y: opts.position.y } : null,
      movement: hasMove ? { dx: opts.movement.dx, dy: opts.movement.dy } : null
    };
  }

  // computeDuration(): 開始・終了のタイムスタンプから持続時間を求める。片方でも欠けていれば
  // nullを返す（存在しない値を0等で代用しない）。
  function computeDuration(startTs, endTs) {
    if (typeof startTs !== 'number' || typeof endTs !== 'number') return null;
    return Math.max(0, endTs - startTs);
  }

  // createRepeatGuard(): OSのキーリピート（キー/スイッチを押し続けた場合に発生する
  // 連続keydown）による重複activate発火を防ぐ最小の状態機械。
  // 本Phaseで新たに確認した既存のギャップ（directions-app.html等、既存21アプリの
  // Switch Scan決定操作にはe.repeatチェックが存在しない、Design Approval文書4.2節）
  // への対応であり、既存アプリ側のコードは変更しない。
  function createRepeatGuard() {
    var pressed = Object.create(null);
    return {
      // onKeyDown(): trueを返した場合のみactivateを発火してよい。
      // isRepeatはキーボード/スイッチのe.repeatをそのまま渡す。
      onKeyDown: function (key, isRepeat) {
        if (isRepeat) return false;
        if (pressed[key]) return false; // keyupを取り逃した場合の保険（二重押下開始の防止）
        pressed[key] = true;
        return true;
      },
      // onKeyUp(): trueを返した場合のみreleaseを発火してよい（押されていた場合のみ）。
      onKeyUp: function (key) {
        if (!pressed[key]) return false;
        delete pressed[key];
        return true;
      },
      // releaseAll(): blur・画面離脱・入力方式切替時に、押されたままの状態をすべて解除する。
      // 解除されたキー一覧を返す（呼び出し側がrelease相当のイベントを発火する場合に使える）。
      releaseAll: function () {
        var keys = Object.keys(pressed);
        pressed = Object.create(null);
        return keys;
      },
      isPressed: function (key) { return !!pressed[key]; }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 5A: スワイプ専用モード
  //
  // タッチ・スワイプいずれも同じPointer Eventsの移動量しきい値判定を使うが、
  // 値そのものは意図的に異なる(Design v2.0 1.2節: 既存の12px(move発火量の
  // 抑制が目的)・sawatte-hirogaru-app.htmlの8px(別アプリ向け)のいずれも
  // スワイプ用の検証済み推奨値として転用しない)。TOUCH_MOVE_THRESHOLD_PXは
  // 既存のタッチ実装の値をそのまま保持し、SWIPE_MOVE_THRESHOLD_PXは新規に
  // 10pxを未検証の暫定初期値として置く。教員による調整UIはPhase 5Aの対象外
  // (Design v2.0 9章)。
  // ─────────────────────────────────────────────────────────────
  var TOUCH_MOVE_THRESHOLD_PX = 12;
  var SWIPE_MOVE_THRESHOLD_PX = 10;

  // meetsMoveThreshold(): 移動量(ユークリッド距離)がしきい値以上かどうかを判定する
  // 純粋関数。trueの場合のみmoveイベントを記録してよい(過剰発火防止)。境界値
  // (距離==thresholdPx)は「満たす」側に含める(既存のタッチ実装と同じ比較方向、
  // 元コードの `< threshold` でreturnする、の否定)。
  function meetsMoveThreshold(dx, dy, thresholdPx) {
    if (typeof dx !== 'number' || typeof dy !== 'number' || typeof thresholdPx !== 'number') return false;
    return Math.sqrt(dx * dx + dy * dy) >= thresholdPx;
  }

  // buildScanItems(): Switch Scan共通パターンの一般化（directions-app.html
  // buildScanItems、Strategy A: [data-scan],.scannableの明示marker方式を踏襲）。
  // 既存アプリのコードそのものではなく、Access側で同等の挙動を新規実装したもの。
  function buildScanItems(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return [];
    var all = Array.prototype.slice.call(rootEl.querySelectorAll('[data-scan],.scannable'));
    return all.filter(function (el) {
      if (el.disabled || el.hasAttribute('hidden')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 3: Record & Storage
  //
  // Learning Record Foundation（assets/js/record-dashboard-foundation.js）への
  // registerAdapter()登録は、本Phaseでは採用しない。採用した場合、既存の
  // ui-golden-tests.js「Metadata Drift」チェック（1章、"every Foundation
  // appId exists in apps-data.json"）が donomana-access を未登録appIdとして
  // 検出し、既存のGolden Testsを破壊する。これを解消するにはapps-data.json
  // （Approved Diff Scope外、Productionアプリ一覧への登録を意味する）への
  // 追加が必要になり、Phase 2のScope（Accessを一覧へ登録しない）と矛盾する。
  // これが「過度に複雑化する」場合に該当するため、Access専用のlocalStorage
  // 方式（既存の directions-app.html 等が個別に実装している
  // donomanaRecordCreate/ReadLog/WriteLog/AddLog パターンと同形のprimitiveを
  // Access側で新規実装したもの）を採用する。既存アプリ・Foundationのコードは
  // 一切変更しない。
  // ─────────────────────────────────────────────────────────────

  var STORAGE_KEY = 'donomana_access_log_v1';
  // directions-app.htmlのMAX_LOGS=500（appLogs、タップ単位）を参考に、
  // Accessはsession単位(1セッション=複数イベントを内包)のため、より少ない
  // 件数で十分とみなしてMAX_SESSIONS=200とする(容量上限への対処、設計文書8章)。
  var MAX_SESSIONS = 200;

  // classifySaveError(): donomanaRecordClassifySaveError()と同じ分類方針。
  function classifySaveError(e) {
    var name = e && e.name;
    var code = (e && typeof e.code === 'number') ? e.code : null;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) return 'quota';
    if (name === 'SecurityError') return 'security';
    return 'unknown';
  }

  // buildSessionRecord(): 観測データのみを保持するsession記録を組み立てる
  // (設計文書7.2節schema)。教師の解釈・メモはここに含めない(Phase 3対象外、
  // 観測データと教師の記録を構造上分離するという設計原則そのもの)。
  // 操作回数から主体性・意欲を自動判定するフィールドは設けない。
  function buildSessionRecord(opts) {
    opts = opts || {};
    if (typeof opts.sessionId !== 'string' || !opts.sessionId) {
      throw new Error('DonomanaAccessCore.buildSessionRecord: sessionId is required');
    }
    if (VALID_INPUT_METHODS.indexOf(opts.inputMethod) === -1) {
      throw new Error('DonomanaAccessCore.buildSessionRecord: invalid inputMethod "' + opts.inputMethod + '"');
    }
    var events = Array.isArray(opts.events) ? opts.events : [];
    return {
      schemaVersion: 1,
      sessionId: opts.sessionId,
      inputMethod: opts.inputMethod,
      startedAt: typeof opts.startedAt === 'string' ? opts.startedAt : null,
      endedAt: typeof opts.endedAt === 'string' ? opts.endedAt : null,
      events: events
    };
  }

  // safeReadSessions(): record-dashboard-foundation.jsのsafeReadArray()と同じ
  // 防御方針(missing key/空/malformed JSON/non-arrayはすべて安全にitems:[]、
  // 書き込みは一切行わない)。Access専用storageのための新規実装。
  function safeReadSessions(storage) {
    if (!storage || typeof storage.getItem !== 'function') return { items: [], anomaly: null };
    var raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      return { items: [], anomaly: 'read-exception' };
    }
    if (!raw) return { items: [], anomaly: null };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { items: [], anomaly: 'malformed-json' };
    }
    if (Array.isArray(parsed)) return { items: parsed, anomaly: null };
    return { items: [], anomaly: 'non-array' };
  }

  // appendSession(): 既存配列へ新規sessionを追加し、MAX_SESSIONSを超える場合は
  // 古いものから切り捨てる(directions-app.htmlのMAX_LOGS/slice(-N)と同じ方針)。
  // 純粋関数(書き込みはwriteSessions()側の責務、テスト容易性のため分離)。
  function appendSession(existingSessions, sessionRecord, maxSessions) {
    var cap = typeof maxSessions === 'number' ? maxSessions : MAX_SESSIONS;
    var list = Array.isArray(existingSessions) ? existingSessions.slice() : [];
    list.push(sessionRecord);
    if (list.length > cap) list = list.slice(-cap);
    return list;
  }

  // writeSessions(): setItem失敗(QuotaExceededError等)をsilentに握りつぶさない。
  // 戻り値{ok,reason}で呼び出し側が保存失敗を利用者へ通知できるようにする
  // (donomanaRecordWriteLog()と同じ方針。通知UIそのものはHTML側の責務)。
  function writeSessions(storage, sessions) {
    if (!storage || typeof storage.setItem !== 'function') {
      return { ok: false, reason: 'no-storage' };
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: classifySaveError(e) };
    }
  }

  // clearSessions(): 記録削除(設計文書8章Must)。他者との端末共用リスクへの
  // 対処として、教師が保存済み記録をいつでも削除できる経路を提供する。
  function clearSessions(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return { ok: false, reason: 'no-storage' };
    try {
      storage.removeItem(STORAGE_KEY);
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: classifySaveError(e) };
    }
  }

  // summarizeSessions(): 活動後の記録表示(設計文書10章)のための最小限の集計。
  // 件数のみを数える客観的事実であり、「回数が多い=主体性が高い」等の評価は
  // 一切付与しない(設計文書7.4節原則)。入力方式間の件数比較のための並べ方も
  // 行わない(無意味な数値比較をしない原則)。
  function summarizeSessions(sessions) {
    var list = Array.isArray(sessions) ? sessions : [];
    var byInputMethod = {};
    var totalActivateCount = 0;
    list.forEach(function (s) {
      var events = Array.isArray(s && s.events) ? s.events : [];
      var activates = events.filter(function (e) { return e && e.type === 'activate'; }).length;
      totalActivateCount += activates;
      var im = (s && typeof s.inputMethod === 'string') ? s.inputMethod : 'unknown';
      byInputMethod[im] = (byInputMethod[im] || 0) + activates;
    });
    return {
      sessionCount: list.length,
      totalActivateCount: totalActivateCount,
      byInputMethod: byInputMethod
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 5B-1: 教員観察記録（Design v2.1、2026-10-18承認）
  //
  // donomana_access_log_v1（観測データ、既存・不変）とは別のstorageキーに、
  // 教員が任意で記録する観察情報(姿勢・支援・操作部位・所感)を保持する。
  // 既存のlog側schema・関数(buildSessionRecord/appendSession/writeSessions/
  // clearSessions/summarizeSessions等)は一切変更しない(Design v2.1 §4)。
  // ─────────────────────────────────────────────────────────────

  var NOTES_STORAGE_KEY = 'donomana_access_teacher_notes_v1';
  var NOTE_SCHEMA_VERSION = 1;

  var VALID_POSTURE = ['未記録', '座位', '立位', '臥位', 'その他'];
  var VALID_SUPPORT_TYPES = [
    '声かけ・音声による促し',
    '視覚的な提示・促し',
    '身体的な支援',
    '姿勢・機器配置などの環境調整'
  ];
  var VALID_OPERATION_PART = ['未記録', '手・指', '頭部・顔', '足', 'その他', '該当なし'];
  var VALID_TEACHER_OBSERVATIONS = [
    '自分から働きかける様子が見られた',
    '促しをきっかけに働きかける様子が見られた',
    '判断が難しい'
  ];

  // hasNoDuplicates(): 配列が文字列のみからなり、かつ重複要素を含まないことを
  // 確認する純粋関数(Design v2.1 §4.1)。
  function hasNoDuplicates(arr) {
    if (!Array.isArray(arr)) return false;
    var seen = Object.create(null);
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (typeof v !== 'string') return false;
      if (seen[v]) return false;
      seen[v] = true;
    }
    return true;
  }

  // isValidSupport(): support{recorded,types}のホワイトリスト検証・重複禁止・
  // recorded===falseならtypesは空配列、というクロスフィールド制約を検証する
  // (Design v2.1 §4.1「support」)。UI側の排他制御だけに依存しない。
  function isValidSupport(support) {
    if (!support || typeof support !== 'object') return false;
    if (typeof support.recorded !== 'boolean') return false;
    if (!Array.isArray(support.types)) return false;
    for (var i = 0; i < support.types.length; i++) {
      if (VALID_SUPPORT_TYPES.indexOf(support.types[i]) === -1) return false;
    }
    if (!hasNoDuplicates(support.types)) return false;
    if (support.recorded === false && support.types.length !== 0) return false;
    return true;
  }

  // isValidTeacherImpression(): teacherImpression{recorded,observations}の
  // ホワイトリスト検証・重複禁止・recorded===falseならobservationsは空配列・
  // recorded===trueなら1件以上・「判断が難しい」は他の2項目と排他、という
  // クロスフィールド制約を検証する(Design v2.1 §4.1「teacherImpression」)。
  function isValidTeacherImpression(impression) {
    if (!impression || typeof impression !== 'object') return false;
    if (typeof impression.recorded !== 'boolean') return false;
    if (!Array.isArray(impression.observations)) return false;
    for (var i = 0; i < impression.observations.length; i++) {
      if (VALID_TEACHER_OBSERVATIONS.indexOf(impression.observations[i]) === -1) return false;
    }
    if (!hasNoDuplicates(impression.observations)) return false;
    if (impression.recorded === false && impression.observations.length !== 0) return false;
    if (impression.recorded === true && impression.observations.length === 0) return false;
    var hasHardToJudge = impression.observations.indexOf('判断が難しい') !== -1;
    if (hasHardToJudge && impression.observations.length > 1) return false;
    return true;
  }

  // isValidNoteRecord(): noteレコード1件の型・許容値・クロスフィールド制約を
  // すべて検証する(Design v2.1 §4.1・§5-10)。schemaVersionが本文書の定義する
  // 値(1)と異なるレコードもここでfalseとなり、読込表示・upsert対象からは
  // 除外されるが、呼び出し側はstorageから削除してはならない(§5-10)。
  function isValidNoteRecord(note) {
    if (!note || typeof note !== 'object') return false;
    if (note.schemaVersion !== NOTE_SCHEMA_VERSION) return false;
    if (typeof note.sessionId !== 'string' || !note.sessionId) return false;
    if (VALID_POSTURE.indexOf(note.posture) === -1) return false;
    if (!isValidSupport(note.support)) return false;
    if (VALID_OPERATION_PART.indexOf(note.operationPart) === -1) return false;
    if (!isValidTeacherImpression(note.teacherImpression)) return false;
    if (typeof note.recordedAt !== 'string' || !note.recordedAt) return false;
    return true;
  }

  // isNoteContentEmpty(): 4項目すべてが初期状態(未記録/未確認)かどうかを判定
  // する純粋関数。全フィールドが初期状態のまま保存ボタンが押された場合、
  // 空レコードをnotesキーに追加しない(Design v2.1 §4)。
  function isNoteContentEmpty(note) {
    if (!note || typeof note !== 'object') return true;
    var support = (note.support && typeof note.support === 'object') ? note.support : {};
    var impression = (note.teacherImpression && typeof note.teacherImpression === 'object') ? note.teacherImpression : {};
    var postureEmpty = !note.posture || note.posture === '未記録';
    var operationPartEmpty = !note.operationPart || note.operationPart === '未記録';
    var supportEmpty = !support.recorded && (!Array.isArray(support.types) || support.types.length === 0);
    var impressionEmpty = !impression.recorded && (!Array.isArray(impression.observations) || impression.observations.length === 0);
    return postureEmpty && operationPartEmpty && supportEmpty && impressionEmpty;
  }

  // buildNoteRecord(): 教員入力(posture/support/operationPart/teacherImpression)
  // からnoteレコードを組み立てる。未指定・不正な値は安全な初期値に落とす
  // (値そのものの妥当性はisValidNoteRecord()側で別途検証する、makeEvent()の
  // ホワイトリスト検証と同方式)。sessionIdのみ必須(Design v2.1 §4)。
  function buildNoteRecord(opts) {
    opts = opts || {};
    if (typeof opts.sessionId !== 'string' || !opts.sessionId) {
      throw new Error('DonomanaAccessCore.buildNoteRecord: sessionId is required');
    }
    var posture = VALID_POSTURE.indexOf(opts.posture) !== -1 ? opts.posture : '未記録';
    var operationPart = VALID_OPERATION_PART.indexOf(opts.operationPart) !== -1 ? opts.operationPart : '未記録';
    var rawSupport = opts.support && typeof opts.support === 'object' ? opts.support : {};
    var support = {
      recorded: !!rawSupport.recorded,
      types: Array.isArray(rawSupport.types) ? rawSupport.types.slice() : []
    };
    var rawImpression = opts.teacherImpression && typeof opts.teacherImpression === 'object' ? opts.teacherImpression : {};
    var teacherImpression = {
      recorded: !!rawImpression.recorded,
      observations: Array.isArray(rawImpression.observations) ? rawImpression.observations.slice() : []
    };
    return {
      schemaVersion: NOTE_SCHEMA_VERSION,
      sessionId: opts.sessionId,
      posture: posture,
      support: support,
      operationPart: operationPart,
      teacherImpression: teacherImpression,
      recordedAt: typeof opts.recordedAt === 'string' ? opts.recordedAt : null
    };
  }

  // safeReadNotes(): safeReadSessions()と同じ防御方針をnotes側storageに適用
  // した新規実装(missing key/空/malformed JSON/non-arrayはすべて安全に
  // items:[]、書き込みは一切行わない)。
  function safeReadNotes(storage) {
    if (!storage || typeof storage.getItem !== 'function') return { items: [], anomaly: null };
    var raw;
    try {
      raw = storage.getItem(NOTES_STORAGE_KEY);
    } catch (e) {
      return { items: [], anomaly: 'read-exception' };
    }
    if (!raw) return { items: [], anomaly: null };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { items: [], anomaly: 'malformed-json' };
    }
    if (Array.isArray(parsed)) return { items: parsed, anomaly: null };
    return { items: [], anomaly: 'non-array' };
  }

  // partitionNotes(): 配列全体は正常にJSON解析できた場合でも、個々のnote
  // レコード単位でisValidNoteRecord()を適用し、表示してよいレコード(valid)
  // と、不正・未知schemaVersionのため非表示とすべきレコード(quarantined)に
  // 分ける(Design v2.1 §5-10)。quarantined側もstorageからは削除しない
  // (呼び出し側はvalid/quarantinedの合計を書き戻す際、必ず両方を保持する)。
  function partitionNotes(items) {
    var list = Array.isArray(items) ? items : [];
    var valid = [];
    var quarantined = [];
    list.forEach(function (note) {
      if (isValidNoteRecord(note)) {
        valid.push(note);
      } else {
        quarantined.push(note);
      }
    });
    return { valid: valid, quarantined: quarantined };
  }

  // findNoteBySessionId(): sessionIdによる単純な検索(純粋関数)。notes配列
  // だけでなく、log配列(donomana_access_log_v1、同じくsessionIdフィールドを
  // 持つ)への「sessionId実在確認」(Design v2.1 §4)にも同じ関数を用いてよい。
  function findNoteBySessionId(notes, sessionId) {
    var list = Array.isArray(notes) ? notes : [];
    if (typeof sessionId !== 'string' || !sessionId) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].sessionId === sessionId) return list[i];
    }
    return null;
  }

  // upsertNote(): sessionIdで既存noteを検索し、存在すれば置換、存在しなければ
  // 追加する(Design v2.1 §4)。置換の前に、既存レコード自体をisValidNoteRecord()
  // で検証し、不正・未知schemaVersionの場合は無断で上書きせず保留する(§4.2)。
  // 既存配列内にsessionIdを安全に解釈できないレコードがあり、かつ今回の
  // sessionIdに完全一致するレコードが見つからない場合も、「存在しない」と
  // 誤認して重複追加することを避けるため保留する(§4.2、安全側に倒す)。
  function upsertNote(existingItems, newNote) {
    var list = Array.isArray(existingItems) ? existingItems.slice() : [];
    if (!newNote || typeof newNote.sessionId !== 'string' || !newNote.sessionId) {
      return { ok: false, reason: 'invalid-new-note', items: list };
    }
    var targetId = newNote.sessionId;
    var matchIndex = -1;
    var unsafeExistingFound = false;
    for (var i = 0; i < list.length; i++) {
      var itemSessionId = list[i] && list[i].sessionId;
      if (typeof itemSessionId !== 'string' || !itemSessionId) {
        unsafeExistingFound = true;
        continue;
      }
      if (itemSessionId === targetId) {
        matchIndex = i;
      }
    }
    if (matchIndex === -1) {
      if (unsafeExistingFound) {
        return { ok: false, reason: 'unsafe-existing-sessionid', items: list };
      }
      list.push(newNote);
      return { ok: true, reason: null, items: list };
    }
    if (!isValidNoteRecord(list[matchIndex])) {
      return { ok: false, reason: 'existing-record-invalid', items: list };
    }
    list[matchIndex] = newNote;
    return { ok: true, reason: null, items: list };
  }

  // pruneOrphanNotes(): 孤立観察記録の整理(Design v2.1 §5-4・§5-12)。
  // 軸A(sessionIdがvalidSessionIdsに存在するか)のみを削除基準とし、
  // 軸B(レコード自体の妥当性)は削除理由にしない。配列内のいずれかの
  // レコードのsessionIdを安全に解釈できない場合(軸A自体が不確実)は、
  // 何も削除せずprune全体を保留する(§5-12)。
  function pruneOrphanNotes(validSessionIds, notes) {
    var items = Array.isArray(notes) ? notes : [];
    if (!Array.isArray(validSessionIds)) return { ok: false, reason: 'invalid-input', items: items };
    for (var i = 0; i < items.length; i++) {
      var sid = items[i] && items[i].sessionId;
      if (typeof sid !== 'string' || !sid) {
        return { ok: false, reason: 'unsafe-sessionid', items: items };
      }
    }
    var idLookup = Object.create(null);
    validSessionIds.forEach(function (id) {
      if (typeof id === 'string' && id) idLookup[id] = true;
    });
    var kept = items.filter(function (note) { return !!idLookup[note.sessionId]; });
    return { ok: true, reason: null, items: kept };
  }

  // writeNotes(): writeSessions()と同じ方針(setItem失敗をsilentに握りつぶさ
  // ない)をnotes側storageに適用した新規実装。
  function writeNotes(storage, notes) {
    if (!storage || typeof storage.setItem !== 'function') {
      return { ok: false, reason: 'no-storage' };
    }
    try {
      storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: classifySaveError(e) };
    }
  }

  // clearNotes(): clearSessions()と同じ方針をnotes側storageに適用した新規実装。
  function clearNotes(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return { ok: false, reason: 'no-storage' };
    try {
      storage.removeItem(NOTES_STORAGE_KEY);
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: classifySaveError(e) };
    }
  }

  // clearAllAccessData(): 全件削除時はnotesキーを先に削除し、成功を確認した
  // 後にlogsキーを削除する合成関数(Design v2.1 §5-1)。notes削除が失敗した
  // 場合はlogs削除を試みない(中断時に「notesは消えたがlogsが残る」という
  // 安全側の失敗モードを保つため)。既存のclearSessions()自体は変更しない。
  function clearAllAccessData(storage) {
    var notesResult = clearNotes(storage);
    if (!notesResult.ok) {
      return { ok: false, notes: notesResult, logs: { ok: false, reason: 'not-attempted' } };
    }
    var logsResult = clearSessions(storage);
    return { ok: notesResult.ok && logsResult.ok, notes: notesResult, logs: logsResult };
  }

  return {
    VALID_INPUT_METHODS: VALID_INPUT_METHODS,
    VALID_TYPES: VALID_TYPES,
    makeEvent: makeEvent,
    computeDuration: computeDuration,
    createRepeatGuard: createRepeatGuard,
    buildScanItems: buildScanItems,
    TOUCH_MOVE_THRESHOLD_PX: TOUCH_MOVE_THRESHOLD_PX,
    SWIPE_MOVE_THRESHOLD_PX: SWIPE_MOVE_THRESHOLD_PX,
    meetsMoveThreshold: meetsMoveThreshold,
    STORAGE_KEY: STORAGE_KEY,
    MAX_SESSIONS: MAX_SESSIONS,
    classifySaveError: classifySaveError,
    buildSessionRecord: buildSessionRecord,
    safeReadSessions: safeReadSessions,
    appendSession: appendSession,
    writeSessions: writeSessions,
    clearSessions: clearSessions,
    summarizeSessions: summarizeSessions,
    NOTES_STORAGE_KEY: NOTES_STORAGE_KEY,
    NOTE_SCHEMA_VERSION: NOTE_SCHEMA_VERSION,
    VALID_POSTURE: VALID_POSTURE,
    VALID_SUPPORT_TYPES: VALID_SUPPORT_TYPES,
    VALID_OPERATION_PART: VALID_OPERATION_PART,
    VALID_TEACHER_OBSERVATIONS: VALID_TEACHER_OBSERVATIONS,
    hasNoDuplicates: hasNoDuplicates,
    isValidSupport: isValidSupport,
    isValidTeacherImpression: isValidTeacherImpression,
    isValidNoteRecord: isValidNoteRecord,
    isNoteContentEmpty: isNoteContentEmpty,
    buildNoteRecord: buildNoteRecord,
    safeReadNotes: safeReadNotes,
    partitionNotes: partitionNotes,
    findNoteBySessionId: findNoteBySessionId,
    upsertNote: upsertNote,
    pruneOrphanNotes: pruneOrphanNotes,
    writeNotes: writeNotes,
    clearNotes: clearNotes,
    clearAllAccessData: clearAllAccessData
  };
});
