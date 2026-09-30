# どのまな SST Monthly Trend Design Contract（Version 1.0）

- **Status: DESIGN ONLY / DOCS ONLY**
- **Implementation: NOT STARTED**
- Phase: `SST-MONTHLY-TREND-DESIGN-1`
- 発行: 2026年9月
- Production baseline: `origin/main = 87b7d1f63b197401992d0122caba445e446350c3`（記録上の直近基準`e9f1e19`から14 commit進行、いずれもwizard.html/apps-data.json/input-support-guide関連であり本設計の対象領域〈SST・Learning Record Foundation・PDF〉に影響なし。詳細は§0.1）
- Branch: `feature/sst-monthly-trend-design-1`
- 位置づけ: 本文書は既存の`donomana-sst-record-detail-contract-v1_0.md`（SST Record Detail v1、Production Released）・`donomana-sst-record-detail-expansion-plan-v1_0.md`（Wave 1/2拡張）・`docs/records/sst-common-record-detail-parity-audit-v1_0.md`（Common Learning Records統合Audit）・`donomana-learning-record-standard-v1_0.md`（Foundation標準）・`donomana-supporter-record-dashboard-design-v1_0.md`（横断Dashboard設計）を継承する。いずれの既存契約も置き換えない。新規に定義するのは「SSTの既存recordを、直近4週間という時間軸で振り返るための可視化契約」のみである。
- 契機: 実ユーザーから「今週のレポート」の教員間共有のしやすさを評価する声とともに、1か月程度の回答傾向・利用状況を折れ線グラフ等で振り返りたいという要望が届いた。本Phaseはこれを機械的に実装せず、既存architecture・データ十分性・教育的妥当性・安全性を検証したうえで正式なDesign Contractとして確定する。
- 変更ファイル: 本ドキュメントのみ。`sst-app.html`・`assets/js/sst-record-detail.js`・`assets/js/record-dashboard-foundation.js`・`generate.js`・`apps-data.json`・Foundation API・localStorage schemaのいずれも本Phaseで変更していない（Production機能コード変更 0件）。

---

## 0. 関連文書（Source of Truth）

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | Core Schema・Storage・Foundation API・Privacy原則の正本。本契約はこれを継承し、置き換えない |
| `donomana-sst-record-detail-contract-v1_0.md` | SST Record Detail v1（Roleplay Pilot起点、Production Released）。本契約が前提とするSST record/detail schemaの正本 |
| `donomana-sst-record-detail-expansion-plan-v1_0.md` | Wave 1（分岐ストーリー／感情カード／フレーズ集／呼吸）・Wave 2（ことばクイズ／SSTクイズ／ソーシャルストーリー）の設計根拠。Production Released |
| `docs/records/sst-common-record-detail-parity-audit-v1_0.md` | SSTのCommon Learning Records（`learning-records.html`）統合Audit。**Draft、User Approval待ち、未実装**（§0.1参照） |
| `donomana-supporter-record-dashboard-design-v1_0.md` | 横断Learning Records Dashboard（`learning-records.html`）の設計文書。Timeline-first・no-score原則・Adapter Registryパターンの先行例 |
| `donomana-learning-record-cross-app-detail-contract-v1_0.md` | App-local/Common Parity Principleの正本 |

### 0.1 Drift Gate 実施結果

`git fetch origin`後、`origin/main = 87b7d1f`を確認。記録上の直近基準`e9f1e19`との間に14 commitの進行があったが、`git log e9f1e19..origin/main`で内容を確認したところ、全てwizard.html・apps-data.json（input metadata）・input-support-guide.html関連であり、SST・Learning Record Foundation・PDF機能への変更は0件だった。本設計への影響なし。

`docs/records/sst-common-record-detail-parity-audit-v1_0.md`（SST Common統合Audit）は**Draft・User Approval待ちであり未実装**であることを確認した。したがって現時点のProductionでは、SST recordのCommon Learning Records表示は**Level 1（type+lvのみの汎用summary）に留まる**。この事実は§15で扱う。

---

## 1. Purpose

SSTアプリ群（`sst-app.html`、11〜12活動）の既存記録を基盤に、教員・支援者が**直近4週間**の回答傾向・利用状況を振り返れる機能を正式設計する。目的は「子どもを数値で評価すること」ではなく、「これまでの回答を、時間の流れに沿って振り返りやすくすること」である。Donomanaはデータを整理して提示するに留め、意味の解釈は教員・支援者が行う。

## 2. Non-goals

- 心理アセスメント・心理検査・診断・能力評価・SST能力スコア・成長スコアの提供
- 回答傾向の変化を心理状態の改善・社会性の向上・能力の向上・行動変容と自動的に断定すること
- 複数recordを重み付けした独自の複合スコア（例: SST Score = 72、成長度 +15%）の算出
- 生徒氏名・出席番号等の新規個人情報入力を要求する生徒識別の仕組み
- サーバーアップロード・アカウント・クラウドDB・外部analyticsへの送信・外部chart serviceの導入
- Donomana全体（35アプリ）を横断する巨大trend dashboardの設計（SSTに限定する。汎用化が必要な場合は"Reusable Trend Visualization Contract"としての切り出しのみを扱い、実装対象はSSTに限定する、§15）
- 本Phaseでのコード実装・push・merge・deploy

---

## 3. Existing architecture findings（実コード調査結果）

### 3.1 SSTアプリ構成

Production上のSST関連ファイル: `sst-app.html`（9,900行超、単一ファイル）、`assets/js/sst-record-detail.js`（Common Detail共有formatter）、`app-details/sst-app-detail.html`（紹介ページ、記録機能なし）。SST関連の記録機能は`sst-app.html`内に閉じている。

`ACT_LABEL`（`sst-app.html:6777-6789`）に定義される内部活動は12種類: `rp`（ロールプレイ）/`wq`（ことばクイズ）/`story`（ソーシャルストーリー）/`branch`（分岐ストーリー）/`diary`（きもち日記）/`quiz`（SSTクイズ）/`thermo`（きもち温度計）/`breath`（きもちを落ち着ける）/`photo`（写真で練習）/`emotion`（きもちカード）/`phrase`（フレーズ集）。`diary`は既存Record Detail Contractの「正式11活動」に含まれない12個目のtypeであり、別storage（`sst_diary_entries_v1`）にのみ本体を持つ（§3.4）。

