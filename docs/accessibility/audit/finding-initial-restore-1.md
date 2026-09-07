# WCAG-JIS-FINDING-INITIAL-RESTORE-1 調査報告

**Phase種別**: 調査専用(Investigation-only)として開始。当初のPhase内ではProductionコード変更を行っていない。
**調査branch**: `investigate/wcag-jis-finding-initial-restore-1`(local commit `c6930d9`、baseline: `origin/main` @ `0b9555a`)
**関連文書**: [donomana-modal-accessibility-contract-v1_0.md](../donomana-modal-accessibility-contract-v1_0.md)(v1.1) / [modal-conformance-matrix.md](modal-conformance-matrix.md) / [global-fix-triage-1.md](global-fix-triage-1.md)

> **[2026-09-07 Production追記]** 本ドキュメントが提起したFindingは、後続のFix Phase `WCAG-JIS-FIX-FAMILY-D-RESTORE-1` → `WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE`(commit `d729585`)でProductionへ反映済み(matching-app/okane-app/schedule-appのTECHNICALLY RESOLVED対象は`modal-conformance-matrix.md`参照)。ただし**下記§2/§3の一部内容は最新のProduction再検証で訂正されている**(詳細は本追記の末尾を参照)。本文自体は調査時点の記録として保持し、削除・書き換えは行わない。

---

## 1. 背景

WCAG-JIS-FIX-FAMILY-J-1のRegression Gate実施中に以下2件の疑いが浮上し、正式なFinding化がされないまま記録のみに留まっていた。

- **A. matching-app**: `vs-result-ov`・`clear-ov`・`edit-ov` — 「Initial Focus未実装」との疑い
- **B. okane-app**: `help`・`settings`・`custom` modal — Focus Restoration未実装(BODY退行)の疑い
- **C. schedule-app**: `print-modal` — Focus Restoration未実装(BODY退行)の疑い

本Phaseは、これらを実機検証のうえ正式にFinding化(またはFinding該当なしと確定)することを目的とする。

---

## 2. 結論サマリ(20項目、調査時点)

1. **matching-app Initial Focus(A)は誤判定だったと確定。** `vs-result-ov`/`clear-ov`/`edit-ov`は全てPattern3(最初の意味あるcontrolへ`.focus()`)で実装済み。「初期focus自体が無い」というFAMILY-J-1時点の記載は誤り。**この訂正はそのままProduction docsへ反映済み。**
2. 具体的には `showVsResult()` が `btn-vs-again`、`showClear()` が `btn-again`、`openEdit()` が `edit-name` へ、それぞれ実装内で明示的に`.focus()`している(実機確認済み)。
3. matching-appの3モーダルはtitleがtabindex="-1"の`first`変数に含まれないため、FAMILY-J失敗モード(Reverse Tab境界)自体には構造的に非該当。
4. **matching-app Focus Restorationについて新たな知見が得られた。** `edit-ov`は`editOpener`変数+`donomanaReturnFocus()`ヘルパーにより、Escape・背景クリックいずれの閉じ方でも実機確認でPASS。
5. ~~`clear-ov`は主要導線(「もういちど」「せんたくへもどる」ボタン)では新しい画面状態へ遷移するため復帰の概念自体が薄いが、Escapeキーで閉じた場合のみ復帰処理が無くBODY退行することを実機確認(CONFIRMED FAIL)。~~ **[Production再検証で訂正、下記末尾参照]**
6. ~~`vs-result-ov`は`clear-ov`と同一の共通Escapeハンドラを使用するため構造的に同一のCONFIRMED FAILパターンと推定されるが、実機確認は完了していない。~~ **[Production再検証で訂正、下記末尾参照]**
7. **okane-app(B)はCONFIRMED FAILと確定。** `closeHelpModal()`・`closeSettingsModal()`・`closeCustomModal()`のいずれもコード上`.focus()`/`donomanaReturnFocus()`相当の呼び出しが一切無い。**Production Fix済み。**
8. 実機確認: `help`modalは実クリックで開く→Escape→`document.activeElement`が`BODY`に退行することを確認。
9. 実機確認: `settings`modalは共通A11yパネルの自動挿入CSSによりネイティブボタンが非表示化されており、実際の到達経路は`#donomanaSettingsProxy`経由のみ。この経路でもEscape後にBODY退行することを確認。
10. `custom`modalは`closeHelpModal()`/`closeSettingsModal()`と完全に同一構造(復帰処理なし)であるため、コード根拠によりCONFIRMED FAILと判定。
11. **schedule-app(C)はCONFIRMED FAILと確定。** `print-modal`のEscape・とじるボタン・背景クリックいずれの経路でもBODY退行を実機確認。**Production Fix済み。**
12. schedule-appの`new-modal`・`img-modal`・`print-modal`共通ハンドラにはopener保存・復帰処理が一切存在しない。`new-modal`/`img-modal`は本Findingの直接対象外として記録のみ。
13. **Finding ID提案**: FAMILY-Dの追加対象として、`FAMILY-D-2`(okane-app)、`FAMILY-D-3`(schedule-app)、`FAMILY-D-4`(matching-app)を提案。
14. **クロスアプリ影響調査(grep走査、修正は行っていない)**: `role="dialog"`を持つ41ファイル中、Opener/ReturnFocus系の変数名が検出されないファイルが24件存在。ヒューリスティックであり検出漏れの実例(nazorin-print等)も確認済みのため、「要個別確認候補リスト」として扱う。
15. **Fix設計提案(調査時点、実装はしていない)**: register-appのTIER1-F5是正パターンをokane-app/schedule-app/matching-appにも展開することを提案。
16. **Regression Risk評価**: close時にopenerへfocusを戻す追加処理のみで、Forward Tab・Reverse Tab境界・Focus Trap・Escapeの優先順位には影響しない設計を想定。
17. **ドキュメント更新の推奨**: `modal-conformance-matrix.md`のmatching-app行更新を推奨(その後実施・訂正済み)。
18. 同様に「Fix対象数の正式確定」表・「Contract確定に伴う新規発覚事項」表への追記を推奨(実施済み)。
19. **未解決事項(調査時点)**: (a) vs-result-ovのEscape経由Focus Restorationは構造推定のみで実機未確認、(b) okane-app customモーダルの実機確認未完了、(c) schedule-appのnew-modal/img-modal未確認、(d) クロスアプリ候補24件は個別実機検証が必要。
20. **調査時点の最終ステータス**: `WCAG-JIS-FINDING-INITIAL-RESTORE-1 = FINDINGS CLASSIFIED / READY FOR FIX DESIGN`。

