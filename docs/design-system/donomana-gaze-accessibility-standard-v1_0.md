# どのまな 視線入力アクセシビリティ標準仕様書（Donomana Gaze Accessibility Standard）v1.0

- 版: v1.0（改訂4）
- 起草日: 2026-08-19／改訂: 2026-08-19（Phase M11.3-A、Decision A・B確定）／改訂: 2026-08-19（Phase M11.3-B・M11.3-C、Pilot 3教材への実装完了・default値確定・Final Consistency Audit）／改訂: 2026-08-19（Phase M11.4-A、Gaze Shared Foundation PoC成功・mitsukete-touch-app.htmlで実装）／改訂: 2026-08-19（Phase M11.4-B、Gaze Shared Foundation Pilot 3教材横展開完了・hitTestGazeTargets() SAFE TO SHARE昇格）
- 状態: **確定**（Phase M11.2起草時点で「ユーザー確認事項」としていた2論点は、Phase M11.3-Aにおけるユーザー明示決定（0章）により正式確定した。17.2章・31.1章参照）。**Phase M11.3-A（miru-hirogaru-app.html）・M11.3-B（mitsukete-touch-app.html／junban-miyou-app.html）により、Multi-Input Pilot 3教材すべてが本書のREQUIRED 8項目（6章）を実装済み（29章参照）。Tobii実機確認はみるとひろがるのみユーザー確認済み（M11.3-Aゲート）。どこかな？みーつけた！／じゅんばんにみようは自動検証のみで、Tobii実機確認は引き続き未実施（Phase M11.3-B報告47番）。**
- 起草根拠: Multi-Input Pilot 3教材（「みるとひろがる」`docs/multi-input/miru-hirogaru-design-v1.md`／「どこかな？みーつけた！」`docs/multi-input/mitsukete-touch-design-v1.md`／「じゅんばんにみよう」`docs/multi-input/junban-miyou-design-v1.md`、いずれもPhase M0〜M11で確立・Tobii等実機検証済み）を第一のSource of Truthとし、既存Production公開中の視線入力対応アプリ11本（18章）のコード横断調査、および既存承認済み仕様書（1章）との整合確認を根拠とする。
- 位置づけ: `docs/design-system/donomana-new-app-development-standard-v1_0.md`（新規アプリ開発標準 v1.2、以下「New App Standard」）13章「gaze / dwell（CONDITIONAL）」の詳細補足文書。New App Standardを置き換えるものではなく、視線入力固有の要件を詳細化する下位文書として位置づける。Design System v2.1・Switch Scan仕様書v1.8・モーダルアクセシビリティ仕様書v1.1のいずれとも矛盾しないことを26章で確認している。

> **本文書は「新しい機能を思いつくPhase」の成果物ではない。** 3教材のPilot実装とTobii実機検証で実際に確認された設計判断を、再利用可能な標準として昇格させたものである。8つのREQUIRED設定項目（6章）のうち、Pilot 3教材・既存11アプリのいずれにも実装例がない項目（ドウェル進捗表示の明示的ON/OFF・注視開始までの猶予・視線ターゲット拡大の可変設定・ターゲット間余白の可変設定）は、その旨を明記した上で、一般的な視線入力UXの知見に基づく暫定初期値を提案している。これらはPhase M11.3以降のPilot実装で実測検証されるまで「未検証」として扱う（17章・29章）。

---

## 目次

0. User Decision（Phase M11.3-Aで確定）
1. 関連文書と本書の位置づけ
2. 目的
3. 適用範囲
4. 用語
5. 基本原則
6. REQUIRED / RECOMMENDED / OPTIONAL 一覧
7. Gaze Activation Model
8. Dwell（注視選択）
9. Entry Delay（注視開始までの猶予）
10. Cooldown / 再選択防止
11. Progress Visualization（ドウェル進捗表示）
12. Target Size / Hit Area
13. Target Spacing
14. Motion / Progression Speed
15. Settings UI Standard
16. State / Persistence
17. Multi-Input Integration
18. Keyboard
19. Switch Scan
20. Touch
21. Accessibility
22. Modal / Common Chrome
23. Cleanup / Lifecycle
24. Responsive
25. Reduced Motion
26. Calibration Responsibility Boundary
27. Educational Rationale
28. Reference Implementation
29. Pilot 3教材 Compliance
30. 既存Gazeアプリ Inventory
31. Migration Guidance
32. Compliance Checklist
33. Phase M11.3-C: Cross-App Consistency Audit / Shared Candidate Findings
34. Phase M11.4-A: Gaze Shared Foundation PoC結果
35. Phase M11.4-B: Gaze Shared Foundation 横展開・hitTestGazeTargets() SAFE TO SHARE昇格

---

## 0. User Decision（Phase M11.3-Aで確定）

Phase M11.2起草時点で「ユーザー確認事項」（29章・31.1章）としていた2論点は、Phase M11.3-A冒頭でユーザーにより以下の通り明示決定された。本書全体はこの決定を前提として以降の章を記述する。

### Decision A — Gaze × Switch Scan

GazeとSwitch Scanは**相互排他にしない**。Touch / Gaze / Switch Scan / Keyboardは、教材が対応している場合、原則として併用可能とする。ただし複数入力方式による二重発火・競合は許可しない。入力方式ごとに別の教材ロジックを持たせず、common activation gate・common activation API・cooldown / duplicate suppression等によって、1つの利用者意図につき1回だけ教材イベントを発火させる設計とする。「同時ON可能」と「同時発火可能」は同義ではない（詳細は17.2章）。

### Decision B — Gaze ON/OFF

視線入力ON/OFFはREQUIREDのまま維持する。Multi-Input Pilot初期設計でGaze ON/OFFを設けなかった判断は、Pilot時点の歴史的設計として扱う。今後の正式標準としては、Gaze対応教材は利用者・支援者が視線入力を明示的に有効／無効化できることをREQUIREDとする（詳細は31.1章）。

---

## 1. 関連文書と本書の位置づけ

本書は既存仕様書を要約・複製しない。New App Standard 1章の文書地図（Design System v2.1・Dev Rules v1.0・モーダルアクセシビリティ仕様書v1.1・Switch Scan仕様書v1.8・Storage Architecture v2.0）をそのまま継承し、以下を追加する。

| 文書 | 内部版 | 状態 | 正本とする範囲 |
|---|---|---|---|
| 本文書（Gaze Accessibility Standard） | v1.0（改訂1） | **確定** | 視線入力（Gaze/Dwell）固有の設定・UI・lifecycle・Multi-Input統合要件 |
| `docs/multi-input/multi-input-program-design-v1.md` | v1.1 | 承認済み（Phase M0） | Multi-Input Program共通設計。本書8・17章の一次根拠 |
| `docs/multi-input/miru-hirogaru-design-v1.md` | v1.2 | 承認済み・Production未公開（Level3のみ） | Pilot実装1本目。dwell/re-trigger/視覚共存パターンの一次根拠 |
| `docs/multi-input/mitsukete-touch-design-v1.md` | v1.2 | 承認済み・Production公開済み | Pilot実装2本目。hit area＝隠れ場所全体、distractor gaze対応の一次根拠 |
| `docs/multi-input/junban-miyou-design-v1.md` | v1.0 | 承認済み（Production公開状況は本Phase調査範囲外） | Pilot実装3本目。Guided Attention・3層視覚共存拡張の一次根拠 |

New App Standard 13章「gaze / dwell（CONDITIONAL）」は本書と役割が重複する部分があるが、23章「実装変更について」の最小変更方針に従い、13章本文の大規模な書き換えは行わない。ただしPhase M11.3-A（0章 Decision A）により、13章が例示するkurabeyou-app.html／katachi-awase-app.htmlの「Switch Scanとの原則相互排他」という記述は、**今後の新規実装・改修の指針としては本書17.2章の記述に置き換わる**（「入力方式そのものを排他にする」から「複数入力方式は利用可能だが、単一操作に対する重複activationを防ぐ」への転換）。既存のkurabeyou-app.html／katachi-awase-app.htmlのコード自体は本Phaseでは変更しない（3章、遡及適用しない）。

---

## 2. 目的

視線入力（Gaze/Dwell）は「付けられるから付ける」機能ではない。27章で述べる通り、視線入力技術そのものを使わせることが目的ではなく、**見る・気づく・選ぶ・見届ける・原因と結果を経験する・意思を表出する・自分の方法で参加する**ことを可能にするための一手段である。

本書の目的は、今後「どのまな」で視線入力対応を名乗るすべての新規アプリが、何を実装すれば標準準拠と言えるのかを、開発者が迷わずに判断できる状態にすることである。

---

## 3. 適用範囲

- **対象**: 今後新規に視線入力対応を実装するアプリ（Multi-Input教材・既存教材への新規追加問わず）。
- **対象外（本Phaseでは適用しない）**: 既存の視線入力対応アプリ11本（30章）およびPilot 3教材への遡及適用。本Phaseは調査・標準化のみを行い、実装変更はPhase M11.3以降で個別に判断する（Migration Guidance、31章）。
- New App Standard 13章が定める「視線入力の採用可否判断（CONDITIONAL）」自体は変更しない。本書は「採用する」と決めた場合の詳細要件のみを定める。

---

## 4. 用語

