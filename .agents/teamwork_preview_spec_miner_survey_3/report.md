# Relatório de Mineração de Especificação: Taxonomia, Classificação de Bugs e Reconciliação Matemática dos 9 Relatórios

**Agente**: `teamwork_preview_spec_miner_survey_3`  
**Data**: 2026-09-16  
**Diretório de Trabalho**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_spec_miner_survey_3`  
**Parent / Orquestrador**: `29ed6a3b-461f-4d8c-bac2-2ee5a0db41cf` (`teamwork_preview_orchestrator_34`)  
**Referências Normativas**:
- `ORIGINAL_REQUEST.md` (especificamente `## 2026-09-16T16:21:01Z` — Requisitos R3 e R4)
- `INVENTARIO_COMPLETO.md` (Inventário Canônico M1 — 1.377 elementos)
- `GRAFO_CONEXOES.md` (Topologia de Conexões — 80 arestas `EDGE-001` a `EDGE-080`)
- `RELATORIO_BUGS.md` e `RELATORIO_CORRECOES.md`
- Os 9 relatórios na raiz do projeto: `MATRIZ_TESTES_CONEXOES.md`, `RELATORIO_E2E.md`, `RELATORIO_TESTES_API.md`, `RELATORIO_BANCO.md`, `RELATORIO_REGRESSAO.md`, `SEGUNDA_VARREDURA.md`, `PENDENCIAS_E_BLOQUEIOS.md`, `METRICAS_FINAIS.md`, `RELATORIO_FINAL_AUDITORIA.md`

---

## 1. Sumário Executivo

