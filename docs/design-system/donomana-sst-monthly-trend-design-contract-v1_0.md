# どのまな SST Monthly Trend Design Contract（Version 1.0）

- **Status: FINAL DESIGN CONTRACT v1.0（Correction適用済み、Implementation Phaseでの軽微な訂正を反映）**
- **Implementation: COMPLETE（`SST-MONTHLY-TREND-IMPLEMENTATION-1`、checkpoint未push、User Review待ち）**
- Phase: `SST-MONTHLY-TREND-DESIGN-CORRECTION-1`（本文書の設計内容自体は同Phaseで確定）。実装は後続Phase `SST-MONTHLY-TREND-IMPLEMENTATION-1` で行い、本文書には§4の訂正指示に基づく軽微な文言訂正のみを追加で反映した（新規の設計変更は無い）。
- 発行: 2026年10月
- Production baseline: `origin/main = 87b7d1f63b197401992d0122caba445e446350c3`（前Phase群・本Phaseとも同一、drift 0。詳細は§0.1）
- Branch: `feature/sst-monthly-trend-design-correction-1`（Implementation Phaseでは`feature/sst-monthly-trend-implementation-1`がこの文書のcherry-pick先）
- 位置づけ: 本文書は`donomana-sst-record-detail-contract-v1_0.md`（SST Record Detail v1、Production Released）・`donomana-sst-record-detail-expansion-plan-v1_0.md`（Wave 1/2拡張、Production Released）・`donomana-learning-record-standard-v1_0.md`（Foundation標準）・`donomana-supporter-record-dashboard-design-v1_0.md`（横断Dashboard設計）を継承する。いずれの既存契約も置き換えない。本文書は前Phase（`SST-MONTHLY-TREND-DESIGN-FINALIZE-1`、checkpoint `83f720f600cb36657b2c788e098dc4b2992cae1c`）の同名文書を直接引き継ぎ、User Reviewで指摘された事実誤認・設計上の不整合を訂正したものである。
- 契機: 実ユーザーから「今週のレポート」の教員間共有のしやすさを評価する声とともに、学校での個別相談・集団認知行動療法の場面・こども若者相談支援等、学校の授業に限らない複数の文脈での活用報告が届いた。本Phaseはこれらの利用報告を機能の存在根拠として扱うが、臨床的有効性の主張や治療・診断機能への拡張は行わない（§2）。
- 変更ファイル: 本ドキュメントのみ（設計Phase群）。実装Phase（`SST-MONTHLY-TREND-IMPLEMENTATION-1`）では`sst-app.html`・`tools/sst-weekly-report-pdf/trend-implementation-test.js`（新規）・本文書を変更した。`assets/js/sst-record-detail.js`・`assets/js/record-dashboard-foundation.js`・`generate.js`・`apps-data.json`・Foundation API・localStorage schemaはいずれも変更していない。

---

## 0. 関連文書（Source of Truth）

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | Core Schema・Storage・Foundation API・Privacy原則の正本 |
| `donomana-sst-record-detail-contract-v1_0.md` | SST Record Detail v1（Production Released）。本契約が前提とするSST record/detail schemaの正本 |
| `donomana-sst-record-detail-expansion-plan-v1_0.md` | Wave 1/2拡張（Production Released） |
| `docs/records/sst-common-record-detail-parity-audit-v1_0.md` | SSTのCommon Learning Records統合Audit。ステータス表記がstaleであることを確認済み（§3.7） |
| `donomana-supporter-record-dashboard-design-v1_0.md` | 横断Learning Records Dashboard（`learning-records.html`）の設計文書 |

### 0.1 Drift Gate 実施結果（本Phase開始時）

`git fetch origin`後、`origin/main = 87b7d1f63b197401992d0122caba445e446350c3`を確認した。前Phase群が報告したbaselineと完全に一致しており、**drift 0**。SST・Learning Record Foundation・PDF・関連設計文書への変更は本Phase開始時点で確認されていない。

### 0.2 Source Design Checkpoint 確認・引き継ぎ方法

正しいsource checkpoint（`83f720f600cb36657b2c788e098dc4b2992cae1c`）の存在を確認した。前Phase最終報告で一度誤って提示されたSHA（`83f720f20d8fbf35c3e1ae11cf98f3074d42766e`）は**存在しないことを`git cat-file -t`で確認した**（`fatal: could not get object info`）。本Phaseはユーザーから提示された正しいSHAのみを使用する。

- `git cat-file -t 83f720f600cb36657b2c788e098dc4b2992cae1c` → `commit`（存在確認）
- 親commit: `3f0143a5197a7b2d72204e8707bdb1406283edb7`（前Phase`SST-MONTHLY-TREND-DESIGN-1`のcherry-pick commit）
- 親の親: `87b7d1f63b197401992d0122caba445e446350c3`（＝現在のorigin/main、drift 0を再確認）
- 変更ファイル: `docs/design-system/donomana-sst-monthly-trend-design-contract-v1_0.md`のみ

**引き継ぎ方法**: 本Phase専用branch（`feature/sst-monthly-trend-design-correction-1`、`origin/main`から新規作成）上で、`git cherry-pick 3f0143a5197a7b2d72204e8707bdb1406283edb7 83f720f600cb36657b2c788e098dc4b2992cae1c`を実行した（2 commitを順に適用）。いずれもconflict無く適用され、working treeのファイルが正しいsource checkpoint時点の内容とbyte-for-byte一致することを`diff`で確認した。他Phase（`feature/sst-monthly-trend-design-1`・`feature/sst-monthly-trend-design-finalize-1`自体を含む）のworktree・branchは一切変更していない。本Phaseでは、この引き継いだ単一ファイルを本Phase branch上でさらに訂正する。

---

## 1. Purpose

SSTアプリ群（`sst-app.html`、11活動type、§7参照）の既存記録を基盤に、教員・支援者が**直近4週間**の活動記録・回答傾向を振り返れる機能を正式設計する。目的は「保存された活動と回答を、時間の流れに沿って振り返りやすく整理すること」であり、「子どもを数値で評価すること」ではない。Donomanaはデータを整理して提示するに留め、意味の解釈は教員・支援者が行う。

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

## 3. Existing architecture findings（実コード調査結果）

### 3.1 SSTアプリ構成・Record Schema（本Phaseで件数を再確認・訂正）

`sst-app.html`の`recordActivity(type, lv, result, detail)`（6822-6835行）が唯一のwrite path。**活動typeは`ACT_LABEL`（6777-6789行）に定義される11種類**であり、`recordActivity()`の全呼び出し箇所（本Phaseで再度網羅的にgrep確認、下記）もこの11種類と完全に一致する:

```
rp(5747) / wq(5773) / story(5980) / quiz(6119) / breath(5534) /
emotion(5636) / photo(8599) / diary(8781) / branch(9204) /
phrase(9326,9330) / thermo(9691)
```

**訂正**: 前Phase文書は「`diary`は11正式活動に含まれない12個目のtype」としていたが、これは`donomana-sst-record-detail-contract-v1_0.md`（Record Detail v1 Contract）独自の「正式11活動」リスト（detail拡張の対象として整理された活動一覧であり、`diary`は対象外として意図的に除外されている）と、`ACT_LABEL`に実際に定義されている11 typeのリスト（`diary`を含む）を混同した誤りである。`ACT_LABEL`自体の要素数は常に11であり、`diary`はその11の中の1つである。12種類のtypeは存在しない。Storageは`sst_activity_log_v1`、共有I/Oプリミティブ`donomanaRecordReadLog`/`donomanaRecordWriteLog`経由。

### 3.2 活動種別ごとの記録単位

ロールプレイ/きもちカード/写真で練習/きもち温度計/フレーズ集/きもち日記は**1アクション=1record**（即時commit）。きもちを落ち着ける（呼吸）は**画面表示1秒後の自動record**（§7.1で詳述、選択を伴わない）。ことばクイズ/SSTクイズは**1セッション全体（全問完了）=1record**（内部にdetail.answers[]で複数設問を保持）。ソーシャルストーリーは**最終ページ到達=1record**（埋め込み質問0〜N件を内包）。分岐ストーリーは**1エンディング到達=1record**（選択経路全体を内包）。詳細は§7の表を参照。

### 3.3 週境界・timezone・集計終点（本Phaseで集計終点の誤りを訂正）

```js
// sst-app.html:6853-6870（既存「今週のレポート」の週定義、本機能はこの考え方を踏襲しつつ集計終点のみ補正する）
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
// buildReport()（既存「今週のレポート」。週全体が過去（今日を含む）であることが前提のため、
// 日曜23:59:59.999を終点としても矛盾しない）:
const startTs = mon.setHours(0,0,0,0);
const endTs   = new Date(sun).setHours(23,59,59,999);
const weekLog = activityLog.filter(a => a.ts >= startTs && a.ts <= endTs);
```

