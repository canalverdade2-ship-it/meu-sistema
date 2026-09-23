-- Protege o formulário público de Sites e Sistemas sem expor a tabela de orçamentos.

CREATE TABLE IF NOT EXISTS public.gsa_public_budget_rate_limits (
  fingerprint text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.gsa_public_budget_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_public_budget_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gsa_public_budget_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS gsa_public_budget_rate_limits_cleanup_idx
  ON public.gsa_public_budget_rate_limits (updated_at);

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
  v_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitação inválidos.' USING ERRCODE = '22023';
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

  v_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robôs que preenchem o campo invisível recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descrição inválida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END IF;

  -- O limite usa contato normalizado. Não depende de dados fornecidos como identificador livre.
  v_fingerprint := md5(v_email || ':' || v_phone);

  INSERT INTO public.gsa_public_budget_rate_limits (fingerprint, window_started_at, attempts, updated_at)
  VALUES (v_fingerprint, v_now, 0, v_now)
  ON CONFLICT (fingerprint) DO NOTHING;

  SELECT *
    INTO v_rate
    FROM public.gsa_public_budget_rate_limits
   WHERE fingerprint = v_fingerprint
   FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
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
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
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
    'protocolo', v_protocol,
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

  IF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'gsa_public_create_enterprise_budget'
  ) THEN
    RAISE EXCEPTION 'Serviço de orçamento indisponível.' USING ERRCODE = 'P0001';
  END IF;

  -- A função antiga continua responsável pela persistência, mas deixa de ser pública.
  EXECUTE 'SELECT public.gsa_public_create_enterprise_budget($1)' USING v_sanitized;

  DELETE FROM public.gsa_public_budget_rate_limits
   WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb) TO anon, authenticated, service_role;

-- Impede que o cliente ignore a validação nova chamando diretamente a função legada.
DO $block$
DECLARE
  v_signature text;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'gsa_public_create_enterprise_budget'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END;
$block$;

COMMENT ON FUNCTION public.gsa_public_create_enterprise_budget_v2(jsonb)
IS 'Valida, limita e encaminha solicitações públicas de Sites e Sistemas para a rotina interna de orçamento.';
