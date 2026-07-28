import { expect, test } from '@playwright/test';
import { capturePageErrors, mockLocalSupabase } from './support/mockSupabase';

const PUBLIC_ROUTES = [
  '/',
  '/servicos-e-assinaturas',
  '/servicos-gratuitos',
  '/criacao-de-site-e-sistemas',
  '/empresa-do-zero-ao-digital',
  '/parceiros',
  '/anuncios',
  '/anuncie',
  '/afiliados',
  '/afiliados/login',
  '/trabalhe-conosco',
  '/trabalhe-conosco/acesso',
  '/login',
  '/login/pessoa-fisica',
  '/login/pessoa-fisica/recuperar-senha',
  '/login/empresa',
  '/login/empresa/cadastro',
  '/login/empresa/recuperar-senha',
  '/login/acesso-restrito',
  '/login/admin',
  '/login/colaborador',
  '/login/prestador',
  '/login/prestador/cadastro',
  '/prestador',
  '/fornecedor',
  '/fornecedor/login',
  '/marketplace',
  '/marketplace/loja',
  '/marketplace/loja/produtos',
  '/marketplace/loja/assinaturas',
] as const;

test.describe('Smoke seguro das rotas públicas e de acesso', () => {
  test.beforeEach(async ({ page }) => {
    await mockLocalSupabase(page);
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} renderiza sem erro fatal`, async ({ page }) => {
      const pageErrors = capturePageErrors(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
      await expect(page.getByText(/Erro inesperado|Falha inesperada/i).first()).toHaveCount(0);
      await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
      expect(pageErrors, `Erros não tratados em ${route}: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  }
});
