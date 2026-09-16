# どのまな Learning Record Cross-App Detail Parity Contract（Version 1.0 Draft）

- Phase: `LEARNING-RECORD-CROSS-APP-DETAIL-CONTRACT-1`
- 版: v1.0 Draft（Design Only）
- 承認状態: Draft。User Approval待ち。Product変更・push・merge・deploy未実施。
- Baseline checkpoint: `fc2fb0a`（`feature/sawatte-trace-record-implementation-1`、User Browser Review承認済み・local commit）
- Worktree: `for-all-children-to-learn-learning-record-cross-app-detail-contract1`
- Branch: `design/learning-record-cross-app-detail-contract-v1`
- Production: `origin/main = 3753751`（本Phaseでは無変更）

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | 土台。Foundation record（`{timestamp, appId, activity, inputMethod, schemaVersion, payload}`）のCore Schemaを定義する既存標準。本ContractはこのCore Schemaを唯一のSource of Truthとして扱う（§7） |
| `donomana-sawatte-hirogaru-trace-record-contract-v1_0.md` | Reference Implementation対象。「さわってひろがる」のtrace schema（`traceSchemaVersion:1`）・Record Viewer・Summary/Trace CSVの実装根拠 |
| `donomana-sst-record-detail-contract-v1_0.md` | 既存のApp-local Record Detail拡張の先行事例（SSTの`scenario`/`choices`/`selected`）。本Contractの§9（App-owned Semantics）・§23（SST Parity Plan）の直接の調査対象 |
| `donomana-new-app-development-standard-v1_0.md` | 新規App開発の既存標準。本Contractの§20（New App DoD）をここへ追記する（cross-reference、§0末尾の更新履歴参照） |
| `docs/accessibility/audit/a11y-panel-global-conformance-matrix.md` | 共通A11yパネル（GLOBAL-1A、`restoreA11yPanelFocus()`等）のstrict containment実装。本Contract §17（A11y Panel Interaction）が参照する既存パターン |
| `docs/records/learning-record-detail-parity-matrix.md` | 本Contractの実測データ（Full App Inventory・Conformance Matrix）。本文書から分離し、実装が進むたびに更新される生きた文書とする |

---

## 1. 背景・目的

「さわってひろがる」（`SAWATTE-HIROGARU-TRACE-RECORD-IMPLEMENTATION-1`、baseline `fc2fb0a`）で、App内「きろくをみる」に以下の詳細が追加された。

- そうさした/タップした/スワイプした かいすう、モード、しげきの強さ、エフェクトの太さ・音、使った操作方法
- 軌跡記録の有無、「操作の軌跡を見る」（Trace Viewer、canvas再生）
- Summary CSV / Trace CSV

一方、共通`learning-records.html`（「学習の記録」）は、`sawatte-hirogaru-app`を含めまだ22アプリ中21アプリしかRecord Adapterを持たず（§5.3）、Adapterを持つアプリでも多くはSummary相当の情報のみで、Rich Visualization（軌跡・画像等）は「このMVPでは表示していません」の固定文言でブロックされている（§5.2）。SSTのApp-local detail（場面・選択肢・選んだ回答等、`donomana-sst-record-detail-contract-v1_0.md`で確定済み）も、共通側には一切反映されていない（§5.4）。

このまま「さわってひろがる」をApp-local detailだけで終わらせると、SSTと同じ「App内では詳細が見えるが共通『学習の記録』では見えない」という問題を繰り返す。本Contractは、この問題を**個別アプリごとの場当たり対応ではなく、どのまな全体の正式仕様**として固定する。

---

## 2. Core Principle（確定）

**APP-LOCAL / COMMON RECORD PARITY PRINCIPLE**

> 個別アプリ内で確認できる保存済み学習記録は、原則として共通「学習の記録」でも同等の意味内容を確認できること。

### 2.1 「同等」の定義（確定）

DOM/UIの完全複製ではない。以下を保証することを「同等」と定義する。

- 同じSource of Truth（Foundation record、§7）を参照する
- 同じ意味（field semanticsがApp-local/Common間でズレない、§9）
- 同じ保存済み事実（App-localで見える数値・文言と、Commonで見える数値・文言が一致する）
- 同じ主要詳細（Level 2、§6）
- 保存済みRich Visualizationがあれば、同じデータへのアクセス（Level 3、§6）

