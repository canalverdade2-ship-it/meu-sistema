-- =============================================================================
-- Migration: 20260828230000_security_lockdown_rls_and_rpc_permissions.sql
-- Description: Security Lockdown — Revoke Public/Anon RPC Execution & Eliminate Wildcard RLS Policies
-- =============================================================================

BEGIN;

-- 1. REVOKE PUBLIC/ANON/AUTHENTICATED EXECUTION ON CRITICAL SECURITY DEFINER RPCs
-- Restrict execution strictly to service_role and database superusers.

-- 1.1 cliente_operational_write
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cliente_operational_write'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role, postgres', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;

-- 1.2 delete_client_cascade
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'delete_client_cascade'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role, postgres', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;

-- 1.3 System Discovery & Metadata Extraction RPCs (get_auth_users_details, get_database_details, get_system_metrics, get_storage_details, get_admin_system_status, get_admin_counts, get_admin_pendency_counts)
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_auth_users_details',
      'get_database_details',
      'get_system_metrics',
      'get_storage_details',
      'get_admin_system_status',
      'get_admin_counts',
      'get_admin_pendency_counts'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role, postgres', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;

-- 2. LOCK DOWN OVERLY PERMISSIVE RLS POLICIES ON SENSITIVE TABLES
-- Drop open wildcard policies (e.g. "Public Full Access", "Acesso total") that allow unauthenticated / anon write/read.

DO $$
DECLARE
  v_table text;
  v_policy record;
  v_sensitive_tables text[] := ARRAY[
    'clientes',
    'faturas',
    'pagamentos',
    'cobrancas',
    'cobranca_historico',
    'carteira_lancamentos',
    'extrato_financeiro',
    'loja_credito_solicitacoes',
    'loja_credito_movimentacoes',
    'loja_credito_documentos',
    'demanda_comentarios',
    'colaboradores',
    'colaborador_modulos',
    'solicitacoes_exclusao',
    'cliente_notas_admin',
    'saques',
    'transferencias',
    'fatura_contestacoes'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_sensitive_tables LOOP
    IF to_regclass('public.' || quote_ident(v_table)) IS NOT NULL THEN
      -- Ensure RLS is active
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

      -- Drop known permissive wildcard policies
      FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_table
          AND (
            policyname ILIKE '%public full access%'
            OR policyname ILIKE '%acesso total%'
            OR policyname ILIKE '%allow all%'
            OR policyname ILIKE '%enable all access%'
            OR policyname ILIKE '%permitir tudo%'
            OR policyname ILIKE '%_all'
            OR (qual = 'true' AND ('public' = ANY(roles) OR 'anon' = ANY(roles)) AND cmd IN ('ALL', 'UPDATE', 'DELETE', 'INSERT'))
          )
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- 3. ENSURE STRICT SERVICE_ROLE & AUTHENTICATED ACCESS POLICIES ON SENSITIVE TABLES

-- 3.1 Clientes
DROP POLICY IF EXISTS "service_role_all_clientes" ON public.clientes;
CREATE POLICY "service_role_all_clientes"
  ON public.clientes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.2 Faturas
DROP POLICY IF EXISTS "service_role_all_faturas" ON public.faturas;
CREATE POLICY "service_role_all_faturas"
  ON public.faturas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.3 Pagamentos
DROP POLICY IF EXISTS "service_role_all_pagamentos" ON public.pagamentos;
CREATE POLICY "service_role_all_pagamentos"
  ON public.pagamentos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.4 Cobranças & Histórico
DROP POLICY IF EXISTS "service_role_all_cobrancas" ON public.cobrancas;
CREATE POLICY "service_role_all_cobrancas"
  ON public.cobrancas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_cobranca_historico" ON public.cobranca_historico;
CREATE POLICY "service_role_all_cobranca_historico"
  ON public.cobranca_historico
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.5 Carteira Lançamentos & Extrato Financeiro
DROP POLICY IF EXISTS "service_role_all_carteira_lancamentos" ON public.carteira_lancamentos;
CREATE POLICY "service_role_all_carteira_lancamentos"
  ON public.carteira_lancamentos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_extrato_financeiro" ON public.extrato_financeiro;
CREATE POLICY "service_role_all_extrato_financeiro"
  ON public.extrato_financeiro
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.6 Loja Crédito (Solicitações, Movimentações, Documentos)
DROP POLICY IF EXISTS "service_role_all_loja_credito_solicitacoes" ON public.loja_credito_solicitacoes;
CREATE POLICY "service_role_all_loja_credito_solicitacoes"
  ON public.loja_credito_solicitacoes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_loja_credito_movimentacoes" ON public.loja_credito_movimentacoes;
CREATE POLICY "service_role_all_loja_credito_movimentacoes"
  ON public.loja_credito_movimentacoes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_loja_credito_documentos" ON public.loja_credito_documentos;
CREATE POLICY "service_role_all_loja_credito_documentos"
  ON public.loja_credito_documentos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.7 Colaboradores & Módulos
DROP POLICY IF EXISTS "service_role_all_colaboradores" ON public.colaboradores;
CREATE POLICY "service_role_all_colaboradores"
  ON public.colaboradores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_colaborador_modulos" ON public.colaborador_modulos;
CREATE POLICY "service_role_all_colaborador_modulos"
  ON public.colaborador_modulos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
