# どのまな Supporter Record Dashboard 設計文書（Version 1.0）

Phase T8-A（Design & Inventory Only、実装なし）。目的は「記録をたくさん表示するDashboard」を作ることではなく、教師・支援者が21のLearning Record Foundation対応アプリ（以下Foundation）の取り組みを横断的に振り返れるようにすること。scoreランキング型・正答率中心の設計は明確に禁止する。特に重度・重複障害のある子どもの学習を、正答率だけで評価しない。

関連文書: [[donomana-learning-record-standard-v1_0]] [[donomana-communication-history-standard-v1_0]] [[donomana-record-foundation-expansion-inventory-v2]]

---

## 1. Baseline

- Production: `main = origin/main = f58ad2f`（T7-J Production Released / T7 Record Expansion Closed）
- Worktree: `for-all-children-to-learn-t8a-supporter-dashboard-design`
- Branch: `docs/supporter-dashboard-architecture-t8a`
- Foundation count: **21**（`generate.js` `LEARNING_RECORD_FOUNDATION_APPS` から動的取得、Source of Truth）

---

## 2. 最重要の構造的発見

**`donomanaRecordCreate()`が定義する Standard Core Schema（`{timestamp, appId, activity, inputMethod, schemaVersion, payload}`）を実際に使っているアプリは、21本中 tokei-app・matching-app・shiritori2・janken-app・register-app の**5本のみ**である。**

残る16本は、Foundationの共有I/Oプリミティブ（`donomanaRecordReadLog`/`WriteLog`/`AddLog`/`ClearLog`、必要に応じ`ReadNestedCollection`/`WriteNestedCollection`）だけを使い、entry自体の形は各アプリが独自に定義している。つまり「Foundation対応アプリ」＝「共通schemaに準拠したアプリ」ではない。`donomanaRecordCreate()`は多くの既存アプリにとって事実上使われていないaspirationalな関数である。

この事実は、Dashboardが**単一の共通schema変換**ではなく、**アプリ単位のAdapter**を最初から前提にすべきという結論に直結する（§9参照）。

---

## 3. 21アプリ Record Schema Inventory

storage keyは各アプリの実コードから確認したlocalStorage key。rolling capは記録件数の上限（「時間ベース」「未確認」の場合はその旨を記載）。

