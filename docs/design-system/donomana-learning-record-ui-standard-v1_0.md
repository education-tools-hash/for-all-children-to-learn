# どのまな Learning Record UI Standard（Version 1.0 Draft/RC）

- 版: v1.0 Draft/RC
- 発行: 2026年8月（Phase T5-D）
- 位置づけ: `donomana-learning-record-standard-v1_0.md`（Data Standard: Core Schema・Storage・Foundation API）の**上位方針を継承する、表示・操作（UI）専用の補足文書**。Data Standardを置き換えるものではない。Switch Scan共通仕様（`donomana-switch-scan-spec-v1_0.md`）の「helper=lifecycle、adapter=content」という責務分離の考え方をLearning Record Viewerへも適用する。
- 根拠調査: Phase T5-D、4 Pilot（miru-hirogaru-app・hiragana-learn・directions-app・kyou-no-kiroku）の既存Viewer実装の横断比較
- 承認状態: Draft/RC。4 Pilotのみ検証済み。全17 Learning Record実装アプリ・全35アプリへの展開は未実施。

---

## 1. 目的

Learning Record Foundationを「記録を保存する共通基盤」から「教員・支援者が安全かつ分かりやすく確認・出力・削除できる共通利用基盤」へ発展させる。単なるJSON dumpを禁止し、専門用語（`schemaVersion`・`payload`・`localStorage`等）を利用者向け画面に出さない。

---

## 2. Viewer Inventory（4 Pilot、実装から確認）

| 観点 | miru-hirogaru-app | hiragana-learn | directions-app | kyou-no-kiroku |
|---|---|---|---|---|
| 開き方 | 設定パネル内（`openSettings()`） | タブ切替（`record`セクション） | 画面遷移（`.screen`） | 画面遷移（`screenRecords`） |
| layout | セッション単位カード | サマリー統計＋詳細ログ一覧 | テーブル（列固定） | 個別recordカード |
| 日付表示 | `M/D HH:MM` | `time`文字列そのまま | `tsLocal`文字列そのまま | `formatDate()`（`YYYY/MM/DD HH:MM`） |
| grouping | **セッション単位**（5分ギャップ＋level変化で分割、独自実装） | なし（全件フラット表示） | なし（フィルタのみ） | なし（子ども別・日付別フィルタあり） |
| 表示field | レベル・活動時間・反応回数・主な入力（日本語ラベル変換済み） | 種類アイコン＋かな＋結果 | 日時・カテゴリ・問題・回答・結果 | 気持ち・体温・脈拍・SpO2等（教材固有） |
| 件数表示 | 「もっと見る」pagination付き（初期5件） | 全件表示（pagination無し） | 全件表示（pagination無し） | 全件表示（pagination無し） |
| empty state | あり（`recordsEmpty`） | あり（テキストのみ） | あり（`empty-msg`） | あり（テキストのみ） |
| CSV | あり、BOM+escape手動実装 | あり、BOM+escape手動実装 | あり、BOM+escape手動実装 | あり、BOM+escape手動実装 |
| delete | 確認/キャンセルUI付き全削除（`recordsConfirm`） | **確認なし1クリック全削除**（T5-D以前） | `confirm()`付き全削除 | 確認/キャンセルUI付き全削除＋個別record削除 |
| close/navigation | 設定パネルを閉じるボタン、Escape対応 | タブ切替 | 「もどる」ボタン | nav-btn切替 |
| keyboard accessibility | native button、tabindex管理済み | native button、`tabindex="0"`明示 | native button | native button |
| Switch Scan | 実装済み、`refreshSwitchScanItems()`が設定パネル開閉・もっと見るクリックで呼ばれる | 実装済み（`[tabindex="0"]`包括方式）、record tabのCSV/削除ボタンは元から`tabindex="0"`で候補に含まれていた | 実装済み（Strategy A: `data-scan`明示marker）だが**log画面のフィルタ/CSV/削除ボタンにmarker欠落**（T5-D以前） | 実装済み（Strategy C: `.btn`等のclass列挙）、record画面のボタンは`.btn`class経由で既に候補に含まれる |
| screen reader | `aria-live="polite"`の`recordsStatus`あり | 個別のARIA属性なし | 個別のARIA属性なし | 個別のARIA属性なし |
| mobile | native button、min-height 44px相当のCSS | native button | native button | native button |

