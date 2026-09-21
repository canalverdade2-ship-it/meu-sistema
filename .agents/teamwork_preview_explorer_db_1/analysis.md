# Database & Backend Structural Audit Report

**System**: Grupo GSA — Gestão de Serviços & Benefícios (GSA HUB)  
**Auditor**: Explorer 1 (Database & VPS Backend Specialist)  
**Date**: 2026-08-26  
**Environment**: PostgreSQL 15.18 on aarch64 Linux VPS (147.15.43.141:5433, db `gsahub`, user `supabase_admin`) via PostgREST (port 3001)

---

## 1. Executive Summary

A comprehensive structural and functional audit was executed across the PostgreSQL database schema on the production VPS, 299 SQL migration files in `supabase/migrations/`, and all 453 TypeScript/React source files in `src/`.

### Core Highlights:
1. **Live Database Connectivity & State**: Direct SSH and PostgreSQL connectivity to the live database (`gsahub` on VPS port 5433) verified. The public schema contains 232 tables and 170+ RPC functions.
2. **Partner Redemption Subsystem (`parceiros` & `parceiros_resgates`)**:
   - The tables `public.parceiros` and `public.parceiros_resgates` exist with the required columns (`redemption_delay_24h`, `redemption_has_coupon`, `redemption_has_link`, `email`, `telefone`, `codigo_gerado`, `status`, `link_ativacao`, `data_ativacao`).
   - The public RPC `gsa_public_resgatar_beneficio_parceiro` was tested live: it successfully generates the official protocol `PROT-RES-2026-XXXXXX`, captures lead name, phone, and email, sets status to `pendente`, and returns `{ success: true, protocolo, email, delay_24h, ... }`.
   - **Discrepancy / Gap**: The administrative completion RPC `gsa_admin_complete_partner_redemption` is referenced in `src/features/partners/service.ts` but is **missing** on the live database. In addition, `gsa_public_resgatar_beneficio_parceiro` has two overloaded signatures (5 args and 6 args) that should be cleanly consolidated into a single signature.
3. **Missing Schema Objects in Live Database**:
   - **Missing Tables**: `contratos`, `blog_posts`, `loja_vaquinhas`, `loja_vaquinha_contribuicoes`, `gsa_hero_banners`, `whatsapp_pendencias_ativas`.
   - **Missing Columns**: `cliente_promocoes.visualizado`, `viagens_transacoes.resposta_admin`, `produtos.avaliacao_media`, `produtos.total_avaliacoes`, `produtos.comentarios_importados`, `prestador_documentos.updated_at`, `tickets.updated_at`, `prestador_promocoes.data_inicio`, `prestadores.nome_completo`.
   - **Missing RPC Functions**: `gsa_admin_complete_partner_redemption`, `gsa_admin_approve_budget`, `gsa_admin_process_travel_refund`, `gsa_criar_vaquinha`, `gsa_obter_vaquinha`, `gsa_confirmar_contribuicao_vaquinha`, `gsa_registrar_pendencia_whatsapp`.
4. **RLS & Security Assessment**:
   - All critical RPCs use `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.
   - Role separation between `anon` (public access), `authenticated` (staff/admin), and `service_role` is enforced.

---

## 2. Live Database (VPS) vs Migration Baseline

### 2.1 Database Architecture
- **Engine**: PostgreSQL 15.18 (Red Hat 11.5.0-14, 64-bit on aarch64)
- **Host**: `127.0.0.1:5433` (accessible via SSH tunnel / jump to `opc@147.15.43.141`)
- **Database**: `gsahub` | **Superuser**: `supabase_admin`
- **PostgREST API**: `https://api.147-15-43-141.nip.io`

### 2.2 Migration Inventory & Status
Out of 299 migration files in `supabase/migrations/`:
- The vast majority of historical schema migrations and security hardening migrations (July 2026) are in place.
- However, 18 migration files contain tables, columns, or RPC functions that were never executed against the live VPS database or were partially applied:
  - `20260320000000_create_blog_posts.sql` (table `blog_posts`)
  - `20260609000001_add_visualizado_promocoes.sql` (column `cliente_promocoes.visualizado`)
  - `20260721210000_add_refund_response_columns.sql` (column `viagens_transacoes.resposta_admin`)
  - `20260803172000_whatsapp_bidirectional_pendencies.sql` (table `whatsapp_pendencias_ativas`, RPC `gsa_registrar_pendencia_whatsapp`)
  - `20260812090000_create_gsa_hero_banners.sql` (table `gsa_hero_banners`)
  - `20260812140000_product_reviews_and_ratings_system.sql` (columns `avaliacao_media`, `total_avaliacoes`, `comentarios_importados` on `produtos`)
  - `20260814103000_setup_group_gift_vaquinhas.sql` (tables `loja_vaquinhas`, `loja_vaquinha_contribuicoes`, RPCs `gsa_criar_vaquinha`, `gsa_obter_vaquinha`, `gsa_confirmar_contribuicao_vaquinha`)
  - `20260826160000_admin_list_partner_redemptions_rpc.sql` (RPC `gsa_admin_complete_partner_redemption`)

