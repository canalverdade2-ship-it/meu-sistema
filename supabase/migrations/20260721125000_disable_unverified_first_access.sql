-- O primeiro acesso por documento + telefone permitia definir um PIN sem prova de posse.
-- Enquanto o fluxo com OTP não estiver disponível também para prestadores, a rotina
-- permanece exclusivamente administrativa e não pode ser acionada pelo gateway público.

DO $block_unverified_first_access$
DECLARE
  v_signature text;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'gsa_set_pin_and_login'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      v_signature
    );
    EXECUTE format(
      'COMMENT ON FUNCTION %s IS %L',
      v_signature,
      'Primeiro acesso desativado para canais publicos ate confirmacao por OTP; uso administrativo controlado.'
    );
  END LOOP;
END;
$block_unverified_first_access$;
