# Accessibility Audit Pilot-1: Finding Register

- Phase: ACCESSIBILITY-AUDIT-PILOT-1
- 分類基準: `donomana-wcag-jis-audit-plan-v1_0.md` §17(Severity)・§18(Finding管理4軸)
- 本Pilotでは**発見してもコードを修正しない**。全件このRegisterへ記録するのみ。

各Findingは app / finding family / WCAG観点 / input mode の4軸で記録する。

---

## PILOT-F1: gaze-keyboard 設定モーダルの初期フォーカス欠如

| 項目 | 内容 |
|---|---|
| Finding ID | PILOT-F1 |
| Finding Family | **初期フォーカス欠如**(modal-accessibility-spec M要件: モーダルopen時にフォーカスをモーダル内へ移動する) |
| App | gaze-keyboard |
| Severity | **P1 High** |
| WCAG/JIS観点 | Operable — Focus Order(2.4.3)、Robust — dialogのname/role/valueの実質的到達性 |
| Input Mode | Keyboard, Switch(将来対応時), Screen Reader利用者全般 |
| Automated / Manual | **Automated**(Playwright、`document.activeElement`が`#settingsModal`内かどうかを直接判定) |
| Reproduction | `document.getElementById('settingsBtn').click()`でsettingsModalを開く |
| Expected | matching-app/okane-app/tokei-appの同種モーダルと同様、open直後にモーダル内の要素(タイトル等)へフォーカスが移動する |
| Actual | `document.getElementById('settingsBtn').addEventListener('click',...)`(gaze-keyboard.html:3240付近)は`classList.remove('hidden')`と`setSettingsModalBackgroundInert(true)`のみを行い、`.focus()`呼び出しが一切ない。フォーカスは`#settingsBtn`に留まったまま |
| Evidence | `tools/accessibility-audit/pilot/browser-results.json` → `gaze-keyboard.modals.settingsModal.focus_inside_after_open: false`。コード確認: gaze-keyboard.html該当箇所に`.focus()`呼び出しなし |
| Known / New | **New**(AUDIT-35系・modal-accessibility-spec文書のいずれにも記録なし) |
| Fix candidate | `settingsModalTitle`(または同等の見出し要素)へ`tabindex="-1"`を付与し、open時に`.focus()`する。okane-app/tokei-appと同一パターンを流用可能 |
| Spec decision required | なし(既に確立済みのM要件を単に未適用なだけ、新規仕様判断は不要) |
| 横展開候補 | 本Pilotでは他アプリへの横展開調査は実施せず。本監査で「モーダルopen時に`.focus()`呼び出しがあるか」を全35アプリの共通チェック項目に追加することを推奨 |

---

## PILOT-F2(Spec Decision Required): モーダル背景抑制の実装方式がアプリ間で不統一

| 項目 | 内容 |
|---|---|
| Finding ID | PILOT-F2 |
| 分類 | **Spec Decision Required**(Findingではなく仕様上の未決定事項の実例) |
| 対象 | matching-app / okane-app(JS手動`.inert=true/false`トグル、`<header>`/`<main>`単位) vs. tokei-app / gaze-keyboard(モーダル自身へ静的`inert`/`aria-hidden="true"`属性+JS動的`inert`付与、time-timer.htmlと共通の設計とコード内コメントに明記) |
| 関連 | `donomana-modal-accessibility-spec-v1_0.md` §21 未決定事項13番「すべてのアプリでFocus Trap実装方式を統一するか、アプリ固有のまま維持するか」 |
| 観察 | 2方式とも実際の閉塞効果(背景操作抑制)自体は機能している(本Pilotの自動監査で問題は検出されず)。ただし実装が統一されていないため、将来の共通helper化(§21未決定事項)の際にどちらを正本にするかの判断が必要 |
| 判断 | 本Pilotでは判断しない。本監査(WCAG-JIS-AUDIT本体)でのSpec Decision対象として引き継ぐ |

---

## Needs Manual Review一覧

| # | 項目 | 対象 | 理由 |
|---|---|---|---|
| NMR-1 | NVDA実読み上げ全項目 | 5アプリ全て | Claudeは実SRを操作できない。`accessibility-audit-pilot-1-manual-review.md`のチェックリストを人間が実施する必要がある |
| NMR-2 | VoiceOver実読み上げ全項目 | 5アプリ全て | 同上 |
| NMR-3 | 実Switchデバイス(Blue2等)の操作感 | matching-app, okane-app | Playwrightによるscanロジック確認(候補・順序)は別途実施可能だが、実機の押しやすさ・タイミング体感はManual Only |
| NMR-4 | 実Gazeデバイス(Tobii等)の操作感 | gaze-keyboard, okane-app | 同上 |
| NMR-5 | 実指Touch操作感(誤操作・スクロール干渉) | 5アプリ全て(特にtokei-app/timetable-app) | target sizeの寸法測定は自動化したが、実際の押しやすさはManual |
| NMR-6 | Contrast(色コントラスト比) | 5アプリ全て | 本Pilotでは自動測定ツールを未セットアップのため未実施(§Methodology Review参照) |
| NMR-7 | matching-app vs-result-ov / clear-ov のモーダル監査 | matching-app | 実プレイ進行が必要で自動到達不可のため、本Pilotの自動監査対象外とした。手動または対戦シミュレーション用スクリプトの追加実装が必要 |
| NMR-8 | Learning Feedbackの理解しやすさ(§15観点) | 5アプリ全て | matching-appの勝敗発表(`ann(msg);speak(msg)`)は色以外にテキスト・音声も伴うことをコードで確認したが、「わかりやすいか」自体はManual判断が必要 |

---

## P0/P1/P2/P3集計

| Severity | 件数 | 内訳 |
|---|---|---|
| P0 Critical | 0 | なし |
| P1 High | 1 | PILOT-F1(gaze-keyboard初期フォーカス欠如) |
| P2 Medium | 0 | なし |
| P3 Low | 0 | なし |

Technical Debt: 0(新規)、Enhancement: 0、Needs Manual Review: 8件、Spec Decision Required: 1件(PILOT-F2)。

**AUDIT PILOT BLOCKING FINDING(P0操作不能)は0件。**

## Known Issue再確認(新規findingとして計上していないもの)

- register-app(Pilot対象外): pmOpenerEl → BODY focus退行。今回未調査(Pilot対象5アプリに含まれないため)
- schedule-app(Pilot対象外): h2〜h6なし。同上
- modal-accessibility-spec §21 未決定事項15件: PILOT-F2はこのうち13番の実例。他14件は本Pilotの範囲では新たな実例が確認されなかった
