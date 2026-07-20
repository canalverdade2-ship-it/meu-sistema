CREATE OR REPLACE FUNCTION public.cliente_operational_write(
  p_cliente_id uuid,
  p_table text,
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'tickets',
    'ticket_mensagens',
    'cliente_documentos',
    'loja_carrinhos',
    'cliente_cupons',
    'cupons_ativados',
    'cliente_promocoes',
    'promocoes_quantidade_uso',
    'promocoes_quantidade_ativadas',
    'loja_solicitacoes',
    'loja_avaliacoes',
    'emprestimos',
    'emprestimo_documentos',
    'emprestimo_historico',
    'emprestimo_comentarios',
    'orcamentos',
    'loja_credito_solicitacoes',
    'loja_credito_documentos',
    'indicacoes',
    'vouchers',
    'ordens_assinatura',
    'ordens_servico',
    'premios',
    'solicitacoes_premios',
    'fatura_contestacoes',
    'clientes'
  ];
  v_table text := lower(trim(p_table));
  v_action text := lower(trim(p_action));
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_filter jsonb := coalesce(p_filter, '{}'::jsonb);
  v_sql text;
  v_cols text;
  v_vals text;
  v_sets text;
  v_where text := '';
  v_result jsonb;
  v_has_cliente_id boolean;
  v_key text;
  v_value jsonb;
  v_idx integer := 0;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio.';
  END IF;

  IF NOT (v_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Tabela nao permitida para escrita operacional: %', v_table;
  END IF;

  IF v_action NOT IN ('insert', 'update', 'delete') THEN
    RAISE EXCEPTION 'Acao nao permitida: %', v_action;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table
      AND column_name = 'cliente_id'
  ) INTO v_has_cliente_id;

  IF v_table = 'clientes' THEN
    v_filter := v_filter || jsonb_build_object('id', p_cliente_id);
  ELSIF v_has_cliente_id THEN
    v_data := v_data || jsonb_build_object('cliente_id', p_cliente_id);
    v_filter := v_filter || jsonb_build_object('cliente_id', p_cliente_id);
  END IF;

  IF v_action = 'insert' THEN
    SELECT string_agg(format('%I', key), ', '),
           string_agg(format('%L', value #>> '{}'), ', ')
    INTO v_cols, v_vals
    FROM jsonb_each(v_data)
    WHERE value IS NOT NULL AND value <> 'null'::jsonb;

    IF v_cols IS NULL THEN
      RAISE EXCEPTION 'Dados obrigatorios para insercao.';
    END IF;

    v_sql := format('INSERT INTO public.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)', v_table, v_cols, v_vals, v_table);
    EXECUTE v_sql INTO v_result;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_filter) LOOP
    v_idx := v_idx + 1;
    IF v_idx > 1 THEN v_where := v_where || ' AND '; END IF;
    v_where := v_where || format('%I = %L', v_key, v_value #>> '{}');
  END LOOP;

  IF v_where = '' THEN
    RAISE EXCEPTION 'Filtro obrigatorio para update/delete.';
  END IF;

  IF v_action = 'update' THEN
    SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
    INTO v_sets
    FROM jsonb_each(v_data)
    WHERE key <> 'cliente_id' AND value IS NOT NULL AND value <> 'null'::jsonb;

    IF v_sets IS NULL THEN
      RAISE EXCEPTION 'Dados obrigatorios para atualizacao.';
    END IF;

    v_sql := format('UPDATE public.%I SET %s WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_sets, v_where, v_table);
    EXECUTE v_sql INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Registro nao encontrado ou sem permissao.'; END IF;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  v_sql := format('DELETE FROM public.%I WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_where, v_table);
  EXECUTE v_sql INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Registro nao encontrado ou sem permissao.'; END IF;
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb) TO anon, authenticated;

