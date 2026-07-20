# Direct Write Audit

Generated at: 2026-07-19T03:00:48.685Z
Files scanned: 273
Direct operations found: 387
Sensitive operations found: 172

## Summary by target and operation
| type | target | op | count | sensitive | areas | files |
| --- | --- | --- | --- | --- | --- | --- |
| table_write | orcamentos | update | 12 | true | admin, servico_util, validacao | src/components/admin/OrcamentosModule.tsx, src/components/admin/OrdensCompraModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/utils/paymentPropagation.ts, src/validation/step2_sales_flow.ts |
| storage_operation | entregas_demandas | upload | 11 | true | admin, cliente, prestador | src/components/admin/demandas/DemandasComentarios.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/demandas/NovaDemandaModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/client/ClientServicos.tsx, src/components/prestador/PrestadorDemandas.tsx |
| table_write | faturas | insert | 11 | true | admin, outro, validacao | src/components/admin/OrcamentosModule.tsx, src/components/admin/OrdensAssinaturaModule.tsx, src/components/admin/OrdensServicoModule.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/validation/master_block2.ts, src/validation/step2_sales_flow.ts, src/validation/step6_subscriptions.ts, test.ts |
| table_write | clientes | update | 10 | true | admin, outro, servico_util, validacao | src/components/admin/OrdensCompraModule.tsx, src/pages/ClientPortal.tsx, src/utils/paymentPropagation.ts, src/utils/referral.ts, src/validation/master_block2.ts, src/validation/step1_referral.ts |
| storage_operation | documentos_cliente | upload | 9 | true | admin, cliente | src/components/admin/ReembolsosModule.tsx, src/components/admin/clientes/AdminClienteDocumentos.tsx, src/components/client/ClientMeuCredito.tsx, src/components/client/ClientOrcamentos.tsx, src/components/client/ClientProfile.tsx, src/components/client/ClientSuporte.tsx |
| storage_operation | gsa-store-images | upload | 8 | true | admin, outro | src/components/admin/AssinaturasModule.tsx, src/components/admin/ProdutosModule.tsx, src/components/admin/ServicosModule.tsx, supabase/functions/import-product-from-url/index.ts |
| table_write | ordens_assinatura | update | 7 | true | admin, servico_util, validacao | src/components/admin/OrdensAssinaturaModule.tsx, src/utils/paymentPropagation.ts, src/validation/step6_subscriptions.ts |
| table_write | ordens_servico | update | 7 | true | admin, servico_util, validacao | src/components/admin/OrdensServicoModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/utils/paymentPropagation.ts, src/validation/step2_sales_flow.ts |
| table_write | sistema_logs | insert | 7 | true | outro, validacao | src/validation/master_block3.ts, src/validation/master_block4.ts, supabase/functions/import-product-from-url/index.ts, supabase/functions/import-products-from-file/index.ts |
| storage_operation | emprestimos | upload | 6 | true | admin, cliente | src/components/admin/CreditoModule.tsx, src/components/admin/EmprestimosModule.tsx, src/components/client/ClientEmprestimos.tsx, src/components/client/ClientOrcamentos.tsx |
| table_write | prestador_transacoes | insert | 6 | true | admin, prestador, validacao | src/components/admin/prestadores/PrestadoresCadastro.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/prestador/PrestadorFinanceiro.tsx, src/components/prestador/PrestadorVouchers.tsx, src/validation/step2_sales_flow.ts |
| table_write | ordens_compra | update | 5 | true | admin, servico_util | src/components/admin/OrdensCompraModule.tsx, src/utils/paymentPropagation.ts |
| table_write | clientes | insert | 4 | true | admin, validacao | src/components/admin/prestadores/PrestadoresDemandas.tsx, src/validation/step1_referral.ts, src/validation/step4_integrity_audit.ts |
| table_write | faturas | update | 4 | true | admin, validacao | src/components/admin/OrdensCompraModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/validation/step3_finance_gamification.ts |
| table_write | ordens_assinatura | insert | 4 | true | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/validation/master_block2.ts, src/validation/step6_subscriptions.ts |
| table_write | cliente_promocoes | update | 3 | true | admin, servico_util | src/components/admin/OrcamentosModule.tsx, src/utils/promotions.ts |
| storage_operation | documentos_prestador | upload | 3 | true | admin, prestador, servico_util | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx, src/components/prestador/PrestadorDocumentos.tsx, src/lib/pdfSharingService.ts |
| table_write | loja_credito_movimentacoes | insert | 3 | true | admin, outro, servico_util | src/components/admin/OrdensCompraModule.tsx, src/pages/ClientPortal.tsx, src/utils/paymentPropagation.ts |
| table_write | ordens_servico | insert | 3 | true | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/validation/step2_sales_flow.ts |
| table_write | promocoes | update | 3 | true | admin | src/components/admin/OrcamentosModule.tsx, src/components/admin/PromocoesModule.tsx |
| storage_operation | documentos_cliente | remove | 2 | true | admin, cliente | src/components/admin/clientes/AdminClienteDocumentos.tsx, src/components/client/ClientProfile.tsx |
| storage_operation | documentos_prestador | remove | 2 | true | admin, servico_util | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx, src/lib/pdfSharingService.ts |
| storage_operation | fiscal_docs | upload | 2 | true | admin | src/components/admin/FiscalModule.tsx |
| table_write | orcamentos | insert | 2 | true | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/validation/step2_sales_flow.ts |
| storage_operation | orcamentos | upload | 2 | true | cliente | src/components/client/ClientOrcamentos.tsx, src/components/client/ClientServicos.tsx |
| table_write | ordens_compra | insert | 2 | true | admin | src/components/admin/OrcamentosModule.tsx |
| table_write | prestador_saques | update | 2 | true | prestador | src/components/prestador/PrestadorFinanceiro.tsx |
| table_write | promocoes | insert | 2 | true | admin, validacao | src/components/admin/PromocoesModule.tsx, src/validation/master_block2.ts |
| table_write | system_settings | update | 2 | true | admin | src/components/admin/OrcamentosModule.tsx |
| dynamic_table_write | table | delete | 2 | true | admin, validacao | src/components/admin/prestadores/PrestadoresCadastro.tsx, src/validation/base.ts |
| dynamic_table_write | table | update | 2 | true | admin, cliente | src/components/admin/ProtectionAdminModule.tsx, src/hooks/useAdminNotifications.tsx |
| table_write | vouchers | insert | 2 | true | admin | src/components/admin/IndicacoesModule.tsx, src/components/admin/VouchersModule.tsx |
| table_write | vouchers | update | 2 | true | admin, validacao | src/components/admin/VouchersModule.tsx, src/validation/step1_referral.ts |
| dynamic_table_write | bucketName | insert | 1 | true | admin | src/components/admin/TicketsModule.tsx |
| table_write | carteira_lancamentos | insert | 1 | true | servico_util | src/utils/referral.ts |
| table_write | carteira_lancamentos | delete | 1 | true | servico_util | src/utils/referral.ts |
| table_write | cupons_loja | insert | 1 | true | admin | src/components/admin/CuponsLojaModule.tsx |
| table_write | cupons_loja | update | 1 | true | admin | src/components/admin/CuponsLojaModule.tsx |
| table_write | cupons_loja | delete | 1 | true | admin | src/components/admin/CuponsLojaModule.tsx |
| table_write | emprestimos | insert | 1 | true | admin | src/components/admin/OrcamentosModule.tsx |
| table_write | extrato_financeiro | insert | 1 | true | servico_util | src/utils/referral.ts |
| table_write | loja_credito_solicitacoes | update | 1 | true | outro | src/pages/ClientPortal.tsx |
| table_write | pagamentos | insert | 1 | true | validacao | src/validation/step3_finance_gamification.ts |
| table_write | points_transactions | insert | 1 | true | admin | src/components/admin/OrdensCompraModule.tsx |
| table_write | pontos_movimentacoes | insert | 1 | true | admin | src/components/admin/OrdensCompraModule.tsx |
| table_write | pontos_movimentacoes | update | 1 | true | outro | src/pages/ClientPortal.tsx |
| table_write | prestador_saques | insert | 1 | true | prestador | src/components/prestador/PrestadorFinanceiro.tsx |
| table_write | prestador_saques | delete | 1 | true | prestador | src/components/prestador/PrestadorFinanceiro.tsx |
| table_write | promocoes | delete | 1 | true | admin | src/components/admin/PromocoesModule.tsx |
| dynamic_table_write | ref.table | update | 1 | true | admin | src/components/admin/SystemMonitorModule.tsx |
| dynamic_table_write | selectedIds | delete | 1 | true | admin | src/components/admin/ProdutosModule.tsx |
| dynamic_table_write | sol.tabela | delete | 1 | true | admin | src/components/admin/AcessosModule.tsx |
| table_write | vouchers | delete | 1 | true | admin | src/components/admin/VouchersModule.tsx |
| table_write | prestador_demandas | update | 28 | false | admin, prestador, validacao | src/components/admin/OrdensServicoModule.tsx, src/components/admin/demandas/DemandasComentarios.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/prestador/PrestadorDemandas.tsx, src/validation/step2_sales_flow.ts |
| table_write | os_notas | insert | 11 | false | admin, prestador, servico_util | src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/prestador/PrestadorDemandas.tsx, src/lib/osService.ts |
| table_write | produtos | update | 9 | false | admin, validacao | src/components/admin/ProdutosModule.tsx, src/validation/master_block2.ts |
| table_write | notificacoes | insert | 8 | false | outro, servico_util, validacao | src/lib/notificationService.ts, src/lib/notifications.tsx, src/pages/ClientPortal.tsx, src/validation/master_block3.ts |
| table_write | assinaturas | update | 6 | false | admin | src/components/admin/AssinaturasModule.tsx |
| table_write | tickets | insert | 6 | false | outro, prestador, validacao | src/components/prestador/PrestadorPremios.tsx, src/components/prestador/PrestadorSuporte.tsx, src/pages/ClientPortal.tsx, src/pages/Prestador/PrestadorDashboard.tsx, src/validation/master_block2.ts |
| table_write | notificacoes | update | 5 | false | cliente | src/hooks/useAdminNotifications.tsx, src/hooks/useClientNotifications.tsx, src/hooks/useProviderNotifications.tsx |
| table_write | prestador_demandas | insert | 5 | false | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/components/admin/demandas/NovaDemandaModal.tsx, src/validation/master_block3.ts, src/validation/step2_sales_flow.ts |
| table_write | prestadores | update | 5 | false | admin, prestador | src/components/admin/TicketsModule.tsx, src/components/admin/prestadores/PrestadoresCadastro.tsx, src/pages/Prestador/PrestadorDashboard.tsx |
| table_write | entregas_demandas | insert | 4 | false | admin | src/components/admin/demandas/DemandasComentarios.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx |
| table_write | prestadores | insert | 4 | false | admin, validacao | src/components/admin/prestadores/PrestadoresCadastro.tsx, src/validation/master_block3.ts, src/validation/step2_sales_flow.ts, src/validation/step3_finance_gamification.ts |
| table_write | servicos | update | 4 | false | admin | src/components/admin/ServicosModule.tsx |
| table_write | cliente_premios | update | 3 | false | admin | src/components/admin/PremiosModule.tsx |
| table_write | empresa | update | 3 | false | admin, validacao | src/components/admin/ConfiguracoesModule.tsx, src/components/admin/EmpresaModule.tsx, src/validation/master_block3.ts |
| table_write | entregas_demandas | update | 3 | false | admin, prestador | src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/prestador/PrestadorDemandas.tsx |
| table_write | gsa-store-images | update | 3 | false | admin | src/components/admin/AssinaturasModule.tsx, src/components/admin/ProdutosModule.tsx, src/components/admin/ServicosModule.tsx |
| table_write | produtos | delete | 3 | false | admin | src/components/admin/ProdutosModule.tsx |
| table_write | ticket_mensagens | insert | 3 | false | admin, prestador, validacao | src/components/admin/TicketsModule.tsx, src/components/prestador/PrestadorSuporte.tsx, src/validation/master_block2.ts |
| table_write | assinaturas | insert | 2 | false | admin, validacao | src/components/admin/AssinaturasModule.tsx, src/validation/master_block2.ts |
| table_write | client_levels | update | 2 | false | admin | src/components/admin/AreaVIPModule.tsx |
| table_write | colaboradores | update | 2 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | colaboradores | insert | 2 | false | admin, validacao | src/components/admin/AcessosModule.tsx, src/validation/master_block4.ts |
| table_write | empresa | insert | 2 | false | admin | src/components/admin/ConfiguracoesModule.tsx, src/components/admin/EmpresaModule.tsx |
| table_write | formas_pagamento | update | 2 | false | admin | src/components/admin/ConfiguracoesModule.tsx |
| table_write | gsa-store-images | insert | 2 | false | outro | supabase/functions/import-product-from-url/index.ts |
| table_write | indicacoes | insert | 2 | false | admin, validacao | src/components/admin/IndicacoesModule.tsx, src/validation/step1_referral.ts |
| table_write | indicacoes | update | 2 | false | admin, servico_util | src/components/admin/IndicacoesModule.tsx, src/utils/referral.ts |
| table_write | loja_reembolsos | update | 2 | false | admin, outro | src/components/admin/ReembolsosModule.tsx, test_query3.js |
| table_write | loja_solicitacoes | update | 2 | false | admin, servico_util | src/components/admin/LojaTrocasModule.tsx, src/utils/paymentPropagation.ts |
| table_write | ordens_fiscais | insert | 2 | false | admin, validacao | src/components/admin/FinanceiroModule.tsx, src/validation/master_block3.ts |
| table_write | prestador_historico | insert | 2 | false | admin | src/components/admin/prestadores/PrestadoresCadastro.tsx |
| table_write | prestador_vouchers | update | 2 | false | admin, prestador | src/components/admin/prestadores/AdminPrestadorVouchers.tsx, src/components/prestador/PrestadorVouchers.tsx |
| table_write | promocoes_quantidade | update | 2 | false | admin | src/components/admin/PromocaoQuantidadeForm.tsx |
| table_write | solicitacoes_exclusao | update | 2 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | solicitacoes_exclusao | insert | 2 | false | servico_util, validacao | src/lib/deleteRequest.ts, src/validation/master_block4.ts |
| table_write | ${domain}_cotacoes | update | 1 | false | admin | src/components/admin/ProtectionAdminModule.tsx |
| table_write | ${domain}_parceiros | upsert | 1 | false | admin | src/components/admin/ProtectionAdminModule.tsx |
| table_write | ${domain}_propostas | insert | 1 | false | admin | src/components/admin/ProtectionAdminModule.tsx |
| table_write | admin_notificacoes | update | 1 | false | cliente | src/hooks/useAdminNotifications.tsx |
| table_write | admin_notificacoes | delete | 1 | false | cliente | src/hooks/useAdminNotifications.tsx |
| table_write | assinaturas | delete | 1 | false | admin | src/components/admin/AssinaturasModule.tsx |
| table_write | classificados_anuncios | update | 1 | false | admin | src/components/admin/ClassifiedsModule.tsx |
| table_write | classificados_transacoes | update | 1 | false | admin | src/components/admin/ClassifiedsModule.tsx |
| table_write | cliente_documentos | insert | 1 | false | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx |
| table_write | cliente_documentos | update | 1 | false | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx |
| table_write | cliente_notas_admin | update | 1 | false | admin | src/components/admin/ClientesModule.tsx |
| table_write | cliente_notas_admin | insert | 1 | false | admin | src/components/admin/ClientesModule.tsx |
| table_write | cliente_notas_admin | delete | 1 | false | admin | src/components/admin/ClientesModule.tsx |
| table_write | cliente_premios | insert | 1 | false | admin | src/components/admin/PremiosModule.tsx |
| table_write | colaborador_modulos | delete | 1 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | colaborador_modulos | insert | 1 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | documentos_cliente | insert | 1 | false | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx |
| table_write | documentos_cliente | delete | 1 | false | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx |
| table_write | documentos_cliente | update | 1 | false | admin | src/components/admin/ReembolsosModule.tsx |
| table_write | documentos_prestador | insert | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx |
| table_write | documentos_prestador | delete | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx |
| table_write | documentos_prestador | update | 1 | false | prestador | src/components/prestador/PrestadorDocumentos.tsx |
| table_write | emprestimo_historico | insert | 1 | false | servico_util | src/utils/emprestimoUtils.ts |
| table_write | fatura_contestacoes | update | 1 | false | admin | src/components/admin/FinanceiroModule.tsx |
| table_write | fiscal_docs | update | 1 | false | admin | src/components/admin/FiscalModule.tsx |
| table_write | formas_pagamento | insert | 1 | false | admin | src/components/admin/ConfiguracoesModule.tsx |
| table_write | funcoes | update | 1 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | funcoes | insert | 1 | false | admin | src/components/admin/AcessosModule.tsx |
| table_write | level_history | insert | 1 | false | admin | src/components/admin/AreaVIPModule.tsx |
| table_write | loja_carrinhos | update | 1 | false | cliente | src/hooks/useStoreCart.ts |
| table_write | loja_carrinhos | delete | 1 | false | cliente | src/hooks/useStoreCart.ts |
| table_write | loja_categorias | update | 1 | false | admin | src/components/admin/LojaCategoriasModule.tsx |
| table_write | loja_categorias | insert | 1 | false | admin | src/components/admin/LojaCategoriasModule.tsx |
| table_write | loja_categorias | delete | 1 | false | admin | src/components/admin/LojaCategoriasModule.tsx |
| table_write | loja_estoque_historico | insert | 1 | false | admin | src/components/admin/ProdutosModule.tsx |
| table_write | loja_reembolsos | insert | 1 | false | admin | src/components/admin/OrdensCompraModule.tsx |
| table_write | notificacoes | delete | 1 | false | cliente | src/hooks/useAdminNotifications.tsx |
| table_write | ordens_fiscais | update | 1 | false | admin | src/components/admin/FiscalModule.tsx |
| table_write | ordens_fiscais | delete | 1 | false | admin | src/components/admin/FiscalModule.tsx |
| table_write | os_notas | delete | 1 | false | admin | src/components/admin/OrdensServicoModule.tsx |
| table_write | prestador_agendamentos | insert | 1 | false | prestador | src/components/prestador/PrestadorAgenda.tsx |
| table_write | prestador_agendamentos | update | 1 | false | prestador | src/components/prestador/PrestadorAgenda.tsx |
| table_write | prestador_agendamentos | delete | 1 | false | prestador | src/components/prestador/PrestadorAgenda.tsx |
| table_write | prestador_demandas_historico | insert | 1 | false | servico_util | src/lib/demandService.ts |
| table_write | prestador_documentos | insert | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx |
| table_write | prestador_documentos | update | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx |
| table_write | prestador_premios | insert | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorPremios.tsx |
| table_write | prestador_premios | delete | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorPremios.tsx |
| table_write | prestador_premios | update | 1 | false | prestador | src/components/prestador/PrestadorPremios.tsx |
| table_write | prestador_promocoes | update | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorPromocoes.tsx |
| table_write | prestador_promocoes | insert | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorPromocoes.tsx |
| table_write | prestador_promocoes | delete | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorPromocoes.tsx |
| table_write | prestador_promocoes_ativacoes | insert | 1 | false | prestador | src/components/prestador/PrestadorPromocoes.tsx |
| table_write | prestador_suporte_demandas | update | 1 | false | outro | src/components/common/SupportConversationModal.tsx |
| table_write | prestador_suporte_demandas | insert | 1 | false | prestador | src/components/prestador/PrestadorDemandas.tsx |
| table_write | prestador_vouchers | insert | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorVouchers.tsx |
| table_write | prestador_vouchers | delete | 1 | false | admin | src/components/admin/prestadores/AdminPrestadorVouchers.tsx |
| table_write | prestadores | delete | 1 | false | admin | src/components/admin/prestadores/PrestadoresCadastro.tsx |
| table_write | produtos | insert | 1 | false | admin | src/components/admin/ProdutosModule.tsx |
| table_write | promocoes_quantidade | insert | 1 | false | admin | src/components/admin/PromocaoQuantidadeForm.tsx |
| table_write | promocoes_quantidade | delete | 1 | false | admin | src/components/admin/PromocaoQuantidadeModule.tsx |
| table_write | servicos | insert | 1 | false | admin | src/components/admin/ServicosModule.tsx |
| table_write | servicos | delete | 1 | false | admin | src/components/admin/ServicosModule.tsx |
| table_write | solicitacoes_exclusao | delete | 1 | false | validacao | src/validation/step4_integrity_audit.ts |
| table_write | suporte_mensagens | insert | 1 | false | outro | src/components/common/SupportConversationModal.tsx |
| table_write | tickets | update | 1 | false | admin | src/components/admin/TicketsModule.tsx |
| table_write | viagens_orcamentos | insert | 1 | false | cliente | src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx |
| table_write | viagens_propostas | update | 1 | false | cliente | src/components/client/marketplace/travel/TravelProposalsPage.tsx |

