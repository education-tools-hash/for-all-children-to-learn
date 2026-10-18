# Donomana Access Phase 5B — 教員観察記録 設計 v2.1（Draft）

> **DRAFT / NOT YET APPROVED**
> 本文書はDesign v2.0の後継候補（Draft）であり、ユーザーによる最終承認を受けていません。
> v2.1が正式承認されるまでは、`donomana-access-assessment-design-v2_0.md`の承認済み事項が引き続き有効です。
> 本文書はv2.0を削除・上書きしません。

- Phase: DONOMANA-ACCESS-PHASE-5B-DESIGN-V2-1-PERSISTENCE-1（DESIGN DOCUMENT ONLY / DRAFT CHECKPOINT）
- 作成日: 2026-10-18
- 先行調査: DONOMANA-ACCESS-PHASE-5B-OBSERVATION-DESIGN-1（READ-ONLY調査）、DONOMANA-ACCESS-PHASE-5B-DESIGN-V2-1-1（設計レビュー）
- Production main（fresh確認済み）: `e0558c9ae157ebe96346695803058446da8cb13e`（期待値と一致、drift無し）
- Phase 5A checkpoint（確認済み）: `edc60af02fd947d1fba1f7c756feee9dcdb6a2e3`
- Design v2.0 checkpoint（確認済み、不変・無変更）: `533b0ad4fe1a112b4ca8638a1d5e8e10a5bfd0ec`
- コード実装・既存文書・既存worktree・既存記録schema・Production main・Preview mainへの変更は本Phaseでは一切行っていません。

---

## 0. 基本理念（v2.0から継承、変更なし）

- 子どもを教材に合わせるのではなく、子どもの可能な動きに教材を合わせる。
- 入力方法の適性や本人の能力をアプリが断定しない。
- 操作回数の多さを主体性・意欲と同一視しない。
- 観測データと教員の解釈を分離する。
- 提案は参考情報であり、本人の実情に合わせて利用する注意書きを必須とする。
- 自力操作を支援付き操作より優れていると評価しない。身体的支援がある活動も尊重する。
- 観察記録を入力方式の自動ランキング・能力評価・主体性判定に使用しない。

---

## 1. 既存データ構造（Phase 5A checkpoint現物確認結果、変更なし）

- `donomana_access_log_v1`: `{schemaVersion:1, sessionId, inputMethod, startedAt, endedAt, events[]}`。`inputMethod`は`'touch'/'switch'/'keyboard'/'swipe'`。
- `sessionId`は`makeSessionId()`で生成（`'access-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8)`）。暗号学的一意性は要求しない。`state.sessionId`は`startActivity()`で生成され、次の`startActivity()`まで保持される（終了画面遷移後も保持される）。
- `clearSessions()`は**キー全体を削除**する。個別セッション単位の削除機能は現状存在しない。
- `appendSession()`は`MAX_SESSIONS=200`を超えると古いものから切り捨てるが、**どのsessionIdが切り捨てられたかを自身は呼び出し元に返さない**。呼び出し側（HTML）がトリム前後の差分から判定する必要がある。
- `renderStoredSummary()`は**全セッションの合計件数・合計activate数のみ**を表示する一文であり、個別セッションを一覧表示する画面は存在しない。
- `onSwitchKeyDown()`/`onSwitchKeyUp()`は`state.inputMethod !== 'switch'`のみを判定し、**現在どの画面がactiveかを確認していない**（後述7章で詳述）。

---

## 2. Design v2.0との関係・対比表

| 項目 | v2.0（承認済み、維持） | v2.1 Draft（本文書の提案） | 状態 |
|---|---|---|---|
| 教員メモの採用方針そのもの（選択式・自由記述なし・別storageキー） | 採用（§5） | 維持 | **維持** |
| 姿勢 | `posture`: 座位/立位/側臥位/抱かれている/その他/未記録 | `posture`: 未記録/座位/立位/臥位/その他（5択）＋「その他」の表示補足 | **変更提案** |
| 支援 | `supportLevel`単一選択: 支援なし/言葉がけのみ/身体的介助あり/その他/未記録 | `support`複数選択＋3状態構造（未記録/支援なし確認済み/具体的支援あり） | **変更提案（構造変更）** |
| 操作部位 | `switchOperationPart`: 右手/左手/頭部/足/その他/該当なし(スイッチ未使用)/未記録（スイッチ専用） | `operationPart`: 未記録/手・指/頭部・顔/足/その他/該当なし（全入力方式共通、6択） | **変更提案（適用範囲拡大）** |
| 教員の所感 | （v2.0に存在しない） | `teacherImpression`複数選択（新設） | **新設提案** |
| storageキー分離・sessionId外部キー方式 | 採用 | 維持 | **維持** |
| R3自動提案・層1/2構造・C1〜C4ゲート | 採用（Phase 6以降の範囲） | 本文書では変更しない（範囲外） | **維持** |
| バックワード互換性方針（既存ログschema不変） | 採用 | 維持 | **維持** |