UI配置・見た目・展開/モーダルの選択はApp-local/Commonで異なってよい（§18で既存パターンを踏襲する方針を確定）。

### 2.2 例外条件（確定）

以下のみを例外として認める。

- Activity中だけ意味を持つ一時UI・Live情報（保存されないもの）
- Privacy上、共通画面に表示すべきでない情報
- 非常に巨大なraw/internal data（例: 全trace点の生座標をCSVでなくUIに丸ごと展開する等）
- Adapter/Foundation実装上のdiagnostic field（教育的意味を持たない内部値）

以下は例外理由として**認めない**（§4の原文どおり確定）。

- 「App固有だから」
- 「実装が面倒だから」
- 「Viewerが別だから」
- 「Common側にまだadapterがないから」

---

## 3. 既存アーキテクチャ調査（実測）

### 3.1 `learning-records.html`

- `assets/js/record-dashboard-foundation.js`（935行）と`assets/js/record-dashboard-ui.js`（352行）の2層構成。Foundation側が`RECORD_ADAPTERS`（appIdごとのstorage読み取り・normalize）を持ち、UI側がfilter/group/summary/CSV/label変換の**純粋関数**を持つ（DOM操作なし、Node.js golden testで検証、`tools/record-dashboard-poc/ui-golden-tests.js`）。
- Normalized Recordの形（Foundation §122-150、実コード確認）:
  ```
  { timestamp, appId, appName, category, activity, inputMethod,
    summary, metrics, hasMedia }
  ```
- 詳細表示（`openDetailModal()`、learning-records.html:506-528）は、日付・時刻・教材・カテゴリ・活動・入力方法・`record.summary`（1行テキスト）・`record.metrics`をformatした行、の**Level 1相当**のみ。
- `record.hasMedia === true`の場合、**「画像記録あり（このMVPでは表示していません）」の固定badgeのみ**を表示し、実データへは一切アクセスできない（learning-records.html:524-525）。これが本Contractが解消すべき既知のRich Visualization未実装ポイント。

### 3.2 Adapter Registry（既に実質的にAdapter Architecture）

`RECORD_ADAPTERS`（`assets/js/record-dashboard-foundation.js:182`）は、`appId → {appId, appName, category, storageKey, structure, privacyLevel, includeInDefaultTimeline, normalize(rawEntry)}`という**既存のAdapter Registryパターン**である。§8で確定する新Architectureは、これを置き換えるのではなく**拡張**する。

- 登録数: **21アプリ**（`hiragana-learn`/`katakana-app`/`suji-manabou`は共通ファクトリ`makeTraceQuizAdapter()`で登録）。
- `generate.js`の`LEARNING_RECORD_FOUNDATION_APPS`（Foundation record対応、22アプリ）と突合した結果、**`sawatte-hirogaru-app`のみがDashboard Adapter未登録**（実測、§3参照）。これは想定どおり（Trace Record Phaseの成果がまだcheckpoint後のCommon統合を経ていないため）であり、バグではない。
- `hasMedia: true`を返しうるAdapterは4件: `hiragana-learn`/`katakana-app`/`suji-manabou`（`data.traceSample`の有無）、`nazori-app`（`e.image`の有無）。いずれも実データは`normalize()`が捨てており、Common側には真偽値しか渡っていない。
- `sst-app`のAdapter（`assets/js/record-dashboard-foundation.js:649-670`）は`summary: 'SSTの活動に取り組みました（type）'`と`metrics.level`のみ。`donomana-sst-record-detail-contract-v1_0.md`が定義する`scenario.title`/`choices[]`/`selected.text`/`selected.level`は一切読んでいない。App-local（SST内の記録詳細画面）では見えるこれらの情報が、Common側では完全に欠落している＝**Category E「Common Detail不足」の実例**（§25）。

### 3.3 CSV

Common CSV（`buildCsvRows()`、`record-dashboard-ui.js:307-322`）は`日付/時刻/教材/カテゴリ/活動/概要/入力方法`の**共通7列のみ**。App固有列（さわってひろがるの操作回数/タップ回数/スワイプ回数等、SSTの場面/選択肢等）は一切含まない。App固有CSV（Summary CSV/Trace CSV等）はApp-local画面にしか導線がない。

