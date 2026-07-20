# Auditoria Integral GSA - Inventario Inicial

Gerado em: 2026-07-19T03:03:04.826Z
Raiz: C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

## Escopo desta etapa
Este arquivo e um inventario estatico automatizado. Ele prova existencia por codigo/migrations, mas ainda nao substitui testes navegados, auditoria do banco real e validacao manual de fluxos.

## Totais
- Arquivos analisados: 476
- Arquivos em src/: 241
- Arquivos SQL: 125
- Migrations: 119

## Rotas encontradas em src/App.tsx
| route | source | line | evidence |
| --- | --- | --- | --- |
| /cliente/perfil | src/App.tsx | 62 | route-like literal |

## Paginas
- src/pages/AdminPanel.tsx
- src/pages/ClientPortal.tsx
- src/pages/Home.tsx
- src/pages/Prestador/PrestadorDashboard.tsx

## Componentes
- src/components/admin/AcessosModule.tsx
- src/components/admin/AreaVIPModule.tsx
- src/components/admin/AssinaturasModule.tsx
- src/components/admin/CadastroModule.tsx
- src/components/admin/ClassifiedsModule.tsx
- src/components/admin/clientes/AdminClienteDocumentos.tsx
- src/components/admin/ClientesModule.tsx
- src/components/admin/CobrancaModule.tsx
- src/components/admin/ConfiguracoesModule.tsx
- src/components/admin/CreditoModule.tsx
- src/components/admin/CuponsLojaModule.tsx
- src/components/admin/Dashboard.tsx
- src/components/admin/demandas/DemandasComentarios.tsx
- src/components/admin/demandas/DemandasDashboard.tsx
- src/components/admin/demandas/DemandasDetalhesModal.tsx
- src/components/admin/demandas/DemandasKanban.tsx
- src/components/admin/demandas/DemandasTabela.tsx
- src/components/admin/demandas/NovaDemandaModal.tsx
- src/components/admin/DemandasColaboradorModule.tsx
- src/components/admin/EmpresaModule.tsx
- src/components/admin/EmprestimosModule.tsx
- src/components/admin/FinanceiroModule.tsx
- src/components/admin/FiscalModule.tsx
- src/components/admin/IndicacoesModule.tsx
- src/components/admin/LojaCategoriasModule.tsx
- src/components/admin/LojaTrocasModule.tsx
- src/components/admin/OrcamentosModule.tsx
- src/components/admin/OrdensAssinaturaModule.tsx
- src/components/admin/OrdensCompraModule.tsx
- src/components/admin/OrdensServicoModule.tsx
- src/components/admin/PainelRentabilidade.tsx
- src/components/admin/PremiosModule.tsx
- src/components/admin/prestadores/AdminPrestadorDocumentos.tsx
- src/components/admin/prestadores/AdminPrestadorPremios.tsx
- src/components/admin/prestadores/AdminPrestadorPromocoes.tsx
- src/components/admin/prestadores/AdminPrestadorVouchers.tsx
- src/components/admin/prestadores/PrestadoresCadastro.tsx
- src/components/admin/prestadores/PrestadoresDemandas.tsx
- src/components/admin/prestadores/PrestadoresFinanceiro.tsx
- src/components/admin/PrestadoresModule.tsx
- src/components/admin/products/BarcodeScannerModal.tsx
- src/components/admin/products/BulkProductImportModal.tsx
- src/components/admin/products/import/ExcelImportSource.tsx
- src/components/admin/products/import/ImportSourceSelector.tsx
- src/components/admin/products/import/ImportSupplierMode.tsx
- src/components/admin/products/import/MediaImportSource.tsx
- src/components/admin/products/import/TextImportSource.tsx
- src/components/admin/products/import/UrlImportSource.tsx
- src/components/admin/ProdutosModule.tsx
- src/components/admin/PromoAnalytics.tsx
- src/components/admin/PromocaoQuantidadeForm.tsx
- src/components/admin/PromocaoQuantidadeModule.tsx
- src/components/admin/PromocoesModule.tsx
- src/components/admin/PromoDetalhesModal.tsx
- src/components/admin/ProtectionAdminModule.tsx
- src/components/admin/ReembolsosModule.tsx
- src/components/admin/relatorios/RelatorioClientes.tsx
- src/components/admin/relatorios/RelatorioCobranca.tsx
- src/components/admin/relatorios/RelatorioCredito.tsx
- src/components/admin/relatorios/RelatorioEmprestimos.tsx
- src/components/admin/relatorios/RelatorioExecutivo.tsx
- src/components/admin/relatorios/RelatorioFinanceiro.tsx
- src/components/admin/relatorios/RelatorioFiscal.tsx
- src/components/admin/relatorios/RelatorioGamificacao.tsx
- src/components/admin/relatorios/RelatorioLoja.tsx
- src/components/admin/relatorios/RelatorioMarketing.tsx
- src/components/admin/relatorios/RelatorioOperacional.tsx
- src/components/admin/relatorios/RelatorioOS.tsx
- src/components/admin/relatorios/RelatorioPrestadores.tsx
- src/components/admin/relatorios/RelatorioRentabilidade.tsx
- src/components/admin/relatorios/RelatorioSuporte.tsx
- src/components/admin/relatorios/utils/relatorioExport.ts
- src/components/admin/RelatoriosModule.tsx
- src/components/admin/ServicosModule.tsx
- src/components/admin/SystemMonitorModule.tsx
- src/components/admin/SystemStatusIndicator.tsx
- src/components/admin/TicketsModule.tsx
- src/components/admin/TravelAdminModule.tsx
- src/components/admin/ui/AdminWhatsAppButton.tsx
- src/components/admin/VendasModule.tsx
- src/components/admin/VouchersModule.tsx
- src/components/client/ClientAreaVIP.tsx
- src/components/client/ClientAssinaturas.tsx
- src/components/client/ClientCancelPromoModal.tsx
- src/components/client/ClientDashboard.tsx
- src/components/client/ClientEmprestimos.tsx
- src/components/client/ClientFidelidade.tsx
- src/components/client/ClientFinanceiro.tsx
- src/components/client/ClientGSAStore.tsx
- src/components/client/ClientIndiqueGanhe.tsx
- src/components/client/ClientMeuCredito.tsx
- src/components/client/ClientOrcamentos.tsx
- src/components/client/ClientPontos.tsx
- src/components/client/ClientPremios.tsx
- src/components/client/ClientProdutos.tsx
- src/components/client/ClientProfile.tsx
- src/components/client/ClientPromocoes.tsx
- src/components/client/ClientPromoDetalhesModal.tsx
- src/components/client/ClientServicos.tsx
- src/components/client/ClientServicosAssinaturas.tsx
- src/components/client/ClientSuporte.tsx
- src/components/client/ClientTransferencias.tsx
- src/components/client/ClientVouchers.tsx
- src/components/client/emprestimo/EmprestimoFormSteps.tsx
- src/components/client/financeiro/ExtratoList.tsx
- src/components/client/financeiro/FaturasList.tsx
- src/components/client/financeiro/NotasFiscaisList.tsx
- src/components/client/financeiro/PaymentModal.tsx
- src/components/client/financeiro/SaquesList.tsx
- src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx
- src/components/client/marketplace/classifieds/CreateListingWizard.tsx
- src/components/client/marketplace/classifieds/GeneralClassifiedsPage.tsx
- src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx
- src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx
- src/components/client/marketplace/classifieds/RealEstateMarketplacePage.tsx
- src/components/client/marketplace/classifieds/VehiclesMarketplacePage.tsx
- src/components/client/marketplace/ClassifiedsHubPage.tsx
- src/components/client/marketplace/MarketplaceGSAStore.tsx
- src/components/client/marketplace/MarketplaceHome.tsx
- src/components/client/marketplace/MarketplaceLanding.tsx
- src/components/client/marketplace/MarketplaceModuleCard.tsx
- src/components/client/marketplace/protection/ProtectionMarketplace.tsx
- src/components/client/marketplace/travel/MyTripsPage.tsx
- src/components/client/marketplace/travel/TravelCategoryPage.tsx
- src/components/client/marketplace/travel/TravelHubMenu.tsx
- src/components/client/marketplace/travel/TravelOffersLandingPage.tsx
- src/components/client/marketplace/travel/TravelPackageDetailPage.tsx
- src/components/client/marketplace/travel/TravelProposalsPage.tsx
- src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx
- src/components/client/marketplace/travel/TravelReservationPage.tsx
- src/components/client/marketplace/TravelPackagesPage.tsx
- src/components/client/store/AvailableCouponsModal.tsx
- src/components/client/store/CartDrawer.tsx
- src/components/client/store/CheckoutModal.tsx
- src/components/client/store/FilterModal.tsx
- src/components/client/store/ProductDetailsModal.tsx
- src/components/client/store/QuantityModal.tsx
- src/components/client/store/StoreHubCancelOrder.tsx
- src/components/client/store/StoreHubCoupons.tsx
- src/components/client/store/StoreHubExchanges.tsx
- src/components/client/store/StoreHubPurchases.tsx
- src/components/client/store/StoreHubRefunds.tsx
- src/components/client/store/StoreHubVipPromos.tsx
- src/components/client/store/StoreItemCard.tsx
- src/components/client/store/SubscriptionDurationModal.tsx
- src/components/client/StoreHub.tsx
- src/components/common/SupportConversationModal.tsx
- src/components/ErrorBoundary.tsx
- src/components/prestador/PrestadorAgenda.tsx
- src/components/prestador/PrestadorDemandas.tsx
- src/components/prestador/PrestadorDocumentos.tsx
- src/components/prestador/PrestadorFinanceiro.tsx
- src/components/prestador/PrestadorPremios.tsx
- src/components/prestador/PrestadorPromocoes.tsx
- src/components/prestador/PrestadorSuporte.tsx
- src/components/prestador/PrestadorVouchers.tsx
- src/components/public/GSAEnterpriseHome.tsx
- src/components/ui/DashboardLayout.tsx
- src/components/ui/EmptyState.tsx
- src/components/ui/FileViewerModal.tsx
- src/components/ui/FullscreenPrompt.tsx
- src/components/ui/GlobalFilter.tsx
- src/components/ui/LogoGSA.tsx
- src/components/ui/Modal.tsx
- src/components/ui/PinInput.tsx
- src/components/ui/UniversalNotificationBell.tsx
- src/components/ui/WhatsAppButton.tsx

## Hooks e Contextos
### Hooks
- src/hooks/useAdminNotifications.tsx
- src/hooks/useAutoFitTabs.ts
- src/hooks/useAutoLogout.tsx
- src/hooks/useClientNotifications.tsx
- src/hooks/useProviderNotifications.tsx
- src/hooks/useStoreCart.ts
- src/hooks/useStoreOrders.ts
- src/hooks/useStoreProducts.ts
- src/hooks/useVipLevels.ts
### Contextos
- src/contexts/FileViewerContext.tsx

