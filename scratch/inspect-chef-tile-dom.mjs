import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const info = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const textEl = els.find(e => (e.innerText || '').includes('Chef smiling in television kitchen') && e.children.length === 0);
    if (!textEl) return 'textEl not found';

    let parent = textEl.parentElement;
    const hierarchy = [];
    for (let i = 0; i < 6 && parent; i++) {
      hierarchy.push({
        tag: parent.tagName,
        className: parent.className,
        buttons: Array.from(parent.querySelectorAll('button')).map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.innerText
        }))
      });
      parent = parent.parentElement;
    }
    return hierarchy;
  });
  console.log(JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