### 3.4 A11y Panel

共通A11yパネル（`donomanaA11yPanel`）はGLOBAL-1A Production Released（`837d454`、`docs/accessibility/audit/a11y-panel-global-conformance-matrix.md`）でstrict containment済みだが、**`learning-records.html`自体はこの監査対象35アプリに含まれていない**（実測、grep結果0件）。本Contractのスコープ外の既知事実として記録し、Blocking扱いにはしない（§27 Non-blocking）。

---

## 4. Parity Levels（確定）

| Level | 内容 | 例 |
|---|---|---|
| **Level 1: Summary Parity** | 日時・教材・モード・活動時間・基本count | 既存Common Detail modalが既に満たす |
| **Level 2: Detail Parity** | App固有field・選択内容・設定・入力方法・問題/場面等 | さわってひろがるのタップ/スワイプ内訳としげき設定、SSTの場面/選択肢/選んだ回答 |
| **Level 3: Rich Visualization Parity** | Trace・Drawing・Media・Chartなど保存済み可視化 | さわってひろがるの軌跡、なぞり系アプリのtraceSample、nazori-appの画像 |

### 4.1 Required Level（確定・Blocking Decision解消）

- Record Foundation対応App（`LEARNING_RECORD_FOUNDATION_APPS`登録App）は、**Level 2をCommon側でも原則必須**とする。
- App-localが保存済みRich Visualization（`hasMedia: true`相当、または軌跡等の構造化データ）を提供する場合、**Level 3もCommon側で原則必須**とする。
- 既存21アプリ中、現時点でLevel 2を満たすAdapterは実測0件（全てLevel 1相当、§25の一覧参照）。これは**既存の負債**であり、本Contract自体が0件を即座に解消するものではない。§21〜24のRollout Planに従い段階的に解消する。

---

## 5. Record Source of Truth / No Duplicate Storage（確定）

- Foundation record（`donomana-learning-record-standard-v1_0.md` §5 Core Schema、`{timestamp, appId, activity, inputMethod, schemaVersion, payload}`）を唯一のSource of Truthとする。
- App-local viewer用とCommon viewer用の別recordを保存することを禁止する。両ViewerともApp自身のlocalStorage log（例: `sawatte_hirogaru_log`、`sst_activity_log_v1`）を直接読む。
- 既存21アプリの`RECORD_ADAPTERS[appId].storageKey`が既にこの原則どおりに実装されている（§3.2）。新規Adapter追加時もこのパターンを踏襲する。

---

## 6. Normalization / Legacy / Unknown Schema（確定）

- Foundation shape（`record.timestamp`/`appId`/`activity`/`payload`）を入口とする。Legacy shapeがある場合は**read-side normalizationのみ**を行い、migrationを必須にしない（既存`donomana-learning-record-standard-v1_0.md` §11 Legacy Compatibilityと同一方針）。
- 未知のAdapter（appId未登録）でも、record自体を隠さない。**最低限Common Summary（Level 1）は表示**し、詳細欄は「この教材の詳細表示にはまだ対応していません」等の安全なfallback文言にする（既存の`UNMAPPED_FALLBACK`パターン、`record-dashboard-ui.js:77`と同型の設計を踏襲）。
- `traceSchemaVersion`等のVisualization用schemaが未知またはmalformedの場合、Record自体（Level 1/2）は通常どおり表示し、**Rich Viewer部分だけ**「この軌跡データは表示できません」等でfallbackする。Record全体を非表示にしない。

---

## 7. App-owned Semantics（確定・Blocking Decision解消）

App固有fieldの意味のSource of TruthはApp自身のContract（例: `donomana-sawatte-hirogaru-trace-record-contract-v1_0.md`の`tapCount`定義）であり、Common Viewer側が独自に意味を再定義してはならない。

具体例（本Contract起草の直接のきっかけ、`SAWATTE-HIROGARU-TRACE-RECORD-USER-REVIEW-1-RETRY`で確定した意味を参照）:

- `totalInteractions`: Touch/Mouse/Gaze/Keyboard/Switchを含む全reaction数
- `tapCount`/`swipeCount`: Touch/Mouseによる実際のtap/swipeのみ
- `inputMethods`: 実際に使用された入力方法

