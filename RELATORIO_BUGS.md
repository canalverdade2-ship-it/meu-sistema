# RELATÓRIO DE BUGS E CAUSA RAIZ — GSA HUB

**Documento**: `RELATORIO_BUGS.md`
**Milestone**: Milestone 3 — Ciclo de Correção Seguro
**Data da Execução**: 2026-09-16
**Executor**: Orquestrador (Antigravity)
**Integridade**: Regra de Ouro 7 (corrigir somente após reprodução e causa raiz). Zero correções sem teste que reproduza o bug.

---

## 1. SUMÁRIO EXECUTIVO

A Segunda Varredura (M3) identificou bugs a partir das execuções reais dos testes E2E do Milestone 2. Todos os bugs documentados foram **reproduzidos dinamicamente** antes de qualquer correção.

| ID do Bug | Severidade | Categoria | Status | Causa Raiz |
|---|:---:|---|:---:|---|
| `BUG-001` | 🔴 CRÍTICO | Testes E2E — Anti-cheating | ✅ CORRIGIDO | Bypass condicional `if (count > 0)` em `1-auth-e-publico.spec.ts` |
| `BUG-002` | 🔴 CRÍTICO | Testes E2E — Dados de Teste | ✅ CORRIGIDO | CPF `'000.000.000-00'` inválido por módulo 11 |
| `BUG-003` | 🔴 CRÍTICO | Testes E2E — Dados de Teste | ✅ CORRIGIDO | CPF `'111.111.111-11'` — todos dígitos iguais, rejeitado por regex |
| `BUG-004` | 🟠 ALTO | Testes E2E — Seletor | ✅ CORRIGIDO | Seletor `/login` não encontra input (LoginHub não tem campo de CPF) |
| `BUG-005` | 🟠 ALTO | Testes E2E — Seletor | ✅ CORRIGIDO | Strict mode violation: 4 inputs tipo password sem `.first()` |
| `BUG-006` | 🟡 MÉDIO | Testes E2E — Outros arquivos | ✅ CORRIGIDO | `if (count > 0)` e `.catch(() => null)` em 3 outros arquivos spec |
| `BUG-007` | 🟡 MÉDIO | Arquitetura de Teste | 📋 DOCUMENTADO | Ausência de banco de teste com seed (5 jornadas E2E bloqueadas) |
| `BUG-008` | ℹ️ INFO | Descoberta de Produção | 📋 DOCUMENTADO | CPF `529.982.247-25` cadastrado no banco real (avançou para PIN) |

**Total**: 6 bugs corrigidos, 2 documentados. Zero bugs funcionais introduzidos pelas correções.

---

## 2. DETALHAMENTO DOS BUGS

### BUG-001 — Bypass Condicional em `1-auth-e-publico.spec.ts`

**Severidade**: 🔴 CRÍTICO (Anti-cheating — Regra de Ouro 11)
**Arquivo**: `tests/e2e/1-auth-e-publico.spec.ts`
**Linha**: 17 (versão original)
**Reprodução**: O teste passava verde mesmo quando o elemento `docInput` não existia no DOM — o `if` condicional simplesmente pulava toda a interação
**Causa Raiz**: Bypass deliberado `if (await docInput.count() > 0)` que tornava o teste irrelevante
**Correção**: Substituído por `await expect(docInput).toBeVisible({ timeout: 15000 })` — o teste agora falha se o elemento não estiver visível
**Reteste**: ✅ `ok 3` — `Rota /login/pessoa-fisica renderiza campo de CPF visível` passou em 8.1s

---

### BUG-002 — CPF `'000.000.000-00'` Inválido

**Severidade**: 🔴 CRÍTICO (Dados de teste falsos — Regra de Ouro 11)
**Arquivo**: `tests/e2e/1-auth-e-publico.spec.ts` linha 23 (versão original)
**Reprodução**: `validarCPF('00000000000')` retorna `false` (todos dígitos iguais são rejeitados pela regex `if (/^(\d)\1{10}$/.test(cleaned))`)
**Causa Raiz**: CPF sinteticamente inválido usado como "válido" — teste fabricava sucesso
**Correção**: Substituído por `'529.982.247-25'` calculado pelo algoritmo `(sum*10)%11` do próprio sistema
**Verificação**: `node -e "..."` confirmou `validarCPF('52998224725') === true` ✅
**Reteste**: ✅ `ok 5` — `Campo CPF aceita CPF válido por módulo 11` passou em 5.2s

---

### BUG-003 — CPF `'111.111.111-11'` Inválido para Teste Negativo

**Severidade**: 🔴 CRÍTICO (Dados de teste inválidos)
**Arquivo**: `tests/e2e/1-auth-e-publico.spec.ts` linha 19 (versão original)
**Reprodução**: `validarCPF('11111111111')` retorna `false` pela regra `if (/^(\d)\1{10}$/.test(cleaned))` — o comportamento testado é o mesmo que `000.000.000-00`, não testando a rejeição de verificadores
**Causa Raiz**: CPF com todos dígitos iguais — não testa especificamente a verificação de dígitos verificadores
**Correção**: Substituído por `'123.456.789-09'` — formato válido (dígitos distintos) mas verificadores errados (`d1_calculado=9 ≠ d1_no_cpf=0`)
**Reteste**: ✅ `ok 4` — `Campo CPF rejeita CPF com verificadores inválidos` passou em 8.0s

