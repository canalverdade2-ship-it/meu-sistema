const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'CobrancaModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceFunction(name, replacement) {
  const marker = `  const ${name} = async`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Function not found: ${name}`);
  }

  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) {
    throw new Error(`Opening brace not found: ${name}`);
  }

  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
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

source = source.replace(
  "throw new Error('SessÃ£o administrativa expirada. FaÃ§a login novamente.');",
  "throw new Error('Sessao administrativa expirada. Faca login novamente.');"
);

replaceFunction('handleGerarCobrancaFatura', `  const handleGerarCobrancaFatura = async (fatura: any) => {
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_criar_cobranca_fatura', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_fatura_id: fatura.id
      });

      if (error) throw error;

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'GERAR_COBRANCA',
        detalhes: \`Cobranca gerada para a fatura \${fatura.codigo_fatura || fatura.id}.\`
      });

      if (data?.already_exists) {
        toast('Esta fatura ja esta na central de cobranca.', { icon: 'i' });
      } else {
        toast.success('Cobranca gerada com sucesso!');
      }

      fetchDados();
      fetchFaturasElegiveisCobranca();
      setActiveTab('fila');
    } catch (err: any) {
      console.error('Erro ao gerar cobranca:', err);
      toast.error(err?.message || 'Erro ao gerar cobranca.');
    }
  };`);

replaceFunction('confirmarWhatsApp', `  const confirmarWhatsApp = async () => {
    if (!selectedCobranca) return;
    const phoneNum = selectedCobranca.clientes?.telefone?.replace(/\\D/g, '') || '';

    if (!phoneNum || phoneNum.length < 10) {
      toast.error('O cliente nao possui um numero de WhatsApp valido cadastrado.');
      setIsWpModalOpen(false);
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_registrar_cobranca_historico', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: selectedCobranca.id,
        p_tipo_acao: 'contato_whatsapp',
        p_descricao: 'Mensagem de cobranca enviada via WhatsApp.',
        p_canal: 'whatsapp',
        p_atualizar_ultimo_contato: true
      });

      if (error) throw error;

      fetchDados();
      setIsWpModalOpen(false);

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'CONTATO_WHATSAPP_COBRANCA',
        detalhes: \`Mensagem WhatsApp enviada para \${selectedCobranca.clientes?.nome} (Ref: \${selectedCobranca.faturas?.codigo_fatura || selectedCobranca.id.slice(0, 8)})\`
      });

      const url = \`https://api.whatsapp.com/send?phone=55\${phoneNum}&text=\${encodeURIComponent(wpMessage)}\`;
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Erro ao registrar contato WhatsApp:', err);
      toast.error(err?.message || 'Erro ao registrar contato WhatsApp.');
    }
  };`);

replaceFunction('handleMudarStatusCobranca', `  const handleMudarStatusCobranca = async (cobranca: any, status: string, nivel: number = 1) => {
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_mudar_status_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: cobranca.id,
        p_status: status,
        p_nivel_cobranca: nivel
      });

      if (error) throw error;

      toast.success(\`Divida movida para \${status}!\`);
      setIsHistoricoModalOpen(false);
      setSelectedCobranca(null);

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'MUDAR_STATUS_COBRANCA',
        detalhes: \`Status da cobranca \${cobranca.id.slice(0, 8)} alterado para \${status} (Nivel \${nivel})\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao mudar status de cobranca:', err);
      toast.error(err?.message || 'Erro ao mudar status.');
    }
  };`);

replaceFunction('salvarHistoricoManual', `  const salvarHistoricoManual = async () => {
    if (!selectedCobranca || !novoHistorico.descricao) return;
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_registrar_cobranca_historico', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: selectedCobranca.id,
        p_tipo_acao: novoHistorico.tipo,
        p_descricao: novoHistorico.descricao,
        p_canal: 'manual',
        p_promessa_pagamento: novoHistorico.promessa_pagamento,
        p_data_promessa: novoHistorico.promessa_pagamento ? novoHistorico.data_promessa : null,
        p_valor_envolvido: null,
        p_atualizar_ultimo_contato: false
      });

      if (error) throw error;

      if (novoHistorico.promessa_pagamento) {
        await notificationService.notifyClient(
          selectedCobranca.cliente_id,
          'Promessa de Pagamento Registrada',
          \`Registramos sua promessa de pagamento para o dia \${formatDate(novoHistorico.data_promessa)}. Agradecemos o contato.\`,
          'financeiro',
          'cobranca_promessa',
          { itemId: selectedCobranca.fatura_id || selectedCobranca.id, tab: 'faturas' }
        );
      }

      toast.success('Historico registrado!');
      setNovoHistorico({ tipo: 'contato_telefonico', descricao: '', promessa_pagamento: false, data_promessa: '' });

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'REGISTRAR_HISTORICO_MANUAL_COBRANCA',
        detalhes: \`Log manual registrado para cobranca \${selectedCobranca.id.slice(0, 8)} - Tipo: \${novoHistorico.tipo}\`
      });

      fetchDados();
      const { data } = await supabase.from('cobrancas').select('*, cobranca_historico(*)').eq('id', selectedCobranca.id).single();
      if (data) setSelectedCobranca((prev: any) => ({ ...prev, cobranca_historico: data.cobranca_historico }));
    } catch (err: any) {
      console.error('Erro ao registrar historico:', err);
      toast.error(err?.message || 'Erro ao registrar historico.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
