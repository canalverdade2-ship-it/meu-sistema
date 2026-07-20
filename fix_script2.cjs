const fs = require('fs');
const file = 'src/components/client/ClientOrcamentos.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const startIdx = 217; // line 218
const endIdx = 275; // line 276

const newCode = `  // Stable Realtime Subscription
  useEffect(() => {
    let timeoutId;

    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchOrcamentos();
      }, 300);
    };

    const channel = supabase
      .channel(\`client-orc-rt-\${clientId}-\${Date.now()}\`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orcamentos',
        filter: \`cliente_id=eq.\${clientId}\`
      }, (payload) => {
        debouncedFetch();
        if (payload.new && selectedOrcamentoRef.current && payload.new.id === selectedOrcamentoRef.current.id) {
          const updatedOrc = payload.new;
          // Se o status mudou externamente, fechamos o modal e avisamos o usuário
          if (updatedOrc.status !== selectedOrcamentoRef.current?.status) {
            toast(\`O orçamento \${updatedOrc.codigo_orcamento} foi atualizado para "\${updatedOrc.status}".\`);
            setIsNegotiateModalOpen(false);
            setIsRequestDiscountOpen(false);
            setSelectedOrcamento(null);
          } else {
            setSelectedOrcamento(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [clientId]);`;

lines.splice(startIdx, endIdx - startIdx + 1, newCode);
fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed block 218-276.');
