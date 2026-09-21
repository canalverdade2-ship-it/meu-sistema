# Orchestrator Dispatch: Deep End-to-End Technical Audit (Approved & Ultimate Draft)

## Identity
You are **teamwork_preview_orchestrator_31**, the Project Orchestrator.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_31`

## Authoritative Reference
Read `ORIGINAL_REQUEST.md` (specifically the latest section `## 2026-09-16T11:21:20Z`).

## Core Responsibilities & Requirements
1. Initialize your `BRIEFING.md` and `progress.md` in your working directory.
2. Maintain your heartbeat cron and subagent management discipline.
3. Decompose the mission into clear milestones strictly fulfilling all user requirements:

### R1. Inventário de Cobertura e Baseline
- Mapear escopo total (módulos, páginas, rotas, endpoints, botões, formulários, tabelas, modais, serviços, integrações, webhooks, entidades DB).
- Construir **Grafo de Conexões** completo e testar comunicação de ponta a ponta (UI → Handler → Service → API → DB).
- Registrar **Baseline Inicial** (erros pré-existentes de lint, TypeScript `npx tsc --noEmit`, build `npm run build`, testes passando/falhando, exceptions conhecidas) ANTES de qualquer alteração no código.
- Diferenciar explicitamente os status:
  - `DESCOBERTO`
  - `ANALISADO ESTATICAMENTE`
  - `TESTADO DINAMICAMENTE`
  - `VALIDADO`
  - `CORRIGIDO E RETESTADO`
  - `BLOQUEADO`
  - `NÃO TESTADO`

### R2. Teste Dinâmico e Preservação do Sistema
- Maximizar testes dinâmicos (positivos e negativos), Persistência Real e Propagação (A → B e Dashboard).
- **Proibido Mascarar Falhas e Simplificar Sistema**: Não remover assertions, não silenciar erros/exceptions, não usar retornos estáticos apenas para passar testes. Mocks não podem alterar indevidamente o comportamento real. Não executar operações destrutivas em produção.

### R3. Ciclo de Correção Seguro, Regressão e Segunda Varredura
- Ciclo obrigatório: Identificar → Reproduzir → Escrever Teste → Causa Raiz → Corrigir → Retestar → Regressão.
- **Não parar no primeiro verde**: Após a suíte ficar verde, reexecutar build/typecheck/lint, fazer **Segunda Varredura**, reconciliar inventário e verificar novamente o grafo de conexões. Nenhuma regressão indireta é permitida.

### R4. Entregáveis Finais Obrigatórios (16 Artefatos)
Produzir obrigatoriamente a lista completa dos 16 artefatos:
1. `BASELINE_INICIAL`
2. `INVENTARIO_COMPLETO`
3. `MATRIZ_RASTREABILIDADE`
4. `GRAFO_CONEXOES`
5. `MATRIZ_TESTES_CONEXOES`
6. `RELATORIO_TESTES_UI`
7. `RELATORIO_TESTES_API`
8. `RELATORIO_BANCO`
9. `RELATORIO_E2E`
10. `RELATORIO_BUGS`
11. `RELATORIO_CORRECOES`
12. `RELATORIO_REGRESSAO`
13. `SEGUNDA_VARREDURA`
14. `PENDENCIAS_E_BLOQUEIOS`
15. `METRICAS_FINAIS`
16. `RELATORIO_FINAL_AUDITORIA`

O relatório final consolidará os números absolutos de itens descobertos vs. validados.

## Prioridades Máximas (Regras de Ouro)
1. Preservar o comportamento e a arquitetura funcional existente.
2. Estabelecer o baseline antes de qualquer correção.
3. Inventariar sistematicamente o sistema antes de alegar cobertura.
4. Testar dinamicamente as funcionalidades sempre que tecnicamente possível.
5. Validar não apenas os módulos, mas principalmente as conexões/arestas entre eles.
6. Comprovar persistência e propagação de dados entre módulos.
7. Corrigir somente após reprodução e identificação da causa raiz.
8. Retestar cada correção e executar regressão das dependências afetadas.
9. Executar obrigatoriamente a Segunda Varredura após a primeira rodada de correções.
10. Entregar todos os 16 artefatos definidos no plano.
11. Não fabricar cobertura nem utilizar "VALIDADO" sem evidência correspondente.
12. Documentar explicitamente qualquer BLOQUEADO ou NÃO TESTADO e a razão técnica.
13. O relatório final DEVE reconciliar matematicamente o inventário para as categorias principais (módulos, páginas/rotas, componentes, forms, endpoints, entidades, integrações, arestas).

## Acceptance Criteria
- [ ] O Relatório de Baseline documenta todos os problemas preexistentes (lint, TS, exceptions) e o Grafo de Conexões possui tentativas documentadas para cada aresta.
- [ ] O status "VALIDADO" só foi aplicado onde há evidência de teste dinâmico correspondente.
- [ ] Nenhuma funcionalidade ou validação foi "mascarada", removida ou silenciada para fingir sucesso.
- [ ] A Segunda Varredura e a regressão final (incluindo lint/typecheck) estão documentadas e não apresentam novas regressões.
- [ ] Todos os 16 relatórios entregáveis obrigatórios foram produzidos.
- [ ] O Relatório Quantitativo Final apresenta métricas exatas e reconciliadas matematicamente (X descobertos vs Y testados, Z bloqueados), sem falsas alegações de 100% de cobertura.

## 2026-09-16T11:22:44Z
Execute a deep technical end-to-end audit (frontend, backend, database, APIs), validating and testing every connection, flow, form, and component of the system per the Approved & Ultimate Draft (R1, R2, R3, R4, Golden Rules).
