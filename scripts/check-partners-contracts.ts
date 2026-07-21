import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchRoute } from '../src/routing/routeMatcher';
import { routes } from '../src/routing/routeCatalog';
import { adminModulePath, canAccessAdminModule, normalizeAdminModule } from '../src/routing/adminAccess';

const root = process.cwd();

async function read(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

async function contains(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function excludes(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: conteúdo indevido: ${pattern}`);
  }
}

async function main() {
  assert.equal(routes.public.partners(), '/parceiros');
  assert.equal(routes.public.partner('empresa-exemplo'), '/parceiros/empresa-exemplo');
  assert.equal(routes.admin.partners(), '/admin/parceiros');

  const listRoute = matchRoute('/parceiros', '', '');
  assert.equal(listRoute.area, 'public');
  assert.equal(listRoute.module, 'partners');
  assert.equal(listRoute.itemId, undefined);

  const detailRoute = matchRoute('/parceiros/empresa-exemplo', '', '');
  assert.equal(detailRoute.area, 'public');
  assert.equal(detailRoute.module, 'partners');
  assert.equal(detailRoute.itemId, 'empresa-exemplo');

  assert.equal(normalizeAdminModule('parceiros'), 'parceiros');
  assert.equal(adminModulePath('parceiros'), '/admin/parceiros');
  assert.equal(canAccessAdminModule('admin', [], 'parceiros'), true);
  assert.equal(canAccessAdminModule('colaborador', [], 'parceiros'), false);
  assert.equal(canAccessAdminModule('colaborador', ['parceiros'], 'parceiros'), true);

  await contains('src/components/public/GSAEnterpriseHomeFinal.tsx', [
    '<PartnersPage',
    "props.publicPage === 'partners'",
    'initialPartnerSlug',
    'onPartnerDetailChange',
  ]);

  await contains('src/components/public/final/PublicFooter.tsx', [
    "setPublicPage('partners')",
    '>Parceiros</button>',
  ]);

  await excludes('src/components/public/final/PublicHomeLanding.tsx', [
    "title: 'Parceiros'",
    "setPublicPage('partners')",
  ]);

  await contains('src/components/public/PartnersPage.tsx', [
    'listPublicPartners',
    'Conhecer parceiro',
    'Quero ser parceiro',
    'Informações de contato',
  ]);

  await contains('src/features/partners/service.ts', [
    ".eq('status', 'ativo')",
    "callAdminRpc<{ partners?: Partner[] }>('gsa_admin_partners_snapshot')",
    "callAdminRpc<{ partner: Partner }>('gsa_admin_save_partner'",
    "callAdminRpc('gsa_admin_set_partner_status'",
  ]);
  await excludes('src/features/partners/service.ts', [
    ".from('parceiros').insert",
    ".from('parceiros').update",
  ]);

  await contains('src/components/admin/PartnersAdminModule.tsx', [
    'Novo parceiro',
    'Parceiro em destaque',
    'Em análise',
    'Ativos',
    'Inativos',
    'Encerrados',
    'Excluídos',
  ]);

  await contains('supabase/migrations/20260721110000_create_public_partners.sql', [
    'CREATE TABLE IF NOT EXISTS public.parceiros',
    "USING (status = 'ativo')",
    'ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY',
    'parceiros_public_read_active',
    'gsa_admin_partners_snapshot',
    'gsa_admin_save_partner',
    'gsa_admin_set_partner_status',
    "gsa_admin_assert_module('parceiros')",
    'gsa_admin_write_audit(',
    'REVOKE ALL ON public.parceiros FROM anon, authenticated',
  ]);

  console.log('Contratos da página de parceiros validados com sucesso.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