**既存Viewerは先に捨てていない。** 4本ともDOM構造・CSS・関数名を維持したまま、後述のUI Foundation helperを追加的に呼び出す形で統合した。

---

## 3. Common Viewer Goal

教員・支援者が「いつ・どの教材で・何に取り組んだか・どのように参加したか」を簡潔に確認できることを目標とする。JSON dumpや技術fieldの直接表示は禁止する。

---

## 4. Common vs App-specific Boundary（Core + App-specific Detail）

Switch Scan共通仕様16.3節の「helperはlifecycle、adapterはcontent」という責務分離を、Viewerにも適用する。

**Common（UI Foundation、5章）**: 日時整形、日付グルーピング、inputMethod・tracingJudgmentLevelの日本語ラベル変換。

**App-specific（各アプリの既存実装のまま）**: 「『あ』のなぞり」「右を選択 — 正解」等の人間向け要約文、教材固有フィールド（kana・question・selected・score・level・kimochi等）の表示ロジック。

**結論（T5-D調査から確定）**: 実装fieldに存在しない内容を推測しないという制約（9章）がある以上、要約文そのものを共通化することは原理的に不可能である。4 Pilotの要約文は語彙・文型が教材ごとに大きく異なり（「なぞり」「クイズ回答」「注視」「気持ち記録」）、無理に共通テンプレートへ押し込めると`donomana-learning-record-standard-v1_0.md` §7の「app-specific fieldの意味を教材ごとに異なる名前で良い」という既存原則と衝突する。したがって**Common Viewerは存在しない（作らない）。Common Viewer Architectureは「UI Foundation（表示整形helper）＋各アプリの既存Viewer（adapter）」という構成に確定する**（6章）。

---

## 5. Viewer Architecture

| 選択肢 | 内容 | 判断 |
|---|---|---|
| A. 各アプリ内へ同一Viewer UIを注入 | 全アプリへ同じHTML/CSSのViewerを強制する | 不採用。既存4 Viewerのlayout差異（テーブル型・カード型・統計型）は教材の性質を反映した合理的な差異であり、破壊するコストに見合う便益がない |
| **B. Shared Viewer helper + 各アプリadapter** | 表示整形・grouping等の純粋関数のみ共有し、DOM構築は各アプリに残す | **採用**。Switch Scan共通仕様と同じ設計原則、既存4 Viewerを破壊しない、巨大SPA化・ビルドpipeline追加を回避できる |
| C. 独立したrecord-viewer.html | 単独の共通閲覧ページを新設 | 不採用。本リポジトリは静的サイト+`generate.js`構成であり、別ページ遷移は「1操作=1record」等の既存UXから利用者を切り離す。将来複数アプリ横断のダッシュボードが必要になった場合の候補として保持するに留める |
| D. Hybrid | AとBの併用 | 不採用（Bのみで4 Pilotの要件を満たせたため、複雑化を避けた） |

採用方式Bにより、`generate.js`の`buildLearningRecordFoundationJSHTML()`へ**UI Foundation**（Data Foundationとは別の4関数）を追加した（6章）。

---

## 6. UI Foundation API（新規4関数）

Data Foundation（9関数：read/write/add/clear/normalize/create/buildCsv/readNestedCollection/writeNestedCollection）とは責務を分離し、以下をFoundationスクリプトブロックへ追加した。いずれもDOM操作を行わない純粋関数である。

