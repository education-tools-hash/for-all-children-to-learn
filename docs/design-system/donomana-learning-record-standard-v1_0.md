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

## Addendum（Phase T5-C）: Pilot Validation — 4本目検証結果

Phase T5-Cで、Pilot 2本（miru-hirogaru-app・hiragana-learn、継続）に加え、directions-app・kyou-no-kirokuの2本を追加検証した。**directions-appはShared Foundationへ統合、kyou-no-kirokuは統合せず読み取り専用調査のみとした**（理由は§30.3参照）。本Phaseも全35アプリへの展開・Production Releaseは行っていない。

### 30.1 Pilot C: directions-app — Shared Foundation統合

既存`appLogs`スキーマ（`{ts, tsLocal, category, question, userAnswer, correctAnswer, result}`、`MAX_LOGS=500`件保持）はPilot Bと同型の「フラット活動ログ配列」であり、統合に適した構造だった。

**採用方式**: `loadLogs()`/`saveLogs()`の内部実装を`donomanaRecordReadLog`/`WriteLog('appLogs', ...)`へ委譲し、呼び出し側シグネチャ・entry形状・`MAX_LOGS`件数上限ロジック（Foundation呼び出しの前段でapp-specific concernとして維持）は一切変更しなかった。`addLog()`が生成する新規entryにのみ`schemaVersion: 1`を追加した（Pilot Bのhiragana-learnと同じパターン）。既存の`filterLog()`/`renderLogs()`（Viewer）・`exportLogCSV()`（CSV）・`clearAllLogs()`（全削除）はコード変更なしで動作を維持した。

