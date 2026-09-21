BEGIN;

-- 1. Garante que todas as colunas de resgate e delay 24h existam na tabela parceiros
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS redemption_has_coupon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_coupon_code text,
  ADD COLUMN IF NOT EXISTS redemption_has_voucher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_has_link boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redemption_link text,
  ADD COLUMN IF NOT EXISTS redemption_auto_redirect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_instructions text,
  ADD COLUMN IF NOT EXISTS redemption_delay_24h boolean NOT NULL DEFAULT false;

-- 2. Atualiza a função administrativa gsa_admin_save_partner para persistir perfeitamente todas as opções
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
      redemption_link, redemption_auto_redirect, redemption_instructions,
      redemption_delay_24h
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
      COALESCE((p_payload ->> 'redemption_has_link')::boolean, false),
      nullif(trim(COALESCE(p_payload ->> 'redemption_link', '')), ''),
      COALESCE((p_payload ->> 'redemption_auto_redirect')::boolean, false),
      nullif(trim(COALESCE(p_payload ->> 'redemption_instructions', '')), ''),
      COALESCE((p_payload ->> 'redemption_delay_24h')::boolean, false)
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
           redemption_has_coupon = COALESCE((p_payload ->> 'redemption_has_coupon')::boolean, false),
           redemption_coupon_code = nullif(trim(COALESCE(p_payload ->> 'redemption_coupon_code', '')) , ''),
           redemption_has_voucher = COALESCE((p_payload ->> 'redemption_has_voucher')::boolean, false),
           redemption_has_link = COALESCE((p_payload ->> 'redemption_has_link')::boolean, false),
           redemption_link = nullif(trim(COALESCE(p_payload ->> 'redemption_link', '')) , ''),
           redemption_auto_redirect = COALESCE((p_payload ->> 'redemption_auto_redirect')::boolean, false),
           redemption_instructions = nullif(trim(COALESCE(p_payload ->> 'redemption_instructions', '')) , ''),
           redemption_delay_24h = COALESCE((p_payload ->> 'redemption_delay_24h')::boolean, false),
           updated_at = now()
     WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parceiro não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM public.gsa_admin_write_audit(
    'parceiros',
    CASE WHEN p_partner_id IS NULL THEN 'CRIAR_PARCEIRO' ELSE 'EDITAR_PARCEIRO' END,
    'parceiros',
    v_id,
    jsonb_build_object(
      'name', v_name, 
      'status', v_status, 
      'redemption_delay_24h', COALESCE((p_payload ->> 'redemption_delay_24h')::boolean, false),
      'redemption_has_link', COALESCE((p_payload ->> 'redemption_has_link')::boolean, false)
    )
  );

  SELECT to_jsonb(p)
    INTO v_partner
    FROM public.parceiros p
   WHERE p.id = v_id;

  RETURN jsonb_build_object('success', true, 'partner', v_partner);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um parceiro com este endereço de página.' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) TO authenticated, service_role;

-- 3. Atualiza gsa_admin_partners_snapshot para garantir retorno de todas as colunas
CREATE OR REPLACE FUNCTION public.gsa_admin_partners_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_partners jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('parceiros');

  SELECT COALESCE(
    jsonb_agg(to_jsonb(p) ORDER BY p.display_order ASC, p.created_at DESC),
    '[]'::jsonb
  )
    INTO v_partners
    FROM public.parceiros p
   WHERE p.status <> 'excluido';

  RETURN jsonb_build_object('actor', v_context, 'partners', v_partners);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_partners_snapshot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_partners_snapshot(uuid, text) TO authenticated, service_role;

COMMIT;