**v2.0が最終的に優先する場合**: v2.1 Draftが未承認のまま終わった場合、教員メモはv2.0 §5のschema（`posture`/`supportLevel`/`switchOperationPart`の3フィールド、単一選択のみ）がそのまま実装対象になります。

---

## 3. 観察項目の最終Draft（4項目）

### A. 活動時の姿勢

```
posture: "未記録" | "座位" | "立位" | "臥位" | "その他"
```

- v2.0の「側臥位」は「臥位」へ広域化（側臥位・仰臥位等を包含する上位概念として扱う）。
- v2.0の「抱かれている」は本案では独立選択肢として残さない。**姿勢（身体の構え）と支え方（誰に・何に支えられているか）は別の概念であることを明記する**（抱っこは「支え方」の一種であり、「立位で抱かれている」「座位で抱かれている」等、姿勢とは独立に組み合わさり得るため、単一の姿勢選択肢に押し込めると情報が失われる）。
- **推奨**: 「その他」を選んだ場合のUI表示に「（抱かれている場合など）」という補足テキストを添える。
- **分類上の限界（明記）**: この補足は「抱かれている」を姿勢として正式に分類するものではなく、**該当する記録先が無いために「その他」を使うことを示すヒントに過ぎません**。将来、支え方（抱っこ・車椅子等）を独立した軸として追加する場合は、別フィールド化が必要であり、本v1では見送ります。

### B. 活動時の支援（複数選択、3状態構造）

```
support: { recorded: boolean, types: string[] }
```

- `types`の許容値: `"声かけ・音声による促し" | "視覚的な提示・促し" | "身体的な支援" | "姿勢・機器配置などの環境調整"`
- **3状態の厳密な区別**:
  1. **未記録**: `{ recorded: false, types: [] }`（このセクションを教員が一切操作しなかった状態）
  2. **支援・環境調整は特になし（確認済み）**: `{ recorded: true, types: [] }`（教員が確認のうえ「特に支援は無かった」と明示的に記録した状態）
  3. **具体的な支援・環境調整あり**: `{ recorded: true, types: [1件以上] }`
- **UI上の排他制御**: 「未記録」は独立したトグル（ラジオボタン的な単一選択、既定でON）として表示し、「支援・環境調整は特になしを確認した」ボタンまたはチェックボックスと、4種別のチェックボックス群は、「未記録」がOFFになった時のみ操作可能にする。4種別のいずれか1つでもチェックされた場合、「支援・環境調整は特になし」は自動的に解除される（矛盾する同時選択を防止）。

### D. 教員が観察した活動への関わり（複数選択、整合性ルールあり）

```
teacherImpression: { recorded: boolean, observations: string[] }
```

- `observations`の許容値: `"自分から働きかける様子が見られた" | "促しをきっかけに働きかける様子が見られた" | "判断が難しい"`
- **「判断が難しい」と具体的観察の同時選択可否（検討結果）**: 「判断が難しい」は「見分けられなかった／確信が持てなかった」という教員の不確実性の表明であり、同じ1回の観察の中で「自分から働きかける様子が見られた」という確信的な観察と論理的に両立しません。**したがって「判断が難しい」は`observations`内で他の2項目と排他とする**ことを推奨します。一方、「自分から働きかける様子が見られた」と「促しをきっかけに働きかける様子が見られた」は、同一活動内で場面により両方が見られることが現実にあり得るため、**この2つの間は複数選択を許容**します。
  - UIの排他制御: 「判断が難しい」をチェックすると他の2項目が自動解除され、逆に他の2項目のいずれかをチェックすると「判断が難しい」が自動解除される。
- **未記録との区別**: `recorded=false`（未記録、セクション未操作）と`recorded=true, observations=[]`は本項目では区別する必要がない（具体的観察が0件なら実質「未記録」と同義であるため）。ただし構造の一貫性のため、B項目と同じ`{recorded, types/observations}`形式で統一する。
- **序列化回避の明記**: 「自分から働きかける」「促しをきっかけに」の2選択肢は**優劣を示すものではなく、どちらも等しく有効な活動参加のかたち**であることをUI上の注記で常時明示する（後述7章）。本項目は観察・解釈情報であり、能力評価・主体性判定・入力方式のランキングには使用しません。

### C. 主な操作部位

```
operationPart: "未記録" | "手・指" | "頭部・顔" | "足" | "その他" | "該当なし"
```

