DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_id uuid;
  v_result jsonb;
  v_total numeric;
  v_final numeric;
  v_codigo text;
  v_hist_count integer;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Fatura Manual',
    '{"source":"validate_secure_admin_invoice_manual"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado
  )
  VALUES (
    v_cliente_id,
    'TEST-FAT-' || v_suffix,
    'Cliente Teste Fatura',
    '916' || substr(v_suffix, 1, 8),
    '11916' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false
  );

  SELECT public.gsa_admin_criar_fatura_manual(
    v_sessao_id,
    v_token,
    v_cliente_id,
    300,
    current_date + 7,
    current_date,
    'Fatura manual teste',
    NULL,
    NULL,
    NULL,
    'servico'
  )
  INTO v_result;

  v_fatura_id := (v_result->>'fatura_id')::uuid;
  v_codigo := v_result->>'codigo_fatura';

  SELECT valor_total, valor_final_pendente
    INTO v_total, v_final
  FROM public.faturas
  WHERE id = v_fatura_id;

  IF v_fatura_id IS NULL OR v_codigo IS NULL OR v_total <> 300 OR v_final <> 300 THEN
    RAISE EXCEPTION 'Criacao de fatura inconsistente. id=%, codigo=%, total=%, final=%', v_fatura_id, v_codigo, v_total, v_final;
  END IF;

  SELECT public.gsa_admin_aplicar_ajuste_fatura(v_sessao_id, v_token, v_fatura_id, 50, 20, 'Teste ajuste')
    INTO v_result;

  SELECT valor_total, valor_final_pendente, jsonb_array_length(coalesce(historico_ajustes, '[]'::jsonb))
    INTO v_total, v_final, v_hist_count
  FROM public.faturas
  WHERE id = v_fatura_id;

  IF v_total <> 270 OR v_final <> 270 OR v_hist_count <> 1 THEN
    RAISE EXCEPTION 'Ajuste de fatura inconsistente. total=%, final=%, hist=%', v_total, v_final, v_hist_count;
  END IF;

  DELETE FROM public.faturas WHERE id = v_fatura_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
