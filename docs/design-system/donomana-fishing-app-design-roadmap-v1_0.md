# どのまな 魚釣りアプリ 設計文書・ロードマップ v1.0

発行：2026年10月／版：1.0（Phase FISHING-APP-VARIETY-AND-SIZE-EFFORT-1 時点）

対象：`sakana-tsuri.html`（apps-data.json未登録、固定Previewでのみ配信中）

## 0. この文書の位置づけ

魚釣りアプリの設計文書は、これまでsakana-tsuri.html内のコードコメントが
`docs/design-system/donomana-fishing-app-input-methods-design-v1_0.md` や
`donomana-fishing-app-cast-zone-design-notes-v1_0.md` を参照していたが、
実際にはこれらのファイルは一度も作成されていなかった（本Phaseで確認）。
本文書が、このアプリについて実際に存在する最初の設計文書である。

既存の巻き取り方式（円弧・長押し・タイミング）・入力設定（まきとる量/速さ）・
状態機械・Learning Record連携など、既に実装済みの仕組みの詳細はコード自体
（sakana-tsuri.html本体のコメント）を正本とし、本文書では重複して記載しない。
本文書は主に、(1) 本Phaseで追加したバリエーション・大きさ・手応えの設計判断、
(2) ユーザーから提示された今後の学習モード構想の記録、の2点を対象とする。

## 1. 本Phaseで実装したもの（FISHING-APP-VARIETY-AND-SIZE-EFFORT-1）

### 1.1 背景バリエーション

- `BACKGROUND_PALETTE`：3種（既存の池／秋の池／石のある川）。
- 既定は「おまかせ」：直前に表示した背景を候補から除外し、残りから一様乱択する
  単純な非連続選択（`pickNonRepeating()`）。3種構成のため、直前と同じ背景には
  論理的に絶対にならない。
- 先生が特定の1種類に固定する設定（`inputSettings.backgroundMode`）も用意。
- 適用タイミング：次の「なげる」（次の活動の開始）時点でのみ背景を決定・反映する
  （`startCast()`内の`pickBackground()`呼び出し、セッション開始時にも1回呼ぶ）。
  操作中（WAITING〜CAUGHT）に設定を変更しても、その回の表示は変化しない。

### 1.2 魚の見た目バリエーション

- `FISH_PALETTE`：3種（オレンジ／赤白／まだら模様）。選択ロジックは背景と同じ
  `pickNonRepeating()`パターンを再利用。
- 先生が固定する設定（`inputSettings.fishTypeMode`）も用意。
- 適用タイミング：魚が最初に画面に現れる瞬間（`enterWaiting()`内の
  `pickFishAppearance()`、既存の「食いつくまで同じ魚」という既存仕様はそのまま）。

### 1.3 大きさ（小・中・大）

- `FISH_SIZES`：見た目と種類から独立した軸。`pickFishAppearance()`内で、
  種類の選択（ロック中でも）とは無関係に、常に一様乱択する
  （指示: 「種類と大きさを独立させる」）。
- 画面上の伝え方：(a) 魚自体の表示サイズ（`currentSizeScale`、既存の遠近
  depth-scaleと乗算で合成）、(b) 魚の下に表示する文字バッジ（`#fish-size-label`、
  「ちいさい/ふつう/おおきい」）。色だけに依存しない。
- クリッピング対策：既存のCAUGHT時ポップ演出（内側1.16倍）と合成されても
  安全な範囲として、大=1.18倍に設定（実機スクリーンショットで確認済み、
  §4参照）。

### 1.4 大きさに応じた手応え（任意設定）

- `inputSettings.sizeEffort`（既定'off'）。
- 設計の核：**各入力1回あたりの効果量（`REEL_GAIN_PRESETS`由来のamount）は
  一切変更しない**。変わるのは「釣り上げに必要な合計量」＝`reelTarget`の
  ほうで、既定100から、効果ONかつ中/大を引いた回のみ125/150へ変わる
  （`effortMultiplier`: 小=1, 中=1.25, 大=1.5、指示通りの試作値）。
