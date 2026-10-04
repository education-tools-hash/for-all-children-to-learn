"""Count-mode integration tests; serve repository on 8935 before running.
Optional CHROMIUM_EXECUTABLE selects an installed browser without repo env changes.
Real clicks/hold + fake clock cover catch, next, reset, modal, storage and layout.
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8935/'
results = []


def check(name, ok, detail=''):
    results.append(bool(ok))
    print(('PASS' if ok else 'FAIL') + ' - ' + name + ': ' + str(detail))


def setup(browser, target=3, viewport=None):
    ctx = browser.new_context(viewport=viewport or {'width': 810, 'height': 1080})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + 'sakana-tsuri.html')
    page.clock.install()
    page.clock.pause_at('2030-01-01T00:00:00Z')
    page.click('[data-learning-mode=count]')
    page.click('[data-target-count="%d"]' % target)
    page.click('#start-btn')
    return ctx, page, errors


def cast(page):
    page.click('#cast-btn')
    page.clock.run_for(5000)
    assert page.evaluate('state') == 'REELING'


def catch(page):
    cast(page)
    box = page.locator('#reel-hold-btn').bounding_box()
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.down()
    page.clock.run_for(6000)
    page.mouse.up()
    assert page.evaluate('state') == 'CAUGHT'


def records(page):
    return page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records') || '[]')")


with sync_playwright() as pw:
    options = {'headless': True}
    if os.environ.get('CHROMIUM_EXECUTABLE'):
        options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        options['args'] = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader']
    browser = pw.chromium.launch(**options)
    for target in (1, 3, 5):
        ctx, page, errors = setup(browser, target)
        cid = page.evaluate('countChallenge.id')
        check('zero initial progress %s' % target, page.evaluate('countChallenge.caught') == 0)
        for n in range(1, target+1):
            catch(page)
            rr = records(page)
            p = rr[-1]['payload']
            check('catch %s/%s has one record' % (n, target), len(rr) == n)
            check('frozen target/id and exact progress', p['targetCount'] == target and p['caughtCount'] == n and p['challengeId'] == cid)
            check('completion only at target', p['challengeCompleted'] == (n == target))
            check('visual slots agree', page.locator('.count-goal-slot.filled').count() == n)
            page.evaluate('landFish(); landFish()')
            check('duplicate catch no save/count', len(records(page)) == n and page.evaluate('countChallenge.caught') == n)
            page.clock.run_for(6000)
            check('count mode does not auto-reset', page.evaluate('state') == 'CAUGHT')
            if n < target:
                page.click('#again-btn')
                check('next preserves challenge', page.evaluate('state') == 'IDLE' and page.evaluate('countChallenge.id') == cid and page.evaluate('countChallenge.caught') == n)
        page.evaluate('startCast()')
        check('completed cannot cast', page.evaluate('state') == 'CAUGHT' and len(records(page)) == target)
        page.click('#again-btn')
        check('completion returns preparation', page.locator('#start-screen').is_visible() and page.evaluate('countChallenge') is None)
        page.click('#start-btn')
        check('new challenge different id zero progress', page.evaluate('countChallenge.id') != cid and page.evaluate('countChallenge.caught') == 0)
        check('no runtime errors', not errors, errors)
        ctx.close()

    ctx, page, errors = setup(browser)
    catch(page)
    page.click('#again-btn')
    page.evaluate("document.querySelector('[data-target-count=\"5\"]').click()")
    check('hidden goal control cannot mutate settings/current challenge', page.evaluate('inputSettings.targetCount') == 3 and page.evaluate('countChallenge.target') == 3)
    page.click('#challengeSetupBtn')
    check('discard requires inline confirmation', page.locator('#discardChallengeDialog').is_visible())
    page.keyboard.press('Escape')
    check('escape retains progress', page.evaluate('countChallenge.caught') == 1)
    page.click('#challengeSetupBtn')
    page.click('#keepChallengeBtn')
    check('continue retains progress', page.evaluate('countChallenge.caught') == 1)
    page.click('#challengeSetupBtn')
    page.click('#discardChallengeBtn')
    check('discard resets challenge keeps records', page.evaluate('countChallenge') is None and len(records(page)) == 1)
    page.click('#start-btn')
    cast(page)
    page.click('#challengeSetupBtn')
    page.click('#discardChallengeBtn')
    page.clock.run_for(10000)
    check('interrupted cast no phantom save', len(records(page)) == 1 and page.evaluate('state') == 'IDLE')
    page.reload()
    page.click('#start-btn')
    check('reload retains records not in-memory progress', len(records(page)) == 1 and page.evaluate('countChallenge.caught') == 0)
    page.click('#donomanaLockBtn')
    catch(page)
    page.click('#again-btn')
    check('next usable under screen lock', page.evaluate('state') == 'IDLE' and page.evaluate('countChallenge.caught') == 1)
    ctx.close()

    ctx, page, errors = setup(browser, 5)
    cid = page.evaluate('countChallenge.id')
    page.evaluate("document.getElementById('start-btn').click()")
    check('duplicate start cannot replace challenge', page.evaluate('countChallenge.id') == cid)
    page.evaluate("document.getElementById('settingsResetBtn').click()")
    check('settings reset cannot change frozen mode/goal', page.evaluate('countChallenge.target') == 5 and page.evaluate('activeLearningMode') == 'count')
    cast(page)
    page.click('#challengeSetupBtn')
    before = page.evaluate('reelProgress')
    page.evaluate("applyReelProgress(100, 'touch')")
    check('inline confirmation blocks background progress', page.evaluate('reelProgress') == before)
    check('confirmation focuses safe continue', page.evaluate("document.activeElement.id") == 'keepChallengeBtn')
    page.click('#keepChallengeBtn')
    check('continue returns opener focus', page.evaluate("document.activeElement.id") == 'challengeSetupBtn')
    page.click('#challengeSetupBtn')
    page.click('#discardChallengeBtn')
    page.evaluate("localStorage.setItem('sakana-tsuri_settings',JSON.stringify({learningMode:'bad',targetCount:99}))")
    page.reload()
    check('invalid settings safe defaults', page.evaluate('inputSettings.learningMode') == 'free' and page.evaluate('inputSettings.targetCount') == 3)
    check('target selector hidden under free', not page.locator('#targetCountWrap').is_visible())
    ctx.close()

    for method in ('hold', 'arc', 'timing'):
        for width, height in ((390,844), (810,1080), (1080,810), (1366,600)):
            ctx, page, errors = setup(browser, viewport={'width':width, 'height':height})
            page.click('[data-reel-method="%s"]' % method)
            cast(page)
            sel = {'hold':'#reel-hold-btn','arc':'#reel-arc','timing':'#reel-timing-btn'}[method]
            boxes = [page.locator(x).bounding_box() for x in ('#pond',sel)]
            check('count pond/control fit %s %sx%s' % (method,width,height), all(b and b['y'] >= 0 and b['y']+b['height'] <= height for b in boxes), boxes)
            check('setup controls absent while playing', not page.locator('#methodRowWrap').is_visible() and not page.locator('#learningSetup').is_visible())
            if method == 'timing':
                page.click('#timingSpeedToggleBtn')
                page.click('[data-timing-speed=very-slow]')
                check('count mode live speed works', page.evaluate('activeTimingCycleMs') == 4400)
            check('layout no runtime errors', not errors, errors)
            ctx.close()

    # Common UI integration uses actually saved count records, including an unfinished catch.
    ctx, page, errors = setup(browser)
    catch(page)
    page.goto(BASE + 'learning-records.html')
    page.wait_for_timeout(300)
    check('common dashboard has count summary', 'この釣果まで 1匹' in page.locator('body').inner_text())
    page.locator('.record-card', has_text='さかなつり').first.click()
    detail = page.locator('#detail-modal-body').inner_text()
    check('common detail has saved goal/progress/id', '目標 3匹' in detail and 'この釣果まで 1匹' in detail and '課題ID' in detail)
    check('common dashboard has no runtime errors', not errors, errors)
    ctx.close()
    browser.close()

print('%s/%s PASS' % (sum(results),len(results)))
sys.exit(0 if all(results) else 1)
