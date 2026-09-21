import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages[0];
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  
  // Get all buttons and inputs
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, input, textarea, [role=\"button\"]')).map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      innerText: (el.innerText || '').slice(0, 50).trim(),
      placeholder: el.getAttribute('placeholder')
    })).filter(e => e.ariaLabel || e.innerText || e.placeholder);
  });
  
  console.log('Interactive elements count:', elements.length);
  console.log(JSON.stringify(elements.slice(0, 30), null, 2));
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
