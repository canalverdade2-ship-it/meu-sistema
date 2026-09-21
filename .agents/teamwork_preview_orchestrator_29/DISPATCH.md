# Orchestrator Dispatch: Deep End-to-End Technical Audit (Revised Draft)

## Identity
You are **teamwork_preview_orchestrator_29**, the Project Orchestrator.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_29`

## Authoritative Reference
Read `ORIGINAL_REQUEST.md` (specifically the section `## 2026-09-16T11:11:22Z`).

## Core Responsibilities
1. Initialize your `BRIEFING.md` and `progress.md` in your working directory.
2. Maintain your heartbeat cron.
3. Decompose the mission into clear milestones:
   - **Milestone 1: Inventário e Mapeamento de Cobertura (Não Presumida)**
     - Systematic inventory: pages, routes, modules, submodules, components, buttons, forms, modals, tables, endpoints, services, integrations, webhooks, events, DB entities.
     - Explicit Connection Graph (UI -> function -> API -> controller -> DB).
     - Traceability Matrix (ID, Module, Route, Element, Planned Test, Executed Test, Result, Evidence, Status).
   - **Milestone 2: Teste e Validação Exaustiva e Prática (Local)**
     - Local runtime execution (mock/local DB), practical automation and interactions (NEVER code reading as test).
     - UI & Forms: buttons, loading states, multi-click prevention, validation (empty, invalid, numeric, dates), success/error handlers, console logs.
     - CRUD & APIs: sequential operations (CREATE->READ->UPDATE->DELETE), all endpoints, valid/invalid payloads, auth failure, rate limit.
     - Auth, DB & Jobs: backend access control, N+1 queries, referential integrity, webhooks, idempotency.
     - Responsiveness: smoke tests on Desktop, Tablet, Mobile.
   - **Milestone 3: Relatórios, Evidências e Correções Seguras**
     - No unjustified refactoring/structural changes.
     - Bug lifecycle: reproduce -> root-cause -> minimal fix -> retest & regression test.
     - Status values: VALIDADO, FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO (no fabricated coverage).
     - Connection Report with verifiable proof (logs, asserts).
     - Quantitative final metrics (Totals by status, % operational coverage, explicit justifications).
4. Run standard multi-agent workflows with specialists:
   - Explorers for mapping & inventory
   - Test writers & Workers for execution and validation
   - Reviewers & Challengers for adversarial verification
   - Forensic Auditor for gate verification
5. When complete, synthesize all findings and report to Sentinel.

## 2026-09-16T11:12:37Z
You are the Project Orchestrator (teamwork_preview_orchestrator_29).
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_29

Please read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_29\DISPATCH.md
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_29\context.md
3. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (specifically the latest section '## 2026-09-16T11:11:22Z')

Mission:
Execute an end-to-end deep technical audit (frontend, backend, database, APIs), validating and testing every connection, flow, form, and component of the system.
Follow the 3 core requirements:
- R1: Inventário e Mapeamento de Cobertura (Não Presumida) -> Inventário de Testes completo, Grafo de Conexões explícito, Matriz de Rastreabilidade.
- R2: Teste e Validação Exaustiva e Prática (Local) -> Execução local com banco mockado/local, UI & Formulários, CRUD & APIs, Autenticação, Banco e Jobs, Responsividade.
- R3: Relatórios, Evidências e Correções Seguras -> Causa raiz para bugs, correções mínimas com testes de regressão, status final explícito (VALIDADO, FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO), Relatório de Conexões com evidências e métricas finais absolutas.

Maintain your BRIEFING.md and progress.md. Dispatch specialist subagents as needed, ensure adversarial challenge, and deliver the final report and metrics.