### 3.2 SST Record Schema（実コード確認）

`recordActivity(type, lv, result, detail)`（`sst-app.html:6822-6835`）が唯一のwrite path:

```js
function recordActivity(type, lv, result, detail){
  const record = { ts: Date.now(), type, lv: lv||0, result: result||'done', schemaVersion: 1 };
  if (detail !== undefined) record.detail = detail;
  activityLog.push(record);
  const saveResult = saveActivityLog();
  if (!saveResult.ok) { /* 失敗時はin-memoryから当該recordのみ除去 */ }
}
```

Storage: `localStorage`キー`sst_activity_log_v1`（`ACTIVITY_LOG_KEY`）、共有I/Oプリミティブ`donomanaRecordReadLog`/`donomanaRecordWriteLog`経由（`sst-app.html:6798,6810`）。**`donomanaRecordCreate()`が定義するStandard Core Schema（`{timestamp,appId,activity,inputMethod,schemaVersion,payload}`）は使用していない**。SST独自の`{ts,type,lv,result,schemaVersion,detail?}`shapeを保つ（`donomana-supporter-record-dashboard-design-v1_0.md`が既に指摘する「21〜22アプリ中、Standard Core Schemaを実際に使うのは5本のみ」という既知の非統一性と一致）。

`detail`は8種類のtypeで実装済み（Wave 1/2、Production Released、`docs/records/sst-common-record-detail-parity-audit-v1_0.md §2`実測）:

| detail.type | 対応する`e.type` | 主なfield |
|---|---|---|
| `roleplay_choice` | `rp`（built-inのみ） | `scenario{id,title,situation}`, `choices[]{id,text,level}`, `selected{id,text,level}` |
| `branch_ending` | `branch` | `scenario{title}`, `route[]`, `ending{title,desc,level}` |
| `emotion_selection` | `emotion` | `selected{label,face}` |
| `phrase_action` | `phrase` | `category`, `phrase`, `action` |
| `breathing_activity` | `breath` | `activityTitle`, `completionStatus` |
| `word_quiz_session` | `wq` | `answers[]{question,choices[],selected}`（3値level: best/good/try） |
| `sst_quiz_session` | `quiz` | `answers[]{question,choices[],selected}`（**4値level: best/good/support/try**） |
| `social_story_completion` | `story` | `story{id,title}`, `answers[]{pageIndex,prompt,choices[],selected}` |

`detail`を持たないtype（`photo`/`thermo`/`diary`、custom Roleplay）は`{ts,type,lv,result,schemaVersion}`のlegacy shapeのまま。

### 3.3 「今週のレポート」（`buildReport()`, `sst-app.html:6767-6913`付近）

- データソース: `activityLog`（＝`sst_activity_log_v1`）そのもの。今週レポート専用の別structureは存在しない。
- **時間窓: 月曜起点の暦週**（`getWeekRange()`、`sst-app.html:6861-6870`）。`now.getDay()`から`mon`/`sun`を算出し、`startTs=mon 00:00:00.000`・`endTs=sun 23:59:59.999`で`activityLog.filter(a=>a.ts>=startTs && a.ts<=endTs)`する（`weekLog`）。**「直近7日間」ではない**。
- 表示要素: 実施日数・総活動回数・今週のバッジ（別storage `sst_week_badges_v1`）・累計`totalScore`（**週スコープ外、バッジgamification専用の別概念**）・曜日別棒グラフ（`buildWeekChart`）・活動種別内訳（`buildActivityList`）・detail保有8 typeのみの「くわしいきろく」一覧（`buildDetailRecordList(weekLog)`）・きもち温度計の直近6件チャート。
- **重要な既存制約**: `buildDetailRecordList()`は`weekLog`（今週のみ）にしか適用されない。過去週・30日を超えたrecordはApp-local側で個別detailへ到達する手段が現状存在しない（`docs/records/sst-common-record-detail-parity-audit-v1_0.md §7`）。

### 3.4 Retention（最重要の制約、実コード確認）

```js
// sst-app.html:6806-6811
function saveActivityLog(){
  // 過去30日分のみ保持(既存retentionを無変更のまま維持)
  const limit = Date.now() - 30*24*60*60*1000;
  activityLog = activityLog.filter(a=>a.ts > limit);
  return donomanaRecordWriteLog(ACTIVITY_LOG_KEY, activityLog);
}
```

**`sst_activity_log_v1`は「現在時刻から30日」のローリングウィンドウであり、カレンダー月の概念を持たない。** `recordActivity()`が呼ばれる（＝新しい活動を記録する）たびに、30日を超えたrecordがフィルタで削除される。過去month同士の比較（「先月 vs 今月」）に使える蓄積は存在しない。この事実が§8（Time Window Design）の結論に直結する。

### 3.5 PDF / 印刷

外部PDFライブラリは存在しない。純粋な`window.print()` + `@media print` CSSのみ（`sst-app.html:7157-7159`の`printReport(){ window.print(); }`、CSS本体は`sst-app.html:1087-1145`付近）。

- `body *{visibility:hidden}` → `#report-card,#report-card *{visibility:visible}`という可視性分離パターン
- `@page{size:A4 portrait;margin:15mm;}`
- ダークモード配色を印刷時は強制的にライト配色へ戻す
- `.report-detail-body[hidden]{display:block!important;}`でJS/DOM操作なしに折りたたみ済みdetailをCSSのみで強制展開（コード自身のコメントが明記: 「no beforeprint/afterprint, no DOM mutation」）
- 印刷専用のサイトクレジット行（`.report-print-credit`、Phase SST-WEEKLY-REPORT-PDF-CREDIT-FIX-1）が`#report-card`末尾に追加済み。**ただし「診断・心理検査ではない」旨の注記文は現状存在しない**（§14で新規検討）。
- 検証: `tools/sst-weekly-report-pdf/pdf-print-implementation-test.js`が`page.emulateMedia({media:'print'})`と`window.print()`スパイで実ブラウザ検証済み（165/165 PASS、前Phase実施分で確認済み）。

### 3.6 Learning Record Foundation（共通API）

