import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { VIP_LEVELS, VIPLevel } from '../constants';

export function useVipLevels() {
  const [levels, setLevels] = useState<VIPLevel[]>(VIP_LEVELS);
  const [loading, setLoading] = useState(true);

  const fetchLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('client_levels')
        .select('*')
        .order('pontos_minimos', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedLevels: VIPLevel[] = data.map(dbLevel => ({
          id: dbLevel.nome_nivel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          name: dbLevel.nome_nivel,
          dbId: dbLevel.id, // UUID from database - used for realtime matching
          minPoints: dbLevel.pontos_minimos,
          maxPoints: dbLevel.pontos_maximos,
          multiplier: Number(dbLevel.pontos_por_real),
          color: dbLevel.cor || '#f5f5f5',
          textColor: dbLevel.cor_texto || '#1a1a1a',
          visualStyle: (dbLevel.visual_style as any) || 'clean',
          feePercentage: Number(dbLevel.taxa_saque_transferencia),
          price: Number(dbLevel.preco),
          benefits: Array.isArray(dbLevel.benefits) ? dbLevel.benefits : [],
          exclusiveBenefits: Array.isArray(dbLevel.exclusive_benefits) ? dbLevel.exclusive_benefits : []
        }));
        setLevels(mappedLevels);
      }
    } catch (error) {
      console.error('Error fetching levels:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();

    const channel = supabase
      .channel('global-vip-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_levels' }, () => {
        fetchLevels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { levels, loading, refreshLevels: fetchLevels };
}
