CREATE OR REPLACE FUNCTION public.gsa_admin_system_snapshot(
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
  v_metrics jsonb := '{}'::jsonb;
  v_tables jsonb;
  v_users_list jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('sistema');

  BEGIN
    EXECUTE 'SELECT to_jsonb(m) FROM public.get_system_metrics() m LIMIT 1' INTO v_metrics;
  EXCEPTION WHEN undefined_function THEN
    v_metrics := '{}'::jsonb;
  END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', schemaname || '.' || relname,
    'estimated_rows', n_live_tup,
    'dead_rows', n_dead_tup,
    'last_analyze', last_analyze,
    'last_autoanalyze', last_autoanalyze
  ) ORDER BY n_live_tup DESC), '[]'::jsonb)
  INTO v_tables
  FROM pg_stat_user_tables;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'email', COALESCE(u.email, '—'),
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'nome', COALESCE(col.nome, cli.nome, forn.razao_social, pres.nome, afil.nome, (u.raw_user_meta_data->>'nome'), 'Usuário'),
      'tipo', CASE
        WHEN col.e_master = true OR u.email = 'admin@gsa.com' THEN 'Administrador Master'
        WHEN col.id IS NOT NULL THEN 'Colaborador GSA'
        WHEN cli.id IS NOT NULL THEN 'Cliente GSA'
        WHEN forn.id IS NOT NULL THEN 'Fornecedor GSA'
        WHEN pres.id IS NOT NULL THEN 'Prestador de Serviço'
        WHEN afil.id IS NOT NULL THEN 'Afiliado GSA'
        ELSE COALESCE(u.role, 'Usuário Registrado')
      END,
      'status', CASE
        WHEN col.ativo = false OR cli.status = 'bloqueado' OR forn.status = 'inativo' THEN 'Bloqueado'
        ELSE 'Ativo'
      END
    ) ORDER BY u.created_at DESC), '[]'::jsonb)
    INTO v_users_list
    FROM auth.users u
    LEFT JOIN public.gsa_colaboradores col ON col.auth_user_id = u.id OR (u.email IS NOT NULL AND lower(col.email) = lower(u.email))
    LEFT JOIN public.gsa_clientes cli ON cli.auth_user_id = u.id OR (u.email IS NOT NULL AND lower(cli.email) = lower(u.email))
    LEFT JOIN public.gsa_fornecedores forn ON forn.auth_user_id = u.id OR (u.email IS NOT NULL AND lower(forn.email) = lower(u.email))
    LEFT JOIN public.gsa_prestadores pres ON pres.auth_user_id = u.id OR (u.email IS NOT NULL AND lower(pres.email) = lower(u.email))
    LEFT JOIN public.gsa_afiliados afil ON afil.auth_user_id = u.id OR (u.email IS NOT NULL AND lower(afil.email) = lower(u.email));
  EXCEPTION WHEN OTHERS THEN
    v_users_list := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'metrics', COALESCE(v_metrics, '{}'::jsonb),
    'tables', v_tables,
    'users_list', COALESCE(v_users_list, '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_system_snapshot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_system_snapshot(uuid, text) TO authenticated, service_role;
