#!/usr/bin/env python3
"""はんばいかい レジ（register-app.html）— QR機能追加前のベースライン回帰テスト
(DONOMANA-REGISTER-QR-PHASE-3-1-BASELINE-TESTS-1)。

tools/donomana-access-poc/donomana-access-realbrowser-test.py と同じ慣習
(file://でregister-app.htmlを直接開き、headless Chromiumで検証する)。

本テストはQRコード生成・読み取り機能を一切含まない（まだ実装されていないため）。
既存の商品登録・カート・会計・共有・設定・アクセシビリティ・CSV出力が、QR機能
追加前の時点でどう動くかを記録し、QR実装後の回帰検出の基準（ベースライン）とする。

データ分離について：各テストは Playwright が起動する新規・使い捨ての headless
Chromiumプロファイル内の独立した browser context で実行される。実際の利用者の
ブラウザ・実際の端末のlocalStorageには一切アクセスしない（本番の商品データ・
会計記録に触れることは構造的にあり得ない）。

既知の課題の確認について：Phase 2設計調査で発見した「モーダルが背景をinert化
しないため、スイッチスキャンの対象が開いているモーダルの外にも漏れる」という
構造的な既存の問題（register-app.html L1681-1684のコメント、L2064の
SWITCH_SCAN_SELECTOR参照）を、末尾のテストで実際に確認する。本Phaseではこの
モーダル基盤そのものを修正しない方針のため、このテストは意図的に失敗（FAIL）を
報告する。これは本Phaseで新たに生まれた回帰ではなく、Phase 2時点で文書化済みの
既存の挙動を自動テストとして固定しただけである。

本Phaseの作成過程で新たに発見した既存の不具合について：「9. 商品リスト共有URLの
生成・読み込み」のテスト（group_c_share_and_ids）は、register-app.html自身が
生成する共有URLをそのまま使った場合、ほぼ確実に読み込みが失敗する不具合を発見した
（openShareModal, L1992/L1995がbase64文字列をencodeURIComponent()せずに生の
まま URLへ連結しており、日本語の商品名を含むbase64には高確率で'+'が含まれ、
loadSharedProducts, L2033のURLSearchParams.get()が仕様上'+'を空白に変換して
しまうため、atob()が例外を投げて読み込みに失敗する）。これはQR機能とは無関係の、
本Phase以前から存在する既存の不具合である。テスト対象の仕様を無断で変更しない
方針（本Phase指示）に従い、register-app.html側は一切変更していない。この
テストはこの不具合を隠さず、意図的に失敗（FAIL）を報告する。

PASS/FAIL件数には、上記2件の「既知の/新たに発見した失敗」が含まれることを、
実行結果の末尾と本Phaseの報告書の両方で明記する。
"""
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP_URL = 'file://' + os.path.join(ROOT, 'register-app.html')

# register-app.html L2064 時点のSWITCH_SCAN_SELECTORをそのまま転記（実行時に
# window経由で読めるとは限らないため、既知の課題確認テストのために固定値として
# 保持する。将来この値が変わった場合、末尾のテストが「古いセレクタで漏れがない
# ように見える」偽陰性を起こし得るため、変更時はこの定数も合わせて見直すこと）。
SWITCH_SCAN_SELECTOR = '.product-card,.cart-btn:not(:disabled),.icon-btn,.edit-btn-small,.scannable'

DEFAULT_PRODUCTS = ['クッキー', 'ジュース', 'チョコ', 'ケーキ']  # register-app.html L1423-1428

