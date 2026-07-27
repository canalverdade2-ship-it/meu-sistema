import { sessionService } from './sessionService';
import { supabase } from './supabase';

export function requireClientSession() {
  const session = sessionService.getCurrentSession();
  if (
    !session?.sessaoId ||
    !session?.sessionToken ||
    session.atorTipo !== 'cliente'
  ) {
    throw new Error('Sessão de cliente inválida ou expirada. Faça login novamente.');
  }
  return session;
}

export async function callClientRpc<T = unknown>(
  functionName: string,
  parameters: Record<string, unknown> = {},
): Promise<T> {
  const session = requireClientSession();
  const { data, error } = await supabase.rpc(functionName, {
    p_sessao_id: session.sessaoId,
    p_session_token: session.sessionToken,
    ...parameters,
  });

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('invalida ou expirada') || msg.includes('inválida ou expirada')) {
      void sessionService.endSession();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gsa-session-revoked'));
    }
    throw error;
  }
  return data as T;
}
