import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('challenge'));
  if (!page) throw new Error('not found');

  const visible = await page.evaluate(() => {
    function isVisible(el) {
      if (!el.offsetParent && el.tagName !== 'BODY') return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
    const all = [...document.querySelectorAll('*')];
    return all.filter(e => e.children.length === 0 && (e.innerText || '').trim() && isVisible(e))
              .map(e => ({ tag: e.tagName, text: (e.innerText || '').trim(), id: e.id, class: e.className }));
  });

  console.log('Strictly visible elements:\\n', JSON.stringify(visible, null, 2));
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
