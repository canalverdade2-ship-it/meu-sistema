BEGIN;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status = ANY (ARRAY['aberto'::text, 'em andamento'::text, 'concluido'::text, 'cancelado'::text]));

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_support_ticket(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_ticket public.tickets%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF p_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado para este cliente.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ticket.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_cancelled', true,
      'id', v_ticket.id,
      'status', v_ticket.status,
      'data_fechamento', v_ticket.data_fechamento
    );
  END IF;
  IF v_ticket.status NOT IN ('aberto', 'em andamento') THEN
    RAISE EXCEPTION 'Somente tickets em aberto podem ser cancelados pelo cliente.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tickets
  SET status = 'cancelado',
      data_fechamento = now(),
      updated_at = now()
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'id', v_ticket.id,
    'status', 'cancelado',
    'data_fechamento', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_support_ticket(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_support_ticket(uuid, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
