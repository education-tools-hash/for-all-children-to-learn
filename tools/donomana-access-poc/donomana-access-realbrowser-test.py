#!/usr/bin/env python3
"""Donomana Access Phase 2/3 — real-browser verification (Playwright + Chromium).

tools/record-dashboard-poc/dashboard-realbrowser-test.py と同じ慣習(file://で
donomana-access.htmlを直接開き、headless Chromiumで検証する)。Phase 3で
端末内保存(localStorage)・活動後の記録表示・記録削除・保存失敗時の表示を
検証対象へ追加した。
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
            page.evaluate("try { localStorage.removeItem('donomana_access_log_v1'); } catch (e) {}")

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
            stored1 = page.text_content('#storedSummaryText')
            check('stored summary shows 1 session saved to localStorage', '1件' in stored1, stored1)
            check('stored summary shows 1 total activate across sessions', '1回' in stored1, stored1)
            saved_raw = page.evaluate("localStorage.getItem('donomana_access_log_v1')")
            check('session was actually persisted to localStorage (survives nothing-cleared)', saved_raw is not None and 'touch' in saved_raw, saved_raw)

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
            stored2 = page.text_content('#storedSummaryText')
            check('stored summary accumulates to 2 sessions (touch + switch)', '2件' in stored2, stored2)

            # --- 記録削除: 「もどる」でキャンセルした場合は削除されない ---
            page.click('#deleteRecordsBtn')
            check('delete confirmation row becomes visible', page.is_visible('#deleteConfirmRow.show'))
            page.click('#deleteConfirmNoBtn')
            check('delete confirmation row hides again after もどる', not page.is_visible('#deleteConfirmRow.show'))
            stored2b = page.text_content('#storedSummaryText')
            check('records are NOT deleted after cancelling (still 2 sessions)', '2件' in stored2b, stored2b)

            # --- 記録削除: 「削除する」で実際に削除される ---
            page.click('#deleteRecordsBtn')
            page.click('#deleteConfirmYesBtn')
            delete_status = page.text_content('#deleteStatus')
            check('delete status announces success', '削除しました' in delete_status, delete_status)
            stored2c = page.text_content('#storedSummaryText')
            check('stored summary shows 0 sessions after deletion', '0件' in stored2c, stored2c)
            after_delete_raw = page.evaluate("localStorage.getItem('donomana_access_log_v1')")
            check('localStorage key no longer holds the deleted sessions', after_delete_raw is None, after_delete_raw)

            page.click('#restartBtn')

            # --- スワイプ入力(Phase 5A, Design v2.0 1.2節)での一連の操作確認 ---
            page.check('input[name="inputMethod"][value="swipe"]')
            page.click('#startBtn')
            check('activity screen becomes active (swipe)', page.is_visible('#screen-activity.active'))
            check('switchActionBtn is hidden in swipe mode (shares touch pointer path)',
                  not page.is_visible('#switchActionBtn'))

            surface_sw = page.locator('#activitySurface')
            box_sw = surface_sw.bounding_box()
            start_x, start_y = box_sw['x'] + box_sw['width'] / 2 - 20, box_sw['y'] + box_sw['height'] / 2
            end_x, end_y = start_x + 40, start_y  # 40px移動、10pxしきい値を明確に超える
            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(end_x, end_y, steps=5)
            page.mouse.up()

            page.click('#endBtn')
            check('end screen becomes active after おわる (swipe)', page.is_visible('#screen-end.active'))
            summary_sw = page.text_content('#summaryText')
            check('summary identifies input method as swipe (not touch)', 'スワイプ' in summary_sw, summary_sw)
            check('summary counts exactly 1 operation for one drag gesture', '1 回' in summary_sw, summary_sw)
            stored_sw = page.text_content('#storedSummaryText')
            check('stored summary shows 1 session saved after swipe activity', '1件' in stored_sw, stored_sw)
            saved_sw_raw = page.evaluate("localStorage.getItem('donomana_access_log_v1')")
            check("swipe session was persisted with inputMethod:'swipe' (distinct from touch)",
                  saved_sw_raw is not None and '"inputMethod":"swipe"' in saved_sw_raw, saved_sw_raw)

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

        # --- 保存失敗時の表示(設計文書8章): localStorage.setItemを強制的に
        # 失敗させ、バナーが表示されること・クラッシュしないことを確認する。 ---
        print('\n=== save-failure handling ===')
        page_fail = browser.new_page(viewport={'width': 1024, 'height': 900})
        page_fail.goto(APP_URL)
        page_fail.evaluate("""
            () => {
                try { localStorage.removeItem('donomana_access_log_v1'); } catch (e) {}
                var err = new Error('quota');
                err.name = 'QuotaExceededError';
                window.__origSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function (k, v) {
                    if (k === 'donomana_access_log_v1') throw err;
                    return window.__origSetItem.call(this, k, v);
                };
            }
        """)
        page_fail.click('#startBtn')
        surface_f = page_fail.locator('#activitySurface')
        box_f = surface_f.bounding_box()
        page_fail.mouse.move(box_f['x'] + box_f['width'] / 2, box_f['y'] + box_f['height'] / 2)
        page_fail.mouse.down()
        page_fail.mouse.up()
        page_fail.click('#endBtn')
        check('end screen reached despite save failure (does not crash)', page_fail.is_visible('#screen-end.active'))
        banner_text = page_fail.text_content('#saveFailureBanner')
        banner_visible = page_fail.evaluate("getComputedStyle(document.getElementById('saveFailureBanner')).display !== 'none'")
        check('save-failure banner becomes visible', banner_visible)
        check('save-failure banner mentions quota reason, not silently swallowed', 'quota' in banner_text, banner_text)
        page_fail.close()

        # --- 入力方式切替時の状態初期化(Step 6・Step 9): スイッチ入力中に
        # 走査タイマーが動いた状態からタッチへ切り替えても、残存状態なく
        # 正常に動作することを確認する。 ---
        print('\n=== input method switch resets state cleanly ===')
        page_switch = browser.new_page(viewport={'width': 1024, 'height': 900})
        page_switch.goto(APP_URL)
        page_switch.evaluate("try { localStorage.removeItem('donomana_access_log_v1'); } catch (e) {}")
        page_switch.check('input[name="inputMethod"][value="switch"]')
        page_switch.click('#startBtn')
        page_switch.wait_for_timeout(100)
        page_switch.click('#endBtn')
        page_switch.click('#restartBtn')
        page_switch.check('input[name="inputMethod"][value="touch"]')
        page_switch.click('#startBtn')
        no_scan_focus_leaked = page_switch.evaluate("!document.querySelector('.scan-focus')")
        check('no leftover scan-focus highlight after switching to touch', no_scan_focus_leaked)
        surface_s = page_switch.locator('#activitySurface')
        box_s = surface_s.bounding_box()
        page_switch.mouse.move(box_s['x'] + box_s['width'] / 2, box_s['y'] + box_s['height'] / 2)
        page_switch.mouse.down()
        page_switch.mouse.up()
        page_switch.click('#endBtn')
        summary_s = page_switch.text_content('#summaryText')
        check('touch session after switch-to-touch records exactly 1 activate (no leaked switch events)', '1 回' in summary_s, summary_s)

        # --- Phase 5A: 外部スイッチ -> スワイプへの切替でも残存状態なく動作すること ---
        page_switch.click('#restartBtn')
        page_switch.check('input[name="inputMethod"][value="switch"]')
        page_switch.click('#startBtn')
        page_switch.wait_for_timeout(100)
        page_switch.click('#endBtn')
        page_switch.click('#restartBtn')
        page_switch.check('input[name="inputMethod"][value="swipe"]')
        page_switch.click('#startBtn')
        no_scan_focus_leaked2 = page_switch.evaluate("!document.querySelector('.scan-focus')")
        check('no leftover scan-focus highlight after switching from switch to swipe', no_scan_focus_leaked2)
        check('switchActionBtn hidden after switching from switch to swipe (no residual switch UI)',
              not page_switch.is_visible('#switchActionBtn'))
        surface_s2 = page_switch.locator('#activitySurface')
        box_s2 = surface_s2.bounding_box()
        page_switch.mouse.move(box_s2['x'] + box_s2['width'] / 2, box_s2['y'] + box_s2['height'] / 2)
        page_switch.mouse.down()
        page_switch.mouse.up()
        page_switch.click('#endBtn')
        summary_s2 = page_switch.text_content('#summaryText')
        check('swipe session after switch-to-swipe records exactly 1 activate (no leaked switch events)',
              '1 回' in summary_s2 and 'スワイプ' in summary_s2, summary_s2)
        page_switch.close()

        print('\n=== console errors across all runs ===')
        check('no console errors or page errors occurred', len(console_errors) == 0, console_errors[:5])

        browser.close()


if __name__ == '__main__':
    run()
    print('\n=== RESULT ===')
    print('PASS:', pass_count, ' FAIL:', fail_count)
    sys.exit(1 if fail_count > 0 else 0)
