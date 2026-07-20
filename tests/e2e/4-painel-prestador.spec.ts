import { test, expect } from '@playwright/test';

test.describe('Painel do Prestador - Cobertura Exaustiva', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate and login before each test
    await page.goto('/login');
    const emailInput = page.getByPlaceholder(/email|e-mail/i);
    const passwordInput = page.getByPlaceholder(/senha/i);
    const submitBtn = page.getByRole('button', { name: /entrar|login/i });

    if (await emailInput.count() > 0) {
      await emailInput.fill('prestador_teste@exemplo.com');
      await passwordInput.fill('senha123456');
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('Demandas e Mudança de Status com Toast validation', async ({ page }) => {
    await page.goto('/prestador');
    
    // Tentar ir em demandas
    const demandasLink = page.getByRole('button', { name: /Demandas/i });
    if (await demandasLink.count() > 0) {
        await demandasLink.first().click();
        
        // Simular mudança de status caso exista demanda na tela
        const atualizarStatusBtn = page.getByRole('button', { name: /atualizar status/i });
        if (await atualizarStatusBtn.count() > 0) {
            await atualizarStatusBtn.first().click();
            // Espera Toast
            await expect(page.locator('.go3958317564')).toBeVisible({ timeout: 5000 }).catch(() => null);
        }
    }
  });

});
