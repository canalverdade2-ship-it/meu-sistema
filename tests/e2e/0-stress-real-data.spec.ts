import { test, expect, type Page } from '@playwright/test';
import { generateTestCPF } from '../utils/cpf-generator';

const REAL_DATA_STRESS_ENABLED = process.env.ALLOW_REAL_DATA_STRESS_TEST === 'true';

const AGENTE_CONFIG = [
  { agente: 1, phone: '11988880001', phoneMasked: '(11) 98888-0001' },
  { agente: 2, phone: '11988880002', phoneMasked: '(11) 98888-0002' },
  { agente: 3, phone: '11988880003', phoneMasked: '(11) 98888-0003' },
];

async function openClientAccess(page: Page) {
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-client-login')));
    await expect(page.locator('dialog, [role="dialog"]').first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

async function fillRegistrationForm(page: Page, user: { cpf: string; name: string; email: string; phone: string }) {
  const dialog = page.locator('dialog, [role="dialog"]').first();
  const textInputs = dialog.locator('input[type="text"]');

  const cpfInput = dialog.locator('input[placeholder="000.000.000-00"]').first();
  await expect(cpfInput).toBeVisible({ timeout: 25_000 });
  await cpfInput.fill(user.cpf);

  await expect(textInputs.nth(1)).toBeVisible();
  await textInputs.nth(1).fill(user.name);

  const emailInput = dialog.locator('input[type="email"]').first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill(user.email);

  await expect(textInputs.nth(2)).toBeVisible();
  await textInputs.nth(2).fill(user.phone);

  const cepInput = dialog.locator('input[placeholder="00000-000"]').first();
  if (await cepInput.count()) {
    await cepInput.fill('01001000');
    await expect.poll(async () => cepInput.inputValue(), { timeout: 8_000 }).toBe('01001-000');

    const addressInputs = dialog.locator('input[type="text"]');
    const address = await addressInputs.nth(3).inputValue().catch(() => '');
    if (!address) {
      await addressInputs.nth(3).fill('Praça da Sé').catch(() => undefined);
      await addressInputs.nth(4).fill('Sé').catch(() => undefined);
      const stateInput = dialog.locator('input[maxlength="2"]').first();
      if (await stateInput.count()) await stateInput.fill('SP');
      await addressInputs.nth(6).fill('São Paulo').catch(() => undefined);
    }
  }

  const numberInput = dialog.getByPlaceholder(/^N/i).first();
  if (await numberInput.count()) await numberInput.fill('123');
}

test.describe('Testes massivos reais de sistema', () => {
  test.skip(!REAL_DATA_STRESS_ENABLED, 'Teste com gravação real exige ALLOW_REAL_DATA_STRESS_TEST=true.');

  for (const cfg of AGENTE_CONFIG) {
    test(`Agente ${cfg.agente}: cadastro, login e acesso ao portal`, async ({ page }, testInfo) => {
      test.setTimeout(180_000);

      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const cpf = generateTestCPF();
      const user = {
        cpf,
        name: `Agente Teste ${cfg.agente}`,
        email: `agente${cfg.agente}_${Date.now()}@gsateste.com`,
        phone: cfg.phone,
      };

      try {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await openClientAccess(page);

        const createAccount = page.getByRole('button', { name: 'Criar Conta' }).first();
        await expect(createAccount).toBeVisible();
        await createAccount.click();

        const dialog = page.locator('dialog, [role="dialog"]').first();
        const referralInput = dialog.locator('input[type="text"]').first();
        await expect(referralInput).toBeVisible({ timeout: 10_000 });
        await referralInput.fill(cfg.phoneMasked);

        const releaseButton = page.getByRole('button', { name: /Liberar Cadastro/i }).first();
        await expect(releaseButton).toBeVisible();
        await releaseButton.click();

        const confirmButton = page.getByRole('button', { name: /Sim.*Confirmar|Confirmar/i }).first();
        await expect(confirmButton).toBeVisible({ timeout: 20_000 });
        await confirmButton.click();

        await fillRegistrationForm(page, user);

        const submitButton = page.getByRole('button', { name: /Finalizar Cadastro/i }).first();
        await expect(submitButton).toBeEnabled({ timeout: 10_000 });
        await submitButton.click();

        const success = page.locator(
          'dialog :text-matches("área do cliente|area do cliente", "i"), [role="dialog"] :text-matches("área do cliente|area do cliente", "i"), :text-matches("Cadastro enviado|Cadastro realizado", "i")',
        ).first();
        await expect(success).toBeVisible({ timeout: 30_000 });

        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await openClientAccess(page);

        const loginDocument = page.locator(
          'dialog input[placeholder="000.000.000-00"], [role="dialog"] input[placeholder="000.000.000-00"]',
        ).first();
        await expect(loginDocument).toBeVisible();
        await loginDocument.fill(cpf);

        const continueButton = page.getByRole('button', { name: /Continuar/i }).first();
        await expect(continueButton).toBeEnabled();
        await continueButton.click();

        const pinStep = page.getByText(/Criar Senha|Crie sua Senha/i).first();
        if (await pinStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
          const pinBoxes = page.locator('input[type="password"]');
          const pinCount = await pinBoxes.count();
          expect(pinCount, 'A etapa de criação de PIN deve apresentar ao menos quatro campos').toBeGreaterThanOrEqual(4);
          for (let index = 0; index < Math.min(pinCount, 8); index += 1) {
            await pinBoxes.nth(index).fill('1');
          }

          const phoneConfirmation = page.locator('input[type="tel"]').first();
          if (await phoneConfirmation.count()) await phoneConfirmation.fill(cfg.phone);

          const finishButton = page.getByRole('button', { name: /Entrar|Acessar|Confirmar/i }).first();
          await expect(finishButton).toBeEnabled();
          await finishButton.click();
        }

        const portalMarker = page.getByText(/Meus Atendimentos|Minha Conta|Bem-vindo/i).first();
        await expect(portalMarker).toBeVisible({ timeout: 30_000 });
        expect(pageErrors, `Erros não tratados no navegador: ${pageErrors.join(' | ')}`).toEqual([]);
      } catch (error) {
        await page.screenshot({ path: testInfo.outputPath(`agente-${cfg.agente}-falha.png`), fullPage: true });
        throw error;
      }
    });
  }
});