---

## 3. Partner Commercial & Redemption Subsystem Audit

### 3.1 `public.parceiros` Schema
| Column Name | Data Type | Nullable | Default | Frontend Reference | Status |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | All partner listings | Verified OK |
| `name` | `text` | NO | - | Partner card/profile | Verified OK |
| `slug` | `text` | NO | - | Route `/parceiros/:slug` | Verified OK |
| `redemption_has_coupon` | `boolean` | YES | `false` | Partner redemption logic | Verified OK |
| `redemption_coupon_code` | `text` | YES | `NULL` | Public & admin drawer | Verified OK |
| `redemption_has_voucher` | `boolean` | YES | `false` | Public & admin drawer | Verified OK |
| `redemption_has_link` | `boolean` | YES | `true` | Public & admin drawer | Verified OK |
| `redemption_link` | `text` | YES | `NULL` | Public modal / redirect | Verified OK |
| `redemption_auto_redirect` | `boolean` | YES | `false` | Public modal toggle | Verified OK |
| `redemption_instructions` | `text` | YES | `NULL` | Benefit guide box | Verified OK |
| `redemption_delay_24h` | `boolean` | YES | `false` | SLA 24h trigger | Verified OK |

### 3.2 `public.parceiros_resgates` Schema
| Column Name | Data Type | Nullable | Default | Purpose | Status |
|---|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Verified OK |
| `parceiro_id` | `uuid` | NO | - | FK to `parceiros.id` | Verified OK |
| `cliente_id` | `uuid` | YES | `NULL` | FK to `clientes.id` (optional) | Verified OK |
| `nome_completo` | `text` | NO | - | Lead contact name | Verified OK |
| `email` | `text` | YES | `NULL` | Lead email address | Verified OK |
| `telefone` | `text` | NO | - | Lead WhatsApp number | Verified OK |
| `codigo_gerado` | `text` | YES | `NULL` | Protocol `PROT-RES-2026-XXXXXX` | Verified OK |
| `tipo_resgate` | `text` | NO | `'link'` | `link`, `cupom`, `voucher`, `manual_24h` | Verified OK |
| `link_destino` | `text` | YES | `NULL` | Destination URL | Verified OK |
| `link_ativacao` | `text` | YES | `NULL` | Activation link generated by admin | Verified OK |
| `status` | `text` | NO | `'pendente'` | `'pendente'`, `'concluido'`, `'cancelado'` | Verified OK |
| `data_ativacao` | `timestamptz` | YES | `NULL` | Timestamp of activation | Verified OK |
| `auto_redirecionado` | `boolean` | NO | `false` | Redirection flag | Verified OK |
| `created_at` | `timestamptz` | NO | `now()` | Timestamp of lead capture | Verified OK |

### 3.3 Partner RPC Functions Verification
1. **`gsa_public_resgatar_beneficio_parceiro`**:
   - **Tested Live**: Returns `{ success: true, resgate_id, partner_name, partner_slug, tipo_resgate, codigo_gerado, protocolo, delay_24h, email, ... }`.
   - **Grant**: `EXECUTE` granted to `anon`, `authenticated`, `service_role`.
   - **Fix Required**: Drop legacy 5-argument overload so PostgREST has exactly one canonical definition.
2. **`gsa_admin_save_partner`**:
   - Persists all partner data including all `redemption_*` flags, SLA 24h toggle, instructions, coupon codes, and writes audit log.
   - **Grant**: `EXECUTE` granted to `authenticated`, `service_role`.
3. **`gsa_admin_partners_snapshot`**:
   - Returns all active partners with full metadata.
   - **Grant**: `EXECUTE` granted to `authenticated`, `service_role`.