## Metricas JSX por arquivo
| file | buttons | forms | inputs | selects | textareas | modals | toasts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| src/App.tsx | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| src/components/admin/AcessosModule.tsx | 26 | 3 | 9 | 2 | 1 | 19 | 26 |
| src/components/admin/AreaVIPModule.tsx | 12 | 0 | 8 | 1 | 2 | 2 | 11 |
| src/components/admin/AssinaturasModule.tsx | 15 | 1 | 9 | 2 | 1 | 11 | 19 |
| src/components/admin/CadastroModule.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/ClassifiedsModule.tsx | 7 | 0 | 0 | 0 | 0 | 0 | 6 |
| src/components/admin/clientes/AdminClienteDocumentos.tsx | 10 | 2 | 3 | 1 | 1 | 11 | 10 |
| src/components/admin/ClientesModule.tsx | 43 | 3 | 17 | 0 | 5 | 24 | 51 |
| src/components/admin/CobrancaModule.tsx | 29 | 0 | 14 | 5 | 3 | 23 | 25 |
| src/components/admin/ConfiguracoesModule.tsx | 18 | 1 | 22 | 10 | 4 | 14 | 18 |
| src/components/admin/CreditoModule.tsx | 29 | 0 | 14 | 2 | 2 | 4 | 39 |
| src/components/admin/CuponsLojaModule.tsx | 12 | 1 | 10 | 4 | 0 | 6 | 10 |
| src/components/admin/Dashboard.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 4 |
| src/components/admin/demandas/DemandasComentarios.tsx | 2 | 1 | 1 | 0 | 1 | 0 | 1 |
| src/components/admin/demandas/DemandasDashboard.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/demandas/DemandasDetalhesModal.tsx | 24 | 5 | 9 | 2 | 4 | 0 | 28 |
| src/components/admin/demandas/DemandasKanban.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/demandas/DemandasTabela.tsx | 5 | 0 | 1 | 4 | 0 | 0 | 0 |
| src/components/admin/demandas/NovaDemandaModal.tsx | 7 | 1 | 5 | 3 | 2 | 0 | 5 |
| src/components/admin/DemandasColaboradorModule.tsx | 4 | 0 | 0 | 0 | 0 | 3 | 1 |
| src/components/admin/EmpresaModule.tsx | 1 | 1 | 4 | 0 | 0 | 0 | 4 |
| src/components/admin/EmprestimosModule.tsx | 15 | 0 | 9 | 0 | 2 | 9 | 31 |
| src/components/admin/FinanceiroModule.tsx | 40 | 0 | 9 | 3 | 7 | 25 | 35 |
| src/components/admin/FiscalModule.tsx | 12 | 2 | 4 | 3 | 1 | 12 | 7 |
| src/components/admin/IndicacoesModule.tsx | 9 | 1 | 3 | 1 | 0 | 6 | 9 |
| src/components/admin/LojaCategoriasModule.tsx | 5 | 1 | 2 | 2 | 0 | 4 | 8 |
| src/components/admin/LojaTrocasModule.tsx | 11 | 0 | 4 | 0 | 1 | 4 | 6 |
| src/components/admin/OrcamentosModule.tsx | 30 | 0 | 17 | 6 | 2 | 18 | 26 |
| src/components/admin/OrdensAssinaturaModule.tsx | 7 | 0 | 2 | 0 | 0 | 10 | 8 |
| src/components/admin/OrdensCompraModule.tsx | 9 | 0 | 0 | 1 | 2 | 13 | 10 |
| src/components/admin/OrdensServicoModule.tsx | 18 | 0 | 2 | 0 | 1 | 11 | 11 |
| src/components/admin/PainelRentabilidade.tsx | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| src/components/admin/PremiosModule.tsx | 11 | 1 | 2 | 2 | 3 | 9 | 7 |
| src/components/admin/prestadores/AdminPrestadorDocumentos.tsx | 10 | 2 | 5 | 3 | 1 | 10 | 10 |
| src/components/admin/prestadores/AdminPrestadorPremios.tsx | 3 | 1 | 1 | 0 | 1 | 4 | 5 |
| src/components/admin/prestadores/AdminPrestadorPromocoes.tsx | 7 | 1 | 3 | 0 | 2 | 7 | 6 |
| src/components/admin/prestadores/AdminPrestadorVouchers.tsx | 4 | 1 | 2 | 0 | 0 | 4 | 7 |
| src/components/admin/prestadores/PrestadoresCadastro.tsx | 30 | 2 | 18 | 0 | 3 | 13 | 33 |
| src/components/admin/prestadores/PrestadoresDemandas.tsx | 40 | 7 | 12 | 4 | 6 | 29 | 28 |
| src/components/admin/prestadores/PrestadoresFinanceiro.tsx | 6 | 0 | 1 | 0 | 1 | 9 | 6 |
| src/components/admin/PrestadoresModule.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/products/BarcodeScannerModal.tsx | 6 | 0 | 0 | 0 | 0 | 4 | 2 |
| src/components/admin/products/BulkProductImportModal.tsx | 8 | 0 | 9 | 4 | 0 | 4 | 6 |
| src/components/admin/products/import/ExcelImportSource.tsx | 2 | 0 | 2 | 2 | 0 | 13 | 7 |
| src/components/admin/products/import/ImportSourceSelector.tsx | 5 | 0 | 0 | 0 | 0 | 2 | 0 |
| src/components/admin/products/import/ImportSupplierMode.tsx | 5 | 0 | 4 | 0 | 0 | 0 | 0 |
| src/components/admin/products/import/MediaImportSource.tsx | 0 | 0 | 1 | 0 | 0 | 0 | 5 |
| src/components/admin/products/import/TextImportSource.tsx | 0 | 0 | 1 | 0 | 0 | 0 | 3 |
| src/components/admin/products/import/UrlImportSource.tsx | 1 | 1 | 4 | 0 | 0 | 0 | 0 |
| src/components/admin/ProdutosModule.tsx | 44 | 2 | 35 | 5 | 2 | 14 | 47 |
| src/components/admin/PromoAnalytics.tsx | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| src/components/admin/PromocaoQuantidadeForm.tsx | 4 | 1 | 7 | 7 | 1 | 0 | 9 |
| src/components/admin/PromocaoQuantidadeModule.tsx | 5 | 0 | 1 | 0 | 0 | 4 | 3 |
| src/components/admin/PromocoesModule.tsx | 3 | 1 | 5 | 3 | 1 | 4 | 6 |
| src/components/admin/PromoDetalhesModal.tsx | 4 | 0 | 0 | 0 | 0 | 4 | 1 |
| src/components/admin/ProtectionAdminModule.tsx | 12 | 0 | 4 | 5 | 2 | 3 | 8 |
| src/components/admin/ReembolsosModule.tsx | 12 | 0 | 3 | 0 | 2 | 15 | 9 |
| src/components/admin/relatorios/RelatorioClientes.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioCobranca.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioCredito.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioEmprestimos.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioExecutivo.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioFinanceiro.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioFiscal.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioGamificacao.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioLoja.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioMarketing.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioOperacional.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioOS.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioPrestadores.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioRentabilidade.tsx | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| src/components/admin/relatorios/RelatorioSuporte.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/RelatoriosModule.tsx | 4 | 0 | 2 | 0 | 0 | 0 | 0 |
| src/components/admin/ServicosModule.tsx | 15 | 1 | 7 | 0 | 1 | 11 | 15 |
| src/components/admin/SystemMonitorModule.tsx | 7 | 0 | 3 | 0 | 0 | 6 | 6 |
| src/components/admin/SystemStatusIndicator.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/TicketsModule.tsx | 7 | 0 | 2 | 0 | 0 | 4 | 4 |
| src/components/admin/TravelAdminModule.tsx | 7 | 0 | 0 | 0 | 0 | 2 | 1 |
| src/components/admin/ui/AdminWhatsAppButton.tsx | 6 | 0 | 0 | 0 | 0 | 2 | 0 |
| src/components/admin/VendasModule.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/admin/VouchersModule.tsx | 15 | 1 | 4 | 1 | 1 | 9 | 6 |
| src/components/client/ClientAreaVIP.tsx | 5 | 0 | 0 | 0 | 0 | 4 | 6 |
| src/components/client/ClientAssinaturas.tsx | 7 | 0 | 2 | 0 | 0 | 9 | 5 |
| src/components/client/ClientCancelPromoModal.tsx | 2 | 0 | 0 | 0 | 1 | 4 | 0 |
| src/components/client/ClientDashboard.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/ClientEmprestimos.tsx | 25 | 0 | 8 | 3 | 0 | 20 | 21 |
| src/components/client/ClientFidelidade.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/ClientFinanceiro.tsx | 9 | 0 | 0 | 0 | 0 | 2 | 4 |
| src/components/client/ClientGSAStore.tsx | 6 | 0 | 1 | 0 | 0 | 47 | 29 |
| src/components/client/ClientIndiqueGanhe.tsx | 8 | 0 | 2 | 0 | 0 | 8 | 11 |
| src/components/client/ClientMeuCredito.tsx | 23 | 1 | 15 | 4 | 0 | 18 | 24 |
| src/components/client/ClientOrcamentos.tsx | 36 | 0 | 7 | 1 | 5 | 11 | 31 |
| src/components/client/ClientPontos.tsx | 9 | 0 | 1 | 0 | 0 | 9 | 6 |
| src/components/client/ClientPremios.tsx | 7 | 0 | 1 | 0 | 0 | 8 | 5 |
| src/components/client/ClientProdutos.tsx | 4 | 0 | 0 | 0 | 0 | 4 | 2 |
| src/components/client/ClientProfile.tsx | 19 | 1 | 2 | 1 | 2 | 11 | 16 |
| src/components/client/ClientPromocoes.tsx | 5 | 0 | 0 | 0 | 0 | 0 | 4 |
| src/components/client/ClientPromoDetalhesModal.tsx | 1 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/ClientServicos.tsx | 12 | 1 | 3 | 0 | 0 | 4 | 4 |
| src/components/client/ClientServicosAssinaturas.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/ClientSuporte.tsx | 7 | 1 | 3 | 0 | 1 | 6 | 3 |
| src/components/client/ClientTransferencias.tsx | 12 | 0 | 2 | 0 | 1 | 12 | 13 |
| src/components/client/ClientVouchers.tsx | 5 | 0 | 0 | 0 | 0 | 4 | 4 |
| src/components/client/emprestimo/EmprestimoFormSteps.tsx | 2 | 0 | 11 | 0 | 0 | 0 | 3 |
| src/components/client/financeiro/ExtratoList.tsx | 5 | 0 | 1 | 0 | 0 | 6 | 2 |
| src/components/client/financeiro/FaturasList.tsx | 10 | 0 | 0 | 2 | 1 | 4 | 5 |
| src/components/client/financeiro/NotasFiscaisList.tsx | 3 | 0 | 1 | 0 | 0 | 4 | 0 |
| src/components/client/financeiro/PaymentModal.tsx | 12 | 0 | 1 | 0 | 0 | 7 | 7 |
| src/components/client/financeiro/SaquesList.tsx | 5 | 0 | 1 | 1 | 1 | 6 | 10 |
| src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx | 7 | 0 | 0 | 0 | 0 | 1 | 0 |
| src/components/client/marketplace/classifieds/CreateListingWizard.tsx | 11 | 0 | 9 | 0 | 1 | 0 | 2 |
| src/components/client/marketplace/classifieds/GeneralClassifiedsPage.tsx | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/classifieds/RealEstateMarketplacePage.tsx | 1 | 0 | 1 | 1 | 0 | 0 | 0 |
| src/components/client/marketplace/classifieds/VehiclesMarketplacePage.tsx | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/ClassifiedsHubPage.tsx | 12 | 0 | 1 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/MarketplaceHome.tsx | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/MarketplaceLanding.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/MarketplaceModuleCard.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/protection/ProtectionMarketplace.tsx | 24 | 0 | 4 | 2 | 1 | 0 | 0 |
| src/components/client/marketplace/travel/MyTripsPage.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/travel/TravelCategoryPage.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 1 |
| src/components/client/marketplace/travel/TravelHubMenu.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/travel/TravelOffersLandingPage.tsx | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/marketplace/travel/TravelPackageDetailPage.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 1 |
| src/components/client/marketplace/travel/TravelProposalsPage.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 2 |
| src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx | 2 | 1 | 9 | 2 | 1 | 0 | 2 |
| src/components/client/marketplace/travel/TravelReservationPage.tsx | 6 | 0 | 3 | 1 | 0 | 0 | 3 |
| src/components/client/marketplace/TravelPackagesPage.tsx | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/client/store/AvailableCouponsModal.tsx | 0 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/CartDrawer.tsx | 13 | 0 | 2 | 0 | 0 | 3 | 0 |
| src/components/client/store/CheckoutModal.tsx | 16 | 0 | 12 | 1 | 0 | 4 | 25 |
| src/components/client/store/FilterModal.tsx | 3 | 0 | 2 | 0 | 0 | 4 | 0 |
| src/components/client/store/ProductDetailsModal.tsx | 4 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/QuantityModal.tsx | 3 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/StoreHubCancelOrder.tsx | 2 | 0 | 1 | 0 | 1 | 4 | 0 |
| src/components/client/store/StoreHubCoupons.tsx | 3 | 0 | 0 | 0 | 0 | 4 | 6 |
| src/components/client/store/StoreHubExchanges.tsx | 20 | 0 | 4 | 0 | 1 | 5 | 4 |
| src/components/client/store/StoreHubPurchases.tsx | 2 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/StoreHubRefunds.tsx | 2 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/StoreHubVipPromos.tsx | 1 | 0 | 0 | 0 | 0 | 4 | 0 |
| src/components/client/store/StoreItemCard.tsx | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| src/components/client/store/SubscriptionDurationModal.tsx | 3 | 0 | 1 | 0 | 0 | 4 | 0 |
| src/components/client/StoreHub.tsx | 32 | 0 | 5 | 0 | 2 | 24 | 27 |
| src/components/common/SupportConversationModal.tsx | 4 | 1 | 1 | 0 | 0 | 7 | 5 |
| src/components/ErrorBoundary.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/prestador/PrestadorAgenda.tsx | 10 | 1 | 2 | 1 | 1 | 8 | 9 |
| src/components/prestador/PrestadorDemandas.tsx | 20 | 3 | 5 | 0 | 4 | 15 | 19 |
| src/components/prestador/PrestadorDocumentos.tsx | 5 | 1 | 1 | 1 | 0 | 4 | 3 |
| src/components/prestador/PrestadorFinanceiro.tsx | 11 | 0 | 1 | 1 | 1 | 13 | 8 |
| src/components/prestador/PrestadorPremios.tsx | 6 | 0 | 0 | 0 | 0 | 8 | 6 |
| src/components/prestador/PrestadorPromocoes.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| src/components/prestador/PrestadorSuporte.tsx | 7 | 1 | 3 | 0 | 1 | 7 | 3 |
| src/components/prestador/PrestadorVouchers.tsx | 3 | 0 | 0 | 1 | 0 | 5 | 3 |
| src/components/public/GSAEnterpriseHome.tsx | 26 | 0 | 3 | 2 | 1 | 0 | 7 |
| src/components/ui/DashboardLayout.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/EmptyState.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/FileViewerModal.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/FullscreenPrompt.tsx | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/GlobalFilter.tsx | 4 | 0 | 2 | 1 | 0 | 0 | 0 |
| src/components/ui/Modal.tsx | 1 | 0 | 0 | 0 | 0 | 6 | 0 |
| src/components/ui/PinInput.tsx | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| src/components/ui/UniversalNotificationBell.tsx | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/components/ui/WhatsAppButton.tsx | 0 | 0 | 0 | 0 | 0 | 3 | 0 |
| src/hooks/useAdminNotifications.tsx | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| src/lib/notifications.tsx | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| src/pages/AdminPanel.tsx | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| src/pages/ClientPortal.tsx | 16 | 0 | 0 | 0 | 0 | 3 | 13 |
| src/pages/Home.tsx | 54 | 7 | 26 | 0 | 2 | 11 | 59 |
| src/pages/Prestador/PrestadorDashboard.tsx | 17 | 1 | 5 | 0 | 1 | 5 | 9 |

