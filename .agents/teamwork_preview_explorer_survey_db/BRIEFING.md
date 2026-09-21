# BRIEFING — 2026-08-26T16:25:50Z

## Mission
Investigate and audit PostgreSQL migrations, schema definitions, tables (parceiros, parceiros_resgates), columns, and RPC functions (gsa_public_resgatar_beneficio_parceiro, gsa_admin_save_partner, gsa_admin_list_partner_redemptions, gsa_admin_partners_snapshot).

## 🔒 My Identity
- Archetype: explorer
- Roles: [Database & Schema Explorer]
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_db
- Original parent: 00874a63-bf47-471e-ab92-125b6b6c0c31
- Milestone: Database & Schema Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code (except writing reports in own folder)
- Audit schema, migrations, columns, types, defaults, RPCs, permissions, and PostgREST schema cache reload

## Current Parent
- Conversation ID: 00874a63-bf47-471e-ab92-125b6b6c0c31
- Updated: 2026-08-26T16:25:50Z

## Investigation State
- **Explored paths**:
  - `supabase/migrations/20260721110000_create_public_partners.sql`
  - `supabase/migrations/20260721120000_partner_benefit_redemption.sql`
  - `supabase/migrations/20260722001000_partner_public_applications.sql`
  - `supabase/migrations/20260826150000_partner_redemption_email_and_sla.sql`
  - `supabase/migrations/20260826153000_partner_delay_24h_toggle.sql`
  - `supabase/migrations/20260826160000_admin_list_partner_redemptions_rpc.sql`
  - `supabase/migrations/20260826161500_partner_redemption_protocol.sql`
  - `supabase/migrations/20260826162500_fix_gsa_admin_save_partner_redemption_fields.sql`
  - `src/features/partners/service.ts`, `src/features/partners/types.ts`
  - Live Supabase instance `ocgajvagxagutfvgxwsy` via Supabase MCP (`information_schema.columns`, `pg_proc`, `pg_policies`, `information_schema.routine_privileges`, `supabase_migrations.schema_migrations`)
- **Key findings**:
  - Table `parceiros`: Complete schema with 47 columns defined across migrations, including all redemption rules (`redemption_delay_24h`, `redemption_has_coupon`, `redemption_coupon_code`, `redemption_has_voucher`, `redemption_has_link`, `redemption_link`, `redemption_auto_redirect`, `redemption_instructions`).
  - Table `parceiros_resgates`: Schema with 14 columns (`id`, `parceiro_id`, `cliente_id`, `nome_completo`, `telefone`, `email`, `codigo_gerado`, `tipo_resgate`, `link_destino`, `auto_redirecionado`, `status`, `link_ativacao`, `data_ativacao`, `created_at`).
  - RPC `gsa_public_resgatar_beneficio_parceiro`: 6 parameters (`p_parceiro_id`, `p_parceiro_slug`, `p_nome_completo`, `p_telefone`, `p_cliente_id`, `p_email`), generates official protocol `PROT-RES-YYYY-XXXXXX`, saves lead with initial status, returns complete JSON payload.
  - RPC `gsa_admin_save_partner`: Accepts payload with all redemption configurations + `redemption_delay_24h`, writes audit logs, validates admin session and module.
  - RPC `gsa_admin_list_partner_redemptions`: Joins `parceiros_resgates`, `parceiros`, and `clientes` to return customer contact data, official protocol, activation link, and status.
  - RPC `gsa_admin_partners_snapshot`: Returns active/non-deleted partners with all redemption fields.
  - RPC `gsa_admin_complete_partner_redemption`: Updates activation link and sets status to 'concluido'.
  - Security & Permissions: Explicit REVOKE/GRANT security model, `SECURITY DEFINER` routines with `SET search_path = public, pg_temp`, RLS enabled on both tables.
  - PostgREST reload cache: `NOTIFY pgrst, 'reload schema';` and `REPLICA IDENTITY FULL` across migrations.
- **Unexplored areas**: None. Full database schema and RPC surface explored and audited.

## Key Decisions Made
- Fully cataloged all migration files, live database state, schema differences, and RPC signatures.

## Artifact Index
- handoff.md — Comprehensive database & schema audit report
