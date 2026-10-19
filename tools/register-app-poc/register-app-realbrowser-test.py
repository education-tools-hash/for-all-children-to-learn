#!/usr/bin/env python3
"""はんばいかい レジ（register-app.html）— QR機能追加前のベースライン回帰テスト、および
QR発行・読み取り機能そのもののテスト。

- DONOMANA-REGISTER-QR-PHASE-3-1-BASELINE-TESTS-1: ベースライン回帰テストを新設。
- DONOMANA-REGISTER-QR-PHASE-3-1B-SHARE-URL-FIX-1: 共有URL修正の回帰テストを拡張。
- DONOMANA-REGISTER-QR-PHASE-3-2-QR-GENERATION-1: 商品QR発行・表示・印刷のテストを追加。
- DONOMANA-REGISTER-QR-PHASE-3-3-SCANNER-IMPLEMENTATION-1: カメラQR読み取り・カート自動
  加算・二重加算防止・QRモーダルのスイッチスキャン安全性のテストを追加
  （group_l〜group_q）。カメラは実Chromiumのフェイクデバイス
  (--use-fake-device-for-media-stream、必要に応じ--use-file-for-fake-video-captureで
  実QR画像を供給)と、getUserMediaの決定論的なJSモック(権限拒否・非対応等のエラー分岐、
  非同期競合)の両方を使い分けて検証する。二重加算防止ロジック(QR_MIN_LOCK_DURATION_MS /
  QR_MISS_CLEAR_MS)はperformance.now()を疑似クロックに置き換えて完全に決定論的にテストする。

tools/donomana-access-poc/donomana-access-realbrowser-test.py と同じ慣習
(file://でregister-app.htmlを直接開き、headless Chromiumで検証する)。

既存の商品登録・カート・会計・共有・設定・アクセシビリティ・CSV出力・QR発行・QR読み取りが現在
どう動くかを固定した、以後の機能追加（台帳同期QR等）に対する回帰検出の基準とする。

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

DONOMANA-REGISTER-QR-PHASE-3-1で発見し、PHASE-3-1Bで修正した不具合について：
「9〜10. 商品リスト共有URL」のテスト（group_c_share_and_ids）は、Phase 3-1時点では
register-app.html自身が生成する共有URLをそのまま使った場合、ほぼ確実に読み込みが
失敗する不具合を発見していた（openShareModal, L1992/L1995がbase64文字列を
encodeURIComponent()せずに生のままURLへ連結しており、日本語の商品名を含むbase64には
高確率で'+'が含まれ、loadSharedProducts, L2033のURLSearchParams.get()が仕様上'+'を
空白に変換してしまうため、atob()が例外を投げて読み込みに失敗していた）。
Phase 3-1BでopenShareModal()にencodeURIComponent()を追加して修正し（最小差分、
loadSharedProducts()自体は無変更）、本テストはそのPASSへの反転と、特殊文字
(+/=/&)・絵文字入り商品名・複数商品・不正データでのクラッシュ耐性・旧形式URLとの
後方互換性を含む拡張回帰テストに置き換えた。PASS/FAIL件数に含まれる唯一の既知の
FAILは、末尾のモーダル/スイッチスキャンの構造的課題確認（Phase 2設計調査で既発見、
本Phaseでは対象外）のみである。

DONOMANA-REGISTER-QR-PHASE-3-2でQRコード発行機能のテストを追加した。QRの自己往復
検証（生成→実際にデコードして商品IDと一致するか確認）には、生成側ライブラリ
（assets/js/vendor/qrcode-generator/、register-app.html本体にのみ同梱）とは完全に
独立したデコーダとして、Python側で`opencv-python-headless`（OpenCV、MITライセンス、
cv2.QRCodeDetector）を使う。これはテスト専用の依存であり、register-app.html側には
一切同梱・読み込みされない（アプリ本体のライブラリ同梱方針とは無関係）。
実行前に `pip install opencv-python-headless` が必要（Playwright同様、テスト実行者が
別途用意する想定で、register-app.html自体の「追加の有料API・サブスク禁止」方針とは
無関係なローカルOSSツールである）。
"""
import os
import sys
import cv2
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


def wait_modal_opened_and_settled(page, modal_id):
    """register-app.html openModal()(L1358)はモーダルを開いた50ms後に、モーダル内の
    最初のfocus可能要素へ自動的にfocus()する(setTimeout(()=>f.focus(),50))。この
    setTimeoutが、モーダルを開いた直後にPlaywrightのfill()で入力フィールドへ文字を
    入力する処理と競合すると、fill()内部のフォーカス操作と自動focus()がぶつかり、
    入力内容が意図しないフィールドへ混ざる不安定性(flakiness)を本Phaseのテスト実行中に
    実際に観測した(例：価格欄に入力したはずの文字列が名前欄へ連結される)。
    register-app.html側の挙動は変更せず、テスト側でこの50msの自動focusが完了するのを
    待ってから入力を始めることで、競合そのものを避ける。"""
    page.wait_for_selector('#%s.active' % modal_id)
    page.wait_for_timeout(120)


