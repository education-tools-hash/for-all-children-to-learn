# どのまな Learning Record Foundation 監査記録（Version 1.0）

- 版: v1.0
- 発行: 2026年8月（Phase T5-A実施・Phase T5-Bで正式文書化）
- 位置づけ: 本文書は **Audit evidence（調査証跡）** であり、正式な設計標準ではない。設計標準は別文書 `donomana-learning-record-standard-v1_0.md` に分離する。
- 根拠調査: Phase T5-A（全35アプリ横断の学習記録実態監査）
- baseline: `afe74e9`（Phase T4 final HEAD = Phase T5-A/T5-B開始時点のorigin/main）
- 文書化: Phase T5-B（セクション2）
- 追記: Phase T5-B「Inventory Closure Gate」（セクション3、末尾のAddendum参照）

> 本文書はPhase T5-A時点で**確認できた事実のみ**を記載する。未検証の事項は「未精査」「未確認」と明記し、確定事項として書かない。

---

## 0. 背景・スコープ

「どのまな」の全アプリについて、学習・活動の記録を適切に残せる共通基盤（Learning Record Foundation）を将来設計するにあたり、まず現行実装の実態を完全監査した（Phase T5-A）。対象は「作成コンテンツの保存」（予定表・マッチングセット・録音・お絵かき等のユーザー作品）ではなく、**学習・活動の記録**（いつ・何に取り組み・どのような活動/結果があったか）に限定する。

本Phaseでは実装・横展開は行わず、調査のみを実施した。Production コードへの変更は一切ない。

---

## 1. App Inventory（全数確定）

Production対象アプリは `apps-data.json`（35件）を正本とする。旧 `apps.json` は `CLAUDE.md` 記載の通りlegacyで生成に不使用。全35件の `filename`+`.html` が実在することを確認済み。

カテゴリ内訳: 学習アプリ15 / 認知支援8 / 自立活動9 / 創作表現3 = 35

> 過去メモリは「29アプリ」という前提を記録していたが、M11/M12 Multi-Input教材6本（みるとひろがる・みつけてタッチ・じゅんばんにみよう・くらべよう・かたちをあわせよう・どっちがいい？）の追加により**現在35本**。

`apps-data.json` の `badges` フィールドで「📊 きろく機能あり」を明示しているのは **10本**: hiragana-learn / katakana-app / suji-manabou / bosai-app / kurabeyou-app / katachi-awase-app / miru-hirogaru-app / mitsukete-touch-app / junban-miyou-app / dotchiga-ii。

孤立ファイル（`apps-data.json` に未登録、Production一覧に非表示）6件を確認: `app-register.html` / `cooking.html` / `meeting-notes-app.html` / `shisen.html` / `sugoroku-online.html` / `switch-training-app.html`。うち `switch-training-app.html` は `renderRecordLog()` という独自の記録機能を持つが、Production一覧に載らないため本監査のスコープ外として扱う（`donomana-storage-architecture-v2_0.md` §17.4で既に「孤立ファイル」として指摘済み、未回答のまま）。

---

## 2. Record / Storage Matrix（Phase T5-A時点）

概念上の重要な区別: **「学習・活動ログ」と「作成コンテンツの保存」は別物**。schedule-app（予定表）・matching-app（マッチングセット）・ongaku-app（録音）・drawing-app（お絵かき）・kimochi-board（ボード）・register-app（商品データ）等は `localStorage`/`IndexedDB` に**ユーザーが作った作品・設定**を保存しているが、これは `donomana-storage-architecture-v2_0.md`（Phase20系）が扱う「データ保護」の対象であり、学習記録とは別カテゴリとして扱う。

### 2.1 T5-A時点で確認済みのアプリ（21本）

