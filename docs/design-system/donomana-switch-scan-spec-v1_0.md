# どのまな 共通Switch Scan仕様書 v1.8

- 版: v1.8（**承認済み**）
- 発行: 2026年8月（v1.0初版）／承認: 2026年8月8日（v1.1）／API確定: 2026年8月8日（v1.2）／3 Pilot Review確定: 2026年8月8日（v1.3）／配置方式正式決定: 2026年8月8日（v1.4）／Rollout実装事実反映: 2026年8月8日（v1.5）／Group A Rollout完了実績反映: 2026年8月8日（v1.6）／Group B Rollout完了実績反映: 2026年8月12日（v1.7）／Group C・D Rollout完了実績反映・Phase25 Rollout完了総括: 2026年8月12日（v1.8）
- 作成日: 2026-08-05（v1.0起草）／改訂日: 2026-08-08（v1.1・v1.2・v1.3・v1.4・v1.5・v1.6）・2026-08-12（v1.7・v1.8）
- 位置づけ: `donomana-design-system-v2_0.html`（共通デザインシステム Ver.2.1）を**上位方針とする実装詳細の補足文書**。Design Systemの内容を置き換えるものではない。`donomana-modal-accessibility-spec-v1_0.md`（モーダルアクセシビリティ仕様書 v1.1）13章「Switch Scan」・21章未決定事項12番「全アプリ共通のSwitch Scan候補抽出方式の統一」を引き継ぎ、Switch Scan単独の共通仕様として分離・詳細化する文書である。
- 根拠調査: Phase18.31-A「Switch Scan方式統一 調査」（kimochi-board.html・matching-app.html・directions-app.html・bosai-app.html の4アプリ・コードレビューのみ、コード変更なし）／v1.1改訂にあたり15アプリ規模の追加サンプリング監査を実施（1.4節・3.3節・6.1節参照）／v1.2は2つのPilot実装（directions-app・matching-app）の比較結果を根拠とする（16章）／v1.3は3つ目のPilot実装（schedule-app）を加えた3 Pilot比較の結果を根拠とする（18章）／v1.4は4つ目のPilot実装（okane-app）と21アプリ全対象の軽量inventory（Phase25-I）を加えた配置方式の正式決定を根拠とする（19章）／v1.5はGroup A Rollout第1波（katakana-app、Phase25-M／Phase25-M2）の実装・実ブラウザ検証・公開確認から得られた実装事実に基づく訂正を根拠とする（19.17節）／v1.6はGroup A Rollout全7アプリ完了（Phase25-M〜X）の実装事実を根拠とする（19.18節）／v1.7はGroup B Rollout全6アプリ完了（yomikaki-app・bosai-app・ongaku-app・time-timer・sugoroku-app・nazori-app、Phase25-AA〜AOのうち該当分）の実装事実、および同Rollout過程で発見・修正した利用者向け既存不具合3件（ongaku-app・sugoroku-app・nazori-app）の実績を根拠とする（19.19節）／v1.8はGroup C（kimochi-board・gaze-keyboard）・Group D（hiragana-learn・suji-manabou）のRollout完了実績、同過程で発見・修正した利用者向け既存不具合3件（gaze-keyboard・hiragana-learn・suji-manabou）の実績、およびPhase25全対象21アプリの横断Inventory（Phase25-BG）を根拠とする（19.20節〜19.22節）
- 起草: Phase18.31-B
- 承認: v1.1として2026-08-08承認済み。v1.2はPilot実装結果を反映したAPI確定版として同日承認。v1.3は3 Pilot（directions-app・matching-app・schedule-app）の実装事実に基づくReviewとして同日承認。v1.4は4 Pilot＋21アプリinventoryに基づく配置方式の正式決定として同日承認。v1.5はkatakana-app Rollout実装事実に基づく訂正として同日承認。v1.6はGroup A Rollout全件完了の実装実績記録として同日承認。v1.7はGroup B Rollout全件完了の実装実績記録として承認。v1.8はGroup C・D Rollout全件完了、およびPhase25 Switch Scan Rollout（21アプリ全件）の完了総括として承認。
- 参照元: Phase18.31-A調査報告（本文書と同一セッション内で作成、4アプリの実装比較表を含む）

> **本文書v1.8は2026-08-12に承認済みである。** 共通Switch Scan実装の基準として運用を継続する。ただし本文書が定めるのは主に「lifecycle・timer・highlight・activation・stop・cleanup・refresh」等の共通契約（16章参照）であり、候補取得方式（3.3節）や既存アプリのハイライトclass名（6.1節）を単一方式へ強制するものではない。**本文書の承認のみを理由に、既存の稼働中コード（`generate.js`・各アプリのHTML/JS）を一括改修することは求めない。** 16章のhelper API・adapter設計、18章の3 Pilot Review、19章の配置方式正式決定は、既に完了したdirections-app・matching-app・schedule-app・okane-appの4 Pilot実装（17章）の**事実に基づく**設計であり、いずれのPilotのコードへも変更を要求しない。**19章で正式採用した「方式C：各アプリ内保持」に基づき、Pilot4・Group A7・Group B6・Group C2・Group D2の計21アプリすべてのRolloutが完了した（19.22.2節）。** **19.17節（v1.5で追加）は、Group A Rollout第1波（katakana-app）の実装事実に基づき、Strategy B実例・highlight方式・Group A分類・21アプリinventoryの位置づけに関する訂正を記録する。** **19.18節（v1.6で追加）は、Group A Rollout全7アプリ完了の実装実績を記録する。** **19.19節（v1.7で追加）は、Group B Rollout全6アプリ完了の実装実績、および同過程で発見・修正した利用者向け既存不具合3件の運用上の教訓を記録する。** **19.20節・19.21節（v1.8で追加）は、Group C（kimochi-board・gaze-keyboard）・Group D（hiragana-learn・suji-manabou）のRollout完了実績、および同過程で発見・修正した利用者向け既存不具合3件の実績を記録する。19.22節（v1.8で追加）は、Phase25 Switch Scan Rollout（21アプリ全件）の完了総括として、helper6運用原則・二重activation設計原則・delayed callback最終原則・Rollout前既存不具合修正procedure・最終Inventory・新規アプリ向けチェックリストを整理する。19.17節〜19.22節のいずれも新たな仕様の追加ではなく、実装実績から得られた事実の記録・一般化である。**

---

## 0. 本文書の背景

Phase18.25〜18.30にて、kimochi-board.html・matching-app.html・directions-app.html・bosai-app.htmlの4アプリへ、共通アクセシビリティ文字サイズ（normal/large/xlarge）統合およびモーダル到達性改善を実施した。この過程で、4アプリがそれぞれ独立にSwitch Scan（単一スイッチ走査型操作支援）を実装しており、方式が大きく異なることが繰り返し記録された。

`donomana-modal-accessibility-spec-v1_0.md` 13章は、Switch Scanをモーダルとの関係という限定的な観点からのみ扱っており、同文書21章未決定事項12番で「全アプリ共通のSwitch Scan候補抽出方式の統一」を将来課題として明記していた。

Phase18.31-Aにて、この課題に対する初の横断調査として、4アプリのSwitch Scan実装（開始処理・候補取得・フォーカス表示・決定処理・停止処理）をコードレビューにより比較した。本文書はその調査結果を根拠として、Switch Scan単独の共通仕様を初めて文書化するものである。

本文書は4アプリの実証のみを根拠とする。どのまな全体では30アプリ以上が稼働しているため、4アプリだけでは根拠が不十分な事項は「未決定」として明示し、将来Phaseでの追加実証（Pilot）を経てから確定させる。

---

## 1. 目的

### 1.1 Switch Scanとは

Switch Scanとは、単一（または少数）の外部スイッチ／キーボードのみで画面上の操作対象を選択できるようにする、走査（スキャン）型の操作支援機構である。一定間隔で操作対象を自動的に順送りでハイライトし、利用者がタイミングを合わせて1つの入力（外部スイッチ・Space・Enter・タップ等）を行うことで、ハイライト中の対象を選択・決定する。

### 1.2 対象ユーザー

- 上肢の運動機能に制約があり、マウス操作やタッチのポイント＆クリックが困難な利用者
- 外部スイッチデバイス（単一スイッチ／2スイッチ）を主な入力手段とする利用者
- 視線入力デバイス（Tobii等）と併用する利用者（kimochi-board.htmlに実装例あり。詳細は11章）

### 1.3 設計思想

1. Switch Scanは、マウス・タッチ・キーボードの標準操作を置き換えるのではなく、**それらと共存する追加の操作経路**として設計する。
2. Switch Scanの有効/無効は、利用者が明示的に切り替えられる状態を原則とする（5章・13章参照。ただし現状の一部アプリはこの原則から外れており、13.3節・21章に記録する）。
3. Switch Scanが到達すべき対象は、**そのときアプリ画面上で実際に操作可能な要素すべて**であり、一部の要素だけを恣意的に除外しない（3章・5章）。
4. 具体的な変数名・関数名・CSSクラス名の完全な統一は本仕様書では**必須要件としない**。達成すべき結果（挙動）を優先し、命名統一は6章・13章に記載する範囲にとどめる。

### 1.4 Switch Scanの区分（v1.1で追加）

本仕様書が対象とする「Switch Scan」は、以下のいずれに該当するかを区別する。この区分は、既存アプリの棚卸し（1.5節）や将来の共通helper設計（16章）が対象を誤認しないために設ける。

1. **自動走査型Switch Scan（本仕様書の主要対象）** — 複数の操作候補を一定時間ごとに自動で順番にハイライトし（3章・4章）、利用者がSpace等（7章）でそのとき候補になっている対象を決定する方式。走査タイマー（`setInterval`等）による自動送りを持つことが要件。
2. **Keyboard Activation対応（本仕様書の直接対象外）** — Tab・Enter・Space等のキーボード操作で要素を操作できるが、自動走査（1番の意味でのタイマー送り）そのものは行わない方式。外部スイッチ機器がキーボードイベントとして到達する場合、利用者はこの方式でも操作できることが多いが、**「Switch Scan実装済み」とは区別する**。2.1節M1〜M3・7章の決定操作要件は、自動走査型（1番）にのみ適用する。
3. **scanという名称を使うが対象外の実装** — 変数名・関数名に`scan`を含むが、複数候補間を順番に走査するものではない実装（例: 単一の操作対象の明滅・強調表示を切り替えるだけの視覚演出）。本仕様書のSwitch Scan要件（M/R/C/U）はこれらには適用しない。

`tyushi.html`（ひかるボタン・注視訓練）は3番に該当する。同アプリは`scanOn`/`scanTimer`等の変数名を持つが、これは単一ボタンの明滅演出のタイマーであり、複数候補間を走査するものではない。したがって本仕様書のSwitch Scan要件の対象外として扱う。

### 1.5 apps-data.jsonとの関係（v1.1で追加）

`apps-data.json`の`a11y`・`badges`フィールドに「スイッチ」という語を含むアプリは、2026年8月時点で29アプリ中21アプリ存在する。**この21という数値は、1.4節でいう自動走査型（1番）とKeyboard Activation対応（2番）を区別しない、広義のSwitch Scan関連対応表記の件数である。**

この数値と本仕様書が主対象とする「自動走査型Switch Scan実装済みアプリ数」は、必ずしも1対1ではない。例えば`mogura-tataki`は`a11y`フィールドの記述（「キーボード操作対応（スイッチ入力にも対応）」）により21件に含まれるが、実装が自動走査型（1番）かKeyboard Activation対応（2番）のいずれに該当するかは、本文書の根拠調査（4アプリ）の範囲では確認されていない。

**自動走査型の正確な件数は、21アプリ全件の詳細inventoryを確定した後に、本文書の改訂として更新する。** 現時点で21という数値を、自動走査型の確定件数として断定しない。

---

## 2. 基本方針

### 2.1 全アプリ共通とする事項（M）

1. **M** — Switch Scan対応済みアプリは、以下の入力手段のうち少なくとも1つで「決定」操作ができること。
   - Spaceキー
   - Enterキー
   - 外部スイッチ（OS/ブラウザ側でキーボードイベントとして送出されるものを含む）
2. **M** — Switch Scanの走査（自動ハイライト移動）と、キーボードの通常のTab操作を同時に競合させない（両者が同一のフォーカス状態を奪い合わない）。
3. **M** — Switch Scan動作中も、共通アクセシビリティ機構（共通A11yパネル・Settings Proxy）が定める文字サイズ・ハイコントラスト表示と共存できること（表示が壊れない）。

### 2.2 入力手段の位置づけ

- **Space**: 4アプリ中4アプリが対応（決定または関連操作として使用）。
- **Enter**: 4アプリ中3アプリが対応（kimochi-board・directions-appは決定操作、bosai-appは「次へ送り」操作。7章参照）。
- **外部スイッチ**: OS/ブラウザのキーボードイベントとして到達するため、上記Space/Enterへの対応をもって満たされる（アプリ側で外部スイッチを個別に区別する実装は4アプリとも確認されていない）。

### 2.3 アクセシビリティとの関係

Switch Scanは、共通A11yパネル（文字サイズ・ハイコントラスト・読み上げ）と並ぶ、どのまな共通アクセシビリティ機構の一部と位置づける。ただし、共通A11yパネル自体の実装（`generate.js`テンプレート）はSwitch Scanの走査対象に含まれる場合と含まれない場合があり、4アプリで方針が割れている（5章）。本文書はこの不整合の整理を主目的の1つとする。

---

## 3. 候補生成

### 3.1 推奨方式（R）

1. **R** — 候補一覧は、走査ハイライトを更新するたび（またはSwitch Scan開始のたび）に**毎回動的に再取得**する。起動時に1回だけ取得して以後保持する静的方式は推奨しない。
2. **R** — 取得対象は、**そのとき画面上に表示されている要素のみ**とする。非表示（`display:none`）の画面・パネル・モーダル配下の要素は対象から除外する。
3. **R** — `disabled`状態の要素は候補から除外する。
4. **R** — `visibility:hidden`の要素は候補から除外する。
5. **R** — `display:none`の要素（またはその祖先が`display:none`）は候補から除外する。

### 3.2 4アプリの現状（参考）

| 方式 | 該当アプリ |
|---|---|
| 静的（起動時1回のみ取得、以後不変） | kimochi-board |
| 準動的（画面スコープの静的属性＋サイト全体のセレクタを毎回結合） | directions-app |
| 完全動的（呼び出しごとに条件分岐して再計算） | matching-app・bosai-app |

kimochi-boardの静的方式は3.1節R1に適合しない。ただしkimochi-board自体は画面遷移を持たない単一画面構成のアプリであり、静的取得でも実害が生じていないことをPhase18.31-Aのコードレビューで確認している（4章参照）。この事実をもって静的方式を推奨するものではないが、**単一画面構成のアプリに限り、当面は変更必須としない**（13章禁止事項の適用除外、21章参照）。

**（v1.1追記）** 本節は4アプリの実証に基づく。v1.1改訂にあたり15アプリ規模の追加サンプリングを行った結果、候補取得ロジックには本節の3分類（静的／準動的／完全動的）に収まらない実装が複数確認された。追加サンプリングの結果は3.3節（候補取得の2戦略）・6.1節（ハイライトclassの追加事例）に反映する。**4アプリの実証結果を超える件数を本節の表へ推測で追加することはしない。**

### 3.3 候補取得の2戦略（v1.1で追加）

v1.1改訂にあたり15アプリ規模の追加サンプリングを行った結果、候補取得の実装は、根本的に異なる2つの戦略に大別できることを確認した。本仕様書は、どちらか一方への統一を求めず、両戦略を正式に認める。

**Strategy A：明示marker方式**

`.scannable`／`[data-scan="1"]`等、Switch Scanの候補であることを示す専用の属性・classを個々の要素へ明示的に付与し、それを起点に候補を収集する方式。

- 長所: 候補を明示的に制御できる。app固有UI（ゲーム盤面の特定要素等）を候補に含める／除外する判断がしやすい。
- 留意点: marker付与漏れがあると、その要素は候補から漏れる。新規要素を追加するたびmarker付与を忘れないことが実装者の責任になる。
- 実例: `matching-app.html`・`time-timer.html`は、`generate.js`が共通chrome（`donomanaA11yBtn`等）へ自動付与する`.scannable`クラスを、自アプリの候補取得セレクタに含めている。

**Strategy B：ネイティブ操作要素包括取得方式**

`button`・`input`・`select`・`textarea`・`a[href]`・`[tabindex]`等、HTML標準の操作可能要素を包括的にクエリし、その中から表示中・非disabled等の条件（3.1節R2〜R5）を満たすものを候補とする方式。

- 長所: HTMLのsemanticsと自然に整合する。新規要素を追加しても、それが標準的な操作可能要素であれば個別にmarkerを付与しなくても自動的に候補へ含まれる。共通chromeも、`generate.js`側で`.scannable`クラスの付与有無に関わらず、実体が`<button>`／`<a href>`であれば自然に候補へ入る。
- 留意点: 意図せず操作対象に含めたくない要素（装飾目的の`<a>`等）まで候補になる可能性があり、除外条件を別途用意する必要がある。
- 実例: schedule-app.htmlの**モーダルFocus Trap**（Switch Scanとは別機能）が`querySelectorAll('button, input, select, textarea, a[href], [tabindex]')`という包括セレクタを用いている。**（v1.3訂正）** v1.1時点の本節はこのFocus Trap用セレクタをschedule-appのSwitch Scan候補取得方式として誤って記載していた。schedule-app Pilot（Phase25-G）でのコード確認の結果、Switch Scanの実際の候補取得（`buildScanItems()`）は`document.querySelectorAll('.v-item')`という単純なclassセレクタであり、Strategy Bの実例ではないことが判明した。正しい分類は18.4節を参照。**（v1.5追記）** katakana-app（Group A Rollout第1波、Phase25-M）のSwitch Scan候補取得（`buildScanItems()`）は`active.querySelectorAll('button,[tabindex="0"]')`（`.section.active`スコープ）という包括queryであり、**Strategy Bの正式な実例**であることをRollout実装のコード確認で確認した。19.2節「Strategy B実例0件」はこの実装事実により訂正する（19.17.1節参照）。**（v1.6追記）** janken-app（Phase25-Q）の`buildScanItems()`も`.screen.active`スコープの`button:not([disabled])`という包括queryであり、**Strategy Bの2件目の実例**である（19.18.3節参照）。

**（v1.6追記）** register-app（Phase25-P）の`SWITCH_SCAN_SELECTOR`定数（`.product-card,.cart-btn:not(:disabled),.icon-btn,.edit-btn-small,.scannable`）は、okane-appに次ぐ**Strategy Cの2件目の実例**である（19.18.3節参照）。

**（v1.6追記）** Group A Rollout完了（Phase25-M〜X）により、Strategy A/B/Cのいずれにも完全には一致しない実装（状態駆動型の明示列挙〔shiritori2〕、DOM queryを伴わないアプリ内部データ配列index型〔cup_game〕、Strategy A＋Cのハイブリッド〔kyou-no-kiroku〕）も確認された。**本節のStrategy A/B/C分類は典型的なパターンを示す整理であり、全ての実装を排他的に分類するものではない。** 詳細は19.18.3節を参照。

**Strategy C：巨大な明示的CSSセレクタ列挙方式（v1.3で追加）**

候補となりうる要素のclass名を、1つの長大なセレクタ文字列として全て明示的に列挙する方式。Strategy A（`.scannable`等の単一markerクラス）と異なり、対象ごとに個別のclass名を持つ既存要素群を、marker classを新設せずにそのまま束ねて候補とする。

- 長所: 既存要素へ新たなclass・属性を追加せずに済む。要素ごとの意味的なclass名（`.nav-btn`・`.tool-btn`等）を保ったまま候補集合を定義できる。
- 留意点: 新規要素を追加するたびに、このセレクタ文字列へ手動で追記しなければ候補に含まれない（Strategy A同様の「付与漏れ」リスクを、marker追加ではなくセレクタ文字列の保守という形で負う）。セレクタが長大化すると可読性・保守性が低下する。
- 実例: `okane-app.html`の`SCAN_SELECTOR`定数（`.nav-btn, .tool-btn, .diff-btn, .money-card, ...`等、約25クラスを列挙、Phase25-Fで確認）。**（v1.6追記）** register-app（Phase25-P）も同様。

**共通helperとの関係**: 16章で定める共通helperは、候補取得そのものを1方式へ強制しない。Strategy A・B・Cのいずれで収集された候補配列であっても、共通helperのlifecycle（開始・走査・決定・停止）へそのまま渡せる設計とする（16.2節・18.4節参照）。

---

## 4. 候補順

### 4.1 基本方針（R）

1. **R** — 候補の走査順序は、原則としてDOM出現順（`document.querySelectorAll`等が返す順序）とする。
2. **R** — 視覚的な配置順（左上から右下等）とDOM順が一致するよう、HTML構造側で配慮する。DOM順を無視した独自ソートは推奨しない。

### 4.2 例外条件（C）

1. **C**（モーダル／設定パネルが表示中の場合） — モーダル・設定パネル内の候補を、背景画面の候補より優先する。実装上は「モーダル表示中は候補をモーダル内のみに限定する」方式（matching-app・bosai-appで実績あり）と、「モーダル自体が存在しないためこの例外が発生しない」場合（directions-app）がある。
2. **C**（画面遷移直後） — 画面・タブ・パネルが切り替わった直後は、走査位置（インデックス）を先頭へ戻す（4アプリとも実装済み、9章参照）。

