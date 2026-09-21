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
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228', protocolTimeout: 300000 });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const manifestPath = '/home/opc/gsa-ai/work/identity-flow-20260907/regen-download-manifest.json';
  const results = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

  for (const t of TARGETS) {
    const outPath = \`\${REPL_DIR}/\${t.file}\`;
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500000) {
      console.log(\`[SKIP] \${t.file} already downloaded (\${fs.statSync(outPath).size} bytes)\`);
      if (!results.find(r => r.file === t.file)) {
        const fileBuf = fs.readFileSync(outPath);
        results.push({
          idx: t.idx,
          slug: t.slug,
          kind: t.kind,
          file: t.file,
          path: outPath,
          size: fileBuf.length,
          sha256: crypto.createHash('sha256').update(fileBuf).digest('hex')
        });
      }
      continue;
    }

    console.log(\`\\n========================================\`);
    console.log(\`Processing [\${t.idx + 1}/7]: \${t.slug} (\${t.kind}) -> \${t.file}\`);
    console.log(\`========================================\`);

    // Ensure we are on the project grid page
    if (page.url().includes('/edit/')) {
      console.log('Currently in edit view, navigating to project grid...');
      await page.goto('https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3500);
    }

    // Verify grid has tiles
    await page.waitForSelector('flow-grid-tile-container', { timeout: 30000 });
    await sleep(1500);

    const tileInfo = await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      return {
        aria: el ? el.getAttribute('aria-label') : null,
        footer: el ? el.querySelector('.footer-title')?.innerText : null
      };
    }, t.idx);

    console.log('Tile info:', JSON.stringify(tileInfo));
    if (!tileInfo.aria || (!tileInfo.aria.includes(t.expected) && !tileInfo.footer.includes(t.expected))) {
      throw new Error(\`Tile mismatch at index \${t.idx}! Expected \${t.expected}, found aria: "\${tileInfo.aria}"\`);
    }

    // Click play on tile
    console.log(\`Clicking play on tile \${t.idx}...\`);
    await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      const play = el ? el.querySelector('.pre-hover-overlay') : null;
      if (play) play.click();
    }, t.idx);

    console.log('Waiting for video player...');
    await page.waitForSelector('video', { timeout: 20000 });
    await sleep(3000);

    const detail = await page.evaluate(() => {
      const v = document.querySelector('video.main-video') || document.querySelector('video');
      return {
        url: window.location.href,
        videoSrc: v ? (v.currentSrc || v.src) : null,
        duration: v ? v.duration : null
      };
    });

    console.log('Edit URL:', detail.url);
    console.log('Video SRC:', detail.videoSrc);
    console.log('Video Duration:', detail.duration);

    if (!detail.videoSrc || !detail.videoSrc.startsWith('https://')) {
      throw new Error('Invalid videoSrc for ' + t.file);
    }

    const genId = detail.url.match(/\\/edit\\/([^/?#]+)/)?.[1] || detail.videoSrc.match(/\\/video\\/([^/?#]+)/)?.[1] || '';

    console.log(\`Downloading to \${outPath} via curl...\`);
    cp.execSync(\`curl -sL -o "\${outPath}" "\${detail.videoSrc}"\`, { stdio: 'inherit' });

    const fileBuf = fs.readFileSync(outPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    console.log(\`SUCCESS: \${t.file} (\${fileBuf.length} bytes, SHA: \${sha256})\`);

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

    fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));

    // Navigate back to grid
    console.log('Navigating back to grid...');
    await page.goto('https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
  }

  console.log('\\n========================================');
  console.log('ALL 7 REGENERATIONS DOWNLOADED!');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));

  await b.disconnect();
})().catch(e => { console.error('FATAL ERROR:', e.message, e.stack); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 300000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
