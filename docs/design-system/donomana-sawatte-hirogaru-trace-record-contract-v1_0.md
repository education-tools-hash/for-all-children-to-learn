# どのまな「さわってひろがる」軌跡記録 + CSV出力 Design Contract（Version 1.0 Draft）

- Phase: SAWATTE-HIROGARU-TRACE-RECORD-DESIGN-1
- 版: v1.0 Draft（Design Only）
- 承認状態: Draft。User Approval待ち。Production未反映・実装未着手。
- 位置づけ: `donomana-learning-record-standard-v1_0.md`（Core Schema・Storage）／
  `docs/design-system/donomana-sawatte-hirogaru-design-contract-v1_0.md`（本体設計）を
  土台に、「さわってひろがる」固有のtrace（軌跡）record拡張とCSV出力を追加する
  独立Contract。Privacy Boundary変更を伴うため、既存Design Contractへ追記せず
  独立文書とする（§17参照）。

---

## 0. 前提・Baseline

Production:

```
main = origin/main = 3753751
```

Worktree: `for-all-children-to-learn-sawatte-trace-record-design1`
Branch: `design/sawatte-trace-record-v1`

「さわってひろがる」はProduction Release済み（`sawatte-hirogaru-app.html`、
`app-details/sawatte-hirogaru-app-detail.html`）。本Phaseは **Docs-only**。
Product変更・push・merge・deployは行わない。

---

## 1. 目的

「さわってひろがる」の学習記録を、回数集計（既存）に加えて「どのように画面へ
働きかけたか」を後から視覚的に振り返れる記録へ拡張する設計を固める。

許可する解釈: どこを触ったか・どのように動かしたか・何回操作したか（事実）。
禁止する解釈: 注意の偏り・認識の欠落・運動能力・集中度等の自動判定（§14）。

---

## 2. 既存Source of Truth調査結果

### 2.1 既存Record（`sawatte-hirogaru-app.html`実コード確認）

- Storage key: `sawatte_hirogaru_log`（`STORAGE_LOG_KEY`、行876）
- `donomanaRecordAddLog(STORAGE_LOG_KEY, entry)`で追記（行1735）。**件数上限（rolling
  cap）は現状一切ない**。他アプリ（mogura-tataki=60件、okane-app=200件等）と異なり、
  「さわってひろがる」は無制限追記のまま。これは本Phase開始前からの既存事実であり、
  今回のtrace追加によって初めて実害が顕在化しうる（§11.3で対応方針を示す）。
- `recordInteraction(inputMethod, kind)`（行1536）: `kind`引数を実際には使っておらず、
  タップ・スワイプ・視線dwell・キーボード/スイッチのいずれも`session.tapCount++`する。
  `swipeCount`はpointermoveがSWIPE_THRESHOLD_PX(8px)を超えた時点で別途`+1`される
  （行1606、「タップ扱いの操作が後からスワイプへ昇格した回数」の意味で、
  `totalInteractions`は二重加算されない）。
- `triggerReaction(x, y, inputMethod, kind)`（行1552）は視覚/音の反応演出を作る
  **共通関数**で、タップ・スワイプ・視線dwell（実座標を`gazeX-rect.left`等で渡す、
  行1669）・キーボード/スイッチ（`x=null`→中心固定、行1647）の**全入力方法が
  合流する**。→ 視線の実座標はこの関数の引数として一時的に存在するが、
  記録には一切使われていない（現状も、今回の設計でも）。

**重要な設計上の帰結**: trace記録のhookを`triggerReaction()`内に置くと、視線dwellの
実座標が同じ関数を通るため「うっかり視線座標も記録してしまう」regressionを
構造的に作りやすい。したがって trace capture は `pointerdown`/`pointermove`/
`pointerup`のTouch/Mouse/Pen専用ハンドラ（行1588以降）にのみ直接実装し、
`triggerReaction()`本体には一切手を入れない（§6.4で再確認）。

### 2.2 apps-data.json（sawatte-hirogaru-app）

現行の座標非保存を明言する既存文言（§13 Existing Production Text Auditに詳細）:

- `lesson.tips`: 「…座標情報は保存されません。」
- `caution`: 「…タッチ座標・視線の位置そのものは記録しません。」

### 2.3 `sawatte-hirogaru-app.html`のHelp本文（行673）

> 取り組んだ時間・さわった回数・スワイプした回数・使った操作方法などの事実だけを
> 記録します。指でさわった場所そのもの（座標）は記録しません。記録は、そのときの
> 取り組みを振り返るためのもので、一度の記録だけから好みや能力を判断するもの
> ではありません。

いずれも「座標は保存しない」を明言しており、trace実装時は**必ず**同時に修正が
必要（Migration不要方針とは別に、この文言修正はTrace ON設定を使った瞬間から
虚偽表示になるため、Implementation PhaseのBlocking Gateとする）。

### 2.4 `learning-records.html` / 共通Record Dashboard

