# どのまな SST Monthly Trend Design Contract（Version 1.0）

- **Status: FINAL DESIGN CONTRACT v1.0**
- **Implementation: NOT STARTED**
- Phase: `SST-MONTHLY-TREND-DESIGN-FINALIZE-1`（前Phase `SST-MONTHLY-TREND-DESIGN-1` の設計方向を維持しつつ、未決事項・記述不整合を解消して確定）
- 発行: 2026年10月
- Production baseline: `origin/main = 87b7d1f63b197401992d0122caba445e446350c3`（前Phase・本Phaseとも同一、drift 0。詳細は§0.1）
- Branch: `feature/sst-monthly-trend-design-finalize-1`
- 位置づけ: 本文書は`donomana-sst-record-detail-contract-v1_0.md`（SST Record Detail v1、Production Released）・`donomana-sst-record-detail-expansion-plan-v1_0.md`（Wave 1/2拡張、Production Released）・`donomana-learning-record-standard-v1_0.md`（Foundation標準）・`donomana-supporter-record-dashboard-design-v1_0.md`（横断Dashboard設計）を継承する。いずれの既存契約も置き換えない。本文書は前Phase（`SST-MONTHLY-TREND-DESIGN-1`、checkpoint `1005f51`）の同名文書を直接引き継ぎ、同じファイルを更新・確定したものである。
- 契機: 実ユーザーから「今週のレポート」の教員間共有のしやすさを評価する声とともに、学校での個別相談・集団認知行動療法の場面・こども若者相談支援等、学校の授業に限らない複数の文脈での活用報告が届いた。本Phaseはこれらの利用報告を機能の存在根拠として扱うが、臨床的有効性の主張や治療・診断機能への拡張は行わない（§2）。
- 変更ファイル: 本ドキュメントのみ。`sst-app.html`・`assets/js/sst-record-detail.js`・`assets/js/record-dashboard-foundation.js`・`generate.js`・`apps-data.json`・Foundation API・localStorage schemaのいずれも本Phaseで変更していない（Production機能コード変更 0件）。

---

## 0. 関連文書（Source of Truth）

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | Core Schema・Storage・Foundation API・Privacy原則の正本 |
| `donomana-sst-record-detail-contract-v1_0.md` | SST Record Detail v1（Production Released）。本契約が前提とするSST record/detail schemaの正本 |
| `donomana-sst-record-detail-expansion-plan-v1_0.md` | Wave 1/2拡張（Production Released） |
| `docs/records/sst-common-record-detail-parity-audit-v1_0.md` | SSTのCommon Learning Records統合Audit。**本Phaseで実装状態と記述が食い違っていることを確認した（§3.7で解消）** |
| `donomana-supporter-record-dashboard-design-v1_0.md` | 横断Learning Records Dashboard（`learning-records.html`）の設計文書 |

### 0.1 Drift Gate 実施結果（本Phase開始時）

`git fetch origin`後、`origin/main = 87b7d1f63b197401992d0122caba445e446350c3`を確認した。前Phase（`SST-MONTHLY-TREND-DESIGN-1`）報告のbaseline・前Phase checkpoint `1005f51`の親と完全に一致しており、**drift 0**。SST・Learning Record Foundation・PDF・関連設計文書への変更は本Phase開始時点で確認されていない。

### 0.2 Source Design Checkpoint 確認・引き継ぎ方法

前Phase報告の通り、checkpoint `1005f516fc1863a5eb3c0b18a3bb1946e25bc988`（branch `feature/sst-monthly-trend-design-1`、ローカルcommitのみ・remote未push）の存在を確認した。

- `git cat-file -t 1005f516fc1863a5eb3c0b18a3bb1946e25bc988` → `commit`（存在確認）
- 親commit: `87b7d1f63b197401992d0122caba445e446350c3`（＝現在のorigin/main、drift 0を再確認）
- 変更ファイル: `docs/design-system/donomana-sst-monthly-trend-design-contract-v1_0.md`のみ、570行追加（他ファイルへの変更なし）

**引き継ぎ方法**: 本Phase専用branch（`feature/sst-monthly-trend-design-finalize-1`、`origin/main`から新規作成）上で、`git cherry-pick 1005f516fc1863a5eb3c0b18a3bb1946e25bc988`を実行した。両branchの親が共に`origin/main`と一致するため、cherry-pickはconflict無く適用され、前Phaseのcommitメッセージ・内容をそのまま引き継いだ（commit `3f0143a`）。他Phase（`feature/sst-monthly-trend-design-1`自体を含む）のworktree・branchは一切変更していない。本Phaseでは、この引き継いだ単一ファイルを本Phase branch上でさらに更新・確定する。

---

## 1. Purpose

SSTアプリ群（`sst-app.html`、12活動type）の既存記録を基盤に、教員・支援者が**直近4週間**の活動記録・回答傾向を振り返れる機能を正式設計する。目的は「保存された活動と回答を、時間の流れに沿って振り返りやすく整理すること」であり、「子どもを数値で評価すること」ではない。Donomanaはデータを整理して提示するに留め、意味の解釈は教員・支援者が行う。

利用報告には、学校の授業だけでなく、個別相談・集団認知行動療法の場面・こども若者相談支援での活用が含まれる。本設計はこれらの文脈を排除しない表現を用いるが、これらの利用報告を根拠に臨床的有効性を主張したり、治療・診断機能へ拡張したりはしない（§2）。

## 2. Non-goals

- 心理アセスメント・心理検査・診断・能力評価・SST能力スコア・成長スコアの提供
- 回答や件数だけから、心理状態・社会性・能力・成長・改善・行動変容・支援/治療の効果を断定すること
- 複数recordを重み付けした独自の複合スコア（SST Score、社会性スコア、成長度・改善度の自動算出）の算出
- tierの平均点化、アプリ横断の正答率や能力ランキング
- best=3/good=2/try=1等の採点
- 生徒氏名・出席番号等の新規個人情報入力を要求する生徒識別の仕組み
- サーバーアップロード・アカウント必須化・クラウドDB・外部analyticsへの送信・外部chart serviceの導入
- Donomana全体を横断する巨大trend dashboardの設計（SSTに限定する）
- 本Phaseでのコード実装・push・merge・deploy

---

## 3. Existing architecture findings（実コード調査結果、本Phaseで追加検証済み）

### 3.1 SSTアプリ構成・Record Schema（前Phase確認分、再確認済み）

`sst-app.html`の`recordActivity(type, lv, result, detail)`（6822-6835行）が唯一のwrite path。`ACT_LABEL`に定義される12 type（`rp/wq/story/branch/diary/quiz/thermo/breath/photo/emotion/phrase`）全ての呼び出し箇所を本Phaseで実コード確認した（§7）。Storageは`sst_activity_log_v1`、共有I/Oプリミティブ`donomanaRecordReadLog`/`donomanaRecordWriteLog`経由。

### 3.2 活動種別ごとの記録単位（本Phaseで新規に全12 type実コード確認、§7で詳述）

前Phaseでは「回答数」の粒度不揃いのみ指摘していたが、本Phaseで「活動回数」自体にも同種の粒度の違いがあることを確認した（§7）。要点: ロールプレイ/きもちカード/写真で練習/きもち温度計/フレーズ集/きもちを落ち着ける/きもち日記は**1アクション=1record**（即時commit）。ことばクイズ/SSTクイズは**1セッション全体（全問完了）=1record**（内部にdetail.answers[]で複数設問を保持）。ソーシャルストーリーは**最終ページ到達=1record**（埋め込み質問0〜N件を内包）。分岐ストーリーは**1エンディング到達=1record**（選択経路全体を内包）。詳細は§7の表を参照。

