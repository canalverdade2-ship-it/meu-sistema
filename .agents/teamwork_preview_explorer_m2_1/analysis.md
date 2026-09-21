# RELATÓRIO DE ANÁLISE TÉCNICA E PLANO DE EXECUÇÃO: TESTES DINÂMICOS DE UI E E2E (MILESTONE 2)

**Documento**: `analysis.md`  
**Agente Responsável**: `teamwork_preview_explorer_m2_1` (Technical Explorer — Milestone 2)  
**Data**: 2026-09-16  
**Ambiente Alvo**: Windows PowerShell / Node.js v24.14.1 / React 19 / Vite 6.4.3 / Vitest 3.2.7 / Playwright 1.61.1  
**Escopo Analisado**: 15 Super-Domínios / Módulos (`UI-MOD-01` a `UI-MOD-15`), 72 Telas/Rotas (`UI-PAGE-001` a `UI-PAGE-072`), 54 Formulários (`UI-FORM-001` a `UI-FORM-054`), 118 Botões Críticos (`UI-BTN-001` a `UI-BTN-118`), Test Harnesses (Vitest & Playwright), e 6 Jornadas Multi-Step End-to-End.  
**Entregáveis Suportados**: `RELATORIO_TESTES_UI.md` e `RELATORIO_E2E.md`  

---

## 1. RESUMO EXECUTIVO & OBJETIVOS DO MILESTONE 2

O Milestone 1 estabeleceu o **Baseline Inicial** e catalogou formalmente todo o escopo do ecossistema GSA HUB em `INVENTARIO_COMPLETO.md`, `MATRIZ_RASTREABILIDADE.md` e `GRAFO_CONEXOES.md`, mantendo todos os 1.377 elementos sob o status rigoroso de `ANALISADO ESTATICAMENTE`.

O objetivo primário do **Milestone 2 (Dynamic Testing: UI & E2E)** é fazer a transição operacional de `ANALISADO ESTATICAMENTE` para **`TESTADO DINAMICAMENTE`**, **`VALIDADO`** ou **`FALHOU` / `CORRIGIDO E RETESTADO`**, em estrita conformidade com as Regras de Ouro do projeto:
1. **Regra de Ouro 4**: Testar dinamicamente as funcionalidades sempre que tecnicamente possível.
2. **Regra de Ouro 5**: Validar não apenas os módulos isolados, mas as conexões e arestas ponta a ponta (`UI -> Handler -> Service -> API -> DB`).
3. **Regra de Ouro 6**: Comprovar persistência física real no banco de dados e propagação reativa entre módulos.
4. **Regra de Ouro 11**: Jamais fabricar cobertura ou declarar `VALIDADO` sem evidência dinâmica executável correspondente.

Esta investigação técnica profunda fornece o blueprint completo para a equipe de Workers e QA executarem as baterias de testes dinâmicos de interface (UI) e jornadas completas de ponta a ponta (E2E), especificando massa de dados, seletores reais, tratamentos de erro, asserções de formulários e scripts de execução.

---

## 2. MAPEAMENTO DETALHADO DO ECOSSISTEMA DE UI

### 2.1 Módulos e Super-Domínios Analisados (`UI-MOD-01` a `UI-MOD-15`)

| ID | Super-Domínio / Módulo | Componente Raiz / Diretório | Total Rotas | Total Forms | Total Botões |
|---|---|---|:---:|:---:|:---:|
| `UI-MOD-01` | **Portal Público & Vitrine** | `src/pages/Home.tsx`, `src/components/public/` | 16 | 6 | 13 |
| `UI-MOD-02` | **Autenticação & Sessões** | `src/pages/ClientLoginPage.tsx`, `RestrictedAccessHubPage.tsx`, `BusinessRegistrationPage.tsx`, `ProviderAccessPage.tsx`, `FornecedorAccessPage.tsx`, `AffiliateAccessPage.tsx` | 13 | 13 | 14 |
| `UI-MOD-03` | **Marketplace & E-Commerce (Loja)** | `src/components/client/store/`, `StoreHub.tsx`, `CheckoutPage.tsx` | 11 | 5 | 9 |
| `UI-MOD-04` | **Portal do Cliente (PF)** | `src/pages/ClientPortal.tsx` (variant="personal"), `src/components/client/` | 10 | 9 | 21 |
| `UI-MOD-05` | **GSA HUB Empresas (PJ)** | `src/pages/ClientPortal.tsx` (variant="business") | 2 | Reuso PF | Reuso PF |
| `UI-MOD-06` | **Portal do Prestador** | `src/pages/Prestador/`, `src/components/prestador/` | 5 | 5 | 6 |
| `UI-MOD-07` | **Portal do Fornecedor** | `src/pages/Fornecedor/FornecedorDashboard.tsx` | 5 | 3 | 3 |
| `UI-MOD-08` | **Programa de Afiliados** | `src/pages/Afiliado/AfiliadoDashboard.tsx` | 1 | 2 | 4 |
| `UI-MOD-09` | **Portal do Anunciante** | `src/pages/AdvertiserPortal.tsx` | 2 | 1 | 2 |
| `UI-MOD-10` | **Painel Administrativo & Governança** | `src/pages/SecureAdminPanel.tsx`, `AdminPanel.tsx`, `AcessosModule.tsx`, `ConfiguracoesModule.tsx` | 2 | 3 | 12 |
| `UI-MOD-11` | **Super-Domínio Operações & Workstation** | `src/components/admin/super-domains/operacoes/` | 2 | 3 | 10 |
| `UI-MOD-12` | **Super-Domínio Financeiro & Fintech** | `src/components/admin/super-domains/financeiro/` | 1 | 2 | 7 |
| `UI-MOD-13` | **GSA TV Master Control & IA Broadcast** | `src/components/admin/gsa-tv/` | 1 | 2 | 5 |
| `UI-MOD-14` | **Verticais Especializadas** | `TravelAdminModule.tsx`, `ProtectionAdminModule.tsx`, `ClassifiedsModule.tsx` | 0 (Subviews) | 0 | 5 |
| `UI-MOD-15` | **Recrutamento & Carreiras (RH)** | `src/pages/Careers/`, `src/components/admin/CareersAdminModule.tsx` | 1 | 1 | 4 |
| **Total** | **15 Super-Domínios** | — | **72** | **54** | **118** |

