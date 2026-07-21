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
  "public.gsa_admin_restrict_collaborator_to_module(%L)",
  'seguros_ofertas_publicas',
  "GRANT SELECT ON public.seguros_ofertas_publicas TO anon, authenticated",
]);

await includes('supabase/migrations/20260721194800_restore_admin_search_clients.sql', [
  'gsa_admin_search_clients',
  "public.gsa_admin_assert_module('viagens')",
  'LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)',
  "GRANT EXECUTE ON FUNCTION public.gsa_admin_search_clients(uuid, text, text, integer) TO authenticated, service_role",
]);

await includes('scripts/verify-restored-admin-foundations.sql', [
  'RESTORED_ADMIN_FOUNDATIONS_VERIFIED',
  '20260718121000',
  '20260720183000',
  '20260721194800',
  'gsa_admin_get_pendency_counts_secure(uuid,text)',
  'gsa_admin_search_clients(uuid,text,text,integer)',
]);

console.log('Contratos das fundações administrativas restauradas validados.');