確認した事実:
- **基準はブラウザのローカル端末時刻**（`new Date()`、`getDay()`/`getDate()`はいずれもlocal time methods）。UTC基準ではない。
- 週境界は`Date.prototype.setDate()`/`setHours()`という**暦対応（calendar-aware）演算**で算出されており、月またぎ・年またぎを正しく処理する。**固定ミリ秒の加減算（`Date.now() - N*24*60*60*1000`）ではない。**
- **重要な訂正（Implementation Phaseでさらに訂正）**: 既存`buildReport()`は「今週」の終点を常に「今週の日曜23:59:59.999」としているが、これは**既存の「今週のレポート」が表示される瞬間には今週の日曜がまだ来ていない可能性を考慮せず、単に『今週全体』という固定の枠を示しているだけ**である。既存コードには無効・未来timestampへの明示的なvalidationが存在しないため（次項）、「その枠のうち『今』より後の部分にはrecordが存在しえない」と断定することはできない（端末の時計設定が狂っている場合等、理論上は未来timestampのrecordが保存される余地がある）。既存「今週のレポート」はこの可能性を明示的に検証・除外する処理を持たないが、本機能（4週間のふりかえり）では未来timestampを明示的に検出し、週別集計から除外したうえで利用者に注記する（§9.5、Implementation Phaseで実装済み）。さらに、本機能のように「集計時点」を明示する必要がある設計では、「今週の日曜まで」を集計の終点として扱うと、「今」より後の時刻まで集計対象であるかのような誤った印象を与える。**本機能では集計の終点を「今週の日曜」ではなく「now（集計実行時点）」とする**（§9で確定）。
- 無効timestamp・未来timestampに対する明示的なvalidationは既存コードに存在しない。本機能ではこれを新規に設計する（§9.5、§11）。

### 3.4 30日retentionの正確な挙動

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

- **pruneは`saveActivityLog()`時にのみ実行される。`loadActivityLog()`（読み込み時）はpruneしない。**
- 件数上限（count-based cap）は存在しない。30日という時間条件のみ。
- 4週間のふりかえり機能はread-only（`saveActivityLog()`を一切呼ばない）。表示そのものが新たなpruneを引き起こすことはない。
- **§4・§19.3で訂正する通り、本機能が対象とする4週間の範囲（最大でも表示時点から約28日前まで、§9.1）は、通常の30日retentionに常に収まる。** 30日retentionを理由に最古週の記録が失われている、という説明は実態に即していない（§4で詳述）。

### 3.5 Storage読込失敗・空状態の判定（本Phaseで分岐を精緻化）

```js
// sst-app.html:3853-3860（既存Foundation API、本Phaseでは変更しない）
function donomanaRecordReadLog(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
```

既存Foundation APIは「キー未使用」と「キーは存在するが破損」を区別せず、どちらも`[]`を返す。この既存関数自体は本Phaseで変更しない。本機能専用の読み込み確認（§11.2）で区別する。

### 3.6 PDF / 印刷

`window.print()` + `@media print` CSSのみ、外部ライブラリなし。印刷対象は`#report-card`に限定する可視性分離パターン（`body *{visibility:hidden} #report-card,#report-card *{visibility:visible}`）。`.scr{display:none} .scr.on{display:block}`（`sst-app.html:167-168`）という画面切替の仕組みにより、非activeな画面は印刷時にも`display:none`のまま。これにより、新しい画面を追加しても、その画面が非activeな間は印刷対象から自然に除外される（§13.4）。

### 3.7 Common Learning Records（`learning-records.html`）とSSTの統合状況

**A. 設計文書に書かれていること**: `docs/records/sst-common-record-detail-parity-audit-v1_0.md`は「Draft、User Approval待ち」「Parity Status: SUMMARY ONLY（実装Phase未着手）」と明記している。

**B. formatter等のコードが存在すること**: `assets/js/record-dashboard-foundation.js`のSST adapter（935-989行）には、Parity Audit文書が「未着手」としていたはずの`getDetails`・`getCsvActions`が**既に実装済みで存在する**（コード自身が`SST-COMMON-RECORD-DETAIL-INTEGRATION-1`という実装Phase名を参照している）。

**C. Production UIから利用できること**: `learning-records.html`の`openDetailModal()`（599-654行）は、どのappIdであっても汎用的に`FOUNDATION.getRecordDetails()`・`FOUNDATION.getCsvActions()`を呼び出す仕組みであり、SSTのadapterが両関数を提供するため、実際にSSTのrecordを開くとLevel 2 detail・CSVボタンが表示される経路が実装として存在する。

**結論**: SSTのCommon Learning Records統合は、Level 2 detail・CSV Parityとも実装済み・Production Releasedである。`docs/records/sst-common-record-detail-parity-audit-v1_0.md`の「Draft / SUMMARY ONLY」という記述は古い（stale）。この文書自体の更新は本Phaseのscope外（§23）。

**週次・複数週にわたる集計表示との関係（本Phaseで記述を精緻化）**: SST app-local側には、`sst-app.html`自身の`buildReport()`/`buildWeekChart()`という**単一週（今週）を対象にした既存の週次グラフ**が既に存在する。「週単位の集計表示が存在しない」というのは正しくない。本Phaseで新規に設計する「4週間のふりかえり」は、この既存の単一週表示を**複数週（4週）にまたがる形へ拡張する**ものであり、「全く新しい概念を持ち込む」のではなく「既存の週集計パターンの時間軸方向の拡張」である（§6・§18）。

一方、**Common Dashboard（`learning-records.html`・`assets/js/record-dashboard-foundation.js`・`assets/js/record-dashboard-ui.js`）側には、週・月いずれの単位の集計・grouping機能も存在しない**（`groupByDate()`という日付単位のgroupingのみ）。これは上記のSST app-local側の既存週次グラフとは別の、独立したコードベースの話である。「月間」「monthly」「weekly」のgrouping関連コードがCommon Dashboard側のファイル（`record-dashboard-foundation.js`/`record-dashboard-ui.js`/`learning-records.html`）に存在しないことをgrep確認済みであり、「リポジトリ全体」という過度に広い主張はしない。

### 3.8 既存の個別アプリimport/restore機能（本Phaseで訂正）

前Phase文書は「import/restore機能はサイト全体に現状存在しない」としていたが、これは誤りである。本Phaseで再確認したところ、**`matching-app.html`・`schedule-app.html`には、JSON ファイルによるimport（`import-sets-file`/`import-file`）およびbackupからのrestore UI（`restore-item-label`、`formatBackupDate`）が実際に存在する**（`assets/js/record-dashboard-foundation.js`の「Full Backup」はexport-onlyで別物、§3.6参照）。SST自体にはこの種のimport/restore機能は存在しないが、「サイト全体に存在しない」という一般化は事実と異なるため訂正する。本Phaseはこれらの機能をSSTへ追加することを検討しておらず、スコープ外として扱う（§23）。

---

## 4. 保存期間（30日）と4週間の時間窓の関係（実際の期間長を再計算、§19.3の根拠）

§9.1で確定する時間窓は、「今週の月曜から3週間前の月曜0時」から「now（集計時点）」までである。今週の月曜から3週間前の月曜0時までの距離は常に21日である。そこへ、「今週の月曜0時からnowまでの距離」（0日〜6日+αの範囲、曜日によって変動）が加わる。したがって、**時間窓の最古の境界は、nowから数えて最短21日前・最長でも28日未満前にしかならない**（今週が日曜の場合でも、月曜0時から日曜23時台までは7日未満のため、21日+7日未満=28日未満）。

これは通常の30日retention（§3.4）に常に収まり、2日以上の余裕がある。夏時間（DST）の影響は最大でも1〜2時間程度であり、この日単位の計算結果を変えない。

**したがって、「30日retentionを理由に最古週の記録が失われている可能性がある」という説明は、通常の動作では正しくない。** 実際に記録が見えなくなりうる理由は、保存期間の経過そのものではなく、以下のような別の要因である:

- 新しい活動を保存する際に過去30日分のみが残る仕組み自体（§3.4）により、**長期間SSTを全く使っていない状態から急に使い始めた場合**、その保存イベントの時点で30日より古い記録が削除される（ただし、本機能が対象とする直近4週間＝最大28日未満の範囲内でこれが起きることは通常ない）
- 記録の削除（ブラウザのデータ消去等）
- 別のブラウザ・別の端末での利用（記録はdevice-level、§12）
- storageの読み込み失敗（§11）

この認識に基づき、§19.3の説明文を訂正する。

---

## 5. Data sufficiency audit

週別の活動記録件数・活動種別内訳は11 type全てで安全に算出可能（`ts`/`type`のみで足りる）。tier別内訳は8 detail-type・活動タイプ別限定でのみ安全（3値/4値混在のため横断合算不可、v1では不採用、§6）。同一scenario/question単位の回答推移は安定IDを持つtypeが限定的かつ再実施頻度が低く小サンプル問題が大きいため、v1のscopeには含めない。

---

## 6. v1 Scope（確定）

### 6.1 v1に含めるもの

- 週別の活動記録件数（§7で定義確定）
- 活動種別の内訳（週ごと、既存`buildActivityList()`パターンの4週拡張）
- 対象期間の既存回答詳細への導線（既存「くわしいきろく」＝`buildDetailRecordList()`パターンを週ごとに展開する形で再利用）
- グラフと同じ情報を確認できる数値表（§14）
- 既存方式（`window.print()` + `@media print`）に沿った印刷／PDF保存（§17）

既存回答詳細に含まれるtierやfeedbackを、既存formatter（`sst-record-detail.js`の`getDetailRows()`相当）の仕様に従ってそのまま個別recordの詳細として表示することは、**tier集計の追加ではない**。前者はv1に含む。後者（tier別割合のグラフ・集計）はv1から除外する。

### 6.2 v1から外すもの（将来候補として分離、本Phaseでは設計しない）

