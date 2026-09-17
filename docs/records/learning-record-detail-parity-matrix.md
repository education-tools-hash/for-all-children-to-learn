# Learning Record Detail Parity Matrix

- 根拠Contract: `docs/design-system/donomana-learning-record-cross-app-detail-contract-v1_0.md`
- Baseline checkpoint（本更新時点）: `13cfd34`（Audit checkpoint、`400e08c` + docs）
- 実測日: Phase `LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1`（前回実測: `LEARNING-RECORD-DETAIL-PARITY-AUDIT-ALL-1`、`400e08c`時点）
- 本文書は**生きた文書**。実装（Rollout Batch）が進むたびに該当行を更新する。
- 本更新で解消したこと: `LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1`（Batch B Pilot）で`directions-app`をLevel 2実装した。Technical validation完了、User Browser Review待ち（Product未commit）。`sawatte-hirogaru-app`・`sst-app`は既にProduction Release済み（`CONFORMANT_L3`/`CONFORMANT_L2`のまま変化なし）。

## 凡例

**Status語彙**（本更新でPhase指定の語彙へ統一）:

- `CONFORMANT_L2`: Level 2（Detail Parity）を満たす。Rich Visualization対象外のApp。
- `CONFORMANT_L3`: Level 2 + Level 3（Rich Visualization Parity）の両方を満たす。
- `PARTIAL`: 保存済みRich Visualizationデータ（`hasMedia:true`相当）はCommon Adapterが検知できているが、Level 2・Level 3のいずれもCommonへ反映されていない（App-localには両方存在する）。
- `SUMMARY_ONLY`: Level 1（Summary）のみ。Rich Visualizationデータ自体を持たない、またはApp-local側にもDetailがほぼない。
- `NOT_INTEGRATED`: Foundation record対応だがCommon Adapter未登録（本更新時点で該当0件）。
- `NOT_APPLICABLE`: Privacy境界により意図的にCommon既定Timelineから除外されている（`kyou-no-kiroku`のみ、Required Levelの対象外）。

**Required Level**（Cross-App Detail Contract §4.1確定ルール）: 全Foundation対応AppはLevel 2必須。保存済みRich Visualizationデータ（trace/image等）を持つAppはLevel 3も必須。`kyou-no-kiroku`はPrivacy例外（Contract §2.2）によりRequired Level対象外。

**列の実測方法**: 全22アプリについて、Common側（`record-dashboard-foundation.js`のRECORD_ADAPTERS定義を実コードで完全読了）・App-local側（各アプリHTMLの記録保存・表示・CSVコードを個別に実測）の両方を本Phaseで直接確認した実測値。推測・未確認欄は存在しない。

---

## Record Foundation対応 22アプリ