```js
donomanaRecordFormatDateTime(timeValue)        // → "M/D HH:MM"。ISO/ja-JPロケール文字列/epoch ms全対応。解析不能時は元の値をそのまま返す
donomanaRecordGroupByDate(entries, getTimeFn)  // → [{dateLabel, entries}]。「きょう」「きのう」「M/D」「日付不明」の4種ラベル
donomanaRecordFormatInputMethod(inputMethod)   // → 日本語ラベル or null（推測禁止、未知値はnull）
donomanaRecordFormatTracingLevel(level)        // → 「やさしく/ひょうじゅん/ていねいに」or null（legacy record対応）
```

既存の9関数は無変更。新規4関数は4 Pilot全てへ純粋な追加として伝播した（`git diff`で確認、既存app固有コードへの影響ゼロ）。

---

## 7. 日付/セッション Grouping

miru-hirogaru-appの既存`groupIntoSessions()`（5分ギャップ＋レベル変化での分割）はMulti-Input教材特有の設計であり、汎用化しなかった（教材によって「セッション」の定義が異なりうるため）。

代わりに`donomanaRecordGroupByDate()`を**日付単位**の最小限grouping標準として採用した（「きょう」「きのう」「M/D」の3階層、日付→record の2階層構造。record→session→dateのような細かすぎる階層は「読みづらいUIを禁止」の方針により不採用）。

---

## 8. Record Summary

各アプリの既存要約文（4章参照）をそのまま維持した。共通テンプレートは作らない。新規要約文の追加提案も、実装fieldに存在しない内容を推測しないという制約から、本Phaseでは行っていない。

---

## 9. Tracing Judgment Level Display（実装済み）

hiragana-learnの詳細ログ（`updateRecordView()`）で、`tracingJudgmentLevel`が存在するtrace recordについて`donomanaRecordFormatTracingLevel()`でラベル表示するよう変更した。legacy record（フィールド欠落）はnullが返るため、表示に何も追記されない（表示崩れなし）。katakana-appの記録タブは今回変更していない（同様のUIを持つ場合はT5-E以降の展開候補とする）。

---

## 10. inputMethod Display

`donomanaRecordFormatInputMethod()`を新設したが、**miru-hirogaru-appの既存表示（`INPUT_METHOD_LABEL`、`click`→「タッチ」）は変更していない**。理由: 既存Production表示テキストを無断で変更しない、という既定方針（`click`→「クリック」という一般的なマッピングとの差異はUI文言変更であり、User承認なしに実施しない）。新規4関数は今後input Methodを新たに表示する教材向けの標準として提供する。hiragana-learn・directions-app・kyou-no-kirokuはいずれも`inputMethod`フィールド自体を持たない（推測禁止の既存方針）ため、本関数の適用対象は現時点でどのPilotにも該当しない。

---

## 11. Learner Display（kyou-no-kiroku）

T5-C'で導入したstable `childId`をfilter dropdownの値として使用する実装を継続する（`childIndex`のidentity再導入は行っていない）。

**「削除済みの利用者」等のneutral fallback文言は実装しなかった。** 理由: kyou-no-kirokuのrecordは元々`childName`スナップショット（保存時点の名前の文字列コピー）を表示に使っており、これは学習者が削除された後もそのまま正しく表示され続ける（T5-C'で確認済み、本Phaseでも実ブラウザで再確認）。したがって「不明な利用者」のような追加のfallback表示は不要と判断した。filter dropdown自体は現存する学習者のみを選択肢として提示するため、削除済み学習者のrecordを別の学習者へ誤って紐付けて表示することはない（T5-C'で修正済み、本Phaseで回帰なきことを確認）。

---

## 12. Common CSV Standard

最低限の標準として以下を定義する。

- **UTF-8 BOM付き**（`﻿`）
- カンマ・改行・ダブルクォートを含むセルは`"..."`でエスケープ
- timestampは人間可読形式（ISO生値をそのまま出さない）
- app-specific fieldは列として自由に追加してよい。**全アプリを16列等へ無理に固定しない**