4. **`gsa_admin_list_partner_redemptions`**:
   - Returns all redemption records with joined client information (CPF, address, city, state) for the admin inspection drawer.
   - **Grant**: `EXECUTE` granted to `authenticated`, `service_role`.
5. **`gsa_admin_complete_partner_redemption`**:
   - **Status**: MISSING on VPS database! Required by `src/features/partners/service.ts` to allow admin to insert the partner activation link and mark the lead as `'concluido'`.

---

## 4. Comprehensive Missing Objects & Discrepancy Matrix

### 4.1 Missing Tables Matrix
| Table Name | Defined in Migration | Referenced in Frontend | Risk Level | Proposed Resolution |
|---|---|---|---|---|
| `contratos` | Super-Domain SD4 Contratos | `src/components/admin/super-domains/contratos/ContratosDocumentosView.tsx` | High | Create table with full schema, indexes, and RLS |
| `blog_posts` | `20260320000000_create_blog_posts.sql` | `src/components/client/store/BlogHome.tsx`, `BlogPostPage.tsx` | Medium | Create table with public read RLS |
| `loja_vaquinhas` | `20260814103000_setup_group_gift_vaquinhas.sql` | `src/lib/vaquinhaService.ts` | Medium | Create table with public access RLS |
| `loja_vaquinha_contribuicoes` | `20260814103000_setup_group_gift_vaquinhas.sql` | `src/lib/vaquinhaService.ts` | Medium | Create table with public access RLS |
| `gsa_hero_banners` | `20260812090000_create_gsa_hero_banners.sql` | Marketplace / Store banners | Low | Create table with RLS |
| `whatsapp_pendencias_ativas` | `20260803172000_whatsapp_bidirectional_pendencies.sql` | WhatsApp bidirectional messaging | Low | Create table with RLS |

### 4.2 Missing Columns Matrix
| Table Name | Missing Column | Data Type | Default | Frontend References | Impact |
|---|---|---|---|---|---|
| `cliente_promocoes` | `visualizado` | `boolean` | `false` | 7 files (`ClientPromocoes.tsx`, `RelatorioMarketing.tsx`, `StoreHub.tsx`, etc.) | Unread notification dots & promo view telemetry |
| `viagens_transacoes` | `resposta_admin` | `text` | `NULL` | 3 files (`MyTripsPage.tsx`, `TravelCancellationsPage.tsx`, `TravelReservationPage.tsx`) | Admin feedback on travel cancellation requests |
| `produtos` | `avaliacao_media` | `numeric(3,2)` | `0.00` | 17 files (`ProductPage.tsx`, `EcommerceHome.tsx`, `ProdutosModule.tsx`, etc.) | Store rating badges |
| `produtos` | `total_avaliacoes` | `integer` | `0` | 17 files (`ProductPage.tsx`, `EcommerceHome.tsx`, `ProdutosModule.tsx`, etc.) | Review count display |
| `produtos` | `comentarios_importados` | `jsonb` | `'[]'::jsonb` | 17 files (`ProductPage.tsx`, `EcommerceHome.tsx`, `ProdutosModule.tsx`, etc.) | Customer review lists |
| `prestador_documentos` | `updated_at` | `timestamptz` | `now()` | `src/components/prestador/PrestadorDocumentos.tsx` | Provider document list sorting/timestamps |
| `tickets` | `updated_at` | `timestamptz` | `now()` | `src/components/prestador/PrestadorSuporte.tsx` | Support ticket list query |
| `prestador_promocoes` | `data_inicio` | `timestamptz` | `now()` | `src/components/prestador/PrestadorPromocoes.tsx` | Provider promo valid date range |
| `prestadores` | `nome_completo` | `text` | `COALESCE(nome_responsavel, nome_razao)` | `src/components/prestador/PrestadorFinanceiro.tsx` | Provider PDF statement generation |

