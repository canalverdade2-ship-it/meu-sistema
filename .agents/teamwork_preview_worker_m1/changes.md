# Changes - Worker M1 (Database & Backend Remediation)

## 1. Migration File Created
- **File**: `supabase/migrations/20260826220000_production_remediation_consolidated.sql`
- **Contents**:
  1. **6 Tables Created & RLS Configured**:
     - `public.contratos`: Complete contract management table with RLS policies (`contratos_admin_access` for authenticated/service_role, `contratos_anon_select` for anon) and indexes on `cliente_id`, `status`, `codigo_contrato`.
     - `public.blog_posts`: Store blog publishing table with RLS policies (`blog_posts_public_read` for anon/authenticated/service_role, `blog_posts_admin_write` for authenticated/service_role).
     - `public.loja_vaquinhas`: Group gift vaquinhas table with public read/write RLS policies and indexes on `codigo`, `status`.
     - `public.loja_vaquinha_contribuicoes`: Contributions table linked via FK CASCADE to `loja_vaquinhas` with RLS and indexes.
     - `public.gsa_hero_banners`: Marketplace banner management table with validity date constraints, active status checks, and seed banners.
     - `public.whatsapp_pendencias_ativas`: Active WhatsApp bidirectional communication table with RLS and phone/client indexes.
  2. **9 Missing Columns Added Idempotently & Backfilled**:
     - `cliente_promocoes.visualizado` (boolean DEFAULT false)
     - `viagens_transacoes.resposta_admin` (text)
     - `produtos.avaliacao_media` (numeric(3,2) DEFAULT 0)
     - `produtos.total_avaliacoes` (integer DEFAULT 0)
     - `produtos.comentarios_importados` (jsonb DEFAULT '[]'::jsonb)
     - `prestador_documentos.updated_at` (timestamptz DEFAULT now())
     - `tickets.updated_at` (timestamptz DEFAULT now())
     - `prestador_promocoes.data_inicio` (timestamptz DEFAULT now())
     - `prestadores.nome_completo` (text, backfilled with `COALESCE(nome_responsavel, nome_razao)`)
  3. **RPC Functions Created/Consolidated with SECURITY DEFINER & Role Permissions**:
     - `gsa_public_resgatar_beneficio_parceiro`: Cleaned legacy 5-param overload. Defined canonical 6-parameter version (`p_parceiro_id`, `p_parceiro_slug`, `p_nome_completo`, `p_telefone`, `p_cliente_id`, `p_email`). Protocol generation `PROT-RES-YYYY-XXXXXX`. Granted EXECUTE to `anon`, `authenticated`, `service_role`.
     - `gsa_admin_complete_partner_redemption`: Full administrative workflow with context validation (`gsa_admin_validate_context`), module assertion (`gsa_admin_assert_module('parceiros')`), status transition to `'concluido'`, and activation link assignment. Granted EXECUTE to `authenticated`, `service_role`.
     - `gsa_admin_approve_budget`: Budget approval converting to OS with audit log dispatch. Granted EXECUTE to `authenticated`, `service_role`.
     - `gsa_admin_process_travel_refund`: 3-stage travel refund processor (`approve`, `complete`, `deny`) synchronizing `viagens_transacoes` and `viagens_cancelamentos`. Granted EXECUTE to `authenticated`, `service_role`.
     - `gsa_criar_vaquinha`, `gsa_obter_vaquinha`, `gsa_confirmar_contribuicao_vaquinha`: Stored procedures for store group gifts. Granted EXECUTE to `anon`, `authenticated`, `service_role`.
     - `gsa_registrar_pendencia_whatsapp`: Stored procedure for WhatsApp context tracking. Granted EXECUTE to `anon`, `authenticated`, `service_role`.
  4. **PostgREST Schema Cache Reload**:
     - Emits `NOTIFY pgrst, 'reload schema';`

## 2. Live Database Execution on VPS
- Executed migration directly on live VPS PostgreSQL (`opc@147.15.43.141`, port `5433`, db `gsahub`).
- Verified 100% of tables (6/6), columns (9/9), and RPC functions (8/8) exist and have proper security definitions and grants.
- Executed live programmatic verification of `gsa_public_resgatar_beneficio_parceiro` and admin completion flow.
