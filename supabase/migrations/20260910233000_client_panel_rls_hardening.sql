-- Migration: 20260910233000_client_panel_rls_hardening.sql
-- Description: Comprehensive database remediation for Client Panel RLS hardening,
--              financial RPC security, anti-tampering bypass, and double-spending prevention.
-- Author: Worker 2 (Database Remediation Worker)

BEGIN;

-- ============================================================================
-- 1. ROW LEVEL SECURITY (RLS) POLICIES REMEDIATION
-- ============================================================================

-- 1.1 Vouchers: Ensure clients can view their own vouchers in ClientVouchers.tsx
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;

DROP POLICY IF EXISTS gsa_client_own_vouchers_read ON public.vouchers;
CREATE POLICY gsa_client_own_vouchers_read
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 1.2 Orcamentos: Eliminate open public wildcard policy and enforce client ownership
DROP POLICY IF EXISTS marketplace_orders_read ON public.orcamentos;
DROP POLICY IF EXISTS gsa_client_own_orcamentos_hardened ON public.orcamentos;
CREATE POLICY gsa_client_own_orcamentos_hardened
  ON public.orcamentos
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 1.3 Ordens de Compra: Eliminate open public wildcard policy and enforce client ownership
DROP POLICY IF EXISTS marketplace_purchase_orders_read ON public.ordens_compra;
DROP POLICY IF EXISTS gsa_client_own_ordens_compra_hardened ON public.ordens_compra;
CREATE POLICY gsa_client_own_ordens_compra_hardened
  ON public.ordens_compra
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 1.4 Loja Favoritos: Drop wildcard policies and enforce strict self-ownership
ALTER TABLE public.loja_favoritos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loja_favoritos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_favoritos TO authenticated;
GRANT ALL ON public.loja_favoritos TO service_role;

DROP POLICY IF EXISTS "cliente_select_loja_favoritos" ON public.loja_favoritos;
DROP POLICY IF EXISTS "admin_all_loja_favoritos" ON public.loja_favoritos;
DROP POLICY IF EXISTS "Favoritos por cliente" ON public.loja_favoritos;
DROP POLICY IF EXISTS "loja_favoritos_select_all" ON public.loja_favoritos;
DROP POLICY IF EXISTS gsa_client_own_favoritos ON public.loja_favoritos;
CREATE POLICY gsa_client_own_favoritos
  ON public.loja_favoritos
  FOR ALL
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

DROP POLICY IF EXISTS gsa_management_favoritos ON public.loja_favoritos;
CREATE POLICY gsa_management_favoritos
  ON public.loja_favoritos
  FOR ALL
  TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

-- 1.5 Promocoes Quantidade Ativadas: Enable RLS and isolate to owner
ALTER TABLE public.promocoes_quantidade_ativadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promocoes_quantidade_ativadas FROM PUBLIC, anon;
GRANT SELECT ON public.promocoes_quantidade_ativadas TO authenticated;
GRANT ALL ON public.promocoes_quantidade_ativadas TO service_role;

DROP POLICY IF EXISTS gsa_client_own_qty_promo_activations ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_own_qty_promo_activations
  ON public.promocoes_quantidade_ativadas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

DROP POLICY IF EXISTS gsa_management_qty_promo_activations ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_management_qty_promo_activations
  ON public.promocoes_quantidade_ativadas
  FOR ALL
  TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

-- 1.6 Loja Carrinhos: Enable RLS and isolate to owner
ALTER TABLE public.loja_carrinhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loja_carrinhos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_carrinhos TO authenticated;
GRANT ALL ON public.loja_carrinhos TO service_role;

DROP POLICY IF EXISTS gsa_client_own_cart ON public.loja_carrinhos;
CREATE POLICY gsa_client_own_cart
  ON public.loja_carrinhos
  FOR ALL
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

DROP POLICY IF EXISTS gsa_management_cart ON public.loja_carrinhos;
CREATE POLICY gsa_management_cart
  ON public.loja_carrinhos
  FOR ALL
  TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

-- 1.7 Cliente Premios: Enable RLS and establish client SELECT policy
ALTER TABLE public.cliente_premios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cliente_premios FROM PUBLIC, anon;
GRANT SELECT ON public.cliente_premios TO authenticated;
GRANT ALL ON public.cliente_premios TO service_role;

DROP POLICY IF EXISTS gsa_client_own_premios_read ON public.cliente_premios;
CREATE POLICY gsa_client_own_premios_read
  ON public.cliente_premios
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

DROP POLICY IF EXISTS gsa_management_cliente_premios ON public.cliente_premios;
CREATE POLICY gsa_management_cliente_premios
  ON public.cliente_premios
  FOR ALL
  TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

-- 1.8 OS Notas & OS Suporte Mensagens: Allow clients to view communication for their service orders
DROP POLICY IF EXISTS gsa_client_own_os_notas ON public.os_notas;
CREATE POLICY gsa_client_own_os_notas
  ON public.os_notas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_id
        AND os.cliente_id = public.gsa_jwt_actor_id()
    )
  );

