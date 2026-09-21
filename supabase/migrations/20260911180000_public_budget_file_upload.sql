-- ====================================================================================
-- MIGRATION: PUBLIC BUDGET FILE UPLOAD STORAGE & RPC SUPPORT
-- Criação do bucket 'orcamentos-anexos', políticas de storage e atualização das RPCs
-- ====================================================================================

BEGIN;

-- 1. Criação do bucket de anexos para orçamentos (documentos, imagens, planilhas, PDFs até 15MB)
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'orcamentos-anexos',
  'orcamentos-anexos',
  true,
  15728640, -- 15 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas de Storage para o bucket orcamentos-anexos
DROP POLICY IF EXISTS "Public orcamentos anexos insert" ON storage.objects;
DROP POLICY IF EXISTS "Public orcamentos anexos select" ON storage.objects;

CREATE POLICY "Public orcamentos anexos insert"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'orcamentos-anexos'
  AND (storage.foldername(name))[1] = 'public'
);

CREATE POLICY "Public orcamentos anexos select"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'orcamentos-anexos'
);

-- 3. Atualiza gsa_public_create_enterprise_budget para aceitar e persistir anexos
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
  v_anexos jsonb := CASE
    WHEN jsonb_typeof(v_payload->'anexos') = 'array' THEN v_payload->'anexos'
    ELSE '[]'::jsonb
  END;
  v_hash text;
  v_id uuid;
  v_codigo text;
  v_existing record;
