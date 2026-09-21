BEGIN;

GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_disputes(uuid,text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_dispute_details(uuid,text,uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_credit_dispute(uuid,text,uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_request_credit_dispute_documents(uuid,text,uuid,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_credit_dispute(uuid,text,uuid,text,numeric,text) TO anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_limit_cancellations(uuid,text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_credit_limit_cancellation(uuid,text,uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_credit_limit_cancellation(uuid,text,uuid,boolean,text) TO anon,authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
