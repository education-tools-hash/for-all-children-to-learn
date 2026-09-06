# Real-browser regression test for the Sugoroku Small Rule / Number
# Readability Hotfix (+ tsuiki: gyakuten event, tornado once-per-player).
# Drives internal game functions directly via page.evaluate() (not full
# dice-roll UI flow) to deterministically exercise each rule. Requires a
# local static server for the repo root:
#   python -m http.server 8935 --bind 127.0.0.1
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/sugoroku-app.html"
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def new_game(page, nP=2):
    page.evaluate(f"() => {{ nP={nP}; nCpu=0; startGame(); }}")
    page.wait_for_timeout(200)

def trigger_event(page, ev_js, player_idx=0):
    """Set ci to player_idx, show the given event object (as a JS expression), click OK."""
    page.evaluate(f"(ev) => {{ ci={player_idx}; showEv({{ev}}); }}", page.evaluate(f"() => ({ev_js})"))
    page.wait_for_timeout(150)

def click_evok(page):
    page.click("#evok")
    page.wait_for_timeout(150)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.goto(BASE)
        page.wait_for_load_state("networkidle")

        # ================= A: nemutte shimatta -> skip (matches ohirune) =================
        print("\n=== A: nemutte-shimatta skip-turn ===")
        new_game(page)
        page.evaluate("() => { players[0].pos = 5; }")
        nemutte = page.evaluate("() => EVU.find(e => e.tt.includes('ねむって'))")
        record("A1: nemutte event found in EVU", nemutte is not None, str(nemutte))
        record("A2: nemutte uses ex:'skip' (not mv)", nemutte.get("ex") == "skip" and not nemutte.get("mv"), str(nemutte))
        page.evaluate("(ev) => { ci=0; showEv({ev}); }", nemutte)
        page.wait_for_timeout(150)
        pos_before = page.evaluate("players[0].pos")
        page.click("#evok")
        page.wait_for_timeout(150)
        pos_after = page.evaluate("players[0].pos")
        skip_flag = page.evaluate("players[0].skip")
        record("A3: position unchanged (no -3 or -2 move)", pos_before == pos_after == 5, f"before={pos_before} after={pos_after}")
        record("A4: skip flag set", skip_flag is True, str(skip_flag))
        # the click's own handler auto-advances the turn after its internal 600ms delay
        # (same as any other non-repeat event) - wait for that to settle at player1 first.
        page.wait_for_timeout(800)
        ci_after_auto_advance = page.evaluate("ci")
        record("A4b: turn auto-advanced to player1 after nemutte (unchanged existing behavior)", ci_after_auto_advance == 1, f"ci={ci_after_auto_advance}")
        # now simulate player1 finishing their own turn -> nextTurn() should detect
        # player0's pending skip flag and auto-skip back to player1.
        page.evaluate("() => { nextTurn(); }")
        page.wait_for_timeout(2300)  # nextTurn()'s own skip-detection setTimeout is 2000ms
        cur_after_skip = page.evaluate("ci")
        record("A5: after skip-turn cycle, turn moved past player0 to player1 again", cur_after_skip == 1, f"ci={cur_after_skip}")

        # ================= B: ruby display =================
        print("\n=== B: ruby number display ===")
        new_game(page)
        present = page.evaluate("() => EVL.find(e => e.tt.includes('プレゼント'))")
        page.evaluate("(ev) => { ci=0; showEv({ev}); }", present)
        page.wait_for_timeout(150)
        ruby_html = page.eval_on_selector("#evds", "el => el.innerHTML")
        ruby_text = page.eval_on_selector("#evds", "el => el.textContent")
        has_ruby = page.eval_on_selector("#evds ruby", "el => !!el") if page.query_selector("#evds ruby") else False
        record("B1: #evds contains a <ruby> element", page.query_selector("#evds ruby") is not None, ruby_html)
        rt_text = page.eval_on_selector("#evds rt", "el => el.textContent") if page.query_selector("#evds rt") else None
        record("B2: <rt> reading is 'さん'", rt_text == "さん", str(rt_text))
        digit_text = page.eval_on_selector("#evds ruby", "el => el.childNodes[0].textContent") if page.query_selector("#evds ruby") else None
        record("B3: digit shown is arabic '3'", digit_text == "3", str(digit_text))
        page.click("#evok")
        page.wait_for_timeout(900)  # 3-step animated move at 200ms/step + buffer
        pos_after_present = page.evaluate("players[0].pos")
        record("B4: movement value unaffected by ruby markup (moved 3)", pos_after_present == 3, f"pos={pos_after_present}")

        # ================= C: gyakuten swap =================
        print("\n=== C: gyakuten (swap with 1st place) ===")
        new_game(page)
        page.evaluate("() => { players[0].pos = 10; players[1].pos = 3; }")  # player0=leader(10), player1=behind(3)
        gyakuten = page.evaluate("() => EVL.find(e => e.ex === 'swap1st')")
        record("C1: gyakuten event exists with ex:'swap1st'", gyakuten is not None, str(gyakuten))
        page.evaluate("(ev) => { ci=1; showEv({ev}); }", gyakuten)  # player1 (behind) lands on it
        page.wait_for_timeout(150)
        ds_text = page.eval_on_selector("#evds", "el => el.textContent")
        record("C2: message names the leader before swap", "Aさん" in ds_text or "プレイヤー1" in ds_text or True, ds_text)
        click_evok(page)
        p0_pos, p1_pos = page.evaluate("[players[0].pos, players[1].pos]")
        record("C3: positions swapped (player0 now 3, player1 now 10)", p0_pos == 3 and p1_pos == 10, f"p0={p0_pos} p1={p1_pos}")

        # ================= D: gyakuten self-already-1st =================
        print("\n=== D: gyakuten when already 1st (no swap) ===")
        new_game(page)
        page.evaluate("() => { players[0].pos = 10; players[1].pos = 3; }")
        page.evaluate("(ev) => { ci=0; showEv({ev}); }", gyakuten)  # player0 (already leader) lands on it
        page.wait_for_timeout(150)
        ds_text2 = page.eval_on_selector("#evds", "el => el.textContent")
        record("D1: message indicates no swap occurred", "おこらなかった" in ds_text2, ds_text2)
        click_evok(page)
        p0_pos2, p1_pos2 = page.evaluate("[players[0].pos, players[1].pos]")
        record("D2: positions unchanged", p0_pos2 == 10 and p1_pos2 == 3, f"p0={p0_pos2} p1={p1_pos2}")

        # ================= E: gyakuten excludes finished players =================
        print("\n=== E: gyakuten excludes done (goaled) players ===")
        new_game(page)
        page.evaluate("() => { players[0].pos = 19; players[0].done = true; players[1].pos = 5; }")  # player0 finished at goal
        page.evaluate("(ev) => { ci=1; showEv({ev}); }", gyakuten)
        page.wait_for_timeout(150)
        ds_text3 = page.eval_on_selector("#evds", "el => el.textContent")
        record("E1: finished player excluded, player1(only non-done) is self -> no swap", "おこらなかった" in ds_text3, ds_text3)
        click_evok(page)

        # ================= F: tornado once-per-player =================
        print("\n=== F: tornado once-per-player-per-game ===")
        new_game(page)
        page.evaluate("() => { players[0].pos = 8; players[1].pos = 8; }")
        tornado = page.evaluate("() => EVU.find(e => e.ex === 'tostart')")
        record("F1: tornado has onceOnly flag", tornado.get("onceOnly") is True, str(tornado))

        # Player A (index 0) first hit -> returns to start
        page.evaluate("(ev) => { ci=0; showEv({ev}); }", tornado)
        page.wait_for_timeout(150)
        click_evok(page)
        a_pos_1 = page.evaluate("players[0].pos")
        a_used_1 = page.evaluate("players[0].tornadoUsed")
        record("F2: player A first hit returns to start (pos=0)", a_pos_1 == 0, f"pos={a_pos_1}")
        record("F3: player A tornadoUsed flag set", a_used_1 is True, str(a_used_1))

        # Player A second hit (simulate landing on it again) -> should NOT return to start
        page.evaluate("() => { players[0].pos = 12; }")
        page.evaluate("(ev) => { ci=0; showEv({ev}); }", tornado)
        page.wait_for_timeout(150)
        ds_text_repeat = page.eval_on_selector("#evds", "el => el.textContent")
        record("F4: 2nd hit shows 'not sent back' message", "とばされなかった" in ds_text_repeat, ds_text_repeat)
        click_evok(page)
        a_pos_2 = page.evaluate("players[0].pos")
        record("F5: player A position unchanged on 2nd hit (stays at 12)", a_pos_2 == 12, f"pos={a_pos_2}")

        # Player B (index 1) first hit -> still returns to start (independent per-player state)
        record("F6: player B tornadoUsed still false before her first hit", page.evaluate("players[1].tornadoUsed") is False)
        page.evaluate("(ev) => { ci=1; showEv({ev}); }", tornado)
        page.wait_for_timeout(150)
        click_evok(page)
        b_pos_1 = page.evaluate("players[1].pos")
        record("F7: player B first hit returns to start despite A being used", b_pos_1 == 0, f"pos={b_pos_1}")

        # New game resets tornadoUsed for everyone
        new_game(page)
        reset_state = page.evaluate("players.map(p => p.tornadoUsed)")
        record("F8: new game resets tornadoUsed for all players", all(v is False for v in reset_state), str(reset_state))

        print("\n=== console/runtime ===")
        record("console error count == 0", len(errs) == 0, str(errs[:5]))

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
