# どのまな Record Foundation Expansion — 35アプリ再Inventory / Gap Analysis / Rollout設計（Version 1.0）

- 版: v1.0
- 発行: 2026年8月30日（Phase T7-A）
- 位置づけ: Phase T5（Learning Record Foundation Program、正式Close済み）・Phase T6-A（Communication History Standard）で確立した既存Standardを**再発明せず**、現Production実コードから全35アプリを再監査し、T7-B以降のPilot／Grouping／Rollout計画を確定するための調査文書。
- baseline: `01e8ebf`（Phase T6.5-B Production Release後のHEAD、main = origin/main）
- 本Phaseのスコープ: **調査・設計のみ。アプリ実装変更・main merge・push・deploy・changelog変更はいずれも行っていない。**
- 検証方法: 実コード読解（`apps-data.json`・全35 HTMLファイル・`generate.js`）+ 既存Source of Truth文書の再読解。新規のPlaywright実ブラウザ検証は本Phaseでは実施していない（Inventory目的のためコード監査を優先し、T7-Bの実装検証で実ブラウザ検証を行う）。

---

## 0. 関連文書（Source of Truth）

本Phaseは以下の既存文書を正本として再利用し、内容を重複して再定義しない。

| 文書 | Phase | 位置づけ |
|---|---|---|
| `donomana-learning-record-standard-v1_0.md` | T5-B〜T5-F | Core Schema・Storage・Foundation API・Badge定義。**Learning Record Program正式Close済み（Addendum Phase T5-F）** |
| `donomana-learning-record-foundation-audit-v1.md` | T5-A/T5-B | 全35アプリ Confirmed Inventory（原本、`afe74e9`時点） |
| `donomana-learning-record-remaining-apps-decision-v1.md` | T5-E-D | mogura-tataki／bosai-app／tokei-app／gaze-keyboardの個別方針決定（`865976d`時点） |
| `donomana-learning-record-ui-standard-v1_0.md` | T5-D〜T5-E-A' | Viewer Architecture・UI Foundation API・CSV Date/Time Excel互換Standard |
| `donomana-communication-history-standard-v1_0.md` | T6-A〜T6-A'' | gaze-keyboard Communication History正式Standard。Cascade Delete・XSS対策・44px/Escape対応まで完了済み |
| `donomana-new-app-development-standard-v1_0.md` | Design System | §22-26に新規アプリ向け記録要件（CONDITIONAL、記録機能を持つ教材ではREQUIRED相当） |
| `donomana-privacy-analytics-consistency-v1.md` | T4-A/B/C | GA4は`index.html`のみに存在し35アプリ本体には埋め込まれていないことを確認済み |
| `docs/design-system/donomana-trace-sample-recording-v1.md` | T5-E-A''' | hiragana-learn/katakana-app限定のTrace Sample Recording Pilot（Freeze中、本Phaseでは対象外） |

**発見した文書ギャップ**: `donomana-learning-record-standard-v1_0.md` §0が参照する`donomana-storage-architecture-v2_0.md`（コンテンツ保存・バックアップ層の文書）は、本リポジトリの`docs/`配下に**実在しない**。参照はあるが文書自体が存在しないため、User Content（お絵かき作品・スライドショー・印刷テンプレート等）の保存方式を横断的に扱う正式文書は現時点で不在である。T7の直接スコープではないが、将来必要になった場合の文書化ギャップとして記録する。

---

## 1. T5/T6-Aの既存確定事項（再利用、再検証済み）

Learning Record Foundation Programは**Phase T5-F（2026-08-30）で正式にClosed**。以下は再決定せず、そのまま採用する。

- Core Schema: `{timestamp, appId, activity, inputMethod, schemaVersion}`
- Foundation API 9関数（Data） + 4関数（UI）: `donomanaRecordReadLog`/`WriteLog`/`AddLog`/`ClearLog`/`NormalizeLegacy`/`Create`/`BuildCsv`/`ReadNestedCollection`/`WriteNestedCollection`、`FormatDateTime`/`GroupByDate`/`FormatInputMethod`/`FormatTracingLevel`
- CSV Standard: UTF-8 BOM、日付`YYYY.MM.DD`（ドット区切り、Excel自動認識回避済み・実Excel検証済み）＋時刻`HH:mm:ss`（コロン区切り）の2列分離
- Communication History Standard（T6-A〜T6-A''）: gaze-keyboardのCascade Delete・XSS対策・44px/Escape対応まで完了済み。Learning Record Foundationへは統合しない方針を維持
- Badge定義: 「📊 きろく機能あり」＝永続Learning/Activity Recordのみに表示（Session-only・Communication Historyは対象外）

---

## 2. 全35アプリ 現Production再Inventory（`01e8ebf`時点、実コード確認済み）

`apps-data.json`から全35アプリを取得し、`generate.js`の`LEARNING_RECORD_FOUNDATION_APPS`および各HTMLファイルの`localStorage`/`IndexedDB`アクセスパターンを実コードから再確認した。

| # | アプリ (id) | HTML | Record分類 | 永続 | Storage | CSV | Foundation | 今後の推奨 |
|---|---|---|---|---|---|---|---|---|
| 1 | hiragana-learn | hiragana-learn.html | A. Foundation | ✓ | localStorage（`hiragana_log`） | ✓ | ✓統合済み | 現状維持 |
| 2 | katakana-app | katakana-app.html | A. Foundation | ✓ | localStorage（`katakana_log`） | ✓ | ✓統合済み | 現状維持 |
| 3 | nazori-app | nazori-app.html | **B. Legacy Persistent**（本Phaseで新規発見） | ✓ | localStorage（`nazori_records`、画像含む） | ✓（T6.5-A-HF1で改善済み） | ✗未統合 | Priority A候補（§8参照） |
| 4 | nazorin-print | nazorin-print.html | E. No Record（Content Library） | ✓（Contentとして） | localStorage（`nazorin_library_v1`） | ✗ | 対象外 | Minimal Activity（起動程度） |
| 5 | janken-app | janken-app.html | E. No Record | — | a11y設定のみ | ✗ | 対象外 | Activity Record（Type2） |
| 6 | shiritori2 | shiritori2.html | E. No Record | — | a11y設定のみ | ✗ | 対象外 | Learning Record（Type1/2混在） |
| 7 | okane-app | okane-app.html | A. Foundation | ✓ | `okane_activity_log`（配列）+ `okane_records`（集計、対象外） | ✓ | ✓統合済み | 現状維持 |
| 8 | register-app | register-app.html | E. No Record（Content） | — | `register_products`（商品カタログ） | ✗ | 対象外 | Activity Record（Type2、ごっこ遊び） |
| 9 | tokei-app | tokei-app.html | C. Session-only | ✗ | メモリ内`quizState`のみ | ✓（セッションのみ） | 対象外 | Priority A候補（永続Learning Record新設） |
| 10 | schedule-app | schedule-app.html | E. No Record（Content/Tool） | — | a11y設定のみ | ✗ | 対象外 | 記録不要（支援ツール） |
| 11 | timetable-app | timetable-app.html | E. No Record（Content/Tool） | — | a11y設定のみ | ✗ | 対象外 | 記録不要（支援ツール） |
| 12 | yomikaki-app | yomikaki-app.html | E. No Record（Tool） | — | a11y設定のみ | ✗ | 対象外 | 記録不要（編集ツール） |
| 13 | bosai-app | bosai-app.html | C. Session-only | ✗ | メモリ内`allRecords`のみ（`saveRecords()`は実質no-op） | ✓（セッションのみ） | 対象外 | Priority A候補（永続Learning Record新設） |
| 14 | matching-app | matching-app.html | E. No Record | — | `match-prefs3`（設定のみ） | ✗ | 対象外 | Learning Record（Type1、正誤あり） |
| 15 | sugoroku-app | sugoroku-app.html | E. No Record（Content） | — | `sugoroku_presets`（盤面プリセット） | ✗ | 対象外 | Activity Record（Type2） |
| 16 | tyushi | tyushi.html | E. No Record | — | a11y設定のみ | ✗ | 対象外 | Activity Record（Type2、注視訓練） |
| 17 | cup_game | cup_game.html | E. No Record | — | a11y設定のみ | ✗ | 対象外 | Activity Record（Type2） |
| 18 | sst-app | sst-app.html | A. Foundation | ✓ | `sst_activity_log_v1`（配列）+ 複数設定key（対象外） | ✗（`activityLog`自体はViewer/CSV無、週次レポートのみ） | ✓統合済み | 現状維持。`sst_diary_entries_v1`は意図的にスコープ外（Privacy） |
| 19 | kimochi-board | kimochi-board.html | E. No Record（Content） | — | `kimochi_v2`（ボード内容） | ✗ | 対象外 | 記録不要（Content作成ツール、将来AAC系History化の余地は将来検討） |
| 20 | drawing-app | drawing-app.html | E. No Record（Content） | — | 作品永続化自体が未実装（sessionStorageのみ） | ✗ | 対象外 | 記録不要（Content） |
| 21 | slideshow-sakusei | slideshow-sakusei.html | E. No Record（Content） | — | sessionStorage設定のみ | ✗ | 対象外 | 記録不要（Content） |
| 22 | directions-app | directions-app.html | A. Foundation | ✓ | `appLogs`（配列、`MAX_LOGS=500`） | ✓ | ✓統合済み | 現状維持 |
| 23 | time-timer | time-timer.html | E. No Record（別軸: 音声録音機能あり） | ✓（`tt_recordings`は音声メモ、Learning Recordではない） | localStorage（`tt_recordings`＝音声、`tt_cards`＝カード設定） | ✗ | 対象外 | Minimal Activity（タイマー使用記録程度） |
| 24 | suji-manabou | suji-manabou.html | A. Foundation | ✓ | localStorage（`learningLog`相当） | ✓ | ✓統合済み | 現状維持 |
| 25 | kyou-no-kiroku | kyou-no-kiroku.html | A. Foundation（Composite Storage） | ✓ | `kyounokiroku`（`{children,records,...}`複合object、Adapter経由） | ✓ | ✓統合済み | 現状維持 |
| 26 | scratch-app | scratch-app.html | E. No Record | — | `scr_thresh`/`scr_rangeMode`（設定のみ） | ✗ | 対象外 | Activity Record（Type2、感覚遊び） |
| 27 | gaze-keyboard | gaze-keyboard.html | D. Communication History | ✓ | `gaze_history_<id>`/`gaze_stats_<id>`（Profile分離） | ✗（印刷のみ） | 対象外（別Standard） | 現状維持（T6-A''で完了済み） |
| 28 | mogura-tataki | mogura-tataki.html | B. Legacy Persistent | ✓ | localStorage（`mogura_v3`、直近60件ローリング） | ✗ | ✗未統合 | Priority A候補（§8参照） |
| 29 | ongaku-app | ongaku-app.html | E. No Record（別軸: 音声録音機能あり） | ✓（`ongaku-compositions`はIndexedDB音声、Learning Recordではない） | localStorage設定 + IndexedDB（演奏録音） | ✗ | 対象外 | Activity Record（Type2、活動時間・演奏回数程度） |
| 30 | kurabeyou-app | kurabeyou-app.html | A. Foundation | ✓ | Foundation経由（`STORAGE_LOG_KEY`） | ✓ | ✓統合済み | 現状維持 |
| 31 | katachi-awase-app | katachi-awase-app.html | A. Foundation | ✓ | Foundation経由 | ✓ | ✓統合済み | 現状維持 |
| 32 | miru-hirogaru-app | miru-hirogaru-app.html | A. Foundation（Reference） | ✓ | Foundation経由（`miru_hirogaru_log`） | ✓ | ✓統合済み | 現状維持（Multi-Input Reference） |
| 33 | mitsukete-touch-app | mitsukete-touch-app.html | A. Foundation | ✓ | Foundation経由 | ✓ | ✓統合済み | 現状維持 |
| 34 | junban-miyou-app | junban-miyou-app.html | A. Foundation | ✓ | Foundation経由 | ✓ | ✓統合済み | 現状維持 |
| 35 | dotchiga-ii-app | dotchiga-ii-app.html | A. Foundation | ✓ | Foundation経由 | ✓ | ✓統合済み | 現状維持（列名英語キーのまま） |

---

## 3. 分類サマリ（カテゴリを分けて報告。単一合算率にしない）

`01e8ebf`時点の実コード再確認結果（T5-F Close時点`865976d`からの差分を含む）:

- **Foundation統合済み Learning / Activity Record**: **13本 / 35本**（変化なし。`generate.js`の`LEARNING_RECORD_FOUNDATION_APPS`と実コード照合済み）
- **Foundation未統合の persistent Learning / Activity Record**: **2本 / 35本**（mogura-tataki・**nazori-app**）
  - ⚠️ **T5-F時点（`865976d`）は1本（mogura-tatakiのみ）だった。nazori-appはPhase T6.5-A（T5 Close後）で`nazori_records`という新しい永続Activity Record（トレース画像・セッション情報含む）を獲得しており、`donomana-learning-record-foundation-audit-v1.md`の「nazori-app = A（記録なし）」という分類は**現在は古い**。本Phaseの実コード監査で新規発見した。
- **→ persistent Learning / Activity Recordあり（上記2つの合計）**: **15本 / 35本**（T5-F時点の14本から1本増加）
- **session-only**（Learning Recordではない）: **2本 / 35本**（bosai-app・tokei-app、変化なし）
- **Communication History**（Learning Recordではない）: **1本 / 35本**（gaze-keyboard、変化なし。T6-A''でData Lifecycle修正完了）
- **記録なし**: **17本 / 35本**（T5-F時点の18本からnazori-appが移動したため1本減少）

参考値（機械的合算、単一の「対応率」としては扱わない）: persistent 15 + session-only 2 + Communication History 1 = **18本 / 35本**。T5-Fの文書化方針（`donomana-learning-record-standard-v1_0.md` §T5-F、`remaining-apps-decision-v1.md` §15）をそのまま継承し、本Phaseでもこの3分類を単一指標へ集約しない。

合計確認: 13 + 2 + 2 + 1 + 17 = 35 ✓

---

## 4. Storage方式インベントリ

| 方式 | 該当 |
|---|---|
| localStorage（配列ベース） | Foundation 13本中12本、mogura-tataki、nazori-app、bosai-app（メモリ内のみ、永続化なし） |
| localStorage（Composite Object） | kyou-no-kiroku（`kyounokiroku`、Composite Storage Adapter経由） |
| IndexedDB | ongaku-app（演奏録音、`saveRecordingToDB`） |
| メモリ内のみ（永続化なし） | bosai-app（`allRecords`）、tokei-app（`quizState`） |
| sessionStorage | drawing-app・slideshow-sakuseiの一部設定 |
| Profile分離localStorage | gaze-keyboard（`gaze_history_<id>`/`gaze_stats_<id>`） |

**設定・非Record系storage（誤分類注意）**: a11y共通設定（コントラスト・文字サイズ・読み上げ）、`match-prefs3`（matching-app設定）、`sugoroku_presets`（盤面プリセット、Content）、`register_products`（商品カタログ、Content）、`kimochi_v2`（ボード内容、Content）、`nazorin_library_v1`（印刷テンプレートライブラリ、Content）はいずれもRecordではない。これらを「localStorageを使っている＝記録あり」と誤分類しないという既存原則（Foundation Audit文書§Addendum）を本Phaseでも維持した。

**「録音（Recording）」と「記録（Record）」の混同注意（本Phase新規整理）**: `ongaku-app`の`ongaku-compositions`（IndexedDB演奏録音）と`time-timer`の`tt_recordings`（localStorage音声メモ）は、いずれも**音声メディアファイルの保存機能**であり、T5 Standardが定義する「いつ・何に取り組んだかの活動記録（Learning/Activity Record）」とは異なる。両アプリともRecord分類上は「E. No Record」のまま据え置くが、将来「何分演奏したか」「何回タイマーを使ったか」等のMinimal Activity Recordを別途追加する余地はある（§8参照）。

---

## 5. Record Schema比較（Foundation統合済み13本 + Legacy Persistent 2本）

全アプリで無理に同一schemaへ寄せない、というT5 Standard §6の原則を維持する。

| アプリ | schema形状 | schemaVersion | inputMethod |
|---|---|---|---|
| hiragana-learn/katakana-app/suji-manabou | `{time, type, data}`（legacy） | 新規recordのみ付与 | フィールドなし（推測禁止） |
| directions-app | `{ts, tsLocal, category, question, userAnswer, correctAnswer, result}` | 新規recordのみ付与 | フィールドなし |
| miru-hirogaru-app | `{time, level, target, inputMethod, responseTime, dwellDuration, activationCount}` | あり | `"click"`/`"touch"`（実測値） |
| mitsukete-touch/junban-miyou/kurabeyou/katachi-awase/dotchiga-ii | Multi-Input Foundation pattern（`STORAGE_LOG_KEY`＋教材固有field） | あり | 実測値（apps差あり） |
| okane-app | `{ts, type, detail}`（自由記述文字列、構造化fieldなし） | 新規recordのみ | フィールドなし |
| sst-app | `{ts（epoch ms）, type, lv, result}`（`result`の意味は活動ごとに異なる） | 新規recordのみ | フィールドなし |
| kyou-no-kiroku | `{id, childIndex→stable childId, childName, date, kimochi, temp, pulse, spo2, ...}`（Composite） | あり | 該当なし（複数learner概念） |
| mogura-tataki（未統合） | `{date（年なし独自形式）, score, hits, misses, fumbles, rate, combo, diff, mode, time, goal, holes}` | なし | フィールドなし（技術的には実測可能、§8参照） |
| nazori-app（未統合） | `{id, sessionId, timestamp, mode, allChars, charCount, sessionDone, sessionTotal, image（base64、durationMin等）}` | なし | フィールドなし |

---

## 6. Record UI比較（Viewer/CSV/Delete/Accessibility）

| アプリ | Viewer | CSV | Delete | 44px/Escape/focus |
|---|---|---|---|---|
| Foundation 13本 | 各アプリ既存（統一しない、T5-D方針） | 12/13が既存CSVあり（sst-appのみViewer/CSV無） | 全13本「すべて削除」あり、kyou-no-kirokuのみ個別削除も可 | T5-D/T5-E-A〜Cで個別確認済み（既存実績） |
| mogura-tataki | `renderRecs()`直近25件+集計 | ✗ | 全削除のみ（confirm付き） | 未確認（次Phase） |
| nazori-app | `renderRecordsList()` | ✓（T6.5-A-HF1でExcel互換化済み） | 未確認 | T6.5-A系で一部確認済みの可能性、次Phaseで再確認 |
| bosai-app | PIN保護teacher dashboard（セッション限り） | ✓（セッション限り） | `clearAllRecords()` | 未確認 |
| tokei-app | 結果画面（同一セッションのみ） | ✓（セッションスナップショット） | 該当なし | 未確認 |
| gaze-keyboard | `renderHistoryTab()`日付グループ化 | ✗（印刷のみ） | Cascade Delete完備（T6-A） | ✓完了（T6-A''、44px/Escape対応済み） |

**UI標準化の結論（T5-D既存方針を継承）**: Common Viewerは作らない。表示整形（日時・inputMethod・grouping）はUI Foundation 4関数で共有し、DOM構築は各アプリの既存実装を維持する。

---

## 7. 教育的分類（Type 1/2/3 + Content/Tool）

Learning Record Standardの「観察可能な行動のみ記録する」原則（§2）に基づき、35アプリを以下へ分類した（本Phaseで新規に適用した分類軸）。

### Type 1（課題達成・学習型）— 正答/誤答・Level・回数が意味を持つ
Foundation統合済み: hiragana-learn・katakana-app・suji-manabou・directions-app・kurabeyou-app・katachi-awase-app・okane-app
未統合永続: mogura-tataki・nazori-app
session-only: bosai-app・tokei-app
No record: matching-app・shiritori2

### Type 2（活動・参加型）— 正答率は不要、取り組み内容・活動時間・入力方式が記録候補
Foundation統合済み: miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app
No record: janken-app・register-app・sugoroku-app・tyushi・cup_game・scratch-app・ongaku-app

### Type 3（コミュニケーション型）
gaze-keyboard（Communication History、既に別Standardで対応済み）
kimochi-board（現状はContent＝ボード構成の保存のみ。将来的に「使った履歴」を持つ場合はCommunication History Standardの対象になりうるが、本Phaseでは現状維持を推奨）

### Content / Tool（学習・活動記録の対象外、Recordを付ける教育的意味が薄い）
drawing-app・slideshow-sakusei・schedule-app・timetable-app・yomikaki-app・nazorin-print・time-timer（タイマー本体機能）・sst-app（`sst_diary_entries_v1`のみ、Privacy上スコープ外）

### 混在（Type1的要素とType2的要素の両方を持つ）
sst-app本体（`sst_activity_log_v1`）は「ロールプレイ・ソーシャルストーリー」等はType2、「SSTクイズ」はType1に近く、既存実装は`correct`概念を強制していない（既に正しい設計）。

---

## 8. no-record 17本 個別推奨（現Production基準）

| アプリ | 推奨Record | 理由 |
|---|---|---|
| janken-app | Activity Record（Type2） | じゃんけんの勝敗自体は学習目標ではなく、「何回遊んだか」「どの相手（キャラ）を選んだか」が活動記録として意味を持つ |
| shiritori2 | Learning Record（Type1/2混在） | 語彙学習の側面（出した言葉・しりとりが続いた回数）があり、正答率よりも「取り組んだ語彙の幅」が教育的に有用 |
| register-app | Activity Record（Type2） | ごっこ遊び型。合計金額・取引回数等の活動量が支援者に有用、正誤の概念は薄い |
| schedule-app | 記録不要（Tool） | 予定表の作成・閲覧ツールであり、児童の活動記録ではなく支援者が使う運用ツール |
| timetable-app | 記録不要（Tool） | 同上 |
| yomikaki-app | 記録不要（Tool） | 読み書き支援エディタ。編集内容はUser Contentであり活動記録の対象ではない |
| matching-app | Learning Record（Type1） | マッチングの正誤・所要時間はLevel推移の把握に有用。Foundation直接統合の技術的障壁は低いと推測されるが、次Phaseでのコード監査が必要 |
| sugoroku-app | Activity Record（Type2） | すごろく遊びの活動記録（プレイ回数・使用プリセット）程度が妥当。正答率は不要 |
| tyushi | Minimal Activity（Type2） | 注視訓練。「見る・気づく」ことが目的であり、正答率よりも取り組み時間・反応回数が意味を持つ |
| cup_game | Activity Record（Type2） | カップゲームの正解率よりも「何回挑戦したか」「どのモードで遊んだか」が活動記録として妥当 |
| kimochi-board | 記録不要（現状維持） | 現状はボード構成のContent保存のみ。将来「使った履歴」を持つ場合はCommunication History Standardの対象として個別評価が必要（本Phaseでは追加提案しない） |
| drawing-app | 記録不要（Content） | 作品作成ツール。将来的な作品保存機能自体が未実装であり、まずContent保存の要否から検討すべき（T7のスコープ外） |
| slideshow-sakusei | 記録不要（Content） | 同上 |
| time-timer | Minimal Activity（Type2、タイマー本体機能のみ） | 「何分のタイマーを何回使ったか」程度が支援者に有用な可能性はあるが、既存の`tt_recordings`（音声メモ）と混同しないよう設計注意が必要 |
| scratch-app | Activity Record（Type2） | けずりえ（感覚遊び）。「見る・触れる・変化を楽しむ」目的であり、正答率は不要。活動時間・使用回数が妥当 |
| ongaku-app | Activity Record（Type2） | 演奏・作曲活動の記録（演奏回数・活動時間）程度が妥当。既存の音声録音（`ongaku-compositions`）とは別軸として設計する |
| nazorin-print | 記録不要（Content Library） | 印刷テンプレートの保存機能であり、児童の活動記録ではなく支援者が使う教材作成ツール |

---

## 9. mogura-tataki評価（Priority A候補）

`donomana-learning-record-remaining-apps-decision-v1.md` §3の方針A（統合価値あり）を再確認し、変更なしと判断した。

- 現schema: `{date（年なし独自形式）, score, hits, misses, fumbles, rate, combo, diff, mode, time, goal, holes}`、直近60件ローリング
- storage: flat array（`mogura_v3`）、Foundation互換
- UI: Viewer（`renderRecs()`直近25件+集計）あり、CSVなし、全削除のみ（confirm付き）
- Foundationとの差: schemaVersionなし、inputMethodなし（技術的には`cfg.dwell`等から実測可能）
- badge: `"📊 学習記録あり"`（標準文言`"📊 きろく機能あり"`と異なる表記ゆれ、機能自体は正しく表示されている）
- **T7-B Pilot候補適性: 高い。** Foundation統合パターン（hiragana-learn/directions-appと同型）がそのまま適用でき、既存60件のlegacy dataとの互換性検証が「Legacy Compatibility」の実証にもなる。Type 1（課題達成型）の代表例として妥当。

---

## 10. tokei-app評価（Priority A候補）

`remaining-apps-decision-v1.md` §5の方針A（Foundationへ統合する価値が高い、実装は次Phaseでスキーマ設計から）を再確認した。

- 現状: メモリ内`quizState`のみ、永続化なし。既存CSVは単一クイズセッションのスナップショット（複数回分の履歴ではない）
- 教育的価値: 高い（時計の読み方は反復練習領域、日をまたいだ推移把握に価値がある）
- 設計課題: 「1問ごとに記録するか」「1クイズセット完了ごとに1recordとするか」の判断が必要（推奨: セット単位、既存Multi-Input Foundationのsuccess-only前例に倣う）
- **T6.5-BのHelpで「session-only」と正確に説明済みのため、永続化する場合は将来Help更新が必要**（本Phaseでは変更しない、§14参照）
- **T7-B Pilot候補適性: 中〜高い。** 新規schema設計が必要な点でmogura-tataki/nazori-appより実装コストが高いが、Type 1の別実装パターン（新規schema設計そのものの実証）として価値がある。

---

## 11. bosai-app評価（Priority A候補）

`remaining-apps-decision-v1.md` §4の方針A（永続的なLearning Recordを新設する価値がある）を再確認した。

- 現状: `allRecords`はメモリ内のみ、`saveRecords()`は実質no-op。PIN保護teacher dashboardという「持続する記録」を前提としたUXが既に存在するのに、実装が伴っていない状態
- badge: `"📊 きろく機能あり"`（過大表示、T5-B以来未解消）
- 設計課題: `name`フィールド（教員入力の生徒名）を永続化する場合、kyou-no-kirokuの「なまえ→よびな」ガイダンスと同様の配慮が必要
- **T7-B Pilot候補適性: 中い。** badge是正と機能実装が同時に必要になる点、PIN保護UIとの統合検証が必要な点で複雑度がやや高い。

---

## 12. nazori-app評価（本Phase新規発見、Priority A候補として追加提案）

T5-A/T5-B時点では「no record」に分類されていたが、Phase T6.5-A（T5 Close後）で永続Activity Record（`nazori_records`）が新設され、T6.5-A-HF1でCSV出力がExcel互換形式へ改善済みである。

- 現schema: `{id, sessionId, timestamp, mode, allChars, charCount, sessionDone, sessionTotal, image（base64トレース画像）, durationMin等}`
- Foundation互換性: flat array、Foundation統合パターンがそのまま適用できる可能性が高い（次Phaseでの詳細コード監査が必要）
- **Foundation未統合ゆえのリスク**: schemaVersionなし、`donomanaRecord*`API未使用。将来の共通Viewer化・CSV Standard統一の恩恵を受けていない
- **画像データを含む点が他のLegacy Persistentと異なる**: base64トレース画像はrecordサイズが他アプリ（100〜450 bytes/record）よりも大きくなる可能性が高く、Foundation統合時はStorage Capacity（§18相当）の実測が必須
- badge: 現状「📊」系badgeなし（過小表示、本Phase新規発見）
- **T7-B Pilot候補適性: 高い。** ただし画像データを含むrecord shapeはFoundationの想定（軽量フラットログ）と異なるため、Composite Storage Adapter同様の個別検証が必要になる可能性がある。

---

## 13. Multi-Input教材（Foundation統合4本）のinputMethod記録状況

miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・kurabeyou-app・katachi-awase-app・dotchiga-ii-appはいずれも`inputMethod`フィールドを実測ベースで記録済み（miru-hirogaru-appは`"click"`/`"touch"`、他は教材ごとに実測パターンが異なる）。旧世代アプリ（hiragana-learn・katakana-app・suji-manabou・directions-app・kyou-no-kiroku）は入力方式判定コード自体が存在しないため、推測禁止原則に従いフィールド自体を追加していない。

**T7としての結論**: inputMethod記録の共通拡張候補（brief §19）は、**技術的には価値があるが、既存アプリへの後付けは「推測禁止」の原則により入力判定コードの新規実装を伴う**。T7-Aでは実装しない。新規アプリ（今後の教材開発）では`donomana-new-app-development-standard-v1_0.md` §23（inputMethod記録REQUIRED・記録機能を持つ教材）に既に規定されており、追加のFoundation拡張は不要。

---

## 14. Durationの扱い

現行Foundation統合13本のうち、durationを明示的に記録しているのはminimal（miru-hirogaru-appの`dwellDuration`・`responseTime`、nazori-appの`durationMin`）。多くのアプリはduration自体を記録していない。

**Semantics調査結果**: 既存実装でduration計測は「アクティビティ開始〜完了」の範囲に限定されており、Help表示中・Settings操作中の時間を含めている実装は確認されなかった（miru-hirogaru-appの`responseTime`はユーザー操作イベント間の差分計測、nazori-appの`durationMin`はセッション開始〜完了の差分）。したがって「Helpを開いていた時間を含めてしまう」というbrief §20の懸念は、現行実装では該当しない。

**T7としての結論**: durationをCore Schemaへ追加する必要はない（既にapp-specific fieldとして各アプリが必要に応じて実装している）。新規アプリ向けの実装ガイダンスとして、「アクティビティの開始〜完了イベント間でのみ計測し、Help/Settings操作中を含めない」という既存の暗黙的な実装パターンを明文化する価値はあるが、これはT7-B以降のStandard改訂候補とする。

---

## 15. Session ID

nazori-appは既に`sessionId`を内部的に保持しており（`makeRecordId()`と組み合わせて使用）、ユーザー向けCSVへ内部IDをそのまま露出していないことをT6.5-A-HF1で確認済み（既存の設計方針と整合）。T7でCore Schemaへ`sessionId`を追加する提案は行わない（app-specific fieldとして必要に応じて実装する既存方針を維持）。

---

## 16. Core + Extension方式の評価（設計案のみ、T7-Aでは正式化しない）

brief §32-33の提案を、既存Foundation実装と照合した。

**結論: 既存のFoundation設計は、既に事実上Core + Extension方式である。**

- Core（既存Core Schema §5）: `timestamp, appId, activity, inputMethod, schemaVersion`
- Extension（既存 §6 App-specific Payload）: `level, target, selected, concept, result, score, responseTimeMs, dwellDuration`等、教材固有フィールドをフラットに追加する方式（nested payloadへの統一は「将来的に検討」のまま未着手）

**T7として新規提案する差分**: 既存Core Schemaは4フィールド+schemaVersionのみで、`duration`や`sessionId`のようなよく使われるが必須ではないフィールドをCoreに含めていない。これは意図的な最小主義（Standard §5-6の設計判断）であり、**本Phaseでは変更を提案しない**。無理に正式schemaを拡張するより、現行の「Core最小限＋App-specific自由記述」を維持する方が、既存13本の実装ずれ（例: sst-appの`ts`がepoch msでhiragana-learnはja-JPロケール文字列）を考えると安全である。

---

## 17. Migration方針

既存15本（Foundation統合済み13 + Legacy Persistent 2）のrecordデータを破壊しない、というT5の既存原則を継承する。

- mogura-tataki/nazori-appをFoundationへ統合する場合、既存recordはlegacy read compatibilityで扱う（`donomanaRecordNormalizeLegacy`が`schemaVersion`欠落を1として補完、既存フィールドは書き換えない）。T5-B〜T5-E-Cで13本に対して実証済みの手法であり、新規手法は不要
- bosai-app/tokei-appは現状recordが存在しない（メモリ内のみ）ため、migrationの概念自体が発生しない（新規schema設計のみ）
- schema version管理は既存の`schemaVersion`フィールド方式を継続する。新しいversioning機構の追加は不要

---

## 18. CSV横断方針

T5-E-A'で確立したExcel互換Date/Time Standard（`YYYY.MM.DD`+`HH:mm:ss`の2列分離）を、将来Foundation統合するアプリ（mogura-tataki/tokei-app/bosai-app/nazori-app）のCSVにも適用することを推奨する。ただし列構成そのものは全アプリ統一しない（UI Standard §12の既存方針を継続）。

nazori-appは既にT6.5-A-HF1で同等のExcel互換形式（日付・時刻分離、内部ID非露出）を独自に実装済みであり、Foundation統合時も既存CSV出力方式を壊さない設計を優先する。

---

## 19. Help同期方針（T7 Rollout設計への組み込み、REQUIRED）

T6.5-Bで11アプリに「つかいかた」を整備した際、tokei-app・bosai-appは**session-only**であることをHelp内で正確に説明済みである（T6.5-B5/B6の実装内容）。

**T7-B以降でtokei-app/bosai-appへ永続Learning Recordを追加する場合、対応するHelpの「記録」説明を同時に更新することを必須作業とする。** 具体的には:

- tokei-app: `helpModal`内の記録関連セクション（現状「このセッション内の結果のみ」という説明があれば「保存され、あとで振り返れます」等へ更新）
- bosai-app: `help-modal`内の同様の箇所

nazori-app・mogura-tatakiは元々「記録あり」教材としてHelpが整備されている可能性があるため、Foundation統合時もHelp内容の実態との整合を個別確認する（変更が必要な場合のみ更新、無変更なら不要）。

---

## 20. generate.js安全策（REQUIRED、T6.5-B9教訓の適用）

T6.5-B Production Releaseで、Help buttonがgenerate.jsの`<!-- lock-fs-btn --> ... <!-- /lock-fs-btn -->`マーカー領域内に誤挿入され、`node generate.js`実行のたびに削除される重大バグを発見・修正した（T6.5-B9）。

**T7の各実装Phaseでは、Record UI（ボタン・モーダル等）を追加する際、以下を必須手順とする**:

1. 実装前に、対象アプリの既存marker境界（`lock-fs-btn`・`home-btn`・`a11y-panel`・`favicon`・`gaze-shared-js`・`learning-record-foundation-js`等）を`grep`で確認し、新規UIをどのmarkerの外側（またはgenerate.jsが意図的に管理する領域の内側）に配置すべきかを事前に判断する
2. 実装後、最低3回連続で`node generate.js`を実行し、2回目・3回目でファイルハッシュが変化しないこと（idempotence）をSHA-256で確認する
3. 対象ファイルの`git diff`を確認し、意図しない他アプリ・`index.html`・`sitemap.xml`への影響がないことを確認する

Learning Record Foundation自体は既に`<!-- learning-record-foundation-js -->`マーカーで正しく管理されており（T5-Bで確立済み、13本で実績あり）、本節の教訓が必要になるのは主に**Record UI（Viewer/CSV/Delete button等）を新たに追加する場合**である。

---

## 21. Validation Standard（T7-B以降で適用）

T5/T6-Aで実績のある検証項目を、T7-Bの標準チェックリストとして再整理する。

- Record作成（1操作→1 record、重複記録なし）
- reload後の永続化確認
- 複数Record（legacy + 新規混在）の共存確認
- 個別delete（該当アプリのみ）／全delete（confirm付き、cancel時は記録保持）
- CSV（BOM・Excel互換日時・日本語・カンマ/クォート/改行エスケープ・Formula Injection非該当）
- corrupt/malformed storage時のfallback（クラッシュしない、空配列へfallback）
- schemaVersion欠落時のlegacy read
- XSS（Communication History系のみ、利用者入力を含むアプリでは必須。T6-A'の`textContent`優先パターンを踏襲）
- 44px touch target・keyboard操作・Escape close・focus return
- responsive（375×667/390×844/768×1024/desktop）
- `node generate.js`を3回連続実行してのidempotence
- console/page error = 0/0（実ブラウザ、Playwright）
- Gaze/Switch Scan既存動作への非干渉（Record UI追加が既存のgaze対象外判定・scan candidate取得ロジックへ影響しないことを確認）

---

## 22. Priority分類

### Priority A（教育的価値・実装容易性・Foundation整合性のいずれも高い）

| アプリ | 理由 |
|---|---|
| mogura-tataki | Foundation互換schema、既存Viewer/badge有、統合コスト最小 |
| nazori-app | 既にExcel互換CSV実装済み、Foundation統合で恩恵大きいが画像データ考慮が必要 |
| tokei-app | badgeとUXが既に永続記録を前提、教育的価値高い、新規schema設計が必要 |
| bosai-app | PIN dashboard UXが既に永続記録前提、badge是正も同時に必要 |

### Priority B（教育的価値はあるが、実装複雑度や優先度がAより低い）

| アプリ | 理由 |
|---|---|
| matching-app | Type1、正誤概念あり、Foundation統合の技術的障壁は次Phase監査待ち |
| shiritori2 | 語彙学習の記録価値はあるが、正誤概念が曖昧で設計検討が必要 |
| ongaku-app | 既存の音声録音機能との役割分離設計が必要 |
| time-timer | 既存の音声メモ機能との役割分離設計が必要 |

### Priority C（記録追加の教育的動機が弱い、または現状維持が妥当）

| アプリ | 理由 |
|---|---|
| janken-app・register-app・sugoroku-app・tyushi・cup_game・scratch-app | Type2活動記録の追加候補ではあるが、緊急性は低い |
| schedule-app・timetable-app・yomikaki-app・drawing-app・slideshow-sakusei・nazorin-print・kimochi-board | Tool/Content系。記録追加より他の改善（該当あれば）を優先すべき |

---

## 23. T7-B Pilot選定提案（ユーザー確認待ち、本Phaseでは決定しない）

brief §28の方針（異なるタイプから最低2本）に従い、以下を提案する。

- **Pilot候補A（課題達成型・Foundation統合パターン実証）**: **mogura-tataki**。既存13本と同型の統合パターンがそのまま適用でき、リスクが最も低い「最初のRollout」に適する（T5-E-Aがkatakana-app/suji-manabouを同型ゆえ最初に選んだ判断パターンを踏襲）
- **Pilot候補B（新規schema設計・session-only→persistent昇格の実証）**: **tokei-app**または**bosai-app**。いずれもFoundationが「新規schemaを最初から設計する」という、既存13本にはなかったパターンを実証する機会になる。tokei-appの方が`name`フィールドのPrivacy配慮（bosai-app）を伴わない分、実装がシンプル

最終選定は、T7-A Final Reportをユーザーへ提出し、優先順位・懸念点（nazori-appの画像データ考慮、bosai-appのPrivacy配慮等）を確認した上でT7-Bで確定する。

---

## 24. 次Phase実装候補一覧（未実装、T7-B以降）

- mogura-tataki: Foundation統合（badge表記統一は別途）
- nazori-app: Foundation統合検討（画像データのStorage Capacity実測が前提）
- tokei-app: 新規schema設計＋Foundation統合＋Help更新
- bosai-app: 新規schema設計＋Foundation統合＋Help更新＋`name`フィールドPrivacy配慮
- matching-app/shiritori2/janken-app等17本: 個別のRecord新設要否をT7-C以降で段階検討（本Phaseでは方向性のみ提示、実装順は未確定）

---

## 25. Production状態

本Phase中、`main`/`origin/main`ともに`01e8ebf`のまま変更なし。アプリ実装ファイルへの変更は一切行っていない。本文書のみを新規作成し、T7-A用worktree（`for-all-children-to-learn-t7-record-foundation`、branch `feature/record-foundation-expansion-t7`）内でのみコミットする。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-30 | Phase T7-A。全35アプリの現Production実コード再Inventoryを実施。T5-F Close時点（`865976d`）からの差分としてnazori-appの新規Activity Record（T6.5-A由来）を発見し、persistent Learning/Activity Record数を14→15本、no-record数を18→17本へ更新。mogura-tataki/nazori-app/tokei-app/bosai-appをPriority A候補として整理し、T7-B Pilot候補（mogura-tataki + tokei-app/bosai-app）を提案。Production・main・changelogはいずれも無変更。 |
