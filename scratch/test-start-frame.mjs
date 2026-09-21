import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/test-start-frame.cjs
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const startBtn = await page.$('button.empty-chip');
  if (startBtn) {
    console.log('Clicking Start frame chip...');
    await startBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    const overlayContent = await page.evaluate(() => {
      const overlays = document.querySelectorAll('.cdk-overlay-container');
      return Array.from(overlays).map(o => o.innerText);
    });
    console.log('Start frame overlay:', overlayContent);
    await page.screenshot({ path: '/tmp/start-frame-overlay.png' });
  }
  await b.disconnect();
})().catch(e => console.error(e.message));
EOF
node /tmp/test-start-frame.cjs
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
