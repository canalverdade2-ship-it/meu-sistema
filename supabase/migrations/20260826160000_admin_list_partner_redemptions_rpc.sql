BEGIN;

-- 1. Garante colunas necessárias em parceiros_resgates
ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS link_ativacao text,
  ADD COLUMN IF NOT EXISTS data_ativacao timestamptz;

-- 2. Atualiza a função pública com suporte a e-mail
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
AS $$
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

  -- Registra na tabela de resgates / leads
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
    'instructions', nullif(trim(COALESCE(v_partner.redemption_instructions, '')), ''),
    'delay_24h', COALESCE(v_partner.redemption_delay_24h, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) TO anon, authenticated, service_role;

-- 3. Função administrativa RPC para listar resgates com junção de dados cadastrais
CREATE OR REPLACE FUNCTION public.gsa_admin_list_partner_redemptions(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_redemptions jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('parceiros');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'parceiro_id', r.parceiro_id,
        'cliente_id', r.cliente_id,
        'nome_completo', r.nome_completo,
        'email', COALESCE(nullif(r.email, ''), c.email),
        'telefone', COALESCE(nullif(r.telefone, ''), c.telefone),
        'cpf', c.cpf,
        'endereco', c.endereco,
        'cidade', c.cidade,
        'estado', c.estado,
        'cep', c.cep,
        'codigo_gerado', r.codigo_gerado,
        'tipo_resgate', r.tipo_resgate,
        'link_destino', r.link_destino,
        'link_ativacao', r.link_ativacao,
        'status', COALESCE(r.status, 'pendente'),
        'data_ativacao', r.data_ativacao,
        'auto_redirecionado', r.auto_redirecionado,
        'created_at', r.created_at,
        'parceiro_name', p.name,
        'parceiro_slug', p.slug,
        'parceiro_benefits', p.benefits,
        'parceiro_logo', p.logo_url
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_redemptions
  FROM public.parceiros_resgates r
  JOIN public.parceiros p ON p.id = r.parceiro_id
  LEFT JOIN public.clientes c ON (
    c.id = r.cliente_id OR 
    (c.telefone IS NOT NULL AND length(regexp_replace(c.telefone, '\D', '', 'g')) >= 10 AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(r.telefone, '\D', '', 'g')) OR
    (c.email IS NOT NULL AND r.email IS NOT NULL AND lower(trim(c.email)) = lower(trim(r.email)))
  )
  WHERE p_partner_id IS NULL OR r.parceiro_id = p_partner_id;

  RETURN jsonb_build_object('redemptions', v_redemptions);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_list_partner_redemptions(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_partner_redemptions(uuid, text, uuid) TO authenticated, service_role;

-- 4. Função administrativa RPC para concluir ativação de resgate
CREATE OR REPLACE FUNCTION public.gsa_admin_complete_partner_redemption(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resgate_id uuid DEFAULT NULL,
  p_link_ativacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_link text := trim(COALESCE(p_link_ativacao, ''));
  v_resgate record;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF p_resgate_id IS NULL THEN
    RAISE EXCEPTION 'ID do resgate é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF v_clean_link = '' THEN
    RAISE EXCEPTION 'Informe o link de ativação gerado no site do parceiro.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.parceiros_resgates
     SET link_ativacao = v_clean_link,
         status = 'concluido',
         data_ativacao = now()
   WHERE id = p_resgate_id
  RETURNING * INTO v_resgate;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'resgate', to_jsonb(v_resgate)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_complete_partner_redemption(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_complete_partner_redemption(uuid, text, uuid, text) TO authenticated, service_role;

COMMIT;
