## 2026-08-28T14:17:04Z
You are Worker R3 (Legacy Migration & Security Row Filters) for Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r3`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`
Project master: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md`
Explorer Handoff: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_2\handoff.md`

Your Exclusive File Ownership:
- `src/components/admin/ConfiguracoesModule.tsx`
- `src/components/admin/OrcamentosWorkstation.tsx`
- `src/hooks/useClientNotifications.tsx`
- `src/components/modules/AfiliadoDashboard.tsx`
- `src/pages/PurchasesPage.tsx`
- `src/pages/CouponsPage.tsx`
- `src/components/drawers/PrestadorDetailDrawer.tsx`

Your Tasks:
1. Migrate legacy `useRealtimeTable` to canonical `useRealtimeSubscription`:
   - `src/components/admin/ConfiguracoesModule.tsx`: Replace `useRealtimeTable('system_settings', ...)` with `useRealtimeSubscription({ table: 'system_settings', onChange: load, debounceMs: 300 })` and remove disconnected `rtRefreshKey`.
   - `src/components/admin/OrcamentosWorkstation.tsx`: Replace `useRealtimeTable` and manual unmemoized `supabase.channel('admin-orcamentos-sd1-' + Date.now())` with canonical `useRealtimeSubscription([{ table: 'orcamentos', onChange: reloadData }, { table: 'ordens_servico', onChange: reloadData }], [reloadData], { debounceMs: 400 })`.
2. Apply missing Row Security Filters and `enabled: Boolean(id)`:
   - `src/hooks/useClientNotifications.tsx`: Add `filter: \`cliente_id=eq.${clientId}\`` and `enabled: Boolean(clientId)` on `notificacoes`.
   - `src/components/modules/AfiliadoDashboard.tsx`: Add `filter: \`afiliado_id=eq.${affiliateId}\`` on `gsa_afiliados`, `gsa_afiliado_links`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques` and `filter: \`cliente_id=eq.${clientId}\`` on `saques`, with `enabled: Boolean(...)`.
   - `src/pages/PurchasesPage.tsx`: Add `filter: \`cliente_id=eq.${clientId}\`` on `loja_pedido_itens` and `enabled: Boolean(clientId)` on all tables.
   - `src/pages/CouponsPage.tsx`: Replace manual channel with `useRealtimeSubscription` and add `filter: \`cliente_id=eq.${clientId}\`` on `cupons_ativados` with `enabled: Boolean(clientId)`.
   - `src/components/drawers/PrestadorDetailDrawer.tsx`: Add `filter: \`id=eq.${prestador.id}\`` on `prestadores` and `filter: \`prestador_id=eq.${prestador.id}\`` on `prestador_demandas` with `enabled: Boolean(isOpen && prestador?.id)`.
3. Verify that `npx tsx scripts/check-realtime-audit.ts` runs and reports 0 legacy hook usages and no leaks.

## 2026-08-28T14:30:13Z
**Context**: Realtime P0 Critical Remediation — Milestone M3
**Content**: Checking in on status. Please report your progress on the assigned files (`ConfiguracoesModule.tsx`, `OrcamentosWorkstation.tsx`, `useClientNotifications.tsx`, `AfiliadoDashboard.tsx`, `PurchasesPage.tsx`, `CouponsPage.tsx`, `PrestadorDetailDrawer.tsx`) and test execution.
**Action**: Please complete remaining files and send your completion report.
