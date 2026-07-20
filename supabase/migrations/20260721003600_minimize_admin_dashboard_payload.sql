BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_sanitize_dashboard_list(
  p_kind text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(
    CASE p_kind
      WHEN 'faturas' THEN jsonb_build_object(
        'id', item->'id',
        'codigo_fatura', item->'codigo_fatura',
        'cliente_nome', item->'cliente_nome',
        'valor_total', item->'valor_total',
        'data_vencimento', item->'data_vencimento',
        'status', item->'status'
      )
      WHEN 'saques' THEN jsonb_build_object(
        'id', item->'id',
        'cliente_nome', item->'cliente_nome',
        'valor', COALESCE(item->'valor', item->'valor_solicitado'),
        'data_solicitacao', item->'data_solicitacao',
        'status', item->'status'
      )
      WHEN 'emprestimos' THEN jsonb_build_object(
        'id', item->'id',
        'codigo_emprestimo', item->'codigo_emprestimo',
        'cliente_nome', item->'cliente_nome',
        'valor_solicitado', item->'valor_solicitado',
        'created_at', item->'created_at',
        'status', item->'status'
      )
      WHEN 'cobrancas' THEN jsonb_build_object(
        'id', item->'id',
        'cliente_nome', item->'cliente_nome',
        'valor_original', item->'valor_original',
        'valor_atualizado', item->'valor_atualizado',
        'created_at', item->'created_at',
        'status', item->'status'
      )
      WHEN 'orcamentos' THEN jsonb_build_object(
        'id', item->'id',
        'codigo_orcamento', item->'codigo_orcamento',
        'cliente_nome', item->'cliente_nome',
        'valor_total', item->'valor_total',
        'data_criacao', item->'data_criacao',
        'status', item->'status'
      )
      WHEN 'tickets' THEN jsonb_build_object(
        'id', item->'id',
        'assunto', item->'assunto',
        'cliente_nome', item->'cliente_nome',
        'data_abertura', item->'data_abertura',
        'status', item->'status'
      )
      ELSE '{}'::jsonb
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) = 'array'
         THEN COALESCE(p_items, '[]'::jsonb)
         ELSE '[]'::jsonb
    END
  ) AS source(item)
$$;

DO $dashboard_minimize$
BEGIN
  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_minimization(uuid,text)') IS NULL
     AND to_regprocedure('public.gsa_admin_dashboard_snapshot(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text)
      RENAME TO gsa_admin_dashboard_snapshot_pre_minimization;
  END IF;
END;
$dashboard_minimize$;

CREATE OR REPLACE FUNCTION public.gsa_admin_dashboard_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_lists jsonb;
  v_key text;
BEGIN
  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_minimization(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Snapshot administrativo base não encontrado.';
  END IF;

  v_result := public.gsa_admin_dashboard_snapshot_pre_minimization(p_sessao_id, p_session_token);
  v_lists := COALESCE(v_result -> 'lists', '{}'::jsonb);

  FOREACH v_key IN ARRAY ARRAY['faturas','saques','emprestimos','cobrancas','orcamentos','tickets']::text[] LOOP
    IF v_lists ? v_key THEN
      v_lists := jsonb_set(
        v_lists,
        ARRAY[v_key],
        public.gsa_admin_sanitize_dashboard_list(v_key, v_lists -> v_key),
        true
      );
    END IF;
  END LOOP;

  RETURN jsonb_set(COALESCE(v_result, '{}'::jsonb), '{lists}', v_lists, true);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_sanitize_dashboard_list(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) TO authenticated, service_role;

COMMIT;
