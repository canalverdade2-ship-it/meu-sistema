import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/gen-flow-presenter.cjs
const puppeteer = require(process.env.PUPPETEER_MODULE || '/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9228' });
  const pages = await b.pages();
  const page = pages.find(p => p.url().includes('flow.google.com')) || pages[0];
  console.log('Flow URL:', page.url());
  console.log('Flow Title:', await page.title());

  // 1. Check if there is an Add Media button to upload Chef Lorena Prado
  console.log('Looking for Add media menu or Start button...');
  const addBtn = await page.$('button[aria-label="Add media menu"]');
  if (addBtn) {
    console.log('Clicking Add media...');
    await addBtn.click();
    await sleep(1500);
    
    // Find Upload button in menu
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 10000 }).catch(() => null),
      page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.cdk-overlay-container [role="menuitem"], .cdk-overlay-container button'));
        const upload = items.find(i => (i.innerText || '').includes('Upload'));
        if (upload) upload.click();
        else console.log('Upload button not found in overlay');
      })
    ]);

    if (fileChooser) {
      console.log('Accepting file chooser with /home/opc/gsa-sabor.png...');
      await fileChooser.accept(['/home/opc/gsa-sabor.png']);
      await sleep(5000);
      console.log('File uploaded!');
    } else {
      console.log('No file chooser triggered directly from menu');
    }
  }

  // 2. Focus ProseMirror editor and enter prompt
  const editor = await page.$('div.ProseMirror');
  if (editor) {
    console.log('Focusing ProseMirror editor...');
    await editor.click();
    await sleep(500);
    // Clear editor
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(500);

    const promptText = "Chef Lorena Prado, confident charismatic female chef in immaculate white chef jacket, smiling warmly and welcoming viewers to GSA Sabor culinary show, modern bright gourmet television kitchen studio, shallow depth of field, 4k broadcast quality, smooth cinematic camera pan";
    console.log('Entering prompt:', promptText);
    const client = await page.target().createCDPSession();
    await client.send('Input.insertText', { text: promptText });
    await sleep(2000);

    // 3. Find Start generation button
    const genBtn = await page.$('button[aria-label="Start generation"]');
    if (genBtn) {
      const isDisabled = await page.evaluate(el => el.disabled, genBtn);
      console.log('Start generation button disabled?', isDisabled);
      if (!isDisabled) {
        console.log('Clicking Start generation...');
        await genBtn.click();
        await sleep(5000);
      } else {
        console.log('Button is disabled, pressing Enter in editor...');
        await editor.click();
        await page.keyboard.press('Enter');
        await sleep(5000);
      }
    }
  }

  await page.screenshot({ path: '/tmp/flow-after-generation-click.png' });
  console.log('Screenshot saved to /tmp/flow-after-generation-click.png');

  // Check new elements or tiles
  const tiles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="button"], button')).map(el => (el.innerText || '').slice(0, 40).trim()).filter(Boolean);
  });
  console.log('Top interactive tiles:', tiles.slice(0, 20));

  await b.disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
EOF
node /tmp/gen-flow-presenter.cjs
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
