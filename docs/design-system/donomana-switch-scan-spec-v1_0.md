# どのまな 共通Switch Scan仕様書 v1.3

- 版: v1.3（**承認済み**）
- 発行: 2026年8月（v1.0初版）／承認: 2026年8月8日（v1.1）／API確定: 2026年8月8日（v1.2）／3 Pilot Review確定: 2026年8月8日（v1.3）
- 作成日: 2026-08-05（v1.0起草）／改訂日: 2026-08-08（v1.1・v1.2・v1.3）
- 位置づけ: `donomana-design-system-v2_0.html`（共通デザインシステム Ver.2.1）を**上位方針とする実装詳細の補足文書**。Design Systemの内容を置き換えるものではない。`donomana-modal-accessibility-spec-v1_0.md`（モーダルアクセシビリティ仕様書 v1.1）13章「Switch Scan」・21章未決定事項12番「全アプリ共通のSwitch Scan候補抽出方式の統一」を引き継ぎ、Switch Scan単独の共通仕様として分離・詳細化する文書である。
- 根拠調査: Phase18.31-A「Switch Scan方式統一 調査」（kimochi-board.html・matching-app.html・directions-app.html・bosai-app.html の4アプリ・コードレビューのみ、コード変更なし）／v1.1改訂にあたり15アプリ規模の追加サンプリング監査を実施（1.4節・3.3節・6.1節参照）／v1.2は2つのPilot実装（directions-app・matching-app）の比較結果を根拠とする（16章）／v1.3は3つ目のPilot実装（schedule-app）を加えた3 Pilot比較の結果を根拠とする（18章）
- 起草: Phase18.31-B
- 承認: v1.1として2026-08-08承認済み。v1.2はPilot実装結果を反映したAPI確定版として同日承認。v1.3は3 Pilot（directions-app・matching-app・schedule-app）の実装事実に基づくReviewとして同日承認。
- 参照元: Phase18.31-A調査報告（本文書と同一セッション内で作成、4アプリの実装比較表を含む）

> **本文書v1.3は2026-08-08に承認済みである。** 共通Switch Scan実装の基準として運用を開始する。ただし本文書が定めるのは主に「lifecycle・timer・highlight・activation・stop・cleanup・refresh」等の共通契約（16章参照）であり、候補取得方式（3.3節）や既存アプリのハイライトclass名（6.1節）を単一方式へ強制するものではない。**本文書の承認のみを理由に、既存の稼働中コード（`generate.js`・各アプリのHTML/JS）を一括改修することは求めない。** 16章のhelper API・adapter設計、18章の3 Pilot Reviewは、既に完了したdirections-app・matching-app・schedule-appの3 Pilot実装（17章）の**事実に基づく**設計であり、いずれのPilotのコードへも変更を要求しない。段階的展開は第4Pilot以降で継続する。

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
- 実例: schedule-app.htmlの**モーダルFocus Trap**（Switch Scanとは別機能）が`querySelectorAll('button, input, select, textarea, a[href], [tabindex]')`という包括セレクタを用いている。**（v1.3訂正）** v1.1時点の本節はこのFocus Trap用セレクタをschedule-appのSwitch Scan候補取得方式として誤って記載していた。schedule-app Pilot（Phase25-G）でのコード確認の結果、Switch Scanの実際の候補取得（`buildScanItems()`）は`document.querySelectorAll('.v-item')`という単純なclassセレクタであり、Strategy Bの実例ではないことが判明した。正しい分類は18.4節を参照。

**Strategy C：巨大な明示的CSSセレクタ列挙方式（v1.3で追加）**

候補となりうる要素のclass名を、1つの長大なセレクタ文字列として全て明示的に列挙する方式。Strategy A（`.scannable`等の単一markerクラス）と異なり、対象ごとに個別のclass名を持つ既存要素群を、marker classを新設せずにそのまま束ねて候補とする。

