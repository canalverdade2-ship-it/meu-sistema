import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge/pwd') || p.url().includes('challenge'));
  if (!page) throw new Error('pwd page not found');

  console.log('Focusing password and pressing Enter...');
  const pw = await page.$('input[type=password]');
  await pw.focus();
  await sleep(300);
  await page.keyboard.press('Enter');
  
  // Also find and click the Next button with mousedown/mouseup/click
  await page.evaluate(() => {
    const nextBtn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Next');
    if (nextBtn) {
      const opts = { bubbles: true, cancelable: true, view: window };
      nextBtn.dispatchEvent(new MouseEvent('mousedown', opts));
      nextBtn.dispatchEvent(new MouseEvent('mouseup', opts));
      nextBtn.dispatchEvent(new MouseEvent('click', opts));
    }
  });

  console.log('Waiting 15s for login navigation...');
  await sleep(15000);

  console.log('URL after submit:', page.url());
  console.log('Title after submit:', await page.title());
  console.log('Body text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 500).replace(/\\n+/g, ' | '));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 35000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
