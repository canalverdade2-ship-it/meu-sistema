import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  adminModulePath,
  canAccessAdminModule,
  normalizeAdminModule,
} from '../src/routing/adminAccess';

const root = process.cwd();

async function assertFileContains(path: string, patterns: string[]) {
  const content = await readFile(resolve(root, path), 'utf8');
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function main() {
  assert.equal(normalizeAdminModule('tickets'), 'atendimento');
  assert.equal(normalizeAdminModule('cobranca'), 'cobranca');
  assert.equal(normalizeAdminModule('fiscal'), 'fiscal');
  assert.equal(normalizeAdminModule('clientes'), 'cadastro');
  assert.equal(normalizeAdminModule('prestadores'), 'prestadores');

  assert.equal(canAccessAdminModule('admin', [], 'financeiro'), true);
  assert.equal(canAccessAdminModule('colaborador', [], 'dashboard'), true);
  assert.equal(canAccessAdminModule('colaborador', [], 'demandas'), false);
  assert.equal(canAccessAdminModule('colaborador', ['demandas'], 'demandas'), true);
  assert.equal(canAccessAdminModule('colaborador', ['demandas'], 'operacoes'), false);
  assert.equal(canAccessAdminModule('colaborador', ['vendas'], 'operacoes'), true);
  assert.equal(canAccessAdminModule('colaborador', ['vendas'], 'demandas'), false);
  assert.equal(canAccessAdminModule('colaborador', ['financeiro'], 'financeiro'), true);
  assert.equal(canAccessAdminModule('colaborador', ['financeiro'], 'cobranca'), false);
  assert.equal(canAccessAdminModule('colaborador', ['cobranca'], 'cobranca'), true);
  assert.equal(canAccessAdminModule('colaborador', ['cobranca'], 'financeiro'), false);
  assert.equal(canAccessAdminModule('colaborador', ['prestadores'], 'prestadores'), true);
  assert.equal(canAccessAdminModule('colaborador', ['prestadores'], 'cadastro', 'clientes'), false);
  assert.equal(canAccessAdminModule('colaborador', ['prestadores'], 'cadastro', 'prestadores'), true);
  assert.equal(canAccessAdminModule('colaborador', ['vendas'], 'viagens'), true);

  assert.equal(adminModulePath('dashboard'), '/admin/dashboard');
  assert.equal(adminModulePath('cadastro', 'clientes'), '/admin/cadastros/clientes');
  assert.equal(adminModulePath('prestadores'), '/admin/cadastros/prestadores');
  assert.equal(adminModulePath('demandas'), '/admin/demandas');
  assert.equal(adminModulePath('cobranca'), '/admin/cobranca');
  assert.equal(adminModulePath('fiscal'), '/admin/fiscal');
  assert.equal(adminModulePath('viagens'), '/admin/viagens');
  assert.equal(adminModulePath('financeiro', 'faturas', 'abc'), '/admin/financeiro/faturas/abc');

  await assertFileContains('package.json', [
    '"validate:subscriptions"',
    '"test:travel"',
    '"test:admin"',
    '"test:client-security"',
  ]);

  await assertFileContains('src/App.tsx', [
    'SecureAdminPanel',
    'defaultAdminPath',
    "localStorage.setItem('colaboradorModulos'",
    'isRouteAllowed(route.area, session, route.module, route.submodule)',
  ]);

  await assertFileContains('src/pages/SecureAdminPanel.tsx', [
    'hasAdminModuleAccess',
    "select('id, nome, status, colaborador_modulos(modulo_id)')",
    "data.status !== 'ativo'",
    "table: 'colaborador_modulos'",
  ]);

  await assertFileContains('src/pages/AdminPanel.tsx', [
    'CollaboratorDashboard',
    'hasAdminModuleAccess',
    "id: 'demandas'",
    "id: 'cobranca'",
    "id: 'fiscal'",
    'Você não possui permissão para acessar este módulo.',
  ]);

  await assertFileContains('src/hooks/useAdminNotifications.tsx', [
    'gsa_admin_get_pendency_counts_secure',
    'gsa_admin_list_notifications',
    'gsa_admin_set_notification_state',
    'gsa_admin_mark_all_notifications',
  ]);

  await assertFileContains('src/components/admin/CollaboratorDashboard.tsx', [
    'normalizeCollaboratorModules',
    "has('financeiro')",
    "has('demandas')",
    "eq('colaborador_id', colaboradorId)",
  ]);

  await assertFileContains('src/components/admin/Dashboard.tsx', [
    "import type React from 'react';",
    'key?: React.Key;',
    'gsa_admin_dashboard_snapshot',
    'Faturamento dos últimos 6 meses',
    'credito_pendente_total',
    '60_000',
  ]);

  await assertFileContains('src/components/admin/TravelAdminModule.tsx', [
    "import type React from 'react';",
    'gsa_admin_travel_list',
    'gsa_admin_travel_create_proposal',
    'gsa_admin_travel_create_package',
    'gsa_admin_search_clients',
    'PAGE_SIZE',
  ]);

  await assertFileContains('supabase/migrations/20260720183000_harden_admin_panel.sql', [
    'gsa_admin_context',
    'gsa_admin_has_module',
    'gsa_admin_notification_state',
    'gsa_admin_dashboard_snapshot',
    'gsa_admin_travel_create_proposal',
    'FOR UPDATE',
    'gsa_admin_audit_events',
  ]);

  await assertFileContains('supabase/migrations/20260720213000_secure_collaborator_panel.sql', [
    'gsa_admin_replace_collaborator_modules',
    "v_status <> 'ativo'",
    "WHEN 'demandas' THEN ARRAY['demandas']",
    "WHEN 'cobranca' THEN ARRAY['cobranca']",
    "WHEN 'fiscal' THEN ARRAY['fiscal']",
    'collaborator_assigned_demands_only',
    'gsa_close_collaborator_sessions',
  ]);

  console.log('Painel administrativo e painel do colaborador: contratos de segurança e operação validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
