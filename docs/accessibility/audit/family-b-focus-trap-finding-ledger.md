# FAMILY-B Focus Trap Finding Ledger

**目的**: `WCAG-JIS-FAMILY-B-CROSS-APP-AUDIT-1`の最終報告に生じた集計不整合(CONFIRMED FAIL=12件と書きながらPattern内訳がB1=10+B7=1=11件しかない、nazorin-print/gaze-keyboardが複数modalを1行に束ねていた、hiragana-learn/katakana-app/mogura-tatakiのmodal名が具体化されていなかった)を正規化する。**1 Finding = 1 Ledger Row**を徹底し、以降このLedgerを唯一の集計基準(Single Source of Truth)とする。

**Phase種別**: docs-only正規化。Production app codeの変更は一切行っていない。

---

## 1. 正規化の方針

- 1行 = 1 app内の1 modal/screen/panel/overlay インスタンス に対するFAMILY-B判定。
- 同一appに複数の対象UIがある場合(nazorin-print、gaze-keyboard、mogura-tataki等)、必ず行を分割する。
- CONFIRMED PASSは「Fix不要な参照実装」であり本来Findingではないため、Ledgerの主対象はCONFIRMED FAIL・N/A・SPECIAL HANDLING・NEEDS MORE EVIDENCEとする。PASSはapp単位の一覧として§4に別掲するに留める(全PASSモーダルを1つずつ行分割することは本Phaseのscopeを超えるため行わない)。

---

## 2. 12件/11件不整合のRoot Cause(確定)

`family-b-cross-app-audit-1.md`の§6表は以下の2つの構造的欠陥を持っていた:

1. **bundling誤り**: nazorin-print行が「batchModal・libModal」の2 modalを1行に、gaze-keyboard行が「profileModal・hrModal」の2 modalを1行に、それぞれ束ねていた。表は12行だったが、真のmodal数は12行のうち2行が2modal分を含むため**14 modal相当**だった。
2. **単純な計算ミス**: §10の文章で「11件中10件がこのパターン」と書いたが、表の行数(12)と矛盾する単純な書き間違いだった(B1=10行+B7=1行=11行だが、実際の表は12行あり、この時点で既に1行分どこかで数え漏れが発生していた)。

本Ledgerでは、上記2つの欠陥をすべて解消し、mogura-tataki(旧: 1行で「screen/panelベース独自UI」と曖昧に記載)・hiragana-learn/katakana-app(旧: 「(該当modal)」と未特定)も含めて、実コード確認により全対象を具体的なmodal ID単位まで特定した。

**結果、正規化後のCONFIRMED FAIL総数は18件(旧報告の12件から6件増加)。** 増加分の内訳: nazorin-print +1(batchModal/libModalを2行に分割したことによる純増1)、gaze-keyboard +1(profileModal/hrModalを2行に分割したことによる純増1)、mogura-tataki +4(旧1行→実際は5つの独立したdialog要素が存在することが判明、純増4)。

---

## 3. Finding Ledger(CONFIRMED FAIL / N/A / SPECIAL HANDLING)

