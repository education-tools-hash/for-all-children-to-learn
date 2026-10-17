# -*- coding: utf-8 -*-
"""
どのまな モックアップ・アイコン自動生成ツール
==============================================
各アプリの「実際の画面」をヘッドレスブラウザで撮影し、
PC(ブラウザ枠)+スマホ(端末枠)を組み合わせた紹介画像(1200x630, OGP兼用)と、
パステルカラーのアプリアイコン(512x512)を全アプリ分生成する。

出力:
  assets/mockups/{id}.png  … 紹介・OGP用モックアップ画像
  assets/icons/{id}.png    … アプリアイコン(角丸・透過)

使い方(リポジトリ直下で):
  python3 tools/make-mockups.py            # 全アプリ
  python3 tools/make-mockups.py tokei-app  # 指定アプリのみ

※ Playwright(Chromium)が必要。フォントは環境のNoto Sans CJKで代替される。
"""
import json, os, sys, subprocess, time, colorsys, shutil
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8901
TMP = ROOT / "_mockup_tmp"
OUT_MOCK = ROOT / "assets" / "mockups"
OUT_ICON = ROOT / "assets" / "icons"

# ---- generate.js と同一のパステル色計算 ----
def hex_to_hue(hexcolor):
    hexcolor = hexcolor.lstrip("#")
    r, g, b = (int(hexcolor[i:i+2], 16) / 255 for i in (0, 2, 4))
    h, _, _ = colorsys.rgb_to_hls(r, g, b)
    return h * 360

def hsl_to_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return "#%02X%02X%02X" % (round(r*255), round(g*255), round(b*255))

def shade(hexcolor, amount):
    """amount>0で明るく、<0で暗く"""
    hexcolor = hexcolor.lstrip("#")
    r, g, b = (int(hexcolor[i:i+2], 16) for i in (0, 2, 4))
    if amount >= 0:
        r, g, b = (round(v + (255-v)*amount) for v in (r, g, b))
    else:
        r, g, b = (round(v * (1+amount)) for v in (r, g, b))
    return "#%02X%02X%02X" % (r, g, b)

