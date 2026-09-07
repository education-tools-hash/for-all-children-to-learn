# WCAG-JIS-FAMILY-D-CLOSE-1 — FAMILY-D Focus Restoration Formal Closure

**Phase種別**: docs-only Closure。Production app codeの変更は一切行っていない。
**baseline**: `origin/main` = `main` = `b8a0743`(drift無し)
**worktree**: `for-all-children-to-learn-wcag-jis-family-d-close-1`
**branch**: `docs/family-d-focus-restoration-close-1`

---

## 1. Purpose

FAMILY-D(Focus Restoration)について、`WCAG-JIS-FINDING-INITIAL-RESTORE-1`に端を発し、`WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1`・3つのFix Batch・tyushi Design判定へと至った一連の調査・修正・設計判断を統合し、そのlineageの範囲におけるtechnical remediationを正式にClose(または残存事項を明記)する。

---

## 2. Scope

本Closureが対象とするのは、以下のlineageで発見・分類・対応した findings のみである:

1. `WCAG-JIS-FINDING-INITIAL-RESTORE-1`(matching-app Initial Focus誤判定訂正、okane-app/schedule-app Focus Restoration新規発見)
2. `WCAG-JIS-FIX-FAMILY-D-RESTORE-1`(-RELEASE)
3. `WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1`(-RELEASE)
4. `WCAG-JIS-FIX-FAMILY-D-BATCH-1`(-RELEASE、schedule-app)
5. `WCAG-JIS-FIX-FAMILY-D-BATCH-2`(-RELEASE、scratch-app)
6. `WCAG-JIS-FIX-FAMILY-D-BATCH-4`(-RELEASE、cup_game)
7. `WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1`(-RELEASE)

**本Scopeに含まれないもの(重要)**: `global-fix-triage-1.md`のFinding `TIER1-F5`(register-app、FAMILY-D、「pmOpenerEl退行」)は、上記lineageの**開始前から存在する別系統のFAMILY-D Finding**であり、本lineageのいずれのPhaseでも調査・修正対象になっていない。**現時点でもOpenのまま**であることを本Closure作成時に`modal-conformance-matrix.md`を再確認して確定した(§9参照)。本Closureは、この既存Findingを解消したとは主張しない。

---

## 3. Source of Truth

- `docs/accessibility/donomana-modal-accessibility-contract-v1_0.md`(v1.1)
- `docs/accessibility/audit/modal-conformance-matrix.md`
- `docs/accessibility/audit/family-d-cross-app-audit-1.md`
- `docs/accessibility/audit/family-d-tyushi-design-1.md`
- `docs/accessibility/audit/finding-initial-restore-1.md`
- `docs/accessibility/audit/global-fix-triage-1.md`

---

## 4. Initial Finding History

- FAMILY-D-RESTORE-1調査中、`WCAG-JIS-FIX-FAMILY-J-1`のRegression Gate実施中に、matching-app(vs-result-ov/clear-ov/edit-ov)・okane-app(help/settings/custom)のFocus Restoration疑いが浮上。
- `WCAG-JIS-FINDING-INITIAL-RESTORE-1`で正式Finding化。matching-appの「Initial Focus未実装」は誤判定(実際はPattern3で実装済み)と訂正。okane-app/schedule-appのFocus Restoration欠如をCONFIRMED FAILと確定。

---

## 5. Cross-App Audit Summary

`WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1`にて、旧grep手法による「24候補ファイル」を再検証。

- 10アプリ: アプリ固有modal無し(共通A11yパネルのみ) → NOT APPLICABLE
- 6アプリ11モーダル(janken-app・shiritori2・tokei-app・nazorin-print・cup_game[helpModal]・scratch-app[setOv/helpOv]): grepのfalse negativeでCONFIRMED PASSと判明
- 真のCONFIRMED FAIL: **5モーダル**(cup_game settingsOverlay、schedule-app new-modal/img-modal、scratch-app txtEdOv/cov)
- tyushi settings-panel: NEEDS SPECIAL HANDLING(判定保留)

---

## 6. Fix History