- この設計により、円弧（360度ターン回数）・長押し（タイマーtick回数、かつ
  tick間隔そのものは不変のため合計時間も同じ比率でしか伸びない）・
  タイミング（成功タップ回数）の3方式すべてが、追加のロジックなしで
  自動的に同じ比率（1.25倍/1.5倍）だけ多くの操作を要求するようになる。
  長押しの「時間」だけが不釣り合いに伸びることはない（tick間隔
  `HOLD_TICK_MS`自体は手応え設定の影響を受けないため、他方式の「回数」が
  伸びるのと同じ比率で時間も伸びるだけで、二乗的に悪化することはない）。
- 既定OFF時は、どの大きさを引いても`reelTarget`は常に100に固定され、
  既存の操作量と完全に同一（指示: 「初期設定では、大きさによって必要な
  操作量を変えない」）。
- **試作値の位置づけ**：1.25倍／1.5倍は固定の完成値ではない。実機（iPad）で
  「大」が長すぎると判断された場合は、負担を抑える方向（例：1.5→1.35など）
  へ`FISH_SIZES`の`effortMultiplier`を調整する。調整は本文書とコード
  コメント（`FISH_SIZES`定義そのもの）の両方を更新すること。

### 1.5 FISH_PALETTE / caughtColor・caughtSize スキーマについて（重要）

**発見した既存の不整合**：直前のPhase（FISHING-APP-ART-INTEGRATION-AND-
FIXED-PREVIEW-1）で魚の見た目がSVG（`currentColor`で色分け可能）から1枚の
オレンジ色画像に置き換わったにもかかわらず、`saveTrialRecord()`は
引き続き`FISH_PALETTE`の`red`/`blue`/`yellow`という3色から無作為に選んだ値を
`caughtColor`として記録し続けていた。つまり、画面には常にオレンジの魚しか
表示されていないのに、記録上は「青い魚を釣った」「黄色い魚を釣った」という
事実と異なるデータが生成され得る状態だった。

**本Phaseでの対応**：`FISH_PALETTE`を`{color,hex}`から`{type,label,image}`へ
作り替え、`caughtColor`フィールドの**キー名は変更せず**、値だけを
実際に表示された画像に対応する`type`（'orange'/'red-white'/'spotted'）に
差し替えた。`caughtSize`も同様に、これまで一切画面に反映されていなかった
ランダムな1-3の整数から、`FISH_SIZES`の説明的なキー文字列
（'small'/'medium'/'large'）へ変更した。いずれも、リポジトリ内で他に
このフィールドを読んでいるコードが存在しないことを確認済み（キー・セット
自体は不変、値の語彙のみの変更として扱った）。

**検討したが採用しなかった代案**：キー名自体を`caughtFishType`等へ
改名する案。より自己説明的になる利点はあるが、(a) 現時点で`caughtColor`を
読む外部コードが存在しないため改名の実利が薄く、(b) キー名の変更は
ペイロード形状そのものの変更であり、指示の「既存schemaの変更が必要に
なりそうなら、独断で変更せず具体的な理由と代案を報告する」に該当すると
判断したため、今回は見送った。ユーザーが改名を望む場合は次Phaseで対応可能。

## 2. 今後の学習モード構想（本Phaseでは未実装）

添付README（donomana-fishing-variety-concept）に記載された構想を、設計の
前提条件として記録する。**いずれもこのPhaseでは実装しない。**

### 2.1 色指定モード

