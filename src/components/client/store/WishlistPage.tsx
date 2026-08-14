import React, { useState, useEffect } from 'react';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { EcommerceHeader } from './EcommerceHeader';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import StoreItemCard from './StoreItemCard';
import { fetchWishlistFromDb, removeFromWishlist } from '../../../lib/wishlistStorage';
import { toast } from 'react-hot-toast';

export function WishlistPage({ clientId, onRequireAuth }: { clientId?: string, onRequireAuth?: () => void }) {
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega os produtos favoritados pelo cliente (persistidos no banco de dados e sincronizados)
  useEffect(() => {
    let active = true;

    const fetchWishlist = async () => {
      setLoading(true);
      try {
        const ids = await fetchWishlistFromDb(clientId);
        if (ids.length === 0) {
          if (active) setWishlistItems([]);
          return;
        }
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .in('id', ids);

        if (!active) return;
        if (data && !error) {
          // Preserva a ordem em que os produtos foram favoritados
          const ordered = ids
            .map((id) => data.find((p: any) => p.id === id))
            .filter(Boolean);
          setWishlistItems(ordered);
        }
      } catch (err) {
        console.error('Erro ao buscar wishlist:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchWishlist();
    const onUpdate = () => fetchWishlist();
    window.addEventListener('gsa-wishlist-updated', onUpdate);
    return () => {
      active = false;
      window.removeEventListener('gsa-wishlist-updated', onUpdate);
    };
  }, [clientId]);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <EcommerceHeader 
        clientId={clientId}
        cartItemCount={0}
        onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
        onRequireAuth={onRequireAuth}
      />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#17345f]">
            <Heart className="h-8 w-8 fill-current text-red-500" />
            <h1 className="text-3xl font-black tracking-tight">Minha Lista de Desejos</h1>
          </div>
          <span className="rounded-full bg-neutral-200 px-3.5 py-1.5 text-sm font-bold text-neutral-700 shadow-sm">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item salvo' : 'itens salvos'}
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#17345f] border-t-transparent" />
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-16 text-center shadow-sm border border-slate-100">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 border border-rose-100 text-rose-500">
              <Heart className="h-10 w-10 fill-rose-500" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">Sua lista está vazia</h3>
            <p className="mt-2 text-neutral-500 max-w-md">
              Salve seus produtos favoritos clicando no coração para acompanhá-los e comprá-los quando quiser.
            </p>
            <button 
              onClick={() => navigate(routes.marketplace.store.products())}
              className="mt-6 flex items-center gap-2 rounded-xl bg-[#17345f] px-6 py-3 font-bold text-white transition-all hover:bg-[#0c2340] cursor-pointer shadow-md hover:shadow-lg"
            >
              Explorar Catálogo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
            {wishlistItems.map((item) => (
              <div key={item.id} className="relative group">
                <StoreItemCard
                  item={item}
                  tipo="produto"
                  clientId={clientId}
                  onAdd={() => navigate(routes.marketplace.store.product(item.id) + '?modal=quantidade')}
                  onClick={() => navigate(routes.marketplace.store.product(item.id))}
                />
                <button 
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await removeFromWishlist(item.id, clientId);
                    setWishlistItems((prev) => prev.filter((p) => p.id !== item.id));
                    toast.success('Produto removido dos favoritos.');
                  }}
                  className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-400 shadow-md transition-all hover:text-red-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Remover da lista"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default WishlistPage;
