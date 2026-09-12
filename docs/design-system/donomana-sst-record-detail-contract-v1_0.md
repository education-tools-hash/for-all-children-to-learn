# どのまな SST Learning Record Detail Contract（Version 1.0）

- **Status: FINAL DESIGN CONTRACT v1.0**
- **Implementation: NOT YET IMPLEMENTED**
- 発行: 2026年9月（Phase SST-RECORD-DETAIL-DESIGN-1 draft → Phase SST-RECORD-DETAIL-DESIGN-FINALIZE-1で確定）
- 位置づけ: **本仕様は既存Learning Record Foundation標準を拡張するSST固有の詳細記録仕様であり、既存標準を置き換えるものではない。** `donomana-learning-record-standard-v1_0.md`（Core Schema・Storage・Foundation API）と`donomana-learning-record-ui-standard-v1_0.md`（Viewer・CSV・Delete・Accessibility）を継承し、両Standardが未整備のまま残していた「教材が提示した内容・利用者が選んだ内容そのもののsnapshot記録」という領域のみを、sst-app固有のoptional extensionとして定義する。両Standard自体はいずれも変更しない。
- 契機: 実ユーザーからの要望「各実施項目の記録について、日付、項目など記録できることはありがたい。その上でもし可能であれば、ロールプレイでの選択肢と選択した回答の記録までできると尚ありがたい。」
- 承認状態: **User Design Reviewを経て、本文書内の14 Decisionを正式確定した（Decision 1〜14、§9以降）。** ただし確定は設計のみであり、実装Approvalは別途必要（§40「Implementation Approval」参照）。
- 変更ファイル: 本ドキュメントのみ。`sst-app.html`・`kyou-no-kiroku.html`・`generate.js`・Foundation API・localStorage schema・CSV・学習記録画面・Viewer・recordActivity()のいずれも本Phaseで変更していない（Production機能コード変更 0件）。

---

## 0. 関連文書（Source of Truth）

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | Core Schema・Storage・Foundation API（13関数）・Privacy原則の正本。本契約はこれを継承し、置き換えない |
| `donomana-learning-record-ui-standard-v1_0.md` | Viewer/CSV/Delete/Accessibility方針の正本。「Common Viewerは作らない」という確定方針を本契約でも踏襲する |
| 本文書 | sst-app固有のRecord Detail（選択肢snapshot等）extension。両Standardが定義していない領域のみを扱う |

---

## 1. 現状Record Architecture（実コード調査結果、Phase DESIGN-1で確認済み・本Phaseで再検証）

sst-appは既に**Phase T5-E-CでLearning Record Foundationへ統合済み**（`donomana-learning-record-standard-v1_0.md` §34）。現在の実データ形式（`sst-app.html:6442-6492`、無変更）:

```js
const ACTIVITY_LOG_KEY = 'sst_activity_log_v1';   // localStorage key

function recordActivity(type, lv, result){
  activityLog.push({ ts: Date.now(), type, lv: lv||0, result: result||'done', schemaVersion: 1 });
  saveActivityLog();   // 30日retention、donomanaRecordWriteLog()へ委譲
}
```

Record schema（現状、変更なし）:

```js
{ ts: 1757659200000, type: 'rp', lv: 1, result: 'best', schemaVersion: 1 }
```

- **timestamp**: epoch ms数値（他Foundationアプリの多くはISO 8601文字列だが、sst-appは既存実装のまま。Standard §5の「既存アプリの実データ形式は変更しない」原則により許容済み）
- **Viewer/CSV**: `activityLog`個々のrecordを一覧表示・出力するUIは現状**存在しない**（`buildReport()`による週次サマリー表示のみ）
- **既存consumer**: `buildReport()`・`saveActivityLog()`・`loadActivityLog()`のみが`activityLog`を参照し、いずれも`a.ts`/`a.type`/`a.lv`/`a.result`という既知4フィールドだけを読む。**未知の追加フィールド（`detail`等）を読んでもエラーにならず、単に無視される**ことをコードで確認済み（§26のschemaVersion決定の根拠）。

---

## 2. Baseline / Drift Gate（本Phase実施）

| 確認項目 | 結果 |
|---|---|
| design worktree HEAD（開始時） | `f975346` |
| working tree | clean |
| origin/main | `239ee3d`（前Phaseから変化なし、drift 0） |
| Production側（Learning Record Foundation / recordActivity / SST / kyou-no-kiroku / CSV / localStorage）への変更 | 0件 |

Driftなし。再調査不要のため、そのまま本Phaseの決定確定作業へ進んだ。

---

## 3. SST Record Detail対象活動 — 正式11活動