- **inputMethod**: directions-appには`pointerdown`/`pointerType`等の入力方式判別コードが存在しないことをコード調査で確認した。Standard §5の「推測による記録は禁止」原則に従い、hiragana-learn（Pilot B）と同じ判断で**フィールド自体を追加しなかった**。
- **マーカー注入アンカー**: T5-Bで確立した「最初の`donomanaRecord`使用箇所を含む`<script>`タグの直前」方式（`generate.js`の既存ロジックをそのまま利用、変更なし）で正しく注入されることを確認した。`LEARNING_RECORD_FOUNDATION_APPS`へ`'directions-app'`を追加しただけで、注入ロジック自体への変更は不要だった。
- **冪等性**: `node generate.js`を2回連続実行し、2回目で追加差分が発生しないことを確認した。`sitemap.xml`の`lastmod`更新はworktree作成によるファイルmtime変化に由来する既知の副作用であり、T5-Cの意図した変更ではないが、実際に該当ファイルが変更された事実（T5-B'''コミット・T5-C本コミット）と整合するため許容した。
- **重複記録なし**: legacy 1件を事前投入→実UIの回答操作を模した`addLog()`呼び出し1回→2件（+1件）をPlaywright実ブラウザで確認した。
- **既存データ保持**: legacy entry（`schemaVersion`欠落）はreload後も無変更のまま読み込まれることを確認した。
- **1レコードサイズ実測**: 202 bytes（新規entry、`schemaVersion`込み）。1000件概算 約197KB。

### 30.2 Pilot D: kyou-no-kiroku — 読み取り専用調査（コード変更なし）

**結論: 本Phaseでは Shared Foundation を統合しなかった。** `kyou-no-kiroku.html`への変更は一切行っていない。理由は以下の構造的非互換性による。

#### 30.2.1 Storage Shape非互換性（Learner Architecture Boundary）

`donomanaRecordReadLog`/`WriteLog(storageKey, log)`は「storageKeyの値そのものがJSON配列である」ことを前提とする設計である。しかし`kyounokiroku`キーの値は

```js
{ children: [...], records: [...], kimochiOptions: [...], a11y: {...} }
```

という**複合オブジェクト**であり、`records`配列単体がキーの値ではない。実際に検証したところ（自動テスト参照）、`donomanaRecordReadLog('kyounokiroku')`はこの複合オブジェクトをそのまま返す（配列ではない）ため、そのまま`donomanaRecordAddLog`等の配列操作系APIへ渡すと意図通りに動作しない。さらに`donomanaRecordWriteLog('kyounokiroku', records)`を誤って呼び出すと、**`children`/`kimochiOptions`/`a11y`を配列で上書きし破壊する**ことを自動テストで実証した（`test_foundation_4pilot.js`の`kyouBoundary`ケース）。

これを解消するには (a) `records`を独立したstorage keyへ分離するmigration、または (b) Foundationへ「オブジェクト内の特定配列フィールドを読み書きする」新しいAPI（例: `donomanaRecordReadNestedLog(storageKey, arrayField)`）を追加する、のいずれかが必要になる。**どちらもT5-Cの明示的な制約（「無理にflat Learning Recordへ変換しない」「共通Learner Profile基盤を作らない」）に抵触するため、本Phaseでは実施しない。** T5-D以降の設計候補として保持する（§30.5参照）。

#### 30.2.2 Learner Structure

`records[]`の各要素は`childIndex`（`state.children`配列内のインデックス）と`childName`（保存時点の名前文字列コピー）の両方で子どもを参照する。コード調査（`deleteChild(i)`、`kyou-no-kiroku.html:2006-2011`）の結果、**子ども削除時に`records[]`の`childIndex`を再採番・削除する処理が存在しないことを確認した**。これは以下の実データ整合性問題を生む（既存実装の挙動であり、T5-Cで新規に発生させたものではない。修正はスコープ外として報告のみ行う）:

- 子どもA（index 0）・子どもB（index 1）がいて、Bのrecordが複数ある状態でAを削除すると、`state.children`は`[B]`（index 0）に詰まるが、`state.records`のBのrecordは`childIndex: 1`のまま残り、**削除後は存在しないindex 1を参照する不整合recordになる**（`recordFilterChild`によるフィルタが機能しなくなる等の実害がありうる）。`childName`文字列は保存時点のコピーのため表示上の実害は限定的だが、`childIndex`ベースの機能（フィルタ）は影響を受ける。

Standard Core Schemaは「learner reference」という概念自体を持たない（`appId`/`activity`/`inputMethod`/`timestamp`/`schemaVersion`のみ）ため、この構造をCoreへ格上げしない、という既存方針を維持した。

#### 30.2.3 Name Required Issue（§13対応）

`addChild()`（`kyou-no-kiroku.html:2065-2068`）を確認した結果:

```js
const name = document.getElementById('newChildName').value.trim();
if (!name) { alert('なまえをいれてください'); return; }
```

入力欄のplaceholder（`kyou-no-kiroku.html:1687`）は`"なまえ（例：たろうさん）"`であり、コード上「本名（法的氏名）」を強制する仕組みはない（自由入力文字列で、フォーマット検証もない）。ただし、ラベル文言「なまえ」自体は保護者・支援者に「本名を入力すべき」という印象を与えうる曖昧さが残る。

**改善候補（本Phaseでは未実装、設計候補として提示）**: placeholderを`"よびな（例：たろうさん、ニックネームでもOK）"`へ変更する、または入力欄の下に「本名でなくてもだいじょうぶです」という補助テキストを追加する。**T5-Cでは大規模Learner Profile redesignを行わない方針のため、この文言変更はUser承認を得た上でT5-D以降の別Stepとして実施することを推奨する。**

#### 30.2.4 Privacy

- `state.children[].photo`はbase64 data URI形式でlocalStorageへ直接保存されることをコード調査で確認した（`loadChildPhoto()`等）。外部アップロード・外部送信のコードは存在しない（`fetch`/`XMLHttpRequest`/外部`img src`をgrepしたが本アプリ内に該当なし）。
- `saveState()`は`localStorage.setItem('kyounokiroku', ...)`のみで、送信先はlocalhost外に存在しない。
- 削除: `confirmDeleteRecord()`（record単位削除）・`executeClearData()`（全record削除、`children`は保持）を確認した。`children`単体の削除は`deleteChild()`で可能。「子どもを削除すると紐づくrecordも消える」という統合削除機能は存在しない（§30.2.2の不整合と表裏一体の欠落）。

### 30.3 なぜdirectionsは統合し、kyou-no-kirokuは統合しなかったか（設計判断の要約）

| 観点 | directions-app | kyou-no-kiroku |
|---|---|---|
| Storage shape | フラット配列（`appLogs`） | 複合オブジェクト（`{children,records,...}`） |
| Foundation API適合 | 適合（Pilot Bと同型） | 不適合（配列前提のAPIと衝突） |
| 統合に必要な変更 | 内部実装の委譲のみ | Storage migration or 新API追加が必要 |
| T5-Cでの判断 | **統合した** | **統合しなかった（読み取り専用調査のみ）** |

この判断は「既存writerをFoundationへ委譲する設計を優先する」という指示と、「無理にflat Learning Recordへ変換しない」「共通Learner Profile基盤を作らない」という指示が、kyou-no-kirokuについては両立不可能であったため、後者（無理に変換・redesignしない）を優先した結果である。

### 30.4 gaze-keyboard分類（read-only audit、コード変更なし）

T5-Bで発見した`gaze_history_<profileId>`（発話内容そのものの自動保存）について、**A. Learning Record / B. Communication History / C. User Content**のいずれに分類すべきか評価した。

**分類結果: B. Communication History**

理由:
- 記録の性質が「観察可能な活動記録」（Standard §2のOK例: 「5秒注視した」「3回取り組んだ」）ではなく、**利用者が実際に入力・確定した発話内容そのもの**である点でLearning Record（A）と本質的に異なる。
- 明示的な「保存する」操作を利用者が行うわけではなく、8秒の入力停止で自動保存される点、また複数learner対応（`profile`単位）である点は、AAC（拡大代替コミュニケーション）用途における会話ログとしての性質を持つ。
- 一方で、意図的に作成・保存する「作品」（お絵かき・予定表等のUser Content=C）とも異なり、対話の履歴という性質が強い。

**追加調査（本Phaseで新規発見）**:
- `updateUsageStats(txt)`（`gaze-keyboard.html:4075-4087`）は発話内容から単語頻度（`wordFreq`）・文字数（`dailyChars`）を`gaze_stats_<profileId>`キーへ集計保存している。個々の発話内容ほど機微ではないが、語彙使用の統計的指紋であり、これもCommunication History寄りの性質を持つ付随データとして分類に含める。
- **プロファイル削除時のorphaned data**: `openProfileModal()`内のプロファイル削除処理（`gaze-keyboard.html:3999-4001`、`profiles = profiles.filter(...); saveProfiles(profiles);`）は、対応する`gaze_history_<profileId>`・`gaze_stats_<profileId>`キーを削除しないことを確認した。プロファイル削除後もlocalStorage内に発話履歴が孤立データとして残存し、UIからは（プロファイルチップが消えるため）到達不能になる。外部送信はないためPrivacy原則には反しないが、「利用者が削除したつもりのデータが端末に残る」という利用者の期待との乖離であり、修正候補としてT5-D以降へ持ち越す。**本Phaseではコードを変更しない。**
- 外部送信: `fetch`/`XMLHttpRequest`/`navigator.sendBeacon`/`gtag`等を`gaze-keyboard.html`全体でgrepし、該当なしを確認した（既存T5-A/T5-B所見の再確認）。

**本Standardへの統合方針**: 通常のLearning Record（Core Schema）へは統合しない。会話内容そのものを扱う性質上、独自のCommunication History Standard（Privacy要件がより厳格なもの）を将来別途策定することを推奨する。本Phaseではこの推奨のみ行い、実装は行わない。

### 30.5 T5-D Proposal（更新）

T5-Cの結果を踏まえ、T5-D「共通Record Viewer / CSV / Delete / Accessibility Standard」の検討範囲へ以下を追加する:

- **共通Viewer/CSV/Delete/Accessibility**（既存提案どおり）: Switch Scan・keyboard操作・screen reader対応・record一覧の日付グループ化・app横断フィルタ・CSV統一・全削除導線の標準化。
- **kyou-no-kiroku統合の設計候補**: (a) `records`を独立storage keyへ分離するmigration方式、または (b) Foundationに「オブジェクト内配列フィールド」を読み書きする新API（`donomanaRecordReadNestedLog`/`WriteNestedLog`相当）を追加する方式、のいずれかを比較検討する。
- **kyou-no-kiroku Learner整合性修正**: 子ども削除時の`records[].childIndex`不整合の解消（cascade更新 or 削除、またはchildIndexではなく安定IDでの参照への変更）。
- **kyou-no-kiroku名前ラベル文言候補**: 「なまえ」→「よびな」等への変更、User承認を得た上で実施。
- **gaze-keyboardプロファイル削除時のorphaned data解消**: プロファイル削除時に対応する`gaze_history_*`/`gaze_stats_*`キーも削除する（User承認を得た上で実施）。
- **Communication History Standard（新規）**: gaze-keyboardのような「発話内容そのものを保存する」教材向けの、Learning Record Standardより厳格なPrivacy要件を持つ別Standardの策定要否を検討する。

### 30.6 Automated Tests（4-Pilot拡張）

T5-BのFoundation単体テスト18件に加え、T5-Cでdirections-app固有シナリオ（legacy読み込み・追加・`MAX_LOGS`とFoundation書き込みの相互作用・削除・不正データfallback・存在しないkey）と、kyou-no-kiroku境界実証（複合オブジェクトキーへの誤適用が`children`/`kimochiOptions`/`a11y`を破壊することを実証するテスト）を追加し、**13件全てPASS**した（`generate.js`から`buildLearningRecordFoundationJSHTML()`を実コードとして動的抽出して実行、ハンドコピーではない）。Pilot A/Bの既存動作が無変更であることも同テストで再確認した。

### 30.7 Real Browser（4-Pilot）

Playwrightで4 Pilot（miru-hirogaru-app・hiragana-learn・directions-app・kyou-no-kiroku）を検証した。

- directions-app: Foundation関数6種`typeof === 'function'`、legacy 1件→addLog後2件（重複なし）、reload後も2件保持、Viewer（`renderLogs()`）が2行描画、`MAX_LOGS`（500件）超過時の切り詰めがFoundation書き込み経由でも機能、`clearAllLogs()`で0件化。
- kyou-no-kiroku: `donomanaRecordReadLog`等のFoundation関数が**注入されていないこと**（`typeof === 'undefined'`）を確認し、意図通りコード変更なしであることを実証した。既存`loadState`/`saveState`/`addChild`/`saveRecord`は無変更のまま関数として存在することを確認した。
- hiragana-learn: T5-B'''のTracing Judgment Level回帰確認（`currentTracingLevel === 'standard'`、Foundation関数存在）を実施し、T5-Cが一切影響していないことを確認した。
- miru-hirogaru-app: Foundation関数存在を再確認した。
- 4 Pilotとも console error = 0、page error = 0。

