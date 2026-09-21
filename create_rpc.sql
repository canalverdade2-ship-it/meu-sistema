CREATE OR REPLACE FUNCTION public.gsa_admin_delete_products_by_filter(
  p_status text DEFAULT NULL,
  p_tipo_cliente text DEFAULT NULL,
  p_categoria_id text DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_deleted_count integer;
  v_sql text;
BEGIN
  v_sql := 'DELETE FROM public.produtos WHERE 1=1';

  IF p_status = 'ativo' OR p_status = 'inativo' THEN
    v_sql := v_sql || ' AND status = ''' || p_status || '''';
  END IF;

  IF p_tipo_cliente = 'pf' OR p_tipo_cliente = 'pj' THEN
    v_sql := v_sql || ' AND tipo_cliente IN (''' || p_tipo_cliente || ''', ''ambos'')';
  ELSIF p_tipo_cliente = 'ambos' THEN
    v_sql := v_sql || ' AND tipo_cliente = ''ambos''';
  END IF;

  IF p_categoria_id IS NOT NULL AND p_categoria_id != 'todos' THEN
    IF p_categoria_id = 'sem_categoria' THEN
      v_sql := v_sql || ' AND categoria_id IS NULL';
    ELSE
      v_sql := v_sql || ' AND categoria_id = ''' || p_categoria_id || '''';
    END IF;
  END IF;

  IF p_search IS NOT NULL AND trim(p_search) != '' THEN
    v_sql := v_sql || ' AND (nome ILIKE ''%' || trim(p_search) || '%'' OR codigo_produto ILIKE ''%' || trim(p_search) || '%'')';
  END IF;

  EXECUTE v_sql;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
\$\$;