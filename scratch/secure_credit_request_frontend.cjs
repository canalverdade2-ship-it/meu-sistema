const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'CreditoModule.tsx');
let src = fs.readFileSync(file, 'utf8');

function replaceFunction(name, nextName, body) {
  const start = src.indexOf(`  const ${name} = async`);
  if (start === -1) throw new Error(`Function not found: ${name}`);
  const end = src.indexOf(`  const ${nextName} = async`, start);
  if (end === -1) throw new Error(`Next function not found after ${name}: ${nextName}`);
  src = src.slice(0, start) + body.trimEnd() + '\n\n' + src.slice(end);
}

replaceFunction('handlePreAprovar', 'handleAprovarAumentoDireto', `  const handlePreAprovar = async () => {
    if (!selectedRequest) return;
    const valorAprovado = parseFloat(limiteAprovado);
    if (isNaN(valorAprovado) || valorAprovado <= 0) {
      toast.error('Informe um valor de limite aprovado valido.');
      return;
    }
    if (!contratoFile && !selectedRequest.contrato_url) {
      toast.error('Faca o upload do contrato de abertura de credito.');
      return;
    }

    setSubmitting(true);
    try {
      let finalContratoUrl = selectedRequest.contrato_url;

      if (contratoFile) {
        const sanitizedName = contratoFile.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const uploadPath = \`credito_modelos/\${selectedRequest.id}/\${Date.now()}-\${sanitizedName}\`;
        const { error: uploadError } = await supabase.storage.from('emprestimos').upload(uploadPath, contratoFile);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(uploadPath);
        finalContratoUrl = publicUrl;
      }

      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_preaprovar_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id,
        p_limite_aprovado: valorAprovado,
        p_opcao_pagamento_parcelado: opcaoParcelado,
        p_max_parcelas: maxParcelas,
        p_contrato_url: finalContratoUrl
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Credito Pre-Aprovado!',
        \`Sua solicitacao de credito de R$ \${valorAprovado.toFixed(2)} foi pre-aprovada. Assine o contrato digital para ativar seu limite.\`,
        'credito_loja',
        'cadastro_aprovado'
      );

      toast.success('Solicitacao pre-aprovada! Contrato enviado ao cliente.');
      setShowRequestDetail(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao pre-aprovar solicitacao.');
    } finally {
      setSubmitting(false);
    }
  };
`);

replaceFunction('handleRecusar', 'handleSolicitarDocumento', `  const handleRecusar = async () => {
    if (!selectedRequest) return;
    if (!motivoNegacao) {
      toast.error('Forneca uma justificativa para a recusa.');
      return;
    }

    setSubmitting(true);
    try {
      const lockDate = new Date();
      lockDate.setDate(lockDate.getDate() + parseInt(diasLockout));
      const session = getAdminSessionForRpc();

      const { error } = await supabase.rpc('gsa_admin_recusar_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id,
        p_motivo: motivoNegacao,
        p_nova_tentativa_apos: lockDate.toISOString().split('T')[0]
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Solicitacao de Credito Recusada',
        \`Infelizmente sua analise de credito foi recusada. Motivo: \${motivoNegacao}. Nova tentativa liberada em \${formatDate(lockDate.toISOString())}\`,
        'credito_loja',
        'cadastro_bloqueado'
      );

      toast.success('Solicitacao recusada.');
      setShowRequestDetail(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao recusar solicitacao.');
    } finally {
      setSubmitting(false);
    }
  };
`);

replaceFunction('handleSolicitarDocumento', 'handleDocumentoStatus', `  const handleSolicitarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !docNome) return;

    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_solicitar_documento_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id,
        p_nome_documento: docNome,
        p_observacao: docObs || null
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Acao Necessaria: Envio de Documento',
        \`Para prosseguirmos com a analise de credito, envie o documento: \${docNome}\`,
        'credito_loja',
        'documento_solicitado'
      );

      toast.success('Documento solicitado com sucesso!');
      setDocNome('');
      setDocObs('');
      setSolicitandoDocumento(false);

      const docs = await loadRequestDocs(selectedRequest.id);
      setSelectedRequest((prev: any) => ({ ...prev, documentos: docs }));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao solicitar documento.');
    } finally {
      setSubmitting(false);
    }
  };
`);

replaceFunction('handleDocumentoStatus', 'handleRejeitarContrato', `  const handleDocumentoStatus = async (docId: string, status: 'aprovado' | 'rejeitado') => {
    if (!selectedRequest) return;

    let motivo = '';
    if (status === 'rejeitado') {
      const inputMotivo = window.prompt('Digite o motivo da rejeicao do documento:');
      if (inputMotivo === null) return;

      const trimmed = inputMotivo.trim();
      if (!trimmed) {
        toast.error('O motivo da rejeicao e obrigatorio.');
        return;
      }
      motivo = trimmed;
    }

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_documento_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_documento_id: docId,
        p_status: status,
        p_observacao: status === 'rejeitado' ? motivo : null
      });

      if (error) throw error;

      const nomeDocumento = data?.nome_documento || 'Documento Adicional';
      toast.success(\`Documento \${status === 'aprovado' ? 'aprovado' : 'rejeitado'}!\`);

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        status === 'aprovado' ? 'Documento de Credito Aprovado' : 'Documento de Credito Rejeitado',
        status === 'aprovado'
          ? \`Seu documento de limite de credito ("\${nomeDocumento}") foi aprovado.\`
          : \`Seu documento de limite de credito ("\${nomeDocumento}") foi rejeitado. Motivo: \${motivo}. Por favor, envie novamente.\`,
        'credito_loja',
        status === 'aprovado' ? 'documento_credito_aprovado' : 'documento_credito_rejeitado',
        { tab: 'credito' }
      );

      const docs = await loadRequestDocs(selectedRequest.id);
      setSelectedRequest((prev: any) => ({ ...prev, documentos: docs }));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao atualizar status do documento.');
    }
  };
`);

replaceFunction('handleRejeitarContrato', 'handleReenviarContrato', `  const handleRejeitarContrato = async () => {
    if (!selectedRequest) return;

    const inputMotivo = window.prompt('Digite o motivo da rejeicao da assinatura do contrato:');
    if (inputMotivo === null) return;

    const motivo = inputMotivo.trim();
    if (!motivo) {
      toast.error('O motivo da rejeicao e obrigatorio.');
      return;
    }

    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_rejeitar_contrato_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id,
        p_motivo: motivo
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Assinatura de Contrato Rejeitada',
        \`A assinatura do seu contrato de credito foi rejeitada. Motivo: \${motivo}. Por favor, envie novamente no portal.\`,
        'credito_loja',
        'contrato_rejeitado',
        { tab: 'credito' }
      );

      toast.success('Assinatura do contrato rejeitada com sucesso!');
      setShowRequestDetail(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao rejeitar assinatura do contrato.');
    } finally {
      setSubmitting(false);
    }
  };
`);

fs.writeFileSync(file, src, 'utf8');
