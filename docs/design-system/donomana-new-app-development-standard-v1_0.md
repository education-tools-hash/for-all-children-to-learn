# どのまな 新規アプリ開発標準仕様書 v1.1

- 版: v1.1
- 発行: 2026-08-12（v1.0）／改訂: 2026-08-13（v1.1）
- 起草根拠: Phase16〜Phase26（既存29アプリの横断調査・修正・共通化）、Phase26-A〜C7（新規アプリkurabeyou-app「おおきい？ちいさい？くらべよう」のゼロからの開発・production公開）に加え、v1.1ではPhase26-D（既存アプリ「かたちをあわせよう」のPointer Eventsドラッグ実装・非矩形shape描画の実効ストローク幅修正・実機Rendered Validation運用）およびPhase26-E（本書自体の改訂）で得られた実装事実
- 位置づけ: **新規アプリを最初からどのまな標準品質で設計・実装・検証・公開するための統合実行仕様。** 既存の各個別仕様書（1章参照）を置き換えるものではなく、「新規アプリを作るときに、どの既存仕様をどう適用するか」を束ねる上位の実行仕様として機能する。既存アプリの通常改善（Release Policyは48章）にも同様に適用される。
- 承認: 本v1.1は文書化Phase（Phase26-E）の成果物としてv1.0を改訂する。既存の承認済み仕様書（Design System v2.1、モーダルアクセシビリティ仕様書v1.1、Switch Scan仕様書v1.8、保存基盤仕様書v2.0、開発ルールVer.1.0）の内容を変更・上書きするものではない。

> **本文書の目的は、単なる品質チェックリストの追加ではない。** Phase16〜26で発見・修正した不具合クラスを新規アプリへ再導入しないこと、そして共通品質についての判断を毎回ゼロからやり直す時間を減らし、アプリ固有の教育内容・教材設計へ開発時間を集中できるようにすることが目的である。品質と速度を対立させない。標準化によって品質を守りながら開発速度を上げる。

---

## 改訂履歴

| 版 | 日付 | 主な変更 |
|---|---|---|
| v1.0 | 2026-08-12 | 初版。Phase16〜26およびPhase26-A〜C7（kurabeyou-appのゼロからの新規開発）で得られた実装事実に基づき、新規アプリ開発の統合実行仕様として策定 |
| v1.1 | 2026-08-13 | Phase26-D（既存アプリ改善の実運用）で得られた知見を反映。48章「Release Policy」（新規公開のApproval Gateと既存アプリ改善のContinuous Releaseの正式区分）、49章「Drag / Pointer Events Standard」を新設。44章「更新履歴」をsemantic category rule・利用者向け表現ルールへ全面改訂。17章へCanonical State / Transient Interaction Stateの区別と複数ステップ教材の明示的stateを追加。27章へ非矩形shapeのRendered Validationを追加。13・22・23・30・31・36・42・46章へ各種運用知見を追加。旧48〜57章を50〜59章へ整理番号し、v1.0に存在した内部参照の不整合（15章／3章／62章への誤参照）を修正した |

---

## 0. 今後の開発フローにおける本書の使い方

```
要件定義 → 標準仕様適用 → アプリ固有部分実装 → 標準自動検証 → production確認
```

新規アプリの初回production公開には48章のRelease Approval Gateが適用される（User ReviewとExplicit Approvalを要する）。既存アプリの通常改善は、十分なValidation PASS後はContinuous Release可能（48章）。

新規アプリを作る前に55章のStarter Checklistを、公開直前に56章のPre-Production Checklistを確認する。本文中の各要件は **REQUIRED（必須）／CONDITIONAL（該当時必須）／OPTIONAL（任意）** に分類してある（53章に一覧化）。「できれば」で済ませる曖昧な項目を減らすことを意図している。

---

## 1. 関連文書と本書の位置づけ

本書は既存仕様書を要約・複製しない。以下は「どの文書が何を正本とするか」の地図であり、内容が必要な箇所では各章から個別に参照する。

| 文書 | 内部版 | 状態 | 正本とする範囲 |
|---|---|---|---|
| `donomana-design-system-v2_0.html`（ファイル名はv2_0だが内部版はVer.2.1） | Ver.2.1 | **承認済み・最上位** | 理念、色・spacing・typography数値、button/toggle/panel等のコンポーネント方針、モーダル禁止方針（§7.5）とPINロック例外（§7.6.3） |
| `donomana-dev-rules-v1.0-revised.md` | Ver.1.0 | **承認済み** | 技術スタック制約、レイアウト基本値、Git/worktree運用、Claude Code運用ルール。新規アプリにも既存アプリと同様に適用される（同文書4行目に明記） |
| `donomana-modal-accessibility-spec-v1_0.md`（ファイル名はv1_0だが内部版はv1.1） | v1.1 | **承認済み・main統合済み** | 既存モーダルのa11y実装詳細（focus trap・Escape・背景inert等）。**新規モーダル採用の可否そのものは決めない** — その判断は常にDesign System §7.5/§7.6.3が持つ |
| `docs/design-system/donomana-switch-scan-spec-v1_0.md`（ファイル名はv1_0だが内部版はv1.8） | v1.8 | **承認済み・21アプリRollout完了** | Switch Scanのhelper6契約、候補取得戦略、新規アプリ向けチェックリスト（同文書19.22.14節） |
| `donomana-storage-architecture-v2_0.md` | v2.0 | **確定（3アプリで実装済み）** | localStorage/IndexedDBのバージョニング・移行・バックアップ設計 |
| `donomana-typography-spec-v3_0.md` | v3.0（改訂4） | **未承認・レビュー待ち** | rem化トークンの提案のみ。**正式なTypography数値仕様はDesign System §1.3であり、本文書ではない** |
| `docs/donomana-site-renewal-roadmap-v2.md` | Ver.2.0 | 正本ロードマップ | サイト全体の優先順位（「何をやるか」）。本書は「新規アプリをどう作るか」を扱い、役割が異なる |

**注意（自己監査で確認済み）**: Typography v3.0は本文中に「本文書はドラフトである…generate.js・アプリHTML・既存Token値/Token名は本文書のみを理由に変更してはならない」と明記されている未承認文書である。本書はこれを正式標準として扱わない。新規アプリのtypographyはDesign System §1.3の数値と、generate.jsが実際に注入する`--dm-font-size-*`／`--dm-line-height-*`トークン（9章参照、これは既に稼働中のtoken定義であり提案ではない）に従う。

---

## 2. 基本原則

### 原則1: Accessibility is architecture, not retrofit.
アクセシビリティは公開後に追加する機能ではなく、設計開始時からアプリ構造へ組み込む。

### 原則2: Reuse before invention.
既存のDesign System・共通UI・helper・保存方式・検証方式を優先し、新規アプリ独自の共通基盤を作らない。

### 原則3: One canonical state.
表示・正誤判定・TTS・ログ・進捗等が同じ意味情報を扱う場合、同一canonical stateを参照する。同じ条件を複数箇所で独立計算しない。

### 原則4: Rendered behavior is the product.
内部stateが正しいだけではPASSにしない。利用者が実際に見るDOM・サイズ・位置・focus・表示内容・音声・操作結果を検証する。

### 原則5: One physical input = one activation.
touch / keyboard / Switch / gazeのどの経路でも、1操作が意図せず2回activationされない。

### 原則6: Progressive complexity.
発達初期段階を含む利用者を想定し、Levelや課題は単純→複雑へ段階化する。

### 原則7: User-facing simplicity.
内部機能が多くても、利用者へ見せるUIは必要なときだけ表示する。

### 原則8: Educational validity before layout convenience.
「一画面へ無理に収めること」より、教材として必要な刺激差・target size・視認性を優先する。

### 原則9: Test real combinations, not isolated components.
単体で動くことだけでなく、複数件・複数入力方式・切替・再renderなどの実利用シナリオを検証する。

### 原則10: New apps inherit past lessons by default.
Phase16以降で確立した品質基準は、明示的な理由がない限り新規アプリへ自動的に適用する。

### 原則11: Physical diversity, semantic unity.
touch・keyboard・Switch・gaze・dragなど入力方式ごとにphysical interactionが異なることは許容するが、到達すべき意味的ゴール（semantic goal）とcanonical stateの更新条件は入力方式間で共有する。入力方式の安全性・操作性を理由に非対称なinteractionを設けてよいが（例: gazeのみ同一shape再注視での選択解除を禁止する。13章）、正誤等の判定ロジックそのものを入力方式ごとに複製しない（49.2章）。

---

## 3. 新規アプリ開発フロー

| Stage | 内容 | Gate（次へ進む条件） |
|---|---|---|
| 0 | 既存アプリ重複調査 | 同種教材が既に存在しないか、存在する場合は差別化点を明記 |
| 1 | 教育的要件定義（4章） | 学習目標・Level構成・記録要否がすべて言語化されている |
| 2 | 入力方式・A11y設計（8〜14章、49章） | touch/keyboard/Switch/gaze/drag/TTSそれぞれの採用可否を明示決定 |
| 3 | 画面構成・state設計（5〜7章、17章） | canonical question state・canonical/transient stateの区別・Level UI配置・条件付きUIの表示条件が確定 |
| 4 | 保存・記録設計（21〜26章） | 保存方式・記録項目・CSV要否が確定 |
| 5 | 実装 | — |
| 6 | ローカル自動検証（46章） | local test minimum gate全PASS |
| 7 | Rendered Validation（27〜32章） | 実描画検証全PASS（非矩形shapeを持つ場合は27.1章も対象） |
| 8 | metadata / generate（39〜45章） | `node generate.js`後の差分が想定範囲内 |
| 9 | production公開（48章 Release Policy、50〜51章） | 新規アプリ初回公開はUser Review・Explicit Approval取得済み。既存アプリ改善はValidation PASSでContinuous Release可（48章） |
| 10 | production smoke test（50章） | 主要シナリオ・主要入力方式がproductionで正常動作 |
| 11 | 実授業前チェック（56章 Pre-Production Checklist） | 全項目チェック済み |

