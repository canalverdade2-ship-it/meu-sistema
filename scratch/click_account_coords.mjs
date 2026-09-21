import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('accounts.google.com/v3/signin/accountchooser'));
  if (!page) throw new Error('not found');

  console.log('Clicking at (600, 130)...');
  await page.mouse.click(600, 130);
  await sleep(4000);

  console.log('After click, URL:', page.url());
  console.log('Title:', await page.title());
  console.log('Body text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\\n+/g, ' | '));

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