Este relatório apresenta a auditoria forense de especificação dos 9 relatórios gerados nos Milestones M1 a M4, focando na **Aderência Estrita à Taxonomia Canônica (R3)**, na **Classificação Categórica dos Bugs BUG-001 a BUG-006 como Bugs da Suíte de Teste (R3)**, no **Mapeamento Exato do Inventário de 1.377 Elementos Estruturais e 80 Arestas de Conexão**, e no estabelecimento das **Fórmulas de Reconciliação Matemática Invariante** que devem ser aplicadas uniformemente para que todos os relatórios convirjam sem nenhuma inconsistência ou discrepância numérica.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Taxonomia Canônica | Sistema dos 7 Status Canônicos | Conjunto unificado, fechado e mutuamente exclusivo de status para cada item auditado no sistema | Item de teste/inventário + evidência de execução | Status atribuído dentre os 7 canônicos | Rejeição de termos não-canônicos (ex: "VALIDADO", "PASSOU", "PARCIAL") | `ORIGINAL_REQUEST.md` § R3 |
| 2 | Taxonomia Canônica | Status `DESCOBERTO` | Item identificado durante varredura, ainda não analisado estaticamente nem executado dinamicamente | Código-fonte ou rota encontrada | Registro com ID canônico | Não pode ser alegado como testado | `ORIGINAL_REQUEST.md` § R3 |
| 3 | Taxonomia Canônica | Status `ANALISADO ESTATICAMENTE` | Item cujo código, AST, contrato de tipagem ou schema SQL foi inspecionado, sem execução de runtime | Arquivo de código, schema SQL ou endpoint | Confirmação de assinatura/estrutura | Não comprova persistência nem propagação em runtime | `ORIGINAL_REQUEST.md` § R3, `INVENTARIO_COMPLETO.md` |
| 4 | Taxonomia Canônica | Status `EXECUTADO DINAMICAMENTE — PASSOU` | Item executado em runtime com entrada válida, cuja asserção real passou e persistência/propagação foi observada | Execução de teste Playwright / API / SQL com asserções | Log de asserção verde + persistência no DB | Falha se asserção não existir ou falhar | `ORIGINAL_REQUEST.md` § R3, `RELATORIO_E2E.md` |
| 5 | Taxonomia Canônica | Status `EXECUTADO DINAMICAMENTE — FALHOU` | Item submetido a teste em runtime que falhou por asserção contrariada, exceção não tratada ou timeout | Execução com entrada válida ou inválida | Log de erro / stack trace / asserção falha | Identifica defeito a ser categorizado | `ORIGINAL_REQUEST.md` § R3 |
| 6 | Taxonomia Canônica | Status `CORRIGIDO E RETESTADO` | Item que falhou, teve causa raiz identificada, recebeu correção pontual e passou em reteste e regressão | Patch de código + suíte de teste associada | Prova de reprodução inicial + prova de passe posterior | Rejeita correções sem teste de regressão | `ORIGINAL_REQUEST.md` § R3, Regra de Ouro 7 e 8 |
| 7 | Taxonomia Canônica | Status `BLOQUEADO` | Item que não pôde ser executado dinamicamente devido a impedimento técnico externo concreto (ex: falta de banco seed local) | Dependência bloqueante documentada | Registro formal de bloqueio com justificativa | Obrigatório para qualquer `test.skip`; proibido mascarar | `ORIGINAL_REQUEST.md` § R3, Regra de Ouro 12 |
| 8 | Taxonomia Canônica | Status `NÃO TESTADO` | Item descoberto no inventário para o qual não houve tentativa de execução nem justificativa de bloqueio técnico | Item inventariado | Registro neutro de cobertura pendente | Não deve ser ocultado para inflar percentual | `ORIGINAL_REQUEST.md` § R3 |
| 9 | Classificação de Defeitos | `BUG DA SUÍTE DE TESTE` | Falha localizada exclusivamente em arquivos de testes (`tests/`, `scripts/`), seletores quebrados, dados de teste inválidos ou bypasses | Script de teste com vício de implementação | Correção restrita a arquivos de teste (zero alteração em `src/`) | Classificação errônea como bug do sistema distorce saúde do produto | `ORIGINAL_REQUEST.md` § R3, `RELATORIO_BUGS.md` |
| 10 | Classificação de Defeitos | `BUG DO SISTEMA` | Defeito lógico, vulnerabilidade de segurança, crash ou inconsistência transacional no código da aplicação (`src/`, banco, Edge, VPS) | Código de produção com falha | Patch em arquivo de produção com reteste | Nenhuma das ocorrências BUG-001..BUG-006 se enquadra aqui | `ORIGINAL_REQUEST.md` § R3 |
| 11 | Classificação de Defeitos | `PROBLEMA DE INFRAESTRUTURA` | Ausência ou configuração inadequada de ambiente de suporte à execução (ex: falta de banco isolado com seed, credenciais de serviço) | Falta de container, porta, seed SQL | Provisão do ambiente isolado (ex: `supabase start`) | Não é bug de código do sistema nem da suíte de teste | `ORIGINAL_REQUEST.md` § R3, BUG-007 |
| 12 | Classificação de Defeitos | `DESCOBERTA ARQUITETURAL` | Comportamento legítimo do sistema que colide com presunção errônea do autor do teste (ex: `/login` ser LoginHub em vez de formulário) | Análise de arquitetura e UI real | Adequação do roteiro de teste à realidade arquitetural | Não deve ser rotulado como defeito de código | `ORIGINAL_REQUEST.md` § R3, BUG-004, BUG-008 |
| 13 | Mapeamento Estrutural | Universo de 1.377 Elementos do Inventário | Catálogo estrito dos 1.377 itens catalogados em `INVENTARIO_COMPLETO.md` distribuídos em 11 categorias | Varredura do repositório (`src/`, `supabase/`, scripts) | Tabela reconciliada de 1.377 elementos | Proibido inflar com RLS ou arestas | `INVENTARIO_COMPLETO.md` |
| 14 | Mapeamento Topológico | Universo de 80 Arestas de Conexão | Grafo topológico contendo exatamente 80 arestas (`EDGE-001` a `EDGE-080`) conectando 5 camadas arquiteturais | Mapeamento UI → Hook → Service → API/RPC → DB | Matriz de rastreabilidade de 80 arestas | Não pode ser somado diretamente ao inventário estrutural de 1.377 | `GRAFO_CONEXOES.md` |
| 15 | Reconciliação Matemática | Invariante de Partição Unívoca | Todo elemento do inventário ou aresta de conexão pertence a exatamente 1 status canônico no instante $t$ | Identificador do elemento + matriz de status | Soma dos subgrupos igual a 1.377 (itens) e 80 (arestas) | Discrepância numérica invalida o relatório | `ORIGINAL_REQUEST.md` § R4, Regra de Ouro 13 |
| 16 | Reconciliação Matemática | Desacoplamento de Universos | Separação rigorosa entre entidades estruturais (1.377), conexões de grafo (80), regras de RLS (186) e testes E2E (30) | Categorias de auditoria | 4 tabelas de conciliação separadas | Elimina o número fantasma 1.643 | `METRICAS_FINAIS.md`, `RELATORIO_FINAL_AUDITORIA.md` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Módulo 11 CPF | Input `'000.000.000-00'` em `validarCPF` | Retorna `false` devido à rejeição de 11 dígitos repetidos (`/^(\d)\1{10}$/`). O teste antigo considerava isso um bug do sistema, mas era dado de teste inválido (`BUG-002`). |
| 2 | Módulo 11 CPF | Input `'111.111.111-11'` em `validarCPF` | Retorna `false` pela mesma regra de dígitos iguais, sem alcançar o teste dos dígitos verificadores `d1/d2` (`BUG-003`). |
| 3 | Módulo 11 CPF | Input `'529.982.247-25'` em `validarCPF` | Retorna `true` porque os verificadores calculados coincidem com `2` e `5`. Ao ser submetido na UI real de produção, avançou para PIN pois o CPF já existia na base (`BUG-008`). |
| 4 | Roteamento Login | Navegação para `/login` esperando campo de CPF | A rota `/login` monta `LoginHub.tsx` com botões seletores de portal (PF, PJ, Prestador). O campo de CPF só existe em `/login/pessoa-fisica`. A suíte falhava por seletor em rota incorreta (`BUG-004`). |
| 5 | Playwright Strict Mode | `page.locator('input[type="password"]')` em tela de PIN | Falha com `strict mode violation: resolved to 4 elements` porque o `PinInput` renderiza 4 campos individuais. Exige `.first()` ou seleção indexada (`BUG-005`). |
| 6 | Anti-cheating | `if (await docInput.count() > 0)` em asserção | O teste passava com verde falso se o elemento não fosse renderizado. Deve ser substituído por `await expect(docInput).toBeVisible({ timeout: 15000 })` (`BUG-001`). |
| 7 | Supressão de Erros | `.catch(() => null)` em interações assíncronas de teste | Oculta falhas reais de navegação ou timeout, gerando status falso positivo. Deve ser eliminado da suíte (`BUG-006`). |
| 8 | Tratamento de `test.skip` | Teste marcado com `test.skip` por falta de banco seed | Classificação errônea anterior rotulava como "testado". A taxonomia canônica exige classificação estrita como `BLOQUEADO` com justificativa técnica. |
| 9 | Soma de Categorias Mistas | Somar 1.377 itens estruturais + 80 arestas + 186 RLS | Gera total de 1.643 itens, misturando elementos atômicos com relacionamentos e regras de segurança, gerando equações impossíveis de reconciliar entre relatórios. |