`donomanaRecordCreate(appId, activity, inputMethod, payload)`（`generate.js:1753-1762`、各appへ自動挿入）がStandard Core Schemaを定義するが、**SSTはこれを一度も呼んでいない**（grep実測、呼び出し箇所0件）。SSTが使うのは`donomanaRecordReadLog`/`donomanaRecordWriteLog`という汎用I/Oプリミティブのみで、record自体の形は独自定義のまま（§3.2）。

`schemaVersion`欠落 = legacy v1として扱うという後方互換原則（`donomanaRecordNormalizeLegacy()`、`generate.js:1746-1749`）がFoundation全体の標準であり、SSTの`schemaVersion:1`固定運用と整合する。

「Full Backup」（export-only、4アプリのみ対応・SSTは未対応）は存在するが、**import/restore機能はサイト全体を通じて存在しない**（grep実測、0件）。

### 3.7 Common Learning Records（`learning-records.html`）とSSTの現在の統合状況

`learning-records.html`は既にProduction稼働中の横断record viewer（Phase T8-A/T8-B1/T8-B2で設計・実装）。Adapter Registry方式（`assets/js/record-dashboard-foundation.js`）でread-only・device-level・local-onlyのTimeline UIを提供する。SSTは現在**登録済み22 adapterの1つ**だが、`docs/records/sst-common-record-detail-parity-audit-v1_0.md`（Draft、未実装）が確定させた通り、**現状のCommon Adapter実装は`e.type`+`e.lv`のみを読み、`e.detail`を一切参照しない**。つまりCommon側でSSTを見ると「SSTの活動に取り組みました（type）」という汎用summaryのみが表示され、選択肢・教材内区分等の詳細は見えない（Parity Status: `SUMMARY ONLY`）。

重要なのは、**月次・週次集計やtrend chartの機能がCommon側にも一切存在しない**という点である（`learning-records.html`のgroupingは日付単位のみ、`groupByDate()`、`assets/js/record-dashboard-ui.js:272`）。「月間」「monthly」「trend」に関連するコードはリポジトリ全体を通じて存在しない（grep実測、sitemapの`changefreq`以外ヒットなし）。

---

## 4. Current SST record schema（§3.2の要約再掲）

```js
// legacy (detailなし、photo/thermo/diary、custom RP)
{ ts: 1757659200000, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }

// detail付き（例: roleplay_choice）
{
  ts: 1757659200000, type: 'rp', lv: 1, result: 'best', schemaVersion: 1,
  detail: {
    detailSchemaVersion: 1, type: 'roleplay_choice',
    scenario: { id:'rp_1_01', title:'はじめてのあいさつ', situation:'...' },
    choices: [ {id:'c1',text:'...',level:'best'}, {id:'c2',text:'...',level:'good'}, {id:'c3',text:'...',level:'try'} ],
    selected: { id:'c1', text:'...', level:'best' }, custom: false
  }
}
```

「教材内区分」（level/tier）は活動により3値（best/good/try）または4値（best/good/support/try、SSTクイズのみ）。**サイト全体を通じて、これらのtier値を数値化・平均化・集計するコードは一切存在しない。** 既存コードは明示的にこれを警告している:

```js
// sst-app.html:4685-4694付近のコメント
// choices[].ok は内部フラグ(子どもには非表示)。choices[].tier が実際の評価情報。
// 将来ことばクイズの学習記録・分析機能を追加する場合は、okではなくtierを
// 参照して「不正解」集計をしないこと。
```

---

## 5. Data sufficiency audit

| Metric candidate | Required data | Currently stored? | Historical records usable? | Cross-app comparable? | Risk | Recommendation |
|---|---|---|---|---|---|---|
| 1. 実施回数 | `ts` | ○（全record） | ○（30日以内） | ○（全12 type共通） | 低 | 採用（主指標） |
| 2. 回答数 | `ts`+`detail.answers[]`の有無 | △（session型8 typeのみanswers[]、他は1 record=1回答） | △ | △（record粒度が不揃い） | 中（記録粒度の違いを「活動数」と混同するリスク） | 「実施回数」で代替、独立指標にしない |
| 3. 選択肢別の選択回数 | `detail.selected` | △（8 detail-type のみ） | ○（30日以内） | ×（選択肢自体がscenario固有） | 中 | 個別recordの詳細閲覧でのみ提供、集計しない |
| 4. tier/category別の選択回数 | `detail.selected.level`/`ending.level` | △（8 detail-type のみ、tier保有はroleplay/branch/word_quiz/sst_quiz/social_storyの5〜6type） | ○（30日以内） | ×（3値/4値が混在） | 中〜高（誤って一律集計すると意味が変わる） | **活動タイプ別に限定して採用**（§6 Option C参照）、タイプ横断の合算はしない |
| 5. tier/category別の割合 | 同上 | 同上 | 同上 | 同上 | 中〜高（%表示は「達成率」に見えやすい） | 採用するが表現は件数ベースの内訳に限定、%のみの単独表示はしない |
| 6. scenario/question別の回答推移 | 安定ID（`scenario.id`/`question.id`） | △（roleplay/word_quiz/sst_quiz/social_storyのみ安定ID、branch/emotion/phraseは無し） | ○ | × | 高（同一scenarioの再実施頻度が低くsmall sample問題が起きやすい） | **v1のprimary機能には含めない**。個別scenario詳細からの将来拡張候補として記録（§22） |
| 7. 同一questionへの回答変化 | 同上 | 同上 | 同上 | 同上 | 高 | 同上、out of scope |
| 8. SSTアプリ別利用回数 | `type` | ○ | ○ | ○ | 低 | 採用（副次指標、活動種別内訳として） |
| 9. 日別/週別利用状況 | `ts` | ○ | ○（30日以内、§8参照） | ○ | 低〜中（週境界とretention境界のズレ、§8.3） | 採用（主要な時間軸） |
| 10. 未回答/中断の扱い | 該当データなし | ×（中断・未回答を記録する仕組みが存在しない） | N/A | N/A | 中（「記録が無い=何もしなかった」と「記録が無い=保存期間切れ」を混同するリスク） | §9で明示的に設計（missingはmissingとして扱う） |

**結論**: 「実施回数」「活動種別内訳」「週別の記録件数推移」は12 type全てで安全に算出可能。「tier別内訳」は8 detail-type限定・活動タイプ別限定でのみ安全に算出可能。「同一scenario回答推移」は現状のデータ密度では小サンプル問題が大きく、v1のscopeには含めない。

