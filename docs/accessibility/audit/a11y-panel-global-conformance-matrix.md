# A11y Panel Global Conformance Matrix(35アプリ × donomana A11y Panel Keyboard Contract v0.9)

`WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1`の監査結果。`donomana-a11y-panel-keyboard-contract-v1_0.md`(DRAFT v0.9)確定に伴い、共通A11yパネル(`donomanaA11yPanel`)を持つ全35アプリの現状をContract項目ごとに評価する。**本ファイルはFix対象の正式確定であり、実装は行わない。**

凡例: ✅Conformant/PASS ・ 🟡Partial ・ ❌Non-conformant/FAIL ・ — N/A ・ ？未検証(理論上のリスクのみ、個別実機未確認)

前Phase: `WCAG-JIS-FIX-FAMILY-B-BATCH-6-POSTRELEASE-HOTFIX-1-RELEASE`(mogura-tataki、Production final `77085ca`)。FAMILY-B Production residual count = **4**(本Phaseでは変更しない)。

---

## 1. Implementation Family 分類(全35アプリ)

| Family | 定義 | 該当数 | 該当アプリ |
|---|---|---|---|
| **A** | Panel内部strict containment準拠(opener・toolbar両方除外) | **1** | mogura-tataki(Reference Implementation) |
| **B** | Panel + toolbar等をcluster化(opener含む・toolbar含む) | **1** | tyushi(`donomanaA11yBtn`+`donomanaHomeBtn`含む、コード内コメントに意図的と明記) |
| **C** | openerをclusterへ含む(toolbarは含まない) | **4** | cup_game・katakana-app・hiragana-learn・schedule-app(katakana-app/hiragana-learnは完全同一実装、いずれも「Panel自身のfocusableだけで循環」とコメントしながら実装はopener含む、cup_gameと同型の矛盾) |
| **D** | 共通実装任せだがTrapなし(A11yパネル自体のcontainment皆無) | **29** | 下記D-1/D-2/D-3参照 |
| **E** | 独自A11yパネル | **0** | 該当なし(全アプリが共通`donomanaA11yPanel`マークアップを使用) |
| **F** | A11yパネルなし | **0** | 該当なし(全35アプリに共通A11yパネルマークアップあり) |

### Family D 内訳(29アプリ)

| Sub-variant | 内容 | 該当数 | 該当アプリ |
|---|---|---|---|
| **D-1(guard-only)** | 自前modal Focus Trap内に「A11yパネルOPEN中はTrap無効化(`return`)」というguardのみ実装。A11yパネル自体のcontainmentは提供しない | 4 | okane-app・matching-app・ongaku-app・gaze-keyboard |
| **D-2(escape-only defer)** | 独自Escapeハンドラで「A11yパネル表示中は何もしない」と委譲するのみ。Tabキー処理はA11yパネルを一切意識しない | 5 | nazorin-print・shiritori2・tokei-app・janken-app・bosai-app |
| **D-3(baseline)** | A11yパネルを意識したコードが一切存在しない(共通層のみに依存) | 20 | nazori-app・register-app・timetable-app・yomikaki-app・sugoroku-app・sst-app・kimochi-board・drawing-app・slideshow-sakusei・directions-app・time-timer・suji-manabou・kyou-no-kiroku・scratch-app・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app |

---

## 2. 全35アプリ Conformance Matrix

