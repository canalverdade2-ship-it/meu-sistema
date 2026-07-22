import { expect, test, type Page } from '@playwright/test';

const productionUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const productionCpf = (process.env.PRODUCTION_CLIENT_CPF || '').replace(/\D/g, '');
const productionPin = (process.env.PRODUCTION_CLIENT_PIN || '').replace(/\D/g, '');

function requireProductionConfiguration() {
  if (!productionUrl) throw new Error('PLAYWRIGHT_BASE_URL não configurada.');
  const parsedUrl = new URL(productionUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('O smoke autenticado de produção exige URL HTTPS.');
  if (productionCpf.length !== 11) throw new Error('PRODUCTION_CLIENT_CPF deve conter 11 dígitos.');
  if (productionPin.length < 4 || productionPin.length > 8) {
    throw new Error('PRODUCTION_CLIENT_PIN deve conter entre 4 e 8 dígitos.');
  }
}

async function openClientLogin(page: Page) {
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-client-login')));
    await expect(page.locator('dialog, [role="dialog"]').first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe('Smoke autenticado de produção', () => {
  test.beforeAll(() => requireProductionConfiguration());

  test('cliente existente entra no portal sem erro de aplicação', async ({ page }) => {
    test.setTimeout(90_000);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await openClientLogin(page);

    const dialog = page.locator('dialog, [role="dialog"]').first();
    const cpfInput = dialog.locator('input[placeholder="000.000.000-00"]').first();
    await expect(cpfInput).toBeVisible({ timeout: 20_000 });
    await cpfInput.fill(productionCpf);

    const continueButton = dialog.getByRole('button', { name: /Continuar/i }).first();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const pinInputs = dialog.locator('input[type="password"]');
    await expect.poll(async () => pinInputs.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    const pinInputCount = await pinInputs.count();

    if (pinInputCount === 1) {
      await pinInputs.first().fill(productionPin);
    } else {
      expect(pinInputCount, 'Quantidade de campos do PIN incompatível com o secret configurado.').toBeGreaterThanOrEqual(
        productionPin.length,
      );
      for (let index = 0; index < productionPin.length; index += 1) {
        await pinInputs.nth(index).fill(productionPin[index]);
      }
    }

    const enterButton = dialog.getByRole('button', { name: /Entrar|Acessar|Confirmar|Continuar/i }).last();
    await expect(enterButton).toBeEnabled({ timeout: 10_000 });
    await enterButton.click();

    const portalMarker = page.getByText(/Meus Atendimentos|Minha Conta|Bem-vindo|Área do Cliente/i).first();
    await expect(portalMarker).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Algo deu errado|Erro inesperado|Falha inesperada/i).first()).toHaveCount(0);
    expect(pageErrors, `Erros não tratados no navegador: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