前Phase調査で、ユーザー提示の10モードに加え、Production上に既存する「きもちを落ち着ける（呼吸）」を発見した。これを含め、**正式に11活動**として整理する。

| # | 正式日本語名 | 内部mode/type ID | 画面ID | 現状記録有無 |
|---|---|---|---|---|
| 1 | ことばクイズ | `wq` | `s-word` | あり（完了時1回のみ） |
| 2 | SSTクイズ | `quiz` | `s-quiz` | あり（完了時1回のみ） |
| 3 | ソーシャルストーリー | `story` | `s-story-list`等 | あり（完了時1回のみ） |
| 4 | 分岐ストーリー | `branch` | `s-branch-list`/`s-branch` | あり（エンディング到達時1回） |
| 5 | ロールプレイ（built-in） | `rp` | `s-scene-list`/`s-rp` | あり（選択直後1回） |
| 6 | ロールプレイ（custom） | `rp`（`currentLv==='custom'`で判別） | 同上 | あり（built-inと同一経路） |
| 7 | 写真で練習 | `photo` | `s-photo`/`s-photo-play` | あり（選択直後1回） |
| 8 | 感情カード | （現状typeなし） | `s-emotion` | **なし** |
| 9 | きもち温度計 | `thermo` | `s-thermo` | あり（値確定時） |
| 10 | フレーズ集 | （現状typeなし） | `s-phrase` | **なし** |
| 11 | きもちを落ち着ける（呼吸） | `breath` | `s-breath` | あり（画面表示1秒後、固定`'done'`） |

**呼吸活動の正式mode ID**: Production実コード（`sst-app.html:6458`の`ACT_LABEL`、`:2654`のホームカード、`:5269`の記録呼び出し）を確認し、内部typeは`'breath'`、正式表示名は`'きもちを落ち着ける'`（ホームカードでは補足として「呼吸・リラックス」）であることを確認した。「breathing」という独自命名は行わず、既存の`'breath'`をそのまま正式IDとして採用する。

---

## 4. Decision 1 — クイズ系（ことばクイズ・SSTクイズ・ソーシャルストーリー）の記録タイミング

**正式決定: Foundation実装／Roleplay Pilot段階では、この3モードの既存record timingを変更しない。**

既存の「完了時1回・スコア/完了サマリーのみ」というsemanticsを維持する。問題ごとのchoice-level detail記録を追加するかどうかは、本契約のスコープ外とし、**別Phase（§32のPhase E「SST-RECORD-DETAIL-CHOICE-MODES-1」）で改めて判断する**。

理由:
- regression範囲をFoundation拡張とRoleplay Pilotに限定できる
- 記録タイミングの変更（完了時→問題ごと）は既存呼び出し粒度そのものを変える大きな変更であり、Foundation自体の検証と同時に行うとPilotの切り分けが困難になる
- Pilotが単純であるほど、問題発生時のrollbackが容易

---

## 5. Decision 2 — 感情カード

**正式決定: 感情カードは将来のRecord Detail対象に含める。**

- **Trigger**: カードが明示的に選択された時（`showED(i)`実行時）。画面を開いただけ（`buildEmotions()`実行時）では記録しない。
- **Record semantics**: 「このカードが選択された」という操作事実のみを記録する。「実際にこの感情だった」「診断結果」「正しい感情」として扱うことは禁止する（`donomana-learning-record-standard-v1_0.md` §2の「観察可能な行動のみ記録する」原則を直接継承）。
- **detail候補**:
  ```js
  detail: {
    detailSchemaVersion: 1,
    type: 'emotion_selection',
    selected: { label: 'うれしい', face: '😊' }   // EMOTIONS[i].name/face のsnapshot。安定数値idが無いためlabelを主キーとする
  }
  ```
- 実装Phaseは§32のPhase F。本Phaseでは設計のみ確定し、実装は行わない。

---

## 6. Decision 3 — フレーズ集

**正式決定: フレーズ集も将来のRecord Detail対象に含める。ただし閲覧だけでは記録しない。**

- **Trigger**: A. TTSを実行した時（`speakPhrase()`）、B. コピーを実行した時（`copyPhrase()`）のみ。カテゴリを開いた・フレーズを眺めただけでは記録しない。
- **理由**: 大量の低価値recordの生成を防止する（39フレーズ×閲覧のたびに記録すると件数が急増し、§28の容量試算を悪化させる）。
- **detail候補**:
  ```js
  detail: {
    detailSchemaVersion: 1,
    type: 'phrase_action',
    category: 'help',                 // PHRASESのカテゴリキー
    phrase: '先生、ちょっといいですか？', // 実行対象フレーズのsnapshot
    action: 'spoken'                  // 'spoken' | 'copied'
  }
  ```