---

## 5. 共通chrome

### 5.1 対象

以下は、`generate.js`が全アプリへ共通挿入する固定UI（以下「共通chrome」）である。

- Home（`donomanaHomeBtn`）
- 全画面表示（`donomanaFsBtn`）
- 画面ロック（`donomanaLockBtn`）
- 共通A11yボタン・共通A11yパネル（`donomanaA11yBtn`／`donomanaA11yPanel`）
- 共通A11yパネル内の「このアプリの詳細設定を開く」ボタン（`donomanaSettingsProxy`）

### 5.2 含める理由（R）

**R** — 共通chromeをSwitch Scanの走査候補に含めることを推奨する。

理由:

1. 共通A11yパネルは文字サイズ・ハイコントラスト・読み上げを切り替える主要な導線であり、Switch Scanのみで操作する利用者が**共通アクセシビリティ設定そのものに到達できない**状態は、アクセシビリティ機構として本末転倒である。
2. Home・全画面表示・画面ロックも、Switch Scan利用者が他の手段（マウス・タッチ）を持たない場合に、これらへ到達できないと機能的に詰む（ロック解除不能、全画面から抜けられない等）。
3. Phase18.31-Aの調査時点で、4アプリ中2アプリ（kimochi-board・directions-app）が共通chromeを含める方式、2アプリ（matching-app・bosai-app）が除外する方式であり、拮抗している。除外する2アプリでも、共通A11yボタン自体は通常のTabキー操作や実タッチ操作では到達可能であり、Switch Scan経路が塞がれるのみである。

**（v1.7訂正）** 上記3番の「bosai-appは共通chrome除外」という記述は、Phase18.31-A時点（v1.0初版根拠調査）のスナップショットである。Group B Rollout前調査（Phase25-AB）による直接コード確認および実際のRollout実装（Phase25-AC）により、**bosai-appの現行実装は`.scannable`セレクタ経由で共通chromeを候補へ含んでいる**ことが判明した。これはPhase18.31-A以降（推定: 共通A11yパネル整備の各Phase）に加えられた実装進化であり、仕様書の誤記ではなく古いスナップショットが更新されていなかったことによる差異である。19.19.4節を参照。

### 5.3 未決定（U）

- 共通chromeを含める場合の候補数増加が、既存の走査体験（1周にかかる時間等）へ与える影響。**（v1.7注記）** bosai-app・ongaku-app・nazori-appのGroup B Rollout実績により、共通chromeを含む実装の実例がさらに3件確認されたが（19.19節）、走査体験そのものへの定量的な影響は引き続き未検証のまま残る。
- 共通chromeのうち、どの要素を優先順位の先頭／末尾に配置すべきかの統一基準

---

## 6. ハイライト

### 6.1 共通class（R）

**R** — 走査中の対象を示すCSSクラス名は、`.scan-focus`への統一を推奨する。

理由: directions-appが採用している名称であり、4アプリ中もっとも新しく設計され、意味も明確である（「走査によるフォーカス」であることが名前から読み取れる）。

現状、4アプリで4種類の異なるclass名が使われている（`.scanning`／`.scan-hl`／`.scan-focus`／`.scan-highlight`）。**既存アプリのclass名を`.scan-focus`へ遡って統一することは必須要件（M）とはしない**（13章）。新規アプリ・大規模改修時にのみ適用する（R）。

**（v1.1追記）** v1.1改訂にあたる15アプリ規模の追加サンプリングでは、上記4種に加えて、少なくとも次の実装が確認された：`.scannable`と`.scan-focused`を併用する方式（time-timer）、`.shi`という独自class名＋独自関数体系（`startScan`／`stopScan`／`hlScan`）を用いる方式（sugoroku-app）、専用ハイライトclassを持たずネイティブ`:focus`の見た目のみで走査位置を表現する方式（hiragana-learn・suji-manabou等）。**実装方式の総数を確定的な数値（例:「8方式」）で言い切ることは、21アプリ全件の詳細inventoryを確定するまで行わない。** 重要なのはclass名の統一そのものではなく、8章が定める「単一候補のみハイライト」「stop時完全解除」「状態残留なし」という**挙動契約**である。

### 6.2 CSS責務

- ハイライト対象の視覚表現（アウトライン・背景色・box-shadow・拡大表示等）はCSS側の責務とする。
- 共通アクセシビリティのハイコントラストモードと衝突しないよう、ハイコントラスト時の上書きスタイルを別途用意すること（kimochi-board・directions-appに実装例あり）を**R（推奨）**とする。

### 6.3 JS責務

- ハイライトclassの付与・削除（走査位置の移動）はJS側の責務とする。
- 走査位置が変わるたび、前回ハイライトしていた要素からclassを確実に除去すること（**M**）。除去漏れは、画面遷移後に別画面の要素へ古いハイライトが残留する不具合の原因になる。

### 6.4 禁止事項

1. **M** — 同一の走査対象に、複数の異なるハイライトclassを同時に付与しない。
2. **M** — ハイライトの視覚表現を、`aria-hidden`や`inert`など操作可能性に影響する属性の切り替えによって実現しない（視覚表現とdisabled化を混同しない）。

---

## 7. 決定操作

### 7.1 現状（4アプリ比較）

| アプリ | Space | Enter |
|---|---|---|
| kimochi-board | 決定 | 決定 |
| matching-app | 決定 | 決定（Phase18.31 Pilotで追加。7.2節R3準拠） |
| directions-app | 決定 | 決定 |
| bosai-app | 決定 | 次の候補へ送り（決定ではない。7.3節の既存例外） |

### 7.2 基本要件（M／R）

1. **M** — Spaceキーによる決定操作は、Switch Scan対応済み全アプリで実装する。
2. **M** — 決定操作は、走査中の対象要素に対して`click()`（DOM標準のclickイベント発火）を用いて実現することを原則とする。対象要素固有の内部関数を直接呼び出す実装は推奨しない（`click()`であれば、その要素に紐づく既存のイベントリスナー・アクセシビリティ属性更新処理をすべて経由できるため）。**（v1.3確認）** schedule-appの`scanAction()`／`scanSelect()`は、コード確認の結果`element.click()`ではなく候補要素のデータ処理関数`toggleCheck(id)`を直接呼び出していることを確認した。ただし同アプリの候補要素（`.v-item`）自身のclickリスナーも`toggleCheck(item.id)`のみを呼ぶ実装であり（挙動上の差異は生じない）、7.3節7番の例外として記録する。**新規実装・Rollout対象では引き続きclick()方式を原則（M）とする。**
3. **R** — Enterキーによる決定操作の実装を推奨する。外部スイッチ機器がSpace／Enterのいずれかをキーボードイベントとして送出する場合に備え、可能な限り両方を決定操作として受け付けることが望ましい。

### 7.3 アプリ固有の例外（A／C）

Enterキーへ「決定」以外の機能を割り当てることは、以下の条件を満たす場合に限り、アプリ固有の例外として認める。無条件に「未決定」とはせず、例外の採用条件を明文化する（Phase18.31-Eで確定）。

1. **A**（アプリ固有の明確な理由がある場合） — Enterキーへ「決定」以外の別機能（例: bosai-appの「次の候補へ送り」）を割り当てることを妨げない。
2. **C**（例外を採用する場合） — 例外の採用理由と、既存利用者体験への影響を検証した結果を、当該アプリのPhase報告等に文書化すること。
3. **C**（例外を採用する場合） — 例外は無条件に他アプリへ横展開せず、アプリごとに個別の判断・検証を経て採用すること。
4. matching-appは、Phase18.31のPilot実装によりSpace／Enterの両方を決定操作として実装しており、7.2節R3に準拠する（例外に該当しない）。
5. bosai-appの「Enter＝次の候補へ送り」（7.1節参照）は、本節1〜3の例外条件が整備される以前からの実装であるため、本Phase18.31-Eでは変更しない既存の例外として扱う。理由・検証結果の正式な文書化は後続Phaseで実施する。
6. **U** — 外部スイッチデバイスがブラウザへ送出するキーコードの実機検証（4アプリともキーボードイベントとして受信する前提の実装であり、実機での外部スイッチ検証記録は本調査に含まれない）。
7. **A**（v1.3で追加、click()要件7.2節M2の例外） — schedule-appの決定操作（`scanAction()`／`scanSelect()`）は、`element.click()`ではなく候補要素のデータ処理関数`toggleCheck(id)`を直接呼び出す。確認の結果、候補要素（`.v-item`）自身のclickリスナーも`toggleCheck(item.id)`のみを呼ぶ実装であるため、実際の挙動としてはclick()方式と等価である。ただし将来同要素へ別のclickリスナーが追加された場合、`toggleCheck()`直接呼び出し方式ではそのリスナーを経由しないという構造的リスクが残る（18.9節参照）。既存の稼働中コードとして変更は求めないが、Rollout時にこのパターンを他アプリへ横展開する場合は個別に検証すること。

---

## 8. 停止処理

### 8.1 最低要件（M）

1. **M** — Switch Scanを停止する際、走査タイマー（`setInterval`等）を`clearInterval`で確実に解除する。
2. **M** — 停止時、走査ハイライトclass（6.1節）を全対象から解除する。
3. **M** — 停止時に登録した専用のイベントリスナー（キーボード・タッチ等、Switch Scan専用に追加登録したもの）がある場合は、停止時に解除する。
4. **M** — `clearInterval`でタイマーを解除した後は、そのタイマー参照変数を`null`へ戻す。参照変数が`null`かどうかだけで「現在Switch Scanが動作中か」を判定できる状態を維持するため。
5. **M** — Switch Scanを再開する（開始処理を呼び出す）際は、処理の先頭で必ず停止処理を呼び出し、既存タイマーを確実に停止してから新規タイマーを作成する。ON→OFF→ONのように状態を繰り返し切り替えても、タイマーが二重に起動しないこと（13章4番「重複Timerの禁止」と対応する要件）。

### 8.2 4アプリの現状（参考）

- kimochi-board・matching-app・directions-app: `clearInterval`＋ハイライトclass全解除のみ。専用イベントリスナーの動的な登録／解除は行わず、常時登録されたリスナー内部で状態フラグ（`state.switchScan`等）を判定する方式。
- bosai-app: 上記に加え、`scan.start()`／`scan.stop()`のタイミングでタッチイベントリスナー（`touchstart`／`touchend`）自体を動的に追加・削除する方式。

どちらの方式も8.1節の要件を満たしていれば許容する（**A**：アプリ固有の実装選択）。

---

## 9. モーダル

### 9.1 基本方針

1. **C**（モーダルを持つアプリの場合） — モーダル表示中は、走査候補をモーダル内の要素へ限定する（4章4.2節参照）。
2. **C**（モーダルを持つアプリの場合） — モーダル表示中、背景画面側の走査（ハイライト移動）を停止する。
3. **M** — モーダルが閉じられたら、候補一覧を再構築し、走査位置を先頭へ戻す。

### 9.2 directions-appの扱い

directions-app.htmlは全画面遷移方式（`.screen`/`.screen.active`）のみで構成され、フローティングモーダルを持たない（Phase18.29-Aで確認済み）。この場合、9.1節1〜2の要件は**該当なし**として扱う。**「モーダルが存在しないため変更不要」という判断も、正しい対応として記録する**（`donomana-modal-accessibility-spec-v1_0.md` 19章14番と同じ原則）。

### 9.3 bosai-appの扱い

bosai-app.htmlの設定モーダル（`#settings-modal`）表示中は、Switch Scanのタイマーを`openSettings()`内で一時停止し、`closeSettings()`内で候補を再構築してから再開する実装になっている（Phase18.30-Aで確認済み）。

---

## 10. タッチ

### 10.1 現状（4アプリ比較）

| アプリ | 短押し | 長押し |
|---|---|---|
| kimochi-board | 即決定（`touchstart`時点） | 未対応 |
| matching-app | 500ms未満のタップで決定（`touchend`） | 未対応 |
| directions-app | 専用ハンドラなし（通常タップ扱い） | 未対応 |
| bosai-app | 600ms未満のタップで決定 | 600ms以上の長押しで「次へ送り」 |

### 10.2 方針

1. **R** — タッチデバイスでSwitch Scanを利用する場合、短押し（一定時間未満のタップ）を「決定」として扱うことを推奨する。
2. **U** — 長押しによる「次へ送り」機能（bosai-app方式）を他アプリへ広げるかどうかは未決定とする（7.3節のEnter役割分離と同じ論点であり、あわせて将来判断する）。
3. **U** — 短押し／長押しの閾値（500ms・600ms等）を統一するかどうかは未決定とする。

**（v1.1確認）** 長押し「次へ送り」等のタッチ拡張挙動は、v1.1でもM（最低要件）へは格上げしない。app固有のexperimental/optional機能として扱い、全アプリへの展開可否は本Pilot（17章）とは別Phaseで判断する。

---

## 11. 視線入力

**今回は対象外とする。**

kimochi-board.htmlには、視線入力デバイス（Tobii等）と連動する実装（`state.gazeEnabled`、カードの`focus`/`blur`イベントとの同期、視線入力中は自動走査を抑制する制御）が確認されている。ただし、視線入力を持つのは4アプリ中kimochi-boardのみであり、Switch Scanとの統合方式を一般化するには実証が不足している。

視線入力固有の要件は、`donomana-modal-accessibility-spec-v1_0.md` 21章未決定事項10番でも同様に未決定として扱われている。

**今後Version2で対応予定とする。**

**（v1.1確認）** 本仕様書（Switch Scan単独の共通仕様）と視線入力の共通仕様化は、引き続き別テーマとして扱い、混ぜない。ただし16章の共通helperをkimochi-boardへ将来適用する場合は、同アプリの視線入力連動実装（`state.gazeEnabled`等）を壊さないことを要件とする。視線入力そのものの共通仕様化は、本v1.1の承認範囲に含まない。

---

## 12. ARIA

**Version1では現状維持とする。**

Phase18.31-Aの調査範囲において、4アプリいずれも走査ハイライト対象への`aria-current`・`aria-selected`・`aria-live`等のARIA状態更新は実装されていない（視覚的なCSSクラスの切り替えのみで走査位置を表現している）。

本仕様書では、この現状を変更すべき最低要件（M）とはしない。ARIA状態更新の追加は、スクリーンリーダー利用者とSwitch Scan利用者が重複する場合の要件整理を要するため、**今後追加予定**とし、Version2以降で扱う。

---

## 13. 実装禁止事項

以下は、本仕様書に基づき新規に実装する場合、または既存実装を大幅に改修する場合に避けるべき事項である。**既存の稼働中コードを本項目のみを理由に遡って修正することは求めない**（3.2節のkimochi-board例外を参照）。

1. **静的候補取得の新規採用禁止** — 起動時に1回だけ候補を取得し、以後DOMの変化を反映しない実装を新規に採用しない（3.1節R1）。
2. **複数のハイライトclassの併用禁止** — 1つのアプリ内で、走査ハイライトを表す独自classを複数種類混在させない（6.4節）。
3. **アプリ固有命名の新規追加を避ける** — 新規アプリでは6.1節の`.scan-focus`を用いる。既存4種のclass名（`.scanning`／`.scan-hl`／`.scan-focus`／`.scan-highlight`）以外の第5の名称を新たに追加しない。
4. **重複Timerの禁止** — Switch Scan開始処理を、既存タイマーを停止せずに再度呼び出すことで、`setInterval`が多重に走る状態を作らない（8.1節M1と対の禁止事項）。

---

## 14. 横展開手順

どのまな全体（30アプリ以上）への適用は、以下の順序で段階的に行う。一括適用は禁止する（`donomana-modal-accessibility-spec-v1_0.md` 19章1番と同じ原則）。

```
Pilot
  ↓
Review
  ↓
Rollout
  ↓
Verification
```

1. **Pilot** — 本文書の未決定事項（7.3節・10.2節・11章等）のうち1つを選び、1〜2アプリで試験実装する。
2. **Review** — Pilot結果をコードレビュー・実測検証し、共通要件（M/R/C/U）へ格上げできるかを判断する。本文書の改訂として記録する。
3. **Rollout** — Reviewで確定した要件を、対象アプリへ順次適用する。1Phaseで一度にすべてのアプリへ適用しない。
4. **Verification** — 適用後、既存機能回帰・Console Error・pageerrorがないことを実測確認し、commit・merge・push後の公開版で再検証する。

---

## 15. 将来拡張

Version2以降で検討する拡張候補を列挙する。優先順位・実装方式は本文書では確定しない。

- **視線入力**（11章参照）— kimochi-board方式の一般化、Switch Scanとの排他制御の共通化
- **Switch Interface** — 市販のスイッチインターフェース機器（USB/Bluetooth経由でキーボードイベントを送出する機器）固有の挙動調査
- **Bluetooth Switch** — Bluetooth接続スイッチの接続断・遅延等、有線スイッチと異なる特性への対応
- **Scanning Group（グループ走査）** — 候補が多い画面で、行→列のような2段階走査を行う方式（4アプリとも現状は単純な線形走査のみ）
- **Auto Scan / Manual Scan** — 自動タイマー走査（現状の4アプリの方式）と、手動で次候補へ送るステップ走査（1スイッチ＝次へ、2スイッチ＝決定 等）の切り替え

---

## 16. 共通helper設計原則（v1.1で追加、v1.2でAPI確定）

### 16.1 目的

本章は、共通helperが担うべき責務の範囲を定める。v1.1時点では概念のみだったが、**v1.2はdirections-app（第1Pilot）・matching-app（第2Pilot）の2つの実装を比較した事実に基づき、helper APIの形・adapterとの境界・命名規則を確定する**（17章参照）。

### 16.2 共通化する責務

共通helperが担うことを想定する責務は、以下に限定する。

1. **lifecycle** — Switch Scanの開始・停止・再開始という状態遷移の管理
2. **timer** — 走査タイマー（`setInterval`）の生成・保持・解除
3. **current index** — 現在ハイライト中の候補位置の管理
4. **highlight** — ハイライトclassの付与・削除（class名自体はapp側で指定可能とする、6.1節参照）
5. **activation** — 決定操作（`click()`発火、7.2節M2）
6. **stop** — 停止処理一式（8.1節M1〜M5）
7. **cleanup** — 専用イベントリスナーの解除
8. **refresh** — 画面遷移・モーダル開閉時の候補再構築・走査位置リセット（4.2節C2・9.1節M3）

### 16.3 共通化しない・app側へ委ねる責務（adapter）

**候補取得（candidate生成）そのものは、共通helperが単一方式へ強制しない。** 3.3節で認めるStrategy A（明示marker方式）・Strategy B（ネイティブ包括取得方式）のいずれも、共通helperへ「候補を返すcallback関数（adapter）」として渡せる設計とする。

adapter側（アプリ固有）に残る責務は、以下の通り確定する（v1.2）。

1. **候補取得ロジック本体** — `.scannable`等の明示marker方式か、ネイティブ操作可能要素の包括取得か（3.3節）
2. **モーダル判定** — 表示中モーダルの検出、モーダル内候補への限定（9章）。matching-app Pilotでは候補取得関数がモーダル判定を内包する設計だった（16.6節2番）
3. **screen判定** — 複数画面（`.screen`等）構成アプリでの現在画面の特定。directions-app Pilotでは候補取得関数が`activeScreen`引数を要求する設計だった（16.6節1番）
4. **候補フィルタの細部** — 可視性・操作可能性の基本条件（`disabled`・`hidden`・`aria-hidden`・`visibility:hidden`等）は両Pilotでほぼ同一の実装だったため共通化候補だが（16.9節）、app固有の除外条件（例: 既にマッチ済みのカードを除外する`:not(.matched)`等）が混在する場合はadapter側に残す
5. **特殊入力** — タッチ短押し決定（matching-appにあり、directions-appにはない）、長押し「次へ送り」（bosai-app、10章）等
6. **視線入力** — 11章、本仕様書の対象外のまま

### 16.4 generate.jsとの関係

共通chromeへの`.scannable`／`data-scan="1"`付与は、既にgenerate.js側の共通処理として存在する（5章）。共通helper自体の配置（generate.jsが各アプリへ注入するJSブロックとするか、独立した共通スクリプトとするか）は、**第3Pilot以降の結果を踏まえて判断する。v1.2でも配置方式は確定しない（U、17.5節参照）**。

### 16.5 helper API（v1.2で確定）

directions-app・matching-appの2 Pilotとも、以下6関数を**同一の関数名**で実装できることを実証した（17章）。v1.2はこれを共通helperの正式なAPI名として確定する。

| 関数 | 引数 | 戻り値 | 役割 |
|---|---|---|---|
| `buildScanItems` | adapter依存（0〜1個。directions-appは`activeScreen`必須、matching-appは無引数） | `Element[]` | 候補取得（adapter責務、16.3節） |
| `startSwitchScan` | なし | なし | 開始（停止→候補取得→初期ハイライト→timer開始） |
| `stopSwitchScan` | なし | なし | 停止（timer解除・参照null化・ハイライト解除） |
| `refreshSwitchScanItems` | なし | 実装依存（directions-appは`Element[]`を返す、matching-appは返さずindexリセットのみ行う） | 画面/モーダル切替時の再構築 |
| `activateCurrentScanItem` | なし | なし | 決定操作（`click()`発火） |
| `clearScanHighlight` | なし | なし | ハイライト全解除 |

