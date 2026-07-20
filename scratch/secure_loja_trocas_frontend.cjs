const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'LojaTrocasModule.tsx');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("import { sessionService } from '../../lib/sessionService';")) {
  src = src.replace(
    "import { notificationService } from '../../lib/notificationService';",
    "import { notificationService } from '../../lib/notificationService';\nimport { sessionService } from '../../lib/sessionService';"
  );
}

if (!src.includes('const getAdminSessionForRpc = () => {')) {
  src = src.replace(
    "  const [rastreioAdminInput, setRastreioAdminInput] = useState('');\n",
    `  const [rastreioAdminInput, setRastreioAdminInput] = useState('');

  const getAdminSessionForRpc = () => {
    const session = sessionService.getCurrentSession();
    if (!session?.sessaoId || !session?.sessionToken) {
      throw new Error('Sessao administrativa expirada. Faca login novamente.');
    }
    return session;
  };
`
  );
}

const start = src.indexOf("  const handleUpdateStatus = async (newStatus: 'em_analise' | 'aprovado' | 'rejeitado' | 'concluido') => {");
const end = src.indexOf('  const handleUpdateAdvancedStatus = async', start);
if (start === -1 || end === -1) throw new Error('handleUpdateStatus block not found.');

const replacement = `  const handleUpdateStatus = async (newStatus: 'em_analise' | 'aprovado' | 'rejeitado' | 'concluido') => {
    if (!selectedSolicitacao) return;

    setUpdatingStatus(true);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_solicitacao_loja', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedSolicitacao.id,
        p_novo_status: newStatus,
        p_resposta_admin: resolucaoInput || selectedSolicitacao.resposta_admin || null
      });

      if (error) throw error;

      const statusToSave = data?.status || newStatus;
      const diffValue = Number(data?.valor_diferenca || selectedSolicitacao.valor_diferenca || 0);
      const codigoOrcamento = data?.codigo_orcamento || '';
      const totalOrcamento = Number(data?.total_orcamento || 0);

      if (newStatus === 'aprovado' && data?.fatura_diferenca_id) {
        const vencimentoDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const vencimentoStr = vencimentoDate.toISOString().split('T')[0];

        await notificationService.notifyClient(
          selectedSolicitacao.cliente_id,
          'Fatura de Diferenca de Troca Gerada',
          \`Sua solicitacao de troca foi aprovada! Foi gerada uma fatura de R$ \${diffValue.toFixed(2)} correspondente a diferenca de valor, com vencimento para \${formatDate(vencimentoStr)}.\`,
          'gsa_store',
          'fatura_gerada',
          { tab: 'acompanhar', itemId: selectedSolicitacao.id, prioridade: 'alta' }
        );
      }

      if (newStatus === 'aprovado' && data?.credito_estornado) {
        await notificationService.notifyClient(
          selectedSolicitacao.cliente_id,
          'Limite de Credito Restaurado (Troca/Devolucao)',
          \`Sua solicitacao de \${selectedSolicitacao.tipo} para o pedido #\${codigoOrcamento} foi aprovada e o valor de R$ \${totalOrcamento.toFixed(2)} foi estornado para o seu limite de credito disponivel.\`,
          'gsa_store',
          'credito_estornado',
          { tab: 'acompanhar', itemId: selectedSolicitacao.id, prioridade: 'normal' }
        );
      }

      toast.success('Solicitacao atualizada com sucesso.');
      await logService.logAction({
        acao: 'ATUALIZAR_SOLICITACAO_LOJA',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        ator_id: colaboradorId,
        detalhes: \`Atualizou a solicitacao de \${(selectedSolicitacao as any).clientes?.nome} para status: \${statusToSave}\`
      });
      setIsDetailOpen(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao atualizar solicitacao.');
    } finally {
      setUpdatingStatus(false);
    }
  };

`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, src, 'utf8');
