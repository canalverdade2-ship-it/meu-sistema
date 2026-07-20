import { sessionService } from './sessionService';
import { supabase } from './supabase';

export function requireAdminSession() {
  const session = sessionService.getCurrentSession();
  if (
    !session?.sessaoId ||
    !session?.sessionToken ||
    !['admin', 'colaborador'].includes(session.atorTipo)
  ) {
    throw new Error('Sessão administrativa inválida ou expirada. Faça login novamente.');
  }
  return session;
}

export async function callAdminRpc<T = unknown>(
  functionName: string,
  parameters: Record<string, unknown> = {},
): Promise<T> {
  const session = requireAdminSession();
  const { data, error } = await supabase.rpc(functionName, {
    p_sessao_id: session.sessaoId,
    p_session_token: session.sessionToken,
    ...parameters,
  });

  if (error) throw error;
  return data as T;
}

export async function getAdminProductSupplierConfig(produtoId: string) {
  return callAdminRpc<any>('gsa_admin_get_product_supplier_config', {
    p_produto_id: produtoId
  });
}

export async function upsertAdminProductSupplierConfig(produtoId: string, dados: any) {
  return callAdminRpc<any>('gsa_admin_upsert_product_supplier_config', {
    p_produto_id: produtoId,
    p_dados: dados
  });
}

export async function checkExistingSupplierProducts(urls: string[]) {
  return callAdminRpc<any[]>('gsa_admin_check_existing_supplier_products', {
    p_urls: urls
  });
}

export async function importProductsBatch(items: any[]) {
  return callAdminRpc<any>('gsa_admin_import_products_batch', {
    p_items: items
  });
}

export async function setAdminProductDiscount(
  produtoId: string,
  ativo: boolean,
  tipo: 'porcentagem' | 'valor' | null,
  valor: number | null,
  prazoTipo: 'determinado' | 'indeterminado' = 'indeterminado',
  fimEm: string | null = null,
  limiteQuantidadeAtivo: boolean = false,
  quantidadeLimite: number | null = null,
  iniciarNovaCampanha: boolean = false
) {
  return callAdminRpc<any>('gsa_admin_set_product_discount', {
    p_produto_id: produtoId,
    p_ativo: ativo,
    p_tipo: tipo,
    p_valor: valor,
    p_prazo_tipo: prazoTipo,
    p_fim_em: fimEm,
    p_limite_quantidade_ativo: limiteQuantidadeAtivo,
    p_quantidade_limite: quantidadeLimite,
    p_iniciar_nova_campanha: iniciarNovaCampanha
  });
}

export async function releaseDiscountQuota(orcamentoId: string) {
  return callAdminRpc<any>('gsa_admin_release_discount_quota', {
    p_orcamento_id: orcamentoId
  });
}
