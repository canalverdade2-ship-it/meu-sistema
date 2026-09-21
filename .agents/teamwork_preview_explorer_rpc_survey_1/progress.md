# Progress — Explorer 3 (Financial RPC Explorer)

Last visited: 2026-09-10T23:24:45Z

## Status
Completed financial RPC and database function audit across migrations, frontend, and webhooks. All reports created and verified. Ready for handoff.

## Checklist
- [x] Read ORIGINAL_REQUEST.md
- [x] Initialize DISPATCH.md, BRIEFING.md, progress.md
- [x] Scan `src/` for `supabase.rpc` and `callClientRpc` calls related to finance (saque, pontos, saldo, carteira, voucher, cashback)
- [x] Scan `supabase/migrations/` for database functions / RPCs touching `saques`, `carteira`, `saldo`, `pontos`, `vouchers`, `resgates`
- [x] Analyze locking (`FOR UPDATE`, advisory locks), balance checks, auth checks (`auth.uid()`, `gsa_client_session_actor`), idempotency/replay
- [x] Scan webhook server files (`server_webhook*.cjs`) for balance modifications / direct queries vs RPCs
- [x] Document specific vulnerabilities, race conditions, ACID flaws, authorization bypasses
- [x] Write `survey_report.md`
- [x] Write `handoff.md`
- [x] Update `BRIEFING.md`
- [x] Notify parent agent
