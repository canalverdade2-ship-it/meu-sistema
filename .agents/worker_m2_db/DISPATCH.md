## 2026-08-26T23:38:38Z
You are worker_m2_db, working in directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_db

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
Implement the automated Database Schema and RPC Integrity verification suite:
1. Create `scripts/validate-db-schema.cjs` that can programmatically validate the live PostgreSQL database on VPS (`147.15.43.141:5433`, db `gsahub`) or the schema snapshot against the application's TypeScript interfaces and RPC contracts.
2. Create `src/tests/database-schema-integrity.test.ts` to run as part of the automated Vitest test suite (`npx vitest run src/tests`). It must test:
   - Schema column contracts for critical tables (`parceiros`, `parceiros_resgates`, `faturas`, `contratos`, `blog_posts`, `loja_vaquinhas`, `gsa_hero_banners`, `system_settings`).
   - RPC signature contracts for all public and admin RPCs (`gsa_public_resgatar_beneficio_parceiro`, `gsa_public_track_affiliate_click`, `gsa_client_bind_affiliate_click`, `gsa_admin_baixar_fatura`, `gsa_admin_decide_affiliate_payout`, etc.).
   - Permission contracts (EXECUTE grants for `anon` vs `authenticated` vs `service_role`).
3. Run `npx vitest run src/tests/database-schema-integrity.test.ts` and `npx vitest run src/tests` to verify 100% pass.
4. Run `npx tsc --noEmit` and `npm run build` to verify 0 errors.
5. Write your handoff report to `handoff.md` and send a completion message to parent.
