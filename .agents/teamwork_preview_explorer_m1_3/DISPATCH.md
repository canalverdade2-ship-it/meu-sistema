# Dispatch: Explorer 3 — Connection Graph & Dynamic Test Matrix

## Identity & Role
You are **teamwork_preview_explorer_m1_3**, the Connection Graph & Flow Mapping Explorer.
Working directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_3`
Caller ID: `36d800de-0c15-4b9b-9481-7d0cd8bf0f32` (teamwork_preview_orchestrator_30)

## Mandatory Reading
1. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md` (specifically `## 2026-09-16T11:15:31Z`)
2. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md`
3. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_30\DISPATCH.md`

## Objective & Scope
Construct the end-to-end Connection Graph and Dynamic Test Matrix for Requirement R1:
1. **Trace Full Architectural Chains (UI → Handler → Service → API → DB)**:
   - Identify every critical user journey across Client, Admin, Prestador, Parceiro, Fornecedor, Colaborador, Afiliado, TV/Media, Marketplace.
   - For each flow, trace: Click/Submit Event → React State/Hook Handler → Service Function/Supabase SDK Call → REST/RPC/Edge Function Endpoint → PostgreSQL Table/Trigger/RLS.
2. **Cross-Module Propagation Paths**:
   - Map inter-module side effects: e.g., Purchase in Store → Wallet Balance Debit → Loyalty Points Movement → Order Created → Notification Emitted → Admin Order List / Metrics Dashboard updated.
   - Map Service Request in Prestador/Client → Admin Approval Queue → Notification → Status change in Client Portal.
3. **Dynamic Test Matrix (Matriz de Arestas)**:
   - Convert the Connection Graph into a concrete matrix of testable edges.
   - Structure each edge: `[Edge-ID | Source Module | Action/Event | Handler/Service | Target API/DB | Test Type (Isolated / E2E / Negative) | Expected State Change | Verification Hook]`.
   - Ensure explicit test strategies for negative scenarios (unauthorized, invalid input, double-click, concurrency) and persistence validation (reloading page, DB select).
4. **Deliverables**:
   - Write `connection_graph.md`, `test_matrix.md`, and `handoff.md` in your working directory `.agents/teamwork_preview_explorer_m1_3/`.
    - Send completion message to parent via `send_message`.

## 2026-09-16T11:18:02Z
You are teamwork_preview_explorer_m1_3.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_3

Your parent is teamwork_preview_orchestrator_30 (conversation ID: 36d800de-0c15-4b9b-9481-7d0cd8bf0f32).

Mandatory instructions:
1. Read c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (specifically the latest section ## 2026-09-16T11:15:31Z).
2. Read your dispatch file at c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_3\DISPATCH.md.
3. Read c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md.
4. Construct the complete end-to-end Connection Graph (UI → Handler → Service → API → DB) across all core domains (Client, Admin, Prestador, Marketplace, TV, etc.).
5. Trace cross-module propagation paths (A created in Client -> DB -> Admin Dashboard & Notification).
6. Convert the Connection Graph into a concrete dynamic test matrix (candidate edges for dynamic verification, positive and negative test cases, real persistence checks).
7. Write connection_graph.md, test_matrix.md, and handoff.md in your working directory.
8. When complete, use send_message to report your completion and provide the full path to handoff.md to parent (36d800de-0c15-4b9b-9481-7d0cd8bf0f32).