| appId | appName | Foundation | App-local Summary | App-local Detail | Rich Viz (App-local) | Common Summary | Common Detail (L2) | Common Viz (L3) | CSV (App-local / Common) | Required Level | Current Level | Status | Risk | Recommended Phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sawatte-hirogaru-app | さわってひろがる | ✅ | ✅ | ✅ | ✅ tap/swipe軌跡 | ✅ | ✅ | ✅ | ✅ / ✅（2種） | L2+L3 | L3 | **CONFORMANT_L3** | — | 完了（Reference Implementation） |
| sst-app | SST ソーシャルスキルトレーニング | ✅ | ✅ | ✅（週次レポート、8 detail type） | N/A（保存データなし） | ✅ | ✅ | N/A | ✅ / ✅（1種） | L2 | L2 | **CONFORMANT_L2** | — | 完了（Reference Implementation） |
| hiragana-learn | ひらがな まなぼう！ | ✅ | ✅ | ✅✅（traceSampleのcanvas再生ビューア、お手本重ね表示付き） | ✅ stroke point（`{version:1, coordinateSpace:'normalized-1000', strokes:[[x,y,...]]}`） | ✅ | ❌ | ❌（hasMedia bool のみ） | ✅ / 共通7列のみ | L2+L3 | L1 | **PARTIAL** | HIGH（新規renderer必要、お手本重ね表示の扱い要決定） | Batch A |
| katakana-app | カタカナ まなぼう！ | ✅ | ✅ | ✅✅（hiragana-learnと同一実装） | ✅ 同上 | ✅ | ❌ | ❌ | ✅ / 共通7列のみ | L2+L3 | L1 | **PARTIAL** | HIGH（hiragana-learnと同時実装が合理的） | Batch A |
| suji-manabou | すうじ まなぼう！ | ✅ | ✅ | ❌（trace描画はライブ中のみ、保存されない） | NOT_APPLICABLE（保存データ自体が存在しない） | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW | Batch C |
| nazori-app | なぞり書き練習ツール | ✅ | ✅ | ✅✅（履歴一覧に実PNG画像をインライン表示） | ✅ base64 PNG dataURL | ✅ | ❌ | ❌（hasMedia bool のみ） | ✅ / 共通7列のみ | L2+L3 | L1 | **PARTIAL** | LOW-MEDIUM（`<img>`表示のみで済む、canvas演算不要。一覧prefetch厳禁を要順守） | Batch A（最優先候補） |
| kurabeyou-app | おおきい？ちいさい？くらべよう | ✅ | ✅ | ✅✅（`appendRecordDetailToggle()`、問題ごとの詳細展開） | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW（既存detail生成関数を流用可能） | Batch B（高優先） |
| katachi-awase-app | かたちをあわせよう | ✅ | ✅ | ✅✅（同一パターンの`appendRecordDetailToggle()`） | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW-MEDIUM | Batch B |
| directions-app | ほうこうとばしょをまなぼう | ✅ | ✅ | ✅✅（常時全件テーブル表示、問題文/回答/正解） | N/A | ✅ | ✅（`getDetails()`: 問題/回答/正解/結果） | N/A | ✅ / ✅（1種、`assets/js/directions-record-detail.js`共有、App-local/Common byte-identical） | L2 | L2 | **CONFORMANT_L2**（実装完了・`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1`・Technical validation PASS・User Browser Review待ち・Product未commit） | LOW（実績: 1entry=1問のフラット構造、集約ロジック不要で最短実装。**Simple L2 Reference候補**——Batch B/Cの他Simple Appはこのパターンを参照可能） | User Review待ち → `LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-PRODUCTION-RELEASE-1` |
| janken-app | じゃんけん まなぼう！ | ✅ | ✅ | ✅（`mistakes[]`、問題ごとの選択/正解） | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW-MEDIUM | Batch B |
| register-app | はんばいかい レジ | ✅ | ✅ | ✅（`items[]`、購入内訳） | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | MEDIUM（商品名は自由入力・medium privacy、既存CSVエスケープ実装を踏襲すれば解消可） | Batch B |
| bosai-app | ぼうさいたんけんたい | ✅ | ✅（教員PINゲート） | ✅✅（`buildDetailHTML()`、状況/選択/正誤/正解/解説を問題ごとに展開） | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | MEDIUM（`name`除外を厳守。`log[]`自体はレガシー未防御=`Array.isArray`guard無し、実装時に追加要） | Batch B |
| mitsukete-touch-app | どこかな？みーつけた！ | ✅ | ✅（セッション集約: `groupIntoSessions`/`summarizeSession`） | ⚠️セッション集約のみ、per-trial fieldはCSVのみ | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | MEDIUM（Common側は生entry単位、App-local側はセッション単位——粒度の不一致自体が要設計判断） | Batch B/C |
| junban-miyou-app | じゅんばんにみよう | ✅ | ✅（同上パターン） | ⚠️同上 | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | MEDIUM（同上） | Batch B/C |
| miru-hirogaru-app | みるとひろがる | ✅ | ✅（セッション集約） | ⚠️同上パターン | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW-MEDIUM | Batch C |
| dotchiga-ii-app | どっちがいい？ | ✅ | ✅ | ⚠️一覧に4項目（時刻/活動/選択/入力方法）、category等はCSVのみ | N/A | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW | Batch C |
| tokei-app | とけい | ✅ | ✅ | ❌（1行要約のみ、per-question detailは元々存在しない） | N/A | ✅（`retried`/`avgTimeSec`は既に`metrics`経由でCommon表示済み） | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1（実質ほぼ充足） | **SUMMARY_ONLY** | LOW（追加実装の価値小） | Batch C（低優先） |
| matching-app | マッチング | ✅ | ✅ | ❌（1行要約のみ） | N/A | ✅（pairs/moves/durationSecのみ、level/displayMode/usedCustomSet/playerCountは未反映） | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW | Batch C |
| shiritori2 | しりとりあそび | ✅ | ✅ | ❌（1行要約のみ、個々の単語は設計上保存しない） | N/A | ✅（score/maxStreak/chainLengthは既に`metrics`経由でCommon表示済み、`outcome`のみ未反映） | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1（実質ほぼ充足） | **SUMMARY_ONLY** | LOW | Batch C（低優先） |
| okane-app | おかねのおべんきょう | ✅ | ✅（直近50件、教員向け自然文をそのまま表示） | ⚠️App-local自体が既にApp-authored自然文1行（Common summaryと実質同一情報源） | N/A | ✅（`e.detail`をそのままsummaryへ使用、既に高い一致度） | ❌ | N/A | ✅（2セクション構成） / 共通7列のみ | L2 | L1（実質最も僅差） | **SUMMARY_ONLY** | LOW（最小工数で近似Conformant化できる候補） | Batch C（最優先候補） |
| mogura-tataki | もぐらたたき | ✅ | ✅ | ❌（画面表示は4項目のみ、`fumbles`/`combo`/`time`/`goal`/`holes`はApp-local自身も一切表示しない） | N/A | ✅ | ❌ | N/A | ❌（App-local CSV自体が存在しない、22アプリ中唯一） / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW（Common側の追加Gapは僅少。ただしlegacy防御コードなし=別リスク） | Batch C |
| kyou-no-kiroku | きょうのきろく | ✅ | ✅（教員PINゲート） | ✅✅（vitals/発作detail/memoをカード表示、編集モーダルあり） | N/A | ✅（`includeInDefaultTimeline:false`、既定Timelineから意図的除外） | N/A | N/A | ✅ / N/A（既定Timeline除外のためCommon CSVにも出現しない） | **NOT_APPLICABLE**（Privacy例外、Contract §2.2） | — | **NOT_APPLICABLE** | — | 対象外（既存Privacy設計を維持） |

