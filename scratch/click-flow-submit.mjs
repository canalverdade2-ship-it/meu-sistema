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
  
  // Encontra todos os botões e suas posições exatas
  const btnInfo = await flowPage.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map((b, idx) => {
      const r = b.getBoundingClientRect();
      return { idx, text: b.innerText, x: r.x, y: r.y, w: r.width, h: r.height };
    }).filter(b => b.w > 0 && b.h > 0);
  });
  console.log("Buttons with rects:", JSON.stringify(btnInfo, null, 2));
  
  // O botão de envio tem a maior coordenada X entre os botões inferiores
  const bottomBtns = btnInfo.filter(b => b.y > 600);
  bottomBtns.sort((a, b) => b.x - a.x);
  if (bottomBtns.length > 0) {
    const target = bottomBtns[0];
    console.log("Clicking target button at:", target.x + target.w/2, target.y + target.h/2);
    await flowPage.mouse.click(target.x + target.w/2, target.y + target.h/2);
  }
  
  await new Promise(r => setTimeout(r, 4000));
  await flowPage.screenshot({ path: "/tmp/flow_opt1_clicked.png" });
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_opt1_clicked.png
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_opt1_clicked.png', buf);
  console.log('Saved public/cast/flow_opt1_clicked.png:', buf.length, 'bytes');
}

main().catch(console.error);
