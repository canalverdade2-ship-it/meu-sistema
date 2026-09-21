# DISPATCH — Orchestrator 35

## Mission
Executar a fase de REMEDIAÇÃO DE COBERTURA MASSIVA da Auditoria do GSA HUB em ambiente 100% isolado, convertendo o máximo dos 1.643 itens do inventário (anteriormente em análise estática) para execução dinâmica rastreável por ID individual em laboratório local, além das 6 jornadas E2E e 80 arestas do grafo de conexões.

## Working Directory
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_35`

## Authoritative User Request
Leia e cumpra integralmente os requisitos de `.agents/ORIGINAL_REQUEST.md` (seção `## 2026-09-16T16:52:43Z`):

### R1. Bloqueio Absoluto de Produção e Infraestrutura Isolada
- **PREFLIGHT AUTOMÁTICO DE ISOLAMENTO**: Criar script executável obrigatório anterior aos testes. A suíte DEVE abortar (exit code != 0) se detectar: URL Supabase de prod, project ref de prod, banco remoto, service role prod, endpoints VPS de prod não autorizados, ou integrações de prod sem sandbox. A saída do preflight deve constar na evidência.
- O frontend utilizado nos testes DEVE apontar explicitamente para o Supabase local.
- **Supabase Local & Seed**: Provisionar `supabase start`, `supabase db reset --local`. O seed DEVE ser determinístico, conter identidades completas (cliente, admin, prestador, afiliado) e entidades relacionadas. O ambiente DEVE poder ser destruído e recriado limpo.

### R2. Cobertura Dinâmica Massiva além das Jornadas
- Não limitar a remediação às 6 jornadas E2E e 80 arestas. Criar cobertura dinâmica para o inventário total: 72 rotas, 54 forms, 118 botões, 48 modais, 42 grids, 294 tabelas, 692 RPCs, 186 RLS, 17 Edge Functions, 15 Webhooks, 10 APIs (totalizando 1.643 itens).
- O objetivo central é reduzir ao mínimo a coluna "ANALISADO ESTATICAMENTE SOMENTE".
- **EVIDÊNCIA RASTREÁVEL POR ID**: Para cada item do inventário, o relatório deve apontar o ID exato (Ex: RLS-001 -> TEST-X). Totais sem rastreabilidade individual não contam.

### R3. Profundidade das Validações Dinâmicas (Banco, UI e APIs)
- **COBERTURA RPC/RLS/TABELA ITEM A ITEM**: A cobertura no backend não pode ser inferida por uma jornada passando. Deve registrar: ID, Teste, Cenário, Identidade, Resultado, Evidência e Status. RPC testado = RPC foi chamada e o banco comprova os efeitos (incluindo falhas intencionais). RLS testado = política e operação correspondente exercitadas explicitamente.
- **RLS Habilitado**: NUNCA desabilitar o RLS. Testar PERMITIDO, NEGADO (não autorizado ou acessando dados cruzados) e ANÔNIMO.
- **UI Completa**: Testar interação, persistência, erro/sucesso, e propagação entre módulos.
- **Integrações e Edge Functions**: Levantar `functions serve` e `server_webhook.cjs` localmente. Para mocks, incluir **Testes de Falha** (timeout, HTTP 400, 401, 403, 404, 429, 500, etc).

### R4. Taxonomia Única e Relatórios Reconciliados
- Utilizar estritamente: `DESCOBERTO`, `ANALISADO ESTATICAMENTE SOMENTE`, `EXECUTADO DINAMICAMENTE — PASSOU`, `EXECUTADO DINAMICAMENTE — FALHOU`, `CORRIGIDO E RETESTADO`, `BLOQUEADO`, `NÃO TESTADO`. `test.skip` é obrigatoriamente `BLOQUEADO` ou `NÃO TESTADO`.
- Separar causas: `BUG DO SISTEMA`, `BUG DA SUÍTE DE TESTE`, `PROBLEMA DE INFRAESTRUTURA`, `DESCOBERTA ARQUITETURAL`.
- Produzir os 9 artefatos perfeitamente reconciliados e idênticos em números:
  1. `MATRIZ_TESTES_CONEXOES.md`
  2. `RELATORIO_E2E.md`
  3. `RELATORIO_TESTES_API.md`
  4. `RELATORIO_BANCO.md`
  5. `RELATORIO_REGRESSAO.md`
  6. `SEGUNDA_VARREDURA.md`
  7. `PENDENCIAS_E_BLOQUEIOS.md`
  8. `METRICAS_FINAIS.md`
  9. `RELATORIO_FINAL_AUDITORIA.md`
- **Métricas Separadas**: `COBERTURA DE INVENTÁRIO` (itens com classificação) vs `COBERTURA DINÂMICA` (efetivamente exercitados).

## Acceptance Criteria
1. Preflight automático criado e atestando exit code 0 antes de cada bateria. Saída incluída nos relatórios.
2. Supabase local e seed determinístico recriados pelo menos duas vezes com sucesso e consistência.
3. Rastreabilidade ITEM A ITEM (ID do Inventário -> ID do Teste e Evidência) provada para RLS, RPCs, Edge Functions, Rotas, etc. Nenhuma inferência genérica.
4. Validação profunda: Testes de Falha (HTTP errors simulados), limites RLS (cruzamento de usuários), CRUDs transacionais provando propagação.
5. 9 Artefatos gerados com taxonomia única inalterável e reconciliação matemática perfeita.
6. Relatório Final exibe reconciliação idêntica entre o inventário total e a taxonomia final.
7. Totais no relatório final podem ser validados individualmente mapeando IDs para testes.
