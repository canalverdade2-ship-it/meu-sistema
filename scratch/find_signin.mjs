import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const p0 = pages.find(p => p.url().includes('flow.google.com/about'));
  if (p0) {
    const signInLinks = await p0.evaluate(() => {
      return [...document.querySelectorAll('a, button')]
        .map(e => ({ tag: e.tagName, text: (e.innerText || '').trim(), href: e.href || '', aria: e.getAttribute('aria-label') || '' }))
        .filter(e => e.text.toLowerCase().includes('sign') || e.text.toLowerCase().includes('entrar') || e.href.includes('accounts.google.com') || e.aria.toLowerCase().includes('sign'));
    });
    console.log('SignIn elements on flow about:', JSON.stringify(signInLinks, null, 2));
  }
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
