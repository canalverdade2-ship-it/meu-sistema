import { supabase } from './supabase';
import { sessionService } from './sessionService';
import { clientOperationalWrite } from './clientOperationalWrite';

/**
 * Gerenciador de Lista de Desejos (Favoritos) da Loja GSA.
 * Persiste no banco de dados (tabela `loja_favoritos`) para clientes logados
 * e mantém sincronização com o cache local (localStorage) para resposta instantânea.
 */
const KEY_PREFIX = 'gsa_wishlist';

function resolveClientId(clientId?: string | null): string | null {
  if (clientId) return clientId;
  const session = sessionService.getCurrentSession();
  if (session?.atorTipo === 'cliente' && session.atorId) {
    return session.atorId;
  }
  return null;
}

const storageKey = (clientId?: string | null) => {
  const effectiveId = resolveClientId(clientId);
  return effectiveId ? `${KEY_PREFIX}_${effectiveId}` : `${KEY_PREFIX}_guest`;
};

/**
 * Retorna os IDs favoritados do cache local (rápido e síncrono).
 */
export function getWishlist(clientId?: string | null): string[] {
  try {
    const raw = localStorage.getItem(storageKey(clientId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Verifica se um produto está na lista de favoritos.
 */
export function isInWishlist(productId: string, clientId?: string | null): boolean {
  if (!productId) return false;
  return getWishlist(clientId).includes(productId);
}

/**
 * Busca os favoritos diretamente do banco de dados (tabela loja_favoritos),
 * sincroniza com o cache local e migra favoritos anônimos (se houver).
 */
export async function fetchWishlistFromDb(clientId?: string | null): Promise<string[]> {
  const effectiveId = resolveClientId(clientId);

  if (!effectiveId) {
    // Visitante: retorna o localStorage guest
    return getWishlist(null);
  }

  try {
    // 1. Busca favoritos persistidos no banco de dados
    const { data, error } = await supabase
      .from('loja_favoritos')
      .select('produto_id')
      .eq('cliente_id', effectiveId);

    if (error) {
      console.warn('[wishlistStorage] Aviso ao consultar loja_favoritos:', error.message);
      return getWishlist(effectiveId);
    }

    let dbIds = (data || []).map((row: any) => row.produto_id).filter(Boolean);

    // 2. Se houver itens de visitante salvos antes do login, migra para o banco
    const guestRaw = localStorage.getItem(`${KEY_PREFIX}_guest`);
    if (guestRaw) {
      try {
        const guestIds: string[] = JSON.parse(guestRaw);
        if (Array.isArray(guestIds) && guestIds.length > 0) {
          const pendingIds = guestIds.filter((gid) => !dbIds.includes(gid));
          for (const pid of pendingIds) {
            try {
              await clientOperationalWrite(effectiveId, 'loja_favoritos', 'insert', { produto_id: pid });
              dbIds.push(pid);
            } catch (syncErr) {
              console.warn('[wishlistStorage] Erro ao sincronizar item de convidado:', syncErr);
            }
          }
          localStorage.removeItem(`${KEY_PREFIX}_guest`);
        }
      } catch (err) {
        console.warn('[wishlistStorage] Erro ao ler guest wishlist:', err);
      }
    }

    // 3. Atualiza o cache local do cliente autenticado
    localStorage.setItem(storageKey(effectiveId), JSON.stringify(dbIds));
    window.dispatchEvent(new CustomEvent('gsa-wishlist-updated'));

    return dbIds;
  } catch (err) {
    console.error('[wishlistStorage] Erro ao buscar lista de favoritos do banco:', err);
    return getWishlist(effectiveId);
  }
}

/**
 * Alterna o produto na lista de favoritos no banco de dados e no cache local.
 * Retorna true se o produto ficou favoritado, ou false se foi removido.
 */
export async function toggleWishlist(productId: string, clientId?: string | null): Promise<boolean> {
  if (!productId) return false;
  const effectiveId = resolveClientId(clientId);
  const current = getWishlist(effectiveId);
  const exists = current.includes(productId);
  const next = exists ? current.filter((id) => id !== productId) : [...current, productId];

  // Atualização otimista no cache local e emissão de evento imediato para UI responsiva
  try {
    localStorage.setItem(storageKey(effectiveId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('gsa-wishlist-updated'));
  } catch {
    /* storage indisponível */
  }

  // Persistência no banco de dados quando logado
  if (effectiveId) {
    try {
      if (exists) {
        await clientOperationalWrite(effectiveId, 'loja_favoritos', 'delete', {}, { produto_id: productId });
      } else {
        await clientOperationalWrite(effectiveId, 'loja_favoritos', 'insert', { produto_id: productId });
      }
    } catch (err) {
      console.error('[wishlistStorage] Erro ao persistir favorito no banco:', err);
    }
  }

  return !exists;
}

/**
 * Remove um produto da lista de favoritos no banco de dados e no cache local.
 */
export async function removeFromWishlist(productId: string, clientId?: string | null): Promise<string[]> {
  if (!productId) return [];
  const effectiveId = resolveClientId(clientId);
  const next = getWishlist(effectiveId).filter((id) => id !== productId);

  try {
    localStorage.setItem(storageKey(effectiveId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('gsa-wishlist-updated'));
  } catch {
    /* storage indisponível */
  }

  if (effectiveId) {
    try {
      await clientOperationalWrite(effectiveId, 'loja_favoritos', 'delete', {}, { produto_id: productId });
    } catch (err) {
      console.error('[wishlistStorage] Erro ao remover favorito do banco:', err);
    }
  }

  return next;
}
