import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");
(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  console.log("Pages count:", pages.length);
  for (let i = 0; i < pages.length; i++) {
    console.log(i, await pages[i].title(), pages[i].url());
  }
  await browser.disconnect();
})().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