### 3.3 週境界・timezone（本Phaseで実コード再確認、固定ミリ秒演算の妥当性を精査）

```js
// sst-app.html:6853-6870
function getWeekKey(d){
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1); // 月曜に合わせる
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().slice(0,10);
}
function getWeekRange(){
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day===0?6:day-1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  return { mon, sun, label: `${fmt(mon)}（月）〜 ${fmt(sun)}（日）` };
}
// buildReport():
const startTs = mon.setHours(0,0,0,0);
const endTs   = new Date(sun).setHours(23,59,59,999);
const weekLog = activityLog.filter(a => a.ts >= startTs && a.ts <= endTs);
```

確認した事実:
- **基準はブラウザのローカル端末時刻**（`new Date()`、`getDay()`/`getDate()`はいずれもlocal time methods）。UTC基準ではない。
- 週境界は`Date.prototype.setDate()`/`setHours()`という**暦対応（calendar-aware）演算**で算出されており、月またぎ・年またぎ・（ブラウザのDate実装に委ねられる）夏時間境界も正しく処理される設計になっている。**固定ミリ秒の加減算（`Date.now() - N*24*60*60*1000`）ではない。**
- 境界timestampは**両端とも包含**（`>=`と`<=`）。
- `buildReport()`内で`new Date()`は複数箇所（`getWeekRange()`内・`report-gen-date`表示・`getWeekKey(new Date())`によるバッジ判定）で**都度個別に呼ばれており、「今」を1回だけ取得して使い回す設計にはなっていない**（実害は小さいが、本Phaseの新規集計では§9.1でこれを改善する）。
- 無効timestamp・未来timestampに対する明示的なvalidationは存在しない。`a.ts >= startTs && a.ts <= endTs`という数値比較のみであり、`NaN`は常にfalseとなり自然に除外されるが、「除外された」こと自体を利用者へ知らせる仕組みはない。

### 3.4 30日retentionの正確な挙動（本Phaseでload/save双方を再確認）

```js
// sst-app.html:6797-6811
function loadActivityLog(){
  activityLog = donomanaRecordReadLog(ACTIVITY_LOG_KEY);   // pruneしない
  ...
}
function saveActivityLog(){
  const limit = Date.now() - 30*24*60*60*1000;             // pruneはここのみ
  activityLog = activityLog.filter(a=>a.ts > limit);
  return donomanaRecordWriteLog(ACTIVITY_LOG_KEY, activityLog);
}
```

- **pruneは`saveActivityLog()`時にのみ実行される。`loadActivityLog()`（読み込み時）はpruneしない。** したがって、最後に新しい活動が記録されてから何日経っていても、次に何か記録される（＝次に`saveActivityLog()`が呼ばれる）までは、30日を超えたrecordが一時的にstorageへ残り続ける可能性がある。
- 件数上限（count-based cap）は存在しない。30日という時間条件のみ。
- `donomanaRecordReadLog()`（3.6節参照）はこの時間条件そのものに依存するのではなく、都度の`saveActivityLog()`呼び出しタイミングに依存するため、**「保存期間内であっても全活動が保存されていることを保証する」仕様ではない**（§10）。
- 4週間のふりかえり機能はread-only（本Phase・次Implementation Phaseとも`saveActivityLog()`を呼ばない設計とする）。表示そのものが新たなpruneを引き起こすことはない。

### 3.5 Storage読込失敗の扱い（本Phaseで新規確認、重要な制約）

```js
// sst-app.html:3853-3860
function donomanaRecordReadLog(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
```

**重要な制約（本Phaseの新規発見）**: `donomanaRecordReadLog()`は、「キー自体が存在しない（＝一度も使っていない）」場合と「キーは存在するがJSON破損・配列以外」の場合を**区別せず、どちらも同じ`[]`を返す**。呼び出し元（`loadActivityLog()`）はこの違いを知る手段を持たない。これは既存Foundation API自体の設計であり、本Phaseはこれを変更しない（Foundation API変更は許可されたファイルの範囲外）。

この制約は§11（記録なし・不明の扱い）の設計に直接影響する。「記録なし」と「読み込めない」を利用者に区別して示すためには、**新規集計ロジック内でのみ**、共有プリミティブに依存しない最小限の読み込み確認を別途行う必要がある（既存`donomanaRecordReadLog()`/`loadActivityLog()`自体は変更しない、§11.2で詳述）。

### 3.6 PDF / 印刷（前Phース確認分、再確認し画面構造と合わせて精査）

`window.print()` + `@media print` CSSのみ、外部ライブラリなし。印刷対象は`#report-card`に限定する可視性分離パターン（`body *{visibility:hidden} #report-card,#report-card *{visibility:visible}`）。本Phaseで確認した追加事実（§13で活用）:

- `.scr{display:none} .scr.on{display:block}`（`sst-app.html:167-168`）という画面切替の仕組みにより、非activeな画面は印刷時にも`display:none`のまま（`visibility`の上書きより先に`display:none`が効くため表示されない）。これにより、新しい画面を追加しても、その画面が非activeな間は印刷対象から自然に除外される。
- `break-inside:avoid`は`.report-summary`等の個別ブロック単位に適用されており、`#report-card`全体には適用されていない（長大な1カードを無理に1ページへ収めようとしない、自然な改ページに委ねる既存方針）。

### 3.7 Common Learning Records（`learning-records.html`）とSSTの統合状況 — 不整合の解消（最重要）

前Phaseの調査途中段階と最終報告で異なる記述があった点を、本Phaseで実コードを直接追い、**A（文書）/B（コードの存在）/C（Production UIからの実際の利用可否）を分離して確認した**。

**A. 設計文書に書かれていること**: `docs/records/sst-common-record-detail-parity-audit-v1_0.md`は「Draft、User Approval待ち」「Parity Status: **SUMMARY ONLY（実装Phase未着手）**」と明記している。

**B. formatter等のコードが存在すること**: 実コードを確認したところ、`assets/js/record-dashboard-foundation.js`のSST adapter（935-989行）には、Parity Audit文書が「未着手」としていたはずの`getDetails`・`getCsvActions`が**既に実装済みで存在する**:

```js
// assets/js/record-dashboard-foundation.js:961-988
// Level 2: Detail Parity(SST-COMMON-RECORD-DETAIL-INTEGRATION-1、
// Cross-App Detail Contract §8.1)。実体はassets/js/sst-record-detail.js
// (App-localの「くわしいきろく」と共有、重複実装禁止)。
getDetails: function (e) {
  return (typeof donomanaSstRecordDetail !== 'undefined') ? donomanaSstRecordDetail.getDetailRows(e) : [];
},
getCsvActions: function () {
  if (typeof donomanaSstRecordDetail === 'undefined') return [];
  var D = donomanaSstRecordDetail;
  return [{
    id: 'detail', label: '📄 くわしいきろくをCSVで保存',
    filenamePrefix: 'sst-kiroku-kuwashii',
    buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords, SST_ACT_LABEL); },
    disabled: function (rawRecords) { return !(rawRecords||[]).some(r => D.isValidDetail(r && r.detail)); }
  }];
}
```

コード自身のコメントが`SST-COMMON-RECORD-DETAIL-INTEGRATION-1`という、Parity Audit文書（Draft）の§19「次Phase」が参照していた実装Phase名をそのまま名乗っている。つまり、**Parity Audit文書がDraftとして計画した実装は、その後の別Phaseで実際に実施・Production Releaseされたが、Parity Audit文書自体はその後更新されていない（stale documentation）**。

