## 2026-08-28T14:17:04Z
You are Worker R4 (VPS Webhook Concurrency & Fallback Remediation) for Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r4`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`
Project master: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md`
Explorer Handoff: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_3\handoff.md`

Your Exclusive File Ownership:
- `server_webhook_vps_live.cjs`
- `server_webhook.cjs`
- `supabase/migrations/20260828120000_atomic_points_conversion.sql`

Your Tasks:
1. Create the database migration `supabase/migrations/20260828120000_atomic_points_conversion.sql` with the `gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)` RPC function as specified in Section 3 of Explorer 3 report.
2. In `server_webhook_vps_live.cjs` and `server_webhook.cjs`:
   - Fix `SERVICE_ROLE_JWT` declaration fallback: `const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';`.
   - Add `SessionMutex` class and instance `sessionMutex = new SessionMutex();`.
   - Wrap the HTTP POST `/webhook` handler call to `processMessage` using `sessionMutex.runExclusive(fromPhone, async () => { ... })`. Export `sessionMutex` in `module.exports`.
   - In `LOYALTY_ACTIONS` state handler, replace in-memory RMW points conversion with `supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: session.client.id }, ...)` and update in-memory session from the returned values.
3. Validate Node.js syntax in both files:
   - `node --check server_webhook_vps_live.cjs`
   - `node --check server_webhook.cjs`
