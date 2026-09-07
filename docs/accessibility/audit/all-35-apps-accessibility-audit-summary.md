# WCAG-JIS-AUDIT-1: 全35アプリ累積サマリー

- 対象: Tier1(12) + Tier2(17) + Tier3(6) = **35アプリ(全アプリ)**
- 個別Tier成果物: `tier1/`・`tier2/`・`tier3/`配下、および`tier1-tier2-cumulative-summary.md`
- 本ファイルは既存成果物の集計結果を横断集計したものであり、新たなFindingは含まない。

---

## 1. Audited Apps

| Tier | アプリ数 | 対象 |
|---|---|---|
| Tier1 | 12 | register-app・matching-app・time-timer・mogura-tataki・okane-app・scratch-app・nazorin-print・schedule-app・janken-app・tokei-app・tyushi・gaze-keyboard |
| Tier2 | 17 | hiragana-learn・katakana-app・shiritori2・bosai-app・cup_game・ongaku-app・kimochi-board・drawing-app・directions-app・suji-manabou・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app |
| Tier3 | 6 | nazori-app・timetable-app・yomikaki-app・sugoroku-app・sst-app・slideshow-sakusei |
| **合計** | **35** | 全アプリ |

---

## 2. Finding Family別 集計(35アプリ)

| Finding Family | Tier1 | Tier2 | Tier3 | 累計app数 | 状態 |
|---|---|---|---|---|---|
| Heading Runtime Visibility | 1(tyushi) | 0 | 0 | 1 | ✅ Closed(AUDIT-35-H1-IMPL-2-RELEASEで修正済み) |
| FT-1(A11yパネル例外欠如) | 4 | 3 | 0(N/A、モーダルなし) | 7 | Open(未着手) |
| FT-2(Focus Trap欠如) | 5 | 4 | 0(N/A) | 9 | Open(未着手。ongaku-appの3モーダルはrole="dialog"付与も必要) |
| Initial Focus Missing | 0 | 2(cup_game・ongaku-app) | 0(N/A) | 2 | **PARTIALLY RESOLVED**(cup_game✅解消/ongaku-app Open) |
| Contrast | 8 | 5 | 4 | 17(app単位、重複なし集計) | Open(未着手。katachi-awase-appの1件はTIER2-F6として別Family扱い) |
| Focus Restoration | 1(register-app) | 0 | 0(N/A) | 1 | Open(Spec Decision Required) |
| Reflow Overflow | 0 | 1(drawing-app) | 1(slideshow-sakusei) | 2 | Open(両件ともSpec Decision的側面あり) |
| Broken ARIA Reference | 0 | 1(katachi-awase-app) | 0 | 1 | ✅ **TECHNICALLY RESOLVED**(P1→P2訂正後、commit e32c45e) |
| Heading Hierarchy Skip(新規) | 0 | 0 | 1(yomikaki-app) | 1 | Open(未着手) |
| Spec Decision Required(背景抑制方式) | 12 | 6 | 0(N/A) | 18(app固有モーダルを持つアプリ) | Open(方針決定待ち) |

---

## 3. Severity(P0〜P3)累計

| Severity | Tier1 | Tier2 | Tier3 | 累計 |
|---|---|---|---|---|
| P0 Critical | 0 | 0 | 0 | **0** |
| P1 High | 0 | 1(TIER2-F3、cup_game分解消・ongaku-app分Open) | 0 | **1** |
| P2 Medium | 5(Finding単位) | 4(TIER2-F1,F2,F5,F6[解消済み]) | 1(TIER3-F2) | **10** |
| P3 Low | Contrastの一部 | 1(TIER2-F4、15件) | 2(TIER3-F1,F3、16件) | Contrast系はいずれもTier分類基準で個別評価 |

**AUDIT PILOT BLOCKING FINDING相当(P0操作不能)は35アプリ通じて0件。**

---

## 4. Open / Partially Resolved / Technically Resolved 整理

