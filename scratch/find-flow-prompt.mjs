import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('textarea, div[contenteditable=\"true\"], input')).map((el, i) => ({
      i,
      tag: el.tagName,
      contentEditable: el.getAttribute('contenteditable'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      value: el.value,
      innerText: (el.innerText || '').slice(0, 100)
    }));
  });
  console.log(JSON.stringify(inputs, null, 2));
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