# register-app.htmlは <link rel="icon" href="/favicon.ico"> 等、サイトルート相対の絶対パス
# (favicon/apple-touch-icon/site.webmanifest, L287-292)をgenerator注入ブロックとして持つ。
# donomana.jp上では正しく解決するが、file://で直接開くテストでは必ず404になる既知の
# プロトコル差異であり、アプリの不具合ではない。「コンソールエラー無し」判定からはこの
# カテゴリだけを除外し、それ以外のJSエラーは一切見逃さない。
KNOWN_FILE_PROTOCOL_404_PATTERNS = (
    'favicon', 'apple-touch-icon', 'site.webmanifest',
    # Google Fontsの実リクエスト成否はこの実行環境のネットワーク到達性に依存し、
    # アプリ自体の正しさとは無関係（本番のdonomana.jp上では通常到達可能）。
    'fonts.gstatic.com', 'fonts.googleapis.com',
)

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


def _is_known_file_protocol_404(request):
    url = request.url
    return any(pat in url for pat in KNOWN_FILE_PROTOCOL_404_PATTERNS)


KNOWN_GENERIC_RESOURCE_FAILURE_TEXT = 'Failed to load resource: net::ERR_FILE_NOT_FOUND'


def fresh_page(browser, **kwargs):
    page = browser.new_page(**kwargs)
    console_errors = []
    # ブラウザはリソース読み込み失敗(favicon等、既知のfile://限定404)をconsole.errorにも
    # URL無しの汎用文として出す。URLを伴うrequestfailedイベント側で既知404を正しく除外
    # しているため、ここではこの汎用文のみ重複カウントを避けるために無視する
    # (この文字列はリソース読み込み失敗専用で、アプリのJS例外には出現しない)。
    page.on('console', lambda msg: console_errors.append(msg.text)
            if msg.type == 'error' and msg.text != KNOWN_GENERIC_RESOURCE_FAILURE_TEXT else None)
    page.on('pageerror', lambda exc: console_errors.append(str(exc)))
    page.on('requestfailed', lambda req: console_errors.append('requestfailed: ' + req.url)
            if not _is_known_file_protocol_404(req) else None)
    page.goto(APP_URL)
    return page, console_errors


def open_settings_modal(page):
    """register-app.html自身の#settings-btn(⚙️)は、全アプリ共通のa11y-panel機構
    (generate.jsが注入するL433の<style>#settings-btn{opacity:0 !important;
    pointer-events:none !important;}</style>と、L604-607のtabIndex=-1/aria-hidden=true
    付与)によって、実際のポインタ操作からは到達不能にされている(register-app.html
    L524-663のコメントが明記する、全35アプリ共通の既存仕様。QR Phase由来の変更ではない)。
    実際の利用者は右下の共通フローティングボタン(#donomanaA11yBtn)を開き、その中の
    「🔧 このアプリの詳細設定を開く」(#donomanaSettingsProxy)が#settings-btnへ
    original.click()するのを介してのみ到達できる。本テストも同じ経路を辿る。"""
    page.click('#donomanaA11yBtn')
    page.click('#donomanaSettingsProxy')