Common側Adapterがこれらのfieldを表示する際は、**App-local画面と同じラベル・同じ値**を出す（別の集計や再解釈をしない）。§9のformatter共有方針は、この一致を実装レベルで保証するための手段である。

---

## 8. Adapter Architecture（確定・Blocking Decision解消）

### 8.1 方針

既存`RECORD_ADAPTERS`（Adapter Registryパターン、§3.2）を**壊さず拡張**する。新規の並行機構は作らない。

各Adapter定義に、既存の`normalize(rawEntry)`（Level 1相当を返す、無変更）に加え、以下を**任意（optional）フィールド**として追加できるようにする。

```
RECORD_ADAPTERS[appId] = {
  // 既存（無変更）
  appId, appName, category, storageKey, structure, privacyLevel,
  includeInDefaultTimeline, normalize(rawEntry),

  // 新規・任意（未定義のAdapterはLevel 1のまま、§6のfallbackへ）
  getDetails(rawEntry, normalized) -> [{label, value}, ...]   // Level 2
  richVisualization: {                                          // Level 3
    supports(rawEntry) -> boolean,
    render(target, rawEntry)   // 純粋DOM描画関数。App-local Viewerと共有（§10）
  },
  getCsvActions(rawEntry) -> [{label, ...}]                     // CSV parity（§12）
}
```

- `getDetails()`未定義 → Common DetailはLevel 1のまま（§6のfallbackと同じ扱い、既存21アプリの現状はこれに該当）。
- `richVisualization`未定義 → 既存の「画像記録あり（このMVPでは表示していません）」相当のfallback文言を維持（§6）。
- 責務は`supports(record)`/`getSummary(record)`（＝既存`normalize()`が実質兼務）/`getDetails(record)`/`renderRich(record, target)`/`getCsvActions(record)`の5つに整理する（§16の提案どおり採用）。

### 8.2 実装しない

本Phaseは設計のみ。上記構造の実装（`RECORD_ADAPTERS`への`getDetails`/`richVisualization`追加）は次Phase（§21 `SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1`）で行う。

---

## 9. Shared Formatter方針（確定）

`record-dashboard-ui.js`の`activityLabel()`/`formatMetrics()`は既にApp横断で共有されるformatterである。この方針を維持し、新たに`getDetails()`が返すlabel/valueも、可能な範囲で**App-localの既存formatter（例: さわってひろがるの`MODE_LABEL`/`INTENSITY_LABEL`）を流用**し、Common側で同じ日本語ラベルを再定義しない。

ただし§50（Shared helper boundary）のとおり、**共通helper化のしすぎは禁止**する。App固有のlabel mapping（例: さわってひろがるの`EFFECT_WIDTH_LABEL`）はApp-localファイル内に置いたまま、Common Adapter側の`getDetails()`がそれを**参照する構造を作らない**（static site・`<script src>`個別読み込みという既存制約上、App-localのJSはCommon側から直接importできないため）。代わりに、Common Adapter側で**同じ値と同じ日本語文言を独立に持つ**（既存`activityLabel()`が21アプリ分のコード値マッピングを1ファイルに集約している現状のパターンと同型）。App Contractの意味変更時は両側の追随が必要になる点を、§49（Versioning）のsupportsフィールドで緩和する。

---

## 10. Rich Visualization Parity — Trace Renderer Architecture（確定・Blocking Decision解消）

### 10.1 現状

さわってひろがるのTrace Viewer（App-local、`traceViewerCanvas`への描画）は`sawatte-hirogaru-app.html`内にインライン実装されている。

### 10.2 採用方式

`record-dashboard-foundation.js`/`record-dashboard-ui.js`と同じ**UMD風の独立JSファイル**として、trace描画ロジックを`assets/js/record-trace-renderer.js`（仮称）に切り出す。