- v2.0の`switchOperationPart`（スイッチ専用、右手/左手/頭部/足/その他/該当なし(スイッチ未使用)/未記録）を、**全入力方式（タッチ・スワイプ・外部スイッチ）に適用できるよう一般化**する。右手/左手は「手・指」に統合（左右の記録は本v1では扱わない）。
- **「その他」と「該当なし」は別の意味として扱う**: 「その他」＝観察した部位があるが選択肢に無い、「該当なし」＝この項目自体が今回の活動に意味を持たない（将来的なケースを想定した保留枠）。

---

## 4. 保存設計

```json
{
  "schemaVersion": 1,
  "sessionId": "donomana_access_log_v1の対応するsessionIdへの参照（外部キー、埋め込みではない）",
  "posture": "未記録",
  "support": { "recorded": false, "types": [] },
  "operationPart": "未記録",
  "teacherImpression": { "recorded": false, "observations": [] },
  "recordedAt": "2026-10-18T00:00:00.000Z"
}
```

- storageキー（新設）: `donomana_access_teacher_notes_v1`。既存の`donomana_access_log_v1`とは完全分離。
- 各フィールドはホワイトリスト検証（既存`makeEvent()`の`VALID_TYPES`検証と同方式）。
- **明示的な保存操作のみ**で書き込む。保存ボタンを押さずに画面を離れた場合、何も書き込まない。
- 全フィールドが初期状態（`posture`="未記録"、`support.recorded`=false、`operationPart`="未記録"、`teacherImpression.recorded`=false）のまま保存ボタンが押された場合も、**実質的な内容が無いためnotesキーには追加しない**（空レコードを作らない）。
- **upsert**: 配列内を`sessionId`で検索し、存在すれば置換、存在しなければ追加。
- **保存済みsessionIdの存在確認**: 保存前に、現在の`donomana_access_log_v1`（正常に読み込めた場合のみ）にそのsessionIdが実在するか確認する。実在しない場合は保存を拒否する。
- 氏名・診断名・健康情報・自由記述欄は一切設けない。外部送信は行わない（localStorageのみ）。
- 既存の`donomana_access_log_v1`のschema・既存関数（`buildSessionRecord`/`appendSession`/`writeSessions`/`clearSessions`/`summarizeSessions`等）は一切変更しない。

---

## 5. 削除と整合性

1. **全件削除時**: `donomana_access_teacher_notes_v1`を**先に**削除し、成功を確認した後に`donomana_access_log_v1`を削除する（既存の`clearSessions()`自体は変更せず、呼び出し側で両キーの削除を順に実行する合成関数を新設）。
   - 理由: 中断時に最悪のケースが「notesは消えたがログが残る」（観察記録が孤立しない、安全側）になるようにするため。逆順だと中断時にログが先に消えてnotesが孤立する可能性がある。
2. **片方の削除失敗を成功として扱わない**: ログ側・notes側の削除結果（`{ok,reason}`）を両方確認し、いずれか一方でも失敗した場合は「削除しました」と表示しない。
3. **部分削除時の正確な通知**: 失敗した対象（ログ側／notes側のいずれか、または両方）を名指しする通知文に変える。
4. **MAX_SESSIONS=200超過時の孤立観察記録の整理**: `appendSession()`自体は変更せず、HTML側でトリム前後のsessionId集合を比較し、消えたsessionIdに対応する観察記録を新設の`pruneOrphanNotes(validSessionIds, notes)`（純粋関数）で除去する。
5. **正常読込時のみprune**: `safeReadSessions()`（既存、ログ側）・新設の`safeReadNotes()`（notes側）の**両方**の戻り値`anomaly`が`null`である場合のみ、prune処理を実行する。
6. **malformed JSON、read-exception時は自動削除しない**: ログ側が異常（`anomaly !== null`）の場合、実際のセッション状況が不明であるため、prune処理を今回のサイクルではスキップする。「異常＝ログが空」と誤認して観察記録を全削除することは明示的に禁止する。
7. **notes側の読込異常時も自動削除しない**: notes側が異常な場合も同様にprune処理をスキップする（notes自体をどう扱うべきか判断できないため、上書き・削除のいずれも行わない）。
8. **prune失敗時の通知と再試行**: prune処理の書き込み（notesキーへの`setItem`）が失敗した場合、既存の`classifySaveError()`で分類し、内部的に記録する。ユーザー向けの強制エラーバナー表示は必須としないが、**次回の記録表示タイミングで再度prune判定が実行される**ため、利用者が明示的な操作をしなくても再試行される設計とする。
9. **既存ログを観察記録の不具合によって変更・削除しない**: 観察記録側の保存・削除・prune処理は、`donomana_access_log_v1`に対して**読み取り専用**でのみアクセスする（sessionId存在確認・prune対象の算出のため）。書き込み・削除は一切行わない。

