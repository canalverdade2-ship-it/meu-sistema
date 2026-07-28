import { expect, test, type Page } from '@playwright/test';

type ProductionActorType = 'admin' | 'provider' | 'supplier';

const productionUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const actorType = process.env.PRODUCTION_ACTOR_TYPE?.trim() as ProductionActorType | undefined;
const actorDocument = (process.env.PRODUCTION_ACTOR_DOCUMENT || '').replace(/\D/g, '');
const actorPin = (process.env.PRODUCTION_ACTOR_PIN || '').replace(/\D/g, '');
const adminCode = process.env.PRODUCTION_ADMIN_CODE?.trim() || '';

const ROUTES_BY_ACTOR: Record<ProductionActorType, readonly string[]> = {
  admin: ['/admin/dashboard', '/admin/financeiro', '/admin/relatorios'],
  provider: ['/prestador/dashboard', '/prestador/demandas', '/prestador/financeiro'],
  supplier: ['/fornecedor/dashboard', '/fornecedor/produtos', '/fornecedor/pedidos'],
};

function requireConfiguration(): ProductionActorType {
  if (!productionUrl) throw new Error('PLAYWRIGHT_BASE_URL não configurada.');
  if (new URL(productionUrl).protocol !== 'https:') throw new Error('A validação autenticada exige URL HTTPS.');
  if (!actorType || !['admin', 'provider', 'supplier'].includes(actorType)) {
    throw new Error('PRODUCTION_ACTOR_TYPE deve ser admin, provider ou supplier.');
  }

  if (actorType === 'admin') {
    if (!adminCode) throw new Error('PRODUCTION_ADMIN_CODE não configurado.');
  } else {
    if (![11, 14].includes(actorDocument.length)) {
      throw new Error('PRODUCTION_ACTOR_DOCUMENT deve conter CPF ou CNPJ válido para o perfil.');
    }
    if (actorPin.length !== 4) throw new Error('PRODUCTION_ACTOR_PIN deve conter quatro dígitos.');
  }

  return actorType;
}

async function fillFourDigitPin(page: Page, pin: string): Promise<void> {
  const inputs = page.locator('input[type="password"][inputmode="numeric"]');
  await expect.poll(async () => inputs.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  for (let index = 0; index < 4; index += 1) {
    await inputs.nth(index).fill(pin.charAt(index));
  }
}

async function assertHealthyRoute(page: Page, route: string): Promise<void> {
  await page.goto(new URL(route, productionUrl).toString(), { waitUntil: 'domcontentloaded' });
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(route);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Algo deu errado|Erro inesperado|Falha inesperada/i).first()).toHaveCount(0);
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/login/admin', { waitUntil: 'domcontentloaded' });
  const codeInput = page.locator('input[name="access-code"]');
  await expect(codeInput).toBeVisible({ timeout: 20_000 });
  await codeInput.fill(adminCode);
  await page.getByRole('button', { name: /Entrar na gestão/i }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toMatch(/^\/admin(?:\/|$)/);
}

async function loginProvider(page: Page): Promise<void> {
  await page.goto('/login/prestador', { waitUntil: 'domcontentloaded' });
  const documentInput = page.locator('input[name="provider-document"]');
  await expect(documentInput).toBeVisible({ timeout: 20_000 });
  await documentInput.fill(actorDocument);
  await page.getByRole('button', { name: /^Continuar$/i }).click();
  await fillFourDigitPin(page, actorPin);
  const accessButton = page.getByRole('button', { name: /Acessar Área do Prestador/i });
  await expect(accessButton).toBeEnabled({ timeout: 10_000 });
  await accessButton.click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe('/prestador/dashboard');
}

async function loginSupplier(page: Page): Promise<void> {
  await page.goto('/fornecedor/login', { waitUntil: 'domcontentloaded' });
  const documentInput = page.locator('input[placeholder="Documento cadastrado"]');
  await expect(documentInput).toBeVisible({ timeout: 20_000 });
  await documentInput.fill(actorDocument);
  await page.getByRole('button', { name: /^Continuar$/i }).click();
  await fillFourDigitPin(page, actorPin);
  const accessButton = page.getByRole('button', { name: /Acessar portal/i });
  await expect(accessButton).toBeEnabled({ timeout: 10_000 });
  await accessButton.click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe('/fornecedor/dashboard');
}

test.describe('Smoke autenticado por perfil operacional', () => {
  const configuredActor = requireConfiguration();

  test(`${configuredActor} autentica e percorre módulos autorizados`, async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    if (configuredActor === 'admin') await loginAdmin(page);
    if (configuredActor === 'provider') await loginProvider(page);
    if (configuredActor === 'supplier') await loginSupplier(page);

    for (const route of ROUTES_BY_ACTOR[configuredActor]) {
      await assertHealthyRoute(page, route);
    }

    expect(pageErrors, `Erros não tratados no navegador: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
