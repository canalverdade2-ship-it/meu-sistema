import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(relativePath: string, expected: string[]): void {
  const content = read(relativePath);
  for (const marker of expected) {
    if (!content.includes(marker)) {
      throw new Error(`${relativePath}: contrato ausente: ${marker}`);
    }
  }
}

assertContains('src/lib/adminStoreOperations.ts', [
  'gsa_admin_adjust_product_stock',
  'gsa_admin_transition_store_order',
  'gsa_admin_cancel_store_order',
  'gsa_admin_activate_subscription',
  'gsa_admin_save_product_catalog',
  'gsa_admin_save_subscription_catalog',
  'gsa_admin_archive_catalog_items',
]);

assertContains('src/lib/publicStoreImage.ts', [
  'MAX_STORE_IMAGE_SIZE',
  'validatePublicStoreImage',
  'generateUUID()',
  'removeUnusedPublicStoreImages',
]);

assertContains('src/components/admin/ProdutosModule.tsx', [
  "query.in('tipo_cliente', [tipoClienteFilter, 'ambos'])",
  'adjustAdminProductStock',
  'saveAdminProductCatalog',
  "archiveAdminCatalogItems('produto'",
]);

assertContains('src/components/admin/AssinaturasModule.tsx', [
  'saveAdminSubscriptionCatalog',
  "archiveAdminCatalogItems('assinatura'",
  'uploadPublicStoreImage',
]);

assertContains('src/components/admin/OrdensCompraModule.tsx', [
  'transitionAdminStoreOrder',
  'cancelAdminStoreOrder',
  'refund_created',
]);

assertContains('src/components/admin/OrdensAssinaturaModule.tsx', [
  'activateAdminSubscription',
  'activationRequestId',
]);

assertContains('src/components/client/ClientProdutos.tsx', [
  "'em_expedicao'",
  "'em_transporte'",
  'valor_unitario_contratado',
  'Este produto está sem estoque.',
]);

assertContains('src/components/client/ClientAssinaturas.tsx', [
  "'pendente'",
  "'pago'",
  'valor_mensal_contratado',
  'Cobranças futuras não pagas serão canceladas',
]);

assertContains('src/components/client/store/CheckoutModal.tsx', [
  'visivel_na_loja',
  'estoque_disponivel',
  'Não foi possível validar preços e estoque',
]);

assertContains('src/types.ts', [
  "tipo_cliente: 'pf' | 'pj' | 'ambos';",
]);

assertContains('supabase/migrations/20260721010000_harden_products_and_subscriptions.sql', [
  'gsa_admin_operation_requests',
  'gsa_admin_adjust_product_stock',
  'gsa_admin_transition_store_order',
  'gsa_admin_cancel_store_order',
  'gsa_admin_activate_subscription',
  'gsa_process_due_subscription_cancellations',
  'valor_unitario_contratado',
  'valor_mensal_contratado',
]);

assertContains('supabase/migrations/20260721010100_secure_product_subscription_catalog.sql', [
  'gsa_admin_save_product_catalog',
  'gsa_admin_save_subscription_catalog',
  'gsa_admin_archive_catalog_items',
]);

console.log('Contratos de Produtos e Assinaturas validados.');