---

## 3. INVESTIGAÇÃO DO TEST HARNESS EXISTENTE E GARGALOS DETECTADOS

### 3.1 Infraestrutura de Teste Unitário & Componentes (Vitest v3.2.7)
1. **Ambiente de Execução**: Vitest configurado para executar testes sob `src/tests/` via comando `npm run test:unit`.
2. **Renderização de Componentes**:
   - O projeto utiliza **React 19** (`react@19.0.0` e `react-dom@19.0.0`).
   - Não há `@testing-library/react` instalada no `package.json`.
   - **Padrão Canônico Existente no Repositório**: Componentes de UI como `WhatsAppHealthMonitor` (`src/tests/whatsapp-health-monitor-ui.test.tsx`) utilizam `renderToString` de `react-dom/server` para testar renderização sem dependência de jsdom, testando tags, atributos, variantes, classes CSS e `data-testid`, combinados com spies de métodos de serviço e mocks de eventos globais (`document`, `localStorage`).
   - Para testes dinâmicos de interação em tempo de execução com DOM vivo, o projeto apoia-se em **Playwright** (`@playwright/test`).

### 3.2 Infraestrutura de Testes End-to-End (Playwright v1.61.1)
1. **Configuração Canônica (`playwright.config.ts`)**:
   - `testDir: './tests/e2e'`
   - `baseURL: externalBaseURL || 'http://localhost:3000'`
   - `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120000 }`
   - Navegador padrão: Chromium Desktop (`{ ...devices['Desktop Chrome'] }`).
2. **Suítes E2E Pré-existentes**:
   - `tests/e2e/0-stress-real-data.spec.ts`: Teste de cadastro, validação de CEP via ViaCEP, criação de conta e acesso ao portal com CPFs sintéticos válidos.
   - `tests/e2e/1-public-smoke.spec.ts`: Rastreamento de rotas públicas com interceptação de chamadas Supabase RPC / Auth para atestar ausência de crashes.
   - `tests/e2e/2-authenticated-production-smoke.spec.ts`: Login autenticado real via modal de cliente (`CustomEvent('open-client-login')`).
   - `tests/e2e/1-auth-e-publico.spec.ts`, `2-painel-cliente.spec.ts`, `3-painel-admin.spec.ts`, `4-painel-prestador.spec.ts`.

### 3.3 Diagnóstico de Inconsistências e Gaps Críticos nos Testes Pré-existentes
1. **Seletor Incompatível em `1-auth-e-publico.spec.ts`**:
   - O teste busca seletores como `page.getByPlaceholder(/email|e-mail/i)` e `page.getByPlaceholder(/senha/i)` na rota `/login`.
   - **Realidade do Código**: Em `ClientLoginPage.tsx`, a tela de login opera em dois estágios: primeiro campo com máscara `000.000.000-00` (CPF) ou `00.000.000/0000-00` (CNPJ), botão "Continuar", e então o componente `<PinInput />` (4 dígitos numéricos de tipo password). A busca por email faz o teste pular o fluxo ou falhar silenciosamente.
2. **Inclusão Espúria de Backups na Suíte Unitária**:
   - O Vitest tenta executar testes dentro de `backups/home-antes-das-melhorias-20260913-132421/src/tests/*.test.ts`, resultando em 7 falhas por falta de pasta de migrações no diretório de backup.
3. **Lacunas de Cobertura Dinâmica**:
   - Das 54 formulários catalogados, apenas ~8 possuem testes automatizados de input inválido/positivo.
   - Dos 118 botões, apenas uma fração foi testada dinamicamente quanto a `isSubmittingRef`, bloqueio de duplo clique e spinners `Loader2`.
   - Jornadas multi-step críticas (como Devolução/Troca com estorno atômico e Recurso de Benefício com 2FA WhatsApp) possuem testes unitários e RPCs mockadas, mas necessitam de consolidação dinâmica documentada nos relatórios `RELATORIO_TESTES_UI.md` e `RELATORIO_E2E.md`.