Data Foundationの`donomanaRecordBuildCsv(rows)`（T5-B、既存）がこの標準を満たす実装として既に存在する。ただし4 Pilotとも独自にBOM+escapeを手書きしており（結果は標準と実質同一）、**本Phaseでは既存CSVコードを`donomanaRecordBuildCsv()`呼び出しへ書き換えていない**（「既存CSVを壊さない」を最優先し、動作実績のあるコードへの無用な変更を避けた）。新規アプリでは`donomanaRecordBuildCsv()`を直接呼ぶことを推奨する（T5-E候補）。

---

## 13. Existing CSV Compatibility

4 Pilotの既存CSV出力コード（`downloadCSV()`・`exportLogCSV()`・`downloadRecordsCsv()`・`exportCSV()`）はいずれも無変更。実ブラウザでdirections-app・kyou-no-kirokuのCSVダウンロードトリガーに例外が発生しないことを確認した（T5-C・T5-C'・T5-Dで反復確認）。

---

## 14. CSV Privacy

CSVは端末内recordをファイルとして書き出す明示的なUser操作（ボタンクリック）でのみ生成される。エクスポート前後で大げさな警告文言は追加していない（既存UIに戻るボタン等、通常の操作フローのまま）。個人端末外へ持ち出せるデータである点は、既存のPrivacy文書（`donomana-learning-record-standard-v1_0.md` §3）で既に明示されている。

---

## 15. Delete Inventory / Delete Standard

| 種別 | 該当Pilot |
|---|---|
| single record delete | kyou-no-kirokuのみ（`confirmDeleteRecord()`） |
| all records clear | 4 Pilot全て |
| learner delete | kyou-no-kirokuのみ（`deleteChild()`、record削除は伴わない） |
| content delete（作品等） | 対象外（Learning Recordではない） |

**「すべての記録を削除」導線はREQUIRED候補として4 Pilot全てで既に満たされている。** ただし**hiragana-learnの`clearRecord()`は本Phase以前、確認なしの即時1クリック全削除だった**（Delete Standard「即時1クリック全削除は禁止候補」に抵触）。本Phaseで`confirm()`による確認/キャンセルを追加した（既存directions-appの`confirm()`パターンと同一方式）。miru-hirogaru-app・directions-app・kyou-no-kirokuは元々confirmation/cancel機構を備えており、変更していない。

**single record delete（個別record削除）を全アプリ共通REQUIREDにするかどうか**: 本Phaseでは必須化しない。kyou-no-kirokuのような日々の記録を個別編集・削除する必要が高い教材（バイタル記録等）では有用だが、hiragana-learn・directions-appのような大量の定型記録（なぞり・クイズ回答）では、全削除のみで教員のニーズを十分満たしていると判断した（実装コストとUI複雑化に見合う便益が4 Pilot全てで確認できたわけではない）。

---

## 16. Learner Delete Semantics — 推奨（未実装のUX変更）

| 選択肢 | 内容 |
|---|---|
| A. learnerだけ削除、records残す | **現状（T5-C'で確定・維持）** |
| B. learner + records削除 | 不採用候補 |
| C. 削除時に選択 | 将来候補 |
| D. learnerをarchive扱い | 将来候補 |

**推奨: 現状のA（learnerのみ削除、recordsは保持）を維持する。** 理由: 教員・支援者が記録の消去を意図せず学習者情報のみを整理したい場面（表記ゆれの修正、重複登録の整理等）を想定すると、record自動削除は取り消せない情報損失のリスクが高い。ただし将来的にはC（削除時にUserへ選択させる）がより丁寧なUXである可能性があり、**Production挙動の変更はUser Approvalなしに行わない**（既存方針を維持、本Phaseでは実装しない）。

---

## 17. Retention Policy — 推奨

既存実績: directions-app `MAX_LOGS=500`、sst-app 30日、その他は無制限。

**RECOMMENDED（app-specific判断に委ねる、hard REQUIREDにしない）とする。** 理由: 全アプリへ500件固定等の一律上限を課すと、利用頻度・記録粒度が大きく異なる教材（例: hiragana-learnの高頻度なぞり記録 vs kyou-no-kirokuの1日1件程度のバイタル記録）に対して不適切な足切りになりうる。教材の性質に応じてapp側で判断することを推奨する。

