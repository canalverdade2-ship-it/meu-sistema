import { supabase } from './supabase';

type AtorTipo = 'admin' | 'colaborador' | 'cliente' | 'prestador' | 'sistema';

interface LogData {
  ator_tipo: AtorTipo;
  ator_id?: string;
  ator_nome?: string;
  acao: string;
  detalhes?: string;
}

function getStoredSession() {
  try {
    const stored = localStorage.getItem('_gsa_sess');
    if (!stored) return null;
    return JSON.parse(atob(stored)) as { sessaoId?: string; sessionToken?: string };
  } catch {
    return null;
  }
}

export const logService = {
  /**
   * Registra uma ação no extrato global (sistema_logs) via RPC validada.
   */
  async logAction(data: LogData) {
    try {
      const session = getStoredSession();
      const { error } = await supabase.rpc('gsa_log_action', {
        p_sessao_id: session?.sessaoId || null,
        p_session_token: session?.sessionToken || null,
        p_ator_tipo: data.ator_tipo,
        p_ator_id: data.ator_id || null,
        p_ator_nome: data.ator_nome || null,
        p_acao: data.acao,
        p_detalhes: data.detalhes || null
      });

      if (error) {
        console.error('Erro ao salvar log no banco de dados:', error);
      }
    } catch (e) {
      console.error('Falha inesperada no logService:', e);
    }
  }
};
