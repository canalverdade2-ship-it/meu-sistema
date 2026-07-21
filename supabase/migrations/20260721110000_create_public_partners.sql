BEGIN;

CREATE TABLE IF NOT EXISTS public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  category text NOT NULL,
  short_description text NOT NULL,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  linkedin text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  maps_url text,
  business_hours text,
  service_mode text NOT NULL DEFAULT 'hibrido' CHECK (service_mode IN ('presencial', 'online', 'hibrido')),
  service_regions text[] NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{}',
  products text[] NOT NULL DEFAULT '{}',
  benefits text,
  contact_person text,
  internal_notes text,
  featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'ativo', 'inativo', 'encerrado', 'excluido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parceiros_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT parceiros_state_length CHECK (state IS NULL OR char_length(state) <= 2)
);

CREATE INDEX IF NOT EXISTS parceiros_public_listing_idx
  ON public.parceiros (status, featured DESC, display_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS parceiros_category_idx ON public.parceiros (category);
CREATE INDEX IF NOT EXISTS parceiros_city_state_idx ON public.parceiros (city, state);

CREATE OR REPLACE FUNCTION public.gsa_touch_parceiros_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parceiros_updated_at ON public.parceiros;
CREATE TRIGGER trg_parceiros_updated_at
BEFORE UPDATE ON public.parceiros
FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_parceiros_updated_at();

ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parceiros_public_read_active ON public.parceiros;
CREATE POLICY parceiros_public_read_active
ON public.parceiros
FOR SELECT
TO anon, authenticated
USING (status = 'ativo');

-- Escritas administrativas são executadas somente pelas funções SECURITY DEFINER
-- abaixo, que validam a sessão GSA, a permissão do módulo e registram auditoria.
REVOKE ALL ON public.parceiros FROM anon, authenticated;
GRANT SELECT ON public.parceiros TO anon, authenticated;

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
    FROM public.parceiros p;

  RETURN jsonb_build_object('actor', v_context, 'partners', v_partners);
END;
$$;

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
  v_name text := trim(COALESCE(p_payload ->> 'name', ''));
  v_slug text := lower(trim(COALESCE(p_payload ->> 'slug', '')));
  v_category text := trim(COALESCE(p_payload ->> 'category', ''));
  v_short_description text := trim(COALESCE(p_payload ->> 'short_description', ''));
  v_status text := lower(trim(COALESCE(p_payload ->> 'status', 'em_analise')));
  v_service_mode text := lower(trim(COALESCE(p_payload ->> 'service_mode', 'hibrido')));
  v_partner jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe um nome válido para o parceiro.' USING ERRCODE = '22023';
  END IF;
  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'O endereço da página do parceiro é inválido.' USING ERRCODE = '22023';
  END IF;
  IF length(v_category) < 2 THEN
    RAISE EXCEPTION 'Informe uma categoria válida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_short_description) < 10 THEN
    RAISE EXCEPTION 'A descrição curta deve ter pelo menos 10 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('em_analise', 'ativo', 'inativo', 'encerrado', 'excluido') THEN
    RAISE EXCEPTION 'Status do parceiro inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_service_mode NOT IN ('presencial', 'online', 'hibrido') THEN
    RAISE EXCEPTION 'Modalidade de atendimento inválida.' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.parceiros (
      slug, name, legal_name, category, short_description, description,
      logo_url, cover_url, phone, whatsapp, email, website, instagram,
      facebook, linkedin, street, number, complement, neighborhood, city,
      state, zip_code, maps_url, business_hours, service_mode,
      service_regions, services, products, benefits, contact_person,
      internal_notes, featured, display_order, status
    ) VALUES (
      v_slug,
      v_name,
      nullif(trim(COALESCE(p_payload ->> 'legal_name', '')), ''),
      v_category,
      v_short_description,
      nullif(trim(COALESCE(p_payload ->> 'description', '')), ''),
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
      v_status
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.parceiros
       SET slug = v_slug,
           name = v_name,
           legal_name = nullif(trim(COALESCE(p_payload ->> 'legal_name', '')), ''),
           category = v_category,
           short_description = v_short_description,
           description = nullif(trim(COALESCE(p_payload ->> 'description', '')), ''),
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
           featured = COALESCE((p_payload ->> 'featured')::boolean, false),
           display_order = COALESCE((p_payload ->> 'display_order')::integer, 0),
           status = v_status
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
    jsonb_build_object('name', v_name, 'status', v_status, 'featured', COALESCE((p_payload ->> 'featured')::boolean, false))
  );

  SELECT to_jsonb(p) INTO v_partner FROM public.parceiros p WHERE p.id = v_id;
  RETURN jsonb_build_object('success', true, 'partner', v_partner);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um parceiro com este endereço de página.' USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_partner_status(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_partner_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := lower(trim(COALESCE(p_status, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF v_status NOT IN ('em_analise', 'ativo', 'inativo', 'encerrado', 'excluido') THEN
    RAISE EXCEPTION 'Status do parceiro inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.parceiros SET status = v_status WHERE id = p_partner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parceiro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit(
    'parceiros',
    'ALTERAR_STATUS_PARCEIRO',
    'parceiros',
    p_partner_id,
    jsonb_build_object('status', v_status)
  );

  RETURN jsonb_build_object('success', true, 'id', p_partner_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_partners_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_partner_status(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_partners_snapshot(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_partner(uuid, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_partner_status(uuid, text, uuid, text) TO authenticated, service_role;

COMMENT ON TABLE public.parceiros IS 'Rede pública de parceiros da GSA HUB, com gestão administrativa e publicação controlada por status.';
COMMENT ON COLUMN public.parceiros.internal_notes IS 'Campo exclusivamente administrativo; não deve ser selecionado nas consultas públicas.';
COMMENT ON COLUMN public.parceiros.contact_person IS 'Responsável interno pelo relacionamento com o parceiro; não deve ser selecionado nas consultas públicas.';

COMMIT;
