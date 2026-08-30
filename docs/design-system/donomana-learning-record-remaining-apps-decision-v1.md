# どのまな Learning Record — 残存4アプリの記録設計監査・最終方針決定（Version 1.0）

- 版: v1.0
- 発行: 2026年8月（Phase T5-E-D）
- 位置づけ: `mogura-tataki` / `bosai-app` / `tokei-app` / `gaze-keyboard` の4アプリについて、「Foundationへ統合すること」自体を目的とせず、それぞれで何を記録として残すことが教育的・技術的・Privacy上適切なのかを個別に再評価した、正式な設計判断文書。
- baseline: `865976d`（Phase T5-E-R1 Production Release後のHEAD）
- 本Phaseのスコープ: **調査・設計判断のみ。Productionコードは一切変更していない。**
- 検証方法: 実コード読解 + Playwright実ブラウザでの実測（推測による結論を避けるため、全ての永続/非永続判定を実測で裏付けた）

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-foundation-audit-v1.md` | T5-A/T5-B時点の全35アプリ監査（baseline `afe74e9`）。本文書はこれを`865976d`時点で再検証・更新する |
| `donomana-learning-record-standard-v1_0.md` | Core Schema・Badge定義・Foundation API・gaze-keyboard分類の既存正式決定（T5-B/T5-C/T5-C'/T5-E-A/B/C Addendum） |
| `donomana-learning-record-ui-standard-v1_0.md` | 共通Viewer UI標準 |

---

## 1. 目的

Learning Record Foundationの横展開（miru-hirogaru-app / hiragana-learn / katakana-app / suji-manabou / directions-app / kyou-no-kiroku / mitsukete-touch-app / junban-miyou-app / kurabeyou-app / katachi-awase-app / dotchiga-ii-app / okane-app / sst-app、計13アプリ）とProduction Release（T5-E-R1、`865976d`）は完了した。

残る4アプリ（mogura-tataki / bosai-app / tokei-app / gaze-keyboard）は、Foundation Audit文書（T5-A/T5-B）の時点で「個別判断が必要」と保留されていた。本Phaseはこの4アプリについて、実コード監査と実ブラウザ実測に基づき正式方針を決定する。

---

## 2. データ分類の適用結果（総論）

4アプリの記録データを分類基準（学習・活動記録 / セッション状態 / 利用者作成データ / コミュニケーション履歴 / 利用状況・評価的データ）に当てはめた結果:

| アプリ | 該当分類 |
|---|---|
| mogura-tataki | A（学習・活動記録）— ゲームスコア形式だが、活動の実施記録として妥当 |
| bosai-app | A（学習・活動記録、ただし現状はB：セッション状態として揮発） |
| tokei-app | A（学習・活動記録、ただし現状はB：セッション状態として揮発） |
| gaze-keyboard | D（コミュニケーション履歴）。E（利用状況データ）としての性質を持つ付随データ（`gaze_stats_*`の語彙頻度）も含む |

---

## 3. `mogura-tataki` 監査

### 3.1 保存構造（実コード確認済み、`mogura-tataki.html:2079-2096`）

- storage key: `mogura_v3`（非公式バージョンサフィックス、`donomanaRecordNormalizeLegacy`が扱う`schemaVersion`とは別概念）
- 形式: フラット配列。`localStorage.setItem(SKEY, JSON.stringify(rs))`
- record shape:
  ```js
  { date: "8/30 14:23" /* toLocaleDateString('ja-JP', {month,day,hour,minute}) — 年を含まない */,
    score, hits, misses, fumbles, rate, combo, diff, mode, time, goal, holes }
  ```
- 件数上限: `rs.unshift(rec); if(rs.length>60) rs.length=60` — 直近60件のローリング保持（directions-appの`MAX_LOGS`と同型のapp-specific concern）
- **`inputMethod`フィールドなし**。ただしアプリ自体はドウェル（視線）・タッチ・キーボード（Enter/Space）・スイッチの複数入力に対応しており（`a11y`バッジで確認）、記録時に`cfg.dwell`等から入力方式を判別すること自体は技術的に可能（推測ではなく実測できる）。
- Viewer: `renderRecs()` — 直近25件を日付・難易度・正答率・スコアで一覧表示、集計（総数・ベストスコア・平均正答率）あり
- CSV: **なし**（grep確認済み、`csv`/`export`関連関数は存在しない）
- Delete: `clrRec` → `confirm()` → `localStorage.removeItem(SKEY)` の全削除のみ。個別record削除は未実装
- Privacy: 外部送信なし（`fetch`/`XHR`/`gtag`等grepで該当なし）。個人名等の識別情報は記録に含まれない

### 3.2 実測（Playwright、`865976d`相当のコードに対して実施）

```
before=0 → saveRec()実行 → after_save=1 → reload → after_reload=1（0件のエラー）
```
永続保存であることを実測で確認した（推測ではない）。

### 3.3 Badgeの現状（重要な新発見）

`apps-data.json`を`865976d`で再確認したところ、mogura-tatakiには **`"📊 学習記録あり"`** というbadgeが既に存在する。

これはT5-B時点のFoundation Audit文書が「badge=falseだが実装はC」と結論した内容と**矛盾する新事実**である。原因を調査した結果、T5-B時点の監査は`"📊 きろく機能あり"`という**完全一致文字列**のみを検索対象としており、mogura-tatakiが使っている`"📊 学習記録あり"`という**表記ゆれ**を検出できていなかったことが判明した（詳細は§9 Badge比較表を参照）。

**結論**: mogura-tatakiのbadge自体は「記録機能があること」を正しく示している（過小表示ではない）。ただし全社的な表記統一という観点では、9アプリが使う標準文言`"📊 きろく機能あり"`と異なる独自表記`"📊 学習記録あり"`になっている点は表記ゆれとして記録する。

### 3.4 教育的意味の評価

score/hits/misses/rate等は、単純なゲームランキングとしてではなく「その日、その難易度でどれだけ活動に取り組んだか」という**活動記録**として読める設計になっている（Viewerが日付・難易度・正答率の一覧という、能力比較ではなく活動履歴の形式で表示している）。「できる/できない」の診断的表現は使われていない。

一方で、`score`単体を教員間で比較材料に使うと能力評価的な誤用のリスクがゼロではない。既存Viewerの表示形式（活動履歴として見せる）を維持する限りは許容範囲と判断する。

### 3.5 正式方針: **方針A（Foundationへ統合する価値がある）**

理由:
- storage shapeが既にFoundation互換のフラット配列であり、hiragana-learn（Pilot B）・directions-app（Pilot C）と同型の統合パターンがそのまま適用できる
- badgeが既に「記録機能あり」を主張しており、Foundation統合によって内部実装をより堅牢化することはbadgeの主張と整合する
- `date`フィールドが非ISO・年なしという旧世代形式であり、Foundationの`donomanaRecordNormalizeLegacy`によるlegacy互換読み込みの実績パターンがそのまま活きる

実装時の推奨事項（本Phaseでは未実施、次Phase設計候補）:
- 新規recordにのみ`schemaVersion`を追加（既存60件のlegacy recordは無変更、Standard §10の原則通り）
- 新規recordに`inputMethod`を追加する場合は、`cfg.dwell`等の実測値から判定する（推測禁止の原則を満たせる）
- 60件ローリング上限はapp-specific concernとして維持
- CSV機能を新設する場合は、Excel互換のため日付をdot区切り形式にする（T5-E-A'の教訓を最初から適用する）
- badge表記を標準文言`"📊 きろく機能あり"`へ統一するかはbadge一斉是正の別Stepで検討（本Phaseでは未決定）

---

## 4. `bosai-app` 監査

### 4.1 保存構造（実コード確認済み、`bosai-app.html:2882-2943, 3071-3095`）

- `allRecords` / `sessionLog` は**メモリ内のみのJS配列**。`saveRecords()`は実装上**何もしない関数**（`function saveRecords() { // records kept in memory during this session }`）
- `localStorage`/`sessionStorage`への記録保存は一切ない（設定値`bosai_badges`等a11y関連キーのみ永続化、記録データとは無関係）
- record shape: `{ id: Date.now(), kind: 'taiken'|'quiz', name, simType, correct, total, score, dateStr, log }`
  - `dateStr`はスラッシュ区切り単一セル結合形式（`"2026/08/30 14:23"`）— Excel `#######`オーバーフローの既知パターンと同型（T5-E-A'で修正した問題と同一原因）
  - `name`は`student-name-input`からの自由入力文字列（teacherが入力する生徒名想定、フォーマット検証なし）
- 教員用ダッシュボード: PIN認証（4桁）後にのみ`renderTeacherDash()`が記録一覧・集計を表示
- CSV: `exportCSV()`あり。ただしメモリ上の`allRecords`のみを出力するため、**リロード前に限り**エクスポート可能
- Delete: `clearAllRecords()` → confirm → メモリ配列を空に

### 4.2 実測（Playwright）

```
before=0 → allRecords.push(...) → after_push=1
localStorage内に記録関連キーなし（a11y設定キーのみ）
reload → after_reload=0
```
セッション限定（B）であることを実測で確認した。

### 4.3 Badgeの現状

`apps-data.json`のbosai-appは`"📊 きろく機能あり"`badgeを持つ（標準文言と完全一致）。T5-B Foundation Audit文書の指摘（badge過大表示）は**`865976d`時点でも解消されていない**ことを再確認した。

### 4.4 教育的価値の評価

PIN認証付き教員ダッシュボードという設計自体が「後日、複数セッションにわたって振り返る」ことを前提としたUXになっている（単一セッション内でしか見えないデータに教員PINロックをかける実用上の理由が乏しい）。防災シミュレーション・クイズへの取り組み状況を、日をまたいで教員が把握できることには明確な教育的価値がある（どのdisaster typeに取り組んだか、正答率の推移等）。

現状は「badgeとUIが約束している価値」と「実装（揮発する）」が乖離した状態であり、これは単なる表記の問題ではなく、機能的な未完成状態と判断する。

### 4.5 正式方針: **方針A（永続的なLearning Recordを新設する価値がある）**

理由:
- badge・教員ダッシュボードUXの両方が既に「持続する記録」を前提として設計されている
- `allRecords`のshapeは既にFoundation互換のフラット配列であり、統合の技術的障壁は低い

実装時の推奨事項（次Phase設計候補）:
- **`name`フィールドの扱いに注意**: 現状はメモリ内限りのため実害は限定的だが、永続化する場合はkyou-no-kirokuで既に指摘済みの「なまえ→よびな」ガイダンスと同様の配慮が必要（本人特定情報が端末に残り続けることになるため）。UI文言または補助テキストでニックネーム可であることを明示する
- 日付フィールドはdot区切り形式で新規実装し、Excel `#######`問題を最初から回避する
- 現行のPIN認証・教員ダッシュボードのUXパターン自体は変更不要（Foundationはstorage層のみ差し替える）
- CSVは既存`exportCSV()`のロジックをFoundationの`donomanaRecordBuildCsv`へ移行可能

---

## 5. `tokei-app` 監査

### 5.1 保存構造（実コード確認済み、`tokei-app.html:1470, 1849-1880`）

- `quizState`は**メモリ内のみのJSオブジェクト**。新しいクイズを開始するたびに`quizState = {...}`で再代入され、前回の結果は跡形もなく消える（bosai-appより更に揮発性が高い：ページリロード前でも新規クイズ開始時点で消失する）
- `localStorage`に記録関連キーは一切存在しない（実測で確認済み。soundOn設定キーのみ存在）
- CSV: `exportResultCSV()`あり。「とけいアプリ セッション記録」という見出しの通り、**単一クイズセッションのスナップショット**を出力する設計（複数回分の履歴ではない）
  - 日時はスラッシュ区切り単一セル結合形式 — bosai-appと同型のExcel互換性debt
- Viewer: 結果画面（`quizState.results`/`attempts`/`times`を使った振り返り表示）はあるが、これも同一セッション内の直近クイズのみ

### 5.2 実測（Playwright）

```
quizState_exists_as_var=true（メモリ変数として存在）
localStorage_has_result_key=false（記録関連キーなし）
```

### 5.3 Badgeの現状

`apps-data.json`のtokei-appは`"📱 iPad対応"`のみで、記録関連badgeを持たない。これはStandard §4.1の定義（badge=永続保存のみ対象）に照らして**正しい**（過小/過大表示ではない）。

### 5.4 教育的価値の評価

時計の読み方は反復練習を要する学習領域であり、「いつ・どの難易度で・何問中何問正解したか・再挑戦回数」を日をまたいで記録できれば、教員が学習の推移を把握する明確な価値がある。既存CSVが既に「No.,出題時刻,種類,結果,試行回数,回答秒数」という粒度の細かいper-question dataを持っており、Foundation統合の設計上の土台としてそのまま活用できる。

### 5.5 正式方針: **方針A（Foundationへ統合する価値が高い）、ただし実装は次Phaseでスキーマ設計から行う**

理由:
- 教育的親和性が高く、既存CSVの粒度が新schema設計の実証的土台になる
- ただし「1問ごとに記録するか」「1クイズセット完了ごとに1recordとするか」の設計判断が必要であり、本Phase（docs-only）では決定しない

実装時の推奨事項（次Phase設計候補）:
- 1クイズセット完了ごとに1 Foundation recordとする案を推奨（既存Multi-Input Foundationの「success-only可・全問正誤の詳細はpayloadへ」という前例に倣う。1問単位での大量recordは§21保存件数の観点からも避けたい）
- payload例: `{ mode, difficulty, correct, total, retriedCount, avgResponseSec }`
- 既存のセッションCSV機能（単発クイズのスナップショット）はそのまま維持してよい（Foundation統合と共存可能。「今回の結果を今すぐ見る」需要と「過去の記録を振り返る」需要は別物）
- 日付フィールドは新規実装時にdot区切り形式にする

---

## 6. `gaze-keyboard` 監査（Communication History、Learning Recordとしては非対象）

> **Phase T6-A追記**: 本節で指摘したProfile削除時のorphaned dataおよび履歴全削除時の`gaze_stats_*`残存は、Phase T6-Aで正式なCommunication History Standard（`docs/design-system/donomana-communication-history-standard-v1_0.md`）を策定した上で修正済み。詳細は同文書を参照。

### 6.1 既存分類の再確認

T5-C Addendumで確定した分類「**B. Communication History**」を`865976d`時点のコードで再検証し、**変更なしで妥当**と結論した。理由（既存文書と同一）: 記録内容が「観察可能な活動」ではなく利用者本人が実際に入力・確定した発話内容そのものであるため。

### 6.2 実測（Playwright、profile lifecycle）

T5-Cで発見された「プロファイル削除時のorphaned data」バグを、`865976d`のコードに対して再現手順で実測した。

```
1. profile "testprof_..." を作成
2. addHistoryEntry('こんにちは') → gaze_history_<id> に保存される
3. updateUsageStats('こんにちは') → gaze_stats_<id> に保存される（totalChars:10, wordFreq:{"こんにちは":2}, ...）
4. profiles.filter() でプロファイルを削除 → saveProfiles()
5. 削除後:
   - after_delete_profile_gone_from_list = true（UI上は消える）
   - after_delete_history_still_in_localStorage = true（★孤児データとして残存）
   - after_delete_stats_still_in_localStorage = true（★孤児データとして残存）
```

**T5-Cの所見が`865976d`時点でも未修正のまま実在することを実測で確認した。** 実際に保存されていた発話内容（`"こんにちは"`）がプロファイル削除後もlocalStorage上に生データのまま残ることを確認した。

### 6.3 新規発見: アクティブプロファイルの「全削除」ボタンでも`stats`は消えない

`histClearBtn`（履歴タブの「🗑️ 全削除」）は`saveHistory([])`のみを呼び、`gaze_stats_<currentProfileId>`は消去しない（`gaze-keyboard.html:4143-4149`のコード確認）。これはプロファイル削除とは別の経路で発生する、より頻繁に起こりうる事象である。利用者が「履歴を削除した」と認識していても、語彙頻度・文字数等の統計データはそのまま残り続ける。プロファイル削除バグと根が同じ（`stats`削除処理がどこにも実装されていない）だが、**発生条件が異なる別の指摘事項**として記録する。

### 6.4 Privacy評価

- 外部送信: なし（grep再確認済み）
- 保存内容の機微度: 高い。AAC用途のため、発話内容には私的な要望・感情表現等が含まれうる
- 既存badge（`"♿ AAC対応"` `"👁️ 視線入力対応"` `"👤 複数ユーザー対応"`等）は、複数ユーザー対応であることは示すが、「入力内容が端末に保存され続ける」という保存の事実そのものを明示していない

### 6.5 正式方針

**Communication History Standardの要否（§17の選択肢）: 方針B（独立したDonomana Communication History Standardを策定する）を正式決定する。**

理由:
- T5-Cで既に「推奨」段階だった内容を、本Phaseで正式決定へ格上げする
- Learning Record Standardの「観察可能な行動のみ記録する」という核心原則（§2）が、発話内容そのものを扱うgaze-keyboardには構造的に当てはまらないため、同一Standard内で例外規定を増やすより独立Standardの方が将来の拡張（コミュニケーションボード等のAAC系教材が同様の履歴機能を持つ場合）に対して健全
- 現時点でgaze-keyboard以外に該当する実装は存在しない（Inventory Closure Gateで確認済みの14アプリのうち13本はAのみ）が、Standardは「今ある実装の後付け文書化」ではなく「将来のAAC系教材が参照できる規範」として設計する価値がある

**データライフサイクル修正の要否: 修正すべきと判断する（実装は次Phase、本Phaseではコード変更しない）。**

実装時の推奨事項（次Phase設計候補、User承認前提）:
- プロファイル削除時に対応する`gaze_history_<id>`・`gaze_stats_<id>`を同時に削除する
- 履歴の「全削除」ボタンで`stats`も同時にクリアする（§6.3の新規発見への対応）、またはUIで「履歴と統計は別に保存されています」を明示する
- badgeに「保存の事実」を明示する文言（例: 「💾 発話履歴を保存」）の追加を検討する（Privacy透明性の向上、Production変更のため別途User承認が必要）

---

## 7. Badge整合性比較表（4アプリ + 表記ゆれ全体像）

| アプリ | 現在の記録関連badge | 実装の永続性 | Standard §4.1定義との整合 | 備考 |
|---|---|---|---|---|
| mogura-tataki | `📊 学習記録あり` | C（永続、CSV無） | **整合**（表記ゆれのみ） | T5-B監査は完全一致検索のため検出漏れしていた（本Phaseで新規発見） |
| bosai-app | `📊 きろく機能あり` | B（セッションのみ） | **不整合（過大表示）** | T5-B所見が`865976d`時点でも継続 |
| tokei-app | なし | B（セッションのみ） | 整合（badge無しが正しい） | — |
| gaze-keyboard | なし（Communication History扱いのため対象外） | D（永続、印刷のみ） | 分類上badge対象外で妥当 | ただし「保存の事実」を伝える別badgeの検討余地あり（§6.5） |

参考: 全13 Foundation統合済みアプリの記録badge文言は`📊 きろく機能あり`（9本）/`📊 きろく機能`（suji-manabou、1本、「あり」欠落）/`📊 学習記録CSV対応`（okane-app）/`📊 学習ログ・CSV出力`（directions-app）/`📥 CSV書き出し対応`（kyou-no-kiroku、record文言なし）/badgeなし（sst-app）と、**表記が最低6パターンに分散している**ことを本Phaseで新規に発見した。これは4アプリの監査スコープ外だが、将来のbadge統一Stepの参考情報として記録する。

---

## 8. Viewer/CSV/Retention比較表

| アプリ | Viewer | CSV | Retention |
|---|---|---|---|
| mogura-tataki | ✓（`renderRecs()`、直近25件表示・全体集計） | ✗ | ローリング60件上限 |
| bosai-app | ✓（PIN保護teacher dashboard、ただしセッション限り） | ✓（セッション限りのデータのみ出力可） | セッション終了で消失（上限概念なし） |
| tokei-app | △（同一クイズの結果画面のみ、履歴一覧ではない） | ✓（単発クイズのスナップショットのみ） | 新規クイズ開始で即消失 |
| gaze-keyboard | ✓（`renderHistoryTab()`、日付グループ化） | ✗（印刷のみ） | 最大500件（`hist.slice(-500)`）、プロファイル削除時は孤児化（削除されない） |

---

## 9. Privacy Riskテーブル

| アプリ | 保存データ | Privacy上の注意度 | 外部送信 | 推奨対応 |
|---|---|---|---|---|
| mogura-tataki | ゲームスコア・活動ログ、個人識別情報なし | 低 | なし | 現状維持でよい |
| bosai-app | シミュレーション/クイズ結果 + `name`（教員入力の生徒名、現状メモリ限り） | 中（永続化する場合は上昇） | なし | 永続化時は「なまえ→よびな」相当の配慮を追加 |
| tokei-app | クイズ結果、個人識別情報なし | 低 | なし | 現状維持でよい |
| gaze-keyboard | **利用者本人の発話内容そのもの**、語彙頻度統計 | **高** | なし | Communication History Standard策定 + データライフサイクル修正（§6.5） |

---

## 10. 教育的価値比較表

| アプリ | 記録する教育的価値 | 後から見る価値 | 教員支援への価値 | 学習者への価値 | 注意点 |
|---|---|---|---|---|---|
| mogura-tataki | 中 | 中（取り組み頻度・難易度選択の推移） | 低〜中 | 中（達成感の可視化） | scoreを能力比較に使わない設計を維持 |
| bosai-app | 高 | 高（どの災害種別に取り組んだか、正答傾向） | 高（PIN付きdashboardが既に前提） | 中 | 現状は価値が実装未完成により失われている |
| tokei-app | 高 | 高（時刻読解の習熟推移） | 高 | 中〜高 | 1問単位ではなくセット単位での記録を推奨 |
| gaze-keyboard | Learning Recordとしての評価対象外（Communication Historyとして別軸で価値がある） | — | — | — | 発話内容の保存はAAC用途として別の価値体系 |

---

## 11. Foundation適合性比較表

| アプリ | 保存構造 | Foundation適合性 | Adapter必要性 | 推奨 |
|---|---|---|---|---|
| mogura-tataki | flat array（`mogura_v3`） | 直接統合可能（hiragana-learn/directions-appと同型） | 不要 | 統合（方針A） |
| bosai-app | flat array相当（メモリ内`allRecords`、永続化されればそのままFoundation互換） | 直接統合可能（永続化と同時に） | 不要 | 新設統合（方針A） |
| tokei-app | メモリ内オブジェクト（`quizState`）、記録配列は未存在 | 統合可能だが新規schema設計が必要 | 不要（新規設計のみ） | 統合（方針A、次Phaseで設計） |
| gaze-keyboard | profile-scoped key（`gaze_history_<id>`） | Foundation対象外（Communication Historyのため） | 該当なし（別Standardが必要） | Foundation非統合を維持 |

---

## 12. T5の正式完了条件（再定義）

T5の完了条件を「35アプリすべてへLearning Recordを搭載する」とはしない。以下を完了条件とする:

1. ✅ Learning Recordの定義が明確（Standard §1-2）
2. ✅ Learning Record Foundationが確立（Standard §9 Record API、13アプリで実績）
3. ✅ 適切なアプリへFoundationを展開（13/35アプリ、Production Release済み）
4. ✅ Legacyデータを維持（全統合アプリでlegacy compat確認済み）
5. ✅ CSV Standardを確立（Excel互換dot区切り形式、T5-E-A'で確立・Production適用済み）
6. ✅ Record UI Standardを確立（`donomana-learning-record-ui-standard-v1_0.md`）
7. ✅ Learning RecordとUser Contentを分離（Foundation Audit文書で全35アプリ分類済み）
8. ✅ Learning RecordとCommunication Historyを分離（gaze-keyboard分類、本Phaseで正式決定へ格上げ）
9. ✅ session-onlyとの境界を明確化（bosai-app・tokei-appをB分類として明記、本Phaseで実測再確認）
10. ✅ 残存アプリについて個別方針が決定済み（本Phase、mogura-tataki=A、bosai-app=A、tokei-app=A、gaze-keyboard=Foundation対象外+Communication History Standard策定を決定）

**結論: 上記10条件は全て満たされた。T5は全アプリへの記録搭載完了を待たずにClose可能と判断する。** 残る実装（mogura-tataki/bosai-app/tokei-appへのFoundation統合、Communication History Standard策定とgaze-keyboardのデータライフサイクル修正）は、T5の後続独立Phase群（§13参照）として扱うことを推奨する。

---

## 13. 次Phase実装候補（本Phaseでは未実施）

- **T5-E-E1**: `mogura-tataki` Learning Record Foundation統合（badge表記統一は別途検討）
- **T5-E-E2**: `tokei-app` Learning Record新規schema設計・Foundation統合
- **T5-E-E3**: `bosai-app` 永続Learning Record新設（`name`フィールドのPrivacy配慮を含む）
- **T5-E-E4**: Communication History Standard策定 + `gaze-keyboard`データライフサイクル修正（プロファイル削除時のorphan解消、履歴全削除時のstats解消を含む）

いずれもUser承認と個別Phaseでの実施を前提とし、本Phaseの決定だけで実装を進めない。

---

## 14. Production 35アプリ 最新再集計（`865976d`基準）

T5-A/T5-B時点のConfirmed Inventory（baseline `afe74e9`）の分類自体（A/B/C/C+D/D）は、T5-E-A〜T5-E-Cロールアウトが「既存storageをFoundationへ委譲する」設計判断（既存writerの内部実装のみ差し替え、shapeやsemanticsは変更しない）を貫いたため、**分類区分としては変化していない**ことを確認した。変化したのは「Foundation統合済みか」という別軸である。

| 分類 | 該当数 | 内訳（`865976d`時点） |
|---|---|---|
| A（Learning Recordなし） | 18 | Foundation Audit文書と同一（janken-app等） |
| B（Session only） | 2 | bosai-app・tokei-app（本Phaseで実測再確認） |
| C（Local persistent、export無） | 1 | mogura-tataki（本Phaseで実測再確認） |
| C+D（Local persistent、CSV export可） | 13 | hiragana-learn・katakana-app・suji-manabou・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii・directions-app・okane-app・kyou-no-kiroku・sst-app |
| D（Local persistent、export可＝印刷。CSV無） | 1 | gaze-keyboard |
| **合計** | **35** | 変化なし（T5-Eは統合方式の変更のみで分類区分は変えていない） |

---

## 15. 記録関連機能の内訳（`865976d`時点）

**用語の整理（重要）**: T5で確立した正式境界において、Learning Record（学習・活動記録） ≠ session-only（記録が永続しない） ≠ Communication History（発話内容そのものの記録）である。以下はこの境界を崩さない形で内訳を示す。「対応率」のような単一の集約率としては表現しない。

- **Foundation統合済み Learning / Activity Record**: **13本 / 35本**（miru-hirogaru-app・hiragana-learn・directions-app・kyou-no-kiroku・katakana-app・suji-manabou・mitsukete-touch-app・junban-miyou-app・kurabeyou-app・katachi-awase-app・dotchiga-ii-app・okane-app・sst-app）
  - うち12本はflat array API、1本（kyou-no-kiroku）はComposite Storage Adapter経由
- **Foundation未統合だが persistent Learning / Activity Recordあり**: **1本 / 35本**（mogura-tataki）
- **→ persistent Learning / Activity Recordあり（上記2つの合計）**: **14本 / 35本**
- **session-only**（Learning Recordではない。永続しないセッション状態）: **2本 / 35本**（bosai-app・tokei-app）
- **Communication History**（Learning Recordではない。発話内容そのものの記録）: **1本 / 35本**（gaze-keyboard）
- **記録なし**: **18本 / 35本**
- 参考: 上記のうち「何らかのrecord / history / session記録があるアプリ」（persistent Learning Record 14 + session-only 2 + Communication History 1）は合計 **17本 / 35本** となるが、これは概念の異なる3分類を機械的に足し合わせた参考値であり、**「Learning Record対応率」とは呼ばない**。
- **Viewerあり**: 15本（C+D 13本 + mogura-tataki + gaze-keyboard。bosai-appのteacher dashboardとtokei-appの結果画面はセッション限りのため「永続記録のViewer」としてはカウントしない）
- **CSVあり（永続データ対象）**: 13本（C+D 13本のみ。mogura-tatakiはCSV無、gaze-keyboardは印刷のみ、bosai-app/tokei-appのCSVはセッション限りのスナップショットのため永続CSVとしてはカウントしない）

---

## 16. 本Phaseで判明した既知Technical Debt

### 16.1 `okane-app` — 記録モーダルのEscapeキーでフォーカスが起点ボタンに戻らない

T5-E-R1のAccessibility Gateで発見済み。`git diff afe74e9..HEAD`で該当コードパスが今回のT5チェーン全体で無変更であることを確認済み（regressionではなく既存の未修正事項）。今後のAccessibility改善候補。

### 16.2 `bosai-app` / `tokei-app` — CSVの日時がExcel非互換のスラッシュ区切り単一セル結合形式

両アプリとも`${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} HH:mm`形式の日時を単一セルへ出力しており、T5-E-A'で他アプリに適用したドット区切り形式（Excel `#######`オーバーフロー回避）が未適用。両アプリとも現状は永続記録を持たないため影響は限定的（都度エクスポートする一時データのみ）だが、§13の次Phase実装（永続Learning Record化）と同時に修正することを推奨する。

### 16.3 `gaze-keyboard` — プロファイル削除時のorphaned data（既知、`865976d`でも再現確認）

§6.2参照。

### 16.4 `gaze-keyboard` — 履歴「全削除」操作でも`gaze_stats_*`が消えない（本Phase新規発見）

§6.3参照。プロファイル削除バグとは独立した、より頻繁に起こりうる経路の指摘。

### 16.5 Badge表記ゆれ（本Phase新規発見）

§7参照。記録関連badgeの文言が最低6パターンに分散している。

### 16.6 レガシー孤立ファイル（`hiragana-learn-detail.html`・`katakana-app-detail.html`、リポジトリroot直下）

T5-E-R1で削除しないことを確認済み。継続してcleanup候補として保持。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-30 | Phase T5-E-D。残存4アプリ（mogura-tataki/bosai-app/tokei-app/gaze-keyboard）の正式方針決定。実コード監査+Playwright実測に基づく。T5正式完了条件を再定義しClose可能と判断。 |