### 30.8 記録サイズ実測（追加）

| アプリ | 平均record size（実測） | 1000件概算 |
|---|---|---|
| directions-app | 202 bytes | 約197 KB |
| kyou-no-kiroku | 447 bytes（photoなし想定） | 約437 KB（photoを保存する子どもがいる場合、base64 photoデータが個々のchildエントリに数十〜数百KB加算されうる点に注意。records自体のサイズとは別軸） |

---

## Addendum（Phase T5-C'）: Composite Storage Adapter / Learner Record Integrity

Phase T5-C'で、T5-Cが「Storage Shape非互換性のため統合しない」と結論したkyou-no-kirokuについて、Composite Storageを安全に扱う境界設計（Composite Storage Adapter）を完成させ、**正式な4本目Pilotとして統合した**。同時に、T5-Aから存在していた未修正の`childIndex`データ整合性問題（学習者削除後のrecord誤帰属リスク）を発見・修正した。

### 31.1 Exact Composite Schema（実装から確定）

storage key: `kyounokiroku`（単一）。値は以下の複合object（`kyou-no-kiroku.html:1872-1893`が正本）:

```js
{
  children: [ { name, emoji, photo, bgColor } ],   // T5-C'でidを追加(後述)
  records:  [ { id, childIndex, childName, date, kimochi, temp, pulse, spo2,
                condition, medication, toilet, water, waterTime, seizure,
                seizureTime, seizureDuration, seizureTypes, seizureNote, memo } ],
                // T5-C'でchildId・schemaVersionを新規recordへ追加(後述)
  kimochiOptions: [ { emoji, label, color, image? } ],  // デフォルト6件
  a11y: { hc, tts, scan, scanSpeed, gaze, fontsize?, gazeDwell?, gazeSize?, gazeColor? },
}
```

