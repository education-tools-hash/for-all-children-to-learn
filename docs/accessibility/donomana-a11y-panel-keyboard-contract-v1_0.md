# donomana A11y Panel Keyboard Contract v0.9.1 (DRAFT)

`WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1`(全35アプリ横断監査)で確立した、共通A11yパネル(`donomanaA11yBtn`/`donomanaA11yPanel`、`generate.js`が全35アプリへ自動注入)のkeyboard behaviorに関する正式Contract候補。

- 前Phase: `WCAG-JIS-FIX-FAMILY-B-BATCH-6-POSTRELEASE-HOTFIX-1`(mogura-tataki、Production final `77085ca`)。GLOBAL-1 docs release(Production final `12c00da`)を経て、GLOBAL-1A Pilot実装(mogura-tataki・tyushi・cup_game・schedule-app・gaze-keyboard)がRC完了(§12参照)。
- 本Contractは`donomana-modal-accessibility-contract-v1_0.md`(v1.1、app固有modalが対象)を補完するものであり、対象は共通A11yパネル自体のkeyboard behaviorに限定する。app固有modal自身のFocus Trap/Initial Focus/Escape Focus Restorationは引き続き`donomana-modal-accessibility-contract-v1_0.md`が正とする。
- **本ステータス: DRAFT v0.9.1。GLOBAL-1A Production Released(User Browser Review PASS / Blue2 Real Device Gate PASS / Tobii Real Device Gate PASS、Production baseline `837d454`)。全35アプリへの横展開(GLOBAL-1B〜1D)は未着手のため、§26参照条件(正式v1.0への昇格条件)は依然として満たされておらず、今回もDRAFTのまま維持する。**
- 適用範囲: `donomanaA11yPanel`/`donomanaA11yBtn`(共通A11yパネル)のTab/Shift+Tab循環、Escape close、Focus Restoration、Modal Coexistence、Visible Focus、Hidden/Disabled Controls。

---

## 1. Scope / Definitions

| 用語 | 定義 |
|---|---|
| **A11yパネル** | `id="donomanaA11yPanel"`のdialog要素。`generate.js`が全35アプリの`<body>`開始直後に自動挿入する(§3.1参照、DOM順序上ページの先頭に位置する) |
| **opener / trigger** | `id="donomanaA11yBtn"`。A11yパネルを開閉するボタン自身 |
| **internal focusable** | A11yパネル要素の子孫のうち、visible(`display!=='none'`かつ`visibility!=='hidden'`かつ`getClientRects().length>0`)かつenabled(`disabled`属性なし)なfocusable要素(`button,input,select,textarea,a[href],[tabindex]`) |
| **settings proxy** | `id="donomanaSettingsProxy"`。`generate.js`の`SETTINGS_PROXY`マップ(31/35アプリに設定済み)により、A11yパネルから各アプリ既存の詳細設定UIへ橋渡しするボタン。クリックするとA11yパネルを閉じ、アプリ固有の実設定トリガーへfocus+clickを転送する |
| **common toolbar** | `donomanaHomeBtn`・`donomanaRecordNavBtn`・`donomanaLockBtn`・`donomanaFsBtn`等、A11yパネルとは別に`generate.js`が注入する共通ボタン群 |

---

## 2. Focus Ownership — REQUIRED

A11yパネルOPEN中は、A11yパネルが排他的にfocus ownershipを持つ。以下は循環対象から除外し、Tab/Shift+Tabで一切到達させない:

- `donomanaA11yBtn`自身(opener)
- common toolbar(Home・学習の記録・画面ロック・全画面等)
- app固有UI(ゲーム画面・app本体のボタン等)
- background modal(app固有modalが同時に開いていてもその内部)
- hidden controls(`display:none`/`visibility:hidden`/`hidden`属性/`aria-hidden`配下)
- disabled controls(`disabled`属性、または実質操作不能と判定できるもの、§8参照)
- `inert`配下の要素
- browser chrome(アドレスバー等)への通常Tab escape

---

## 3. Strict Containment — REQUIRED

### 3.1 Rationale(構造的根拠)

`generate.js`はA11yパネルのHTML/JSを各アプリの`<body>`開始直後に挿入する(`injectA11yPanelToAppHtmls`、`bodyMatch.index + bodyMatch[0].length`)。このためA11yパネルはDOM順序・native Tab順序上、常にページの最先頭に位置する。共通層(`generate.js`)自体にはA11yパネルのTab/Shift+Tabを制御するcircular focus trapが一切実装されていない(§9参照)。この構造から、containment未実装のアプリでは以下の非対称なリスクが理論上発生する:

- **Reverse方向(Shift+Tab)でPanel外へ出た場合**: DOM順序上`donomanaA11yBtn`より前に要素が存在しないため、**browser chromeへ抜ける可能性が高い**。
- **Forward方向(Tab)でPanel外へ出た場合**: DOM順序上Panelの直後にcommon toolbarまたはアプリ本体が続くため、**背景UIへ抜ける可能性が高い**(browser chromeよりは背景UIへ抜けるケースが多い)。

本Phaseの実機検証(§15、代表4アプリ)で、`timetable-app.html`においてReverse方向1回で実際にbrowser chromeへのescape(`document.hasFocus()===false`)を確認した。janken-app/okane-app/tokei-appではReverse方向でcommon toolbar(`donomanaRecordNavBtn`)へ抜けることを確認した(browser chromeではないが、依然としてContract違反)。これはUserが当初mogura-tatakiで報告した現象と同一クラスの構造的リスクが、containment未実装の他アプリに実在することの実証である。

### 3.2 Forward / Reverse / Outside-focus

```
Forward:  last internal focusable  →  first internal focusable
Reverse:  first internal focusable →  last internal focusable
Outside-focus (Tab):        任意の外部要素 → first internal focusable
Outside-focus (Shift+Tab):  任意の外部要素 → last internal focusable
```

`internal focusable`集合はopen(`donomanaA11yBtn`自身は含まない)からreset(`donomanaA11yReset`)までのPanel内部要素のみで構成する。settings proxy(`donomanaSettingsProxy`)はPanel内部要素であるため含む。

### 3.3 Reference Implementation

mogura-tataki(`moguraA11yClusterFocusables`、commit `ddbeba7`、Production `77085ca`)を本Contract §3のReference Implementationとする。ただし§13(Reference Implementation化の注意)のとおり、コードをそのままcopy/pasteせず、reusable behaviorのみを移植すること。

### 3.4 GLOBAL-1A実装結果(共通helper化、Production Released `837d454`)

Owner Decision(a)により、mogura-tataki(Reference)・tyushi(Family B)・cup_game(Family C)・schedule-app(Family C variant)・gaze-keyboard(Family D-1)の5アプリをPilotとし、共通層(`generate.js`)に`getA11yPanelFocusables(panelEl)`・`trapA11yPanelFocus(e)`・`restoreA11yPanelFocus()`を追加、`window`経由で公開した(§12 Common helper参照)。各Pilotアプリは自前の(またはgaze-keyboardの場合は新規追加の)Tabキーlistenerから`window.trapA11yPanelFocus(e)`を呼び出す形へ委譲し、mogura-tataki/tyushi/cup_gameの既存ローカルcluster関数(`moguraA11yClusterFocusables`/`a11yClusterFocusables`/`cupGameA11yPanelFocusables`)は削除した。

実機検証(5アプリ共通、Microsoft Edge、port 9201): Forward Tab 30回・Reverse Shift+Tab 30回・immediate Shift+Tab・outside-focus-guard(Tab/Shift+Tab)を実施し、**5アプリ全てで完全に同一の結果**(`donomanaSettingsProxy`から`donomanaA11yReset`までの8要素のみで循環、opener/toolbar/browser chromeへの遷移ゼロ)を確認した。tyushi・schedule-appについては、Pre-fix investigationで「自前modal(help-overlay/schedule 3modal)が同時に開いていないとA11yパネルのcontainmentが発火しない」という追加の構造的欠陥を新規発見し(Owner Decision(c)の対象、§14・§16参照)、A11yパネルの判定をTabキーlistenerの最上位・無条件へ移動する形で併せて是正した。修正後、A11yパネル単独openでもcontainmentが正しく発火することを実機確認した。

共通helper(3関数の定義)自体は`node generate.js`実行により**全35アプリへ反映される**が、Tab containmentを実際に発火させるlistenerはPilot 5アプリ(mogura-tataki・tyushi・cup_game・schedule-app・gaze-keyboard)にのみ追加されており、Non-Pilot 30アプリの挙動(Family D、containment無し)は不変であることを確認した(§31)。**Production Released(Production baseline `837d454`)。User Browser Review PASS、Blue2 Real Device Gate PASS、Tobii Real Device Gate PASS。**

---

## 4. Close Restoration — REQUIRED **[GLOBAL-1Aで共通層実装済み、Production Released `837d454`]**

