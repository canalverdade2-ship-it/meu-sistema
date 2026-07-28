import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface PublicRegistrationSettings {
  ativo: boolean;
  codigo: string;
  tipo: 'pontos' | 'credito';
  valor: number;
}

const DEFAULT_SETTINGS: PublicRegistrationSettings = {
  ativo: false,
  codigo: '',
  tipo: 'pontos',
  valor: 0,
};

export function usePublicRegistrationSettings(enabled: boolean) {
  const [settings, setSettings] = useState<PublicRegistrationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    // Em dev local com servidor remoto instável, usa os valores padrão para evitar erros 522/CORS no console
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('gsa_public_registration_settings');
      if (error) throw error;
      setSettings({
        ativo: Boolean(data?.ativo),
        codigo: typeof data?.codigo === 'string' ? data.codigo : '',
        tipo: data?.tipo === 'credito' ? 'credito' : 'pontos',
        valor: Number(data?.valor || 0),
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}
