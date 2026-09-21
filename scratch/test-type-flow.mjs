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
  
  const editor = await flowPage.$("div[contenteditable=\\"true\\"]");
  if (!editor) throw new Error("Editor div not found");
  
  await editor.click();
  await new Promise(r => setTimeout(r, 500));
  
  const promptText = "Logo 3D colorido e moderno para vinheta de TV Tá na Rede, fundo com explosao de icones de internet, curtidas e neon, letras 3D metalicas coloridas Ta na Rede, estilo televisao jovem pop, alta resolucao 16:9";
  await flowPage.keyboard.type(promptText, { delay: 10 });
  await new Promise(r => setTimeout(r, 1000));
  
  // Encontra o botão de enviar (seta à direita)
  const buttons = await flowPage.$$("button");
  console.log("Total buttons:", buttons.length);
  
  // O botão de envio geralmente é o último ou tem ícone de seta
  for (const b of buttons) {
    const text = await flowPage.evaluate(el => el.innerText || el.innerHTML, b);
    if (text.includes("arrow_forward") || text.includes("Criar") || text.includes("send")) {
      console.log("Clicking submit button:", text);
      await b.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 3000));
  await flowPage.screenshot({ path: "/tmp/flow_typed.png" });
  await browser.disconnect();
  console.log("Done typing in Flow!");
})().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
