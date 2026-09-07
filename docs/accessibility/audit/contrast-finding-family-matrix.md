# Contrast Finding Family Matrix(FAMILY-F)

TIER1-F4・TIER2-F4・TIER3-F3(合計77件の信頼できるfail)を、77件個別Fixとして扱わず、共有色トークン単位でグルーピングした分析。**本ファイルはFix方針の設計のみで、実装は行わない。**

---

## 1. 全体像

| 区分 | 件数 |
|---|---|
| 信頼できる判定(reliable checks) | 350(Tier1:200、Tier2:75、Tier3:75) |
| 閾値未達(fail) | 77(全件ratio 2.0以上、Tier分類基準でP3。ただしTIER1-F4は一部P2判定の余地あり[ratio<2.0が0件のため実質全件P3]) |
| Needs Manual Review(gradient/画像背景) | 273(Tier1:16、Tier2:217、Tier3:40) |

**77 / 350 ≈ 22.0%は「自動判定可能な部分における結果」であり、Manual Review対象273件を含めた全体の適合率と混同しない。**

---

## 2. 色ペア頻度分析(fg→bg、上位)

| fg→bg(RGB) | 件数 | 対象app数 | アプリ | 分類 |
|---|---|---|---|---|
| `rgb(90,122,153)→rgb(255,255,255)` | 8 | 1 | schedule-app | **アプリ内トークン**(1箇所修正で8件解消) |
| `rgb(255,255,255)→rgb(255,107,53)` | 6 | **3** | register-app・time-timer・sst-app | **共有デザイントークン候補**(アクセントオレンジ、Tier横断) |
| `rgb(45,125,210)→rgb(255,255,255)` | 6 | 1 | yomikaki-app | アプリ内トークン(1箇所修正で6件解消) |
| `rgb(255,255,255)→rgb(255,137,93)` | 4 | 1 | register-app | アプリ内トークン |
| `rgb(232,149,109)→rgb(255,255,255)` | 4 | 1 | matching-app | アプリ内トークン(`.game-mode-btn`系、alpha合成込み) |
| `rgb(107,125,117)→rgb(255,255,255)` | 4 | 1 | nazorin-print | アプリ内トークン |
| `rgb(255,255,255)→rgb(75,163,227)` | 3 | 1 | schedule-app | アプリ内トークン |
| `rgb(170,170,170)→rgb(255,255,255)` | 3 | 1 | kimochi-board | アプリ内トークン(アイコンボタン系) |
| `rgb(255,107,157)→rgb(255,255,255)` | 3 | 1 | kimochi-board | アプリ内トークン |
| (その他) | 33 | 各1 | 15アプリに分散 | 個別評価 |

**真に複数アプリをまたぐ共有トークンは`rgb(255,255,255)→rgb(255,107,53)`(白文字/オレンジ背景)のみ**(register-app・time-timer・sst-app、6件)。これはdonomana共通のアクセントカラー(warning/accent orange)である可能性が高く、デザインシステムのグローバルトークン定義を確認した上で1回の修正で3アプリへ横展開できる見込み。

その他の頻出ペアは全て「同一アプリ内での同一トークン繰り返し使用」であり、**アプリ単位のトークン修正で複数件が同時解消する**(例: schedule-appは1トークン修正で最大8件、matching-appは1トークン修正で最大4件)。

---

## 3. アプリ単位の集計(降順)

| app | Tier | fail件数 | 主な色トークン数(概算) |
|---|---|---|---|
| schedule-app | 1 | 13 | 3系統(90,122,153 / 75,163,227 / 154,176,197) |
| register-app | 1 | 9 | 5系統以上 |
| kimochi-board | 2 | 9 | 5系統 |
| yomikaki-app | 3 | 8 | 2系統(45,125,210が主) |
| matching-app | 1 | 8 | 4系統 |
| nazorin-print | 1 | 6 | 2系統 |
| time-timer | 1 | 4 | 2系統 |
| sst-app | 3 | 4 | 3系統 |
| timetable-app | 3 | 3 | 3系統 |
| okane-app | 1 | 3 | 3系統 |
| katachi-awase-app | 2 | 2 | 1系統 |
| gaze-keyboard | 1 | 2 | 1系統 |
| cup_game | 2 | 2 | 2系統 |
| ongaku-app | 2 | 1 | 1系統 |
| drawing-app | 2 | 1 | 1系統 |
| slideshow-sakusei | 3 | 1 | 1系統 |
| mogura-tataki | 1 | 1 | 1系統 |

**上位4アプリ(schedule-app・register-app・kimochi-board・yomikaki-app)で全77件中39件(約51%)を占める。** この4アプリのトークン修正を優先すれば、全体の半数以上が解消する計算になる。

---

## 4. 分類まとめ(§13要求項目)

| 分類 | 該当 |
|---|---|
| Common design token由来(Tier横断) | `rgb(255,255,255)→rgb(255,107,53)`(register-app・time-timer・sst-app、6件) |
| アプリ固有color(アプリ内トークン、複数箇所で再使用) | schedule-app・register-app・matching-app・nazorin-print・yomikaki-app・kimochi-board 等(上記2以外のほぼ全件) |
| Button state由来 | 未評価(本Auditはデフォルト状態のみ走査。hover/focus/selected/disabled状態は別途Manual Review対象) |
| Text/見出し | yomikaki-appのH2/H3(ブランドカラー青)が該当 |
| Border/control | kimochi-boardのアイコンボタン系(×/−/＋) |
| Gradient/image background | 本ファイル対象外(Needs Manual Review 273件側で管理、Manual Review Strategy参照) |
| Manual only | 273件(gradient/画像背景を持つ要素) |

---

## 5. Fix優先順位案

1. **Common design token(1件)**: `rgb(255,255,255)/rgb(255,107,53)`を3アプリ横断で調査・統一修正 → 6件解消
2. **上位4アプリのアプリ内トークン**: schedule-app(13件)・register-app(9件)・kimochi-board(9件)・yomikaki-app(8件) → 各アプリ1〜3トークン修正で計39件解消の見込み
3. **残り12アプリの個別対応**: 各1〜6件、既存デザイントークンの微調整または個別評価

**この優先順位により、77件全てを個別Fixとして扱うのではなく、実質7〜10回程度のトークン修正で大部分をカバーできる見込みであることが分かった。**