- `assets/js/record-dashboard-foundation.js`に21アプリ分のadapter
  （`registerAdapter(...)`）が存在するが、**`sawatte-hirogaru-app`のadapterは
  存在しない**。`LEARNING_RECORD_FOUNDATION_APPS`（generate.js）への登録は
  「共通chrome注入対象（Foundation JS・学習のきろく導線ボタン）」を制御するのみで、
  共通Dashboardへの表示は別途adapter登録が必要という2段構造になっている。
  → **「さわってひろがる」の記録は現状、共通`learning-records.html`には一切
  表示されない**（本Phase開始前からの既存Gapであり、trace機能とは無関係の
  別問題。本Phaseでは修正しない。§10.3で扱いを確定）。
- 共通Dashboardの詳細modal（`openDetailModal`、learning-records.html 506行〜）は
  固定行（日付/時刻/教材/カテゴリ/活動/入力方法/概要）+ `formatMetrics()`
  （ホワイトリスト式keyのみ表示）+ `hasMedia`バッジのみを描画する。
  `hasMedia`バッジの実表示文言は **`"画像記録あり（このMVPでは表示していません）"`**
  （learning-records.html 525行）——**既存のhiragana/katakana `traceSample`機能
  （§2.5）が本番投入されて尚、共通Dashboardは意図的にリッチな可視化を
  持たせていない**。これは「richな per-record可視化は共通Dashboardの責務では
  ない」という既に確立した設計判断の実例であり、本Phaseの Viewer配置決定
  （§10）の直接的根拠にする。
- 共通CSV（`record-dashboard-ui.js`の`buildCsvRows`）は共通7列
  （日付/時刻/教材/カテゴリ/活動/概要/入力方法）のみで、座標やapp-specific
  metricsは一切含まない。

### 2.5 既存Trace精度の先行実装（`docs/design-system/donomana-trace-sample-recording-v1.md`）

`hiragana-learn.html`/`katakana-app.html`に、なぞり書きのstroke座標を保存する
**直接の先行設計・先行実装**が既に存在する（v1.0 Draft/Pilot RC、User Browser
Review待ち、Production未反映）。本Phaseの設計は、この先行実装の実測済み方針を
最大限踏襲する:

| 先行実装（trace-sample）の決定 | 本Phaseへの適用 |
|---|---|
| 正規化座標(0..1)→0〜1000整数量子化、キー名を持たないflat配列 | 採用（§7/§9） |
| 弧長ベースresampling点数を実測で決定（24点/stroke） | 「さわってひろがる」には比較対象となる字形がなく、時間+距離のhybrid間引きに置換（§9、字形一致精度の実測は不要） |
| 既存Core Schema（`detailSchemaVersion`相当）は変更せず、trace用フィールド自体に独立versionを持たせる | 採用（§12） |
| Legacy Compatibility=フィールド有無で判定、version番号での分岐はしない | 採用（§13） |
| Malformed dataは「見る」ボタン自体を出さない、record本体表示は妨げない | 採用（§13.3） |
| CSV(既存)はtraceSampleを一切参照しない（Boundary絶対条件） | 採用（Summary CSVとTrace CSVを完全分離、§20-23） |
| Viewerは非modal・Help Standardのoverlayパターン再利用、on-demand render | 採用（§10） |
| Shared Foundationへ拡張せずアプリ内local実装（将来展開が具体化したら引き上げ） | 採用（§18） |
| Privacyワーディングは`localStorage`/`JSON`等の技術語を使わない | 採用（§16） |

### 2.6 `donomana-sst-record-detail-contract-v1_0.md` §12.2（Decision 8-2）

> `detail`オブジェクト内部には独立した`detailSchemaVersion`を新設する。理由:
> `detail`の内部構造は将来アプリ固有の判断で進化しうるため、トップレベル
> schemaVersionとは独立して管理する。`detail`が存在するがバージョンが読み取れ
> ない/不正な場合は、表示側で`detail`ごと無視し、従来通りの要約表示へ
> フォールバックする。

「さわってひろがる」の`payload.detailSchemaVersion`（Core Schemaとは別の、
アプリ独自のpayload内部バージョン、Production既存フィールド）と、今回追加する
`trace`オブジェクトの関係も、**同型の入れ子独立バージョニング**として設計する
（§12）。

### 2.7 CSVファイル名・タイムスタンプ規約（既存アプリ実コード確認）

`register-app.html`/`janken-app.html`とも:

```js
const ts = `${Y}${MM}${DD}_${HH}${mm}`;  // YYYYMMDD_HHMM
link.download = `register-kiroku-${ts}.csv`; // {app}-kiroku-{ts}.csv, ASCII
```

共通Dashboardも同一ts形式（`gakushu-no-kiroku-{ts}.csv`）。本Phaseもこの規約に
そのまま合わせる（§24）。

### 2.8 座標を保存する既存アプリの有無

