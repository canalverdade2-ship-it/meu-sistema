import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/inspect-flow-tile-data.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages())[0];

  const data = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('flow-video-tile'));
    const target = tiles.find(t => (t.innerText || '').includes('Chef smiling in television kitchen'));
    if (!target) return 'target not found';

    // Check all img, video, source, a elements inside target
    const media = Array.from(target.querySelectorAll('img, video, source, a')).map(m => ({
      tag: m.tagName,
      src: m.src,
      currentSrc: m.currentSrc,
      href: m.href
    }));

    // Check Angular component properties
    const ng = window.ng;
    let componentProps = {};
    if (ng && ng.getComponent) {
      const comp = ng.getComponent(target);
      if (comp) {
        componentProps = Object.keys(comp);
      }
    }

    return {
      media,
      componentProps,
      attributes: Array.from(target.attributes).map(a => ({ name: a.name, value: a.value.slice(0, 100) })),
      outerHTML: target.outerHTML.slice(0, 1000)
    };
  });

  console.log(JSON.stringify(data, null, 2));
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/inspect-flow-tile-data.cjs
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
