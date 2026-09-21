-- Permite que o webhook consulte somente parceiros publicados sem conceder
-- BYPASSRLS global ao papel service_role desta instalação local.

GRANT SELECT ON TABLE public.parceiros TO service_role;

DROP POLICY IF EXISTS parceiros_service_role_read_active ON public.parceiros;
CREATE POLICY parceiros_service_role_read_active
  ON public.parceiros
  FOR SELECT
  TO service_role
  USING (status = 'ativo');