- tier別割合／内訳のグラフ・集計
- 同一scenario/questionの選択変化グラフ
- 独立した「回答数」指標（§7の通り、活動記録件数で代替）
- 個人識別・生徒別プロフィール
- 共通Dashboard（`learning-records.html`）側への機能追加
- record schema変更
- 保存期間（30日retention）の変更
- サーバー・アカウント・cloud DB導入
- import/restore機能の追加（§3.8、他アプリに存在することは確認したが、本Phaseの対象外）

---

## 7. 「活動記録件数」の定義（確定、11 typeに訂正）

### 7.1 11活動typeの記録単位（実コード確認）

| # | 正式名 | `type` | 保存タイミング（実コード根拠） | 1 recordが表す単位 | 中断・再試行の扱い | 重複記録の既存仕様 | 集計対象 |
|---|---|---|---|---|---|---|---|
| 1 | ロールプレイ（built-in/custom） | `rp` | `answerRP()`、選択肢確定の瞬間（`sst-app.html:5747`） | 1回の選択確定 | 選択前に離脱すれば記録なし（0件） | 同じ場面を再度選べば新規recordが別途生成される | ○ |
| 2 | ことばクイズ | `wq` | `buildWordQuiz()`、`currentWQIdx>=qs.length`到達時のみ（`sst-app.html:5762-5773`） | **1セッション（全問完了）＝1record** | 途中離脱は記録なし。「もう一度」は新たな完了で別recordが生成される | 完了のたびに新規record | ○ |
| 3 | ソーシャルストーリー | `story` | `storyNav()`、最終ページ到達時（`sst-app.html:9088-9093`） | 1回の最終ページ到達＝1record | 最終ページ到達前の離脱は記録なし | 最終ページから戻って再度到達すると再度recordが生成されうる | ○ |
| 4 | 分岐ストーリー | `branch` | エンディング到達時（`sst-app.html:9199-9209`） | 1エンディング到達＝1record | エンディング到達前の離脱は記録なし | 「別の道を試す」で再プレイし到達すれば新規record | ○ |
| 5 | きもち日記 | `diary` | 日記保存時（`sst-app.html:8781`） | 1回の日記保存＝1record | — | 保存のたびに新規record | ○（件数のみ。自由記述内容は参照しない、§15） |
| 6 | SSTクイズ | `quiz` | `showQuizFin()`、全問完了時（`sst-app.html:6105-6119`） | **1セッション（全問完了）＝1record**（wqと同型） | wqと同型 | wqと同型 | ○ |
| 7 | きもち温度計 | `thermo` | スライダー確定時（`sst-app.html:9684-9691`） | 1回の記録確定＝1record | — | 確定のたびに新規record | ○（件数のみ） |
| 8 | きもちを落ち着ける（呼吸） | `breath` | 画面表示1秒後に自動（`sst-app.html:5534`） | 画面が1秒以上開かれた＝1record。**この記録は「保存イベントが発生した」という事実のみを表し、呼吸法を実際に行ったことの証拠ではない**（選択を伴わない唯一のtype、§8参照） | 1秒未満で離脱すれば記録なし | 再訪問のたびに新規record。**複数回の再訪問によって生成された複数recordも同様に「画面が開かれた」という事実のみを表す** | ○ |
| 9 | 写真で練習 | `photo` | 選択肢確定時（`sst-app.html:8599`） | 1回の選択確定＝1record | 中断時は記録なし | 再プレイで新規record | ○ |
| 10 | きもちカード | `emotion` | カード選択時（`sst-app.html:5636`） | 1回の選択＝1record | — | 再選択で新規record | ○ |
| 11 | フレーズ集 | `phrase` | 読み上げ実行時／コピー実行時、2つの独立トリガー（`sst-app.html:9326,9330`） | 1回の実行（spoken または copied）＝1record | 閲覧のみは記録なし | 実行のたびに新規record（同一フレーズの読み上げ+コピーで2 record） | ○ |

### 7.2 定義（確定文言）

**表示名は「活動記録の件数」とする。**

> 「活動記録の件数」は、対象期間に保存された記録（record）の数です。1つの記録は、アプリ内のひとつの活動の区切り（選択肢を選んだ、クイズを最後まで終えた、物語を最後まで読んだ、など）を表します。授業の回数・相談の回数・利用した人数を示すものではなく、必ずしも「回答した数」そのものと一致するわけでもありません（1つのクイズに複数の設問が含まれていても、記録としては1件です）。

### 7.3 重複排除ポリシー（確定: 新規ルールを導入しない）

新しい重複排除ルールは導入しない。対象期間内の`activityLog`の各要素を、保存されたとおりに1件として数える。既存コードのどこにも「同一セッション・同一scenarioの再実行を1件にまとめる」ロジックは存在しない。異なる粒度のrecordを合算した数値は、「活動量」や「学習成果」の比較指標としては扱わない（§2 Non-goals）。

---

## 8. Rejected metrics / 解釈上の注意（Do NOT Invent a Composite Score）

- SST Score / 総合点、Social Skill % / 社会性スコア、成長度・改善度の自動断定、best=3/good=2/try=1式の機械的採点、tierの平均点、アプリ横断の正答率・能力ランキング — いずれも不採用（`tierOf()`周辺の既存コードコメントが「不正解集計をしないこと」と明示的に警告していることを根拠として維持）。
- 「回答数」を独立指標として使うこと — §7.1の通りrecord粒度が不揃いのため不採用。「活動記録件数」（§7.2）で代替する。
- tier別割合・内訳のグラフ化 — v1から除外（§6.2）。
- **呼吸活動（`breath`）のrecord件数を「呼吸法を実践した回数」と解釈すること** — §7.1の通り、このtypeは画面表示から1秒後に自動的に記録される仕様であり、ユーザーが実際に呼吸法を行ったことを確認する仕組みを持たない。件数は「画面が一定時間開かれた」という保存イベントの発生回数を示すに留まる。
- **未知の`type`文字列を持つrecordの件数を「何らかの活動を実施した確実な証拠」と解釈すること** — `ACT_LABEL`に無い`type`は、record自体は実在するが、その内容・意味を本機能が正しく解釈できないことを示す（§11状態5、§9の後続）。型が欠損・不正（`type`が存在しない、文字列でない等）な場合とは区別して扱う（§11状態5と6/7の違い）。

---

## 9. Time-window definition（確定、集計終点を訂正）

### 9.1 期間定義

**「今週を含む、月曜起点の4週間」を採用する。ただし集計の終点は「今週の日曜」ではなく「now（集計実行時点）」とする。**

- 集計開始時に`const now = new Date();`を**1回だけ**取得する（§9.4）。
- 時間窓の開始（最古の週の開始）は、今週の月曜00:00:00.000の**3週間前（21日前）**の月曜00:00:00.000。
- 過去3週（第1〜3週、今週を含まない）は、それぞれ**「その週の開始以上・翌週の開始未満」**という**半開区間**で判定する（`weekStart <= ts < nextWeekStart`）。23:59:59.999という形での終点指定は行わない。
- **今週（第4週）は「今週の月曜00:00:00.000以上・now以下」**で判定する（`thisMonday <= ts <= now`）。今週の日曜まで含めない。
- 週は**古い週から今週の順**に並べる（第1週＝最も古い、第4週＝今週）。
- **今週（第4週）は「集計中」であることを画面上で明示する**（週全体がまだ経過していないため）。
- 各週の**表示用の日付ラベル**（`M/D（月）〜M/D（日）`形式、既存`getWeekRange().label`と同じ書式）は、週全体の暦日範囲（今週であれば月曜〜日曜）をそのまま示してよい。ただし、**実際に収集された記録がその週の「集計時点（now）」までのものである場合、表示ラベル上の期間と実際の集計対象期間が今週に限り異なる**ことを画面上に明示する（下記9.1.1）。

### 9.1.1 集計時点の表示（確定）

画面・PDFの両方に、**「集計時点: YYYY年M月D日 H:MM」のような形式で、§9.4で取得した`now`の値を明示する**（§16.2 PDF Acceptance Criteriaにも反映）。これにより、今週（第4週）の件数が週の他の曜日分を含んでいない理由が利用者に伝わる。

### 9.2 Timezone

既存`getWeekRange()`/`getWeekKey()`と同じ基準（ブラウザのローカル端末時刻、`new Date()`のlocal time methods）をそのまま踏襲する。UTC基準には変更しない。

### 9.3 固定ミリ秒演算の妥当性（確定: 使用しない）

週境界の算出には、`Date.now() - N*24*60*60*1000`のような固定ミリ秒の加減算を使用しない。既存`getWeekRange()`/`getWeekKey()`が採用している`Date.prototype.setDate()`ベースの暦対応演算をそのまま4週間に拡張する（`mon.setDate(mon.getDate() - 21)`のように暦日単位で遡る）。

（注: 既存の30日retentionフィルタ自体は固定ミリ秒演算を使用しているが、これは既存の別メカニズムであり、本Phaseでは変更しない。）

### 9.4 「今」を1回だけ取得する

新規の4週間集計関数では、関数の冒頭で`const now = new Date();`を1回だけ取得し、週境界・今週判定・集計時点表示（§9.1.1）まで全てこの1つの値から算出する。画面を開くたび、または表示を更新するたびに、この取得と後続の算出を**毎回新しく計算し直す**（前回表示時の値をキャッシュして再利用しない）。