COMPOSITOR = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{{margin:0;box-sizing:border-box;}}
  body{{width:1200px;height:630px;overflow:hidden;position:relative;
    font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;
    background:
      radial-gradient(circle at 88% 12%, {light}66, transparent 55%),
      radial-gradient(circle at 8% 92%, {light}55, transparent 50%),
      #FBFBF8;}}
  .browser{{position:absolute;left:56px;top:52px;width:800px;border-radius:18px;
    overflow:hidden;box-shadow:0 26px 64px rgba(59,74,84,0.20);background:#fff;}}
  .bar{{height:44px;background:#F4F1EA;display:flex;align-items:center;padding:0 16px;gap:8px;}}
  .dot{{width:12px;height:12px;border-radius:50%;}}
  .url{{flex:1;margin-left:14px;background:#fff;border-radius:8px;height:26px;
    display:flex;align-items:center;padding:0 12px;font-size:13px;font-weight:600;color:#8a949a;}}
  .browser img{{width:800px;height:500px;object-fit:cover;object-position:top;display:block;}}
  .phone{{position:absolute;right:58px;top:118px;width:224px;height:448px;
    background:#1b1b1f;border-radius:36px;padding:10px;box-shadow:0 26px 64px rgba(0,0,0,0.30);}}
  .screen{{width:100%;height:100%;border-radius:28px;overflow:hidden;position:relative;background:#fff;}}
  .screen img{{width:204px;height:428px;object-fit:cover;object-position:top;display:block;}}
  .notch{{position:absolute;top:8px;left:50%;transform:translateX(-50%);
    width:70px;height:19px;background:#1b1b1f;border-radius:11px;}}
</style></head><body>
  <div class="browser">
    <div class="bar">
      <span class="dot" style="background:#EE6C7C"></span>
      <span class="dot" style="background:#F5A623"></span>
      <span class="dot" style="background:#00A99D"></span>
      <div class="url">&#128274;&nbsp; donomana.jp/{filename}.html</div>
    </div>
    <img src="{id}-desktop.png">
  </div>
  <div class="phone">
    <div class="screen">
      <img src="{id}-mobile.png">
      <div class="notch"></div>
    </div>
  </div>
</body></html>"""

ICON_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{{margin:0;}} body{{background:transparent;width:512px;height:512px;}}
  .icon{{width:512px;height:512px;border-radius:118px;position:relative;overflow:hidden;
    background:linear-gradient(140deg,{grad_a} 0%,{primary} 55%,{grad_b} 100%);
    display:flex;align-items:center;justify-content:center;
    box-shadow:inset 0 16px 44px rgba(255,255,255,0.35), inset 0 -16px 44px rgba(0,0,0,0.12);}}
  .glyph{{font-size:268px;line-height:1;
    font-family:'Noto Color Emoji','Zen Maru Gothic','Noto Sans CJK JP',sans-serif;
    color:#fff;font-weight:900;
    text-shadow:0 10px 24px rgba(0,0,0,0.18);
    transform:translateY(-4px);}}
</style></head><body><div class="icon"><span class="glyph">{icon}</span></div></body></html>"""


def _scratch_the_scratch_app(pg):
    """けずりえ：実際に何度かなぞって、絵が半分ほど見えている状態にする"""
    cw = pg.query_selector("#cw")
    if not cw:
        return
    box = cw.bounding_box()
    if not box:
        return
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.mouse.move(cx - box["width"] * 0.28, cy - box["height"] * 0.25)
    pg.mouse.down()
    step = 7
    for row in range(int(-box["height"] * 0.25), int(box["height"] * 0.15), step):
        for xoff in range(int(-box["width"] * 0.28), int(box["width"] * 0.28), step - 1):
            pg.mouse.move(cx + xoff, cy + row, steps=1)
    pg.mouse.up()
    pg.wait_for_timeout(400)


def _show_kurabeyou_level3(pg):
    """おおきい？ちいさい？くらべよう：レベル3(どっちかな？)へ切り替え、
    2つの図形を見比べている状態で撮影する（初期状態の1つだけの図形より、
    比較教材であることが一目で伝わるため）"""
    btn = pg.query_selector('.level-btn[data-level="3"]')
    if not btn:
        return
    btn.click()
    pg.wait_for_timeout(400)


def _start_mogura_tataki(pg):
    """もぐらたたき：はじめる！→カウントダウン終了を待ち→実際にモグラを叩いた瞬間にする"""
    btn = pg.query_selector("#btnStart")
    if not btn:
        return
    btn.click()
    # カウントダウン(3→2→1→スタート！)が終わり、実際にゲームが始まるまで待つ
    # (3・2・1で各800ms + 「スタート！」表示550ms ≒ 2950ms のため、余裕を持って待機)
    pg.wait_for_timeout(3400)
    # 複数のモグラが出ているタイミングを少し待ってから、1匹だけ叩く
    # （.hit クラスは300msで消えるため、クリック直後にスクリーンショットへ渡す）
    try:
        for _ in range(6):
            moles = pg.query_selector_all(".hole .mole.up")
            if len(moles) >= 2:
                break
            pg.wait_for_timeout(150)
        moles = pg.query_selector_all(".hole .mole.up")
        if moles:
            moles[0].click(timeout=1000)
    except Exception:
        pass
    pg.wait_for_timeout(80)  # .hit クラス(300msで消える)がまだ見えているうちに撮る


# アプリごとに「実際に遊んでいる最中」の見た目を作るためのカスタム操作。
# ここに無いアプリは、今まで通り「開いた直後の画面」をそのまま撮影する。
def _start_sakana_tsuri(pg):
    """さかなつり：魚と操作部が見える、まきとり待ちの実画面を撮る。"""
    pg.locator("#start-btn").click()
    pg.locator('[data-reel-method="hold"]').click()
    pg.locator("#cast-btn").click()
    pg.wait_for_function("state === STATE.REELING")
    pg.locator("#fish img").evaluate("img => img.decode()")


def _select_sakana_tsuri_method(pg):
    """さかなつり：はじめる→まきとり方法(ぐるぐるまく/長押しでまく/タイミングよく
    おしてまく)をまだ選んでいない、state===IDLEの画面を撮る(Phase
    APP-DETAILS-VISUAL-ENHANCEMENT-FISHING-PILOT-D-1、Design Contract §7.2の
    「1枚目: まきとり方法を選ぶ画面」用)。sakana-tsuri.htmlのupdateUI()は
    elMethodRowWrap.hidden = !preCast (preCast = state===IDLE) としているため、
    #start-btnクリック直後のIDLE状態でこの#methodRowWrap(3つの実ボタン)が
    表示される。_start_sakana_tsuriと異なり、方法ボタン・#cast-btnのどちらも
    クリックしない(まだ何も選んでいない状態のまま撮る)。"""
    pg.locator("#start-btn").click()
    pg.wait_for_function("state === STATE.IDLE")
    pg.wait_for_timeout(300)


def _touch_sawatte_hirogaru(pg):
    """さわってひろがる：はじめる→活動画面の#activitySurfaceに実際に複数回
    タップ(mouse pointerdown/up。アプリ側は'mouse'/'touch'どちらのpointerTypeも
    同じ反応を描く)して、触れた場所にリップル・パーティクルが広がっている
    最中の実画面を撮る（Phase APP-DETAILS-VISUAL-ENHANCEMENT-SAWATTE-MOCKUP-C-1）。
    初期設定(mode: light_sound)のままで視覚フィードバックは最初から有効。"""
    pg.locator("#startBtn").click()
    pg.wait_for_selector("#activitySurface", state="visible")
    surface = pg.locator("#activitySurface")
    box = surface.bounding_box()
    if not box:
        return
    # 画面内の5点へ、少しずつ間隔を空けてタップ(mouse down→up)する。
    # 各リップルの寿命(標準強度でrippleDurationMs=650ms)より十分短い間隔で
    # 連続タップすることで、スクリーンショット時点で複数の円が同時に
    # 広がっている「さわってひろがる」らしい見た目になる。
    points = [
        (0.30, 0.35), (0.62, 0.28), (0.45, 0.58), (0.72, 0.62), (0.22, 0.65),
    ]
    for fx, fy in points:
        x = box["x"] + box["width"] * fx
        y = box["y"] + box["height"] * fy
        pg.mouse.move(x, y)
        pg.mouse.down()
        pg.mouse.up()
        pg.wait_for_timeout(90)
    pg.wait_for_timeout(120)  # 最後のタップのリップルも消える前に撮る


PLAY_ACTIONS = {
    "scratch-app": _scratch_the_scratch_app,
    "mogura-tataki": _start_mogura_tataki,
    "kurabeyou-app": _show_kurabeyou_level3,
    "sakana-tsuri": _start_sakana_tsuri,
    "sawatte-hirogaru-app": _touch_sawatte_hirogaru,
}

# Phase APP-DETAILS-VISUAL-ENHANCEMENT-FISHING-PILOT-D-1: 同一アプリについて、
# 無印の{id}.png(PLAY_ACTIONSの操作で撮る、既存のまま)に加えて、
# assets/mockups/{id}-{slug}.png という名前で追加の画面を撮るための仕組み。
# {id}.pngはapps-data.jsonの各アプリにつき1枚しか持てない既存の設計のため、
# Design Contract §5の複数screenshots[]用の追加ファイルはこの辞書で定義する
# (apps-data.jsonに同じアプリの別id重複エントリを作る、という迂回はしない)。
# 既存のPLAY_ACTIONS・CLI引数・アイコン生成ロジックは一切変更しない。
EXTRA_SHOTS = {
    "sakana-tsuri": [("method-select", _select_sakana_tsuri_method)],
}

# Phase M12-G: User承認済みの正式アイコンartworkを持つアプリ。ここに登録した
# アプリは、assets/icons/{id}.png の自動生成(絵文字+パステルグラデーション)を
# スキップする — このスクリプトは既存ファイルの有無を見ずに毎回無条件で上書き
# するため、登録しないとUser承認済みartworkが次回実行時に古い自動生成アイコン
# へ静かに戻ってしまう。mockup(assets/mockups/{id}.png、実画面スクリーンショ
# ット)はこのSetと無関係で、対象アプリでも通常どおり再生成される。
CUSTOM_ICON_APPS = {"dotchiga-ii"}


def main():
    only = set(sys.argv[1:])
    data = json.loads((ROOT / "apps-data.json").read_text(encoding="utf-8"))
    apps = data if isinstance(data, list) else data.get("apps", data)
    if only:
        apps = [a for a in apps if a["id"] in only]

    TMP.mkdir(exist_ok=True)
    OUT_MOCK.mkdir(parents=True, exist_ok=True)
    OUT_ICON.mkdir(parents=True, exist_ok=True)

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "-d", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            def block_external(page):
                page.route("**/*", lambda route: route.continue_()
                           if "localhost" in route.request.url else route.abort())

            def capture_mockup(url, out_id, action, light):
                """1アプリ・1画面分のデスクトップ+スマホ実画面を撮影し、
                1200x630の合成モックアップとして assets/mockups/{out_id}.png
                に保存する(既存の単一screenshotループの本体を、複数画面を
                持つアプリ向けに再利用できるよう抜き出したもの。呼び出し側の
                ループ構造・CLI引数・アイコン生成ロジックには影響しない)。"""
                # 1) デスクトップ実画面
                ctx = browser.new_context(viewport={"width": 1280, "height": 800},
                                          device_scale_factor=1.5)
                pg = ctx.new_page(); block_external(pg)
                pg.goto(url, wait_until="load"); pg.wait_for_timeout(1200)
                if action:
                    try:
                        action(pg)
                    except Exception as ex:
                        print(f"(プレイ中状態の再現に失敗: {ex}) ", end="")
                pg.screenshot(path=str(TMP / f"{out_id}-desktop.png"))
                ctx.close()

                # 2) スマホ実画面
                ctx = browser.new_context(viewport={"width": 390, "height": 780},
                                          device_scale_factor=2, is_mobile=True,
                                          has_touch=True)
                pg = ctx.new_page(); block_external(pg)
                pg.goto(url, wait_until="load"); pg.wait_for_timeout(1200)
                if action:
                    try:
                        action(pg)
                    except Exception as ex:
                        print(f"(プレイ中状態の再現に失敗: {ex}) ", end="")
                pg.screenshot(path=str(TMP / f"{out_id}-mobile.png"))
                ctx.close()

                # 3) 合成モックアップ(1200x630 @2x → 等倍に縮小して保存)
                (TMP / f"comp-{out_id}.html").write_text(
                    COMPOSITOR.format(id=out_id, filename=fname, light=light),
                    encoding="utf-8")
                ctx = browser.new_context(viewport={"width": 1200, "height": 630},
                                          device_scale_factor=2)
                pg = ctx.new_page()
                pg.goto(f"http://localhost:{PORT}/_mockup_tmp/comp-{out_id}.html",
                        wait_until="load")
                pg.wait_for_timeout(300)
                raw = TMP / f"raw-{out_id}.png"
                pg.screenshot(path=str(raw))
                ctx.close()
                img = Image.open(raw).resize((1200, 630), Image.LANCZOS)
                img.save(OUT_MOCK / f"{out_id}.png", optimize=True)

            for i, app in enumerate(apps, 1):
                aid, fname = app["id"], app["filename"]
                hue = hex_to_hue(app.get("iconColor", "#5B3FD4"))
                primary = hsl_to_hex(hue, 0.55, 0.42)
                light = hsl_to_hex(hue, 0.62, 0.86)
                url = f"http://localhost:{PORT}/{fname}.html"
                print(f"[{i}/{len(apps)}] {aid} ... ", end="", flush=True)

                capture_mockup(url, aid, PLAY_ACTIONS.get(aid), light)

                for slug, extra_action in EXTRA_SHOTS.get(aid, []):
                    capture_mockup(url, f"{aid}-{slug}", extra_action, light)

                # 4) アイコン(512x512 透過) — User承認済み正式artworkを持つ
                #    アプリ(CUSTOM_ICON_APPS)は自動生成をスキップし、既存
                #    ファイルをそのまま保持する。
                if aid in CUSTOM_ICON_APPS:
                    icon_note = " (icon: User artwork保持、自動生成skip)"
                else:
                    (TMP / f"icon-{aid}.html").write_text(
                        ICON_HTML.format(icon=app["icon"], primary=primary,
                                         grad_a=shade(primary, 0.22),
                                         grad_b=shade(primary, -0.18)),
                        encoding="utf-8")
                    ctx = browser.new_context(viewport={"width": 512, "height": 512})
                    pg = ctx.new_page()
                    pg.goto(f"http://localhost:{PORT}/_mockup_tmp/icon-{aid}.html",
                            wait_until="load")
                    pg.wait_for_timeout(200)
                    pg.screenshot(path=str(OUT_ICON / f"{aid}.png"), omit_background=True)
                    ctx.close()
                    icon_note = ""

                mk = (OUT_MOCK / f"{aid}.png").stat().st_size // 1024
                print(f"OK (mockup {mk}KB){icon_note}")

            browser.close()
    finally:
        server.terminate()
        shutil.rmtree(TMP, ignore_errors=True)

    print("\n✅ 完了:", OUT_MOCK, "/", OUT_ICON)


if __name__ == "__main__":
    main()
