# Progress Log - Explorer R2 Batch 1

Last visited: 2026-08-28T10:41:10-03:00

## Status: Audited Components 1-18
- [x] Locate all 24 components in `src/`
- [x] Audit Components 1-6 (AcessosModule, AdminPrestadorDocumentos, AdvertiserPortal, AdvertisingAdminModule, AffiliateAdminModule, AfiliadoDashboard)
- [x] Audit Components 7-12 (AfiliadosSection, AreaVipView, AssinaturasModule, AtendimentoTicketsView, CalculadorasGatewayView, CareersAdminModule)
- [x] Audit Components 13-18 (CheckoutModal, CheckoutPage, ClassifiedsModule, ClientAffiliatePanel, ClientAreaVIP, ClientAssinaturas)
- [ ] Audit Components 19-24
- [ ] Cross-reference monitored tables with database schema/migrations/types
- [ ] Compile `analysis.md`
- [ ] Compile `handoff.md` and notify parent

### Key Findings in Chunk 3:
13. `CheckoutModal.tsx`: `useRealtimeSubscription` on `clientes` (filtered), `cupons_ativados` (filtered), `cupons_loja` with 150ms debounce and `enabled: isOpen && !!clientId`. 🟢 OK.
14. `CheckoutPage.tsx`: `useRealtimeSubscription` on `loja_carrinhos` (filtered), `clientes` (filtered), `produtos`, `cupons_loja`. 🟢 OK.
15. `ClassifiedsModule.tsx`: `useRealtimeSubscription` on 5 classificados tables with 300ms debounce. 🟢 OK.
16. `ClientAffiliatePanel.tsx`: `useRealtimeSubscription` on 6 tables with client filtering. 🟢 OK.
17. `ClientAreaVIP.tsx`: ⚠️ Duplicate subscription: uses both raw `supabase.channel('client-vip-changes')` and `useRealtimeSubscription`. 🟡 Alerta.
18. `ClientAssinaturas.tsx`: `useRealtimeSubscription` on `ordens_assinatura` (filtered), `faturas` (filtered), `assinaturas`. 🟢 OK.
