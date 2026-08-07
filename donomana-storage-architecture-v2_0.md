# どのまな 保存基盤仕様書（Version2.0） v1.0

- 版: v1.0（起草・**未承認**・レビュー待ち）
- 発行: 2026年8月（初版ドラフト）
- 作成日: 2026-08-08
- 位置づけ: 「どのまな」全アプリの保存データ（localStorage／IndexedDB）を将来アップデートする際に、既存ユーザーデータを安全に維持するための共通設計仕様書。`donomana-design-system-v2_0.html`・`donomana-dev-rules-v1.0-revised.md`とは独立した文書群であり、UI/見た目ではなく**保存データの構造・移行・バックアップ**を扱う。
- 根拠調査: Phase20-A（全29アプリ横断の保存方式インベントリ調査。localStorage/IndexedDB/Service Worker使用状況、危険処理の全数検索、export/import実装状況、ID体系調査に基づく）
- 起草: Phase20-B
- 承認: 未実施（本文書はレビュー待ちの草案）

> **本文書は設計のみを扱う。本文書の内容はまだ一切実装されていない。** 既存アプリの保存形式・保存キー・IndexedDB schemaは本文書によって変更されない。実装は将来の個別Phase（Phase20-C以降）で、本文書を参照しながら1アプリずつ慎重に行う。**本文書の発行だけを理由に、いかなるアプリの保存コードも変更してはならない。**

---

## 0. 本文書の背景

Phase20-Aにて、全29公開アプリ（および参照されていない孤立ファイル6件）を対象に、保存方式（localStorage／IndexedDB／Service Worker）・保存キー・危険処理（clear/removeItem/deleteDatabase）・export/import実装・ID生成方式を横断調査した。

主な発見：

- schemaVersion・migrationという概念はリポジトリ全体に**存在しない**（`schedule-app.html`のexportJSON()が`version:1`という素朴なフィールドを持つのみで、import側では検証していない）。
- `mogura_v3`・`nazorin_library_v1`・`sst_ai_generated_v1`のように、**キー名にバージョン番号を埋め込む**簡易的な自己流バージョニングが複数アプリで独立発生している。旧キーからの読み込みfallbackは存在しない。
- `crypto.randomUUID()`は**リポジトリ全体で未使用**。ID生成は`Date.now()+Math.random()`系の自作関数（`genId`・`uid`）に統一されている。
- IndexedDB使用は3アプリ（schedule-app／matching-app／ongaku-app）のみで、いずれも`version:1`のまま一度もアップグレードを経験していない。`onupgradeneeded`はobjectStore作成のみで、データ変換ロジックは皆無。
- `localStorage.clear()`・`indexedDB.deleteDatabase()`・`objectStore.clear()`はリポジトリ全体で**0件**。危険な削除処理は4箇所のみで、いずれもユーザーの`confirm()`または認証を経由する。
- Service Worker／CacheStorageは**未使用**。「オフラインキャッシュ更新でユーザーデータが消える」という経路は現状存在しない。

本文書は、これらの調査結果を踏まえ、今後アプリを1つずつ安全に移行していくための**共通ルール**を先に確定する。

---

## 1. 目的

本文書は、「どのまな」の各アプリが保存するユーザーデータ（設定・ユーザー作成コンテンツ・履歴）について、

1. 保存データの版を識別する方法（schemaVersion）
2. 旧版から新版へ安全に変換する方法（migration）
3. データを一意に識別する方法（UUID）
4. 保存直前の状態を取り戻せるようにする方法（Layer2世代バックアップ）
5. アプリ間で共通化できるexport/importの形式

を、実装に先立って確定することを目的とする。すべての設計は、[[donomana_project]]で確認された「MANUAL_CHANGELOG正本」や「index.htmlのCHANGELOG配列は生成物」と同様に、**既存の安全な仕組みを壊さず、共通基盤をgenerate.js側で注入する**という、このリポジトリで既に実績のあるパターンを踏襲する。

---

## 2. 文書の位置づけ

| 文書 | 関係 | 参照箇所 |
|---|---|---|
| `donomana-design-system-v2_0.html` | 独立（UI/見た目の正本。保存データは扱わない） | 参照なし |
| `donomana-dev-rules-v1.0-revised.md` | 参照元候補（将来、開発ルールへの参照追加を検討） | 未追加 |
| `CLAUDE.md` | 対象外 | 変更しない |
| Phase20-A調査結果（本文書の根拠） | 本文書の事実的根拠 | 0章に要約を転記済み |