| appId | 表示名 | category | storage key | 構造 | rolling cap | Create()使用 | inputMethod実値 | 自由入力/個人名 | image |
|---|---|---|---|---|---|---|---|---|---|
| miru-hirogaru-app | みるとひろがる | 認知支援 | `miru_hirogaru_log` | flat array | **なし（無制限）** | No | **あり**(gaze/touch/switch) | なし | なし |
| hiragana-learn | ひらがな まなぼう！ | 学習アプリ | `hiragana_log` | `{time,type,data}` | **なし（無制限）** | No | なし | なし | `data.traceSample`（なぞり軌跡、サイズ未確定） |
| directions-app | ほうこうとばしょをまなぼう | 学習アプリ | `appLogs` | flat array | 500 | No | なし | なし | なし |
| kyou-no-kiroku | きょうのきろく | 自立活動 | `kyounokiroku` | **複合object**`{children[],records[]}` | **なし（無制限）** | No | 該当なし | **あり（childName＋医療情報＋自由記述memo/seizureNote）** | 子どもごとに`photo` |
| katakana-app | カタカナ まなぼう！ | 学習アプリ | `katakana_log` | `{time,type,data}` | **なし（無制限）** | No | なし | なし | `data.traceSample`（同上） |
| suji-manabou | すうじ まなぼう！ | 学習アプリ | `suji_log` | `{time,type,data}` | **なし（無制限）** | No | なし | なし | なし |
| mitsukete-touch-app | どこかな？みーつけた！ | 認知支援 | `mitsukete_touch_log` | flat array | **なし（無制限）** | No | **あり** | なし | なし |
| junban-miyou-app | じゅんばんにみよう | 認知支援 | `junban_miyou_log` | flat array | **なし（無制限）** | No | **あり** | なし | なし |
| kurabeyou-app | おおきい？ちいさい？くらべよう | 学習アプリ | `kurabeyou_log` | flat array | 200 | No | 一部あり | なし（「間違えた内容」は固定問題文） | なし |
| katachi-awase-app | かたちをあわせよう | 学習アプリ | `katachi_log` | flat array | 200 | No | 未確認 | なし | なし |
| dotchiga-ii-app | どっちがいい？ | 認知支援 | `dotchiga_ii_log` | flat array | 200 | No | **あり**（dwellDuration含む） | なし | なし |
| okane-app | おかねのおべんきょう | 学習アプリ | `okane_activity_log`（＋非Foundation集計`okane_records`） | flat array | 200 | No | なし | なし | なし |
| sst-app | SST ソーシャルスキルトレーニング | 自立活動 | `sst_activity_log_v1`（＋**除外対象**`sst_diary_entries_v1`） | flat array | **時間ベース（30日）** | No | なし | なし | なし |
| mogura-tataki | もぐらたたき | 自立活動 | `mogura_v3` | flat array | **60**（外れ値） | No | なし | なし | なし |
| tokei-app | とけい | 学習アプリ | `tokei_log` | Standard Core Schema | 200 | **Yes** | 常にnull | なし | なし |
| nazori-app | なぞり書き練習ツール | 学習アプリ | `nazori_records` | legacy flat array | 未確認 | No | なし | **あり**（`charInput`は「自由入力・名前/漢字OK」と明記） | **あり**（canvas PNG dataURL、1件約10〜80KB） |
| bosai-app | ぼうさいたんけんたい | 学習アプリ | `bosai_log` | flat array | 200 | No | なし | **あり（`name`＝専用の児童名自由入力フィールド、毎レコード保存）** | なし |
| matching-app | マッチング | 認知支援 | `matching_log` | Standard Core Schema | 200 | **Yes** | 常にnull | **なし（設計で意図的に排除、たいせんはplayerCountのみ）** | なし |
| shiritori2 | しりとりあそび | 学習アプリ | `shiritori2_log` | Standard Core Schema | 200 | **Yes** | 常にnull | なし | なし |
| janken-app | じゃんけん まなぼう！ | 認知支援 | `janken_log` | Standard Core Schema | 200 | **Yes** | 常にnull | なし | なし |
| register-app | はんばいかい レジ | 学習アプリ | `register_log` | Standard Core Schema | 200 | **Yes** | 常にnull | **あり（`items[].name`＝商品名自由入力、T7-J でLow→Medium）** | なし |

**別系統（Foundation外）**: `gaze-keyboard`（視線キーボード、自立活動）は`LEARNING_RECORD_FOUNDATION_APPS`に含まれず、Communication History Standard v1.0で明確にLearning Recordと切り分けられている（§10参照）。独自のProfile体系（`currentProfileId`、`profiles[].name/avatar/color`、per-profile storage key `gaze_history_<profileId>`）を持ち、実際の発話・入力文そのもの（`text: txt`）を保存する。

---

## 4. 共通フィールドの実態

Standard Core Schemaを実際に使う5本（tokei/matching/shiritori2/janken/register）でのみ`{timestamp, appId, activity, inputMethod, schemaVersion, payload}`が共通。他16本は`schemaVersion`（多くは`1`をリテラルで持つか、欠落＝legacy v1として扱う）以外に構造的な共通点がない。**したがってDashboardが真に共通利用できるのは`donomanaRecordReadLog()`等のI/Oプリミティブ（配列取得・書き込み・件数上限）の契約（T7-H1で保証されたArray-or-[]契約）のみであり、payloadの共通schemaは存在しない。**

---

## 5. Payloadの意味カテゴリ分類

21アプリの実フィールドを、実際に存在するものだけで分類（存在しないカテゴリは無理に作らない）。

