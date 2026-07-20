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

replaceFunction('handleExcluirAcordo', `  const handleExcluirAcordo = async (c: any) => {
    const canProceed = await canDeleteRecord('cobrancas', c.id);
    if (!canProceed) return;

    if (!window.confirm('ATENCAO: A exclusao removera o registro de cobranca e cancelara o acordo. A divida original NAO sera reativada automaticamente se voce excluir o registro de cobranca. Deseja continuar?')) return;

    try {
      const session = getAdminSessionForRpc();
      const faturaDescricaoOriginal = c.faturas?.codigo_fatura || c.fatura_id?.substring(0, 8) || '';
      const { error } = await supabase.rpc('gsa_admin_excluir_cobranca', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cobranca_id: c.id
      });

      if (error) throw error;

      toast.success('Registro de cobranca excluido.');

      await logService.logAction({
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'EXCLUIR_COBRANCA',
        detalhes: \`Registro de cobranca/acordo de \${c.clientes?.nome || c.cliente_id} removido permanentemente. Ref: \${faturaDescricaoOriginal}\`
      });

      fetchDados();
    } catch (err: any) {
      console.error('Erro ao excluir registro:', err);
      toast.error(err?.message || 'Erro ao excluir registro.');
    }
  };`);

fs.writeFileSync(file, source, 'utf8');
