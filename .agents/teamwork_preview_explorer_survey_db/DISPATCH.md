# DISPATCH - Explorer Survey DB & RPCs

Objective: Investigate and audit the database schema, migrations, table definitions, and RPC functions for the Commercial Partners & Redemptions ecosystem.

Scope:
- Check PostgreSQL migrations in `supabase/migrations/` and SQL scripts for `parceiros` and `parceiros_resgates`.
- Verify all required columns on `parceiros`: `redemption_delay_24h`, `redemption_has_coupon`, `redemption_coupon_code`, `redemption_has_voucher`, `redemption_has_link`, `redemption_link`, `redemption_auto_redirect`, `redemption_instructions`.
- Verify all required columns on `parceiros_resgates`: `id`, `parceiro_id`, `cliente_id`, `nome_completo`, `telefone`, `email`, `codigo_gerado`, `tipo_resgate`, `link_destino`, `auto_redirecionado`, `status`, `link_ativacao`, `data_ativacao`, `created_at`.
- Verify RPC functions: `gsa_public_resgatar_beneficio_parceiro`, `gsa_admin_save_partner`, `gsa_admin_list_partner_redemptions`, `gsa_admin_partners_snapshot`.
- Check permissions, PostgREST schema cache reload, and RPC signatures.

Input Files:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
- `supabase/migrations/`
- SQL files in workspace

Output:
- Write comprehensive report to `.agents/teamwork_preview_explorer_survey_db/handoff.md`.
