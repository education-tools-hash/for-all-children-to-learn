# どのまな Communication History Standard（Version 1.0）

- 版: v1.0
- 発行: 2026年8月（Phase T6-A）
- 位置づけ: 「どのまな」において、利用者本人がコミュニケーションのために実際に入力・選択・表出した内容の履歴（Communication History）を扱うアプリ向けの、独立した設計標準。`donomana-learning-record-standard-v1_0.md`（学習・活動記録）、`donomana-storage-architecture-v2_0.md`（コンテンツ保存・バックアップ層）とは別の文書群であり、三者は補完関係にある。
- 根拠調査: Phase T5-E-D監査（`donomana-learning-record-remaining-apps-decision-v1.md` §6）、Phase T6-A実コード監査・実ブラウザ検証
- 対象アプリ（現時点）: `gaze-keyboard`（視線キーボード）
- baseline: `431338c`（Phase T6-A開始時点のorigin/main）

---

## 0. 関連文書

| 文書 | 関係 |
|---|---|
| `donomana-learning-record-standard-v1_0.md` | 独立（学習・活動記録。Communication Historyはこの対象外） |
| `donomana-learning-record-remaining-apps-decision-v1.md` | 本Standard策定の直接的な根拠（§6でgaze-keyboardをCommunication History＝分類Bと確定し、独立Standard策定を正式決定） |
| `donomana-storage-architecture-v2_0.md` | 独立（ユーザー作成コンテンツの保存・バックアップ層） |

---

## 1. 目的

視線キーボードのような、本人がコミュニケーションのために実際に入力・選択・表出した内容を保存するアプリについて、

- 保存してよいデータの範囲
- Profile（利用者）ごとのデータ分離の原則
- 削除操作と実際の保存状態を一致させる原則

を正式化する。Learning Record Standardとは異なり、**本人の実際の発話・入力内容そのもの**を扱うため、より厳格なData Lifecycle管理を要求する。

---

## 2. Communication Historyの定義

> 本人がコミュニケーションのために実際に入力・選択・表出した内容を、後から確認するために保存した履歴。

例（`gaze-keyboard`の`gaze_history_<profileId>`）: `{ text: "おはようございます", ts: 1788066207996, chars: 10, profile: "prof_xxx" }`

---

## 3. Learning Recordとの境界

| 観点 | Learning Record | Communication History |
|---|---|---|
| 記録する内容 | 観察可能な活動・行動（例:「5秒注視した」「3回取り組んだ」） | 本人が実際に伝えた内容そのもの（発話・入力文そのもの） |
| 目的 | 学習・活動の振り返り | コミュニケーションの履歴の確認・再利用 |
| 診断的解釈 | 禁止（Learning Record Standard §2） | 該当なし（行動観察記録ではなく、本人の発話内容そのものであるため、そもそも「診断的解釈を保存しない」という原則の対象外） |
| Foundation統合 | `donomanaRecordAddLog()`等のLearning Record Foundationへ統合可能 | **統合しない**。Foundationの想定する「振り返り」とは性質が異なるため |

`gaze-keyboard`はLearning Record Foundationの対象外であり、`LEARNING_RECORD_FOUNDATION_APPS`（`generate.js`）に含まれない。今後もCommunication History単独の理由でこのSetへ追加しない。

---

## 4. User Contentとの境界

User Content（例: schedule-appの予定表、drawing-appの作品）は、本人が意図的に「作品」として作成・編集するコンテンツである。Communication Historyは、コミュニケーションのやり取りの中で生成される履歴であり、本人が「作品」として意識して作るものではない（`gaze-keyboard`では入力停止8秒後に自動保存される）。この違いにより、Communication Historyには「作成物の保護」ではなく「発話内容の機微性への配慮」という異なる観点のPrivacy原則が必要になる。

---

## 5. Profileとの紐付け

Communication Historyは必ずProfile（利用者）単位で分離して保存する。単一のグローバルな履歴として複数利用者の内容を混在させない。

`gaze-keyboard`の実装（本Standardが正本化する既存パターン）:

- `gaze_history_<profileId>`: Profile単位のCommunication History配列
- `gaze_stats_<profileId>`: Profile単位のCommunication Statistics（§10参照）
- `gaze_prof_settings_<profileId>`: Profile単位の設定（Communication Historyではないが、Profile専属データとして同じライフサイクルで扱う。§11参照）

---

## 6. Storage原則

- 端末内保存（`localStorage`）を基本とする
- 新規の外部送信・Cloud同期は導入しない（本Standard策定時点でゼロを確認済み、§8参照）
- Profile単位でstorage keyを分離する（`<key>_<profileId>`パターン）
- 件数上限を設ける場合はapp-specific concernとして実装する（`gaze-keyboard`の`gaze_history_*`は`hist.slice(-500)`で直近500件）