| Phase | 対象 | app fix commit | 検証 |
|---|---|---|---|
| WCAG-JIS-FIX-FAMILY-D-RESTORE-1-RELEASE | matching-app(clear-ov・vs-result-ov)、okane-app(help/settings/custom)、schedule-app(print-modal) | `df1506b`→Production `d729585` | LEVEL-A |
| WCAG-JIS-FIX-FAMILY-D-BATCH-1-RELEASE | schedule-app(new-modal・img-modal) | `b56a6ad`→Production `29e7669` | LEVEL-A |
| WCAG-JIS-FIX-FAMILY-D-BATCH-2-RELEASE | scratch-app(txtEdOv・cov) | `3466a49`→Production `9db60be` | LEVEL-A |
| WCAG-JIS-FIX-FAMILY-D-BATCH-4-RELEASE | cup_game(settingsOverlay) | `c8edce5`→Production `1170a28` | LEVEL-A |
| WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1-RELEASE | tyushi(settings-panel) | app code変更なし(設計判定のみ) | LEVEL-A |

---

## 7. Closure表(対象別)

| 対象 | Finding | Evidence Level | Resolution | Production commit | Current status |
|---|---|---|---|---|---|
| matching-app clear-ov | 全close経路(ボタン押下含む)でBODY退行 | LEVEL-A | Fixed | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| matching-app vs-result-ov | 同上(clear-ovと同一構造から確認) | LEVEL-A | Fixed | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| matching-app edit-ov | 既存実装が正常(Fix対象外) | LEVEL-A | N/A(元々PASS) | — | ✅ CONFIRMED PASS(参照実装) |
| okane-app help modal | 全close経路でBODY退行 | LEVEL-A | Fixed(`helpModalOpener`) | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| okane-app settings modal | 全close経路でBODY退行(A11yパネルProxy構造) | LEVEL-A | Fixed(固定`donomanaA11yBtn`復帰) | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| okane-app custom modal | 全close経路でBODY退行(実triggerがtabindexなし) | LEVEL-A | Fixed(`customModalOpener`+fallback) | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| okane-app records modal | 既存実装が正常(Fix対象外) | LEVEL-B | N/A(元々PASS、`recordsModalOpener`) | — | ✅ CONFIRMED PASS(参照実装) |
| schedule-app print-modal | 全close経路でBODY退行 | LEVEL-A | Fixed(`printModalOpener`) | `d729585` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| schedule-app new-modal | 全close経路でBODY退行 | LEVEL-A | Fixed(`newModalOpener`) | `29e7669` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| schedule-app img-modal | opener保存・復帰処理なし(実triggerがtabindexなし) | LEVEL-A(監査時LEVEL-Bから格上げ) | Fixed(`#tab-editor`固定fallback) | `29e7669` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| scratch-app setOv/helpOv | 既存実装が正常(Fix対象外) | LEVEL-B | N/A(元々PASS) | — | ✅ CONFIRMED PASS |
| scratch-app txtEdOv | close後、非表示要素(opacity:0)にfocus残留(nested overlay) | LEVEL-A(監査時LEVEL-Bから格上げ) | Fixed(`txtEdOpener`+`addTextBtn`fallback) | `9db60be` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| scratch-app cov | 状態遷移型オーバーレイ、close経路にfocus処理なし | LEVEL-A(監査時LEVEL-Bから格上げ) | Fixed(`chgBtn`固定fallback) | `9db60be` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| nazorin-print help/batch/lib | 既存実装が正常(旧「libModalのみ」記載は不完全だった) | LEVEL-B | 訂正のみ(Fix不要) | — | ✅ CONFIRMED PASS(訂正済み) |
| cup_game helpModal | 既存実装が正常(Fix対象外) | LEVEL-B | N/A(元々PASS) | — | ✅ CONFIRMED PASS |
| cup_game settingsOverlay | 全close経路でBODY退行(A11yパネルProxy構造) | LEVEL-A | Fixed(固定`donomanaA11yBtn`復帰) | `1170a28` | ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED |
| janken-app・tokei-app・shiritori2 各modal | 既存実装が正常(grepのfalse negativeで未検出だった) | LEVEL-B | N/A(元々PASS) | — | ✅ CONFIRMED PASS |
| tyushi settings-panel | Non-modal disclosure panel、Focus Restoration Contract適用外 | LEVEL-A | 設計判定(Fix不要) | — | ✅ NOT APPLICABLE |
| tyushi help-overlay | Initial Focus欠如が根本原因、Restoration自体は無регression | LEVEL-A | N/A(FAMILY-C領域の別Finding) | — | ✅ NOT APPLICABLE(FAMILY-D観点) |
| **register-app(TIER1-F5)** | **`pmOpenerEl`退行(既存実装が機能していない)** | LEVEL-B(過去監査時点) | **未着手** | — | 🔴 **OPEN(本Closure対象外、別Finding)** |