**C. Production UIから利用できること**: `learning-records.html`の`openDetailModal()`（599-654行）は、record一覧で1件をクリックした際、**どのappIdであっても汎用的に**`FOUNDATION.getRecordDetails(record.appId, rawRecord)`・`FOUNDATION.getCsvActions(record.appId)`を呼び出し、返り値があればそれを表示・CSVボタンとして描画する仕組みになっている（アプリごとの分岐コードは無い）。SSTのadapterが（B）の通り両関数を提供するため、**実際にSSTのrecordを`learning-records.html`で開くと、Level 2 detail（場面・提示された選択肢・選んだ回答・教材内区分等）と「くわしいきろくをCSVで保存」ボタンが表示される**ことを、コードの実装連鎖として確認した（実ブラウザでのクリック確認は本Phase=docs-onlyのscope外だが、コード上の呼び出し経路は完全に一致しており、未接続・デッドコードの兆候はない）。

**結論（本文書・最終報告で統一する記述）**: SSTのCommon Learning Records統合は、**Level 2 detail・CSV Parityとも実装済み・Production Released**である。`docs/records/sst-common-record-detail-parity-audit-v1_0.md`の「Draft / SUMMARY ONLY」という記述は古い（stale）。この文書自体の更新は許可されたファイル（本文書のみ）の範囲外のため本Phaseでは行わないが、本Phaseの成果物としてこの事実を明記し、将来的に当該文書のステータスを更新するPhaseが必要であることを分離した事実として記録する（§23 Out of scope）。

**一方、月次/週次のtrend・集計機能は`learning-records.html`に一切存在しない**（`groupByDate()`のみ、日付単位のgroupingに限られる。「月間」「monthly」「weekly」のgrouping関連コードはリポジトリ全体で0件、本Phaseで再grep確認済み）。この点についての前Phaseの結論は変更ない。

---

## 4. Current SST record schema