---

## 3. 分類(調査時点)

| # | 対象 | 調査時点の分類 | Production確定後の状態 |
|---|---|---|---|
| 1-3 | matching-app: vs-result-ov/clear-ov/edit-ov Initial Focus | CONFIRMED PASS | 変更なし(Fix対象外) |
| 4 | matching-app: edit-ov Focus Restoration | CONFIRMED PASS | 変更なし |
| 5 | matching-app: clear-ov Focus Restoration(Escape経由のみ、と当初整理) | CONFIRMED FAIL(Escapeのみ) | **訂正: 全close経路(ボタン押下含む)でCONFIRMED FAILと判明、Production Fix済み** |
| 6 | matching-app: vs-result-ov Focus Restoration(Escape経由のみ、と当初整理) | NEEDS SPECIAL HANDLING(構造推定) | **訂正: 実ゲームプレイで実機確認し、全close経路でCONFIRMED FAILと確定、Production Fix済み** |
| 7-8 | okane-app: help/settings modal Focus Restoration | CONFIRMED FAIL | Production Fix済み |
| 9 | okane-app: custom modal Focus Restoration | NEEDS SPECIAL HANDLING(コード根拠) | Production Fix Phaseで実機確認完了、Fix済み |
| 10 | schedule-app: print-modal Focus Restoration | CONFIRMED FAIL | Production Fix済み |
| 11 | schedule-app: new-modal / img-modal Focus Restoration | UNRESOLVED | 未着手、`WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1`候補として残存 |

---

## 4. Production確定時の訂正(2026-09-07追記)

`WCAG-JIS-FIX-FAMILY-D-RESTORE-1`のRC Fix実装時、本ドキュメント§2-5/§2-6および§3の#5/#6で「Escape経由のみFAIL」としていた整理が**不正確だったことが判明した**。

具体的には、実際のゲームプレイ(カードを揃えてclear-ov/vs-result-ovを表示させる)によるReal-click実機テストの結果、`clear-ov`の「もういちど」ボタン、「せんたくへもどる」ボタン、Escapeキーの**いずれの close経路でも** `document.activeElement` が `BODY` に退行することを確認した。当初「ボタン押下は`startGame()`/`backToSel()`により画面遷移するため復帰対象外」としていた想定(Phase AUDIT-35-FIX-1Eの設計判断を踏襲したもの)は誤りで、`startGame()`/`backToSel()`のいずれも遷移後に明示的な`.focus()`を行っていなかったため、画面遷移パスも含めて全経路でBODY退行が発生していた。

この訂正を踏まえ、`WCAG-JIS-FIX-FAMILY-D-RESTORE-1`では当初のFinding(Escape経路のみ)より広い範囲(全close経路)を対象にFixを実装し、Production Validationで実機確認済みである。旧い「Escape経由のみ」という記述は本追記により訂正済みとして扱い、本文中の該当箇所は取り消し線で示すに留め、削除はしていない。

**最終状態**: `WCAG-JIS-FINDING-INITIAL-RESTORE-1`が提起したFindingのうち、matching-app/okane-app/schedule-appの対象modalはすべて`WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE`(commit `d729585`)でTECHNICALLY RESOLVED / PRODUCTION REFLECTEDとなった。schedule-appのnew-modal/img-modalおよびクロスアプリ候補24件は引き続き未着手。