def wait_modal_closed(page, modal_id, timeout=5000):
    """モーダルを閉じるボタンのクリックは同期的にclassList.remove('active')する
    はずだが(register-app.html closeModal, L1359)、まれにクリックが反映されず
    モーダルが開いたまま次の操作に進んでしまう不安定性(flakiness)を本Phaseの
    テスト実行中に観測した(register-app.html側の変更ではなく、テスト側のタイミング
    依存を無くすための対策)。次の操作に進む前に、実際に閉じたことを明示的に待つ。"""
    page.wait_for_function(
        "(id) => !document.getElementById(id).classList.contains('active')",
        arg=modal_id, timeout=timeout)


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
    wait_modal_opened_and_settled(page, 'product-modal')

    page.fill('#product-name-input', 'テスト商品')
    page.fill('#product-price-input', '321')
    page.click('.emoji-option[data-emoji="🍩"]')
    page.click('#product-modal-save')
    wait_modal_closed(page, 'product-modal')
    check('product-modal closes after save', not page.is_visible('#product-modal.active'))
    check('new product now exists with correct name/price',
          any(p['name'] == 'テスト商品' and p['price'] == 321 for p in page.evaluate('products')),
          page.evaluate('products'))
    check('new product card is rendered with its price',
          page.locator('.product-card', has_text='テスト商品').locator('.product-price').text_content() == '¥321')

    # --- 登録時のバリデーション（名前なし／不正な値段） ---
    page.click('.add-product-card')
    wait_modal_opened_and_settled(page, 'product-modal')
    page.click('#product-modal-save')
    check('saving with an empty name is rejected (modal stays open)', page.is_visible('#product-modal.active'))
    page.fill('#product-name-input', '不正な値段テスト')
    page.fill('#product-price-input', '-5')
    page.click('#product-modal-save')
    check('saving with a negative price is rejected (modal stays open)', page.is_visible('#product-modal.active'))
    check('rejected entries were not added to the product list',
          not any(p['name'] in ('', '不正な値段テスト') for p in page.evaluate('products')))
    page.click('#product-modal-cancel')
    wait_modal_closed(page, 'product-modal')

    # --- 編集 ---
    # .edit-overlay は register-app.html L133-134 のとおり :hover/:focus-within 時のみ
    # display:flex になる(既定はdisplay:none)。Playwrightはクリック前の可視性チェックを
    # 先に行うため、ネストしたボタンを直接クリックする前に親カードを明示的にhoverする。
    test_card = page.locator('.product-card', has_text='テスト商品')
    test_card.hover()
    test_card.locator('[data-action="edit"]').click()
    check('product-modal reopens for editing with "商品を編集" title', page.text_content('#pmt') == '商品を編集')
    wait_modal_opened_and_settled(page, 'product-modal')
    check('name field is pre-filled', page.input_value('#product-name-input') == 'テスト商品')
    check('price field is pre-filled', page.input_value('#product-price-input') == '321')
    page.fill('#product-price-input', '555')
    page.click('#product-modal-save')
    wait_modal_closed(page, 'product-modal')
    check('edited price is reflected on the product card',
          page.locator('.product-card', has_text='テスト商品').locator('.product-price').text_content() == '¥555')

    # --- 削除（キャンセル経路） ---
    deletable = page.locator('.product-card', has_text='テスト商品')
    deletable.hover()
    deletable.locator('[data-action="delete"]').click()
    check('delete-modal opens and names the product',
          'テスト商品' in page.text_content('#delete-modal-msg'))
    page.click('#delete-cancel')
    wait_modal_closed(page, 'delete-modal')
    check('product survives a cancelled delete',
          page.locator('.product-card', has_text='テスト商品').count() == 1)

    # --- 削除（確定経路） ---
    deletable2 = page.locator('.product-card', has_text='テスト商品')
    deletable2.hover()
    deletable2.locator('[data-action="delete"]').click()
    page.click('#delete-confirm')
    wait_modal_closed(page, 'delete-modal')
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


def _add_product_via_ui(page, name, price, emoji='🎁'):
    page.click('.add-product-card')
    wait_modal_opened_and_settled(page, 'product-modal')
    page.fill('#product-name-input', name)
    page.fill('#product-price-input', str(price))
    page.click('.emoji-option[data-emoji="%s"]' % emoji)
    page.click('#product-modal-save')
    wait_modal_closed(page, 'product-modal')


