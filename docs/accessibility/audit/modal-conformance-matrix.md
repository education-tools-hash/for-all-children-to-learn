# Modal Conformance Matrix(18アプリ × Contract項目)

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)確定に伴い、app固有モーダルを持つ18アプリの現状をContract項目ごとにPASS/PARTIAL/FAIL/N/Aで評価する。**本ファイルはFix対象の正式確定であり、実装は行わない。**

> **[v1.1再評価]** WCAG-JIS-MODAL-SPEC-DECISION-1-REVISIONで「Reverse Tab Boundary(initial focus anchor起点)」列を新設した。これは**過去の評価が誤りだったのではなく、Contract v1.1で新たに追加されたGateに基づく再評価**である(v1.0確定時点ではこの失敗モードが未発見だった)。matching-app/okane-app等の従来「Contract完全準拠」としていた評価は、この新Gateの追加によりPARTIALへ訂正する。

凡例: ✅PASS(Contract準拠) / 🟡PARTIAL(一部準拠) / ❌FAIL(未準拠) / — N/A(該当機能なし、または未検証)

| App | Dialog Semantics | Accessible Name | Initial Focus | Focus Trap(Forward) | **Reverse Tab境界(v1.1新設)** | A11yパネル例外 | Escape | Focus Restoration | 背景抑制 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| register-app | ✅ | ✅ | 🟡(Pattern3、最初のcontrol) | ✅(端点循環) | ✅(Pattern3のためinitial focus=firstと一致、構造的に非該当) | ❌(TIER1-F2) | ✅ | ❌(TIER1-F5、pmOpenerEl退行) | 🟡(系統B、モーダル自身のみ) | 8モーダル共通ヘルパー、Fix影響範囲大 |
| matching-app | ✅ | ✅ | 🟡**訂正(WCAG-JIS-FINDING-INITIAL-RESTORE-1)**: how-ov/settings-ov/record-ovはPattern1。vs-result-ov/clear-ov/edit-ovは「初期focus自体が無い」という旧記載は誤りで、実際はPattern3(`btn-vs-again`/`btn-again`/`edit-name`へ`.focus()`)で実装済み | ✅(端点循環) | ✅**Fix済み・Production反映済み(commit 6e9ddb6、main HEAD `64e026b`、WCAG-JIS-FIX-FAMILY-J-1-RELEASE)** | ✅ **参照実装** | ✅ | ✅**訂正・TECHNICALLY RESOLVED / PRODUCTION REFLECTED(WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE、commit `d729585`、Production Validation PASS)**: edit-ovは元々PASS。clear-ov/vs-result-ovは実機再検証の結果、旧想定(「ボタン押下は画面遷移するため対象外」、c6930d9調査時点の「Escape経由のみBODY退行」という整理も含め訂正)に反しbtn-again/btn-clear-back/btn-vs-again/btn-vs-back/Escapeの**全close経路でBODY退行していたことが判明**(startGame()/backToSel()がfocusを設定しないため)。card-grid先頭カード/start-btn/btn-backへの復帰をProduction実装、Production Validation実機確認済み | ✅(系統A) **参照実装** | A11yパネル例外・背景抑制は引き続き参照実装水準。詳細はfinding-initial-restore-1.md参照 |
| time-timer | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**CONFIRMED PASS(WCAG-JIS-FIX-FAMILY-J-1で実機再確認)。全3モーダル群(finishOverlay/PIN系4モーダル/helpModal)ともSub-pattern α(title自体をfirst変数に使用)または初期focus=firstFocusableのため構造的に非該当。旧「推定FAIL」は誤りだったと訂正** | ❌(TIER1-F2) | ✅ | — (未検証) | 🟡(系統B) | |
| mogura-tataki | 🟡(aria-label直接、labelledby未使用) | 🟡 | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | screen/panelベースの独自アーキテクチャ、深掘り要 |
| okane-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Fix済み・Production反映済み(commit 6e9ddb6、main HEAD `64e026b`、WCAG-JIS-FIX-FAMILY-J-1-RELEASE)。help/settings/records/customの4モーダル共通ハンドラで一括修正済み** | ✅ **参照実装** | ✅ | ✅**TECHNICALLY RESOLVED / PRODUCTION REFLECTED(WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE、commit `d729585`、Production Validation PASS)**: recordsModalは元々PASS(`recordsModalOpener`)。help/settings/customは実機確認でBODY退行を確認のうえ、`helpModalOpener`/`customModalOpener`(同型パターン)、settingsは共通A11yパネルProxy構造上の理由で固定`donomanaA11yBtn`復帰をProduction実装。customModalは実trigger(`.add-item-card`、tabindexなし)がfocus不能なため`#shop .diff-btn.active`へのfallbackも追加。Production Validation実機確認済み | ✅(系統A) **参照実装** | A11yパネル例外・背景抑制は引き続き参照実装水準。詳細はfinding-initial-restore-1.md参照 |
| scratch-app | ✅ | — (未検証) | 🟡(Pattern4、close btn) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | |
| nazorin-print | ✅ | ✅ | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | ✅(3モーダル共通実装) | ✅**訂正(WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1)**: 旧「libModalのみ復帰確認」は不完全な記録だった。help/batch/libの3モーダル全てclose時に固定triggerへ`.focus()`しておりCONFIRMED PASS | ❌(系統D) | 3モーダル(help/batch/lib)構成。詳細はfamily-d-cross-app-audit-1.md参照 |
| schedule-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Fix済み・Production反映済み(commit 6e9ddb6、main HEAD `64e026b`、WCAG-JIS-FIX-FAMILY-J-1-RELEASE)。print-modal/img-modalの2モーダルで確認(new-modalは初期focus自体が無く別問題、対象外)。独自の防御分岐[`modal.contains(active)`]は本失敗モードには無効だったが、境界修正で解消** | ✅ **参照実装** | ✅**TECHNICALLY RESOLVED / PRODUCTION REFLECTED(WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE、commit `d729585`、Production Validation PASS、print-modalのみ対象)**: `printModalOpener`+`closePrintModal()`をEscape/close button/背景クリック/印刷完了の全close経路に適用、Production Validation実機確認済み。new-modal/img-modalは同一の欠如パターンの疑いがあるが本Fix対象外、`WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1`候補として残存 | — (未検証、new-modal/img-modalは対象外) | 🟡(系統C、inertなし) | 背景inertなしでも端点循環が機能する例 |
| janken-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**CONFIRMED PASS(WCAG-JIS-FIX-FAMILY-J-1で実機再確認)。Sub-pattern α(`first=record-modal-title`)のため構造的に非該当。旧「推定FAIL」は誤りだったと訂正** | ❌(TIER1-F2) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tokei-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**CONFIRMED PASS(WCAG-JIS-FIX-FAMILY-J-1で実機再確認)。help/recordModalとも Sub-pattern α(`first=helpModalTitle`/`first=recordModalTitle`)のため構造的に非該当。旧「推定FAIL」は誤りだったと訂正** | ❌(TIER1-F2、両モーダル) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tyushi | ✅ | ✅(aria-label、TIER1-F1対応時に確認済み) | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | ✅ | — (未検証) | ❌(系統D) | H1修正済み(AUDIT-35-H1-IMPL-2)、モーダル自体は未着手 |
| gaze-keyboard(settingsModal) | ✅ | ✅ | ✅(Pattern1、PILOT-F1で修正済み) | ✅(端点循環) | ✅**Fix済み・Production反映済み(commit 6e9ddb6、main HEAD `64e026b`、WCAG-JIS-FIX-FAMILY-J-1-RELEASE)** | ✅(HARDEN-3で修正済み) | ✅ | ✅ | ✅(系統A) | Fix実績最多。Gaze/dwellコードへの副作用なしを確認 |
| gaze-keyboard(profileModal/hrModal) | ✅ | ✅(HARDEN-3で修正済み) | ✅(NEW-KNOWN-1で修正済み) | ❌(TIER1-F3、NEW-KNOWN-3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | Initial Focusのみ先行修正済み、Trap未実装 |
| hiragana-learn | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅(`traceSampleViewerPrevFocus`) | ❌(系統D) | katakana-appと共通実装 |
| katakana-app | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅ | ❌(系統D) | hiragana-learnと共通実装 |
| shiritori2 | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α(title=first直接代入)、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | 🟡(系統B、自身のみ) | |
| bosai-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| cup_game(helpModal) | ✅ | ✅ | ✅(**Fix済み、commit a53f307**) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅ | ❌(系統D) | Initial FocusのみFAMILY-C先行修正済み |
| ongaku-app(modal-help) | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| ongaku-app(modal-pin/export/share) | ✅**Fix済み(commit edd6299)** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み(端点循環、動的focusables)** | ✅**Fix済み(commit 891fd90、initial focus anchorを境界に含める形で実装。FAMILY-J発見の契機)** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み(Plan B1 inert、main内側/外側の非対称構造に対応した2方式実装)** | **✅ Production反映済み(WCAG-JIS-FIX-MODAL-ONGAKU-1-RELEASE、commit `c8a5bd0`、main HEAD `373b3d3`)。Reverse Tab境界を含むContract全項目PASSを達成した最初の実装** |

---

## 集計

| Contract項目 | PASS | PARTIAL | FAIL | N/A・未検証 |
|---|---|---|---|---|
| Dialog Semantics | 17(ongaku-app pin/export/share Fix済み含む) | 1(mogura-tataki) | 0 | 0 |
| Accessible Name | 17 | 0 | 0 | 1(scratch-app未検証) |
| Initial Focus | 12(ongaku-app pin/export/share Fix済み含む) | 2(register-app・scratch-app) | 4(mogura-tataki・nazorin-print・tyushi・gaze-keyboard[profileModal/hrModalのTrap側は別軸]) | 0 |
| Focus Trap(Forward) | 10(ongaku-app pin/export/share Fix済み含む) | 0 | 8(register-appを除く旧FT-1/FT-2対象) | 0 |
| **Reverse Tab境界(v1.1新設)** | **12(register-app・shiritori2・bosai-app・ongaku-app[modal-help]・time-timer・tokei-app・janken-app、いずれも構造的に非該当と実機確認済み。ongaku-app[pin/export/share]・matching-app・okane-app・schedule-app・gaze-keyboard[settingsModal]は全てProduction反映済み)** | 0 | 0(WCAG-JIS-FIX-FAMILY-J-1-RELEASEで全件Production解消) | 6(Trap自体がないため非該当のアプリ) |
| A11yパネル例外 | 4 | 0 | 11 | 3(未検証) |
| Escape | 13(ongaku-app pin/export/share Fix済み含む) | 0 | 0 | 5(未検証) |
| Focus Restoration | 11(ongaku-app pin/export/share Fix済み含む) | 1(nazorin-print) | 1(register-app、TIER1-F5) | 5(未検証) |
| 背景抑制(inert方式準拠) | 4(ongaku-app pin/export/share Fix済み含む) | 5(系統B) | 9(系統C+D) | 0 |

**[2026-09-07更新]** WCAG-JIS-FIX-FAMILY-J-1-RELEASEでmatching-app・okane-app・schedule-app・gaze-keyboard(settingsModal)のReverse Tab境界修正をmainへ統合・Production反映済み(commit `6e9ddb6`、main HEAD `64e026b`)。time-timer・tokei-app・janken-appは実機再確認の結果、Sub-pattern α等により構造的に非該当と判明し、CONFIRMED PASSへ訂正(修正不要)。**Contract全項目(Reverse Tab境界含む)でPASSしているのは、ongaku-app(modal-pin/export/share)・matching-app・okane-app・schedule-app・gaze-keyboard(settingsModal)の5モーダルグループ、全てProduction反映済み。** 18アプリ中17アプリが何らかのContract項目でFAIL/PARTIALを持つ状況自体は変わらないが、**FAMILY-J自体は35アプリ全体で正式にClose**した。

**「未検証」の項目について**: Tier1監査時点ではEscape/Focus Restoration/A11yパネル例外を全モーダルで網羅的に確認しておらず、一部は「疑わしい場合のみ直接コード確認」という方式だったため、本Matrixの「未検証」欄はFAIL/PARTIALの可能性を排除するものではない。**FAMILY別Fix着手時に該当アプリを再確認することを推奨する。**

---

## Fix対象数の正式確定(Contract基準)

| Family | Contract項目 | 対象アプリ数(FAIL+PARTIAL) |
|---|---|---|
| FAMILY-A | A11yパネル例外 | 11 |
| FAMILY-B | Focus Trap(Forward) | 8(ongaku-app pin/export/share分はFix済みのため除外) |
| FAMILY-C | Initial Focus(非推奨パターン含む) | 6(register-app・scratch-app[パターン移行]、mogura-tataki・nazorin-print・tyushi。ongaku-app pin/export/shareはFix済みのため除外) |
| FAMILY-D | Focus Restoration | 2(register-app・nazorin-print) |
| FAMILY-E | 背景抑制 | 13(系統B 5 + 系統C 1 + 系統D 7、ongaku-app pin/export/shareはFix済みのため除外) |
| **FAMILY-J** | **Reverse Tab境界** | **0(全対象解消・Production反映済み。ongaku-app・matching-app・okane-app・schedule-app・gaze-keyboard[settingsModal]、time-timer/tokei-app/janken-appはCONFIRMED PASSで対象外に訂正。FAMILY-J = CLOSED)** |

**Global Fix Triageで確認した件数(FAMILY-A:7・FAMILY-B:9)と、本Matrixで確認した件数(FAMILY-A:11・FAMILY-B:8)に差異がある。** これはGlobal Fix Triage時点ではFinding化されていた「確定Finding」のみをカウントしていたのに対し、本Matrixは**Contract確定に伴い新たに発覚したregister-app(Initial Focus Pattern3)・scratch-app(Pattern4)・mogura-tataki(aria-label直接指定)等の追加項目を含む**ため。**この差異は正式な追加Finding候補として次項で扱う。**

---

## Contract確定に伴う新規発覚事項(追加Finding候補)

| # | App | 項目 | 内容 | 推奨対応 |
|---|---|---|---|---|
| 1 | register-app | Initial Focus | 全8モーダルが「最初のfocusable要素」へfocus(Pattern3、非推奨) | FAMILY-C/A統合Fix時にTitle focusへ変更を推奨 |
| 2 | scratch-app | Initial Focus | helpModalがclose buttonへfocus(Pattern4、非推奨) | 同上 |
| 3 | mogura-tataki | Accessible Name | `aria-label`直接指定(可視タイトルがあるのに`aria-labelledby`未使用) | FAMILY-B Fix時に`aria-labelledby`へ統一を推奨 |
| 4 | nazorin-print | Focus Restoration | libModalのみ復帰実装、help/batchModalは未確認 | FAMILY-D調査対象に追加 |
| 5(v1.1追加) | matching-app・okane-app・schedule-app・gaze-keyboard(settingsModal) | Reverse Tab境界(FAMILY-J) | 実機再現済み。initial focus直後の最初のShift+Tabでmodal外へfocusが漏れる | ✅**修正済み・Production反映済み(commit `6e9ddb6`、main HEAD `64e026b`、WCAG-JIS-FIX-FAMILY-J-1-RELEASE)**。境界判定に`initialFocusAnchor`(`aria-labelledby`参照先)を追加、ongaku-appのFix実装[commit 891fd90]と同一パターン |
| 6(v1.1追加、訂正) | ~~time-timer・tokei-app・janken-app~~ | ~~Reverse Tab境界(FAMILY-J、推定)~~ | **WCAG-JIS-FIX-FAMILY-J-1で実機確認の結果、3アプリ全モーダルがSub-pattern α(title自身をfirst変数として直接使用)または初期focus=firstFocusableのため構造的に非該当と判明。「コード同型のため推定FAIL」という判断は誤りだった** | **対応不要。CONFIRMED PASSへ分類変更** |
| 7(v1.1追加) | okane-app(help/settings/custom modal)・schedule-app(print-modal) | Focus Restoration欠如(BODY退行、FAMILY-Jとは別問題) | WCAG-JIS-FIX-FAMILY-J-1のRegression Gate実施中に新規発見。close時に`.focus()`呼び出しが存在せず、モーダルを閉じるとfocusがBODYへ落ちる | 今回は対象外(FAMILY-D関連の別Findingとして今後切り分けを検討) |

**これらは今回のContract確定作業で新たに判明した事実であり、既存のTIER1/TIER2 Finding Registerには含まれていなかった。次のGlobal Fix実装Phaseで正式Finding化するか、既存Family内の追加対象として扱うかをUser判断とする(本Phaseでは判断・修正しない)。**
