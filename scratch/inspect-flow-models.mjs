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
  
  // Procura o botão do modelo (Nano Banana 2)
  const buttons = await flowPage.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map(b => ({
      text: b.innerText,
      aria: b.getAttribute("aria-label"),
      cls: b.className
    })).filter(x => x.text.includes("Banana") || x.text.includes("Veo") || x.text.includes("Vídeo") || (x.aria && (x.aria.includes("modelo") || x.aria.includes("model"))));
  });
  console.log("Model buttons found:", JSON.stringify(buttons, null, 2));
  
  // Clica no botão Nano Banana para abrir o menu de modelos
  const modelBtn = await flowPage.$("button:has-text(\\"Nano Banana\\"), [class*=\\"sc-\\"] button");
  const allBtns = await flowPage.$$("button");
  for (const b of allBtns) {
    const txt = await flowPage.evaluate(el => el.innerText, b);
    if (txt && txt.includes("Nano Banana")) {
      console.log("Found Nano Banana button, clicking to see model options...");
      await b.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 1500));
  await flowPage.screenshot({ path: "/tmp/flow_model_menu.png" });
  
  // Lista itens do menu que abriram
  const menuItems = await flowPage.evaluate(() => {
    return Array.from(document.querySelectorAll("[role=\\"menuitem\\"], [role=\\"option\\"], li, div[class*=\\"menu\\"], div[class*=\\"dropdown\\"]")).map(el => el.innerText).filter(t => t && t.length < 50);
  });
  console.log("Menu items:", menuItems.slice(0, 20));
  
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_model_menu.png
`;
  const res = await runSshScript(script);
  const lines = res.stdout.trim().split('\n');
  const base64 = lines.pop();
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync('public/cast/flow_model_menu.png', buf);
  console.log('Saved public/cast/flow_model_menu.png:', buf.length, 'bytes');
}

main().catch(console.error);
