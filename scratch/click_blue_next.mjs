import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const p = (await b.pages())[0];

  const point = await p.evaluate(() => {
    const el = document.elementFromPoint(735, 260) || document.elementFromPoint(720, 260);
    return {
      tag: el ? el.tagName : null,
      text: el ? el.innerText : null,
      className: el ? el.className : null
    };
  });
  console.log('Element at (735, 260):', JSON.stringify(point));

  console.log('Clicking at (735, 260)...');
  await p.mouse.click(735, 260);

  console.log('Waiting 10s for response...');
  await sleep(10000);

  console.log('URL after click:', p.url());
  console.log('Title after click:', await p.title());

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 25000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