---

## 18. Storage Capacity UX / Performance

`donomanaRecordGroupByDate()`について、1000件のsynthetic recordでの処理時間を自動テストで実測した（Node.js、`Date.now()`計測）。結果は200ms未満（実測環境で数ms〜十数ms程度）であり、grouping自体はボトルネックにならないことを確認した。

**全件DOM renderの性能は今回コード変更していない**（4 Pilotとも全件レンダリング方式のまま。miru-hirogaru-appのみ既存の「もっと見る」pagination実装を持つ）。100/500/1000件規模でのDOM render自体の実測・pagination導入は、既存Viewerの表示ロジックへの変更を伴うため本Phaseのスコープ外とし、T5-E候補として記録する（過剰設計を避けるため、実際に性能問題が報告された教材から優先対応する）。

---

## 19. Accessibility — Keyboard / Screen Reader / Touch

4 Pilotとも既存実装がnative buttonベースであり、div onclick等の非semantic要素は確認されなかった（2章のInventory参照）。miru-hirogaru-appのみ`aria-live="polite"`のstatus領域を持つ。他3 Pilotへの追加は本Phaseで実装せず、T5-E候補として記録する（Common Viewerを新設しない方針のため、既存構造への個別追加は各アプリのコンテキストを踏まえた判断が必要）。

Touch target sizeは4 Pilotとも既存の共通ボタンスタイル（44px相当）を踏襲しており、小さすぎるdelete iconは確認されなかった。

---

## 20. Accessibility — Switch Scan Pilot（実装済み）

4 Pilot全てが独自にSwitch Scanを実装済みであることを確認した（2章）。うち**directions-appの記録（log）画面のフィルタボタン6個・CSV書き出しボタン・ログ削除ボタンの計8個が、同アプリで一貫して使われているStrategy A（`data-scan`明示marker、119箇所で使用）から漏れていた**ことを発見した。他の画面のボタンは全て`data-scan`を持つ中、この画面だけ欠落していた。

**修正内容**: 該当8ボタンへ`data-scan`属性を追加した（既存の119箇所と全く同じパターン）。`buildScanItems()`のロジック自体は変更していない。実ブラウザで、修正後は`buildScanItems(activeScreen)`の返り値にCSV/削除ボタンが含まれることを確認した。

miru-hirogaru-app（native tabindex方式）・hiragana-learn（`[tabindex="0"]`包括方式）・kyou-no-kiroku（`.btn`class包括方式）の記録関連ボタンは、いずれも元から自アプリのSwitch Scan候補取得ロジックに含まれていることを確認した（追加のmarker付与は不要だった）。

---

## 21. Badge Semantics

T5-Cで提示した定義（「📊 きろく機能あり」＝永続的なLearning/Activity Recordを後から確認できる、Communication History・Session onlyは含めない）を正式候補として維持する。**Production badgeの一括変更は本Phaseでも行っていない。**

---

## 22. gaze-keyboard Boundary

T5-C/T5-C'の分類（Communication History、Learning Record Viewerへ統合しない）を維持した。コード変更は行っていない。`gaze_history_*`/`gaze_stats_*`のprofile delete orphan問題は、引き続き別technical debtとして文書化のみに留める（T5-E前の小Phase候補）。

---

## 23. Privacy

本Phaseで追加したUI Foundation 4関数はいずれも純粋関数（DOM非依存、localStorage非依存）であり、新しいnetwork endpointは一切追加していない。既存のPrivacy境界（端末内recordのみ、外部送信なし、GA送信なし、CSV exportは明示的User操作のみ）に変更はない。

---

## 24. Automated Tests

UI Foundation 4関数について、Node.js harness（`generate.js`から`buildLearningRecordFoundationJSHTML()`を実コードとして動的抽出）で**31件全てPASS**した。

