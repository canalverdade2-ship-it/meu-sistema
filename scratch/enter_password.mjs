import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function unlock() {
  const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/google-production.enc.json', 'utf8'));
  const key = Buffer.from(cp.execFileSync('sudo', ['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'], { encoding: 'utf8' }).trim(), 'hex');
  const nonce = Buffer.from(v.nonce, 'base64url'), all = Buffer.from(v.ciphertext, 'base64url'), tag = all.subarray(-16), body = all.subarray(0, -16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  d.setAAD(Buffer.from(v.aad));
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
}

(async () => {
  const cred = unlock();
  console.log('Credentials unlocked for:', cred.email);

  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('signin/challenge/pwd') || p.url().includes('challenge'));
  if (!page) throw new Error('password page not found! current urls: ' + pages.map(p => p.url()).join(' ; '));

  console.log('Password page found:', page.url());

  const pw = await page.waitForSelector('input[type=password]', { timeout: 10000 });
  if (!pw) throw new Error('password input not found');

  console.log('Entering password...');
  // Fill password value using property descriptor and dispatch input events
  await page.evaluate((el, val) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, pw, cred.password);

  await sleep(1000);

  console.log('Clicking Next / Submitting...');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('#passwordNext') ||
                document.querySelector('button[jsname="LgbsSe"]') ||
                [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim().toLowerCase() === 'next' || (b.innerText || '').trim().toLowerCase() === 'avançar' || (b.innerText || '').trim().toLowerCase() === 'próxima');
    if (btn) {
      btn.click();
      return 'button clicked: ' + (btn.id || btn.className);
    }
    return 'button not found';
  });
  console.log('Click result:', clicked);

  console.log('Waiting 12s for navigation...');
  await sleep(12000);

  console.log('URL after submit:', page.url());
  console.log('Title after submit:', await page.title());
  console.log('Body snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\\n+/g, ' | '));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 40000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
