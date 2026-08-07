-- Alias para garantir compatibilidade com qualquer chamada a gsa_consume_auth_rate_limit
CREATE OR REPLACE FUNCTION public.gsa_consume_auth_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RETURN public.gsa_auth_rate_limit_check(p_bucket_key, p_limit, p_window_seconds, p_block_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_consume_auth_rate_limit(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_consume_auth_rate_limit(text, integer, integer, integer)
  TO service_role;
