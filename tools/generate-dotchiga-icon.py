# -*- coding: utf-8 -*-
"""
「どっちがいい？」正式アイコン生成ツール(Phase M12-H〜H'')
======================================================
りんご・バナナ・ねこ・いぬ・？の具体物アイコン(Phase M12-G)を廃止し、
「⇔」+「？」だけで構成したシンプルな正式アイコンを programmatic に生成する。

外部AI画像生成・外部Webサービスへは依存しない。⇔は円・線のみによる幾何学
図形(フォント非依存)。「？」はOS同梱の標準sans-serifフォント(Segoe UI
Semibold、変形なしでそのまま描画)を使用している(Phase M12-H''、独自Bezier
造形からの変更)。最終的な正式アセットは assets/icons/dotchiga-ii.png 自体で
あり CUSTOM_ICON_APPS で保護されているため、フォント差異による環境間の
pixel-for-pixel再現性はProduction運用上のBlockerにならない。

出力: assets/icons/dotchiga-ii.png (512x512 RGBA)

使い方(リポジトリ直下で):
  python tools/generate-dotchiga-icon.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons" / "dotchiga-ii.png"

S = 512          # 最終サイズ
SS = 4           # スーパーサンプリング倍率(アンチエイリアス用)
C = S * SS       # 作業キャンバスサイズ

# apps-data.json の dotchiga-ii.iconColor と同一(#00A99D)。
# make-mockups.py の shade() と同じ計算式で明色/暗色を導出し、
# 他アプリのパステルグラデーションと同じトーンで統一する。
PRIMARY = (0x00, 0xA9, 0x9D)
GRAD_A = (0x38, 0xBC, 0xB3)   # 明るめ(+22%)
GRAD_B = (0x00, 0x8B, 0x81)   # 暗め(-18%)
WHITE = (0xFF, 0xFF, 0xFF, 255)


def lerp(a, b, t):
    return a + (b - a) * t


def make_background(size):
    """140deg方向の3点グラデーション(既存アイコンの.iconスタイルと同系統)
    + 柔らかいハイライト/シャドウ(既存の inset box-shadow 相当)を持つ
    角丸スクエアを作る。"""
    img = Image.new("RGB", (size, size))
    px = img.load()

    # CSS の 140deg は「上向き0deg・時計回り」。単位ベクトルに変換。
    angle_rad = math.radians(140)
    dx, dy = math.sin(angle_rad), -math.cos(angle_rad)

    # 対角線上の投影値の範囲を求めて正規化する
    corners = [(0, 0), (size, 0), (0, size), (size, size)]
    projections = [cx * dx + cy * dy for cx, cy in corners]
    pmin, pmax = min(projections), max(projections)

    stops = [(0.0, GRAD_A), (0.55, PRIMARY), (1.0, GRAD_B)]

    def color_at(t):
        t = min(max(t, 0.0), 1.0)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                local_t = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                return tuple(round(lerp(c0[k], c1[k], local_t)) for k in range(3))
        return stops[-1][1]

    # 1px刻みで横帯を作り、繰り返し塗りつぶす(512*4=2048でも十分高速)
    for y in range(size):
        row_colors = []
        for x in range(0, size, 8):
            t = (x * dx + y * dy - pmin) / (pmax - pmin)
            row_colors.append((x, color_at(t)))
        for i, (x, col) in enumerate(row_colors):
            x_end = row_colors[i + 1][0] if i + 1 < len(row_colors) else size
            for xx in range(x, x_end):
                px[xx, y] = col

    return img


def rounded_square_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_round_stroke_line(draw, points, width):
    """折れ線を丸い継ぎ目・丸い端点で描画する(PILのjoint='curve'は内部の
    継ぎ目のみを丸めるため、両端には別途円を足して完全に丸くする)。"""
    draw.line(points, fill=WHITE, width=width, joint="curve")
    r = width / 2
    for (x, y) in (points[0], points[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)


def draw_arrow(draw, cx, cy, span, head_spread, stroke):
    """⇔ を「太い丸端の折れ線3本(左chevron・shaft・右chevron)」として描く。
    Unicodeグリフやフォントには一切依存しない、幾何学形状のみの構成。"""
    half = span / 2
    left_tip = (cx - half, cy)
    left_back_top = (cx - half * 0.42, cy - head_spread)
    left_back_bottom = (cx - half * 0.42, cy + head_spread)
    right_tip = (cx + half, cy)
    right_back_top = (cx + half * 0.42, cy - head_spread)
    right_back_bottom = (cx + half * 0.42, cy + head_spread)

    # shaft(横棒)
    draw_round_stroke_line(draw, [(cx - half * 0.42, cy), (cx + half * 0.42, cy)], stroke)
    # 左向き矢じり(<)
    draw_round_stroke_line(draw, [left_back_top, left_tip, left_back_bottom], stroke)
    # 右向き矢じり(>)
    draw_round_stroke_line(draw, [right_back_top, right_tip, right_back_bottom], stroke)


# Phase M12-H'': 独自Bezier造形の「？」(M12-H')はUser Reviewで「改善後も
# 違和感がある」と判断されたため廃止した。代わりに、一般的なsans-serif fontの
# 「?」glyphをそのまま(変形なし)描画する方式にしている。個性の強いRounded/
# Display系フォントは避け、OSの標準UIフォントであるSegoe UI(Semibold)を使用。
# このフォントファイルはrepositoryへは追加しない(OS同梱フォントを前提とする)。
# 最終的な正式アセットは assets/icons/dotchiga-ii.png そのものであり、
# CUSTOM_ICON_APPS により make-mockups.py からの自動上書きから保護されている
# ため、本スクリプトの実行環境ごとにフォントの厳密なpixel-for-pixel再現性が
# 得られなくても、Production運用上のBlockerにはならない。
_QMARK_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\seguisb.ttf",             # Windows: Segoe UI Semibold
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  # macOS fallback
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux fallback
]


def _find_qmark_font():
    for path in _QMARK_FONT_CANDIDATES:
        if Path(path).exists():
            return path
    raise RuntimeError(
        "「？」の描画に使える標準sans-serifフォントが見つかりません。"
        "generate-dotchiga-icon.py の _QMARK_FONT_CANDIDATES に、"
        "このマシンで利用可能なフォントのパスを追加してください。"
    )


def draw_question_mark(draw, cx, top_y, target_height):
    """一般的なsans-serif fontの「?」glyphを、回転・変形・アウトライン加工
    なしでそのまま描画する。cx: 水平中央。top_y: グリフ上端。
    target_height: グリフの高さ(この高さに収まるようfont sizeを自動調整)。"""
    font_path = _find_qmark_font()
    lo, hi = 10, 2000
    font, bbox = None, None
    for _ in range(24):
        mid = (lo + hi) // 2
        candidate = ImageFont.truetype(font_path, mid)
        candidate_bbox = draw.textbbox((0, 0), "?", font=candidate)
        if candidate_bbox[3] - candidate_bbox[1] < target_height:
            lo = mid
            font, bbox = candidate, candidate_bbox
        else:
            hi = mid

    glyph_w = bbox[2] - bbox[0]
    x = cx - glyph_w / 2 - bbox[0]
    y = top_y - bbox[1]
    draw.text((x, y), "?", font=font, fill=WHITE)


def build():
    bg = make_background(C)
    mask = rounded_square_mask(C, int(118 / S * C))

    glyph_layer = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glyph_layer)

    scale = SS

    # "？"(上): 水平中心・上端・全体の高さから自動配置(標準fontのglyphを使用)
    draw_question_mark(
        gdraw,
        cx=256 * scale,
        top_y=108 * scale,
        target_height=190 * scale,
    )

    # "⇔"(下): ？よりもひとまわり大きく・画面の主役として配置
    draw_arrow(
        gdraw,
        cx=256 * scale,
        cy=372 * scale,
        span=336 * scale,
        head_spread=64 * scale,
        stroke=46 * scale,
    )

    # ソフトなドロップシャドウ(黒・低不透明度・ぼかし)を先に敷いてから
    # 白グリフを重ね、既存アイコンのtext-shadowと同系統の立体感を出す
    shadow = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    shadow_alpha = glyph_layer.split()[3].point(lambda a: int(a * 0.30))
    shadow.paste((0, 0, 0, 255), mask=shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14 * scale / 4))
    shadow_offset = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    shadow_offset.paste(shadow, (0, int(10 * scale)), shadow)

    base = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    base.paste(bg, (0, 0))
    base.putalpha(mask)

    # 上部ハイライト(斜め上からの光)/ 下部の軽いシェード
    highlight = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.ellipse([-C * 0.2, -C * 0.55, C * 1.1, C * 0.55], fill=(255, 255, 255, 70))
    highlight = highlight.filter(ImageFilter.GaussianBlur(40 * scale / 4))
    highlight.putalpha(Image.composite(highlight.split()[3], Image.new("L", (C, C), 0), mask))

    shade_layer = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shade_layer)
    sdraw.ellipse([-C * 0.2, C * 0.55, C * 1.1, C * 1.55], fill=(0, 0, 0, 35))
    shade_layer = shade_layer.filter(ImageFilter.GaussianBlur(40 * scale / 4))
    shade_layer.putalpha(Image.composite(shade_layer.split()[3], Image.new("L", (C, C), 0), mask))

    out = Image.alpha_composite(base, highlight)
    out = Image.alpha_composite(out, shade_layer)
    out = Image.alpha_composite(out, shadow_offset)
    out = Image.alpha_composite(out, glyph_layer)

    out = out.resize((S, S), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT)
    print(f"saved: {OUT} ({out.size[0]}x{out.size[1]}, mode={out.mode})")


if __name__ == "__main__":
    build()
