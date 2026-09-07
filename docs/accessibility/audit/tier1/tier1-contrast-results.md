# WCAG-JIS-AUDIT-1-TIER1: Contrast Gate結果

- ツール: `tools/accessibility-audit/contrast-check.py`(ACCESSIBILITY-AUDIT-PREP-2で確立済み、alpha合成対応・gradient/画像背景はNeeds Manual Reviewへ分離)
- 生データ: `tools/accessibility-audit/tier1/contrast-audit-results.json`

## サマリ

| app | 総チェック数 | 信頼できる判定数 | 閾値未達(Fail) | Needs Manual Review(gradient/画像背景) |
|---|---|---|---|---|
| register-app | 11 | 11 | **9** | 0 |
| matching-app | 13 | 13 | **8** | 0 |
| time-timer | 26 | 26 | **4** | 0 |
| mogura-tataki | 37 | 34 | 1 | 3 |
| okane-app | 12 | 9 | 3 | 3 |
| scratch-app | 34 | 33 | 0 | 1 |
| nazorin-print | 15 | 15 | **6** | 0 |
| schedule-app | 16 | 16 | **13** | 0 |
| janken-app | 8 | 3 | 0 | 5 |
| tokei-app | 13 | 9 | 0 | 4 |
| tyushi | 2 | 2 | 0 | 0 |
| gaze-keyboard | 29 | 29 | 2 | 0 |

**合計: 信頼できる判定238件中46件が閾値未達**、Needs Manual Review 16件。

## ホットスポット

- **schedule-app(13件)**・**register-app(9件)**・**matching-app(8件)**が特に閾値未達が多い。いずれもボタン数が多い/配色パターンが多様なアプリで、デザイントークンの組み合わせが体系的に見直されていない可能性がある
- **tyushi**はチェック対象自体が2件のみと極端に少ない(既定状態でheading同様、多くのUIがモーダル内にあり既定状態では非表示のため。TIER1-F1と同根の構造的理由)

## 既知の限界(ACCESSIBILITY-AUDIT-PREP-2から継続)

- gradient/画像背景(`background-image`)を持つ要素は自動判定不能としてNeeds Manual Reviewへ分離(誤判定防止のため)
- **hover/focus/selected/disabled/error/success等の状態変化後のコントラストは対象外**(デフォルト表示状態のみを走査)。これらはManual Reviewの対象として`tier1-manual-review.md`へ引き継ぐ
- 自動FAILは今回一切修正していない。Finding RegisterのFinding Family「Contrast」として一括管理し、Fix Backlogへ引き継ぐ

## 個別Fail一覧

詳細な要素・色値・比率は`tools/accessibility-audit/tier1/contrast-audit-results.json`の`failures`配列を参照(app単位)。代表例:

- schedule-app: 複数の`.btn-ghost`系ボタン(枠線のみで背景がbodyと同系色)がテキストコントラスト不足
- register-app: `.icon-btn`系(header内アイコンボタン)で白系アイコン/薄い背景の組み合わせが複数
- matching-app: `.game-mode-btn`等のトーン系配色(`rgba(x,y,z,.08)`ベースの淡い配色)が軒並み4.5:1を下回る