### 9.5 timestampの分類（確定: A/B/C/Dの4分類）

既存コードには無効timestamp・未来timestampへの明示的なvalidationが無い（§3.3）。本機能では以下の4分類を新規に確定する。

| 分類 | 定義 | 扱い |
|---|---|---|
| **A. 対象期間内の有効timestamp** | §9.1の4週間（週1〜週4それぞれの区間）のいずれかに該当する、有効な数値timestamp | 該当する週の集計対象とする |
| **B. 対象期間開始前の正常timestamp** | 有効な数値timestampだが、週1の開始（最古の週の月曜00:00:00.000）より前 | **単なる期間外として除外する。「期間を判定できない記録」には含めない。** 画面・PDFへの特別な注記は行わない（4週間より前の活動は、単にこの表示の対象外であるという通常の事実であり、異常ではないため） |
| **C. nowより後のtimestamp** | 有効な数値timestampだが、§9.4で取得した`now`より後 | 未来の記録として週別集計から除外する。**「同じ週の範囲に収まるから」という理由では集計しない**（§9.1の今週の上限が`now`であるため、定義上そもそも今週にも含まれない）。件数を別枠でカウントし、画面・PDFに注記する（§11.1状態6） |
| **D. 無効timestamp** | `ts`が有限の数値でない（`NaN`・`undefined`・文字列等）、または配列要素自体が不正でtimestampを特定できない | 日時を確認できない記録として週別集計から除外する。件数を別枠でカウントし、画面・PDFに注記する（§11.1状態7、Cとは別の文言） |

**有効なtimestampの判定基準**: `typeof ts === 'number' && Number.isFinite(ts)`に加え、その値をDateとして解釈した際に有効な日時になること（`!isNaN(new Date(ts).getTime())`）の両方を満たすことを有効の条件とする（数値として有限であっても、念のためDateとしての妥当性も確認する二重のチェックとする）。

**配列要素自体の安全な取り扱い**: `activityLog`の各要素について、まず要素自体が`null`でないオブジェクトであることを確認してから`ts`等のfieldへアクセスする。`null`・`undefined`・非オブジェクトの要素が混在していても、その要素のみを分類D（無効）として扱い、処理全体が例外で停止しないようにする。

### 9.6 表示更新・再表示時の再計算

§9.4の通り、画面を開くたび・表示を更新するたびに毎回計算し直す。

### 9.7 名称の統一

「1か月」「過去28日」「過去30日」「直近4週間」を同義として扱わない。UI名称は**「4週間のふりかえり」**を基本とする（§19）。実際の時間窓は月曜起点の4週間であり、集計終点が`now`であるため、今週分を除く3週間（21日）に今週の経過分（0〜7日未満）を加えた、最短21日・最長28日未満の範囲になる（§4）。

---

## 10. 30日保持との関係（確定）

- pruneは`saveActivityLog()`時にのみ実行され、`loadActivityLog()`（読み込み）は実行しない（§3.4）。
- 4週間のふりかえり機能はread-only専用の新規集計関数として設計し、`saveActivityLog()`を一切呼ばない。
- §4で確認した通り、本機能が対象とする時間窓（最大28日未満）は通常の30日retentionに常に収まる。**「保存期間内であれば必ず全ての活動が残っている」ことまでは保証しないが（§3.4参照、削除・別端末利用等の理由により）、通常の30日retentionの経過そのものを理由に最古週の記録が欠落する、という説明はしない**（§19.3で訂正済み）。
- 保持期間（30日）自体は本Phaseで変更しない。

---

## 11. 記録なし・不明・読込失敗の扱い（確定、分岐を精緻化）

### 11.1 状態ごとの表示・集計・詳細・PDF方針

| # | 状態 | 画面表示 | 集計への算入 | 詳細展開 | PDF |
|---|---|---|---|---|---|
| 1 | 対象期間に有効なrecordがある | 通常表示（件数・内訳） | 通常算入 | 通常表示 | 通常印刷 |
| 2 | 4週間全体でrecordが1件もない（読み込みは正常） | 「この期間に保存された記録はありません。」（中立的な文言、§19） | 件数0として表示。**グラフは0件週に正の高さの棒を与えない**（§14.2） | セクション自体を簡潔な空状態表示に置き換える | 同じ文言をそのまま印刷 |
| 3 | ある週だけrecordがない | その週のみ「記録なし」、他の週は通常表示。**グラフはその週に正の高さの棒を与えない**が、数値表には「0」または「記録なし」を明示する（空欄にしない、§14.2） | その週は0、他週は通常 | その週の展開は「この週の記録はありません」 | 同上 |
| 4 | `ts`/`type`は有効だが`detail`がないlegacy record（`photo`/`thermo`/`diary`、custom RP等） | 件数・曜日・活動種別には通常どおり算入 | 算入する | 詳細展開には出さない（`detail`が無いため、捏造しない） | 件数には含むが詳細欄は空欄のまま |
| 5 | 未知の`type`（`ACT_LABEL`に無い文字列だが、`type`自体は有効な文字列） | 件数には算入（recordが実在する事実は変えない）。アイコン/ラベルは既存の汎用fallbackパターン（`ACT_LABEL[type]\|\|{ico:'📌',name:type}`、`sst-app.html:6953`）を踏襲。**ただし「この活動を実施したことの確実な証拠」という断定はしない**（§8） | 算入する | 可能な範囲で汎用表示 | 同上 |
| 6 | C: nowより後のtimestamp（§9.5） | 「保存日時が現在より後になっている記録が◯件あります。端末の日時設定をご確認ください。」 | 週別集計には不算入、別枠countのみ | 対象外 | 同じ注記を印刷にも含める |
| 7 | D: 無効timestamp、またはtype欠損等で日時・種別を特定できない配列要素（§9.5） | 「保存日時を確認できない記録が◯件あります。」（状態6とは異なる文言） | 週別集計には不算入、別枠countのみ | 対象外 | 同じ注記を印刷にも含める |
| 8 | storage読込失敗（JSON破損・非配列・空文字列等、§11.2） | 「記録を読み込めませんでした」という、0件とは異なる専用メッセージ。**グラフ自体を描画しない**（0件のグラフを表示しない） | 集計自体を実行しない | 対象外 | 印刷時も同じ読み込み失敗メッセージ、グラフは印刷しない |
| 9 | `detail`の一部が不正・不足（`detailSchemaVersion`不一致等） | 件数には算入（`ts`/`type`が有効なため） | 算入する | `detail`由来の表示のみ省く（既存Record Detail Contract §12.2の原則を適用） | 同上 |

「記録なし」（状態2・3）と「読み込めない」（状態8）は明確に異なる文言・異なる状態として扱う。状態6（未来）と状態7（無効）も互いに異なる文言とする（§9.5のC/D）。状態2（B: 期間外として扱われるので画面には現れない）と状態8（読込失敗）は原因が全く異なるため混同しない。

### 11.2 読み込み判定の分岐（確定、本Phaseで精緻化）

既存Foundation API（`donomanaRecordReadLog()`）は本Phaseで変更しない。新規集計関数の冒頭で、**共有プリミティブに依存しない読み込み確認専用の最小限のローカル処理**を行う:

1. `localStorage.getItem('sst_activity_log_v1')`を直接呼ぶ。この呼び出し自体が例外を投げる場合（storageアクセス不可等）→ **読み込み失敗**（状態8）。
2. 戻り値が`null`→ **記録なし**（状態2、「一度も使っていない」という解釈はしない。削除等の可能性があるため、§12の原則に従い中立的に扱う）。
3. 戻り値が空文字列、または空白のみの文字列 → **読み込み失敗**（状態8。通常、未使用時はキー自体が`null`になるため、空文字列・空白文字列はそれ自体が想定外の保存値であり、正常な「未使用」とは区別する）。
4. 戻り値が非空文字列 → `JSON.parse()`を試みる。
   - 例外を投げる → **読み込み失敗**（状態8）。
   - parse結果が配列でない → **読み込み失敗**（状態8）。
   - parse結果が配列（空配列を含む） → 次のステップへ。
5. 配列の各要素について、§9.5の基準で個別に有効性を判定する。要素自体が`null`・非オブジェクト、または`ts`/`type`を特定できない要素は、その要素のみを状態7（無効）として扱い、処理全体を止めない。
6. 全要素の判定が終わった時点で、分類Aに該当する要素が1件もなければ、**分類Bのみ（期間外）の場合は「記録なし」ではなく単に「対象期間に該当なし」として状態2相当の表示にする**（期間外のrecordが存在すること自体は異常ではないため、「記録なし」という表現で問題ない）。

**「確認した同じ読み込み結果を集計に使う」**: 上記ステップ1〜6で得た1回限りの読み込み結果（parse済みの配列、またはエラー状態）を、その後の週別集計・活動種別内訳・詳細表示の**全てに使い回す**。同じレンダリングの中で`donomanaRecordReadLog()`や`localStorage.getItem()`を再度呼び出し、異なる読み込み結果が混在することを避ける。

この設計により、「活動を一度もしたことがない」（state 2、中立的な「記録なし」表示）と、「何らかの理由でデータが読めない」（state 8、別の専用メッセージ）を、本機能に限り正しく区別できる。既存の`donomanaRecordReadLog()`/`loadActivityLog()`/`saveActivityLog()`自体への変更は行わない。