内訳: `formatDateTime`（ISO/ja-JPロケール文字列/epoch ms/不正値/null/undefined/Dateオブジェクトの7ケース）、`formatInputMethod`（5つの既知値・null・未知値の7ケース）、`formatTracingLevel`（3レベル・欠落・未知値の5ケース）、`groupByDate`（きょう/きのう/日付別/日付不明の分類・group内新しい順ソート・カスタム`getTimeFn`・空配列・null入力・1000件パフォーマンス〈200ms未満で実測クリア〉の12ケース）。

T5-C'のComposite Storage Adapter自動テスト36件も本Phase後に再実行し、全件PASSを再確認した（回帰なし）。

---

## 25. Real Browser

4 Pilotを実ブラウザで検証した。

- **hiragana-learn**: UI Foundation 4関数の存在確認、`tracingJudgmentLevel`付きtrace recordでラベル（「やさしく」等）が表示されること、legacy record（フィールド欠落）でも表示が壊れないことを確認。`clearRecord()`が`confirm()`でキャンセル時は記録を保持し、確認時のみ削除することを確認（before/afterの記録件数を実測）。Tracing Judgment Level回帰（`currentTracingLevel === 'standard'`）を再確認。
- **directions-app**: 修正した8ボタン全てに`data-scan`属性が付与されていること、`buildScanItems(activeScreen)`の返り値にCSV/削除ボタンが実際に含まれることを確認。
- **kyou-no-kiroku**: UI Foundation関数・Composite Storage Adapter関数の存在確認。T5-C'のA/B/C学習者削除再現テスト（フィルタの誤帰属なし）を本Phaseの変更後も再実行し、全ステップPASSを確認（children/photo/options/a11y保持、reload永続化、CSV export例外なし含む）。
- **miru-hirogaru-app**: Foundation関数（Data・UI双方）の存在確認、既存動作に変更がないことを確認。
- 4 Pilotとも **console error = 0、page error = 0**。

---

## 26. Tracing Regression

hiragana-learn/katakana-appのTracing Judgment Level（easy/standard/precise、default=standard、Reset=standard）を実ブラウザで再確認した。`tools/tracing-poc/engine.js`・`engine-katakana.js`・`hiragana-learn.html`・`katakana-app.html`のTracing Judgment実装部分に本Phaseの差分は一切ない（`git diff`で確認）。公式Golden Test 4種（93/93・full46全PASS・independent46両文字体系ALL CLEAN）を再実行し、全て回帰ゼロを確認した。

---

## 27. Composite Storage Regression

kyou-no-kirokuのComposite Storage（children/photo/options/a11y/unknown property/learner IDs/childId records）について、T5-C'の自動テスト36件を本Phase後に再実行し、全件PASSを再確認した。実ブラウザでのA/B/C学習者削除再現テストも再実行し、Viewer/Delete関連の変更（本Phaseでは行っていない）がComposite Storageへ影響しないことを確認した。

---

## 28. T5-E Proposal（全17 Learning Record実装アプリへの段階Rollout）

T5-Aで確認した全17アプリ（分類B・C・C+D・D）のうち、Foundation未導入の13アプリへの展開優先順位候補:

1. **badge=trueだがSession only**: `bosai-app`（badge表示と実装の乖離が大きく、優先的に整理すべき）
2. **badge=falseだがpersistent**: `okane-app`・`sst-app`・`mogura-tataki`（永続記録があるのにbadge非表示という利用者への実害が明確）
3. **旧世代record群**: `katakana-app`・`suji-manabou`（hiragana-learnと同型のschemaであり、横展開コストが低いと見込まれる）
4. **残り**: `kurabeyou-app`・`katachi-awase-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`（miru-hirogaru-appと同型のMulti-Input Foundation、統合コストが低いと見込まれる）

**ただし優先順位の最終決定は、各アプリの個別実測結果（既存schema・record規模・Switch Scan実装状況）を確認した上で行う。** 本Phaseでは提案のみとし、実装は行っていない。

