# どのまな 保存基盤仕様書（Version2.0） v2.0

- 版: v2.0（**Phase20-B設計 + Phase20-C1〜C7a実装検証を反映して確定**）
- 発行: 2026年8月
- 作成日: 2026-08-08（v1.0起草）／改訂: 2026-08-08（v2.0確定、Phase20-C8）
- 位置づけ: 「どのまな」全アプリの保存データ（localStorage／IndexedDB）を将来アップデートする際に、既存ユーザーデータを安全に維持するための共通設計仕様書。`donomana-design-system-v2_0.html`・`donomana-dev-rules-v1.0-revised.md`とは独立した文書群であり、UI/見た目ではなく**保存データの構造・移行・バックアップ**を扱う。
- 根拠調査: Phase20-A（全29アプリ横断の保存方式インベントリ調査）
- 起草: Phase20-B（設計のみ・未実装）
- 実装検証: Phase20-C1〜C7a（schedule-app／matching-app／ongaku-appの3アプリで実装・公開・回帰確認まで完了）
- 承認: **v1.0設計は承認済み。v2.0はPhase20-C1〜C7aの実装結果を反映した確定版。**

> **本文書は、schedule-app／matching-app／ongaku-appの3アプリについては実装・公開済みの内容を記載する。それ以外の26アプリについては、本文書はまだ設計方針のみを示し、コードは一切変更されていない。** 本文書の発行・改訂だけを理由に、schedule-app／matching-app／ongaku-app以外のアプリの保存コードを変更してはならない。展開は必ず個別Phaseで1アプリずつ行う。

---

## 0. 本文書の背景

Phase20-Aにて、全29公開アプリ（および参照されていない孤立ファイル6件）を対象に、保存方式（localStorage／IndexedDB／Service Worker）・保存キー・危険処理（clear/removeItem/deleteDatabase）・export/import実装・ID生成方式を横断調査した。

主な発見（Phase20-A時点）：

- schemaVersion・migrationという概念はリポジトリ全体に**存在しなかった**（`schedule-app.html`のexportJSON()が`version:1`という素朴なフィールドを持つのみで、import側では検証していなかった）。
- `crypto.randomUUID()`は**リポジトリ全体で未使用**だった。ID生成は`Date.now()+Math.random()`系の自作関数に統一されていた。
- IndexedDB使用は3アプリ（schedule-app／matching-app／ongaku-app）のみで、いずれも`version:1`のまま一度もアップグレードを経験していなかった。
- `localStorage.clear()`・`indexedDB.deleteDatabase()`・`objectStore.clear()`はリポジトリ全体で0件。危険な削除処理は限定的だったが、**ongaku-appの`deleteRecording()`にはconfirm()すら存在しない**という実装漏れがPhase20-C4/C6の再調査で見つかった（0章時点では未発見）。
- Service Worker／CacheStorageは未使用。

Phase20-Bはこれらの調査結果を踏まえ設計のみを確定した（v1.0）。**Phase20-C1〜C7aでは、この設計を実際にschedule-app／matching-app／ongaku-appへ適用し、実装・Playwrightによる実機検証・公開・SHA256照合まで完了した。** 本v2.0は、その実装過程で判明した「設計と実装の乖離」「設計時点では想定していなかった論点」を反映して確定する。

---

## 1. 目的

本文書は、「どのまな」の各アプリが保存するユーザーデータ（設定・ユーザー作成コンテンツ・履歴）について、

1. 保存データの版を識別する方法（schemaVersion）
2. 旧版から新版へ安全に変換する方法（migration）
3. データを一意に識別する方法（UUID）
4. 保存直前の状態を取り戻せるようにする方法（データ保護方式／Layer2〜3）
5. アプリ間で共通化できるexport/importの形式

を確定することを目的とする。すべての設計は、[[donomana_project]]で確認された「MANUAL_CHANGELOG正本」や「index.htmlのCHANGELOG配列は生成物」と同様に、**既存の安全な仕組みを壊さず、共通基盤をgenerate.js側で注入する**という、このリポジトリで既に実績のあるパターンを踏襲する。

---

## 2. 文書の位置づけ

| 文書 | 関係 | 参照箇所 |
|---|---|---|
| `donomana-design-system-v2_0.html` | 独立（UI/見た目の正本。保存データは扱わない） | 参照なし |
| `donomana-dev-rules-v1.0-revised.md` | 参照元候補（将来、開発ルールへの参照追加を検討） | 未追加 |
| `CLAUDE.md` | 対象外 | 変更しない |
| Phase20-A調査結果（本文書の事実的根拠） | 本文書の事実的根拠 | 0章に要約を転記済み |
| Phase20-C1〜C7a（本文書の実装的根拠） | schedule-app／matching-app／ongaku-appでの実装・実測結果 | 7章以降に反映 |

本文書はDesign Systemやdev-rulesと矛盾する内容を含まない。矛盾が判明した場合は個別に調整する。

---

## 3. 設計原則

### 3.1 最上位原則（Phase20-C1〜C7aで確定）

**全アプリへ同じバックアップ実装を機械的に配るのではなく、データ特性に応じて適切な保護方式を選択する。**

Phase20-Bのv1.0時点では、Layer2＝「3世代スナップショットを全ストレージ利用アプリへ展開する」という単一方式を暗黙の前提としていた。しかしPhase20-C6でongaku-appの実録音データを実測したところ、5分録音1件で約4.9MB、3世代化すると約14.6MB、複数録音では容量リスクが現実的な水準に達することが判明し、この前提は**誤りだった**（詳細は7章）。

