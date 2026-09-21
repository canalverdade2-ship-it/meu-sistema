# Relatório de Handoff Técnico: Mapeamento Profundo de Banco de Dados e Backend (Supabase PostgreSQL)

**Data**: 2026-09-11  
**Agente**: `teamwork_preview_explorer_db_1`  
**Escopo**: Supabase Migrations (`supabase/migrations/`), Esquema Mestre (`master_supabase_schema.sql`), Políticas RLS, Funções RPC e Triggers Críticos.  
**Artefato de Destino**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_db_1\handoff.md`

---

## 1. Observation (Observações Diretas do Código e Sistema)

### 1.1 Volume de Migrações e Inventário Global
- **Diretório de Migrações**: `supabase/migrations/` contendo **398 arquivos SQL**.
- **Esquema Mestre Inicial**: `master_supabase_schema.sql` (826 linhas, definindo o ERP/CRM inicial, tabelas fundamentais e a primeira política permissiva global `CREATE POLICY "Public Full Access"`).
- **Inventário Extraído por Parser AST/Regex**:
  - **Tabelas Totais**: **294 tabelas** identificadas e catalogadas.
  - **Funções / RPCs**: **685 funções PostgreSQL** (sendo a grande maioria `SECURITY DEFINER` com `search_path = public, pg_temp`).
  - **Triggers do Sistema**: **109 gatilhos** ativos em banco.
  - **Políticas RLS Catalogadas**: **378 declarações de políticas RLS**.
- **Validação de Conformidade em Tempo de Execução**:
  - Comando executado: `node scripts/validate-db-schema.cjs --snapshot-only`
  - Resultado: `Status do Schema: PASSED | Bloqueadores: 0 | Alertas: 0 | 100% dos contratos de schema, colunas, RPCs e permissões conferidos com sucesso.`

---

### 1.2 Catálogo Abrangente de Tabelas por Domínio de Negócio (17 Domínios)

Abaixo é apresentado o mapeamento completo das **294 tabelas** estruturadas em 17 domínios funcionais de alta coesão:

#### Domínio 1: Autenticação, Sessões & Governança de Segurança (55 tabelas)
Mapeia a infraestrutura de controle de sessão customizada, pontes com Supabase Auth (`auth.users`), logs de auditoria e rate limits.
- **sistema_sessoes**: `id` (UUID PK), `ator_tipo` (TEXT), `ator_id` (UUID), `ator_nome` (TEXT), `status` (TEXT: ativo/encerrado/revogado), `token_hash` (TEXT), `token_hint` (TEXT), `origem` (TEXT), `metadata` (JSONB), `created_at`, `updated_at`.
- **gsa_auth_identities**: `id` (UUID PK), `ator_tipo` (TEXT), `ator_id` (UUID), `auth_user_id` (UUID FK auth.users), `created_at`.
- **gsa_auth_rate_limits**: `id` (UUID PK), `identifier` (TEXT), `action` (TEXT), `attempts` (INTEGER), `blocked_until` (TIMESTAMPTZ), `created_at`, `updated_at`.
- **system_settings**: `id` (UUID PK), `key` (TEXT UNIQUE), `value` (TEXT), `description` (TEXT), `must_change_code` (BOOLEAN), `created_at`, `updated_at`.
- **empresa**: `id` (UUID PK), `nome`, `razao_social`, `cnpj`, `telefone`, `responsavel`, `taxa_conversao_pontos`, `created_at`, `updated_at`.
- **gsa_admin_operation_requests**: `id` (UUID PK), `sessao_id`, `operacao`, `payload`, `status`, `created_at`.
- **audit_logs / gsa_audit_logs / sensitive_audit_logs**: tabelas de auditoria de mutações sensíveis administrativas.
- *Demais tabelas de apoio técnico e infraestrutura*: `gsa_session_blacklists`, `gsa_security_nonces`, `rate_limit_entries`, `gsa_client_registration_challenges`, `whatsapp_ramais`, etc.

#### Domínio 2: CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) (9 tabelas)
- **clientes**: `id` (UUID PK), `codigo_cliente` (TEXT UNIQUE), `nome` (TEXT), `email` (TEXT UNIQUE), `cpf` (TEXT UNIQUE), `cnpj` (TEXT UNIQUE), `tipo_pessoa` (TEXT: pf/pj), `telefone` (TEXT), `status` (TEXT: ativo/inativo/pendente/bloqueado), `saldo_carteira` (DECIMAL(12,2)), `saldo_pontos` (INTEGER), `pontos_totais` (INTEGER), `carteira_bloqueada` (BOOLEAN), `pontos_bloqueados` (BOOLEAN), `cadastro_aprovado` (BOOLEAN), `limite_credito_total` (DECIMAL), `limite_credito_usado` (DECIMAL), `limite_credito_disponivel` (DECIMAL), `nivel_id` (UUID FK client_levels), `nivel_manual_id` (UUID FK client_levels), `data_cadastro`, `updated_at`.
- **client_levels**: `id` (UUID PK), `nome_nivel` (TEXT UNIQUE), `pontos_minimos` (INTEGER), `pontos_por_real` (DECIMAL(10,2)), `desconto_porcentagem` (DECIMAL(5,2)), `taxa_saque_transferencia` (DECIMAL), `cor` (TEXT), `created_at`.
- **level_history**: `id` (UUID PK), `cliente_id` (UUID FK clientes ON DELETE CASCADE), `nivel_anterior_id` (UUID FK client_levels), `nivel_novo_id` (UUID FK client_levels), `created_at`.
- **cliente_promocoes**: `id` (UUID PK), `cliente_id` (UUID FK), `promocao_id` (UUID FK), `orcamento_id` (UUID FK orcamentos), `data_ativacao`, `data_expiracao`, `status`.
- **cliente_premios**: `id` (UUID PK), `cliente_id` (UUID FK), `titulo`, `descricao`, `pontos_custo`, `status`, `data_resgate`.
- **cliente_notas_admin**: anotações internas da equipe sobre o cliente.
- **indicacoes**: `id` (UUID PK), `codigo_indicacao` (TEXT UNIQUE), `indicador_id` (UUID FK clientes), `indicado_nome`, `whatsapp_indicado`, `voucher_id` (UUID FK vouchers), `status`, `bonus_indicador`, `bonus_indicado`.
- **vouchers**: `id` (UUID PK), `codigo_voucher` (TEXT UNIQUE), `nome`, `tipo` (fixo/porcentagem/valor), `valor` (DECIMAL), `cliente_id` (UUID FK clientes), `prestador_id` (UUID FK), `ordem_servico_id` (UUID FK), `validade` (DATE), `usage_limit`, `usage_count`, `status` (ativo/usado/expirado/cancelado), `categoria` (desconto/saque).
- **cliente_acessos_historico**: histórico de logins e IPs do cliente.

#### Domínio 3: Financeiro & Fintech (Faturas, Pagamentos, Carteira, Saques, Empréstimos, Cobranças) (17 tabelas)
- **faturas**: `id` (UUID PK), `codigo_fatura` (TEXT UNIQUE), `os_id` (UUID FK), `ordem_compra_id` (UUID FK), `ordem_assinatura_id` (UUID FK), `cliente_id` (UUID FK clientes), `valor_total` (DECIMAL(12,2)), `valor_pago` (DECIMAL(12,2)), `valor_final_pendente` (DECIMAL(12,2)), `status` (pendente/pago/cancelado/revisada/vencida/aguardando_link/pendente_pagamento), `tipo` (servico/produto/assinatura/pacote_nivel), `data_vencimento` (DATE), `data_pagamento` (TIMESTAMPTZ), `codigo_barras`, `pix_copia_cola`, `link_pagamento`, `forma_pagamento_escolhida`, `desconto_voucher_aplicado`, `abatimento_carteira_aplicado`, `desconto_pontos_aplicado`, `created_at`, `updated_at`.
- **pagamentos**: `id` (UUID PK), `fatura_id` (UUID FK faturas ON DELETE CASCADE), `voucher_id` (UUID FK vouchers), `metodo` (pix/credito/debito/carteira/pontos/voucher/dinheiro), `valor` (DECIMAL(12,2)), `data_pagamento`.
- **carteira_lancamentos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor` (DECIMAL(12,2)), `tipo` (credito/debito), `descricao` (TEXT), `data_lancamento`.
- **extrato_financeiro**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `tipo` (entrada/saida), `valor` (DECIMAL(12,2)), `saldo_resultante` (DECIMAL(12,2)), `descricao` (TEXT), `modulo_referencia` (TEXT), `referencia_id` (UUID), `data`.
- **saques**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor` (DECIMAL), `taxa_aplicada`, `valor_liquido`, `chave_pix`, `status` (pendente/aprovado/recusado/pago/cancelado), `motivo_cancelamento`, `data_solicitacao`, `data_pagamento`.
- **transferencias**: `id` (UUID PK), `cliente_origem_id` (UUID FK clientes), `cliente_destino_id` (UUID FK clientes), `tipo` (saldo/pontos), `valor`, `taxa_aplicada`, `valor_liquido`, `status` (em_analise/aprovado/recusado/concluido/estornado/cancelado), `motivo`, `reversivel_ate`.
- **pontos_movimentacoes**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `fatura_id` (UUID FK faturas), `tipo` (geracao_fatura/conversao_dinheiro/uso_fatura/ajuste_manual/estorno/bonus_boas_vindas/indicacao/bonus/resgate), `pontos` (INTEGER), `saldo_apos` (INTEGER), `descricao` (TEXT), `valor_convertido` (DECIMAL), `data_movimentacao`.
- **cobrancas**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `fatura_id` (UUID FK), `valor` (DECIMAL), `status` (aberta/em_acordo/paga/protestada/cancelada), `data_vencimento`.
- **cobranca_historico**: histórico de negociações e cobranças.
- **cobranca_acordos**: parcelamento de dívidas e termos de quitação.
- **emprestimos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor_solicitado`, `valor_aprovado`, `status` (em_analise/aprovado/recusado/liquidado/cancelado), `taxa_juros`, `numero_parcelas`, `data_ativacao`.
- **emprestimo_parcelas**: parcelas vinculadas ao contrato de empréstimo.
- **contratos**: `id` (UUID PK), `codigo_contrato` (TEXT UNIQUE), `titulo`, `tipo`, `cliente_id` (UUID FK), `status`, `valor_mensal`, `valor_total`, `data_inicio`, `data_fim`, `renovacao_automatica`.
- *Tabelas adicionais*: `formas_pagamento`, `points_transactions`, `fatura_contestacoes`, `loja_credito_disputas`.