---

## 12. 端末／ブラウザ単位の記録（確定）

### 12.1 個人識別機能が無いことの再確認

`sst-app.html`に`kyou-no-kiroku.html`の`children[]`配列に相当する個人識別の仕組みは存在しない（grep実測、該当構造0件）。`sst_activity_log_v1`は完全にdevice-level/browser-levelのstorageであり、「誰の記録か」を区別する情報を一切持たない。

### 12.2 表示方針（確定）

表示は「**このブラウザに保存された記録**」を基本文言とする。

- 禁止: 生徒名の自動推定、記録全体を「この生徒の変化」と表示すること、活動件数を人数と解釈すること、v1への個人識別機能の追加。
- 記録が無いことから「活動が無かった」「一度も活動していない」「未実施」「未使用」を断定しない。記録の削除・別ブラウザでの利用・保存開始前等、複数の可能性がありうることを前提とする（§19）。
- 複数人が同じ端末・ブラウザで利用した場合に記録が混在しうることを、画面とPDFの両方で簡潔に示す（§19の確定文言）。実装の内部事情を長く説明するUIにはしない。

---

## 13. UXを確定する

### 13.1 既存構造の調査結果

`#s-report`（今週のレポート画面）は単一の`.scr`画面で、`#report-card`（印刷対象）と、その外側の`.report-actions`（PDF保存／共有／CSV書き出しの3ボタン）で構成される（`sst-app.html:3412-3502`）。画面遷移は全て`.scr`クラス＋`go(id)`関数による共通パターン（`.scr{display:none} .scr.on{display:block}`、`sst-app.html:167-168,5492-5504`）。`go(id)`は`window.scrollTo(0,0)`のみ実行し、特定要素への明示的なfocus移動は行っていない（全画面共通の既存動作）。

**本Phaseで新たに確認した既存の再利用可能なfocus管理パターン**: `sst-app.html`には、アクセシビリティ設定パネルの開閉に関する、より踏み込んだfocus管理の実装が既に存在する（`sst-app.html:2401-2433`、`2479-2553`）。具体的には:
- `donomanaIsFocusable(el)`（2485-2493行）: 要素が実際にfocus可能かどうかを、`disabled`・`tabIndex===-1`・`hidden`祖先・`inert`祖先・クライアント矩形・`display`/`visibility`/`opacity`まで含めて判定するヘルパー。
- `donomanaFirstFocusable(root)`（2494-2499行）: 指定範囲内で最初にfocus可能な要素を返すヘルパー。
- パネルを閉じた際、`restoreA11yPanelFocus()`で開いた起点のボタンへ明示的にfocusを戻す実装（2428-2430行、2459行）。
- 起点要素が何らかの理由でfocus不能になっていた場合のfallback（`setTimeout`で100ms後に状態を再確認し、別のfocus対象を探す、2535-2552行）。

これらは**既存の、サイト共通層（generate.js経由で35アプリへ注入される）の一部**であり、本機能はこれを**再利用する**（新しいfocus管理手法を一から発明しない）。

戻るボタンは各画面が`<button class="back" onclick="...">← もどる</button>`を持つ既存パターンに加え、`BACK_MAP`という画面ID→戻り先関数のマップで集中管理された下部戻るボタン（`bottomBack()`）も存在する。

**Switch Scanに関する調査結果（本Phaseで新規確認）**: `sst-app.html`内で`.scannable`/`data-scan`属性が付与されている要素は、固定表示の2つのグローバル要素（アクセシビリティ設定ボタン・ホームボタン）のみであり、これらの属性を実際に読み取って独自のスキャン対象リストを構築・巡回する処理（`querySelectorAll('.scannable')`等）はファイル内に存在しない（grep確認）。すなわち、**sst-app.html自体は独自のswitch-scanエンジンを持たない**。switch操作は、物理スイッチをOS/支援技術側でキーボード入力（Tab/Enter/Space）やクリックとしてエミュレートする方式に依存していると判断する（`donomana-supporter-record-dashboard-design-v1_0.md`が指摘する「どのまな全体で共通Switch Scan基盤が存在しない」という既存の事実と整合）。したがって、新規`#s-trend`画面内の要素がnative `<button>`等としてTab順序に正しく組み込まれていれば、switch到達性は他の既存画面と同等になる。**内部的な「スキャン対象リストの再登録」処理は、そもそもそのようなリストを保持する仕組みがsst-app.htmlに存在しないため、本機能でも不要と判断する**（存在しない仕組みへの接続を新たに作らない）。

### 13.2 確定構造

既存の画面遷移パターンに合わせ、新しい独立画面`#s-trend`を追加する。「今週のレポート」内にパネルとして埋め込む案は、印刷対象の分離が難しくなる（§13.4）ため不採用。

- **導線**: `#s-report`の`.report-actions`内、既存3ボタンの先頭に新規ボタン「📊 4週間のふりかえりを見る」を追加する（`id`を付与し、以下のfocus管理から参照できるようにする）。
- **画面構造**: `#s-trend`は`#s-report`と同じ`.scr`パターンの新規画面。内部に`#trend-card`（印刷対象、§13.4）を持つ。`#trend-card`内の主見出し（例: `<h2>`相当の要素）に、プログラム的にfocusを当てられるよう`tabIndex = -1`を設定する（既存`sst-app.html:2476`の`el.tabIndex = -1`と同じパターン）。
- **focus（本Phaseで訂正、既存`go()`全体は変更しない）**: `#s-trend`を開く専用の処理（新規ボタンの`onclick`から呼ばれる、`go('s-trend')`を呼んだ後に続けて実行する薄いwrapper関数）の中で、`go()`自体は変更せず、以下を追加で行う:
  1. `go('s-trend')`を呼ぶ（既存のまま、`scrollTo(0,0)`を含む）。
  2. `#trend-card`内の主見出しへ`donomanaIsFocusable()`で確認のうえ`.focus()`する（既存ヘルパーを再利用）。

  `#s-trend`から戻る専用の処理（上部`.back`ボタン・下部`BACK_MAP`経由の戻るボタンの双方）の中で:
  1. `go('s-report')`を呼ぶ（既存のまま）。
  2. §13.2で導線として設置した新規ボタン（「📊 4週間のふりかえりを見る」）へ、`donomanaFirstFocusable()`/`donomanaIsFocusable()`パターンを使って明示的に`.focus()`する。起点ボタンが何らかの理由でfocus不能な場合のfallback（既存`sst-app.html:2535-2552`と同様、取得できなければ`#s-report`内の最初のfocus可能要素へ）も用意する。
  3. `#s-trend`内の要素にfocusが残らないようにする（`go('s-report')`による`display:none`化で自然にfocusはBODYへ落ちるため、上記2のfocus移動で確実に起点ボタンへ戻す）。

  これらはいずれも**`go()`関数自体や他画面の`onclick`を変更せず、`#s-trend`専用のopen/return処理としてのみ追加する**。
- **戻る**: `#s-trend`に`<button class="back" onclick="...">← もどる</button>`を設置し、`BACK_MAP['s-trend']`にも同じ戻り先処理を登録する（上部・下部の両方の戻るボタンで同じfocus復帰が成立するようにする）。
- **既存週次レポートとの表示切り替え**: `#s-report`⇄`#s-trend`は通常の画面遷移（`go()`）のみで、どちらか一方のみが`.on`になる。
- **詳細記録の週別展開**: 既存`buildDetailRecordList()`と同じ折りたたみ（`aria-expanded`同期）UIパターンを、週ごとのセクションとして4回分並べる形で再利用する。

### 13.3 画面内の表示順序（確定）

1. タイトル・対象期間・集計時点（§9.1.1）
2. このブラウザの記録であることの説明（§19確定文言）
3. 週別活動記録件数の棒グラフ
4. 同じ数値の表
5. 活動種別内訳（週ごと）
6. 回答詳細（週ごとに展開、既存パターン再利用）
7. 印刷／PDF保存ボタン

### 13.4 印刷対象の分離（確定、PDFは現在表示中のカードのみを対象とする）

既存の印刷isolationは`#report-card,#report-card *{visibility:visible;}`という固定idセレクタで実装されている（§3.6）。`#s-trend`が非activeな間は`.scr{display:none}`により`#trend-card`はそもそも描画されず印刷にも出ない。`#trend-card`を印刷可能にするには、既存ルールを次のように拡張するのみでよい:

```css
#report-card,#report-card *,#trend-card,#trend-card *{visibility:visible;}
```

`.scr.on`の排他性（どちらか一方のみ表示）により、**この拡張だけで「今アクティブな画面のカードのみ」が印刷され、非表示画面のカードが重複印刷される事態は発生しない**（既存`#report-card`のルール自体は変更しない、純粋な追加のみ）。言い換えると、週次レポート画面（`#s-report`）を開いているときは`#report-card`のみが、4週間のふりかえり画面（`#s-trend`）を開いているときは`#trend-card`のみが印刷される。

`#s-trend`用の印刷ボタンは独立した`printTrendReport()`（同じく`window.print()`を呼ぶだけ）として新設することを推奨する（既存`printReport()`を分岐させない）。

---

## 14. グラフと表（確定）

### 14.1 基本方針

週別の離散棒グラフを基本とする。折れ線による連続的な変化の表現は採用しない。

### 14.2 確定事項（本Phaseでゼロ件の扱いを訂正）