- 責務: `traceSchemaVersion:1`の`{taps:[x,y,t,...], swipes:[[x,y,t,...],...]}`を受け取り、canvas 2D contextへ点/波紋（タップ）・線/ソフトトレイル（スワイプ）を描画する**純粋関数**（DOM取得はcaller側、renderer自体はcontextとdataのみ受け取る）。
- App-local（`sawatte-hirogaru-app.html`）・Common（`learning-records.html`のRich Visualization detail）の**両方がこの1ファイルを`<script src>`で読み込む**（§21候補A「共有helper」・§21候補C「純粋関数化」の組み合わせ、既存の`record-dashboard-*.js`と同型の構成のため、リポジトリの静的サイト・no bundler制約に最も自然に適合する）。
- 凡例（●タップ／―スワイプ）・グラデーション表現（開始→終了で薄い色から濃い色へ）は`donomana-sawatte-hirogaru-trace-record-contract-v1_0.md` §15.1のApp-local仕様をCommon側でもそのまま踏襲する（別デザインを作らない）。

### 10.3 実装しない

ファイル分離・実装は次Phase（§21）で行う。本Phaseでは方式のみ確定する。

---

## 11. CSV Parity（確定・Blocking Decision解消）

- Common Summary CSV（既存7列）は**維持**する。列追加・仕様変更は行わない（既存の全App共通の性質を壊さない）。
- App固有CSV（さわってひろがるのSummary CSV/Trace CSV等）は、**Common Detail panel内のボタンからApp固有のCSV生成ロジックを呼び出す**方式を第一候補とする。
- CSV生成ロジックの重複を避けるため（§32 No duplicate semantic logic）、App-local側の`buildSummaryCsvRows()`/`buildTraceCsvRows()`（現状`sawatte-hirogaru-app.html`にインライン）を、次Phase実装時に**Adapterの`getCsvActions()`が参照できる形へ切り出す**（§10.2のtrace rendererと同様、独立JSファイル化を推奨。ただし本Phaseでは決定のみ、実装しない）。
- 上記が次Phースで直ちに完了しない場合の**暫定案**として、Common Detail内に「この教材でCSVを書き出す」ボタンを置き、App-local画面（きろくをみる）へのdeep linkとする方式も許容する（§28のUXと合わせて次Phaseで最終決定）。いずれの場合も**別々のCSV生成ロジックを新規に書き起こすことを禁止**する。

---

## 12. Accessibility（確定）

- Common Detail（Level 2/3表示）は、既存`record-detail-modal`のfocus trap・`aria-modal`パターンを踏襲し、keyboard操作可能・focus order・screen readerでの最低限summary取得を維持する。
- **canvas-onlyのRich Visualization表示を禁止**する。§10.2のtrace rendererは、App-localの既存パターン（凡例テキスト併記、`traceViewerCounts`のtext-equivalent count summary）と同様に、**text fallback（タップ回数・スワイプ回数・総操作回数の文字表示）を必ず併設**する。
- A11y Panel（GLOBAL-1A、共通containment）との優先順位は、既存の`overlaysOpen()`パターン（App-local側、A11yパネルopen時は他modalを閉じる／新規open抑止）と同じ設計をCommon Detail modalにも適用する。既存35アプリのGLOBAL-1A strict containment実装（`restoreA11yPanelFocus()`）を再利用し、新規の並行containment機構を作らない。

---

## 13. Privacy（確定）

Common Viewerへの表示範囲拡大は、以下を一切変更しない（既存`donomana-learning-record-standard-v1_0.md` §3 Privacyおよび各App Contractの既存Privacy境界を踏襲）。

- 外部送信の追加なし（表示はすべてlocalStorage内で完結）
- サーバー同期なし
- 永続データの追加保存なし（Common側が独自にdataを複製保存することは§5で既に禁止）

---

## 14. Performance / Mobile（確定）

- 一覧ロード時に全recordのdetail/Rich Visualizationを一括parse/renderしない。**on-demand render**（Record row展開時にのみ`getDetails()`/`renderRich()`を呼ぶ）とする。既存App-local Trace Viewer（「on-demand render、常時canvas描画は行わない」、trace-record contract §15.1）と同じ方針。
- 390px幅程度のモバイルでも、summary/detail/visualizationがreadable・scroll-safeであり、action buttonの重なりが起きないことをDoDに含める（§20）。

---

## 15. Fallback / Legacy / Unknown App まとめ（確定）

