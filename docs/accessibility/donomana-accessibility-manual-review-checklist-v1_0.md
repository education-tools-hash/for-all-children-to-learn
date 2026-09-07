# どのまな Accessibility Manual Review Checklist v1.1

- Phase: ACCESSIBILITY-AUDIT-PREP-1(初版)/ ACCESSIBILITY-AUDIT-PREP-2(v1.1、Contrast節F追加)
- 位置づけ: `donomana-wcag-jis-audit-plan-v1_0.md`の「Manual Only」「Automated + Manual確認」項目を、実施者(人間)がその場でチェックできる形式に落とし込んだもの。
- 実施者: Claudeはスクリーンリーダー・実スイッチデバイス・視線入力デバイスを直接操作できないため、本チェックリストは**人間の実施者(ユーザーまたは支援者)が実施**し、結果をClaudeへ共有する運用を前提とする。Contrast節(F)のみ、自動ツールをClaude/実施者いずれもが実行可能。

---

## 使い方

1. Pilotアプリ(`matching-app`/`okane-app`/`gaze-keyboard`/`tokei-app`/`timetable-app`)から開始する。
2. 各項目を「OK」「NG(詳細記述)」「N/A(該当機能なし)」の3値で記録する。
3. NGが出た場合、Severity(P0〜P3、`donomana-wcag-jis-audit-plan-v1_0.md` §17)を仮に付け、Finding Familyとして他アプリへの横展開が必要か確認する。

---

## A. NVDA検証チェックリスト(Windows + NVDA + Edge推奨)

| # | 項目 | 操作キー | OK/NG/N-A |
|---|---|---|---|
| 1 | ページのtitleが読み上げられる | (ページ読込時) | |
| 2 | h1が1件、アプリ名として読み上げられる | H(次の見出し) | |
| 3 | heading navigationで見出し階層を移動できる | H / Shift+H | |
| 4 | landmark navigationでmain/header等を移動できる | D / Shift+D | |
| 5 | skip-linkが機能する(存在する場合) | Tab(ページ先頭) | |
| 6 | 全ボタンにaccessible nameがある(無名ボタンなし) | Tab巡回 | |
| 7 | フォームにラベルが関連付いている | フォーカス移動 | |
| 8 | カスタムコントロール(トグル等)の状態が読み上げられる | Tab + Enter/Space | |
| 9 | モーダルopen時、ダイアログとして認識され読み上げられる | (モーダルopen) | |
| 10 | dialog roleとtitleが正しく読み上げられる | (モーダルopen直後) | |
| 11 | モーダルopen時、フォーカスが期待通り移動する | (モーダルopen) | |
| 12 | モーダルclose後、フォーカスが起点要素へ復帰する | Escape / close button | |
| 13 | aria-live領域の更新が自動的に読み上げられる | (状態変化時) | |
| 14 | ステータスフィードバック(正誤・完了等)が音声でも伝わる | (操作後) | |
| 15 | 非表示コンテンツ(visually-hidden含む)が誤って読み上げられない | 通常巡回 | |
| 16 | 同一情報の重複読み上げがない | 通常巡回 | |
| 17 | 動的な内容更新(スコア変化等)が検知される | (操作後) | |
| 18 | 記録(Record)モーダルの内容が正しく読み上げられる | (該当アプリのみ) | |
| 19 | 共通A11yパネルの操作がNVDAで完結する | ⚙ボタン→パネル操作 | |

---

## B. VoiceOver検証チェックリスト(iPad Safari推奨、iPhone/Macは補助)

| # | 項目 | OK/NG/N-A |
|---|---|---|
| 1 | Rotorでheadingsが一覧・移動できる | |
| 2 | Rotorでlandmarksが一覧・移動できる | |
| 3 | Rotorでcontrols(ボタン・フォーム)が一覧できる | |
| 4 | モーダル内をスワイプナビゲーションできる | |
| 5 | モーダルclose後、フォーカスが起点へ復帰する | |
| 6 | aria-live更新がVoiceOverで通知される | |
| 7 | 動的コンテンツの変化が把握できる | |
| 8 | 非表示コンテンツが誤ってナビゲーション対象にならない | |
| 9 | フルスクリーン/オーバーレイ表示中もVoiceOverが機能する | |
| 10 | Touch操作(タップ探索)とVoiceOverジェスチャーが競合しない | |

---

## C. Switch検証チェックリスト(実スイッチデバイス、例: Blue2)

対象: `apps-data.json`の`input`に`switch`を含む27アプリ(Pilotではmatching-app/okane-appが該当)。

