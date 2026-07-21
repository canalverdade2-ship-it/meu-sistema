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

  await contains('src/components/public/GSAEnterpriseHome.tsx', [
    "setPublicPage('partners')",
    '>Parceiros</button>',
    '<PartnersPage',
  ]);
  await excludes('src/components/public/GSAEnterpriseHome.tsx', [
    "title: 'Parceiros'",
  ]);

  await contains('src/components/public/PartnersPage.tsx', [
    'listPublicPartners',
    "status', 'ativo'",
    'Conhecer parceiro',
    'Quero ser parceiro',
  ]).catch(async () => {
    const service = await read('src/features/partners/service.ts');
    assert.ok(service.includes(".eq('status', 'ativo')"));
    const page = await read('src/components/public/PartnersPage.tsx');
    assert.ok(page.includes('Conhecer parceiro'));
    assert.ok(page.includes('Quero ser parceiro'));
  });

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
    'create table if not exists public.parceiros',
    "status = 'ativo'",
    'alter table public.parceiros enable row level security',
    'parceiros_public_read_active',
    'parceiros_admin_insert',
    'parceiros_admin_update',
  ]);

  console.log('Contratos da página de parceiros validados com sucesso.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
