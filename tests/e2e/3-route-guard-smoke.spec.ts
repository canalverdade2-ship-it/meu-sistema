import { expect, test } from '@playwright/test';
import { capturePageErrors, mockLocalSupabase } from './support/mockSupabase';

type ProtectedRouteCase = {
  protectedRoute: string;
  expectedLoginPath: string;
};

const PROTECTED_ROUTES: ProtectedRouteCase[] = [
  { protectedRoute: '/cliente/dashboard', expectedLoginPath: '/login/pessoa-fisica' },
  { protectedRoute: '/cliente/financeiro/faturas', expectedLoginPath: '/login/pessoa-fisica' },
  { protectedRoute: '/empresa/dashboard', expectedLoginPath: '/login/empresa' },
  { protectedRoute: '/empresa/financeiro/faturas', expectedLoginPath: '/login/empresa' },
  { protectedRoute: '/admin/dashboard', expectedLoginPath: '/login/acesso-restrito' },
  { protectedRoute: '/admin/financeiro', expectedLoginPath: '/login/acesso-restrito' },
  { protectedRoute: '/prestador/dashboard', expectedLoginPath: '/login/prestador' },
  { protectedRoute: '/prestador/financeiro', expectedLoginPath: '/login/prestador' },
  { protectedRoute: '/fornecedor/dashboard', expectedLoginPath: '/fornecedor/login' },
  { protectedRoute: '/fornecedor/pedidos', expectedLoginPath: '/fornecedor/login' },
  { protectedRoute: '/anuncios/campanhas', expectedLoginPath: '/login' },
];

test.describe('Proteção das áreas autenticadas', () => {
  test.beforeEach(async ({ page }) => {
    await mockLocalSupabase(page);
  });

  for (const { protectedRoute, expectedLoginPath } of PROTECTED_ROUTES) {
    test(`${protectedRoute} exige autenticação e preserva retorno seguro`, async ({ page }) => {
      const pageErrors = capturePageErrors(page);

      await page.goto(protectedRoute, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe(expectedLoginPath);

      const finalUrl = new URL(page.url());
      expect(finalUrl.searchParams.get('returnTo')).toBe(protectedRoute);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Algo deu errado|Erro inesperado|Falha inesperada/i).first()).toHaveCount(0);
      expect(pageErrors, `Erros não tratados ao proteger ${protectedRoute}: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  }

  test('páginas públicas de prestador e fornecedor permanecem abertas sem sessão', async ({ page }) => {
    const pageErrors = capturePageErrors(page);

    for (const publicRoute of ['/prestador', '/fornecedor']) {
      await page.goto(publicRoute, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe(publicRoute);
      await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    }

    expect(pageErrors, `Erros não tratados nas páginas públicas por perfil: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