- 実装Phaseは§32のPhase F。

---

## 7. Decision 4 — ロールプレイ custom のPrivacy

**正式決定: 第一Pilotはbuilt-in Roleplayのみを対象とする。custom Roleplayは今回のPilot対象から除外し、`Deferred pending Privacy Review`として正式記録する。**

理由: custom scenario（`teacherCustomScenes`）は教員による自由記述であり、以下が入力される可能性を排除できない。

- 生徒名
- 個別の出来事
- 家庭状況
- 対人トラブル
- その他の個人情報

端末内保存であっても、CSV export等により外部へ持ち出される可能性がある文言をsnapshotとして半永久的に複写することは、built-in scenario（開発側が用意した固定文言）とは異なるPrivacyリスクを持つ。したがって、custom Roleplayへの本Detail契約適用は、**別途のPrivacy Review（§32のPhase G「SST-RECORD-DETAIL-CUSTOM-PRIVACY-1」）を経るまで実施しない。**

built-in Pilot（Phase B）はこの決定の影響を受けない。`currentLv==='custom'`判定によりPilot実装時点でcustomケースを明示的に除外する。

---

## 8. Decision 5 — 学習記録画面

**正式決定: 新しい独立した記録ページを第一案にはしない。既存の学習記録導線（sst-appの週次レポート`buildReport()`/`s-report`画面）へ、summary + detail disclosureを追加する方式を採る。**

理由: `donomana-learning-record-ui-standard-v1_0.md` §5で確立済みの「独立record-viewer.htmlは不採用（既存UXから利用者を切り離すため）」という既存方針と一致する。sst-appに既存の記録関連画面がある以上、そこを拡張するのが既存資産を活かす方向である。

UI concept（実データから作成、Progressive Disclosure）:

```
2026/09/12 10:32
ロールプレイ
「はじめてのあいさつ」

選んだ回答：
「こんにちは！ぼく（わたし）は〇〇です。よろしくね！」

［詳細を見る］
```

展開後:

```
提示された選択肢：
① 「こんにちは！ぼく（わたし）は〇〇です。よろしくね！」
② 「こんにちは…よろしくお願いします」と小さな声で言う
③ 「こんにちは」とだけ言う

教材内区分： best
```

### 8.1 Accessibility Contract（実装時必須要件、本Phaseでは要件固定のみ）

- `［詳細を見る］`は`<button>`native要素
- `aria-expanded`を展開状態と同期。折りたたみ対象領域が別要素IDを持つ場合は`aria-controls`も付与
- キーボード: Enter・Spaceで開閉、フォーカスはトグルボタン自身に残す（詳細領域へ強制移動しない）
- Shift+Tabによる逆順移動でfocus trapが発生しない
- Switch Scan: sst-appの既存Switch Scan戦略（実装Phase開始前に個別確認）に準拠
- screen reader: 状態変化は`aria-expanded`で表現。過剰な`aria-live`通知は追加しない
- 色だけに依存しない（教材内区分の表示は既存のicon/label併用パターンを踏襲）

---

## 9. Decision 6 — 呼吸活動の正式contract化

§3で確認した通り、呼吸活動（`type:'breath'`）を正式11活動の1つとして含める。

**Record semantics**: 操作事実のみを記録する。

```js
detail: {
  detailSchemaVersion: 1,
  type: 'breathing_activity',
  activityTitle: 'きもちを落ち着ける',
  completionStatus: 'done'   // 既存resultと同じ固定値。客観的に確認できる情報のみ
}
```

**保存しない**: 「落ち着けた」「怒りが下がった」「不安が減った」「気持ちが改善した」等の心理的結果。既存実装にはそもそも心理的効果を測定する仕組みが無く（画面表示から1秒後に固定で`'done'`を記録するのみ）、推測による記録を新設しないという既存原則（Standard §5）をそのまま適用する。

---

## 10. Decision 7 — Snapshot Policy（確定）

**正式決定: IDがある場合は「ID + snapshot text」、IDがない場合は「snapshot text」を保存する。IDのみの保存は禁止する。**

前Phase調査で、10モード中4モード（ことばクイズ・SSTクイズ・ソーシャルストーリー・ロールプレイbuilt-in）のみが安定した問題/場面ID・選択肢IDを持ち、残り（分岐ストーリー・ロールプレイcustom・写真で練習・感情カード・フレーズ集）には安定IDが存在しないことを実コードで確認済み。この事実により「ID専用設計」は成立しないため、**全モード共通でtext snapshotを主とし、IDが存在するモードでは付加的に含める**という設計を確定する。