`nazori-app.html`はPNG/base64のcanvas screenshotとして描画結果を保存する実績が
ある（§2.5の比較表参照、trace-sample doc内で不採用と判定済み: 高頻度record
蓄積アプリでは容量面のリスクが大きい）。「座標情報を全く保存しているアプリが
ない」という当初想定（Phase冒頭の記述）は**不正確**であり、正しくは「hiragana/
katakanaがPilotとして既に正規化座標のtrace保存を実装済み（Production未反映）」
「nazori-appはPNG方式（座標ではなく画像）」の2系統が存在する、が正しい現状。

---

## 3. Gazeの扱い（確定）

**Gaze coordinateは保存しない。Gaze interaction countは保存可、ただし今回は
実装しない（既存`inputMethods`配列に`'gaze'`が含まれることで間接的に判別可能
なため、trace専用の追加集計フィールドは不要と判断）。**

構造的保証（§2.1参照）: trace captureのhookをPointer Events専用ハンドラのみに
配置し、`triggerReaction()`（gaze/keyboardも通る共通関数）には一切追加しない。
これにより「条件分岐の書き忘れでgaze座標が漏れる」クラスのbugを設計レベルで
排除する。

---

## 4. Coordinate Model（確定）

Activity Surfaceの`getBoundingClientRect()`基準、**その時点の**サーフェス幅・
高さに対する相対位置として正規化する:

```
normX = clamp((clientX - rect.left) / rect.width,  0, 1)
normY = clamp((clientY - rect.top)  / rect.height, 0, 1)
```

trace-sample方式に合わせ、保存直前に0〜1000の整数へ量子化する
（`Math.round(normX * 1000)`）。理由は trace-sample doc §6と同一
（JSON容量削減、float文字列膨張回避、下書き外入力もclampで安全に丸め込む）。

CSV出力時のみ、教師が読める形式として `x / 1000` の小数（例: `0.420`）へ
逆変換する（§21）。

---

## 5. Orientation / Aspect Ratio（Non-blocking、方針確定）

セッション中にorientation changeが起きても、各pointは**捕捉した瞬間の
サーフェス寸法**に対する相対値として保存されるため、値自体が壊れることはない。
ただし、Viewerのプレビュー枠の縦横比が捕捉時と異なると、円形の動きが楕円に
見える等の**軽微な形状歪み**が起こり得る。

この機能の教育的目的（§1: 「どこを触ったか・どう動いたか」という概況把握、
精密な運動解析ではない、§14で自動解釈自体を禁止）に照らし、この程度の歪みは
許容範囲と判断し、**per-interaction / per-sessionのaspect ratio保存は行わない**
（Blocking Decisionsには含めない、Non-blocking）。将来「歪みが問題になる」
具体的要望が出た場合の対応余地として、Future Candidate（§25）にのみ記録する。

---

## 6. Tap / Swipe 記録（確定）

### 6.1 Tap

```
kind: "tap" 相当、1タップ = 1点
[x, y, t]   // x,y: 0-1000整数、t: セッション開始からの経過ms整数
```

### 6.2 Swipe

```
kind: "swipe" 相当、1ストローク = 点列
[x0,y0,t0, x1,y1,t1, ...]  // 同一pointerIdのpointerdown〜pointerupの1回分
```

### 6.3 Multi-touch

既存`MAX_ACTIVE_POINTERS=5`・`activePointers`（pointerIdキー）構造をそのまま
再利用する。同時に開いている複数のpointerIdは、それぞれ独立したtap/swipe
エントリとして記録する（マージしない）。新規の並行処理機構は作らない。

### 6.4 Hook位置（確定、§2.1参照）

- `pointerdown`ハンドラ内: 新規interactionを開始（1点記録、`kind`未確定の
  暫定tap）。
- `pointermove`ハンドラ内: 既存の`isSwipe`昇格ロジック（SWIPE_THRESHOLD_PX）が
  真になった時点でswipeへ昇格し、以後§9のsampling方針に従って点を追記。
- `pointerup`/`pointercancel`ハンドラ内: 確定したtap（1点のまま）または
  swipe（点列）を`trace.taps`/`trace.swipes`へ確定保存。
- `triggerReaction()` / `gazeTick()` / キーボードハンドラには**一切変更を
  加えない**。

---

## 7. Trace Schema（確定）

```js
payload: {
  detailSchemaVersion: 1,      // 既存フィールド、変更なし（§12参照）
  mode, durationMs, totalInteractions, tapCount, swipeCount,
  inputMethods, soundEnabled, intensity, effectWidth, effectSound,  // 既存、無変更
  trace: {                      // ★ 新規・完全optional
    traceSchemaVersion: 1,
    pointLimit: 500,
    trimmed: false,             // true = §11.2のhard cap到達により以降の点を破棄した
    taps:   [x,y,t, x,y,t, ...],       // flat triple配列（インデックス不要、objectキー繰り返しコストを排除）
    swipes: [ [x0,y0,t0, ...], [x0,y0,t0, ...], ... ]  // ストロークごとのflat配列の配列
  }
}
```

