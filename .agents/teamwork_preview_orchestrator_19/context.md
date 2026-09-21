# Context Briefing for teamwork_preview_orchestrator_19

## Original User Request
Refer to c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-10T19:56:53Z.

## Requested Team Scale
The user explicitly requested: Use a very large team of agents.
Deploy a full-scale multi-agent team: explorers, implementers/workers, test writers, adversarial reviewers, challengers, and gate auditors to thoroughly audit, stress-test, simulate concurrency, and fix all identified vulnerabilities.

## Task Objective
Validação ponta a ponta e auditoria profunda dos módulos de carrinho, checkout, devoluções, trocas, sistema de pontos, cupons, saldo de carteira e promoções do marketplace. Garantir que não existam falhas, deadlocks, race conditions ou inconsistências no código (React) e banco de dados (PostgreSQL), e corrigir proativamente qualquer vulnerabilidade encontrada diretamente no código e schemas.

## Requirements
1. **R1. Auditoria e Correção do Fluxo de Compras e Promoções**:
   - Realizar leitura estática profunda e refatorar o ciclo do carrinho e checkout.
   - Validar a aplicação de pontos, cupons, saldo em carteira e mecânicas de promoção.
   - Assegurar transações ACID e controle de estoque sem falhas de concorrência (sem race conditions / overselling).

2. **R2. Auditoria e Correção de Pós-Venda (Devoluções e Trocas)**:
   - Investigar e validar os fluxos de devolução e troca no código.
   - Garantir que os estornos (financeiros, de saldo e de pontos) e a reinserção de estoque sejam executados de forma atômica e correta.
   - Corrigir o código onde necessário diretamente nos arquivos do projeto.

## Acceptance Criteria
- [ ] Foram criados e executados novos scripts de teste automatizados capazes de simular o fluxo de compras e concorrência (ex: múltiplos checkouts/devoluções simultâneos).
- [ ] O relatório final da equipe atesta a aprovação nos testes e a ausência de *race conditions* ou furos lógicos nos referidos módulos.
- [ ] Quaisquer bugs, vulnerabilidades ou gargalos identificados durante a revisão estática do código (React e SQL) foram corrigidos diretamente nos arquivos do projeto.

## Workspace & Directories
- Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
- Orchestrator Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_19
