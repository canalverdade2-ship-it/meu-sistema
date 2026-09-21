import { test, expect } from '@playwright/test';

/**
 * REMEDIADO v2 — Gate M2 (corrigido após execução real)
 *
 * Evidências da execução real (2026-09-16):
 *  - /admin redireciona para /login ou /acesso-restrito — VALIDADO (8 passed no batch anterior)
 *  - /login/pessoa-fisica mostra campo CPF — VALIDADO
 *  - Teste "formulário de login renderiza" falhou porque /login NÃO tem campo de input
 *    → correção: navegar para /login/pessoa-fisica ou verificar o LoginHub corretamente
 */

test.describe('Painel do Administrador — Controles de Acesso e Segurança', () => {

  test('Rota /admin redireciona ou renderiza tela de acesso restrito', async ({ page }) => {
    await page.goto('/admin');
    // ASSERÇÃO: /admin não deve mostrar dados admin sem autenticação
    // Pode redirecionar para /login OU mostrar tela de "Acesso Negado" inline
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // Deve ou redirecionar para login ou manter em /admin com tela de bloqueio
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/acesso-restrito');
    const isAdminBlocked = page.getByText(/acesso negado|sem permissão|faça login|unauthorized/i);
    if (!isLoginPage) {
      // Se permaneceu em /admin, deve mostrar mensagem de bloqueio
      await expect(isAdminBlocked).toBeVisible({ timeout: 5000 });
    }
  });

  test('Rota /admin/colaboradores está protegida contra acesso não autenticado', async ({ page }) => {
    await page.goto('/admin/colaboradores');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // Verificar que dados de colaboradores não são expostos sem autenticação
    const colaboradoresData = page.getByText(/CPF:|Módulos atribuídos/i);
    await expect(colaboradoresData).toHaveCount(0);
  });

  test('LoginHub em /login renderiza opções de portal (PF e PJ)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // LoginHub deve ter botões de seleção de portal (sem campo de input)
    const pfOption = page.getByText(/Pessoa Física|PF/i).first();
    await expect(pfOption).toBeVisible({ timeout: 10000 });
    const pjOption = page.getByText(/Empresa|PJ/i).first();
    await expect(pjOption).toBeVisible({ timeout: 5000 });
  });

  test('Rota /login/pessoa-fisica (usada para admin PF) renderiza campo de CPF', async ({ page }) => {
    await page.goto('/login/pessoa-fisica');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    const docInput = page.locator('input').first();
    await expect(docInput).toBeVisible({ timeout: 15000 });
  });

  // BLOQUEADO: Testes de funcionalidade interna do admin
  test.skip('BLOQUEADO: Módulo Vendas — criar cupom inválido (sem conta admin seed)', async () => {
    // Requer: colaborador/admin seed com CPF cadastrado e acesso ao módulo de loja
  });

  test.skip('BLOQUEADO: Gestão RBAC — verificação de permissões por módulo (sem conta admin seed)', async () => {
    // Requer: dois usuários seed com perfis de permissão distintos
  });

});