- 単位: 件
- 週の順序: 古い週→今週
- 日付ラベル: 各週に`M/D（月）〜M/D（日）`形式。今週は集計時点の注記も併記（§9.1.1）
- **0件の週には正の高さの棒を与えない**（既存`buildWeekChart()`は0件日にも4pxの最小バーを与えているが、本機能ではこれを踏襲しない。棒自体を描画しない、またはプレースホルダのみとする。正の高さを与えるのは正の件数を持つ週のみとする）
- **数値ラベル（グラフ上）**: 既存`buildWeekChart()`と同じ方式（`counts[i]||''`、0件のときはグラフ上では空欄表示）。ただし、
- **数値表（§14.3、グラフとは別のテキスト等価物）では、0件の週を空欄にせず、明示的に「0」または「記録なし」と表示する**（空欄表示はグラフの視覚的文脈でのみ許容し、テキスト等価物では常に明示する）
- 今週が途中であることの表示: 今週（第4週）のバー・ラベルに「集計中」等の注記を付す（§9.1）
- 全週記録なしの場合: §11.1状態2の表示
- 最大値が小さい場合（例: 全週1〜2件）: 正の件数を持つ週について、バーの高さが不自然に潰れない最小高さを確保してよい（0件週には適用しない）
- 大きな件数の場合: 相対スケールで表示、数値ラベルは省略しない
- 200%zoom・狭幅表示: 既存`buildWeekChart()`/`buildActivityList()`のレスポンシブパターンをそのまま踏襲
- 印刷時: §13.4の`#trend-card`印刷ルールに含める

### 14.3 グラフと表の一致

同じ週別集計結果から、グラフ（棒グラフ）と数値表（HTML `<table>`または明示的なリスト）の両方を生成する。両者は同じ集計関数の出力を参照し、別々に計算しない。活動種別内訳も同じ集計関数の出力を参照する。

### 14.4 色・アニメーション・forced colors（本Phaseで追加）

色だけに依存しない（数値ラベル・テキストラベルを必ず併記）。新規のアニメーションは追加しない。`prefers-reduced-motion: reduce`は既存CSS（`sst-app.html:52`）が既に全体に適用されているため、新規セクションも自然に対象となる。

**forced colors（本Phaseで新規に要件化、§16.1）**: 本コードベース全体には`forced-colors`/`prefers-contrast`への既存対応パターンが無いことをgrepで確認した（§16.1）。**しかし「既存に無いこと」を本機能の検証除外理由にはしない。** 新規セクション（`#trend-card`配下）に限定して、以下を満たすことをAcceptance Criteriaとする:
- 棒グラフの各バーは、背景色の塗りのみに依存せず、境界線（`border`）または`currentColor`に基づく描画で、forced colorsモードでも形状が判別できるようにする。
- focusインジケータは、既存の`:focus-visible`等のoutlineベースの表示（box-shadowのみに依存しない）を踏襲し、forced colorsモードでも視認できるようにする。
- これらはあくまで新規セクション内に限定した対応であり、既存の他画面への遡及的な改修は行わない（§6.2 Out of scope）。

---

## 15. Privacy

local-firstを維持する。新規サーバー送信・account必須化・cloud DB・外部chart serviceへのrecord送信・学生データを含む解析イベント・新規外部依存の追加はいずれも行わない。`sst_diary_entries_v1`は参照しない。`diary` typeの`activityLog`上のrecordには気持ち名の結合文字列（`result`）のみが入り自由記述本文は含まれないため、件数集計に`diary`を含めても自由記述内容が集計へ取り込まれることはない。グラフ描画はnative SVG/Canvasまたは既存`buildWeekChart()`と同じ実装方式（local rendering）を用い、新規external chart libraryを追加しない。記録由来テキストの安全な描画（HTMLエスケープ等）は既存`sst-record-detail.js`・`buildDetailRecordList()`のパターンをそのまま踏襲する。実ユーザーの記録を調査・テストのために外部へ送信することはしない。

---

## 16. Accessibility / PDF Acceptance Criteria（確定）

### 16.1 Accessibility

- 色に依存しない（§14.4）
- forced colors（§14.4、新規セクション限定で要件化）
- 数値表による等価情報（§14.3）
- 画面遷移・開閉トグルはnative `<button>`、`aria-expanded`で状態通知
- keyboard操作: 新規要素は全てTab到達可能なnative interactive element
- **focus管理（本Phaseで訂正）**: §13.2の通り、`#s-trend`専用のopen/return処理で、開いた際は主見出しへ、戻った際は起点ボタンへ、それぞれ明示的にfocusを移す。既存`donomanaIsFocusable()`/`donomanaFirstFocusable()`ヘルパーを再利用する。既存`go()`関数・他画面のfocus挙動は変更しない。
- screen readerの読み順: DOM順序どおり（タイトル→説明→グラフのtext alternative→表→活動内訳→詳細）。グラフ要素自体は`aria-hidden`とし、実データはテーブル/リスト側のsemantic markupで提供する
- **switch利用（本Phaseで訂正）**: §13.1の調査の通り、sst-app.htmlは独自のswitch-scanエンジンを持たず、native Tab順序への到達性が実質的な到達性要件である。新規要素が全てnative interactive elementとしてTab順序に組み込まれることを確認する（自動テストで検証、§21）。
- 200%zoom・狭幅表示: §14.2
- `prefers-reduced-motion`: 既存CSS（`sst-app.html:52`）の対象に自然に含まれる
- iPad Safari: 実機未確認。Real Device Gateとして別途ユーザー確認が必要（§16.3で明示）

### 16.2 PDF Acceptance Criteria

- タイトル・対象期間・**集計時点**（§9.1.1、`#trend-card`内に明記）
- 記録の意味と共有利用に関する説明: §19確定文言を`#trend-card`内に含める（印刷時も表示）
- グラフ・表の一致: §14.3
- **印刷対象は現在表示中のカードのみ**（§13.4、週次レポートと4週間のふりかえりが同時に印刷されることはない）
- 回答詳細を含める範囲: 画面上で展開済みのものだけでなく、既存`.report-detail-body[hidden]{display:block!important;}`と同じCSSのみによる強制展開パターンを`#trend-card`配下にも適用し、JS/DOM操作なしに印刷時は全展開済み状態にする（展開状態に依存して内容が欠落しない）
- **長い詳細の改ページ（本Phaseで矛盾を解消）**: `break-inside:avoid`は**個別の小ブロック単位**（例: 1件の活動記録detail card、1つの統計値ボックス）にのみ適用する。週セクション全体や`#trend-card`全体には適用しない（4週間分の内容量では1ページに収まらずレイアウトが破綻するため）。長い回答詳細のリストが自然なページ区切りをまたぐこと自体は許容するが、その場合もコンテンツが非表示・切り捨てになることはない（通常のHTML印刷のページ送りに委ね、`overflow:hidden`等で内容を隠す実装はしない）。
- 既存週次印刷の非回帰: §13.4の設計（既存`#report-card`ルールは変更せず追加のみ）により、既存`printReport()`の出力は影響を受けない。実装Phaseで自動テスト（既存`pdf-print-implementation-test.js`と同じ手法）による非回帰確認を必須とする

### 16.3 自動検証と実機確認の区別（確定）

iPad Safari・VoiceOver等の実機確認はいずれも自動検証で代替しない。Playwright等による自動テストは実施するが、これを「実機確認済み」として報告することはしない（CLAUDE.md §5 Real-device boundaryに従う）。実装Phase完了後、Real Device Gateとしてユーザー自身による確認を別途依頼する。

---

## 17. PDF / Sharing contract

既存`window.print()` + `@media print`方式を拡張する（§13.4）。新規PDFライブラリは導入しない。

---

## 18. Learning Records relationship（確定、§3.7の結論を反映）

SSTのCommon Learning Records（`learning-records.html`）統合は、Level 2 detail・CSV Parityとも実装済み・Production Releasedであることを確認した（§3.7）。**Common Dashboard側には週・月単位の集計・grouping機能が存在しない**一方、**SST app-local側には既存の単一週グラフ（`buildWeekChart()`）が既に存在する**（§3.7）。「4週間のふりかえり」は、この既存の単一週表示を複数週に拡張するSST app-local機能として設計する（Donomana全体の巨大dashboardは設計しない、§2）。

集計ロジック自体は、将来的に他のFoundationアプリへ転用可能な形（生のrecord配列と週定義を受け取り週別集計を返す汎用関数）で設計してよいが、大きな共通frameworkを今回新たに設計することはしない。実装対象は今回もSSTに限定する。

共通Dashboard側への機能追加は本Phaseのscope外であり、次Implementation Phaseでも行わない（§6.2）。`docs/records/sst-common-record-detail-parity-audit-v1_0.md`のstaleなステータス表記の更新も、本Phaseでは行わない（§23）。

---

## 19. 確定した説明文（Wording、本Phaseで§19.3を訂正）

### 19.1 主説明文（画面・PDF共通、確定）

> この表示は、このブラウザに保存された活動と回答の記録です。件数や回答の違いだけで、能力・心理状態・支援の効果を判断することはできません。本人の様子や取り組んだ場面と合わせて、ふりかえりにご活用ください。

### 19.2 共有端末に関する注記（確定）

> 同じブラウザを複数人で使うと、記録が一緒に表示されます。

