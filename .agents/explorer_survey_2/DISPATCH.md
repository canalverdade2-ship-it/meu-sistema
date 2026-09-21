## 2026-08-28T14:13:12Z
You are Explorer Survey 2 (Legacy Migration, Row Security Filters & Audit Script) for the Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_2`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`

Your Mission:
Investigate Requirement R3 and the Audit Script:
1. R3: Legacy Hook Migration (`useRealtimeTable` -> `useRealtimeSubscription`)
   - `src/components/modules/OrcamentosWorkstation.tsx`
   - `src/components/modules/ConfiguracoesModule.tsx`
   - Search for any other occurrences of `useRealtimeTable` in the entire codebase.
2. R3: Row Security Filters (Missing `filter: 'coluna=eq.{id}'`)
   - `src/hooks/useClientNotifications.tsx` (ensure `cliente_id=eq.{id}`)
   - `src/components/modules/AfiliadoDashboard.tsx` (ensure `afiliado_id=eq.{id}`)
   - `src/pages/PurchasesPage.tsx` (ensure `cliente_id=eq.{id}`)
   - `src/pages/CouponsPage.tsx` (ensure `cliente_id=eq.{id}`)
   - `src/components/drawers/PrestadorDetailDrawer.tsx` (ensure `prestador_id=eq.{id}`)
   - Identify if IDs can be undefined/null on initial render and how to safely handle `enabled: Boolean(id)`.
3. Audit & Verification:
   - Investigate `scripts/check-realtime-audit.ts` (how it operates, what regexes/rules it checks, how it is executed, e.g. `npx tsx scripts/check-realtime-audit.ts` or `npm run ...`).

Write your comprehensive findings and recommendations to `.agents/explorer_survey_2/handoff.md` and send a summary message when done.