**理由**: 教材文言が将来変更・削除されても、過去recordから「その時実際に何が表示されていたか」を復元できることを最優先する。

**snapshot対象（必要に応じて）**: activity title / scenario title / prompt（situation） / displayed choices / selected choice / relevant label / selected value label / phrase text / emotion label。

**保存しないもの（確定、§23記載事項を継承）**:

| 除外対象 | 理由 |
|---|---|
| 写真のbase64データ | record肥大化の主因 |
| DOM全体・生成HTML・CSS | 記録の対象ではない |
| フォーカス位置・スキャンカーソル位置 | 一時的なUI状態、input method非依存原則に反する |
| speech utteranceオブジェクト・アニメーション状態 | 一時的なUI状態 |
| feedback文言（fb）そのもの | `level`があれば十分。診断的文言を固定化する必要がない |
| きもち日記の自由記述内容 | 既存Standard §34.6で意図的にスコープ外化された領域を継続して踏襲 |

---

## 11. Decision 8 — Common Schema（確定）

既存Learning Record Foundation schemaを**維持する**。

```js
{
  ts,            // 既存のまま(epoch ms数値、sst-app既存実装)
  type,          // 既存のまま
  lv,            // 既存のまま
  result,        // 既存のまま
  schemaVersion, // 既存のまま(現行1)
  detail         // 新規・任意フィールド(本契約で追加)
}
```

`detail`はoptionalであり、欠落時は完全なlegacy recordとして扱われる。

---

## 12. Decision 8-2 — schemaVersion最終判断（確定）

### 12.1 既存consumerの後方互換性確認（本Phaseで再確認）

`buildReport()`・`saveActivityLog()`・`loadActivityLog()`・`donomanaRecordReadLog`/`WriteLog`/`NormalizeLegacy`のいずれも、`activityLog`の各要素から`ts`/`type`/`lv`/`result`のみを読み取り、それ以外のフィールドを列挙・検証する処理を持たない。JSON配列としての読み書き（`JSON.parse`/`JSON.stringify`）は未知フィールドを保持したまま素通しする。**したがって`detail`という新規フィールドを追加しても、既存reader/consumerはこれを単純に無視し、例外も動作変化も発生しない**ことをコード確認により再確認した。

### 12.2 決定

**トップレベル`schemaVersion`は現行の`1`のまま変更しない（バージョンbumpしない）。** 理由: `donomana-learning-record-standard-v1_0.md` §10は「新規recordには`schemaVersion`を必須化する」「legacy recordはlegacy v1として読み込み可能にする」ことを求めているが、フィールドの**追加**自体をversion bumpの契機とする規定は無い。既存Foundationの`donomanaRecordNormalizeLegacy()`も「`schemaVersion`欠落時のみ`1`を補完し、既存フィールドは書き換えない」という後方互換第一の設計思想であり、この思想と整合させるため、後方互換なフィールド追加ではバージョンを上げない。

**`detail`オブジェクト内部には独立した`detailSchemaVersion`を新設する。** 理由: `detail`の内部構造（`choices[]`の形など）は将来sst-app固有の判断で進化しうるため、トップレベルschemaVersionとは独立して管理する。`detail`が存在するがバージョンが読み取れない/不正な場合は、**表示側で`detail`ごと無視し、従来通りの要約表示にフォールバックする**（トップレベルの必須情報ではなく表示補助情報であるため、無理な補完をしない）。

---

## 13. Decision 9 — Record粒度（確定：Event-based）

**正式決定: Event-based（1つの意味ある操作 = 1 record）を採用する。**

Session-based（`detail.events[]`への蓄積）は不採用とする。

**採用しない理由**:
- 既存Foundationがそもそもevent指向（`recordActivity()`は既に「1つの意思決定 = 1回の呼び出し」という粒度で統一されている）
- CSVのflatten化が容易（1行=1記録という単純な対応を保てる）
- 時系列追跡が容易
- 途中離脱（partial session）でも既に記録された分は残る
- Pilotの実装・検証が単純
- migrationが不要（既存の呼び出し粒度を変えない）

**分岐ストーリーの扱い（既存の例外パターンを維持）**: エンディング到達時1回のみの記録は変更しない。その1回のrecordの`detail`に、既に実行時に計算済みの`currentBranchPath`（選択テキストの配列）を`route`としてそのまま含める。「1選択=1record」への変更ではなく、「1エンディング到達=1record、その中にroute全体を含める」という、既存記録タイミングを保ったままのEvent-based設計として扱う。

---

## 14. Decision 10 — Roleplay Pilot Contract（確定、第一Pilot）