```js
// legacy (detailなし: photo/thermo/diary、custom RP)
{ ts: 1757659200000, type: 'rp', lv: 'custom', result: 'best', schemaVersion: 1 }

// detail付き（例: roleplay_choice、built-inのみ）
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

「教材内区分」（level/tier）は活動により3値（best/good/try）または4値（best/good/support/try、SSTクイズのみ）。数値化・平均化・集計するコードは一切存在しない（既存コードコメントが「不正解集計をしないこと」と明示的に警告、§3.2の前Phェーズ発見を再確認済み）。

---

## 5. Data sufficiency audit

（前Phaseの分析を維持。要約のみ再掲、詳細は§7の新規per-type表を参照）

週別の活動記録件数・活動種別内訳は12 type全てで安全に算出可能（`ts`/`type`のみで足りる）。tier別内訳は8 detail-type・活動タイプ別限定でのみ安全（3値/4値混在のため横断合算不可、v1では不採用、§6）。同一scenario/question単位の回答推移は安定IDを持つtypeが限定的かつ再実施頻度が低く小サンプル問題が大きいため、v1のscopeには含めない。

---

## 6. v1 Scope（確定）

### 6.1 v1に含めるもの

- 週別の活動記録件数（§7で定義確定）
- 活動種別の内訳（週ごと、既存`buildActivityList()`パターンの4週拡張）
- 対象期間の既存回答詳細への導線（既存「くわしいきろく」＝`buildDetailRecordList()`パターンを週ごとに展開する形で再利用）
- グラフと同じ情報を確認できる数値表（§14）
- 既存方式（`window.print()` + `@media print`）に沿った印刷／PDF保存（§17）

既存回答詳細に含まれるtierやfeedbackを、既存formatter（`sst-record-detail.js`の`getDetailRows()`相当）の仕様に従ってそのまま個別recordの詳細として表示することは、**tier集計の追加ではない**（個別recordの中身をそのまま見せることと、複数recordのtierを集計・グラフ化することは別物として区別する）。前者はv1に含む。後者（tier別割合のグラフ・集計）はv1から除外する。

### 6.2 v1から外すもの（将来候補として分離、本Phaseでは設計しない）

- tier別割合／内訳のグラフ・集計（活動タイプ別であっても、本Phaseではグラフ化・集計表示そのものを見送る。個別record詳細内でのtier表示＝§6.1は含む）
- 同一scenario/questionの選択変化グラフ
- 独立した「回答数」指標（§7の通り、活動記録件数で代替）
- 個人識別・生徒別プロフィール
- 共通Dashboard（`learning-records.html`）側への機能追加
- record schema変更
- 保存期間（30日retention）の変更
- サーバー・アカウント・cloud DB導入

これらはv1の必須要件には混在させない。将来候補として§24に分離して記録する。

---

## 7. 「活動記録件数」の定義（確定）

### 7.1 12活動typeの記録単位（実コード確認、本Phase新規調査）

| # | 正式名 | `type` | 保存タイミング（実コード根拠） | 1 recordが表す単位 | 粒度の違い | 中断・再試行の扱い | 重複記録の既存仕様 | 集計対象 |
|---|---|---|---|---|---|---|---|---|
| 1 | ロールプレイ（built-in/custom） | `rp` | `answerRP()`、選択肢確定の瞬間（`sst-app.html:5747`） | 1回の選択確定 | 単一選択＝1record | 選択前に離脱すれば記録なし（0件） | 同じ場面を再度選べば新規recordが別途生成される（既存に重複排除なし） | ○ |
| 2 | ことばクイズ | `wq` | `buildWordQuiz()`、`currentWQIdx>=qs.length`到達時のみ（`sst-app.html:5762-5773`） | **1セッション（全問完了）＝1record** | 複数設問の回答は`detail.answers[]`に内包、recordとしては1件 | 途中離脱は記録なし。「もう一度」は accumulator が再初期化され、新たな完了で別recordが生成される | 完了のたびに新規record（既存に重複排除なし） | ○ |
| 3 | ソーシャルストーリー | `story` | `storyNav()`、最終ページ到達時（`sst-app.html:9088-9093`、`currentStoryPage===total-1`） | 1回の最終ページ到達＝1record | 埋め込み質問の回答は`detail.answers[]`、0件（質問なしページのみ）もありうる | 最終ページ到達前の離脱は記録なし | 最終ページから一度戻って再度最終ページへ進むと、既存ロジック上は再度recordが生成されうる（既存に重複排除なし、本Phaseで新規発見） | ○ |
| 4 | 分岐ストーリー | `branch` | エンディング到達時（`sst-app.html:9199-9209`） | 1エンディング到達＝1record | 選択経路全体が`detail.route[]`に内包、recordは1件 | エンディング到達前の離脱は記録なし | 「別の道を試す」で再プレイし別エンディングへ到達すれば新規record（既存に重複排除なし） | ○ |
| 5 | きもち日記 | `diary` | 日記保存時（`sst-app.html:8781`） | 1回の日記保存＝1record | `activityLog`側には選んだ気持ち名の結合文字列のみ（`result`）。自由記述本文は別storage（`sst_diary_entries_v1`）にあり本機能は一切参照しない | — | 保存のたびに新規record | ○（件数のみ。自由記述内容は参照しない、§15） |
| 6 | SSTクイズ | `quiz` | `showQuizFin()`、全問完了時（`sst-app.html:6105-6119`） | **1セッション（全問完了）＝1record**（wqと同型） | wqと同型 | wqと同型 | wqと同型 | ○ |
| 7 | きもち温度計 | `thermo` | スライダー確定時（`sst-app.html:9684-9691`） | 1回の記録確定＝1record | 単一値のみ、選択肢概念なし | — | 確定のたびに新規record | ○（件数のみ） |
| 8 | きもちを落ち着ける（呼吸） | `breath` | 画面表示1秒後に自動（`sst-app.html:5534`） | **選択を伴わない唯一のtype**。画面を1秒以上開いた＝1record | — | 1秒未満で離脱すれば記録なし | 再訪問のたびに新規record | ○ |
| 9 | 写真で練習 | `photo` | 選択肢確定時（`sst-app.html:8599`） | 1回の選択確定＝1record | detail無し（Privacy Deferred、既存Decision） | 中断時は記録なし | 再プレイで新規record | ○ |
| 10 | きもちカード | `emotion` | カード選択時（`sst-app.html:5636`） | 1回の選択＝1record | — | — | 再選択で新規record | ○ |
| 11 | フレーズ集 | `phrase` | 読み上げ実行時／コピー実行時、**2つの独立トリガー**（`sst-app.html:9326,9330`） | 1回の実行（spoken または copied）＝1record | 同じフレーズを読み上げ→コピーの両方行うと**2 record** | 閲覧のみは記録なし（既存の意図的設計） | 実行のたびに新規record | ○ |

### 7.2 定義（確定文言）

**表示名は「活動記録の件数」とする。**

説明文（確定）:

> 「活動記録の件数」は、対象期間に保存された記録（record）の数です。1つの記録は、アプリ内のひとつの活動の区切り（選択肢を選んだ、クイズを最後まで終えた、物語を最後まで読んだ、など）を表します。授業の回数・相談の回数・利用した人数を示すものではなく、必ずしも「回答した数」そのものと一致するわけでもありません（1つのクイズに複数の設問が含まれていても、記録としては1件です）。

### 7.3 重複排除ポリシー（確定: 新規ルールを導入しない）

**新しい重複排除ルールは導入しない。** 対象期間内の`activityLog`の各要素を、保存されたとおりに1件として数える。

根拠: `recordActivity()`・`buildReport()`を含め、既存コードのどこにも「同一セッション・同一scenarioの再実行を1件にまとめる」ロジックは存在しない（本Phaseのgrep・読解で確認）。同じロールプレイ場面を3回選べば3 record、同じクイズを2回完了すれば2 recordが既存の仕様として生成される。これは「活動に複数回取り組んだ」という事実そのものであり、本Phaseが新たに意味付けを変える理由はない。異なる粒度のrecord（1選択＝1recordのtypeと、1セッション全体＝1recordのtype）を合算した数値は、「活動量」や「学習成果」の比較指標としては扱わない（§2 Non-goals）。

---

## 8. Rejected metrics（Do NOT Invent a Composite Score、前Phaseから継続）

- SST Score / 総合点、Social Skill % / 社会性スコア、成長度・改善度の自動断定、best=3/good=2/try=1式の機械的採点、tierの平均点、アプリ横断の正答率・能力ランキング — いずれも不採用（理由は§2・前Phェーズ§7と同一、`tierOf()`周辺の既存コードコメントが「不正解集計をしないこと」と明示的に警告していることを根拠として維持）。
- 「回答数」を独立指標として使うこと — §7.1の通りrecord粒度が不揃いのため不採用。「活動記録件数」（§7.2）で代替する。
- tier別割合・内訳のグラフ化 — v1から除外（§6.2）。個別recordのtier表示（既存detail表示の範囲内）とは区別する。

---

## 9. Time-window definition（確定）

### 9.1 期間定義

**「今週を含む、月曜起点の4週間」を採用する。**

- 「今週」は既存`getWeekRange()`と同一のロジックで定義する: 今週の月曜00:00:00.000（ローカル端末時刻）〜 今週の日曜23:59:59.999（同）。
- 4週間の範囲は、今週の月曜から**3週前（21日前）の月曜00:00:00.000**から、**表示時点を含む今週の日曜23:59:59.999**までとする。
- 境界timestampは両端とも**包含**（`>=`と`<=`）、既存`buildReport()`と同じ規約。
- 週は**古い週から今週の順**に並べる（第1週＝最も古い、第4週＝今週）。
- **今週（第4週）は「集計中」であることを画面上で明示する**（例: 週ラベルに「（今週・集計中）」を付記）。日曜日より前に表示した場合、その週の件数は週の途中までの値である。
- 各週は、既存`getWeekRange()`の`label`と同じ書式（`M/D（月）〜 M/D（日）`）で具体的な日付範囲を表示する。
- 月またぎ・年またぎは、既存`getWeekRange()`/`getWeekKey()`と同じ`Date.prototype.setDate()`による暦対応演算で処理する（下記9.3）。

### 9.2 Timezone

既存`getWeekRange()`/`getWeekKey()`と同じ基準（ブラウザのローカル端末時刻、`new Date()`のlocal time methods）をそのまま踏襲する。UTC基準には変更しない。既存週次レポートとの整合を最優先する。

### 9.3 固定ミリ秒演算の妥当性（確定: 使用しない）

週境界の算出には、**`Date.now() - N*24*60*60*1000`のような固定ミリ秒の加減算を使用しない**。理由: 固定ミリ秒演算は夏時間（DST）境界をまたぐ場合に実時刻のズレを生みうる。既存`getWeekRange()`/`getWeekKey()`が採用している`Date.prototype.setDate()`ベースの暦対応演算（カレンダー単位での加減算、ブラウザのDate実装がDST等を内部的に吸収する）をそのまま4週間に拡張する。具体的には、今週の月曜Dateオブジェクトに対し`mon.setDate(mon.getDate() - 21)`のように暦日単位で遡る方式を採る。

（注: 既存の30日retentionフィルタ自体は固定ミリ秒演算（`Date.now() - 30*24*60*60*1000`）を使用しているが、これは既存の別メカニズムであり、本Phaseでは変更しない。本節の決定は新規に追加する週境界の算出ロジックにのみ適用する。）

### 9.4 「今」を1回だけ取得する

既存`buildReport()`は`new Date()`を複数箇所で個別に呼んでいる（§3.3）。新規の4週間集計関数では、**関数の冒頭で`const now = new Date();`を1回だけ取得し、週境界・今週判定・表示用の生成時刻表示まで全てこの1つの値から算出する**ことを確定する。これにより、集計処理の実行中に日付が変わる（深夜0時をまたぐ）ようなごく稀なケースでも、集計内で矛盾した境界が使われることを防ぐ。既存`buildReport()`自体の複数回呼び出しパターンは、本Phaseでは変更しない（既存の「今週のレポート」機能への回帰リスクを避けるため）。

### 9.5 無効・未来timestampの扱い

既存コードには無効timestamp・未来timestampへの明示的なvalidationが無い（§3.3）。本機能では以下を新規に確定する:

- `a.ts`が有限の数値でない（`NaN`、`undefined`、非数値）record、または4週間の範囲（最古の週の月曜00:00:00.000より前〜今週の日曜23:59:59.999より後）に収まらない未来timestampのrecordは、**どの週にも割り当てず、別枠の「期間を判定できない記録」として明示的にカウントする**（黙って除外しない、§11）。
- 同じ週の範囲内に収まる軽微な時刻のずれ（デバイスの時計が数時間ずれている等）は、そのまま該当週の記録として扱う（実害が無いため特別扱いしない）。

### 9.6 表示更新・再表示時の再計算

画面を開くたび、または表示を更新するたびに、§9.4の「今」の取得から週境界の算出までを**毎回新しく計算し直す**。前回表示時の境界をキャッシュして再利用しない（日付が変わった後に古い境界で表示され続けることを防ぐ）。

### 9.7 名称の統一

「1か月」「過去28日」「過去30日」「直近4週間」を同義として扱わない。UI名称は**「4週間のふりかえり」**を基本とする（§19）。

---

## 10. 30日保持との関係（確定）

- pruneは`saveActivityLog()`時にのみ実行され、`loadActivityLog()`（読み込み）は実行しない（§3.4）。
- 4週間のふりかえり機能はread-only専用の新規集計関数として設計し、**`saveActivityLog()`を一切呼ばない**。本機能の表示が新たなpruneを引き起こすことはない。
- 4週間の範囲（28日）は30日のretentionに収まるが、§3.4の通りpruneのタイミングは「次の活動記録時」に依存するため、**「保存期間内であれば必ず全ての活動が残っている」ことは保証しない**。説明文（§19）にこの限界を含める。
- 保持期間（30日）自体は本Phaseで変更しない。

---

## 11. 記録なし・不明・読込失敗の扱い（確定）

### 11.1 状態ごとの表示・集計・詳細・PDF方針

| # | 状態 | 画面表示 | 集計への算入 | 詳細展開 | PDF |
|---|---|---|---|---|---|
| 1 | 対象期間に有効なrecordがある | 通常表示（件数・内訳） | 通常算入 | 通常表示 | 通常印刷 |
| 2 | 4週間全体でrecordが1件もない | 中立的な文言（例:「この4週間の記録はまだありません」）。グラフは全週0、「活動が無かった」旨であり能力の欠如ではないことを文脈で示す | 件数0として表示 | セクション自体を簡潔な空状態表示に置き換える（既存`buildActivityList()`の「今週のきろくがないよ。いろんな活動をやってみよう！」と同系統のトーン） | 同じ文言をそのまま印刷 |
| 3 | ある週だけrecordがない | その週のみ「記録なし」、他の週は通常表示（既存`buildWeekChart()`の0件日の表現＝空欄ラベル+最小バーを週単位に拡張） | その週は0、他週は通常 | その週の展開は「この週の記録はありません」 | 同上 |
| 4 | `ts`/`type`は有効だが`detail`がないlegacy record（`photo`/`thermo`/`diary`、custom RP等） | 件数・曜日・活動種別には通常どおり算入 | 算入する | 詳細展開には出さない（`detail`が無いため、捏造しない） | 件数には含むが詳細欄は空欄のまま |
| 5 | 未知の`type`（`ACT_LABEL`に無い文字列） | 件数には算入（活動が実在した事実は変えない）。アイコン/ラベルは既存の汎用fallbackパターン（`ACT_LABEL[type]\|\|{ico:'📌',name:type}`、`sst-app.html:6953`で既に使われているfallback）を踏襲 | 算入する | 可能な範囲で汎用表示 | 同上 |
| 6 | 無効timestamp・4週間の範囲外の未来timestamp（§9.5） | 「期間を判定できない記録が◯件あります」という別枠の注記 | 週別集計には不算入、別枠countのみ | 対象外 | 同じ注記を印刷にも含める |
| 7 | storage読込失敗（JSON破損等） | 「記録を読み込めませんでした」という、0件とは異なる専用メッセージ | 集計自体を実行しない（0件と表示しない） | 対象外 | 印刷時も同じ読み込み失敗メッセージ |
| 8 | `detail`の一部が不正・不足（`detailSchemaVersion`不一致等） | 件数には算入（`ts`/`type`が有効なため） | 算入する | `detail`由来の表示のみ省く（既存Record Detail Contract §12.2の「detailごと無視し要約表示にフォールバック」原則をそのまま適用） | 同上 |

「記録なし」（状態2・3）と「読み込めない」（状態7）は明確に異なる文言・異なる状態として扱う。

### 11.2 「記録なし」と「読み込めない」の区別を実現する方法（重要な前提の明示）

§3.5の通り、既存Foundation API（`donomanaRecordReadLog()`）は「キー未使用」と「キーは存在するが破損」を区別せず、どちらも`[]`を返す。この既存関数自体は本Phaseで変更しない（許可ファイル範囲外）。

**v1での対応方針**: 新規集計関数の冒頭で、共有プリミティブに依存しない**読み込み確認専用の最小限のローカル処理**を行う。具体的には、`localStorage.getItem('sst_activity_log_v1')`の生の戻り値を直接確認し、(a) `null`/空文字列 → 状態2相当（「未使用」として扱う）、(b) 値は存在するが`JSON.parse()`が例外を投げる、またはparse結果が配列でない → 状態7（読込失敗）として扱う、(c) 正常にparseできた配列 → 通常の集計へ進む、という3分岐を実装Phaseで追加する。これは`donomanaRecordReadLog()`自体の変更ではなく、**本機能専用の、既存関数と並行する読み取り専用の確認ステップ**として設計する（既存のSST本体・他21アプリ・Common Dashboardのいずれにも影響しない）。

この設計により、「活動を一度もしたことがない」（state 2、中立的な「記録なし」表示）と、「何らかの理由でデータが読めない」（state 7、別の専用メッセージ）を、本機能に限り正しく区別できる。

---

## 12. 端末／ブラウザ単位の記録（確定）

### 12.1 個人識別機能が無いことの再確認

本Phaseで`sst-app.html`を再確認し、`kyou-no-kiroku.html`の`children[]`配列に相当する個人識別の仕組みがSSTには存在しないことを再確認した（grep実測、該当構造0件）。`sst_activity_log_v1`は完全にdevice-level/browser-levelのstorageであり、「誰の記録か」を区別する情報を一切持たない。

### 12.2 表示方針（確定）

表示は「**このブラウザに保存された記録**」を基本文言とする。

- 禁止: 生徒名の自動推定、記録全体を「この生徒の変化」と表示すること、活動件数を人数と解釈すること、v1への個人識別機能の追加。
- 複数人が同じ端末・ブラウザで利用した場合に記録が混在しうることを、画面とPDFの両方で簡潔に示す（§19の確定文言）。実装の内部事情（localStorageの仕組み等）を長く説明するUIにはしない。

---

## 13. UXを確定する

### 13.1 既存構造の調査結果

`#s-report`（今週のレポート画面）は単一の`.scr`画面で、`#report-card`（印刷対象、曜日別グラフ・活動種別内訳・くわしいきろく・バッジ・温度計チャート・コメント欄を含む）と、その外側の`.report-actions`（PDF保存／共有／CSV書き出しの3ボタン）で構成される（`sst-app.html:3412-3502`）。画面遷移は全て`.scr`クラス＋`go(id)`関数による共通パターン（`.scr{display:none} .scr.on{display:block}`、`sst-app.html:167-168,5492-5504`）で、ロールプレイ・クイズ・ストーリー等、既存の全機能がこのパターンで実装されている。`go(id)`は`window.scrollTo(0,0)`のみ実行し、**特定要素への明示的なfocus移動は行っていない**（全画面共通の既存動作）。戻るボタンは各画面が`<button class="back" onclick="...">← もどる</button>`を持つ既存パターンに加え、`BACK_MAP`という画面ID→戻り先関数のマップで集中管理された下部戻るボタン（`bottomBack()`）も存在する。

