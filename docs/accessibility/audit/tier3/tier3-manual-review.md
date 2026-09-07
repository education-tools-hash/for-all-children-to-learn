# WCAG-JIS-AUDIT-1-TIER3: Manual Review Backlog

Claudeが実機操作できない項目、および動的なユーザー操作フローの深い検証が必要な項目を、推測でPASS/FAILとせず一覧化する。ベースは`docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`(v1.1)。

---

## A. Screen Reader Gate(NVDA / VoiceOver、代表アプリ方式)

代表選定:

| 代表アプリ | 選定理由 |
|---|---|
| yomikaki-app | TIER3-F1(見出し階層スキップ)の実際の読み上げ体験を確認する最優先候補。Contrast fail最多(8件)でもある |
| slideshow-sakusei | TIER3-F2(Reflowオーバーフロー)がモバイル実機でどう体感されるかの確認候補。「＋写真を追加」のContrast fail(暗背景)も含む |
| sst-app / nazori-app | Record Foundation対象(記録の読み上げ・削除確認フローの検証) |

**状態: 全項目未実施(Needs Manual Review)**

---

## B. Switch実機Gate(Blue2等)

Switch入力宣言アプリ: nazori-app・sugoroku-app(2件)

自動確認済み: 両アプリともapp固有モーダルが存在しないため、Switch Scanの「modal内候補分離」という観点自体が不要(Tier1/Tier2で確認されたmodal関連の複雑な検証対象がない)。

**状態: scan順序・実機操作感はNeeds Manual Review**

---

## C. Gaze実機Gate(Tobii等)

Tier3対象6アプリでGaze入力を宣言しているアプリは0件。**本Gateは該当アプリなし**。

---

## D. Touch実指操作Gate

Touch入力宣言アプリ: timetable-app・sugoroku-app(2件)

target sizeの寸法測定・実指の押しやすさはNeeds Manual Review。

---

## E. Contrastの状態変化確認(hover/focus/selected/disabled/error/success)

`contrast-check.py`はデフォルト表示状態のみを走査する。以下は6アプリ全件でManual Review対象:

- focus indicator自体のコントラスト
- selected/active state(sugoroku-appのマス選択状態等)
- **sugoroku-appはページ全体gradient背景のためContrast Gateがほぼ機能しない(25件中25件Needs Manual Review)。実機目視確認の優先度を上げることを推奨**

---

## F. Record Foundation UXの深掘り

Record Foundation対象: nazori-app・sst-app(2件)

自動確認済み: 破壊的操作(記録削除等)にネイティブ`confirm()`を使用していることをコード確認(role="dialog"の独自モーダルではない)。

Manual Review対象:
- ネイティブ`confirm()`のSRでの読み上げ体験(ブラウザ標準実装のため通常は問題ないと想定されるが、実機確認は未実施)
- CSV/削除操作のKeyboard/Switch等価性

---

## G. PWA Accessibility Gate

Tier3対象アプリにPWA Pilot該当なし。**本Gateは対象外**。

---

## H. Learning Feedback体感

6アプリ全件で、成功/失敗/完了演出の「わかりやすさ」自体はManual Review。自動確認済み: aria-live使用は全6アプリで確認。

---

## I. Reflow/モバイル対応の実機確認(Tier3固有の追加項目)

slideshow-sakusei(TIER3-F2)について、実際のモバイル端末(iOS Safari/Android Chrome)でのピンチズーム・横スクロール操作感を確認する。本アプリがそもそもモバイル利用を想定しているかの製品方針判断とセットで実施することを推奨。
