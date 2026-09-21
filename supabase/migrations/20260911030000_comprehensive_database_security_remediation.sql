-- ============================================================================
-- Migration: 20260911030000_comprehensive_database_security_remediation.sql
-- Description: Comprehensive database security and RLS remediation for Grupo GSA.
--              1. Revoke and drop vulnerable public.sync_cliente_pontos_e_saldo.
--              2. Harden prevent_saldo_tampering() to block direct updates from
--                 anon, authenticated, and public roles.
--              3. Eliminate 8 residual wildcard USING (true) policies and
--                 implement strict tenant/role-scoped access rules.
--              4. Add SELECT policies for authenticated providers on
--                 prestador_transacoes, prestador_saques, and prestador_vouchers.
--              5. Enable RLS and active-only policy on promocoes_quantidade.
--              6. Enforce SET search_path = public, pg_temp on
--                 gsa_generate_unique_product_code() and restrict
--                 gsa_webhook_solicitar_saque_cliente to service_role.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CORREÇÃO CRÍTICA P0: REVOGAÇÃO E EXCLUSÃO DE sync_cliente_pontos_e_saldo
-- ============================================================================
REVOKE ALL ON FUNCTION public.sync_cliente_pontos_e_saldo(UUID, INT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.sync_cliente_pontos_e_saldo(UUID, INT, NUMERIC, TEXT);

-- ============================================================================
-- 2. HARDENING DO TRIGGER prevent_saldo_tampering()
-- ============================================================================
-- Atualiza a função do trigger para bloquear qualquer alteração direta de saldos
-- ou pontos quando invocado por authenticated, anon, ou sessões não-autenticadas,
-- preservando bypass legítimo apenas quando devidamente sinalizado via session config.
CREATE OR REPLACE FUNCTION public.prevent_saldo_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
    IF current_setting('my.app.bypass_saldo_check', true) = 'on'
       OR current_setting('gsa.credit_release', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- Protege contra mutações diretas vindas de authenticated, anon ou public/sessão nula
    IF auth.role() IN ('authenticated', 'anon') OR auth.role() IS NULL THEN
        IF NEW.saldo_carteira IS DISTINCT FROM OLD.saldo_carteira OR NEW.saldo_pontos IS DISTINCT FROM OLD.saldo_pontos THEN
            RAISE EXCEPTION 'Acesso negado: Saldos não podem ser alterados diretamente.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_saldo_tampering ON public.clientes;
CREATE TRIGGER trg_prevent_saldo_tampering
BEFORE UPDATE OF saldo_carteira, saldo_pontos ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_saldo_tampering();

-- ============================================================================
-- 3. ELIMINAÇÃO DAS 8 POLÍTICAS WILDCARD RESIDUAIS (USING (true)) & TENANT SCOPE
-- ============================================================================

-- 3.1 Faturas (public.faturas)
DROP POLICY IF EXISTS faturas_public_read ON public.faturas;
REVOKE SELECT ON public.faturas FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_client_own_faturas_strict ON public.faturas;
CREATE POLICY gsa_client_own_faturas_strict ON public.faturas
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 3.2 Ordens de Serviço (public.ordens_servico)
DROP POLICY IF EXISTS ordens_servico_public_read ON public.ordens_servico;
REVOKE SELECT ON public.ordens_servico FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_client_own_ordens_servico_hardened ON public.ordens_servico;
DROP POLICY IF EXISTS gsa_actor_own_ordens_servico ON public.ordens_servico;
CREATE POLICY gsa_actor_own_ordens_servico ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR (public.gsa_jwt_actor_type() = 'prestador' AND prestador_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 3.3 Saques (public.saques)
DROP POLICY IF EXISTS saques_select_public_temp ON public.saques;
REVOKE SELECT ON public.saques FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_client_own_withdrawals_read ON public.saques;
DROP POLICY IF EXISTS gsa_actor_own_saques ON public.saques;
CREATE POLICY gsa_client_own_withdrawals_read ON public.saques
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 3.4 Transferências (public.transferencias)
DROP POLICY IF EXISTS transferencias_select_public_temp ON public.transferencias;
REVOKE SELECT ON public.transferencias FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_client_own_transfers_read ON public.transferencias;
DROP POLICY IF EXISTS gsa_actor_own_transferencias ON public.transferencias;
CREATE POLICY gsa_client_own_transfers_read ON public.transferencias
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND public.gsa_jwt_actor_id() IN (cliente_origem_id, cliente_destino_id))
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 3.5 Contratos (public.contratos)
DROP POLICY IF EXISTS "contratos_anon_select" ON public.contratos;
DROP POLICY IF EXISTS contratos_anon_select ON public.contratos;
DROP POLICY IF EXISTS "contratos_admin_access" ON public.contratos;
REVOKE ALL ON public.contratos FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_actor_own_contratos ON public.contratos;
CREATE POLICY gsa_actor_own_contratos ON public.contratos
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

DROP POLICY IF EXISTS gsa_management_contratos ON public.contratos;
CREATE POLICY gsa_management_contratos ON public.contratos
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

GRANT SELECT ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;

-- 3.6 Orçamento Timeline (public.orcamento_timeline)
DROP POLICY IF EXISTS "orcamento_timeline_select_public" ON public.orcamento_timeline;
DROP POLICY IF EXISTS "orcamento_timeline_insert_public" ON public.orcamento_timeline;
DROP POLICY IF EXISTS "orcamento_timeline_update_public" ON public.orcamento_timeline;
DROP POLICY IF EXISTS "orcamento_timeline_select_authenticated" ON public.orcamento_timeline;
DROP POLICY IF EXISTS "orcamento_timeline_insert_authenticated" ON public.orcamento_timeline;
DROP POLICY IF EXISTS orcamento_timeline_select_public ON public.orcamento_timeline;
DROP POLICY IF EXISTS orcamento_timeline_insert_public ON public.orcamento_timeline;
DROP POLICY IF EXISTS orcamento_timeline_update_public ON public.orcamento_timeline;
DROP POLICY IF EXISTS orcamento_timeline_select_authenticated ON public.orcamento_timeline;
DROP POLICY IF EXISTS orcamento_timeline_insert_authenticated ON public.orcamento_timeline;
DROP POLICY IF EXISTS gsa_client_own_orcamento_timeline_hardened ON public.orcamento_timeline;
REVOKE ALL ON public.orcamento_timeline FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_actor_own_orcamento_timeline ON public.orcamento_timeline;
CREATE POLICY gsa_actor_own_orcamento_timeline ON public.orcamento_timeline
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

DROP POLICY IF EXISTS gsa_management_orcamento_timeline ON public.orcamento_timeline;
CREATE POLICY gsa_management_orcamento_timeline ON public.orcamento_timeline
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

GRANT SELECT ON public.orcamento_timeline TO authenticated;
GRANT ALL ON public.orcamento_timeline TO service_role;

-- 3.7 Sistema Logs (public.sistema_logs)
DROP POLICY IF EXISTS "sistema_logs_select_public_temp" ON public.sistema_logs;
DROP POLICY IF EXISTS sistema_logs_select_public_temp ON public.sistema_logs;
DROP POLICY IF EXISTS "sistema_logs_insert_public_temp" ON public.sistema_logs;
DROP POLICY IF EXISTS sistema_logs_insert_public_temp ON public.sistema_logs;
REVOKE ALL ON public.sistema_logs FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_management_sistema_logs ON public.sistema_logs;
CREATE POLICY gsa_management_sistema_logs ON public.sistema_logs
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

GRANT SELECT, INSERT ON public.sistema_logs TO authenticated;
GRANT ALL ON public.sistema_logs TO service_role;

-- 3.8 WhatsApp Pendências Ativas (public.whatsapp_pendencias_ativas)
DROP POLICY IF EXISTS "whatsapp_pendencias_auth_read" ON public.whatsapp_pendencias_ativas;
DROP POLICY IF EXISTS whatsapp_pendencias_auth_read ON public.whatsapp_pendencias_ativas;
DROP POLICY IF EXISTS "whatsapp_pendencias_all_access" ON public.whatsapp_pendencias_ativas;
DROP POLICY IF EXISTS whatsapp_pendencias_all_access ON public.whatsapp_pendencias_ativas;
REVOKE ALL ON public.whatsapp_pendencias_ativas FROM anon, PUBLIC;

DROP POLICY IF EXISTS gsa_actor_own_whatsapp_pendencias ON public.whatsapp_pendencias_ativas;
CREATE POLICY gsa_actor_own_whatsapp_pendencias ON public.whatsapp_pendencias_ativas
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

DROP POLICY IF EXISTS gsa_management_whatsapp_pendencias ON public.whatsapp_pendencias_ativas;
CREATE POLICY gsa_management_whatsapp_pendencias ON public.whatsapp_pendencias_ativas
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

GRANT SELECT ON public.whatsapp_pendencias_ativas TO authenticated;
GRANT ALL ON public.whatsapp_pendencias_ativas TO service_role;

-- ============================================================================
-- 4. POLÍTICAS DE SELECT PARA PRESTADORES AUTENTICADOS (FIM DO DOS FUNCIONAL)
-- ============================================================================

-- 4.1 Prestador: Transações
GRANT SELECT ON public.prestador_transacoes TO authenticated;
DROP POLICY IF EXISTS gsa_provider_own_transacoes ON public.prestador_transacoes;
CREATE POLICY gsa_provider_own_transacoes ON public.prestador_transacoes
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'prestador' AND prestador_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 4.2 Prestador: Saques
GRANT SELECT ON public.prestador_saques TO authenticated;
DROP POLICY IF EXISTS gsa_provider_own_saques ON public.prestador_saques;
CREATE POLICY gsa_provider_own_saques ON public.prestador_saques
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'prestador' AND prestador_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- 4.3 Prestador: Vouchers
GRANT SELECT ON public.prestador_vouchers TO authenticated;
DROP POLICY IF EXISTS gsa_provider_own_vouchers ON public.prestador_vouchers;
CREATE POLICY gsa_provider_own_vouchers ON public.prestador_vouchers
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'prestador' AND prestador_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );

-- ============================================================================
-- 5. LOJA: POLÍTICA ACTIVE-ONLY EM promocoes_quantidade
-- ============================================================================
ALTER TABLE public.promocoes_quantidade ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.promocoes_quantidade TO authenticated, anon;
DROP POLICY IF EXISTS "gsa_public_read_hardened" ON public.promocoes_quantidade;
DROP POLICY IF EXISTS gsa_public_read_hardened ON public.promocoes_quantidade;

DROP POLICY IF EXISTS gsa_store_promocoes_quantidade_read ON public.promocoes_quantidade;
CREATE POLICY gsa_store_promocoes_quantidade_read ON public.promocoes_quantidade
  FOR SELECT TO authenticated, anon
  USING (status = 'ativo');

DROP POLICY IF EXISTS gsa_management_promocoes_quantidade ON public.promocoes_quantidade;
CREATE POLICY gsa_management_promocoes_quantidade ON public.promocoes_quantidade
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

-- ============================================================================
-- 6. HARDENING DE search_path E RESTRIÇÃO DE RPC DE WEBHOOK
-- ============================================================================

-- 6.1 search_path seguro em gsa_generate_unique_product_code()
ALTER FUNCTION public.gsa_generate_unique_product_code() SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.gsa_generate_unique_product_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_code text;
  is_unique boolean;
  attempts integer := 0;
  max_attempts integer := 100;
BEGIN
  LOOP
    attempts := attempts + 1;
    IF attempts > max_attempts THEN
      RAISE EXCEPTION 'Could not generate a unique product code after % attempts', max_attempts;
    END IF;

    -- Generate PRD-XXXXXXXX (8 digits)
    new_code := 'PRD-' || lpad(floor(random() * 100000000)::text, 8, '0');

    -- Check if it exists
    SELECT NOT EXISTS (
      SELECT 1 FROM public.produtos WHERE codigo_produto = new_code
    ) INTO is_unique;

    EXIT WHEN is_unique;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- 6.2 Restringe execução do webhook de saque cliente exclusivamente a service_role
REVOKE ALL ON FUNCTION public.gsa_webhook_solicitar_saque_cliente(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_webhook_solicitar_saque_cliente(uuid, text, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