| App | A11yパネル | Family | Strict Containment | Opener含む | Toolbar含む | Hidden Focus Risk | Visible Focus | Escape(A11yパネル自体) | Focus Restoration(opener復帰) | Modal Coexistence | Switch | Gaze | Evidence | Severity | Recommended Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mogura-tataki | ✅ | A | ✅Conformant | ✅除外 | ✅除外 | ✅解消済み(RC3で発見・RC4で解消) | ✅PASS(RC3、Production実機確認済み) | ❌(§4共通問題、Panel内部深くからのEscapeでBODY退行を実機確認) | ❌(同上) | ✅PASS(実機確認済み) | — | Y | LEVEL-A(実機確認、POSTRELEASE-HOTFIX-1) | P2(Escape/Restoration共通問題のみ残存) | Reference Implementation。Escape/Restoration共通問題は§4の全アプリ共通Fix候補で解消 |
| tyushi | ✅ | B | 🟡Partial(cluster内で完結、外部脱出はしないが仕様違反) | ❌含む | ❌含む(`donomanaHomeBtn`) | ？未検証 | ？未検証 | ❌(共通問題、理論上同様) | ❌(同上) | 🟡Partial(優先順位分岐あり、opener/toolbar混入が残存) | Y | Y | LEVEL-A(Batch-5実機確認、opener/toolbar構成はコード確認) | P3(spec違反だが脱出はしない) | Pilot候補(§22、乖離最大) |
| cup_game | ✅ | C | 🟡Partial | ❌含む | ✅除外 | ？未検証 | ❌(settingsOverlay `toggleDwell`等、focus-visible皆無、Separate Finding継続) | ❌(共通問題) | ❌(同上) | 🟡Partial(優先順位分岐あり、opener混入残存) | Y | Y | LEVEL-A(Batch-7実機確認、opener構成はコード確認) | P3 | Pilot候補(§22、コメント/実装矛盾) |
| katakana-app | ✅ | C | 🟡Partial | ❌含む | ✅除外 | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial | Y | N | LEVEL-A(Batch-7実機確認、cluster構成はコード確認) | P3 | hiragana-learnと同一実装、同一Batchでの解消を推奨 |
| hiragana-learn | ✅ | C | 🟡Partial | ❌含む | ✅除外 | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial | Y | N | LEVEL-A(Batch-7実機確認、cluster構成はコード確認) | P3 | katakana-appと同一実装、同一Batchでの解消を推奨 |
| schedule-app | ✅ | C | 🟡Partial(**A11yパネル単独open時はcontainment自体が発火しない**、§2.1参照) | ❌含む | ✅除外 | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial(3modalのいずれかが開いている時のみcontainment発火) | Y | N | 理論上(コード確認のみ、今回新規発見、実機未検証) | P2(containment未発火の状態がある分、C型の中でも劣後) | 追加調査対象(§2.1)、実機検証未実施 |
| okane-app | ✅ | D-1 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証(Visible Focus自体は参照実装評価あり、A11yパネル固有は未検証) | ❌(共通問題) | ❌(同上) | 🟡Partial(guard-onlyでmodal Trap無効化のみ) | Y | Y | 実機確認(janken-app等と同様、Reverse方向でcommon toolbarへ抜けることを実証) | P2 | Global-1B候補 |
| matching-app | ✅ | D-1 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial(guard-only) | Y | N | 理論上(コード確認、実機未検証) | P2 | Global-1B候補 |
| ongaku-app | ✅ | D-1 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial(guard-only) | Y | N | 理論上(コード確認、実機未検証) | P2 | Global-1B候補 |
| gaze-keyboard | ✅ | D-1 | ❌Non-conformant(既存Ledgerでも「mogura-tataki RC4パターン未適用」と推定記録済み) | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | 🟡Partial(guard-only、profileModal等でA11yパネル遷移不備を既存Ledgerで確認済み) | Y | Y | LEVEL-A(finding-escape-1.md§28.6で既存確認済み) | P2 | Global-1B候補、既存Findingとの統合検討 |
| nazorin-print | ✅ | D-2 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(Escape委譲のみ、Tab側は無防備) | N | N | 理論上(コード確認、実機未検証) | P2 | Global-1B候補 |
| shiritori2 | ✅ | D-2 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上 | P2 | Global-1B候補 |
| tokei-app | ✅ | D-2 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | **実機確認(Reverse Shift+Tab1回でcommon toolbar[`donomanaRecordNavBtn`]へ抜けることを確認、browser chromeではない)** | P2 | Global-1B候補 |
| janken-app | ✅ | D-2 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | **実機確認(同上、common toolbarへ抜けることを確認)** | P2 | Global-1B候補 |
| bosai-app | ✅ | D-2 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上 | P2 | Global-1B候補 |
| nazori-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上(未実機検証) | P2 | Global-1C候補 |
| register-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上 | P2 | Global-1C候補 |
| timetable-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | N | **実機確認(Reverse Shift+Tab1回で実際にbrowser chromeへescape、`document.hasFocus()===false`を確認。本監査で唯一のbrowser chrome escape実証例)** | **P1** | Global-1B候補(最優先) |
| yomikaki-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | N | 理論上 | P2 | Global-1C候補 |
| sugoroku-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上 | P2 | Global-1C候補 |
| sst-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | N | 理論上 | P2 | Global-1C候補 |
| kimochi-board | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | Y | 理論上 | P2 | Global-1C候補 |
| drawing-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | Y | 理論上 | P2 | Global-1C候補 |
| slideshow-sakusei | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | N | 理論上 | P2 | Global-1C候補 |
| directions-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型、modal無し) | Y | N | 理論上 | P2 | Global-1C候補 |
| time-timer | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | 🟡疑わしい候補(`body.locked .settings-adult-area`、disabled-state Separate Finding候補) | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | N | 理論上(A11y containment側)、disabled-state候補はコード確認 | P2 | Global-1C候補、disabled-state候補は§18で別Finding管理 |
| suji-manabou | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | N | 理論上 | P2 | Global-1C候補 |
| kyou-no-kiroku | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | Y | Y | 理論上 | P2 | Global-1C候補 |
| scratch-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | 🟡疑わしい候補(`body.locked #backBtn`、disabled-state Separate Finding候補) | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証 | N | Y | 理論上(A11y containment側)、disabled-state候補はコード確認 | P2 | Global-1C候補、disabled-state候補は§18で別Finding管理 |
| kurabeyou-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | Y | 理論上 | P2 | Global-1C候補 |
| katachi-awase-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上)。ただしアプリ固有modal自身のEscape close restorationは「Donomana Help / Usage Guide Standard v1.0」パターンで実装済み(`(donomanaA11yBtn || settingsBtn).focus()`、A11yパネル自体とは別軸) | ？未検証(単一画面型) | Y | Y | 理論上(A11yパネル側)、固有modal側はLEVEL-A相当(コード確認) | P2 | Global-1C候補 |
| miru-hirogaru-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | Y | 理論上 | P2 | Global-1C候補 |
| mitsukete-touch-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | Y | 理論上 | P2 | Global-1C候補 |
| junban-miyou-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | Y | 理論上 | P2 | Global-1C候補 |
| dotchiga-ii-app | ✅ | D-3 | ❌Non-conformant | — N/A | — N/A | ？未検証 | ？未検証 | ❌(共通問題) | ❌(同上) | ？未検証(単一画面型) | Y | Y | 理論上 | P2 | Global-1C候補 |

