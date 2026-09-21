import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('--- Checking /login ---');
  await page.goto('http://localhost:3000/login');
  const emailInputs = await page.getByPlaceholder(/email|e-mail/i).count();
  const docInputs = await page.locator('input[name="documento"], input[id^="login-document-"], input[placeholder="000.000.000-00"]').count();
  console.log('emailInputs on /login:', emailInputs);
  console.log('docInputs on /login:', docInputs);

  console.log('--- Checking /cliente (unauthenticated) ---');
  await page.goto('http://localhost:3000/cliente');
  const currentUrlClient = page.url();
  console.log('URL after /cliente:', currentUrlClient);
  const storeLink = await page.getByRole('button', { name: /GSA Store Hub|Loja/i }).count();
  const financeiroLink = await page.getByRole('button', { name: /Financeiro/i }).count();
  const fidelidadeLink = await page.getByRole('button', { name: /Fidelidade|Meus Pontos/i }).count();
  console.log('storeLink count:', storeLink);
  console.log('financeiroLink count:', financeiroLink);
  console.log('fidelidadeLink count:', fidelidadeLink);

  console.log('--- Checking /admin (unauthenticated) ---');
  await page.goto('http://localhost:3000/admin');
  const currentUrlAdmin = page.url();
  console.log('URL after /admin:', currentUrlAdmin);
  const lojaMenu = await page.getByText(/Loja GSA Store/i).count();
  const configMenu = await page.getByText(/Configurações|Acessos/i).count();
  console.log('lojaMenu count:', lojaMenu);
  console.log('configMenu count:', configMenu);

  console.log('--- Checking /prestador (unauthenticated) ---');
  await page.goto('http://localhost:3000/prestador');
  const currentUrlPrestador = page.url();
  console.log('URL after /prestador:', currentUrlPrestador);
  const demandasLink = await page.getByRole('button', { name: /Demandas/i }).count();
  console.log('demandasLink count:', demandasLink);

  await browser.close();
}

main().catch(console.error);
