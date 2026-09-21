# Context Briefing for teamwork_preview_orchestrator_23

## Original User Request
Refer to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-11T02:00:24Z`.

## Requested Team & Role Structure
Squad de elite especializado em Qualidade de Software, Segurança e Arquitetura de Sistemas (QA & Security Team) para assumir o ecossistema "Grupo GSA" após grande rodada de refatorações estruturais.
A estratégia requer colaboração em paralelo entre subagentes especializados:
- **Agente de Segurança (DBA):** RLS policies, Triggers, RPCs (SECURITY DEFINER), integridade no Supabase PostgreSQL.
- **Agente Front-end:** Inspecionar componentes React (Painéis do Prestador, Parceiro, Fornecedor, Colaborador, Afiliado e Anunciante), formulários, estado global, código morto e funções assíncronas que possam estar falhando silenciosamente.
- **Agente de Integração:** Validar chamadas de API, endpoints de Edge Functions e Webhooks, sincronia entre UI e Banco de Dados (100%).

## Task Objective
"Revisar tudo": vasculhar cada canto do sistema (Painéis do Prestador, Parceiro, Fornecedor, Colaborador, Afiliado e Anunciante) e do banco de dados (Supabase PostgreSQL) para garantir que não haja erros residuais, quebras de RLS ou falhas na lógica de negócio. A sincronia entre UI e Banco de Dados deve estar 100%.

## Core Requirements & Deliverables
1. **Verificação de Compilação (TypeScript):**
   - Garantir que o projeto compila perfeitamente sem erros (`npx tsc --noEmit` código 0).
2. **Auditoria de RLS (Supabase PostgreSQL):**
   - Auditar todas as Row Level Security (RLS) policies no banco de dados (`supabase/migrations/`).
   - Auditar Triggers e RPCs (SECURITY DEFINER).
3. **Auditoria de Código Morto e Falhas Silenciosas (Front-end):**
   - Confirmar se não há "código morto" ou funções assíncronas falhando silenciosamente nos componentes React e chamadas de API/Edge Functions.
4. **Relatório Consolidado:**
   - Compilar um relatório consolidado com a assinatura de aprovação da equipe demonstrando que o ecossistema GSA está "100% à prova de balas".

## Constraints & Guardrails
- NÃO alterar arquivos de configuração (`.env`, `vite.config.ts`, `tsconfig.json`) a menos que seja um bloqueio crítico.
- NÃO alterar a lógica de negócios estabelecida sem reportar antes.
- NENHUMA alteração destrutiva no banco de dados (DROP TABLE, etc).
- Garantir a retrocompatibilidade das páginas já consertadas.
- Nenhuma falha silenciosa permitida.

## Workspace & Directories
- Project Root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Working Directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23`
