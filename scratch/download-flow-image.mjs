import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  
  const imgUrl = "https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=181ebd19-010c-46f8-91e0-82f9bceb7c7c";
  
  // Faz fetch autenticado dentro da página
  const base64Data = await flowPage.evaluate(async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }, imgUrl);
  
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync("/opt/gsa-tv/cache/media/1/identity/vinhetas/ta_na_rede_flow_master.png", buffer);
  console.log("Salvo com sucesso: /opt/gsa-tv/cache/media/1/identity/vinhetas/ta_na_rede_flow_master.png -", buffer.length, "bytes");
  
  await browser.disconnect();
})().catch(console.error);
'
ls -lh /opt/gsa-tv/cache/media/1/identity/vinhetas/ta_na_rede_flow_master.png
base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/ta_na_rede_flow_master.png
`;
  const res = await runSshScript(script);
  const lines = res.stdout.trim().split('\n');
  const base64 = lines.pop();
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync('public/cast/ta_na_rede_flow_master.png', buf);
  console.log('Saved public/cast/ta_na_rede_flow_master.png locally:', buf.length, 'bytes');
}

main().catch(console.error);
