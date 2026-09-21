import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  
  const p1 = pages.find(p => p.url().includes('accounts.google.com'));
  if (p1) {
    console.log('URL:', p1.url());
    console.log('Text:\\n', await p1.evaluate(() => document.body.innerText));
  } else {
    console.log('No accounts.google page found');
  }

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
