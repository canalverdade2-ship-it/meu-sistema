# Context & Mission: Deep End-to-End Technical Audit (Revised Draft)

## Working Directory
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_29`

## Project Root
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`

## Original User Request (Authoritative)
See `ORIGINAL_REQUEST.md` (Section `## 2026-09-16T11:11:22Z`)

## Integrity Mode
benchmark

## Mission Summary
Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

## Requirements
### R1. Inventário e Mapeamento de Cobertura (Não Presumida)
- O time deve realizar um levantamento sistemático e criar um Inventário de Testes detalhando: páginas, rotas, módulos, submódulos, componentes, botões, formulários, modais, tabelas, endpoints, serviços, integrações, webhooks, eventos e entidades do banco.
- Criar um **Grafo de Conexões** explícito mapeando todas as arestas (ex: UI → função → API → Controller → Banco).
- Produzir uma Matriz de Rastreabilidade (ID, Módulo, Rota, Elemento, Teste planejado, Teste executado, Resultado, Evidência, Status).

### R2. Teste e Validação Exaustiva e Prática (Local)
- Levantar a aplicação localmente (banco mockado/local) e executar automações ou interações. Não considerar leitura de código como teste.
- **UI & Formulários:** Testar botões, estados de loading, bloqueio de múltiplos cliques, validações de form (vazios, inválidos, numéricos, datas), success/error handlers e logs do console.
- **CRUD e APIs:** Executar todas as operações CRUD individuais e em sequências (CREATE→READ→UPDATE→DELETE). Testar todos os endpoints (payloads válidos/inválidos, falha na auth, rate limit).
- **Autenticação, Banco e Jobs:** Validar controle de acesso no backend, N+1 queries no DB, integridade referencial, webhooks e idempotência.
- **Responsividade:** Executar smoke tests para Desktop, Tablet e Mobile.

### R3. Relatórios, Evidências e Correções Seguras
- Nenhuma refatoração ou alteração estrutural não justificada deve ser feita.
- Qualquer bug encontrado deve ser reproduzido, ter causa raiz identificada, ser minimamente corrigido e passar por reteste e regressão.
- As conexões, módulos e componentes devem receber o status final explícito: VALIDADO, FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO ou NÃO TESTADO. Jamais fabricar cobertura.
- Entregar um Relatório de Conexões com comprovação de evidências (ex: logs, asserts).

## Acceptance Criteria
### Verificação do Mapeamento e Conexões
- [ ] O Inventário de Testes e a Matriz de Conexões (Arestas) foram criados catalogando todo o escopo descoberto.
- [ ] Cada aresta/conexão documentada possui um status final e uma evidência verificável (nome do teste, request, log, etc.).

### Verificação de Testes (Programática/Evidencial)
- [ ] Os fluxos, componentes de UI, endpoints, banco e relacionamentos possuem testes concretos que verificam não apenas o happy path, mas os corner cases e fluxos de exceção.
- [ ] Nenhum elemento foi marcado como "VALIDADO" baseado apenas em inspeção estática ou de código.

### Verificação de Finalização (Métricas)
- [ ] O sistema apresenta métricas finais absolutas: Totais descobertos (módulos, páginas, formulários, endpoints, conexões) separados quantitativamente por seus status (Validados, Falharam, Não Testados, etc).
- [ ] A porcentagem de cobertura operacional e a justificativa para tudo que foi bloqueado/não testado estão explícitas.
