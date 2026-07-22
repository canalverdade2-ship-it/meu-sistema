-- Catálogo único de serviços e pacotes, administrado pela Loja GSA Store.

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'ambos',
  ADD COLUMN IF NOT EXISTS ocultar_valor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visivel_na_loja boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitulo_catalogo text,
  ADD COLUMN IF NOT EXISTS visivel_catalogo_publico boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disponivel_orcamento boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem_catalogo integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.servicos_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pacote text NOT NULL UNIQUE,
  titulo text NOT NULL,
  subtitulo text,
  descricao text NOT NULL DEFAULT '',
  publico text NOT NULL DEFAULT 'pf' CHECK (publico IN ('pf', 'pj', 'ambos')),
  servico_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  visivel_catalogo_publico boolean NOT NULL DEFAULT true,
  disponivel_orcamento boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS pacote_servico_id uuid REFERENCES public.servicos_pacotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servicos_catalogo_ativo
  ON public.servicos (status, disponivel_orcamento, visivel_catalogo_publico, tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_servicos_pacotes_catalogo_ativo
  ON public.servicos_pacotes (status, disponivel_orcamento, visivel_catalogo_publico, publico, ordem);
CREATE INDEX IF NOT EXISTS idx_orcamentos_pacote_servico
  ON public.orcamentos (pacote_servico_id);

CREATE OR REPLACE FUNCTION public.gsa_touch_service_package_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_touch_service_package_updated_at ON public.servicos_pacotes;
CREATE TRIGGER trg_gsa_touch_service_package_updated_at
BEFORE UPDATE ON public.servicos_pacotes
FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_service_package_updated_at();

ALTER TABLE public.servicos_pacotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.servicos_pacotes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_service_catalog_payload(
  p_publico text DEFAULT NULL,
  p_include_inactive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_publico text := lower(NULLIF(trim(COALESCE(p_publico, '')), ''));
  v_services jsonb;
  v_packages jsonb;
BEGIN
  IF v_publico IS NOT NULL AND v_publico NOT IN ('pf', 'pj') THEN
    RAISE EXCEPTION 'Perfil de catálogo inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'code', s.codigo_servico,
    'name', s.nome,
    'title', s.nome,
    'subtitle', s.subtitulo_catalogo,
    'description', COALESCE(s.descricao, ''),
    'audience', upper(COALESCE(s.tipo_cliente, 'ambos')),
    'price', COALESCE(s.valor, 0),
    'hidePrice', COALESCE(s.ocultar_valor, false),
    'status', s.status,
    'publicVisible', COALESCE(s.visivel_catalogo_publico, true),
    'quoteAvailable', COALESCE(s.disponivel_orcamento, true),
    'order', COALESCE(s.ordem_catalogo, 0)
  ) ORDER BY COALESCE(s.ordem_catalogo, 0), s.nome), '[]'::jsonb)
  INTO v_services
  FROM public.servicos s
  WHERE (p_include_inactive OR s.status = 'ativo')
    AND (p_include_inactive OR COALESCE(s.disponivel_orcamento, true))
    AND (p_include_inactive OR COALESCE(s.visivel_catalogo_publico, true))
    AND (v_publico IS NULL OR COALESCE(s.tipo_cliente, 'ambos') IN (v_publico, 'ambos'));

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'code', p.codigo_pacote,
      'title', p.titulo,
      'subtitle', COALESCE(p.subtitulo, ''),
      'description', COALESCE(p.descricao, ''),
      'audience', upper(p.publico),
      'serviceIds', to_jsonb(p.servico_ids),
      'services', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.nome,
          'desc', COALESCE(s.descricao, '')
        ) ORDER BY item.position)
        FROM unnest(p.servico_ids) WITH ORDINALITY AS item(service_id, position)
        JOIN public.servicos s ON s.id = item.service_id
        WHERE p_include_inactive OR s.status = 'ativo'
      ), '[]'::jsonb),
      'status', p.status,
      'publicVisible', p.visivel_catalogo_publico,
      'quoteAvailable', p.disponivel_orcamento,
      'order', p.ordem
    ) ORDER BY p.ordem, p.titulo
  ), '[]'::jsonb)
  INTO v_packages
  FROM public.servicos_pacotes p
  WHERE (p_include_inactive OR p.status = 'ativo')
    AND (p_include_inactive OR p.disponivel_orcamento)
    AND (p_include_inactive OR p.visivel_catalogo_publico)
    AND (v_publico IS NULL OR p.publico IN (v_publico, 'ambos'));

  RETURN jsonb_build_object('services', v_services, 'packages', v_packages);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_service_catalog(p_audience text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.gsa_service_catalog_payload(lower(NULLIF(trim(COALESCE(p_audience, '')), '')), false);
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_service_catalog(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_publico text;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(c.tipo_pessoa, 'pf') INTO v_publico
  FROM public.clientes c
  WHERE c.id = v_cliente_id;

  RETURN public.gsa_service_catalog_payload(v_publico, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_service_catalog_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('loja');
  RETURN public.gsa_service_catalog_payload(NULL, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_service_package(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_package_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_package_id;
  v_title text := trim(COALESCE(p_payload ->> 'title', ''));
  v_audience text := lower(COALESCE(p_payload ->> 'audience', 'pf'));
  v_status text := lower(COALESCE(p_payload ->> 'status', 'ativo'));
  v_service_ids uuid[] := ARRAY(
    SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(p_payload -> 'serviceIds', '[]'::jsonb))
  );
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('loja');

  IF length(v_title) < 3 THEN RAISE EXCEPTION 'Informe o nome do pacote.' USING ERRCODE = '22023'; END IF;
  IF v_audience NOT IN ('pf', 'pj', 'ambos') THEN RAISE EXCEPTION 'Público inválido.' USING ERRCODE = '22023'; END IF;
  IF v_status NOT IN ('ativo', 'inativo') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_service_ids) = 0 THEN RAISE EXCEPTION 'Selecione ao menos um serviço para o pacote.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(v_service_ids) AS item(service_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.servicos s WHERE s.id = item.service_id)
  ) THEN
    RAISE EXCEPTION 'Um dos serviços selecionados não existe.' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.servicos_pacotes (
      codigo_pacote, titulo, subtitulo, descricao, publico, servico_ids,
      status, visivel_catalogo_publico, disponivel_orcamento, ordem
    ) VALUES (
      'PCT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      v_title,
      NULLIF(trim(COALESCE(p_payload ->> 'subtitle', '')), ''),
      trim(COALESCE(p_payload ->> 'description', '')),
      v_audience,
      v_service_ids,
      v_status,
      COALESCE((p_payload ->> 'publicVisible')::boolean, true),
      COALESCE((p_payload ->> 'quoteAvailable')::boolean, true),
      COALESCE((p_payload ->> 'order')::integer, 0)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.servicos_pacotes SET
      titulo = v_title,
      subtitulo = NULLIF(trim(COALESCE(p_payload ->> 'subtitle', '')), ''),
      descricao = trim(COALESCE(p_payload ->> 'description', '')),
      publico = v_audience,
      servico_ids = v_service_ids,
      status = v_status,
      visivel_catalogo_publico = COALESCE((p_payload ->> 'publicVisible')::boolean, true),
      disponivel_orcamento = COALESCE((p_payload ->> 'quoteAvailable')::boolean, true),
      ordem = COALESCE((p_payload ->> 'order')::integer, 0)
    WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.' USING ERRCODE = 'P0002'; END IF;
  END IF;

  SELECT to_jsonb(p) INTO v_result FROM public.servicos_pacotes p WHERE p.id = v_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_service_package(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_package_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('loja');
  DELETE FROM public.servicos_pacotes WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_import_service_catalog(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_packages jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package jsonb;
  v_service jsonb;
  v_service_id uuid;
  v_package_id uuid;
  v_service_ids uuid[];
  v_audience text;
  v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('loja');

  FOR v_package IN SELECT value FROM jsonb_array_elements(COALESCE(p_packages, '[]'::jsonb)) LOOP
    v_audience := lower(COALESCE(v_package ->> 'audience', 'pf'));
    v_service_ids := '{}'::uuid[];

    FOR v_service IN SELECT value FROM jsonb_array_elements(COALESCE(v_package -> 'services', '[]'::jsonb)) LOOP
      SELECT s.id INTO v_service_id
      FROM public.servicos s
      WHERE lower(trim(s.nome)) = lower(trim(v_service ->> 'name'))
      ORDER BY s.created_at
      LIMIT 1;

      IF v_service_id IS NULL THEN
        INSERT INTO public.servicos (
          codigo_servico, nome, descricao, valor, status, tipo_cliente,
          ocultar_valor, visivel_na_loja, visivel_catalogo_publico, disponivel_orcamento
        ) VALUES (
          'CAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
          trim(v_service ->> 'name'),
          trim(COALESCE(v_service ->> 'desc', '')),
          0,
          'ativo',
          CASE WHEN v_audience IN ('pf', 'pj') THEN v_audience ELSE 'ambos' END,
          true,
          false,
          true,
          true
        ) RETURNING id INTO v_service_id;
      END IF;

      v_service_ids := array_append(v_service_ids, v_service_id);
      v_service_id := NULL;
    END LOOP;

    SELECT p.id INTO v_package_id
    FROM public.servicos_pacotes p
    WHERE lower(trim(p.titulo)) = lower(trim(v_package ->> 'title'))
      AND p.publico = v_audience
    LIMIT 1;

    PERFORM public.gsa_admin_save_service_package(
      p_sessao_id,
      p_session_token,
      v_package_id,
      jsonb_build_object(
        'title', v_package ->> 'title',
        'subtitle', v_package ->> 'subtitle',
        'description', v_package ->> 'description',
        'audience', v_audience,
        'serviceIds', to_jsonb(v_service_ids),
        'status', 'ativo',
        'publicVisible', true,
        'quoteAvailable', true,
        'order', v_count
      )
    );
    v_count := v_count + 1;
    v_package_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'importedPackages', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_create_service_quote(
  p_sessao_id uuid,
  p_session_token text,
  p_item_type text,
  p_item_id uuid,
  p_description text,
  p_priority text DEFAULT 'baixa',
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_publico text;
  v_type text := lower(trim(COALESCE(p_item_type, '')));
  v_title text;
  v_service_id uuid;
  v_package_id uuid;
  v_quote public.orcamentos%ROWTYPE;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501'; END IF;

  SELECT COALESCE(c.tipo_pessoa, 'pf') INTO v_publico FROM public.clientes c WHERE c.id = v_cliente_id;
  IF length(trim(COALESCE(p_description, ''))) < 5 THEN RAISE EXCEPTION 'Descreva sua solicitação.' USING ERRCODE = '22023'; END IF;
  IF p_priority NOT IN ('baixa', 'media', 'alta') THEN RAISE EXCEPTION 'Prioridade inválida.' USING ERRCODE = '22023'; END IF;

  IF v_type = 'service' THEN
    SELECT s.id, s.nome INTO v_service_id, v_title
    FROM public.servicos s
    WHERE s.id = p_item_id
      AND s.status = 'ativo'
      AND COALESCE(s.disponivel_orcamento, true)
      AND COALESCE(s.tipo_cliente, 'ambos') IN (v_publico, 'ambos');
    IF v_service_id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível para orçamento.' USING ERRCODE = '22023'; END IF;
  ELSIF v_type = 'package' THEN
    SELECT p.id, p.titulo INTO v_package_id, v_title
    FROM public.servicos_pacotes p
    WHERE p.id = p_item_id
      AND p.status = 'ativo'
      AND p.disponivel_orcamento
      AND p.publico IN (v_publico, 'ambos');
    IF v_package_id IS NULL THEN RAISE EXCEPTION 'Pacote indisponível para orçamento.' USING ERRCODE = '22023'; END IF;
  ELSE
    RAISE EXCEPTION 'Selecione um serviço ou pacote válido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.orcamentos (
    cliente_id, codigo_orcamento, status, categoria, data_criacao,
    titulo_solicitacao, descricao_solicitacao, nivel_prioridade,
    observacoes_servico, anexos, total, valor_servico, quantidade,
    servico_id, pacote_servico_id, promocao_id
  ) VALUES (
    v_cliente_id,
    'ORC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'em revisão',
    'servico',
    current_date,
    v_title,
    trim(p_description),
    p_priority,
    trim(p_description),
    COALESCE(p_attachments, '[]'::jsonb),
    0,
    0,
    1,
    v_service_id,
    v_package_id,
    p_promotion_id
  ) RETURNING * INTO v_quote;

  RETURN to_jsonb(v_quote);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_service_catalog_payload(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_service_catalog(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_service_catalog(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_service_catalog_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_service_package(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_service_package(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_import_service_catalog(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_create_service_quote(uuid, text, text, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_public_service_catalog(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_service_catalog(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_service_catalog_snapshot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_service_package(uuid, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_service_package(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_import_service_catalog(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_create_service_quote(uuid, text, text, uuid, text, text, jsonb, uuid) TO authenticated;