| # | Finding ID | App | File | UI/Modal ID | UI classification | Modal Contract Applicable | FAMILY-B Applicable | Evidence Level | Forward Tab | Reverse Tab | Immediate Shift+Tab | Outside Focus Escape | Pattern | Priority | Status | Fix Batch | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | TIER1-F3-a | register-app | register-app.html | `delete-modal` | Modal Dialog | YES | YES | **LEVEL-A** | **PASS**(15回連続TabでもDOM外へ脱出せず、`delete-cancel`⇄`delete-confirm`間で正しく循環。pre-fix: 10回Tabで`fullscreen-btn`へ脱出) | **PASS**(15回連続Shift+Tabでも脱出せず。pre-fix: 10回Shift+Tabで`share-btn`へ脱出) | **PASS**(`delete-confirm`へ正しくwrap。pre-fix: 背景`record-open-btn`へ即座に脱出) | **PASS**(activeElementをmodal外に強制した状態からTab/Shift+Tabいずれでもmodal内へ復帰することを確認) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-1-RELEASE`, commit `a012cfa`。User Browser Review Approved、Production Validation実機再確認PASS済み) | Batch 1 | Focus Restoration(TIER1-F5B)はProduction解決済み、Trapのみ残存していた。Fixはdocument-levelのkeydown listener(dmModal要素直付けでは outside-focus-guard発火不可なため、record-modal(既存)と同一方式を採用)+ 既存product-modalと同じfocusable算出/端点wrapロジック。cancel/Escape/confirm(境界削除含む)のRestorationおよびproduct-modal自体への regression無しをbrowser検証済み(RC・Production両方で再確認) |
| 2 | TIER2-F2-a | cup_game | cup_game.html | `settingsOverlay` | Modal Dialog(role/aria-modal無し、別Finding) | YES(実質modal) | YES | **LEVEL-A** | 29回目のTabでBODYへ脱出 | 偶然内部に留まる(`toggleDwell`) | 偶然PASS(forward側でFAIL確定) | FAIL(forward) | B1 | P2 | CONFIRMED FAIL | Batch 3(A11yパネルProxy構造) | A11yパネルProxy経由が唯一の到達経路 |
| 3 | TIER2-F2-b | cup_game | cup_game.html | `helpOverlay`(helpModal) | Modal Dialog | YES | YES | **LEVEL-A** | 未実施(reverse側で確定) | 背景`startBtn`へ即座に脱出 | FAIL | FAIL | B1 | P2 | CONFIRMED FAIL | Batch 3 | |
| 4 | TIER1-F3-b | scratch-app | scratch-app.html | `txtEdOv` | Modal Dialog(setOv上のnested overlay) | YES | YES | **LEVEL-A** | **PASS**(25回連続Tabで脱出せず。pre-fix: 25回目までに`hintClose`[モーダル外]へ脱出、旧報告時点では19回目で`photoInp`へ脱出) | **PASS**(25回連続Shift+Tabで脱出せず。pre-fix: `co`[モーダル外]へ脱出) | **PASS**(`txtBgCustom`等、モーダル内に留まる。pre-fix と同じく偶然PASSだったがforward/reverse両方PASSしたことを新たに確認) | **PASS**(chgBtnへ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-2-RELEASE`, commit `fb13634`。User Browser Review Approved、Production Validation実機再確認PASS済み) | Batch 2 | Focus Restorationは`WCAG-JIS-FIX-FAMILY-D-BATCH-2-RELEASE`で解決済み。今回はTrapのみ追加、txtEdOpener/closeTxtEd()には一切手を加えていない。Cancel/Save経路ともBODY退行無しを再確認(Save経路は`closeTxtEd()`後に`closeSet()`が`setBtn.focus()`を上書きする既存挙動があるが、これはorigin/mainと同一のpre-existing挙動でBODY退行ではない、RC・Production両方で再確認) |
| 5 | TIER1-F3-c | scratch-app | scratch-app.html | `cov` | 状態遷移型completion overlay | YES | YES | **LEVEL-A** | **PASS**(10回連続Tabで脱出せず。pre-fix: `LABEL`要素[モーダル外]へ脱出) | **PASS**(明示テストで脱出せず) | **PASS**(`clsBtn`へ正しくwrap。pre-fix: 背景`<a>`要素へ即座に脱出) | **PASS**(chgBtnへ強制focusした状態から復帰確認は同一document listenerで担保) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-2-RELEASE`, commit `fb13634`) | Batch 2 | 同上。closeCov()経由のRestoration(nxtBtn/rtyBtn/clsBtn全経路で`chgBtn`)を再確認、regression無し(RC・Production両方で再確認) |
| 6 | TIER1-F3-d | nazorin-print | nazorin-print.html | `helpModal` | Modal Dialog | YES | YES | **LEVEL-A** | **PASS**(20回連続Tabで脱出せず、単一focusable[`btnHelpClose`]自身へ循環。pre-fix: 20回目までに背景`BUTTON`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`btnBatch`へ脱出) | **PASS**(`btnHelpClose`自身に留まる。pre-fix: 背景`SECTION`要素へ即座に脱出) | **PASS**(`btnShuffle`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-3-RELEASE`, commit `4da35d9`。User Browser Review Approved、Production Validation実機再確認PASS済み) | Batch 3(注: Ledger当初案の「Batch 4」から実行順で3番目のBatchとして実施。同一3 Finding、番号相違のみ) | |
| 7 | TIER1-F3-e | nazorin-print | nazorin-print.html | `batchModal` | Modal Dialog | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(30回連続Tab[動的に追加された一覧項目含む]で脱出せず。pre-fix: 20回目までに背景`BUTTON`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`btnBatch`へ脱出) | **PASS**(`btnBatchPrint`へ正しくwrap。pre-fix: 背景`SECTION`要素へ即座に脱出) | **PASS**(`btnShuffle`へ強制focusした状態から復帰確認) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-3-RELEASE`, commit `4da35d9`) | Batch 3 | helpModalと兄弟関係の独立DOM要素、以前は誤って1行に統合されていた。一覧(`#batchList`)は動的生成のため毎keydownでfocusable再取得、項目追加・削除後もTrap維持を実機確認(RC・Production両方で再確認) |
| 8 | TIER1-F3-f | nazorin-print | nazorin-print.html | `libModal` | Modal Dialog | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(20回連続Tabで脱出せず。pre-fix: 20回目までに背景`BUTTON`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`btnBatch`へ脱出) | **PASS**(`btnLibDelFolder`へ正しくwrap。pre-fix: 背景`SECTION`要素へ即座に脱出) | **PASS**(`btnShuffle`へ強制focusした状態から復帰確認) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-3-RELEASE`, commit `4da35d9`) | Batch 3 | 同上。フォルダ/セット一覧(`#libFolderList`/`#libSets`)も動的生成、同様に確認済み(RC・Production両方で再確認) |
| 9 | TIER1-F3-g | tyushi | tyushi.html | `help-overlay` | Modal Dialog | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず、`help-close`⇄`.htab`間で正しく循環。pre-fix: 15回目までに背景`donomanaA11yBtn`[モーダル外]へ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景`donomanaA11yBtn`へ脱出) | **PASS**(help-btn[opener]からのShift+Tabは`help-close`へ、DOM順序上偶然PASSしていたが今回明示的に保証。pre-fix: 偶然PASSだったがForward側でFAIL確定) | **PASS**(`donomanaA11yBtn`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-5-RELEASE`, commit `26217f6`。RC1はUser Browser ReviewでA11yパネル共存回帰がFAILし、RC2で再修正、RC2をUser Browser Review Approved後にProduction Validation実機再確認PASS済み。詳細は§22(RC2修正)・§23(Release)参照) | Batch 5(注: Ledger当初案の「Batch 1」から実行順で5番目のBatchとして実施。同一Finding、番号相違のみ) | settings-panelとは別UI(§6参照、混同しない)、settings-panelには一切手を加えていない。**[別Finding発見・今回Fixせず]** `closeHelp()`にfocus復帰処理が一切無く、close後にactiveElementがBODYへ退行することを実機確認(新規FAMILY-D候補、既存Ledgerに未記録だった)。RC2・Production Validationいずれでも同一挙動が維持されており悪化していないことを確認済み。**[RC1で発見・RC1修正が不十分と判明・RC2で正式修正]** §22参照 |
| 10 | TIER1-F3-h | gaze-keyboard | gaze-keyboard.html | `profileModal` | Modal Dialog | **YES(実質modal。[2026-09-08訂正] 内側コンテナ`.prof-modal`にはsettingsModalの`.settings-modal`と異なり`role="dialog" aria-modal="true"`が付与されていないことをコード確認で発見。旧Ledgerの「YES」は結果として妥当だが根拠となるARIA属性の有無を未確認のまま記載していた。ARIA欠如自体は別Finding、今回scope外)** | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(20回連続Tabで脱出せず、`profModalTitle`⇄`profCancel`間で正しく循環。pre-fix: 20回目までに背景`rtClear`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`rtAlignL`へ脱出) | **PASS**(`profCancel`へ正しくwrap。pre-fix: 背景`BUTTON`へ即座に脱出) | **PASS**(`donomanaA11yBtn`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE`, commit `f070ca1`。User Browser Review Approved、Production Validation実機再確認PASS済み) | Batch 4 | hrModalと兄弟関係の独立DOM要素、以前は誤って1行に統合されていた。Initial Focus(`#profModalTitle`、tabindex="-1")はFAMILY-J対応のanchor境界処理が必要(settingsModal既存Trapと同型) |
| 11 | TIER1-F3-i | gaze-keyboard | gaze-keyboard.html | `hrModal` | Modal Dialog | **YES(実質modal。[2026-09-08訂正] 内側コンテナ`.hr-modal`も同様に`role="dialog" aria-modal="true"`が付与されていないことをコード確認で発見。ARIA欠如自体は別Finding、今回scope外)** | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(20回連続Tabで脱出せず。pre-fix: 20回目までに背景`btnCopy`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`rtAlignL`へ脱出) | **PASS**(`histClearBtn`へ正しくwrap。pre-fix: 背景`BUTTON`へ即座に脱出) | **PASS**(`donomanaA11yBtn`へ強制focusした状態から復帰確認) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE`, commit `f070ca1`) | Batch 4 | 同上。Initial Focusは常設focusableな`.hr-tab.active`自体のためanchor特別扱い不要。履歴/レポートタブ切替による動的DOM再構築後もTrap維持を実機確認(RC・Production両方で再確認) |
| 12 | TIER2-F2-c | hiragana-learn | hiragana-learn.html | `traceSampleViewer` | Modal Dialog | YES | YES | LEVEL-B(既存Production docs記録踏襲、コード未変更) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 6 | katakana-appと共通実装(コード共有、ファイルは別) |
| 13 | TIER2-F2-d | katakana-app | katakana-app.html | `traceSampleViewer` | Modal Dialog | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 6 | hiragana-learnと共通実装 |
| 14 | TIER1-F3-j | mogura-tataki | mogura-tataki.html | `scrStart` | Modal Dialog(`.screen`、`position:fixed;inset:0`のフルスクリーンoverlay、`role="dialog" aria-modal="true"`。ゲームプレイ用UI[`<main class="wrap">`、常設DOM]の上に被さるホーム画面で、初期ロード時から`on`付与、他に閉じた状態の背景画面が無い点が他4要素と異なるが、`<main>`を実質的に遮断するtrue modalとしてContract適用可能と再確認) | YES(developer自身が明示的にdialog/aria-modal指定) | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず。pre-fix: 15回目までに背景DIV[モーダル外]へ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 偶然`btnStart`へ留まっていたがforward側でFAIL確定) | **PASS**(`btnStart`へ正しく留まる。pre-fix: 同じく偶然PASSだったがforward側FAIL確定) | **PASS**(`donomanaA11yBtn`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **FIXED IN RC2 / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2`, worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-6`, branch `fix/family-b-mogura-focus-trap`。Production未反映。RC1はUser Browser Reviewで指摘ありRC2で再検証・追加修正済み、詳細は§25参照) | Batch 6(注: Ledger当初案の「Batch 7」から実行順で6番目のBatchとして実施。同一Finding、番号相違のみ) | Initial Focus欠如(activeElement=BODY)を実機確認、既存FAMILY-C Finding(今回修正せず)。5要素まとめて単一document-level listenerで処理(詳細は§24参照) |
| 15 | TIER1-F3-k | mogura-tataki | mogura-tataki.html | `scrResult` | 同上(`.screen`)。ゲーム終了時に`<main>`を遮断する結果画面 | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず。pre-fix: 背景DIVへ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景DIVへ脱出) | **PASS**(`btnHomeR`へ正しくwrap。pre-fix: 背景DIVへ即座に脱出) | **PASS**(強制focusした状態から復帰確認) | B1 | P2 | **FIXED IN RC2 / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2`。Production未反映) | Batch 6 | Initial Focus欠如(BODY)を実機確認、既存FAMILY-C Finding(今回修正せず)。closeボタン無し(「もういちど」「ホームにもどる」ボタンで次画面へ遷移)、既存Focus Restoration欠如(FAMILY-D候補、§24参照) |
| 16 | TIER1-F3-l | mogura-tataki | mogura-tataki.html | `panSet` | Modal Dialog(`.panel`、同様のフルスクリーンoverlay)。既存`openPanel`/`closePanelAndReturnFocus`共通関数で開閉、Focus Restoration実装済み(openerへ復帰) | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず。pre-fix: 背景DIVへ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景`fsL`[文字サイズボタン]へ脱出) | **PASS**(`clsSet2`へ正しくwrap。pre-fix: 背景`donomanaRecordNavBtn`へ即座に脱出) | **PASS**(強制focusした状態から復帰確認) | B1 | P2 | **FIXED IN RC2 / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2`。Production未反映) | Batch 6 | 実trigger(`#homeSetBtn`・`#btnSet`)はA11yパネルProxy構造で常時非表示(`opacity:0 !important;pointer-events:none !important;tabIndex=-1;aria-hidden=true`)、`donomanaSettingsProxy`経由でのみ到達可能(既存の別app[okane-app等]と同型パターン)。**[RC2で追加修正]** `donomanaSettingsProxy`クリック時に隠しtrigger(`btnSet`)が`.click()`され、`panelOpener['panSet']`に不可視要素が記録される既存の構造上、panSetを閉じるとfocusが不可視要素へ落ち、Batch-6で新規追加したoutside-focus-guardによりscrStart内へ強制送還される(User Browser Review指摘の実態、詳細は§25参照)。`closePanelAndReturnFocus`にopener可視性検証を追加し、不可視の場合は`donomanaA11yBtn`へフォールバックするよう修正、実機確認済み。背景クリックで閉じる経路(`closePanel`のみ)はFocus Restoration自体が発生しない既存挙動のため今回変更せず(別Finding) |
| 17 | TIER1-F3-m | mogura-tataki | mogura-tataki.html | `panRec` | 同上(`.panel`)。学習記録パネル、`panRec`限定でEscape close実装済み | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず。pre-fix: 背景DIVへ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景`donomanaA11yBtn`へ脱出) | **PASS**(`clrRec`へ正しくwrap。pre-fix: 背景`homeHowBtn`へ即座に脱出) | **PASS**(強制focusした状態から復帰確認) | B1 | P2 | **FIXED IN RC2 / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2`。Production未反映) | Batch 6 | 既存panRec限定Escapeクローズ(T7-B Pilot A)・Focus Restoration(openerへ復帰、常に可視の`homeRecBtn`/`btnRec`が記録されるため`panSet`のような不可視opener問題は無い)ともregressionなしを実機確認 |
| 18 | TIER1-F3-n | mogura-tataki | mogura-tataki.html | `panHow` | 同上(`.panel`)。使い方パネル | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず。pre-fix: 背景BUTTONへ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景`donomanaLockBtn`へ脱出) | **PASS**(`clsHow2`へ正しくwrap。pre-fix: 背景DIVへ即座に脱出) | **PASS**(強制focusした状態から復帰確認) | B1 | P2 | **FIXED IN RC2 / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2`。Production未反映) | Batch 6 | 既存Focus Restoration(openerへ復帰、常に可視の`homeHowBtn`/`btnHow`が記録されるため`panSet`のような不可視opener問題は無い)regressionなしを実機確認 |
| — | — | tyushi | tyushi.html | `settings-panel` | Non-modal Disclosure Panel | **NO(`WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1`で確定)** | **NOT APPLICABLE** | LEVEL-A | N/A | N/A | N/A(背景へ自然に抜ける、意図的設計) | N/A | N/A | N/A | **NOT APPLICABLE** | — | help-overlay(#9)とは別UI、混同禁止 |

**CONFIRMED FAIL総数: 18件**(全てPattern B1、全てPriority P2)。
**NOT APPLICABLE: 1件**(tyushi settings-panel)。
**SPECIAL HANDLING: 0件**(mogura-tatakiは調査の結果、Modal Contract適用対象かつPattern B1と判定できたため、独立したSPECIAL HANDLING区分は不要と判断。ただし個別要素数が多く実機未検証のため、Fix Batch 7として個別設計配慮を残す)。
**NEEDS MORE EVIDENCE: 0件**。

---

## 4. CONFIRMED PASS(参照実装、app単位一覧・Finding化しない)

| App | 対象modal |
|---|---|
| register-app | product-modal |
| matching-app | 全モーダル(how-ov/settings-ov/record-ov/edit-ov/clear-ov/vs-result-ov) |
| time-timer | 全モーダル |
| okane-app | 全モーダル |
| schedule-app | 全モーダル |
| janken-app | 全モーダル |
| tokei-app | 全モーダル |
| gaze-keyboard | settingsModal |
| shiritori2 | 全モーダル |
| bosai-app | 全モーダル |
| ongaku-app | modal-help・modal-pin/export/share |

**11アプリ、Focus Trap実装済み。** これらはFindingではないため個別modal単位への分解は行わない(既にFAMILY-J Regression Gate等で個別実機確認済み、参照実装として安定している)。

---

## 5. Evidence Level集計(Ledger基準)

| Level | 件数 | 内訳 |
|---|---|---|
| **LEVEL-A** | **16**(2026-09-08、`WCAG-JIS-FIX-FAMILY-B-BATCH-6`でmogura-tatakiの5要素[scrStart・scrResult・panSet・panRec・panHow]を実機確認によりLEVEL-Bから昇格。直前は11件[`WCAG-JIS-FIX-FAMILY-B-BATCH-5`でtyushi help-overlayを昇格]、さらに前は10件[Batch 4でgaze-keyboard profileModal・hrModalを昇格]、さらに前は8件[Batch 3でnazorin-print batchModal・libModalを昇格]、当初6件) | register-app(delete-modal)、cup_game(settingsOverlay・helpOverlay)、scratch-app(txtEdOv・cov)、nazorin-print(helpModal・batchModal・libModal)、gaze-keyboard(profileModal・hrModal)、tyushi(help-overlay)、mogura-tataki(scrStart・scrResult・panSet・panRec・panHow) |
| **LEVEL-B** | **2**(直前は7件、上記5件がLEVEL-Aへ移動。当初12件) | hiragana-learn(traceSampleViewer)、katakana-app(traceSampleViewer) |
| **LEVEL-C** | **0** | — |

**合計18件、LEVEL-A + LEVEL-B = 18で一致(継続)。**

---

## 6. Pattern集計(Ledger基準)

| Pattern | 件数 | 内訳 |
|---|---|---|
| B1(Trap完全欠如) | **18** | 全件 |
| B2(Forward boundary破損のみ) | 0 | — |
| B3(Reverse boundary破損のみ) | 0 | — |
| B4(Initial anchor reverse escape) | 0 | — |
| B5(Dynamic focusables stale) | 0 | — |
| B6(A11yパネル相互作用起因) | 0 | — |
| B7(独自アーキテクチャ) | **0**(調査の結果、mogura-tatakiもB1と判明したため訂正) | — |

**全18件がPrimary PatternとしてB1に分類される。旧報告の「B1=10、B7=1」は誤りであり、正しくは「B1=18、B7=0」である。**

---

## 7. Priority集計

| Priority | 件数 |
|---|---|
| P1 | 0 |
| **P2** | **18**(全件) |
| P3 | 0 |

---

## 8. Test Methodology訂正(modal-regression-test-contract.mdへの反映推奨)

本監査で判明した重要な方法論上の教訓:

> **immediate Shift+Tab(open直後、一度もTabを押さない状態でのShift+Tab)だけでFocus Trap PASSと判定してはならない。**

cup_game(settingsOverlay)・scratch-app(txtEdOv)の2件は、immediate Shift+Tabの時点ではDOM順序の偶然により内部に留まったが、Forward Tabを最後まで進めると(19〜29回目)モーダル外へ脱出した。これは、reverse方向の初期挙動だけを見て「Focus Trapが機能している」と誤判定する典型的な失敗パターンである。

**Focus Trap PASSの正式定義(今後の全監査で適用)**:
1. Forward boundary wrap(lastFocusable→firstFocusable)
2. Reverse boundary wrap(firstFocusable/initialFocusAnchor→lastFocusable)
3. Immediate Shift+Tab(open直後、modal外へ逃げない)
4. 上記いずれもmodal外へのfocus escapeが一切無いこと

**この4条件全てを満たさない限りPASSとしない。** 一部だけ満たす場合はCONFIRMED FAILとする(部分的PASSという中間区分は設けない、これは既存Contract v1.1の「REQUIRED」という位置付けと整合する)。

`modal-regression-test-contract.md`への反映は、次回の当該Fix Batch実施時にRegression Gate手順として明記することを推奨する(本Phaseではdocs-only正規化のみのため、当該ファイルの直接編集は見送り、推奨事項として記録するに留める)。

---

## 9. Fix Batch Plan(再設計版)

Evidence LevelとA11yパネルProxy構造の有無、実装の類似性に基づき再設計:

| Batch | 対象 | Evidence Level | 理由 |
|---|---|---|---|
| **Batch 1(最優先候補)** | register-app(delete-modal)、tyushi(help-overlay) | LEVEL-A / LEVEL-B | delete-modalはLEVEL-A・scope最小・Restoration解決済み・User Review容易。tyushiは単独UIで影響範囲小 |
| **Batch 2** | scratch-app(txtEdOv・cov) | LEVEL-A(2件とも) | 同一app、Focus Restoration解決済み、Trap欠如箇所が明確 |
| **Batch 3(A11yパネルProxy構造あり)** | cup_game(settingsOverlay・helpOverlay) | LEVEL-A(2件とも) | 同一app、A11yパネルEscape優先度との整合を同時に設計する必要があり単独Batchとする |
| **Batch 4** | nazorin-print(helpModal・batchModal・libModal) | LEVEL-A 1件+LEVEL-B 2件 | 同一app、3modal共通の実装パターンが強く推定される |
| **Batch 5** | gaze-keyboard(profileModal・hrModal) | LEVEL-B(2件とも) | 同一app、NEW-KNOWN-3の既存文脈を踏まえた個別確認が必要 |
| **Batch 6** | hiragana-learn・katakana-app(traceSampleViewer) | LEVEL-B(2件とも) | 2app共通実装、同時対応が自然 |
| **Batch 7(個別設計要、最後に着手推奨)** | mogura-tataki(scrStart・scrResult・panSet・panRec・panHow) | LEVEL-B(5件とも、実機未検証) | 5要素と対象数が多く、`.screen`/`.panel`という2種類の独自CSS構造を持つため、他Batchの実装パターンがそのまま適用できるか個別に設計検討してから着手する |

**推奨着手順序: Batch 1 → 2 → 3 → 4 → 5 → 6 → 7。** ただし実際の着手順序はUser判断による。

---

## 10. Separate Findings(FAMILY-B以外、本Ledgerでは記録のみ)

| Finding | 対象 | Family |
|---|---|---|
| Escapeキーで閉じる仕組みが存在しない | cup_game(settingsOverlay)、scratch-app(全modal共通)、tyushi(settings-panel) | 未分類(Escape機構) |
| role/aria-modal欠如 | cup_game(settingsOverlay) | FAMILY-A寄り |
| Initial Focus非理想着地 | cup_game(settingsOverlay)、tyushi | FAMILY-C |
| 背景抑制(inert)欠如 | 複数アプリ | FAMILY-E |

いずれも今回修正しない。

---

## 11. Manual Validation Pending

NVDA・VoiceOver・Blue2実機・Tobii実機は引き続きPending。本Ledger作成でも実施していない。

---

## 12. Final Status

`WCAG-JIS-FAMILY-B-LEDGER-NORMALIZE-1 = FINDING LEDGER NORMALIZED / READY FOR FIX`

CONFIRMED FAIL 18件が確定した。Fix Batch実装は本Phaseでは開始しない。

---

## 13. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-1 進捗

`TIER1-F3-a`(register-app `delete-modal`)を`WCAG-JIS-FIX-FAMILY-B-BATCH-1`でFix RC実装完了。詳細は§3の該当行を参照。

- Status: **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-1`
- branch: `fix/family-b-register-delete-focus-trap`
- **FAMILY-B Production residual count: 18件のまま変わらず**(Production未反映のため)
- **RC candidate count: 1件**(TIER1-F3-aのみ)
- 本Batchは`tyushi(help-overlay, TIER1-F3-g)`を含まない。Phase指示により明示的にregister-app delete-modal単独スコープとした(前Phase報告の「register-app + tyushiはいずれもLEVEL-A」という記述はEvidenceの粒度が異なる可能性があり、tyushi分は別途扱う)。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 14. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-1-RELEASE完了

User Browser Review Approved(「FAMILY-B Batch1 User Browser Review: 問題ありません。User Approvedです。」)を受け、Production Releaseを実施した。

- `main = origin/main = a012cfa`へfast-forward merge・push完了
- CI(`generate`ワークフロー)による自動コミットは発生せず(register-app.htmlはapps-data.json駆動の生成対象外のため想定通り)
- Production Validationとしてマージされたmainのコンテンツをそのまま配信するローカルサーバ(port 9105)上で実機再テストを実施し、RC時と同一の全項目(Forward/Reverse boundary wrap・immediate Shift+Tab・outside-focus-guard・cancel/Escape/confirm restoration・product-modal無regression)がPASSすることを確認
- `TIER1-F3-a`のStatusを**FIXED IN RC / USER REVIEW PENDING**から**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `a012cfa`)へ更新(§3該当行)
- **FAMILY-B Production残存件数: 18件 → 17件**(TIER1-F3-aのみ解消、残り17件は未着手)
- 投資調査branch `investigate/wcag-jis-finding-initial-restore-1`(`c6930d9`)は本Releaseでも変更なし
- worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-1`・branch `fix/family-b-register-delete-focus-trap`はcleanup済み(fully merged後に削除)

---

## 15. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-2 進捗

`TIER1-F3-b`(scratch-app `txtEdOv`)・`TIER1-F3-c`(scratch-app `cov`)を`WCAG-JIS-FIX-FAMILY-B-BATCH-2`でFix RC実装完了。詳細は§3の該当行を参照。

- Status: 両Finding = **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-2`
- branch: `fix/family-b-scratch-focus-trap`
- Fix architecture: `txtEdOv`・`cov`共通の単一document-level keydown listenerを新規追加。「今どちらのmodalが`.on`かを判定→開いている方のみfocusableを毎回再取得してendpoint/outside-focus wrap」という設計(register-app delete-modal Fix[Batch 1]と同じdocument-level方式、要素直付けlistenerではoutside-focus-guardが働かないため)。2 modal間の相互干渉が無いことを実機確認済み(txtEdOv close後にcovのみopenした状態でtxtEdOv側Trapが誤発火しないこと、listener多重登録が起きないこと[open/close 3回サイクル後もpreventDefault発火回数が1のまま]を確認)。
- **FAMILY-B Production residual count: 17件のまま変わらず**(Production未反映のため)
- **RC candidate count: 2件**(TIER1-F3-b・TIER1-F3-c)
- Focus Restorationは`WCAG-JIS-FIX-FAMILY-D-BATCH-2-RELEASE`で既に解決済みであり、本Batchでは`txtEdOpener`/`closeTxtEd()`/`closeCov()`に一切手を加えていない。Cancel/Save(txtEdOv)・nxtBtn/rtyBtn/clsBtn(cov)全経路でBODY退行が無いことを再確認。
- 副次的な観察(Separate Finding、今回Fixしない): txtEdOvのSave経路(`addImgBtn2`経由でphoto modeから開いた場合)は`closeTxtEd()`が一旦`addImgBtn2`へ復帰させた直後、同じhandlerが呼ぶ`closeSet()`が無条件に`setBtn.focus()`で上書きするため、最終的な復帰先が`setBtn`になる(BODY退行ではなく、常設・可視の正当なcontrolではあるが、opener chainとしては直感的でない)。この挙動はorigin/mainの`closeSet()`実装(`function closeSet(){document.getElementById('setOv').classList.remove('on');document.getElementById('setBtn').focus();}`)に既存で、本Batchでは変更していない。FAMILY-Dは既にCLOSED済みのため新規Findingとして起票せず、観察記録のみ。
- 副次的な観察2(Separate Finding、今回Fixしない): txtEdOv内の写真選択トリガー(`<label for="photoInp" id="selectPhotoBtn">`)は`tabindex`が無いネイティブ`<label>`要素のため、キーボード操作(Tab)では到達不可能(WCAG 2.1.1 Keyboard相当の懸念)。実際のfile input(`photoInp`)は`document.body`に直接appendされておりtxtEdOvのDOM部分木外にあるため、今回のTrap実装(`modal.querySelectorAll(...)`ベース)の対象にもならない。FAMILY-B/Trapの範囲外、既存の別Finding候補として記録のみ。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 16. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-2-RELEASE完了

User Browser Review Approved(「FAMILY-B Batch2 User Browser Review: 問題ありません。User Approvedです。」)を受け、Production Releaseを実施した。

- `main = origin/main = fb13634`へfast-forward merge・push完了
- CI(`generate`ワークフロー)による自動コミットは発生せず(scratch-app.htmlはapps-data.json駆動の生成対象外のため想定通り)
- Production Validationとしてマージされたmainのコンテンツをそのまま配信するローカルサーバ(port 9105)上で実機再テストを実施し、RC時と同一の全項目(txtEdOv: 25回連続Forward/Reverse Tab・immediate Shift+Tab、cov: 10回連続Forward Tab・immediate Shift+Tab、いずれもmodal内containment)がPASSすることを確認。txtEdOv Save経路の`setBtn`復帰(pre-existing・BODY退行ではない)もRC時と同一挙動であることを再確認
- `TIER1-F3-b`・`TIER1-F3-c`のStatusを**FIXED IN RC / USER REVIEW PENDING**から**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `fb13634`)へ更新(§3該当行)
- **FAMILY-B Production残存件数: 17件 → 15件**(TIER1-F3-b・TIER1-F3-cが解消、残り15件は未着手)
- 投資調査branch `investigate/wcag-jis-finding-initial-restore-1`(`c6930d9`)は本Releaseでも変更なし
- worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-2`・branch `fix/family-b-scratch-focus-trap`はcleanup済み(fully merged後に削除)

---

## 17. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-3 進捗

`TIER1-F3-d`(nazorin-print `helpModal`)・`TIER1-F3-e`(`batchModal`)・`TIER1-F3-f`(`libModal`)を`WCAG-JIS-FIX-FAMILY-B-BATCH-3`でFix RC実装完了。詳細は§3の該当行を参照。

- Status: 3 Finding全て = **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-3`
- branch: `fix/family-b-nazorin-print-focus-trap`
- Finding ID / 実装DOM IDの照合結果: Ledger記載の`helpModal`/`batchModal`/`libModal`は最新Production(nazorin-print.html)と完全一致、齟齬なし。3 modalとも`role="dialog" aria-modal="true"`かつネイティブ`hidden`属性で開閉(`.hidden=false/true`)、既存Escapeハンドラ実装済み(`document.addEventListener("keydown", e => { if (e.key === "Escape" && !xxxModal.hidden) closeXxx(); })`)、閉じるとopener(`btnHelp`/`btnBatch`/`btnLibrary`)へ復帰する既存Restorationも実装済み(FAMILY-D非該当・現状維持)。
- Pre-fix Evidence(実機確認): 3 modalとも同一パターンでCONFIRMED FAIL — immediate Shift+Tabで背景`SECTION`要素へ即座に脱出、20回連続Forward Tabで背景`BUTTON`へ脱出、20回連続Reverse Shift+Tabで背景`btnBatch`へ脱出。batchModal・libModalはLedger上旧LEVEL-B(コード確認のみ)だったが、本Phaseの実機テストにより**LEVEL-Aへ昇格**(§5のEvidence Level集計を8/10に更新)。
- Fix architecture: 3 modal共通の単一document-level keydown listenerを新規追加。「今どのmodalが表示中か(ネイティブ`hidden`属性で判定: `!helpModal.hidden`→`!batchModal.hidden`→`!libModal.hidden`の優先順)」を判定し、該当modalのみfocusableを毎回再取得してendpoint/outside-focus wrapする設計(register-app/scratch-app Fix[Batch 1/2]と同じdocument-level方式)。3 modal間の相互干渉が無いこと(helpModal異常終了状態からbatchModalを開いてもhelpModal側Trapが誤発火しない)、listener多重登録が起きないこと(open/close 3回サイクル後もpreventDefault発火回数が1のまま)を実機確認済み。
- batchModal(`#batchList`)・libModal(`#libFolderList`/`#libSets`)は一覧が動的生成されるため、項目追加・削除後もfocusable再取得によりTrapが正しく維持されることを実機確認(3件追加→30回Tab未脱出→1件削除→Tab継続で依然containment維持)。
- **FAMILY-B Production residual count: 15件のまま変わらず**(Production未反映のため)
- **RC candidate count: 3件**(TIER1-F3-d・TIER1-F3-e・TIER1-F3-f)
- Focus Restoration(FAMILY-D非該当領域、現状維持)・Escape(既存実装、変更なし)・A11yパネル(regressionなし、実機確認済み)いずれも問題なし。
- 備考: Ledger§3・§9(旧設計時点のFix Batch Plan)では本3 Findingを「Batch 4」と記載していたが、実際のPhase実行順序では本Phase(3番目に実行されたFix Batch)が該当する。対象Finding自体(TIER1-F3-d/e/f)に相違はなく、Batch番号の呼称のみの相違である。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 18. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-3-RELEASE完了

User Browser Review Approved(「FAMILY-B Batch3 User Browser Review: 問題ありません。User Approvedです。」)を受け、Production Releaseを実施した。

- `main = origin/main = 4da35d9`へfast-forward merge・push完了
- CI(`generate`ワークフロー)による自動コミット`832725c`(「自動生成：アプリページを更新」)が発生。差分を確認したところ、`sitemap.xml`内のnazorin-print.htmlの`<lastmod>`が`2026-09-06`→`2026-09-08`に更新されたのみ(app-details配下の生成ページやapps-data.json由来の内容には変更なし)。ファイル更新日時に伴う無害なSEOメタデータ更新であり、本Fixの内容とは無関係。`git merge --ff-only origin/main`でlocal mainを同期し、`main = origin/main = 832725c`とした
- Production Validationとしてマージされたmainのコンテンツをそのまま配信するローカルサーバ(port 9105)上で実機再テストを実施し、RC時と同一の全項目(3modalとも20〜30回連続Forward/Reverse Tab・immediate Shift+Tabでcontainment維持)がPASSすることを確認
- `TIER1-F3-d`・`TIER1-F3-e`・`TIER1-F3-f`のStatusを**FIXED IN RC / USER REVIEW PENDING**から**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `4da35d9`)へ更新(§3該当行)
- **FAMILY-B Production残存件数: 15件 → 12件**(TIER1-F3-d・e・fが解消、残り12件は未着手)
- 投資調査branch `investigate/wcag-jis-finding-initial-restore-1`(`c6930d9`)は本Releaseでも変更なし
- worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-3`・branch `fix/family-b-nazorin-print-focus-trap`はcleanup済み(fully merged後に削除)

---

## 19. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-4 進捗

`TIER1-F3-h`(gaze-keyboard `profileModal`)・`TIER1-F3-i`(`hrModal`)を`WCAG-JIS-FIX-FAMILY-B-BATCH-4`でFix RC実装完了。詳細は§3の該当行を参照。

- Status: 2 Finding全て = **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-4`
- branch: `fix/family-b-gaze-keyboard-focus-trap`
- **[重要・Modal Contract Applicable分類の訂正]** コード確認の結果、`profileModal`/`hrModalの内側コンテナ`(`.prof-modal`/`.hr-modal`)には、同じgaze-keyboard内の`settingsModal`の内側コンテナ(`.settings-modal`)と異なり`role="dialog" aria-modal="true"`が一切付与されていないことが判明した(grepで確認、ファイル全体で該当属性の動的付与も無し)。旧Ledger・旧modal-conformance-matrixはこの2 modalの「Dialog Semantics」を✅(PASS)、「Modal Contract Applicable」を単純に「YES」と記載していたが、これはARIA属性の有無を直接確認せずに記載されていたものであり、**厳密には誤りだった**。ただし両UIは全画面固定オーバーレイ・`.hidden`クラスによる開閉・専用のopen/close route・既存Initial Focus/Escape/Focus Restorationを備えた、実質的に機能する modal であるため、Batch 3のcup_game `settingsOverlay`(role/aria-modal無しだが実質modal)と同一の前例に倣い、**「YES(実質modal)」へ訂正した上でFocus Trap Fixを継続**した(STOPして報告のみに留めることはしなかった)。ARIA属性欠如そのものは今回のFocus Trap scope外の別Finding として記録し、修正していない。
- Pre-fix Evidence(実機確認、両modalとも同一パターンでCONFIRMED FAIL): immediate Shift+Tabで背景BUTTON要素へ即座に脱出、20回連続Forward Tabで背景要素(profileModal: `rtClear`、hrModal: `btnCopy`、いずれも背景の他機能ボタン)へ脱出、20回連続Reverse Shift+Tabで背景`rtAlignL`へ脱出、強制outside-focus状態からのTab/Shift+Tabいずれも脱出したまま復帰せず。旧LEVEL-B(コード確認のみ)だったが、本Phaseの実機テストにより**両方ともLEVEL-Aへ昇格**(§5のEvidence Level集計をLEVEL-A 10/LEVEL-B 8に更新)。
- Fix architecture: 同じgaze-keyboard内に既存する`settingsModal`のFocus Trap実装(document-level keydown、Switch Scanモード中は無効化、A11yパネル表示中は競合回避、outside-focus-guard、FAMILY-J対応のinitial focus anchor境界処理)と同一設計思想を、profileModal/hrModal共通の単一document-level listenerとして実装。settingsModalのTrapとは別のlistener(既存Trapのコードは一切変更していない)。profileModalの`aria-labelledby`が存在しないため、initial focus anchor(`#profModalTitle`)はsettingsModalのような動的取得ではなく直接IDで参照。hrModalはinitial focusが常設focusableな`.hr-tab.active`自体のためanchor特別扱い不要。
- Switch Scan bypass: `scanMode=true`の状態でTabを押すと、Trapが早期returnしブラウザ標準のTab遷移(`profModalTitle`→`profNameIn`)がそのまま発生することを実機確認、settingsModal既存Trapと同じ振る舞いを踏襲。
- Gaze/Dwell regression: `addDwell`は`pointerenter`/`pointerleave`/`pointercancel`/`pointermove`のみに依存しており、今回追加したkeydown('Tab')専用listenerとイベント種別が完全に独立していることをコード確認。実機でも`pointerenter`ディスパッチ時に`dwelling`クラスが正常に付与されることを確認、regression無し。
- Dynamic focusables: profileModalの`#profList`(プロフィール追加・削除で動的に増減)、hrModalの`#hrBody`(履歴⇔レポートタブ切替で`renderHrModal()`により毎回再構築)いずれも、項目変化後もfocusable再取得によりTrapが正しく維持されることを実機確認(15回連続Tabでcontainment維持)。
- 別途観察(Separate Finding扱い、今回Fixしない): profileModal表示中にA11yパネルを開いた状態で1回Escapeを押すと、A11yパネルとprofileModalの両方が同時に閉じる(それぞれ独立したdocument-level Escapeリスナーが同一keydownイベントで両方発火するため)。最終的なfocusは`profileAddBtn`へ正しく復帰しBODY退行はないため実害は無いが、Escapeの「優先順位」としては1段階ずつ閉じる方が直感的である可能性がある。この挙動は本Fix前から存在しており(diffにEscape関連の変更なし、git diffで確認済み)、今回のFocus Trap追加によって新規発生したものではない。
- **FAMILY-B Production residual count: 12件のまま変わらず**(Production未反映のため)
- **RC candidate count: 2件**(TIER1-F3-h・TIER1-F3-i)
- Focus Restoration(FAMILY-D非該当領域、現状維持)・既存Escape(変更なし)・A11yパネル(regressionなし、実機確認済み)いずれも問題なし。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 20. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE完了

