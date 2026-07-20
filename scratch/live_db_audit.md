# Live DB Audit

Generated at: 2026-07-19T03:12:10.658Z
Status: ok
Connection source: SUPABASE_DB_URL

## Counts
- tables: 162
- columns: 1940
- constraints: 1337
- indexes: 393
- policies: 184
- rls: 159
- functions: 356
- triggers: 53
- views: 3
- buckets: 9
- publications: 77
- extensions: 7

## Findings
| severity | code | count | message |
| --- | --- | --- | --- |
| critical | OPEN_RLS_POLICIES | 92 | Policies with public/anon role and true expressions were found in the live database. |
| critical | CODE_REFERENCES_MISSING_TABLES | 13 | Frontend/backend code references tables that are not present in the live public schema. |
| critical | CODE_REFERENCES_MISSING_RPCS | 3 | Frontend/backend code calls RPC functions that are not present in the live public schema. |

## Code references missing in live DB
### Tables
- ${domain}_cotacoes
- ${domain}_parceiros
- ${domain}_propostas
- classificados_anuncios
- classificados_comissoes_config
- classificados_mensagens
- classificados_propostas
- classificados_transacoes
- gsa-store-images
- viagens_orcamentos
- viagens_pacotes
- viagens_propostas
- viagens_transacoes
### RPCs
- execute_sql
- rpc_criar_anuncio_classificado
- rpc_moderar_mensagem_classificado
### Buckets
_None._

