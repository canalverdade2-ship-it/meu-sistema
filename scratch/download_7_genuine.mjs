import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REPL_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/replacements';
const TARGETS = [
  { idx: 0, slug: 'gsa-business', kind: 'opening', file: 'business-opening-repl.mp4', expected: 'Business' },
  { idx: 1, slug: 'gsa-news-noite', kind: 'opening', file: 'news-noite-opening-repl.mp4', expected: 'News Noite' },
  { idx: 2, slug: 'gsa-motor', kind: 'opening', file: 'motor-opening-repl.mp4', expected: 'Motor' },
  { idx: 3, slug: 'gsa-agro', kind: 'opening', file: 'agro-opening-repl.mp4', expected: 'Agro' },
  { idx: 4, slug: 'gsa-em-fe', kind: 'closing', file: 'em-fe-closing-repl.mp4', expected: 'Em Fé' },
  { idx: 5, slug: 'gsa-bem-viver', kind: 'closing', file: 'bem-viver-closing-repl.mp4', expected: 'Bem Viver' },
  { idx: 6, slug: 'gsa-sabor', kind: 'opening', file: 'sabor-opening-repl.mp4', expected: 'Sabor' }
];

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const results = [];

  for (const t of TARGETS) {
    console.log(\`\\n========================================\`);
    console.log(\`Processing [\${t.idx + 1}/7]: \${t.slug} (\${t.kind}) -> \${t.file}\`);
    console.log(\`========================================\`);

    // Ensure grid is ready
    let tiles = [];
    for (let retry = 0; retry < 10; retry++) {
      tiles = await page.$$('flow-grid-tile-container');
      if (tiles.length >= 7) break;
      // Maybe we are still in edit view?
      const back = await page.$('button.back-button');
      if (back) {
        console.log('Found back button, clicking to return to grid...');
        await back.click();
      }
      await sleep(2000);
    }

    if (tiles.length < 7) throw new Error('Grid tiles not ready: ' + tiles.length);

    // Verify tile match
    const tileInfo = await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      return {
        aria: el ? el.getAttribute('aria-label') : null,
        footer: el ? el.querySelector('.footer-title')?.innerText : null
      };
    }, t.idx);

    console.log('Tile info:', JSON.stringify(tileInfo));
    if (!tileInfo.aria.includes(t.expected) && !tileInfo.footer.includes(t.expected)) {
      throw new Error(\`Tile mismatch! Expected \${t.expected} but found \${tileInfo.aria}\`);
    }

    // Click to open video view
    await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      const play = el ? el.querySelector('.pre-hover-overlay') : null;
      if (play) play.click();
    }, t.idx);

    console.log('Waiting for video player to load...');
    await page.waitForSelector('video', { timeout: 15000 });
    await sleep(2500);

    const detail = await page.evaluate(() => {
      const v = document.querySelector('video.main-video') || document.querySelector('video');
      return {
        url: window.location.href,
        videoSrc: v ? (v.currentSrc || v.src) : null,
        duration: v ? v.duration : null
      };
    });

    console.log('Edit Page URL:', detail.url);
    console.log('Video SRC:', detail.videoSrc);
    console.log('Video Duration reported by element:', detail.duration);

    if (!detail.videoSrc || !detail.videoSrc.startsWith('https://')) {
      throw new Error('Invalid videoSrc: ' + detail.videoSrc);
    }

    const genId = detail.url.match(/\\/edit\\/([^/?#]+)/)?.[1] || detail.videoSrc.match(/\\/video\\/([^/?#]+)/)?.[1] || '';
    const outPath = \`\${REPL_DIR}/\${t.file}\`;

    console.log(\`Downloading video to \${outPath}...\`);
    cp.execSync(\`curl -sL -o "\${outPath}" "\${detail.videoSrc}"\`, { stdio: 'inherit' });

    const fileBuf = fs.readFileSync(outPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    console.log(\`Downloaded \${t.file}: \${fileBuf.length} bytes, SHA256: \${sha256}\`);

    results.push({
      idx: t.idx,
      slug: t.slug,
      kind: t.kind,
      file: t.file,
      path: outPath,
      size: fileBuf.length,
      sha256,
      genId,
      videoSrc: detail.videoSrc,
      editUrl: detail.url
    });

    // Go back to grid
    console.log('Navigating back to grid...');
    const backBtn = await page.$('button.back-button');
    if (backBtn) {
      await backBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await sleep(3000);
  }

  console.log('\\n========================================');
  console.log('ALL 7 REGENERATIONS DOWNLOADED SUCCESSFULLY!');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync('/home/opc/gsa-ai/work/identity-flow-20260907/regen-download-manifest.json', JSON.stringify(results, null, 2));
  await b.disconnect();
})().catch(e => { console.error('FATAL ERROR:', e.message, e.stack); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 300000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