def group_c_share_and_ids(browser):
    print('\n=== 9〜10. 商品リスト共有URL・商品IDの保持・画像の取り扱い '
          '(DONOMANA-REGISTER-QR-PHASE-3-1B: encodeURIComponent()修正の回帰確認) ===')
    page1, errors1 = fresh_page(browser)

    # --- 複数商品＋特殊文字(+/=/&)＋絵文字入り商品名を含む編集(作業C 2,3,4) ---
    page1.click('#edit-mode-btn')
    _add_product_via_ui(page1, 'A+Bクッキー', 111, '🍪')
    _add_product_via_ui(page1, '50%=OFFセール🎉', 222, '🧁')
    _add_product_via_ui(page1, 'Q&A用アメ', 333, '🍭')
    page1.click('#edit-mode-btn')

    ids_before = page1.evaluate('products.map(p=>p.id)')
    names_before = page1.evaluate('products.map(p=>p.name)')
    prices_before = page1.evaluate('products.map(p=>p.price)')
    check('source device now has the 4 default products + 3 special-character products (7 total)',
          len(ids_before) == 7, names_before)
    check('special-character product names (+/=/&, emoji-in-name) were accepted as-is',
          {'A+Bクッキー', '50%=OFFセール🎉', 'Q&A用アメ'} <= set(names_before), names_before)

    page1.click('#share-btn')
    check('share-modal opens', page1.is_visible('#share-modal.active'))
    shared_url = page1.text_content('#share-url-display')
    check('a share URL containing the products payload is generated',
          shared_url.startswith('file://') and '?products=' in shared_url, shared_url)
    size_text = page1.text_content('#share-url-size')
    check('share size indicator reports the correct product count (7件)', '7件' in size_text, size_text)
    page1.click('#share-modal-close')

    # --- 修正の根本確認：生成されたURLのクエリ値はpercent-encode済みで、base64を
    #     そのまま復元できることを、本テストスクリプト側で独立に計算したbase64と比較する
    #     (register-app.htmlのbtoa(unescape(encodeURIComponent(JSON.stringify(...))))と
    #     同じ手順をPython側でも再現し、URLに生の'+'/'/'が残っていないことを確認する) ---
    import base64 as b64mod
    import json as jsonmod
    import urllib.parse
    share_data_from_page = page1.evaluate(
        "products.map(p=>({id:p.id,name:p.name,price:p.price,emoji:p.emoji||'🎁'}))")
    expected_payload = jsonmod.dumps(share_data_from_page, ensure_ascii=False, separators=(',', ':'))
    expected_b64 = b64mod.b64encode(expected_payload.encode('utf-8')).decode('ascii')
    raw_query_value = shared_url.split('?products=', 1)[1]
    decoded_query_value = urllib.parse.unquote(raw_query_value)
    check('[修正確認/FIXED] generated share URL query value, once percent-decoded, matches the exact '
          'base64 payload the app itself computed (round-trips correctly through the URL)',
          decoded_query_value == expected_b64, {'expected': expected_b64, 'got': decoded_query_value})
    if '+' in expected_b64:
        check('[修正確認/FIXED] the base64 payload DOES contain a literal "+" in this run, and the URL '
              'correctly carries it as "%2B" rather than a raw "+" (root cause of the Phase 3-1 bug)',
              '%2B' in raw_query_value and '+' not in raw_query_value, raw_query_value[:120])
    else:
        print('  [INFO] this run\'s base64 payload happens not to contain "+"; the %2B-specific assertion '
              'above is skipped for this run, but the full round-trip check above still covers it.')

    # --- 実際にアプリが生成したURLそのままでの読み込み（実際の利用シナリオ、修正後は成功するはず） ---
    page2, errors2 = fresh_page(browser)
    page2.goto(shared_url)
    toast_after_real_url = page2.evaluate("document.getElementById('toast-wrap').textContent")
    check('[修正確認/FIXED] the app-generated share URL, used exactly as the app itself produces it '
          '(including special-character/emoji product names), now successfully imports on another device '
          '(was the Phase 3-1 FAIL; register-app.html openShareModal() now encodeURIComponent()s the '
          'base64 payload before building the URL)',
          '読み込みました' in toast_after_real_url and '失敗' not in toast_after_real_url,
          toast_after_real_url)
    check('importing device no longer shows the ?products= query after import',
          'products=' not in page2.url, page2.url)

    ids_after = page2.evaluate('products.map(p=>p.id)')
    check('(作業C-5) product IDs are preserved across share/import (same ID set, not re-issued)',
          set(ids_before) == set(ids_after), (ids_before, ids_after))
    names_after = page2.evaluate('products.map(p=>p.name)')
    check('(作業C-1,2,3,4) all product names incl. Japanese/emoji/+/=/& are preserved byte-for-byte',
          sorted(names_before) == sorted(names_after), (names_before, names_after))
    prices_after_map = {p['id']: p['price'] for p in page2.evaluate('products')}
    prices_match = all(prices_after_map.get(pid) == price
                        for pid, price in zip(ids_before, prices_before))
    check('(作業C-6) prices are preserved exactly for every product', prices_match,
          (ids_before, prices_before, prices_after_map))

    images_after = page2.evaluate('products.map(p=>p.image)')
    check('(作業C-7) imported products all have image=null (existing spec: photos are not shared)',
          all(img is None for img in images_after), images_after)

    stored_ids = page2.evaluate("JSON.parse(localStorage.getItem('register_products')||'[]').map(p=>p.id)")
    check('(作業C-8) imported product list was persisted to register_products on the importing device',
          set(stored_ids) == set(ids_before), stored_ids)

    # --- (作業C-9) 不正な共有データでもクラッシュしない（真に壊れたデータの既存のcatch経路） ---
    page3, errors3 = fresh_page(browser)
    page3.goto(APP_URL + '?products=%E3%81%82%E3%81%84!!!not-valid-base64')
    toast_invalid = page3.evaluate("document.getElementById('toast-wrap').textContent")
    check('(作業C-9) genuinely invalid share data does not crash the page and shows the existing '
          'graceful failure toast', '失敗' in toast_invalid, toast_invalid)
    products_after_invalid = page3.evaluate('products.map(p=>p.name)')
    check('(作業C-9) after invalid share data, the app still falls back to a usable product list '
          '(the existing default-seed fallback, unchanged by this fix)',
          len(products_after_invalid) == 4, products_after_invalid)

    # --- (作業C-10) 従来の正常な共有URL（'+'を含まない、修正前の生のまま連結した形式）との互換性 ---
    # loadSharedProducts()自体は本Phaseで変更していないため、'+'を含まない(=修正前のコードでも
    # 元々正しく動いていた)旧形式のURLは今後も同一に動作するはずであることを確認する。
    legacy_candidates = [
        [{'id': 'legacy-aaa', 'name': 'りんご', 'price': 50, 'emoji': '🍎'}],
        [{'id': 'legacy-bbb', 'name': 'みかん', 'price': 60, 'emoji': '🍊'}],
        [{'id': 'legacy-ccc', 'name': 'バナナ', 'price': 70, 'emoji': '🍌'}],
    ]
    legacy_payload = None
    legacy_b64 = None
    for cand in legacy_candidates:
        s = jsonmod.dumps(cand, ensure_ascii=False, separators=(',', ':'))
        b = b64mod.b64encode(s.encode('utf-8')).decode('ascii')
        if '+' not in b:
            legacy_payload, legacy_b64 = cand, b
            break
    check('(作業C-10) found a "+"-free legacy-style payload to simulate an old, already-working share URL',
          legacy_b64 is not None, legacy_b64)
    if legacy_b64 is not None:
        legacy_url = APP_URL + '?products=' + legacy_b64  # 修正前のコードと同じ、未encodeの生の連結
        page4, errors4 = fresh_page(browser)
        page4.goto(legacy_url)
        legacy_names_after = page4.evaluate('products.map(p=>p.name)')
        check('(作業C-10) a legacy-style ("+"-free, un-percent-encoded) share URL still imports correctly '
              'after this fix (loadSharedProducts() itself is unchanged, so previously-working URLs keep '
              'working — this fix only changes how NEW URLs are generated)',
              legacy_names_after == [legacy_payload[0]['name']], legacy_names_after)
        check('no console/page errors on the legacy-URL-compat device', len(errors4) == 0, errors4[:5])
        page4.close()

    check('no console/page errors on the sharing device', len(errors1) == 0, errors1[:5])
    check('no console/page errors on the importing device', len(errors2) == 0, errors2[:5])
    check('no console/page errors on the invalid-data device', len(errors3) == 0, errors3[:5])
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
    wait_modal_opened_and_settled(page, 'product-modal')
    page.fill('#product-name-input', '=SUM(A1)')
    page.fill('#product-price-input', '777')
    page.click('#product-modal-save')
    wait_modal_closed(page, 'product-modal')
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
    wait_modal_closed(page, 'product-modal')
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


def _decode_qr_from_element_screenshot(page, locator, tmp_path):
    """qrcode-generator(生成側)とは完全に独立したデコーダ(OpenCV cv2.QRCodeDetector)で
    実際にQRをデコードする(作業Eの指定どおり)。要素をPNGへスクリーンショットし、
    OpenCVの画像処理でQRを検出・デコードする——JS側のロジックを一切経由しない。"""
    locator.screenshot(path=tmp_path)
    img = cv2.imread(tmp_path)
    try:
        os.remove(tmp_path)
    except OSError:
        pass
    if img is None:
        return None
    detector = cv2.QRCodeDetector()
    data, points, _ = detector.detectAndDecode(img)
    return data or None


