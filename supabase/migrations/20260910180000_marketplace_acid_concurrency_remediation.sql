-- 20260910180000_marketplace_acid_concurrency_remediation.sql
-- Remediates returns, refunds, loyalty, stock replenishment and ACID concurrency in GSA Marketplace.

-- 1. Ensure columns exist for selective returns and idempotency
ALTER TABLE public.loja_solicitacoes
  ADD COLUMN IF NOT EXISTS itens_devolvidos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estorno_executado boolean DEFAULT false;

ALTER TABLE public.loja_reembolsos
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES public.loja_solicitacoes(id) ON DELETE SET NULL;

-- 2. Drop prior signatures to allow flexible parameter aliases and overload cleanup
DROP FUNCTION IF EXISTS public.gsa_admin_atualizar_solicitacao_loja(uuid, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.gsa_admin_atualizar_solicitacao_loja(uuid, text, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.gsa_admin_atualizar_solicitacao_loja(uuid, text, uuid, text, text, text, text, text, timestamptz, text);

-- 3. Canonical, hardened post-sales return & exchange state-machine RPC
CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_solicitacao_loja(
  p_sessao_id uuid,
  p_token text DEFAULT NULL,
  p_solicitacao_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_resposta_admin text DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_novo_status text DEFAULT NULL,
  p_endereco_devolucao text DEFAULT NULL,
  p_data_agendamento timestamptz DEFAULT NULL,
  p_rastreio_admin text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_token text;
  v_raw_status text;
  v_status_to_save text;
  v_sol public.loja_solicitacoes%rowtype;
  v_orc public.orcamentos%rowtype;
  v_cliente public.clientes%rowtype;
  v_indicador public.clientes%rowtype;
  v_diff numeric := 0;
  v_fatura_id uuid;
  v_codigo_fatura text;
  v_tem_fatura_credito boolean := false;
  v_canceladas integer := 0;
  v_limite_disponivel_novo numeric;
  v_historico jsonb;
  v_refunded_points integer := 0;
  v_earned_points integer := 0;
  v_wallet_refund numeric := 0;
  v_external_refund numeric := 0;
  v_elem_json jsonb;
  v_order_item record;
  v_item_prod_id uuid;
  v_item_var_id uuid;
  v_item_qtd integer;
  v_item_oc_id uuid;
  v_new_wallet numeric;
  v_new_points integer;
  v_refund_code text;
  v_reembolso_id uuid;
  v_ref_bonus numeric := 0;
  v_ind_novo_saldo numeric := 0;
  v_estorno_rodou boolean := false;
BEGIN
  -- 1. Session Config Bypass: Prevent prevent_saldo_tampering() and credit limit triggers from blocking admin actions
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('gsa.system_override', 'on', true);

  -- 2. Resolve parameter aliases (supports p_token or p_session_token, p_status or p_novo_status)
  v_token := coalesce(nullif(trim(p_session_token), ''), nullif(trim(p_token), ''));
  v_raw_status := coalesce(nullif(trim(p_novo_status), ''), nullif(trim(p_status), ''));

  IF p_sessao_id IS NULL OR v_token IS NULL THEN
    RAISE EXCEPTION 'Sessao de administrador invalida ou expirada.';
  END IF;

  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'ID da solicitacao nao informado.';
  END IF;

  IF v_raw_status IS NULL THEN
    RAISE EXCEPTION 'Status nao informado.';
  END IF;

  -- 3. Authenticate admin or colaborador
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, v_token) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessao de administrador invalida ou expirada.';
  END IF;

  -- 4. Validate target status against the exhaustive canonical domain
  v_status_to_save := lower(trim(v_raw_status));
  IF v_status_to_save NOT IN (
    'pendente', 'em_analise', 'aprovado', 'rejeitado', 'concluido', 'cancelado',
    'aguardando_instrucoes', 'aguardando_devolucao', 'aguardando_postagem',
    'devolucao_postada', 'em_transito', 'devolucao_recebida', 'novo_produto_enviado', 'agendado'
  ) THEN
    RAISE EXCEPTION 'Status invalido: %', v_status_to_save;
  END IF;

  -- 5. Lock and fetch target solicitacao
  SELECT * INTO v_sol
  FROM public.loja_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada.';
  END IF;

  -- 6. Lock client row early to ensure deterministic locking hierarchy
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_sol.cliente_id
  FOR UPDATE;

  -- 7. Update status, history and logistics parameters
  v_historico := coalesce(v_sol.historico_status::jsonb, '{}'::jsonb) || jsonb_build_object(v_status_to_save, now());

  UPDATE public.loja_solicitacoes
     SET status = v_status_to_save,
         historico_status = v_historico,
         resposta_admin = coalesce(nullif(trim(coalesce(p_resposta_admin, '')), ''), v_sol.resposta_admin),
         endereco_devolucao = coalesce(nullif(trim(coalesce(p_endereco_devolucao, '')), ''), v_sol.endereco_devolucao),
         data_agendamento = coalesce(p_data_agendamento, v_sol.data_agendamento),
         rastreio_admin = coalesce(nullif(trim(coalesce(p_rastreio_admin, '')), ''), v_sol.rastreio_admin),
         updated_at = now()
   WHERE id = p_solicitacao_id;

  v_diff := round(coalesce(v_sol.valor_diferenca, 0), 2);

  -- 8. Handle difference invoice for exchanges
  IF v_status_to_save = 'aprovado' AND v_diff > 0 THEN
    v_codigo_fatura := 'FAT-TROCA-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text);

    SELECT id INTO v_fatura_id
    FROM public.faturas
    WHERE codigo_fatura = v_codigo_fatura
    LIMIT 1;

    IF v_fatura_id IS NULL THEN
      INSERT INTO public.faturas(
        codigo_fatura, cliente_id, valor_total, valor_final_pendente, valor_base_original,
        status, tipo, gerada_automaticamente, is_amortizacao_credito, data_vencimento, itens_faturados
      )
      VALUES (
        v_codigo_fatura, v_sol.cliente_id, v_diff, v_diff, v_diff,
        'pendente', 'produto', true, false, current_date + 2,
        jsonb_build_array(jsonb_build_object(
          'codigo', 'DIF-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
          'descricao', 'Diferenca de valor na troca de produto (Ref. Solicitacao #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text) || ')',
          'valor_unitario', v_diff, 'quantidade', 1, 'subtotal', v_diff, 'tipo', 'produto'
        ))
      )
      RETURNING id INTO v_fatura_id;
    END IF;
  END IF;

  -- 9. Cancel orphan difference invoice on rejection / cancellation
  IF v_status_to_save IN ('rejeitado', 'cancelado') THEN
    v_codigo_fatura := 'FAT-TROCA-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text);

    UPDATE public.faturas
       SET status = 'cancelado',
           motivo_cancelamento = 'Solicitacao #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text) || ' foi ' || v_status_to_save,
           data_cancelamento = now(),
           updated_at = now()
     WHERE codigo_fatura = v_codigo_fatura
       AND status = 'pendente';
  END IF;

  -- 10. Atomic Restock and Refunds for Returns
  -- Condition: tipo = 'devolucao' AND status IN ('aprovado', 'concluido', 'devolucao_recebida')
  -- Idempotency: execute ONLY IF estorno_executado IS NOT TRUE
  IF v_sol.tipo = 'devolucao' 
     AND v_status_to_save IN ('aprovado', 'concluido', 'devolucao_recebida')
     AND coalesce(v_sol.estorno_executado, false) = false
     AND v_sol.orcamento_origem_id IS NOT NULL THEN

    SELECT * INTO v_orc
    FROM public.orcamentos
    WHERE id = v_sol.orcamento_origem_id
    FOR UPDATE;

    IF FOUND THEN
      -- A. Exact selective stock replenishment (No Phantom Stock)
      IF v_sol.itens_devolvidos IS NOT NULL 
         AND jsonb_typeof(v_sol.itens_devolvidos) = 'array' 
         AND jsonb_array_length(v_sol.itens_devolvidos) > 0 THEN

        FOR v_elem_json IN SELECT value FROM jsonb_array_elements(v_sol.itens_devolvidos) LOOP
          v_item_prod_id := NULL;
          v_item_var_id := NULL;
          v_item_qtd := 1;
          v_item_oc_id := NULL;

          IF jsonb_typeof(v_elem_json) = 'object' THEN
            v_item_prod_id := NULLIF(v_elem_json->>'produto_id', '')::uuid;
            v_item_var_id := NULLIF(v_elem_json->>'produto_variante_id', '')::uuid;
            v_item_qtd := greatest(1, coalesce((v_elem_json->>'quantidade')::integer, 1));
            v_item_oc_id := NULLIF(v_elem_json->>'ordem_compra_id', '')::uuid;

            IF v_item_prod_id IS NULL AND v_item_oc_id IS NOT NULL THEN
              SELECT produto_id, produto_variante_id, coalesce(quantidade, 1)
                INTO v_item_prod_id, v_item_var_id, v_item_qtd
              FROM public.ordens_compra
              WHERE id = v_item_oc_id;
            END IF;
          ELSIF jsonb_typeof(v_elem_json) = 'string' THEN
            v_item_oc_id := (v_elem_json #>> '{}')::uuid;
            SELECT produto_id, produto_variante_id, coalesce(quantidade, 1)
              INTO v_item_prod_id, v_item_var_id, v_item_qtd
            FROM public.ordens_compra
            WHERE id = v_item_oc_id;
          END IF;

          -- Re-fetch variant parent product if produto_id was not explicitly supplied
          IF v_item_prod_id IS NULL AND v_item_var_id IS NOT NULL THEN
            SELECT produto_id INTO v_item_prod_id
            FROM public.produto_variantes
            WHERE id = v_item_var_id;
          END IF;

          IF v_item_var_id IS NOT NULL THEN
            UPDATE public.produto_variantes
               SET estoque_disponivel = estoque_disponivel + v_item_qtd
             WHERE id = v_item_var_id;
          END IF;

          IF v_item_prod_id IS NOT NULL THEN
            UPDATE public.produtos
               SET estoque_disponivel = estoque_disponivel + v_item_qtd
             WHERE id = v_item_prod_id AND controle_estoque = true;
          END IF;
        END LOOP;

      ELSE
        -- Fallback: if itens_devolvidos was not provided, restock items from the original order
        FOR v_order_item IN (
          SELECT produto_id, produto_variante_id, quantidade
          FROM public.loja_pedido_itens
          WHERE orcamento_id = v_orc.id AND tipo = 'produto'
          ORDER BY produto_id, coalesce(produto_variante_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) LOOP
          IF v_order_item.produto_variante_id IS NOT NULL THEN
            UPDATE public.produto_variantes
               SET estoque_disponivel = estoque_disponivel + v_order_item.quantidade
             WHERE id = v_order_item.produto_variante_id;
          END IF;

          IF v_order_item.produto_id IS NOT NULL THEN
            UPDATE public.produtos
               SET estoque_disponivel = estoque_disponivel + v_order_item.quantidade
             WHERE id = v_order_item.produto_id AND controle_estoque = true;
          END IF;
        END LOOP;
      END IF;

      -- B. Refund Wallet Balance (saldo_carteira)
      v_wallet_refund := round(coalesce(v_orc.abatimento_carteira, 0), 2);
      IF v_wallet_refund > 0 THEN
        v_new_wallet := round(coalesce(v_cliente.saldo_carteira, 0) + v_wallet_refund, 2);

        UPDATE public.clientes
           SET saldo_carteira = v_new_wallet,
               updated_at = now()
         WHERE id = v_sol.cliente_id;

        INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
        VALUES (
          v_sol.cliente_id, v_wallet_refund, 'credito',
          'Estorno de saldo por devolucao (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')'
        );

        INSERT INTO public.extrato_financeiro(
          cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
        ) VALUES (
          v_sol.cliente_id, 'entrada', v_wallet_refund,
          'Estorno de saldo por devolucao (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')',
          p_solicitacao_id, 'gsa_store', v_new_wallet
        );
      END IF;

      -- C. Refund Loyalty Discount Points
      IF coalesce(v_orc.desconto_pontos, 0) > 0 THEN
        v_refunded_points := round(v_orc.desconto_pontos * 100)::integer;
        v_new_points := coalesce(v_cliente.saldo_pontos, 0) + v_refunded_points;

        UPDATE public.clientes
           SET saldo_pontos = v_new_points,
               updated_at = now()
         WHERE id = v_sol.cliente_id;

        INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
        VALUES (
          v_sol.cliente_id, 'estorno', v_refunded_points, v_new_points,
          'Estorno de pontos por devolucao (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')',
          v_orc.desconto_pontos
        );
      END IF;

      -- Anti-Exploit: Clawback points earned on original purchase
      v_earned_points := round(greatest(0, coalesce(v_orc.total, 0)))::integer;
      IF v_earned_points > 0 THEN
        SELECT saldo_pontos INTO v_new_points FROM public.clientes WHERE id = v_sol.cliente_id;
        v_new_points := greatest(0, coalesce(v_new_points, 0) - v_earned_points);

        UPDATE public.clientes
           SET saldo_pontos = v_new_points,
               pontos_totais = greatest(0, coalesce(pontos_totais, 0) - v_earned_points),
               updated_at = now()
         WHERE id = v_sol.cliente_id;

        INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
        VALUES (
          v_sol.cliente_id, 'estorno', -v_earned_points, v_new_points,
          'Revogacao de pontos acumulados por devolucao (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')',
          coalesce(v_orc.total, 0)
        );
      END IF;

      -- Anti-Exploit: Clawback referral commission from referrer
      IF v_cliente.indicador_id IS NOT NULL THEN
        v_ref_bonus := round(least(coalesce(v_orc.subtotal, v_orc.total, 0) * 0.10, 20.00), 2);
        IF v_ref_bonus > 0 THEN
          SELECT * INTO v_indicador FROM public.clientes WHERE id = v_cliente.indicador_id FOR UPDATE;
          IF FOUND THEN
            v_ind_novo_saldo := greatest(0, round(coalesce(v_indicador.saldo_carteira, 0) - v_ref_bonus, 2));
            UPDATE public.clientes
               SET saldo_carteira = v_ind_novo_saldo,
                   updated_at = now()
             WHERE id = v_cliente.indicador_id;

            INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
            VALUES (
              v_cliente.indicador_id, v_ref_bonus, 'debito',
              'Estorno de comissao de indicacao por devolucao do pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text)
            );

            INSERT INTO public.extrato_financeiro(
              cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
            ) VALUES (
              v_cliente.indicador_id, 'saida', v_ref_bonus,
              'Estorno de comissao de indicacao por devolucao', p_solicitacao_id, 'gsa_store', v_ind_novo_saldo
            );
          END IF;
        END IF;
      END IF;

      -- D. Store Credit Amortization vs External Gateway Refund
      SELECT EXISTS (
        SELECT 1
        FROM public.faturas
        WHERE cliente_id = v_sol.cliente_id
          AND is_amortizacao_credito = true
          AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))
      ) INTO v_tem_fatura_credito;

      IF v_tem_fatura_credito THEN
        v_limite_disponivel_novo := coalesce(v_cliente.limite_credito_disponivel, 0) + coalesce(v_orc.total, 0);

        UPDATE public.clientes
           SET limite_credito_disponivel = v_limite_disponivel_novo,
               updated_at = now()
         WHERE id = v_sol.cliente_id;

        UPDATE public.faturas
           SET status = 'cancelado',
               motivo_cancelamento = 'Estornado devido a aprovacao da devolucao/troca #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
               data_cancelamento = now()
         WHERE cliente_id = v_sol.cliente_id
           AND is_amortizacao_credito = true
           AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))
           AND status <> 'pago';

        GET DIAGNOSTICS v_canceladas = ROW_COUNT;

        INSERT INTO public.loja_credito_movimentacoes(
          cliente_id, tipo, valor, limite_total_anterior, limite_total_novo,
          limite_disponivel_anterior, limite_disponivel_novo, descricao
        )
        VALUES (
          v_sol.cliente_id, 'estorno_compra', coalesce(v_orc.total, 0),
          coalesce(v_cliente.limite_credito_total, 0), coalesce(v_cliente.limite_credito_total, 0),
          coalesce(v_cliente.limite_credito_disponivel, 0), v_limite_disponivel_novo,
          'Estorno por Devolucao/Troca Aprovada (Orcamento #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ') [POR: ' || v_actor.ator_nome || ']'
        );
      ELSE
        -- External Gateway / PIX refund tracking
        v_external_refund := round(greatest(0, coalesce(v_orc.total, 0) - v_wallet_refund), 2);
        IF v_external_refund > 0 THEN
          v_refund_code := 'REEMB-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text);

          INSERT INTO public.loja_reembolsos(
            codigo_reembolso, cliente_id, valor_reembolso, motivo_cancelamento,
            prazo_pagamento, status, metodo_reembolso, orcamento_id, solicitacao_id
          ) VALUES (
            v_refund_code, v_sol.cliente_id, v_external_refund,
            'Reembolso por devolucao #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
            now() + interval '3 days', 'pendente',
            coalesce(nullif(v_orc.forma_pagamento_loja, ''), 'pix'),
            v_orc.id, p_solicitacao_id
          ) RETURNING id INTO v_reembolso_id;
        END IF;
      END IF;

      -- Mark estorno as executed for strict idempotency
      UPDATE public.loja_solicitacoes
         SET estorno_executado = true,
             updated_at = now()
       WHERE id = p_solicitacao_id;

      v_estorno_rodou := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'status', v_status_to_save,
    'codigo_solicitacao', v_sol.codigo_solicitacao,
    'valor_diferenca', v_diff,
    'fatura_diferenca_id', v_fatura_id,
    'credito_estornado', v_tem_fatura_credito,
    'estorno_executado', v_estorno_rodou,
    'codigo_orcamento', CASE WHEN v_orc.id IS NOT NULL THEN v_orc.codigo_orcamento ELSE NULL END,
    'total_orcamento', CASE WHEN v_orc.id IS NOT NULL THEN coalesce(v_orc.total, 0) ELSE 0 END,
    'faturas_credito_canceladas', v_canceladas,
    'pontos_estornados', v_refunded_points,
    'pontos_revogados', v_earned_points,
    'saldo_carteira_estornado', v_wallet_refund,
    'reembolso_externo_id', v_reembolso_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_atualizar_solicitacao_loja(uuid, text, uuid, text, text, text, text, text, timestamptz, text) TO anon, authenticated, service_role;