---

## 4. PLANO DE EXECUÇÃO PARA O RELATÓRIO DE TESTES DE UI (`RELATORIO_TESTES_UI.md`)

O relatório de testes de UI deve cobrir minuciosamente:
1. Validação positiva e negativa em todos os 54 formulários.
2. Renderização de componentes, variantes visuais, tratamento de spinners de carregamento (`Loader2`) e botões desabilitados.
3. Comportamento do componente `ErrorBoundary` e tolerância a falhas.
4. Sincronismo de estado via TanStack Query e hooks locais.

### 4.1 Matriz de Validação de Formulários (Positiva vs Negativa)

Abaixo está o detalhamento operacional para os formulários centrais do sistema, estabelecendo o que deve ser injetado dinamicamente:

| ID Form | Finalidade | Cenário Positivo (Input Válido) | Cenários Negativos Obrigatórios | Asserção Visual / Feedback Esperado |
|---|---|---|---|---|
| `UI-FORM-001` | Identificação Cliente (`ClientLoginPage`) | CPF com 11 dígitos válidos (algoritmo módulo 11) ou CNPJ com 14 dígitos válidos. | 1. Input vazio.<br>2. 10 dígitos (incompleto).<br>3. 11 dígitos com dígitos verificadores inválidos (ex: `111.111.111-11`).<br>4. Caracteres alfabéticos ou especiais. | Bloqueio do botão 'Continuar'; Toast de erro: `Informe um CPF válido.` ou `Informe um CNPJ válido.` |
| `UI-FORM-002` | PIN de Acesso (`ClientLoginPage`) | 4 dígitos numéricos válidos cadastrados no banco. | 1. Menos de 4 dígitos.<br>2. 4 dígitos incorretos (simulação de 1 a 5 tentativas).<br>3. Bloqueio após 5ª tentativa. | Limpeza automática do PIN (`setPin('')`); exibição de `attemptsLeft`; no 5º erro: `Acesso temporariamente bloqueado. Entre em contato com o suporte.` |
| `UI-FORM-003` | Recuperação PIN - Etapa 1 (`ClientLoginPage`) | CPF válido + E-mail compatível com RFC 5322 cadastrado no cliente. | 1. E-mail sem `@` ou sem domínio.<br>2. E-mail não pertencente ao CPF.<br>3. CPF inexistente. | Toast: `Informe o e-mail cadastrado.` ou `Dados não localizados.` |
| `UI-FORM-004` | Recuperação PIN - Etapa 2 (`ClientLoginPage`) | Código de 6 dígitos recebido + novo PIN de 4 dígitos + confirmação idêntica. | 1. Código com 5 dígitos.<br>2. PIN com 3 dígitos.<br>3. `pinConfirm` divergente de `pin`. | Validação inline: `Os PINs informados não coincidem.` Botão 'Redefinir Senha' desabilitado. |
| `UI-FORM-006` | Autorização Prévia PJ (`BusinessRegistrationPage`) | Celular válido com DDD (11 dígitos) ou código de voucher existente na RPC `gsa_public_lookup_referral`. | 1. Campo vazio.<br>2. Celular com 10 dígitos (sem 9º dígito).<br>3. Voucher inexistente. | Toast: `Autorização ou indicação não localizada.` |
| `UI-FORM-007` | Dados Cadastrais PJ (`BusinessRegistrationPage`) | CNPJ válido na Receita + Razão Social (>=3 chars) + E-mail + CEP (8 dígitos) + Termo marcado. | 1. CNPJ inválido.<br>2. CEP inexistente (ViaCEP retorna `erro: true`).<br>3. Termo desmarcado (`!confirmed`). | Bloqueio do botão 'Concluir Cadastro'; campo com borda vermelha `ring-rose-500`. |
| `UI-FORM-008` | Desafio 2FA PJ (`BusinessRegistrationPage`) | Código numérico de exatamente 6 dígitos recebido no WhatsApp. | 1. Código alfanumérico.<br>2. Código incorreto.<br>3. Código expirado (> 10 min). | Mensagem: `Código incorreto ou expirado. Tentativas restantes: X.` |
| `UI-FORM-010` | Login Acesso Restrito (`RestrictedAccessHubPage`) | Código master válido de gestão ou credencial ativa de colaborador. | 1. Campo vazio.<br>2. Código inexistente.<br>3. Colaborador inativo/revogado. | Erro: `Credencial inválida ou sem permissão de acesso.` |
| `UI-FORM-014` | Consulta de Protocolo (`ProtocolConsultPage`) | Código no formato canônico `PROT-RES-2026-XXXXXX`. | 1. Código vazio.<br>2. Formato inválido.<br>3. Injeção de tags HTML/SQL (`<script>`). | Sanitização automática (apenas alfanumérico e hífen); mensagem: `Protocolo não encontrado.` |
| `UI-FORM-015` | Recurso de Benefício (`ProtocolConsultPage`) | Justificativa entre 20 e 4.000 caracteres + até 3 anexos (PNG/JPG/PDF <= 5MB) + código 6 dígitos. | 1. Justificativa < 20 chars (ex: "Quero meu benefício").<br>2. Arquivo executável (`.exe`, `.sh`).<br>3. Arquivo > 5MB.<br>4. Mais de 3 arquivos. | Contador de caracteres em vermelho; rejeição de upload com alerta de tipo/tamanho inválido; botão 'Continuar e receber código' desabilitado. |
| `UI-FORM-019` | Endereço Checkout (`CheckoutPage` Etapa 1) | CEP válido com busca ViaCEP + Número obrigatório + Logradouro. | 1. CEP incompleto.<br>2. Número vazio para entrega física.<br>3. Logradouro não preenchido. | `disabled={temProdutos && !enderecoValido}`; indicador visual de campo pendente. |
| `UI-FORM-020` | Cupom de Desconto (`CheckoutPage` Etapa 1) | Código de cupom ativo, dentro da validade e com estoque de usos disponível. | 1. Cupom expirado.<br>2. Cupom esgotado (`usage_count >= usage_limit`).<br>3. Valor do pedido abaixo do `valor_minimo_compra`. | Toast: `Cupom inválido, expirado ou limite atingido.` |
| `UI-FORM-021` | Dedução Financeira (`CheckoutPage` Etapa 2) | Saldo de carteira <= saldo disponível; pontos <= saldo de pontos; forma de pagamento selecionada. | 1. Tentativa de deduzir mais que o saldo líquido.<br>2. Nenhuma forma de pagamento selecionada para o saldo remanescente. | Bloqueio do botão 'Avançar para Resumo'; mensagem de saldo insuficiente. |
| `UI-FORM-023` | Troca / Devolução (`PurchasesPage` / `StoreHubPurchases`) | Seleção de >= 1 item + tipo ('troca' ou 'devolucao') + motivo >= 15 chars + upload de fotos. | 1. Nenhum item marcado.<br>2. Motivo genérico < 15 chars.<br>3. Prazo legal excedido (> 7 dias da entrega). | Bloqueio de envio; mensagem: `Selecione ao menos um produto e descreva o motivo detalhadamente.` |
| `UI-FORM-026` | Solicitação Saque PIX (`SaquesList` / `ClientFinanceiro`) | Valor >= R$ 50,00 + Valor <= Saldo Disponível + Chave PIX compatível com o tipo escolhido (CPF, Celular, E-mail, Chave Aleatória). | 1. Valor < R$ 50,00 (piso mínimo).<br>2. Valor > Saldo.<br>3. Chave PIX incompatível com o tipo (ex: e-mail inválido). | Bloqueio do botão 'Solicitar Saque'; alerta `Valor mínimo para saque é de R$ 50,00.` |
| `UI-FORM-027` | Transferência P2P (`ClientTransferencias`) | Destinatário diferente do remetente + Destinatário existente no banco + Valor > 0 <= Saldo. | 1. Destinatário igual ao próprio usuário.<br>2. Destinatário inexistente.<br>3. Valor zerado ou negativo.<br>4. Saldo insuficiente. | Alerta impeditivo: `Você não pode transferir fundos para sua própria conta.` |
| `UI-FORM-028` | Conversão de Pontos (`ClientPontos`) | Valor inteiro positivo >= 100 pontos e <= Saldo de Pontos. | 1. Quantidade < 100 pontos.<br>2. Quantidade maior que o saldo.<br>3. Valor fracionário (ex: 150.5). | Alerta de validação e desativação do botão de conversão. |
| `UI-FORM-033` | Contraproposta Prestador (`PrestadorDemandas`) | Valor proposto > 0 + Justificativa técnica informada. | 1. Valor <= 0.<br>2. Justificativa em branco. | Toast: `Informe o valor da contraproposta e a justificativa.` |
| `UI-FORM-034` | Entrega de OS (`PrestadorDemandas`) | Data/hora de conclusão + Notas técnicas >= 10 chars + Link do relatório ou upload de fotos. | 1. Notas técnicas vazias.<br>2. Sem comprovação (nem link nem arquivo anexado). | Bloqueio da submissão com alerta de pendência documental. |
| `UI-FORM-035` | Agendamento Técnico (`PrestadorAgenda`) | Data futura + `hora_fim > hora_inicio` + Sem choque de agenda com outro compromisso. | 1. Data retroativa.<br>2. `hora_fim <= hora_inicio`.<br>3. Horário conflitante com agendamento existente. | Mensagem de choque de horários retornada pelo componente. |
| `UI-FORM-039` | Despacho Fornecedor & NF-e (`FornecedorDashboard`) | Número da NF + Chave de acesso com exatamente 44 dígitos numéricos + XML/PDF anexado. | 1. Chave de acesso com 43 ou 45 dígitos.<br>2. Chave com letras.<br>3. Arquivo sem ser XML/PDF. | Validação estrita: `A chave da NF-e deve conter exatamente 44 dígitos numéricos.` |
| `UI-FORM-048` | Cadastro de Produto com Variantes (`ProdutosModule`) | Nome do produto + SKU único por variante + Preço > 0 + Estoque >= 0. | 1. Nome vazio.<br>2. SKU duplicado.<br>3. Preço zero ou negativo. | Destaque em vermelho no campo da variante conflitante. |

