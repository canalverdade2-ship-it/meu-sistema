import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  console.log('Testing video URL extraction for tile 0 (GSA Business opening)...');
  const tiles = await page.$$('flow-grid-tile-container');
  const t0 = tiles[0];
  const play = await t0.$('.pre-hover-overlay');
  if (!play) throw new Error('play button not found on tile 0');

  await play.click();
  console.log('Clicked play overlay, waiting for video...');
  await page.waitForSelector('video.main-video, video', { timeout: 15000 });
  await sleep(1500);

  const videoSrc = await page.evaluate(() => {
    const v = document.querySelector('video.main-video') || document.querySelector('video');
    return v ? (v.currentSrc || v.src) : null;
  });

  console.log('Video source URL:', videoSrc);
  await page.keyboard.press('Escape');
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
