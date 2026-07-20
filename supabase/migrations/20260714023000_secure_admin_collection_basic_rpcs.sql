CREATE OR REPLACE FUNCTION public.gsa_admin_criar_cobranca_fatura(
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
  v_valor numeric;
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

  IF v_fatura.status NOT IN ('pendente', 'vencida', 'pendente_pagamento', 'aguardando_link') THEN
    RAISE EXCEPTION 'Fatura com status % nao pode gerar cobranca.', v_fatura.status;
  END IF;

  SELECT id INTO v_cobranca_id
  FROM public.cobrancas
  WHERE fatura_id = p_fatura_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_cobranca_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true, 'cobranca_id', v_cobranca_id);
  END IF;

  v_valor := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);

  INSERT INTO public.cobrancas(
    fatura_id, cliente_id, valor_original, valor_atualizado,
    status, nivel_cobranca, score_risco, valor_pago, dias_atraso
  )
  VALUES (
    p_fatura_id,
    v_fatura.cliente_id,
    v_valor,
    v_valor,
    'pendente',
    1,
    15,
    0,
    greatest(current_date - coalesce(v_fatura.data_vencimento, current_date), 0)
  )
  RETURNING id INTO v_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (
    v_cobranca_id,
    'criacao_cobranca',
    'Cobranca criada a partir da fatura ' || coalesce(v_fatura.codigo_fatura, p_fatura_id::text) || ' [POR: ' || v_actor.ator_nome || ']',
    'sistema'
  );

  RETURN jsonb_build_object('success', true, 'already_exists', false, 'cobranca_id', v_cobranca_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_registrar_cobranca_historico(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid,
  p_tipo_acao text,
  p_descricao text,
  p_canal text DEFAULT 'manual',
  p_promessa_pagamento boolean DEFAULT false,
  p_data_promessa date DEFAULT NULL,
  p_valor_envolvido numeric DEFAULT NULL,
  p_atualizar_ultimo_contato boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cobranca cobrancas%rowtype;
  v_historico_id uuid;
BEGIN
  IF nullif(trim(coalesce(p_descricao, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Descricao do historico e obrigatoria.';
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

  INSERT INTO public.cobranca_historico(
    cobranca_id,
    tipo_acao,
    descricao,
    canal,
    promessa_pagamento,
    data_promessa,
    valor_envolvido
  )
  VALUES (
    p_cobranca_id,
    coalesce(nullif(trim(p_tipo_acao), ''), 'historico_manual'),
    trim(p_descricao) || ' [POR: ' || v_actor.ator_nome || ']',
    coalesce(nullif(trim(p_canal), ''), 'manual'),
    coalesce(p_promessa_pagamento, false),
    CASE WHEN coalesce(p_promessa_pagamento, false) THEN p_data_promessa ELSE NULL END,
    p_valor_envolvido
  )
  RETURNING id INTO v_historico_id;

  IF p_atualizar_ultimo_contato THEN
    UPDATE public.cobrancas
       SET data_ultimo_contato = now()
     WHERE id = p_cobranca_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'historico_id', v_historico_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_mudar_status_cobranca(
  p_sessao_id uuid,
  p_session_token text,
  p_cobranca_id uuid,
  p_status text,
  p_nivel_cobranca integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cobranca cobrancas%rowtype;
  v_nivel integer := greatest(coalesce(p_nivel_cobranca, 1), 1);
BEGIN
  IF nullif(trim(coalesce(p_status, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Status e obrigatorio.';
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

  UPDATE public.cobrancas
     SET status = trim(p_status),
         nivel_cobranca = v_nivel
   WHERE id = p_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (
    p_cobranca_id,
    'mudanca_status',
    'Status alterado manualmente para ' || trim(p_status) || ' (Nivel ' || v_nivel || ') [POR: ' || v_actor.ator_nome || ']',
    'sistema'
  );

  RETURN jsonb_build_object('success', true, 'status', trim(p_status), 'nivel_cobranca', v_nivel);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_criar_cobranca_fatura(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_registrar_cobranca_historico(uuid, text, uuid, text, text, text, boolean, date, numeric, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_mudar_status_cobranca(uuid, text, uuid, text, integer) TO anon, authenticated;
