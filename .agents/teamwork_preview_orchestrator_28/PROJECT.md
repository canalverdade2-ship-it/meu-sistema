# Project: Deep End-to-End Technical Audit (GSA HUB)

## Architecture
- Frontend: React (Vite, TailwindCSS, Lucide Icons, modular domain workstations)
- Backend: Supabase (PostgreSQL, Auth, RLS, Storage, RPCs, Edge Functions)
- Webhooks & Microservices: VPS Node.js Webhooks (`server_webhook_vps_live.cjs`), n8n automation, Evolution API
- Testing: Playwright, Vitest / local test harnesses

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Mapeamento de Arquitetura e Rastreabilidade | Mapear rotas, componentes, APIs, banco e criar matriz Função -> UI -> API -> Banco | M1 | ORIGINAL_REQUEST R1 |
| 2 | Grafo de Dependências entre Módulos | Grafo de acoplamento entre os domínios e subsistemas | M1 | ORIGINAL_REQUEST R1 |
| 3 | Infraestrutura de Teste Local | Harness local / mock de banco para testes seguros | M2 | ORIGINAL_REQUEST R2 |
| 4 | Testes Automatizados de UI (Botões, Forms, Cliques) | Varredura de formulários e componentes interativos de cada portal | M2 | ORIGINAL_REQUEST R2 |
| 5 | Testes de Fluxos E2E Críticos | Fluxos ponta a ponta (Auth, Checkout, Recursos, Ordens, Cadastros) | M2 | ORIGINAL_REQUEST R2 |
| 6 | Auditoria de Operações CRUD | Validação CRUD de todas as entidades do sistema | M3 | ORIGINAL_REQUEST R3 |
| 7 | Auditoria de Endpoints de APIs e Edge Functions | Testes de todos os endpoints e RPCs | M3 | ORIGINAL_REQUEST R3 |
| 8 | Análise Estrutural e Performance de DB Schema | Análise de chaves, índices, RLS e constraints | M3 | ORIGINAL_REQUEST R3 |
| 9 | Simulação de Falhas e Negativos | Cenários de erro HTTP, inputs inválidos, timeouts, race conditions | M3 | ORIGINAL_REQUEST R3 |
| 10 | Investigação de Causa Raiz | Diagnóstico profundo de qualquer anomalia encontrada | M4 | ORIGINAL_REQUEST R4 |
| 11 | Correções com Testes de Regressão | Remediar falhas garantindo teste automatizado de regressão | M4 | ORIGINAL_REQUEST R4 |
| 12 | Relatórios Formais de Validação | Matriz de Módulos e Conexões com status validado/bloqueado | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Mapeamento da Arquitetura e Matriz de Rastreabilidade | Mapear todas as aplicações, rotas, componentes, APIs, banco, grafo de dependência | none | IN_PROGRESS |
| M2 | Teste e Validação Exaustiva de UI e Fluxos (Local) | Harness local, testes de botões/forms, suíte E2E automatizada | M1 | PLANNED |
| M3 | Teste de APIs, Backend e Banco de Dados | CRUD de entidades, endpoints, schema do banco, simulação de falhas | M1 | PLANNED |
| M4 | Relatórios e Correções Seguras | Investigação de causa raiz, testes de regressão, matrizes de módulos e conexões validadas/bloqueadas | M2, M3 | PLANNED |

## Interface Contracts
### Traceability Chain Schema
- `[Feature ID] - [Feature Name]`
- `UI Layer`: Route path, Component path, Key interactive elements (Buttons, Forms, Inputs)
- `Service / API Layer`: Hook, Service helper, Supabase Client call, RPC call, or REST endpoint
- `Database Layer`: PostgreSQL Table, Column(s), RLS Policy, Stored Function/Trigger
- `Validation Status`: `VALIDADO` | `BLOQUEADO` | `FALHA_CORRIGIDA`

## Code Layout
- `src/`: React frontend application
  - `src/components/admin/`: Admin domain workstations and management modules
  - `src/components/client/`: Client portal modules and dashboard
  - `src/components/public/`: Public facing pages (Consultation, Login, Appeal)
  - `src/components/`: Shared domain modules (Afiliado, Fornecedor, Prestador, Colaborador)
  - `src/hooks/`: Custom React hooks (useRealtime, useAuth, etc.)
  - `src/services/` & `src/utils/`: Service clients, API wrappers, and utilities
- `supabase/`: Database configuration and Edge Functions
  - `supabase/migrations/`: SQL schema migrations, RLS policies, RPC functions
  - `supabase/functions/`: Deno Edge Functions
- `scripts/`: Operational scripts and verification suites
- `tests/` or `src/tests/`: Automated test suites
