DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_emp_id uuid := gen_random_uuid();
  v_emp_doc_id uuid := gen_random_uuid();
  v_emp_status_id uuid := gen_random_uuid();
  v_emp_quitacao_id uuid := gen_random_uuid();
  v_doc_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_count integer;
  v_fatura_id uuid;
  v_valor numeric;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Emprestimos',
    '{"source":"validate_secure_admin_loan_flow"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado
  )
  VALUES (
    v_cliente_id,
    'TEST-EMP-' || v_suffix,
    'Cliente Teste Emprestimo',
    '915' || substr(v_suffix, 1, 8),
    '11915' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false
  );

  INSERT INTO public.emprestimos(id, codigo_emprestimo, cliente_id, valor_solicitado, status, taxa_servico)
  VALUES
    (v_emp_id, 'EMP-TEST-' || v_suffix || '-1', v_cliente_id, 1000, 'analise_inicial', 30),
    (v_emp_doc_id, 'EMP-TEST-' || v_suffix || '-2', v_cliente_id, 500, 'analise_final', 0),
    (v_emp_status_id, 'EMP-TEST-' || v_suffix || '-3', v_cliente_id, 700, 'analise_final', 0),
    (v_emp_quitacao_id, 'EMP-TEST-' || v_suffix || '-4', v_cliente_id, 800, 'analise_quitacao', 0);

  SELECT public.gsa_admin_emprestimo_salvar_observacao(v_sessao_id, v_token, v_emp_id, 'Observacao teste')
    INTO v_result;

  SELECT public.gsa_admin_emprestimo_enviar_comentario(v_sessao_id, v_token, v_emp_id, NULL, 'Mensagem teste')
    INTO v_result;

  SELECT count(*) INTO v_count FROM public.emprestimo_comentarios WHERE emprestimo_id = v_emp_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Comentario nao foi gravado. count=%', v_count; END IF;

  SELECT public.gsa_admin_emprestimo_enviar_proposta(v_sessao_id, v_token, v_emp_id, 900, 20, 10, 30, 'Teste proposta', 7)
    INTO v_result;

  SELECT status, valor_aprovado INTO v_status, v_valor
  FROM public.emprestimos
  WHERE id = v_emp_id;
  IF v_status <> 'proposta_enviada' OR v_valor <> 900 THEN
    RAISE EXCEPTION 'Proposta inconsistente. status=%, valor=%', v_status, v_valor;
  END IF;

  SELECT public.gsa_admin_emprestimo_enviar_contrato(v_sessao_id, v_token, v_emp_id, 'https://example.com/contrato.pdf')
    INTO v_result;

  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_id;
  IF v_status <> 'pendencia_assinatura' THEN RAISE EXCEPTION 'Contrato nao atualizou status. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_aprovar(v_sessao_id, v_token, v_emp_id)
    INTO v_result;
  v_fatura_id := (v_result->>'fatura_id')::uuid;

  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_id;
  SELECT count(*) INTO v_count FROM public.faturas WHERE id = v_fatura_id AND emprestimo_id = v_emp_id;
  IF v_status <> 'aprovado' OR v_count <> 1 THEN
    RAISE EXCEPTION 'Aprovacao/fatura inconsistente. status=%, faturas=%', v_status, v_count;
  END IF;

  SELECT public.gsa_admin_emprestimo_atualizar_status(v_sessao_id, v_token, v_emp_id, 'ativo', NULL)
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_id;
  IF v_status <> 'ativo' THEN RAISE EXCEPTION 'Ativacao inconsistente. status=%', v_status; END IF;

  INSERT INTO public.emprestimo_documentos(id, emprestimo_id, cliente_id, tipo, nome, url, status)
  VALUES (v_doc_id, v_emp_doc_id, v_cliente_id, 'outro', 'Documento Teste', 'https://example.com/doc.pdf', 'enviado');

  SELECT public.gsa_admin_emprestimo_atualizar_documento(v_sessao_id, v_token, v_doc_id, 'aprovado', NULL)
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimo_documentos WHERE id = v_doc_id;
  IF v_status <> 'aprovado' THEN RAISE EXCEPTION 'Documento nao aprovou. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_atualizar_documento(v_sessao_id, v_token, v_doc_id, 'rejeitado', 'Documento ilegivel')
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimo_documentos WHERE id = v_doc_id;
  IF v_status <> 'rejeitado' THEN RAISE EXCEPTION 'Documento nao rejeitou. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_atualizar_status(v_sessao_id, v_token, v_emp_status_id, 'pendencia_documentos', 'Enviar novo comprovante')
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_status_id;
  IF v_status <> 'pendencia_documentos' THEN RAISE EXCEPTION 'Pendencia documentos inconsistente. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_atualizar_status(v_sessao_id, v_token, v_emp_status_id, 'pendencia_assinatura', 'Assinatura divergente')
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_status_id;
  IF v_status <> 'pendencia_assinatura' THEN RAISE EXCEPTION 'Pendencia assinatura inconsistente. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_atualizar_status(v_sessao_id, v_token, v_emp_status_id, 'cancelado', NULL)
    INTO v_result;
  SELECT status INTO v_status FROM public.emprestimos WHERE id = v_emp_status_id;
  IF v_status <> 'cancelado' THEN RAISE EXCEPTION 'Cancelamento inconsistente. status=%', v_status; END IF;

  SELECT public.gsa_admin_emprestimo_enviar_oferta_quitacao(v_sessao_id, v_token, v_emp_quitacao_id, 650)
    INTO v_result;
  SELECT status, valor_quitacao_acordo INTO v_status, v_valor
  FROM public.emprestimos
  WHERE id = v_emp_quitacao_id;
  IF v_status <> 'aguardando_pagamento_quitacao' OR v_valor <> 650 THEN
    RAISE EXCEPTION 'Oferta quitacao inconsistente. status=%, valor=%', v_status, v_valor;
  END IF;

  SELECT public.gsa_admin_emprestimo_enviar_oferta_quitacao(v_sessao_id, v_token, v_emp_quitacao_id, 500)
    INTO v_result;
  IF NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Oferta duplicada deveria retornar already_processed.';
  END IF;

  DELETE FROM public.faturas WHERE emprestimo_id IN (v_emp_id, v_emp_doc_id, v_emp_status_id, v_emp_quitacao_id);
  DELETE FROM public.emprestimo_comentarios WHERE emprestimo_id IN (v_emp_id, v_emp_doc_id, v_emp_status_id, v_emp_quitacao_id);
  DELETE FROM public.emprestimo_documentos WHERE emprestimo_id IN (v_emp_id, v_emp_doc_id, v_emp_status_id, v_emp_quitacao_id);
  DELETE FROM public.emprestimo_historico WHERE emprestimo_id IN (v_emp_id, v_emp_doc_id, v_emp_status_id, v_emp_quitacao_id);
  DELETE FROM public.emprestimos WHERE id IN (v_emp_id, v_emp_doc_id, v_emp_status_id, v_emp_quitacao_id);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