User Browser Review Approved(「FAMILY-B Batch4 User Browser Review: 問題ありません。User Approvedです。」)を受け、Production Releaseを実施した。

- `main = origin/main = f070ca1`へfast-forward merge・push完了
- CI(`generate`ワークフロー)による自動コミット`6c37cd9`(「自動生成：アプリページを更新」)が発生。差分を確認したところ、`sitemap.xml`内のgaze-keyboard.htmlの`<lastmod>`が`2026-09-07`→`2026-09-08`に更新されたのみ(Batch 3リリース時のsitemap.xml更新と同一パターン)。ファイル更新日時に伴う無害なSEOメタデータ更新であり、本Fixの内容とは無関係。`git merge --ff-only origin/main`でlocal mainを同期し、`main = origin/main = 6c37cd9`とした
- Production Validationとしてマージされたmainのコンテンツをそのまま配信するローカルサーバ(port 9105)上で実機再テストを実施し、RC時と同一の全項目(両modalとも20回連続Forward/Reverse Tab・immediate Shift+Tab・強制outside-focus状態からの復帰でcontainment維持)がPASSすることを確認
- `TIER1-F3-h`・`TIER1-F3-i`のStatusを**FIXED IN RC / USER REVIEW PENDING**から**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `f070ca1`)へ更新(§3該当行)
- **FAMILY-B Production残存件数: 12件 → 10件**(TIER1-F3-h・iが解消、残り10件は未着手)
- 投資調査branch `investigate/wcag-jis-finding-initial-restore-1`(`c6930d9`)は本Releaseでも変更なし
- worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-4`・branch `fix/family-b-gaze-keyboard-focus-trap`はcleanup済み(fully merged後に削除)

---

## 21. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-5 進捗

`TIER1-F3-g`(tyushi `help-overlay`)を`WCAG-JIS-FIX-FAMILY-B-BATCH-5`でFix RC実装完了。詳細は§3の該当行を参照。

- Status: **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-5`
- branch: `fix/family-b-tyushi-help-focus-trap`
- Finding ID / 実装DOM IDの照合結果: Ledger記載の`help-overlay`は最新Production(tyushi.html)と完全一致。`role="dialog" aria-modal="true" aria-label="使い方"`が既に付与済みの正規のtrue modal(gaze-keyboardのprofileModal/hrModalのようなARIA欠如は無し)。settings-panel(非modal、既存判定済み)とは別UIであることを再確認、settings-panelには一切手を加えていない。
- Pre-fix Evidence(実機確認、直接再現によりLEVEL-Aへ昇格): 15回連続Forward Tabで背景`donomanaA11yBtn`へ脱出、15回連続Reverse Shift+Tabで同じく背景`donomanaA11yBtn`へ脱出、強制outside-focus状態からのTab/Shift+Tabいずれも復帰せず。immediate Shift+Tab(openerである`help-btn`から)は`help-close`がDOM順序上たまたま直前に位置するため偶然PASSしていたが、Forward側の確定FAILによりCONFIRMED FAILは揺るがない(他Batchで確立した「immediate Shift+Tabだけで判定しない」の実例が今回も再現)。
- **[別Finding発見・今回Fixせず]** `closeHelp()`にfocus復帰処理(`.focus()`呼び出し)が一切無いことをコード確認、実機テストでも close後にactiveElementがBODYへ退行することを確認した。これは新規のFAMILY-D(Focus Restoration)候補であり、既存のfamily-d-focus-restoration-close-1.md・family-d-tyushi-design-1.mdのいずれにも記録されていなかった(tyushiのFAMILY-D調査は過去settings-panelのみを対象としており、help-overlayは対象外だった)。今回のFocus Trap Fix scopeには含めず、修正していない。別Phaseでの対応を推奨。
- **[実装中に発見・その場で修正]** 初回実装ではA11yパネルとの競合回避条件式が無く、help-overlay表示中に共通A11yパネルを開いてTabを押すと、A11yパネル内のfocusがhelp-overlay側の新Trapによって強制的にhelp-overlay内へ送還される regressionが実機テストで判明した(Phase spec §20の要求「Panel内focusをhelp-overlayへ即強制送還しない」に違反)。他app(gaze-keyboard settingsModal等)と同型のA11yパネル競合回避条件式(`a11yPanel.style.display==='block' && (activeElement===a11yBtn || a11yPanel.contains(activeElement))`の場合は早期return)を追加し、再テストで解消を確認。
- Fix architecture: document-levelのkeydown listenerを新規追加。open-state判定は既存Escapeハンドラと同じ`overlay.style.display !== 'none'`を採用(このoverlayはCSSの`.open`クラスではなく`style.display`を直接操作するアーキテクチャのため、既存パターンに合わせた)。focusable算出・端点wrap・outside-focus-guardは他Batchと同一設計。
- **FAMILY-B Production residual count: 10件のまま変わらず**(Production未反映のため)
- **RC candidate count: 1件**(TIER1-F3-g)
- Escape(既存実装、変更なし)は問題なし。settings-panelへのregressionなし(実機確認済み、A11yプロキシ経由の正規フローで確認)。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 22. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-5-RC2: User Browser Review FAILとRC2修正

