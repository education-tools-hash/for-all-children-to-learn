# WCAG-JIS-AUDIT-1-TIER2 Summary

- Phase: WCAG-JIS-AUDIT-1-TIER2
- 対象: Tier2(一般的な教材)17アプリ
- 本Auditでは**Findingを発見してもコードを修正しない**。

---

## 1. Tier2対象17アプリの正式一覧

`tools/accessibility-audit/app-inventory.json`(本Phaseで再生成)と`donomana-wcag-jis-audit-plan-v1_0.md`の一致を確認済み。

| app | Touch | Keyboard | Switch | Gaze | Record | PWA | modal(app固有) | dynamic content | fullscreen | A11y panel | drag/swipe | learning feedback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hiragana-learn | ✅ | - | ✅ | - | ✅ | - | 1(Trapなし) | ✅ | ✅ | ✅ | - | ✅ |
| katakana-app | ✅ | - | ✅ | - | ✅ | - | 1(Trapなし) | ✅ | ✅ | ✅ | - | ✅ |
| shiritori2 | - | - | ✅ | - | ✅ | - | 1 | ✅ | ✅ | ✅ | - | ✅ |
| bosai-app | - | - | ✅ | - | ✅ | - | 1 | ✅ | ✅ | ✅ | - | ✅ |
| cup_game | ✅ | - | ✅ | ✅ | - | - | 1(Trap・初期focusなし) | ✅ | ✅ | ✅ | - | ✅ |
| ongaku-app | ✅ | - | ✅ | - | - | - | 4(うち3はrole/Trap/初期focus全て未実装) | ✅ | ✅ | ✅ | - | ✅ |
| kimochi-board | ✅ | - | ✅ | ✅ | - | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| drawing-app | ✅ | - | - | ✅ | - | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| directions-app | ✅ | - | ✅ | - | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| suji-manabou | ✅ | - | ✅ | - | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| kyou-no-kiroku | - | - | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| kurabeyou-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| katachi-awase-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| miru-hirogaru-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| mitsukete-touch-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| junban-miyou-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |
| dotchiga-ii-app | ✅ | ✅ | ✅ | ✅ | ✅ | - | 0 | ✅ | ✅ | ✅ | - | ✅ |

(drag/swipe固有の代替操作は17アプリいずれもコード上未検出。fullscreen・A11yパネルは全アプリ共通chrome機能。PWA Pilot該当は0件[Tier1のjanken-app/tokei-appのみ])

---

## 2. 自動監査結果サマリ

| Gate | 結果 |
|---|---|
| Structure(duplicate id/aria参照/tabindex/main/h1静的) | 15アプリ完全クリーン。bosai-appのduplicate id 1件は誤検知(実害なし確認済み)。katachi-awase-appのbroken aria参照1件は正式Finding化(TIER2-F6) |
| Browser(load/console error/responsive overflow/A11yパネル) | 16アプリ全件PASS(0 console error、0 overflow、A11yパネル開閉正常)。drawing-appのみ200%zoom時overflow検出(TIER2-F5) |
| Heading Runtime Visibility(v1.1 runtime条件) | **17/17 PASS**(TIER1-F1相当の再発なし) |
| Modal/Focus Trap静的パターン | app固有モーダルを持つ6アプリ中、A11yパネル対応済みFocus Trapは0アプリ。3アプリでA11yパネル例外欠如(TIER2-F1)、4アプリ(うち1はさらに3モーダル分)でFocus Trap自体が欠如(TIER2-F2)、うち2アプリで初期focusも欠如(TIER2-F3) |
| Contrast | 17アプリ中5アプリで信頼できる判定に基づく閾値未達(合計15件)、10アプリは自動判定カバレッジがほぼ0(ページ全体gradient背景のため) |

詳細は`tier2-browser-results.md`・`tier2-contrast-results.md`を参照。

---

## 3. Finding一覧(概要)

| Finding | Family | 対象 | Severity |
|---|---|---|---|
| TIER2-F1 | FT-1(A11yパネル例外欠如) | shiritori2・bosai-app・ongaku-app | P2 |
| TIER2-F2 | FT-2(Focus Trap欠如) | hiragana-learn・katakana-app・cup_game・ongaku-app(3モーダル) | P2 |
| TIER2-F3 | Initial Focus Missing(新規Family) | cup_game・ongaku-app(3モーダル) | P1 |
| TIER2-F4 | Contrast | cup_game・ongaku-app・kimochi-board・drawing-app・katachi-awase-app | P3 |
| TIER2-F5 | Reflow Overflow(新規Family) | drawing-app | P2 |
| TIER2-F6 | Broken ARIA Reference(新規Family) | katachi-awase-app | P1 |
| (統合) | Spec Decision Required(背景抑制方式、TIER1-F6拡張) | shiritori2(系统B)・hiragana-learn/katakana-app/bosai-app/cup_game/ongaku-app(系统D) | - |

詳細は`tier2-findings.md`を参照。

## 4. P0/P1/P2/P3件数

P0: 0 / P1: 2(TIER2-F3, F6) / P2: 3(TIER2-F1, F2, F5) / P3: 1(TIER2-F4、Contrast 15件)。**AUDIT PILOT BLOCKING FINDING相当は0件。**

Needs Manual Review: 9カテゴリ(`tier2-manual-review.md` A〜I)。Spec Decision Required: TIER1-F6への統合1件。

## 5. Tier1との比較で見えた新規パターン

