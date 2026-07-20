DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_sol_pre uuid := gen_random_uuid();
  v_sol_recusa uuid := gen_random_uuid();
  v_sol_doc uuid := gen_random_uuid();
  v_sol_contrato uuid := gen_random_uuid();
  v_doc_id uuid;
  v_result jsonb;
  v_status text;
  v_limite numeric;
  v_contrato_url text;
  v_motivo text;
  v_count integer;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Fluxo Credito',
    '{"source":"validate_secure_admin_credit_request"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-CREQ-' || v_suffix,
    'Cliente Teste Fluxo Credito',
    '913' || substr(v_suffix, 1, 8),
    '11913' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false,
    0,
    0,
    false
  );

  INSERT INTO public.loja_credito_solicitacoes(id, cliente_id, tipo_solicitacao, status, limite_solicitado)
  VALUES
    (v_sol_pre, v_cliente_id, 'adesao', 'analise', 500),
    (v_sol_recusa, v_cliente_id, 'alteracao', 'analise', 700),
    (v_sol_doc, v_cliente_id, 'adesao', 'analise', 900),
    (v_sol_contrato, v_cliente_id, 'adesao', 'contrato_assinado', 1000);

  SELECT public.gsa_admin_preaprovar_credito(
    v_sessao_id,
    v_token,
    v_sol_pre,
    450,
    true,
    8,
    'https://example.com/contrato.pdf'
  )
  INTO v_result;

  SELECT status, limite_aprovado, contrato_url
    INTO v_status, v_limite, v_contrato_url
  FROM public.loja_credito_solicitacoes
  WHERE id = v_sol_pre;

  IF v_status <> 'contrato_pendente_assinatura' OR v_limite <> 450 OR v_contrato_url <> 'https://example.com/contrato.pdf' THEN
    RAISE EXCEPTION 'Pre-aprovacao inconsistente. status=%, limite=%, contrato=%', v_status, v_limite, v_contrato_url;
  END IF;

  SELECT public.gsa_admin_recusar_credito(v_sessao_id, v_token, v_sol_recusa, 'Renda insuficiente', current_date + 30)
    INTO v_result;

  SELECT status, motivo_negacao
    INTO v_status, v_motivo
  FROM public.loja_credito_solicitacoes
  WHERE id = v_sol_recusa;

  IF v_status <> 'negado' OR v_motivo <> 'Renda insuficiente' THEN
    RAISE EXCEPTION 'Recusa inconsistente. status=%, motivo=%', v_status, v_motivo;
  END IF;

  SELECT public.gsa_admin_solicitar_documento_credito(v_sessao_id, v_token, v_sol_doc, 'Extrato Bancario', 'Enviar ultimo mes')
    INTO v_result;
  v_doc_id := (v_result->>'documento_id')::uuid;

  SELECT count(*) INTO v_count
  FROM public.loja_credito_documentos
  WHERE id = v_doc_id
    AND solicitacao_id = v_sol_doc
    AND nome_documento = 'Extrato Bancario'
    AND status = 'pendente';

  SELECT status INTO v_status FROM public.loja_credito_solicitacoes WHERE id = v_sol_doc;

  IF v_count <> 1 OR v_status <> 'documentos_pendentes' THEN
    RAISE EXCEPTION 'Solicitacao de documento inconsistente. docs=%, status=%', v_count, v_status;
  END IF;

  SELECT public.gsa_admin_atualizar_documento_credito(v_sessao_id, v_token, v_doc_id, 'aprovado', NULL)
    INTO v_result;

  SELECT status, observacao INTO v_status, v_motivo
  FROM public.loja_credito_documentos
  WHERE id = v_doc_id;

  IF v_status <> 'aprovado' OR v_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'Aprovacao de documento inconsistente. status=%, obs=%', v_status, v_motivo;
  END IF;

  SELECT public.gsa_admin_atualizar_documento_credito(v_sessao_id, v_token, v_doc_id, 'rejeitado', 'Documento ilegivel')
    INTO v_result;

  SELECT status, observacao INTO v_status, v_motivo
  FROM public.loja_credito_documentos
  WHERE id = v_doc_id;

  IF v_status <> 'rejeitado' OR v_motivo <> 'Documento ilegivel' THEN
    RAISE EXCEPTION 'Rejeicao de documento inconsistente. status=%, obs=%', v_status, v_motivo;
  END IF;

  UPDATE public.loja_credito_solicitacoes
     SET contrato_assinado_url = 'https://example.com/assinado.pdf'
   WHERE id = v_sol_contrato;

  SELECT public.gsa_admin_rejeitar_contrato_credito(v_sessao_id, v_token, v_sol_contrato, 'Assinatura divergente')
    INTO v_result;

  SELECT status, contrato_assinado_url, motivo_negacao
    INTO v_status, v_contrato_url, v_motivo
  FROM public.loja_credito_solicitacoes
  WHERE id = v_sol_contrato;

  IF v_status <> 'contrato_pendente_assinatura' OR v_contrato_url IS NOT NULL OR v_motivo <> 'Assinatura divergente' THEN
    RAISE EXCEPTION 'Rejeicao de contrato inconsistente. status=%, contrato=%, motivo=%', v_status, v_contrato_url, v_motivo;
  END IF;

  DELETE FROM public.loja_credito_documentos WHERE solicitacao_id IN (v_sol_pre, v_sol_recusa, v_sol_doc, v_sol_contrato);
  DELETE FROM public.loja_credito_solicitacoes WHERE id IN (v_sol_pre, v_sol_recusa, v_sol_doc, v_sol_contrato);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
