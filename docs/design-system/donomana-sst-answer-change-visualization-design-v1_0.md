# どのまな SST 回答変化の可視化 — Design Document（Version 1.0）

- **Status: IMPLEMENTATION COMPLETE（自動検証） / USER REVIEW・REAL DEVICE GATE PENDING**
- **Implementation: 完了（本Phase `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`）**。コード実装・新規自動テスト・既存回帰テスト・`generate.js`冪等性確認・実PDF生成検証をすべて実施済み。**push・merge・Production deploy・Preview同期は本Phaseでは実施していない。** 詳細は本文書末尾の「Implementation Record」を参照。
- 発行: 2026年10月（`DESIGN-1` → `DESIGN-CORRECTION-1` → `DESIGN-FINALIZE-1` → `DESIGN-FINAL-CORRECTION-1` → 本Phase `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`で§3 A-Fの実装前補正＋実装）
- 位置づけ: 既存`donomana-sst-record-detail-contract-v1_0.md`（Roleplay Record Detail v1、Production Released）・`donomana-sst-record-detail-expansion-plan-v1_0.md`（Wave 1/Wave 2、Production Released）を継承する後続設計文書。両文書が確定した record schema・snapshot policy・Event-based原則・Backward Compatibilityはすべてそのまま引き継ぐ。新しい`detail`フィールド・新しいrecord schemaを提案しない。**既存の保存データをどう安全に比較・表示するか**のみを扱う。

---

## 0. 要望の捉え直し（作業仮説）

> 活動件数の増減ではなく、**同じ場面・設問に対して、いつ、どの回答を選び、その選択がどう変わったか**を、表と図で振り返ること。

**これは設計上の作業仮説であり、元の依頼者への詳細確認が済んだ事実としては扱わない。** Production Releasedの「4週間のふりかえり」（`#s-trend`）は維持する。その活動件数・活動種別内訳のグラフは、本文書の対象とは別物であり混同しない。本文書が新設する機能は、能力・成長・心理状態・支援効果を自動評価する機能ではなく、保存された操作事実をそのまま提示するのみである。

---

## 1. Baseline / Drift Gate / Source Checkpoint引き継ぎ

| 確認項目 | 結果 |
|---|---|
| 前Phase終了時点で報告されたProduction baseline | `994963cf8d2d92f1963d2a1d63f75dfbc225ff27` |
| 本Phase開始時に`git fetch origin main`で再確認した`origin/main` | `994963cf8d2d92f1963d2a1d63f75dfbc225ff27`（**一致、drift 0**） |
| CLAUDE.md全文 | 直前Phaseで取得した内容と`diff`で完全一致（drift 0） |
| worktree | `/home/user/worktrees/sst-answer-change-visualization-design-final-correction-1` |
| branch | `design/sst-answer-change-visualization-design-final-correction-1`（`origin/main`から新規作成） |
| source design checkpoint | `db66943154e56a5992ad7505dd775ec79c9ef752` |
| source checkpointの親commit | `994963cf8d2d92f1963d2a1d63f75dfbc225ff27`（= baseline、一致） |
| source checkpointの変更ファイル | `docs/design-system/donomana-sst-answer-change-visualization-design-v1_0.md`のみ（551 insertions） |
| 引き継ぎ方法 | `git show db66943...:<path> > <path>`によるファイル単体抽出 |
| 引き継ぎ直後の一致確認 | `diff`結果が空（**byte-for-byte一致を確認済み**） |
| 他Phaseのbranch/worktree | 変更なし |

Driftなし。

---

## 2. 現行機能で満たしている部分と未対応部分（変更なし）

週次レポート「くわしいきろく」・4週間のふりかえり（`#s-trend`）・共通「学習の記録」のいずれも、**同じ場面・設問を軸に複数回のrecordを横断して並べる**機能を持たない。4週間のふりかえりの週別集計は活動件数・活動種別内訳というactivity typeレベルの集計であり、個々の設問・選択肢レベルの集計ではない。これが本Phaseの設計対象である。

---

## 3. Source of Truth

前版までに確認済みの文書群（`donomana-sst-record-detail-contract-v1_0.md`等、変更なし）に加え、本Phaseで以下を実コードから直接再確認した。

- `answerWQ(ci)`（`sst-app.html:6023-6042`）: `currentWQAnswers.push()`の実引数
- `answerQuiz(ci)`（`sst-app.html:6269-6284`）: `currentQuizAnswers.push()`の実引数
- `answerStory(pageIdx,ci)`（`sst-app.html:6147-6163`）: `currentStoryAnswers.push()`の実引数
- `buildWordQuiz()`内の完了分岐（`sst-app.html:5993`）・`showQuizFin()`内（`sst-app.html:6339`）・`storyNav()`内（`sst-app.html:6200`）: 各`recordActivity()`呼び出しの発火位置とタイミング
- `#s-trend`の`.report-actions`領域（`sst-app.html:3718-3721`）: 既存`#trend-print-btn`の設置構造

---

## 4. データ適合性の概要（詳細は§7の実field表を正本とする）

対象type: `rp`（built-in）/`wq`/`quiz`/`story`（質問ページ）。`choices[].id`は設問内局所ID。teacherEdits編集範囲: rpは選択肢文言が編集可能、wq/quizは編集不可、storyは場面文・設問文が編集可能。ID比較の大文字小文字・locale非依存方式は§7.4で確定する。

---

## 5. 比較可能性の3分類

| 分類 | 定義 |
|---|---|
| **1. 安全** | 比較キーが安定ID（親ID+選択肢ID集合）のみから構成でき、§8の検証ルールを通過した回答イベント同士を、§7の構造化シグネチャの完全一致でグループ化できる |
| **2. 条件付き** | 比較キーの一部に代替ID（`pageIndex`等）を使わざるを得ない、または保存snapshotだけでは教材条件の同一性を完全には確認できない既知の限界がある |
| **3. 比較不能** | 比較キーを構成する安定IDがdetailに保存されていない、またはdetail自体が存在しない |

- **分類1**: `rp`（built-in）/`wq`/`quiz`
- **分類2**: `story`（質問ページ。ページ本文`page.txt`が保存されていないという既知の限界、§7.3）
- **分類3**: `branch`/`rp`(custom)/`photo`/`diary`/`thermo`/`breath`、および意味的対象外の`emotion`/`phrase`（§5.1）

### 5.1 対象外の理由を区別する

- **`branch`**: ソースデータに`id`（`BRANCH_STORIES[lv][i].id`）が存在するが、detail構築コード（`sst-app.html:9789`付近）が保存していない。title一致のみでの結合は禁止するため比較不能。**`scenario.id`をdetailへ追加する前提Phaseを実施すれば、「同じ物語の異なるプレイ」を物語単位でグループ化することは実現できる。** ただし、ノード・選択肢単位の安定IDは現在提案している追加案（`scenario.id`のみの追加）には含まれないため、**その追加案だけでは**途中経路（route内の個々の分岐点）単位の比較は実現できない。これは「将来にわたって技術的に不可能」という意味ではなく、「ノード/選択肢の安定ID設計を別途行わない限り、本Phaseが示す最小限の追加案の範囲では実現できない」という意味である。
- **`emotion`/`phrase`**: データの充足とは無関係に、そもそも「外部から提示される固定の場面・設問」という構造を持たない自己選択的な活動であるため、意味的に対象外とする設計判断である。

---

## 6. 誤った比較を防ぐための設計原則

1. 異なる場面を回答ラベルの一致だけで結び付けない
2. 選択肢の番号だけで同じ回答と判定しない（親IDとペアで照合する）
3. 文言が同じだけで異なる設問を統合しない（branchのtitle一致結合は禁止）
4. 編集前後の意味が変わった教材を同一条件として比較しない（§7の条件シグネチャで検出）
5. セッション全体を1つの回答として比較しない（`answers[]`を展開し回答イベント単位で扱う）
6. 分岐経路の違いを能力の上下として扱わない

---

## 7. 比較キー・条件シグネチャ（必須補正A、実fieldに基づき全面改訂）

### 7.1 型ごとの実保存fieldパス（実コード確認、推測なし）

