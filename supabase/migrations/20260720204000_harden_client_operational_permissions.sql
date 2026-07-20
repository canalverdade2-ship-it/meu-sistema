-- Restringe RPCs genéricas e normaliza notificações criadas por clientes.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'cliente_operational_write'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path TO public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_guard_client_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor_type TEXT;
  v_actor_id UUID;
BEGIN
  v_actor_type := public.gsa_jwt_actor_type();
  v_actor_id := public.gsa_jwt_actor_id();

  IF v_actor_type <> 'cliente' THEN
    RETURN NEW;
  END IF;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida para criar notificação.';
  END IF;

  -- Chamadas legadas para o próprio cliente podem não informar destinatario_tipo.
  IF NEW.destinatario_tipo IS NULL AND NEW.cliente_id = v_actor_id THEN
    NEW.destinatario_tipo := 'cliente';
  END IF;

  IF NEW.destinatario_tipo = 'cliente' THEN
    IF NEW.cliente_id IS DISTINCT FROM v_actor_id
       OR NEW.prestador_id IS NOT NULL
       OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cliente não pode criar notificação para outro usuário.';
    END IF;
  ELSIF NEW.destinatario_tipo = 'admin' THEN
    IF NEW.cliente_id IS NOT NULL
       OR NEW.prestador_id IS NOT NULL
       OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Notificação administrativa do cliente possui destinatário inválido.';
    END IF;
    NEW.prioridade := CASE
      WHEN NEW.prioridade = 'alta' THEN 'alta'
      ELSE 'normal'
    END;
  ELSE
    RAISE EXCEPTION 'Tipo de destinatário não permitido para sessão de cliente.';
  END IF;

  NEW.tipo := COALESCE(NULLIF(NEW.tipo, ''), 'sistema');
  NEW.lida := false;
  NEW.data_criacao := COALESCE(NEW.data_criacao, NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_guard_client_notification_insert ON public.notificacoes;
CREATE TRIGGER trg_gsa_guard_client_notification_insert
BEFORE INSERT
ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_guard_client_notification_insert();

REVOKE ALL ON FUNCTION public.gsa_guard_client_notification_insert() FROM PUBLIC, anon, authenticated;