したがって、Version2.0保存基盤で全アプリに共通するのは「3世代複製」という**実装方式**ではなく、以下の**保護原則**である。実装方式はアプリのデータ特性に応じて個別に選択する（7.3節「Layer2方式選択基準」）。

1. データを静かに失わせない（ユーザーが気づけない形でデータが消えない）
2. 既存IDを壊さない（既存の参照関係・キーを維持する）
3. failure時に原本を壊さない（バックアップ処理・migration処理が失敗しても、既存の正データは無傷のまま残る）
4. 将来のschemaを無理に読み込まない（未知の・未来のバージョンのデータを誤って解釈しない）
5. backup処理が通常保存（Layer1）を妨げない（バックアップの失敗は握りつぶし、本体保存を優先する）

### 3.2 個別原則（Phase20-Aから継承・確定）

1. 既存ユーザーデータを勝手に削除しない
2. 保存形式変更時は後方互換性またはmigrationを用意する
3. migrationは可能な限り冪等にする
4. 同じmigrationを複数回通っても壊れない設計を優先する
5. バックアップ・復元経路を先に考えてから保存形式を変更する
6. localStorage / IndexedDB等の既存キーを安易にrename/deleteしない
7. ユーザー操作なしのデータ破棄は禁止
8. 新形式へ変換後も必要に応じて旧形式を読み取れる期間を設ける
9. migration失敗時に元データを残す
10. 実装前に必ず調査・設計を先行させる

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

`schedule-app.html`の旧exportJSON()が出力していた`{version:1, name, items, checks, exportedAt}`のような、`formatVersion`/`schemaVersion`を持たないファイルは、**「暗黙のschemaVersion 1」**として扱う。

判定ルール：`formatVersion`キーが存在しない場合、旧形式とみなし、まずenvelope移行（4.2の構造への包み直し）を行ってからmigrationチェーンに乗せる。この判定・移行処理自体もmigrationの一種として扱う（5章）。

### 4.4 実装状況（Phase20-C1／C5／C6、v2.0で追記）

- **schedule-app**：`SCHEDULE_SCHEMA_VERSION = 1`を定数として実装済み。`exportJSON()`は4.2のenvelope形式（`formatVersion`/`schemaVersion`/`migrationVersion`/`app`/`exportedAt`/`data`）で出力し、`importJSON()`は旧形式（4.3のフラット形式）も後方互換で読み取れる。**IndexedDB本体のレコードにはschemaVersionフィールドを追加していない**（本体recordへの追加は4.6の方針どおり必要性が生じるまで見送り、スナップショット側にのみ付与）。
- **matching-app**：`MATCHING_SCHEMA_VERSION = 1`を定数として実装済み。export/importはPhase20-C5で新設（4.2のenvelope形式）。
- **ongaku-app**：`ONGAKU_SCHEMA_VERSION = 1`を定数として実装済み。ただしexport/importは実装していない（11.3節参照、大容量バイナリのためLayer3の一般設計がまだ適さない）。
- 3アプリとも、**IndexedDBのDB versionそのもの（`indexedDB.open(name, version)`の第2引数）は変更していない**。schemaVersionはDB versionとは独立した、アプリ内部データの論理バージョンである。

### 4.5 schemaVersion標準方針（v2.0で追加）

- schemaVersionは**アプリごとに独立**してカウントする（全アプリ共通の単一カウンタは持たない）。
- 自分より**未来のschemaVersion**を検出した場合（例：旧バージョンのアプリコードが、新しいアプリコードで作られたデータを読んだ場合）は、**無理にmigrationを試みず、読み込みを拒否またはfallbackする**（未知のフィールド構造を誤って壊れた状態で解釈しないため）。
- migration適用の判断基準は**schemaVersion**を主とする。`migrationVersion`はあくまで「何回変換をくぐったか」の補助情報であり、適用要否の判定には使わない。
- schemaVersionは**export envelope／Layer2スナップショット**には必ず保持する。**本体record（IndexedDBの通常レコードやlocalStorageの主データ）へschemaVersionフィールドを追加することは、必要性が生じるまで行わない**（4.4のとおり、3アプリとも本体recordには未追加。将来、本体recordから直接旧形式を判定する必要が生じた時点で個別に追加を検討する）。

---

## 5. ② migration設計

### 5.1 方針

- migrationは**純粋関数**として設計する：`migrate_v1_to_v2(data) => newData`。入力データを直接書き換えず、新しいオブジェクトを返す。
- migrationは**現在のschemaVersionから最新版まで、1段ずつ順番に**適用する（v1→v2→v3のように、いきなりv1→v3へ飛ばさない）。
- **書き込みは全migration成功後に一括で行う。** 途中の1段でも例外が発生した場合、それまでの変換結果を破棄し、**元の保存データには一切触れない**。
- migration関数は`schemaVersion`が既に対象より新しい場合は**何もしない**（no-op）。同じmigrationを複数回通っても壊れない。
- 自分より**未来のバージョン**（`LATEST_SCHEMA_VERSION`を超えるschemaVersion）を検出した場合は、migrationを試みず拒否する（3.1の最上位原則4）。
- migrationは**UUIDを再生成しない**（既存recordのuuidフィールドはmigration前後で不変。6章の方針と整合）。

### 5.2 migrationランナーの疑似コード（設計のみ・未実装）

