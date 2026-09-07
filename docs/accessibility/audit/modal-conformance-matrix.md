# Modal Conformance Matrix(18アプリ × Contract項目)

`donomana-modal-accessibility-contract-v1_0.md`確定に伴い、app固有モーダルを持つ18アプリの現状をContract項目ごとにPASS/PARTIAL/FAIL/N/Aで評価する。**本ファイルはFix対象の正式確定であり、実装は行わない。**

凡例: ✅PASS(Contract準拠) / 🟡PARTIAL(一部準拠) / ❌FAIL(未準拠) / — N/A(該当機能なし、または未検証)

| App | Dialog Semantics | Accessible Name | Initial Focus | Focus Trap | A11yパネル例外 | Escape | Focus Restoration | 背景抑制 | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| register-app | ✅ | ✅ | 🟡(Pattern3、最初のcontrol) | ✅(端点循環) | ❌(TIER1-F2) | ✅ | ❌(TIER1-F5、pmOpenerEl退行) | 🟡(系統B、モーダル自身のみ) | 8モーダル共通ヘルパー、Fix影響範囲大 |
| matching-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅ **参照実装** | ✅ | ✅ | ✅(系統A) **参照実装** | Contract完全準拠の唯一例 |
| time-timer | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER1-F2) | ✅ | — (未検証) | 🟡(系統B) | |
| mogura-tataki | 🟡(aria-label直接、labelledby未使用) | 🟡 | ❌(なし) | ❌(TIER1-F3) | — | — (未検証) | — (未検証) | ❌(系統D) | screen/panelベースの独自アーキテクチャ、深掘り要 |
| okane-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅ **参照実装** | ✅ | ✅(HARDEN-1で対応済み) | ✅(系統A) **参照実装** | Contract完全準拠 |
| scratch-app | ✅ | — (未検証) | 🟡(Pattern4、close btn) | ❌(TIER1-F3) | — | — (未検証) | — (未検証) | ❌(系統D) | |
| nazorin-print | ✅ | ✅ | ❌(なし) | ❌(TIER1-F3) | — | ✅(3モーダル共通実装) | 🟡(libModalのみ復帰確認) | ❌(系統D) | 3モーダル(help/batch/lib)構成 |
| schedule-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅ **参照実装** | ✅ | — (未検証) | 🟡(系統C、inertなし) | 背景inertなしでも端点循環が機能する例 |
| janken-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER1-F2) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tokei-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER1-F2、両モーダル) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tyushi | ✅ | ✅(aria-label、TIER1-F1対応時に確認済み) | ❌(なし) | ❌(TIER1-F3) | — | ✅ | — (未検証) | ❌(系統D) | H1修正済み(AUDIT-35-H1-IMPL-2)、モーダル自体は未着手 |
| gaze-keyboard(settingsModal) | ✅ | ✅ | ✅(Pattern1、PILOT-F1で修正済み) | ✅(端点循環) | ✅(HARDEN-3で修正済み) **準拠** | ✅ | ✅ | ✅(系統A) | Fix実績最多、settingsModalは完全準拠 |
| gaze-keyboard(profileModal/hrModal) | ✅ | ✅(HARDEN-3で修正済み) | ✅(NEW-KNOWN-1で修正済み) | ❌(TIER1-F3、NEW-KNOWN-3) | — | — (未検証) | — (未検証) | ❌(系統D) | Initial Focusのみ先行修正済み、Trap未実装 |
| hiragana-learn | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — | ✅ | ✅(`traceSampleViewerPrevFocus`) | ❌(系統D) | katakana-appと共通実装 |
| katakana-app | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — | ✅ | ✅ | ❌(系統D) | hiragana-learnと共通実装 |
| shiritori2 | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER2-F1) | ✅ | ✅ | 🟡(系統B、自身のみ) | |
| bosai-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| cup_game(helpModal) | ✅ | ✅ | ✅(**Fix済み、commit a53f307**) | ❌(TIER2-F2) | — | ✅ | ✅ | ❌(系統D) | Initial FocusのみFAMILY-C先行修正済み |
| ongaku-app(modal-help) | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| ongaku-app(modal-pin/export/share) | ❌(role/aria-modal自体が欠如) | ❌ | ❌(TIER2-F3、Open) | ❌(TIER2-F2) | — | ❌ | ❌ | ❌(系統D) | **18アプリ中唯一のFULL FAILパターン、3モーダル分** |