| ケース | 挙動 |
|---|---|
| Adapter未登録のappId | Record自体は隠さず、Common Summary（Level 1相当の最低限情報）のみ表示。詳細欄は「この教材の詳細表示にはまだ対応していません」 |
| `getDetails()`未定義 | Level 1のまま表示（既存21アプリの現状） |
| `richVisualization`未対応/未定義 | 「このMVPでは表示していません」相当の既存文言を維持 |
| trace/media schema不明・malformed | Record（Level 1/2）は通常表示。Rich Viewer部分のみ「この軌跡データは表示できません」 |
| Legacy record（optional field欠落） | field-presence based。存在しないfieldを推測で埋めない（既存`donomana-sst-record-detail-contract-v1_0.md` §14.5の「detailを持たないlegacy recordは該当列を空欄」と同一方針） |

---

## 16. New App Development Standard 追記（確定・Blocking Decision解消）

`donomana-new-app-development-standard-v1_0.md`へ、Record機能を持つ新規App開発時の必須要件として以下をcross-referenceする（本Phaseで当該文書へ最小限の追記を行う。文書本体の大規模改訂はしない）。

> Record機能を実装する場合、以下を同一Phaseまたは直後の必須Phaseとして設計すること（`donomana-learning-record-cross-app-detail-contract-v1_0.md`参照）:
> 1. 保存schema（Foundation record準拠）
> 2. App-local summary/detail
> 3. 共通「学習の記録」への Summary + Detail（Level 2）連携
> 4. 保存済みRich Visualizationがある場合はLevel 3連携
> 5. CSV parity
>
> 「App内だけ実装して共通『学習の記録』への連携をしない」状態は、本Standard違反として扱う。

---

## 17. Definition of Done 追加（確定）

Record対応AppのDoDへ以下を追加する。

- [ ] App-local record表示 PASS
- [ ] Common「学習の記録」Summary表示 PASS
- [ ] Common「学習の記録」Detail（Level 2）表示 PASS
- [ ] semantic parity PASS（App-local/Common間でfield意味の不一致がない、§9実機確認）
- [ ] Rich Visualization保有Appの場合: Level 3 parity PASS
- [ ] legacy record PASS（optional field欠落時も壊れない）
- [ ] CSV parity確認（Common Detailから該当App CSVへアクセス可能、または明確な代替導線がある）
- [ ] accessibility PASS（keyboard・focus・text fallback・A11y Panel優先順位）
- [ ] mobile PASS（390px幅でsummary/detail/visualizationが崩れない）

---

## 18. Conformance Matrix（分離文書）

実測データ（Full App Inventory・Parity Status一覧）は`docs/records/learning-record-detail-parity-matrix.md`に分離して作成する（本文書に埋め込まない。実装が進むたびに更新される生きた文書とするため）。Status語彙を以下で確定する。

- `CONFORMANT`: Level 2（Rich Visualization保有Appは同時にLevel 3）を満たす
- `PARTIAL`: Level 2の一部のみ満たす、またはLevel 3未対応（Level 2保有Appのみ該当しうる）
- `SUMMARY ONLY`: Level 1のみ（既存21アプリの大半が現在ここに該当）
- `NOT INTEGRATED`: Foundation record対応だがCommon Adapter未登録（現時点で`sawatte-hirogaru-app`のみ）
- `NOT APPLICABLE`: Record機能自体を持たない、またはFoundation対象外

---

## 19. Full App Inventory（分類方針）

Record Foundation対応22アプリ（`LEARNING_RECORD_FOUNDATION_APPS`）を以下に分類する（実測結果は§18の分離文書）。

- **A. App-local Summaryのみ**
- **B. App-local Detailあり（Common未反映）**
- **C. Rich Visualizationあり（Common未反映）**
- **D. Common Detail (Level 2) あり**
- **E. Common Detail不足**（Bに同じ、実測ではSSTがここに該当）

---

## 20. Sawatte Reference Integration Plan（次Phase、確定）

`SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1`の内容:

