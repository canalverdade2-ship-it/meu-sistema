-- Reenvio seguro do cadastro e perfil bancario do fornecedor.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_public_register_supplier(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_type text := lower(trim(coalesce(v_payload->>'tipo_pessoa', '')));
  v_document text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_name text := trim(coalesce(v_payload->>'razao_social', ''));
  v_responsible text := trim(coalesce(v_payload->>'responsavel_nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_zip text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_id uuid;
  v_existing public.fornecedores%rowtype;
  v_updated boolean := false;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_fornecedor_ip', 'cadastro', 5, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('cadastro_fornecedor_documento', v_document, 3, interval '1 hour');

  IF v_type NOT IN ('pf', 'pj') THEN RAISE EXCEPTION 'Tipo de pessoa invalido.'; END IF;
  IF v_type = 'pf' AND NOT public.gsa_is_valid_cpf(v_document) THEN RAISE EXCEPTION 'CPF invalido.'; END IF;
  IF v_type = 'pj' AND NOT public.gsa_is_valid_cnpj(v_document) THEN RAISE EXCEPTION 'CNPJ invalido.'; END IF;
  IF length(v_name) < 3 OR length(v_name) > 180 THEN RAISE EXCEPTION 'Informe o nome ou razao social.'; END IF;
  IF length(v_responsible) < 3 OR length(v_responsible) > 180 THEN RAISE EXCEPTION 'Informe o responsavel.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_zip <> '' AND length(v_zip) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;

  SELECT * INTO v_existing
  FROM public.fornecedores
  WHERE documento = v_document
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status NOT IN ('pendente', 'em_analise', 'ajuste_solicitado') THEN
      RAISE EXCEPTION 'Este documento ja possui um cadastro encerrado ou com acesso liberado.';
    END IF;
    IF lower(trim(v_existing.email)) <> v_email
       OR regexp_replace(coalesce(v_existing.telefone, ''), '\D', '', 'g') <> v_phone THEN
      RAISE EXCEPTION 'E-mail ou telefone nao conferem com o cadastro existente.';
    END IF;

    UPDATE public.fornecedores
    SET tipo_pessoa = v_type,
        razao_social = v_name,
        nome_fantasia = nullif(trim(v_payload->>'nome_fantasia'), ''),
        inscricao_estadual = nullif(trim(v_payload->>'inscricao_estadual'), ''),
        responsavel_nome = v_responsible,
        email = v_email,
        telefone = v_phone,
        cep = nullif(v_zip, ''),
        endereco = nullif(trim(v_payload->>'endereco'), ''),
        numero = nullif(trim(v_payload->>'numero'), ''),
        complemento = nullif(trim(v_payload->>'complemento'), ''),
        bairro = nullif(trim(v_payload->>'bairro'), ''),
        cidade = nullif(trim(v_payload->>'cidade'), ''),
        estado = nullif(upper(trim(v_payload->>'estado')), ''),
        observacoes = nullif(trim(v_payload->>'observacoes'), ''),
        status = 'pendente',
        motivo_status = NULL,
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
    v_updated := true;

    INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, acao, entidade, entidade_id, detalhes)
    VALUES (v_id, 'publico', 'REENVIAR_PRE_CADASTRO', 'fornecedores', v_id,
      jsonb_build_object('documento_final', right(v_document, 4), 'status_anterior', v_existing.status));

    INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
    VALUES (
      'Fornecedor reenviou dados para analise', v_name || ' corrigiu e reenviou o cadastro.',
      'fornecedores', 'cadastros', v_id::text, 'sistema', 'admin', 'alta',
      'cadastro_fornecedor_reenviado', jsonb_build_object('fornecedor_id', v_id)
    );
  ELSE
    INSERT INTO public.fornecedores(
      tipo_pessoa, documento, razao_social, nome_fantasia, inscricao_estadual,
      responsavel_nome, email, telefone, cep, endereco, numero, complemento,
      bairro, cidade, estado, observacoes, status
    ) VALUES (
      v_type, v_document, v_name, nullif(trim(v_payload->>'nome_fantasia'), ''),
      nullif(trim(v_payload->>'inscricao_estadual'), ''), v_responsible, v_email, v_phone,
      nullif(v_zip, ''), nullif(trim(v_payload->>'endereco'), ''), nullif(trim(v_payload->>'numero'), ''),
      nullif(trim(v_payload->>'complemento'), ''), nullif(trim(v_payload->>'bairro'), ''),
      nullif(trim(v_payload->>'cidade'), ''), nullif(upper(trim(v_payload->>'estado')), ''),
      nullif(trim(v_payload->>'observacoes'), ''), 'pendente'
    ) RETURNING id INTO v_id;

    INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, acao, entidade, entidade_id, detalhes)
    VALUES (v_id, 'publico', 'PRE_CADASTRO', 'fornecedores', v_id, jsonb_build_object('documento_final', right(v_document, 4)));

    INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
    VALUES (
      'Novo fornecedor aguardando analise', v_name || ' enviou um pre-cadastro.',
      'fornecedores', 'cadastros', v_id::text, 'sistema', 'admin', 'alta',
      'cadastro_fornecedor', jsonb_build_object('fornecedor_id', v_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'fornecedor_id', v_id, 'status', 'pendente', 'updated', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_supplier_update_profile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_zip text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_bank jsonb := coalesce(v_payload->'dados_bancarios', '{}'::jsonb);
  v_bank_clean jsonb;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_zip <> '' AND length(v_zip) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF jsonb_typeof(v_bank) <> 'object' THEN RAISE EXCEPTION 'Dados bancarios invalidos.'; END IF;

  v_bank_clean := jsonb_strip_nulls(jsonb_build_object(
    'banco', nullif(left(trim(coalesce(v_bank->>'banco', '')), 120), ''),
    'agencia', nullif(left(trim(coalesce(v_bank->>'agencia', '')), 40), ''),
    'conta', nullif(left(trim(coalesce(v_bank->>'conta', '')), 60), ''),
    'tipo_conta', nullif(left(trim(coalesce(v_bank->>'tipo_conta', '')), 40), ''),
    'tipo_chave_pix', nullif(left(trim(coalesce(v_bank->>'tipo_chave_pix', '')), 40), ''),
    'chave_pix', nullif(left(trim(coalesce(v_bank->>'chave_pix', '')), 180), ''),
    'titular', nullif(left(trim(coalesce(v_bank->>'titular', '')), 180), ''),
    'documento_titular', nullif(left(regexp_replace(coalesce(v_bank->>'documento_titular', ''), '\D', '', 'g'), 14), '')
  ));

  UPDATE public.fornecedores
  SET email = v_email,
      telefone = v_phone,
      cep = nullif(v_zip, ''),
      endereco = nullif(left(trim(coalesce(v_payload->>'endereco', '')), 220), ''),
      numero = nullif(left(trim(coalesce(v_payload->>'numero', '')), 40), ''),
      complemento = nullif(left(trim(coalesce(v_payload->>'complemento', '')), 120), ''),
      bairro = nullif(left(trim(coalesce(v_payload->>'bairro', '')), 120), ''),
      cidade = nullif(left(trim(coalesce(v_payload->>'cidade', '')), 120), ''),
      estado = nullif(left(upper(trim(coalesce(v_payload->>'estado', ''))), 2), ''),
      dados_bancarios = v_bank_clean,
      updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (v_id, 'fornecedor', v_id, 'ATUALIZAR_PERFIL', 'fornecedores', v_id,
    jsonb_build_object('dados_bancarios_informados', v_bank_clean <> '{}'::jsonb));

  RETURN jsonb_build_object('success', true, 'supplier_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_supplier_update_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_update_profile(jsonb) TO authenticated;

COMMIT;