def group_i_qr_generation(browser):
    print('\n=== QRコード生成（DONOMANA-REGISTER-QR-PHASE-3-2） ===')
    page, errors = fresh_page(browser)

    check('qrcode-generator library (vendored, assets/js/vendor/qrcode-generator/qrcode.js) loaded',
          page.evaluate("typeof qrcode") == 'function')

    ids = page.evaluate('products.map(p=>p.id)')
    names = page.evaluate('products.map(p=>p.name)')
    prices = page.evaluate('products.map(p=>p.price)')

    # 🔳ボタンは編集モード中のみ.edit-overlay(L133-134、:hover/:focus-within時のみ表示)に出る
    page.click('#edit-mode-btn')

    # (作業E-1,2,3,4) 商品ごとのQR生成・ペイロードと商品IDの一致・商品名/価格が含まれない・複数商品
    decoded = {}
    for idx, pid in enumerate(ids):
        card = page.locator('.product-card').nth(idx)
        card.hover()
        card.locator('[data-action="qr"]').click()
        page.wait_for_selector('#qr-modal.active')
        decoded[pid] = _decode_qr_from_element_screenshot(
            page, page.locator('.qr-svg-wrap'), '/tmp/_regqr_%s.png' % pid)
        page.click('#qr-modal-close')
        wait_modal_closed(page, 'qr-modal')

    check('(作業E-1) a QR code was generated and independently decodable for every product',
          all(v is not None for v in decoded.values()), decoded)
    for pid, name, price in zip(ids, names, prices):
        check('(作業E-2) QR payload for "%s" decodes to exactly DMREG1:<id>, matching the product ID' % name,
              decoded.get(pid) == 'DMREG1:' + pid, decoded.get(pid))
        check('(作業E-3) decoded payload for "%s" contains neither the product name nor its price '
              '(only the DMREG1: prefix + opaque ID)' % name,
              decoded.get(pid) == 'DMREG1:' + pid and name not in (decoded.get(pid) or '') and
              str(price) not in (decoded.get(pid) or '').replace(pid, ''),
              decoded.get(pid))
    check('(作業E-4) multiple distinct products produce distinct, independently-decodable QR payloads',
          len(set(decoded.values())) == len(ids), decoded)

    # (作業E-7) QRモーダルの開閉
    page.locator('.product-card').first.hover()
    page.locator('.product-card').first.locator('[data-action="qr"]').click()
    check('(作業E-7) QR modal opens', page.is_visible('#qr-modal.active'))
    page.click('#qr-modal-close')
    wait_modal_closed(page, 'qr-modal')
    check('(作業E-7) QR modal closes via its close button', not page.is_visible('#qr-modal.active'))
    page.keyboard.press('Escape')  # 全モーダル共通のEscapeハンドラでも閉じられることの確認（既に閉じていても無害）
    check('(作業E-7) QR modal stays closed (Escape is harmless when already closed)',
          not page.is_visible('#qr-modal.active'))

    # (作業E-5) 商品編集後も同じIDのQRが生成される
    first_id = ids[0]
    card0 = page.locator('.product-card').first
    card0.hover()
    card0.locator('[data-action="edit"]').click()
    wait_modal_opened_and_settled(page, 'product-modal')
    page.fill('#product-price-input', '999')
    page.click('#product-modal-save')
    wait_modal_closed(page, 'product-modal')
    card0b = page.locator('.product-card').first
    card0b.hover()
    card0b.locator('[data-action="qr"]').click()
    page.wait_for_selector('#qr-modal.active')
    decoded_after_edit = _decode_qr_from_element_screenshot(
        page, page.locator('.qr-svg-wrap'), '/tmp/_regqr_after_edit.png')
    check('(作業E-5) editing a product\'s price/name does not change its ID — the QR payload is unchanged',
          decoded_after_edit == 'DMREG1:' + first_id, decoded_after_edit)
    page.click('#qr-modal-close')
    wait_modal_closed(page, 'qr-modal')

    # (作業E-6) 商品削除後のQR発行不可（不正な商品IDへの安全な処理、実装D）
    deleted_id = ids[1]
    deleted_name = names[1]
    card1 = page.locator('.product-card', has_text=deleted_name)
    card1.hover()
    card1.locator('[data-action="delete"]').click()
    page.click('#delete-confirm')
    wait_modal_closed(page, 'delete-modal')
    check('(作業E-6) the product used for this check is actually gone from the product list',
          deleted_id not in page.evaluate('products.map(p=>p.id)'))
    page.evaluate("openQrModal(%r)" % deleted_id)  # 削除済みIDで直接QRモーダルを呼び出す(不正な参照を模擬)
    check('(作業E-6) calling openQrModal() with a deleted/invalid product ID does NOT open the modal',
          not page.is_visible('#qr-modal.active'))
    toast_after_invalid = page.evaluate("document.getElementById('toast-wrap').textContent")
    check('(作業E-6) a clear, non-crashing error message is shown for an invalid/deleted product ID',
          '見つかりません' in toast_after_invalid, toast_after_invalid)

    check('no console/page errors during QR generation checks', len(errors) == 0, errors[:5])
    page.close()


def group_i2_qr_modal_leak_not_worse(browser):
    """qr-modalが既存のproduct-modalと比べて「新たな危険を増やしていない」ことを、
    group_hと同じ条件(新規4商品・編集モードに入った直後・他の編集操作をしていない)の
    フレッシュなページで公平に比較する(前段のgroup_iはその後に商品編集/削除を行って
    いるため状態が異なり、単純な個数比較はフェアでない)。"""
    print('\n=== QRモーダルは既存モーダルより危険を増やしていないことの確認 ===')
    page, errors = fresh_page(browser)

    open_settings_modal(page)
    page.locator('label.toggle:has(#switch-scan-toggle)').click()
    page.click('#settings-close')
    page.click('#edit-mode-btn')

    page.click('.add-product-card')
    leaked_product_modal = page.evaluate(
        "(sel) => { const modal = document.getElementById('product-modal'); "
        "return Array.from(document.querySelectorAll(sel)).filter(el => !modal.contains(el))"
        ".map(el => el.id || el.className || el.tagName); }",
        SWITCH_SCAN_SELECTOR,
    )
    page.click('#product-modal-cancel')
    wait_modal_closed(page, 'product-modal')

    page.locator('.product-card').first.hover()
    page.locator('.product-card').first.locator('[data-action="qr"]').click()
    page.wait_for_selector('#qr-modal.active')
    leaked_qr_modal = page.evaluate(
        "(sel) => { const modal = document.getElementById('qr-modal'); "
        "return Array.from(document.querySelectorAll(sel)).filter(el => !modal.contains(el))"
        ".map(el => el.id || el.className || el.tagName); }",
        SWITCH_SCAN_SELECTOR,
    )
    check('under identical conditions, qr-modal leaks the same set of switch-scan candidates as the '
          'pre-existing product-modal (register-app\'s known structural issue is not made worse by the '
          'new QR modal — it shares the exact same .modal-overlay/openModal/closeModal mechanism, not a '
          'new or wider leak)',
          sorted(leaked_qr_modal) == sorted(leaked_product_modal),
          {'product-modal': leaked_product_modal, 'qr-modal': leaked_qr_modal})
    page.click('#qr-modal-close')

    check('no console/page errors', len(errors) == 0, errors[:5])
    page.close()


def group_j_qr_print(browser):
    print('\n=== QR印刷統合（DONOMANA-REGISTER-QR-PHASE-3-2） ===')
    page, errors = fresh_page(browser)

    # (作業E-9) 既存印刷機能の維持：QR表示オプションを一切触らない既定状態での出力が従来通りであること
    page.click('#print-btn')
    check('print-show-qr checkbox exists and defaults to OFF (backward compatible with existing printouts)',
          not page.is_checked('#print-show-qr'))
    default_preview = page.evaluate("document.getElementById('print-preview').innerHTML")
    check('(作業E-9) default print preview (QR option untouched) contains no QR svg — '
          'existing print output is unchanged unless the new option is explicitly turned on',
          '<svg' not in default_preview, default_preview[:200])

    # (作業E-8) QR一覧印刷の内容：カード形式
    page.check('#print-show-qr')
    page.wait_for_timeout(100)
    preview_with_qr_card = page.evaluate("document.getElementById('print-preview').innerHTML")
    product_count = page.evaluate('products.length')
    check('(作業E-8) enabling the QR option renders one QR <svg> per product in the card-layout preview',
          preview_with_qr_card.count('<svg') == product_count, preview_with_qr_card.count('<svg'))

    # (作業E-8) QR一覧印刷の内容：一覧（リスト）形式
    page.check('input[name="print-layout"][value="list"]', force=True)
    page.wait_for_timeout(100)
    preview_with_qr_list = page.evaluate("document.getElementById('print-preview').innerHTML")
    check('(作業E-8) the QR option also renders one QR <svg> per product in the list-layout preview',
          preview_with_qr_list.count('<svg') == product_count, preview_with_qr_list.count('<svg'))
    check('list-layout print preview still has a 商品名 column header (existing columns preserved)',
          '商品名' in preview_with_qr_list, preview_with_qr_list[:300])

    # QR生成失敗時の安全なフォールバック（実装D）：壊れた商品データでもbuildPrintHTML自体は例外を出さない
    safe_result = page.evaluate("""
        () => {
            try { return buildQrSvgForProduct(null, 4, 16); }
            catch (e) { return 'THREW: ' + e; }
        }
    """)
    check('buildQrSvgForProduct() degrades gracefully (no uncaught exception) for a malformed product id',
          not safe_result.startswith('THREW'), safe_result[:120])

    page.click('#print-modal-close')
    check('no console/page errors during QR print checks', len(errors) == 0, errors[:5])
    page.close()


