BEGIN;

-- Coupon activations are private client data. Activation is performed only by
-- gsa_client_activate_store_coupon, which validates the custom client session.
ALTER TABLE public.cupons_ativados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cliente_delete_cupons_ativados ON public.cupons_ativados;
DROP POLICY IF EXISTS cliente_insert_cupons_ativados ON public.cupons_ativados;
DROP POLICY IF EXISTS cliente_select_cupons_ativados ON public.cupons_ativados;
DROP POLICY IF EXISTS marketplace_coupon_activations_read ON public.cupons_ativados;
REVOKE ALL ON public.cupons_ativados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cupons_ativados TO authenticated;
GRANT ALL ON public.cupons_ativados TO service_role;
CREATE POLICY gsa_client_own_coupon_activations_read
  ON public.cupons_ativados
  FOR SELECT TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- Support messages previously exposed every provider conversation publicly and
-- allowed arbitrary authorship. Keep realtime for the legitimate participants,
-- but bind visibility and inserts to the authenticated actor.
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total suporte_mensagens" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.suporte_mensagens;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.suporte_mensagens;
REVOKE ALL ON public.suporte_mensagens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.suporte_mensagens TO authenticated;
GRANT ALL ON public.suporte_mensagens TO service_role;

CREATE POLICY gsa_support_message_participant_read
  ON public.suporte_mensagens
  FOR SELECT TO authenticated
  USING (
    (
      public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
      AND public.gsa_admin_has_module('atendimento')
    )
    OR (
      public.gsa_jwt_actor_type() = 'prestador'
      AND EXISTS (
        SELECT 1
          FROM public.prestador_suporte_demandas d
         WHERE d.id = suporte_id
           AND d.prestador_id = public.gsa_jwt_actor_id()
      )
    )
  );

CREATE POLICY gsa_support_message_participant_insert
  ON public.suporte_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    length(trim(mensagem)) BETWEEN 1 AND 5000
    AND (
      (
        public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
        AND public.gsa_admin_has_module('atendimento')
        AND autor_tipo = 'admin'
        AND autor_id = public.gsa_jwt_actor_id()::text
      )
      OR (
        public.gsa_jwt_actor_type() = 'prestador'
        AND autor_tipo = 'prestador'
        AND autor_id = public.gsa_jwt_actor_id()::text
        AND EXISTS (
          SELECT 1
            FROM public.prestador_suporte_demandas d
           WHERE d.id = suporte_id
             AND d.prestador_id = public.gsa_jwt_actor_id()
             AND coalesce(d.status, 'aberto') <> 'fechado'
        )
      )
    )
  );

-- The provider support queue belongs to Atendimento for collaborator RBAC.
DROP POLICY IF EXISTS gsa_collaborator_fail_closed_hardened
  ON public.prestador_suporte_demandas;
DROP POLICY IF EXISTS gsa_collaborator_module_prestador_suporte_demandas
  ON public.prestador_suporte_demandas;
CREATE POLICY gsa_collaborator_module_prestador_suporte_demandas
  ON public.prestador_suporte_demandas
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.gsa_admin_restrict_collaborator_to_module('atendimento'))
  WITH CHECK (public.gsa_admin_restrict_collaborator_to_module('atendimento'));

NOTIFY pgrst, 'reload schema';
COMMIT;
