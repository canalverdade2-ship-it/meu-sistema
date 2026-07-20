const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'EmprestimosModule.tsx');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("import { sessionService } from '../../lib/sessionService';")) {
  src = src.replace(
    "import { maskCPF, maskPhone, maskCurrency, handleCurrencyInputChange } from '../../lib/utils';",
    "import { maskCPF, maskPhone, maskCurrency, handleCurrencyInputChange } from '../../lib/utils';\nimport { sessionService } from '../../lib/sessionService';"
  );
}

if (!src.includes('const getAdminSessionForRpc = () => {')) {
  src = src.replace(
    "  const [documentos, setDocumentos] = useState<any[]>([]);\n",
    `  const [documentos, setDocumentos] = useState<any[]>([]);

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
  const start = src.indexOf(`  const ${name} = `);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  const end = src.indexOf(`  const ${nextName} = `, start);
  if (end === -1) throw new Error(`Next function not found after ${name}: ${nextName}`);
  src = src.slice(0, start) + body.trimEnd() + '\n\n' + src.slice(end);
}

replaceFunction('saveObs', 'sendMsg', `  const saveObs = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_salvar_observacao', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_observacoes_admin: obs
      });
      if (error) throw error;

      toast.success('Observacao salva!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      refreshDetail(selected.id);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar observacao.');
    }
  };
