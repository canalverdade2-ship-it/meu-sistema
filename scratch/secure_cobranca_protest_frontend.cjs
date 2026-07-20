const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'CobrancaModule.tsx');
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

replaceFunction('confirmarProtesto', `  const confirmarProtesto = async () => {
    if (!selectedCobranca || !protestoData.data_protesto || !protestoData.nome_cartorio) {
      toast.error('Preencha todos os campos do protesto.');
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const faturaDescricaoOriginal = selectedCobranca.faturas?.codigo_fatura || selectedCobranca.fatura_id?.substring(0, 8);
      const { data, error } = await supabase.rpc('gsa_admin_protestar_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: selectedCobranca.id,
        p_data_protesto: protestoData.data_protesto,
        p_nome_cartorio: protestoData.nome_cartorio
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedCobranca.cliente_id,
        'ALERTA: Titulo Protestado',
        \`Sua divida (Ref: \${faturaDescricaoOriginal || selectedCobranca.id.slice(0, 8)}) foi encaminhada para o cartorio \${protestoData.nome_cartorio}. Entre em contato urgente com a assessoria.\`,
        'financeiro',
        'cobranca_protesto',
        { itemId: data?.fatura_id || selectedCobranca.fatura_id || selectedCobranca.id, tab: 'faturas', prioridade: 'urgente' }
      );

      toast.success(data?.already_processed ? 'Titulo ja estava protestado.' : 'Titulo protestado e fatura agrupada gerada.');
      setIsProtestoModalOpen(false);
      setSelectedCobranca(null);
      setProtestoData({ data_protesto: new Date().toISOString().split('T')[0], nome_cartorio: '' });

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'PROTESTAR_DIVIDA',
        detalhes: \`Divida de \${selectedCobranca.clientes?.nome || selectedCobranca.cliente_id} protestada no cartorio \${protestoData.nome_cartorio}. Valor: \${formatCurrency(selectedCobranca.valor_atualizado)}\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao registrar protesto:', err);
      toast.error(err?.message || 'Erro ao registrar protesto e agrupar divida.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