| 用語 | 定義 |
|---|---|
| Dwell（ドウェル） | 視線が対象上に一定時間留まることで選択・決定とみなす操作方式 |
| Dwell Duration（ドウェル時間） | 選択が確定するまでに必要な注視の継続時間 |
| Entry Delay（注視開始までの猶予） | 視線がtarget領域に入ってから、ドウェル計測を開始するまでの猶予時間。視線の通過・involuntary gazeによる誤爆を防ぐ |
| Cooldown / 再選択防止 | activation直後、同一targetへの視線残留だけで連続再選択されないようにする仕組み。本書ではPilot 3教材が確立した「Leave-and-Reenter Gate」方式を推奨実装として扱う（10章） |
| Dwell Progress（ドウェル進捗） | 注視中の経過時間を円・リング・ゲージ等で視覚的に示す表示 |
| Gaze Target（視線ターゲット） | 視線入力による選択の対象となる要素 |
| Hit Area（判定領域） | 視線入力の当たり判定に用いる領域。視覚的なtargetサイズと同一でなくてよい（12章） |
| Leave-and-Reenter Gate | activation後、視線が一度targetの外へ出て再びtargetへ入るまで新規dwellの開始を待つ再選択防止方式（Foundation A、Multi-Input Program） |
| Activation Lock | 同一物理入力の重複検知を防ぐ短時間ロック（Gaze固有ではなく全入力方式共通の概念、Multi-Input Program 8.6章） |

---

## 5. 基本原則

1. **視線入力OFFでも教材として成立すること（MUST）**。Gaze対応教材を視線入力専用教材として設計しない。Touch/Keyboard/Switch Scanのいずれでも教材本来の活動が成立することを前提とする。
2. **誤入力の完全排除のために操作を難しくしない**。利用者が成功しやすいよう環境側（本書が定める各種調整項目）を調整できる設計を基本とする。
3. **入力方式ごとにロジックを複製しない**。Touch/Gaze/Switch/Keyboardはすべて単一のsemantic activation関数へ合流させる（7章）。
4. **何も起きない状態を作らない**。reduced-motion環境やcooldown中であっても、結果が視認できることを維持する（Multi-Input Program 19.1章の原則を継承）。
5. **診断的解釈を記録しない**。観察可能な行動（dwell時間・inputMethod等）のみを記録し、「理解している」等の評価は記録しない（Multi-Input Program 11章を継承）。

---

## 6. REQUIRED / RECOMMENDED / OPTIONAL 一覧

Phase M11.2の依頼内容（8項目）はすべてREQUIRED（視線入力対応を名乗るために必須）として仕様化するが、既存実装での検証状況には差がある。実装者が誤って「Foundation Aと同格に確立された仕様」と誤認しないよう、根拠の強さを明示する。

| # | 項目 | 分類 | 既存実装での検証状況 |
|---|---|---|---|
| 6.1 | 視線入力 ON/OFF | **REQUIRED**（Decision B、0章で正式確定） | 既存アプリ11本中9本で実装例あり（30章）。Pilot 3教材は当時の設計判断で不採用だったが、Phase M11.3-Aから順次追加する（29章・31.1章で詳述） |
| 6.2 | ドウェル時間の調整 | **REQUIRED** | 既存アプリ6本以上で実装例あり（範囲・初期値は8章）。Pilot 3教材・katachi-awase・kurabeyouは固定値900ms |
| 6.3 | ドウェル進捗表示 | **REQUIRED**（表示自体） | 表示そのものはほぼ全アプリで実装済み。**明示的なON/OFF切替**は既存実装に例がない新規要件（11章） |
| 6.4 | 再選択防止（cooldown） | **REQUIRED**（機構の存在） | Pilot 3教材のLeave-and-Reenter Gateが最も検証されたパターン（Foundation A）。数値cooldown方式も既存単体アプリに実績あり（10章） |
| 6.5 | 視覚変化・進行速度の調整 | **REQUIRED**（基礎水準） | `prefers-reduced-motion`対応は全アプリ共通で既に必須（New App Standard 15章）。app内animation ON/OFFはkurabeyou・katachi-awaseに実績あり。**連続的な速度調整UI**は新規要件（14章） |
| 6.6 | 視線ターゲット拡大 | **REQUIRED**（原則）／新規要件（可変設定） | 「視覚サイズ≠hit area」の原則自体はmitsukete-touch（hit area＝隠れ場所全体）で確立済み。**利用者が調整できるUI**は既存実装に例がない（12章） |
| 6.7 | ターゲット間余白調整 | **REQUIRED**（原則）／新規要件（可変設定） | 余白設計自体はPilot 3教材で緻密に実測・調整されている（miru-hirogaru/mitsukete-touch実測値、13章）。**利用者が調整できるUI**は既存実装に例がない |
| 6.8 | 注視開始までの猶予（entry delay） | **REQUIRED** | 既存実装・Pilot 3教材のいずれにも実装例がない、本書で完全に新規化する要件（9章） |

---

## 7. Gaze Activation Model

Gazeは他の入力方式（Touch/Switch/Keyboard）と対等な入力経路として、単一のsemantic activation関数へ合流させる。

```js
activateXxx(targetId, inputMethod)   // 例: activateTarget / activateItem / activatePassenger
```

重要なのは関数名の統一（`activateTarget`に固定する等）ではなく、**入力方法と教材ロジックを分離すること**である（Multi-Input Program 7章）。Pilot 3教材でも`activateTarget`→`activateItem`（みつけてタッチ、role分岐が必要なため一般化）→`activatePassenger`（じゅんばんにみよう、教材固有の意味を持たせるため）と、教材ごとに適切な名称へ意図的に変えている。

Gazeが到達するのは、この関数へ`inputMethod:'gaze'`を渡す1つの経路のみとする。Gaze専用の判定分岐・Gaze専用のfeedback処理を教材ロジック内に複製しない。

---

## 8. Dwell（注視選択）

### 8.1 初期値

**900ms** をdefault dwell durationとする。

**根拠**: Multi-Input Program 8.1章でPilot開始時に確定し、miru-hirogaru・mitsukete-touch・junban-miyouの3教材すべてで一貫して採用され、Tobii実機検証（miru-hirogaru Phase M2.1・全教材のUser Production Approval）を経た値である。katachi-awase-app・kurabeyou-app（`DWELL_MS = 900`）でも独立に同一値が採用されており、Multi-Input Program以前から実績のある値でもある。

### 8.2 調整可能範囲

**REQUIRED**: 300ms〜3000msの範囲で調整できること。100ms刻みを推奨する。

**根拠**: gaze-keyboard（300〜3000ms）・okane-app／kyou-no-kiroku（300〜3000ms、+/-ステッパー方式）で共通して採用されている範囲。tyushi（200〜4000ms）・cup_game（500〜5000ms）はこれよりやや広いが、300〜3000msは複数アプリで実績のある共通範囲として採用する。アプリ固有の理由がある場合、この範囲を拡張してよい（10章の「標準default＋教材特性によるoverride」の考え方）。

### 8.3 Dwell Engineの実装要件

- **requestAnimationFrame駆動を必須とする**（New App Standard 13章より継承）。`mousemove`等のイベント発火のみに依存せず、真に静止した注視でもdwellが完了する設計とする。参照実装: kurabeyou-app.htmlの`gazeTick()`。
- **Jitter許容**: target bounding box内での数px単位の視線の揺れでdwellを即座にリセットしない（Multi-Input Program 13.2章）。
- **Transition Guard**: targetがAからBへ切り替わった場合、Bは常に新規のフルドウェル期間を必要とする。AでのdwellをBへ持ち越さない（Multi-Input Program 13.3章、New App Standard 13章のstale dwell防止と同一）。

---

## 9. Entry Delay（注視開始までの猶予）

### 9.1 定義

視線がtarget領域に入った瞬間からdwell計測を開始するのではなく、必要に応じて短い猶予時間を設けられること。視線探索中の通過・involuntary gaze・target間移動による誤作動を減らす目的。

### 9.2 検証状況（重要）

**既存アプリ・Pilot 3教材のいずれにも実装例が確認できなかった。** 本書がこのPhaseで完全に新規化する唯一の項目である。以下の初期値は一般的な視線入力UXの知見に基づく暫定提案であり、Phase M11.3以降のPilot実装での実測検証を必須とする。

### 9.3 暫定初期値・要件

- **REQUIRED**: entry delayを設定できる機構自体を持つこと。
- **default値は0ms（無効）とする**。これは既存Pilot 3教材・既存11アプリの現行挙動（視線がtargetに入った瞬間からdwell開始）をそのまま保つためであり、既存実装へ後方互換な形で追加できる（31章 Migration Guidance）。
- 調整可能範囲は0〜500msを暫定推奨とする。150ms前後を検証時の初期試行値として推奨するが、確定値ではない。
- entry delay中はdwell progress（11章）を表示しない、または視線がtargetに入ったことを示す控えめな予備表示に留める（実装詳細はPhase M11.3で確定する）。

---

## 10. Cooldown / 再選択防止

### 10.1 目的

一度選択した直後、同じ対象を視線が残留したことだけで再選択しない仕組み。目的は「見る意思」ではなく視線残留による連続発火を防ぐことである（14章の依頼文をそのまま踏襲）。

### 10.2 REQUIRED: 2つの実装方式を認める

本書は単一の実装方式を強制しない。以下いずれかの機構を持つことをREQUIREDとする。

**方式A: Leave-and-Reenter Gate（RECOMMENDED・Foundation A）**

activation→feedback→視線がtargetを離れる→再度targetに入る→新規dwell開始、という方式。Multi-Input Program 3教材すべてで一貫して採用され（`gazeAwaitingLeaveId`、`resetDwellState()`という命名まで3教材で一致）、Tobii実機検証済みの最も確立されたパターンである。

「繰り返し可能」（Level1の反復activation等）と矛盾しない。「繰り返し可能」は"何度でも再activationできる"という意味であり、"見続けるだけで無限に自動発火する"という意味ではない。視線を一度外して戻す、というひと呼吸の動作で意図的な反復と偶発的な凝視を区別する（miru-hirogaru-design-v1.md 13.4章）。

新規アプリではこちらを第一候補として推奨する。

**方式B: 数値Cooldownタイマー**

