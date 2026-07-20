CREATE OR REPLACE FUNCTION public.gsa_admin_enviar_oferta_quitacao_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid,
  p_valor_quitacao_acordo numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_orc orcamentos%rowtype;
  v_valor numeric := round(coalesce(p_valor_quitacao_acordo, 0), 2);
BEGIN
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor da oferta de quitacao deve ser maior que zero.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE id = p_orcamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido para quitacao nao encontrado.';
  END IF;

  IF coalesce(v_orc.status_quitacao_credito, '') <> 'analise_quitacao' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'orcamento_id', v_orc.id,
      'cliente_id', v_orc.cliente_id,
      'codigo_orcamento', v_orc.codigo_orcamento,
      'status_quitacao_credito', v_orc.status_quitacao_credito
    );
  END IF;

  UPDATE public.orcamentos
     SET status_quitacao_credito = 'aguardando_pagamento_quitacao',
         valor_quitacao_acordo = v_valor
   WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'orcamento_id', v_orc.id,
    'cliente_id', v_orc.cliente_id,
    'codigo_orcamento', v_orc.codigo_orcamento,
    'status_quitacao_credito', 'aguardando_pagamento_quitacao',
    'valor_quitacao_acordo', v_valor,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_enviar_oferta_quitacao_credito(uuid, text, uuid, numeric) TO anon, authenticated;