def group_k_qr_license(browser):
    print('\n=== (作業E-11) ライセンス同梱確認 ===')
    vendor_dir = os.path.join(ROOT, 'assets', 'js', 'vendor', 'qrcode-generator')
    lib_path = os.path.join(vendor_dir, 'qrcode.js')
    license_path = os.path.join(vendor_dir, 'LICENSE.txt')

    check('vendored qrcode-generator library file exists locally (no external CDN)',
          os.path.isfile(lib_path), lib_path)
    check('a dedicated LICENSE.txt is bundled alongside the vendored library',
          os.path.isfile(license_path), license_path)

    if os.path.isfile(lib_path):
        lib_text = open(lib_path, encoding='utf-8').read()
        check('the vendored library file itself carries a copyright/license header comment',
              'Kazuhiko Arase' in lib_text and 'MIT' in lib_text, lib_text[:400])
    if os.path.isfile(license_path):
        license_text = open(license_path, encoding='utf-8').read()
        check('LICENSE.txt contains the full MIT License text',
              'MIT License' in license_text and 'Permission is hereby granted' in license_text,
              license_text[:200])
        check('LICENSE.txt names the correct copyright holder',
              'Kazuhiko Arase' in license_text, license_text[:200])

    # DONOMANA-REGISTER-QR-PHASE-3-3: jsQR(読み取り用)のライセンス同梱確認
    jsqr_dir = os.path.join(ROOT, 'assets', 'js', 'vendor', 'jsqr')
    jsqr_lib_path = os.path.join(jsqr_dir, 'jsQR.js')
    jsqr_license_path = os.path.join(jsqr_dir, 'LICENSE.txt')
    check('vendored jsQR library file exists locally (no external CDN)',
          os.path.isfile(jsqr_lib_path), jsqr_lib_path)
    check('a dedicated LICENSE.txt is bundled alongside the vendored jsQR library',
          os.path.isfile(jsqr_license_path), jsqr_license_path)
    if os.path.isfile(jsqr_license_path):
        jsqr_license_text = open(jsqr_license_path, encoding='utf-8').read()
        check('jsQR LICENSE.txt contains the Apache License 2.0 text',
              'Apache License' in jsqr_license_text and 'Version 2.0' in jsqr_license_text,
              jsqr_license_text[:200])


FAKE_CAMERA_ARGS = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
FAKE_CLOCK_INIT_SCRIPT = "window.__fakeNow = 0; performance.now = () => window.__fakeNow;"


def fresh_page_in_context(context):
    """fresh_page()と同じエラー収集をcontextに対して行う版（context.add_init_script()で
    getUserMediaのモックや疑似クロックを注入してから使う場合に用いる）。"""
    page = context.new_page()
    console_errors = []
    page.on('console', lambda msg: console_errors.append(msg.text)
            if msg.type == 'error' and msg.text != KNOWN_GENERIC_RESOURCE_FAILURE_TEXT else None)
    page.on('pageerror', lambda exc: console_errors.append(str(exc)))
    page.on('requestfailed', lambda req: console_errors.append('requestfailed: ' + req.url)
            if not _is_known_file_protocol_404(req) else None)
    page.goto(APP_URL)
    return page, console_errors


def group_l_qr_mode_and_settings(browser):
    print('\n=== (作業F-1) QRモードON/OFFと保存復元 ===')
    page, errors = fresh_page(browser)

    check('QR mode starts OFF and the scan button is hidden',
          not page.evaluate('settings.qrMode') and not page.is_visible('#qr-scan-btn'))
    check('the product grid is tappable even before QR mode is ever turned on (always-on tap path)',
          page.locator('.product-card').count() > 0)

    page.click('#qr-mode-btn')
    check('clicking the header QR-mode button turns QR mode ON immediately (no settings-modal needed)',
          page.evaluate('settings.qrMode') is True)
    check('the large "商品をスキャン" button appears once QR mode is ON', page.is_visible('#qr-scan-btn'))
    check('the header button reflects the ON state (aria-pressed)',
          page.get_attribute('#qr-mode-btn', 'aria-pressed') == 'true')
    stored = page.evaluate("JSON.parse(localStorage.getItem('register_settings')||'{}')")
    check('qrMode=true is persisted to register_settings immediately (header toggle is not batched '
          'like the settings-modal toggles)', stored.get('qrMode') is True, stored)

    page.locator('.product-card').first.click()
    check('tapping a product still works normally while QR mode is ON (tap path always stays active)',
          page.text_content('#cart-count') == '1点')

    page.reload()
    check('QR mode survives a reload (restored from register_settings)',
          page.evaluate('settings.qrMode') is True)
    check('the scan button is shown again after reload', page.is_visible('#qr-scan-btn'))

    page.click('#qr-mode-btn')
    check('clicking the header button again turns QR mode back OFF',
          page.evaluate('settings.qrMode') is False)
    check('the scan button is hidden again once QR mode is OFF', not page.is_visible('#qr-scan-btn'))

    check('no console/page errors during QR mode checks', len(errors) == 0, errors[:5])
    page.close()