## Supabase - tabelas usadas no codigo
- ...: 1 referencia(s)
- ${domain}_cotacoes: 2 referencia(s)
- ${domain}_parceiros: 2 referencia(s)
- ${domain}_propostas: 1 referencia(s)
- admin_notificacoes: 3 referencia(s)
- assinaturas: 18 referencia(s)
- carteira_lancamentos: 3 referencia(s)
- classificados_anuncios: 8 referencia(s)
- classificados_comissoes_config: 1 referencia(s)
- classificados_mensagens: 1 referencia(s)
- classificados_propostas: 1 referencia(s)
- classificados_transacoes: 1 referencia(s)
- client_levels: 10 referencia(s)
- cliente_documentos: 7 referencia(s)
- cliente_notas_admin: 4 referencia(s)
- cliente_premios: 10 referencia(s)
- cliente_promocoes: 13 referencia(s)
- clientes: 76 referencia(s)
- cobrancas: 5 referencia(s)
- colaborador_modulos: 2 referencia(s)
- colaboradores: 12 referencia(s)
- cupons_ativados: 4 referencia(s)
- cupons_loja: 15 referencia(s)
- demanda_comentarios: 2 referencia(s)
- empresa: 14 referencia(s)
- emprestimo_comentarios: 9 referencia(s)
- emprestimo_documentos: 6 referencia(s)
- emprestimo_historico: 8 referencia(s)
- emprestimo_parcelas: 8 referencia(s)
- emprestimos: 13 referencia(s)
- extrato_financeiro: 9 referencia(s)
- fatura_contestacoes: 3 referencia(s)
- faturas: 56 referencia(s)
- formas_pagamento: 4 referencia(s)
- funcoes: 3 referencia(s)
- gsa-store-images: 4 referencia(s)
- indicacoes: 19 referencia(s)
- level_history: 3 referencia(s)
- loja_avaliacoes: 2 referencia(s)
- loja_carrinhos: 7 referencia(s)
- loja_categorias: 10 referencia(s)
- loja_credito_documentos: 2 referencia(s)
- loja_credito_movimentacoes: 5 referencia(s)
- loja_credito_solicitacoes: 8 referencia(s)
- loja_estoque_historico: 2 referencia(s)
- loja_pedido_itens: 1 referencia(s)
- loja_reembolsos: 7 referencia(s)
- loja_solicitacoes: 10 referencia(s)
- notificacoes: 18 referencia(s)
- orcamentos: 49 referencia(s)
- ordens_assinatura: 24 referencia(s)
- ordens_compra: 21 referencia(s)
- ordens_fiscais: 12 referencia(s)
- ordens_servico: 24 referencia(s)
- os_notas: 14 referencia(s)
- os_suporte_mensagens: 5 referencia(s)
- pagamentos: 4 referencia(s)
- points_transactions: 7 referencia(s)
- pontos_movimentacoes: 10 referencia(s)
- prestador_agendamentos: 5 referencia(s)
- prestador_demandas: 52 referencia(s)
- prestador_demandas_historico: 5 referencia(s)
- prestador_documentos: 8 referencia(s)
- prestador_faturas: 1 referencia(s)
- prestador_historico: 2 referencia(s)
- prestador_premios: 5 referencia(s)
- prestador_promocoes: 6 referencia(s)
- prestador_promocoes_ativacoes: 3 referencia(s)
- prestador_saques: 7 referencia(s)
- prestador_suporte_demandas: 3 referencia(s)
- prestador_transacoes: 9 referencia(s)
- prestador_vouchers: 6 referencia(s)
- prestadores: 23 referencia(s)
- produtos: 27 referencia(s)
- promocoes: 11 referencia(s)
- promocoes_quantidade: 10 referencia(s)
- promocoes_quantidade_ativadas: 2 referencia(s)
- promocoes_quantidade_uso: 2 referencia(s)
- saques: 7 referencia(s)
- servicos: 13 referencia(s)
- sistema_logs: 10 referencia(s)
- sistema_sessoes: 1 referencia(s)
- solicitacoes_exclusao: 7 referencia(s)
- suporte_mensagens: 2 referencia(s)
- system_settings: 21 referencia(s)
- ticket_mensagens: 8 referencia(s)
- tickets: 21 referencia(s)
- transferencias: 7 referencia(s)
- viagens_orcamentos: 2 referencia(s)
- viagens_pacotes: 2 referencia(s)
- viagens_propostas: 2 referencia(s)
- viagens_transacoes: 2 referencia(s)
- vouchers: 11 referencia(s)

## Supabase - RPCs usadas no codigo
- check_file_references: 3 referencia(s)
- cliente_operational_write: 1 referencia(s)
- delete_client_cascade: 1 referencia(s)
- execute_sql: 2 referencia(s)
- fn_marcar_faturas_vencidas: 1 referencia(s)
- get_admin_counts: 1 referencia(s)
- get_admin_pendency_counts: 1 referencia(s)
- get_client_pendency_counts: 1 referencia(s)
- get_database_details: 1 referencia(s)
- get_provider_pendency_counts: 1 referencia(s)
- get_system_metrics: 1 referencia(s)
- gsa_admin_ajustar_limite_credito_cliente: 1 referencia(s)
- gsa_admin_ajustar_saldo_cliente: 1 referencia(s)
- gsa_admin_alterar_status_cliente: 1 referencia(s)
- gsa_admin_aplicar_ajuste_fatura: 1 referencia(s)
- gsa_admin_aprovar_aumento_credito: 1 referencia(s)
- gsa_admin_atualizar_dados_cliente: 1 referencia(s)
- gsa_admin_atualizar_documento_credito: 1 referencia(s)
- gsa_admin_atualizar_solicitacao_loja: 1 referencia(s)
- gsa_admin_atualizar_status_cliente: 5 referencia(s)
- gsa_admin_authorize_product_url_import: 1 referencia(s)
- gsa_admin_baixar_cobranca_manual: 1 referencia(s)
- gsa_admin_baixar_fatura: 2 referencia(s)
- gsa_admin_baixar_parcela_cobranca: 1 referencia(s)
- gsa_admin_cancelar_acordo_cobranca: 1 referencia(s)
- gsa_admin_cancelar_fatura: 1 referencia(s)
- gsa_admin_check_product_barcode: 1 referencia(s)
- gsa_admin_clear_access_history: 1 referencia(s)
- gsa_admin_criar_cliente: 1 referencia(s)
- gsa_admin_criar_cobranca_fatura: 1 referencia(s)
- gsa_admin_criar_fatura_manual: 1 referencia(s)
- gsa_admin_definir_parcelamento_credito: 1 referencia(s)
- gsa_admin_desbloquear_pin_cliente: 1 referencia(s)
- gsa_admin_emprestimo_aprovar: 1 referencia(s)
- gsa_admin_emprestimo_atualizar_documento: 2 referencia(s)
- gsa_admin_emprestimo_atualizar_status: 4 referencia(s)
- gsa_admin_emprestimo_enviar_comentario: 1 referencia(s)
- gsa_admin_emprestimo_enviar_contrato: 1 referencia(s)
- gsa_admin_emprestimo_enviar_oferta_quitacao: 1 referencia(s)
- gsa_admin_emprestimo_enviar_proposta: 1 referencia(s)
- gsa_admin_emprestimo_salvar_observacao: 1 referencia(s)
- gsa_admin_enviar_fatura_cobranca: 1 referencia(s)
- gsa_admin_enviar_oferta_quitacao_credito: 1 referencia(s)
- gsa_admin_excluir_cobranca: 1 referencia(s)
- gsa_admin_gerar_acordo_cobranca: 1 referencia(s)
- gsa_admin_import_products_batch_v2: 1 referencia(s)
- gsa_admin_liberar_credito_contrato: 1 referencia(s)
- gsa_admin_mudar_status_cobranca: 1 referencia(s)
- gsa_admin_preaprovar_credito: 1 referencia(s)
- gsa_admin_processar_saque: 3 referencia(s)
- gsa_admin_processar_saque_prestador: 2 referencia(s)
- gsa_admin_processar_transferencia: 3 referencia(s)
- gsa_admin_protestar_cobranca: 1 referencia(s)
- gsa_admin_recusar_credito: 1 referencia(s)
- gsa_admin_registrar_cobranca_historico: 2 referencia(s)
- gsa_admin_rejeitar_contrato_credito: 1 referencia(s)
- gsa_admin_session_actor: 1 referencia(s)
- gsa_admin_solicitar_documento_credito: 1 referencia(s)
- gsa_change_own_pin: 1 referencia(s)
- gsa_end_session: 3 referencia(s)
- gsa_get_client_session_access_state: 2 referencia(s)
- gsa_log_action: 1 referencia(s)
- gsa_login_admin: 1 referencia(s)
- gsa_login_colaborador: 1 referencia(s)
- gsa_login_pin: 1 referencia(s)
- gsa_lookup_portal_account: 1 referencia(s)
- gsa_ping_session: 1 referencia(s)
- gsa_public_create_enterprise_budget: 1 referencia(s)
- gsa_public_lookup_referral: 1 referencia(s)
- gsa_public_register_client: 1 referencia(s)
- gsa_public_register_provider: 1 referencia(s)
- gsa_recuperar_senha_cliente: 2 referencia(s)
- gsa_set_pin_and_login: 1 referencia(s)
- gsa_update_client_pin: 2 referencia(s)
- gsa_validate_session: 2 referencia(s)
- gsa_verify_own_pin: 1 referencia(s)
- increment_comentarios: 1 referencia(s)
- process_expired_quitacoes: 1 referencia(s)
- processar_bonus_boas_vindas_seguro: 1 referencia(s)
- rpc_criar_anuncio_classificado: 1 referencia(s)
- rpc_moderar_mensagem_classificado: 1 referencia(s)

## Supabase - realtime
### Canais
- admin-all-updates: 1 referencia(s)
- admin-assinaturas-updates: 1 referencia(s)
- admin-cliente-docs-${clienteId}: 1 referencia(s)
- admin-clientes-realtime: 1 referencia(s)
- admin-cobrancas-rt-${Date.now()}: 1 referencia(s)
- admin-colab: 1 referencia(s)
- admin-credito-realtime: 1 referencia(s)
- admin-cupons-loja-updates: 1 referencia(s)
- admin-dashboard-realtime: 1 referencia(s)
- admin-empresa-rt-${Date.now()}: 1 referencia(s)
- admin-emprestimos-realtime: 1 referencia(s)
- admin-faturas-rt-${Date.now()}: 1 referencia(s)
- admin-fiscal-rt: 1 referencia(s)
- admin-func: 1 referencia(s)
- admin-indicacoes-updates: 1 referencia(s)
- admin-loja-solicitacoes-updates: 1 referencia(s)
- admin-notifs: 1 referencia(s)
- admin-orcamentos-rt-${Date.now()}: 1 referencia(s)
- admin-ordens-assinatura-updates: 1 referencia(s)
- admin-ordens-compra-updates: 1 referencia(s)
- admin-os-rt-${Date.now()}: 1 referencia(s)
- admin-os-suporte-chat: 1 referencia(s)
- admin-os-suporte-chat-detalhes: 1 referencia(s)
- admin-premios-${prestadorId}: 1 referencia(s)
- admin-premios-rt-${Date.now()}: 1 referencia(s)
- admin-prestador-demandas-changes: 1 referencia(s)
- admin-prestador-documentos: 1 referencia(s)
- admin-produtos-updates: 1 referencia(s)
- admin-promocoes-global: 1 referencia(s)
- admin-promocoes-updates: 2 referencia(s)
- admin-reembolsos-updates: 1 referencia(s)
- admin-saques-rt-${Date.now() + 1}: 1 referencia(s)
- admin-security-${colabId}: 1 referencia(s)
- admin-servicos-updates: 1 referencia(s)
- admin-sess: 1 referencia(s)
- admin-settings-sync: 1 referencia(s)
- admin-sol: 1 referencia(s)
- admin-tickets-rt-${Date.now()}: 1 referencia(s)
- admin-transferencias-rt-${Date.now() + 2}: 1 referencia(s)
- admin-vouchers-${activeTab}-${version}: 1 referencia(s)
- admin-vouchers-${prestadorId}: 1 referencia(s)
- area-vip-admin-changes: 1 referencia(s)
- cart-${clientId}: 1 referencia(s)
- categorias-changes: 1 referencia(s)
- client-assinaturas-updates: 1 referencia(s)
- client-emprestimos-${clientId}: 1 referencia(s)
- client-faturas-updates: 1 referencia(s)
- client-financeiro-cliente-updates: 1 referencia(s)
- client-financeiro-faturas-updates: 1 referencia(s)
- client-financeiro-settings-updates: 1 referencia(s)
- client-financeiro-tickets-updates: 1 referencia(s)
- client-meu-credito-${clientId}: 1 referencia(s)
- client-minhas-promocoes-updates: 1 referencia(s)
- client-nf-updates: 1 referencia(s)
- client-orc-rt-${clientId}-${Date.now()}: 1 referencia(s)
- client-os-rt-${clientId}-${Date.now()}: 1 referencia(s)
- client-produtos-updates: 1 referencia(s)
- client-promocoes-updates: 1 referencia(s)
- client-saques-updates: 1 referencia(s)
- client-security-${clientId}: 1 referencia(s)
- client-transferencias-${clientId}: 1 referencia(s)
- client-vip-changes: 1 referencia(s)
- cliente-details-${cliente.id}: 1 referencia(s)
- cliente-documentos-${cliente.id}: 1 referencia(s)
- cliente-updates-${clientId}: 1 referencia(s)
- colaborador-demandas-rt: 1 referencia(s)
- demanda-comentarios-${demandaId}: 1 referencia(s)
- extrato-upd: 1 referencia(s)
- general-notifs: 1 referencia(s)
- global-vip-changes: 1 referencia(s)
- gsa-store-coupons: 1 referencia(s)
- gsa-store-items: 1 referencia(s)
- gsa-store-promos: 1 referencia(s)
- indicacoes-updates: 1 referencia(s)
- level-history-${clientId}: 1 referencia(s)
- notas-updates: 1 referencia(s)
- notif-client-${clientId}: 1 referencia(s)
- notif-direct-${clientId}: 1 referencia(s)
- os-suporte-chat: 1 referencia(s)
- pontos-updates: 1 referencia(s)
- premios-updates: 1 referencia(s)
- prestador-agendamentos-${prestadorId}: 1 referencia(s)
- prestador-dashboard-realtime: 1 referencia(s)
- prestador-demandas-${prestadorId}: 1 referencia(s)
- prestador-documentos-${prestadorId}: 1 referencia(s)
- prestador-financeiro-${prestadorId}: 1 referencia(s)
- prestador-premios-${prestadorId}: 1 referencia(s)
- prestador-promocoes-${prestadorId}: 1 referencia(s)
- prestador-saques-admin-changes: 1 referencia(s)
- prestador-ticket-msg-${selectedTicket.id}: 1 referencia(s)
- prestador-tickets-${prestadorId}: 1 referencia(s)
- prestador-vouchers-${prestadorId}: 1 referencia(s)
- prestadores-admin-changes: 1 referencia(s)
- prestadores-changes: 1 referencia(s)
- promos-${clientId}: 1 referencia(s)
- provider-security-${prestadorId}: 1 referencia(s)
- provider-updates-${prestadorId}: 1 referencia(s)
- purchases-${clientId}: 1 referencia(s)
- refunds-${clientId}: 1 referencia(s)
- sessao-check-${sessaoId}: 1 referencia(s)
- store-products-changes: 1 referencia(s)
- suporte_mensagens_${currentSuporte.id}: 1 referencia(s)
- suporte_status_${currentSuporte.id}: 1 referencia(s)
- system-settings-updates-home: 1 referencia(s)
- ticket_${selectedTicket.id}: 2 referencia(s)
- tickets-updates: 1 referencia(s)
- vip-module-config-${clientId}: 1 referencia(s)
- vouchers-updates: 1 referencia(s)
- wa-sync-store: 1 referencia(s)
- whatsapp-float-sync: 1 referencia(s)
### Tabelas em listeners
- admin_notificacoes: 3 referencia(s)
- assinaturas: 2 referencia(s)
- client_levels: 3 referencia(s)
- cliente_documentos: 2 referencia(s)
- cliente_notas_admin: 1 referencia(s)
- cliente_premios: 2 referencia(s)
- cliente_promocoes: 2 referencia(s)
- clientes: 9 referencia(s)
- cobranca_acordo_parcelas: 1 referencia(s)
- cobranca_historico: 1 referencia(s)
- cobrancas: 1 referencia(s)
- colaboradores: 3 referencia(s)
- cupons_loja: 2 referencia(s)
- demanda_comentarios: 1 referencia(s)
- empresa: 1 referencia(s)
- emprestimo_comentarios: 2 referencia(s)
- emprestimo_documentos: 2 referencia(s)
- emprestimo_historico: 2 referencia(s)
- emprestimo_parcelas: 2 referencia(s)
- emprestimos: 2 referencia(s)
- extrato_financeiro: 2 referencia(s)
- faturas: 6 referencia(s)
- funcoes: 2 referencia(s)
- indicacoes: 2 referencia(s)
- level_history: 1 referencia(s)
- loja_carrinhos: 1 referencia(s)
- loja_categorias: 1 referencia(s)
- loja_credito_documentos: 2 referencia(s)
- loja_credito_movimentacoes: 2 referencia(s)
- loja_credito_solicitacoes: 2 referencia(s)
- loja_reembolsos: 2 referencia(s)
- loja_solicitacoes: 1 referencia(s)
- notificacoes: 4 referencia(s)
- orcamentos: 6 referencia(s)
- ordens_assinatura: 3 referencia(s)
- ordens_compra: 3 referencia(s)
- ordens_fiscais: 2 referencia(s)
- ordens_servico: 6 referencia(s)
- os_notas: 1 referencia(s)
- os_suporte_mensagens: 3 referencia(s)
- points_transactions: 1 referencia(s)
- pontos_movimentacoes: 2 referencia(s)
- prestador_agendamentos: 1 referencia(s)
- prestador_demandas: 6 referencia(s)
- prestador_demandas_historico: 2 referencia(s)
- prestador_documentos: 3 referencia(s)
- prestador_premios: 2 referencia(s)
- prestador_promocoes: 2 referencia(s)
- prestador_promocoes_ativacoes: 1 referencia(s)
- prestador_saques: 4 referencia(s)
- prestador_suporte_demandas: 3 referencia(s)
- prestador_transacoes: 2 referencia(s)
- prestador_vouchers: 2 referencia(s)
- prestadores: 7 referencia(s)
- produtos: 3 referencia(s)
- promocoes: 2 referencia(s)
- promocoes_quantidade: 2 referencia(s)
- saques: 2 referencia(s)
- servicos: 2 referencia(s)
- sistema_sessoes: 2 referencia(s)
- solicitacoes_exclusao: 1 referencia(s)
- suporte_mensagens: 1 referencia(s)
- system_settings: 7 referencia(s)
- ticket_mensagens: 3 referencia(s)
- tickets: 7 referencia(s)
- transferencias: 2 referencia(s)
- vouchers: 2 referencia(s)
### Eventos
- *: 141 referencia(s)
- DELETE: 3 referencia(s)
- INSERT: 13 referencia(s)
- UPDATE: 15 referencia(s)

