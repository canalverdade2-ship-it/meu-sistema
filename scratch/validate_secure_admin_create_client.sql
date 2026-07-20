DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_result jsonb;
  v_cliente_id uuid;
  v_count integer;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
  v_cpf text := '911' || lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Criar Cliente',
    '{"source":"validate_secure_admin_create_client"}'::jsonb
  );

  SELECT public.gsa_admin_criar_cliente(
    v_sessao_id,
    v_token,
    jsonb_build_object(
      'nome', 'Cliente Teste Criacao',
      'tipo_pessoa', 'pf',
      'cpf', v_cpf,
      'telefone', '11911' || substr(v_suffix, 1, 6),
      'email', 'cliente.criacao.' || v_suffix || '@example.com',
      'data_cadastro', now()
    )
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao criar cliente: %', v_result;
  END IF;

  v_cliente_id := (v_result->>'cliente_id')::uuid;

  SELECT count(*) INTO v_count FROM public.clientes WHERE id = v_cliente_id AND cpf = v_cpf;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Cliente criado nao localizado. count=%', v_count;
  END IF;

  BEGIN
    PERFORM public.gsa_admin_criar_cliente(
      v_sessao_id,
      v_token,
      jsonb_build_object(
        'nome', 'Cliente Teste Duplicado',
        'tipo_pessoa', 'pf',
        'cpf', v_cpf,
        'telefone', '11912' || substr(v_suffix, 1, 6),
        'data_cadastro', now()
      )
    );
    RAISE EXCEPTION 'Duplicidade de CPF foi aceita.';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Duplicidade de CPF foi aceita.' THEN
        RAISE;
      END IF;
      IF position('CPF' in SQLERRM) = 0 THEN
        RAISE EXCEPTION 'Mensagem de duplicidade inesperada: %', SQLERRM;
      END IF;
  END;

  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