```js
// 疑似コード（v2.0時点でも未実装。実装が必要になった時点で個別Phaseで着手）
const MIGRATIONS = {
  1: migrate_v1_to_v2,
  2: migrate_v2_to_v3,
  // ...
};

function runMigrations(raw) {
  let data = normalizeEnvelope(raw); // 旧形式(4.3)ならenvelope化
  let version = data.schemaVersion || 1;
  const target = LATEST_SCHEMA_VERSION;

  if (version > target) return null; // 未来のバージョンは拒否(3.1原則4)
  if (version === target) return data; // 冪等：既に最新なら何もしない

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
    // 失敗時は元データ(raw)をそのまま返す。書き込みは行わない
    console.error('migration failed, keeping original data', e);
    return null; // 呼び出し側は null を「migration失敗」として扱い、保存を中断する
  }
}
```

### 5.3 具体例：migrate(v1→v2)

schedule-appを例に、v1（旧exportJSON()相当）→v2（UUID導入後）の変換方針を示す。この変換内容自体は**Phase20-C1で実装済み**（`importJSON()`の後方互換パースとして、5.2の関数チェーンではなく個別の分岐処理で実現している。ランナー自体は依然未実装）。

- 入力：`{version:1, name, items:[{id:数値,...}], checks:{数値id: bool}, exportedAt}`
- 変換内容：
  1. envelopeを4.2の構造へ包み直す
  2. `items`配列の各要素に対し、既存の数値/文字列`id`を保持したまま新しいUUIDを`uuid`フィールドとして追加する
  3. `checks`オブジェクトは既存の数値idキーのまま維持する
- 出力：`{formatVersion:"1.0", schemaVersion:2, migrationVersion:1, app:"schedule-app", exportedAt, data:{id, name, items:[{id, uuid, label,...}], checks}}`

**設計判断：既存の`id`をUUIDで置き換えるのではなく、UUIDを追加フィールドとして併存させる。** Phase20-C1〜C6で3アプリすべてに適用し、既存の参照関係（`checks`のidキー等）を一切書き換えずに済んだ（原則6）。

### 5.4 具体例：migrate(v2→v3)（将来の型として提示。現時点で具体的な変更内容は未確定）

v3は現時点で必要性が確定していない。5.2のランナーは多段適用に対応する設計だが、実際に2段以上のmigrationチェーンを通した実績はまだない。

---

## 6. ③ UUID設計

### 6.1 採用するUUID生成方法

`crypto.randomUUID()`を採用する。理由：

- ブラウザ標準API（ライブラリ追加不要）
- 対象3アプリは既にCanvas 2D・IndexedDB等のモダンAPIに依存しており、対応ブラウザ範囲は変わらない
- Phase20-A調査時点でリポジトリ内に代替のUUID実装は存在しなかった

### 6.2 アプリ別の採用方法（Phase20-C1／C5／C6で実装済み）

| アプリ | 対象データ | 既存ID | UUID導入方法 | 実装Phase |
|---|---|---|---|---|
| schedule-app | `items[]`（予定項目） | `Date.now()+Math.random()`（数値） | 既存`id`は保持し`uuid`フィールドを追加。新規項目は`makeItem()`内で生成時点から`uuid`を持つ。**既存項目には`saveLocal()`実行時に遅延付与**（`items.forEach(it=>{if(!it.uuid)it.uuid=crypto.randomUUID();})`） | Phase20-C1 |
| matching-app | `sets[]`（マッチングセット） | `'set_'+Date.now()` | 新規作成セットから`uuid`フィールドを追加発行。既存`id`はキーとして維持。**既存セットは保存操作時に遅延付与**（`prevSet&&prevSet.uuid || crypto.randomUUID()`） | Phase20-C5 |
| ongaku-app | `recordings`（IndexedDB, keyPath:`id`, autoIncrement） | autoIncrement数値 | keyPath（`id`）はautoIncrementのまま変更せず。**新規保存時のみ**`uuid`フィールドを付与。録音は作成後immutableで再保存経路が無いため、既存録音への遅延付与は行っていない（行う手段がない） | Phase20-C6 |

### 6.3 共通方針（実証済み）

- **既存IDを一括で書き換える移行は行わない。** 常に「UUIDフィールドの追加」という後方互換な変更に限定する（原則6・8）。3アプリとも起動時の一括migrationは実装していない。
- 新規作成データは、可能な場所では作成時点で`uuid`を発行する。
- **soft delete／Undo／復元操作では、UUIDを再生成しない**（Phase20-C7で確定。同一レコードの`id`・`uuid`・本体データは操作前後で不変）。
- autoIncrement keyPathを持つIndexedDBアプリ（ongaku-app）では、「DB内部id（autoIncrement、プライマリキー）」と「対外識別uuid（export/import・重複判定用）」の併用を標準候補とする方針が、実装によって裏付けられた。
- UUID導入がこれまでIndexedDB3アプリに限定されているのは、Phase20-Aの調査で「複数ストレージ／複雑schema」と分類された対象と一致するため。他アプリへの展開は、必要性が生じた時点で個別評価する（17章）。

---

## 7. ④ データ保護方式（Layer2）標準

### 7.1 Phase20-Bからの訂正

v1.0（Phase20-B）の7.3節では、IndexedDB3アプリすべてに対し「**既存objectStoreとは別に`snapshots`objectStoreを新設**」する方針を示していた。

**この方針は実装されなかった。** 実際にPhase20-C1（schedule-app）・Phase20-C5（matching-app）で採用されたのは、**新しいobjectStoreを作らず、既存のobjectStore内にスナップショット専用の特殊キーを持つレコードとして共存させる**方式である。

