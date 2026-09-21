import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  
  // Inspect page [1] (sessionexpired)
  const p1 = pages.find(p => p.url().includes('sessionexpired'));
  if (p1) {
    console.log('--- Page 1 elements ---');
    console.log('URL:', p1.url());
    console.log('Text:', (await p1.evaluate(() => document.body.innerText)).slice(0, 1000));
    const buttons = await p1.evaluate(() => [...document.querySelectorAll('button, a, input')].map(e => ({ tag: e.tagName, text: e.innerText || e.value, id: e.id, class: e.className })));
    console.log('Buttons/inputs:', JSON.stringify(buttons, null, 2));
  }

  // Inspect page [0] (flow about)
  const p0 = pages.find(p => p.url().includes('flow.google.com/about'));
  if (p0) {
    console.log('--- Page 0 (flow about) elements ---');
    const links = await p0.evaluate(() => [...document.querySelectorAll('a, button')].map(e => ({ tag: e.tagName, text: (e.innerText||'').trim(), href: e.href || '' })).filter(x => x.text));
    console.log('Links:', JSON.stringify(links, null, 2));
  }

  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