- 長所: 既存要素へ新たなclass・属性を追加せずに済む。要素ごとの意味的なclass名（`.nav-btn`・`.tool-btn`等）を保ったまま候補集合を定義できる。
- 留意点: 新規要素を追加するたびに、このセレクタ文字列へ手動で追記しなければ候補に含まれない（Strategy A同様の「付与漏れ」リスクを、marker追加ではなくセレクタ文字列の保守という形で負う）。セレクタが長大化すると可読性・保守性が低下する。
- 実例: `okane-app.html`の`SCAN_SELECTOR`定数（`.nav-btn, .tool-btn, .diff-btn, .money-card, ...`等、約25クラスを列挙、Phase25-Fで確認）。

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

### 5.3 未決定（U）

- 除外方式の2アプリ（matching-app・bosai-app）を含める方式へ変更した場合の候補数増加が、既存の走査体験（1周にかかる時間等）へ与える影響
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

## Version1.0採用事項（v1.3時点）

以下は、本仕様書で共通方針として採用する（**M**または**R**として本文中に明記した事項の一覧）。1〜17番はv1.0時点の採用事項、18〜22番はv1.1で追加した事項、23〜27番はv1.2で追加した事項、28番以降はv1.3で追加した事項である。

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

## Version2検討事項

以下は、本仕様書では意図的に対象外・未決定としており、Version2以降で検討する。

1. bosai-appの「Enter＝次の候補へ送り」について、7.3節の例外条件（理由・検証結果の文書化）に基づく正式な記録を行う（7.3節5番、Phase18.31-E時点で未実施）
2. タッチの長押し「次へ送り」機能を全アプリへ広げるか、短押し/長押しの閾値統一（10.2節U2・U3）
3. 視線入力とSwitch Scanの統合方式の一般化（11章）。第4Pilot候補としてkimochi-boardが有力だが、本v1.3では対象を確定しない（18.17節・18.19節）
4. 走査対象へのARIA状態更新（`aria-current`等）の追加（12章）
5. 共通chromeを走査候補に含めた場合の走査体験（1周の所要時間等）への影響（5.3節）。schedule-appの「除外」という実例が1件得られたが（18.14節）、含める場合の体験影響自体は引き続き未検証
6. 共通chromeの候補内での優先順位（先頭／末尾配置の統一基準）（5.3節）
7. 既存アプリのハイライトclass名を`.scan-focus`へ遡って統一するかどうか（6.1節）
8. Scanning Group（グループ走査）、Auto/Manual Scan切り替え、Switch Interface／Bluetooth Switch固有対応（15章）。schedule-appの1switch/2switchはAuto/Manual切り替えの実例だが、15章記載の「グループ走査」等は引き続き未検証
9. kimochi-boardの「switchScan設定OFFでも自動走査アニメーション自体は動作し続ける」という他アプリと異なる仕様を、統一するか維持するか（3.2節・本節はPhase18.31-A調査報告8番でも指摘済みの論点）
10. apps-data.json上「スイッチ」関連表記を持つ21アプリ全件について、1.4節の区分（自動走査型／Keyboard Activation対応／対象外）に基づく詳細inventoryを確定する。**v1.3時点の位置づけ: 共通helperの配置方式（18.18節）を決定する直前の軽量調査Phaseとして実施する（18.20節）。全件詳細監査は不要、Phase25-F相当の軽量サンプリングで足りる見込み**
11. 共通helperの配置方式（A: generate.js注入／B: 独立共通スクリプト／C: 各アプリ内保持）を確定する。3 Pilotの実装（いずれもC方式）を踏まえ、adapter/option/callbackの輪郭は明確になったが、A/B方式への移行判断には至っていない（18.18節）
12. 動的listener着脱（8.1節M3の実例、okane-appで確認済みだがPilotでは未実証）の共通helperへの組み込み方（18.19節）
13. Strategy C（巨大セレクタ列挙）を実際にPilot実装した場合の共通helperとの整合検証（18.19節）

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

---

*本文書v1.3は2026-08-08に承認済みである。共通Switch Scan実装の基準として運用を開始する。M/R/C/U分類・Version1.0採用事項（v1.3時点）・Version2検討事項は、今後のPilot・Review結果を踏まえた改訂の中で更新されうる。*
