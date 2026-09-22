#!/usr/bin/env python
"""Phase T8-B2 — Real-browser regression test for learning-records.html
("学習のきろく").

Drives the ACTUAL learning-records.html (Local RC, feature branch only) via
Playwright (the same Chromium install used by tools/make-mockups.py and
tools/tracing-poc/test-*-realbrowser.py — no new browser dependency). This
covers everything that a Node-only test cannot: real DOM rendering, XSS
non-execution, personal-data absence in rendered text, corrupted-storage
isolation, read-only proof (localStorage before/after), keyboard focus trap,
responsive viewport overflow, and console/page error counts.

This does not modify learning-records.html or the 21 app files; it only
reads/interacts with them via a real browser.

Usage: python tools/record-dashboard-poc/dashboard-realbrowser-test.py
"""
import json
import pathlib
import sys
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent
PAGE_PATH = REPO_ROOT / "learning-records.html"
PAGE_URL = PAGE_PATH.as_uri()
CSV_OUT_DIR = HERE / "dashboard-realbrowser-artifacts"
CSV_OUT_DIR.mkdir(exist_ok=True)

PASS = 0
FAIL = 0


def check(label, condition, detail=None):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [OK  ] {label}" + (f" — {detail}" if detail is not None else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail is not None else ""))


# 21 Foundation apps: storageKey + structure, copied from the Adapter Registry
# in assets/js/record-dashboard-foundation.js (source of truth). Kept as a
# local mirror here (test-only) rather than exported from the Foundation
# module's public API, per the design doc's "minimal API surface" principle.
STORAGE_MAP = {
    'janken-app': ('janken_log', 'flat'),
    'register-app': ('register_log', 'flat'),
    'tokei-app': ('tokei_log', 'flat'),
    'matching-app': ('matching_log', 'flat'),
    'shiritori2': ('shiritori2_log', 'flat'),
    'directions-app': ('appLogs', 'flat'),
    'hiragana-learn': ('hiragana_log', 'flat'),
    'katakana-app': ('katakana_log', 'flat'),
    'suji-manabou': ('suji_log', 'flat'),
    'mitsukete-touch-app': ('mitsukete_touch_log', 'flat'),
    'junban-miyou-app': ('junban_miyou_log', 'flat'),
    'kurabeyou-app': ('kurabeyou_log', 'flat'),
    'katachi-awase-app': ('katachi_log', 'flat'),
    'dotchiga-ii-app': ('dotchiga_ii_log', 'flat'),
    'miru-hirogaru-app': ('miru_hirogaru_log', 'flat'),
    'okane-app': ('okane_activity_log', 'flat'),
    'sst-app': ('sst_activity_log_v1', 'flat'),
    'mogura-tataki': ('mogura_v3', 'flat'),
    'nazori-app': ('nazori_records', 'flat'),
    'bosai-app': ('bosai_log', 'flat'),
    'kyou-no-kiroku': ('kyounokiroku', 'nested'),
}

