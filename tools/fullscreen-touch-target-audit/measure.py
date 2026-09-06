# Measurement-only script (AUDIT-35-FIX-1F): real getBoundingClientRect() for
# every app that shares the literal #fs-btn id (a hand-copied pattern found
# identically in 5 apps - no single generate.js Source of Truth controls it).
# Read-only; does not modify any app HTML.
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
APPS = ["hiragana-learn", "katakana-app", "timetable-app", "matching-app", "suji-manabou"]
VIEWPORTS = [(320, 568), (375, 667), (390, 844), (768, 1024), (1024, 768), (1280, 900)]

def measure(page, appname, label, zoom=1):
    info = page.evaluate("""() => {
        const el = document.getElementById('fs-btn');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // also inspect the actual clickable children (icon/label spans) to see if
        // the visual row is taller/shorter than the button's own box
        const spans = Array.from(el.querySelectorAll('span')).map(s => {
            const sr = s.getBoundingClientRect();
            return {id: s.id, w: sr.width, h: sr.height};
        });
        return {
            width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom,
            paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
            minWidth: cs.minWidth, minHeight: cs.minHeight, fontSize: cs.fontSize,
            spans,
        };
    }""")
    if info:
        print(f"{appname:16s} {label:16s} w={info['width']:.1f} h={info['height']:.1f} pad=({info['paddingTop']},{info['paddingRight']},{info['paddingBottom']},{info['paddingLeft']}) min=({info['minWidth']},{info['minHeight']}) spans={info['spans']}")
    else:
        print(f"{appname:16s} {label:16s} #fs-btn NOT FOUND")
    return info

def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for appname in APPS:
            results[appname] = []
            for w, h in VIEWPORTS:
                page = browser.new_page(viewport={"width": w, "height": h})
                page.goto(BASE + appname + ".html", timeout=20000)
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    page.wait_for_timeout(1000)
                info = measure(page, appname, f"{w}x{h}")
                results[appname].append({"viewport": f"{w}x{h}", "info": info})
                page.close()
            # 200% zoom at a mobile + desktop size
            for w, h in [(390, 844), (1280, 900)]:
                page = browser.new_page(viewport={"width": w, "height": h})
                page.goto(BASE + appname + ".html", timeout=20000)
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    page.wait_for_timeout(1000)
                page.evaluate("document.body.style.zoom = '2'")
                info = measure(page, appname, f"{w}x{h}@200%", zoom=2)
                results[appname].append({"viewport": f"{w}x{h}@200%", "info": info})
                page.close()
        browser.close()

    print("\n=== SUMMARY: min height/width observed per app ===")
    for appname, rows in results.items():
        heights = [r["info"]["height"] for r in rows if r["info"]]
        widths = [r["info"]["width"] for r in rows if r["info"]]
        print(f"{appname:16s} min height={min(heights):.1f} min width={min(widths):.1f} (44px violation: height={min(heights) < 44})")

    with open("tools/fullscreen-touch-target-audit/measure_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
