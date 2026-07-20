import { useState, useEffect, useRef } from 'react';
import { Search, MoreHorizontal, ShoppingBag, CheckCircle, XCircle, ChevronRight, Truck, Package, Clock, CreditCard, Store, User, Building2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { formatCurrency, formatDate, generateCode, handleError, maskPhone } from '../../lib/utils';
import { getProductDisplayCode, getProductDisplayCodeLabel } from '../../lib/productIdentification';
import { GlobalFilter } from '../ui/GlobalFilter';
import { toast } from 'react-hot-toast';
import { createNotification } from '../../lib/notifications';
import { notificationService } from '../../lib/notificationService';
import { logService } from '../../lib/logService';
import { AdminWhatsAppButton } from './ui/AdminWhatsAppButton';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { getAdminProductSupplierConfig } from '../../lib/adminRpc';
import { ProdutoFornecedorConfig } from '../../types';

export function OrdensCompraModule({ 
  activeSubTab, 
  initialItemId, 
  colaboradorNome, 
  onNavigate 
}: { 
  activeSubTab?: 'processamento' | 'concluido' | 'cancelado', 
  initialItemId?: string, 
  colaboradorNome?: string,
  onNavigate?: (module: string, tab?: string, itemId?: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'processamento' | 'concluido' | 'cancelado'>('processamento');

  useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);

  const [ordens, setOrdens] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({
    mes: '',
    ano: ''
  });
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<any | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Estados para Modal de Cancelamento & Reembolso
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialItemId && ordens.length > 0 && hasAutoOpened.current !== initialItemId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`oc-${initialItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedId(initialItemId);
          
          // Abrir modal automaticamente
          const ordem = ordens.find(o => o.id === initialItemId);
          if (ordem) {
            setSelectedOrdem(ordem);
            setIsDetailOpen(true);
            hasAutoOpened.current = initialItemId;
          }

          setTimeout(() => setHighlightedId(null), 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialItemId, ordens]);

  useEffect(() => {
    fetchOrdens();

    const channel = supabase
      .channel('admin-ordens-compra-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordens_compra'
      }, () => {
        fetchOrdens();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, search, filters]);

  const fetchOrdens = async () => {
    let selectStr = '*, produtos(nome, valor, codigo_produto, codigo_barras, identificador_preferencial, tipo_codigo_barras, imagem_url), clientes(nome, email, telefone), orcamentos(id, codigo_orcamento, desconto, taxa_entrega, cupom_desconto_id, cupom_entrega_id, endereco_entrega, total, quantidade), faturas(id, status, codigo_fatura, desconto_voucher_aplicado, desconto_pontos_aplicado, abatimento_carteira_aplicado, valor_total, pagamentos(metodo, valor, data_pagamento))';
    if (search) {
      selectStr = '*, produtos!inner(nome, valor, codigo_produto, codigo_barras, identificador_preferencial, tipo_codigo_barras, imagem_url), clientes(nome, email, telefone), orcamentos(id, codigo_orcamento, desconto, taxa_entrega, cupom_desconto_id, cupom_entrega_id, endereco_entrega, total, quantidade), faturas(id, status, codigo_fatura, desconto_voucher_aplicado, desconto_pontos_aplicado, abatimento_carteira_aplicado, valor_total, pagamentos(metodo, valor, data_pagamento))';
    }

    let query = supabase.from('ordens_compra').select(selectStr);
    
    if (activeTab === 'processamento') {
      query = query.in('status', ['em_analise', 'pago', 'aprovado', 'em_expedicao', 'em_transporte']);
    } else if (activeTab === 'concluido') {
      query = query.eq('status', 'concluido');
    } else if (activeTab === 'cancelado') {
      query = query.eq('status', 'cancelado');
    }
    
    if (search) {
      query = query.ilike('produtos.nome', `%${search}%`);
    }

    if (filters.mes) {
      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = new Date(Number(year), Number(filters.mes), 0).toISOString().split('T')[0];
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

    const { data, error } = (await query.order('data_criacao', { ascending: false })) as any;
    if (error) {
      console.error('Error fetching ordens_compra:', error);
      toast.error('Erro ao carregar ordens de compra.');
    }
    if (data) {
      // Enriquecer ordens do mesmo orçamento com a mesma fatura
      const enriched = data.map((ordem: any) => {
        if (ordem.faturas && ordem.faturas.length > 0) {
          return ordem;
        }
        if (ordem.orcamento_id) {
          const outraOrdemComFatura = data.find((o: any) => o.orcamento_id === ordem.orcamento_id && o.faturas && o.faturas.length > 0);
          if (outraOrdemComFatura) {
            return {
              ...ordem,
              faturas: outraOrdemComFatura.faturas
            };
          }
        }
        return ordem;
      });

      setOrdens(enriched);
      
      // Se tiver selecionado aberto, atualiza a referência
      if (selectedOrdem) {
        const updated = enriched.find((o: any) => o.id === selectedOrdem.id);
        if (updated) setSelectedOrdem(updated);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: 'pago' | 'em_expedicao' | 'em_transporte' | 'concluido' | 'cancelado', motivo?: string) => {
    const { error } = await supabase
      .from('ordens_compra')
      .update({ 
        status, 
        motivo_cancelamento: status === 'cancelado' && motivo ? `${motivo}${colaboradorNome ? ` [POR: ${colaboradorNome}]` : ''}` : null, 
        data_conclusao: status === 'concluido' ? new Date().toISOString() : null 
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status.');
    } else {
      toast.success('Status atualizado com sucesso.');

      // Propagar atualização de status para a tabela orcamentos (status_entrega e timestamps correspondentes)
      const ordem = ordens.find(o => o.id === id);
      if (ordem && ordem.orcamento_id) {
        // Buscar o orçamento atual para verificar quais etapas anteriores estão sem data/hora salvas
        const { data: orcData } = await supabase
          .from('orcamentos')
          .select('data_pagamento_aprovado, data_separacao, data_envio, data_entrega')
          .eq('id', ordem.orcamento_id)
          .single();

        let deliveryStatus = '';
        const nowStr = new Date().toISOString();
        const deliveryUpdates: any = {
          status: status // Sincroniza o status principal do orçamento com a ordem de compra!
        };

        if (status === 'pago') {
          deliveryStatus = 'pagamento_aprovado';
          deliveryUpdates.data_pagamento_aprovado = nowStr;
        } else if (status === 'em_expedicao') {
          deliveryStatus = 'separacao';
          deliveryUpdates.data_separacao = nowStr;
          if (orcData && !orcData.data_pagamento_aprovado) {
            deliveryUpdates.data_pagamento_aprovado = nowStr;
          }
        } else if (status === 'em_transporte') {
          deliveryStatus = 'em_transito';
          deliveryUpdates.data_envio = nowStr;
          if (orcData) {
            if (!orcData.data_pagamento_aprovado) {
              deliveryUpdates.data_pagamento_aprovado = nowStr;
            }
            if (!orcData.data_separacao) {
              deliveryUpdates.data_separacao = nowStr;
            }
          }
        } else if (status === 'concluido') {
          deliveryStatus = 'entregue';
          deliveryUpdates.data_entrega = nowStr;
          if (orcData) {
            if (!orcData.data_pagamento_aprovado) {
              deliveryUpdates.data_pagamento_aprovado = nowStr;
            }
            if (!orcData.data_separacao) {
              deliveryUpdates.data_separacao = nowStr;
            }
            if (!orcData.data_envio) {
              deliveryUpdates.data_envio = nowStr;
            }
          }
        }

        if (deliveryStatus) {
          deliveryUpdates.status_entrega = deliveryStatus;
        }
        
        await supabase
          .from('orcamentos')
          .update(deliveryUpdates)
          .eq('id', ordem.orcamento_id);
      }
      
      const updatedOrdem = ordens.find(o => o.id === id);
      if (updatedOrdem) {
        let notificationTitle = '📦 Atualização do Pedido';
        let notificationMessage = `Seu pedido para ${updatedOrdem.produtos.nome} foi atualizado para o status ${status}.`;
        
        if (status === 'pago') {
          notificationTitle = '✅ Pedido Aprovado';
          notificationMessage = `O pagamento do seu pedido para ${ordem.produtos.nome} foi aprovado! Logo iniciaremos a expedição.`;
        } else if (status === 'em_expedicao') {
          notificationTitle = '📦 Pedido em Expedição';
          notificationMessage = `Seu pedido para ${ordem.produtos.nome} está sendo preparado para o envio com muito carinho!`;
        } else if (status === 'em_transporte') {
          notificationTitle = '🚚 Pedido em Transporte';
          notificationMessage = `Seu pedido para ${ordem.produtos.nome} foi enviado e está em trânsito para o seu endereço!`;
        } else if (status === 'concluido') {
          notificationTitle = '✅ Pedido Entregue';
          notificationMessage = `Seu pedido para ${ordem.produtos.nome} foi entregue com sucesso! Aproveite! 🎉`;
        } else if (status === 'cancelado') {
          notificationTitle = '❌ Pedido Cancelado';
          notificationMessage = `Seu pedido para ${ordem.produtos.nome} foi cancelado pelo administrador. ⚠️`;
        }

        await notificationService.notifyClient(
          ordem.cliente_id,
          notificationTitle,
          notificationMessage,
          'produtos',
          `ordem_${status}`,
          { tab: status === 'concluido' ? 'comprados' : status === 'cancelado' ? 'cancelados' : 'comprados', itemId: ordem.id, prioridade: status === 'cancelado' ? 'alta' : 'normal', contexto: { ordem_id: ordem.id, produto: ordem.produtos?.nome } }
        );
      }

      setIsDetailOpen(false);
      
      // Log Action
      await logService.logAction({ 
        acao: 'ACAO_SISTEMA', 
        detalhes: `Status da ordem de compra ${id} alterado para ${status}`, 
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin', 
        ator_nome: colaboradorNome || 'Administrador',
        ator_id: id 
      });

      fetchOrdens();
    }
  };

  const handleCancelAndRefundConfirm = async () => {
    if (!selectedOrdem || !cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }

    setIsCanceling(true);
    try {
      const orcamento = selectedOrdem.orcamentos;
      const codigoOrcamento = orcamento?.codigo_orcamento;

      // 0. Estornar pontos fidelidade se houver resgate
      let pointsToRefund = 0;
      if (codigoOrcamento) {
        const { data: txData } = await supabase
          .from('points_transactions')
          .select('pontos')
          .eq('cliente_id', selectedOrdem.cliente_id)
          .eq('tipo', 'resgate')
          .like('descricao', `%#${codigoOrcamento}%`);

        if (txData && txData.length > 0) {
          pointsToRefund = txData.reduce((sum, item) => sum + (item.pontos < 0 ? Math.abs(item.pontos) : 0), 0);
        } else {
          const { data: movData } = await supabase
            .from('pontos_movimentacoes')
            .select('pontos')
            .eq('cliente_id', selectedOrdem.cliente_id)
            .eq('tipo', 'uso_fatura')
            .like('descricao', `%#${codigoOrcamento}%`);

          if (movData && movData.length > 0) {
            pointsToRefund = movData.reduce((sum, item) => sum + (item.pontos < 0 ? Math.abs(item.pontos) : 0), 0);
          }
        }
      }

      if (pointsToRefund > 0) {
        const { data: clientePtsData } = await supabase
          .from('clientes')
          .select('saldo_pontos')
          .eq('id', selectedOrdem.cliente_id)
          .single();

        if (clientePtsData) {
          const currentSaldo = clientePtsData.saldo_pontos || 0;
          const newSaldo = currentSaldo + pointsToRefund;

          const { error: updatePtsError } = await supabase
            .from('clientes')
            .update({ saldo_pontos: newSaldo })
            .eq('id', selectedOrdem.cliente_id);

          if (updatePtsError) throw updatePtsError;

          await supabase
            .from('pontos_movimentacoes')
            .insert([{
              cliente_id: selectedOrdem.cliente_id,
              tipo: 'estorno',
              pontos: pointsToRefund,
              saldo_apos: newSaldo,
              descricao: `Estorno de pontos por cancelamento do pedido #${codigoOrcamento}`
            }]);

          await supabase
            .from('points_transactions')
            .insert([{
              cliente_id: selectedOrdem.cliente_id,
              tipo: 'estorno',
              pontos: pointsToRefund,
              descricao: `Estorno de pontos por cancelamento do pedido #${codigoOrcamento}`
            }]);

          await notificationService.notifyClient(
            selectedOrdem.cliente_id,
            '⭐ Pontos Reembolsados',
            `Seu pedido #${codigoOrcamento} foi cancelado e seus ${pointsToRefund} pontos usados foram estornados para sua carteira.`,
            'produtos',
            'ajuste_pontos',
            { tab: 'cancelados', itemId: selectedOrdem.id }
          );
        }
      }
      
      // Verificar se foi pago com Crédito GSA Store
      let isStoreCredit = false;
      let faturasCreditoToCancel: any[] = [];

      if (codigoOrcamento) {
        const { data: allCreditFats } = await supabase
          .from('faturas')
          .select('id, status, itens_faturados')
          .eq('cliente_id', selectedOrdem.cliente_id)
          .eq('is_amortizacao_credito', true);
          
        if (allCreditFats) {
          faturasCreditoToCancel = allCreditFats.filter(f => 
            f.itens_faturados?.some((item: any) => item.codigo === `CRE-${codigoOrcamento}`)
          );
          
          if (faturasCreditoToCancel.length > 0 || orcamento?.descricao_adicional?.includes('Crédito GSA')) {
            isStoreCredit = true;
          }
        }
      }

      // 1. Atualizar status da ordem para cancelado
      const { error: updateError } = await supabase
        .from('ordens_compra')
        .update({
          status: 'cancelado',
          motivo_cancelamento: `${cancelReason}${colaboradorNome ? ` [POR: ${colaboradorNome}]` : ''}`
        })
        .eq('id', selectedOrdem.id);

      if (updateError) throw updateError;

      if (isStoreCredit) {
        const valorReembolso = Number(orcamento?.total || 0);

        // Buscar dados de limite do cliente
        const { data: cliente } = await supabase
          .from('clientes')
          .select('limite_credito_total, limite_credito_disponivel')
          .eq('id', selectedOrdem.cliente_id)
          .single();

        const limiteTotal = Number(cliente?.limite_credito_total || 0);
        const limiteDisp = Number(cliente?.limite_credito_disponivel || 0);
        const newLimiteDisponivel = limiteDisp + valorReembolso;

        // 1. Estornar limite disponível do cliente no banco
        const { error: limitError } = await supabase
          .from('clientes')
          .update({ limite_credito_disponivel: newLimiteDisponivel })
          .eq('id', selectedOrdem.cliente_id);
        if (limitError) throw limitError;

        // 2. Cancelar faturas de amortização que não foram pagas
        const faturasToCancelIds = faturasCreditoToCancel.filter(f => f.status !== 'pago').map(f => f.id);
        if (faturasToCancelIds.length > 0) {
          const { error: cancelFatError } = await supabase
            .from('faturas')
            .update({
              status: 'cancelado',
              motivo_cancelamento: `Estornado devido ao cancelamento do pedido #${codigoOrcamento}`,
              data_cancelamento: new Date().toISOString()
            })
            .in('id', faturasToCancelIds);
          if (cancelFatError) throw cancelFatError;
        }

        // 3. Registrar movimentação em loja_credito_movimentacoes
        const { error: movError } = await supabase
          .from('loja_credito_movimentacoes')
          .insert({
            cliente_id: selectedOrdem.cliente_id,
            tipo: 'estorno_compra',
            valor: valorReembolso,
            limite_total_anterior: limiteTotal,
            limite_total_novo: limiteTotal,
            limite_disponivel_anterior: limiteDisp,
            limite_disponivel_novo: newLimiteDisponivel,
            descricao: `Estorno por Cancelamento de Pedido (Orçamento #${codigoOrcamento})`
          });
        if (movError) throw movError;

        // 4. Notificar cliente sobre o estorno de crédito
        await notificationService.notifyClient(
          selectedOrdem.cliente_id,
          '💳 Limite de Crédito Restaurado',
          `Seu pedido #${codigoOrcamento} foi cancelado e o valor de ${formatCurrency(valorReembolso)} foi estornado para o seu limite de crédito disponível.`,
          'produtos',
          'credito_estornado',
          { tab: 'cancelados', itemId: selectedOrdem.id, prioridade: 'alta' }
        );

        toast.success('Pedido cancelado e limite de crédito estornado com sucesso!');
        setIsCancelModalOpen(false);
        setIsDetailOpen(false);
        setCancelReason('');
      } else {
        const fatura = selectedOrdem.faturas?.[0];
        const isPaid = fatura?.status === 'pago';

        // 2. Se a fatura estava paga, gerar reembolso automático com prazo de 10 dias
        if (isPaid) {
          const valorReembolso = Number(fatura.valor_total || 0);

          const { error: refundError } = await supabase
            .from('loja_reembolsos')
            .insert([{
              ordem_compra_id: selectedOrdem.id,
              cliente_id: selectedOrdem.cliente_id,
              valor_reembolso: valorReembolso,
              motivo_cancelamento: cancelReason,
              prazo_pagamento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 dias
              status: 'pendente'
            }]);

          if (refundError) throw refundError;

          // Notificar cliente sobre o reembolso
          await notificationService.notifyClient(
            selectedOrdem.cliente_id,
            '⚠️ Reembolso Solicitado',
            `Seu pedido #${orcamento?.codigo_orcamento || selectedOrdem.codigo_ordem} foi cancelado. Um reembolso no valor de ${formatCurrency(valorReembolso)} foi aberto com prazo de 10 dias para pagamento.`,
            'produtos',
            'reembolso_aberto',
            { tab: 'cancelados', itemId: selectedOrdem.id, prioridade: 'alta' }
          );

          toast.success('Pedido cancelado e Reembolso aberto com sucesso!');
          setIsCancelModalOpen(false);
          setIsDetailOpen(false);
          setCancelReason('');

          // Redirecionar Admin para Cadastro > GSA Store Hub > Reembolsos
          if (onNavigate) {
            onNavigate('cadastro', 'reembolsos');
          }
        } else {
          // Apenas cancelamento normal de fatura pendente
          await notificationService.notifyClient(
            selectedOrdem.cliente_id,
            '❌ Pedido Cancelado',
            `Seu pedido #${orcamento?.codigo_orcamento || selectedOrdem.codigo_ordem} foi cancelado pelo administrador.`,
            'produtos',
            'ordem_cancelada',
            { tab: 'cancelados', itemId: selectedOrdem.id }
          );

          toast.success('Pedido cancelado com sucesso!');
          setIsCancelModalOpen(false);
          setIsDetailOpen(false);
          setCancelReason('');
        }
      }

      fetchOrdens();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao cancelar ordem.');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex border-b border-neutral-200 mb-6">
        <button
          onClick={() => setActiveTab('processamento')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'processamento'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
          }`}
        >
          Em Processamento / Entrega
        </button>
        <button
          onClick={() => setActiveTab('concluido')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'concluido'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
          }`}
        >
          Entregas Concluídas
        </button>
        <button
          onClick={() => setActiveTab('cancelado')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'cancelado'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
          }`}
        >
          Canceladas
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-4 px-2 mb-8">
        <GlobalFilter 
          searchValue={search}
          onSearch={setSearch}
          currentFilters={filters}
          onFilterChange={setFilters}
          onClear={() => {
            setSearch('');
            setFilters({ mes: '', ano: new Date().getFullYear().toString() });
          }}
          options={[
            {
              id: 'mes',
              label: 'Mês de Criação',
              type: 'select',
              options: [
                { value: '01', label: 'Janeiro' },
                { value: '02', label: 'Fevereiro' },
                { value: '03', label: 'Março' },
                { value: '04', label: 'Abril' },
                { value: '05', label: 'Maio' },
                { value: '06', label: 'Junho' },
                { value: '07', label: 'Julho' },
                { value: '08', label: 'Agosto' },
                { value: '09', label: 'Setembro' },
                { value: '10', label: 'Outubro' },
                { value: '11', label: 'Novembro' },
                { value: '12', label: 'Dezembro' }
              ]
            },
            {
              id: 'ano',
              label: 'Ano',
              type: 'select',
              options: [
                { value: '2024', label: '2024' },
                { value: '2025', label: '2025' },
                { value: '2026', label: '2026' }
              ]
            }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {ordens.length > 0 ? ordens.map((ordem) => {
          const fatura = ordem.faturas?.[0];
          const deliveryLabels: Record<string, string> = {
            'em_analise': 'Aguardando Pagamento',
            'pago': 'Pedido Aprovado',
            'aprovado': 'Pedido Aprovado',
            'em_expedicao': 'Em Expedição',
            'em_transporte': 'Em Transporte',
            'concluido': 'Pedido Entregue',
            'cancelado': 'Cancelado'
          };
          
          return (
            <div 
              key={ordem.id} 
              id={`oc-${ordem.id}`}
              className={`group relative overflow-hidden rounded-[2.5rem] bg-white p-6 md:p-8 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                highlightedId === ordem.id 
                  ? 'bg-indigo-50/50 ring-2 ring-indigo-500 z-10 scale-[1.01]' 
                  : ''
              }`}
            >
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-12 -translate-y-12 rounded-full bg-indigo-500 opacity-5 group-hover:opacity-10 transition-opacity" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner group-hover:scale-110 transition-all font-black">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                      {ordem.produtos?.nome || 'Produto da Loja'}
                    </h3>
                    <span className="text-[11px] font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                      {ordem.codigo_ordem || `#OC-${ordem.id.slice(0, 4).toUpperCase()}`}
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Cliente: {ordem.clientes?.nome}</p>
                  <div className="flex items-center flex-wrap gap-3 mt-3">
                    <p className="text-xl font-black text-[#1a1a1a] tracking-tighter">
                      {formatCurrency(ordem.orcamentos?.total ?? (ordem.produtos?.valor || 0))}
                    </p>
                    
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${
                      ordem.status === 'cancelado' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' :
                      ordem.status === 'concluido' ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-200' :
                      (ordem.status === 'pago' || ordem.status === 'aprovado') ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' :
                      ordem.status === 'em_expedicao' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' :
                      ordem.status === 'em_transporte' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' :
                      'bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200'
                    }`}>
                      {deliveryLabels[ordem.status] || ordem.status}
                    </span>
                    
                    {fatura && (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${
                        fatura.status === 'pago' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                      }`}>
                        Financeiro: {fatura.status === 'pago' ? 'Pago' : 'Aguardando Pagamento'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedOrdem(ordem); setIsDetailOpen(true); }}
                className="relative z-10 w-full md:w-auto rounded-2xl bg-indigo-600 md:bg-neutral-100 py-4 md:p-4 text-white md:text-neutral-400 hover:bg-indigo-700 md:hover:bg-[#1a1a1a] hover:text-white transition-all active:scale-95 shadow-lg shadow-indigo-600/20 md:shadow-sm text-[10px] font-black uppercase tracking-widest md:normal-case md:tracking-normal flex items-center justify-center gap-2"
              >
                <span className="md:hidden">Ver Detalhes</span>
                <MoreHorizontal className="hidden md:block h-6 w-6" />
              </button>
            </div>
          );
        }) : (
          <div className="py-24 text-center">
            <ShoppingBag className="h-16 w-16 text-neutral-100 mx-auto mb-4" />
            <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Nenhuma ordem de compra {activeTab === 'processamento' ? 'em processamento' : activeTab === 'concluido' ? 'concluída' : 'cancelada'}</p>
          </div>
        )}
      </div>

      {/* Modal Principal de Detalhes */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detalhes da Ordem de Compra" size="wide">
        {selectedOrdem && (
          <CompraDetails 
            ordem={selectedOrdem} 
            showActions={activeTab === 'processamento'} 
            onUpdateStatus={handleUpdateStatus}
            onCancelClick={() => {
              setIsCancelModalOpen(true);
            }}
          />
        )}
      </Modal>

      {/* Modal Pop-up de Cancelamento & Reembolso */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Confirmar Cancelamento do Pedido">
        {selectedOrdem && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-red-50 p-6 border border-red-200">
              <h4 className="text-base font-bold text-red-900 mb-2">Atenção! Você está cancelando o pedido:</h4>
              <p className="text-sm font-semibold text-red-800">Ordem: {selectedOrdem.codigo_ordem || `#OC-${selectedOrdem.id.slice(0, 4).toUpperCase()}`}</p>
              <p className="text-sm font-semibold text-red-800">Cliente: {selectedOrdem.clientes?.nome}</p>
              <p className="text-sm font-semibold text-red-800">Produto: {selectedOrdem.produtos?.nome}</p>
              
              {selectedOrdem.faturas?.[0]?.status === 'pago' ? (
                <div className="mt-4 pt-4 border-t border-red-300/40">
                  <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 uppercase mb-2">⚠️ Pedido Pago</span>
                  <p className="text-sm text-red-800 leading-relaxed">
                    Como a fatura correspondente já foi paga, o sistema irá **gerar automaticamente uma solicitação de Reembolso** de forma integrada.
                  </p>
                  <div className="mt-4 bg-white/80 rounded-xl p-4 border border-red-200">
                    <p className="text-xs text-neutral-400 font-bold uppercase">Valor a ser Reembolsado</p>
                    <p className="text-2xl font-black text-red-700 mt-1">{formatCurrency(selectedOrdem.faturas[0].valor_total)}</p>
                    <p className="text-[10px] text-neutral-500 font-semibold mt-1">O prazo de pagamento do reembolso será fixado em **10 dias**.</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-700 font-medium mt-2">
                  Esta ordem ainda não foi paga pelo cliente. O cancelamento apenas registrará a anulação no sistema.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase">Motivo do Cancelamento *</label>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva detalhadamente o motivo do cancelamento para o histórico e para o e-mail/notificação do cliente..."
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 rounded-xl bg-neutral-100 py-3 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-xs"
              >
                Voltar
              </button>
              <button 
                onClick={handleCancelAndRefundConfirm}
                disabled={isCanceling || !cancelReason.trim()}
                className="flex-1 rounded-xl bg-red-600 py-3 text-white font-bold hover:bg-red-700 transition-all text-xs shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isCanceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CompraDetails({ 
  ordem, 
  showActions = false, 
  onUpdateStatus,
  onCancelClick
}: { 
  ordem: any, 
  showActions?: boolean, 
  onUpdateStatus?: (id: string, status: 'pago' | 'em_expedicao' | 'em_transporte' | 'concluido' | 'cancelado', motivo?: string) => void,
  onCancelClick?: () => void
}) {
  const [couponCode, setCouponCode] = useState<string>('');
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [pointsDiscount, setPointsDiscount] = useState<number>(0);
  const [walletDiscount, setWalletDiscount] = useState<number>(0);
  const [faturasCredito, setFaturasCredito] = useState<any[]>([]);
  const [supplierConfigs, setSupplierConfigs] = useState<Record<string, ProdutoFornecedorConfig>>({});
  const [observacoesInternas, setObservacoesInternas] = useState<string>(ordem.observacoes_internas || '');
  const [savingObs, setSavingObs] = useState(false);
  const [selectedProdutoDetalhe, setSelectedProdutoDetalhe] = useState<any>(null);
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);

  const handleSaveObservacoes = async () => {
    setSavingObs(true);
    try {
      const { error } = await supabase.from('ordens_compra').update({ observacoes_internas: observacoesInternas }).eq('id', ordem.id);
      if (error) throw error;
      toast.success('Observações salvas com sucesso');
    } catch (err) {
      toast.error(handleError(err, 'Erro ao salvar observações'));
    } finally {
      setSavingObs(false);
    }
  };

  const handleProductClick = async (produtoId: string) => {
    try {
      const { data } = await supabase.from('produtos').select('*, categorias(nome)').eq('id', produtoId).single();
      if (data) {
        setSelectedProdutoDetalhe(data);
        setIsProdutoModalOpen(true);
      }
    } catch (err) {
      console.error('Erro ao buscar produto', err);
    }
  };

  const fatura = ordem.faturas?.[0];
  const orcamento = ordem.orcamentos;
  const isPaid = fatura?.status === 'pago' || orcamento?.descricao_adicional?.includes('Crédito GSA') || faturasCredito.length > 0 || ordem.status === 'pago';

  useEffect(() => {
    const fetchFaturasCredito = async () => {
      if (!orcamento?.codigo_orcamento) return;
      try {
        const { data } = await supabase
          .from('faturas')
          .select('*')
          .eq('cliente_id', ordem.cliente_id)
          .eq('is_amortizacao_credito', true)
          .contains('itens_faturados', [{ codigo: `CRE-${orcamento.codigo_orcamento}` }]);
        setFaturasCredito(data || []);
      } catch (err) {
        console.error('Erro ao buscar faturas de crédito:', err);
      }
    };
    fetchFaturasCredito();
  }, [orcamento?.codigo_orcamento, ordem.cliente_id]);

  useEffect(() => {
    const fetchCoupon = async () => {
      if (orcamento?.cupom_desconto_id) {
        const { data } = await supabase.from('cupons_loja').select('codigo_cupom').eq('id', orcamento.cupom_desconto_id).single();
        if (data?.codigo_cupom) {
          setCouponCode(data.codigo_cupom);
        }
      }
    };
    fetchCoupon();
  }, [orcamento]);

  useEffect(() => {
    const fetchRelatedItems = async () => {
      if (!orcamento?.id) return;
      setLoadingItems(true);
      try {
        const [ocsRes, oasRes] = await Promise.all([
          supabase
            .from('ordens_compra')
            .select('*, produtos(nome, valor, codigo_produto, codigo_barras, identificador_preferencial, tipo_codigo_barras, imagem_url)')
            .eq('orcamento_id', orcamento.id),
          supabase
            .from('ordens_assinatura')
            .select('*, assinaturas(nome, valor, codigo_assinatura, imagem_url)')
            .eq('orcamento_id', orcamento.id),
        ]);

        const ocs = (ocsRes.data || []).map(oc => ({ ...oc, tipo: 'produto', item_detalhes: oc.produtos }));
        const oas = (oasRes.data || []).map(oa => ({ ...oa, tipo: 'assinatura', item_detalhes: oa.assinaturas }));

        setRelatedItems([...ocs, ...oas]);

        const configs: Record<string, ProdutoFornecedorConfig> = {};
        for (const oc of ocs) {
          if (oc.produto_id) {
            try {
              const cfg = await getAdminProductSupplierConfig(oc.produto_id);
              if (cfg && cfg.fornecimento_externo_ativo) {
                configs[oc.produto_id] = cfg;
              }
            } catch (err) {
              console.error('Erro ao buscar supplier config', err);
            }
          }
        }
        setSupplierConfigs(configs);

      } catch (err) {
        console.error('Erro ao buscar itens relacionados:', err);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchRelatedItems();
  }, [orcamento?.id]);

  useEffect(() => {
    const fetchDiscounts = async () => {
      if (!orcamento?.codigo_orcamento) return;
      try {
        // Fetch Points
        const { data: pData, error: pError } = await supabase
          .from('points_transactions')
          .select('pontos')
          .eq('cliente_id', ordem.cliente_id)
          .like('descricao', `%#${orcamento.codigo_orcamento}%`)
          .limit(1)
          .maybeSingle();

        if (pData && !pError) {
          setPointsDiscount(Math.abs(pData.pontos) * 0.01);
        } else {
          const { data: dataMov, error: errorMov } = await supabase
            .from('pontos_movimentacoes')
            .select('pontos')
            .eq('cliente_id', ordem.cliente_id)
            .like('descricao', `%#${orcamento.codigo_orcamento}%`)
            .limit(1)
            .maybeSingle();
            
          if (dataMov && !errorMov) {
            setPointsDiscount(Math.abs(dataMov.pontos) * 0.01);
          }
        }

        // Fetch Wallet (fallback for old orders)
        if (!fatura?.abatimento_carteira_aplicado) {
          const { data: wData } = await supabase
            .from('extrato_financeiro')
            .select('valor')
            .eq('referencia_id', orcamento.id)
            .eq('tipo', 'saida');
          
          if (wData && wData.length > 0) {
            const totalCarteira = wData.reduce((acc, curr) => acc + Number(curr.valor), 0);
            setWalletDiscount(totalCarteira);
          } else {
            setWalletDiscount(0);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar descontos retroativos:', err);
      }
    };
    fetchDiscounts();
  }, [orcamento?.codigo_orcamento, ordem.cliente_id, fatura]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
      {/* Coluna 1: Dados Gerais e Itens */}
      <div className="space-y-6">
        <div className="rounded-3xl bg-neutral-50 p-6 md:p-8 ring-1 ring-neutral-200 relative">
          <div className="absolute top-6 right-6">
            <AdminWhatsAppButton 
              telefone={ordem.clientes?.telefone}
              mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                tipo: 'compra',
                clienteNome: ordem.clientes?.nome,
                codigo: ordem.codigo_ordem || `#OC-${ordem.id.slice(0, 4).toUpperCase()}`,
                status: (ordem.status === 'pago' || ordem.status === 'aprovado') ? 'Pedido Aprovado' : ordem.status === 'em_expedicao' ? 'Em Expedição' : ordem.status === 'em_transporte' ? 'Em Transporte' : ordem.status === 'concluido' ? 'Pedido Entregue' : 'Aguardando Pagamento'
              })}
            />
          </div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Pedido da GSA Store</span>
          <h3 className="text-2xl font-black text-neutral-900 uppercase mt-1 leading-tight pr-12">
            {orcamento?.titulo_solicitacao || 'Ordem de Compra'}
          </h3>
          <p className="text-xs font-mono text-neutral-400 mt-2">
            Código do Pedido: {ordem.codigo_ordem || `#OC-${ordem.id.slice(0, 4).toUpperCase()}`}
          </p>
          
          <div className="mt-6 space-y-4 pt-6 border-t border-neutral-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 font-bold">Cliente:</span>
              <span className="text-neutral-800 font-black">{ordem.clientes?.nome} ({ordem.clientes?.email})</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 font-bold">Data do Pedido:</span>
              <span className="text-neutral-800 font-black">{formatDate(ordem.data_criacao)}</span>
            </div>
          </div>
        </div>

        {/* Lista de Itens do Pedido */}
        <div className="rounded-3xl bg-neutral-50 p-6 md:p-8 ring-1 ring-neutral-200 space-y-4">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Itens do Pedido</span>
          
          {loadingItems ? (
            <div className="py-4 text-center text-xs text-neutral-400 font-bold uppercase">Carregando itens...</div>
          ) : relatedItems.length > 0 ? (
            <div className="space-y-4 division-y division-neutral-200">
              {relatedItems.map((item, index) => {
                const isSupplier = item.tipo === 'produto' && item.produto_id && supplierConfigs[item.produto_id];
                return (
                  <div 
                    key={item.id} 
                    onClick={() => item.produto_id ? handleProductClick(item.produto_id) : undefined}
                    className={`flex flex-col gap-4 p-2 -mx-2 rounded-xl transition-all ${item.produto_id ? 'cursor-pointer hover:bg-white hover:shadow-sm ring-1 ring-transparent hover:ring-neutral-200' : ''} ${index > 0 ? 'pt-4 border-t border-neutral-200/60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {item.item_detalhes?.imagem_url ? (
                          <img src={item.item_detalhes.imagem_url} alt={item.item_detalhes.nome} className="w-10 h-10 object-cover rounded-lg" />
                        ) : (
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center font-bold">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-black text-neutral-800 uppercase tracking-tight">{item.item_detalhes?.nome || 'Item'}</p>
                          <p className="text-[10px] font-mono text-neutral-400">Código: {getProductDisplayCode(item.item_detalhes as any) || item.item_detalhes?.codigo_assinatura || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-neutral-800">{formatCurrency(item.item_detalhes?.valor || 0)}</p>
                        <p className="text-[10px] font-bold text-neutral-400">Qtd: {item.quantidade || 1}</p>
                      </div>
                    </div>
                    {isSupplier && (
                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/50 mt-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Store className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Compra Externa Necessária</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                          <div>
                            <span className="font-bold text-amber-900/60 block uppercase text-[10px]">Fornecedor</span>
                            <span className="font-medium text-amber-900">{supplierConfigs[item.produto_id].nome_fornecedor || 'N/A'}</span>
                          </div>
                          {supplierConfigs[item.produto_id].tipo_fornecedor === 'loja_fisica' ? (
                            <div>
                              <span className="font-bold text-amber-900/60 block uppercase text-[10px]">Localização</span>
                              <span className="font-medium text-amber-900">
                                {supplierConfigs[item.produto_id].cidade}{supplierConfigs[item.produto_id].estado ? ` / ${supplierConfigs[item.produto_id].estado}` : ''}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-amber-900/60 block uppercase text-[10px]">Link</span>
                              <a href={supplierConfigs[item.produto_id].url_produto || '#'} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:underline truncate block">
                                Acessar Produto
                              </a>
                            </div>
                          )}
                          {supplierConfigs[item.produto_id].telefone && (
                            <div className="col-span-2">
                              <span className="font-bold text-amber-900/60 block uppercase text-[10px]">Contato</span>
                              <span className="font-medium text-amber-900">{maskPhone(supplierConfigs[item.produto_id].telefone)}</span>
                            </div>
                          )}
                          {supplierConfigs[item.produto_id].observacoes && (
                            <div className="col-span-2">
                              <span className="font-bold text-amber-900/60 block uppercase text-[10px]">Observações</span>
                              <span className="font-medium text-amber-900 italic">{supplierConfigs[item.produto_id].observacoes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div 
              onClick={() => ordem.produto_id ? handleProductClick(ordem.produto_id) : undefined}
              className={`flex items-center justify-between p-2 -mx-2 rounded-xl transition-all ${ordem.produto_id ? 'cursor-pointer hover:bg-white hover:shadow-sm ring-1 ring-transparent hover:ring-neutral-200' : ''}`}
            >
              <div>
                <p className="text-sm font-black text-neutral-800 uppercase">{ordem.produtos?.nome || 'Item da Loja'}</p>
                <p className="text-[10px] font-mono text-neutral-400" title={ordem.produtos ? getProductDisplayCodeLabel(ordem.produtos as any) : ''}>Código: {ordem.produtos ? getProductDisplayCode(ordem.produtos as any) : 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-neutral-800">{formatCurrency(ordem.produtos?.valor || 0)}</p>
                <p className="text-[10px] font-bold text-neutral-400">Qtd: {orcamento?.quantidade || ordem.quantidade || 1}</p>
              </div>
            </div>
          )}
        </div>

        {/* Endereço de Entrega */}
        {orcamento?.endereco_entrega && (
          <div className="rounded-3xl bg-neutral-50 p-6 border border-neutral-200 space-y-3">
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] flex items-center gap-1.5"><Truck className="w-4 h-4 text-indigo-500" /> Endereço de Entrega</h4>
            <div className="text-sm font-bold text-neutral-600">
              <p className="text-neutral-800">{orcamento.endereco_entrega.logradouro}, {orcamento.endereco_entrega.numero} {orcamento.endereco_entrega.complemento && `(${orcamento.endereco_entrega.complemento})`}</p>
              <p className="text-neutral-500 text-xs mt-1">{orcamento.endereco_entrega.bairro} - {orcamento.endereco_entrega.cidade}/{orcamento.endereco_entrega.uf}</p>
              <p className="text-neutral-500 text-xs mt-0.5">CEP: {orcamento.endereco_entrega.cep}</p>
            </div>
          </div>
        )}
      </div>

      {/* Coluna 2: Dados Financeiros & Status */}
      <div className="space-y-6">
        {/* Painel Financeiro Detalhado */}
        <div className="rounded-3xl bg-neutral-50 p-6 md:p-8 ring-1 ring-neutral-200 space-y-6">
          <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] border-b border-neutral-200 pb-3">Resumo Financeiro da Ordem</h4>
          
          <div className="space-y-2">
            {(() => {
              const total = Number(orcamento?.total || 0);
              const desconto = Number(orcamento?.desconto || 0);
              const taxaEnt = Number(orcamento?.taxa_entrega || 0);
              const acrescimo = Number(orcamento?.acrescimo || 0);
              // Subtotal = total antes de desconto, acrescimo e taxa de entrega
              const subtotalItens = total + desconto - taxaEnt - acrescimo;
              return (
                <>
                  <div className="flex justify-between text-sm font-medium text-neutral-500">
                    <span>Subtotal dos Itens</span>
                    <span>{formatCurrency(subtotalItens)}</span>
                  </div>
                  {(taxaEnt > 0 || !!orcamento?.endereco_entrega || relatedItems.some((item: any) => item.tipo === 'produto')) && (
                    <div className="flex justify-between text-sm font-medium text-neutral-500">
                      <span>Frete Total</span>
                      <span className={taxaEnt === 0 ? "text-emerald-600 font-bold" : ""}>
                        {taxaEnt > 0 ? formatCurrency(taxaEnt) : 'Grátis'}
                      </span>
                    </div>
                  )}
                  {(desconto - (walletDiscount || 0)) > 0 && (() => {
                    const realDesconto = Math.max(0, desconto - (walletDiscount || 0));
                    const currentPointsDiscount = pointsDiscount > 0 
                      ? pointsDiscount 
                      : (orcamento?.cupom_desconto_id ? 0 : realDesconto);

                    const couponDiscountValue = Math.max(0, realDesconto - currentPointsDiscount);

                    return (
                      <div className="space-y-1.5 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50 my-2">
                        <div className="flex justify-between text-sm font-black text-emerald-800">
                          <span>Descontos Aplicados</span>
                          <span>-{formatCurrency(realDesconto)}</span>
                        </div>
                        
                        {currentPointsDiscount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600 font-bold pl-3 border-l-2 border-emerald-300">
                            <span>Carteira de Pontos ({Math.round(currentPointsDiscount * 100)} pts)</span>
                            <span>-{formatCurrency(currentPointsDiscount)}</span>
                          </div>
                        )}

                        {couponDiscountValue > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600 font-bold pl-3 border-l-2 border-emerald-300">
                            <span>Cupom: {couponCode || 'Desconto'}</span>
                            <span>-{formatCurrency(couponDiscountValue)}</span>
                          </div>
                        )}

                        {orcamento?.cupom_entrega_id && (
                          <div className="flex justify-between text-xs text-emerald-600 font-bold pl-3 border-l-2 border-emerald-300">
                            <span>Cupom Frete</span>
                            <span>Frete Grátis</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(walletDiscount || 0) > 0 && (
                    <div className="flex justify-between text-sm font-medium text-neutral-500">
                      <span>Saldo da Carteira</span>
                      <span className="text-emerald-600 font-bold">-{formatCurrency(walletDiscount || 0)}</span>
                    </div>
                  )}
                  {acrescimo > 0 && (
                    <div className="flex justify-between text-sm font-bold text-amber-600">
                      <span>Juros do Crédito GSA</span>
                      <span>+{formatCurrency(acrescimo)}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-neutral-100 flex justify-between items-center">
                    <span className="text-base font-black text-[#1a1a1a]">Total Geral</span>
                    <span className="text-2xl font-black text-indigo-600">{formatCurrency(total)}</span>
                  </div>

                  {faturasCredito && faturasCredito.length > 0 ? (
                    <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between text-xs font-black text-emerald-800 uppercase tracking-wider">
                        <span>Forma de Pagamento:</span>
                        <span className="bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Crédito GSA Store</span>
                      </div>
                      
                      <div className="text-[11px] text-emerald-700 leading-normal font-semibold">
                        ✨ O pagamento via <strong>Crédito GSA Store</strong> foi aprovado instantaneamente.
                        Foram geradas <strong>{faturasCredito.length} faturas</strong> de amortização para este crédito.
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-emerald-100/50">
                        <span className="text-[9px] font-black text-emerald-900 uppercase tracking-wider block mb-3">Faturas de Amortização Geradas</span>
                        {faturasCredito.map((fat, idx) => (
                          <div key={fat.id} className="flex justify-between items-center p-3 text-xs text-emerald-800 font-medium bg-white/80 border border-emerald-100/40 rounded-xl shadow-sm mb-2">
                            <span>{idx + 1}ª Parcela ({fat.codigo_fatura || `Parcela ${idx+1}`})</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-800">{formatCurrency(fat.valor_total)}</span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                fat.status === 'pago' ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' : 'bg-orange-100 text-orange-800 border border-orange-200'
                              }`}>
                                {fat.status === 'pago' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : fatura?.pagamentos && fatura.pagamentos.length > 0 ? (
                    <div className="mt-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                      <div className="flex items-center justify-between text-xs font-black text-indigo-900 uppercase tracking-wider mb-2">
                        <span>Forma de Pagamento (Módulo Financeiro):</span>
                      </div>
                      
                      <div className="space-y-2">
                        {fatura.pagamentos.map((pag: any, idx: number) => {
                          let label = pag.metodo.toUpperCase();
                          let badgeColors = 'bg-neutral-100 text-neutral-800 border-neutral-200';
                          
                          if (pag.metodo === 'pix') { label = 'PIX'; badgeColors = 'bg-teal-100 text-teal-800 border-teal-200'; }
                          else if (pag.metodo === 'credit_card' || pag.metodo === 'cartao') { label = 'CARTÃO DE CRÉDITO'; badgeColors = 'bg-blue-100 text-blue-800 border-blue-200'; }
                          else if (pag.metodo === 'voucher') { label = 'VOUCHER'; badgeColors = 'bg-purple-100 text-purple-800 border-purple-200'; }
                          else if (pag.metodo === 'carteira') { label = 'SALDO CARTEIRA'; badgeColors = 'bg-amber-100 text-amber-800 border-amber-200'; }
                          else if (pag.metodo === 'pontos') { label = 'PONTOS FIDELIDADE'; badgeColors = 'bg-emerald-100 text-emerald-800 border-emerald-200'; }
                          else if (pag.metodo === 'boleto') { label = 'BOLETO BANCÁRIO'; badgeColors = 'bg-orange-100 text-orange-800 border-orange-200'; }

                          return (
                            <div key={idx} className="flex justify-between items-center text-sm font-semibold text-neutral-800 bg-white p-2 rounded-xl shadow-sm border border-neutral-100">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider border ${badgeColors}`}>
                                {label}
                              </span>
                              <span>{formatCurrency(pag.valor)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                      <div className="flex items-center justify-between text-xs font-black text-neutral-700 uppercase tracking-wider">
                        <span>Forma de Pagamento:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          (['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(ordem.status) || !!(ordem?.motivo_cancelamento || fatura?.status === 'pago')) ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500'
                        }`}>
                          {(['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(ordem.status) || !!(ordem?.motivo_cancelamento || fatura?.status === 'pago')) 
                            ? 'SALDO CARTEIRA/PONTOS' 
                            : 'Não definida'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 font-semibold mt-2">
                        {['pago', 'em_expedicao', 'em_transporte', 'concluido'].includes(ordem.status)
                          ? 'Pagamento processado integralmente via saldo da carteira ou pontos GSA.'
                          : 'Pagamento a ser verificado mediante fatura convencional gerada pelo sistema.'}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Painel de Ações de Entrega & Status */}
        <div className="rounded-3xl bg-indigo-50/50 p-6 md:p-8 border border-indigo-100 space-y-6">
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-600" /> Status da Compra & Logística</h4>

          {/* Fatura */}
          {fatura && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 font-bold">Fatura de Venda:</span>
              <span className={`rounded-full px-3 py-0.5 text-xs font-black uppercase ${
                isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {fatura.codigo_fatura} ({isPaid ? 'Pago' : 'Aguardando Pagamento'})
              </span>
            </div>
          )}

          {/* Seletor de Status (Liberado apenas quando pago) */}
          {isPaid ? (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-black text-[#1a1a1a] uppercase tracking-wider">Mudar Status de Entrega do Cliente</label>
              <select
                value={ordem.status}
                disabled={ordem.status === 'concluido'}
                onChange={(e) => {
                  if (onUpdateStatus) {
                    onUpdateStatus(ordem.id, e.target.value as any);
                  }
                }}
                className="w-full bg-white rounded-xl border border-indigo-200 px-4 py-3 text-xs font-black text-neutral-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase tracking-wider disabled:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-200 disabled:cursor-not-allowed"
              >
                <option value="pago">📦 Pedido Aprovado (Pago)</option>
                <option value="em_expedicao">📦 Em Expedição</option>
                <option value="em_transporte">🚚 Em Transporte</option>
                <option value="concluido">✅ Pedido Entregue</option>
              </select>
              <p className="text-[10px] text-neutral-500 leading-normal">
                Ao alterar este status, o cliente será avisado em tempo real em seu painel de compras e receberá notificação no sistema.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <p className="text-xs text-amber-800 font-bold leading-normal">
                🔒 O controle de status de logística está bloqueado até que o pagamento da fatura seja confirmado.
              </p>
            </div>
          )}

          {/* Botões de Ação Gerais (Cancelar / Concluir) */}
          {showActions && (
            <div className="flex gap-4 pt-4 border-t border-indigo-100/80">
              {isPaid && onUpdateStatus && ordem.status !== 'concluido' && (
                <button 
                  onClick={() => onUpdateStatus(ordem.id, 'concluido')}
                  className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Concluir Entrega
                </button>
              )}
              {onCancelClick && (
                <button 
                  onClick={onCancelClick}
                  className="flex-1 rounded-2xl bg-red-50 hover:bg-red-100 py-3.5 text-red-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar Ordem
                </button>
              )}
              {ordem.clientes?.telefone && (
                <div className="flex items-center justify-center scale-90 origin-left">
                  <AdminWhatsAppButton
                    telefone={ordem.clientes.telefone}
                    mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                      tipo: 'venda',
                      clienteNome: ordem.clientes.nome,
                      codigo: ordem.codigo_ordem || `#OC-${ordem.id.slice(0, 4).toUpperCase()}`,
                      status: ordem.status,
                      valorTotal: formatCurrency(ordem.orcamentos?.total ?? (ordem.produtos?.valor || 0))
                    })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Observações Administrativas */}
      <div className="col-span-1 lg:col-span-2 mt-4 rounded-3xl bg-neutral-50 p-6 md:p-8 ring-1 ring-neutral-200">
        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-1.5 mb-4">
          <Save className="w-4 h-4 text-indigo-600" /> Observações Administrativas Internas
        </h4>
        <p className="text-[10px] text-neutral-500 mb-4">Este campo é exclusivo para o administrativo e persistirá ao longo de todas as etapas do pedido.</p>
        <div className="relative">
          <textarea
            value={observacoesInternas}
            onChange={(e) => setObservacoesInternas(e.target.value)}
            placeholder="Adicione observações internas do pedido..."
            className="w-full h-32 bg-white rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
          />
          <button
            onClick={handleSaveObservacoes}
            disabled={savingObs || observacoesInternas === (ordem.observacoes_internas || '')}
            className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingObs ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Modal Detalhes do Produto */}
      <Modal isOpen={isProdutoModalOpen} onClose={() => setIsProdutoModalOpen(false)} title="Detalhes do Produto" size="wide">
        {selectedProdutoDetalhe && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="flex h-20 w-20 overflow-hidden items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shrink-0 border border-neutral-200">
                    {selectedProdutoDetalhe.imagem_url ? (
                      <img src={selectedProdutoDetalhe.imagem_url} alt={selectedProdutoDetalhe.nome} className="h-full w-full object-contain" />
                    ) : (
                      <ShoppingBag className="h-8 w-8 text-indigo-300" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${selectedProdutoDetalhe.tipo_cliente === 'pf' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                        {selectedProdutoDetalhe.tipo_cliente === 'pf' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                        {selectedProdutoDetalhe.tipo_cliente === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                      </span>
                      <span className="font-mono text-sm font-bold text-neutral-400" title={getProductDisplayCodeLabel(selectedProdutoDetalhe)}>{getProductDisplayCode(selectedProdutoDetalhe)}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900">{selectedProdutoDetalhe.nome}</h3>
                  </div>
                </div>
              </div>

              {selectedProdutoDetalhe.categorias?.nome && (
                <span className="inline-block mt-2 rounded-lg bg-neutral-200/60 px-3 py-1 text-xs font-bold text-neutral-600 uppercase tracking-wider">
                  Categoria: {selectedProdutoDetalhe.categorias.nome}
                </span>
              )}
              
              <p className="mt-4 text-sm text-neutral-600">{selectedProdutoDetalhe.descricao || 'Sem descrição disponível.'}</p>
              
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-6">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Custo</p>
                  <p className="text-xl font-black text-neutral-500">{formatCurrency(selectedProdutoDetalhe.valor_custo || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Margem / Lucro</p>
                  <p className="text-xl font-black text-emerald-600">
                    +{selectedProdutoDetalhe.porcentagem_lucro || 0}% 
                    <span className="text-[10px] ml-1 text-neutral-400">({formatCurrency((selectedProdutoDetalhe.valor || 0) - (selectedProdutoDetalhe.valor_custo || 0))})</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Venda (Final)</p>
                  <p className="text-2xl font-black text-indigo-600">{formatCurrency(selectedProdutoDetalhe.valor)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
