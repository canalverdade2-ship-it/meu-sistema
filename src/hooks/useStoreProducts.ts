import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface StoreCache {
  produtos: any[];
  servicos: any[];
  assinaturas: any[];
  categorias: any[];
  promocoesAtivas: any[];
  timestamp: number;
}

export function useStoreProducts(clientId?: string, clientType?: 'pf' | 'pj' | null) {
  const [data, setData] = useState<StoreCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStoreData = async () => {
    setIsLoading(true);

    try {
      let currentType = clientType;
      
      // Se não passou o tipo e tem cliente, busca
      if (!currentType && clientId) {
        const { data: cData } = await supabase.from('clientes').select('tipo_pessoa').eq('id', clientId).maybeSingle();
        if (cData && cData.tipo_pessoa) currentType = cData.tipo_pessoa as 'pf' | 'pj';
      }

      const types = currentType ? [currentType, 'ambos'] : ['pf', 'pj', 'ambos'];

      const [prodRes, servRes, assRes, catRes, promosRes] = await Promise.all([
        supabase.from('produtos').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
        supabase.from('servicos').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
        supabase.from('assinaturas').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
        supabase.from('loja_categorias').select('*').eq('status', 'ativo').order('ordem'),
        supabase.from('promocoes_quantidade').select('*, produto_brinde:produtos!produto_brinde_id(*), produto_gatilho:produtos!produto_gatilho_id(nome)').eq('status', 'ativa')
      ]);

      const newData: StoreCache = {
        produtos: prodRes.data || [],
        servicos: servRes.data || [],
        assinaturas: assRes.data || [],
        categorias: catRes.data || [],
        promocoesAtivas: promosRes.data || [],
        timestamp: Date.now()
      };

      setData(newData);
      return newData;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();

    // 1. Revalidação ao voltar para a aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStoreData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Supabase Realtime para a tabela de produtos (atualizações de cota e estoque)
    const channel = supabase.channel('store-products-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'produtos'
        },
        (payload) => {
          // Quando houver atualização nos produtos (ex: estoque ou limite de desconto usado), atualizamos o cache silenciosamente
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              produtos: prev.produtos.map(p => p.id === payload.new.id ? payload.new : p)
            };
          });
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [clientId, clientType]); // Refetch se os identificadores do cliente mudarem

  return {
    data,
    produtos: data?.produtos || [],
    servicos: data?.servicos || [],
    assinaturas: data?.assinaturas || [],
    categorias: data?.categorias || [],
    promocoesAtivas: data?.promocoesAtivas || [],
    isLoading,
    error,
    refetch: () => fetchStoreData()
  };
}
