import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const failures: string[] = [];

function requireTokens(path: string, tokens: string[]) {
  const content = read(path);
  for (const token of tokens) {
    if (!content.includes(token)) failures.push(`${path}: contrato ausente: ${token}`);
  }
}

requireTokens('src/types/siteCampaigns.ts', [
  'export type SiteCampaignFormat',
  'export type SiteCampaignAction',
  "'popup'",
  "'top_bar'",
  "'inline_banner'",
  "'floating_card'",
  "'fullscreen'",
  'SiteCampaignAdminOverview',
  'current_permissions',
]);
requireTokens('src/lib/siteCampaigns.ts', [
  'gsa_public_site_campaigns',
  'gsa_public_site_campaign_event',
  'gsa_site_campaign_viewer_id',
  'gsa_site_campaign_session_id',
]);
requireTokens('src/components/campaigns/SiteCampaignLayer.tsx', [
  'export function SiteCampaignLayer',
  'Falha não bloqueante',
  'dismiss_on_backdrop',
  'dismiss_on_escape',
  'auto_close_seconds',
]);
requireTokens('src/components/campaigns/SiteCampaignBootstrap.tsx', [
  'export function SiteCampaignBootstrap',
  "'/admin'",
  'SiteCampaignLayer',
]);
requireTokens('src/components/admin/SiteCampaignAdminModule.tsx', [
  'Central de Avisos e Campanhas',
  'gsa_admin_site_campaigns_overview',
  'gsa_admin_upsert_site_campaign',
  'gsa_admin_set_site_campaign_status',
  'gsa_admin_duplicate_site_campaign',
  'Modelos visuais',
  'Resultados',
  'gsa-site-campaigns',
]);
requireTokens('src/components/admin/SiteCampaignPermissionMatrix.tsx', [
  'Permissões por ação',
  'gsa_admin_site_campaign_permission_overview',
  'gsa_admin_set_site_campaign_permissions',
  "['delete', 'Excluir']",
]);
requireTokens('src/components/admin/SiteCampaignDeletionPanel.tsx', [
  'gsa_admin_site_campaign_my_permissions',
  'gsa_admin_delete_site_campaign',
  'Exclusão controlada',
]);
requireTokens('src/main.tsx', [
  "import { SiteCampaignBootstrap } from './components/campaigns/SiteCampaignBootstrap';",
  '<SiteCampaignBootstrap />',
]);
requireTokens('src/pages/AdminPanel.tsx', [
  "import { SiteCampaignAdminPage } from '../components/admin/SiteCampaignAdminPage';",
  "id: 'avisos-campanhas'",
  "normalizedActive === 'avisos-campanhas'",
]);
requireTokens('src/routing/adminAccess.ts', [
  "| 'avisos-campanhas'",
  "return 'avisos-campanhas'",
  "case 'avisos-campanhas'",
]);
requireTokens('src/security/collaboratorAccess.ts', [
  "'avisos-campanhas'",
]);

requireTokens('supabase/migrations/20260724223000_site_campaigns_schema.sql', [
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaigns',
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_events',
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_history',
  'ENABLE ROW LEVEL SECURITY',
  'AUTO_ACTIVATED',
  'AUTO_ENDED',
]);
requireTokens('supabase/migrations/20260724223100_site_campaigns_public_api.sql', [
  'CREATE OR REPLACE FUNCTION public.gsa_public_site_campaigns',
  'CREATE OR REPLACE FUNCTION public.gsa_public_site_campaign_event',
  'pg_advisory_xact_lock',
  'sha256',
  "event_type = 'impression'",
]);
requireTokens('supabase/migrations/20260724223200_site_campaigns_admin_api.sql', [
  'CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaigns_overview',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_site_campaign',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_set_site_campaign_status',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_duplicate_site_campaign',
  "public.gsa_admin_assert_module('avisos-campanhas')",
  "'analytics', jsonb_build_object",
]);
requireTokens('supabase/migrations/20260724223300_site_campaigns_security.sql', [
  'gsa-site-campaigns',
  "public.gsa_admin_has_module('avisos-campanhas')",
  'gsa_site_campaign_cleanup_events',
]);
requireTokens('supabase/migrations/20260724223400_site_campaigns_delete_api.sql', [
  'gsa_admin_delete_site_campaign',
  "'DELETED'",
  "status NOT IN ('draft', 'archived')",
]);
requireTokens('supabase/migrations/20260724223500_site_campaigns_action_permissions.sql', [
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_permissions',
  'gsa_site_campaign_assert_action',
  'gsa_admin_site_campaign_permission_overview',
  'gsa_admin_set_site_campaign_permissions',
  "'publish','pause','resume','end','archive','delete'",
]);
requireTokens('supabase/migrations/20260724223600_site_campaigns_permission_visibility.sql', [
  'current_permissions',
  'gsa_admin_site_campaign_my_permissions',
  "NOT ('metrics' = ANY",
]);

const migrations = [
  'supabase/migrations/20260724223000_site_campaigns_schema.sql',
  'supabase/migrations/20260724223100_site_campaigns_public_api.sql',
  'supabase/migrations/20260724223200_site_campaigns_admin_api.sql',
  'supabase/migrations/20260724223300_site_campaigns_security.sql',
  'supabase/migrations/20260724223400_site_campaigns_delete_api.sql',
  'supabase/migrations/20260724223500_site_campaigns_action_permissions.sql',
  'supabase/migrations/20260724223600_site_campaigns_permission_visibility.sql',
].map(read).join('\n').toLowerCase();

for (const unsafe of ["'javascript:", "'data:text/html"]) {
  if (migrations.includes(unsafe)) failures.push(`Migration contém protocolo inseguro: ${unsafe}`);
}

if (failures.length) {
  console.error('\nFalhas nos contratos da Central de Avisos e Campanhas:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Contratos da Central de Avisos e Campanhas validados com sucesso.');