---

## 3. 集計

### Strict Containment(Global Matrix Count、§35)

| 区分 | 件数 |
|---|---|
| Conformant | **1**(mogura-tataki) |
| Partial | **5**(tyushi・cup_game・katakana-app・hiragana-learn・schedule-app) |
| Non-conformant | **29**(Family D全て) |
| N/A | **0**(全35アプリがA11yパネルを持つ) |
| **合計** | **35** |

### Opener Inclusion分布

| 区分 | 件数 |
|---|---|
| 除外(Conformant) | 1(mogura-tataki) |
| 含む(Non-conformant) | 5(tyushi・cup_game・katakana-app・hiragana-learn・schedule-app) |
| N/A(cluster自体が無い) | 29 |

### Toolbar Inclusion分布

| 区分 | 件数 |
|---|---|
| 除外 | 5(mogura-tataki・cup_game・katakana-app・hiragana-learn・schedule-app) |
| 含む | 1(tyushi) |
| N/A | 29 |

### Escape / Focus Restoration(A11yパネル自体)

**35/35が共通層(`generate.js`)の同一実装(`btn.click()`のみ、明示的restoration処理なし)に依存しており、理論上35アプリ全てが同一のBODY focus loss構造的リスクを持つ。** mogura-tatakiでLEVEL-A(実機)確認済み、他34アプリはコードレベルでの理論上確認(共通層コードが完全に同一のため、個別アプリの実機再現テストがなくても同一挙動を示すと合理的に推定できる)。

