# SST — Common Learning Records Detail Parity Audit（Version 1.0）

- Phase: `SST-COMMON-RECORD-DETAIL-PARITY-AUDIT-1`
- 版: v1.0（Audit + Design Only）
- 承認状態: Draft。User Approval待ち。Product変更・push・merge・deploy未実施。
- Baseline checkpoint: `440f390`（`feature/sawatte-common-record-detail-integration-1`、User Browser Review承認済み・local commit）
- Worktree: `for-all-children-to-learn-sst-common-record-detail-parity-audit1`
- Branch: `audit/sst-common-record-detail-parity-1`
- Production: `origin/main = 3753751`（本Phaseでは無変更）

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-cross-app-detail-contract-v1_0.md` | 本Auditの適用元Contract。APP-LOCAL/COMMON PARITY PRINCIPLE・Parity Levels・Adapter Architectureを定義 |
| `docs/records/learning-record-detail-parity-matrix.md` | 本Auditの結果を反映する対象（§34、SST行を実測ベースへ更新） |
| `donomana-sst-record-detail-contract-v1_0.md` | SST Record Detail v1（Roleplay Pilot、Common Schema、Record Semantics、Terminology）の正本。本Auditはこれを継承し矛盾があれば明示する |
| `donomana-sst-record-detail-expansion-plan-v1_0.md` | Wave 1（分岐ストーリー/感情カード/フレーズ集/呼吸活動）・Wave 2（ことばクイズ/SSTクイズ/ソーシャルストーリーのaggregate detail）の設計根拠。§13が「共通learning-records.html統合」を明示的にSeparate Findingとして未決のまま残していた（本Auditがこれを解消する） |
| Sawatte Reference Implementation（`SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1`、checkpoint `440f390`） | Adapter拡張・shared formatter・CSV parity方式の先行実装例。本Auditの設計方針はこれとの整合を取る |

---

## 1. 実測サマリー（推測なし、全て実コード確認）

- `sst-app.html`（9809行）の`recordActivity(type, lv, result, detail)`（6668行）が唯一のwrite path。`detail`は**任意引数**で、渡されない場合は従来通りlegacy shape（`{ts, type, lv, result, schemaVersion}`）のまま保存される。
- Contract v1.0のDraft時点スナップショット（§1、3引数版）は既に古い。**現在は`detail`引数が実装済みで、8個の`detail.type`が実際に本番コードで生成されている**（Wave 1/Wave 2実装が完了済み、Expansion Plan doc §16 "Recommended Next Implementation Phase"以降が実施されたことを示す）。
- `ACT_LABEL`（6623行）は**12個**のtype code（`rp/wq/story/branch/diary/quiz/thermo/breath/photo/emotion/phrase`の11 + Contract §3の正式11活動）を持つ。**`diary`（きもち日記）はContract §3の正式11活動に含まれていない未整理の12個目のtype**（§8参照、本Auditの新規発見）。
- App-local detail可視化は`buildReport()`（6710行）＝「今週のレポート」画面（`s-report`）**1箇所のみ**。個別record一覧・全期間Viewerは存在しない（Contract v1.0 Draft時点の記述と同じ結論が現在も有効）。
- `buildDetailRecordList(weekLog)`（6807行）が「くわしいきろく」のdetail disclosureを、`buildReportCsvContent(weekLog)`（7015行）が既存8列CSVを、**いずれも当該週（月〜日）にfilterされた`weekLog`のみを対象に**生成する（`saveActivityLog()`側のretentionは30日）。
- `assets/js/record-dashboard-foundation.js`のSST Adapter（649-671行）は**現在も`e.type`＋`e.lv`のみ**を読み、`e.detail`を一切参照していない（Cross-App Contractの実装前に書かれたまま、Category E「Common Detail不足」の実例として既にConformance Matrixに記載済み）。

---

## 2. Detail Type Inventory（実測、8種類 + detail無し2種類 + 未整理1種類）

Phase spec提示の8 type名（`roleplay_choice`等）は**実コードのdetail.type文字列と完全一致**することを確認した（推測ではなく`grep`実測）。

| # | 正式日本語名 | 内部mode/type (`e.type`) | `detail.type` | 記録箇所（行） | detail有無 |
|---|---|---|---|---|---|
| 1 | ロールプレイ（built-in） | `rp` | `roleplay_choice` | 5585-5593 | あり（built-inのみ） |
| — | ロールプレイ（custom） | `rp`（`currentLv==='custom'`） | — | 5585（`rpDetail=undefined`分岐） | **なし**（Privacy Decision 4、意図的） |
| 2 | 分岐ストーリー | `branch` | `branch_ending` | 9088-9093 | あり |
| 3 | 感情カード | `emotion` | `emotion_selection` | 5482 | あり |
| 4 | フレーズ集 | `phrase` | `phrase_action` | 9211,9215 | あり |
| 5 | きもちを落ち着ける（呼吸） | `breath` | `breathing_activity` | 5380 | あり |
| 6 | ことばクイズ | `wq` | `word_quiz_session` | 5619 | あり（Wave 2、session集約） |
| 7 | SSTクイズ | `quiz` | `sst_quiz_session` | 5965 | あり（Wave 2、session集約） |
| 8 | ソーシャルストーリー | `story` | `social_story_completion` | 5826 | あり（Wave 2、session集約） |
| — | 写真で練習 | `photo` | — | 8484（`recordActivity('photo',0,lv)`、3引数） | **なし**（Privacy Deferred、Expansion Plan §10） |
| — | きもち温度計 | `thermo` | — | 9576（3引数） | **なし**（対象外、v1で結論済み） |
| — | きもち日記 | `diary` | — | 8666（3引数、`names.join('+')`のみ） | **なし**（Contract §3の11活動に非該当、本文書§8で扱う） |

---

## 3. 各typeの実際のdetail schema（実コードから抽出、架空フィールドなし）

```js
// roleplay_choice（5585-5591）
{ detailSchemaVersion:1, type:'roleplay_choice',
  scenario:{id,title,situation}, choices:[{id,text,level}],
  selected:{id,text,level}, custom:false }