前Stageのblockerを残したまま次へ進まない。「調査中に重大な既存不具合を発見した場合は勝手に修正せず停止・報告する」という運用は、Switch Scan仕様書v1.8の19.22.6節が確立した「Rollout前既存不具合修正procedure」と同じ考え方であり、新規アプリ開発でも踏襲する。

---

## 4. 教育的要件定義（Stage 1・REQUIRED）

新規アプリ作成前に最低限、以下を定義する。

- 学習目標／対象となる学習内容
- Level構成（何段階か、各段階の目的）
- 最小操作単位（1回の操作で何が起きるか）
- 正誤の有無、feedbackの内容
- 観察可能な行動（正誤だけでなく、注視・見比べ・自発的選択など指導者が観察できる行動）
- 支援量（どこまで自動化し、どこを教員の判断に委ねるか）
- 学習記録の必要性、TTS必要性、animation必要性
- gaze適否、Switch適否

**「対象」の書き方**: 障害名・発達段階だけで対象を限定しない。**何を学びたい人に向く教材か** を中心に記述する。

> kurabeyou-appの実例（`apps-data.json`の`lesson.target`）:
> 「物の大小や長短の違いに気付き、比べたり順番に並べたりする学習に取り組む子ども。算数の『大きい・小さい』『長い・短い』などの学習に活用できます。」
>
> 障害名を主語にせず、学習内容を主語にしている。この書き方を新規アプリでも標準とする。

---

## 5. Level UI標準（REQUIRED・複数Levelを持つ教材）

Levelを頻繁に切り替える教材では、**設定画面の奥へLevel選択を置かない。** 学習画面上部など、授業中に教員が即時切り替えられる場所へ配置する。

- native `<button>`を使う
- `aria-pressed`で現在値を表現する。色だけに依存しない
- 設定内に重複Level UIを作らない。canonical level stateは1つ

**実装参照**: kurabeyou-app.htmlの`.level-btn[data-level]`（画面上部、`aria-pressed`で状態表現、`showLevel(n)`が単一のcanonical `level`変数を更新し、以降のUI表示・candidate取得・保存すべてがこの1変数を参照する）。concept切替（`.concept-btn`）・問題数切替（`.count-btn`）も同じ配置パターンに従う。

---

## 6. 条件付きUI（REQUIRED）

設定項目・操作項目は、**そのLevel/状態で意味があるときだけ表示する。**

非表示にする際は以下をすべて満たすこと（`hidden`属性を使う。opacity:0等の視覚的隠蔽のみで済ませない）。

- layout領域を持たない
- keyboard targetにならない
- Switch candidateにならない（`buildScanItems()`が`isVisibleEnabled`等でフィルタする設計にする）
- gaze targetにならない

**実装参照**: kurabeyou-app.htmlの問題数UI（`questionCountRow.hidden = !shouldShowQuestionCount()`、`shouldShowQuestionCount()`は`level === 3 || level === 4`のみtrueを返す）。Level1/2では問題数という概念自体が存在しないため、UIごと非表示にする。

---

## 7. 設定入口一本化（REQUIRED）

新規アプリ独自の設定入口を、共通設定ボタン（`donomanaA11yBtn`）とは別に増設しない。既存の`SETTINGS_PROXY`方式（generate.jsの`SETTINGS_PROXY`テーブルへ登録し、共通A11yパネル内の「このアプリの詳細設定を開く」ボタンへ統合）を使う。「設定ボタンが2つ存在する」状態を原則禁止とする。例外が必要なら理由を本書7章の運用に準じて記録する。

**実装参照**: `generate.js`の`SETTINGS_PROXY`オブジェクト（アプリファイル名→`{selector, label}`）と、`buildA11yPanelHTML(includeSR, appFilename)`が生成する`#donomanaSettingsProxy`ボタン。アプリ本来の設定ボタン（例: kurabeyou-appの`#settingsBtn`）はCSSで非表示化され、プロキシボタンのクリックが`.focus()+.click()`で元のボタンへ委譲される。フォーカスが`document.body`へ落ちた場合の100ms後fallback処理も既存実装済み（generate.js内のコメントにPhase16.44-C・Phase16.45-A/Bとして根拠が記録されている）。**新規アプリはこの仕組みをそのまま使い、独自の委譲処理を再実装しない。**

---

## 8. common chrome（REQUIRED）

最低限、以下をgenerate.jsの注入に任せる（手動で複製しない）。

- `donomanaA11yBtn` / `donomanaA11yPanel`
- `donomanaLockBtn`（画面ロック、該当時）
- `donomanaHomeBtn`
- `donomanaFsBtn`（全画面、該当時）

いずれもgenerate.js内のマーカーコメント（例: `<!-- a11y-panel: 自動挿入 (generate.js) -->` 〜 `<!-- /a11y-panel -->`）による差し替え方式で、`node generate.js`を再実行してもべき等に上書きされる。新規アプリのHTMLに独自の共通UIを手書きしない。

Switch Scanの候補に含める/含めないは、アプリ設計時に明示決定する（Switch Scan仕様書v1.8 §19.22.11「common chrome方針（最終）」— 含める/含めないの両パターンが21アプリの実績で成立しており、一律規定はない。ただし新規アプリでは必ずどちらかを明示的に決める）。

gazeでは原則、学習targetと共通chromeを分離する（13章参照）。

---

## 9. Design System参照

既存Design System（Ver.2.1）を正本として再利用する。新規アプリ独自のDesign Systemを作らない。

`generate.js`の`injectDesignTokensToAppHtmls`が全アプリの`<head>`へ以下のcanonical token定義を注入する（kurabeyou-app.htmlで実際に確認済みの値）。

```css
--dm-radius-sm:5px; --dm-radius-md:9px; --dm-radius-pill:999px; --dm-radius-circle:50%;
--dm-focus-width:3px; --dm-focus-color:#00A99D; --dm-focus-offset:2px;
--dm-color-primary:#00A99D; --dm-color-primary-dark:#00857B; --dm-color-accent:#F5A623;
--dm-color-info:#4A8FD9; --dm-color-danger:#EE6C7C; --dm-color-danger-text:#BA5461;
--dm-color-surface:#FFFFFF; --dm-color-soft:#F6F9FA; --dm-color-border:#EDF1F0;
--dm-color-ink:#3B4A54; --dm-color-sub:#5E6D78; --dm-color-bg:#FFFFFF;
--dm-space-1:4px 〜 --dm-space-9:64px;
--dm-duration-fast:150ms; --dm-duration-base:250ms; --dm-easing-standard:ease;
--dm-font-size-display:2rem; -heading:1.5rem; -subheading:1.25rem; -body:1.0625rem; -body-kid:1.5rem; -caption:0.8125rem;
--dm-line-height-heading:1.4; -body:1.7; -body-kid:1.8; -caption:1.6;
```

このtoken *定義* は全アプリへ自動注入されるが、CSSセレクタ側で実際に`var(--dm-*)`を使うかは各アプリの実装次第である（旧アプリの多くはまだ生のpx/色を使っている）。**新規アプリは定義を受け取るだけでなく、自アプリのCSS全体でこれらのtokenを使う。** kurabeyou-app.htmlをtoken使用の参照実装とする（`.concept-btn.active { background: var(--dm-color-primary); }`等）。

`--dm-color-danger`はDesign System本文（§7.6付近）では「将来のtoken候補、未実装」と記述されている箇所があるが、実装（generate.jsの注入内容・kurabeyou-app.html）は既にこのtokenを含んでいる。**本書は実装済みのtoken一覧（上記）を正とする。**

タップターゲット・spacing・typography等の数値規約はDesign System §1.3〜§1.6を参照。ボタンは影なし・grayed-out disabledを作らない（§5.1b — 利用不可の操作は隠すか、押せた上で説明的な応答を返す）。

---

## 10. 操作target（REQUIRED）

操作targetは原則44×44px以上（Design System記載の retrofit最低値。学習アプリの新規実装ではDesign System §1.5のideal値である60px、子ども向け画面では88pxを優先する）。touch / keyboard / Switch / gazeで同じ学習意味へ到達できること。入力方式によって学習内容そのものを変えない。

---

## 11. keyboard（REQUIRED）

native interactive elementを優先する。Tab / Enter / Space / Escape（必要時）を確認する。同一操作へ複数`keydown` handlerを安易に追加しない。新規アプリでは可能な限り入力経路を一本化し、二重activationを0にする。

Switch Scan仕様書v1.8 §19.22.4「二重activation設計原則」: scan専用`keydown`と汎用`keydown`が同一`activeElement`を二重処理しないよう、経路を一本化する。必要な場合のみ`stopImmediatePropagation()`等を使う（全アプリへの機械的な一律適用はしない）。

drag操作を併用する教材では、drag終了時のsynthetic clickやtouch/click合成によって1回の物理操作から複数のsemantic activationが発生しないよう特に注意する（49章）。

---

## 12. Switch Scan（原則REQUIRED）

**Switch Scan仕様書v1.8（`docs/design-system/donomana-switch-scan-spec-v1_0.md`）を正式参照する。** 本章はその要約ではなく、新規アプリが最初に読むべき最小限のポインタである。

新規アプリは最初からhelper6を採用する。

```
buildScanItems()
refreshSwitchScanItems()
startSwitchScan()
stopSwitchScan()
activateCurrentScanItem()
clearScanHighlight()
```

