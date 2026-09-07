# WCAG-JIS-AUDIT-1-TIER2: Manual Review Backlog

Claudeが実機操作できない項目、および動的なユーザー操作フローの深い検証が必要な項目を、推測でPASS/FAILとせず一覧化する。ベースは`docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`(v1.1)。

---

## A. Screen Reader Gate(NVDA / VoiceOver、代表アプリ方式)

代表選定(Tier2の中でも構造が異なるものを優先):

| 代表アプリ | 選定理由 |
|---|---|
| kimochi-board | Contrast fail最多(9件)、コミュニケーションボードという性質上、視覚提示への依存度が高い |
| ongaku-app | modal-pin/export/shareにARIAダイアログ機構が全く無い最も深刻なModal Gate結果(TIER2-F2/F3) |
| katachi-awase-app | TIER2-F6(スイッチスキャン設定トグル自体が無名化している疑い)の実際の読み上げ体験を確認する最優先候補 |
| kurabeyou-app / katachi-awase-app / miru-hirogaru-app / mitsukete-touch-app / junban-miyou-app / dotchiga-ii-app | switch・gaze・keyboard全対応の6アプリ群(app固有モーダルはないが、入力方式カバレッジが最も広い) |

**状態: 全項目未実施(Needs Manual Review)**。特にkatachi-awase-appでは「スイッチスキャン設定トグルにフォーカスした際、名前が読み上げられるか」を最優先で確認する。

---

## B. Switch実機Gate(Blue2等)

Switch入力宣言アプリ(13件): hiragana-learn・katakana-app・shiritori2・bosai-app・cup_game・ongaku-app・kimochi-board・directions-app・suji-manabou・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app(apps-inventory.json参照、実質ほぼ全17アプリ)

自動確認済み: Switch Scan候補構築ロジックの存在確認(静的コード分析)。ただし以下はPlaywrightでの動的検証・実機検証とも未実施:

- 各アプリのscan順序が利用者にとって自然か
- katachi-awase-appの`#toggleScan`自体がswitch-scan候補としてどう読み上げ/提示されるか(TIER2-F6と直結)
- ongaku-appのmodal-pin/export/share内でscan isolationが正しく機能するか(role="dialog"がないため、Tier1のhelp panel同等のisolation機構が適用されているか要個別確認)

**状態: 静的存在確認のみ完了、動的順序・実機操作感はNeeds Manual Review**

---

## C. Gaze実機Gate(Tobii等)

Gaze入力宣言アプリ: cup_game・kimochi-board・drawing-app・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app(10件)

**状態: 全項目未実施(Needs Manual Review)**

---

## D. Touch実指操作Gate

Touch入力宣言アプリ: hiragana-learn・katakana-app・cup_game・ongaku-app・drawing-app・directions-app・suji-manabou・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app(12件)

target sizeの寸法測定・実指の押しやすさ・誤操作・drag/swipe操作感はNeeds Manual Review。特にkimochi-boardのアイコンボタン(×/−/＋)はContrast fail(TIER2-F4)と重なっており、視認性・押しやすさの両面から優先度を上げることを推奨。

---

## E. Contrastの状態変化確認(hover/focus/selected/disabled/error/success)

`contrast-check.py`はデフォルト表示状態のみを走査する。以下は17アプリ全件でManual Review対象:

- focus indicator(フォーカスリング)自体のコントラスト
- selected/active state(kimochi-boardの選択済みシンボル等)のコントラスト再計算
- disabled state
- error/success state
- **gradient/画像背景を持つ10アプリ(hiragana-learn・katakana-app・shiritori2・bosai-app・suji-manabou・kurabeyou-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app)は自動Contrast Gateがほぼ機能しないため、実機目視によるコントラスト確認の優先度をTier1より引き上げることを推奨**(`tier2-contrast-results.md`参照)

---

## F. Record Foundation UXの深掘り

Record Foundation対象Tier2アプリ: hiragana-learn・katakana-app・shiritori2・bosai-app・directions-app・suji-manabou・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app(13件)

自動確認済み: shiritori2/bosai-appのrecordモーダルがrole="dialog"を持つこと(前掲Modal Gate参照)。

Manual Review対象:
- record削除等の破壊的操作の確認ダイアログがSRで適切に伝わるか
- Record modal内操作のKeyboard/Switch/Gaze等価性
- hiragana-learn/katakana-appのtraceSampleViewer(お手本比較表示)がSRでどう伝わるか(Focus Trap欠如[TIER2-F2]と合わせて特に優先度が高い)

---

## G. PWA Accessibility Gate

Tier2対象アプリにPWA Pilot該当なし(該当2アプリ[janken-app・tokei-app]はTier1)。**本Gateは対象外**。

---

## H. Learning Feedback体感

17アプリ全件で、成功/失敗/完了演出の「わかりやすさ」自体はManual Review。色以外の手段(テキスト・音声)の併用有無の網羅調査は未実施。

---

## I. ongaku-app modal-pin/export/shareの機能的アクセシビリティ深掘り(Tier2固有の追加項目)

TIER2-F2/F3で自動確認した「role/Escape/Focus Trap/初期focusが一切ない」という構造的事実を踏まえ、以下は実機でのみ確認可能なため追加する:

- キーボードのみでmodal-pin(教員用PIN入力)にアクセス・操作・離脱ができるか(Tabで背景へ抜けた場合の混乱の実際の程度)
- SRでこれらのオーバーレイが「ダイアログが開いた」と一切アナウンスされない場合の実際の利用者体験
