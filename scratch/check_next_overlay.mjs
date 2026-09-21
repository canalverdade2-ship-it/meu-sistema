import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages[0];

  const info = await page.evaluate(() => {
    const nextSpan = [...document.querySelectorAll('span')].find(s => (s.innerText || '').trim() === 'Next');
    const nextBtn = nextSpan ? nextSpan.closest('button') : null;
    const btnRect = nextBtn ? nextBtn.getBoundingClientRect() : null;

    const overlay = document.querySelector('div.ZQxJQe');
    const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;
    const overlayRect = overlay ? overlay.getBoundingClientRect() : null;

    return {
      btnRect,
      btnDisabled: nextBtn ? nextBtn.disabled : null,
      overlayRect,
      overlayDisplay: overlayStyle ? overlayStyle.display : null,
      overlayPointerEvents: overlayStyle ? overlayStyle.pointerEvents : null,
      overlayZIndex: overlayStyle ? overlayStyle.zIndex : null
    };
  });

  console.log('Next button & overlay info:\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
