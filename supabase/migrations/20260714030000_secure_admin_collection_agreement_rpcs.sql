CREATE OR REPLACE FUNCTION public.gsa_admin_gerar_acordo_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid,
  p_parcelas integer,
  p_dt_primeiro_venc date,
  p_desconto numeric DEFAULT 0,
  p_tipo_desconto text DEFAULT 'fixo',
  p_observacoes text DEFAULT NULL
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
  v_fatura_obs text;
  v_tipo_desconto text := coalesce(nullif(trim(p_tipo_desconto), ''), 'fixo');
  v_desconto numeric := greatest(coalesce(p_desconto, 0), 0);
  v_valor_desconto numeric;
  v_valor_base numeric;
  v_valor_parcela numeric;
  v_data_venc date;
  v_codigo_fatura text;
  v_i integer;
  v_existing_count integer;
  v_new_fatura_id uuid;
  v_created_faturas uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_parcelas IS NULL OR p_parcelas < 1 THEN
    RAISE EXCEPTION 'Quantidade de parcelas invalida.';
  END IF;

  IF p_dt_primeiro_venc IS NULL THEN
    RAISE EXCEPTION 'Data da primeira parcela e obrigatoria.';
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

  SELECT coalesce(codigo_fatura, v_cobranca.fatura_id::text), observacoes
    INTO v_fatura_ref, v_fatura_obs
  FROM public.faturas
  WHERE id = v_cobranca.fatura_id;

  v_fatura_ref := coalesce(v_fatura_ref, left(p_cobranca_id::text, 8));
  v_valor_desconto := CASE
    WHEN v_tipo_desconto = 'porcentagem' THEN round(v_cobranca.valor_atualizado * (v_desconto / 100), 2)
    ELSE round(v_desconto, 2)
  END;
  v_valor_base := round(greatest(v_cobranca.valor_atualizado - v_valor_desconto, 0), 2);
  v_valor_parcela := round(v_valor_base / p_parcelas, 2);

  SELECT count(*) INTO v_existing_count
  FROM public.cobranca_acordo_parcelas
  WHERE cobranca_id = p_cobranca_id
    AND status = 'pendente'
    AND valor_parcela = v_valor_parcela;

  IF v_cobranca.status = 'acordo' AND v_existing_count = p_parcelas THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'cobranca_id', p_cobranca_id,
      'parcelas', p_parcelas,
      'valor_parcela', v_valor_parcela,
      'valor_total', v_valor_base
    );
  END IF;

  UPDATE public.faturas
     SET status = 'cancelado',
         observacoes = 'Substituida por renegociacao de acordo.'
   WHERE cliente_id = v_cobranca.cliente_id
     AND observacoes ILIKE ('%' || v_fatura_ref || '%')
     AND status IN ('pendente', 'vencida', 'pendente_pagamento');

  UPDATE public.cobranca_acordo_parcelas
     SET status = 'cancelado'
   WHERE cobranca_id = p_cobranca_id
     AND status = 'pendente';

  UPDATE public.cobrancas
     SET status = 'acordo',
         valor_pago = 0
   WHERE id = p_cobranca_id;

  IF v_cobranca.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
       SET status = 'fatura_negociada',
           observacoes = coalesce(v_fatura_obs || E'\n', '') ||
             '[ACORDO DE COBRANCA GERADO]' || E'\n' ||
             'Data: ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || E'\n' ||
             'Parcelas: ' || p_parcelas || E'\n' ||
             'Desconto Concedido: ' || to_char(v_desconto, 'FM999999999990D00') || E'\n' ||
             'Valor Total do Acordo: ' || to_char(v_valor_base, 'FM999999999990D00') || E'\n' ||
             'Autorizado por: ' || v_actor.ator_nome
     WHERE id = v_cobranca.fatura_id;
  END IF;

  v_data_venc := p_dt_primeiro_venc;
  FOR v_i IN 1..p_parcelas LOOP
    v_codigo_fatura := 'FAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    INSERT INTO public.faturas(
      codigo_fatura,
      cliente_id,
      valor_total,
      valor_final_pendente,
      data_vencimento,
      data_emissao,
      status,
      tipo,
      observacoes,
      itens_faturados
    )
    VALUES (
      v_codigo_fatura,
      v_cobranca.cliente_id,
      v_valor_parcela,
      v_valor_parcela,
      v_data_venc,
      current_date,
      'pendente',
      'servico',
      trim('Parcela ' || v_i || '/' || p_parcelas || ' do acordo (Ref. Divida original: ' || v_fatura_ref || ') [POR: ' || v_actor.ator_nome || ']'),
      jsonb_build_array(jsonb_build_object(
        'descricao', trim('Acordo de Renegociacao - Parcela ' || v_i || '/' || p_parcelas || ' (Ref. Divida original: ' || v_fatura_ref || ')'),
        'valor_unitario', v_valor_parcela,
        'quantidade', 1
      ))
    )
    RETURNING id INTO v_new_fatura_id;

    v_created_faturas := array_append(v_created_faturas, v_new_fatura_id);

    INSERT INTO public.cobranca_acordo_parcelas(
      cobranca_id, numero_parcela, valor_parcela, data_vencimento, status
    )
    VALUES (
      p_cobranca_id,
      v_i,
      v_valor_parcela,
      v_data_venc,
      'pendente'
    );

    v_data_venc := (v_data_venc + interval '1 month')::date;
  END LOOP;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal, valor_envolvido)
  VALUES (
    p_cobranca_id,
    'acordo',
    'Acordo gerado: ' || p_parcelas || ' parcelas de ' || to_char(v_valor_parcela, 'FM999999999990D00') || '. Desconto de ' || CASE WHEN v_tipo_desconto = 'porcentagem' THEN v_desconto::text || '%' ELSE to_char(v_desconto, 'FM999999999990D00') END || '. ' || coalesce(p_observacoes, '') || ' [POR: ' || v_actor.ator_nome || ']',
    'sistema',
    v_valor_base
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cobranca_id', p_cobranca_id,
    'parcelas', p_parcelas,
    'valor_parcela', v_valor_parcela,
    'valor_total', v_valor_base,
    'faturas_criadas', to_jsonb(v_created_faturas)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_acordo_cobranca(
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
  v_canceladas integer := 0;
BEGIN
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

  UPDATE public.faturas
     SET status = 'cancelado',
         observacoes = 'Acordo cancelado em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ' [POR: ' || v_actor.ator_nome || ']'
   WHERE cliente_id = v_cobranca.cliente_id
     AND observacoes ILIKE ('%' || v_fatura_ref || '%')
     AND status IN ('pendente', 'vencida', 'pendente_pagamento');

  GET DIAGNOSTICS v_canceladas = ROW_COUNT;

  UPDATE public.cobranca_acordo_parcelas
     SET status = 'cancelado'
   WHERE cobranca_id = p_cobranca_id
     AND status = 'pendente';

  IF v_cobranca.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
       SET status = 'vencida',
           observacoes = 'Reativada apos cancelamento de acordo manual em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ' [POR: ' || v_actor.ator_nome || ']'
     WHERE id = v_cobranca.fatura_id;
  END IF;

  UPDATE public.cobrancas
     SET status = 'pendente',
         nivel_cobranca = 1,
         valor_pago = 0
   WHERE id = p_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (
    p_cobranca_id,
    'mudanca_status',
    'Acordo CANCELADO MANUALMENTE. Faturas de parcelas invalidadas e divida original reativada. [POR: ' || v_actor.ator_nome || ']',
    'sistema'
  );

  RETURN jsonb_build_object(
    'success', true,
    'cobranca_id', p_cobranca_id,
    'faturas_canceladas', v_canceladas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_gerar_acordo_cobranca(uuid, text, uuid, integer, date, numeric, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_acordo_cobranca(uuid, text, uuid) TO anon, authenticated;
