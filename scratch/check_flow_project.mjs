import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const p = await b.newPage();
  console.log('Navigating to flow project ac1da714-fe03-4812-b62d-fb92d575e554...');
  await p.goto('https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);

  console.log('Current URL:', p.url());
  console.log('Title:', await p.title());
  const tiles = await p.evaluate(() => {
    const containers = document.querySelectorAll('flow-grid-tile-container');
    return [...containers].slice(0, 10).map((c, i) => ({
      idx: i,
      aria: (c.getAttribute('aria-label') || '').slice(0, 40),
      hasVideo: !!c.querySelector('flow-video-tile'),
      hasImg: !!c.querySelector('img.thumbnail'),
      imgSrc: c.querySelector('img.thumbnail')?.src || '',
      hasErr: !!c.querySelector('flow-error-tile')
    }));
  });
  console.log('Tiles found:\\n', JSON.stringify(tiles, null, 2));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 40000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