| 状態 | Finding |
|---|---|
| ✅ Closed(Production反映済み、実害の再発なし) | TIER1-F1(tyushi heading、AUDIT-35-H1-IMPL-2-RELEASE) |
| ✅ Technically Resolved(Production反映済み) | TIER2-F6(katachi-awase-app broken ARIA、commit e32c45e。Severity P1→P2訂正済み。NVDA/VoiceOver Manual Validation Pending) |
| 🟡 Partially Resolved | TIER2-F3(Initial Focus Missing。cup_game分はTechnically Resolved[commit a53f307]、ongaku-app分はOpen。Finding全体としてP1を維持) |
| 🔴 Open(未着手) | TIER1-F2(FT-1)・TIER1-F3(FT-2)・TIER1-F4(Contrast)・TIER1-F5(Focus Restoration)・TIER1-F6(Spec Decision)・TIER2-F1(FT-1)・TIER2-F2(FT-2)・TIER2-F4(Contrast)・TIER2-F5(Reflow)・TIER3-F1(Heading Hierarchy Skip)・TIER3-F2(Reflow+Spec Decision)・TIER3-F3(Contrast) |

**35アプリ中、Production反映済みFixは2件(TIER1-F1、TIER2-F6)、部分反映1件(TIER2-F3)。残る10件のFinding(Family単位)は未着手。**

---

## 5. Contrast Gateホットスポット(35アプリ横断)

| app | 信頼できるfail件数 | Tier |
|---|---|---|
| schedule-app | 13 | 1 |
| register-app | 9 | 1 |
| kimochi-board | 9 | 2 |
| yomikaki-app | 8 | 3 |
| matching-app | 8 | 1 |
| nazorin-print | 6 | 1 |
| time-timer | 4 | 1 |
| sst-app | 4 | 3 |
| timetable-app | 3 | 3 |
| okane-app | 3 | 1 |
| katachi-awase-app | 2 | 2 |
| gaze-keyboard | 2 | 1 |
| cup_game | 2 | 2 |
| ongaku-app | 1 | 2 |
| drawing-app | 1 | 2 |
| slideshow-sakusei | 1 | 3 |
| mogura-tataki | 1 | 1 |

**信頼できる判定の合計350件(Tier1:200、Tier2:75、Tier3:75)中77件が閾値未達(約22.0%)。**

Needs Manual Review合計: Tier1 16件・Tier2 217件・Tier3 40件 = **273件**。ページ全体gradient背景を採用するアプリ(Tier2で10アプリ、Tier3でsugoroku-app)は自動判定カバレッジがほぼ0%であり、Manual Review依存度が特に高い。

---

## 6. Focus Trap / Initial Focus / Focus Restoration / Spec Decision 件数まとめ

| 項目 | 件数(app単位、35アプリ中) |
|---|---|
| app固有モーダルを持つアプリ | 18(Tier1:12、Tier2:6、Tier3:0) |
| Focus Trap実装あり+A11yパネル例外も対応済み | 1(gaze-keyboard settingsModalのみ) |
| FT-1(A11yパネル例外欠如) | 7 |
| FT-2(Focus Trap欠如) | 9(うちongaku-appは3モーダル分role="dialog"自体も必要) |
| Initial Focus Missing | 2(1件は部分解消) |
| Focus Restoration異常 | 1(register-app、Spec Decision Required) |
| Broken ARIA Reference | 1(解消済み) |
| Reflow Overflow | 2 |
| Heading Hierarchy Skip | 1 |
| Spec Decision Required(背景抑制方式) | 18(app固有モーダルを持つ全アプリ) |

**Tier3は0/6アプリがapp固有モーダルを持たないため、モーダル関連5Family(FT-1・FT-2・Focus Restoration・背景抑制・Initial Focus)はTier3では新規発生なし。**

---

## 7. Manual Review backlog 統合状況