**対象: built-in Roleplayのみ**（custom Roleplayは§7のDecision 4によりDeferred）。

選定理由（前Phase調査の再確認）:
- 実ユーザー要望と直接一致
- scenario構造が明確（3択、固定）
- 安定ID（scene id・choice id）が存在する唯一の選択肢構造モード
- snapshot + ID両方を無理なく保存できる
- custom Privacy問題を回避できる

### 14.1 Trigger

**ユーザーがchoiceを確定した時**（`answerRP(ci, sceneIdx)`内部）。UI layerの複数箇所（結果画面描画・確認モーダル等）から分散して記録せず、**choice確定ロジックの単一箇所からのみ記録する**（§18 Duplicate Preventionと直結）。

### 14.2 Detail Schema（確定、Production実データ構造に基づく命名）

```js
detail: {
  detailSchemaVersion: 1,
  type: 'roleplay_choice',
  scenario: {
    id: 'rp_1_01',                 // SCENES[currentLv][idx].id
    title: 'はじめてのあいさつ',        // SCENES[currentLv][idx].title
    situation: 'はじめて会う〇〇さんがいます。どう声をかけますか？'   // .sit（任意フィールド）
  },
  choices: [
    { id: 'c1', text: '「こんにちは！ぼく（わたし）は〇〇です。よろしくね！」', level: 'best' },
    { id: 'c2', text: '「こんにちは…よろしくお願いします」と小さな声で言う',   level: 'good' },
    { id: 'c3', text: '「こんにちは」とだけ言う',                             level: 'try'  }
  ],
  selected: { id: 'c1', text: '「こんにちは！ぼく（わたし）は〇〇です。よろしくね！」', level: 'best' },
  custom: false
}
```

上記は`sst-app.html`の`SCENES[1][0]`（`rp_1_01`「はじめてのあいさつ」）という**実在するbuilt-inデータ**をそのまま用いた例であり、架空データではない。

- `scenario.id`/`choices[].id`は`SCENES`データの既存`id`フィールドをそのまま複写する（新規ID体系は発明しない）
- `choices[]`は表示順（シャッフル後、`rpShuffled`）のsnapshotとする
- `custom`は`currentLv==='custom'`かどうかの真偽値。Pilot対象は`false`固定ケースのみ

### 14.3 presented choices contract（§33、ユーザー要望の中核）

3件すべての選択肢について、以下を保存する。

- ID（`c1`/`c2`/`c3`）
- text snapshot（選択肢文言そのもの）
- level/tier（`'best'`/`'good'`/`'try'`）

### 14.4 selected choice contract

最低限、以下を保存する。

- selected choice ID
- selected text snapshot
- selected level/tier

### 14.5 「教材内区分」表現（確定）

Record UI・CSVでは「正解」「不正解」「間違い」を使わない。以下を正式語彙として採用する。

- 「選んだ回答」（selected.text相当）
- 「提示された選択肢」（choices[]相当）
- 「教材内区分」（level/tier相当）

---

## 15. Decision 11 — CSV Contract（確定）

現状`activityLog`にはCSV機能自体が存在しないため、本節は新規機能の設計提案である。

### 15.1 列構成（Roleplay Pilot最低列）

| 列名 | 内容 |
|---|---|
| 日時 | `donomanaRecordFormatCsvDateTime()`相当（epoch ms対応済み、Excel互換） |
| 教材 | `ACT_LABEL[type].name` |
| モード | `type`（内部ID、教員向けには教材名列で十分なため補助的） |
| 場面 | `scenario.title` |
| 提示された選択肢 | `choices[]`を1セルへflatten（下記15.2） |
| 選んだ回答 | `selected.text` |
| 教材内区分 | `selected.level` |

### 15.2 choices flatten方式

```
①「こんにちは！...よろしくね！」｜②「こんにちは…よろしくお願いします」...｜③「こんにちは」とだけ言う
```

区切り文字・エスケープは既存Foundation CSV helper（`donomanaRecordBuildCsv(rows)`、BOM付き・カンマ/改行/ダブルクォートエスケープ実装済み）にそのまま委ねる。新規CSVエスケープ実装を書き起こさない。

### 15.3 legacy compatibility

`detail`を持たないlegacy recordは、「提示された選択肢」「選んだ回答」「教材内区分」列を**空欄**として出力する（存在しないデータを推測で埋めない）。legacy recordのexport自体を妨げない。

### 15.4 detail JSON列（任意、補助的）

生JSONを1列として併記する案は許容するが、**JSON列だけを教員向けCSVの唯一の詳細表現にしてはならない**。人間可読な列（15.1）を必ず主とする。

---

## 16. Decision 12 — Duplicate Prevention（確定）

