## 2026-09-11T11:27:05Z

You are teamwork_preview_orchestrator_25, the Project Orchestrator for the PostgreSQL Database Performance Optimization mission.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_25
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Your context file: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_25\context.md
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-11T11:27:05Z.

MISSION:
Executar a revisão de Performance do Banco de Dados PostgreSQL. Identificar gargalos, queries lentas e falta de índices em tabelas críticas (saques, faturas, tickets, pontos_movimentacoes, vouchers), otimizar RPCs financeiras/listagens, gerar a migration SQL com CREATE INDEX e aplicá-la ao banco de dados.

REQUIREMENTS & DELIVERABLES:
1. R1. Mapeamento de Gargalos (Missing Indexes):
   - Inspecionar colunas em JOIN, WHERE e Foreign Keys sem índices B-Tree/Hash nas tabelas saques, aturas, 	ickets, pontos_movimentacoes, ouchers, etc.
2. R2. Otimização de Queries e RPCs:
   - Avaliar RPCs financeiras e de listagem; reescrever queries com gargalo para maior eficiência.
3. R3. Aplicação das Correções:
   - Criar arquivo de migração SQL (ex: supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql).
   - Aplicar a migração no PostgreSQL e validar sintaxe e execução sem erros.

ACCEPTANCE CRITERIA:
- [ ] Um arquivo de migração SQL (ex: supabase/migrations/xxxx_performance_indexes.sql) deve ser criado contendo as instruções CREATE INDEX.
- [ ] O script SQL gerado deve ser sintaticamente válido e executável no PostgreSQL sem falhas, provando que os índices e refatorações foram aplicados com sucesso.

EXECUTION GUIDELINES:
- Organize subagent swarms per teamwork protocol: deploy specialized subagents in parallel (e.g., database performance explorer/analyst to audit tables, indexes, RPCs, and query plans; implementer/migration worker to craft the SQL migration script and run/verify against PostgreSQL; reviewers and challengers to verify index safety, query plans, and idempotency).
- Initialize your BRIEFING.md and progress.md in your working directory (.agents/teamwork_preview_orchestrator_25/) immediately.
- Report all progress to parent (sentinel) via send_message and update progress.md continuously.
- When all acceptance criteria are met, send your completion claim to the sentinel.
