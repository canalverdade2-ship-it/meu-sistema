BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.gsa_client_reverse_transfer_base_20260829(uuid,text,uuid)') IS NULL THEN
    ALTER FUNCTION public.gsa_client_reverse_transfer(uuid,text,uuid)
      RENAME TO gsa_client_reverse_transfer_base_20260829;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.gsa_client_reverse_transfer_base_20260829(uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_reverse_transfer_base_20260829(uuid,text,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_reverse_transfer(
  p_sessao_id uuid,p_session_token text,p_transferencia_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor record; v_transfer public.transferencias%rowtype; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_transfer FROM public.transferencias WHERE id=p_transferencia_id;
  IF v_transfer.id IS NULL OR v_transfer.cliente_destino_id<>v_actor.cliente_id THEN
    RAISE EXCEPTION 'Somente o cliente que recebeu a transferência pode estorná-la.' USING ERRCODE='42501';
  END IF;
  v_result:=public.gsa_client_reverse_transfer_base_20260829(p_sessao_id,p_session_token,p_transferencia_id);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_reverse_transfer(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_reverse_transfer(uuid,text,uuid) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
