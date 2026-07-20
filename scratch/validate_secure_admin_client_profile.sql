DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_nome text;
  v_pin_bloqueado boolean;
  v_pin_tentativas integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Perfil Cliente',
    '{"source":"validate_secure_admin_client_profile"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-PROF-' || v_suffix,
    'Cliente Teste Perfil',
    '910' || substr(v_suffix, 1, 8),
    '11910' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    3,
    true,
    0,
    0,
    false
  );

  SELECT public.gsa_admin_alterar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'inativo')
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao alterar status: %', v_result;
  END IF;
  SELECT status INTO v_status FROM public.clientes WHERE id = v_cliente_id;
  IF v_status <> 'inativo' THEN
    RAISE EXCEPTION 'Status nao alterou para inativo. status=%', v_status;
  END IF;

  SELECT public.gsa_admin_alterar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'ativo')
    INTO v_result;
  SELECT status INTO v_status FROM public.clientes WHERE id = v_cliente_id;
  IF v_status <> 'ativo' THEN
    RAISE EXCEPTION 'Status nao alterou para ativo. status=%', v_status;
  END IF;

  SELECT public.gsa_admin_desbloquear_pin_cliente(v_sessao_id, v_token, v_cliente_id)
    INTO v_result;
  SELECT pin_bloqueado, pin_tentativas
    INTO v_pin_bloqueado, v_pin_tentativas
  FROM public.clientes
  WHERE id = v_cliente_id;
  IF v_pin_bloqueado IS DISTINCT FROM false OR v_pin_tentativas <> 0 THEN
    RAISE EXCEPTION 'PIN nao desbloqueou. bloqueado=%, tentativas=%', v_pin_bloqueado, v_pin_tentativas;
  END IF;

  SELECT public.gsa_admin_atualizar_dados_cliente(
    v_sessao_id,
    v_token,
    v_cliente_id,
    jsonb_build_object('nome', 'Cliente Teste Perfil Editado', 'email', 'perfil.teste@example.com', 'cidade', 'Atibaia')
  )
    INTO v_result;
  SELECT nome INTO v_nome FROM public.clientes WHERE id = v_cliente_id;
  IF v_nome <> 'Cliente Teste Perfil Editado' THEN
    RAISE EXCEPTION 'Nome nao atualizou. nome=%', v_nome;
  END IF;

  BEGIN
    PERFORM public.gsa_admin_atualizar_dados_cliente(
      v_sessao_id,
      v_token,
      v_cliente_id,
      '{"saldo_carteira":999}'::jsonb
    );
    RAISE EXCEPTION 'Whitelist falhou: saldo_carteira foi aceito.';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Whitelist falhou: saldo_carteira foi aceito.' THEN
        RAISE;
      END IF;
  END;

  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