本文書はDesign Systemやdev-rulesと矛盾する内容を含まない（保存データという別領域を扱うため、通常は競合しない）。矛盾が判明した場合は個別に調整する。

---

## 3. 設計原則（Phase20-Aから継承・確定）

Phase20-Aで提示された10原則を、本文書の設計の前提として正式に確定する。

1. 既存ユーザーデータを勝手に削除しない
2. 保存形式変更時は後方互換性またはmigrationを用意する
3. migrationは可能な限り冪等にする
4. 同じmigrationを複数回通っても壊れない設計を優先する
5. バックアップ・復元経路を先に考えてから保存形式を変更する
6. localStorage / IndexedDB等の既存キーを安易にrename/deleteしない
7. ユーザー操作なしのデータ破棄は禁止
8. 新形式へ変換後も必要に応じて旧形式を読み取れる期間を設ける
9. migration失敗時に元データを残す
10. 実装前に必ず調査・設計を先行させる（本文書はこの原則の実践そのもの）

---

## 4. ① schemaVersionフィールド仕様

### 4.1 3つの版番号を分離する理由

保存データの「版」は、目的の異なる3種類の番号に分離する。1つの数字に混在させると、将来「envelope（入れ物）の変更」と「アプリ内部データ構造の変更」を区別できなくなるため。

| フィールド | 意味 | 増分タイミング | 増分責任者 |
|---|---|---|---|
| `formatVersion` | export/importの**入れ物（envelope）自体**の形式版。全アプリ共通。 | envelopeの構造（フィールド追加・削除）を変えたとき | 共通基盤（generate.js側） |
| `schemaVersion` | そのアプリの`data`内部構造の版。アプリごとに独立してカウント。 | アプリ内部のデータ構造を変えたとき（例：items配列の各要素にフィールド追加） | 各アプリの開発者 |
| `migrationVersion` | このデータに対し、これまで**何回のmigrationステップが累積適用済みか**の記録。 | migration関数を1つ実行するたびに+1 | migrationランナー（共通基盤） |

`schemaVersion`と`migrationVersion`は多くの場合一致するが、「破壊的でない正規化ステップ」（migrationVersionは進むがschemaVersionは変わらない）を将来許容するため、あえて分離する。

### 4.2 JSON構造（export/import envelope）

```json
{
  "formatVersion": "1.0",
  "schemaVersion": 2,
  "migrationVersion": 1,
  "app": "schedule-app",
  "exportedAt": "2026-08-08T03:14:00.000Z",
  "data": {
    "id": "b3f2a1d4-58e7-4c2a-9d11-7e6f2c8a9b10",
    "name": "きょうのよてい",
    "items": [
      {
        "id": "1a2b3c4d-5e6f-4789-a0b1-c2d3e4f5a6b7",
        "label": "朝の会",
        "yomi": "あさのかい",
        "time": "",
        "place": "",
        "note": "",
        "img": ""
      }
    ],
    "checks": {}
  }
}
```

- `app`は`apps-data.json`の`id`フィールドと一致させる（29アプリ共通の識別子を再利用し、新規の命名体系を増やさない）。
- `data`の中身はアプリごとに自由（本文書は`data`の内部構造そのものは規定しない。各アプリのschemaVersion管理はアプリ側の責務）。
- `exportedAt`はISO 8601（既存`schedule-app.html`のexportJSON()と同じ形式を踏襲）。

### 4.3 旧形式（schemaVersion概念導入前）の扱い

`schedule-app.html`の現行exportJSON()が出力する`{version:1, name, items, checks, exportedAt}`のような、`formatVersion`/`schemaVersion`を持たないファイルは、**「暗黙のschemaVersion 1」**として扱う。

判定ルール：`formatVersion`キーが存在しない場合、旧形式とみなし、まずenvelope移行（4.2の構造への包み直し）を行ってからmigrationチェーンに乗せる。この判定・移行処理自体もmigrationの一種として扱う（5章）。

---

## 5. ② migration設計

### 5.1 方針

- migrationは**純粋関数**として設計する：`migrate_v1_to_v2(data) => newData`。入力データを直接書き換えず、新しいオブジェクトを返す（原則3・4「冪等・複数回通っても壊れない」を満たすための基本原則）。
- migrationは**現在のschemaVersionから最新版まで、1段ずつ順番に**適用する（v1→v2→v3のように、いきなりv1→v3へ飛ばさない）。各段が独立してテスト・レビューできることを優先する。
- **書き込みは全migration成功後に一括で行う。** 途中の1段でも例外が発生した場合、それまでの変換結果を破棄し、**元の保存データには一切触れない**（原則9）。
- migration関数は`schemaVersion`が既に対象より新しい場合は**何もしない**（no-op）。これにより「同じmigrationを複数回通っても壊れない」（原則4）を満たす。

