DO $$
DECLARE
  v_origin_id uuid := gen_random_uuid();
  v_destination_id uuid := gen_random_uuid();
  v_third_id uuid := gen_random_uuid();
  v_document text;
  v_origin_session jsonb;
  v_destination_session jsonb;
  v_third_session jsonb;
  v_result jsonb;
  v_repeat jsonb;
  v_transfer jsonb;
  v_rate numeric;
  v_value numeric;
  v_count integer;
  v_rejected boolean := false;
BEGIN
  v_document := lpad((abs(hashtext(v_destination_id::text))::bigint % 100000000000)::text, 11, '0');
  INSERT INTO public.clientes(
    id, nome, cpf, tipo_pessoa, status, saldo_pontos, saldo_carteira,
    saque_liberado_manual, limite_credito_total, limite_credito_disponivel
  ) VALUES
    (v_origin_id, 'Origem Financeira Teste', NULL, 'pf', 'ativo', 1000, 100, true, 0, 0),
    (v_destination_id, 'Destino Financeiro Teste', v_document, 'pf', 'ativo', 100, 50, false, 0, 0),
    (v_third_id, 'Terceiro Financeiro Teste', NULL, 'pf', 'ativo', 0, 0, false, 0, 0);

  v_origin_session := public.gsa_create_session_internal('cliente', v_origin_id, 'Origem Financeira Teste', '{}'::jsonb);
  v_destination_session := public.gsa_create_session_internal('cliente', v_destination_id, 'Destino Financeiro Teste', '{}'::jsonb);
  v_third_session := public.gsa_create_session_internal('cliente', v_third_id, 'Terceiro Financeiro Teste', '{}'::jsonb);

  v_result := public.gsa_client_lookup_transfer_recipient(
    (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token', 'cpf', v_document
  );
  IF v_result ->> 'id' <> v_destination_id::text OR v_result ->> 'nome' <> 'Destino Financeiro Teste' THEN
    RAISE EXCEPTION 'Consulta segura de destinatário retornou dados incorretos: %', v_result;
  END IF;

  SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100)
  INTO v_rate FROM public.empresa ORDER BY created_at LIMIT 1;
  v_rate := coalesce(v_rate, 0.01);

  v_result := public.gsa_client_convert_points(
    (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
    gen_random_uuid(), 100
  );
  IF (v_result ->> 'valor_convertido')::numeric <> round(100 * v_rate, 2)
     OR (v_result ->> 'saldo_pontos')::integer <> 900 THEN
    RAISE EXCEPTION 'Conversão de pontos incorreta: %', v_result;
  END IF;

  DECLARE
    v_conversion_request uuid := gen_random_uuid();
  BEGIN
    v_result := public.gsa_client_convert_points(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_conversion_request, 100
    );
    v_repeat := public.gsa_client_convert_points(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_conversion_request, 999
    );
    IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
       OR v_repeat ->> 'valor_convertido' <> v_result ->> 'valor_convertido' THEN
      RAISE EXCEPTION 'Conversão de pontos não foi idempotente: %', v_repeat;
    END IF;
  END;

  DECLARE
    v_withdrawal_request uuid := gen_random_uuid();
    v_before numeric;
  BEGIN
    SELECT saldo_carteira INTO v_before FROM public.clientes WHERE id = v_origin_id;
    v_result := public.gsa_client_request_withdrawal(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_withdrawal_request, 'cpf', '529.982.247-25'
    );
    IF (v_result ->> 'valor')::numeric <> v_before THEN
      RAISE EXCEPTION 'Saque não utilizou o saldo autoritativo total: %', v_result;
    END IF;
    SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_origin_id;
    IF v_value <> 0 THEN RAISE EXCEPTION 'Saldo não foi reservado no saque: %', v_value; END IF;
    v_repeat := public.gsa_client_request_withdrawal(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_withdrawal_request, 'cpf', '000.000.000-00'
    );
    IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
       OR v_repeat ->> 'saque_id' <> v_result ->> 'saque_id' THEN
      RAISE EXCEPTION 'Solicitação de saque não foi idempotente: %', v_repeat;
    END IF;

    BEGIN
      PERFORM public.gsa_client_cancel_withdrawal(
        (v_third_session ->> 'sessao_id')::uuid, v_third_session ->> 'session_token',
        (v_result ->> 'saque_id')::uuid, 'Tentativa indevida'
      );
    EXCEPTION WHEN others THEN
      v_rejected := true;
    END;
    IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Outro cliente cancelou o saque.'; END IF;

    PERFORM public.gsa_client_cancel_withdrawal(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      (v_result ->> 'saque_id')::uuid, 'Cancelamento de teste'
    );
    SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_origin_id;
    IF v_value <> v_before THEN RAISE EXCEPTION 'Cancelamento não restaurou o saque: %', v_value; END IF;
  END;

  DECLARE
    v_transfer_request uuid := gen_random_uuid();
    v_before numeric;
  BEGIN
    SELECT saldo_carteira INTO v_before FROM public.clientes WHERE id = v_origin_id;
    v_transfer := public.gsa_client_request_transfer(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_transfer_request, v_destination_id, 'saldo', 20, 'Transferência de teste'
    );
    SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_origin_id;
    IF v_value <> v_before - 20 THEN RAISE EXCEPTION 'Transferência não reservou o saldo: %', v_value; END IF;
    v_repeat := public.gsa_client_request_transfer(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      v_transfer_request, v_destination_id, 'saldo', 99, 'Payload repetido adulterado'
    );
    IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
       OR v_repeat ->> 'transferencia_id' <> v_transfer ->> 'transferencia_id' THEN
      RAISE EXCEPTION 'Transferência não foi idempotente: %', v_repeat;
    END IF;
    PERFORM public.gsa_client_cancel_transfer(
      (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
      (v_transfer ->> 'transferencia_id')::uuid
    );
    SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_origin_id;
    IF v_value <> v_before THEN RAISE EXCEPTION 'Cancelamento não restaurou transferência: %', v_value; END IF;
  END;

  v_transfer := public.gsa_client_request_transfer(
    (v_origin_session ->> 'sessao_id')::uuid, v_origin_session ->> 'session_token',
    gen_random_uuid(), v_destination_id, 'pontos', 100, 'Transferência de pontos para estorno'
  );
  UPDATE public.transferencias SET status = 'aprovado'
  WHERE id = (v_transfer ->> 'transferencia_id')::uuid;
  UPDATE public.clientes
  SET saldo_pontos = saldo_pontos + (v_transfer ->> 'valor_liquido')::numeric::integer
  WHERE id = v_destination_id;

  PERFORM public.gsa_client_reverse_transfer(
    (v_destination_session ->> 'sessao_id')::uuid, v_destination_session ->> 'session_token',
    (v_transfer ->> 'transferencia_id')::uuid
  );
  SELECT count(*) INTO v_count FROM public.transferencias
  WHERE id = (v_transfer ->> 'transferencia_id')::uuid AND status = 'estornado';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Transferência aprovada não foi estornada.'; END IF;
END;
$$;
