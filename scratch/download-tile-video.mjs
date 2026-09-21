import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/download-tile-video.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  await page.keyboard.press('Escape');
  await sleep(1000);

  const tileInfo = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('flow-video-tile'));
    const target = tiles.find(t => (t.innerText || '').includes('Chef smiling in television kitchen'));
    if (!target) return 'tile not found';

    const moreBtn = target.querySelector('button[aria-label="More options"]');
    if (moreBtn) {
      moreBtn.click();
    }
    return {
      hasMoreBtn: !!moreBtn
    };
  });
  console.log('Tile info:', tileInfo);
  await sleep(2000);

  const menuItems = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button'));
    return items.map(i => i.innerText);
  });
  console.log('Menu items for video tile:', menuItems);

  const hasDownload = menuItems.some(i => i.toLowerCase().includes('download') || i.toLowerCase().includes('baixar'));
  if (hasDownload) {
    console.log('Setting download directory to /tmp/flow-downloads...');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: '/tmp/flow-downloads'
    });
    fs.mkdirSync('/tmp/flow-downloads', { recursive: true });

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button'));
      const dl = items.find(i => (i.innerText || '').toLowerCase().includes('download') || (i.innerText || '').toLowerCase().includes('baixar'));
      if (dl) dl.click();
    });

    console.log('Waiting 12s for download...');
    await sleep(12000);
    const files = fs.readdirSync('/tmp/flow-downloads');
    console.log('Downloaded files:', files);
  }

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/download-tile-video.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
