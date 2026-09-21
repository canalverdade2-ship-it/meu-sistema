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
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228', protocolTimeout: 120000 });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const results = [];
  let lastEditUrl = '';

  for (const t of TARGETS) {
    console.log(\`\\n========================================\`);
    console.log(\`[Tile \${t.idx}] Target: \${t.slug} (\${t.kind}) -> \${t.file}\`);
    console.log(\`========================================\`);

    // Ensure we are on grid
    if (page.url().includes('/edit/')) {
      console.log('Currently in edit view, clicking back button...');
      await page.evaluate(() => {
        const back = document.querySelector('button.back-button');
        if (back) back.click();
      });
      await sleep(2500);
    }

    // Wait for grid tiles
    await page.waitForFunction(() => document.querySelectorAll('flow-grid-tile-container').length >= 7, { timeout: 20000 });
    await sleep(1000);

    // Verify tile info
    const tileInfo = await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      return {
        aria: el ? el.getAttribute('aria-label') : null,
        footer: el ? el.querySelector('.footer-title')?.innerText : null
      };
    }, t.idx);

    console.log('Tile metadata:', JSON.stringify(tileInfo));
    const label = (tileInfo.aria || '') + ' ' + (tileInfo.footer || '');
    if (!label.toLowerCase().includes(t.expected.toLowerCase())) {
      throw new Error(\`Tile \${t.idx} label mismatch! Expected \${t.expected}, got "\${label}"\`);
    }

    // Click play on this specific tile
    console.log(\`Clicking play overlay on tile \${t.idx}...\`);
    await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      const play = el ? el.querySelector('.pre-hover-overlay') : null;
      if (play) play.click();
    }, t.idx);

    // Wait for edit view and video
    await page.waitForFunction(() => window.location.href.includes('/edit/'), { timeout: 15000 });
    await page.waitForSelector('video', { timeout: 15000 });
    await sleep(2000);

    const detail = await page.evaluate(() => {
      const v = document.querySelector('video.main-video') || document.querySelector('video');
      return {
        url: window.location.href,
        videoSrc: v ? (v.currentSrc || v.src) : null,
        duration: v ? v.duration : null
      };
    });

    console.log('Edit URL:', detail.url);
    console.log('Video Source:', detail.videoSrc);
    console.log('Duration:', detail.duration);

    if (detail.url === lastEditUrl) {
      throw new Error(\`Edit URL did not change for tile \${t.idx}! Still \${lastEditUrl}\`);
    }
    lastEditUrl = detail.url;

    if (!detail.videoSrc || !detail.videoSrc.startsWith('https://')) {
      throw new Error(\`Invalid videoSrc for tile \${t.idx}\`);
    }

    const genId = detail.url.match(/\\/edit\\/([^/?#]+)/)?.[1] || '';
    const videoId = detail.videoSrc.match(/\\/video\\/([^/?#]+)/)?.[1] || '';
    const outPath = \`\${REPL_DIR}/\${t.file}\`;

    console.log(\`Downloading \${t.file}...\`);
    cp.execSync(\`curl -sL -o "\${outPath}" "\${detail.videoSrc}"\`, { stdio: 'inherit' });

    const fileBuf = fs.readFileSync(outPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    console.log(\`SUCCESS: \${t.file} (\${fileBuf.length} bytes, SHA256: \${sha256})\`);

    results.push({
      idx: t.idx,
      slug: t.slug,
      kind: t.kind,
      file: t.file,
      path: outPath,
      size: fileBuf.length,
      sha256,
      genId,
      videoId,
      videoSrc: detail.videoSrc,
      editUrl: detail.url
    });

    // Navigate back to grid
    console.log('Returning to grid...');
    await page.evaluate(() => {
      const back = document.querySelector('button.back-button');
      if (back) back.click();
    });
    await sleep(2500);
  }

  console.log('\\n========================================');
  console.log('ALL 7 REGENERATIONS EXTRACTED AND DOWNLOADED SUCCESSFULLY!');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));

  // Save manifest
  fs.writeFileSync('/home/opc/gsa-ai/work/identity-flow-20260907/regen-download-manifest.json', JSON.stringify(results, null, 2));
  await b.disconnect();
})().catch(e => { console.error('FATAL ERROR:', e.message, e.stack); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 300000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
