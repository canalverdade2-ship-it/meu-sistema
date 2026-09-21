import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/wait-flow-video.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  console.log('Starting polling for Chef Lorena Prado video generation...');
  let completed = false;
  let videoUrl = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const status = await page.evaluate(() => {
      const text = document.body.innerText;
      const m = text.match(/(\\d+)%\\s*\\n\\s*Chef Lorena/i);
      const pct = m ? m[1] : null;
      const videos = Array.from(document.querySelectorAll('video')).map(v => v.src);
      return {
        pct,
        videos,
        hasLorenaInText: text.includes('Chef Lorena')
      };
    });

    console.log('[Attempt ' + (attempt + 1) + '/60] Status: ' + (status.pct ? status.pct + '%' : 'Processing') + ' | Videos on page: ' + status.videos.length);

    if (!status.pct && attempt > 1) {
      console.log('Generation completed or percentage gone! Inspecting tiles...');
      await sleep(2000);
      
      const clicked = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[role="button"], button, div'));
        const lorenaTile = tiles.find(el => (el.innerText || '').includes('Chef Lorena') && (el.innerText || '').length < 300);
        if (lorenaTile) {
          lorenaTile.click();
          return true;
        }
        return false;
      });
      console.log('Clicked tile?', clicked);
      await sleep(3000);

      const videoSrc = await page.evaluate(() => {
        const vids = Array.from(document.querySelectorAll('video')).map(v => v.src).filter(Boolean);
        const links = Array.from(document.querySelectorAll('a[download], a[href*=".mp4"], [aria-label*="Download"], button[aria-label*="download"]')).map(a => a.href || a.getAttribute('aria-label'));
        return { vids, links };
      });
      console.log('Detected video sources:', JSON.stringify(videoSrc, null, 2));

      if (videoSrc.vids && videoSrc.vids.length > 0) {
        videoUrl = videoSrc.vids[0];
        completed = true;
        break;
      }
    }

    await sleep(5000);
  }

  await page.screenshot({ path: '/tmp/flow-gen-result.png' });
  console.log('Saved screenshot to /tmp/flow-gen-result.png');
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/wait-flow-video.cjs
`;

const res = await runSshScript(remoteScript, 300000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