activation後、一定時間（例: feedback durationと同一の900ms、miru-hirogaru 4.4章）は新たなactivationを受け付けない方式。単一targetが画面上に留まり続け「targetから視線を外す」という動作が教材の構造上自然でない場合（例: 単一の光るボタンを注視し続けるtyushi「ひかるボタン」型の教材）に適用する。

### 10.3 Activation Lockとの違い

Cooldownは「feedback表示中の意図的な連続操作」を防ぐ機構であり、Activation Lock（300ms、Multi-Input Program 8章）は「同一瞬間に複数の入力方式が同時到達した場合の重複防止」を担う、役割の異なる機構である。両者を混同しない。

---

## 11. Progress Visualization（ドウェル進捗表示）

### 11.1 表示自体（REQUIRED）

注視中は、円・リング・ゲージ等によって進行状況を視覚的に示すこと。無音・無表示のまま待たせない（Multi-Input Program 8.1章「重度児にとって『何が起きているか分からない待機』は離脱要因になりうる」）。

参照実装: radial progress（円形進行リング、conic-gradient方式）。miru-hirogaru・mitsukete-touch・junban-miyou・katachi-awase-app・kurabeyou-app・kimochi-board・kyou-no-kiroku等、大多数の既存実装で共通して採用されているパターンであり、本書はこれを標準visual patternとして正式に推奨する。

### 11.2 ON/OFF切替（REQUIRED・新規要件）

刺激を減らしたい利用者向けに、進捗表示自体を非表示にできること。**既存実装に例がない新規要件。** 非表示時もdwellの計測・activationは通常通り機能すること（進捗表示のON/OFFはあくまで視覚的演出の選択であり、dwellロジック自体を変更しない）。

### 11.3 要件

- targetとの対応が視覚的に明確であること。
- ちらつかないこと。
- targetの視認を妨げすぎないこと。
- screen readerに不要な読み上げを大量発生させないこと（進捗リング自体は`aria-hidden="true"`とし、視覚専用要素として扱う。参照実装: mogura-tataki.htmlの`.dwell-ring`が`aria-hidden`を明示的に設定）。
- pointer-eventsを妨げないこと（進捗リングは`pointer-events:none`とする）。
- Gaze OFF時は表示されないこと（23章のcleanup要件と対応）。
- targetから視線が離れたらリセットすること。
- target切替時は前targetの進捗表示をリセットすること（Transition Guard、8.3章と対応）。

---

## 12. Target Size / Hit Area

### 12.1 基礎サイズ

視線ターゲットの視覚サイズは、New App Standard 10章の操作target基準（44px以上、学習アプリの新規実装では60px、子ども向け画面では88pxを優先）を最低ラインとする。Multi-Input Program 3教材の実測値（Level別に90〜230px、11.2章／17.2章参照）も参考にする。

### 12.2 視覚サイズとhit areaの分離（原則・確立済み）

**視覚的サイズと入力判定領域を必ずしも同一にしない設計を許容する。** この原則自体はmitsukete-touch-app.htmlで確立済みである——hide spot（隠れ場所である雲）は常に判定領域全体とし、その中に一部だけ見えるキャラクター（Level3では見える面積がさらに小さくなる）に判定領域を限定しない。これは「見えている部分だけを精密にタップ・注視する」ことを要求すると、手指操作や視線制御が難しい対象児童にとって不利になるためである（mitsukete-touch-design-v1.md 11.1章・11.2章）。

### 12.3 利用者による拡大設定（REQUIRED・新規要件）

**既存実装に拡大設定UIの例はない。** 以下を暫定要件とする。

- hit areaは視覚サイズの100%（現行同等）を初期値とし、利用者が最大150〜200%程度まで拡大できる設定を持つこと。
- 拡大しても視覚的なtargetサイズ自体は変更しない（Phase26以来の「hit areaは縮小・変化させない、視覚サイズとは独立して拡張してよい」という原則を踏襲。Program設計書はhit area拡張の方向のみを想定しており、縮小は行わない）。
- 拡大したhit area同士が重なる場合の挙動（どちらのtargetが優先されるか）は、13章のtarget spacingと合わせてアプリごとに明示的に検証すること。

---

## 13. Target Spacing

### 13.1 原則（確立済み）

隣接targetへの誤選択を軽減するため、target間距離・layout gap・gaze hit regionを設計時に考慮する。この原則自体はPilot 3教材で緻密に検証・調整済みである。

- miru-hirogaru: Level2左右配置は「Gaze hit testの誤認識（隣接targetへの意図しないdwell移行）を避けやすい」という理由で採用（miru-hirogaru-design-v1.md 5.1章）。
- mitsukete-touch: 375〜390px幅での水平overflowが実測で発覚し、position percentageを複数回（24%/76%→27%/73%等）実測調整している（mitsukete-touch-design-v1.md 23章）。gaze dwell ring（`.mt-ring`、inset:-8px）の外側張り出しも含めた実測をProduction公開直前に行っている。

### 13.2 利用者による余白調整（REQUIRED・新規要件）

**既存実装に利用者向けの余白調整UIの例はない。** 連続的なスライダーではなく、シンプルな2〜3段階設定（例:「ふつう」「ひろめ」）を暫定推奨とする。理由: target spacingはCSSレイアウトの再計算を伴うため、連続値よりも段階的なプリセットの方が実装・Rendered Validationの両面で現実的である。具体的な段階数・倍率はPhase M11.3のPilot実装で確定する。

---

## 14. Motion / Progression Speed

### 14.1 基礎水準（REQUIRED、既存基盤で充足）

以下2点は、視線入力固有の新規実装を伴わずに満たされる基礎水準として扱う。

1. **`prefers-reduced-motion`対応**: New App Standard 15章によりgenerate.jsが全アプリへ自動注入する共通機構。全アプリ共通で既にREQUIRED。
2. **app内animation ON/OFF**: kurabeyou-app.html／katachi-awase-app.htmlの`animationEnabled`のようなアプリ内トグル。OSレベル設定と独立したレイヤーとして、両方をコード側で確認する（New App Standard 15章）。

### 14.2 連続的な速度調整（RECOMMENDED、新規要件）

「はやい／ふつう／ゆっくり」等の連続的・多段階的な速度調整UIは、既存実装に例がない。基礎水準（14.1）で「急速な画面遷移を避けられる」という目的の大部分は満たされるため、本書では連続速度調整をREQUIREDまで格上げせず、RECOMMENDEDとする（6章の一覧とも整合）。

### 14.3 具体的な速度の目安

Multi-Input Programの実測知見（22.2章 Foundation B）: **「速い＝快適」を適用しない。** junban-miyouのDeparture演出（約5.5秒、reduced motion時は約400msへ短縮）は、一般的なWeb UIなら「遅すぎる」と判断されうる時間だが、「子どもが完成状態を見届けられること」自体を目的として意図的に設計されている。気づく・見る・反応する・追視する・見届けるための時間は、短縮対象ではなくアクセシビリティ要件として扱う。速度調整UIを実装する場合も、この原則を損なわないこと。

---

## 15. Settings UI Standard

### 15.1 設定入口

New App Standard 7章「設定入口一本化」をそのまま継承する。Gaze専用の独自設定ボタンを追加しない。既存の共通A11yパネル（`donomanaA11yBtn`）→ SETTINGS_PROXY経由でアプリ固有設定へ到達する既存導線に統合する。

### 15.2 推奨する情報構造

Phase brief（依頼文）が提示した4グループ案を、既存実装調査の結果を踏まえて採用する。既存実装（kimochi-board・gaze-keyboard・cup_game等）はいずれも「視線入力」セクション配下にON/OFFとdwell関連設定をまとめて配置しており、この構造と矛盾しない。

| グループ | 含む設定 | 表示順 |
|---|---|---|
| A. 視線入力 | 視線入力 ON/OFF | 1 |
| B. 選択 | ドウェル時間、注視開始までの猶予、再選択防止（方式B採用時のみ数値表示） | 2 |
| C. 見やすさ・操作しやすさ | ドウェル進捗表示 ON/OFF、視線ターゲット拡大、ターゲット間余白 | 3 |
| D. 動き | 視覚変化・進行速度（RECOMMENDED実装時のみ） | 4 |

グループAが常に先頭である理由: 視線入力 OFF時はB・Cの設定が無意味になるため。既存実装（cup_game）は視線入力OFF時にdwell関連の設定行を`dimmed`クラスで視覚的に無効化する方式を採用しており、これを参照パターンとして推奨する。

### 15.3 設定名称（表示名 / technical term分離）

一般利用者向け表示名称に専門語をそのまま露出しない。以下を正式な対応表とする。

| technical term | 表示名称（例） |
|---|---|
| Gaze ON/OFF | 視線入力 |
| Dwell Duration | 見つめて決めるまでの時間 / みつめる時間 / 注視じかん |
| Entry Delay | （新規、名称はPhase M11.3で確定。暫定案: 「見はじめの待ち時間」） |
| Cooldown | 再入力までの間 / 決定後の待ち時間 |
| Dwell Progress | 見つめている印 |
| Target Scale (hit area) | 見やすさ・押しやすさの範囲 |
| Target Spacing | ボタンの間隔 |
| Motion Speed | 動きの速さ |

**根拠**: 既存アプリ間で表記が「みつめるじかん」「注視じかん（ドウェルタイム）」「注視時間」等にばらついていることを確認した（tyushi・cup_game・kyou-no-kiroku・gaze-keyboard比較）。本書は表示名を1つに強制するのではなく、technical termとの対応関係を明示することで、今後の新規アプリが独自の言い回しを増やさないための基準を示す。

### 15.4 実装要件（既存共通A11yパネルと同水準）

