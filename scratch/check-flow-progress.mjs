import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];
  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    const progressEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const t = el.innerText || '';
      return t.includes('%') || t.includes('Generating') || t.includes('Chef Lorena') || t.includes('Queued');
    }).map(el => el.innerText.slice(0, 100));
    return {
      progressEls: Array.from(new Set(progressEls)).slice(0, 10),
      hasVideo: document.querySelectorAll('video').length,
      bodyExcerpt: text.slice(0, 800)
    };
  });
  console.log('Flow State:', JSON.stringify(state, null, 2));
  await page.screenshot({ path: '/tmp/flow-gen-progress.png' });
  await b.disconnect();
})().catch(e => console.error(e.message));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
