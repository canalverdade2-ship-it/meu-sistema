BEGIN;

-- These overloads are called by the browser through callAdminRpc.  The legacy
-- implementations accepted the session parameters but did not validate them;
-- because they are SECURITY DEFINER, RLS alone could not protect the writes.
CREATE OR REPLACE FUNCTION public.gsa_admin_save_travel_category(
  p_sessao_id text,
  p_session_token text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
  v_name text := trim(coalesce(p_payload->>'nome', ''));
  v_slug text := lower(trim(coalesce(p_payload->>'slug', '')));
  v_status text := lower(trim(coalesce(p_payload->>'status', 'ativo')));
  v_order integer;
BEGIN
  PERFORM 1
    FROM public.gsa_admin_session_assert_module(
      nullif(trim(p_sessao_id), '')::uuid,
      p_session_token,
      'viagens'
    )
   LIMIT 1;

  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Dados da categoria de viagem inválidos.' USING ERRCODE = '22023';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome da categoria de viagem inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR length(v_slug) > 140 THEN
    RAISE EXCEPTION 'Identificador da categoria de viagem inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status da categoria de viagem inválido.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_order := coalesce(nullif(p_payload->>'ordem', '')::integer, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Ordem da categoria de viagem inválida.' USING ERRCODE = '22023';
  END;
  IF v_order < 0 OR v_order > 1000000 THEN
    RAISE EXCEPTION 'Ordem da categoria de viagem inválida.' USING ERRCODE = '22023';
  END IF;

  IF nullif(p_payload->>'id', '') IS NOT NULL THEN
    UPDATE public.viagens_categorias
       SET nome = v_name,
           slug = v_slug,
           ordem = v_order,
           status = v_status,
           updated_at = now()
     WHERE id = (p_payload->>'id')::uuid
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Categoria de viagem não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    INSERT INTO public.viagens_categorias(nome, slug, ordem, status)
    VALUES (v_name, v_slug, v_order, v_status)
    RETURNING id INTO v_id;
  END IF;

  SELECT to_jsonb(t) INTO v_result
    FROM public.viagens_categorias t
   WHERE t.id = v_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_scraping_config(
  p_sessao_id text,
  p_session_token text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
  v_name text := trim(coalesce(p_payload->>'nome', ''));
  v_type text := lower(trim(coalesce(p_payload->>'tipo', 'produtos')));
  v_target_url text := trim(coalesce(p_payload->>'target_url', ''));
  v_sync_id text := trim(coalesce(p_payload->>'sync_id', ''));
  v_frequency text := lower(trim(coalesce(p_payload->>'frequencia', 'diario')));
  v_profit numeric;
  v_limit integer;
BEGIN
  PERFORM 1
    FROM public.gsa_admin_session_assert_module(
      nullif(trim(p_sessao_id), '')::uuid,
      p_session_token,
      'sistema'
    )
   LIMIT 1;

  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Dados da automação inválidos.' USING ERRCODE = '22023';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 160 THEN
    RAISE EXCEPTION 'Nome da automação inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('produtos', 'viagens') THEN
    RAISE EXCEPTION 'Tipo de automação inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_target_url !~* '^https?://[^[:space:]]+$' OR length(v_target_url) > 2000 THEN
    RAISE EXCEPTION 'URL de origem da automação inválida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_sync_id) < 1 OR length(v_sync_id) > 200 THEN
    RAISE EXCEPTION 'Identificador de sincronização inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_frequency NOT IN ('uma_vez', 'horario', 'diario', 'semanal', 'mensal') THEN
    RAISE EXCEPTION 'Frequência da automação inválida.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_payload->'horarios', '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_payload->'dias_semana', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Agenda da automação inválida.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_profit := coalesce(nullif(p_payload->>'margem_lucro', '')::numeric, 15);
    v_limit := coalesce(nullif(p_payload->>'limite_produtos', '')::integer, 0);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Limites numéricos da automação inválidos.' USING ERRCODE = '22023';
  END;
  IF v_profit < 0 OR v_profit > 10000 OR v_limit < 0 OR v_limit > 100000 THEN
    RAISE EXCEPTION 'Limites numéricos da automação inválidos.' USING ERRCODE = '22023';
  END IF;

  IF nullif(p_payload->>'id', '') IS NOT NULL THEN
    UPDATE public.automacao_scraping_configs
       SET nome = v_name,
           tipo = v_type,
           target_url = v_target_url,
           sync_id = v_sync_id,
           margem_lucro = v_profit,
           modo_categoria = coalesce(nullif(p_payload->>'modo_categoria', ''), 'ia'),
           categoria_id = nullif(p_payload->>'categoria_id', ''),
           ativo = coalesce((p_payload->>'ativo')::boolean, true),
           frequencia = v_frequency,
           horarios = coalesce(p_payload->'horarios', '["09:00"]'::jsonb),
           dias_semana = coalesce(p_payload->'dias_semana', '["segunda","terca","quarta","quinta","sexta"]'::jsonb),
           data_inicio = nullif(p_payload->>'data_inicio', '')::date,
           data_fim = nullif(p_payload->>'data_fim', '')::date,
           n8n_webhook_url = nullif(left(trim(coalesce(p_payload->>'n8n_webhook_url', '')), 2000), ''),
           limite_produtos = v_limit,
           updated_at = now()
     WHERE id = (p_payload->>'id')::uuid
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Automação não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    INSERT INTO public.automacao_scraping_configs(
      nome, tipo, target_url, sync_id, margem_lucro, modo_categoria,
      categoria_id, ativo, frequencia, horarios, dias_semana,
      data_inicio, data_fim, n8n_webhook_url, limite_produtos
    ) VALUES (
      v_name, v_type, v_target_url, v_sync_id, v_profit,
      coalesce(nullif(p_payload->>'modo_categoria', ''), 'ia'),
      nullif(p_payload->>'categoria_id', ''),
      coalesce((p_payload->>'ativo')::boolean, true), v_frequency,
      coalesce(p_payload->'horarios', '["09:00"]'::jsonb),
      coalesce(p_payload->'dias_semana', '["segunda","terca","quarta","quinta","sexta"]'::jsonb),
      nullif(p_payload->>'data_inicio', '')::date,
      nullif(p_payload->>'data_fim', '')::date,
      nullif(left(trim(coalesce(p_payload->>'n8n_webhook_url', '')), 2000), ''),
      v_limit
    ) RETURNING id INTO v_id;
  END IF;

  SELECT to_jsonb(t) INTO v_result
    FROM public.automacao_scraping_configs t
   WHERE t.id = v_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_travel_category(text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_scraping_config(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_travel_category(text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_scraping_config(text, text, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