| type | 発火関数・行 | 保存される場面・質問文field（すべて実引数そのまま） | 選択肢field |
|---|---|---|---|
| `rp`（built-in） | `answerRP()`内、`recordActivity('rp', currentLv, lv, rpDetail)` | `detail.scenario.situation`（= `s.sit`）**1個のみ**。`prompt`相当のfieldは存在しない | `detail.choices[] = {id, text, level}` |
| `wq` | `answerWQ(ci)`（`sst-app.html:6038-6042`） | `answers[].question.situation`（= `q.sit`）と`answers[].question.prompt`（= `q.q`）の**2個、常に両方保存される**（片方だけが入ることはない） | `answers[].choices[] = {id, text, level}` |
| `quiz` | `answerQuiz(ci)`（`sst-app.html:6280-6284`） | `answers[].question.text`（= `q.q`）**1個のみ**。`situation`相当のfieldは存在しない | `answers[].choices[] = {id, text, level}` |
| `story` | `answerStory(pageIdx,ci)`（`sst-app.html:6158-6163`） | `answers[].prompt.text`（= `p.q`、埋め込み質問文）**1個のみ**。ページ本文`p.txt`は保存されていない | `answers[].choices[] = {id, text, level}` |

**前版の`question.situation || question.prompt`という記述は誤りであり撤回する。** `||`は「どちらか一方が真であれば他方を無視する」演算子であり、WQのように両方が常に保存されているケースでは`prompt`が常に比較から脱落する。本版では型ごとに実在するfieldをすべて、個別の名前を保ったまま構造化シグネチャへ含める（§7.2）。

### 7.2 構造化比較キー・条件シグネチャ

```js
// 比較キー: type + 安定IDのみで構成する。回答文等の可変データを含めない。
const comparisonKey = {
  type: 'rp' | 'wq' | 'quiz' | 'story',
  sceneId: scenario.id,       // rp: scenario.id / wq,quiz: question.id / story: story.id
  pageIndex: null | number    // storyのみpageIndexを追加、他typeはnull
};

// 型ごとに実在するテキストfieldを、名前を保ったままオブジェクトへ格納する
// (§7.1の表に対応。||による1本化やnullへの丸めはしない)。
function buildContextFields(type, questionOrScenario){
  if (type === 'rp')    return { situation: questionOrScenario.situation };
  if (type === 'wq')    return { situation: questionOrScenario.situation, prompt: questionOrScenario.prompt };
  if (type === 'quiz')  return { text: questionOrScenario.text };
  if (type === 'story') return { prompt: questionOrScenario.text }; // story: answers[].prompt.text
}

// choicesはID昇順(locale非依存、§7.4)でソートしてから格納する
// (シャッフルによる配列順の違いを吸収するため。選択された回答(selected)は含めない。
//  tier/levelも比較の軸に含めない(評価情報であり、教材条件の同一性には無関係))。
function buildConditionSignature(type, contextFields, choices){
  const choicesSorted = choices
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) // locale非依存の単純比較、§7.4
    .map(c => ({ id: c.id, text: c.text })); // id/textはいずれも事前に§8で文字列検証済みの値のみ
  // 常にこの順でキーを書く(動的な列挙をしない)。
  const signatureObject = { contextFields: contextFields, choices: choicesSorted };
  return JSON.stringify(signatureObject);
}
```

**この方式が満たす要件**:
- 型ごとに実在するfieldを個別の名前で保持するため、WQの`situation`と`prompt`は両方が比較に反映される（§7.1）
- `selected`（選んだ回答）は条件シグネチャに含めない。シグネチャは「提示された教材条件」のみを表し、「何を選んだか」は比較対象の別軸（グリッド・履歴側）で扱う
- `level`/tierはどのtypeでも条件シグネチャに含めない（教材内区分は評価情報であり、教材条件の同一性とは無関係）
- `JSON.stringify`はオブジェクト・文字列を正しくエスケープするため、回答文に`:`/`|`/`"`等が含まれても境界を誤認しない
- `choices`をID昇順でソートしてから格納するため、シャッフルによる配列順だけの違いは別グループを生まない
- オブジェクトのkey順は実装コード中に常に固定して明記する

### 7.3 既知の限界（必須補正B）

**「保存された場面・質問・選択肢のsnapshotが一致すること」と「教材条件・実施条件が完全に同一であること」は異なる。本設計が確認できるのは前者のみであり、後者を保証しない。** これは教員による手動編集だけでなく、教材コード自体の将来の更新（アプリのアップデートによる文言変更等）にも等しく当てはまる限界である。

推奨する説明文言（画面・PDF・最終報告のすべてで統一する）:

> 「保存された場面・質問・選択肢が一致する記録をまとめています。記録されていない会話や実施状況等の違いまでは確認できません。」

型ごとの具体的な限界:

| type | 確認できる範囲 | 確認できない範囲 |
|---|---|---|
| `rp` | 場面の導入文（`situation`）・選択肢本文 | 会話の前後文脈（`dialogs`相当）はdetailに保存されていない |
| `wq`/`quiz` | 場面文/設問文・選択肢本文 | クイズ全体の導入文・雰囲気等は保存されていない |
| `story` | 埋め込み設問文・選択肢本文 | **ページの地の文（`page.txt`）自体が保存されていない**ため、同じ設問・同じ選択肢でもページ本文側が編集されていれば検知できない |

`story`をv1対象に含める場合も、この限界をUI上に明記し、「完全に同じ教材条件」という説明はしない（§5の分類2に対応）。

### 7.4 ID比較の正規化（必須補正A/E）

- **大文字小文字**: 既存データのID（`c1`/`c2`/`c3`、`wq_1_01`等）はすべて小文字英数字+アンダースコアのみで構成されている。本設計では**ID比較を大文字小文字を区別する完全一致（`===`）とする**（既存データに大文字小文字混在の実例がないため、新たな正規化規則を発明しない）。この規則を重複判定・ソート・`selected`照合のすべてで同一に使う（判定ごとに異なるルールを使わない）
- **locale非依存**: ID順のソートに`String.prototype.localeCompare()`は使わない（実行環境のlocale設定によって結果が変わりうるため）。単純な文字列比較演算子（`<`/`>`、UTF-16コード単位比較）を用いる（§7.2のコード参照）
- **型変換による補正禁止**: `String(c.id)`のような型強制は行わない。`typeof c.id === 'string' && c.id.length > 0`を満たさない値は、**有効なIDとして扱わず、該当する選択肢を含む回答イベント全体を§8の検証で除外する**（`String(null)`が`'null'`という「それらしい」文字列になり、不正データを隠蔽することを防ぐ）

---

## 8. 比較用の検証条件（必須補正E、Implementation Phase §3Eでさらに強化）

既存`donomanaSstRecordDetail.isValidDetail()`（`detailSchemaVersion===1`かつ`type`が文字列）による基本検証は**変更しない**。本機能は、この基本検証を通過したrecordに対して、**比較に使うための追加検証**を新たに定義する。既存formatterのvalidator自体は変更しない。

### 8.0 top-level `type` ↔ `detail.type` 対応表（全文、Implementation Phase §3E）

| top-level `type`（`recordActivity()`の第1引数） | `detail.type` |
|---|---|
| `rp`（built-in のみ。custom RPは`detail`自体が保存されないため、この対応表は built-in にのみ適用される） | `roleplay_choice` |
| `wq` | `word_quiz_session` |
| `quiz` | `sst_quiz_session` |
| `story` | `social_story_completion` |

この組み合わせ以外（例: `type==='rp'`なのに`detail.type!=='roleplay_choice'`）は、データ破損または想定外の形であるとみなし、比較対象から除外する（8.1ルール1）。

### 8.1 検証ルール一覧（type別、ルール7・9・10・12を強化し、新ルール12bを追加）

