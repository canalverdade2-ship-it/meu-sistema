import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/download-chef-video.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  // Intercept network requests to catch .mp4 or googlevideo URLs
  const videoUrls = [];
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('.mp4') || url.includes('video') || url.includes('googlevideo') || url.includes('blob:')) {
      videoUrls.push(url);
    }
  });

  // Find the tile with "Chef smiling in television kitchen"
  console.log('Finding tile "Chef smiling in television kitchen"...');
  const clicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const tile = els.find(e => (e.innerText || '').includes('Chef smiling in television kitchen') && e.children.length < 5);
    if (tile) {
      tile.click();
      return true;
    }
    return false;
  });
  console.log('Clicked tile:', clicked);
  await sleep(3000);

  // Take screenshot of preview modal
  await page.screenshot({ path: '/tmp/chef-preview-modal.png' });

  // Look for video element
  const videoDetails = await page.evaluate(() => {
    const vids = Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src,
      currentSrc: v.currentSrc,
      duration: v.duration
    }));
    const buttons = Array.from(document.querySelectorAll('button, a')).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      href: b.href,
      text: (b.innerText || '').slice(0, 30)
    })).filter(b => (b.ariaLabel || '').toLowerCase().includes('download') || (b.title || '').toLowerCase().includes('download') || (b.text || '').toLowerCase().includes('download') || (b.href || '').includes('.mp4'));
    return { vids, buttons };
  });

  console.log('Video details:', JSON.stringify(videoDetails, null, 2));

  // If there is a download button, click it
  const dlBtn = await page.$('button[aria-label*="Download"], button[title*="Download"], [aria-label*="download"]');
  if (dlBtn) {
    console.log('Found download button! Setting download behavior...');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: '/tmp/flow-downloads'
    });
    fs.mkdirSync('/tmp/flow-downloads', { recursive: true });
    await dlBtn.click();
    console.log('Clicked download button, waiting for file...');
    await sleep(8000);
    const files = fs.readdirSync('/tmp/flow-downloads');
    console.log('Files in /tmp/flow-downloads:', files);
  }

  // If video src is a direct URL, also try downloading directly
  if (videoDetails.vids.length > 0 && videoDetails.vids[0].currentSrc) {
    const src = videoDetails.vids[0].currentSrc;
    console.log('Video source URL:', src);
    if (src.startsWith('http')) {
      const curlCmd = 'curl -s -L -o /tmp/chef-lorena-flow.mp4 "' + src + '"';
      console.log('Downloading via curl...');
      require('child_process').execSync(curlCmd);
      console.log('Downloaded /tmp/chef-lorena-flow.mp4, size:', fs.statSync('/tmp/chef-lorena-flow.mp4').size);
    } else if (src.startsWith('blob:')) {
      console.log('Video is a blob URL, extracting via fetch in page context...');
      const b64 = await page.evaluate(async (blobUrl) => {
        const res = await fetch(blobUrl);
        const buf = await res.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }, src);
      fs.writeFileSync('/tmp/chef-lorena-flow.mp4', Buffer.from(b64, 'base64'));
      console.log('Saved blob to /tmp/chef-lorena-flow.mp4, size:', fs.statSync('/tmp/chef-lorena-flow.mp4').size);
    }
  }

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/download-chef-video.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