### 4.2 Testes de Component Rendering, Botões e Estados de Loading

1. **Proteção Contra Duplo Clique e Concorrência de UI**:
   - O Worker deve testar dinamicamente a presença de `isSubmittingRef.current = true` ou flag `loading` nos botões críticos (`UI-BTN-001`, `UI-BTN-004`, `UI-BTN-017`, `UI-BTN-021`, `UI-BTN-024`).
   - Simular dois cliques rápidos com intervalo < 50ms: o sistema deve ignorar o segundo disparo e não emitir chamadas de rede redundantes.
2. **Indicadores de Carregamento (Loading Spinners)**:
   - Durante a resolução da Promise assíncrona, o botão deve conter a classe `animate-spin` com o ícone `Loader2`, o texto deve alternar (ex: "Processando...", "Salvando...") e o elemento deve receber o atributo `disabled`.
3. **Resiliência do Error Boundary (`ErrorBoundary.tsx`)**:
   - O Worker deve injetar um componente que lance um erro intencional (`throw new Error('Crash de Teste UI')`) dentro de uma rota encapsulada pelo `ErrorBoundary`.
   - **Verificações Obrigatórias**:
     * A tela não fica em branco (white-screen of death).
     * O título `Algo deu errado` é exibido em vermelho.
     * O código de referência (`referenceId`) gerado por `reportClientError` é renderizado para o usuário.
     * O botão `Tentar novamente` chama `handleRetry` e reseta o estado `hasError: false`.