---

## 2. Auditoria Exaustiva de Divergências da Taxonomia nos 9 Relatórios

A análise dos 9 relatórios na raiz do projeto revela uma profunda heterogeneidade de vocabulário, com termos ad-hoc criados por diferentes agentes executores, violando o Requisito R3. Abaixo está o diagnóstico detalhado por documento:

### 2.1 `MATRIZ_TESTES_CONEXOES.md` (1.745 linhas)
- **Status Predominante Atual**: `ANALISADO ESTATICAMENTE` aplicado indistintamente a todas as 80 arestas (`EDGE-001` a `EDGE-080`).
- **Divergências Encontradas**:
  - Utiliza termos operacionais de especificação como "Cenário Positivo (Happy Path)" e "Cenário Negativo / Tratamento de Falhas", mas mantém o status global congelado em `ANALISADO ESTATICAMENTE`.
  - Não faz a transição formal para os status dinâmicos quando os testes são implementados.
- **Ação Corretiva Exigida**: Na fase de remediação dinâmica (R2), cada uma das 80 arestas deve receber o status canônico correspondente à sua execução (`EXECUTADO DINAMICAMENTE — PASSOU`, `EXECUTADO DINAMICAMENTE — FALHOU` ou `BLOQUEADO`), acompanhado do hash do log de execução.

### 2.2 `RELATORIO_E2E.md` (160 linhas)
- **Status Atuais**: `Passed`, `✅ PASSOU`, `PARCIAL`, `Skipped`, `⏭️ SKIP`, `BLOQUEADO`.
- **Divergências Encontradas**:
  - Uso de termos em inglês (`Passed`, `Skipped`, `skip`).
  - No Sumário Executivo (linhas 17-24): utiliza `Passed` (24), `Skipped` (6). O termo `Passed` deve ser substituído por `EXECUTADO DINAMICAMENTE — PASSOU`.
  - Na Seção 4 (Jornadas Críticas, linha 121): jornada `E2E-01` é classificada como `PARCIAL`. O status "PARCIAL" **não existe** na taxonomia canônica. Deve ser classificada de acordo com suas etapas atômicas: as etapas executadas são `EXECUTADO DINAMICAMENTE — PASSOU` e as etapas dependentes de seed são `BLOQUEADO`.
  - `Skipped` (linhas 88, 89, 99, 100, 110, 111): deve ser formalmente registrado como `BLOQUEADO`.

### 2.3 `RELATORIO_TESTES_API.md` (151 linhas)
- **Status Atuais**: `Validado Dinamicamente`, `**VALIDADO**`, `100% Auditado`, `Falhas Reais de Encoding`, `Falhas Catalogadas M2`.
- **Divergências Encontradas**:
  - As 17 Edge Functions, 15 rotas de Webhooks e 10 APIs externas são rotuladas como `VALIDADO`. O termo "VALIDADO" não integra a taxonomia canônica.
  - Inconsistência interna grave: na tabela da Seção 1 (linha 21), indica 41 Validados + 1 Falha de Encoding. Contudo, na tabela detalhada da Seção 4 (linhas 94-103), todos os 10 endpoints `API-END-*` aparecem marcados como `**VALIDADO**`.
  - Se a execução ocorreu via request/response em runtime, o status deve ser `EXECUTADO DINAMICAMENTE — PASSOU` ou `EXECUTADO DINAMICAMENTE — FALHOU`. Se foi apenas análise de contrato de código estático por falta de servidor local, o status deve ser `ANALISADO ESTATICAMENTE` ou `BLOQUEADO`.

### 2.4 `RELATORIO_BANCO.md` (238 linhas)
- **Status Atuais**: `Validado Dinamicamente em M2`, `**VALIDADO**`, `100% Auditado`, `BLOQUEADO (Hardware)`.
- **Divergências Encontradas**:
  - Todas as 294 tabelas (`DB-TBL-*`) e 692 RPCs (`DB-RPC-*`) receberam o rótulo `**VALIDADO**` com base em scripts de verificação estática de schema (`validate-db-schema.cjs --snapshot-only`), gerando uma falsa equivalência entre verificação de schema e teste dinâmico.
  - Na tabela da Seção 1 (linha 29), afirma: `Total Consolidado de Dados: 986 | Validado Dinamicamente: 985 | Falhas: 0 | Bloqueado: 1`. Ora, 294 + 692 = 986. O 1 item "Bloqueado" era na verdade a `EDGE-054` (da GSA TV, que é uma aresta de conexão, e não uma tabela ou RPC). Isso contamina os dados do banco com dados do grafo.

### 2.5 `RELATORIO_REGRESSAO.md` (110 linhas)
- **Status Atuais**: `passed`, `skip`, `BLOQUEADO`, `Executado`, `HTTP 200`.
- **Divergências Encontradas**:
  - Utiliza `passed` e `skip` para os testes do Playwright em vez de `EXECUTADO DINAMICAMENTE — PASSOU` e `BLOQUEADO`.
  - TypeCheck e Lint marcados como `⚠️ BLOQUEADO`.

### 2.6 `SEGUNDA_VARREDURA.md` (155 linhas)
- **Status Atuais**: `VALIDADO`, `FALHOU`, `NÃO TESTADO`, `INDIRETO`, `INALTERADO`, `APROVADA`.
- **Divergências Encontradas**:
  - Seção 3.2: rotula histórico como `FALHOU (seletor errado)`, `NÃO TESTADO` e `INDIRETO`.
  - Seção 4: utiliza `INALTERADO` para tabelas, RPCs, Edge Functions e componentes UI. Embora reflita que nenhum arquivo de produção foi modificado no M3, o status de conformidade de cada item com a taxonomia canônica foi omitido.
  - Seção 4.4: agrega "Módulos (15 + outros): 105", misturando módulos (15), tabelas/grids (42) e modais (48).

