-- Restringe RPCs de autenticação para uso exclusivo do backend/Edge Function.
-- O navegador deixa de receber credenciais permanentes e não pode consultar
-- diretamente a existência de clientes ou prestadores.
DO $$
DECLARE
  function_signature regprocedure;
  protected_function text;
BEGIN
  FOREACH protected_function IN ARRAY ARRAY[
    'gsa_lookup_portal_account',
    'gsa_login_pin',
    'gsa_set_pin_and_login',
    'gsa_login_admin',
    'gsa_login_colaborador',
    'gsa_recuperar_senha_cliente'
  ]
  LOOP
    FOR function_signature IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = protected_function
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_signature);
    END LOOP;
  END LOOP;
END;
$$;

-- Expõe somente as quatro configurações necessárias ao cadastro público.
CREATE OR REPLACE FUNCTION public.gsa_public_registration_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ativo', COALESCE(
      MAX(CASE WHEN key = 'codigo_cadastro_padrao_ativo' THEN lower(value) END) = 'true',
      false
    ),
    'codigo', COALESCE(
      MAX(CASE WHEN key = 'codigo_cadastro_padrao' THEN value END),
      ''
    ),
    'tipo', CASE
      WHEN MAX(CASE WHEN key = 'bonus_cadastro_tipo' THEN value END) = 'credito' THEN 'credito'
      ELSE 'pontos'
    END,
    'valor', COALESCE(
      NULLIF(MAX(CASE WHEN key = 'bonus_cadastro_valor' THEN value END), '')::numeric,
      0
    )
  )
  FROM public.system_settings
  WHERE key IN (
    'codigo_cadastro_padrao_ativo',
    'codigo_cadastro_padrao',
    'bonus_cadastro_tipo',
    'bonus_cadastro_valor'
  );
$$;

REVOKE ALL ON FUNCTION public.gsa_public_registration_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_registration_settings() TO anon, authenticated;

COMMENT ON FUNCTION public.gsa_public_registration_settings() IS
  'Retorna apenas configurações não sensíveis necessárias ao cadastro público.';
