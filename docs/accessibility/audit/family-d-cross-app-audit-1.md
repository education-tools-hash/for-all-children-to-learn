# WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1 — Focus Restoration残存候補監査

**Phase種別**: 監査専用(Audit-only)。Production app codeの変更は行っていない。
**baseline**: `origin/main` = `main` = `683528d`(drift無し)
**worktree**: `for-all-children-to-learn-wcag-jis-family-d-cross-app-audit-1`
**branch**: `audit/family-d-focus-restoration-cross-app`
**Source of Truth**: [donomana-modal-accessibility-contract-v1_0.md](../donomana-modal-accessibility-contract-v1_0.md)(v1.1) / [modal-conformance-matrix.md](modal-conformance-matrix.md) / [finding-initial-restore-1.md](finding-initial-restore-1.md) / [global-fix-triage-1.md](global-fix-triage-1.md)

---

## 1. 監査方法

1. `role="dialog"`を含む全root-level HTMLファイルをgrep走査(41件)し、Opener/ReturnFocus系の変数命名パターンが検出されない候補を再生成。
2. 候補を`apps-data.json`記載の35正式アプリと照合し、非公開/静的ページを分離。
3. 各候補のmodal/overlay単位で、open/close関数を実際に読み込み、`.focus()`呼び出しの有無をコードで確認。
4. コード上でPASSと判定できないものは実ブラウザ(Playwright)で実クリック検証し、Evidence Levelを記録。
5. 既にProduction反映済み(okane-app/schedule-app print-modal/matching-app clear-ov・vs-result-ov)は対象外として除外。

**重要な発見**: 前回grepの検出パターン(`Opener|ReturnFocus|...`)は変数命名に依存するヒューリスティックであり、**多くのアプリが単に固定IDへの直接`.focus()`呼び出し(例: `document.getElementById('donomanaHelpBtn').focus();`)で復帰を実装しており、この命名規則を使っていなかった**。そのため実際にコードを読むと、24候補の大半は**false positive(実装済みだが検出されなかっただけ)**であることが判明した。

---

## 2. 候補ファイル再生成結果

`role="dialog"`を含み、grep上restorationSignal=0だったファイル(35正式アプリのうち):

```
cup_game, directions-app, dotchiga-ii-app, drawing-app, janken-app,
kurabeyou-app, kyou-no-kiroku, nazorin-print, scratch-app, shiritori2,
sst-app, sugoroku-app, suji-manabou, timetable-app, tokei-app, tyushi,
yomikaki-app
```
(17アプリ)

非公開/静的ページ(35アプリ外、about/philosophy/offline-guide/donomana-design-system-v2_0/slideshow-sakusei/shisen)は別途§7で扱う。

---

## 3. NOT APPLICABLE(アプリ固有modalが存在しない、共通A11yパネルのみ)

以下10アプリは、`role="dialog"`が共通自動挿入コンポーネント(`donomanaA11yPanel`)のみで、アプリ固有のFocus Restoration対象modalを持たない。**FAMILY-D対象外として除外**(A11yパネル自体はFAMILY-A管轄、本Phase対象外)。

| App | 備考 |
|---|---|
| directions-app | dialogs=1(A11yパネルのみ) |
| dotchiga-ii-app | 同上 |
| drawing-app | 同上 |
| kurabeyou-app | 同上 |
| kyou-no-kiroku | 同上 |
| sst-app | 同上 |
| sugoroku-app | 同上 |
| suji-manabou | 同上 |
| timetable-app | 同上 |
| yomikaki-app | 同上 |

---

## 4. CONFIRMED PASS(コード確認、grepのfalse negative)

以下は全て`.focus()`による明示的な復帰処理を実装済み。固定ID直書き方式のためgrepでは検出されなかった。

| App | Modal | 復帰先 | Evidence Level |
|---|---|---|---|
| janken-app | howto-overlay | `donomanaHelpBtn` | LEVEL-B(コード完結、`closeHowto()`に明示コメント付きで実装済み) |
| janken-app | record-modal-backdrop | `record-open-btn` | LEVEL-B |
| shiritori2 | record-modal-backdrop | `record-open-btn` | LEVEL-B |
| tokei-app | helpModal | `donomanaHelpBtn` | LEVEL-B |
| tokei-app | recordModal | `openRecordHistoryBtn` | LEVEL-B |
| nazorin-print | helpModal | `btnHelp` | LEVEL-B(**訂正**: 旧matrix記載「libModalのみ復帰確認」は不完全だった。実際は3モーダル全てPASS) |
| nazorin-print | batchModal | `btnBatch` | LEVEL-B |
| nazorin-print | libModal | `btnLibrary` | LEVEL-B(既知) |
| cup_game | helpModal | `donomanaHelpBtn` | LEVEL-B |
| scratch-app | setOv | `setBtn` | LEVEL-B |
| scratch-app | helpOv | `helpBtn` | LEVEL-B |

