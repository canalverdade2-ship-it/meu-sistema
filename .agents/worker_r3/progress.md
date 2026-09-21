# Progress Tracker — Worker R3 (Legacy Migration & Security Row Filters)

Last visited: 2026-08-28T14:35:45Z

## Tasks Status
- [x] Analyze code baseline and run realtime audit scanner (`scripts/check-realtime-audit.ts`)
- [x] Migrate `src/components/admin/ConfiguracoesModule.tsx` to `useRealtimeSubscription` (remove `useRealtimeTable` and disconnected `rtRefreshKey`)
- [x] Migrate `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` to `useRealtimeSubscription` for `orcamentos` & `ordens_servico`
- [x] Add `filter: cliente_id=eq.${clientId}` and `enabled: Boolean(clientId)` to `src/hooks/useClientNotifications.tsx`
- [x] Add row security filters and `enabled: Boolean(...)` to `src/pages/Afiliado/AfiliadoDashboard.tsx`
- [x] Add `filter: cliente_id=eq.${clientId}` on `loja_pedido_itens` and `enabled: Boolean(clientId)` across all subscriptions in `src/components/client/store/PurchasesPage.tsx`
- [x] Replace manual channel with `useRealtimeSubscription` in `src/components/client/store/CouponsPage.tsx` with `filter: cliente_id=eq.${clientId}` and `enabled: Boolean(clientId)`
- [x] Add row security filters (`id=eq.${prestador.id}`, `prestador_id=eq.${prestador.id}`) and `enabled: Boolean(isOpen && prestador?.id)` in `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx`
- [x] Run `npx tsx scripts/check-realtime-audit.ts` -> 100/100 Score, 0 legacy usages, 0 leaks
- [x] Run `npm run build` -> 100% SUCCESS
- [x] Run `npm run test:realtime` & `npm run test:affiliates` -> PASSED
- [x] Update BRIEFING.md and write comprehensive `handoff.md`
