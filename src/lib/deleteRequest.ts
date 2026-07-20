import { supabase } from './supabase';
import { toast } from 'react-hot-toast';

/**
 * Intercepta exclusões administrativas.
 * Atores que não são colaboradores podem excluir diretamente.
 * Colaboradores precisam abrir uma solicitação para aprovação.
 */
export async function canDeleteRecord(tabela: string, registro_id: string): Promise<boolean> {
  const rawSession = localStorage.getItem('_gsa_sess');
  if (!rawSession) {
    toast.error('Sessão inválida.');
    return false;
  }

  try {
    let storedSession: { sessaoId?: string; sessionToken?: string } = {};
    try {
      storedSession = JSON.parse(atob(rawSession));
    } catch {
      toast.error('Sessão inválida.');
      return false;
    }

    if (!storedSession.sessaoId || !storedSession.sessionToken) {
      toast.error('Sessão inválida.');
      return false;
    }

    const { data: sessionData, error: sessionError } = await supabase
      .rpc('gsa_validate_session', {
        p_sessao_id: storedSession.sessaoId,
        p_session_token: storedSession.sessionToken
      })
      .single();

    if (sessionError || !sessionData || !(sessionData as any).is_valid) {
      toast.error('Sessão expirada ou inválida.');
      return false;
    }

    if ((sessionData as any).ator_tipo !== 'colaborador') {
      return true;
    }

    const motivo = window.prompt('Exclusão restrita: qual o motivo para solicitar a exclusão deste registro? Sua solicitação será enviada para aprovação administrativa.');

    if (!motivo || motivo.trim() === '') {
      toast.error('Solicitação cancelada. É obrigatório informar o motivo.');
      return false;
    }

    const { error } = await supabase.from('solicitacoes_exclusao').insert([{
      colaborador_id: (sessionData as any).ator_id,
      tabela,
      registro_id,
      motivo: motivo.trim()
    }]);

    if (error) throw error;

    toast.success('Solicitação de exclusão enviada para análise administrativa.');
    return false;
  } catch (err) {
    console.error('Erro ao validar exclusão:', err);
    toast.error('Erro ao processar solicitação.');
    return false;
  }
}
