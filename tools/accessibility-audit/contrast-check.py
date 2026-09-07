# ACCESSIBILITY-AUDIT-PREP-2: Contrast Gate自動判定tool。
# Production dependencyを一切追加しない(axe-core等の外部ライブラリを使わず、
# WCAG 2.x公式のrelative luminance/contrast ratio計算式をそのまま実装する)。
# Read-only: 対象アプリのファイルは一切変更しない。
#
# 使い方(local HTTP serverを別途起動した上で):
#   python -m http.server <port> --bind 127.0.0.1 --directory <repo-root>
#   python tools/accessibility-audit/contrast-check.py <app1> <app2> ... --port <port> --out <output.json>
#
# 判定基準(WCAG 2.1 AA、非テキストUIは1.4.11):
#   - 通常テキスト: 4.5:1以上
#   - 大きいテキスト(24px以上、または19px以上かつbold相当[700以上]): 3:1以上
#   - 非テキストUIコンポーネント境界: 本scriptでは対象外(テキストのみを機械的に走査。
#     UIコンポーネントの境界線コントラストは自動抽出が難しく、Manual Reviewの範囲とする)
#
# 制限事項(Manual確認が必要な理由):
#   - 背景が画像・グラデーション・box-shadowのみで表現されている場合、実効背景色の
#     自動判定は不正確になりうる(直近の非transparent background-colorまで祖先を
#     遡るのみで、背景画像自体は評価しない)。
#   - デザイン上意図的な低コントラスト装飾(非本質的な情報)は本scriptでは区別できない。
#   - 本scriptの判定はあくまでスクリーニングであり、最終適合判断はManualで行うこと
#     (donomana-wcag-jis-audit-plan-v1_0.md §16 Contrast Gateの方針通り)。
import json
import sys
from playwright.sync_api import sync_playwright


def relative_luminance(r, g, b):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast_ratio(rgb1, rgb2):
    l1 = relative_luminance(*rgb1)
    l2 = relative_luminance(*rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


EXTRACT_JS = """
() => {
  function parseColor(str) {
    const m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  function effectiveBackground(el) {
    // Alpha-composite every ancestor's background-color, outermost first, onto a
    // white base - a semi-transparent background-color (e.g. rgba(x,y,z,.08), used
    // for "active" state tints in this codebase) must be blended against what's
    // beneath it, not treated as if it were fully opaque. Taking the first
    // non-zero-alpha color verbatim (an earlier, incorrect version of this function)
    // produced false "identical fg/bg, ratio=1.0" results whenever color:var(--primary)
    // was paired with a low-alpha background of the same hue.
    //
    // unreliable=true when any ancestor in the walked chain has a background-image
    // (gradient or picture) rather than a plain background-color: getComputedStyle
    // only exposes background-color, so a `header{background:linear-gradient(...)}`
    // (background-color stays transparent, the gradient lives in background-image)
    // is invisible to this function - the walk-up falls through to a parent/white
    // fallback and reports a bogus near-white "background" while the real rendered
    // backdrop is the gradient. This produced multiple false "white text on white,
    // ratio~1.0" results in this codebase (okane-app/tokei-app's gradient headers)
    // during Contrast Gate development - real pixel sampling would be needed to
    // handle this correctly, which this lightweight CSS-introspection tool does not
    // attempt. Callers must treat unreliable=true results as Needs Manual Review,
    // not as a pass or fail.
    const layers = [];
    let node = el;
    let unreliable = false;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') unreliable = true;
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      node = node.parentElement;
    }
    layers.reverse(); // outermost (closest to page background) first
    let result = { r: 255, g: 255, b: 255 }; // page background fallback
    for (const layer of layers) {
      result = {
        r: layer.a * layer.r + (1 - layer.a) * result.r,
        g: layer.a * layer.g + (1 - layer.a) * result.g,
        b: layer.a * layer.b + (1 - layer.a) * result.b,
      };
    }
    return { r: result.r, g: result.g, b: result.b, unreliable };
  }
  const SEL = 'button, a, h1, h2, h3, h4, h5, h6, label, [role="button"], .btn, .tool-btn';
  const seen = new Set();
  const results = [];
  document.querySelectorAll(SEL).forEach(el => {
    if (el.offsetParent === null) return; // not visible in default state
    if (el.closest('[aria-hidden="true"]') || el.closest('[inert]')) return;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const key = el.tagName + ':' + text.slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) return;
    const bg = effectiveBackground(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    results.push({
      tag: el.tagName,
      text: text.slice(0, 40),
      fg: [Math.round(fg.r), Math.round(fg.g), Math.round(fg.b)],
      bg: [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)],
      bgUnreliable: bg.unreliable,
      fontSize, fontWeight
    });
  });
  return results;
}
"""


def run(apps, port, out_path):
    base = f"http://127.0.0.1:{port}/"
    report = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for app in apps:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(base + app + ".html", timeout=15000)
            page.wait_for_timeout(400)
            elements = page.evaluate(EXTRACT_JS)
            page.close()

            checks = []
            for el in elements:
                ratio = contrast_ratio(tuple(el["fg"]), tuple(el["bg"]))
                is_large = el["fontSize"] >= 24 or (el["fontSize"] >= 19 and el["fontWeight"] >= 700)
                threshold = 3.0 if is_large else 4.5
                unreliable = el.get("bgUnreliable", False)
                checks.append({
                    "tag": el["tag"], "text": el["text"], "fg": el["fg"], "bg": el["bg"],
                    "fontSize": round(el["fontSize"], 1), "fontWeight": el["fontWeight"],
                    "isLargeText": is_large, "ratio": round(ratio, 2), "threshold": threshold,
                    # unreliable: an ancestor uses background-image (gradient/picture), so
                    # `bg` is a best-effort background-color composite only and may not
                    # reflect the true rendered backdrop - do not treat as pass or fail.
                    "backgroundUnreliable": unreliable,
                    "pass": None if unreliable else ratio >= threshold,
                })
            reliable = [c for c in checks if not c["backgroundUnreliable"]]
            unreliable_checks = [c for c in checks if c["backgroundUnreliable"]]
            fails = [c for c in reliable if not c["pass"]]
            report[app] = {
                "total_checked": len(checks),
                "reliable_checked": len(reliable),
                "needs_manual_review_background": len(unreliable_checks),
                "fail_count": len(fails),
                "failures": fails,
                "needs_manual_review": unreliable_checks,
                "all_checks": checks,
            }
        browser.close()

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("wrote", out_path)
    for app, r in report.items():
        print(f"{app}: {r['reliable_checked']}/{r['total_checked']} reliably checked, "
              f"{r['fail_count']} below threshold, "
              f"{r['needs_manual_review_background']} needs-manual-review (gradient/image background)")


if __name__ == "__main__":
    args = sys.argv[1:]
    port = "8940"
    out = "contrast-results.json"
    apps = []
    i = 0
    while i < len(args):
        if args[i] == "--port":
            port = args[i + 1]; i += 2
        elif args[i] == "--out":
            out = args[i + 1]; i += 2
        else:
            apps.append(args[i]); i += 1
    if not apps:
        print("usage: contrast-check.py <app1> [app2 ...] [--port PORT] [--out FILE]")
        sys.exit(1)
    run(apps, port, out)