- Trace OFF、またはTrace ON設定でも0回の操作だったセッションでは、`trace`
  フィールド自体を**省略**する（空objectを入れない。「フィールド不在=記録なし」
  という単純な判定をViewer/CSV双方で使う、trace-sample §10と同型）。
- 既存`taps`/`swipes`という命名は、Core Schema・既存`tapCount`/`swipeCount`と
  紛れないよう、必ず`payload.trace.taps`/`payload.trace.swipes`という
  ネスト経由でのみ参照する。

---

## 8. Schema Version決定（確定、§2.6の先行判断を踏襲）

**`payload.detailSchemaVersion`は`1`のまま変更しない。`trace`オブジェクト内部に
独立した`traceSchemaVersion: 1`を新設する。**

根拠:
1. `donomana-sst-record-detail-contract-v1_0.md` §12.2が、まさに同型の状況
   （「独自の内部構造を持つ、独立進化しうるnested payload」）に対して
   同じ判断を既に下している。
2. `donomana-trace-sample-recording-v1.md` も、Core Schemaの`schemaVersion`を
   一切上げずに`traceSample.version`という独立フィールドで管理している。
3. Backward Compatibility（§13）を「フィールドの有無」で判定する設計にする
   ことで、`detailSchemaVersion`という**別の目的（既存フィールド構成全体の
   互換性）のための番号**を、trace機能一つのために動かさずに済む。
   両者の関心を混ぜない。

Privacy Boundary変更を理由に安易にversionを据え置いたわけではなく、
「versionという仕組みそのものを、影響範囲に応じて適切な粒度（nested）で
再利用した」という判断である点を明記する。

---

## 9. Point Sampling（確定）

「さわってひろがる」には比較対象となる正解字形がない（hiragana/katakanaの
resampling精度実測は適用不可）ため、**時間+距離のhybrid間引き（Phase提示の
選択肢C）**を採用する:

- 直近の記録点から **50ms以上経過** した場合、または
- 直近の記録点から **サーフェス対角線の3%以上移動** した場合

のいずれかを満たした時点で新しい点を1つ記録する。

理由:
- 時間条件だけでは、静止に近いゆっくりした動きの形状情報が失われる
  （距離条件がこれを救う）。
- 距離条件だけでは、震え・微小な手ぶれ（対象ユーザー層の身体特性、重度・
  重複障害を持つ子どもの意図的でない微細な動き）が高頻度点を大量生成しうる
  （時間条件が上限を作る＝実質「最大20点/秒」の速度上限になる）。
- pointermove自体の間引きは既存コードに前例がある
  （`TRAIL_MIN_INTERVAL_MS=40`、視覚エフェクトの描画間引き）ため、同種の
  間引き変数を追加するだけで済み、新しい概念を持ち込まない。

---

## 10. Point Limit / Storage Size（確定）

### 10.1 セッションあたり上限

**500点/セッション**（tap点+swipe点の合計）をsoft target、**1000点**を
hard capとする。

- 0〜500点: §9のsampling方針どおり通常密度で記録。
- 501〜1000点: sampling間隔（時間・距離とも）を2倍に粗くして記録を継続する
  （古い点を削除しない、新規点を間引く。Phase§11の指示どおり）。
- 1000点到達後: それ以上の新規点の追加を停止し、`trace.trimmed = true`を
  設定する。既に記録済みの点は保持したまま、セッション自体・summary
  （durationMs/tapCount等）の記録は通常どおり継続する（trace欠落のみ、
  無言にはしない。§10.4のViewer/CSV表示で明示する）。

### 10.2 実測ストレージサイズ（Node.jsで実測、trace-sample docと同じ方法論）

上記schema・500点構成（tap 35%・swipe 65%相当の典型例）で
`Buffer.byteLength(JSON.stringify(record), 'utf8')`により実測:

| 状態 | 1レコードあたりbytes |
|---|---|
| trace OFF（フィールド省略） | 378 bytes |
| trace ON・100点 | 1,924 bytes |
| trace ON・300点 | 4,890 bytes |
| trace ON・500点（典型上限） | 7,799 bytes（約7.6KB） |

セッション数によるlocalStorage使用量試算（trace ONを仮定した保守的な
worst-caseと、trace OFFの場合を併記）:

| セッション数 | trace ON（500点想定、worst-case） | trace OFF |
|---|---|---|
| 1 | 約8 KB | 約0.37 KB |
| 10 | 約76 KB | 約3.7 KB |
| 50 | 約381 KB | 約18.5 KB |
| 100 | 約762 KB | 約36.9 KB |

一般的なブラウザのorigin単位localStorage容量（5〜10MB程度）に対し、100
セッション規模でも1MBを大きく下回り、単発では問題にならない。ただし
§10.3を参照。

### 10.3 既存の無制限追記との複合リスク（重要な追加提言）