| カテゴリ | 該当フィールド例 |
|---|---|
| **Achievement**（correct/total/score/retry） | tokei(`total,correct,retried`), shiritori2(`total,correct,score,maxStreak`), bosai(`correct,total,score`), katakana/hiragana(`correct`), kurabeyou/katachi-awase(`正誤,再試行回数`), janken(`correct,total`) |
| **Activity**（mode/level/pattern/選択） | miru-hirogaru(`level`), mitsukete/junban(`レベル,種類`), kurabeyou/katachi-awase(`テーマ,レベル,形`), dotchiga-ii(`activity,category,pair`), tokei/matching/shiritori2/janken(`mode`), okane/sst(`type`) |
| **Participation**（duration/rounds/moves/itemCount） | miru-hirogaru/mitsukete/junban(`反応時間ms,注視時間ms,trial`), dotchiga-ii(`dwellDuration,trialIndex`), tokei(`durationSec`), matching(`moves,durationSec,pairs`), shiritori2(`durationSec,chainLength`), mogura(`time,combo,holes`), nazori(`sessionDone,sessionTotal,durationMin`), register(`itemCount`) |
| **Choice**（selected/preference） | mitsukete(`選んだ場所`), dotchiga-ii(`selectedChoice`), kurabeyou(`最初/最終の選択`), matching(`usedCustomSet`), bosai(`log[].chosen`), register(`items[]`が実質「何を選んだか」) |
| **Error / Learning Point**（mistakes/outcome） | kurabeyou/katachi-awase(`間違えた内容`＝janken-appの先例), shiritori2(`outcome`), bosai(`log[].correct`per問題), okane(`type:'mistake'`), **janken(`mistakes[]`)** |
| **Creation / Composition** | katachi-awase(`パズル名`、要確認) 以外に明確な該当なし |
| **Other（どのカテゴリにも当てはまらない）** | kyou-no-kiroku全体（学習活動metricではなくケア記録、独立ドメイン）、nazori(`allChars,image`＝content/artifact)、bosai(`name`＝個人識別子)、okane(`detail`＝アプリ自身が生成した既に自然文のsummary) |

**okane-appの`detail`は既にアプリ側で「¥○○のおかいもの（おつり ¥○○）」のような教師向け自然文を生成している。これはSummary生成方式（§9）でDashboard側adapterがpayloadから同種の文を組み立てられることの実例的裏付けになる。**

---

## 6. inputMethod Coverage

**非nullで実値が入るのは4アプリ（miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app）＋kurabeyou-appの一部呼び出し箇所のみ**。他17アプリは常に`null`、またはフィールド自体が存在しない。

この4本は視線入力・スイッチ利用が多い「重度・重複障害教材」（§8）と正確に一致する。したがって初期Dashboardの主要filterへ`inputMethod`を入れるのは時期尚早（大半のアプリでデータが存在しないため）。**「将来対応」の filterとし、代わりにこの4アプリの詳細ビューでのみinputMethodを表示する設計を第一候補とする。**

---

## 7. Profile Coverage（§24-27）

35アプリ全体で「誰の記録か」を持つのは実質**2系統のみ**：

1. **gaze-keyboard**: 独立したProfile体系（`profiles[].name/avatar/color`）を正式に持つ。Learning Record Foundationとは別のCommunication History系統（§10）。
2. **kyou-no-kiroku**: 複合storage内に`children[].name/photo`を持ち、各Recordが`childName`/`childIndex`のsnapshotで子どもに紐づく。**唯一、Foundation側で「誰の記録か」を実際に持つアプリ**。

残り19アプリ（janken/register含む）は**完全にdevice-level**で、児童個人と記録を紐づける仕組みがない。

**結論（Decision A）**: 現状のFoundation Recordの大多数はprofile非対応のため、**Device-level Dashboardを第一段階とする**。「児童Aの記録」という誤った横断集計を避けるため、Profile-level Dashboardは共通Learner Profile Foundationの整備（将来検討、§13）を経てからの後続Phaseとする。kyou-no-kiroku単体は既に子ども単位の表示機能を持つため、Dashboardでは**個別リンクとして案内するに留め、他20アプリの集計とは混ぜない**。