- helper6は既存実装を全面置換するAPIではない。thin wrapperでよい（v1.8 §19.22.3）
- `buildScanItems()`の内部実装（引数の有無・候補取得方式）はapp adapterの責務。契約は「現在走査可能なDOM要素の配列を返す」という戻り値の形のみ（v1.8 §16.5・§18.4）
- input adapter／activation adapter／side effectをhelper6本体に詰め込まない（v1.8 §19.22.10の4層責務境界）
- delayed callback（`setTimeout`等）は予約時だけでなく発火時にも`scanMode`を再確認する（v1.8 §19.22.5、34章でも再述）
- common chromeを候補に含めるか除外するかを明示的に決定する（両パターン容認、決定は必須）
- 1 physical input = 1 activationをSpace/Enter/click/touchそれぞれで実測する

**新規アプリ向けの完全なチェックリストは、Switch Scan仕様書v1.8 §19.22.14「新規アプリ向けSwitch Scanチェックリスト」をそのまま使う。** 本書での複製はしない（56章のPre-Production Checklistに要点のみ再掲する）。

---

## 13. gaze / dwell（CONDITIONAL）

視線入力は「付けられるから付ける」ではなく、教材との適合性を判断してから採用する。

採用する場合、以下を必須化する。

- 大きなtarget、target間隔
- dwell progress・dwell cancel・minimum dwell
- feedback中の停止
- gaze OFF時のcleanup、pending activationなし
- dwell progressionはmousemove依存だけにしない。静止注視でも進行できる`requestAnimationFrame`方式を採用する

**実装参照**: kurabeyou-app.htmlの`gazeTick()`は`requestAnimationFrame`ループで動作し、新しい`mousemove`イベントが来なくても停止しない（真に静止した注視でも完了できる設計。コード内コメントに理由が明記されている）。`DWELL_MS = 900`。

**Switch Scanとの関係**: 原則相互排他とする。kurabeyou-app.htmlの`setScanMode(on)`は、Switch Scanを ONにする際に`gazeEnabled = false`として強制的にgazeを無効化してから`startSwitchScan()`する実装になっている。

学習targetと教員向けUI/common chromeは、必要に応じて分離する。kurabeyou-app.htmlの`getGazeTargets()`は`settingsOpen`が真の間は常に`[]`を返し、記録UIを含む設定パネル全体を構造的にgaze対象外としている。

**dwell safetyチェックリスト（REQUIRED・gaze採用時）**:

- dwell duration（最小注視時間）を定義する
- dwell進行中に他要素へ視線が移った場合のtransition guard（進行中dwellのcancel）を用意する
- stale dwell防止: 切替前のtargetに対するdwellタイマーが、切替後のtargetのactivationへ持ち越されない
- targetが切り替わった場合、新しいtargetは常に完全なdwell期間を最初から必要とする設計を基本とする（前targetでの経過時間を引き継がない）
- 選択状態の誤解除を防ぐ: touch/keyboard/Switch Scanでは同一shapeの再選択によって選択解除できる設計でも、gazeでは同一shapeを見続けているだけで意図せず解除されないようにする（安全な非対称性の一例。原則11参照）

---

## 14. TTS（CONDITIONAL）

TTSだけに情報を依存しない。視覚feedbackと併用する。TTS OFFでも学習活動が成立することを原則とする（ただし音自体が学習内容の教材では例外を認める）。1 activationにつき意図した回数だけ発話し、重複speechを起こさない。

**実装参照**: kurabeyou-app.htmlの`speak(text)`は呼び出し毎に`window.speechSynthesis.cancel()`してから`speak()`する（多重発話防止）。共通A11yパネルの「🔊 選択・タップの読み上げ」は汎用の読み上げ機能で、`SR_SKIP_APPS`に登録済みのアプリ（自前で学習内容の読み上げを多用するアプリ、kurabeyou-app含む）では非表示になる。両者は別レイヤーであり、混同しない。

---

## 15. reduced motion（REQUIRED）

`prefers-reduced-motion`はgenerate.jsの`buildDesignTokensHTML()`が全アプリへ自動注入する（`animation-duration:0.01ms !important`等）。これに加えて、アプリ独自のanimation設定（例: kurabeyou-app.htmlの`animationEnabled`）がある場合はそれも尊重する。両者は独立したレイヤーであり、OSレベルの設定とアプリ内トグルの両方をコード側で確認する。

連続的な不要な色変化・点滅を避ける。色変更は問題切替等の意味のある単位で行う。

---

## 16. 色と学習ロジック（REQUIRED）

presentation属性とcorrectnessを分離する。色をランダム化する場合でも、color／value／correct answerを独立管理し、特定色が常に正解になるといった固定相関を作らない。色だけをcueにしない。high contrastでも意味が失われないようにする。

**実装参照**: kurabeyou-app.htmlの`KURABEYOU_PALETTE`はコメントで明記されている通り「presentation-onlyであり学習的意味を持たない。correctEl/correctOrderは常にvalueのみから導出される」。`pickDistinctColors(n)`が毎問シャッフルする一方、正誤判定ロジックは色を一切参照しない。

---

## 17. Canonical Question State（REQUIRED・問題型教材）

問題型教材では、**1問 = 1 canonical question object** を原則とする。

```js
{
  concept, prompt, values, positions,
  correctAnswer, correctOrder, colors, startTime
}
```

表示 → 判定 → TTS → ログ → 進捗、すべて同じstateを参照する。「表示用」と「判定用」で同じ条件を別々に再計算しない。

これはPhase26-C2で発見した約50%規模の不整合（表示ロジックと判定ロジックが同じ条件を別々に再実装し、食い違いを起こしていた）を再発させないための必須原則である（55章 Case Study A参照）。

**複数ステップ操作を持つ教材（二段階選択等）でも、canonical question objectは分割しない。** 「1段階目で選択済みの値」のような中間stateは、別変数として独立させず、同一のcanonical question objectのフィールド（例: `stepIndex`, `firstSelection`）として持たせる。ステップごとに別々のstateを持つと、Case A・Case Cと同じ「同じ意味情報を複数箇所で独立管理して食い違う」構造を再導入する。

### 17.1 Canonical State と Transient Interaction State の区別（REQUIRED・drag等の物理操作を持つ教材）

canonical question stateとは別軸で、教材のstateは以下の2種類に区別する。

| 種類 | 定義 | 例 |
|---|---|---|
| Canonical State | 教材として意味を持つ状態。表示・判定・TTS・ログ・進捗すべてがここを参照する | 現在の問題、選択済みitem、配置済み状態、誤答数、進捗 |
| Transient Interaction State | 物理操作の実行中にのみ必要な状態。教材の意味には関与しない | dragState、pointerId、startX/startY、drag proxy要素、hover中のtarget |

**原則**: 物理操作の途中ではcanonical stateを変更しない。意味的な操作が確定した時点（例: dropが有効と判定された瞬間）でのみcanonical stateを更新する。Transient Interaction Stateはcanonical stateと同じ変数・同じ保存先で管理しない。具体的な実装パターンは49章（Drag / Pointer Events Standard）を参照。

### 17.2 複数ステップ教材の明示的state（REQUIRED・複数ステップ操作を持つ教材）

「対象を選ぶ→場所を選ぶ」のような複数ステップ教材では、少なくとも以下の状態を明示的に設計する。

- 未選択（何も選ばれていない）
- 選択（1つ目の対象が選ばれている）
- 切替（選択中に別の対象へ選び直す）
- 選択解除（同一対象の再選択等による解除。入力方式間で対称にするか非対称にするかは原則11に従い判断する）
- 正解（意味的な操作が確定し、canonical stateが更新された状態）
- 誤答後保持（誤った組み合わせを試みた後も、学習継続に必要な状態が保持される）

これらはいずれも17.1のcanonical question objectのフィールドとして持たせ、独立したstateへ分割しない。

---

## 18. 問題数（CONDITIONAL）

正誤型・順序型等、終了条件を持つ教材では、問題数を明示的に選べるようにすることを検討する（例: 3/5/10）。問題数の概念が存在しないLevelではUIを表示しない（6章参照）。

---

## 19. 進捗（CONDITIONAL・問題数を持つ教材ではREQUIRED相当）

問題型教材では、現在位置と終了が視覚的に分かること（例: 「2/5」、progress bar）。内部stateと表示を同期させる。回答後の遅延処理中にLevel変更等があった場合、古いprogress更新を発火させない（34章 delayed callback原則を適用）。

---

## 20. 終了状態（REQUIRED・有限問題型教材）

有限問題型教材では、終了画面または明確な完了状態を用意する。「終わりなく問題が続く」ことをデフォルトにしない。もう一度／Level変更／記録確認等への導線を検討する。

---

## 21. 保存（REQUIRED）

保存方式はデータ量・用途に応じて選択する。

- 軽量な設定・ログ: `localStorage`
- 大容量・画像等: `IndexedDB`（`donomana-storage-architecture-v2_0.md` v2.0を参照。現時点で実装済みなのはschedule-app／matching-app／ongaku-appの3アプリのみで、他は設計方針のみ。新規アプリが大容量データを扱う場合は同文書§7.2の3バックアップパターン（schedule型／matching型／ongaku型、選定基準は§7.3）を踏まえて設計する）
- 破損JSONでもクラッシュしないこと（`JSON.parse`を`try/catch`で包み、失敗時は空配列/デフォルト値へfallbackする）

**実装参照**: kurabeyou-app.htmlの`readLog()`は`localStorage.getItem`→`JSON.parse`を`try/catch`で包み、失敗時は`log = []`にfallbackする。`LOG_MAX = 200`で無制限増殖を防止する。

設定保存と学習ログは必要に応じて分離する。schema変更時は旧データ読み込みを検証する。個人情報は保存しない。

---

## 22. 学習記録（CONDITIONAL・記録機能を持つ教材ではREQUIRED相当）

