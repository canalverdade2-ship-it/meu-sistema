# DISPATCH — teamwork_preview_explorer_backend_1

## Identity & Context
- Archetype: teamwork_preview_explorer
- Role: Backend & Database Explorer
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_backend_1
- Parent: teamwork_preview_orchestrator_28
- Original Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-16T11:07:35Z
- Project Scope: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_28\PROJECT.md

## Objective
Realizar uma exploração aprofundada da camada de Backend, APIs e Banco de Dados (Supabase / PostgreSQL) do ecossistema GSA.
Mapear:
1. Esquema completo de banco de dados (`supabase/migrations/` e estruturas): tabelas, chaves primárias e estrangeiras, índices e constraints.
2. Todas as Remote Procedure Calls (RPCs), funções armazenadas e triggers existentes.
3. Políticas de Row Level Security (RLS) para cada tabela e roles permitidas.
4. Edge Functions do Supabase (`supabase/functions/`) e endpoints REST/webhook locais e da VPS (`server_webhook_vps_live.cjs`, `server_webhook.cjs`).
5. Inventário de operações CRUD esperadas por entidade.

## Scope Boundaries
- Read-only exploration.
- NÃO modifique arquivos de código-fonte nem migrations.
- NÃO execute comandos destrutivos no banco de dados.
- Documente tudo com caminhos de arquivos e linhas de referência.

## Output Requirements
1. Salve seu relatório analítico em `analysis.md` no seu diretório de trabalho.
2. Salve seu resumo estruturado e handoff em `handoff.md`.
3. Notifique seu parent orchestrator via `send_message` quando terminar.