---

## 6. Candidate metrics（What Should Be Graphed）

既存の週次レポートが既に`buildWeekChart()`（曜日別棒グラフ）と`buildActivityList()`（活動種別内訳）を持つことを踏まえ、これらのパターンを時間軸方向へ拡張することを基本方針とする（新しい可視化語彙を発明しない）。

### Option A — 週ごとの実施回数

`activityLog`を週（月曜起点、§8）単位でグループ化し、件数を棒グラフ化する。教育的価値: 高（利用状況そのものが振り返りの出発点）。誤解リスク: 低（「回数」は達成度の評価を含意しない）。必要データ: `ts`のみ、12 type全てで揃う。現行schemaで可能: 既存の週次バケット化ロジック(`getWeekRange`)をそのまま4週へ拡張すればよい。UI complexity: 低。Accessibility: 棒グラフ+数値テーブルの2系統で容易に両立。Small sample問題: 低（絶対数のみ）。Cross-SST比較性: 高（type非依存）。PDF適性: 高（既存`buildWeekChart`のPDF出力実績あり）。

### Option B — 週ごとの回答数

§5 Metric 2の通り、record粒度が活動タイプにより不揃い（1 roleplay選択=1 record、1クイズセッション=1 recordだが内部に複数answers[]）のため、「回答数」を独立指標として前面に出すと「活動1回」と「設問1問」が混同されるリスクがある。**不採用**（Option Aの実施回数で代替）。

### Option C — tier/category別の回答割合

活動タイプごとに`detail.selected.level`（またはbranchの`ending.level`）の出現回数を集計する。教育的価値: 中〜高（選択パターンの変化は振り返り材料になりうる）。誤解リスク: 高（無差別に集計すると「正答率グラフ」に見える）。必要データ: tier保有5〜6 typeのみ。現行schemaで可能: yes、ただし**活動タイプをまたいだ合算は不可**（3値/4値混在、scenarioごとに意味が異なる`level`値のため）。UI complexity: 中（タイプ別に分離表示する必要がある）。Small sample問題: 中（週によっては該当活動が0件のtypeがありうる）。Cross-SST比較性: 低（意図的に比較させない）。PDF適性: 中。**採用するが、常に「特定の活動タイプ内での教材内区分の内訳」として個別表示し、SST全体の単一指標にはしない。**

### Option D — 同一scenario/questionにおける選択の変化

§5 Metric 6/7の通り、安定IDを持つtypeが限定的（roleplay/word_quiz/sst_quiz/social_story）かつ同一scenario再実施頻度が低くsmall sample問題が大きい。教育的価値: 理論上は最も高いが、実データでは信頼性が低い。**v1のprimary機能には不採用**、個別scenario詳細ページからの将来拡張候補として§22に記録する。

### Option E — 複数指標を組み合わせたdashboard

Option A（週別実施回数、主グラフ）+ 活動種別内訳（`buildActivityList`の週別拡張、副次表示）+ Option C（activity-type別tier内訳、詳細ドリルダウンのみ）+ 実際の回答へのリンク（`buildDetailRecordList`/`getDetailRows`を再利用した個別record表示）という**3層構造**（グラフ+数値+実回答）。既存UI資産（`buildWeekChart`/`buildActivityList`/`buildDetailRecordList`/`sst-record-detail.js`）をすべて再利用できる。

### Option F（コード調査から追加）— 週別の活動種別内訳の時系列表示

`buildActivityList()`が既に「今週、どの活動に何回取り組んだか」を表示しているため、これを4週間分ならべる（Option Aと対になる副次グラフ）。既存アイコン・ラベル（`ACT_LABEL`）をそのまま再利用できるため実装コストが低い。

**推奨: Option E（A+F を主、Cを活動タイプ別drilldownとして提供、Dは見送り）。** 折れ線グラフを既定解にしない、という指示と、既存`buildWeekChart`が棒グラフである実績の両方に整合する。

---

## 7. Rejected metrics（Do NOT Invent a Composite Score）

以下は明示的に不採用とする。理由をそれぞれ付す。

- **SST Score / 総合点**: tier値（best/good/try、一部4値）を数値化・加重平均する根拠が既存コード・既存設計のどこにも存在しない。むしろ`tierOf()`周辺の既存コードコメントが「不正解集計をしないこと」と明示的に警告している（§4）。
- **Social Skill % / 社会性スコア**: 「教材内区分」は当該教材が提示した選択肢の分類であり、子どもの社会性そのものの測定値ではない。これを%化して提示すると、Record Detail Contract §19の「Record自体から理解度・能力・感情状態・成功/失敗・診断結果を自動推定しない」という既存原則（全ての既存SST設計文書で一貫している）に反する。
- **成長度 / 改善度**: 週間の回答傾向の変化を「改善」と自動ラベリングする根拠がない。同じ理由で「悪化」もラベリングしない。
- **best=3/good=2/try=1のような機械的採点**: SSTクイズは4値（best/good/support/try）、他は3値（best/good/try）であり、モードによって意味の重みが異なる可能性がある（実コードからは重み付けの妥当性を検証できない）。教育的根拠が無い数値変換は行わない（§7の明示的禁止指示に対する回答）。
- **回答数を独立指標として使うこと**: §6 Option Bの通り、record粒度の不揃いにより誤解を招くため不採用。

**既存のSupporter Record Dashboard設計文書がすでに同じ結論に達している**（`donomana-supporter-record-dashboard-design-v1_0.md:290`）:「Summary cardsに『平均点』『ランキング』『達成率』を置かない...表現は『変化』『最近の記録』『活動の様子』『取り組み』を優先し、『成長』『向上』を記録だけから自動断定しない」。本Design Contractはこの既存方針をSSTの4週間ふりかえり機能へそのまま継承する。

---

## 8. Time-window definition

### 8.1 検討した候補

A. 直近28日／B. 直近30日／C. 暦月／D. 直近4週間（月曜起点）／E. ユーザー指定期間

### 8.2 結論: D（直近4週間、月曜起点）を採用

理由:

