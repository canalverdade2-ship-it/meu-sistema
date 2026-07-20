import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  adminModulePath,
  canAccessAdminModule,
  normalizeAdminModule,
  normalizeGrantedAdminModules,
} from '../src/routing/adminAccess';

const root = process.cwd();

async function read(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

async function assertFileContains(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function assertFileExcludes(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: padrão inseguro ainda presente: ${pattern}`);
  }
}

async function main() {
  assert.equal(normalizeAdminModule('tickets'), 'atendimento');
  assert.equal(normalizeAdminModule('cobranca'), 'cobranca');
  assert.equal(normalizeAdminModule('fiscal'), 'fiscal');
  assert.equal(normalizeAdminModule('clientes'), 'cadastro');
  assert.equal(normalizeAdminModule('vendas'), 'operacoes');

  assert.deepEqual(normalizeGrantedAdminModules(['clientes', 'vendas', 'tickets', 'viagens']), ['cadastro', 'operacoes', 'atendimento', 'viagens']);

  assert.equal(canAccessAdminModule('admin', [], 'financeiro'), true);
  assert.equal(canAccessAdminModule('colaborador', ['cadastro'], 'cadastro'), true);
  assert.equal(canAccessAdminModule('colaborador', ['cadastro'], 'financeiro'), false);
  assert.equal(canAccessAdminModule('colaborador', ['vendas'], 'viagens'), false);
  assert.equal(canAccessAdminModule('colaborador', ['loja'], 'classificados'), false);
  assert.equal(canAccessAdminModule('colaborador', ['financeiro'], 'cobranca'), false);
  assert.equal(canAccessAdminModule('colaborador', ['cobranca'], 'cobranca'), true);
  assert.equal(canAccessAdminModule('colaborador', ['fiscal'], 'fiscal'), true);
  assert.equal(canAccessAdminModule('colaborador', [], 'dashboard'), true);

  assert.equal(adminModulePath('dashboard'), '/admin/dashboard');
  assert.equal(adminModulePath('cadastro', 'clientes'), '/admin/cadastros/clientes');
  assert.equal(adminModulePath('viagens'), '/admin/viagens');
  assert.equal(adminModulePath('cobranca'), '/admin/cobranca');
  assert.equal(adminModulePath('fiscal'), '/admin/fiscal');
  assert.equal(adminModulePath('financeiro', 'faturas', 'abc'), '/admin/financeiro/faturas/abc');

  await assertFileContains('src/pages/AdminPanel.tsx', [
    'gsa_admin_get_context_secure',
    'canAccessAdminModule',
    'accessModuleForRoute',
    'Você não possui permissão para acessar este módulo.',
    "table: 'colaborador_modulos'",
  ]);
  await assertFileExcludes('src/pages/AdminPanel.tsx', [
    "select('nome, modulos, status')",
    "localStorage.getItem('colaboradorModulos')",
  ]);

  await assertFileContains('src/lib/sessionService.ts', [
    'gsa_admin_get_context_secure',
    'clearLegacyAdminIdentity',
    "localStorage.removeItem('colaboradorModulos')",
  ]);

  await assertFileContains('src/lib/supabase.ts', [
    "const LEGACY_LOAN_BUCKET = 'emprestimos'",
    'uploadLegacyLoanContract',
    'PRIVATE_ADMIN_PREFIX',
    "functionName === 'gsa_admin_emprestimo_enviar_contrato'",
    'legacyLoanReferences',
  ]);

  await assertFileContains('src/lib/privateStorage.ts', [
    'resolveDocumentOwnerId',
    ".from('ordens_fiscais')",
    ".from('emprestimos')",
    'createSignedUrl',
  ]);

  await assertFileContains('src/components/admin/AcessosModule.tsx', [
    'gsa_admin_access_snapshot',
    'gsa_admin_save_collaborator',
    'gsa_admin_set_collaborator_status',
    'gsa_admin_rotate_collaborator_credential',
    'gsa_admin_review_deletion_request',
  ]);
  await assertFileExcludes('src/components/admin/AcessosModule.tsx', [
    "from('colaborador_modulos')",
    'credencial_acesso',
  ]);

  await assertFileContains('src/components/admin/ClassifiedsModule.tsx', [
    'gsa_admin_list_resource',
    'gsa_admin_classified_action',
    'PAGE_SIZE',
  ]);
  await assertFileExcludes('src/components/admin/ClassifiedsModule.tsx', [
    "from('classificados_anuncios')",
    'rpc_moderar_mensagem_classificado',
  ]);

  await assertFileContains('src/components/admin/ProtectionAdminModule.tsx', [
    'gsa_admin_list_resource',
    'gsa_admin_save_protection_entity',
    'gsa_admin_create_protection_proposal',
    'gsa_admin_update_resource_status',
  ]);
  await assertFileExcludes('src/components/admin/ProtectionAdminModule.tsx', [
    'supabase.from',
  ]);

  await assertFileContains('src/components/admin/FiscalModule.tsx', [
    "scope: 'fiscal'",
    'gsa_admin_fiscal_update',
    'SecureAttachmentButton',
    'removePrivateDocument',
  ]);
  await assertFileExcludes('src/components/admin/FiscalModule.tsx', [
    'getPublicUrl',
    'document.write',
    ".delete()",
  ]);

  await assertFileContains('src/components/admin/SystemMonitorModule.tsx', [
    'gsa_admin_system_snapshot',
    'Visão somente leitura',
  ]);
  await assertFileExcludes('src/components/admin/SystemMonitorModule.tsx', [
    'from(tableName)',
    'storage.from',
    'check_file_references',
  ]);

  await assertFileContains('src/components/admin/ConfiguracoesModule.tsx', [
    'gsa_admin_settings_snapshot',
    'gsa_admin_update_settings_secure',
    'gsa_admin_save_company',
    'gsa_admin_save_payment_method',
  ]);
  await assertFileExcludes('src/components/admin/ConfiguracoesModule.tsx', [
    'admin_access_code',
    'gsa_admin_upsert_settings',
    'supabase.from',
  ]);

  await assertFileContains('src/components/admin/RelatoriosModule.tsx', [
    'normalizeGrantedAdminModules',
    "requiredModules: ['cobranca']",
    "requiredModules: ['fiscal']",
    "requiredModules: ['emprestimos']",
  ]);

  await assertFileContains('src/hooks/useAdminNotifications.tsx', [
    'gsa_admin_get_pendency_counts_secure',
    'gsa_admin_list_notifications',
    'gsa_admin_set_notification_state',
    'gsa_admin_mark_all_notifications',
  ]);

  await assertFileContains('src/components/admin/Dashboard.tsx', [
    'gsa_admin_dashboard_snapshot',
    'Faturamento dos últimos 6 meses',
    'credito_pendente_total',
    '60_000',
  ]);

  await assertFileContains('src/components/admin/TravelAdminModule.tsx', [
    'gsa_admin_travel_list',
    'gsa_admin_travel_create_proposal',
    'gsa_admin_travel_create_package',
    'gsa_admin_search_clients',
    'PAGE_SIZE',
  ]);

  await assertFileContains('supabase/migrations/20260720234500_admin_identity_permissions_hardening.sql', [
    "'suspenso'",
    'gsa_admin_validate_context',
    'colaborador_modulos',
    'gsa_admin_notification_visible',
    '10000',
  ]);
  await assertFileContains('supabase/migrations/20260720235500_admin_secure_operations.sql', [
    'gsa_admin_save_collaborator',
    'gsa_admin_review_deletion_request',
    'gsa_admin_create_protection_proposal',
    'gsa_admin_system_snapshot',
    'FOR UPDATE',
  ]);
  await assertFileContains('supabase/migrations/20260721000500_admin_module_rls_boundaries.sql', [
    'AS RESTRICTIVE',
    'gsa_admin_restrict_collaborator_to_module',
    'gsa_enforce_admin_log_identity',
  ]);
  await assertFileContains('supabase/migrations/20260721001500_private_admin_documents.sql', [
    "'gsa-private-documents'",
    'gsa_admin_private_document_allowed',
    'gsa_private_document_read_allowed',
    "public = false",
  ]);
  await assertFileContains('supabase/migrations/20260721002500_secure_admin_settings.sql', [
    'gsa_admin_allowed_setting_keys',
    'gsa_admin_settings_snapshot',
    'gsa_admin_update_settings_secure',
  ]);
  await assertFileContains('supabase/migrations/20260721003000_hash_collaborator_credentials.sql', [
    'gsa_login_colaborador_legacy',
    'crypt(v_code, c.credencial_hash)',
    'GRANT EXECUTE ON FUNCTION public.gsa_login_colaborador(text) TO service_role',
    'initial_credential',
  ]);

  console.log('Painel administrativo: contratos completos de segurança e operação validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
