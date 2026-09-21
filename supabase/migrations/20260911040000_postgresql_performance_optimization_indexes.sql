-- ====================================================================================
-- Migration: 20260911040000_postgresql_performance_optimization_indexes.sql
-- Description: Comprehensive PostgreSQL Performance Optimization Indexes
-- Modules: Tickets, Faturas, Saques, Pontos, Carteira, Extrato, Vouchers, Cupons,
--          Ordens (Compra e Assinatura), Prestadores, Afiliados, Crédito e FKs.
-- ====================================================================================

-- 1. TICKETS & TICKET MENSAGENS (SUPPORT WORKFLOW)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_status ON public.tickets (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_data_abertura ON public.tickets (cliente_id, data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_data_abertura ON public.tickets (data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_modulo ON public.tickets (modulo);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_ticket_data ON public.ticket_mensagens (ticket_id, data_envio ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_autor_id ON public.ticket_mensagens (autor_id);
CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_data_envio ON public.ticket_mensagens (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_nao_lidas ON public.ticket_mensagens (ticket_id, lida) WHERE lida = false;

-- 2. SAQUES & PRESTADOR SAQUES (WITHDRAWALS & PIX PAYOUTS)
CREATE INDEX IF NOT EXISTS idx_saques_status ON public.saques (status);
CREATE INDEX IF NOT EXISTS idx_saques_cliente_status ON public.saques (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_saques_cliente_data_solicitacao ON public.saques (cliente_id, data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_saques_data_solicitacao ON public.saques (data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_saques_created_at ON public.saques (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saques_fila_pendente ON public.saques (status, data_solicitacao) WHERE status IN ('pendente', 'solicitado');

CREATE INDEX IF NOT EXISTS idx_prestador_saques_status ON public.prestador_saques (status);
CREATE INDEX IF NOT EXISTS idx_prestador_saques_prestador_status ON public.prestador_saques (prestador_id, status);
CREATE INDEX IF NOT EXISTS idx_prestador_saques_prestador_created ON public.prestador_saques (prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestador_saques_created_at ON public.prestador_saques (created_at DESC);

-- 3. FATURAS & COBRANCAS (FINANCIAL INVOICES & COLLECTIONS)
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas (status);
CREATE INDEX IF NOT EXISTS idx_faturas_tipo ON public.faturas (tipo);
CREATE INDEX IF NOT EXISTS idx_faturas_status_vencimento ON public.faturas (status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_data_vencimento ON public.faturas (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_data_pagamento ON public.faturas (data_pagamento);
CREATE INDEX IF NOT EXISTS idx_faturas_created_at ON public.faturas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_status ON public.faturas (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_emprestimo_id ON public.faturas (emprestimo_id) WHERE emprestimo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_faturas_loja_credito_solicitacao_id ON public.faturas (loja_credito_solicitacao_id) WHERE loja_credito_solicitacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobrancas_fatura_id ON public.cobrancas (fatura_id) WHERE fatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.cobrancas (status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente_status ON public.cobrancas (cliente_id, status);

-- 4. PONTOS MOVIMENTACOES (LOYALTY & GAMIFICATION)
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_cliente_data ON public.pontos_movimentacoes (cliente_id, data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_tipo ON public.pontos_movimentacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_data ON public.pontos_movimentacoes (data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_cliente_tipo ON public.pontos_movimentacoes (cliente_id, tipo);

-- 5. EXTRATO FINANCEIRO & CARTEIRA LANCAMENTOS (LEDGER & STATEMENTS)
CREATE INDEX IF NOT EXISTS idx_extrato_financeiro_cliente_data ON public.extrato_financeiro (cliente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_extrato_financeiro_referencia ON public.extrato_financeiro (referencia_id, modulo_referencia) WHERE referencia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_extrato_financeiro_tipo ON public.extrato_financeiro (tipo);
CREATE INDEX IF NOT EXISTS idx_extrato_financeiro_data ON public.extrato_financeiro (data DESC);

CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_cliente_data ON public.carteira_lancamentos (cliente_id, data_lancamento DESC);
CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_tipo ON public.carteira_lancamentos (tipo);
CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_data ON public.carteira_lancamentos (data_lancamento DESC);

-- 6. VOUCHERS & RESGATES (VOUCHERS AND REDEMPTIONS)
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers (status);
CREATE INDEX IF NOT EXISTS idx_vouchers_validade ON public.vouchers (validade);
CREATE INDEX IF NOT EXISTS idx_vouchers_cliente_status ON public.vouchers (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_categoria ON public.vouchers (categoria);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON public.vouchers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_voucher_id ON public.gsa_voucher_resgates (voucher_id);
CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_cliente_id ON public.gsa_voucher_resgates (cliente_id);
CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_created_at ON public.gsa_voucher_resgates (created_at DESC);

-- 7. CUPONS LOJA (MARKETPLACE STORE COUPONS)
CREATE INDEX IF NOT EXISTS idx_cupons_loja_status ON public.cupons_loja (status);
CREATE INDEX IF NOT EXISTS idx_cupons_loja_categoria ON public.cupons_loja (categoria_cupom);
CREATE INDEX IF NOT EXISTS idx_cupons_loja_status_cat ON public.cupons_loja (status, categoria_cupom);
CREATE INDEX IF NOT EXISTS idx_cupons_loja_validade ON public.cupons_loja (data_validade);
CREATE INDEX IF NOT EXISTS idx_cupons_loja_cliente_id ON public.cupons_loja (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cupons_loja_produto_id ON public.cupons_loja (produto_id) WHERE produto_id IS NOT NULL;

-- 8. ORDENS ASSINATURA & ORDENS COMPRA (ORDERS & CONTRACTS)
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_status ON public.ordens_assinatura (status);
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_cliente_status ON public.ordens_assinatura (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_cliente_data ON public.ordens_assinatura (cliente_id, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_data_criacao ON public.ordens_assinatura (data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_renovacao_cron ON public.ordens_assinatura (data_vencimento) WHERE renovacao_automatica = true AND status = 'aprovado';

CREATE INDEX IF NOT EXISTS idx_ordens_compra_status ON public.ordens_compra (status);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_cliente_status ON public.ordens_compra (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_cliente_data ON public.ordens_compra (cliente_id, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_data_criacao ON public.ordens_compra (data_criacao DESC);

-- 9. PRESTADOR FATURAS (SERVICE PROVIDER INVOICES)
CREATE INDEX IF NOT EXISTS idx_prestador_faturas_status ON public.prestador_faturas (status);
CREATE INDEX IF NOT EXISTS idx_prestador_faturas_prestador_status ON public.prestador_faturas (prestador_id, status);
CREATE INDEX IF NOT EXISTS idx_prestador_faturas_data_vencimento ON public.prestador_faturas (data_vencimento);

-- 10. GSA AFILIADO SAQUES (AFFILIATE WITHDRAWALS)
CREATE INDEX IF NOT EXISTS idx_gsa_afiliado_saques_afiliado_id ON public.gsa_afiliado_saques (afiliado_id);
CREATE INDEX IF NOT EXISTS idx_gsa_afiliado_saques_afiliado_data ON public.gsa_afiliado_saques (afiliado_id, solicitado_em DESC);

-- 11. LOJA CREDITO SAQUES (CREDIT LIMIT WITHDRAWALS)
CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_cliente_id ON public.loja_credito_saques (cliente_id);
CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_fatura_id ON public.loja_credito_saques (fatura_id) WHERE fatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_movimentacao_id ON public.loja_credito_saques (movimentacao_id) WHERE movimentacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_cliente_data ON public.loja_credito_saques (cliente_id, created_at DESC);

-- 12. PARCEIROS RESGATES & EVENTOS (PARTNER REDEMPTIONS & APPEALS)
CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_status ON public.parceiros_resgates (status);
CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_codigo_gerado ON public.parceiros_resgates (codigo_gerado);
CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_eventos_recurso_id ON public.parceiros_resgates_eventos (recurso_id) WHERE recurso_id IS NOT NULL;

-- 13. PRODUTOS & PRODUTO VARIANTES (MARKETPLACE CATALOG & SKUS)
CREATE INDEX IF NOT EXISTS idx_produto_variantes_sku ON public.produto_variantes (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_variantes_codigo_barras ON public.produto_variantes (codigo_barras) WHERE codigo_barras IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_status_created ON public.produtos (status, created_at DESC);

-- 14. ORCAMENTOS (BUDGETS, CARTS & CHECKOUT VALIDATIONS)
CREATE INDEX IF NOT EXISTS idx_orcamentos_cupom_desconto_id ON public.orcamentos (cupom_desconto_id) WHERE cupom_desconto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orcamentos_cupom_entrega_id ON public.orcamentos (cupom_entrega_id) WHERE cupom_entrega_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_status_data ON public.orcamentos (cliente_id, status, data_criacao DESC);

-- ====================================================================================
-- RELOAD POSTGREST SCHEMA CACHE
-- ====================================================================================
NOTIFY pgrst, 'reload schema';
