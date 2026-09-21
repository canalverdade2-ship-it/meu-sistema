BEGIN;

-- A aprovação direta é uma função interna. Toda aprovação externa deve passar
-- por gsa_admin_approve_budget, que valida sessão, módulo e auditoria.
REVOKE ALL ON FUNCTION public.aprovar_orcamento_cliente(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_cliente(uuid, uuid)
  TO service_role;

-- Confirma que a RPC administrativa protegida permanece disponível.
REVOKE ALL ON FUNCTION public.gsa_admin_approve_budget(uuid, text, uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_approve_budget(uuid, text, uuid, uuid, text)
  TO authenticated, service_role;

COMMIT;