def group_a_product_crud(browser):
    print('\n=== 1. 商品登録・編集・削除 ===')
    page, errors = fresh_page(browser)

    check('starts with the 4 default seed products', page.evaluate('products.length') == 4,
          page.evaluate('products.map(p=>p.name)'))

    # --- 登録 ---
    page.click('#edit-mode-btn')
    check('edit mode turns on', page.evaluate('editMode') is True)
    page.click('.add-product-card')
    check('product-modal opens for a new product', page.is_visible('#product-modal.active'))
    check('modal title says "商品を追加" for a new product', page.text_content('#pmt') == '商品を追加')

    page.fill('#product-name-input', 'テスト商品')
    page.fill('#product-price-input', '321')
    page.click('.emoji-option[data-emoji="🍩"]')
    page.click('#product-modal-save')
    check('product-modal closes after save', not page.is_visible('#product-modal.active'))
    check('new product now exists with correct name/price',
          any(p['name'] == 'テスト商品' and p['price'] == 321 for p in page.evaluate('products')),
          page.evaluate('products'))
    check('new product card is rendered with its price',
          page.locator('.product-card', has_text='テスト商品').locator('.product-price').text_content() == '¥321')

    # --- 登録時のバリデーション（名前なし／不正な値段） ---
    page.click('.add-product-card')
    page.click('#product-modal-save')
    check('saving with an empty name is rejected (modal stays open)', page.is_visible('#product-modal.active'))
    page.fill('#product-name-input', '不正な値段テスト')
    page.fill('#product-price-input', '-5')
    page.click('#product-modal-save')
    check('saving with a negative price is rejected (modal stays open)', page.is_visible('#product-modal.active'))
    check('rejected entries were not added to the product list',
          not any(p['name'] in ('', '不正な値段テスト') for p in page.evaluate('products')))
    page.click('#product-modal-cancel')

    # --- 編集 ---
    # .edit-overlay は register-app.html L133-134 のとおり :hover/:focus-within 時のみ
    # display:flex になる(既定はdisplay:none)。Playwrightはクリック前の可視性チェックを
    # 先に行うため、ネストしたボタンを直接クリックする前に親カードを明示的にhoverする。
    test_card = page.locator('.product-card', has_text='テスト商品')
    test_card.hover()
    test_card.locator('[data-action="edit"]').click()
    check('product-modal reopens for editing with "商品を編集" title', page.text_content('#pmt') == '商品を編集')
    check('name field is pre-filled', page.input_value('#product-name-input') == 'テスト商品')
    check('price field is pre-filled', page.input_value('#product-price-input') == '321')
    page.fill('#product-price-input', '555')
    page.click('#product-modal-save')
    check('edited price is reflected on the product card',
          page.locator('.product-card', has_text='テスト商品').locator('.product-price').text_content() == '¥555')

    # --- 削除（キャンセル経路） ---
    deletable = page.locator('.product-card', has_text='テスト商品')
    deletable.hover()
    deletable.locator('[data-action="delete"]').click()
    check('delete-modal opens and names the product',
          'テスト商品' in page.text_content('#delete-modal-msg'))
    page.click('#delete-cancel')
    check('product survives a cancelled delete',
          page.locator('.product-card', has_text='テスト商品').count() == 1)

    # --- 削除（確定経路） ---
    deletable2 = page.locator('.product-card', has_text='テスト商品')
    deletable2.hover()
    deletable2.locator('[data-action="delete"]').click()
    page.click('#delete-confirm')
    check('product is removed after confirming delete',
          page.locator('.product-card', has_text='テスト商品').count() == 0)
    check('product list returns to the 4 default products',
          sorted(page.evaluate('products.map(p=>p.name)')) == sorted(DEFAULT_PRODUCTS),
          page.evaluate('products.map(p=>p.name)'))

    check('no console/page errors during product CRUD', len(errors) == 0, errors[:5])
    page.close()