### 5.2 migrationランナーの疑似コード（設計のみ・未実装）

```js
// 疑似コード（本Phaseでは実装しない）
const MIGRATIONS = {
  1: migrate_v1_to_v2,
  2: migrate_v2_to_v3,
  // ...
};

function runMigrations(raw) {
  let data = normalizeEnvelope(raw); // 旧形式(4.3)ならenvelope化
  let version = data.schemaVersion || 1;
  const target = LATEST_SCHEMA_VERSION;

  if (version >= target) return data; // 冪等：既に最新なら何もしない

  try {
    let migrated = data;
    for (let v = version; v < target; v++) {
      const step = MIGRATIONS[v];
      if (!step) throw new Error(`migration for v${v} not found`);
      migrated = step(migrated); // 純粋関数、migrated自体は書き換えない
      migrated.schemaVersion = v + 1;
      migrated.migrationVersion = (migrated.migrationVersion || 0) + 1;
    }
    return migrated; // 全段成功して初めて返す
  } catch (e) {
    // 原則9：失敗時は元データ(raw)をそのまま返す。書き込みは行わない
    console.error('migration failed, keeping original data', e);
    return null; // 呼び出し側は null を「migration失敗」として扱い、保存を中断する
  }
}
```

### 5.3 具体例：migrate(v1→v2)

schedule-appを例に、v1（現行exportJSON()相当）→v2（UUID導入後）の変換方針を示す。

- 入力：`{version:1, name, items:[{id:数値,...}], checks:{数値id: bool}, exportedAt}`
- 変換内容：
  1. envelopeを4.2の構造へ包み直す（`version`→`schemaVersion`に読み替え、`formatVersion`/`migrationVersion`を新設）
  2. `items`配列の各要素に対し、既存の数値/文字列`id`を保持したまま**新しいUUIDを`uuid`フィールドとして追加**する（既存`id`は削除しない＝原則6「既存キーを安易にrename/deleteしない」の`data`内部版）
  3. `checks`オブジェクトは既存の数値idキーのまま維持する（`id`を書き換えないため、既存の参照関係は自動的に壊れない）
- 出力：`{formatVersion:"1.0", schemaVersion:2, migrationVersion:1, app:"schedule-app", exportedAt, data:{id, name, items:[{id, uuid, label,...}], checks}}`

**設計判断：既存の`id`をUUIDで置き換えるのではなく、UUIDを追加フィールドとして併存させる。** これにより、`checks`のようなid参照を持つ構造を書き換える必要がなくなり、migrationの複雑さとバグ混入リスクを最小化できる（原則5「バックアップ・復元経路を先に考えてから保存形式を変更する」に沿い、最も安全な変換のみを先に行う）。

### 5.4 具体例：migrate(v2→v3)（将来の型として提示。現時点で具体的な変更内容は未確定）

v3は現時点で必要性が確定していない（本文書執筆時点で該当する具体的な変更要求はない）。ここでは**migrationチェーンが2段以上に伸びても壊れないこと**を示す型のみを示す。

- 5.2のランナーは`for (let v = version; v < target; v++)`でループするため、v1のデータがいきなりv3を要求されても、v1→v2→v3と自動的に多段適用される。
- v3を新設する際は、`MIGRATIONS`テーブルに`3: migrate_v2_to_v3`を追加するだけでよく、v1→v2のロジックには一切手を入れない（各段が独立している設計であることの確認）。

---

## 6. ③ UUID設計

### 6.1 採用するUUID生成方法

`crypto.randomUUID()`を採用する。理由：

- ブラウザ標準API（ライブラリ追加不要、dev-rules「外部ライブラリ追加は禁止」の運用方針と整合）
- 対象3アプリは既にCanvas 2D・IndexedDB等のモダンAPIに依存しており、対応ブラウザ範囲は変わらない
- Phase20-A調査時点でリポジトリ内に代替のUUID実装は存在しない（新規導入で問題ない）

### 6.2 アプリ別の採用方法