| id | 分類 | storage key | inputMethod | CSV | Viewer | Delete | 検証度 |
|---|---|---|---|---|---|---|---|
| hiragana-learn | C+D | `hiragana_log` | ✗ | ✓ | ✓ | ✓ | 確認済 |
| katakana-app | C+D | `katakana_log` | ✗ | ✓ | ✓ | ✓ | 確認済 |
| suji-manabou | C+D | `suji_log` | ✗ | ✓ | ✓ | ✓ | 確認済 |
| kurabeyou-app | C+D（16列） | `STORAGE_LOG_KEY` | ✓ | ✓ | ✓ | 未確認 | 確認済 |
| katachi-awase-app | C+D（12列） | `STORAGE_LOG_KEY` | ✓ | ✓ | ✓ | 未確認 | 確認済 |
| miru-hirogaru-app | C+D | `STORAGE_LOG_KEY`（`miru_hirogaru_log`） | ✓ | ✓ | ✓ | ✓ | 確認済 |
| mitsukete-touch-app | C+D | `STORAGE_LOG_KEY` | ✓ | ✓ | ✓ | 未確認 | 確認済 |
| junban-miyou-app | C+D | `STORAGE_LOG_KEY` | ✓ | ✓ | ✓ | 未確認 | 確認済 |
| dotchiga-ii | C+D | `STORAGE_LOG_KEY`（+別用途IndexedDB: カスタム画像保存） | ✓ | ✓ | ✓ | 未確認 | 確認済 |
| directions-app | C（`MAX_LOGS`件数上限あり） | `appLogs` | ✗ | ✓ | ✓（filterLog） | 未確認 | 確認済 |
| okane-app | C | `okane_records`+`okane_activity_log` | ✗ | ✓ | ✓ | 未確認 | 部分確認 |
| kyou-no-kiroku | C（複数子ども対応、`children[]`+`records[]`） | `kyounokiroku` | ✗ | ✓ | ✓ | 未確認 | 確認済 |
| sst-app | C（30日自動整理）+独自diary/thermo機能 | `sst_activity_log_v1` 等 | ✗ | ✓ | ✓ | 部分確認 | 確認済 |
| mogura-tataki | C（badge非表示） | `mogura_v3` | ✗ | ✗ | 未確認 | 未確認 | 確認済 |
| bosai-app | **B（セッション内のみ）** | なし（a11y設定のみ永続） | ✗ | ✓ | ✓ | ✓（実質reloadで消失） | 確認済 |
| tokei-app | **B（セッション内のみ）** | なし | ✗ | ✓ | ✓ | — | 確認済 |
| janken-app | A（確認: a11y設定のみ） | — | ✗ | ✗ | ✗ | — | 確認済 |
| schedule-app | A（学習記録ではなくコンテンツ保存） | IndexedDB（schedule型） | ✗ | — | — | — | storage doc既知 |
| matching-app | A（学習記録ではなくコンテンツ保存） | IndexedDB（matching型） | ✗ | — | — | — | storage doc既知 |
| ongaku-app | A（学習記録ではなくコンテンツ保存。grepの`record`ヒットは"recording"の部分一致による偽陽性） | IndexedDB（ongaku型） | ✗ | — | — | ✓（confirm()欠落は既知issue） | 確認済 |
| time-timer | A（`tt_recordings`は音声アラーム録音機能。学習記録ではない。偽陽性確認済み） | — | ✗ | — | — | — | 確認済 |

### 2.2 T5-A時点で未精査だったアプリ（14本）

nazori-app / register-app / drawing-app / kimochi-board / sugoroku-app / timetable-app / yomikaki-app / scratch-app / slideshow-sakusei / gaze-keyboard / cup_game / tyushi / shiritori2 / nazorin-print

これらはgrepレベルで`localStorage`/`score`/`history`等のヒットはあったが、深掘り確認では設定値・単発ハイスコア・コンテンツ保存であることが多く（janken-appで実証済みのパターン）、活動ログ配列を持つ根拠はT5-A時点では確認できなかった。**断定を避け、T5-Bで個別確認する**こととした（末尾Addendum参照）。

