BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_search_clients(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search text := trim(COALESCE(p_search, ''));
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  IF length(v_search) < 3 THEN
    RAISE EXCEPTION 'Digite pelo menos 3 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT c.id, c.nome, c.email, c.telefone, c.codigo_cliente, c.status
        FROM public.clientes c
       WHERE concat_ws(' ', c.nome, c.email, c.telefone, c.codigo_cliente) ILIKE '%' || v_search || '%'
       ORDER BY c.nome ASC
       LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
    ) rows;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_search_clients(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_search_clients(uuid, text, text, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