**正式方針: input methodごとに`recordActivity()`を呼び分けない。**

禁止パターン:
```
mouse handler   → record
keyboard handler → record
switch handler   → record
gaze handler     → record
```

**正式パターン: 最終choice確定関数（例: `answerRP()`）という単一地点からのみ記録する。** mouse/keyboard/Switch Scan/gazeのいずれの入力であっても、最終的に同じ確定関数を通る既存実装（`onclick="answerRP(...)"`がキーボード操作時もEnterキー由来のclickイベントとして同じハンドラに到達する、という既存のnative button活性化の仕組み）を前提とすることで、構造的に二重記録が発生しない。新しい並行記録API（例: `recordActivityDetail()`のような別関数）は追加しない。

### 16.1 Input Method Independence（確定）

Record schemaは入力方式に依存しない。同じchoiceをmouse/keyboard/switch/gazeのいずれで選んでも、生成される`detail`構造は完全に同一とする。**`inputMethod`フィールドを新設のdetailへ追加しない**方針を基本とする（sst-appには入力方式判別コードが存在しないため、既存のStandard §5「推測禁止」原則を踏襲）。将来sst-appに入力方式判別が実装され、既存Foundationの`inputMethod`規約（`"touch"|"gaze"|"switch"|"keyboard"|"click"|null`）に従う場合は、その既存仕様を尊重する。

---

## 17. Decision 13 — Backward Compatibility（確定）

| ケース | 動作 |
|---|---|
| legacy record（`detail`なし） | 読み込み可能。既存`buildReport()`は無変更で動作継続 |
| new record（`detail`あり） | `ts/type/lv/result`は従来通り読める。`detail`は新Viewer/CSV実装後にのみ利用される |
| mixed（同一`activityLog`内に新旧混在） | 個々のrecordに`detail`があるか無いかで判定するのみ。配列全体の一括判定は不要 |

**Migration: 原則不要。** 既存recordを書き換えない。既存recordへ後付けで擬似`detail`を生成することもしない（当時実際に提示された内容が分からない以上、擬似データで埋めることは事実の捏造になるため）。

---

## 18. Storage / Retention / Privacy（確定、前Phase試算を維持）

### 18.1 容量試算

| record 1件サイズ | 100件 | 1,000件 | 10,000件 |
|---|---|---|---|
| 現行（detailなし、約116 bytes） | 11.6 KB | 116 KB | 1.16 MB |
| detail込み（約370〜470 bytes） | 37〜47 KB | 370〜470 KB | 3.7〜4.7 MB |

既存30日retention（`saveActivityLog()`）は**今回変更しない**。

### 18.2 localStorage限界についての注記

ブラウザ・端末ごとにquotaの実測差があるため、「必ず5MB使える」等の断定はしない。Pilot実装後に実機で実測する方針とする（本契約では設計上の目安として上記試算を提示するに留める）。

### 18.3 Privacy

- 新規PII（生徒氏名・student ID・school ID・account情報）は追加しない
- 外部analytics・cloud syncは追加しない
- 端末内保存・外部無断送信なしという既存原則を維持
- custom RPの自由記述文言は§7（Decision 4）により別途Privacy Reviewまで対象外

---

## 19. Record Semantics（確定、全モード共通原則）

Recordは、**「利用者が何を選択・実行したか」という操作事実を記録する。** Record自体から以下を自動推定しない：

- 理解度
- 能力
- 感情状態
- 成功／失敗の断定
- 診断結果

Viewer・CSVは、授業振り返り・指導検討・学習経過確認のための材料であり、**自動評価結果ではない**（`donomana-learning-record-standard-v1_0.md` §2の既存原則をSST全11活動へ一貫して適用する）。

---

## 20. Schema Examples（実データ・実構造ベース、架空データなし）

### 20.1 Legacy record（現状のまま、変更なし）

```js
{ ts: 1757650000000, type: 'quiz', lv: 2, result: '80%', schemaVersion: 1 }
```

### 20.2 Roleplay detail record（built-in、実データ`rp_1_01`使用）

§14.2参照。

### 20.3 Emotion selection（提案、実データ`EMOTIONS`使用）

```js
{
  ts: 1757650000000, type: 'emotion', lv: 0, result: 'うれしい', schemaVersion: 1,
  detail: { detailSchemaVersion: 1, type: 'emotion_selection', selected: { label: 'うれしい', face: '😊' } }
}
```

### 20.4 Thermometer selection（既存recordのまま、detail拡張は不要と判断）

```js
{ ts: 1757650000000, type: 'thermo', lv: 0, result: '6', schemaVersion: 1 }
```

