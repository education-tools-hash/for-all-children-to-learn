# Learning Record Detail Parity Matrix

- 根拠Contract: `docs/design-system/donomana-learning-record-cross-app-detail-contract-v1_0.md`
- Baseline checkpoint（本更新時点）: `d144a6b`（`CHANGELOG-SAME-DAY-VISUAL-GROUPING-1`、Production稼働中）
- 実測日: Phase `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`（前回実測: `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1`、`3ce7e48`時点）
- 本文書は**生きた文書**。実装（Rollout Batch）が進むたびに該当行を更新する。
- 本更新で解消したこと: `hiragana-learn`・`katakana-app`をLevel 2 + Level 3実装した（`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`、Technical validation PASS、User Browser Review待ち、Product未commit、Production Releaseは別Phase）。両AppのtraceSample schema・検証・canvas描画ロジックは実コード確認の結果byte-identicalだったため、`assets/js/kana-record-trace-renderer.js`・`assets/js/kana-record-detail.js`として1組の共有moduleで実装した（色のみApp固有: hiragana #4A6FA5 / katakana #7b68d4）。Rich Visualizationは保存済みstroke座標をそのままcanvasへ再描画する「Canvas Stroke Reference」実装で、Sawatteの座標/軌跡ベース「Interactive Trace Reference」・nazoriの`<img>`ベース「Raster Image Reference」とは意図的に別系統として扱う（3系統は統合しない）。お手本ガイド線はKanjiVG stroke path master data + TracingEngine依存のためCommon側では描画しない技術判断（保存済みstrokeの形状・本数・相対位置は保持される）。付随して、旧hiragana/katakana adapterの`hasMedia`判定が壊れた/legacyなtraceSampleでもtrueと誤判定していた既存バグ（nazoriのhasMediaバグと同種）と、`learning-records.html`の`findRawRecord()`がApp-local同士で発生しうる同一timestamp衝突時に常に最初のraw recordを誤って返す既存バグ（実機E2Eで実際に再現。hiragana/katakanaの`time`は秒を持たない分単位文字列のため特に発生しやすい）を発見・修正した（`collectRecords()`が付与する`rawIndex`によるO(1)解決へ変更、他21アプリへの挙動影響なし）。`suji-manabou`は本Phaseのスコープ外のため`makeTraceQuizAdapter()`のまま一切変更していない。

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
| hiragana-learn | ひらがな まなぼう！ | ✅ | ✅ | ✅✅（traceSampleのcanvas再生ビューア、お手本重ね表示付き） | ✅ untimed stroke（`{version:1, coordinateSpace:'normalized-1000', strokes:[[x,y,x,y,...]]}`、24点/stroke量子化、時刻情報なし） | ✅ | ✅（`getDetails()`: 文字/なぞり方(easy/standard/precise)/なぞりの記録の有無。quiz typeのこたえ/せいかいのこたえも追加、正誤自体は既存metrics経路で表示済みのため重複させず） | ✅（Canvas Stroke Reference実装、保存済みstroke座標をそのままcanvasへ再描画。ガイド線はCommon側では描画しない技術判断。専用`assets/js/kana-record-trace-renderer.js`で描画、`record-trace-renderer.js`（Sawatte専用schema）は転用せず） | ✅ / ✅（1種、`assets/js/kana-record-detail.js`共有（katakana-appと共通）、App-local/Common byte-identical） | L2+L3 | L2+L3 | **CONFORMANT_L3**（実装完了・`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`・Technical validation PASS・User Browser Review待ち・Product未commit。付随修正: `hasMedia`誤判定バグ、`findRawRecord()`同一timestamp衝突バグ（本Phaseで発見）） | LOW（実装完了、canvas描画ロジックはApp-local実装からのpure extraction） | User Review待ち → `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-PRODUCTION-RELEASE-1` |
| katakana-app | カタカナ まなぼう！ | ✅ | ✅ | ✅✅（hiragana-learnと同一実装、stroke色のみ異なる#7b68d4） | ✅ hiragana-learnとbyte-identical | ✅ | ✅（hiragana-learnと同一shared module、getDetails内容も同一） | ✅（hiragana-learnと同一shared module、strokeColorのみapp別parameterize） | ✅ / ✅（1種、hiragana-learnとshared module完全共通） | L2+L3 | L2+L3 | **CONFORMANT_L3**（実装完了・`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`・Technical validation PASS・User Browser Review待ち・Product未commit） | LOW（hiragana-learnと同一shared moduleのため追加リスクなし） | User Review待ち → `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-PRODUCTION-RELEASE-1` |
| suji-manabou | すうじ まなぼう！ | ✅ | ✅ | ❌（trace描画はライブ中のみ、保存されない） | NOT_APPLICABLE（保存データ自体が存在しない） | ✅ | ❌ | N/A | ✅ / 共通7列のみ | L2 | L1 | **SUMMARY_ONLY** | LOW | Batch C |
| nazori-app | なぞり書き練習ツール | ✅ | ✅ | ✅✅（履歴一覧に実PNG画像をインライン表示） | ✅ base64 PNG dataURL | ✅ | ✅（`getDetails()`: 画像記録の有無・枚数。mode/sessionDone/sessionTotal/durationMinは既存のactivity/metrics経路で既にCommonへ表示済みだったため重複行を追加せず） | ✅（`<img>`ベースRaster Image Reference実装、`record-trace-renderer.js`（Sawatteの座標/軌跡schema用）は転用せず新規共有module化。Detail modal内でのon-demand renderのみ、一覧prefetchなし） | ✅ / ✅（1種、`assets/js/nazori-record-detail.js`共有、App-local/Common byte-identical、画像はCSVに含めない） | L2+L3 | L2+L3 | **CONFORMANT_L3**（実装完了・`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1`・Technical validation PASS・User Browser Review待ち・Product未commit。付随修正: 旧`hasMedia: !!e.image`が'single'モードのcharImages-only recordを検知できていなかった既存バグを本Phaseで発見・修正） | LOW（`<img>`表示のみで済む、canvas演算不要） | User Review待ち → `LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-PRODUCTION-RELEASE-1` |
| kurabeyou-app | おおきい？ちいさい？くらべよう | ✅ | ✅ | ✅✅（`appendRecordDetailToggle()`、問題ごとの詳細展開） | N/A | ✅ | ✅（`getDetails()`: 問題/正解/最初の選択/最終選択/正誤/再試行回数/間違えた内容/反応時間/並べる方向/正しい順序/実際の選択順序、level別） | N/A | ✅ / ✅（1種、`assets/js/kurabeyou-record-detail.js`共有、App-local/Common byte-identical） | L2 | L2 | **CONFORMANT_L2**（実装完了・`LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1`・Technical validation PASS・User Browser Review待ち・Product未commit） | LOW（実績どおり、既存detail生成関数のロジックを1 raw entry単位へ移植） | User Review待ち → `LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-PRODUCTION-RELEASE-1` |
| katachi-awase-app | かたちをあわせよう | ✅ | ✅ | ✅✅（同一パターンの`appendRecordDetailToggle()`） | N/A | ✅ | ✅（`getDetails()`: concept別(shape/size/puzzle)、レベル/形/正しい場所/選択した場所/正誤/再試行回数/間違えた内容/反応時間/おおきさ、またはむずかしさ/パズル名/正誤/かかった時間） | N/A | ✅ / ✅（1種、`assets/js/katachi-awase-record-detail.js`共有、App-local/Common byte-identical） | L2 | L2 | **CONFORMANT_L2**（実装完了・`LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1`・Technical validation PASS・User Browser Review待ち・Product未commit） | LOW-MEDIUM（実績どおり、3 concept分岐を安全に実装） | User Review待ち → `LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-PRODUCTION-RELEASE-1` |
| directions-app | ほうこうとばしょをまなぼう | ✅ | ✅ | ✅✅（常時全件テーブル表示、問題文/回答/正解） | N/A | ✅ | ✅（`getDetails()`: 問題/回答/正解/結果） | N/A | ✅ / ✅（1種、`assets/js/directions-record-detail.js`共有、App-local/Common byte-identical） | L2 | L2 | **CONFORMANT_L2**（Production Released・`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-PRODUCTION-RELEASE-1`・User Approved） | LOW（実績: 1entry=1問のフラット構造、集約ロジック不要で最短実装。**Simple L2 Reference確定**——Batch B/Cの他Simple Appはこのパターンを参照可能） | 完了（Simple Level 2 Production Reference） |
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
- `CONFORMANT_L2`: **4アプリ**（sst-app・directions-app・kurabeyou-app・katachi-awase-app［いずれもProduction Released］）
- `CONFORMANT_L3`: **4アプリ**（sawatte-hirogaru-app［Production Released］・nazori-app・hiragana-learn・katakana-app［いずれも実装完了、User Review待ち、Product未commit——push/merge/deployされるまでは実質従来のままの状態で本番稼働している点に注意］）
- `PARTIAL`: **0アプリ**
- `SUMMARY_ONLY`: **13アプリ**
- `NOT_INTEGRATED`: **0アプリ**
- `NOT_APPLICABLE`: **1アプリ**（kyou-no-kiroku、Privacy例外）
- Rich Visualization Required（Level 3対象）: **4アプリ、全て実装完了**（sawatte-hirogaru-app［Production Released］・nazori-app［User Review待ち］・hiragana-learn［User Review待ち］・katakana-app［User Review待ち]）。3種類の異なるRich Visualizationスキーマが存在する（詳細は`docs/records/learning-record-detail-parity-audit-all-v1_0.md` §7）: Sawatte=座標/軌跡ベースの Interactive Trace Reference（timed）、nazori=保存済みraster画像をそのまま表示するRaster Image Reference、hiragana/katakana=保存済みstroke座標をcanvasへ再描画するCanvas Stroke Reference（untimed handwriting）。3系統は互いに転用不可・意図的に別実装として扱う。
- App-local CSV: **21/22アプリで存在**（`mogura-tataki`のみApp-local CSV自体が存在しない、22アプリ中唯一）
- Legacy防御コードの明確な欠落（実測で確認、別リスクとして記録）: **mogura-tataki**（NaN/fallback未実装）・**bosai-app**（`log[]`への`Array.isArray`guardなし）・**kyou-no-kiroku**（`formatDate()`に`isNaN`guardなし）
- **Simple L2 Reference（Production確定）**: `directions-app`（`LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-PRODUCTION-RELEASE-1`）— 1entry=1問のフラットschema・App固有shared module（`assets/js/directions-record-detail.js`、SST/Sawatteと同型パターン）・`getDetails()`+`getCsvActions()`の最小実装例。Batch B/Cの他Simple/Detail-only Appの実装時に参照可能。
- **Detail-toggle Reference（Production確定）**: `kurabeyou-app`・`katachi-awase-app`（`LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-PRODUCTION-RELEASE-1`）— 既存App-local`appendRecordDetailToggle()`が生成する情報量を、1 raw entry = 1 Common record cardの粒度へ移植する実装パターン。session集約UIを持つApp（App-localは複数entryをセッション表示するが、Common側は個々のentry単位で表示する）で「粒度の違いはOKで、情報の欠落がなければ十分」という判断の初適用例。
- **Raster Image Reference（実装完了、User Review待ち）**: `nazori-app`（`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-NAZORI-1`）— 保存済みraster画像（PNG dataURL）をそのまま`<img>`で表示するだけのRich Visualization実装パターン。座標/軌跡データからcanvasへ再描画するSawatteの Interactive Trace Reference（座標演算が必要）とは別系統であり、hiragana/katakana用のCanvas Stroke Referenceとも別系統（3系統は統合しない）。画像はvalidation（許可prefix・MIME限定）を通過したものだけ表示し、CSVには含めない（App-local既存CSVと同じ扱い）。
- **Canvas Stroke Reference（実装完了、User Review待ち）**: `hiragana-learn`・`katakana-app`（`LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1`）— 保存済みuntimed handwriting stroke座標（`normalized-1000`量子化、24点/stroke）をそのままcanvasへ再描画するRich Visualization実装パターン。Sawatteのtimed tap/swipe trace（Interactive Trace Reference、点ごとにelapsed msを持つ）とは意味・schemaが異なるため無理に統合しない。両App(hiragana/katakana)は実コード確認でtraceSample schema・検証・描画ロジックがbyte-identicalだったため`assets/js/kana-record-trace-renderer.js`（描画・検証）+ `assets/js/kana-record-detail.js`（Detail行・CSV）の2 shared moduleで実装（色のみApp固有）。お手本ガイド線（KanjiVG stroke path master data + TracingEngine依存）はCommon側では描画しない技術判断——保存済みstrokeの形状・本数・相対位置は保持されるため、教師がCommon側から振り返る上での実害はないと判断した。実装過程で`hasMedia`誤判定バグと、`learning-records.html`の`findRawRecord()`が同一timestamp（分単位精度のためhiragana/katakanaで特に発生しやすい）衝突時に誤ったraw recordを返す既存バグを発見・修正した（`rawIndex`ベースのO(1)解決、他21アプリへの挙動影響なし）。

## Non-blocking: 本更新で解消した事項

前回版の「17アプリ未監査」はすべて本Phaseで実コード監査を完了し、上表へ反映した。未監査欄は本文書に存在しない。