## Supabase - storage
- documentos_cliente: 20 referencia(s)
- documentos_prestador: 8 referencia(s)
- emprestimos: 12 referencia(s)
- entregas_demandas: 22 referencia(s)
- fiscal_docs: 4 referencia(s)
- gsa-store-images: 22 referencia(s)
- orcamentos: 4 referencia(s)

## Banco - tabelas criadas/alteradas em SQL
- assinaturas: 1 referencia(s)
- carteira_lancamentos: 1 referencia(s)
- classificados_anuncio_midias: 1 referencia(s)
- classificados_anuncios: 1 referencia(s)
- classificados_comissoes: 1 referencia(s)
- classificados_comissoes_config: 1 referencia(s)
- classificados_comprovantes: 1 referencia(s)
- classificados_configuracoes: 1 referencia(s)
- classificados_mensagens: 1 referencia(s)
- classificados_propostas: 1 referencia(s)
- classificados_transacoes: 1 referencia(s)
- client_levels: 1 referencia(s)
- cliente_premios: 1 referencia(s)
- cliente_promocoes: 1 referencia(s)
- clientes: 1 referencia(s)
- cobranca_acordo_parcelas: 1 referencia(s)
- cobranca_historico: 1 referencia(s)
- cobrancas: 1 referencia(s)
- colaborador_modulos: 1 referencia(s)
- colaboradores: 1 referencia(s)
- debug_admin_rpc: 1 referencia(s)
- empresa: 1 referencia(s)
- emprestimo_parcelas: 1 referencia(s)
- emprestimos: 1 referencia(s)
- extrato_financeiro: 1 referencia(s)
- faturas: 1 referencia(s)
- formas_pagamento: 1 referencia(s)
- funcoes: 1 referencia(s)
- gsa_auth_attempts: 1 referencia(s)
- gsa_auth_identities: 1 referencia(s)
- gsa_client_operation_requests: 1 referencia(s)
- gsa_public_rate_limits: 1 referencia(s)
- gsa_voucher_resgates: 1 referencia(s)
- indicacoes: 1 referencia(s)
- inventario_produtos: 1 referencia(s)
- level_history: 1 referencia(s)
- loja_carrinhos: 1 referencia(s)
- loja_categorias: 1 referencia(s)
- loja_pedido_itens: 1 referencia(s)
- loja_reembolsos: 1 referencia(s)
- loja_solicitacoes: 1 referencia(s)
- notificacoes: 1 referencia(s)
- orcamento_timeline: 1 referencia(s)
- orcamentos: 1 referencia(s)
- ordens_assinatura: 1 referencia(s)
- ordens_compra: 1 referencia(s)
- ordens_servico: 1 referencia(s)
- os_notas: 1 referencia(s)
- os_suporte_mensagens: 1 referencia(s)
- pagamentos: 1 referencia(s)
- points_transactions: 1 referencia(s)
- pontos_movimentacoes: 1 referencia(s)
- prestador_agendamentos: 1 referencia(s)
- prestador_demandas: 1 referencia(s)
- prestador_demandas_historico: 1 referencia(s)
- prestador_documentos: 1 referencia(s)
- prestador_faturas: 1 referencia(s)
- prestador_historico: 1 referencia(s)
- prestador_saques: 1 referencia(s)
- prestador_suporte_demandas: 1 referencia(s)
- prestador_transacoes: 1 referencia(s)
- prestadores: 1 referencia(s)
- produto_desconto_cota_movimentos: 1 referencia(s)
- produto_fornecedor_config: 1 referencia(s)
- produto_importacao_origem: 1 referencia(s)
- produtos: 1 referencia(s)
- promocoes: 1 referencia(s)
- promocoes_quantidade: 1 referencia(s)
- promocoes_quantidade_ativadas: 1 referencia(s)
- promocoes_quantidade_uso: 1 referencia(s)
- public: 1 referencia(s)
- saques: 1 referencia(s)
- saude_aceites: 1 referencia(s)
- saude_assessorias: 1 referencia(s)
- saude_atendimento_mensagens: 1 referencia(s)
- saude_atendimentos: 1 referencia(s)
- saude_auditoria: 1 referencia(s)
- saude_comissoes: 1 referencia(s)
- saude_configuracoes: 1 referencia(s)
- saude_contratos: 1 referencia(s)
- saude_cotacao_beneficiarios: 1 referencia(s)
- saude_cotacoes: 1 referencia(s)
- saude_dependentes: 1 referencia(s)
- saude_documentos: 1 referencia(s)
- saude_parceiros: 1 referencia(s)
- saude_produto_redes: 1 referencia(s)
- saude_produtos: 1 referencia(s)
- saude_propostas: 1 referencia(s)
- seguros_aceites: 1 referencia(s)
- seguros_apolices: 1 referencia(s)
- seguros_assessorias: 1 referencia(s)
- seguros_assistencias: 1 referencia(s)
- seguros_atendimento_mensagens: 1 referencia(s)
- seguros_atendimentos: 1 referencia(s)
- seguros_auditoria: 1 referencia(s)
- seguros_comissoes: 1 referencia(s)
- seguros_configuracoes: 1 referencia(s)
- seguros_cotacao_dados: 1 referencia(s)
- seguros_cotacoes: 1 referencia(s)
- seguros_documentos: 1 referencia(s)
- seguros_ofertas: 1 referencia(s)
- seguros_parceiros: 1 referencia(s)
- seguros_produtos: 1 referencia(s)
- seguros_propostas: 1 referencia(s)
- seguros_sinistro_mensagens: 1 referencia(s)
- seguros_sinistros: 1 referencia(s)
- servicos: 1 referencia(s)
- sistema_sessoes: 1 referencia(s)
- solicitacoes_exclusao: 1 referencia(s)
- suporte_mensagens: 1 referencia(s)
- system_settings: 1 referencia(s)
- ticket_mensagens: 1 referencia(s)
- tickets: 1 referencia(s)
- transferencias: 1 referencia(s)
- transferencias_produtos: 1 referencia(s)
- viagens_cancelamentos: 1 referencia(s)
- viagens_configuracoes: 1 referencia(s)
- viagens_fornecedores: 1 referencia(s)
- viagens_orcamentos: 1 referencia(s)
- viagens_pacote_imagens: 1 referencia(s)
- viagens_pacotes: 1 referencia(s)
- viagens_passageiro_documentos: 1 referencia(s)
- viagens_passageiros: 1 referencia(s)
- viagens_propostas: 1 referencia(s)
- viagens_solicitacoes_reserva: 1 referencia(s)
- viagens_transacoes: 1 referencia(s)
- viagens_vouchers: 1 referencia(s)
- vouchers: 1 referencia(s)

