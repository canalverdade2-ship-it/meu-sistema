import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge'));
  if (!page) throw new Error('pwd page not found');

  const info = await page.evaluate(() => {
    const el = document.elementFromPoint(736, 345);
    return {
      tag: el ? el.tagName : null,
      id: el ? el.id : null,
      className: el ? el.className : null,
      outer: el ? el.outerHTML.slice(0, 200) : null
    };
  });

  console.log('Element at point (736, 345):\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
