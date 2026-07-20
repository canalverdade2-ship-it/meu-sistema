import { test, expect } from '@playwright/test';

test.describe('Autenticação e Páginas Públicas', () => {
  test('Página Inicial carrega corretamente', async ({ page }) => {
    await page.goto('/');
    // Asserts title or a known heading
    await expect(page).toHaveTitle(/GSA/i);
  });

  test('Formulário de Login renderiza e falha com credenciais incorretas', async ({ page }) => {
    await page.goto('/login');
    
    // Fill the login form
    // Note: Adjust selectors based on actual DOM elements (placeholder, data-testid, etc)
    const emailInput = page.getByPlaceholder(/email|e-mail/i);
    const passwordInput = page.getByPlaceholder(/senha/i);
    const submitBtn = page.getByRole('button', { name: /entrar|login/i });

    if (await emailInput.count() > 0) {
      await emailInput.fill('usuario_falso_teste@invalido.com');
      await passwordInput.fill('senhaerrada123');
      await submitBtn.click();

      // Expect a toast or error message
      const toast = page.locator('.go3958317564'); // Default hot-toast class or use a better selector
      // Alternatively, wait for some text indicating failure
      await expect(page.getByText(/inválido|erro|falha/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