---

## 3. Existing Schema Patterns（実コードから確認した既存スキーマ）

**① 旧世代パターン**（hiragana-learn / katakana-app / suji-manabou、ほぼ同一実装）
```js
{ time: "2026/8/29 14:30" /* toLocaleDateString(ja-JP)、ISO非準拠 */,
  type: "trace"|"quiz"|"match", data: {...} }
// key: "{app}_log"
```

**② Multi-Input Foundationパターン**（M11/M12、6アプリで`inputMethod`統一済み）
```js
{ time: new Date().toISOString(), level, target/selected/concept（教材依存）,
  inputMethod, responseTime/responseTimeMs, dwellDuration, ... }
// key: STORAGE_LOG_KEY定数、readLog()/writeLog()/addLog()の3関数で統一
```
`docs/multi-input/multi-input-program-design-v1.md` §11・§22.1に既に文書化済み。`date/level/inputMethod/responseTime/dwellDuration`の5フィールド共通化、CSV列7〜16列、`correct`/`mistake`はPilot 3教材ではsuccess-only原則により意図的に不採用（既存アプリへのRolloutでは採用=教材の性質次第）。

**③ Quiz型**（directions-app）: `{ ts(ISO), tsLocal, category, question, userAnswer, correctAnswer, result }`、`MAX_LOGS`件数上限で自動整理。

**④ Arcade型**（mogura-tataki）: `{ date(ja-JP), score, hits, ... }`、key名に`_v3`という非公式バージョンサフィックス。

**⑤ 複数learner対応**（kyou-no-kiroku）: `{ children: [{name, emoji, photo, bgColor}], records: [...] }` — 唯一「複数の子ども」を想定した構造。`addChild()`で`name`が必須（空だとalert）、`photo`は任意。

これら**最低5種類の相互非互換なad-hocスキーマ**が並存していることが、共通基盤の必要性を裏付ける最大の実証的根拠である。

---

## 4. Privacy Boundary

- ✅ 学習記録は例外なく`localStorage`/`IndexedDB`のみ、サーバー送信の実装はゼロ（T5-Aで確認）。
- ✅ GA4（`gtag`/`googletagmanager`）は`index.html`1ファイルにのみ存在し、35アプリ本体には一切埋め込まれていないことをT5-Aで確認済み（`grep -rlc "gtag|googletagmanager" *.html` → `index.html`のみ）。学習記録とAnalyticsは構造的に別系統。
- ⚠️ kyou-no-kirokuの「子どもの追加」で氏名が必須（ニックネーム前提のUIだが、外部送信なし）。
- ⚠️ sst-appの「きもち日記」: マイクボタン使用時のみ、文字起こしのためブラウザの音声認識サービス（Google/Apple等）へ音声データが送信される。アプリ内に明示的な開示文言あり、opt-in。

---

## 5. Current Gaps（Phase T5-A時点）

| 観点 | 現状 |
|---|---|
| Record | badge表示10本、実装確認できた活動ログは最低14本（未精査アプリに追加発見の可能性あり） |
| Persistence | 永続（C）11〜12本、セッション限定（B）2本（bosai-app・tokei-app）、判別不能14本 |
| Input Method | 6本のみ（M11/M12系列）、すべて`inputMethod`フィールド名で統一済み |
| Viewer | 個別実装で統一UIなし |
| Export | CSV（BOM付き`﻿`）が主流、9本以上で確認 |
| Delete | 個別実装。全削除確認済みは3本、残りは未確認 |
| Learner識別 | 全アプリ「プロファイルなし」が基本。kyou-no-kirokuのみ例外 |
| Schema統一 | ゼロ。5系統以上のad-hoc実装が並存 |
| Versioning | ゼロ（mogura-tatakiの`_v3`キー接尾辞という非公式手段のみ） |

---

