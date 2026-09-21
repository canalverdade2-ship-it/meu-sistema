# BRIEFING — 2026-08-28T14:36:00Z

## Mission
Migrate legacy `useRealtimeTable` usages and manual channels to canonical `useRealtimeSubscription`, and enforce missing Row Security Filters and `enabled: Boolean(...)` guards across 7 designated files.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r3
- Original parent: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Milestone: Realtime P0 Critical Remediation - R3

## 🔒 Key Constraints
- Strict file ownership: only modify the 7 assigned files:
  - `src/components/admin/ConfiguracoesModule.tsx`
  - `src/components/admin/OrcamentosWorkstation.tsx`
  - `src/hooks/useClientNotifications.tsx`
  - `src/components/modules/AfiliadoDashboard.tsx`
  - `src/pages/PurchasesPage.tsx`
  - `src/pages/CouponsPage.tsx`
  - `src/components/drawers/PrestadorDetailDrawer.tsx`
- Follow minimal change principle and preserve surrounding code/comments.
- No dummy/facade implementations or fake test results.
- Verify with `npx tsx scripts/check-realtime-audit.ts` and ensure clean typecheck/build.

## Current Parent
- Conversation ID: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Updated: 2026-08-28T14:30:13Z

## Task Summary
- **What to build**: Complete migration to canonical `useRealtimeSubscription` and security row filters.
- **Success criteria**: 0 legacy hook usages, 100/100 audit health score, zero realtime leaks, valid build.
- **Interface contracts**: `src/hooks/useRealtime.ts`

## Key Decisions Made
- `ConfiguracoesModule.tsx`: Replaced `useRealtimeTable` with canonical `useRealtimeSubscription` (debounce 300ms) and removed disconnected `rtRefreshKey`.
- `OrcamentosWorkstation.tsx`: Replaced `useRealtimeTable` and manual channels with `useRealtimeSubscription([{ table: 'orcamentos', onChange: fetchOrcamentos, debounceMs: 400 }, { table: 'ordens_servico', onChange: fetchOrcamentos, debounceMs: 400 }])`.
- `useClientNotifications.tsx`: Added `filter: \`cliente_id=eq.${clientId}\`` to `notificacoes` subscription with `if (!clientId) return` guard.
- `AfiliadoDashboard.tsx`: Added `filter: \`id=eq.${affiliateId}\`` on `gsa_afiliados`, `filter: \`afiliado_id=eq.${affiliateId}\`` on `gsa_afiliado_links`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques` and `filter: \`cliente_id=eq.${clientId}\`` on `saques`, guarded with `enabled: Boolean(...)`.
- `PurchasesPage.tsx`: Added `filter: \`cliente_id=eq.${clientId}\`` on `loja_pedido_itens` and `enabled: Boolean(clientId)` across all 5 subscribed tables.
- `CouponsPage.tsx`: Replaced manual channel with `useRealtimeSubscription` for `cupons_loja` and `cupons_ativados` (scoped with `filter: \`cliente_id=eq.${clientId}\`` and `enabled: Boolean(clientId)`).
- `PrestadorDetailDrawer.tsx`: Added `filter: \`id=eq.${prestador.id}\`` on `prestadores` and `filter: \`prestador_id=eq.${prestador.id}\`` on `prestador_demandas` with `enabled: Boolean(isOpen && prestador?.id)`.

## Artifact Index
- `.agents/worker_r3/DISPATCH.md` — Assignment instructions
- `.agents/worker_r3/BRIEFING.md` — Working memory
- `.agents/worker_r3/progress.md` — Progress tracker
- `.agents/worker_r3/handoff.md` — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/components/admin/ConfiguracoesModule.tsx` (Migrated to canonical `useRealtimeSubscription`)
  - `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` (Migrated to canonical `useRealtimeSubscription` for `orcamentos` and `ordens_servico`)
  - `src/hooks/useClientNotifications.tsx` (Added `cliente_id` row filter on `notificacoes`)
  - `src/pages/Afiliado/AfiliadoDashboard.tsx` (Added affiliate and client security filters with `enabled: Boolean(...)`)
  - `src/components/client/store/PurchasesPage.tsx` (Added `cliente_id` filter on `loja_pedido_itens` and `enabled: Boolean(clientId)` across all subscriptions)
  - `src/components/client/store/CouponsPage.tsx` (Migrated to `useRealtimeSubscription` with `cliente_id` scoped filter and `enabled: Boolean(clientId)`)
  - `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx` (Added `id` and `prestador_id` filters with `enabled: Boolean(isOpen && prestador?.id)`)
- **Build status**: Pass (`npm run build` completed in 36.65s with 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: `check-realtime-audit.ts` 100/100 (0 legacy hook usages, 0 leaks), `test:realtime` PASSED, `test:affiliates` PASSED, `test:gsa-store` PASSED, Vite build PASSED.
- **Lint status**: Clean across all 7 assigned files
- **Tests added/modified**: Validated with realtime contract and audit test suites

## Loaded Skills
- None