### 2.7 `PENDENCIAS_E_BLOQUEIOS.md` (147 linhas)
- **Status Atuais**: `Testado Dinamicamente`, `0 dinâmico`, `estática`, `BLOQUEADO`, `NÃO TESTADO`.
- **Divergências Encontradas e Quebra Arquitetural**:
  - Inconsistência radical com os relatórios M2: enquanto `RELATORIO_BANCO.md` declarou que 985 itens de banco estavam validados, `PENDENCIAS_E_BLOQUEIOS.md` (linha 23) declarou que todos os 986 itens de banco estavam `BLOQUEADO`. Da mesma forma, as 17 Edge Functions e 15 Webhooks passaram de validados para bloqueados sem justificativa de transição técnica, violando a regra: *"Um item não pode mudar de categoria entre relatórios sem explicação técnica explícita."*
  - Erro aritmético interno: na tabela da Seção 1 (linha 24), lista: `Testado Dinamicamente: 26 | BLOQUEADO: 1.039 | NÃO TESTADO: 6 | TOTAL: 1.066`. Contudo, $26 + 1.039 + 6 = 1.071 \neq 1.066$. Além disso, 1.066 deixa de fora 311 itens do inventário original de 1.377.

### 2.8 `METRICAS_FINAIS.md` (175 linhas)
- **Status Atuais**: `Passed`, `Failed`, `Skipped`, `Auditado`, `Estática`, `Cobertura Dinâmica`.
- **Divergências Encontradas e Contradição de Totais**:
  - Seção 1 (linha 28): define o total inventariado como `1.643` somando arbitrariamente 1.377 itens + 186 RLS + 80 Arestas.
  - Seção 5 (linha 125): afirma que $1.643 = 30 \text{ testados} + 1.039 \text{ bloqueados} + 574 \text{ estáticos}$.
  - Seção 6 (linha 174): apresenta uma tabela cujo total é `1.320` ($21 \text{ dinâmica} + 1.294 \text{ estática} + 5 \text{ bloqueado} = 1.320$).
  - Três totais contraditórios em um único documento oficial (1.643 vs 1.320 vs 1.377)!

### 2.9 `RELATORIO_FINAL_AUDITORIA.md` (205 linhas)
- **Status Atuais**: `Passed`, `Failed`, `Skipped`, `APROVADO`, `Testados via E2E Playwright`, `Auditados via análise estática`, `BLOQUEADOS`.
- **Divergências Encontradas**:
  - Perpetua o total de 1.643 itens e a equação incompatível:
    $1.643 = 30 \text{ testados} + 1.294 \text{ estáticos} + 319 \text{ bloqueados}$.
    (Note que em `METRICAS_FINAIS.md` eram 1.039 bloqueados e 574 estáticos, e aqui mudou para 319 bloqueados e 1.294 estáticos sem explicação técnica!).

---

## 3. Análise Detalhada dos Bugs Históricos BUG-001 a BUG-008

O Requisito R3 estabelece:
> *"Separar claramente na classificação de problemas: `BUG DO SISTEMA`, `BUG DA SUÍTE DE TESTE`, `PROBLEMA DE INFRAESTRUTURA`, e `DESCOBERTA ARQUITETURAL`. Corrigir a contabilização dos BUG-001 a BUG-006 antigos, que eram `BUG DA SUÍTE DE TESTE`."*

Abaixo está a análise técnica exaustiva de cada bug, comprovando por que BUG-001 a BUG-006 são estritamente **BUGS DA SUÍTE DE TESTE**:

```
+---------------------------------------------------------------------------------------------------+
| MAPEAMENTO E CLASSIFICAÇÃO RIGOROSA DOS PROBLEMAS IDENTIFICADOS                                  |
+---------+------------------------------------------------------+-------------------+--------------+
| ID      | Descrição Técnica do Defeito                         | Classificação R3  | Arquivo      |
+---------+------------------------------------------------------+-------------------+--------------+
| BUG-001 | Bypass condicional `if (await docInput.count() > 0)` | BUG DA SUÍTE      | spec.ts      |
| BUG-002 | CPF `'000.000.000-00'` inválido por módulo 11        | BUG DA SUÍTE      | spec.ts      |
| BUG-003 | CPF `'111.111.111-11'` dígitos repetidos no neg.     | BUG DA SUÍTE      | spec.ts      |
| BUG-004 | Seletor de input CPF apontando para rota `/login`    | BUG DA SUÍTE      | spec.ts      |
| BUG-005 | Strict mode violation no locator de PIN sem .first() | BUG DA SUÍTE      | spec.ts      |
| BUG-006 | Bypasses condicionais e .catch() em outros 3 specs   | BUG DA SUÍTE      | spec.ts      |
| BUG-007 | Ausência de banco local com seed determinístico      | INFRAESTRUTURA    | Ambiente     |
| BUG-008 | CPF sintético colidindo com cliente real de prod.    | DESCOB. ARQUITET. | Banco/Prod   |
+---------+------------------------------------------------------+-------------------+--------------+
```

