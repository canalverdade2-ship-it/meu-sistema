-- A aplicação autentica o cliente por sessão própria validada dentro da RPC.
-- Libera apenas a função externa ao papel anon; a função financeira interna
-- permanece acessível exclusivamente pelo service_role e pelo SECURITY DEFINER.

GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid, text, uuid, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid, text, uuid, text)
  TO service_role;

DO $validation$
BEGIN
  IF NOT has_function_privilege(
    'anon',
    'public.gsa_client_cancel_store_order(uuid,text,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'A função externa de cancelamento continua sem permissão para anon.';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid,text,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'A função financeira interna foi exposta indevidamente.';
  END IF;
END;
$validation$;
