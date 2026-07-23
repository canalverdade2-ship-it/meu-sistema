import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { routes } from '../src/routing/routeCatalog';
import { matchRoute } from '../src/routing/routeMatcher';
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
  return content;
}

async function excludes(path: string, patterns: string[]) {
  const content = await read(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: conteudo indevido: ${pattern}`);
  }
}

async function main() {
  assert.equal(routes.login.supplier(), '/fornecedor/login');
  assert.equal(routes.supplier.dashboard(), '/fornecedor/dashboard');
  assert.equal(routes.admin.suppliers(), '/admin/fornecedores');
  assert.equal(matchRoute('/fornecedor/pedidos', '', '').area, 'supplier');
  assert.equal(matchRoute('/fornecedor/pedidos', '', '').module, 'pedidos');
  assert.equal(matchRoute('/fornecedor/pedidos/123', '', '').itemId, '123');
  assert.equal(matchRoute('/fornecedor', '', '').module, 'home');
  assert.equal(matchRoute('/fornecedor/login', '', '').module, 'login');
  assert.equal(normalizeAdminModule('fornecedores'), 'fornecedores');
  assert.equal(adminModulePath('fornecedores'), '/admin/fornecedores');
  assert.equal(canAccessAdminModule('admin', [], 'fornecedores'), true);
  assert.equal(canAccessAdminModule('colaborador', ['fornecedores'], 'fornecedores'), true);

  await contains('src/App.tsx', [
    "import('./pages/Fornecedor/FornecedorDashboard')",
    "restored.atorTipo === 'fornecedor'",
    'fornecedorId',
    'handleLoginFornecedor',
    "import('./pages/Fornecedor/FornecedorAccessPage')",
  ]);
  await contains('src/pages/Fornecedor/FornecedorAccessPage.tsx', [
    'Portal exclusivo para fornecedores',
    "loginWithPin(document.replace(/\\D/g, ''), pin, 'fornecedor')",
    'gsa_public_register_supplier',
    'Acesso independente',
  ]);
  await excludes('src/components/auth/RestrictedAccessModal.tsx', ["'fornecedor'", 'gsa_public_register_supplier']);
  await contains('src/components/public/LoginHub.tsx', ['onSupplierAccess', 'Portal do Fornecedor']);

  await contains('src/components/admin/FornecedoresModule.tsx', [
    'Novo pedido',
    "openProductReview(request, 'ajuste')",
    "openDeliveryReview(delivery, 'ajuste')",
    'Aprovar NF e liberar estoque',
    'Comprovante obrigatório',
    'uploadAdminSupplierPaymentProof',
    'notifySupplierPortal',
  ]);
  await excludes('src/components/admin/FornecedoresModule.tsx', ['window.prompt(', 'window.confirm(']);

  await contains('src/pages/Fornecedor/FornecedorDashboard.tsx', [
    'Corrigir e reenviar',
    'markSupplierNotificationRead',
    'markAllSupplierNotificationsRead',
    'updateSupplierProfile',
    'Perfil e dados de pagamento',
    "channel(`supplier-sync:${fornecedorId}`)",
    'requestId',
    'uploadSupplierInvoice(xml, fornecedorId, deliveryOrder.id, requestId)',
    "route.module === 'pedidos'",
  ]);

  await contains('src/lib/supplierOperations.ts', [
    'gsa_supplier_mark_notification_read',
    'gsa_supplier_update_profile',
    'gsa_supplier_mark_notifications_read',
    'gsa_supplier_update_profile',
    'comprovantes-pagamento',
    'upsert: true',
    'notifySupplierPortal',
  ]);

  await contains('supabase/migrations/20260722020000_supplier_procurement_foundation.sql', [
    'CREATE TABLE IF NOT EXISTS public.fornecedores',
    'CREATE TABLE IF NOT EXISTS public.fornecedor_produto_solicitacoes',
    'CREATE TABLE IF NOT EXISTS public.pedidos_compra_fornecedor',
    'CREATE TABLE IF NOT EXISTS public.fornecedor_entregas',
    'CREATE TABLE IF NOT EXISTS public.contas_pagar',
    'CREATE TABLE IF NOT EXISTS public.fornecedor_auditoria',
    "'documentos_fornecedor'",
    'ENABLE ROW LEVEL SECURITY',
  ]);
  await contains('supabase/migrations/20260722021000_supplier_auth_and_onboarding.sql', [
    "'fornecedor'",
    'gsa_public_register_supplier',
    'gsa_supplier_session_access_state',
    'gsa_supplier_document_allowed',
  ]);
  const operations = await contains('supabase/migrations/20260722022000_supplier_procurement_operations.sql', [
    'gsa_supplier_request_product',
    'gsa_supplier_submit_delivery',
    'gsa_admin_create_supplier_order',
    'gsa_admin_review_supplier_delivery',
    'UPDATE public.produtos',
    'INSERT INTO public.loja_estoque_historico',
    'INSERT INTO public.contas_pagar',
    "v_action <> 'aprovar'",
    "v_delivery.status = 'aprovado'",
  ]);
  await contains('supabase/migrations/20260723050000_supplier_onboarding_completion.sql', [
    'REENVIAR_PRE_CADASTRO',
    'gsa_supplier_update_profile',
  ]);
  await contains('supabase/migrations/20260723051000_supplier_product_adjustments.sql', [
    'REENVIAR_SOLICITACAO_PRODUTO',
    'gsa_supplier_mark_notification_read',
  ]);
  await contains('supabase/migrations/20260723052000_supplier_delivery_idempotency.sql', [
    'Referencia XML invalida para esta operacao',
    'request_id',
  ]);
  await contains('supabase/migrations/20260723053000_supplier_payment_completion.sql', [
    'O comprovante de pagamento e obrigatorio',
    'Pagamento confirmado',
  ]);

  const stockUpdate = operations.indexOf('UPDATE public.produtos', operations.indexOf('gsa_admin_review_supplier_delivery'));
  const historyInsert = operations.indexOf('INSERT INTO public.loja_estoque_historico', stockUpdate);
  const payableInsert = operations.indexOf('INSERT INTO public.contas_pagar', historyInsert);
  assert.ok(
    stockUpdate > 0 && historyInsert > stockUpdate && payableInsert > historyInsert,
    'A aprovacao da NF deve atualizar estoque, historico e contas a pagar na mesma operacao.',
  );

  const packageJson = JSON.parse(await read('package.json'));
  assert.match(packageJson.scripts['test:integrity:contracts'], /test:suppliers/);

  console.log('Contratos completos do portal e do fluxo de compras de fornecedores validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