**RC1(§21)はUser Browser ReviewでFAILし、正式判定は`WCAG-JIS-FIX-FAMILY-B-BATCH-5 = USER REVIEW FAILED / RC REVISION REQUIRED`となった。** §21の記述はRC1時点での認識(A11yパネル競合回避条件式で解消したと判断)であり、これ自体は削除・書き換えず、以下に不十分だった実態とRC2での正式修正を追記する。

### User Browser Reviewで報告された実症状

「使い方」(`#help-overlay`)を開いた状態でA11yパネルを開き、A11yパネル内をTabで移動すること自体は可能だが、Tabを続けると最終的にhelp-overlay側へフォーカスが強制的に戻る、というもの。

### 実機再現(RC2着手時)

再現手順どおりに実機再現し、正確な遷移を記録した:

- A11yパネルを開く(`donomanaA11yBtn`→`donomanaSettingsProxy`→パネル内チェックボックス/ボタン群→`donomanaA11yReset`まで、Tab#1〜#9)
- Tab#10: `donomanaA11yReset`(パネル内最後)→`donomanaHomeBtn`(パネル外・help-overlay外の共通ツールバーボタン)。この時点で`donomanaA11yPanel.style.display`はまだ`'block'`(パネルは開いたまま)
- Tab#11: `donomanaHomeBtn`→help-overlay内のBUTTON要素。**ここでUser報告のとおりhelp-overlayへ強制送還される。**

### Root Cause(RC1の何が不十分だったか)

RC1のガード条件式は`a11yPanel.style.display==='block' && (document.activeElement===a11yBtn || a11yPanel.contains(document.activeElement))`だった。この条件は**activeElementが「A11yボタン自身」または「パネルのDOM内部」のいずれかである場合のみ**help-overlay Trapをskipする設計であり、Tab#10でactiveElementが`donomanaHomeBtn`(パネルのDOM外、かつA11yボタン自身でもない)に移った瞬間に条件が成立しなくなり、Trapが再度介入していた。

さらに調査の結果、問題の本質はガード条件式の書き方ではなく、**「A11yパネル自身はTab#10のようにパネル外の共通ツールバー(`donomanaHomeBtn`)へ抜ける設計になっている」**ことにあった。help-overlay側のTrapを単純にskipするだけでは、A11yパネル+共通ツールバーという一塊のクラスタを抜けた後、素のDOM順序(A11yパネル関連要素の直後にhelp-overlayが位置する)により、ブラウザの標準Tab遷移がそのままhelp-overlay内へ入り込んでしまう。これは「help-overlay側Trapの誤動作」ではなく「A11yパネル関連クラスタ自体がself-containedでない」ことに起因する。

### RC2 Fix Architecture

Modal Accessibility Contract v1.1のEscape priority(A11y Panel > Nested overlay > Main modal)と同じ「focus ownership」の考え方に基づき、2段階の設計に変更した:

1. **help-overlay自身のTrap無効化**: 引き続き`a11yPanel.style.display==='block'`の間はhelp-overlay自身の端点wrap/outside-focus-guardを完全にskipする(RC1から維持)。
2. **[新規] A11yパネル関連クラスタへのローカルTrap付与**: 共通A11yパネル実装自体(生成済みの共通コード)は変更せず、tyushi.htmlのhelp-overlay用listener内に限定して、A11yパネルOPEN中は`[donomanaA11yBtn, ...パネル内focusables, donomanaHomeBtn]`という「A11yパネル関連クラスタ」のリストを都度計算し、その最後の要素(`donomanaHomeBtn`)からのForward Tabは先頭(`donomanaA11yBtn`)へ、先頭からのReverse Shift+Tabは最後(`donomanaHomeBtn`)へラップする。これによりA11yパネルOPEN中はクラスタ内で閉じたループとなり、help-overlay(および他の背景要素)へ一切流出しなくなる。パネルがCLOSEDに戻れば次のTabから通常のhelp-overlay Trapへ自動復帰する(状態を保持しない、毎keydown判定のため)。

### 実装中に追加で発見・修正した副次バグ

上記クラスタ実装の初版では、`donomanaA11yBtn`・`donomanaHomeBtn`がいずれも`position:fixed`であるため`el.offsetParent`が常に`null`になる(Chromiumの既知の仕様: `position:fixed`要素は`offsetParent`を持たない)ことに気づかず、`offsetParent!==null`ベースの可視性判定を使ったところ、この2要素が誤って「非表示」としてクラスタから除外されてしまい、クラスタがA11yパネル内部の要素だけでループする(`donomanaHomeBtn`・`donomanaA11yBtn`へは到達不能になる)という不完全な状態になっていた。`getClientRects().length>0`+`getComputedStyle`ベースの可視性判定(gaze-keyboard settingsModal等の既存Trapと同型)に置き換えて解消し、Forward/Reverse Tabでクラスタ全体(A11yボタン→パネル内→ホームボタン→ラップ)を正しく循環することを実機確認した。

### RC2再検証結果(全項目実機確認)

- A11yパネル関連クラスタでのForward Tab 20回連続・Reverse Shift+Tab 20回連続: いずれもhelp-overlayへ一切脱出せず、クラスタ内で正しく循環(PASS)
- A11yパネルを`donomanaA11yBtn`の再クリック(toggle close、Escapeではない)で閉じた後: help-overlay自身のTrapが正常復帰(Forward 15回・Reverse 15回・outside-focus-guardいずれもPASS)
- A11yパネルのOPEN→Tab確認→CLOSE→help Trap確認を3サイクル実施: listener多重登録なし(`preventDefault`発火回数が常に1)、stale stateなし、Trap復帰失敗なし
- 通常のhelp-overlay Trap regression(A11yパネルCLOSED状態): Forward Tab 15回・Reverse Shift+Tab 15回・immediate Shift+Tab・forced outside focus+Tab/Shift+Tab・3 tab pane(staff/child/home)切替後のTab、いずれも背景へ脱出せずPASS(RC1から変化なし)
- Escape regression: **Escapeを1回押すとA11yパネルとhelp-overlayの両方が同時に閉じることを確認した**(それぞれ独立したdocument-level Escapeリスナーが同一keydownイベントで両方発火するため、2段階のEscape priorityにはなっていない)。この挙動はRC1・RC2いずれでも共通コードのEscape実装は一切変更していないため、**既存の事前挙動であり、今回のTab-trap修正とは独立**。仕様上望ましいかは別途検討の余地があるが、本Phaseでは「Escapeロジック自体は変更しない」との指示どおり一切手を加えていない。
- Focus Restoration既知Finding(`closeHelp()`のBODY退行): RC2でも同一挙動を確認、悪化していないことを確認(§21の記載から変化なし)
- Initial Focus既知Finding: 変更なし
- settings-panel: A11yプロキシ経由の正規フローで開閉・Tab操作を確認、regressionなし
- Touch/Responsive(390×844・768×1024・1280×900): 各viewportでA11yパネルのopen/tab/close、help-overlay自身のTrap復帰を確認、いずれもPASS
- Console/page errors: 0件

### 更新後の状態

- `TIER1-F3-g` = **FIXED IN RC2 / USER REVIEW PENDING**
- FAMILY-B Production residual count: 10件のまま変わらず(Production未反映のため)
- RC candidate count: 1件(TIER1-F3-g)、変わらず
- User Browser Review再実施待ち。Production Release/main merge/cleanupは未実施。

---

## 23. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-5-RELEASE完了

User Browser Review Approved(「FAMILY-B BATCH-5 RC2 User Browser Review：問題ありません。User Approvedです。A11y Panel内でTab / Shift+Tabを繰り返しても「使い方」へフォーカスが戻らず、A11y Panelを閉じた後も「使い方」のFocus Trapが正常に機能しました。Escape同時closeおよびcloseHelp()後のBODY退行については、既存の別Findingとして扱います。」)を受け、Production Releaseを実施した。

- `main = origin/main = 26217f6`(RC1・RC2両方のapp fix commit[`b9d0b38`・`9a507c2`]とdocs commit[`32fe544`・`26217f6`]を含む)へfast-forward merge・push完了
- CI(`generate`ワークフロー)による自動コミット`a43712e`(「自動生成：アプリページを更新」)が発生。差分を確認したところ、`sitemap.xml`内のtyushi.htmlの`<lastmod>`が`2026-09-07`→`2026-09-08`に更新されたのみ(過去Batchのsitemap.xml更新と同一パターン)。ファイル更新日時に伴う無害なSEOメタデータ更新であり、本Fixの内容とは無関係。`git merge --ff-only origin/main`でlocal mainを同期し、`main = origin/main = a43712e`とした
- Production Validationとしてマージされたmainのコンテンツをそのまま配信するローカルサーバ(port 9105)上で実機再テストを実施し、User Browser Reviewで報告された正確な再現手順(A11yパネルを開きTabを20回連続で押す)を再実行、RC2時と同一の結果(A11yパネル関連クラスタ内で正しく循環し、help-overlayへ一切脱出しない)がPASSすることを確認。A11yパネルをトグルボタンで閉じた後のhelp-overlay Trap復帰(Forward 15回・Reverse 15回・outside-focus-guard)もPASSを確認
- `TIER1-F3-g`のStatusを**FIXED IN RC2 / USER REVIEW PENDING**から**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `26217f6`)へ更新(§3該当行)
- **FAMILY-B Production残存件数: 10件 → 9件**(TIER1-F3-gが解消、残り9件は未着手)
- 投資調査branch `investigate/wcag-jis-finding-initial-restore-1`(`c6930d9`)は本Releaseでも変更なし
- worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-5`・branch `fix/family-b-tyushi-help-focus-trap`はcleanup済み(fully merged後に削除)

---

## 24. [2026-09-08追記] WCAG-JIS-FIX-FAMILY-B-BATCH-6 進捗

`TIER1-F3-j`(mogura-tataki `scrStart`)・`TIER1-F3-k`(`scrResult`)・`TIER1-F3-l`(`panSet`)・`TIER1-F3-m`(`panRec`)・`TIER1-F3-n`(`panHow`)の5 Findingすべてを`WCAG-JIS-FIX-FAMILY-B-BATCH-6`で同一Batchとして修正した。詳細は§3の該当行を参照。

- Status: 5 Finding全て = **FIXED IN RC / USER REVIEW PENDING**(Production未反映)
- worktree: `for-all-children-to-learn-wcag-jis-fix-family-b-batch-6`
- branch: `fix/family-b-mogura-focus-trap`
- **DOM構造再確認**: 5要素とも最新Productionで実在確認、Ledger記載の`scrStart`/`scrResult`/`panSet`/`panRec`/`panHow`のIDは完全一致。`scrStart`/`scrResult`は`.screen`クラス(z-index:200)、`panSet`/`panRec`/`panHow`は`.panel`クラス(z-index:300、より前面)。いずれも`role="dialog" aria-modal="true"`付与済み。`<main class="wrap">`(スコアバー・ゲームボード等、常設DOM)を実質的に遮断する構造であることを確認し、5要素ともModal Contract適用可能(YES)と再確認、reclassification不要と判断した。
- **5件を同一Batchで処理した判断根拠**: 全5要素が同一の開閉機構(`classList.add/remove('on')`によるdisplay:none⇔flex切替)を持ち、Tab keydown処理が皆無という同一Root Causeを共有していたため、「現在開いているトップmodal」を判定する単一のdocument-level keydown listenerで安全に一括処理可能と判断した。screen同士・panel同士はいずれも排他的にしか開かないが、ホーム画面(`scrStart`)が開いたままpanel系(`panHow`等)がその上に開くケースがあるため、優先順位判定(`.panel`系を`.screen`系より優先)で対応した。分割は不要と判断した。
- Pre-fix Evidence(実機確認、5要素とも同一パターンでCONFIRMED FAIL): 15回連続Forward Tab・15回連続Reverse Shift+Tab・強制outside-focus状態からのTab/Shift+Tabのいずれも背景要素(ゲーム画面ヘッダーのボタン・共通ツールバー等)へ脱出することを確認。immediate Shift+Tabは`scrStart`で偶然PASSしていたが、Forward側の確定FAILによりCONFIRMED FAILは揺るがない(他Batchで確立した「immediate Shift+Tabだけで判定しない」の実例が今回も再現)。5要素とも旧LEVEL-B(コード確認のみ)だったが、本Phaseの実機テストにより**全てLEVEL-Aへ昇格**(§5のEvidence Level集計をLEVEL-A 16/LEVEL-B 2に更新)。
- Fix architecture: `MOGURA_MODAL_IDS = ['panHow','panRec','panSet','scrResult','scrStart']`の優先順位配列から「現在開いているトップmodal」を判定する`moguraCurrentTopModal()`と、focusable算出・端点wrap・outside-focus-guardを行う単一のdocument-level keydown listenerを新規追加。register-app/scratch-app/nazorin-print/gaze-keyboard/tyushiの各Batchと同一設計思想。
- **[A11yパネル共存対策、Batch-5(tyushi)の教訓を最初から反映]** 実装前の検証で、共通A11yパネルがOPEN中にTabを連打すると、A11yパネル自身にFocus Trapが無いため、パネル内最後のfocusable(`donomanaA11yReset`)から`donomanaHomeBtn`→ゲーム画面ヘッダー(`btnHow`→`btnRec`→`btnFS`)を経てmogura自身のmodal内へ侵入する(実機再現: forward 23回、reverse方向は`donomanaLockBtn`→`donomanaRecordNavBtn`→BODYを経てわずか3回で侵入)ことを確認した。tyushiのBatch-5 RC2で確立した設計(A11yパネル+共通ツールバークラスタへのローカルなラップ処理)を最初から実装に組み込み、`moguraA11yClusterFocusables()`でクラスタ(`donomanaRecordNavBtn`→`donomanaLockBtn`→`donomanaA11yBtn`→[パネル内]→`donomanaHomeBtn`→`btnHow`→`btnRec`→`btnFS`)を算出、Forward 25回・Reverse 15回の実機検証でクラスタが完全に自己完結し、mogura側modalへ一切流出しないことを確認した。`donomanaA11yBtn`/`donomanaHomeBtn`/`donomanaLockBtn`はposition:fixedのため`offsetParent`が常にnullになる既知の仕様があり、Batch-5と同型の`getClientRects()+computed style`ベースの可視性判定を最初から採用した。
- A11yパネルを`donomanaA11yBtn`のトグルクリックで閉じた後、mogura側modalのTrapが正常に復帰すること(Forward 15回・outside-focus-guard)、3サイクル(A11yパネルOPEN→Tab確認→CLOSE→modal Trap確認)でlistener多重登録・stale state・Trap復帰失敗が無いことを実機確認済み。
- **FAMILY-B Production residual count: 9件のまま変わらず**(Production未反映のため)
- **RC candidate count: 5件**(TIER1-F3-j・k・l・m・n)
- Initial Focus: 5要素とも既存の欠如(activeElement=BODYまたはopenerに留まる)を実機確認、既存FAMILY-C Finding、今回修正せず。
- Focus Restoration: `panHow`/`panRec`/`panSet`は既存の`panelOpener`/`closePanelAndReturnFocus`によるopener復帰が正常に機能(regressionなし)。`scrStart`/`scrResult`は既存からFocus Restoration実装が皆無(`.focus()`呼び出しなし)であることを確認、新規FAMILY-D候補として記録(今回修正せず)。`panSet`の背景クリック閉じ経路は`closePanel`のみでFocus Restorationが働かない既存挙動も確認(今回変更せず)。
- Escape: `panRec`限定の既存Escape実装(regressionなし)を確認。他4要素はEscape未実装(既存、今回追加せず)。
- Background Suppression: 変更なし、既存状態を確認するのみ。
- Switch/Gaze/ゲーム操作: `addDwell`相当の視線入力ロジック(`startDwell`等)は`pointermove`ベースかつ`G.phase==='playing'`時のみ動作する設計で、今回追加したkeydown('Tab')専用listenerとイベント種別・発動条件が完全に独立していることをコード確認。実機でもゲーム開始(`btnStart`クリック/タップ)・ボードクリック・スコア表示の動作に regression が無いことを確認。
- Touch/Responsive(390×844・768×1024・1280×900): 各viewportで3パネル(panHow/panRec/panSet)のTab containment、`scrStart`のTab containmentとタップでのゲーム開始、いずれもPASS。
- Console/page errors: 0件。
- User Browser Review待ち。Production Release/main merge/cleanupは未実施。

---

## 25. [2026-09-09追記] WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC2: User Browser Review指摘とRC2修正

**RC1(§24)はUser Browser Reviewで以下2点の指摘を受けた。** §24の記述はRC1時点での実機確認結果であり削除・書き換えず、以下に実態とRC2での対処を追記する。

### User Browser Review指摘

1. A11y Panelを開いた状態でTabを続けると、mogura-tataki側へフォーカスが戻る。
2. A11y Panel内でTab操作した際、写真上グレーアウトしている設定項目を含め、「選択できない/到達できない/Tab対象として不自然」と感じるコントロールが多数ある。

### 重要な前提整理: 「A11y Panel」の指す対象

写真で言及された項目(ハイコントラスト・文字の大きさ・視線入力[ドウェル]・ドウェル時間・視線カーソル表示・ドウェル安定化・効果音)を実コードと照合した結果、**共通A11yパネル(`donomanaA11yPanel`)にはこれらの項目が一切存在しない**(共通パネルの内容は「表示モード」「文字の大きさ」「選択・タップの読み上げ」の3項目のみ、全て常時enabledのボタン)。一方、mogura-tataki独自の`panSet`(設定パネル、今回のFAMILY-B対象=`TIER1-F3-l`)の内容が写真の項目と完全一致した。これは、Userが実際に問題視した対象が、共通A11yパネル自体よりも、**A11yパネル経由(`donomanaA11yBtn`→`donomanaSettingsProxy`)で到達する`panSet`(アプリ設定パネル)**である可能性が高いことを示す。以降、両方について個別に実機再現・検証した。

### 実機再現(fresh pageで3回×forward/reverse、共通A11yパネル自体)

`donomanaA11yPanel`を開いた状態でForward Tab 40回・Reverse Shift+Tab 40回を3セットずつ実施したが、いずれもmogura側modalへの侵入は再現しなかった(RC1で実装したA11yパネル+共通ツールバークラスタのラップ処理は健全に機能している)。

### 実機再現(panSetを実際のUserフローで開いてTab連打)

`donomanaA11yBtn`→`donomanaSettingsProxy`クリック(またはキーボードのみでTab+Enter)で`panSet`を開き、Tab 20〜30回を実施したが、panSet自体のTrap内でも脱出は再現しなかった。

### 真のRoot Cause発見: panSetを閉じた「後」の1手

上記2つの直接テストでは再現しなかったため、`panSet`を開いて→閉じて→Tabを押す、という一連の自然な操作フローを再現したところ、以下を確認した:

1. `donomanaSettingsProxy`のクリックハンドラは、実際には`#btnSet`(ゲーム画面ヘッダー内、`opacity:0 !important;pointer-events:none !important;tabIndex=-1;aria-hidden=true`で常時不可視)を`.click()`することで`panSet`を開いており、この結果`panelOpener['panSet'] = btnSet`(不可視要素)が記録される(mogura-tataki既存の`openPanel`/`closePanelAndReturnFocus`機構の挙動、Batch-6以前から存在)。
2. `panSet`を閉じる(`clsSet`/`clsSet2`クリック)と、`closePanelAndReturnFocus('panSet')`が`btnSet.focus()`を呼び、`document.activeElement`が不可視の`btnSet`になる。
3. この状態で次にTabを押すと、**Batch-6 RC1で新規追加したoutside-focus-guard**が「activeElementがmodal(scrStart)の外にある」と正しく検知し、`scrStart`内の最初のfocusable要素(`homeHowBtn`)へ1回のTabで強制送還する。

