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

replaceFunction('handleToggleStatus', `  const handleToggleStatus = async (cliente: Cliente) => {
    const newStatus = cliente.status === 'ativo' ? 'inativo' : 'ativo';

    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_alterar_status_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_status: newStatus
      });

      if (error) throw error;

      toast.success(\`Cliente \${newStatus === 'ativo' ? 'ativado' : 'inativado'} com sucesso.\`);

      await logService.logAction({
        ator_tipo: 'colaborador',
        ator_id: colaboradorId,
        ator_nome: colaboradorNome,
        acao: 'ALTERAR_STATUS_CLIENTE',
        detalhes: \`Alterou status do cliente \${cliente.nome} para \${newStatus}\`
      });
      refreshCounts?.();

      await notificationService.notifyClient(
        cliente.id,
        'Status Alterado',
        \`Seu status foi alterado para \${newStatus === 'ativo' ? 'Ativo' : 'Inativo'}.\`,
        'dashboard',
        'status_alterado',
        { tab: 'perfil' }
      );

      fetchClientes();
    } catch (error: any) {
      console.error('[UPDATE] Erro ao atualizar cliente:', error);
      toast.error(error.message || 'Erro ao alterar status.');
    }
  };`);

replaceFunction('handleSaveEdit', `  const handleSaveEdit = async () => {
    try {
      const updateData: any = { ...editData };

      if (updateData.logradouro !== undefined) {
        updateData.endereco = updateData.logradouro;
        delete updateData.logradouro;
      }
      if (updateData.uf !== undefined) {
        updateData.estado = updateData.uf;
        delete updateData.uf;
      }

      if (updateData.cpf_cnpj !== undefined) {
        if (cliente.tipo_pessoa === 'pf') {
          updateData.cpf = updateData.cpf_cnpj;
          updateData.cnpj = null;
        } else {
          updateData.cnpj = updateData.cpf_cnpj;
          updateData.cpf = null;
        }
        delete updateData.cpf_cnpj;
      }

      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_atualizar_dados_cliente', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_cliente_id: cliente.id,
        p_patch: updateData
      });

      if (error) throw error;

      const patch = data?.patch || updateData;
      setCliente({ ...cliente, ...patch });
      setIsEditing(false);
      toast.success('Perfil atualizado com sucesso!');

      await logService.logAction({
        ator_tipo: colaboradorId ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        acao: 'EDITAR_CLIENTE',
        detalhes: \`Editou os dados cadastrais do cliente \${cliente.nome}\`
      });
      onRefresh();
    } catch (error: any) {
      console.error('Erro ao salvar edicao:', error);
      toast.error('Erro ao salvar: ' + (error.message || 'Tente novamente.'));
    }
  };`);

const pinBlockRegex = /onClick=\{async \(\) => \{\s*try \{\s*const \{ error \} = await supabase\s*\.from\('clientes'\)\s*\.update\(\{ pin_bloqueado: false, pin_tentativas: 0 \}\)\s*\.eq\('id', cliente\.id\);\s*if \(error\) throw error;\s*toast\.success\('Acesso desbloqueado com sucesso!'\);\s*\} catch \(err: any\) \{\s*toast\.error\('Erro ao desbloquear: ' \+ \(err\.message \|\| ''\)\);\s*\}\s*\}\}/m;

source = source.replace(pinBlockRegex, `onClick={async () => {
                      try {
                        const session = getAdminSessionForRpc();
                        const { error } = await supabase.rpc('gsa_admin_desbloquear_pin_cliente', {
                          p_sessao_id: session.sessaoId,
                          p_session_token: session.sessionToken,
                          p_cliente_id: cliente.id
                        });
                        if (error) throw error;
                        setCliente({ ...cliente, pin_bloqueado: false, pin_tentativas: 0 });
                        toast.success('Acesso desbloqueado com sucesso!');
                      } catch (err: any) {
                        toast.error('Erro ao desbloquear: ' + (err.message || ''));
                      }
                    }}`);

fs.writeFileSync(file, source, 'utf8');