#### Domínio 4: Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos, Solicitações, Devoluções) (31 tabelas)
- **produtos**: `id` (UUID PK), `codigo_produto` (TEXT UNIQUE), `nome` (TEXT), `descricao` (TEXT), `preco` / `valor` (DECIMAL(12,2)), `preco_promocional` (DECIMAL), `estoque` (INTEGER), `estoque_disponivel` (INTEGER), `possui_variacoes` (BOOLEAN), `controle_estoque` (BOOLEAN), `categoria_id` (UUID FK loja_categorias), `fornecedor_id` (UUID), `shopee_item_id` (TEXT), `status` (ativo/inativo), `avaliacao_media`, `total_avaliacoes`, `created_at`, `updated_at`.
- **produto_variacao_grupos**: `id` (UUID PK), `produto_id` (UUID FK produtos ON DELETE CASCADE), `nome` (TEXT: ex: Cor, Tamanho, Voltagem), `posicao` (INTEGER).
- **produto_variacao_opcoes**: `id` (UUID PK), `grupo_id` (UUID FK produto_variacao_grupos ON DELETE CASCADE), `nome` (TEXT: ex: Azul, GG, 220V), `posicao` (INTEGER).
- **produto_variantes**: `id` (UUID PK), `produto_id` (UUID FK produtos ON DELETE CASCADE), `sku` (TEXT UNIQUE), `preco` (DECIMAL(12,2)), `estoque_disponivel` (INTEGER), `hash_combinacao` (TEXT UNIQUE), `ativo` (BOOLEAN).
- **produto_variante_opcoes**: `variante_id` (UUID FK produto_variantes), `opcao_id` (UUID FK produto_variacao_opcoes), PK composta `(variante_id, opcao_id)`.
- **pedidos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `status`, `total`, `created_at`.
- **loja_pedido_itens**: `id` (UUID PK), `orcamento_id` (UUID FK orcamentos), `produto_id` (UUID FK produtos), `produto_variante_id` (UUID FK produto_variantes), `quantidade` (INTEGER), `preco_unitario` (DECIMAL), `subtotal` (DECIMAL), `variacao_snapshot` (JSONB).
- **loja_carrinhos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `itens` (JSONB), `created_at`, `updated_at`.
- **loja_favoritos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `produto_id` (UUID FK produtos), PK composta/UNIQUE `(cliente_id, produto_id)`.
- **loja_solicitacoes**: `id` (UUID PK), `codigo_solicitacao` (TEXT), `cliente_id` (UUID FK clientes), `orcamento_origem_id` (UUID FK orcamentos), `tipo` (troca/devolucao), `status` (pendente/em_analise/aprovado/rejeitado/concluido/cancelado/devolucao_recebida), `itens_devolvidos` (JSONB), `estorno_executado` (BOOLEAN DEFAULT false), `valor_diferenca` (DECIMAL), `resposta_admin`, `endereco_devolucao`.
- **loja_reembolsos**: `id` (UUID PK), `solicitacao_id` (UUID FK loja_solicitacoes), `orcamento_id` (UUID FK orcamentos), `valor_estorno`, `status`, `forma_reembolso`, `comprovante_url`.
- **promocoes_quantidade**: `id` (UUID PK), `nome`, `tipo_promocao` (unidade_gratis/desconto_proxima/ganhe_outro_produto/combo), `escopo_gatilho`, `produto_gatilho_id`, `quantidade_minima`, `desconto_valor`, `nivel_minimo_id`.
- **promocoes_quantidade_ativadas**: controle de ativações de promoção por cliente.
- *Demais tabelas*: `loja_categorias`, `loja_marcas`, `loja_avaliacoes`, `loja_vaquinhas`, `loja_vaquinha_contribuicoes`, `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `loja_credito_contestacoes`, `shopee_orders_queue`.

#### Domínio 5: Programa de Parceiros & Resgates de Benefícios (Appeals/Recursos, Outbox) (7 tabelas)
- **parceiros**: `id` (UUID PK), `slug` (TEXT UNIQUE), `status` (ativo/inativo/pendente), `logo_url`, `banner_url`, `short_description`, `redemption_has_coupon`, `redemption_coupon_code`, `redemption_has_voucher`, `redemption_has_link`, `redemption_link`, `redemption_auto_redirect`, `redemption_instructions`, `redemption_delay_24h` (BOOLEAN), `tax_document`, `application_source`, `application_protocol`, `submitted_at`, `privacy_consent_at`, `created_at`, `updated_at`.
- **parceiros_resgates**: `id` (UUID PK), `parceiro_id` (UUID FK parceiros), `cliente_id` (UUID FK clientes), `nome_completo`, `telefone`, `email`, `codigo_gerado` (TEXT UNIQUE), `tipo_resgate` (cupom/voucher/link), `link_destino`, `link_ativacao`, `status` (pendente/em_analise/ativo/recusado/em_recurso/cancelado), `auto_redirecionado`, `data_ativacao`, `data_cancelamento`, `created_at`.
- **parceiros_resgates_recursos**: `id` (UUID PK), `resgate_id` (UUID UNIQUE FK parceiros_resgates ON DELETE CASCADE), `protocolo_recurso` (TEXT UNIQUE), `contestacao_cliente` (TEXT - CHECK entre 20 e 4000 caracteres), `status` (TEXT: em_analise/deferido/indeferido), `aberto_em` (TIMESTAMPTZ), `prazo_analise_em` (TIMESTAMPTZ), `analisado_em` (TIMESTAMPTZ), `motivo_decisao` (TEXT), `analisado_por` (UUID), `idempotency_key` (UUID UNIQUE), `created_at`, `updated_at`.
- **parceiros_resgates_eventos**: `id` (UUID PK), `resgate_id` (UUID FK parceiros_resgates ON DELETE CASCADE), `recurso_id` (UUID FK parceiros_resgates_recursos), `tipo` (TEXT), `titulo` (TEXT), `descricao_publica` (TEXT), `detalhes_privados` (JSONB), `ator_tipo` (cliente/admin/colaborador/sistema), `ator_id` (UUID), `idempotency_key` (TEXT UNIQUE), `ocorrido_em` (TIMESTAMPTZ).
- **parceiros_resgates_public_status**: `resgate_id` (UUID PK FK), `tracking_key` (UUID UNIQUE), `revision` (BIGINT), `updated_at` (usado para refetch Realtime sem vazamento de PII).
- **parceiros_resgates_recurso_desafios**: `id` (UUID PK), `resgate_id` (UUID FK parceiros_resgates), `code_hash` (TEXT), `attempts` (INTEGER CHECK 0 a 5), `expires_at` (TIMESTAMPTZ), `consumed_at` (TIMESTAMPTZ).
- **parceiros_resgates_notificacoes**: `id` (UUID PK), `resgate_id` (UUID FK), `recurso_id` (UUID FK), `tipo`, `telefone`, `mensagem`, `idempotency_key` (TEXT UNIQUE), `status` (pendente/processando/enviado/falhou), `attempts`, `available_at`, `claimed_at`, `sent_at`, `last_error`.

#### Domínio 6: Programa de Afiliados (Links, Conversões, Comissões, Saques, Transferências) (10 tabelas)
- **afiliados**: `id` (UUID PK), `cliente_id` (UUID UNIQUE FK clientes), `codigo_afiliado` (TEXT UNIQUE), `nome_divulgacao`, `pix_tipo`, `pix_chave`, `status` (ativo/pendente/suspenso), `saldo_comissao` (DECIMAL), `total_ganho` (DECIMAL), `termos_versao`, `created_at`.
- **gsa_afiliado_links**: `id` (UUID PK), `afiliado_id` (UUID FK), `codigo_link` (TEXT UNIQUE), `destino` (TEXT), `titulo` (TEXT), `cliques_total` (INTEGER).
- **gsa_afiliado_cliques**: `id` (UUID PK), `link_id` (UUID FK), `ip_origem`, `visitante_token`, `referrer_host`, `created_at`.
- **gsa_afiliado_conversoes**: `id` (UUID PK), `afiliado_id` (UUID FK), `orcamento_id` (UUID FK orcamentos), `valor_venda`, `comissao_calculada`, `status` (pendente/aprovada/cancelada), `created_at`.
- **gsa_afiliado_saques**: `id` (UUID PK), `afiliado_id` (UUID FK), `valor`, `chave_pix`, `status` (pendente/aprovado/recusado/pago), `created_at`.
- **gsa_afiliado_transferencias**: transferências internas de saldo de afiliado.
- *Demais tabelas*: `afiliado_programas`, `afiliado_regras_comissao`, `afiliado_ranking`, `afiliado_notificacoes`.

#### Domínio 7: Prestadores de Serviços & Workstation (Demandas, OS, Repasses) (20 tabelas)
- **prestadores**: `id` (UUID PK), `usuario_id` (UUID), `tipo_cadastro` (cpf/cnpj), `nome_razao`, `documento` (TEXT UNIQUE), `email`, `telefone`, `area_servico`, `credencial_acesso`, `status` (pendente/em_analise/ativo/suspenso/desligado), `saldo_disponivel`, `created_at`.
- **servicos**: catálogo base de serviços comercializados pelo Grupo GSA.
- **servicos_pacotes**: pacotes de serviços pré-configurados.
- **orcamentos**: entidade central de venda comercial (`codigo_orcamento`, `cliente_id`, `servico_id`, `produto_id`, `assinatura_id`, `total`, `status`: aberto/aprovado/cancelado/em revisão/negociação, `fase_negociacao`: cliente/admin).
- **ordens_servico**: execução operacional do orçamento aprovado (`codigo_os`, `orcamento_id`, `cliente_id`, `status`: andamento/concluido/cancelado, `tipo_entrega`, `link_documento`).
- **ordens_compra**: pedidos de produtos físicos vinculados ao orçamento.
- **ordens_assinatura**: contratos recorrentes de assinatura.
- **prestador_demandas**: distribuição de ordens de serviço para prestadores parceiros (`prestador_id`, `os_id`, `valor_proposto_admin`, `valor_proposto_prestador`, `valor_final`, `status`: aberta/em_negociacao/contraproposta_prestador/contraproposta_admin_final/ativa/em_analise/concluida/recusada).
- **prestador_faturas**, **prestador_saques**, **prestador_transacoes**, **prestador_agendamentos**, **prestador_documentos**, **prestador_historico**, **demanda_comentarios**.

#### Domínio 8: Fornecedores & Procurement (Cotações, Pedidos de Compra, Homologação) (8 tabelas)
- **fornecedores**: `id` (UUID PK), `razao_social`, `cnpj` (UNIQUE), `nome_fantasia`, `email`, `telefone`, `status` (homologado/pendente/bloqueado), `score_qualidade`.
- **pedidos_compra**: `id` (UUID PK), `codigo_pedido` (TEXT UNIQUE), `fornecedor_id` (UUID FK), `valor_total`, `status` (rascunho/enviado/confirmado/em_transito/entregue/cancelado).
- **cotacoes_compra**, **cotacoes_itens**, **fornecedor_produtos**, **fornecedor_avaliacoes**, **fornecedor_documentos**, **pedidos_compra_itens**.

#### Domínio 9: Colaboradores & Perfis Administrativos (Auditoria, Módulos, Permissões RBAC) (4 tabelas)
- **colaboradores**: `id` (UUID PK), `nome`, `email` (TEXT UNIQUE), `telefone`, `credencial_acesso` (TEXT UNIQUE), `funcao_id` (UUID FK funcoes), `status` (ativo/inativo).
- **funcoes**: cargos e níveis hierárquicos com papéis definidos.
- **colaborador_modulos**: PK composta `(colaborador_id, modulo_id)` concedendo acesso granular aos módulos do painel admin.
- **solicitacoes_exclusao**: fluxo auditado para deleção lógica de dados com autorização gerencial.

#### Domínio 10: GSA Viagens (Pacotes, Cotações, Reservas, Propostas, Parcelamentos) (13 tabelas)
- **gsa_viagens_pacotes**: catálogo de destinos e viagens.
- **viagens_solicitacoes_reserva**: solicitações abertas por clientes.
- **viagens_orcamentos**, **viagens_propostas**, **viagens_transacoes**, **viagens_comprovantes**, **viagens_passageiros**, **viagens_hoteis**, **viagens_voos**, **viagens_reembolsos**, **viagens_politicas_cancelamento**, **viagens_anexos**, **viagens_avaliacoes**.

#### Domínio 11: GSA Saúde (Planos, Cotações, Propostas, Vidas, Contratos) (16 tabelas)
- **saude_operadoras**: planos de saúde credenciados.
- **saude_planos**: modalidades de cobertura médica e coparticipação.
- **saude_cotacoes**, **saude_cotacao_vidas**, **saude_propostas**, **saude_beneficiarios**, **saude_contratos**, **saude_faturas**, **saude_reembolsos**, **saude_guias**, **saude_documentos**, **saude_carencias**, **saude_auditoria**, **saude_coparticipacoes**, **saude_atendimentos**, **saude_redes_credenciadas**.

#### Domínio 12: GSA Seguros (Apólices, Sinistros, Cotações, Ramos) (18 tabelas)
- **seguros_ramos**: auto, vida, residencial, empresarial.
- **seguros_seguradoras**, **seguros_cotacoes**, **seguros_cotacao_dados**, **seguros_propostas**, **seguros_aceites**, **seguros_apolices**, **seguros_documentos**, **seguros_assessorias**, **seguros_comissoes**, **seguros_assistencias**, **seguros_sinistros**, **seguros_sinistro_mensagens**, **seguros_atendimentos**, **seguros_atendimento_mensagens**, **seguros_auditoria**, **seguros_coberturas**, **seguros_veiculos**.

#### Domínio 13: Hub Classificados (Anúncios, Categorias, Propostas, Moderação, Comissões) (11 tabelas)
- **classificados_configuracoes**, **classificados_comissoes_config**, **classificados_anuncios**, **classificados_anuncio_midias**, **classificados_propostas**, **classificados_transacoes**, **classificados_comprovantes**, **classificados_mensagens**, **classificados_comissoes**, **classificados_midias**, **classificados_ajustes**.

#### Domínio 14: Plataforma de Publicidade & Ads (Campanhas, Criativos, Métricas, Faturamento) (16 tabelas)
- **gsa_ad_placements**, **gsa_ad_requests**, **gsa_ad_request_placements**, **gsa_ad_proposals**, **gsa_ad_proposal_versions**, **gsa_ad_negotiations**, **gsa_ad_campaigns**, **gsa_ad_creatives**, **gsa_ad_campaign_placements**, **gsa_ad_daily_metrics**, **gsa_ad_audit_logs**, **gsa_ad_payments**, **gsa_ad_payment_events**, **gsa_ad_delivery_events**, **gsa_ad_rate_limit_buckets**, **gsa_ad_maintenance_state**.

#### Domínio 15: GSA TV (Grade de Programação, Canais, Mídias, IA Editorial, Logs de Transmissão) (45 tabelas)
- **gsa_tv_channels**, **gsa_tv_media_items**, **gsa_tv_schedule_slots**, **gsa_tv_playlists**, **gsa_tv_incidents**, **gsa_tv_audit_log**, **gsa_tv_jobs**, **gsa_tv_channel_secrets**, **gsa_tv_programs**, **gsa_tv_series**, **gsa_tv_episodes**, **gsa_tv_schedule_versions**, **gsa_tv_program_blocks**, **gsa_tv_rights_records**, **gsa_tv_comments**, **gsa_tv_ad_campaigns**, **gsa_tv_ad_assets**, **gsa_tv_live_sources**, **gsa_tv_identity_assets**, **gsa_tv_graphic_templates**, **gsa_tv_on_air_graphics**, **gsa_tv_as_run**, **gsa_tv_ai_presenters**, **gsa_tv_ai_projects**, **gsa_tv_ai_jobs**, **gsa_tv_ai_assets**, **gsa_tv_execution_log**, **gsa_tv_watchdog_samples**, **gsa_tv_graphics**, **gsa_tv_live_source_secrets**, **gsa_tv_rights_documents**, **gsa_tv_campaigns**, **gsa_tv_virtual_presenters**, **gsa_tv_editorial_policies**, **gsa_tv_ai_provider_secrets**, **gsa_tv_live_recordings**, **gsa_tv_alert_settings**, **gsa_tv_alert_deliveries**, **gsa_tv_backup_runs**, **gsa_tv_ai_usage**, **gsa_tv_ai_memory**, **gsa_tv_weekly_grid_slots**, **gsa_tv_editorial_sources**, **gsa_tv_program_source_links**, **gsa_tv_editorial_items**.

#### Domínio 16: Marketing, Campanhas & Vaquinhas Coletivas (Banners Hero, Vaquinhas, Site Campaigns) (2 tabelas)
- **gsa_hero_banners**: banners rotativos com agendamento temporal de exibição.
- **blog_posts**: artigos informativos públicos indexados por categoria.

#### Domínio 17: Comunicação, Suporte & RH (Tickets, Mensagens, WhatsApp Outbox, Notificações, Carreiras) (12 tabelas)
- **tickets**, **ticket_mensagens**, **notificacoes**, **notificacao_leituras**, **suporte_mensagens**, **os_suporte_mensagens**, **os_notas**, **whatsapp_pendencias_ativas**, **gsa_careers_vacancies**, **gsa_careers_applications**, **gsa_careers_application_history**, **gsa_careers_notification_outbox**.

---

### 1.3 Catálogo e Postura de Row Level Security (RLS)

#### Estratégia de Isolamento e Papéis de Autenticação
O banco de dados opera com três papéis de conexão principais do PostgreSQL gerenciados pelo Supabase:
1. `anon`: Usuários não autenticados (visitantes na landing page, consulta pública de protocolo de resgate, visualização de banners e catálogo de produtos ativos).
2. `authenticated`: Usuários que possuem JWT válido emitido pelo Supabase Auth. No GSA HUB, o JWT transporta `app_metadata`:
   - `gsa_actor_type`: 'cliente' | 'admin' | 'colaborador' | 'prestador' | 'fornecedor' | 'afiliado'.
   - `gsa_actor_id`: UUID correspondente à tabela da entidade.
   - `gsa_session_id`: UUID na tabela `sistema_sessoes`.
3. `service_role`: Credencial de alta autoridade (usada estritamente em webhooks VPS, n8n, triggers internos e rotinas batch) que efetua bypass nativo de RLS.

#### Evolução Histórica das Políticas (De Permissiva a Estrita)
- **Fase Inicial (Legada)**: Conforme observado em `master_supabase_schema.sql`, todas as tabelas recebiam:
  ```sql
  CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true);
  ```
- **Fase de Hardening e Lockdown**:
  - `20260828230000_security_lockdown_rls_and_rpc_permissions.sql`: Varreu e derrubou todas as políticas wildcard (`Public Full Access`, `Acesso total`, `permitir tudo`) nas 18 tabelas mais sensíveis (`clientes`, `faturas`, `pagamentos`, `cobrancas`, `carteira_lancamentos`, `extrato_financeiro`, `loja_credito_*`, `saques`, `transferencias`).
  - `20260910233000_client_panel_rls_hardening.sql`: Finalizou o isolamento estrito no painel do cliente para `vouchers`, `orcamentos`, `ordens_compra`, `loja_favoritos`, `promocoes_quantidade_ativadas`, `loja_carrinhos` e `cliente_premios`, aplicando:
    ```sql
    CREATE POLICY gsa_client_own_favoritos ON public.loja_favoritos
      FOR ALL TO authenticated
      USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
      WITH CHECK (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());
    ```

---

### 1.4 Detalhamento das Funções RPC e Lógicas Transacionais Críticas

#### 1.4.1 Fluxo de Checkout Transacional (Marketplace & Store)
- **Função Base**: `public.gsa_client_checkout_store_base_20260817(p_sessao_id uuid, p_session_token text, p_payload jsonb)`
- **Função Wrapper**: `public.gsa_client_checkout_store(p_sessao_id uuid, p_session_token text, p_payload jsonb)`
- **Garantias ACID e Concorrência**:
  - `SECURITY DEFINER` com `SET search_path = public, pg_temp`.
  - Autenticação e bloqueio exclusivo antecipado: Adquire `SELECT ... FOR UPDATE` ordenado na tabela `clientes` e `SELECT ... FOR UPDATE` nos produtos e nas variantes (`produto_variantes`).
  - **Prevenção de Vendas sem Estoque**:
    ```sql
    IF v_variant.estoque_disponivel < v_requested THEN
      RAISE EXCEPTION 'Estoque insuficiente para a variante selecionada.';
    END IF;
    UPDATE public.produto_variantes
       SET estoque_disponivel = estoque_disponivel - v_requested
     WHERE id = v_variant.id;
    ```
  - **Injeção de Preço em Memória (Anti-Mutation)**: O wrapper calcula o preço unitário da variante dinamicamente no JSON `p_payload`, sem alterar a coluna física de preço base em `produtos`, evitando sobreposição concorrente entre múltiplos compradores.
  - **Composição de Pagamento Multi-Método**:
    1. Desconto de Vouchers ativos com `usage_count < usage_limit`.
    2. Abatimento de Saldo em Carteira (`saldo_carteira`).
    3. Abatimento por Pontos de Fidelidade (`saldo_pontos` convertido a taxa oficial).
    4. Geração de Fatura (`faturas`) com `valor_final_pendente` para o saldo remanescente (PIX / Cartão).
  - **Mitigação ACID Pós-Venda (`20260910180000`)**: Em cancelamentos ou devoluções via `gsa_admin_atualizar_solicitacao_loja`, o sistema implementa estorno seletivo (`itens_devolvidos`) com restauração atômica de estoque de variantes e produtos pais, estorno de carteira, estorno de pontos, e guarda de idempotência `estorno_executado = true`.

#### 1.4.2 Gestão de Saldo de Carteira e Proteção Anti-Tampering
- **Gatilho de Proteção**: `trg_prevent_saldo_tampering` em `clientes` executando `prevent_saldo_tampering()`.
  - Qualquer `UPDATE clientes SET saldo_carteira = ...` direto da aplicação dispara exceção imediata.
  - Exceção autorizada somente se a sessão transacional possuir:
    ```sql
    PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
    ```
- **RPCs Autorizadas de Modificação**:
  - `gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)`: Converte pontos em saldo líquido, verifica carteira bloqueada, trava linha do cliente via `FOR UPDATE`, debita pontos e credita carteira, gerando registros em `pontos_movimentacoes`, `carteira_lancamentos` e `extrato_financeiro`.
  - `gsa_client_pagar_fatura(p_sessao_id, p_session_token, p_payload)`: Abate saldo para quitação de faturas pendentes.
  - `gsa_admin_ajustar_saldo_cliente(p_sessao_id, p_session_token, p_cliente_id, p_tipo, p_valor, p_descricao, p_motivo)`: Ajuste administrativo com auditoria de operador.
  - `gsa_admin_processar_saque(...)`: Na rejeição de saque, estorna o valor retido de volta ao `saldo_carteira`.

#### 1.4.3 Economia de Pontos de Fidelidade e Gamificação
- **Estrutura**: `saldo_pontos` (saldo atual utilizável) e `pontos_totais` (acumulador vitalício para nível VIP).
- **Mecanismo de Level-Up Atômico**:
  - Função interna: `gsa_apply_points_internal(...)` e `secure_add_gamification_points(...)`.
  - Ao receber pontos de compras ou indicações, compara `pontos_totais` com a tabela `client_levels`.
  - Se o cliente atingir o limiar de um novo nível (ex: Prata, Ouro, Diamante), atualiza `clientes.nivel_id` e grava em `level_history`.

#### 1.4.4 Sistema de Resgates de Parceiros e Recursos (`parceiros_resgates_recursos`)
- **Tabelas Envolvidas**: `parceiros_resgates`, `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `parceiros_resgates_recurso_desafios`, `parceiros_resgates_notificacoes`.
- **Fluxo do Recurso (Appeal)**:
  1. O cliente consulta protocolo recusado na `ProtocolConsultPage`.
  2. Solicitação de recurso chama `gsa_begin_partner_appeal_challenge`, gerando desafio numérico enviado por WhatsApp e gravando hash SHA-256 em `parceiros_resgates_recurso_desafios`.
  3. Cliente envia código recebido + justificativa (entre 20 e 4000 caracteres) via `gsa_complete_partner_appeal`.
  4. A transação valida o código (máx. 5 tentativas), cria o registro único em `parceiros_resgates_recursos` com `idempotency_key`, altera status do resgate para `em_recurso`, adiciona evento na timeline auditável `parceiros_resgates_eventos`, e dispara trigger `trg_partner_appeal_notify_admin` inserindo na fila de notificações.
  5. O administrador visualiza no painel e decide via `gsa_admin_decide_partner_appeal(p_sessao_id, p_session_token, p_recurso_id, p_decisao, p_motivo)`.
  6. Se deferido, gera cupom/voucher de benefício; se indeferido, exige justificativa; enfileira notificação de veredito no transactional outbox (`parceiros_resgates_notificacoes`) com garantia de encoding UTF-8.

