# WCAG-JIS-AUDIT-1-TIER3: Contrast Gate結果

- ツール: `tools/accessibility-audit/contrast-check.py`
- 生データ: `tools/accessibility-audit/tier3/contrast-results.json`

## サマリ

| app | 総チェック数 | 信頼できる判定数 | 閾値未達(Fail) | Needs Manual Review(gradient/画像背景) |
|---|---|---|---|---|
| nazori-app | 17 | 14 | 0 | 3 |
| timetable-app | 17 | 11 | **3** | 6 |
| yomikaki-app | 12 | 11 | **8** | 1 |
| sugoroku-app | 25 | 0 | 0 | **25** |
| sst-app | 30 | 25 | **4** | 5 |
| slideshow-sakusei | 14 | 14 | **1** | 0 |

**合計: 信頼できる判定75件中16件が閾値未達**、Needs Manual Review 40件。

sugoroku-appはTier2の一部アプリ(hiragana-learn等)と同様、ページ全体にgradient背景を採用しており自動判定カバレッジが0%となっている。

## 個別Fail一覧(信頼できる判定に基づく確定Fail、16件)

| app | 要素 | テキスト | ratio | 必要値 | fg | bg |
|---|---|---|---|---|---|---|
| timetable-app | BUTTON | 📋じこくひょうを よもう | 3.86 | 4.5 | rgb(2,136,209) | rgb(255,255,255) |
| timetable-app | BUTTON | 🚌 バス | 2.94 | 4.5 | rgb(67,160,71) | rgb(232,245,233) |
| timetable-app | BUTTON | 🔍 さがす | 3.86 | 4.5 | rgb(255,255,255) | rgb(2,136,209) |
| yomikaki-app | BUTTON | 📖 つかいかた | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H3 | ✏️ 文字をうつす | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H3 | 🔤 分かち書き | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H3 | 🔊 よみあげ | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H3 | ⚙️ じぶんに合わせる | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H2 | ✨ できること | 4.22 | 4.5 | rgb(45,125,210) | rgb(255,255,255) |
| yomikaki-app | H2 | 🎮 スイッチスキャンについて | 3.14 | 4.5 | rgb(232,93,117) | rgb(255,245,247) |
| yomikaki-app | BUTTON | ✏️ エディタをひらく | 4.22 | 4.5 | rgb(255,255,255) | rgb(45,125,210) |
| sst-app | BUTTON | ▶ テスト | 2.84 | 4.5 | rgb(255,255,255) | rgb(255,107,53) |
| sst-app | BUTTON | 中 | 2.84 | 4.5 | rgb(255,255,255) | rgb(255,107,53) |
| sst-app | BUTTON | 🌱 はじめて | 2.10 | 4.5 | rgb(255,255,255) | rgb(46,204,113) |
| sst-app | BUTTON | 🌿 なれてきた | 3.15 | 4.5 | rgb(52,152,219) | rgb(255,255,255) |
| slideshow-sakusei | LABEL | ＋写真を追加 | 2.82 | 4.5 | rgb(90,95,120) | rgb(22,24,32) |

**ホットスポット: yomikaki-app(8件)**。ブランドカラー系の青(rgb(45,125,210))が白背景に対して軒並み僅かに閾値未達(4.22 vs 必要4.5)であり、単一の配色トークンをわずかに濃くするだけで一括改善できる可能性が高い。

## Severity目安(Tier1/Tier2と同一基準)

ratio<2.0はP2、2.0〜4.49はP3。**今回の16件は全てratio 2.0以上**のため、全件P3 Lowに分類する(TIER3-F3)。

## 既知の限界

- gradient/画像背景を持つ要素は自動判定不能としてNeeds Manual Reviewへ分離(sugoroku-appは特に影響が大きい)
- hover/focus/selected/disabled/error/success等の状態変化後のコントラストは対象外
- 自動FAILは今回一切修正していない
