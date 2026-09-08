# WCAG-JIS-FAMILY-B-CROSS-APP-AUDIT-1 — Focus Trap Missing横断監査

**Phase種別**: 監査専用(Audit-only)。Production app codeの変更は一切行っていない。
**baseline**: `origin/main` = `main` = `d367e28`(drift無し)
**worktree**: `for-all-children-to-learn-wcag-jis-family-b-cross-app-audit-1`
**branch**: `investigate/family-b-focus-trap-cross-app-audit`

---

## 1. Purpose

Finding Family FAMILY-B(Focus Trap Missing)について、既存の`global-fix-triage-1.md`(TIER1-F3・TIER2-F2)記載分と、FAMILY-D調査(FAMILY-D-CROSS-APP-AUDIT-1・BATCH各種)の過程で新たに発見された未登録の候補(register-app delete-modal、cup_game settingsOverlay)を統合し、最新Productionで再確認のうえ正式に分類する。

---

## 2. Scope

対象は`modal-conformance-matrix.md`に記載のある20行(18アプリ+cup_game/gaze-keyboardの複数modal行)全てのFocus Trap(Forward)列。app codeの修正は行わない。Fix Batch設計のみ提示する。

---

## 3. Contract(Source of Truth)

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)REQUIRED:

- Forward Tab: lastFocusable → firstFocusable(端点循環)
- Reverse Tab: firstFocusable(またはinitialFocusAnchor、またはmodal外activeElement)→ lastFocusable
- Dynamic modal: keydownごとにfocusables再取得

FAMILY-J(Initial Focus Title Reverse-Tab Escape)は`PRODUCTION RELEASED / CLOSED`済みであり、本監査で再オープンしない。ただし各候補のimmediate Shift+Tab結果はEvidenceとして記録する(FAMILY-J regressionの有無を示す参考情報)。

---

## 4. Candidate Extraction

`modal-conformance-matrix.md`のFocus Trap(Forward)列を全20行から再集計。grep(`role="dialog"`・`keydown`・`Tab`等)によるコード上の兆候は候補抽出の参考に留め、実際の判定はEvidence(§5)による。

---

## 5. Evidence Methodology

各候補について:
1. 実際のtriggerから実クリックでmodalをopen
2. Initial focus確認
3. **immediate Shift+Tab**(open直後、一度もTabを押さない状態)→ modal内に留まるか
4. **Forward Tab連打**(最大40〜60回)→ 一度でもmodal外へ抜けるか

いずれかでmodal外へ抜けた場合、Focus Trap Missing(CONFIRMED FAIL)と判定する。immediate Shift+Tabだけが偶然DOM順序でmodal内に留まるケース(txtEdOv・cup_game settingsOverlay)を発見したため、**両方のテストを実施しない限りPASSと判定しない**ことをEvidenceとして重視した。

新規に実機確認(LEVEL-A)したもの、既存Production docsの記録をそのまま踏襲したもの(LEVEL-B、コード未変更のため陳腐化の兆候なし)を明記して区別する。

---

## 6. Confirmed Fail

| # | App | Modal | Evidence Level | Immediate Shift+Tab | Forward Tab | Pattern | Priority |
|---|---|---|---|---|---|---|---|
| 1 | register-app | delete-modal | **LEVEL-A(本Phase実機確認)** | 背景`record-open-btn`へ即座に脱出 | (該当性判定不要、reverse側で確定) | B1(Trap完全欠如) | P2 |
| 2 | cup_game | settingsOverlay | **LEVEL-A(本Phase実機確認、新規発見)** | 偶然内部に留まる(`toggleDwell`) | 29回目のTabでBODYへ脱出 | B1 | P2 |
| 3 | scratch-app | txtEdOv | **LEVEL-A(本Phase実機確認)** | 偶然内部に留まる(`txtBgCustom`) | 19回目のTabで`photoInp`(モーダル外)へ脱出 | B1 | P2 |
| 4 | scratch-app | cov | **LEVEL-A(本Phase実機確認)** | 背景`<a>`要素へ即座に脱出 | (reverse側で確定) | B1 | P2/P3 |
| 5 | cup_game | helpModal(helpOverlay) | **LEVEL-A(本Phase実機再確認)** | 背景`startBtn`へ即座に脱出 | (reverse側で確定) | B1 | P2 |
| 6 | nazorin-print | helpModal | **LEVEL-A(本Phase実機再確認)** | 背景`SECTION`要素へ即座に脱出 | (reverse側で確定) | B1 | P2 |
| 7 | nazorin-print | batchModal・libModal | LEVEL-B(既存記録踏襲、コード構造がhelpModalと同一、本Phaseで個別実機未実施) | — | — | B1(推定) | P2 |
| 8 | mogura-tataki | (screen/panelベース独自UI) | LEVEL-B(既存記録踏襲、TIER1-F3) | — | — | B7(独自アーキテクチャ、深掘り要) | P2 |
| 9 | tyushi | help-overlay | LEVEL-B(既存記録踏襲、TIER1-F3。settings-panelは§8参照) | — | — | B1 | P2 |
| 10 | gaze-keyboard | profileModal・hrModal | LEVEL-B(既存記録踏襲、TIER1-F3、NEW-KNOWN-3) | — | — | B1 | P2 |
| 11 | hiragana-learn | (該当modal) | LEVEL-B(既存記録踏襲、TIER2-F2) | — | — | B1(katakana-appと共通実装) | P2 |
| 12 | katakana-app | (該当modal) | LEVEL-B(既存記録踏襲、TIER2-F2、hiragana-learnと共通実装) | — | — | B1 | P2 |