**11 modal PASS**(6アプリ)。

---

## 5. CONFIRMED FAIL / NEEDS BROWSER CONFIRMATION

| # | App | Modal | 症状 | Evidence Level | Pattern | Priority |
|---|---|---|---|---|---|---|
| 1 | cup_game | settingsOverlay | 実際の`settingsCloseBtn`クリックでBODY退行を実機確認。**加えてEscapeキーによる close自体が未実装**(Escapeを押しても閉じない、Contract Escape要件の別ギャップ) | **LEVEL-A** | D1 + D5(A11yパネルProxy経由が唯一の到達経路、okane-app settingsと同型構造) | P2 |
| 2 | schedule-app | new-modal | 実trigger(`+あたらしく`ボタン)→Escapeで実機BODY退行確認 | **LEVEL-A** | D1(print-modal修正前と同一構造) | P2 |
| 3 | schedule-app | img-modal | close 3箇所(2363/2379/2408行)いずれもopener保存・復帰処理が存在しない。動的生成されるthumbnail要素がopenerとなるため、matching-app editOpener型の実装が必要 | LEVEL-B(new-modal/print-modalと同一の共通ハンドラ構造のため高確度) | D1 | P2 |
| 4 | scratch-app | txtEdOv | `closeTxtEd()`(1554-1556行)に`.focus()`呼び出しが一切無い。実trigger(`#addTextBtn`/`#addImgBtn2`)は通常のUI操作では到達したが、本監査のheadlessブラウザでは初期状態で非表示/クリック不能だったため実機Escapeテストは未完了 | LEVEL-B | D1 | P2 |
| 5 | scratch-app | cov(できました！オーバーレイ) | 正誤判定完了時に自動表示される状態遷移型オーバーレイ。close経路(nextImg/rtyBtn/clsBtn、1212/1749/1750行)いずれも`.focus()`呼び出しが無い。matching-appのclear-ov/vs-result-ov(Fix前)と同一のRoot Cause | LEVEL-B | D4(state transition、opener概念が薄い) | P2/P3 |

---

## 6. NOT APPLICABLE / NEEDS SPECIAL HANDLING(個別)

| App | Modal | 分類 | 理由 |
|---|---|---|---|
| tyushi | help-overlay | **NOT APPLICABLE(FAMILY-D観点)** | `openHelp()`が初期focusを設定しないため、実機確認では"クリックしたhelp-btn自体に focusが残ったまま"となり、Escape後もhelp-btnのまま(BODY退行は発生しない)。ただし**Initial Focus自体が欠如**しているのが根本原因であり、これは既にmatrixで`❌(なし)`として記録済みのFAMILY-C領域。FAMILY-D固有の追加対応は不要 |
| tyushi | settings-panel | **NEEDS SPECIAL HANDLING** | `aria-modal`未設定・Tobii dwell操作前提の独自UI(mousemove/dwellベース)。標準的なmodal Focus Trap/Restoration Contractがそのまま適用可能か個別設計判断が必要。今回は判定を保留 |

---

## 7. 非公開/静的ページ(35アプリ外)

| ファイル | 状態 |
|---|---|
| about.html / philosophy.html / offline-guide.html | 共通A11yパネル(`a11yPanel`)のみ、アプリ固有modal無し → NOT APPLICABLE |
| donomana-design-system-v2_0.html | 開発用デザインシステム参照ページ、エンドユーザー向けアプリではない → 対象外 |
| slideshow-sakusei.html | 共通A11yパネルのみ → NOT APPLICABLE |
| shisen.html | **`apps-data.json`に非掲載(35アプリに含まれない、孤立/未公開ファイル)**。tyushi.htmlと酷似したhelp-overlay/settings-panel構造を持つが、アプリ一覧・詳細ページ経由で到達不可能なため実利用者への影響は無い。本Phaseでは深掘りせず記録のみに留める |

---

## 8. Evidence Level集計

- **LEVEL-A(実ブラウザでactiveElement確認済み)**: 2件(cup_game settingsOverlay、schedule-app new-modal)
- **LEVEL-B(コード完結、CONFIRMED PASS 11件 + CONFIRMED FAIL 3件)**: 14件
- **LEVEL-C**: 0件(LEVEL-Cのみでの確定判断は行っていない)

---

## 9. Pattern分類サマリ

- **Pattern D1(opener tracking自体が無い)**: cup_game settingsOverlay、schedule-app new-modal、schedule-app img-modal、scratch-app txtEdOv — 4件
- **Pattern D4(state transition、logical replacement欠如)**: scratch-app cov — 1件
- **Pattern D5(A11yパネルProxy構造)**: cup_game settingsOverlay(D1と複合) — 1件
- 既存Contract違反の複合(Escape機構自体の欠如、Initial Focus欠如)は個別に注記した(§5-6参照)。

