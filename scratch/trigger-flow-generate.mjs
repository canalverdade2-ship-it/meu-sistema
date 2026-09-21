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
  
  // Pressiona Escape para fechar qualquer popup/modal aberto
  await flowPage.keyboard.press("Escape");
  await new Promise(r => setTimeout(r, 600));
  
  // Clica no editor e aperta Enter
  const editor = await flowPage.$("div[contenteditable=\\"true\\"]");
  if (editor) {
    await editor.click();
    await flowPage.keyboard.press("Enter");
  }
  
  // Ou clica no botão de seta no canto inferior direito
  // Coordenadas aproximadas do botão da seta: x ~ 845, y ~ 900
  const arrowBtn = await flowPage.$("button:has(i), button:has(svg), button:has(span)");
  const btns = await flowPage.$$("button");
  for (const b of btns) {
    const box = await b.boundingBox();
    if (box && box.y > 800 && box.x > 800) {
      console.log("Found arrow button at:", box.x, box.y);
      await b.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 4000));
  await flowPage.screenshot({ path: "/tmp/flow_generating.png" });
  await browser.disconnect();
  console.log("Triggered generation!");
})().catch(console.error);
'
base64 -w 0 /tmp/flow_generating.png
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