def group_b_shopping_flow(browser):
    print('\n=== 2〜8. カート追加〜会計完了（一連の買い物フロー） ===')
    page, errors = fresh_page(browser)
    cards = page.locator('.product-card')

    # 2. 商品タップによるカート追加
    cards.nth(0).click()  # クッキー ¥100
    check('tapping a product adds it to the cart', page.text_content('#cart-count') == '1点')
    check('total reflects the single item', page.text_content('#total-amount') == '¥100')
    check('cart line shows the product name', 'クッキー' in page.text_content('#cart-items'))

    # 3. 同一商品の数量加算
    cards.nth(0).click()
    check('tapping the same product again increments quantity (not a new line)',
          page.text_content('#cart-count') == '2点')
    check('cart still shows exactly 1 line item for the same product',
          page.locator('.cart-item').count() == 1)
    check('total doubles for qty=2', page.text_content('#total-amount') == '¥200')

    # 4. 数量増減・商品削除・カートクリア
    page.locator('.qty-btn[data-action="inc"]').first.click()
    check('qty +button increments quantity (qty=3)', page.text_content('#total-amount') == '¥300')
    page.locator('.qty-btn[data-action="dec"]').first.click()
    check('qty -button decrements quantity (qty=2)', page.text_content('#total-amount') == '¥200')

    cards.nth(1).click()  # ジュース ¥150
    check('a second distinct product adds a second cart line', page.locator('.cart-item').count() == 2)
    check('total sums both lines (200+150)', page.text_content('#total-amount') == '¥350')

    page.locator('.cart-item', has_text='クッキー').locator('.delete-item-btn').click()
    check('removing one line leaves only the other product',
          page.locator('.cart-item').count() == 1 and 'ジュース' in page.text_content('#cart-items'))
    check('total reflects only the remaining line', page.text_content('#total-amount') == '¥150')

    page.click('#clear-cart-btn')
    check('clear-cart empties the cart', page.locator('#cart-items .empty-cart').count() == 1)
    check('total resets to ¥0 after clearing', page.text_content('#total-amount') == '¥0')
    check('payment button is disabled on an empty cart', page.is_disabled('#payment-btn'))
    check('clear-cart button is disabled on an empty cart', page.is_disabled('#clear-cart-btn'))

    # 5. 合計金額の計算（複数商品の正確な合算）
    cards.nth(0).click(); cards.nth(0).click()  # クッキー x2 = 200
    cards.nth(1).click()                         # ジュース x1 = 150
    cards.nth(2).click()                         # チョコ   x1 = 200
    check('multi-product total is calculated correctly (200+150+200=550)',
          page.text_content('#total-amount') == '¥550')

    # 6. 預かり金・おつりの計算
    page.click('#payment-btn')
    check('payment-modal opens showing the correct total', page.text_content('#payment-total') == '¥550')
    for d in ['1', '0', '0', '0']:
        page.click('.num-btn[data-num="%s"]' % d)
    received_text = page.text_content('#payment-received-display')
    check('numpad input accumulates to ¥1,000', ('1,000' in received_text) or ('1000' in received_text),
          received_text)
    change_text = page.text_content('#change-display')
    check('change is calculated correctly (1000-550=450)', 'おつり' in change_text and '450' in change_text,
          change_text)
    check('change-display is shown once payment covers the total',
          'show' in (page.get_attribute('#change-display', 'class') or ''))
    check('confirm button is enabled once payment covers the total', not page.is_disabled('#payment-confirm'))

    page.click('.num-btn[data-num="del"]')
    check('del removes exactly the last digit (¥1,000 -> ¥100)',
          ('100' == page.evaluate("document.getElementById('payment-received-display').textContent.replace(/[^0-9]/g,'')")))

    # 7. 預かり金不足時の会計確定防止
    check('confirm button is disabled once payment is under the total (¥100 < ¥550)',
          page.is_disabled('#payment-confirm'))
    check('change-display is hidden while payment is insufficient',
          'show' not in (page.get_attribute('#change-display', 'class') or ''))

    page.click('.num-btn[data-num="del"]')
    page.click('.num-btn[data-num="del"]')
    page.click('.num-btn[data-num="del"]')
    check('payment field is fully cleared via repeated del',
          page.text_content('#payment-received-display') == '¥0')
    for d in ['1', '0', '0', '0']:
        page.click('.num-btn[data-num="%s"]' % d)
    check('confirm button re-enables once a sufficient amount is re-entered',
          not page.is_disabled('#payment-confirm'))

    # 8. 会計完了とregister_logへの記録
    page.click('#payment-confirm')
    check('cart is cleared after a completed sale', page.text_content('#cart-count') == '0点')
    check('payment-modal closes after a completed sale', not page.is_visible('#payment-modal.active'))
    toast_text = page.evaluate("document.getElementById('toast-wrap').textContent")
    check('a thank-you toast is shown', 'ありがとうございました' in toast_text, toast_text)

    log = page.evaluate("JSON.parse(localStorage.getItem('register_log')||'[]')")
    check('exactly one checkout entry was recorded to register_log', len(log) == 1, log)
    if log:
        payload = log[0].get('payload', {})
        check('recorded totalAmount matches the sale (550)', payload.get('totalAmount') == 550, payload)
        check('recorded itemCount matches the sale (4 units)', payload.get('itemCount') == 4, payload)
        check('recorded paymentReceived matches what was entered (1000)', payload.get('paymentReceived') == 1000, payload)
        check('recorded change matches the sale (450)', payload.get('change') == 450, payload)
        check('recorded items snapshot has 3 distinct product lines', len(payload.get('items', [])) == 3, payload)

    page.click('#record-open-btn')
    check('record-modal opens', page.is_visible('#record-modal.active'))
    history_text = page.text_content('#record-history')
    check('record history shows the recorded total', '¥550' in history_text, history_text)
    check('record history shows the recorded item count', '4点' in history_text, history_text)

    check('no console/page errors during the shopping flow', len(errors) == 0, errors[:5])
    page.close()


