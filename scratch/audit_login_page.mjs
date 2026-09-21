import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  const bodyText = await page.innerText('body');
  console.log('--- Body text on /login ---');
  console.log(bodyText.slice(0, 1000));
  await browser.close();
}

main().catch(console.error);