**v1.2時点でこれらは「両Pilotで実証済みの命名」であり、まだ「1つの共通関数を全アプリで使い回す」段階ではない。** 各アプリが自身のHTML内にこの6関数を実装し、既存の呼び出し箇所（app固有のUIハンドラ）は変更しない、という Pilotのパターンを正式な命名規則として採用する（16.7節）。

### 16.6 Pilot比較で判明した実装フォーク（v1.2で新規記録）

2つのPilotを比較した結果、挙動としては両立するが実装方針が異なる3つの分岐点が判明した。**いずれも既存Pilotのコード変更を要求しない。** 将来、真に1つの共通関数（例えば`generate.js`が注入する単一実装）へ統合する場合の設計判断として記録する。

1. **候補取得のシグネチャ** — directions-appの`buildScanItems(activeScreen)`は画面要素を引数に取る「screenベース」設計。matching-appの`buildScanItems()`は無引数で、関数内部でモーダル表示中かどうかを自己判定する「自己完結型」設計。**U（未決定）**——どちらを共通helperの標準シグネチャとするかは、第3Pilotでモーダル・画面切替の両方を持つアプリ（例: kimochi-board）を検証してから判断する。
2. **候補再取得のタイミング** — directions-appは`startSwitchScan`実行時に候補配列を1回だけ取得し、`setInterval`のクロージャで使い回す「snapshot方式」。matching-appは`setInterval`のtickごとに`buildScanItems()`を再実行する「perTick方式」。**両方とも仕様のM/R要件（3.1節R1「毎回動的に再取得」）を満たす**——snapshot方式は`startSwitchScan`が呼ばれるたび（screen遷移等のフックで）再取得するため実質的に動的であり、perTick方式はより高頻度に動的である。**共通helperはこの2方式を`refreshMode`のようなoption（16.7節）で選択可能にすることを推奨する（R）。単一方式へ強制しない。**
3. **activateの実装方式** — directions-appの`activateCurrentScanItem`は`document.querySelector(ハイライトclass)`でDOM上の現在ハイライト要素を直接取得してclickする。matching-appの`activateCurrentScanItem`は`buildScanItems()`で候補配列を再取得し、`candidates[scanIdx]`で現在位置の要素を導出してclickする。両者は正常時は同じ要素を指すが、依存関係が異なる（前者はハイライトclassとの同期に依存、後者は候補配列とindexの同期に依存）。**共通helperの標準実装はStrategy 1（ハイライトclassをDOMクエリで直接取得）を採用することを推奨する（R）**——adapterの`buildScanItems`を追加で呼び出す必要がなく、呼び出しコストが低く、候補配列の再計算中に生じうる意図しないindexズレのリスクを避けられるため。**directions-app・matching-appとも、それぞれの既存実装のままで良い（Mではなく将来のRollout時の標準に留める）。**
4. **開始時のenabled自己チェック** — directions-appの`startSwitchScan`は自身で有効/無効設定を確認し、無効なら早期returnする「自己防御型」。matching-appの`startSwitchScan`は有効/無効判定を持たず、呼び出し元（`enableScan`等）が判定してから呼ぶ「呼び出し元責任型」。**共通helperは自己防御型（directions-app方式）を標準とすることを推奨する（R）**——呼び出し元の実装漏れによる誤動作のリスクを減らせるため。既存2 Pilotのコード変更は要求しない。

### 16.7 命名規則（v1.2で確定）

- **helper関数名**: 16.5節の6関数名をそのまま正式名称とする（`build`/`start`/`stop`/`refresh`/`activate`/`clear`の動詞＋対象語のcamelCase）
- **adapter**: `getCandidates`・`isEnabled`・`intervalMs`等、`get`/`is`等の接頭辞＋名詞のcamelCase。app固有ロジックを外から差し込むための関数として位置づける
- **option**: `refreshMode`・`highlightClass`等、名詞のcamelCase。挙動を選択的に切り替えるための設定値（16.6節のフォークはoptionとして表現する）
- **callback**: `onActivate`等、`on`接頭辞＋動詞のcamelCase。app固有の副作用（効果音・アニメーション等）をhelperの標準処理の前後に差し込む用途を想定する（v1.2時点では概念のみ、実装は次Pilot以降）
- **state**: 走査タイマー・現在indexは、将来的にhelper内部（クロージャまたはhelperが返すオブジェクト）へカプセル化することを目標とする。**ただしPilotの互換エイリアス方式（旧関数名を維持しつつ新関数へ委譲）は、既存のapp側グローバル変数（directions-appの`state.scanTimer`/`state.scanIndex`、matching-appの`scanIv`/`scanIdx`）を保持したままでも機能することを2 Pilotで実証済み。**stateのカプセル化はRollout以降の課題とし、v1.2では必須要件化しない（U）

### 16.8 昇格評価（共通helperへの昇格可否、v1.2で確定）

| 責務 | 昇格可否 | 根拠 |
|---|---|---|
| `stopSwitchScan` | **昇格可能** | 2 Pilotの実装がほぼ同一（`clearInterval`+`null`化+ハイライト解除）。ガード条件（`if(timer)`）の有無のみ差異があるが、`clearInterval(null)`は安全なため実害なし |
| `clearScanHighlight` | **昇格可能** | 2 Pilotとも「ハイライトclassを全要素から`querySelectorAll`+`classList.remove`」で完全同一 |
| `activateCurrentScanItem` | **昇格可能（ただし実装方式の統一が必要）** | 16.6節3番の通り、DOM query方式（推奨）とcandidates配列方式の2種が存在。将来の昇格時はDOM query方式を標準とする |
| timer管理（`setInterval`/`clearInterval`のラップ） | **昇格可能** | `stopSwitchScan`/`startSwitchScan`の一部として昇格可能 |
| index管理（`scanIndex`/`scanIdx`相当） | **昇格可能（ただし呼称の統一が必要）** | 将来的にhelper内部state化する際に、両アプリのvar名の違いを吸収する薄いラッパーが必要 |
| `buildScanItems`（候補取得） | **昇格不可** | 16.3節の通りadapter必須。screenベース設計と自己完結型設計の2つが存在し、単一実装への統合は時期尚早（16.6節1番） |

---

## 17. Pilot方針・実施結果（v1.1で追加、v1.2で結果反映）

### 17.1 Pilot順序と実施結果

1. **第1Pilot: `directions-app.html`** — **実施済み・完了**（Phase25-C実装、Phase25-C2で公開統合済み）
2. **第2Pilot: `matching-app.html`** — **実施済み・完了**（Phase25-D実装、Phase25-E2で公開統合済み）
3. **第3Pilot: `schedule-app.html`** — **実施済み・完了**（Phase25-F選定・Phase25-G実装、Phase25-G2で公開統合済み。詳細な比較Reviewは18章を参照）

3 Pilotとも、16.5節の6関数（`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`）への責務分離、既存呼び出し箇所を変更しない互換エイリアス方式、候補配列の実ブラウザ比較によるリファクタリング前後の完全一致確認、という同一の手法で実装できることを確認した。

### 17.2 directions-appを第1候補とした理由（実績）

- 既に仕様推奨のハイライトclass`.scan-focus`を採用済みであり、命名変更のコストが不要だった
- フローティングモーダルを持たない（9.2節）ため、9章のモーダル要件を考慮せずに共通helperのコア機能（候補取得・走査・ハイライト・決定・停止・refresh）の検証に集中できた
- 実施の結果、候補取得はStrategy A（明示marker方式）であることが判明——Pilot開始前の分類（Strategy Bと想定）に誤りがあったが、候補取得ロジック自体を変更しない方針だったため実装への影響はなかった（Phase25-C報告参照）

### 17.3 matching-appを第2候補とした理由（実績）

- Space／Enter両方の決定操作に対応済み（7.2節R3準拠）
- `.scannable`（Strategy A）の実利用実績があり、共通chrome統合の検証に適していた
- モーダル表示中の候補制御（9章）の実装例として、候補取得関数がモーダル判定を内包する高度な設計であることを確認した（16.3節2番）

### 17.4 Pilotで検証した内容（実績）

- **第1Pilot（directions-app）**: candidate取得・timer・highlight・Space/Enter決定・`click()`発火・refresh・stop処理という、共通helperのコア機能を検証した
- **第2Pilot（matching-app）**: モーダル対応・common chrome統合・`.scannable`（Strategy A）・候補のモーダル内限定・背景走査停止・モーダルclose後のrefreshを検証した

### 17.5 第3Pilot方針（v1.2で追加、v1.3で実施結果を反映）

2 Pilotの比較により、16.6節の3つの実装フォーク（候補取得シグネチャ・候補再取得タイミング・activate実装方式）が判明していた。**第3Pilotとしてschedule-appを選定し（Phase25-F）、実装・検証・統合まで完了した（Phase25-G/G2）。** 選定理由・検証結果・仕様への反映内容は18章「3 Pilot総括Review」を参照。

---

## 18. 3 Pilot総括Review（v1.3で追加）

### 18.1 目的

本章は、directions-app（第1Pilot）・matching-app（第2Pilot）・schedule-app（第3Pilot）という3つの構造的に異なる実装を比較し、v1.2までの仕様が3 Pilotすべてで成立することを確認した上で、v1.2時点でU（未決定）としていた項目に実装事実に基づく結論を与える。**本章の内容は3 Pilotの実装事実に基づくものであり、いずれのPilotのコードへも変更を要求しない。**

### 18.2 3 Pilot比較表

| 観点 | directions-app（第1） | matching-app（第2） | schedule-app（第3） |
|---|---|---|---|
| highlightClass | `.scan-focus` | `.scan-focus` | `.scan-focus` |
| candidate Strategy | A（明示marker、`activeScreen`引数必須） | A（明示marker、無引数・自己完結） | A変種（`.v-item`単純classセレクタ、common chrome非対象） |
| scopeモデル | screen（`.screen.active`） | modal（3種のoverlay判定を内包） | tab（`activeTab==='viewer'`） |
| refreshMode | snapshot（開始時1回取得、以後使い回し） | perTick（`setInterval`毎回`buildScanItems()`再実行） | 1switch: decision時にtimer再起動を伴う型／2switch: timerなし・手動advance |
| timer | `setInterval` | `setInterval` | `setInterval`（1switchのみ、2switchはtimerなし） |
| state | `state.scanTimer`/`state.scanIndex`（オブジェクトプロパティ） | `scanIv`/`scanIdx`（bareグローバル変数） | `scanTimer`/`scanIdx`（bareグローバル変数） |
| activate実装 | `document.querySelector(highlightClass)`をDOM直接クエリ | `candidates[scanIdx]`で候補配列から導出 | `toggleCheck(id)`という**データ処理関数を直接呼び出し**（7.3節7番の例外） |
| Space | M要件通り対応 | M要件通り対応 | 1switchのみ対応（2switchはSpaceがselect専用） |
| Enter | R要件通り対応 | R要件通り対応（7.2節R3準拠） | 1switchはSpaceと同じ決定操作、2switchはselect専用 |
| 特殊入力 | なし | タッチ短押し（500ms未満） | scan-touch-btn（タップ）、2switchのArrowRight/Tab（advance専用キー） |
| modal | なし | あり（候補をmodal内へ限定） | なし（scanとmodalは無関係に動作） |
| common chrome | 候補に含む | 候補に含む | **候補から除外**（`.v-item`のみ） |
| 視線入力 | なし | なし | なし |
| Focus Trapとの関係 | 該当なし | scanMode中はFocus Trap無効化 | 確認範囲内では無関係（別モーダル用） |

### 18.3 6関数構造の維持可否

v1.2で定めた6関数（`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`）は、**3つの構造的に異なるPilotすべてで責務分離が成立することを確認した。** 追加・削除すべき責務は見つからなかった。**v1.3でもこの6関数構造を正式に維持する。**

### 18.4 buildScanItemsの契約（v1.3で確定）

3 Pilotで確認した実装差:

- directions-app: `buildScanItems(activeScreen)` — screen要素を引数に取る
- matching-app: `buildScanItems()` — 無引数、内部でモーダル表示中かどうかを自己判定
- schedule-app: `buildScanItems()` — 無引数、`.v-item`という単一classセレクタ（3.3節で訂正済み）

**結論**: `buildScanItems`の内部実装（引数の有無・スコープ判定方法・セレクタ方式）はapp adapterの責務とし、単一シグネチャへ強制統一しない。共通helperが要求する契約は「呼び出すと、現在走査可能なDOM要素の配列（またはNodeList）を返す」という**戻り値の形**のみとする。

### 18.5 candidate Strategy再整理

3.3節の通り、v1.3時点でStrategy A（明示marker方式）・Strategy B（ネイティブ包括取得方式）・Strategy C（巨大な明示的CSSセレクタ列挙方式、v1.3で追加）の3方式を正式に認める。**Strategy Bの実例として3 Pilot内には該当するものがないことが判明した**（schedule-appの分類誤りを3.3節で訂正済み）。Strategy Bは4アプリ調査（Phase18.31-A）時点の分類として仕様上維持するが、3 Pilotでの実証はない。

### 18.6 refreshModeの整理（v1.3で確定）

v1.2は`snapshot`／`perTick`の2値を想定していたが、schedule-appの実装には第3のパターンが存在することを確認した。

- **snapshot**: `startSwitchScan`実行時に1回だけ候補を取得し、`setInterval`のクロージャで使い回す（directions-app）
- **perTick**: `setInterval`のtickごとに候補を再取得する（matching-app）
- **restartOnActivate**（v1.3で新規命名）: 決定操作（`activateCurrentScanItem`）のたびにタイマーを`clearInterval`→再度`setInterval`し、走査サイクルを先頭から再開する（schedule-appの1switchモード）。2switchモードはそもそもtimerを使わない手動advance方式であり、refreshModeの対象外（18.7節参照）。

**結論**: `refreshMode`はhelper optionとして持つ（16.7節の既存方針を維持）。ただし選択肢を`snapshot`／`perTick`／`restartOnActivate`の3値へ拡張する。3値のいずれも、既存3 Pilotのコード変更なしにこの分類へ当てはめられることを確認済み。

### 18.7 switchModeの整理（v1.3で確定）

schedule-appの`off`／`1switch`／`2switch`という3値stateは、他2 Pilot（directions-app・matching-appとも単純なon/offの2値）には存在しない。

**結論**: `switchMode`（3値以上のenum）を共通helperの必須stateとはしない。**app adapter側のoptionとして扱う。** 2値（on/off）で十分なアプリへ3値modeを強制しない。helperのコア（lifecycle/timer/highlight/activation/stop/cleanup/refresh）は、on/off前提でもswitchMode前提でも同じ6関数で表現できることを3 Pilotで確認した。

### 18.8 activate責務の整理

directions-app・matching-appは「現在候補への`click()`」という共通した実装だが、schedule-appは1switch/2switchでactivationの流れが異なり、かつ`click()`ではなくデータ処理関数を直接呼ぶ（18.9節参照）。

**結論**: `activateCurrentScanItem()`の共通責務を「現在候補の決定処理を開始する」という**結果ベースの定義**へ抽象化する。実装手段（`click()`かデータ関数直接呼び出しか）はadapter側の裁量とするが、**新規実装・Rollout対象では7.2節M2（click()発火）を引き続き原則（M）とする。** schedule-appは既存の稼働中コードとして7.3節7番の例外に位置づける。

### 18.9 click()要件との整合（コード確認済み、推測なし）

schedule-appの`scanAction()`／`scanSelect()`はコード確認の結果、`element.click()`ではなく`toggleCheck(id)`という候補要素のデータ処理関数を直接呼び出している。一方、候補要素（`.v-item`）自身のclickリスナーも`el.addEventListener('click',function(){toggleCheck(item.id);})`という実装であり、`toggleCheck(item.id)`のみを呼ぶ。**したがって現時点では、`toggleCheck()`直接呼び出しとclick()発火は挙動として等価である。** ただし将来同要素へ別のclickリスナーが追加された場合、直接呼び出し方式ではそのリスナーを経由しないという構造的リスクが残る。この事実は7.2節M2・7.3節7番へ反映済み。**M2要件自体は矛盾しない**（新規実装の原則として維持し、schedule-appは個別の既存例外として扱う）。

### 18.10 callback設計（v1.3で確定）

3 Pilotの比較から、以下のcallback候補が必要と判断する。

- `onActivate`: 決定操作時に呼ばれる（3 Pilotとも該当、directions-app/matching-appは`click()`、schedule-appはモードに応じた分岐）
- `onAdvance`: 走査位置の前進のみを行う（schedule-appの2switch ArrowRight/Tab、他アプリのtimer自動送りにも内部的に相当）
- `onSelect`: 前進を伴わない決定のみ（schedule-appの2switch Space/Enter）

directions-app・matching-appは`onAdvance`と`onSelect`を区別する必要がなく、`onActivate`のみで表現できる（1スイッチ型の統合パターン）。schedule-appの2switchのみ両者の分離が必要（18.11節）。

### 18.11 advance/select設計（v1.3で確定）

**原則**:
- 単スイッチ型（timer自動送り＋1つの決定キーで完結するアプリ）: advanceとselectをadapter内部で統合してよい（`onActivate`のみで足りる）
- 2スイッチ型（advance用キーとselect用キーが別々に存在するアプリ）: `onAdvance`／`onSelect`を別callbackとして持てる設計をhelperが許容する

**この設計はschedule-app固有のパターンとして記録するに留め、1スイッチ型の既存2 Pilot（directions-app・matching-app）へ advance/select分離を強制しない。**

### 18.12 state方針（v1.3で確定）

3 Pilotとも、既存のapp側グローバルstate（オブジェクトプロパティ型・bare変数型のいずれも）を維持したまま6関数構造への責務分離に成功した。**v1.3でもstateの共通helper内部へのカプセル化は必須化しない。** 将来、共通helper本体（generate.js注入等）を実装する段階での課題として引き続き残す（16.7節の既存方針を維持）。

### 18.13 highlightClass方針（v1.3で確定）

3 Pilotとも`.scan-focus`で成功した。ただし6.1節記載の通り、他アプリには`.scan-highlight`／`.scanning`／`.scan-focused`／`.shi`／ネイティブfocus依存等が存在する。**`.scan-focus`を新規実装の推奨（R）として維持するが、横展開時の既存アプリrenameは引き続き必須としない。** `highlightClass`をhelper optionとして正式化する（値はapp側が指定、既定値`.scan-focus`）。

### 18.14 common chrome方針（v1.3で確定）

directions-app・matching-appは候補にcommon chromeを含める、schedule-appは除外する——**両パターンが3 Pilotで実証された。** 5.2節の「共通chromeを走査候補に含めることを推奨する（R）」という方針自体は維持するが、**app特性に応じてadapter／optionとして除外を選択できることを明記する。** schedule-appの除外は、共通chrome（Home/Lock/A11y）がviewerタブの外にも常時表示される固定要素であり、1周の走査時間を長くしないための意図的な設計と考えられる（5.3節の未決定事項「1周の所要時間への影響」の実例）。

### 18.15 scopeモデルの明記

3 Pilotで screen（directions-app）・modal（matching-app）・tab（schedule-app）という3つの異なるscopeモデルを確認した。**共通helperは特定のscopeモデルへ依存しない。** scope判定はadapter（`buildScanItems`）の責務であり、helperのコア（lifecycle/timer/highlight/activation/stop/cleanup/refresh）はどのscopeモデルの上でも同じ6関数で動作することを3 Pilotで確認した。

### 18.16 特殊入力の扱い

matching-appのタッチ短押し、schedule-appのscan-touch-btn／ArrowRight／Tabは、いずれもhelperのM要件へ一括統合せず、**adapter／callback責務とする。** directions-appのようにSpace/Enter中心のシンプルな構成のアプリに、不要な特殊入力対応を強制しない。

### 18.17 視線入力との分離（v1.2方針を再確認）

3 Pilotのいずれにも視線入力連動は存在しない。v1.2の方針（Switch Scan共通helperと視線入力共通仕様は別テーマ）を維持する。kimochi-boardのような視線連動アプリへ将来共通helperを適用する場合は、既存gaze連携を壊さないことを要件とする。**第4Pilot候補としてkimochi-boardを今すぐ指定する必要はない**（18.19節参照）。

### 18.18 generate.js配置方式の評価

3 Pilotの結果を踏まえ、以下の3方式を比較する。

- **A. generate.jsからhelper blockを注入**: 5章の共通chrome注入と同じパターン。29アプリへの一括適用時に保守性が高いが、注入後のapp固有カスタマイズ（18.6〜18.11節の各種option/callback）をどう受け渡すかの設計が必要
- **B. 独立共通JS**: `<script src>`で読み込む方式。ロードマップ1章が指摘する「共通JSファイルが実質0件」という現状から離れるが、キャッシュ効率は良い
- **C. 各アプリ内へ段階的に同型helperを保持**（3 Pilotで採用した方式）: 保守コストは各アプリ個別だが、adapter差異が大きい現状（18.2節参照）には最も適合する

**結論**: 3 PilotはいずれもC方式（アプリ内保持）で実装された。A/B方式（generate.js注入・独立JS）は、adapter側の差異（18.4節・18.6節・18.7節等）を吸収する設計がまだ確定していないため、**本v1.3ではまだ最終決定しない。** ただし3 Pilotの実装により、A/B方式へ移行する際に必要なadapter/option/callbackの輪郭（18.4〜18.13節）は明確になった。**「配置方式を決定できる段階」には近づいているが、到達したとは言えない**（18.20節参照）。

### 18.19 第4Pilot必要性の評価