学習記録は単なる「正解率」だけにしない。教材に応じて以下を検討する。

日時／concept／Level／問題数／正答数／誤答数／完了・中断／反応時間／選択／誤答内容／再試行／inputMethod

**重要**: どこを間違えたかを後から確認できること。特別支援教育での観察・指導改善を補助する情報として設計する。個人情報は保存しない。

### 22.1 Record Session Grouping（REQUIRED・複数問／複数操作を伴う教材）

1操作 = 1 sessionとは限らない。教材として意味のある学習単位（例: 1回のLevel/問題数設定で開始してから終了・中断するまでの一連の問題）でsessionをgroupingする。CSVでは、集計されたsession単位の記録に加えて、必要に応じて操作単位（1問ごと・1回答ごと）の記録も保持してよい。session groupingの単位は教材の学習構造に従って決定し、実装上都合の良い単位（例: ページ読み込みごと）を安易に採用しない。

---

## 23. inputMethod記録（REQUIRED・記録機能を持つ教材）

実際に観測できた入力信号のみ記録する。物理SwitchがDOM上keyboard eventとして到達する場合、「Switchだったはず」と推測してswitchと記録しない。`unknown`／`keyboard`等、観測事実を優先する。

`drag`もclick/tap/keyboard/switch/gazeと同列の観測されたinputMethodとして記録してよい。ただし既存のrecords／CSV schemaへ新しいinputMethod値を追加する場合は、後方互換性（旧データにこの値が存在しないことを前提にした既存の集計・表示コードが壊れないか）を必ず確認する。

---

## 24. 記録詳細UIの1対1バインディング（REQUIRED・複数recordをrenderする記録UI）

Phase26-C6.2の教訓を正式化する。

複数recordをrenderする場合、**record data → detail button → aria-controls → detail panel** を1対1にする。

- 各detail panelに一意ID
- duplicate ID 0
- `aria-expanded`とvisibilityを同期させる
- ループ内event handlerが共有スコープの可変変数を参照して最後のrecordへ固定される構造を禁止する（`var`をループ内で直接使い、closure内から参照すると発生する）。必要なら専用関数へ値を引数として渡し、recordごとの独立scopeを保証する

**実装参照**: kurabeyou-app.htmlの`appendRecordDetailToggle(item, detailLines, index)`。detailBox/expandBtnをループ本体ではなく専用関数内で宣言し、`index`から`recordDetail<index>`という一意IDを生成して`aria-controls`と紐付ける（55章 Case Study C参照）。

---

## 25. 複数件UI Validation（REQUIRED・複数件をrenderするUI全般）

複数件をrenderするUIは、**1件で動作してもPASSにしない。** 最低5件以上を同時表示して検証する。

必須テスト:

- 1→1, 2→2, 3→3, 4→4, 5→5（フォワード順で各buttonが各recordへ正しく対応）
- スクランブル順（例: 5→2→4→1→3）
- open/close反復
- 再render後の対応関係
- 新規追加後の対応関係
- 削除→再作成後の対応関係

これは記録詳細UIに限らず、複数件をrenderするあらゆるUI（カード一覧・選択肢一覧等）に適用する一般原則である。

---

## 26. CSV（CONDITIONAL・記録機能を持つ教材では原則REQUIRED候補）

記録機能を持つ教材では、教育実践で利用価値がある場合、CSV書き出しを標準候補とする。

CSVには必要に応じて: 日時／concept／Level／問題／correct／expected／selected／attempt／response timeなど。

**UTF-8 BOM**を付与し、日本語Excel利用を考慮する。**CSV生成はDOM表示内容ではなく canonical log data（保存されているログそのもの）から生成する** ことを原則とする。

**実装参照**: kurabeyou-app.htmlの`buildRecordsCsvRows()`は`readLog()`（保存済みログ）から直接生成し、DOMを一切参照しない。`downloadRecordsCsv()`は`var UTF8_BOM = '﻿';`を先頭に付与する。

---

## 27. Rendered Stimulus Validation（REQUIRED・視覚的な違いが学習内容そのものである教材）

Phase26-C6.1の最重要教訓。**内部state validationと rendered stimulus validationを分離する。**

比較教材等では`getBoundingClientRect()`等を使い、利用者が実際に見るwidth／height／position／distanceを検証する。内部valueが違っていても、CSSで同じpxへ潰れていればFAILとする。

### 27.1 非矩形shapeのRendered Validation（REQUIRED・円・三角形等の非矩形targetを持つ教材）

Phase26-D8の教訓を正式化する。`clip-path` / `mask` / SVG `polygon`等を用いた非矩形shapeは、**CSS実装値が正しいこと（同じpx値・同じ%値を指定していること）だけでは、視覚的な一貫性を保証できない。** 特に、outer shapeとinner shapeを重ねてoutline（枠線）を表現する方式では、単純な`inset`による縮小と、outer shapeと同じ座標(%)のclip-pathを組み合わせると、辺の角度によって実効のストローク幅が変化する（垂直・水平に近い辺は正しい幅になるが、斜辺は角度に応じて細くなる）。

検証は必ず実描画（screenshot／`getBoundingClientRect()`／pixel解析等）で行い、CSS定義の数値一致で完了とみなさない。三角形等の多角形shapeでは、最低限**左辺・右辺・底辺（またはすべての辺）**のRendered strokeを個別に確認する。

不均一が見つかった場合の対処候補:

- geometric normal offset（各辺から真に垂直距離で内側オフセットしたpolygonを再計算する。edgeの角度に依存しないため多角形一般に適用できる）
- SVG `stroke-width` + `stroke-linejoin`（miter等）による表現への切り替え
- `mask`を用いた表現への切り替え
- polygon座標そのものの補正

**実装参照**: katachi-awase-app.htmlの三角形target（Phase26-D8）。円・四角のtargetは`inset:5px`による均等縮小で正しく機能するが、三角形は`inset:0`へ変更した上で、外側3辺それぞれから垂直距離5pxのミター結合offsetを計算したpolygon（`calc()`でpx単位のオフセットを直接指定）へ置き換えた。

### 27.2 Pixel-Level Validation（OPTIONAL・視覚的不具合の切り分けに有効な手段）

視覚的な不具合の原因切り分けが必要な場合、screenshotとpixel解析（色の連続run長の計測等）を利用してよい。ただし最終的なPASS基準は**数学的・ピクセル的な完全一致ではなく、通常利用時の視距離で視覚的な問題がないこと**である。ピクセル単位の完全一致そのものを目的化しない。

---

## 28. 刺激差基準（REQUIRED・比較学習教材）

比較学習では知覚可能な最小差を事前定義する。

**kurabeyou-appの現行基準（実コードで確認済みの値。他教材への機械的な絶対適用ではなく、教材ごとに閾値を定義することを標準とする）**:

- 2値比較（大小・長短）: ペア比 **1.6倍以上**（コード内コメント: 過去の1.33倍・1.47倍のペアは1.5倍のフロアを下回っており不十分だったため、Phase26-C6.1で1.6倍以上へ改定）
- 3値順序比較: 隣接比 **1.35倍以上**（過去の1.28倍パターンは「真ん中」が両端と区別しにくく不十分だったため改定）

**閾値を定義せず「見れば違うだろう」で済ませないことを標準とする。**

---

## 29. responsive刺激scale（REQUIRED・比較学習教材）

異なる刺激値をmobileで同一固定値へ`!important`上書きしない。

禁止例:
```css
.stimulus { --size: 130px !important; }
```
これにより内部値の差が消える可能性がある。複数刺激を縮小する場合は**同一scale factor**を適用し、比率を維持する。

---

## 30. responsive（REQUIRED）

新規アプリのRendered Validationでは、最低限以下のviewportを標準の確認セットとする。

- 375×667
- 375×812
- 390×844
- 768×1024
- desktop（1280×900目安）

各viewportで最低限、以下を確認する。

- horizontal overflow = 0
- 固定common chrome（8章）とapp header・学習領域の重なり = 0
- 学習targetの視認性（該当時、27.1章の非矩形shape検証を含む）
- focusの可視性（33章）
- 入力affordance（操作可能に見えること）

widthだけでなくheight制約も確認する。DOM/CSS inspectionのみで検証完了とみなさず、実描画（27章）で確認する。

---

## 31. mobile visual gate（REQUIRED）

新規アプリではproduction前に、最低1回はmobile viewportの代表画面をスクリーンショットまたは実ブラウザで目視確認する。自動テストだけで完了判定しない。特に: 刺激差／target重なり／header／fixed button／Level UI／progress／feedback／record UIを確認する。

確認対象のcommon chrome／app要素には、最低限以下を含める: home button／lock button（該当時）／fullscreen button（該当時）／app title／Level selector／設定入口／学習tray・学習コンテンツ。**375×667を最重要viewportとする**（固定common chromeとapp内要素が最も近接し、重なりが最も発生しやすいため）。

---

## 32. target sizeと一画面表示の優先順位（REQUIRED）

「スクロールを完全になくす」ために学習targetを過度に縮小しない。優先順位:

1. 教材として知覚可能
2. target size
3. 操作性
4. 一画面収容

必要なら縦スクロールを許容する。

---

## 33. focus（REQUIRED）

focus visibleを必須とする。既存の`--dm-focus-*`トークン（9章）を使う。アプリ独自focus表現を乱立させない。focusを勝手にblurしない。Switch Scan highlight解除とDOM focus解除を同一視しない（Switch Scan仕様書v1.8 §19.22.3: `clearScanHighlight()`の契約は「視覚的highlight状態の解除」であり、`document.activeElement`の`blur()`を必ずしも伴わない）。

**実装参照**: kurabeyou-app.htmlでは、detail toggle button自体は開閉後もfocusを保持し、Switch Scanモード時のみ`refreshSwitchScanItems()`による意図的なfocus再配置が発生する（この2つの経路は独立している）。

