# CONTEXT — Orchestrator 35 (Massive Dynamic Coverage Remediation)

## Project Root
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`

## References & Key Assets
- `ORIGINAL_REQUEST.md`: Exact user requirements (section `## 2026-09-16T16:52:43Z`).
- `INVENTARIO_COMPLETO.md`: Base inventory of 1,643 items (72 rotas, 54 forms, 118 botões, 48 modais, 42 grids, 294 tabelas, 692 RPCs, 186 RLS, 17 Edge Functions, 15 Webhooks, 10 APIs).
- `GRAFO_CONEXOES.md`: 80 connection edges between components/handlers/services/DB.
- `MATRIZ_RASTREABILIDADE.md`: Traceability mapping.
- `GEMINI.md`: Strict deployment instructions (VPS vs local). Note: For testing, everything must run in ISOLATED LOCAL LAB (local Supabase, local edge functions, local webhook).

## 9 Target Artifacts (at project root)
1. `MATRIZ_TESTES_CONEXOES.md`
2. `RELATORIO_E2E.md`
3. `RELATORIO_TESTES_API.md`
4. `RELATORIO_BANCO.md`
5. `RELATORIO_REGRESSAO.md`
6. `SEGUNDA_VARREDURA.md`
7. `PENDENCIAS_E_BLOQUEIOS.md`
8. `METRICAS_FINAIS.md`
9. `RELATORIO_FINAL_AUDITORIA.md`

## Mandates for Orchestrator 35
1. Preflight automático de isolamento executável (exit code != 0 se detectar qualquer recurso de produção).
2. Supabase local (`supabase start`, `supabase db reset --local`) e seed determinístico recriados >= 2 vezes.
3. Rastreabilidade item a item: Cada ID do inventário (ex: RLS-001, RPC-042, FORM-010) mapeado para um teste e evidência concreta.
4. Mocks de integração devem incluir testes de falha (HTTP 400, 401, 403, 404, 429, 500, timeout).
5. Taxonomia estrita única: DESCOBERTO, ANALISADO ESTATICAMENTE SOMENTE, EXECUTADO DINAMICAMENTE — PASSOU, EXECUTADO DINAMICAMENTE — FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO.
6. Reconciliação matemática perfeita entre inventário (1.643 itens) e a taxonomia final nos 9 relatórios.