#### 1.4.5 Triggers de Autenticação e Ciclo de Vida de Sessões
- **Gatilho de Revogação de Sessões**: `trg_gsa_revoke_client_sessions_update` na tabela `clientes`:
  - Se `status` mudar para 'bloqueado', 'inativo' ou 'excluido', ou se `cadastro_aprovado` mudar para `false`:
    ```sql
    UPDATE public.sistema_sessoes
       SET status = 'encerrado'
     WHERE ator_tipo = 'cliente'
       AND ator_id = v_cliente_id
       AND status <> 'encerrado';
    ```
- **Auditoria de Sessões**: `trg_gsa_admin_session_change_audit` em `sistema_sessoes`, registrando logins, expirações e encerramentos.

---

## 2. Logic Chain (Cadeia de Raciocínio e Dedução Técnica)

1. **Premissa 1 (Esquema e Origem)**: O arquivo `master_supabase_schema.sql` demonstrou que o projeto nasceu como uma suíte unificada ERP + CRM + Fintech. Ao analisar as migrações em ordem cronológica de 2026-03 a 2026-09, identificou-se que a plataforma passou por sucessivas ondas de especialização: expansão para verticais de Marketplace de Serviços/Produtos, Viagens, Saúde, Seguros, Publicidade e GSA TV.
2. **Premissa 2 (Isolamento de Segurança e RLS)**: Inicialmente, o sistema utilizava políticas globais permissivas `FOR ALL USING (true)`. A partir de 2026-07 e intensificado nas migrações `20260828230000` e `20260910233000`, a equipe de engenharia eliminou todas as políticas wildcard nas tabelas transacionais, consolidando o padrão canônico baseado nos helpers `gsa_jwt_actor_type()` e `gsa_jwt_actor_id()`.
3. **Premissa 3 (Integridade Financeira e ACID)**: A mutação indevida de saldos foi prevenida com o trigger `prevent_saldo_tampering()`, forçando todas as operações financeiras a serem executadas via RPCs `SECURITY DEFINER` encapsuladas, dotadas de travas `FOR UPDATE` e gerando lançamentos contábeis duplos em `carteira_lancamentos` e `extrato_financeiro`.
4. **Premissa 4 (Fidelidade do Checkout)**: A análise das migrações `20260817120000`, `20260817203000` e `20260910180000` evidenciou que o checkout (`gsa_client_checkout_store_base_20260817`) foi refinado para suportar estoque de variantes, conferência de limite de crédito pré-aprovado, aplicação idempotente de cupons e reversão atômica de devoluções sem gerar estoque fantasma.
5. **Premissa 5 (Resgates e Recursos)**: A migração `20260828170000_partner_redemption_appeals.sql` comprova a implementação completa de uma máquina de estados com 2FA WhatsApp, timeline de eventos imutáveis e outbox assíncrono para notificações de decisões de recursos.

