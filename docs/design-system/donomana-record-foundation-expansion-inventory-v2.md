# どのまな Record Foundation Expansion — 全35アプリ再Inventory / 優先順位再決定（Version 2.0）

- 版: v2.0（v1.0を全面改訂・置き換え）
- 発行: 2026年8月31日（Phase T7-E）
- 位置づけ: `donomana-record-foundation-expansion-inventory-v1.md`（Phase T7-A、baseline `01e8ebf`）を実コードで再監査し、T7-B〜T7-D（mogura-tataki・tokei-app・nazori-app・bosai-appのFoundation統合）完了後の現Production状態に更新した文書。**v1.0の分類をそのまま流用せず、全項目を現行コードから再確認した。**
- baseline: `9aa359e`（`main` = `origin/main`、Phase T7-D Production Release後のHEAD）
- worktree: `for-all-children-to-learn-t7e-record-inventory`
- branch: `docs/record-coverage-inventory-t7e`
- 本Phaseのスコープ: **調査・分析・優先順位決定のみ。アプリ実装変更・generate.js変更・main merge・push・deploy・changelog変更はいずれも行っていない。**

---

## 0. 関連文書（Source of Truth、重複再定義しない）

| 文書 | Phase | 位置づけ |
|---|---|---|
| `donomana-learning-record-standard-v1_0.md` | T5 | Core Schema・Foundation API・Badge定義。正式Close済み |
| `donomana-learning-record-foundation-audit-v1.md` | T5-A/B | 全35アプリ原本監査（`afe74e9`時点） |
| `donomana-learning-record-remaining-apps-decision-v1.md` | T5-E-D | mogura-tataki/bosai-app/tokei-app/gaze-keyboardの個別方針決定（`865976d`時点） |
| `donomana-learning-record-ui-standard-v1_0.md` | T5-D〜E-A' | Viewer/CSV/Excel互換Date-Time Standard |
| `donomana-communication-history-standard-v1_0.md` | T6-A | gaze-keyboard Communication History正式Standard |
| `donomana-record-foundation-expansion-inventory-v1.md` | T7-A | **本文書が置き換える前版**。35アプリ再Inventory・T7-B Pilot提案 |
| 本文書 | T7-E | **35アプリ三度目の再Inventory。Foundation 13→17本化後の状態を反映し、次のExpansion対象を決定** |

---

## 1. Baseline確認

```
git fetch origin
main       = 9aa359e
origin/main = 9aa359e
working tree clean（drift無し）
```

T7-A（`01e8ebf`）からT7-E開始（`9aa359e`）までの20コミットを確認。うちLearning Record関連の実質変更は以下:

- `48226ed` mogura-tataki: Foundation統合（T7-B Pilot A）
- `5482baf` tokei-app: 新規Persistent Learning Record新設（T7-B Pilot B）
- `54ae412` T7-Bユーザーレビュー対応
- `829fee5` mogura-tataki: ホーム記録ボタンの可視性修正
- `5eaa6af` Foundation: non-array storage guardの追加（T7-H1、全17アプリ共通ハードニング）
- `6c28177` nazori-app・bosai-appをFoundationへ拡張（T7-D相当）
- `ee4268e` nazori-app: タブの44pxタッチターゲット修正
- `efde9dd`〜`11805e8` katachi-awase-app: KAP-1パズルモード追加（Record schemaに新活動タイプを追加）
- `8be78ab`/`af4ab7d` gaze-keyboard: Word出力機能（Communication Historyのstorage schemaには不関与、diff確認済み）

**Learning Record Foundation Programに直接関係しない変更（本Phaseのスコープ外、参考記録のみ）**: katachi-awase-appのKAP-1パズルモード自体の教育設計、gaze-keyboardのWord出力機能。

---

## 2. Total Production Apps = **35**

`apps-data.json`（正本）から動的取得。全35件の`filename`+`.html`が実在することを再確認済み。T7-A時点（`01e8ebf`）と**総数の変化なし**（新規アプリ追加・削除いずれもなし）。

孤立ファイル（`apps-data.json`未登録、Production一覧に非表示）: `app-register.html`/`cooking.html`/`meeting-notes-app.html`/`shisen.html`/`sugoroku-online.html`/`switch-training-app.html`の6件。T7-Aと変化なし、本Phaseもスコープ外として扱う。

