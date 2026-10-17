// Phase APP-DETAILS-VISUAL-ENHANCEMENT-IMPLEMENTATION-B-1
//
// generate.js の apps-data.json「screenshots[]」対応ロジック(hero-gallery生成・
// 画像パス安全対策・alt/caption必須・重複除去・既存hasMockupへのfallback)を、
// 本物のapps-data.jsonを一切変更せず、専用の一時領域(OSのtmpdir配下)に複製した
// リポジトリコピーの上で検証する。
//
// 使い方: node tools/app-details-screenshots/screenshots-fixture-tests.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let passed = 0, failed = 0;
function check(label, ok, detail) {
  if (ok) { passed++; console.log(`[OK  ] ${label}`); }
  else { failed++; console.log(`[FAIL] ${label}${detail !== undefined ? ' -- ' + JSON.stringify(detail) : ''}`); }
}

// ---------------------------------------------------------------------------
// 1. 専用の一時領域にリポジトリを複製する(本物のapps-data.jsonは一切変更しない)
// ---------------------------------------------------------------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-details-screenshots-test-'));
console.log(`一時領域: ${tmpRoot}`);

// generate.js・apps-data.json・app-details/・assets/・index.html など、
// 生成に必要な最小限だけをコピーする(.git・node_modules・他tools/は不要)。
const COPY_ITEMS = ['generate.js', 'apps-data.json', 'app-details', 'assets', 'index.html'];
for (const item of COPY_ITEMS) {
  execFileSync('cp', ['-r', path.join(REPO_ROOT, item), path.join(tmpRoot, item)]);
}

// generate.jsがgit logでlastmodを引けるよう要求する処理がsitemap生成にあるが、
// 本テストはapp-details/*-detail.htmlの内容検証のみが目的なので、.gitが無くても
// generate.js自体は(sitemap日付が不正確になるだけで)クラッシュしない。

// ---------------------------------------------------------------------------
// 2. フィクスチャ用のapp-data.jsonエントリを組み立てる
// ---------------------------------------------------------------------------
const appsDataPath = path.join(tmpRoot, 'apps-data.json');
const apps = JSON.parse(fs.readFileSync(appsDataPath, 'utf-8'));
const template = apps.find(a => a.id === 'tokei-app');
if (!template) throw new Error('template app "tokei-app" not found in apps-data.json');

function cloneApp(id, overrides) {
  const base = JSON.parse(JSON.stringify(template));
  base.id = id;
  base.filename = id;
  base.title = `フィクスチャ:${id}`;
  delete base.ogImage; // 明示ogImageは未使用(screenshots[0]優先のテストを汚染しない)
  return Object.assign(base, overrides);
}

const mockupsDir = path.join(tmpRoot, 'assets', 'mockups');
const realSampleMockup = path.join(REPO_ROOT, 'assets', 'mockups', 'tokei-app.png');
function placeMockup(filename) {
  fs.copyFileSync(realSampleMockup, path.join(mockupsDir, filename));
}
function writeDummyAppHtml(filename) {
  fs.writeFileSync(path.join(tmpRoot, `${filename}.html`), '<!doctype html><html lang="ja"><body>fixture</body></html>\n');
}

const fixtures = [];

// 1. screenshots[]未設定(既存アプリ相当) + 自前mockupあり → 単一画像のまま
fixtures.push(cloneApp('zzfx-unset', {}));
delete fixtures[fixtures.length - 1].screenshots;
placeMockup('zzfx-unset.png');

// 2. screenshots[]空配列 + 自前mockupあり → 単一画像のままfallback
fixtures.push(cloneApp('zzfx-empty', { screenshots: [] }));
placeMockup('zzfx-empty.png');

// 3. 有効画像1枚
placeMockup('zzfx-one-a.png');
fixtures.push(cloneApp('zzfx-one', {
  screenshots: [{ file: 'assets/mockups/zzfx-one-a.png', alt: '画面A', caption: 'キャプションA' }]
}));