1. `saveActivityLog()`の実retentionは「現在時刻から30日」のローリングウィンドウであり（§3.4）、暦月（C、最大31日）を採用すると月初のデータが月末時点で既に保存期間外になっている可能性がある。4週間=28日は30日以内に収まり、2日分の安全マージンを持つ。
2. 既存「今週のレポート」が月曜起点の暦週（`getWeekRange()`）で設計されている。「4週間のふりかえり」を同じ週定義（月曜起点×4）で構成すれば、「今週のレポート」+「4週間のふりかえり」が自然に積み重なる構造になり、新しい日付境界ロジックを発明せずに済む。
3. E（ユーザー指定期間）はUIの複雑さを増し、保存期間30日という制約の下では実質的な自由度が乏しい（30日を超える範囲を指定しても空振りになる）。v1では不採用、必要なら将来検討。

### 8.3 既知のエッジケース（正直に明記する）

4週間＝28日だが、**表示する瞬間の「今日」が今週の何日目かによって、最も古い週（4週目）の一部が既に30日retentionで削除されている可能性がある**。例: 今週の日曜日に閲覧した場合、4週間前の月曜日のrecordは28+6=34日前となり、30日retentionを超えて既に削除済みである。この非対称性は§9（Sparse Data）で明示的に扱う。

---

## 9. Sparse-data behavior

禁止事項（Phase指示を継承）: 0件を0%の能力として表示しない。「未実施」と「該当選択肢を選ばなかった」を混同しない。missing dataはmissingとして扱う。

### 9.1 設計ルール

- 週内のrecord件数が0の場合、その週は「記録なし」と表示する（0%・棒の高さ0という表現自体は許容するが、隣接する文言やlegendで「活動が無かった週」であることを明示し、「できなかった週」という含意を持たせない）。
- 4週目（最も古い週）が§8.3のエッジケースに該当しうる場合、**「保存期間の関係で、一部の記録が表示されていない可能性があります」という注記を常時表示する**（週の一部日付が30日境界に近い場合のみ動的に出す案も検討したが、判定ロジックの複雑化と誤判定リスクを避けるため、4週目には常時この注記を出す方式を第一候補とする）。
- 同一questionを一度しか実施していない場合（Option D、§6）はv1のscopeに含めないため、このケース自体が発生しない。
- SSTアプリ間でrecord richness（detail有無）が異なることは、tier別内訳（Option C）をactivity type別に限定表示することで吸収する（§6）。
- 途中からschemaが変わった記録（`detail`なしのlegacy recordと`detail`ありのnew recordの混在）は、週別実施回数・活動種別内訳（`ts`/`type`のみ使用）には影響しない。tier別内訳のみ、`detail`を持たないrecordを自然に除外する（捏造しない）。

---

## 10. Visualization choice

折れ線グラフを既定解にしない。比較した結果:

| 方式 | 採否 | 理由 |
|---|---|---|
| line chart | **不採用** | 連続的な「傾き」「トレンド」を暗示し、「上昇=改善」「下降=悪化」という誤読を誘発しやすい。既存`buildWeekChart`も棒グラフを選んでいる |
| **bar chart（週ごとの離散列）** | **採用（主）** | 週という離散単位に自然に対応し、「この週は何回あったか」という事実のみを示す。既存`buildWeekChart`の拡張として実装コストも低い |
| stacked / percentage stacked bar | 採用（tier内訳のみ、activity type別限定） | tierの内訳を示すのに適する。ただし%のみの単独表示はしない（§6 Option C） |
| simple counts（数値のみ） | 採用（グラフと併記） | Accessibilityのテキスト等価物として必須 |
| table | 採用（グラフと併記） | スクリーンリーダー・印刷での等価物として必須 |
| timeline | 不採用（今回は） | 個別record一覧は「詳しい記録を見る」の展開内で`buildDetailRecordList`パターンを再利用する形とし、主画面をtimeline形式にはしない（複雑化を避ける） |
| text summary | 採用（結果ヘッダーの説明文として） | 既存Wizard/Dashboardのトーンと一貫 |

**結論**: 「グラフ（棒）＋数値（表）＋実回答（詳細展開）」の3層構造（Phase指示§10の提案と一致）。

---

## 11. Accessibility contract

既存Donomana A11y基準（44pxタッチターゲット・focus-visible・reduced-motion対応・スイッチスキャン・screen reader対応）をそのまま踏襲する。

- 色だけで判別させない: 棒グラフの各週・tier内訳の各区分はアイコン＋テキストラベルを併記する（`INPUT_BADGE_LABEL`/`ACT_LABEL`の既存icon+textパターンを踏襲）。
- legend/labels: 各バーにaxis label（週の日付範囲）とvalue（件数）をテキストとして併置する（ツールチップのみに依存しない）。
- グラフのtext equivalent: 同じ数値を`<table>`または明示的なリストとして必ず併記する（§10）。
- screen reader: グラフ要素はdecorative（`aria-hidden`）とし、実データはテーブル/リスト側の semantic markup（native `<table>`や`<ul>`）で提供する。
- keyboard: 「4週間のふりかえり」ボタン・「詳しい記録を見る」トグルはnative `<button>`、`aria-expanded`同期（既存`buildDetailRecordList`のtoggleパターンをそのまま再利用）。
- switch: sst-appの既存Switch Scan戦略に準拠（`donomana-supporter-record-dashboard-design-v1_0.md`のDecision同様、native buttonのTab到達性で基本要件を満たす）。
- zoom / high contrast: 既存週次レポートの200%zoom対応パターンを踏襲。
- prefers-reduced-motion: 新規アニメーションを追加しない、または`@media (prefers-reduced-motion: reduce)`で無効化する。
- print/PDF: §14。
- iPad Safari: Real Device Gateで別途確認（本Phaseでは実施しない、CLAUDE.md §5）。

**必須要件**: グラフが読めなくても、同じ情報をテキストまたは表で取得できること。

---

## 12. Privacy contract