### 13.2 確定構造

**既存の画面遷移パターンに合わせ、新しい独立画面`#s-trend`を追加する。**「今週のレポート」内にパネルとして埋め込む案（既存`#report-card`内への追加）は、印刷対象の分離が難しくなる（§13.4）ため不採用とし、既存の全機能が採用している「独立`.scr`画面＋`go()`遷移」という、このアプリで最も一貫したパターンを踏襲する。

- **導線**: `#s-report`の`.report-actions`内、既存3ボタンの**先頭**に新規ボタン「📊 4週間のふりかえりを見る」を追加する（`onclick="go('s-trend')"`）。既存3ボタンはエクスポート/共有系の操作、新規ボタンは別ビューへの遷移であり役割が異なるため、視覚的に区別できるスタイルを推奨する（実装Phaseで確定）。
- **画面構造**: `#s-trend`は`#s-report`と同じ`.scr`パターンの新規画面。内部に`#trend-card`（`#report-card`と同系統の見た目の独立したカード、印刷対象、§13.4）を持つ。
- **focus**: 既存の`go()`パターン（`scrollTo(0,0)`のみ、明示的focus移動なし）をそのまま踏襲する。本機能のためだけに新しいfocus管理パターンを導入しない（既存の全画面と一貫した挙動を優先する）。
- **戻る**: `#s-trend`に`<button class="back" onclick="go('s-report')">← もどる</button>`を設置し、`BACK_MAP['s-trend']`に`{ dest: () => go('s-report') }`相当のエントリを追加する（`home()`ではなく、遷移元の`#s-report`へ戻す）。
- **既存週次レポートとの表示切り替え**: `#s-report`⇄`#s-trend`は通常の画面遷移（`go()`）のみで、どちらか一方のみが`.on`になる。両方が同時に表示されることはない。
- **詳細記録の週別展開**: 既存`buildDetailRecordList()`と同じ折りたたみ（`aria-expanded`同期）UIパターンを、週ごとのセクションとして4回分並べる形で再利用する。
- **印刷対象の選び方**: §13.4で確定。

