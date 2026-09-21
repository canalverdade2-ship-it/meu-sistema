# Context Brief: Deep End-to-End Technical Audit

## Project Overview
Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements
- **R1. Mapeamento da Arquitetura e Matriz de Rastreabilidade**: Mapear todas as aplicações, rotas, componentes, funções, APIs, banco de dados e integrações, gerando matriz de rastreabilidade completa e grafo de dependências entre módulos.
- **R2. Teste e Validação Exaustiva de UI e Fluxos (Local)**: Levantar aplicação localmente com banco local/mockado, instalar/utilizar bibliotecas de testes (Playwright, Cypress, Jest, etc.), scripts de automação testando botões, formulários e elementos clicáveis, fluxos E2E completos.
- **R3. Teste de APIs, Backend e Banco de Dados**: Auditar CRUD de cada entidade, testar endpoints de APIs, analisar schema do banco de dados (problemas estruturais/performance), criar massa de dados e simular cenários de falha.
- **R4. Relatórios e Correções Seguras**: Investigar causa raiz antes de corrigir problemas encontrados, executar regressão nas correções, gerar relatórios (Matriz de Módulos, Matriz de Conexões) com status de validação.

## Acceptance Criteria
- [ ] O artefato da matriz de rastreabilidade lista cada funcionalidade e sua cadeia completa (Função -> UI -> API -> Banco).
- [ ] Foram criados e executados scripts de automação ou suítes de testes que cobrem os fluxos críticos.
- [ ] Os scripts de teste validam os cenários de falha (erros HTTP, inputs inválidos, timeouts).
- [ ] As correções possuem um teste automatizado associado garantindo que o bug não retorne.
- [ ] O relatório final indica explicitamente se cada conexão do sistema foi validada com sucesso ou bloqueada.

## Authoritative User Request
See `ORIGINAL_REQUEST.md` under timestamp header `## 2026-09-16T11:07:35Z`.
