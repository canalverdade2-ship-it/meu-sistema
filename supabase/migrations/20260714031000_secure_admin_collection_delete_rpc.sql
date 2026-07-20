CREATE OR REPLACE FUNCTION public.gsa_admin_excluir_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cobranca cobrancas%rowtype;
  v_fatura_ref text;
  v_faturas_canceladas integer := 0;
  v_historicos_removidos integer := 0;
  v_parcelas_removidas integer := 0;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_cobranca
  FROM public.cobrancas
  WHERE id = p_cobranca_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_deleted', true, 'cobranca_id', p_cobranca_id);
  END IF;

  SELECT coalesce(codigo_fatura, v_cobranca.fatura_id::text)
    INTO v_fatura_ref
  FROM public.faturas
  WHERE id = v_cobranca.fatura_id;

  v_fatura_ref := coalesce(v_fatura_ref, left(p_cobranca_id::text, 8));

  UPDATE public.faturas
     SET status = 'cancelado',
         observacoes = 'Acordo excluido pelo administrador. [POR: ' || v_actor.ator_nome || ']'
   WHERE cliente_id = v_cobranca.cliente_id
     AND observacoes ILIKE ('%' || v_fatura_ref || '%')
     AND status IN ('pendente', 'vencida', 'pendente_pagamento');

  GET DIAGNOSTICS v_faturas_canceladas = ROW_COUNT;

  DELETE FROM public.cobranca_historico
   WHERE cobranca_id = p_cobranca_id;
  GET DIAGNOSTICS v_historicos_removidos = ROW_COUNT;

  DELETE FROM public.cobranca_acordo_parcelas
   WHERE cobranca_id = p_cobranca_id;
  GET DIAGNOSTICS v_parcelas_removidas = ROW_COUNT;

  DELETE FROM public.cobrancas
   WHERE id = p_cobranca_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_deleted', false,
    'cobranca_id', p_cobranca_id,
    'faturas_canceladas', v_faturas_canceladas,
    'historicos_removidos', v_historicos_removidos,
    'parcelas_removidas', v_parcelas_removidas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_excluir_cobranca(uuid, text, uuid) TO anon, authenticated;
