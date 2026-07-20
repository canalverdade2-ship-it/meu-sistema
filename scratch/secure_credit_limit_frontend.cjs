const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'CreditoModule.tsx');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("import { sessionService } from '../../lib/sessionService';")) {
  source = source.replace(
    "import { whatsappNotificationService } from '../../lib/whatsappNotificationService';",
    "import { whatsappNotificationService } from '../../lib/whatsappNotificationService';\nimport { sessionService } from '../../lib/sessionService';"
  );
}

if (!source.includes('const getAdminSessionForRpc = () =>')) {
  source = source.replace(
    "  const [totalQuitacaoFaturas, setTotalQuitacaoFaturas] = useState<number | null>(null);",
    `  const [totalQuitacaoFaturas, setTotalQuitacaoFaturas] = useState<number | null>(null);

  const getAdminSessionForRpc = () => {
    const session = sessionService.getCurrentSession();
    if (!session?.sessaoId || !session?.sessionToken) {
      throw new Error('Sessao administrativa expirada. Faca login novamente.');
    }
    return session;
  };`
  );
}

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

replaceFunction('handleAprovarAumentoDireto', `  const handleAprovarAumentoDireto = async () => {
    if (!selectedRequest) return;
    const valorAprovado = parseFloat(limiteAprovado);
    if (isNaN(valorAprovado) || valorAprovado <= 0) {
      toast.error('Informe um valor de limite aprovado valido.');
      return;
    }

    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_aprovar_aumento_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id,
        p_limite_aprovado: valorAprovado
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Aumento de Limite Aprovado!',
        \`Sua solicitacao de aumento de limite foi aprovada! Seu novo limite total e de R$ \${valorAprovado.toFixed(2)}.\`,
        'credito_loja',
        'cliente_ativado'
      );

      toast.success(data?.already_processed ? 'Aumento de limite ja estava liberado.' : 'Aumento de limite aprovado e liberado!');
      setShowRequestDetail(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao aprovar aumento de limite.');
    } finally {
      setSubmitting(false);
    }
  };`);

replaceFunction('handleAprovarContratoELiberar', `  const handleAprovarContratoELiberar = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_liberar_credito_contrato', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_solicitacao_id: selectedRequest.id
      });

      if (error) throw error;

      const limiteNovoTotal = Number(data?.limite_total_novo || selectedRequest.limite_aprovado || 0);

      await notificationService.notifyClient(
        selectedRequest.cliente_id,
        'Credito Ativado com Sucesso!',
        \`Seu limite de credito de R$ \${limiteNovoTotal.toFixed(2)} ja esta liberado para uso na GSA Store.\`,
        'credito_loja',
        'cliente_ativado'
      );

      toast.success(data?.already_processed ? 'Credito ja estava liberado.' : 'Credito liberado com sucesso!');
      setShowRequestDetail(false);
      fetchSolicitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao aprovar e liberar credito.');
    } finally {
      setSubmitting(false);
    }
  };`);

replaceFunction('handleSalvarAjusteManual', `  const handleSalvarAjusteManual = async () => {
    if (!selectedCliente) return;
    const novoTotal = parseFloat(novoLimiteTotal);
    if (isNaN(novoTotal) || novoTotal < 0) {
      toast.error('Insira um limite total valido.');
      return;
    }
    if (!ajusteDescricao) {
      toast.error('Forneca uma descricao ou justificativa para este ajuste manual.');
      return;
    }

    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_ajustar_limite_credito_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: selectedCliente.id,
        p_novo_limite_total: novoTotal,
        p_descricao: ajusteDescricao
      });

      if (error) throw error;

      await notificationService.notifyClient(
        selectedCliente.id,
        'Ajuste de Limite de Credito',
        \`Seu limite total de credito foi ajustado para R$ \${novoTotal.toFixed(2)}.\`,
        'credito_loja',
        'ajuste_saldo'
      );

      toast.success('Limite atualizado com sucesso!');
      setShowClienteDetail(false);
      fetchClientes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao ajustar limite.');
    } finally {
      setSubmitting(false);
    }
  };`);

replaceFunction('handleToggleParcelamentoCliente', `  const handleToggleParcelamentoCliente = async (cli: any) => {
    try {
      const newVal = !cli.opcao_pagamento_parcelado;
      const session = getAdminSessionForRpc();
      const { error } = await supabase.rpc('gsa_admin_definir_parcelamento_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cli.id,
        p_opcao_pagamento_parcelado: newVal
      });

      if (error) throw error;
      toast.success(\`Parcelamento \${newVal ? 'ativado' : 'desativado'} para o cliente!\`);
      fetchClientes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao alterar opcao de parcelamento.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
