import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");

const prompt = "A vibrant and energetic 3D motion graphics broadcast opening title sequence for a Brazilian television show called GSA Ta na Rede. Floating 3D golden and glowing neon social media icons, smartphone holograms, dynamic streaming waves, exploding golden particles and cyber digital network lines converging into a central metallic golden logo emblem. High energy, prime-time television ident, 16:9, cinematic broadcast lighting, premium 4k render, no text errors.";

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  if (!flowPage) throw new Error("Flow page not found");
  
  await flowPage.bringToFront();
  
  // Encontra o campo de texto
  const box = await flowPage.$("[role=\\"textbox\\"][data-slate-editor=\\"true\\"], textarea, input[type=\\"text\\"], [contenteditable=\\"true\\"]");
  if (!box) throw new Error("Input box not found");
  
  await box.click();
  await flowPage.keyboard.down("Control");
  await flowPage.keyboard.press("A");
  await flowPage.keyboard.up("Control");
  await flowPage.keyboard.press("Backspace");
  
  await flowPage.keyboard.type(prompt, { delay: 5 });
  await new Promise(r => setTimeout(r, 1000));
  
  // Encontra o botão de envio
  const sendBtn = await flowPage.$("button:has(i), button:has(span), button[aria-label*=\\"Criar\\"], button[aria-label*=\\"Enviar\\"]");
  console.log("Send button found, clicking...");
  
  // Pressiona Enter ou clica no botão criar
  await flowPage.keyboard.press("Enter");
  await new Promise(r => setTimeout(r, 3000));
  
  await flowPage.screenshot({ path: "/tmp/flow_after_submit.png" });
  console.log("Submitted prompt to Google Flow!");
  await browser.disconnect();
})().catch(console.error);
'
base64 -w 0 /tmp/flow_after_submit.png
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