| # | ルール | 対象 |
|---|---|---|
| 1 | top-level `type`と`detail.type`が、§8.0の対応表どおりの組であること | 全type |
| 2 | `detail.detailSchemaVersion===1` | 全type（既存基準） |
| 3 | `rp`の場合、`detail.custom===false`であること（built-inの実データは常に`custom:false`を明示的に保存する。custom RPは`detail`自体を保存しないため、`isValidDetail()`の時点で既に除外されており、本ルールに到達するのは`detail`が存在するrp recordのみ。「推測や近似ではなく、実際に保存される値との完全一致」で判定する） | `rp` |
| 4 | 親ID（`scenario.id`/`question.id`/`story.id`）が非空文字列であること（空白のみの文字列は8.1-9と同じ基準で無効とする） | 全type |
| 5 | `story`の場合、`answers[].pageIndex`が0以上の整数であること | `story` |
| 6 | `answers`（wq/quiz/story）が配列であること。`null`・object・配列以外の値はすべて「配列でない」として扱う。配列でなければ、そのrecordからは比較対象の回答イベントを1件も抽出できない | `wq`/`quiz`/`story` |
| 7 | 各回答イベント要素・各`choices`要素が、**`null`でなく、かつ配列でもない**、適切なobjectであること（`typeof x==='object' && x!==null && !Array.isArray(x)`相当。「object」という言葉だけでは配列も通過してしまうため、配列を明示的に除外する） | 全type |
| 8 | `choices`が配列かつ1件以上であること | 全type |
| 9 | 各`choice.id`が、`typeof==='string'`かつ**trim後ではなく元の文字列のまま**長さ1以上であること（§7.4）。空白のみの文字列（例: `' '`、`'\t'`）は非空文字列とはみなさず無効とする。`trim()`した上で採用する・値を書き換えるという補正は行わない（元データを静かに改変しないため） | 全type |
| 10 | 各`choice.text`が、ルール9と同じ基準（`typeof==='string'`・空白のみを無効とする・trim補正をしない）を満たす非空文字列であること | 全type |
| 11 | `choices[]`内に重複する`id`が存在しないこと（§7.4の大文字小文字区別する完全一致で判定） | 全type |
| 12 | `selected`自体が、**存在し、かつ`null`でなく、かつ配列でもない**適切なobjectであること（ルール7と同じ基準）。`selected`が欠落している場合は、例外なく本ルールの違反として扱う（「存在しないなら比較しない」という黙示の許容はしない） | 全type |
| 12b | `selected.id`・`selected.text`それぞれが、ルール9・10と同じ基準（文字列・空白のみ無効・trim補正なし）を満たすこと | 全type |
| 13 | `selected.id`が`choices[].id`の集合に存在すること | 全type |
| 14 | `selected.text`が、対応する`choices[].id`の`text`と一致すること | 全type |
| 15 | §7.1で定義した型ごとの必須テキストfield（rp: `situation`／wq: `situation`と`prompt`の両方／quiz: `text`／story: `prompt.text`に相当するfield）が、`typeof==='string'`であり、かつルール9と同じ基準で空白のみを無効とすること。欠損・空文字列・空白のみの文字列は`null`等へ丸めず、このルールの違反として扱う | 全type |

**いずれか1つでも満たさない回答イベントは、比較対象（選択グリッド・選択肢全文対応表・比較用履歴）から除外する。除外しても元recordは書き換えない。**

### 8.2 除外の粒度（session型 vs 単発型）

- `rp`（1 record = 1回答イベント）: 上記検証に失敗したrecordは、そのrecord自体が比較対象から除外される
- `wq`/`quiz`/`story`（1 record = 複数回答イベントの`answers[]`）: **`answers`自体が配列でない等、record全体が壊れている場合はrecord全体を除外する。`answers`が有効な配列であり、個々の要素の一部だけがルール7-15のいずれかに違反する場合は、違反した回答イベントのみを除外し、同じrecord内の他の有効な回答イベントは比較対象として残す。** これは「1 record=1行」ではなく「抽出した1回答イベント=1行」という本設計の基本方針（§10）と整合させるためであり、1件の不正な回答のために同一セッション内の有効な回答まで失うことを避ける。**`answers`自体が配列でないためにrecord全体を除外する場合、そのrecordが「本来いくつの回答イベントを含んでいたか」「どの比較グループに属するはずだったか」は確定できない。このようなrecordは、どの比較グループの除外件数にも計上しない（§12.3）。**

### 8.3 除外されたrecord/回答イベントの表示

本設計の検証ルールで除外されたrecord・回答イベントは、比較対象（グリッド等）には含めないが、**既存formatterの妥当性判断（`isValidDetail()`等）に従って表示できる範囲のみ**、既存の個別詳細（くわしいきろく相当）で引き続き確認できる。本設計の追加検証で不合格になったことが、既存詳細画面での表示可否を一律に左右するとは限らない（既存formatterの判断基準をそのまま適用する）。

### 8.4 対象外typeと不正データの区別

「`branch`/`emotion`/`phrase`等、typeそのものが対象外」（§5.1、説明文言は§14.6）と、「`rp`/`wq`/`quiz`/`story`ではあるが本節の検証に失敗した不正データ」（説明文言は§12.2の状態4）は、原因も説明文言も異なる。

---

## 9. 選択グリッド（必須訂正A・B・C、構造は維持し本Phaseで仕様を精緻化）

### 9.1 設計方針（変更なし）

- **列（横方向）= 選択肢**。選択肢IDの昇順（§7.4の locale非依存比較）で固定した列順。tierによる並べ替えはしない
- **行（縦方向）= 各回答イベント**（§10で定義する順序）
- 列数は実データ調査により全対象typeで選択肢最大3件（`WORD_QUIZ`/`QUIZZES`/`STORIES`/`SCENES`の全`choices[]`ブロックを機械的に走査し確認）。**ただし「320pxに必ず収まる」とは断定しない。** 列数の少なさは収まりやすさの根拠の1つに過ぎず、行見出し列（日時・通し番号）の幅・余白・フォント・zoom設定の影響を含めて、実装Phaseでの実測検証が必要（§18のTest Strategy）
- 各セルには、その回答イベントでその列の選択肢が選ばれていれば**同一の形・大きさ・色のマーク**を置く（tierによる色分け・形状変更・大小変更は行わない）。線で結ばない
- **セマンティックな`<table>`要素として実装する**（`<caption>`、`<th scope="col">`、`<th scope="row">`）

### 9.2 列見出しラベル（必須補正C関連）

列見出しは「選択肢A」「選択肢B」「選択肢C」という、ID昇順に基づく表示用ラベルとする。既存個別詳細の提示順マーク（①②③）とは**独立した別の採番体系**であり、両者が同じ画面・同じPDFに並ぶ場合は、必ず「選択肢A/B/Cは常に同じ並び順の表示用ラベルで、①②③はその回に実際に提示された順番です」という説明を併記する（§9.4の凡例、§11の対応表双方に記載する）。

### 9.3 セルのマークとaria-hidden（必須補正H）

- 視覚的マーク（例: ●）は`aria-hidden="true"`とし、**同じセル内に読み上げ専用のテキスト**を置く: 選択された場合は視覚要素と重複しない形で「選択」、選択されなかった場合も明示的に「未選択」という読み上げ用テキストを置く（空欄のまま読み上げ結果を利用者の推測に委ねない）
- **`<table>`全体はaria-hiddenにしない。** `<caption>`・列見出し（`<th scope="col">`）・行見出し（`<th scope="row">`）により、screen readerは標準のtableナビゲーションで関係を読み上げられる
- 行見出し内の個別履歴へのリンク（§11.5）**以外、同じ行内に重複するfocus可能要素を置かない**（1行につき1つの操作要素のみとし、同じ操作を複数のtab-stopで重複させない）
- セル自体（`<td>`）はfocus可能な操作要素を持たない

### 9.4 凡例（Implementation Phase §3Fで文面からsection参照を除去）

図の直下に以下の凡例文を常設する。**この文言は画面・PDFに実際に表示されるUIテキストであるため、設計文書内部の節番号（「§10参照」等）を一切含めない。**

> 「このグリッドは、記録された日時の順に並んでいます。列（選択肢A・B・C）の並びはどの回でも同じ順番で、選択肢の良し悪しとは関係ありません。選択肢A・B・Cの全文は、下の『選択肢の対応表』でご確認いただけます。①②③はその回に実際に提示された順番で、選択肢A・B・Cとは別の表示です。マークは『その回にこの選択肢を選んだ』という記録だけを表します。」

（設計文書側の参照: 表示順の定義は§10、対応表の仕様は§11。これらは実装者向けの内部参照であり、上記引用符内のUI文言には含めない。）

---

## 10. 回答イベントの定義・記録日時・表示順（必須補正D、全面改訂）

### 10.1 「record」と「回答イベント」の区別

本設計は「1 record=1行」ではなく、**「抽出した1回答イベント=1行」**を基本単位とする。

- `rp`: 1 record = 1回答イベント（1 choiceの確定が即1 record、`answerRP()`内で`recordActivity()`を直接呼ぶ）
- `wq`/`quiz`/`story`: 1 record（1セッション）から、`answers[]`配列の要素数ぶんの回答イベントを抽出する

### 10.2 記録日時（`ts`）が表す意味（実コード確認、型別）

| type | `recordActivity()`呼び出し位置 | `ts`が表す時点 |
|---|---|---|
| `rp` | `answerRP()`内、choice確定と**同じ関数呼び出しの中**（`sst-app.html:5967`） | その1回の選択を確定した瞬間 |
| `wq` | `buildWordQuiz()`内、**全問終了後**の分岐（`sst-app.html:5993`） | セッション完了（保存）時点。個々の設問に回答した時刻ではない |
| `quiz` | `showQuizFin()`内、**全問終了後**（`sst-app.html:6339`） | 同上 |
| `story` | `storyNav()`内、**最終ページ到達時**（`sst-app.html:6200`） | 同上 |

**`wq`/`quiz`/`story`では、`answers[]`内の各要素に個別のtimestampは保存されていない。** 同一セッションから抽出された複数の回答イベントは、**すべて同じ`ts`（そのセッションの保存時刻）を共有する。** これを「各設問に回答した時刻」として提示しない。グリッド・履歴の見出しには「記録日時」という正確な語を用い、「回答日時」等、個々の設問ごとに異なる時刻であるかのような表現は使わない。

