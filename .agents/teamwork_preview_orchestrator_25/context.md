# Context Briefing for teamwork_preview_orchestrator_25

## Original User Request
Refer to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-11T11:27:05Z.

## Task Objective
Revisão focada estritamente na Performance do Banco de Dados PostgreSQL. Identificar gargalos, queries lentas e falta de índices, aplicando as devidas correções e otimizações (CREATE INDEX, refatoração de RPCs) imediatamente no sistema.

## Core Requirements & Deliverables

### R1. Mapeamento de Gargalos (Missing Indexes)
- Analisar a estrutura do banco de dados (schema, tabelas, queries nas RPCs e frontend) para identificar colunas usadas frequentemente em junções (JOIN), filtros (WHERE) e chaves estrangeiras (Foreign Keys) que atualmente não possuem índices B-Tree ou Hash.
- Foco em tabelas pesadas como:
  - saques
  - aturas
  - 	ickets
  - pontos_movimentacoes
  - ouchers
  - e outras tabelas de alto volume se detectado.

### R2. Otimização de Queries e RPCs
- Avaliar as Remote Procedure Calls (RPCs) financeiras e de listagem.
- Caso existam gargalos de plano de execução (verificáveis via EXPLAIN ANALYZE ou análise estrutural de query plans), reescrever as queries/funções para maior eficiência (evitando sequential scans desnecessários, subqueries ineficientes, etc.).

### R3. Aplicação das Correções
- Criar um script de migração SQL (.sql) no diretório de migrations (ex: supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql) contendo todas as instruções CREATE INDEX IF NOT EXISTS e refatorações de RPCs necessárias.
- Aplicar o script ao banco de dados PostgreSQL/Supabase para ganho imediato de performance.

## Acceptance Criteria
- [ ] Um arquivo de migração SQL (ex: supabase/migrations/xxxx_performance_indexes.sql) deve ser criado contendo as instruções CREATE INDEX.
- [ ] O script SQL gerado deve ser sintaticamente válido e executável no PostgreSQL sem falhas, provando que os índices e refatorações foram aplicados com sucesso.

## Workspace & Directories
- Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
- Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_25
