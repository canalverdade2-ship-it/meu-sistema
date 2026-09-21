import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const fileInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type=\"file\"]')).map(el => ({
      name: el.name,
      id: el.id,
      accept: el.accept
    }));
  });
  console.log('File inputs:', fileInputs);
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
