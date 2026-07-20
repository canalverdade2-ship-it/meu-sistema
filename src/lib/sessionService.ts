import { supabase } from './supabase';

type StoredSession = {
  sessaoId: string;
  sessionToken?: string;
  atorTipo: string;
  atorId: string;
  atorNome: string;
  [key: string]: any;
};

function readStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem('_gsa_sess');
    if (!stored) return null;
    return JSON.parse(atob(stored));
  } catch {
    return null;
  }
}

function writeStoredSession(sessionData: StoredSession) {
  localStorage.setItem('_gsa_sess', btoa(JSON.stringify(sessionData)));
  localStorage.setItem('sessaoId', sessionData.sessaoId);
}

function clearStoredSession() {
  localStorage.removeItem('sessaoId');
  localStorage.removeItem('_gsa_sess');
  localStorage.removeItem('lastPing');
}

async function persistAuthenticatedSession(payload: any): Promise<StoredSession> {
  const rpcSession = payload?.session || payload;
  const sessaoId = rpcSession?.sessao_id;
  const sessionToken = rpcSession?.session_token;
  const atorTipo = rpcSession?.ator_tipo;
  const atorId = rpcSession?.ator_id;
  const atorNome = rpcSession?.ator_nome;

  if (!sessaoId || !sessionToken || !atorTipo || !atorId) {
    throw new Error('A autenticação não retornou uma sessão válida.');
  }

  const authEmail = rpcSession?.auth?.email;
  const authPassword = rpcSession?.auth?.password;
  if (!authEmail || !authPassword) {
    throw new Error('A autenticação segura do Supabase não foi provisionada.');
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: authPassword,
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

export const sessionService = {
  getCurrentSession() {
    return readStoredSession();
  },

  async lookupPortalAccount(documento: string, tipo: 'cliente' | 'prestador') {
    const { data, error } = await supabase.rpc('gsa_lookup_portal_account', {
      p_documento: documento,
      p_tipo: tipo,
    });
    if (error) throw error;
    return data as any;
  },

  async loginWithPin(documento: string, pin: string, tipo: 'cliente' | 'prestador') {
    const { data, error } = await supabase.rpc('gsa_login_pin', {
      p_documento: documento,
      p_pin: pin,
      p_tipo: tipo,
    });
    if (error) throw error;
    if ((data as any)?.valid) await persistAuthenticatedSession(data);
    return data as any;
  },

    async loginRecuperacaoSenha(documento: string, email: string) {
    const { data, error } = await supabase.rpc('gsa_recuperar_senha_cliente', {
      p_documento: documento,
      p_email: email,
    });
    if (error) throw error;
    if ((data as any)?.success) await persistAuthenticatedSession(data);
    return data as any;
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
      p_session_token: sessionData.sessionToken
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
    const { data, error } = await supabase.rpc('gsa_set_pin_and_login', {
      p_documento: documento,
      p_telefone: telefone,
      p_pin: pin,
      p_tipo: tipo,
    });
    if (error) throw error;
    if ((data as any)?.success) await persistAuthenticatedSession(data);
    return data as any;
  },

  async loginAdmin(code: string) {
    const { data, error } = await supabase.rpc('gsa_login_admin', { p_code: code });
    if (error) throw error;
    if ((data as any)?.valid) await persistAuthenticatedSession(data);
    return data as any;
  },

  async loginColaborador(code: string) {
    const { data, error } = await supabase.rpc('gsa_login_colaborador', { p_code: code });
    if (error) throw error;
    if ((data as any)?.valid) await persistAuthenticatedSession(data);
    return data as any;
  },

  /**
   * Restores session from localStorage and validates it against the DB.
   */
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
          p_session_token: sessionData.sessionToken
        })
        .single();

      if (error || !(data as any)?.is_valid) {
        await this.endSession();
        return null;
      }

      // Check access state specifically for recovery
      if (sessionData.atorTipo === 'cliente') {
        const { data: accessData, error: accessError } = await supabase.rpc('gsa_get_client_session_access_state', {
          p_sessao_id: sessionData.sessaoId,
          p_session_token: sessionData.sessionToken
        });
        if (!accessError && (accessData as any)?.success) {
          sessionData.precisa_trocar_senha = (accessData as any).precisa_trocar_senha;
          writeStoredSession(sessionData); // override local with DB truth
        }
      }

      return sessionData;
    } catch (err) {
      console.error('Failed to restore session:', err);
      clearStoredSession();
      return null;
    }
  },

  /**
   * Finishes current session cleanly.
   */
  async endSession() {
    try {
      const sessionData = readStoredSession();
      if (sessionData?.sessaoId && sessionData?.sessionToken) {
        const { error } = await supabase.rpc('gsa_end_session', {
          p_sessao_id: sessionData.sessaoId,
          p_session_token: sessionData.sessionToken
        });

        if (error) throw error;
      }
    } catch (err) {
      console.error('Failed to end session:', err);
    } finally {
      await supabase.auth.signOut({ scope: 'local' });
      clearStoredSession();
    }
  },

  /**
   * Pings the server to update internal timer.
   */
  async pingSession() {
    try {
      const sessionData = readStoredSession();
      if (!sessionData?.sessaoId || !sessionData?.sessionToken) return;

      await supabase.rpc('gsa_ping_session', {
        p_sessao_id: sessionData.sessaoId,
        p_session_token: sessionData.sessionToken
      });
    } catch (err) {
      console.error('Failed to ping session:', err);
    }
  }
};
