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

            for i, app in enumerate(apps, 1):
                aid, fname = app["id"], app["filename"]
                hue = hex_to_hue(app.get("iconColor", "#5B3FD4"))
                primary = hsl_to_hex(hue, 0.55, 0.42)
                light = hsl_to_hex(hue, 0.62, 0.86)
                url = f"http://localhost:{PORT}/{fname}.html"
                print(f"[{i}/{len(apps)}] {aid} ... ", end="", flush=True)

                # 1) デスクトップ実画面
                ctx = browser.new_context(viewport={"width": 1280, "height": 800},
                                          device_scale_factor=1.5)
                pg = ctx.new_page(); block_external(pg)
                pg.goto(url, wait_until="load"); pg.wait_for_timeout(1200)
                pg.screenshot(path=str(TMP / f"{aid}-desktop.png"))
                ctx.close()

                # 2) スマホ実画面
                ctx = browser.new_context(viewport={"width": 390, "height": 780},
                                          device_scale_factor=2, is_mobile=True,
                                          has_touch=True)
                pg = ctx.new_page(); block_external(pg)
                pg.goto(url, wait_until="load"); pg.wait_for_timeout(1200)
                pg.screenshot(path=str(TMP / f"{aid}-mobile.png"))
                ctx.close()

                # 3) 合成モックアップ(1200x630 @2x → 等倍に縮小して保存)
                (TMP / f"comp-{aid}.html").write_text(
                    COMPOSITOR.format(id=aid, filename=fname, light=light),
                    encoding="utf-8")
                ctx = browser.new_context(viewport={"width": 1200, "height": 630},
                                          device_scale_factor=2)
                pg = ctx.new_page()
                pg.goto(f"http://localhost:{PORT}/_mockup_tmp/comp-{aid}.html",
                        wait_until="load")
                pg.wait_for_timeout(300)
                raw = TMP / f"raw-{aid}.png"
                pg.screenshot(path=str(raw))
                ctx.close()
                img = Image.open(raw).resize((1200, 630), Image.LANCZOS)
                img.save(OUT_MOCK / f"{aid}.png", optimize=True)

                # 4) アイコン(512x512 透過)
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

                mk = (OUT_MOCK / f"{aid}.png").stat().st_size // 1024
                print(f"OK (mockup {mk}KB)")

            browser.close()
    finally:
        server.terminate()
        shutil.rmtree(TMP, ignore_errors=True)

    print("\n✅ 完了:", OUT_MOCK, "/", OUT_ICON)


if __name__ == "__main__":
    main()