---

## 7. Privacy原則

Communication Historyには、本人の希望・感情・人名・家族に関する内容・生活情報・健康に関する本人入力・その他私的な文章が含まれうる。したがって以下を原則とする。

- 端末内保存のみ、新規外部送信なし、Analytics送信なし、Cloud同期なし
- Profile単位で厳密に分離し、他Profileのデータへ一切アクセスしない
- 削除操作（Profile削除・履歴全削除）は、利用者が理解する意味と実際の保存状態を一致させる（§8・§9）
- 音声入力機能（Web Speech API）を使う場合、音声データがブラウザの音声認識サービスへ送信される可能性がある。これはアプリコード自体からの送信ではなく、ブラウザ実装に依存する既存の性質であり、`sst-app`の「きもち日記」機能について既に文書化されている前例と同種である（`donomana-learning-record-standard-v1_0.md` §3参照）。本Standardではこの既知の性質を追認するのみとし、本Phaseでコード変更は行わない。

---

## 8. Profile削除

Profile Aを削除した場合、**Profile A専属のCommunication関連データもすべて同時に削除する**。

`gaze-keyboard`における対象key（本Phaseで確定・実装）:

- `gaze_history_<profileId>`
- `gaze_stats_<profileId>`
- `gaze_prof_settings_<profileId>`（Communication Historyではないが、Profile削除時に他のprofile専属keyと同様に削除しないと、そのProfileにのみ紐づくデータが孤児化するため対象に含める）

他Profileの`gaze_profiles`・History・Stats・Settingsは絶対に削除しない。

実装（`gaze-keyboard.html`、`deleteProfileCommunicationData(id)`）:

```js
function deleteProfileCommunicationData(id) {
  try { localStorage.removeItem('gaze_history_' + id); } catch(e){}
  try { localStorage.removeItem('gaze_stats_' + id); } catch(e){}
  try { localStorage.removeItem('gaze_prof_settings_' + id); } catch(e){}
}
```

---

## 9. History全削除

「履歴をすべて削除」操作は、**active profileの`gaze_history_<profileId>`と`gaze_stats_<profileId>`を両方削除（初期化）する**。

判断根拠（§10参照）: `gaze_stats_*`の`wordFreq`フィールドは、集計値ではなく実際に入力された単語そのものをキーとして保持しており、History本文と同様に機微度の高いデータである。「履歴をすべて削除」という利用者の操作意図（コミュニケーション内容を消したい）に対して、Statsのみ残る状態は不整合であるため、両方削除する。

一方、Profile単位の設定（`gaze_prof_settings_<profileId>`のテーマ・キーサイズ等）は「履歴をすべて削除」の対象に含めない。設定はCommunication内容を含まないため、利用者が「履歴を消したら設定までリセットされた」と感じる不要な副作用を避ける。

実装（`gaze-keyboard.html`、`histClearBtn`ハンドラ）:

```js
if (confirm('入力履歴をすべて削除しますか？\n（よく使った言葉などの使用状況の記録もあわせて削除されます）')) {
  saveHistory([]);
  saveStats(initStats());
  renderHrModal('history');
  showToast('履歴を削除しました');
}
```

---

## 10. Statisticsとの関係

Communication Statistics（例: `gaze_stats_<profileId>`）はCommunication Historyから派生する統計だが、単なる集計値ではない場合がある。本Phaseで`gaze-keyboard`の`gaze_stats_*`を完全監査した結果:

```js
{ totalChars, totalWords, totalSessions, dailyChars: {日付: 文字数}, wordFreq: {単語: 頻度}, lastUsed }
```

- `totalChars`/`totalWords`/`totalSessions`/`dailyChars`/`lastUsed`: 集計値のみ、History本文を含まない
- **`wordFreq`: キーが実際に入力された単語（2文字以上）そのもの。集計ではなく生の語彙データ**
- `renderReportTab()`の「よく使った言葉 TOP10」・`printReport()`の印刷レポートは、いずれも`wordFreq`のキー（実際の単語）をそのままUIへ表示する
- Historyは`slice(-500)`で直近500件のみ保持するのに対し、Statsは無期限に蓄積し続ける独立したデータであり、Historyから再生成することはできない

**結論**: `wordFreq`を含むStatisticsは、単なる利用状況の集計としてではなく、Communication Historyに準じる機微度で扱う。Statisticsの削除方針は「集計値だから残してよい」と機械的に判断せず、実データの意味（生の語彙を含むか）から個別に判断する（§9参照）。

---

## 11. Cascade Delete

