const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'FinanceiroModule.tsx');
let src = fs.readFileSync(file, 'utf8');

function replaceBetween(startMarker, endMarker, replacement) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`Start marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`End marker not found after ${startMarker}: ${endMarker}`);
  src = src.slice(0, start) + replacement.trimEnd() + '\n\n' + src.slice(end);
}

replaceBetween(
  '  const handleCreateFatura = async () => {',
  '  const handleGerarOrdemFiscal = async',
  `  const handleCreateFatura = async () => {
    const { cliente_id, valor_total, data_vencimento, data_emissao, descricao, os_id, ordem_compra_id, ordem_assinatura_id, categoria } = newFaturaData;

    if (!cliente_id || !valor_total || !data_vencimento || !data_emissao) {
      toast.error('Preencha os campos obrigatorios.');
      return;
    }

    if (!os_id && !ordem_compra_id && !ordem_assinatura_id && !descricao.trim()) {
      toast.error('Informe a descricao para faturas sem vinculo.');
      return;
    }

    setIsCreatingFatura(true);
    try {
      const cleanValue = valor_total.replace(/[^\\d]/g, '');
      const faturaValorNumerico = Number(cleanValue) / 100;

      if (isNaN(faturaValorNumerico) || faturaValorNumerico <= 0) {
        toast.error('O valor da fatura deve ser maior que zero.');
        setIsCreatingFatura(false);
        return;
      }

      const descricaoFatura = descricao || (
        os_id ? \`Servico Prestado (OS: \${availableOrders.os.find(o => o.id === os_id)?.codigo_os})\` :
        ordem_compra_id ? \`Produto Adquirido (OC: \${availableOrders.oc.find(o => o.id === ordem_compra_id)?.codigo_ordem})\` :
        ordem_assinatura_id ? \`Assinatura Ativa (OA: \${availableOrders.oa.find(o => o.id === ordem_assinatura_id)?.codigo_ordem})\` :
        'Venda Geral'
      );

      const session = getAdminSessionForRpc();
      const { data: faturaData, error: faturaError } = await supabase.rpc('gsa_admin_criar_fatura_manual', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente_id,
        p_valor_total: faturaValorNumerico,
        p_data_vencimento: data_vencimento,
        p_data_emissao: data_emissao,
        p_descricao: descricaoFatura,
        p_os_id: os_id || null,
        p_ordem_compra_id: ordem_compra_id || null,
        p_ordem_assinatura_id: ordem_assinatura_id || null,
        p_categoria: categoria || 'servico'
      });

      if (faturaError) throw faturaError;
      const faturaId = faturaData?.fatura_id;
      const codigo = faturaData?.codigo_fatura || 'FAT';

      toast.success('Fatura criada com sucesso!');
      setIsCreateModalOpen(false);

      setNewFaturaData({
        cliente_id: '', os_id: '', ordem_compra_id: '', ordem_assinatura_id: '',
        valor_total: '', data_vencimento: new Date().toISOString().split('T')[0],
        data_emissao: new Date().toISOString().split('T')[0],
        descricao: '',
        categoria: 'servico'
      });

      fetchFaturas(activeTab, searchRef.current, filtersRef.current);

      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'CRIAR_FATURA',
        detalhes: \`Criou a fatura #\${codigo} no valor de \${formatCurrency(faturaValorNumerico)} para o cliente \${cliente_id}\`
      });

      await notificationService.notifyClient(
        cliente_id,
        'Nova Fatura Gerada!',
        \`Uma nova fatura no valor de \${formatCurrency(faturaValorNumerico)} foi gerada para voce. Vencimento: \${formatDate(data_vencimento)}.\`,
        'financeiro',
        'fatura_gerada',
        { itemId: faturaId, contexto: { valor: faturaValorNumerico, vencimento: data_vencimento } }
      );

      await createNotification(
        cliente_id,
        'Nova Fatura Gerada!',
        \`Uma nova fatura no valor de \${formatCurrency(faturaValorNumerico)} foi gerada para voce!\`,
        'financeiro',
        'faturas',
        faturaId
      );
    } catch (error: any) {
      console.error('Erro ao criar fatura:', error);
      toast.error(error?.message || 'Erro ao criar fatura.');
    } finally {
      setIsCreatingFatura(false);
    }
  };

`
);

replaceBetween(
  '  const handleAplicarAjuste = async () => {',
  '  const handleSendFaturaWithPDF = async',
  `  const handleAplicarAjuste = async () => {
    const desconto = parseFloat(ajusteDesconto) || 0;
    const acrescimo = parseFloat(ajusteAcrescimo) || 0;
    if (!ajusteMotivo.trim()) return toast.error('Informe o motivo do ajuste.');
    if (desconto < 0 || acrescimo < 0) return toast.error('Os valores nao podem ser negativos.');
    setAplicandoAjuste(true);
    try {
      const session = sessionService.getCurrentSession();
      if (!session?.sessaoId || !session?.sessionToken) {
        throw new Error('Sessao administrativa expirada. Faca login novamente.');
      }

      const { data, error } = await supabase.rpc('gsa_admin_aplicar_ajuste_fatura', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_fatura_id: fatura.id,
        p_desconto: desconto,
        p_acrescimo: acrescimo,
        p_motivo: ajusteMotivo.trim()
      });

      if (error) throw error;

      const novoTotal = Number(data?.valor_total ?? 0);
      const baseOriginal = Number(data?.valor_base_original ?? fatura.valor_base_original ?? fatura.valor_total);
      const novoHistorico = data?.historico_ajustes || fatura.historico_ajustes || [];

      await createNotification(
        fatura.cliente_id,
        'Fatura Atualizada',
        \`O valor da sua fatura #\${fatura.codigo_fatura} foi ajustado para \${formatCurrency(novoTotal)}. Motivo: \${ajusteMotivo.trim()}\`,
        'financeiro',
        'faturas',
        fatura.id,
        'ajuste_fatura'
      );

      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: (window as any).colaborador_id,
        ator_nome: (window as any).colaborador_nome,
        acao: 'AJUSTE_FINANCEIRO_MANUAL',
        detalhes: \`Ajuste manual na fatura \${fatura.codigo_fatura}: Novo valor \${formatCurrency(novoTotal)}. Desconto: \${formatCurrency(desconto)}, Acrescimo: \${formatCurrency(acrescimo)}. Motivo: \${ajusteMotivo.trim()}\`
      });

      toast.success(\`Ajuste aplicado! Novo valor: \${formatCurrency(novoTotal)}\`);
      fatura.valor_total = novoTotal;
      fatura.desconto_manual = desconto;
      fatura.acrescimo_manual = acrescimo;
      fatura.valor_base_original = baseOriginal;
      fatura.historico_ajustes = novoHistorico;
      setAjusteMotivo('');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao aplicar ajuste.');
    } finally {
      setAplicandoAjuste(false);
    }
  };

`
);

fs.writeFileSync(file, src, 'utf8');