§2.1のとおり、「さわってひろがる」の`sawatte_hirogaru_log`には**件数上限が
一切ない**（他のFoundation登録アプリの多くは60〜200件のrolling capを既に
持つ）。trace ONの記録が1件あたり約8KBになることを踏まえると、たとえば
1日5セッション×200日（1年弱の授業日数相当）＝1000セッションで
約7.6MBに達し、ブラウザ・端末によってはQuotaExceededErrorのリスク域に入る。

**推奨: 本機能の実装と同時に、`sawatte_hirogaru_log`へも既存Foundationパターン
（例: okane-appの200件rolling cap）に倣ったrolling capを新設する。** これは
trace機能そのものの必須要件ではないが、trace機能によって「無制限追記」の
実害が現実的な時間軸で顕在化するため、Implementation Phaseの中で対応する
ことを強く推奨する（Blocking Decisionsへ追加、§19参照）。

### 10.4 Trimmed表示

`trace.trimmed === true`のセッションをViewerで開いた際、「操作が多く、記録の
一部を軌跡として保存できませんでした（時間・回数などの記録は完全です）」等の
明示メッセージを表示する（無言での欠落を避ける、Phase方針どおり）。

---

## 11. Backward Compatibility / Legacy（確定）

- 既存record（`trace`フィールドなし）はViewerで「軌跡データなし」と表示し、
  通常のsummary表示は一切妨げない。
- `trace`が存在してもmalformed（`traceSchemaVersion`不一致、`taps`/`swipes`が
  配列でない、要素が数値でない・0〜1000範囲外・NaN等）の場合、
  `isValidSawatteTrace(trace)`相当のguard関数がfalseを返し、「軌跡を見る」
  ボタン自体を表示しない。record本体（日時・モード・回数等）の表示は妨げない
  （trace-sample doc §10-11と同型の設計、実装時に同じ7パターン程度の
  malformed fixtureで実ブラウザ検証する）。
- Migrationは行わない（既存recordへの遡及的trace付与はしない）。

---

## 12. Trace Default ON/OFF（確定: **Default OFF**）

Teacher Settingsに「操作の軌跡を記録する」ON/OFFトグルを新設し、
**既定値はOFF（未設定＝OFF）**とする。

根拠:
1. これは既存Privacy Boundary（「座標は保存しない」）の明確な拡張である。
   既存ユーザー・既存端末で、本人の明示的操作なしに次回起動時から自動的に
   座標相当データの保存が始まる状態を作らない。
2. 対象ユーザー層は重度・重複障害を持つ子どもを含む（既存apps-data.jsonの
   `lesson.target`参照）。身体の動き方に関するデータは、意図せず広く保存される
   べきではないという既存システム全体のPrivacy-firstな設計思想
   （CC BY-NC-ND・server送信なし・視線座標非保存等）と整合させる。
3. §10.3のストレージ増大リスクも、Default OFFであれば「明示的に有効化した
   教師のみ」に限定でき、影響範囲を絞れる。
4. usabilityコスト: この機能を必要とする教師は、そもそも「せんせい用せってい」
   を開く動機（既存の他設定と同様）を持つユーザーであり、1つトグルを
   追加で有効化する手間は軽微。Default ONによる「気づかないうちに全員の
   データ量が増える」リスクの方が大きい。

---

## 13. Trace OFF時の挙動（確定）

Trace OFFのセッションでも、`durationMs`・`tapCount`・`swipeCount`・`mode`・
`intensity`・`effectWidth`・`effectSound`・`inputMethods`等の既存Summary
フィールドは**従来通りすべて記録する**。`trace`フィールドのみ省略する。

---

## 14. Educational Interpretation Boundary（確定）

Viewer・CSV・Help文言のいずれにおいても、以下を**明示的に禁止**する:

- 「右側への注意が強い」「左側を認識できていない」等の空間認知解釈
- 「運動能力が高い/低い」等の身体能力評価
- 「集中できている/いない」等の注意状態判定
- 上記を示唆する自動生成コメント・スコアリング・ランキング

Viewerが表示してよいのは「どこを触ったか・どう動かしたか・何回操作したか」
という**事実の可視化のみ**（既存Learning Record Standardの一般原則
「平均点/ランキング/達成率を置かない」と同じ精神を、trace機能にも適用する）。

---

## 15. Viewer配置（確定: **アプリ内local Viewer**）

**「さわってひろがる」自身（`sawatte-hirogaru-app.html`）の中に、新規の
「きろくをみる」画面を追加する。共通`learning-records.html`・
`record-dashboard-foundation.js`・`record-dashboard-ui.js`は一切変更しない。**

根拠:
1. §2.4のとおり、共通Dashboardの詳細modalは`hasMedia`を検知しても
   「このMVPでは表示していません」という**明示的な先送りスタブ**を返す設計
   に既になっている（hiragana/katakanaのtraceSampleが本番投入されても、
   です）。これは「richな可視化は共通Dashboardの責務外」という確立済みの
   設計判断であり、本Phaseがこれを覆す理由はない。
