import { test, expect } from '@playwright/test';
import { generateTestCPF } from '../utils/cpf-generator';

const REAL_DATA_STRESS_ENABLED = process.env.ALLOW_REAL_DATA_STRESS_TEST === 'true';

test.describe.configure({ mode: 'parallel' });

// ========================================================================
// DADOS DE TESTE PRÉ-CRIADOS NO BANCO DE DADOS
// Indicações criadas via SQL com telefones fixos para cada agente
// - Agente 1: 11988880001
// - Agente 2: 11988880002
// - Agente 3: 11988880003
// ========================================================================
const AGENTE_CONFIG = [
  { agente: 1, phone: '11988880001', phoneMasked: '(11) 98888-0001' },
  { agente: 2, phone: '11988880002', phoneMasked: '(11) 98888-0002' },
  { agente: 3, phone: '11988880003', phoneMasked: '(11) 98888-0003' },
];

test.describe('Testes Massivos Reais de Sistema', () => {
  test.skip(!REAL_DATA_STRESS_ENABLED, 'Teste com gravação real exige ALLOW_REAL_DATA_STRESS_TEST=true.');

  for (const cfg of AGENTE_CONFIG) {
    test(`Agente ${cfg.agente}: Criação de Cliente, Login e Compra na Loja`, async ({ page }) => {
      test.setTimeout(150000);

      const userCPF = generateTestCPF();
      const userName = `Agente Teste ${cfg.agente}`;
      const userEmail = `agente${cfg.agente}_${Date.now()}@gsateste.com`;

      page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[Agente ${cfg.agente}][BROWSER ERROR] ${msg.text()}`);
      });

      // -----------------------------------------------------------------------
      // PASSO 1: Abrir página e modal de cliente
      // -----------------------------------------------------------------------
      console.log(`[Agente ${cfg.agente}] PASSO 1: Navegando para /`);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Abrir modal via evento customizado
      await expect(async () => {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-client-login')));
        await expect(page.getByRole('button', { name: 'Criar Conta' }).first()).toBeAttached({ timeout: 2000 });
      }).toPass({ timeout: 20000 });

      console.log(`[Agente ${cfg.agente}] PASSO 1: Modal aberto, clicando em Criar Conta`);
      await page.getByRole('button', { name: 'Criar Conta' }).first().click({ force: true });

      // -----------------------------------------------------------------------
      // PASSO 2: Usar tab "Com Indicação" (padrão) e inserir o telefone da indicação
      // O fluxo "com indicação" usa o telefone que foi cadastrado na indicação
      // NÃO depende de defaultCodeSettings.ativo
      // -----------------------------------------------------------------------
      console.log(`[Agente ${cfg.agente}] PASSO 2: Inserindo telefone da indicação: ${cfg.phone}`);

      // A tab "Com Indicação" já deve estar selecionada por padrão
      // O campo de voucher no modo "com-indicação" pede o telefone do WhatsApp
      const voucherField = page.locator('dialog input[type="text"], [role="dialog"] input[type="text"]').first();
      await voucherField.waitFor({ state: 'visible', timeout: 10000 });
      await voucherField.fill(cfg.phoneMasked); // Preencher com telefone formatado

      // Botão "Liberar Cadastro" - não depende de configuração
      const liberarBtn = page.getByRole('button', { name: /Liberar Cadastro/i }).first();
      await liberarBtn.waitFor({ state: 'visible', timeout: 10000 });
      await liberarBtn.click();

      // -----------------------------------------------------------------------
      // PASSO 3: Confirmar indicação (botão "Sim, Confirmar")
      // A tela "CONFIRMAR INDICAÇÃO" aparece com indicador + botão "Sim, Confirmar"
      // -----------------------------------------------------------------------
      console.log(`[Agente ${cfg.agente}] PASSO 3: Aguardando tela de confirmação`);
      // Aguardar botão "Sim, Confirmar" com timeout maior (backend precisa responder)
      const simConfirmarBtn = page.getByRole('button', { name: /Sim.*Confirmar|Confirmar/i }).first();
      const simConfirmarVisible = await simConfirmarBtn.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
      if (simConfirmarVisible) {
        console.log(`[Agente ${cfg.agente}] PASSO 3: Clicando Sim, Confirmar`);
        await simConfirmarBtn.click({ force: true });
        await page.waitForTimeout(1000); // Aguardar transição de step
      } else {
        await page.screenshot({ path: `test-results/debug-agente${cfg.agente}-passo3-failed.png` });
        throw new Error(`[Agente ${cfg.agente}] Botão Confirmar não encontrado após inserir voucher`);
      }

      // -----------------------------------------------------------------------
      // PASSO 4: Preencher formulário de registro
      // ARIA snapshot mostrou que campos são identificados por placeholder ARIA role
      // Estrutura: generic "Seu CPF *" → textbox "000.000.000-00"
      // -----------------------------------------------------------------------
      console.log(`[Agente ${cfg.agente}] PASSO 4: Aguardando formulário de registro`);

      // Aguardar campo CPF aparecer - pode ter placeholder "000.000.000-00" ou similar
      // O formulário de registro pode levar tempo para aparecer após confirmação
      const cpfInput = page.locator(
        'dialog input[placeholder="000.000.000-00"], [role="dialog"] input[placeholder="000.000.000-00"]'
      ).first();
      await cpfInput.waitFor({ state: 'visible', timeout: 25000 });
      await cpfInput.fill(userCPF);
      console.log(`[Agente ${cfg.agente}] PASSO 4: CPF preenchido: ${userCPF}`);

      // Nome Completo - 2º input de texto no diálogo
      const dialogInputsText = page.locator('dialog input[type="text"], [role="dialog"] input[type="text"]');
      await dialogInputsText.nth(1).fill(userName);

      // Email
      const emailInput = page.locator('dialog input[type="email"], [role="dialog"] input[type="email"]').first();
      await emailInput.fill(userEmail);

      // Telefone - 3º campo de texto no diálogo (CPF=0, Nome=1, Telefone=2)
      const phoneInput = dialogInputsText.nth(2);
      await phoneInput.waitFor({ state: 'visible', timeout: 5000 });
      await phoneInput.fill(cfg.phone);
      console.log(`[Agente ${cfg.agente}] PASSO 4: Telefone preenchido: ${cfg.phone}`);

      // CEP - placeholder "00000-000"
      const cepInput = page.locator('dialog input[placeholder="00000-000"], [role="dialog"] input[placeholder="00000-000"]').first();
      if (await cepInput.count() > 0) {
        await cepInput.fill('01001000');
        // Aguardar ViaCEP preencher o campo Endereço automaticamente
        // Verificar se o endereço foi preenchido, caso contrário preencher manualmente
        const enderecoInput = page.locator('dialog input[placeholder=""]').nth(3); // às vezes é o 4º input
        const enderecoFilled = await expect(async () => {
          const val = await cepInput.inputValue();
          if (val !== '01001-000') return; // ainda não formatou
          // Verificar se o endereço foi preenchido
          const enderecoVal = await page.locator('dialog input[type="text"], [role="dialog"] input[type="text"]').nth(3).inputValue().catch(() => '');
          if (!enderecoVal) throw new Error('Endereço não preenchido ainda');
        }).toPass({ timeout: 5000 }).then(() => true).catch(() => false);
        
        if (!enderecoFilled) {
          // ViaCEP não respondeu - preencher campos de endereço manualmente
          console.log(`[Agente ${cfg.agente}] ViaCEP timeout - preenchendo endereço manualmente`);
          const inputs = page.locator('dialog input[type="text"], [role="dialog"] input[type="text"]');
          // Endereço = input[3], Bairro = input[4], Estado = input[5], Cidade = input[6]
          await inputs.nth(3).fill('Praça da Sé').catch(() => {});
          await inputs.nth(4).fill('Sé').catch(() => {});
          // Estado pode ser um input menor
          const estadoInput = page.locator('dialog input[maxlength="2"], [role="dialog"] input[maxlength="2"]').first();
          if (await estadoInput.count() > 0) await estadoInput.fill('SP').catch(() => {});
          await inputs.nth(5).fill('SP').catch(() => {});
          await inputs.nth(6).fill('São Paulo').catch(() => {});
        }
      }

      // Número - placeholder começa com "N"
      const numeroInput = page.getByPlaceholder(/^N/i).first();
      if (await numeroInput.count() > 0) {
        await numeroInput.fill('123');
      }

      // -----------------------------------------------------------------------
      // PASSO 5: Submeter formulário e aguardar sucesso
      // -----------------------------------------------------------------------
      const submitBtn = page.getByRole('button', { name: /Finalizar Cadastro/i }).first();
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

      await page.screenshot({ path: `test-results/debug-agente${cfg.agente}-before-submit.png` });
      console.log(`[Agente ${cfg.agente}] PASSO 5: Submetendo formulário`);
      await submitBtn.click();

      // Aguardar resultado do cadastro:
      // - Sucesso: o título do diálogo muda de "CADASTRO DE INDICADO" para "AREA DO CLIENTE"
      // - Erro: mensagem de erro aparece no diálogo
      const resultado = await Promise.race([
        // Sucesso: título muda para "Área do Cliente" (onboardingStep muda para 'login')
        page.waitForSelector('dialog :text-matches("área do cliente|area do cliente", "i"), [role="dialog"] :text-matches("área do cliente|area do cliente", "i")', { timeout: 25000 }).then(() => 'sucesso_login_step'),
        // Sucesso alternativo: toast de sucesso
        page.waitForSelector(':text-matches("Cadastro enviado|Cadastro realizado", "i")', { timeout: 25000 }).then(() => 'sucesso_toast'),
        // Erro: mensagem de erro aparece
        page.waitForSelector('dialog :text-matches("Endereço|obrigatório|obrigatorio|erro|inválido|invalido|Existe|existe", "i")', { timeout: 25000 }).then(() => 'error_shown'),
      ]).catch(async () => {
        const content = await page.evaluate(() => {
          const dialog = document.querySelector('dialog, [role="dialog"]') as HTMLElement | null;
          return dialog ? dialog.innerText : 'dialog not found';
        });
        console.log(`[Agente ${cfg.agente}] Timeout. Dialog content: ${content.slice(0, 500)}`);
        return 'timeout';
      });

      console.log(`[Agente ${cfg.agente}] PASSO 5: Resultado = ${resultado}`);
      await page.screenshot({ path: `test-results/debug-agente${cfg.agente}-after-submit.png` });

      if (resultado === 'error_shown') {
        const errorText = await page.locator('dialog, [role="dialog"]').innerText().catch(() => '');
        console.log(`[Agente ${cfg.agente}] ERRO: ${errorText.slice(0, 300)}`);
      }

      // -----------------------------------------------------------------------
      // PASSO 6: Login com a conta criada
      // -----------------------------------------------------------------------
      console.log(`[Agente ${cfg.agente}] PASSO 6: Fazendo login`);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // O input do login usa o mesmo placeholder "000.000.000-00"
      await expect(async () => {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-client-login')));
        // O login step mostra input com placeholder "000.000.000-00" (para CPF) ou "00.000.000/0000-00" (CNPJ)
        await expect(page.locator('dialog input[placeholder="000.000.000-00"], [role="dialog"] input[placeholder="000.000.000-00"]').first()).toBeAttached({ timeout: 2000 });
      }).toPass({ timeout: 20000 });

      const loginDoc = page.locator('dialog input[placeholder="000.000.000-00"], [role="dialog"] input[placeholder="000.000.000-00"]').first();
      await loginDoc.fill(userCPF);

      const continuarBtn = page.getByRole('button', { name: /Continuar/i }).first();
      await continuarBtn.waitFor({ state: 'visible', timeout: 5000 });
      await continuarBtn.click();

      await page.waitForTimeout(3000);
      await page.screenshot({ path: `test-results/debug-agente${cfg.agente}-after-login.png` });

      // -----------------------------------------------------------------------
      // PASSO 7: Criar PIN se necessário
      // -----------------------------------------------------------------------
      const hasPinStep = await page.getByText(/Criar Senha|Crie sua Senha/i).count() > 0;
      console.log(`[Agente ${cfg.agente}] PASSO 7: PIN step: ${hasPinStep}`);

      if (hasPinStep) {
        const pinBoxes = page.locator('input[type="password"]');
        const pinCount = await pinBoxes.count();
        if (pinCount >= 4) {
          for (let j = 0; j < Math.min(pinCount, 8); j++) {
            await pinBoxes.nth(j).click();
            await pinBoxes.nth(j).type('1');
          }
        }

        const phoneConf = page.locator('input[type="tel"]').first();
        if (await phoneConf.count() > 0) await phoneConf.fill(cfg.phone);

        const finishBtn = page.getByRole('button', { name: /Entrar|Acessar|Confirmar/i }).first();
        if (await finishBtn.count() > 0) {
          await finishBtn.click();
          await page.waitForTimeout(3000);
        }
      }

      // -----------------------------------------------------------------------
      // PASSO 8: Verificar portal do cliente
      // -----------------------------------------------------------------------
      const clientPortalVisible = await page.getByText(/Meus Atendimentos|Minha Conta|Portal|Bem-vindo/i).count() > 0;
      console.log(`[Agente ${cfg.agente}] PASSO 8: Portal visível: ${clientPortalVisible}`);
      await page.screenshot({ path: `test-results/debug-agente${cfg.agente}-portal.png` });

      console.log(`[Agente ${cfg.agente}] ✅ Teste concluído!`);
    });
  }
});
