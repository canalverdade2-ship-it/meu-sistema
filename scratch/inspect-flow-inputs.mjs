import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
node -e '
const puppeteer = require("/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer");
(async () => {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9228" });
  const pages = await browser.pages();
  const flowPage = pages.find(p => p.url().includes("labs.google/fx") && p.url().includes("/flow/"));
  
  const inputs = await flowPage.evaluate(() => {
    return Array.from(document.querySelectorAll("input, textarea, [contenteditable]")).map(el => ({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      contentEditable: el.isContentEditable,
      className: el.className,
      rect: el.getBoundingClientRect()
    }));
  });
  console.log("Inputs found:", JSON.stringify(inputs, null, 2));
  await browser.disconnect();
})().catch(console.error);
'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
