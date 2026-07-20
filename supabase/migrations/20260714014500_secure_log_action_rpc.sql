-- Move sistema_logs writes behind a validated RPC and remove public INSERT.

CREATE OR REPLACE FUNCTION public.gsa_log_action(
  p_sessao_id uuid,
  p_session_token text,
  p_ator_tipo text,
  p_ator_id text,
  p_ator_nome text,
  p_acao text,
  p_detalhes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation record;
  v_log_id uuid;
  v_ator_id uuid;
BEGIN
  IF p_acao IS NULL OR trim(p_acao) = '' THEN
    RAISE EXCEPTION 'acao obrigatoria';
  END IF;

  IF p_ator_tipo IS NULL OR trim(p_ator_tipo) = '' THEN
    RAISE EXCEPTION 'ator_tipo obrigatorio';
  END IF;

  IF p_sessao_id IS NOT NULL OR p_session_token IS NOT NULL THEN
    SELECT *
    INTO v_validation
    FROM public.gsa_validate_session(p_sessao_id, p_session_token);

    IF NOT COALESCE(v_validation.is_valid, false) THEN
      RAISE EXCEPTION 'sessao invalida para registrar log';
    END IF;
  ELSIF p_ator_tipo <> 'sistema' THEN
    RAISE EXCEPTION 'sessao obrigatoria para registrar log';
  END IF;

  IF p_ator_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_ator_id := p_ator_id::uuid;
  ELSE
    v_ator_id := NULL;
  END IF;

  INSERT INTO public.sistema_logs (
    sessao_id,
    ator_tipo,
    ator_id,
    ator_nome,
    acao,
    detalhes
  )
  VALUES (
    p_sessao_id,
    p_ator_tipo,
    v_ator_id,
    p_ator_nome,
    p_acao,
    p_detalhes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_log_action(uuid, text, text, text, text, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "sistema_logs_insert_public_temp" ON public.sistema_logs;