---

## 5. PLANO DE EXECUÇÃO PARA O RELATÓRIO DE E2E (`RELATORIO_E2E.md`)

O relatório de E2E documentará a execução dinâmica de **6 Jornadas Multi-Step Completas**, rastreando desde a primeira interação do usuário na interface até a persistência no PostgreSQL e a propagação cross-módulo.

### 5.1 Jornada E2E-01: Autenticação, Onboarding PJ & Perfil do Consumidor
- **Atores**: Usuário Anônimo -> Cliente Pessoa Física (PF) e Pessoa Jurídica (PJ).
- **Rotas Percorridas**: `/` -> `/login` -> `/login/pessoa-fisica` -> `/cliente/dashboard` -> `/cliente/perfil` -> `/login/empresa/cadastro`.
- **Passos Executados**:
  1. Acessar `/login` e selecionar 'Pessoa Física'.
  2. Digitar CPF de teste válido (`000.000.000-00`) gerado via helper `generateTestCPF()`.
  3. Clicar em "Continuar" (`UI-BTN-001`), verificar transição suave de estado sem recarregar a página para digitação do PIN.
  4. Digitar PIN de 4 dígitos numéricos nos 4 inputs `<PinInput />`.
  5. Acionar submissão (`UI-BTN-002`): interceptar requisição RPC `gsa_auth_login_client`, verificar gravação do token em `localStorage` e inserção de sessão em `sistema_sessoes`.
  6. Redirecionar para `/cliente/dashboard`, atestar renderização do cabeçalho com nome do cliente, saldo em carteira e pontos VIP.
  7. Navegar até `/cliente/perfil`, alterar CEP para `01001-000`, verificar preenchimento automático de logradouro via ViaCEP, alterar telefone e clicar em "Salvar Endereço e Contato" (`UI-BTN-045`).
  8. Comprovar que `clientes.endereco` e `clientes.telefone` foram atualizados no banco de dados.

