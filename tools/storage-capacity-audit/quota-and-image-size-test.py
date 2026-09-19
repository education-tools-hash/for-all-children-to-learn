import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

# LEARNING-RECORD-STORAGE-CAPACITY-AUDIT-1 — real-browser measurement, DISPOSABLE ORIGIN ONLY.
#
# Safety guards (do not remove):
#   - Only ever navigates to http://127.0.0.1:<AUDIT_PORT>/ (a throwaway local static
#     server serving a blank in-memory page string via page.set_content, not any file
#     from the repo). It NEVER navigates to donomana.jp or any real deployed origin.
#   - Uses a brand-new incognito BrowserContext, discarded at the end of the script.
#   - Only ever calls localStorage on that disposable origin; clears it before exiting.

AUDIT_PORT = 8971  # dedicated port for this disposable audit origin, distinct from other tooling's 8899

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{AUDIT_PORT}/blank.html")
    origin = page.evaluate("() => location.origin")
    print("origin under test (must NOT be donomana.jp):", origin)
    assert "donomana" not in origin, "SAFETY ABORT: refusing to run quota test against a real site origin"
    assert origin == f"http://127.0.0.1:{AUDIT_PORT}", "SAFETY ABORT: unexpected origin"

    # ---------------------------------------------------------------
    # Part 1: realistic nazori-style PNG size via actual canvas drawing
    # ---------------------------------------------------------------
    img_sizes = page.evaluate("""() => {
        function drawStrokes(ctx, w, h, seed) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#2255cc';
            let rnd = seed;
            const next = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
            // Simulate ~3 strokes of a traced character: each stroke a wobbly curve.
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                let x = 20 + next() * (w - 40), y = 20 + next() * (h - 40);
                ctx.moveTo(x, y);
                for (let i = 0; i < 18; i++) {
                    x += (next() - 0.5) * (w / 6);
                    y += (next() - 0.5) * (h / 6);
                    x = Math.max(5, Math.min(w - 5, x));
                    y = Math.max(5, Math.min(h - 5, y));
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
        // Single-cell (one character), matches nazori-app.html default cellSize=300
        const c1 = document.createElement('canvas'); c1.width = 300; c1.height = 300;
        drawStrokes(c1.getContext('2d'), 300, 300, 7);
        const oneCell = c1.toDataURL('image/png');

        // 5-cell "continuous writing" mode (merged.width = cs*draws.length)
        const c5 = document.createElement('canvas'); c5.width = 1500; c5.height = 300;
        const ctx5 = c5.getContext('2d');
        ctx5.fillStyle = '#ffffff'; ctx5.fillRect(0, 0, 1500, 300);
        for (let cell = 0; cell < 5; cell++) {
            ctx5.save();
            ctx5.translate(cell * 300, 0);
            drawStrokes(ctx5, 300, 300, 11 + cell);
            ctx5.restore();
        }
        const fiveCell = c5.toDataURL('image/png');

        // Nearly-blank canvas (child drew almost nothing) — best case
        const c0 = document.createElement('canvas'); c0.width = 300; c0.height = 300;
        const ctx0 = c0.getContext('2d');
        ctx0.fillStyle = '#ffffff'; ctx0.fillRect(0, 0, 300, 300);
        const blank = c0.toDataURL('image/png');

        return {
            oneCellDataUrlLen: oneCell.length,
            oneCellBase64Len: oneCell.split(',')[1].length,
            fiveCellDataUrlLen: fiveCell.length,
            fiveCellBase64Len: fiveCell.split(',')[1].length,
            blankDataUrlLen: blank.length,
        };
    }""")
    print("\n--- Nazori realistic PNG dataURL sizes (browser-measured, toDataURL('image/png')) ---")
    for k, v in img_sizes.items():
        print(f"{k}: {v} chars (~{v} bytes as UTF-8, since base64/dataURL is ASCII)")

    # ---------------------------------------------------------------
    # Part 2: navigator.storage.estimate() baseline on this disposable origin
    # ---------------------------------------------------------------
    estimate_before = page.evaluate("""async () => {
        if (!navigator.storage || !navigator.storage.estimate) return null;
        const e = await navigator.storage.estimate();
        return { quota: e.quota, usage: e.usage };
    }""")
    print("\n--- navigator.storage.estimate() before quota test ---")
    print(estimate_before)

    # ---------------------------------------------------------------
    # Part 3: quota-exhaustion test using the EXACT Production catch pattern
    # (donomanaRecordWriteLog: try { localStorage.setItem(...) } catch (e) {})
    # to confirm what happens to the caller when the write silently fails.
    # ---------------------------------------------------------------
    quota_result = page.evaluate("""() => {
        function donomanaRecordWriteLog(storageKey, log) {
            try { localStorage.setItem(storageKey, JSON.stringify(log)); return { threw: false }; }
            catch (e) { return { threw: true, name: e.name, message: String(e.message).slice(0,200) }; }
        }
        const KEY = 'audit_quota_probe';
        try { localStorage.removeItem(KEY); } catch (e) {}
        const chunk = 'A'.repeat(1024 * 256); // 256KB chunks
        let written = 0;
        let chunks = 0;
        let lastResult = null;
        let firstThrowChunk = null;
        const MAX_CHUNKS = 400; // safety bound: 400*256KB = 100MB ceiling, well below any realistic browser quota loop hang
        for (let i = 0; i < MAX_CHUNKS; i++) {
            const value = chunk.repeat(1) + i; // vary slightly so string isn't trivially deduped
            const r = donomanaRecordWriteLog(KEY, value);
            lastResult = r;
            chunks++;
            if (r.threw) { firstThrowChunk = i; break; }
            written = value.length;
        }
        const stillThere = localStorage.getItem(KEY);
        const survivedBytes = stillThere ? stillThere.length : 0;
        try { localStorage.removeItem(KEY); } catch (e) {}
        return { chunks, lastResult, firstThrowChunk, lastSuccessfulValueLen: written, survivedBytesAfterFailedWrite: survivedBytes };
    }""")
    print("\n--- localStorage quota-exhaustion probe (single key, growing by 256KB steps, using Production's exact catch pattern) ---")
    print(quota_result)

    estimate_after = page.evaluate("""async () => {
        if (!navigator.storage || !navigator.storage.estimate) return null;
        const e = await navigator.storage.estimate();
        return { quota: e.quota, usage: e.usage };
    }""")
    print("\n--- navigator.storage.estimate() after quota test (should be back near baseline; probe key was removed) ---")
    print(estimate_after)

    # ---------------------------------------------------------------
    # Part 4: does a QuotaExceededError on ONE key affect the ability to write a
    # DIFFERENT, smaller key afterwards? (i.e. is the origin now permanently wedged,
    # or does freeing space via removeItem restore normal writes?)
    # ---------------------------------------------------------------
    recovery = page.evaluate("""() => {
        try {
            localStorage.setItem('audit_recovery_probe', JSON.stringify({ ok: true, n: 1 }));
            const back = localStorage.getItem('audit_recovery_probe');
            localStorage.removeItem('audit_recovery_probe');
            return { recoveredWriteOk: back === JSON.stringify({ ok: true, n: 1 }) };
        } catch (e) { return { recoveredWriteOk: false, error: String(e) }; }
    }""")
    print("\n--- Recovery check: can a small write succeed immediately after the quota probe's cleanup? ---")
    print(recovery)

    # Final cleanup of the disposable origin's storage entirely.
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    remaining_keys = page.evaluate("() => Object.keys(localStorage)")
    print("\nlocalStorage keys remaining on disposable origin after cleanup (should be empty):", remaining_keys)

    browser.close()
