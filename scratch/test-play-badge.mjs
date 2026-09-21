import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/test-play-badge.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  const mediaUrls = [];
  page.on('response', res => {
    const u = res.url();
    if (u.includes('flow-content.google') || u.includes('.mp4') || u.includes('googlevideo') || u.includes('video')) {
      mediaUrls.push(u);
    }
  });

  // Click on the tile container or play badge
  console.log('Clicking mobile-play-badge...');
  await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('flow-video-tile'));
    const target = tiles.find(t => (t.innerText || '').includes('Chef smiling in television kitchen'));
    if (target) {
      const badge = target.querySelector('.mobile-play-badge') || target.querySelector('.thumbnail') || target;
      badge.click();
    }
  });

  await sleep(4000);

  // Check network requests captured
  console.log('Media URLs captured:', mediaUrls);

  // Check any video elements on page
  const videos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src,
      currentSrc: v.currentSrc
    }));
  });
  console.log('Video elements:', videos);

  await page.screenshot({ path: '/tmp/after-play-click.png' });
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/test-play-badge.cjs
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
