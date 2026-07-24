BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_search_calculator_pro_clients(
  p_sessao_id uuid,
  p_session_token text,
  p_query text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text text := lower(btrim(COALESCE(p_query, '')));
  v_digits text := regexp_replace(COALESCE(p_query, ''), '\D', '', 'g');
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF length(v_text) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'codigo_cliente', c.codigo_cliente,
    'nome', c.nome,
    'cpf', c.cpf,
    'cnpj', c.cnpj,
    'status', c.status,
    'has_paid_invoice', EXISTS (
      SELECT 1 FROM public.faturas f WHERE f.cliente_id = c.id AND f.status = 'pago'
    )
  ) ORDER BY c.nome), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT *
        FROM public.clientes c0
       WHERE lower(COALESCE(c0.nome, '')) LIKE '%' || v_text || '%'
          OR lower(COALESCE(c0.codigo_cliente, '')) LIKE '%' || v_text || '%'
          OR (
            length(v_digits) >= 3
            AND (
              regexp_replace(COALESCE(c0.cpf, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
              OR regexp_replace(COALESCE(c0.cnpj, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
            )
          )
       ORDER BY c0.nome
       LIMIT 25
    ) c;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) TO authenticated;

COMMIT;
