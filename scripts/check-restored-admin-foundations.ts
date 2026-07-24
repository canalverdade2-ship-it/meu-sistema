import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function includes(path: string, markers: string[]) {
  const content = await readFile(resolve(root, path), 'utf8');
  for (const marker of markers) {
    assert.ok(content.includes(marker), `${path}: contrato ausente: ${marker}`);
  }
}

await includes('supabase/migrations/20260721194500_prepare_missing_gsa_seguros_base.sql', [
  'ADD COLUMN IF NOT EXISTS idempotency_key uuid',
  'ADD COLUMN IF NOT EXISTS coberturas jsonb',
  'seguros_cotacoes_cliente_id_fkey',
  'seguros_propostas_parceiro_id_fkey',
]);

await includes('supabase/migrations/20260721194600_restore_admin_dashboard_foundation.sql', [
  'gsa_admin_get_pendency_counts_secure',
  'gsa_admin_dashboard_snapshot_pre_ticket_compat',
  "NOTIFY pgrst, 'reload schema'",
  "public.gsa_admin_has_module('emprestimos')",
  "public.gsa_admin_has_module('credito_loja')",
]);

await includes('supabase/migrations/20260721194700_harden_restored_gsa_seguros.sql', [
  'gsa_collaborator_module_',
  'public.gsa_admin_restrict_collaborator_to_module(%L)',
  'seguros_ofertas_publicas',
  'GRANT SELECT ON public.seguros_ofertas_publicas TO anon, authenticated',
]);

await includes('supabase/migrations/20260721194800_restore_admin_search_clients.sql', [
  'gsa_admin_search_clients',
  "public.gsa_admin_assert_module('viagens')",
  'LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)',
  'GRANT EXECUTE ON FUNCTION public.gsa_admin_search_clients(uuid, text, text, integer) TO authenticated, service_role',
]);

await includes('supabase/migrations/20260721194900_restore_admin_travel_rpcs.sql', [
  'gsa_admin_travel_list',
  'gsa_admin_travel_link_lead',
  'gsa_admin_travel_update_status',
  'gsa_admin_travel_create_proposal',
  'gsa_admin_travel_create_package',
  "IF to_regprocedure('public.gsa_admin_travel_create_package(uuid,text,jsonb)') IS NULL",
  'GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_create_package(uuid, text, jsonb) TO authenticated, service_role',
]);

await includes('supabase/migrations/20260724200000_protection_direct_quote_cleanup.sql', [
  'Somente o GSA Seguros deixa de funcionar como catálogo interno.',
  'GSA Saúde e GSA Viagens permanecem com seus catálogos atuais.',
  'gsa_client_seguros_criar_cotacao',
  'O cadastro de produtos e ofertas de seguros foi descontinuado.',
  'DROP VIEW IF EXISTS public.seguros_ofertas_publicas CASCADE',
  "WHEN 'saude_produtos'",
  'public.gsa_admin_resource_config(p_resource text)',
  "p_payload - ARRAY['request_id', 'consentimento']",
]);

await includes('scripts/verify-restored-admin-foundations.sql', [
  'RESTORED_ADMIN_FOUNDATIONS_VERIFIED',
  '20260718121000',
  '20260720183000',
  '20260721194800',
  '20260721194900',
  '20260724200000',
  'gsa_admin_get_pendency_counts_secure(uuid,text)',
  'gsa_admin_search_clients(uuid,text,text,integer)',
  'gsa_admin_travel_create_package(uuid,text,jsonb)',
  'Catálogo do GSA Saúde não foi preservado',
  'Estruturas obsoletas do catálogo de Seguros ainda existem',
]);

console.log('Fundações administrativas, Viagens e isolamento da cotação direta de Seguros validados.');
