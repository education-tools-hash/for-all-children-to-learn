# Learning Record Detail Parity — Full App Audit（Version 1.0）

- Phase: `LEARNING-RECORD-DETAIL-PARITY-AUDIT-ALL-1`
- 版: v1.0（Audit + Design Only）
- 承認状態: Draft。User Approval待ち。Product変更・push・merge・deploy未実施。
- Baseline checkpoint: `400e08c`（`main` = `origin/main`、drift確認済み）
- Worktree: `for-all-children-to-learn-learning-record-detail-parity-audit-all1`
- Branch: `audit/learning-record-detail-parity-all-1`
- Production: `origin/main = 400e08c`（本Phaseでは無変更）

**更新履歴（本文書はv1.0時点のAudit結果を保持するが、以下の実装進捗を追記する）**:
- `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1`: `nazori-app`をLevel 2 + Level 3実装（実装完了、User Review待ち、Product未commit）。§7で計画されていた「rendererなしで`<img>`表示のみで足りる」という方針どおりに実装した。最新状況は`docs/records/learning-record-detail-parity-matrix.md`を参照（本文書は更新しない、生きた文書ではない）。
- `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`: `hiragana-learn`・`katakana-app`をLevel 2 + Level 3実装（実装完了、User Review待ち、Product未commit）。§8で計画されていたnazori優先→hiragana/katakana同時実装（新規stroke renderer）の方針どおりに実施し、両App実コード確認でtraceSample schemaがbyte-identicalだったため1組の共有moduleで実装した（Canvas Stroke Reference）。最新状況は`docs/records/learning-record-detail-parity-matrix.md`を参照。
- `LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1`: `okane-app`・`tokei-app`・`shiritori2`をLevel 2実装（実装完了、User Review待ち、Product未commit）。Root Investigationで、3AppともApp-local保存schemaが本Auditの想定より単純（session-aggregate中心、per-question detailなし）であることを確認し、実際に追加したfieldは最小限（tokei-app/shiritori2は既存metrics経路で大半充足、okane-appはDetail追加なし・CSV parityのみ）。3Appは互いにschemaが異なるため独立した3つのshared moduleとして実装した。最新状況は`docs/records/learning-record-detail-parity-matrix.md`を参照。

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-cross-app-detail-contract-v1_0.md` | 本Auditの適用元Contract。APP-LOCAL/COMMON PARITY PRINCIPLE・Parity Levels・Adapter Architecture・Rollout Planを定義（本Auditは§22 Global Rollout Planのステップ5に相当） |
| `docs/records/learning-record-detail-parity-matrix.md` | 本Auditの結果を反映した対象文書。全22アプリのApp-local「未監査」を解消し、Status/Risk/Recommended Phaseを確定した |
| `docs/records/sst-common-record-detail-parity-audit-v1_0.md` | 個別App監査の先行事例（SST）。本Auditのper-app調査フォーマットの元にした |
| `assets/js/record-dashboard-foundation.js`（1154行、全文読了） | Common Adapter Registry。22アプリ全ての`normalize()`・`getDetails()`/`richVisualization`/`getCsvActions()`有無を実測した一次情報源 |
| `assets/js/record-dashboard-ui.js`（371行、全文読了） | Common側の`activityLabel`/`formatMetrics`/CSV（共通7列）。App横断で共有される唯一のformatter |
| `assets/js/record-trace-renderer.js`（184行、全文読了） | Sawatte Reference Implementationのtrace renderer。`traceSchemaVersion:1`の`{taps,swipes}`専用（§7で詳述） |
| `assets/js/sawatte-hirogaru-record-detail.js`・`assets/js/sst-record-detail.js` | 「App固有shared moduleをApp-local/Common両方が読み込む」という既存パターンの2つの実例（§9） |

---

## 1. 目的（再掲）

Sawatte/SSTで確立した**APP-LOCAL / COMMON RECORD PARITY PRINCIPLE**を、残り20アプリへ展開するための現状監査。個別実装（Product変更）は行わず、以下を確定する:

1. 全22アプリの現状Parity Level（実測）
2. Rich Visualization対象アプリと、そのスキーマの異同
3. CSV Gapの有無
4. アプリごとの実装Risk
5. Rollout Batch（実装順）
6. Conformance Matrix（`learning-record-detail-parity-matrix.md`）の更新

---

## 2. 開始Gate（実測）

```
git fetch origin        → 変化なし
git status               → clean
git rev-parse main       → 400e08cfe9cdc07f12019a4d79e11a24729995fd
git rev-parse origin/main → 400e08cfe9cdc07f12019a4d79e11a24729995fd
```

Drift: なし。Worktree作成後も再確認、baseline固定を確認した。

---

## 3. 監査方法

- **Common側**: `assets/js/record-dashboard-foundation.js`を1154行全文読了し、22 `registerAdapter()`呼び出し全てのフィールドを直接確認した。`getDetails:`/`richVisualization:`/`getCsvActions:`を定義しているのは`sst-app`と`sawatte-hirogaru-app`の2件のみであることをgrepで再確認した（他20件は`normalize()`のみ）。
- **App-local側**: 22アプリのうち20アプリ（Reference 2本を除く）を、4本のサブエージェントによる並行read-only調査で実測した。各アプリの「記録保存箇所」「記録一覧/詳細表示箇所」「CSV出力箇所」を、関数名・行番号付きで特定した。推測に基づく記載はない。
- **横断整合性**: サブエージェントの報告内容を、`record-dashboard-foundation.js`の`normalize()`実装（何を`metrics`へ拾っているか）と突き合わせ、「App-localで見える情報だが、実はCommonの`metrics`経由で既に表示されている」ケースを個別に判定した（§8）。

---

## 4. Full App Inventory（実測、22アプリ）

`generate.js`の`LEARNING_RECORD_FOUNDATION_APPS`（22件）と`RECORD_ADAPTERS`（22件）が完全一致することを確認した（前回Audit時点で唯一の不一致だった`sawatte-hirogaru-app`は、Production Release済みのため解消済み）。

詳細な列（Foundation/App-local Summary/App-local Detail/Rich Viz/Common Summary/Common Detail/Common Viz/CSV/Required Level/Current Level/Status/Risk/Recommended Phase）は`docs/records/learning-record-detail-parity-matrix.md`を参照（本文書には重複掲載しない、Contract §18の「実測データは分離文書」方針を踏襲）。

---

## 5. Audit Classification（Phase指定の分類、実測結果）

| 分類 | 該当アプリ数 | 該当アプリ |
|---|---|---|
| A. SUMMARY ONLY | 16 | janken-app・register-app・tokei-app・matching-app・shiritori2・directions-app・mitsukete-touch-app・junban-miyou-app・kurabeyou-app・katachi-awase-app・dotchiga-ii-app・miru-hirogaru-app・okane-app・mogura-tataki・bosai-app・suji-manabou |
| B. APP-LOCAL DETAIL ONLY（Common未反映のDetailがある） | 上記16の一部（実質13） | directions-app・janken-app・register-app・bosai-app・kurabeyou-app・katachi-awase-app（App-local Detailが明確に存在するもの。tokei/matching/shiritori2/okane/mogura-tatakiはApp-local自体もDetailが希薄なため実質A寄り、dotchiga-ii/mitsukete-touch/junban-miyou/miru-hirogaruはセッション集約のみで「1行要約超のper-item detail」は無い） |
| C. RICH VISUALIZATION MISSING（Common未反映） | 3 | hiragana-learn・katakana-app・nazori-app |
| D. LEVEL 2 CONFORMANT | 1 | sst-app |
| E. RICH VISUALIZATION MISSING（かつ元々App-localにも無い） | 1 | suji-manabou（trace自体を保存しないため、Rich Visualization自体がNOT_APPLICABLE） |
| F. LEVEL 3 CONFORMANT | 1 | sawatte-hirogaru-app |
| G. NOT APPLICABLE | 1 | kyou-no-kiroku（Privacy例外） |

(A/Bは重複あり、1アプリが両方に該当しうる分類のため合計は22を超える。)

---

## 6. Common側アーキテクチャ実測（再確認）

- `RECORD_ADAPTERS`（Adapter Registry）は22アプリ全件登録済み。`getDetails()`/`richVisualization`/`getCsvActions()`を定義しているのは`sst-app`・`sawatte-hirogaru-app`のみ（grep実測、`assets/js/record-dashboard-foundation.js`全1154行に他の該当なし）。
- `hasMedia:true`を返しうるAdapterは4件のまま変化なし: `hiragana-learn`・`katakana-app`・`suji-manabou`・`nazori-app`。ただし実際にRich Visualizationデータを保存するのは3件のみ（`suji-manabou`は保存自体をしていない、§7参照）。
- Common Summary CSV（`buildCsvRows()`、`record-dashboard-ui.js:326`）は共通7列（日付/時刻/教材/カテゴリ/活動/概要/入力方法）のまま。App固有列は一切含まない。
- Common Detail modal（`openDetailModal()`、`learning-records.html`）は、`record.metrics`（`normalize()`が返す任意の数値/真偽値フィールド）を`formatMetrics()`経由で自動的に行表示する。**この経路は「Level 2」ほどではないが「Level 1+α」の効果を持つ**。実際、`tokei-app`の`retried`/`avgTimeSec`、`shiritori2`の`score`/`maxStreak`/`chainLength`は、`getDetails()`未実装のまま既にCommon Detail modalへ表示されている（§8で詳述）。この既存機構を「Level 2実装」と誤認しないよう、本Auditでは`metrics`経由の表示を明確に区別した。

---

## 7. Rich Visualization — 3つの異なるスキーマ（実測、統一不可）

Cross-App Detail Contract §20は「`record-trace-renderer.js`を他Trace系へそのまま使えるか調査。無理な統一禁止」を明示している。本Auditで3つの実データスキーマを直接比較した結果、**いずれも統一不可能**なことを確認した。

| App | 保存データ形状 | 時刻情報 | 座標系 | 描画方式（App-local） | `record-trace-renderer.js`で描画可能か |
|---|---|---|---|---|---|
| sawatte-hirogaru-app | `{traceSchemaVersion:1, taps:[x,y,t,...], swipes:[[x,y,t,...],...]}`（flat配列、3要素1組） | ✅ 各点にelapsed ms | 0–1000量子化 | canvas、時刻ベースのグラデーション（`alphaForT`） | ✅（Reference実装そのもの） |
| hiragana-learn / katakana-app | `{version:1, coordinateSpace:'normalized-1000', strokes:[[x,y,x,y,...],...]}`（画（stroke）ごとの配列、2要素1組） | ❌ 時刻情報を持たない（24点の弧長等分resampleのみ） | 0–1000量子化（sawatteと同じ量子化範囲だが構造が違う） | canvas、お手本（KanjiVG）重ね描画オプション付き | ❌（時刻フィールドが無いため`alphaForT`が前提とするグラデーション計算が成立しない。2要素/組 vs 3要素/組で配列構造自体が違う） |
| nazori-app | base64 PNG dataURL（`canvas.toDataURL('image/png')`の実行結果そのもの） | N/A（ラスター画像） | N/A | `<img src="dataURL">`をそのまま埋め込むのみ、canvas演算なし | ❌（そもそもcanvas描画ではなく画像表示。renderer自体不要） |
| suji-manabou | 保存データなし（ライブ中のcanvas描画のみ、記録に残さない） | — | — | — | N/A（描画対象データが存在しない） |

**結論**: Sawatteの`record-trace-renderer.js`は`hiragana-learn`/`katakana-app`/`nazori-app`のいずれにも直接再利用できない。実装時（Batch A）は以下の3方式が必要になる。

1. **hiragana-learn / katakana-app用**: 新規の「stroke polyline renderer」（`donomanaRecordStrokeRenderer.js`相当）。時刻情報が無いため、sawatteのような時間グラデーションではなく、単純な線描画（かつ「お手本重ね表示」をCommon側でも再現するかは別途User判断が必要、Non-blocking扱い）。hiragana-learnとkatakana-appは実装が完全に同一（`traceSample`の生成・検証関数がコピー実装）なので、1つのrendererを両アプリで共有できる。
2. **nazori-app用**: rendererと呼べるものは不要。Common Detail modalに`<img src="${payload.image}">`相当を追加するだけで足りる。ただし画像サイズが数十〜数百KBあるため、Contract §14（一覧表示時に全media一括renderしない、on-demand render）を厳守する必要がある——nazori-app自身が60件のrolling capを持つ理由と同じ制約。
3. **suji-manabou**: Rich Visualization自体がNOT_APPLICABLE。実装対象外（App-local自体に機能がないため、これはCommon統合の対象ではなくApp自体の機能追加の話であり、本Contractのスコープ外）。

---

## 8. `metrics`経由の「隠れたLevel 1.5」実測（本Auditの新規発見）

`normalize()`が`metrics{}`へ数値/真偽値フィールドを入れると、`record-dashboard-ui.js`の`METRIC_LABELS`に対応ラベルがある限り、Common Detail modalへ自動的に表示される。これは`getDetails()`（Level 2）と機能的に重なるが、実装上は完全に別経路であり、**App-local側の1行要約を超えるper-item detail（複数選択肢・複数質問等）は一切表現できない**（数値/真偽値の単純な列挙のみ）。

実測で確認した「既にmetrics経由でほぼ表示済み」のケース:

- `tokei-app`: `retried`（やり直し回数）・`avgTimeSec`（平均時間）は既にCommon Detail modalへ表示されている。App-local自体もper-question detailを持たないため、実質的なGapはほぼ無い。
- `shiritori2`: `score`・`maxStreak`・`chainLength`は既にCommon Detail modalへ表示されている。`outcome`（文字列、'completed'/'trap'等）のみ未反映——ただし`formatMetrics()`は`typeof value === 'boolean'`のみ特別扱いし文字列もそのまま表示するため、`normalize()`に1行追加するだけで解消可能な小さなGap。

逆に、`matching-app`（`level`/`displayMode`/`usedCustomSet`/`playerCount`が`metrics`未収録）は、App-local一覧の見出しバッジ自体がlevel/modeを表示しているため、Common側の`metrics`未収録は実際のApp-local visible情報との差分（Parity Gap）として扱うべきと判断した。

---

## 9. Legacy / Unknown Schema（実測）

- **Common（Level 1）側の防御**: `tools/record-dashboard-poc/golden-tests.js`のsection 6〜9（Corrupted storage matrix、Cross-app failure isolation、Legacy/missing-fields fixtures）が22アプリ全件を対象に、storage破損・entry破損・schemaVersion欠落のいずれでも他Appの収集を妨げず、`undefined`/`NaN`/Invalid Dateを生成しないことを既に検証済み（816/816 PASS、本Audit時点でも再確認済み）。この基盤はLevel 2/3実装後も無変更で機能し続ける設計（Contract §6のfallback方針どおり）。
- **App-local側で本Auditが新規発見した防御の欠落**（Level 2実装時に追加対応が必要）:
  - `mogura-tataki`: `renderRecs()`が`score`/`rate`に`|| 0`等のfallbackを持たず、`Math.max(...rs.map(r=>r.score))`が壊れたレコードで`NaN`を生成しうる。
  - `bosai-app`: `buildDetailHTML(r)`が`r.log.forEach(...)`を`Array.isArray`guardなしで呼ぶ。legacyレコードに`log`が無い場合、App-local自身がthrowする（Common実装時は当然guardを追加するが、App-local側の既存バグとしても記録する）。
  - `kyou-no-kiroku`: `formatDate()`に`isNaN`guardが無く、不正な`date`で「Invalid Date」がそのまま表示されうる（Common側は既定Timeline除外のため実害はCommon側には及ばない）。
- 上記3件は「Common実装時に新規のfallbackコードが必要」というImplementation Riskとして§11のper-app riskへ反映した。

---

## 10. Accessibility（設計レベル評価）

- 既存App-local Detail UIは、`nazori-app`の`<img>`表示（軽微なalt textのみ）を除き、全てテキストベース（`<div>`/`<table>`/`<li>`）でありcanvas-onlyの表示は無い。`kurabeyou-app`/`katachi-awase-app`の`appendRecordDetailToggle()`は`aria-expanded`/`aria-controls`を既に実装しており、Common Detail modal（既存`record-detail-modal`のfocus trap）へ同種の展開UIを追加する際の直接的な手本になる。
- **例外・要対応**: `hiragana-learn`/`katakana-app`のtraceSampleビューアは、描画したstroke形状そのものについてのtext alternativeを持たない（canvas + 文字での「もじ名」「時刻」のみ）。Contract §12は「canvas-onlyのRich Visualization表示を禁止」と定めており、これをCommon側へそのまま移植すると同じ欠落を引き継ぐことになる。Batch A実装時は、tap/swipe回数のような定量的なtext fallback（sawatteの`describeCounts()`相当）をstroke系にも新規設計する必要がある（Non-blocking、実装時の技術詳細）。
- `learning-records.html`自体はGLOBAL-1A A11yパネル監査（35アプリ対象）の対象外という既知の事実（Contract §3.4で既出）に変化はない。本Auditのスコープ外として維持する。

---

## 11. Per-App Risk / Priority（Phase指定フォーマット、22アプリ全件）

Risk定義（技術Riskのみ、Phase指定の3段階）:

- **LOW**: `getDetails()`（+必要ならCSV action）追加のみ。既存App-localのフラットな配列/オブジェクトをそのままlabel/value化できる。
- **MEDIUM**: shared formatter（App固有独立moduleパターン、§13）が必要、またはPrivacy境界の判断が必要、またはApp-local/Common間で記録の粒度（session単位 vs event単位）が異なり設計判断が必要。
- **HIGH**: 新規rendererの実装が必要（Rich Visualization、既存の`record-trace-renderer.js`を流用できないケース）。

| Risk | 該当アプリ |
|---|---|
| HIGH | hiragana-learn・katakana-app（新規stroke renderer必要、お手本重ね表示の扱い要決定） |
| MEDIUM | register-app（商品名privacy判断）・bosai-app（privacyLevel:high下でのlog[]公開判断、legacy guard追加）・mitsukete-touch-app・junban-miyou-app・miru-hirogaru-app（session粒度 vs event粒度の設計判断） |
| LOW-MEDIUM | nazori-app（画像表示のみだがperformance/on-demand renderの厳守が必要）・katachi-awase-app・janken-app・dotchiga-ii-app |
| LOW | sst-app（完了）・sawatte-hirogaru-app（完了）・directions-app・kurabeyou-app・tokei-app・matching-app・shiritori2・okane-app・mogura-tataki・suji-manabou |
| N/A | kyou-no-kiroku（対象外） |

---

## 12. Rollout Batch（確定）

技術依存関係・Riskの低さ・既存App-local実装の再利用しやすさを優先順位の基準にした（Contract §36推奨基準に準拠）。

### Batch A — `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-BATCH-1`

対象: `nazori-app`（最優先、rendererなしで実装可能）→ `hiragana-learn` + `katakana-app`（新規stroke renderer、同時実装が合理的——実装が完全に同一のため）。

`suji-manabou`はRich Visualization自体がNOT_APPLICABLE（§7）のため、このBatchの対象外（SUMMARY_ONLY改善のみ必要ならBatch Cで扱う）。

### Batch B — `LEARNING-RECORD-DETAIL-PARITY-BATCH-2`

対象（優先順）: `directions-app`（最単純、フラット1entry=1問）→ `kurabeyou-app`・`katachi-awase-app`（既存`appendRecordDetailToggle()`を流用）→ `janken-app`（`mistakes[]`）→ `register-app`（Privacy判断を要するため後回し）→ `bosai-app`（`privacyLevel:high`下での判断を要するため最後）。

### Batch C — `LEARNING-RECORD-SIMPLE-PARITY-BATCH-3`

対象: `okane-app`（既に最も僅差、優先）→ `tokei-app`・`shiritori2`（`metrics`追加のみで大部分解消）→ `matching-app`・`dotchiga-ii-app`・`mogura-tataki`・`suji-manabou`→ `mitsukete-touch-app`・`junban-miyou-app`・`miru-hirogaru-app`（session粒度の設計判断を要するため、Batch内でも後回し）。

### App-specific個別Phase（複雑Appの分離、Contract §56に従う）

- `register-app`・`bosai-app`は、Privacy境界の扱い（商品名/log内容の公開可否）についてUser Approvalを個別に得たうえで実装する方が安全なため、Batch B内でも単独Phase相当の慎重な扱いを推奨する。
- `hiragana-learn`/`katakana-app`の「お手本重ね表示」をCommon側にも実装するかは、Batch A実装Phase内でUserへ個別確認する（Contract §62のNon-blocking事項）。

---

## 13. Shared Formatter戦略（判定結果）

Contract §9・本Phase§40の3方式のうち、実測の結果は**既存SST/Sawatteと同型のB「App-specific shared module」が全てのB/CバッチAppに最適**と判定した。

- 理由: 各Appのfield名・意味はApp固有（`donomana-sst-record-detail-contract-v1_0.md`が定義する「App-owned Semantics」原則、Contract §7）であり、`register-app`の`items[]`と`janken-app`の`mistakes[]`を汎用formatterへ無理に統合すると、Contract §41「意味の違うfieldを無理に共通formatterへ押し込まない」に抵触する。
- 既存2実装（`assets/js/sawatte-hirogaru-record-detail.js`・`assets/js/sst-record-detail.js`）はいずれもこのパターンで、`getDetailRows()`/`summaryText()`/`buildXxxCsvRows()`という同じ関数命名規則を持つ。Batch B/C実装時もこの命名規則を踏襲することを推奨する（新規パターンの発明を避ける、Contract §39/§40）。
- Common Adapter側の`getDetails()`/`getCsvActions()`は、既存の「App-specific shared moduleを`<script src>`で読み込み、Adapter定義から呼び出す」という配線（`learning-records.html`が両App-local用JSファイルを`record-dashboard-foundation.js`より前に読み込む既存パターン）をそのまま踏襲する。

---

## 14. Privacy（横断確認）

- 表示範囲拡大は外部送信・サーバー同期・永続データ追加のいずれも伴わない（既存`donomanaRecordReadLog`等のFoundation APIはlocalStorage read-onlyのまま無変更、golden-tests.js section 16で実測済み）。
- **要判断事項**（Blocking Decisionではなく、実装Phase内でUser確認が必要な事項として記録）:
  - `register-app`の`items[].name`（商品名）はApp-local自身が既に自由入力名を表示・CSV出力している（medium privacy、既存の`registerCsvSafeCell`によるFormula Injection対策あり）。Parity Principle上はCommonでも同じ内容を出すのが原則だが、初回実装時にUserの明示確認を推奨する。
  - `bosai-app`の`log[]`内容（状況/選択/正誤/正解/解説）は今回のサブエージェント調査で「教育的内容のみで機微情報を含まない」ことを確認済み（`name`フィールドとは独立）。`name`を絶対に含めないことを実装時のテストケースとして明記する。
  - `kyou-no-kiroku`は本Auditでも`NOT_APPLICABLE`のまま維持する。既存の`includeInDefaultTimeline:false`・`privacyLevel:'high'`をこのAuditが変更することはない。

---

## 15. Test Strategy（将来Batch実装の共通方針）

- 各Batch実装は、既存の`tools/record-dashboard-poc/`配下のgolden test方式（`sawatte-common-detail-golden-tests.js`・`sst-common-detail-golden-tests.js`と同型）を新設し、対象App分のfixtureベーステストを追加する。
- 既存4スイート（golden-tests.js 816件・ui-golden-tests.js 58件・sawatte-common-detail-golden-tests.js 67件・sst-common-detail-golden-tests.js 41件）は、Batch実装のたびに継続してFAIL 0を確認する（本Audit時点で再実行し、全件PASSを確認済み、§16）。
- 各Batch完了時のDoDはContract §17（App-local/Common semantic parity・Level 2・Level 3 if applicable・legacy・CSV parity・accessibility・mobile）をそのまま適用する。

---

## 16. 既存Tests Baseline確認（本Audit開始時点で実測）

```
golden-tests.js:                816/816 PASS
ui-golden-tests.js:              58/58  PASS
sawatte-common-detail-golden-tests.js: 67/67 PASS
sst-common-detail-golden-tests.js:     41/41 PASS
```

Pre-existing FAIL: **0件**。本Auditは実装を一切行っていないため、この結果は今後のBatch実装の起点として有効。

---

## 17. Per-App Report（Phase指定フォーマット、22アプリ全件）

### sawatte-hirogaru-app
- App ID: sawatte-hirogaru-app / App Name: さわってひろがる
- Foundation: YES / Adapter: YES
- App-local Summary: YES / App-local Detail: YES / Rich Visualization: YES（tap/swipe軌跡）
- Common Summary: YES / Common Detail: YES / Common Visualization: YES
- CSV: RICH（App-local 2種・Common 2種、同一builder）
- Required Level: L3 / Current Level: L3
- Parity Gap: なし
- Legacy Risk: 低（golden test 67件で検証済み）
- Accessibility Risk: 低（text fallback既実装）
- Implementation Risk: — （完了）
- Recommended Phase: 完了
- Status: CONFORMANT_L3

### sst-app
- App ID: sst-app / App Name: SST ソーシャルスキルトレーニング
- Foundation: YES / Adapter: YES
- App-local Summary: YES / App-local Detail: YES（週次レポート、8 detail type） / Rich Visualization: NOT APPLICABLE
- Common Summary: YES / Common Detail: YES / Common Visualization: N/A
- CSV: DETAIL（8列、App-local/Common同一builder）
- Required Level: L2 / Current Level: L2
- Parity Gap: なし（App-localは週スコープ限定、Commonは全期間——既存設計として容認済み）
- Legacy Risk: 低（golden test 41件で検証済み）
- Accessibility Risk: 低
- Implementation Risk: — （完了）
- Recommended Phase: 完了
- Status: CONFORMANT_L2

### hiragana-learn
- App ID: hiragana-learn / App Name: ひらがな まなぼう！
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（canvas再生ビューア、お手本重ね表示） / Rich Visualization: YES（stroke polyline、`{version:1,coordinateSpace:'normalized-1000',strokes:[[x,y,...]]}`）
- Common Summary: YES / Common Detail: NO / Common Visualization: NO（hasMedia boolのみ）
- CSV: App-local SUMMARY（trace data含まず）/ Common: NONE（共通7列のみ）
- Required Level: L2+L3 / Current Level: L1
- Parity Gap: trace再生ビューアが丸ごと欠落。quiz/matchの簡易detailも欠落
- Legacy Risk: 低（`isValidTraceSample()`で防御済み、App-local側で確認済み）
- Accessibility Risk: 中（canvas-onlyでtext alternativeなし、Contract §12違反を引き継がないよう新規設計要）
- Implementation Risk: HIGH（新規renderer必要）
- Recommended Phase: Batch A
- Status: PARTIAL

### katakana-app
- App ID: katakana-app / App Name: カタカナ まなぼう！
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（hiragana-learnと同一実装） / Rich Visualization: YES（同上schema）
- Common Summary: YES / Common Detail: NO / Common Visualization: NO
- CSV: App-local SUMMARY / Common: NONE
- Required Level: L2+L3 / Current Level: L1
- Parity Gap: hiragana-learnと同一
- Legacy Risk: 低
- Accessibility Risk: 中（同上）
- Implementation Risk: HIGH（hiragana-learnと同時実装推奨）
- Recommended Phase: Batch A
- Status: PARTIAL

### suji-manabou
- App ID: suji-manabou / App Name: すうじ まなぼう！
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: NO / Rich Visualization: NOT APPLICABLE（trace自体を保存しない）
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local SUMMARY / Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: 僅少（App-local自体にdetailがほぼ無いため）
- Legacy Risk: 低
- Accessibility Risk: N/A
- Implementation Risk: LOW
- Recommended Phase: Batch C
- Status: SUMMARY_ONLY

### nazori-app
- App ID: nazori-app / App Name: なぞり書き練習ツール
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（履歴一覧に実PNG画像をインライン表示） / Rich Visualization: YES（base64 PNG dataURL）
- Common Summary: YES / Common Detail: NO / Common Visualization: NO（hasMedia boolのみ）
- CSV: App-local SUMMARY（image含まず）/ Common: NONE
- Required Level: L2+L3 / Current Level: L1
- Parity Gap: 画像表示が丸ごと欠落
- Legacy Risk: 低（`rec.image ? ... : ''`のfallback確認済み）
- Accessibility Risk: 低〜中（`<img>` alt textあるが簡易）
- Implementation Risk: LOW-MEDIUM（rendererは不要、`<img>`表示のみ。performance/on-demand renderを厳守すれば実装は3種の中で最も容易）
- Recommended Phase: Batch A（最優先候補）
- Status: PARTIAL

### kurabeyou-app
- App ID: kurabeyou-app / App Name: おおきい？ちいさい？くらべよう
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（`appendRecordDetailToggle()`、問題ごとの詳細展開） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（17列同等の情報量）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: per-question detail（`mistakeSelections`/`mistakeDetails`）が丸ごと欠落
- Legacy Risk: 低（明示的なgraceful degradationコメントあり）
- Accessibility Risk: 低（`aria-expanded`/`aria-controls`既実装、Common移植の直接手本になる）
- Implementation Risk: LOW（既存detail生成関数を流用可能）
- Recommended Phase: Batch B（高優先）
- Status: SUMMARY_ONLY

### katachi-awase-app
- App ID: katachi-awase-app / App Name: かたちをあわせよう
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（同一パターンの`appendRecordDetailToggle()`） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（15列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: per-question detail欠落（puzzle modeは1entry=1recordのため元々detail不要）
- Legacy Risk: 低（append-onlyのfield growthをコメントで明記済み）
- Accessibility Risk: 低（kurabeyou-appと同一パターン）
- Implementation Risk: LOW-MEDIUM
- Recommended Phase: Batch B
- Status: SUMMARY_ONLY

### directions-app
- App ID: directions-app / App Name: ほうこうとばしょをまなぼう
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（常時全件テーブル表示） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（7列、1entry=1問）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: `userAnswer`/`correctAnswer`がCommonに一切出ない
- Legacy Risk: 低
- Accessibility Risk: 低（プレーンテーブル、switch-scan対応`data-scan`属性あり）
- Implementation Risk: LOW（1entry=1問のフラット構造、集約ロジック不要、全App中最単純）
- Recommended Phase: Batch B（最優先候補）
- Status: SUMMARY_ONLY

### janken-app
- App ID: janken-app / App Name: じゃんけん まなぼう！
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（`mistakes[]`、問題ごとの選択/正解） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（まちがえた内容列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: per-question mistake detailが丸ごと欠落
- Legacy Risk: 低（`Array.isArray`guard確認済み）
- Accessibility Risk: 低（テキストdiv、実button要素）
- Implementation Risk: LOW-MEDIUM
- Recommended Phase: Batch B
- Status: SUMMARY_ONLY

### register-app
- App ID: register-app / App Name: はんばいかい レジ
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: YES（`items[]`、購入内訳） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（購入内容列、Formula Injection対策済み）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: 商品名・数量・単価・小計が丸ごと欠落
- Legacy Risk: 低
- Accessibility Risk: 低
- Implementation Risk: MEDIUM（商品名は自由入力・medium privacy、実装前にUser確認推奨）
- Recommended Phase: Batch B
- Status: SUMMARY_ONLY

### tokei-app
- App ID: tokei-app / App Name: とけい
- Foundation: YES / Adapter: YES（L1のみ、ただし`metrics`経由で`retried`/`avgTimeSec`は既にCommon表示済み）
- App-local Summary: YES / App-local Detail: NO（per-question detail自体が元々存在しない） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO（`getDetails()`は未実装だが`metrics`経由でほぼ充足） / Common Visualization: N/A
- CSV: App-local DETAIL（9列）/ Common: NONE
- Required Level: L2 / Current Level: L1（実質ほぼ充足）
- Parity Gap: 僅少
- Legacy Risk: 低
- Accessibility Risk: 低（手動focus trap実装済み）
- Implementation Risk: LOW（追加実装の価値小）
- Recommended Phase: Batch C（低優先）
- Status: SUMMARY_ONLY

### matching-app
- App ID: matching-app / App Name: マッチング
- Foundation: YES / Adapter: YES（L1のみ、`pairs`/`moves`/`durationSec`のみmetrics反映済み）
- App-local Summary: YES / App-local Detail: NO（1行要約のみ） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（オリジナルセット列含む9列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: `level`/`displayMode`/`usedCustomSet`/`playerCount`が未反映（App-local一覧の見出しバッジには出ている情報）
- Legacy Risk: 低
- Accessibility Risk: 低
- Implementation Risk: LOW
- Recommended Phase: Batch C
- Status: SUMMARY_ONLY

### shiritori2
- App ID: shiritori2 / App Name: しりとりあそび
- Foundation: YES / Adapter: YES（L1のみ、`score`/`maxStreak`/`chainLength`は既にmetrics反映済み）
- App-local Summary: YES / App-local Detail: NO（個々の単語は設計上保存しない） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO（`outcome`のみ未反映） / Common Visualization: N/A
- CSV: App-local DETAIL（けっか/スコア列含む9列）/ Common: NONE
- Required Level: L2 / Current Level: L1（実質ほぼ充足）
- Parity Gap: `outcome`のみ
- Legacy Risk: 低
- Accessibility Risk: 低
- Implementation Risk: LOW
- Recommended Phase: Batch C（低優先）
- Status: SUMMARY_ONLY

### mitsukete-touch-app
- App ID: mitsukete-touch-app / App Name: どこかな？みーつけた！
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES（セッション集約: `groupIntoSessions`/`summarizeSession`） / App-local Detail: セッション集約のみ、per-trial fieldはCSVのみ / Rich Visualization: N/A
- Common Summary: YES（生entry単位） / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（trial単位10列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: App-local＝セッション単位の集約表示、Common＝生entry単位——粒度の不一致自体が設計判断事項
- Legacy Risk: 低
- Accessibility Risk: 低
- Implementation Risk: MEDIUM（session-grouping算術の移植が必要）
- Recommended Phase: Batch B/C
- Status: SUMMARY_ONLY

### junban-miyou-app
- App ID: junban-miyou-app / App Name: じゅんばんにみよう
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES（同上パターン） / App-local Detail: セッション集約のみ / Rich Visualization: N/A
- Common Summary: YES（生entry単位） / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（9列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: mitsukete-touch-appと同型
- Legacy Risk: 低
- Accessibility Risk: 低
- Implementation Risk: MEDIUM（同上）
- Recommended Phase: Batch B/C
- Status: SUMMARY_ONLY

### miru-hirogaru-app
- App ID: miru-hirogaru-app / App Name: みるとひろがる
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES（セッション集約） / App-local Detail: セッション集約のみ / Rich Visualization: N/A
- Common Summary: YES（生entry単位） / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（8列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: 同上（session粒度 vs event粒度）
- Legacy Risk: 低（try/catch + isNaN guard確認済み）
- Accessibility Risk: 低
- Implementation Risk: LOW-MEDIUM
- Recommended Phase: Batch C
- Status: SUMMARY_ONLY

### dotchiga-ii-app
- App ID: dotchiga-ii-app / App Name: どっちがいい？
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: 一覧に4項目（時刻/活動/選択/入力方法）、category等はCSVのみ / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local DETAIL（11列）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: 小（App-local一覧自体が簡素なため）
- Legacy Risk: 低（isNaN guard確認済み）
- Accessibility Risk: 低
- Implementation Risk: LOW
- Recommended Phase: Batch C
- Status: SUMMARY_ONLY

### okane-app
- App ID: okane-app / App Name: おかねのおべんきょう
- Foundation: YES / Adapter: YES（L1のみ、ただし`e.detail`という完成済み自然文をそのままsummaryへ使用——実質最も僅差）
- App-local Summary: YES（直近50件、教員向け自然文をそのまま表示） / App-local Detail: App-local自体が既にApp-authored自然文1行（Common summaryと実質同一情報源） / Rich Visualization: N/A
- Common Summary: YES（`e.detail`をそのまま使用、高い一致度） / Common Detail: NO / Common Visualization: N/A
- CSV: App-local RICH（サマリー集計+ログ2セクション構成）/ Common: NONE
- Required Level: L2 / Current Level: L1（実質最も僅差）
- Parity Gap: アグリゲート統計ブロック（`learningRecords.*`）のみ未反映、per-record detailは既にsummaryで充足
- Legacy Risk: 低
- Accessibility Risk: 低（modal focus管理あり）
- Implementation Risk: LOW（最小工数で近似Conformant化できる候補）
- Recommended Phase: Batch C（最優先候補）
- Status: SUMMARY_ONLY

### mogura-tataki
- App ID: mogura-tataki / App Name: もぐらたたき
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES / App-local Detail: NO（画面表示は4項目のみ、`fumbles`/`combo`/`time`/`goal`/`holes`はApp-local自身も一切表示しない） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local NONE（22アプリ中唯一CSV自体が存在しない）/ Common: NONE（共通7列のみは利用可）
- Required Level: L2 / Current Level: L1
- Parity Gap: Common側の追加Gapは僅少（App-local自体が非公開のfieldのため、Parity原則上「App-localで見える情報」に該当しない）
- Legacy Risk: **中**（`score`/`rate`にfallbackなし、malformed recordで`NaN`生成の恐れ）
- Accessibility Risk: 低
- Implementation Risk: LOW
- Recommended Phase: Batch C
- Status: SUMMARY_ONLY

### bosai-app
- App ID: bosai-app / App Name: ぼうさいたんけんたい
- Foundation: YES / Adapter: YES（L1のみ）
- App-local Summary: YES（教員PINゲート） / App-local Detail: YES（`buildDetailHTML()`、状況/選択/正誤/正解/解説を問題ごとに展開） / Rich Visualization: N/A
- Common Summary: YES / Common Detail: NO / Common Visualization: N/A
- CSV: App-local RICH（動的Q列生成、Formula Injection対策済み）/ Common: NONE
- Required Level: L2 / Current Level: L1
- Parity Gap: per-question detail（`log[]`）が丸ごと欠落
- Legacy Risk: **中**（`log`への`Array.isArray`guardなし、malformedレコードでApp-local自身がthrowしうる）
- Accessibility Risk: 低（実button要素、44px touch target確保済み）
- Implementation Risk: MEDIUM（`privacyLevel:high`下での`log[]`公開判断、`name`除外の厳守、legacy guard追加が必要）
- Recommended Phase: Batch B
- Status: SUMMARY_ONLY

### kyou-no-kiroku
- App ID: kyou-no-kiroku / App Name: きょうのきろく
- Foundation: YES / Adapter: YES（`structure:'nested'`、`includeInDefaultTimeline:false`）
- App-local Summary: YES（教員PINゲート） / App-local Detail: YES（vitals/発作detail/memoをカード表示、編集モーダルあり） / Rich Visualization: N/A
- Common Summary: N/A（既定Timeline除外） / Common Detail: N/A / Common Visualization: N/A
- CSV: App-local RICH（18列、発作detail・memo含む）/ Common: N/A（既定Timeline除外のためCommon CSVにも出現しない）
- Required Level: **NOT_APPLICABLE**（Contract §2.2 Privacy例外）
- Current Level: —
- Parity Gap: なし（意図的なPrivacy境界であり、Gapとして扱わない）
- Legacy Risk: 低〜中（`formatDate()`に`isNaN`guardなし、ただしCommon非表示のため実害はApp-local限定）
- Accessibility Risk: 低
- Implementation Risk: N/A
- Recommended Phase: 対象外
- Status: NOT_APPLICABLE

---

## 18. Blocking Decisions — 解消状況

| # | 項目 | 解消箇所 |
|---|---|---|
| 1 | 全対象App数 | §4（22アプリ、Matrix参照） |
| 2 | 各App Current Level | §17（Per-App Report） |
| 3 | 各App Required Level | §17（Per-App Report） |
| 4 | Rich Visualization対象 | §7（4アプリ、3スキーマ） |
| 5 | CSV Gap | §6・§8・Matrix |
| 6 | Rollout Batch | §12 |
| 7 | Risk | §11 |
| 8 | Implementation Order | §12（Batch内優先順位） |
| 9 | Recommended Phases | §12・§17 |

**Blocking Open Decisions: 0**

---

## 19. Non-blocking Open Decisions

- 各Batch実装時の正確なCSS・ボタン配置・renderer API細部（Contract §24を継承）。
- `hiragana-learn`/`katakana-app`の「お手本重ね表示」をCommon側にも実装するか（§12で言及、Batch A実装Phase内でUser確認）。
- `register-app`商品名・`bosai-app`のlog公開可否（§14、実装Phase開始時にUser確認を推奨するのみで、本Auditの結論を妨げるBlockingではない）。

---

## 20. Definition of Done（本Audit Phase自体）

- [x] Production baseline確認（`400e08c`、drift 0）
- [x] Record対応App全件抽出（22アプリ、`generate.js`のSetと`RECORD_ADAPTERS`の完全一致を確認）
- [x] 全App監査（Common実装1154行全文読了＋App-local20本を4並行agentで実測）
- [x] Current Level確定（Matrix・§17）
- [x] Required Level確定（Matrix・§17）
- [x] Rich Visualization対象確定（4アプリ、3スキーマ、統一不可を実証）
- [x] CSV gap確定（Matrix・§6・§8）
- [x] per-app risk確定（§11）
- [x] rollout batch確定（§12）
- [x] implementation order確定（§12）
- [x] Matrix更新（`docs/records/learning-record-detail-parity-matrix.md`）
- [x] Audit doc作成（本文書）
- [x] Blocking Decisions 0（§18）
- [x] Docs only（Product変更0件、`git status`で確認）
- [x] Production unchanged（`origin/main = 400e08c`のまま、push/merge/deploy未実施）

---

## 21. Implementation Checkpoint Note（`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1`）

Batch B Pilot（§12参照）として`directions-app`をLevel 2実装した（Technical validation PASS、User Browser Review待ち、Product未commit）。

- Worktree: `for-all-children-to-learn-learning-record-directions-detail1` / Branch: `feature/learning-record-directions-detail-1`
- 実装方式: §13 Shared Formatter戦略で判定したB「App-specific shared module」パターンを採用。`assets/js/directions-record-detail.js`を新規作成し、`directions-app.html`（`exportLogCSV()`の行構築部分のみ委譲、既存出力は無変更）と`learning-records.html`（Common Adapterの`getDetails()`/`getCsvActions()`）の両方から読み込む。
- `record-dashboard-ui.js`の`ACTIVITY_LABELS`へ`dir`/`compass`/`practice`の3ラベルを追加（従来「その他の活動」にfallbackしていた既存の表示欠落を解消、副次的な改善）。
- 実App操作2パターン（クイズ・どっちかな、いずれも実際の不正解ケース）でE2E検証し、App-local「学習ログ」テーブル・Common Detail modal・両CSVが完全に一致することを実測確認した。
- 既存4スイート（816+58+67+41件）はFAIL 0のまま、新規`directions-common-detail-golden-tests.js`（27件）を追加した。
- この実装は§50で予告した**Simple L2 Reference**として、Matrix上に記録した（Matrix該当行参照）。Batch B/Cの他Simple/Detail-only App実装時、同じ「App固有shared module + getDetails()/getCsvActions()のみ追加、normalize()は無変更」というパターンをそのまま踏襲できる。

**Production Release済み**（`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-PRODUCTION-RELEASE-1`、User Browser Review PASS・User Approved後）。`directions-app`は`CONFORMANT_L2`・Simple Level 2 Production Referenceとして確定した。次のBatch B候補（kurabeyou-app・katachi-awase-app）は別Phaseとして着手する。

---

## 22. Implementation Checkpoint Note（`LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1`）

Batch B（§12参照）として`kurabeyou-app`・`katachi-awase-app`をLevel 2実装した（Technical validation PASS、User Browser Review待ち、Product未commit）。

- Worktree: `for-all-children-to-learn-learning-record-kurabeyou-katachi-detail1` / Branch: `feature/learning-record-kurabeyou-katachi-detail-1`
- 実装方式: directions-appと同じB「App-specific shared module」パターン。`assets/js/kurabeyou-record-detail.js`・`assets/js/katachi-awase-record-detail.js`をそれぞれ新規作成し、対応するApp-local HTML（`buildRecordsCsvRows()`の行構築部分のみ委譲、既存出力は無変更）と`learning-records.html`（Common Adapterの`getDetails()`/`getCsvActions()`）の両方から読み込む。
- **粒度の判断（本Phaseの新規発見）**: 両App-localの「きろく」画面はraw log entryをセッション単位（同じlevel/conceptの連続、`groupLogIntoSessions()`）へ集約して表示するが、実データはkurabeyou-appのLevel3/4が「1つの完了した問題 = 1 raw entry」、katachi-awase-appが「1つの配置したshape = 1 raw entry」（またはpuzzleは1つの完成パズル全体）であり、CSVも既にraw entry単位で出力していた。Common Detail（1 raw entry = 1 Common record card、既存の全App共通アーキテクチャ）はこのentry単位の粒度をそのまま使えば足り、App-localのセッション集約表示を再現する必要はないと判断した（情報の欠落がないため、Contract上のGapには該当しない）。
- kurabeyou-app実装中に、CSVのpure-extraction対象コードには存在しなかった新規の防御漏れ（`prompt`欠落legacyレコードで存在しない質問文を推測生成してしまう）を発見し、新規`getDetailRows()`側でのみ修正した（CSV側は既存出力をbyte-identicalに保つため無変更のまま）。
- ACTIVITY_LABELSの追加は不要だった（`concept`値の`size`/`length`/`shape`/`puzzle`はすべて既存ラベルで充足済み。`kurabeyou-app`と`katachi-awase-app`はいずれも`size`という同じactivityコード文字列を共有するが、既存の「クイズ」コード衝突と同型のnon-blocking判断を踏襲した）。
- 実App操作（kurabeyou: Level2×2+Level3、katachi: shape/size/puzzle各1件）でE2E検証し、App-local「きろく」の詳細展開テキスト・Common Detail modal・両CSVが完全に一致することを実測確認した。
- 既存5スイート（816+58+67+41+27件）はFAIL 0のまま、新規`kurabeyou-common-detail-golden-tests.js`（30件）・`katachi-awase-common-detail-golden-tests.js`（31件）を追加した。
