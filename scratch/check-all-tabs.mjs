import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  for (let i = 0; i < pages.length; i++) {
    console.log(i, pages[i].url(), await pages[i].title());
  }
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
