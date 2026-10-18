#!/usr/bin/env python3
"""Donomana Access Phase 2 — real-browser verification (Playwright + Chromium).

tools/record-dashboard-poc/dashboard-realbrowser-test.py と同じ慣習(file://で
donomana-access.htmlを直接開き、headless Chromiumで検証する)。本Phaseでは
永続保存を実装していないため、保存周りの検証は対象外。
"""
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP_URL = 'file://' + os.path.join(ROOT, 'donomana-access.html')

WIDTHS = [375, 768, 1024, 1280]

pass_count = 0
fail_count = 0


def check(label, condition, detail=None):
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print('  [OK  ]', label, ('— ' + str(detail)) if detail is not None else '')
    else:
        fail_count += 1
        print('  [FAIL]', label, ('— ' + str(detail)) if detail is not None else '')


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        console_errors = []

        for width in WIDTHS:
            print('\n=== width=%dpx ===' % width)
            page = browser.new_page(viewport={'width': width, 'height': 900})
            page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
            page.on('pageerror', lambda exc: console_errors.append(str(exc)))
            page.goto(APP_URL)

            check('setup screen is visible', page.is_visible('#screen-setup.active'))
            check('no horizontal scroll at this width',
                  page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))

            # --- タッチ入力での一連の操作確認 ---
            page.click('#startBtn')
            check('activity screen becomes active (touch)', page.is_visible('#screen-activity.active'))
            check('switchActionBtn is hidden in touch mode',
                  not page.is_visible('#switchActionBtn'))

            surface = page.locator('#activitySurface')
            box = surface.bounding_box()
            cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.mouse.up()

            events_after_touch = page.evaluate("document.querySelector('#screen-activity').__ignored")
            # 内部stateへ直接アクセスできないため(クロージャ内のため)、
            # DOM上に見える効果(終了画面の件数表示)で確認する。
            page.click('#endBtn')
            check('end screen becomes active after おわる (touch)', page.is_visible('#screen-end.active'))
            summary = page.text_content('#summaryText')
            check('summary mentions 1 operation after a single tap', '1 回' in summary, summary)
            check('summary identifies input method as touch', 'タッチ' in summary, summary)

            page.click('#restartBtn')
            check('returns to setup screen', page.is_visible('#screen-setup.active'))

            # --- 外部スイッチ入力（キーボードSpace/Enterで代替確認） ---
            page.check('input[name="inputMethod"][value="switch"]')
            page.click('#startBtn')
            check('activity screen becomes active (switch)', page.is_visible('#screen-activity.active'))
            check('switchActionBtn is visible in switch mode', page.is_visible('#switchActionBtn'))

            page.wait_for_timeout(100)
            scan_focus_present = page.evaluate(
                "!!document.querySelector('#screen-activity .scan-focus')"
            )
            check('scan highlight (.scan-focus) appears on some candidate', scan_focus_present)

            page.keyboard.down('Space')
            page.wait_for_timeout(30)
            page.keyboard.up('Space')

            # OSキーリピートのシミュレーション: 押しっぱなし中に複数のkeydownを送る。
            # Playwrightのkeyboard.down()はrepeatフラグを制御できないため、ここでは
            # e.repeat抑制そのものはNode golden testsで検証済み(3章)。ここでは
            # 実際のDOM/ブラウザ上で最初の1回のactivateのみがsummaryに反映される
            # ことのみを確認する。
            page.click('#endBtn')
            check('end screen becomes active after おわる (switch)', page.is_visible('#screen-end.active'))
            summary2 = page.text_content('#summaryText')
            check('summary identifies input method as switch', '外部スイッチ' in summary2, summary2)
            check('exactly one activate was recorded for one Space press', '1 回' in summary2, summary2)

            page.click('#restartBtn')
            page.check('input[name="inputMethod"][value="touch"]')  # ラジオボタンは選び直すことで切り替える

            # --- アクセシビリティ: 色以外のフィードバック・音なし利用・フォーカス可視化 ---
            page.uncheck('#soundToggle')
            page.click('#startBtn')
            surface2 = page.locator('#activitySurface')
            box2 = surface2.bounding_box()
            cx2, cy2 = box2['x'] + box2['width'] / 2, box2['y'] + box2['height'] / 2
            page.mouse.move(cx2, cy2)
            page.mouse.down()
            page.mouse.up()
            dot_appeared = page.evaluate("!!document.querySelector('.feedback-dot')")
            check('visual feedback dot renders even with sound off', dot_appeared)
            page.click('#endBtn')
            page.click('#restartBtn')

            page.close()

        print('\n=== console errors across all runs ===')
        check('no console errors or page errors occurred', len(console_errors) == 0, console_errors[:5])

        browser.close()


if __name__ == '__main__':
    run()
    print('\n=== RESULT ===')
    print('PASS:', pass_count, ' FAIL:', fail_count)
    sys.exit(1 if fail_count > 0 else 0)
