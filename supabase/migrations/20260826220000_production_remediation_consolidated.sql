-- =============================================================================
-- Migration: 20260826220000_production_remediation_consolidated.sql
-- Description: Consolidated production database remediation for GSA HUB
-- Covers:
--   1. 6 Missing Tables: contratos, blog_posts, loja_vaquinhas,
--      loja_vaquinha_contribuicoes, gsa_hero_banners, whatsapp_pendencias_ativas
--   2. 9 Missing Columns across existing tables with safe backfills
--   3. RPC Functions: Partner redemption lifecycle, travel refunds, budget approval,
--      store gift vaquinhas, whatsapp pendencies
--   4. RLS Policies and PostgREST schema cache reload
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABELAS AUSENTES E POLÍTICAS RLS
-- =============================================================================

-- 1.1 Contratos (SD4 Contratos & Documentos)
CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_contrato text UNIQUE NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'prestacao_servicos',
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  cliente_documento text,
  status text NOT NULL DEFAULT 'ativo',
  valor_mensal numeric(12,2) DEFAULT 0,
  valor_total numeric(12,2) DEFAULT 0,
  data_inicio date DEFAULT current_date,
  data_fim date,
  renovacao_automatica boolean DEFAULT true,
  dias_para_vencimento integer DEFAULT 180,
  signatarios jsonb DEFAULT '[]'::jsonb,
  termos_aditivos_count integer DEFAULT 0,
  clausulas_resumo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_admin_access" ON public.contratos;
CREATE POLICY "contratos_admin_access" 
  ON public.contratos 
  FOR ALL 
  TO authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "contratos_anon_select" ON public.contratos;
CREATE POLICY "contratos_anon_select" 
  ON public.contratos 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON public.contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_codigo ON public.contratos(codigo_contrato);

-- 1.2 Blog Posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  content text,
  image text,
  category text,
  author text DEFAULT 'GSA Curadoria (N8N)',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
CREATE POLICY "blog_posts_public_read" 
  ON public.blog_posts 
  FOR SELECT 
  TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "blog_posts_admin_write" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_write" 
  ON public.blog_posts 
  FOR ALL 
  TO authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published_at DESC);

-- 1.3 Loja Vaquinhas (Presente em Grupo - GSA Store)
CREATE TABLE IF NOT EXISTS public.loja_vaquinhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  organizador_nome text NOT NULL,
  organizador_telefone text NOT NULL,
  organizador_email text,
  organizador_id uuid,
  presenteado_nome text NOT NULL,
  data_evento date,
  mensagem text,
  meta_valor numeric(12,2) NOT NULL,
  valor_arrecadado numeric(12,2) NOT NULL DEFAULT 0.00,
  quantidade_contribuicoes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'concluida', 'cancelada', 'expirada')),
  endereco_entrega jsonb,
  pedido_gerado_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loja_vaquinhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_vaquinhas_public_access" ON public.loja_vaquinhas;
CREATE POLICY "loja_vaquinhas_public_access" 
  ON public.loja_vaquinhas 
  FOR ALL 
  TO anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_loja_vaquinhas_codigo ON public.loja_vaquinhas(codigo);
CREATE INDEX IF NOT EXISTS idx_loja_vaquinhas_status ON public.loja_vaquinhas(status);

-- 1.4 Loja Vaquinha Contribuições
CREATE TABLE IF NOT EXISTS public.loja_vaquinha_contribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vaquinha_id uuid NOT NULL REFERENCES public.loja_vaquinhas(id) ON DELETE CASCADE,
  contribuinte_nome text NOT NULL,
  contribuinte_telefone text,
  contribuinte_email text,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  mensagem text,
  pix_copia_cola text,
  pix_qr_code_url text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  transacao_id text,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loja_vaquinha_contribuicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_vaquinha_contribuicoes_public_access" ON public.loja_vaquinha_contribuicoes;
CREATE POLICY "loja_vaquinha_contribuicoes_public_access" 
  ON public.loja_vaquinha_contribuicoes 
  FOR ALL 
  TO anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_loja_vaquinha_contribuicoes_vaquinha ON public.loja_vaquinha_contribuicoes(vaquinha_id);
CREATE INDEX IF NOT EXISTS idx_loja_vaquinha_contribuicoes_status ON public.loja_vaquinha_contribuicoes(status);

