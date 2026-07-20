# Auditoria Profunda do Banco Vivo

Gerado em: 2026-07-19T03:20:32.161Z
Status: ok

## Achados

| severity | code | count | message |
| --- | --- | --- | --- |
| critical | OPEN_RLS_POLICIES | 92 | Policies public/anon com expressao true. |
| critical | SENSITIVE_ANON_DATA_VISIBLE | 13 | Tabelas sensiveis com linhas visiveis ao papel anon. |
| critical | LOCAL_MIGRATIONS_NOT_APPLIED | 119 | Migrations locais sem versao registrada no banco vivo. |
| high | UNINDEXED_FOREIGN_KEYS | 99 | Foreign keys sem indice de prefixo correspondente. |
| high | UNSAFE_SECURITY_DEFINER | 29 | Functions SECURITY DEFINER executaveis pelo navegador sem search_path fixo. |
| medium | DUPLICATE_MIGRATION_VERSIONS | 2 | Versoes de migration repetidas no repositorio. |
| medium | EMPTY_MIGRATIONS | 1 | Migrations vazias no repositorio. |

## Drift de migrations

- Locais: 119
- Registradas no banco: 154
- Locais sem registro: 119
- Versoes locais duplicadas: 2
- Migrations vazias: 1

| version | name |
| --- | --- |
| 20260310 | 20260310_add_voucher_columns.sql |
| 20260312000000 | 20260312000000_add_renovacao_fields.sql |
| 20260312000001 | 20260312000001_add_estornado_status.sql |
| 20260313000000 | 20260313000000_add_cadastro_padrao.sql |
| 20260315000000 | 20260315000000_add_promocao_desconto_manual.sql |
| 20260315000001 | 20260315000001_add_promocao_fk.sql |
| 20260315000002 | 20260315000002_fix_promocoes_schema.sql |
| 20260315000003 | 20260315000003_fix_notifications_schema.sql |
| 20260316000000 | 20260316000000_realtime_triggers.sql |
| 20260317000000 | 20260317000000_add_pacote_nivel_to_faturas.sql |
| 20260317000001 | 20260317000001_fix_cascade_delete.sql |
| 20260317000002 | 20260317000002_auto_level_upgrade.sql |
| 20260317000002 | 20260317000002_create_prestadores_schema.sql |
| 20260318000000 | 20260318000000_update_prestador_demandas.sql |
| 20260318000001 | 20260318000001_make_prestador_id_nullable.sql |
| 20260318000001 | 20260318000001_support_and_adjustments.sql |
| 20260318000002 | 20260318000002_ensure_prestadores_realtime.sql |
| 20260318000003 | 20260318000003_fix_prestadores_cascade.sql |
| 20260318000004 | 20260318000004_grant_permissions.sql |
| 20260318000005 | 20260318000005_add_demanda_id_to_transacoes.sql |
| 20260318000006 | 20260318000006_create_agendamentos.sql |
| 20260423150500 | 20260423150500_add_comprovante_concorrente.sql |
| 20260424140000 | 20260424140000_add_desconto_to_promocoes.sql |
| 20260429000000 | 20260429000000_add_data_ativacao_to_emprestimos.sql |
| 20260429000001 | 20260429000001_add_quitacao_acordo.sql |
| 20260429000002 | 20260429000002_payoff_automation.sql |
| 20260506000000 | 20260506000000_fix_demand_history_rls.sql |
| 20260518000000 | 20260518000000_add_imagens_anexo_to_loja_solicitacoes.sql |
| 20260519000000 | 20260519000000_add_numero_to_prestadores.sql |
| 20260519000001 | 20260519000001_add_descricao_detalhada_to_loja_solicitacoes.sql |
| 20260525000000 | 20260525000000_add_prazo_meses.sql |
| 20260525000001 | 20260525000001_cron_faturas_assinaturas.sql |
| 20260527000000 | 20260527000000_fix_emprestimo_quitacao.sql |
| 20260527000001 | 20260527000001_auto_revert_quitacao.sql |
| 20260527142323 | 20260527142323_add_quitacao_orcamentos.sql |
| 20260602000000 | 20260602000000_create_os_suporte_mensagens.sql |
| 20260609000000 | 20260609000000_secure_rpc_gamification.sql |
| 20260609000001 | 20260609000001_add_visualizado_promocoes.sql |
| 20260609000002 | 20260609000002_add_promocoes_quantidade_ativadas.sql |
| 20260609163754 | 20260609163754_fix_loja_reembolsos.sql |
| 20260706000100 | 20260706000100_organize_vip_level_benefits.sql |
| 20260711080000 | 20260711080000_create_orcamento_timeline_compat.sql |
| 20260711081000 | 20260711081000_fix_orcamento_timeline_rls.sql |
| 20260711110500 | 20260711110500_fix_invoice_items_odc_0122.sql |
| 20260711121000 | 20260711121000_fix_store_checkout_discounts_coupons.sql |
| 20260711160000 | 20260711160000_financial_client_rpc_hardening.sql |
| 20260711163000 | 20260711163000_client_financial_rpc_more_flows.sql |
| 20260711164500 | 20260711164500_approve_budget_rpc.sql |
| 20260711170000 | 20260711170000_close_remaining_client_financial_rpcs.sql |
| 20260711171000 | 20260711171000_approve_budget_negotiation_rpc.sql |
| 20260711172000 | 20260711172000_store_invoice_and_subscription_rpcs.sql |
| 20260711173000 | 20260711173000_client_portal_credit_bonus_rpcs.sql |
| 20260711174000 | 20260711174000_client_operational_write_rpc.sql |
| 20260711174500 | 20260711174500_extend_client_operational_write_whitelist.sql |
| 20260711175000 | 20260711175000_extend_operational_write_final_tables.sql |
| 20260711223000 | 20260711223000_fix_store_invoice_without_order_items.sql |
| 20260714010000 | 20260714010000_fix_db_dependency_gaps.sql |
| 20260714011000 | 20260714011000_complete_cliente_premios_columns.sql |
| 20260714013000 | 20260714013000_secure_session_rpc_foundation.sql |
| 20260714013500 | 20260714013500_fix_secure_session_pgcrypto_schema.sql |
| 20260714014000 | 20260714014000_reduce_public_session_log_writes.sql |
| 20260714014500 | 20260714014500_secure_log_action_rpc.sql |
| 20260714020000 | 20260714020000_secure_admin_withdrawal_transfer_rpcs.sql |
| 20260714021000 | 20260714021000_secure_admin_invoice_payment_rpc.sql |
| 20260714022000 | 20260714022000_secure_admin_invoice_collection_cancel_rpcs.sql |
| 20260714023000 | 20260714023000_secure_admin_collection_basic_rpcs.sql |
| 20260714024000 | 20260714024000_secure_admin_collection_payment_rpcs.sql |
| 20260714025000 | 20260714025000_secure_admin_collection_protest_rpc.sql |
| 20260714030000 | 20260714030000_secure_admin_collection_agreement_rpcs.sql |
| 20260714031000 | 20260714031000_secure_admin_collection_delete_rpc.sql |
| 20260714032000 | 20260714032000_secure_admin_client_balance_rpc.sql |
| 20260714033000 | 20260714033000_secure_admin_client_status_rpc.sql |
| 20260714034000 | 20260714034000_secure_admin_client_profile_rpcs.sql |
| 20260714035000 | 20260714035000_secure_admin_create_client_rpc.sql |
| 20260714040000 | 20260714040000_secure_admin_credit_limit_rpcs.sql |
| 20260714041000 | 20260714041000_secure_admin_credit_request_rpcs.sql |
| 20260714042000 | 20260714042000_secure_admin_credit_settlement_offer_rpc.sql |
| 20260714043000 | 20260714043000_secure_admin_loan_flow_rpcs.sql |
| 20260714044000 | 20260714044000_secure_admin_invoice_manual_rpcs.sql |
| 20260714045000 | 20260714045000_secure_admin_store_exchange_rpc.sql |
| 20260714050000 | 20260714050000_secure_admin_provider_withdrawal_rpc.sql |
| 20260714051000 | 20260714051000_secure_atomic_login_sessions.sql |
| 20260714052000 | 20260714052000_secure_session_account_admin_config.sql |
| 20260714053000 | 20260714053000_supabase_auth_session_bridge.sql |
| 20260714053100 | 20260714053100_fix_auth_bridge_generated_identity_email.sql |
| 20260714053200 | 20260714053200_protect_system_settings_secrets.sql |
| 20260714054000 | 20260714054000_atomic_invoice_payment_and_points.sql |
| 20260714054100 | 20260714054100_normalize_service_order_paid_status.sql |
| 20260714054200 | 20260714054200_normalize_payment_points_type.sql |
| 20260714054300 | 20260714054300_align_payment_method_domain.sql |
| 20260714054400 | 20260714054400_invoice_payment_admin_notification.sql |
| 20260714054500 | 20260714054500_invoice_paid_client_notification.sql |
| 20260714055000 | 20260714055000_secure_public_onboarding_flows.sql |
| 20260714056000 | 20260714056000_atomic_session_store_checkout.sql |
| 20260714056100 | 20260714056100_secure_store_invoice_and_cancellation.sql |
| 20260714056200 | 20260714056200_secure_client_wallet_points_transfers.sql |
| 20260714056300 | 20260714056300_secure_remaining_client_financial_actions.sql |
| 20260714056400 | 20260714056400_secure_client_budget_settlement_and_exchange.sql |
| 20260714100000 | 20260714100000_client_pin_recovery.sql |
| 20260714101000 | 20260714101000_update_client_pin_rpc.sql |
| 20260714101500 | 20260714101500_recovery_login_and_update_pin.sql |
| 20260715155500 | 20260715155500_secure_admin_product_supplier_config.sql |
| 20260715170000 | 20260715170000_secure_admin_product_url_import.sql |
| 20260715180000 | 20260715180000_secure_admin_batch_product_import.sql |
| 20260715212051 | 20260715212051_universal_product_import.sql |
| 20260716000000 | 20260716000000_product_barcode_support.sql |
| 20260716000001 | 20260716000001_import_rpc_barcode_support.sql |
| 20260716180000 | 20260716180000_secure_client_pin_recovery.sql |
| 20260716183000 | 20260716183000_individual_product_discounts.sql |
| 20260716183010 | 20260716183010_update_checkout_function.sql |
| 20260716183500 | 20260716183500_product_discount_validity.sql |
| 20260716184000 | 20260716184000_product_discount_quantity_limit.sql |
| 20260716184100 | 20260716184100_checkout_discount_quota.sql |
| 20260717200000 | 20260717200000_hub_classificados_schema.sql |
| 20260717201000 | 20260717201000_hub_classificados_rpcs.sql |
| 20260717220000 | 20260717220000_gsa_viagens_schema.sql |
| 20260717221000 | 20260717221000_gsa_viagens_rpc.sql |
| 20260718120000 | 20260718120000_gsa_saude_complete.sql |
| 20260718121000 | 20260718121000_gsa_seguros_complete.sql |

