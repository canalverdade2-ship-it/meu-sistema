const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'ClientesModule.tsx');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("import { sessionService } from '../../lib/sessionService';")) {
  source = source.replace(
    "import { whatsappNotificationService } from '../../lib/whatsappNotificationService';",
    "import { whatsappNotificationService } from '../../lib/whatsappNotificationService';\nimport { sessionService } from '../../lib/sessionService';"
  );
}

if (!source.includes('const getAdminSessionForRpc = () =>')) {
  source = source.replace(
    '  const { refreshCounts } = useAdminNotifications();',
    `  const { refreshCounts } = useAdminNotifications();

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

replaceFunction('handleAddBalance', `  const handleAddBalance = async () => {
    const amount = parseFloat(balanceAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return toast.error('Informe um valor valido.');
    if (isProcessingBalance) return;

    setIsProcessingBalance(true);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_ajustar_saldo_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_tipo: balanceType,
        p_valor: amount,
        p_descricao: balanceDescription || null
      });

      if (error) throw error;

      const newBalance = Number(data?.saldo_atual ?? cliente.saldo_carteira);
      const adjustment = Number(data?.ajuste ?? (balanceType === 'entrada' ? amount : -amount));

      setCliente({ ...cliente, saldo_carteira: newBalance });
      toast.success('Saldo atualizado com sucesso.');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'AJUSTE_SALDO_MANUAL',
        detalhes: \`\${balanceType === 'entrada' ? 'Adicionou' : 'Removeu'} \${formatCurrency(amount)} do saldo do cliente \${cliente.nome}. Motivo: \${balanceDescription}\`
      });

      await notificationService.notifyClient(
        cliente.id,
        'Ajuste de Saldo',
        \`Seu saldo na carteira foi ajustado em \${formatCurrency(adjustment)}. O saldo atual e \${formatCurrency(newBalance)}.\`,
        'financeiro',
        'ajuste_saldo',
        { tab: 'extrato' }
      );

      setIsAddingBalance(false);
      setBalanceAmount('');
      setBalanceDescription('Ajuste manual de saldo (Admin)');
      setBalanceType('entrada');
      onRefresh();
    } catch (error: any) {
      console.error('Erro ao ajustar saldo:', error);
      toast.error(error.message || 'Erro ao processar o ajuste de saldo.');
    } finally {
      setIsProcessingBalance(false);
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
