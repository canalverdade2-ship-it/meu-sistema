# Auditoria Profunda de RLS - Sistema GSA

Gerado em: 2026-07-19T03:13:00.740Z

## Conclusao

As policies abertas procedem. Fechar tudo em uma migration unica quebraria o sistema porque a aplicacao usa anon key, sessao propria em localStorage/sistema_sessoes e muitas escritas diretas em tabelas protegidas.

## Numeros

- Policies abertas confirmadas: 92
- Tabelas afetadas: 79
- Tabelas afetadas com RLS ligado: 79
- Tabelas afetadas com escrita direta detectada no codigo: 60
- Por gravidade: {"critica":25,"alta":24,"media":28,"baixa":2}
- Por area: {"identidade_acesso":10,"financeiro":13,"documentos_fiscal":6,"operacional":7,"comunicacao_historico":13,"outro":14,"catalogo_config":16}

## Tabelas Criticas e Altas

| severity | table | sensitivity | commands | open_policy_count | direct_write_count | code_refs | rls_enabled | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| critica | clientes | identidade_acesso | ALL | 1 | 4 | 76 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | faturas | financeiro | ALL | 1 | 4 | 56 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | loja_credito_movimentacoes | financeiro | ALL | 1 | 3 | 5 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | colaboradores | identidade_acesso | ALL | 1 | 2 | 12 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | admin_notificacoes | identidade_acesso | ALL | 1 | 1 | 3 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | carteira_lancamentos | financeiro | ALL | 1 | 1 | 3 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | cliente_documentos | documentos_fiscal | DELETE,INSERT,UPDATE,SELECT | 4 | 1 | 7 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | cliente_notas_admin | documentos_fiscal | ALL | 1 | 1 | 4 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | colaborador_modulos | identidade_acesso | ALL | 1 | 1 | 2 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | emprestimos | financeiro | ALL | 1 | 1 | 13 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | extrato_financeiro | financeiro | ALL | 1 | 1 | 9 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | funcoes | identidade_acesso | ALL | 1 | 1 | 3 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | loja_credito_solicitacoes | financeiro | ALL | 1 | 1 | 8 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | notificacoes | identidade_acesso | ALL,INSERT | 2 | 1 | 18 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | ordens_fiscais | documentos_fiscal | ALL | 1 | 1 | 12 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | os_notas | documentos_fiscal | ALL | 1 | 1 | 14 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | pagamentos | financeiro | ALL | 1 | 1 | 4 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | points_transactions | financeiro | ALL | 1 | 1 | 7 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | pontos_movimentacoes | financeiro | ALL | 1 | 1 | 10 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | prestador_documentos | documentos_fiscal | ALL | 1 | 1 | 8 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | prestadores | identidade_acesso | ALL | 1 | 1 | 23 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | solicitacoes_exclusao | identidade_acesso | ALL | 1 | 1 | 7 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| critica | cobrancas | financeiro | ALL | 1 | 0 | 5 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| critica | emprestimo_documentos | documentos_fiscal | ALL | 1 | 0 | 6 | true | Aplicar policies por dono/admin e paths de Storage por ator; upload via RPC/edge quando houver aprovacao. |
| critica | loja_credito_documentos | financeiro | ALL | 1 | 0 | 2 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| alta | sistema_logs | identidade_acesso | SELECT | 1 | 7 | 10 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| alta | ordens_assinatura | operacional | ALL | 1 | 4 | 24 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | ordens_servico | operacional | ALL | 1 | 3 | 24 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | ticket_mensagens | comunicacao_historico | ALL | 1 | 3 | 8 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | loja_solicitacoes | operacional | ALL,SELECT | 2 | 2 | 10 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | orcamentos | operacional | ALL | 1 | 2 | 49 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | ordens_compra | operacional | ALL | 1 | 2 | 21 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | prestador_historico | comunicacao_historico | ALL | 1 | 2 | 2 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | emprestimo_historico | comunicacao_historico | ALL | 1 | 1 | 8 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | loja_estoque_historico | comunicacao_historico | ALL | 1 | 1 | 2 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | loja_reembolsos | operacional | ALL | 1 | 1 | 7 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | prestador_demandas_historico | comunicacao_historico | ALL | 2 | 1 | 5 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | prestador_suporte_demandas | comunicacao_historico | ALL | 1 | 1 | 3 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | suporte_mensagens | comunicacao_historico | INSERT,SELECT | 2 | 1 | 2 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | tickets | comunicacao_historico | ALL | 1 | 1 | 21 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | cobranca_historico | comunicacao_historico | ALL | 1 | 0 | 0 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | demanda_comentarios | comunicacao_historico | ALL | 1 | 0 | 2 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | emprestimo_comentarios | comunicacao_historico | ALL | 1 | 0 | 9 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | orcamento_timeline | comunicacao_historico | INSERT,SELECT,UPDATE | 3 | 0 | 0 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | os_suporte_mensagens | comunicacao_historico | ALL | 1 | 0 | 5 | true | Permitir INSERT limitado ao participante e SELECT apenas para participantes/admin; historico deve ser append-only. |
| alta | promocoes_quantidade_uso | operacional | ALL | 1 | 0 | 2 | true | Migrar mudancas de status/aprovacao/cancelamento para RPCs; SELECT limitado por cliente/prestador/admin. |
| alta | saques | financeiro | SELECT | 1 | 0 | 7 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |
| alta | sistema_sessoes | identidade_acesso | SELECT | 1 | 0 | 1 | true | Criar helpers de sessao/role no banco e policies por ator; sessoes e logs nao devem ser public true. |
| alta | transferencias | financeiro | SELECT | 1 | 0 | 7 | true | Fechar acesso direto e expor fluxo por RPC transacional SECURITY DEFINER com validacao de sessao/ator. |

