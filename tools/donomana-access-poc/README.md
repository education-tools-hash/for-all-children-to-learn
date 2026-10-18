# tools/donomana-access-poc/

Donomana Access（開発中、Phase 2: Core Input & Feedback）のテスト一式。

対象アプリ: `../../donomana-access.html`（まだ `apps-data.json` / `index.html` /
`generate.js` には登録していない。Production公開対象のアプリ一覧への追加は
後続Phaseで別途検討する）。

本Phaseでは操作記録の永続保存・学習記録表示・教師の観察メモ・JSONエクスポートは
対象外。入力方式選択・タッチ入力・外部スイッチ入力・共通入力イベント正規化・
即時フィードバックのみを扱う。

## 実行方法

```bash
# 純粋ロジック(assets/js/donomana-access-core.js)のNode golden tests
node tools/donomana-access-poc/donomana-access-core-golden-tests.js

# 実ブラウザ検証(Playwright + Chromium, file://で直接開く)
python3 tools/donomana-access-poc/donomana-access-realbrowser-test.py
```

## 構成

- `assets/js/donomana-access-core.js` — DOM非依存の純粋ロジック（共通入力イベント
  schema生成、OSキーリピート抑制のための状態機械、Switch Scan候補取得の一般化）。
  既存の `assets/js/record-dashboard-foundation.js` と同じ、ブラウザの`<script>`
  タグからもNode.jsの`require()`からも読み込める形式。
- `donomana-access-core-golden-tests.js` — 上記の純粋ロジックのみを検証する
  Node.js単体テスト。
- `donomana-access-realbrowser-test.py` — `donomana-access.html`を実際に
  Chromiumで開き、タッチ・外部スイッチ（キーボードSpace/Enterでの代替確認）・
  画面遷移・アクセシビリティの基本動作を確認する。375/768/1024/1280pxの4幅で実行。

## 実機確認との関係

本テストはいずれもブラウザ自動テストであり、iPad Safari実機・AbleNet Blue2実機
での確認とは区別する。外部スイッチの実機確認は別途実施が必要
（`DONOMANA-ACCESS-MVP-DESIGN-APPROVAL-1.md` 4.4節参照）。