Profile削除は、そのProfile専属の全データ（Communication History・Communication Statistics・Profile別設定）を対象とするCascade Deleteとする。Cascade Delete実装は以下の原則に従う。

- 対象keyのみを明示的に列挙する（ワイルドカード的な全key走査は行わない。誤って無関係なkeyを削除するリスクを避けるため）
- 各`removeItem`を個別の`try/catch`で保護し、1つの失敗が他のkeyの削除を妨げない
- 削除対象は「渡されたprofile idそのもの」のみとし、`currentProfileId`等のグローバル状態には依存しない（削除実行時にactive profileが削除対象自身であってもなくても同じ結果になる）

---

## 12. 他Profile isolation

Cascade Deleteは、削除対象以外のProfileの`gaze_profiles`一覧・History・Stats・Settingsに一切影響しないことを実測で確認する（Phase T6-A §25/§32参照）。

本Phaseの実測: Profile A/B/Cを作成しそれぞれ異なる内容（`Aだけの文章`/`Bだけの文章`/`Cだけの文章`）を保存した上でProfile Aを削除し、削除前後のB/CのHistory・Stats・Settings JSON文字列が**完全一致（byte-level）**することを確認した。

---

## 13. Legacy互換

新しいschema migrationは原則行わない。既存の`gaze_history_*`/`gaze_stats_*`のデータ構造は本Phaseで変更していない（History本文の書き換え、Profile IDの書き換え、一括migrationはいずれも実施していない）。

---

## 14. Orphan Data

本Phase以前にProduction環境で既に発生していた可能性のある孤児データ（削除済みProfileに紐づく`gaze_history_<oldId>`/`gaze_stats_<oldId>`/`gaze_prof_settings_<oldId>`）について、**本Phaseでは自動cleanupを行わない**。

理由:
- どのkeyが「既に削除されたProfile」に紐づくものか、現在のコードだけでは100%安全に判別できない（`gaze_profiles`一覧に存在しないIDのkeyが必ずしも「削除済み」とは限らず、他の要因による不整合の可能性を排除できない）
- Profile IDは`'prof_' + Date.now()`で生成されており、ID再利用の可能性は実質的に低いが、100%安全とは言い切れない
- 不確実な自動削除は、利用者のデータ喪失リスクを伴う

本Phaseで実装したCascade Delete（§8）は**今後発生する**孤児データを防止するものであり、**既存の**孤児データを遡って解消するものではない。既存の孤児データの解消は、より慎重な調査を伴う将来の独立したManual Cleanup候補として記録する。

---

## 15. Retention

- `gaze_history_<profileId>`: 直近500件（既存の`hist.slice(-500)`、本Phaseで変更なし）
- `gaze_stats_<profileId>`: 件数上限なし（無期限蓄積、本Phaseで変更なし）

Retentionポリシー自体の変更（Stats側への上限導入等）は本Phaseのスコープ外とし、将来検討事項として記録する。

---

## 16. Export

`gaze-keyboard`のCommunication Historyは印刷（`printHistory()`）でのみエクスポート可能であり、CSVエクスポートは存在しない。本Standardはこれを変更しない。Communication HistoryをLearning Record CSV Standard（`donomana-learning-record-standard-v1_0.md` §18-19）へ統合しない。

---

## 17. Accessibility

Profile削除・履歴全削除のUIは、既存のネイティブ`<button>`要素と`confirm()`ダイアログをそのまま利用する（本Phaseでdialog UIの構造自体は変更していない）。確認事項と結果は`donomana-learning-record-remaining-apps-decision-v1.md`と同様の手法で実測した（Phase T6-A Final Report参照）。

**本Phaseで新規に発見した既存の未対応事項（regressionではない）**:
- `profileModal`・`hrModal`にはEscapeキーでの閉じる操作が実装されていない（既存の`settingsModal`専用Escapeハンドラの対象外）。本Phase以前から存在する実装であり、本Phaseのコード変更はこの挙動に影響していない
- `.pli-del`（Profile削除ボタン）・`histClearBtn`（履歴全削除ボタン）の実測サイズはそれぞれ約48×24px・約76×23pxであり、44px touch target基準を高さ方向で満たしていない。既存のCSSによるものであり、本Phaseで変更していない

いずれも将来のAccessibility改善候補として記録し、本Phaseでは修正しない（§21 Communication UX Freezeの範囲内）。

---

## 18. Gaze / Switchとの関係

本Standardおよび本Phaseの実装は、視線入力（dwell）・スキャン入力（Switch Scan）・タッチ・キーボードいずれの入力方式にも影響しない。Cascade Delete・History全削除の実装は、削除対象のstorage keyを操作するのみであり、入力方式の判定・UIレンダリングロジックには一切触れていない（`git diff`で実測確認済み）。

