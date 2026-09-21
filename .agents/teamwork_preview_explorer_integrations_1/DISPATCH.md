# DISPATCH — teamwork_preview_explorer_integrations_1

## Identity & Context
- Archetype: teamwork_preview_explorer
- Role: Integrations & Test Infra Explorer
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_integrations_1
- Parent: teamwork_preview_orchestrator_28
- Original Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-16T11:07:35Z
- Project Scope: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_28\PROJECT.md

## Objective
Realizar uma exploração completa das integrações externas, dependências entre módulos e infraestrutura de testes existente no projeto.
Mapear:
1. Integrações externas: Evolution API (WhatsApp), webhooks n8n, Fish Audio, provedores de pagamento, storage de mídia.
2. Grafo de dependências entre módulos e domínios de negócio (ex: como Checkout depende de Carteira, Pontos, Estoque e Notificações).
3. Infraestrutura atual de testes: verificar `package.json`, scripts existentes (`scripts/`), runners instalados (Vitest, Playwright, Jest), e suítes de testes em `src/tests/` ou raiz.
4. Estratégia de ambiente de execução local: como rodar a aplicação localmente com banco mockado/local para testes exaustivos sem afetar a produção.

## Scope Boundaries
- Read-only exploration.
- NÃO modifique arquivos de código-fonte.
- NÃO inicie servidores externos nem envie mensagens reais via WhatsApp.

## Output Requirements
1. Salve seu relatório analítico em `analysis.md` no seu diretório de trabalho.
2. Salve seu resumo estruturado e handoff em `handoff.md`.
3. Notifique seu parent orchestrator via `send_message` quando terminar.