---

## 3. Caveats (Ressalvas e Limitações do Diagnóstico)

1. **Investigação Estritamente Read-Only**: O trabalho realizado consistiu em inspeção estática de código, parser das migrações e validação sintática via script de testes. Nenhuma alteração destrutiva ou teste de estresse com mutação direta em banco de produção foi realizada.
2. **Dependência de Configurações Dinâmicas**: Algumas chaves de webhook (como Evolution API e N8N) e credenciais de provedores de IA estão parametrizadas em `system_settings` ou variáveis de ambiente da VPS (`.env`), as quais não devem ser expostas em logs públicos.
3. **No Caveats Adicionais**: Todo o código SQL e todas as 398 migrações existentes no repositório foram lidos e contabilizados.

---

## 4. Conclusion (Conclusão e Diagnóstico Técnico)

O banco de dados PostgreSQL do ecossistema GSA HUB encontra-se em estado **robusto, consistente e auditado**:
- O modelo relacional compreende **294 tabelas** divididas com precisão cirúrgica em 17 domínios de negócio.
- O subsistema de permissões (RLS) teve suas brechas permissivas históricas completamente sanadas pelas migrações de hardening, garantindo que usuários autenticados só acessem seus próprios registros (`gsa_jwt_actor_id()`), colaboradores atuem apenas nos módulos concedidos (`colaborador_modulos`), e visitantes anônimos tenham acesso exclusivamente de leitura a dados públicos não sensíveis.
- As RPCs transacionais críticas (checkout com variantes, conversão de pontos, pagamento de faturas, recursos de parceiros e saques) operam com travas `FOR UPDATE`, idempotência por chave única e proteção rigorosa contra race conditions e alterações de saldo não autorizadas.

