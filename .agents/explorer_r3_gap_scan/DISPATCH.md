## 2026-08-28T13:37:44Z
You are Explorer R3 auditing GSA HUB for Missing Realtime Coverage across all frontend files.

Read the authoritative requirements at:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md`

Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_r3_gap_scan`

Your mission:
Scan all frontend files (`src/**/*.tsx`, `src/**/*.ts`) to find components/pages that:
- Display mutable, collaborative, or high-frequency business data (orders, tickets, chats, payments, notification feeds, logs, approvals, status dashboards, live operations)
- BUT currently only do static one-shot fetching (`useEffect` with `supabase.from(...).select(...)` or single REST fetch without realtime subscriptions)
- And would substantially benefit from Realtime updates.

For each candidate:
1. Relative file path
2. Data entity / Supabase table
3. Current fetch mechanism
4. Why realtime is needed (business impact / user experience benefit)
5. Recommended hook (`useRealtimeSubscription` / `useRealtime`), recommended event types (INSERT, UPDATE, DELETE), filter recommendations (e.g. `empresa_id=eq...`, `user_id=eq...`), and debounce settings.

Deliverables:
- Write `analysis.md` in your working directory with a structured catalog of all missing realtime opportunities.
- Write `handoff.md` and send message to parent when complete.
