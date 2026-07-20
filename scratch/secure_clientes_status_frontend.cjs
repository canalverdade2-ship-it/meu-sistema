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

replaceFunction('handleToggleBlockWallet', `  const handleToggleBlockWallet = async () => {
    if (!cliente.carteira_bloqueada) {
      setBlockingType('carteira');
      setBlockingReason('');
      setIsReasonModalOpen(true);
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_acao: 'desbloquear_carteira',
        p_motivo: null,
        p_valor: null
      });

      if (error) throw error;

      const patch = data?.patch || { carteira_bloqueada: false };
      setCliente({ ...cliente, ...patch, motivo_bloqueio_carteira: undefined });
      toast.success('Carteira digital desbloqueada.');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'DESBLOQUEAR_CARTEIRA_CLIENTE',
        detalhes: \`Desbloqueou a carteira digital do cliente \${cliente.nome}\`
      });

      await notificationService.notifyClient(
        cliente.id,
        'Carteira Desbloqueada',
        'Sua carteira digital foi desbloqueada e esta pronta para uso.',
        'financeiro',
        'carteira_desbloqueada',
        { tab: 'extrato' }
      );

      onRefresh();
    } catch (error: any) {
      console.error('Erro ao atualizar status da carteira:', error);
      toast.error(error.message || 'Erro ao atualizar status da carteira.');
    }
  };`);

replaceFunction('handleToggleManualUnlock', `  const handleToggleManualUnlock = async () => {
    const newValue = !cliente.saque_liberado_manual;

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_acao: 'definir_saque_manual',
        p_motivo: null,
        p_valor: newValue
      });

      if (error) throw error;

      const patch = data?.patch || { saque_liberado_manual: newValue };
      setCliente({ ...cliente, ...patch });
      toast.success(newValue ? 'Saque desbloqueado manualmente para este cliente.' : 'Desbloqueio manual de saque removido.');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'AJUSTE_SAQUE_MANUAL_CLIENTE',
        detalhes: \`\${newValue ? 'Liberou' : 'Removeu liberacao'} manual de saque para o cliente \${cliente.nome}\`
      });

      if (newValue) {
        await notificationService.notifyClient(
          cliente.id,
          'Saque Liberado',
          'Seu saque foi liberado manualmente pela administracao. Agora voce pode solicitar retiradas.',
          'financeiro',
          'saque_liberado',
          { tab: 'saques' }
        );
      }

      onRefresh();
    } catch (error: any) {
      console.error('Erro ao atualizar desbloqueio manual:', error);
      toast.error(error.message || 'Erro ao atualizar desbloqueio manual.');
    }
  };`);

replaceFunction('handleToggleBlockPoints', `  const handleToggleBlockPoints = async () => {
    if (!cliente.pontos_bloqueados) {
      setBlockingType('pontos');
      setBlockingReason('');
      setIsReasonModalOpen(true);
      return;
    }

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_acao: 'desbloquear_pontos',
        p_motivo: null,
        p_valor: null
      });

      if (error) throw error;

      const patch = data?.patch || { pontos_bloqueados: false };
      setCliente({ ...cliente, ...patch, motivo_bloqueio_pontos: undefined });
      toast.success('Carteira de pontos desbloqueada.');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'DESBLOQUEAR_PONTOS_CLIENTE',
        detalhes: \`Desbloqueou a carteira de pontos do cliente \${cliente.nome}\`
      });

      await notificationService.notifyClient(
        cliente.id,
        'Pontos Desbloqueados',
        'Sua carteira de pontos foi desbloqueada e esta pronta para uso.',
        'pontos',
        'pontos_desbloqueados',
        { tab: 'extrato' }
      );

      onRefresh();
    } catch (error: any) {
      console.error('Erro ao atualizar status da carteira de pontos:', error);
      toast.error(error.message || 'Erro ao atualizar status da carteira de pontos.');
    }
  };`);

