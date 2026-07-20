-- Qualify pgcrypto functions installed in the extensions schema.

CREATE OR REPLACE FUNCTION public.gsa_hash_session_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
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
SET search_path = public, extensions
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

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

GRANT EXECUTE ON FUNCTION public.gsa_hash_session_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_start_session(text, uuid, text, jsonb) TO anon, authenticated;