### 13.3 画面内の表示順序（確定）

1. タイトル・対象期間（「4週間のふりかえり」＋4週間の日付範囲）
2. このブラウザの記録であることの説明（§19確定文言）
3. 週別活動記録件数の棒グラフ
4. 同じ数値の表
5. 活動種別内訳（週ごと）
6. 回答詳細（週ごとに展開、既存パターン再利用）
7. 印刷／PDF保存ボタン

### 13.4 印刷対象の分離（確定、既存週次PDFへの影響回避）

既存の印刷isolationは`#report-card,#report-card *{visibility:visible;}`という固定idセレクタで実装されている（§3.6）。`#s-trend`が非activeな間は`.scr{display:none}`により`#trend-card`はそもそも描画されず印刷にも出ない。**`#trend-card`を印刷可能にするには、既存ルールを次のように拡張するのみでよい**:

```css
#report-card,#report-card *,#trend-card,#trend-card *{visibility:visible;}
```

`.scr.on`の排他性（どちらか一方のみ表示）により、この拡張だけで両カードが同時に印刷される事態は発生しない（既存`#report-card`のルール自体は変更しない、純粋な追加のみ）。`@page`・ダークモード打ち消し・改ページ制御（`break-inside:avoid`）等の既存ルールも、`#trend-card`配下の対応するクラスへ同様に適用する。既存`printReport()`（`window.print()`のみ呼ぶ）・既存`#report-card`の印刷ルールへの変更は一切不要であり、既存週次PDFへの回帰リスクは最小化される。

`#s-trend`用の印刷ボタンは独立した`printTrendReport()`（同じく`window.print()`を呼ぶだけ）として新設することを推奨する（既存`printReport()`を分岐させない、単純な関数追加で既存コードへの変更を避ける）。

---

## 14. グラフと表（確定）

### 14.1 基本方針

**週別の離散棒グラフ**を基本とする。折れ線による連続的な変化の表現は採用しない（§8、既存`buildWeekChart()`も棒グラフを採用している既存実績と整合）。

### 14.2 確定事項

- 単位: 件
- 週の順序: 古い週→今週（左から右、または上から下、実装時のレイアウトに委ねるが順序は固定）
- 日付ラベル: 各週に`M/D（月）〜M/D（日）`形式（既存`getWeekRange().label`と同じ書式）
- 数値ラベル: 既存`buildWeekChart()`と同じ方式（`counts[i]||''`、0件のときは空欄表示であって「0」という数字を強調表示しない、§11.1状態3と整合）
- 今週が途中であることの表示: 今週（第4週）のバー・ラベルに「集計中」等の注記を付す（§9.1）
- 全週記録なしの場合: §11.1状態2の表示
- 最大値が小さい場合（例: 全週1〜2件）: 既存`buildWeekChart()`の`Math.max(...counts, 1)`パターン（0除算防止の下駄履き）を踏襲し、バーの高さが不自然に潰れない最小高さを確保する
- 大きな件数の場合: 既存と同じ相対スケール（`counts[i]/max`）で表示、数値ラベルは省略しない
- 200%zoom・狭幅表示: 既存`buildWeekChart()`/`buildActivityList()`のレスポンシブパターンをそのまま踏襲
- 印刷時: §13.4の`#trend-card`印刷ルールに含める

### 14.3 グラフと表の一致

同じ週別集計結果から、グラフ（棒グラフ）と数値表（HTML `<table>`または明示的なリスト）の両方を生成する。**両者は同じ集計関数の出力を参照し、別々に計算しない**（齟齬が生じる余地をなくす）。

### 14.4 色・アニメーション

色だけに依存しない（数値ラベル・テキストラベルを必ず併記、既存`buildWeekChart()`/`buildActivityList()`と同じ方針）。新規のアニメーションは追加しない。`prefers-reduced-motion: reduce`は既存CSS（`sst-app.html:52`）が既に全体に適用されているため、新規セクションも自然に対象となる。

---

## 15. Privacy

local-firstを維持する。新規サーバー送信・account必須化・cloud DB・外部chart serviceへのrecord送信・学生データを含む解析イベント・新規外部依存の追加はいずれも行わない。`sst_diary_entries_v1`は参照しない。§7.1の通り、`diary` typeの`activityLog`上のrecordには気持ち名の結合文字列（`result`）のみが入り自由記述本文は含まれないため、件数集計に`diary`を含めても自由記述内容が月間集計へ取り込まれることはない。グラフ描画はnative SVG/Canvasまたは既存`buildWeekChart()`と同じ実装方式（local rendering）を用い、新規external chart libraryを追加しない。記録由来テキストの安全な描画（HTMLエスケープ等）は既存`sst-record-detail.js`・`buildDetailRecordList()`のパターンをそのまま踏襲する。実ユーザーの記録を調査・テストのために外部へ送信することはしない。

---

## 16. Accessibility / PDF Acceptance Criteria（確定）

### 16.1 Accessibility

- 色に依存しない（§14.4）
- 数値表による等価情報（§14.3）
- 画面遷移・開閉トグルはnative `<button>`、`aria-expanded`で状態通知（既存`buildDetailRecordList()`のtoggleパターンをそのまま再利用）
- keyboard操作: 新規要素は全てTab到達可能なnative interactive element
- focus管理: §13.2の通り、既存`go()`パターン（明示的focus移動なし、`scrollTo(0,0)`のみ）を踏襲
- screen readerの読み順: DOM順序どおり（タイトル→説明→グラフのtext alternative→表→活動内訳→詳細）。グラフ要素自体は`aria-hidden`とし、実データはテーブル/リスト側のsemantic markupで提供する
- switch利用: 既存sst-appのSwitch Scan戦略に準拠。全操作がnative buttonのTab到達性を満たす
- 200%zoom・狭幅表示: §14.2
- high contrast / forced colors: 本コードベースに既存の`forced-colors`/`prefers-contrast`対応パターンは確認されなかった（grep実測、0件）。本機能のみに新規パターンを導入しない（既存全体の水準に合わせる）
- `prefers-reduced-motion`: 既存CSS（`sst-app.html:52`）の対象に自然に含まれる
- iPad Safari: **実機未確認。Real Device Gateとして別途ユーザー確認が必要**（§16.3で明示）

