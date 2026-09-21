BEGIN;

-- 1. Adiciona colunas de configuração de resgate na tabela de parceiros
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS redemption_has_coupon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_coupon_code text,
  ADD COLUMN IF NOT EXISTS redemption_has_voucher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_has_link boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redemption_link text,
  ADD COLUMN IF NOT EXISTS redemption_auto_redirect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_instructions text;

-- 2. Criação da tabela de resgates de benefícios de parceiros (leads e auditoria)
CREATE TABLE IF NOT EXISTS public.parceiros_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  cliente_id uuid,
  nome_completo text NOT NULL,
  telefone text NOT NULL,
  codigo_gerado text,
  tipo_resgate text NOT NULL DEFAULT 'link',
  link_destino text,
  auto_redirecionado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parceiros_resgates_parceiro_idx ON public.parceiros_resgates (parceiro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS parceiros_resgates_cliente_idx ON public.parceiros_resgates (cliente_id, created_at DESC);

-- 3. Habilita RLS na tabela de resgates
ALTER TABLE public.parceiros_resgates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parceiros_resgates_admin_all" ON public.parceiros_resgates;
CREATE POLICY "parceiros_resgates_admin_all" ON public.parceiros_resgates
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 4. Função pública segura para resgatar benefício
CREATE OR REPLACE FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
  p_parceiro_id uuid DEFAULT NULL,
  p_parceiro_slug text DEFAULT NULL,
  p_nome_completo text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner public.parceiros%ROWTYPE;
  v_nome text := trim(COALESCE(p_nome_completo, ''));
  v_telefone text := trim(COALESCE(p_telefone, ''));
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

  -- Registra na tabela de resgates / leads
  INSERT INTO public.parceiros_resgates (
    parceiro_id,
    cliente_id,
    nome_completo,
    telefone,
    codigo_gerado,
    tipo_resgate,
    link_destino,
    auto_redirecionado
  ) VALUES (
    v_partner.id,
    p_cliente_id,
    v_nome,
    v_telefone,
    v_codigo_gerado,
    v_tipo_resgate,
    nullif(trim(COALESCE(v_partner.redemption_link, v_partner.website, '')), ''),
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
$$;

REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid) TO anon, authenticated, service_role;

-- 5. Atualização da função administrativa de salvar parceiro
CREATE OR REPLACE FUNCTION public.gsa_admin_save_partner(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_partner_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_partner_id;
  v_payload_id text := trim(COALESCE(p_payload ->> 'id', ''));
  v_name text := trim(COALESCE(p_payload ->> 'name', ''));
  v_slug text := lower(trim(COALESCE(p_payload ->> 'slug', '')));
  v_category text := trim(COALESCE(p_payload ->> 'category', ''));
  v_short_description text := trim(COALESCE(p_payload ->> 'short_description', ''));
  v_description text := trim(COALESCE(p_payload ->> 'description', ''));
  v_status text := lower(trim(COALESCE(p_payload ->> 'status', 'ativo')));
  v_service_mode text := lower(trim(COALESCE(p_payload ->> 'service_mode', 'hibrido')));
  v_partner jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF v_id IS NULL AND v_payload_id <> '' THEN
    BEGIN
      v_id := v_payload_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_id := NULL;
    END;
  END IF;

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe um nome válido para o parceiro.' USING ERRCODE = '22023';
  END IF;

  IF v_slug = '' THEN
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
  END IF;

  -- Se v_id ainda for nulo, mas já existir um parceiro com esse slug, assume atualização dele
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.parceiros WHERE slug = v_slug LIMIT 1;
  END IF;

  IF v_category = '' THEN
    v_category := 'Geral';
  END IF;

  IF v_short_description = '' THEN
    v_short_description := COALESCE(nullif(v_description, ''), nullif(trim(COALESCE(p_payload ->> 'benefits', '')), ''), v_name);
  END IF;

  IF v_status NOT IN ('em_analise', 'ativo', 'inativo', 'encerrado', 'excluido') THEN
    v_status := 'ativo';
  END IF;
  IF v_service_mode NOT IN ('presencial', 'online', 'hibrido') THEN
    v_service_mode := 'hibrido';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.parceiros (
      slug, name, legal_name, category, short_description, description,
      logo_url, cover_url, phone, whatsapp, email, website, instagram,
      facebook, linkedin, street, number, complement, neighborhood, city,
      state, zip_code, maps_url, business_hours, service_mode,
      service_regions, services, products, benefits, contact_person,
      internal_notes, featured, display_order, status,
      redemption_has_coupon, redemption_coupon_code,
      redemption_has_voucher, redemption_has_link,
      redemption_link, redemption_auto_redirect, redemption_instructions
    ) VALUES (
      v_slug,
      v_name,
      nullif(trim(COALESCE(p_payload ->> 'legal_name', '')), ''),
      v_category,
      COALESCE(v_short_description, ''),
      nullif(v_description, ''),
      nullif(trim(COALESCE(p_payload ->> 'logo_url', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'cover_url', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'phone', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'whatsapp', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'email', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'website', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'instagram', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'facebook', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'linkedin', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'street', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'number', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'complement', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'neighborhood', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'city', '')), ''),
      nullif(upper(trim(COALESCE(p_payload ->> 'state', ''))), ''),
      nullif(trim(COALESCE(p_payload ->> 'zip_code', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'maps_url', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'business_hours', '')), ''),
      v_service_mode,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'service_regions', '[]'::jsonb))), '{}'::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'services', '[]'::jsonb))), '{}'::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'products', '[]'::jsonb))), '{}'::text[]),
      nullif(trim(COALESCE(p_payload ->> 'benefits', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'contact_person', '')), ''),
      nullif(trim(COALESCE(p_payload ->> 'internal_notes', '')), ''),
      COALESCE((p_payload ->> 'featured')::boolean, false),
      COALESCE((p_payload ->> 'display_order')::integer, 0),
      v_status,
      COALESCE((p_payload ->> 'redemption_has_coupon')::boolean, false),
      nullif(trim(COALESCE(p_payload ->> 'redemption_coupon_code', '')), ''),
      COALESCE((p_payload ->> 'redemption_has_voucher')::boolean, false),
      COALESCE((p_payload ->> 'redemption_has_link')::boolean, true),
      nullif(trim(COALESCE(p_payload ->> 'redemption_link', '')), ''),
      COALESCE((p_payload ->> 'redemption_auto_redirect')::boolean, false),
      nullif(trim(COALESCE(p_payload ->> 'redemption_instructions', '')), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.parceiros
       SET slug = v_slug,
           name = v_name,
           legal_name = nullif(trim(COALESCE(p_payload ->> 'legal_name', '')), ''),
           category = v_category,
           short_description = COALESCE(v_short_description, ''),
           description = nullif(v_description, ''),
           logo_url = nullif(trim(COALESCE(p_payload ->> 'logo_url', '')), ''),
           cover_url = nullif(trim(COALESCE(p_payload ->> 'cover_url', '')), ''),
           phone = nullif(trim(COALESCE(p_payload ->> 'phone', '')), ''),
           whatsapp = nullif(trim(COALESCE(p_payload ->> 'whatsapp', '')), ''),
           email = nullif(trim(COALESCE(p_payload ->> 'email', '')), ''),
           website = nullif(trim(COALESCE(p_payload ->> 'website', '')), ''),
           instagram = nullif(trim(COALESCE(p_payload ->> 'instagram', '')), ''),
           facebook = nullif(trim(COALESCE(p_payload ->> 'facebook', '')), ''),
           linkedin = nullif(trim(COALESCE(p_payload ->> 'linkedin', '')), ''),
           street = nullif(trim(COALESCE(p_payload ->> 'street', '')), ''),
           number = nullif(trim(COALESCE(p_payload ->> 'number', '')), ''),
           complement = nullif(trim(COALESCE(p_payload ->> 'complement', '')), ''),
           neighborhood = nullif(trim(COALESCE(p_payload ->> 'neighborhood', '')), ''),
           city = nullif(trim(COALESCE(p_payload ->> 'city', '')), ''),
           state = nullif(upper(trim(COALESCE(p_payload ->> 'state', ''))), ''),
           zip_code = nullif(trim(COALESCE(p_payload ->> 'zip_code', '')), ''),
           maps_url = nullif(trim(COALESCE(p_payload ->> 'maps_url', '')), ''),
           business_hours = nullif(trim(COALESCE(p_payload ->> 'business_hours', '')), ''),
           service_mode = v_service_mode,
           service_regions = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'service_regions', '[]'::jsonb))), '{}'::text[]),
           services = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'services', '[]'::jsonb))), '{}'::text[]),
           products = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'products', '[]'::jsonb))), '{}'::text[]),
           benefits = nullif(trim(COALESCE(p_payload ->> 'benefits', '')), ''),
           contact_person = nullif(trim(COALESCE(p_payload ->> 'contact_person', '')), ''),
           internal_notes = nullif(trim(COALESCE(p_payload ->> 'internal_notes', '')), ''),
           featured = COALESCE((p_payload ->> 'featured')::boolean, featured),
           display_order = COALESCE((p_payload ->> 'display_order')::integer, display_order),
           status = v_status,
           redemption_has_coupon = COALESCE((p_payload ->> 'redemption_has_coupon')::boolean, redemption_has_coupon),
           redemption_coupon_code = nullif(trim(COALESCE(p_payload ->> 'redemption_coupon_code', redemption_coupon_code, '')), ''),
           redemption_has_voucher = COALESCE((p_payload ->> 'redemption_has_voucher')::boolean, redemption_has_voucher),
           redemption_has_link = COALESCE((p_payload ->> 'redemption_has_link')::boolean, redemption_has_link),
           redemption_link = nullif(trim(COALESCE(p_payload ->> 'redemption_link', redemption_link, '')), ''),
           redemption_auto_redirect = COALESCE((p_payload ->> 'redemption_auto_redirect')::boolean, redemption_auto_redirect),
           redemption_instructions = nullif(trim(COALESCE(p_payload ->> 'redemption_instructions', redemption_instructions, '')), ''),
           updated_at = now()
     WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parceiro não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  SELECT to_jsonb(p)
    INTO v_partner
    FROM public.parceiros p
   WHERE p.id = v_id;

  RETURN jsonb_build_object('partner', v_partner);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) TO authenticated, service_role;

COMMIT;