---

## 3. Foundation対象 = **17アプリ**（`generate.js`の`LEARNING_RECORD_FOUNDATION_APPS`で実測確認）

```js
LEARNING_RECORD_FOUNDATION_APPS = new Set([
  'miru-hirogaru-app', 'hiragana-learn', 'directions-app', 'kyou-no-kiroku',
  'katakana-app', 'suji-manabou', 'mitsukete-touch-app', 'junban-miyou-app',
  'kurabeyou-app', 'katachi-awase-app', 'dotchiga-ii-app', 'okane-app',
  'sst-app', 'mogura-tataki', 'tokei-app', 'nazori-app', 'bosai-app'
]);
```

brief記載の想定17本と完全一致。T7-A時点（13本）から **mogura-tataki・tokei-app・nazori-app・bosai-appの4本が追加**され17本化されたことを実コードで確認した。

---

## 4. 全35アプリ Classification（本Phaseで再定義した A〜F 区分）

### 4.1 区分定義

| 区分 | 定義 |
|---|---|
| A. Foundation Persistent | 共通Learning Record Foundation (`donomanaRecord*`) 利用 |
| B. Other Persistent | localStorage等で独自に永続記録するがFoundation未使用 |
| C. Session-only | その回だけ結果を保持、reload/closeで消える |
| D. Communication/History | 一般的Learning Recordとは異なる履歴・コミュニケーションログ |
| E. No Record | 記録機能なし（追加候補） |
| F. Record Not Recommended | 記録機能なし、かつ教育的・Privacy・UX上、追加を積極推奨しない |

### 4.2 全数集計（`9aa359e`時点、実コード確認済み）

| 区分 | 該当数 | 内訳 |
|---|---|---|
| A. Foundation Persistent | **17** | §3参照 |
| B. Other Persistent | **0** | 該当なし（T7-A時点のB=mogura-tataki/nazori-appは両方Aへ移行済み） |
| C. Session-only | **0** | 該当なし（T7-A時点のC=bosai-app/tokei-appは両方Aへ移行済み） |
| D. Communication/History | **1** | gaze-keyboard |
| E. No Record | **8** | matching-app・shiritori2・janken-app・register-app・sugoroku-app・tyushi・cup_game・ongaku-app |
| F. Record Not Recommended | **9** | scratch-app・time-timer・kimochi-board・schedule-app・timetable-app・yomikaki-app・drawing-app・slideshow-sakusei・nazorin-print |
| **合計** | **35** | 17+0+0+1+8+9 = 35 ✓ |

**最重要所見**: T7-A時点で「B（Legacy Persistent）」「C（Session-only）」に分類されていたアプリは、T7-B〜T7-D完了により**すべてA（Foundation）へ移行済み**。すなわち「独自実装のまま放置された永続Learning Record」「実装未完成のsession-only記録」は、`9aa359e`時点で**ゼロ本**である。これはT5-A（原本監査）以来、初めてB/C区分が空になった状態であり、Foundation Programの技術的負債が実質的に解消されたことを意味する。

---

## 5. 各アプリ Inventory（全35本）

### 5.1 A. Foundation Persistent（17本）