---

## 8. 重度・重複障害教材の振り返り材料

正答率が主指標にならない4アプリ（miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app）で、実payloadに存在する振り返り材料：

- 活動回数（レコード数そのもの）
- 使用したlevel/レベル
- 選択した対象（`選んだ場所`/`selectedChoice`等）
- 反応時間・注視時間（`反応時間ms`/`注視時間ms`/`dwellDuration`）
- 入力方法（inputMethod、この4本でのみ実値あり）
- 完了そのもの（1レコード＝1回の取り組み）

「できた／できなかった」ではなく「今日は視線でどれだけ反応したか」「どの対象を選んだか」を並べる方針が、実データと整合する。

---

## 9. アーキテクチャ選択肢と決定

### 9.1 Summary生成方式（§9-10 決定E）

| 案 | 説明 | 評価 |
|---|---|---|
| A. 各アプリがsummaryを保存 | 21アプリ全てにsummary文字列生成コードを追加 | 21本の改修が必要、既存Record schemaへの後付け変更リスク |
| **B. Dashboard側adapterがpayloadから生成（第一候補）** | 21個のadapter定義（§9.4）内でpayload→短い日本語文を都度組み立て | 既存アプリ非改修、okane-appの`detail`が実例として既に近い設計 |
| C. Foundation helperが生成 | generate.js側に汎用summary生成関数を追加 | payload構造が21本でバラバラ（§2）のため汎用化が困難、結局adapter相当のif分岐が必要になり実質Bと同じ |

**決定: B（Dashboard側adapter）**。

### 9.2 Local Aggregation方式（決定C）

| 案 | 説明 | 評価 |
|---|---|---|
| **A. 既存21 storage keyをread-only aggregation（第一候補）** | Dashboard起動時に21key（＋kyou-no-kirokuの複合構造）を読み、adapterで正規化 | 21アプリ側の改修ゼロ、既存Record破壊リスクなし |
| B. Global Index方式（各app save時に共通indexへも書き込む） | 21アプリの保存処理に書き込み追加が必要 | migration・consistency・重複・failure isolationの懸念が大きい。将来検討（§9.3）に留める |

**決定: A**。既存Recordの一括migrationは行わない（§11要件）。

### 9.3 Global Index方式との比較（将来検討、T8-Aでは実装しない）

| 観点 | Existing keys aggregation | Global Index |
|---|---|---|
| migration | 不要 | 21アプリ全ての改修が必要 |
| consistency | Dashboard読み込み時点のスナップショット、多少のズレ許容 | 常に最新（ただし書き込み側の実装ミスで不整合が起きうる） |
| duplicate | 発生しない（読むだけ） | 書き込み側バグで二重記録の恐れ |
| storage | 既存keyのみ、追加消費なし | index分の追加ストレージ消費（§10で指摘するorigin共有quotaリスクを悪化させる） |
| backward compatibility | 既存21アプリのコードに一切触れない | 21アプリ全てにFoundation変更が波及 |
| failure isolation | 1アプリのstorage破損がDashboardの該当部分のみに影響（§14） | 書き込み処理の失敗が記録の記録漏れに直結 |

現時点でGlobal Indexを選ぶ理由がないため、当面は不採用。将来、横断検索や重い集計が要件化した場合に再評価する。

### 9.4 Adapter Registry（決定、§46-47）

```js
const RECORD_ADAPTERS = {
  'janken-app': {
    storageKey: 'janken_log',
    structure: 'flat',           // 'flat' | 'nested'
    normalize(raw) { /* schemaVersion欠落等の吸収 */ },
    summarize(entry) { /* 例: "6問中5問正解。『パーに勝つ手』で1回間違い" */ },
    metrics(entry) { /* Achievement/Participation等、カード表示用の主要数値 */ },
  },
  'kyou-no-kiroku': {
    storageKey: 'kyounokiroku',
    structure: 'nested',         // children[]+records[]、専用adapter
    excludeFromCrossAppView: true, // ケア記録は他20本と混ぜない
  },
  // ... 21本分
};
```