// branch_ending（9088-9093）
{ detailSchemaVersion:1, type:'branch_ending',
  scenario:{title},              // idなし
  route:[...currentBranchPath],  // 選択肢テキストの配列(選択肢idではない)
  ending:{title,desc,level} }

// emotion_selection（5482）
{ detailSchemaVersion:1, type:'emotion_selection', selected:{label,face} }

// phrase_action（9211,9215）
{ detailSchemaVersion:1, type:'phrase_action', category, phrase, action:'spoken'|'copied' }

// breathing_activity（5380）
{ detailSchemaVersion:1, type:'breathing_activity', activityTitle, completionStatus:'done' }

// word_quiz_session（5619、answers[]は5664で構築）
{ detailSchemaVersion:1, type:'word_quiz_session',
  answers:[ { question:{id,situation,prompt}, choices:[{id,text,level}], selected:{id,text,level} }, ... ] }

// sst_quiz_session（5965、answers[]は5906で構築）
{ detailSchemaVersion:1, type:'sst_quiz_session',
  answers:[ { question:{id,text}, choices:[{id,text,level}], selected:{id,text,level} }, ... ] }
  // levelは4値(best/good/support/try)、word_quiz_sessionは3値(best/good/try)

// social_story_completion（5826、answers[]は5784で構築）
{ detailSchemaVersion:1, type:'social_story_completion',
  story:{id,title},
  answers:[ { pageIndex, prompt:{text}, choices:[{id,text,level}], selected:{id,text,level} }, ... ] }
  // answers空配列もありうる(埋め込み質問のないストーリー)
