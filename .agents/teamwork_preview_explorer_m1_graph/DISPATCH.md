# Dispatch: Explorer 3 — Connection Graph & Test Matrix (Milestone 1)

## Identity & Role
You are **teamwork_preview_explorer_m1_graph**, the Connection Graph & Dynamic Test Matrix Explorer.
Working directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_graph`
Caller ID: `fff1ff8c-b424-4d40-8590-4969a6538c0e` (teamwork_preview_orchestrator_31)

## Mandatory Reading
1. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md` (specifically section `## 2026-09-16T11:21:20Z` and all audit requirements)
2. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md`
3. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_31\SCOPE.md`

## Objective & Scope
Map the full Connection Graph and construct the Dynamic Test Matrix for Requirement R1:
1. **Trace Every Connection (Edge)**:
   - UI Component / Button / Form → Handler / Hook / Service → Supabase Client / Edge Function / Webhook → PostgreSQL Table / RPC.
   - Trace cross-module data propagation (e.g. Action in Client Portal → updates Database → reflects in Admin Super-Domain Dashboard or Financeiro).
2. **Assign Unique Edge Identifiers**:
   - Every connection must have a unique identifier (`EDGE-001`, `EDGE-002`, etc.) linking Source Element, Handler, API/RPC, Destination DB Table, and Propagation target.
3. **Build the Dynamic Test Matrix**:
   - For each edge, define the planned dynamic test (positive test, negative test / failure scenario, persistence verification method, propagation verification method).
   - Ensure the required status classification is supported: `DESCOBERTO`, `ANALISADO ESTATICAMENTE`, `TESTADO DINAMICAMENTE`, `VALIDADO`, `CORRIGIDO E RETESTADO`, `BLOQUEADO`, `NÃO TESTADO`.
4. **Deliverables**:
   - Write comprehensive `analysis.md` and a structured `handoff.md` in your working directory `.agents/teamwork_preview_explorer_m1_graph/`.
   - Send completion message to parent (`fff1ff8c-b424-4d40-8590-4969a6538c0e`) via `send_message`.

## 2026-09-16T11:24:34Z
Map the complete end-to-end connection graph and construct the dynamic test matrix:
1. Trace every connection (edge) from UI Component -> Handler/Hook -> Service -> API/RPC/Edge/Webhook -> DB Table.
2. Trace cross-module data propagation (Action in Module A -> DB update -> reflects in Module B or Dashboard).
3. Assign unique edge IDs (EDGE-001, EDGE-002, etc.) linking source element, handler, API, DB table, and propagation target.
4. Define planned dynamic tests for each edge (positive, negative, persistence verification, propagation verification) and map status categories.
5. Write analysis.md and handoff.md in your working directory.
When completed, use send_message to report back to parent (fff1ff8c-b424-4d40-8590-4969a6538c0e) with a summary and the path to your handoff report.