// 4. 有効画像2枚
placeMockup('zzfx-two-a.png'); placeMockup('zzfx-two-b.png');
fixtures.push(cloneApp('zzfx-two', {
  screenshots: [
    { file: 'assets/mockups/zzfx-two-a.png', alt: '画面A', caption: 'キャプションA' },
    { file: 'assets/mockups/zzfx-two-b.png', alt: '画面B', caption: 'キャプションB' }
  ]
}));

// 5. 有効画像3枚
placeMockup('zzfx-three-a.png'); placeMockup('zzfx-three-b.png'); placeMockup('zzfx-three-c.png');
fixtures.push(cloneApp('zzfx-three', {
  screenshots: [
    { file: 'assets/mockups/zzfx-three-a.png', alt: '画面A', caption: 'キャプションA' },
    { file: 'assets/mockups/zzfx-three-b.png', alt: '画面B', caption: 'キャプションB' },
    { file: 'assets/mockups/zzfx-three-c.png', alt: '画面C', caption: 'キャプションC' }
  ]
}));

// 6. 指定順序の維持
placeMockup('zzfx-order-1.png'); placeMockup('zzfx-order-2.png'); placeMockup('zzfx-order-3.png');
fixtures.push(cloneApp('zzfx-order', {
  screenshots: [
    { file: 'assets/mockups/zzfx-order-1.png', alt: 'じゅんい1画面', caption: 'じゅんい1' },
    { file: 'assets/mockups/zzfx-order-2.png', alt: 'じゅんい2画面', caption: 'じゅんい2' },
    { file: 'assets/mockups/zzfx-order-3.png', alt: 'じゅんい3画面', caption: 'じゅんい3' }
  ]
}));

// 7. 重複file(同一fileが2回 → 2回目は除去、別fileは残る)
placeMockup('zzfx-dup-x.png'); placeMockup('zzfx-dup-y.png');
fixtures.push(cloneApp('zzfx-dup', {
  screenshots: [
    { file: 'assets/mockups/zzfx-dup-x.png', alt: '最初のX', caption: 'さいしょのX' },
    { file: 'assets/mockups/zzfx-dup-x.png', alt: '2回目のX', caption: 'にかいめのX' },
    { file: 'assets/mockups/zzfx-dup-y.png', alt: 'Y画面', caption: 'Y' }
  ]
}));

// 8. 存在しない画像(かつ自前mockupも無い) → 完全に空
fixtures.push(cloneApp('zzfx-missing', {
  screenshots: [{ file: 'assets/mockups/zzfx-missing-ghost.png', alt: '無い画像', caption: 'ない' }]
}));

// 9. 不正な絶対パス
fixtures.push(cloneApp('zzfx-abspath', {
  screenshots: [{ file: '/etc/passwd', alt: '絶対パス', caption: 'だめ' }]
}));

// 10. ../による正規化後の脱出(文字列prefixだけでは防げないケース)
fixtures.push(cloneApp('zzfx-traversal', {
  screenshots: [{ file: 'assets/mockups/../../../etc/passwd', alt: 'トラバーサル', caption: 'だめ' }]
}));

// 11. 外部URL(http/data:スキーム)
fixtures.push(cloneApp('zzfx-url', {
  screenshots: [
    { file: 'http://evil.example.com/x.png', alt: '外部URL', caption: 'だめ' },
    { file: 'data:image/png;base64,AAAA', alt: 'dataスキーム', caption: 'だめ' }
  ]
}));

// 12. HTML特殊文字を含むalt/caption(エスケープ確認)
placeMockup('zzfx-htmlchars-a.png');
fixtures.push(cloneApp('zzfx-htmlchars', {
  screenshots: [{
    file: 'assets/mockups/zzfx-htmlchars-a.png',
    alt: `<b>危険</b> & "引用" 'クオート'`,
    caption: `<script>alert(1)</script> & テスト`
  }]
}));

// 13. alt欠落
placeMockup('zzfx-noalt-a.png');
fixtures.push(cloneApp('zzfx-noalt', {
  screenshots: [{ file: 'assets/mockups/zzfx-noalt-a.png', caption: 'キャプションのみ' }]
}));

