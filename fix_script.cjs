const fs = require('fs');
const file = 'src/components/client/ClientOrcamentos.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const startIdx = 61; // line 62
const endIdx = 114; // line 115

const newCode = `  useEffect(() => {
    if (initialTab === 'solicitar') {
      try {
        const rawRequest = localStorage.getItem('gsa_pending_service_request');
        if (rawRequest) {
          const parsed = JSON.parse(rawRequest);
          setPrefillRequest({
            title: parsed?.title || '',
            description: parsed?.description || ''
          });
          localStorage.removeItem('gsa_pending_service_request');
        }
      } catch (error) {
        console.warn('Nao foi possivel carregar a solicitacao pendente:', error);
      }
      setActiveTab('abertos');
      setIsRequestModalOpen(true);
      return;
    }

    if (initialTab === 'abertos' || initialTab === 'aprovados') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const fetchOrcamentos = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('orcamentos')
        .select('*')
        .eq('cliente_id', clientId)
        .order('data_criacao', { ascending: false });

      if (monthFilter) {
        query = query.like('data_criacao', \`%\${monthFilter}%\`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrcamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar orçamentos:', error);
      toast.error('Erro ao buscar solicitações');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrcamentos();
    const channel = supabase
      .channel(\`client-orc-rt-\${clientId}-\${Date.now()}\`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orcamentos',
        filter: \`cliente_id=eq.\${clientId}\`
      }, () => {
        fetchOrcamentos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, monthFilter]);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && orcamentos.length > 0 && !isLoading && hasAutoOpened.current !== initialItemId) {
      const item = orcamentos.find(o => o.id === initialItemId);
      
      if (item) {
        hasAutoOpened.current = initialItemId;
        setSelectedOrcamento(item);
        if (item.status === 'aberto' || item.status === 'pendente' || item.status === 'negociação' || item.status === 'em revisão' || item.status === 'pendência documentos') {
          setActiveTab('abertos');
        } else if (item.status === 'aprovado' || item.status === 'produção' || item.status === 'em separação') {
          setActiveTab('aprovados');
        }
        
        if ((item.status === 'aberto' && (item.desconto || 0) <= 0) || item.status === 'negociação') {
          setIsNegotiateModalOpen(true);
        }
        
        // Scroll to the item
        setTimeout(() => {
          const element = document.getElementById(\`budget-\${initialItemId}\`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(item.id);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 500);
      } else {
        if (initialTab && initialTab !== activeTab) {
          setActiveTab(initialTab);
        }
      }
    }
  }, [initialItemId, orcamentos, initialTab, isLoading, activeTab]);`;

lines.splice(startIdx, endIdx - startIdx + 1, newCode);
fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed block 62-115.');
