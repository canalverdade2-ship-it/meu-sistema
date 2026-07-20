-- Revoga sessões ativas sempre que o cadastro do cliente perde autorização.
-- Compatível com instalações que não possuem a coluna física `bloqueado`.

CREATE OR REPLACE FUNCTION public.gsa_revoke_client_sessions_on_access_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_revogar BOOLEAN;
  v_bloqueado BOOLEAN := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cliente_id := OLD.id;
    v_revogar := true;
  ELSE
    v_cliente_id := NEW.id;
    v_bloqueado := COALESCE((to_jsonb(NEW) ->> 'bloqueado')::BOOLEAN, false);
    v_revogar := (
      NEW.status IN ('bloqueado', 'inativo', 'excluido')
      OR v_bloqueado
      OR COALESCE(NEW.cadastro_aprovado, false) = false
    );
  END IF;

  IF v_revogar THEN
    UPDATE public.sistema_sessoes
    SET status = 'encerrado'
    WHERE ator_tipo = 'cliente'
      AND ator_id = v_cliente_id
      AND status <> 'encerrado';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_revoke_client_sessions_update ON public.clientes;
CREATE TRIGGER trg_gsa_revoke_client_sessions_update
AFTER UPDATE
ON public.clientes
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.cadastro_aprovado IS DISTINCT FROM NEW.cadastro_aprovado
  OR (to_jsonb(OLD) ->> 'bloqueado') IS DISTINCT FROM (to_jsonb(NEW) ->> 'bloqueado')
)
EXECUTE FUNCTION public.gsa_revoke_client_sessions_on_access_change();

DROP TRIGGER IF EXISTS trg_gsa_revoke_client_sessions_delete ON public.clientes;
CREATE TRIGGER trg_gsa_revoke_client_sessions_delete
AFTER DELETE
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_revoke_client_sessions_on_access_change();

REVOKE ALL ON FUNCTION public.gsa_revoke_client_sessions_on_access_change() FROM PUBLIC, anon, authenticated;