- keyboard操作: Tab到達可能、Enter/Spaceで操作可能。
- Switch Scan操作: 設定UI自体もSwitch Scanの候補に含める（19章）。
- screen reader: 各設定項目に`aria-label`／`aria-labelledby`を持つ（参照: kurabeyou-app.htmlの`aria-labelledby="dwellRangeLabel"`パターン）。
- focus: visible focus indicatorを維持する（Design System `--dm-focus-*`トークン使用）。
- modal accessibility: 設定パネルがモーダルとして実装される場合、モーダルアクセシビリティ仕様書v1.1に従う。

---

## 16. State / Persistence

### 16.1 保存対象

以下をcanonical settingsとして保存対象とする。

```
gazeEnabled
dwellDuration
dwellProgressVisible
cooldownMode          // 'leave-reenter' | 'timer'
cooldownDurationMs     // cooldownMode==='timer'の場合のみ意味を持つ
gazeTargetScale        // hit area拡大率、100=等倍
targetSpacingLevel      // 'normal' | 'wide' 等の段階値
gazeEntryDelayMs
motionSpeedLevel        // RECOMMENDED実装時のみ
```

### 16.2 保存基盤との整合

`donomana-storage-architecture-v2_0.md`に従い、アプリごとの既存単一設定オブジェクト（localStorageの単一キーに集約されたsettings object）へGaze関連フィールドを追加する。**アプリごとに新規のlocalStorageキーを乱立させない。** 既存実装（kimochi-board・katachi-awase-app・kurabeyou-app等）はいずれも単一のsettingsオブジェクトへ`gazeEnabled`等をマージする方式を採用しており、この慣行を継続する。

### 16.3 Transient State（保存しない）

dwell進捗（0-1の割合）、現在dwell中のtargetId、dwell開始時刻、scanIndex等はtransient stateとして扱い、保存しない（Multi-Input Program 7.4章のCanonical/Transient分離原則をそのまま継承）。

---

## 17. Multi-Input Integration

### 17.1 1 physical input = 1 semantic activation

Touch中にGaze dwellが完了する等の競合ケースには、activation発生時に短いactivation lock（300ms、Foundation A）を設け、この間は他の入力方式からのactivationも無視する（Multi-Input Program 8.6章）。

### 17.2 Gaze × Switch Scanの同時ON（Decision A、Phase M11.3-Aで正式確定）

**GazeとSwitch Scanは相互排他にしない。** Touch / Gaze / Switch Scan / Keyboardは、教材が対応している場合、原則として併用可能とする。これはPhase M11.2時点では「Multi-Input PilotとNew App Standard 13章のどちらが正か」という未確定論点だったが、Phase M11.3-A冒頭でユーザーが明示決定した（0章 Decision A）ことにより、**「入力方式は同時ONを許容するが、単一の利用者意図につき教材イベントは1回だけ発火させる」という方針をREQUIREDとして正式確定する。**

**根拠**: Multi-Input Pilot 3教材（miru-hirogaru/mitsukete-touch/junban-miyou）は、Touch/Gaze/Switchを排他的モード選択にせず、すべて同時に有効な状態を標準として実装している（Multi-Input Program 8.5章）。両者が同一target上で同時に視覚表示されうるため、Phase M2.1で「target本体（内側）→ gaze dwell進行リング（中間）→ Switch Scanハイライト（外側、明確な間隔）」という3層同心円配置パターンを確立し、色だけでなく形状（gaze=進行に応じた塗りつぶし弧、switch=破線アウトライン）でも区別できるようにしている（外側offsetは実測により14〜16pxへ収束、miru-hirogaru/junban-miyou双方で採用）。実機での二重activationストレステストもPASSしている（Multi-Input Program 22.1章）。

New App Standard 13章が根拠として挙げるkurabeyou-app.html／katachi-awase-app.htmlの「Switch Scan ON時に`gazeEnabled = false`を強制する」実装は、この決定により**今後の新規実装の模範パターンではなくなる**。ただし両アプリの既存コードは本Phaseでは変更しない（遡及適用しない、3章）。

### 17.2.1 「同時ON可能」と「同時発火可能」は同義ではない（重要）

Decision Aは**入力方式の同時有効化（enabled state）**を許可するものであり、**同一の利用者意図に対する複数回の教材イベント発火（activation）**を許可するものではない。この2つを混同しない。

- **Simultaneous Enabled State**: GazeとSwitch Scanが同時にON（`gazeEnabled === true && switchScanEnabled === true`）である状態そのものは常に許容する。
- **Simultaneous Activation**: 1つのtargetに対し、Gaze dwellの完了とSwitch Scanのactivationが極めて近いタイミングで両方発生した場合でも、教材ロジック（semantic activation）が実行されるのは1回のみとする。

これを保証するため、以下をREQUIREDとする。

1. **Common Activation Gate**: すべての入力方式（Touch/Gaze/Switch/Keyboard）のactivationは、単一のsemantic activation関数（7章）へ合流させる。入力方式ごとに別の教材ロジックを持たせない。
2. **Common Activation API**: 上記関数の引数は`(targetId, inputMethod)`の形を基本とする。`inputMethod`は観察記録（10章）にのみ用い、教材の分岐条件には使わない（原則11「Physical diversity, semantic unity」）。
3. **Cooldown / Duplicate Suppression**: Activation Lock（300ms、17.1章）とtarget単位のcooldown/leave-reenter gate（10章）を、入力方式を問わず共通に適用する。Gaze dwellの完了時点・Switch Scanのactivation時点のどちらであっても、同一targetが既にactivation直後のロック・cooldown状態であれば新規activationを無視する。

### 17.2.2 実装方針（相互排他 → 重複防止への転換）

既存の`gazeEnabled=false`強制方式のような「一方をONにすると他方を強制OFFにする」実装は、新規実装では採用しない。代わりに、両方を独立してON/OFFできる状態を維持したまま、17.2.1の共通Gateで重複発火のみを防ぐ。

新規に単体アプリとしてGazeとSwitch Scanを実装する場合も、この方針（同時ON許容＋共通Gateによる重複防止）をREQUIREDとする。既存の相互排他実装（kurabeyou-app.html／katachi-awase-app.html）は、Phase M11.3-Aでは変更しないが、将来の改修時にはこの方針への移行を検討する（31章）。

### 17.3 視覚的共存パターンの再利用可能な仕様

- 半径方向の重なり順: target本体 → gaze dwell リング → Switch Scan ハイライト（内側から外側）。
- 形状差: gazeは進行に応じた塗りつぶし弧（conic-gradient等）、Switch Scanは破線アウトライン。
- 外側offsetの目安: gazeリング外縁からSwitch Scanアウトライン内縁まで最低4〜6px、実装値としては14〜16pxが3教材で収束した値。
- この間隔はtarget size・入力方式が同じ限り、他のGaze対応教材でも再利用できる（Multi-Input Program 8.2.1章）。

---

## 18. Keyboard

Tab / Enter / Spaceでactivateする。開発・検証・支援者操作・アクセシビリティ入力として維持するが、対象児童の主入力としては想定しない（Multi-Input Program 8.4章を継承）。GazeとKeyboardは同一のsemantic activation関数（7章）へ合流させ、Keyboard専用の判定ロジックを複製しない。

---

## 19. Switch Scan

- 視線入力とSwitch Scanの候補抽出方式（`getGazeTargets()`／`buildScanItems()`）は、いずれもcommon chromeを含めない・含めるかを個別に明示決定する（Switch Scan仕様書v1.8 §19.22.11、22章参照）。
- Switch Scan仕様書v1.8 11章は視線入力を明示的に「対象外・Version2で対応予定」としている。本書はその「Version2」に相当する内容を提供するが、Switch Scan仕様書自体の改訂は本Phaseでは行わない（22章）。
- distractorを持つ教材（mitsukete-touch等）では、Gaze・Switch Scanの双方でdistractorも候補に含める（Input Equityの原則、Switch利用者だけがtargetしか選べない構造にしない）。

---

## 20. Touch

Touchとの関係で確認すべき最低要件（Multi-Input Program 8.3章より）。

- tap即activation。touchstart時点での軽いpreview feedbackを推奨する。
- 大きなhit area、44px以上（12.1章）。
- 誤操作許容: touchstart座標からtouchend座標までの移動量が閾値（8px、Phase26以来の標準）を超えた場合はactivationとして扱わない。
- dragは原則不要。

---

## 21. Accessibility

以下との整合性を最低限確認する。

- Keyboard（18章）
- focus visible（Design System `--dm-focus-*`トークン）
- screen reader（進捗表示は`aria-hidden`、target labelは`aria-label`）
- ARIA（Switch Scan仕様書v1.8 12章と同水準——Version1では走査ハイライトへのARIA状態更新を必須としない現状維持方針を、Gaze dwell進捗表示にも同様に適用する）
- Switch Scan（19章）
- Touch（20章）
- `prefers-reduced-motion`（25章）
- zoom / 文字サイズ変更（既存共通A11yパネルの4段階と共存）
- responsive layout（24章）
- mobile / tablet、landscape / portrait

Gaze対応を追加したことで既存アクセシビリティを壊してはならない。

---

## 22. Modal / Common Chrome

- modal open中は背景のgaze targetを対象にしない（Switch Scan仕様書v1.8 9章の「モーダル表示中は走査候補をモーダル内に限定する」という既存原則をgazeにも適用する）。
- 参照実装: kurabeyou-app.htmlの`getGazeTargets()`は`settingsOpen`が真の間は常に`[]`を返し、設定パネル全体を構造的にgaze対象外としている。
- common chromeをgaze対象に含めるかどうかは、Switch Scanと同様にアプリごとに明示決定する（Switch Scan仕様書v1.8 5章の考え方を継承）。ただしgazeでは原則、学習targetと共通chromeを分離する（New App Standard 8章の既存記述をそのまま踏襲）。

---

## 23. Cleanup / Lifecycle

