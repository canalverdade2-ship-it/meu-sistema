import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001/marketplace/loja');
  await page.waitForTimeout(3000);
  
  const buttons = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()).filter(t => t.length > 0));
  console.log('Buttons:', buttons);
  
  await browser.close();
})();