きもち温度計は選択肢という概念を持たず、既存の`result`（値そのもの）で用が足りるため、`detail`拡張の対象外とする（前Phase判断を維持）。

### 20.5 Phrase action（提案、実データ`PHRASES.help`使用）

```js
{
  ts: 1757650000000, type: 'phrase', lv: 0, result: 'spoken', schemaVersion: 1,
  detail: { detailSchemaVersion: 1, type: 'phrase_action', category: 'help', phrase: '先生、ちょっといいですか？', action: 'spoken' }
}
```

### 20.6 Breathing activity（提案）

```js
{
  ts: 1757650000000, type: 'breath', lv: 0, result: 'done', schemaVersion: 1,
  detail: { detailSchemaVersion: 1, type: 'breathing_activity', activityTitle: 'きもちを落ち着ける', completionStatus: 'done' }
}
```

---

## 21. Test Contract

### 21.1 Foundation Test Contract（Phase A対象）

1. legacy record保存
2. legacy record読込
3. new detail record保存
4. new detail record読込
5. mixed records（legacy + new混在）
6. `detail`欠落ケース
7. `detail`存在ケース
8. 未知のoptional detailフィールドを安全に無視できること
9. reload後の永続化
10. 既存30日retentionが`detail`込みrecordにも正しく適用されること
11. `buildReport()`週次サマリーが無変更で動作すること
12. 既存CSV機能（`downloadDiaryCSV()`等、activityLogとは無関係な既存機能）に回帰がないこと
13. delete系（該当する場合）
14. 不正なJSON/malformed dataでも例外を投げず安全にフォールバックすること
15. undefined/nullが記録に混入しないこと
16. 既存9箇所の`recordActivity()`呼び出し全てに回帰がないこと

### 21.2 Roleplay Pilot Test Contract（Phase B対象）

1. マウスでのchoice選択 → record 1件
2. キーボードでのchoice選択 → record 1件
3. Switch Scanでのchoice選択 → record 1件
4. （該当する場合）視線入力でのchoice選択 → record 1件
5. 重複record 0件（同一選択で2件生成されない）
6. `scenario.id`が正しく記録される
7. `scenario.title`のsnapshotが正しい
8. `scenario.situation`のsnapshotが正しい
9. 3択全ての`choices[]`snapshot（id/text/level）が正しい
10. `selected.id`が正しい
11. `selected.text`が正しい
12. `selected.level`が正しい
13. reload後も内容が一致する
14. legacy recordと新recordが同一配列内で共存できる
15. 教材文言（master data）を記録後に変更しても、過去recordのsnapshotが変化しない
16. custom RP（`currentLv==='custom'`）には本Pilotの記録ロジックが誤適用されない（§7 Decision 4の除外が機能する）
17. runtime error 0
18. undefined/null 0

### 21.3 Viewer Test Contract（Phase C対象、設計のみ）

detail折りたたみdefault状態 / 展開 / 折りたたみ / `aria-expanded`同期 / Enterキー / Spaceキー / Shift+Tabでのfocus trap無し / Switch Scan到達性 / screen reader向けラベル / legacy record表示（detail無し要約） / new record表示（detail有り展開） / 混在listでの表示崩れ無し

### 21.4 CSV Test Contract（Phase D対象、設計のみ）

legacy行のexport / detail付き行のexport / 混在export / カンマ含みテキストのエスケープ / ダブルクォート含みテキストのエスケープ / 改行含みテキストのエスケープ / 絵文字を含む選択肢文言 / 日本語文言 / choices flattenの区切り文字が壊れないこと / 選んだ回答列の正しさ / malformed CSVが生成されないこと

---

## 22. Implementation Roadmap（確定）

| Phase | 名称 | 内容 |
|---|---|---|
| A | `SST-RECORD-DETAIL-FOUNDATION-1` | 既存record helperへ後方互換なoptional `detail`対応のみ追加。**モードへの接続はまだ行わない**。legacy/new/mixed compatibility検証、回帰確認 |
| B | `SST-RECORD-DETAIL-RP-PILOT-1` | built-in Roleplayのみ接続。presented choices snapshot・selected answer snapshot・duplicate prevention検証 |
| C | `SST-RECORD-DETAIL-VIEWER-PILOT-1` | 学習記録画面（summary + detail disclosure）、keyboard・Switch Scan対応 |
| D | `SST-RECORD-DETAIL-CSV-PILOT-1` | 人間可読CSV、legacy/new混在export |
| E | `SST-RECORD-DETAIL-CHOICE-MODES-1` | ことばクイズ・SSTクイズ・ソーシャルストーリー・分岐ストーリー・写真で練習への展開（モードごとにサブPhase分割可、§4のDecision 1論点をここで再検討） |
| F | `SST-RECORD-DETAIL-SELF-SELECTION-MODES-1` | 感情カード・きもち温度計（該当あれば）・フレーズ集・呼吸活動への展開 |
| G | `SST-RECORD-DETAIL-CUSTOM-PRIVACY-1` | custom Roleplayに関するPrivacy Review |
| H | `SST-RECORD-DETAIL-FINAL-INTEGRATION-1` | 全体回帰・実機確認・Record Viewer・CSV・Production rollout |

