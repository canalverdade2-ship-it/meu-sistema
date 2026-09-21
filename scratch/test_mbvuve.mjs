import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages[0];

  console.log('Testing click on [jsname="MBVUVe"] / [data-identifier="adriano9865@gmail.com"]...');
  const res = await page.evaluate(() => {
    const el = document.querySelector('div[jsname="MBVUVe"]') || document.querySelector('[data-identifier="adriano9865@gmail.com"]');
    if (!el) return 'el not found';
    
    // Dispatch mousedown, mouseup, click on el
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    return 'dispatched events';
  });
  console.log('Dispatch result:', res);
  await sleep(5000);

  console.log('URL after dispatch:', page.url());
  console.log('Title:', await page.title());
  console.log('Text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\\n+/g, ' | '));

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