| | v1.0設計（未実装） | 実装（Phase20-C1／C5、確定） |
|---|---|---|
| 保存場所 | 新設の`snapshots`objectStore | 既存objectStore内（特殊キーのレコード） |
| DB version | 変更なし（新objectStore追加のためupgradeneededは必要） | **完全に無変更**（`indexedDB.open()`のversion引数を一度も変えていない） |
| schedule-app実装 | — | 既存の`cur`ストア内に`k:'snapshot_gen1'`/`k:'snapshot_gen2'`という特殊キーのレコードとして保存 |
| matching-app実装 | — | 既存の`sets`ストア内に`'__snap_gen1_'+setId`という特殊キー＋`__snapshot:true`マーカーフィールドを持つレコードとして保存（一覧表示側でフィルタして除外） |

**理由**：objectStore追加にはIndexedDBの`onupgradeneeded`（DB version増分）が必須であり、既存データへの影響範囲・ロールバック手順が複雑化する。既存ストアへの「特殊キーの追加」であれば、DB versionが不変のまま、既存の読み書きコードパスにも影響を与えずに導入できることが実装で確認された。**今後、他アプリへLayer2を展開する際も、新規objectStoreの新設ではなく、既存ストアの特殊キー活用を優先する。**

### 7.2 3パターン標準（Phase20-C1〜C7で実証）

Layer2は単一方式ではなく、データ特性に応じた3つの標準パターンとして確定する。

#### A. schedule型

- **対象データ特性**：高頻度に更新される、単一の構造化データ（1ユーザー1件の「現在の予定」のような単一ドキュメント）
- **実証例**：schedule-app（Phase20-C1／C2／C3／C3a、公開commit `ed540e0`）
- **方式**：
  - `current`（本体）／`gen1`（1つ前）／`gen2`（2つ前）の3スロット
  - 一定時間間隔（`SNAPSHOT_INTERVAL_MS = 5分`）でのみローテーション発火（保存操作のたびにはローテーションしない。Layer1の保存自体は毎回そのまま実行）
  - atomic restore（単一トランザクション内で検証→読み取り→書き込み）
  - **restore前のcurrentをgen1へ退避**してから復元する（誤って古い世代を復元しても、直前の状態がgen1に残る）
  - **世代ごとの復元ロジックが非対称**であることが実装で判明（Phase20-C3a）：gen1を復元する場合は「current→gen1」の1段シフトのみ、gen2を復元する場合は「current→gen1→gen2」の2段シフトが必要。実装時にこの非対称性を見落とすと、復元操作自体でデータを失う不具合になる（実際に発見・修正された）
  - UUID遅延付与（既存itemに保存時点で付与）
  - version付きexport/import（4.2のenvelope形式）

#### B. matching型

- **対象データ特性**：明示的な保存操作で確定する、複数存在しうるセット単位データ（1ユーザーが複数の「マッチングセット」を持つ）
- **実証例**：matching-app（Phase20-C5／C5a、公開commit `3cbdbf3`）
- **方式**：
  - **セット単位**でのスナップショット（アプリ全体で1つの`current/gen1/gen2`ではなく、セットごとに独立した`current/gen1/gen2`）
  - **保存操作の単位**で世代を作成（schedule型の時間間隔方式とは異なり、「保存する」という明示操作そのものがローテーションの契機）
  - atomic restore、id維持＋uuid付与はschedule型と共通
  - **import競合時に既存データを上書きしない**（9章「Import保護標準」を参照。matching-appで確定した原則を全アプリ共通の標準へ格上げ）

#### C. ongaku型

- **対象データ特性**：大容量かつ**作成後immutable**（変更されない）なデータ（録音・画像等のバイナリ本体を持つ、追記のみのコンテンツ）
- **実証例**：ongaku-app（Phase20-C6／C7／C7a、公開commit `403ec9b`）
- **方式**：
  - **通常時の完全世代コピーをしない**（実測により、5分録音1件で3世代化すると約14.6MBに達し、複数録音では容量リスクが現実化することを確認。schedule型／matching型の3世代複製をそのまま適用しない）
  - `deletedAt`フィールドによるsoft delete（本体audioDataは複製しない。既存レコードにタイムスタンプを追加するのみ）
  - 即時Undo（削除直後、非モーダルバーで即座に取り消せる）
  - **保持期限内の復元UI**（「最近削除した録音」——即時Undoの表示時間を過ぎても、保持期限内であれば復元できる。Phase20-C7aで追加。8秒のUndoバーだけでは「24時間保持する」という設計と実際の復元手段が食い違うという不整合が確認され、この追加で解消した）
  - best-effort purge（起動時に期限超過レコードのみ物理削除。purge失敗はLayer1の通常保存を妨げない）
  - id／uuid維持（soft delete・Undo・復元いずれの操作でも新規id/uuidを発行しない）
  - 詳細標準は10章を参照

### 7.3 Layer2方式選択基準（v2.0で新設）

新しいアプリへLayer2を導入する際は、以下を評価してA/B/Cいずれのパターンに近いか（または「別設計が必要」か）を判断する。**単純に全アプリへ3世代複製方式を配布しない。**

| 評価軸 | 判断への影響 |
|---|---|
| データ容量（1件あたり／全件合計の見込み） | 大きいほど3世代複製のリスクが増す。実データでの実測を推奨（Phase20-C6ではPlaywrightの疑似マイクで実録音して実測した） |
| 更新頻度 | 高頻度更新＋単一ドキュメント→schedule型。低頻度・明示保存＋複数セット→matching型 |
| immutable／mutable | 作成後不変（録音・画像等）→ongaku型（soft delete）を優先検討。編集され得る→schedule型／matching型を検討 |
| 保存操作の粒度 | アプリ全体で1回の保存か、項目単位・セット単位の保存かで、世代管理の単位（schedule型 vs matching型）が変わる |
| 復元したい単位 | 「直前の全体状態に戻したい」のか「特定の1件だけ戻したい」のかで設計が変わる |
| バイナリ有無 | ArrayBuffer／Blob／base64を含む場合、3世代複製は容量リスクが跳ね上がる。soft delete等の非複製方式を優先検討 |
| 画像／base64有無 | 同上。register-appの商品画像等、localStorageにbase64を保存するアプリは個別評価が必要（11.3節・17章） |
| ストレージ容量リスク | ブラウザのlocalStorage上限（概ね5〜10MB）／IndexedDBの実用上限を踏まえ、`QuotaExceededError`等の失敗シナリオを考慮する（13章） |

