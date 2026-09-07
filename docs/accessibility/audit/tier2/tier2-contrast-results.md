# WCAG-JIS-AUDIT-1-TIER2: Contrast Gate結果

- ツール: `tools/accessibility-audit/contrast-check.py`(ACCESSIBILITY-AUDIT-PREP-2で確立済み、alpha合成対応・gradient/画像背景はNeeds Manual Reviewへ分離)
- 生データ: `tools/accessibility-audit/tier2/contrast-results.json`

## サマリ

| app | 総チェック数 | 信頼できる判定数 | 閾値未達(Fail) | Needs Manual Review(gradient/画像背景) |
|---|---|---|---|---|
| hiragana-learn | 55 | 0 | 0 | **55** |
| katakana-app | 55 | 0 | 0 | **55** |
| shiritori2 | 13 | 0 | 0 | **13** |
| bosai-app | 12 | 0 | 0 | **12** |
| cup_game | 8 | 7 | **2** | 1 |
| ongaku-app | 9 | 3 | **1** | 6 |
| kimochi-board | 21 | 15 | **9** | 6 |
| drawing-app | 23 | 22 | **1** | 1 |
| directions-app | 10 | 10 | 0 | 0 |
| suji-manabou | 28 | 0 | 0 | **28** |
| kyou-no-kiroku | 8 | 8 | 0 | 0 |
| kurabeyou-app | 11 | 0 | 0 | **11** |
| katachi-awase-app | 10 | 10 | **2** | 0 |
| miru-hirogaru-app | 8 | 0 | 0 | **8** |
| mitsukete-touch-app | 8 | 0 | 0 | **8** |
| junban-miyou-app | 7 | 0 | 0 | **7** |
| dotchiga-ii-app | 7 | 0 | 0 | **7** |

**合計: 信頼できる判定75件中15件が閾値未達**、Needs Manual Review 217件。

## Tier1からの重要な変化: Needs Manual Reviewの比率が大幅増加

Tier1では信頼できる判定238件・NMR16件(全体の約6%)だったのに対し、Tier2では信頼できる判定75件・NMR217件(**全体の約74%**)と逆転している。

**原因**: Tier2の複数アプリ(hiragana-learn・katakana-app・shiritori2・bosai-app・suji-manabou・kurabeyou-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app、計10アプリ)は`html`または`body`セレクタ全体に`linear-gradient`の背景を適用するデザインパターンを採用しており(例: suji-manabou.html:87 `background: linear-gradient(180deg, #87CEEB 0%, #B0E0FF 40%, #E8F5E9 100%)`)、ページ内の**全てのテキスト要素**が「gradient祖先を持つ」と正しく判定されてNeeds Manual Reviewへ回っている。これはツールの誤動作ではなく、`getComputedStyle().backgroundColor`ではgradientの実際のレンダリング色を取得できないという既知の設計上の限界(ACCESSIBILITY-AUDIT-PREP-2で確立)が正しく働いた結果であり、誤判定防止のための意図した保守的挙動である。

この10アプリについては、自動Contrast Gateが実質的にカバレッジを持たず、**Manual Review(実機目視確認)への依存度がTier1より大幅に高い**という構造的な事実を記録しておく。

## 個別Fail一覧(信頼できる判定に基づく確定Fail、15件)

| app | 要素 | テキスト | ratio | 必要値 | fg | bg | 大文字判定 |
|---|---|---|---|---|---|---|---|
| cup_game | H1 | 🎩 どこかな？ | 2.78 | 3 | rgb(255,107,107) | rgb(255,255,255) | 大 |
| cup_game | BUTTON | 2つ🟢やさしい | 2.78 | 4.5 | rgb(255,255,255) | rgb(255,107,107) | 小 |
| ongaku-app | BUTTON | 元にもどす | 2.95 | 4.5 | rgb(255,255,255) | rgb(77,150,255) | 小 |
| kimochi-board | BUTTON | ×(閉じる) | 2.32 | 3 | rgb(170,170,170) | rgb(255,255,255) | 大 |
| kimochi-board | BUTTON | −(削除) | 2.68 | 3 | rgb(255,107,157) | rgb(255,255,255) | 大 |
| kimochi-board | BUTTON | ＋(追加) | 2.68 | 3 | rgb(255,107,157) | rgb(255,255,255) | 大 |
| kimochi-board | BUTTON | 【ねらったところで選ぶの設定説明】 | 2.32 | 4.5 | rgb(170,170,170) | rgb(255,255,255) | 小 |
| kimochi-board | BUTTON | えらぶ | 2.68 | 4.5 | rgb(255,107,157) | rgb(255,255,255) | 小 |
| kimochi-board | BUTTON | 📷 写真 | 3.48 | 4.5 | rgb(58,134,255) | rgb(255,255,255) | 小 |
| kimochi-board | BUTTON | 🖍️ かく | 4.23 | 4.5 | rgb(139,92,246) | rgb(255,255,255) | 小 |
| kimochi-board | BUTTON | 【元の設定にもどす説明】 | 2.32 | 4.5 | rgb(170,170,170) | rgb(255,255,255) | 小 |
| kimochi-board | BUTTON | やめる | 3.11 | 4.5 | rgb(136,136,136) | rgb(240,240,240) | 小 |
| drawing-app | BUTTON | 🔄(やり直し) | 3.24 | 4.5 | rgb(255,68,68) | rgb(255,248,240) | 小 |
| katachi-awase-app | BUTTON | かたち | 2.93 | 4.5 | rgb(255,255,255) | rgb(0,169,157) | 小 |
| katachi-awase-app | BUTTON | ひとつ | 2.93 | 4.5 | rgb(255,255,255) | rgb(0,169,157) | 小 |

**ホットスポット: kimochi-board(9件)**。アイコンボタン(×/−/＋)・淡い配色の説明文ボタン・グレー系「やめる」ボタンなど、コミュニケーションボードという性質上ボタン数が多いアプリで閾値未達が集中している。

## Severity目安(Tier1と同一基準)

ratio<2.0はP2、2.0〜4.49はP3。**今回の15件は全てratio 2.0以上**のため、全件P3 Lowに分類する(TIER2-F4)。

## 既知の限界(ACCESSIBILITY-AUDIT-PREP-2から継続)

- gradient/画像背景(`background-image`)を持つ要素は自動判定不能としてNeeds Manual Reviewへ分離(誤判定防止のため)。Tier2ではこの制約の影響が特に大きい(上記参照)
- hover/focus/selected/disabled/error/success等の状態変化後のコントラストは対象外(デフォルト表示状態のみを走査)
- 自動FAILは今回一切修正していない
