import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REPL_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/replacements';
const TARGETS = [
  { idx: 0, slug: 'gsa-business', kind: 'opening', file: 'business-opening-repl.mp4', label: 'GSA Business' },
  { idx: 1, slug: 'gsa-news-noite', kind: 'opening', file: 'news-noite-opening-repl.mp4', label: 'GSA News Noite' },
  { idx: 2, slug: 'gsa-motor', kind: 'opening', file: 'motor-opening-repl.mp4', label: 'GSA Motor' },
  { idx: 3, slug: 'gsa-agro', kind: 'opening', file: 'agro-opening-repl.mp4', label: 'GSA Agro' },
  { idx: 4, slug: 'gsa-em-fe', kind: 'closing', file: 'em-fe-closing-repl.mp4', label: 'GSA Em Fé' },
  { idx: 5, slug: 'gsa-bem-viver', kind: 'closing', file: 'bem-viver-closing-repl.mp4', label: 'GSA Bem Viver' },
  { idx: 6, slug: 'gsa-sabor', kind: 'opening', file: 'sabor-opening-repl.mp4', label: 'GSA Sabor' }
];

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const results = [];

  for (const t of TARGETS) {
    console.log(\`=== Extracting tile \${t.idx}: \${t.slug} (\${t.kind}) ===\`);
    
    // Check tile aria
    const aria = await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      return el ? el.getAttribute('aria-label') : null;
    }, t.idx);
    console.log('Tile aria:', aria);

    // Click play overlay
    await page.evaluate(idx => {
      const el = document.querySelectorAll('flow-grid-tile-container')[idx];
      const play = el ? el.querySelector('.pre-hover-overlay') : null;
      if (play) play.click();
    }, t.idx);

    await sleep(2500);

    const videoUrl = await page.evaluate(() => {
      const v = document.querySelector('video.main-video') || document.querySelector('video');
      return v ? (v.currentSrc || v.src) : null;
    });

    console.log('Video URL:', videoUrl);
    if (!videoUrl) throw new Error(\`Failed to get video URL for tile \${t.idx}\`);

    // Extract ID
    const matchId = videoUrl.match(/\\/video\\/([^?]+)/);
    const videoId = matchId ? matchId[1] : '';

    // Download via curl
    const outPath = \`\${REPL_DIR}/\${t.file}\`;
    console.log(\`Downloading to \${outPath}...\`);
    cp.execSync(\`curl -sL -o "\${outPath}" "\${videoUrl}"\`, { stdio: 'inherit' });

    const stats = fs.statSync(outPath);
    console.log(\`Downloaded \${t.file}: \${stats.size} bytes\`);

    results.push({
      ...t,
      videoId,
      videoUrl,
      size: stats.size,
      aria
    });

    // Close preview
    await page.keyboard.press('Escape');
    await sleep(1000);
  }

  console.log('=== All 7 downloads complete! ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync('/home/opc/gsa-ai/work/identity-flow-20260907/regen-download-manifest.json', JSON.stringify(results, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 120000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