## 6. Core Schema 提案（T5-A時点の暫定案、正式版は Standard v1.0 文書を参照）

```js
{
  timestamp: "ISO 8601",
  appId: "apps-data.jsonのid",
  activity: "教材が定義する活動種別",
  inputMethod: "touch"|"gaze"|"switch"|"keyboard"|null,
  schemaVersion: number
}
```
既存6アプリの`date/level/inputMethod/responseTime/dwellDuration`実績を土台にする。`level`等の教材固有情報はCore化せずApp-specific payloadに置く。

---

## 7. Pilot候補（T5-A時点の提案、T5-Bで2本に絞り込み確定）

| アプリ | タイプ | 選定理由 |
|---|---|---|
| miru-hirogaru-app | Multi-Input教材 | 5フィールド統一schemaの原型、実機Gaze検証済み |
| hiragana-learn | 問題回答型・なぞり | 最も長期運用されている旧世代schema、移行の実例として最重要 |
| directions-app | クイズ型 | badge非表示だが実質完成度の高い独立schema |
| kyou-no-kiroku | 自由記録・複数learner | 唯一の複数子ども対応実装 |

→ T5-Bでは **miru-hirogaru-app（Pilot A）・hiragana-learn（Pilot B）** の2本にPoC対象を確定した（Standard v1.0文書 §Pilot Selection参照）。directions-app・kyou-no-kirokuはT5-C拡張候補として保持する。

---

## 8. Shared Foundation戦略（T5-A時点の提案）

方式B（shared JS module）は本リポジトリの構造（`package.json`なし、ビルド工程なし）と不整合。既存の**generate.jsマーカーコメント注入方式**（Gaze Shared Foundationで実証済み）を推奨。詳細な実装方式はStandard v1.0文書 §Shared Foundation Implementation Strategyを参照。

---

## 9. Migration Strategy（T5-A時点の提案）

`donomana-storage-architecture-v2_0.md` §9の「Import保護標準」（競合なし/同一/競合の3分類、既存データを無確認上書きしない）を参考にする。既存ログは「暗黙のschemaVersion 1」として扱い、読み込み側でフィールド欠落を許容するfallbackを基本方針とする。詳細はStandard v1.0文書を参照。

---

## 10. T5 Roadmap（T5-A時点の提案）

- T5-B: Standard確定 + Shared Foundation PoC（Pilot 2本）← 本Phase
- T5-C: Pilot expansion（directions-app・kyou-no-kiroku）
- T5-D: 共通Viewer UI・CSV統一・Switch Scan対応
- T5-E以降: 残りアプリへの段階Rollout

---

## Addendum（Phase T5-B）: Inventory Closure Gate — 未精査14アプリの最終分類

T5-A完了時点で未精査だった14アプリについて、Phase T5-Bで個別確認を実施した（読み取り専用調査、コード変更なし）。Learning Recordの定義（本Standard §1「いつ・何に取り組み・どのような活動/結果があったかを、後から振り返るための記録」）に厳密に従い、「localStorageを使っている」だけでは記録ありと判定しなかった。

### 結論

14本中13本は **A（Learning Recordなし）**。localStorage/sessionStorageは使用しているが、内容は(a) 共通a11y設定（コントラスト/文字サイズ/読み上げ）、または(b) ユーザー作成コンテンツの保存（商品データ・ボード内容・盤面プリセット・テンプレートライブラリ）のみで、時系列に追記される活動ログ配列は存在しない。IndexedDB・cookieは14本とも未使用。

**唯一の例外: gaze-keyboard = D（Local persistent, Export可能＝印刷）。** `addHistoryEntry(txt)`が入力確定8秒後に自動保存し、`gaze_history_<profileId>`キーへ`{text, ts:Date.now(), chars, profile}`を追記（`hist.slice(-500)`で最大500件保持）。日付グループ化・削除確認・印刷ボタンを備えたViewer（`renderHistoryTab`）あり。CSVエクスポートはなく印刷のみ。プロファイル別（`currentProfileId`）に履歴が分かれる構造で、kyou-no-kirokuと同様「複数learner」を既に意識した設計。