以下のtimer・event listener残留による誤作動を防止する（New App Standard 13章の既存要件をそのまま踏襲・詳細化）。

- targetが移動・消失する場合のdwell stateリセット。
- level / trial変更時のcleanup（`clearAllTimers()`等、junban-miyou-design-v1.md 7章のパターンを参照実装とする）。
- Gaze OFF時のtimer cleanup、pending activationが残らないこと。
- modal open時のcleanup。
- app終了・home遷移時のcleanup。

delayed callback（`setTimeout`等）は予約時だけでなく発火時にも「gazeEnabledがまだ真か」を再確認する（Switch Scan仕様書v1.8 §19.22.5の一般原則をgazeにも適用する）。

---

## 24. Responsive

375×667を最重要viewportとし、375×812 / 390×844 / 768×1024 / 1280×900を含む5viewportでの確認を最低要件とする（Multi-Input Program 12章、New App Standard 30章と同一方針）。

---

## 25. Reduced Motion

`prefers-reduced-motion: reduce`環境でも、dwell進捗・activation結果が視認できること（「何も起きない」状態を作らない、5章の基本原則4）。miru-hirogaru 19.1章のパターン（通常時はcolor spreading等のanimation、reduced-motion時は瞬時のcolor change等へ代替）を標準的な代替パターンとして推奨する。

---

## 26. Calibration Responsibility Boundary

### 26.1 Webアプリ側の責任範囲

- ブラウザ内での視線カーソル位置（マウスイベントとして到達する座標）に基づくdwell判定・進捗表示・target hit-testingの実装。
- 上記が正しく機能するための、target size・spacing・dwell設定の提供（本書6〜14章）。

### 26.2 デバイス / OS側の責任範囲

- Tobii等の視線入力デバイス自体のキャリブレーション（視線とスクリーン座標の対応付け）。
- OS・視線入力ソフトウェア（Tobii Experience・見るマウス等）レベルでの視線→マウスカーソル変換。

### 26.3 案内要件

Webアプリ側でOS・ハードウェアレベルのキャリブレーションを実装することはできない、または不適切である。既存アプリ（drawing-app・cup_game等）の`caution`フィールドが採用している「視線入力デバイスの初期キャリブレーションを事前に行ってください」という案内文を標準パターンとして踏襲する。新規Gaze対応アプリのapps-data.json `caution`／`lesson`フィールドにも同様の案内を含めることを推奨する（OPTIONAL、apps-data.json自体の変更は各アプリの公開Phaseで行う）。

### 26.4 iOS/iPadOS視線入力との重複回避

kyou-no-kiroku.htmlの既存案内（「設定＞アクセシビリティ＞ポインタコントロールの『自動的にタップ』をオフにしてください」）は、アプリ側のdwellクリックとOS側のdwellクリックが二重に発火することを防ぐための実例である。iPad視線入力対応を謳うアプリでは同様の案内を検討する。

---

## 27. Educational Rationale

「どのまな」のGaze Accessibilityは、視線入力技術そのものを使わせることが目的ではない。目的は、見る・気づく・選ぶ・見届ける・原因と結果を経験する・意思を表出する・自分の方法で参加することを可能にすることである。

したがって、誤入力を完全排除するために操作を難しくする設計ではなく、利用者が成功しやすいよう環境側を調整できる設計を基本とする（5章の基本原則）。本書が定める8つのREQUIRED設定項目（6章）は、いずれも「制限を増やす」のではなく「その子に合わせて環境を調整できる幅を増やす」ためのものである。

---

## 28. Reference Implementation

| 要件 | 参照実装 |
|---|---|
| Dwell Engine（requestAnimationFrame駆動） | `kurabeyou-app.html` `gazeTick()` |
| Leave-and-Reenter Gate | `miru-hirogaru-app.html` / `mitsukete-touch-app.html` / `junban-miyou-app.html`（`gazeAwaitingLeaveId`、`resetDwellState()`） |
| Dwell Progress Ring（conic-gradient） | `katachi-awase-app.html`（`.gaze-dwell::after`） |
| Hit Area ≠ 視覚サイズ | `mitsukete-touch-app.html`（hide spot全体をdwell対象に） |
| Gaze × Switch Scan 3層視覚共存 | `miru-hirogaru-app.html`（Phase M2.1）/ `junban-miyou-app.html`（Guided Attention含む3層） |
| Gaze対象からのmodal除外 | `kurabeyou-app.html` `getGazeTargets()` |
| Dwell時間の調整UI（stepper方式） | `kyou-no-kiroku.html` / `okane-app.html`（300〜3000ms、+/-ステッパー） |
| Dwell時間の調整UI（slider方式） | `gaze-keyboard.html`（300〜3000ms）/ `cup_game.html`（500〜5000ms） |
| Gaze ON/OFF連動によるSwitch Scan一時抑制 | `kimochi-board.html`（`state.gazeEnabled`、Switch Scan仕様書v1.8 11章が唯一の実例として言及） |
| 視線入力デバイス案内文 | `drawing-app.html` / `cup_game.html` `caution`フィールド |

---

## 29. Pilot 3教材 Compliance

**本章はPhase M11.2時点（Pilot初期実装）の状態を記録していたが、Phase M11.3-A（miru-hirogaru-app.html）・M11.3-B（mitsukete-touch-app.html／junban-miyou-app.html）の実装完了を受け、以下は現在の状態に更新済みである。** Phase M11.2時点の記録は`docs/multi-input/*-design-v1.md`各書の履歴注記（31.1章参照）に残る。

| Requirement | miru-hirogaru | mitsukete-touch | junban-miyou | 判定 |
|---|---|---|---|---|
| 6.1 視線入力 ON/OFF | 実装済み（既定OFF、永続化） | 実装済み（同左） | 実装済み（同左） | **Already compliant**（Decision B、0章） |
| 6.2 ドウェル時間調整 | 300–3000ms、既定900ms | 同左 | 同左 | **Already compliant** |
| 6.3 ドウェル進捗表示 | ON/OFF切替可能 | 同左 | 同左（Guided Attention 3層構造は無変更） | **Already compliant** |
| 6.4 再選択防止 | Leave-and-Reenter Gate + cooldown floor（300–3000ms） | 同左 | 同左 | **Already compliant**（Foundation A水準） |
| 6.5 視覚変化・進行速度 | 2段階トグル（ふつう/ゆっくり）、reduced-motion優先 | 同左 | 同左（Departure等5タイマー対応、`boardingCompletionMs()`でロック時間と同期） | **Already compliant**（REQUIRED基礎水準＋RECOMMENDED上位実装） |
| 6.6 視線ターゲット拡大 | hit areaのみ拡大（100/150%） | 同左（既存の「hit area=隠れ場所全体」原則と両立） | 同左（現在targetのみ拡大、getGazeTargets()の既存限定により自然に安全） | **Already compliant** |
| 6.7 ターゲット間余白調整 | CSS layout gap方式 | hit region erosion方式（絶対%配置のため） | hit region erosion方式（実質効果なし、UI一貫性目的） | **Already compliant（実装方式はアプリ固有、33章参照）** |
| 6.8 注視開始までの猶予 | 0–500ms、既定0ms | 同左 | 同左 | **Already compliant** |

**総評（Phase M11.3-C更新）**: Multi-Input Pilot 3教材はGaze Accessibility Standard v1.0のREQUIRED 8項目すべてを実装済み（Phase M11.3-A/B）。設定名称・グループ順序・数値レンジ・defaultはPhase M11.3-Cの横断監査でbyte-identicalを確認済み（33章）。6.7（target spacing）のみ、実現方式（CSS gap／hit region erosion）がアプリのレイアウト構造に応じて異なるが、これは意図的・正当な差異であり統一の対象としない（33章）。Tobii実機確認はみるとひろがるのみ完了（M11.3-Aゲート）、他2教材は自動検証のみで実機確認は引き続き未実施。

---

## 30. 既存Gazeアプリ Inventory

Pilot 3教材を除く、`視線入力`a11yタグを持つアプリ（10本）およびkimochi-board.html（a11yタグは`視線入力`の文字列を持たないが`state.gazeEnabled`によるgaze実装を持つ、11本目）を対象に、コード横断調査を行った。

| id | 表示名 | ON/OFF | Dwell調整 | 進捗表示 | 特記事項 |
|---|---|---|---|---|---|
| kimochi-board | コミュニケーションボード | ○ | ○（stepper） | ○ | Switch Scan仕様書v1.8が唯一言及する既存gaze×switch統合実例。scanSpeedと独立してdwellステップを持つ |
| gaze-keyboard | 視線キーボード | ○（推定、複数入力対応記載あり） | ○（slider 300-3000ms） | ○（色カスタマイズ可） | dwell-ring色をtheme別に変更可能。キー単位のdwellingクラス |
| mogura-tataki | もぐらたたき | ○（cfg.dwell） | ○（stepper） | ○ | ドウェル安定化（jitter tolerance、dwTol）を独自に持つ。カーソル表示ON/OFFも別途あり |
| cup_game | どこかな？カップゲーム | ○（推定、dimmed連動あり） | ○（slider 500-5000ms） | ○ | dwell tolerance（20-150px）調整も実装済み。ボタン単位のdwell progress barあり |
| kyou-no-kiroku | きょうのきろく | ○ | ○（stepper 300-3000ms） | ○（conic-gradient） | iOS視線入力との二重dwell回避の案内文あり（26.4章） |
| katachi-awase-app | かたちをあわせよう | ○ | ×（DWELL_MS=900固定） | ○ | Phase26-D6のleave-reenter相当パターンをコード内コメントで文書化。gaze target からmodal除外の参照実装 |
| kurabeyou-app | おおきい？ちいさい？くらべよう | ○ | ×（DWELL_MS=900固定） | ○ | New App Standard 13章の一次参照実装（requestAnimationFrame dwell engine） |
| scratch-app | けずりえ | ○（tgGz） | △（モード選択のみ、時間調整は限定的） | △（連続描画モードのため通常のdwell progressと異なる） | 継続的マウス移動＝自動削りという特殊な操作モデル。標準dwell-select型と異なる |
| drawing-app | おえかきひろば | ○（モード選択に統合） | ○（select、300ms刻みではない離散値） | ○（dwellingクラス） | dwell-draw/continuous/dwell-clickの3モードを持つ、最も複雑な入力モデル |
| tyushi | ひかるボタン（注視訓練） | ×（アーキテクチャ上、単一ボタンの訓練用途） | ○（slider 200-4000ms） | ○ | Switch Scan仕様書v1.8 1.4章で「scanという名を持つが対象外」と明記された特殊構成。単一target・複数target切替の概念を持たない |
| okane-app | おかねのおべんきょう | 未確認（コード確認が「マウス／タッチ位置でのドウェルクリック」というコメント1行に留まり、UIの実態を本Phaseでは深く確認できていない） | ○（stepper、コード上は確認） | 未確認 | 実装の厚みが他アプリと比べ薄い可能性があり、要再確認 |

