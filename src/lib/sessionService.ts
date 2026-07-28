import { supabase } from './supabase';

export type ClientPersonType = 'pf' | 'pj';

type StoredSession = {
  sessaoId: string;
  sessionToken?: string;
  atorTipo: string;
  atorId: string;
  atorNome: string;
  clientPersonType?: ClientPersonType;
  [key: string]: any;
};

export type AuthGatewayError = Error & {
  code?: string;
  retryAfter?: number;
  status?: number;
};

const SESSION_STORAGE_KEY = '_gsa_session';
let restoreSessionPromise: Promise<StoredSession | null> | null = null;
let endSessionPromise: Promise<void> | null = null;
let loginQueue: Promise<void> = Promise.resolve();

function getSessionStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readStoredSession(): StoredSession | null {
  try {
    const stored = getSessionStorage()?.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(sessionData: StoredSession) {
  const storage = getSessionStorage();
  storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  storage?.removeItem('sessaoId');
  storage?.removeItem('_gsa_sess');
}

function clearStoredSession() {
  const storage = getSessionStorage();
  storage?.removeItem(SESSION_STORAGE_KEY);
  storage?.removeItem('sessaoId');
  storage?.removeItem('_gsa_sess');
  storage?.removeItem('lastPing');
}

function gatewayErrorMessage(code: string, retryAfter: number) {
  if (code === 'too_many_attempts') {
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    return `Muitas tentativas. Aguarde ${minutes} minuto(s) e tente novamente.`;
  }
  if (code === 'origin_not_allowed') {
    return 'Este endereço não está autorizado para acessar o sistema.';
  }
  if (
    code === 'server_not_configured'
    || code === 'rate_limit_unavailable'
    || code === 'auth_sync_unavailable'
  ) {
    return 'O acesso está temporariamente indisponível. Tente novamente mais tarde.';
  }
  return 'Não foi possível concluir a autenticação.';
}

async function createAuthGatewayError(error: any): Promise<AuthGatewayError> {
  const response = error?.context instanceof Response ? error.context as Response : null;
  let payload: { error?: string; retry_after?: number } | null = null;

  if (response) {
    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }
  }

  const code = payload?.error || 'authentication_failed';
  const retryAfterHeader = Number(response?.headers.get('retry-after') || 0);
  const retryAfter = Math.max(0, Number(payload?.retry_after || retryAfterHeader || 0));
  const gatewayError = new Error(gatewayErrorMessage(code, retryAfter)) as AuthGatewayError;
  gatewayError.code = code;
  gatewayError.retryAfter = retryAfter;
  gatewayError.status = response?.status;
  return gatewayError;
}

async function invokeAuthGateway(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gsa-auth-session', {
    body: { action, payload },
  });
  if (error) throw await createAuthGatewayError(error);
  return data as any;
}

function serializeLogin<T>(operation: () => Promise<T>): Promise<T> {
  const current = loginQueue.then(operation, operation);
  loginQueue = current.then(
    () => undefined,
    () => undefined,
  );
  return current;
}

async function clearSessionPair(rpcSession?: any): Promise<void> {
  const sessaoId = rpcSession?.sessao_id;
  const sessionToken = rpcSession?.session_token;

  try {
    if (sessaoId && sessionToken) {
      const { error } = await supabase.rpc('gsa_end_session', {
        p_sessao_id: sessaoId,
        p_session_token: sessionToken,
      });
      if (error) console.error('Falha ao revogar a sessão GSA inconsistente:', error);
    }
  } finally {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Falha ao limpar a sessão Supabase Auth inconsistente:', error);
    }
    clearStoredSession();
  }
}

async function synchronizeSupabaseAuth(
  rpcSession: any,
  useExistingAuthSession: boolean,
): Promise<void> {
  const tokenHash = rpcSession?.auth?.token_hash;
  if (tokenHash) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (error || !data.session) {
        console.warn('[sessionService] Supabase Auth verifyOtp aviso:', error?.message);
      }
    } catch (e) {
      console.warn('[sessionService] Falha ao sincronizar Supabase Auth em background:', e);
    }
  } else if (useExistingAuthSession) {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      console.warn('[sessionService] Refresh de sessão Supabase Auth:', e);
    }
  }
}

async function persistAuthenticatedSession(payload: any, useExistingAuthSession = false): Promise<StoredSession> {
  const rpcSession = payload?.session || payload;
  const sessaoId = rpcSession?.sessao_id;
  const sessionToken = rpcSession?.session_token;
  const atorTipo = rpcSession?.ator_tipo;
  const atorId = rpcSession?.ator_id;
  const atorNome = rpcSession?.ator_nome;
  if (!sessaoId || !sessionToken || !atorTipo || !atorId) {
    throw new Error('A autenticação não retornou uma sessão válida.');
  }

  const metadata = rpcSession?.metadata || {};
  const sessionData: StoredSession = {
    sessaoId,
    sessionToken,
    atorTipo,
    atorId,
    atorNome: atorNome || 'Usuário',
    ...metadata,
  };

  try {
    await synchronizeSupabaseAuth(rpcSession, useExistingAuthSession);
    writeStoredSession(sessionData);
    return sessionData;
  } catch {
    writeStoredSession(sessionData);
    return sessionData;
  }
}