---

## 8. IndexedDB helper標準（v2.0で新設）

Phase20-C2（schedule-app）／C5（matching-app）／C6（ongaku-app）で、既存のIndexedDB読み書きヘルパーに共通する信頼性問題が見つかり、修正した。この知見を標準として確定する。

### 8.1 発見された問題

schedule-appの元々の`dbPut`/`dbDel`は`tx.oncomplete`のみを監視し、`tx.onerror`／`tx.onabort`を監視していなかった。そのため、リクエスト自体は成功してもトランザクション全体が後で失敗した場合、Promiseが**永久にpendingのまま**になりうることが、実際に2000msのタイムアウトで再現された（Phase20-C2）。

### 8.2 標準契約

**「すべてresolveする」ことを唯一の標準にしない。** 標準として確定するのは以下の構造要件のみであり、具体的なresolve/reject契約はアプリの既存呼び出し側と整合させる：

1. 成功・失敗の**すべての経路**でPromiseが必ずsettle（resolveまたはreject）すること。settle済みなら以降のイベントは無視する（`settled`フラグ＋`done()`クロージャパターン）
2. `tx.oncomplete`・`tx.onerror`・`tx.onabort`の**3つすべて**を監視すること（`oncomplete`のみは不可）
3. `db.transaction()`呼び出し自体が同期的に例外を投げるケース（`try/catch`で捕捉）も考慮すること
4. Promiseが無限にpendingのままになる経路が存在しないこと

### 8.3 具体的なresolve/reject契約は呼び出し側の既存パターンに合わせる（実装で確認）

| アプリ | 契約 | 理由 |
|---|---|---|
| schedule-app | 失敗時も**常にresolve**（安全なデフォルト値で解決） | 既存の呼び出し箇所に`.catch()`が付いていなかったため、reject契約にすると未処理rejectionを新たに生む。「常にresolve」を選択 |
| matching-app | 同上（常にresolve） | 同様の理由 |
| ongaku-app | 失敗時は**reject**、呼び出し側で`try/catch` | 既存の呼び出し箇所（`saveRecording()`等）は既にreject前提の`try/catch`を実装済みだったため、契約を変える必要がなかった |

**結論**：どちらの契約も「絶対にpendingのまま放置しない」という8.2の構造要件さえ満たしていれば正しい。新しいアプリへ導入する際は、まず既存の呼び出し側コードがどちらの契約を前提にしているかを確認し、それに合わせる。

---

## 9. Import保護標準（v2.0で新設）

matching-app（Phase20-C5a）で確定した原則を、全アプリ共通の標準へ格上げする。

**importで既存ユーザーデータを無確認で上書きしない。** 少なくとも以下の3分類を行う：

| 分類 | 条件 | 挙動 |
|---|---|---|
| A. 競合なし | importデータのid/uuidが既存データと一致しない | そのまま新規データとして追加 |
| B. 同一データ | id/uuidが一致し、かつ内容も一致 | 重複追加しない（スキップ） |
| C. 競合 | id/uuidは一致するが、内容が異なる | **既存データを上書きしない**。importデータを別の新規レコードとして追加する（新しいid/uuidを発行し、名前に「（読み込み）」等のサフィックスを付けて区別する） |

具体的な実装方式（サフィックス文言、比較関数の詳細等）はアプリのデータ構造により個別設計する。**共通なのは「Cのケースで既存データを黙って上書きしてはならない」という原則そのもの。**

---

## 10. soft delete標準（大容量・immutableデータ向け、v2.0で新設）

ongaku-app（Phase20-C6／C7／C7a）で確立した、大容量かつ作成後immutableなデータに対する標準パターン。7.2節C「ongaku型」の詳細版。

### 10.1 最低要件

- `deletedAt`フィールド（タイムスタンプ）を既存レコードに追加するのみで削除を表現する。**audioData等の大容量本体を複製しない**
- `deletedAt`を持つレコードはactive一覧・選択候補から除外する
- 削除直後の**即時Undo**（数秒程度の非モーダルUI）
- 即時Undoの表示時間を過ぎても、**保持期限内であれば復元できるUI**を別途用意する（8秒のUndoバーだけでは「時間単位で保持する」という設計と矛盾するため。Phase20-C7aで確定）
- **reload後も**保持期限内であれば復元可能（`deletedAt`をIndexedDBへ永続化しているため、メモリ上の状態に依存しない）
- 保持期限を**超過したレコードのみ**を物理削除（purge）する
- purgeは**best-effort**とする。purgeの失敗がLayer1（通常の保存・再生等）を妨げてはならない
- **activeレコード（`deletedAt`を持たないレコード）は絶対にpurgeしない**

### 10.2 保持期限の値

ongaku-appでは**24時間**を採用した（実証値）。理由：

- 誤削除に気づく猶予を確保
- ブラウザを閉じてもUndo可能な範囲に収める
- 数分では学校利用中の復旧には短すぎる
- 長期間保持し続ける必要はない

