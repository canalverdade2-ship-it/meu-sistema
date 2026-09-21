import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge/pwd') || p.url().includes('challenge'));
  if (!page) throw new Error('pwd page not found');

  await page.screenshot({ path: '/home/opc/gsa-ai/pwd_screen.png' });
  console.log('Screenshot saved to /home/opc/gsa-ai/pwd_screen.png');

  const visibleText = await page.evaluate(() => {
    return [...document.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && (e.innerText || '').trim())
      .map(e => (e.innerText || '').trim());
  });
  console.log('Visible text elements:\\n', JSON.stringify([...new Set(visibleText)], null, 2));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