def group_m_scanner_camera_errors(browser):
    print('\n=== (作業F-2,3) カメラ起動エラーの区別（権限拒否・カメラ無し・非対応） ===')
    scenarios = [
        ('NotAllowedError', '許可されていません', '権限拒否 (NotAllowedError)'),
        ('NotFoundError', '見つかりません', 'カメラ無し (NotFoundError)'),
        ('AbortError', '起動に失敗', 'その他のエラー (AbortError)'),
    ]
    for error_name, expected_substr, label in scenarios:
        context = browser.new_context()
        context.add_init_script(
            "navigator.mediaDevices.getUserMedia = () => Promise.reject("
            "Object.assign(new Error('mock'), {name: %s}));" % repr(error_name)
        )
        page, errors = fresh_page_in_context(context)
        page.click('#qr-mode-btn')
        page.click('#qr-scan-btn')
        page.wait_for_timeout(300)
        msg = page.text_content('#qr-scanner-state-message')
        check('(作業F-2/3) %s: shows a distinguishable, non-crashing message containing "%s"'
              % (label, expected_substr), expected_substr in msg, msg)
        check('(作業F-2/3) %s: a fallback to manual selection is always offered' % label,
              page.is_visible('#qr-scanner-manual-btn'))
        page.click('#qr-scanner-manual-btn')
        check('(作業F-2/3) %s: manual-selection button closes the modal, returning to the tap grid'
              % label, not page.is_visible('#qr-scanner-modal.active'))
        check('no console/page errors for %s' % label, len(errors) == 0, errors[:5])
        page.close()
        context.close()

    # 非対応ブラウザ(getUserMediaそのものが存在しない)
    context = browser.new_context()
    context.add_init_script("navigator.mediaDevices.getUserMedia = undefined;")
    page, errors = fresh_page_in_context(context)
    page.click('#qr-mode-btn')
    page.click('#qr-scan-btn')
    page.wait_for_timeout(300)
    msg = page.text_content('#qr-scanner-state-message')
    check('(作業F-2/3) unsupported browsers (no getUserMedia at all) show a clear, non-crashing '
          'message rather than throwing', '対応していません' in msg, msg)
    check('no console/page errors for the unsupported-browser case', len(errors) == 0, errors[:5])
    page.close()
    context.close()


def group_n_scanner_decode_and_debounce(browser):
    print('\n=== (作業F-4〜11) QR照合・二重加算防止ロジック（決定論的な疑似クロック） ===')
    context = browser.new_context()
    context.add_init_script(FAKE_CLOCK_INIT_SCRIPT)
    page, errors = fresh_page_in_context(context)

    ids = page.evaluate('products.map(p=>p.id)')
    product_a, product_b = ids[0], ids[1]

    def tick(now_ms, raw):
        arg = 'null' if raw is None else ('"' + raw.replace('"', '\\"') + '"')
        page.evaluate("window.__fakeNow=%d; handleDetectionTick(%s)" % (int(now_ms), arg))

    def cart_qty_for(pid):
        return page.evaluate("(cart.find(i=>i.id===%s)||{qty:0}).qty" % repr(pid))

    min_lock = page.evaluate('QR_MIN_LOCK_DURATION_MS')
    miss_clear = page.evaluate('QR_MISS_CLEAR_MS')
    check('(実装D) QR_MIN_LOCK_DURATION_MS and QR_MISS_CLEAR_MS are defined as positive, testable '
          'millisecond constants (reported in the Phase report)',
          isinstance(min_lock, (int, float)) and isinstance(miss_clear, (int, float))
          and min_lock > 0 and miss_clear > 0, {'min_lock': min_lock, 'miss_clear': miss_clear})

    # (作業F-4) 正常QRからのカート加算
    tick(0, 'DMREG1:' + product_a)
    check('(作業F-4) a valid, registered QR immediately adds the product to the cart',
          cart_qty_for(product_a) == 1, page.evaluate('cart'))
    check('a locked id is recorded after a valid scan', page.evaluate('scannerLockedId') == product_a)

    # (作業F-6) 同一QRの連続映像で二重加算しない
    tick(50, 'DMREG1:' + product_a)
    tick(100, 'DMREG1:' + product_a)
    check('(作業F-6) the same QR staying in view for consecutive frames adds only once',
          cart_qty_for(product_a) == 1, cart_qty_for(product_a))

    # (作業F-7) 一時的なデコード欠落（MIN_LOCK未満）で二重加算しない
    tick(150, None)
    tick(200, None)
    tick(min(250, min_lock - 10) if min_lock > 10 else 250, 'DMREG1:' + product_a)
    check('(作業F-7) a brief decode dropout well under the min-lock window does not cause a '
          're-add when the same code reappears', cart_qty_for(product_a) == 1, cart_qty_for(product_a))

    # (作業F-8) QR退出後の再読取：min_lock + miss_clearを十分に超えてから欠落させ、解除を確認する
    t_exit = 250 + min_lock + miss_clear + 200
    tick(t_exit, None)
    check('(作業F-8) after sustained absence beyond min-lock+miss-clear, the lock releases',
          page.evaluate('scannerLockedId') is None, page.evaluate('scannerLockedId'))
    tick(t_exit + 50, 'DMREG1:' + product_a)
    check('(作業F-8) re-presenting the same QR after it was genuinely out of view re-adds it '
          '(intentional repeat purchase stays possible)', cart_qty_for(product_a) == 2,
          cart_qty_for(product_a))

    # (作業F-9) 異なる商品QRの連続読取：ロック中でも別商品は即座に受理される
    tick(t_exit + 60, 'DMREG1:' + product_b)
    check('(作業F-9) a different product\'s QR is accepted immediately even while another product '
          'is still locked — it does not have to wait for miss-clear', cart_qty_for(product_b) == 1,
          cart_qty_for(product_b))
    check('the lock switches to the newly-scanned different product',
          page.evaluate('scannerLockedId') == product_b)

    # (作業F-5) 未登録・不正QRの拒否
    before_cart = page.evaluate('cart.length')
    for bad in ['DMREG1:does-not-exist-id', 'NOT-THE-RIGHT-PREFIX:' + product_a,
                'DMREG1:' + ('x' * 300), '', 'DMREG1:', '<img src=x onerror=alert(1)>']:
        tick(t_exit + 70, bad)
    check('(作業F-5) unregistered IDs, wrong prefixes, oversized payloads, and garbage/HTML-shaped '
          'strings never add anything to the cart', page.evaluate('cart.length') == before_cart,
          page.evaluate('cart'))
    unreg_html = page.evaluate("document.getElementById('qr-scanner-result').innerHTML")
    check('(実装C) an unregistered-but-correctly-prefixed QR shows a visible "not registered" '
          'message built from a fixed string — the raw decoded QR text is never inserted into '
          'innerHTML', '登録されていません' in unreg_html and 'does-not-exist-id' not in unreg_html,
          unreg_html)

    # (作業F-10) 確認モード：受理後、明示操作まで次の加算をしない
    page.evaluate("settings.qrConfirmStep = true; scannerLockedId = null; scannerAwaitingConfirm = false;")
    t2 = t_exit + 1000
    tick(t2, 'DMREG1:' + product_a)
    check('(作業F-10) confirm mode still accepts the first scan normally',
          page.evaluate('scannerAwaitingConfirm') is True)
    qty_a_after_confirm_scan = cart_qty_for(product_a)
    tick(t2 + 50, 'DMREG1:' + product_b)
    check('(作業F-10) while awaiting confirmation, even a different product\'s QR is ignored until '
          'the explicit action is taken',
          cart_qty_for(product_a) == qty_a_after_confirm_scan, cart_qty_for(product_a))

    # (作業F-11) 明示的な再読取操作（実際の「次の商品をよみとる」ボタンのクリックハンドラを使う）。
    # このテストグループはモーダルを開かず(カメラ不要)ロジックのみを決定論的に検証しているため、
    # #qr-scanner-modal自体がinactive(pointer-events:none)で実マウスクリックが背景のSECTIONへ
    # 透過してしまう。モーダルUIとしての実クリック経路の実在性はgroup_o/qで別途検証しているため、
    # ここではハンドラの直接呼び出し(.click())で同じコードパスを確実に起動する。
    page.evaluate("document.getElementById('qr-scanner-next-btn').click()")
    check('(作業F-11) clicking "次の商品をよみとる" clears the awaiting-confirm state',
          page.evaluate('scannerAwaitingConfirm') is False)
    qty_b_before_reset_scan = cart_qty_for(product_b)
    tick(t2 + 100, 'DMREG1:' + product_b)
    check('(作業F-11) after the explicit reset, the next scan is accepted again (qty increments, '
          'consistent with addToCart()\'s existing same-product behavior)',
          cart_qty_for(product_b) == qty_b_before_reset_scan + 1, cart_qty_for(product_b))

    check('no console/page errors during decode/debounce checks', len(errors) == 0, errors[:5])
    page.close()
    context.close()


