import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const tiles = await page.evaluate(() => {
    const containers = [...document.querySelectorAll('flow-grid-tile-container')];
    return containers.slice(0, 7).map((c, i) => {
      const aria = c.getAttribute('aria-label') || '';
      const footer = c.querySelector('.footer-title')?.innerText || '';
      return { idx: i, aria, footer };
    });
  });

  console.log('Grid top 7 tiles:\\n', JSON.stringify(tiles, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
