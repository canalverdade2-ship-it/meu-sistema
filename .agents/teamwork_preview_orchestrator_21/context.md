# Context Briefing for teamwork_preview_orchestrator_21

## Original User Request
Refer to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-10T23:11:34Z`.

## Requested Team Scale
The user explicitly requested: `Requested team: Use a very large team of agents.`
Deploy a multi-agent team (explorers for frontend and database/RPC survey, workers/specialists for remediation and verification, test writers for programmatic build and SQL scripts, adversarial reviewers, challengers, and gate auditors) to execute a comprehensive, thorough audit and programmatic validation.

## Task Objective
Revisão minuciosa completa (auditoria geral) de todo o sistema do painel do cliente e banco de dados, para garantir que não haja mais gargalos de permissões (RLS), bugs de interface ou falhas nos RPCs de transação financeira.
- Working directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Integrity mode: `benchmark`

## Requirements

### R1. Auditoria Frontend (React)
A equipe deve analisar os componentes do painel do cliente localizados em `src/components/client/` para garantir que não existam tags HTML corrompidas ou erros de sintaxe crônicos oriundos de substituições anteriores em massa.

### R2. Auditoria Backend (PostgreSQL & RPCs)
A equipe deve verificar as Remote Procedure Calls (RPCs) relacionadas a saques e resgates de pontos, bem como certificar-se de que todas as tabelas acessadas pelo painel do cliente possuem políticas de Row Level Security (RLS) ativas que permitam apenas ao próprio cliente visualizar seus dados.

### R3. Verificação Programática
A equipe deve rodar processos de build e scripts SQL reais para validar que o sistema está íntegro e compilável, não dependendo apenas de verificação visual do código.

## Acceptance Criteria

### Verificação de Compilação
- [ ] O comando `npm run build` no frontend deve executar com sucesso (código de saída 0), provando a ausência de erros de sintaxe fatais.

### Verificação de Segurança (RLS)
- [ ] Um script SQL deve ser executado no banco de dados validando que as tabelas `saques`, `pontos_movimentacoes` e `vouchers` possuem as políticas RLS corretas ativadas para a role `authenticated`.

## Workspace & Directories
- Project Root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Working Directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_21`
