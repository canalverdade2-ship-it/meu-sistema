-- Migration: Fix affiliate link code format validation in gsa_public_track_affiliate_click
-- The validation regex was '^L[0-9A-Fa-f]{20,32}$' which only matched a hex-based format.
-- But links are generated as 'LNK-XXXX' (sequential numbers via gsa_affiliate_new_code).
-- This caused ALL affiliate click tracking to silently fail with 'Link de afiliado invalido.'
-- making it impossible for any commissions to be attributed to affiliates.

CREATE OR REPLACE FUNCTION public.gsa_public_track_affiliate_click(
  p_codigo text,
  p_visitante_token text,
  p_landing_path text,
  p_referrer_host text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_link record;
  v_landing text := trim(coalesce(p_landing_path, ''));
  v_visitor text := trim(coalesce(p_visitante_token, ''));
  v_raw_token text;
  v_expires timestamptz;
  v_code text := upper(trim(coalesce(p_codigo, '')));
BEGIN
  -- Aceita formato 'LNK-XXXX' (sequencial, gerado por gsa_affiliate_new_code)
  -- e também o formato 'LXXXXXXXXXXXXXXXX' (hex, legado) por compatibilidade
  IF (v_code !~ '^LNK-[0-9]{1,10}$' AND v_code !~ '^L[0-9A-F]{4,32}$')
     OR length(v_visitor) NOT BETWEEN 16 AND 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link de afiliado invalido.');
  END IF;

  PERFORM public.gsa_assert_public_rate_limit(
    'afiliado_clique_ip', lower(trim(p_codigo)), 120, interval '1 hour'
  );
  PERFORM public.gsa_assert_public_rate_limit(
    'afiliado_clique_visitante', v_visitor, 30, interval '1 hour'
  );

  SELECT
    l.id AS link_id, l.destino, l.programa_id,
    p.codigo AS programa_codigo, p.janela_atribuicao_dias
  INTO v_link
  FROM public.gsa_afiliado_links l
  JOIN public.gsa_afiliados a ON a.id = l.afiliado_id
  JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
  WHERE upper(l.codigo) = v_code
    AND l.ativo
    AND a.status = 'ativo'
    AND p.ativo
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link de afiliado indisponivel.');
  END IF;

  IF NOT public.gsa_affiliate_destination_allowed(v_link.programa_id, v_link.destino) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Destino do link indisponivel.');
  END IF;

  IF v_landing = '' OR NOT public.gsa_affiliate_destination_allowed(v_link.programa_id, v_landing) THEN
    v_landing := v_link.destino;
  END IF;

  v_raw_token := lower(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
  v_expires := now() + make_interval(days => v_link.janela_atribuicao_dias);

  INSERT INTO public.gsa_afiliado_cliques(
    link_id, token_hash, visitante_hash, landing_path, referrer_host, expires_at
  ) VALUES (
    v_link.link_id,
    public.gsa_affiliate_hash(v_raw_token),
    public.gsa_affiliate_hash(v_visitor),
    v_landing,
    nullif(left(lower(trim(coalesce(p_referrer_host, ''))), 253), ''),
    v_expires
  );

  RETURN jsonb_build_object(
    'success', true,
    'click_token', v_raw_token,
    'programa_codigo', v_link.programa_codigo,
    'destino', v_link.destino,
    'expires_at', v_expires
  );
END;
$function$;