**重要（Phase A/B分離の再確認）**: Phase Aでは、RoleplayハンドラからFoundationへ`detail`を渡す接続を**まだ行わない**。Foundation（記録・読込・後方互換の基盤部分）を単独で先に作り、実ブラウザ検証を完了させた後、**別checkpointとしてPhase Bでロールプレイへ接続する**。

---

## 23. Resolved Decisions（本Phaseで確定、14件）

| # | 決定事項 | 結論 |
|---|---|---|
| 1 | クイズ系record timing | 変更しない（§4） |
| 2 | 感情カード記録 | 追加する、選択時のみ（§5） |
| 3 | フレーズ集記録 | 追加する、TTS/コピー実行時のみ（§6） |
| 4 | Roleplay custom Privacy | Deferred pending Privacy Review（§7） |
| 5 | 学習記録画面 | 既存導線を拡張、新規ページは作らない（§8） |
| 6 | 呼吸活動の正式contract化 | 11活動に含める、`type:'breath'`（§9） |
| 7 | Snapshot Policy | ID+snapshot、IDのみは禁止（§10） |
| 8 | Common schema / schemaVersion | 既存4フィールド維持、トップレベルversionは1のまま、`detail.detailSchemaVersion`を新設（§11-12） |
| 9 | record粒度 | Event-based（§13） |
| 10 | Roleplay Pilot contract | built-inのみ、§14の schema確定 |
| 11 | CSV contract | 人間可読列＋既存Foundation helper再利用（§15） |
| 12 | duplicate prevention | 単一commit point、input method非依存（§16） |
| 13 | backward compatibility | legacy/new/mixed全て読込可能、migration不要（§17） |
| 14 | implementation roadmap | Phase A〜H確定（§22） |

## 24. Open Decisions（本当に未決のもののみ）

1. **Viewerの正確な実装場所**: 既存週次レポート画面のどの位置に、どのようなDOM構造でdetail disclosureを追加するか（Phase Cで実コードを見ながら決定）
2. **フレーズ集record表示文言の正確な言い回し**: 「読み上げました」「コピーしました」等の正確な表示文言はPhase Fで確定
3. **custom RP Privacy Reviewの結論**: Phase Gの結果次第で、custom RPを対象に含めるか、含める場合どこまでsnapshotするかが変わる
4. **choice-based quiz系の記録タイミング再設計**: §4で「今回は変更しない」と決定したが、将来変更するかどうか自体はPhase Eで再度User判断が必要

---

## 25. Terminology（正式統一用語）

Record Detail / snapshot / selected choice / presented choices / 教材内区分 / Event-based / legacy record / new detail record / built-in Roleplay / custom Roleplay

---

## 26. Summary Checklist

- [x] 既存Foundationを置換しない旨を明記（冒頭・§0）
- [x] 既存Source of Truthへの参照あり（§0）
- [x] SST contractはoptional extensionとして定義
- [x] 11 activities正式整理（§3）
- [x] Breathing contract追加（§9、§20.6）
- [x] custom RP Privacy defer（§7）
- [x] 14 Decision全て確定（§23）
- [x] Record semantics（操作事実のみ、自動推定禁止）を明記（§19）
- [x] legacy record保持・migration原則不要（§17）
- [x] mixed records方針あり（§17）
- [x] PII新規追加なし（§18.3）
- [x] Foundation/RP Pilot/Viewer/CSV Test Contract（§21）
- [x] Production機能コード変更 0件
- [x] push/merge/deployなし

---

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft | 2026-09-12 | Phase SST-RECORD-DETAIL-DESIGN-1。初版。sst-app.html(`239ee3d`)の実コード調査に基づく設計。実装なし。 |
| **v1.0 Final** | 2026-09-12 | Phase SST-RECORD-DETAIL-DESIGN-FINALIZE-1。User Design Reviewの14 Decisionを確定し、Draftの未決事項を解消。11活動整理・呼吸contract追加・snapshot policy確定・schemaVersion方針確定・Roleplay Pilot schema確定・custom RP Privacy defer・実装ロードマップ確定。**実装は引き続き行っていない。** |
