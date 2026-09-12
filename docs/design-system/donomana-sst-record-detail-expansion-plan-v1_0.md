# どのまな SST Record Detail — Post-v1 Expansion Plan（Version 1.0 Draft）

- **Status: DESIGN ONLY DRAFT**
- **Implementation: NOT STARTED**
- 発行: 2026年9月（Phase SST-RECORD-DETAIL-EXPANSION-DESIGN-1）
- 位置づけ: `donomana-sst-record-detail-contract-v1_0.md`（Roleplay Record Detail v1、Production Released済み）を継承し、built-in Roleplay以外の残り10活動への横展開を検討する後続設計文書。v1 Contractを置き換えない。v1で確定した原則（Event-based・Snapshot Policy・Backward Compatibility・schemaVersion方針等）はすべてそのまま引き継ぐ。
- 契機: ROLEPLAY RECORD DETAIL v1の正式Close時に、ユーザーから「他10活動への横展開・custom Roleplay対応・共通learning-records.html統合は、利用開始後の別Phaseとして扱う」という明示的な先送り指示があり、その「別Phase」の設計を先行して整理する。
- 変更ファイル: 本ドキュメントのみ。`sst-app.html`・`generate.js`・Foundation API・localStorage schema・Viewer・CSVのいずれも本Phaseで変更していない（Production機能コード変更 0件）。

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-sst-record-detail-contract-v1_0.md` | Roleplay v1 Contract。本文書はこれを継承・拡張する |
| `donomana-learning-record-standard-v1_0.md` | サイト共通Learning Record Foundation標準。継承関係は変わらない |
| `donomana-learning-record-ui-standard-v1_0.md` | Viewer/CSV/Delete/Accessibility方針。継承関係は変わらない |

---

## 1. Baseline

- Production: `main = origin/main = 6cf0db1`
- worktree: `for-all-children-to-learn-sst-record-detail-expansion-design1`
- branch: `design/sst-record-detail-expansion-v1`

### 1.1 Roleplay v1 Completed State（現状再確認）

`6cf0db1`時点のProductionには以下が含まれる（すべてRelease済み）:

- Foundation: `recordActivity(type, lv, result, detail)`（`detail`はoptional、渡されない限りlegacy shapeのまま）
- built-in Roleplay Pilot: `answerRP()`内で`currentLv!=='custom'`の場合のみ`detail`snapshotを付与
- Design Contract v1.0文書（`docs/design-system/donomana-sst-record-detail-contract-v1_0.md`）
- Viewer Pilot: 週次レポート(`s-report`)に「📝くわしいきろく」セクション（`detail`を持つrecordのみProgressive Disclosure表示）
- CSV Pilot: 週次レポートに「📄今週のきろくをCSVで書き出す」ボタン（7列、`detail`なしrecordは後半4列空欄）

---

## 2. Scope

対象10活動（built-in Roleplayは対象外、完成済み）:

1. ことばクイズ（wq）
2. SSTクイズ（quiz）
3. ソーシャルストーリー（story）
4. 分岐ストーリー（branch）
5. custom Roleplay（rp, `currentLv==='custom'`）— Privacy Design整理のみ、実装対象外を継続
6. 写真で練習（photo）
7. 感情カード（emotion、現状type未割当）
8. きもち温度計（thermo）
9. フレーズ集（phrase、現状type未割当）
10. 呼吸活動（breath）

---

## 3. Design Principles（v1から継承、変更なし）

Event-based / 1 meaningful action = 1 record / ID+snapshot（IDのみ禁止） / 入力方式非依存の単一finalization point / 正解・不正解への意味変換禁止 / 能力推定禁止 / 感情状態の自動推定禁止 / PII追加禁止 / `schemaVersion:1`維持 / `detail`はoptional / legacy-new-mixed互換 / migration不要 / localStorage key維持 / Viewerはprogressive disclosure / CSVは人間可読7列優先。

---

## 4. 10活動のコード実態調査

### 4.1 ことばクイズ（wq）

| 項目 | 内容 |
|---|---|
| データ | `WORD_QUIZ[lv][i] = {id:'wq_1_01', emoji, sit, q, choices:[{id:'c1',ico,txt,ok,tier?,fb}], ...}` |
| 安定ID | あり（問題id・選択肢id） |
| 現在のrecord | 完了時1回のみ、`recordActivity('wq', currentLv, 'done')`（`buildWordQuiz()`内、全問終了時） |
| Finalization point候補 | `answerWQ(ci)` — `wqShuffled[ci]`が確定選択肢、`tierOf(c)`で`best`\|`good`\|`try`を導出（`c.ok`真偽値＋`c.tier`の`'try'`マーカーのみ、`good`は「非該当」の既定値） |
| Snapshot候補 | `activityId: q.id`, `activityTitle: q.sit`(場面文), `choices: wqShuffled.map(c=>({id,text:c.txt,level:tierOf(c)}))`, `selected: {id,text,level}` |
| Privacy | built-inのみ対象、教員編集(fb差し替え)UIはあるが選択肢文言自体は編集不可のため機微情報混入リスクは低い |
| 既存分岐点 | Decision 1（v1 Contract §4）により**記録タイミング変更は本Phaseでは決定しない**。ここでは「finalization pointが安全に存在する」という技術的事実のみ確認する |

### 4.2 SSTクイズ（quiz）

| 項目 | 内容 |
|---|---|
| データ | `QUIZZES[lv][i] = {id:'qz_1_01', ico, q, choices:[{id:'c1',txt,ok,credit,tier?,fb}]}` |
| 安定ID | あり |
| 現在のrecord | 完了時1回、`recordActivity('quiz', currentLv, pct+'%')` |
| Finalization point候補 | `answerQuiz(ci)` — `quizTierOf(c)`は`best`\|`good`\|`support`\|`try`の4値（WQより1値多い）。得点は`credit===true`の厳密一致でのみ加算、tierとは独立 |
| Snapshot候補 | 同様の`scenario/choices/selected`形。`selected.level`は`support`を含みうる点をWQと区別して記載する必要あり |
| Privacy | WQと同様、低リスク |

### 4.3 ソーシャルストーリー（story）

| 項目 | 内容 |
|---|---|
| データ | `STORIES[lv][i] = {id:'st_1_01', cover, title, pages:[{illus,bg,txt,q?,choices?}]}` |
| 安定ID | あり（story id、選択肢id）。ただし**1話につき選択肢を持つページが複数存在しうる**（`answerStory(pageIdx,ci)`が`pageIdx`を引数に取る設計から実証済み） |
| 現在のrecord | 最終ページ到達時1回のみ、`recordActivity('story', currentLv, 'done')` |
| Finalization point候補 | `answerStory(pageIdx, ci)` — ページごとに個別発火。**1話1recordにするか、選択ページごとに複数recordにするかは設計判断が必要**（後述4.3.1） |
| Snapshot候補 | `activityId: story.id`, `activityTitle: story.title`, ページ単位なら`pageIndex`も含める案 |
| Privacy | 低リスク |

**4.3.1 論点**: 「1話1record」を維持する場合、`detail`に全選択ページの配列（`pages:[{pageIndex,choices,selected}]`）を持たせる設計が、Event-based原則（v1では分岐ストーリーの`route`集約と同型）と整合する。「ページごとに複数record」にする場合はEvent粒度が変わるため、Wave判断時に明示的に選ぶ必要がある。**本文書ではどちらか一方を決定しない**（Open Decisionとして4.9で明記）。

### 4.4 分岐ストーリー（branch）

| 項目 | 内容 |
|---|---|
| データ | `BRANCH_STORIES[lv][i] = {icon,title,start,nodes:{key:{ico,txt,choices:[{txt,level,next?|ending?}]}}}` |
| 安定ID | **なし**（node/choiceともに安定idを持たない、nodeは文字列keyのみ） |
| 現在のrecord | エンディング到達時1回、`recordActivity('branch', currentLv, ending.level)` |
| 既存の強み | `chooseBranch()`が選択のたびに`currentBranchPath.push(choice.txt)`を実行し、**選択テキストの配列が実行時に既に構築済み**（表示用の`branch-path-trace`に利用中） |
| Snapshot候補 | `activityId: null`(idなし), `activityTitle: story.title`, `route: currentBranchPath`(既存配列そのまま), `ending: {title, desc, level}` |
| Finalization point | `renderBranchEnding(ending)` — 既存の記録呼び出し箇所そのもの |
| Privacy | 低リスク、built-inデータのみ |
| 実装難易度 | **Low**（v1のRoleplayに次いで低コスト。`route`は既に計算済みの変数を渡すだけ） |

### 4.5 custom Roleplay（rp, `currentLv==='custom'`）— 実装対象外・Privacy整理のみ

| 項目 | 内容 |
|---|---|
| データ源 | `teacherCustomScenes[]`（`sst_teacher_custom_v1`）を`syncCustomToScenes()`が`SCENES['custom']`へ変換。変換時に`teacherCustomScenes[].id`は引き継がれない |
| 自由記述リスク | `title`・`sit`（場面文）・`thought`（心の声）・`choices[].txt`・`tip`のすべてが教員の自由入力。生徒名・家庭状況・個別トラブル等が入力される可能性を排除できない |
| CSV/Viewerへの影響 | 現状`detail`が付与されないため、Viewer/CSVいずれにも一切出現しない（意図通り） |
| 分類維持 | **`Deferred pending Privacy Review`を継続** |
| 将来Privacy Review論点（列挙のみ、決定しない） | (a) 教員に「この文言はCSV等で外部に出うる」という明示同意UIが必要か / (b) `teacherCustomScenes[].id`を`syncCustomToScenes()`へ伝播させ、ID参照だけは可能にするか（textは出さない案） / (c) custom分は`detail`を全く生成せず、`activityTitle`程度の最小情報のみ許可する中間案 / (d) 学校単位の運用ガイドライン整備で対応し技術的制御はしない案 |

### 4.6 写真で練習（photo）

| 項目 | 内容 |
|---|---|
| データ | `photoScenes[] = {id, title, sit, img, fb, choices:[{txt,level}]}`（全件teacher/user作成、built-inデータなし） |
| 安定ID | scene idはあり、choiceには**id・fbともになし**（`chosen.fb`ではなくscene全体の`s.fb`をbestの時だけ使う設計） |
| 現在のrecord | 選択直後、`recordActivity('photo', 0, lv)` |
| **最重要Privacy注意** | `photoScenes[].img`はbase64またはURL形式の画像データを保持しうる。**絶対に`detail`へ含めない**（v1 Contract §8の既存原則、custom RPと同様に全件user-generated content） |
| Snapshot候補（画像を除く） | `activityId: s.id`, `activityTitle: s.title`, `choices: [{id:null,text:c.txt,level:c.level}]`(id無し), `selected` |
| 実装難易度 | **Medium**（技術的には低いが、全件custom dataという性質上、custom Roleplayと同種のPrivacy論点が生じうる。sceneの`sit`(場面文)自体も教員自由記述） |
| 推奨 | custom Roleplayと同じ理由（教員自由記述への懸念）により、**Wave分類はDeferred寄りとし、Privacy Review後に判断**することを推奨（4.9参照） |

### 4.7 感情カード（emotion）

| 項目 | 内容 |
|---|---|
| データ | `EMOTIONS[i] = {face, name, kana, desc, when:[]}`（固定配列、教員編集不可） |
| 安定ID | 数値idなし、`name`が事実上の安定キー（built-in固定リストのため実質的に安定） |
| 現在のrecord | **0件**（`showED(i)`はrecordActivity呼び出しなし） |
| Finalization point候補 | `showED(i)` — カードを開いた瞬間。「一覧を眺めた」ではなく「特定のカードを選んだ」という明確な操作 |
| type新設 | `'emotion'`を`ACT_LABEL`へ追加が必要（新規type文字列） |
| Snapshot候補 | `selected: {label: e.name, face: e.face}` |
| Semantics（v1 Design Contract §5・§16を継承） | 「このカードが選択された」という**操作事実のみ**。「この子はこの感情である」という診断的記録にしない。CSV/Viewer表示文言も「選んだカード」であり「診断された感情」ではないことを明記する |
| Privacy | 低リスク、built-in固定データ |
| 実装難易度 | **Low** |

### 4.8 きもち温度計（thermo）

| 項目 | 内容 |
|---|---|
| データ | スライダー値0〜10、`updateThermo(val)`が表示（色・アイコン・ラベル）を更新 |
| 現在のrecord | 既にあり、`recordActivity('thermo', 0, String(val))` |
| 選択肢という概念 | **なし**（連続値のスライダー） |
| detail拡張の要否 | v1 Design Contract §20.9で既に検討済み: 「きもち温度計は`detail`拡張の対象外としてよい」と結論済み。**既存`result`(値そのもの)で用が足りる** |
| 本Phaseでの扱い | 新たなdetail設計は行わない。ただし将来、値に対応する「表示された対処法テキスト」まで記録するかは別途Open Decision（v1 Contractで既に「二重管理を避けるため見送り」と結論済み、変更なし） |
| Semantics | 選択値は「本人の実際の感情状態」ではなく「温度計上でこの値が選択された」という操作事実。既存Help文言等に診断的表現がないことをここで再確認（変更提案はしない） |

### 4.9 フレーズ集（phrase）

| 項目 | 内容 |
|---|---|
| データ | `PHRASES[cat] = {ico, name, list: [string, ...]}`（39フレーズ、個別id・fbなし） |
| 現在のrecord | **0件** |
| Finalization point候補 | `speakPhrase(txt)`・`copyPhrase(txt)` — 2つの独立した意味的関数がすでに存在する |
| type新設 | `'phrase'` |
| meaningful action定義 | **TTS実行とコピー実行は別のmeaningful actionとして扱う**（v1 Design Contract Decision 3を継承、「閲覧だけでは記録しない」原則を維持） |
| Snapshot候補 | `category: currentPhraseCat`, `phrase: txt`, `action: 'spoken'\|'copied'` |
| Duplicate防止上の注意 | `speakPhrase`/`copyPhrase`はどちらも独立したsemantic関数であり、mouse/keyboardいずれの経路からもこの2関数のいずれかを必ず1回だけ通る（フレーズ集のkeyboard対応は既にEnter/Space→`speakPhrase`、コピーボタンは別途`copyPhrase`という構造がSST-PHRASE-LIBRARY-FIX-1で確立済み）。**この2関数をfinalization pointとすれば、記録処理を追加しても入力方式ごとの重複は発生しない** |
| Privacy | 低リスク、built-in固定文言 |
| 実装難易度 | **Low** |

### 4.10 呼吸活動（breath）

| 項目 | 内容 |
|---|---|
| データ | シーン/選択肢という概念なし。`s-breath`画面表示から1秒後に固定で`recordActivity('breath',0,'done')` |
| 現在のrecord | あり（固定文字列`'done'`のみ） |
| meaningful action候補 | 「画面表示から1秒後」という現在の実装は、実質的に「呼吸活動を開始した」ことの代理指標であり、個々の吸う/吐くtickや1呼吸サイクル単位の記録は**行わない**（v1 Contract Decision 6の既存結論どおり） |
| detail候補 | `{detailSchemaVersion:1, type:'breathing_activity', activityTitle:'きもちを落ち着ける', completionStatus:'done'}`（v1 Contract §9に既存の設計案があり、そのまま踏襲） |
| 保存しないもの | 「落ち着けた」「気持ちが改善した」等の心理的効果（測定する仕組みが存在しないため） |
| 実装難易度 | **Low**（既存detail設計案がそのまま使える、コード変更は`recordActivity`呼び出しに第4引数を足すだけ） |

---

## 5. Activity Matrix

| Activity | 既存record | Meaningful action | Finalization point | Snapshot候補 | Privacy risk | 難易度 | 推奨Wave |
|---|---|---|---|---|---|---|---|
| 感情カード | 0件 | カード選択 | `showED(i)` | label, face | 低 | Low | Wave 1 |
| フレーズ集 | 0件 | TTS実行／コピー実行（別々） | `speakPhrase()`/`copyPhrase()` | category, phrase, action | 低 | Low | Wave 1 |
| 呼吸活動 | あり(固定値) | 画面表示から1秒後(既存代理指標) | 既存呼び出し箇所 | activityTitle, completionStatus | 低 | Low | Wave 1 |
| 分岐ストーリー | あり(完了時) | エンディング到達（route集約） | `renderBranchEnding()` | route[], ending | 低 | Low | Wave 1 |
| ことばクイズ | あり(完了時) | (未決: 完了 or 問題ごと) | `answerWQ(ci)` | scenario, choices, selected | 低 | Medium | Wave 2 |
| SSTクイズ | あり(完了時) | (未決: 完了 or 問題ごと) | `answerQuiz(ci)` | 同上+support tier | 低 | Medium | Wave 2 |
| ソーシャルストーリー | あり(完了時) | (未決: 話単位 or ページ単位) | `answerStory(pageIdx,ci)` | 同上+pageIndex | 低 | Medium | Wave 2 |
| きもち温度計 | あり(既存で十分) | (拡張不要、既存結論維持) | 該当なし | 該当なし | 低 | N/A | 対象外(既に完結) |
| 写真で練習 | あり(完了時) | 選択確定 | `answerPhotoPlay()` | scene, choices(id無), selected | **中〜高**（全件教員自由記述、画像混入厳禁） | Medium | Deferred寄り(Privacy確認後) |
| custom Roleplay | あり(完了時、detailなし) | (実装せず) | (実装せず) | (実装せず) | **高**（自由記述、生徒情報混入の可能性） | — | Deferred pending Privacy Review |

---

## 6. 推奨横展開順（Wave）

### Wave 1（低リスク・既存Decision確定済み・実装コスト低）

1. 分岐ストーリー（`route`が既に実行時計算済み、v1のRoleplayに次ぐ低コスト）
2. 感情カード（新規type追加のみ、built-in固定データ）
3. フレーズ集（新規type追加のみ、built-in固定データ、TTS/コピーの2アクション定義が必要）
4. 呼吸活動（既存detail設計案がv1 Contractに既にあり、そのまま適用可能）

**Wave 1に共通する特徴**: いずれもfinalization pointが既に明確に存在し、custom/自由記述データを一切含まない。Privacy論点が実質的にゼロに近い。

### Wave 2（記録タイミング自体の再設計を伴う、より慎重な検討が必要）

5. ことばクイズ
6. SSTクイズ
7. ソーシャルストーリー

**Wave 2が慎重を要する理由**: 現在「完了時1回」の記録タイミングを「問題/ページごと」に変更するかどうかという、v1 Contract Decision 1が明示的に保留した論点に正面から向き合う必要がある。単なる横展開ではなく、**記録タイミングの再設計を伴う意思決定**が必須。

### Deferred（Privacy Reviewが先に必要）

- **写真で練習**: 全件教員自由記述データという性質上、custom Roleplayと同種の懸念がある。画像混入を防ぐガードは技術的に容易だが、`title`/`sit`テキスト自体の自由記述性はcustom Roleplayと同格のリスクと判断
- **custom Roleplay**: 既存方針を継続、実装しない

### 対象外（既に完結）

- **きもち温度計**: v1 Contractで「detail拡張不要」と既に結論済み。今回変更提案なし

---

## 7. Viewer Mapping

既存Viewer（週次レポートの「くわしいきろく」セクション、Progressive Disclosure）をそのまま再利用する前提での表示案。

| Activity | 常時表示（サマリー行） | 詳細表示（展開後） |
|---|---|---|
| 分岐ストーリー | 教材名＋たどり着いたエンディング | 通過したroute（選んだ選択肢テキストの順序リスト） |
| 感情カード | 教材名＋選んだカード名 | （追加詳細なし、顔文字程度） |
| フレーズ集 | 教材名＋実行した操作（読み上げ／コピー）＋フレーズ文言 | カテゴリ名 |
| 呼吸活動 | 教材名＋完了 | （追加詳細なし） |
| ことばクイズ／SSTクイズ／ソーシャルストーリー | （Wave 2、記録タイミング決定後に設計） | 同上 |

**共通原則**: 既存の`buildDetailRecordList(weekLog)`（v1実装）を「`detail`があれば表示、なければ非表示」という汎用ロジックのまま維持し、各activity固有の表示内容だけを`detail.type`で分岐する拡張を想定する。**Common Viewerを新設しない**という既存UI Standard方針（§5）をここでも踏襲する。

---

## 8. CSV Mapping

既存7列（日時・教材・モード・場面・提示された選択肢・選んだ回答・教材内区分）への意味的マッピングを検討する。

| Activity | 場面 | 提示された選択肢 | 選んだ回答 | 教材内区分 | 7列で表現可能か |
|---|---|---|---|---|---|
| 分岐ストーリー | story.title | （選択肢セットではなくroute全体のため要検討、下記参照） | route最終到達点 or 全route | ending.level | **要検討**（下記8.1） |
| 感情カード | （該当なし、空欄） | （該当なし、空欄） | 選んだカード名 | （該当なし、空欄） | 可能（多くの列が空欄になる） |
| フレーズ集 | カテゴリ名 | （該当なし、空欄） | フレーズ文言 | （該当なし、空欄、または`action`列として転用検討） | ほぼ可能（「教材内区分」列を`action`(spoken/copied)に転用するか要検討） |
| 呼吸活動 | （該当なし、空欄） | （該当なし、空欄） | （該当なし、空欄） | completionStatus | 可能 |
| ことばクイズ／SSTクイズ／ソーシャルストーリー | 問題文/ページ文 | 選択肢flatten | 選んだ回答 | tier | 可能（Wave 1と同型） |

### 8.1 CSV CONTRACT EXTENSION REQUIRED（分岐ストーリーのroute表現）

分岐ストーリーの`route`は複数ステップの配列であり、既存の「提示された選択肢」列（1回の意思決定の選択肢セット）とは意味が異なる。2つの案を提示する。

- **案A**: 「提示された選択肢」列を「通過したroute」に転用し、`①route[0]｜②route[1]｜③route[2]`のようにflatten表示する（既存flatten機構を再利用できる、列の意味が微妙にずれる）
- **案B**: 「教材内区分」列に最終エンディングのlevelのみ出力し、route詳細はCSVでは省略してViewerでのみ確認可能とする（既存7列の意味を一切変えない、route詳細はCSVに出ない）

**本文書では決定しない。** 実装Phase開始時にUser判断が必要な`CSV CONTRACT EXTENSION REQUIRED`案件として明示する。フレーズ集の「教材内区分→action」転用も同様に軽微だが要決定の論点として残す。

**列追加は今回提案しない**（既存7列の意味範囲内での転用のみ検討し、8列目以降の新設はスコープ外とする）。

---

## 9. Detail Schema Drafts

いずれも`detailSchemaVersion:1`固定、既存フィールド命名規則（`scenario`/`choices`/`selected`等）を踏襲。

```js
// 分岐ストーリー
detail: {
  detailSchemaVersion: 1,
  type: 'branch_ending',
  scenario: { title: story.title },           // idなし(既存データにidが無いため)
  route: ['①の選択肢テキスト', '②の選択肢テキスト', ...],  // currentBranchPathそのまま
  ending: { title, desc, level }
}

