BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_validate_context(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_session jsonb;
  v_stored_token text;
  v_token_valid boolean := false;
  v_legacy_validation jsonb;
BEGIN
  IF p_sessao_id IS NOT NULL
     AND p_sessao_id::text <> COALESCE(v_context ->> 'session_id', '') THEN
    RAISE EXCEPTION 'A sessão informada não corresponde ao JWT atual.' USING ERRCODE = '42501';
  END IF;

  IF p_sessao_id IS NULL AND p_session_token IS NULL THEN
    RETURN v_context;
  END IF;

  IF p_sessao_id IS NULL OR COALESCE(p_session_token, '') = '' THEN
    RAISE EXCEPTION 'Identificação completa da sessão é obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s)
    INTO v_session
    FROM public.sistema_sessoes s
   WHERE s.id = p_sessao_id
   LIMIT 1;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão administrativa revogada.' USING ERRCODE = '42501';
  END IF;

  v_stored_token := COALESCE(
    v_session ->> 'session_token',
    v_session ->> 'sessao_token',
    v_session ->> 'token',
    v_session ->> 'session_token_hash',
    v_session ->> 'token_hash',
    ''
  );

  IF v_stored_token <> '' THEN
    v_token_valid := v_stored_token = p_session_token;

    IF NOT v_token_valid AND v_stored_token LIKE '$2%' THEN
      BEGIN
        EXECUTE 'SELECT extensions.crypt($1, $2) = $2'
          INTO v_token_valid
          USING p_session_token, v_stored_token;
      EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
        v_token_valid := false;
      END;
    END IF;

    IF NOT v_token_valid AND v_stored_token ~ '^[0-9a-fA-F]{64}$' THEN
      IF to_regprocedure('public.gsa_hash_session_token(text)') IS NOT NULL THEN
        v_token_valid := lower(v_stored_token) = lower(public.gsa_hash_session_token(p_session_token));
      ELSE
        BEGIN
          EXECUTE 'SELECT lower($1) = encode(extensions.digest($2, ''sha256''), ''hex'')'
            INTO v_token_valid
            USING v_stored_token, p_session_token;
        EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
          v_token_valid := false;
        END;
      END IF;
    END IF;
  ELSE
    BEGIN
      EXECUTE
        'SELECT to_jsonb(v) FROM public.gsa_validate_session($1, $2) v LIMIT 1'
        INTO v_legacy_validation
        USING p_sessao_id, p_session_token;

      v_token_valid := lower(COALESCE(
        v_legacy_validation ->> 'is_valid',
        v_legacy_validation ->> 'valid',
        v_legacy_validation ->> 'success',
        'false'
      )) IN ('true', 't', '1');
    EXCEPTION WHEN undefined_function THEN
      v_token_valid := false;
    END;
  END IF;

  IF NOT v_token_valid THEN
    RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  RETURN v_context;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_validate_context(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_validate_context(uuid, text) TO authenticated, service_role;

COMMIT;
