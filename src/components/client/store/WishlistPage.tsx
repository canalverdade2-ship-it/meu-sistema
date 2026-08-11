import React, { useState, useEffect } from 'react';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { EcommerceHeader } from './EcommerceHeader';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { formatCurrency } from '../../../lib/utils';
import StoreItemCard from './StoreItemCard';

export function WishlistPage({ clientId, onRequireAuth }: { clientId?: string, onRequireAuth?: () => void }) {
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // MOCK: Na falta de uma tabela `wishlist`, vamos simular buscando produtos aleatórios
  // No futuro, isso faria um JOIN com a tabela de favoritos do cliente.
  useEffect(() => {
    if (!clientId) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    const fetchMockWishlist = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .limit(4); // Pegamos 4 produtos como favoritos
          
        if (data && !error) {
          setWishlistItems(data);
        }
      } catch (err) {
        console.error('Erro ao buscar wishlist:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMockWishlist();
  }, [clientId, onRequireAuth]);

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
          <span className="rounded-full bg-neutral-200 px-3 py-1 text-sm font-bold text-neutral-700">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#17345f] border-t-transparent" />
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-16 text-center shadow-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
              <Heart className="h-10 w-10 text-neutral-300" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">Sua lista está vazia</h3>
            <p className="mt-2 text-neutral-500">Salve seus produtos favoritos para comprá-los depois.</p>
            <button 
              onClick={() => navigate(routes.marketplace.store.products())}
              className="mt-6 flex items-center gap-2 rounded-xl bg-[#17345f] px-6 py-3 font-bold text-white transition-all hover:bg-[#0c2340]"
            >
              Explorar Loja
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
                  onAdd={() => navigate(routes.marketplace.store.product(item.id) + '?modal=quantidade')}
                  onClick={() => navigate(routes.marketplace.store.product(item.id))}
                />
                <button 
                  className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-400 shadow-md transition-all hover:text-red-500 opacity-0 group-hover:opacity-100"
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
