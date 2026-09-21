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
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const p = (await b.pages())[0];

  console.log('Current URL:', p.url());
  const pw = await p.$('input[type=password]');
  if (!pw) throw new Error('pw input missing');

  console.log('Focusing password...');
  await pw.focus();
  await sleep(200);

  // Clear and type with delay
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyA');
  await p.keyboard.up('Control');
  await p.keyboard.press('Backspace');
  await sleep(200);
  await p.keyboard.type(cred.password, { delay: 40 });
  await sleep(500);

  console.log('Triggering requestSubmit / click on Next button...');
  const res = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Next');
    if (!btn) return 'btn not found';
    const form = btn.closest('form') || document.querySelector('form');
    if (form && form.requestSubmit) {
      form.requestSubmit(btn);
      return 'form.requestSubmit called';
    } else {
      btn.click();
      return 'btn.click called';
    }
  });
  console.log('Submit action result:', res);

  console.log('Waiting 15s for navigation...');
  await sleep(15000);

  console.log('URL after submit:', p.url());
  console.log('Title after submit:', await p.title());

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 35000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
