import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");
(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  if (!flowPage) {
    console.log("Flow page not found!");
    return;
  }
  console.log("Found Flow page:", await flowPage.title(), flowPage.url());
  await flowPage.bringToFront();
  await flowPage.screenshot({ path: "/tmp/flow_current.png" });
  console.log("Screenshot taken!");
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_current.png
`;
  const res = await runSshScript(script);
  const buffer = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_current.png', buffer);
  console.log('Saved flow_current.png:', buffer.length, 'bytes');
}

main().catch(console.error);
