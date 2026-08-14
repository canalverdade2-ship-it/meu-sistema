import { callAdminRpc } from './adminRpc';
import { supabase } from './supabase';

export type StoreOrderStatus = 'pago' | 'em_expedicao' | 'em_transporte' | 'concluido';

export async function adjustAdminProductStock(input: {
  requestId: string;
  produtoId: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  motivo: string;
}) {
  return callAdminRpc<any>('gsa_admin_adjust_product_stock', {
    p_request_id: input.requestId,
    p_produto_id: input.produtoId,
    p_tipo: input.tipo,
    p_quantidade: input.quantidade,
    p_motivo: input.motivo,
  });
}

export async function transitionAdminStoreOrder(input: {
  requestId: string;
  ordemId: string;
  status: StoreOrderStatus;
}) {
  return callAdminRpc<any>('gsa_admin_transition_store_order', {
    p_request_id: input.requestId,
    p_ordem_compra_id: input.ordemId,
    p_novo_status: input.status,
  });
}

export async function cancelAdminStoreOrder(input: {
  requestId: string;
  ordemId: string;
  motivo: string;
}) {
  return callAdminRpc<any>('gsa_admin_cancel_store_order', {
    p_request_id: input.requestId,
    p_ordem_compra_id: input.ordemId,
    p_motivo: input.motivo,
  });
}

export async function activateAdminSubscription(input: {
  requestId: string;
  ordemId: string;
}) {
  return callAdminRpc<any>('gsa_admin_activate_subscription', {
    p_request_id: input.requestId,
    p_ordem_assinatura_id: input.ordemId,
  });
}

export async function saveAdminProductCatalog(input: {
  produtoId?: string | null;
  payload: Record<string, unknown>;
  fornecedor?: Record<string, unknown> | null;
}) {
  return callAdminRpc<any>('gsa_admin_save_product_catalog', {
    p_produto_id: input.produtoId || null,
    p_payload: input.payload,
    p_fornecedor: input.fornecedor || null,
  });
}

export async function saveAdminSubscriptionCatalog(input: {
  assinaturaId?: string | null;
  payload: Record<string, unknown>;
}) {
  return callAdminRpc<any>('gsa_admin_save_subscription_catalog', {
    p_assinatura_id: input.assinaturaId || null,
    p_payload: input.payload,
  });
}

export async function archiveAdminCatalogItems(
  tipo: 'produto' | 'assinatura',
  ids: string[],
) {
  if (!ids || ids.length === 0) return { success: true, updated: 0 };

  const chunkSize = 50;
  let totalUpdated = 0;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const res = await callAdminRpc<any>('gsa_admin_archive_catalog_items', {
        p_tipo: tipo,
        p_ids: chunk,
      });
      totalUpdated += res?.updated ?? chunk.length;
    } catch (rpcErr) {
      console.warn('[adminStoreOperations] Erro no RPC de arquivamento em lote, aplicando fallback direto:', rpcErr);
      const table = tipo === 'produto' ? 'produtos' : 'assinaturas';
      const { error: directError } = await supabase
        .from(table)
        .update({ status: 'inativo', visivel_na_loja: false })
        .in('id', chunk);

      if (directError) throw directError;
      totalUpdated += chunk.length;
    }
  }

  return { success: true, updated: totalUpdated };
}

export async function deleteAdminProductsBulk(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, deleted: 0 };

  const chunkSize = 200;
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const res = await callAdminRpc<any>('gsa_admin_delete_products_bulk', {
        p_ids: chunk,
      });
      totalDeleted += res?.total ?? res?.deleted ?? chunk.length;
    } catch (rpcErr) {
      console.warn('[adminStoreOperations] Erro no RPC de exclusao em lote, aplicando fallback direto:', rpcErr);
      await supabase.from('loja_carrinhos').delete().in('item_id', chunk).eq('tipo', 'produto');
      await supabase.from('produto_fornecedor_config').delete().in('produto_id', chunk);
      const { error: directError } = await supabase.from('produtos').delete().in('id', chunk);
      if (directError) {
        console.warn('[adminStoreOperations] Fallback para inativação devido a integridade referencial:', directError);
        await supabase.from('produtos').update({ status: 'inativo', visivel_na_loja: false }).in('id', chunk);
      }
      totalDeleted += chunk.length;
    }
  }

  return { success: true, deleted: totalDeleted };
}
