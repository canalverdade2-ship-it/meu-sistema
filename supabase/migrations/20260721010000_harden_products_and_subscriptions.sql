-- Proteções transacionais para Produtos e Assinaturas.

CREATE TABLE IF NOT EXISTS public.gsa_admin_operation_requests (
  request_id UUID PRIMARY KEY,
  actor_id UUID NOT NULL,
  actor_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_id UUID,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS nome_produto_contratado TEXT,
  ADD COLUMN IF NOT EXISTS valor_unitario_contratado NUMERIC,
  ADD COLUMN IF NOT EXISTS estoque_estornado_em TIMESTAMPTZ;

ALTER TABLE public.ordens_assinatura
  ADD COLUMN IF NOT EXISTS nome_assinatura_contratada TEXT,
  ADD COLUMN IF NOT EXISTS valor_mensal_contratado NUMERIC;

UPDATE public.ordens_compra oc
SET nome_produto_contratado = COALESCE(oc.nome_produto_contratado, p.nome),
    valor_unitario_contratado = COALESCE(oc.valor_unitario_contratado, p.valor)
FROM public.produtos p
WHERE p.id = oc.produto_id
  AND (oc.nome_produto_contratado IS NULL OR oc.valor_unitario_contratado IS NULL);

UPDATE public.ordens_assinatura oa
SET nome_assinatura_contratada = COALESCE(oa.nome_assinatura_contratada, a.nome),
    valor_mensal_contratado = COALESCE(oa.valor_mensal_contratado, a.valor)
FROM public.assinaturas a
WHERE a.id = oa.assinatura_id
  AND (oa.nome_assinatura_contratada IS NULL OR oa.valor_mensal_contratado IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_valor_positivo') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_valor_positivo CHECK (valor > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_custo_nao_negativo') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_custo_nao_negativo CHECK (COALESCE(valor_custo, 0) >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_margem_nao_negativa') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_margem_nao_negativa CHECK (COALESCE(porcentagem_lucro, 0) >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_estoque_nao_negativo') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_estoque_nao_negativo CHECK (COALESCE(estoque_disponivel, 0) >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assinaturas_valor_positivo') THEN
    ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_valor_positivo CHECK (valor > 0) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_require_admin_actor(
  p_sessao_id UUID,
  p_session_token TEXT
)
RETURNS TABLE(actor_id UUID, actor_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() NOT IN ('admin', 'colaborador')
     OR public.gsa_jwt_actor_id() IS NULL THEN
    RAISE EXCEPTION 'Sessão administrativa inválida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.gsa_validate_session(p_sessao_id, p_session_token) session_state
    WHERE session_state.is_valid
  ) THEN
    RAISE EXCEPTION 'Sessão administrativa expirada.';
  END IF;

  RETURN QUERY SELECT public.gsa_jwt_actor_id(), public.gsa_jwt_actor_type();
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_snapshot_store_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_nome TEXT;
  v_valor NUMERIC;
BEGIN
  IF NEW.produto_id IS NOT NULL THEN
    SELECT nome,
           CASE
             WHEN desconto_ativo
              AND valor_promocional IS NOT NULL
              AND valor_promocional > 0
              AND valor_promocional < valor
              AND (desconto_prazo_tipo <> 'determinado' OR desconto_fim_em IS NULL OR desconto_fim_em > NOW())
             THEN valor_promocional
             ELSE valor
           END
    INTO v_nome, v_valor
    FROM public.produtos
    WHERE id = NEW.produto_id;
    NEW.nome_produto_contratado := COALESCE(NEW.nome_produto_contratado, v_nome);
    NEW.valor_unitario_contratado := COALESCE(NEW.valor_unitario_contratado, v_valor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_snapshot_store_order ON public.ordens_compra;
CREATE TRIGGER trg_gsa_snapshot_store_order
BEFORE INSERT ON public.ordens_compra
FOR EACH ROW EXECUTE FUNCTION public.gsa_snapshot_store_order();

CREATE OR REPLACE FUNCTION public.gsa_snapshot_subscription_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_nome TEXT;
  v_valor NUMERIC;
BEGIN
  IF NEW.assinatura_id IS NOT NULL THEN
    SELECT nome, valor INTO v_nome, v_valor
    FROM public.assinaturas
    WHERE id = NEW.assinatura_id;
    NEW.nome_assinatura_contratada := COALESCE(NEW.nome_assinatura_contratada, v_nome);
    NEW.valor_mensal_contratado := COALESCE(NEW.valor_mensal_contratado, v_valor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_snapshot_subscription_order ON public.ordens_assinatura;
CREATE TRIGGER trg_gsa_snapshot_subscription_order
BEFORE INSERT ON public.ordens_assinatura
FOR EACH ROW EXECUTE FUNCTION public.gsa_snapshot_subscription_order();

CREATE OR REPLACE FUNCTION public.gsa_admin_adjust_product_stock(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_request_id UUID,
  p_produto_id UUID,
  p_tipo TEXT,
  p_quantidade INTEGER,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_existing JSONB;
  v_produto public.produtos%ROWTYPE;
  v_delta INTEGER;
  v_novo INTEGER;
  v_result JSONB;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);
  SELECT result INTO v_existing FROM public.gsa_admin_operation_requests WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('already_processed', true);
  END IF;
  IF p_tipo NOT IN ('entrada', 'saida') OR p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Ajuste de estoque inválido.';
  END IF;
  IF NULLIF(BTRIM(p_motivo), '') IS NULL THEN
    RAISE EXCEPTION 'O motivo do ajuste é obrigatório.';
  END IF;

  SELECT * INTO v_produto FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;
  IF NOT COALESCE(v_produto.controle_estoque, false) THEN
    RAISE EXCEPTION 'O controle de estoque não está ativo para este produto.';
  END IF;

  v_delta := CASE WHEN p_tipo = 'entrada' THEN p_quantidade ELSE -p_quantidade END;
  v_novo := COALESCE(v_produto.estoque_disponivel, 0) + v_delta;
  IF v_novo < 0 THEN RAISE EXCEPTION 'O estoque não pode ficar negativo.'; END IF;

  UPDATE public.produtos SET estoque_disponivel = v_novo WHERE id = p_produto_id;
  INSERT INTO public.loja_estoque_historico (
    produto_id, quantidade_anterior, ajuste, quantidade_atual, motivo, colaborador_nome
  ) VALUES (
    p_produto_id, COALESCE(v_produto.estoque_disponivel, 0), v_delta, v_novo,
    BTRIM(p_motivo), COALESCE(v_actor.actor_type, 'admin')
  );

  v_result := jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'quantidade_anterior', COALESCE(v_produto.estoque_disponivel, 0),
    'quantidade_atual', v_novo
  );
  INSERT INTO public.gsa_admin_operation_requests(request_id, actor_id, actor_type, operation, resource_id, result)
  VALUES (p_request_id, v_actor.actor_id, v_actor.actor_type, 'adjust_product_stock', p_produto_id, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_transition_store_order(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_request_id UUID,
  p_ordem_compra_id UUID,
  p_novo_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_existing JSONB;
  v_ordem public.ordens_compra%ROWTYPE;
  v_allowed BOOLEAN := false;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);
  SELECT result INTO v_existing FROM public.gsa_admin_operation_requests WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing || jsonb_build_object('already_processed', true); END IF;
  IF p_novo_status = 'cancelado' THEN RAISE EXCEPTION 'Use a operação segura de cancelamento.'; END IF;

  SELECT * INTO v_ordem FROM public.ordens_compra WHERE id = p_ordem_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de compra não encontrada.'; END IF;

  v_allowed := CASE
    WHEN v_ordem.status = p_novo_status THEN true
    WHEN v_ordem.status = 'em_analise' AND p_novo_status IN ('pago', 'em_expedicao') THEN true
    WHEN v_ordem.status IN ('pago', 'aprovado') AND p_novo_status = 'em_expedicao' THEN true
    WHEN v_ordem.status = 'em_expedicao' AND p_novo_status = 'em_transporte' THEN true
    WHEN v_ordem.status = 'em_transporte' AND p_novo_status = 'concluido' THEN true
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transição inválida de % para %.', v_ordem.status, p_novo_status;
  END IF;

  UPDATE public.ordens_compra
  SET status = p_novo_status,
      data_conclusao = CASE WHEN p_novo_status = 'concluido' THEN v_now ELSE data_conclusao END,
      motivo_cancelamento = NULL
  WHERE id = p_ordem_compra_id;

  IF v_ordem.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos
    SET status = p_novo_status,
        status_entrega = CASE p_novo_status
          WHEN 'pago' THEN 'pagamento_aprovado'
          WHEN 'em_expedicao' THEN 'separacao'
          WHEN 'em_transporte' THEN 'em_transito'
          WHEN 'concluido' THEN 'entregue'
          ELSE status_entrega
        END,
        data_pagamento_aprovado = CASE WHEN p_novo_status IN ('pago','em_expedicao','em_transporte','concluido') THEN COALESCE(data_pagamento_aprovado, v_now) ELSE data_pagamento_aprovado END,
        data_separacao = CASE WHEN p_novo_status IN ('em_expedicao','em_transporte','concluido') THEN COALESCE(data_separacao, v_now) ELSE data_separacao END,
        data_envio = CASE WHEN p_novo_status IN ('em_transporte','concluido') THEN COALESCE(data_envio, v_now) ELSE data_envio END,
        data_entrega = CASE WHEN p_novo_status = 'concluido' THEN COALESCE(data_entrega, v_now) ELSE data_entrega END
    WHERE id = v_ordem.orcamento_id;
  END IF;

  INSERT INTO public.notificacoes(cliente_id, destinatario_tipo, titulo, mensagem, modulo, tipo, lida, data_criacao)
  VALUES (
    v_ordem.cliente_id, 'cliente', 'Atualização do pedido',
    format('Seu pedido foi atualizado para o status %s.', replace(p_novo_status, '_', ' ')),
    'produtos', 'ordem_' || p_novo_status, false, v_now
  );

  v_result := jsonb_build_object('success', true, 'ordem_id', p_ordem_compra_id, 'status', p_novo_status);
  INSERT INTO public.gsa_admin_operation_requests(request_id, actor_id, actor_type, operation, resource_id, result)
  VALUES (p_request_id, v_actor.actor_id, v_actor.actor_type, 'transition_store_order', p_ordem_compra_id, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancel_store_order(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_request_id UUID,
  p_ordem_compra_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_existing JSONB;
  v_ordem public.ordens_compra%ROWTYPE;
  v_item public.ordens_compra%ROWTYPE;
  v_orcamento public.orcamentos%ROWTYPE;
  v_codigo TEXT;
  v_points NUMERIC := 0;
  v_wallet NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_credit BOOLEAN := false;
  v_refund_created BOOLEAN := false;
  v_result JSONB;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);
  SELECT result INTO v_existing FROM public.gsa_admin_operation_requests WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing || jsonb_build_object('already_processed', true); END IF;
  IF NULLIF(BTRIM(p_motivo), '') IS NULL THEN RAISE EXCEPTION 'O motivo do cancelamento é obrigatório.'; END IF;

  SELECT * INTO v_ordem FROM public.ordens_compra WHERE id = p_ordem_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de compra não encontrada.'; END IF;
  IF v_ordem.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'ordem_id', p_ordem_compra_id);
  END IF;

  IF v_ordem.orcamento_id IS NOT NULL THEN
    SELECT * INTO v_orcamento FROM public.orcamentos WHERE id = v_ordem.orcamento_id FOR UPDATE;
    v_codigo := v_orcamento.codigo_orcamento;
  ELSE
    v_codigo := v_ordem.codigo_ordem;
  END IF;

  FOR v_item IN
    SELECT * FROM public.ordens_compra
    WHERE id = p_ordem_compra_id OR (v_ordem.orcamento_id IS NOT NULL AND orcamento_id = v_ordem.orcamento_id)
    FOR UPDATE
  LOOP
    IF v_item.status <> 'cancelado' AND v_item.estoque_estornado_em IS NULL THEN
      UPDATE public.produtos
      SET estoque_disponivel = COALESCE(estoque_disponivel, 0) + COALESCE(v_item.quantidade, 1)
      WHERE id = v_item.produto_id AND COALESCE(controle_estoque, false);

      IF FOUND THEN
        INSERT INTO public.loja_estoque_historico(
          produto_id, quantidade_anterior, ajuste, quantidade_atual, motivo, colaborador_nome
        )
        SELECT p.id,
               COALESCE(p.estoque_disponivel, 0) - COALESCE(v_item.quantidade, 1),
               COALESCE(v_item.quantidade, 1),
               COALESCE(p.estoque_disponivel, 0),
               format('Estorno do pedido %s: %s', v_codigo, BTRIM(p_motivo)),
               COALESCE(v_actor.actor_type, 'admin')
        FROM public.produtos p WHERE p.id = v_item.produto_id;
      END IF;
    END IF;
  END LOOP;

  IF v_codigo IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(pontos)), 0) INTO v_points
    FROM public.points_transactions
    WHERE cliente_id = v_ordem.cliente_id
      AND tipo = 'resgate'
      AND pontos < 0
      AND descricao LIKE '%' || v_codigo || '%';

    IF v_points = 0 THEN
      SELECT COALESCE(SUM(ABS(pontos)), 0) INTO v_points
      FROM public.pontos_movimentacoes
      WHERE cliente_id = v_ordem.cliente_id
        AND tipo = 'uso_fatura'
        AND pontos < 0
        AND descricao LIKE '%' || v_codigo || '%';
    END IF;
  END IF;

  IF v_points > 0 THEN
    UPDATE public.clientes SET saldo_pontos = COALESCE(saldo_pontos, 0) + v_points WHERE id = v_ordem.cliente_id;
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_ordem.cliente_id, 'estorno', v_points, format('Estorno do pedido %s', v_codigo));
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    SELECT id, 'estorno', v_points, saldo_pontos, format('Estorno do pedido %s', v_codigo)
    FROM public.clientes WHERE id = v_ordem.cliente_id;
  END IF;

  SELECT COALESCE(SUM(COALESCE(abatimento_carteira_aplicado, 0)), 0),
         COALESCE(SUM(CASE WHEN status = 'pago' THEN COALESCE(NULLIF(valor_pago, 0), valor_total) ELSE 0 END), 0)
  INTO v_wallet, v_paid
  FROM public.faturas
  WHERE ordem_compra_id IN (
    SELECT id FROM public.ordens_compra
    WHERE id = p_ordem_compra_id OR (v_ordem.orcamento_id IS NOT NULL AND orcamento_id = v_ordem.orcamento_id)
  );

  IF v_wallet > 0 THEN
    UPDATE public.clientes SET saldo_carteira = COALESCE(saldo_carteira, 0) + v_wallet WHERE id = v_ordem.cliente_id;
  END IF;

  IF v_codigo IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.faturas f
      WHERE f.cliente_id = v_ordem.cliente_id
        AND COALESCE(f.is_amortizacao_credito, false)
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(f.itens_faturados, '[]'::jsonb)) item
          WHERE item->>'codigo' = 'CRE-' || v_codigo
        )
    ) INTO v_credit;
  END IF;

  IF v_credit AND v_ordem.orcamento_id IS NOT NULL THEN
    UPDATE public.clientes
    SET limite_credito_disponivel = LEAST(
      COALESCE(limite_credito_total, 0),
      COALESCE(limite_credito_disponivel, 0) + COALESCE(v_orcamento.total, 0)
    )
    WHERE id = v_ordem.cliente_id;

    UPDATE public.faturas f
    SET status = 'cancelado',
        valor_final_pendente = 0,
        motivo_cancelamento = format('Cancelada pelo estorno da compra %s', v_codigo),
        data_cancelamento = NOW()
    WHERE f.cliente_id = v_ordem.cliente_id
      AND f.status <> 'pago'
      AND COALESCE(f.is_amortizacao_credito, false)
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(f.itens_faturados, '[]'::jsonb)) item
        WHERE item->>'codigo' = 'CRE-' || v_codigo
      );
  END IF;

  UPDATE public.faturas
  SET status = 'cancelado',
      valor_final_pendente = 0,
      motivo_cancelamento = format('Compra cancelada: %s', BTRIM(p_motivo)),
      data_cancelamento = NOW()
  WHERE ordem_compra_id IN (
    SELECT id FROM public.ordens_compra
    WHERE id = p_ordem_compra_id OR (v_ordem.orcamento_id IS NOT NULL AND orcamento_id = v_ordem.orcamento_id)
  )
  AND status <> 'pago';

  IF v_paid > 0 AND NOT EXISTS (
    SELECT 1 FROM public.loja_reembolsos
    WHERE ordem_compra_id = p_ordem_compra_id AND status IN ('pendente', 'processando', 'pago')
  ) THEN
    INSERT INTO public.loja_reembolsos(
      ordem_compra_id, cliente_id, valor_reembolso, motivo_cancelamento, prazo_pagamento, status
    ) VALUES (
      p_ordem_compra_id, v_ordem.cliente_id, v_paid, BTRIM(p_motivo), NOW() + INTERVAL '10 days', 'pendente'
    );
    v_refund_created := true;
  END IF;

  UPDATE public.ordens_compra
  SET status = 'cancelado',
      motivo_cancelamento = BTRIM(p_motivo),
      estoque_estornado_em = COALESCE(estoque_estornado_em, NOW()),
      data_conclusao = NULL
  WHERE id = p_ordem_compra_id
     OR (v_ordem.orcamento_id IS NOT NULL AND orcamento_id = v_ordem.orcamento_id);

  IF v_ordem.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos
    SET status = 'cancelado', status_entrega = 'cancelado'
    WHERE id = v_ordem.orcamento_id;

    BEGIN
      PERFORM public.gsa_admin_release_discount_quota(
        p_sessao_id,
        p_session_token,
        v_ordem.orcamento_id
      );
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.notificacoes(cliente_id, destinatario_tipo, titulo, mensagem, modulo, tipo, lida, data_criacao)
  VALUES (
    v_ordem.cliente_id, 'cliente', 'Compra cancelada',
    CASE WHEN v_refund_created
      THEN format('A compra %s foi cancelada e um reembolso foi aberto.', v_codigo)
      ELSE format('A compra %s foi cancelada e os saldos aplicáveis foram restaurados.', v_codigo)
    END,
    'produtos', 'ordem_cancelada', false, NOW()
  );

  v_result := jsonb_build_object(
    'success', true,
    'ordem_id', p_ordem_compra_id,
    'orcamento_id', v_ordem.orcamento_id,
    'points_refunded', v_points,
    'wallet_refunded', v_wallet,
    'refund_created', v_refund_created,
    'refund_value', v_paid,
    'credit_restored', v_credit
  );
  INSERT INTO public.gsa_admin_operation_requests(request_id, actor_id, actor_type, operation, resource_id, result)
  VALUES (p_request_id, v_actor.actor_id, v_actor.actor_type, 'cancel_store_order', p_ordem_compra_id, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_activate_subscription(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_request_id UUID,
  p_ordem_assinatura_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_existing JSONB;
  v_ordem public.ordens_assinatura%ROWTYPE;
  v_nome TEXT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);
  SELECT result INTO v_existing FROM public.gsa_admin_operation_requests WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing || jsonb_build_object('already_processed', true); END IF;

  SELECT * INTO v_ordem FROM public.ordens_assinatura WHERE id = p_ordem_assinatura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de assinatura não encontrada.'; END IF;
  IF v_ordem.status = 'concluido' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'ordem_id', p_ordem_assinatura_id);
  END IF;
  IF v_ordem.status NOT IN ('em_analise', 'pendente', 'pago') THEN
    RAISE EXCEPTION 'A assinatura não pode ser ativada no estado atual.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.faturas WHERE ordem_assinatura_id = p_ordem_assinatura_id)
     AND NOT EXISTS (SELECT 1 FROM public.faturas WHERE ordem_assinatura_id = p_ordem_assinatura_id AND status = 'pago') THEN
    RAISE EXCEPTION 'A assinatura possui cobrança, mas nenhuma fatura paga.';
  END IF;

  SELECT nome INTO v_nome FROM public.assinaturas WHERE id = v_ordem.assinatura_id;
  UPDATE public.ordens_assinatura
  SET status = 'concluido',
      motivo_cancelamento = NULL,
      data_cancelamento = NULL,
      data_conclusao = NOW()
  WHERE id = p_ordem_assinatura_id;

  INSERT INTO public.notificacoes(cliente_id, destinatario_tipo, titulo, mensagem, modulo, tipo, lida, data_criacao)
  VALUES (
    v_ordem.cliente_id, 'cliente', 'Assinatura ativada',
    format('Sua assinatura %s foi ativada com sucesso.', COALESCE(v_nome, 'contratada')),
    'assinaturas', 'assinatura_criada', false, NOW()
  );

  v_result := jsonb_build_object('success', true, 'ordem_id', p_ordem_assinatura_id, 'status', 'concluido');
  INSERT INTO public.gsa_admin_operation_requests(request_id, actor_id, actor_type, operation, resource_id, result)
  VALUES (p_request_id, v_actor.actor_id, v_actor.actor_type, 'activate_subscription', p_ordem_assinatura_id, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_process_due_subscription_cancellations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_order IN
    SELECT id, cliente_id
    FROM public.ordens_assinatura
    WHERE status = 'em_cancelamento'
      AND data_cancelamento IS NOT NULL
      AND data_cancelamento::DATE <= CURRENT_DATE
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.ordens_assinatura SET status = 'cancelado' WHERE id = v_order.id;
    UPDATE public.faturas
    SET status = 'cancelado', valor_final_pendente = 0,
        motivo_cancelamento = 'Cancelamento programado da assinatura', data_cancelamento = NOW()
    WHERE ordem_assinatura_id = v_order.id
      AND status <> 'pago'
      AND data_vencimento::DATE > CURRENT_DATE;
    INSERT INTO public.notificacoes(cliente_id, destinatario_tipo, titulo, mensagem, modulo, tipo, lida, data_criacao)
    VALUES (v_order.cliente_id, 'cliente', 'Assinatura encerrada', 'O cancelamento programado da sua assinatura foi concluído.', 'assinaturas', 'assinatura_cancelada', false, NOW());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'gsa-process-due-subscription-cancellations';
    PERFORM cron.schedule(
      'gsa-process-due-subscription-cancellations',
      '15 * * * *',
      'SELECT public.gsa_process_due_subscription_cancellations();'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_require_admin_actor(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_snapshot_store_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_snapshot_subscription_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_process_due_subscription_cancellations() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_admin_adjust_product_stock(UUID, TEXT, UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_transition_store_order(UUID, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_cancel_store_order(UUID, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_activate_subscription(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_adjust_product_stock(UUID, TEXT, UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_transition_store_order(UUID, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancel_store_order(UUID, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_activate_subscription(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_process_due_subscription_cancellations() TO service_role;