### 5.2 Jornada E2E-02: Marketplace Completo, Checkout 3 Etapas e Baixa Atômica de Estoque
- **Atores**: Cliente Consumidor Autenticado.
- **Rotas Percorridas**: `/marketplace/loja` -> `/marketplace/loja/produtos/:slug` -> Drawer de Carrinho -> `/marketplace/loja/checkout` -> Modal PIX.
- **Passos Executados**:
  1. Acessar vitrine pública da loja, localizar produto com variantes (ex: Camiseta GSA, com opções Cor e Tamanho).
  2. Selecionar variante Azul / M. Verificar se o preço e estoque disponível atualizam dinamicamente na tela.
  3. Clicar em "Adicionar ao Carrinho" (`UI-BTN-058`). O Drawer do Carrinho abre lateralmente exibindo o item, SKU e quantidade.
  4. Clicar em "Finalizar Compra" (`UI-BTN-019`), navegando para `/marketplace/loja/checkout`.
  5. **Etapa 1 (Endereço & Cupom)**:
     - Endereço vem pré-preenchido do cadastro do cliente.
     - Aplicar cupom de desconto `PRIMEIRACOMPRA` (`UI-FORM-020`). Verificar recalculo do subtotal com 15% OFF.
     - Clicar em "Avançar para Pagamento" (`UI-BTN-015`).
  6. **Etapa 2 (Benefícios & Pagamento)**:
     - Marcar checkbox "Usar Saldo em Carteira" (`saldoCarteiraAplicado = R$ 20,00`).
     - Marcar checkbox "Usar Pontos VIP" (`pontosAplicados = 500`, abatendo R$ 25,00).
     - Selecionar método "PIX" para o saldo remanescente.
     - Clicar em "Avançar para Resumo" (`UI-BTN-016`).
  7. **Etapa 3 (Confirmação Final & ACID Concurrency)**:
     - Conferir resumo consolidado: Subtotal, Desconto do Cupom, Abatimento Carteira, Abatimento Pontos, Frete, Total a Pagar no PIX.
     - Clicar em "Confirmar e Finalizar Pedido" (`UI-BTN-017`).
     - Verificar bloqueio imediato do botão com spinner `Loader2` e trava `isSubmittingRef`.
     - Chamar RPC `gsa_client_checkout_store` com `checkoutRequestId` idempotente.
  8. **Comprovação de Persistência & Propagação**:
     - Modal PIX abre exibindo o QR Code e linha Copia-e-Cola (`UI-BTN-018`).
     - Banco de Dados:
       * `pedidos` criado com status `pendente_pagamento`.
       * `loja_pedido_itens` gravado com `produto_variante_id`.
       * `produto_variantes.estoque_disponivel` decrementado exatamente na quantidade adquirida via lock `FOR UPDATE`.
       * `loja_carrinhos` limpo para o cliente.

### 5.3 Jornada E2E-03: Suporte, Triagem de Demanda, Despacho e Execução pelo Prestador
- **Atores**: Cliente -> Administrador / Colaborador de Operações -> Prestador de Serviços de Campo.
- **Rotas Percorridas**: `/cliente/suporte` -> `/admin/operacoes/orcamentos` -> `/prestador/demandas` -> `/prestador/agenda`.
- **Passos Executados**:
  1. Cliente entra em `/cliente/suporte`, preenche formulário de abertura de chamado (`UI-FORM-025`) com assunto "Instalação de Equipamento Comercial" e clica em "Abrir Ticket" (`UI-BTN-078`).
  2. Administrador acessa `/admin/operacoes/orcamentos`, visualiza o chamado convertido em orçamento comercial pendente.
  3. Administrador define valor total de R$ 350,00 e aprova a proposta (`UI-BTN-108`), gerando a Ordem de Serviço (OS).
  4. Administrador clica em "Despachar para Prestador" (`UI-BTN-066`), selecionando um prestador técnico homologado na região.
  5. Aresta `EDGE-037` é disparada: linha inserida em `prestador_demandas` com status `aberta`.
  6. Prestador faz login em `/login/prestador` e acessa `/prestador/demandas`.
  7. Prestador recebe a notificação em tempo real, visualiza os detalhes técnicos do chamado e clica em "Aceitar Demanda" (`UI-BTN-026`). O status no banco transiciona de `aberta` para `ativa`.
  8. Prestador acessa `/prestador/agenda`, agenda o atendimento para o dia seguinte às 14:00 (`UI-BTN-067`, `UI-FORM-035`).
  9. Após atendimento, prestador preenche relatório de entrega com fotos e observações (`UI-FORM-034`) e clica em "Concluir e Entregar OS" (`UI-BTN-028`). Status passa para `em_analise` e honorários são pré-computados em `prestadores.saldo_retido`.

### 5.4 Jornada E2E-04: Resgate de Convênio, Recusa, Desafio 2FA de Recurso & Julgamento ADM
- **Atores**: Cliente Consumidor -> Administrador de Pessoas/Parceiros -> Notificação WhatsApp VPS.
- **Rotas Percorridas**: `/nossos-parceiros` -> `/consulta-protocolo` -> `/admin/super-domains/pessoas` (Modal de Julgamento).
- **Passos Executados**:
  1. Cliente acessa `/nossos-parceiros`, seleciona parceiro gastronômico e clica em "Resgatar Benefício" (`UI-BTN-014`).
  2. Informa dados no formulário (`UI-FORM-018`). Um protocolo unívoco é gerado (ex: `PROT-RES-2026-981240`) com status inicial `pendente`.
  3. Administrador audita a solicitação e recusa o resgate (`UI-BTN-035`) informando motivo: "Horário de consumo fora do período promocional". Status passa para `recusado`.
  4. Cliente acessa a página pública `/consulta-protocolo`, digita o protocolo (`UI-BTN-010`, `UI-FORM-014`). A tela renderiza o status `recusado` e o botão "Entrar com recurso" (`UI-BTN-011`) é exibido.
  5. Cliente clica em "Entrar com recurso": abre o modal de contestação (`UI-FORM-015`).
  6. Digita justificativa técnica com mais de 20 caracteres ("Estive presente no estabelecimento dentro do horário de almoço conforme cupom fiscal em anexo"), anexa foto do cupom e clica em "Continuar e receber código" (`UI-BTN-012`).
  7. Edge Function `gsa-auth-session` (`request_partner_appeal`) gera o código 2FA de 6 dígitos no banco (`parceiros_resgates_recurso_desafios`) e despacha via WhatsApp.
  8. Cliente digita o código de 6 dígitos e clica em "Confirmar e enviar recurso" (`UI-BTN-013`). Status do protocolo passa para `em_recurso` e evento gravado em `parceiros_resgates_eventos`.
  9. Administrador abre `PartnerRedemptionDetailModal`, visualiza o histórico, as fotos anexadas e o texto do recurso.
  10. Administrador clica em "Aceitar Recurso (Deferir)" (`UI-BTN-036`). A RPC `gsa_admin_decide_partner_appeal` atualiza o status para `deferido`, gera o voucher de liberação e enfileira notificação no WhatsApp garantindo acentuação UTF-8 estrita (sem "Ã§" ou "Ã£o").
  11. A página pública `/consulta-protocolo` atualiza instantaneamente via Supabase Realtime para "Recurso Deferido".

