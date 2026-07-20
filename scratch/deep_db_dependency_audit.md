# Auditoria Profunda de Dependencias do Banco

Gerado em: 2026-07-19T03:13:01.787Z
Arquivos analisados: 324

## Totais
- Referencias a tabelas no codigo: 886
- Tabelas publicas no banco vivo: 112
- Tabelas ausentes: 12
- Referencias a buckets: 44
- Buckets no storage vivo: 9
- Buckets ausentes: 0
- Referencias a RPCs: 104
- Functions publicas no banco vivo: 233
- RPCs ausentes: 3
- Colunas usadas mas nao encontradas: 31

## Tabelas ausentes
| table | refs | activeSignals | suggestions | files | scopes |
| --- | --- | --- | --- | --- | --- |
| ${domain}_cotacoes | 2 | sim |  | src/components/admin/ProtectionAdminModule.tsx | ProposalModal, save |
| ${domain}_parceiros | 2 | sim |  | src/components/admin/ProtectionAdminModule.tsx | EditModal, ProposalModal |
| ${domain}_propostas | 1 | sim |  | src/components/admin/ProtectionAdminModule.tsx | save |
| classificados_anuncios | 8 | sim |  | src/components/admin/ClassifiedsModule.tsx, src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx, src/components/client/marketplace/classifieds/GeneralClassifiedsPage.tsx, src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx, src/components/client/marketplace/classifieds/RealEstateMarketplacePage.tsx, src/components/client/marketplace/classifieds/VehiclesMarketplacePage.tsx | fetchAds, handleApproveAd, handleRejectAd, fetchAdDetails, fetchGeneralAds, fetchMyAds, fetchProperties, fetchVehicles |
| classificados_comissoes_config | 1 | sim |  | src/components/client/marketplace/classifieds/CreateListingWizard.tsx | fetchCommissions |
| classificados_mensagens | 1 | sim |  | src/components/admin/ClassifiedsModule.tsx | fetchMessages |
| classificados_propostas | 1 | sim |  | src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx | fetchProposals |
| classificados_transacoes | 1 | sim |  | src/components/admin/ClassifiedsModule.tsx | fetchTransactions |
| viagens_orcamentos | 2 | sim | orcamentos | src/components/admin/TravelAdminModule.tsx, src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx | fetchSolicitacoes, handleSubmit |
| viagens_pacotes | 2 | sim |  | src/components/client/marketplace/travel/TravelCategoryPage.tsx, src/components/client/marketplace/travel/TravelPackageDetailPage.tsx | fetchPackages, fetchPackage |
| viagens_propostas | 2 | sim |  | src/components/client/marketplace/travel/TravelProposalsPage.tsx | fetchPropostas, handleAceitarProposta |
| viagens_transacoes | 2 | sim |  | src/components/client/marketplace/travel/MyTripsPage.tsx, src/components/client/marketplace/travel/TravelReservationPage.tsx | fetchTrips, fetchTripDetails |

## Buckets ausentes
_Nenhum item encontrado._

## RPCs ausentes
| rpc | refs | suggestions | files |
| --- | --- | --- | --- |
| execute_sql | 2 |  | apply_migration.cjs, update_constraint.cjs |
| rpc_criar_anuncio_classificado | 1 |  | src/components/client/marketplace/classifieds/CreateListingWizard.tsx |
| rpc_moderar_mensagem_classificado | 1 |  | src/components/admin/ClassifiedsModule.tsx |

## Colunas ausentes ou possiveis falsos positivos de parser
| table | column | file | line | scope | op |
| --- | --- | --- | --- | --- | --- |
| faturas | clientes | src/components/admin/CobrancaModule.tsx | 166 | fetchFaturasElegiveisCobranca | select |
| faturas | cobrancas | src/components/admin/CobrancaModule.tsx | 166 | fetchFaturasElegiveisCobranca | select |
| prestador_demandas | colaborador | src/components/admin/demandas/DemandasDashboard.tsx | 32 | carregar | select |
| prestador_demandas | prestador | src/components/admin/demandas/DemandasDashboard.tsx | 32 | carregar | select |
| ordens_servico | cliente | src/components/admin/demandas/NovaDemandaModal.tsx | 48 | NovaDemandaModal | select |
| ordens_servico | orcamentos | src/components/admin/demandas/NovaDemandaModal.tsx | 48 | NovaDemandaModal | select |
| ordens_servico | orcamentos | src/components/admin/FinanceiroModule.tsx | 931 | fetchOrdersForClient | select |
| ordens_compra | orcamentos | src/components/admin/FinanceiroModule.tsx | 938 | fetchOrdersForClient | select |
| ordens_assinatura | orcamentos | src/components/admin/FinanceiroModule.tsx | 945 | fetchOrdersForClient | select |
| cliente_promocoes | promocoes.status | src/components/admin/OrcamentosModule.tsx | 1249 | checkActivePromotion | select |
| orcamentos | ordens_servico | src/components/admin/OrcamentosModule.tsx | 1321 | checkReferralDiscount | select |
| indicacoes | indicador | src/components/admin/OrcamentosModule.tsx | 1964 | clienteIndicacaoId | select |
| prestador_promocoes_ativacoes | prestadores | src/components/admin/prestadores/AdminPrestadorPromocoes.tsx | 81 | fetchAtivacoes | select |
| ordens_servico | orcamentos | src/components/admin/prestadores/PrestadoresDemandas.tsx | 186 | fetchOrdensServico | select |
| prestador_demandas | prestador | src/components/admin/prestadores/PrestadoresDemandas.tsx | 255 | fetchDemandas | select |
| prestador_demandas | ordem_servico | src/components/admin/prestadores/PrestadoresDemandas.tsx | 255 | fetchDemandas | select |
| cliente_promocoes | cliente | src/components/admin/PromoDetalhesModal.tsx | 49 | fetchAtivacoes | select |
| faturas | pagamentos | src/components/admin/ReembolsosModule.tsx | 70 | fetchPaymentDetails | select |
| emprestimos | clientes | src/components/admin/relatorios/RelatorioRentabilidade.tsx | 21 | carregar | select |
| emprestimos | emprestimo_parcelas | src/components/admin/relatorios/RelatorioRentabilidade.tsx | 21 | carregar | select |
| faturas | clientes | src/components/admin/relatorios/RelatorioRentabilidade.tsx | 31 | carregar | select |
| faturas | ordens_compra | src/components/admin/relatorios/RelatorioRentabilidade.tsx | 31 | carregar | select |
| pagamentos | faturas | src/components/admin/VouchersModule.tsx | 70 | handleOpenDetails | select |
| extrato_financeiro | clientes | src/components/admin/VouchersModule.tsx | 77 | handleOpenDetails | select |
| cliente_promocoes | promocoes.status | src/components/client/ClientOrcamentos.tsx | 1445 | checkActivePromotion | select |
| pagamentos | faturas | src/components/client/ClientVouchers.tsx | 90 | fetchVouchers | select |
| pagamentos | faturas.cliente_id | src/components/client/ClientVouchers.tsx | 90 | fetchVouchers | select |
| clientes | client_levels | src/utils/gamification.ts | 30 | processGamificationPoints | select |
| faturas | ordens_servico | src/utils/promotions.ts | 13 | processPromotionUsage | select |
| faturas | ordens_compra | src/utils/promotions.ts | 13 | processPromotionUsage | select |
| faturas | ordens_assinatura | src/utils/promotions.ts | 13 | processPromotionUsage | select |

## Observacao
A validacao de colunas e estatica e conservadora. Selects relacionais do Supabase e aliases podem gerar falso positivo; itens desta secao exigem revisao antes de migration.