3 Pilotで6関数構造・scopeモデル3種・refreshMode3種・switchMode（adapter option）・click()要件の例外パターンが確認でき、**v1.2〜v1.3のU項目の大半に実装事実の裏付けが得られた。** 現時点で新たに検証すべき明確な未知パターンは以下の通り:

- 視線入力との共存（kimochi-board） — 11章が意図的に対象外としている領域であり、Switch Scan helperのRollout可否とは別に検証すべきテーマ
- Strategy C（巨大セレクタ列挙、okane-app）の実装への適用 — 3.3節で仕様上は追加したが、Pilotでの実証はまだない
- 動的listener着脱（8.1節M3の「専用リスナー解除」の実例、okane-app） — 3 Pilotはいずれも常時登録型のリスナーであり、動的add/remove型は未検証

**結論**: 第4Pilotは「増やすこと自体を目的にせず」、上記いずれかを明確な検証目的として設定する場合にのみ実施する。**本v1.3では第4Pilot対象を確定しない。**

### 18.20 21アプリinventoryの実施時期

以下のいずれかに分類する。

**「配置方式決定前に必要」**——理由: 18.18節の通り、generate.js注入／独立JS方式（A/B）へ進むかどうかを判断するには、3 Pilot以外の残り18アプリ（21アプリ中3件がPilot済み）が持つadapter差異の全体像（scopeモデル・refreshMode・switchMode相当・特殊入力）を把握する必要がある。ただし**全件の詳細実装比較までは不要**であり、Phase25-Fで実施したような軽量サンプリング（highlight class・candidate方式・timer方式程度の棚卸し）で足りる可能性が高い。「今すぐ全件詳細監査」でも「Rollout直前まで先送り」でもなく、**配置方式（18.18節）を決定する直前の軽量調査Phase**として位置づける。

---

## 19. 配置方式正式決定（v1.4で追加）

### 19.1 目的

本章は、18章「3 Pilot総括Review」で未確定のまま残していた共通helperの配置方式（16.4節・16.18節）を、第4Pilot（okane-app、Phase25-J）と21アプリ全対象の軽量inventory（Phase25-I）の結果に基づき正式決定する。**本章の決定はコード変更を一切伴わない設計判断であり、既存4 Pilotのコードへ変更を要求しない。**

### 19.2 判断材料の要約

- **4 Pilot（directions-app・matching-app・schedule-app・okane-app）** — Strategy A・C、scope screen/modal/tab/global、refreshMode snapshot/perTick/restartOnActivate、activation click()/内部関数直接呼び出し/advance-select分離、common chrome含有/除外、state object/bare global、常時listener/動的listenerを実証
- **21アプリinventory（Phase25-I）** — 自動走査型21件（apps-data.json上の旧21件表記とは3件構成が異なる、1.5節・18章参照）、common chrome含有11件:除外10件、highlightClass 9パターン（`.scan-focus`10件／`.scan-highlight`3件／`.scanning`2件／`.scan-focused`・`.shi`・`.scfoc`・`.scan-lit`各1件／native focus 2件）、Strategy B実例0件（**v1.5訂正**: Group A Rollout第1波〔katakana-app、Phase25-M〕の直接コード確認により誤りと判明。katakana-appはStrategy Bの実例である。19.17.1節参照）、Strategy C 1件（okane-app、Pilot済み）、視線入力密結合1件（kimochi-board）、setTimeoutチェーン1件（bosai-app）

### 19.3 正式採用方式

**方式C（各アプリHTML内へ同型helperを保持し、本仕様書の6関数構造・命名規則・M/R要件に沿って個別に整理する）を正式採用する。** 方式A（generate.js注入）・方式B（独立共通JSファイル）は、本v1.4時点では採用しない。

### 19.4 採用理由

1. 4 PilotすべてがC方式で実装され、既存挙動100%維持・Console Error 0・pageerror 0・SHA256一致という結果を4回連続で達成した、**唯一実証済みの方式**である
2. inventoryが示すadapter多様性（common chrome含有/除外がほぼ半々、highlightClass 9パターン、Strategy A/C混在、state 3方式、listener 2方式）は、A/B方式が前提とする「差異を吸収するoptions/callback供給機構」がまだ設計されていない現時点では、無理に統一しようとするとPilotの安全性を損なうリスクが高い
3. 1アプリずつ安全に段階導入・Rollbackできる（問題が起きても該当アプリのみに影響が閉じる）
4. 視線入力（kimochi-board）を無理に一般化せず独立させたまま扱える

### 19.5 「共通化しない」という意味ではない

C方式の採用は、**コードファイルを物理的に共有しないことを選んだだけであり、仕様・構造・契約の共通化は継続する。**

**共通化するもの**:
- 6関数の名称（`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`）
- 各関数の責務（16.2節・18.3節）
- API契約（`buildScanItems`は「現在走査可能なDOM要素配列を返す」、18.4節）
- M/R要件（Space必須、click()原則、停止処理の5要件等）
- `highlightClass`option・`refreshMode`option（snapshot/perTick/restartOnActivate、18.6節・18.13節）
- callback概念（`onActivate`/`onAdvance`/`onSelect`、18.10節）
- Pilot実施→検証→統合・公開確定という手順そのもの

**アプリ側に残すもの**:
- `buildScanItems`の内部実装（Strategy A/B/C、引数の有無）
- scope判定（screen/modal/tab/global）
- 特殊入力（タッチ短押し・ArrowRight/Tab等）
- state（object property型／bare global型）
- モーダル条件・候補限定ロジック
- 視線入力連携
- app固有のactivateCurrentScanItem内部分岐（advance/select等）

### 19.6 適用期間

**「当面（Version2.0公開時点〜残り17アプリのRollout完了まで）」の方式として採用する。Version2.x以降の恒久標準として即座に固定はしない。** Rolloutの進捗と19.7節の移行判断基準に基づき、将来のPhaseで方式A/Bへの移行を再評価する。

### 19.7 将来A/B方式への移行条件

以下をすべて満たした場合に、方式A（generate.js注入）または方式B（独立共通JS）への移行を再検討する。

1. Rollout完了アプリ数が過半（11件以上）に達し、adapter差異のパターンが有限個へ収斂していること
2. highlightClassの`.scan-focus`への統一（6.1節R、必須ではない）が実質的に一定数のアプリで進んでいること
3. 動的listener（M3要件）・視線入力連携・setTimeoutチェーンという特殊パターンの扱い方針が明文化されていること
4. 方式A／Bにおけるoptions/callbackの安全な注入・配信の具体的な実装設計が別途完了していること

### 19.8 Rollout単位

一括での大量アプリ変更は禁止する。以下の3段階を推奨する。

1. **1〜2アプリ（構造検証）** — 19.10節の第1候補
2. **同系統3〜5アプリ（グループ単位）** — 19.9節のGroup単位
3. **残り**

各アプリは、既存4 Pilotと同じ「Pilot実装→統合・公開確定」の2段階サイクルを踏襲する。

### 19.9 Rollout分類（Group A〜D）

Pilot済み4アプリ（directions-app・matching-app・schedule-app・okane-app）を除く、残り17アプリを以下へ分類する。

- **Group A（低リスク、`.scan-focus`使用でPilotに構造が近い、7件）**: katakana-app（**v1.5注記**: Group A Rollout第1波〔Phase25-M〕の実装確認により、実際のhighlightは`.scan-focus`ではなくnative focus方式であることが判明した。19.17.2節参照）・janken-app・shiritori2・register-app・timetable-app・cup_game・kyou-no-kiroku
- **Group B（highlightClass違い、6件）**: nazori-app・bosai-app（`.scan-highlight`）、ongaku-app（`.scanning`）、time-timer（`.scan-focused`）、sugoroku-app（`.shi`）、yomikaki-app（`.scfoc`）
- **Group C（scope/特殊事情、2件）**: kimochi-board（視線入力密結合）、gaze-keyboard（複数グループ結合+modal内包）
- **Group D（native focus・timer方式が異なる、2件）**: hiragana-learn・suji-manabou

Group B中、bosai-appはsetTimeoutチェーン・advance/select分離という追加の固有事情を持つため、Rollout時はGroup Bの他アプリより慎重な個別検証を要する（19.12節）。

**（v1.5追記）** 本節の分類はPhase25-I軽量inventoryに基づく**一次スクリーニング**であり、個々のアプリの実装詳細（Strategy・highlightClass等）を保証するものではない。katakana-appの事例が示す通り、Rollout Pilot実装の着手前には必ず直接コード確認を行うこと（19.17.4節参照）。

**（v1.6追記）** Group A（7アプリ）のRolloutが全件完了した（Phase25-M〜X）。完了実績・Strategy分類実績・common chrome実績等は19.18節に記録する。

**（v1.7追記）** Group B（6アプリ）のRolloutも全件完了した。「highlightClass違い」という分類名はGroup B内部の実装多様性（object state・1/2スイッチ・Tab第3入力経路・fake event・優先度付き状態機械・動的once clickリスナー等）を十分に表していなかったことが判明したが、Rollout単位としての区分自体は妥当だったため、Group名・グルーピングそのものは変更しない（19.17.3節と同じ扱い）。完了実績・分類再評価・利用者向け既存不具合の修正実績等は19.19節に記録する。

### 19.10 最初のRollout候補

**Group Aから、`katakana-app`を第1候補として提案する。** 選定基準: `.scan-focus`使用でdirections-app/matching-appに構造が近い、リスクが低い、共通helper構造（6関数）の「5件目」としての再現性確認に適する。第2候補は`register-app`または`cup_game`。**本v1.4は候補の提案に留め、具体的な実施は別Phaseで判断する。**

### 19.11 kimochi-board・gaze-keyboardの扱い

- **kimochi-board**: 視線入力（`gazeEnabled`）との排他制御を持つため、通常Rolloutグループへ含めない。Switch Scan Rolloutの最終盤、または視線入力共通仕様の調査と合わせた独立Pilotとして扱う（11章・18.17節の方針を維持）。視線入力仕様そのものは本文書の対象外のまま。
- **gaze-keyboard**: 「視線入力アプリ」という名称だけでkimochi-boardと同一視しない。複数グループ結合scope（tabs+keys+phraseBtns+globalCtrls）・modal内包（`buildScanItems`自体がモーダル優先判定を内包）という構造的特殊性から、Group C（特殊対応グループ）として扱うが、視線入力との結合度はkimochi-boardほど高くないと推定される（Phase25-Iの軽量確認範囲であり断定しない）。

### 19.12 bosai-appの扱い

setTimeoutチェーン方式（`scan.scheduleNext()`による再帰呼び出し）・advance/select分離（`scan.next()`/`scan.select()`）・Enter例外（7.3節5番で記録済み）という3つの固有事情を持つ。4 Pilotのいずれとも異なるtimer実装であるため、Rollout時はGroup Bの他アプリと同列に扱わず、個別の軽量検証（実質的にPilotに近い慎重さ）を要すると評価する。

### 19.13 native focus系の扱い

hiragana-learn・suji-manabouは`setInterval`ベースの自動走査を持つが、ハイライト表現がカスタムclassではなくネイティブ`.focus()`である点が構造的に異なる。`clearScanHighlight()`の意味自体が「classを外す」から「フォーカスを外す」処理へ置き換わるため、highlightClass optionだけでなく、**highlight方式（class切替 vs ネイティブfocus）というより上位のoption/adapter設計**が必要になる可能性がある。Group Dとして通常Rolloutと分離し、個別評価する。

### 19.14 第5Pilotの要否

**不要と判定する。** 4 Pilot＋21アプリinventoryにより、配置方式（C）の採用判断確度は「高」に達している（19.15節）。個別のRollout対象（bosai-app・kimochi-board・gaze-keyboard・native focus系）はRollout実施時にそれぞれ個別の軽量検証を要するが、これは配置方式そのものの決定には影響しない。

### 19.15 判断確度

**高。** 根拠: 4 Pilotによる実装・検証・公開の反復実績（同一手法で4回連続成功）、21アプリ全件の軽量inventoryによる分布の裏付け、本仕様書によるM/R/C/U/A分類・6関数構造・adapter境界の文書化。未検証項目（視線入力連携の詳細、setTimeoutチェーンの実装検証）はいずれもC方式の採否判断そのものには影響しない。

### 19.16 apps-data.jsonとの整合（記録のみ）

21アプリinventory（Phase25-I）により、apps-data.json上の「スイッチ」表記21件と、実装確認済みの自動走査型21件は、**総数は一致するが具体的な構成が3件異なる**ことが判明した（tokei-app・mogura-tataki・tyushiを除外し、timetable-app・yomikaki-app・gaze-keyboardを追加、1.5節参照）。この訂正をapps-data.json自体へ反映するかどうかは、利用者向けA11y表記としての正確性（実装上の分類と、利用者にとっての実際の操作可能性は必ずしも1対1で対応しない）を踏まえ、別Phaseで判断する。**本v1.4ではapps-data.jsonを変更しない。**

### 19.17 Rollout実装事実による訂正（v1.5で追加）

Group A Rollout第1波（katakana-app、Phase25-M／Phase25-M2）の実装・実ブラウザ検証・公開確認により、以下の訂正を記録する。**本節はRolloutから得られた実装事実に基づく訂正であり、新たな仕様の追加ではない。**

#### 19.17.1 Strategy B実例の訂正

19.2節「Strategy B実例0件」は誤りであった。katakana-appの候補取得（`buildScanItems()`、Phase25-Mで既存ロジックから抽出）は`active.querySelectorAll('button,[tabindex="0"]')`（`.section.active`スコープ）という包括query方式であり、3.3節Strategy Bの正式な実例である。3.3節のStrategy B「実例」欄へkatakana-appを追加した。

#### 19.17.2 katakana-appのhighlight方式の訂正

19.9節はkatakana-appを「`.scan-focus`使用」としてGroup Aへ分類していたが、実装事実としては`.scan-focus`クラスは一切付与されておらず（既存コード中に削除処理のみ存在する、実際には機能していないコード）、実際のハイライトはネイティブ`element.focus()`と`body.scan-mode`スコープのCSS `:focus`ルールにより実現されている。この方式は19.13節が記録するnative focus系（hiragana-learn・suji-manabou、Group D）と構造的に同種である。

#### 19.17.3 Group A定義の再評価

19.9節のGroup A定義（「`.scan-focus`使用でPilotに構造が近い」）は、katakana-appについては実装事実と一致しない。Group Aの他アプリ（janken-app・shiritori2・register-app・timetable-app・cup_game・kyou-no-kiroku）についても、Phase25-I軽量inventoryの分類のみに基づく推定であり、個別コード確認による裏付けを経ていない。**Group Aという分類名・グルーピング自体は維持するが、「`.scan-focus`使用」という前提は個々のアプリごとに再確認が必要な仮説として扱う。** katakana-appはGroup Aへ留め置く（Rollout単位としての区分は妥当であるため）が、highlightClass optionの適用にあたってはGroup D同様のnative focus対応が必要になりうることを注記する。

#### 19.17.4 21アプリinventory（Phase25-I）の位置づけの明確化

19.2節・19.9節が根拠とする21アプリinventory（Phase25-I）は、**一次スクリーニング（lightweight inventory）であり、個々のアプリの実装詳細を保証するものではない。** katakana-appの事例が示す通り、highlightClassやStrategy分類はコードの直接確認なしには確定できない場合がある。**今後のRollout実施にあたっては、Phase25-M（katakana-app）で確立した事前調査手順（候補取得関数・Strategy分類・scope・refreshMode・timer・state・highlight class・start/stop/activation・common chrome等の直接コード確認）を、各アプリのPilot実装着手前に必須のステップとする。** Phase25-I inventoryの結果のみを根拠に実装へ着手してはならない。

#### 19.17.5 訂正の位置づけ

本節の訂正はいずれも、Group A Rollout第1波（katakana-app、Phase25-M／Phase25-M2）という**実際のRollout実装・実ブラウザ検証・公開確認から得られた事実**に基づく。19.3節（方式C正式採用）・19.4節（採用理由）・19.14節（第5Pilot不要判定）等、配置方式そのものの決定には影響しない。本節は既存記述の訂正・明確化であり、新たな仕様・helper API・Strategy・配置方式・Rollout手順の追加ではない。

### 19.18 Group A Rollout完了実績（v1.6で追加）

#### 19.18.1 目的

本節は、Group A（7アプリ）のSwitch Scan Rolloutが全件完了したことを受け、Phase25-M〜Xで得られた実装事実を正式に記録する。**本節は実装実績の記録・補足・訂正であり、新しい共通基盤・helper API・Strategy種別・配置方式の追加ではない。**

#### 19.18.2 Group A Rollout完了実績一覧

Group A対象7アプリすべてのRolloutが完了し、main統合・production公開済みであることを確認する。

| アプリ | 実施Phase | 主要特徴 |
|---|---|---|
| katakana-app | Phase25-M／M2 | Strategy B実例（1件目）、native focus方式 |
| register-app | Phase25-P | Strategy C実例（2件目）、common chrome含有、動的listener |
| janken-app | Phase25-Q | Strategy B実例（2件目）、genuine `.scan-focus`、`focus()`＋`scrollIntoView()`副作用 |
| timetable-app | Phase25-R | ハイブリッド候補（`.tab-btn`全体＋section内混在）、activate後150ms遅延再計算 |
| shiritori2 | Phase25-S（設計）／T（実装） | 状態駆動型明示列挙、1/2スイッチ両対応 |
| cup_game | Phase25-U（設計）／V（実装） | cupsData配列index型、`guess()`直接呼び出しadapter |
| kyou-no-kiroku | Phase25-W（設計）／X（実装） | setTimeoutチェーン、restartOnActivate非対称型、Strategy A＋Cハイブリッド、TTS／progress bar |

いずれも既存挙動100%維持・main版との候補配列完全一致・Console Error 0・pageerror 0・SHA256一致を確認した上でproduction公開している。

#### 19.18.3 Strategy分類実績

Group A完了実績により、以下の多様な候補取得パターンが確認された。

- **Strategy B実例（複数確認）**：katakana-app（`.section.active`スコープの包括query）、janken-app（`.screen.active`スコープの`button:not([disabled])`）。
- **Strategy C実例（複数確認）**：okane-app（Pilot、19.2節）、register-app（`SWITCH_SCAN_SELECTOR`定数）。
- **状態駆動型明示列挙**（A/B/Cいずれにも該当しない）：shiritori2の`getScanTargets()`は、ゲーム状態に応じて`card0`/`card1`または`nextBtn`、設定パネル表示中はパネル内要素を明示的にpushする方式。
- **アプリ内部データ配列index型**（DOM queryを伴わない）：cup_gameの候補は`cupsData[i].wrapper`という固定長配列インデックス直接操作であり、DOM query自体を一切使わない。
- **Strategy A＋Cハイブリッド型**：kyou-no-kirokuの`buildScanItems()`は、明示list（`.kimochi-btn, .child-card, .btn, .condition-btn`）とmarker（`.scannable`）を同時併用する。

**本節の追加により、Strategy A/B/C分類は「典型的なパターンを示す整理」であり、「全実装を排他的に分類するもの」ではないことを明確化する。新しいStrategy D/E等の正式区分は追加しない。** 状態駆動型・配列index型・ハイブリッド型は、3.3節のA/B/C分類へ無理に当てはめず、「その他（アプリ固有の候補源）」として扱う。

#### 19.18.4 buildScanItemsの入力源に関する明確化

cup_game実績（19.18.3節）により、`buildScanItems()`は**DOM queryを必須としない**ことを確認する。候補源は、DOM query・marker・明示列挙・application state／internal data arrayなど、アプリ固有で構わない。重要なのは、既存候補の意味論（何が候補になり、何が候補にならないか）を保持することであり、取得手段そのものを統一する必要はない。

#### 19.18.5 1/2スイッチ実装実績

shiritori2（`scanMode='1'/'2'`）・cup_game（`autoScan`真偽値）の2件で、automatic scan（1スイッチ的）とmanual advance/select（2スイッチ的）の両方に対応するadapter実装が確認された。いずれも、Space advance相当の処理をhelper6の外（keydownハンドラ内、adapter側）に残す設計を採用し、helper6へ新たなadvance関数を追加していない。**これにより、advance/select分離はhelper6の外で扱うadapter責務として維持できるという方針（18.10節・18.11節）が、複数の実例により再確認された。**

#### 19.18.6 setTimeoutチェーン実績

kyou-no-kirokuの`advanceScan()`は、`setTimeout(advanceScan, ...)`による自己再帰チェーン方式である。bosai-app（未Rollout、19.12節）に次ぐ2例目のsetTimeoutチェーン実例となる。setInterval型と同様、**既存のtimer意味論（自己再帰の再スケジュールタイミング、`clearTimeout`のタイミング、二重起動防止の仕組み）をhelper6整理後も完全に保持する必要がある**ことを実装実績として確認した。

#### 19.18.7 restartOnActivateの非対称パターン実績

kyou-no-kirokuの`activateScan()`（→`activateCurrentScanItem()`）は、`stopSwitchScan()`を呼ばず`clearTimeout(scanTimer)`のみを実行し、`.click()`実行後400ms経過するまで現在の`.scan-focus`ハイライトを意図的に残すという非対称な実装であることが確認された。この停止処理を`stopSwitchScan()`へ安易に統一すると、決定直後にハイライトが即座に消えるという利用者向け体験の変化を招く。**restartOnActivateパターンでは、アプリ固有の停止意味論（何を止め、何を残すか）を個別に保持する必要がある**ことを実例として記録する。