| id | storage key | schema形状 | schemaVersion | inputMethod | CSV | Viewer | Delete | Foundation化Phase |
|---|---|---|---|---|---|---|---|---|
| hiragana-learn | `hiragana_log` | legacy `{time,type,data}` | 新規recordのみ | フィールドなし | ✓ | ✓ | ✓ | T5-B |
| katakana-app | `katakana_log` | legacy同型 | 新規recordのみ | フィールドなし | ✓ | ✓ | ✓ | T5-E-B |
| suji-manabou | `learningLog`相当 | legacy同型 | 新規recordのみ | フィールドなし | ✓ | ✓ | ✓ | T5-E-B |
| directions-app | `appLogs`（`MAX_LOGS`上限） | `{ts,tsLocal,category,question,userAnswer,correctAnswer,result}` | 新規recordのみ | フィールドなし | ✓ | ✓ | ✓ | T5-B |
| miru-hirogaru-app | `miru_hirogaru_log` | `{time,level,target,inputMethod,responseTime,dwellDuration,activationCount}` | あり | `"click"`/`"touch"`実測 | ✓ | ✓ | ✓ | T5-B（Reference実装） |
| mitsukete-touch-app | `STORAGE_LOG_KEY` | Multi-Input pattern | あり | 実測値 | ✓ | ✓ | 未確認 | T5-E-B |
| junban-miyou-app | `STORAGE_LOG_KEY` | Multi-Input pattern | あり | 実測値 | ✓ | ✓ | 未確認 | T5-E-B |
| kurabeyou-app | `STORAGE_LOG_KEY` | Multi-Input pattern | あり | 実測値 | ✓ | ✓ | 未確認 | T5-E-B |
| katachi-awase-app | `STORAGE_LOG_KEY`(`katachi_log`) | Multi-Input pattern＋**KAP-1パズル型を追加**（本Phase新規確認、§9参照） | あり | 実測値 | ✓ | ✓ | ✓ | T5-E-B、KAP-1で活動タイプ拡張済み |
| dotchiga-ii-app | `STORAGE_LOG_KEY` | Multi-Input pattern | あり | 実測値 | ✓ | ✓ | 未確認 | T5-E-B |
| okane-app | `okane_activity_log` | `{ts,type,detail}`（自由記述） | 新規recordのみ | フィールドなし | ✓ | ✓ | 未確認 | T5-E-C |
| sst-app | `sst_activity_log_v1` | `{ts(epoch ms),type,lv,result}` | 新規recordのみ | フィールドなし | ✗（Viewer/CSVなし、週次レポートのみ） | △ | 部分確認 | T5-E-C |
| kyou-no-kiroku | `kyounokiroku`（Composite） | `{children[],records[]}` | あり | 該当なし | ✓ | ✓ | ✓ | T5-C |
| **mogura-tataki** | `mogura_v3`（60件ローリング） | `{date,score,hits,misses,fumbles,rate,combo,diff,mode,time,goal,holes,schemaVersion}` | **あり**（本Phaseで確認） | フィールドなし | ✗（未実装） | ✓（`renderRecs()`） | ✓（全削除のみ） | **T7-B Pilot A** |
| **tokei-app** | `tokei_log`（200件上限） | `{timestamp,appId,activity,inputMethod:null,schemaVersion,difficulty,mode,total,correct,retried,avgTimeSec,durationSec}` | **あり** | 明示的にnull（推測禁止原則） | ✓ | ✓ | ✓ | **T7-B Pilot B（新規schema設計）** |
| **nazori-app** | `nazori_records`（60件ローリング、画像含むため縮小） | `{id,sessionId,timestamp,mode,allChars,charCount,sessionDone,sessionTotal,image(base64),durationMin}` | 未確認（レガシー扱いの可能性） | フィールドなし | ✓（Excel互換） | ✓ | 未確認 | T6.5-A新設 → **T7-D Foundation統合** |
| **bosai-app** | `bosai_log`（200件上限、新規キー） | `{id,kind,name,simType,correct,total,score,dateStr,timestamp,log}` | 未確認 | フィールドなし | ✓ | ✓（PIN保護teacher dashboard） | ✓（個別/全削除） | **T7-D新規Persistent化** |

**mogura-tataki/tokei-app/nazori-app/bosai-appの4本は本Phase最大の差分。** `donomanaRecordReadLog`/`WriteLog`/`AddLog`/`ClearLog`経由であることをgrepと実コード読解の両方で確認済み。

### 5.2 D. Communication/History（1本）

| id | storage key | 内容 | Viewer | Export | Delete |
|---|---|---|---|---|---|
| gaze-keyboard | `gaze_history_<profileId>`/`gaze_stats_<profileId>` | 利用者本人の発話内容そのもの（AAC） | ✓（日付グループ化） | Word出力（本Phase期間中に追加、印刷機能の代替/拡張） | Cascade Delete完備（T6-A） |

Learning Record Foundationへ統合しない方針（T6-A確定）を維持。storage schema自体はgit diffで無変更を確認済み。**Separate Systemとして明示**（§15参照）。

### 5.3 E. No Record（8本、追加候補）

§7・§8で詳述。

### 5.4 F. Record Not Recommended（9本）

§7で詳述。

---

