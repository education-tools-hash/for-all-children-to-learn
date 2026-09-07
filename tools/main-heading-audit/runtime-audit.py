# ACCESSIBILITY-AUDIT-TOOL-HARDEN-1: Layer 2 runtime reachable heading audit.
# Complements (does not replace) tools/main-heading-audit/audit.js (Layer 1,
# static structural audit). Read-only: does not modify any app file.
#
# Root cause this hardens: audit.js counts <h1> occurrences via regex on the
# raw HTML source only. It has zero awareness of runtime state - a h1 sitting
# inside a `display:none` closed modal (tyushi's #help-overlay, TIER1-F1)
# counts identically to one that's actually reachable on page load. This tool
# adds that missing runtime/accessibility-tree-aware layer via Playwright.
#
# Definitions (see docs/accessibility/audit/heading-runtime-audit-summary.md
# §"runtime reachable headingの定義" for the full rationale):
#   - accessibilityReachable: NOT excluded by any of - a `hidden` attribute
#     ancestor, an `aria-hidden="true"` ancestor, an `inert` ancestor,
#     `display:none` (self or ancestor), `visibility:hidden`/`collapse`
#     (self or ancestor). Deliberately does NOT use offsetParent/geometry -
#     a visually-hidden element (position:absolute;width:1px;height:1px;
#     clip:rect(0,0,0,0);...) has none of the above and stays in the
#     accessibility tree, so it must count as reachable even though a human
#     eye can't see it (register-app/schedule-app's static h1 pattern).
#   - runtimeVisible: accessibilityReachable AND has a "real" rendered
#     footprint - offsetParent!==null (exempting position:fixed, which is
#     always offsetParent-null even when visible) AND bounding rect larger
#     than the 1x1 clip-hack footprint. This is a separate, stricter
#     human-eye-visibility signal, not used for the reachable/missing Gate.
#
# Usage:
#   python -m http.server <port> --bind 127.0.0.1 --directory <repo-root>
#   python tools/main-heading-audit/runtime-audit.py --port <port> [--out FILE] [apps...]
#   (no app args = audit all 35 apps from apps-data.json)
import json
import sys
from playwright.sync_api import sync_playwright

REACHABILITY_JS = """
() => {
  function isAccessibilityReachable(el) {
    let node = el;
    while (node) {
      if (node.hasAttribute && node.hasAttribute('hidden')) return false;
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return false;
      if (node.hasAttribute && node.hasAttribute('inert')) return false;
      const cs = getComputedStyle(node);
      if (cs.display === 'none') return false;
      if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      node = node.parentElement;
    }
    return true;
  }
  function isRuntimeVisible(el, reachable) {
    if (!reachable) return false;
    const cs = getComputedStyle(el);
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) return false;
    return true;
  }
  return Array.from(document.querySelectorAll('h1')).map(el => {
    const reachable = isAccessibilityReachable(el);
    return {
      text: (el.textContent || '').trim().slice(0, 60),
      accessibilityReachable: reachable,
      runtimeVisible: isRuntimeVisible(el, reachable),
    };
  });
}
"""


def audit_apps(apps, port, out_path):
    base = f"http://127.0.0.1:{port}/"
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for app in apps:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            entry = {"h1s": [], "error": None}
            try:
                page.goto(base + app + ".html", timeout=15000)
                page.wait_for_timeout(350)
                entry["h1s"] = page.evaluate(REACHABILITY_JS)
            except Exception as e:
                entry["error"] = str(e)
            page.close()
            reachable = [h for h in entry["h1s"] if h["accessibilityReachable"]]
            visible = [h for h in entry["h1s"] if h["runtimeVisible"]]
            entry["staticH1Count"] = len(entry["h1s"])
            entry["accessibilityReachableCount"] = len(reachable)
            entry["runtimeVisibleCount"] = len(visible)
            results[app] = entry
        browser.close()

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total = len(results)
    reachable_missing = sum(1 for r in results.values() if r["accessibilityReachableCount"] == 0)
    reachable_excess = sum(1 for r in results.values() if r["accessibilityReachableCount"] > 1)
    static_missing = sum(1 for r in results.values() if r["staticH1Count"] == 0)
    static_excess = sum(1 for r in results.values() if r["staticH1Count"] > 1)
    print(f"Total apps: {total}")
    print(f"static h1 missing: {static_missing} / static h1 excess: {static_excess}")
    print(f"accessibility-reachable h1 missing: {reachable_missing} / excess: {reachable_excess}")
    print(f"wrote {out_path}")
    for app, r in results.items():
        flag = "" if r["staticH1Count"] == r["accessibilityReachableCount"] else "  <-- static/reachable MISMATCH"
        print(f"  {app}: static={r['staticH1Count']} reachable={r['accessibilityReachableCount']} visible={r['runtimeVisibleCount']}{flag}")
    return results


if __name__ == "__main__":
    args = sys.argv[1:]
    port = "8952"
    out = "tools/main-heading-audit/runtime-results.json"
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
        with open("apps-data.json", encoding="utf-8") as f:
            apps = [a["filename"] for a in json.load(f)]
    audit_apps(apps, port, out)