### 3.1 BUG-001 — Bypass Condicional em `1-auth-e-publico.spec.ts`
- **Arquivo Afetado**: `tests/e2e/1-auth-e-publico.spec.ts` (linha 17 original).
- **Código Problemático**: `if (await docInput.count() > 0) { await docInput.fill(...); }`
- **Análise da Aplicação**: O componente de input de CPF em `src/pages/ClientLoginPage.tsx` estava perfeitamente implementado. A falha foi o autor do teste ter inserido uma cláusula condicional que pulava silenciosamente a interação se o elemento tardasse a carregar ou se estivesse na rota errada. O teste gerava um falso verde.
- **Por que é `BUG DA SUÍTE DE TESTE`**: O código da aplicação GSA HUB estava correto. A falha residia inteiramente na lógica do teste automatizado que violava o princípio de asserção garantida (anti-cheating).
- **Correção Aplicada**: Substituição por `await expect(docInput).toBeVisible({ timeout: 15000 })`. Zero linhas de `src/` modificadas.

### 3.2 BUG-002 — Dado de Teste Sinteticamente Inválido (`'000.000.000-00'`)
- **Arquivo Afetado**: `tests/e2e/1-auth-e-publico.spec.ts` (linha 23 original).
- **Código Problemático**: Tentativa de submeter `'000.000.000-00'` como um CPF válido.
- **Análise da Aplicação**: A função de validação oficial `validarCPF` em `src/utils/cpfValidator.ts` rejeita explicitamente qualquer string com 11 dígitos idênticos (`/^(\d)\1{10}$/`), de acordo com as regras oficiais da Receita Federal do Brasil. A aplicação agiu com 100% de correção matemática ao recusar o documento.
- **Por que é `BUG DA SUÍTE DE TESTE`**: O teste usou massa de dados falsa que contrariava a especificação do negócio. O sistema não possuía nenhum bug; o bug estava na fixture do teste.
- **Correção Aplicada**: Substituição por `'529.982.247-25'`, cujo módulo 11 é matematicamente válido. Zero linhas de `src/` modificadas.

### 3.3 BUG-003 — Dado de Teste Inadequado para Teste Negativo (`'111.111.111-11'`)
- **Arquivo Afetado**: `tests/e2e/1-auth-e-publico.spec.ts` (linha 19 original).
- **Código Problemático**: Submissão de `'111.111.111-11'` para testar a rejeição de dígitos verificadores `d1/d2`.
- **Análise da Aplicação**: O sistema rejeitou o CPF na validação de dígitos repetidos antes de calcular o módulo 11. O teste não estava testando o algoritmo de checksum de dois dígitos, mas sim a mesma regra de dígitos iguais do BUG-002.
- **Por que é `BUG DA SUÍTE DE TESTE`**: Elaboração deficiente do caso de teste de limite/exceção. A lógica de produção estava impecável.
- **Correção Aplicada**: Substituição por `'123.456.789-09'` (dígitos distintos válidos no corpo, mas verificadores matematicamente incorretos). Zero linhas de `src/` modificadas.

### 3.4 BUG-004 — Seletor Apontando para Rota Incorreta (`/login`)
- **Arquivos Afetados**: `1-auth-e-publico.spec.ts`, `2-painel-cliente.spec.ts`, `3-painel-admin.spec.ts`, `4-painel-prestador.spec.ts`.
- **Código Problemático**: `await page.goto('/login'); await page.locator('input[placeholder*="CPF"]').fill(...);`
- **Análise da Aplicação**: A arquitetura do sistema define que `/login` é o `LoginHub.tsx`, um ponto central de escolha de perfil com cartões e botões clicáveis. O formulário específico de login com CPF reside na rota filha `/login/pessoa-fisica`.
- **Por que é `BUG DA SUÍTE DE TESTE`**: O autor do teste fez uma suposição arquitetural errônea sobre a rota e tentou buscar um input inexistente no `LoginHub`.
- **Correção Aplicada**: Navegação ajustada para `/login/pessoa-fisica`. Zero linhas de `src/` modificadas.

### 3.5 BUG-005 — Strict Mode Violation no Seletor de PIN
- **Arquivo Afetado**: `tests/e2e/1-auth-e-publico.spec.ts` (linha 102).
- **Código Problemático**: `page.locator('input[type="password"]')`
- **Análise da Aplicação**: O componente `PinInput.tsx` renderiza 4 inputs independentes para os 4 dígitos do PIN. O Playwright ativa o Strict Mode por padrão e lança erro ao encontrar múltiplos elementos correspondentes a um único locator.
- **Por que é `BUG DA SUÍTE DE TESTE`**: Má formulação do seletor Playwright. O componente de UI segue os padrões modernos de acessibilidade e usabilidade para campos de PIN bancário.
- **Correção Aplicada**: Uso de `.first()` ou seletores específicos por índice (`nth(0)` a `nth(3)`). Zero linhas de `src/` modificadas.

### 3.6 BUG-006 — Bypasses e Supressões em Lote nos Demais Specs
- **Arquivos Afetados**: `2-painel-cliente.spec.ts`, `3-painel-admin.spec.ts`, `4-painel-prestador.spec.ts`.
- **Código Problemático**: Propagação de múltiplos `if (count > 0)` e `.catch(() => null)`.
- **Análise da Aplicação**: Todas as rotas envolvidas (`/cliente`, `/admin`, `/prestador`) renderizavam normalmente seus elementos e guards de autenticação. Os testes continham código defensivo inadequado que mascarava o comportamento real da aplicação.
- **Por que é `BUG DA SUÍTE DE TESTE`**: Vício metodológico na construção da suíte de teste.
- **Correção Aplicada**: Remoção integral dos bypasses, adição de asserções explícitas e marcação de dependências não provisionadas como `test.skip`. Zero linhas de `src/` modificadas.

