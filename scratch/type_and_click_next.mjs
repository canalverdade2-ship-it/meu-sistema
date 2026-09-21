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
  console.log('Credentials unlocked for:', cred.email, 'pw length:', cred.password.length);

  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge/pwd') || p.url().includes('challenge'));
  if (!page) throw new Error('pwd page not found');

  const pw = await page.$('input[type=password]');
  if (!pw) throw new Error('pw input not found');

  console.log('Focusing and clearing password input...');
  await pw.focus();
  await sleep(200);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await sleep(300);

  console.log('Typing password via keyboard with delay...');
  await page.keyboard.type(cred.password, { delay: 60 });
  await sleep(1000);

  // Find Next button bounding box
  const nextBtn = await page.evaluateHandle(() => {
    return [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Next');
  });

  if (!nextBtn.asElement()) throw new Error('Next button not found');
  const box = await nextBtn.asElement().boundingBox();
  console.log('Next button bounding box:', box);

  console.log('Clicking Next button at center coordinates...');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  console.log('Waiting 12s for post-submit response...');
  await sleep(12000);

  console.log('URL after submit:', page.url());
  console.log('Title:', await page.title());
  console.log('Body text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\\n+/g, ' | '));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 40000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
