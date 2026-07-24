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
  "export type SiteCampaignFormat",
  "'popup'",
  "'top_bar'",
  "'inline_banner'",
  "'floating_card'",
  "'fullscreen'",
  'SiteCampaignAdminOverview',
]);
requireTokens('src/lib/siteCampaigns.ts', [
  "gsa_public_site_campaigns",
  "gsa_public_site_campaign_event",
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
requireTokens('src/components/admin/SiteCampaignAdminModule.tsx', [
  'Central de Avisos e Campanhas',
  "gsa_admin_site_campaigns_overview",
  "gsa_admin_upsert_site_campaign",
  "gsa_admin_set_site_campaign_status",
  "gsa_admin_duplicate_site_campaign",
  "Modelos visuais",
  "Resultados",
  "gsa-site-campaigns",
]);
requireTokens('supabase/migrations/20260724223000_create_site_campaigns_center.sql', [
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaigns',
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_events',
  'CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_history',
  'CREATE OR REPLACE FUNCTION public.gsa_public_site_campaigns',
  'CREATE OR REPLACE FUNCTION public.gsa_public_site_campaign_event',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaigns_overview',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_site_campaign',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_set_site_campaign_status',
  'CREATE OR REPLACE FUNCTION public.gsa_admin_duplicate_site_campaign',
  "public.gsa_admin_assert_module('avisos-campanhas')",
  'ENABLE ROW LEVEL SECURITY',
  'gsa-site-campaigns',
  'pg_advisory_xact_lock',
  'AUTO_ACTIVATED',
  'AUTO_ENDED',
  "'analytics', jsonb_build_object",
]);
requireTokens('src/App.tsx', [
  "import { SiteCampaignLayer } from './components/campaigns/SiteCampaignLayer';",
  '<SiteCampaignLayer',
]);
requireTokens('src/pages/AdminPanel.tsx', [
  "import { SiteCampaignAdminModule } from '../components/admin/SiteCampaignAdminModule';",
  "id: 'avisos-campanhas'",
  "normalizedActive === 'avisos-campanhas'",
]);
requireTokens('src/routing/adminAccess.ts', [
  "| 'avisos-campanhas'",
  "return 'avisos-campanhas'",
  "case 'avisos-campanhas'",
]);
requireTokens('src/components/admin/AcessosModule.tsx', [
  "['avisos-campanhas', 'Avisos e campanhas do site']",
]);

const migration = read('supabase/migrations/20260724223000_create_site_campaigns_center.sql');
for (const unsafe of ['javascript:', 'data:text/html']) {
  if (migration.toLowerCase().includes(`'${unsafe}`)) failures.push(`Migration contém protocolo inseguro: ${unsafe}`);
}

if (failures.length) {
  console.error('\nFalhas nos contratos da Central de Avisos e Campanhas:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Contratos da Central de Avisos e Campanhas validados com sucesso.');
