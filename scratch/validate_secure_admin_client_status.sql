DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_bool boolean;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Status Cliente',
    '{"source":"validate_secure_admin_client_status"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado,
    carteira_bloqueada, pontos_bloqueados, cadastro_aprovado, saque_liberado_manual
  )
  VALUES (
    v_cliente_id,
    'TEST-STATUS-' || v_suffix,
    'Cliente Teste Status',
    '909' || substr(v_suffix, 1, 8),
    '11909' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false,
    0,
    0,
    false,
    false,
    false,
    true,
    false
  );

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'bloquear_carteira', 'Teste carteira', null)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao bloquear carteira: %', v_result;
  END IF;
  SELECT carteira_bloqueada INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Carteira nao bloqueou.';
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'desbloquear_carteira', null, null)
    INTO v_result;
  SELECT carteira_bloqueada INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Carteira nao desbloqueou.';
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'bloquear_pontos', 'Teste pontos', null)
    INTO v_result;
  SELECT pontos_bloqueados INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Pontos nao bloquearam.';
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'desbloquear_pontos', null, null)
    INTO v_result;
  SELECT pontos_bloqueados INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Pontos nao desbloquearam.';
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'definir_saque_manual', null, true)
    INTO v_result;
  SELECT saque_liberado_manual INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Saque manual nao liberou.';
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'bloquear_cadastro', 'Teste cadastro', null)
    INTO v_result;
  SELECT status, cadastro_aprovado INTO v_status, v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_status <> 'inativo' OR v_bool IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Cadastro nao bloqueou. status=%, aprovado=%', v_status, v_bool;
  END IF;

  SELECT public.gsa_admin_atualizar_status_cliente(v_sessao_id, v_token, v_cliente_id, 'aprovar_cadastro', null, null)
    INTO v_result;
  SELECT status, cadastro_aprovado INTO v_status, v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_status <> 'ativo' OR v_bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cadastro nao aprovou. status=%, aprovado=%', v_status, v_bool;
  END IF;

  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