2. 共通Dashboardは21アプリ共有のファイルであり、変更すれば21アプリ全体への
   回帰リスクが生じる（Phase§46の明示的懸念）。App-local実装ならこのリスクが
   構造的にゼロになる。
3. §2.4のとおり、「さわってひろがる」は現状そもそも共通Dashboardの
   adapter未登録という別の既存Gapを抱えている。まだ機能していない統合経路の
   上に新機能を積むのは避ける（このGap自体は本Phaseのscope外、§19の
   Non-blocking Open Decisionとして切り出す）。
4. 既存Help overlay（`#helpOverlay`、非modal・Escape/close/focus-return
   パターン、`donomana-help-usage-guide-standard-v1_0.md`のReference
   Implementation由来）と同型のoverlayパターンを、trace Viewerにもそのまま
   再利用できる（新しいmodal基盤を作らない、trace-sample doc §12.2と同型）。

### 15.1 画面構成（案）

- Start画面に「📋 きろくをみる」導線を追加（新規ボタン、既存の
  `#openTeacherSettingsBtn`と混同しない別動線。もしくはTeacher Settings
  モーダル内に導線を置き、新規ボタンを1つも増やさない案も実装時に比較する。
  本Design Phaseでは「新規ボタン追加 or 既存Teacher Settings内への格納」を
  **Non-blocking Open Decision**として残す、§19）。
- 一覧: `sawatte_hirogaru_log`を新しい順に表示（日時・モード・活動時間・
  操作回数・軌跡記録の有無）。
- 各セッションに、`trace`が有効な場合のみ「🖊 軌跡をみる」ボタンを表示
  （trace-sample doc §12.1のC案=on-demand renderと同型、常時canvas描画は
  行わない）。
- 軌跡表示は非modal overlay。Activity Surfaceの比率に合わせたcanvas
  プレビューにtap（点/波紋）・swipe（線/ソフトトレイル）を描画する
  （Phase§17）。時系列表現は「開始→終了で薄い色から濃い色へのグラデーション」
  程度に留め、複雑化しない（Phase§18のB案、操作番号表示等は行わない）。
- 凡例（●タップ／―スワイプ）を併記する（Phase§19）。
- Canvasにaccessible name（`aria-label`）を設定し、同じ情報をテキストでも
  提示する（tap回数・swipe回数・総操作回数、Phase§37）。

---

## 16. Privacy表示・Help改訂（確定、必須変更箇所を確定）

### 16.1 修正が必要な既存文言（§13 Existing Production Text Audit、確定版）

| ファイル | 箇所 | 現行文言 | 対応方針 |
|---|---|---|---|
| `sawatte-hirogaru-app.html` | Help本文（行673） | 「指でさわった場所そのもの（座標）は記録しません。」 | Trace ON時にのみ真実でなくなるため、条件文言化 or 全体差し替えが必要。実装時にBlocking Gate |
| `apps-data.json` → `sawatte-hirogaru-app` | `lesson.tips` | 「…座標情報は保存されません。」 | 同上 |
| `apps-data.json` → `sawatte-hirogaru-app` | `caution` | 「…タッチ座標・視線の位置そのものは記録しません。」 | 「視線の位置」は今回も変わらず真実（§3）。「タッチ座標」部分のみ改訂対象 |

### 16.2 改訂文言の方向性（trace-sample doc §15の語彙選定に倣う）

`localStorage`・`JSON`等の技術語を使わず、次の骨子で実装時に確定する:

> 「せんせい用せってい」で軌跡の記録をONにすると、さわった場所やスワイプの
> 動きを、画面内のだいたいの位置として端末内に記録します（初期設定は
> OFFです）。視線を使った反応の位置は記録しません。記録はこの端末の
> ブラウザ内だけに保存され、外部へ送信されることはありません。

Trace OFF（既定）の場合は、既存文言に近い「指でさわった場所そのもの（座標）は
記録しません」という説明を維持できるよう、**設定状態に応じた条件文言**
にするか、「軌跡の記録をONにしない限り座標は記録されない」ことが伝わる
一文へ統一するかは、実装時にHelp本文全体の流れを見て確定する
（Non-blocking Open Decision、§19）。

---

## 17. Contract配置（確定）

新規独立文書として本ファイル
（`docs/design-system/donomana-sawatte-hirogaru-trace-record-contract-v1_0.md`）
を作成する。既存`donomana-sawatte-hirogaru-design-contract-v1_0.md`は変更しない。

根拠: Privacy Boundary変更を伴う拡張は、`donomana-trace-sample-recording-v1.md`
がhiragana/katakanaに対して既に独立文書として切り出されている前例と揃える。

---

## 18. Shared Foundationへの拡張可否（確定: 拡張しない）

trace capture・sampling・validation・canvas描画のいずれも`generate.js`の
共通Foundation（21〜36アプリへ影響しうる）へは追加せず、
`sawatte-hirogaru-app.html`内のlocal実装として持つ。