## Exposicao anonima comprovada

| table_name | selectable | visible_rows | error |
| --- | --- | --- | --- |
| clientes | true | 2 |  |
| faturas | true | 87 |  |
| pagamentos | true | 4 |  |
| saques | true | 2 |  |
| transferencias | true | 3 |  |
| emprestimos | true | 1 |  |
| carteira_lancamentos | true | 4 |  |
| extrato_financeiro | true | 35 |  |
| pontos_movimentacoes | true | 19 |  |
| points_transactions | true | 22 |  |
| sistema_sessoes | true | 76 |  |
| notificacoes | true | 148 |  |
| cliente_documentos | true | 3 |  |

## Foreign keys sem indice

| table_name | constraint_name | columns |
| --- | --- | --- |
| assinaturas | assinaturas_categoria_id_fkey | categoria_id |
| cliente_notas_admin | cliente_notas_admin_cliente_id_fkey | cliente_id |
| cobranca_acordo_parcelas | cobranca_acordo_parcelas_cobranca_id_fkey | cobranca_id |
| cobranca_historico | cobranca_historico_cobranca_id_fkey | cobranca_id |
| cobrancas | cobrancas_cliente_id_fkey | cliente_id |
| cobrancas | cobrancas_fatura_id_fkey | fatura_id |
| cupons_loja | cupons_loja_cliente_id_fkey | cliente_id |
| cupons_loja | cupons_loja_produto_id_fkey | produto_id |
| demanda_comentarios | demanda_comentarios_demanda_id_fkey | demanda_id |
| emprestimo_comentarios | emprestimo_comentarios_emprestimo_id_fkey | emprestimo_id |
| emprestimo_documentos | emprestimo_documentos_cliente_id_fkey | cliente_id |
| emprestimo_documentos | emprestimo_documentos_emprestimo_id_fkey | emprestimo_id |
| emprestimo_documentos | emprestimo_documentos_orcamento_id_fkey | orcamento_id |
| emprestimo_historico | emprestimo_historico_emprestimo_id_fkey | emprestimo_id |
| emprestimo_historico | emprestimo_historico_orcamento_id_fkey | orcamento_id |
| emprestimo_parcelas | emprestimo_parcelas_cliente_id_fkey | cliente_id |
| emprestimo_parcelas | emprestimo_parcelas_emprestimo_id_fkey | emprestimo_id |
| emprestimo_parcelas | emprestimo_parcelas_fatura_id_fkey | fatura_id |
| emprestimo_parcelas | emprestimo_parcelas_quitacao_fatura_id_fkey | quitacao_fatura_id |
| emprestimos | emprestimos_cliente_id_fkey | cliente_id |
| emprestimos | emprestimos_orcamento_id_fkey | orcamento_id |
| faturas | faturas_emprestimo_id_fkey | emprestimo_id |
| faturas | faturas_loja_credito_solicitacao_id_fkey | loja_credito_solicitacao_id |
| faturas | faturas_orcamento_id_fkey | orcamento_id |
| faturas | faturas_quitacao_fatura_id_fkey | quitacao_fatura_id |
| gsa_voucher_resgates | gsa_voucher_resgates_cliente_id_fkey | cliente_id |
| loja_avaliacoes | loja_avaliacoes_cliente_id_fkey | cliente_id |
| loja_avaliacoes | loja_avaliacoes_produto_id_fkey | produto_id |
| loja_avisos_estoque | loja_avisos_estoque_cliente_id_fkey | cliente_id |
| loja_avisos_estoque | loja_avisos_estoque_produto_id_fkey | produto_id |
| loja_credito_documentos | loja_credito_documentos_solicitacao_id_fkey | solicitacao_id |
| loja_credito_movimentacoes | loja_credito_movimentacoes_cliente_id_fkey | cliente_id |
| loja_credito_movimentacoes | loja_credito_movimentacoes_fatura_id_fkey | fatura_id |
| loja_credito_movimentacoes | loja_credito_movimentacoes_solicitacao_id_fkey | solicitacao_id |
| loja_credito_solicitacoes | loja_credito_solicitacoes_cliente_id_fkey | cliente_id |
| loja_estoque_historico | loja_estoque_historico_produto_id_fkey | produto_id |
| loja_favoritos | loja_favoritos_cliente_id_fkey | cliente_id |
| loja_pedido_itens | loja_pedido_itens_assinatura_id_fkey | assinatura_id |
| loja_pedido_itens | loja_pedido_itens_produto_id_fkey | produto_id |
| loja_pedido_itens | loja_pedido_itens_promocao_id_fkey | promocao_id |
| loja_pedido_itens | loja_pedido_itens_servico_id_fkey | servico_id |
| loja_reembolsos | loja_reembolsos_cliente_id_fkey | cliente_id |
| loja_reembolsos | loja_reembolsos_colaborador_id_fkey | colaborador_id |
| loja_reembolsos | loja_reembolsos_ordem_assinatura_id_fkey | ordem_assinatura_id |
| loja_reembolsos | loja_reembolsos_ordem_compra_id_fkey | ordem_compra_id |
| loja_solicitacoes | loja_solicitacoes_cliente_id_fkey | cliente_id |
| loja_solicitacoes | loja_solicitacoes_novo_orcamento_id_fkey | novo_orcamento_id |
| loja_solicitacoes | loja_solicitacoes_orcamento_origem_id_fkey | orcamento_origem_id |
| loja_solicitacoes | loja_solicitacoes_produto_desejado_id_fkey | produto_desejado_id |
| notificacoes | notificacoes_colaborador_id_fkey | colaborador_id |
| orcamentos | fk_orcamentos_cupom_desconto | cupom_desconto_id |
| orcamentos | fk_orcamentos_cupom_entrega | cupom_entrega_id |
| ordens_servico | ordens_servico_servico_id_fkey | servico_id |
| os_suporte_mensagens | os_suporte_mensagens_os_id_fkey | os_id |
| prestador_demandas_historico | prestador_demandas_historico_colaborador_destino_id_fkey | colaborador_destino_id |
| prestador_demandas_historico | prestador_demandas_historico_colaborador_origem_id_fkey | colaborador_origem_id |
| prestador_demandas_historico | prestador_demandas_historico_demanda_id_fkey | demanda_id |
| prestador_demandas_historico | prestador_demandas_historico_prestador_destino_id_fkey | prestador_destino_id |
| prestador_demandas_historico | prestador_demandas_historico_prestador_origem_id_fkey | prestador_origem_id |
| prestador_historico | prestador_historico_prestador_id_fkey | prestador_id |
| produto_desconto_cota_movimentos | produto_desconto_cota_movimentos_orcamento_id_fkey | orcamento_id |
| produto_importacao_origem | produto_importacao_origem_produto_id_fkey | produto_id |
| produtos | produtos_categoria_id_fkey | categoria_id |
| promocoes_quantidade | promocoes_quantidade_categoria_gatilho_id_fkey | categoria_gatilho_id |
| promocoes_quantidade | promocoes_quantidade_nivel_minimo_id_fkey | nivel_minimo_id |
| promocoes_quantidade | promocoes_quantidade_produto_brinde_id_fkey | produto_brinde_id |
| promocoes_quantidade | promocoes_quantidade_produto_gatilho_id_fkey | produto_gatilho_id |
| promocoes_quantidade_ativadas | promocoes_quantidade_ativadas_promocao_quantidade_id_fkey | promocao_quantidade_id |
| promocoes_quantidade_uso | promocoes_quantidade_uso_cliente_id_fkey | cliente_id |
| promocoes_quantidade_uso | promocoes_quantidade_uso_orcamento_id_fkey | orcamento_id |
| promocoes_quantidade_uso | promocoes_quantidade_uso_promocao_id_fkey | promocao_id |
| saude_aceites | saude_aceites_cliente_id_fkey | cliente_id |
| saude_aceites | saude_aceites_cotacao_id_fkey | cotacao_id |
| saude_aceites | saude_aceites_proposta_id_fkey | proposta_id |
| saude_assessorias | saude_assessorias_cliente_id_fkey | cliente_id |
| saude_assessorias | saude_assessorias_contrato_id_fkey | contrato_id |
| saude_assessorias | saude_assessorias_cotacao_id_fkey | cotacao_id |
| saude_atendimento_mensagens | saude_atendimento_mensagens_atendimento_id_fkey | atendimento_id |
| saude_atendimentos | saude_atendimentos_contrato_id_fkey | contrato_id |
| saude_atendimentos | saude_atendimentos_cotacao_id_fkey | cotacao_id |
| saude_comissao_eventos | saude_comissao_eventos_comissao_id_fkey | comissao_id |
| saude_comissoes | saude_comissoes_cliente_id_fkey | cliente_id |
| saude_comissoes | saude_comissoes_contrato_id_fkey | contrato_id |
| saude_comissoes | saude_comissoes_parceiro_id_fkey | parceiro_id |
| saude_comissoes | saude_comissoes_proposta_id_fkey | proposta_id |
| saude_contratos | saude_contratos_aceite_id_fkey | aceite_id |
| saude_contratos | saude_contratos_cotacao_id_fkey | cotacao_id |
| saude_contratos | saude_contratos_produto_id_fkey | produto_id |
| saude_cotacao_beneficiarios | saude_cotacao_beneficiarios_cotacao_id_fkey | cotacao_id |
| saude_dependentes | saude_dependentes_cliente_id_fkey | cliente_id |
| saude_dependentes | saude_dependentes_contrato_id_fkey | contrato_id |
| saude_documentos | saude_documentos_contrato_id_fkey | contrato_id |
| saude_documentos | saude_documentos_cotacao_id_fkey | cotacao_id |
| saude_produto_redes | saude_produto_redes_produto_id_fkey | produto_id |
| saude_produtos | saude_produtos_parceiro_id_fkey | parceiro_id |
| saude_propostas | saude_propostas_produto_id_fkey | produto_id |
| servicos | servicos_categoria_id_fkey | categoria_id |
| ticket_mensagens | ticket_mensagens_admin_id_fkey | admin_id |
| ticket_mensagens | ticket_mensagens_prestador_id_fkey | prestador_id |