Tier1(8カテゴリ)・Tier2(9カテゴリ)・Tier3(9カテゴリ、うち1つ該当アプリなし)とも**全項目未実施(Needs Manual Review)**。NVDA/VoiceOver/Blue2/Tobii等の実機検証は35アプリを通じて一度も実施されていない。

優先度が特に高いと判断される項目(35アプリ横断):

1. tyushi(Tier1、TIER1-F1の実体験確認。既に修正済みだが体感未確認)
2. katachi-awase-app(Tier2、TIER2-F6の他AT実装差異確認。Chromiumでは正常動作確認済み)
3. yomikaki-app(Tier3、TIER3-F1の見出しナビゲーション体験確認)
4. ongaku-app(Tier2、modal-pin/export/shareのARIA機構欠如の実体験確認)
5. gradient背景を持つContrast自動判定不能アプリ群(Tier1: 5アプリ、Tier2: 10アプリ、Tier3: sugoroku-app)

---

## 8. Fix Backlog優先順位(35アプリ統合版、目安)

詳細は`all-35-apps-accessibility-fix-backlog.md`参照。

1. **即時横展開可能・低リスク**: TIER3-F1(数分)、TIER1-F2/TIER2-F1(FT-1横展開)、既存PILOT-F1パターンの残りInitial Focus対応
2. **構造判断を要する**: TIER1-F3/TIER2-F2(Focus Trap新規実装)、TIER2-F5/TIER3-F2(Reflow、min-width要否判断が先行)
3. **デザインシステムレベル**: TIER1-F4/TIER2-F4/TIER3-F3(Contrast、デザイントークン再設計)
4. **Spec Decision確定が前提**: TIER1-F5(Focus Restoration正式要件)、TIER1-F6(背景抑制方式統一)、TIER3-F2(モバイル対応方針)

---

## 9. 35-App Audit Completion Gate 判定

| # | 条件 | 状態 |
|---|---|---|
| 1 | Tier1(12) | ✅ |
| 2 | Tier2(17) | ✅ |
| 3 | Tier3(6) | ✅ |
| 4 | Static heading | ✅ 35/35 |
| 5 | Runtime heading | ✅ 35/35 |
| 6 | Structure(全35) | ✅ |
| 7 | Browser(全35) | ✅ |
| 8 | Keyboard(自動/代表確認) | ✅(自動範囲) |
| 9 | Modal横断 | ✅(18アプリで該当、17アプリはN/A) |
| 10 | Contrast(全35) | ✅ |
| 11 | Touch | △(自動宣言確認のみ、target size再測定は未実施) |
| 12 | Switch | △(静的存在確認のみ) |
| 13 | Gaze | △(宣言確認のみ) |
| 14 | Record | △(role/構造確認のみ) |
| 15 | Learning Feedback | △(aria-live確認のみ、体感はManual) |
| 16 | Finding Register統合 | ✅ |
| 17 | Severity統合 | ✅ |
| 18 | Manual backlog統合 | ✅ |
| 19 | Fix backlog統合 | ✅ |
| 20 | 35-app cumulative summary完成 | ✅(本ファイル) |

20項目中15項目完全PASS、5項目(#11-15)は「自動化できる範囲は完了、深い動的検証・実機体感はManual Review送り」という設計通りの部分完了。

**WCAG-JIS-AUDIT-1 = 35-APP AUTOMATED/CODE-BASED AUDIT COMPLETE / READY FOR GLOBAL FIX TRIAGE**

> **重要**: このステータスは「35アプリの自動監査・コードレベル確認・Finding分類・Manual Review backlogの確定が完了した」ことを意味する。**NVDA/VoiceOver/Blue2/Tobii等を含む全Manual Accessibility Reviewが完了したことは意味しない。** Manual Review backlogは35アプリ通じて実質的に未着手のまま残っている。

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | WCAG-JIS-AUDIT-1-TIER3完了時点で35アプリ全体の累積集計を初回作成。 |
