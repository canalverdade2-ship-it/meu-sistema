BEGIN;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_admin_approve_preapproved_credit_100(uuid,text,uuid)'::regprocedure) INTO v_def;
  v_def := replace(
    v_def,
    'Liberacao administrativa do credito pre-aprovado de R$ 100,00.',
    'Liberacao pelo sistema do credito pre-aprovado de R$ 100,00.'
  );
  EXECUTE v_def;
END;
$$;

COMMIT;
