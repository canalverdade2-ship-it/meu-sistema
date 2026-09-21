BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_normalize_partner_redemption_phone(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_digits text := regexp_replace(p_value, '\D', '', 'g');
BEGIN
  IF length(v_digits) IN (12, 13) AND left(v_digits, 2) = '55' THEN
    RETURN substr(v_digits, 3);
  END IF;
  RETURN v_digits;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_normalize_partner_redemption_phone(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_partner_redemption_create_internal(
  p_parceiro_id uuid,
  p_parceiro_slug text,
  p_nome_completo text,
  p_telefone text,
  p_cliente_id uuid,
  p_email text,
  p_allow_duplicate boolean,
  p_justificativa text
)RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner public.parceiros%ROWTYPE;
  v_nome text := trim(COALESCE(p_nome_completo, ''));
  v_telefone text := trim(COALESCE(p_telefone, ''));
  v_email text := nullif(lower(trim(COALESCE(p_email, ''))), '');
  v_clean_phone text;
  v_duplicate boolean := false;
  v_status text := 'pendente';
  v_codigo_gerado text := NULL;
  v_tipo_resgate text := 'link';
  v_resgate_id uuid;
  v_rand_suffix text;
  v_year text := to_char(clock_timestamp(), 'YYYY');
BEGIN
  IF v_nome = '' OR length(v_nome) < 2 THEN
    RAISE EXCEPTION 'Informe seu nome completo para resgatar o benefício.' USING ERRCODE = '22023';
  END IF;

  v_clean_phone := public.gsa_normalize_partner_redemption_phone(v_telefone);
  IF length(v_clean_phone) < 10 THEN
    RAISE EXCEPTION 'Informe um telefone com DDD válido para contato.' USING ERRCODE = '22023';
  END IF;

  IF p_parceiro_id IS NOT NULL THEN
    SELECT * INTO v_partner FROM public.parceiros
     WHERE id = p_parceiro_id AND status = 'ativo' LIMIT 1;
  ELSIF p_parceiro_slug IS NOT NULL AND trim(p_parceiro_slug) <> '' THEN    SELECT * INTO v_partner FROM public.parceiros
     WHERE slug = lower(trim(p_parceiro_slug)) AND status = 'ativo' LIMIT 1;
  END IF;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Parceiro não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;

  -- Serializa solicitações concorrentes do mesmo telefone no mesmo parceiro.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_partner.id::text || '|' || v_clean_phone, 0)
  );

  SELECT EXISTS (
    SELECT 1
      FROM public.parceiros_resgates r
     WHERE r.parceiro_id = v_partner.id
       AND r.status <> 'recusado'
       AND (
         (p_cliente_id IS NOT NULL AND r.cliente_id = p_cliente_id)
         OR (v_email IS NOT NULL AND lower(trim(COALESCE(r.email, ''))) = v_email)
         OR public.gsa_normalize_partner_redemption_phone(COALESCE(r.telefone, '')) = v_clean_phone
       )
  ) INTO v_duplicate;

  IF v_duplicate AND NOT COALESCE(p_allow_duplicate, false) THEN
    RAISE EXCEPTION '409 - Duplicidade: Cliente já possui um resgate para este parceiro.'
      USING ERRCODE = '23505';
  END IF;

  IF COALESCE(p_allow_duplicate, false) THEN
    IF NOT v_duplicate THEN
      RAISE EXCEPTION 'Não foi encontrada duplicidade ativa para justificar novo resgate.' USING ERRCODE = '22023';
    END IF;
    IF length(trim(COALESCE(p_justificativa, ''))) < 3 THEN
      RAISE EXCEPTION 'Informe uma justificativa para solicitar o benefício novamente.' USING ERRCODE = '22023';
    END IF;
    v_status := 'analise';
  END IF;
  v_rand_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_codigo_gerado := 'PROT-RES-' || v_year || '-' || v_rand_suffix;

  IF v_partner.redemption_has_coupon THEN
    v_tipo_resgate := 'cupom';
    IF v_partner.redemption_coupon_code IS NOT NULL
       AND trim(v_partner.redemption_coupon_code) <> '' THEN
      v_codigo_gerado := upper(trim(v_partner.redemption_coupon_code));
    END IF;
  ELSIF v_partner.redemption_has_voucher THEN
    v_tipo_resgate := 'voucher';
  END IF;

  IF v_partner.redemption_has_link
     AND (v_partner.redemption_has_coupon OR v_partner.redemption_has_voucher) THEN
    v_tipo_resgate := 'combinado';
  END IF;

  IF COALESCE(v_partner.redemption_delay_24h, false) THEN
    v_tipo_resgate := 'manual_24h';
  END IF;

  INSERT INTO public.parceiros_resgates (
    parceiro_id, cliente_id, nome_completo, email, telefone,
    codigo_gerado, tipo_resgate, link_destino, status,
    auto_redirecionado, alerta_duplicidade, justificativa_duplicidade
  ) VALUES (
    v_partner.id, p_cliente_id, v_nome, v_email, v_telefone,
    v_codigo_gerado, v_tipo_resgate,
    nullif(trim(COALESCE(v_partner.redemption_link, v_partner.website, '')), ''),
    v_status, COALESCE(v_partner.redemption_auto_redirect, false),
    v_duplicate AND COALESCE(p_allow_duplicate, false),
    CASE WHEN v_duplicate AND COALESCE(p_allow_duplicate, false)
         THEN trim(p_justificativa) ELSE NULL END
  ) RETURNING id INTO v_resgate_id;
  RETURN jsonb_build_object(
    'success', true,
    'resgate_id', v_resgate_id,
    'partner_name', v_partner.name,
    'partner_slug', v_partner.slug,
    'partner_logo', v_partner.logo_url,
    'benefits', v_partner.benefits,
    'tipo_resgate', v_tipo_resgate,
    'status', v_status,
    'alerta_duplicidade', v_duplicate AND COALESCE(p_allow_duplicate, false),
    'codigo_gerado', v_codigo_gerado,
    'protocolo', v_codigo_gerado,
    'email', v_email,
    'telefone', v_telefone,
    'nome_completo', v_nome,
    'has_coupon', v_partner.redemption_has_coupon,
    'has_voucher', v_partner.redemption_has_voucher,
    'has_link', v_partner.redemption_has_link,
    'link', nullif(trim(COALESCE(v_partner.redemption_link, v_partner.website, '')), ''),
    'auto_redirect', COALESCE(v_partner.redemption_auto_redirect, false),
    'instructions', nullif(trim(COALESCE(v_partner.redemption_instructions, '')), ''),
    'delay_24h', COALESCE(v_partner.redemption_delay_24h, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_partner_redemption_create_internal(
  uuid, text, text, text, uuid, text, boolean, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  p_parceiro_id uuid DEFAULT NULL,
  p_parceiro_slug text DEFAULT NULL,
  p_nome_completo text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.gsa_partner_redemption_create_internal(
    p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone,
    p_cliente_id, p_email, false, NULL
  );
$$;

REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  uuid, text, text, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  uuid, text, text, text, uuid, text
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_resgatar_beneficio_parceiro_em_analise(
  p_parceiro_id uuid DEFAULT NULL,
  p_parceiro_slug text DEFAULT NULL,
  p_nome_completo text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.gsa_partner_redemption_create_internal(
    p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone,
    p_cliente_id, p_email, true, p_justificativa
  );
$$;
REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro_em_analise(
  uuid, text, text, text, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro_em_analise(
  uuid, text, text, text, uuid, text, text
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
