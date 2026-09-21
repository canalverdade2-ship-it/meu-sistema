import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  
  const p1 = pages.find(p => p.url().includes('accounts.google.com'));
  if (!p1) throw new Error('no accounts.google page');
  
  console.log('Current URL:', p1.url());
  const tryAgain = await p1.evaluateHandle(() => {
    return [...document.querySelectorAll('button, a')].find(e => (e.innerText || '').toLowerCase().includes('try again'));
  });
  
  if (tryAgain.asElement()) {
    console.log('Clicking "Try again"...');
    await tryAgain.asElement().click();
    await sleep(5000);
  } else {
    console.log('No "Try again" element found, navigating directly to https://accounts.google.com/ ...');
    await p1.goto('https://accounts.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  }

  console.log('New URL:', p1.url());
  console.log('New Text:\\n', await p1.evaluate(() => document.body.innerText));

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 45000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