**ただし24時間を全アプリ共通の固定値にはしない。** アプリのデータ特性・利用シーン（学校での利用頻度、1日の中での利用回数等）に応じて、他アプリへ展開する際は個別に妥当な値を検討する。保持期限は必ず定数化し、コード中にマジックナンバーとして埋め込まない。

### 10.3 複数削除への対応

複数レコードを個別にsoft deleteした場合、各レコードの`deletedAt`を個別に管理する。即時Undoの対象を「直近に削除した1件のみ」に限定する単一Undoバー方式を採用してもよいが、その場合も**それ以前にsoft deleteしたレコードは、保持期限内は「最近削除した」一覧から引き続きアクセス可能**でなければならない（直近1件の便利さと、それ以前のレコードへのアクセス手段の両立）。

---

## 11. ⑤ Layer3（共通Exportフォーマット）標準

### 11.1 狙い

`schedule-app.html`のexportJSON()/importJSON()（Phase20-C1で4.2形式に刷新）と、matching-app（Phase20-C5で新設）は、このリポジトリで完成された実例である。これを一般化し、各アプリが同じコードを再実装せずに済むようにする。

このリポジトリには既に「共通コードをgenerate.js側で全アプリへ注入する」実績パターン（共通A11yパネル`buildA11yPanelHTML()`）がある。共通Export/Import基盤も同じアーキテクチャを踏襲する。

### 11.2 共通ヘルパーの役割分担（設計のみ・未実装）

```
generate.js が全アプリへ注入する共通関数（案）
├─ donomanaBuildExport(appId, schemaVersion, data)
│     → 4.2のenvelope形式でJSON化し、Blobダウンロードを実行
│     → ファイル名は "{appId}_{アプリ内で決めた名前}_{日付}.json" 形式に統一
│
└─ donomanaParseImport(fileText, appId)
      → JSONパース → formatVersion/app一致チェック → runMigrations()（5.2）
      → 成功時: { ok:true, data } を返す
      → 失敗時: { ok:false, reason } を返す（例外を投げない）
      → このいずれの場合も、呼び出し元（各アプリ）の既存データには一切触れない
```

- 各アプリ側で用意するのは、`data`の中身の組み立て（export時）と、`applyImportedData(data)`（import成功後にアプリの状態へ反映する処理）のみ。envelope・migration・ファイルI/Oは共通化する。
- import時の競合保護（9章）は`applyImportedData(data)`側の責務とする（アプリのデータ構造に依存するため、共通ヘルパー側では汎用的に扱えない）。
- `app`フィールドの不一致は`donomanaParseImport`側で検出し、`{ok:false, reason:'app-mismatch'}`を返す設計とする（誤操作防止）。

### 11.3 大容量バイナリデータの扱い（v2.0で追加）

**JSONへのbase64包含を、大容量バイナリデータのexport/import標準としない。**

ongaku-appの録音データ（audioData、ArrayBuffer）を11.2のenvelopeへbase64包含すると、容量が約33%増加し、5分録音1件で数MB規模のJSONファイルになることがPhase20-C6の実測で判明した。メモリ使用量・ダウンロード体験の観点から、これは標準として推奨しない。

音声・画像等の大容量バイナリを含むアプリのexport/importは、将来的に以下のような別方式を個別検討する（本文書ではどちらを採用するかまでは確定しない）：

- 個別ファイルダウンロード（`.webm`／`.png`等をJSON包含せず直接ダウンロード）
- ZIP等のアーカイブ形式でJSON（メタデータ）とバイナリ本体を同梱

### 11.4 本v2.0でも行わないこと

- 11.2の共通ヘルパーは依然**設計案**であり、`generate.js`・各アプリHTMLへの実装は行っていない。
- schedule-app／matching-appのexport/importは、11.2の共通関数呼び出しへの置き換えをまだ行っていない（現状は各アプリが個別実装のまま。ただし4.2のenvelope形式自体は両アプリで統一されている）。

---

## 12. 削除保護原則（v2.0で新設）

Phase20-C4／C6での発見（ongaku-appの`deleteRecording()`にconfirm()が存在しなかった）を踏まえ、全アプリ共通の原則として確定する。

**重要なユーザーデータの削除操作には、原則として少なくとも1つ以上の保護を設ける。** 即時・無確認のハード削除は避ける。

保護の例（いずれか、または組み合わせ）：

- `confirm()`（削除前の明示確認）
- soft delete（10章。即座に物理削除しない）
- Undo（削除直後の取り消し操作）
- backup（Layer2／Layer3による事前の複製）

どの保護を選ぶかはデータ特性次第だが、**何も保護がない状態（無確認即時ハード削除）は避ける**。既存アプリの削除処理を横展開時に見直す際は、この原則を満たしているかをまず確認する。

---

## 13. 容量保護原則（v2.0で新設、7.5節を継承・拡張）

- localStorageは1オリジンあたり概ね5〜10MB（ブラウザ依存）の上限がある。
- **base64画像・ArrayBuffer・Blob・大容量録音等を含むデータについて、完全snapshot複製（3世代方式）を自動的に採用しない。** 7.3節「Layer2方式選択基準」に従い、データ特性を評価してから方式を決定する。
- `QuotaExceededError`等の容量超過エラーを考慮する。バックアップ書き込みが容量超過等で失敗した場合、**Layer1（現在データ）の保存を絶対にブロックしない**（8章のIndexedDB helper標準、3.1の最上位原則5と整合）。
- IndexedDB側は実用上の容量上限がlocalStorageよりはるかに大きいため、構造化データのバックアップ（schedule型／matching型）はIndexedDBの既存ストア活用（7.1節）を優先する。
- 大容量バイナリを持つアプリ（ongaku-app等）では、複製ではなくsoft delete（10章）を優先する。