---

## 8. Separate Findings(FAMILY-D以外、Closeを妨げない)

調査の過程で発見したが、FAMILY-D以外の別Familyに属するため今回Fixしていない事項:

| Finding | 対象 | 該当Family(推定) | Severity |
|---|---|---|---|
| settingsOverlayに`role`/`aria-modal`が無い | cup_game | FAMILY-A寄り(semantics) | 未分類 |
| Initial FocusがA11yパネルProxy側fallbackで非理想着地(`dwellTimeSlider`等) | cup_game、tyushi | FAMILY-C | 未分類 |
| Escapeキーで閉じる仕組み自体が存在しない | cup_game settingsOverlay、scratch-app(setOv/helpOv/txtEdOv/cov共通)、tyushi settings-panel | 未分類(Escape機構) | 未分類 |
| Focus Trap自体が存在しない(意図的/非意図的混在) | scratch-app、tyushi(意図的=非modal)、mogura-tataki等 | FAMILY-B | TIER1-F3等で既存追跡 |
| A11yパネルProxy再トグルclose時、非表示要素へfocus残留 | tyushi(発見箇所)、Proxy機構共通の可能性 | Pattern D5派生、横断課題候補 | P3 |

これらは既存のFAMILY-B(TIER1-F3等)・FAMILY-A(TIER1-F2等)の枠組みで別途管理されているか、今後新規Finding登録が必要である。**FAMILY-D Closureはこれらの解消を意味しない。**

---

## 9. Residual Count(訂正版)

| 区分 | 件数 | 内訳 |
|---|---|---|
| 本lineageのCONFIRMED FAIL残存 | **0** | Cross-App Auditで確定した5件は全てProduction反映済み |
| 本lineageのNOT APPLICABLE | 1 | tyushi settings-panel |
| **FAMILY-D全体(global-fix-triage-1.md TIER1-F5含む)の残存Open** | **1** | **register-app(`pmOpenerEl`退行)** — 本lineage開始前からの既存Finding、未着手のまま |

**重要な訂正**: `modal-conformance-matrix.md`の集計表(「Fix対象数の正式確定」§)に残っていた `FAMILY-D | Focus Restoration | 2(register-app・nazorin-print)` は、nazorin-print訂正(CONFIRMED PASSへ変更済み)を反映しておらず陳腐化していた。本Closureで `1(register-app のみ)` へ訂正する(§10)。

---

## 10. Existing Docs更新

### modal-conformance-matrix.md

- 「Fix対象数の正式確定」表のFAMILY-D行を `2(register-app・nazorin-print)` → `1(register-appのみ、nazorin-printはCONFIRMED PASSへ訂正済みのため除外)` に更新。
- register-app行のFocus Restoration列(`❌(TIER1-F5、pmOpenerEl退行)`)はそのまま維持(既存の正しい記載、変更不要)。

### global-fix-triage-1.md

- TIER1-F5行の状態は `Open` のまま維持する(誤って`Closed`にしない)。
- ただし「既知Fixパターン」欄に、本lineageで確立された`xxxOpener`+`donomanaReturnFocus`型パターンが応用可能である旨を追記する(次のFix Phase候補としての参考情報)。

---

## 11. Manual Validation Pending

以下は本Closureの対象外、WCAG/JIS全体のManual Validation Gateとして引き続き残る:

- NVDA
- VoiceOver
- Blue2実機
- Tobii実機