**この最後の一手が「A11y Panelを開いた状態でTabを続けるとmogura-tataki側へフォーカスが戻る」というUser報告の実態と判断する。** Fix前(Production `origin/main`)の同一シナリオを直接比較したところ、Fix前は`btnSet→btnFS→DIV→DIV→...`と背景ヘッダー内を彷徨うだけで`scrStart`内には入らなかった(`in_scrStart=False`)。Fix後(RC1)は`btnSet→homeHowBtn`と1回のTabで明確に`scrStart`内へ移動する(`in_scrStart=True`)。

### Root Cause分離

- **Root Cause A(mogura側Focus Trap/cluster処理の誤り)**: 該当なし。scrStart/scrResult/panSet/panRec/panHowそれぞれのTrap、およびA11yパネル+共通ツールバークラスタのラップ処理は、いずれも実機で健全に機能していることを再確認した。
- **Root Cause B(A11yパネル内のfocusable/disabled状態の設計不整合)**: `panSet`内の`dwT`(ドウェル時間range)・`togCur`(視線カーソル表示checkbox)・`dwTol`(ドウェル安定化range)の3コントロールが、視線入力OFF時に親要素(`dwRow1`/`dwRow2`/`dwRow3`)の`style="opacity:.4"`のみで視覚的にグレーアウトされ、`disabled`属性も`tabindex="-1"`も一切設定されていないことを確認した(Tab到達可能・Enter/Space/矢印キーでの操作も可能なまま)。これは「視覚的disabledなのにTabでfocusされる」(disabled-state設計問題、Phase spec§4のパターンA)に該当する。視線入力ON/OFF切替前後でTab順序自体は変化しない(一貫している)ことも確認した。**これはmogura-tataki独自の`panSet`実装の問題であり、共通A11yパネル(`donomanaA11yPanel`)側の問題ではない**(共通A11yパネル自体には disabled/グレーアウトされたコントロールは一切存在しない)。既存のFinding Family taxonomy(FAMILY-A/B/C/D/E/I)のいずれにも正確には合致しないため、新Familyを勝手に作らず、**Separate Finding候補(仮称: disabled-state/keyboard operability設計)として記録し、今回のFAMILY-B Batchには含めない**。
- **Root Cause C(新規発見、今回RC2で対応)**: `panSet`の`panelOpener`記録が不可視要素(`btnSet`)を指してしまう既存の構造(Batch-6以前から存在)と、Batch-6で新規追加したoutside-focus-guardが組み合わさることで、User体験として「予期しない場所への強制移動」を生んでいた。これは「Root Cause A自体の欠陥」ではないが、**「Aが原因でUser操作を壊している部分」に該当する**(Fix前は単に背景を彷徨うだけだったのが、Fixが追加したoutside-focus-guardによって、より積極的かつ唐突な遷移に変わってしまった)。Phase spec§14「今回の修正で悪化しないこと」に照らし、RC2で対応する。