**合計: 12件(9アプリ、うち本Phaseで新規にLEVEL-A確認したもの6件、既存Production docsをそのまま踏襲したもの6件)。**

---

## 7. Confirmed Pass(参照実装、端点循環)

| App | Modal |
|---|---|
| register-app | product-modal |
| matching-app | 全モーダル |
| time-timer | 全モーダル |
| okane-app | 全モーダル |
| schedule-app | 全モーダル |
| janken-app | 全モーダル |
| tokei-app | 全モーダル |
| gaze-keyboard | settingsModal |
| shiritori2 | 全モーダル |
| bosai-app | 全モーダル |
| ongaku-app | modal-help・modal-pin/export/share(WCAG-JIS-FIX-MODAL-ONGAKU-1-RELEASEで実装済み) |

いずれも既存Production docs(FAMILY-J関連のRegression Gateで実機確認済み)を踏襲。今回新規に個別再確認はしていないが、FAMILY-J-1-RELEASE以降これらのTab処理コードは変更されていないため陳腐化の兆候なし。

---

## 8. NOT APPLICABLE

| App | Modal | 理由 |
|---|---|---|
| tyushi | settings-panel | `WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1`で非modal disclosure panelと確定済み。Focus Trap意図的不在は正常な設計(背景常時操作可能、Gaze/dwell設定を主UIと並行調整する必要性)。**FAMILY-Bの対象外として除外**、CONFIRMED FAILに含めない |

---

## 9. False Positives

今回の候補抽出では、grep由来の明確なfalse positiveは検出されなかった(§4の通り、実際の判定は全てEvidenceベースで行い、コード上の兆候だけでFAIL計上していないため)。ただし判定プロセス自体で以下を教訓として記録する:

- **immediate Shift+Tabのみのテストは不十分**: cup_game settingsOverlay・scratch-app txtEdOvは、reverse方向の即時テストだけならPASSと誤判定していた可能性が高い。DOM順序の偶然により最初のShift+Tabだけモーダル内に留まるケースが実在するため、forward tab連打による全周確認が必須(§5の教訓)。

---

## 10. Finding Pattern分類

- **B1(Trap完全欠如)**: 11件中10件がこのパターン(register-app delete-modal、cup_game settingsOverlay・helpModal、scratch-app txtEdOv・cov、nazorin-print全3モーダル、tyushi help-overlay、gaze-keyboard profileModal/hrModal、hiragana-learn/katakana-app)
- **B7(独自アーキテクチャ、要個別設計)**: mogura-tataki(screen/panelベースの独自構造、既存matrix記載で「深掘り要」と明記)

B2〜B6(境界の一部だけ壊れている、動的focusables不整合、A11yパネル相互作用起因)に該当するものは今回発見されなかった。既存実装は「Trapが全く無い」か「Trapが完全に機能している(端点循環)」の二極化しており、中間的な部分的破損パターンは確認されなかった。

---

## 11. Priority

既存triage基準に従い、全件P2(操作継続は可能だが、モーダルからの意図しない離脱により文脈喪失・混乱を招く)とする。P1相当(操作完全不能)・P3相当(軽微)に該当するものは無し。

---

## 12. Forward Tab / Reverse Tab / Immediate Shift+Tab結果サマリ

§6の表に記載の通り。新規LEVEL-A確認6件のうち、**2件(cup_game settingsOverlay、scratch-app txtEdOv)はimmediate Shift+Tabで偶然PASSに見えたが、forward tab連打で真のFAILが判明**した。残り4件(register-app delete-modal、scratch-app cov、cup_game helpModal、nazorin-print helpModal)はreverse方向の時点で明確にFAILと確定した。

---

## 13. Dynamic Focusables

今回の候補にはFocus Trap自体が存在しないため、「動的focusablesの再取得」という論点(既にTrapがある前提での課題)は本質的に該当しない。CONFIRMED PASS側(register-app product-modal、schedule-app等)では、既存のkeydownごとの再取得実装が維持されていることを別Phase(FAMILY-D関連)のRegression Gateで確認済み。

---

## 14. A11y Panel Compatibility

Focus Trap Missing自体はA11yパネルとの直接の相互作用問題ではない。ただしcup_game settingsOverlay・register-app delete-modal等、A11yパネルProxy構造を持つアプリでFuture Fix実装時には、Trap追加がA11yパネルのEscape優先度([1]A11yパネル→[2]nested overlay→[3]main modal→[4]app state)を壊さないよう設計する必要がある(Fix Batch設計時の留意点として§16に記載)。

