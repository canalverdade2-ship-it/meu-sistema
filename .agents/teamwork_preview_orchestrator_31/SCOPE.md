# Scope: Deep End-to-End Technical Audit (Approved & Ultimate Draft)

## Architecture
- **Frontend Layer**: React 18 (Vite SPA), TypeScript, TailwindCSS, Lucide icons, React Router / Custom module router. Modules: Admin Super-Domains (Pessoas, Fornecedores, Demandas/Ops, Financeiro, Governança, Marketing/TV), Client Portal (Dashboard, Extrato, Saques, Resgates, Tickets, Meus Pedidos), Prestadores, Fornecedores/Parceiros, Afiliados, TV Master Control & Grade, Marketplace / Store.
- **Service & State Layer**: Hooks (`useRealtimeSubscription`, custom hooks), API clients, Context providers (`AuthContext`, `ToastContext`), form validators.
- **Backend & APIs**: Supabase PostgreSQL (PostgREST APIs, RPC functions with `SECURITY DEFINER`), Supabase Edge Functions (`gsa-auth-session`, etc.), VPS Webhook (`server_webhook_vps_live.cjs` / `server_webhook.cjs`), n8n workflows, Evolution WhatsApp API.
- **Database Layer**: PostgreSQL on Supabase (Tables, Foreign Keys, Triggers, Views, RLS Policies, Indexes).

## Feature Inventory & Audit Targets
| # | Feature / Subsystem | Description | Milestone | Source |
|---|---------------------|-------------|-----------|--------|
| 1 | Baseline Inicial | Erros pré-existentes de lint, tsc --noEmit, build npm run build, testes e exceptions conhecidas | M1 | R1 |
| 2 | Frontend Scope Inventory | Mapeamento exaustivo de páginas, rotas, componentes, botões, modais, formulários, tabelas e validações | M1 | R1 |
| 3 | Backend & DB Inventory | Mapeamento de tabelas, colunas, chaves estrangeiras, RLS policies, RPCs, Edge Functions e Webhooks | M1 | R1 |
| 4 | Grafo de Conexões | Mapeamento sistemático de todas as arestas UI → Handler → Service → API → DB | M1 | R1 |
| 5 | Matriz de Rastreabilidade | Matriz de rastreabilidade completa (ID, Módulo, Rota, Elemento, Teste planejado/executado, Status) | M1 | R1 |
| 6 | Matriz de Testes de Conexões | Catálogo e planejamento de testes dinâmicos para cada aresta do Grafo de Conexões | M1 | R1 |
| 7 | Testes Dinâmicos de UI | Testes em elementos clicáveis, botões, loading, debounce, validações de formulário (vazio, tipo, data) | M2 | R2 |
| 8 | Testes Dinâmicos de APIs & CRUD | Testes positivos e negativos em RPCs, endpoints, webhooks e operações CRUD de cada entidade | M2 | R2 |
| 9 | Testes de Persistência Real | Validação de persistência real (recarregamento e verificação direta no banco) | M2 | R2 |
| 10 | Propagação Inter-Módulos | Validação de propagação de dados entre módulos (Módulo A → Módulo B e Dashboards) | M2 | R2 |
| 11 | Jornadas E2E & Cenários Negativos | Testes de jornadas completas de ponta a ponta e cenários de falha (erros HTTP, timeouts, acesso negado) | M2 | R2 |
| 12 | Ciclo de Correção Seguro | Identificar → Reproduzir → Escrever Teste → Causa Raiz → Corrigir → Retestar | M3 | R3 |
| 13 | Segunda Varredura | Varredura pós-correção para caçar regressões, código órfão e falhas indiretas | M3 | R3 |
| 14 | Relatório de Regressão | Verificação de integridade e não-regressão em todo o sistema e dependências | M3 | R3 |
| 15 | Pendências e Bloqueios | Documentação técnica detalhada de itens BLOQUEADO ou NÃO TESTADO e suas justificativas | M4 | R4 |
| 16 | Reconciliação Matemática & Relatório Final | Reconciliação quantitativa exata de itens descobertos vs validados e consolidação final | M4 | R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Inventário de Cobertura, Baseline Inicial e Grafo de Conexões (R1) | Mapeamento completo (UI, Backend, DB, APIs), medição e registro do Baseline Inicial estrito, construção do Grafo de Conexões e Matrizes | none | IN_PROGRESS |
| 2 | Teste Dinâmico e Preservação do Sistema (R2) | Execução massiva de testes dinâmicos (UI, APIs, CRUD, Banco, E2E, Persistência e Propagação) sem mascarar falhas | M1 | PLANNED |
| 3 | Ciclo de Correção Seguro, Regressão e Segunda Varredura (R3) | Correção rastreável de bugs encontrados (Reprodução -> Teste -> Causa -> Fix -> Reteste) e execução da Segunda Varredura | M2 | PLANNED |
| 4 | Reconciliação Matemática, Bloqueios e 16 Entregáveis Finais (R4) | Reconciliação matemática exata, auditoria forense de integridade, consolidação dos 16 relatórios entregáveis | M3 | PLANNED |

## Interface Contracts
### UI (React Component) ↔ Handler / Hook
- Components trigger action handlers on user interaction.
- Handlers must implement loading states, disable-on-submit, and proper error catching.

### Handler / Hook ↔ Supabase Client / Edge Function / Webhook
- Requests use authenticated or public Supabase client, Edge functions, or fetch to VPS webhooks.
- Responses must return strongly-typed payloads with standard error handling (e.g. `{ data, error }`).

### Supabase Client / API ↔ PostgreSQL Database
- PostgREST / RPC calls query tables or execute functions with RLS context.
- Transactions must guarantee ACID properties and proper locking where concurrent race conditions exist.

## Mandatory Deliverables (16 Artefatos)
1. `BASELINE_INICIAL.md`
2. `INVENTARIO_COMPLETO.md`
3. `MATRIZ_RASTREABILIDADE.md`
4. `GRAFO_CONEXOES.md`
5. `MATRIZ_TESTES_CONEXOES.md`
6. `RELATORIO_TESTES_UI.md`
7. `RELATORIO_TESTES_API.md`
8. `RELATORIO_BANCO.md`
9. `RELATORIO_E2E.md`
10. `RELATORIO_BUGS.md`
11. `RELATORIO_CORRECOES.md`
12. `RELATORIO_REGRESSAO.md`
13. `SEGUNDA_VARREDURA.md`
14. `PENDENCIAS_E_BLOQUEIOS.md`
15. `METRICAS_FINAIS.md`
16. `RELATORIO_FINAL_AUDITORIA.md`