- 新規サーバーアップロード・アカウント・クラウドDB・外部analytics送信・外部chart serviceを導入しない。既存のlocal-first architectureを維持する（`terms.html:212`「学習記録はブラウザのローカルストレージに保存されます。端末外への自動送信はありません。」と一致させる）。
- グラフ描画はネイティブSVG/Canvasまたは既存`buildWeekChart`と同じ実装方式（外部chart libraryへのrecord送信を伴わないlocal rendering）を用いる。新規external dependencyを追加しない。
- `sst_diary_entries_v1`（きもち日記、自由記述・音声入力を含みうる）は既存のPrivacy境界通り、本機能から**絶対に参照しない**（`assets/js/record-dashboard-foundation.js`の既存コメント「絶対に参照しない」をそのまま継承）。
- custom Roleplay（`currentLv==='custom'`）は`detail`を持たないため、tier内訳の対象に自動的に含まれない（既存Privacy Decision 4の継承）。
- CSV/PDF出力時、自由入力フィールドが混入する経路は存在しない（SSTのdetail schemaは全てbuilt-in教材データのsnapshotであり、生徒の自由記述を含まない、§4）。

---

## 13. Privacy契約 — Student Identification（重要な制約）

SSTアプリの記録は**完全にdevice-levelであり、子ども個人を識別する仕組みを持たない**（`kyou-no-kiroku`のような`children[]`配列は存在しない、実コード確認）。これは`donomana-supporter-record-dashboard-design-v1_0.md`のDecision A「Device-level Dashboardを第一段階とする」という既存方針と完全に一致する既存の制約である。

**本Phaseの結論**: 「4週間のふりかえり」は常に「この端末でのSST利用」を対象とし、「この子どもの記録」ではない。複数の子どもが同じ端末を共有している場合、4週間のふりかえりは複数人の記録が混在したものになる。この制約を実装時のUI文言で正直に示す必要がある（例: 教師向けヘルプ文言で「複数のお子さんが同じ端末を使っている場合は、記録が混ざって表示されます」等の注記を検討）。**新たに氏名・生年月日等の個人情報入力を要求する設計は行わない。** 将来、共通Learner Profile Foundationが整備された場合（`donomana-supporter-record-dashboard-design-v1_0.md §25`の既存Future Candidate）に、SSTもそれに追従することを妨げない設計とする。本Phaseでは実装しない。

---

## 14. PDF / Sharing contract

現在の「今週のレポート」PDF保存（`window.print()` + `@media print`、§3.5）との統合を第一候補とする。新規PDFライブラリは導入しない。

- 将来像: 「4週間のふりかえり」セクションを`#report-card`内（または並列の印刷対象領域）に追加し、既存`@media print`ルール（可視性分離・A4サイズ・detail強制展開）をそのまま適用する。
- **新規検討事項**: 現在の印刷出力にはサイトクレジット行のみがあり、「診断・心理検査ではない」旨の注記が存在しない（§3.5）。教員間共有・ケース会議等の利用シーンを踏まえ、印刷/PDF出力のフッターへ以下のような注記を追加することを推奨する（文言は実装Phaseで確定）:

  > 「この記録はアプリ上での回答・利用状況を振り返るためのものであり、心理検査・診断・能力評価を行うものではありません。」

  既存の`.report-print-credit`と同様、背景色に依存しない文字色・控えめなサイズで、白黒印刷でも読めるようにする。
- グラフ（棒グラフ）は印刷時も崩れないよう、既存の`break-inside:avoid`パターン（`.report-week-chart`等に既に適用済み）を新セクションにも適用する。

---

## 15. Learning Records relationship

### 15.1 現状

`learning-records.html`（Common Learning Records、既にProduction稼働中）は、SSTを含む22 adapterを横断表示するread-only・device-level・local-onlyのTimeline UIである。ただしSSTのCommon Adapterは現状Level 1（`type`+`lv`のみ）に留まり、Level 2 detail統合（`docs/records/sst-common-record-detail-parity-audit-v1_0.md`）もmonthly/weekly集計機能も**いずれも未実装**（§3.7）。

### 15.2 本Phaseのスコープ判断

Phase指示§15に従い、Donomana全体の巨大dashboardは設計しない。**「4週間のふりかえり」はSST app-local機能として設計する**（`sst-app.html`内の「今週のレポート」拡張）。ただし、集計ロジック自体（週バケット化・tier内訳計算等）は、将来的に他のFoundationアプリ（なぞり・認知課題・選択課題・視線入力等）へ転用可能な形——具体的には、`activityLog`のような生の配列と週定義を受け取り、週別集計を返す**汎用関数**として設計し、SST固有の呼び出しコードとは分離しておくことを推奨する。これにより、将来「Reusable Trend Visualization Contract」として独立文書化する際の土台になるが、**実装対象は今回もSSTに限定**する。

### 15.3 Common Detail統合との関係

`docs/records/sst-common-record-detail-parity-audit-v1_0.md`（Draft）が定義するCommon Detail統合（Level 2 field表示）が先に実装されるか、本Phaseの「4週間のふりかえり」が先に実装されるかは、ユーザーの優先順位判断に委ねる。両者は独立した機能であり、互いの実装を前提としない（片方が未実装でも他方は成立する）。ただし、両方が実装された場合、`assets/js/sst-record-detail.js`の共有formatterパターンを4週間ふりかえりの集計ロジックにも適用できないか、実装Phase開始時に再評価することを推奨する。

---

## 16. Exact proposed UI wording

### 16.1 Wording Audit（使用予定文言のレビュー）

| 候補文言 | 判定 | 理由 |
|---|---|---|
| 成長しました / 成長 | **禁止** | 記録から自動断定しない（Non-goals §2） |
| 改善しました / 向上 | **禁止** | 同上 |
| 能力が上がりました / 能力 | **禁止** | 同上 |
| 心理状態が良くなりました | **禁止** | 同上 |
| ○○が身につきました | **禁止** | 同上 |
| 正解率 / 正答率 | **禁止** | tierは「教材内区分」であり正誤ではない（既存Contract §14.5の確定用語） |
| 月間成果 | **慎重** | 「成果」は評価的含意がある。不採用 |
| 成長グラフ / 能力グラフ | **禁止** | Non-goals §2 |
| 記録 / きろく | 推奨 | 既存サイト全体の統一語彙 |
| ふりかえり | 推奨 | 既存「今週のレポート」の文脈と一致 |
| 回答 / 選んだ回答 | 推奨 | 既存Record Detail Contract §14.5の確定用語 |
| 選択 | 推奨 | 同上 |
| 傾向 / 推移 | 推奨 | 事実の時系列的な変化を示すに留まる中立語 |
| 利用状況 | 推奨 | 中立的な事実表現 |
| 教材内区分 | 推奨（既存確定用語） | 「正解/不正解」を置き換える既存の確定語彙、そのまま踏襲 |
| 直近4週間 | 推奨 | §8の時間窓定義と一致する正確な表現（「1か月」は暦月と誤解されうるため避ける） |

