# Task Assignment — Reviewer 2 Database & Security (M5)

**Mission**: Revisão independente de segurança do banco de dados, políticas RLS, triggers e procedures `SECURITY DEFINER`.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_23_2
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md
- Migração `supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql`
- Laudo do Worker DB em `.agents/teamwork_preview_worker_23_db/handoff.md`
- Laudo do Worker Edge em `.agents/teamwork_preview_worker_23_edge/handoff.md`

**Tasks**:
1. Examinar a migração `20260911030000_comprehensive_database_security_remediation.sql` contra vazamentos de dados, permissões excessivas ou bypasses.
2. Auditar a exclusão de `sync_cliente_pontos_e_saldo` e o novo trigger `prevent_saldo_tampering()`.
3. Inspecionar a proteção contra vazamento wildcard nas 8 tabelas anteriormente afetadas.
4. Auditar a segurança das Edge Functions (`gsa-transactional-email`, `vps-api`, `cloudflare-api`, `ssh-proxy`).
5. Emitir veredito final estrito: **APPROVE** ou **REQUEST_CHANGES**.
6. Registrar relatório em:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_23_2\handoff.md`

## 2026-09-11T07:15:06Z
You are teamwork_preview_reviewer_23_2. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_23_2

You MUST read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T02:00:24Z`.
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_23_2\DISPATCH.md
3. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md
4. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260911030000_comprehensive_database_security_remediation.sql
5. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_db\handoff.md
6. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_edge\handoff.md

Mission:
Perform an objective and adversarial database, RLS and security review.
- Examine the remediation migration `20260911030000_comprehensive_database_security_remediation.sql`.
- Verify the dropping of `sync_cliente_pontos_e_saldo` and anti-tampering trigger hardening.
- Verify wildcard policy removals and tenant isolation on all tables.
- Verify Edge Function security enhancements (auth against open relay in transactional email, SSRF prevention in vps-api, RBAC on cloudflare/ssh-proxy).
- Issue an explicit verdict: APPROVE or REQUEST_CHANGES.
- Write your complete review report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_23_2\handoff.md
Once finished, send a message to orchestrator with your verdict.