DROP POLICY IF EXISTS gsa_client_own_os_suporte_mensagens ON public.os_suporte_mensagens;
CREATE POLICY gsa_client_own_os_suporte_mensagens
  ON public.os_suporte_mensagens
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_id
        AND os.cliente_id = public.gsa_jwt_actor_id()
    )
  );


-- ============================================================================
-- 2. FINANCIAL RPCS REMEDIATION & SECURITY HARDENING
-- ============================================================================

-- 2.1 RPC gsa_converter_pontos_carteira:
-- Revoke anon grant, enforce caller authorization, and enable anti-tampering bypass.
CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
  p_cliente_id uuid,
  p_pontos integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client public.clientes%rowtype;
  v_pts integer;
  v_rate numeric := 0.01; -- 100 pontos = R$ 1,00
  v_valor numeric;
  v_novo_pontos integer;
  v_novo_carteira numeric;
BEGIN
  -- Authorize caller: authenticated caller must match p_cliente_id or be admin/colaborador/service_role
  IF auth.role() = 'authenticated' THEN
    IF NOT (
      (public.gsa_jwt_actor_type() = 'cliente' AND public.gsa_jwt_actor_id() = p_cliente_id)
      OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
      OR public.gsa_jwt_is_admin()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: caller não corresponde ao cliente');
    END IF;
  END IF;

  -- Bypass trigger prevent_saldo_tampering for legitimate conversion
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  -- Row-level exclusive lock prevents race conditions and concurrent modifications
  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF coalesce(v_client.pontos_bloqueados, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira de pontos bloqueada');
  END IF;

  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    v_pts := coalesce(v_client.saldo_pontos, 0);
  ELSE
    v_pts := p_pontos;
  END IF;

  IF v_pts <= 0 OR coalesce(v_client.saldo_pontos, 0) < v_pts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo de pontos insuficiente');
  END IF;

  -- Obter taxa de conversao cadastrada ou usar taxa padrao (0.01)
  SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100)
  INTO v_rate FROM public.empresa ORDER BY created_at LIMIT 1;
  v_rate := coalesce(v_rate, 0.01);

  v_valor := round(v_pts * v_rate, 2);
  v_novo_pontos := coalesce(v_client.saldo_pontos, 0) - v_pts;
  v_novo_carteira := round(coalesce(v_client.saldo_carteira, 0) + v_valor, 2);

  UPDATE public.clientes
  SET
    saldo_pontos = v_novo_pontos,
    saldo_carteira = v_novo_carteira,
    updated_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.pontos_movimentacoes (
    cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
  ) VALUES (
    p_cliente_id, 'conversao_dinheiro', -v_pts, v_novo_pontos,
    'Conversão de pontos em saldo via WhatsApp', v_valor
  );

  INSERT INTO public.carteira_lancamentos (
    cliente_id, valor, tipo, descricao
  ) VALUES (
    p_cliente_id, v_valor, 'credito',
    'Conversão de pontos via WhatsApp'
  );

  INSERT INTO public.extrato_financeiro (
    cliente_id, tipo, valor, descricao, modulo_referencia, saldo_resultante
  ) VALUES (
    p_cliente_id, 'entrada', v_valor, 'Conversão de pontos via WhatsApp', 'pontos', v_novo_carteira
  );

  RETURN jsonb_build_object(
    'success', true,
    'pontos_convertidos', v_pts,
    'valor_convertido', v_valor,
    'novo_saldo_pontos', v_novo_pontos,
    'novo_saldo_carteira', v_novo_carteira
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO authenticated, service_role;


-- 2.2 RPC gsa_admin_processar_saque:
-- Set my.app.bypass_saldo_check = 'on' to prevent prevent_saldo_tampering() from aborting rejections.
CREATE OR REPLACE FUNCTION public.gsa_admin_processar_saque(
  p_sessao_id uuid,
  p_session_token text,
  p_saque_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_saque saques%rowtype;
  v_cliente clientes%rowtype;
  v_novo_saldo numeric;
  v_acao text := lower(coalesce(p_acao, ''));
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_saque
  FROM public.saques
  WHERE id = p_saque_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque nao encontrado.';
  END IF;

  IF v_acao = 'aprovar' THEN
    IF v_saque.status = 'pago' THEN
      RETURN jsonb_build_object('success', true, 'status', 'pago', 'already_processed', true);
    END IF;
    IF v_saque.status <> 'pendente' THEN
      RAISE EXCEPTION 'Este saque ja foi processado. Status atual: %', v_saque.status;
    END IF;

    UPDATE public.saques
       SET status = 'pago',
           data_pagamento = coalesce(p_data_pagamento, current_date),
           observacoes = trim(both ' ' from concat_ws(' ', nullif(observacoes, ''), 'Saque aprovado por ', v_actor.ator_nome))
     WHERE id = p_saque_id;

    RETURN jsonb_build_object('success', true, 'status', 'pago', 'saque_id', p_saque_id);
  ELSIF v_acao = 'rejeitar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
    END IF;
    IF v_saque.status = 'cancelado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'already_processed', true);
    END IF;
    IF v_saque.status <> 'pendente' THEN
      RAISE EXCEPTION 'Este saque ja foi processado. Status atual: %', v_saque.status;
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_saque.cliente_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente do saque nao encontrado.';
    END IF;

    v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + coalesce(v_saque.valor, 0), 2);

    UPDATE public.saques
       SET status = 'cancelado',
           motivo_cancelamento = trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']'
     WHERE id = p_saque_id;

    UPDATE public.clientes
       SET saldo_carteira = v_novo_saldo
     WHERE id = v_saque.cliente_id;

    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    )
    VALUES (
      v_saque.cliente_id,
      'entrada',
      coalesce(v_saque.valor, 0),
      'Estorno de saque rejeitado - Motivo: ' || trim(p_motivo),
      p_saque_id,
      'saques',
      v_novo_saldo
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'cancelado',
      'saque_id', p_saque_id,
      'saldo_carteira', v_novo_saldo,
      'valor_estornado', coalesce(v_saque.valor, 0)
    );
  END IF;

  RAISE EXCEPTION 'Acao invalida para saque.';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_processar_saque(uuid, text, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_saque(uuid, text, uuid, text, text, date) TO authenticated, service_role;


-- 2.3 RPC gsa_admin_ajustar_saldo_cliente:
-- Support both ('credito', 'entrada') and ('debito', 'saida'), set bypass_saldo_check,
-- write to ledger, and return expected payload format for ClientesModule.tsx.
CREATE OR REPLACE FUNCTION public.gsa_admin_ajustar_saldo_cliente(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_tipo text DEFAULT 'credito',
  p_valor numeric DEFAULT 0,
  p_descricao text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_cliente public.clientes%rowtype;
  v_tipo text := lower(coalesce(nullif(trim(p_tipo), ''), 'credito'));
  v_valor numeric := round(coalesce(p_valor, 0), 2);
  v_adjustment numeric;
  v_novo_saldo numeric;
  v_desc text := coalesce(nullif(trim(p_motivo), ''), nullif(trim(p_descricao), ''), 'Ajuste administrativo de saldo');
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  -- Validate admin context
  IF p_sessao_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    BEGIN
      PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
      SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      IF NOT (public.gsa_jwt_is_admin() OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')) THEN
        RAISE;
      END IF;
    END;
  ELSE
    IF NOT (public.gsa_jwt_is_admin() OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')) THEN
      RAISE EXCEPTION 'Acesso negado: Sessão de administrador necessária.';
    END IF;
  END IF;

  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'ID do cliente é obrigatório.';
  END IF;

  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do ajuste deve ser maior que zero.';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  IF v_tipo IN ('credito', 'entrada') THEN
    v_adjustment := v_valor;
    v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + v_valor, 2);
  ELSIF v_tipo IN ('debito', 'saida') THEN
    v_adjustment := -v_valor;
    v_novo_saldo := round(greatest(0, coalesce(v_cliente.saldo_carteira, 0) - v_valor), 2);
  ELSE
    RAISE EXCEPTION 'Tipo de ajuste inválido: % (use credito/entrada ou debito/saida)', p_tipo;
  END IF;

  UPDATE public.clientes
     SET saldo_carteira = v_novo_saldo,
         updated_at = now()
   WHERE id = p_cliente_id;

  INSERT INTO public.carteira_lancamentos (
    cliente_id, valor, tipo, descricao
  ) VALUES (
    p_cliente_id,
    v_valor,
    CASE WHEN v_tipo IN ('credito', 'entrada') THEN 'credito' ELSE 'debito' END,
    v_desc
  );

  INSERT INTO public.extrato_financeiro (
    cliente_id, tipo, valor, descricao, saldo_resultante
  ) VALUES (
    p_cliente_id,
    CASE WHEN v_tipo IN ('credito', 'entrada') THEN 'entrada' ELSE 'saida' END,
    v_valor,
    v_desc,
    v_novo_saldo
  );

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'saldo_anterior', coalesce(v_cliente.saldo_carteira, 0),
    'saldo_atual', v_novo_saldo,
    'novo_saldo', v_novo_saldo,
    'ajuste', v_adjustment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text, text) TO authenticated, service_role;


-- 2.4 RPC gsa_client_pagar_fatura:
-- Set my.app.bypass_saldo_check = 'on' to prevent prevent_saldo_tampering() from aborting wallet usage.
CREATE OR REPLACE FUNCTION public.gsa_client_pagar_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_fatura public.faturas%rowtype;
  v_cliente public.clientes%rowtype;
  v_voucher public.vouchers%rowtype;
  v_fatura_id uuid := nullif(p_payload ->> 'fatura_id', '')::uuid;
  v_voucher_id uuid := nullif(p_payload ->> 'voucher_id', '')::uuid;
  v_metodo text := coalesce(nullif(trim(p_payload ->> 'metodo'), ''), 'carteira');
  v_use_wallet boolean := coalesce((p_payload ->> 'use_wallet')::boolean, false);
  v_use_pontos boolean := coalesce((p_payload ->> 'use_pontos')::boolean, false);
  v_taxa_conversao numeric := greatest(coalesce((p_payload ->> 'taxa_conversao')::numeric, 0.01), 0.0001);
  v_subtotal numeric;
  v_voucher_discount numeric := 0;
  v_wallet_deduction numeric := 0;
  v_pontos_deduction numeric := 0;
  v_pontos_utilizados integer := 0;
  v_negative_charge numeric := 0;
  v_net_total numeric := 0;
  v_is_store_invoice boolean := false;
  v_novo_status text;
  v_paid_now numeric;
  v_points_base numeric;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_fatura_id IS NULL THEN RAISE EXCEPTION 'Fatura obrigatoria.'; END IF;

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = v_fatura_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;

  IF v_fatura.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', 'pago');
  END IF;
  IF v_fatura.status = 'cancelado' THEN RAISE EXCEPTION 'Fatura cancelada.'; END IF;
  IF v_fatura.status = 'pendente_pagamento' AND v_fatura.data_escolha_pagamento IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'status', v_fatura.status,
      'valor_pendente', v_fatura.valor_final_pendente
    );
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  v_subtotal := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);
  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'Fatura sem valor pendente.'; END IF;

  v_is_store_invoice := v_fatura.ordem_compra_id IS NOT NULL
    OR (v_fatura.ordem_assinatura_id IS NOT NULL AND coalesce(v_fatura.codigo_fatura, '') ~ '-1/[0-9]+$');

  IF v_voucher_id IS NOT NULL THEN
    SELECT * INTO v_voucher FROM public.vouchers WHERE id = v_voucher_id FOR UPDATE;
    IF NOT FOUND OR v_voucher.status <> 'ativo' THEN RAISE EXCEPTION 'Voucher invalido ou expirado.'; END IF;
    IF v_voucher.cliente_id IS NOT NULL AND v_voucher.cliente_id <> v_actor.cliente_id THEN
      RAISE EXCEPTION 'Voucher nao pertence a este cliente.';
    END IF;
    IF v_voucher.validade IS NOT NULL AND v_voucher.validade < current_date THEN RAISE EXCEPTION 'Voucher expirado.'; END IF;
    IF coalesce(v_voucher.usage_limit, 0) > 0 AND coalesce(v_voucher.usage_count, 0) >= v_voucher.usage_limit THEN
      RAISE EXCEPTION 'Limite de uso do voucher atingido.';
    END IF;
    IF v_voucher.categoria = 'saque' THEN RAISE EXCEPTION 'Voucher incompativel com fatura.'; END IF;

    v_voucher_discount := CASE
      WHEN v_voucher.tipo = 'porcentagem' THEN round(v_subtotal * (v_voucher.valor / 100), 2)
      ELSE round(v_voucher.valor, 2)
    END;
    v_voucher_discount := least(greatest(v_voucher_discount, 0), v_subtotal);

    UPDATE public.vouchers
       SET usage_count = coalesce(usage_count, 0) + 1,
           status = CASE
             WHEN coalesce(usage_limit, 0) > 0 AND coalesce(usage_count, 0) + 1 >= usage_limit THEN 'expirado'
             ELSE status
           END,
           data_uso = v_now,
           tipo_uso = 'fatura'
     WHERE id = v_voucher_id;
  END IF;

  IF v_use_wallet AND NOT v_is_store_invoice THEN
    IF coalesce(v_cliente.carteira_bloqueada, false) THEN RAISE EXCEPTION 'Carteira bloqueada.'; END IF;
    v_wallet_deduction := round(least(
      greatest(coalesce(v_cliente.saldo_carteira, 0), 0),
      greatest(v_subtotal - v_voucher_discount, 0)
    ), 2);
  END IF;

  IF v_use_pontos AND NOT v_is_store_invoice THEN
    IF coalesce(v_cliente.pontos_bloqueados, false) THEN RAISE EXCEPTION 'Carteira de pontos bloqueada.'; END IF;
    v_pontos_deduction := round(least(
      greatest(coalesce(v_cliente.saldo_pontos, 0) * v_taxa_conversao, 0),
      greatest(v_subtotal - v_voucher_discount - v_wallet_deduction, 0)
    ), 2);
    v_pontos_utilizados := ceil(v_pontos_deduction / v_taxa_conversao);
    IF v_pontos_utilizados > coalesce(v_cliente.saldo_pontos, 0) THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
  END IF;

  v_negative_charge := CASE WHEN coalesce(v_cliente.saldo_carteira, 0) < 0 THEN abs(v_cliente.saldo_carteira) ELSE 0 END;
  v_net_total := round(greatest(v_subtotal - v_voucher_discount - v_wallet_deduction - v_pontos_deduction, 0) + v_negative_charge, 2);
  v_novo_status := CASE WHEN v_net_total <= 0 THEN 'pago' ELSE 'pendente_pagamento' END;
  v_paid_now := round(v_voucher_discount + v_wallet_deduction + v_pontos_deduction, 2);
  v_points_base := greatest(v_paid_now - v_pontos_deduction, 0);

  IF v_wallet_deduction > 0 THEN
    UPDATE public.clientes SET saldo_carteira = coalesce(saldo_carteira, 0) - v_wallet_deduction WHERE id = v_actor.cliente_id;
    INSERT INTO public.extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (
      v_actor.cliente_id, 'saida', v_wallet_deduction,
      'Uso de saldo - Fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'),
      v_fatura_id, 'faturas', coalesce(v_cliente.saldo_carteira, 0) - v_wallet_deduction
    );
    INSERT INTO public.pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_wallet_deduction, 'carteira', v_now);
  END IF;

  IF v_pontos_deduction > 0 THEN
    PERFORM public.gsa_apply_points_internal(
      v_actor.cliente_id,
      -v_pontos_utilizados,
      'Uso de pontos na fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'),
      'uso_fatura',
      v_fatura_id,
      false
    );
    UPDATE public.pontos_movimentacoes
       SET valor_convertido = v_pontos_deduction
     WHERE id = (
       SELECT id FROM public.pontos_movimentacoes
       WHERE cliente_id = v_actor.cliente_id
         AND fatura_id = v_fatura_id
         AND tipo = 'uso_fatura'
       ORDER BY data_movimentacao DESC
       LIMIT 1
     );
    INSERT INTO public.pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_pontos_deduction, 'pontos', v_now);
  END IF;

  IF v_voucher_discount > 0 THEN
    INSERT INTO public.pagamentos(fatura_id, voucher_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_voucher_id, v_voucher_discount, 'voucher', v_now);
  END IF;

  UPDATE public.faturas
     SET status = v_novo_status,
         valor_pago = round(coalesce(valor_pago, 0) + v_paid_now, 2),
         valor_final_pendente = v_net_total,
         data_pagamento = CASE WHEN v_novo_status = 'pago' THEN v_now ELSE data_pagamento END,
         forma_pagamento_escolhida = v_metodo,
         data_escolha_pagamento = v_now,
         desconto_voucher_aplicado = coalesce(desconto_voucher_aplicado, 0) + v_voucher_discount,
         abatimento_carteira_aplicado = coalesce(abatimento_carteira_aplicado, 0) + v_wallet_deduction,
         desconto_pontos_aplicado = coalesce(desconto_pontos_aplicado, 0) + v_pontos_deduction
   WHERE id = v_fatura_id;

  IF v_novo_status = 'pago' THEN
    PERFORM public.gsa_finalize_paid_invoice_internal(v_fatura_id, v_points_base);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'fatura_id', v_fatura_id,
    'status', v_novo_status,
    'subtotal', v_subtotal,
    'valor_pago_agora', v_paid_now,
    'valor_pendente', v_net_total,
    'voucher_discount', v_voucher_discount,
    'wallet_deduction', v_wallet_deduction,
    'pontos_deduction', v_pontos_deduction,
    'pontos_utilizados', v_pontos_utilizados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_pagar_fatura(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_pagar_fatura(uuid, text, jsonb) TO authenticated, service_role;


-- 2.5 RPC gsa_admin_processar_transferencia & legacy:
-- Set my.app.bypass_saldo_check = 'on' to prevent prevent_saldo_tampering() from aborting transfer reversals.
CREATE OR REPLACE FUNCTION public.gsa_admin_processar_transferencia_legacy_20260829(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_transf transferencias%rowtype;
  v_origem clientes%rowtype;
  v_destino clientes%rowtype;
  v_is_pontos boolean;
  v_valor_bruto numeric;
  v_valor_liquido numeric;
  v_saldo_origem numeric;
  v_saldo_destino numeric;
  v_acao text := lower(coalesce(p_acao, ''));
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_transf
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia nao encontrada.';
  END IF;

  v_is_pontos := coalesce(v_transf.tipo, 'saldo') = 'pontos';
  v_valor_bruto := coalesce(v_transf.valor, 0);
  v_valor_liquido := coalesce(v_transf.valor_liquido, v_transf.valor, 0);

  IF v_acao = 'aprovar' THEN
    IF v_transf.status IN ('aprovado', 'concluido') THEN
      RETURN jsonb_build_object('success', true, 'status', v_transf.status, 'already_processed', true);
    END IF;
    IF v_transf.status <> 'em_analise' THEN
      RAISE EXCEPTION 'Esta transferencia ja foi processada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_destino
    FROM public.clientes
    WHERE id = v_transf.cliente_destino_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de destino nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      v_saldo_destino := coalesce(v_destino.saldo_pontos, 0) + v_valor_liquido;

      UPDATE public.clientes
         SET saldo_pontos = v_saldo_destino::integer
       WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES (
        v_transf.cliente_destino_id,
        'transferencia_recebida',
        v_valor_liquido::integer,
        v_saldo_destino::integer,
        'Transferencia de pontos recebida'
      );

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES (
        v_transf.cliente_destino_id,
        'transferencia_recebida',
        v_valor_liquido::integer,
        'Transferencia de pontos recebida'
      );
    ELSE
      v_saldo_destino := round(coalesce(v_destino.saldo_carteira, 0) + v_valor_liquido, 2);

      UPDATE public.clientes
         SET saldo_carteira = v_saldo_destino
       WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES (
        v_transf.cliente_destino_id,
        'entrada',
        v_valor_liquido,
        'Transferencia recebida',
        v_saldo_destino,
        p_transferencia_id,
        'transferencia'
      );
    END IF;

    UPDATE public.transferencias
       SET status = 'aprovado',
           data_analise = now(),
           data_pagamento = coalesce(p_data_pagamento, current_date),
           observacoes_admin = trim(both ' ' from concat_ws(' ', nullif(observacoes_admin, ''), 'Transferencia aprovada por ', v_actor.ator_nome))
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'aprovado', 'transferencia_id', p_transferencia_id);
  ELSIF v_acao = 'rejeitar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
    END IF;
    IF v_transf.status = 'cancelado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'already_processed', true);
    END IF;
    IF v_transf.status <> 'em_analise' THEN
      RAISE EXCEPTION 'Esta transferencia ja foi processada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_origem
    FROM public.clientes
    WHERE id = v_transf.cliente_origem_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de origem nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      v_saldo_origem := coalesce(v_origem.saldo_pontos, 0) + v_valor_bruto;

      UPDATE public.clientes
         SET saldo_pontos = v_saldo_origem::integer
       WHERE id = v_transf.cliente_origem_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES (
        v_transf.cliente_origem_id,
        'estorno',
        v_valor_bruto::integer,
        v_saldo_origem::integer,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo)
      );

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES (
        v_transf.cliente_origem_id,
        'estorno',
        v_valor_bruto::integer,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo)
      );
    ELSE
      v_saldo_origem := round(coalesce(v_origem.saldo_carteira, 0) + v_valor_bruto, 2);

      UPDATE public.clientes
         SET saldo_carteira = v_saldo_origem
       WHERE id = v_transf.cliente_origem_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES (
        v_transf.cliente_origem_id,
        'entrada',
        v_valor_bruto,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo),
        v_saldo_origem,
        p_transferencia_id,
        'transferencia'
      );
    END IF;

    UPDATE public.transferencias
       SET status = 'cancelado',
           motivo_cancelamento = trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']',
           observacoes_admin = trim(p_motivo),
           data_analise = now()
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'transferencia_id', p_transferencia_id);
  ELSIF v_acao = 'estornar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo do estorno e obrigatorio.';
    END IF;
    IF v_transf.status = 'estornado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'estornado', 'already_processed', true);
    END IF;
    IF v_transf.status NOT IN ('aprovado', 'concluido') THEN
      RAISE EXCEPTION 'Esta transferencia nao pode ser estornada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_origem
    FROM public.clientes
    WHERE id = v_transf.cliente_origem_id
    FOR UPDATE;

    SELECT * INTO v_destino
    FROM public.clientes
    WHERE id = v_transf.cliente_destino_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de origem ou destino nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      IF coalesce(v_destino.saldo_pontos, 0) < v_valor_liquido THEN
        RAISE EXCEPTION 'Destinatario sem pontos suficientes para estorno.';
      END IF;

      v_saldo_origem := coalesce(v_origem.saldo_pontos, 0) + v_valor_bruto;
      v_saldo_destino := coalesce(v_destino.saldo_pontos, 0) - v_valor_liquido;

      UPDATE public.clientes SET saldo_pontos = v_saldo_origem::integer WHERE id = v_transf.cliente_origem_id;
      UPDATE public.clientes SET saldo_pontos = v_saldo_destino::integer WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES
        (v_transf.cliente_origem_id, 'estorno', v_valor_bruto::integer, v_saldo_origem::integer, 'Estorno de transferencia concluida'),
        (v_transf.cliente_destino_id, 'estorno', -v_valor_liquido::integer, v_saldo_destino::integer, 'Estorno de transferencia recebida');

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES
        (v_transf.cliente_origem_id, 'estorno', v_valor_bruto::integer, 'Estorno de transferencia concluida'),
        (v_transf.cliente_destino_id, 'estorno', -v_valor_liquido::integer, 'Estorno de transferencia recebida');
    ELSE
      IF coalesce(v_destino.saldo_carteira, 0) < v_valor_liquido THEN
        RAISE EXCEPTION 'Destinatario sem saldo suficiente para estorno.';
      END IF;

      v_saldo_origem := round(coalesce(v_origem.saldo_carteira, 0) + v_valor_bruto, 2);
      v_saldo_destino := round(coalesce(v_destino.saldo_carteira, 0) - v_valor_liquido, 2);

      UPDATE public.clientes SET saldo_carteira = v_saldo_origem WHERE id = v_transf.cliente_origem_id;
      UPDATE public.clientes SET saldo_carteira = v_saldo_destino WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES
        (v_transf.cliente_origem_id, 'entrada', v_valor_bruto, 'Estorno de transferencia concluida', v_saldo_origem, p_transferencia_id, 'transferencia'),
        (v_transf.cliente_destino_id, 'saida', v_valor_liquido, 'Estorno de transferencia recebida', v_saldo_destino, p_transferencia_id, 'transferencia');
    END IF;

    UPDATE public.transferencias
       SET status = 'estornado',
           motivo_cancelamento = 'ESTORNO ADMINISTRATIVO: ' || trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']',
           observacoes_admin = 'Estornado - Motivo: ' || trim(p_motivo),
           data_analise = now()
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'estornado', 'transferencia_id', p_transferencia_id);
  END IF;

  RAISE EXCEPTION 'Acao invalida para transferencia.';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_processar_transferencia_legacy_20260829(uuid, text, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_transferencia_legacy_20260829(uuid, text, uuid, text, text, date) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_processar_transferencia(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  IF lower(trim(coalesce(p_acao,'')))<>'estornar' THEN
    RAISE EXCEPTION 'Transferências entre clientes são concluídas instantaneamente e não passam por análise.' USING ERRCODE='22023';
  END IF;
  RETURN public.gsa_admin_processar_transferencia_legacy_20260829(
    p_sessao_id, p_session_token, p_transferencia_id, 'estornar', p_motivo, p_data_pagamento
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_processar_transferencia(uuid, text, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_transferencia(uuid, text, uuid, text, text, date) TO authenticated, service_role;


-- 2.6 RPC gsa_client_request_affiliate_payout:
-- Deduct/lock client wallet balance on request insertion to prevent double-spending.
CREATE OR REPLACE FUNCTION public.gsa_client_request_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_client public.clientes%rowtype;
  v_comm_available numeric(14,2);
  v_total_available numeric(14,2);
  v_minimum numeric(14,2);
  v_payout public.gsa_afiliado_saques%rowtype;
  v_value numeric(14,2) := round(coalesce(p_valor, 0), 2);
  v_wallet numeric(14,2) := 0;
  v_wallet_deduct numeric(14,2) := 0;
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.cliente_id IS NULL THEN
    SELECT s.ator_id INTO v_actor.cliente_id
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id AND s.status = 'ativo' AND s.ator_tipo = 'cliente'
     LIMIT 1;
  END IF;

  IF v_actor.cliente_id IS NULL THEN
    v_actor.cliente_id := auth.uid();
  END IF;

  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.';
  END IF;

  SELECT * INTO v_affiliate
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
  FOR UPDATE;

  IF v_affiliate.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de afiliado ativo não encontrado.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da solicitação obrigatório.';
  END IF;
  IF v_value <= 0 OR v_value > 1000000 THEN
    RAISE EXCEPTION 'Valor de saque inválido.';
  END IF;

  -- Checagem estrita de idempotencia
  SELECT * INTO v_payout
  FROM public.gsa_afiliado_saques
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_payout.afiliado_id <> v_affiliate.id OR v_payout.valor <> v_value THEN
      RAISE EXCEPTION 'Identificador de solicitação já utilizado em outra operação.';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payout_id', v_payout.id,
      'status', v_payout.status
    );
  END IF;

  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  v_wallet := coalesce(v_client.saldo_carteira, 0);

  SELECT coalesce(min(saque_minimo), 50) INTO v_minimum
  FROM public.gsa_afiliado_programas WHERE ativo;

  IF v_value < v_minimum THEN
    RAISE EXCEPTION 'O valor mínimo para solicitação de saque é R$ %.', trim(to_char(v_minimum, 'FM999G999G990D00'));
  END IF;

  PERFORM public.gsa_affiliate_release_due_commissions();

  -- Commissions available to payout
  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0),
    0
  ) INTO v_comm_available;

  v_total_available := round(v_comm_available + v_wallet, 2);

  IF v_value > v_total_available THEN
    RAISE EXCEPTION 'Saldo disponível insuficiente para a solicitação.';
  END IF;

  -- If commissions do not cover the requested amount, deduct difference from client wallet immediately to prevent double-spending
  IF v_value > v_comm_available THEN
    v_wallet_deduct := round(v_value - v_comm_available, 2);
    IF v_wallet < v_wallet_deduct THEN
      RAISE EXCEPTION 'Saldo em carteira insuficiente para complementar o saque.';
    END IF;

    UPDATE public.clientes
       SET saldo_carteira = round(saldo_carteira - v_wallet_deduct, 2),
           updated_at = now()
     WHERE id = v_actor.cliente_id;

    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (
      v_actor.cliente_id,
      v_wallet_deduct,
      'debito',
      'Retenção de saldo para solicitação de saque de afiliado'
    );

    INSERT INTO public.extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (
      v_actor.cliente_id,
      'saida',
      v_wallet_deduct,
      'Retenção de saldo para solicitação de saque de afiliado',
      p_request_id,
      'afiliados',
      round(v_wallet - v_wallet_deduct, 2)
    );
  END IF;

  INSERT INTO public.gsa_afiliado_saques(
    request_id, afiliado_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot, solicitado_em
  ) VALUES (
    p_request_id, v_affiliate.id, v_value, 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave, now()
  ) RETURNING * INTO v_payout;

  -- Notificacao ao cliente
  IF v_actor.cliente_id IS NOT NULL THEN
    PERFORM set_config('gsa.system_override', 'on', true);
    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, tab, item_id, destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      v_actor.cliente_id,
      'Solicitação de Saque PIX',
      format('Sua solicitação de saque no valor de R$ %s foi registrada e está em análise.', to_char(v_value, 'FM999G999G990D00')),
      'affiliates',
      'saques',
      v_payout.id::text,
      'cliente',
      'normal',
      'saque_solicitado',
      jsonb_build_object('payout_id', v_payout.id, 'request_id', p_request_id, 'wallet_deducted', v_wallet_deduct)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout.id,
    'valor', v_payout.valor,
    'wallet_deducted', v_wallet_deduct,
    'status', v_payout.status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;


-- ============================================================================
-- 3. DEDICATED ATOMIC WEBHOOK WITHDRAWAL RPC
-- ============================================================================

-- 3.1 RPC gsa_webhook_solicitar_saque_cliente:
-- Atomically locks client balance, decrements saldo_carteira, generates saques record,
-- and posts to carteira_lancamentos and extrato_financeiro.
CREATE OR REPLACE FUNCTION public.gsa_webhook_solicitar_saque_cliente(
  p_cliente_id uuid,
  p_tipo_chave_pix text,
  p_chave_pix text,
  p_valor numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente public.clientes%rowtype;
  v_valor numeric;
  v_novo_saldo numeric;
  v_saque_id uuid;
  v_pix_tipo text := coalesce(nullif(trim(p_tipo_chave_pix), ''), 'cpf');
  v_pix_chave text := trim(coalesce(p_chave_pix, ''));
BEGIN
  -- Enable bypass for legitimate atomic withdrawal
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);

  IF p_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID do cliente obrigatório');
  END IF;

  IF length(v_pix_chave) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chave PIX inválida');
  END IF;

  -- Lock client row exclusively
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF coalesce(v_cliente.carteira_bloqueada, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira do cliente bloqueada');
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    v_valor := round(coalesce(v_cliente.saldo_carteira, 0), 2);
  ELSE
    v_valor := round(p_valor, 2);
  END IF;

  IF v_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente para saque');
  END IF;

  IF coalesce(v_cliente.saldo_carteira, 0) < v_valor THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo em carteira insuficiente');
  END IF;

  v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) - v_valor, 2);

  UPDATE public.clientes
     SET saldo_carteira = v_novo_saldo,
         updated_at = now()
   WHERE id = p_cliente_id;

  INSERT INTO public.saques (
    cliente_id, valor, taxa_aplicada, valor_liquido,
    tipo_chave_pix, chave_pix, status, data_solicitacao
  ) VALUES (
    p_cliente_id, v_valor, 0, v_valor,
    v_pix_tipo, v_pix_chave, 'pendente', now()
  ) RETURNING id INTO v_saque_id;

  INSERT INTO public.carteira_lancamentos (
    cliente_id, valor, tipo, descricao
  ) VALUES (
    p_cliente_id, v_valor, 'debito', 'Solicitação de saque PIX via WhatsApp'
  );

  INSERT INTO public.extrato_financeiro (
    cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
  ) VALUES (
    p_cliente_id, 'saida', v_valor, 'Solicitação de saque PIX via WhatsApp', v_saque_id, 'saques', v_novo_saldo
  );

  RETURN jsonb_build_object(
    'success', true,
    'saque_id', v_saque_id,
    'valor', v_valor,
    'novo_saldo_carteira', v_novo_saldo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_webhook_solicitar_saque_cliente(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_webhook_solicitar_saque_cliente(uuid, text, text, numeric) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
