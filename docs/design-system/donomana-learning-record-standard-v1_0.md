# どのまな Learning Record Standard（Version 1.0）

- 版: v1.0 Draft / RC相当
- 発行: 2026年8月（Phase T5-B）
- 位置づけ: 「どのまな」全アプリの**学習・活動記録**（作成コンテンツの保存ではない）に関する共通設計標準。`donomana-storage-architecture-v2_0.md`（コンテンツ保存・バックアップ層）とは独立した文書群であり、両者は補完関係にある。
- 根拠調査: Phase T5-A（`docs/design-system/donomana-learning-record-foundation-audit-v1.md`を正本とする）
- PoC検証: Phase T5-B（Pilot 2本: miru-hirogaru-app・hiragana-learn）
- 承認状態: **Draft / RC。Pilot 2本のみ検証済み。全35アプリへの対応が完了しているわけではない。**

> 本文書はPilot 2本（miru-hirogaru-app・hiragana-learn）でPoC検証済みの内容と、残り33アプリへの展開はまだ行っていないという設計方針を明確に区別して記載する。本文書の発行だけを理由に、Pilot 2本以外のアプリの記録コードを変更してはならない。展開は必ず個別Phaseで行う。

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-foundation-audit-v1.md` | 本文書の事実的根拠（Phase T5-A監査 + T5-B Inventory Closure） |
| `donomana-storage-architecture-v2_0.md` | 独立（コンテンツ保存・バックアップ層。学習記録は扱わない） |
| `docs/multi-input/multi-input-program-design-v1.md` §11・§22 | 本Standardの実証的土台（M11/M12 Multi-Input Foundationの既存Records Philosophy） |
| `donomana-privacy-analytics-consistency-v1.md`（T4） | 本Standardのprivacy原則はT4の確立方針と矛盾しない |

---

## 1. Purpose

教員・支援者が、

- 「何に取り組んだか」
- 「どのように参加できたか」

を後から振り返れる最小限の共通記録層を提供する。**診断や能力推定を目的にしない。**

---

## 2. Educational Principle

観察可能な行動のみ記録する。

**OK**: 「5秒注視した」「スイッチで選択した」「3回取り組んだ」
**NG**: 「理解している」「集中力が低い」「能力が高い」等の診断的解釈

この原則は既にMulti-Input Foundation（`multi-input-program-design-v1.md` §11.1）で実証済みであり、本Standardはこれをリポジトリ横断の原則として格上げする。

---

## 3. Privacy

- 原則端末内保存（`localStorage`／将来的に`IndexedDB`）
- 外部無断送信なし
- 氏名必須にしない（既存のkyou-no-kirokuは氏名必須のUIを持つが、これは本Standard策定以前の既存実装であり、本Phaseでは変更しない。将来のLearner Identification検討時に是正を検討する）
- Analyticsと完全分離（GA4は`index.html`のみに存在し、35アプリ本体には埋め込まれていないことをT5-A/T5-Bで確認済み）
- learner profileは本Standardの必須要件にしない

Phase T5-BでPilot 2本に対しPlaywright実ブラウザで検証済み: `donomanaRecordAddLog`/`readLog`/`writeLog`/CSV出力/削除のいずれの操作でも、localhost以外への通信は発生しない（Google Fonts等ページロード時の静的アセット取得を除く）。詳細は本文書§21〜26参照。

**⚠️ Inventory Closure Gateで発見したPrivacy上の注意点（gaze-keyboard）**: Pilot対象ではないが、T5-Bの未精査14アプリ調査で`gaze-keyboard`が`gaze_history_<profileId>`に**利用者が実際に入力・確定した文章そのもの**を自動保存していることが判明した（詳細は`donomana-learning-record-foundation-audit-v1.md` Addendum参照）。これはAAC（拡大代替コミュニケーション）用途の性質上、行動観察記録（本Standard§2の対象）ではなく発話内容そのものであり、他の学習記録より機微度が高い。既存方針（端末内保存のみ・外部送信なし）には反していないが、本Standardの「観察可能な行動のみ記録する」という前提が単純には当てはまらない事例として記録する。本Phaseではコードを変更せず、個別のPrivacy評価が必要な事項としてT5-C以降へ持ち越す。

---

## 4. Badge Accuracy Reconciliation（📊「きろく機能あり」badge）

`apps-data.json`の`badges`フィールド「📊 きろく機能あり」と、Phase T5-A/T5-Bの実コード監査結果（全35アプリConfirmed Inventory、`donomana-learning-record-foundation-audit-v1.md` Addendum参照）を突き合わせた。**本Phaseではbadge表示を1件も修正しない。** 表示修正はPilot検証後の別Stepで行う。

### 4.1 badgeの意味を本Standardで定義する

現状のbadgeは「学習記録機能を持つ」ことを示すラベルとして運用されているが、**永続保存（Local persistent／分類C・D）を指すのか、セッション内Viewer（分類B）も含むのかが未定義**だった。本Standardでは以下のように定義する:

> 「📊 きろく機能あり」badgeは、**分類C・D（Local persistent、端末を閉じても記録が残る）のアプリにのみ表示する**。分類B（Session only、リロードで消える）は該当しないものとする。

理由: 教員・支援者がbadgeを見て「後日この端末で記録を振り返れる」と期待するのが自然な解釈であり、セッション限りで消える記録にbadgeを付けると誤解を招くため。

### 4.2 現状との差分一覧

| ケース | 該当アプリ | 差分の性質 |
|---|---|---|
| badge=true かつ 実装も C/D（整合） | hiragana-learn・katakana-app・suji-manabou・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii（9本） | 差分なし |
| **badge=true だが実装はB（session only）** | **bosai-app** | 4.1の定義に従えば badge過大表示。teacherは永続記録を期待しうるが実際はリロードで消える |
| **badge=false だが実装はC/D** | **directions-app・okane-app・kyou-no-kiroku・sst-app・mogura-tataki・gaze-keyboard（6本）** | badge過小表示。永続記録があるのに一覧上は「記録機能なし」に見える |
| badge=false かつ 実装もB | tokei-app | 4.1の定義上は badge=false が正しい（session onlyのため）。ただしセッション内CSV出力自体は存在するため、将来「一時記録あり」等の別ラベルを検討する余地がある |
| badge=false かつ 実装もA | 残り18本 | 差分なし |

### 4.3 本Phaseで行わないこと

- `apps-data.json`の`badges`配列の書き換え
- `node generate.js`の再生成
- 上記いずれのアプリの表示変更

これらはT5-C以降、Pilot拡張の検証結果を踏まえた上で、ユーザー承認を得て別Stepとして実施する。

---

## 5. Core Schema

```js
{
  timestamp,      // ISO 8601
  appId,          // apps-data.jsonの正式id
  activity,       // 教材が定義する活動種別
  inputMethod,    // "touch" | "gaze" | "switch" | "keyboard" | "mouse" | "click" | null
  schemaVersion   // 必須
}
```

### 4.1 各フィールドの定義

- **timestamp**: ISO 8601（`new Date().toISOString()`）。新規Foundation recordの標準。
- **appId**: `apps-data.json`の`id`フィールドと一致させる。
- **activity**: 教材が定義する活動種別文字列（例: `"trace"` `"quiz"` `"toy_activate"`）。値の語彙は本Standardでは規定せず、教材ごとに定義する。
- **inputMethod**: 単一入力教材は`null`許容。**推測による記録は禁止**（例:「タッチ端末だからtouch」という推測は行わない。判別できない場合は`null`）。
- **inputMethodのenum確定（T5-B実機検証で確定）**: 当初案は`"touch"|"gaze"|"switch"|"keyboard"|"mouse"|null`だったが、Phase T5-BでPilot Aの実コードをPlaywright実ブラウザで検証したところ、マウスクリックの実測値は`"mouse"`ではなく**`"click"`**であることが判明した（`miru-hirogaru-app.html`の`document.addEventListener('pointerdown', function(e){ currentInputMethod = (e.pointerType === 'touch') ? 'touch' : 'click'; })`という既存実装による）。この既存実装は本Phaseでは変更しない（Pilot Aの実データ形式を壊さないため）。したがって正式enumは実装実態に合わせ以下とする:
  - `"touch"` | `"gaze"` | `"switch"` | `"keyboard"` | `"click"` | `null`
  - `"click"`はマウス/ポインタ操作全般を指す既存の呼称であり、将来的に`"mouse"`へ正規化するかどうかはT5-C以降で改めて評価する（本Phaseでは既存コードの実データを尊重し、無理な即時統一を行わない）。
- **schemaVersion**: 必須。欠落 = legacy v1として扱う（§10参照）。

---

## 6. App-specific Payload

教材固有情報はpayloadとして分離する方向を将来的に検討する。

```js
{
  // core fields...
  payload: {
    level, target, selected, concept, result, score, responseTimeMs, dwellDuration, ...
  }
}
```

**ただし既存ログ互換性を壊すため、無理に全既存アプリを即座にnested payload形式へmigrationしない。** Standard上の理想schema（`donomanaRecordCreate()`が生成する形式、§9参照）と、legacy read compatibility（Pilot 2本の実データ形式）を分離して定義する:

- **理想形（新規アプリ・将来の共通Viewer向け）**: `donomanaRecordCreate(appId, activity, inputMethod, payload)`が生成するnested payload形式
- **実データ（Pilot 2本を含む既存アプリ）**: 各アプリが独自に定義するフラットなフィールド構成のまま。Foundation APIはこの実データ形式を変更しない

教材固有フィールド名（`target`/`selectedPosition`/`passenger`等）は教材の意味に応じて異なる名前を使ってよい（`multi-input-program-design-v1.md` §22.3の既存原則を継承）。

---

## 7. Result / Correctness Semantics

全教材に`correct=true/false`を強制しない。既存Multi-Input教材（miru-hirogaru-app等のPilot 3教材）にはsuccess-only設計が存在する一方、既存アプリへのRollout先（kurabeyou-app・katachi-awase-app・directions-app等）は`correct`/`mistakes`フィールドを持つ。

したがって、`result`/`correct`/`mistakes`等は教材の性質に応じたOptional/App-specific fieldとする。**「結果がない = 記録できない」という設計は禁止**（success-onlyの教材にも記録価値がある。「何に取り組んだか」「何回取り組んだか」自体が記録として意味を持つ）。

---

## 8. Storage Standard

Phase T5 v1では**`localStorage`を基本backend**とする。

理由:
- 既存Learning Record実装の大半（確認できた14本すべて）が使用
- 小規模追記ログに十分
- Offlineでも利用可能
- build依存なし（本リポジトリに`package.json`・ビルドパイプラインが存在しないため）

ただしFoundation APIは、将来IndexedDB backendへ変更可能な設計にする。storage keyを第一引数として受け取る設計（§9）により、将来`donomanaRecordReadLog`/`WriteLog`の内部実装をIndexedDBベースへ差し替えても呼び出し側のシグネチャは変更不要である。大容量recordや複数learner等ではIndexedDBを将来選択可能とする。

---

## 9. Record API（Shared Foundation 最小API）

Phase T5-BでPoC実装・単体テスト18件・Pilot 2本での実ブラウザ検証を完了した。

```js
donomanaRecordReadLog(storageKey)              // → array（存在しない/壊れている場合は[]）
donomanaRecordWriteLog(storageKey, log)        // → 例外を握りつぶす（Layer1を妨げない）
donomanaRecordAddLog(storageKey, entry)        // → readLog→push→writeLogの糖衣
donomanaRecordClearLog(storageKey)             // → 空配列で上書き（削除ではなく明示的な空配列）
donomanaRecordNormalizeLegacy(entry)           // → schemaVersion欠落を1として補完（既存フィールドは書き換えない）
donomanaRecordCreate(appId, activity, inputMethod, payload)  // → Core Schema形式のnew record生成（ISO timestamp・schemaVersion:1固定）
donomanaRecordBuildCsv(rows)                   // → UTF-8 BOM付きCSV文字列を組み立て（ダウンロードUI自体は各アプリに残す）
```

既存Multi-Input Foundation（miru-hirogaru-app等）の`readLog()`/`writeLog(log)`/`addLog(entry)`パターンをSource of Truthとして採用した。API名は`donomanaRecord`プレフィックスを付け、各アプリのローカル関数名（`readLog`等）との衝突を避けた設計とした。

APIは増やしすぎない方針を維持し、`createRecord()`は`donomanaRecordCreate`として、`normalizeLegacyRecord()`は`donomanaRecordNormalizeLegacy`として実装した以外、追加候補は本Phaseで採用しなかった。

---

## 10. Schema Versioning

新規recordには`schemaVersion`を必須化する。legacy record（`schemaVersion`欠落）は**legacy v1**として読み込み可能にする。

- 古いrecordを読み込むためだけに全データを一括書換えしない
- Missing fieldを許容するfallbackを基本とする
- `donomanaRecordNormalizeLegacy(entry)`は`schemaVersion`が`null`/`undefined`の場合のみ`1`を補完し、既存フィールドは一切変更しない（単体テストで確認済み: 既存`schemaVersion`がある場合は上書きしない）

---

## 11. Legacy Compatibility

既存recordを削除しない。特にPilot対象の`hiragana_log`を保持する。

PoC導入後、以下をPhase T5-Bで実機検証し満たしていることを確認した（§22参照）:
- 旧recordを閲覧できる（Viewer=`record`タブで legacy entry を含めて正しく表示、quiz score計算も legacy entry を含めて正常動作）
- CSV exportできる（既存`downloadCSV()`は無変更のまま動作）
- 重複recordを作らない（§14参照）
- timestamp旧形式（`ja-JP`ロケール文字列）でも読み込める（`donomanaRecordReadLog`は形式を問わずJSON配列として読み込むのみで、timestampの形式チェックを一切行わない）

「旧ログを全部消して新方式へ移行」は行っていない。

---

## 12. Pilot Selection

T5-B PoCは2本のみ。

**Pilot A: miru-hirogaru-app**
理由: 現行Multi-Input Foundation型の代表。新Standardが最新設計を壊さないか確認する。

**Pilot B: hiragana-learn**
理由: 旧世代Learning Record schema代表。legacy compatibilityを検証する。

directions-app・kyou-no-kirokuはT5-C Pilot expansion候補として保持する（§29参照）。

---

## 13. Shared Foundation Implementation Strategy

大規模module architecture変更は行っていない。本リポジトリには`package.json`・ビルドパイプラインが存在しないため、既存Gaze Shared Foundation（Phase M11.4-A/B）で実績のある**`generate.js`マーカー注入方式**を採用した。

### 12.1 実際に採用したマーカー命名

既存の命名規則（`<!-- gaze-shared-js: 自動挿入 (generate.js) -->` / `<!-- /gaze-shared-js -->`、`<!-- favicon: 自動挿入 (generate.js) -->` / `<!-- /favicon -->`）を踏襲し、**小文字ダッシュ区切り**で統一した（タスク提示例の`DONOMANA_LEARNING_RECORD_FOUNDATION_START`という大文字アンダースコア形式は、既存の実際の命名規則と異なるため不採用とした）:

```html
<!-- learning-record-foundation-js: 自動挿入 (generate.js) -->
<script>
  ... donomanaRecordReadLog / WriteLog / AddLog / ClearLog / NormalizeLegacy / Create / BuildCsv ...