```

---

## 4. App-local visibility（実測、`buildDetailRecordList()`＝「くわしいきろく」の実際の表示内容）

| type | 場面(sceneTitle) | 結果ラベル・値(resultLabel/resultText) | 展開表示(expandLabel/内容) | 教材内区分(tierText) |
|---|---|---|---|---|
| `roleplay_choice` | `scenario.title` | 「選んだ回答」/ `selected.text` | 「提示された選択肢」/ `choices[]`（選択項目ハイライト） | `selected.level` |
| `branch_ending` | `scenario.title` | 「たどりついたエンディング」/ `ending.title` | 「たどった道」/ `route[]` | `ending.level` |
| `emotion_selection` | — | 「選んだカード」/ `face + label` | — | — |
| `phrase_action` | `phrase`（sceneTitle位置に表示） | 「実行した操作」/ 「🔊読み上げました」or「📋コピーしました」 | 「カテゴリ」/ カテゴリ名 | — |
| `breathing_activity` | — | 「状態」/ 「完了」 | — | — |
| `word_quiz_session` | — | 「全N問」/ tier別集計（例: best 2／good 1） | 「問題ごとの記録」/ Q1〜QN（質問文・選んだ回答・区分） | — |
| `sst_quiz_session` | — | 同上 | 同上 | — |
| `social_story_completion` | — | 「完了」/ 「『タイトル』を読み終えたよ」 | 「質問ページごとの記録」/ Q1〜QN | — |
| `photo`/`thermo`/`diary` | — | **表示されない**（`weekLog.filter(a=>a.detail)`で除外） | — | — |

**重要な既存制約（実測）**: 上記はすべて`s-report`画面の`weekLog`（当該週、月〜日）内のrecordのみに適用される。週が変わった記録・30日を超えた記録はApp-local側でこの詳細表示に一切到達できない（後述§7）。

---

## 5. Common visibility（実測、learning-records.html + SST Adapter）

Sawatte Phase完了時点の実ブラウザ確認（前Phase Real E2E、SST/おかね回帰spot check）で再確認済み: SST recordのCommon Detailは**Level 1のみ**。

- 表示: 日付/時刻/教材（「SST ソーシャルスキルトレーニング」）/カテゴリ（「自立活動」）/活動（`activityLabel(e.type)`、`rp`のみ「ロールプレイ」、他は`quiz`が他App共用の「クイズ」ラベルにフォールバック、それ以外は未マップで「その他の活動」）/概要（「SSTの活動に取り組みました（type）」固定文言）/`metrics.level`のみ
- `detail`内の`scenario`/`choices`/`selected`/`route`/`answers`等は**一切表示されない**
- Rich Visualizationなし（SST Adapterに`hasMedia`相当のtrue分岐がそもそも存在しない）
- CSVアクションなし（`getCsvActions`未実装）

---

## 6. Parity Gap（確定）

| type | App-local Level | Common Level | Gap |
|---|---|---|---|
| `roleplay_choice` | Level 2（今週分のみ） | Level 1 | **Level 2欠落** |
| `branch_ending` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `emotion_selection` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `phrase_action` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `breathing_activity` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `word_quiz_session` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `sst_quiz_session` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `social_story_completion` | Level 2（同上） | Level 1 | **Level 2欠落** |
| `photo`/`thermo`/`diary` | Level 1相当（detail自体が無く、週次レポートの活動別集計棒グラフにのみ反映） | Level 1 | Gapなし（意図的にLevel 2対象外） |

Rich Visualization（Level 3）: **NOT APPLICABLE**（SSTは画像・軌跡等の可視化データを一切保存しない。§33で確定）。

---

## 7. Weekly Reportとの関係（確定、Phase spec §18への回答）

- App-local「今週のレポート」自体がすでに**週スコープ限定**（`getWeekRange()`で月曜起点の当該週のみ）。過去週・30日超のrecordはApp-local側でも個別detailへ到達不能（レポート画面が存在しないため）。
- したがって、Common統合は単なる「App-localにある情報をCommonでも見せる」以上の意味を持つ: **Common Detailは保存されている全期間（最大30日retention）のdetailへアクセスできる唯一の手段になる**。これは既存App-localのUXを損なわず、既存の「今週のレポート」（印刷・共有用の週次サマリーという別目的の画面）とは役割が異なる、純粋な追加価値である。
- この非対称性はCross-App Contract §2.1の「同等」定義（同じSource of Truth・同じ意味・同じ主要詳細）と矛盾しない：Foundation record自体は常に全件保持されており、App-localが「週次レポート」という別の目的でスコープを絞っているだけである。Common Detailが全期間を見せることは、Foundation recordの実体により忠実な表示であり、既存App-local UXの改変にはあたらない。

---

## 8. Open Finding: `diary`（きもち日記）type（本Audit新規発見、Blocking扱いしない）

`recordActivity('diary', 0, names.join('+'))`（8666行、3引数、detailなし）は、Contract §3の正式11活動に含まれない**12個目のtype**である。

- 本体（自由記述テキスト・選択した気持ちface配列）は別storage（`sst_diary_entries_v1`、`saveDiaryEntries()`）にのみ保存され、`activityLog`側には**要約すら含まれていない**（`recordActivity`の`result`引数に選んだ気持ちの名前を`+`区切りで渡すのみ）。
- `sst_diary_entries_v1`はSST Adapterのコメントで「絶対に参照しない」と明記されたPrivacy境界（自由記述を含みうるため）。この境界を本Auditも維持する。
- **本Auditの結論**: `diary`はCommon Detail Level 2の対象に含めない（そもそも`detail`自体が存在せず、対象とすべき追加情報が無い）。Common上は他のdetail無しtype（`photo`/`thermo`）と同様にLevel 1のまま表示されれば十分。Contract §3の「正式11活動」リストへ`diary`を追加登録するかどうかは、SST側の別Phase判断であり、本Auditのスコープ外として記録するに留める。

---

## 9. Required Level 2 Fields（確定・Blocking Decision解消）

Common Detailで表示する行を、**typeごとに実際に存在するfieldのみ**返す（Cross-App Contract §13 No over-generalization、存在しない「提示された選択肢」欄を常時表示しない）。

| Common行ラベル | 適用type | ソースfield |
|---|---|---|
| 場面 | `roleplay_choice`/`branch_ending` | `detail.scenario.title` |
| 問題文 | `roleplay_choice` | `detail.scenario.situation` |
| 提示された選択肢 | `roleplay_choice` | `detail.choices[]`（text、選択項目マーク付き） |
| 選んだ回答 | `roleplay_choice`/`branch_ending`（「たどりついたエンディング」の意）/`emotion_selection`（「選んだカード」の意）/`phrase_action`（「実行した操作」の意） | 各typeの`selected`/`ending`/`phrase`+`action` |
| 教材内区分 | `roleplay_choice`/`branch_ending` | `selected.level`/`ending.level` |
| たどった道 | `branch_ending` | `detail.route[]` |
| カテゴリ | `phrase_action` | `detail.category`（PHRASES辞書経由の日本語名） |
| 状態 | `breathing_activity` | `detail.completionStatus` |
| 問題ごとの記録（Q1〜QN） | `word_quiz_session`/`sst_quiz_session`/`social_story_completion` | `detail.answers[]`の`question`/`prompt`/`choices`/`selected`を1問ずつ展開 |
| 全体集計 | `word_quiz_session`/`sst_quiz_session` | `answers[]`のtier別カウント |
| 完了状態 | `social_story_completion` | `story.title`＋読了メッセージ |

「日時」「教材」はCommon既存汎用行がLevel 1として既に表示するため、Level 2としては上記のみを追加する（Sawatte実装と同じ役割分担）。

---

## 10. Type-specific Formatting（確定・Blocking Decision解消）

**巨大switch乱立を避けつつ、既存App-local実装（`buildDetailRecordList()`）と同じ分岐構造を1つのdispatchとして共有moduleへ移植する。** これは「新しい分岐ロジックを発明する」のではなく、「既にProduction実証済みの分岐ロジックをHTML生成からデータ生成へ変換して再利用する」設計であり、Contract §14の「type→detail formatter」分岐という提案を、既存の実装パターンへ忠実に従わせる形で解決する。

---

## 11. Shared Formatter方針（確定・Blocking Decision解消）

Sawatte（`assets/js/sawatte-hirogaru-record-detail.js`）と同じ思想で、**`assets/js/sst-record-detail.js`を新設**する。

- 責務: `getDetailRows(type, detail)`（Level 2行配列を返す、§9のマッピングを実装）／CSV row builder（§16参照）／`ACT_LABEL`相当の日本語ラベル（Common Adapter用に独立して持つ、§9 Shared Formatter方針と同じ「各ファイルが自分の分を持つ」慣習）。
- **App-local側の移行範囲はSawatteより限定的にする**（§38 Over-abstraction/refactor explosion回避）。`buildReportCsvContent()`のCSV行構築ロジックは`sst-record-detail.js`へ抽出し、App-local側もこれを呼ぶ形へ委譲する（Sawatteの`buildSummaryCsvRows`委譲と同型、重複CSVロジック禁止のCore要件のため必須）。一方、`buildDetailRecordList()`のHTML生成（「くわしいきろく」の折りたたみUI）は、Common側の`getDetailRows()`とロジックを共有する（同じtype分岐・同じfield参照）ものの、**App-local側のHTML文字列生成そのものの置き換えは今回のscopeに含めない**（App-local UXを壊すリスクの割に、CSVほど明確な重複ロジックの実害がないため）。次Phase実装時、`getDetailRows()`を先に実装し、`buildDetailRecordList()`が同じ関数の出力をHTML化する形へ寄せられるか改めて評価する。

---

## 12. CSV Architecture（確定・Blocking Decision解消）

- **既存8列（日時/教材/モード/場面/問題文/提示された選択肢/選んだ回答/教材内区分）が唯一のSource of Truth**（`buildReportCsvContent()`実測確認）。列追加・変更は行わない。
- Common Detailからの「詳細CSVを保存」アクションは、**同じ8列・同じrow builderロジックを共有moduleへ抽出**し、App-local（`weekLog`のみ）とCommon（全期間、最大30日retention）の両方から呼べるようにする（Sawatteの`getCsvActions()`パターンを踏襲）。
- Common Summary CSV（既存7列、全App共通）とSST詳細CSVの関係は、Sawatteと同じ「二段構成」が適切（§17解消）: 共通7列は無変更のまま維持し、SST固有詳細CSVはCommon Detail内のアクションとして追加する。

---

## 13. Legacy Compatibility（確定）

`detail`欠落（`photo`/`thermo`/`diary`、および`detail`実装前に保存された旧レコード全て）は、Common Detailで**Level 1のまま**表示する（追加行なし、field捏造なし）。Record自体は隠さない。

---

## 14. Unknown Type Fallback（確定）

`detail.type`が上記8種類のいずれでもない場合、**App-local自身が既に持つ安全なフォールバック**（`buildDetailRecordList()`の`else`分岐＝`roleplay_choice`相当の汎用表示: `scenario.title`/`choices[]`/`selected`があればそれを使う）と同じロジックをCommon側でも採用する。`detailSchemaVersion`が`1`以外、または欠落している場合は、Contract §12.2の既存決定（「detailごと無視し、従来通りの要約表示にフォールバック」）をCommonでも踏襲し、Level 1のみ表示する。

---

## 15. Rich Visualization

**NOT APPLICABLE**（§33解消）。SSTは画像・座標軌跡等いかなる可視化対象データも保存しない（実コード確認、`hasMedia`相当の判定基準がそもそも存在しない）。

---

## 16. Accessibility Requirements（確定）

- Common Detail内のtype別展開ブロックは、既存App-local `toggleReportDetail()`と同じ`aria-expanded`＋非強制フォーカス移動パターンを踏襲する（Sawatteの`.detail-csv-actions`ボタン群と同じ、独自の新規パターンを作らない）。
- text-onlyで理解可能（canvas等の非テキスト表現は存在しないため、この要件は自動的に満たされる）。
- A11y Panel優先順位はSawatte実装で確立済みの既存`record-detail-modal`のfocus trapをそのまま使う（新規並行containment機構は作らない）。

---

## 17. Performance Requirements（確定）

一覧表示時にSST全recordのdetailを展開しない。Common Detail modal open時のみ、対象1recordの`getDetailRows()`を呼ぶ（Sawatteと同じon-demandパターン）。CSVアクションのみ、その時点でstorage全体（最大30日分）を読む。

---

## 18. Privacy（確定）

- Common Detail追加によるfetch/XHR/server同期の新規追加なし。
- `sst_diary_entries_v1`（きもち日記本文・自由記述）は本Auditの対象外のまま、SST Adapterの既存境界（絶対に参照しない）を継続する。
- custom Roleplay（`currentLv==='custom'`）はdetailを持たないため、Common側でも自動的にLevel 1のまま表示される（追加のPrivacy対応不要、既存Decision 4がそのままCommon側にも及ぶ）。
- 写真で練習（`photo`）は既存Deferred判断のままdetailを持たないため、Common側でも自動的にLevel 1のまま（写真データ自体もそもそも保存されていない）。

---

## 19. Implementation Scope（確定・Blocking Decision解消）

次Phase（`SST-COMMON-RECORD-DETAIL-INTEGRATION-1`）で変更が必要なファイル:

- **新規**: `assets/js/sst-record-detail.js`（`getDetailRows(type, detail)`・CSV row builder・ラベルmap）
- **変更**: `assets/js/record-dashboard-foundation.js`（SST Adapterへ`getDetails`/`getCsvActions`追加。`richVisualization`は追加しない＝NOT APPLICABLE）
- **変更**: `assets/js/record-dashboard-ui.js`（`ACTIVITY_LABELS`へSSTの残り10 type code分を追加、既存`'rp'`/`'quiz'`に加えて`wq`/`story`/`branch`/`diary`/`thermo`/`breath`/`photo`/`emotion`/`phrase`を追加）
- **変更**: `learning-records.html`（`openDetailModal()`は既にSawatte Phaseで`getRecordDetails`/`getCsvActions`のpassthroughを汎用実装済みのため、**恐らく無変更または最小限の調整のみ**——実装Phase開始時に再確認）
- **変更（小、CSVロジック共有化のみ）**: `sst-app.html`（`buildReportCsvContent()`を`sst-record-detail.js`のCSV row builderへ委譲する薄い置き換えのみ。`buildDetailRecordList()`のHTML生成は§11の判断により今回のscope外）

---

## 20. Test Matrix（次Phase用、確定）

- 8 detail types（§2の表）それぞれのgetDetailRows()出力の実測検証（golden fixture、実データ構造ベース）
- legacy record（`detail`欠落: `photo`/`thermo`/`diary`および旧record）
- `detailSchemaVersion`不正・欠落時のfallback
- 未知`detail.type`のfallback
- CSV parity（8列、App-local/Common同一row builder、byte比較）
- custom Roleplay（`detail`なし）のPrivacy境界維持確認
- 既存21+1 Adapter回帰（golden-tests.js / ui-golden-tests.js、22→23への更新は不要——SST自体は既に登録済みで新規登録ではないため、カウント変更なし。既存の816/58件が壊れないことのみ確認）
- A11y（keyboard、aria-expanded、focus trap）
- Mobile（390px幅、Q1〜QN展開時の折返し）

---

## 21. Real E2E Plan（次Phase用、確定）

Sawatteと同じ流れをSSTで実施する:

1. 実ブラウザでSSTの複数typeを実際にプレイ（ロールプレイ1回・ことばクイズ数問・分岐ストーリー1回等）→実localStorageへ`detail`付きrecordが書き込まれることを確認
2. `learning-records.html`で該当recordを開き、Level 2表示がApp-local「くわしいきろく」と同じ意味・同じ値であることを確認
3. Common詳細CSVをダウンロードし、App-local週次CSVと同じ8列・同じ値（対象recordが週内なら）であることを確認
4. SST以外のApp（前回同様okane-app等）を開き、SST固有UIが出ないことを再確認

---

## 22. User Review Plan（次Phase用、確定）

User本人が、実際にプレイしたSST活動についてCommon Detailを開き、「App内（くわしいきろく）と同じ意味で見える」ことを主観確認するGateを、Sawatteの`SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-USER-REVIEW-1`と同じ形式で設定する。

---

## 23. Conformance Matrix更新案

`docs/records/learning-record-detail-parity-matrix.md`のSST行を、本Auditの実測結果に基づき次のように更新する（次Phase実装完了後に反映、本Phaseでは提案のみ）:

| appId | Record Foundation | App-local Detail | App-local Rich Viz | Common Adapter | Common Detail | Common Viz | CSV(共通7列) | Parity Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| sst-app | ✅ | ✅ あり（8 detail type、週スコープの「今週のレポート」内、実測確認済み） | — (該当なし、Rich Visualization NOT APPLICABLE) | ✅ | ❌ Summary相当のみ（`type`+`lv`のみ、実測再確認） | N/A | ✅ | **SUMMARY ONLY**（実装Phase未着手） | 本Audit(`SST-COMMON-RECORD-DETAIL-PARITY-AUDIT-1`)でGap確定。次Phase: `SST-COMMON-RECORD-DETAIL-INTEGRATION-1` |

---

## 24. Blocking Decisions — 解消状況

| # | 項目 | 解消箇所 |
|---|---|---|
| 1 | SSTのLevel 2必須field | §9 |
| 2 | type-specific formatting | §10 |
| 3 | CSV方針 | §12 |
| 4 | legacy方針 | §13 |
| 5 | unknown type fallback | §14 |
| 6 | shared formatter方針 | §11 |
| 7 | implementation scope | §19 |
| 8 | test matrix | §20 |

**Blocking Open Decisions: 0**

---

## 25. Non-blocking Open Decisions

- `diary`（きもち日記）type をContract §3の正式活動リストへ追加すべきか（§8、本Auditのスコープ外として記録のみ）
- `buildDetailRecordList()`（App-local HTML生成）を`getDetailRows()`実装後にどこまで委譲へ寄せるか（§11、次Phase開始時に再評価）
- `record-dashboard-ui.js`の`ACTIVITY_LABELS['quiz']`が他App（hiragana-learn等のtrace quiz）と共有されている件——SST固有のより詳細なラベルにすべきか、共有のままでよいか（実害はないが実装Phaseで一度確認）

---

## 26. Definition of Done（本Audit Phase自体）

- [x] 440f390 baseline確認（Audit worktree HEAD = 440f390、origin/main = 3753751、working tree clean）
- [x] SST 8 detail type実測（推測ゼロ、全て`grep`+実コード読み込みで確認）
- [x] App-local/Common差分確定（§6）
- [x] Level 2 field固定（§9）
- [x] CSV方針固定（§12）
- [x] legacy/fallback固定（§13・§14）
- [x] shared formatter方針固定（§11）
- [x] implementation scope固定（§19）
- [x] test matrix固定（§20）
- [x] Blocking Decisions 0（§24）
- [x] Docs only（Product変更0件）
- [x] Production unchanged（`origin/main = 3753751`のまま）
