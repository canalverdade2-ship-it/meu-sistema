BEGIN;

ALTER FUNCTION public.gsa_client_transfer_affiliate_balance(uuid, text, uuid, uuid, numeric, text)
  RENAME TO gsa_client_transfer_affiliate_balance_internal;

REVOKE ALL ON FUNCTION public.gsa_client_transfer_affiliate_balance_internal(uuid, text, uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_transfer_affiliate_balance(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_destinatario_id uuid,
  p_valor numeric,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Bypass restrito a esta transacao SECURITY DEFINER. A funcao interna ainda
  -- valida sessao, titularidade, destinatario, saldo e idempotencia.
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  PERFORM set_config('gsa.system_override', 'on', true);

  RETURN public.gsa_client_transfer_affiliate_balance_internal(
    p_sessao_id,
    p_session_token,
    p_request_id,
    p_destinatario_id,
    p_valor,
    p_observacao
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid, text, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid, text, uuid, uuid, numeric, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
