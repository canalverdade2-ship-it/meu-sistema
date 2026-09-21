# DISPATCH — Forensic Auditor (Integrity & Authenticity Audit)

## Identity & Role
- Archetype: teamwork_preview_auditor
- Role: Forensic Integrity Auditor
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_24_1
- Parent Orchestrator: teamwork_preview_orchestrator_24

## Target Deliverable to Audit
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md`

## Input References
- MANDATORY: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (under header `## 2026-09-11T02:18:50Z`)
- Codebase: `src/` and `supabase/migrations/`

## Forensic Audit Checks
1. Check for Cheating / Fabrication / Facade:
   - Does `DOCUMENTACAO_SISTEMA.md` contain genuine analysis of actual repository code, or is it fabricated/dummy/hallucinated text?
   - Verify specific claims against real code: check specific table names, specific function signatures, and specific React component paths.
2. Check for Acceptance Criteria Compliance:
   - Does `DOCUMENTACAO_SISTEMA.md` exist at the project root?
   - Does it explicitly contain sections for Database (listing tables and RPCs) and Frontend (listing all 6 modules: Admin, Cliente, Fornecedor, Colaborador, Afiliado, Prestador)?
   - Does it have more than 100 lines?
3. Check for Plagiarism / External Circumvention:
   - Was the documentation derived from actual source inspection of `supabase/migrations/` and `src/`?

## Deliverables
- Write `handoff.md` in your working directory with your forensic verdict: CLEAN or INTEGRITY VIOLATION.
- Send completion message to parent (`db173f39-9c15-488b-8213-5189b5baef97`).

## 2026-09-11T06:21:44Z
<USER_REQUEST>
You are teamwork_preview_auditor assigned to conduct a Forensic Integrity Audit on DOCUMENTACAO_SISTEMA.md.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_24_1
Dispatch file: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_24_1\DISPATCH.md
Target deliverable: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md

MANDATORY: Read ORIGINAL_REQUEST.md before starting work at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-11T02:18:50Z).

TASK:
Perform strict forensic integrity auditing on DOCUMENTACAO_SISTEMA.md:
1. Verify Authenticity vs Fabrication:
   - Check if tables, functions, triggers, and component paths mentioned exist in the repository or are hallucinated/dummy.
   - Check if the business logic described matches real code implementations.
2. Verify Acceptance Criteria:
   - File exists at root (DOCUMENTACAO_SISTEMA.md).
   - Contains explicit sections for Database (listing tables and RPCs) and Frontend (listing all 6 modules: Admin, Cliente, Fornecedor, Colaborador, Afiliado, Prestador).
   - Exceeds 100 lines (verify exact line count).
3. Write your forensic audit report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_24_1\handoff.md
Must include explicit verdict: CLEAN or INTEGRITY VIOLATION.
4. Send a message to parent (db173f39-9c15-488b-8213-5189b5baef97) with your verdict.
</USER_REQUEST>
