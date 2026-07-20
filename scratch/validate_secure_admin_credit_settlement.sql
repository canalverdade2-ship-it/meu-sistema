DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_orcamento_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_valor numeric;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Quitacao Credito',
    '{"source":"validate_secure_admin_credit_settlement"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado
  )
  VALUES (
    v_cliente_id,
    'TEST-QUIT-' || v_suffix,
    'Cliente Teste Quitacao',
    '914' || substr(v_suffix, 1, 8),
    '11914' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false
  );

  INSERT INTO public.orcamentos(
    id,
    codigo_orcamento,
    cliente_id,
    categoria,
    status,
    total,
    valor_servico,
    valor_adicional,
    acrescimo,
    desconto,
    observacoes_servico,
    descricao_adicional,
    origem_gsa_store,
    status_quitacao_credito
  )
  VALUES (
    v_orcamento_id,
    'TEST-ODC-' || v_suffix,
    v_cliente_id,
    'loja',
    'aprovado',
    1000,
    1000,
    0,
    0,
    0,
    'Teste de quitacao',
    '',
    true,
    'analise_quitacao'
  );

  SELECT public.gsa_admin_enviar_oferta_quitacao_credito(v_sessao_id, v_token, v_orcamento_id, 750)
    INTO v_result;

  SELECT status_quitacao_credito, valor_quitacao_acordo
    INTO v_status, v_valor
  FROM public.orcamentos
  WHERE id = v_orcamento_id;

  IF v_status <> 'aguardando_pagamento_quitacao' OR v_valor <> 750 THEN
    RAISE EXCEPTION 'Oferta de quitacao inconsistente. status=%, valor=%', v_status, v_valor;
  END IF;

  SELECT public.gsa_admin_enviar_oferta_quitacao_credito(v_sessao_id, v_token, v_orcamento_id, 600)
    INTO v_result;

  IF NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Oferta duplicada deveria retornar already_processed.';
  END IF;

  SELECT valor_quitacao_acordo INTO v_valor
  FROM public.orcamentos
  WHERE id = v_orcamento_id;

  IF v_valor <> 750 THEN
    RAISE EXCEPTION 'Oferta duplicada sobrescreveu valor. valor=%', v_valor;
  END IF;

  DELETE FROM public.orcamentos WHERE id = v_orcamento_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