### 5.5 Jornada E2E-05: Cadeia de Suprimentos B2B, Despacho com NF-e de 44 Dígitos & Entrada de Estoque
- **Atores**: Fornecedor Homologado -> Administrador de Compras / Estoque.
- **Rotas Percorridas**: `/fornecedor/login` -> `/fornecedor/dashboard` -> `/admin/fornecedores`.
- **Passos Executados**:
  1. Fornecedor efetua login com CNPJ e PIN em `/fornecedor/login` (`UI-BTN-007`).
  2. Na aba de produtos, clica em "Submeter Novo Produto" (`UI-BTN-030`), preenchendo dados de custo e especificações (`UI-FORM-038`). Status salvo como `pendente`.
  3. Administrador aprova o produto para o catálogo da loja.
  4. Grupo GSA gera um Pedido de Compra (`pedidos_compra`) de 50 unidades.
  5. Fornecedor visualiza o pedido em aberto, clica em "Confirmar Despacho & NF-e" (`UI-BTN-031`, `UI-FORM-039`).
  6. Informa transportadora, código de rastreio, anexa XML da nota e insere a Chave de Acesso de 44 dígitos numéricos.
  7. Testar validação: se a chave tiver 43 dígitos, o sistema impede o envio. Ao completar os 44 dígitos válidos, o pedido transiciona para `em_transito`.
  8. Administrador de compras acessa `/admin/fornecedores`, confere os dados da remessa e clica em "Homologar Recebimento e Integrar Estoque" (`UI-BTN-068`).
  9. RPC `gsa_admin_review_supplier_delivery` incrementa atômica e fisicamente as 50 unidades na tabela `produto_variantes.estoque_disponivel` e emite o título a pagar em `fornecedor_titulos`.

### 5.6 Jornada E2E-06: Programa de Afiliados, Rastreamento de Conversão & Saque com Carência
- **Atores**: Afiliado -> Visitante Convidado -> Administrador de Afiliados.
- **Rotas Percorridas**: `/afiliados/login` -> `/afiliados/dashboard` -> Vitrine Pública com `?ref=...` -> `/marketplace/loja/checkout` -> Painel Administrativo.
- **Passos Executados**:
  1. Afiliado faz login e acessa seu painel `/afiliados/dashboard`.
  2. Clica em "Gerar Link de Divulgação" (`UI-BTN-032`, `UI-FORM-041`), definindo destino `/marketplace/loja` e tag `campanha-natal`.
  3. Código determinístico gerado (ex: `ref=gsa-af-7712`).
  4. Visitante acessa a URL pública com o parâmetro `?ref=gsa-af-7712`.
  5. O componente `AffiliateTrackingBridge` captura a query string no carregamento, registra o clique em `gsa_afiliado_cliques` via RPC `gsa_public_record_affiliate_click` e armazena o token nos cookies / localStorage.
  6. Visitante conclui uma compra de R$ 200,00 na loja.
  7. Gatilho do banco de dados computa a comissão de 10% (R$ 20,00) em `afiliado_comissoes` com status `em_carencia` e data de liberação calculada para `created_at + interval '30 days'`.
  8. Painel do afiliado exibe R$ 20,00 em "Comissões em Carência".
  9. Testar tentativa de saque imediato: sistema recusa com `Saldo disponível insuficiente (comissões em carência)`.
  10. Simulação administrativa (avanço temporal de 30 dias): Administrador clica em "Liberar Comissões em Carência" (`UI-BTN-064`). O saldo migra para `gsa_afiliados.saldo_comissao` liberado.
  11. Afiliado solicita saque PIX de R$ 20,00 (`UI-BTN-033`, `UI-FORM-042`). Pedido registrado com sucesso em `gsa_afiliado_saques`.

---

