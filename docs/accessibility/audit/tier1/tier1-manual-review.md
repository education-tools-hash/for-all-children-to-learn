# WCAG-JIS-AUDIT-1-TIER1: Manual Review Backlog

Claudeが実機操作できない項目、および動的なユーザー操作フローの深い検証が必要な項目を、推測でPASS/FAILとせず一覧化する。ベースは`docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`(v1.1)。

---

## A. Screen Reader Gate(NVDA / VoiceOver、代表アプリ方式)

代表選定(Tier1の中でも構造が異なるものを優先):

| 代表アプリ | 選定理由 |
|---|---|
| register-app | dialog数最多(9)、Record Foundation |
| schedule-app | 端点循環型Focus Trapという独自パターン、Contrast fail最多 |
| tyushi | **TIER1-F1(既定状態でheading到達不能)の実際の読み上げ体験を確認する最優先候補** |
| gaze-keyboard | Gaze対応・機微データ標準、HARDEN 1〜3で最も手を入れたアプリ |

NVDA(Windows+Edge)・VoiceOver(iPad Safari)とも、`donomana-accessibility-manual-review-checklist-v1_0.md` A章・B章のチェックリストをそのまま使用。特にtyushiでは「ページを開いた直後、Hキーで見出し移動を試みると何も見つからない」という体験を実際に確認することを最優先とする。

**状態: 全項目未実施(Needs Manual Review)**

---

## B. Switch実機Gate(Blue2等)

Switch入力宣言アプリ(9件): register-app・matching-app・time-timer・mogura-tataki・okane-app・schedule-app・janken-app・tokei-app・tyushi

自動確認済み(静的コード分析、本Phase実施): Switch Scan候補構築ロジックの存在は全9アプリで確認。ただし以下はPlaywrightでの動的検証・実機検証とも未実施:

- 各アプリのscan順序が利用者にとって自然か
- long press対応(既知: kimochi-board/matching-app/bosai-appのみ対応、Tier1内ではmatching-appが唯一の対象)
- modal内scanの実際の使用感
- time-timer/schedule-appのTab流用型2スイッチモードの実機操作感(他アプリと方式が異なるため要個別確認)

**状態: 静的存在確認のみ完了、動的順序・実機操作感はNeeds Manual Review**

---

## C. Gaze実機Gate(Tobii等)

Gaze入力宣言アプリ(5件): mogura-tataki・okane-app・scratch-app・tyushi・gaze-keyboard

**状態: 全項目未実施(Needs Manual Review)**。gaze-keyboardはHARDEN 1〜3で最も検証が進んでいるが、いずれも実Tobii体感は未実施のまま。

---

## D. Touch実指操作Gate

Touch入力宣言アプリ: okane-app・scratch-app・tokei-app(+暗黙のtouch対応アプリ多数)

target sizeの寸法測定(自動)はAUDIT-35-FIX-1Fの既存基準を参照可能だが、Tier1全12アプリに対する再測定は本Phaseでは未実施。実指の押しやすさ・誤操作・drag/swipe操作感はNeeds Manual Review。

---

## E. Contrastの状態変化確認(hover/focus/selected/disabled/error/success)

`contrast-check.py`はデフォルト表示状態のみを走査する。以下は12アプリ全件でManual Review対象:

- focus indicator(フォーカスリング)自体のコントラスト
- selected/active state(`.game-mode-btn.active`等)のコントラスト再計算(alpha合成込みで多くが既定でも不足していたため、選択状態でさらに悪化しないか)
- disabled state
- error/success state(特にokane-app/matching-appの正誤フィードバック)
- gradient/画像背景要素(register-app等のheaderグラデーション) — 前掲Needs Manual Review 16件

---

## F. Record Foundation UXの深掘り

Record Foundation対象Tier1アプリ(6件): register-app・matching-app・mogura-tataki・okane-app・janken-app・tokei-app

自動確認済み: 各アプリのrecordモーダルがrole="dialog"を持ち(前掲Modal Gate参照)、CSVエクスポート等の機能が存在すること(コード上確認)。

Manual Review対象:
- record削除等の破壊的操作の確認ダイアログがSRで適切に伝わるか
- Record modal内のCSV/削除操作のKeyboard/Switch/Gaze等価性
- aria-liveによる記録保存完了等のフィードバックの分かりやすさ

---

## G. PWA Accessibility Gate

PWA Pilot対象: janken-app・tokei-app

Manual Review対象: install prompt・offline状態・update状態のアクセシビリティ(スクリーンリーダーでの通知・フォーカス)。PWA技術自体(cache戦略等)は本監査の対象外(Audit plan §23の境界通り)。

---

## H. Learning Feedback体感

12アプリ全件で、成功/失敗/完了演出の「わかりやすさ」自体はManual Review。自動確認済み: aria-live使用は全12アプリで確認(前掲static-audit参照)。色以外の手段(テキスト・音声)の併用有無は個別コードから部分確認したもの(例: matching-appの勝敗発表は音声+テキスト併用を確認済み)を除き、Tier1全件の網羅調査は未実施。