#### 19.18.8 副作用（side effect）保持の実例集約

Group A完了実績により、以下の副作用パターンが確認された。いずれもhelper6整理時に実行順・タイミング・対象を変更してはならない。

- `focus()`：janken-app（highlight付与と同時にネイティブfocusも設定）
- `scrollIntoView()`：janken-app・timetable-app（highlight対象を画面内へスクロール）
- TTS（`speak()`）：kyou-no-kiroku（highlight更新の度に読み上げ）
- progress bar：kyou-no-kiroku（highlight更新とscanSpeedに同期したアニメーション）
- highlight保持（決定操作直後もハイライトを残す）：kyou-no-kiroku（19.18.7節）
- 設定パネルscope切替：shiritori2（設定パネル表示中は候補scopeがゲーム画面から切り替わる）

#### 19.18.9 common chromeの実績再確認

Group A完了実績により、common chromeを候補に**含むアプリ**（register-app・kyou-no-kiroku）と**含まないアプリ**（katakana-app・janken-app・timetable-app・shiritori2・cup_game）の両方が実在することを再確認した。18.14節が定める「両パターン容認」という既存方針のとおり、共通化にあたって一律追加・一律除外は行わない。

#### 19.18.10 Inventoryの位置づけの再確認

19.17.4節（v1.5）で「21アプリinventory（Phase25-I）は一次スクリーニングであり、Rollout Pilot着手前には必ず直接コード確認を行う」と定めた方針は、Group A残り6アプリ（janken-app・register-app・timetable-app・shiritori2・cup_game・kyou-no-kiroku）の事前調査（Phase25-O、Phase25-U、Phase25-W）でも繰り返し有効性が確認された。特にtimetable-appでは、Phase25-Oの「activate後400ms」という記載が実コード確認により「150ms」の誤りであったことが判明し（Phase25-R）、**軽量inventoryの数値・記述であっても、実装前の直接コード確認を省略してはならない**という方針が改めて裏付けられた。

#### 19.18.11 Rollout標準手順（正式化）

Group A完了実績（7アプリ）から、以下を実践手順として整理する。

1. Inventory（一次スクリーニング）
2. 直接コード確認（Strategy／scope／timer／state／副作用の実コード確認）
3. helper6対応設計（既存関数との対応表作成、adapter要否判断）
4. 候補配列比較計画（main版とのRollout前後比較項目定義）
5. Playwright検証計画
6. 実装（helper6整理、互換エイリアス維持）
7. main版との既存挙動比較（候補配列・機能・タイミング）
8. 統合（commit→Fast-Forward→push）
9. production確認（generate／Actions／Pages確認、production版検証、SHA256比較）

**高難度対象（shiritori2・cup_game・kyou-no-kiroku）では、2〜5を独立した調査・設計Phaseとして切り出し、6〜9を別の実装Phaseとして分離することが有効であった**ことを実績として記録する（Phase25-S/T、Phase25-U/V、Phase25-W/Xの3組）。低〜中難度対象（katakana-app・register-app・janken-app・timetable-app）では、調査から実装・統合までを1Phase内で一体的に実施しても問題は生じなかった。

#### 19.18.12 位置づけ

本節（19.18節）はGroup A Rollout完了（7アプリ）という**実際の実装実績から得られた事実の記録**である。19.3節（方式C正式採用）・16章（helper6 API）・19.5節（契約レベルの共通化）等、既存の設計方針を変更するものではない。Strategy分類・buildScanItemsの入力源・1/2スイッチ・setTimeoutチェーン・restartOnActivate・副作用保持・common chromeのいずれについても、新しい共通基盤やAPIの追加は行っていない。

### 19.19 Group B Rollout完了実績（v1.7で追加）

#### 19.19.1 目的

本節は、Group B（6アプリ）のSwitch Scan Rolloutが全件完了したことを受け、Rollout過程で得られた実装事実・分類の再評価・利用者向け既存不具合の発見と修正実績を正式に記録する。**本節は実装実績の記録・補足・訂正であり、新しい共通基盤・helper API・Strategy種別・配置方式の追加ではない。**

#### 19.19.2 Group B Rollout完了実績一覧

Group B対象6アプリすべてのRolloutが完了し、main統合・production公開済みであることを確認する。

| アプリ | 実施Phase | 主要特徴 |
|---|---|---|
| yomikaki-app | Phase25-AA | `.scfoc`、setupScanTgts()／clearScanHL()を互換エイリアス化した最小整理 |
| bosai-app | Phase25-AB（設計）／AC（実装）、Phase25-AG（不具合修正） | `const scan`オブジェクト内method方式、Space=決定／Enter=進む、touch tap<600ms=決定／hold>=600ms=進む、setTimeout自己再帰、common chrome含有（旧仕様書記載は古いスナップショット、5.2節参照） |
| ongaku-app | Phase25-AF（設計）／AH（実装）、Phase25-AG（不具合修正） | 1/2スイッチadapter、fake event activation（`currentTarget`/`clientX`/`clientY`合成）、候補タイプ別activation分岐（sound-buttonはfake event、common chromeはnative click）、capture:true click横取り（1スイッチのみ） |
| time-timer | Phase25-AD（設計）／AE（実装） | Tab/Shift+Tabという独立した第3入力経路、click後`activeElement`比較による条件付き`focus()`フォールバック |
| sugoroku-app | Phase25-AI（設計）／AL（実装）、Phase25-AK（不具合修正） | 優先度付き9分岐の状態機械（最初に一致した分岐のみ採用）、touchstart/touchend経路＋pointerdown経路の二重入力、`.shi`、bip、refreshOnActivate 350ms |
| nazori-app | Phase25-AM（設計）／AO（実装）、Phase25-AN（不具合修正） | Strategy B、panel/subview 2段scope、動的once clickリスナーによるdirect click決定方式、common chrome含有 |

いずれも既存挙動100%維持・main版との候補配列完全一致・Console Error 0・pageerror 0・SHA256一致を確認した上でproduction公開している。bosai-app・ongaku-app・sugoroku-app・nazori-appの4アプリでは、helper6 Rollout着手前の個別調査Phaseにより利用者向けの既存不具合が発見され（19.19.9節）、Rolloutとは独立した修正Phaseを先行させた上でRolloutを実施した。

#### 19.19.3 Group B分類の再評価

19.9節が定める「Group B（highlightClass違い、6件）」という分類名は、highlightClassの違い（`.scan-highlight`／`.scanning`／`.scan-focused`／`.shi`／`.scfoc`）という表面的な差異のみに基づく一次スクリーニングであり、**内部実装の多様性を十分に表していなかった**ことが、6アプリ全件のRollout実績により判明した。

- **object state方式**：bosai-appは`const scan = {...}`という単一オブジェクトがstate・timer・helper6すべてを内包する（他のGroup A/B実装は主にbare globalまたはmodule内`let`）。
- **1/2スイッチadapter**：ongaku-appは1スイッチ（timerあり、Space/Enter=決定）／2スイッチ（timerなし、Space=進む、Enter=決定）という構造の大きく異なる2モードを1つのapp内で切り替える（shiritori2・cup_game〔19.18.5節〕と同種のパターンだが、activation方式自体もモードごとに異なる点がGroup Bでの新規実例）。
- **Tab第3入力経路**：time-timerはSpace/Enter/Tabの3種の入力を持ち、Tabは「進む」という独立した意味を持つ（他のGroup A/B実装にはない構造）。
- **fake event activation**：ongaku-appはDOM標準の`click()`ではなく、`{currentTarget, clientX, clientY}`を合成したfake eventをapp固有関数へ直接渡す方式を採る。
- **優先度付き状態機械**：sugoroku-appの候補生成は、9個のif文が優先順位順に候補を確定し最初に一致した時点で即returnするという、他のStrategy A/B/Cのいずれとも異なる構造を持つ。
- **動的once clickリスナーによるdirect click決定方式**：nazori-appは、走査中の対象へ`{once:true}`のclickリスナーを都度動的に付与し、実際のクリック/タップをもって決定操作とする（Phase25-AN修正後はSpace/Enterもこの経路へ`element.click()`経由で合流する）。

**本節の追加により、Group A/B/C/D（19.9節）という分類は「Rollout実施の作業単位（グルーピング）」として引き続き妥当だが、Group名自体（例:「highlightClass違い」）が実装の構造的差異を正確に説明するとは限らないことを明確化する。** 19.17.3節（Group A定義の再評価）と同じ扱いとし、**Group名・グルーピング自体は変更しない**。個々のアプリの実装詳細は、Rollout Pilot着手前の直接コード確認（19.17.4節の方針）によってのみ確定できるという既存方針が、Group Bでも改めて裏付けられた。

#### 19.19.4 bosai-app実績

- Switch Scanのstate・timer・helper6をすべて`const scan = {...}`オブジェクトのmethodとして実装する既存構造を維持したまま、helper6（`buildScanItems`等）を`scan.buildScanItems`のようなobject内methodとして整理した（Phase25-AC）。
- Space＝決定、Enter＝進む、という他のGroup A/B実装とは逆の役割分担を持つ（7.3節の既存例外方針どおり維持）。
- touch入力はtap（600ms未満）＝決定、hold（600ms以上）＝進む、という長押し機能の実例である（10.2節U2の未決定事項に対する具体的な実装例）。
- timerは`setTimeout`自己再帰方式（`scan.scheduleNext()`）である。
- **common chromeは現行実装で候補に含まれる。** 5.2節3番が記録する「bosai-appは共通chrome除外」という記述はPhase18.31-A時点（v1.0初版根拠調査）の古いスナップショットであり、Phase18.31-A以降の実装進化（推定: 共通A11yパネル整備）により`.scannable`セレクタ経由で含まれるようになっていたことが、Phase25-AB（直接コード確認）で判明した。5.2節・5.3節へ訂正注記を追加した（本節参照）。

#### 19.19.5 time-timer実績

- Tab＝前進、Shift+Tab＝後退という、Space/Enterとは独立した**第3の入力経路**を持つ。Tab押下時にはtimerも明示的に再起動される。この経路はhelper6へ吸収せず、既存のkeydownハンドラ内にapp固有のadapterとして維持した（Phase25-AE）。
- 決定操作（`click()`実行）の後、**click実行前後の`document.activeElement`を比較し、フォーカスが移動していなければ対象へ`.focus()`を発火する条件付きフォールバック**を持つ。フォールバック発火条件は以下の5点すべてを満たす場合である。
  1. `isConnected`
  2. `!closest('[inert]')`
  3. `!closest('[hidden]')`
  4. `getClientRects().length > 0`
  5. `!disabled`
- **本実例は、`activateCurrentScanItem()`の実装が単純な`click()`発火だけとは限らないことを示す新しい実装パターンである。** 18.8節が定める「現在候補の決定処理を開始する」という結果ベースの定義の範囲内で、click()実行に加えてapp固有のfocus補正を付随させる設計が許容されることを実例として記録する。
- `stopSwitchScan()`が`scanInterval`をnull化しない、という8.1節M4への軽微な非準拠が確認されたが、実害は確認されておらず、仕様書本文を複雑化させない範囲の補足に留める。

#### 19.19.6 ongaku-app実績

- 1スイッチ（timerあり、Space/Enter＝決定）と2スイッチ（timerなし、Space＝進む、Enter＝決定）という、構造が大きく異なる2モードのadapter実装を持つ。
- 決定操作は、DOM標準の`click()`ではなく、`{currentTarget, clientX, clientY}`を合成したfake eventをapp固有関数（`onSoundBtnClick()`）へ直接渡す方式（sound-button候補のみ）。`clientX`/`clientY`は対象要素の中心座標を用いて、実クリック位置がない場合の視覚効果（ripple）の起点を代替する。
- **候補タイプ別のactivation分岐**が実例として確認された：sound-button候補はfake event経路、common chrome等のsound-button以外の候補は通常の`element.click()`経路、という2方式が1つの`activateCurrentScanItem()`内で判定・分岐する。18.8節の「結果ベースの定義」の範囲内で、候補の種類に応じてactivation手段を切り替える設計が許容されることを実例として記録する。
- 1スイッチモードでは、走査中の全候補へcapture:trueのclickリスナーを動的付与し、実際のタップ/クリック対象に関わらず現在の走査対象を決定する「click横取り」方式を持つ（意図的な単一スイッチ設計）。
- common chromeは3件（`donomanaA11yBtn`／`donomanaLockBtn`／`donomanaHomeBtn`）で、`donomanaFsBtn`は存在しない。
- **Phase25-AGにおいて、common chromeがscanIndexで選択された状態で決定すると`TypeError`が発生し操作不能になる既存不具合を、helper6 Rolloutに先行して独立に修正した**（19.19.9節）。

#### 19.19.7 sugoroku-app実績

- 候補生成は、Rollout前調査（Phase25-AI）で実コードを直接確認した結果、**優先度付き9分岐の状態機械**であることが確定した。各分岐はモーダル/パネル/画面の表示状態を上から順に判定し、最初に一致した時点で候補配列を確定し即returnする（複数分岐のconcatではない）。
- touchstart/touchend経路（横移動40px未満で決定）と、pointerdown経路（外部スイッチ対応、touch直後300ms dedup、`BUTTON`/`INPUT`/`SELECT`/`TEXTAREA`/`A`タグを除外）という、2つの独立した入力経路が並存する。
- 決定操作後、350ms後に候補再取得・ハイライト再開を行う`refreshOnActivate`相当の設計を持つ（timer自体は停止せず継続する点が他の実例と異なる）。
- ハイライトclassは`.shi`、決定音（`bip()`）、`scrollIntoView`、TTS（`speak()`）を伴う。
- 候補生成のclass判定（`classList.contains('on')`）とinline style判定（`style.display`）が混在するという既存実装の不統一が確認されたが、既存挙動として維持し変更しない。
- common chromeは候補から除外される（`.scannable`は候補生成ロジックに一切登場しない）。
- **Phase25-AKにおいて、決定操作後の350ms delayed refreshにSwitch Scan OFF状態のガードがなく、OFF直後に決定するとOFF後にハイライトが再出現し消せなくなる既存不具合を、helper6 Rolloutに先行して独立に修正した**（19.19.9節）。

#### 19.19.8 nazori-app実績

- 候補生成はStrategy B（`button:not([disabled])`包括query）であり、`.panel.active`スコープ、`tab-practice`パネルでは表示中のsingle/wideビューへさらに絞り込むという2段scopeを持つ。
- common chromeは候補に含まれる（4件: `donomanaA11yBtn`／`donomanaLockBtn`／`donomanaFsBtn`／`donomanaHomeBtn`）。
- 決定方式は、走査中の対象へ`{once:true}`の動的clickリスナーを都度付与し、実際のクリック/タップを受けたときにhighlight解除・timer停止・400ms後の再開処理を行う、という**direct click決定方式**を持つ。timerはsetTimeout自己再帰。
- highlight移動時に`scrollIntoView`・TTSを伴う。
- **Phase25-ANにおいて、Space/Enterキー押下時にhighlight解除とtimer再スケジュールのみを行い、対象要素へ`click()`を一切発火させていなかったため、キーボード操作（外部スイッチ含む）では決定操作を完遂できない既存不具合を、helper6 Rolloutに先行して独立に修正した**（19.19.9節）。修正方式は、Space/Enter時に「現在ハイライト中要素へ`element.click()`を発火させ、既存のdirect click決定経路へそのまま委譲する」という統合であり、決定後処理（highlight解除・timer停止・400ms後再開）を新たに重複実装しなかった。

#### 19.19.9 利用者向け不具合修正実績からの教訓

Group B Rollout前調査により、helper6整理そのものとは別に、以下3件の利用者向け既存不具合が発見・修正された。

- **ongaku-app**：Switch Scan中にcommon chrome候補を決定すると`TypeError`が発生し操作できない（Phase25-AF調査・Phase25-AG修正）。
- **sugoroku-app**：決定操作後、350ms以内にSwitch ScanをOFFにすると、OFF後にハイライトが再出現し消せなくなる（Phase25-AJ Part A調査・Phase25-AK修正）。
- **nazori-app**：Space/Enterキーで現在ハイライト中の候補を決定できず、利用者向けヘルプ文言（「外付けスイッチはスペースキーに対応させてください」）と実装が矛盾していた（Phase25-AM調査・Phase25-AN修正）。

**運用上の教訓として、「Rollout前の直接コード確認・実ブラウザ確認は、Strategy／highlightClass等の分類確認だけでなく、既存アクセシビリティ不具合の発見にも有効である」ことを記録する。** 3件はいずれも、Phase25-I軽量inventoryやPhase25-Zのような外部調査記録を鵜呑みにせず、実コード・実ブラウザを直接確認するというRollout前調査の過程で発見された。詳細な不具合の症状・再現手順は各Phase報告（Phase25-AF〜AN）に譲り、本節では運用上の教訓のみを記録する。

#### 19.19.10 activation adapterの整理

Group A・B双方の実績により、`activateCurrentScanItem()`の実装が**単純な`element.click()`発火だけとは限らない**ことが、以下の実例で確認された。

- **native `.click()`**：多くのGroup A/B実装（4 Pilot・Group A全7アプリ・yomikaki-app等）における標準実装。
- **app固有関数の直接呼び出し**：schedule-appの`toggleCheck()`直接呼び出し（18.9節、7.3節7番）。
- **fake eventの合成**：ongaku-appの`{currentTarget, clientX, clientY}`合成（19.19.6節）。
- **候補タイプ別の分岐**：ongaku-appのsound-button／common chrome分岐（19.19.6節）。
- **click後のfocus補正**：time-timerの条件付き`focus()`フォールバック（19.19.5節）。
- **既存direct click経路への委譲**：nazori-appのSpace/Enter→`element.click()`→動的clickリスナー（19.19.8節）。

**重要なのは、activationの実装手段そのものを統一することではなく、「既存の利用者向けactivation意味論を保持する」ことである。** 18.8節が定める「現在候補の決定処理を開始する」という結果ベースの定義は、Group Bの多様な実例によっても引き続き成立することを確認した。新しいactivation方式の正式区分（例: 「Strategy click／fake-event／delegate」等）は追加しない。

#### 19.19.11 input adapterの整理

Group Bの実績により、helper6の外に残すべきapp固有入力経路の実例が以下のとおり蓄積された。いずれもhelper7等の新規共通関数を追加せず、既存のadapter責務（16.3節）として維持する既存方針を再確認する。

- Space＝進む（ongaku-app 2スイッチモード、bosai-app）
- Enter＝進む（bosai-app）
- Tab／Shift+Tab（time-timer、19.19.5節）
- touch tap／hold（bosai-app、10.2節U2の実装例）
- pointerdown（sugoroku-app、外部スイッチ対応・タグ除外・300ms dedup）
- capture:trueによるclick横取り（ongaku-app 1スイッチモード）
- 画面任意位置タップによる決定（sugoroku-app、候補要素を直接タップする方式ではなく画面の任意位置から現在候補を決定する方式）

#### 19.19.12 副作用（side effect）保持の実例集約

Group B完了実績により、以下の副作用パターンが追加で確認された。19.18.8節（Group A実績）と同様、いずれもhelper6整理時に実行順・タイミング・対象を変更してはならない。

- 条件付き`focus()`：time-timer（19.19.5節）
- fake eventの座標合成：ongaku-app（`clientX`/`clientY`、19.19.6節）
- ripple／playing animation：ongaku-app（fake eventのclientX/clientYを用いた視覚効果）
- 決定音（bip）：sugoroku-app（`bip()`、決定操作の都度再生）
- TTS：bosai-app・sugoroku-app・nazori-app（highlight更新の度に読み上げ）
- scrollIntoView：bosai-app・sugoroku-app・nazori-app
- 動的once clickリスナーの付与／解除：nazori-app（19.19.8節）

#### 19.19.13 Rollout標準手順の補強

Group B実績（特に3件の不具合修正、19.19.9節）から、19.18.11節が定めるRollout標準手順を以下のとおり補強する。

1. Inventory（一次スクリーニング）
2. 直接コード確認（Strategy／scope／timer／state／副作用・入力経路の実コード確認）
3. **main版実ブラウザ確認**（Playwright等による実際の挙動計測。分類の裏付けだけでなく、既存不具合の発見を目的に含める）
4. **既存不具合判定**（利用者向け説明との整合、実機スイッチ想定の入力経路網羅、実害の有無を判定）
5. **（実害のある既存不具合が確認された場合のみ）独立した不具合修正Phase**を先行させ、修正版をmain/publicへ統合してから次工程へ進む
6. helper6対応設計（既存関数との対応表作成、adapter要否判断）
7. 候補配列比較計画（main版とのRollout前後比較項目定義）
8. Playwright検証計画
9. 実装（helper6整理、互換エイリアス維持）
10. main版との既存挙動比較（候補配列・機能・タイミング）
11. 統合（commit→Fast-Forward→push）
12. production確認（generate／Actions／Pages確認、production版検証、SHA256比較）

**「利用者へ実害のある既存不具合は、helper6 Rolloutと混在させず、独立したPhaseで先に修正する」ことを正式な推奨事項（R）として記録する。** Group Bでは、ongaku-app・sugoroku-app・nazori-appの3件でこの手順（3〜5番）が有効に機能し、いずれも不具合修正版をbaselineとして確定させた上でhelper6 Rolloutを実施した。bosai-appのcommon chrome記述の訂正（19.19.4節）のように、コード変更を伴わない仕様書側の訂正で足りるケースと、実際のコード修正Phaseを要するケースを、既存不具合判定（4番）の結果に応じて区別する。

