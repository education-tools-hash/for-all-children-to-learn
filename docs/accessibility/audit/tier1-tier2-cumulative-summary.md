# WCAG-JIS-AUDIT-1: Tier1+Tier2 累積サマリー(29アプリ)

- 対象: Tier1(12アプリ) + Tier2(17アプリ) = 29アプリ(全35アプリ中83%)
- 未実施: Tier3(6アプリ)
- 本ファイルはTier1(`tier1/tier1-summary.md`等)・Tier2(`tier2/tier2-summary.md`等)の集計結果を横断集計したものであり、新たなFindingは含まない。

---

## 1. Finding Family別 集計

| Finding Family | Tier1件数(app数) | Tier2件数(app数) | 累計app数(29中) | 備考 |
|---|---|---|---|---|
| Heading Runtime Visibility | 1(tyushi) | 0 | 1 | Tier2は17/17 PASS(再発なし)。tyushiは既にAUDIT-35-H1-IMPL-2で修正済み(Closed) |
| FT-1(A11yパネル例外欠如) | 4(register-app・time-timer・janken-app・tokei-app) | 3(shiritori2・bosai-app・ongaku-app) | 7 | 29アプリ中24%で発生。修正パターンは確立済み(横展開のみ) |
| FT-2(Focus Trap欠如) | 5(mogura-tataki・scratch-app・nazorin-print・tyushi・gaze-keyboard) | 4(hiragana-learn・katakana-app・cup_game・ongaku-app) | 9 | 29アプリ中31%で発生。ongaku-appは3モーダル分がrole="dialog"すら未付与という、Tier1になかった深刻度の高いサブパターン |
| Initial Focus Missing | 0(Tier1範囲では未計上。PILOT-F1/NEW-KNOWN-1はHARDEN済みでClosed) | 2(cup_game・ongaku-app[3モーダル]) | 2 | Tier2で新規確立したFamily |
| Contrast | 8(register-app・matching-app・time-timer・mogura-tataki・okane-app・nazorin-print・schedule-app・gaze-keyboard) | 5(cup_game・ongaku-app・kimochi-board・drawing-app・katachi-awase-app) | 13 | 29アプリ中45%で信頼できる閾値未達を確認 |
| Focus Restoration | 1(register-app、TIER1-F5) | 0 | 1 | Tier2の6モーダルアプリは全件正常 |
| Reflow Overflow | 0 | 1(drawing-app) | 1 | Tier2で新規確立したFamily |
| Broken ARIA Reference | 0 | 1(katachi-awase-app) | 1 | Tier2で新規確立したFamily |
| Spec Decision Required(背景抑制方式) | 12アプリ全件(4系統に分裂) | 6アプリ(系统B×1、系统D×5) | 18(app固有モーダルを持つアプリの合計) | TIER1-F6として一本化管理 |

---

## 2. Severity(P0〜P3)累計

> **[2026-09-07更新]** WCAG-JIS-FIX-P1-A-REVIEWでTIER2-F6をP1→P2へ再分類(Chromium実機Evidenceでaccessible name欠落が再現しなかったため。詳細は`tier2/tier2-findings.md`のTIER2-F6訂正セクション参照)。同Findingは既にRC commit e32c45eで修正済み(main未反映)。下表は更新後の値。

| Severity | Tier1 | Tier2 | 累計 |
|---|---|---|---|
| P0 Critical | 0 | 0 | **0** |
| P1 High | 0 | 1(TIER2-F3、cup_game分は解消済み・ongaku-app分がOPENのため件数維持) | **1** |
| P2 Medium | 5(Finding単位) | 4(TIER2-F1, F2, F5, F6) | **9** |
| P3 Low | Contrastの一部(個別評価待ち) | 1(TIER2-F4、15件) | Contrast系はいずれもTier分類基準で個別評価 |

**AUDIT PILOT BLOCKING FINDING相当(P0操作不能)は29アプリ通じて0件。**

Tier2で初めてP1 Highが計上された点が当初の最大の変化点だったが、TIER2-F6は実機Evidenceによる再評価でP2へ訂正されたため、**29アプリ累計で現存するP1はTIER2-F3(初期focus欠如)の1件のみ**となった。この訂正の経緯自体が、「broken referenceを検出した場合に影響範囲を実機検証なしで即断しない」という教訓としてTier3横展開へ引き継ぐべき事項である(`tier2-fix-backlog.md`のTier3横展開の推奨事項参照)。

**[2026-09-07追記]** WCAG-JIS-FIX-P1-B-RELEASEでTIER2-F3のcup_game分(helpModal)をProduction反映(commit `a53f307`)。ongaku-app分(modal-pin/export/share)はTIER2-F2のrole="dialog"新規付与・Focus Trap実装と一体のため引き続きOPEN。**Finding全体としてはPARTIALLY RESOLVED、Severity P1は維持**(Finding件数としては1のまま。cup_game分の解消はFinding Family内の部分的進捗であり、Family全体のClose/降格根拠にはしない)。

---

## 3. Contrast Gateホットスポット(Tier1+Tier2横断)