- **load path**: `loadState()`（`kyou-no-kiroku.html:1907-1921`）。`state.selectedChild`/`selectedKimochi`/`selectedCondition`はメモリ内のみで**永続化されない**（`saveState()`の書き込み対象に含まれない）。
- **save path（T5-C'変更後）**: `children`/`kimochiOptions`/`a11y`は既存の`saveState()`（4フィールドを毎回まとめて書く）のまま。`records`のみ新設のComposite Storage Adapter経由（後述）。
- **clear/delete path**: `executeClearData()`（records全削除、childrenは保持）／`confirmDeleteRecord()`（record 1件削除）／`deleteChild(i)`（child 1件削除、対応recordは削除しない＝現状維持）。
- **property defaults**: `kimochiOptions`未存在時は初期6件配列にフォールバック。`a11y`は`{...デフォルト, ...loaded.a11y}`でマージ（欠落キーのみデフォルト維持）。`children`/`records`は`|| []`。

### 31.2 Destructive Reproduction（T5-Cの実証を再確認）

T5-Cで実証した「array-based Foundation API（`donomanaRecordReadLog`/`WriteLog`）を`kyounokiroku`キーへ直接使うと`children`/`kimochiOptions`/`a11y`が破壊される」現象を、T5-C'でも独立したRegression Testとして再実装・再確認した（`destructiveRegressionGuard`テストケース、36件中の1件）。**今後この方式へ戻らないことを保証するテストとして永続的に保持する。**

