-- A confirmação pública precisa informar somente se o token é válido e sua origem.

CREATE OR REPLACE FUNCTION public.gsa_public_lookup_referral(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := trim(coalesce(p_token, ''));
  v_phone text := regexp_replace(coalesce(p_token, ''), '\D', '', 'g');
  v_default_active boolean := false;
  v_default_code text;
  v_referral_found boolean := false;
BEGIN
  IF length(v_token) < 4 OR length(v_token) > 64 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  PERFORM public.gsa_assert_public_rate_limit('indicacao_consulta_ip', 'consulta', 30, interval '15 minutes');
  PERFORM public.gsa_assert_public_rate_limit('indicacao_consulta_token', lower(v_token), 8, interval '15 minutes');

  SELECT coalesce(value, 'false') = 'true' INTO v_default_active
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao_ativo';
  SELECT value INTO v_default_code
    FROM public.system_settings WHERE key = 'codigo_cadastro_padrao';

  IF v_default_active AND upper(v_token) = upper(coalesce(v_default_code, '')) THEN
    RETURN jsonb_build_object('valid', true, 'kind', 'default');
  END IF;

  IF length(v_phone) <> 11 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.indicacoes
     WHERE whatsapp_indicado = v_phone
       AND status = 'aberta'
       AND data_cadastro_indicado IS NULL
       AND coalesce(data_indicacao, current_date - 16) >= current_date - 15
  ) INTO v_referral_found;

  IF NOT v_referral_found THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codigo ou indicacao invalida.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'kind', 'referral');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_lookup_referral(text) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_public_lookup_referral(text) TO anon, authenticated;