---

## 14. generate.js共通化範囲（v2.0で新設）

将来、共通化候補として整理する（**今回generate.jsは変更しない**）。

### 14.1 共通化候補

- export envelope builder（`donomanaBuildExport`、11.2節）
- import parser（`donomanaParseImport`、11.2節）
- schemaVersion未来バージョン判定（4.5節・5.1節の「自分より未来のバージョンは拒否」ロジック）
- timestamp formatter（`exportedAt`のISO 8601化、「最近削除した録音」の日時表示等、複数アプリで似た実装が発生しやすい）
- snapshot validation骨格（`validateSnapshot()`のような、スナップショットの構造検証の共通部分）
- UUID helper（`crypto.randomUUID()`のラッパー自体は薄いため優先度は低いが、生成タイミングの共通化は検討余地あり）

### 14.2 個別に残す項目

- 保存データ取得（アプリごとの状態オブジェクトの組み立て）
- DB transaction（各アプリのobjectStore構造に依存する）
- snapshot生成条件（schedule型の時間間隔、matching型の保存操作単位など、アプリごとに異なる）
- validation詳細（アプリ内部データの妥当性検証はアプリ固有）
- 復元UI（デザイン・文言はアプリごとの画面構成に依存する）
- soft delete保持期間（10.2節のとおりアプリごとに個別の値を持つ）

---

## 15. A11y横断課題（保存基盤とは分離、v2.0で整理）

Phase20-C1〜C7aで追加した保存基盤系UIは、いずれもSwitch Scan（スイッチスキャン）対応を**今回実装していない**。将来のA11y横断Phaseで対応する課題として記録する。

| アプリ | 対象UI | 状態 |
|---|---|---|
| schedule-app | save-barの書き出し・読み込み・印刷・復元ボタン群 | Switch Scan未対応 |
| matching-app | export・import・復元ボタン群 | Switch Scan未対応 |
| ongaku-app | Undoバー・「最近削除した録音」パネル | Switch Scan未対応 |

これらは保存基盤の正しさとは独立した課題であり、本文書のスコープ外（generate.js側のSwitch Scan共通基盤の課題）として扱う。

---

## 16. Version2.0への影響まとめ（更新）

| 観点 | 現状（Version1系、Phase20-A時点） | Version2.0（Phase20-C7a時点、確定） |
|---|---|---|
| schemaVersion | 概念なし | schedule-app／matching-app／ongaku-appの3アプリに内部定数として導入済み。全アプリ共通の3分割バージョン体系（4章）は設計確定・3アプリで実証済み |
| migration | 皆無 | 冪等・多段対応のmigrationランナー設計は確定（5章）。v1→v2の変換（envelope化＋uuid追加）はschedule-appで個別実装済み。汎用ランナー自体は未実装 |
| ID体系 | Date.now()+Math.random()系が主流、UUID未使用 | IndexedDB3アプリでUUIDフィールドを追加方式で導入済み（6章）。既存IDは置き換えていない |
| Layer2（世代バックアップ） | schedule-appのみexport/importあり、他は片道CSVのみか皆無 | schedule型・matching型の2パターンを実装・公開済み（7章）。**新設objectStoreではなく既存ストア活用**という実装知見を反映 |
| soft delete（大容量向け） | 概念なし | ongaku-appで実装・公開済み（10章）。3世代複製をそのまま適用しない代替パターンとして確立 |
| IndexedDB helper信頼性 | tx.oncompleteのみ監視（無限pendingリスクあり） | tx.oncomplete/onerror/onabort全監視＋同期例外考慮の標準を確定・3アプリに適用済み（8章） |
| Import保護 | 無条件上書き | 3分類（競合なし／同一／競合）による非破壊import原則を確定（9章） |
| 削除保護 | アプリにより有無がまちまち（ongaku-appは無保護だった） | 「最低1つ以上の保護」原則を確定（12章） |
| export/import実装 | アプリごとに個別実装 | schedule-app／matching-appは4.2形式へ統一済み。generate.js側共通ヘルパー案（11章）は未実装 |
| 既存データへの影響 | — | schedule-app／matching-app／ongaku-appの3アプリでは実装済み（公開commit: `ed540e0`／`3cbdbf3`／`403ec9b`）。**残り26アプリへのコード変更はゼロ** |

---

## 17. 残りアプリへの展開判断（簡易マッピング、v2.0で新設）

29アプリ全てへ機械的に保存基盤を追加しない。Phase20-Aの調査を再利用しつつ、Phase20-C8時点でストレージ利用状況を再確認し（`localStorage`/`indexedDB.open`呼び出しのgrepベース）、以下の簡易マッピング案を作成した。**コード変更は行っていない。**

> 本マッピングは grep レベルの再調査に基づく**一次分類の叩き台**であり、各アプリの実データ構造まで精査したものではない。実際に着手する際は、着手対象アプリごとに7.3節の選択基準で個別評価すること。

### 17.1 実装済み（参照実装）

| アプリ | 分類 | 状態 |
|---|---|---|
| schedule-app | schedule型 | 実装・公開済み |
| matching-app | matching型 | 実装・公開済み |
| ongaku-app | ongaku型（soft delete） | 実装・公開済み |

### 17.2 追加対応の要否が個別評価待ち（候補）

base64画像／Canvas保存を持ち、ユーザー作成コンテンツの消失リスクが相対的に高いと見られるアプリ。ongaku型（soft delete等の非複製方式）または個別設計を優先候補とする：