#### 19.19.14 位置づけ

本節（19.19節）はGroup B Rollout完了（6アプリ）という**実際の実装実績、および同過程で発見・修正した利用者向け既存不具合3件から得られた事実の記録**である。19.3節（方式C正式採用）・16章（helper6 API）・19.5節（契約レベルの共通化）・18.8節（activateCurrentScanItemの結果ベース定義）等、既存の設計方針を変更するものではない。Group分類の再評価・activation adapter・input adapter・副作用保持のいずれについても、新しい共通基盤やAPI・Strategy区分の追加は行っていない。

### 19.20 Group C Rollout完了実績（v1.8で追加）

#### 19.20.1 目的

本節は、Group C（kimochi-board・gaze-keyboard、19.11節で通常Rolloutと分離した特殊対応グループ）のSwitch Scan Rolloutが全件完了したことを受け、実装事実を正式に記録する。**本節は実装実績の記録・補足であり、新しい共通基盤・helper API・Strategy種別・配置方式の追加ではない。**

#### 19.20.2 Group C Rollout完了実績一覧

| アプリ | Rollout commit | 独立修正commit | 主要特徴 |
|---|---|---|---|
| kimochi-board | `917c0f6` | `262aad1`（switchScan設定OFF時に自動走査アニメーションが止まらない既存不具合の修正、Version2検討事項9番に対応） | 視線入力（`gazeEnabled`）との排他制御、static candidate（画面遷移を持たない単一画面構成のため許容、3.1節R1適用除外の既存扱いを維持）、progress bar連動、`activateCurrentScanItem(index)`が候補タイプ別に分岐（common chrome＝`click()`委譲、実カード＝stop→beep→TTS→result表示→overlay表示→1600ms→guard付きrestartという既存アプリ固有の決定フロー）、`startScan()`/`stopScan()`互換alias |
| gaze-keyboard | `4125848` | `f822967`（後述19.20.5節） | 複数グループ結合scope（tabs＋keys＋phraseBtns＋globalCtrls）を1つの`buildScanItems()`が生成、同関数内でモーダル優先判定を内包（設定モーダル表示中は候補をモーダル内へ限定、9.1節C1相当）、`startScan()`/`stopScan()`互換alias |

いずれも既存挙動100%維持・main版との候補配列完全一致・Console Error 0・pageerror 0・SHA256一致を確認した上でproduction公開している。

#### 19.20.3 kimochi-board実績

- `buildScanItems()`は固定配列`cards`をそのまま返す静的実装である。3.1節R1（動的再取得の推奨）には適合しないが、Phase18.31-Aの時点から「単一画面構成のアプリに限り変更必須としない」という適用除外が既に成立しており（13章）、Rollout後もこの評価を変更しない。
- `refreshSwitchScanItems()`は`buildScanItems()`を呼ぶだけの最小構造とし、「helper6だからといって既存に呼び出し箇所を追加する」という新しい挙動を導入しなかった。
- `clearScanHighlight()`は`.scanning`class除去のみに責務を絞り、進捗バーのリセット処理は呼び出し元側の責務として残した（19.21.3節が定める最終契約の先行実例）。
- `activateCurrentScanItem(index)`は既存の`selectCard(index)`が持っていた候補タイプ別分岐（common chromeはclick()委譲、実カードはapp固有の決定フロー）をそのまま維持し、index引数を伴う既存シグネチャを変更しなかった。gaze/dwell選択（`onPointerMove`）からも共有される既存の`highlightCard(i)`はhelper6へ統合せず、独立した内部helperとして維持した。

#### 19.20.4 gaze-keyboard実績

- `buildScanItems()`は、設定モーダル表示中は候補をモーダル内要素へ限定して即returnし、非表示時はtabs／keys／phraseBtns／globalCtrlsという4グループを結合した配列を構築する。この「候補取得関数自体がモーダル優先判定を内包する」設計は、matching-app Pilot（16.6節2番）と同種のパターンの新規実例である。
- `clearScanHighlight()`は`.scan-lit`class除去のみに責務を絞った。
- `startScan()`/`stopScan()`という互換aliasを新設し、既存呼び出し箇所を変更せずに`startSwitchScan()`/`stopSwitchScan()`へ委譲した。

#### 19.20.5 利用者向け不具合修正実績（gaze-keyboard richEditor）

Group C Rollout前調査により、helper6整理そのものとは別に、以下の利用者向け既存不具合が発見・修正された（独立修正commit`f822967`、Rollout本体commit`4125848`に先行して統合・公開確定した）。

- **gaze-keyboard**：よく使うフレーズ・AACカード・予測変換の候補を選択しても、入力欄（richEditor）へ反映されないことがある。原因は、後発で追加されたrichEditorという内部状態管理機構に対し、フレーズ／AAC／予測変換という既存のactivation経路が追随しておらず、旧来のプレーンテキスト入力欄向けの更新方式のままだったこと。修正は、これら3経路の決定処理をrichEditorの状態更新APIへ同期させる形で行った。

本件は、19.19.9節が記録する「Rollout前調査は分類確認だけでなく既存不具合発見にも有効である」という運用上の教訓の、Group Cにおける新たな実例である。詳細は19.22.7節で一般化して記録する。

#### 19.20.6 位置づけ

本節（19.20節）はGroup C Rollout完了（2アプリ）という**実際の実装実績、および同過程で発見・修正した利用者向け既存不具合1件から得られた事実の記録**である。19.11節（kimochi-board・gaze-keyboardの個別扱い方針）・16章（helper6 API）・19.5節（契約レベルの共通化）等、既存の設計方針を変更するものではない。視線入力との統合方式の一般化（11章・Version2検討事項3番）は引き続き対象外のままとする。

### 19.21 Group D Rollout完了実績（v1.8で追加）

#### 19.21.1 目的

本節は、Group D（hiragana-learn・suji-manabou、19.13節で通常Rolloutと分離したnative focus系）のSwitch Scan Rolloutが全件完了したことを受け、実装事実、および同過程で発見・修正した利用者向け既存不具合2件（2アプリ共通の同型不具合）の実績を正式に記録する。**本節は実装実績の記録・補足であり、新しい共通基盤・helper API・Strategy種別・配置方式の追加ではない。**

#### 19.21.2 Group D Rollout完了実績一覧

| アプリ | 独立修正commit | Rollout commit | 主要特徴 |
|---|---|---|---|
| hiragana-learn | `c17e4f1` | `c6e2f17` | native focus＋`body.scan-mode`、TTSはmp3優先＋speechSynthesisフォールバック、学習ログは1問ごとに記録 |
| suji-manabou | `09ac2be` | `7882bcc` | native focus＋`body.scan-mode`（hiragana-learnと同型）、TTSはspeechSynthesisのみ（mp3経路なし）、`celebrate()`/`bigCelebrate()`、学習ログはマッチングセット完了時のみ1件記録、`equalizeMatchHeights()`のMutationObserver |

いずれも既存挙動100%維持・main版との候補配列完全一致・Console Error 0・pageerror 0・SHA256一致を確認した上でproduction公開している。

#### 19.21.3 native focus系の実装確定（`clearScanHighlight()`最終契約）

19.13節が予測した「highlightClass optionだけでなく、highlight方式（class切替 vs ネイティブfocus）というより上位のoption/adapter設計が必要になる可能性がある」という論点は、Rollout実装事実により以下のとおり確定した。

- 両アプリとも、highlightの視覚表現は「`body.scan-mode`クラス＋ネイティブ`:focus`疑似クラス」の組み合わせであり、per-候補のclassは一切使用しない。
- `clearScanHighlight()`は`document.body.classList.remove('scan-mode')`のみを責務とし、個々の候補要素への`focus()`／`blur()`は一切変更しない。
- 両アプリとも、`clearScanHighlight()`単体呼び出しの前後で`document.activeElement`が不変であること（新規blurが発生しないこと）を実測で確認した。

この実装事実により、**`clearScanHighlight()`の最終契約を「そのアプリにおけるSwitch Scanの視覚的highlight状態を解除する責務」という結果ベースの定義へ確定する**（19.22.3節でGroup横断の一般原則として整理する）。

#### 19.21.4 利用者向け不具合修正実績（二重activation・delayed focus jump）

Group D Rollout前調査により、helper6整理そのものとは別に、2アプリ共通の構造的に同一な既存不具合2件が発見・修正された。

- **Space/Enter二重activation**：scanMode専用の`keydown`ハンドラと、scanModeに関係なく動作する汎用`keydown`ハンドラ（「主要ボタンをSpace/Enterで操作する」という別機能）が同一`document`上に独立登録されており、いずれも`stopPropagation`系を呼ばずに同一`activeElement`へ`.click()`していたため、scanMode中はSpace/Enter1回につき決定処理が2回実行されていた。マッチング機能では「選択→即座に自己判定で選択解除」という形で顕在化し、実質的に操作不能だった。
- **OFF後delayed focus jump**：tab切替クリックリスナーが`if (scanMode) { setTimeout(updateScanTargets, 300); }`という遅延候補再構築を予約するが、コールバック発火時点で`scanMode`を再確認していなかったため、tab切替直後300ms以内にSwitch ScanをOFFにしても、OFF後にコールバックが実行され、操作中のフォーカスが無警告で候補要素へ強奪されることがあった。

修正はhiragana-learn（Phase25-AZ）→suji-manabou（Phase25-BD）の順で、いずれもRolloutとは独立したPhaseとして先行実施し、修正版production公開を確認した上でhelper6 Rolloutへ進んだ。両不具合の一般化された設計原則は19.22.4節・19.22.5節で記録する。

#### 19.21.5 位置づけ

本節（19.21節）はGroup D Rollout完了（2アプリ）という**実際の実装実績、および同過程で発見・修正した利用者向け既存不具合2件から得られた事実の記録**である。19.13節（native focus系の個別扱い方針）・16章（helper6 API）・18.8節（activateCurrentScanItemの結果ベース定義）等、既存の設計方針を変更するものではない。19.21.3節の`clearScanHighlight()`確定は、19.13節が「可能性がある」としていた論点への実装事実に基づく回答であり、新たなAPI追加ではない。

### 19.22 Phase25 Switch Scan Rollout完了総括（v1.8で追加）

#### 19.22.1 目的

本節は、Pilot（4アプリ）・Group A（7アプリ）・Group B（6アプリ）・Group C（2アプリ）・Group D（2アプリ）、計21アプリのSwitch Scan Rolloutが全件完了したことを受け、Phase25全体を通じて得られた設計知見を一般原則として整理し、正式に記録する。**本節は実装実績の総括・一般化であり、新しい共通基盤・helper API・Strategy種別・配置方式の追加ではない。**

#### 19.22.2 21アプリRollout完了記録

対象21アプリすべてについて、helper6実装・main統合・production確認が完了したことを正式に記録する。**Phase25 Switch Scan Rolloutは完了した。**

| グループ | 件数 | アプリ |
|---|---|---|
| Pilot | 4 | directions-app・matching-app・schedule-app・okane-app |
| Group A | 7 | katakana-app・register-app・janken-app・timetable-app・shiritori2・cup_game・kyou-no-kiroku |
| Group B | 6 | yomikaki-app・bosai-app・ongaku-app・time-timer・sugoroku-app・nazori-app |
| Group C | 2 | kimochi-board・gaze-keyboard |
| Group D | 2 | hiragana-learn・suji-manabou |
| **合計** | **21** | |

#### 19.22.3 helper6最終原則：thin wrapper・legacy alias・`clearScanHighlight()`の一般定義

Phase25全体の実装実績から、以下を共通helper6の最終運用原則として確定する。

1. **helper6は既存実装を全面置換するためのAPIではない。** `buildScanItems()`が既存の`getScanTargets()`を、`refreshSwitchScanItems()`が既存の`updateScanTargets()`をそのまま呼ぶだけのthin wrapperとして実装されたGroup Dの実例が示すとおり、helper6の目的は「責務名を共通化すること」であり「全アプリの内部実装を同一化すること」ではない。既存関数に安定した責務が存在する場合、無理なrename・統合・削除をしない。
2. **既存関数名（legacy alias）は、互換性・既存event listener・side effect維持のため残してよい。** `getScanTargets`／`updateScanTargets`／`startAutoScan`／`stopAutoScan`／`toggleScan`／`changeScanSpeed`（Group D）、`startScan`／`stopScan`（Group C）、`setupScanTgts`／`clearScanHL`（yomikaki-app）等、21アプリの大半で既存関数名がそのまま維持された。**helper6導入時に旧関数削除を必須としない**ことを最終方針として確定する。
3. **`clearScanHighlight()`は「特定のhighlight classを全候補からremoveする関数」と狭く定義しない。** 最終契約は「そのアプリにおけるSwitch Scanの視覚的highlight状態を解除する責務」という結果ベースの定義とする。実装例はclass除去（`.scan-focus`・`.scan-lit`・`.scanning`等）に限らず、native focus方式（Group D、19.21.3節）では`body.scan-mode`除去のみで足りる。**「視覚highlightの解除」と「DOM focusの変更」を同一視しない**ことを明記する。native focus方式であっても、`document.activeElement`自体を`blur()`する必要はない（既存のfocus意味論を破壊しないことを優先する）。

#### 19.22.4 二重activation設計原則（Group D由来の一般原則）

19.21.4節の実例を一般原則化する。

scan専用の`keydown`ハンドラと、既存の汎用`keydown`ハンドラ（アプリ全体のキーボード操作性向上等を目的とした、scanModeに依存しない別機能）が同一document上に併存する場合、Space/Enter1回の押下で同一`activeElement.click()`が2回実行される可能性がある。

**Rollout前調査では、以下を必ず確認する。**

- document上の`keydown` listenerの総数・登録先
- 各listenerのcapture/bubble
- 各listenerの`preventDefault()`／`stopPropagation()`／`stopImmediatePropagation()`の有無
- native button activationとの関係（`role="button"`・`tabindex`要素に対するブラウザ既定の活性化）

必要と判断された場合は、`stopImmediatePropagation()`等により「1 physical input = 1 activation」を保証する。**ただし、全アプリへ機械的に`stopImmediatePropagation()`を追加するという一律規則にはしない。** 汎用keydownハンドラを持たないアプリでは本問題自体が発生しないため、個別のRollout前調査（19.22.6節の手順）で都度判定する。

#### 19.22.5 delayed callback最終原則（sugoroku-app・Group D由来の一般原則）

19.19.7節（sugoroku-app）・19.21.4節（Group D）の実例を一般原則化する。

`setTimeout`等による非同期delayed callback（tab切替・決定操作後の候補再構築等）について、**予約時のガード（例：`if (scanMode) { setTimeout(...); }`）だけでは不十分である。**

**一般原則**：非同期callbackは、予約時と実行時の両方で状態整合性を確認する。

```
setTimeout(() => {
  if (scanMode) updateScanTargets();  // 発火時点の再確認
}, 300);
```

この原則により、以下を防止する。

- OFF後のhighlight復活（sugoroku-app、19.19.7節）
- OFF後のfocus強奪（hiragana-learn・suji-manabou、19.21.4節）
- timerの意図しない再起動
- stale candidateの再構築

#### 19.22.6 Rollout前既存不具合修正procedure（正式確定）

Phase25全体を通じて、helper6 Rollout前調査の過程で計6件の利用者向け既存不具合が発見・修正された（ongaku-app・sugoroku-app・nazori-app・gaze-keyboard・hiragana-learn・suji-manabou）。19.19.13節が定めるRollout標準手順（3〜5番）が、Group B以降のGroup C・Dでも一貫して有効に機能したことを確認し、以下を**正式なRollout procedureとして確定する。**

1. Inventory（一次スクリーニング）
2. 直接コード確認（Strategy／scope／timer／state／副作用・入力経路の実コード確認）
3. main版実ブラウザ確認（Playwright等による実際の挙動計測。既存不具合の発見を目的に含める）
4. 既存不具合判定（利用者向け説明との整合、実機スイッチ想定の入力経路網羅、実害の有無を判定）
5. **（実害のある既存不具合が確認された場合のみ）独立した不具合修正Phaseを先行させ、修正版をmain/publicへ統合してから次工程へ進む。helper6 Rolloutと混在させない。**
6. helper6対応設計（既存関数との対応表作成、adapter要否判断）
7. 候補配列比較計画（main版とのRollout前後比較項目定義）
8. Playwright検証計画
9. 実装（helper6整理、互換エイリアス維持）
10. main版との既存挙動比較（候補配列・機能・タイミング）
11. 統合（commit→Fast-Forward→push）
12. production確認（generate／Actions／Pages確認、production版検証、SHA256比較）

#### 19.22.7 gaze-keyboard richEditor教訓の一般化

19.20.5節の実装詳細を、再利用可能な一般原則として整理する。

既存アプリに、後発で追加された内部状態管理機構（richEditor等）が存在する場合、古いactivation経路だけが旧来の状態更新方式を保持したまま残っていることがある。**Rollout前調査では、「activationが実行できるか」だけでなく、activation後に以下が同期しているかを確認する。**

- 表示state
- 内部state
- 保存state（localStorage等）
- 次操作への影響

gaze-keyboardでは、フレーズ／AAC／予測変換の決定操作がrichEditorという新しい内部状態管理へ反映されない、という形でこの不同期が顕在化した（19.20.5節）。

#### 19.22.8 helper6方式Inventory（現時点、v1.8）

21アプリ全件の実装事実に基づく、**現時点のInventory**として記録する（将来の実装を固定化するものではない）。

| 方式 | 件数 | 内訳 |
|---|---|---|
| global function（各アプリHTML内で個別定義） | 20 | bosai-appを除く全アプリ |
| object method（`const scan = {...}`等） | 1 | bosai-app |
| native focus方式（highlightがclass切替でなくネイティブfocus） | 3 | katakana-app（19.17.2節）・hiragana-learn・suji-manabou |
| classベースhighlight方式 | 18 | 上記3件を除く全て |
| legacy alias維持 | 多数 | Group C・D全4アプリ、Group A/Bの多数のアプリ |
| thin wrapper（既存実装を包むだけ） | 許容（Group Dが典型例） | hiragana-learn・suji-manabou |
| app固有adapter（helper6化せず個別維持） | 全21 | timer詳細・input経路・side effect等 |

#### 19.22.9 candidate strategy最終Inventory

3.3節が定めるStrategy A/B/Cに加え、19.18.3節が「その他（アプリ固有の候補源）」として整理した類型を含め、以下の全類型が21アプリ中に実在することを最終確認する。**helper6はcandidate方式そのものを単一化するものではない。**

- Strategy A（明示marker方式）
- Strategy B（ネイティブ操作要素包括取得方式）
- Strategy C（巨大な明示的CSSセレクタ列挙方式）
- Strategy A＋Cハイブリッド型
- 状態駆動型明示列挙
- アプリ内部データ配列index型
- 優先度付き状態機械
- 複数グループ結合＋modal内包
- static固定配列（画面遷移なし構成に限定）
- native focus based（`.section.active [tabindex="0"]`等）

#### 19.22.10 input／activation／side effectの境界（Phase25最終アーキテクチャ）

Phase25で確立した最終アーキテクチャとして、以下の4層の責務境界を明記する。

- **helper6**：lifecycle・timer・current index・highlight・activation・stop・cleanup・refreshという共通契約（16章）
- **input adapter**（helper6外）：Space／Enter／Tab／Shift+Tab／touch tap・hold／pointerdown／capture click横取り／gamepad／dwell・gaze等
- **activation adapter**（helper6外）：native `click()`／app固有関数直接呼び出し／fake event合成／候補タイプ別分岐／click後focus補正／range操作等
- **side effect**（helper6外）：TTS／speechSynthesis／mp3／決定音／celebrate・bigCelebrate等の演出／toast／progress bar／focus・scrollIntoView／localStorage／richEditor／MutationObserver／modal・Focus Trap・Escape focus return等

**これら4層を無理にhelper6へ統合しない。** 各層をhelper6の外側のapp固有adapter／既存コードとして維持することが、21アプリという構造的多様性の大きい対象群でRolloutを完遂できた中心的な設計判断である。

#### 19.22.11 common chrome方針（最終）

18.14節が定める「両パターン容認」方針は、21アプリ全件のRollout実績によっても最終的に成立することを確認した。common chromeを**候補に含むアプリ**（register-app・kyou-no-kiroku・bosai-app・nazori-app等）と**含まないアプリ**（katakana-app・janken-app・timetable-app・shiritori2・cup_game・sugoroku-app・Group D 2アプリ等）の両方が実在し、いずれも正常設計として成立した。**「common chromeを必ず含める」「必ず除外する」という一律規定は行わない。** 新規アプリでは、いずれかを明示的に決定することを必須とする（19.22.14節チェックリストへ反映）。

#### 19.22.12 apps-data.jsonタグ不一致（記録のみ、Non-blocker）

19.16節が記録した不一致を、21アプリ最終確定版に基づき再確認する。`apps-data.json`の「スイッチ」タグは21件だが、実際のSwitch Scan Rollout対象21件とは構成が3件異なる。

- **タグはあるがRollout対象外**（自動走査candidate／activation機構を持たない、または同名の別機能）：`tokei-app`（未使用の`scanActive`変数のみ残存）・`mogura-tataki`（scan関連コードなし）・`tyushi`（`startScan`/`scanTimer`はゲーム内の視覚的パルスリング表示専用タイマーであり、候補配列・activation処理を持たない同名の別機能）
- **タグはないがRollout対象**：`timetable-app`・`yomikaki-app`・`gaze-keyboard`