### 3.7 BUG-007 e BUG-008 — Infraestrutura e Descoberta Arquitetural
- **BUG-007 (`PROBLEMA DE INFRAESTRUTURA`)**: As jornadas `E2E-02` a `E2E-06` não puderam ser executadas de ponta a ponta não por causa de defeitos de código, mas porque não havia um banco local isolado com seed determinístico. A execução direta contra produção criaria dados corrompidos. Portanto, é um impedimento de infraestrutura.
- **BUG-008 (`DESCOBERTA ARQUITETURAL`)**: O CPF `'529.982.247-25'`, gerado sinteticamente, existia no banco de dados de produção. Trata-se de uma constatação de colisão com dados pré-existentes no ambiente de homologação/produção, e não de um defeito funcional do software.

**Conclusão Categórica de Bugs**:
- `BUG DO SISTEMA`: **0** (Zero)
- `BUG DA SUÍTE DE TESTE`: **6** (`BUG-001` a `BUG-006`)
- `PROBLEMA DE INFRAESTRUTURA`: **1** (`BUG-007`)
- `DESCOBERTA ARQUITETURAL`: **1** (`BUG-008`)
- **Total de Ocorrências**: **8**

---

## 4. Mapeamento Estrutural do Inventário (1.377 Itens) e Conexões (80 Arestas)

Para eliminar definitivamente o conflito entre 1.377 e 1.643 itens, a especificação estabelece formalmente a separação dos seguintes universos:

### 4.1 Universo do Inventário Estrutural ($U_{\text{inv}}$): 1.377 Itens

O inventário de entidades estruturais é composto estritamente pelos 1.377 elementos catalogados em `INVENTARIO_COMPLETO.md`, divididos em 3 camadas e 11 categorias canônicas:

```
+---------------------------------------------------------------------------------------------------------+
| UNIVERSO ESTRUTURAL DO INVENTÁRIO (1.377 ELEMENTOS)                                                     |
+-------------------+-----------------------------------------+------------------+------------------------+
| Camada            | Categoria de Elemento                   | Prefixo de ID    | Quantidade Exata       |
+-------------------+-----------------------------------------+------------------+------------------------+
| 1. Frontend UI    | Super-Domínios / Módulos de Alto Nível  | `UI-MOD-*`       | 15 módulos             |
|                   | Telas, Rotas e Subvisões do Roteador    | `UI-PAGE-*`      | 72 telas/rotas         |
|                   | Formulários Estruturados com Validação  | `UI-FORM-*`      | 54 formulários         |
|                   | Botões Críticos e Disparadores de Ação  | `UI-BTN-*`       | 118 botões             |
|                   | Tabelas de Dados e Grids Operacionais   | `UI-TBL-*`       | 42 tabelas             |
|                   | Modais, Drawers e Caixas de Diálogo     | `UI-MDL-*`       | 48 modais              |
|                   | **Subtotal Frontend UI**                | —                | **349 elementos**      |
+-------------------+-----------------------------------------+------------------+------------------------+
| 2. Backend & DB   | Tabelas Relacionais PostgreSQL (17 dom.)| `DB-TBL-*`       | 294 tabelas            |
|                   | Stored Procedures / RPCs Transacionais  | `DB-RPC-*`       | 692 RPCs               |
|                   | **Subtotal Backend & DB**               | —                | **986 elementos**      |
+-------------------+-----------------------------------------+------------------+------------------------+
| 3. Backend & APIs | Supabase Edge Functions Serverless      | `API-EDGE-*`     | 17 funções             |
|                   | Rotas e Webhooks do Microserviço VPS    | `API-WH-*`       | 15 rotas               |
|                   | Endpoints de Integrações Externas       | `API-END-*`      | 10 integrações         |
|                   | **Subtotal Backend & APIs**             | —                | **42 interfaces**      |
+-------------------+-----------------------------------------+------------------+------------------------+
| TOTAL GERAL       | **Elementos Estruturais do Sistema**    | —                | **1.377 elementos**    |
+-------------------+-----------------------------------------+------------------+------------------------+
```

### 4.2 Universo Topológico de Conexões ($U_{\text{conn}}$): 80 Arestas

O Grafo de Conexões documentado em `GRAFO_CONEXOES.md` possui exatamente **80 arestas canônicas** (`EDGE-001` a `EDGE-080`) distribuídas em 14 domínios funcionais:
- Domínio 1 (Autenticação & Sessões): 3 arestas (`EDGE-001` a `EDGE-003`)
- Domínio 2 (Governança & Acessos): 2 arestas (`EDGE-004` a `EDGE-005`)
- Domínio 3 (Governança & Segurança): 1 aresta (`EDGE-006`)
- Domínio 4 (Governança & Configurações): 1 aresta (`EDGE-007`)
- Domínio 5 (CRM & Clientes): 4 arestas (`EDGE-008` a `EDGE-011`)
- Domínio 6 (Financeiro & Fintech): 11 arestas (`EDGE-012` a `EDGE-022`)
- Domínio 7 (Marketplace & E-commerce): 6 arestas (`EDGE-023` a `EDGE-028`)
- Domínio 8 (Parceiros & Benefícios/Recursos): 4 arestas (`EDGE-029` a `EDGE-032`)
- Domínio 9 (Programa de Afiliados): 4 arestas (`EDGE-033` a `EDGE-036`)
- Domínio 10 (Prestadores & Workstation): 4 arestas (`EDGE-037` a `EDGE-040`)
- Domínio 11 (Fornecedores & Procurement): 3 arestas (`EDGE-041` a `EDGE-043`)
- Domínio 12 (Colaboradores & RBAC): 2 arestas (`EDGE-044` a `EDGE-045`)
- Domínio 13 (Verticais: Viagens, Saúde, Seguros, Classificados, Ads): 7 arestas (`EDGE-046` a `EDGE-052`)
- Domínio 14 (GSA TV, Suporte, RH, Infra, VPS, Marketing, Diversos): 28 arestas (`EDGE-053` a `EDGE-080`)
- **Total**: $3 + 2 + 1 + 1 + 4 + 11 + 6 + 4 + 4 + 4 + 3 + 2 + 7 + 28 = \mathbf{80\text{ arestas}}$.

