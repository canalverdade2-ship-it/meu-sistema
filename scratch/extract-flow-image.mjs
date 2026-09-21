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
  
  // Encontra todas as imagens geradas
  const imgs = await flowPage.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map(i => ({ src: i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight }));
  });
  console.log("Images found in Flow:", JSON.stringify(imgs, null, 2));
  
  // Clica na primeira imagem para abrir detalhes / download
  const targetImg = await flowPage.$("img[src*=\\"flow\\"], img[src*=\\"google\\"], img");
  if (targetImg) {
    const src = await flowPage.evaluate(el => el.src, targetImg);
    console.log("Target image src:", src);
  }
  
  await browser.disconnect();
})().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