## 6. Existing Foundation Quality Gaps（17本 High-level確認、実装しない）

再実装はしないが、明らかな重大gapを報告する。

### 6.1 Badge過小表示（本Phase新規発見、重要）

`apps-data.json`の`badges`を再確認したところ、**tokei-appとnazori-appの2本は、Foundation統合済みにもかかわらず「📊」系の記録関連badgeを一切持たない**。

| id | 現在のbadges | 記録関連badge | 実装状態 |
|---|---|---|---|
| tokei-app | `["📱 iPad対応"]` | **なし（過小表示）** | Foundation統合済み（T7-B） |
| nazori-app | `["🆓 完全無料・登録不要","🖨️ 印刷用ワークシート対応","♿ アクセシビリティ機能搭載","📱 タブレット・PC対応"]` | **なし（過小表示）** | Foundation統合済み（T6.5-A→T7-D） |
| bosai-app | `["🔘 スイッチスキャン対応","🔊 音声よみあげ対応","📱 iPad対応","📊 きろく機能あり"]` | あり（正しい） | Foundation統合済み（T7-D） |
| mogura-tataki | `[..., "📊 学習記録あり", ...]` | あり（表記ゆれ継続、T5-E-D以来未解決） | Foundation統合済み（T7-B） |

tokei-app・nazori-appは、T5-E-D/T7-A時点では「badgeなしが正しい」（tokei-app）または「badge欠落=過小表示の既存指摘」（nazori-app）だったが、**Foundation統合後の現在はどちらも実態と乖離した過小表示**になっている。利用者（保護者・教員）がbadge一覧だけを見て「記録機能がある教材」を探す場合、この2本は正しく見つけられない。

### 6.2 bosai-appの`name`フィールド永続化とPrivacy配慮の欠落（本Phase新規発見、重要）

`student-name-input`（「次に挑戦する児童の名前（任意）」、placeholder「たろう」）は、T5-E-D §4.5が「永続化する場合はkyou-no-kirokuの『なまえ→よびな』ガイダンスと同様の配慮が必要」と明示していた項目である。

本Phaseでコード確認したところ、T7-Dでの永続化実装（`bosai_log`への`name`フィールド保存）にあたり、**ニックネーム推奨等のガイダンス文言は追加されていない**（grep確認: 「よびな」「ニックネーム」「あだ名」いずれも本文中に非該当）。さらに、比較対象として参照されていたkyou-no-kiroku側にも同種のガイダンス文言は実在しない（`addChild()`のplaceholderは「なまえ（例：たろうさん）」のみ）ことを本Phaseで新規確認した。つまりT5-E-D文書が前提とした「既存の先行事例」自体が実装されていなかったことが判明した。

**影響**: bosai-appの生徒名は現在、教員入力の自由文字列としてそのまま端末内に永続保存される（200件上限、外部送信なし）。氏名を含む個人情報の保存であり、Privacy評価は「中」に格上げすべき状態である。

### 6.3 Badge表記ゆれ（T5-E-D §7で既出、継続未解決）

記録関連badgeの文言が最低6パターンに分散（「📊 きろく機能あり」9本、「📊 きろく機能」suji-manabou、「📊 学習記録CSV対応」okane-app、「📊 学習ログ・CSV出力」directions-app、「📥 CSV書き出し対応」kyou-no-kiroku、badgeなしsst-app、加えて本Phase発見のtokei-app/nazori-appの完全欠落）。表記統一Stepは未着手のまま。

### 6.4 katachi-awase-appのKAP-1パズル記録（本Phase新規発見、軽微）

KAP-1（パズルモード）は既存の`STORAGE_LOG_KEY`(`katachi_log`)を共有し、「完成したパズル1件＝1レコード」として記録する設計であることをコード確認した（`concept === 'puzzle'`の分岐、`pe.time`ベースの日付整形）。既存のかたち合わせ活動（`concept`が別値）と同一storageに混在するが、CSV出力側で「かたち概念の行にはshapeSize列が空欄になる」という後方互換設計が確認できた（重大gapではない、正しい設計として記録）。

---

## 7. E/F分類の判断根拠（Educational Value・Privacy・Storage Cost）

### 7.1 E. No Record（8本、追加候補）

