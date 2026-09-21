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
  await flowPage.bringToFront();
  
  // Clica no botão exato "arrow_forward Criar" em x=676, y=543
  console.log("Clicking submit button at x=676, y=543...");
  await flowPage.mouse.click(676, 543);
  
  await new Promise(r => setTimeout(r, 4000));
  await flowPage.screenshot({ path: "/tmp/flow_opt1_running.png" });
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_opt1_running.png
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_opt1_running.png', buf);
  console.log('Saved public/cast/flow_opt1_running.png:', buf.length, 'bytes');
}

main().catch(console.error);