## Sensitive operation records
| type | area | file | line | target | op |
| --- | --- | --- | --- | --- | --- |
| dynamic_table_write | admin | src/components/admin/AcessosModule.tsx | 363 | sol.tabela | delete |
| storage_operation | admin | src/components/admin/AssinaturasModule.tsx | 103 | gsa-store-images | upload |
| storage_operation | admin | src/components/admin/AssinaturasModule.tsx | 701 | gsa-store-images | upload |
| storage_operation | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx | 127 | documentos_cliente | upload |
| storage_operation | admin | src/components/admin/clientes/AdminClienteDocumentos.tsx | 227 | documentos_cliente | remove |
| storage_operation | admin | src/components/admin/CreditoModule.tsx | 429 | emprestimos | upload |
| table_write | admin | src/components/admin/CuponsLojaModule.tsx | 47 | cupons_loja | insert |
| table_write | admin | src/components/admin/CuponsLojaModule.tsx | 93 | cupons_loja | update |
| table_write | admin | src/components/admin/CuponsLojaModule.tsx | 116 | cupons_loja | delete |
| storage_operation | admin | src/components/admin/demandas/DemandasComentarios.tsx | 61 | entregas_demandas | upload |
| table_write | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 418 | ordens_servico | update |
| table_write | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 422 | orcamentos | update |
| table_write | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 426 | faturas | update |
| storage_operation | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 487 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 583 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/demandas/DemandasDetalhesModal.tsx | 1432 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/demandas/NovaDemandaModal.tsx | 75 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/EmprestimosModule.tsx | 259 | emprestimos | upload |
| storage_operation | admin | src/components/admin/FiscalModule.tsx | 167 | fiscal_docs | upload |
| storage_operation | admin | src/components/admin/FiscalModule.tsx | 169 | fiscal_docs | upload |
| table_write | admin | src/components/admin/IndicacoesModule.tsx | 153 | vouchers | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 225 | system_settings | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 247 | promocoes | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 248 | cliente_promocoes | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 264 | ordens_servico | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 322 | ordens_compra | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 338 | faturas | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 354 | ordens_assinatura | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 376 | faturas | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 411 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 451 | system_settings | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 465 | promocoes | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 466 | cliente_promocoes | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 471 | ordens_servico | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 494 | ordens_compra | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 509 | faturas | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 523 | ordens_assinatura | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 543 | faturas | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 591 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 630 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 678 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 811 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 850 | orcamentos | update |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 1429 | orcamentos | insert |
| table_write | admin | src/components/admin/OrcamentosModule.tsx | 1436 | emprestimos | insert |
| table_write | admin | src/components/admin/OrdensAssinaturaModule.tsx | 117 | ordens_assinatura | update |
| table_write | admin | src/components/admin/OrdensAssinaturaModule.tsx | 156 | ordens_assinatura | update |
| table_write | admin | src/components/admin/OrdensAssinaturaModule.tsx | 186 | faturas | insert |
| table_write | admin | src/components/admin/OrdensAssinaturaModule.tsx | 238 | ordens_assinatura | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 155 | ordens_compra | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 225 | orcamentos | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 316 | clientes | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 333 | pontos_movimentacoes | insert |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 343 | points_transactions | insert |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 368 | faturas | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 400 | clientes | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 420 | faturas | update |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 432 | loja_credito_movimentacoes | insert |
| table_write | admin | src/components/admin/OrdensCompraModule.tsx | 790 | ordens_compra | update |
| table_write | admin | src/components/admin/OrdensServicoModule.tsx | 144 | ordens_servico | update |
| table_write | admin | src/components/admin/OrdensServicoModule.tsx | 452 | ordens_servico | update |
| table_write | admin | src/components/admin/OrdensServicoModule.tsx | 500 | ordens_servico | update |
| table_write | admin | src/components/admin/OrdensServicoModule.tsx | 516 | faturas | insert |
| storage_operation | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx | 122 | documentos_prestador | upload |
| storage_operation | admin | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx | 206 | documentos_prestador | remove |
| table_write | admin | src/components/admin/prestadores/PrestadoresCadastro.tsx | 1537 | prestador_transacoes | insert |
| dynamic_table_write | admin | src/components/admin/prestadores/PrestadoresCadastro.tsx | 258 | table | delete |
| table_write | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 122 | clientes | insert |
| table_write | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 732 | ordens_servico | update |
| table_write | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 749 | faturas | insert |
| table_write | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 794 | prestador_transacoes | insert |
| storage_operation | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 374 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 864 | entregas_demandas | upload |
| storage_operation | admin | src/components/admin/prestadores/PrestadoresDemandas.tsx | 2829 | entregas_demandas | upload |
| dynamic_table_write | admin | src/components/admin/ProdutosModule.tsx | 381 | selectedIds | delete |
| storage_operation | admin | src/components/admin/ProdutosModule.tsx | 208 | gsa-store-images | upload |
| storage_operation | admin | src/components/admin/ProdutosModule.tsx | 1879 | gsa-store-images | upload |
| table_write | admin | src/components/admin/PromocoesModule.tsx | 112 | promocoes | update |
| table_write | admin | src/components/admin/PromocoesModule.tsx | 146 | promocoes | insert |
| table_write | admin | src/components/admin/PromocoesModule.tsx | 216 | promocoes | delete |
| dynamic_table_write | admin | src/components/admin/ProtectionAdminModule.tsx | 60 | table | update |
| storage_operation | admin | src/components/admin/ReembolsosModule.tsx | 242 | documentos_cliente | upload |
| storage_operation | admin | src/components/admin/ServicosModule.tsx | 102 | gsa-store-images | upload |
| storage_operation | admin | src/components/admin/ServicosModule.tsx | 612 | gsa-store-images | upload |
| dynamic_table_write | admin | src/components/admin/SystemMonitorModule.tsx | 156 | ref.table | update |
| dynamic_table_write | admin | src/components/admin/TicketsModule.tsx | 284 | bucketName | insert |
| table_write | admin | src/components/admin/VouchersModule.tsx | 223 | vouchers | insert |
| table_write | admin | src/components/admin/VouchersModule.tsx | 279 | vouchers | delete |
| table_write | admin | src/components/admin/VouchersModule.tsx | 313 | vouchers | update |
| storage_operation | cliente | src/components/client/ClientEmprestimos.tsx | 151 | emprestimos | upload |
| storage_operation | cliente | src/components/client/ClientEmprestimos.tsx | 291 | emprestimos | upload |
| storage_operation | cliente | src/components/client/ClientEmprestimos.tsx | 372 | emprestimos | upload |
| storage_operation | cliente | src/components/client/ClientMeuCredito.tsx | 503 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientMeuCredito.tsx | 553 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientMeuCredito.tsx | 633 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientOrcamentos.tsx | 282 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientOrcamentos.tsx | 383 | orcamentos | upload |
| storage_operation | cliente | src/components/client/ClientOrcamentos.tsx | 1495 | emprestimos | upload |
| storage_operation | cliente | src/components/client/ClientOrcamentos.tsx | 1616 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientProfile.tsx | 377 | documentos_cliente | upload |
| storage_operation | cliente | src/components/client/ClientProfile.tsx | 433 | documentos_cliente | remove |
| storage_operation | cliente | src/components/client/ClientServicos.tsx | 175 | orcamentos | upload |
| storage_operation | cliente | src/components/client/ClientServicos.tsx | 677 | entregas_demandas | upload |
| storage_operation | cliente | src/components/client/ClientSuporte.tsx | 174 | documentos_cliente | upload |
| storage_operation | prestador | src/components/prestador/PrestadorDemandas.tsx | 404 | entregas_demandas | upload |
| storage_operation | prestador | src/components/prestador/PrestadorDemandas.tsx | 514 | entregas_demandas | upload |
| storage_operation | prestador | src/components/prestador/PrestadorDocumentos.tsx | 136 | documentos_prestador | upload |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 174 | prestador_saques | insert |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 192 | prestador_transacoes | insert |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 203 | prestador_saques | delete |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 263 | prestador_saques | update |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 279 | prestador_transacoes | insert |
| table_write | prestador | src/components/prestador/PrestadorFinanceiro.tsx | 290 | prestador_saques | update |
| table_write | prestador | src/components/prestador/PrestadorVouchers.tsx | 94 | prestador_transacoes | insert |
| dynamic_table_write | cliente | src/hooks/useAdminNotifications.tsx | 580 | table | update |
| storage_operation | servico_util | src/lib/pdfSharingService.ts | 17 | documentos_prestador | upload |
| storage_operation | servico_util | src/lib/pdfSharingService.ts | 23 | documentos_prestador | remove |
| table_write | outro | src/pages/ClientPortal.tsx | 735 | clientes | update |
| table_write | outro | src/pages/ClientPortal.tsx | 752 | pontos_movimentacoes | update |
| table_write | outro | src/pages/ClientPortal.tsx | 866 | clientes | update |
| table_write | outro | src/pages/ClientPortal.tsx | 876 | loja_credito_movimentacoes | insert |
| table_write | outro | src/pages/ClientPortal.tsx | 893 | loja_credito_solicitacoes | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 123 | clientes | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 129 | loja_credito_movimentacoes | insert |
| table_write | servico_util | src/utils/paymentPropagation.ts | 158 | ordens_compra | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 173 | orcamentos | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 183 | ordens_compra | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 188 | ordens_assinatura | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 198 | ordens_assinatura | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 213 | orcamentos | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 223 | ordens_compra | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 228 | ordens_assinatura | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 238 | ordens_servico | update |
| table_write | servico_util | src/utils/paymentPropagation.ts | 251 | orcamentos | update |
| table_write | servico_util | src/utils/promotions.ts | 93 | cliente_promocoes | update |
| table_write | servico_util | src/utils/referral.ts | 95 | clientes | update |
| table_write | servico_util | src/utils/referral.ts | 102 | carteira_lancamentos | insert |
| table_write | servico_util | src/utils/referral.ts | 110 | clientes | update |
| table_write | servico_util | src/utils/referral.ts | 114 | extrato_financeiro | insert |
| table_write | servico_util | src/utils/referral.ts | 124 | carteira_lancamentos | delete |
| table_write | servico_util | src/utils/referral.ts | 126 | clientes | update |
| dynamic_table_write | validacao | src/validation/base.ts | 25 | table | delete |
| table_write | validacao | src/validation/master_block2.ts | 33 | ordens_assinatura | insert |
| table_write | validacao | src/validation/master_block2.ts | 46 | faturas | insert |
| table_write | validacao | src/validation/master_block2.ts | 116 | promocoes | insert |
| table_write | validacao | src/validation/master_block2.ts | 135 | clientes | update |
| table_write | validacao | src/validation/master_block3.ts | 106 | sistema_logs | insert |
| table_write | validacao | src/validation/master_block4.ts | 47 | sistema_logs | insert |
| table_write | validacao | src/validation/step1_referral.ts | 17 | clientes | insert |
| table_write | validacao | src/validation/step1_referral.ts | 50 | clientes | insert |
| table_write | validacao | src/validation/step1_referral.ts | 68 | vouchers | update |
| table_write | validacao | src/validation/step1_referral.ts | 74 | clientes | update |
| table_write | validacao | src/validation/step2_sales_flow.ts | 38 | orcamentos | insert |
| table_write | validacao | src/validation/step2_sales_flow.ts | 57 | orcamentos | update |
| table_write | validacao | src/validation/step2_sales_flow.ts | 67 | ordens_servico | insert |
| table_write | validacao | src/validation/step2_sales_flow.ts | 120 | prestador_transacoes | insert |
| table_write | validacao | src/validation/step2_sales_flow.ts | 130 | ordens_servico | update |
| table_write | validacao | src/validation/step2_sales_flow.ts | 138 | faturas | insert |
| table_write | validacao | src/validation/step3_finance_gamification.ts | 47 | faturas | update |
| table_write | validacao | src/validation/step3_finance_gamification.ts | 58 | pagamentos | insert |
| table_write | validacao | src/validation/step4_integrity_audit.ts | 52 | clientes | insert |
| table_write | validacao | src/validation/step6_subscriptions.ts | 19 | ordens_assinatura | insert |
| table_write | validacao | src/validation/step6_subscriptions.ts | 36 | faturas | insert |
| table_write | validacao | src/validation/step6_subscriptions.ts | 51 | ordens_assinatura | update |
| table_write | outro | supabase/functions/import-product-from-url/index.ts | 97 | sistema_logs | insert |
| table_write | outro | supabase/functions/import-product-from-url/index.ts | 128 | sistema_logs | insert |
| table_write | outro | supabase/functions/import-product-from-url/index.ts | 160 | sistema_logs | insert |
| storage_operation | outro | supabase/functions/import-product-from-url/index.ts | 191 | gsa-store-images | upload |
| storage_operation | outro | supabase/functions/import-product-from-url/index.ts | 241 | gsa-store-images | upload |
| table_write | outro | supabase/functions/import-products-from-file/index.ts | 83 | sistema_logs | insert |
| table_write | outro | supabase/functions/import-products-from-file/index.ts | 502 | sistema_logs | insert |
| table_write | outro | test.ts | 11 | faturas | insert |