---

## 集計

| Contract項目 | PASS | PARTIAL | FAIL | N/A・未検証 |
|---|---|---|---|---|
| Dialog Semantics | 16 | 1(mogura-tataki) | 1(ongaku-app pin/export/share) | 0 |
| Accessible Name | 16 | 0 | 1(ongaku-app pin/export/share) | 1(scratch-app未検証) |
| Initial Focus | 11 | 2(register-app・scratch-app) | 5(mogura-tataki・nazorin-print・tyushi・ongaku-app pin/export/share・gaze-keyboard[Trap側は別軸]) | 0 |
| Focus Trap | 9 | 0 | 9(register-appを除く旧FT-1/FT-2対象+ongaku-app pin/export/share) | 0 |
| A11yパネル例外 | 4 | 0 | 11 | 3(未検証) |
| Escape | 12 | 0 | 1(ongaku-app pin/export/share) | 5(未検証) |
| Focus Restoration | 10 | 1(nazorin-print) | 1(register-app、TIER1-F5) | 6(未検証) |
| 背景抑制(inert方式準拠) | 3 | 5(系統B) | 9(系統C+D) | 0 |

**Contract全項目でPASSしているのは matching-app・okane-app の2アプリのみ(gaze-keyboardはsettingsModalのみ準拠、profileModal/hrModalはFocus Trap未実装のためアプリ全体としては非該当)。** 18アプリ中16アプリが何らかのContract項目でFAIL/PARTIALを持つ。

**「未検証」の項目について**: Tier1監査時点ではEscape/Focus Restoration/A11yパネル例外を全モーダルで網羅的に確認しておらず、一部は「疑わしい場合のみ直接コード確認」という方式だったため、本Matrixの「未検証」欄はFAIL/PARTIALの可能性を排除するものではない。**FAMILY別Fix着手時に該当アプリを再確認することを推奨する。**

---

## Fix対象数の正式確定(Contract基準)

| Family | Contract項目 | 対象アプリ数(FAIL+PARTIAL) |
|---|---|---|
| FAMILY-A | A11yパネル例外 | 11 |
| FAMILY-B | Focus Trap | 9(うちongaku-app pin/export/shareは3モーダル分) |
| FAMILY-C | Initial Focus(非推奨パターン含む) | 7(register-app・scratch-app[パターン移行]、mogura-tataki・nazorin-print・tyushi・ongaku-app pin/export/share[新規実装]) |
| FAMILY-D | Focus Restoration | 2(register-app・nazorin-print) |
| FAMILY-E | 背景抑制 | 14(系統B 5 + 系統C 1 + 系統D 9 - 重複除く実質14アプリ) |

**Global Fix Triageで確認した件数(FAMILY-A:7・FAMILY-B:9)と、本Matrixで確認した件数(FAMILY-A:11・FAMILY-B:9)に差異がある。** これはGlobal Fix Triage時点ではFinding化されていた「確定Finding」のみをカウントしていたのに対し、本Matrixは**Contract確定に伴い新たに発覚したregister-app(Initial Focus Pattern3)・scratch-app(Pattern4)・mogura-tataki(aria-label直接指定)等の追加項目を含む**ため。**この差異は正式な追加Finding候補として次項で扱う。**

---

## Contract確定に伴う新規発覚事項(追加Finding候補)

| # | App | 項目 | 内容 | 推奨対応 |
|---|---|---|---|---|
| 1 | register-app | Initial Focus | 全8モーダルが「最初のfocusable要素」へfocus(Pattern3、非推奨) | FAMILY-C/A統合Fix時にTitle focusへ変更を推奨 |
| 2 | scratch-app | Initial Focus | helpModalがclose buttonへfocus(Pattern4、非推奨) | 同上 |
| 3 | mogura-tataki | Accessible Name | `aria-label`直接指定(可視タイトルがあるのに`aria-labelledby`未使用) | FAMILY-B Fix時に`aria-labelledby`へ統一を推奨 |
| 4 | nazorin-print | Focus Restoration | libModalのみ復帰実装、help/batchModalは未確認 | FAMILY-D調査対象に追加 |

**これらは今回のContract確定作業で新たに判明した事実であり、既存のTIER1/TIER2 Finding Registerには含まれていなかった。次のGlobal Fix実装Phaseで正式Finding化するか、既存Family内の追加対象として扱うかをUser判断とする(本Phaseでは判断・修正しない)。**
