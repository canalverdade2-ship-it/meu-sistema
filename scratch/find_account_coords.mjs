import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('accounts.google.com/v3/signin/accountchooser'));
  if (!page) throw new Error('not found');

  const matches = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    return all
      .filter(e => (e.innerText || '').includes('adriano9865@gmail.com'))
      .map(e => {
        const r = e.getBoundingClientRect();
        return {
          tag: e.tagName,
          id: e.id,
          className: e.className,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          jsaction: e.getAttribute('jsaction')
        };
      });
  });

  console.log('Matches for adriano9865@gmail.com:\\n', JSON.stringify(matches, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
