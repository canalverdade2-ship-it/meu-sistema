import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/check-tile-menu.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  // Find the tile and its more_vert button
  const result = await page.evaluate(() => {
    // Find element containing "Chef smiling in television kitchen"
    const all = Array.from(document.querySelectorAll('*'));
    const textNode = all.find(e => (e.innerText || '').includes('Chef smiling in television kitchen') && e.children.length < 3);
    if (!textNode) return { found: false };

    // Find closest container/card
    let card = textNode;
    while (card && !card.querySelector('button[aria-label="More options"]') && card.parentElement) {
      card = card.parentElement;
    }
    if (!card) return { found: true, cardFound: false };

    const moreBtn = card.querySelector('button[aria-label="More options"]');
    if (moreBtn) {
      moreBtn.click();
      return { found: true, cardFound: true, clickedMore: true };
    }
    return { found: true, cardFound: true, clickedMore: false };
  });

  console.log('Result:', result);
  await sleep(2000);

  // Read overlay menu
  const menuItems = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button'));
    return overlays.map(o => o.innerText);
  });
  console.log('Menu items:', menuItems);

  await page.screenshot({ path: '/tmp/tile-menu-screenshot.png' });

  // If download option exists, click it!
  const hasDownload = menuItems.some(i => i.toLowerCase().includes('download') || i.toLowerCase().includes('baixar'));
  if (hasDownload) {
    console.log('Clicking Download from menu...');
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

    console.log('Waiting 10s for download to finish...');
    await sleep(10000);
    const files = fs.readdirSync('/tmp/flow-downloads');
    console.log('Files in /tmp/flow-downloads:', files);
  }

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/check-tile-menu.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