### 30.1 Group分類

**Group A（標準にほぼ準拠）**: kimochi-board、gaze-keyboard、mogura-tataki、cup_game、kyou-no-kiroku

ON/OFF・dwell調整UI・進捗表示のいずれも実装済みで、本書のREQUIRED項目のうち少なくとも6.1〜6.3を満たす。6.4（再選択防止の方式）・6.6〜6.8（拡大・余白・entry delay）は他アプリ同様に軽微〜新規要件レベルの不足がある。

**Group B（軽微修正で準拠可能）**: katachi-awase-app、kurabeyou-app、scratch-app、drawing-app

katachi-awase-app／kurabeyou-appはdwell時間が固定値（900ms）でUIがないことのみが主なgapであり、それ以外の設計（leave-reenter相当パターン、modal除外、requestAnimationFrame駆動）はFoundation A水準に近い。scratch-app／drawing-appは継続描画という特殊な操作モデルを持つため、標準dwell-select型のUI要件をそのまま当てはめる前に、教材特性に応じた適用方法の個別検討が必要。

**Group C（Gaze実装の再設計が必要）**: tyushi

単一ボタンの明滅訓練という教材の性質上、「ターゲット間余白」「target切替時のdwellリセット」等、本書が前提とする複数target構成の概念が当てはまらない。ON/OFF切替も教材の目的上そぐわない可能性が高く、本書の適用要否自体をアプリ単位で再検討する必要がある。

**Group D（Gaze対応の実態確認が必要）**: okane-app

コード上のヒットは確認できたが、本Phaseの調査深度では実装の全体像（進捗表示の有無、cooldownの有無等）を確認しきれなかった。次Phase着手前に個別のコード読解が必要。

---

## 31. Migration Guidance

### 31.1 Decision B: Pilot 3教材へのGaze ON/OFF追加（Phase M11.3-Aで正式確定）

6.1（視線入力ON/OFF）はREQUIRED項目である。Pilot 3教材はMulti-Input Program 8.5章で「自動併用を既定とし、Mode選択UIは複数入力が具体的に競合する問題が確認された場合にのみ追加を検討する（過剰な設定はしない）」と明示的に決定していたが、これはPilot時点（Multi-Input Program策定当時）の歴史的設計判断として扱う（0章 Decision B）。

**今後の正式標準としては、Gaze対応教材は利用者・支援者が視線入力を明示的に有効／無効化できることをREQUIREDとする。** Pilot 3教材への遡及適用は、まず「みるとひろがる」1本をReference Implementationとして実装し（Phase M11.3-A、User Tobii確認PASS）、検証結果を踏まえて残り2教材（どこかな？みーつけた！／じゅんばんにみよう）へ横展開した（Phase M11.3-B）。**Phase M11.3-C時点で3教材とも実装完了。** defaultはON/OFFともに既存の「自動併用」体験を破壊しないOFFを採用（backward compatible、31.2章）。

**Pilot設計書側の扱い**: `docs/multi-input/multi-input-program-design-v1.md` 8.5章の「自動併用に確定」という記述は、過去の設計経緯として削除・書き換えしない。Gaze ON/OFF実装時に、当該アプリの個別設計書（例: `miru-hirogaru-design-v1.md`）へ「当初Pilotでは常時有効だったが、Gaze Accessibility Standard v1.0策定後はON/OFF REQUIRED」という最小限の履歴注記を追加する運用とする（実際の注記はPhase M11.3-A実装時に当該設計書へ追記する、5章参照）。

### 31.2 後方互換性を保った追加の指針

本書が新規要件として挙げた項目（6.3のON/OFF・6.6〜6.8・9章のentry delay）は、いずれもdefault値を「現行挙動と同一」に設定することで、既存実装への追加時に見た目・体験を変えずに導入できる設計とした（各章のdefault値を参照）。既存アプリへの適用時も、まずdefault値を現行挙動と一致させてから設定UIを追加することを推奨する。

### 31.3 New App Standardへの反映（Phase M11.2: 参照ポインタ追加／Phase M11.3-A: Decision A反映）

Phase M11.2でNew App Standard 13章「gaze / dwell（CONDITIONAL）」の末尾に本書への参照ポインタを追記済み（v1.2→v1.3）。Phase M11.3-Aでは、Decision Aの確定を受け、13章「Switch Scanとの関係」の記述を「原則相互排他」から「同時ON許容＋重複activation防止」へ改訂する（New App Standard側の変更内容は同文書の改訂履歴で管理する）。dwell safetyチェックリスト等、Decision A/Bと無関係な13章本文は変更しない。

---

## 32. Compliance Checklist

新規Gazeアプリ開発時にそのまま確認できるチェックリスト。

- [ ] 視線入力 ON/OFFがある（6.1）
- [ ] Dwell時間を変更できる（300〜3000msの範囲、8.2章）
- [ ] Dwell progress表示を切り替えられる（6.3・11.2章）
- [ ] 再選択防止がある（Leave-and-Reenter GateまたはCooldownタイマー、10章）
- [ ] Entry delayがある（default 0ms、9章）
- [ ] Gaze target拡大に対応（12.3章）
- [ ] Target spacing調整に対応（13.2章）
- [ ] Motion speed調整に対応（RECOMMENDED、14.2章）
- [ ] Touchでも利用できる（20章）
- [ ] Switch Scanでも利用できる（19章）
- [ ] Keyboardでも利用できる（18章）
- [ ] Modal中に背景gaze targetが反応しない（22章）
- [ ] target消失時にtimer cleanup（23章）
- [ ] Gaze OFF時にtimer cleanup（23章）
- [ ] reduced-motion対応（25章）
- [ ] 設定保存が標準方式（既存単一settingsオブジェクトへの統合、16.2章）
- [ ] 設定UIが標準順序（A→B→C→Dグループ、15.2章）
- [ ] Tobii等の実機確認項目を満たす（キャリブレーション案内文を含む、26章）
- [ ] Gaze×Switch Scan同時ON方針を明示決定した（17.2章、相互排他 or 同時ON）
- [ ] 5viewport（375×667/375×812/390×844/768×1024/1280×900）でoverflow・clippingがない（24章）

---

## 33. Phase M11.3-C: Cross-App Consistency Audit / Shared Candidate Findings

Phase M11.3-Cで、Multi-Input Pilot 3教材（実装完了後）を横断比較した結果を記録する。M11.4での共通化判断の一次資料とする。**本章の記載はいずれも調査結果の記録であり、本Phaseでは実装の共通化・統合は行っていない。**

### 33.1 設定名称・順序・数値レンジのByte-Identical確認

3教材のソースを直接diffし、以下がbyte-identicalであることを確認した: 設定グループ見出し（選択／見やすさ・操作しやすさ／動き）、各設定のラベル文言、`DWELL_MIN_MS/MAX_MS/STEP_MS`（300/3000/100）、`ENTRY_DELAY_*`（0/500/50）、`COOLDOWN_*`（300/3000/100）、`TARGET_SCALE_STANDARD/LARGE`（100/150）、`MOTION_SLOW_FACTOR`（1.4）。既定値（gazeEnabled=false、dwellDurationMs=900、entryDelayMs=0、cooldownMs=900、dwellProgressVisible=true、gazeTargetScalePct=100、targetSpacingWide=false、motionSpeedLevel='normal'）も3教材で完全一致。

### 33.2 hitTestGazeTargets() 差分分析

- **mitsukete-touch-app.html／junban-miyou-app.html**: 関数本体がbyte-identical（scale拡大＋`targetSpacingWide`時のerosion処理を含む）。
- **miru-hirogaru-app.html**: erosion処理を持たない（scale拡大のみ）。target spacingをCSS `gap`（flex/gridレイアウト）で実現しているため、hit-test側での対応が不要という設計判断（13章参照）。

**1つのhelperへの統合可否**: scale拡大部分は3教材で意味・実装とも完全に共通化可能。erosion部分はmiruに「spacingをCSS gapで扱う」という設計判断がある限り無条件の統合はできない——共通helper化する場合は`erosion: boolean`のようなoption parameterで吸収する設計が必要（例: miruはoption未指定またはfalseで現行同等）。

**miruへerosion概念を追加するメリット**: 3教材の実装が完全一致し、将来のhelper抽出が単純になる。**デメリット**: miruは既にUser Tobii確認PASS済みの実装（Phase M11.3-Aゲート）であり、動作を変更する変更は再度の実機確認を要する。CSS gap方式は視覚的にも余白が広がったことが分かりやすいという利点があり、erosion方式（視覚的に変化しない、hit areaのみ縮む）に統一することが必ずしも改善とは言えない。**結論**: 本Phaseでは統一しない。M11.4でoption parameter方式の設計を先に固め、miruへの適用要否はその後にユーザー判断を仰ぐ。