**⚠️ 重要なPrivacy所見（新発見）**: gaze-keyboardの`text`フィールドには、利用者（視線入力でコミュニケーションする子ども）が実際に入力・確定した文章がそのまま保存される。AAC（拡大代替コミュニケーション）用途であるため、学習活動の記録という範囲を超えて、私的な会話内容・要望・感情表現等を含みうる。既存方針（端末内保存のみ、外部送信なし）には反していないが、他の学習記録（quiz結果・trace実施等）と比べて機微度が高いデータである。本Standardの「診断的解釈を保存しない」原則はそもそも該当しない（利用者自身の発話内容そのものであり、行動観察記録ではない）。Foundation側で一律に扱うべきではなく、個別のPrivacy評価が必要な事例として記録する。本Phaseではコードを変更しない。

### 詳細表

| id | 分類 | storage key | timestamp形式 | Viewer | Export | Delete | inputMethod | 実体 |
|---|---|---|---|---|---|---|---|---|
| nazori-app | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | 設定保存のみ、コンテンツ永続化すら未発見 |
| register-app | A | `register_settings`/`register_products`/`register_img_*` | — | ✗ | ✗ | ✗ | ✗ | 商品カタログ（content） |
| drawing-app | A | a11y設定のみ（+sessionStorageの`drw_*`は共有リンク用、タブ限り） | — | ✗ | ✗ | ✗ | ✗ | 作品の永続保存なし |
| kimochi-board | A | `kimochi_v2` | — | ✗ | ✗ | ✗ | ✗ | ボード内容（content） |
| sugoroku-app | A | `sugoroku_presets` | — | ✗ | ✗ | ✗ | ✗ | 盤面プリセット（content） |
| timetable-app | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | — |
| yomikaki-app | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | — |
| scratch-app | A | `scr_thresh`/`scr_rangeMode`+a11y | — | ✗ | ✗ | ✗ | ✗ | 描画しきい値設定 |
| slideshow-sakusei | A | sessionStorageの`a11y`のみ | — | ✗ | ✗ | ✗ | ✗ | セッション限定設定 |
| **gaze-keyboard** | **D** | `gaze_history_<profileId>` | `ts`（`Date.now()` epoch ms） | ✓（日付グループ化） | 印刷のみ（CSV無） | ✓（confirm付き全削除） | ✗ | **入力文章そのものを記録。要Privacy個別評価** |
| cup_game | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | — |
| tyushi | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | — |
| shiritori2 | A | a11y設定のみ | — | ✗ | ✗ | ✗ | ✗ | — |
| nazorin-print | A | `nazorin_library_v1` | — | ✗ | ✗ | ✗ | ✗ | テンプレートライブラリ（content） |

### 全35アプリ Confirmed Inventory（最終集計）

| 分類 | 該当数 | 内訳 |
|---|---|---|
| A（Learning Recordなし） | 18 | janken-app・schedule-app・matching-app・ongaku-app・time-timer + 上記13本 |
| B（Session only） | 2 | bosai-app・tokei-app |
| C（Local persistent、export無） | 1 | mogura-tataki |
| C+D（Local persistent、CSV export可） | 13 | hiragana-learn・katakana-app・suji-manabou・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii・directions-app・okane-app・kyou-no-kiroku・sst-app |
| D（Local persistent、export可＝印刷。CSV無） | 1 | gaze-keyboard |
| **合計** | **35** | |

何らかの学習記録機能を持つアプリ（B+C+C+D+D） = **17本 / 35本**。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-29 | Phase T5-A監査結果を正式文書化（Phase T5-B）。Addendumとして未精査14アプリのInventory Closure結果を追記 |
