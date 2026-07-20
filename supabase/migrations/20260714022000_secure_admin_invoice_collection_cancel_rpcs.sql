CREATE OR REPLACE FUNCTION public.gsa_admin_enviar_fatura_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_fatura_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fatura faturas%rowtype;
  v_cobranca_id uuid;
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
    RAISE EXCEPTION 'Fatura cancelada nao pode ser enviada para cobranca.';
  END IF;

  SELECT id INTO v_cobranca_id
  FROM public.cobrancas
  WHERE fatura_id = p_fatura_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_cobranca_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'cobranca_id', v_cobranca_id,
      'fatura_id', p_fatura_id
    );
  END IF;

  INSERT INTO public.cobrancas(
    fatura_id,
    cliente_id,
    valor_original,
    valor_atualizado,
    valor_pago,
    dias_atraso,
    score_risco,
    status,
    nivel_cobranca
  )
  VALUES (
    p_fatura_id,
    v_fatura.cliente_id,
    coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0),
    coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0),
    0,
    greatest(current_date - coalesce(v_fatura.data_vencimento, current_date), 0),
    15,
    'pendente',
    1
  )
  RETURNING id INTO v_cobranca_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'cobranca_id', v_cobranca_id,
    'fatura_id', p_fatura_id,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_fatura_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fatura faturas%rowtype;
  v_deleted_cobrancas integer := 0;
BEGIN
  IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo do cancelamento e obrigatorio.';
  END IF;

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
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'status', 'cancelado',
      'fatura_id', p_fatura_id
    );
  END IF;

  IF v_fatura.status = 'pago' THEN
    RAISE EXCEPTION 'Fatura paga nao pode ser cancelada por este fluxo. Use um fluxo de estorno/ajuste financeiro.';
  END IF;

  DELETE FROM public.cobranca_historico
  WHERE cobranca_id IN (
    SELECT id FROM public.cobrancas WHERE fatura_id = p_fatura_id
  );

  DELETE FROM public.cobrancas
  WHERE fatura_id = p_fatura_id;

  GET DIAGNOSTICS v_deleted_cobrancas = ROW_COUNT;

  UPDATE public.faturas
     SET status = 'cancelado',
         motivo_cancelamento = trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']',
         data_cancelamento = now()
   WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'status', 'cancelado',
    'fatura_id', p_fatura_id,
    'cobrancas_removidas', v_deleted_cobrancas,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_enviar_fatura_cobranca(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_fatura(uuid, text, uuid, text) TO anon, authenticated;
