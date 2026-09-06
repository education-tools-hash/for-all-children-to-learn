from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/matching-app.html"
VIEWPORTS = [(375, 667), (390, 844), (768, 1024), (1280, 900)]

def check(page, label):
    scroll_w = page.evaluate("document.documentElement.scrollWidth")
    client_w = page.evaluate("document.documentElement.clientWidth")
    hscroll = scroll_w > client_w + 1
    print(f"{label}: scrollWidth={scroll_w} clientWidth={client_w} horizontalScroll={hscroll}")
    return not hscroll

def main():
    all_ok = True
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, h in VIEWPORTS:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(BASE)
            page.wait_for_load_state("networkidle")
            ok = check(page, f"{w}x{h} baseline")
            all_ok = all_ok and ok

            # open vs-result-ov and check overflow
            page.evaluate("""() => {
                curLevel='easy'; secs=10; moves=4;
                vsPlayers=[{name:'A',color:'p1',score:2},{name:'B',color:'p2',score:1}];
                showVsResult();
            }""")
            ok = check(page, f"{w}x{h} vs-result-ov open")
            all_ok = all_ok and ok
            page.evaluate("document.getElementById('vs-result-ov').classList.remove('show')")

            # open clear-ov and check overflow
            page.evaluate("""() => { curLevel='easy'; secs=10; moves=4; showClear(); }""")
            ok = check(page, f"{w}x{h} clear-ov open")
            all_ok = all_ok and ok

            page.close()

        # 200% zoom check at a representative desktop size
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.evaluate("document.body.style.zoom = '2'")
        ok = check(page, "1280x900 @200% zoom baseline")
        all_ok = all_ok and ok
        page.evaluate("""() => {
            curLevel='easy'; secs=10; moves=4;
            vsPlayers=[{name:'A',color:'p1',score:2},{name:'B',color:'p2',score:1}];
            showVsResult();
        }""")
        ok = check(page, "1280x900 @200% zoom vs-result-ov open")
        all_ok = all_ok and ok
        page.close()

        browser.close()
    print("\nALL OK" if all_ok else "\nSOME FAILED")

if __name__ == "__main__":
    main()
