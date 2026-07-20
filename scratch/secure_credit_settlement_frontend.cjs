const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'CreditoModule.tsx');
let src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('  const enviarOfertaQuitacao = async () => {');
const end = src.indexOf('  const fetchSettings = async () => {', start);

if (start === -1 || end === -1) {
  throw new Error('Nao foi possivel localizar enviarOfertaQuitacao.');
}

const replacement = `  const enviarOfertaQuitacao = async () => {
    if (!selectedQuitacao || !valorQuitacao) {
      toast.error('Informe o valor da oferta de quitacao.');
      return;
    }
    const v = parseFloat(valorQuitacao.replace(/[^\\d.-]/g, ''));
    if (isNaN(v) || v <= 0) {
      toast.error('Valor invalido.');
      return;
    }
    setSubmitting(true);
    try {
      const session = getAdminSessionForRpc();
      const { data, error } = await supabase.rpc('gsa_admin_enviar_oferta_quitacao_credito', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_orcamento_id: selectedQuitacao.id,
        p_valor_quitacao_acordo: v
      });

      if (error) throw error;

      if (!data?.already_processed) {
        await notificationService.notifyClient(
          selectedQuitacao.cliente_id,
          'Oferta de Quitacao de Credito',
          \`Uma nova oferta de quitacao para o pedido #\${selectedQuitacao.codigo_orcamento} foi enviada.\`,
          'credito_loja',
          'cobranca_quitacao'
        );
      }

      toast.success(data?.already_processed ? 'Esta quitacao ja possui uma oferta enviada.' : 'Oferta de quitacao enviada ao cliente com sucesso!');
      setShowQuitacaoDetail(false);
      fetchQuitacoes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao enviar oferta.');
    } finally {
      setSubmitting(false);
    }
  };

`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, src, 'utf8');
