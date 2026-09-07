# WCAG-JIS-AUDIT-1-TIER1 Summary

- Phase: WCAG-JIS-AUDIT-1-TIER1
- 対象: Tier1(複雑・高リスク)12アプリ
- 本Auditでは**Findingを発見してもコードを修正しない**。

---

## 1. Tier1対象12アプリの正式一覧

`tools/accessibility-audit/app-inventory.json`(本Phaseで再生成)と`donomana-wcag-jis-audit-plan-v1_0.md` §20の一致を確認済み。

| app | Touch | Keyboard | Switch | Gaze | Record | PWA | modal(app固有) | dynamic content | fullscreen | A11y panel | drag/swipe | learning feedback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| register-app | - | - | ✅ | - | ✅ | - | 8 | ✅ | ✅ | ✅ | - | ✅ |
| matching-app | - | - | ✅ | - | ✅ | - | 6 | ✅ | ✅ | ✅ | - | ✅ |
| time-timer | - | - | ✅ | - | - | - | 5 | ✅ | ✅ | ✅ | - | ✅ |
| mogura-tataki | - | ✅ | ✅ | ✅ | ✅ | - | 5 | ✅ | ✅ | ✅ | - | ✅ |
| okane-app | ✅ | - | ✅ | ✅ | ✅ | - | 4 | ✅ | ✅ | ✅ | - | ✅ |
| scratch-app | ✅ | - | - | ✅ | - | - | 4 | ✅ | ✅ | ✅ | - | ✅ |
| nazorin-print | - | - | - | - | - | - | 3 | ✅ | ✅ | ✅ | - | ✅ |
| schedule-app | - | - | ✅ | - | - | - | 3 | ✅ | ✅ | ✅ | - | ✅ |
| janken-app | - | ✅ | ✅ | - | ✅ | ✅ | 2 | ✅ | ✅ | ✅ | - | ✅ |
| tokei-app | ✅ | - | ✅ | - | ✅ | ✅ | 2 | ✅ | ✅ | ✅ | - | ✅ |
| tyushi | - | - | ✅ | ✅ | - | - | 2 | ✅ | ✅ | ✅ | - | ✅ |
| gaze-keyboard | ✅ | ✅ | - | ✅ | - | - | 1(+2、Trapなし) | ✅ | ✅ | ✅ | - | ✅ |

(drag/swipe固有の代替操作は12アプリいずれもコード上未検出。fullscreen・A11yパネルは全アプリ共通chrome機能)

---

## 2. 自動監査結果サマリ

| Gate | 結果 |
|---|---|
| Structure(duplicate id/aria参照/tabindex/main/h1静的) | 12アプリ全件クリーン |
| Browser(load/console error/responsive overflow/A11yパネル) | 12アプリ全件PASS(0 console error、0 overflow、A11yパネル開閉正常) |
| Heading Runtime Visibility(v1.1 runtime条件) | **11/12 PASS、tyushiのみ既定状態で見出し0件(TIER1-F1)** |
| Modal/Focus Trap静的パターン | 12アプリ中、A11yパネル対応済みFocus Trapは4アプリ(matching-app/okane-app/schedule-app/gaze-keyboard[settingsModalのみ])。4アプリでA11yパネル例外欠如(TIER1-F2)、5アプリでFocus Trap自体が欠如(TIER1-F3) |
| Contrast | 12アプリ中9アプリで信頼できる判定に基づく閾値未達(合計46件)、16件がgradient/画像背景でNeeds Manual Review |

詳細は`tier1-browser-results.md`・`tier1-contrast-results.md`を参照。

---

## 3. Finding一覧(概要)

| Finding | Family | 対象 | Severity |
|---|---|---|---|
| TIER1-F1 | Heading Runtime Visibility | tyushi | P2 |
| TIER1-F2 | FT-1(A11yパネル例外欠如) | register-app・time-timer・janken-app・tokei-app | P2 |
| TIER1-F3 | FT-2(Focus Trap欠如) | mogura-tataki・scratch-app・nazorin-print・tyushi・gaze-keyboard | P2 |
| TIER1-F4 | Contrast | register-app・matching-app・time-timer・mogura-tataki・okane-app・nazorin-print・schedule-app・gaze-keyboard | P2/P3 |
| TIER1-F5 | Focus Restoration | register-app(pmOpenerEl) | P2 + Spec Decision Required |
| TIER1-F6 | Spec Decision Required | 背景抑制方式(12アプリ横断で4系統に分裂) | - |

詳細は`tier1-findings.md`を参照。

## 4. P0/P1/P2/P3件数

P0: 0 / P1: 0 / P2: 5(Finding単位。Family内訳は上記) / P3: Contrastの一部(個別評価待ち)。**AUDIT PILOT BLOCKING FINDING相当は0件。**

Needs Manual Review: 8カテゴリ(`tier1-manual-review.md` A〜H)。Spec Decision Required: 2件(TIER1-F5, F6)。

## 5. NEW-KNOWN-3の正式評価

gaze-keyboard profileModal/hrModalのFocus Trap欠如は、TIER1-F3(Finding Family FT-2)へ正式統合した。他4アプリ(mogura-tataki・scratch-app・nazorin-print・tyushi)にも同型の欠如が新規発見されたため、**単独問題ではなくTier1の12アプリ中5アプリ(42%)に及ぶ横断的なFinding Familyであることが判明**した。