</script>
<!-- /learning-record-foundation-js -->
```

対象アプリは`LEARNING_RECORD_FOUNDATION_APPS`（`generate.js`内、`Set(['miru-hirogaru-app', 'hiragana-learn'])`）に明示登録した場合のみ。全アプリ一括適用はしていない。

### 12.2 挿入アンカーの設計と実装中に発見した既存パターンの限界

既存Gaze Shared Foundationは「ファイル内最後の`<script>`タグの直前」をアンカーとしていた。これは「共通chrome scriptは全アプリでアプリ本体scriptより前に位置する」という前提に依存する。

**Phase T5-Bの実装検証で、この前提がM11/M12 Multi-Input教材以外では成立しないケースを発見した。** `hiragana-learn.html`はRECORDスクリプトブロックの直後に独立した「フルスクリーン共通」`<script>`ブロックが続く構成であり、「最後の`<script>`タグ」がRECORDブロックより後ろに来て、`donomanaRecordReadLog`等が未定義のまま呼ばれる（`ReferenceError`）バグを実装中に発見した。

**対策**: Learning Record Foundationのアンカーは、各Pilotアプリが実際に`donomanaRecord*()`を呼び出している最初の箇所を検索し、その箇所を含む`<script>`タグの直前へ挿入する方式に変更した（`html.indexOf('donomanaRecord')` → `html.lastIndexOf('<script>', usageIdx)`）。この方式は呼び出し箇所を含むスクリプトブロックの直前に必ず挿入されるため、Gaze Foundationの前提が崩れるケースでも正しく動作する。修正後、Pilot 2本とも実ブラウザで`console error = 0`を確認した（§26）。

**この発見はGaze Shared Foundation側の既存動作には影響しない**（Gaze Foundationは引き続き従来のアンカーロジックのまま、対象6アプリでは前提が成立しているため問題なし）。将来Gaze Foundationを他アプリへ拡張する際は、本Phaseで発見したこの限界を踏まえ、同様の検証を行うことを推奨する。

### 12.3 冪等性の確認

`node generate.js`を2回連続実行し、Pilot 2本のHTML出力がバイト単位で同一であることを確認した（差分なし）。既知の「a11yパネルマーカー直前に空白行が1行ずつ増える」副作用は、本Phaseの変更ファイル（`generate.js`・Pilot 2本）には発生しなかった（`git status --porcelain`で他アプリ・`index.html`への意図しない変更がないことを確認済み）。

---

## 14. No Duplicate Logging

PoCで最重要視した項目。Shared Foundation導入によって、既存`addLog()` + 新Foundation `addRecord()`が同一操作で二重記録しないことを設計・検証した。

**設計方針**: 新しい並行APIを追加するのではなく、**既存の`addLog()`/`readLog()`/`writeLog()`の内部実装をFoundation関数へ委譲する**方式を採用した。呼び出し側（アプリ本体コードの全呼び出し箇所）は一切変更していない。書き込み経路が常に1本のまま保たれるため、構造的に二重記録が発生し得ない。

**実機検証結果**（Playwright、§21〜22参照）:
- Pilot A: 1クリック（`.mh-toy`ボタン） → 記録エントリ+1件（`before_count + 1 == after_count`を確認）
- Pilot B: 1クイズ回答クリック → `legacy 1件 → 2件`（+1件）を確認

いずれも「1 user action → 1 intended record」を満たすことを実測で確認した。

---

## 15. inputMethod

- **miru-hirogaru-app**: 既存`inputMethod`を維持。実機検証で`"click"`という実測値を確認（§4.1参照、当初のenum案`"mouse"`から実装実態に合わせ訂正）。
- **hiragana-learn**: 実際に入力方式を正確に判定できないため、`inputMethod`フィールド自体を追加していない（無理な推測記録をしない、という要件を「フィールドを持たない」という形で満たした）。「タッチ端末だからtouch」等の推測記録は行っていない。

---

## 16. Timestamp Normalization

新規Foundation recordは**ISO 8601を標準とする**（`donomanaRecordCreate()`が生成するtimestampはISO 8601であることを単体テストで確認済み、§25）。

既存hiragana legacy recordの`ja-JP`ロケールtimestampは読み込み互換を維持する。既存過去データは書き換えていない。

**新規recordからISOへ移行可能かのPilot確認結果**: 技術的には`donomanaRecordCreate()`を経由すればISO 8601化は可能であることを確認した。しかし、**hiragana-learnの実データについては、本Phaseでは新規エントリの`time`フィールド形式を変更していない**（`addLog(type, data)`は引き続き`now()`が返す`ja-JP`表示用文字列を`time`へ格納する）。理由: Viewer・CSV出力が`entry.time`をそのまま表示用文字列として扱っており、ISO形式へ変更すると新規エントリの表示（例:「2026/8/29 14:14」→「2026-08-29T05:14:00.000Z」）が変わってしまい、「Viewer維持」「CSV維持」という本Phaseの必須要件と矛盾するため。ISO化は将来、Viewer/CSV側の表示ロジック改修とセットで行うことを推奨する（T5-D候補）。

---

## 17. Viewer Compatibility

T5-Bでは新しい共通Viewerを作っていない。既存PilotのViewerがFoundation導入後も正常に表示できることを優先した。

実機検証結果（§21〜22）: Pilot A・Bとも既存Viewer（`renderRecords()`／`record`タブ）がFoundation導入前と同じ内容を表示することを確認した。共通ViewerはT5-D予定のまま。

---

## 18. CSV Compatibility

T5-BではCSV UIを統一していない。Pilot既存CSV（`downloadRecordsCsv()`／`downloadCSV()`）はいずれも無変更のまま動作することを実機検証で確認した（§21〜22）。

将来の共通CSV Standardとして、**UTF-8 BOM付き**（`﻿`）を基本候補とする。`donomanaRecordBuildCsv(rows)`はこの方式で実装済み・単体テスト済み。CSV columnは教材固有payloadまで無理に統一しない。

---

## 19. Delete / Retention

利用者がLearning Recordを全削除できる導線を**REQUIRED候補**とする。Pilot 2本とも既存の削除機能（`writeLog([])`／`clearRecord()`）がFoundation導入後も正常動作することを実機検証で確認した。

Retention（件数上限・日数上限）はどちらかを全アプリへ一律強制しない。既存実績（`directions-app`の`MAX_LOGS`、`sst-app`の30日保持）を参考に、**RECOMMENDED**として整理する。

---

## 20. Accessibility

Learning Record Viewer / Export / Delete UIは将来Switch Scan対応を含むアクセシビリティ対象とする。ただしT5-Bでは共通Viewerを作らないため、**Foundation API自体にSwitch Scan処理を埋め込んでいない**（Foundation APIはlocalStorage I/Oのみを扱う純粋関数群であり、DOM/UIに一切関与しない設計）。UI StandardはT5-Dで扱う。

---

## 21〜26. Pilot PoC 検証結果

詳細は本文書とは別に、Phase T5-B Final Report（会話内報告）に実行ログを記録する。要点のみ記す。

### Pilot A: miru-hirogaru-app

Playwright（Chromium headless、実ブラウザ）で検証。
- Foundation関数7種すべて`typeof === 'function'`を確認
- 記録前0件 → `.mh-toy`クリック1回 → 1件（`schemaVersion:1`・`inputMethod:"click"`・`responseTime`・`dwellDuration`・`activationCount`を含む）
- reload後も1件のまま保持（永続化確認）
- `openSettings()`→`renderRecords()`でViewer正常表示（`recordsCsvBtn`/`recordsDeleteBtn`が非hidden化）
- `donomanaRecordBuildCsv()`でBOM付きCSV生成を確認
- 1レコードサイズ実測: **160 bytes**
- console error = 0、page error = 0

### Pilot B: hiragana-learn

- legacy record（`schemaVersion`なし、`ja-JP`形式timestamp）を事前投入 → reload後も**無変更のまま**読み込まれることを確認
- クイズ回答（実UIクリック）→ legacy 1件 → 2件（新規エントリのみ`schemaVersion:1`付与、legacy entryは不変）
- trace/match記録は、なぞり精度Engineへの干渉を避けるため`addLog('trace',{kana:'あ'})`/`addLog('match',{})`を直接呼び出す方式で検証（実際のcanvas描画ジェスチャーはシミュレートしていない。実UIクリックで検証したのはquizのみ）
- 全4件（legacy 1 + quiz 1 + trace 1 + match 1）でreload後も内容一致（永続化確認）
- Viewerタブ（`record`）で正常表示、`recQuizScore`が正しく計算される（50%）ことを確認
- 既存`downloadCSV()`をエラーなく実行できることを確認
- 1レコードサイズ実測: **95 bytes**（4件平均、69〜127 bytesの幅）
- `clearRecord()`で全削除（in-memory・localStorage双方で0件になることを確認）
- console error = 0、page error = 0

### Privacy Validation

Pilot 2本の記録操作（add/read/export/clear）中に発生したネットワークリクエストを記録した。localhost以外への通信は、ページロード時のGoogle Fonts（CSS/WOFF2、静的アセット）のみであり、記録データを含む外部送信・GAへの送信は確認されなかった。

### Performance / Storage（実測）

| アプリ | 平均record size | 1000件概算 |
|---|---|---|
| miru-hirogaru-app | 160 bytes | 約156 KB |
| hiragana-learn | 95 bytes | 約93 KB |

いずれも`localStorage`の一般的な上限（5〜10MB）に対して十分小さい。

### Automated Tests

Foundation API単体テスト18件（generate.jsから実際のコードを動的抽出して実行、ハンドコピーではない）: add / read（存在キー・欠落キー） / persistence（別セッション間の共有） / legacy read（schemaVersion欠落のまま読み込み） / schemaVersion missing fallback（新規補完・既存尊重の両方） / malformed data fallback（不正JSON・非配列） / QuotaExceededError時の非スロー / clear / duplicate prevention / CSV（BOM・カンマ/改行エスケープ） / createRecord（ISO8601・Core Schema形状・推測禁止のnull化）。**18件全てPASS**。

---

## 27〜28. スコープ外事項

- 共通Viewer UI・CSV統一・Switch Scan対応UI: T5-D予定
- 全35アプリへの横展開: 行っていない
- Production Release（main merge / push / deploy）: 行っていない

---

## 29. T5-C Proposal

T5-B結果を受け、Pilot expansionとして以下4本横断検証計画を提案する:

- miru-hirogaru-app（継続、Multi-Input Foundation代表）
- hiragana-learn（継続、旧世代schema代表）
- **directions-app**: Quiz型の独立schema代表。`MAX_LOGS`という既存のRetention実績を、Standard §19のRECOMMENDED Retentionへどう反映するか検証する好機
- **kyou-no-kiroku**: 唯一の複数learner対応実装。以下を個別評価する:
  - 複数learner構造（`children[]`）とCore Schemaの`appId`単位設計との整合
  - `name`必須の現状 vs 本Standard§3「氏名必須にしない」原則との乖離の是正方針（nickname設計）
  - Privacy（写真任意保存の扱い）
  - 既存`children`/`records`構造とFoundation APIの互換性（`records`配列がPilot 2本のようなフラットな活動ログ配列ではなく、`children`と紐付いた構造である点をどう吸収するか）

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft/RC | 2026-08-29 | Phase T5-B。Pilot 2本（miru-hirogaru-app・hiragana-learn）でPoC実装・単体テスト18件・実ブラウザ検証・Privacy検証・容量実測を完了。全35アプリ対応は未完了。 |
