import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const info = await page.evaluate(() => {
    const video = document.querySelector('video');
    const dialog = document.querySelector('[role=dialog], flow-video-dialog, .overlay-container');
    const btns = [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.innerText).filter(Boolean);
    return {
      hasVideo: !!video,
      videoSrc: video ? (video.currentSrc || video.src) : null,
      hasDialog: !!dialog,
      dialogHtml: dialog ? dialog.outerHTML.slice(0, 500) : null,
      recentBtns: btns.slice(0, 15)
    };
  });

  console.log('Page state:\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
