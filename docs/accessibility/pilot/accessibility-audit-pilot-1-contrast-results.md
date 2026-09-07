# Accessibility Audit Pilot-1: Contrast Gate実証結果

- Phase: ACCESSIBILITY-AUDIT-PREP-2
- 位置づけ: `donomana-wcag-jis-audit-plan-v1_0.md` §16(Contrast Gate)で「未実施」としていたギャップを埋めるため、`tools/accessibility-audit/contrast-check.py`(本Phaseで新規作成、Production dependency非追加・WCAG公式計算式のみで実装)をPilot 5アプリに対して実行した結果。
- 生データ: `tools/accessibility-audit/pilot/contrast-results.json`

## ツール開発中に発見・修正した2件のバグ(重要、方法論的教訓として記録)

開発時のスポットチェックで、以下2件の誤検出をコードで直接確認の上で修正した。**Pilotの教訓(「自動判定は単一の判定条件だけでは信頼できない」)がContrast Gateでも再現した。**

1. **半透明背景の非合成バグ**: `background-color`の最初の非ゼロalpha値をそのまま実効背景色として採用していたため、`rgba(232,149,109,.08)`(8%不透明度)のような「activeボタンの薄い色ティント」を完全不透明の濃い色と誤認識し、`color:var(--primary)`と同一色の"背景"を報告(ratio=1.0という物理的にありえない値)。祖先チェーンの背景色を外側から内側へ正しくalpha合成するよう修正(matching-appの`.game-mode-btn.active`で実例確認)。
2. **グラデーション/画像背景の見落とし**: `getComputedStyle().backgroundColor`は`background: linear-gradient(...)`ショートハンドで設定されたグラデーションを検出できない(`background-image`側に設定され、`background-color`は透明のまま)。この結果、okane-app/tokei-appのグラデーションヘッダー内の白文字が「白背景に白文字、ratio≈1.0」という誤検出を生んだ(okane-app.html:114 `header{background:linear-gradient(135deg,#FFD700,#F4A200);...}`で実例確認)。**この誤りは真のpixelサンプリングでしか完全には解決できない**ため、ツール側は「祖先に`background-image`を持つ要素は判定不能」として明示的に除外し、Pass/Failを`null`(Needs Manual Review)として扱うよう修正した。

この2件の発見・修正により、Contrast Gate tool自体の限界(何を自動判定でき、何ができないか)がより正確に定義された。

## 結果サマリ(修正後、最終)

| app | 総チェック数 | 信頼できる判定数 | 閾値未達(Fail) | 背景グラデーション/画像でNeeds Manual Review |
|---|---|---|---|---|
| matching-app | 13 | 13 | **8** | 0 |
| okane-app | 12 | 9 | **3** | 3 |
| gaze-keyboard | 29 | 29 | **2** | 0 |
| tokei-app | 13 | 9 | 0 | 4 |
| timetable-app | 17 | 11 | **3** | 6 |

## 確認済みFail(信頼できる背景色判定に基づく、代表例)

| app | 要素 | fg | bg | ratio | 必要値 |
|---|---|---|---|---|---|
| matching-app | 「＋ あたらしいセットをつくる」等の複数ボタン | rgb(232,149,109) | 白 | 2.35 | 4.5 |
| matching-app | 「🌈 ふつうカード12まい」 | rgb(230,81,0) | rgb(255,243,224) | 3.46 | 4.5 |
| okane-app | 「📚 おかねをしろう」 | 白 | rgb(244,162,0) | 2.10 | 4.5 |
| okane-app | 「🔊 よむ」 | 白 | rgb(91,196,245) | 1.97 | 4.5 |
| gaze-keyboard | 「表示中」「ひらがな」 | 白 | rgb(58,134,255) | 3.48 | 4.5 |
| timetable-app | 「📋じこくひょうを よもう」 | rgb(2,136,209) | 白 | 3.86 | 4.5 |
| timetable-app | 「🚌 バス」 | rgb(67,160,71) | rgb(232,245,233) | 2.94 | 4.5 |

**これらは新規Findingとして即座にFixするのではなく、本監査(WCAG-JIS-AUDIT本体)のFinding Registerへ正式に引き継ぐ。**(本Phaseはコード修正禁止のスコープ)

## Needs Manual Review(グラデーション/画像背景、代表例)

okane-app/tokei-app/timetable-appのヘッダー・一部ボタン(`linear-gradient`使用)は、本ツールでは信頼できる背景色を抽出できない。実際の見た目コントラストは目視またはDevToolsのスポイトツールでの実測が必要。

## Contrast Gateの位置づけ(Audit plan v1.1へ反映)

- 本ツールは**一次スクリーニング専用**であり、`donomana-wcag-jis-audit-plan-v1_0.md` §16の方針(「自動判定のみで最終適合判断はしない」)通り、Fail判定は本監査でのManual確認対象、Needs Manual Review判定(グラデーション/画像背景)はさらに優先度の高いManual確認対象として扱う。
- Production dependencyは追加していない(`playwright`は監査tool専用、既にセッション環境に導入済みのものを利用)。

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PREP-2。Contrast Gate tool(`contrast-check.py`)をPilot 5アプリに対して実行し初回結果を記録。開発中に発見した2件のツールバグ(半透明背景の非合成、グラデーション/画像背景の見落とし)を修正した上での最終結果。 |
