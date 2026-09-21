BEGIN;

-- Remove exposição de metadados, usuários e rotinas administrativas legadas.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN (
         'get_auth_users_details','get_database_details','get_system_metrics',
         'get_storage_details','get_admin_system_status','get_admin_counts',
         'get_admin_pendency_counts','verify_admin_access','execute_sql',
         'delete_client_cascade','cliente_operational_write'
       )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_fn.nspname,v_fn.proname,v_fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role, postgres',
      v_fn.nspname,v_fn.proname,v_fn.args);
  END LOOP;
END $$;

-- SECURITY DEFINER nunca deve herdar um search_path controlado pelo chamador.
DO $$
DECLARE v_fn record;
BEGIN
  FOR v_fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) c
          WHERE c LIKE 'search_path=%'
       )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path=public,extensions,pg_temp',
      v_fn.nspname,v_fn.proname,v_fn.args);
  END LOOP;
END $$;

-- Elimina políticas ALL que tratavam qualquer usuário autenticado como administrador.
DO $$
DECLARE v_table text; v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'cobrancas','cobranca_historico','cobranca_acordo_parcelas','contratos',
    'parceiros_resgates','whatsapp_pendencias_ativas','blog_posts',
    'gsa_hero_banners','gsa_tv_channels','gsa_tv_media_items',
    'gsa_tv_schedule_slots','gsa_tv_playlists','gsa_tv_incidents',
    'gsa_tv_audit_log','gsa_tv_jobs'
  ] LOOP
    IF to_regclass('public.'||v_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies
       WHERE schemaname='public' AND tablename=v_table
         AND cmd='ALL'
         AND 'authenticated'=ANY(roles)
         AND coalesce(qual,'true')='true'
         AND coalesce(with_check,'true')='true'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS gsa_management_hardened ON public.%I',v_table);
    EXECUTE format(
      'CREATE POLICY gsa_management_hardened ON public.%I FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'',''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'',''colaborador''))',
      v_table
    );
  END LOOP;
END $$;

-- Webhooks são exclusivamente server-side, inclusive como defesa em profundidade.
DO $$ BEGIN
  IF to_regclass('public.payment_webhook_events') IS NOT NULL THEN
    ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.payment_webhook_events FROM PUBLIC, anon, authenticated;
    GRANT ALL ON public.payment_webhook_events TO service_role;
  END IF;
END $$;

-- Dados internos de auth, storage e infraestrutura não participam do CDC público.
DO $$
DECLARE v_rel record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    DROP PUBLICATION supabase_realtime;
  END IF;
  CREATE PUBLICATION supabase_realtime;
  FOR v_rel IN
    SELECT n.nspname,c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','p')
       AND c.relname NOT IN (
         'sistema_sessoes','gsa_auth_identities','gsa_auth_attempts',
         'gsa_auth_rate_limits','gsa_admin_mutation_requests',
         'gsa_admin_operation_requests','gsa_admin_audit_events',
         'gsa_admin_notification_state','gsa_client_operation_requests',
         'gsa_client_recovery_challenges','gsa_public_budget_rate_limits',
         'gsa_public_rate_limits','payment_webhook_events','system_settings',
         'sistema_logs','debug_admin_rpc'
       )
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',v_rel.nspname,v_rel.relname);
  END LOOP;
END $$;

-- Conclui a validação das relações do módulo de seguros sem reescrever dados.
DO $$
DECLARE v_fk record;
BEGIN
  FOR v_fk IN
    SELECT n.nspname,c.relname,con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT con.convalidated
       AND c.relname IN ('seguros_cotacoes','seguros_propostas')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I',v_fk.nspname,v_fk.relname,v_fk.conname);
  END LOOP;
END $$;

COMMIT;