## Todas as Tabelas Afetadas

| severity | table | sensitivity | commands | open_policy_count | direct_write_count | code_refs | rls_enabled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| critica | clientes | identidade_acesso | ALL | 1 | 4 | 76 | true |
| critica | faturas | financeiro | ALL | 1 | 4 | 56 | true |
| critica | loja_credito_movimentacoes | financeiro | ALL | 1 | 3 | 5 | true |
| critica | colaboradores | identidade_acesso | ALL | 1 | 2 | 12 | true |
| critica | admin_notificacoes | identidade_acesso | ALL | 1 | 1 | 3 | true |
| critica | carteira_lancamentos | financeiro | ALL | 1 | 1 | 3 | true |
| critica | cliente_documentos | documentos_fiscal | DELETE,INSERT,UPDATE,SELECT | 4 | 1 | 7 | true |
| critica | cliente_notas_admin | documentos_fiscal | ALL | 1 | 1 | 4 | true |
| critica | colaborador_modulos | identidade_acesso | ALL | 1 | 1 | 2 | true |
| critica | emprestimos | financeiro | ALL | 1 | 1 | 13 | true |
| critica | extrato_financeiro | financeiro | ALL | 1 | 1 | 9 | true |
| critica | funcoes | identidade_acesso | ALL | 1 | 1 | 3 | true |
| critica | loja_credito_solicitacoes | financeiro | ALL | 1 | 1 | 8 | true |
| critica | notificacoes | identidade_acesso | ALL,INSERT | 2 | 1 | 18 | true |
| critica | ordens_fiscais | documentos_fiscal | ALL | 1 | 1 | 12 | true |
| critica | os_notas | documentos_fiscal | ALL | 1 | 1 | 14 | true |
| critica | pagamentos | financeiro | ALL | 1 | 1 | 4 | true |
| critica | points_transactions | financeiro | ALL | 1 | 1 | 7 | true |
| critica | pontos_movimentacoes | financeiro | ALL | 1 | 1 | 10 | true |
| critica | prestador_documentos | documentos_fiscal | ALL | 1 | 1 | 8 | true |
| critica | prestadores | identidade_acesso | ALL | 1 | 1 | 23 | true |
| critica | solicitacoes_exclusao | identidade_acesso | ALL | 1 | 1 | 7 | true |
| critica | cobrancas | financeiro | ALL | 1 | 0 | 5 | true |
| critica | emprestimo_documentos | documentos_fiscal | ALL | 1 | 0 | 6 | true |
| critica | loja_credito_documentos | financeiro | ALL | 1 | 0 | 2 | true |
| alta | sistema_logs | identidade_acesso | SELECT | 1 | 7 | 10 | true |
| alta | ordens_assinatura | operacional | ALL | 1 | 4 | 24 | true |
| alta | ordens_servico | operacional | ALL | 1 | 3 | 24 | true |
| alta | ticket_mensagens | comunicacao_historico | ALL | 1 | 3 | 8 | true |
| alta | loja_solicitacoes | operacional | ALL,SELECT | 2 | 2 | 10 | true |
| alta | orcamentos | operacional | ALL | 1 | 2 | 49 | true |
| alta | ordens_compra | operacional | ALL | 1 | 2 | 21 | true |
| alta | prestador_historico | comunicacao_historico | ALL | 1 | 2 | 2 | true |
| alta | emprestimo_historico | comunicacao_historico | ALL | 1 | 1 | 8 | true |
| alta | loja_estoque_historico | comunicacao_historico | ALL | 1 | 1 | 2 | true |
| alta | loja_reembolsos | operacional | ALL | 1 | 1 | 7 | true |
| alta | prestador_demandas_historico | comunicacao_historico | ALL | 2 | 1 | 5 | true |
| alta | prestador_suporte_demandas | comunicacao_historico | ALL | 1 | 1 | 3 | true |
| alta | suporte_mensagens | comunicacao_historico | INSERT,SELECT | 2 | 1 | 2 | true |
| alta | tickets | comunicacao_historico | ALL | 1 | 1 | 21 | true |
| alta | cobranca_historico | comunicacao_historico | ALL | 1 | 0 | 0 | true |
| alta | demanda_comentarios | comunicacao_historico | ALL | 1 | 0 | 2 | true |
| alta | emprestimo_comentarios | comunicacao_historico | ALL | 1 | 0 | 9 | true |
| alta | orcamento_timeline | comunicacao_historico | INSERT,SELECT,UPDATE | 3 | 0 | 0 | true |
| alta | os_suporte_mensagens | comunicacao_historico | ALL | 1 | 0 | 5 | true |
| alta | promocoes_quantidade_uso | operacional | ALL | 1 | 0 | 2 | true |
| alta | saques | financeiro | SELECT | 1 | 0 | 7 | true |
| alta | sistema_sessoes | identidade_acesso | SELECT | 1 | 0 | 1 | true |
| alta | transferencias | financeiro | SELECT | 1 | 0 | 7 | true |
| media | prestador_transacoes | outro | ALL | 1 | 6 | 9 | true |
| media | prestador_demandas | outro | ALL | 1 | 5 | 52 | true |
| media | cliente_promocoes | catalogo_config | ALL | 1 | 3 | 13 | true |
| media | client_levels | catalogo_config | ALL | 1 | 2 | 10 | true |
| media | empresa | catalogo_config | ALL | 1 | 2 | 14 | true |
| media | indicacoes | outro | ALL | 1 | 2 | 19 | true |
| media | assinaturas | catalogo_config | ALL | 1 | 1 | 18 | true |
| media | cupons_loja | catalogo_config | ALL,SELECT | 2 | 1 | 15 | true |
| media | fatura_contestacoes | outro | ALL | 1 | 1 | 3 | true |
| media | formas_pagamento | catalogo_config | ALL | 1 | 1 | 4 | true |
| media | level_history | outro | ALL | 1 | 1 | 3 | true |
| media | loja_categorias | catalogo_config | ALL | 1 | 1 | 10 | true |
| media | prestador_agendamentos | outro | ALL | 1 | 1 | 5 | true |
| media | prestador_premios | outro | ALL | 1 | 1 | 5 | true |
| media | prestador_promocoes | catalogo_config | ALL | 1 | 1 | 6 | true |
| media | prestador_promocoes_ativacoes | catalogo_config | ALL | 1 | 1 | 3 | true |
| media | prestador_saques | outro | ALL | 1 | 1 | 7 | true |
| media | prestador_vouchers | catalogo_config | ALL | 2 | 1 | 6 | true |
| media | produtos | catalogo_config | ALL | 1 | 1 | 27 | true |
| media | promocoes | catalogo_config | ALL | 1 | 1 | 11 | true |
| media | promocoes_quantidade | catalogo_config | ALL | 1 | 1 | 10 | true |
| media | servicos | catalogo_config | ALL | 1 | 1 | 13 | true |
| media | vouchers | catalogo_config | ALL | 1 | 1 | 11 | true |
| media | cupons_ativados | catalogo_config | DELETE,INSERT,SELECT | 3 | 0 | 4 | true |
| media | debug_admin_rpc | outro | ALL | 1 | 0 | 0 | true |
| media | emprestimo_parcelas | outro | ALL | 1 | 0 | 8 | true |
| media | emprestimo_templates_contrato | outro | ALL | 1 | 0 | 0 | true |
| media | prestador_faturas | outro | ALL | 1 | 0 | 1 | true |
| baixa | loja_avaliacoes | outro | SELECT | 1 | 0 | 2 | true |
| baixa | saude_configuracoes | outro | SELECT | 1 | 0 | 0 | true |

## Estrategia Segura

1. Nao remover todas as policies abertas de uma vez.
2. Primeiro criar camada de compatibilidade: helpers de sessao/role, RPCs transacionais e views publicas somente leitura para catalogo.
3. Migrar modulos financeiros e operacionais para RPCs antes de fechar INSERT/UPDATE/DELETE.
4. Fechar RLS por grupo de tabelas, sempre com smoke test de cliente/admin/prestador.
5. So depois remover policies `Acesso total`/`Public Full Access` remanescentes.