`manual-review-strategy.md`のhigh-risk + representative pattern方式に従い、別途計画されるべきものであり、今回のdocs-only Closureでは実施していない。

---

## 12. Closure基準の判定

| 基準 | 判定 |
|---|---|
| 本lineageのcode-based confirmed findings修正完了 | ✅ PASS(5件全てProduction反映済み) |
| Design applicability判定完了(tyushi) | ✅ PASS(NOT APPLICABLE確定) |
| Production reflection完了 | ✅ PASS |
| 本lineageのresidual technical remediation = 0 | ✅ PASS |
| **FAMILY-D全体(global-fix-triage-1.md基準)のresidual = 0** | ❌ **FAIL(register-app TIER1-F5がOpenのまま)** |

**この最後の基準がFAILであるため、「FAMILY-D(Finding Family全体)が完全にCLOSEDである」とは主張しない。** 本Closureが確定するのは、**Initial-Restore調査からCross-App Auditに至るlineageの残存対応が完了した**という、より限定されたスコープの事実である。

---

## 13. Final Status

**`WCAG-JIS-FAMILY-D-CLOSE-1 = LINEAGE TECHNICAL REMEDIATION COMPLETE / FAMILY-D NOT FULLY CLOSED (register-app TIER1-F5 remains Open)`**

意味するもの:
- `WCAG-JIS-FINDING-INITIAL-RESTORE-1`→Cross-App Audit→Batch1/2/4→tyushi Designのlineageで発見された全Findingは、Production反映済みまたはNOT APPLICABLEとして正式に解消済み。

意味しないもの:
- FAMILY-D(Focus Restoration)という Finding Family全体が完全にClosedであること(register-app TIER1-F5が残る)。
- WCAG/JIS全体の完了。
- Manual AT Validationの完了。
- Modal Accessibilityの全Family(A/B/E/F/G/H/I等)の完了。

---

## 14. Next Audit Work

1. **register-app TIER1-F5の単独Fix Phase**(推奨: `WCAG-JIS-FIX-FAMILY-D-REGISTER-1`)。`pmOpenerEl`が退行する原因の実機再調査から開始し、本lineageで確立済みの`xxxOpener`+fallbackパターンが応用できるか検討する。
2. §8の別Family findings(Escape機構欠如の横断調査、Pattern D5派生のProxy機構共通課題等)の扱いをUserと相談し、必要なら新規Finding登録・別Phase化する。
3. Global Fix Triageの次候補選定(FAMILY-B/A/E/C/F/G/H/I、またはManual Validation)は、本Closure後にUserが優先順位を判断する。

---

## 15. 追記(2026-09-08、WCAG-JIS-FIX-FAMILY-D-REGISTER-1実施中)

register-app TIER1-F5のRoot Causeを実機確認: product-modalの保存(Save)経路のみ、`closeModal()`直前に呼ばれる`renderProducts()`が商品グリッド全体(`.add-product-card`・各`.product-card`・editボタン含む)を再生成するため、`pmOpenerEl`が指す旧DOMノードがdisconnectedになりBODY退行していた(cancel/Escape経路は`renderProducts()`を呼ばないため元々正常)。`pmOpenerProductId`を追加保持し、disconnected時は再描画後の同一商品の`.product-card`(新規追加時は`.add-product-card`)へfallbackするRC Fixを実装、Browser ValidationでLEVEL-A確認済み(cancel/save/Escape/Responsive/Touch全PASS、FAMILY-J境界・console/page errorsとも regression無し)。

RC作成中に**別Finding**を新規発見: `delete-modal`(同じregister-app内、専用のopener trackingを持たない一般`openModal`/`closeModal`のみ)もcancel経路でBODY退行することを実機確認(LEVEL-A)。これはTIER1-F5(product-modal限定)とは別のFindingであり、本Fix Phaseのscope外のため未着手のまま記録する。

本Closure文書(§9 Residual Count、§12 Closure基準、§13 Final Status)の結論(FAMILY-D NOT FULLY CLOSED)はこの時点でも変わらない。register-appのFix自体がProduction反映されるまでは、本文書のstatusを更新しない。