| id | 現状（実コード確認） | Educational Value | Privacy | Storage Cost | 判断理由 |
|---|---|---|---|---|---|
| matching-app | `match-prefs3`は設定のみ。VSモードで`score`/`correct`を計算しているがpersistenceなし。プレイヤー名は`DEFAULT_NAMES`固定配列（自由入力ではない） | **High** | Low | text/structured JSON、小 | 正誤・ペア数・レベルが明確、Foundation直接統合可能な構造（既にscore計算ロジックあり） |
| shiritori2 | a11y設定のみ永続。ゲーム内`score`/`correct-anim`はメモリ内のみ、gameover画面で消失 | **High** | Low | text/structured JSON、小 | 語彙学習の幅・ひっかけ問題正答率は教育的に有用、tokei-app型（セッション完了=1record）がそのまま適用可能 |
| janken-app | a11y設定のみ永続 | Medium | Low | 極小 | 勝敗自体は学習目標でないが、活動回数・相手選択が参加記録として妥当 |
| register-app | `register_products`はContent（商品カタログ）。取引記録は未実装 | Medium | Low〜Medium（商品写真アップロードは対象外、取引ログ自体に個人情報なし） | 小 | ごっこ遊び型、合計金額・取引回数が活動量指標になる |
| sugoroku-app | `sugoroku_presets`はContent（盤面）。プレイ履歴は未実装 | Medium | Low | 小 | プレイ回数・使用プリセット程度が妥当 |
| tyushi | a11y設定のみ永続 | Medium（要注意、下記） | Low | 極小 | 注視訓練。取り組み回数・時間は有用だが、**正答率型の指標は避けるべき**（§13参照、感覚・注視訓練でscoreを主指標にしない） |
| cup_game | a11y設定のみ永続 | Medium | Low | 極小 | 挑戦回数・モードが活動記録として妥当、正答率は補助情報にとどめる |
| ongaku-app | IndexedDB（演奏録音、Content）＋a11y設定。演奏活動ログ自体は未実装 | Medium | Low | 小（録音自体は既存Content機能で別軸） | 演奏回数・活動時間は音声保存機能と役割分離した設計が必要 |

### 7.2 F. Record Not Recommended（9本）

| id | 理由 |
|---|---|
| scratch-app | けずりえ（感覚遊び）。「見る・触れる・変化を楽しむ」ことが目的で正答概念がない。brief §7が挙げる「sensory interaction」の典型例であり、数値記録化は教材の性質を歪める可能性が高い |
| time-timer | 視覚支援タイマー。学習活動ではなく支援ツール。「タイマーを何回使ったか」の記録は教育的振り返りの対象になりにくい |
| kimochi-board | ボード内容自体がContent。将来的に「使った履歴」を持つ場合はCommunication History Standard（gaze-keyboardと同系統）の対象になりうるが、Learning Record Foundationの対象ではない |
| schedule-app | 支援者が使う運用ツール（予定表）。児童の活動記録ではない |
| timetable-app | 同上（時間割） |
| yomikaki-app | 読み書き支援エディタ。編集内容はUser Content |
| drawing-app | 自由お絵かき（作品保存自体が未実装、Content） |
| slideshow-sakusei | スライドショー作成ツール（Content） |
| nazorin-print | 印刷テンプレートライブラリ（支援者が使う教材作成ツール、Content） |

---

## 8. Record Unit / Payload候補（E区分8本のみ、実測可能な情報のみ）

| id | Record Unit案 | Payload候補（存在するデータのみ） |
|---|---|---|
| matching-app | 1ゲーム完了（通常/VSモード問わず） | `{mode, level, pairsTotal, pairsCorrect, attempts, durationSec}`（VSモード時は`playerCount`のみ、個人名は含めない） |
| shiritori2 | 1クイズセット完了 | `{total, correct, trickQuestionCorrect, durationSec}` |
| janken-app | 1セッション（規定回数終了 or ホーム帰還） | `{playCount, opponentSelected, winCount}` |
| register-app | 1接客（会計完了） | `{transactionCount, totalAmount, itemCount}` |
| sugoroku-app | 1ゲーム完了 | `{presetUsed, playerCount, turnsPlayed}` |
| tyushi | 1セッション完了 | `{sessionDurationSec, attemptCount}`（**正答率は含めない**、§13準拠） |
| cup_game | 1ラウンド完了 | `{mode, attemptCount, durationSec}`（正答率は補助値にとどめる） |
| ongaku-app | 1演奏セッション完了 | `{durationSec, mode}`（録音の有無は既存Content機能側の情報、record側では扱わない） |