## Orfaos

_Nenhum item._

## Integridade de dados

| check | ok | count | error |
| --- | --- | --- | --- |
| duplicate_client_cpf | true | 0 |  |
| duplicate_client_cnpj | true | 0 |  |
| duplicate_provider_document | true | 0 |  |
| negative_client_wallet | true | 0 |  |
| invalid_invoices | true | 0 |  |
| invalid_payments | true | 0 |  |
| invalid_withdrawals | true | 0 |  |
| invalid_transfers | true | 0 |  |
| duplicate_withdrawal_request | true | 0 |  |
| duplicate_transfer_request | true | 0 |  |
| duplicate_checkout_request | true | 0 |  |
| stale_active_sessions | true | 0 |  |

## SECURITY DEFINER sem search_path fixo

| schema_name | function_name | arguments | anon_execute | authenticated_execute | function_config |
| --- | --- | --- | --- | --- | --- |
| public | admin_aceitar_contraproposta_demanda | p_admin_code text, p_demanda_id uuid, p_colaborador_id uuid, p_colaborador_nome text | true | true |  |
| public | admin_delete_cobranca | p_admin_code text, p_cobranca_id uuid | true | true |  |
| public | admin_finalizar_demanda_segura | p_admin_code text, p_colaborador_id uuid, p_colaborador_nome text, p_demanda_id uuid, p_gerar_fatura boolean, p_gerar_fiscal boolean, p_link_resultado text | true | true |  |
| public | admin_finalizar_demanda_v2 | p_admin_code text, p_colaborador_id text, p_colaborador_nome text, p_demanda_id text, p_gerar_fatura boolean, p_gerar_fiscal boolean, p_link_resultado text | true | true |  |
| public | admin_processar_saque | p_admin_code text, p_saque_id uuid, p_acao text, p_motivo text, p_data_pagamento date, p_colaborador_id uuid, p_colaborador_nome text | true | true |  |
| public | admin_processar_saque_prestador | p_admin_code text, p_saque_id uuid, p_acao text, p_colaborador_id text, p_colaborador_nome text, p_motivo text, p_data_pagamento timestamp with time zone | true | true |  |
| public | admin_processar_transferencia | p_admin_code text, p_transferencia_id uuid, p_acao text, p_motivo text, p_data_pagamento date, p_colaborador_id uuid, p_colaborador_nome text | true | true |  |
| public | baixar_fatura_administrativa_segura | p_admin_code text, p_fatura_id uuid, p_metodo text, p_valor numeric, p_data_pagamento timestamp with time zone, p_observacoes text, p_colaborador_id uuid, p_colaborador_nome text | true | true |  |
| public | baixar_fatura_administrativa_segura | p_fatura_id uuid, p_metodo text, p_valor numeric, p_data_pagamento timestamp with time zone, p_observacoes text, p_colaborador_id uuid, p_colaborador_nome text | true | true |  |
| public | check_file_references | p_file_url text | true | true |  |
| public | check_must_change_admin_code |  | true | true |  |
| public | delete_client_cascade | p_cliente_id uuid | true | true |  |
| public | fn_auto_expire_promocoes |  | true | true |  |
| public | fn_baixar_parcela_emprestimo |  | true | true |  |
| public | get_admin_counts |  | true | true |  |
| public | get_admin_system_status |  | true | true |  |
| public | get_auth_users_details |  | true | true |  |
| public | get_client_counts | p_cliente_id uuid | true | true |  |
| public | get_client_pendency_counts | p_cliente_id uuid | true | true |  |
| public | get_database_details |  | true | true |  |
| public | get_provider_pendency_counts | p_prestador_id uuid | true | true |  |
| public | get_storage_details |  | true | true |  |
| public | get_system_metrics |  | true | true |  |
| public | gsa_admin_import_products_batch_v2 | p_sessao_id uuid, p_session_token text, p_items jsonb | false | true |  |
| public | gsa_generate_unique_product_code |  | true | true |  |
| public | request_withdrawal_seguro | p_prestador_id uuid, p_valor numeric, p_metodo_chave text, p_metodo_tipo text, p_taxa numeric | true | true |  |
| public | resgatar_voucher_seguro | p_voucher_id uuid, p_prestador_id uuid, p_valor numeric | true | true |  |
| public | solicitar_saque_seguro | p_cliente_id uuid, p_tipo_chave_pix text, p_chave_pix text | true | true |  |
| public | update_admin_setting | p_code text, p_key text, p_value text | true | true |  |