| アプリ | 根拠（grepベース） |
|---|---|
| register-app | base64/canvas系コードあり。v1.0の7.5節で既に「商品画像の扱いは個別検討」と記載されていた未決定事項（現在の20章へ引き継ぎ） |
| drawing-app | base64/canvas系コードが複数箇所 |
| kimochi-board | base64/canvas系コードが複数箇所 |
| nazori-app | base64/canvas系コードが複数箇所、confirm()使用あり（既存の削除保護は一部存在） |
| sugoroku-app | base64/canvas系コードあり、confirm()使用あり |
| sst-app | localStorage呼び出し件数が39件と他アプリ比で突出。状態が複雑な可能性があり、着手時は個別調査を優先 |

### 17.3 現時点で追加対応不要と見られるアプリ（候補）

設定値・スコア・進捗等、構造化された「ユーザー作成コンテンツ」を持たないか、消失時の影響が限定的と見られるアプリ。現時点では12章の削除保護原則（confirm等の軽量な保護）の充足確認のみで足り、Layer2規模の保存基盤は不要と考えられる：

hiragana-learn／katakana-app／nazorin-print／janken-app／shiritori2／okane-app／tokei-app／timetable-app／yomikaki-app／bosai-app／tyushi／cup_game／slideshow-sakusei／directions-app／time-timer／suji-manabou／kyou-no-kiroku／scratch-app／gaze-keyboard／mogura-tataki

（上記は一次分類であり、着手前に個別確認を推奨する）

### 17.4 孤立ファイル

`switch-training-app.html`等、`apps-data.json`に未リンクの孤立ファイル6件について、本仕様書の対象に含めるかどうかはPhase20-Aから引き続き未回答（20章）。

---

## 18. Version2.0公開前必須／Version2.xへの持ち越し判断（v2.0で新設）

### 18.1 本文書がPhase20-C8時点で確定していること

- schemaVersion・UUID・IndexedDB helper・soft deleteの各標準（4〜10章）
- schedule型／matching型／ongaku型の3パターンと選択基準（7章）
- Import保護・削除保護の原則（9章・12章）
- schedule-app／matching-app／ongaku-appの3アプリでの実装・公開・実機回帰確認

### 18.2 Version2.0公開前に必須ではない項目（Version2.xへ持ち越し可）

- 残り26アプリへの保存基盤展開（17章のマッピングは叩き台であり、全アプリ完了を待つ必要はない）
- generate.js共通ヘルパー実装（11章・14章、設計のみ確定）
- migrationランナーの実装（5.2節、疑似コードのみ確定。実際にv2以降が必要になるまで実装不要）
- Layer3の大容量バイナリ対応（11.3節、方式未確定のまま）
- Switch Scan横断対応（15章）
- 孤立ファイル6件の扱い（17.4節）

**「残り19アプリ（Phase20-A時点でLevel2以上とされたアプリ数の目安）全てへ大規模実装しなければトップページ改善へ進めない」という前提は採用しない。**

### 18.3 トップページ改善（検索・カテゴリ等）へ進む条件

以下の3条件を満たした時点で、保存基盤の残作業と並行してトップページ改善へ進んでよいと判断する：

1. IndexedDB使用アプリ（データ消失時の影響が大きいと判断された3アプリ）が保護済みであること（**Phase20-C7a時点で充足**）
2. 新たに無保護のハード削除処理（12章の削除保護原則に反する実装）が追加されていないこと
3. 実際のユーザーからのデータ消失報告が無いこと

上記3条件は**Phase20-C7a時点で満たされている**。したがって、保存基盤の残作業（17章のマッピング対象アプリへの個別展開）と、トップページ・検索・カテゴリ等の改善は、どちらを先に着手してもよい。

---

## 19. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-08 | 初版起草（Phase20-B）。Phase20-Aの調査結果を根拠に、schemaVersion・migration・UUID・Layer2バックアップ・共通Exportフォーマットの設計案を確定。未承認・未実装 |
| v2.0 | 2026-08-08 | Phase20-C1〜C7aの実装・公開・実機回帰確認結果を反映して確定（Phase20-C8）。主な変更：①最上位原則（データ特性に応じた方式選択）を明文化、②Layer2は新設objectStoreではなく既存ストア活用へ訂正、③schedule型／matching型／ongaku型の3パターンとLayer2選択基準を新設、④IndexedDB helper標準・Import保護標準・soft delete標準・削除保護原則を新設、⑤Layer3の大容量バイナリ扱い方針を追加、⑥generate.js共通化範囲・A11y横断課題・残りアプリへの簡易マッピング・Version2.0公開前後の切り分けを追加 |

---

## 20. 未決定事項（将来Phaseで確定）

- Layer2ローテーションの発火間隔について、schedule型は5分の実測値を採用したが、他アプリへ展開する際の妥当な間隔は個別評価が必要
- soft delete保持期限について、ongaku-appは24時間を採用したが、他アプリへ展開する際の妥当な値は個別評価が必要（10.2節）
- Layer3（明示export）の、大容量バイナリを含むアプリ向けの具体的な代替方式（個別ファイルダウンロード／ZIP等、11.3節）
- register-app・drawing-app・kimochi-board・nazori-app・sugoroku-app・sst-appなど、17.2節で「個別評価待ち」とした候補アプリの、実際のLayer2方式選定（着手時期は未定）
- generate.js共通ヘルパー（11章・14章）の実装時期
- migrate(v2→v3)の具体的な変更内容（5.4節で型のみ提示）
- `switch-training-app.html`等、apps-data.jsonに未リンクの孤立ファイル6件を本仕様書の対象に含めるかどうか（Phase20-Aで報告済み、未回答）