一方、`answers[]`配列内でのインデックス順は、accumulatorへの`push()`が各設問に回答した順に同期的に実行されるコード構造（`answerWQ()`/`answerQuiz()`/`answerStory()`内で都度push、§3参照）により、**実際に回答した順序を忠実に反映している**（個別の時刻は持たないが、順序自体は信頼できる）。

### 10.3 表示順の確定

表示順は次の3キーの組で決定する。

1. **`ts`昇順**（記録日時。古い→新しい）
2. **元`activityLog`配列内でのrecordの格納順**（同一`ts`を持つ複数recordのtie-break。実際の保存順を断定するものではなく、表示を実行のたびに決定的にするための機械的なtie-break）
3. **`answers[]`内のインデックス**（同一record内の複数回答イベントの順序。`rp`はrecordごとに回答イベントが1件のみのため、この値は常に`0`として固定する。これにより、`rp`を含むすべてのtypeで同一の3キー構造を一貫して使える）

**同一`ts`からの順序は、実際の回答順を断定しない**（2のtie-breakは決定性のためのものであり、真の時系列的前後関係の主張ではない）。**重複record・同一設問への複数回答は除去せず、独立した回答イベントとしてすべて表示する。**

---

## 11. 選択肢全文対応表（必須補正C、新設）

### 11.1 設置方針

選択グリッド（§9）の**直下に、そのグループ（比較キー+条件シグネチャ）の選択肢全文対応表を必ず設置する**（画面・PDFの両方）。個別カードへのリンクのみでの代替は行わない（全文をその場で確認できることを優先する）。

```
選択肢の対応表（このグループの選択肢）
選択肢A：「こんにちは！ぼく（わたし）は〇〇です。よろしくね！」
選択肢B：「こんにちは…よろしくお願いします」と小さな声で言う
選択肢C：「こんにちは」とだけ言う
```

- ID昇順で決めた表示ラベル（選択肢A/B/C、§9.2）と全文を1対1で対応付ける
- 長文は折り返して全文を表示し、省略・切り捨てはしない
- 「①②③はその回の実際の提示順、選択肢A/B/Cはこの対応表の固定ラベル」という説明を対応表の直前に明記する（§9.4の凡例と同じ趣旨）

### 11.2 複数グループ・複数ページでの対応

同じ比較キーでも条件シグネチャが異なれば複数のグループが生じうる（§6原則4）。**各グループは、それぞれ専用の選択グリッド＋専用の選択肢対応表のペアを持つ**（グループ間で対応表を共有・使い回ししない）。画面・PDFとも、グループの境界には見出し（例: 「2026/09/01〜2026/09/15の記録」）を置き、どのグリッド・対応表がどのグループに属するか常に明確にする。

### 11.3 行数が多い場合の分割（具体ルールの確定）

「一定行数ごと」「例: 1週間ごと」という曖昧な基準ではなく、**§13の表示期間で定義する週境界（`trendComputeWeeks()`の`weekStarts`と同じ境界）でグリッドをブロック分割し、各週ブロックの先頭で列見出し（選択肢A/B/C）を再掲する**ことを正式な分割ルールとする。これは既存の週集計で既に使われている境界をそのまま再利用するものであり、恣意的な行数で分割するものではない。選択肢全文対応表は週ブロックごとに作らず、グループ全体で1つを維持する（対応表はグループに対して不変であり、週をまたいでも内容は変わらないため、週ごとに複製すると情報の重複・不整合のリスクが生じる）。

### 11.4 PDFでの対応表

PDF/印刷では、選択グリッド・選択肢全文対応表・個別の回答履歴（§11.5）のすべて出力対象に含める（§15の印刷方針を参照）。週ブロックごとの列見出し再掲（§11.3）は画面・PDF双方で同じルールを適用する。

**（Implementation Phase §3C）選択グリッド・選択肢全文対応表は、いずれも`<table>`の`<thead>`要素に列見出し行（選択肢A/B/C、および対応表の場合は項目見出し）を格納し、ブラウザのネイティブな印刷時`<thead>`繰り返し機能によって、複数ページにまたがった場合も各ページ先頭に列見出しが自動的に再掲される構造で実装する。** 週ブロック分割（§11.3）を伴うグリッドは、週ブロックごとに独立した`<table>`（各々が自分の`<thead>`を持つ）として実装するか、単一`<table>`内で週ブロックの境界行を`<tbody>`の区切りとして表現しつつ`<thead>`のネイティブ印刷時repeat機能に委ねるかのいずれかとする。**実装Phaseでは、この`<thead>`再掲が机上の`@media print`CSS/DOM確認だけでなく、実際に複数ページにわたるPDFを生成し、各ページの実際のレンダリング画像と抽出テキストの両方で列見出しの再掲を確認することを必須とする。** print-media DOM検査のみでは本要件の確認完了とは認めない。

### 11.5 個別の回答履歴（Implementation Phase §3F、新設の明文化——従来「§12.3」として誤参照されていた内容を正式に定義する）

比較キー詳細画面の構成要素のうち、選択肢全文対応表（§11.1-11.4）の直下に置く「個別の回答履歴」をここで定義する（§14.1の画面構成順の(5)に対応）。

- 1グループ内の全回答イベントを、§10.3の3キー順（`ts`昇順→元`activityLog`格納順→`answers[]`内インデックス）で列挙したリストとして表示する
- 各リスト項目は最低限次を含む: 「記録日時」（`ts`を日時表示、§10.2の語彙を使用）・選んだ選択肢の全文（`selected.text`）・選択肢ラベル（選択肢A/B/C、§9.2）・その回に実際に提示された順番マーク（①②③、取得できる場合）
- 既存の個別詳細表示（くわしいきろく相当、`sst-record-detail.js`の`getDetailRows()`等）を可能な範囲で再利用し、session型（wq/quiz/story）では該当`answers[]`要素1件分に絞った表示とする
- 各リスト項目は、選択グリッド（§9.3）の行見出しリンクの遷移先となる、一意で安定したDOM上のid（アンカー）を持つ。グリッドの行見出しリンクはこのidへ遷移し、遷移先の項目へfocusを移動する
- 除外された回答イベント（§8の検証不合格）は、このリストには含めない（§8.3の既存個別詳細とは別の扱い）

### 11.6 §9.3・§11.4引用の整合（編集メモ）

本版以前の文書で「個別履歴へのリンク（§12.3）」「個別履歴（§12.3）」としていた箇所は、いずれも本節（§11.5）の誤記であった（§12.3の実際の内容は「件数の混同防止」であり、個別履歴の定義ではない）。本版で該当箇所をすべて§11.5参照に訂正した（Implementation Phase §3Fの相互参照整合要求に対応）。

---

## 12. 空状態・失敗状態の区別（必須補正F、6区分の確定）

### 12.1 既存4週間機能の調査結果（変更なし）

`trendReadRaw()`（`sst-app.html:7462-7479`）・`trendClassify()`（`sst-app.html:7521`台）を再利用する。既存Foundation API（`donomanaRecordReadLog()`等）自体は変更しない。

### 12.2 6つの状態（Implementation Phase §3A・§3Bで状態4・6を訂正）

