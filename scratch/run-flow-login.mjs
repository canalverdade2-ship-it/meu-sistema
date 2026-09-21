import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/login-flow-auth.cjs
const fs = require('fs'), crypto = require('crypto');
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function unlock() {
  const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/google-production.enc.json', 'utf8'));
  const key = Buffer.from('06edbcf3aa196b06c030568b1b4954f5df7484f3c3910e5341b9bd7756b69362', 'hex');
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
  const page = pages[0];
  
  console.log('Current URL:', page.url());
  
  if (page.url().includes('accountchooser')) {
    const account = await page.evaluateHandle(email => [...document.querySelectorAll('[data-email],li,[role=link],[role=button]')].find(e => (e.getAttribute('data-email') || e.innerText || '').includes(email)), cred.email);
    if (account && account.asElement()) {
      console.log('Clicking account in list...');
      await account.asElement().click();
      await sleep(4000);
    }
  }
  
  console.log('URL after check:', page.url());
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    console.log('Entering password...');
    await pwInput.focus();
    await page.keyboard.type(cred.password, { delay: 50 });
    await sleep(1000);
    console.log('Pressing Enter...');
    await page.keyboard.press('Enter');
    await sleep(12000);
  }
  
  console.log('Final URL:', page.url());
  console.log('Final Title:', await page.title());
  await page.screenshot({ path: '/tmp/flow-login-result.png' });
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/login-flow-auth.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