---

## 34. delayed callback（REQUIRED）

`setTimeout` / `requestAnimationFrame` / Promise callback等の非同期処理は、**予約時だけでなく実行時にも current stateを確認する。**

```js
setTimeout(() => {
  if (scanMode) updateScanTargets(); // 発火時点の再確認
}, 300);
```

Level変更／concept変更／scan OFF／gaze OFF／settings open／問題終了の後に、古いcallbackがUIを書き換えないことを確認する。これはSwitch Scan仕様書v1.8 §19.22.5が確立した一般原則そのものであり、Switch Scan以外の非同期処理にも同様に適用する。

---

## 35. timer（REQUIRED）

timerはstart guard必須。ON/OFF/ON反復で多重化しない。終了時、責務に応じて`clearInterval` / `cancelAnimationFrame` / `clearTimeout`を実行する。

---

## 36. dynamic candidate（REQUIRED・Switch Scan/条件付きUIを持つ教材）

Level変更／問題変更／modal・panel変更／record追加／条件付きUI変更の後にcandidateがstaleにならない。Switch Scanでは適切なタイミングで再取得する。

複数ステップ教材（17.2参照）では、ステップに応じてSwitch Scanの候補scopeを更新する（例: 1段階目候補→2段階目候補）。Switch Scanとgazeで候補scopeが異なることは許容される。入力方式ごとの安全性・操作性を理由として説明できることを条件とする（原則11）。

---

## 37. common A11y（REQUIRED）

最低限、以下を確認する: font scale／high contrast／focus visible／aria／keyboard／touch／Switch／gaze（採用時）／reduced motion／TTS（採用時）。

**共通A11yパネルの構成（実装済みの正準セット）**: `#donomanaSettingsProxy`（該当時）／表示モード（ハイコントラスト`[data-a11y-contrast="normal"|"hc"]`、`document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)'`）／文字の大きさ（`[data-a11y-font="normal"|"large"|"xlarge"]`、`document.body.style.zoom`で normal/125%/150%）／すべてリセット／読み上げON-OFF（`SR_SKIP_APPS`未登録時）。新規アプリはこのパネルをそのまま使い、独自の表示モード切替UIを重複実装しない。

---

## 38. modal（CONDITIONAL・原則使用しない）

Design System §7.5は**モーダル・ポップアップを原則禁止**とし、唯一の正式例外はPINロック（§7.6.3、8つの必須条件付き）である。新規modalを安易に追加しない。設定・確認・結果等は既存panel/inline UI（§7.6.1〜7.6.5: 側面パネル/ボトムシート型設定、`confirm()`の代替となるinline確認、ヘルプ、結果表示）で解決できるか先に検討する。正式例外のみ許可する。

既存モーダルのアクセシビリティ改善パターン（focus trap・Escape・背景inert等の実装詳細）が必要な場合は`donomana-modal-accessibility-spec-v1_0.md`（内部v1.1）を参照するが、**同文書は新規モーダルの採用可否そのものを決めない** — その判断は常にDesign System §7.5/§7.6.3が持つ。

---

## 39. metadata（REQUIRED）

新規アプリ追加時、`apps-data.json`へ以下を完全記入する: `id` / `filename` / `icon` / `iconColor` / `title` / `category` / `tags_display` / `summary` / `features[]` / `steps[]` / `lesson{}`（`target`/`goal`/`howto`/`tips`） / `a11y[]` / `badges[]` / `seoTitle` / `seoDescription` / `seoKeywords` / `sitemapPriority` / `isRecommend` / `isNew` / `releaseDate`（`"YYYY-MM-DD"`） / `releaseDetails[]`。

`releaseDate`/`releaseDetails`は44章の自動更新履歴生成（`generateChangelog()`）が直接消費する。空にしない。

---

## 40. app-details（REQUIRED）

`app-details/*-detail.html`は`generate.js`の`generateDetailHTML(app)`による自動生成を原則とする。手修正しない。

「対象」は障害名・発達段階だけで限定せず、学習内容中心に記述する（4章参照）。授業での活用が教員に理解できる内容にする。

---

## 41. app-intro（REQUIRED）

新規アプリ紹介が既存UI（`app-intro.html`）へ正しく追加されること（`node generate.js`実行で自動反映）。説明内容と実機能が一致していることを確認する。

---

## 42. index card（REQUIRED）

新規アプリカードが既存アプリと同じinteractionを持つこと。`index.html`の`.app-card`/`.card-preview`はhover/tapでmockup画像へ切り替わるCSS駆動のpreview機構を持つ（`.mockup-shown`クラスがtouchデバイス向けの等価挙動）。新規アプリだけpreviewが欠けないよう、mockup画像生成（`tools/make-mockups.py`）を実行する。

**mockup生成のscope（REQUIRED）**: mockup生成は可能な場合、対象app-idへ限定して実行する（全アプリ一括生成は、意図しないアプリのmockup差分を大量に発生させるリスクがある）。生成後は必ず`git diff --stat`で対象外アプリへの想定外差分がないか確認する。

---

## 43. sitemap（REQUIRED）

`generate.js`の`generateSitemap()`による自動生成を利用する。手編集しない。`lastmod`はgit履歴日付から算出されるため、内容が変化しない限り無駄なdiffは発生しない。

---

## 44. 更新履歴（REQUIRED）

更新履歴（`index.html`の「更新履歴」欄）は開発記録ではない。利用者へ、どのまなが継続的に改善されていること・どこが良くなったのか・安心して使い続けられることを伝える**ユーザー向け情報**として扱う。詳しすぎて読まれない記述と、短すぎて何も伝わらない記述の両方を避け、**簡潔性 × 具体性 × 安心感**を目標とする。

### 44.1 生成の仕組み

新規公開: `apps-data.json`の`releaseDate`/`releaseDetails`による自動生成方式を優先する（`generateChangelog()`が`autoEntries`として組み込む）。

既存アプリ修正: `generate.js`の`MANUAL_CHANGELOG`配列へ追記する。同日複数更新は日付ごとに1つのエントリーへまとめ、`details[]`内へ列挙する。同じ内容を重複掲載しない。**利用者向け変更のみ掲載し、内部refactorは原則掲載しない。**

### 44.2 1 calendar date = 1 visible entry

同じ日付の更新を複数の日付見出し・entryへ分割しない。同日更新は`generateChangelog()`が自動的に1つのvisible entryへ統合する（`MANUAL_CHANGELOG`側は日付ごとに1エントリー・`details[]`へ列挙する運用のまま維持する）。

### 44.3 1 app × 1 semantic change category = 1 item

**「1 app = 1 item」と機械的に記載しない。** 正式ルールは **1 app × 1 semantic change category = 1 item** である。

代表的なsemantic categoryは以下の4種:

- 新規公開
- 改善
- 重要な仕様変更
- 提供終了等の重要告知

同じアプリでも、新規公開と改善はcategoryが異なるため2項目に分けてよい（例:「かたちをあわせよう」を公開しました／「かたちをあわせよう」の図形の見やすさ、操作性を改善しました）。一方、同じcategory内（例:「改善」）で同じアプリに対する細かな修正が複数commit・複数Phaseにわたって発生しても、利用者から見て一まとまりの改善として理解できる内容は1つのitemへ統合する。「1 app = 必ず1行」ではない。

以下は件数として数えない: CSS変更数／JavaScript変更数／DOM変更数／commit数／Phase数／修正箇所数／テスト数。件数は常に**利用者から見た意味的な変更対象**を基準とする。

### 44.4 新規公開の記述形式

新規アプリ初回公開は原則として以下の形式とする。

> 「〇〇〇」を公開しました

機能説明を長く付加する必要はない。

### 44.5 改善の記述形式

既存アプリの改善は原則として以下の形式とする。

> 「〇〇〇」の△△△を改善しました

複数の改善をまとめる場合:

> 「〇〇〇」の△△△、□□□を改善しました

△△△には、利用者が理解できる体験ベースの言葉を使う。推奨語彙: 見やすさ／図形の見やすさ／文字の見やすさ／操作性／スマートフォンでの表示／タブレットでの表示／スイッチ操作／視線入力／キーボード操作／記録機能／読み上げ／設定画面／保存機能。実装方法ではなく、利用者が体験する部分を記述する。

以下の技術用語は原則としてユーザー向け更新履歴へ書かない: DOM／CSS／JavaScript／`clip-path`／Pointer Events／`localStorage`／API／Git／commit／Phase番号／internal function名。これらはGit履歴・Phase報告・開発文書（57章 Case Study等）へ記録する。

**GOOD**:

> 「かたちをあわせよう」の図形の見やすさ、操作性を改善しました
> 「おおきい？ちいさい？くらべよう」のスマートフォン表示、操作性を改善しました
> 「タイムタイマー」のスイッチ操作、記録機能を改善しました

**TOO VAGUE**（避ける。短いが、何が良くなったのか利用者に伝わらない）:

> 「かたちをあわせよう」を改善しました

**TOO DETAILED**（避ける。技術用語・実装詳細を含む）:

> 「かたちをあわせよう」の三角形ターゲットのclip-pathによる斜辺の線幅とPointer Eventsによるドラッグ処理を改善しました

### 44.6 同一アプリの改善統合

同じアプリの改善を、細かな修正ごとに行を増やさない。

避ける例:

> 「かたちをあわせよう」を公開しました
> 「かたちをあわせよう」の図形の見やすさを改善しました
> 「かたちをあわせよう」の操作性を改善しました
> 「かたちをあわせよう」の三角形を改善しました

統合する例:

> 「かたちをあわせよう」を公開しました
> 「かたちをあわせよう」の図形の見やすさ、操作性を改善しました

### 44.7 既存entryの意味的拡張（Existing Same-Day Entry Update）