根拠: `donomana-trace-sample-recording-v1.md` §16と同じ判断基準
（「いつか使うかもしれない」だけで広範囲へ影響するFoundationを今つくらない。
展開が具体化した時点で純粋関数部分を引き上げる判断は容易）。

---

## 19. Blocking / Non-blocking Open Decisionsの最終整理

### 19.1 Blocking Decisions（本Phaseで確定、Implementation開始時点で0）

| # | 決定事項 | 結論 |
|---|---|---|
| 1 | Gaze coordinate保存 | NO（構造的に不可能な設計、§3/§6.4） |
| 2 | Touch/Mouse/Swipe座標保存方式 | 正規化0..1→0〜1000整数量子化、flat配列（§4/§7） |
| 3 | Normalized coordinate採用可否 | 採用（§4） |
| 4 | Sampling方式 | 時間(50ms)+距離(対角線3%)のhybrid（§9） |
| 5 | Point上限 | soft 500 / hard 1000、`trimmed`フラグで明示（§10.1/§10.4） |
| 6 | Schema version | `detailSchemaVersion`維持、`trace.traceSchemaVersion`新設（§8） |
| 7 | Trace default ON/OFF | Default OFF（§12） |
| 8 | Viewer location | アプリ内local Viewer、共通Dashboard変更なし（§15） |
| 9 | Summary CSV columns | §20で確定 |
| 10 | Trace CSV columns | §21で確定 |
| 11 | SessionID | 新規保存フィールドを追加せず、既存`timestamp`をCSV出力時の結合キーとして使う（§22） |
| 12 | Privacy wording | §16で方向性確定、最終文言はImplementation時に確定 |
| 13 | Legacy compatibility | フィールド有無判定、migrationなし（§11） |
| 14 | `sawatte_hirogaru_log`のrolling cap新設 | 推奨として確定（§10.3）。上限件数の具体値（200件等）はImplementation Phaseで確定 |

### 19.2 Non-blocking Open Decisions（Implementation Phase内で判断可）

- 「きろくをみる」導線を新規ボタンにするか、Teacher Settings内に格納するか（§15.1）
- Trace OFF時のHelp文言を条件文言にするか一文統一にするか（§16.2）
- 共通Dashboardへの`sawatte-hirogaru-app` adapter新設（§2.4のGap是正）は、
  本機能とは独立した別Phaseの候補とする
- Trace CSVボタンをdisabled表示にするかhidden表示にするか → **推奨:
  disabled + 説明文**（§23.3、hiddenは「機能が存在すること自体を知っている
  教師を混乱させる」ため）
- Per-interaction / per-sessionのaspect ratio保存（§5、現時点では不要と判断）

---

## 20. Summary CSV（確定）

「さわってひろがる」専用の、共通Dashboard CSVとは別のCSV
（既存register-app等と同じく「アプリ固有の詳細CSVを個別に持つ」パターン）。

1セッション = 1行。列（日本語、Excel-safe日付/時刻分離、既存
`donomanaRecordFormatCsvDateTime`と同じdot/colon方式を流用）:

```
日付, 時刻, 教材, モード, 活動時間（秒）, 操作回数, タップ回数, スワイプ回数,
操作方法, 音, 刺激の強さ, エフェクトの太さ, 効果音, 軌跡記録
```

- 「軌跡記録」列は `あり` / `なし`（`trace`フィールドの有無、中身は出さない）。
- 座標・trace内部データはこのCSVに一切混在させない（trace-sample doc §14の
  Boundaryと同型の絶対条件）。

---

## 21. Trace Detail CSV（確定）

1 point = 1 row。列:

```
日付, 時刻, セッションID, 操作番号, 種類, 点番号, X座標（相対位置）, Y座標（相対位置）, 経過ミリ秒
```

- `X座標`/`Y座標`は内部0〜1000整数を`/1000`した小数（例: `0.420`）で出力する
  （教師が読める形式、Phase§8のtap例フォーマットに合わせる）。
- `種類`は「タップ」「スワイプ」。
- `点番号`はswipeストローク内の1始まり連番。タップは常に`1`。
- Trace OFFのセッション、または`trace`を持たないlegacy recordは、
  このCSVには**行を出力しない**（存在しないデータを0埋めしない）。

---

## 22. SessionID（確定）

新規の永続フィールドは追加しない。CSV出力ロジック内でのみ、
`record.timestamp`（既存ISO 8601文字列、ミリ秒精度で実質一意）を
Summary CSVとTrace CSVを結合するための`セッションID`として使う。
UUID等の新規識別子は導入しない（Phase§31の想定どおり、local-onlyの
簡易識別子で十分と判断）。

---

## 23. CSV Export UI / Encoding / Filename（確定）

### 23.1 Encoding

既存`donomanaRecordBuildCsv`（Foundation共有関数、UTF-8 BOM・カンマ/改行/
ダブルクォートのエスケープ）をSummary CSV・Trace CSV双方でそのまま再利用する。
新規CSV helperは作らない（Phase§32の指示どおり）。