---

## 集計

- Record Foundation対応: **22アプリ**
- Common Adapter登録済み: **22アプリ**（前回未登録だった`sawatte-hirogaru-app`を含め全件登録済み）
- `CONFORMANT_L2`: **2アプリ**（sst-app［Production］・directions-app［実装完了、User Review待ち、Product未commit——push/merge/deployされるまでは実質SUMMARY_ONLYのまま本番稼働している点に注意］）
- `CONFORMANT_L3`: **1アプリ**（sawatte-hirogaru-app）
- `PARTIAL`: **3アプリ**（hiragana-learn・katakana-app・nazori-app、いずれもhasMedia:true相当を持つがCommon側Level2/3が未実装）
- `SUMMARY_ONLY`: **15アプリ**（Production上はdirections-appも含めるとまだ16アプリ相当）
- `NOT_INTEGRATED`: **0アプリ**
- `NOT_APPLICABLE`: **1アプリ**（kyou-no-kiroku、Privacy例外）
- Rich Visualization Required（Level 3対象）: **4アプリ**（sawatte-hirogaru-app［完了］・hiragana-learn・katakana-app・nazori-app）。3種類の異なるRich Visualizationスキーマが存在する（詳細は`docs/records/learning-record-detail-parity-audit-all-v1_0.md` §7）ため、`record-trace-renderer.js`（sawatte専用schema）を他3アプリへそのまま流用することはできない。
- App-local CSV: **21/22アプリで存在**（`mogura-tataki`のみApp-local CSV自体が存在しない、22アプリ中唯一）
- Legacy防御コードの明確な欠落（実測で確認、別リスクとして記録）: **mogura-tataki**（NaN/fallback未実装）・**bosai-app**（`log[]`への`Array.isArray`guardなし）・**kyou-no-kiroku**（`formatDate()`に`isNaN`guardなし）
- **Simple L2 Reference**: `directions-app`（`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1`）— 1entry=1問のフラットschema・App固有shared module（`assets/js/directions-record-detail.js`、SST/Sawatteと同型パターン）・`getDetails()`+`getCsvActions()`の最小実装例。Batch B/Cの他Simple/Detail-only Appの実装時に参照可能。

## Non-blocking: 本更新で解消した事項

前回版の「17アプリ未監査」はすべて本Phaseで実コード監査を完了し、上表へ反映した。未監査欄は本文書に存在しない。