いずれも既存コードから実測可能な範囲に限定した。存在しないフィールド（診断的評価・能力ラベル等）は提案していない。

---

## 9. Multi-Input教材のinputMethod記録状況（再確認、変化なし）

Multi-Input Foundation 6本（miru-hirogaru-app/mitsukete-touch-app/junban-miyou-app/kurabeyou-app/katachi-awase-app/dotchiga-ii-app）は`inputMethod`を実測ベースで記録済み。T7-B〜T7-Dで新規統合した4本（mogura-tataki/tokei-app/nazori-app/bosai-app）はいずれも**inputMethod: null または フィールドなし**を維持しており、「推測禁止」の原則（入力判定コードが実在しない限りフィールドを追加しない）に整合していることを実コードで確認した（tokei-appはコメントで明示的に理由を記載済み）。

**E区分8本への提案**: janken-app・register-app・sugoroku-app・tyushi・cup_game・ongaku-appはタッチ/視線/スイッチ等の複数入力に対応するものもあるが（`a11y`badgeで確認）、入力方式を実測判定するコード自体が存在しないため、新規Record実装時もinputMethodフィールドは追加しない（推測禁止原則の継続適用）。

---

## 10. gaze-keyboard Separate System判断（再確認）

T6-A確定分類（Communication History、Learning Record Foundation非統合）を`9aa359e`時点のコードで再検証し、**変更なしで妥当**と結論した。storage schema（`gaze_history_<id>`/`gaze_stats_<id>`）自体に差分がないことをgit diffで確認済み。本Phase期間中に追加されたWord出力機能は既存の印刷Viewer相当の拡張であり、Communication History Standardの分類・データライフサイクルには影響しない。

## 11. gaze-keyboard Switch Scan Backlog（Cross-cutting、1行のみ保持）

GK-HF1で判明した「Word / Print / Copy / Speak / Clear等のAction buttonsがSwitch Scan候補に含まれていない」問題は、Record Inventoryとは別のAccessibility Backlogとして保持する。**T7-Eでは実装しない。**

---

## 12. Priority Group化（E区分8本）

### Priority A（次に実装すべき）

| id | 理由 |
|---|---|
| matching-app | Educational Value High、既存score/correctロジックが既にあり技術的障壁が最小、Privacy Low（固定プレイヤー名） |
| shiritori2 | Educational Value High、tokei-app型（セッション完了=1record）パターンがそのまま適用可能、Privacy Low |

### Priority B（その次）

| id | 理由 |
|---|---|
| janken-app | Medium価値、実装コスト最小（勝敗カウントのみ） |
| register-app | Medium価値、Content（商品カタログ）とRecordの分離設計が必要 |
| cup_game | Medium価値、既存a11y（視線入力対応）との整合確認が必要 |

### Priority C（低優先）

| id | 理由 |
|---|---|
| sugoroku-app | 複数人プレイのUI複雑度がやや高い |
| tyushi | 感覚・注視訓練のためscore中心設計を避ける必要があり、Payload設計に追加の慎重さが要る |
| ongaku-app | 既存IndexedDB音声保存機能との役割分離設計が必要、複雑度中 |

### Separate / Not Recommended

F区分9本（§7.2）＋ gaze-keyboard（Separate System、§10）。

---

## 13. T7-F候補案（最低3案、比較のみ・決定はユーザー承認後）

### Plan A（2 apps、推奨）

**matching-app + shiritori2**

- 教育価値: いずれもHigh
- Implementation cost: 低〜中（両方とも新規schema設計だが、tokei-app T7-B Pilot Bで実証済みのパターンをそのまま適用できる）
- Risk: 低（Privacy Low、既存score計算ロジックの流用のみ）
- Expected time: 各2〜4h（下記§14）

### Plan B（3 apps）

**matching-app + shiritori2 + janken-app**