### 33.3 Shared Candidate 最終分類

**SAFE TO SHARE**（3教材でbyte-identical、依存関係なし、そのまま抽出可能）:
- Gaze定数ブロック（`DWELL_MIN_MS`等8定数、33.1章）
- `clamp(v, lo, hi)`
- `wireStepper(minusId, plusId, valId, get, set, min, max, step, format)`
- `formatSecondsLabel(ms)`
- `effMs(baseMs)`（`MOTION_SLOW_FACTOR`同様3教材一致。ただし各アプリの`motionSpeedLevel`変数への依存があるため、共有時は変数ではなく関数引数化が必要）
- Settings UI CSS のうち `.stepper-btn` / `.stepper-val`（byte-identical）

**SHARE WITH OPTIONS**（機能・目的は共通だが数値/実装に軽微な差があり、パラメータ化が必要）:
- `hitTestGazeTargets()`（33.2章、erosion有無をoption化）
- `.setting-group-title` / `.stepper-row` / `.settings-reset-btn` のCSS（junban-miyou-appのみ`--dm-space-*`/`--dm-color-sub`トークンではなくハードコード値・独自アクセントカラーを使用——同ファイルの既存デザイン規約に合わせた意図的差異。共有時はCSSカスタムプロパティでフォールバックを持たせるか、junban側の小さな上書きを許容する設計が必要）
- `resetGazeSettingsToDefault()`（構造は共通だが、cooldown既定値の参照元が異なる: miru=`FEEDBACK_MS`定数、mitsukete/junban=リテラル`900`。意味的にはどれも「900ms」で一致するが、コード上の参照先を揃えるには各アプリの命名を調整する必要がある）

**KEEP LOCAL**（教材固有の意味に深く結合しており、共有すべきでない）:
- gaze-tick状態機械の変数名・DOM属性名（`transient.gazeTargetId`/`gazeItemId`/`gazePassengerId`、`data-item-id`/`data-passenger-id`）
- `applyMotionSpeed()`が実際にスケールするタイマー群（miru: 3個、mitsukete: 2個、junban: 5個+`boardingCompletionMs()`）——Multi-Input Program 22.3章 Foundation Cの「Level/Room/Round遷移待ち時間は個別設計、統一しない」という既存原則と整合
- 設定行のHTML markup様式（junban-miyou-appの`<div><strong>`+aria-label方式は、本Phase以前から存在する当該ファイル独自の規約であり、本Phaseで新たに生じた差異ではない）
- target spacingの実現方式そのもの（miru=CSS gap、mitsukete/junban=hit region erosion。レイアウトアーキテクチャの違いに起因する正当な差異）

### 33.4 generate.js Marker Injection方式の適用可能性調査

既存の`injectA11yPanelToAppHtmls()`等（`<!-- xxx: 自動挿入 (generate.js) -->`〜`<!-- /xxx -->`のマーカー間を差し替える方式）を調査した結果：

- **既存injector（a11y-panel/home-btn/lock-fs-btn/announce-helper）はすべて「アプリの内部stateに依存しない、自己完結したapp-agnostic overlay UI」である**——これがマーカー注入方式が安全に機能している前提条件。
- Gaze機能はこの前提を満たさない: dwell判定は各アプリの`getGazeTargets()`（DOM構造依存）・`activateXxx()`（教材固有のsemantic activation関数）に必ず結合する。33.3章のKEEP LOCAL項目がまさにこの結合部分。
- **段階的に切り分けると3層になる**:
  1. 定数・純粋関数・Settings UI HTML/CSS（33.3章SAFE TO SHARE相当）——既存injector群と同じ「app-agnostic」条件を満たし、そのままマーカー注入方式を適用できる。
  2. `hitTestGazeTargets()`（33.3章SHARE WITH OPTIONS相当）——option parameter化すれば注入可能だが、呼び出し側（gaze-tick）との結合が残る。
  3. gaze-tick状態機械そのもの（33.3章KEEP LOCAL）——Switch Scan仕様書v1.8のhelper6と同じ位置づけ（「契約は結果の形のみ、実装は各アプリのadapterとして残す」）とするのが安全。マーカー注入の対象にしない。
- **marker候補位置**: Settings UI HTML/CSSは`<!-- gaze-settings-ui: 自動挿入 (generate.js) -->`のような専用マーカーを`#settingsPanel`内・`<style>`内にそれぞれ新設する案が有力（3教材とも設定IDが既に統一されているため、テンプレート化が容易）。
- **id衝突リスク**: 低い。3教材とも本Phase以前からGaze設定要素のid（`#dwellMinusBtn`等）を意図的に統一しており、他要素との衝突も確認されていない。
- **app固有設定との境界**: 33.3章の3分類がそのまま境界線になる。SAFE TO SHARE/一部のSHARE WITH OPTIONSまでがinjector側、KEEP LOCALは既存のSwitch Scan helper6と同様、アプリごとの手書きadapterのまま残す。
- **generate再実行時の冪等性**: 既存8種のinjectorと同一のマーカー差し替えロジックを再利用するため、追加のリスクなし（差分がなければファイル書き換えなし、というべき等性は実証済みの機構）。
- **rollback容易性**: 高い。マーカーブロックの削除、または旧ファイルへの復元で即座に戻せる。
- **manual app編集との競合**: KEEP LOCAL部分（gaze-tick）を手書きのまま残す設計であれば、既存のSwitch Scan rollout（21アプリ実績）と同水準のリスクに収まる。SAFE TO SHARE部分を注入対象にする場合、当該HTML/CSSブロックをアプリ側で直接編集しないという運用規律が必要（既存injectorと同じ運用）。
- **結論**: 定数・純粋関数・Settings UI HTML/CSSの注入は技術的に無理がなく、M11.4でのPoC対象として有力。gaze-tick状態機械の共通化は、Switch Scan helper6同様「契約はそろえるが実装は手書きを維持する」方針を推奨する。

---

## 34. Phase M11.4-A: Gaze Shared Foundation PoC結果

33.4章の設計方針を、`mitsukete-touch-app.html`を対象に実装PoCとして検証した。**結果: 成功。** SAFE TO SHARE項目のgenerate.js marker injection化、およびhitTestGazeTargets()のoption parameter化のいずれも、既存挙動を完全に保ったまま実現できることを実証した。

### 34.1 実装内容

- **generate.js**: `GAZE_SHARED_FOUNDATION_APPS`（登録制Set、本PoCは`mitsukete-touch-app`のみ）に基づき、`injectGazeSharedFoundationToAppHtmls()`を新設。CSS（`.stepper-btn`/`.stepper-val`）を`<head>`内`<!-- gaze-shared-css -->`マーカーへ、JS（定数5行＋`clamp()`/`effMs()`/`formatSecondsLabel()`/`wireStepper()`）を`</main>`直後の`<!-- gaze-shared-js -->`マーカーへ、既存injector群（design-tokens等）と同一の差し替えロジックで注入する。
- **mitsukete-touch-app.html**: 上記に対応する手書きコードを削除し、二重定義を排除。`SPACING_EROSION_PX`（教材固有のerosion量、KEEP LOCAL）と`MT_REVEAL_DURATION_*`（教材固有のmotion timer、KEEP LOCAL）はアプリ側に維持。

### 34.2 hitTestGazeTargets() option parameter API（確定）

```js
hitTestGazeTargets(x, y, targets, options)
// options: { scale: <百分率、既定100>, erosion: <px、既定0> }
```

`scale`/`erosion`いずれも数値パラメータとし、erosion量自体（8px）はアプリ側の`SPACING_EROSION_PX`定数から呼び出し時に渡す設計とした——関数本体に定数を埋め込まず、真に純粋な関数とするため。`gazeTargetScalePct`/`targetSpacingWide`という状態変数への参照は関数内から排除し、呼び出し側（gaze-tick、KEEP LOCAL）が値を組み立てて渡す。既定値（`scale:100, erosion:0`）は既存の`elementFromPoint`一本化パスと完全に一致し、挙動変化なし。**本Phaseではこの関数自体はgenerate.js注入の対象にしていない**（呼び出し側との結合がまだ残るSHARE WITH OPTIONS段階のため、33.4章の「段階2」のまま）。

### 34.3 miru-hirogaru-app.html対応可否

**本Phaseでは対応しない（禁止事項どおり）。** ただし34.2章のoptions APIは、miruの既存呼び出し（`hitTestGazeTargets(x, y, targets)`、scale-onlyでerosionなし）を`hitTestGazeTargets(x, y, targets, { scale: gazeTargetScalePct })`（erosion省略＝0）へ書き換えるだけで無変更のまま吸収できることを設計上確認した（erosionを渡さなければ現行のscale-onlyパスと完全一致）。実際の適用要否はM11.4-Bでユーザー判断とする。

### 34.4 junban-miyou-app.html対応可否

mitsukete-touch-app.htmlと`hitTestGazeTargets()`本体がbyte-identicalだったため（Phase M11.3-C 33.2章）、同じoptions API・同じSAFE TO SHARE injection対象がそのまま適用できる設計上の見込みが高い。実装はM11.4-Bへ持ち越す。

### 34.5 検証結果概要

- **before/after equivalence**: `test_mitsukete.py`（Phase M11.3-B/Cから継続使用、変更なし）を再実行し、全項目（Gaze ON/OFF・dwell・progress・cooldown・entry delay・target enlargement・target spacing・motion・Touch・Keyboard・Switch Scan・simultaneous input・duplicate activation・persistence・reset・modal・level transition・reduced-motion・5viewport×3Level responsive）が改修前と完全に同一の結果を示した。console/page error 0。
- **hitTest unit検証**: target中心・target外・target edge・scale 100%/150%・erosion境界（isolated single-targetで明確に分離）・overlap・hidden targetの全パターンで期待どおりの挙動を確認。
- **冪等性**: `node generate.js`を4回連続実行し、2回目以降はファイルハッシュが完全不変（0件更新）であることを確認。
- **副作用**: `miru-hirogaru-app.html`・`junban-miyou-app.html`・`index.html`はdiff 0（`GAZE_SHARED_FOUNDATION_APPS`未登録のため無影響）。

