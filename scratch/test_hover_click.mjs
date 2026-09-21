import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const tiles = await page.$$('flow-grid-tile-container');
  const t0 = tiles[0];
  console.log('Hovering over tile 0...');
  await t0.hover();
  await sleep(1000);

  // Check interactive elements inside t0 after hover
  const hoverState = await t0.evaluate(el => {
    return {
      innerHTML: el.innerHTML.slice(0, 800),
      buttons: [...el.querySelectorAll('button, .pre-hover-overlay, flow-tile-hover-footer')].map(b => ({
        tag: b.tagName,
        class: b.className,
        aria: b.getAttribute('aria-label') || b.innerText
      }))
    };
  });
  console.log('Hover state inside t0:\\n', JSON.stringify(hoverState, null, 2));

  // Click on the tile itself (video tile container)
  console.log('Clicking tile 0...');
  await t0.click();
  await sleep(2000);

  const videoSrc = await page.evaluate(() => {
    const v = document.querySelector('video.main-video') || document.querySelector('video');
    return v ? { src: v.src, currentSrc: v.currentSrc } : null;
  });
  console.log('Video element after click:', JSON.stringify(videoSrc));

  await page.keyboard.press('Escape');
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 45000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
