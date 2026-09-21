import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('accounts.google.com'));
  if (!page) throw new Error('not found');

  console.log('Navigating directly to signin with login_hint...');
  const url = 'https://accounts.google.com/signin/v2/identifier?continue=https%3A%2F%2Fflow.google.com%2Fproject%2Fac1da714-fe03-4812-b62d-fb92d575e554&flowName=GlifWebSignIn&flowEntry=ServiceLogin&login_hint=adriano9865%40gmail.com';
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);

  console.log('Current URL:', page.url());
  console.log('Title:', await page.title());
  console.log('Body text snippet:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\\n+/g, ' | '));

  const pw = await page.$('input[type=password]');
  console.log('Password input present:', !!pw);

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 40000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
