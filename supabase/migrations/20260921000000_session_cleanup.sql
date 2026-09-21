BEGIN;

-- 1. Create function to delete a session manually
CREATE OR REPLACE FUNCTION public.gsa_admin_delete_session(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_target_sessao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');
  
  DELETE FROM public.sistema_sessoes WHERE id = p_target_sessao_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit('acessos', 'EXCLUIR_SESSAO', 'sistema_sessoes', p_target_sessao_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Create function to cleanup old sessions automatically (older than 1 month)
CREATE OR REPLACE FUNCTION public.gsa_admin_cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.sistema_sessoes WHERE criado_em < now() - interval '1 month';
END;
$$;

-- 3. Schedule it in pg_cron (if available) to run every day at 3 AM
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('gsa_cleanup_sessions');
    PERFORM cron.schedule('gsa_cleanup_sessions', '0 3 * * *', 'SELECT public.gsa_admin_cleanup_old_sessions()');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if pg_cron is not properly set up for this database/user
    NULL;
END $$;

COMMIT;
