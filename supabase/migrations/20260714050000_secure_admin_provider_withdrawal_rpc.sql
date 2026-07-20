CREATE OR REPLACE FUNCTION public.gsa_admin_processar_saque_prestador(
  p_sessao_id uuid,
  p_session_token text,
  p_saque_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_saque prestador_saques%rowtype;
  v_acao text := lower(trim(coalesce(p_acao, '')));
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_descricao text;
  v_transacao_id uuid;
BEGIN
  IF v_acao NOT IN ('aprovar', 'rejeitar') THEN
    RAISE EXCEPTION 'Acao invalida para saque de prestador.';
  END IF;

  IF v_acao = 'rejeitar' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeicao.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_saque
  FROM public.prestador_saques
  WHERE id = p_saque_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque de prestador nao encontrado.';
  END IF;

  IF v_acao = 'aprovar' THEN
    IF v_saque.status = 'pago' THEN
      RETURN jsonb_build_object('success', true, 'already_processed', true, 'saque_id', p_saque_id, 'prestador_id', v_saque.prestador_id, 'status', v_saque.status);
    END IF;

    UPDATE public.prestador_saques
       SET status = 'pago',
           data_pagamento = coalesce(p_data_pagamento, current_date)::timestamptz,
           updated_at = now()
     WHERE id = p_saque_id;

    RETURN jsonb_build_object('success', true, 'already_processed', false, 'saque_id', p_saque_id, 'prestador_id', v_saque.prestador_id, 'status', 'pago', 'valor', v_saque.valor, 'ator_nome', v_actor.ator_nome);
  END IF;

  IF v_saque.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'saque_id', p_saque_id, 'prestador_id', v_saque.prestador_id, 'status', v_saque.status);
  END IF;

  UPDATE public.prestador_saques
     SET status = 'cancelado',
         observacao = v_motivo,
         updated_at = now()
   WHERE id = p_saque_id;

  v_descricao := 'Estorno de saque rejeitado (' || substr(p_saque_id::text, 1, 8) || ')';

  SELECT id INTO v_transacao_id
  FROM public.prestador_transacoes
  WHERE prestador_id = v_saque.prestador_id
    AND tipo = 'credito'
    AND valor = v_saque.valor
    AND descricao = v_descricao
  LIMIT 1;

  IF v_transacao_id IS NULL THEN
    INSERT INTO public.prestador_transacoes(
      prestador_id,
      tipo,
      valor,
      descricao,
      status
    )
    VALUES (
      v_saque.prestador_id,
      'credito',
      v_saque.valor,
      v_descricao,
      'concluido'
    )
    RETURNING id INTO v_transacao_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'saque_id', p_saque_id,
    'prestador_id', v_saque.prestador_id,
    'status', 'cancelado',
    'valor', v_saque.valor,
    'transacao_id', v_transacao_id,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_saque_prestador(uuid, text, uuid, text, text, date) TO anon, authenticated;
