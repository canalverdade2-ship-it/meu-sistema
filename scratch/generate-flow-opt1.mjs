import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const promptText = "Photorealistic 3D broadcast television logo ident: GSA TÁ NA REDE. Solid brushed metallic gold 3D typography with beveled edges, encased in polished dark sapphire acrylic glass prisms. Clean luxury dark onyx studio backdrop, subtle volumetric golden lighting beams and gentle warm dust motes. High-end television network branding, pristine broadcast aesthetic, prestigious, no cartoon emojis, no stickers, clean luxury design, 16:9 widescreen.";

  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  if (!flowPage) throw new Error("Flow page not found");
  
  await flowPage.bringToFront();
  
  const editor = await flowPage.$("div[contenteditable=\\"true\\"]");
  if (!editor) throw new Error("Editor div not found");
  
  await editor.click();
  await new Promise(r => setTimeout(r, 400));
  
  // Limpa qualquer texto existente
  await flowPage.keyboard.down("Control");
  await flowPage.keyboard.press("A");
  await flowPage.keyboard.up("Control");
  await flowPage.keyboard.press("Backspace");
  
  const prompt = ${JSON.stringify(promptText)};
  await flowPage.keyboard.type(prompt, { delay: 4 });
  await new Promise(r => setTimeout(r, 800));
  
  // Clica no botão de seta no canto inferior direito
  const btns = await flowPage.$$("button");
  for (const b of btns) {
    const box = await b.boundingBox();
    if (box && box.y > 800 && box.x > 800) {
      console.log("Clicking submit arrow at:", box.x, box.y);
      await b.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await flowPage.screenshot({ path: "/tmp/flow_opt1_submitted.png" });
  await browser.disconnect();
  console.log("Submitted Option 1 to Flow!");
})().catch(console.error);
'
base64 -w 0 /tmp/flow_opt1_submitted.png
`;

  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_opt1_submitted.png', buf);
  console.log('Saved public/cast/flow_opt1_submitted.png:', buf.length, 'bytes');
}

main().catch(console.error);