## Banco - functions/RPCs criadas em SQL
- aceitar_quitacao_credito_loja: 1 referencia(s)
- aceitar_quitacao_emprestimo: 1 referencia(s)
- aprovar_orcamento_cliente: 2 referencia(s)
- assinar_area_vip_cliente: 2 referencia(s)
- cancelar_saque_cliente: 1 referencia(s)
- cancelar_transferencia_cliente: 1 referencia(s)
- checkout_pedido: 1 referencia(s)
- cliente_operational_write: 4 referencia(s)
- converter_pontos_cliente: 1 referencia(s)
- delete_client_cascade: 1 referencia(s)
- estornar_transferencia_cliente: 1 referencia(s)
- fn_criar_notificacao_automatica: 1 referencia(s)
- fn_processar_pagamento_quitacao_emprestimo: 2 referencia(s)
- fn_processar_upgrade_nivel_automatico: 1 referencia(s)
- generate_promo_code: 1 referencia(s)
- generate_system_code: 1 referencia(s)
- gerar_fatura_parcela_emprestimo: 1 referencia(s)
- gerar_fatura_pedido_store: 2 referencia(s)
- gerar_faturas_assinaturas_diario: 1 referencia(s)
- gsa_admin_adjust_points: 1 referencia(s)
- gsa_admin_ajustar_limite_credito_cliente: 1 referencia(s)
- gsa_admin_ajustar_saldo_cliente: 1 referencia(s)
- gsa_admin_alterar_status_cliente: 1 referencia(s)
- gsa_admin_aplicar_ajuste_fatura: 1 referencia(s)
- gsa_admin_aprovar_aumento_credito: 1 referencia(s)
- gsa_admin_atualizar_dados_cliente: 1 referencia(s)
- gsa_admin_atualizar_documento_credito: 1 referencia(s)
- gsa_admin_atualizar_solicitacao_loja: 1 referencia(s)
- gsa_admin_atualizar_status_cliente: 1 referencia(s)
- gsa_admin_authorize_product_url_import: 1 referencia(s)
- gsa_admin_baixar_cobranca_manual: 1 referencia(s)
- gsa_admin_baixar_fatura: 2 referencia(s)
- gsa_admin_baixar_parcela_cobranca: 1 referencia(s)
- gsa_admin_can_configure: 1 referencia(s)
- gsa_admin_cancelar_acordo_cobranca: 1 referencia(s)
- gsa_admin_cancelar_demanda: 1 referencia(s)
- gsa_admin_cancelar_fatura: 1 referencia(s)
- gsa_admin_change_access_code: 1 referencia(s)
- gsa_admin_check_existing_supplier_products: 1 referencia(s)
- gsa_admin_check_product_barcode: 1 referencia(s)
- gsa_admin_clear_access_history: 1 referencia(s)
- gsa_admin_criar_cliente: 1 referencia(s)
- gsa_admin_criar_cobranca_fatura: 1 referencia(s)
- gsa_admin_criar_fatura_manual: 1 referencia(s)
- gsa_admin_definir_parcelamento_credito: 1 referencia(s)
- gsa_admin_delete_record_secure: 1 referencia(s)
- gsa_admin_desbloquear_pin_cliente: 1 referencia(s)
- gsa_admin_emprestimo_add_historico: 1 referencia(s)
- gsa_admin_emprestimo_aprovar: 1 referencia(s)
- gsa_admin_emprestimo_atualizar_documento: 1 referencia(s)
- gsa_admin_emprestimo_atualizar_status: 1 referencia(s)
- gsa_admin_emprestimo_enviar_comentario: 1 referencia(s)
- gsa_admin_emprestimo_enviar_contrato: 1 referencia(s)
- gsa_admin_emprestimo_enviar_oferta_quitacao: 1 referencia(s)
- gsa_admin_emprestimo_enviar_proposta: 1 referencia(s)
- gsa_admin_emprestimo_salvar_observacao: 1 referencia(s)
- gsa_admin_enviar_fatura_cobranca: 1 referencia(s)
- gsa_admin_enviar_oferta_quitacao_credito: 1 referencia(s)
- gsa_admin_excluir_cobranca: 1 referencia(s)
- gsa_admin_gerar_acordo_cobranca: 1 referencia(s)
- gsa_admin_get_product_supplier_config: 1 referencia(s)
- gsa_admin_import_products_batch: 1 referencia(s)
- gsa_admin_import_products_batch_v2: 2 referencia(s)
- gsa_admin_liberar_credito_contrato: 1 referencia(s)
- gsa_admin_mudar_status_cobranca: 1 referencia(s)
- gsa_admin_preaprovar_credito: 1 referencia(s)
- gsa_admin_processar_saque: 1 referencia(s)
- gsa_admin_processar_saque_prestador: 1 referencia(s)
- gsa_admin_processar_transferencia: 1 referencia(s)
- gsa_admin_protestar_cobranca: 1 referencia(s)
- gsa_admin_recusar_credito: 1 referencia(s)
- gsa_admin_registrar_cobranca_historico: 1 referencia(s)
- gsa_admin_rejeitar_contrato_credito: 1 referencia(s)
- gsa_admin_release_discount_quota: 1 referencia(s)
- gsa_admin_reset_actor_pin: 1 referencia(s)
- gsa_admin_session_actor: 1 referencia(s)
- gsa_admin_set_product_discount: 3 referencia(s)
- gsa_admin_solicitar_documento_credito: 1 referencia(s)
- gsa_admin_upsert_product_supplier_config: 1 referencia(s)
- gsa_admin_upsert_settings: 2 referencia(s)
- gsa_apply_points_internal: 1 referencia(s)
- gsa_assert_auth_rate_limit: 1 referencia(s)
- gsa_assert_public_rate_limit: 1 referencia(s)
- gsa_calculate_product_discount_percentage: 1 referencia(s)
- gsa_calculate_product_effective_price: 2 referencia(s)
- gsa_change_own_pin: 2 referencia(s)
- gsa_check_active_session: 1 referencia(s)
- gsa_client_accept_loan_settlement: 1 referencia(s)
- gsa_client_accept_store_credit_settlement: 1 referencia(s)
- gsa_client_approve_budget: 1 referencia(s)
- gsa_client_cancel_store_order: 1 referencia(s)
- gsa_client_cancel_transfer: 1 referencia(s)
- gsa_client_cancel_withdrawal: 1 referencia(s)
- gsa_client_checkout_store: 3 referencia(s)
- gsa_client_checkout_travel: 1 referencia(s)
- gsa_client_convert_points: 1 referencia(s)
- gsa_client_extend_subscription: 1 referencia(s)
- gsa_client_generate_loan_installment_invoice: 1 referencia(s)
- gsa_client_generate_store_invoice: 1 referencia(s)
- gsa_client_lookup_transfer_recipient: 1 referencia(s)
- gsa_client_pagar_fatura: 1 referencia(s)
- gsa_client_process_welcome_bonus: 1 referencia(s)
- gsa_client_redeem_wallet_voucher: 1 referencia(s)
- gsa_client_reject_loan_settlement: 1 referencia(s)
- gsa_client_reject_store_credit_settlement: 1 referencia(s)
- gsa_client_release_signed_credit: 1 referencia(s)
- gsa_client_request_loan_settlement: 1 referencia(s)
- gsa_client_request_store_credit_settlement: 1 referencia(s)
- gsa_client_request_store_exchange: 1 referencia(s)
- gsa_client_request_transfer: 1 referencia(s)
- gsa_client_request_withdrawal: 1 referencia(s)
- gsa_client_reverse_transfer: 1 referencia(s)
- gsa_client_saude_abrir_atendimento: 1 referencia(s)
- gsa_client_saude_aceitar_proposta: 1 referencia(s)
- gsa_client_saude_criar_cotacao: 1 referencia(s)
- gsa_client_saude_listar: 1 referencia(s)
- gsa_client_saude_registrar_documento: 1 referencia(s)
- gsa_client_seguros_abrir_atendimento: 1 referencia(s)
- gsa_client_seguros_aceitar_proposta: 1 referencia(s)
- gsa_client_seguros_criar_cotacao: 1 referencia(s)
- gsa_client_seguros_criar_ocorrencia: 1 referencia(s)
- gsa_client_seguros_listar: 1 referencia(s)
- gsa_client_seguros_registrar_documento: 1 referencia(s)
- gsa_client_session_actor: 2 referencia(s)
- gsa_client_submit_exchange_tracking: 1 referencia(s)
- gsa_client_subscribe_vip: 1 referencia(s)
- gsa_create_session_internal: 2 referencia(s)
- gsa_end_session: 1 referencia(s)
- gsa_finalize_paid_invoice_internal: 1 referencia(s)
- gsa_force_end_session: 1 referencia(s)
- gsa_generate_code: 1 referencia(s)
- gsa_generate_unique_product_code: 1 referencia(s)
- gsa_get_client_session_access_state: 1 referencia(s)
- gsa_hash_session_token: 2 referencia(s)
- gsa_is_valid_cnpj: 1 referencia(s)
- gsa_is_valid_cpf: 1 referencia(s)
- gsa_jwt_actor_id: 1 referencia(s)
- gsa_jwt_actor_type: 1 referencia(s)
- gsa_jwt_is_admin: 1 referencia(s)
- gsa_jwt_session_id: 1 referencia(s)
- gsa_jwt_session_is_valid: 1 referencia(s)
- gsa_log_action: 1 referencia(s)
- gsa_login_admin: 1 referencia(s)
- gsa_login_colaborador: 1 referencia(s)
- gsa_login_pin: 1 referencia(s)
- gsa_lookup_portal_account: 1 referencia(s)
- gsa_mark_promotion_usage_for_invoice: 1 referencia(s)
- gsa_normalize_points_movement_type: 1 referencia(s)
- gsa_normalize_service_order_status: 1 referencia(s)
- gsa_normalize_url: 1 referencia(s)
- gsa_notify_invoice_paid: 1 referencia(s)
- gsa_notify_invoice_payment_started: 1 referencia(s)
- gsa_ping_session: 1 referencia(s)
- gsa_provider_session_actor: 1 referencia(s)
- gsa_provision_auth_identity_internal: 2 referencia(s)
- gsa_public_create_enterprise_budget: 1 referencia(s)
- gsa_public_lookup_referral: 1 referencia(s)
- gsa_public_register_client: 1 referencia(s)
- gsa_public_register_provider: 1 referencia(s)
- gsa_record_auth_attempt: 1 referencia(s)
- gsa_recuperar_senha_cliente: 2 referencia(s)
- gsa_request_ip: 1 referencia(s)
- gsa_saude_registrar_comissao_ativacao: 1 referencia(s)
- gsa_seguros_registrar_comissao_ativacao: 1 referencia(s)
- gsa_set_pin_and_login: 1 referencia(s)
- gsa_start_session: 2 referencia(s)
- gsa_trg_produtos_discount_calc: 3 referencia(s)
- gsa_trigger_set_product_code: 1 referencia(s)
- gsa_update_client_pin: 3 referencia(s)
- gsa_validate_session: 1 referencia(s)
- gsa_verify_own_pin: 1 referencia(s)
- increment_comentarios: 1 referencia(s)
- liberar_credito_loja_assinado: 1 referencia(s)
- pagar_fatura_cliente: 1 referencia(s)
- process_expired_quitacoes: 2 referencia(s)
- prorrogar_assinatura_cliente: 1 referencia(s)
- request_withdrawal_seguro: 1 referencia(s)
- resgatar_voucher_carteira: 1 referencia(s)
- resgatar_voucher_seguro: 1 referencia(s)
- rpc_admin_concluir_transacao_classificado: 1 referencia(s)
- rpc_admin_moderar_mensagem_classificado: 1 referencia(s)
- rpc_criar_anuncio_classificado: 1 referencia(s)
- rpc_enviar_proposta_classificado: 1 referencia(s)
- secure_add_gamification_points: 2 referencia(s)
- solicitar_saque_cliente: 1 referencia(s)
- solicitar_transferencia_cliente: 1 referencia(s)
- suprimir_bonus_boas_vindas_cliente: 1 referencia(s)

## Banco - policies por tabela
- classificados_anuncio_midias: 1 referencia(s)
- classificados_anuncios: 2 referencia(s)
- classificados_comissoes: 1 referencia(s)
- classificados_comissoes_config: 1 referencia(s)
- classificados_comprovantes: 1 referencia(s)
- classificados_configuracoes: 1 referencia(s)
- classificados_mensagens: 1 referencia(s)
- classificados_propostas: 1 referencia(s)
- classificados_transacoes: 1 referencia(s)
- cobranca_historico: 1 referencia(s)
- cobrancas: 1 referencia(s)
- loja_categorias: 1 referencia(s)
- loja_pedido_itens: 2 referencia(s)
- loja_solicitacoes: 1 referencia(s)
- orcamento_timeline: 5 referencia(s)
- os_suporte_mensagens: 3 referencia(s)
- prestador_agendamentos: 1 referencia(s)
- prestador_demandas: 1 referencia(s)
- prestador_demandas_historico: 2 referencia(s)
- prestador_documentos: 1 referencia(s)
- prestador_faturas: 1 referencia(s)
- prestador_historico: 1 referencia(s)
- prestador_saques: 1 referencia(s)
- prestador_suporte_demandas: 1 referencia(s)
- prestador_transacoes: 1 referencia(s)
- prestadores: 1 referencia(s)
- produto_desconto_cota_movimentos: 1 referencia(s)
- promocoes_quantidade: 2 referencia(s)
- promocoes_quantidade_uso: 2 referencia(s)
- public: 3 referencia(s)
- saques: 1 referencia(s)
- sistema_logs: 2 referencia(s)
- storage: 6 referencia(s)
- suporte_mensagens: 1 referencia(s)
- system_settings: 2 referencia(s)
- transferencias: 1 referencia(s)
- viagens_cancelamentos: 2 referencia(s)
- viagens_configuracoes: 1 referencia(s)
- viagens_orcamentos: 2 referencia(s)
- viagens_pacote_imagens: 1 referencia(s)
- viagens_pacotes: 1 referencia(s)
- viagens_passageiro_documentos: 3 referencia(s)
- viagens_passageiros: 4 referencia(s)
- viagens_propostas: 2 referencia(s)
- viagens_solicitacoes_reserva: 3 referencia(s)
- viagens_transacoes: 1 referencia(s)
- viagens_vouchers: 1 referencia(s)

## Banco - triggers
- set_produto_fornecedor_config_updated_at: 1 referencia(s)
- trg_generate_code_: 1 referencia(s)
- trg_gsa_normalize_points_movement_type: 1 referencia(s)
- trg_gsa_normalize_service_order_status: 1 referencia(s)
- trg_gsa_notify_invoice_paid: 1 referencia(s)
- trg_gsa_notify_invoice_payment_started: 1 referencia(s)
- trg_gsa_set_product_code: 1 referencia(s)
- trg_invoice_code: 1 referencia(s)
- trg_notif_cliente_promocoes: 1 referencia(s)
- trg_notif_faturas: 1 referencia(s)
- trg_notif_indicacoes: 1 referencia(s)
- trg_notif_orcamentos: 1 referencia(s)
- trg_notif_ordens_assinatura: 1 referencia(s)
- trg_notif_ordens_compra: 1 referencia(s)
- trg_notif_os: 1 referencia(s)
- trg_notif_pagamentos: 1 referencia(s)
- trg_notif_pontos: 1 referencia(s)
- trg_notif_saques: 1 referencia(s)
- trg_notif_ticket_msgs: 1 referencia(s)
- trg_notif_tickets: 1 referencia(s)
- trg_notif_transferencias: 1 referencia(s)
- trg_notif_vouchers: 1 referencia(s)
- trg_pagamento_quitacao: 1 referencia(s)
- trg_produtos_discount_calc: 3 referencia(s)
- trg_promo_code: 1 referencia(s)
- trg_saude_comissao_ativacao: 1 referencia(s)
- trg_seguros_comissao_ativacao: 1 referencia(s)
- trg_upgrade_nivel_fatura: 1 referencia(s)