### 19.3 保存の仕組みに関する注記（本Phaseで訂正）

**訂正前（削除）**: 「記録の保存期間は30日です。最も古い週は、一部の記録がすでに保存期間を過ぎている可能性があります。」（§4で確認した通り、本機能の対象期間は最大28日未満であり、通常の30日retentionの経過だけでは最古週の欠落を説明できないため、誤解を招く記述だった）

**訂正後（確定）**:

> 記録は、新しい活動を保存する際に、過去30日分だけが残る仕組みです。記録の削除や、別のブラウザ・端末での利用などにより、この表示だけでは活動の全体を確認できない場合があります。

この文言は、保存期間（30日）の仕組み自体を正確に説明しつつ（「読み込み時に削除される」とは述べない、§3.4の通りpruneは保存時にのみ発生する）、記録の完全性（この表示に全ての活動が反映されているとは限らないこと）を保存期間の完全性（30日分は必ず残っている）と混同しない表現にしている。

### 19.4 空状態の文言（本Phaseで追加・統一）

> この期間に保存された記録はありません。

既存`buildActivityList()`の「今週のきろくがないよ。いろんな活動をやってみよう！」という文言は、今まさに使っている本人への励ましとして書かれたものであり、本機能（教員・支援者が過去を振り返る用途）にそのまま転用すると「まだ達成していない」という含意を持ちうるため、本機能では採用しない。本機能の空状態文言は、記録が無い理由（未実施・削除・別端末利用等）を断定しない、中立的な表現に統一する（§12.2）。

### 19.5 名称（確定）

**「4週間のふりかえり」**。「1か月」「月間成果」「成長グラフ」「能力グラフ」はいずれも不採用。実際の時間窓は月曜起点の4週間（最短21日・最長28日未満、§9.7）であり、暦月とは一致しない。

### 19.6 Wording Audit

禁止語（成長/改善/能力/心理状態/正解率/正答率/月間成果/成長グラフ・能力グラフ）、推奨語（記録/きろく/ふりかえり/回答/選択/傾向/推移/利用状況/教材内区分/直近4週間）の判定を維持する。

---

## 20. Data transformation rules（確定、分類ロジックを更新）

1. **読み込み確認**: §11.2の分岐を先頭で実行し、以後の処理は**この1回の読み込み結果のみ**を使い回す。
2. **要素の安全な検証**: `activityLog`の各要素について、§9.5の基準でA/B/C/Dに分類する。null等の不正な要素は例外を発生させずDとして扱う。
3. **週バケット化**: §9.1-9.4の確定ロジックに従い、「今」を1回取得したうえで、過去3週は半開区間`[weekStart, nextWeekStart)`、今週は`[thisMonday, now]`で算出する。
4. **活動記録件数**: 分類Aに該当する`activityLog`要素数を該当週ごとにそのままカウントする（§7.3、重複排除・フィルタなし）。分類B（期間外）は無視（カウントしない、通知もしない）。分類C・Dは別枠でカウントし、週別集計には含めない。
5. **活動種別内訳**: 週バケット内で`type`ごとにグループ化しカウントする（既存`buildActivityList()`と同じロジック）。
6. **詳細展開**: `detail`を持つrecordのみ、既存`buildDetailRecordList()`と同じロジックで週ごとに表示する。`detail`を持たないrecordは件数には含むが詳細欄には出さない。
7. **既存recordの不変性**: 本機能はread-onlyの集計であり、`activityLog`・`sst_activity_log_v1`への書き込みを一切行わない（`saveActivityLog()`を呼ばない）。

---

## 21. Test strategy（確定、A/B/C/D分類と11 typeに合わせて更新）

実装Phase（`SST-MONTHLY-TREND-IMPLEMENTATION-1`）向けの最低限のテスト項目:

- no records（§11状態2）／1 record／同日複数record／4週間にまたがるrecord／記録が無い週がある（§11状態3）
- `detail`を持たないlegacy record（§11状態4、custom RP・photo・thermo・diaryを含む）
- 複数SSTアプリ（type）が混在、**11 type全ての完全な網羅**（§7.1、12番目のtypeが誤って登場しないことの確認を含む）
- 未知の`type`（§11状態5、§8の「実施の証拠にならない」扱いが反映されること）
- **分類B（期間外の正常timestamp）が「記録なし」とは別に、単に集計対象から静かに除外されること**（通知が出ないことの確認）
- **分類C（nowより後のtimestamp）が状態6の専用文言で表示され、週集計に含まれないこと。同じ週の日付範囲に収まる場合でも除外されることの確認**
- **分類D（無効timestamp・配列要素の構造不正）が状態7の専用文言で表示され、週集計に含まれないこと**
- storage読込失敗（JSON破損、非配列、空文字列）が「記録なし」と異なる表示になり、**0件のグラフを表示しないこと**（§11状態8、§11.2の分岐の自動テスト）
- `detail`の一部が不正・不足（§11状態9）
- 週境界（半開区間での週またぎ）・月またぎ・年またぎ（§9.3の`setDate()`ベース演算の自動テスト）
- DST境界をまたぐ日付（可能な環境で）
- 「今」を複数回表示しても境界が再計算されること（§9.6）
- **同じ読み込み結果が集計全体で使い回され、二重読み込みが発生しないこと**（§11.2）
- wq/quiz/story完了時の正しい1セッション=1record集計
- phrase: 同一フレーズの読み上げ+コピーが2 recordとして集計されること
- breath: 自動記録であることと、「実施の証拠にならない」という扱いがUI文言に反映されること（§8）
- **0件週のグラフに正の高さの棒が無いこと。数値表には0件週が空欄でなく明示されること**（§14.2）
- **`#s-trend`を開いた際に主見出しへfocusが移ること。戻った際に起点ボタンへfocusが戻ること（上部・下部双方の戻るボタンで）。`#s-trend`内にfocusが残らないこと**（§13.2）
- **新規要素が全てnative Tab順序に組み込まれていること**（switch到達性の実質的な検証、§13.1・§16.1）
- forced colorsシミュレーション下でのラベル・操作・focus表示の確認（§14.4、自動テストで可能な範囲）
- PDF/印刷（`#trend-card`を含めた`@media print`のレイアウト崩れ確認、既存`#report-card`印刷の非回帰、**週次レポートと4週間のふりかえりが同時に印刷されないことの確認**、§16.2）
- iPad Safari（Real Device Gate、本Phaseでは実施しない、§16.3）
- keyboard操作・screen reader等価性（§16.1）
- 既存「今週のレポート」回帰（`buildReport()`本体の非破壊確認）
- Learning Records回帰（`record-dashboard-foundation.js`/`record-dashboard-ui.js` golden tests・SST common detail golden testsの非破壊確認）
- full golden regression（`tools/record-dashboard-poc/*golden-tests.js`全件、SST PDFテスト含む）

---

## 22. Migration / backward compatibility

migrationは不要。既存`activityLog`のrecordを書き換えない。既存recordへ後付けで擬似データを生成しない。`schemaVersion`は既存の`1`のまま変更しない。新規top-level fieldの追加は本Phaseの集計機能では不要。

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
- import/restore機能の追加（§3.8で他アプリへの存在は確認したが、SSTへの追加は対象外）
- `learning-records.html`・`record-dashboard-foundation.js`側の実装（§18）
- `docs/records/sst-common-record-detail-parity-audit-v1_0.md`のステータス表記更新（§3.7）
- Foundation API（`donomanaRecordReadLog()`等）自体への変更（§11.2、本機能専用のローカル確認で代替）
- 既存の他画面（週次レポート含む）へのforced colors対応の遡及適用（§14.4、新規セクション限定）

## 24. Risks

| リスク | 内容 | 対応方針 |
|---|---|---|
| timestamp分類の誤り | A/B/C/Dの境界判定を誤ると、期間外recordの誤算入や、未来recordの誤って今週算入等が起こりうる | §9.5の明確な4分類とテスト（§21）で担保 |
| record粒度の不揃いによる誤解 | wq/quiz/storyは1セッション=1recordだが他は1アクション=1record | 「活動記録件数」の定義文言で明示（§7.2） |
| 複数児童の端末共有 | Device-level集計のため複数人の記録が混在しうる | UI文言で明示（§19.2）、個人識別機能は追加しない |
| 印刷レイアウト崩れ | 新セクション追加による既存`@media print`への影響 | `#report-card`ルールは変更せず追加のみ（§13.4） |
| DST境界での週境界ズレ | 固定ミリ秒演算を使うと発生しうる | `setDate()`ベースの暦対応演算を採用（§9.3） |
| focus管理の実装不備 | 新規open/return処理が既存`go()`と干渉する、または既存ヘルパーの前提条件を満たさない | 既存`donomanaIsFocusable()`等を忠実に再利用し、既存ヘルパー自体は変更しない（§13.2） |
| 既存機能への回帰 | `buildReport()`本体・Common Learning Records・Golden testsへの影響 | §21のテスト戦略で網羅 |
| 利用報告の誤用 | 臨床現場での利用報告を効果の根拠と誤認されるリスク | Non-goals（§2）・説明文（§19.1）で明示的に線引き |

---

## 25. Open questions

本Phaseで、レビュー指摘として挙げられた事項は全て本文書内で確定・訂正した。**本当にUser判断が必要な残項目はない。**

