import { supabase } from './supabase';
import { sessionService } from './sessionService';

type WriteAction = 'insert' | 'update' | 'delete';

export async function clientOperationalWrite<T = any>(
  clienteId: string, // Kept for backward compatibility in calls, but ignored for auth
  table: string,
  action: WriteAction,
  data: Record<string, any> = {},
  filter: Record<string, any> = {}
): Promise<T | null> {
  const sessionData = sessionService.getCurrentSession();
  if (!sessionData?.sessaoId || !sessionData?.sessionToken) {
    throw new Error('Sessão inválida para escrita operacional.');
  }

  const { data: result, error } = await supabase.rpc('cliente_operational_write', {
    p_sessao_id: sessionData.sessaoId,
    p_session_token: sessionData.sessionToken,
    p_table: table,
    p_action: action,
    p_data: data,
    p_filter: filter,
  });

  if (error || !(result as any)?.success) {
    throw new Error(error?.message || 'Erro ao executar operação.');
  }

  return ((result as any).data || null) as T | null;
}
