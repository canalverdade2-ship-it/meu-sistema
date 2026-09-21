# BRIEFING — 2026-08-26T14:20:00Z

## Mission
Implement Supabase Realtime across Milestone 2: Partners (R2), Admin Bell & Dashboard (R3), and Polling Elimination (R7, R10-polling, R11-portals, R10-modules).

## 🔒 My Identity
- Archetype: implementer
- Roles: [implementer, qa, specialist]
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_partners_polling
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: M2 (Partners, Admin Bell & Polling Elimination)

## 🔒 Key Constraints
- Use canonical `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` (or `supabase.removeChannel` cleanup).
- Never cheat or mock fake responses.
- Ensure 0 setInterval polling remains in: `OperacoesSuperDomain.tsx`, `ShopeeOperationsModule.tsx`, `GsaTvModule.tsx`, `SystemMonitorModule.tsx`, `AdvertiserPortal.tsx`, `AfiliadoDashboard.tsx`, `AcessosModule.tsx`, `AffiliateAdminModule.tsx`, `CareersAdminModule.tsx`.
- Pass `scripts/check-realtime-contracts.ts` (preserve required tokens in `useAdminNotifications.tsx`).
- Pass all vitest tests (exit code 0) and `npm run build`.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: 2026-08-26T14:20:00Z

## Task Summary
- **What to build**: Realtime subscriptions for 14 files across Partners, Admin Dashboard, Admin Bell, and Polling modules.
- **Success criteria**: All polling replaced with event-driven subscriptions, realtime updates instant, all tests pass, build clean.
- **Interface contracts**: `PROJECT.md`, `scripts/check-realtime-contracts.ts`
- **Code layout**: `src/components/`, `src/hooks/`, `src/pages/`

## Change Tracker
- **Files modified**: [TBD]
- **Build status**: [TBD]
- **Pending issues**: None

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: Clean
- **Tests added/modified**: [TBD]

## Key Decisions Made
- Use `useRealtimeSubscription` where suitable, ensuring proper table/filter configurations and debounces.
- In `useAdminNotifications.tsx`, keep contract tokens while converting any polling to realtime + 60s backup heartbeat.