### 16.2 PDF Acceptance Criteria

- タイトル・対象期間: `#trend-card`内に明記（§13.3の1）
- 集計時点: §9.4の「今」の取得時刻を画面表示と同じ値で印刷にも反映する
- 記録の意味と共有利用に関する説明: §19確定文言を`#trend-card`内に含める（印刷時も表示、既存`.report-print-credit`と同様`display:block!important`等で確実に出す）
- グラフ・表の一致: §14.3
- 回答詳細を含める範囲: 画面上で展開済みのものだけでなく、**既存`.report-detail-body[hidden]{display:block!important;}`と同じCSSのみによる強制展開パターン**を`#trend-card`配下にも適用し、JS/DOM操作なしに印刷時は全展開済み状態にする（展開状態に依存して内容が欠落しない）
- 長い詳細の改ページ: 既存`break-inside:avoid`パターンを週セクション単位・個別detail card単位に適用する。ただし**過剰適用は避ける**（`#trend-card`全体やセクション全体に一律`break-inside:avoid`を掛けると、4週間分の内容量では1ページに収まらずレイアウトが破綻する恐れがあるため、既存と同じ「個別の小ブロック単位」にとどめる）
- 既存週次印刷の非回帰: §13.4の設計（既存`#report-card`ルールは変更せず追加のみ）により、既存`printReport()`の出力は影響を受けない。実装Phaseで自動テスト（既存`pdf-print-implementation-test.js`と同じ手法、`page.emulateMedia({media:'print'})` + `window.print()`スパイ）による非回帰確認を必須とする

### 16.3 自動検証と実機確認の区別（確定）

本Design Phase・次Implementation Phaseを通じ、**iPad Safari・VoiceOver等の実機確認はいずれも自動検証で代替しない**。Playwright等による自動テスト（`@media print`のレンダリング確認、keyboard操作のシミュレーション等）は実施するが、これを「実機確認済み」として報告することはしない（CLAUDE.md §5 Real-device boundaryに従う）。実装Phase完了後、Real Device Gateとしてユーザー自身による確認を別途依頼する。

---

## 17. PDF / Sharing contract

既存`window.print()` + `@media print`方式を拡張する（§13.4）。新規PDFライブラリは導入しない。

---

## 18. Learning Records relationship（確定、§3.7の結論を反映）

SSTのCommon Learning Records（`learning-records.html`）統合は、**Level 2 detail・CSV Parityとも実装済み・Production Released**であることを本Phaseで確認した（§3.7）。月次/週次のtrend・集計機能は`learning-records.html`に一切存在しない。

「4週間のふりかえり」はSST app-local機能として設計する（Donomana全体の巨大dashboardは設計しない、§2）。集計ロジック自体は、将来的に他のFoundationアプリへ転用可能な形（生のrecord配列と週定義を受け取り週別集計を返す汎用関数）で設計してよいが、**大きな共通frameworkを今回新たに設計することはしない**。実装対象は今回もSSTに限定する。

共通Dashboard側（`learning-records.html`・`record-dashboard-foundation.js`）への機能追加は本Phaseのscope外であり、次Implementation Phaseでも行わない（§6.2）。`docs/records/sst-common-record-detail-parity-audit-v1_0.md`のstaleなステータス表記の更新も、許可ファイル範囲外のため本Phaseでは行わない（将来の別Phase候補として§24に記録）。

---

## 19. 確定した説明文（Wording、確定・Open Questionとして残さない）

### 19.1 主説明文（画面・PDF共通、確定）

> この表示は、このブラウザに保存された活動と回答の記録です。件数や回答の違いだけで、能力・心理状態・支援の効果を判断することはできません。本人の様子や取り組んだ場面と合わせて、ふりかえりにご活用ください。

### 19.2 共有端末に関する注記（確定）

> 同じブラウザを複数人で使うと、記録が一緒に表示されます。

### 19.3 保存期間に関する注記（確定、§10を反映）

> 記録の保存期間は30日です。最も古い週は、一部の記録がすでに保存期間を過ぎている可能性があります。

### 19.4 名称（確定）

**「4週間のふりかえり」**。「1か月」「月間成果」「成長グラフ」「能力グラフ」はいずれも不採用（理由は前Phェーズ§16と同一、実際の時間窓が28日のローリングウィンドウであり暦月ではないこと、及び§2 Non-goalsとの整合）。

### 19.5 Wording Audit（前Phase分を維持、再掲なし）

禁止語（成長/改善/能力/心理状態/正解率/正答率/月間成果/成長グラフ・能力グラフ）、推奨語（記録/きろく/ふりかえり/回答/選択/傾向/推移/利用状況/教材内区分/直近4週間）の一覧は前Phェーズ§16.1の判定をそのまま維持する。

---

## 20. Data transformation rules

1. **週バケット化**: §9.1-9.4の確定ロジックに従い、「今」を1回取得したうえで4週分の`[月曜00:00:00.000, 日曜23:59:59.999]`区間を算出する。
2. **読み込み確認**: §11.2の3分岐（未使用/読込失敗/正常）を先頭で実行する。
3. **活動記録件数**: 各週バケットに属する`activityLog`要素数をそのままカウントする（§7.3、重複排除・フィルタなし）。§9.5の無効/範囲外timestampは別枠でカウントし、週別集計には含めない。
4. **活動種別内訳**: 週バケット内で`type`ごとにグループ化しカウントする（既存`buildActivityList()`と同じロジック）。
5. **詳細展開**: `detail`を持つrecordのみ、既存`buildDetailRecordList()`と同じロジックで週ごとに表示する。`detail`を持たないrecordは件数には含むが詳細欄には出さない（§11.1状態4）。
6. **既存recordの不変性**: 本機能はread-onlyの集計であり、`activityLog`・`sst_activity_log_v1`への書き込みを一切行わない（`saveActivityLog()`を呼ばない）。

---

## 21. Test strategy

実装Phase（`SST-MONTHLY-TREND-IMPLEMENTATION-1`）向けの最低限のテスト項目（前Phェーズ分に以下を追加・具体化）:

- no records（§11状態2）／1 record／同日複数record／4週間にまたがるrecord／記録が無い週がある（§11状態3）
- `detail`を持たないlegacy record（§11状態4、custom RP・photo・thermo・diaryを含む）
- 複数SSTアプリ（type）が混在
- 未知の`type`（§11状態5）
- 無効timestamp・4週間範囲外の未来timestamp（§11状態6、§9.5）
- storage読込失敗（JSON破損、非配列）が「記録なし」と異なる表示になること（§11状態7、§11.2の3分岐の自動テスト）
- `detail`の一部が不正・不足（§11状態8）
- 週境界（23:59:59.999→00:00:00.000の週またぎ）・月またぎ・年またぎ（§9.3の`setDate()`ベース演算の自動テスト）
- DST境界をまたぐ日付（可能な環境で）
- 同一questionが繰り返し記録されている場合でも、Option D機能（§8）が実装されていないことの確認
- 「今」を複数回表示しても境界が再計算されること（§9.6）
- wq/quiz/story完了時の正しい1セッション=1record集計（§7.1の粒度確認を自動テストに反映）
- phrase: 同一フレーズの読み上げ+コピーが2 recordとして集計されること（§7.1）
- PDF/印刷（`#trend-card`を含めた`@media print`のレイアウト崩れ確認、既存`#report-card`印刷の非回帰を含む、§16.2）
- iPad Safari（Real Device Gate、本Phaseでは実施しない、§16.3）
- keyboard操作・switch scan到達性・screen reader等価性（§16.1）
- 既存「今週のレポート」回帰（`buildReport()`本体の非破壊確認）
- Learning Records回帰（`record-dashboard-foundation.js`/`record-dashboard-ui.js` golden tests・SST common detail golden testsの非破壊確認）
- full golden regression（`tools/record-dashboard-poc/*golden-tests.js`全件、SST PDFテスト含む）