# Mirrors tools/record-dashboard-poc/fixtures.js GOLDEN (one real-shape entry
# per app). Kept in sync manually; both files draw from the same production
# schemas documented in the design doc §3.
GOLDEN = {
    'janken-app': {"timestamp": "2026-09-01T10:00:00.000Z", "appId": "janken-app", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                   "payload": {"mode": "win", "total": 3, "correct": 2, "mistakes": [{"question": "グーに かつのは どれ？", "selected": "チョキ", "correct": "パー"}]}},
    'register-app': {"timestamp": "2026-09-01T11:00:00.000Z", "appId": "register-app", "activity": "checkout", "inputMethod": None, "schemaVersion": 1,
                      "payload": {"itemCount": 3, "totalAmount": 650, "paymentReceived": 1000, "change": 350, "items": [{"name": "クッキー", "quantity": 3, "unitPrice": 100, "subtotal": 300}]}},
    'tokei-app': {"timestamp": "2026-09-01T09:00:00.000Z", "appId": "tokei-app", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                  "payload": {"difficulty": "normal", "mode": "quiz", "total": 5, "correct": 4, "retried": 1, "avgTimeSec": 3.2, "durationSec": 40}},
    'matching-app': {"timestamp": "2026-09-01T08:00:00.000Z", "appId": "matching-app", "activity": "match-solo", "inputMethod": None, "schemaVersion": 1,
                      "payload": {"mode": "match-solo", "level": 2, "pairs": 6, "moves": 14, "durationSec": 55}},
    'shiritori2': {"timestamp": "2026-09-01T07:00:00.000Z", "appId": "shiritori2", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                    "payload": {"mode": "quiz", "total": 8, "correct": 7, "score": 700, "maxStreak": 5, "chainLength": 8, "durationSec": 90}},
    'directions-app': {"ts": "2026-09-01T06:00:00.000Z", "category": "quiz", "question": "みぎに すすんで", "userAnswer": "みぎ", "correctAnswer": "みぎ", "result": "correct", "schemaVersion": 1},
    'hiragana-learn': {"time": "2026-09-01T05:00:00.000Z", "type": "trace", "data": {"kana": "あ", "traceSample": None}, "schemaVersion": 1},
    'katakana-app': {"time": "2026-09-01T05:10:00.000Z", "type": "quiz", "data": {"kana": "ア", "correct": True}, "schemaVersion": 1},
    'suji-manabou': {"time": "2026-09-01T05:20:00.000Z", "type": "trace", "data": {"num": "3"}, "schemaVersion": 1},
    'mitsukete-touch-app': {"time": "2026-09-01T04:00:00.000Z", "level": 2, "selectedPosition": "left", "itemRole": "target", "inputMethod": "gaze", "responseTime": 1200, "dwellDuration": 800, "trial": 1},
    'junban-miyou-app': {"time": "2026-09-01T03:00:00.000Z", "level": 1, "passenger": "いぬ", "sequenceIndex": 2, "sequenceLength": 4, "inputMethod": "switch", "responseTime": 900, "trialIndex": 1},
    'kurabeyou-app': {"time": "2026-09-01T02:00:00.000Z", "concept": "size", "level": 3, "correct": True, "mistakeSelections": [], "responseTimeMs": 1500, "inputMethod": None},
    'katachi-awase-app': {"time": "2026-09-01T01:00:00.000Z", "concept": "shape", "level": 1, "shape": "circle", "correct": True, "mistakes": 0, "inputMethod": "unknown"},
    'dotchiga-ii-app': {"date": "2026-09-01", "time": "2026-09-01T00:00:00.000Z", "activity": "preference", "category": "food", "pair": "apple-vs-banana", "selectedChoice": "apple", "selectedLabel": "りんご", "inputMethod": "gaze", "trialIndex": 1, "trialTotal": 5, "dwellDuration": 700},
    'miru-hirogaru-app': {"time": "2026-08-31T23:00:00.000Z", "level": 1, "target": "ひかる おもちゃ", "inputMethod": "switch", "responseTime": 500, "dwellDuration": 300, "activationCount": 3},
    'okane-app': {"ts": "2026-08-31T22:00:00.000Z", "type": "shop", "detail": "￥650のおかいもの（おつり ￥350）", "schemaVersion": 1},
    'sst-app': {"ts": 1798000000000, "type": "rp", "lv": 2, "result": "done", "schemaVersion": 1},
    'mogura-tataki': {"date": "2026/8/31 21:00:00", "score": 120, "hits": 12, "misses": 3, "rate": 80, "combo": 4, "diff": "normal", "mode": "time", "schemaVersion": 1},
    'nazori-app': {"id": "n1", "timestamp": "2026-08-31T20:00:00.000Z", "allChars": "あいうえお", "mode": "wide", "sessionDone": 4, "sessionTotal": 5, "durationMin": 3, "isComplete": False, "image": None},
    'bosai-app': {"id": "b1", "kind": "quiz", "name": "たろう", "simType": "earthquake", "correct": 4, "total": 5, "score": 80, "timestamp": "2026-08-31T19:00:00.000Z", "log": []},
    'kyou-no-kiroku': {"id": "r1", "childIndex": 0, "childName": "はなこ", "date": "2026-08-31T18:00:00.000Z", "memo": "", "schemaVersion": 1},
}

PERSONAL_DATA_MARKERS = ["たろう", "クッキー", "あいうえお", "はなこ"]  # たろう/クッキー/あいうえお/はなこ


def set_fixture_storage(page, app_ids, overrides=None):
    """Sets localStorage for the given app_ids using GOLDEN (optionally
    overridden per-app), matching each adapter's actual storageKey/structure."""
    overrides = overrides or {}
    for app_id in app_ids:
        storage_key, structure = STORAGE_MAP[app_id]
        entry = dict(GOLDEN[app_id])
        entry.update(overrides.get(app_id, {}))
        if structure == 'nested':
            value = json.dumps({"children": [], "records": [entry]})
        else:
            value = json.dumps([entry])
        page.evaluate("([k, v]) => localStorage.setItem(k, v)", [storage_key, value])


def clear_all_storage(page):
    page.evaluate("() => localStorage.clear()")


