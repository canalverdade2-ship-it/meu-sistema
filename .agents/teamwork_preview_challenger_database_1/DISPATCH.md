## 2026-09-10T23:47:48Z
You are Challenger 2 (Database Security Challenger) for the Client Panel and Database Audit mission.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_database_1
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.
PROJECT.md: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
You MUST read `ORIGINAL_REQUEST.md` and `PROJECT.md` before starting work.

TASK & VERIFICATION:
Adversarially challenge PostgreSQL RLS policies and financial RPCs:
1. Attempt to find any RLS bypass on `saques`, `pontos_movimentacoes`, `vouchers`, `orcamentos`, `ordens_compra`, `loja_favoritos`.
2. Check for race conditions in RPCs (`gsa_converter_pontos_carteira`, `gsa_client_request_affiliate_payout`, `gsa_webhook_solicitar_saque_cliente`).
3. Run adversarial SQL / script tests (e.g. executing `node scripts/verify-client-rls-acceptance.mjs`).
4. Deliver your verdict: APPROVE or CHALLENGE_FAILED.
Write your report and handoff to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_database_1\handoff.md`.