### 34.6 shared化メリット/リスク評価

**メリット**: 3教材共通の定数・純粋関数（約20行×3箇所）が単一のgenerate.js定義へ集約され、将来のGaze Standard default値変更（例: entry delay範囲の見直し）が1箇所の編集で3教材へ反映可能になる。既存injector運用（8種実績）と同一パターンのため、開発者の学習コストも低い。

**リスク**: 低い。①注入対象はPURE code（DOM/教材ロジックへの依存なし）に限定しているため、教材固有の挙動へ波及する経路がない。②登録制Set方式のため意図しない一括適用が起きない。③冪等性は既存機構の再利用であり新規リスクなし。唯一の運用上の留意点は、SAFE TO SHARE注入対象のHTML/CSSブロックをアプリ側で直接編集しない規律を維持すること（既存injector群と同水準の運用ルール）。

**結論**: 33.4章のPoC失敗条件（app固有コード破壊・global scope衝突・timing差による挙動変化・CSS注入の波及・冪等性喪失・複雑性がメリットを上回る）はいずれも該当しなかった。M11.4-Bでの残り2教材への横展開を推奨する。

## 35. Phase M11.4-B: Gaze Shared Foundation 横展開・hitTestGazeTargets() SAFE TO SHARE昇格

34章のPoCを、残り2教材（`junban-miyou-app.html`→`miru-hirogaru-app.html`の順）へ横展開した。**結果: 成功。** Multi-Input Pilot 3教材すべてがGaze Shared Foundationを共有する状態が完成し、加えて`hitTestGazeTargets()`自体もSHARE WITH OPTIONSからSAFE TO SHAREへ昇格した。

### 35.1 実装内容

- **`junban-miyou-app.html`**（Step 1）: 34.4章の見込みどおり、mitsukete-touch-app.htmlと同じ手書きコードをShared Foundationへ委譲。教材固有の`SPACING_EROSION_PX`・`JM_SPARKLE_DURATION_NORMAL_MS`/`_SLOW_MS`はKEEP LOCALのままアプリ側に維持。
- **`miru-hirogaru-app.html`**（Step 2、Tobii実機検証済みReference Implementation）: 34.3章の設計見込みどおり、共通定数・純粋関数をShared Foundationへ委譲。呼び出し箇所は`hitTestGazeTargets(lastGazeX, lastGazeY, targets, { scale: gazeTargetScalePct })`とし、**`erosion`オプションは意図的に一切渡していない**（省略＝既定値0）。これによりmiruのhit-test判定は改修前とbyte-identicalな`elementFromPoint`一本化パスを通り続け、Tobii実機で確認済みのdwell/entry delay/cooldown/target scale/spacing/motion/進捗/activation timing/leave-and-reenter/判定境界のいずれも変更していない。教材固有の`MH_POP_DURATION_NORMAL_MS`/`_SLOW_MS`はKEEP LOCALのままアプリ側に維持。
- **`generate.js`**: `GAZE_SHARED_FOUNDATION_APPS`に`'junban-miyou-app'`・`'miru-hirogaru-app'`を追加登録（`'mitsukete-touch-app'`と合わせて3教材すべてが登録済み）。

### 35.2 generate.js注入ロジックのバグ修正（横展開中に発見）

`injectGazeSharedFoundationToAppHtmls()`のJS注入用フォールバックアンカーが`html.indexOf('</main>')`だったため、`<main>`要素を持たない`junban-miyou-app.html`（`<div class="app">`構造）では注入位置を特定できず失敗することが判明した。`html.lastIndexOf('<script>')`（教材本体の最終`<script>`タグ直前）へアンカーを変更し、`<main>`の有無に依存しない堅牢な注入位置決定とした。3教材とも注入位置が教材本体スクリプトの直前であることを確認済み。

### 35.3 hitTestGazeTargets() のSAFE TO SHARE昇格

16章の判断基準（miru側wrapper不要・app固有分岐が入らない・option数が安定/小規模・material依存ロジックが入らない）を、3教材横展開完了時点で再評価した。

- **miru側wrapper不要**: 35.1章のとおり、miruは`erosion`省略のみで対応でき、wrapper関数は不要だった。
- **app固有分岐なし**: `sed`で3教材の`hitTestGazeTargets()`関数本体を抽出し diff したところ、**byte-identical**であることを確認した（mitsukete・junban・miru間で1バイトの差異もなし）。
- **option数の安定性**: `{scale, erosion}`の2オプションのまま変化なし。
- **material依存ロジックなし**: 関数内に教材名・DOM構造への分岐は一切ない（純粋な座標×矩形判定のみ）。

以上4条件すべてを満たしたため、`hitTestGazeTargets()`を`buildGazeSharedFoundationJSHTML()`内へ移設し、SAFE TO SHAREへ昇格した。3教材の手書き関数本体は削除し、各教材の呼び出し箇所（KEEP LOCAL）のみが残る。

### 35.4 Shared / Local Adapter 契約（Switch Scan helper6パターン踏襲）

Switch Scan仕様書のhelper6パターン（「contractは共有、実装はapp-local adapterに残す」）にならい、Gaze Shared Foundationの責務境界を以下のとおり明文化する。

**Shared（generate.js注入、`<!-- gaze-shared-css -->`/`<!-- gaze-shared-js -->`）:**
- 定数: `DWELL_MIN_MS`/`_MAX_MS`/`_STEP_MS`、`ENTRY_DELAY_MIN_MS`/`_MAX_MS`/`_STEP_MS`、`COOLDOWN_MIN_MS`/`_MAX_MS`/`_STEP_MS`、`TARGET_SCALE_STANDARD`/`_LARGE`、`MOTION_SLOW_FACTOR`
- 純粋関数: `clamp()`、`effMs()`、`formatSecondsLabel()`、`wireStepper()`、`hitTestGazeTargets(x, y, targets, options)`
- CSS: `.stepper-btn`、`.stepper-btn:focus-visible`、`.stepper-val`

**Local Adapter（教材ごとに手書き、KEEP LOCAL）:**
- gaze tick状態機械（canonical/transient state）
- 教材固有DOM属性・ターゲット収集ロジック
- activation関数
- `applyMotionSpeed()`のターゲットタイマー呼び出し
- 設定行マークアップ（settings row HTML）
- ターゲット間余白の実現方式（例: `SPACING_EROSION_PX`のような教材固有のerosion量定数と、それを`hitTestGazeTargets()`へ渡す呼び出し組み立て）
- シーン/レベルのライフサイクル
- Guided Attention
- 教材固有のcleanup処理

**契約の性質**: Sharedは「値を受け取り値を返す、DOM/教材ロジックに依存しないPURE code」に限定する。教材固有の状態・タイミング定数・DOM構造への依存が生じた時点で、その項目はLocal Adapter側へ残す（＝Sharedへ昇格させない）。`hitTestGazeTargets()`が昇格できたのは、教材固有のerosion値そのものではなく「erosion値を受け取って判定するロジック」のみを関数化していたためである。

### 35.5 検証結果概要

- **before/after equivalence**: miru用4本（`test_gaze.py`〜`test_gaze4.py`）・mitsukete用1本（`test_mitsukete.py`）・junban用1本（`test_junban.py`、Guided Attention・boarding lifecycle・level遷移時のstray activation防止含む）・junban setBtn回帰用1本（`test_setbtn_fix.py`）・`hitTestGazeTargets()`単体テスト1本（`test_hittest_unit.py`）の全8本を、本Phase横展開後および`hitTestGazeTargets()`のSAFE TO SHARE昇格後の状態で再実行し、すべてPASS（console/page error 0件）。
- **冪等性**: `node generate.js`を3回連続実行し、2回目・3回目とも対象3教材ファイルが「既に最新」（0件更新）と判定され、SHA-256ハッシュが3回とも完全一致することを確認した。
- **マーカー整合性**: 3教材とも`<!-- gaze-shared-css -->`/`<!-- gaze-shared-js -->`の開始・終了マーカーがそれぞれ1組のみ存在し、重複・空白ドリフトは検出されなかった。
- **miru Tobii挙動保存**: 35.1章のとおり`erosion`を渡さない設計により、hit-test判定パスが改修前と完全に同一であることをunit test・equivalenceテスト双方で確認した。

### 35.6 手法上の注意点（透明性のための開示）

横展開作業の途中、再利用していたPlaywrightテストスクリプト（本Phase以前のフェーズから流用）のうち複数本が、過去フェーズのworktreeディレクトリ（`ROOT`変数）を指したままになっていたことを自己発見した。これらのworktreeは過去フェーズのコミット時点のまま物理的にディスク上に残存しているため、修正前に実行した一部の「before/after equivalence」検証は、本Phaseの実際のコード変更ではなく過去フェーズの凍結スナップショットを検証していたことになる。発見後、全テストスクリプトの`ROOT`を本Phaseのworktree（`for-all-children-to-learn-m11-4b`）へ修正し、かつ`hitTestGazeTargets()`呼び出しを新API（`options`引数）に合わせて更新した上で、全テストを再実行し直した。本章35.5の検証結果はすべて修正後の再実行結果である。この問題は本Phase内で自己発見・自己修正されたものであり、ユーザーからの指摘によるものではない。今後のフェーズでは、流用テストスクリプトの`ROOT`が現在のworktreeを指しているかを実行前に必ず確認する。