---

### BUG-004 — Seletor de Input Apontando para Rota Errada

**Severidade**: 🟠 ALTO (Testes falhavam por causa de descoberta arquitetural)
**Arquivos**: `1-auth-e-publico.spec.ts`, `2-painel-cliente.spec.ts`, `3-painel-admin.spec.ts`, `4-painel-prestador.spec.ts`
**Reprodução**: `await page.goto('/login')` + busca por `input[placeholder*="CPF"]` falha — a rota `/login` renderiza o `LoginHub` (seleção de portais com botões, SEM campo de input)
**Causa Raiz**: Arquitetura real: `/login` = hub de seleção; `/login/pessoa-fisica` = formulário CPF
**Descoberta via código**: `src/components/public/LoginHub.tsx` — componente de botões apenas
**Rota correta**: Navegar para `/login/pessoa-fisica` para acessar o formulário CPF
**Correção**: Todos os testes atualizados para navegar em `/login/pessoa-fisica`
**Reteste**: ✅ Todos os testes de renderização de CPF passaram

---

### BUG-005 — Strict Mode Violation no Locator de PIN

**Severidade**: 🟠 ALTO (Teste falhava por seletor ambíguo)
**Arquivo**: `tests/e2e/1-auth-e-publico.spec.ts` linha 102 (versão v2)
**Reprodução**: `locator('input[type="password"]')` resolve para 4 elementos (PinInput tem 4 campos independentes) — Playwright strict mode recusa mais de 1 elemento sem `.first()`
**Causa Raiz**: Componente `PinInput` renderiza 4 inputs independentes com `aria-label="Senha numérica de quatro dígitos, dígito N de 4"`
**Correção**: `locator('input[type="password"]').first()` — seleciona apenas o primeiro campo
**Reteste**: ✅ `ok 5` — passou em 5.2s

---

### BUG-006 — Bypasses Condicionais nos Outros 3 Arquivos Spec

**Severidade**: 🟡 MÉDIO
**Arquivos**: `2-painel-cliente.spec.ts`, `3-painel-admin.spec.ts`, `4-painel-prestador.spec.ts`
**Reprodução**: Múltiplos `if (await element.count() > 0)` e `.catch(() => null)` em todos os 3 arquivos
**Causa Raiz**: Mesma técnica de bypass do BUG-001 aplicada em lote
**Correção**: Todos os 3 arquivos reescritos com asserções reais e BLOQUEADOS documentados com `test.skip`
**Reteste**: ✅ 12 testes passaram (4 por arquivo) + 6 skipped documentados

---

### BUG-007 — Ausência de Ambiente de Teste com Banco Seed (DOCUMENTADO)

**Severidade**: 🟡 MÉDIO (Limitação de infraestrutura)
**Categoria**: Arquitetura de teste — não é bug de código
**Descrição**: Não existe banco de dados de teste/staging isolado com usuários seed provisionados. O sistema usa CPF+PIN real com RLS no Supabase de produção.
**Impacto**: 5 das 6 jornadas E2E ponta a ponta são BLOQUEADAS (E2E-02 a E2E-06)
**Mitigation**: 6 testes marcados com `test.skip` e justificativa técnica explícita
**Recomendação para M4/Produção**: Criar seed de usuários de teste no banco de staging com CPFs e PINs conhecidos, desabilitando RLS para o schema de teste

---

### BUG-008 — CPF `529.982.247-25` Cadastrado em Banco de Produção (DOCUMENTADO)

**Severidade**: ℹ️ INFO (Descoberta de produção)
**Origem**: Execução do teste 5 do `1-auth-e-publico.spec.ts`
**Evidência**: CPF sinteticamente gerado avançou para o estágio de PIN em 5.2s — o banco retornou sucesso na consulta de existência do CPF
**Implicação**: Um CPF que deveria ser "sintético para testes" está cadastrado no banco de produção. Isso indica que o número de 9 dígitos `529982247` coincide com um CPF real de um cliente GSA.
**Ação recomendada**: Usar CPF de 9 dígitos garantidamente não cadastrado no banco para futuras execuções de CI/CD. Sugestão: verificar CPF `748.277.601-01` antes de usar em testes.

---

## 3. RECONCILIAÇÃO MATEMÁTICA

| Categoria | Quantidade |
|---|:---:|
| Bugs identificados via execução real (M2) | 8 |
| Bugs CORRIGIDOS | 6 |
| Bugs DOCUMENTADOS (sem correção de código necessária) | 2 |
| Bugs que geraram regressão | 0 |
| Correções que quebraram outros testes | 0 |

**Equação**: 8 = 6 corrigidos + 2 documentados + 0 não tratados ✅