**原子的トランザクションが無いことの明記**: `donomana_access_log_v1`と`donomana_access_teacher_notes_v1`は別々のlocalStorageキーであり、ブラウザのlocalStorageには複数キーをまとめて更新するトランザクション機構がありません。したがって本設計は「厳密な原子性」ではなく、**「異常時は変更を保留し、次回の正常な読込時に整合性を再検証して穏やかに修復する」eventually-consistentな自己修復方式**を採用します。データを失う可能性がある性急な自動修復（異常時の一括削除等）は行いません。

---

## 6. UIとアクセシビリティ

- Phase 5B-1では`#screen-end`（活動終了画面）に観察フォームを追加する。
- 入力は任意、保存ボタンを押さなければ何も保存されず終了できる。保存ボタンは明示的に配置する（例:「観察記録を保存する」）。
- 「状況の記録」（姿勢・支援・操作部位、A〜C）と「教員の観察」（D）を見出しで視覚的・意味的に分離する。D側には「この項目は教員の所感・参考情報であり、機械的な操作記録とは異なります。この2つの選択肢に優劣はありません。」という注記を常時表示する。
- fieldset/legend/labelによる既存パターンを継承。radioは単一選択項目（A・C）、checkboxは複数選択項目（B・D）に使い分ける。
- iPad Safari対応・キーボード操作対応は既存CSS/構造を継承。
- 保存結果は既存の`role="status" aria-live="polite"`パターンで通知する。
- **既存のタッチ・スワイプ・外部スイッチ操作への非干渉**: Phase 5A checkpointのコード現物確認により、以下の実装要件を**Phase 5B-1のApproved Diff Scopeに含める**ことを提案する。

  現行の`onSwitchKeyDown()`/`onSwitchKeyUp()`は`state.inputMethod !== 'switch'`のみを判定し、画面が`#screen-activity`かどうかを確認していない。このため、外部スイッチモードで活動を終え`#screen-end`の観察フォームのcheckbox/radioにフォーカスした状態でSpaceキーを押すと、ネイティブのトグル操作と同時に`e.preventDefault()`・`activateCurrentScanItem()`が実行されてしまう。既存コードの`visibilitychange`ハンドラには`screens.activity.classList.contains('active')`を確認する前例があり、**同じガードを`onSwitchKeyDown`/`onSwitchKeyUp`の先頭に追加する（活動画面がactiveでなければ即return）ことを実装要件とする**。
- 個別セッション一覧・後日編集UIは本Phaseの対象外とし、Phase 6/7との統合検討に委ねる。

---

## 7. テスト設計

**Node golden tests**
- 観察記録の保存・読込・upsert（新規追加・既存sessionId上書き）
- 未入力時に保存されないこと、部分入力の保存
- `support`の3状態（未記録／支援なし確認済み／具体的支援あり）の構造検証と排他制御
- `teacherImpression`の複数選択と「判断が難しい」の排他制御（他の2項目との同時選択がUIレベルで防止されること）
- sessionId検証（存在しないsessionIdへの保存拒否）
- malformed JSON / non-array（ログ側・notes側の両方）
- 保存・削除・prune失敗時の挙動（`{ok:false}`時に完了と報告しないこと）
- MAX_SESSIONS=200境界値（201件目追加で1件目の観察記録が正しくpruneされること、anomaly発生時はpruneされないこと）

**Playwright**
- switch終了後のSpace/Enter干渉防止（6章で指摘したガード追加の検証）
- touch/swipe/switchの既存操作の回帰確認
- フォーム表示・保存・スキップ、キーボード操作
- 375/768/1024/1280pxでの表示、コンソールエラー0件

**既存Golden Tests全16スイートへの非干渉確認**（`ui-golden-tests.js`のMetadata Driftチェック含む）

---

## 8. 未決定事項・ユーザー承認が必要な事項

1. A項目「抱かれている」を独立選択肢に戻すか、本案（「その他」＋表示補足）のままとするか。
2. C項目のoperationPartを6択（その他／該当なしを分離）のまま採用するか。
3. §5-1の削除順序（notesキーを先に削除）の採否。
4. §5-8のprune失敗時、強制エラーバナーを出さない方針の採否。
5. §6で指摘した`onSwitchKeyDown`/`onSwitchKeyUp`への画面activeガード追加を、Phase 5B-1のApproved Diff Scopeに含めることの承認（観察記録機能そのものではなく既存コードの修正であるため、別枠での承認を求める）。
6. 本v2.1 Draftを正式なv2.1として承認し、v2.0の教員メモ節（§5）を置き換えるか、v2.0のまま実装するか。
7. D項目の`{recorded, observations}`構造・排他制御ルールの採否。

---

## 9. 停止

本文書は**Draft（未承認）**です。実装（Phase 5B-1着手）は、ユーザーによる本文書の正式承認を得てから開始します。

**DESIGN V2.1 DRAFT CHECKPOINT READY**