A11yパネルを次のいずれかの方法で閉じた場合、focusは**opener(`donomanaA11yBtn`)へ復帰する**ことを原則とする。BODYへのfocus lossは禁止。

- Escapeキー
- close button(A11yパネル自体には専用closeボタンなし、Escapeまたは外側クリックのみ)
- toggle button(`donomanaA11yBtn`再クリック)
- 外側クリック

### 現状(共通層のコード確認結果、`generate.js` L1083-1103)

```js
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && panel.style.display === 'block') btn.click();
});
```

Escape処理は`btn.click()`(合成クリック)のみで、明示的なfocus復帰処理を持たない。合成クリックは実クリックと異なりbtn自体へfocusを移動させないため、Panel内部(opener以外)にfocusがあった状態でEscapeを押すと、その要素が`display:none`になった瞬間にブラウザがfocusを失い`document.activeElement`がBODYへ落ちる。mogura-tatakiで実機確認済み(Panel内部深くから、または`donomanaA11yReset`から直接Escapeを押した場合に再現)。

外側クリックによるclose(L1094-1100)も同様に明示的なfocus復帰処理を持たない。

**この共通実装は`generate.js`側の単一実装であり、全35アプリに等しく適用される。個別アプリ側のカスタムcluster実装(mogura-tataki/tyushi/cup_game/katakana-app/hiragana-learn/schedule-app)もA11yパネル自体のEscape処理を上書きしておらず、共通の`btn.click()`委譲に依存している。したがって本問題は35アプリ全てに共通する構造的リスクであり、mogura-tataki固有ではない(§14参照)。**

本Contractでは、共通層のEscape処理に明示的な`btn.focus()`(またはopener要素への`.focus()`)呼び出しを追加することをREQUIRED候補とする。ただし今回のPhaseでは調査・設計のみに留め、実装しない。

### GLOBAL-1A実装結果(2026-09-09、worktree `for-all-children-to-learn-a11y-panel-global-1a`、branch `fix/a11y-panel-global-pilot-1a`)

Owner Decision(b)により、共通層(`generate.js`)のEscape処理を以下へ変更した:

```js
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && panel.style.display === 'block') {
    panel.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    restoreA11yPanelFocus();
  }
});
```

`btn.click()`による合成クリック委譲をやめ、close処理を直接実行したうえで`restoreA11yPanelFocus()`(`donomanaA11yElFocusable(btn)`が真の場合のみ`btn.focus()`)を呼び出す。`node generate.js`実行により**全35アプリ**へ自動反映され(`injectA11yPanelToAppHtmls`による再注入)、Pilot 5アプリ(mogura-tataki・tyushi・cup_game・schedule-app・gaze-keyboard)で実機確認した結果、Panel内部の任意の深さ(3 Tab後、または`donomanaA11yReset`から直接)からEscapeを押しても、`document.activeElement`が確実に`donomanaA11yBtn`へ復帰することを確認した(5アプリ全て同一結果、BODY退行ゼロ)。この修正は共通層のみの変更でありapp固有DOM構造に依存しないため、Pilot対象外の30アプリにも同一の修正が反映されている(§31 Common helper regression参照、機能面ではEscape restorationはPilot限定ではなく全35アプリ共通のFixとして扱う)。

---

## 5. Modal Coexistence — REQUIRED

background modalが存在する状態でA11yパネルを開ける場合:

- A11yパネルOPEN中: A11yパネルが排他的にfocus ownershipを持つ(§2)。
- A11yパネルCLOSE後: 元のmodalのFocus Trapへ復帰する。
- 詳細設定等の別modal(settings proxy経由でapp固有設定UIを開く場合)へ遷移する場合: 二重focus ownership禁止。A11yパネルは`display:none`へ切り替わり、遷移先modalが単独でfocus ownershipを持つこと(mogura-tatakiの`donomanaSettingsProxy`実装で確認済みのパターンをReference化する)。
- どのmodal/panelがtop layerかは、z-index(A11yパネル`z-index:99998`が常に最上位)とdisplay状態の組み合わせで判定する。`inert`属性による明示的な背景抑制は現状共通層に存在しない(FAMILY-E cross-dependency、§31参照)。

### 既知の実装パターン(調査結果)

