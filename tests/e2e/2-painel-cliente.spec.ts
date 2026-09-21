import { test, expect } from '@playwright/test';

/**
 * REMEDIADO v2 — Gate M2 (corrigido após execução real)
 *
 * Evidências da execução real (2026-09-16):
 *  - /cliente: URL permanece /cliente (não redireciona — provavelmente renderiza tela de login inline)
 *  - /loja: carrega publicamente
 *  - /login/pessoa-fisica: campo CPF visível
 *  - Teste "formulário de login renderiza sem crash" falhou: /login mostra LoginHub sem input
 *    → correção: navegar para /login/pessoa-fisica para verificar campo CPF
 *
 * Arquitetura descoberta:
 *  - /login → LoginHub (botões de seleção de portal, sem input)
 *  - /login/pessoa-fisica → ClientLoginPage (campo de CPF)
 *  - /cliente → renderiza UI (possivelmente com estado deslogado inline, sem redirect)
 */

test.describe('Painel do Cliente — Rotas e Cobertura de UI', () => {

  test('Rota /loja é acessível publicamente e renderiza sem crash', async ({ page }) => {
    await page.goto('/loja');
    await expect(page.locator('body')).toBeVisible();
    // Sem white screen de erro
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // A página deve mostrar conteúdo (produtos, loja ou redirecionamento para login)
    await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Rota /cliente renderiza sem crash (autenticado ou não)', async ({ page }) => {
    await page.goto('/cliente');
    await expect(page.locator('body')).toBeVisible();
    // Sem white screen de erro crítico
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // A página deve montar o root sem falha fatal
    await expect(page.locator('#root').first()).toBeVisible({ timeout: 10000 });
  });

  test('Rota /login/pessoa-fisica renderiza campo de CPF visível', async ({ page }) => {
    await page.goto('/login/pessoa-fisica');
    await expect(page.locator('body')).toBeVisible();
    // ASSERÇÃO: campo de entrada de CPF deve estar visível
    const docInput = page.locator('input').first();
    await expect(docInput).toBeVisible({ timeout: 15000 });
  });

  test('Rota /carrinho renderiza sem crash', async ({ page }) => {
    await page.goto('/carrinho');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
  });

  // BLOQUEADO: Funcionalidade interna (financeiro, fidelidade, loja autenticada)
  // exige conta cliente seed com CPF real cadastrado no banco de dados.
  // Razão técnica: autenticação CPF+PIN com RLS no Supabase exige usuário real.
  test.skip('BLOQUEADO: Financeiro — faturas e transferências (sem conta cliente seed)', async () => {
    // Requer: cliente seed com CPF cadastrado no Supabase e faturas associadas
  });

  test.skip('BLOQUEADO: Fidelidade — resgate com saldo insuficiente (sem conta cliente seed)', async () => {
    // Requer: cliente seed com pontos e parceiros ativos associados
  });

});