-- 1.5 Hero Banners (Marketplace)
CREATE TABLE IF NOT EXISTS public.gsa_hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  image_mobile_url text,
  link_url text,
  button_text text DEFAULT 'Confira agora',
  background_color text DEFAULT '#17345f',
  display_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_hero_banners_title_check CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  CONSTRAINT gsa_hero_banners_display_order_check CHECK (display_order BETWEEN 1 AND 999),
  CONSTRAINT gsa_hero_banners_period_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.gsa_hero_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active hero banners" ON public.gsa_hero_banners;
CREATE POLICY "Public can view active hero banners"
  ON public.gsa_hero_banners
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

DROP POLICY IF EXISTS "Admins and Service Role full access hero banners" ON public.gsa_hero_banners;
CREATE POLICY "Admins and Service Role full access hero banners"
  ON public.gsa_hero_banners
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Ofertas Exclusivas', 'Aproveite os melhores preços em tecnologia', '/images/marketplace/produtos-assinaturas-hero.jpg', '/marketplace/produtos-assinaturas', '#17345f', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Ofertas Exclusivas');

INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Semana do Consumidor', 'Até 50% de desconto e pontos em dobro', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2000&q=80', '/marketplace/produtos-assinaturas', '#d8bd73', 2, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Semana do Consumidor');

INSERT INTO public.gsa_hero_banners (title, subtitle, image_url, link_url, background_color, display_order, is_active)
SELECT 'Novidades da Estação', 'Confira os lançamentos que acabaram de chegar', 'https://images.unsplash.com/photo-1572584642822-8f6a4597d22b?auto=format&fit=crop&w=2000&q=80', '/marketplace/produtos-assinaturas', '#e8a838', 3, true
WHERE NOT EXISTS (SELECT 1 FROM public.gsa_hero_banners WHERE title = 'Novidades da Estação');

-- 1.6 WhatsApp Pendências Ativas
CREATE TABLE IF NOT EXISTS public.whatsapp_pendencias_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  modulo text NOT NULL,
  registro_id text NOT NULL,
  tipo_esperado text NOT NULL CHECK (tipo_esperado IN ('arquivo', 'texto', 'opcao', 'qualquer')),
  status text NOT NULL DEFAULT 'aguardando_resposta' CHECK (status IN ('aguardando_resposta', 'processado', 'expirado')),
  mensagem_contexto text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '3 days')
);
ALTER TABLE public.whatsapp_pendencias_ativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_pendencias_auth_read" ON public.whatsapp_pendencias_ativas;
CREATE POLICY "whatsapp_pendencias_auth_read" 
  ON public.whatsapp_pendencias_ativas 
  FOR SELECT 
  TO authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "whatsapp_pendencias_all_access" ON public.whatsapp_pendencias_ativas;
CREATE POLICY "whatsapp_pendencias_all_access" 
  ON public.whatsapp_pendencias_ativas 
  FOR ALL 
  TO authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wp_pendencias_telefone ON public.whatsapp_pendencias_ativas(telefone) WHERE status = 'aguardando_resposta';
CREATE INDEX IF NOT EXISTS idx_wp_pendencias_cliente ON public.whatsapp_pendencias_ativas(cliente_id);

-- =============================================================================
-- 2. COLUNAS AUSENTES (IDEMPOTENTE)
-- =============================================================================

ALTER TABLE public.cliente_promocoes ADD COLUMN IF NOT EXISTS visualizado boolean NOT NULL DEFAULT false;
ALTER TABLE public.viagens_transacoes ADD COLUMN IF NOT EXISTS resposta_admin text;

ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS avaliacao_media numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_avaliacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comentarios_importados jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.prestador_documentos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.prestador_promocoes ADD COLUMN IF NOT EXISTS data_inicio timestamptz DEFAULT now();

ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS nome_completo text;
UPDATE public.prestadores 
   SET nome_completo = COALESCE(nome_responsavel, nome_razao) 
 WHERE nome_completo IS NULL;

-- =============================================================================
-- 3. RPCS: RESGATE DE PARCEIROS COMERCIAIS (PÚBLICO & ADMIN)
-- =============================================================================