### 4.3 Desmistificação do Número 1.643
O número 1.643 surgiu em `METRICAS_FINAIS.md` da seguinte operação indevida:
$$\text{Total Inventariado Errado} = 1.377 \text{ (Itens Estruturais)} + 186 \text{ (Políticas RLS)} + 80 \text{ (Arestas)} = 1.643$$
- **Erro Conceitual 1**: As 186 políticas RLS são regras internas pertencentes às 294 tabelas relacionais do PostgreSQL. Somá-las separadamente é uma contagem dupla (dupla contabilização de atributos como entidades primárias).
- **Erro Conceitual 2**: As 80 arestas do grafo são relações direcionadas (links) entre elementos das 11 categorias de inventário. Somar nós com arestas em um mesmo total descaracteriza o inventário físico de software.
- **Regra de Ouro da Especificação**: O inventário físico do sistema contém **1.377 elementos**. O grafo de conexões contém **80 arestas**. Eles devem ser apresentados em tabelas e seções distintas, com reconciliações independentes.

---

## 5. Regras e Fórmulas de Reconciliação Matemática Invariante entre os 9 Relatórios

Para assegurar que todos os 9 relatórios convirjam matematicamente sem qualquer discrepância, foram definidas **4 Fórmulas Invariantes Fundamentais**:

### Invariante 1: Equação de Estado do Inventário Estrutural ($U_{\text{inv}}$)
A soma de todos os itens do inventário distribuídos entre os 7 status canônicos deve ser **estritamente igual a 1.377** em qualquer relatório que faça referência ao inventário:
$$\sum_{s \in S_{\text{canonical}}} N_{\text{inv}}(s) = 1.377$$
Onde $S_{\text{canonical}} = \{ \text{DESC}, \text{EST}, \text{DIN-PASS}, \text{DIN-FAIL}, \text{RET}, \text{BLOQ}, \text{NAO-TEST} \}$.

E para cada categoria individual $c \in \{1, \dots, 11\}$:
$$\sum_{s \in S_{\text{canonical}}} N_{c}(s) = \text{Total}_c$$
Com:
- $\text{Total}_{\text{UI-MOD}} = 15$
- $\text{Total}_{\text{UI-PAGE}} = 72$
- $\text{Total}_{\text{UI-FORM}} = 54$
- $\text{Total}_{\text{UI-BTN}} = 118$
- $\text{Total}_{\text{UI-TBL}} = 42$
- $\text{Total}_{\text{UI-MDL}} = 48$
- $\text{Total}_{\text{DB-TBL}} = 294$
- $\text{Total}_{\text{DB-RPC}} = 692$
- $\text{Total}_{\text{API-EDGE}} = 17$
- $\text{Total}_{\text{API-WH}} = 15$
- $\text{Total}_{\text{API-END}} = 10$

### Invariante 2: Equação de Estado das Arestas de Conexão ($U_{\text{conn}}$)
A soma das 80 arestas do grafo distribuídas entre os status canônicos deve ser **estritamente igual a 80**:
$$\sum_{s \in S_{\text{canonical}}} N_{\text{edges}}(s) = 80$$
Na fase de remediação dinâmica (R2):
$$N_{\text{edges}}(\text{DIN-PASS}) + N_{\text{edges}}(\text{DIN-FAIL}) + N_{\text{edges}}(\text{BLOQ}) = 80$$
Nenhuma aresta pode permanecer como `ANALISADO ESTATICAMENTE` sem justificativa formal após a conclusão do R2.

### Invariante 3: Equação da Bateria de Testes E2E ($U_{\text{e2e}}$)
A suíte E2E do Playwright é composta por 5 arquivos de spec que totalizam **30 testes unitários de jornada**:
$$N_{\text{e2e}}(\text{TOTAL}) = 30 = N_{\text{e2e}}(\text{DIN-PASS}) + N_{\text{e2e}}(\text{DIN-FAIL}) + N_{\text{e2e}}(\text{BLOQ})$$
- `1-auth-e-publico.spec.ts`: 5 testes
- `1-public-smoke.spec.ts`: 7 testes
- `2-painel-cliente.spec.ts`: 6 testes
- `3-painel-admin.spec.ts`: 6 testes
- `4-painel-prestador.spec.ts`: 6 testes
- Distribuição M3: $24 \text{ DIN-PASS} + 0 \text{ DIN-FAIL} + 6 \text{ BLOQ} = 30$.
- Na fase R2 (após provisionamento do banco local e seed determinístico): os 6 testes que eram `BLOQUEADO` (`test.skip`) devem ser executados dinamicamente, migrando para `DIN-PASS` ou `DIN-FAIL`.