def snapshot_storage(page):
    keys = [v[0] for v in STORAGE_MAP.values()]
    return page.evaluate("(keys) => keys.map(k => [k, localStorage.getItem(k)])", keys)


# Phase T9-B: learning-records.html now carries root-absolute PWA resource
# links (<link rel="manifest" href="/site.webmanifest">,
# <script src="/assets/js/pwa-register.js">) injected by generate.js. Under
# this script's file:// loading (PAGE_URL = PAGE_PATH.as_uri()), an
# absolute "/" path resolves to the filesystem root, not the repo root, so
# both requests fail with a generic "Failed to load resource:
# net::ERR_FILE_NOT_FOUND" console message that carries no URL. This is a
# file://-testing artifact only — on real HTTP serving (donomana.jp, and
# the T9-B tools/pwa-poc/pwa-realbrowser-test.py suite which serves over
# http://127.0.0.1) both resources resolve correctly and that suite's own
# PWA lifecycle tests show zero console errors. We identify the exact
# known-benign failed requests via the `requestfailed` event (which does
# carry the URL) and only then discount one matching generic console
# message per such failure — any other ERR_FILE_NOT_FOUND (a real missing
# asset) still counts as a failure.
_FILE_PROTOCOL_KNOWN_PATHS = ("/site.webmanifest", "/assets/js/pwa-register.js")
_GENERIC_RESOURCE_ERROR_TEXT = "Failed to load resource: net::ERR_FILE_NOT_FOUND"


def new_page(context):
    page = context.new_page()
    errors = {"console_errors": [], "page_errors": []}
    state = {"known_benign_failures": 0}

    def on_request_failed(request):
        if request.url.startswith("file://") and request.url.endswith(_FILE_PROTOCOL_KNOWN_PATHS):
            state["known_benign_failures"] += 1

    def on_console(msg):
        if msg.type != "error":
            return
        if msg.text == _GENERIC_RESOURCE_ERROR_TEXT and state["known_benign_failures"] > 0:
            state["known_benign_failures"] -= 1
            return
        errors["console_errors"].append(msg.text)

    page.on("requestfailed", on_request_failed)
    page.on("console", on_console)
    page.on("pageerror", lambda exc: errors["page_errors"].append(str(exc)))
    return page, errors


def goto_fresh(page):
    page.goto(PAGE_URL)


