import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let cachedPixDiscount: { 
  ativo: boolean; 
  porcentagem: number; 
  tipoAplicacao: 'todos' | 'categorias' | 'produtos';
  categorias: string[];
  produtos: string[];
} | null = null;

let fetchPromise: Promise<{ 
  ativo: boolean; 
  porcentagem: number;
  tipoAplicacao: 'todos' | 'categorias' | 'produtos';
  categorias: string[];
  produtos: string[];
}> | null = null;

const DEFAULT_STATE = { 
  ativo: false, 
  porcentagem: 5, 
  tipoAplicacao: 'todos' as const, 
  categorias: [], 
  produtos: [] 
};

export function usePixDiscount() {
  const [pixDiscount, setPixDiscount] = useState(DEFAULT_STATE);

  useEffect(() => {
    let mounted = true;

    // Só usa cache se tiver dados válidos (ativo === true ou dados já foram carregados com sucesso)
    if (cachedPixDiscount !== null) {
      setPixDiscount(cachedPixDiscount);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'loja_pix_desconto_ativo', 
          'loja_pix_desconto_porcentagem',
          'loja_pix_desconto_tipo_aplicacao',
          'loja_pix_desconto_categorias',
          'loja_pix_desconto_produtos'
        ])
        .then(({ data, error }) => {
          if (error) {
            // Em caso de erro, limpa o promise para tentar de novo
            fetchPromise = null;
            return DEFAULT_STATE;
          }
          
          // Se não há dados, retorna default mas NÃO cacheia (para tentar de novo)
          if (!data || data.length === 0) {
            fetchPromise = null;
            return DEFAULT_STATE;
          }
          
          const ativo = data.find((s) => s.key === 'loja_pix_desconto_ativo')?.value === 'true';
          const porcentagem = Number(data.find((s) => s.key === 'loja_pix_desconto_porcentagem')?.value) || 5;
          const tipoAplicacao = (data.find((s) => s.key === 'loja_pix_desconto_tipo_aplicacao')?.value as 'todos' | 'categorias' | 'produtos') || 'todos';
          
          const catsStr = data.find((s) => s.key === 'loja_pix_desconto_categorias')?.value || '';
          const categorias = catsStr.split(',').map(s => s.trim()).filter(Boolean);
          
          const prodsStr = data.find((s) => s.key === 'loja_pix_desconto_produtos')?.value || '';
          const produtos = prodsStr.split(',').map(s => s.trim()).filter(Boolean);

          const result = { ativo, porcentagem, tipoAplicacao, categorias, produtos };
          // Cacheia apenas quando há dados reais
          cachedPixDiscount = result;
          return result;
        })
        .catch(() => {
          fetchPromise = null;
          return DEFAULT_STATE;
        });
    }

    fetchPromise.then((result) => {
      if (mounted) setPixDiscount(result);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return pixDiscount;
}

export function checkPixDiscountApplies(
  item: any,
  pixSettings: {
    ativo: boolean;
    tipoAplicacao: 'todos' | 'categorias' | 'produtos';
    categorias: string[];
    produtos: string[];
  }
): boolean {
  if (!pixSettings.ativo) return false;
  if (pixSettings.tipoAplicacao === 'todos') return true;

  if (pixSettings.tipoAplicacao === 'produtos') {
    return pixSettings.produtos.includes(String(item.id));
  }

  if (pixSettings.tipoAplicacao === 'categorias') {
    const catName = typeof item?.categoria === 'string' ? item.categoria :
                    typeof item?.categorias?.nome === 'string' ? item.categorias.nome :
                    typeof item?.categoria_nome === 'string' ? item.categoria_nome : '';
                    
    // Compara ignorando case
    return pixSettings.categorias.some(c => c.toLowerCase() === catName.toLowerCase());
  }

  return false;
}

