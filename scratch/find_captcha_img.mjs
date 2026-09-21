import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge'));
  if (!page) throw new Error('challenge page not found');

  const captcha = await page.evaluate(() => {
    const ca = document.querySelector('#ca');
    const parent = ca ? ca.closest('form, section, div.xKcayf, div') : null;
    const img = document.querySelector('img[src*="captcha"], #captchaimg') || (parent ? parent.querySelector('img') : null);
    return {
      caFound: !!ca,
      imgSrc: img ? img.src : null,
      parentHtml: parent ? parent.outerHTML.slice(0, 1000) : null
    };
  });

  console.log('Captcha element details:\\n', JSON.stringify(captcha, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