Badge Accuracy Reconciliation（21章）の一括修正、共通CSV Standardへの既存コード移行（12章）、Accessibility(19章)の残課題も、T5-E以降の候補として保持する。

---

## 29. CSV Date/Time Presentation（Phase T5-E-A'で確定）

User Browser Reviewで、Learning Record CSVをMicrosoft Excelで開くと「日時」列が`#######`表示になる不具合が報告された。画像上の日本語文字列は正常表示のため、文字コード/BOMの文字化けではなく、Excelが日時文字列を日付/時刻値として自動認識し、CSVには列幅情報を保存できないため既定列幅（実測 約8.08文字幅）に収まらないことが原因と確認した。

### 29.1 CSVの構造的limitation

CSV形式そのものには列幅・セル書式・日付表示形式を保存する仕組みが存在しない。したがって「CSV側でA列の幅を広げる」方式では解決できない。解決は常にCSVの**内容（テキスト表現）側**で行う必要がある。

### 29.2 内部timestampは無変更

Learning Record内部（`localStorage`保存値）は引き続きISO 8601またはlegacy timestamp文字列のまま保持する。本Phaseでは以下を一切行っていない。

- localStorage既存データの書き換え
- timestamp migration
- legacy recordの一括migration

変更したのはCSV出力（presentation）専用の新設helper `donomanaRecordFormatCsvDateTime(timeValue)` と、各アプリのCSV builder内での呼び出し箇所のみである。

### 29.3 日付・時刻の2列分離

「日時」1列を「日付」列・「時刻」列の2列へ分離した。他のapp-specific列（種類・もじ・こたえ・レベル・対象・入力方法・子どもの名前 等）は無変更のまま維持し、全アプリを同一列構成へ無理に統一していない。

### 29.4 採用format（実Excel検証により確定。ハイフン区切りでは不十分）

`donomanaRecordFormatCsvDateTime(timeValue)`は次を返す純粋関数（DOM非依存）:

```js
{ date: "2026.08.30", time: "08:41:32" }
```

**日付はドット区切り（`YYYY.MM.DD`）、時刻はコロン区切り（`HH:mm:ss`）を採用する。** 当初はISO風のハイフン区切り（`YYYY-MM-DD`）を第一候補として実装したが、実Microsoft Excel（COM自動化による実機検証、`Workbooks.Open`でCSVを直接開く経路）で以下を確認し、**ハイフン区切り・スラッシュ区切り・漢字区切り（`2026年8月30日`）はいずれもExcelの自動日付認識に該当し、月または日が2桁になる日付（1年の大半）では変換後の表示幅が既定列幅を超えて結局`#######`になる**ことが判明したため、方針を変更した。

| 候補 | Excelでの型認識 | 結果 |
|---|---|---|
| `2026-08-30`（ハイフン） | 日付値へ自動変換（`yyyy/m/d`） | 月/日が2桁だと`#######` |
| `2026/08/30`（スラッシュ） | 日付値へ自動変換 | 同上 |
| `2026年8月30日`（漢字） | 日付値へ自動変換（`yyyy"年"m"月"d"日"`） | 同上 |
| `2026／08／30`（全角スラッシュ） | 日付値へ自動変換 | 同上 |
| **`2026.08.30`（ドット）** | **自動変換されず、プレーンテキストのまま** | **常に全文表示、`#######`にならない** |
| `08:41:32`（コロン時刻） | 時刻値へ自動変換（`h:mm:ss`） | 表示文字列は最大8文字（`23:59:59`）で既定列幅に収まるため`#######`にならない |

時刻はコロン区切りのままでも実測上問題ないため、可読性を優先しコロン区切り（`HH:mm:ss`）を維持した。日付のみドット区切りへ変更している。

### 29.5 Timezone

`donomanaRecordFormatCsvDateTime()`は`donomanaRecordFormatDateTime()`と同じくローカル時刻basis（`Date`オブジェクトの`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`/`getSeconds`）で整形する。ISO timestampがUTC（`Z`）であっても、CSV出力は既存Viewer表示と同じくローカル時刻に変換してから出力するため、UTCとJSTのずれによる新たな混乱は生じない。

