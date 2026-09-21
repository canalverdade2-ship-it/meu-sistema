import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228', protocolTimeout: 60000 });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  // If in edit view, go back
  if (page.url().includes('/edit/')) {
    console.log('Returning to grid...');
    await page.evaluate(() => {
      const back = document.querySelector('button.back-button');
      if (back) back.click();
    });
    await sleep(3000);
  }

  console.log('Current page URL:', page.url());
  const t1Info = await page.evaluate(() => {
    const t1 = document.querySelectorAll('flow-grid-tile-container')[1];
    return {
      aria: t1 ? t1.getAttribute('aria-label') : null,
      footer: t1 ? t1.querySelector('.footer-title')?.innerText : null
    };
  });
  console.log('Tile 1 info:', JSON.stringify(t1Info));

  console.log('Clicking tile 1 play overlay...');
  await page.evaluate(() => {
    const t1 = document.querySelectorAll('flow-grid-tile-container')[1];
    const play = t1 ? t1.querySelector('.pre-hover-overlay') : null;
    if (play) play.click();
  });

  await sleep(3500);

  const detail = await page.evaluate(() => {
    const v = document.querySelector('video.main-video') || document.querySelector('video');
    return {
      url: window.location.href,
      src: v ? (v.currentSrc || v.src) : null
    };
  });
  console.log('Tile 1 Detail:', JSON.stringify(detail, null, 2));

  // Return to grid
  await page.evaluate(() => {
    const back = document.querySelector('button.back-button');
    if (back) back.click();
  });
  await sleep(2000);

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 35000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