// 14. caption欠落
placeMockup('zzfx-nocaption-a.png');
fixtures.push(cloneApp('zzfx-nocaption', {
  screenshots: [{ file: 'assets/mockups/zzfx-nocaption-a.png', alt: 'altのみ' }]
}));

// 15. 一部画像欠落(3件中1件が存在しない → 残り2件は順序維持)
placeMockup('zzfx-partial-a.png'); placeMockup('zzfx-partial-c.png');
fixtures.push(cloneApp('zzfx-partial', {
  screenshots: [
    { file: 'assets/mockups/zzfx-partial-a.png', alt: '画面A', caption: 'キャプションA' },
    { file: 'assets/mockups/zzfx-partial-missing.png', alt: '無い画面', caption: 'ない' },
    { file: 'assets/mockups/zzfx-partial-c.png', alt: '画面C', caption: 'キャプションC' }
  ]
}));

// 16. 全画像欠落 + 自前mockupも無い → 完全に空
fixtures.push(cloneApp('zzfx-allmissing', {
  screenshots: [
    { file: 'assets/mockups/zzfx-allmissing-ghost1.png', alt: '無い1', caption: 'ない1' },
    { file: 'assets/mockups/zzfx-allmissing-ghost2.png', alt: '無い2', caption: 'ない2' }
  ]
}));

// 17. 全画像欠落だが自前mockupはある → 既存単一画像にfallback
placeMockup('zzfx-allmissing-withfallback.png');
fixtures.push(cloneApp('zzfx-allmissing-withfallback', {
  screenshots: [{ file: 'assets/mockups/zzfx-allmissing-withfallback-ghost.png', alt: '無い', caption: 'ない' }]
}));

for (const f of fixtures) {
  writeDummyAppHtml(f.filename);
}

apps.push(...fixtures);
fs.writeFileSync(appsDataPath, JSON.stringify(apps, null, 2), 'utf-8');

// ---------------------------------------------------------------------------
// 3. 一時領域でgenerate.jsを実行する(本物のworktree/apps-data.jsonには一切触れない)
// ---------------------------------------------------------------------------
let generateOutput;
try {
  generateOutput = execFileSync('node', ['generate.js'], { cwd: tmpRoot, encoding: 'utf-8' });
} catch (e) {
  console.error('generate.js の実行に失敗しました:');
  console.error(e.stdout || '');
  console.error(e.stderr || e.message);
  process.exit(1);
}

