# Plan — 5-Stage Audit & Remediation (GSA OS Enterprise)

## Objective
Execute the 5-stage audit and remediation prescribed in ORIGINAL_REQUEST.md:
1. R1: Database Audit (Supabase .select queries verification)
2. R2: Production Build (`npm run build` exits with code 0)
3. R3: Structural Cleanup (sweep obsolete UI files safely)
4. R4: Automated Unit Tests (`npm run test:unit` 100% pass)
5. R5: Multi-Tenant Integrity Audit (`npm run test:integrity:contracts` passes cleanly)

## Execution Stages

### Phase 1: Survey & Diagnostics
- Dispatch Explorers to run baseline commands, audit database queries (.select), detect obsolete files in `src/components/admin`, verify build status, unit tests status, and integrity contracts status.

### Phase 2: Remediation (Worker Implementation)
- R1 Fixes: Repair any broken/non-existent Supabase .select column queries or missing database columns.
- R2 Fixes: Repair any TypeScript or Vite build compile errors.
- R3 Fixes: Safely delete or archive obsolete files without breaking active imports or routing.
- R4 Fixes: Fix any failing unit tests in `src/tests`.
- R5 Fixes: Fix any failures in `npm run test:integrity:contracts`.

### Phase 3: Adversarial Verification & Gate
- Dispatch Reviewers, Challengers, and Forensic Auditor.
- Pass Criteria:
  1. `npm run build` exits 0.
  2. `npm run test:unit` 100% passing.
  3. `npm run test:integrity:contracts` exits 0.
  4. All Reviewers APPROVE.
  5. All Challengers APPROVE.
  6. Forensic Auditor CLEAN.

### Phase 4: Synthesis & Final Reporting
- Aggregate results and report to Sentinel parent.
