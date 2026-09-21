BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_all_sessions(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');
  
  WITH deleted AS (
    DELETE FROM public.sistema_sessoes
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;
  
  PERFORM public.gsa_admin_write_audit('acessos', 'EXCLUIR_TODAS_SESSOES', 'sistema_sessoes', p_sessao_id, jsonb_build_object('count', v_count));
  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

COMMIT;
