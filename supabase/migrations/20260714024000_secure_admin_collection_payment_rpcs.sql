CREATE OR REPLACE FUNCTION public.gsa_mark_promotion_usage_for_invoice(p_fatura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura faturas%rowtype;
  v_orcamento_id uuid;
  v_promocao_id uuid;
  v_ativacao_id uuid;
BEGIN
  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = p_fatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invoice_not_found');
  END IF;

  IF v_fatura.os_id IS NOT NULL THEN
    SELECT os.orcamento_id, o.promocao_id
      INTO v_orcamento_id, v_promocao_id
    FROM public.ordens_servico os
    LEFT JOIN public.orcamentos o ON o.id = os.orcamento_id
    WHERE os.id = v_fatura.os_id
    LIMIT 1;
  ELSIF v_fatura.ordem_compra_id IS NOT NULL THEN
    SELECT oc.orcamento_id, o.promocao_id
      INTO v_orcamento_id, v_promocao_id
    FROM public.ordens_compra oc
    LEFT JOIN public.orcamentos o ON o.id = oc.orcamento_id
    WHERE oc.id = v_fatura.ordem_compra_id
    LIMIT 1;
  ELSIF v_fatura.ordem_assinatura_id IS NOT NULL THEN
    SELECT oa.orcamento_id, o.promocao_id
      INTO v_orcamento_id, v_promocao_id
    FROM public.ordens_assinatura oa
    LEFT JOIN public.orcamentos o ON o.id = oa.orcamento_id
    WHERE oa.id = v_fatura.ordem_assinatura_id
    LIMIT 1;
  END IF;

  IF v_orcamento_id IS NULL OR v_promocao_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'used', false, 'reason', 'no_linked_promotion');
  END IF;

  SELECT id INTO v_ativacao_id
  FROM public.cliente_promocoes
  WHERE orcamento_id = v_orcamento_id
    AND status = 'ativa'
  ORDER BY data_ativacao ASC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_ativacao_id IS NULL THEN
    SELECT id INTO v_ativacao_id
    FROM public.cliente_promocoes
    WHERE cliente_id = v_fatura.cliente_id
      AND promocao_id = v_promocao_id
      AND status = 'ativa'
    ORDER BY data_ativacao ASC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_ativacao_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'used', false, 'reason', 'no_active_promotion');
  END IF;

  UPDATE public.cliente_promocoes
     SET status = 'usada',
         data_uso = now(),
         orcamento_id = v_orcamento_id
   WHERE id = v_ativacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'used', true,
    'cliente_promocao_id', v_ativacao_id,
    'orcamento_id', v_orcamento_id,
    'promocao_id', v_promocao_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_baixar_parcela_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_parcela_id uuid,
  p_data_pagamento date DEFAULT current_date,
  p_forma_pagamento text DEFAULT 'pix'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_parcela cobranca_acordo_parcelas%rowtype;
  v_cobranca cobrancas%rowtype;
  v_fatura_filha faturas%rowtype;
  v_data_pagamento timestamptz := coalesce(p_data_pagamento, current_date)::timestamptz;
  v_forma text := coalesce(nullif(trim(p_forma_pagamento), ''), 'pix');
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_parcela
  FROM public.cobranca_acordo_parcelas
  WHERE id = p_parcela_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela nao encontrada.';
  END IF;

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = v_parcela.cobranca_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobranca da parcela nao encontrada.';
  END IF;

  IF v_parcela.status = 'pago' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'parcela_id', p_parcela_id,
      'cobranca_id', v_cobranca.id,
      'fatura_id', null
    );
  END IF;

  UPDATE public.cobranca_acordo_parcelas
     SET status = 'pago',
         data_pagamento = v_data_pagamento,
         forma_pagamento = v_forma
   WHERE id = p_parcela_id;

  SELECT * INTO v_fatura_filha
  FROM public.faturas
  WHERE cliente_id = v_cobranca.cliente_id
    AND valor_total = v_parcela.valor_parcela
    AND observacoes ILIKE ('%Parcela ' || v_parcela.numero_parcela || '/%')
    AND status = 'pendente'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.faturas
       SET status = 'pago',
           data_pagamento = v_data_pagamento,
           forma_pagamento_escolhida = v_forma,
           data_escolha_pagamento = v_data_pagamento,
           valor_pago = v_parcela.valor_parcela,
           valor_final_pendente = 0
     WHERE id = v_fatura_filha.id;

    IF NOT EXISTS (SELECT 1 FROM public.pagamentos WHERE fatura_id = v_fatura_filha.id) THEN
      INSERT INTO public.pagamentos(fatura_id, metodo, valor, data_pagamento)
      VALUES (v_fatura_filha.id, v_forma, v_parcela.valor_parcela, v_data_pagamento);
    END IF;

    PERFORM public.gsa_mark_promotion_usage_for_invoice(v_fatura_filha.id);
  END IF;

  UPDATE public.cobrancas
     SET valor_pago = coalesce(valor_pago, 0) + coalesce(v_parcela.valor_parcela, 0)
   WHERE id = v_cobranca.id;

  INSERT INTO public.cobranca_historico(
    cobranca_id, tipo_acao, descricao, canal, valor_envolvido
  )
  VALUES (
    v_cobranca.id,
    'pagamento',
    'Baixa da parcela ' || v_parcela.numero_parcela || ' realizada manualmente. Metodo: ' || upper(v_forma) || ' [POR: ' || v_actor.ator_nome || ']',
    'sistema',
    v_parcela.valor_parcela
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'parcela_id', p_parcela_id,
    'cobranca_id', v_cobranca.id,
    'fatura_id', v_fatura_filha.id,
    'valor_pago', v_parcela.valor_parcela
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_baixar_cobranca_manual(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid,
  p_valor_pago numeric,
  p_data_pagamento date DEFAULT current_date,
  p_forma_pagamento text DEFAULT 'pix'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cobranca cobrancas%rowtype;
  v_data_pagamento timestamptz := coalesce(p_data_pagamento, current_date)::timestamptz;
  v_forma text := coalesce(nullif(trim(p_forma_pagamento), ''), 'pix');
  v_valor_pago numeric := round(coalesce(p_valor_pago, 0), 2);
  v_fatura_protesto faturas%rowtype;
BEGIN
  IF v_valor_pago <= 0 THEN
    RAISE EXCEPTION 'Valor pago deve ser maior que zero.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobranca nao encontrada.';
  END IF;

  IF v_cobranca.status = 'quitado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'cobranca_id', p_cobranca_id,
      'valor_pago', coalesce(v_cobranca.valor_pago, v_valor_pago)
    );
  END IF;

  UPDATE public.cobrancas
     SET status = 'quitado',
         nivel_cobranca = v_cobranca.nivel_cobranca,
         valor_pago = v_valor_pago
   WHERE id = p_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal, valor_envolvido)
  VALUES (
    p_cobranca_id,
    'pagamento',
    'Baixa manual concluida. Valor: ' || to_char(v_valor_pago, 'FM999999999990D00') || ' - Metodo: ' || upper(v_forma) || ' em ' || to_char(v_data_pagamento::date, 'DD/MM/YYYY') || ' [POR: ' || v_actor.ator_nome || ']',
    'sistema',
    v_valor_pago
  );

  IF v_cobranca.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
       SET status = 'pago',
           data_pagamento = v_data_pagamento,
           forma_pagamento_escolhida = v_forma,
           data_escolha_pagamento = v_data_pagamento,
           valor_pago = v_valor_pago,
           valor_final_pendente = 0
     WHERE id = v_cobranca.fatura_id
       AND status <> 'pago';

    IF NOT EXISTS (SELECT 1 FROM public.pagamentos WHERE fatura_id = v_cobranca.fatura_id) THEN
      INSERT INTO public.pagamentos(fatura_id, metodo, valor, data_pagamento)
      VALUES (v_cobranca.fatura_id, v_forma, v_valor_pago, v_data_pagamento);
    END IF;

    PERFORM public.gsa_mark_promotion_usage_for_invoice(v_cobranca.fatura_id);
  END IF;

  FOR v_fatura_protesto IN
    SELECT *
    FROM public.faturas
    WHERE cliente_id = v_cobranca.cliente_id
      AND status = 'protestado'
      AND valor_total = v_cobranca.valor_atualizado
    FOR UPDATE
  LOOP
    UPDATE public.faturas
       SET status = 'pago',
           data_pagamento = v_data_pagamento,
           forma_pagamento_escolhida = v_forma,
           data_escolha_pagamento = v_data_pagamento,
           valor_pago = v_cobranca.valor_atualizado,
           valor_final_pendente = 0
     WHERE id = v_fatura_protesto.id;

    IF NOT EXISTS (SELECT 1 FROM public.pagamentos WHERE fatura_id = v_fatura_protesto.id) THEN
      INSERT INTO public.pagamentos(fatura_id, metodo, valor, data_pagamento)
      VALUES (v_fatura_protesto.id, v_forma, v_cobranca.valor_atualizado, v_data_pagamento);
    END IF;

    PERFORM public.gsa_mark_promotion_usage_for_invoice(v_fatura_protesto.id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cobranca_id', p_cobranca_id,
    'valor_pago', v_valor_pago
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_mark_promotion_usage_for_invoice(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_baixar_parcela_cobranca(uuid, text, uuid, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_baixar_cobranca_manual(uuid, text, uuid, numeric, date, text) TO anon, authenticated;
