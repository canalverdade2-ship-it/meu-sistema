import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export function useStoreOrders(clientId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);

  const fetchPedidos = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      // Basic query for fetching orders, meant to abstract away Supabase logic from StoreHub
      const { data, error } = await supabase
        .from('ordens_compra')
        .select('*')
        .eq('cliente_id', clientId)
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (err: any) {
      toast.error('Erro ao buscar seus pedidos.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return {
    pedidos,
    loading,
    fetchPedidos,
    setPedidos
  };
}
