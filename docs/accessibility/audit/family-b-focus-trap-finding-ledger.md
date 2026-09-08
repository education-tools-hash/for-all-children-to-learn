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
| 9 | TIER1-F3-g | tyushi | tyushi.html | `help-overlay` | Modal Dialog | YES | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(15回連続Tabで脱出せず、`help-close`⇄`.htab`間で正しく循環。pre-fix: 15回目までに背景`donomanaA11yBtn`[モーダル外]へ脱出) | **PASS**(15回連続Shift+Tabで脱出せず。pre-fix: 背景`donomanaA11yBtn`へ脱出) | **PASS**(help-btn[opener]からのShift+Tabは`help-close`へ、DOM順序上偶然PASSしていたが今回明示的に保証。pre-fix: 偶然PASSだったがForward側でFAIL確定) | **PASS**(`donomanaA11yBtn`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **FIXED IN RC / USER REVIEW PENDING**(`WCAG-JIS-FIX-FAMILY-B-BATCH-5`, worktree `for-all-children-to-learn-wcag-jis-fix-family-b-batch-5`, branch `fix/family-b-tyushi-help-focus-trap`。Production未反映) | Batch 5(注: Ledger当初案の「Batch 1」から実行順で5番目のBatchとして実施。同一Finding、番号相違のみ) | settings-panelとは別UI(§6参照、混同しない)、settings-panelには一切手を加えていない。**[別Finding発見・今回Fixせず]** `closeHelp()`にfocus復帰処理が一切無く、close後にactiveElementがBODYへ退行することを実機確認(新規FAMILY-D候補、既存Ledgerに未記録だった)。**[実装中に発見・修正済み]** 初期実装では共通A11yパネルとの競合回避条件式が無く、help-overlay表示中にA11yパネルを開いてTabを押すとA11yパネル内のfocusがhelp-overlay側Trapに強制送還される regressionが実機で確認されたため、他app(gaze-keyboard settingsModal等)と同型のA11yパネル競合回避条件式を追加して解消 |
| 10 | TIER1-F3-h | gaze-keyboard | gaze-keyboard.html | `profileModal` | Modal Dialog | **YES(実質modal。[2026-09-08訂正] 内側コンテナ`.prof-modal`にはsettingsModalの`.settings-modal`と異なり`role="dialog" aria-modal="true"`が付与されていないことをコード確認で発見。旧Ledgerの「YES」は結果として妥当だが根拠となるARIA属性の有無を未確認のまま記載していた。ARIA欠如自体は別Finding、今回scope外)** | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(20回連続Tabで脱出せず、`profModalTitle`⇄`profCancel`間で正しく循環。pre-fix: 20回目までに背景`rtClear`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`rtAlignL`へ脱出) | **PASS**(`profCancel`へ正しくwrap。pre-fix: 背景`BUTTON`へ即座に脱出) | **PASS**(`donomanaA11yBtn`へ強制focusした状態からTab/Shift+Tabいずれでもmodal内へ復帰) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE`, commit `f070ca1`。User Browser Review Approved、Production Validation実機再確認PASS済み) | Batch 4 | hrModalと兄弟関係の独立DOM要素、以前は誤って1行に統合されていた。Initial Focus(`#profModalTitle`、tabindex="-1")はFAMILY-J対応のanchor境界処理が必要(settingsModal既存Trapと同型) |
| 11 | TIER1-F3-i | gaze-keyboard | gaze-keyboard.html | `hrModal` | Modal Dialog | **YES(実質modal。[2026-09-08訂正] 内側コンテナ`.hr-modal`も同様に`role="dialog" aria-modal="true"`が付与されていないことをコード確認で発見。ARIA欠如自体は別Finding、今回scope外)** | YES | **LEVEL-A(実機確認により旧LEVEL-Bから昇格)** | **PASS**(20回連続Tabで脱出せず。pre-fix: 20回目までに背景`btnCopy`[モーダル外]へ脱出) | **PASS**(20回連続Shift+Tabで脱出せず。pre-fix: 背景`rtAlignL`へ脱出) | **PASS**(`histClearBtn`へ正しくwrap。pre-fix: 背景`BUTTON`へ即座に脱出) | **PASS**(`donomanaA11yBtn`へ強制focusした状態から復帰確認) | B1 | P2 | **✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(`WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE`, commit `f070ca1`) | Batch 4 | 同上。Initial Focusは常設focusableな`.hr-tab.active`自体のためanchor特別扱い不要。履歴/レポートタブ切替による動的DOM再構築後もTrap維持を実機確認(RC・Production両方で再確認) |
| 12 | TIER2-F2-c | hiragana-learn | hiragana-learn.html | `traceSampleViewer` | Modal Dialog | YES | YES | LEVEL-B(既存Production docs記録踏襲、コード未変更) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 6 | katakana-appと共通実装(コード共有、ファイルは別) |
| 13 | TIER2-F2-d | katakana-app | katakana-app.html | `traceSampleViewer` | Modal Dialog | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 6 | hiragana-learnと共通実装 |
| 14 | TIER1-F3-j | mogura-tataki | mogura-tataki.html | `scrStart` | Modal Dialog(`.screen`、`position:fixed;inset:0`のフルスクリーンoverlay、`role="dialog" aria-modal="true"`) | YES(developer自身が明示的にdialog/aria-modal指定) | YES | LEVEL-B(コード確認: ファイル全体でTab keydown処理が皆無) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 7(個別設計要) | 旧「screen/panelベース独自アーキテクチャ、深掘り要」を本Ledgerで5要素に分解・特定 |
| 15 | TIER1-F3-k | mogura-tataki | mogura-tataki.html | `scrResult` | 同上(`.screen`) | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 7 | |
| 16 | TIER1-F3-l | mogura-tataki | mogura-tataki.html | `panSet` | Modal Dialog(`.panel`、同様のフルスクリーンoverlay) | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 7 | |
| 17 | TIER1-F3-m | mogura-tataki | mogura-tataki.html | `panRec` | 同上(`.panel`) | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 7 | |
| 18 | TIER1-F3-n | mogura-tataki | mogura-tataki.html | `panHow` | 同上(`.panel`) | YES | YES | LEVEL-B(同上) | 未確認 | 未確認 | 未確認 | 未確認 | B1 | P2 | CONFIRMED FAIL | Batch 7 | |
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
| **LEVEL-A** | **11**(2026-09-08、`WCAG-JIS-FIX-FAMILY-B-BATCH-5`でtyushi help-overlayを実機確認によりLEVEL-Bから昇格。直前は10件[`WCAG-JIS-FIX-FAMILY-B-BATCH-4`でgaze-keyboard profileModal・hrModalを昇格]、さらに前は8件[Batch 3でnazorin-print batchModal・libModalを昇格]、当初6件) | register-app(delete-modal)、cup_game(settingsOverlay・helpOverlay)、scratch-app(txtEdOv・cov)、nazorin-print(helpModal・batchModal・libModal)、gaze-keyboard(profileModal・hrModal)、tyushi(help-overlay) |
| **LEVEL-B** | **7**(直前は8件、上記1件がLEVEL-Aへ移動。当初12件) | hiragana-learn(traceSampleViewer)、katakana-app(traceSampleViewer)、mogura-tataki(scrStart・scrResult・panSet・panRec・panHow) |
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
