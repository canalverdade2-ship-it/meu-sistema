import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');

const LOG = '/tmp/login_direct.log';
function log(...a) {
  const s = \`[\${new Date().toISOString()}] \${a.join(' ')}\\n\`;
  fs.appendFileSync(LOG, s);
  console.log(s.trim());
}
fs.writeFileSync(LOG, 'START\\n');

function unlock() {
  log('Unlocking credentials...');
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
  log('Credentials unlocked for:', cred.email);

  log('Connecting to browser CDP...');
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  log('Found', pages.length, 'pages');

  const page = pages.find(p => p.url().includes('accounts.google.com/v3/signin/accountchooser'));
  if (!page) {
    log('ERROR: accountchooser page not found!');
    await b.disconnect();
    return;
  }

  log('Page found:', page.url());

  // Click on account in page via evaluate
  log('Searching and clicking account...');
  const clicked = await page.evaluate(email => {
    const els = [...document.querySelectorAll('[data-email], li, [role=link], [role=button]')];
    const target = els.find(e => (e.getAttribute('data-email') || e.innerText || '').includes(email));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, cred.email);

  log('Account click result:', clicked);
  if (!clicked) {
    log('ERROR: Could not find account element to click');
    await b.disconnect();
    return;
  }

  log('Waiting 4s after click...');
  await sleep(4000);

  log('Current URL after account click:', page.url());
  const bodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 300).replace(/\\n+/g, ' | '));
  log('Body text:', bodyText);

  // Check for password field
  const hasPw = await page.$('input[type=password]');
  log('Password field present:', !!hasPw);

  if (hasPw) {
    log('Typing password...');
    await hasPw.type(cred.password, { delay: 15 });
    await sleep(500);

    log('Submitting password...');
    await page.evaluate(() => {
      const btn = document.querySelector('#passwordNext') || 
                  document.querySelector('button[jsname="LgbsSe"]') ||
                  [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Next' || (b.innerText || '').trim() === 'Próxima');
      if (btn) btn.click();
      else {
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    log('Waiting 10s for post-login navigation...');
    await sleep(10000);
    log('Post-login URL:', page.url());
    log('Post-login Title:', await page.title());
  }

  await b.disconnect();
  log('DONE');
})().catch(e => {
  log('EXCEPTION:', e.message, e.stack);
  process.exit(1);
});
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