BEGIN
  IF pg_column_size(v_payload) > 65536 THEN RAISE EXCEPTION 'Solicitacao excede o limite permitido.'; END IF;
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
    IF jsonb_array_length(v_anexos) > 0 THEN
      UPDATE public.orcamentos
         SET anexos = coalesce(anexos, '[]'::jsonb) || v_anexos
       WHERE id = v_existing.id;
    END IF;

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
    origem_gsa_store, contato_publico, public_request_hash, anexos
  ) VALUES (
    NULL, v_codigo, 'aberto', 'servico', current_date,
    'Criacao de ' || v_tipo_label || ' - ' || v_nome,
    v_solicitacao, 'media',
    'Solicitacao publica de ' || lower(v_tipo_label) || E'\n\n' ||
      'Nome: ' || v_nome || E'\nE-mail: ' || v_email || E'\nTelefone: ' || v_phone ||
      E'\nTipo solicitado: ' || v_tipo_label || E'\n\nDescricao da solicitacao:\n' || v_solicitacao ||
      CASE WHEN jsonb_array_length(v_anexos) > 0 THEN E'\n\n[Possui ' || jsonb_array_length(v_anexos) || ' anexo(s) enviado(s)]' ELSE '' END,
    0, 0, 1, false,
    jsonb_build_object(
      'nome', v_nome,
      'email', v_email,
      'telefone', v_phone,
      'tipo', v_tipo_code,
      'tipo_label', v_tipo_label,
      'metadata', coalesce(v_payload->'metadata', '{}'::jsonb),
      'anexos', v_anexos
    ),
    v_hash,
    v_anexos
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id, tipo,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Nova solicitacao publica de orcamento',
    v_nome || ' solicitou orcamento para ' || v_tipo_label || '.' || CASE WHEN jsonb_array_length(v_anexos) > 0 THEN ' (com anexos)' ELSE '' END,
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
      'tipo_label', v_tipo_label,
      'tem_anexos', (jsonb_array_length(v_anexos) > 0)
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

-- 4. Atualiza gsa_public_create_enterprise_budget_v2 para propagar anexos
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
  v_anexos jsonb;
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
  v_anexos := CASE
    WHEN jsonb_typeof(p_payload->'anexos') = 'array' THEN p_payload->'anexos'
    ELSE '[]'::jsonb
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
    'anexos', v_anexos,
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

-- 5. Atualiza gsa_public_create_brand_budget_v1 para repassar anexos
CREATE OR REPLACE FUNCTION public.gsa_public_create_brand_budget_v1(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_type text := lower(trim(coalesce(v_payload->>'tipo', '')));
  v_label text;
  v_name text := trim(coalesce(v_payload->>'nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_request text := trim(coalesce(v_payload->>'solicitacao', ''));
  v_anexos jsonb := CASE
    WHEN jsonb_typeof(v_payload->'anexos') = 'array' THEN v_payload->'anexos'
    ELSE '[]'::jsonb
  END;
  v_forward jsonb;
  v_result jsonb;
  v_budget_id uuid;
  v_contact jsonb;
BEGIN
  v_label := CASE v_type
    WHEN 'nome_marca' THEN 'Criacao de nome e posicionamento'
    WHEN 'logo' THEN 'Criacao de logo e logomarca'
    WHEN 'identidade_visual' THEN 'Identidade visual e branding'
    WHEN 'redes_sociais' THEN 'Estruturacao de redes sociais'
    WHEN 'social_media' THEN 'Social media, posts e publicacoes'
    WHEN 'marketing_digital' THEN 'Estrategia digital e campanhas'
    WHEN 'jornada_completa' THEN 'Empresa do zero ao digital'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Tipo de projeto de marca invalido.' USING ERRCODE = '22023';
  END IF;

  v_forward := jsonb_set(v_payload, '{tipo}', to_jsonb('site'::text), true);
  v_forward := jsonb_set(
    v_forward,
    '{solicitacao}',
    to_jsonb(left('[Servico solicitado: ' || v_label || '] ' || v_request, 2000)),
    true
  );
  v_forward := jsonb_set(
    v_forward,
    '{anexos}',
    v_anexos,
    true
  );
  v_forward := jsonb_set(
    v_forward,
    '{metadata}',
    coalesce(v_payload->'metadata', '{}'::jsonb) || jsonb_build_object(
      'source', 'public_brand_journey',
      'requested_type', v_type,
      'requested_type_label', v_label
    ),
    true
  );

  SELECT public.gsa_public_create_enterprise_budget_v2(v_forward)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Nao foi possivel registrar a solicitacao de marca.' USING ERRCODE = 'P0001';
  END IF;

  v_budget_id := nullif(v_result->>'budget_id', '')::uuid;
  IF v_budget_id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT coalesce(contato_publico, '{}'::jsonb)
    INTO v_contact
    FROM public.orcamentos
   WHERE id = v_budget_id
   FOR UPDATE;

  UPDATE public.orcamentos
     SET titulo_solicitacao = v_label || ' - ' || v_name,
         descricao_solicitacao = v_request,
         observacoes_servico =
           'Solicitacao publica de ' || lower(v_label) || E'\n\n' ||
           'Nome: ' || v_name || E'\nE-mail: ' || v_email || E'\nTelefone: ' || v_phone ||
           E'\nTipo solicitado: ' || v_label || E'\n\nDescricao da solicitacao:\n' || v_request ||
           CASE WHEN jsonb_array_length(v_anexos) > 0 THEN E'\n\n[Possui ' || jsonb_array_length(v_anexos) || ' anexo(s) enviado(s)]' ELSE '' END,
         contato_publico = coalesce(v_contact, '{}'::jsonb) || jsonb_build_object(
           'nome', v_name,
           'email', v_email,
           'telefone', v_phone,
           'tipo', v_type,
           'tipo_label', v_label,
           'origem', 'public_brand_journey',
           'anexos', v_anexos
         )
   WHERE id = v_budget_id;

  UPDATE public.notificacoes
     SET mensagem = v_name || ' solicitou orcamento para ' || v_label || '.' || CASE WHEN jsonb_array_length(v_anexos) > 0 THEN ' (com anexos)' ELSE '' END,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'origem', 'pagina_empresa_zero_ao_digital',
           'tipo', v_type,
           'tipo_label', v_label,
           'tem_anexos', (jsonb_array_length(v_anexos) > 0)
         )
   WHERE item_id = v_budget_id::text
     AND acao_origem = 'orcamento_criado';

  RETURN v_result || jsonb_build_object(
    'requested_type', v_type,
    'requested_type_label', v_label
  );
END;
$$;

-- 6. Garantir permissões estritas
REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_create_brand_budget_v1(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_brand_budget_v1(jsonb) TO service_role;

COMMIT;
