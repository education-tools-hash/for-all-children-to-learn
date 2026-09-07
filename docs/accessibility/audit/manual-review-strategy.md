# Manual Review Strategy(35アプリ横断)

NVDA/VoiceOver/Blue2/Tobii/Touch実指/Contrastの状態変化等、Claudeが実機操作できない領域について、35アプリ全数を無秩序に総当たりするのではなく、代表抽出+high-risk追加方式を設計する。**本ファイルは戦略設計のみで、実機検証そのものは実施しない。**

---

## 1. Screen Reader Gate(NVDA / VoiceOver)戦略

35アプリを両方のSRで総当たり(70組み合わせ)するのは非現実的な工数となるため、代表抽出方式を採用する。

### High-risk必須(6アプリ)

| app | 理由 |
|---|---|
| ongaku-app | FAMILY-A/B/C複合の構造課題(P1)、Fix後の最優先確認対象 |
| register-app | dialog数最多(8)、Focus Restoration異常(TIER1-F5)、Contrast fail最多クラス(9件) |
| gaze-keyboard | Gaze対応・機微データ標準、Fix実績最多(HARDEN1〜3) |
| tyushi | TIER1-F1(既に修正済みだが体感未確認、最優先の検証対象) |
| slideshow-sakusei | TIER3-F2(Reflow)、編集系ツールという特殊なUI構造 |
| yomikaki-app | TIER3-F1(見出し階層スキップ)の直接的な読み上げ体感確認 |

### カテゴリ代表

| カテゴリ | 代表アプリ | 選定理由 |
|---|---|---|
| Record代表 | okane-app、sst-app | Record Foundation対象(21アプリ中)、破壊的操作の確認ダイアログ体験 |
| Modal代表(系統別) | matching-app(系統A)・tokei-app(系統B)・schedule-app(系統C)・mogura-tataki(系統D) | 背景抑制4系統それぞれの体感差を確認 |
| Switch代表 | matching-app(long press対応の唯一例) | Switch対応27アプリ中、特殊な操作方式を持つ代表 |
| Gaze代表 | drawing-app、katachi-awase-app | Gaze対応15アプリ中、modal有無・Fix対象(drawing-appはTIER2-F5)を含む代表 |
| Simple app代表 | timetable-app、directions-app | app固有モーダル0件のシンプル構造代表 |

**合計代表数: 6(high-risk) + 8(カテゴリ代表、重複除く) ≈ 12〜13アプリ。** 35アプリ全数ではなく、この代表セットにNVDA・VoiceOver両方を実施することで、35アプリの構造パターン(モーダル4系統・Record・Switch・Gaze・シンプル構造)を実質的に網羅する。

残り22アプリは代表アプリと同一パターンに分類できるものが多く(例: hiragana-learn/katakana-appはtraceSampleViewerの共通実装)、**代表確認後に「同一実装パターンのアプリは横展開確認(簡易チェックリストのみ)」という2段階方式**を推奨する。

---

## 2. Switch実機Gate(Blue2)戦略

Switch対応27アプリ全数の完全総当たりは避け、以下の方式を採用する。

- **共通実装パターン単位で1アプリを代表実施**: switch-scan候補構築ロジック(`buildScanItems()`/`getScanTargets()`等)は複数アプリで共通/類似実装のため、パターンごとに1アプリを深掘りすれば足りる可能性が高い
- **high-risk個別確認**: matching-app(long press対応の唯一例)、ongaku-app(Fix後の新規Focus Trap実装の検証が必要)、time-timer/schedule-app(Tab流用型2スイッチモードという特殊方式)
- 全27アプリの「起動・基本scan動作」は簡易チェックリストで横展開確認(詳細実機操作感は代表のみ深掘り)

---

## 3. Gaze実機Gate(Tobii)戦略

Gaze対応15アプリについて:

- **modalあり+dwell設定あり+progression要素あり**の複合アプリを優先: gaze-keyboard、drawing-app(Fix対象)、katachi-awase-app(Fix対象)、mogura-tataki
- **シンプルなON/OFF切り替えのみ**のアプリ(kyou-no-kiroku等)は代表1アプリのみで横展開判断
- Fix対象(drawing-app)は修正後に必ず再確認

---

## 4. Touch実機Gate戦略

Touch宣言20アプリについて:

- target size・spacing・誤操作の測定はデザイントークン(ボタンサイズ)が共通の場合が多いため、共通コンポーネント単位で代表確認
- drag/swipe代替操作を持つアプリ(スライドショー作成の写真並べ替え等)は個別確認が必要
- 代表: okane-app(タッチ操作の複雑度高)、slideshow-sakusei(drag操作あり、Fix対象)、hiragana-learn/katakana-app(トレース系タッチ操作)

---

## 5. Contrastの状態変化(hover/focus/selected/disabled)戦略

273件のNeeds Manual Reviewを無秩序に全件確認しない。以下の代表抽出方式を採用する。

| カテゴリ | 代表アプリ | 対象範囲 |
|---|---|---|
| Gradient背景系代表 | schedule-app風ではなくhiragana-learn(Tier2で最多NMR件数=55件)、sugoroku-app(Tier3で25件全件NMR) | 全ページgradient背景パターンの代表確認 |
| Image背景系代表 | 該当アプリを個別特定して代表選定(本Triageでは詳細抽出は範囲外、次Phaseで実施) | - |
| Focus state代表 | matching-app、okane-app(既にFix実績あり) | focus indicatorのコントラスト |
| Selected/active state代表 | matching-app(`.game-mode-btn.active`)、sugoroku-app(マス選択状態) | 状態変化後の再計算 |
| Disabled state代表 | 各カテゴリ1アプリ | - |
| Success/error state代表 | okane-app、matching-app(正誤フィードバック) | 色以外の手段併用確認と合わせて実施 |

**同一CSS token/componentを使うアプリ群は、代表検証の結果が横展開可能かどうかをコード比較(クラス名・CSS変数の一致)で判断してから展開する。**

---

## 6. Learning Feedback体感戦略

35アプリ全件で「わかりやすさ」自体はManual Reviewだが、以下の観点は代表抽出で足りる:

- 色以外の手段(テキスト・音声)の併用パターンは、既に確認済みのmatching-app(音声+テキスト併用)を基準として、同一実装パターンのアプリを横展開確認
- aria-live使用は全35アプリで自動確認済み(コード存在確認)

---

## 7. まとめ: Manual Review実施順序案

1. Fix実施後、まずFix対象アプリ(ongaku-app・drawing-app・slideshow-sakusei・yomikaki-app等)を最優先でNVDA/VoiceOver確認
2. High-risk 6アプリ + カテゴリ代表(SR)を実施
3. Contrast代表(gradient/image/state変化)を実施
4. Switch/Gaze/Touch代表を実施
5. 代表確認の結果、同一実装パターンと判定されたアプリ群を簡易チェックリストで横展開確認
6. 代表確認で問題が見つかった場合のみ、該当パターンを共有する全アプリを深掘り

この方式により、35アプリ×4実機カテゴリ(NVDA/VoiceOver/Blue2/Tobii)の完全総当たり(140組み合わせ)ではなく、**代表セット(合計20アプリ前後)への深掘り+残り15アプリ前後への簡易横展開確認**という現実的な工数に収める。