**本v1.8でも`apps-data.json`は変更しない。** この訂正の反映要否は、利用者向けA11y表記としての正確性を踏まえ、引き続き別Phaseで判断する（Version2検討事項10番）。**この不一致はPhase25 Closeを妨げないNon-blockerとして扱う。**

#### 19.22.13 CI/CD知見

Phase25 Rollout中に観測された、GitHub Actions／Pagesに関する既知の挙動を記録する。いずれも機能上の未解決問題ではなく、正常なCI/CD挙動またはAPI表示上の一時的なラグである。

- `pages build and deployment`がcancelledとなり、直後の関連runが成功する挙動（GitHub Pages側の同時実行制御による正常な仕様）
- pushのたびに`generate` workflowが`sitemap.xml`のlastmodのみを更新する自動生成commitを追加することがある（想定内の副作用）
- Actions API上の`pages build and deployment`run一覧における`head_sha`表示が、実際のデプロイ対象commitと一時的にずれて見えることがある（インデックス遅延と推測）

**最終確認では、GitHub Actions画面の表示のみで公開失敗と断定せず、HTTP応答＋production実挙動＋必要に応じてSHA256比較を優先する。**

#### 19.22.14 新規アプリ向けSwitch Scanチェックリスト

Phase25終了後に新規アプリへSwitch Scanを追加する際、設計時から適用すべき最終チェックリストとして整理する。

- [ ] helper6の6関数名（`buildScanItems`／`refreshSwitchScanItems`／`startSwitchScan`／`stopSwitchScan`／`activateCurrentScanItem`／`clearScanHighlight`）を採用する（global functionでもobject methodでも可）
- [ ] input adapterとhelper6本体を明確に分離し、helper6側にキー判定を持ち込まない
- [ ] scan専用keydownと汎用keydown（存在する場合）が同一activeElementを二重処理しないよう、経路を一本化する（19.22.4節）
- [ ] activation adapterは`element.click()`を原則としつつ、候補タイプ別分岐が必要な場合は明示的に許容する
- [ ] side effect（TTS／音／演出／localStorage／focus／scroll等）の実行順・タイミングを設計時から明文化する
- [ ] common chromeをcandidateへ含めるか除外するかを明示的に決定する（19.22.11節、両パターン容認・決定は必須）
- [ ] modal／panel使用時は候補scopeの切替（背景走査停止等）を設計する
- [ ] timerは`setInterval`／自己再帰`setTimeout`のいずれかを明確化し、start guard（多重起動防止）を必ず入れる
- [ ] delayed refresh（`setTimeout`等）は、予約時点だけでなく**発火時点でも状態を再確認する**（19.22.5節）
- [ ] dynamic DOM（動的生成candidate）はperTick再取得を基本とし、stale referenceが生じないことを確認する
- [ ] 「1 physical input = 1 activation」をSpace／Enter／click／touchそれぞれで実測する
- [ ] Switch Scan OFF後に残留状態（highlight・focus・timer）がないことを確認する
- [ ] activation後に表示state／内部state／保存state／次操作が同期していることを確認する（19.22.7節）
- [ ] Console Error 0・pageerror 0を確認する
- [ ] 375px／768px／desktopで横overflow 0を確認する
- [ ] production regression（candidate件数・順序、SHA256比較等）を実施してから公開する

#### 19.22.15 位置づけ

本節（19.22節）はPhase25 Switch Scan Rollout（Pilot4＋Group A7＋Group B6＋Group C2＋Group D2、計21アプリ）の**完了総括**である。16章（helper6 API）・18章（3 Pilot Review）・19.3節〜19.21節（配置方式・各Group実績）のいずれの既存記述も変更せず、それらの実装実績から得られた一般原則を整理・確定したものである。**Phase25で確立したのは「21アプリを同じ実装に揃えたこと」ではなく、共通の6責務を持ちながら各アプリ固有の入力・activation・副作用・UI構造を安全に保持できるSwitch Scan設計、である。**

---

## Version1.0採用事項（v1.8時点）

以下は、本仕様書で共通方針として採用する（**M**または**R**として本文中に明記した事項の一覧）。1〜17番はv1.0時点の採用事項、18〜22番はv1.1で追加した事項、23〜27番はv1.2で追加した事項、28〜38番はv1.3で追加した事項、39〜48番はv1.4で追加した事項、49〜53番はv1.5で追加した事項、54〜62番はv1.6で追加した事項、63〜72番はv1.7で追加した事項、73番以降はv1.8で追加した事項である。

1. Switch Scan対応済みアプリは、Spaceキーによる決定操作を実装する（2.1節M1・7.2節M1）。
2. Switch Scanのタイマーと通常のTab操作を競合させない（2.1節M2）。
3. Switch Scan動作中も共通A11yパネルの表示設定と共存できること（2.1節M3）。
4. 候補一覧は毎回動的に再取得することを推奨する（3.1節R1）。
5. 非表示・disabled・visibility:hidden・display:noneの要素を候補から除外することを推奨する（3.1節R2〜R5）。
6. 候補順はDOM出現順を原則とする（4.1節R1・R2）。
7. モーダル表示中は候補をモーダル内へ限定し、背景走査を停止することを、モーダルを持つアプリの条件付き要件とする（4.2節C1・9.1節C1・C2）。
8. モーダルが閉じたら候補を再構築し、走査位置を先頭へ戻す（9.1節M3）。
9. 共通chromeを走査候補に含めることを推奨する（5.2節R）。
10. 走査ハイライトclass名は、新規実装において`.scan-focus`を用いることを推奨する（6.1節R）。
11. ハイライトclassの付与・削除の確実な実施、複数class併用禁止（6.3節M・6.4節M1）。
12. 決定操作は対象要素への`click()`発火によって実現する（7.2節M2）。
13. 走査タイマー・ハイライトclass・専用イベントリスナーを停止処理で確実に解除し、タイマー参照をnullへ戻し、再開時の二重起動を防止する（8.1節M1〜M5）。
14. タッチデバイスでは短押しを決定操作として扱うことを推奨する（10.2節R1）。
15. 静的候補取得・複数ハイライトclass併用・第5の独自class名・重複Timerの新規実装を禁止する（13章）。
16. 横展開はPilot→Review→Rollout→Verificationの段階を踏み、一括適用しない（14章）。
17. Enterキーによる決定操作は推奨要件（R）とする。アプリ固有の明確な理由がある場合に限り、Enterへ別機能を割り当てる例外を認めるが、理由・検証結果の文書化と、他アプリへの無条件横展開の禁止を条件とする（7.2節R3・7.3節、Phase18.31-Eで確定）。
18. Switch Scanを「自動走査型」「Keyboard Activation対応」「対象外（scanという名称を使うが複数候補を走査しない実装）」の3種に区分し、本仕様書の適用対象を自動走査型に限定する（1.4節）。
19. apps-data.jsonの「スイッチ」関連表記21/29件は広義の集計であり、自動走査型の確定件数と同一視しない（1.5節）。
20. 候補取得は、明示marker方式（Strategy A）とネイティブ操作要素包括取得方式（Strategy B）のいずれも正式に認め、単一方式へ強制しない（3.3節）。
21. 共通helperの責務をlifecycle・timer・current index・highlight・activation・stop・cleanup・refreshに限定し、候補取得自体はapp側のadapter／callback／optionsで調整可能とする（16章）。
22. 横展開Pilotの推奨順序として、第1候補directions-app・第2候補matching-appを記録する。ただし固定的な実施順序ではなく推奨順とする（17章）。
23. 共通helper APIを`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`の6関数名で正式に確定する（16.5節、2 Pilot実装の実証に基づく）。
24. `stopSwitchScan`・`clearScanHighlight`・timer管理・index管理は共通helperへ昇格可能、`buildScanItems`（候補取得）は昇格不可でapp側adapterとして残すことを確定する（16.8節）。
25. `activateCurrentScanItem`の標準実装はDOM上のハイライトclassを直接クエリする方式（directions-app方式）を推奨する（16.6節3番、R）。
26. 共通helperの開始処理は自身で有効/無効を確認する自己防御型を推奨する（16.6節4番、R）。
27. helper／adapter／option／callback／stateの命名規則を確定する（16.7節）。
28. 6関数構造（16.5節）は3 Pilot（directions-app・matching-app・schedule-app）すべてで成立することを確定する。追加・削除すべき責務はない（18.3節）。
29. `buildScanItems`の内部実装（引数の有無・スコープ判定方法）はapp adapterの責務とし、単一シグネチャへ強制統一しない。共通契約は「現在走査可能なDOM要素配列を返す」戻り値の形のみとする（18.4節）。
30. 候補取得のStrategyへ、Strategy C（巨大な明示的CSSセレクタ列挙方式、okane-app実例）を正式に追加する（3.3節）。
31. `refreshMode`の選択肢を`snapshot`／`perTick`／`restartOnActivate`の3値へ拡張する（18.6節）。
32. `switchMode`（2値超のenum）は共通helperの必須stateとせず、app adapter側のoptionとして扱う（18.7節）。
33. `activateCurrentScanItem`の共通責務を「現在候補の決定処理を開始する」という結果ベースの定義へ抽象化する。ただし新規実装・Rollout対象では引き続きclick()発火を原則（M）とする（18.8節・7.2節M2）。
34. schedule-appの`toggleCheck()`直接呼び出しを、7.3節7番の例外として正式に記録する（18.9節）。
35. `onActivate`／`onAdvance`／`onSelect`という3つのcallback候補を記録する。単スイッチ型はadvance/selectを`onActivate`へ統合してよく、2スイッチ型は`onAdvance`／`onSelect`を分離できる設計を許容する（18.10節・18.11節）。
36. `highlightClass`をhelper optionとして正式化する（既定値`.scan-focus`、app側で上書き可能）（18.13節）。
37. common chromeを走査候補に含めることを推奨（R）としつつ、app特性に応じてadapter／optionとして除外を選択できることを明記する（18.14節）。
38. 共通helperは特定のscopeモデル（screen／modal／tab）へ依存しないことを明確化する（18.15節）。
39. 共通helperの配置方式として、方式C（各アプリHTML内保持）を当面の正式方式として採用する。方式A（generate.js注入）・方式B（独立共通JS）は本v1.4では採用しない（19.3節・19.4節）。
40. Strategy Cを実際にPilot実装（okane-app、Phase25-J）し、SCAN_SELECTORを変更せず6関数構造へ責務分離できることを実証した（19.2節）。
41. 動的listener着脱（8.1節M3）をokane-app Pilotで実証し、`start→stop→start`で二重登録が発生しないことを確認した（19.2節）。
42. 共通化する対象は「コードの物理的共有」ではなく「6関数の名称・責務・API契約・M/R要件・option/callback概念・Pilot手順」という契約レベルであることを明確化する（19.5節）。
43. 残り17アプリのRolloutをGroup A（低リスク7件）／Group B（highlightClass違い6件）／Group C（scope/特殊事情2件）／Group D（native focus 2件）へ分類する（19.9節）。
44. Rolloutの最初の候補として`katakana-app`を提案する（19.10節）。
45. kimochi-board・gaze-keyboardを通常Rolloutと分離し、個別評価の対象とする（19.11節）。
46. bosai-app・native focus系（hiragana-learn・suji-manabou）をRollout時に個別の軽量検証が必要な対象として記録する（19.12節・19.13節）。
47. 第5Pilotは本v1.4時点では不要と判定する（19.14節）。
48. 将来の方式A/Bへの移行条件を明記する（19.7節）。
49. katakana-appのSwitch Scan候補取得（`buildScanItems`）はStrategy B（ネイティブ操作要素包括取得方式）の実例であることを、Group A Rollout第1波の実装事実により確定する。19.2節「Strategy B実例0件」の記述を訂正する（19.17.1節）。
50. katakana-appのhighlight方式はネイティブ`element.focus()`＋`body.scan-mode`スコープのCSS `:focus`であり、`.scan-focus`クラスは使用しないことを、Rollout実装事実により確定する。19.9節のGroup A分類における「`.scan-focus`使用」という前提はkatakana-appに関して誤りであったことを記録する（19.17.2節）。
51. Group Aの分類（19.9節）は個々のアプリの実装詳細を保証しないPhase25-I軽量inventoryに基づく一次スクリーニングであることを明確化する。katakana-appはGroup Aへ留め置くが、highlightClass optionの適用にはGroup D相当のnative focus対応が必要になりうる旨を注記する（19.17.3節）。
52. 21アプリinventory（Phase25-I）は一次スクリーニングであり、Rollout Pilot実装の着手前には各アプリの直接コード確認（候補取得関数・Strategy分類・scope・refreshMode・timer・state・highlight class等）を必須のステップとすることを明記する（19.17.4節）。
53. 本節（19.17節）の訂正はGroup A Rollout第1波（katakana-app、Phase25-M／M2）という実際のRollout実装から得られた事実に基づくものであり、配置方式そのもの（19.3節・19.4節・19.14節）の決定には影響しないことを明記する（19.17.5節）。
54. Group A（katakana-app・register-app・janken-app・timetable-app・shiritori2・cup_game・kyou-no-kiroku）のSwitch Scan Rolloutが全件完了したことを記録する（19.18.2節）。
55. Strategy B実例が複数（katakana-app・janken-app）、Strategy C実例が複数（okane-app・register-app）確認されたこと、およびA/B/Cのいずれにも該当しない状態駆動型（shiritori2）・配列index型（cup_game）・A＋Cハイブリッド型（kyou-no-kiroku）が実在することを記録する。Strategy A/B/C分類は典型パターンの整理であり排他的分類ではないことを明確化する（19.18.3節）。
56. `buildScanItems()`はDOM queryを必須としないことを、cup_game実績（アプリ内部データ配列index型）により確定する（19.18.4節）。
57. 1/2スイッチ（automatic scan／manual advance-select）のadapter実装実例がshiritori2・cup_gameで複数確認され、helper6へadvance関数を追加せずadapter責務として維持できるという方針が再確認されたことを記録する（19.18.5節）。
58. setTimeoutチェーン方式の2例目（kyou-no-kiroku、bosai-appに次ぐ）を記録し、setInterval型と同様の既存timer意味論の保持が必要であることを明記する（19.18.6節）。
59. restartOnActivateの非対称パターン（決定操作直後もhighlightを残し`stopSwitchScan()`を呼ばない）実例をkyou-no-kirokuで記録する（19.18.7節）。
60. `focus()`・`scrollIntoView()`・TTS・progress bar・highlight保持・設定パネルscope切替という副作用パターンの実例を集約する（19.18.8節）。
61. common chromeを含むアプリ・含まないアプリの両方が実在することをGroup A完了実績により再確認する（19.18.9節）。
62. Rollout標準手順（Inventory→直接コード確認→helper6設計→比較計画→実装→比較→統合→production確認）を正式化し、高難度対象では調査・設計Phaseと実装Phaseの分離が有効であったことを記録する（19.18.11節）。
63. Group B（yomikaki-app・bosai-app・ongaku-app・time-timer・sugoroku-app・nazori-app）のSwitch Scan Rolloutが全件完了したことを記録する（19.19.2節）。
64. 「highlightClass違い」というGroup Bの分類名は実装の構造的差異（object state方式・1/2スイッチadapter・Tab第3入力経路・fake event activation・優先度付き状態機械・動的once clickリスナー）を十分に表していなかったことを明確化する。Group名・グルーピング自体は変更しない（19.19.3節）。
65. bosai-appの共通chrome除外という5.2節3番の記述はPhase18.31-A時点の古いスナップショットであり、現行実装は共通chromeを含むことを実装事実により確定する（19.19.4節・5.2節/5.3節）。
66. time-timerのclick後条件付き`focus()`フォールバック実例により、`activateCurrentScanItem()`の実装が単純な`click()`発火だけとは限らないことを確定する（19.19.5節・19.19.10節）。
67. ongaku-appのfake event activation・候補タイプ別activation分岐（sound-buttonとcommon chromeで異なるactivation手段）の実例を記録する（19.19.6節・19.19.10節）。
68. sugoroku-appの候補生成は「8分岐」ではなく優先度付き9分岐（最初に一致した分岐のみ採用）であることを、実コード直接確認により確定する（19.19.7節）。
69. Group B Rollout前調査により、利用者向けの実害がある既存不具合3件（ongaku-app・sugoroku-app・nazori-app）が発見・修正されたことを記録する。「利用者へ実害のある既存不具合は、helper6 Rolloutと混在させず、独立したPhaseで先に修正する」ことを正式な推奨事項（R）とする（19.19.9節・19.19.13節）。
70. `activateCurrentScanItem()`の実装手段はnative click・app固有関数直接呼び出し・fake event・候補タイプ別分岐・click後focus補正・既存direct click経路への委譲のいずれも許容し、重要なのは既存の利用者向けactivation意味論の保持であることを整理する（19.19.10節）。
71. helper6外に残すapp固有input adapterの実例（Space/Enter advance、Tab/Shift+Tab、touch tap/hold、pointerdown、capture click横取り、画面任意位置タップ）を集約し、helper7等の新規共通関数を追加しない既存方針を再確認する（19.19.11節）。
72. Rollout標準手順へ「main版実ブラウザ確認」「既存不具合判定」「（該当時のみ）独立した不具合修正Phase」の3工程を明示的に追加し、12工程の手順として正式化する（19.19.13節）。
73. Group C（kimochi-board・gaze-keyboard）のSwitch Scan Rolloutが全件完了したことを記録する（19.20.2節）。
74. gaze-keyboardのフレーズ／AACカード／予測変換の決定操作がrichEditorへ反映されない既存不具合を、Rolloutに先行して独立に修正したことを記録する（19.20.5節）。
75. kimochi-boardの「switchScan設定OFFでも自動走査アニメーションが動作し続ける」という既存の仕様差異が、Rollout前調査で修正されたことを記録する（19.20.2節、Version2検討事項旧9番は本改訂で解決済みとして削除）。
76. Group D（hiragana-learn・suji-manabou）のSwitch Scan Rolloutが全件完了したことを記録する（19.21.2節）。
77. `clearScanHighlight()`の最終契約を「そのアプリにおけるSwitch Scanの視覚的highlight状態を解除する責務」という結果ベースの定義へ確定する。native focus方式ではこれが`body.scan-mode`除去等のクラス操作のみを意味し、`document.activeElement`のblur()を伴わない場合があることを明記する（19.21.3節・19.22.3節）。
78. Group D Rollout前調査により、Space/Enter二重activation・OFF後delayed focus jumpという構造的に同一の既存不具合が2アプリで発見・修正されたことを記録する（19.21.4節）。
79. helper6は既存実装を全面置換するAPIではなく、thin wrapper（既存関数への薄い委譲）として実装してよいことを最終方針として確定する（19.22.3節）。
80. helper6導入時に既存関数名（legacy alias）の削除を必須としないことを最終方針として確定する（19.22.3節）。
81. 二重activationを防ぐ設計原則（scan専用keydownと汎用keydownの経路確認、必要な場合のみ`stopImmediatePropagation()`適用）を一般原則として整理する。全アプリへの機械的な一律適用は求めない（19.22.4節）。
82. 非同期delayed callbackは、予約時点だけでなく発火時点でも状態（`scanMode`等）を再確認するという一般原則を確定する（19.22.5節）。
83. Rollout前既存不具合修正procedure（12工程、19.19.13節）を、Group C・Dでも一貫して有効に機能した最終手順として正式確定する（19.22.6節）。
84. 後発の内部状態管理機構（richEditor等）が存在するアプリでは、activation可否だけでなくactivation後のstate同期を確認するという一般原則を記録する（19.22.7節）。
85. 21アプリ全件（Pilot4・GroupA7・GroupB6・GroupC2・GroupD2）のhelper6実装・main統合・production確認が完了したことを正式に記録し、**Phase25 Switch Scan Rolloutの完了を宣言する**（19.22.2節）。
86. common chromeを候補に含む／含まないの両パターンが21アプリ全件の実績によっても最終的に成立することを再確認し、新規アプリでは明示的な決定を必須とする（19.22.11節）。
87. apps-data.jsonの「スイッチ」タグ21件と実装対象21件の構成差（3件）を最終確認する。本v1.8でもapps-data.jsonは変更せず、Phase25 Closeを妨げないNon-blockerとして扱う（19.22.12節）。
88. 新規アプリ向けSwitch Scan最終チェックリストを整理する（19.22.14節）。

## Version2検討事項

以下は、本仕様書では意図的に対象外・未決定としており、Version2以降で検討する。

