import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const box = await page.evaluate(() => {
    const el = document.querySelector('div[contenteditable=\"true\"]');
    if (!el) return null;
    return {
      outerHTML: el.outerHTML,
      parentHTML: el.parentElement.outerHTML.slice(0, 500)
    };
  });
  console.log(box);
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
