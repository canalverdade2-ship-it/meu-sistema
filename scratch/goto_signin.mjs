import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const p0 = pages.find(p => p.url().includes('flow.google.com/about'));
  if (!p0) throw new Error('p0 not found');

  const signInUrl = "https://accounts.google.com/ServiceLogin?passive=1209600&osid=1&continue=https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554&followup=https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554&ec=GAZA7QU";
  console.log('Navigating p0 to signInUrl...');
  await p0.goto(signInUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  console.log('Current URL:', p0.url());
  console.log('Title:', await p0.title());
  const text = await p0.evaluate(() => document.body.innerText);
  console.log('Text:\\n', text);

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 40000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