- 画面・音声で示された色の魚を釣る。
- 必要条件：
  1. 「色の集合」の定義。現在の3種（オレンジ／赤白／まだら）は、どれも
     単色の色名だけでは明確に区別しづらい（「赤白」はオレンジとも近く
     見える可能性、「まだら」はそもそも単色ではない）ため、README自身が
     指摘する通り、このままでは「赤／青／黄」のような明確な色指定学習を
     満たせない。採用する色集合と、それに対応する実際の画像を別途
     設計・実機確認してから着手する。
  2. お題の提示（文字＋音声、必要なら模様でも補足）。
  3. 判定ロジック（お題の色と、実際に釣れた魚の色が一致するか）。
  4. 釣果表示・活動記録（`targetColor`フィールドは既存スキーマに
     既に予約済み・現在null固定。`caughtColor`との一致判定を記録する
     設計が必要）。
- 大きさに応じた手応え設定とは独立させる（学習目標と難度調整を混在させない）。

### 2.2 数指定モード

- 指定された匹数を釣る。
- 必要条件：
  1. 目標匹数の選び方（最初は少ない数から）。
  2. 進捗の可視化（数字＋視覚表示、音声等）。
  3. 加算タイミング（釣り上げに成功した瞬間のみ、既存の`landFish()`が
     自然な差し込み点）。
  4. 「もういちど」・中断・再開との整合（目標・進捗がどこに保持され、
     いつリセットされるか）。
  5. `targetCount`フィールドは既存スキーマに既に予約済み・現在null固定。
- 自由モードは維持したまま追加する（モード選択自体の設計が必要）。

### 2.3 共通の設計方針

- 複数条件の同時指定（色＋数など）や得点・正誤評価は、この段階では
  自動的に導入しない。
- 大きさに応じた手応え（§1.4）は学習目標そのものとは独立した難度調整
  パラメータとして扱い、色指定・数指定モードとも独立に組み合わせ可能な
  設計とする。

## 3. ブランドのScene Collectionと、魚釣りゲーム内の絵柄の用途分担

共通デザインシステム（`donomana-design-system-v2_0.html`）の
「Scene Collection 001-003」（同じ机／同じ輪／同じ作業台）は、ブランド・
広報用の、基準キャラクター（先生・子ども・成人）を使った定型構図の
イラスト資産であり、A4チラシ等の印刷物・Web掲載を主な用途とする
（同文書 §0.2「3.8 Scene Collection 001-003」、§参「この追補に対応する
実装例」）。

これに対し、魚釣りアプリ内の水辺背景・魚・釣り竿の絵（本Phaseおよび前Phase
で追加した`assets/sakana-tsuri/`配下の画像）は、ゲーム画面専用の情景イラスト
であり、ブランドの基準キャラクターは一切登場しない。両者はこれまで明文化
された形で区別されていなかったため、ここに短く記録する：

**Scene Collectionはブランド・広報の定型構図（人物中心）、魚釣りアプリの
背景・魚・竿の絵はゲーム内の情景・題材イラスト（人物を含まない）であり、
用途も制作意図も別物として扱う。** 一方を他方の代用として使うことは
意図されていない。

## 4. 本Phaseで実装したもの（FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1）

### 4.1 タイミング方式の速さ設定

- `inputSettings.timingSpeed`（既定'normal'）。選択肢: very-slow(0.5x)/
  slow(0.75x)/normal(1.0x=現行速度)/fast(1.25x)。倍率は試作値（指示通り）。
- 実装：`TIMING_SPEED_MULTIPLIERS`テーブルを追加し、`startTimingAnimation()`
  実行時に一度だけ`activeTimingCycleMs = TIMING_CYCLE_MS / multiplier`を
  計算して以降のスイープはこの値のみを参照する。既存の`HOLD_TICK_MS`が
  「次のonHoldStart()から適用、長押し中は不変」という設計と同じ考え方を
  Method Cに適用したもの——活動中に設定を変えてもその回のスイープ位置は
  飛ばない・判定がブレない（設定は次のスイープ開始＝次のREELING突入時や
  method切替時のみ反映）。