## Banco - RLS habilitado
- classificados_anuncio_midias: 1 referencia(s)
- classificados_anuncios: 1 referencia(s)
- classificados_comissoes: 1 referencia(s)
- classificados_comissoes_config: 1 referencia(s)
- classificados_comprovantes: 1 referencia(s)
- classificados_configuracoes: 1 referencia(s)
- classificados_mensagens: 1 referencia(s)
- classificados_propostas: 1 referencia(s)
- classificados_transacoes: 1 referencia(s)
- cobranca_historico: 1 referencia(s)
- cobrancas: 1 referencia(s)
- debug_admin_rpc: 1 referencia(s)
- gsa_auth_attempts: 1 referencia(s)
- gsa_auth_identities: 1 referencia(s)
- gsa_client_operation_requests: 1 referencia(s)
- gsa_public_rate_limits: 1 referencia(s)
- gsa_voucher_resgates: 1 referencia(s)
- loja_categorias: 1 referencia(s)
- loja_pedido_itens: 1 referencia(s)
- loja_solicitacoes: 1 referencia(s)
- orcamento_timeline: 1 referencia(s)
- os_suporte_mensagens: 1 referencia(s)
- prestador_agendamentos: 1 referencia(s)
- prestador_demandas: 1 referencia(s)
- prestador_demandas_historico: 1 referencia(s)
- prestador_documentos: 1 referencia(s)
- prestador_faturas: 1 referencia(s)
- prestador_historico: 1 referencia(s)
- prestador_saques: 1 referencia(s)
- prestador_suporte_demandas: 1 referencia(s)
- prestador_transacoes: 1 referencia(s)
- prestadores: 1 referencia(s)
- produto_desconto_cota_movimentos: 1 referencia(s)
- produto_fornecedor_config: 1 referencia(s)
- produto_importacao_origem: 1 referencia(s)
- promocoes_quantidade: 2 referencia(s)
- promocoes_quantidade_uso: 2 referencia(s)
- suporte_mensagens: 1 referencia(s)
- system_settings: 1 referencia(s)
- viagens_cancelamentos: 1 referencia(s)
- viagens_configuracoes: 1 referencia(s)
- viagens_fornecedores: 1 referencia(s)
- viagens_orcamentos: 1 referencia(s)
- viagens_pacote_imagens: 1 referencia(s)
- viagens_pacotes: 1 referencia(s)
- viagens_passageiro_documentos: 1 referencia(s)
- viagens_passageiros: 1 referencia(s)
- viagens_propostas: 1 referencia(s)
- viagens_solicitacoes_reserva: 1 referencia(s)
- viagens_transacoes: 1 referencia(s)
- viagens_vouchers: 1 referencia(s)

## Comparacao codigo x SQL local
### Tabelas usadas no codigo sem evidencia SQL local
- ...
- ${domain}_cotacoes
- ${domain}_parceiros
- ${domain}_propostas
- admin_notificacoes
- cliente_documentos
- cliente_notas_admin
- cupons_ativados
- cupons_loja
- demanda_comentarios
- emprestimo_comentarios
- emprestimo_documentos
- emprestimo_historico
- fatura_contestacoes
- gsa-store-images
- loja_avaliacoes
- loja_credito_documentos
- loja_credito_movimentacoes
- loja_credito_solicitacoes
- loja_estoque_historico
- ordens_fiscais
- prestador_premios
- prestador_promocoes
- prestador_promocoes_ativacoes
- prestador_vouchers
- sistema_logs
### RPCs chamadas no codigo sem evidencia SQL local
- check_file_references
- execute_sql
- fn_marcar_faturas_vencidas
- get_admin_counts
- get_admin_pendency_counts
- get_client_pendency_counts
- get_database_details
- get_provider_pendency_counts
- get_system_metrics
- processar_bonus_boas_vindas_seguro
- rpc_moderar_mensagem_classificado
### Buckets usados no codigo sem evidencia SQL local
- documentos_cliente
- documentos_prestador
- emprestimos
- entregas_demandas
- fiscal_docs
- gsa-store-images
- orcamentos

## Sinais de qualidade
- TODO/FIXME/HACK/XXX: 25
- Possiveis mocks/placeholders/demo/sample: 338
- Console statements: 739

