import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/anuncios',
  '/empresa-do-zero-ao-digital',
  '/anunciante',
  '/fornecedor',
  '/fornecedor/login',
];

test.describe('Smoke seguro das rotas públicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://127.0.0.1:54321/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/functions/v1/gsa-ad-delivery')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, ad: null }),
        });
        return;
      }
      if (url.includes('/auth/v1/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: null, session: null }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: url.includes('/rpc/') ? JSON.stringify({}) : JSON.stringify([]),
      });
    });
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} renderiza sem erro fatal`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
      await expect(page.locator('main, #root').first()).toBeVisible({ timeout: 15_000 });
      expect(pageErrors, `Erros não tratados em ${route}: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  }
});