### 29.6 Legacy timestamp fallback

対象6アプリの実装調査（`git log -p`によるtimestamp生成コードの変更履歴確認）の結果、各アプリの「日時」生成方式は導入以来一度も変更されていないことを確認した（インベントリは29.8参照）。ただし将来の破損データ・手動編集等に備え、`donomanaRecordFormatCsvDateTime()`は解析不能な値に対して以下のfallbackを行う。

- 元の文字列を`date`フィールドへそのまま保持する（空白化しない）
- 推測変換は行わない
- `time`フィールドは空文字を返す

### 29.7 CSV Injection Safety

`donomanaRecordFormatCsvDateTime()`の出力（`YYYY.MM.DD`・`HH:mm:ss`、いずれも数字で始まる）はExcelのformulaとして解釈される先頭文字（`=`・`+`・`-`・`@`）を含まない。`="..."`のようなExcel formula表現によるworkaroundは採用していない。既存の各アプリCSV escape処理（ダブルクォート・カンマ・CR/LF）にも変更を加えていない。

### 29.8 対象アプリ・実装inventory

| アプリ | 元の「日時」raw value | 生成方式 |
|---|---|---|
| hiragana-learn | `entry.time`（`toLocaleDateString('ja-JP')`+`HH:mm`、秒なし） | legacyロケール文字列 |
| katakana-app | 同上 | 同上 |
| suji-manabou | 同上 | 同上 |
| miru-hirogaru-app | `e.time`（`new Date().toISOString()`） | ISO 8601 UTC |
| directions-app | `l.tsLocal`（`YYYY/MM/DD HH:mm:ss`、ローカル、秒あり） | ローカル文字列 |
| kyou-no-kiroku | `r.date`（`new Date().toISOString()`） | ISO 8601 UTC |

### 29.9 検証結果

実CSV生成・実ブラウザ（Playwright制御Chromium）・実Microsoft Excel（COM自動化）による検証を6アプリ全てで実施し、いずれも`#######`が発生しないこと、日本語・絵文字・カンマ/クォート/改行を含むフィールドが崩れないこと、console/page errorが0件であることを確認した。詳細はPhase T5-E-A'の作業記録を参照。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft/RC | 2026-08-29 | Phase T5-D。UI Foundation 4関数（日時整形・日付grouping・inputMethod/tracingJudgmentLevel日本語ラベル変換）を新設。hiragana-learnのDelete Standard違反（確認なし全削除）を修正。directions-appのSwitch Scan候補漏れ（記録画面8ボタン）を修正。4 Pilot実ブラウザ検証・自動テスト31件・回帰確認（Tracing Engine・Composite Storage）完了。Common Viewer Architectureを「UI Foundation + 各アプリadapter」に確定（独立Viewer/画一UIは不採用）。全17アプリ・全35アプリへの展開は未実施。 |
| v1.0 Draft/RC | 2026-08-30 | Phase T5-E-A'。Learning Record CSVをExcelで開くと「日時」列が`#######`になる不具合を修正。CSV presentation専用のpure helper`donomanaRecordFormatCsvDateTime()`を新設し、「日時」1列を「日付」（`YYYY.MM.DD`）・「時刻」（`HH:mm:ss`）の2列へ分離。実Excel（COM自動化）検証により、ハイフン/スラッシュ/漢字区切りの日付はExcelの自動日付認識に該当し既定列幅を超えて`#######`になったままであることを発見し、Excelが自動変換しないドット区切りへ変更して解決を確認（29章）。対象6アプリ（hiragana-learn/katakana-app/suji-manabou/miru-hirogaru-app/directions-app/kyou-no-kiroku）全てで実CSV・実ブラウザ・実Excel検証完了、内部timestamp・既存CSV escape・Composite Storage・Tracing Engineへの回帰なし。 |
