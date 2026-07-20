import { supabase } from './supabase';

type StoredSession = {
  sessaoId: string;
  sessionToken?: string;
  atorTipo: string;
  atorId: string;
  atorNome: string;
  [key: string]: any;
};

const SESSION_STORAGE_KEY = '_gsa_session';

function getSessionStorage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
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
  getSessionStorage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  // Mantido apenas por compatibilidade com telas antigas. Não contém o token da sessão.
  localStorage.setItem('sessaoId', sessionData.sessaoId);
  localStorage.removeItem('_gsa_sess');
}

function clearStoredSession() {
  getSessionStorage()?.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem('sessaoId');
  localStorage.removeItem('_gsa_sess');
  localStorage.removeItem('lastPing');
}

async function invokeAuthGateway(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gsa-auth-session', {
    body: { action, payload },
  });
  if (error) throw new Error('Não foi possível concluir a autenticação.');
  return data as any;
}

async function persistAuthenticatedSession(payload: any): Promise<StoredSession> {
  const rpcSession = payload?.session || payload;
  const sessaoId = rpcSession?.sessao_id;
  const sessionToken = rpcSession?.session_token;
  const atorTipo = rpcSession?.ator_tipo;
  const atorId = rpcSession?.ator_id;
  const atorNome = rpcSession?.ator_nome;
  const tokenHash = rpcSession?.auth?.token_hash;

  if (!sessaoId || !sessionToken || !atorTipo || !atorId || !tokenHash) {
    throw new Error('A autenticação não retornou uma sessão válida.');
  }

  const { data: authData, error: authError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (authError || !authData.session || !authData.user) {
    await supabase.rpc('gsa_end_session', {
      p_sessao_id: sessaoId,
      p_session_token: sessionToken,
    });
    throw new Error(authError?.message || 'Não foi possível ativar a sessão segura do Supabase.');
  }

  const appMetadata = authData.user.app_metadata || {};
  if (
    appMetadata.gsa_session_id !== sessaoId ||
    appMetadata.gsa_actor_type !== atorTipo ||
    appMetadata.gsa_actor_id !== atorId
  ) {
    await supabase.auth.signOut({ scope: 'local' });
    await supabase.rpc('gsa_end_session', {
      p_sessao_id: sessaoId,
      p_session_token: sessionToken,
    });
    throw new Error('A identidade autenticada não corresponde à sessão GSA.');
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

  writeStoredSession(sessionData);
  return sessionData;
}

async function authenticate(action: string, payload: Record<string, unknown>) {
  const data = await invokeAuthGateway(action, payload);
  if (data?.valid || data?.success) await persistAuthenticatedSession(data);
  return data;
}

export const sessionService = {
  getCurrentSession() {
    return readStoredSession();
  },

  async loginWithPin(documento: string, pin: string, tipo: 'cliente' | 'prestador') {
    return authenticate('login_pin', { documento, pin, tipo });
  },

  async loginRecuperacaoSenha(documento: string, email: string) {
    return authenticate('recover_client', { documento, email });
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

  async setPinAndLogin(
    documento: string,
    telefone: string,
    pin: string,
    tipo: 'cliente' | 'prestador',
  ) {
    return authenticate('set_pin_and_login', { documento, telefone, pin, tipo });
  },

  async loginAdmin(code: string) {
    return authenticate('login_admin', { code });
  },

  async loginColaborador(code: string) {
    return authenticate('login_colaborador', { code });
  },

  async restoreSession() {
    try {
      const sessionData = readStoredSession();
      if (!sessionData?.sessaoId || !sessionData?.atorId || !sessionData?.sessionToken) {
        clearStoredSession();
        return null;
      }

      const { data: authData, error: authError } = await supabase.auth.getSession();
      const authSession = authData.session;
      const appMetadata = authSession?.user?.app_metadata || {};
      if (
        authError ||
        !authSession ||
        appMetadata.gsa_session_id !== sessionData.sessaoId ||
        appMetadata.gsa_actor_type !== sessionData.atorTipo ||
        appMetadata.gsa_actor_id !== sessionData.atorId
      ) {
        await this.endSession();
        return null;
      }

      const { data, error } = await supabase
        .rpc('gsa_validate_session', {
          p_sessao_id: sessionData.sessaoId,
          p_session_token: sessionData.sessionToken,
        })
        .single();

      if (error || !(data as any)?.is_valid) {
        await this.endSession();
        return null;
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
          await this.endSession();
          return null;
        }
        sessionData.atorNome = access.nome || sessionData.atorNome;
        sessionData.modulos = Array.isArray(access.modulos) ? access.modulos : [];
        writeStoredSession(sessionData);
      }

      return sessionData;
    } catch (error) {
      console.error('Falha ao restaurar a sessão:', error);
      clearStoredSession();
      return null;
    }
  },

  async endSession() {
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
      await supabase.auth.signOut({ scope: 'local' });
      clearStoredSession();
    }
  },

  async pingSession() {
    try {
      const sessionData = readStoredSession();
      if (!sessionData?.sessaoId || !sessionData?.sessionToken) return;
      const { data, error } = await supabase.rpc('gsa_ping_session', {
        p_sessao_id: sessionData.sessaoId,
        p_session_token: sessionData.sessionToken,
      });
      if (error || (data as any)?.is_valid === false || (data as any)?.success === false) {
        await this.endSession();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gsa-session-revoked'));
      }
    } catch (error) {
      console.error('Falha ao atualizar a sessão:', error);
    }
  },
};