// 感情カード
detail: {
  detailSchemaVersion: 1,
  type: 'emotion_selection',
  selected: { label: 'うれしい', face: '😊' }
}

// フレーズ集
detail: {
  detailSchemaVersion: 1,
  type: 'phrase_action',
  category: 'help',
  phrase: '先生、ちょっといいですか？',
  action: 'spoken' // | 'copied'
}

// 呼吸活動
detail: {
  detailSchemaVersion: 1,
  type: 'breathing_activity',
  activityTitle: 'きもちを落ち着ける',
  completionStatus: 'done'
}

// ことばクイズ / SSTクイズ / ソーシャルストーリー（Wave 2、記録タイミング決定後に確定）
detail: {
  detailSchemaVersion: 1,
  type: 'wq_choice' | 'quiz_choice' | 'story_choice',  // 案
  scenario: { id, title },
  choices: [ { id, text, level } ],
  selected: { id, text, level }
}
```

---

## 10. Privacy Classification（総括）

| 区分 | Activity |
|---|---|
| 低リスク（built-in固定データのみ） | 分岐ストーリー、感情カード、フレーズ集、呼吸活動、ことばクイズ、SSTクイズ、ソーシャルストーリー |
| 高リスク（教員/利用者自由記述を含む） | custom Roleplay（既存Deferred継続）、写真で練習（新規Deferred推奨） |
| 対象外 | きもち温度計（既にv1で結論済み、拡張不要） |

---

## 11. Test Contract（将来実装時の最低要件）

### 11.1 共通必須（全Wave共通）

1. 1 meaningful action = exactly 1 record
2. mouse/keyboard等、入力方式によらず同一detail形状
3. snapshot integrity（日本語・記号を含む文言のsave→reload完全一致）
4. reload永続化
5. legacy/new/mixed compatibility
6. Viewer回帰なし（既存detail-lessセクションを含む）
7. CSV回帰なし（既存7列・既存機能）
8. Privacy境界（custom/写真等の対象外activityにdetailが混入しない）
9. console/page error 0

### 11.2 Activity固有

- **分岐ストーリー**: `route`が実際の選択順序と一致すること、中断（エンディング未到達のまま離脱）時に不完全recordを作らないこと
- **感情カード**: カードを開いただけ（詳細画面表示）であり「診断」ではないという表示文言の確認
- **フレーズ集**: TTSとコピーがそれぞれ独立したrecordとして残ること、同一フレーズへの連続操作で意図しない重複がないこと
- **呼吸活動**: 既存の「1秒後固定」タイミングが変更されていないことの回帰確認
- **ことばクイズ／SSTクイズ／ソーシャルストーリー**: 記録タイミング変更を伴う場合、完了時recordとの共存/置換方針の確認、教員編集（fb差し替え）後もIDベースのsnapshot参照が破綻しないこと

---

## 12. Monday User Feedback Slot

> **Pending real-world use feedback.**
>
> 14日（月）の実利用開始後、以下の観点でフィードバックを収集し本セクションへ追記する。
>
> - Viewer usability（くわしいきろくセクションの見やすさ・情報量）
> - CSV usability（列構成・Excel互換性・実運用での使い勝手）
> - 欲しい追加情報（教員から見て記録に足りないもの）
> - 不要だった情報（記録として冗長・不要だったもの）
> - confusion（利用者が誤解した表現・操作）
> - teacher workflow（実際の指導フローとの適合度）
> - bug / request

現時点では空欄。実データに基づかない推測でこのセクションを埋めない。

---

## 13. Separate Finding: 共通 `learning-records.html` 統合

**今回調査のみ、実装しない。**

- SSTアプリ（`sst-app.html`）は現状、他アプリと異なり独自の週次レポート画面（`s-report`）を持ち、サイト共通の`learning-records.html`（存在する場合）とは統合されていない
- 境界: `sst_activity_log_v1`はLearning Record Foundation（`donomanaRecordReadLog`/`WriteLog`）を通じて保存されており、Foundation層自体はサイト共通仕様に準拠している。統合されていないのは**表示層（Viewer）のみ**
- 将来統合する場合の候補architecture（決定しない、列挙のみ）:
  (a) `sst-app.html`の週次レポートを維持しつつ、`learning-records.html`側から`sst_activity_log_v1`を読み取り専用で横断表示する
  (b) `sst-app.html`固有のUI（バッジ・週次グラフ等、Learning Recordではない要素を含む）を分離し、Learning Record部分のみ共通画面へ委譲する
  (c) 現状維持（各アプリが自分のViewerを持つという既存UI Standard方針をSSTでも継続）
- **本Phaseの10活動横展開とは完全に別Phaseとして扱う**（Design Contract v1・本文書のいずれのWaveにも含めない）

---

## 14. Open Decisions（未決事項）

1. ことばクイズ／SSTクイズ／ソーシャルストーリーの記録タイミングを「完了時のみ」から「問題/ページごと」へ変更するか（Wave 2着手前に必須の判断）
2. 分岐ストーリーCSVでの`route`表現方式（案A: 選択肢列へ転用 / 案B: CSVには出さずViewerのみ）
3. フレーズ集CSVでの「教材内区分」列を`action`(spoken/copied)へ転用するか
4. 写真で練習をDeferredのままにするか、custom Roleplayとは別扱いで先に進めるか（Privacy Review次第）
5. custom Roleplay Privacy Reviewの実施時期・実施方法
6. 共通`learning-records.html`統合の要否・時期（Separate Finding、決定しない）

---

## 15. Summary Checklist

- [x] Production変更0件（本Phase）
- [x] 10活動すべてコード実態調査（実コード読み込みに基づく、推測なし）
- [x] meaningful action定義（活動ごと）
- [x] finalization point特定（活動ごと）
- [x] snapshot候補確定（活動ごと）
- [x] Privacy分類（低リスク／高リスク／対象外）
- [x] duplicate prevention方針（既存finalization pointの単一性を活動ごとに確認）
- [x] Viewer mapping
- [x] CSV mapping（要拡張決定事項を明示）
- [x] schema draft（Wave 1の4活動、Wave 2は方針のみ）
- [x] Activity Matrix完成
- [x] Wave 1 / Wave 2 / Deferred確定
- [x] Test Contract策定
- [x] Monday feedback slot作成（空欄、実データ待ち）
- [x] common learning-records統合はSeparate Finding（決定せず）
- [x] docs-only
- [x] push / merge / deploy 0

---

## 16. Recommended Next Implementation Phase

`SST-RECORD-DETAIL-WAVE1-FOUNDATION-1`（仮称）— Wave 1の4活動（分岐ストーリー・感情カード・フレーズ集・呼吸活動）のうち、**分岐ストーリーを第一候補**として1活動ずつ実装する。理由: `route`が既に実行時に計算済みでRoleplay v1と同型の低コスト実装が可能、かつ4活動中もっとも「何を記録すべきか」が明確（エンディングとそこに至った道筋）。

ただし着手は、14日（月）の実利用フィードバックを踏まえたユーザーの新たな明示的承認を得てから行う。本Phase単独では実装Phaseへ自動的に進まない。

---

## 変更履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft | 2026-09-12 | Phase SST-RECORD-DETAIL-EXPANSION-DESIGN-1。初版。sst-app.html(`6cf0db1`)の実コード調査に基づく設計。実装なし。 |