## Open policy evidence
| schemaname | tablename | policyname | roles | cmd | qual | with_check |
| --- | --- | --- | --- | --- | --- | --- |
| public | admin_notificacoes | Enable all access for all users | {public} | ALL | true | true |
| public | assinaturas | Acesso total | {public} | ALL | true |  |
| public | carteira_lancamentos | Acesso total | {public} | ALL | true | true |
| public | client_levels | Acesso total | {public} | ALL | true | true |
| public | cliente_documentos | Admin pode deletar documentos | {public} | DELETE | true |  |
| public | cliente_documentos | Admin pode inserir documentos | {public} | INSERT |  | true |
| public | cliente_documentos | Clientes podem atualizar seus próprios documentos | {public} | UPDATE | true |  |
| public | cliente_documentos | Clientes podem ver seus próprios documentos | {public} | SELECT | true |  |
| public | cliente_notas_admin | Public Full Access | {public} | ALL | true | true |
| public | cliente_promocoes | Acesso total | {public} | ALL | true | true |
| public | clientes | Acesso total | {public} | ALL | true |  |
| public | cobranca_historico | Public Full Access | {public} | ALL | true | true |
| public | cobrancas | Public Full Access | {public} | ALL | true | true |
| public | colaborador_modulos | Acesso total | {public} | ALL | true | true |
| public | colaboradores | Acesso total | {public} | ALL | true | true |
| public | cupons_ativados | cliente_delete_cupons_ativados | {public} | DELETE | true |  |
| public | cupons_ativados | cliente_insert_cupons_ativados | {public} | INSERT |  | true |
| public | cupons_ativados | cliente_select_cupons_ativados | {public} | SELECT | true |  |
| public | cupons_loja | Acesso total para cupons | {public} | ALL | true | true |
| public | cupons_loja | Cupons visíveis para todos | {public} | SELECT | true |  |
| public | debug_admin_rpc | Allow all access | {public} | ALL | true | true |
| public | demanda_comentarios | Public Full Access | {public} | ALL | true | true |
| public | empresa | Acesso total | {public} | ALL | true | true |
| public | emprestimo_comentarios | emprestimo_comentarios_all | {public} | ALL | true | true |
| public | emprestimo_documentos | emprestimo_documentos_all | {public} | ALL | true | true |
| public | emprestimo_historico | emprestimo_historico_all | {public} | ALL | true | true |
| public | emprestimo_parcelas | emprestimo_parcelas_all | {public} | ALL | true | true |
| public | emprestimo_templates_contrato | emprestimo_templates_contrato_all | {public} | ALL | true | true |
| public | emprestimos | emprestimos_all | {public} | ALL | true | true |
| public | extrato_financeiro | Acesso total | {public} | ALL | true | true |
| public | fatura_contestacoes | service_role_all | {public} | ALL | true | true |
| public | faturas | Acesso total | {public} | ALL | true | true |
| public | formas_pagamento | Acesso total | {public} | ALL | true | true |
| public | funcoes | Acesso total | {public} | ALL | true | true |
| public | indicacoes | Acesso total | {public} | ALL | true | true |
| public | level_history | Acesso total | {public} | ALL | true | true |
| public | loja_avaliacoes | Avaliacoes visiveis para todos | {public} | SELECT | true |  |
| public | loja_categorias | Public Full Access | {public} | ALL | true | true |
| public | loja_credito_documentos | Public Full Access loja_credito_documentos | {public} | ALL | true | true |
| public | loja_credito_movimentacoes | Public Full Access loja_credito_movimentacoes | {public} | ALL | true | true |
| public | loja_credito_solicitacoes | Public Full Access loja_credito_solicitacoes | {public} | ALL | true | true |
| public | loja_estoque_historico | Acesso total para histórico de estoque | {public} | ALL | true | true |
| public | loja_reembolsos | Acesso total para public | {public} | ALL | true | true |
| public | loja_solicitacoes | Acesso total loja_solicitacoes | {public} | ALL | true | true |
| public | loja_solicitacoes | Clientes veem suas proprias solicitacoes | {public} | SELECT | true |  |
| public | notificacoes | Acesso total | {public} | ALL | true | true |
| public | notificacoes | Permitir inserção de notificações por usuários anonimos | {anon} | INSERT |  | true |
| public | orcamento_timeline | orcamento_timeline_insert_public | {anon,authenticated} | INSERT |  | true |
| public | orcamento_timeline | orcamento_timeline_select_public | {anon,authenticated} | SELECT | true |  |
| public | orcamento_timeline | orcamento_timeline_update_public | {anon,authenticated} | UPDATE | true | true |
| public | orcamentos | Acesso total | {public} | ALL | true | true |
| public | ordens_assinatura | Acesso total | {public} | ALL | true | true |
| public | ordens_compra | Acesso total | {public} | ALL | true | true |
| public | ordens_fiscais | Allow all access for authenticated users | {public} | ALL | true | true |
| public | ordens_servico | Acesso total | {public} | ALL | true | true |
| public | os_notas | Acesso total | {public} | ALL | true | true |
| public | os_suporte_mensagens | Acesso total | {public} | ALL | true | true |
| public | pagamentos | Acesso total | {public} | ALL | true | true |
| public | points_transactions | Acesso total | {public} | ALL | true | true |
| public | pontos_movimentacoes | Acesso total | {public} | ALL | true | true |
| public | prestador_agendamentos | Acesso total | {public} | ALL | true | true |
| public | prestador_demandas | Acesso total | {public} | ALL | true | true |
| public | prestador_demandas_historico | Allow all access | {public} | ALL | true | true |
| public | prestador_demandas_historico | Permitir tudo | {public} | ALL | true | true |
| public | prestador_documentos | Acesso total | {public} | ALL | true | true |
| public | prestador_faturas | Acesso total | {public} | ALL | true | true |
| public | prestador_historico | Acesso total prestador_historico | {public} | ALL | true | true |
| public | prestador_premios | Allow all for authenticated users premios | {public} | ALL | true |  |
| public | prestador_promocoes | Allow all for authenticated users promocoes | {public} | ALL | true |  |
| public | prestador_promocoes_ativacoes | Public Access Ativacoes | {public} | ALL | true | true |
| public | prestador_saques | Acesso total | {public} | ALL | true | true |
| public | prestador_suporte_demandas | Acesso total | {public} | ALL | true | true |
| public | prestador_transacoes | Acesso total | {public} | ALL | true | true |
| public | prestador_vouchers | Allow all for authenticated users | {public} | ALL | true |  |
| public | prestador_vouchers | Allow all for authenticated users vouchers | {public} | ALL | true |  |
| public | prestadores | Acesso total | {public} | ALL | true | true |
| public | produtos | Acesso total | {public} | ALL | true | true |
| public | promocoes | Acesso total | {public} | ALL | true | true |
| public | promocoes_quantidade | Public Full Access | {public} | ALL | true | true |
| public | promocoes_quantidade_uso | Public Full Access | {public} | ALL | true | true |
| public | saques | saques_select_public_temp | {public} | SELECT | true |  |
| public | saude_configuracoes | saude_config_public_select | {anon,authenticated} | SELECT | true |  |
| public | servicos | Acesso total | {public} | ALL | true | true |
| public | sistema_logs | sistema_logs_select_public_temp | {public} | SELECT | true |  |
| public | sistema_sessoes | Permitir leitura publica sessoes | {public} | SELECT | true |  |
| public | solicitacoes_exclusao | Acesso total | {public} | ALL | true | true |
| public | suporte_mensagens | Enable insert for all users | {public} | INSERT |  | true |
| public | suporte_mensagens | Enable read access for all users | {public} | SELECT | true |  |
| public | ticket_mensagens | Acesso total | {public} | ALL | true | true |
| public | tickets | Acesso total | {public} | ALL | true | true |
| public | transferencias | transferencias_select_public_temp | {public} | SELECT | true |  |
| public | vouchers | Acesso total | {public} | ALL | true | true |