def group_c_share_and_ids(browser):
    print('\n=== 9〜10. 商品リスト共有URL・商品IDの保持・画像の取り扱い ===')
    page1, errors1 = fresh_page(browser)

    ids_before = page1.evaluate('products.map(p=>p.id)')
    names_before = page1.evaluate('products.map(p=>p.name)')
    check('source device starts with the 4 default products', len(ids_before) == 4, names_before)

    page1.click('#share-btn')
    check('share-modal opens', page1.is_visible('#share-modal.active'))
    shared_url = page1.text_content('#share-url-display')
    check('a share URL containing the products payload is generated',
          shared_url.startswith('file://') and '?products=' in shared_url, shared_url)
    size_text = page1.text_content('#share-url-size')
    check('share size indicator reports the correct product count', '4件' in size_text, size_text)
    page1.click('#share-modal-close')

    # --- 実際にアプリが生成したURLそのままでの読み込み（実際の利用シナリオ） ---
    # register-app.html L1992/L1995 (openShareModal) は base64文字列を
    # encodeURIComponent()せずそのままURLへ連結する。base64のUTF-8エンコード結果には
    # 一定確率で'+'が含まれ(日本語の商品名を含む場合はほぼ必発)、受信側L2033
    # (loadSharedProducts)はURLSearchParams.get('products')で読むため、
    # application/x-www-form-urlencoded仕様により'+'は自動的に空白へ変換されてしまう。
    # その結果base64が破損し、atob()が例外を投げ、catch節が「読み込み失敗」として
    # 既定の4商品（新しいIDで再生成）に静かにフォールバックする。
    page2, errors2 = fresh_page(browser)
    page2.goto(shared_url)
    payload_has_plus = '+' in shared_url.split('?products=', 1)[1]
    toast_after_real_url = page2.evaluate("document.getElementById('toast-wrap').textContent")
    ids_after_real_url = page2.evaluate('products.map(p=>p.id)')
    check('[既存アプリの不具合/BUG] the app-generated share URL, used exactly as the app itself produces it, '
          'successfully imports the shared products on another device '
          '(register-app.html L1992/L1995 does not encodeURIComponent() the base64 payload before building '
          'the URL; because base64 output containing Japanese text very often contains a literal "+", and '
          'L2033 reads it back via URLSearchParams.get() which decodes "+" as a space per '
          'application/x-www-form-urlencoded, the base64 gets corrupted and atob() throws — this run\'s '
          'payload %s a "+"; confirmed independently via a manual atob() reproduction outside this app)'
          % ('DOES contain' if payload_has_plus else 'does NOT contain'),
          set(ids_after_real_url) == set(ids_before),
          {'toast': toast_after_real_url, 'ids_before': ids_before, 'ids_after': ids_after_real_url})

    # --- 根本原因の切り分け：payloadだけを正しくURLエンコードし直した場合 ---
    # register-app.html自体は変更せず、本テストスクリプト側でURLを組み直すだけ。
    # これにより「decode/ID保持ロジック自体は正しいか」をバグと分離して検証する。
    import urllib.parse
    base64_payload = shared_url.split('?products=', 1)[1]
    corrected_url = shared_url.split('?products=', 1)[0] + '?products=' + urllib.parse.quote(base64_payload, safe='')
    page3, errors3 = fresh_page(browser)
    page3.goto(corrected_url)
    check('importing device no longer shows the ?products= query after a correctly-encoded import',
          'products=' not in page3.url, page3.url)

    ids_after = page3.evaluate('products.map(p=>p.id)')
    check('[根本原因の切り分け] with the payload correctly percent-encoded, product IDs ARE preserved '
          'across share/import (confirms the decode/ID-preservation logic itself is correct; the bug above '
          'is specifically the missing encodeURIComponent() in openShareModal, not the decode path)',
          set(ids_before) == set(ids_after), (ids_before, ids_after))
    names_after = page3.evaluate('products.map(p=>p.name)')
    check('product names are preserved across a correctly-encoded share/import',
          sorted(names_before) == sorted(names_after), (names_before, names_after))

    images_after = page3.evaluate('products.map(p=>p.image)')
    check('imported products all have image=null (photos are intentionally not shared)',
          all(img is None for img in images_after), images_after)

    stored_ids = page3.evaluate("JSON.parse(localStorage.getItem('register_products')||'[]').map(p=>p.id)")
    check('imported product list was persisted to register_products on the importing device',
          set(stored_ids) == set(ids_before), stored_ids)

    check('no console/page errors on the sharing device', len(errors1) == 0, errors1[:5])
    check('no console/page errors on the correctly-encoded importing device', len(errors3) == 0, errors3[:5])
    page1.close()
    page2.close()
    page3.close()


