-- Security foundation for GSA application sessions.
-- This migration is intentionally additive: it does not close existing RLS policies yet.
-- The goal is to stop relying only on a guessable session id stored in localStorage.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.sistema_sessoes
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_hint text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_token_hash
  ON public.sistema_sessoes (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_ator_status
  ON public.sistema_sessoes (ator_id, status, criado_em DESC);

CREATE OR REPLACE FUNCTION public.gsa_hash_session_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.gsa_start_session(
  p_ator_tipo text,
  p_ator_id uuid,
  p_ator_nome text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(sessao_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_sessao_id uuid;
BEGIN
  IF p_ator_tipo IS NULL OR trim(p_ator_tipo) = '' THEN
    RAISE EXCEPTION 'ator_tipo obrigatorio';
  END IF;

  IF p_ator_id IS NULL THEN
    RAISE EXCEPTION 'ator_id obrigatorio';
  END IF;

  UPDATE public.sistema_sessoes
  SET status = 'encerrado',
      encerrado_em = COALESCE(encerrado_em, now())
  WHERE ator_id = p_ator_id
    AND status = 'ativo';

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.sistema_sessoes (
    ator_tipo,
    ator_id,
    ator_nome,
    status,
    token_hash,
    token_hint,
    metadata
  )
  VALUES (
    p_ator_tipo,
    p_ator_id,
    COALESCE(NULLIF(trim(p_ator_nome), ''), 'Usuario'),
    'ativo',
    public.gsa_hash_session_token(v_token),
    left(v_token, 8),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_sessao_id;

  sessao_id := v_sessao_id;
  session_token := v_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_validate_session(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(
  is_valid boolean,
  ator_tipo text,
  ator_id uuid,
  ator_nome text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true,
    s.ator_tipo,
    s.ator_id,
    s.ator_nome,
    s.status
  FROM public.sistema_sessoes s
  WHERE s.id = p_sessao_id
    AND s.status = 'ativo'
    AND s.token_hash = public.gsa_hash_session_token(p_session_token)
  LIMIT 1;

  IF NOT FOUND THEN
    is_valid := false;
    ator_tipo := NULL;
    ator_id := NULL;
    ator_nome := NULL;
    status := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_end_session(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.sistema_sessoes
  SET status = 'encerrado',
      encerrado_em = COALESCE(encerrado_em, now())
  WHERE id = p_sessao_id
    AND status = 'ativo'
    AND token_hash = public.gsa_hash_session_token(p_session_token);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ping_session(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.sistema_sessoes
  SET ultimo_acesso = now()
  WHERE id = p_sessao_id
    AND status = 'ativo'
    AND token_hash = public.gsa_hash_session_token(p_session_token);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_force_end_session(
  p_sessao_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.sistema_sessoes
  SET status = 'encerrado',
      encerrado_em = COALESCE(encerrado_em, now())
  WHERE id = p_sessao_id
    AND status = 'ativo';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_check_active_session(
  p_ator_id uuid
)
RETURNS TABLE(id uuid, criado_em timestamptz, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.criado_em, s.status
  FROM public.sistema_sessoes s
  WHERE s.ator_id = p_ator_id
    AND s.status = 'ativo'
  ORDER BY s.criado_em DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_hash_session_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_start_session(text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_validate_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_end_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ping_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_force_end_session(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_check_active_session(uuid) TO anon, authenticated;
