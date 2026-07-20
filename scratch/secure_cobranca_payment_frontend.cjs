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

source = source.replace("import { processPromotionUsage } from '../../utils/promotions';\n", '');

replaceFunction('confirmarBaixaParcela', `  const confirmarBaixaParcela = async () => {
    if (!parcelaSelecionada || parcelaLoading) return;
    setParcelaLoading(parcelaSelecionada.id);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_baixar_parcela_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_parcela_id: parcelaSelecionada.id,
        p_data_pagamento: baixaData.data_pagamento,
        p_forma_pagamento: baixaData.forma_pagamento
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedCobranca.cliente_id,
        'Pagamento de Parcela Confirmado',
        \`Confirmamos o recebimento da parcela \${parcelaSelecionada.numero_parcela} via \${baixaData.forma_pagamento.toUpperCase()}.\`,
        'financeiro',
        'cobranca_pagamento',
        { itemId: data?.fatura_id || selectedCobranca.fatura_id || selectedCobranca.id, tab: 'faturas' }
      );

      toast.success(data?.already_processed ? 'Parcela ja estava baixada.' : 'Parcela baixada com sucesso!');
      setIsBaixaParcelaOpen(false);
      setParcelaSelecionada(null);

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'BAIXA_PARCELA_COBRANCA',
        detalhes: \`Parcela \${parcelaSelecionada.numero_parcela} da cobranca \${data?.cobranca_id?.slice?.(0, 8) || '?'} baixada. Valor: \${formatCurrency(parcelaSelecionada.valor_parcela)}\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao baixar parcela:', err);
      toast.error(err?.message || 'Erro ao baixar parcela.');
    } finally {
      setParcelaLoading(null);
    }
  };`);

replaceFunction('confirmarBaixaManualCobranca', `  const confirmarBaixaManualCobranca = async () => {
    if (!selectedCobranca) return;
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_baixar_cobranca_manual', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: selectedCobranca.id,
        p_valor_pago: baixaCobrancaData.valor_pago,
        p_data_pagamento: baixaCobrancaData.data_pagamento,
        p_forma_pagamento: baixaCobrancaData.forma_pagamento
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedCobranca.cliente_id,
        'Divida Quitada com Sucesso',
        \`A baixa do seu titulo (Ref: \${selectedCobranca.faturas?.codigo_fatura || 'Divida'}) foi realizada com sucesso. Obrigado!\`,
        'financeiro',
        'cobranca_quitacao',
        { itemId: selectedCobranca.fatura_id || selectedCobranca.id, tab: 'faturas', prioridade: 'alta' }
      );

      toast.success(data?.already_processed ? 'Cobranca ja estava quitada.' : 'Baixa manual concluida e cliente notificado!');
      setIsBaixaCobrancaOpen(false);
      setIsHistoricoModalOpen(false);

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'BAIXA_MANUAL_COBRANCA',
        detalhes: \`Baixa manual da cobranca \${selectedCobranca.id.slice(0, 8)} (\${selectedCobranca.clientes?.nome || 'cliente'}). Valor pago: \${formatCurrency(baixaCobrancaData.valor_pago)} via \${baixaCobrancaData.forma_pagamento.toUpperCase()}\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao registrar baixa manual:', err);
      toast.error(err?.message || 'Erro ao registrar baixa manual.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