### 16.2 確定候補名称

**「4週間のふりかえり」を正式名称の第一候補とする。**「1か月のふりかえり」は§8.2の理由（実際の時間窓は4週間=28日であり暦月ではない）により採用しない。「月間成果」「成長グラフ」「能力グラフ」は明確に不採用。

### 16.3 画面文言例（確定ではない、実装Phase起点案）

```
見出し: 4週間のふりかえり
説明文: 直近4週間の記録をまとめて振り返れます。

週ごとの活動回数
[棒グラフ] + [数値テーブル]

週ごとに取り組んだ活動
[活動種別アイコン + 回数、週ごと]

詳しい記録を見る（週ごとに展開）
→ 既存「くわしいきろく」と同じ折りたたみパターン

（教材内区分のある活動のみ）教材内区分の内訳
→ 活動タイプを選んで表示、複数タイプの合算はしない

注記: データの保存期間は30日です。最も古い週は一部の記録が
保存期間を過ぎている可能性があります。
```

---

## 17. Proposed UI structure

```
SST
↓
今週のレポート（既存、buildReport()、月曜起点の週次）
↓
[4週間のふりかえり]  ← 新規導線（既存のレポート画面内、または隣接するボタン）
↓
--------------------------------------------------------------
4週間のふりかえり

週ごとの活動回数
[棒グラフ: 4本、週ごと] [同内容の数値テーブル]

週ごとに取り組んだ活動
第1週（最新） ロールプレイ×3 ことばクイズ×2 ...
第2週         ...
第3週         ...
第4週         ...（保存期間の注記つき）

詳しい記録を見る
→ 週ごとに展開、既存buildDetailRecordList()パターンを再利用

（該当活動がある場合のみ）教材内区分の内訳
活動を選択: [ロールプレイ ▾]
  best: n件 / good: n件 / try: n件（週ごとの棒 or 表）

[4週間のふりかえりをPDFで保存]
--------------------------------------------------------------
```

これはPhase指示§16が示した骨子案と概ね一致するが、以下を実データ調査に基づき修正した: (1) 「回答した場面」という独立カウントは§6 Option Bの理由により削除、(2) tier内訳は活動タイプ別selectorを介した任意表示とし、既定では表示しない（データが薄い活動タイプでの誤解を避ける）。

---

## 18. Data transformation rules

1. **週バケット化**: 既存`getWeekRange()`と同じ月曜起点ロジックを4週分に拡張する。週の境界は`[月曜00:00:00.000, 日曜23:59:59.999]`。
2. **実施回数**: 各週バケットに属する`activityLog`要素数をそのままカウントする（フィルタ・重み付けなし）。
3. **活動種別内訳**: 週バケット内で`type`ごとにグループ化しカウントする（`buildActivityList`と同じロジック）。
4. **tier内訳（活動タイプ別）**: 選択したtype（例: `rp`）についてのみ、週バケット内の該当recordから`detail.selected.level`（`branch`の場合は`detail.ending.level`）を抽出し、tier値ごとにカウントする。`detail`が無いrecordはこの集計から除外する（捏造しない、§9）。**複数typeの値を合算しない**。
5. **欠落データの扱い**: 週バケットにrecordが0件の場合、そのまま「0件」として表示する（非表示にしない、§9）。4週目は保存期間の注記を常時併記する。
6. **既存recordの不変性**: 本機能はread-onlyの集計であり、`activityLog`・`sst_activity_log_v1`への書き込みを一切行わない。

---

## 19. Test strategy

実装Phase（`SST-MONTHLY-TREND-IMPLEMENTATION-1`）向けの最低限のテスト項目:

- no records（activityLog空）
- 1 record
- 同日複数record
- 4週間にまたがるrecord
- 記録が無い週がある（missing week）
- detailを持たないlegacy record
- 複数SSTアプリ（type）が混在
- 同一questionが繰り返し記録されている場合でも、Option D機能が存在しないことの確認（誤って実装されていないこと）
- 異なるquestionの記録
- malformed record（不正なJSON、必須field欠落）
- future timestamp（未来日時のrecord、システムクロックずれ等を想定）
- 日付境界（23:59:59.999→00:00:00.000の週またぎ）
- 週境界・保存期間境界（§8.3のエッジケース、4週目の部分欠落）
- PDF/印刷（4週間セクションを含めた`@media print`のレイアウト崩れ確認）
- iPad Safari（Real Device Gate、本Phaseでは実施しない、ユーザー確認待ち）
- keyboard操作（トグル・selector）
- switch scan到達性
- screen reader / text alternative（グラフの等価テーブル読み上げ確認）
- 既存「今週のレポート」回帰（新機能追加によるbuildReport()本体の非破壊確認）
- Learning Records回帰（`learning-records.html`・`record-dashboard-foundation.js`golden tests 816/816・ui-golden-tests 58/58の非破壊確認）
- SST golden tests（`tools/record-dashboard-poc/sst-common-detail-golden-tests.js`の非破壊確認）
- full golden regression（`tools/record-dashboard-poc/*golden-tests.js`全件、SST PDFテスト165/165含む）

---

## 20. Migration / backward compatibility

- **migrationは不要**。既存`activityLog`のrecordを書き換えない。既存recordへ後付けで擬似データ（tier内訳計算用のダミー`detail`等）を生成しない（`donomana-sst-record-detail-contract-v1_0.md §17`の既存原則「事実の捏造をしない」をそのまま継承）。
- `detail`を持たないlegacy recordは実施回数・活動種別内訳の集計には引き続き参加する（`ts`/`type`のみ使用するため影響を受けない）。tier内訳の対象からのみ自然に除外される。
- `schemaVersion`は既存の`1`のまま変更しない。新規top-level fieldの追加は本Phaseの集計機能では不要（既存fieldの読み取りのみで実現可能なため）。

---

## 21. Implementation scope（次Phase候補、本Phaseでは実装しない）

具体的な変更内容は§25（Implementation Plan Preview）を参照。

