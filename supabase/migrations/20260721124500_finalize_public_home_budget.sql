-- Fecha os achados finais do orçamento público da Home.
-- O código exibido ao solicitante passa a ser o mesmo codigo_orcamento persistido.
-- A rotina pública v2 fica acessível somente pelo gateway Edge com limite por IP.

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
    WHEN 'integracao' THEN 'Integracao entre sistemas'
    WHEN 'suporte' THEN 'Suporte e relacionamento'
    ELSE NULL
  END;

  IF length(v_nome) < 2 OR length(v_nome) > 120 THEN RAISE EXCEPTION 'Informe um nome valido.'; END IF;
  IF length(v_email) > 160 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_tipo_label IS NULL THEN RAISE EXCEPTION 'Tipo de projeto invalido.'; END IF;
  IF length(v_solicitacao) < 20 OR length(v_solicitacao) > 2000 THEN
    RAISE EXCEPTION 'Descreva a solicitacao com pelo menos 20 e no maximo 2000 caracteres.';
  END IF;

  v_hash := encode(extensions.digest(lower(v_nome) || '|' || v_email || '|' || v_phone || '|' || v_tipo_code || '|' || lower(v_solicitacao) || '|' || current_date::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_hash, 0));

  SELECT id, codigo_orcamento INTO v_existing
  FROM public.orcamentos
  WHERE public_request_hash = v_hash
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'orcamento_id', v_existing.id,
      'codigo_orcamento', v_existing.codigo_orcamento
    );
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
    jsonb_build_object(
      'nome', v_nome,
      'email', v_email,
      'telefone', v_phone,
      'tipo', v_tipo_code,
      'tipo_label', v_tipo_label,
      'metadata', coalesce(v_payload->'metadata', '{}'::jsonb)
    ),
    v_hash
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id, tipo,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Nova solicitacao publica de orcamento',
    v_nome || ' solicitou orcamento para ' || v_tipo_label || '.',
    'vendas', 'abertos', v_id::text, 'sistema',
    'admin', 'alta', 'orcamento_criado',
    jsonb_build_object(
      'origem', 'pagina_criacao_site_sistemas',
      'orcamento_id', v_id,
      'codigo', v_codigo,
      'nome', v_nome,
      'email', v_email,
      'telefone', v_phone,
      'tipo', v_tipo_code,
      'tipo_label', v_tipo_label
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'orcamento_id', v_id,
    'codigo_orcamento', v_codigo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_type text;
  v_request text;
  v_honeypot text;
  v_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_decoy_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
  v_internal jsonb;
  v_persisted_protocol text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitacao invalidos.' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'nome', ''));
  v_email := lower(btrim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'telefone', ''), '\D', '', 'g');
  v_type := lower(btrim(COALESCE(p_payload->>'tipo', '')));
  v_request := btrim(COALESCE(p_payload->>'solicitacao', ''));
  v_honeypot := btrim(COALESCE(p_payload->>'website', ''));
  v_metadata := CASE
    WHEN jsonb_typeof(p_payload->'metadata') = 'object' THEN p_payload->'metadata'
    ELSE '{}'::jsonb
  END;

  v_decoy_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robos recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_decoy_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone invalido.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descricao invalida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(v_email || ':' || v_phone);
  INSERT INTO public.gsa_public_budget_rate_limits(
    fingerprint, window_started_at, attempts, updated_at
  ) VALUES (
    v_fingerprint, v_now, 0, v_now
  ) ON CONFLICT (fingerprint) DO NOTHING;

  SELECT * INTO v_rate
  FROM public.gsa_public_budget_rate_limits
  WHERE fingerprint = v_fingerprint
  FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_rate.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET window_started_at = v_now,
        attempts = 0,
        blocked_until = NULL,
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    v_rate.attempts := 0;
  END IF;

  IF v_rate.attempts >= 4 THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET blocked_until = v_now + interval '2 hours',
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_public_budget_rate_limits
  SET attempts = attempts + 1,
      updated_at = v_now
  WHERE fingerprint = v_fingerprint;

  v_sanitized := jsonb_build_object(
    'nome', v_name,
    'email', v_email,
    'telefone', v_phone,
    'tipo', v_type,
    'solicitacao', v_request,
    'origem', 'public_sites_systems',
    'data_envio', v_now,
    'metadata', jsonb_build_object(
      'source', left(COALESCE(v_metadata->>'source', 'public_sites_systems'), 80),
      'page', left(COALESCE(v_metadata->>'page', ''), 300),
      'referrer', left(COALESCE(v_metadata->>'referrer', ''), 500),
      'utm_source', left(COALESCE(v_metadata->>'utm_source', ''), 120),
      'utm_medium', left(COALESCE(v_metadata->>'utm_medium', ''), 120),
      'utm_campaign', left(COALESCE(v_metadata->>'utm_campaign', ''), 160),
      'utm_content', left(COALESCE(v_metadata->>'utm_content', ''), 160)
    )
  );

  SELECT public.gsa_public_create_enterprise_budget(v_sanitized) INTO v_internal;
  v_persisted_protocol := nullif(v_internal->>'codigo_orcamento', '');
  IF NOT coalesce((v_internal->>'success')::boolean, false) OR v_persisted_protocol IS NULL THEN
    RAISE EXCEPTION 'Servico de orcamento indisponivel.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.gsa_public_budget_rate_limits
  WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_persisted_protocol,
    'budget_id', v_internal->>'orcamento_id',
    'already_exists', coalesce((v_internal->>'already_exists')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) TO service_role;

COMMENT ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb)
IS 'Valida e persiste solicitacoes por meio do gateway Edge gsa-public-budget; retorna o codigo real do orcamento.';