def group_d_settings_persistence(browser):
    print('\n=== 11. 設定の保存・復元 ===')
    page, errors = fresh_page(browser)

    open_settings_modal(page)
    check('high-contrast starts unchecked', not page.is_checked('#high-contrast-toggle'))
    page.locator('label.toggle:has(#high-contrast-toggle)').click()
    page.check('input[name="font-size"][value="xxl"]', force=True)
    page.fill('#store-name-input', 'テストてん')
    page.click('#settings-close')

    check('high-contrast is applied immediately after closing settings',
          'high-contrast' in (page.get_attribute('body', 'class') or ''))
    check('font-size xxl is applied immediately after closing settings',
          'text-xxl' in (page.get_attribute('body', 'class') or ''))
    check('store name is applied immediately after closing settings',
          page.text_content('#store-name-display') == 'テストてん')

    stored = page.evaluate("JSON.parse(localStorage.getItem('register_settings')||'{}')")
    check('highContrast was persisted to register_settings', stored.get('highContrast') is True, stored)
    check('fontSize=xxl was persisted to register_settings', stored.get('fontSize') == 'xxl', stored)
    check('storeName was persisted to register_settings', stored.get('storeName') == 'テストてん', stored)

    page.reload()
    check('high-contrast survives a reload', 'high-contrast' in (page.get_attribute('body', 'class') or ''))
    check('font-size xxl survives a reload', 'text-xxl' in (page.get_attribute('body', 'class') or ''))
    check('store name survives a reload', page.text_content('#store-name-display') == 'テストてん')

    open_settings_modal(page)
    check('high-contrast toggle reflects the restored setting in the UI',
          page.is_checked('#high-contrast-toggle'))
    check('font-size xxl radio reflects the restored setting in the UI',
          page.is_checked('input[name="font-size"][value="xxl"]'))

    check('no console/page errors during settings persistence', len(errors) == 0, errors[:5])
    page.close()