### Invariante 4: Equação de Classificação e Resolução de Bugs
O total de ocorrências de bugs e descobertas reportadas deve ser **estritamente igual a 8**:
$$N_{\text{bugs}}(\text{TOTAL}) = 8 = N_{\text{suite}} + N_{\text{infra}} + N_{\text{arch}} + N_{\text{sistema}}$$
Onde:
- $N_{\text{suite}} = 6$ (`BUG-001` a `BUG-006` — `BUG DA SUÍTE DE TESTE`)
- $N_{\text{infra}} = 1$ (`BUG-007` — `PROBLEMA DE INFRAESTRUTURA`)
- $N_{\text{arch}} = 1$ (`BUG-008` — `DESCOBERTA ARQUITETURAL`)
- $N_{\text{sistema}} = 0$ (`BUG DO SISTEMA`)
- Resolução: 6 corrigidos e retestados na suíte de teste + 2 documentados = 8 resolvidos/tratados.

---

## 6. Matriz de Reconciliação Cruzada entre os 9 Relatórios

A tabela abaixo especifica o escopo, universo, equações e correções requeridas em cada um dos 9 relatórios oficiais da raiz do projeto para atingir **100% de consistência mútua**:

```
+------------------------------------------------------------------------------------------------------------------------------------+
| MATRIZ DE RECONCILIAÇÃO CRUZADA DOS 9 RELATÓRIOS OFICIAIS                                                                          |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| #  | Relatório                  | Universo Canônico     | Fórmula Matemática      | Correções Obrigatórias de Taxonomia & Dados    |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 1  | MATRIZ_TESTES_CONEXOES.md  | 80 Arestas            | Total = 80              | Substituir ANALISADO ESTATICAMENTE pelo status |
|    |                            | (EDGE-001 a EDGE-080) | (DIN-PASS + FAIL + BLOQ)| dinâmico real de cada aresta com log/assert.   |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 2  | RELATORIO_E2E.md           | 30 Testes E2E         | 30 = 24 PASS + 6 BLOQ   | Eliminar termos "Passed", "Skipped" e "PARCIAL"|
|    |                            | 6 Jornadas            | 6 = 1 PASS + 5 BLOQ (M3)| Adotar EXECUTADO DINAMICAMENTE e BLOQUEADO.    |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 3  | RELATORIO_TESTES_API.md    | 42 Endpoints          | 42 = 17 Edge + 15 WH    | Eliminar termo "VALIDADO". Harmonizar tabela   |
|    |                            | (17 + 15 + 10)        | + 10 Ext (41 PASS+1FAIL)| detalhada com resumo (41 PASS + 1 FAIL).       |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 4  | RELATORIO_BANCO.md         | 986 Itens DB          | 986 = 294 TBL + 692 RPC | Remover EDGE-054 da contagem de DB. Separar    |
|    |                            | 80 Arestas (separado) | 80 = 79 PASS + 1 BLOQ   | a tabela de Arestas da tabela de DB (986).     |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 5  | RELATORIO_REGRESSAO.md     | 30 Testes E2E         | 30 = 24 PASS + 6 BLOQ   | Padronizar para os 7 status canônicos.         |
|    |                            | + Build Vite          | Build Exit Code 0       | Registrar resultado final do build Vite.       |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 6  | SEGUNDA_VARREDURA.md       | 1.377 Itens           | 1.377 = 349 UI + 986 DB | Desagregar "Módulos: 105" nas 3 categorias:    |
|    |                            | Inalterados           | + 42 API (100% íntegro) | 15 módulos, 42 tabelas UI, 48 modais.          |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 7  | PENDENCIAS_E_BLOQUEIOS.md  | Itens Bloqueados      | Base = 1.377 itens      | Corrigir erro de soma (1.071 vs 1.066).        |
|    |                            | de 1.377 e de 80      | Bloqueados explicitados | Incluir os 311 itens de UI que faltavam.       |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 8  | METRICAS_FINAIS.md         | 1.377 Itens           | 1.377 itens estruturais | Extinguir o número fantasma 1.643 e 1.320.     |
|    |                            | 80 Arestas            | 80 arestas do grafo     | Tabela de 1.377 itens cruzada com 7 status.    |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
| 9  | RELATORIO_FINAL_AUDITORIA  | Síntese Master        | 1.377 itens estruturais | Alinhar todas as equações consolidadas com     |
|    |                            | dos 1.377 e 80        | 80 arestas do grafo     | as invariantes 1, 2, 3 e 4.                    |
+----+----------------------------+-----------------------+-------------------------+------------------------------------------------+
```

---

## 7. Recomendações Técnicas para os Agentes de Execução (Fase R2 e R4)

1. **Aos Executores do Provisionamento Local (R1 & R2)**:
   - Ao levantar o Supabase local (`supabase start`), aplicar o seed deterministicamente para liberar os 6 testes bloqueados em `tests/e2e/*.spec.ts`.
   - Ao rodar `supabase functions serve` localmente, executar requisições HTTP reais contra as 17 Edge Functions, comprovando status `EXECUTADO DINAMICAMENTE — PASSOU`.
   - Testar as 80 arestas de conexão com persistência no banco local (`SELECT` após `INSERT`/`UPDATE`) e propagação entre abas/módulos.

2. **Aos Editores dos Relatórios Finais (R4)**:
   - Substituir qualquer menção a "VALIDADO" por `EXECUTADO DINAMICAMENTE — PASSOU` onde houver log de teste correspondente, ou por `ANALISADO ESTATICAMENTE` onde houver apenas análise de código/schema.
   - Tratar `test.skip` estritamente como `BLOQUEADO`, nunca como "testado".
   - Aplicar as 4 equações invariantes em todos os relatórios antes da submissão final, garantindo que $1.377$ e $80$ sejam os únicos números basilares do escopo.