---

## 19. 将来のAAC系アプリへの適用

本Standardは`gaze-keyboard`専用の仕様に閉じない。将来、コミュニケーションボード等のAAC系アプリが同様の「本人の発話内容そのものを保存する履歴」機能を持つ場合、本Standardの定義（§2-3）・Profile分離原則（§5）・Cascade Delete原則（§8/§11-12）を適用できる。ただし、現時点で存在しない機能（History検索・フィルタ・複数端末同期等）を本Standardの必須要件として過剰に規定しない。

Phase T5-E-D監査（Inventory Closure Gate）の時点で、`kimochi-board`を含む14アプリ中13本はCommunication Historyに該当する機能を持たないことを確認済みである（`donomana-learning-record-foundation-audit-v1.md` Addendum参照）。

---

## 20. Versioning

本Standardはv1.0として発行する。`gaze-keyboard`の既存storageスキーマ自体（`gaze_history_*`/`gaze_stats_*`のフィールド構成）はfreeze対象とし、本Phaseでは変更しない。将来のフィールド追加が必要になった場合は、Learning Record Standardの`schemaVersion`パターンに倣うかどうかを含めて別途検討する。

---

## 21. Storage Inventory（Phase T6-A実施、`gaze-keyboard.html`全件）

| key pattern | 分類 | 内容 | Profile-scoped |
|---|---|---|---|
| `gaze_profiles` | C. Profile Data | Profile一覧配列（id/name/avatar/color/createdAt） | ✗（グローバル） |
| `gaze_current_profile` | C/D | 現在アクティブなProfile ID | ✗（グローバル） |
| `gaze_prof_settings_<id>` | D. Settings | テーマ・キーサイズ・dwellTime・skin・layoutDir・customColors | ✓ |
| `gaze_history_<id>` | A. Communication History | 発話・入力内容の履歴（本文含む） | ✓ |
| `gaze_stats_<id>` | B. Communication Statistics（生の語彙含む、§10参照） | 使用統計・単語頻度 | ✓ |
| `gaze_custom_colors` | D. Settings | 現在のcustomColors値のグローバルキャッシュ（`loadProfileSettings()`実行時にprofile別settingsからミラーされる） | ✗（グローバル、profile切替の都度上書き） |
| `gaze_panel_vis` | D. Settings | パネル表示状態 | ✗（グローバル） |
| `gaze_pred_freq` | 予測変換の学習データ（単語→頻度） | 全Profile共有の予測変換辞書。**§22参照** | ✗（グローバル、意図的な設計） |
| `<P>contrast`/`<P>font`/`<P>sr` | D. Settings（共通A11yパネル） | ハイコントラスト・文字サイズ・読み上げ設定 | ✗（グローバル、アプリ共通） |

---

## 22. 将来検討事項（本Phaseでは対応しない）

- **`gaze_pred_freq`（予測変換学習データ）はProfile非依存のグローバル辞書として設計されている。** これは「本人が入力した語彙」という性質上Communication Historyに近いが、意図的に全Profile共有としている可能性がある（複数の子どもが同じ端末を使う想定で予測精度を上げるため、等）。本Phaseは「AI文章補完」機能への変更を明示的にスコープ外としているため（Phase T6-Aプロンプト§38）、この設計を変更しない。将来、Profile分離が必要と判断された場合は別Phaseで検討する
- Profile削除・履歴全削除ボタンの44px touch target化、`profileModal`/`hrModal`のEscape対応（§17）
- 既存の孤児データ（Production環境に既に存在する可能性のある削除済みProfile紐づきkey）の解消方針（§14）
- `renderHistoryTab()`の`entry.innerHTML = ...${h.text}...`および`renderReportTab()`/`printReport()`の`${word}`/`${w}`が、ユーザー入力文字列をエスケープせず直接HTMLへ挿入している（`escapeChangelog()`のような既存のescape関数は使われていない）。History本文や予測変換で学習された単語にHTMLタグに解釈されうる文字列が含まれていた場合、格納型XSSの原因になりうる。**本Phase以前から存在する既存の実装であり、今回のCascade Delete修正では一切触れていないが、Privacy/Securityの観点から重要度が高いため、Future findingsとして明確に報告する。修正は本Phaseのスコープ外（§21 Communication UX Freeze）とし、別Phaseでの対応を推奨する**

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-30 | Phase T6-A。Communication History Standardを新規策定。gaze-keyboardのProfile削除・履歴全削除時のCascade Delete実装、Storage Inventory完全監査、Statistics（`wordFreq`）の機微性判断、将来検討事項（孤児データ・44px・Escape対応・XSSリスク）の記録。 |