## 6. GUIA DE COMANDOS E SCRIPTS DE EXECUÇÃO PARA O WORKER

Para que os relatórios `RELATORIO_TESTES_UI.md` e `RELATORIO_E2E.md` sejam gerados com métricas e logs autênticos, o Worker deve executar a seguinte sequência estruturada:

### 6.1 Pré-requisitos e Execução do Servidor Local
```powershell
# 1. Certificar que as dependências estão íntegras
npm install

# 2. Iniciar a aplicação localmente na porta 3000 (em background / task)
npm run dev
```

### 6.2 Bateria de Testes de UI & Formulários (Vitest & Scripts)
```powershell
# 1. Executar suíte de contratos de UI e formulários
npx vitest run src/tests/whatsapp-health-monitor-ui.test.tsx
npx vitest run src/tests/foundations-shared-components.test.ts
npx vitest run src/tests/marketplace-pricing-integrity.test.ts
npx vitest run src/tests/partner-redemption-edge-cases.test.ts

# 2. Executar checagens de contratos de interface pública e portais
npx tsx scripts/check-home-public-contracts.ts
npx tsx scripts/check-client-portal-security-contracts.ts
npx tsx scripts/check-restricted-access-hub.ts
npx tsx scripts/check-provider-portal-security-contracts.ts
npx tsx scripts/check-supplier-procurement-contracts.ts
npx tsx scripts/check-affiliate-contracts.ts
npx tsx scripts/check-gsa-store-experience.ts
npx tsx scripts/check-free-tools-contracts.ts
npx tsx scripts/check-advertising-foundation.ts
npx tsx scripts/check-advertising-completion.ts
npx tsx scripts/check-careers-contracts.ts
npx tsx scripts/check-gsa-travel-contracts.ts
npx tsx scripts/check-gsa-tv-contracts.ts
```

### 6.3 Bateria de Testes End-to-End no Navegador (Playwright)
```powershell
# 1. Smoke test de todas as rotas públicas (validação de ausência de crashes e boundaries)
npx playwright test tests/e2e/1-public-smoke.spec.ts --reporter=list

# 2. Executar as jornadas automatizadas do painel do cliente
npx playwright test tests/e2e/2-painel-cliente.spec.ts --reporter=list

# 3. Executar as jornadas administrativas de governança e controle
npx playwright test tests/e2e/3-painel-admin.spec.ts --reporter=list

# 4. Executar as jornadas operacionais do prestador técnico
npx playwright test tests/e2e/4-painel-prestador.spec.ts --reporter=list

# 5. Executar jornada completa com geração sintética de CPF e cadastro real
$env:ALLOW_REAL_DATA_STRESS_TEST="true"
npx playwright test tests/e2e/0-stress-real-data.spec.ts --reporter=list
$env:ALLOW_REAL_DATA_STRESS_TEST=""
```

---

## 7. CRITÉRIOS DE CONCILIAÇÃO E TRANSIÇÃO DE STATUS PARA OS RELATÓRIOS M2

Ao preencher `RELATORIO_TESTES_UI.md` e `RELATORIO_E2E.md`, a equipe deve respeitar a tabela de transição de status para garantir 100% de rastreabilidade matemática com `INVENTARIO_COMPLETO.md`:

| Status em M1 | Condição para Transição em M2 | Novo Status Oficial em M2 | Justificativa Obrigatória |
|---|---|---|---|
| `ANALISADO ESTATICAMENTE` | O elemento/form/rota foi submetido a teste dinâmico automatizado com assert aprovado. | **`VALIDADO`** | Registrar comando, nome do teste e asserção correspondente. |
| `ANALISADO ESTATICAMENTE` | O teste dinâmico foi executado e encontrou falha real de validação ou erro de runtime. | **`FALHOU`** | Registrar log verbatim da falha e abrir registro em `RELATORIO_BUGS.md`. |
| `FALHOU` | A causa raiz foi identificada, o código corrigido e o teste reexecutado com sucesso. | **`CORRIGIDO E RETESTADO`** | Vincular commit/diff e evidência do reteste verde. |
| `ANALISADO ESTATICAMENTE` | Dependência externa indisponível localmente (ex: hardware RTMP de TV ou gateway bancário em produção). | **`BLOQUEADO`** | Explicar o motivo técnico concreto que impede a execução local. |

---

## 8. CONCLUSÃO DA INVESTIGAÇÃO

A arquitetura de UI do GSA HUB possui bases sólidas de validação de formulários (com bibliotecas robustas de mascaramento e algoritmos estritos de validação de CPF, CNPJ e e-mail), proteções de concorrência em botões (`isSubmittingRef`, UUIDs de requisição) e isolamento visual através de `ErrorBoundary`.

Com a correção do seletor nos testes legados de login do Playwright e a execução orquestrada das 6 jornadas descritas neste documento, os entregáveis `RELATORIO_TESTES_UI.md` e `RELATORIO_E2E.md` refletirão com precisão e genuinidade a qualidade operacional do sistema Grupo GSA.