---

## 10. Severity / Priority

| Priority | 該当 |
|---|---|
| P2 | cup_game settingsOverlay、schedule-app new-modal、schedule-app img-modal、scratch-app txtEdOv、scratch-app cov(いずれも操作継続は可能だが文脈喪失・大きな手戻りを招く) |
| P3 | 無し(今回P1相当の重大障害は発見されていない) |

---

## 11. Switch / Gaze関連

| App | Switch対応 | Gaze対応 | Fix時の留意点 |
|---|---|---|---|
| cup_game | 未確認(SCAN_SELECTOR無し) | あり(dwellTimeSlider等) | settingsOverlay自体がGaze設定パネル。Fix時はGaze設定操作に影響しないことを確認要 |
| schedule-app | 未確認 | 未確認 | 既存print-modal Fixと同一パターンのため低リスク |
| scratch-app | 未確認 | 未確認 | cov/txtEdOvともFocus操作系のみの変更で影響小と想定 |
| tyushi | — | あり(dwell/Tobii中心設計) | settings-panelのSPECIAL HANDLING判断に直結、Gaze専用設計の理解が前提 |

Blue2実機・Tobii実機によるManual Validationは全てPending。

---

## 12. 推奨Fix Batch設計(実装はしない)

- **Batch 1(低リスク、既存パターン踏襲)**: schedule-app new-modal・img-modal — print-modalで確立済みの`xxxOpener`+`closeXxxModal()`パターンをそのまま横展開。
- **Batch 2(低リスク、既存パターン踏襲)**: scratch-app txtEdOv — 同上のシンプルなopener追加。
- **Batch 3(matching-app実績パターン踏襲)**: scratch-app cov — state transition後のlogical replacement(次画像 or リトライ後の先頭要素)へのfocus、matching-appのclear-ov/vs-result-ov Fixと同型。
- **Batch 4(個別設計要、Gaze設定との相互作用確認)**: cup_game settingsOverlay — okane-app settings(A11yパネルProxy型)と同じ復帰対象(`donomanaA11yBtn`)を使えるが、**Escapeキー自体のclose機構が無い点も合わせて設計要**(本Phaseでは指摘のみ、Fixしない)。
- **保留(個別設計判断要)**: tyushi settings-panel — Gaze専用UI構造の理解が前提のため、まず設計方針を固めるDesign Decision的なミニPhaseを推奨。

---

## 13. False Positive除外サマリ

- 元の「24候補ファイル」のうち、**10ファイルはアプリ固有modalが存在しない**(共通A11yパネルのみ)ことが判明し除外。
- 残る候補アプリのうち、**6アプリ11モーダルは実装済み(CONFIRMED PASS)**と判明(grepの命名規則ヒューリスティックによる検出漏れ)。
- 非公開ページ(about/philosophy/offline-guide/design-system/slideshow-sakusei/shisen)は対象外。
- 結果として、**真にCONFIRMED FAILとして残った候補は5モーダル(cup_game 1、schedule-app 2、scratch-app 2)のみ**であり、当初懸念された「24件規模の残存問題」は実態としては大幅に縮小した。

---

## 14. 残存Unknown

- scratch-app txtEdOv/covの実ブラウザでのEscape/実クリック経路の完全な実機確認(本監査ではUI到達に手間取り、コード根拠(LEVEL-B)に留まった)。
- schedule-app img-modalの実機確認(動的thumbnail要素の実クリック到達、LEVEL-B止まり)。
- tyushi settings-panelのContract適用可否の設計判断。
- shisen.htmlの扱い(削除/公開/放置いずれにするかはUser判断、本監査はFAMILY-D観点のみ記録)。

---

## 15. Docs更新

`modal-conformance-matrix.md`のnazorin-app行(Focus Restoration列)を「libModalのみ復帰確認」から「3モーダル全てPASS」へ訂正する必要がある(本Phaseで反映)。cup_game/janken-app/shiritori2/tokei-app/scratch-appは元々matrixに未掲載の18アプリ外だったため新規追加は行わず、本監査docへの参照リンクを推奨する。

---

## 16. 正式Status

`WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1 = RESIDUAL FINDINGS CLASSIFIED / READY FOR FIX BATCH DESIGN`

一部(scratch-app txtEdOv/cov、schedule-app img-modal)はLEVEL-B止まりのため、Fix Batch実装時に改めて実機確認(LEVEL-A化)を行うことを推奨する。tyushi settings-panelは設計判断待ちのままNEEDS SPECIAL HANDLINGとして保留する。