async function authenticate(action: string, payload: Record<string, unknown>) {
  return serializeLogin(async () => {
    const data = await invokeAuthGateway(action, payload);
    if (data?.valid || data?.success) await persistAuthenticatedSession(data);
    return data;
  });
}

async function endStoredSession(): Promise<void> {
  if (endSessionPromise) return endSessionPromise;

  endSessionPromise = (async () => {
    try {
      const sessionData = readStoredSession();
      if (sessionData?.sessaoId && sessionData?.sessionToken) {
        const { error } = await supabase.rpc('gsa_end_session', {
          p_sessao_id: sessionData.sessaoId,
          p_session_token: sessionData.sessionToken,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Falha ao encerrar a sessão:', error);
    } finally {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (authData?.session) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch {
        // Ignora silenciosamente se não houver sessão do Supabase Auth
      }
      clearStoredSession();
    }
  })().finally(() => {
    endSessionPromise = null;
  });

  return endSessionPromise;
}

async function restoreStoredSession(): Promise<StoredSession | null> {
  try {
    const sessionData = readStoredSession();
    if (!sessionData?.sessaoId || !sessionData?.atorId || !sessionData?.sessionToken) {
      clearStoredSession();
      return null;
    }

    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session) {
      await supabase.auth.refreshSession().catch(() => {});
    }

    if (sessionData.atorTipo === 'cliente') {
      const { data: accessData, error: accessError } = await supabase.rpc('gsa_get_client_session_access_state', {
        p_sessao_id: sessionData.sessaoId,
        p_session_token: sessionData.sessionToken,
      });
      if (!accessError && (accessData as any)?.success) {
        sessionData.precisa_trocar_senha = (accessData as any).precisa_trocar_senha;
        writeStoredSession(sessionData);
      }
    } else if (sessionData.atorTipo === 'colaborador') {
      const { data: accessData, error: accessError } = await supabase.rpc('gsa_get_collaborator_session_access_state', {
        p_sessao_id: sessionData.sessaoId,
        p_session_token: sessionData.sessionToken,
      });
      const access = accessData as any;
      if (accessError || !access?.success || access.status !== 'ativo') {
        await endStoredSession();
        return null;
      }
      sessionData.atorNome = access.nome || sessionData.atorNome;
      sessionData.modulos = Array.isArray(access.modulos) ? access.modulos : [];
      writeStoredSession(sessionData);
    }

    return sessionData;
  } catch (error) {
    console.error('Falha ao restaurar a sessão:', error);
    return null;
  }
}

export const sessionService = {
  getCurrentSession() {
    return readStoredSession();
  },

  async loginWithPin(documento: string, pin: string, tipo: 'cliente' | 'prestador' | 'fornecedor') {
    const cleanDoc = documento.replace(/\D/g, '');
    const cleanPin = pin.trim();

    // Tentar primeiro via RPC direta para evitar bloqueios de CORS/500 em Edge Functions
    try {
      const { data, error } = await supabase.rpc('gsa_login_pin', {
        p_documento: cleanDoc,
        p_pin: cleanPin,
        p_tipo: tipo,
      });
      if (!error && data) {
        const res = data as any;
        if (res?.valid || res?.success) {
          await persistAuthenticatedSession(res);
        }
        return res;
      }
    } catch {
      // Se a RPC falhar ou não existir, tenta o Gateway via Edge Function
    }

    return await authenticate('login_pin', { documento: cleanDoc, pin: cleanPin, tipo });
  },

  async requestClientRecovery(documento: string, email: string) {
    return invokeAuthGateway('request_client_recovery', { documento, email });
  },

  async requestClientFirstAccess(documento: string, email: string) {
    return invokeAuthGateway('request_client_first_access', { documento, email });
  },

  async completeClientFirstAccess(challengeId: string, newPin: string) {
    return serializeLogin(async () => {
      const data = await invokeAuthGateway('complete_client_first_access', {
        challenge_id: challengeId,
        new_pin: newPin,
      });
      if (data?.success) await persistAuthenticatedSession(data, true);
      return data;
    });
  },

  async completeClientRecovery(recoveryId: string) {
    return serializeLogin(async () => {
      const data = await invokeAuthGateway('complete_client_recovery', { challenge_id: recoveryId });
      if (data?.success) await persistAuthenticatedSession(data, true);
      return data;
    });
  },

  async updateClientPin(newPin: string) {
    const sessionData = readStoredSession();
    if (!sessionData?.sessaoId || !sessionData?.sessionToken) {
      throw new Error('Sessão não encontrada');
    }
    const { data, error } = await supabase.rpc('gsa_update_client_pin', {
      p_sessao_id: sessionData.sessaoId,
      p_session_token: sessionData.sessionToken,
      p_new_pin: newPin,
    });
    if (error) throw error;
    if ((data as any)?.success) {
      sessionData.precisa_trocar_senha = false;
      writeStoredSession(sessionData);
    }
    return data as any;
  },

  async getClientSessionAccessState() {
    const sessionData = readStoredSession();
    if (!sessionData?.sessaoId || !sessionData?.sessionToken) return null;
    const { data, error } = await supabase.rpc('gsa_get_client_session_access_state', {
      p_sessao_id: sessionData.sessaoId,
      p_session_token: sessionData.sessionToken,
    });
    if (error || !(data as any)?.success) return null;
    return data as any;
  },

  async resolveAuthenticatedClientPersonType(clientId: string): Promise<ClientPersonType | null> {
    const sessionData = readStoredSession();
    if (sessionData?.atorTipo !== 'cliente' || sessionData.atorId !== clientId) return null;

    const { data, error } = await supabase
      .from('clientes')
      .select('tipo_pessoa')
      .eq('id', clientId)
      .maybeSingle();

    if (error || !data) return null;
    const personType: ClientPersonType = data.tipo_pessoa === 'pj' ? 'pj' : 'pf';
    sessionData.clientPersonType = personType;
    writeStoredSession(sessionData);
    return personType;
  },

  setClientPersonType(personType: ClientPersonType) {
    const sessionData = readStoredSession();
    if (sessionData?.atorTipo !== 'cliente') return;
    sessionData.clientPersonType = personType;
    writeStoredSession(sessionData);
  },

  async setPinAndLogin(
    documento: string,
    telefone: string,
    pin: string,
    tipo: 'cliente' | 'prestador',
  ) {
    const cleanDoc = documento.replace(/\D/g, '');
    const cleanContact = telefone.trim();

    try {
      return await authenticate('set_pin_and_login', {
        documento: cleanDoc,
        telefone: cleanContact,
        pin: pin.trim(),
        tipo,
      });
    } catch (edgeError: any) {
      console.warn('[sessionService] Edge Function set_pin_and_login retornou erro, tentando via RPC gsa_set_pin_and_login:', edgeError);
      // TODO: Remover fallback após Rate Limiting ser implementado nas RPCs
      const { data, error } = await supabase.rpc('gsa_set_pin_and_login', {
        p_documento: cleanDoc,
        p_telefone: cleanContact,
        p_pin: pin.trim(),
        p_tipo: tipo,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.valid || res?.success) {
        await persistAuthenticatedSession(res);
      }
      return res;
    }
  },

  async loginAdmin(code: string) {
    const cleanCode = code.trim();
    try {
      return await authenticate('login_admin', { code: cleanCode });
    } catch (edgeError: any) {
      console.warn('[sessionService] Edge Function login_admin falhou, tentando via RPC gsa_login_admin:', edgeError);
      // TODO: Remover fallback após Rate Limiting ser implementado nas RPCs
      const { data, error } = await supabase.rpc('gsa_login_admin', { p_code: cleanCode });
      if (error) throw error;
      const res = data as any;
      if (res?.valid || res?.success) {
        await persistAuthenticatedSession(res);
      }
      return res;
    }
  },

  async loginColaborador(code: string) {
    const cleanCode = code.trim();
    try {
      return await authenticate('login_colaborador', { code: cleanCode });
    } catch (edgeError: any) {
      console.warn('[sessionService] Edge Function login_colaborador falhou, tentando via RPC gsa_login_colaborador:', edgeError);
      // TODO: Remover fallback após Rate Limiting ser implementado nas RPCs
      const { data, error } = await supabase.rpc('gsa_login_colaborador', { p_code: cleanCode });
      if (error) throw error;
      const res = data as any;
      if (res?.valid || res?.success) {
        await persistAuthenticatedSession(res);
      }
      return res;
    }
  },

  async restoreSession() {
    if (!restoreSessionPromise) {
      restoreSessionPromise = restoreStoredSession().finally(() => {
        restoreSessionPromise = null;
      });
    }
    return restoreSessionPromise;
  },

  async endSession() {
    return endStoredSession();
  },

  async pingSession() {
    try {
      const sessionData = readStoredSession();
      if (!sessionData?.sessaoId || !sessionData?.sessionToken) return;
      const { data, error } = await supabase.rpc('gsa_ping_session', {
        p_sessao_id: sessionData.sessaoId,
        p_session_token: sessionData.sessionToken,
      });
      if (!error && data === false) {
        await endStoredSession();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gsa-session-revoked'));
      }
    } catch (error) {
      console.warn('Falha temporária no ping de sessão:', error);
    }
  },
};