replaceFunction('handleUnlockCadastro', `  const handleUnlockCadastro = async () => {
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_acao: 'aprovar_cadastro',
        p_motivo: null,
        p_valor: null
      });

      if (error) throw error;

      await notificationService.notifyClient(
        cliente.id,
        'Cadastro Aprovado',
        'Seu cadastro foi revisado e aprovado com sucesso. Todos os modulos foram liberados.',
        'dashboard',
        'cadastro_aprovado',
        { tab: 'perfil', prioridade: 'alta' }
      );

      const patch = data?.patch || {
        status: 'ativo',
        carteira_bloqueada: false,
        pontos_bloqueados: false,
        cadastro_aprovado: true
      };
      setCliente({ ...cliente, ...patch });
      toast.success('Cadastro desbloqueado com sucesso!');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'DESBLOQUEAR_CLIENTE',
        detalhes: \`Desbloqueou o cadastro e todas as funcoes do cliente \${cliente.nome}\`
      });

      onRefresh();
    } catch (error: any) {
      console.error('Erro ao desbloquear cadastro:', error);
      toast.error(error.message || 'Erro ao desbloquear cadastro.');
    }
  };`);

replaceFunction('confirmBlocking', `  const confirmBlocking = async () => {
    if (!blockingReason.trim()) return toast.error('Informe o motivo do bloqueio.');

    try {
      const actionByType: Record<string, string> = {
        cadastro: 'bloquear_cadastro',
        carteira: 'bloquear_carteira',
        pontos: 'bloquear_pontos'
      };
      const rpcAction = actionByType[blockingType];
      if (!rpcAction) throw new Error('Tipo de bloqueio invalido.');

      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_acao: rpcAction,
        p_motivo: blockingReason,
        p_valor: null
      });

      if (error) throw error;

      const patch = data?.patch || {};
      setCliente({ ...cliente, ...patch });

      const successMessage = blockingType === 'cadastro'
        ? 'Cadastro bloqueado com sucesso!'
        : blockingType === 'carteira'
          ? 'Carteira digital bloqueada!'
          : 'Carteira de pontos bloqueada!';
      toast.success(successMessage);

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: blockingType === 'cadastro' ? 'BLOQUEAR_CLIENTE' : (blockingType === 'carteira' ? 'BLOQUEAR_CARTEIRA_CLIENTE' : 'BLOQUEAR_PONTOS_CLIENTE'),
        detalhes: \`Bloqueou \${blockingType === 'cadastro' ? 'o cadastro' : (blockingType === 'carteira' ? 'a carteira digital' : 'a carteira de pontos')} do cliente \${cliente.nome}. Motivo: \${blockingReason}\`
      });

      let notifTitulo = '';
      let notifMsg = '';
      let notifModulo: any = 'dashboard';

      if (blockingType === 'cadastro') {
        notifTitulo = 'Cadastro Bloqueado';
        notifMsg = \`Seu cadastro foi bloqueado. Motivo: \${blockingReason}\`;
      } else if (blockingType === 'carteira') {
        notifTitulo = 'Carteira Bloqueada';
        notifMsg = \`Sua carteira digital foi bloqueada. Motivo: \${blockingReason}\`;
        notifModulo = 'financeiro';
      } else if (blockingType === 'pontos') {
        notifTitulo = 'Pontos Bloqueados';
        notifMsg = \`Sua carteira de pontos foi bloqueada. Motivo: \${blockingReason}\`;
        notifModulo = 'pontos';
      }

      await notificationService.notifyClient(
        cliente.id,
        notifTitulo,
        notifMsg,
        notifModulo as any,
        blockingType === 'cadastro' ? 'cadastro_bloqueado' : (blockingType === 'carteira' ? 'carteira_bloqueada' : 'pontos_bloqueados'),
        {
          tab: blockingType === 'cadastro' ? 'perfil' : 'extrato',
          prioridade: 'alta'
        }
      );

      setIsReasonModalOpen(false);
      setBlockingReason('');
      onRefresh();
    } catch (error: any) {
      console.error('Erro ao realizar bloqueio:', error);
      toast.error(\`Erro ao realizar bloqueio: \${error.message || 'Erro desconhecido'}\`);
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