def group_e_accessibility(browser):
    print('\n=== 12. 既存アクセシビリティ設定 ===')
    page, errors = fresh_page(browser)

    open_settings_modal(page)
    page.locator('label.toggle:has(#switch-scan-toggle)').click()
    page.click('#settings-close')
    page.wait_for_timeout(50)
    check('enabling switch-scan adds the switch-scan body class',
          'switch-scan' in (page.get_attribute('body', 'class') or ''))
    check('switch-scan immediately highlights a scan candidate (no wait for the first timer tick)',
          page.evaluate("!!document.querySelector('.scan-focus')"))
    first_focus_id = page.evaluate("document.querySelector('.scan-focus')?.id")
    # SWITCH_SCAN_SELECTOR (L2064) は.scannableも対象にするため、generator注入の共通
    # フローティングボタン(donomanaA11yBtn等、body直下でheaderより前にある)が
    # register-app自身のheader-actionsより先にdocument順で現れる。
    check('the first scan candidate in document order is the common a11y-panel floating button '
          '(generator-injected, appears before register-app\'s own header in the DOM; deterministic order)',
          first_focus_id == 'donomanaA11yBtn', first_focus_id)

    check('no console/page errors during accessibility checks', len(errors) == 0, errors[:5])
    page.close()


def group_f_csv_injection(browser):
    print('\n=== 13. CSV Formula Injection対策 ===')
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('console', lambda msg: errors.append(msg.text)
            if msg.type == 'error' and msg.text != KNOWN_GENERIC_RESOURCE_FAILURE_TEXT else None)
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.on('requestfailed', lambda req: errors.append('requestfailed: ' + req.url)
            if not _is_known_file_protocol_404(req) else None)
    page.goto(APP_URL)

    page.click('#edit-mode-btn')
    page.click('.add-product-card')
    page.fill('#product-name-input', '=SUM(A1)')
    page.fill('#product-price-input', '777')
    page.click('#product-modal-save')
    page.click('#edit-mode-btn')  # 編集モードを抜ける

    page.locator('.product-card', has_text='=SUM(A1)').click()
    page.click('#payment-btn')
    for d in ['1', '0', '0', '0']:
        page.click('.num-btn[data-num="%s"]' % d)
    page.click('#payment-confirm')

    page.click('#record-open-btn')
    with page.expect_download() as download_info:
        page.click('#record-csv-btn')
    download = download_info.value
    csv_path = download.path()
    csv_text = open(csv_path, encoding='utf-8', errors='replace').read() if csv_path else ''
    check('a CSV file was actually downloaded', bool(csv_path))
    check('a product name starting with "=" is safe-quoted in the exported CSV '
          '(OWASP CSV Formula Injection guard, registerCsvSafeCell)',
          "'=SUM(A1)" in csv_text, csv_text[:400])
    check('the raw, un-quoted formula-like name does not appear unguarded in the CSV',
          ',=SUM(A1)' not in csv_text.replace("'=SUM(A1)", ''), csv_text[:400])

    check('no console/page errors during CSV export', len(errors) == 0, errors[:5])
    page.close()


def group_g_keyboard(browser):
    print('\n=== 14. 既存機能の基本的なキーボード操作 ===')
    page, errors = fresh_page(browser)

    first_card = page.locator('.product-card').first
    first_card.focus()
    page.keyboard.press('Enter')
    check('Enter on a focused product card adds it to the cart', page.text_content('#cart-count') == '1点')
    first_card.focus()
    page.keyboard.press(' ')
    check('Space on a focused product card adds it to the cart too (same product -> qty increments)',
          page.text_content('#cart-count') == '2点')

    add_card = page.locator('.add-product-card')
    page.click('#edit-mode-btn')
    check('add-product-card is keyboard-focusable (tabindex)', add_card.get_attribute('tabindex') == '0')
    add_card.focus()
    page.keyboard.press('Enter')
    check('Enter on the add-product-card opens the product modal', page.is_visible('#product-modal.active'))
    page.click('#product-modal-cancel')
    page.click('#edit-mode-btn')

    # スイッチスキャンのSpaceキー活性化（register-app.html handleScanKey, L2082）
    open_settings_modal(page)
    page.locator('label.toggle:has(#switch-scan-toggle)').click()
    page.click('#settings-close')
    page.wait_for_timeout(50)
    check('switch-scan is active and highlights the first candidate before the keyboard check',
          page.evaluate("document.querySelector('.scan-focus')?.id") == 'donomanaA11yBtn')
    page.keyboard.press(' ')
    check('pressing Space activates the currently-highlighted switch-scan candidate '
          '(donomanaA11yBtn is first in DOM order; activating it opens the common a11y panel)',
          page.evaluate("getComputedStyle(document.getElementById('donomanaA11yPanel')).display") == 'block')

    check('no console/page errors during keyboard operation checks', len(errors) == 0, errors[:5])
    page.close()