| アプリ | 対象データ | 現状のID | UUID導入方法 |
|---|---|---|---|
| schedule-app | `items[]`（予定項目） | `Date.now()+Math.random()`（数値） | 5.3のとおり、既存`id`は保持し`uuid`フィールドを追加。**新規追加される項目は生成時点から`uuid`を持つ**（`makeItem()`内で発行）。既存`id`は当面`checks`参照用に残す |
| matching-app | `sets[]`（マッチングセット） | `'set_'+Date.now()` | 新規作成セットから`uuid`フィールドを追加発行。既存`id`（`set_`プレフィックス文字列）はキーとして維持し、置き換えない |
| ongaku-app | `recordings`（IndexedDB, keyPath:`id`, autoIncrement） | IndexedDBのautoIncrement数値 | **keyPath（`id`）はautoIncrementのまま変更しない**（objectStoreのkeyPath変更はIndexedDBの再作成を要し、リスクが高いため回避）。録音レコードに`uuid`フィールドを追加し、export/import時の対外的な識別子として使う。DB内部のプライマリキーとしての役割はautoIncrementに残す |

### 6.3 共通方針

- **既存IDを一括で書き換える移行は行わない。** 常に「UUIDフィールドの追加」という後方互換な変更に限定する（原則6・8）。
- 新規作成データは、可能な場所では作成時点で`uuid`を発行する（将来のexport/import・端末間の重複判定を見据えた先行投資）。
- UUID導入がP0対象（IndexedDB3アプリ）に限定されるのは、Phase20-Aの調査で「複数ストレージ／複雑schema」と分類された対象と一致するため。他アプリへの展開は、必要性が生じた時点で個別評価する。

---

## 7. ④ Layer2世代バックアップ設計

Phase20-Aで提示した三層バックアップのうち、Layer2（ブラウザ内スナップショット／世代バックアップ）を具体化する。

### 7.1 保存世代数

**3世代**（現在値 + 過去2世代 = 実質3スロット）とする。

### 7.2 ローテーション方法

- 保存対象ストレージごとに、`現在`のほかに`gen1`（1つ前）・`gen2`（2つ前）の2スロットを持つ。
- 新しい保存が発生する直前に、`gen2 ← gen1`、`gen1 ← 現在（更新前の値）`とシフトしてから、`現在`を新しい値で上書きする（典型的なリングローテーション）。
- **ローテーションの発火頻度**：保存操作のたびに毎回シフトすると、短時間の連続操作（例：予定項目を1つずつ追加するたび）で3世代すべてがほぼ同一内容になり、世代バックアップとしての意味が薄れる。そのため、**セッション単位（ページを開いてから最初の保存時のみ）または一定時間間隔（例：直前のローテーションから5分以上経過）でのみローテーションする**方式を採用する。通常の保存自体（Layer1）は毎回そのまま実行し、ローテーションの間引きだけを行う。

### 7.3 保存先ごとの実装方針

| ストレージ種別 | 対象アプリ例 | 実装方針 |
|---|---|---|
| localStorage | 全localStorage利用アプリ | キー名にサフィックスを付与：`{key}`（現在）／`{key}__gen1`／`{key}__gen2` |
| IndexedDB | schedule-app／matching-app／ongaku-app | 既存objectStoreとは別に`snapshots`objectStoreを新設し、`{genIndex: 0|1|2, data, savedAt}`形式で保存。既存の`schedules`/`sets`/`recordings`ストアやkeyPathには一切触れない |

### 7.4 復元方法

- 復元は**常にユーザーの明示操作を起点とする**（原則7）。自動復元は行わない。
- 復元UIは将来Phase（Phase20-D以降、入口の整備）で設計する。本文書では「読み取り専用のプレビュー→ユーザーが選んだ世代を確認→確定操作で現在データとして採用」という2段階フローを最低要件として示すのみに留める。
- 復元を実行しても、復元前の「現在」データはgen1へシフトされる（復元自体も1回の保存操作として扱われ、7.2のローテーションルールに従う。これにより「誤って古い世代を復元してしまった」場合も、直前の状態がgen1に残る）。

### 7.5 容量対策

- localStorageは1オリジンあたり概ね5〜10MB（ブラウザ依存）の上限がある。世代バックアップは同じデータを最大3倍複製するため、**画像などの大きなバイナリを含むデータ（register-appの商品画像等）は世代バックアップの対象から除外し、設定・構造データのみを対象とする**方針とする。
- IndexedDB側は実用上の容量上限がlocalStorageよりはるかに大きいため、3アプリ（schedule-app／matching-app／ongaku-app）のバックアップはIndexedDBの`snapshots`ストア方式を優先し、localStorageの世代化より容量リスクが低い。
- バックアップ書き込みが容量超過等で失敗した場合、**Layer1（現在データ）の保存を絶対にブロックしない**。既存コードの`try{...}catch(e){}`パターン（29アプリ共通で既に多用されている安全策）を踏襲し、バックアップ書き込みの失敗は握りつぶして本体保存を優先する。

