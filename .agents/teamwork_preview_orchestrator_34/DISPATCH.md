# Orchestrator Dispatch: Remediação de Cobertura da Auditoria (Orchestrator 34)

## Identity
You are **teamwork_preview_orchestrator_34**, the Project Orchestrator.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_34`

## Authoritative Reference
Read `ORIGINAL_REQUEST.md` (specifically the launched section `## 2026-09-16T16:21:01Z`).

## Core Responsibilities & Handover Context
1. Initialize your `BRIEFING.md` and `progress.md` in your working directory.
2. Maintain your heartbeat cron and subagent management discipline.
3. Handover & Context:
   - This is the **REMEDIAÇÃO DE COBERTURA DA AUDITORIA** phase for GSA HUB.
   - The M1 inventory (`INVENTARIO_COMPLETO.md`, `GRAFO_CONEXOES.md`, `MATRIZ_RASTREABILIDADE.md`) is the baseline.
   - The primary goal is to unblock and execute tests previously marked as "bloqueados" by provisioning an isolated local environment (Staging/Local) and running 100% dynamic E2E journeys and connection edges with real persistence.

## Requirements

### R1. Provisionamento de Infraestrutura Isolada (Local)
- **Supabase Local**: Provisionar e inicializar ambiente Supabase local (`supabase start`, `supabase db reset --local`). PROIBIDO usar dados de produção.
- **Seed Determinístico**: Criar scripts de seed SQL contendo dados suficientes para representar todas as identidades das jornadas (cliente, admin/colaborador, prestador, fornecedor, afiliado, parceiro) e suas entidades relacionadas (produtos, carrinho, pedidos, OS/demandas, agenda, fidelidade, cupons, etc).
- **Serviços Backend Locais**: Levantar Edge Functions localmente (`supabase functions serve`) e webhook (`node server_webhook.cjs`) sempre que tecnicamente possível.
- **Integrações Externas**: Sandboxes, mocks ou contract tests para APIs pagas/de terceiros; APIs read-only públicas testadas dinamicamente.

### R2. Execução Dinâmica Completa (100% E2E e Arestas)
- Re-executar as 6 Jornadas E2E (E2E-01 a E2E-06) de ponta a ponta utilizando exclusivamente o ambiente local. Não utilizar dados de produção.
- Testar dinamicamente todas as 80 arestas do `GRAFO_CONEXOES`. Cada aresta deve ter status individual suportado por evidência (log/asserção).
- Testar CRUDs, persistência real no banco de dados local e propagação entre módulos (A -> B).
- Manter RLS habilitado no ambiente local e testar permissões positivas e negativas com diferentes usuários do seed.

### R3. Taxonomia e Classificação Estrita
- Estabelecer e usar estritamente uma **ÚNICA TAXONOMIA** em todos os relatórios:
  - DESCOBERTO
  - ANALISADO ESTATICAMENTE
  - EXECUTADO DINAMICAMENTE — PASSOU
  - EXECUTADO DINAMICAMENTE — FALHOU
  - CORRIGIDO E RETESTADO
  - BLOQUEADO
  - NÃO TESTADO
- `test.skip` é obrigatoriamente `BLOQUEADO` ou `NÃO TESTADO`. Jamais reportar como "testado dinamicamente".
- Um item não pode mudar de categoria sem explicação técnica explícita.
- Separar claramente: `BUG DO SISTEMA`, `BUG DA SUÍTE DE TESTE`, `PROBLEMA DE INFRAESTRUTURA`, `DESCOBERTA ARQUITETURAL`.
- Corrigir a contabilização dos BUG-001 a BUG-006 antigos (eram BUG DA SUÍTE DE TESTE).

### R4. Geração Consistente dos Relatórios Finais
- Produzir/Atualizar os 9 artefatos na raiz do projeto, com perfeita reconciliação matemática:
  1. `MATRIZ_TESTES_CONEXOES.md`
  2. `RELATORIO_E2E.md`
  3. `RELATORIO_TESTES_API.md`
  4. `RELATORIO_BANCO.md`
  5. `RELATORIO_REGRESSAO.md`
  6. `SEGUNDA_VARREDURA.md`
  7. `PENDENCIAS_E_BLOQUEIOS.md`
  8. `METRICAS_FINAIS.md`
  9. `RELATORIO_FINAL_AUDITORIA.md`

## Acceptance Criteria
- Supabase local em execução e script de seed SQL aplicado com sucesso.
- Edge Functions servidas localmente e testadas via request/response local.
- Todas as 6 jornadas E2E executadas com evidências, sem banco de produção.
- Todas as 80 arestas do grafo possuem tentativa concreta de teste dinâmico registrada.
- Taxonomia unificada aplicada rigorosamente em todos os 9 relatórios.
- Reconciliação matemática perfeita sem conflitos com inventário.
- Bugs da suíte E2E classificados como `BUG DA SUÍTE DE TESTE`.
- Ao concluir todos os requisitos e relatórios, notifique o parent (Sentinel) com a declaração de vitória para auditoria independente.