| パターン | 該当 | 評価 |
|---|---|---|
| 単一document-level keydownで「A11yパネル優先→早期return→app固有modal Trap」の優先順位分岐 | mogura-tataki・tyushi・cup_game・katakana-app・hiragana-learn・schedule-app | REQUIRED方式の土台として採用可能 |
| app固有modal Trap内にA11yパネル open判定によるguard(`return`)のみ、A11yパネル自体のcontainmentは提供しない | okane-app・matching-app・ongaku-app・gaze-keyboard | Modal Coexistence自体は一部準拠だが、A11yパネル単体のStrict Containment(§3)は未達成 |
| A11yパネルopen判定なし、app固有modal Trapが常時発火 | 残り約25アプリ | 未検証部分あり。A11yパネルとapp固有modalが同時に開けない設計(排他的)であれば実害なしの可能性、要個別確認 |

---

## 6. Visible Focus — REQUIRED

keyboardでfocus可能なcontrolは、focus位置が視覚的に判別可能であること。特に以下は個別確認が必要:

- `opacity:0`のinput(settings proxy対象の隠しoriginal等)
- custom toggle(mogura-tataki panSetの`.tog input`のような、input自体は視覚的に隠しsibling要素で見た目を表現するパターン)
- segmented control・chip・custom slider・icon button

mogura-tatakiではRC3で`.tog input:focus-visible+.ts{outline:3px solid var(--accent2);outline-offset:2px}`を追加し、実際のTabキー操作で`:focus-visible`が正しく発火することをProduction実機で確認済み(POSTRELEASE-HOTFIX-1-RELEASE時点)。同型のcustom toggleが他アプリにも存在する可能性があり、Global rollout時に横断確認が必要。

**既知の類似Finding**: cup_game settingsOverlayの`toggleDwell`等5トグルに`:focus-visible`スタイルが皆無(Batch-7調査で新規発見、UNCLASSIFIED/NEEDS OWNER DECISION、継続中)。

---

## 7. Hidden but Focusable — 監査必須

CSS上visible判定されるが実際には他layerに隠れているcontrol(`getComputedStyle`ではvisibleだが`elementFromPoint`で別要素に覆われている等)がA11yパネルのcluster構成に混入していないか確認する。mogura-tatakiのRC3で、mogura固有ボタン(`btnFS`等)が`scrStart`に完全に覆われた状態(`isElementItselfOnTop:false`)でもTab到達可能だった実例が既知(HIDDEN BUT FOCUSABLE、`family-b-focus-trap-finding-ledger.md`参照)。A11yパネルのinternal focusable判定には、`getClientRects()`+`getComputedStyle`ベースの可視性判定に加え、必要に応じて`elementFromPoint`によるtop-layer判定を追加することを推奨する。

---

## 8. Disabled / Hidden Controls — REQUIRED

Tab対象から除外すべきもの:

- `disabled`属性
- `aria-disabled`で実質操作不能な要素(ただし正当なUI patternが存在する場合はWCAG/ARIA仕様との整合を個別確認する。機械的に除外しない)
- `hidden`属性・`display:none`・`visibility:hidden`
- `inert`配下
- renderされていない要素(`getClientRects().length===0`)
- app状態により操作不能なcontrol

### 既知のDisabled-state不整合(Separate Finding、本Contractでは未解決のまま維持)

mogura-tataki panSet内の`dwT`/`togCur`/`dwTol`(視覚的にdisabled表現だが`disabled`属性が付与されずkeyboard操作可能なまま)。今回の横断調査で、同型の構造パターン(`disabled`属性なしで`opacity`+`pointer-events:none`のみによる視覚的無効化)の疑わしい候補として`scratch-app.html`(`body.locked #backBtn`)・`time-timer.html`(`body.locked .settings-adult-area`)を新規発見した。いずれも今回のPhaseでは確定診断・修正を行わない(§32参照)。

---

## 9. Input Modality(Switch / Gaze / Touch / Keyboard) — REQUIRED

A11yパネルのfocus containment変更は、Switch ScanのTab sequence依存・Gaze target visibility・dwell interactionへ影響しうる。Keyboardだけを直してSwitch/Gazeを壊す設計は禁止。

