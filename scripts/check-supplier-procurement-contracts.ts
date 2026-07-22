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
  assert.equal(routes.login.supplier(), '/fornecedor');
  assert.equal(routes.supplier.dashboard(), '/fornecedor/dashboard');
  assert.equal(routes.admin.suppliers(), '/admin/fornecedores');
  assert.equal(matchRoute('/fornecedor/pedidos', '', '').area, 'supplier');
  assert.equal(matchRoute('/fornecedor/pedidos', '', '').module, 'pedidos');
  assert.equal(matchRoute('/fornecedor', '', '').module, 'access');
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
    "reviewProduct(request, 'aprovar')",
    'Aprovar NF e estoque',
    'Contas a pagar',
    'reviewAdminSupplierDelivery',
  ]);
  await contains('src/pages/Fornecedor/FornecedorDashboard.tsx', [
    'Novo produto',
    'Enviar entrega e nota fiscal',
    'submitSupplierDelivery',
    'Quantidades entregues',
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

  const stockUpdate = operations.indexOf('UPDATE public.produtos', operations.indexOf('gsa_admin_review_supplier_delivery'));
  const historyInsert = operations.indexOf('INSERT INTO public.loja_estoque_historico', stockUpdate);
  const payableInsert = operations.indexOf('INSERT INTO public.contas_pagar', historyInsert);
  assert.ok(stockUpdate > 0 && historyInsert > stockUpdate && payableInsert > historyInsert,
    'A aprovacao da NF deve atualizar estoque, historico e contas a pagar na mesma operacao.');

  console.log('Contratos do portal e do fluxo de compras de fornecedores validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