| # | 項目 | OK/NG/N-A |
|---|---|---|
| 1 | scanが開始できる(設定パネルまたはアプリ内トグル) | |
| 2 | scan対象が視覚的にハイライトされ、順に移動する | |
| 3 | selectでハイライト中の項目が実行される | |
| 4 | long press対応アプリ(kimochi-board/matching-app/bosai-app)で長押し操作が機能する | |
| 5 | モーダルopen中、scan対象がモーダル内のみに限定される | |
| 6 | モーダルをscan操作で閉じられる | |
| 7 | モーダルclose後、scan位置が適切に復帰・再構築される | |
| 8 | 共通A11yパネル使用中、アプリ側scanと競合しない | |
| 9 | 非activeな要素(disabled等)がscan対象から除外される | |
| 10 | 非表示要素がscan対象から除外される | |

---

## D. Gaze検証チェックリスト(Tobii等の実機、Manual Only)

対象: `apps-data.json`の`input`に`gaze`を含む15アプリ(Pilotではgaze-keyboardが該当)。

| # | 項目 | OK/NG/N-A |
|---|---|---|
| 1 | Gaze ON/OFFが切り替えられる | |
| 2 | dwell timeの設定が反映される | |
| 3 | dwell進捗が視覚的にフィードバックされる | |
| 4 | 選択後の誤再選択防止(reselection guard)が機能する | |
| 5 | ターゲットが十分な大きさ・間隔で配置されている | |
| 6 | 視線の一時的なブレによる誤操作が起きにくい(visual timing) | |
| 7 | gaze遅延設定が体感と一致する | |
| 8 | モーダル表示中もGaze操作が正しく機能する | |
| 9 | 共通A11yパネルをGazeで操作できる | |
| 10 | 他入力方式(Touch/Switch)と同等の操作が可能(alternative input equivalence) | |

---

## E. Touch検証チェックリスト(実機タブレット推奨)

| # | 項目 | OK/NG/N-A |
|---|---|---|
| 1 | 全操作対象が44px相当以上のtarget sizeを持つ | |
| 2 | 隣接ボタン間に誤タップを防ぐ間隔がある | |
| 3 | 意図しない誤操作(accidental activation)が起きにくい | |
| 4 | drag操作に代替手段がある(該当アプリのみ) | |
| 5 | swipe操作がスクロールと競合しない | |
| 6 | モーダル表示中、背後のスクロール等が誤操作されない | |
| 7 | フルスクリーン切替がTouchで問題なく行える | |
| 8 | landscape/portraitどちらでも操作可能 | |

---

## F. Contrast検証チェックリスト([v1.1]新設)

**実施順序**: まず`tools/accessibility-audit/contrast-check.py`(ACCESSIBILITY-AUDIT-PREP-2で新規作成)を実行し、自動計算されたfail一覧を得る。その上で以下の観点をManualで確認する。

| # | 項目 | OK/NG/N-A |
|---|---|---|
| 1 | 自動ツールのfail一覧を目視で確認し、デザイン上の意図(装飾的テキスト等、WCAGの対象外となりうる箇所)を除外する | |
| 2 | 自動ツールが`backgroundUnreliable: true`(gradient/画像背景)としたNeeds Manual Review項目を、DevToolsのスポイト等で実際の背景色を確認しコントラスト比を実測する | |
| 3 | focus indicator(フォーカスリング)自体のコントラストが3:1以上か | |
| 4 | disabled state(操作不可表示)のコントラストが要件外であることを確認(WCAG上disabled要素は通常対象外だが、意図的にdisabledと分かる視覚差があるか) | |
| 5 | selected/active state(選択中表示)が色だけに依存していないか(形状・アイコン等の併用) | |
| 6 | error state(エラー表示)が色だけに依存していないか | |

**既知の制約**: 自動ツールはテキスト要素の色コントラストのみを対象とし、UIコンポーネント境界線(WCAG 1.4.11 Non-text Contrast)は自動化されていない。#3〜#6は完全にManual。

---

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PREP-1。NVDA/VoiceOver/Switch/Gaze/Touchの手動レビューチェックリスト初版作成。 |
| v1.1 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PREP-2。ACCESSIBILITY-AUDIT-PILOT-1でContrast Gateが未整備だった反省を踏まえ、F章(Contrast検証チェックリスト)を新設。`tools/accessibility-audit/contrast-check.py`(新規作成)の自動計算結果をベースにManualで最終確認する運用を明文化。 |