強いて残すとすれば、実装Phase開始後に実コードを見ながら微調整しうる純粋なレイアウト上の細部（新規ボタンの正確な配色・アイコンの最終意匠等）のみであり、これらはImplementation Phase自身の裁量範囲として扱って差し支えない。

---

## 26. Implementation Readiness（次Phase: `SST-MONTHLY-TREND-IMPLEMENTATION-1`）

以下を実装Phaseが迷わず着手できるAcceptance Criteriaとして明記する。

- **approved v1 scope**: §6.1（含む）／§6.2（含まない）
- **対象recordと除外条件**: `sst_activity_log_v1`の全record（`diary`含む、`sst_diary_entries_v1`は除外、§15）。分類B（期間外）は無通知除外、分類C・D（§9.5）は週別集計から除外し別枠カウント
- **集計単位**: 「活動記録件数」＝record数そのもの、重複排除なし（§7.2-7.3、11 type、§7.1）
- **期間境界**: 月曜起点4週間、過去3週は半開区間、今週は`[thisMonday, now]`、`setDate()`ベース演算、「今」は1回取得（§9）
- **空状態・失敗状態**: §11.1の9状態表
- **UI構造**: 新規`.scr`画面`#s-trend`＋`#trend-card`、`#s-report`からの導線、§13.3の表示順序、§13.2のfocus管理
- **表示文言**: §19.1-19.5（確定済み、追加のUser判断不要）
- **PDF仕様**: §13.4（印刷isolation拡張、現在表示中のカードのみ）、§16.2
- **accessibility要件**: §16.1（forced colors・switch到達性・focus管理を含む）
- **想定変更ファイル**: 下記
- **必要な検証**: §21
- **実機Review項目**: §16.3（iPad Safari、Real Device Gate、実装完了後に別途依頼）

### Implementation Plan Preview（想定変更ファイル）

| File | Why needed | Expected change | Risk |
|---|---|---|---|
| `sst-app.html` | `#s-trend`画面・`#trend-card`・集計関数・focus管理用open/return処理・`printTrendReport()`の実装場所 | 新規screen・新規関数（週バケット4週拡張、§11.2の読み込み確認、A/B/C/D分類、棒グラフ描画、活動別内訳、週別detail展開、focus管理）、`.report-actions`への導線ボタン追加、`BACK_MAP`エントリ追加 | 中（9,900行超の既存ファイルへの追加。既存`buildReport()`/`#report-card`/`go()`との非干渉を§13.2・§13.4の設計通り慎重に実装する必要がある） |
| `sst-app.html`（`@media print`ブロック） | `#trend-card`を印刷対象に含めるため | `#report-card,#report-card *{visibility:visible;}`を`#trend-card`も含む形へ拡張（既存ルール自体は変更せず追加） | 低（§13.4の設計通りの追加のみ） |
| `tools/sst-weekly-report-pdf/`配下の新規または既存テストファイル | §21のテスト戦略実装 | 新規Node/Playwrightテストの追加 | 低 |

本Phaseではこれらのファイルを一切変更していない。

---

## 27. Definition of Done（本Design Correction Phase自体）

- [x] `origin/main`最新確認・Drift Gate実施（§0.1、drift 0）
- [x] CLAUDE.md Governance遵守
- [x] 正しいsource checkpoint（`83f720f600cb36657b2c788e098dc4b2992cae1c`）の存在確認・誤ったSHAが存在しないことの確認・引き継ぎ方法明記（§0.2）
- [x] 活動type数を11へ訂正（§3.1、§7.1、全箇所統一確認）
- [x] timestamp分類をA/B/C/Dの4分類へ訂正、集計終点を「今週の日曜」から「now」へ訂正（§9）
- [x] 保存期間注記を実際の期間長（21〜28日未満）に基づき訂正（§4、§19.3）
- [x] 空状態文言を断定しない表現へ統一（§19.4）、読み込み失敗との区別を精緻化（§11.2）
- [x] focus管理を既存ヘルパー再利用による具体的設計へ訂正（§13.2）
- [x] switch到達性の根拠を実コード調査に基づき明確化（§13.1）
- [x] 0件グラフの表現を訂正（正の高さを与えない、§14.2）
- [x] forced colorsを新規セクション限定のAcceptance Criteriaとして追加（§14.4）
- [x] 「リポジトリ全体に週次集計がない」という表現を、既存SST週次グラフとCommon Dashboardの区別込みで訂正（§3.7）
- [x] import/restoreの実在を確認し記述を訂正（§3.8）
- [x] break-inside:avoidの矛盾を解消（§16.2）
- [x] PDFが現在表示中のカードのみを対象とすることを明記（§13.4、§16.2）
- [x] Docs only（Production機能コード変更 0件、変更ファイルは本文書のみ）
- [x] push/merge/deployなし

---

## 28. Implementation Record（`SST-MONTHLY-TREND-IMPLEMENTATION-1`、実装・検証結果の記録）

本節は実装Phaseの結果を事実として記録するのみであり、新たな設計判断は含まない（Allowed Filesの許可範囲、§11相当）。

- **実装**: `sst-app.html`に新規画面`#s-trend`（印刷対象`#trend-card`）・集計関数群（`trendReadRaw`/`trendClassify`/`trendComputeWeeks`等）・focus管理用の`openTrendScreen()`/`closeTrendScreen()`・`printTrendReport()`を追加した。`#s-report`の`.report-actions`先頭に導線ボタンを追加した。
- **§4訂正A（見出しfocus）**: 既存`donomanaIsFocusable()`は`tabIndex===-1`を拒否するため、`tabindex="-1"`の主見出しへの focus 確認にはこのヘルパーを使わず、要素の接続状態を直接確認したうえで`.focus()`し、`document.activeElement`で実際の移動を確認する設計で実装した（自動テストで検証済み）。
- **§4訂正B（type/timestamp分類）**: A/B/C/D相当の分類に加え、「tsは有効だがtypeが無効」な要素を「日時を確認できない記録」ではなく「不正な記録」として区別する優先順位を実装した。`ACT_LABEL`参照は`hasOwnProperty`による安全な参照（`actLabelSafe()`）とし、`constructor`/`__proto__`等の値を「既知のtype」と誤認しないことを自動テストで確認した。未知typeの生の文字列はHTMLへ一切挿入しない。
- **§4訂正C（空状態）**: 「この期間に保存された記録はありません。」に統一し、「一度もしたことがない」という解釈を含む文言は使用していない。
- **§4訂正D（週キー）**: 新規集計は`getWeekKey()`のUTC文字列を使わず、ローカル時刻ベースの`setDate()`演算のみで週境界（epoch ms）を算出する。
- **実コード調査で判明した追加の修正**: 既存`buildReport()`/`downloadReportCSV()`の`activityLog.filter(a => a.ts...)`が配列内の`null`要素に対して例外を投げる既存の潜在的な不具合を発見した。`closeTrendScreen()`が`go('s-report')`経由でこの関数を必ず呼ぶため、本機能のfocus復帰を不正要素混在下で検証するにあたりこれが障害となった。`a &&`という最小限のnullガードのみを追加し、真正なrecordの判定・既存の集計結果は変更していない。
- **テスト**: 新規`tools/sst-weekly-report-pdf/trend-implementation-test.js`（105/105 checks passed）。既存`tools/sst-weekly-report-pdf/pdf-print-implementation-test.js`（165/165、非回帰確認）。`tools/record-dashboard-poc/*golden-tests.js`全13ファイル（全てALL PASS）。`node generate.js`を2回実行し冪等性を確認（2回目で差分なし）。
- **検証した項目**: 11 type混在、セッション型recordの1件カウント、phrase読み上げ+コピーの2件カウント、週境界の閉区間/半開区間の厳密な境界値（月曜0時ちょうど・nowちょうど・now+1ms）、年またぎ（2025年12月→2026年1月）、米国DST切替週（America/New_York、2026年3月8日のspring-forward）をまたぐ週集計、未知type・危険な文字列type（`constructor`/`__proto__`）・type欠損・無効timestamp・配列要素の構造不正の分類と二重計上がないことの確認、読み込み失敗4パターン（空文字列・空白文字列・JSON破損・非配列）と空状態2パターン（未使用・空配列）の区別、1回の読み込み結果の使い回し（`localStorage.getItem`呼び出し回数の計測により確認）、storage/原配列の非変更、印刷時の2画面同時非表示（`getClientRects()`による実レンダリング確認）、折りたたみ詳細の印刷時強制展開、forced-colorsモードでのバー境界線表示、360px幅での水平オーバーフロー無し、keyboard操作（Enter/Space）でのナビゲーション、上部/下部戻るボタン双方でのfocus復帰。
- **実機確認（本Implementation Phaseでは未実施、Real Device Gate）**: iPad Safari・VoiceOver・外部スイッチでの実機確認は行っていない。Playwright（Chromium）による自動検証のみ。
- **変更ファイル**: `sst-app.html`（新規screen/関数の追加、`buildActivityList()`の`ACT_LABEL`参照安全化、`buildReport()`/`downloadReportCSV()`の null ガード追加）、`tools/sst-weekly-report-pdf/trend-implementation-test.js`（新規）、本文書。`assets/js/sst-record-detail.js`・`assets/js/record-dashboard-foundation.js`・`generate.js`・`apps-data.json`・Foundation API・localStorage schemaは無変更。
- **push/merge/deploy**: 未実施（checkpoint commitのみ、User Review待ち）。
