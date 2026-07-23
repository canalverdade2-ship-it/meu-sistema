import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clientOperationalWrite } from '../lib/clientOperationalWrite';
import { toast } from 'react-hot-toast';

export interface CartItem {
  id: string;
  cliente_id: string;
  tipo: 'produto' | 'servico' | 'assinatura';
  item_id: string;
  quantidade: number;
  prazo_meses?: number;
  item_detalhes?: any;
}

export function useStoreCart(clientId: string | undefined, productsData: any) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(true);

  const fetchCart = useCallback(async () => {
    if (!clientId) {
      setIsLoadingCart(false);
      return;
    }

    setIsLoadingCart(true);
    try {
      const { data, error } = await supabase.from('loja_carrinhos').select('*').eq('cliente_id', clientId);
      if (error) {
        console.error('[GSAStore] Erro ao buscar carrinho:', error);
        return;
      }
      if (!data) return;

      const enrichedCart = data.map((c: any) => {
        let itemDetails = null;
        if (c.tipo === 'produto') itemDetails = productsData?.produtos?.find((p: any) => p.id === c.item_id);
        else if (c.tipo === 'servico') itemDetails = productsData?.servicos?.find((s: any) => s.id === c.item_id);
        else if (c.tipo === 'assinatura') itemDetails = productsData?.assinaturas?.find((a: any) => a.id === c.item_id);

        return { ...c, item_detalhes: itemDetails };
      });

      const validItems = enrichedCart.filter((i: any) => i.item_detalhes);
      setCartItems(validItems);
    } catch (err) {
      console.error('[GSAStore] Erro crítico em fetchCart:', err);
    } finally {
      setIsLoadingCart(false);
    }
  }, [clientId, productsData]);

  useEffect(() => {
    if (productsData?.produtos?.length > 0) {
      fetchCart();
    }
  }, [clientId, productsData, fetchCart]);

  const updateQuantity = useCallback(async (id: string, qty: number) => {
    if (!clientId) return;

    // Atualização otimista; a identidade do cliente é derivada da sessão no servidor.
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantidade: qty } : item));

    try {
      await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', {
        quantidade: qty,
        updated_at: new Date().toISOString(),
      }, { id });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar quantidade.');
      fetchCart(); // Reverte
    }
  }, [clientId, fetchCart]);

  const removeItem = useCallback(async (id: string) => {
    if (!clientId) return;

    // Atualização otimista; a exclusão é autorizada pela sessão dentro da RPC.
    setCartItems(prev => prev.filter(item => item.id !== id));

    try {
      await clientOperationalWrite(clientId, 'loja_carrinhos', 'delete', {}, { id });
      toast.success('Item removido do carrinho.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover do carrinho.');
      fetchCart(); // Reverte
    }
  }, [clientId, fetchCart]);

  return { cartItems, setCartItems, isLoadingCart, fetchCart, updateQuantity, removeItem };
}