-- Remove sobrecarga antiga de 5 argumentos
DROP FUNCTION IF EXISTS public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid);

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
  v_year text := to_char(clock_timestamp(), 'YYYY');
BEGIN
  IF v_nome = '' OR length(v_nome) < 2 THEN
    RAISE EXCEPTION 'Informe seu nome completo para resgatar o benefício.' USING ERRCODE = '22023';
  END IF;

  v_clean_phone := regexp_replace(v_telefone, '\D', '', 'g');
  IF length(v_clean_phone) < 10 THEN
    RAISE EXCEPTION 'Informe um telefone com DDD válido para contato.' USING ERRCODE = '22023';
  END IF;

  IF p_parceiro_id IS NOT NULL THEN
    SELECT * INTO v_partner FROM public.parceiros WHERE id = p_parceiro_id AND status = 'ativo' LIMIT 1;
  ELSIF p_parceiro_slug IS NOT NULL AND p_parceiro_slug <> '' THEN
    SELECT * INTO v_partner FROM public.parceiros WHERE slug = lower(trim(p_parceiro_slug)) AND status = 'ativo' LIMIT 1;
  END IF;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Parceiro não encontrado ou inativo.' USING ERRCODE = 'P0002';
  END IF;

  v_rand_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_codigo_gerado := 'PROT-RES-' || v_year || '-' || v_rand_suffix;

  IF v_partner.redemption_has_coupon THEN
    v_tipo_resgate := 'cupom';
    IF v_partner.redemption_coupon_code IS NOT NULL AND trim(v_partner.redemption_coupon_code) <> '' THEN
      v_codigo_gerado := upper(trim(v_partner.redemption_coupon_code));
    END IF;
  ELSIF v_partner.redemption_has_voucher THEN
    v_tipo_resgate := 'voucher';
  END IF;

  IF v_partner.redemption_has_link AND (v_partner.redemption_has_coupon OR v_partner.redemption_has_voucher) THEN
    v_tipo_resgate := 'combinado';
  END IF;

  IF COALESCE(v_partner.redemption_delay_24h, false) THEN
    v_tipo_resgate := 'manual_24h';
  END IF;

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

REVOKE ALL ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text) TO anon, authenticated, service_role;

-- RPC Admin Concluir Resgate de Parceiro
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

-- =============================================================================
-- 4. RPCS OPERACIONAIS E FINANCEIRAS
-- =============================================================================

