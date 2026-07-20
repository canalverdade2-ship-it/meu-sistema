import { supabase } from './supabase';
import { sessionService } from './sessionService';

type WriteAction = 'insert' | 'update' | 'delete';

export async function clientOperationalWrite<T = any>(
  clienteId: string, // Mantido somente para compatibilidade com chamadas antigas.
  table: string,
  action: WriteAction,
  data: Record<string, any> = {},
  filter: Record<string, any> = {},
): Promise<T | null> {
  const sessionData = sessionService.getCurrentSession();
  if (
    !sessionData?.sessaoId
    || !sessionData?.sessionToken
    || sessionData.atorTipo !== 'cliente'
    || !sessionData.atorId
  ) {
    throw new Error('Sessão de cliente inválida para escrita operacional.');
  }

  // Nunca usamos o ID recebido pelo componente como identidade. A RPC deve derivar
  // o cliente exclusivamente da sessão GSA validada no servidor.
  void clienteId;

  const { data: result, error } = await supabase.rpc('gsa_client_operational_write', {
    p_sessao_id: sessionData.sessaoId,
    p_session_token: sessionData.sessionToken,
    p_table: table,
    p_action: action,
    p_data: data,
    p_filter: filter,
  });

  if (error || !(result as any)?.success) {
    throw new Error(error?.message || (result as any)?.error || 'Erro ao executar operação.');
  }

  return ((result as any).data || null) as T | null;
}