### 31.3 Adapter方式比較・採用方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| A. Generic collection adapter interface | `donomanaRecordReadNestedCollection(storageKey, field)` / `WriteNestedCollection(storageKey, field, collection)`。fieldを引数化し、複合object内の指定fieldだけを読み書きする汎用primitive | **採用**。他の複合storage構造を持つ将来アプリにも再利用可能。Foundationをkyou-no-kiroku専用仕様で汚染しない |
| B. kyou-no-kiroku app-level adapter | kyou-no-kiroku.html内だけに閉じたローカル関数として実装 | 不採用。再利用性がなく、他アプリが同じ問題に直面した際にコードが重複する |
| C. Shared nested-property helper | Aと実質同一の設計（多階層path対応等の拡張は行わない） | Aとして採用（「将来使うかもしれない」複雑な汎用化はせず、今回必要な単純な1階層field指定のみ実装） |

採用方式Aを`generate.js`の`buildLearningRecordFoundationJSHTML()`へ追加し、既存4関数（`donomanaRecordReadLog`等）と並ぶ形でFoundationスクリプトブロックへ含めた。既存の`LEARNING_RECORD_FOUNDATION_APPS`登録済み3アプリ（miru-hirogaru-app・hiragana-learn・directions-app）にも、ブロック更新により新規2関数が自動的に伝播した（純粋な追加のみで、既存4関数・既存app固有コードには一切変更なし。差分は`git diff`で確認済み）。

### 31.4 Foundation API変更

新規2関数を追加（既存7関数は無変更）:

```js
donomanaRecordReadNestedCollection(storageKey, field)              // → array
donomanaRecordWriteNestedCollection(storageKey, field, collection) // → void
```

いずれも複合object全体を読み込み、指定fieldのみを更新して書き戻す。**既知・未知を問わずfield以外のpropertyを完全に保持する**（field以外のpropertyを列挙・再構築しないため、Foundationが関知しない将来のproperty追加にも安全）。

### 31.5 採用したkyou-no-kiroku側統合

`records`フィールドの読み書きのみをComposite Storage Adapterへ委譲した。`children`/`kimochiOptions`/`a11y`は既存`saveState()`のまま変更していない（学習者プロファイル・設定はLearning Record Standardの対象外という既存方針を維持）。