| # | 状態 | 判定条件 | 表示 |
|---|---|---|---|
| 1 | 読み込み失敗 | `trendReadRaw()`相当が`{ok:false}`（storageアクセス例外／空文字列・空白のみ／JSON parse失敗／非配列のいずれか） | 読み込み失敗メッセージ（既存`trend-failure-area`相当の領域、空状態とは別DOM・別文言） |
| 2 | 対象期間に正常な活動recordがない | 読み込みは成功したが、§13の期間内に残る有効record（`trendClassify()`相当の`week`バケット）が0件 | 「この期間に保存された記録はありません」（なお、この状態であっても該当する無効timestamp・未来timestampの通知（§12.4）は該当すれば併せて表示する。読み込み失敗ではないため「0件の記録」と誤って提示しない） |
| 3 | 活動recordはあるが対象typeの回答がない | 期間内に有効recordは存在するが、`type`が`rp`/`wq`/`quiz`/`story`のいずれでもない | 「この期間の記録に、対象となる活動（ロールプレイ・ことばクイズ・SSTクイズ・ソーシャルストーリー）が含まれていません」（状態2とは異なる文言） |
| 4 | 対象typeのrecordはあるが比較用検証（§8）を満たす回答が1件もない | 対象typeのrecordは存在するが、抽出できた回答イベントがすべて§8の検証に不合格（または`answers`自体が壊れておりrecord全体除外）となり、比較グループが1件も成立しない | 個別の比較キーは一覧に表示しない点は変更しないが、**一覧画面全体が本状態に該当する場合（期間内の対象type全recordが本状態の原因で比較グループを1件も生成できない場合）は、状態2・3とは異なる専用の説明メッセージを一覧画面に表示する**（空リストと区別する）。例: 「対象となる活動の記録はありますが、比較に必要な情報が不足しているため、選択の履歴を表示できません。」件数（「△件中」等）は、§8.2で述べた通り除外原因によっては対象件数自体を確定できない場合があるため、**本状態のメッセージには件数を含めない**。状態3とユーザーから見た見た目は類似しうるが、内部的な原因（type不一致 vs 検証不合格）は区別して扱う |
| 5 | 比較可能な回答が1件以上ある | 検証を通過した回答イベントが1件以上 | 選択グリッド（§9）＋対応表（§11）＋個別の回答履歴（§11.5）を表示 |
| 6 | 一部の回答だけ除外された | 同じ比較グループ内に、検証を通過した回答イベントと、**除外原因・母数の両方が確定できる**除外回答イベントが混在 | 状態5の表示に加え、「全◯件中、△件は比較条件を満たさず除外されました」という件数付き注記を併記する。**ただし§12.3の規則により、母数（◯）・除外数（△）のいずれかが確定できない場合は、この「全◯件中△件」という文言を使わず、確定できる範囲のみ（例: 「このグループに表示できない回答が含まれている可能性があります」）を述べるに留める** |

### 12.3 件数の混同防止（Implementation Phase §3Bで母数の推測禁止を明文化）

**record単位の通知**（`trendClassify()`相当が算出する、無効timestamp・未来timestamp・不正record数）と、**回答イベント単位の除外数**（§8の検証で除外された回答イベント数、状態6）は、算出元も意味も異なるため、別々に数え、別々に表示する。**一方を他方に合算しない。**

**母数・除外数を推測しない（Implementation Phase §3B、必須）**:
- 親IDの欠落・`answers`自体の破損（§8.2参照）等、record単位の問題により「そのrecordが本来いくつの回答イベントを含んでいたか」「どの比較グループに属するはずだったか」が確定できない場合、そのrecordをどの比較グループの除外件数にも計上しない。該当するrecordはrecord単位の通知（読み込み失敗・無効/未来timestamp・不正record数）としてのみ報告し、特定グループの「除外数」には一切含めない
- 「全◯件中△件」という母数つきの文言は、母数（そのグループに属する回答イベント総数）が実際に確定できる場合にのみ使用する。確定できない場合はこの文言自体を使わない（空欄や`0`で埋めて体裁を保たない）
- 同一の根本原因（例: 1件の壊れた`answers`配列）を、record単位の通知と回答イベント単位の除外数の両方に二重計上しない

### 12.4 未来・無効timestampの扱い（既存4週間機能との整合、変更なし）

- 無効timestamp → 比較対象から除外し、「日時を確認できない記録があります」という既存#s-trend語彙と同趣旨の専用注記
- 未来timestamp（`ts > now`）→ 比較対象から除外し、「保存日時が現在より後になっている記録があります」という専用注記

---

## 13. 表示期間の確定（変更なし、要点再掲）

v1の表示期間は「今週を含む月曜起点の4週間」で確定する。既存`trendComputeWeeks(nowMs)`（`sst-app.html`、4週間のふりかえりの実装）をそのまま再利用し、新しい期間計算を実装しない。理由: (1) 独立再実装による境界のズレを避ける、(2) 既存4週間画面と同じ期間で突き合わせられる。

- `now`は画面表示開始時に1回だけ取得し、以降の全処理で使い回す（§14.4のデータ共有方針と統合）
- 最古週開始より前の正常recordは通知せず静かに期間外除外（既存`before-window`と同じ）
- `now`より後のrecordは比較対象から除外し§12.4の専用注記
- 画面を再度開いた場合は、その時点の`now`で境界を再計算する

**30日retention（`saveActivityLog()`、SAVE時にのみ適用）は保存側の仕組みであり、本機能の表示期間（月曜起点の4週間、最大28日）とは独立した別概念である。** 「図の表示期間が30日である」「保存されている全記録を表示する」という説明は行わない。

---

## 14. UX仕様（必須補正G、導線とfocusを確定）

### 14.1 新画面の構造

`go()`による通常のscreen遷移として新規screen「選択の履歴」を追加する。2階層構成: (1) 比較キー一覧画面、(2) 比較キー詳細画面（選択グリッド＋選択肢全文対応表＋個別の回答履歴、§11.5）。**両画面とも、既存の報告系画面（`#s-trend`等）と同じ構造で、上部`.back`リンクと下部の戻るバーの両方を持つ**（Implementation Phase §3D、§14.3で両者の遷移先・focus復帰先を定義する）。

### 14.2 既存画面からの導線（確定）

**`#s-trend`の`.report-actions`領域（`sst-app.html:3718-3721`、既存`#trend-print-btn`と同じ並び）に「選択の履歴を見る」ボタンを追加する。** この領域は`#trend-card`（印刷対象）の外側にあるため、新しいボタンも既存のPDFボタンと同様に印刷には含まれない。`#s-report`ではなく`#s-trend`を選ぶ理由: `#s-trend`は既に「複数週にまたがる記録の振り返り」という本機能と同じ文脈の画面であり、`trendComputeWeeks()`等、本機能が再利用する期間計算ロジックの実装元でもあるため、ユーザーの導線・実装の依存関係の両面で一貫する。

### 14.3 画面遷移とfocusの流れ（Implementation Phase §3Dで一覧画面の下部戻るバーを明記）

| 遷移 | 見出しfocus | 起点focus復帰 |
|---|---|---|
| `#s-trend` →「選択の履歴を見る」→ 比較キー一覧画面 | 一覧画面の主見出しへ`tabindex="-1"`でfocus（既存`openTrendScreen()`と同型） | — |
| 比較キー一覧 → 比較キーを選択 → 詳細画面 | 詳細画面の主見出し（比較キーの場面/設問名）へfocus | — |
| 詳細画面の上部`.back` → 一覧画面 | — | 一覧画面内の、直前にクリックした比較キー項目へfocus復帰 |
| 詳細画面の下部戻るバー → 一覧画面 | — | 同上（上部`.back`と完全に同じ遷移先・同じfocus復帰先） |
| 一覧画面の上部`.back` →`#s-trend` | — | `#s-trend`の「選択の履歴を見る」ボタンへfocus復帰（既存`closeTrendScreen()`と同型） |
| **一覧画面の下部戻るバー →`#s-trend`** | — | **同上（一覧画面の上部`.back`と完全に同じ遷移先・同じfocus復帰先。上下で異なる遷移先や異なるfocus復帰先を持たせない）** |

**focus復帰先が消失している場合のフォールバック**: 復帰先の要素（直前にクリックした比較キー項目、「選択の履歴を見る」ボタン等）がDOM上に存在しない場合（例: データ再取得により一覧の内容が変化した場合）、復帰先の画面の主見出しへ`tabindex="-1"`でfocusする（見出しfocusと同じ扱いにフォールバックし、focusが完全に失われる状態を作らない）。

既存`trendIsFocusable()`/`trendFirstFocusable()`と同型の非生成領域複製パターン（例: `answerHistoryIsFocusable()`/`answerHistoryFirstFocusable()`）を新設し、`generate.js`の生成ブロックは変更しない。

### 14.4 データ共有・再取得の方針（区別の確定）

- **`#s-trend`から「選択の履歴を見る」を押して本機能のフローに入った時点**で、`trendReadRaw()`相当の読み込みと`now`の取得を**1回だけ**行い、その結果（検証済みrecord一覧・算出済み比較キー一覧）を本機能のフロー内（一覧画面⇄詳細画面の往復すべて）で共有する
- **一覧⇄詳細の往復のたびに、storageの再読込や`now`の再取得は行わない**（画面を切り替えるたびに異なる`now`を使うと、境界付近のrecordの扱いが遷移ごとに変わりうるため）
- `#s-trend`へ完全に戻り、再度「選択の履歴を見る」を押して**フローへ新規に入り直した場合のみ**、読み込みと`now`取得をやり直す

### 14.5 比較条件が複数ある場合・1件のみの場合（変更なし）

同じ比較キーでも条件シグネチャが異なれば別グループとして一覧に複数エントリを表示する（§11.2）。1件のみの比較キーも一覧に含め、1行のみのグリッドとして表示する（方針撤回なし、狭幅・PDFでも常時表示、§9.1）。

### 14.6 対象外活動の説明文言（変更なし）