`);

replaceFunction('sendMsg', 'enviarProposta', `  const sendMsg = async () => {
    if (!newMsg.trim() || !selected) return;
    const msg = newMsg;
    setNewMsg('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const session = getAdminSessionForRpc();
      const { data: rpcData, error } = await supabase.rpc('gsa_admin_emprestimo_enviar_comentario', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_autor_id: userData.user?.id || null,
        p_mensagem: msg
      });
      if (error) throw error;

      await notificationService.notifyClient(
        selected.cliente_id,
        'Nova mensagem do suporte',
        \`Voce recebeu uma nova mensagem referente ao emprestimo \${selected.codigo_emprestimo}.\`,
        'emprestimos',
        'propostas',
        selected.id
      );

      const { data } = await supabase.from('emprestimo_comentarios').select('*').eq('emprestimo_id', selected.id).order('created_at');
      setComentarios((data || []) as any);

      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({ comentario_id: rpcData?.comentario_id }), ator_tipo: 'admin', ator_nome: 'Administrador' });
    } catch (err) {
      toast.error('Erro ao enviar mensagem.');
    }
  };
`);

replaceFunction('enviarProposta', 'enviarContrato', `  const enviarProposta = async () => {
    if (!selected || !proposta.valorAprovado || !proposta.juros || !proposta.maxParcelas || !proposta.taxaServico) {
      toast.error('Preencha todos os campos.');
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_enviar_proposta', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_valor_aprovado: parseFloat(proposta.valorAprovado),
        p_juros_total_percentual: parseFloat(proposta.juros),
        p_max_parcelas_liberado: parseInt(proposta.maxParcelas),
        p_taxa_servico: parseFloat(proposta.taxaServico),
        p_proposta_mensagem: proposta.mensagem,
        p_validade_dias: proposta.validade
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Proposta de Emprestimo', 'Sua proposta esta disponivel. Acesse Meus Emprestimos para ver.', 'emprestimos', 'propostas', selected.id);
      toast.success('Proposta enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar proposta.');
    }
  };
`);

replaceFunction('enviarContrato', 'aprovar', `  const enviarContrato = async () => {
    if (!contratoFile || !selected) {
      toast.error('Selecione o arquivo do contrato.');
      return;
    }
    const sanitizedName = contratoFile.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const uploadPath = \`contratos/\${selected.id}/\${Date.now()}-\${sanitizedName}\`;
    const { error } = await supabase.storage.from('emprestimos').upload(uploadPath, contratoFile);
    if (error) {
      toast.error('Erro ao enviar contrato.');
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(uploadPath);

    try {
      const session = getAdminSessionForRpc();
      const { error: rpcError } = await supabase.rpc('gsa_admin_emprestimo_enviar_contrato', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_contrato_url: publicUrl
      });
      if (rpcError) throw rpcError;

      await notificationService.notifyClient(selected.cliente_id, 'Contrato Disponivel', 'Seu contrato de emprestimo esta disponivel para assinatura.', 'emprestimos', 'ativos', selected.id);
      toast.success('Contrato enviado!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar contrato.');
    }
  };
`);

replaceFunction('aprovar', 'ativar', `  const aprovar = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_emprestimo_aprovar', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id
      });
      if (error) throw error;

      const taxa = Number(data?.taxa_servico ?? selected.taxa_servico ?? 0);
      const isTaxaZero = Boolean(data?.taxa_zero ?? taxa === 0);

      if (isTaxaZero) {
        await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Aprovado!', 'Seu emprestimo foi aprovado com taxa de servico isenta! Aguarde a ativacao pelo administrador.', 'emprestimos', 'sistema');
        toast.success(data?.already_processed ? 'Emprestimo ja estava aprovado.' : 'Aprovado! Taxa isenta e fatura marcada como paga.');
      } else {
        await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Aprovado!', \`Seu emprestimo foi aprovado! Pague a taxa de servico de \${formatCurrency(taxa)} para liberar as parcelas.\`, 'financeiro', 'sistema');
        toast.success(data?.already_processed ? 'Emprestimo ja estava aprovado.' : 'Aprovado e fatura gerada!');
      }

      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({ isTaxaZero }), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao aprovar emprestimo.');
    }
  };
`);

replaceFunction('ativar', 'solicitarPendencia', `  const ativar = async () => {
    if (!selected) return;
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'ativo',
        p_motivo: null
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Ativo!', 'Seu emprestimo foi ativado e as parcelas estao disponiveis no financeiro.', 'emprestimos', 'ativos', selected.id);
      toast.success('Emprestimo ativado com sucesso!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao ativar emprestimo.');
    }
  };
`);

replaceFunction('solicitarPendencia', 'reprovarAssinatura', `  const solicitarPendencia = async () => {
    if (!selected || !motivoPendencia) {
      toast.error('Informe o motivo.');
      return;
    }
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'pendencia_documentos',
        p_motivo: motivoPendencia
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Pendencia no Emprestimo', \`Ha uma pendencia no seu emprestimo: \${motivoPendencia}\`, 'emprestimos', 'sistema');
      toast.success('Pendencia enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar pendencia.');
    }
  };
`);

replaceFunction('reprovarAssinatura', 'cancelar', `  const reprovarAssinatura = async () => {
    if (!selected) return;
    if (!motivoPendencia) {
      toast.error('Descreva por que a assinatura foi reprovada no campo abaixo.');
      return;
    }
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'pendencia_assinatura',
        p_motivo: motivoPendencia
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Assinatura Reprovada', \`Sua assinatura no contrato foi recusada: \${motivoPendencia}. Por favor, assine novamente no seu portal.\`, 'emprestimos', 'sistema');
      toast.success('Assinatura reprovada e cliente notificado.');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reprovar assinatura.');
    }
  };
`);

replaceFunction('confirmarCancelamento', 'aprovarDocumento', `  const confirmarCancelamento = async () => {
    if (!selected) return;
    setIsCancelModalOpen(false);
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_status', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_status: 'cancelado',
        p_motivo: null
      });
      if (error) throw error;

      await notificationService.notifyClient(selected.cliente_id, 'Emprestimo Nao Aprovado', 'Seu emprestimo nao foi aprovado neste momento. Voce podera tentar solicitar novamente em 30 dias.', 'emprestimos', 'sistema');
      toast.success('Cancelado e cliente notificado!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cancelar emprestimo.');
    }
  };
`);

replaceFunction('aprovarDocumento', 'reprovarDocumento', `  const aprovarDocumento = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_documento', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_documento_id: docId,
        p_status: 'aprovado',
        p_motivo: null
      });
      if (error) throw error;
      toast.success('Documento aprovado');
      refreshDetail(selected!.id);
    } catch(err: any) {
      toast.error(err.message || 'Erro ao aprovar documento');
    }
  };
`);

replaceFunction('reprovarDocumento', 'enviarOfertaQuitacao', `  const reprovarDocumento = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const motivo = window.prompt('Motivo da reprovacao (o cliente recebera essa mensagem):');
    if (!motivo) return;

    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_emprestimo_atualizar_documento', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_documento_id: docId,
        p_status: 'rejeitado',
        p_motivo: motivo
      });
      if (error) throw error;

      await notificationService.notifyClient(selected!.cliente_id, 'Problema com Documento', \`Seu documento nao foi aceito. Motivo: \${motivo}. Acesse o sistema e envie novamente.\`, 'emprestimos', 'sistema');

      toast.success('Documento reprovado e cliente notificado');
      refreshDetail(selected!.id);
      fetchAll();
    } catch(err: any) {
      toast.error(err.message || 'Erro ao reprovar documento');
    }
  };
`);

replaceFunction('enviarOfertaQuitacao', 'riscoInfo', `  const enviarOfertaQuitacao = async () => {
    if (!selected || !valorQuitacao) {
      toast.error('Informe o valor');
      return;
    }
    const v = parseFloat(valorQuitacao);
    if (isNaN(v) || v <= 0) {
      toast.error('Valor invalido');
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_emprestimo_enviar_oferta_quitacao', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_emprestimo_id: selected.id,
        p_valor_quitacao_acordo: v
      });
      if (error) throw error;

      if (!data?.already_processed) {
        await notificationService.notifyClient(selected.cliente_id, 'Oferta de Quitacao', 'O valor para quitacao total foi aprovado.', 'emprestimos', 'ativos', selected.id);
      }

      toast.success(data?.already_processed ? 'Esta quitacao ja possui uma oferta enviada.' : 'Oferta enviada!');
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar oferta.');
    }
  };
`);

fs.writeFileSync(file, src, 'utf8');
