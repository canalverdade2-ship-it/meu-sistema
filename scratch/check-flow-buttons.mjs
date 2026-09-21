import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");
(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  
  const res = await flowPage.evaluate(() => {
    const editor = document.querySelector("div[contenteditable=\\"true\\"]");
    const container = editor ? editor.closest("div[class*=\\"sc-\\"]") : null;
    const btns = Array.from(document.querySelectorAll("button")).map(b => {
      const r = b.getBoundingClientRect();
      return { text: b.innerText, aria: b.getAttribute("aria-label"), x: r.x, y: r.y, w: r.width, h: r.height, disabled: b.disabled };
    });
    return { btns, editorText: editor ? editor.innerText : null };
  });
  console.log(JSON.stringify(res, null, 2));
  await browser.disconnect();
})().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
