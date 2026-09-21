import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
await page.goto(new URL('../public/logo.svg', import.meta.url).href);
await page.screenshot({ path: fileURLToPath(new URL('./gsa-tv-logo-transparent.png', import.meta.url)), omitBackground: true });
await browser.close();