- `loadState()`: `state.records = donomanaRecordReadNestedCollection('kyounokiroku', 'records')`
- `saveRecord()`/`saveEditRecord()`/`confirmDeleteRecord()`/`executeClearData()`: `donomanaRecordWriteNestedCollection('kyounokiroku', 'records', state.records)`へ統一（従来の`saveState()`呼び出しを置き換え）
- 新規recordに`schemaVersion: 1`を追加（Pilot B/Cと同じ既存パターン）
- `inputMethod`: kyou-no-kirokuにも入力方式判別コードは存在しないため、追加していない（推測禁止の既存方針を維持）

### 31.6 Critical Learner Integrity Audit — 正確な再現テスト

T5-Cで発見した「child削除後の`childIndex`参照不整合」について、A/B/C 3 learnerでの正確な再現テストを自動テスト（`abcDeletionRepro`）と実ブラウザテストの両方で構築した。

**再現手順**: A(index0)/B(index1)/C(index2)を作成、各々に1件ずつrecordを保存 → **Bを削除** → `state.children`は`[A, C]`（Cがindex1へ繰り上がる）。

**旧ロジック（`childIndex`ベースのfilter）で起きていたこと**: 記録一覧画面で「Cで絞り込み」を選択すると、UIはCの新しいindex値（1）を送信する。旧filterは`r.childIndex === filterChild`で照合していたため、**Bのrecord（`childIndex: 1`のまま）がCのfilterに一致してしまう**ことを自動テストで実証した（`OLD_recordsForNewIndex1`ケース）。表示名自体は`r.childName`スナップショット（"B"のまま）を使うため画面上「Bの記録」と表示され続けるが、**「Cで絞り込む」という操作をした保護者・支援者に対し、実際にはBの記録がCの記録一覧に混入して見える**という実害があった。

**新ロジック（`childId`ベースのfilter）での結果**: 同じ再現手順を実行した結果、Cでの絞り込みは**Cのrecordのみ**（1件）を返し、Bのrecordは混入しないことを自動テスト・実ブラウザテスト双方で確認した。Aの絞り込みも同様にAのrecordのみを返す。「全員」表示では3件全てが表示され、Bのrecordも引き続き「B」という正しい名前で表示される（displayは元々`childName`スナップショットを使っており、この点はbefore/afterで変化なし）。

### 31.7 Learner Reference Strategy — 採否

| 選択肢 | 内容 | 判断 |
|---|---|---|
| A. child削除時に全record childIndexを再計算 | 削除の都度、後続indexを持つ全recordの`childIndex`をシフトする | 不採用。すでに保存された全recordを毎回書き換える必要があり、リスクが高い上、shift演算自体にバグの余地がある |
| **B. stable childIdを導入** | childへ不変の`id`、recordへ`childId`参照を追加。indexに依存しない | **採用**。既存`childIndex`は削除せず併存させ、legacy互換を確保した |
| C. その他 | (検討したが具体案なし) | — |

**stable ID採否: 採用した。** `genId(prefix)`（`kyou-no-kiroku.html`新設）で`prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8)`形式のid文字列を生成する。新規child作成時（`addChild()`）に付与し、child編集時は既存idを保持する。

### 31.8 Migration — 既存データの後方互換的な移行

`migrateLearnerReferences()`（`loadState()`から毎回呼ばれる、idempotent）が以下を行う:

1. `id`を持たないchildへ`genId('child')`で新規id付与（初回ロード時のみ、以後は保持）。
2. `childId`を持たないrecordについて、`childIndex`が現在の`children`配列の範囲内であり、かつ**`children[childIndex].name === record.childName`（保存時点のスナップショットと現在名が一致）の場合のみ**、そのchildの`id`を`childId`として付与する。
3. 変更があった場合のみ`saveState()`（children）と`donomanaRecordWriteNestedCollection`（records）で永続化する（無変更時は書き込まない＝不要な保存回数増加を避ける）。

既存の`childIndex`フィールドは一切削除・上書きしていない（legacy compatibility）。

### 31.9 Ambiguous Migration STOP Gate

T5-C'で最も重要な安全設計判断: **「`childIndex`が範囲内だが、`childName`スナップショットと現在その位置にいるchildの名前が一致しない」レコードは、どのchildへ属するか一意に判断できないと扱い、`childId`を推測で割り当てない。**

