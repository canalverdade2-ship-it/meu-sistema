import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  page.on('request', request => {
    if (request.method() !== 'OPTIONS' && request.url().includes('api.147')) {
      console.log(`-> ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('api.147-15-43-141.nip.io')) {
      console.log(`<- HTTP ${response.status()} on ${response.url()}`);
    }
  });
  
  console.log('Navigating to login...');
  await page.goto('http://localhost:3001/login/pessoa-fisica');
  
  console.log('Typing CPF...');
  await page.fill('input[name="documento"]', '44921139830');
  
  console.log('Clicking Continuar (CPF)...');
  await page.click('button:has-text("Continuar")');
  await page.waitForTimeout(1000);
  
  console.log('Typing PIN...');
  await page.keyboard.type('1111');
  
  console.log('Clicking Acessar...');
  await page.click('button:has-text("Acessar")');
  await page.waitForTimeout(3000);
  
  console.log('Navigating to store dashboard...');
  await page.goto('http://localhost:3001/marketplace/loja');
  await page.waitForTimeout(3000);
  
  console.log('Clicking ENTRAR NA LOJA...');
  const storeBtn = page.locator('button:has-text("ENTRAR NA LOJA")');
  if (await storeBtn.count() > 0) {
    await storeBtn.click();
    await page.waitForTimeout(3000);
  }
  
  console.log('Clicking an add to cart button on product card...');
  const addBtn = page.locator('button:has-text("Adicionar")').first();
  if (await addBtn.count() > 0) {
    await addBtn.click();
    console.log('Clicked Add to cart text button!');
    await page.waitForTimeout(4000); // wait for page transition
    
    console.log('Clicking confirm button in product page...');
    const confirmBtn = page.locator('button:has-text("Comprar Agora")');
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
      console.log('Clicked Comprar Agora!');
    } else {
      console.log('Could not find confirm button');
    }
  } else {
    console.log('Could not find add to cart button');
  }
  
  await page.waitForTimeout(4000);
  
  console.log('Testing if cart API was called... Check network logs above.');
  await browser.close();
})();
