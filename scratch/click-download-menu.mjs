import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/click-download-menu.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  await page.keyboard.press('Escape');
  await sleep(1000);

  // Find the tile's more_vert button
  const moreBtn = await page.evaluateHandle(() => {
    const tiles = Array.from(document.querySelectorAll('flow-video-tile'));
    const target = tiles.find(t => (t.innerText || '').includes('Chef smiling in television kitchen'));
    return target ? target.querySelector('button[aria-label="More options"]') : null;
  });

  if (moreBtn && moreBtn.asElement()) {
    console.log('Clicking more options on tile...');
    await moreBtn.asElement().click();
    await sleep(1500);

    // Find the download item
    const dlBtn = await page.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button'));
      return items.find(i => (i.innerText || '').toLowerCase().includes('download'));
    });

    if (dlBtn && dlBtn.asElement()) {
      console.log('Clicking Download item...');
      
      // Listen for download / request events
      page.on('response', res => {
        const u = res.url();
        if (u.includes('.mp4') || u.includes('video') || u.includes('flow') || u.includes('storage.googleapis')) {
          console.log('Response URL:', u.slice(0, 150));
        }
      });

      await dlBtn.asElement().click();
      await sleep(3000);

      // Check if another menu opened (e.g. format choice)
      const afterClickOverlays = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button, mat-dialog-container')).map(el => el.innerText);
      });
      console.log('Overlays after clicking download:', afterClickOverlays);
      await page.screenshot({ path: '/tmp/after-download-click.png' });
    }
  }

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/click-download-menu.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