これは「本Phase以前に既にdeleteChild()による混入バグの影響を受けた既存ユーザーデータ」を想定した設計である。範囲内だから安全というわけではなく、範囲内でも名前が食い違っていれば「過去のバグで別のchildを指すようになった痕跡」である可能性があり、その場合は現在その位置にいるchildへ誤って紐付けるのではなく、**`childId`を空のまま保持する**（自動テスト`ambiguousMigrationStopGate`で実証）。この結果、該当recordは「全員」表示では引き続き閲覧できるが、特定の子どもによる絞り込みでは表示されなくなる（＝安全側に倒す）。

**限界の明記**: 本Phase以前に実際にProduction環境で`childIndex`ずれが発生していた場合、そのデータが「範囲内かつ名前一致」（=偶然にも移行時点で正しく見える）なのか「範囲内かつ名前一致だが実は既に別の観測できない経緯で誤って一致している」のかを、保存済みデータのみから完全に区別することは原理的に不可能である。今回の移行ロジックは「名前スナップショットとの突合」という利用可能な最善の手がかりを使っているが、100%の正しさを保証するものではない。この限界はUser Reviewへ明示的に報告する。

### 31.10 Delete Semantics — 現状維持

`deleteChild(i)`の削除時挙動（現状B: recordsは削除せず残す）を、本Phaseでは変更していない。stable ID化により「誤って別learnerへ記録が移ることは絶対に許容しない」という制約は満たされたため、削除時にrecordsも合わせて削除するか(A)、残すか(B)、ユーザーに選ばせるか(C)というUX方針の決定自体は、明示的な承認なしに本Phaseでは行わない。

### 31.11 Name / Privacy Label（未実装、変更なし）

T5-Cで提示した「なまえ」→「よびな」等の表示文言変更候補は、本Phaseの主目的（Storage/Data Integrity）と直接関係しないため実装していない。引き続きT5-D以降、User承認を得た上での検討候補とする。

### 31.12 Personal Data Boundary

Composite Storage Adapter導入によって新規の外部通信は一切発生しない（`donomanaRecordReadNestedCollection`/`WriteNestedCollection`は`localStorage`のみを扱う純粋関数）。`fetch`/`XMLHttpRequest`/GA送信のいずれも本Phaseの変更コードに含まれないことをコードレビューで確認した。

### 31.13 Foundation Integration 要件チェック

| 要件 | 結果 |
|---|---|
| existing data preserved | ✓ 自動テスト`preservationGuarantee`・`unknownPropertyPreservation`・実ブラウザで確認 |
| new record preserved | ✓ |
| schemaVersion compatibility | ✓ 新規recordのみ`schemaVersion:1`付与、legacy recordは無変更 |
| duplicateなし | ✓ 実ブラウザで3件記録→3件のまま(重複なし)を確認 |
| reload persistence | ✓ |
| Viewer維持 | ✓ `renderRecords()`は既存の表示ロジックのまま、filter方式のみid化 |
| export維持 | ✓ `exportCSV()`は無変更。実ブラウザでCSVダウンロードが例外なくトリガーされることを確認 |
| delete behavior integrity | ✓ 誤帰属なしを実証（§31.6） |

### 31.14 Record Size / Photo Separation

T5-Cの実測（record 約447 bytes、photoは数十〜数百KB）を踏襲し、本Phaseでも両者を区別して評価した。photoは`children[].photo`（base64 data URI）であり、Learning Record（`records[]`）のサイズとは別物として扱う。Composite Storage Adapterはrecordsフィールドのみを操作するため、photoの読み書き経路には一切関与しない。

### 31.15 Automated Tests（20項目チェックリスト）

Node.js harness（`generate.js`から`buildLearningRecordFoundationJSHTML()`を、`kyou-no-kiroku.html`から`genId`/`migrateLearnerReferences`を実コードとして動的抽出、ハンドコピーではない）で **36件全てPASS**。

