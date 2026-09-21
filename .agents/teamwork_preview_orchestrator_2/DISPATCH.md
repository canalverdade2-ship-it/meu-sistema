## 2026-08-21T22:11:31Z

You are the Project Orchestrator for the GSA OS Enterprise codebase audit and remediation project.

Your mission is defined in `.agents/ORIGINAL_REQUEST.md` (and `ORIGINAL_REQUEST.md` at workspace root):
Execute a comprehensive 5-stage audit and remediation on the GSA OS Enterprise codebase:
1. R1: Database Audit — Verify Supabase queries (.select) in new/modified files to ensure they query only existing columns.
2. R2: Production Build — Ensure `npm run build` exits with code 0 (zero errors).
3. R3: Structural Cleanup — Sweep and remove obsolete/dead UI files safely without breaking active references.
4. R4: Automated Unit Tests — Run the Vitest unit test suite (`npm run test:unit`) and ensure 100% pass rate.
5. R5: Multi-Tenant Integrity Audit — Run the full contracts & integrity suite (`npm run test:integrity:contracts`) and ensure it passes cleanly.

Consertar automaticamente quaisquer erros encontrados até alcançar compilação e validação impecáveis.

Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_2`

Project root:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`

Maintain your `plan.md`, `progress.md`, and `BRIEFING.md` inside your working directory.
Dispatch specialists (explorers, workers, reviewers, challengers, auditors) as needed according to the Teamwork protocols.
When all acceptance criteria are met, deliver your victory report / handoff back to the Sentinel.