**Source of Truth**: `apps-data.json`を肥大化させず、**Dashboard専用のadapter registry**（新規ファイル）を第一候補とする。理由: apps-data.jsonはSEO/detail page生成用のmetadataであり、Record schemaという別責務を持ち込むと責務が混在する。21本分の手作業定義は許容範囲（既にT7期を通じて21本個別にRecord実装してきた実績と同等の作業量）。

### 9.5 Legacy / Schema Version対応（決定H、§48-49）

- `schemaVersion`欠落 = legacy v1として扱う（既存Standard §9の原則を踏襲）。
- kyou-no-kirokuのような複合storage、`{time,type,data}`形式（hiragana/katakana/suji-manabou）、位置引数形式（directions-app）など、構造そのものが違うものはadapterの`normalize()`内で吸収し、Dashboard共通層には正規化後の形だけを渡す。
- 未知のlegacy recordでnormalize()が失敗した場合はそのentryをスキップし、Dashboard全体をcrashさせない（§14と同じ原則）。

---

## 10. gaze-keyboard（Communication History）の扱い（決定G）

既存の`donomana-communication-history-standard-v1_0.md` §3が既に「Foundation統合しない」「今後もこのSetへ追加しない」と明記している。本設計もこれを踏襲する。

**決定: Dashboard内で「コミュニケーション」別タブとして分離表示する。** 理由は既存文書の通り、Learning Recordが「観察可能な活動・行動」を記録するのに対し、Communication Historyは「本人が実際に伝えた内容そのもの」であり、診断的解釈の対象外という性質の違いが根本的にあるため。Profile体系（`profiles[].name`）も21 Foundationアプリのdevice-level設計と非対称であり、無理に一つのTimelineへ混在させない。

---

## 11. Image Record戦略（決定H、§44）

nazori-appのみ、canvas PNG dataURLをRecordへ直接保存している（1件約10〜80KB想定）。

**決定**:
- Dashboard Timelineでは**画像を初期表示しない**（テキストsummaryのみ）。
- 詳細ビュー（1件クリック時）でのみ`<img>`をlazy displayする。
- hiragana-learn/katakana-appの`data.traceSample`も同様に「詳細ビューでのみ展開」対象の候補とし、正確なサイズ算出は今回未確定のため後続Phaseで実測する。

---

## 12. Storage Architecture / Performance（決定、§12-13, §42-44）

### 12.1 rolling cap の実態（外れ値が多い）

| capの種類 | 該当アプリ | リスク |
|---|---|---|
| 200件 | kurabeyou-app・katachi-awase-app・dotchiga-ii-app・tokei-app・matching-app・shiritori2・bosai-app・janken-app・register-app（9本） | 小〜中（T7-J実測で商品20点/checkout×200件≈290KBが最大級） |
| 500件 | directions-app | 中 |
| 60件（外れ値） | mogura-tataki | 小 |
| 時間ベース30日（外れ値） | sst-app | 件数は運用次第で変動 |
| **なし（無制限）** | miru-hirogaru-app・hiragana-learn・kyou-no-kiroku・katakana-app・suji-manabou・mitsukete-touch-app・junban-miyou-app（**7本**） | **中〜高**。1年間の日常利用で数千件規模になりうる |
| 未確認 | nazori-app | image付きのため要注意（§11） |

### 12.2 origin共有quotaリスク（Risk Register候補、重要な新規発見）

35アプリすべてが**同一origin（donomana.jp）**でlocalStorageを共有する。ブラウザのlocalStorage上限は一般に**1 origin あたり5〜10MB**。無制限capの7アプリ＋nazori-appの画像データ＋他28アプリの設定・content・履歴が、この一つの枠を奪い合う。これはDashboard固有の問題ではなく既存の site-wide risk だが、**Dashboardが21keyを横断読込することで初めて可視化される**問題であり、本Phaseで明示しておく。

