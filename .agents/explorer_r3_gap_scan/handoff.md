# Handoff Report - Explorer R3 (Missing Realtime Coverage Audit)

## 1. Observation
- Audited all 481 frontend files (`.ts`, `.tsx`) in `src/`.
- Verified 141 files already integrating Supabase Realtime via `useRealtimeSubscription`, `useRealtime`, `useRealtimeTable`, `subscribeToTable` or direct channel subscriptions.
- Identified 41 files performing Supabase queries without Realtime, of which 29 are active UI components/pages displaying mutable business entities (proposals, transactions, vouchers, reviews, coupons, live status, executive reports).
- Specifically observed:
  1. `src/components/client/marketplace/classifieds/ClassifiedsClientDashboard.tsx` (lines 55–106): Executes static `Promise.all` querying `classificados_anuncios`, `classificados_propostas`, `classificados_transacoes`, `classificados_comissoes` without realtime subscription.
  2. `src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx` (lines 13–39): Fetches `classificados_propostas` on tab switch or mount with static query.
  3. `src/components/client/marketplace/classifieds/MyClassifiedSalesPage.tsx` (lines 38–74): Fetches `classificados_transacoes` on mount without subscription.
  4. `src/components/client/marketplace/classifieds/MyClassifiedCommissionsPage.tsx` (lines 35–75): Fetches `classificados_comissoes` on mount.
  5. `src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx` (lines 18–36): Fetches `classificados_anuncios` and `classificados_ajustes`.
  6. `src/components/client/marketplace/travel/MyTripsPage.tsx` (lines 38–82): Fetches `viagens_transacoes`, `viagens_vouchers`, `viagens_propostas` with static queries.
  7. `src/components/client/store/ProductReviews.tsx` (lines 65–82): Fetches `loja_avaliacoes` via static helper.
  8. `src/components/client/store/StoreHubCoupons.tsx` (lines 26–100): Fetches `cupons_loja`, `cupons_ativados`, `orcamentos` only when modal opens.
  9. `src/components/admin/infra/WhatsAppQRCodeManager.tsx` (lines 112–188): Static queries for `system_settings` on mount.
  10. `src/components/admin/SystemStatusIndicator.tsx` (lines 43–77): One-shot synthetic probe on `clientes` table.
  11. `src/pages/AdminPanel.tsx` (lines 236–245): Static collaborator lookup without security revocation subscription.
  12. `src/components/admin/relatorios/` (15 report files): Static queries per period change without live stream.

## 2. Logic Chain
1. *From Observation 1–5:* Classifieds negotiations, proposals, adjustments, and transactions are P2P asynchronous workflows between buyers and sellers. When a buyer places an offer or seller counters, the counterparty must see the update without refreshing the page. Therefore, adding `useRealtimeSubscription` to `ClassifiedsClientDashboard.tsx`, `MyNegotiationsPage.tsx`, `MyClassifiedSalesPage.tsx`, `MyClassifiedCommissionsPage.tsx`, and `MyClassifiedsPage.tsx` is required (P0/P1).
2. *From Observation 6:* Travel package confirmations and ticket PDF voucher issuance (`viagens_vouchers`) are live operational fulfillment steps. Adding `useRealtimeSubscription` to `MyTripsPage.tsx` allows customers to download flight tickets immediately when issued (P0).
3. *From Observation 7–8:* Limited-quantity promo coupons and product rating reviews benefit from instant social proof and stock awareness. Adding `useRealtimeSubscription` (with `enabled: isOpen` on modals) ensures live data without channel leaks (P1).
4. *From Observation 9–11:* Infrastructure management (`WhatsAppQRCodeManager.tsx`), WebSocket connection health indicator (`SystemStatusIndicator.tsx`), and collaborator RBAC revocation (`AdminPanel.tsx`) must react to backend changes immediately for operational and security integrity (P0/P1).
5. *From Observation 12:* Executive and financial report dashboards currently require manual clicking on "Atualizar". Adding debounced subscriptions (`debounceMs: 500`) to `faturas`, `pagamentos`, `saques`, `ordens_servico` enables live cockpit monitoring.

## 3. Caveats
- Report components (`src/components/admin/relatorios/`) can query historical time ranges (e.g. past months). Realtime subscriptions on historical date ranges should only trigger re-fetches if the current date falls within the selected range or if debounced globally.
- Vitrines/public catalogs (`GeneralClassifiedsPage.tsx`, `TravelCategoryPage.tsx`) should maintain high debounce intervals (`1000ms`) to avoid UI jitter under burst traffic.

## 4. Conclusion
We identified 29 high-value components/pages currently lacking Realtime subscriptions. We produced a structured catalog and technical specification in `analysis.md` outlining the exact file path, Supabase tables, business justification, recommended hook (`useRealtimeSubscription`), row-level filters (`filter: 'cliente_id=eq...'`), event types, and debounce configurations.

## 5. Verification Method
1. Inspect the generated catalog:
   ```bash
   node -e "const fs = require('fs'); console.log(fs.readFileSync('.agents/explorer_r3_gap_scan/analysis.md', 'utf8').slice(0, 1500));"
   ```
2. Verify candidate components by viewing their imports and fetching blocks:
   - `src/components/client/marketplace/classifieds/ClassifiedsClientDashboard.tsx`
   - `src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx`
   - `src/components/client/marketplace/travel/MyTripsPage.tsx`
   - `src/components/admin/infra/WhatsAppQRCodeManager.tsx`
