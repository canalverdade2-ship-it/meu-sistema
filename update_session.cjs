const fs = require('fs');
let c = fs.readFileSync('src/lib/sessionService.ts', 'utf8');

const newMethods = `  async loginRecuperacaoSenha(documento: string, email: string) {
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
`;

c = c.replace('async setPinAndLogin(', newMethods + '\n  async setPinAndLogin(');
fs.writeFileSync('src/lib/sessionService.ts', c);
console.log('sessionService updated');