**対応（今回は設計のみ）**: Dashboard実装時に、無制限capアプリの実際の蓄積傾向を計測し、必要なら該当7アプリへ200件相当のrolling cap追加を別Phaseで提案する候補とする（本Phaseでは実装しない）。

### 12.3 同期読み込みとUI blocking

21 storage keyの同期`localStorage.getItem`+`JSON.parse`は、無制限capアプリで数千件规模になった場合に体感遅延を生む可能性がある。**対応候補**: Dashboard初期表示は直近N件（例: 30日）のみ各keyから抽出し、全件走査は「もっと見る」等の明示操作時のみに限定する設計を第一候補とする。

---

## 13. Privacy Classification（決定I、§28-29）

| 分類 | 該当 | 理由 |
|---|---|---|
| **High** | kyou-no-kiroku（childName＋医療情報＋自由記述memo/seizureNote） | 個人識別子＋医療情報の組み合わせ。Dashboardでは他20本と混在させず、独立導線に留める（§7） |
| **Medium〜High（要再検討候補）** | bosai-app（`name`＝専用の児童名自由入力、毎レコード保存） | 既存T7-E Inventory（v2文書）では「Medium」格上げが提案されていたが、本Phaseで「毎レコードに専用の名前欄がある」実態を確認した。**T8-Aでは変更しないが、bosai-app自体のPrivacy Guidance見直しをFuture Candidateとして記録する**（コード変更はT8-Aの対象外） |
| Medium | register-app（`items[].name`＝商品名自由入力、T7-Jで確定済み）、nazori-app（`allChars`が名前受容と明記） | 自由入力だが、教育目的の範囲内。Help文言で告知済み（register-app） |
| Low | 上記以外の18アプリ | 固定authored文字列・数値のみ |
| **除外対象** | sst-appの`sst_diary_entries_v1`（別storage、音声入力を含みうる） | 既存コードコメントで明示的にFoundationから切り離されている。Dashboardでも同様に絶対に読み込まない |

**Dashboard設計原則**: High/Medium分類のアプリのRecordをTimeline上に表示する際は、自由入力フィールド（name・items[].name・allChars）を**必ずHTMLエスケープ**（T7-J実装済みの`esc()`パターンを踏襲）し、CSV書き出し時は**Formula Injection guard**（`registerCsvSafeCell()`パターン）を各adapterのCSV生成にも適用する。

---

## 14. Security（決定、§56）

- XSS: 自由入力フィールドは全てHTMLエスケープ経由でのみDOMへ挿入（innerHTML直書き禁止、T7-J register-appの`esc()`踏襲）。
- CSV Formula Injection: 横断CSV（§16）でも自由入力を含む列には safe-quote guard を適用。
- 破損storage: 個別app storageの破損（wrong-type/malformed JSON）がDashboard全体をcrashさせない。`donomanaRecordReadLog()`のArray-or-[]契約を信頼しつつ、複合構造（kyou-no-kiroku等）は各adapterで個別にtry/catchする。

---

## 15. Local-only原則（決定、§30）

初期Dashboardは外部serverへ一切送信しない。localStorage読み取り・ブラウザ内処理のみ。AnalyticsへRecord内容を送信しない。この原則は21 Foundationアプリの既存Privacy Guidance（「記録は外部へ送信されません」）と一致させる。

---

## 16. Read-only / Editable（決定B、§31）

**決定: T8-B MVPはread-only。** 個別Record削除は元アプリ（例: janken-appなら`janken-app.html`自身の「すべて削除」）で行う。Dashboardからの横断削除は、意図しない大量削除リスク（アプリを跨いだ誤操作）が大きく、MVPスコープ外とする。

---

## 17. Cross-app CSV戦略（決定F、§32-33）