### RC2 Fix Architecture

`closePanelAndReturnFocus`関数に、`panelOpener[id]`が実際に可視・フォーカス可能な要素かどうかを検証する`isMoguraFocusReturnTarget()`を追加し、不可視(disabled/非connected/クライアント矩形なし/`visibility:hidden`/`display:none`/`opacity:0`のいずれか)の場合は、常時可視の`donomanaA11yBtn`へフォールバックするよう変更した。これは`openPanel`/`proxyBtn`のクリックハンドラ自体(共通A11yコード)には一切手を加えず、mogura-tataki側の復帰先検証ロジックのみをローカルに追加するもので、FAMILY-B(Focus Trap)Batchのスコープ内(Trap実装と直接相互作用する不具合の是正)として位置づける。`panHow`/`panRec`は元々openerが可視要素(`homeHowBtn`/`homeRecBtn`)のため、この変更による影響はない(実機確認済み、既存どおり`homeHowBtn`/`homeRecBtn`へ復帰)。

### RC2再検証結果(全項目実機確認)

- `panSet`を`donomanaSettingsProxy`経由で開いて`clsSet`で閉じた後: `activeElement`が`donomanaA11yBtn`(可視、opacity=1)に正しく着地することを確認。そこから次のTabで`scrStart`内(`homeHowBtn`)へ移動するのは、outside-focus-guardの意図した正しい動作。
- `panHow`/`panRec`(homeHowBtn/homeRecBtn経由): Focus Restorationが従来どおり(regressionなし)であることを確認。
- 共通A11yパネル(`donomanaA11yPanel`)自体を開いた状態でのForward/Reverse Tab: 40回連続で再度regressionなしを確認。
- 5modal(scrStart/scrResult/panSet/panRec/panHow)の基本Trap(Forward 15回・Reverse 15回・immediate Shift+Tab・outside-focus-guard): §24から変化なし、全てPASSを再確認。
- A11yパネル3-cycle(OPEN→Tab確認→CLOSE→modal Trap確認)・listener多重登録なし: 再確認済み。
- 視線入力ON/OFF切替前後のTab順序: `dwT`→`togCur`→`dwTol`→`togSnd`で一貫、切替による到達可能性の変化なし(Root Cause Bとして記録、今回修正せず)。
- Touch/Responsive(390×844・768×1024・1280×900): 再確認、全てPASS。
- Console/page errors: 0件。

