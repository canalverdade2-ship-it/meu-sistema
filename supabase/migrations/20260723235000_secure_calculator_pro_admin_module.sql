BEGIN;

ALTER FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text)
  RENAME TO gsa_admin_calculator_pro_snapshot_internal;
ALTER FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb)
  RENAME TO gsa_admin_save_calculator_pro_product_internal;
ALTER FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text)
  RENAME TO gsa_admin_create_calculator_pro_voucher_internal;
ALTER FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text)
  RENAME TO gsa_admin_set_calculator_pro_voucher_status_internal;
ALTER FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text)
  RENAME TO gsa_admin_search_calculator_pro_clients_internal;
ALTER FUNCTION public.gsa_admin_grant_calculator_pro(uuid,text,uuid,text,timestamptz,text)
  RENAME TO gsa_admin_grant_calculator_pro_internal;
ALTER FUNCTION public.gsa_admin_revoke_calculator_pro_grant(uuid,text,uuid,text)
  RENAME TO gsa_admin_revoke_calculator_pro_grant_internal;

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_require_settings_access(
  p_sessao_id uuid,
  p_session_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF NOT public.gsa_admin_has_module('configuracoes') THEN
    RAISE EXCEPTION 'Acesso negado às configurações das calculadoras Pro' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_calculator_pro_snapshot(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_calculator_pro_snapshot_internal(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_product(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_save_calculator_pro_product_internal(p_sessao_id, p_session_token, p_tool_id, p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_create_calculator_pro_voucher_internal(
    p_sessao_id, p_session_token, p_tool_id, p_expires_at, p_observacoes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(
  p_sessao_id uuid,
  p_session_token text,
  p_voucher_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_set_calculator_pro_voucher_status_internal(
    p_sessao_id, p_session_token, p_voucher_id, p_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_search_calculator_pro_clients(
  p_sessao_id uuid,
  p_session_token text,
  p_query text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_search_calculator_pro_clients_internal(p_sessao_id, p_session_token, p_query);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_grant_calculator_pro(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_tool_id text,
  p_valid_until timestamptz,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_grant_calculator_pro_internal(
    p_sessao_id, p_session_token, p_cliente_id, p_tool_id, p_valid_until, p_observacoes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_revoke_calculator_pro_grant(
  p_sessao_id uuid,
  p_session_token text,
  p_grant_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_calculator_pro_require_settings_access(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_revoke_calculator_pro_grant_internal(
    p_sessao_id, p_session_token, p_grant_id, p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_calculator_pro_require_settings_access(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_calculator_pro_snapshot_internal(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_product_internal(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_create_calculator_pro_voucher_internal(uuid,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status_internal(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_search_calculator_pro_clients_internal(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_grant_calculator_pro_internal(uuid,text,uuid,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_revoke_calculator_pro_grant_internal(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_grant_calculator_pro(uuid,text,uuid,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_revoke_calculator_pro_grant(uuid,text,uuid,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_grant_calculator_pro(uuid,text,uuid,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_revoke_calculator_pro_grant(uuid,text,uuid,text) TO authenticated;

COMMIT;