---

## 22. Migration / backward compatibility

migrationは不要。既存`activityLog`のrecordを書き換えない。既存recordへ後付けで擬似データを生成しない。`schemaVersion`は既存の`1`のまま変更しない。新規top-level fieldの追加は本Phaseの集計機能では不要（既存fieldの読み取りのみで実現可能）。

---

## 23. Explicit out-of-scope items

- tier別割合・内訳のグラフ化（§6.2）
- 同一scenario/question単位の回答推移（§6.2）
- 独立した「回答数」指標（§7.3で代替方針を確定済み）
- 生徒個人識別（§12）
- Donomana全体を横断する巨大trend dashboard（§18）
- カレンダー月・ユーザー指定期間での表示（v1は直近4週間固定、§9.7）
- `sst_diary_entries_v1`の参照（§15）
- custom Roleplayのtier内訳への算入（v1でtier内訳自体を扱わないため該当なし）
- import/restore機能（サイト全体に現状存在しない）
- `learning-records.html`・`record-dashboard-foundation.js`側の実装（§18）
- `docs/records/sst-common-record-detail-parity-audit-v1_0.md`のステータス表記更新（§3.7、§24に将来候補として記録）
- Foundation API（`donomanaRecordReadLog()`等）自体への変更（§11.2、本機能専用のローカル確認で代替）

---

## 24. Risks

| リスク | 内容 | 対応方針 |
|---|---|---|
| 週境界×30日retentionのズレ | 最古週が閲覧日によって部分的に欠落しうる | 保存期間注記を常時表示（§19.3） |
| storage読込失敗と空の区別不可 | 既存Foundation APIの既知の制約 | 本機能専用のローカル確認で区別（§11.2） |
| record粒度の不揃いによる誤解 | wq/quiz/storyは1セッション=1recordだが他は1アクション=1record | 「活動記録件数」の定義文言で明示（§7.2） |
| 複数児童の端末共有 | Device-level集計のため複数人の記録が混在しうる | UI文言で明示（§19.2）、個人識別機能は追加しない |
| 印刷レイアウト崩れ | 新セクション追加による既存`@media print`への影響 | `#report-card`ルールは変更せず追加のみ（§13.4） |
| DST境界での週境界ズレ | 固定ミリ秒演算を使うと発生しうる | `setDate()`ベースの暦対応演算を採用（§9.3） |
| 既存機能への回帰 | `buildReport()`本体・Common Learning Records・Golden testsへの影響 | §21のテスト戦略で網羅 |
| 利用報告の誤用 | 臨床現場での利用報告を効果の根拠と誤認されるリスク | Non-goals（§2）・説明文（§19.1）で明示的に線引き |

---

## 25. Open questions

本Phaseで、前Phェーズに残っていた3件のOpen Questionsは全て本文書内で確定した（スコープ=§6、免責的説明文=§19、UI配置=§13）。**本当にUser判断が必要な残項目はない。**

強いて残すとすれば、実装Phase開始後に実コードを見ながら微調整しうる純粋なレイアウト上の細部（例: 新規ボタンの正確な配色・アイコンの最終意匠）のみであり、これらはImplementation Phase自身の裁量範囲として扱って差し支えない。

---

## 26. Implementation Readiness（次Phase: `SST-MONTHLY-TREND-IMPLEMENTATION-1`）

以下を実装Phaseが迷わず着手できるAcceptance Criteriaとして明記する。

- **approved v1 scope**: §6.1（含む）／§6.2（含まない）
- **対象recordと除外条件**: `sst_activity_log_v1`の全record（`diary`含む、`sst_diary_entries_v1`は除外、§15）。4週間範囲外・無効timestampのrecordは週別集計から除外し別枠カウント（§9.5、§11状態6）
- **集計単位**: 「活動記録件数」＝record数そのもの、重複排除なし（§7.2-7.3）
- **期間境界**: 月曜起点4週間、両端包含、`setDate()`ベース演算、「今」は1回取得（§9）
- **空状態・失敗状態**: §11.1の8状態表
- **UI構造**: 新規`.scr`画面`#s-trend`＋`#trend-card`、`#s-report`からの導線、§13.3の表示順序
- **表示文言**: §19.1-19.4（確定済み、追加のUser判断不要）
- **PDF仕様**: §13.4（印刷isolation拡張）、§16.2
- **accessibility要件**: §16.1
- **想定変更ファイル**: 下記
- **必要な検証**: §21
- **実機Review項目**: §16.3（iPad Safari、Real Device Gate、実装完了後に別途依頼）

### Implementation Plan Preview（想定変更ファイル）

| File | Why needed | Expected change | Risk |
|---|---|---|---|
| `sst-app.html` | `#s-trend`画面・`#trend-card`・集計関数・`printTrendReport()`の実装場所 | 新規screen・新規関数（週バケット4週拡張、§11.2の読み込み確認、棒グラフ描画、活動別内訳、週別detail展開）、`.report-actions`への導線ボタン追加、`BACK_MAP`エントリ追加 | 中（9,900行超の既存ファイルへの追加。既存`buildReport()`/`#report-card`との非干渉を§13.4の設計通り慎重に実装する必要がある） |
| `sst-app.html`（`@media print`ブロック） | `#trend-card`を印刷対象に含めるため | `#report-card,#report-card *{visibility:visible;}`を`#trend-card`も含む形へ拡張（既存ルール自体は変更せず追加） | 低（§13.4の設計通りの追加のみ） |
| `tools/sst-weekly-report-pdf/`配下の新規または既存テストファイル | §21のテスト戦略実装 | 新規Node/Playwrightテストの追加 | 低 |

本Phaseではこれらのファイルを一切変更していない。

---

## 27. Definition of Done（本Design Finalize Phase自体）

- [x] `origin/main`最新確認・Drift Gate実施（§0.1、drift 0）
- [x] CLAUDE.md Governance遵守
- [x] source checkpoint存在確認・引き継ぎ方法明記（§0.2）
- [x] 12活動type全ての記録単位を実コード確認（§7.1）
- [x] 「活動記録の件数」定義確定（§7.2）、重複排除ポリシー確定（§7.3）
- [x] 週境界・timezone・固定ミリ秒演算の妥当性を確認し確定（§9）
- [x] 30日retentionのload/save挙動を再確認（§3.4、§10）
- [x] storage読込失敗と空状態の区別方法を確定（§3.5、§11.2）
- [x] 記録なし・不明・読込失敗・legacyの8状態表を確定（§11.1）
- [x] 端末／ブラウザ単位であることの表示を確定（§12）
- [x] 共通「学習の記録」の不整合をA/B/C分離で解消（§3.7、§18）
- [x] UX構造（新規画面・導線・focus・戻る・印刷分離）を確定（§13）
- [x] グラフ・表の確定事項（§14）
- [x] Accessibility/PDF Acceptance Criteriaを具体化（§16）
- [x] 説明文を確定（Open Questionとして残さない、§19）
- [x] v1 scope確定（§6）、Out of scope明示（§23）
- [x] Risk Register更新（§24）
- [x] Open Questions実質0件（§25）
- [x] Implementation Readiness・Plan Preview明記（§26）
- [x] Docs only（Production機能コード変更 0件、変更ファイルは本文書のみ）
- [x] push/merge/deployなし