1. bosai-appの「Enter＝次の候補へ送り」について、7.3節の例外条件（理由・検証結果の文書化）に基づく正式な記録を行う（7.3節5番、Phase18.31-E時点で未実施）
2. タッチの長押し「次へ送り」機能を全アプリへ広げるか、短押し/長押しの閾値統一（10.2節U2・U3）
3. 視線入力とSwitch Scanの統合方式の一般化（11章）。kimochi-boardは通常Rolloutと分離した独立Pilot候補として記録済みだが、本v1.8でも対象・時期は確定しない（18.17節・19.11節）
4. 走査対象へのARIA状態更新（`aria-current`等）の追加（12章）
5. 共通chromeを走査候補に含めた場合の走査体験（1周の所要時間等）への影響（5.3節）。schedule-appの「除外」という実例が複数得られたが、含める場合の体験影響自体は引き続き未検証
6. 共通chromeの候補内での優先順位（先頭／末尾配置の統一基準）（5.3節）
7. 既存アプリのハイライトclass名を`.scan-focus`へ遡って統一するかどうか（6.1節）
8. Scanning Group（グループ走査）、Auto/Manual Scan切り替え、Switch Interface／Bluetooth Switch固有対応（15章）。schedule-appの1switch/2switchはAuto/Manual切り替えの実例だが、15章記載の「グループ走査」等は引き続き未検証
9. apps-data.json上の「スイッチ」関連表記21件と、実装確認済みのRollout対象21件は総数が一致するが具体的な構成が3件異なる（1.5節・19.16節・19.22.12節）。この訂正をapps-data.json自体へ反映するかどうかは、利用者向けA11y表記としての正確性を踏まえ別Phaseで判断する。Phase25 Closeを妨げないNon-blockerとして扱う
10. 将来の方式A/B移行条件（19.7節）が満たされた際の、具体的な注入・配信設計そのもの（本文書は移行「条件」のみを定義し、条件充足後の実装設計は対象外）

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-05 | 初版。**未承認ドラフト**。Phase18.31-Aの調査結果（kimochi-board・matching-app・directions-app・bosai-appの4アプリ、コードレビューのみ）を反映。候補生成・候補順・共通chrome・ハイライト・決定操作・停止処理・モーダル・タッチの各項目についてM/R/C/U分類を行い、Version1.0採用事項とVersion2検討事項を整理した。視線入力・ARIA状態更新は対象外とし、Version2以降の検討事項とした。 |
| v1.0 | 2026-08-05 | 追記（Phase18.31-D）。**引き続き未承認ドラフト**。Version番号は変更していない。8.1節へ最低要件（M）2件を追加: タイマー参照を`clearInterval`後に`null`へ戻すこと、Switch Scan再開時に既存タイマーを確実に停止してから新規タイマーを作成し二重起動を防ぐこと。Version1.0採用事項13番の参照節番号（8.1節M1〜M3→M1〜M5）を更新した。他章は変更していない。 |
| v1.0 | 2026-08-05 | 追記（Phase18.31-E）。**引き続き未承認ドラフト**。Version番号は変更していない。7.3節「未決定（U）」を「アプリ固有の例外（A／C）」へ改め、Enterキーの位置付けを確定した: Space＝必須要件（M、7.2節M1）、Enter＝推奨要件（R、7.2節R3新設）、アプリ固有の理由がある場合はEnterへ別機能を割り当てる例外を認めるが理由・検証結果の文書化と無条件横展開の禁止を条件とする（7.3節）。matching-appのSpace／Enter両対応は7.2節R3準拠と確認した。bosai-appの既存例外（Enter＝次の候補へ送り）は本Phaseでは変更せず、正式な文書化を後続Phaseの検討事項とした（Version2検討事項1番）。7.1節の比較表・Version1.0採用事項（17番追加）・Version2検討事項（1番差し替え）を整合させた。他章は変更していない。 |
| v1.1 | 2026-08-08 | **承認済みへ移行**（Phase25-Bで確定。根拠: Phase25-Aによる15アプリ規模の追加サンプリング監査）。1.4節「Switch Scanの区分」を新設し、自動走査型・Keyboard Activation対応・対象外（scanという名称を使うが複数候補を走査しない実装）を区別。tyushiは対象外に該当すると明記。1.5節を新設し、apps-data.json上の「スイッチ」関連表記21/29件が広義の集計であり自動走査型の確定件数ではないことを明記（mogura-tataki等、区分未確認のアプリの存在を記録）。3.2節へ4アプリの実証範囲を超える推測をしない旨を追記。3.3節を新設し、候補取得の2戦略（Strategy A：明示marker方式／Strategy B：ネイティブ操作要素包括取得方式）を正式に容認。6.1節へ追加サンプリングで確認した実装差異（time-timerの`.scannable`+`.scan-focused`併用、sugoroku-appの`.shi`独自体系、hiragana-learn等のネイティブfocus依存）を追記し、確定数値を推測で断定しない方針を明記（なお「8方式」という記述は本文書ではなく`docs/donomana-site-renewal-roadmap-v2.md`側の表現であり、本文書は元々4アプリの実証範囲に限定した記述だった）。10章・11章へv1.1確認の短い追記（長押し機能は引き続きM化しない、視線入力の共通仕様化は本v1.1の範囲外）。16章「共通helper設計原則」を新設し、共通化する責務（lifecycle/timer/current index/highlight/activation/stop/cleanup/refresh）と、候補取得はapp側のadapter/callback/optionsに委ねる方針を明記。17章「Pilot方針」を新設し、第1候補directions-app・第2候補matching-appとその選定理由を記録。Version1.0採用事項へ18〜22番を追加。Version2検討事項へ10番（21アプリ全件inventoryの確定）を追加。既存のM/R/C/U/A分類・Version1.0時点の1〜17番・7章のEnter例外方針は変更していない。 |
| v1.2 | 2026-08-08 | **API確定版**（Phase25-Eで確定。根拠: Phase25-C〔directions-app Pilot〕・Phase25-D〔matching-app Pilot〕の2実装比較。コード変更は伴わない設計Phase）。16.3節を拡充し、adapter側（アプリ固有）に残る責務を6項目で確定。16.5節を新設し、共通helper APIを`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`の6関数名で正式に確定（2 Pilotとも同一関数名で実装できることを実証済み）。16.6節を新設し、2 Pilot比較で判明した3つの実装フォーク（候補取得シグネチャ・候補再取得タイミング snapshot／perTick・activate実装方式）を記録し、いずれも既存Pilotのコード変更を要求しないことを明記。16.7節を新設し、helper/adapter/option/callback/stateの命名規則を確定。16.8節を新設し、stop/clear/activate/timer管理/index管理は昇格可能、候補取得は昇格不可という評価を確定。17章を「Pilot方針・実施結果」へ改題し、第1・第2Pilotの実施結果（完了）を反映、17.5節「第3Pilot方針」を新設。Version1.0採用事項へ23〜27番を追加。Version2検討事項へ11〜14番（候補取得シグネチャ確定・refreshMode既定値確定・helper配置方式確定・第3Pilot対象選定）を追加。既存のM/R/C/U/A分類・Version1.0時点の1〜22番・directions-app/matching-appの実装コードは変更していない。 |
| v1.3 | 2026-08-08 | **3 Pilot Review確定版**（Phase25-Hで確定。根拠: Phase25-C/C2〔directions-app〕・Phase25-D/E2〔matching-app〕・Phase25-F/G/G2〔schedule-app〕の3 Pilot実装比較。コード変更は伴わない設計Phase）。3.3節を訂正し、schedule-appの候補取得方式をv1.1時点の誤記載（Strategy Bの実例として記載）から正しい内容（`.v-item`単純classセレクタ、Strategy Bの実例ではなかった）へ修正。同節へStrategy C（巨大な明示的CSSセレクタ列挙方式、okane-app実例、Phase25-F確認）を新規追加。7.2節M2へschedule-appのclick()要件に関する確認済み事実（`toggleCheck()`直接呼び出し、候補要素自身のclickリスナーと等価であることをコード確認済み）を追記。7.3節へ7番目の例外として正式記録。17.1節を更新し3 Pilotとも実施済み・完了・公開統合済みへ更新。17.5節を更新し第3Pilotの実施結果を反映。18章「3 Pilot総括Review」を新設し、3 Pilot比較表（18.2節）、6関数構造の維持確認（18.3節）、`buildScanItems`契約の確定（18.4節）、candidate Strategy再整理（18.5節）、`refreshMode`の3値化（18.6節、`restartOnActivate`を新規命名）、`switchMode`のadapter option化（18.7節）、`activateCurrentScanItem`の結果ベース定義への抽象化（18.8節）、click()要件との整合確認（18.9節、コード確認に基づく）、callback設計（`onActivate`/`onAdvance`/`onSelect`、18.10節）、advance/select設計（18.11節）、state方針の維持（18.12節）、`highlightClass`のoption正式化（18.13節）、common chromeの両パターン容認（18.14節）、scopeモデル（screen/modal/tab）の明記（18.15節）、特殊入力の扱い（18.16節）、視線入力との分離維持（18.17節）、generate.js配置方式の評価（18.18節、未確定のまま）、第4Pilot必要性の評価（18.19節、対象未確定）、21アプリinventoryの実施時期（18.20節、配置方式決定直前の軽量調査と位置づけ）を新設。Version1.0採用事項へ28〜38番を追加。Version2検討事項を整理し、解決済み項目（旧11番buildScanItemsシグネチャ・旧14番第3Pilot選定）を削除、残存項目を1〜13番へ整理（新規12・13番として動的listener着脱・Strategy C実証を追加）。既存のM/R/C/U/A分類・Version1.0〜v1.2時点の1〜27番・3 Pilotの実装コードは変更していない。 |
| v1.4 | 2026-08-08 | **配置方式正式決定版**（Phase25-Lで確定。根拠: Phase25-J〔okane-app 第4Pilot、Strategy C・動的listener着脱の実証〕とPhase25-I〔21アプリ全対象軽量inventory〕。コード変更は伴わない設計Phase）。19章「配置方式正式決定」を新設し、4 PilotとinventoryのSummary（19.2節）、正式採用方式（方式C：各アプリHTML内保持、19.3節）とその理由（19.4節）、「共通化しない」という意味ではないことの明確化（コードは共有しないが6関数名称・責務・API契約・M/R要件・option/callback概念・Pilot手順という契約レベルは共通化する、19.5節）、適用期間（当面、19.6節）、将来の方式A/B移行条件（19.7節）、Rollout単位（19.8節）、残17アプリのGroup A〜D分類（19.9節）、最初のRollout候補`katakana-app`の提案（19.10節）、kimochi-board・gaze-keyboardの個別扱い（19.11節）、bosai-appの個別扱い（19.12節）、native focus系（hiragana-learn・suji-manabou）の個別扱い（19.13節）、第5Pilot不要の判定（19.14節）、判断確度「高」（19.15節）、apps-data.json整合の記録（19.16節、変更は別Phase）を新設。Version1.0採用事項へ39〜48番を追加。Version2検討事項を整理し、解決済み項目（旧11番配置方式確定・旧12番動的listener組み込み・旧13番Strategy C実証）を削除、残存項目を1〜12番へ整理（新規10〜12番としてapps-data.json構成差・移行条件充足後の実装設計・Group C/D個別検証の具体化を追加）。既存のM/R/C/U/A分類・Version1.0〜v1.3時点の1〜38番・4 Pilotの実装コードは変更していない。 |
| v1.5 | 2026-08-08 | **Rollout実装事実反映版**（Phase25-Nで確定。根拠: Group A Rollout第1波〔katakana-app〕の実装〔Phase25-M〕・統合公開確定〔Phase25-M2〕から得られた実装事実。コード変更は伴わない訂正Phase）。19.16節の直後へ19.17節「Rollout実装事実による訂正」を新設し、以下を記録した：katakana-appのSwitch Scan候補取得はStrategy Bの正式な実例であり19.2節「Strategy B実例0件」は誤りだったこと（19.17.1節）、katakana-appの実際のhighlight方式は`.scan-focus`ではなくネイティブ`element.focus()`＋`body.scan-mode`スコープのCSS `:focus`であり19.9節のGroup A分類の前提はkatakana-appに関して誤りだったこと（19.17.2節）、Group Aという分類名・グルーピング自体は維持しつつ「`.scan-focus`使用」という前提は個々のアプリごとの再確認が必要な仮説として扱うこと（19.17.3節）、21アプリinventory（Phase25-I）は一次スクリーニングでありRollout Pilot着手前の直接コード確認を必須ステップとすること（19.17.4節）、本節の訂正が配置方式そのもの（19.3節・19.4節・19.14節）の決定には影響しない実装事実に基づく訂正であること（19.17.5節）。あわせて3.3節のStrategy B「実例」欄へkatakana-appを追記、19.2節・19.9節へ該当箇所の訂正注記を追加。Version1.0採用事項へ49〜53番を追加。Version2検討事項へ13番（Group A残り6アプリのコード確認結果を踏まえたGroup A定義見直しの要否）を追加。**本改訂は新仕様の追加ではなく、既存の記述を実装事実へ合わせる訂正である。** helper API・Strategy種別・配置方式（19.3節）・Rollout手順（14章・19.8節）はいずれも変更していない。既存のM/R/C/U/A分類・Version1.0〜v1.4時点の1〜48番・5 Pilotおよびkatakana-app Rolloutの実装コードは変更していない。 |
| v1.6 | 2026-08-08 | **Group A Rollout完了実績反映版**（Phase25-Yで確定。根拠: Group A全7アプリ〔katakana-app・register-app・janken-app・timetable-app・shiritori2・cup_game・kyou-no-kiroku〕のRollout完了〔Phase25-M〜X〕から得られた実装事実。コード変更は伴わない実績記録Phase）。19.17節の直後へ19.18節「Group A Rollout完了実績」を新設し、以下を記録した：Group A 7アプリの完了実績一覧（19.18.2節）、Strategy B実例2件・Strategy C実例2件・状態駆動型（shiritori2）・配列index型（cup_game）・A＋Cハイブリッド型（kyou-no-kiroku）というStrategy分類実績とA/B/C分類が排他的でない典型パターンの整理であることの明確化（19.18.3節）、`buildScanItems()`がDOM queryを必須としないことの確定（19.18.4節）、1/2スイッチadapter実装の複数実例とadvance/select分離がadapter責務のまま維持できることの再確認（19.18.5節）、setTimeoutチェーンの2例目〔kyou-no-kiroku〕（19.18.6節）、restartOnActivateの非対称パターン実例（19.18.7節）、`focus()`／`scrollIntoView()`／TTS／progress bar／highlight保持／設定パネルscope切替という副作用実例の集約（19.18.8節）、common chrome含有・非含有の両実績の再確認（19.18.9節）、Inventory一次スクリーニング方針のGroup A完了実績による再確認（19.18.10節、timetable-appの「400ms→150ms」誤記訂正実績を含む）、Rollout標準手順の正式化と高難度対象における調査・設計Phase／実装Phase分離の有効性の記録（19.18.11節）。あわせて3.3節のStrategy B／C「実例」欄へjanken-app・register-appを追記、Strategy A/B/Cが排他的分類ではない旨の補足を追加、19.9節へGroup A完了実績への参照注記を追加。Version1.0採用事項へ54〜62番を追加。Version2検討事項の13番（Group A残り6アプリの個別コード確認結果を踏まえたGroup A定義見直しの要否）は19.18.3節により回答済みのため削除した。**本改訂は新しい共通基盤・helper API・Strategy種別・配置方式の追加ではなく、Group A Rollout完了という実装実績の記録・補足である。** helper6 API（16章）・配置方式（19.3節）・Rollout手順の骨格（14章・19.8節）はいずれも変更していない。既存のM/R/C/U/A分類・Version1.0〜v1.5時点の1〜53番・Group A 7アプリの実装コードは変更していない。 |
| v1.7 | 2026-08-12 | **Group B Rollout完了実績反映版**（Phase25-APで確定。根拠: Group B全6アプリ〔yomikaki-app・bosai-app・ongaku-app・time-timer・sugoroku-app・nazori-app〕のRollout完了、および同過程で発見・修正した利用者向け既存不具合3件〔ongaku-app・sugoroku-app・nazori-app〕の実装事実。コード変更は伴わない実績記録Phase）。19.18節の直後へ19.19節「Group B Rollout完了実績」を新設し、以下を記録した：Group B 6アプリの完了実績一覧（19.19.2節）、「highlightClass違い」という分類名がobject state方式・1/2スイッチadapter・Tab第3入力経路・fake event activation・優先度付き状態機械・動的once clickリスナーという実装の構造的多様性を十分表していなかったことの明確化（19.19.3節、Group名自体は変更せず）、bosai-app（common chrome含有への訂正、19.19.4節）・time-timer（条件付きfocus()フォールバック、19.19.5節）・ongaku-app（fake event・候補タイプ別activation分岐、19.19.6節）・sugoroku-app（「8分岐」ではなく優先度付き9分岐であることの確定、19.19.7節）・nazori-app（direct click決定方式への統合、19.19.8節）の各アプリ実績、Rollout前調査で発見・修正した利用者向け既存不具合3件からの運用上の教訓（19.19.9節）、`activateCurrentScanItem()`が単純click()発火に限らないことのactivation adapter整理（19.19.10節）、helper7を追加しないinput adapter整理（19.19.11節）、副作用保持の追加実例集約（19.19.12節）、Rollout標準手順への「main版実ブラウザ確認」「既存不具合判定」「独立した不具合修正Phase」の明示的追加と正式化（19.19.13節）。あわせて5.2節・5.3節へbosai-appのcommon chrome記述に関する訂正注記を追加、19.9節へGroup B完了実績への参照注記を追加。Version1.0採用事項へ63〜72番を追加。Version2検討事項は、Group B実績により完全に回答済みとなった項目が確認できなかったため変更していない。**本改訂は新しい共通基盤・helper API・Strategy種別・配置方式の追加ではなく、Group B Rollout完了という実装実績、および利用者向け既存不具合の発見・修正実績の記録・補足である。** helper6 API（16章）・配置方式（19.3節）・Rollout手順の骨格（14章・19.8節・19.18.11節）・「利害のある既存不具合はRolloutと分離して先に修正する」というPhase25-AG/AK/AN以降で確立した運用（19.19.13節で正式化）はいずれも新規導入ではなく既存実践の記録である。既存のM/R/C/U/A分類・Version1.0〜v1.6時点の1〜62番・Group B 6アプリの実装コードは変更していない。 |
| v1.8 | 2026-08-12 | **Group C・D Rollout完了実績反映・Phase25 Rollout完了総括版**（Phase25-BHで確定。根拠: Group C全2アプリ〔kimochi-board・gaze-keyboard〕・Group D全2アプリ〔hiragana-learn・suji-manabou〕のRollout完了、同過程で発見・修正した利用者向け既存不具合3件〔gaze-keyboard・hiragana-learn・suji-manabou〕の実装事実、およびPhase25対象21アプリ全件の横断Inventory〔Phase25-BG〕。コード変更は伴わない実績記録・総括Phase）。19.19節の直後へ19.20節「Group C Rollout完了実績」・19.21節「Group D Rollout完了実績」・19.22節「Phase25 Switch Scan Rollout完了総括」を新設した。19.20節はkimochi-board（gaze排他・static candidate・candidate type別activation、switchScan OFF時の自動走査アニメーション停止不具合の修正実績）・gaze-keyboard（複数グループ結合scope・modal優先buildScanItems()、フレーズ/AAC/予測変換がrichEditorへ反映されない既存不具合の独立修正実績）を記録する（19.20.2節から19.20.5節）。19.21節はhiragana-learn・suji-manabouの完了実績、および`clearScanHighlight()`の最終契約を「そのアプリにおけるSwitch Scanの視覚的highlight状態を解除する責務」という結果ベースの定義へ確定する内容（native focus方式では`document.activeElement`のblur()を伴わない場合がある）、Space/Enter二重activation・OFF後delayed focus jumpという構造的に同一の既存不具合2件の独立修正実績を記録する（19.21.2節から19.21.4節）。19.22節はPhase25 Switch Scan Rollout（Pilot4・Group A7・Group B6・Group C2・Group D2、計21アプリ）の完了を正式に記録した上で、helper6運用原則（thin wrapper許容・legacy alias維持を必須化しない、19.22.3節）、二重activation設計原則（19.22.4節）、delayed callback最終原則（19.22.5節）、Rollout前既存不具合修正procedureの正式確定（19.22.6節）、gaze-keyboard richEditor教訓の一般化（19.22.7節）、helper6方式・candidate strategy最終Inventory（19.22.8節・19.22.9節）、input／activation／side effect境界の最終アーキテクチャ（19.22.10節）、common chrome最終方針（19.22.11節）、apps-data.jsonタグ不一致の最終記録・Non-blocker扱い（19.22.12節）、CI/CD知見（19.22.13節）、新規アプリ向けSwitch Scan最終チェックリスト（19.22.14節）を整理した。Version1.0採用事項へ73から88番を追加。Version2検討事項を整理し、解決済み項目（旧9番kimochi-board OFF時アニメーション仕様差異・旧12番Group C/D個別検証項目の具体化）を削除、残存項目を1から10番へ整理。**本改訂は新しい共通基盤・helper API・Strategy種別・配置方式の追加ではなく、Group C・D Rollout完了という実装実績、利用者向け既存不具合の発見・修正実績、およびPhase25全体の総括・一般化である。** helper6 API（16章）・配置方式（19.3節）・Rollout手順の骨格（14章・19.8節・19.18.11節・19.19.13節）はいずれも変更していない。既存のM/R/C/U/A分類・Version1.0からv1.7時点の1から72番・Group C・D 4アプリの実装コードは変更していない。 |

---

*本文書v1.8は2026-08-12に承認済みである。共通Switch Scan実装の基準として運用を継続する。M/R/C/U分類・Version1.0採用事項（v1.8時点）・Version2検討事項は、今後の改訂の中で更新されうる。Phase25 Switch Scan Rollout（Pilot4・Group A7・Group B6・Group C2・Group D2、計21アプリ）は本v1.8をもって完了実績の記録を終えている（19.22節）。*
