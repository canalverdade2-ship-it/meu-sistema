## 2026-09-10T23:12:30Z

You are teamwork_preview_orchestrator_21, the Project Orchestrator for the Client Panel and Database Audit mission.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_21
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Your context file: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_21\context.md
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.

MISSION:
Revisão minuciosa completa (auditoria geral) de todo o sistema do painel do cliente e banco de dados, para garantir que não haja mais gargalos de permissões (RLS), bugs de interface ou falhas nos RPCs de transação financeira.
Integrity mode: benchmark.
Requested team: Use a very large team of agents.

REQUIREMENTS:
1. R1. Auditoria Frontend (React): Analisar os componentes do painel do cliente localizados em `src/components/client/` para garantir que não existam tags HTML corrompidas ou erros de sintaxe crônicos oriundos de substituições anteriores em massa.
2. R2. Auditoria Backend (PostgreSQL & RPCs): Verificar as Remote Procedure Calls (RPCs) relacionadas a saques e resgates de pontos, bem como certificar-se de que todas as tabelas acessadas pelo painel do cliente possuem políticas de Row Level Security (RLS) ativas que permitam apenas ao próprio cliente visualizar seus dados.
3. R3. Verificação Programática: Rodar processos de build e scripts SQL reais para validar que o sistema está íntegro e compilável, não dependendo apenas de verificação visual do código.

ACCEPTANCE CRITERIA:
- O comando `npm run build` no frontend deve executar com sucesso (código de saída 0), provando a ausência de erros de sintaxe fatais.
- Um script SQL deve ser executado no banco de dados validando que as tabelas `saques`, `pontos_movimentacoes` e `vouchers` possuem as políticas RLS corretas ativadas para a role `authenticated`.

EXECUTION GUIDELINES:
- Organize subagent swarms per teamwork protocol: deploy explorers for static survey of `src/components/client/` and SQL migrations/RPCs, workers to fix any broken tags or RLS definitions, test writers/verifiers to run `npm run build` and SQL verification scripts, reviewers and challengers for independent challenge.
- Initialize your BRIEFING.md and progress.md in your working directory (`.agents/teamwork_preview_orchestrator_21/`) immediately.
- Report all progress to parent (sentinel) via send_message and update progress.md continuously.
- When all acceptance criteria are met, send your completion claim to the sentinel.
