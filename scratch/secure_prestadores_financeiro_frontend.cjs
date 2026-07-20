const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'prestadores', 'PrestadoresFinanceiro.tsx');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("import { sessionService } from '../../../lib/sessionService';")) {
  src = src.replace(
    "import { logService } from '../../../lib/logService';",
    "import { logService } from '../../../lib/logService';\nimport { sessionService } from '../../../lib/sessionService';"
  );
}

if (!src.includes('const getAdminSessionForRpc = () => {')) {
  src = src.replace(
    "  const [highlightedId, setHighlightedId] = useState<string | null>(null);\n",
    `  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

function replaceFunction(name, nextName, body) {
  const start = src.indexOf(`  const ${name} = async`);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  const end = src.indexOf(`  const ${nextName} =`, start);
  if (end === -1) throw new Error(`Next function not found after ${name}: ${nextName}`);
  src = src.slice(0, start) + body.trimEnd() + '\n\n' + src.slice(end);
}

function replaceUntil(name, endMarker, body) {
  const start = src.indexOf(`  const ${name} = async`);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`End marker not found after ${name}: ${endMarker}`);
  src = src.slice(0, start) + body.trimEnd() + '\n\n' + src.slice(end);
}

replaceFunction('confirmAprovarSaque', 'handleRejeitarSaque', `  const confirmAprovarSaque = async () => {
    const saque = confirmModal.saque;
    if (!saque || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_processar_saque_prestador', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_saque_id: saque.id,
        p_acao: 'aprovar',
        p_motivo: null,
        p_data_pagamento: confirmModal.paymentDate
      });

      if (error) throw error;

      if (!data?.already_processed) {
        await notificationService.notifyProvider(
          saque.prestador_id,
          'Saque Realizado com Sucesso',
          \`Seu saque no valor de \${formatCurrency(saque.valor)} foi pago.\`,
          'financeiro',
          'prestador_saque_pago',
          { itemId: saque.id, tab: 'historico' }
        );
      }

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'APROVAR_SAQUE_PRESTADOR',
        detalhes: \`Aprovou e pagou saque de \${formatCurrency(saque.valor)} para o prestador \${saque.prestador?.nome_razao}\`
      });

      toast.success(data?.already_processed ? 'Saque ja estava marcado como pago.' : 'Saque aprovado e marcado como pago!');
      fetchSaques();
      setConfirmModal({ isOpen: false, saque: null, type: 'approve', reason: '', paymentDate: new Date().toISOString().split('T')[0] });
      setIsDetailsModalOpen(false);
      setSelectedSaque(null);
    } catch (error: any) {
      console.error('Erro ao aprovar saque:', error);
      toast.error(error.message || 'Erro ao aprovar saque.');
    } finally {
      setIsSubmitting(false);
    }
  };
`);

replaceUntil('confirmRejeitarSaque', '  return (', `  const confirmRejeitarSaque = async () => {
    const { saque, reason } = confirmModal;
    if (!saque || isSubmitting) return;
    if (!reason.trim()) {
      toast.error('Informe o motivo da rejeicao.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_processar_saque_prestador', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_saque_id: saque.id,
        p_acao: 'rejeitar',
        p_motivo: reason,
        p_data_pagamento: null
      });

      if (error) throw error;

      if (!data?.already_processed) {
        await notificationService.notifyProvider(
          saque.prestador_id,
          'Solicitacao de Saque Recusada',
          \`Sua solicitacao de saque no valor de \${formatCurrency(saque.valor)} foi recusada. Motivo: \${reason}\`,
          'financeiro',
          'prestador_saque_recusado',
          { itemId: saque.id, tab: 'historico' }
        );
      }

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'REJEITAR_SAQUE_PRESTADOR',
        detalhes: \`Rejeitou saque de \${formatCurrency(saque.valor)} para o prestador \${saque.prestador?.nome_razao}. Motivo: \${reason}\`
      });

      toast.success(data?.already_processed ? 'Saque ja estava recusado.' : 'Saque recusado e valor estornado para a carteira do prestador.');
      fetchSaques();
      setConfirmModal({ isOpen: false, saque: null, type: 'approve', reason: '', paymentDate: new Date().toISOString().split('T')[0] });
      setIsDetailsModalOpen(false);
      setSelectedSaque(null);
    } catch (error: any) {
      console.error('Erro ao rejeitar saque:', error);
      toast.error(error.message || 'Erro ao rejeitar saque.');
    } finally {
      setIsSubmitting(false);
    }
  };
`);

fs.writeFileSync(file, src, 'utf8');
