import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/test-add-menu.cjs
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const addBtn = await page.$('button[aria-label="Add media menu"]');
  if (addBtn) {
    console.log('Clicking Add media menu...');
    await addBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    const overlayItems = await page.evaluate(() => {
      const overlays = document.querySelectorAll('.cdk-overlay-container, [role="menu"], [role="listbox"]');
      return Array.from(overlays).map(o => o.innerText);
    });
    console.log('Overlay content:', overlayItems);
  }
  await b.disconnect();
})().catch(e => console.error(e.message));
EOF
node /tmp/test-add-menu.cjs
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