---

## 8. ⑤ 共通Exportフォーマット設計（generate.js共通化案）

### 8.1 狙い

`schedule-app.html`のexportJSON()/importJSON()は、このリポジトリで唯一の完成された実例である。これを一般化し、各アプリが同じコードを再実装せずに済むようにする。

このリポジトリには既に「共通コードをgenerate.js側で全アプリへ注入する」実績パターン（共通A11yパネル`buildA11yPanelHTML()`）がある。共通Export/Import基盤も同じアーキテクチャを踏襲することで、実装・レビューコストを抑える。

### 8.2 共通ヘルパーの役割分担（設計のみ）

```
generate.js が全アプリへ注入する共通関数（案）
├─ donomanaBuildExport(appId, schemaVersion, data)
│     → 4.2のenvelope形式でJSON化し、Blobダウンロードを実行
│     → ファイル名は "{appId}_{アプリ内で決めた名前}_{日付}.json" 形式に統一
│
└─ donomanaParseImport(fileText, appId)
      → JSONパース → formatVersion/app一致チェック → runMigrations()（5.2）
      → 成功時: { ok:true, data } を返す
      → 失敗時: { ok:false, reason } を返す（例外を投げない。呼び出し側でtoast等に表示しやすくするため）
      → このいずれの場合も、呼び出し元（各アプリ）の既存データには一切触れない
```

- 各アプリ側で用意するのは、`data`の中身の組み立て（export時）と、`applyImportedData(data)`（import成功後にアプリの状態へ反映する処理）のみ。envelope・migration・ファイルI/Oは共通化する。
- `app`フィールドの不一致（例：schedule-appのファイルをmatching-appで読み込もうとした）は`donomanaParseImport`側で検出し、`{ok:false, reason:'app-mismatch'}`を返す設計とする（誤操作防止、原則7に関連）。

### 8.3 本Phaseで行わないこと

- 上記はいずれも**設計案**であり、`generate.js`・各アプリHTMLへの実装は行わない。
- 実装時は、まずschedule-appの既存exportJSON()/importJSON()を8.2の関数呼び出しへ置き換える形で1アプリ検証してから、他アプリへ展開する順序を推奨する（Phase20-C以降で個別判断）。

---

## 9. Version2.0への影響まとめ

| 観点 | 現状（Version1系） | Version2.0設計後の変化 |
|---|---|---|
| schemaVersion | 概念なし（schedule-appの`version:1`のみ例外） | 全アプリ共通の3分割バージョン体系（4章）を新設 |
| migration | 皆無 | 冪等・多段対応のmigrationランナー設計を確定（5章）。**実装はまだ行わない** |
| ID体系 | Date.now()+Math.random()系が主流、UUID未使用 | IndexedDB3アプリに限定してUUIDフィールドを追加方式で導入（6章）。既存IDは置き換えない |
| バックアップ | schedule-appのみexport/importあり、他は片道CSVのみか皆無 | Layer2世代バックアップ（3世代・ローテーション）を全ストレージ利用アプリへ展開可能な設計として確定（7章） |
| export/import実装 | アプリごとに個別実装（重複コスト大） | generate.js側共通ヘルパー案を提示（8章）。**実装はまだ行わない** |
| 既存データへの影響 | — | **本文書の発行時点ではゼロ**（設計のみ、コード変更なし） |

---

## 10. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-08 | 初版起草（Phase20-B）。Phase20-Aの調査結果を根拠に、schemaVersion・migration・UUID・Layer2バックアップ・共通Exportフォーマットの設計案を確定。未承認・未実装 |

---

## 11. 未決定事項（将来Phaseで確定）

- Layer2ローテーションの発火間隔の具体的な数値（本文書では「例：5分」と例示のみ、実測に基づく確定は未実施）
- Layer3（明示export）の復元UI・入口設計の詳細（Phase20-D以降）
- register-appの画像データ（base64）に対するバックアップ方針の詳細（7.5節で「対象外」と方針のみ示したが、代替のバックアップ手段は未設計）
- migrate(v2→v3)の具体的な変更内容（5.4節で型のみ提示。必要性が生じた時点で個別設計）
- `switch-training-app.html`等、apps-data.jsonに未リンクの孤立ファイル6件を本仕様書の対象に含めるかどうか（Phase20-Aで報告済み、未回答）
