BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'gsa_partner_redemption_create_internal'
     AND pg_get_function_identity_arguments(p.oid) =
       'p_parceiro_id uuid, p_parceiro_slug text, p_nome_completo text, p_telefone text, p_cliente_id uuid, p_email text, p_allow_duplicate boolean, p_justificativa text';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Function public.gsa_partner_redemption_create_internal was not found.';
  END IF;

  v_updated_definition := replace(
    v_definition,
    'r.status <> ''recusado''::text',
    'r.status <> ALL (ARRAY[''recusado''::text, ''cancelado''::text])'
  );

  IF v_updated_definition = v_definition THEN
    v_updated_definition := replace(
      v_definition,
      'r.status <> ''recusado''',
      'r.status NOT IN (''recusado'', ''cancelado'')'
    );
  END IF;

  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'Expected duplicate-status predicate was not found in gsa_partner_redemption_create_internal.';
  END IF;

  EXECUTE v_updated_definition;

  SELECT pg_get_functiondef(p.oid)
    INTO v_updated_definition
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'gsa_partner_redemption_create_internal'
     AND pg_get_function_identity_arguments(p.oid) =
       'p_parceiro_id uuid, p_parceiro_slug text, p_nome_completo text, p_telefone text, p_cliente_id uuid, p_email text, p_allow_duplicate boolean, p_justificativa text';

  IF position('cancelado' IN v_updated_definition) = 0 THEN
    RAISE EXCEPTION 'Cancelled-status exclusion was not installed.';
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