- 教育価値: High×2 + Medium×1
- Implementation cost: 中（janken-appは実装自体は最小だが、3本同時進行でのvalidation負荷が増える）
- Risk: 低〜中
- Expected time: 合計6〜10h

### Plan C（2 apps、代替案）

**matching-app + tyushi**

- 教育価値: High×1 + Medium×1（ただしtyushiは正答率中心設計を避ける必要があり評価の質が異なる）
- Implementation cost: 中（tyushiは「score以外の指標」を新規設計する必要があり、既存2パターン（legacy/Multi-Input/quiz型）のいずれとも異なる第4のPayload設計になる）
- Risk: 中（感覚訓練教材でのRecord設計は初の試みであり、慎重な検証が必要）
- Expected time: matching-app 2〜4h + tyushi 4〜8h

**推奨: Plan A。** 理由は、matching-app・shiritori2の両方が「score/correctは既にランタイム上で計算済み、永続化のみが欠けている」という同一パターンであり、T7-B（mogura-tataki＝直接統合／tokei-app＝新規schema設計）の2パターンを踏襲した低リスクな組み合わせであるため。Plan Bは容量に余裕があれば拡張候補、Plan Cは次々Phase（T7-G以降）でtyushiのような「score非中心設計」の実証機会として温存することを提案する。

---

## 14. 所要時間推定（Plan A: matching-app + shiritori2）

| アプリ | Inventory/adapter | UI | Viewer/CSV | Browser validation | Release | 合計目安 |
|---|---|---|---|---|---|---|
| matching-app | Small（1〜2h、既存score計算をFoundation APIへ接続） | Small（1〜2h、記録ボタン・モーダルを既存UI規約に沿って追加） | Small〜Medium（1〜3h、Viewer+CSV新規実装） | Medium（1〜2h、Validation Standard §21準拠） | Small（0.5〜1h） | **Medium（4〜8h）** |
| shiritori2 | Small（1〜2h） | Small（1〜2h） | Small〜Medium（1〜3h） | Medium（1〜2h） | Small（0.5〜1h） | **Medium（4〜8h）** |
| **Plan A合計** | | | | | | **約8〜16h（2 Phaseに分割する場合は各4〜8h）** |

実コード量（既存Foundation 4〜17本目の実績: 200〜900行規模の追加）を踏まえた見積もり。tokei-app（T7-B Pilot B、新規schema設計）の実績工数を参照値とした。

---

## 15. Supporter Dashboardとの整合（実装しない、schema確認のみ）

matching-app/shiritori2を含む今後の全Foundation拡張は、既存Core Schema `{timestamp, appId, activity, inputMethod, schemaVersion}` を継続使用する（§9で確認済みの通り、新規追加分もこの4フィールド+schemaVersionの最小主義を維持）。将来のSupporter Dashboard（T8相当）との統合を見据え、Priority A/B候補いずれも「app-specific payloadをフラットに追加する」既存方式を継続することを推奨する。**T7-EではDashboard実装・設計に進まない。**

---

## 16. Roadmap（次Phase）

- **T7-F**: Priority A 2〜3本（推奨: matching-app + shiritori2）Local RC実装
- **T7-G**: User Review / Production Release
- **T7-H以降**: Priority B（janken-app/register-app/cup_game）へのGroup展開
- Record coverageが十分になった段階で **T8: Supporter-useful Record Dashboard / Interpretation** へ移行

---

## 17. Production状態

本Phase中、`main`/`origin/main`ともに`9aa359e`のまま変更なし。アプリ実装ファイル・`generate.js`・changelogへの変更は一切行っていない。本文書のみを新規作成し、T7E用worktree（`for-all-children-to-learn-t7e-record-inventory`、branch `docs/record-coverage-inventory-t7e`）内でのみ変更している。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-30 | Phase T7-A。全35アプリの現Production実コード再Inventory（`01e8ebf`時点、Foundation 13本） |
| v2.0 | 2026-08-31 | Phase T7-E。Foundation 13→17本化後（`9aa359e`時点）の全35アプリ再Inventory。B/C区分が実質ゼロになったことを確認。badge過小表示（tokei-app/nazori-app）・bosai-app `name`フィールドPrivacy配慮欠落を新規発見。E/F区分を新設し、matching-app/shiritori2をT7-F Priority A候補として提案 |