- `TIMING_ZONE_PERFECT_HALF`/`TIMING_ZONE_GOOD_HALF`（前Phaseで広げた範囲）
  と`.timing-marker`の大きさは一切変更しない。必要な成功回数（reelTarget・
  REEL_GAIN_PRESETS）も不変——速さは「当てる難易度」のみを変え、「必要な
  回数」は変えない設計。
- UI：「タイミングよく おす」選択中のみ表示される`#reel-timing`内の
  コンパクトな`.preset-group`（既存の背景/魚種/手応え設定と同一パターン）。
  常時「いまの はやさ：〇〇」の文字表示を併設。

### 4.2 共通「学習のきろく」への登録

**列挙した変更範囲**（指示: 「先に列挙してください」）:

1. `apps-data.json`: `sakana-tsuri`の新規エントリ追加。
   - 調査の結果、`LEARNING_RECORD_FOUNDATION_APPS`（generate.js）による
     Learning Record Foundation注入は、`apps-data.json`に登録済みの
     アプリしか対象にしない仕組みだと判明——「学習のきろくに出す」ためには
     apps-data.json登録が技術的な前提条件。
   - 副作用の調査: favicon/SEOタグ/a11yパネル/announce-helper/design-tokens
     /lock-fs-btn/home-btnは`apps-data.json`登録アプリ全件に無条件適用
     （Setによるopt-inではない）。一方PWA manifest/registerは
     `PWA_REGISTER_TARGET_FILES`という明示的な固定ファイルリストのみが
     対象で、apps-data.json経由ではない——前Phaseの「PWA/Service Workerは
     新設しない」という判断と衝突しないことを確認済み。
   - **scope上の判断・訂正（お伝えすべき点）**：当初、`index.html`のアプリ
     カード一覧は手書き静的HTML（generate.js非連動）と見て、`releaseDate`/
     `isNew`/更新履歴エントリのみ見送れば公開カード追加を回避できると判断
     していた。**実際に`generate.js`を実行したところ、この判断は不正確
     だったと判明**：`index.html`内の検索・絞り込み用`const APPS=[...]`
     配列とJSON-LD構造化データ、および`app-intro.html`の紹介カード一式は
     `apps-data.json`登録アプリ全件に対して無条件で同期される仕組みであり、
     `releaseDate`を設定しなくても新規登録アプリは自動的にトップページの
     検索対象・アプリ紹介ページに現れる（= 「学習のきろく登録のみ・公開は
     見送る」という構成はgenerate.jsの標準パイプライン上サポートされて
     いない）。独自にこの同期を止める改造は「generate.jsが正本の箇所は
     正本を変更し再生成する」という指示の精神に反するため行わなかった。
     更新履歴（MANUAL_CHANGELOG／index.html CHANGELOG配列）への追加は
     `releaseDate`省略により引き続き発生しない（確認済み）。本Phaseの
     変更はSource mainへは反映しておらず、Production (donomana.jp) への
     公開は別途のProduction Release Phaseでの承認を経るまで発生しない。
2. `generate.js`: `LEARNING_RECORD_FOUNDATION_APPS`に`'sakana-tsuri'`を追加。
   加えて2箇所:
   - `SETTINGS_PROXY['sakana-tsuri']`: `#sakanaSettingsBtn`の既存コード
     コメントが「generate.jsに登録済み」と予告していたが、実際には
     未登録だった（過去Phaseの記述ミス）。今回実際に登録した。
   - `hideWithDisplayNone`に`'sakana-tsuri'`を追加: 1回目のgenerate.js
     実行結果を確認したところ、`#sakanaSettingsBtn`（`data-scan="1"`を
     持つ、自アプリのSwitch Scan候補の1つ）の非表示方法が、手コピー版の
     `display:none`から標準の`opacity:0`へ変わっていた。Switch Scan側の
     `isVisibleEnabled()`は`display:none`のみを見て`opacity`は見ないため、
     このままでは「見えないのに実質操作可能なSwitch Scan候補」という、
     このSetが元々防ぐために作られたバグを再現してしまう。同じSwitch
     Scan系アプリのsawatte-hirogaru-appと同じ扱いに揃えて修正し、
     generate.js再実行で手コピー版と完全に同じ`display:none`へ戻る
     ことを確認した。
