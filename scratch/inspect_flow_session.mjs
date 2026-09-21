import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  console.log('Total pages:', pages.length);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const url = p.url();
    const title = await p.title().catch(() => '');
    console.log(\`[\${i}] \${title} -> \${url}\`);
  }
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