同じ日付・同じアプリについて後から追加改善が発生した場合、原則として新しい行を追加するのではなく、**既存の改善項目を意味的に拡張できるか最初に確認する。**

例: 既存が「「〇〇〇」の図形の見やすさを改善しました」で、その後操作性も改善した場合、「「〇〇〇」の図形の見やすさ、操作性を改善しました」へ統合する。件数を増やさない。

### 44.8 Cognitive Load Rule

更新履歴はアクセシビリティの一部として扱う。

- 1文を短くする
- 一文一義を基本とする
- 不要な専門用語を使わない
- 同じアプリ名を何度も繰り返さない
- 修正箇所を細分化しすぎない
- 利用者が数秒で内容を理解できる粒度にする

ただし短さを優先するあまり「改善しました」だけの記述にしない（44.5のTOO VAGUE例を参照）。

### 44.9 Trust Principle

更新履歴には「継続して改善されているサービスである」ことを利用者へ伝える役割がある。詳しすぎて読まれない記述と、短すぎて何も伝わらない記述の両方を避ける。

### 44.10 既知のギャップ（自己監査で発見。Phase26-E時点では未修正）

`generateChangelog()`の集約処理は、`MANUAL_CHANGELOG`の`details[]`内でアプリ名を検出した行を、公開/改善のいずれであったかに応じて`「〇〇〇」を公開しました`／`「〇〇〇」を公開し、改善しました`／`「〇〇〇」を改善しました`／`「〇〇〇」を見やすく改善しました`という4種の定型文へ**置き換える**。この置き換えは、`details[]`に書かれた具体的な△△△（見やすさ・操作性等）の語を保持しない。

そのため、同日に新規公開と改善が重なったアプリは、`details[]`にどれだけ具体的な文言を書いても、実際の表示は「「〇〇〇」を公開し、改善しました」という44.5のTOO VAGUE相当の一般化された文言になる（例: 2026-08-12の「かたちをあわせよう」）。

これは複数アプリの更新履歴生成ロジック全体（`generate.js`の`generateChangelog()`）に影響する共通仕様であり、本v1.1改訂単独では変更しない（48.3章のSTOP条件「複数アプリへ影響する重要な共通仕様変更」に該当するため）。将来、`details[]`の具体的な文言を「公開し、改善しました」の後に保持する形（例:「「〇〇〇」を公開し、図形の見やすさ、操作性を改善しました」）へ拡張するかどうかは、別Phaseでの明示的な判断を要する。

---

## 45. generate.js（REQUIRED）

生成対象は`generate.js`で生成する。生成物（`app-details/*.html`、`index.html`のAPPS配列・更新履歴・SEO部、`app-intro.html`、`sitemap.xml`）を手作業で修正しない。`node generate.js`後、`git diff --stat`・`git diff`内容・`git diff --check`を確認する。想定外の大量差分があれば停止する。

---

## 46. local test minimum gate（REQUIRED）

新規アプリ共通最低Gate:

HTML/JS正常 ／ duplicate ID 0 ／ Console Error 0 ／ pageerror 0 ／ touch ／ keyboard ／ Switch ／ gaze（採用時） ／ drag（採用時） ／ TTS（採用時） ／ high contrast ／ font scale ／ reduced motion ／ responsive ／ localStorage・IndexedDB ／ record ／ CSV（採用時） ／ Level切替 ／ conditional UI ／ delayed callback ／ timer多重 ／ stale candidate ／ duplicate activation ／ rendered stimulus ／ overflow

### 46.1 Accessibility Validation Matrix（REQUIRED）

上記gate項目のうち入力方式・出力方式に関わる項目（touch／keyboard／Switch／gaze／drag／responsive／high contrast／records／CSV／duplicate ID／console error／pageerror）は、新規アプリが対応する入力方式に応じてvalidation matrixとして確認する。**すべての入力方式で同じ物理操作を再現する必要はない。同じ学習上のゴールへ到達できることを重視する**（原則11）。dragを実装する場合は49章のDrag / Pointer Events Standardに従い、hit-testingが他入力方式のsemantic activationと同じ判定へ合流することを確認する。

---

## 47. scenario test（REQUIRED）

単機能テストだけでなく、実利用シナリオを必須化する。

例: Level変更 → 問題回答 → concept変更 → 記録 → 設定 → Switch ON → gaze ON → reload

状態切替の組み合わせで壊れないことを確認する。

---

## 48. Release Policy（REQUIRED）

Phase26-D以降の実運用で確立した、production公開の正式な意思決定方針。

### 48.1 新規アプリの初回production公開

原則:

```
Implementation → Validation → User Review → Explicit Approval → Release
```

新規アプリの初回production公開には**Release Approval Gate**を適用する。46章のlocal test minimum gate・47章のscenario test・50〜51章のproduction verificationがすべてPASSした後も、**ユーザーによる明示的な承認**を得るまでproduction公開しない。3章Stage 9のGateと対応する。

### 48.2 既存アプリの通常改善

以下に該当し、十分なValidation PASS後は**Continuous Release**（Implementation → Validation → 問題なければmain統合 → push → Production Validationを、都度の承認待ちなしに連続実行してよい）可能とする。

- 不具合修正
- 視認性改善
- responsive修正
- accessibility改善
- 入力方式の非破壊的改善
- 軽微な操作性改善

これに該当する作業では、毎回「公開はまだ行っていません。ユーザー確認待ちです」で停止しない。

### 48.3 STOP条件（新規・既存共通）

以下に該当する場合、Continuous Releaseを行わず停止し、ユーザーの判断を仰ぐ。

- 重大な仕様変更
- 学習内容そのものの大幅変更
- 新しい学習概念の追加
- ユーザー判断が必要な設計分岐
- 広範囲・想定外の変更
- 複数アプリへ影響する重要な共通仕様変更

**実装参照**: Phase26-D8（既存アプリ「かたちをあわせよう」の三角形target視認性修正）はContinuous Releaseとして、Implementation→Validation→main統合→push→Production Validationまで承認待ちなしに実行された。一方、本書44.10で発見した`generateChangelog()`の集約ロジック変更は「複数アプリへ影響する重要な共通仕様変更」に該当するためSTOP条件を適用し、実装を行わずユーザーの判断を仰ぐ扱いとした。

---

## 49. Drag / Pointer Events Standard（CONDITIONAL・drag操作を実装する教材）

Phase26-D7〜D8で確立したdrag実装の標準パターン。

### 49.1 Pointer Events Drag Pattern

touch / mouse / penを統一するdrag実装では**Pointer Eventsを第一候補とする**。HTML5 Drag-and-Drop APIは、モバイル・タッチ教材では第一選択にしない。

基本パターン:

- `pointerdown`: canonical stateを変更しない（17.1参照）。Transient Interaction State（dragState・pointerId・startX/startY等）のみ初期化する
- `pointermove`: movement threshold超過後にdrag開始と判定する。閾値はPhase26-D7実績値の`8px`を既定候補とするが、固定標準ではなく教材特性に応じて概ね3〜10px程度の範囲で検討してよい
- `pointerup`: 有効dropが確定した場合のみ、既存のsemantic activation（49.2）へ合流する

### 49.2 Existing Semantic Logic Reuse

新しい入力方式ごとに正誤判定を複製しない。**Physical Inputは異なってよいが、Semantic Actionは共有する。** drag／tap／keyboard／Switch Scan／gazeは、可能な限り同一の意味的処理（例:`onTargetActivate()`のような単一関数）へ合流させる。原則11（Physical diversity, semantic unity）の具体的な実装パターンである。

### 49.3 Invalid Drop = Cancel

学習上意味のない場所へのdropは、原則として以下を満たす**cancel**として扱う。

- mistakeにしない
- progressを進めない
- canonical stateを変更しない

ただし、誤った場所への配置そのものを評価する教材（誤答を学習データとして記録する設計）は例外とする。

### 49.4 Rendered Hit Testing

drag target判定は、DOM index・配列順ではなく**実描画位置**を利用する方式を推奨する。代表例:

```js
document.elementFromPoint(x, y)
```
↓
```js
.closest(targetSelector)
```

overlay・pseudo-element・`pointer-events`との関係を必ず検証する（非矩形shapeのvisual層を追加・変更した場合でも、`.closest()`が正しいDOM要素へ到達できることを確認する。27.1参照）。

### 49.5 Drag Visual Feedback / Shadow 例外

Design Systemの原則（9章、常設装飾としてのshadow不使用）と、drag proxy等の**一時的interaction feedback**は区別する。drag中のproxy要素にshadow等の一時的な視覚強調を用いる場合、以下をすべて満たすことを条件とする。

- 一時的（drag操作中のみ表示され、drop後は残らない）
- 必要最小限
- 学習内容を邪魔しない
- 常設しない（通常表示のtarget/shapeには適用しない）

**実装参照**: katachi-awase-app.htmlの`.drag-proxy { transform: scale(1.08); box-shadow: 0 6px 16px rgba(0,0,0,.28); z-index: 1000; }`（Phase26-D7で実装・production稼働中）。drag中のみ生成されるproxy要素にのみ適用され、通常表示の`.shape-btn`/`.target-btn`には常設shadowを付与していない。

この例外を超えて常設shadowをDesign Systemへ追加するかどうかは新しいポリシー判断であり、本書は決定しない。

---

## 50. production verification（REQUIRED）

公開後: HTTP 200／可能な対象ではlocal・production SHA256比較／production smoke／Console・pageerror／mobile／主要入力方式／主要学習Level／記録／metadata／index／app-details。

## 51. productionを最終真実とする（REQUIRED）

