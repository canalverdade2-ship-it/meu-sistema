import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('accounts.google.com/v3/signin/accountchooser'));
  if (!page) throw new Error('not found');

  const info = await page.evaluate(() => {
    const list = document.querySelectorAll('ul li, div[role=link], div[data-email], [data-identifier]');
    return [...list].map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        role: el.getAttribute('role'),
        dataEmail: el.getAttribute('data-email'),
        dataIdentifier: el.getAttribute('data-identifier'),
        jsname: el.getAttribute('jsname'),
        className: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        outerHTML: el.outerHTML.slice(0, 300)
      };
    });
  });

  console.log('Account elements info:\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
