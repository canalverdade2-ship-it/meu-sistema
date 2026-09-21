import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');

function unlock() {
  const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/google-production.enc.json', 'utf8'));
  const key = Buffer.from(cp.execFileSync('sudo', ['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'], { encoding: 'utf8' }).trim(), 'hex');
  const nonce = Buffer.from(v.nonce, 'base64url'), all = Buffer.from(v.ciphertext, 'base64url'), tag = all.subarray(-16), body = all.subarray(0, -16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  d.setAAD(Buffer.from(v.aad));
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const cred = unlock();
  console.log('Credentials unlocked for:', cred.email);
  
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('accounts.google.com/v3/signin/accountchooser'));
  if (!page) throw new Error('accountchooser page not found');

  console.log('Found accountchooser page:', page.url());
  
  // Find account element
  const account = await page.evaluateHandle(email => {
    return [...document.querySelectorAll('[data-email], li, [role=link], [role=button]')]
      .find(e => (e.getAttribute('data-email') || e.innerText || '').includes(email));
  }, cred.email);

  if (!account.asElement()) {
    throw new Error('Account element not found in DOM');
  }

  console.log('Account element found, clicking...');
  await account.asElement().click();
  await sleep(4000);

  console.log('After clicking account, URL:', page.url());
  console.log('Page Title:', await page.title());
  console.log('Page Text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\\n+/g, ' | '));

  // Look for password input
  const pw = await page.$('input[type=password]');
  if (pw) {
    console.log('Password input found, typing password...');
    await pw.type(cred.password, { delay: 20 });
    await sleep(500);

    const nextBtn = await page.$('#passwordNext, button[jsname="LgbsSe"], button[type=button]');
    console.log('Clicking Next...');
    if (nextBtn) {
      await nextBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await sleep(10000);
    console.log('After submit, URL:', page.url());
  } else {
    console.log('No password input found. Current inputs:');
    const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ type: i.type, name: i.name, id: i.id })));
    console.log(inputs);
  }

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