| 案 | 説明 | 評価 |
|---|---|---|
| **A. 全Record共通列のみ（第一候補）** | 日付／時刻／アプリ名／カテゴリ／活動／概要（＋可能ならinputMethod） | シンプル、教師が一覧性を重視する用途に合う |
| B. 巨大union columns | 21本の全payloadフィールドを列として並べる | ほとんどのセルが空欄になり可読性が低い、Excel運用に不向き |
| C. app別CSV bundle | 21本分のCSVをzip等でまとめる | 実装コストが高く、横断CSVという目的からずれる |

**決定: A**。app固有の詳細（janken-appの「まちがえた内容」等）は、Dashboardの横断CSVには含めず、既存の各アプリ個別CSV（janken-app内の「CSVで書き出す」等）を引き続き利用する案内をDashboard側に添える。

---

## 18. Dashboard情報階層（UI Concept、まだ実装しない、§34-37）

```
Top: 「学習のきろく」（先生・支援者向け、独立ページ）
├─ Summary cards: 今日の活動数 / 使った教材の数 / 直近の教材（※平均点・ランキング・達成率は置かない）
├─ Filters: 今日 / 7日 / 30日 / 任意期間・app・category・activity
│   （inputMethodは§6の理由により初期filterに含めない）
├─ Timeline（第一候補、Table単独に依存しない）
│   09/01
│   ├─ じゃんけん まなぼう！   6問中5問正解。「パーに勝つ手」で1回間違い。
│   └─ はんばいかい レジ       3商品、合計650円。
└─ Record detail（クリック時）
    date/time・app・activity・app固有summary・主要metrics
    raw JSONは利用者へ見せない
```

Summary cardsに「平均点」「ランキング」「達成率」を置かない（§0/§19/§21の原則）。優先は「活動数」「教材数」「最近使った教材」。表現は「変化」「最近の記録」「活動の様子」「取り組み」を優先し、「成長」「向上」を記録だけから自動断定しない（§20-21）。

---

## 19. Accessibility / Mobile（決定、§40-41）

- keyboard操作、screen reader、200%zoom、44pxタッチターゲット、色だけに依存しない表現、reduced motion対応をrequirement化。table単独に依存しないUI（Timeline/cardを主とする）。
- 教師がiPad・PC・スマホで見る想定のため、Desktop table専用UIにしない。Mobileではtimeline/card形式を第一候補とする。

これらはT7期で確立済みのアクセシビリティ実装パターン（switch scan・focus trap・44px規約等）を新規Dashboardページでも踏襲する。

---

## 20. 名称候補（§39）

「Dashboard」「Learning Analytics」といった技術語をそのまま利用者向け名称にしない。候補（優先順）:

1. **学習のきろく**（推奨）— 既存21アプリの「📊 きろく」表記と一貫性がある
2. きろくをふりかえる
3. 学習のふりかえり
4. 先生向け 学習のきろく

入口は**支援者向け独立ページ**（`/records-dashboard.html`相当、名称は上記候補で再検討）を第一候補とする。Top pageやApp Introへの埋め込みは避け、教師・支援者が能動的に訪れる専用ページとする。

---

## 21. Decision Log（サマリ）

| 項目 | 決定 |
|---|---|
| A. Device-level / Profile-level | **Device-level先行**。kyou-no-kirokuのみ個別リンク案内、他20本と混在させない |
| B. Read-only / Editable | **Read-only**（削除は元アプリで） |
| C. Existing keys aggregation / Global index | **Existing keys aggregation** |
| D. Timeline / Table first | **Timeline先行**（table単独に依存しない） |
| E. Common summary strategy | **Dashboard側adapter**がpayloadから生成 |
| F. Cross-app CSV strategy | **共通列のみ**（日付/時刻/アプリ/カテゴリ/活動/概要） |
| G. gaze-keyboard integration | **統合しない**、別タブとして分離（既存Standard踏襲） |
| H. Image records | 初期非表示、詳細ビューでlazy display |
| I. Privacy boundary | High(kyou-no-kiroku)は分離、Medium(bosai/register/nazori)はエスケープ必須、sst-appの日記storageは除外 |