| app | 信頼できるfail件数 |
|---|---|
| schedule-app(Tier1) | 13 |
| register-app(Tier1) | 9 |
| kimochi-board(Tier2) | 9 |
| matching-app(Tier1) | 8 |
| nazorin-print(Tier1) | 6 |
| time-timer(Tier1) | 4 |
| katachi-awase-app(Tier2) | 2 |
| gaze-keyboard(Tier1) | 2 |
| cup_game(Tier2) | 2 |
| ongaku-app(Tier2) | 1 |
| drawing-app(Tier2) | 1 |
| okane-app(Tier1) | 3 |
| mogura-tataki(Tier1) | 1 |

**信頼できる判定の合計275件(Tier1: 200件、Tier2: 75件)中61件が閾値未達(約22.2%)。**

### Contrast Gateの自動カバレッジ低下(Tier2固有の傾向)

Tier1は信頼できる判定200件/総チェック216件(約92.6%)だったのに対し、Tier2は信頼できる判定75件/総チェック293件(約25.6%)と大幅に低下した。原因はTier2の10アプリがページ全体にlinear-gradient背景を採用しているため(`tier2-contrast-results.md`参照)。**Tier3監査でも同様の傾向が出る場合、Manual Review工数の見積もりを引き上げる必要がある。**

---

## 4. Focus Trap / Focus Restoration / Spec Decision 件数まとめ

| 項目 | 件数(app単位、29アプリ中) |
|---|---|
| Focus Trap実装あり+A11yパネル例外も対応済み | 1(gaze-keyboard settingsModalのみ。Tier2は0アプリ) |
| FT-1(A11yパネル例外欠如) | 7 |
| FT-2(Focus Trap欠如) | 9(うちongaku-appは3モーダル分がより深刻) |
| Initial Focus Missing | 2 |
| Focus Restoration異常 | 1(register-app、Spec Decision Required) |
| Spec Decision Required(背景抑制方式) | 18(app固有モーダルを持つ全アプリ) |

app固有モーダルを持つ18アプリ(Tier1:12、Tier2:6)のうち、**A11yパネル例外・Focus Trap・初期focusの全てが揃って正しく実装されているのは1アプリ(gaze-keyboardのsettingsModalのみ、他のmodalは別途FT-2扱い)**。モーダルアクセシビリティは全体として未成熟な領域であることが29アプリ規模のデータで裏付けられた。

---

## 5. Manual Review backlog 統合状況

Tier1(`tier1/tier1-manual-review.md` A〜H、8カテゴリ)・Tier2(`tier2/tier2-manual-review.md` A〜I、9カテゴリ)とも**全項目未実施(Needs Manual Review)**。NVDA/VoiceOver/Blue2/Tobii等の実機検証はTier1・Tier2を通じて一度も実施されていない。

優先度が特に高いと判断される項目(29アプリ横断):

1. tyushi(Tier1、TIER1-F1の実体験確認)
2. katachi-awase-app(Tier2、TIER2-F6のNVDA/VoiceOverでのcontrol name読み上げ確認。Chromiumでは既に正常動作を確認・修正済みだが、他AT実装での差異有無を最終確認する位置づけ)
3. ongaku-app(Tier2、modal-pin/export/shareのARIA機構欠如の実体験確認)
4. gradient背景を持つContrast自動判定不能アプリ群(Tier1: janken-app・tokei-app・mogura-tataki・okane-app・scratch-app、Tier2: 10アプリ)

---

## 6. Fix Backlog優先順位(統合版、目安)

1. **即時横展開可能(正解確立済み)**: TIER2-F6(✅修正済み、RC commit e32c45e)→TIER1-F1/TIER2-F3/TIER1-F2/TIER2-F1(いずれも確立済みパターンの横展開)
2. **構造判断を要する**: TIER1-F3/TIER2-F2(Focus Trap新規実装、特にongaku-appの3モーダルはコスト大)、TIER2-F5(Reflow)
3. **デザインシステムレベルの検討**: TIER1-F4/TIER2-F4(Contrast、デザイントークン再設計)
4. **Spec Decision確定が前提**: TIER1-F5(Focus Restoration正式要件)、TIER1-F6(背景抑制方式統一)

---

## 7. Tier3(残り6アプリ)へ向けて

- Tier1・Tier2で確立した自動化手法(static-audit.js・browser-audit.py・contrast-check.py・runtime-audit.py)はいずれもTier3へそのまま横展開可能
- FT-1/FT-2/Initial Focus Missing/Broken ARIA Referenceの4パターンは、grep+目視確認の組み合わせで効率的に検出できることが29アプリのデータで実証された
- gradient背景によるContrast自動判定カバレッジ低下がTier3でも起こりうる前提でManual Review工数を見積もる
- 29アプリを通じてP0は0件。Tier2で初めてP1が検出され(当初2件)、実機Evidenceによる再評価を経て現存P1は1件(TIER2-F3)。**「Tier3は残り6アプリで規模が小さいから軽微」という前提は置かず、Tier1/Tier2と同水準の精査(broken reference等はimpactを実機確認するところまで含む)を行うことを推奨**

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | WCAG-JIS-AUDIT-1-TIER2完了時点でのTier1+Tier2累積集計を初回作成。 |
