BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_vouchers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_grants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsa_calculator_pro_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gsa_calculator_pro_events_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION public.gsa_calculator_redeem_voucher_internal(text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_finalize_payment_internal(text,text,text,text,text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_create_session_internal(text,text,uuid,text,uuid,text,timestamptz) TO service_role;

COMMIT;