Actions表示だけで完了判定しない。GitHub Actions画面のCI表示遅延（Switch Scan仕様書v1.8 §19.22.13に記録された既知挙動: `pages build and deployment`のcancelled表示、`head_sha`表示の一時的ズレ等）がある場合でも、production HTTP・実ファイル・SHA256・実挙動を確認する。ただしActionsの失敗を無視してよいという意味ではない。異常は必ず報告する。

---

## 52. Definition of Done

| カテゴリ | 内容 |
|---|---|
| A. 教育的妥当性 | [ ] 学習目標・Level構成・観察可能な行動が定義済み [ ] 対象記述が学習内容中心 |
| B. UI | [ ] Level UIが画面上部に配置 [ ] 条件付きUIが意味のある時だけ表示 [ ] 設定入口が1つ |
| C. Accessibility | [ ] common A11yパネル利用 [ ] high contrast/font scale/reduced motion確認済み |
| D. Input | [ ] touch/keyboard確認済み [ ] Switch helper6採用（該当時） [ ] gaze設計判断済み（該当時） [ ] drag採用時はPointer Events Patternに従いhit-testing確認済み（49章、該当時） |
| E. State | [ ] canonical question state採用 [ ] 表示/判定/TTS/ログ/進捗が同一state参照 [ ] canonical/transient interaction stateを区別済み（17.1、該当時） |
| F. 保存 | [ ] 保存方式選定済み [ ] 破損データでクラッシュしない |
| G. 記録 | [ ] 記録要否判断済み [ ] inputMethodが観測事実ベース [ ] session grouping単位が学習構造に沿っている（22.1、該当時） |
| H. Rendered Validation | [ ] rendered stimulus検証済み(該当時) [ ] 刺激差基準定義済み(該当時) [ ] 非矩形shapeのRendered stroke確認済み（27.1、該当時） |
| I. Responsive | [ ] 375×667/375×812/390×844/768×1024/desktop overflow 0 [ ] mobile visual gate実施 |
| J. Metadata | [ ] apps-data.json完全記入 [ ] releaseDate/releaseDetails記入 |
| K. CI/CD | [ ] generate.js実行済み [ ] diff想定内 |
| L. Production | [ ] HTTP 200 [ ] SHA256一致 [ ] production smoke test PASS |
| M. Documentation | [ ] MANUAL_CHANGELOG判断済み [ ] 例外があれば記録済み |
| N. Release | [ ] 新規アプリ初回公開はUser Review・Explicit Approval取得済み（48.1、該当時） [ ] 既存アプリ改善はValidation PASS確認済み（48.2） |
| O. 更新履歴 | [ ] MANUAL_CHANGELOGがsemantic category rule（44章）に沿っている [ ] 技術用語を含まない |

---

## 53. Required / Conditional / Optional 一覧

**REQUIRED**（全新規アプリに適用）: 教育的要件定義／条件付きUI／設定入口一本化／common chrome／Design System token使用／keyboard／reduced motion／保存（破損耐性）／inputMethod記録の観測ベース原則（記録機能がある場合）／記録詳細1:1バインディング（複数recordの場合）／複数件UI Validation（複数件を持つUIの場合）／responsive／mobile visual gate／focus visible／delayed callback二重確認／timer start guard／metadata完全記入／app-details/app-intro/index card/sitemap自動生成準拠／local test minimum gate／scenario test／production verification／productionを最終真実とする原則／Release Policy遵守（新規アプリはApproval Gate、既存アプリ改善はValidation PASS後Continuous Release可）／更新履歴のsemantic category rule遵守

**CONDITIONAL**（該当する教材のみ、該当時はREQUIRED相当）: Level UI標準（複数Level） ／ Switch Scan（原則REQUIRED、入力方式として採用する場合） ／ gaze/dwell（採用する場合） ／ TTS（採用する場合） ／ Drag / Pointer Events Standard（drag操作を実装する場合） ／ 色と学習ロジック分離（色を使う場合） ／ canonical question state（問題型教材） ／ 問題数・進捗（終了条件を持つ教材） ／ 終了状態（有限問題型教材） ／ 学習記録（記録機能を持つ教材） ／ CSV（記録機能を持つ教材では原則REQUIRED候補） ／ Rendered Stimulus Validation・刺激差基準・responsive刺激scale（視覚的な違いが学習内容そのものである比較教材） ／ 非矩形shapeのRendered Validation（円・三角形等のCSS非矩形shapeを持つ場合） ／ modal（原則不使用、PINロックのみ例外）

**OPTIONAL**: 独自のmascot/演出等、Design System上の「保留」領域に該当するもの。採用する場合も原則1〜11・Design System §1.6（色だけに依存しない）は必ず満たす。

---

## 54. Exception Rule

標準から外れる場合、以下を記録する。

- 何を外すか
- なぜ外すか
- 代替手段
- A11yへの影響
- 検証方法

「アプリ固有だから」だけでは例外理由にしない。

---

## 55. Starter Checklist

新規アプリを作る前に確認する最小セット。

```
[ ] 学習目標
[ ] 既存アプリとの重複調査
[ ] Level構成
[ ] canonical question state設計
[ ] canonical state / transient interaction stateの区別設計（17.1、該当時）
[ ] touch対応
[ ] keyboard対応
[ ] Switch Scan helper6採用可否（12章）
[ ] gaze採用可否（13章）
[ ] drag採用可否（49章）
[ ] 設定入口はSETTINGS_PROXY一本化
[ ] 記録要否
[ ] CSV要否
[ ] responsive確認範囲
[ ] apps-data.jsonメタデータ項目の洗い出し
```

---

## 56. Pre-Production Checklist

公開直前に確認する最小セット。

```
[ ] duplicate ID 0
[ ] Console Error 0
[ ] pageerror 0
[ ] 1 physical input = 1 activation
[ ] delayed callback残留なし
[ ] timer多重なし
[ ] stale candidateなし
[ ] rendered stimulus PASS（該当時）
[ ] 非矩形shapeのRendered stroke確認（27.1、該当時）
[ ] dragのRendered Hit Testing確認（49.4、該当時）
[ ] 375×667 visual gate
[ ] 複数record 5件以上で1:1対応確認（該当時）
[ ] CSV確認（該当時）
[ ] Switch Scan新規アプリ向けチェックリスト（Switch Scan仕様書v1.8 §19.22.14）全項目
[ ] metadata完全記入
[ ] 更新履歴がsemantic category ruleに沿っている（44章）
[ ] generate実行・diff確認
[ ] git diff --check
[ ] production smoke test
[ ] 新規アプリはRelease Approval Gate取得済み（48.1）
```

---

## 57. Case Study

**Case A — 表示/判定state二重計算 → 約50%問題不整合 → canonical state**
Phase26-C2で、問題の表示ロジックと正誤判定ロジックが同じ条件を別々に再計算しており、約半数規模で食い違いが発生した。1問=1 canonical question objectへ統合し、表示・判定・TTS・ログ・進捗すべてが同一オブジェクトを参照する設計へ修正した（17章）。

**Case B — mobile CSS !important → 内部値は正しいが実描画同サイズ → Rendered Stimulus Validation**
Phase26-C6.1で、mobile向けCSSが刺激サイズを`!important`で固定値へ上書きしており、内部の生成値は正しく異なっていても、実際に描画されるpxは同一だった。内部state検証だけでは検出できず、`getBoundingClientRect()`による実描画検証で発見した（27〜29章）。

**Case C — var closure共有 → 全「くわしく見る」が最後のrecord → 複数件1対1 Validation**
Phase26-C6.2で、記録一覧のループ内で`var`をそのまま使ってdetail button/panelを生成しており、全ボタンが最後にrenderされたrecordのpanelだけを開いた。専用関数へ値を引数として渡し、recordごとの独立scopeを保証する設計へ修正した（24〜25章）。

**Case D — 設定入口二重化 → 共通設定導線へ統合**
新規アプリ独自の設定ボタンと共通A11yパネルの設定ボタンが両方存在すると、利用者・教員が混乱する。SETTINGS_PROXY方式により、常に1つの入口へ統合する（7章）。

**Case E — 条件付きUI → 問題数は意味のあるLevelだけ表示**
問題数という概念が存在しないLevel（見て楽しむ・見比べるだけの段階）でも問題数UIが表示され続けると、意味不明な操作対象になる。`hidden`属性による構造的な非表示化で解決する（6章）。

**Case F — 非矩形shapeの実効ストローク幅不均一 → geometric normal offset**
Phase26-D8で、三角形targetの枠線がoutlineを2層構造（outer shape＋inset白抜きのinner shape）で表現していたところ、innerのclip-pathがouterと同じ%座標を単純に`inset`後のboxへ再適用していたため、斜辺の実効ストローク幅が底辺よりも視覚的に細くなっていた。CSS定義値の一致では検出できず、実描画のpixel解析で発見した。3辺それぞれから垂直距離で内側offsetした新しいpolygonへ置き換えて解決した（27.1章）。

**Case G — Pointer Eventsによるdrag実装 → canonical/transient state分離**
Phase26-D7で、touch/mouseを統一したdrag操作を追加する際、drag中の一時的な位置情報等をcanonical stateと分離しないまま実装すると、判定ロジックの複製や、drop未確定時点でのcanonical state汚染につながるリスクがあった。Transient Interaction Stateを別途定義し、意味的な操作確定時のみcanonical stateを更新する設計により、既存のtap/keyboard/Switch Scan/gazeの判定ロジックと合流させた（17.1、49章）。

**Case H — 更新履歴の自動集約が具体的な改善内容を一般化 → 既知のギャップとして記録**
Phase26-Eで本書自体を改訂する過程で、`generateChangelog()`の集約処理が、同日に新規公開と改善が重なったアプリについて、`MANUAL_CHANGELOG`の具体的な文言を保持せず「「〇〇〇」を公開し、改善しました」という一般化された定型文へ置き換えることを発見した。複数アプリへ影響する共通仕様変更に該当するため、本Phaseでは実装を行わず、既知のギャップとして記録するに留めた（44.10章）。