1. composite read ✓ 2. record add ✓ 3. record write ✓ 4. reload ✓ 5. children preserved ✓ 6. options preserved ✓ 7. a11y preserved ✓ 8. photo preserved ✓ 9. unknown property preserved ✓ 10. legacy schema（6種のfixture: 0 child/1 child/複数child/photoあり/option変更済み/schemaVersionなし） ✓ 11. malformed data fallback（不正JSON・非object・非配列） ✓ 12. duplicate prevention ✓ 13. learner deletion ✓ 14. learner reference integrity（A/B/C再現） ✓ 15. multiple learners ✓ 16. export compatibility（実ブラウザ側で確認） ✓ 17. clear behavior ✓ + Ambiguous Migration STOP Gate 2件 + Destructive Regression Guard 2件。

### 31.16 3 Pilot Regression / Tracing Regression

miru-hirogaru-app・hiragana-learn・directions-appを実ブラウザで再確認した。Foundation関数（新規2関数含む）は正しく存在し、既存機能（directions-appのlegacy読み込み・追加・MAX_LOGS・削除、hiragana-learnの`currentTracingLevel === 'standard'`）に回帰がないことを確認した。`tools/tracing-poc/engine.js`/`engine-katakana.js`・`hiragana-learn.html`/`katakana-app.html`のTracing Judgment実装部分に本Phaseの差分は一切ない（`git diff`で確認）。公式Golden Test 4種（93/93・full46全PASS・independent46両文字体系ALL CLEAN）も再確認した。

### 31.17 gaze-keyboard / Badge Semantics

T5-Cの分類（Communication History）・判断（Foundationへ統合しない）を本Phaseでも維持した。コード変更は行っていない。Badge一括変更も行っていない。

### 31.18 Real Browser（kyou-no-kiroku）

Playwrightで以下を検証した: 学習者3名（A/B/C、Cは写真付き）作成 → 各1件ずつrecord保存（実UIフロー: きもち選択→たいちょう入力画面→「きろくする」ボタン） → reload → a11y設定・kimochiOptions・写真がすべて保持されていることを確認 → Bを削除 → filter dropdownが「全員/A/C」の3項目になることを確認 → Aで絞り込み→A 1件のみ、Cで絞り込み→C 1件のみ（Bは混入しない）、全員→3件（Bも引き続き正しく「B」と表示）を確認 → 再度reloadしても同じ状態を確認 → CSVエクスポートが例外なくダウンロードをトリガーすることを確認。**console error = 0、page error = 0。**

### 31.19 User Data Safety Gate

本Phase中、children消失・photo消失・option消失・a11y消失・records消失・learner誤帰属・duplicate records・malformed migration・外部送信のいずれも発生しなかった。STOPは発生しなかった。

### 31.20 T5-D Entry Gate 判定

**4th Pilot kyou-no-kirokuの安全統合が完了した。** T5-Cで保留していた「4 Pilot Foundation validated」の判定を、本Phaseをもって確定する。T5-Dへの移行条件（4th Pilot安全統合、または明確な理由による非対象の正式分類）のうち、前者を満たした。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft/RC | 2026-08-29 | Phase T5-B。Pilot 2本（miru-hirogaru-app・hiragana-learn）でPoC実装・単体テスト18件・実ブラウザ検証・Privacy検証・容量実測を完了。全35アプリ対応は未完了。 |
| v1.0 Draft/RC + Addendum | 2026-08-29 | Phase T5-C。directions-appをShared Foundationへ統合（Pilot C）。kyou-no-kirokuはStorage Shape非互換性のため統合せず読み取り専用調査に留めた（Pilot D）。gaze-keyboardをCommunication Historyとして分類。自動テスト13件・実ブラウザ検証（4 Pilot）完了。全35アプリ対応・共通Viewer/CSV/Delete UI・Production Releaseは未着手のまま。 |
| v1.0 Draft/RC + Addendum 2 | 2026-08-29 | Phase T5-C'。Composite Storage Adapter（`donomanaRecordReadNestedCollection`/`WriteNestedCollection`）を新設し、kyou-no-kirokuを正式な4本目Pilotとして安全に統合。学習者削除後のrecord誤帰属を防ぐstable childId方式を導入し、既存の`childIndex`不整合バグを修正。自動テスト36件・実ブラウザ検証（A/B/C削除再現含む）完了。4 Pilot Foundation Validated確定。全35アプリ対応・共通Viewer/CSV/Delete UI・Production Releaseは未着手のまま。 |