- Switch Scan対応: `apps-data.json`の`a11y`宣言ベースで28/35アプリ(スイッチスキャン/スイッチコントロール/スイッチアクセス等の表記を含む)。共通A11yボタン自体は全35アプリで`scannable`/`data-scan="1"`を持つが、これはA11yボタンの機能実装であり、アプリ本体のSwitch Scan機能実装の有無とは別軸(コード上の存在≠機能実装、混同しないこと)。
- Gaze(視線入力)対応: 15/35アプリ(okane-app・tyushi・cup_game・kimochi-board・drawing-app・kyou-no-kiroku・scratch-app・gaze-keyboard・mogura-tataki・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app)。
- A11yパネルのstrict containment実装(mogura-tataki Reference)は、Switch Scan・Gaze/dwellの実装(pointerイベント系・独立したscan-focus管理)とは別レイヤーで動作するため、Tabキーによるcontainmentの変更自体はSwitch Scanのスキャン順序・Gaze dwell targetには影響しない設計が可能と考えられる(mogura-tataki Hotfixでの実機確認で、Switch/Gaze固有の回帰は確認されていない)。ただしGaze対応15アプリ・Switch対応28アプリへの横展開時は、個別に回帰確認が必要(§21)。

### GLOBAL-1A Real Device Gate結果

Blue2(Switch)・Tobii(Gaze)実機によるUser Real Device Gateを実施し、いずれもPASS。GLOBAL-1A Pilot 5アプリのStrict Containment・Escape Focus Restorationについて、実機由来の新規回帰(New regression)は0件。

**Separate Findings(PRE-EXISTING / NOT CAUSED BY GLOBAL-1B / NON-BLOCKING、本Contractでは未修正のまま維持)**:

- `gaze-keyboard.html`: A11yパネルを開いてもBlue2 Scan対象がキーボード側に残り、パネル内をスキャンできない。
- `schedule-app.html`: 1スイッチ設定で「みる」画面のScanが2番目で停止し、3番目以降へ進まない。

いずれも本ContractのStrict Containment/Escape Focus Restoration実装が原因ではなく、既存のSwitch Scan実装側の別軸の問題として記録するのみで、修正は行わない。

---

## 10. Test Contract(Regression Test必須項目)

`modal-regression-test-contract.md`(app固有modal用)を補完する、A11yパネル専用のtest matrix案:

**A11yパネル**: open / Forward / Reverse / first boundary / last boundary / outside-focus / Escape / close restoration / mouse close / app settings transition(settings proxy経由)

**Modal Coexistence**: background modal存在下でのA11yパネルopen / nested overlay / A11yパネルclose後のmodal Trap復帰

**Input**: Keyboard / Touch / Switch / Gaze

**Visual**: Visible Focus / Responsive(390×844/768×1024/1280×900)

---

## 11. Exceptions

- ネイティブ`window.confirm()`/`alert()`/`prompt()`は対象外(`donomana-modal-accessibility-contract-v1_0.md`§9と同様の扱い)。
- tyushi settings-panelのような、意図的に非modal disclosure panelとして設計された要素(`WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1`で確定済み)はFocus Trap対象外。ただしA11yパネル自体はdialogとして扱うため本Exceptionの対象外。
- A11yパネルを持たない特殊ページ(`index.html`・`app-intro.html`・`app-register.html`、`generate.js`の`skipFiles`で除外)は本Contractの対象外。

---

## 改訂履歴

- **v0.9(2026-09-09、DRAFT)**: `WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1`初版。mogura-tataki(POSTRELEASE-HOTFIX-1、Production `77085ca`)をReference Implementation候補とし、35アプリ横断監査結果に基づき起草。Pilot実装・User Approval前のためv1.0へは未昇格。
- **v0.9.1(2026-09-09、DRAFT)**: `WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1A`(Owner Approved、Pilot 5アプリ)実装結果を反映。§3.4(共通helper化、Strict Containment)・§4(Escape Focus Restoration実装結果)を追記。tyushi/schedule-appで新規発見した「自前modal同時open時のみA11yパネルcontainmentが発火する」構造的欠陥の是正結果も記録。Production未反映(worktree `for-all-children-to-learn-a11y-panel-global-1a`、branch `fix/a11y-panel-global-pilot-1a`)、User Browser Review待ちのためv1.0へは未昇格。
- **v0.9.1 Status Update(2026-09-13、DOCS-FINALIZE-1、実態反映のみ)**: GLOBAL-1AのProduction Release完了(Production baseline `837d454`)、User Browser Review PASS、Blue2/Tobii Real Device Gate PASSを本文Status行・§3.4末尾へ反映。§9へGLOBAL-1A Real Device Gate結果と、gaze-keyboard/schedule-appの既存Switch Scan関連Separate Findings(PRE-EXISTING / NON-BLOCKING、未修正)を追記。全35アプリへの横展開(GLOBAL-1B〜1D)は引き続き未着手のため、v1.0への昇格条件(§26)は満たされておらず、バージョン番号・DRAFT表記は変更していない。Product code変更0、docs-onlyのstatus finalization。
