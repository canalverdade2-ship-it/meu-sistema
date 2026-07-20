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

replaceFunction('confirmarGerarAcordo', `  const confirmarGerarAcordo = async () => {
    if (!selectedCobranca || !acordoData.parcelas || !acordoData.dtPrimeiroVenc || submittingAcordo) return;
    setSubmittingAcordo(true);
    try {
      const valorDesconto = acordoData.tipo_desconto === 'porcentagem'
        ? (selectedCobranca.valor_atualizado * (acordoData.desconto / 100))
        : (acordoData.desconto || 0);
      const valorBase = selectedCobranca.valor_atualizado - valorDesconto;
      const valorParcela = Math.round((valorBase / acordoData.parcelas) * 100) / 100;
      const session = getAdminSessionForRpc();

      const { data, error } = await supabase.rpc('gsa_admin_gerar_acordo_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: selectedCobranca.id,
        p_parcelas: acordoData.parcelas,
        p_dt_primeiro_venc: acordoData.dtPrimeiroVenc,
        p_desconto: acordoData.desconto || 0,
        p_tipo_desconto: acordoData.tipo_desconto,
        p_observacoes: acordoData.observacoes || null
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedCobranca.cliente_id,
        'Novo Acordo de Parcelamento',
        \`Um acordo de \${acordoData.parcelas}x foi gerado para sua divida. Confira as faturas no seu painel financeiro.\`,
        'financeiro',
        'cobranca_acordo',
        { itemId: selectedCobranca.fatura_id || selectedCobranca.id, tab: 'faturas', prioridade: 'alta' }
      );

      toast.success(data?.already_processed ? 'Acordo ja estava gerado.' : 'Acordo gerado com sucesso!');
      setIsAcordoModalOpen(false);
      setIsHistoricoModalOpen(false);
      setSelectedCobranca(null);

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'GERAR_ACORDO_COBRANCA',
        detalhes: \`Acordo gerado para \${selectedCobranca.clientes?.nome || selectedCobranca.cliente_id}: \${acordoData.parcelas}x de \${formatCurrency(valorParcela)} (base: \${formatCurrency(valorBase)})\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao gerar acordo:', err);
      toast.error(err?.message || 'Erro ao gerar acordo.');
    } finally {
      setSubmittingAcordo(false);
    }
  };`);

replaceFunction('handleCancelarAcordo', `  const handleCancelarAcordo = async (c: any) => {
    if (!window.confirm('Deseja realmente CANCELAR este acordo? As faturas das parcelas pendentes serao canceladas e a divida original sera reativada.')) return;

    try {
      const session = getAdminSessionForRpc();
      const faturaDescricaoOriginal = c.faturas?.codigo_fatura || c.fatura_id?.substring(0, 8) || '';
      const { error } = await supabase.rpc('gsa_admin_cancelar_acordo_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: c.id
      });

      if (error) throw error;

      toast.success('Acordo cancelado e divida original reativada.');

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'CANCELAR_ACORDO_COBRANCA',
        detalhes: \`Acordo do cliente \${c.clientes?.nome || c.cliente_id} (Ref: \${faturaDescricaoOriginal}) cancelado manualmente.\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao cancelar acordo:', err);
      toast.error(err?.message || 'Erro ao cancelar acordo.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