## 6. Pilot Finding移管状況

- PILOT-F1: HARDEN-2-RELEASEで解消済み(Closed)
- PILOT-F2: TIER1-F6へ拡張・統合
- Pilot Contrast Findings(matching-app/okane-app/gaze-keyboard/tokei-app分): TIER1-F4へ統合。timetable-appはTier3のため今回対象外

## 7. Fix Backlog

`tier1-fix-backlog.md`参照。優先度1(TIER1-F1・F2、小規模・正解確立済み)→優先度2(TIER1-F3・F4、構造判断/デザイン見直しを伴う)→Spec Decision(TIER1-F5・F6)の順を推奨。

## 8. Tier1 Exit Gate判定

| # | 条件 | 状態 |
|---|---|---|
| 1 | Tier1対象全件の自動監査完了 | ✅ |
| 2 | Browser Gate完了 | ✅ |
| 3 | Keyboard Gate完了 | ✅(自動範囲、静的+一部動的確認) |
| 4 | Modal Gate完了 | ✅(静的パターン監査+疑わしいケースの直接コード確認) |
| 5 | Responsive/Reflow完了 | ✅ |
| 6 | Contrast Gate完了 | ✅ |
| 7 | Touch自動評価完了 | △(target size等の再測定は未実施、既存AUDIT-35-FIX-1F基準の参照に留める) |
| 8 | Switch自動評価完了 | △(候補構築ロジックの静的存在確認のみ、動的順序検証は未実施) |
| 9 | Gaze自動評価完了 | △(宣言確認のみ、実装markerの深掘りは未実施) |
| 10 | Record Gate完了 | △(role/構造確認のみ、UX深掘りはManual Review送り) |
| 11 | PWA Accessibility Gate該当分完了 | △(構造確認のみ) |
| 12 | Finding Register確定 | ✅ |
| 13 | Finding Family確定 | ✅(FT-1, FT-2, Contrast, Focus Restoration, Spec Decision) |
| 14 | Severity分類確定 | ✅ |
| 15 | Manual Review backlog確定 | ✅ |
| 16 | Fix backlog確定 | ✅ |
| 17 | Tier2へ横展開可能 | ✅(手法自体は確立、TIER1-F1の監査ツール改修提案含む) |

17項目中12項目完全PASS、5項目(#7-11)は「自動化できる範囲は完了、深い動的検証はManual Review送り」という部分完了。これはAudit plan自体が想定する自動/手動の役割分担(§4)通りであり、**未達ではなく設計通りの状態**と判断する。

**WCAG-JIS-AUDIT-1-TIER1 = TIER1 AUDIT COMPLETE / READY FOR FIX TRIAGE**

> **[WCAG-JIS-AUDIT-1-TIER1-RELEASE 注記]** このstatusは「Tier1の自動監査・Finding分類・Manual Review backlogの確定が完了した」ことを意味する。**NVDA/VoiceOver/Blue2/Tobii等を含む全Manual Accessibility Reviewが完了したことは意味しない**(`tier1-manual-review.md` A〜H、全項目未実施のまま)。特にtyushiは、TIER1-F1(既定状態でheadingが1件も到達不能)の実際のSR体感を確認する最優先Manual Review対象として保持する。

## 9. 推定Fix時間

- 優先度1(TIER1-F1・F2): 合計2〜3日程度(5アプリ×半日〜1日)
- 優先度2(TIER1-F3・F4): TIER1-F3は方式決定後1日×5アプリ、TIER1-F4はデザイントークン見直し次第で数日〜1週間
- Spec Decision(TIER1-F5・F6): 決定自体は数時間〜半日、実装は決定内容次第

## 10. Tier2へ進む前の推奨

1. **`tools/main-heading-audit/audit.js`のruntime可視性判定への改修**(TIER1-F1が示した監査ツール自体の盲点。Tier2/3監査を始める前に修正しないと同種の見落としが再発する可能性が高い)
2. TIER1-F2/F3のFix Triage(User判断)
3. Contrastデザイントークンの方針決定
4. 上記いずれかと並行してTier2監査(17アプリ)へ進行可能

## 11. 作成ファイル

- `docs/accessibility/audit/tier1/tier1-summary.md`(本ファイル)
- `docs/accessibility/audit/tier1/tier1-findings.md`
- `docs/accessibility/audit/tier1/tier1-browser-results.md`
- `docs/accessibility/audit/tier1/tier1-manual-review.md`
- `docs/accessibility/audit/tier1/tier1-contrast-results.md`
- `docs/accessibility/audit/tier1/tier1-fix-backlog.md`
- `tools/accessibility-audit/tier1/static-audit.js` / `static-audit-results.json`
- `tools/accessibility-audit/tier1/browser-audit.py` / `browser-audit-results.json`
- `tools/accessibility-audit/tier1/contrast-audit-results.json`
- `tools/accessibility-audit/app-inventory.json`(再生成)

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase WCAG-JIS-AUDIT-1-TIER1。Tier1 12アプリの初回本監査完了。Exit Gate判定 = TIER1 AUDIT COMPLETE / READY FOR FIX TRIAGE。 |