def group_h_known_modal_switch_scan_leak(browser):
    print('\n=== 既知の構造的課題の確認（Phase 2 Design finding, 本Phaseでは未修正） ===')
    page, errors = fresh_page(browser)

    open_settings_modal(page)
    page.locator('label.toggle:has(#switch-scan-toggle)').click()
    page.click('#settings-close')

    page.click('#edit-mode-btn')
    page.click('.add-product-card')
    check('product-modal is open for this check', page.is_visible('#product-modal.active'))

    leaked = page.evaluate(
        "(sel) => { const modal = document.getElementById('product-modal'); "
        "return Array.from(document.querySelectorAll(sel)).filter(el => !modal.contains(el))"
        ".map(el => el.id || el.className || el.tagName); }",
        SWITCH_SCAN_SELECTOR,
    )
    check('[既知の課題/EXPECTED FAIL] switch-scan candidates stay scoped inside the open product-modal '
          '(register-app.html L1681-1684: openModal/closeModal do not inert() the background; '
          'L2064 SWITCH_SCAN_SELECTOR queries the whole document regardless of which modal is open; '
          'confirmed in DONOMANA-REGISTER-QR-PHASE-2-DESIGN-1 §8. Not fixed in this Phase — '
          'modal foundation changes are out of scope for Phase 3-1.)',
          len(leaked) == 0, leaked[:8])

    check('no console/page errors during the known-issue check', len(errors) == 0, errors[:5])
    page.close()


# 一部の実行環境（例：事前にChromiumが固定パスへ配置されたCI/クラウド実行環境）では
# Playwright自身が期待するリビジョンのブラウザを自動解決できない場合がある。通常の
# 開発環境では`playwright install chromium`済みの既定解決に任せ、このパスを明示した
# 場合のみそちらを使う（CLAUDE.md §9のポータビリティ方針に合わせ、ハードコードはしない）。
CHROMIUM_EXECUTABLE_PATH = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')


def run():
    with sync_playwright() as p:
        browser = (p.chromium.launch(executable_path=CHROMIUM_EXECUTABLE_PATH)
                   if CHROMIUM_EXECUTABLE_PATH else p.chromium.launch())
        group_a_product_crud(browser)
        group_b_shopping_flow(browser)
        group_c_share_and_ids(browser)
        group_d_settings_persistence(browser)
        group_e_accessibility(browser)
        group_f_csv_injection(browser)
        group_g_keyboard(browser)
        group_h_known_modal_switch_scan_leak(browser)
        browser.close()


if __name__ == '__main__':
    run()
    print('\n=== RESULT ===')
    print('PASS:', pass_count, ' FAIL:', fail_count)
    print('(2 FAILs are EXPECTED as of DONOMANA-REGISTER-QR-PHASE-3-1: '
          '(a) group 9/10 "the app-generated share URL ... successfully imports" — a real, pre-existing bug '
          'in openShareModal()\'s missing encodeURIComponent() (see DONOMANA-REGISTER-QR-PHASE-3-1 report §5); '
          '(b) the final group\'s modal/switch-scan structural-leak check — a known Phase 2 design finding. '
          'Any OTHER FAIL is a new, unexpected regression and must be investigated before proceeding.)')
    sys.exit(1 if fail_count > 0 else 0)
