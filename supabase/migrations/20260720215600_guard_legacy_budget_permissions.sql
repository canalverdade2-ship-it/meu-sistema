-- Compatibilidade entre a Home atual e a rotina protegida de orçamento v2.

REVOKE ALL ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb)
  TO service_role;

DO $guard$
BEGIN
  IF to_regprocedure('public.gsa_public_create_enterprise_budget_v2(jsonb)') IS NULL THEN
    GRANT EXECUTE ON FUNCTION public.gsa_public_create_enterprise_budget(jsonb)
      TO anon, authenticated;
  END IF;
END;
$guard$;