### Hidden Focus Risk

mogura-tatakiでRC3時点で発見・RC4で解消済み(HIDDEN BUT FOCUSABLE、`btnFS`等)。他34アプリは未検証。settings proxy経由のfocus fallback機構(`generate.js` Phase16.43〜16.45)は既に相当程度hardening済みであり、A11yパネル自体のcluster構成に起因するHidden Focus Riskは、Family C(cup_game・katakana-app・hiragana-learn・schedule-app)のようにcluster構築ロジックを持つアプリでのみ理論上発生しうる。Family D(cluster自体が無い)では該当リスクの性質が異なる(native tab orderに完全依存するため、隠れた要素が普通に混入する可能性は既存のnative tab order問題として別軸)。

### Visible Focus Risk

mogura-tataki: PASS(RC3で追加・Production確認済み)。cup_game: settingsOverlayの`toggleDwell`等5トグルでfocus-visible皆無(既存Separate Finding、Batch-7で発見、継続中)。他33アプリ: 未検証。

### disabled-state Risk(dwT/togCur/dwTol型)

mogura-tataki: 既知(`dwT`/`togCur`/`dwTol`、Separate Finding継続)。新規疑わしい候補2件: `scratch-app.html`(`body.locked #backBtn`)・`time-timer.html`(`body.locked .settings-adult-area`)。いずれも`disabled`属性なしで`opacity`+`pointer-events:none`のみの視覚的無効化パターン。今回のPhaseでは確定診断・修正を行わない。

### Modal Coexistence

- ✅ PASS: mogura-tataki(実機確認済み)
- 🟡 Partial: tyushi・cup_game・katakana-app・hiragana-learn・schedule-app(優先順位分岐は実装済みだがopener/toolbar混入残存)、okane-app・matching-app・ongaku-app・gaze-keyboard(guard-onlyでmodal Trap無効化のみ)
- ？未検証: 残り25アプリ(A11yパネルと自前modalが同時に開き得るか自体、個別確認が必要)

### Switch / Gaze影響

- Switch Scan対応: 28/35アプリ(`apps-data.json`構造化フィールド基準)
- Gaze(視線入力)対応: 15/35アプリ
- 今回のPhaseでは、A11yパネルのfocus containment変更がSwitch Scanのscan順序・Gaze dwell targetへ影響しないという設計上の見立て(§9)を示したのみで、Switch/Gaze対応アプリでの個別実機回帰確認はPilot実装時に必須(§21)。

---

## 4. 既存Finding Familyとの関係(重複回避)

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)の「A11yパネル例外」列(`modal-conformance-matrix.md`既存)は、**app固有modalのFocus TrapがA11yパネルOPEN中に正しく無効化されるか**(TIER1-F2/TIER2-F1、既存Finding Family)を評価するものであり、本Matrixが評価する**A11yパネル自体のstrict containment**とは異なる軸である。両者は独立した評価軸であり、一方のPASSがもう一方のPASSを保証しない(例: okane-app/matching-appは「A11yパネル例外」列で✅参照実装評価だが、本Matrixでは❌Non-conformant[A11yパネル自体のcontainment欠如])。混同・統合しないこと(§31参照)。