def group_o_scanner_lifecycle_and_async_race(playwright_instance, browser):
    print('\n=== (作業F-12,13) モーダル終了後のカメラ停止・非同期起動競合/多重起動防止 ===')

    # (作業F-12) モーダル終了後のカメラ停止：実カメラ(フェイクデバイス)での確認
    # 既にrun()内でsync_playwright()のコンテキストに入っているため、ここではネストして
    # 新規に開始せず、同じplaywright_instanceからカメラ用引数つきの別Chromiumを起動する。
    cam_browser = playwright_instance.chromium.launch(
        executable_path=CHROMIUM_EXECUTABLE_PATH if CHROMIUM_EXECUTABLE_PATH else None,
        args=FAKE_CAMERA_ARGS,
    )
    cam_context = cam_browser.new_context()
    cam_context.grant_permissions(['camera'])
    page, errors = fresh_page_in_context(cam_context)
    page.click('#qr-mode-btn')
    page.click('#qr-scan-btn')
    page.wait_for_timeout(500)
    check('(作業F-12 setup) camera stream and decode loop are actually running before close',
          page.evaluate('!!scannerStream') and page.evaluate('!!scannerDecodeLoopHandle'))
    page.click('#qr-scanner-close-btn')
    page.wait_for_timeout(200)
    check('(作業F-12) closing the modal stops the camera stream',
          page.evaluate('!scannerStream'))
    check('(作業F-12) closing the modal cancels the decode loop',
          page.evaluate('!scannerDecodeLoopHandle'))
    check('(作業F-12) the video element\'s srcObject is cleared on close',
          page.evaluate("document.getElementById('qr-scanner-video').srcObject") is None)
    check('no console/page errors during the real-camera lifecycle check', len(errors) == 0,
          errors[:5])
    page.close()
    cam_browser.close()

    # (作業F-13) 非同期起動競合・多重起動防止：getUserMediaを手動制御可能なPromiseでモックする
    context = browser.new_context()
    context.add_init_script("""
        window.__gumCalls = 0;
        window.__gumResolvers = [];
        navigator.mediaDevices.getUserMedia = () => {
            window.__gumCalls++;
            return new Promise((resolve) => { window.__gumResolvers.push(resolve); });
        };
        window.__makeFakeStream = () => {
            const track = { stopped: false, stop() { this.stopped = true; } };
            return { __track: track, getTracks: () => [track] };
        };
    """)
    page, errors = fresh_page_in_context(context)
    page.click('#qr-mode-btn')

    page.evaluate("openScannerModal()")
    page.evaluate("startCamera()")  # 起動進行中に重ねて呼んでも多重起動しないはず
    page.wait_for_timeout(100)
    check('(作業F-13) calling startCamera() again while a start is already in flight does not '
          'call getUserMedia a second time', page.evaluate('window.__gumCalls') == 1,
          page.evaluate('window.__gumCalls'))

    # モーダルを閉じてから(非同期のgetUserMediaが完了する前に)Promiseを解決させる
    page.click('#qr-scanner-close-btn')
    page.wait_for_timeout(50)
    page.evaluate("""
        window.__lastFakeStream = window.__makeFakeStream();
        window.__gumResolvers[0](window.__lastFakeStream);
    """)
    page.wait_for_timeout(100)
    was_stopped = page.evaluate("window.__lastFakeStream.getTracks()[0].stopped")
    check('(作業F-13) a getUserMedia promise that resolves AFTER the modal was already closed is '
          'stopped immediately and never assigned as the active stream',
          was_stopped is True and page.evaluate('!scannerStream'), was_stopped)

    check('no console/page errors during the async-race checks', len(errors) == 0, errors[:5])
    page.close()
    context.close()


def group_p_scanner_switch_scan_safety(browser):
    print('\n=== (作業F-14 / 実装E) QRモーダル表示中の背景操作防止 ===')
    context = browser.new_context()
    context.add_init_script("navigator.mediaDevices.getUserMedia = () => new Promise(() => {});")
    page, errors = fresh_page_in_context(context)

    open_settings_modal(page)
    page.locator('label.toggle:has(#switch-scan-toggle)').click()
    page.click('#settings-close')
    page.click('#qr-mode-btn')

    # 背景にスイッチスキャン候補が複数あることを先に確認(商品カード・会計ボタン等)
    candidates_before = page.evaluate(
        "Array.from(document.querySelectorAll(%r)).length" % SWITCH_SCAN_SELECTOR)
    check('background has multiple switch-scan candidates before opening the scanner modal '
          '(sanity check)', candidates_before > 1, candidates_before)

    page.click('#qr-scan-btn')
    page.wait_for_selector('#qr-scanner-modal.active')

    scoped_items = page.evaluate(
        "(sel) => { const modal = document.getElementById('qr-scanner-modal'); "
        "return Array.from(document.querySelectorAll(sel)).filter(el => !modal.contains(el))"
        ".map(el => el.id || el.className || el.tagName); }",
        SWITCH_SCAN_SELECTOR,
    )
    check('(作業F-14/実装E) [FIXED] while the QR scanner modal is open, buildScanItems() returns '
          'ONLY elements inside the modal — background product cards and checkout buttons are not '
          'switch-scan candidates at all (register-app.html buildScanItems() scopes to the open '
          'qr-scanner-modal; other modals\' pre-existing leak, confirmed unchanged by group_h, is '
          'intentionally left alone per scope)',
          page.evaluate("buildScanItems().every(el => "
                         "document.getElementById('qr-scanner-modal').contains(el))"),
          scoped_items)

    all_background_inert = page.evaluate(
        "(sel) => Array.from(document.querySelectorAll(sel))"
        ".filter(el => !document.getElementById('qr-scanner-modal').contains(el) "
        "&& el.id!=='donomanaA11yBtn' && !el.closest('#donomanaA11yPanel'))"
        ".every(el => el.inert === true)", SWITCH_SCAN_SELECTOR)
    check('every element matching SWITCH_SCAN_SELECTOR outside the scanner modal is inert while it '
          'is open (blocks real pointer/touch interaction with the background too, not just '
          'switch-scan)', all_background_inert)

    check('switch-scan immediately highlights a candidate inside the now-open scanner modal',
          page.evaluate("document.getElementById('qr-scanner-modal')"
                         ".contains(document.querySelector('.scan-focus'))"))

    page.keyboard.press(' ')  # Space はhandleScanKey経由でactivateCurrentScanItemを呼ぶ
    check('pressing Space while the scanner modal is open activates something inside the modal, '
          'never a background product/checkout control',
          not page.evaluate('cart.length > 0'))  # 背景の商品カードが発火していればcartが増えてしまう

    page.click('#qr-scanner-close-btn')
    page.wait_for_timeout(100)
    check('closing the scanner modal restores the normal (document-wide) switch-scan scope',
          page.evaluate("buildScanItems().length") >= candidates_before)
    check('background elements are no longer inert after the scanner modal closes',
          page.evaluate("document.querySelector('.product-card').inert") is False)

    check('no console/page errors during switch-scan safety checks', len(errors) == 0, errors[:5])
    page.close()
    context.close()


