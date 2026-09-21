import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  console.log('Dispatching click on .pre-hover-overlay of tile 0...');
  const res = await page.evaluate(() => {
    const t0 = document.querySelectorAll('flow-grid-tile-container')[0];
    const play = t0.querySelector('.pre-hover-overlay');
    if (!play) return 'no play';
    play.click();
    return 'clicked';
  });
  console.log('Result:', res);
  await sleep(2000);

  const check = await page.evaluate(() => {
    const video = document.querySelector('video');
    const overlay = document.querySelector('.cdk-overlay-container');
    return {
      hasVideo: !!video,
      videoSrc: video ? (video.currentSrc || video.src) : null,
      overlayHtml: overlay ? overlay.innerHTML.slice(0, 1000) : 'no overlay'
    };
  });
  console.log('Check after play click:\\n', JSON.stringify(check, null, 2));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 25000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