- `branch`: 「分岐ストーリーは、現在のデータだけでは同じ物語を安全に見分けられないため、この一覧には含まれません」
- `emotion`/`phrase`: 「感情カード・フレーズ集は、決まった場面に対する回答ではないため、この機能の対象には含まれません」

---

## 15. 印刷・改ページ方針（必須補正H、精緻化）

- 選択グリッド・選択肢全文対応表・個別履歴の**すべて**を印刷対象に含める
- **週全体・グリッド全体への一律`break-inside:avoid`指定はしない**（大きすぎるブロックに`avoid`を課すと、1ページに収まらない内容がブラウザの印刷エンジンによって不自然に扱われる・内容が欠落するリスクがあるため）。`break-inside:avoid`は、既存`.report-detail-card{break-inside:avoid}`と同じ粒度（**individual row 1行、individual card 1件**）にのみ適用する
- 長い1件のカード（長い回答文等）が1ページを超える場合も、**内容を切り捨てずに複数ページへ自然に分割させる**ことを優先する（`break-inside:avoid`をその最大単位に強制しない）
- 週ブロックの列見出し再掲（§11.3）は、既存`.report-section-title`等の見出し繰り返しパターンと同様、印刷時のページ跨ぎでも内容理解を妨げないための補助であり、強制的な改ページ位置の指定ではない

---

## 16. v1 Scope / Non-goals

### 16.1 対象に含める

- 対象type: `rp`（built-in）/`wq`/`quiz`（分類1）、`story`の質問ページ（分類2、§7.3の限界を画面上に明記）
- 表示期間: 今週を含む月曜起点の4週間（§13、固定）
- 表示構成: 選択グリッド（§9）＋選択肢全文対応表（§11）＋個別履歴
- 読み込み・timestamp・空状態処理: 既存`trendReadRaw()`/`trendClassify()`相当の再利用＋§12の6区分
- read-only。既存recordを一切書き換えない
- ブラウザ単位の履歴のまま

### 16.2 対象外（non-goals）

- `branch`（§5.1、前提Phase＝物語単位比較のみ実現、ノード単位は現在の追加案では実現できない）
- `emotion`/`phrase`（意味的対象外）
- `rp`(custom)/`photo`/`diary`/`thermo`/`breath`
- tier内訳・tier割合・得点・成長スコアの新設
- 個人識別機能・保持期間延長（§17、未対応事項として残す）
- 過去recordへの推測ID付与
- 共通Dashboard（`learning-records.html`）への機能追加

---

## 17. 個人別記録・長期保存（未対応事項）

### 17.1 個人別記録

ブラウザ単位のv1では、共有端末上の学生別変化は提供できない。追加時の影響: 比較キーへの`personId`追加（グルーピング変更を伴う）・人物選択UIの新設・既存recordのmigration方針（未割り当て扱い等）の検討・「記録があるか」の判定を人物ごとに行う必要（§13の期間計算自体は変更不要）。

### 17.2 長期保存

現行30日retention（save-triggered、保証なし）では複数月の比較を保証できない。追加時の影響: 比較キー/条件シグネチャロジックは変更不要・表示期間の固定（今週を含む4週間）という前提が崩れるため期間セレクタ等のUI新設を要する・record構造自体のmigrationは不要・§13の期間計算ロジックの一般化が必要になる可能性。

---

## 18. Test Strategy（将来実装Phase向け、本Phaseでは実行しない）

- 比較キー・条件シグネチャ（§7）: WQで`situation`/`prompt`両方が反映されること、ID順ソートがlocale設定に影響されないこと（複数locale下での再現テスト）、`String()`型強制なしでの不正ID検出
- §8の14検証ルールそれぞれが正しく除外すること。session内の一部回答のみが不正な場合に、他の有効な回答が残ること（§8.2）
- 選択グリッド: 列順がID昇順で固定、1件でも表示、aria-hidden+読み上げ用テキストの両立、同一行内の重複focus要素がないこと
- §10: `wq`/`quiz`/`story`の複数回答イベントが同一`ts`を共有すること、3キーソートの決定性
- §11: 選択肢全文対応表が全グループ・全ページで正しく対応すること、週ブロック分割での列見出し再掲
- §12: 6状態それぞれの判定・表示、record単位通知と回答イベント単位除外数が混同されないこと
- §14.4: 一覧⇄詳細の往復でstorage再読込・`now`再取得が発生しないこと
- 320px/390px/iPad幅・200%zoom: 自動検証（viewport縮小によるzoom近似）と実機確認を区別して記録する（200%zoomの実機的挙動は自動検証の対象外として明記する）
- 印刷/PDF: グリッド・対応表・個別履歴がすべて出力されること、長いカードが複数ページに自然分割され内容が欠落しないこと
- 既存`trend-implementation-test.js`等への回帰影響なし、read-only確認

---

## 19. Risks

- v1対象の狭さ（branch/emotion/phraseを含まない）
- `story`の既知の限界（ページ本文の変化を検知できない）
- ID一意性の非保証（将来の教材追加で重複が生じる可能性）
- 個人別記録・長期保存の未充足
- 選択肢A/B/C（固定表示ラベル）と①②③（提示順マーク）という2種類の選択肢表現の並立による混乱可能性（§9.4・§11.1の説明文言が必須要件）
- 週ブロック分割（§11.3）を伴う選択グリッドの実装・印刷時の複雑さ

---

## 20. User判断が必要な事項（少数のまま維持）

実装細部（比較シグネチャ構造・検証ルール・空状態区分・導線・focus・印刷方針等）は本Phase内ですべて確定した。以下のみをUser判断事項とする。

| # | 論点 | 推奨 | v1採否への影響 |
|---|---|---|---|
| 1 | ブラウザ単位・4週間固定のv1を先に実装するか | Yes | 直接 |
| 2 | 対象typeの限定（`rp`/`wq`/`quiz`/`story`条件付きの4種）を受け入れるか | Yes | 直接 |
| 3 | 個人別記録の別Design Phaseをいつ進めるか | v1実装・現場フィードバック後 | v1には影響しない |
| 4 | 長期保存拡張の別Design Phaseをいつ進めるか | v1実装・現場フィードバック後 | v1には影響しない |
| 5 | branch前提Phase（`scenario.id`追加、物語単位比較のみ）に着手するか | 未定（User判断） | v1には影響しない |

---

## 21. 推奨するPhase順序

| Phase | 内容 | 着手条件 |
|---|---|---|
| 1（本Phase） | Design Review | User最終承認を待つ |
| 2 | `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`（§16 v1のコア実装） | §20の#1・#2が確定してから |
| 3（任意） | branch前提Phase | §20-#5でYesの場合のみ |
| 4（任意） | 個人別記録の別Design Phase | §20-#3の時期が来たら |
| 5（任意） | 保存期間拡張の別Design Phase | §20-#4の時期が来たら |

---

## 22. 想定変更ファイルと依存関係（本Phaseでは変更しない）

| ファイル | 想定される変更 |
|---|---|
| `sst-app.html` | 新規screen「選択の履歴」、§7-12のロジック、既存`trendReadRaw()`/`trendClassify()`/`trendComputeWeeks()`の再利用、`#s-trend`への導線ボタン追加 |
| `assets/js/sst-record-detail.js` | 比較用data抽出ヘルパーを既存関数の隣に新規追加。既存関数は変更しない |
| `tools/sst-weekly-report-pdf/`配下 | 新規回帰テストファイルの追加 |
| 本文書 | 実装後のImplementation Record追記 |

**変更しないもの**: `generate.js`・`apps-data.json`・record schema・30日retentionロジック・既存Foundation API・他アプリ・Preview workflow・`learning-records.html`。

---

## 23. Summary Checklist

- [x] コード実装・テスト変更・schema変更・保持期間変更 0件、push/merge/deploy/Preview同期 0件
- [x] source checkpointからのbyte-for-byte引き継ぎを確認（§1）
- [x] 必須補正A: WQの`situation`/`prompt`両方を含む構造化シグネチャへ訂正、実field表を実コードから作成（§7.1-7.2）
- [x] 必須補正B: 「保存snapshotの一致」と「教材条件の完全同一性」を区別する統一文言を確定（§7.3）
- [x] 必須補正C: 選択肢全文対応表を新設、週境界による分割ルールを確定（§11）
- [x] 必須補正D: recordと回答イベントを区別、型別の`ts`意味を実コードで確認、3キー表示順を確定（§10）
- [x] 必須補正E: 14の検証ルールとsession内の除外粒度（回答イベント単位）を確定（§8）
- [x] 必須補正F: 6つの空状態・失敗状態を区別、record単位/回答イベント単位の件数混同を防止（§12）
- [x] 必須補正G: 導線を`#s-trend`の`.report-actions`に確定、全遷移のfocus・データ再取得方針を明記（§14）
- [x] 必須補正H: aria-hidden+読み上げ用テキストの設計、320px断定の撤回、break-inside:avoidの粒度訂正（§9.3・§15）
- [x] branchのノード単位比較を「現在の追加案では実現できない」と正確に表現（永久不可能という表現を回避、§5.1）
- [x] 節番号・相互参照の整合を確認
- [x] User判断事項を5項目に維持（§20）
- [x] `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`: §3 A-Fの実装前補正を本文書へ反映（§8.0新設、§8.1強化、§9.4/§12.2/§14.1/§14.3訂正、§11.5新設、§8.4/§12.2内の相互参照修正）
- [x] `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`: 実装完了、新規自動テスト・既存回帰テスト全件PASS、`generate.js`冪等性確認、実PDF生成検証済み（詳細は下記Implementation Record）
- [x] Status: IMPLEMENTATION COMPLETE（自動検証） / USER REVIEW・REAL DEVICE GATE PENDING

