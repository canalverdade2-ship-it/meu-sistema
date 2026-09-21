import { runSshScript } from './ssh2-run.mjs';

const script = `
const puppeteer = require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const page = (await b.pages()).find(p => p.url().includes('flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554'));
  if (!page) throw new Error('page not found');

  const tiles = await page.$$('flow-grid-tile-container');
  const t0 = tiles[0];
  
  // Find more options button inside tile 0
  const moreBtn = await t0.$('button[aria-label="More options"], button[aria-label="Mais opções"]');
  if (!moreBtn) throw new Error('moreBtn not found');

  console.log('Clicking More options on tile 0...');
  await moreBtn.click();
  await sleep(1500);

  const menuItems = await page.evaluate(() => {
    return [...document.querySelectorAll('[role=menuitem], button.mat-mdc-menu-item, .mat-mdc-menu-content button')]
      .map(e => ({ text: (e.innerText || '').trim(), aria: e.getAttribute('aria-label') }));
  });

  console.log('Menu items for tile 0:\\n', JSON.stringify(menuItems, null, 2));
  await page.keyboard.press('Escape');
  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