### Separate Finding(記録のみ、今回のBatchに含めない)

- **panSet内のdisabled-state設計不整合**(Root Cause B): `dwT`/`togCur`/`dwTol`が視線入力OFF時にTab到達可能・操作可能なまま。候補Family: 既存taxonomy(FAMILY-A/B/C/D/E/I)のいずれにも正確には合致しないため、新Family名の正式決定はプロジェクトオーナーの判断を仰ぐ。
- (§24から継続)`scrStart`/`scrResult`のFocus Restoration欠如(FAMILY-D候補)。
- (§24から継続)Initial Focus欠如(FAMILY-C)。
- (§24から継続)`panSet`背景クリック閉じ経路のFocus Restorationなし(既存挙動)。

### 更新後の状態

- `TIER1-F3-j`〜`n` = **FIXED IN RC2 / USER REVIEW PENDING**
- FAMILY-B Production residual count: 9件のまま変わらず(Production未反映のため)
- RC candidate count: 5件(TIER1-F3-j・k・l・m・n)、変わらず
- User Browser Review再実施待ち。Production Release/main merge/cleanupは未実施。

---

## 26. [2026-09-09追記] WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC3: User Browser Review再FAILとkeyboard focus model完全再調査・RC3修正

**RC2(§25)はUser Browser Reviewで再度FAILし、以下3点の指摘を受けた。** §24・§25の記述はRC1/RC2時点での実機確認結果であり削除・書き換えず、以下に実態とRC3での完全な再調査・対処を追記する。今回はUser指示により「推測でFixを追加せず、まずkeyboard focus modelを完全に再調査すること」を厳守し、全項目を実DOM(Playwright/Chromium実機)で確認した。

### User Browser Review指摘(RC2)

1. 共通「アクセシビリティ設定」を開いた状態でTabを続けると、ホーム・つかいかた等mogura側・共通ツールバー側の項目へフォーカスが移動する。
2. Tab順序上に「全画面」等が含まれるように見えるが、実際の画面上には対応するボタンが表示されていないケースがある。
3. 「このアプリの詳細設定を開く」からpanSetを開きTabキーで移動すると、ハイコントラスト・視線入力等の画面上操作可能に見えるコントロールの一部にTabでフォーカスできない一方、視線入力OFF時に視覚的disabledに見える項目(ドウェル時間・視線カーソル表示・ドウェル安定化)へTabで到達・操作できる。

### 完全なTab順序トレース(実機、Forward/Reverse各35回)

共通A11yパネル(`donomanaA11yBtn`クリック直後)からのForward Tab 35回・Reverse Shift+Tab 35回を実施し、以下16項目からなる完全なTab順序を確定した:

`donomanaA11yBtn`→`donomanaSettingsProxy`→[表示モード2項目]→[文字サイズ3項目]→[読み上げ2項目]→`donomanaA11yReset`→`donomanaHomeBtn`→`btnHow`→`btnRec`→`btnFS`→`donomanaRecordNavBtn`→`donomanaLockBtn`→(wrap)

35回とも正しく循環しmogura側modalへの侵入自体は発生しなかった(RC1/RC2で確立したクラスタのラップ処理自体は健全)が、**このクラスタの構成メンバー選定自体に誤りがあった**ことが下記の比較調査で判明した。

### Root Cause最終分類

#### Root Cause A(再定義・確定): A11yパネルクラスタへのmogura固有ボタン誤含有

`git show origin/main:tyushi.html`でBatch-5(tyushi)の実際の実装を確認したところ、tyushiの`a11yClusterFocusables()`は`donomanaA11yBtn`+[パネル内]+`donomanaHomeBtn`のみで構成され、**アプリ固有のヘッダーボタンは一切含まれていなかった**。

対して`mogura-tataki.html`の`moguraA11yClusterFocusables()`(RC1で新規実装)は、
```js
const after=['donomanaHomeBtn','btnHow','btnRec','btnFS'].map(id=>document.getElementById(id));
```
と、mogura固有の`btnHow`(つかいかた)/`btnRec`(記録)/`btnFS`(全画面)まで誤ってクラスタに含めていた。「RC1でそう実装したから」という理由以外に正当化根拠はなく、**これがUser確認1(Tabを続けるとホーム・つかいかた等mogura側・共通ツールバー側へフォーカスが移動する)の直接原因**と確定した。

#### HIDDEN BUT FOCUSABLE実証(Root Cause Aの症状、User確認2の原因)

`scrStart`はページロード直後からデフォルトで`class="screen on"`(z-index:200)であり、`.hdr`(z-index:100)内の`btnHow`/`btnRec`/`btnFS`はCSS的には`display:flex;visibility:visible;opacity:1`だが、`document.elementFromPoint()`で実視認性を確認したところ、以下の通り**実際には`scrStart`に完全に覆われて視覚的に不可視**であることを確定的に証明した(標準的なdisplay/visibility/opacity/getClientRectsチェックでは検知不能):

```json
{"id":"btnHow","rect":{"w":36,"h":36},"elementAtPoint":"scrStart","isElementItselfOnTop":false}
{"id":"btnRec","rect":{"w":44,"h":44},"elementAtPoint":"scrStart","isElementItselfOnTop":false}
{"id":"btnFS","rect":{"w":36,"h":36},"elementAtPoint":"scrStart","isElementItselfOnTop":false}
```

これらがクラスタに含まれていたため、「画面上に見えないボタン(全画面等)」がTab順序に現れるというUser確認2が発生していた。Root Cause Aの修正(クラスタから除外)により自動的に解消される。

#### Visible Focus問題(新規分類、User確認3前半の原因)

実機フロー(`donomanaA11yBtn`→「このアプリの詳細設定を開く」→panSet)でTab到達性を検証した結果、**panSet内の全12コントロール(`togHC`/`fsN`/`fsL`/`fsX`/`togDw`/`dwT`/`togCur`/`dwTol`/`togSnd`/`togRm`/`sizeR`/speedChips×5/`clsSet2`)は技術的には全てTab到達できている**ことを確認した(`donomanaA11yPanel`は正しく`display:none`に戻っており、二重パネル干渉もないことを確認済み)。

しかし`togHC`/`togDw`/`togCur`/`togSnd`/`togRm`(`.tog input`パターンのトグルswitch、5項目とも同一HTML構造`<label class="tog"><input type="checkbox" id="...">​<span class="ts"></span></label>`)は、CSS上`.tog input{opacity:0;width:0;height:0}`のため`getBoundingClientRect()`が`{w:0,h:0}`となる。CSSソースを確認したところ、`.ts::before`と`.tog input:checked+.ts`系のセレクタのみが存在し、**`:focus`/`:focus-visible`関連のセレクタが一切存在しなかった**。つまりフォーカス自体は正しく`input`要素に当たっているが、視覚的フィードバック(focus indicator)が構造的に皆無であった。これは仕様書が明記する通り**「Focus Trap問題」ではなく「VISIBLE FOCUS問題」**であり、ユーザー体感としては「Tabを押しても何も反応がない=フォーカスできない」に見えていたと判断した。

#### Root Cause B(継続、変更なし・User確認3後半の原因)

`dwT`(ドウェル時間range)/`togCur`(視線カーソル表示checkbox)/`dwTol`(ドウェル安定化range)は、視線入力OFF時に親要素`opacity:.4`のみでグレーアウトされ、`disabled`属性・`aria-disabled`・`tabindex="-1"`のいずれも未設定でTab到達・操作可能なまま(§25 Root Cause Bと同一、変化なし)。これがUser確認3後半(視覚的disabledに見える項目へTabで到達・操作できる)の原因であり、§25で確立した方針どおり**Separate Finding継続**とする。

#### 新規発見: A11yパネルクラスタのoutside-focus-guard制約(Separate Finding候補、RC3スコープ外)

JSで`btnHow`(クラスタ外・かつどのmodalにも属さない`.hdr`内要素)へ強制フォーカスした後にTabを押すと、outside-focus-guardが働かずDOM順の次要素(`btnRec`)へ進むことを確認した。`git show origin/main:tyushi.html`で確認したところ、tyushiの同等ロジックも`!inCluster && overlay.contains(cActive)`という同一条件であり、**tyushiには`.hdr`のような複数ヘッダーボタン要素が存在しないため表面化していなかった設計限界**であると判明した。通常のTabキー操作のみでは(RC3修正後のクラスタで)この状態に到達すること自体が発生しない(Forward/Reverse各30回で確認、下記)ため、キーボードのみのUser操作では影響しない。外部要因(ブラウザ拡張機能等)による人工的なフォーカス移動でのみ顕在化するエッジケースであり、**RC3のスコープ外・Separate Finding候補(UNCLASSIFIED、A11yパネルクラスタのoutside-focus-guard強化)として記録する**。

### RC3 Fix Architecture(mogura-tataki.html内のみ、共通A11y実装は無変更)

1. **Root Cause A修正**: `moguraA11yClusterFocusables()`の`after`配列から`btnHow`/`btnRec`/`btnFS`を除外し、`['donomanaHomeBtn']`のみに変更(tyushiと同型のクラスタ構成に統一)。
2. **Visible Focus問題修正**: `.tog input:focus-visible+.ts{outline:3px solid var(--accent2);outline-offset:2px}`をCSSに追加。`.tog input`自体は`opacity:0;width:0;height:0`で視認不能なため、隣接する可視トラック本体`.ts`側へoutlineを転送する設計とした。既存の`:focus-visible{outline:3px solid var(--accent2);outline-offset:2px}`(652行目、他のA11y focus indicatorと同じ配色)との一貫性を保った。

いずれも`mogura-tataki.html`内のJS/CSSのみで完結し、`donomanaA11yPanel`/`openPanel`/`closePanel`等の共通A11y実装には一切手を加えていない。

### RC3検証結果(全項目実機確認)

- **A11yパネルクラスタForward/Reverse各30回**: mogura固有ボタン(`btnHow`/`btnRec`/`btnFS`)への越境=PASS(混入なし)、`donomanaA11yBtn`→`donomanaSettingsProxy`→[パネル内7項目]→`donomanaA11yReset`→`donomanaHomeBtn`→`donomanaRecordNavBtn`→`donomanaLockBtn`→(wrap)の11項目クラスタで完全に自己完結することを確認。
- **HIDDEN BUT FOCUSABLE解消確認**: `scrStart`がデフォルトで開いた状態(ページロード直後、実際のUser体験と同一条件)でA11yパネルForward Tab 20回を実施し、`btnHow`/`btnRec`/`btnFS`がTab順序に一切出現しないことを確認(修正前は視覚的に不可視のこれら3要素がクラスタに含まれていた)。
- **Visible Focus解消確認**: `togHC`/`togDw`/`togCur`/`togSnd`/`togRm`の5トグル全てにfocusした際、隣接`.ts`要素の`outlineWidth`が`3px`(`outline:"rgb(255, 217, 61) solid 3px"`)になることを実機確認、`togHC.matches(':focus-visible')`が`true`であることも確認。
- **panSet Tab順序退行なし**: `clsSet→togHC→fsN→fsL→fsX→togDw→dwT→togCur→dwTol→togSnd→togRm→sizeR→[speedChips×5]→clsSet2→(wrap)`、RC3修正前後で完全に同一順序であることを確認(Visible Focus修正はCSSのみのためTab順序に影響しないことを裏付け)。
- **5modal Focus Trap regression再確認**(Forward 15回・Reverse 15回、`scrStart`/`panHow`/`panRec`/`panSet`/`scrResult`の全5要素): 全てPASS、mogura側/背景要素への脱出なし。
- **Responsive(390×844/768×1024/1280×900)**: panSet内`sizeR`(スクロールが必要な位置)までTabで到達した際、3 viewportとも`getBoundingClientRect()`がviewport内に収まっている(ブラウザの自動scrollIntoViewが機能)ことを確認。
- **Touch regression**: `togHC`のタップでchecked状態がtoggleすること、`btnStart`のタップでゲーム開始(`scrStart.on`がfalseに遷移)することを確認、regressionなし。
- **Console/page errors**: 全テストを通じて0件。
- **Static Validation**: `git diff --check`で空白等のエラーなし、変更は2箇所(CSS 4行追加・JS `after`配列1行変更相当)のみで意図しない差分なし。

### Separate Finding(記録のみ、今回のBatchに含めない)

