-- First RLS hardening step: remove public direct writes/deletes from sessions and logs.
-- Read access remains temporarily open for existing admin/realtime screens.

CREATE OR REPLACE FUNCTION public.gsa_admin_clear_access_history(
  p_sessao_id uuid,
  p_session_token text,
  p_period text DEFAULT 'hoje',
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE(deleted_sessions integer, deleted_logs integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT *
  INTO v_actor
  FROM public.gsa_validate_session(p_sessao_id, p_session_token);

  IF NOT COALESCE(v_actor.is_valid, false) OR v_actor.ator_tipo NOT IN ('admin', 'colaborador') THEN
    RAISE EXCEPTION 'sessao administrativa invalida';
  END IF;

  v_end := COALESCE(p_end, now());
  v_start := CASE p_period
    WHEN 'hoje' THEN date_trunc('day', now())
    WHEN '7_dias' THEN now() - interval '7 days'
    WHEN '15_dias' THEN now() - interval '15 days'
    WHEN '30_dias' THEN now() - interval '30 days'
    WHEN 'personalizado' THEN p_start
    ELSE p_start
  END;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'periodo invalido para limpeza';
  END IF;

  DELETE FROM public.sistema_logs
  WHERE created_at >= v_start
    AND created_at <= v_end;
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;

  DELETE FROM public.sistema_sessoes
  WHERE criado_em >= v_start
    AND criado_em <= v_end;
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_clear_access_history(uuid, text, text, timestamptz, timestamptz) TO anon, authenticated;

DROP POLICY IF EXISTS "Permitir exclusao publica sessoes" ON public.sistema_sessoes;
DROP POLICY IF EXISTS "Permitir insercao publica sessoes" ON public.sistema_sessoes;
DROP POLICY IF EXISTS "Permitir update publico sessoes" ON public.sistema_sessoes;

DROP POLICY IF EXISTS "Permitir exclusao publica logs" ON public.sistema_logs;
DROP POLICY IF EXISTS "Acesso total" ON public.sistema_logs;

CREATE POLICY "sistema_logs_select_public_temp"
ON public.sistema_logs
FOR SELECT
TO public
USING (true);

CREATE POLICY "sistema_logs_insert_public_temp"
ON public.sistema_logs
FOR INSERT
TO public
WITH CHECK (true);
