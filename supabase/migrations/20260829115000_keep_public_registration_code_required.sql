BEGIN;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_public_register_client(text,jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'IF v_token = '''' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN',
    'IF v_default_active AND upper(v_token) = upper(coalesce(v_default_code, '''')) THEN');
  v_def := replace(v_def,
    'IF v_token = '''' OR upper(v_token) = ''BEMVINDO'' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN',
    'IF upper(v_token) = ''BEMVINDO'' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN');
  EXECUTE v_def;
END;
$$;

COMMIT;