## Arquivos analisados
| path | kind | ext | lines |
| --- | --- | --- | --- |
| .env | other |  | 3 |
| .env.example | other | .example | 14 |
| apply_fix_transactions.cjs | other | .cjs | 29 |
| apply_migration.cjs | other | .cjs | 31 |
| apply_pg_migration.cjs | other | .cjs | 35 |
| apply_rpc.cjs | other | .cjs | 29 |
| audit_client_panel.cjs | other | .cjs | 170 |
| audit_deep_part2.cjs | other | .cjs | 100 |
| audit_deep_part2.md | other | .md | 296 |
| audit_deep_part3.cjs | other | .cjs | 102 |
| audit_deep_part3.md | other | .md | 27 |
| audit_deep_part4.cjs | other | .cjs | 129 |
| audit_deep_part4.md | other | .md | 391 |
| audit_deep_part5.cjs | other | .cjs | 91 |
| audit_deep_part5.md | other | .md | 181 |
| audit_exchange_flow.cjs | other | .cjs | 19 |
| audit_report.md | other | .md | 305 |
| audit_script.cjs | other | .cjs | 87 |
| audit_shopping_flow.cjs | other | .cjs | 40 |
| audit_shopping_flow_results.json | other | .json | 98 |
| audit_store_metrics.cjs | other | .cjs | 47 |
| audit_ui_ux.md | other | .md | 151 |
| audit_ui_ux_script.cjs | other | .cjs | 79 |
| backup.cjs | other | .cjs | 92 |
| check_cupons.ts | other | .ts | 16 |
| create_table.js | other | .js | 31 |
| deep_audit_client_panel.md | other | .md | 156 |
| deep_code_parser.cjs | other | .cjs | 58 |
| docs/ROTAS_DO_PORTAL.md | other | .md | 76 |
| extract_modals.cjs | other | .cjs | 66 |
| fix-portal2.cjs | other | .cjs | 39 |
| fix-profile.cjs | other | .cjs | 74 |
| fix.cjs | other | .cjs | 63 |
| fix2.cjs | other | .cjs | 137 |
| fix2.js | other | .js | 12 |
| fix_admin_session.cjs | other | .cjs | 48 |
| fix_admin_session2.cjs | other | .cjs | 42 |
| fix_chars.js | other | .js | 12 |
| fix_cobrancas_rls.sql | sql | .sql | 8 |
| fix_create_pin.cjs | other | .cjs | 21 |
| fix_database_transactions.sql | sql | .sql | 120 |
| fix_extra_div.cjs | other | .cjs | 17 |
| fix_imports.cjs | other | .cjs | 9 |
| fix_logs.cjs | other | .cjs | 35 |
| fix_logs_final.cjs | other | .cjs | 13 |
| fix_logs_safe.cjs | other | .cjs | 66 |
| fix_minor.cjs | other | .cjs | 23 |
| fix_notify.cjs | other | .cjs | 5 |
| fix_ordens.cjs | other | .cjs | 55 |
| fix_script.cjs | other | .cjs | 116 |
| fix_script2.cjs | other | .cjs | 53 |
| fix_script3.cjs | other | .cjs | 18 |
| fix_storehub_purchases.cjs | other | .cjs | 57 |
| fix_uuid.mjs | other | .mjs | 75 |
| get_schema.cjs | other | .cjs | 36 |
| improve_modal.js | other | .js | 86 |
| improve_modal_no_scroll.js | other | .js | 170 |
| index.html | other | .html | 22 |
| insert_fatura.cjs | other | .cjs | 26 |
| isolate_upload.cjs | other | .cjs | 42 |
| manual_fix.cjs | other | .cjs | 118 |
| master_supabase_schema.sql | sql | .sql | 826 |
| metadata.json | other | .json | 5 |
| migrations_promo.sql | sql | .sql | 75 |
| package-lock.json | other | .json | 6529 |
| package.json | other | .json | 65 |
| payload.json | other | .json | 1 |
| payload2.json | other | .json | 1 |
| payload_bulk.json | other | .json | 23 |
| playwright-report/index.html | other | .html | 90 |
| playwright.config.ts | other | .ts | 45 |
| README.md | other | .md | 21 |
| refactor_storehub_coupons.cjs | other | .cjs | 76 |
| refactor_storehub_purchases.cjs | other | .cjs | 70 |
| replace_codigo.js | other | .js | 9 |
| restore.js | other | .js | 32 |
| restore2.js | other | .js | 26 |
| restore_admin.cjs | other | .cjs | 73 |
| schema_dump.json | other | .json | 1268 |
| scratch_inspect_invoice.cjs | other | .cjs | 131 |
| split_store_components.cjs | other | .cjs | 80 |
| sql_add_categorias.sql | sql | .sql | 36 |
| sql_add_forma_pagamento.sql | sql | .sql | 7 |
| src/App.tsx | other | .tsx | 303 |
| src/components/admin/AcessosModule.tsx | component | .tsx | 1194 |
| src/components/admin/AreaVIPModule.tsx | component | .tsx | 1285 |
| src/components/admin/AssinaturasModule.tsx | component | .tsx | 904 |
| src/components/admin/CadastroModule.tsx | component | .tsx | 372 |
| src/components/admin/ClassifiedsModule.tsx | component | .tsx | 228 |
| src/components/admin/clientes/AdminClienteDocumentos.tsx | component | .tsx | 562 |
| src/components/admin/ClientesModule.tsx | component | .tsx | 2594 |
| src/components/admin/CobrancaModule.tsx | component | .tsx | 1707 |
| src/components/admin/ConfiguracoesModule.tsx | component | .tsx | 1238 |
| src/components/admin/CreditoModule.tsx | component | .tsx | 2191 |
| src/components/admin/CuponsLojaModule.tsx | component | .tsx | 561 |
| src/components/admin/Dashboard.tsx | component | .tsx | 810 |
| src/components/admin/demandas/DemandasComentarios.tsx | component | .tsx | 265 |
| src/components/admin/demandas/DemandasDashboard.tsx | component | .tsx | 185 |
| src/components/admin/demandas/DemandasDetalhesModal.tsx | component | .tsx | 1580 |
| src/components/admin/demandas/DemandasKanban.tsx | component | .tsx | 146 |
| src/components/admin/demandas/DemandasTabela.tsx | component | .tsx | 332 |
| src/components/admin/demandas/NovaDemandaModal.tsx | component | .tsx | 468 |
| src/components/admin/DemandasColaboradorModule.tsx | component | .tsx | 341 |
| src/components/admin/EmpresaModule.tsx | component | .tsx | 193 |
| src/components/admin/EmprestimosModule.tsx | component | .tsx | 1103 |
| src/components/admin/FinanceiroModule.tsx | component | .tsx | 3182 |
| src/components/admin/FiscalModule.tsx | component | .tsx | 982 |
| src/components/admin/IndicacoesModule.tsx | component | .tsx | 635 |
| src/components/admin/LojaCategoriasModule.tsx | component | .tsx | 312 |
| src/components/admin/LojaTrocasModule.tsx | component | .tsx | 692 |
| src/components/admin/OrcamentosModule.tsx | component | .tsx | 2925 |
| src/components/admin/OrdensAssinaturaModule.tsx | component | .tsx | 650 |
| src/components/admin/OrdensCompraModule.tsx | component | .tsx | 1422 |
| src/components/admin/OrdensServicoModule.tsx | component | .tsx | 1049 |
| src/components/admin/PainelRentabilidade.tsx | component | .tsx | 405 |
| src/components/admin/PremiosModule.tsx | component | .tsx | 839 |
| src/components/admin/prestadores/AdminPrestadorDocumentos.tsx | component | .tsx | 447 |
| src/components/admin/prestadores/AdminPrestadorPremios.tsx | component | .tsx | 232 |
| src/components/admin/prestadores/AdminPrestadorPromocoes.tsx | component | .tsx | 371 |
| src/components/admin/prestadores/AdminPrestadorVouchers.tsx | component | .tsx | 222 |
| src/components/admin/prestadores/PrestadoresCadastro.tsx | component | .tsx | 1680 |
| src/components/admin/prestadores/PrestadoresDemandas.tsx | component | .tsx | 2977 |
| src/components/admin/prestadores/PrestadoresFinanceiro.tsx | component | .tsx | 691 |
| src/components/admin/PrestadoresModule.tsx | component | .tsx | 142 |
| src/components/admin/products/BarcodeScannerModal.tsx | component | .tsx | 560 |
| src/components/admin/products/BulkProductImportModal.tsx | component | .tsx | 589 |
| src/components/admin/products/import/ExcelImportSource.tsx | component | .tsx | 234 |
| src/components/admin/products/import/ImportSourceSelector.tsx | component | .tsx | 87 |
| src/components/admin/products/import/ImportSupplierMode.tsx | component | .tsx | 147 |
| src/components/admin/products/import/MediaImportSource.tsx | component | .tsx | 261 |
| src/components/admin/products/import/TextImportSource.tsx | component | .tsx | 89 |
| src/components/admin/products/import/UrlImportSource.tsx | component | .tsx | 106 |
| src/components/admin/ProdutosModule.tsx | component | .tsx | 2814 |
| src/components/admin/PromoAnalytics.tsx | component | .tsx | 157 |
| src/components/admin/PromocaoQuantidadeForm.tsx | component | .tsx | 448 |
| src/components/admin/PromocaoQuantidadeModule.tsx | component | .tsx | 191 |
| src/components/admin/PromocoesModule.tsx | component | .tsx | 544 |
| src/components/admin/PromoDetalhesModal.tsx | component | .tsx | 316 |
| src/components/admin/ProtectionAdminModule.tsx | component | .tsx | 101 |
| src/components/admin/ReembolsosModule.tsx | component | .tsx | 839 |
| src/components/admin/relatorios/RelatorioClientes.tsx | component | .tsx | 166 |
| src/components/admin/relatorios/RelatorioCobranca.tsx | component | .tsx | 148 |
| src/components/admin/relatorios/RelatorioCredito.tsx | component | .tsx | 175 |
| src/components/admin/relatorios/RelatorioEmprestimos.tsx | component | .tsx | 174 |
| src/components/admin/relatorios/RelatorioExecutivo.tsx | component | .tsx | 190 |
| src/components/admin/relatorios/RelatorioFinanceiro.tsx | component | .tsx | 211 |
| src/components/admin/relatorios/RelatorioFiscal.tsx | component | .tsx | 169 |
| src/components/admin/relatorios/RelatorioGamificacao.tsx | component | .tsx | 154 |
| src/components/admin/relatorios/RelatorioLoja.tsx | component | .tsx | 159 |
| src/components/admin/relatorios/RelatorioMarketing.tsx | component | .tsx | 139 |
| src/components/admin/relatorios/RelatorioOperacional.tsx | component | .tsx | 149 |
| src/components/admin/relatorios/RelatorioOS.tsx | component | .tsx | 152 |
| src/components/admin/relatorios/RelatorioPrestadores.tsx | component | .tsx | 154 |
| src/components/admin/relatorios/RelatorioRentabilidade.tsx | component | .tsx | 328 |
| src/components/admin/relatorios/RelatorioSuporte.tsx | component | .tsx | 135 |
| src/components/admin/relatorios/utils/relatorioExport.ts | component | .ts | 92 |
| src/components/admin/RelatoriosModule.tsx | component | .tsx | 243 |
| src/components/admin/ServicosModule.tsx | component | .tsx | 780 |
| src/components/admin/SystemMonitorModule.tsx | component | .tsx | 735 |
| src/components/admin/SystemStatusIndicator.tsx | component | .tsx | 169 |
| src/components/admin/TicketsModule.tsx | component | .tsx | 779 |
| src/components/admin/TravelAdminModule.tsx | component | .tsx | 185 |
| src/components/admin/ui/AdminWhatsAppButton.tsx | component | .tsx | 258 |
| src/components/admin/VendasModule.tsx | component | .tsx | 332 |
| src/components/admin/VouchersModule.tsx | component | .tsx | 779 |
| src/components/client/ClientAreaVIP.tsx | component | .tsx | 904 |
| src/components/client/ClientAssinaturas.tsx | component | .tsx | 619 |
| src/components/client/ClientCancelPromoModal.tsx | component | .tsx | 55 |
| src/components/client/ClientDashboard.tsx | component | .tsx | 542 |
| src/components/client/ClientEmprestimos.tsx | component | .tsx | 1177 |
| src/components/client/ClientFidelidade.tsx | component | .tsx | 162 |
| src/components/client/ClientFinanceiro.tsx | component | .tsx | 774 |
| src/components/client/ClientGSAStore.tsx | component | .tsx | 1141 |
| src/components/client/ClientIndiqueGanhe.tsx | component | .tsx | 668 |
| src/components/client/ClientMeuCredito.tsx | component | .tsx | 2304 |
| src/components/client/ClientOrcamentos.tsx | component | .tsx | 2003 |
| src/components/client/ClientPontos.tsx | component | .tsx | 641 |
| src/components/client/ClientPremios.tsx | component | .tsx | 566 |
| src/components/client/ClientProdutos.tsx | component | .tsx | 615 |
| src/components/client/ClientProfile.tsx | component | .tsx | 983 |
| src/components/client/ClientPromocoes.tsx | component | .tsx | 468 |
| src/components/client/ClientPromoDetalhesModal.tsx | component | .tsx | 210 |
| src/components/client/ClientServicos.tsx | component | .tsx | 817 |
| src/components/client/ClientServicosAssinaturas.tsx | component | .tsx | 137 |
| src/components/client/ClientSuporte.tsx | component | .tsx | 527 |
| src/components/client/ClientTransferencias.tsx | component | .tsx | 365 |
| src/components/client/ClientVouchers.tsx | component | .tsx | 319 |
| src/components/client/emprestimo/EmprestimoFormSteps.tsx | component | .tsx | 287 |
| src/components/client/financeiro/ExtratoList.tsx | component | .tsx | 241 |
| src/components/client/financeiro/FaturasList.tsx | component | .tsx | 1684 |
| src/components/client/financeiro/NotasFiscaisList.tsx | component | .tsx | 396 |
| src/components/client/financeiro/PaymentModal.tsx | component | .tsx | 492 |
| src/components/client/financeiro/SaquesList.tsx | component | .tsx | 440 |
| src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx | component | .tsx | 235 |
| src/components/client/marketplace/classifieds/CreateListingWizard.tsx | component | .tsx | 334 |
| src/components/client/marketplace/classifieds/GeneralClassifiedsPage.tsx | component | .tsx | 180 |
| src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx | component | .tsx | 136 |
| src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx | component | .tsx | 161 |
| src/components/client/marketplace/classifieds/RealEstateMarketplacePage.tsx | component | .tsx | 236 |
| src/components/client/marketplace/classifieds/VehiclesMarketplacePage.tsx | component | .tsx | 195 |
| src/components/client/marketplace/ClassifiedsHubPage.tsx | component | .tsx | 367 |
| src/components/client/marketplace/MarketplaceGSAStore.tsx | component | .tsx | 256 |
| src/components/client/marketplace/MarketplaceHome.tsx | component | .tsx | 381 |
| src/components/client/marketplace/MarketplaceLanding.tsx | component | .tsx | 94 |
| src/components/client/marketplace/MarketplaceModuleCard.tsx | component | .tsx | 87 |
| src/components/client/marketplace/protection/ProtectionMarketplace.tsx | component | .tsx | 400 |
| src/components/client/marketplace/travel/MyTripsPage.tsx | component | .tsx | 162 |
| src/components/client/marketplace/travel/TravelCategoryPage.tsx | component | .tsx | 190 |
| src/components/client/marketplace/travel/TravelHubMenu.tsx | component | .tsx | 209 |
| src/components/client/marketplace/travel/TravelOffersLandingPage.tsx | component | .tsx | 228 |
| src/components/client/marketplace/travel/TravelPackageDetailPage.tsx | component | .tsx | 221 |
| src/components/client/marketplace/travel/TravelProposalsPage.tsx | component | .tsx | 185 |
| src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx | component | .tsx | 230 |
| src/components/client/marketplace/travel/TravelReservationPage.tsx | component | .tsx | 249 |
| src/components/client/marketplace/TravelPackagesPage.tsx | component | .tsx | 296 |
| src/components/client/store/AvailableCouponsModal.tsx | component | .tsx | 100 |
| src/components/client/store/CartDrawer.tsx | component | .tsx | 372 |
| src/components/client/store/CheckoutModal.tsx | component | .tsx | 1262 |
| src/components/client/store/FilterModal.tsx | component | .tsx | 98 |
| src/components/client/store/ProductDetailsModal.tsx | component | .tsx | 248 |
| src/components/client/store/QuantityModal.tsx | component | .tsx | 118 |
| src/components/client/store/StoreHubCancelOrder.tsx | component | .tsx | 100 |
| src/components/client/store/StoreHubCoupons.tsx | component | .tsx | 317 |
| src/components/client/store/StoreHubExchanges.tsx | component | .tsx | 952 |
| src/components/client/store/StoreHubPurchases.tsx | component | .tsx | 349 |
| src/components/client/store/StoreHubRefunds.tsx | component | .tsx | 195 |
| src/components/client/store/StoreHubVipPromos.tsx | component | .tsx | 88 |
| src/components/client/store/StoreItemCard.tsx | component | .tsx | 166 |
| src/components/client/store/SubscriptionDurationModal.tsx | component | .tsx | 74 |
| src/components/client/StoreHub.tsx | component | .tsx | 3314 |
| src/components/common/SupportConversationModal.tsx | component | .tsx | 212 |
| src/components/ErrorBoundary.tsx | component | .tsx | 85 |
| src/components/prestador/PrestadorAgenda.tsx | component | .tsx | 520 |
| src/components/prestador/PrestadorDemandas.tsx | component | .tsx | 1580 |
| src/components/prestador/PrestadorDocumentos.tsx | component | .tsx | 426 |
| src/components/prestador/PrestadorFinanceiro.tsx | component | .tsx | 765 |
| src/components/prestador/PrestadorPremios.tsx | component | .tsx | 417 |
| src/components/prestador/PrestadorPromocoes.tsx | component | .tsx | 249 |
| src/components/prestador/PrestadorSuporte.tsx | component | .tsx | 507 |
| src/components/prestador/PrestadorVouchers.tsx | component | .tsx | 303 |
| src/components/public/GSAEnterpriseHome.tsx | component | .tsx | 1160 |
| src/components/ui/DashboardLayout.tsx | component | .tsx | 188 |
| src/components/ui/EmptyState.tsx | component | .tsx | 68 |
| src/components/ui/FileViewerModal.tsx | component | .tsx | 134 |
| src/components/ui/FullscreenPrompt.tsx | component | .tsx | 79 |
| src/components/ui/GlobalFilter.tsx | component | .tsx | 184 |
| src/components/ui/LogoGSA.tsx | component | .tsx | 119 |
| src/components/ui/Modal.tsx | component | .tsx | 85 |
| src/components/ui/PinInput.tsx | component | .tsx | 147 |
| src/components/ui/UniversalNotificationBell.tsx | component | .tsx | 196 |
| src/components/ui/WhatsAppButton.tsx | component | .tsx | 112 |
| src/constants.ts | other | .ts | 158 |
| src/contexts/FileViewerContext.tsx | context | .tsx | 50 |
| src/hooks/useAdminNotifications.tsx | hook | .tsx | 637 |
| src/hooks/useAutoFitTabs.ts | hook | .ts | 46 |
| src/hooks/useAutoLogout.tsx | hook | .tsx | 92 |
| src/hooks/useClientNotifications.tsx | hook | .tsx | 409 |
| src/hooks/useProviderNotifications.tsx | hook | .tsx | 473 |
| src/hooks/useStoreCart.ts | hook | .ts | 93 |
| src/hooks/useStoreOrders.ts | hook | .ts | 36 |
| src/hooks/useStoreProducts.ts | hook | .ts | 110 |
| src/hooks/useVipLevels.ts | hook | .ts | 60 |
| src/index.css | other | .css | 309 |
| src/lib/adminRpc.ts | other | .ts | 85 |
| src/lib/barcodeScanner.ts | other | .ts | 104 |
| src/lib/clientOperationalWrite.ts | other | .ts | 33 |
| src/lib/clientRpc.ts | other | .ts | 30 |
| src/lib/deleteRequest.ts | other | .ts | 70 |
| src/lib/demandService.ts | other | .ts | 53 |
| src/lib/excelImportService.ts | other | .ts | 184 |
| src/lib/logService.ts | other | .ts | 48 |
| src/lib/notifications.tsx | other | .tsx | 205 |
| src/lib/notificationService.ts | other | .ts | 387 |
| src/lib/osService.ts | other | .ts | 38 |
| src/lib/pdf.ts | other | .ts | 575 |
| src/lib/pdfSharingService.ts | other | .ts | 106 |
| src/lib/productIdentification.ts | other | .ts | 113 |
| src/lib/productPricing.ts | other | .ts | 210 |
| src/lib/productUrlImportService.ts | other | .ts | 120 |
| src/lib/promocaoQuantidadeEngine.ts | other | .ts | 251 |
| src/lib/sessionService.ts | other | .ts | 283 |
| src/lib/supabase.ts | other | .ts | 60 |
| src/lib/supabaseWrapper.ts | other | .ts | 26 |
| src/lib/textImportService.ts | other | .ts | 145 |
| src/lib/uploadHelper.ts | other | .ts | 40 |
| src/lib/utils.ts | other | .ts | 217 |
| src/lib/whatsappNotificationService.ts | other | .ts | 757 |
| src/main.tsx | other | .tsx | 15 |
| src/pages/AdminPanel.tsx | page | .tsx | 512 |
| src/pages/ClientPortal.tsx | page | .tsx | 1600 |
| src/pages/Home.tsx | page | .tsx | 2272 |
| src/pages/Prestador/PrestadorDashboard.tsx | page | .tsx | 1113 |
| src/routing/legacyRouteResolver.ts | other | .ts | 49 |
| src/routing/navigationService.ts | other | .ts | 109 |
| src/routing/routeCatalog.ts | other | .ts | 251 |
| src/routing/routeMatcher.ts | other | .ts | 190 |
| src/routing/routeSecurity.ts | other | .ts | 21 |
| src/routing/types.ts | other | .ts | 18 |
| src/routing/useAppLocation.ts | other | .ts | 32 |
| src/tests/finance.test.ts | other | .ts | 63 |
| src/types/productImport.ts | other | .ts | 64 |
| src/types.ts | other | .ts | 933 |
| src/utils/cpfValidator.ts | other | .ts | 126 |
| src/utils/emprestimoUtils.ts | other | .ts | 121 |
| src/utils/gamification.ts | other | .ts | 107 |
| src/utils/paymentPropagation.ts | other | .ts | 261 |
| src/utils/promotions.ts | other | .ts | 112 |
| src/utils/referral.ts | other | .ts | 172 |
| src/utils/referralHelpers.ts | other | .ts | 148 |
| src/utils/riskProfile.ts | other | .ts | 119 |
| src/utils/viaCep.ts | other | .ts | 36 |
| src/validation/base.ts | other | .ts | 28 |
| src/validation/find_prestador.ts | other | .ts | 21 |
| src/validation/find_records.ts | other | .ts | 34 |
| src/validation/master_block2.ts | other | .ts | 160 |
| src/validation/master_block3.ts | other | .ts | 130 |
| src/validation/master_block4.ts | other | .ts | 84 |
| src/validation/state.json | other | .json | 7 |
| src/validation/step1_referral.ts | other | .ts | 98 |
| src/validation/step2_sales_flow.ts | other | .ts | 173 |
| src/validation/step3_finance_gamification.ts | other | .ts | 120 |
| src/validation/step4_integrity_audit.ts | other | .ts | 99 |
| src/validation/step5_reports_consolidation.ts | other | .ts | 81 |
| src/validation/step6_subscriptions.ts | other | .ts | 73 |
| supabase/.temp/linked-project.json | other | .json | 1 |
| supabase/functions/import-product-from-url/index.ts | other | .ts | 275 |
| supabase/functions/import-products-from-file/deno.json | other | .json | 7 |
| supabase/functions/import-products-from-file/index.ts | other | .ts | 550 |
| supabase/functions/import-products-from-file/index_test.ts | other | .ts | 69 |
| supabase/functions/_shared/cors.ts | other | .ts | 25 |
| supabase/functions/_shared/html_parser.ts | other | .ts | 400 |
| supabase/functions/_shared/html_parser_test.ts | other | .ts | 73 |
| supabase/functions/_shared/openrouter_client.ts | other | .ts | 131 |
| supabase/functions/_shared/product_import_schema.ts | other | .ts | 198 |
| supabase/functions/_shared/ssrf_validator.ts | other | .ts | 48 |
| supabase/migrations/20260310_add_voucher_columns.sql | migration | .sql | 11 |
| supabase/migrations/20260312000000_add_renovacao_fields.sql | migration | .sql | 12 |
| supabase/migrations/20260312000001_add_estornado_status.sql | migration | .sql | 7 |
| supabase/migrations/20260313000000_add_cadastro_padrao.sql | migration | .sql | 14 |
| supabase/migrations/20260315000000_add_promocao_desconto_manual.sql | migration | .sql | 3 |
| supabase/migrations/20260315000001_add_promocao_fk.sql | migration | .sql | 14 |
| supabase/migrations/20260315000002_fix_promocoes_schema.sql | migration | .sql | 66 |
| supabase/migrations/20260315000003_fix_notifications_schema.sql | migration | .sql | 21 |
| supabase/migrations/20260316000000_realtime_triggers.sql | migration | .sql | 307 |
| supabase/migrations/20260317000000_add_pacote_nivel_to_faturas.sql | migration | .sql | 6 |
| supabase/migrations/20260317000001_fix_cascade_delete.sql | migration | .sql | 150 |
| supabase/migrations/20260317000002_auto_level_upgrade.sql | migration | .sql | 74 |
| supabase/migrations/20260317000002_create_prestadores_schema.sql | migration | .sql | 111 |
| supabase/migrations/20260318000000_update_prestador_demandas.sql | migration | .sql | 57 |
| supabase/migrations/20260318000001_make_prestador_id_nullable.sql | migration | .sql | 3 |
| supabase/migrations/20260318000001_support_and_adjustments.sql | migration | .sql | 28 |
| supabase/migrations/20260318000002_ensure_prestadores_realtime.sql | migration | .sql | 68 |
| supabase/migrations/20260318000003_fix_prestadores_cascade.sql | migration | .sql | 63 |
| supabase/migrations/20260318000004_grant_permissions.sql | migration | .sql | 21 |
| supabase/migrations/20260318000005_add_demanda_id_to_transacoes.sql | migration | .sql | 3 |
| supabase/migrations/20260318000006_create_agendamentos.sql | migration | .sql | 23 |
| supabase/migrations/20260423150500_add_comprovante_concorrente.sql | migration | .sql | 4 |
| supabase/migrations/20260424140000_add_desconto_to_promocoes.sql | migration | .sql | 5 |
| supabase/migrations/20260429000000_add_data_ativacao_to_emprestimos.sql | migration | .sql | 3 |
| supabase/migrations/20260429000001_add_quitacao_acordo.sql | migration | .sql | 21 |
| supabase/migrations/20260429000002_payoff_automation.sql | migration | .sql | 25 |
| supabase/migrations/20260506000000_fix_demand_history_rls.sql | migration | .sql | 35 |
| supabase/migrations/20260518000000_add_imagens_anexo_to_loja_solicitacoes.sql | migration | .sql | 15 |
| supabase/migrations/20260519000000_add_numero_to_prestadores.sql | migration | .sql | 2 |
| supabase/migrations/20260519000001_add_descricao_detalhada_to_loja_solicitacoes.sql | migration | .sql | 3 |
| supabase/migrations/20260525000000_add_prazo_meses.sql | migration | .sql | 8 |
| supabase/migrations/20260525000001_cron_faturas_assinaturas.sql | migration | .sql | 37 |
| supabase/migrations/20260527000000_fix_emprestimo_quitacao.sql | migration | .sql | 33 |
| supabase/migrations/20260527000001_auto_revert_quitacao.sql | migration | .sql | 35 |
| supabase/migrations/20260527142323_add_quitacao_orcamentos.sql | migration | .sql | 3 |
| supabase/migrations/20260602000000_create_os_suporte_mensagens.sql | migration | .sql | 28 |
| supabase/migrations/20260609000000_secure_rpc_gamification.sql | migration | .sql | 88 |
| supabase/migrations/20260609000001_add_visualizado_promocoes.sql | migration | .sql | 2 |
| supabase/migrations/20260609000002_add_promocoes_quantidade_ativadas.sql | migration | .sql | 8 |
| supabase/migrations/20260609163754_fix_loja_reembolsos.sql | migration | .sql | 14 |
| supabase/migrations/20260706000100_organize_vip_level_benefits.sql | migration | .sql | 208 |
| supabase/migrations/20260711080000_create_orcamento_timeline_compat.sql | migration | .sql | 58 |
| supabase/migrations/20260711081000_fix_orcamento_timeline_rls.sql | migration | .sql | 26 |
| supabase/migrations/20260711110500_fix_invoice_items_odc_0122.sql | migration | .sql | 18 |
| supabase/migrations/20260711121000_fix_store_checkout_discounts_coupons.sql | migration | .sql | 164 |
| supabase/migrations/20260711160000_financial_client_rpc_hardening.sql | migration | .sql | 410 |
| supabase/migrations/20260711163000_client_financial_rpc_more_flows.sql | migration | .sql | 185 |
| supabase/migrations/20260711164500_approve_budget_rpc.sql | migration | .sql | 99 |
| supabase/migrations/20260711170000_close_remaining_client_financial_rpcs.sql | migration | .sql | 178 |
| supabase/migrations/20260711171000_approve_budget_negotiation_rpc.sql | migration | .sql | 117 |
| supabase/migrations/20260711172000_store_invoice_and_subscription_rpcs.sql | migration | .sql | 160 |
| supabase/migrations/20260711173000_client_portal_credit_bonus_rpcs.sql | migration | .sql | 111 |
| supabase/migrations/20260711174000_client_operational_write_rpc.sql | migration | .sql | 132 |
| supabase/migrations/20260711174500_extend_client_operational_write_whitelist.sql | migration | .sql | 135 |
| supabase/migrations/20260711175000_extend_operational_write_final_tables.sql | migration | .sql | 141 |
| supabase/migrations/20260711223000_fix_store_invoice_without_order_items.sql | migration | .sql | 134 |
| supabase/migrations/20260714010000_fix_db_dependency_gaps.sql | migration | .sql | 20 |
| supabase/migrations/20260714011000_complete_cliente_premios_columns.sql | migration | .sql | 24 |
| supabase/migrations/20260714013000_secure_session_rpc_foundation.sql | migration | .sql | 218 |
| supabase/migrations/20260714013500_fix_secure_session_pgcrypto_schema.sql | migration | .sql | 71 |
| supabase/migrations/20260714014000_reduce_public_session_log_writes.sql | migration | .sql | 77 |
| supabase/migrations/20260714014500_secure_log_action_rpc.sql | migration | .sql | 73 |
| supabase/migrations/20260714020000_secure_admin_withdrawal_transfer_rpcs.sql | migration | .sql | 418 |
| supabase/migrations/20260714021000_secure_admin_invoice_payment_rpc.sql | migration | .sql | 80 |
| supabase/migrations/20260714022000_secure_admin_invoice_collection_cancel_rpcs.sql | migration | .sql | 157 |
| supabase/migrations/20260714023000_secure_admin_collection_basic_rpcs.sql | migration | .sql | 198 |
| supabase/migrations/20260714024000_secure_admin_collection_payment_rpcs.sql | migration | .sql | 317 |
| supabase/migrations/20260714025000_secure_admin_collection_protest_rpc.sql | migration | .sql | 141 |
| supabase/migrations/20260714030000_secure_admin_collection_agreement_rpcs.sql | migration | .sql | 266 |
| supabase/migrations/20260714031000_secure_admin_collection_delete_rpc.sql | migration | .sql | 71 |
| supabase/migrations/20260714032000_secure_admin_client_balance_rpc.sql | migration | .sql | 81 |
| supabase/migrations/20260714033000_secure_admin_client_status_rpc.sql | migration | .sql | 194 |
| supabase/migrations/20260714034000_secure_admin_client_profile_rpcs.sql | migration | .sql | 151 |
| supabase/migrations/20260714035000_secure_admin_create_client_rpc.sql | migration | .sql | 141 |
| supabase/migrations/20260714040000_secure_admin_credit_limit_rpcs.sql | migration | .sql | 303 |
| supabase/migrations/20260714041000_secure_admin_credit_request_rpcs.sql | migration | .sql | 275 |
| supabase/migrations/20260714042000_secure_admin_credit_settlement_offer_rpc.sql | migration | .sql | 62 |
| supabase/migrations/20260714043000_secure_admin_loan_flow_rpcs.sql | migration | .sql | 518 |
| supabase/migrations/20260714044000_secure_admin_invoice_manual_rpcs.sql | migration | .sql | 185 |
| supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql | migration | .sql | 206 |
| supabase/migrations/20260714050000_secure_admin_provider_withdrawal_rpc.sql | migration | .sql | 107 |
| supabase/migrations/20260714051000_secure_atomic_login_sessions.sql | migration | .sql | 558 |
| supabase/migrations/20260714052000_secure_session_account_admin_config.sql | migration | .sql | 432 |
| supabase/migrations/20260714053000_supabase_auth_session_bridge.sql | migration | .sql | 321 |
| supabase/migrations/20260714053100_fix_auth_bridge_generated_identity_email.sql | migration | .sql | 120 |
| supabase/migrations/20260714053200_protect_system_settings_secrets.sql | migration | .sql | 191 |
| supabase/migrations/20260714054000_atomic_invoice_payment_and_points.sql | migration | .sql | 823 |
| supabase/migrations/20260714054100_normalize_service_order_paid_status.sql | migration | .sql | 25 |
| supabase/migrations/20260714054200_normalize_payment_points_type.sql | migration | .sql | 22 |
| supabase/migrations/20260714054300_align_payment_method_domain.sql | migration | .sql | 27 |
| supabase/migrations/20260714054400_invoice_payment_admin_notification.sql | migration | .sql | 54 |
| supabase/migrations/20260714054500_invoice_paid_client_notification.sql | migration | .sql | 53 |
| supabase/migrations/20260714055000_secure_public_onboarding_flows.sql | migration | .sql | 555 |
| supabase/migrations/20260714056000_atomic_session_store_checkout.sql | migration | .sql | 1016 |
| supabase/migrations/20260714056100_secure_store_invoice_and_cancellation.sql | migration | .sql | 485 |
| supabase/migrations/20260714056200_secure_client_wallet_points_transfers.sql | migration | .sql | 634 |
| supabase/migrations/20260714056300_secure_remaining_client_financial_actions.sql | migration | .sql | 1093 |
| supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql | migration | .sql | 730 |
| supabase/migrations/20260714100000_client_pin_recovery.sql | migration | .sql | 71 |
| supabase/migrations/20260714101000_update_client_pin_rpc.sql | migration | .sql | 46 |
| supabase/migrations/20260714101500_recovery_login_and_update_pin.sql | migration | .sql | 92 |
| supabase/migrations/20260715155500_secure_admin_product_supplier_config.sql | migration | .sql | 210 |
| supabase/migrations/20260715170000_secure_admin_product_url_import.sql | migration | .sql | 40 |
| supabase/migrations/20260715180000_secure_admin_batch_product_import.sql | migration | .sql | 277 |
| supabase/migrations/20260715212051_universal_product_import.sql | migration | .sql | 294 |
| supabase/migrations/20260716000000_product_barcode_support.sql | migration | .sql | 126 |
| supabase/migrations/20260716000001_import_rpc_barcode_support.sql | migration | .sql | 277 |
| supabase/migrations/20260716180000_secure_client_pin_recovery.sql | migration | .sql | 373 |
| supabase/migrations/20260716183000_individual_product_discounts.sql | migration | .sql | 204 |
| supabase/migrations/20260716183010_update_checkout_function.sql | migration | .sql | 967 |
| supabase/migrations/20260716183500_product_discount_validity.sql | migration | .sql | 1187 |
| supabase/migrations/20260716184000_product_discount_quantity_limit.sql | migration | .sql | 248 |
| supabase/migrations/20260716184100_checkout_discount_quota.sql | migration | .sql | 0 |
| supabase/migrations/20260717200000_hub_classificados_schema.sql | migration | .sql | 213 |
| supabase/migrations/20260717201000_hub_classificados_rpcs.sql | migration | .sql | 186 |
| supabase/migrations/20260717220000_gsa_viagens_schema.sql | migration | .sql | 323 |
| supabase/migrations/20260717221000_gsa_viagens_rpc.sql | migration | .sql | 130 |
| supabase/migrations/20260718120000_gsa_saude_complete.sql | migration | .sql | 266 |
| supabase/migrations/20260718121000_gsa_seguros_complete.sql | migration | .sql | 279 |
| test-results/.last-run.json | other | .json | 4 |
| test.ts | other | .ts | 28 |
| test2.ts | other | .ts | 16 |
| tests/e2e/0-stress-real-data.spec.ts | other | .ts | 248 |
| tests/e2e/1-auth-e-publico.spec.ts | other | .ts | 31 |
| tests/e2e/2-painel-cliente.spec.ts | other | .ts | 74 |
| tests/e2e/3-painel-admin.spec.ts | other | .ts | 63 |
| tests/e2e/4-painel-prestador.spec.ts | other | .ts | 39 |
| tests/example.spec.ts | other | .ts | 19 |
| tests/utils/cpf-generator.ts | other | .ts | 10 |
| tests/utils/db-setup.ts | other | .ts | 29 |
| test_query.js | other | .js | 23 |
| test_query2.js | other | .js | 20 |
| test_query3.js | other | .js | 12 |
| test_transfer.js | other | .js | 25 |
| tsconfig.json | other | .json | 27 |
| update_constraint.cjs | other | .cjs | 13 |
| update_portal.cjs | other | .cjs | 124 |
| update_session.cjs | other | .cjs | 36 |
| update_storehub_purchases.cjs | other | .cjs | 18 |
| update_vip_level_benefits.cjs | other | .cjs | 101 |
| vite.config.ts | other | .ts | 27 |