# BRIEFING — 2026-08-26T14:40:36Z

## Mission
Milestone 5 — Client Portal Realtime (R12 — 28+ Components): Implement real-time subscriptions with row-level filtering across all assigned client components using useRealtimeSubscription / useRealtime from src/hooks/useRealtime.ts.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5_client_portal_gen2
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: Milestone 5 — Client Portal Realtime

## 🔒 Key Constraints
- Use useRealtimeSubscription / useRealtime from src/hooks/useRealtime.ts across all listed client components.
- Apply row-level filters where appropriate (e.g. cliente_id=eq.${clientId} or user_id=eq.${userId}).
- Genuine implementation with no cheats or facade hardcoding.
- Verification: vitest tests and npm run build must succeed with exit code 0.
- Write handoff.md and communicate with send_message.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: 2026-08-26T14:40:36Z

## Task Summary
- **What to build**: Add real-time Supabase subscriptions to 30 client portal components/hooks in `src/components/client/`.
- **Success criteria**: All components subscribe to updates on relevant tables (vouchers, cart, support, budgets, credit, orders, loyalty, classifieds, travel, settings, etc.), pass vitest, and build cleanly.
- **Interface contracts**: `src/hooks/useRealtime.ts`
- **Code layout**: `src/components/client/`

## Change Tracker
- **Files modified**: [None yet]
- **Build status**: [TBD]
- **Pending issues**: [TBD]

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
- None

## Artifact Index
- `.agents/worker_m5_client_portal_gen2/DISPATCH.md` — Assignment instructions
- `.agents/worker_m5_client_portal_gen2/progress.md` — Progress tracker
- `.agents/worker_m5_client_portal_gen2/handoff.md` — Final handoff report
