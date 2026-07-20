CREATE OR REPLACE FUNCTION public.gsa_admin_baixar_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_fatura_id uuid,
  p_metodo text DEFAULT 'manual',
  p_data_pagamento timestamptz DEFAULT now(),
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fatura faturas%rowtype;
  v_valor_pago numeric;
  v_metodo text := coalesce(nullif(trim(p_metodo), ''), 'manual');
  v_data_pagamento timestamptz := coalesce(p_data_pagamento, now());
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = p_fatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura nao encontrada.';
  END IF;

  IF v_fatura.status = 'cancelado' THEN
    RAISE EXCEPTION 'Fatura cancelada nao pode receber baixa.';
  END IF;

  v_valor_pago := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);
  IF v_valor_pago <= 0 THEN
    v_valor_pago := round(coalesce(v_fatura.valor_total, 0), 2);
  END IF;

  IF v_fatura.status = 'pago' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'fatura_id', p_fatura_id,
      'status', 'pago',
      'valor_pago', coalesce(v_fatura.valor_pago, v_valor_pago)
    );
  END IF;

  UPDATE public.faturas
     SET status = 'pago',
         data_pagamento = v_data_pagamento,
         forma_pagamento_escolhida = v_metodo,
         data_escolha_pagamento = v_data_pagamento,
         observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
         valor_pago = v_valor_pago,
         valor_final_pendente = 0
   WHERE id = p_fatura_id;

  INSERT INTO public.pagamentos(fatura_id, metodo, valor, data_pagamento)
  VALUES (p_fatura_id, v_metodo, v_valor_pago, v_data_pagamento);

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'fatura_id', p_fatura_id,
    'status', 'pago',
    'valor_pago', v_valor_pago,
    'metodo', v_metodo,
    'ator_tipo', v_actor.ator_tipo,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_baixar_fatura(uuid, text, uuid, text, timestamptz, text) TO anon, authenticated;
