BEGIN;

-- 1. Adiciona colunas de controle de status e ativação na tabela parceiros_resgates
ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS link_ativacao text,
  ADD COLUMN IF NOT EXISTS data_ativacao timestamptz;

-- 2. Atualiza a função pública com suporte a e-mail e status inicial pendente
CREATE OR REPLACE FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  p_parceiro_id uuid DEFAULT NULL,
  p_parceiro_slug text DEFAULT NULL,
  p_nome_completo text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $\$
DECLARE
  v_partner public.parceiros%ROWTYPE;
  v_nome text := trim(COALESCE(p_nome_completo, ''));
  v_telefone text := trim(COALESCE(p_telefone, ''));
  v_email text := nullif(trim(COALESCE(p_email, '')), '');
  v_clean_phone text;
  v_codigo_gerado text := NULL;
  v_tipo_resgate text := 'link';
  v_resgate_id uuid;
  v_rand_suffix text;
  v_partner_slug_clean text;
BEGIN
  IF v_nome = '' OR length(v_nome) < 2 THEN
    RAISE EXCEPTION 'Informe seu nome completo para resgatar o benefício.' USING ERRCODE = '22023';
  END IF;

  v_clean_phone := regexp_replace(v_telefone, '\D', '', 'g');
  IF length(v_clean_phone) < 10 THEN
    RAISE EXCEPTION 'Informe um telefone com DDD válido para contato.' USING ERRCODE = '22023';
  END IF;

  -- Localiza o parceiro por ID ou por Slug
  IF p_parceiro_id IS NOT NULL THEN
    SELECT * INTO v_partner FROM public.parceiros WHERE id = p_parceiro_id AND status = 'ativo' LIMIT 1;
  ELSIF p_parceiro_slug IS NOT NULL AND p_parceiro_slug <> '' THEN
    SELECT * INTO v_partner FROM public.parceiros WHERE slug = lower(trim(p_parceiro_slug)) AND status = 'ativo' LIMIT 1;
  END IF;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Parceiro não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;

  -- Gera código de cupom ou voucher se configurado
  v_partner_slug_clean := upper(regexp_replace(COALESCE(v_partner.slug, v_partner.name), '[^A-Za-z0-9]', '', 'g'));
  v_rand_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));

  IF v_partner.redemption_has_coupon THEN
    v_tipo_resgate := 'cupom';
    IF v_partner.redemption_coupon_code IS NOT NULL AND trim(v_partner.redemption_coupon_code) <> '' THEN
      v_codigo_gerado := upper(trim(v_partner.redemption_coupon_code));
    ELSE
      v_codigo_gerado := 'GSA-' || substr(v_partner_slug_clean, 1, 6) || '-' || v_rand_suffix;
    END IF;
  ELSIF v_partner.redemption_has_voucher THEN
    v_tipo_resgate := 'voucher';
    v_codigo_gerado := 'VOUCHER-GSA-' || substr(v_partner_slug_clean, 1, 4) || '-' || v_rand_suffix;
  END IF;

  IF v_partner.redemption_has_link AND (v_partner.redemption_has_coupon OR v_partner.redemption_has_voucher) THEN
    v_tipo_resgate := 'combinado';
  END IF;

  -- Registra na tabela de resgates / leads com status pendente para o admin disponibilizar link de ativação
  INSERT INTO public.parceiros_resgates (
    parceiro_id,
    cliente_id,
    nome_completo,
    email,
    telefone,
    codigo_gerado,
    tipo_resgate,
    link_destino,
    status,
    auto_redirecionado
  ) VALUES (
    v_partner.id,
    p_cliente_id,
    v_nome,
    v_email,
    v_telefone,
    v_codigo_gerado,
    v_tipo_resgate,
    nullif(trim(COALESCE(v_partner.redemption_link, v_partner.website, '')), ''),
    'pendente',
    COALESCE(v_partner.redemption_auto_redirect, false)
  ) RETURNING id INTO v_resgate_id;

  RETURN jsonb_build_object(
    'success', true,
    'resgate_id', v_resgate_id,
    'partner_name', v_partner.name,
    'partner_slug', v_partner.slug,
    'partner_logo', v_partner.logo_url,
    'benefits', v_partner.benefits,
    'tipo_resgate', v_tipo_resgate,
    'codigo_gerado', v_codigo_gerado,
    'has_coupon', v_partner.redemption_has_coupon,
    'has_voucher', v_partner.redemption_has_voucher,
    'has_link', v_partner.redemption_has_link,
    'link', nullif(trim(COALESCE(v_partner.redemption_link, v_partner.website, '')), ''),
    'auto_redirect', COALESCE(v_partner.redemption_auto_redirect, false),
    'instructions', nullif(trim(COALESCE(v_partner.redemption_instructions, '')), '')
  );
END;
$\$;

REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) TO anon, authenticated, service_role;

COMMIT;