-- Aprovação de Orçamento pelo Admin (SD1 Operações)
CREATE OR REPLACE FUNCTION public.gsa_admin_approve_budget(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_orcamento_id uuid DEFAULT NULL,
  p_approval_kind text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb;
  v_orc public.orcamentos%ROWTYPE;
  v_result jsonb;
BEGIN
  v_actor := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('operacoes');

  IF p_orcamento_id IS NULL THEN
    RAISE EXCEPTION 'ID do orçamento é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  v_result := public.aprovar_orcamento_cliente(p_orcamento_id, v_orc.cliente_id);

  PERFORM public.gsa_admin_write_audit(
    'operacoes',
    'APROVAR_ORCAMENTO',
    'orcamentos',
    p_orcamento_id,
    jsonb_build_object('kind', p_approval_kind, 'request_id', p_request_id, 'result', v_result)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_approve_budget(uuid, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_approve_budget(uuid, text, uuid, uuid, text) TO authenticated, service_role;

-- Processamento de Reembolso de Viagens (SD1 / TravelAdminModule)
CREATE OR REPLACE FUNCTION public.gsa_admin_process_travel_refund(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_transacao_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_valor_bruto numeric DEFAULT NULL,
  p_taxas numeric DEFAULT 0,
  p_resposta text DEFAULT NULL,
  p_comprovante text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb;
  v_tx public.viagens_transacoes%ROWTYPE;
  v_cancelamento public.viagens_cancelamentos%ROWTYPE;
  v_valor_liquido numeric;
BEGIN
  v_actor := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('viagens');

  IF p_transacao_id IS NULL THEN
    RAISE EXCEPTION 'ID da transação é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM public.viagens_transacoes WHERE id = p_transacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cancelamento FROM public.viagens_cancelamentos WHERE transacao_id = p_transacao_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF p_action = 'approve' THEN
    v_valor_liquido := GREATEST(COALESCE(p_valor_bruto, 0) - COALESCE(p_taxas, 0), 0);
    IF v_cancelamento.id IS NOT NULL THEN
      UPDATE public.viagens_cancelamentos
         SET status = 'reembolso_aprovado',
             valor_solicitado = COALESCE(p_valor_bruto, valor_solicitado),
             taxas_aplicaveis = COALESCE(p_taxas, 0),
             valor_reembolsado = v_valor_liquido,
             resposta_gsa = COALESCE(p_resposta, resposta_gsa),
             decidido_em = now()
       WHERE id = v_cancelamento.id;
    END IF;
    UPDATE public.viagens_transacoes
       SET status = 'reembolso_aprovado',
           resposta_admin = p_resposta,
           updated_at = now()
     WHERE id = p_transacao_id;

    RETURN jsonb_build_object('success', true, 'status', 'reembolso_aprovado', 'valor_reembolso', v_valor_liquido);

  ELSIF p_action = 'complete' THEN
    IF v_cancelamento.id IS NOT NULL THEN
      UPDATE public.viagens_cancelamentos
         SET status = 'concluido',
             concluido_em = now()
       WHERE id = v_cancelamento.id;
    END IF;
    UPDATE public.viagens_transacoes
       SET status = 'reembolsado',
           comprovante_compra_storage = COALESCE(p_comprovante, comprovante_compra_storage),
           updated_at = now()
     WHERE id = p_transacao_id;

    RETURN jsonb_build_object('success', true, 'status', 'reembolso_reembolsado', 'valor_reembolso', COALESCE(v_cancelamento.valor_reembolsado, 0));

  ELSIF p_action = 'deny' THEN
    IF v_cancelamento.id IS NOT NULL THEN
      UPDATE public.viagens_cancelamentos
         SET status = 'reembolso_negado',
             resposta_gsa = COALESCE(p_resposta, resposta_gsa),
             decidido_em = now()
       WHERE id = v_cancelamento.id;
    END IF;
    UPDATE public.viagens_transacoes
       SET status = 'reembolso_negado',
           resposta_admin = p_resposta,
           updated_at = now()
     WHERE id = p_transacao_id;

    RETURN jsonb_build_object('success', true, 'status', 'reembolso_negado');
  ELSE
    RAISE EXCEPTION 'Ação de reembolso inválida: %', p_action USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_process_travel_refund(uuid, text, uuid, uuid, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_process_travel_refund(uuid, text, uuid, uuid, text, numeric, numeric, text, text) TO authenticated, service_role;

-- =============================================================================
-- 5. RPCS: VAQUINHAS E PRESENTES EM GRUPO
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gsa_criar_vaquinha(p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_vaquinha record;
  v_meta numeric;
BEGIN
  v_codigo := 'VAQ-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
  
  v_meta := COALESCE((p_dados->>'meta_valor')::numeric, 0.00);
  IF v_meta <= 0 THEN
    RAISE EXCEPTION 'O valor da meta da vaquinha deve ser maior que zero.';
  END IF;

  INSERT INTO public.loja_vaquinhas (
    codigo,
    produto_id,
    produto_snapshot,
    organizador_nome,
    organizador_telefone,
    organizador_email,
    organizador_id,
    presenteado_nome,
    data_evento,
    mensagem,
    meta_valor,
    endereco_entrega
  ) VALUES (
    v_codigo,
    (p_dados->>'produto_id')::uuid,
    COALESCE(p_dados->'produto_snapshot', '{}'::jsonb),
    COALESCE(p_dados->>'organizador_nome', 'Organizador'),
    COALESCE(p_dados->>'organizador_telefone', ''),
    p_dados->>'organizador_email',
    (p_dados->>'organizador_id')::uuid,
    COALESCE(p_dados->>'presenteado_nome', 'Amigo(a)'),
    (p_dados->>'data_evento')::date,
    p_dados->>'mensagem',
    v_meta,
    p_dados->'endereco_entrega'
  )
  RETURNING * INTO v_vaquinha;

  RETURN jsonb_build_object(
    'success', true,
    'vaquinha', row_to_json(v_vaquinha)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_criar_vaquinha(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_obter_vaquinha(p_codigo_ou_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vaquinha record;
  v_contribuicoes jsonb;
  v_percentual numeric;
  v_restante numeric;
BEGIN
  IF p_codigo_ou_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE id = p_codigo_ou_id::uuid;
  ELSE
    SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE LOWER(codigo) = LOWER(p_codigo_ou_id);
  END IF;

  IF v_vaquinha.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vaquinha não encontrada.');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'contribuinte_nome', c.contribuinte_nome,
      'valor', c.valor,
      'mensagem', c.mensagem,
      'pago_em', c.pago_em,
      'created_at', c.created_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_contribuicoes
  FROM public.loja_vaquinha_contribuicoes c
  WHERE c.vaquinha_id = v_vaquinha.id AND c.status = 'pago';

  v_percentual := LEAST(100.00, ROUND((v_vaquinha.valor_arrecadado / GREATEST(v_vaquinha.meta_valor, 0.01)) * 100, 1));
  v_restante := GREATEST(0.00, v_vaquinha.meta_valor - v_vaquinha.valor_arrecadado);

  RETURN jsonb_build_object(
    'success', true,
    'vaquinha', row_to_json(v_vaquinha),
    'contribuicoes', v_contribuicoes,
    'percentual', v_percentual,
    'valor_restante', v_restante,
    'meta_atingida', v_vaquinha.valor_arrecadado >= v_vaquinha.meta_valor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_obter_vaquinha(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_confirmar_contribuicao_vaquinha(
  p_contribuicao_id uuid,
  p_transacao_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrib record;
  v_vaquinha record;
  v_novo_arrecadado numeric;
  v_nova_qtd integer;
  v_novo_status text;
BEGIN
  SELECT * INTO v_contrib FROM public.loja_vaquinha_contribuicoes WHERE id = p_contribuicao_id;
  IF v_contrib.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contribuição não encontrada.');
  END IF;

  IF v_contrib.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Contribuição já confirmada anteriormente.');
  END IF;

  UPDATE public.loja_vaquinha_contribuicoes
  SET status = 'pago',
      pago_em = now(),
      transacao_id = COALESCE(p_transacao_id, transacao_id, 'PIX-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))
  WHERE id = p_contribuicao_id;

  SELECT 
    COALESCE(SUM(valor), 0.00),
    COUNT(*)
  INTO v_novo_arrecadado, v_nova_qtd
  FROM public.loja_vaquinha_contribuicoes
  WHERE vaquinha_id = v_contrib.vaquinha_id AND status = 'pago';

  SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE id = v_contrib.vaquinha_id;
  v_novo_status := CASE WHEN v_novo_arrecadado >= v_vaquinha.meta_valor THEN 'concluida' ELSE 'aberta' END;

  UPDATE public.loja_vaquinhas
  SET valor_arrecadado = v_novo_arrecadado,
      quantidade_contribuicoes = v_nova_qtd,
      status = v_novo_status,
      updated_at = now()
  WHERE id = v_contrib.vaquinha_id;

  RETURN jsonb_build_object(
    'success', true,
    'valor_arrecadado', v_novo_arrecadado,
    'quantidade_contribuicoes', v_nova_qtd,
    'status', v_novo_status,
    'meta_atingida', v_novo_arrecadado >= v_vaquinha.meta_valor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(uuid, text) TO anon, authenticated, service_role;

-- =============================================================================
-- 6. RPCS: WHATSAPP PENDÊNCIAS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gsa_registrar_pendencia_whatsapp(
  p_cliente_id uuid,
  p_telefone text,
  p_modulo text,
  p_registro_id text,
  p_tipo_esperado text,
  p_mensagem_contexto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.whatsapp_pendencias_ativas
  SET status = 'expirado', updated_at = now()
  WHERE cliente_id = p_cliente_id 
    AND modulo = p_modulo 
    AND registro_id = p_registro_id 
    AND status = 'aguardando_resposta';

  INSERT INTO public.whatsapp_pendencias_ativas(
    cliente_id, telefone, modulo, registro_id, tipo_esperado, mensagem_contexto
  ) VALUES (
    p_cliente_id, p_telefone, p_modulo, p_registro_id, p_tipo_esperado, p_mensagem_contexto
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_registrar_pendencia_whatsapp(uuid, text, text, text, text, text) TO anon, authenticated, service_role;

-- =============================================================================
-- 7. NOTIFY POSTGREST SCHEMA CACHE RELOAD
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