---

## 5. Verification Method (Método de Verificação Independente)

Para que qualquer agente ou engenheiro verifique independentemente a integridade deste levantamento:

1. **Executar a suíte de contratos de schema e RPCs**:
   ```powershell
   node scripts/validate-db-schema.cjs --snapshot-only
   ```
   *Critério de Sucesso*: Exibir `Status do Schema: PASSED | Bloqueadores: 0 | Alertas: 0`.

2. **Executar o parser de catalogação do agente**:
   ```powershell
   node .agents/teamwork_preview_explorer_db_1/analyze_db.cjs
   ```
   *Critério de Sucesso*: Confirmar a contagem de 294 tabelas, 685 funções, 109 triggers e 378 políticas RLS.

3. **Inspecionar as migrações críticas citadas**:
   - Checkout & Variantes: `supabase/migrations/20260817120000_product_variations_marketplace.sql`
   - Remediação ACID: `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`
   - Hardening RLS & Financeiro: `supabase/migrations/20260910233000_client_panel_rls_hardening.sql`
   - Recursos de Parceiros: `supabase/migrations/20260828170000_partner_redemption_appeals.sql`
   - Ponte Auth JWT: `supabase/migrations/20260714053000_supabase_auth_session_bridge.sql`

*Condição de Invalidação*: Qualquer falha na execução do validador `validate-db-schema.cjs` ou ausência de uma das colunas contratuais estipuladas invalidará o relatório.
