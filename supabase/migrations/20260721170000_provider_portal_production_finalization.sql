-- Fechamento final de produção do Painel do Prestador.
-- Restringe helpers SECURITY DEFINER internos e mantém expostas somente as RPCs públicas autenticadas.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_provider_session_access_state()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'provider_id', (v_context ->> 'provider_id')::uuid,
    'provider_name', v_context ->> 'provider_name',
    'status', v_context ->> 'status',
    'session_id', v_context ->> 'session_id'
  );
END;
$$;

-- Helpers internos: nunca devem ser chamados diretamente pela API.
REVOKE ALL ON FUNCTION public.gsa_provider_context(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_assert_current_provider() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_assert_current_provider_active() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_write_audit(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_insert_admin_notification(text, text, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_guard_provider_direct_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_guard_provider_schedule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_validate_provider_operational_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_emit_provider_operational_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_revoke_provider_sessions_on_access_change() FROM PUBLIC, anon, authenticated;

-- Remove o privilégio implícito de PUBLIC/anon de todas as operações expostas.
REVOKE ALL ON FUNCTION public.gsa_provider_session_access_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_financial_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_pendency_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_request_withdrawal(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_cancel_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_redeem_voucher(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_redeem_prize(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_activate_promotion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_update_profile(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_create_schedule(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_complete_schedule(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_delete_schedule(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_submit_document(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_transition_demand(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_create_ticket(text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_send_ticket_message(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_request_profile_change(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_provider_request_demand_support(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_provider_session_access_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_financial_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_pendency_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_withdrawal(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_cancel_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_voucher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_prize(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_activate_promotion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_update_profile(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_schedule(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_complete_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_delete_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_submit_document(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_transition_demand(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_ticket(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_send_ticket_message(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_profile_change(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_demand_support(uuid, text) TO authenticated;

REVOKE ALL ON TABLE public.gsa_provider_audit_events FROM PUBLIC, anon, authenticated;

UPDATE storage.buckets
SET public = false
WHERE id IN ('documentos_prestador', 'entregas_demandas')
  AND public IS DISTINCT FROM false;

COMMENT ON FUNCTION public.gsa_provider_session_access_state()
IS 'Retorna o estado atual do prestador somente após validar JWT, sessão GSA e cadastro vigente.';

COMMIT;