- (§25から継続)**panSet内のdisabled-state設計不整合**(Root Cause B): `dwT`/`togCur`/`dwTol`が視線入力OFF時にTab到達可能・操作可能なまま。既存taxonomy(FAMILY-A/B/C/D/E/I)のいずれにも正確には合致せず、新Family名の正式決定はプロジェクトオーナーの判断を仰ぐ(UNCLASSIFIED/NEEDS OWNER DECISION)。
- **(RC3で新規発見)A11yパネルクラスタのoutside-focus-guard制約**: クラスタ外・かつどのmodalにも属さない要素(`.hdr`内ヘッダーボタン等)へ外部要因でフォーカスが移動した場合、次のTabでガードされずDOM順の次要素へ進んでしまう。tyushiにも同型の制約があり(overlay内のみをガード対象とする設計)、通常のキーボード操作では発生しない。候補Family: 既存taxonomyには合致せず、UNCLASSIFIED/NEEDS OWNER DECISIONとして記録。
- (§25から継続)`scrStart`/`scrResult`のFocus Restoration欠如(FAMILY-D候補)。
- (§25から継続)Initial Focus欠如(FAMILY-C)。
- (§25から継続)`panSet`背景クリック閉じ経路のFocus Restorationなし(既存挙動)。

### 更新後の状態

- `TIER1-F3-j`〜`n` = **FIXED IN RC3 / USER REVIEW PENDING**
- FAMILY-B Production residual count: 9件のまま変わらず(Production未反映のため)
- RC candidate count: 5件(TIER1-F3-j・k・l・m・n)、変わらず
- User Browser Review再実施待ち。Production Release/main merge/cleanupは未実施。

---

## 27. [2026-09-09追記] WCAG-JIS-FIX-FAMILY-B-BATCH-6-RC4: User Browser Review再FAILとStrict Focus Containment実装

**RC3(§26)はUser Browser Reviewで再度FAILし、以下の指摘を受けた。** §24〜§26の記述は各RC時点での実機確認結果であり削除・書き換えず、以下に実態とRC4での対処を追記する。

### User Browser Review指摘(RC3)

右下の共通「アクセシビリティ設定」を開いた状態でTabをゆっくり繰り返すと、「ホーム」「学習の記録」「画面ロック」へフォーカスが移動することを確認。この挙動はNGとされ、**A11y Panel OPEN中は共通A11y Panel内部のfocusable controlsだけでTab/Shift+Tabを循環させ、共通toolbarやmogura側UIへは一切移動させない**という、RC1〜RC3のクラスタ設計(A11yパネル+共通ツールバーをまとめて循環させる方式、tyushiと同型)自体を否定する、より厳格な設計要求が示された。

### 再現結果(実機)

`donomanaA11yBtn`クリック後のForward Tabを追跡したところ、Tab#9で`donomanaA11yReset`(パネル内最後の項目)に到達した後、Tab#10で`donomanaHomeBtn`(ホーム)、Tab#11で`donomanaRecordNavBtn`(学習の記録)、Tab#12で`donomanaLockBtn`(画面ロック)へ順に移動し、Tab#13でようやく`donomanaA11yBtn`へ戻ってwrapすることを確認した。これはRC1で実装した`moguraA11yClusterFocusables()`の`before=['donomanaRecordNavBtn','donomanaLockBtn']`・`after=['donomanaHomeBtn']`によるクラスタ拡張そのものの挙動であり、RC3では一切変更していなかった箇所である(RC3はmogura固有ボタンの除外とVisible Focus問題のみ対処し、共通toolbar自体はクラスタに残したまま統一していた)。

### RC3までのfocus modelの問題点

RC1〜RC3は一貫して「A11yパネル+共通toolbar(`donomanaHomeBtn`等)を1つの循環グループとして扱う」設計(tyushiの実装を参考にした設計)を採用していたが、今回のUser Reviewでこの設計方針自体が明確に否定された。tyushiの実装(`git show origin/main:tyushi.html`で確認済み)も同型の設計であり、tyushi自体は今回のBatch対象外だが、将来的に同じ指摘を受ける可能性がある点は別途留意する。

### RC4 Strict Containment Architecture

`moguraA11yClusterFocusables()`を以下のとおり変更した:

- `before`(`donomanaRecordNavBtn`/`donomanaLockBtn`)・`after`(`donomanaHomeBtn`)の配列を完全に削除。
- クラスタは`donomanaA11yBtn`(トリガー自身、DOM構造上`donomanaA11yPanel`の外側の兄弟要素だが、除外リストに明記されていないため維持)+ `donomanaA11yPanel`内部の全focusable要素(`donomanaSettingsProxy`→[表示モード2項目]→[文字サイズ3項目]→[読み上げ2項目]→`donomanaA11yReset`の計7項目)の計8項目のみで構成する。
- outside-focus-guard条件も単純化: 従来は`!inCluster && modal && modal.contains(cActive)`(「現在開いているtop modal内」に限定)だったが、RC4では`!inCluster`のみを条件とし、クラスタ外にactiveElementがある場合は(modalに属するか否かを問わず)常にfirst/lastへ強制送還するよう変更した。これにより、RC3のFinal Reportで「Separate Finding候補」として記録していたoutside-focus-guardの制約(クラスタ外・かつどのmodalにも属さない要素へJS等でフォーカスが移った場合にガードされない問題)も同時に解消された。

`mogura-tataki.html`内のJSのみで完結し、共通A11y実装(`donomanaA11yPanel`/`openPanel`/`closePanel`等)には一切手を加えていない。

### RC4検証結果(全項目実機確認)

- **Forward Tab x30**: `donomanaA11yBtn→donomanaSettingsProxy→[パネル内7項目]→donomanaA11yReset→(wrap)donomanaA11yBtn`の8項目で完全に循環、`donomanaHomeBtn`/`donomanaRecordNavBtn`/`donomanaLockBtn`/`btnHow`/`btnRec`/`btnFS`への遷移は30回中ゼロ。
- **Reverse Shift+Tab x30**: 同様に8項目で完全に循環、禁止要素への遷移ゼロ。
- **outside-focus-guard**: JSで`donomanaHomeBtn`・`btnHow`(いずれもクラスタ外・かつどのmodalにも属さない要素)へ強制フォーカスした後、Tabで`donomanaA11yBtn`(cFirst)へ、Shift+Tabで`donomanaA11yReset`(cLast)へ、それぞれ正しく強制送還されることを確認(RC3で残っていた制約が解消)。
- **immediate Shift+Tab**: パネルを開いた直後(`donomanaA11yBtn`にactive)でShift+Tabを押すと`donomanaA11yReset`(cLast)へ正しく移動することを確認。
- **panSet連携**: `donomanaA11yBtn`→「このアプリの詳細設定を開く」経由でpanSetを開いた際、`donomanaA11yPanel`が正しく`display:none`に戻ること(二重所有なし)、panSet自身のTab循環(`clsSet→togHC→...→sizeR→[speedChips×5]`)がpanSet専用Trapで機能すること、panSetを閉じた後`donomanaA11yBtn`(可視要素、RC2のフォールバック機構)へ復帰し、続くTabで`scrStart`のTrap(`homeHowBtn→homeRecBtn→...`)が正常に復帰することを確認、regressionなし。
- **Visible Focus regression**: RC3で追加した`.tog input:focus-visible+.ts`によるoutline表示(3px)が、`togHC`/`togDw`/`togCur`/`togSnd`/`togRm`の全5トグルで維持されていることを確認。
- **disabled-state Separate Finding**: `dwT`/`togCur`/`dwTol`の視線入力OFF時Tab到達可能問題は変更なし、RC4の合否とは分離して継続。
- **5modal Focus Trap regression**(Forward 15回・Reverse 15回、`scrStart`/`panHow`/`panRec`/`panSet`/`scrResult`): 全てPASS、regressionなし。
- **Responsive(390×844/768×1024/1280×900)**: A11yパネルOPEN状態でのForward Tab x15、3 viewportとも禁止要素への遷移ゼロ、PASS。
- **Touch**: A11yパネルのtapでのopen/close、panSet内`togHC`のtapでのtoggle、`btnStart`のtapでのゲーム開始、いずれもregressionなし。
- **Console/page errors**: 全テストを通じて0件。
- **Static Validation**: `git diff --check`で空白等のエラーなし、変更は`moguraA11yClusterFocusables()`関数本体とkeydownリスナー内のoutside-focus-guard条件式のみで、意図しない差分・重複ID・重複listenerの追加なし。

### Separate Finding(記録のみ、今回のBatchに含めない、変更なし)

- (§25・§26から継続)**panSet内のdisabled-state設計不整合**(Root Cause B): 既存taxonomyのいずれにも正確には合致せず、UNCLASSIFIED/NEEDS OWNER DECISIONとして記録。
- **[RC4で解消]** §26で新規記録した「A11yパネルクラスタのoutside-focus-guard制約」は、RC4のstrict containment実装により解消されたため、Separate Findingとしては取り下げる。
- (§25・§26から継続)`scrStart`/`scrResult`のFocus Restoration欠如(FAMILY-D候補)。
- (§25・§26から継続)Initial Focus欠如(FAMILY-C)。
- (§25・§26から継続)`panSet`背景クリック閉じ経路のFocus Restorationなし(既存挙動)。

### 更新後の状態

- `TIER1-F3-j`〜`n` = **FIXED IN RC4 / USER REVIEW PENDING**
- FAMILY-B Production residual count: 9件のまま変わらず(Production未反映のため)
- RC candidate count: 5件(TIER1-F3-j・k・l・m・n)、変わらず
- User Browser Review再実施待ち。Production Release/main merge/cleanupは未実施。

---

## 28. [2026-09-09追記] WCAG-JIS-FIX-FAMILY-B-BATCH-6-RELEASE完了

RC4(§27)についてUser Browser Reviewを再実施したところ、**User Approved**を得た。

> A11y Panelを開いた状態でTab / Shift+Tabを繰り返しても、ホーム・学習の記録・画面ロック・つかいかた・きろく・全画面等へフォーカスが移らないことを確認しました。詳細設定を閉じた後のフォーカス復帰、Visible Focus、通常操作にも問題ありません。視線入力OFF時のdisabled-state不整合はSeparate Findingとして継続します。

### Release手順

1. baseline再確認: `origin/main`は引き続き`58799c6`(drift無し)。
2. mainのworktree(`C:/Users/jerry/Documents/GitHub/for-all-children-to-learn`)で`git merge --ff-only fix/family-b-mogura-focus-trap`を実行、`58799c6`→`9f8fb59`へfast-forward。
3. `git push origin main`実施。
4. CI確認(`git fetch origin`+`git rev-parse origin/main`、WebFetch不使用): push後30秒待機で`origin/main`が`9f8fb59`→`400f661`(`github-actions[bot]`による`自動生成：アプリページを更新`、`sitemap.xml`のみの通常差分)へ進行していることを確認、CI正常完了。
5. ローカルmainを`git merge --ff-only origin/main`で`400f661`へ追従。

### Production反映内容

- `TIER1-F3-j`(`scrStart`)・`TIER1-F3-k`(`scrResult`)・`TIER1-F3-l`(`panSet`)・`TIER1-F3-m`(`panRec`)・`TIER1-F3-n`(`panHow`)の5 Finding全てが**✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**。
- FAMILY-B Production residual count: **9→4に減少**(残るのは他アプリ由来の4 Findingのみ)。
- RC candidate count: 0(全てProduction反映済みのため)。

### 未解決事項(継続、Production未対応)

- **panSet内のdisabled-state設計不整合**(`dwT`/`togCur`/`dwTol`、視線入力OFF時Tab到達可能): 既存taxonomy(FAMILY-A/B/C/D/E/I)に合致せず、UNCLASSIFIED/NEEDS OWNER DECISIONとして継続記録。今回のRelease対象外。
- `scrStart`/`scrResult`のFocus Restoration欠如(FAMILY-D候補)、Initial Focus欠如(FAMILY-C)、`panSet`背景クリック閉じ経路のFocus Restorationなし(既存挙動): いずれも§24〜§27から継続、今回のRelease対象外。

### 更新後の状態

- `TIER1-F3-j`〜`n` = **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(commit `9f8fb59`、CI自動コミット`400f661`)
- FAMILY-B Production residual count: **4件**
- worktree(`for-all-children-to-learn-wcag-jis-fix-family-b-batch-6`)・branch(`fix/family-b-mogura-focus-trap`)・投資調査branch(`investigate/wcag-jis-finding-initial-restore-1`, `c6930d9`)は本Release作業では削除・変更せず維持。cleanupはUser指示を待って別途実施。
