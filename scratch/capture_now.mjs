import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const p = (await b.pages())[0];
  await p.screenshot({ path: '/home/opc/gsa-ai/current_screen.png' });
  await b.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
const b64 = await runSshScript(`base64 /home/opc/gsa-ai/current_screen.png`, 20000);
fs.writeFileSync('./scratch/current_screen.png', Buffer.from(b64.stdout.trim(), 'base64'));
console.log('Saved ./scratch/current_screen.png');
