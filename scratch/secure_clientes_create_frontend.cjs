const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'ClientesModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceFunction(name, replacement) {
  const marker = `  const ${name} = async`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0 && ch === '}') {
      let end = i + 1;
      while (source[end] === ';' || source[end] === '\r' || source[end] === '\n') end++;
      source = source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
      return;
    }
  }
  throw new Error(`Closing brace not found: ${name}`);
}

replaceFunction('handleCreate', `  const handleCreate = async (formData: any) => {
    if (formData.telefone) {
      const cleanPhone = formData.telefone.replace(/\\D/g, '');
      if (cleanPhone.length !== 11) {
        return toast.error('O telefone deve conter exatamente 11 numeros (DDD + 9 digitos).');
      }
    }

    const cleanDoc = formData.tipo_pessoa === 'pf' ? formData.cpf.replace(/\\D/g, '') : formData.cnpj.replace(/\\D/g, '');

    if (formData.tipo_pessoa === 'pf' && cleanDoc.length !== 11) {
      return toast.error('O CPF deve conter exatamente 11 numeros.');
    }
    if (formData.tipo_pessoa === 'pj' && cleanDoc.length !== 14) {
      return toast.error('O CNPJ deve conter exatamente 14 numeros.');
    }

    const now = new Date();
    const selectedDate = new Date(formData.data_cadastro);
    const finalDataCadastro = (selectedDate.toDateString() === now.toDateString())
      ? now.toISOString()
      : formData.data_cadastro;

    const payload: any = {
      ...formData,
      data_cadastro: finalDataCadastro,
      telefone: formData.telefone?.replace(/\\D/g, '') || '',
      cpf: formData.tipo_pessoa === 'pf' ? cleanDoc : '',
      cnpj: formData.tipo_pessoa === 'pj' ? cleanDoc : ''
    };

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_criar_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_payload: payload
      });

      if (error) throw error;

      const clienteId = data?.cliente_id;
      const indicacaoId = data?.indicacao_id;

      toast.success('Cliente cadastrado com sucesso.');

      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'CRIAR_CLIENTE',
        detalhes: \`Cadastrou o cliente: \${formData.nome} (\${formData.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}: \${cleanDoc})\`
      });

      if (clienteId) {
        await notificationService.notifyClient(
          clienteId,
          'Bem-vindo(a)!',
          'Seu cadastro foi criado com sucesso. Bem-vindo(a) ao portal!',
          'dashboard',
          'cadastro_criado',
          { tab: 'perfil' }
        );
      }

      if (indicacaoId && clienteId) {
        try {
          const refSettings = await fetchReferralSettings();
          if (includesPontosIndicado(refSettings.indicado_tipo) && refSettings.indicado_valor_pontos > 0) {
            await processGamificationPointsManual(
              clienteId,
              refSettings.indicado_valor_pontos,
              'Bonus de indicacao - bem-vindo(a)!',
              'indicacao',
              undefined,
              true
            );
            await createNotification(
              clienteId,
              'Pontos de Boas-vindas!',
              \`Voce recebeu \${refSettings.indicado_valor_pontos} pontos como recompensa por ser indicado. Aproveite!\`,
              'pontos'
            );
          }
        } catch (err) {
          console.error('[Referral] Erro ao creditar pontos ao indicado:', err);
        }

        toast.success('Indicacao vinculada a este novo cadastro!');
      }

      setIsModalOpen(false);
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error(error.message || 'Erro ao cadastrar cliente.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
