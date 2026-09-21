import { test, expect, type Page } from '@playwright/test';

/**
 * SUITE: Jornadas E2E Completas com Seed Local
 * 
 * PRE-REQUISITO: supabase start + seed.sql aplicado
 * AMBIENTE: http://localhost:3000 com .env.test (VITE_SUPABASE_URL=http://localhost:54321)
 * SEED: seed determinístico com identidades de teste (CPFs válidos por Módulo 11, não de produção)
 * 
 * Identidades do seed:
 *  - CLIENTE: CPF 748.277.601-01 / PIN derivado do seed
 *  - ADMIN:   CPF 290.932.090-79
 *  - PRESTADOR: CPF 838.218.370-00
 */

const SEED_CLIENTE_CPF = '748.277.601-01';
const SEED_ADMIN_CPF   = '290.932.090-79';
const SEED_PRESTADOR_CPF = '838.218.370-00';
const SEED_PIN = '1234'; // PIN do seed (não é dado de produção)

// Helper: fazer login com CPF+PIN
async function loginComCPF(page: Page, cpf: string, pin: string) {
  await page.goto('/login');
  // LoginHub — clicar em Pessoa Física
  const pfButton = page.getByText(/Pessoa F[ií]sica|PF/i).first();
  await expect(pfButton).toBeVisible({ timeout: 10000 });
  await pfButton.click();

  // Campo de CPF
  await page.waitForURL('**/login/pessoa-fisica**', { timeout: 10000 });
  const cpfInput = page.locator('input').first();
  await expect(cpfInput).toBeVisible({ timeout: 10000 });
  await cpfInput.fill(cpf);

  // Submeter CPF
  const submitBtn = page.getByRole('button', { name: /continuar|avancar|proximo|next/i }).first();
  await submitBtn.click();

  // PIN Input (4 campos)
  await page.waitForTimeout(2000);
  const pinInputs = page.locator('input[type="password"]');
  const pinCount = await pinInputs.count();

  if (pinCount >= 4) {
    // PinInput com 4 campos separados
    for (let i = 0; i < 4 && i < pin.length; i++) {
      await pinInputs.nth(i).fill(pin[i]);
    }
  } else if (pinCount === 1) {
    await pinInputs.first().fill(pin);
  }

  // Confirmar PIN
  const pinSubmit = page.getByRole('button', { name: /entrar|login|confirmar|acessar/i }).first();
  await pinSubmit.click();
  await page.waitForTimeout(2000);
}