Formula Injection guard（`=`/`+`/`-`/`@`先頭エスケープ、register-app.html・
共通Dashboardの`csvSafeCell`が持つ機能）は、**「さわってひろがる」のCSVには
不要と判断する**。理由: このアプリのpayloadに含まれる値は、モード名・
強さ・エフェクト名・入力方法等の**固定enum文字列**と数値のみであり、
教師や子どもによる自由入力（register-appの商品名のような）が一切存在
しないため、Formula Injection攻撃面が構造的に存在しない。既存
`donomanaRecordBuildCsv`をそのまま使うことと矛盾しない。

### 23.2 Filename

既存規約（§2.7）に合わせ、ASCII・`{app}-kiroku-{ts}.csv`パターンを踏襲する:

```
sawatte-hirogaru-kiroku-YYYYMMDD_HHMM.csv   // Summary CSV
sawatte-hirogaru-kiseki-YYYYMMDD_HHMM.csv   // Trace CSV（軌跡=きせき、ローマ字）
```

### 23.3 Export UI

新設する「きろくをみる」画面に「CSVを保存」「軌跡CSVを保存」の2ボタンを
設ける。軌跡CSVボタンは、現在の一覧に`trace`を持つセッションが1件も
ない場合、**disabled（灰色表示）+「軌跡の記録があるきろくがありません」等の
説明文**とする（hiddenにはしない）。

根拠: 既にHelpで機能の存在を知っている教師が、ボタンごと消えていると
「壊れているのでは」と誤解しうる。disabled+説明の方が透明性が高く、
このプロジェクト全体の「空状態を無言で隠さず明示する」既存パターン
（例: `learning-records.html`の`zero-result-state`「条件に合う記録が
ありません」）と一貫する。

---

## 24. Clear / Delete（確定）

既存の記録削除機能（新設する「きろくをみる」画面、または将来共通Dashboard
adapterが追加された場合の共通削除経路）で`trace`フィールドも同時に削除される。
`trace`だけを個別に消す別経路は追加しない（Phase§26の指示どおり）。

---

## 25. Future Candidate（本Phaseでは未実装）

- Per-interaction / per-sessionのaspect ratio保存（§5、歪み対策）
- 共通`learning-records.html`への`sawatte-hirogaru-app` adapter新設
  （§2.4のGap是正、trace機能とは独立）
- 同一設定・同一モードでの複数セッション軌跡の重ね合わせ表示
- Trace再生アニメーション（`t`が既にpoint順で保持されているため将来対応しやすい）
- Gaze interaction countの明示的な集計フィールド追加（現状は`inputMethods`
  配列で間接判別可能なため見送り）

---

## 26. Test Matrix（Implementation Phase向け、確定）

### Capture
- tap 1回 / 連続tap / swipe 1本 / 短時間で中断されたswipe / 5点同時multi-touch
  / セッション中のorientation change / trace OFF時に一切保存されないこと

### Storage
- 1セッション / 複数セッション / point上限到達（500/1000） / traceフィールドを
  持たないlegacy record読み込み / 削除

### Viewer
- tapのみ / swipeのみ / tap+swipe混在 / trace 0件のセッション / mobile幅 /
  desktop幅 / trimmed=trueの表示

### CSV
- Summary CSV単体 / Trace CSV単体 / 日本語ヘッダー / カンマを含む値なし
  （固定enumのみのため想定不要だが形式検証） / BOM付与確認 / 複数セッション /
  legacy record（trace無し）がTrace CSVに行を作らないこと

### Privacy
- Gaze coordinateがtaps/swipesに一切含まれないこと（実ブラウザで
  gaze dwellを操作し、保存後のlocalStorageを直接検査） / 外部送信が
  一切発生しないこと（Networkタブ0件）

---

## 27. Real Device Gate（実装後、確定）

- iPad: trace capture（マルチタッチ含む）・Viewer表示・CSV2種のダウンロード
- Windows: mouseによるswipe trace・CSV
- Blue2（スイッチ）: 反応回数のみカウントされ、座標traceを一切生成しないこと
  （キーボード/スイッチ経路は`x=null`固定点のためtrace対象外、§6.4）
- Tobii: gaze countの記録可否確認・gaze coordinateが0件であることの確認
  （localStorage直接検査）

---

## 28. 最終報告

Phase: SAWATTE-HIROGARU-TRACE-RECORD-DESIGN-1

Status: TRACE RECORD MODEL DEFINED / CSV EXPORT MODEL DEFINED / PRIVACY
BOUNDARY UPDATED IN DESIGN / LEGACY COMPATIBILITY DEFINED / BLOCKING
DECISIONS ZERO / PRODUCT UNCHANGED / READY FOR IMPLEMENTATION

Production baseline: `main = origin/main = 3753751`

---

## 29. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft | 2026-09-13 | Phase SAWATTE-HIROGARU-TRACE-RECORD-DESIGN-1。初版。Trace Record + CSV設計を新規確定。Docs-only、Product変更0、User Approval待ち。 |