3. 生成対象: `app-details/sakana-tsuri-detail.html`（新規）、
   `sitemap.xml`（2件追加）、`index.html`/`app-intro.html`（検索配列・
   JSON-LD・紹介カードの同期、更新履歴は変化なし）、`sakana-tsuri.html`
   内の各種自動挿入ブロック（Learning Record Foundation・favicon・SEO・
   学習のきろく導線ボタン・a11yパネル・announce-helper等）。
4. `assets/js/record-dashboard-foundation.js`: `sakana-tsuri`用の
   `registerAdapter({...})`を追加（sawatte-hirogaru-appと同じ、
   donomanaRecordCreate()の正規Core Schemaをそのまま読むadapter）。
5. `assets/js/sakana-tsuri-record-detail.js`: 新規共有モジュール
   （directions-record-detail.jsと同形。summary文生成・Level 2詳細行・
   CSV行の3関数、App-local/Common双方から将来共有可能な形）。
6. `learning-records.html`: 上記detail.jsの`<script>`タグを
   record-dashboard-foundation.jsより前に1行追加。
7. 関連テスト: `sakana-tsuri-variety-test.py`への追加検証、golden testsの
   実行（新規adapterのnormalize/getDetails/CSV出力の形式確認）。


## 数指定モード（FISHING-APP-COUNT-MODE-AND-FIXED-PREVIEW-1）

自由を既定とし、開始前に「かず」と目標1〜5匹（既定3）を選ぶ。
課題開始でmodeとtargetCountを確定し、1匹ごとの状態機械は維持する。
数モードの釣果は自動resetせず、未達時は「つぎの さかな」で累積を維持、
達成時は「もういちど」で準備画面へ戻る。新課題は新ID・0匹から開始する。
釣り上げた直後は枠・表示数を自動で埋めない。「かごに ならべる」を押して
自分で1匹を次の空枠に置いたときにのみ、魚1匹と対応する数字を表示して
数を1増やす。釣れた直後は魚と目標枠を見比べ、押してから数字と魚を一対一に
対応させる。並べた後に次の魚／もういちどへ進む。未配置のまま遊び方を変える
場合も確認を表示する。色の違い・魚の大きさは数え方の成否に使用しない。
途中破棄はインライン確認を使い、保存済み記録は削除しない。課題状態はメモリのみで、
reload後は再開しない。色指定モードは引き続き未実装。

既存Foundation payloadのmode/targetCountを使用し、数モード釣果のみに
challengeId:string、caughtCount:integer、challengeCompleted:booleanを追加する。
landFishのcaughtLandedガードの内側で加算し、従来どおり1キャッチ1件保存する。
目標達成用の追加レコードは作らない。途中記録のfalseは「このキャッチ時点で未達」であり、
その後の課題全体の中断/完了を推測しない。旧記録の欠落値も推測しない。
`caughtCount`と`challengeCompleted`は釣果時点の事実で、かごへの配置や子どもが
正しく数えたかの成績を示さない。かごの進行はメモリ上のみとし記録には追加しない。
共通CSVの9列を維持し、既存「釣れた魚」セルに数課題の保存事実を付記する。
App-local記録一覧は既存実装に存在しないため新設せず、共通「学習のきろく」へ集約する。
Core Schema・保持期間・バックアップ仕様は変更しない。

確認は新規モーダルを作らずインラインで表示し、安全側の「つづける」へフォーカスする。確認中は釣り操作部をinertにし、入力を解除する。Escapeで継続し、閉じると開いたボタンへ戻す。