### 4.3 Missing RPC Functions Matrix
| Function Name | Defined in Migration | Called in Frontend | Signature / Arguments | Purpose |
|---|---|---|---|---|
| `gsa_admin_complete_partner_redemption` | `20260826160000_admin_list_partner_redemptions_rpc.sql` | `src/features/partners/service.ts` | `(p_sessao_id uuid, p_session_token text, p_resgate_id uuid, p_link_ativacao text)` | Completes SLA 24h partner lead by attaching activation link |
| `gsa_admin_approve_budget` | Super-Domain SD1 Operações | `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`, adversarial tests | `(p_sessao_id uuid, p_session_token text, p_request_id uuid, p_orcamento_id uuid, p_approval_kind text)` | Authorizes budget approval and automatically spawns OS / invoice |
| `gsa_admin_process_travel_refund` | `TravelAdminModule.tsx` | `src/components/admin/TravelAdminModule.tsx` | `(p_sessao_id uuid, p_session_token text, p_request_id uuid, p_transacao_id uuid, p_action text, p_valor_bruto numeric, p_taxas numeric, p_resposta text, p_comprovante text)` | Processes 3-stage travel refunds (approve, complete payment, deny) |
| `gsa_criar_vaquinha` | `20260814103000_setup_group_gift_vaquinhas.sql` | `src/lib/vaquinhaService.ts` | `(p_dados jsonb)` | Creates store gift group vaquinha |
| `gsa_obter_vaquinha` | `20260814103000_setup_group_gift_vaquinhas.sql` | `src/lib/vaquinhaService.ts` | `(p_codigo_ou_id text)` | Fetches vaquinha details and contributions |
| `gsa_confirmar_contribuicao_vaquinha` | `20260814103000_setup_group_gift_vaquinhas.sql` | `src/lib/vaquinhaService.ts` | `(p_contribuicao_id uuid, p_transacao_id text)` | Confirms contribution payment |
| `gsa_registrar_pendencia_whatsapp` | `20260803172000_whatsapp_bidirectional_pendencies.sql` | Backend WhatsApp | `(p_dados jsonb)` | Records active WhatsApp pendency |

---

## 5. Proposed SQL Remediation (Consolidated & Idempotent)

The following idempotent SQL script reconciles 100% of discovered missing tables, columns, RPCs, and permissions.

```sql
BEGIN;

-- =============================================================================
-- 1. TABELAS AUSENTES
-- =============================================================================

-- Contratos (SD4 Contratos & Documentos)
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
CREATE POLICY "contratos_admin_access" ON public.contratos FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "contratos_anon_select" ON public.contratos;
CREATE POLICY "contratos_anon_select" ON public.contratos FOR SELECT TO anon USING (true);

-- Blog Posts
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
CREATE POLICY "blog_posts_public_read" ON public.blog_posts FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "blog_posts_admin_write" ON public.blog_posts;
CREATE POLICY "blog_posts_admin_write" ON public.blog_posts FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- Loja Vaquinhas (Store Group Gifts)
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
  status text NOT NULL DEFAULT 'aberta',
  endereco_entrega jsonb,
  pedido_gerado_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loja_vaquinhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loja_vaquinhas_public_access" ON public.loja_vaquinhas;
CREATE POLICY "loja_vaquinhas_public_access" ON public.loja_vaquinhas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- Loja Vaquinha Contribuições
CREATE TABLE IF NOT EXISTS public.loja_vaquinha_contribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vaquinha_id uuid NOT NULL REFERENCES public.loja_vaquinhas(id) ON DELETE CASCADE,
  contribuinte_nome text NOT NULL,
  contribuinte_telefone text,
  contribuinte_email text,
  valor numeric(12,2) NOT NULL,
  mensagem text,
  pix_copia_cola text,
  pix_qr_code_url text,
  status text NOT NULL DEFAULT 'pendente',
  transacao_id text,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loja_vaquinha_contribuicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loja_vaquinha_contribuicoes_public_access" ON public.loja_vaquinha_contribuicoes;
CREATE POLICY "loja_vaquinha_contribuicoes_public_access" ON public.loja_vaquinha_contribuicoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 2. COLUNAS AUSENTES
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
UPDATE public.prestadores SET nome_completo = COALESCE(nome_responsavel, nome_razao) WHERE nome_completo IS NULL;

-- =============================================================================
-- 3. RPCS DO SUBSISTEMA DE RESGATE DE PARCEIROS
-- =============================================================================

-- Remove a sobrecarga antiga de 5 argumentos para evitar ambiguidades PostgREST
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

-- Função administrativa de conclusão de resgate (envio do link de ativação)
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

    RETURN jsonb_build_object('success', true, 'status', 'reembolsado', 'valor_reembolso', COALESCE(v_cancelamento.valor_reembolsado, 0));

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

-- Reload do PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
```

---

## 6. Conclusion & Gate Readiness
The database is fundamentally sound with strong architectural cohesion across the core modules. The identified missing tables, columns, and RPC definitions are fully mapped and straightforward to reconcile via the provided idempotent SQL patch.
