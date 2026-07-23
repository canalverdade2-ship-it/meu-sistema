BEGIN;

-- O perfil de afiliado só pode ser criado ou alterado depois que o cliente
-- comprovar a posse da conta GSA pelo login com PIN. Mantemos a assinatura
-- antiga apenas para responder de forma segura a clientes desatualizados.
CREATE OR REPLACE FUNCTION public.gsa_public_register_affiliate(p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'success', false,
    'requires_authentication', true,
    'error', 'Autentique a conta GSA com CPF/CNPJ e PIN antes de ativar o perfil de afiliado.'
  );
$$;

REVOKE ALL ON FUNCTION public.gsa_public_register_affiliate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_affiliate(jsonb) TO service_role;

COMMIT;