def group_q_scanner_realistic_camera_e2e(playwright_instance, browser):
    print('\n=== 実カメラ入力に近いE2Eテスト（フェイクカメラデバイスに実QR映像を供給） ===')
    import subprocess
    import tempfile

    render_browser = playwright_instance.chromium.launch(
        executable_path=CHROMIUM_EXECUTABLE_PATH if CHROMIUM_EXECUTABLE_PATH else None)
    render_page = render_browser.new_page()
    render_page.goto(APP_URL)
    test_id = 'phase33e2efixedtestid'
    # 実際のopenQrModal()を使って本物のQR表示モーダル(.active状態、.qr-svg-wrapの
    # CSSサイズ指定込み)を開く。#qr-modal-bodyへ直接innerHTMLを注入するだけでは
    # モーダルがinactive(opacity:0)のままスクリーンショットされ、QRが正しく
    # デコードできない画像になってしまうため、実際のUI経路を使う。
    render_page.evaluate(
        "() => { const tmp={id:%r,name:'E2Eテスト商品',price:1,emoji:'🧪',image:null}; "
        "products.push(tmp); openQrModal(tmp.id); "
        "document.querySelector('.qr-svg-wrap svg').style.width='480px'; "
        "document.querySelector('.qr-svg-wrap svg').style.height='480px'; }" % test_id
    )
    png_path = os.path.join(tempfile.gettempdir(), 'register_qr_e2e_source.png')
    render_page.locator('.qr-svg-wrap').screenshot(path=png_path)
    render_browser.close()

    padded_path = os.path.join(tempfile.gettempdir(), 'register_qr_e2e_padded.png')
    y4m_path = os.path.join(tempfile.gettempdir(), 'register_qr_e2e.y4m')
    try:
        import cv2
        img = cv2.imread(png_path)
        padded = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))
        cv2.imwrite(padded_path, padded)
    except Exception as e:
        check('(bonus realistic test) could prepare a padded QR source image for the fake camera',
              False, str(e))
        return
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-loop', '1', '-i', padded_path, '-frames:v', '5',
             '-pix_fmt', 'yuv420p', y4m_path],
            check=True, capture_output=True, timeout=30,
        )
    except Exception as e:
        check('(bonus realistic test) ffmpeg could encode the fake-camera Y4M feed', False, str(e))
        return

    cam_browser = playwright_instance.chromium.launch(
        executable_path=CHROMIUM_EXECUTABLE_PATH if CHROMIUM_EXECUTABLE_PATH else None,
        args=FAKE_CAMERA_ARGS + ['--use-file-for-fake-video-capture=' + y4m_path],
    )
    cam_context = cam_browser.new_context()
    cam_context.grant_permissions(['camera'])
    page, errors = fresh_page_in_context(cam_context)
    # このセッションの実在商品のIDを、フェイク映像に焼き込んだIDへ合わせる
    page.evaluate("products[0].id=%r; saveProducts();" % test_id)
    page.click('#qr-mode-btn')
    page.click('#qr-scan-btn')
    page.wait_for_timeout(2000)
    cart = page.evaluate('cart')
    check('[REAL CAMERA E2E] a genuine getUserMedia video feed containing an actual QR image, '
          'decoded by the real jsQR pipeline (no mocked decode), correctly adds the matching '
          'product to the cart — proves the full camera→canvas→jsQR→match→addToCart pipeline '
          'works end-to-end, not just the mocked-logic groups above',
          any(i['id'] == test_id for i in cart), cart)
    check('no console/page errors during the realistic camera E2E test', len(errors) == 0,
          errors[:5])
    page.close()
    cam_browser.close()


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
        group_i_qr_generation(browser)
        group_i2_qr_modal_leak_not_worse(browser)
        group_j_qr_print(browser)
        group_k_qr_license(browser)
        group_l_qr_mode_and_settings(browser)
        group_m_scanner_camera_errors(browser)
        group_n_scanner_decode_and_debounce(browser)
        group_o_scanner_lifecycle_and_async_race(p, browser)
        group_p_scanner_switch_scan_safety(browser)
        group_q_scanner_realistic_camera_e2e(p, browser)
        browser.close()


if __name__ == '__main__':
    run()
    print('\n=== RESULT ===')
    print('PASS:', pass_count, ' FAIL:', fail_count)
    print('(1 FAIL is EXPECTED as of DONOMANA-REGISTER-QR-PHASE-3-3: the '
          '"既知の構造的課題の確認" group\'s modal/switch-scan structural-leak check for product-modal — '
          'a known Phase 2 design finding, intentionally left unfixed for THAT modal (out of scope: '
          '"既存全モーダルの横断改修は行わない"). The NEW qr-scanner-modal (Phase 3-3) instead actually '
          'FIXES this for itself — see group_p, which confirms buildScanItems() scopes to the open '
          'scanner modal and the background is additionally inert()\'d. group_i2 (Phase 3-2) separately '
          'confirms the qr-modal (QR display, not the scanner) merely does not leak MORE than '
          'product-modal under identical conditions — same pre-existing issue, not worsened, not fixed. '
          'The share-URL bug found in Phase 3-1 was '
          'fixed in Phase 3-1B and its tests PASS. Any OTHER FAIL is a new, unexpected regression and '
          'must be investigated before proceeding.)')
    sys.exit(1 if fail_count > 0 else 0)