---

## Implementation Record（`SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`、2026-10-02）

### 実装範囲

§16.1で確定したv1スコープを、§3 A-Fの実装前補正を適用したうえでそのまま実装した。スコープの拡大・縮小は行っていない。

| 変更ファイル | 内容 |
|---|---|
| `sst-app.html` | 新規screen `#s-answer-history-list`（比較キー一覧）・`#s-answer-history-detail`（選択グリッド＋選択肢全文対応表＋個別の回答履歴）、`#s-trend`の`.report-actions`への「選択の履歴を見る」ボタン追加、`BACK_MAP`への2エントリ追加、印刷CSS（`#ahist-card`のisolation・break-inside粒度）、固定ボタン重なり対策CSSセレクタへの新画面追加（§8/Implementation Phase §8対応） |
| `assets/js/sst-record-detail.js` | 比較キー・条件シグネチャ抽出（`extractComparisonAnswerEvents`）・グループ化（`groupComparisonAnswerEvents`）・6状態判定（`classifyAnswerHistoryState`）等の新規export追加。既存`isValidDetail`/`getDetailRows`/`buildDetailCsvRows`等は無変更（golden testsで確認） |
| `docs/design-system/donomana-sst-answer-change-visualization-design-v1_0.md` | 本文書自身。§3 A-Fの実装前補正＋本Implementation Record |
| `tools/sst-weekly-report-pdf/answer-history-implementation-test.js` | 新規、109チェック（詳細は下記） |

### §3 A-F 実装前補正の反映結果

- **A（状態4の専用文言）**: §12.2状態4に実装。「対象となる活動の記録はありますが、比較に必要な情報が不足しているため、選択の履歴を表示できません。」を実装、件数は含めない。自動テスト`State-4-no-comparable-answers`で確認。
- **B（母数の推測禁止）**: §12.2状態6・§12.3に実装。record単位の問題（親ID欠落・`answers`破損等）はどの比較グループの除外数にも計上しない設計とし、実装（`groupComparisonAnswerEvents`の`recordExcluded`/`answerLevelExclusionCount`を個別グループの`events`とは別に集計）もこれに忠実に従った。結果として、回答イベント単位の検証失敗は「どのグループに属するはずだったか」を特定できないため、本実装では**個別グループの「全◯件中△件」という母数付き表示は行わず**、一覧画面全体への一般的な注記（「一部の記録は、比較に必要な情報を確認できなかったため、この一覧には反映されていません。」）のみとした。これは§12.2が示した「全◯件中△件」表示を事実上使わない、より保守的な実装判断であり、母数を推測しないという訂正の趣旨により忠実（詳細下記「設計からの実装判断」参照）。自動テスト`Notice-separation`で確認。
- **C（`<thead>`印刷再掲の実PDF検証）**: 選択グリッド・選択肢全文対応表とも`<table>`に`<thead>`を実装し、ブラウザのネイティブ機能に委ねた。実PDF生成（後述）で6ページ全ページに列見出しが再掲されることを確認済み。
- **D（一覧画面の下部戻るバー）**: `BACK_MAP['s-answer-history-list']`の`dest`を上部`.back`と共有させることで、上下の戻るボタンが常に同一の遷移先・同一のfocus復帰先を持つことを構造的に保証した。自動テスト`Nav-basic`で上下両方の遷移・focus復帰を確認。focus復帰先消失時のフォールバック（一覧見出しへのfocus）も`Focus-fallback`で確認。
- **E（検証強化）**: §8.0（type↔detail.type対応表全文）・§8.1（配列の明示的除外、`selected`自体の存在検証、空白のみ文字列の無効化とtrim補正の禁止、built-in RP判定の`custom===false`への精緻化）をすべて実装。自動テスト`Validation-hardening`で確認。
- **F（相互参照の修正）**: 存在しなかった`§13.1`/`§13.3`参照を修正、「個別履歴」の定義先として誤用されていた`§12.3`参照を新設`§11.5`へ訂正、画面・PDFに実際に表示される凡例文言（§9.4）から内部節番号の埋め込みを除去した。実装後、全文書を再走査し他に未解決の破損参照が無いことを確認済み（grepによる全`§`参照の宛先存在チェック）。凡例文言に`§`が含まれないことは自動テスト`Legend-no-section-leak`で確認。

### 設計からの実装判断（新規の大きな仕様変更ではなく、訂正Bの趣旨の徹底）

設計文書§12.2状態6は「全◯件中△件は比較条件を満たさず除外されました」という母数付き文言を想定していたが、実装時に検証した結果、**回答イベント単位の検証失敗は、失敗した時点でその回答イベント自身の比較キー・条件シグネチャの一部が確定できない**ため、「どのグループの除外として数えるか」を安全に決定できないケースがほとんどであることが判明した（例: 選択肢の検証失敗は、たとえ親IDが分かっていても、その回答が属するはずだった条件シグネチャ別グループを特定できない）。これは訂正Bが禁止した「母数の推測」そのものにあたるため、個別グループの母数付き表示は実装せず、一覧画面全体への一般的な注記のみを実装した。この判断は訂正Bの要求（母数を推測しない）を字面通りではなくその趣旨に沿ってより保守的に実装したものであり、Phaseプロンプトが認める「実装中に判明した、既存の訂正要求と整合する実装細部」の範囲内と判断し、立ち止まらず実装した。ユーザー向けの体験としては、該当する除外が発生した場合に一覧画面で注記が表示される点は変わらない。

また、設計文書§14.3は`answerHistoryIsFocusable()`/`answerHistoryFirstFocusable()`という新規複製関数の作成を例示していたが、実装時に確認した結果、既存`trendIsFocusable()`/`trendFirstFocusable()`は（a11y-panelの`generate.js`生成ブロックとは異なり）既に非生成領域にあるプレーンなJS関数であり、本機能から直接再利用しても`generate.js`実行で巻き戻されるリスクが無いことを確認した。3つ目の同一ロジックの複製は実質的な利益がないため、既存の2関数をそのまま再利用した（新規関数は作成していない）。動作・判定条件は設計文書が要求するものと完全に同一。

### テスト結果（すべて本Phase中に実測、使い回しなし）

| テスト | 結果 |
|---|---|
| `tools/sst-weekly-report-pdf/answer-history-implementation-test.js`（新規） | **109/109 PASS** |
| `tools/sst-weekly-report-pdf/trend-implementation-test.js`（既存回帰） | **110/110 PASS** |
| `tools/sst-weekly-report-pdf/mobile-layout-fix-test.js`（既存回帰） | **76/76 PASS** |
| `tools/sst-weekly-report-pdf/pdf-print-implementation-test.js`（既存回帰） | **165/165 PASS** |
| `tools/record-dashboard-poc/*golden-tests.js`（13ファイル、既存回帰） | **全ファイルALL PASS**（合計1449チェック、内訳: backup-hardening 43、directions 27、golden 816、hiragana-katakana 148、katachi-awase 31、kurabeyou 30、nazori 76、okane 34、sawatte 67、shiritori2 41、sst-common-detail 41、tokei 37、ui 58） |
| `node generate.js`（1回目・2回目） | 2回とも無変更（`git status`差分0件）。冪等性確認済み。新規screen・focus管理・印刷CSSが`generate.js`実行後も無変更で残ることを確認（generator-injected blockへの依存なし） |