---

## 22. Risk Register（§56）

| リスク | 内容 | 対応方針 |
|---|---|---|
| schema heterogeneity | 21本中16本がStandard Core Schema未使用（§2） | Adapter Registry必須（§9.4） |
| legacy records | schemaVersion欠落・複合構造・独自形式が混在 | normalize()内で吸収、失敗時はスキップしcrashさせない |
| localStorage blocking | 無制限capアプリでの同期読み込み遅延 | 直近N件抽出＋明示的な全件表示（§12.3） |
| origin共有quota逼迫 | 35アプリ共有originで無制限cap 7本＋画像データが競合 | Dashboardで可視化、rolling cap追加提案は別Phase候補 |
| privacy aggregation | 個別には低リスクな記録も、横断表示で「個人像」が見えるリスク | kyou-no-kiroku等High分類を分離、自由入力は都度エスケープ |
| name/profile ambiguity | 21本中ほぼ全てがdevice-levelでprofile非対応 | Device-level Dashboardに限定（§7 Decision A） |
| XSS | 自由入力フィールド（name/items[].name/allChars等） | 全てエスケープ経由でDOM挿入 |
| CSV Formula Injection | 横断CSVの概要列に自由入力由来の文字列が混入しうる | safe-quote guardを共通CSV生成にも適用 |
| corrupted storage | 個別app storage破損 | try/catchで個別スキップ、Dashboard全体は継続動作 |
| image size | nazori-app等の画像データ | lazy display、初期一覧には含めない |
| false interpretation | 「成長」「苦手」等の自動生成 | 事実（記録）と教師の解釈を明確に分離、自動生成しない（§50） |

---

## 23. MVP Scope（T8-B、§52）

1. 独立Dashboardページ（「学習のきろく」）
2. 21 storage keyのread（kyou-no-kiroku・sst-app日記storageは対象外/分離）
3. Timeline表示
4. app / date filter
5. summary adapter（21本分）
6. Record detail view
7. 横断CSV（共通列のみ）
8. local-only（外部送信なし）
9. read-only

### 除外（T8-Bではやらない、§53）

Cloud sync／Login／Learner account／AI自動評価／個別支援計画生成／ranking／automatic recommendation／record edit／cross-device sync／inputMethod filter（データ不足のため）／Profile-level Dashboard／Global Index方式／画像の初期表示。

---

## 24. Implementation Estimate（概算、§57）

| フェーズ | 内容 | 概算 |
|---|---|---|
| T8-B-1 | Adapter foundation（21本分のnormalize/summarize/metrics定義） | 中〜大（21本個別実装、既存21本のRecord実装と同規模の粒度） |
| T8-B-2 | Dashboard UI（Timeline/Summary cards/独立ページ） | 中 |
| T8-B-3 | Filtering（date/app/category） | 小〜中 |
| T8-B-4 | 横断CSV | 小 |
| T8-B-5 | Responsive/A11y（既存パターン踏襲） | 中（44px/keyboard/zoom/switch scan） |
| T8-B-6 | Validation（21アプリ実データでのE2E確認、Excel/XSS/Formula Injection含む） | 中〜大（T7-J相当の検証範囲） |
| T8-B-7 | Release | 小 |

段階的に複数のsub-phase（T8-B, T8-C, ...）へ分割することを推奨。一括実装は21本のadapter定義の量から現実的でない。

---

## 25. 将来検討事項（本Phaseでは対応しない）

- 共通Learner Profile Foundation（§27）
- Global Index方式への移行（§9.3）
- 無制限capアプリ7本への200件capの追加提案
- bosai-appの`name`フィールドPrivacy Guidance再検討
- hiragana-learn/katakana-appの`traceSample`サイズ実測
- kyou-no-kiroku個別ダッシュボード（Profile-level）
- T10相当の「支援ヒント・教材推薦」（本Phaseでは明確に分離、Record事実と教師の解釈を混同しない）