def gaze_regressions(browser):
    """Gaze retrigger / stale-target regression on real app DOM and handlers.

    Fixed clock and synthetic learning data only; not a Tobii/device gate.
    Existing dashboard harness is reused because accidental gaze activations
    can change the learning records it consumes (notably mogura fumbles).
    """
    def move(page, selector):
        box = page.locator(selector).first.bounding_box()
        assert box, selector
        page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)

    def leave(page):
        page.mouse.move(1, 1)
        page.clock.run_for(32)

    for app in ['mogura-tataki', 'kyou-no-kiroku', 'okane-app']:
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body=''))
        page.goto((REPO_ROOT / (app + '.html')).as_uri())
        page.clock.install()
        if app == 'mogura-tataki':
            page.evaluate("""() => {
                cfg.dwell=true;cfg.dwT=.3;cfg.snd=false;cfg.rm=true;
                document.getElementById('scrStart').classList.remove('on');
                buildBoard();startGame();clearInterval(timerID);clearTimeout(spawnID);
                for(const m of G.moles.values())clearTimeout(m.t);
                G.moles.clear();resetBoard();
                G.moles.set(0,{kind:'normal',t:null});showM(0);
            }""")
            hole = '.hole[data-idx="0"]'
            move(page, hole)
            page.clock.run_for(352)
            check('mogura: real dwell hit removes mole, no fumble', page.evaluate('G.hits===1 && !G.moles.has(0) && G.fumbles===0'))
            # OS-emulated mouse down/click immediately after dwell must not fumble.
            page.mouse.down(); page.mouse.up()
            check('mogura: immediate mouse duplicate ignored', page.evaluate('G.hits===1 && G.fumbles===0'))
            for _ in range(4):
                move(page, hole); page.clock.run_for(1000)
            check('mogura: stationary gaze cannot add fumble', page.evaluate('G.hits===1 && G.fumbles===0'))
            leave(page)
            page.evaluate("G.moles.set(0,{kind:'normal',t:null});showM(0)")
            move(page, hole); page.clock.run_for(352)
            check('mogura: leave/reenter permits next valid hit', page.evaluate('G.hits===2 && G.fumbles===0'))
            for panel in ['panSet', 'panHow', 'panRec', 'donomanaA11yPanel']:
                leave(page); move(page, hole); page.clock.run_for(160)
                if panel == 'donomanaA11yPanel':
                    page.evaluate("document.getElementById('donomanaA11yBtn').click()")
                else:
                    page.evaluate('(id)=>openPanel(id)', panel)
                page.clock.run_for(1500)
                check(f'mogura: {panel} cancels background dwell', page.evaluate('G.hits===2 && G.fumbles===0'))
                check(f'mogura: {panel} clears ring', page.locator(hole+' .dwell-ring circle').evaluate("e=>e.style.strokeDashoffset==='283'"))
                if panel == 'donomanaA11yPanel':
                    page.keyboard.press('Escape')
                else:
                    page.evaluate('(id)=>closePanel(id)', panel)
                page.clock.run_for(160)
                check(f'mogura: {panel} close requires fresh dwell', page.evaluate('G.fumbles===0'))
                leave(page)
            page.evaluate("G.moles.set(0,{kind:'normal',t:null});showM(0)")
            move(page, hole); page.mouse.down(); page.mouse.up(); page.clock.run_for(1000)
            check('mogura: native mouse before dwell fires once', page.evaluate('G.hits===3 && G.fumbles===0'))
            page.evaluate("G.moles.set(0,{kind:'normal',t:null});showM(0)")
            box = page.locator(hole).bounding_box()
            page.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
            page.clock.run_for(1000)
            check('mogura: physical touch simulation has no delayed dwell', page.evaluate('G.hits===4 && G.fumbles===0'))
            page.evaluate("G.moles.set(0,{kind:'normal',t:null});showM(0)")
            page.locator(hole).focus(); page.keyboard.press('Enter')
            check('mogura: keyboard activation preserved', page.evaluate('G.hits===5 && G.fumbles===0'))
            page.evaluate('stopDwell()')
        else:
            kyou = app == 'kyou-no-kiroku'
            setup = 'state.a11y.gaze=true;state.a11y.gazeDwell=300;state.a11y.tts=false;' if kyou else 'appSettings.gaze=true;appSettings.gazeDwell=300;'
            page.evaluate(setup + "startGazePointer();window.gazeTestCount=0;document.querySelector('.nav-btn').addEventListener('click',()=>window.gazeTestCount++)")
            target = '.nav-btn'
            move(page, target); page.clock.run_for(320)
            check(f'{app}: stationary dwell activates once', page.evaluate('gazeTestCount===1'))
            page.mouse.down(); page.mouse.up()
            check(f'{app}: immediate native mouse duplicate ignored', page.evaluate('gazeTestCount===1'))
            for _ in range(4):
                move(page, target); page.clock.run_for(1000)
            check(f'{app}: repeated move/time cannot retrigger', page.evaluate('gazeTestCount===1'))
            page.evaluate("openModal('modalHelp')" if kyou else 'openHelpModal()')
            move(page, target); page.clock.run_for(400)
            page.evaluate("closeModal('modalHelp')" if kyou else 'closeHelpModal()')
            move(page, target); page.clock.run_for(700)
            check(f'{app}: overlay changes do not count as leaving target', page.evaluate('gazeTestCount===1'))
            leave(page); move(page, target); page.clock.run_for(320)
            check(f'{app}: leave/reenter activates again', page.evaluate('gazeTestCount===2'))
            leave(page); move(page, target); page.clock.run_for(120)
            page.evaluate("openModal('modalHelp')" if kyou else 'openHelpModal()')
            page.clock.run_for(1000)
            check(f'{app}: modal invalidates already pending background dwell', page.evaluate('gazeTestCount===2 && gazeCurrentTarget===null && gazeDwellTimer===null'))
            move(page, target); page.clock.run_for(1000)
            check(f'{app}: modal prevents new background dwell', page.evaluate('gazeTestCount===2'))
            page.evaluate("closeModal('modalHelp')" if kyou else 'closeHelpModal()')
            leave(page); move(page, target); page.clock.run_for(320)
            check(f'{app}: modal close restores gaze', page.evaluate('gazeTestCount===3'))
            # Real touch click is allowed even immediately after gaze.
            box = page.locator(target).first.bounding_box()
            page.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
            page.clock.run_for(1000)
            check(f'{app}: touch remains native, no delayed duplicate', page.evaluate('gazeTestCount===4'))
            page.locator(target).first.focus(); page.keyboard.press('Enter')
            check(f'{app}: keyboard remains native', page.evaluate('gazeTestCount===5'))
            leave(page); move(page, target); page.clock.run_for(120)
            page.mouse.down(); page.mouse.up(); page.clock.run_for(1000)
            check(f'{app}: mouse before dwell cancels pending activation', page.evaluate('gazeTestCount===6'))
            leave(page); move(page, target); page.clock.run_for(120)
            page.evaluate('stopGazePointer()'); page.clock.run_for(1000)
            check(f'{app}: disabling gaze cancels pending activation', page.evaluate('gazeTestCount===6'))
            if not kyou:
                page.evaluate("openSettingsModal();startGazePointer();window.toggleCount=0;document.getElementById('speechToggle').addEventListener('change',()=>window.toggleCount++)")
                toggle = 'label.toggle-switch:has(#speechToggle)'
                move(page, toggle); page.clock.run_for(320)
                for _ in range(3):
                    move(page, toggle); page.clock.run_for(600)
                check('okane: toggle stays selected without repeated ON/OFF', page.evaluate('toggleCount===1'))
                leave(page); move(page, toggle); page.clock.run_for(320)
                check('okane: toggle rearms after leave/reenter', page.evaluate('toggleCount===2'))
                gaze_toggle = 'label.toggle-switch:has(#gazeToggle)'
                page.locator(gaze_toggle).scroll_into_view_if_needed()
                leave(page); move(page, gaze_toggle); page.clock.run_for(320)
                check('okane: gaze can turn itself off by dwell', page.evaluate('!appSettings.gaze'))
                page.mouse.down(); page.mouse.up()
                check('okane: mouse duplicate cannot turn gaze back on', page.evaluate('!appSettings.gaze'))
                page.evaluate('stopGazePointer();closeSettingsModal()')
        # Compare the unchanged keyboard paths with the Phase production baseline.
        # kyou already lacks an app-level call to trapA11yPanelFocus: do not turn
        # that separate accessibility finding into an unrelated fix in this Phase.
        def panel_trace(baseline=False):
            c = browser.new_context(viewport={'width': 1280, 'height': 900})
            p = c.new_page()
            p.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body=''))
            url = (REPO_ROOT / (app + '.html')).as_uri()
            if baseline:
                html = subprocess.check_output(['git', 'show',
                    'b5b7e0623d73a9846fb77eda5f64061f0c6e9a65:' + app + '.html'],
                    cwd=REPO_ROOT, text=True)
                p.route(url, lambda r: r.fulfill(body=html, content_type='text/html'))
            p.goto(url)
            layout = []
            for width, height in [(375,667),(390,844),(768,1024),(1024,768),(1280,900)]:
                p.set_viewport_size({'width': width, 'height': height})
                layout.append(p.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]'))
            p.evaluate("document.getElementById('donomanaA11yBtn').click()")
            p.locator('#donomanaA11yReset').focus()
            trace = []
            for key in ['Tab', 'Shift+Tab']:
                for _ in range(12):
                    p.keyboard.press(key)
                    trace.append(p.evaluate("[document.activeElement.id, document.activeElement.tagName, document.getElementById('donomanaA11yPanel').contains(document.activeElement)]"))
            p.keyboard.press('Escape')
            trace.append(p.evaluate("[document.activeElement.id, document.getElementById('donomanaA11yPanel').style.display]"))
            c.close()
            return trace, layout
        reference, current = panel_trace(True), panel_trace()
        check(f'{app}: A11y Tab/Shift+Tab/Escape matches production baseline', reference[0] == current[0])
        check(f'{app}: responsive widths match baseline at five sizes', reference[1] == current[1])
        if app == 'kyou-no-kiroku':
            print('  [KNOWN] kyou: baseline A11y Tab containment missing; outside Phase scope')
        check(f'{app}: no page errors', not errors, errors)
        context.close()