## Buckets

| id | public | file_size_limit | allowed_mime_types |
| --- | --- | --- | --- |
| documentos_cliente | true | 10485760 | image/jpeg,image/png,image/jpg,application/pdf |
| documentos_prestador | true |  |  |
| emprestimos | true |  |  |
| entregas_demandas | true |  |  |
| fiscal_docs | true | 20971520 |  |
| gsa-product-import-files | false | 52428800 | application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,text/tab-separated-values,image/jpeg,image/png,image/webp |
| gsa-store-images | true |  |  |
| gsa-store-returns | true |  |  |
| orcamentos | true |  |  |

## Cron jobs

| jobid | schedule | command | active |
| --- | --- | --- | --- |
| 1 | 0 0 * * * |      select net.http_post(         url := 'https://ocgajvagxagutfvgxwsy.supabase.co/functions/v1/generate-recurring-invoices',         headers := '{"Content-Type": "application/json", "Authorization": "Bearer [REDACTED]"}'::jsonb,         body := '{}'::jsonb     )      | true |
| 3 | 0 0 1 * * |       BEGIN;     DELETE FROM public.sistema_logs WHERE created_at < date_trunc('month', current_date);     DELETE FROM public.sistema_sessoes WHERE criado_em < date_trunc('month', current_date);     COMMIT;  | true |
| 4 | 0 * * * * | SELECT public.fn_cleanup_notifications() | true |