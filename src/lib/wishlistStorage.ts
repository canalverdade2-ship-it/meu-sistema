/**
 * Persistência local da Lista de Desejos (favoritos) da loja.
 * Mantém os IDs dos produtos favoritados por cliente (ou visitante) no localStorage,
 * garantindo que o coração marcado na página do produto não se perca ao navegar.
 */
const KEY_PREFIX = 'gsa_wishlist';

const storageKey = (clientId?: string | null) =>
  clientId ? `${KEY_PREFIX}_${clientId}` : `${KEY_PREFIX}_guest`;

export function getWishlist(clientId?: string | null): string[] {
  try {
    const raw = localStorage.getItem(storageKey(clientId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function isInWishlist(productId: string, clientId?: string | null): boolean {
  return getWishlist(clientId).includes(productId);
}

/** Alterna o produto na lista e retorna true se ficou favoritado. */
export function toggleWishlist(productId: string, clientId?: string | null): boolean {
  const current = getWishlist(clientId);
  const exists = current.includes(productId);
  const next = exists ? current.filter((id) => id !== productId) : [...current, productId];
  try {
    localStorage.setItem(storageKey(clientId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('gsa-wishlist-updated'));
  } catch {
    /* storage indisponível */
  }
  return !exists;
}

export function removeFromWishlist(productId: string, clientId?: string | null): string[] {
  const next = getWishlist(clientId).filter((id) => id !== productId);
  try {
    localStorage.setItem(storageKey(clientId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('gsa-wishlist-updated'));
  } catch {
    /* storage indisponível */
  }
  return next;
}