1. `RECORD_ADAPTERS['sawatte-hirogaru-app']`をCommon Dashboard Foundationへ新規登録（Level 1相当のnormalize）
2. `getDetails()`実装: 操作回数/タップ回数/スワイプ回数/モード/しげきの強さ/エフェクトの太さ/エフェクト音/操作方法/軌跡記録あり・なし（§19の要求どおり全て、App-localと同じ値・同じラベル、§7準拠）
3. `assets/js/record-trace-renderer.js`切り出し（§10.2）、App-local Trace Viewerと共有
4. `richVisualization`実装: Common Detailから「操作の軌跡を見る」（App-localと同じtraceSchemaVersion:1を読む、別形式へ変換保存しない、§15の記事どおり）
5. CSV parity実装（§11の方式のいずれかを確定して実装）
6. legacy compatibility確認（trace未保存の既存recordでCommon Detailが壊れないこと）
7. accessibility確認（§12）

---

## 21. SST Parity Plan（次々Phase、確定）

`SST-COMMON-RECORD-DETAIL-PARITY-AUDIT-1`:

- 既存`donomana-sst-record-detail-contract-v1_0.md`が定義する`scenario.title`/`choices[]`/`selected.text`/`selected.level`のうち、Common側に不足している全項目を監査
- `RECORD_ADAPTERS['sst-app']`の`getDetails()`実装（§8.1のAdapter拡張構造をSSTにも適用、Sawatteでの実装パターンを再利用）
- SSTはRich Visualization（軌跡等）を持たないため、Level 3は対象外（§4.1の条件どおりLevel 2のみ必須）

---

## 22. Global Rollout Plan（確定）

既存Appの一括大改修はしない。段階的ロールアウトとする。

1. さわってひろがる Reference Implementation（§20）
2. SST Parity（§21）
3. Trace/Drawing系App（`hiragana-learn`/`katakana-app`/`suji-manabou`/`nazori-app` — 実測でhasMedia:true相当を持つ4アプリ、§3.2）
4. その他Record Foundation対応App（残り、§18のConformance Matrixで優先順位を管理）
5. `LEARNING-RECORD-DETAIL-PARITY-AUDIT-ALL-1`（全Record対応App監査、§18のMatrixを完成させる）
6. 今後の新規App標準への適用（§16、既に本Phaseで追記済み）

---

## 23. Blocking Decisions — 解消状況

| # | 項目 | 解消箇所 |
|---|---|---|
| 1 | Parity Principle | §2 |
| 2 | Required Parity Level | §4.1（Level 2必須、Rich Visualization保有Appは+Level 3） |
| 3 | Adapter Architecture | §8（既存`RECORD_ADAPTERS`拡張） |
| 4 | Rich Visualization Handling | §10（shared renderer module方式） |
| 5 | CSV Parity | §11 |
| 6 | Fallback | §6・§15 |
| 7 | Legacy | §6・§15 |
| 8 | Accessibility | §12 |
| 9 | New App DoD | §16・§17 |
| 10 | Rollout Order | §22 |

**Blocking Open Decisions: 0**

---

## 24. Non-blocking Open Decisions

- CSV parityの最終実装方式（§11「Common Detail内ボタンから直接呼ぶ」 vs 「App-localへのdeep link」）は、次Phase実装時の技術的詳細検討に委ねる（両方針とも本Contractの原則には反しない）。
- `learning-records.html`自体がGLOBAL-1A A11yパネル監査（35アプリ監査）の対象外である点（§3.4）は、本Phaseのスコープ外の既存事実として記録するのみで、是正はこのContractの責務としない。
- `record-trace-renderer.js`の正確なAPI形状（引数の型・関数名）は次Phase実装時に確定する。

---

## 25. Definition of Done（本Design Phase自体）

- [x] fc2fb0a baseline確認（Design worktree HEAD = fc2fb0a、origin/main = 3753751、working tree clean）
- [x] App-local/Common parity principle固定（§2）
- [x] Level 2必須固定（§4.1）
- [x] Rich visualization parity方針固定（§10）
- [x] Adapter architecture固定（§8）
- [x] Single Source of Truth固定（§5）
- [x] CSV parity固定（§11）
- [x] Legacy/fallback固定（§6・§15）
- [x] A11y固定（§12）
- [x] New App DoD固定（§16・§17）
- [x] Conformance Matrix作成（分離文書、§18）
- [x] Sawatte integration plan固定（§20）
- [x] SST parity plan固定（§21）
- [x] Global rollout固定（§22）
- [x] Blocking Decisions 0（§23）
- [x] Docs only（Product変更0件）
- [x] Production unchanged（`origin/main = 3753751`のまま）