---

## 15. Separate Findings(FAMILY-B以外、本監査のスコープ外)

調査中に再確認された、既存の別Family Finding(今回変更なし):

| Finding | 対象 | Family |
|---|---|---|
| Escapeキーで閉じる仕組みが存在しない | cup_game settingsOverlay、scratch-app(setOv/helpOv/txtEdOv/cov共通)、tyushi settings-panel | 未分類(Escape機構) |
| role/aria-modal欠如 | cup_game settingsOverlay | FAMILY-A寄り |
| Initial Focus非理想着地 | cup_game settingsOverlay、tyushi | FAMILY-C |
| Focus Restoration(既に全件Production解消済み) | — | FAMILY-D(CLOSED) |
| 背景抑制(inert)欠如 | 複数アプリ(系統C・D) | FAMILY-E |

これらは今回Fixしない。既存のFAMILY-A/C/E管理体系、またはEscape機構の新規Finding登録候補として別途扱う。

---

## 16. Fix Batch Plan(設計のみ、実装しない)

既存Contract実装(register-app product-modal・matching-app・okane-app・schedule-app等のPattern)を参照実装として、B1パターンの11件を実装の類似性に基づき分割する:

- **Batch 1(低リスク、A11yパネルProxy構造なし)**: scratch-app(txtEdOv・cov)、nazorin-print(help/batch/lib)、mogura-tataki(要個別調査)、tyushi(help-overlay)
- **Batch 2(A11yパネルProxy構造あり、Escape優先度との整合要確認)**: cup_game(settingsOverlay・helpModal)、register-app(delete-modal)
- **Batch 3(既存共通実装への影響確認が必要)**: hiragana-learn・katakana-app(共通実装のため同時対応が自然)
- **Batch 4(NEW-KNOWN-3関連、影響範囲確認要)**: gaze-keyboard(profileModal・hrModal)

各BatchともFAMILY-J regression(Reverse Tab境界)・Initial Focus・Focus Restoration・Escape優先度への影響を、既存Contract実装パターン(端点循環+keydownごとのfocusables再取得)を踏襲して確認する設計とする。mogura-tatakiのみ独自アーキテクチャ(screen/panelベース)のため、Fix着手前に個別設計検討(DESIGN REVIEW)を推奨する。

---

## 17. Manual Validation Pending

以下は本監査でも未実施、WCAG/JIS全体のManual Validation Gateとして引き続き保持:

- NVDA
- VoiceOver
- Blue2実機
- Tobii実機

---

## 18. Final Status

`WCAG-JIS-FAMILY-B-CROSS-APP-AUDIT-1 = CROSS-APP AUDIT COMPLETE / READY FOR FIX BATCH`

CONFIRMED FAIL 12件(9アプリ)が存在するため、`NO TECHNICAL REMEDIATION REQUIRED`は該当しない。

---

## 19. Recommended Next Phase

Fix Batch 1〜4のいずれかをUser判断で選定し、`WCAG-JIS-FIX-FAMILY-B-BATCH-N`として着手することを推奨する。ただしFix Batch開始は本Phaseでは自動化しない。

---

## 20. 正規化による訂正(2026-09-08、WCAG-JIS-FAMILY-B-LEDGER-NORMALIZE-1)

**重要な訂正**: 本文書§6の「CONFIRMED FAIL 12件」という集計、および§10「B1=10件・B7=1件(合計11件)」というPattern内訳には、以下の構造的な欠陥があったことが後続の正規化Phaseで判明した:

1. nazorin-print行が`batchModal`・`libModal`の2つの独立したDOM要素(いずれも`role="dialog" aria-modal="true"`)を1行に束ねていた。
2. gaze-keyboard行が`profileModal`・`hrModal`の2つの独立した要素を1行に束ねていた。
3. mogura-tataki行は「screen/panelベースの独自アーキテクチャ」と曖昧に記載されていたが、実際には`scrStart`・`scrResult`・`panSet`・`panRec`・`panHow`という**5つの独立した`role="dialog" aria-modal="true"`要素**が存在し、コード確認の結果いずれもTab keydown処理を持たない(B1パターン)ことが判明した。
4. §10の「11件中10件」という記述自体も、§6の表の行数(12)と矛盾する単純な計算ミスだった。

**正規化後の正式な数値は、`docs/accessibility/audit/family-b-focus-trap-finding-ledger.md`を唯一のSource of Truthとする。**

- CONFIRMED FAIL: **18件**(本文書の12件から6件増加。nazorin-print+1、gaze-keyboard+1、mogura-tataki+4)
- Pattern: **B1=18件、B7=0件**(mogura-tatakiも精査の結果B1と判明したため、B7という区分自体が不要になった)
- Evidence Level: LEVEL-A=6件、LEVEL-B=12件、LEVEL-C=0件

本文書(§1〜§19)の記述は、その時点で得られていたEvidenceに基づく調査記録として削除せず保持する。以降のFix Batch着手・進捗管理は、本文書ではなく`family-b-focus-trap-finding-ledger.md`を基準とすること。
