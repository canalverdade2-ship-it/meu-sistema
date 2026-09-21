import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  console.log('Clicking back button...');
  await page.evaluate(() => {
    const back = document.querySelector('button.back-button') || document.querySelector('button[aria-label*="Back"]');
    if (back) back.click();
  });

  await sleep(3000);
  console.log('Current URL after back:', page.url());

  const count = await page.evaluate(() => document.querySelectorAll('flow-grid-tile-container').length);
  console.log('Tile containers count:', count);

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
