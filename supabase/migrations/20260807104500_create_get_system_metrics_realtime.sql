-- Funcao para obter metricas reais e exatas do banco de dados PostgreSQL na VPS
CREATE OR REPLACE FUNCTION public.get_system_metrics()
RETURNS TABLE (
  database_size_bytes bigint,
  storage_size_bytes bigint,
  auth_users_count bigint,
  database_tables_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pg_database_size(current_database())::bigint AS database_size_bytes,
    (SELECT COALESCE(sum(pg_relation_size(c.oid)), 0)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'storage')::bigint AS storage_size_bytes,
    (SELECT count(*)::bigint FROM auth.users) AS auth_users_count,
    (SELECT count(*)::bigint FROM pg_stat_user_tables) AS database_tables_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_metrics() TO authenticated, service_role;
