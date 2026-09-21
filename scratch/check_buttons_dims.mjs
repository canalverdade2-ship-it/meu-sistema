import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const p = (await b.pages())[0];

  const info = await p.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.map(b => ({
      text: (b.innerText || '').trim(),
      w: b.offsetWidth,
      h: b.offsetHeight,
      rects: b.getClientRects().length,
      disabled: b.disabled,
      className: b.className
    }));
  });

  console.log('Buttons:', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
