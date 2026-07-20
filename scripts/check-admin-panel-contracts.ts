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
  assert.equal(normalizeAdminModule('cobranca'), 'financeiro');
  assert.equal(normalizeAdminModule('clientes'), 'cadastro');

  assert.equal(canAccessAdminModule('admin', [], 'financeiro'), true);
  assert.equal(canAccessAdminModule('colaborador', ['cadastro'], 'cadastro'), true);
  assert.equal(canAccessAdminModule('colaborador', ['cadastro'], 'financeiro'), false);
  assert.equal(canAccessAdminModule('colaborador', ['vendas'], 'viagens'), true);
  assert.equal(canAccessAdminModule('colaborador', [], 'dashboard'), true);

  assert.equal(adminModulePath('dashboard'), '/admin/dashboard');
  assert.equal(adminModulePath('cadastro', 'clientes'), '/admin/cadastros/clientes');
  assert.equal(adminModulePath('viagens'), '/admin/viagens');
  assert.equal(adminModulePath('financeiro', 'faturas', 'abc'), '/admin/financeiro/faturas/abc');

  await assertFileContains('package.json', [
    '"validate:subscriptions"',
    '"test:travel"',
    '"test:admin"',
  ]);

  await assertFileContains('src/pages/AdminPanel.tsx', [
    "import type React from 'react';",
    'canAccessAdminModule',
    'adminModulePath',
    "select('nome, modulos, status')",
    'Você não possui permissão para acessar este módulo.',
  ]);

  await assertFileContains('src/hooks/useAdminNotifications.tsx', [
    'gsa_admin_get_pendency_counts_secure',
    'gsa_admin_list_notifications',
    'gsa_admin_set_notification_state',
    'gsa_admin_mark_all_notifications',
  ]);

  await assertFileContains('src/components/admin/Dashboard.tsx', [
    "import type React from 'react';",
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

  console.log('Painel administrativo: contratos de segurança e operação validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
