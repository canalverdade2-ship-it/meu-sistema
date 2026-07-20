BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_normalize_ticket_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'em_andamento' THEN
    NEW.status := 'em andamento';
  END IF;
  RETURN NEW;
END;
$$;

DO $ticket_trigger$
BEGIN
  IF to_regclass('public.tickets') IS NOT NULL THEN
    UPDATE public.tickets SET status = 'em andamento' WHERE status = 'em_andamento';
    DROP TRIGGER IF EXISTS trg_gsa_normalize_ticket_status ON public.tickets;
    CREATE TRIGGER trg_gsa_normalize_ticket_status
      BEFORE INSERT OR UPDATE OF status ON public.tickets
      FOR EACH ROW EXECUTE FUNCTION public.gsa_normalize_ticket_status();
  END IF;
END;
$ticket_trigger$;

DO $dashboard_compat$
BEGIN
  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid,text)') IS NULL
     AND to_regprocedure('public.gsa_admin_dashboard_snapshot(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text)
      RENAME TO gsa_admin_dashboard_snapshot_pre_ticket_compat;
  END IF;
END;
$dashboard_compat$;

CREATE OR REPLACE FUNCTION public.gsa_admin_dashboard_snapshot(
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
  v_result jsonb;
  v_tickets jsonb := '[]'::jsonb;
BEGIN
  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Snapshot administrativo base não encontrado.';
  END IF;

  v_result := public.gsa_admin_dashboard_snapshot_pre_ticket_compat(p_sessao_id, p_session_token);

  IF public.gsa_admin_has_module('atendimento') AND to_regclass('public.tickets') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY sort_date ASC), '[]'::jsonb)
      INTO v_tickets
      FROM (
        SELECT to_jsonb(t) || jsonb_build_object('cliente_nome', c.nome) AS item,
               t.data_abertura AS sort_date
          FROM public.tickets t
          LEFT JOIN public.clientes c ON c.id = t.cliente_id
         WHERE t.status IN ('aberto', 'em andamento', 'em_andamento')
         ORDER BY t.data_abertura ASC
         LIMIT 5
      ) rows;

    v_result := jsonb_set(
      COALESCE(v_result, '{}'::jsonb),
      '{lists,tickets}',
      COALESCE(v_tickets, '[]'::jsonb),
      true
    );
  END IF;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) TO authenticated, service_role;

COMMIT;
