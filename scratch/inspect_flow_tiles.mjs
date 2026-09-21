import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('flow project page not found');

  console.log('Found page:', page.url());
  await sleep(3000);

  const tiles = await page.evaluate(() => {
    const containers = [...document.querySelectorAll('flow-grid-tile-container')];
    return containers.slice(0, 10).map((c, i) => {
      const img = c.querySelector('img.thumbnail');
      const mediaId = img && img.src ? (img.src.match(/\\/image\\/([^?]+)/) || [])[1] : '';
      const play = c.querySelector('.pre-hover-overlay');
      return {
        index: i,
        aria: c.getAttribute('aria-label') || '',
        mediaId,
        imgSrc: (img?.src || '').slice(0, 80),
        hasPlay: !!play,
        hasError: !!c.querySelector('flow-error-tile'),
        isGenerating: !!c.querySelector('flow-generating-tile')
      };
    });
  });

  console.log('Top 10 tiles:\\n', JSON.stringify(tiles, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 25000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
