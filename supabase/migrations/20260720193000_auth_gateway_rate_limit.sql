-- Rate limiting persistente para o gateway público de autenticação.
-- As chaves armazenadas são hashes produzidos pela Edge Function; documentos,
-- e-mails, códigos e endereços IP não são persistidos em texto aberto.

CREATE TABLE IF NOT EXISTS public.gsa_auth_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gsa_auth_rate_limits_bucket_key_length
    CHECK (char_length(bucket_key) BETWEEN 32 AND 128)
);

ALTER TABLE public.gsa_auth_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gsa_auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gsa_auth_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_gsa_auth_rate_limits_updated_at
  ON public.gsa_auth_rate_limits (updated_at);

CREATE INDEX IF NOT EXISTS idx_gsa_auth_rate_limits_blocked_until
  ON public.gsa_auth_rate_limits (blocked_until)
  WHERE blocked_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gsa_auth_rate_limit_check(
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
DECLARE
  v_now timestamptz := clock_timestamp();
  v_row public.gsa_auth_rate_limits%ROWTYPE;
  v_attempt_count integer;
  v_blocked_until timestamptz;
  v_retry_after integer;
BEGIN
  IF p_bucket_key IS NULL
     OR char_length(p_bucket_key) NOT BETWEEN 32 AND 128
     OR p_limit NOT BETWEEN 1 AND 1000
     OR p_window_seconds NOT BETWEEN 1 AND 86400
     OR p_block_seconds NOT BETWEEN 1 AND 604800 THEN
    RAISE EXCEPTION 'Parâmetros inválidos para rate limiting.' USING ERRCODE = '22023';
  END IF;

  -- Limpeza oportunista para evitar crescimento indefinido sem depender de cron.
  IF random() < 0.01 THEN
    DELETE FROM public.gsa_auth_rate_limits
    WHERE updated_at < v_now - interval '7 days';
  END IF;

  LOOP
    SELECT *
      INTO v_row
    FROM public.gsa_auth_rate_limits
    WHERE bucket_key = p_bucket_key
    FOR UPDATE;

    EXIT WHEN FOUND;

    BEGIN
      INSERT INTO public.gsa_auth_rate_limits (
        bucket_key,
        window_started_at,
        attempt_count,
        blocked_until,
        updated_at
      ) VALUES (
        p_bucket_key,
        v_now,
        1,
        NULL,
        v_now
      );

      RETURN jsonb_build_object(
        'allowed', true,
        'remaining', greatest(p_limit - 1, 0),
        'retry_after', 0,
        'blocked_until', NULL
      );
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    v_retry_after := greatest(1, ceil(extract(epoch FROM (v_row.blocked_until - v_now)))::integer);

    UPDATE public.gsa_auth_rate_limits
       SET updated_at = v_now
     WHERE bucket_key = p_bucket_key;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after', v_retry_after,
      'blocked_until', v_row.blocked_until
    );
  END IF;

  IF v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    UPDATE public.gsa_auth_rate_limits
       SET window_started_at = v_now,
           attempt_count = 1,
           blocked_until = NULL,
           updated_at = v_now
     WHERE bucket_key = p_bucket_key;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', greatest(p_limit - 1, 0),
      'retry_after', 0,
      'blocked_until', NULL
    );
  END IF;

  v_attempt_count := v_row.attempt_count + 1;

  IF v_attempt_count > p_limit THEN
    v_blocked_until := v_now + make_interval(secs => p_block_seconds);
    v_retry_after := p_block_seconds;

    UPDATE public.gsa_auth_rate_limits
       SET attempt_count = v_attempt_count,
           blocked_until = v_blocked_until,
           updated_at = v_now
     WHERE bucket_key = p_bucket_key;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after', v_retry_after,
      'blocked_until', v_blocked_until
    );
  END IF;

  UPDATE public.gsa_auth_rate_limits
     SET attempt_count = v_attempt_count,
         blocked_until = NULL,
         updated_at = v_now
   WHERE bucket_key = p_bucket_key;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit - v_attempt_count, 0),
    'retry_after', 0,
    'blocked_until', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_auth_rate_limit_check(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_auth_rate_limit_check(text, integer, integer, integer)
  TO service_role;

COMMENT ON TABLE public.gsa_auth_rate_limits IS
  'Buckets hashados de limitação de tentativas do gateway GSA.';

COMMENT ON FUNCTION public.gsa_auth_rate_limit_check(text, integer, integer, integer) IS
  'Registra uma tentativa de forma atômica e informa se ela pode prosseguir.';