function readDetail(id) {
  const p = path.join(tmpRoot, 'app-details', `${id}-detail.html`);
  return fs.readFileSync(p, 'utf-8');
}
function countOccurrences(haystack, needle) {
  return (haystack.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

// ---------------------------------------------------------------------------
// 4. アサーション
// ---------------------------------------------------------------------------

// 1. screenshots[]未設定 → 単一hero-mockup、hero-galleryは生成されない
{
  const html = readDetail('zzfx-unset');
  check('1. 未設定: hero-mockup(単一)が存在する', html.includes('<img class="hero-mockup" src="../assets/mockups/zzfx-unset.png"'));
  check('1. 未設定: hero-galleryは生成されない', !html.includes('hero-gallery'));
}

// 2. screenshots[]空配列 → 単一hero-mockupにfallback
{
  const html = readDetail('zzfx-empty');
  check('2. 空配列: hero-mockup(単一)が存在する', html.includes('<img class="hero-mockup" src="../assets/mockups/zzfx-empty.png"'));
  check('2. 空配列: hero-galleryは生成されない', !html.includes('hero-gallery'));
}

// 3. 有効画像1枚
{
  const html = readDetail('zzfx-one');
  check('3. 1枚: hero-galleryが生成される', html.includes('class="hero-gallery"'));
  check('3. 1枚: figureが1個', countOccurrences(html, '<figure class="hero-shot">') === 1);
  check('3. 1枚: altが反映される', html.includes('alt="画面A"'));
  check('3. 1枚: captionが反映される', html.includes('キャプションA'));
  check('3. 1枚: loading=eager(先頭)', /src="\.\.\/assets\/mockups\/zzfx-one-a\.png" alt="画面A" width="1200" height="630" loading="eager"/.test(html));
}

// 4. 有効画像2枚(+JS無効/VoiceOver構造チェックもここで実施)
{
  const html = readDetail('zzfx-two');
  check('4. 2枚: figureが2個', countOccurrences(html, '<figure class="hero-shot">') === 2);
  check('4. 2枚: 1枚目はeager', /zzfx-two-a\.png" alt="画面A" width="1200" height="630" loading="eager"/.test(html));
  check('4. 2枚: 2枚目はlazy', /zzfx-two-b\.png" alt="画面B" width="1200" height="630" loading="lazy"/.test(html));
  check('4. 2枚: 2枚ともwidth/height=1200/630固定(CLS対策)', countOccurrences(html, 'width="1200" height="630"') >= 2);

  // 18. JavaScript無効時 → 新しい<script>やonclick/addEventListenerが増えていない
  const scriptCount = countOccurrences(html, '<script');
  check('18. JS無効時: <script>はJSON-LDの1個のみ', scriptCount === 1 && html.includes('<script type="application/ld+json">'));
  check('18. JS無効時: onclick等のイベント属性が無い', !/\bonclick=|addEventListener/.test(html));

  // 19. モバイル表示: hero-galleryは縦積み(flex-direction:column)、画像幅は既存の縮小ルールを継承
  check('19. モバイル: hero-galleryがflex-direction:column', /\.hero-gallery\{[^}]*flex-direction:column/.test(html));
  check('19. モバイル: .hero-mockupの幅がmin(780px,94%)のまま(共有ルール)', html.includes('width:min(780px,94%)'));

  // 20. キーボード・VoiceOver: figure/figcaptionのセマンティック構造、alt必須、新規フォーカス要素なし
  check('20. 構造: figcaptionが2個', countOccurrences(html, '<figcaption class="hero-shot-caption">') === 2);
  const galleryBlock = html.slice(html.indexOf('class="hero-gallery"'), html.indexOf('</div>', html.indexOf('class="hero-gallery"')) + 6);
  check('20. 構造: hero-gallery内に新規の<button>/<a>/tabindexが無い', !/<button|<a\s|tabindex=/.test(galleryBlock));
}

// 5. 有効画像3枚
{
  const html = readDetail('zzfx-three');
  check('5. 3枚: figureが3個', countOccurrences(html, '<figure class="hero-shot">') === 3);
}

// 6. 指定順序の維持
{
  const html = readDetail('zzfx-order');
  const i1 = html.indexOf('じゅんい1'), i2 = html.indexOf('じゅんい2'), i3 = html.indexOf('じゅんい3');
  check('6. 順序維持: じゅんい1→2→3の順で出現する', i1 >= 0 && i2 > i1 && i3 > i2, { i1, i2, i3 });
}

// 7. 重複file
{
  const html = readDetail('zzfx-dup');
  check('7. 重複file: zzfx-dup-x.pngの<img>は1個だけ', countOccurrences(html, 'src="../assets/mockups/zzfx-dup-x.png"') === 1);
  check('7. 重複file: 残るのは最初の出現(最初のX)', html.includes('最初のX') && !html.includes('2回目のX'));
  check('7. 重複file: 別fileのYはそのまま残る', html.includes('src="../assets/mockups/zzfx-dup-y.png"'));
  check('7. 重複file: figureは2個(3個中1個除去)', countOccurrences(html, '<figure class="hero-shot">') === 2);
}

// 8. 存在しない画像(自前mockup無し) → 完全に空
{
  const html = readDetail('zzfx-missing');
  check('8. 存在しない画像: hero-galleryもhero-mockupも無い', !html.includes('hero-gallery') && !html.includes('class="hero-mockup"'));
}

// 9. 不正な絶対パス
{
  const html = readDetail('zzfx-abspath');
  check('9. 絶対パス拒否: hero-galleryもhero-mockupも無い(/etc/passwdが混入しない)', !html.includes('hero-gallery') && !html.includes('/etc/passwd'));
}

// 10. ../による正規化後トラバーサル
{
  const html = readDetail('zzfx-traversal');
  check('10. トラバーサル拒否: hero-galleryもhero-mockupも無い(passwdが混入しない)', !html.includes('hero-gallery') && !html.includes('passwd'));
}

// 11. 外部URL
{
  const html = readDetail('zzfx-url');
  check('11. 外部URL拒否: evil.example.comが混入しない', !html.includes('evil.example.com'));
  check('11. dataスキーム拒否: data:image/pngが混入しない', !html.includes('data:image/png'));
  check('11. 外部URL拒否: hero-galleryもhero-mockupも無い', !html.includes('hero-gallery') && !html.includes('class="hero-mockup"'));
}

// 12. HTML特殊文字のエスケープ
{
  const html = readDetail('zzfx-htmlchars');
  check('12. HTMLエスケープ: altの<b>が生の<bとして混入しない', !html.includes('<b>危険</b>'));
  check('12. HTMLエスケープ: alt内の&lt;b&gt;としてエスケープされている', html.includes('&lt;b&gt;危険&lt;/b&gt;'));
  check('12. HTMLエスケープ: caption内の<script>が生のまま混入しない', !html.includes('<script>alert(1)</script>'));
  check('12. HTMLエスケープ: caption内が&lt;script&gt;としてエスケープされている', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  check('12. HTMLエスケープ: 引用符もエスケープされている', html.includes('&quot;引用&quot;') && html.includes('&#39;クオート&#39;'));
}

// 13. alt欠落
{
  const html = readDetail('zzfx-noalt');
  check('13. alt欠落: hero-galleryもhero-mockupも無い(除外された)', !html.includes('hero-gallery') && !html.includes('class="hero-mockup"'));
}

// 14. caption欠落
{
  const html = readDetail('zzfx-nocaption');
  check('14. caption欠落: hero-galleryもhero-mockupも無い(除外された)', !html.includes('hero-gallery') && !html.includes('class="hero-mockup"'));
}

// 15. 一部画像欠落(3件中1件欠落 → 残り2件、順序維持)
{
  const html = readDetail('zzfx-partial');
  check('15. 一部欠落: figureは2個(3件中1件除外)', countOccurrences(html, '<figure class="hero-shot">') === 2);
  const ia = html.indexOf('画面A'), ic = html.indexOf('画面C');
  check('15. 一部欠落: 残り2件はA→Cの順序を維持', ia >= 0 && ic > ia);
  check('15. 一部欠落: 存在しないファイル名は混入しない', !html.includes('zzfx-partial-missing'));
}

// 16. 全画像欠落(自前mockup無し) → 完全に空
{
  const html = readDetail('zzfx-allmissing');
  check('16. 全画像欠落: hero-galleryもhero-mockupも無い', !html.includes('hero-gallery') && !html.includes('class="hero-mockup"'));
}

// 17. 全画像欠落だが自前mockupあり → 既存単一画像にfallback
{
  const html = readDetail('zzfx-allmissing-withfallback');
  check('17. 全欠落+自前mockupあり: hero-galleryでなく単一hero-mockupが使われる', !html.includes('hero-gallery') && html.includes('<img class="hero-mockup" src="../assets/mockups/zzfx-allmissing-withfallback.png"'));
}

// ---------------------------------------------------------------------------
// 5. 後始末(一時領域を削除)
// ---------------------------------------------------------------------------
try {
  execFileSync('rm', ['-rf', tmpRoot]);
} catch (e) {
  console.warn(`一時領域の削除に失敗しました(手動削除してください): ${tmpRoot}`);
}

console.log(`\n${passed}/${passed + failed} checks passed.`);
if (failed > 0) {
  console.log('FAILURES DETECTED.');
  process.exit(1);
} else {
  console.log('ALL PASS.');
}
