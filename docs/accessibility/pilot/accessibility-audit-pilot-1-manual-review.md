# Accessibility Audit Pilot-1: Manual Review(人間実施者向け)

- Phase: ACCESSIBILITY-AUDIT-PILOT-1
- ベース: `docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`(汎用版)を、Pilot 5アプリの実際の操作導線に合わせて具体化したもの。
- **重要**: 以下はすべて**未実施**。Claudeは実スクリーンリーダー・実スイッチデバイス・実視線入力デバイスを操作できないため、推測でPASS/FAILを記入していない。人間の実施者が実際に操作し、結果を追記する運用を想定する。

---

## 実施者向け手順

各アプリのURLを開き、下表の「操作」列の通りに操作し、「期待結果」と一致するかを「結果」列に記入する(OK/NG/未実施)。NGの場合は具体的な症状を追記し、`accessibility-audit-pilot-1-findings.md`へFindingとして追加する。

---

## 1. matching-app(NVDA + Edge 想定)

| # | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| 1 | ページを開く | title「マッチング」相当が読み上げられる | |
| 2 | Hキーで見出し移動 | H1「マッチング」に到達する | |
| 3 | `donomanaHelpBtn`(❓つかいかた相当)をクリック | how-ovダイアログが開き、タイトルが読み上げられる | |
| 4 | Tabキーで巡回 | how-ov内の要素のみを巡回し、背景へ抜けない | |
| 5 | Escapeキー | how-ovが閉じ、フォーカスが❓ボタンへ戻る | |
| 6 | 対戦を1回プレイし結果画面(vs-result-ov)を表示 | 勝敗がテキストと音声(`speak()`)の両方で伝わる | |
| 7 | 記録(📊きろく)ボタンを開く | record-ovが開き、内容が読み上げられる | |

## 2. okane-app(NVDA + Edge 想定)

| # | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| 1 | ページを開く | 「おかねのおべんきょう」相当のtitleが読み上げられる | |
| 2 | 「📊 きろく」ボタンをクリック | recordsModalOverlayが開き、記録内容が読み上げられる | |
| 3 | 「✅ とじる」で閉じる | フォーカスが「📊 きろく」ボタンへ復帰する(POST-AUDIT-35-HARDEN-1で実装確認済み、SRでも同様に認識されるか再確認) | |
| 4 | モーダルopen中に共通A11yパネルを開く | パネルが正常に操作でき、モーダルへ強制的に戻されない | |
| 5 | ⚙️せってい(共通A11yパネル経由)を開く | settingsModalOverlayが開き、内容が読み上げられる | |

## 3. gaze-keyboard(NVDA + Edge 想定、PILOT-F1確認用)

| # | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| 1 | 設定ボタン(`#settingsBtn`)をクリック | ダイアログが開いたことが読み上げで通知される | **PILOT-F1により現状NG(フォーカス移動なし)の可能性が高い。実SRでの実際の症状を確認されたい** |
| 2 | 設定モーダルopen中にTabキー | 期待: モーダル内を巡回。実際: フォーカスが`#settingsBtn`のままの可能性 | |
| 3 | Escapeで閉じる | モーダルが閉じ、フォーカスが設定ボタンへ戻る(closeは正常動作を自動確認済み) | |
| 4 | 視線入力機能そのもの(gaze dwell) | 別途Gaze Auditチェックリスト(下記4章)参照 | |

## 4. gaze-keyboard(Gaze Audit、Tobii等の実機、Manual Only)

| # | 項目 | 結果 |
|---|---|---|
| 1 | Gaze ON/OFF切替が機能する | |
| 2 | dwell timeの設定が体感と一致する | |
| 3 | dwell進捗が視覚的にフィードバックされる | |
| 4 | 文字入力の誤操作(意図しない連続選択)が起きにくい | |
| 5 | 設定モーダルをGazeで開閉できる(PILOT-F1がGaze操作にどう影響するか) | |

## 5. tokei-app(VoiceOver + iPad Safari 想定)

| # | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| 1 | ページを開く | 「時計を学ぼう！」相当が読み上げられる | |
| 2 | ❓(`donomanaHelpBtn`相当、`#helpModal`のトリガー)をタップ | helpModalが開き、ダイアログとして認識される | |
| 3 | Rotorでheadingsを確認 | helpModal内の見出し(h2/h3/h4)が正しい階層で一覧される | |
| 4 | モーダルを閉じる | フォーカスがトリガーへ復帰する(自動確認済み、SRでの体感を再確認) | |
| 5 | 「📚 これまでの きろくを みる」をタップ | recordModalが開き記録が読み上げられる | |
| 6 | Touch操作とVoiceOverジェスチャー併用 | 誤操作が起きない | |

## 6. timetable-app(Touch実機、単純教材のベースライン確認)

| # | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| 1 | 全操作対象のtarget size | 44px相当以上(自動測定は本Pilot未実施、目視・実測で確認) | |
| 2 | landscape/portrait両方 | レイアウト崩れなし | |
| 3 | 共通A11yパネル操作 | 正常に開閉できる(自動確認済み) | |

---

## Contrast(全5アプリ共通、Manual Only、本Pilotでは未実施)

自動コントラスト計算ツールを本Pilotではセットアップしていない。本監査開始までに以下のいずれかを準備することを推奨する。

- ブラウザDevToolsのコントラストチェッカーを人間が使用
- または`axe-core`等のNode/Playwright統合可能なコントラスト自動計算ツールの導入検討(Production dependency扱いにしない前提で監査tool側にのみ追加)