## 22. Explicit out-of-scope items

- Option D（同一scenario/question単位の回答推移） — 将来、個別scenario詳細ページからの拡張候補として記録するのみ
- 複数指標を合成した独自スコア（§7で明示的に禁止）
- サーバー同期・アカウント・クラウドDB
- 生徒個人識別（氏名等の新規入力）
- Donomana全体を横断する巨大trend dashboard（SSTに限定）
- カレンダー月・ユーザー指定期間での表示（v1は直近4週間固定）
- `sst_diary_entries_v1`（きもち日記）の参照
- custom Roleplayのtier内訳への算入（既存Privacy Decision 4の継承）
- import/restore機能（サイト全体に現状存在しない）
- Common Learning Records（`learning-records.html`）側の実装（Parity Audit Draftの別Phase判断に委ねる）

## 23. Risks

| リスク | 内容 | 対応方針 |
|---|---|---|
| 週境界×30日retentionのズレ | 4週目が閲覧日によって部分的に欠落しうる（§8.3） | 4週目には常時注記を表示 |
| tierの誤集計 | 3値/4値混在のtierをタイプ横断で合算すると意味が変わる | タイプ別限定・合算禁止を実装契約化（§18-4） |
| record粒度の不揃いによる誤解 | 「回答数」を単純合算すると活動タイプ間で意味が異なる | 「回答数」指標自体を不採用（§6 Option B） |
| 複数児童の端末共有 | Device-level集計のため複数人の記録が混在しうる | UI文言で明示、個人識別機能は追加しない（§13） |
| 「1か月」という呼称の誤解 | 実際は4週間=28日のローリングウィンドウ | 「4週間のふりかえり」という正確な名称を採用（§16.2） |
| 印刷レイアウト崩れ | 新セクション追加による既存`@media print`への影響 | `break-inside:avoid`パターンを新セクションにも適用（§14） |
| 診断的誤解 | PDF/画面表示が心理検査・診断結果と誤解される | 注記文言の追加を推奨（§14） |
| 既存機能への回帰 | `buildReport()`本体・Common Learning Records・Golden testsへの影響 | §19のテスト戦略で網羅 |

## 24. Open questions

本当にUser判断が必要なもののみ。

1. 「4週間のふりかえり」を既存「今週のレポート」画面内に統合するか、隣接する別セクション/別画面として設けるか（UI配置の好み、実装Phaseで実コードを見ながら決定することも可能）。
2. PDF診断免責文言（§14）を追加するかどうか、追加する場合の正確な文言。
3. tier内訳（Option C、§6）をv1スコープに含めるか、それとも週別実施回数・活動種別内訳（Option A+F）のみに絞ったより小さいv1とし、tier内訳は別Phaseへ回すか。

## 25. Recommended next Phase

`SST-MONTHLY-TREND-IMPLEMENTATION-1`に進める状態と判断する。ただし§24の Open Questions（特に3.のスコープ確定）について、実装開始前にUser判断を仰ぐことを推奨する。

### Implementation Plan Preview（現時点のコード調査に基づく変更候補ファイル）

| File | Why needed | Expected change | Risk |
|---|---|---|---|
| `sst-app.html` | 「4週間のふりかえり」のUI・集計ロジックの主たる実装場所。既存`buildReport()`/`buildWeekChart()`/`buildActivityList()`/`buildDetailRecordList()`と同じ設計パターンを拡張する | 新規関数（週バケット化の4週拡張、棒グラフ描画、activity別内訳、tier内訳drilldown）追加、既存「今週のレポート」画面への導線追加 | 中（9,900行超の既存ファイルへの追加、既存`buildReport()`との非干渉を慎重に検証する必要がある） |
| `sst-app.html`（`@media print`ブロック） | PDF/印刷時に新セクションを正しく表示するため | 既存`break-inside:avoid`等のパターンを新セクションへ適用、任意で診断免責文言追加 | 低（既存パターンの再利用） |
| `tools/sst-weekly-report-pdf/` 配下の新規または既存テストファイル | §19のテスト戦略を実装するため | 新規Node/Playwrightテストの追加、または既存`pdf-print-implementation-test.js`の拡張 | 低 |
| `assets/js/sst-record-detail.js`（検討） | tier内訳表示時、既存の型別ラベル（`ACT_LABEL`相当）や表示ロジックを再利用できないか評価 | 変更なし、または小規模な集計helper追加 | 低（既存ファイルの責務を壊さないよう慎重に判断） |
| `docs/design-system/donomana-sst-record-detail-contract-v1_0.md` / `-expansion-plan-v1_0.md`（検討） | 本設計が既存Contractと矛盾しないことを確認した相互参照の追記（必須ではない） | 変更不要の可能性が高い（新規field追加を伴わないため） | 低 |

本Phaseではこれらのファイルを一切変更していない。

---

## 26. Definition of Done（本Design Phase自体）

- [x] `origin/main`最新確認・Drift Gate実施（§0.1）
- [x] CLAUDE.md全文確認・Governance遵守
- [x] SST record schema実コード確認（§3.2、§4）
- [x] 今週のレポート実装確認（§3.3）
- [x] Retention実コード確認（§3.4、30日ローリングウィンドウ）
- [x] PDF実装確認（§3.5）
- [x] Learning Record Foundation確認（§3.6）
- [x] Common Learning Records統合状況確認（§3.7）
- [x] Data sufficiency audit（§5）
- [x] Candidate metrics比較（§6）
- [x] Rejected metrics明示（§7）
- [x] Time window設計・エッジケース明示（§8）
- [x] Sparse data設計（§9）
- [x] Visualization choice（§10、折れ線グラフを既定にしない）
- [x] Accessibility contract（§11）
- [x] Privacy contract（§12-13）
- [x] PDF/Sharing contract（§14）
- [x] Learning Records relationship（§15）
- [x] Wording audit・UI文言案（§16-17）
- [x] Data transformation rules（§18）
- [x] Test strategy（§19）
- [x] Migration/backward compatibility（§20）
- [x] Implementation scope・Out-of-scope明示（§21-22）
- [x] Risk Register（§23）
- [x] Open questions（§24、必要なもののみ）
- [x] Implementation Plan Preview（§25）
- [x] Docs only（Production機能コード変更 0件）
- [x] push/merge/deployなし
