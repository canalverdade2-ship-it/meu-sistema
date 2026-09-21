import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/login-flow-cdp.cjs
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
  
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    console.log('Focusing password field...');
    await pwInput.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(500);
    
    console.log('Using CDP Input.insertText...');
    const client = await page.target().createCDPSession();
    await client.send('Input.insertText', { text: cred.password });
    await sleep(1000);
    
    const valLength = await page.evaluate(() => {
      const el = document.querySelector('input[type="password"]');
      return el ? el.value.length : 0;
    });
    console.log('Password entered length:', valLength);
    
    console.log('Submitting via Enter...');
    await page.keyboard.press('Enter');
    await sleep(15000);
  }
  
  console.log('Result URL:', page.url());
  console.log('Result Title:', await page.title());
  const body = await page.evaluate(() => document.body.innerText);
  console.log('Result Text:', body.slice(0, 500));
  await page.screenshot({ path: '/tmp/flow-cdp-login.png' });
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/login-flow-cdp.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
