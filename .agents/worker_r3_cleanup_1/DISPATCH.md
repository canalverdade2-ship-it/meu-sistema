## 2026-08-21T22:28:04Z

Perform the safe structural cleanup of the 49 verified dead / unreachable files identified in explorer_diag_cleanup_1/handoff.md §4.1:
- 29 dead files in src/components/admin/:
  - src/components/admin/AreaVIPModule.tsx
  - src/components/admin/EmpresaModule.tsx
  - src/components/admin/PrestadoresModule.tsx
  - src/components/admin/PromocoesModule.tsx
  - src/components/admin/TicketsModule.tsx
  - src/components/admin/products/ProductVariationsEditor.tsx
  - src/components/admin/ClientesModule.tsx
  - src/components/admin/CobrancaModule.tsx
  - src/components/admin/CreditoModule.tsx
  - src/components/admin/CuponsLojaModule.tsx
  - src/components/admin/EmprestimosModule.tsx
  - src/components/admin/FinanceiroModule.tsx
  - src/components/admin/IndicacoesModule.tsx
  - src/components/admin/LojaTrocasModule.tsx
  - src/components/admin/OrcamentosModule.tsx
  - src/components/admin/OrdensServicoModule.tsx
  - src/components/admin/PremiosModule.tsx
  - src/components/admin/PromoAnalytics.tsx
  - src/components/admin/PromocaoQuantidadeForm.tsx
  - src/components/admin/PromocaoQuantidadeModule.tsx
  - src/components/admin/PromoDetalhesModal.tsx
  - src/components/admin/ReembolsosModule.tsx
  - src/components/admin/VouchersModule.tsx
  - src/components/admin/clientes/AdminClienteDocumentos.tsx
  - src/components/admin/ecommerce/EcommerceAnalytics.tsx
  - src/components/admin/ecommerce/PricingPanel.tsx
  - src/components/admin/prestadores/PrestadoresCadastro.tsx
  - src/components/admin/prestadores/PrestadoresDemandas.tsx
  - src/components/admin/prestadores/PrestadoresFinanceiro.tsx
- 20 dead files in other src/ directories:
  - src/components/AppClientShell.tsx
  - src/components/client/marketplace/MarketplaceModuleCard.tsx
  - src/components/client/marketplace/TravelPackagesPage.tsx
  - src/components/client/store/HeroBannerCarousel.tsx
  - src/components/client/store/StoreHubCancelOrder.tsx
  - src/components/client/store/StoreHubExchanges.tsx
  - src/components/client/store/StoreHubRefunds.tsx
  - src/components/client/store/StoreHubVipPromos.tsx
  - src/components/public/BrandPortfolioDialog.tsx
  - src/components/public/FreeToolsCalculatorDialog.tsx
  - src/data/publicProjectTypes.ts
  - src/hooks/use-mobile.tsx
  - src/hooks/useStoreCart.ts
  - src/hooks/useStoreOrders.ts
  - src/hooks/useStoreProducts.ts
  - src/lib/error-capture.ts
  - src/lib/lovable-error-reporting.ts
  - src/routing/adminNavigation.ts
  - src/utils/paymentPropagation.ts
  - src/utils/vipStyles.ts

NOTE: DO NOT delete src/components/ui/CommandSlideOver.tsx or src/components/ui/TacticalDataGrid.tsx (re-export wrappers). DO NOT delete the 12 files referenced in scripts/check-*-contracts.ts.

After removing the 49 files:
1. Run npx tsc --noEmit and npm run typecheck:strict
2. Run npm run build
3. Run npm run test:unit
Verify that 0 errors occur and all tests continue to pass.
Write handoff.md with verification results and send a message to parent.
