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
  if (!flowPage) throw new Error("Flow page not found");
  await flowPage.bringToFront();
  await flowPage.screenshot({ path: "/tmp/flow_current_state.png" });
  console.log("Flow screenshot taken!");
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_current_state.png
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_current_state.png', buf);
  console.log('Saved public/cast/flow_current_state.png:', buf.length, 'bytes');
}

main().catch(console.error);
