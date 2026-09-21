import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const info = await page.evaluate(() => {
    const containers = document.querySelectorAll('flow-grid-tile-container');
    const videos = document.querySelectorAll('video');
    return {
      containerCount: containers.length,
      videoCount: videos.length,
      firstFiveAria: [...containers].slice(0, 7).map((c, i) => ({
        idx: i,
        aria: c.getAttribute('aria-label'),
        playExists: !!c.querySelector('.pre-hover-overlay'),
        imgSrc: (c.querySelector('img.thumbnail')?.src || '').slice(0, 60)
      }))
    };
  });

  console.log('DOM info:\\n', JSON.stringify(info, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