---

## 58. Candidate C 仮想適用レビュー

次に予定している「かたちをあわせよう」（形状マッチング教材、二段階選択を想定）を仮想対象として、本書のみで判断可能かをレビューした。**Candidate C自体はこのPhaseでは実装しない。**

| 観点 | 本書で判断可能か | 該当章 |
|---|---|---|
| Level構成 | 可 — 4章の要件定義プロセスに従い段階化 | 4, 5 |
| canonical state（形状・色・二段階選択の状態） | 可 — 1選択操作=1 canonical stateとして設計 | 17 |
| 二段階選択（形を選ぶ→置き場所を選ぶ等） | **要注意点**: 「1問=1 canonical question object」は単一選択型を想定した記述が主。二段階選択のような複数ステップ操作は、ステップ間の中間state（例: 「1段階目で選択済みの値」）も同一canonical objectのフィールドとして持たせ、2つの独立したstateにしないことを明記すべき。本書17章の原則自体は適用可能だが、複数ステップ操作の具体例が本文に無いため、実装時にCase Cと同様の「ステップごとに別々の変数を持つ」誤りを再発するリスクがある | 17（本文へ追記済み。17.1・17.2参照） |
| touch/keyboard | 可 — 10, 11章そのまま適用 | 10, 11 |
| Switch | 可 — 12章がSwitch Scan仕様書v1.8を直接参照するため、二段階選択特有のcandidate切替（1段階目候補→2段階目候補）もv1.8 §36 dynamic candidateの原則で対応可能 | 12, 36 |
| gaze | 可 — 13章の採用可否判断プロセスに従う | 13 |
| settings | 可 — 7章のSETTINGS_PROXY一本化がそのまま適用 | 7 |
| record | 可 — 22章、二段階選択の誤答内容（どちらの段階で誤ったか）も22章の「誤答内容」項目でカバー可能 | 22 |
| CSV | 可 — 26章のcanonical log data原則がそのまま適用 | 26 |
| responsive | 可 — 30章そのまま適用。ただし形状マッチングは配置間隔がkurabeyou-appより複雑になりうるため、32章「target sizeと一画面表示の優先順位」の判断が重要になる | 30, 32 |
| rendered stimulus | 可 — 形状の見た目上の区別が学習内容そのものである場合、27〜29章がそのまま適用対象になる | 27, 28, 29 |
| metadata | 可 — 39章そのまま適用 | 39 |
| production | 可 — 50, 51章そのまま適用 | 50, 51 |

**結論**: 大半の観点は本書のみで判断可能。唯一のギャップとして、17章（canonical question state）が単一選択型を暗黙の前提としており、二段階選択のような複数ステップ操作の扱いが本文に無い点を発見した。このレビューを踏まえ、17章へ「複数ステップ操作でもcanonical question objectを分割しない」という一文を本v1.0の時点で追記済みである（対応内容は59章の自己監査に記録）。

**Phase26-Eでの追記**: Candidate Cとして仮想レビューした「かたちをあわせよう」は、その後Phase26-A〜D8で実際に新規開発・production公開・複数回の改善（Pointer Eventsドラッグ、非矩形shapeの視認性修正等）を経た。実装を通じて、本レビュー時点では想定していなかった追加のギャップ（非矩形shapeのRendered Validation。27.1章・57章 Case F参照）が新たに発見され、本v1.1へ反映した。仮想適用レビューは実装前のギャップ発見に有効だが、実装後のRendered Validationでしか発見できない種類の問題（CSS値は正しいがRendered結果が不均一、等）は代替できないことが確認された。

---

## 59. 自己監査結果

### v1.0時点の自己監査（維持）

- Switch Scan仕様書v1.8との矛盾: なし。12章・33章・34章・56章はいずれもv1.8の既存決定（helper6契約、§19.22.3〜19.22.14）を直接参照し、内容を上書きしていない
- Design System（Ver.2.1）との矛盾: なし。9章のtoken一覧は実際に注入されているtoken値と一致させ、Design System本文がまだ「未実装」と記述している`--dm-color-danger`についても、実装が先行している事実を明記した（9章）
- 開発ルール（Ver.1.0）との矛盾: なし。開発ルールの色token例（`--color-primary`等）はDesign Systemの実際のtoken名と異なるため、本書9章では開発ルール側の名前を使わずDesign Systemの実装済みtoken名を正とした
- `generate.js`実装との矛盾: なし。8, 39〜45章の記述は`generate.js`の実際の関数（`SETTINGS_PROXY`、`buildA11yPanelHTML`、`generateChangelog`、`generateSitemap`、`generateDetailHTML`等）に基づく
- 現行kurabeyou-app実装との矛盾: なし。5〜7, 9, 12〜17, 21, 23〜29章はkurabeyou-app.htmlの実装を参照実装として明記している
- 存在しない共通機能を標準として書いていないか: 確認済み。TTSは「共通機能として全アプリ提供」ではなく「共通A11yパネルの汎用読み上げ + 各アプリ独自実装」という実態どおりに記述した（14章）。IndexedDBの共通実装は3アプリのみである実態を明記した（21章）
- 未承認Typography v3.0を正式標準として扱っていないか: 確認済み。1章で明示的に「未承認・レビュー待ち」と記載し、9章の数値はDesign System §1.3および実装済みtoken注入内容に基づく
- REQUIRED/CONDITIONAL/OPTIONALが現実的か: 確認済み。Switch Scanは「多くの新規アプリで採用が望ましいが全教材必須ではない」ため原則REQUIRED（CONDITIONAL寄り）、modalは「原則不使用」という性質上REQUIRED側ではなくCONDITIONAL（不採用がデフォルト）とした
- 同じ内容を複数節で不必要に重複していないか: 確認済み。Switch Scanの新規アプリ向けチェックリストは12章では参照のみとし、56章のPre-Production Checklistでは「該当文書を見る」という参照形にとどめ、全項目を複製していない
- Candidate C仮想適用レビュー（58章）で発見したギャップの対応: 17章が単一選択型を暗黙の前提としていた点を修正済み。「複数ステップ操作でもcanonical question objectを分割しない」という一文を17章へ追記した

### v1.1時点の自己監査（追加）

- v1.0の既存節との重複: 確認済み。Canonical/Transient State（17.1）はcanonical question state（17章）の拡張として同一章内に統合し、新規章を作らなかった。Gaze Dwell Safetyは既存13章内へ追加し、新規章を作らなかった。Switch Scan Scopeは既存36章（dynamic candidate）へ追加した。Mockup Generation Scopeは既存42章へ追加した。Accessibility Validation Matrixは既存46章へ追加した。新規に独立した章として追加したのはRelease Policy（48章）とDrag / Pointer Events Standard（49章）の2章のみであり、いずれも既存章に自然な統合先がなかった
- 「1 app = 1 item」という誤った機械的な書き方をしていないか: 確認済み。44.3で「1 app × 1 semantic change category = 1 item」を正式ルールとして明記し、新規公開と改善は別categoryとして2項目にできる旨も明記した
- Design System（Ver.2.1）との矛盾: なし。49.5のdrag proxy shadow例外は、常設装飾としてのshadow不使用原則そのものは変更せず、「一時的interaction feedbackは別軸」という区別を明示した上で、既存実装（Phase26-D7、katachi-awase-app.html）が満たしている条件を明文化したのみであり、新しい常設装飾を許可するものではない
- Switch Scan仕様書v1.8との矛盾: なし。36章への追加（Switch Scan Scope）はv1.8の既存決定を上書きせず、複数ステップ教材における候補scope切り替えの解釈を補強したのみ
- `generate.js`実装との矛盾: 44.10で発見した`generateChangelog()`の集約仕様と本文の記述レベル（44.5「〇〇〇の△△△を改善しました」）に実装ギャップがあることを認識した上で、本v1.1ではそのギャップを既知の問題として明記し、生成ロジック自体は変更しなかった（48.3章のSTOP条件に該当するため）
- v1.0本文に存在した既存の壊れた内部参照を発見し修正した: 0章の「15章に一覧化」（実際は51章＝現53章）、0章の「3章のStarter/Pre-Production Checklist」（実際は53/54章＝現55/56章）、旧56章の「62章参照」（存在しない章。実際は17.1/17.2への統合で解消済み）
- 章番号の振り直し: 旧48〜57章をすべて新50〜59章へ機械的に+2し、文書内の全「N章」参照を再確認・更新した
- 本書をPhase26の作業日誌にしていないか: 確認済み。新設章の実装参照は、原則1件の具体例のみに絞り、Phase番号は起源情報としてのみ使用した（例: 48章はPhase26-D8/44.10の1件のみを実装参照として使用し、Phase26-Dの全経緯を記述していない）

---

## 付録: 本標準が防ぐことを意図する既往問題クラス

設定入口二重化／条件付きUIの誤表示／keyboard二重activation／Switch delayed callback残留／stale candidate／gaze dwell停止漏れ／gaze・Switch競合／canonical state不整合／問題の無限継続／progress不足／記録情報不足／CSV不足／複数record詳細の誤紐付け／duplicate ID／色と正解の固定相関／mobileでの刺激差消失／header・common chromeの重なり／index preview欠落／app-details対象表現の誤解／changelog運用不統一／production未確認／非矩形shapeの実効ストローク幅不均一／drag操作でのcanonical state汚染／drag proxy常設shadow化／更新履歴の技術用語混入／更新履歴の同一アプリ細分化。

これらはいずれもPhase16〜26で実際に発見・修正された問題である。本書の目的は「後から直すためのチェックリスト」ではなく、**最初から直さなくてよい構造を新規アプリへ与えること**にある。