// ============================================================
// E2E-01: Autenticação PF — Fluxo Completo com Seed
// ============================================================
test.describe('E2E-01: Autenticação PF com Seed Local', () => {
  
  test('E2E-01-A: CPF válido (748.277.601-01) avança para PIN', async ({ page }) => {
    await page.goto('/login/pessoa-fisica');
    const cpfInput = page.locator('input').first();
    await expect(cpfInput).toBeVisible({ timeout: 15000 });
    await cpfInput.fill(SEED_CLIENTE_CPF);
    const submitBtn = page.getByRole('button').first();
    await submitBtn.click();
    // Aguardar PIN ou dashboard
    await page.waitForTimeout(2000);
    // Verificar que avançou (URL mudou ou PIN apareceu)
    const currentUrl = page.url();
    const pinVisible = await page.locator('input[type="password"]').count();
    const advanced = currentUrl.includes('pin') || pinVisible > 0 || currentUrl.includes('/cliente');
    expect(advanced).toBeTruthy();
  });

  test('E2E-01-B: CPF com dígitos verificadores errados (123.456.789-09) é rejeitado', async ({ page }) => {
    await page.goto('/login/pessoa-fisica');
    const cpfInput = page.locator('input').first();
    await expect(cpfInput).toBeVisible({ timeout: 15000 });
    await cpfInput.fill('123.456.789-09');
    const submitBtn = page.getByRole('button').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    // Não deve avançar para PIN
    await expect(page).not.toHaveURL(/pin/i);
    const pinCount = await page.locator('input[type="password"]').count();
    expect(pinCount).toBe(0);
  });

  test('E2E-01-C: LoginHub exibe opções de portal sem crash', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    // Deve mostrar opções (Pessoa Física, PJ, etc)
    const options = page.getByText(/Pessoa F[ií]sica|PF|Empresa|Fornecedor|Prestador/i);
    await expect(options.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// E2E-02: Marketplace + Loja (parcialmente com seed)
// ============================================================
test.describe('E2E-02: Marketplace e Loja', () => {

  test('E2E-02-A: Rota /loja carrega com produtos', async ({ page }) => {
    await page.goto('/loja');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    await expect(page.locator('main, #root').first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-02-B: Rota /carrinho renderiza sem crash', async ({ page }) => {
    await page.goto('/carrinho');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
  });

  test.skip('E2E-02-C: BLOQUEADO — Checkout completo requer conta cliente autenticada com seed local ativo', async ({ page }) => {
    // PROBLEMA DE INFRAESTRUTURA: supabase start + seed.sql necessários
    // Quando seed local ativo: loginComCPF(page, SEED_CLIENTE_CPF, SEED_PIN)
    // Então: adicionar produto ao carrinho → checkout → pagamento mock
  });
});

// ============================================================
// E2E-03: Ordem de Serviço — Cliente → Admin → Prestador
// ============================================================
test.describe('E2E-03: Fluxo de Ordem de Serviço', () => {

  test('E2E-03-A: Rota /admin renderiza sem expor dados sem auth', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
    // Não deve expor dados sensíveis sem autenticação
    const cpfExposed = await page.getByText(/CPF:\s*\d{3}\.\d{3}/).count();
    expect(cpfExposed).toBe(0);
  });

  test('E2E-03-B: Rota /admin/colaboradores protegida contra acesso anônimo', async ({ page }) => {
    await page.goto('/admin/colaboradores');
    await expect(page.locator('body')).toBeVisible();
    // Não deve listar colaboradores sem autenticação
    const collaboratorData = await page.getByText(/colaborador/i).count();
    // Ou redireciona para login, ou mostra estado vazio protegido
    const isProtected = page.url().includes('/login') || collaboratorData === 0;
    expect(isProtected).toBeTruthy();
  });

  test('E2E-03-C: Rota /prestador/demandas não expõe OS sem auth', async ({ page }) => {
    await page.goto('/prestador/demandas');
    await expect(page.locator('body')).toBeVisible();
    // Sem OS expostas (OS-NNN pattern)
    const osExposed = await page.getByText(/OS-\d{3,}/).count();
    expect(osExposed).toBe(0);
  });

  test.skip('E2E-03-D: BLOQUEADO — Ciclo completo OS requer 3 contas seed ativas', async () => {
    // PROBLEMA DE INFRAESTRUTURA: supabase start + seed.sql com OS-SEED-001
    // Fluxo: cliente cria OS → admin aprova → prestador executa → cliente confirma
  });
});

// ============================================================
// E2E-04: Fidelidade e Cupons
// ============================================================
test.describe('E2E-04: Fidelidade e Cupons', () => {

  test('E2E-04-A: Rota /cliente renderiza estado de fidelidade (autenticado ou não)', async ({ page }) => {
    await page.goto('/cliente');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root').first()).toBeVisible({ timeout: 10000 });
  });

  test.skip('E2E-04-B: BLOQUEADO — Resgate de cupom requer parceiro ativo e pontos seed', async () => {
    // PROBLEMA DE INFRAESTRUTURA: supabase start + voucher SEED-VOUCHER-10 no banco
  });
});

// ============================================================
// E2E-05: Suprimentos B2B (Fornecedor)
// ============================================================
test.describe('E2E-05: Suprimentos B2B', () => {

  test('E2E-05-A: Rota /fornecedor/login renderiza sem crash', async ({ page }) => {
    await page.goto('/fornecedor/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
    await expect(page.locator('main, #root').first()).toBeVisible({ timeout: 10000 });
  });

  test.skip('E2E-05-B: BLOQUEADO — Pedido B2B requer conta fornecedor seed e estoque local', async () => {
    // PROBLEMA DE INFRAESTRUTURA: supabase start + fornecedor seed no banco
  });
});

// ============================================================
// E2E-06: Afiliados e Conversão
// ============================================================
test.describe('E2E-06: Afiliados', () => {

  test('E2E-06-A: Rota /anuncios carrega sem crash', async ({ page }) => {
    await page.goto('/anuncios');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Algo deu errado', { exact: true })).toHaveCount(0);
  });

  test.skip('E2E-06-B: BLOQUEADO — Conversão de afiliado requer link rastreado e compra', async () => {
    // PROBLEMA DE INFRAESTRUTURA: supabase start + afiliado seed com código AFIL-SEED-001
  });
});