def switch_ownership_regressions(browser):
    """Real keyboard down/up, repeats and competing target handlers; not Blue2.

    Fresh contexts use synthetic records only. Observe real click/flip handlers
    (no replacement activation) so a game-state guard cannot hide duplicates.
    """
    for app in ['katakana-app', 'matching-app']:
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body=''))
        page.goto((REPO_ROOT / (app + '.html')).as_uri())
        if app == 'matching-app':
            page.wait_for_selector('.set-item')
        page.clock.install()
        page.clock.pause_at('2030-01-01T00:00:00Z')
        if app == 'katakana-app':
            target = '#readGrid .kana-btn'
            page.evaluate("toggleScanMode(true); stopAutoScan()")
        else:
            page.evaluate("selLevel='easy'; startGame(); enableScan(); stopSwitchScan()")
            target = '#card-grid .card'
        page.evaluate("""app => {
            window.switchClicks = [];
            document.addEventListener('click', e => switchClicks.push(e.target.closest('button,.card,.set-item')?.id || e.target.className), true);
            window.switchFlips = [];
            if (app === 'matching-app') {
                const original = flip;
                flip = function(el, idx) { switchFlips.push(idx); return original(el, idx); };
            }
        }""", app)
        for key in ['Space', 'Enter']:
            for competing in ([False, True] if app == 'matching-app' else [False]):
                page.evaluate("""({app, competing}) => {
                    switchClicks.length=0; switchFlips.length=0;
                    if(app==='matching-app') {
                        locked=false; flipped=[]; moves=0;
                        document.querySelectorAll('.card').forEach(c=>c.classList.remove('flipped','matched','wrong'));
                        const cards=[...document.querySelectorAll('.card')];
                        scanIdx=buildScanItems().indexOf(cards[0]);
                        cards[competing?1:0].focus();
                    } else document.querySelector('#readGrid .kana-btn').focus();
                }""", {'app': app, 'competing': competing})
                page.keyboard.down(key)
                page.keyboard.up(key)
                result = page.evaluate("({clicks:switchClicks.length, flips:switchFlips, moves:typeof moves==='undefined'?0:moves})")
                check(f'{app}: {key} competing={competing} activates only current candidate once',
                      result['clicks'] == 1 and (app != 'matching-app' or result['flips'] == [0] and result['moves'] == 0), result)
                page.evaluate("switchClicks.length=0; switchFlips.length=0")
                page.keyboard.down(key)
                first = page.evaluate('switchClicks.length')
                for _ in range(3):
                    page.keyboard.down(key)  # real repeated keydown while held
                page.keyboard.up(key)
                check(f'{app}: {key} repeats add no activation', page.evaluate('switchClicks.length') == first == 1)
        page.evaluate("toggleScanMode(false)" if app == 'katakana-app' else 'disableScan()')
        # Native button path with scan OFF; target-local card keyboard behavior is out of scope.
        normal = target if app == 'katakana-app' else '#btn-back'
        for key in ['Space', 'Enter']:
            page.evaluate('switchClicks.length=0')
            page.locator(normal).first.press(key)
            check(f'{app}: scan OFF {key} native button activation once', page.evaluate('switchClicks.length') == 1)
            if app == 'matching-app':
                page.evaluate("selLevel='easy'; startGame()")
        page.locator(normal).first.focus()
        before = page.evaluate('document.activeElement.outerHTML')
        page.keyboard.press('Tab')
        check(f'{app}: scan OFF Tab moves focus', page.evaluate('document.activeElement.outerHTML') != before)
        for action in ['click', 'tap']:
            page.evaluate('switchClicks.length=0')
            getattr(page.locator(target).first, action)()
            check(f'{app}: {action} remains a single click', page.evaluate('switchClicks.length') == 1)
        page.locator('#donomanaA11yBtn').click()
        page.keyboard.press('Escape')
        check(f'{app}: common panel Escape and focus return', page.evaluate("document.getElementById('donomanaA11yPanel').style.display==='none' && document.activeElement.id==='donomanaA11yBtn'"))
        if app == 'katakana-app':
            page.locator('.tab-btn[data-tab="quiz"]').click()
            page.evaluate('startQuiz(10); toggleScanMode(true); stopAutoScan()')
            page.locator('.choice-btn').first.focus()
            before = page.evaluate('learningLog.length')
            page.keyboard.press('Space')
            check('katakana: one switch answer writes one record', page.evaluate('learningLog.length') == before + 1)
            page.evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',repeat:true,bubbles:true,cancelable:true}))")
            check('katakana: repeat writes no extra record', page.evaluate('learningLog.length') == before + 1)
        else:
            check('matching: no unintended completion record', page.evaluate("JSON.parse(localStorage.getItem('matching_log')||'[]').length") == 0)
        check(f'{app}: no runtime errors', not errors, errors)
        context.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ── Test A: Empty state ──────────────────────────────────────
        print("=== A. Empty state (no localStorage records) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        page.reload()
        check("empty-state visible", page.locator("#empty-state").is_visible())
        check("dashboard-body hidden", not page.locator("#dashboard-body").is_visible())
        check("no console/page errors on empty state", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test B: Mixed 21-app fixture ─────────────────────────────
        print("\n=== B. Mixed 21-app fixture ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")

        check("dashboard-body visible", page.locator("#dashboard-body").is_visible())
        check("empty-state hidden", not page.locator("#empty-state").is_visible())
        card_count = page.locator(".record-card").count()
        check("20 records rendered by default (21 Foundation minus kyou-no-kiroku)", card_count == 20, card_count)

        body_text = page.locator("body").inner_text()
        check("kyou-no-kiroku childName not present anywhere on page", "はなこ" not in body_text)
        check("register item name not present anywhere on page", "クッキー" not in body_text)
        check("nazori allChars not present anywhere on page", "あいうえお" not in body_text)
        check("bosai child name not present in Timeline (card list)", "たろう" not in page.locator("#timeline").inner_text())

        # Open the bosai record's detail and confirm the name still never appears.
        bosai_card = page.locator(".record-card", has_text="ぼうさいたんけんたい")
        if bosai_card.count() > 0:
            bosai_card.first.click()
            check("bosai name absent from Detail modal too", "たろう" not in page.locator("#detail-modal-body").inner_text())
            page.keyboard.press("Escape")
            check("focus returns to the record card after Escape", page.evaluate("() => document.activeElement.classList.contains('record-card')"))
        else:
            check("bosai card found for detail-leakage check", False)

        summary_apps = page.locator("#summary-apps").inner_text()
        check("summary shows 20 distinct apps used", summary_apps == "20", summary_apps)
        check("no raw internal activity code (e.g. \"wide\") visible on the page", "wide" not in body_text)
        check("nazori activity shows the mapped Japanese label instead", "続けて書く" in body_text)
        check("no forbidden ranking/average/achievement-rate text on page", not any(w in body_text for w in ["ランキング", "平均点", "達成率", "苦手"]))
        check("no console/page errors on mixed fixture", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)

        # CSV export -> real download, inspect file.
        with page.expect_download() as dl_info:
            page.click("#csv-export-btn")
        download = dl_info.value
        csv_path = CSV_OUT_DIR / "mixed-fixture.csv"
        download.save_as(str(csv_path))
        csv_bytes = csv_path.read_bytes()
        check("CSV file begins with UTF-8 BOM", csv_bytes[:3] == b"\xef\xbb\xbf")
        csv_text = csv_bytes.decode("utf-8-sig")
        csv_line_count = len([l for l in csv_text.splitlines() if l.strip()])
        check("CSV has header + 20 data rows", csv_line_count == 21, csv_line_count)
        check("CSV does not contain any personal-data marker", not any(m in csv_text for m in PERSONAL_DATA_MARKERS))

        context.close()

        # ── Test C: XSS non-execution ────────────────────────────────
        print("\n=== C. XSS fixture (okane detail / directions question) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        xss_payload_img = "<img src=x onerror=window.__xssFired=1>"
        xss_payload_script = "<script>window.__xssFired=1</script>"
        set_fixture_storage(page, list(STORAGE_MAP.keys()), overrides={
            'okane-app': {"detail": xss_payload_img},
            'directions-app': {"question": xss_payload_script},
        })
        page.reload()
        page.select_option("#filter-period", "all")
        page.wait_for_timeout(150)
        xss_fired = page.evaluate("() => window.__xssFired === 1")
        check("XSS payload did NOT execute", not xss_fired)
        timeline_html = page.locator("#timeline").inner_html()
        check("no live <img> element rendered anywhere on the page", page.locator("img").count() == 0)
        check("no extra <script> element injected into the timeline", "<script" not in timeline_html.lower())
        timeline_text = page.locator("#timeline").inner_text()
        check("payload rendered as literal visible text (not silently dropped)", xss_payload_img in timeline_text or xss_payload_script in timeline_text)
        check("no console/page errors from XSS fixture (script never ran)", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test D: Corrupted storage isolation ──────────────────────
        print("\n=== D. Corrupted storage isolation ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.evaluate("() => localStorage.setItem('janken_log', '{not valid json')")
        page.reload()
        page.select_option("#filter-period", "all")
        check("storage-warning shown", page.locator("#storage-warning").is_visible())
        remaining = page.locator(".record-card").count()
        check("other 19 apps still render despite 1 corrupted app", remaining == 19, remaining)
        check("no console/page errors despite malformed JSON in one app", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test E: Read-only proof ───────────────────────────────────
        print("\n=== E. Read-only proof (storage snapshot before/after interaction) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        before = snapshot_storage(page)
        page.select_option("#filter-period", "all")
        page.select_option("#filter-period", "7d")
        page.select_option("#filter-period", "all")
        first_card = page.locator(".record-card").first
        first_card.click()
        page.keyboard.press("Escape")
        with page.expect_download() as dl_info:
            page.click("#csv-export-btn")
        dl_info.value.save_as(str(CSV_OUT_DIR / "readonly-check.csv"))
        after = snapshot_storage(page)
        check("all 21 storage keys byte-for-byte unchanged after full interaction", before == after)
        context.close()

        # ── Test F: Responsive (no horizontal overflow) ───────────────
        print("\n=== F. Responsive viewports ===")
        for w, h in [(375, 667), (390, 844), (768, 1024), (1280, 900)]:
            context = browser.new_context(viewport={"width": w, "height": h})
            page, errors = new_page(context)
            goto_fresh(page)
            clear_all_storage(page)
            set_fixture_storage(page, list(STORAGE_MAP.keys()))
            page.reload()
            page.select_option("#filter-period", "all")
            scroll_w = page.evaluate("() => document.documentElement.scrollWidth")
            check(f"no horizontal overflow at {w}x{h}", scroll_w <= w, scroll_w)
            context.close()

        # ── Test G: 200% zoom (Chromium CSS zoom emulation) ───────────
        print("\n=== G. 200% zoom ===")
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        page.evaluate("() => { document.documentElement.style.zoom = '2'; }")
        page.wait_for_timeout(100)
        scroll_w_zoom = page.evaluate("() => document.documentElement.scrollWidth")
        client_w_zoom = page.evaluate("() => document.documentElement.clientWidth")
        check("no horizontal overflow at 200% zoom (375px viewport)", scroll_w_zoom <= client_w_zoom + 2, (scroll_w_zoom, client_w_zoom))
        context.close()

        # ── Test H: Keyboard operation (native button/select, focus trap) ──
        print("\n=== H. Keyboard operation ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        first_card = page.locator(".record-card").first
        first_card.focus()
        check("record card is a native <button> (keyboard-operable by default)", page.evaluate("() => document.activeElement.tagName") == "BUTTON")
        page.keyboard.press("Enter")
        check("Enter key opens the detail modal", page.locator("#record-detail-modal").is_visible())
        check("focus moved into the modal (close button)", page.evaluate("() => document.activeElement.id") == "detail-modal-close")
        page.keyboard.press("Tab")
        page.keyboard.press("Tab")
        check("Tab does not escape the modal while it is open (focus trap)", page.evaluate("() => document.getElementById('record-detail-modal').contains(document.activeElement)"))
        page.keyboard.press("Escape")
        check("Escape closes modal and returns focus to the triggering card", (not page.locator("#record-detail-modal").is_visible()) and page.evaluate("() => document.activeElement.classList.contains('record-card')"))
        check("no console/page errors during keyboard interaction", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test I: Accessibility semantics (landmarks, headings, dialog, live region) ──
        print("\n=== I. Accessibility semantics ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        check("exactly one <h1>", page.locator("h1").count() == 1)
        check("<main> landmark present", page.locator("main").count() == 1)
        check("date groups use <h3> headings", page.locator("h3.date-heading").count() >= 1)
        check("filters are native <select> elements (keyboard/screen-reader native)", page.locator("select").count() == 4)
        check("record card is a native <button> with descriptive text as its accessible name", page.locator(".record-card").first.evaluate("n => n.tagName") == "BUTTON" and len(page.locator(".record-card").first.inner_text()) > 0)
        page.click(".record-card >> nth=0")
        dialog_attrs = page.evaluate(
            "() => { const m = document.getElementById('record-detail-modal'); "
            "return {role: m.getAttribute('role'), ariaModal: m.getAttribute('aria-modal'), "
            "labelledby: m.getAttribute('aria-labelledby'), hasLabel: !!document.getElementById(m.getAttribute('aria-labelledby'))}; }"
        )
        check("detail modal has role=dialog + aria-modal=true + valid aria-labelledby", dialog_attrs == {"role": "dialog", "ariaModal": "true", "labelledby": "detail-modal-title", "hasLabel": True}, dialog_attrs)
        page.keyboard.press("Escape")
        live_attr = page.evaluate("() => document.getElementById('filter-live-region').getAttribute('aria-live')")
        check("filter result live region is aria-live=polite", live_attr == "polite")
        live_text = page.evaluate("() => document.getElementById('filter-live-region').textContent")
        check("live region announces a result count (not empty, not raw code)", "件の記録を表示しています" in live_text, live_text)
        check("no console/page errors during accessibility checks", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        gaze_regressions(browser)
        switch_ownership_regressions(browser)
        browser.close()

    print(f"\n{PASS}/{PASS + FAIL} checks passed.")
    if FAIL == 0:
        print("ALL PASS.")
        sys.exit(0)
    else:
        print(f"{FAIL} FAILURES.")
        sys.exit(1)


if __name__ == "__main__":
    main()