- **Initial Focus Missing**・**Broken ARIA Reference**・**Reflow Overflow**の3Finding FamilyはTier1では0件だったため未確立だったが、Tier2で複数の確定インスタンスが見つかり新規に確立した
- **Contrast Gateの自動カバレッジがTier1より大幅に低下**(信頼できる判定の割合がTier1の約94%からTier2は約26%へ低下)。Tier2の多くのアプリがページ全体にlinear-gradient背景を採用するデザイン傾向を持つため
- **ongaku-appのmodal-pin/export/share**は、role="dialog"すら付与されていない「モーダル未満」の状態であり、Tier1のFT-2(role="dialog"はあるがFocus Trapがない)よりもさらに一段階アクセシビリティ対応が手薄な、新しいパターンとして記録した
- Tier1のTIER1-F5(Focus Restoration、register-appのBODY退行)に相当する問題はTier2の6モーダルアプリいずれにも再発しなかった(全アプリでフォーカス復帰が正しく実装されている)

## 6. Fix Backlog

`tier2-fix-backlog.md`参照。優先度1(TIER2-F6・F3・F1、小規模・正解確立済み)→優先度2(TIER2-F2・F5・F4、構造判断/デザイン見直しを伴う)→Spec Decision(TIER1-F6統合分)の順を推奨。

## 7. Tier2 Exit Gate判定

| # | 条件 | 状態 |
|---|---|---|
| 1 | Tier2対象全件の自動監査完了 | ✅ |
| 2 | Browser Gate完了 | ✅ |
| 3 | Keyboard Gate完了 | ✅(自動範囲、静的+一部動的確認) |
| 4 | Modal Gate完了 | ✅(静的パターン監査+疑わしいケースの直接コード確認) |
| 5 | Responsive/Reflow完了 | ✅(TIER2-F5を検出) |
| 6 | Contrast Gate完了 | ✅(ただし自動カバレッジ低下、Manual Review依存度増を記録) |
| 7 | Touch自動評価完了 | △(target size等の再測定は未実施) |
| 8 | Switch自動評価完了 | △(候補構築ロジックの静的存在確認のみ) |
| 9 | Gaze自動評価完了 | △(宣言確認のみ) |
| 10 | Record Gate完了 | △(role/構造確認のみ) |
| 11 | PWA Accessibility Gate該当分完了 | N/A(Tier2に該当アプリなし) |
| 12 | Finding Register確定 | ✅ |
| 13 | Finding Family確定 | ✅(FT-1・FT-2・Initial Focus Missing・Contrast・Reflow Overflow・Broken ARIA Reference・Spec Decision[統合]) |
| 14 | Severity分類確定 | ✅ |
| 15 | Manual Review backlog確定 | ✅ |
| 16 | Fix backlog確定 | ✅ |
| 17 | Tier3へ横展開可能 | ✅ |

17項目中13項目完全PASS、4項目(#7-10)は「自動化できる範囲は完了、深い動的検証はManual Review送り」という部分完了。Audit plan自体が想定する自動/手動の役割分担(§4)通りであり、**未達ではなく設計通りの状態**と判断する。#11はTier2にPWA Pilot該当アプリが存在しないためN/A。

**WCAG-JIS-AUDIT-1-TIER2 = TIER2 AUDIT COMPLETE / READY FOR FIX TRIAGE**

> **[状態明記]** このstatusは「Tier2の自動監査・Finding分類・Manual Review backlogの確定が完了した」ことを意味する。**NVDA/VoiceOver/Blue2/Tobii等を含む全Manual Accessibility Reviewが完了したことは意味しない**(`tier2-manual-review.md` A〜I、全項目未実施のまま)。特にkatachi-awase-appのスイッチスキャン設定トグル無名化(TIER2-F6)は、実際のSR体感を確認する最優先Manual Review対象として保持する。

## 8. 推定Fix時間

- 優先度1(TIER2-F6・F3・F1): 合計2〜3日程度
- 優先度2(TIER2-F2・F5・F4): TIER2-F2のongaku-app分は2〜3日、他は1日/アプリ程度、TIER2-F4はデザイントークン見直し次第で数日
- Spec Decision(TIER1-F6統合分): TIER1側と合わせて決定

## 9. Tier3へ進む前の推奨

1. TIER1-F2/F3、TIER2-F1/F2/F3/F5/F6のFix Triage(User判断)
2. Contrastデザイントークンの方針決定(TIER1-F4/TIER2-F4合流)
3. ongaku-appのmodal-pin/export/shareへのARIAダイアログ機構新規実装(コスト大のため優先度判断が必要)
4. 上記いずれかと並行してTier3監査(6アプリ)へ進行可能

## 10. 作成ファイル

- `docs/accessibility/audit/tier2/tier2-summary.md`(本ファイル)
- `docs/accessibility/audit/tier2/tier2-findings.md`
- `docs/accessibility/audit/tier2/tier2-browser-results.md`
- `docs/accessibility/audit/tier2/tier2-manual-review.md`
- `docs/accessibility/audit/tier2/tier2-contrast-results.md`
- `docs/accessibility/audit/tier2/tier2-fix-backlog.md`
- `docs/accessibility/audit/tier1-tier2-cumulative-summary.md`
- `tools/accessibility-audit/tier2/static-audit.js` / `static-audit-results.json`
- `tools/accessibility-audit/tier2/browser-audit.py` / `browser-audit-results.json`
- `tools/accessibility-audit/tier2/contrast-results.json`
- `tools/accessibility-audit/app-inventory.json`(再生成)

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase WCAG-JIS-AUDIT-1-TIER2。Tier2 17アプリの初回本監査完了。Exit Gate判定 = TIER2 AUDIT COMPLETE / READY FOR FIX TRIAGE。 |
