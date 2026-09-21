import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge'));
  if (!page) throw new Error('challenge page not found');

  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].map(i => ({
      src: i.src.slice(0, 100),
      rect: i.getBoundingClientRect()
    }));
    const inputs = [...document.querySelectorAll('input')].map(i => ({
      type: i.type,
      name: i.name,
      id: i.id,
      ariaLabel: i.getAttribute('aria-label')
    }));
    return { imgs, inputs };
  });

  console.log('Captcha info:\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