新規テストが検証した内容（抜粋、§11対応）: 全4対象type（rp/wq/quiz/story）の実fixture形状、同一設問への複数回回答、シャッフル順のみの違いが同一グループに留まること、WQのsituation-onlyとprompt-onlyの変更がそれぞれ別グループを生むこと、区切り文字（`:`/`|`/`"`）を含む回答文での構造化シグネチャの安全性、session内の1回答のみが不正な場合に他の有効な回答が残ること、malformed ID（空白のみ）・object（配列混入）・selected（存在しない/不一致）・pageIndex（非整数）のそれぞれの除外、6状態すべて（読み込み失敗・期間内記録なし・対象type無し・比較可能回答無し・比較可能・一部除外）、record単位通知と回答イベント単位除外の分離、storageの読み込みが1回のみであること（往復ナビゲーションで再読込されないこと）・read-only確認、320px/390pxでの横スクロール無し、グリッド・対応表・履歴の相互整合性、row-headerリンクからの個別履歴へのfocus移動、aria-hidden+読み上げ用テキストの両立、固定ボタン（ホーム/設定/学習のきろく）が新画面でもposition:absoluteへ切り替わること、印刷isolation（操作ボタン非表示・`#ahist-card`のみ可視化）。

### 実PDF生成検証（本Phase中に実施、PDFファイル自体はgitへコミットしていない）

Playwrightの`page.pdf()`でA4縦のPDFを実際に生成し、`poppler-utils`（`pdfinfo`/`pdftotext`/`pdftoppm`）で検証した（印刷用CSS/DOM検査のみでは確認完了と見なさない、Implementation Phase §9の要求に対応）。

- fixture: 1つの比較グループに、4週間全体にまたがる20件の回答イベント（週5件×4週）、長文回答（約140字×2種）を含む
- `pdfinfo`で確認したページ数: **6ページ**
- `pdftotext`で各ページのテキストを抽出し、「選択肢A」+「記録日時」が**6ページ中6ページすべて**に出現することを確認（`<thead>`のネイティブ印刷時repeatが実際に機能していることの実測確認）
- 操作ボタンの文言「PDFで保存する」がPDFテキスト全体に一切出現しないことを確認（印刷対象からの除外を確認）
- 長文回答（約280字）が省略・切り捨てされずPDFテキスト全体に完全な形で含まれることを確認（空白正規化後の完全一致で検証。改行による見かけ上の分断は`pdftotext`のplain-text抽出による折返しであり、実際のコンテンツは分断されていない）
- 凡例文言・比較説明文言のいずれにも`§`で始まる内部節番号が含まれないことを確認
- `pdftoppm`で1-4ページ目をPNG画像としてレンダリングし、目視でも週ブロック見出し・グリッド・選択肢対応表・個別履歴カードが崩れなく表示されることを確認（レンダリング画像は本Phaseの最終報告に添付する）

### UI/フォーカス/狭幅/固定ボタンの確認

- 320px/390px幅で横スクロールが発生しないことを自動テストで確認（`document.documentElement.scrollWidth <= window.innerWidth`）
- 390px・320px幅でのフルページスクリーンショットを撮影。一覧画面・詳細画面とも崩れなし
- 詳細画面を実際にスクロールした状態の単一viewportスクリーンショットでは、下部戻るバーが本来の「画面下部に固定される」設計通りに動作し、コンテンツと重ならないことを確認（フルページスクリーンショットでは固定要素の合成アーティファクトにより重なって見えるが、これは既存`#s-trend`画面の同条件のフルページスクリーンショットでも同様に発生する既知の挙動であり、本実装固有の不具合ではないことを比較確認済み）
- 固定ボタン（ホーム・設定・学習のきろく）が新画面でも`position:fixed`から`position:absolute`へ切り替わり、スクロールのたびに同じviewport座標へ再衝突しないことを確認（既存`SST-MONTHLY-TREND-MOBILE-LAYOUT-FIX-1`の対策パターンを新画面のCSSセレクタへ追加しただけで、対策ロジック自体・既存2画面への適用は無変更）

### 未確認・User/実機レビュー待ちの項目（CLAUDE.md §5 Real-Device Boundary）

以下はCloud環境のHeadless Chromiumでは確認できない、またはUser自身の確認が必要な項目であり、「自動検証PASS」をもって「確認済み」とは報告しない。

- iPad Safari・VoiceOverでの実際の読み上げ・操作性
- Blue2等のBluetooth switch・Tobii Eye Tracker 5等の実機入力
- 実機での200%ズーム時の挙動（自動検証はviewport縮小による近似のみ、実施していない）
- 実際のPDF保存操作（印刷ダイアログ→「PDFに保存」）をUserが実機で行った場合の見た目・ファイルサイズ・開きやすさ
- 複数の学習者・複数端末での実際の利用感
- 長期間（実際に4週間以上）蓄積された本物の記録データでの表示

### 不具合・懸念点（本Phase中に発見し対応したもの）

実装中に見つかった軽微な表示上の重複（一覧画面の見出し`<h2>`が直上の`.stitle`と文言が完全に重複していた）を、視覚的には`.stitle`のみを表示し見出し自体はスクリーンリーダー・focus管理専用として残す形（既存`.trend-table caption`と同じclip技法）で修正した。機能・比較ロジックには影響しない表示専用の修正であり、Allowed File（`sst-app.html`）内の変更として実施した。

### Push/Merge/Deploy/Preview同期

本Phaseでは一切実施していない。チェックポイントはこのPhase専用worktree内のlocal commitとしてのみ存在する。

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft | 2026-10-01 | `SST-ANSWER-CHANGE-VISUALIZATION-DESIGN-1`。初版。 |
| v1.0 Correction 1 | 2026-10-01 | `SST-ANSWER-CHANGE-VISUALIZATION-DESIGN-CORRECTION-1`。図＋表のハイブリッド化、tier内訳除外、branch対象外化、3分類再監査、emotion/phrase除外。 |
| v1.0 Correction 2 | 2026-10-01 | `SST-ANSWER-CHANGE-VISUALIZATION-DESIGN-FINALIZE-1`。必須訂正A-G: 選択グリッドへの再設計、tier評価表現の排除、ID順列固定、構造化シグネチャ、jitter不要設計、既存read関数の再利用、表示期間の一本化。 |
| v1.0 Correction 3 | 2026-10-02 | `SST-ANSWER-CHANGE-VISUALIZATION-DESIGN-FINAL-CORRECTION-1`。必須補正A-H: WQの`situation`/`prompt`両方を含む実field構造化シグネチャ（`||`の誤用を撤回）、保存snapshot一致と教材条件完全同一性の区別を統一、選択肢全文対応表の新設と週境界分割ルール、record/回答イベントの区別と型別`ts`意味の確定・3キー表示順、14項目の検証ルールと回答イベント単位の除外粒度、6区分の空状態/失敗状態、`#s-trend`への導線確定と全遷移のfocus/データ再取得方針、aria-hidden+読み上げテキストの設計・320px断定の撤回・break-inside:avoid粒度の訂正。branchのノード単位比較の表現を是正。 |
| v1.0 Correction 4 | 2026-10-02 | `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`の§3A-Fに基づく実装前補正。(A) 状態4に専用説明文言を追加し空リストとの混同を防止（§12.2）。(B) record単位の問題で母数・除外グループが確定できない場合の計上禁止、「全◯件中△件」文言の使用条件を明文化（§12.2状態6・§12.3）。(C) 選択グリッド・対応表の列見出しを`<thead>`実装とし、実PDFでの複数ページ見出し再掲検証を必須化（§11.4）。(D) 比較キー一覧画面の下部戻るバーの遷移先・focus復帰先を明記（§14.1・§14.3）、focus復帰先消失時のフォールバックを追加。(E) 検証ルールを強化: object判定から配列を明示的に除外（ルール7・12）、`selected`自体の存在検証を独立ルール化（ルール12）、ID/text/必須テキストfieldの空白のみ文字列を無効化しtrim補正を禁止（ルール9・10・12b・15）、built-in RP判定を`custom===false`の厳密一致に精緻化（ルール3）、top-level `type`↔`detail.type`対応表を全文記載（§8.0）。(F) 相互参照の破損を修正: 「個別履歴」の定義先として誤って多用されていた`§12.3`（実際は件数の混同防止の節）を、新設した§11.5（個別の回答履歴）へ正す。存在しない`§13.1`/`§13.3`参照を削除・訂正。画面・PDFに実際に表示される凡例文言（§9.4）から内部節番号の埋め込みを除去。 |
| v1.0 Implementation | 2026-10-02 | `SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1`。実装完了（Implementation Record追記）。`sst-app.html`に2新規screen、`assets/js/sst-record-detail.js`に比較用抽出・グループ化・状態判定の新規export、新規テスト109件、既存回帰テスト全件（trend 110・mobile-layout-fix 76・pdf-print 165・golden tests計1449）PASS、`generate.js`冪等性確認、実PDF生成検証（6ページ、`<thead>`全ページ再掲確認）。push/merge/deploy/Preview同期は未実施、User/実機レビュー待ち。 |
