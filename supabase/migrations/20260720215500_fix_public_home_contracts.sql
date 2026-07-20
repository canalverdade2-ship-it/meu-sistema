-- Corrige contratos e privacidade dos fluxos públicos da Home.
-- Não altera o fluxo de recuperação de senha, tratado separadamente.

CREATE OR REPLACE FUNCTION public.gsa_public_lookup_referral(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := trim(coalesce(p_token, ''));
  v_phone text := regexp_replace(coalesce(p_token, ''), '\D', '', 'g');
  v_default_active boolean := false;
  v_default_code text;
  v_indicacao public.indicacoes%rowtype;
BEGIN
  IF length(v_token) < 4 OR length(v_token) > 64 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  PERFORM public.gsa_assert_public_rate_limit('indicacao_consulta_ip', 'consulta', 30, interval '15 minutes');
  PERFORM public.gsa_assert_public_rate_limit('indicacao_consulta_token', lower(v_token), 8, interval '15 minutes');

  SELECT coalesce(value, 'false') = 'true' INTO v_default_active
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao_ativo';
  SELECT value INTO v_default_code
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao';

  IF v_default_active AND upper(v_token) = upper(coalesce(v_default_code, '')) THEN
    RETURN jsonb_build_object('valid', true, 'kind', 'default');
  END IF;

  IF length(v_phone) <> 11 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  SELECT * INTO v_indicacao
    FROM public.indicacoes
   WHERE whatsapp_indicado = v_phone
     AND status = 'aberta'
     AND data_cadastro_indicado IS NULL
     AND coalesce(data_indicacao, current_date - 16) >= current_date - 15
   ORDER BY data_criacao ASC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'kind', 'referral',
    'indicacao_id', v_indicacao.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_lookup_referral(text) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_public_lookup_referral(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_public_register_client(
  p_referral_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_token text := trim(coalesce(p_referral_token, ''));
  v_tipo text := lower(trim(coalesce(v_payload->>'tipo_pessoa', '')));
  v_nome text := trim(coalesce(v_payload->>'nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_doc text;
  v_default_active boolean := false;
  v_default_code text;
  v_is_default boolean := false;
  v_indicacao public.indicacoes%rowtype;
  v_cliente_id uuid;
  v_codigo text;
  v_reward_type text;
  v_reward_points integer := 0;
BEGIN
  IF pg_column_size(v_payload) > 32768 THEN RAISE EXCEPTION 'Dados de cadastro excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_cliente_ip', 'cadastro', 6, interval '1 hour');

  IF v_tipo NOT IN ('pf', 'pj') THEN RAISE EXCEPTION 'Tipo de pessoa invalido.'; END IF;
  v_doc := regexp_replace(coalesce(CASE WHEN v_tipo = 'pf' THEN v_payload->>'cpf' ELSE v_payload->>'cnpj' END, ''), '\D', '', 'g');
  IF v_tipo = 'pf' AND NOT public.gsa_is_valid_cpf(v_doc) THEN RAISE EXCEPTION 'CPF invalido.'; END IF;
  IF v_tipo = 'pj' AND NOT public.gsa_is_valid_cnpj(v_doc) THEN RAISE EXCEPTION 'CNPJ invalido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_cliente_documento', v_doc, 3, interval '1 hour');

  IF length(v_nome) < 3 OR length(v_nome) > 180 THEN RAISE EXCEPTION 'Informe o nome completo ou razao social.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) <> 11 THEN RAISE EXCEPTION 'O telefone deve conter DDD e 11 numeros.'; END IF;
  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF nullif(trim(v_payload->>'numero'), '') IS NULL THEN RAISE EXCEPTION 'Numero do endereco obrigatorio.'; END IF;
  IF length(trim(coalesce(v_payload->>'endereco', ''))) < 3 THEN RAISE EXCEPTION 'Endereco obrigatorio.'; END IF;
  IF length(trim(coalesce(v_payload->>'bairro', ''))) < 2 THEN RAISE EXCEPTION 'Bairro obrigatorio.'; END IF;
  IF length(trim(coalesce(v_payload->>'cidade', ''))) < 2 THEN RAISE EXCEPTION 'Cidade obrigatoria.'; END IF;
  IF upper(trim(coalesce(v_payload->>'estado', ''))) !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF invalida.'; END IF;
  IF length(coalesce(v_payload->>'observacoes', '')) > 2000 THEN RAISE EXCEPTION 'Observacoes excedem o limite permitido.'; END IF;

  SELECT coalesce(value, 'false') = 'true' INTO v_default_active
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao_ativo';
  SELECT value INTO v_default_code
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao';

  IF v_default_active AND upper(v_token) = upper(coalesce(v_default_code, '')) THEN
    v_is_default := true;
  ELSE
    IF regexp_replace(v_token, '\D', '', 'g') <> v_phone THEN
      RAISE EXCEPTION 'Codigo ou indicacao invalida.';
    END IF;

    SELECT * INTO v_indicacao
      FROM public.indicacoes
     WHERE whatsapp_indicado = v_phone
       AND status = 'aberta'
       AND data_cadastro_indicado IS NULL
       AND coalesce(data_indicacao, current_date - 16) >= current_date - 15
     ORDER BY data_criacao ASC NULLS LAST
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Codigo ou indicacao invalida.'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.clientes WHERE (v_tipo = 'pf' AND cpf = v_doc) OR (v_tipo = 'pj' AND cnpj = v_doc) OR telefone = v_phone) THEN
    RAISE EXCEPTION 'Cadastro nao concluido. Verifique os dados ou procure o suporte.';
  END IF;

  v_codigo := public.gsa_generate_code('CLI');

  INSERT INTO public.clientes(
    codigo_cliente, nome, email, cpf, cnpj, tipo_pessoa, telefone,
    cep, endereco, numero, bairro, cidade, estado, observacoes,
    status, carteira_bloqueada, pontos_bloqueados, cadastro_aprovado,
    bonus_boas_vindas_pendente, indicacao_origem_id, data_cadastro
  ) VALUES (
    v_codigo, v_nome, v_email,
    CASE WHEN v_tipo = 'pf' THEN v_doc END,
    CASE WHEN v_tipo = 'pj' THEN v_doc END,
    v_tipo, v_phone, v_cep, trim(v_payload->>'endereco'), trim(v_payload->>'numero'),
    trim(v_payload->>'bairro'), trim(v_payload->>'cidade'), upper(trim(v_payload->>'estado')),
    nullif(trim(coalesce(v_payload->>'observacoes', '')), ''),
    CASE WHEN v_is_default THEN 'inativo' ELSE 'ativo' END,
    v_is_default, v_is_default, NOT v_is_default,
    v_is_default, CASE WHEN v_is_default THEN NULL ELSE v_indicacao.id END, now()
  ) RETURNING id INTO v_cliente_id;

  IF NOT v_is_default THEN
    UPDATE public.indicacoes SET data_cadastro_indicado = now() WHERE id = v_indicacao.id;
    IF v_indicacao.voucher_id IS NOT NULL THEN
      UPDATE public.vouchers SET cliente_id = v_cliente_id WHERE id = v_indicacao.voucher_id;
    END IF;

    SELECT coalesce(value, 'desconto') INTO v_reward_type FROM public.system_settings WHERE key = 'indicado_recompensa_tipo';
    SELECT greatest(0, coalesce(nullif(value, '')::numeric, 0))::integer INTO v_reward_points FROM public.system_settings WHERE key = 'indicado_valor_pontos';

    IF v_reward_type IN ('pontos', 'ambos') AND coalesce(v_reward_points, 0) > 0 THEN
      PERFORM public.gsa_apply_points_internal(v_cliente_id, v_reward_points, 'Bonus de indicacao - boas-vindas', 'indicacao', NULL, false);
      INSERT INTO public.notificacoes(cliente_id, titulo, mensagem, modulo, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
      VALUES (v_cliente_id, 'Pontos de boas-vindas', 'Voce recebeu ' || v_reward_points || ' pontos por ter sido indicado.', 'pontos', 'sistema', 'cliente', 'normal', 'bonus_indicacao_cadastro', jsonb_build_object('indicacao_id', v_indicacao.id, 'pontos', v_reward_points));
    END IF;
  END IF;

  INSERT INTO public.notificacoes(cliente_id, titulo, mensagem, modulo, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    v_cliente_id,
    CASE WHEN v_is_default THEN 'Cadastro recebido' ELSE 'Bem-vindo ao Grupo GSA' END,
    CASE WHEN v_is_default THEN 'Seu cadastro foi recebido e aguarda analise administrativa.' ELSE 'Seu cadastro foi criado com sucesso. Bem-vindo ao portal.' END,
    'dashboard', 'sistema', 'cliente', 'normal', 'cadastro_cliente',
    jsonb_build_object('origem', CASE WHEN v_is_default THEN 'codigo_padrao' ELSE 'indicacao' END)
  );

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    'Novo cadastro de cliente',
    'O cliente ' || v_nome || ' realizou cadastro' || CASE WHEN v_is_default THEN ' pelo codigo padrao.' ELSE ' por indicacao.' END,
    'cadastro', CASE WHEN v_is_default THEN 'pendentes' ELSE 'ativos' END, v_cliente_id::text,
    'sistema', 'admin', 'alta', 'cadastro_cliente',
    jsonb_build_object('cliente_id', v_cliente_id, 'indicacao_id', CASE WHEN v_is_default THEN NULL ELSE v_indicacao.id END)
  );

  RETURN jsonb_build_object('success', true, 'cliente_id', v_cliente_id, 'codigo_cliente', v_codigo, 'status', CASE WHEN v_is_default THEN 'pendente' ELSE 'ativo' END);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Cadastro nao concluido. Verifique os dados ou procure o suporte.';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_register_client(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_client(text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_public_register_provider(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_tipo text := lower(trim(coalesce(v_payload->>'tipo_cadastro', '')));
  v_nome text := trim(coalesce(v_payload->>'nome_razao', ''));
  v_doc text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(v_payload->>'email', ''));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_id uuid;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_prestador_ip', 'cadastro', 5, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('cadastro_prestador_documento', v_doc, 3, interval '1 hour');

  IF v_tipo NOT IN ('cpf', 'cnpj') THEN RAISE EXCEPTION 'Tipo de documento invalido.'; END IF;
  IF v_tipo = 'cpf' AND NOT public.gsa_is_valid_cpf(v_doc) THEN RAISE EXCEPTION 'CPF invalido.'; END IF;
  IF v_tipo = 'cnpj' AND NOT public.gsa_is_valid_cnpj(v_doc) THEN RAISE EXCEPTION 'CNPJ invalido.'; END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 180 THEN RAISE EXCEPTION 'Informe o nome ou razao social.'; END IF;
  IF v_tipo = 'cnpj' AND length(trim(coalesce(v_payload->>'nome_responsavel', ''))) < 3 THEN RAISE EXCEPTION 'Informe o responsavel pela empresa.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_cep <> '' AND length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF length(trim(coalesce(v_payload->>'area_servico', ''))) < 2 THEN RAISE EXCEPTION 'Informe a area de servico.'; END IF;
  IF length(coalesce(v_payload->>'observacoes', '')) > 2000 THEN RAISE EXCEPTION 'Observacoes excedem o limite permitido.'; END IF;
  IF EXISTS (SELECT 1 FROM public.prestadores WHERE documento = v_doc) THEN
    RAISE EXCEPTION 'Cadastro nao concluido. Verifique os dados ou procure o suporte.';
  END IF;

  INSERT INTO public.prestadores(tipo_cadastro, nome_razao, nome_responsavel, documento, email, telefone, cep, numero, area_servico, observacoes, status)
  VALUES (
    v_tipo, v_nome,
    CASE WHEN v_tipo = 'cnpj' THEN trim(v_payload->>'nome_responsavel') END,
    v_doc, v_email, v_phone, nullif(v_cep, ''), nullif(trim(v_payload->>'numero'), ''),
    trim(v_payload->>'area_servico'), nullif(trim(coalesce(v_payload->>'observacoes', '')), ''), 'pendente'
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES ('Novo pre-cadastro de prestador', 'O prestador ' || v_nome || ' realizou um pre-cadastro e aguarda analise.', 'cadastro', 'pendente', v_id::text, 'sistema', 'admin', 'alta', 'cadastro_prestador', jsonb_build_object('prestador_id', v_id));

  RETURN jsonb_build_object('success', true, 'prestador_id', v_id, 'status', 'pendente');
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Cadastro nao concluido. Verifique os dados ou procure o suporte.';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_register_provider(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_provider(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_nome text := trim(coalesce(v_payload->>'nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_tipo_code text := lower(trim(coalesce(v_payload->>'tipo', '')));
  v_tipo_label text;
  v_solicitacao text := trim(coalesce(v_payload->>'solicitacao', ''));
  v_hash text;
  v_id uuid;
  v_codigo text;
  v_existing record;
BEGIN
  IF pg_column_size(v_payload) > 32768 THEN RAISE EXCEPTION 'Solicitacao excede o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('orcamento_publico_ip', 'solicitacao', 5, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('orcamento_publico_email', v_email, 3, interval '1 hour');

  v_tipo_label := CASE v_tipo_code
    WHEN 'site' THEN 'Site institucional ou landing page'
    WHEN 'loja' THEN 'Loja virtual'
    WHEN 'portal' THEN 'Portal de clientes'
    WHEN 'sistema' THEN 'Sistema web'
    WHEN 'aplicativo' THEN 'Aplicativo mobile'
    WHEN 'automacao' THEN 'Automacao de processos'
    WHEN 'suporte' THEN 'Suporte e relacionamento'
    ELSE NULL
  END;

  IF length(v_nome) < 3 OR length(v_nome) > 180 THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_tipo_label IS NULL THEN RAISE EXCEPTION 'Tipo de projeto invalido.'; END IF;
  IF length(v_solicitacao) < 20 OR length(v_solicitacao) > 5000 THEN
    RAISE EXCEPTION 'Descreva a solicitacao com pelo menos 20 e no maximo 5000 caracteres.';
  END IF;

  v_hash := encode(extensions.digest(lower(v_nome) || '|' || v_email || '|' || v_phone || '|' || v_tipo_code || '|' || lower(v_solicitacao) || '|' || current_date::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_hash, 0));

  SELECT id, codigo_orcamento INTO v_existing FROM public.orcamentos WHERE public_request_hash = v_hash LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true, 'orcamento_id', v_existing.id, 'codigo_orcamento', v_existing.codigo_orcamento);
  END IF;

  v_codigo := public.gsa_generate_code('ORC');
  INSERT INTO public.orcamentos(
    cliente_id, codigo_orcamento, status, categoria, data_criacao,
    titulo_solicitacao, descricao_solicitacao, nivel_prioridade,
    observacoes_servico, total, valor_servico, quantidade,
    origem_gsa_store, contato_publico, public_request_hash
  ) VALUES (
    NULL, v_codigo, 'aberto', 'servico', current_date,
    'Criacao de ' || v_tipo_label || ' - ' || v_nome,
    v_solicitacao, 'media',
    'Solicitacao publica de ' || lower(v_tipo_label) || E'\n\n' ||
      'Nome: ' || v_nome || E'\nE-mail: ' || v_email || E'\nTelefone: ' || v_phone ||
      E'\nTipo solicitado: ' || v_tipo_label || E'\n\nDescricao da solicitacao:\n' || v_solicitacao,
    0, 0, 1, false,
    jsonb_build_object('nome', v_nome, 'email', v_email, 'telefone', v_phone, 'tipo', v_tipo_code, 'tipo_label', v_tipo_label),
    v_hash
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    'Nova solicitacao publica de orcamento', v_nome || ' solicitou orcamento para ' || v_tipo_label || '.',
    'vendas', 'abertos', v_id::text, 'sistema', 'admin', 'alta', 'orcamento_criado',
    jsonb_build_object('origem', 'pagina_criacao_site_sistemas', 'orcamento_id', v_id, 'codigo', v_codigo, 'nome', v_nome, 'email', v_email, 'telefone', v_phone, 'tipo', v_tipo_code, 'tipo_label', v_tipo_label)
  );

  RETURN jsonb_build_object('success', true, 'already_exists', false, 'orcamento_id', v_id, 'codigo_orcamento', v_codigo);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) TO anon, authenticated;
