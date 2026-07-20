CREATE OR REPLACE FUNCTION public.gsa_admin_protestar_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid,
  p_data_protesto date,
  p_nome_cartorio text
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
  v_nome_cartorio text := nullif(trim(coalesce(p_nome_cartorio, '')), '');
  v_codigo_fatura text;
  v_fatura_protesto_id uuid;
BEGIN
  IF p_data_protesto IS NULL OR v_nome_cartorio IS NULL THEN
    RAISE EXCEPTION 'Data do protesto e nome do cartorio sao obrigatorios.';
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

  SELECT coalesce(codigo_fatura, v_cobranca.fatura_id::text)
    INTO v_fatura_ref
  FROM public.faturas
  WHERE id = v_cobranca.fatura_id;

  v_fatura_ref := coalesce(v_fatura_ref, left(p_cobranca_id::text, 8));

  IF v_cobranca.status = 'protestado' THEN
    SELECT id, codigo_fatura
      INTO v_fatura_protesto_id, v_codigo_fatura
    FROM public.faturas
    WHERE cliente_id = v_cobranca.cliente_id
      AND status = 'protestado'
      AND valor_total = v_cobranca.valor_atualizado
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'cobranca_id', p_cobranca_id,
      'fatura_id', v_fatura_protesto_id,
      'codigo_fatura', v_codigo_fatura
    );
  END IF;

  UPDATE public.faturas
     SET status = 'cancelado',
         observacoes = 'Cancelada por envio a protesto.'
   WHERE cliente_id = v_cobranca.cliente_id
     AND observacoes ILIKE ('%' || v_fatura_ref || '%')
     AND status IN ('pendente', 'vencida', 'pendente_pagamento');

  IF v_cobranca.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
       SET status = 'cancelado',
           observacoes = 'Substituida por fatura unica de protesto.'
     WHERE id = v_cobranca.fatura_id;
  END IF;

  UPDATE public.cobranca_acordo_parcelas
     SET status = 'cancelado'
   WHERE cobranca_id = p_cobranca_id
     AND status = 'pendente';

  v_codigo_fatura := 'FAT-PRO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.faturas(
    codigo_fatura,
    cliente_id,
    valor_total,
    data_vencimento,
    data_emissao,
    status,
    tipo,
    valor_final_pendente,
    observacoes,
    itens_faturados
  )
  VALUES (
    v_codigo_fatura,
    v_cobranca.cliente_id,
    v_cobranca.valor_atualizado,
    current_date,
    current_date,
    'protestado',
    'servico',
    v_cobranca.valor_atualizado,
    'Titulo Protestado: Cartorio ' || v_nome_cartorio || ' em ' || to_char(p_data_protesto, 'DD/MM/YYYY') || '. Referencia divida original: ' || v_fatura_ref || ' [POR: ' || v_actor.ator_nome || ']',
    jsonb_build_array(jsonb_build_object(
      'descricao', 'Consolidacao de Divida + Protesto (Cartorio ' || v_nome_cartorio || ') - Ref: ' || v_fatura_ref,
      'valor_unitario', v_cobranca.valor_atualizado,
      'quantidade', 1
    ))
  )
  RETURNING id INTO v_fatura_protesto_id;

  UPDATE public.cobrancas
     SET status = 'protestado',
         nivel_cobranca = 4,
         data_protesto = p_data_protesto,
         nome_cartorio = v_nome_cartorio
   WHERE id = p_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (
    p_cobranca_id,
    'protesto',
    'Titulo enviado para protesto em ' || to_char(p_data_protesto, 'DD/MM/YYYY') || ' no cartorio ' || v_nome_cartorio || '. Faturas antigas e acordos foram invalidados e substituidos pela nova fatura de Protesto agrupada. [POR: ' || v_actor.ator_nome || ']',
    'sistema'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cobranca_id', p_cobranca_id,
    'fatura_id', v_fatura_protesto_id,
    'codigo_fatura', v_codigo_fatura
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_protestar_cobranca(uuid, text, uuid, date, text) TO anon, authenticated;
