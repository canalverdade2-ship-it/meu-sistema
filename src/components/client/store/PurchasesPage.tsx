import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  CreditCard,
  QrCode,
  Truck,
  RotateCcw,
  Star,
  Eye,
  Trash2,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  ExternalLink,
  MapPin,
  Coins,
  ShieldCheck,
  RefreshCw,
  FileText,
  DollarSign,
  Layers,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, formatDate, generateUUID } from '../../../lib/utils';
import { getProductDisplayCode } from '../../../lib/productIdentification';
import { callClientRpc } from '../../../lib/clientRpc';
import { clientOperationalWrite } from '../../../lib/clientOperationalWrite';
import { createInfinitePayOrderCheckout } from '../../../lib/pixService';
import { routes } from '../../../routing/routeCatalog';
import { navigate } from '../../../routing/navigationService';
import { useSEO } from '../../../hooks/useSEO';
import { EcommerceHeader } from './EcommerceHeader';
import { OrderReviewModal } from './OrderReviewModal';
import { CheckoutPixModal } from './CheckoutPixModal';

interface PurchasesPageProps {
  clientId?: string;
  onRequireAuth?: () => void;
  initialOrderId?: string;
}

type TabFilter = 'todos' | 'pendentes' | 'em_andamento' | 'concluidos' | 'cancelados';
type PeriodFilter = 'todos' | '30dias' | '3meses' | '2026';

type OrderPresentation = {
  status: string;
  label: string;
  tone: string;
  dot: string;
  isCredit: boolean;
  isSubscription: boolean;
  isPaid: boolean;
  isAwaiting: boolean;
  isExpired: boolean;
  canPay: boolean;
  canCancelPending: boolean;
  canRequestCancellation: boolean;
  hoursLeft: number;
  minutesLeft: number;
};

function getOrderStatus(order: any): string {
  let status = order.ordens_items?.[0]?.status || order.status || 'em_analise';
  const isSubscription = order.ordens_items?.[0]?.tipo === 'assinatura';
  if (isSubscription && order.ordens_items?.[0]?.faturas?.some((invoice: any) => invoice.status === 'pago')) {
    status = 'pago';
  }
  return status;
}

function getPresentation(order: any): OrderPresentation {
  const status = getOrderStatus(order);
  const isCredit = Boolean(
    order.forma_pagamento_loja === 'credito_loja' ||
    order.descricao_adicional?.includes('Credito GSA') ||
    order.descricao_adicional?.includes('Crédito GSA')
  );
  const isSubscription = order.ordens_items?.[0]?.tipo === 'assinatura';
  const createdAt = new Date(order.data_criacao);
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const remainingMs = expiresAt.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  const minutesLeft = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));
  const expiredPending = !isCredit
    && remainingMs <= 0
    && ['aberto', 'em_analise'].includes(status);
  const isCancelled = status === 'cancelado';
  const isExpired = isCancelled || expiredPending;
  const isPaid = ['pago', 'aprovado', 'em_expedicao', 'em_transporte', 'concluido'].includes(status) || isCredit;
  const isAwaiting = ['aberto', 'em_analise'].includes(status) && !isCredit && !isExpired;

  let label = 'Em análise';
  let tone = 'border-amber-200 bg-amber-50 text-amber-800';
  let dot = 'bg-amber-500';

  if (isExpired) {
    label = 'Cancelado';
    tone = 'border-rose-200 bg-rose-50 text-rose-700';
    dot = 'bg-rose-500';
  } else if (status === 'concluido') {
    label = 'Entregue';
    tone = 'border-emerald-200 bg-emerald-50 text-emerald-800';
    dot = 'bg-emerald-500';
  } else if (status === 'em_transporte') {
    label = 'Em transporte';
    tone = 'border-blue-200 bg-blue-50 text-blue-800';
    dot = 'bg-blue-500';
  } else if (status === 'em_expedicao') {
    label = 'Em preparação';
    tone = 'border-sky-200 bg-sky-50 text-sky-800';
    dot = 'bg-sky-500';
  } else if (isPaid) {
    label = isSubscription ? 'Assinatura ativa' : 'Pagamento aprovado';
    tone = 'border-emerald-200 bg-emerald-50 text-emerald-800';
    dot = 'bg-emerald-500';
  } else if (isAwaiting) {
    label = 'Aguardando pagamento';
    tone = 'border-amber-200 bg-amber-50 text-amber-800';
    dot = 'bg-amber-500';
  }

  return {
    status,
    label,
    tone,
    dot,
    isCredit,
    isSubscription,
    isPaid,
    isAwaiting,
    isExpired,
    canPay: isAwaiting && Number(order.total || 0) > 0,
    canCancelPending: isAwaiting && Number(order.total || 0) > 0,
    canRequestCancellation: isPaid && ['aprovado', 'pago'].includes(status),
    hoursLeft,
    minutesLeft,
  };
}

export function PurchasesPage({ clientId, onRequireAuth, initialOrderId }: PurchasesPageProps) {
  useSEO({
    title: 'Minhas Compras — Loja GSA Store',
    description: 'Acompanhe seus pedidos, rastreamento de entregas, notas fiscais e pagamentos da GSA Store.',
    type: 'website'
  });

  const [loading, setLoading] = useState(true);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('todos');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modais de ações
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [selectedOrderReview, setSelectedOrderReview] = useState<any>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<any>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [isReordering, setIsReordering] = useState<string | null>(null);

  // Modal PIX
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState<{
    orderId: string;
    orderCode: string;
    total: number;
    pixCode: string;
    qrCodeUrl: string;
    checkoutUrl?: string;
  } | null>(null);

  // Cliente info
  const [clienteInfo, setClienteInfo] = useState<{ nome: string; email: string; telefone: string } | null>(null);

  // Copiado
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Código do pedido copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Carregar dados do cliente
  useEffect(() => {
    if (!clientId) {
      onRequireAuth?.();
      return;
    }

    const fetchClient = async () => {
      const { data } = await supabase
        .from('clientes')
        .select('nome, email, telefone')
        .eq('id', clientId)
        .single();
      if (data) setClienteInfo(data);
    };
    fetchClient();
  }, [clientId, onRequireAuth]);

  // Carregar compras
  const fetchPurchases = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data: orcamentos, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('cliente_id', clientId)
        .eq('origem_gsa_store', true)
        .order('data_criacao', { ascending: false });

      if (error) throw error;

      const ids = (orcamentos || []).map(o => o.id);

      const [ocsRes, oasRes, normalizedRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('ordens_compra').select('*, produtos(nome, imagem_url, codigo_produto, codigo_barras, identificador_preferencial, valor)').in('orcamento_id', ids)
          : Promise.resolve({ data: [] }),
        ids.length > 0
          ? supabase.from('ordens_assinatura').select('*, assinaturas(nome, imagem_url, codigo_assinatura, valor), faturas(*)').in('orcamento_id', ids)
          : Promise.resolve({ data: [] }),
        ids.length > 0
          ? supabase.from('loja_pedido_itens').select('*').in('orcamento_id', ids).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      const ocsByOrc = (ocsRes.data || []).reduce((acc: any, oc: any) => {
        if (!acc[oc.orcamento_id]) acc[oc.orcamento_id] = [];
        acc[oc.orcamento_id].push({ ...oc, tipo: 'produto' });
        return acc;
      }, {});

      const oasByOrc = (oasRes.data || []).reduce((acc: any, oa: any) => {
        if (!acc[oa.orcamento_id]) acc[oa.orcamento_id] = [];
        acc[oa.orcamento_id].push({ ...oa, tipo: 'assinatura' });
        return acc;
      }, {});

      const normalizedByOrc = (normalizedRes.data || []).reduce((acc: any, item: any) => {
        if (!acc[item.orcamento_id]) acc[item.orcamento_id] = [];
        acc[item.orcamento_id].push({
          ...item,
          descricao: item.nome,
        });
        return acc;
      }, {});

      const enriched = (orcamentos || []).map(orc => ({
        ...orc,
        ordens_items: normalizedByOrc[orc.id]?.length
          ? normalizedByOrc[orc.id].map((item: any) => ({ ...item, status: orc.status }))
          : [...(ocsByOrc[orc.id] || []), ...(oasByOrc[orc.id] || [])],
      }));

      // Auto-cancelar pedidos expirados (24h)
      const now = new Date();
      const updated = enriched.map(order => {
        const created = new Date(order.data_criacao);
        const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
        const isCredit = order.descricao_adicional?.includes('Crédito GSA');
        if (!isCredit && order.status === 'aberto' && hoursDiff > 24) {
          return { ...order, status: 'cancelado', is_expired: true };
        }
        return order;
      });

      setAllPurchases(updated);

      // Se passou initialOrderId por parâmetro, abre diretamente os detalhes
      if (initialOrderId && updated.length > 0) {
        const found = updated.find(o => o.id === initialOrderId || o.codigo_orcamento === initialOrderId);
        if (found) setSelectedOrderDetail(found);
      }

    } catch (err) {
      console.error('[PurchasesPage] Erro ao carregar pedidos:', err);
      toast.error('Erro ao carregar seu histórico de compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [clientId]);

  // Inscrição em tempo real para atualizações nos pedidos do cliente
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`loja-compras-client-${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orcamentos',
        filter: `cliente_id=eq.${clientId}`
      }, () => {
        fetchPurchases();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  // Contadores por Aba
  const tabCounts = useMemo(() => {
    let pendentes = 0;
    let em_andamento = 0;
    let concluidos = 0;
    let cancelados = 0;

    allPurchases.forEach(order => {
      const pres = getPresentation(order);
      if (pres.isAwaiting) pendentes++;
      else if (pres.isExpired) cancelados++;
      else if (pres.status === 'concluido') concluidos++;
      else if (pres.isPaid) em_andamento++;
    });

    return {
      todos: allPurchases.length,
      pendentes,
      em_andamento,
      concluidos,
      cancelados,
    };
  }, [allPurchases]);

  // Métricas do Dashboard (KPIs)
  const stats = useMemo(() => {
    const totalGasto = allPurchases
      .filter(o => !getPresentation(o).isExpired)
      .reduce((acc, cur) => acc + Number(cur.total || 0), 0);

    const totalPontos = allPurchases
      .filter(o => getPresentation(o).isPaid && !getPresentation(o).isExpired)
      .reduce((acc, cur) => acc + Math.floor(Number(cur.total || 0)), 0);

    return {
      totalGasto,
      totalPontos,
      totalPedidos: allPurchases.length,
      pendentes: tabCounts.pendentes,
      emAndamento: tabCounts.em_andamento,
    };
  }, [allPurchases, tabCounts]);

  // Filtragem dos Pedidos
  const filteredOrders = useMemo(() => {
    let result = [...allPurchases];

    // 1. Filtro por Aba
    if (activeTab === 'pendentes') {
      result = result.filter(o => getPresentation(o).isAwaiting);
    } else if (activeTab === 'em_andamento') {
      result = result.filter(o => {
        const pres = getPresentation(o);
        return pres.isPaid && !pres.isExpired && pres.status !== 'concluido';
      });
    } else if (activeTab === 'concluidos') {
      result = result.filter(o => getPresentation(o).status === 'concluido');
    } else if (activeTab === 'cancelados') {
      result = result.filter(o => getPresentation(o).isExpired);
    }

    // 2. Filtro por Período
    if (periodFilter !== 'todos') {
      const now = new Date();
      result = result.filter(order => {
        const orderDate = new Date(order.data_criacao);
        if (periodFilter === '30dias') {
          const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 30;
        } else if (periodFilter === '3meses') {
          const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 90;
        } else if (periodFilter === '2026') {
          return orderDate.getFullYear() === 2026;
        }
        return true;
      });
    }

    // 3. Filtro por Busca (Código, Nome do Produto, etc)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(order => {
        const code = String(order.codigo_orcamento || order.id || '').toLowerCase();
        const hasItemMatch = (order.ordens_items || []).some((item: any) => {
          const name = String(item.nome || item.descricao || item.produtos?.nome || item.assinaturas?.nome || '').toLowerCase();
          const sku = String(item.produtos?.codigo_produto || item.assinaturas?.codigo_assinatura || '').toLowerCase();
          return name.includes(q) || sku.includes(q);
        });
        return code.includes(q) || hasItemMatch;
      });
    }

    return result;
  }, [allPurchases, activeTab, periodFilter, searchQuery]);

  // Ação: Pagar Pedido Pendente (PIX ou Fatura)
  const handlePayOrder = async (order: any) => {
    const isPix = order.forma_pagamento_loja === 'pix' || order.descricao_adicional?.includes('PIX') || !order.forma_pagamento_loja;
    
    if (isPix) {
      try {
        toast.loading('Gerando QR Code PIX...', { id: 'pix-pay' });
        const codigoOrcamento = order.codigo_orcamento || `ODC-${order.id?.slice(0, 8)}`;
        const checkoutInfo = await createInfinitePayOrderCheckout({
          orcamentoId: order.id,
          codigoOrcamento: codigoOrcamento,
          clienteId: clientId,
          valorLiquido: Number(order.total || 0),
          clienteNome: clienteInfo?.nome || '',
          clienteEmail: clienteInfo?.email || '',
          clienteTelefone: clienteInfo?.telefone || '',
        });

        toast.dismiss('pix-pay');

        setPixModalData({
          orderId: order.id,
          orderCode: codigoOrcamento,
          total: Number(order.total || 0),
          pixCode: checkoutInfo.pixCode || '',
          qrCodeUrl: checkoutInfo.qrCodeUrl || '',
          checkoutUrl: checkoutInfo.link,
        });
        setPixModalOpen(true);
      } catch (err: any) {
        toast.dismiss('pix-pay');
        console.error('[PurchasesPage] Erro ao pagar PIX:', err);
        toast.error(err.message || 'Erro ao gerar pagamento PIX.');
      }
      return;
    }

    // Outras formas de pagamento (Fatura)
    try {
      toast.loading('Preparando fatura...', { id: 'inv-pay' });
      const data = await callClientRpc<any>('gsa_client_generate_store_invoice', {
        p_orcamento_id: order.id,
      });
      toast.dismiss('inv-pay');
      if (data?.fatura_id) {
        navigate(routes.client.financeiro.detalhe(data.fatura_id));
      } else {
        toast.success('Redirecionando para pagamento...');
        fetchPurchases();
      }
    } catch (err: any) {
      toast.dismiss('inv-pay');
      toast.error(err.message || 'Erro ao processar fatura.');
    }
  };

  // Ação: Cancelar Pedido Pendente
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    setIsSubmittingCancel(true);
    try {
      await callClientRpc('gsa_client_cancel_store_order', {
        p_orcamento_id: cancelModalOrder.id,
        p_motivo: cancelMotivo.trim() || 'Cancelado pelo cliente na página de compras',
      });
      toast.success('Pedido cancelado com sucesso.');
      setCancelModalOrder(null);
      setCancelMotivo('');
      fetchPurchases();
    } catch (err: any) {
      console.error('[PurchasesPage] Erro ao cancelar:', err);
      toast.error(err.message || 'Não foi possível cancelar o pedido.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Ação: Comprar Novamente (Adicionar itens ao carrinho)
  const handleReorder = async (order: any) => {
    if (!clientId) return;
    setIsReordering(order.id);
    try {
      const items = order.ordens_items || [];
      if (items.length === 0) {
        toast.error('Nenhum item disponível para repetir compra.');
        return;
      }

      for (const item of items) {
        const itemId = item.item_id || item.produto_id || item.assinatura_id;
        const tipo = item.tipo || (item.produto_id ? 'produto' : 'assinatura');
        const qtd = Number(item.quantidade || 1);

        if (!itemId) continue;

        // Verificar se já está no carrinho
        const { data: existing } = await supabase
          .from('loja_carrinhos')
          .select('id, quantidade')
          .eq('cliente_id', clientId)
          .eq('item_id', itemId)
          .maybeSingle();

        if (existing) {
          await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', {
            quantidade: existing.quantidade + qtd
          }, { id: existing.id });
        } else {
          await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', {
            cliente_id: clientId,
            item_id: itemId,
            tipo: tipo,
            quantidade: qtd,
            prazo_meses: item.prazo_meses || 1
          });
        }
      }

      window.dispatchEvent(new CustomEvent('gsa-cart-updated'));
      toast.success('Itens adicionados ao seu carrinho! Redirecionando para o checkout...');
      setTimeout(() => {
        navigate(routes.marketplace.store.checkout());
      }, 1000);
    } catch (err: any) {
      console.error('[PurchasesPage] Erro ao comprar novamente:', err);
      toast.error('Erro ao adicionar itens ao carrinho.');
    } finally {
      setIsReordering(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-neutral-900 selection:bg-[#17345f] selection:text-white">
      
      {/* Header Unificado da Loja */}
      <EcommerceHeader 
        clientId={clientId}
        onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
        onRequireAuth={onRequireAuth}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full space-y-6 sm:space-y-8">
        
        {/* Breadcrumb & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <nav className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              <button 
                type="button" 
                onClick={() => navigate(routes.marketplace.root())} 
                className="hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Início
              </button>
              <ChevronRight className="h-3 w-3" />
              <button 
                type="button" 
                onClick={() => navigate(routes.marketplace.store.products())} 
                className="hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Loja GSA Store
              </button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#17345f] font-bold">Minhas Compras</span>
            </nav>
            
            <div className="flex items-center gap-3 pt-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-950">
                Minhas Compras & Pedidos
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#17345f]/10 text-[#17345f]">
                {stats.totalPedidos} {stats.totalPedidos === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium">
              Consulte seu histórico de compras, acompanhe entregas em tempo real e gerencie pagamentos.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(routes.marketplace.store.products())}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17345f] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all hover:bg-[#102746] cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Explorar Loja</span>
            </button>
          </div>
        </div>

        {/* Dashboard de Resumo / KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {/* Card 1: Total de Pedidos */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Total de Pedidos</span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-neutral-900">{stats.totalPedidos}</span>
              <span className="text-xs font-black text-neutral-500">{formatCurrency(stats.totalGasto)}</span>
            </div>
          </div>

          {/* Card 2: Aguardando Pagamento */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Pendentes</span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock3 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">{stats.pendentes}</span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {stats.pendentes > 0 ? 'Pagar agora' : 'Tudo em dia'}
              </span>
            </div>
          </div>

          {/* Card 3: Em Andamento / Transporte */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">Em Envio</span>
              <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-sky-700">{stats.emAndamento}</span>
              <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                {stats.emAndamento > 0 ? 'A caminho' : 'Sem envios ativos'}
              </span>
            </div>
          </div>

          {/* Card 4: Pontos VIP Acumulados */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-3xl p-4 sm:p-5 border border-amber-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">Pontos VIP</span>
              <div className="h-8 w-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-900">+{stats.totalPontos.toLocaleString()}</span>
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Acumulados</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros, Abas & Busca */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-neutral-200/90 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Abas com Contadores */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {([
                { id: 'todos', label: 'Todos os Pedidos', count: tabCounts.todos },
                { id: 'pendentes', label: 'Aguardando Pagamento', count: tabCounts.pendentes, tone: 'text-amber-700' },
                { id: 'em_andamento', label: 'Em Andamento', count: tabCounts.em_andamento, tone: 'text-sky-700' },
                { id: 'concluidos', label: 'Entregues', count: tabCounts.concluidos, tone: 'text-emerald-700' },
                { id: 'cancelados', label: 'Cancelados', count: tabCounts.cancelados, tone: 'text-rose-700' },
              ] as const).map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabFilter)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#17345f] text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Busca & Período */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Campo de Busca */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por #código ou item..."
                  className="w-full pl-9 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17345f]/20 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro Período */}
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
                className="w-full sm:w-auto px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#17345f]/20 cursor-pointer"
              >
                <option value="todos">Todos os períodos</option>
                <option value="30dias">Últimos 30 dias</option>
                <option value="3meses">Últimos 3 meses</option>
                <option value="2026">Ano 2026</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Pedidos */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-3xl bg-white border border-neutral-200/90 animate-pulse p-6">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="h-4 w-32 bg-neutral-200 rounded" />
                  <div className="h-6 w-24 bg-neutral-200 rounded-full" />
                </div>
                <div className="mt-4 flex gap-4">
                  <div className="h-20 w-20 bg-neutral-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-neutral-200 rounded" />
                    <div className="h-3 w-32 bg-neutral-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-neutral-200/90 shadow-sm space-y-4 max-w-lg mx-auto">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-neutral-900">Nenhum pedido encontrado</h3>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                {searchQuery 
                  ? 'Não encontramos nenhum pedido com o termo pesquisado. Tente buscar por outro código ou produto.'
                  : activeTab !== 'todos'
                    ? 'Você não possui pedidos nesta situação no momento.'
                    : 'Você ainda não realizou compras na GSA Store. Explore nosso catálogo e aproveite as ofertas exclusivas!'}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(routes.marketplace.store.products())}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#17345f] px-5 py-3 text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all hover:bg-[#102746] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Explorar Catálogo da Loja</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map(order => {
              const presentation = getPresentation(order);
              const items = order.ordens_items || [];
              const itemCount = items.length || order.quantidade || 1;
              const orderCode = order.codigo_orcamento?.startsWith('#')
                ? order.codigo_orcamento
                : `#${order.codigo_orcamento || order.codigo_ordem || 'PEDIDO'}`;
              const isPix = order.forma_pagamento_loja === 'pix' || order.descricao_adicional?.includes('PIX') || !order.forma_pagamento_loja;

              return (
                <article
                  key={order.id}
                  className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Cabeçalho do Card do Pedido (Amazon/MercadoLivre Style) */}
                  <div className="bg-neutral-50/80 px-5 sm:px-7 py-4 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Data & Código */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                          Data do Pedido
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-neutral-800 mt-0.5">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{formatDate(order.data_criacao)}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                          Código do Pedido
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-black text-neutral-900">{orderCode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(orderCode, order.id)}
                            className="text-neutral-400 hover:text-neutral-700 cursor-pointer p-0.5 rounded transition-colors"
                            title="Copiar código do pedido"
                          >
                            {copiedId === order.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                          Forma de Pagamento
                        </span>
                        <div className="flex items-center gap-1 font-bold text-neutral-700 mt-0.5">
                          {isPix ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-black">
                              <QrCode className="h-3.5 w-3.5" /> PIX (-5%)
                            </span>
                          ) : presentation.isCredit ? (
                            <span className="inline-flex items-center gap-1 text-indigo-700 font-black">
                              <Coins className="h-3.5 w-3.5" /> Crédito GSA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-neutral-700">
                              <CreditCard className="h-3.5 w-3.5" /> Cartão de Crédito
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total & Badge de Status */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                          Total
                        </span>
                        <span className="text-base sm:text-lg font-black text-[#17345f]">
                          {formatCurrency(order.total || 0)}
                        </span>
                      </div>

                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${presentation.tone}`}>
                        <span className={`h-2 w-2 rounded-full ${presentation.dot} ${presentation.isAwaiting ? 'animate-ping' : ''}`} />
                        <span>{presentation.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Corpo do Pedido: Itens & Stepper */}
                  <div className="p-5 sm:p-7 space-y-6">
                    
                    {/* Alerta de Prazo de Pagamento (se pendente) */}
                    {presentation.isAwaiting && (
                      <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 font-bold text-amber-900">
                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>
                            Pagamento pendente. Seu pedido expira em <strong>{presentation.hoursLeft}h {presentation.minutesLeft}min</strong>.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePayOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs cursor-pointer shadow-xs transition-all shrink-0"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          Pagar Agora
                        </button>
                      </div>
                    )}

                    {/* Stepper de Rastreamento da Entrega (se pago e não cancelado) */}
                    {!presentation.isExpired && presentation.isPaid && (
                      <div className="bg-neutral-50/60 rounded-2xl p-4 border border-neutral-200/60">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-500 mb-3">
                          <span className="flex items-center gap-1.5 text-neutral-800 font-extrabold uppercase tracking-wider text-[11px]">
                            <Truck className="h-4 w-4 text-[#17345f]" />
                            Status de Envio & Rastreamento
                          </span>
                          {order.codigo_rastreio && (
                            <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              Rastreio: {order.codigo_rastreio}
                            </span>
                          )}
                        </div>

                        {/* Barra Stepper */}
                        <div className="grid grid-cols-4 gap-2 relative">
                          {([
                            { label: 'Pedido Feito', icon: CheckCircle2, done: true },
                            { label: 'Aprovado', icon: ShieldCheck, done: presentation.isPaid },
                            { label: 'Em Transporte', icon: Truck, done: ['em_transporte', 'concluido'].includes(presentation.status) },
                            { label: 'Entregue', icon: CheckCircle2, done: presentation.status === 'concluido' },
                          ] as const).map((step, idx) => (
                            <div key={idx} className="flex flex-col items-center text-center gap-1.5">
                              <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                                step.done 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'bg-neutral-200 text-neutral-400'
                              }`}>
                                <step.icon className="h-4 w-4" />
                              </div>
                              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                                step.done ? 'text-emerald-800' : 'text-neutral-400'
                              }`}>
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de Itens do Pedido */}
                    <div className="divide-y divide-neutral-100">
                      {items.map((item: any, idx: number) => {
                        const img = item.produtos?.imagem_url || item.assinaturas?.imagem_url || item.imagem_url;
                        const nome = item.nome || item.descricao || item.produtos?.nome || item.assinaturas?.nome || 'Item do Pedido';
                        const sku = item.produtos ? getProductDisplayCode(item.produtos) : (item.assinaturas?.codigo_assinatura || '');
                        const unitPrice = Number(item.valor_unitario || item.valor || item.produtos?.valor || item.assinaturas?.valor || 0);
                        const itemSubtotal = unitPrice * (item.quantidade || 1);
                        const pontosItem = Math.floor(itemSubtotal);

                        return (
                          <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              
                              {/* Imagem do Item */}
                              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden shrink-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={nome} className="h-full w-full object-contain p-1" />
                                ) : (
                                  <Package className="h-8 w-8 text-neutral-300" />
                                )}
                              </div>

                              {/* Informações do Item */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <span className="font-bold text-neutral-900 text-sm block truncate">
                                  {nome}
                                </span>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 font-medium">
                                  {sku && (
                                    <span className="font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.2 rounded">
                                      {sku}
                                    </span>
                                  )}
                                  <span>Qtd: <strong>{item.quantidade || 1}x</strong></span>
                                  <span>Unit: {formatCurrency(unitPrice)}</span>
                                  <span className="text-amber-700 font-black bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                                    👑 +{pontosItem} pts
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Subtotal do Item */}
                            <div className="text-right shrink-0">
                              <span className="text-sm font-black text-neutral-900 block">
                                {formatCurrency(itemSubtotal)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Endereço de Entrega (se houver) */}
                    {order.endereco_entrega && (
                      <div className="flex items-start gap-2.5 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/70">
                        <MapPin className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold uppercase tracking-wider text-[10px] text-neutral-400 block">
                            Endereço de Envio
                          </span>
                          <p className="font-medium text-neutral-800">
                            {order.endereco_entrega.logradouro}, {order.endereco_entrega.numero}
                            {order.endereco_entrega.complemento && ` (${order.endereco_entrega.complemento})`}
                            {' — '}{order.endereco_entrega.bairro}, {order.endereco_entrega.cidade}/{order.endereco_entrega.uf} · CEP: {order.endereco_entrega.cep}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barra de Ações Rápidas (Rodapé do Card) */}
                  <div className="bg-neutral-50/80 px-5 sm:px-7 py-3.5 border-t border-neutral-200/80 flex flex-wrap items-center justify-between gap-2.5">
                    
                    {/* Botão Ver Detalhes */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetail(order)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-700 shadow-2xs transition-all cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-neutral-500" />
                      <span>Detalhes da Compra</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      
                      {/* Botão Avaliar (se entregue) */}
                      {presentation.status === 'concluido' && (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderReview(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-xs font-black text-amber-800 shadow-2xs transition-all cursor-pointer"
                        >
                          <Star className="h-3.5 w-3.5 text-amber-600" />
                          <span>Avaliar Produto</span>
                        </button>
                      )}

                      {/* Botão Comprar Novamente */}
                      <button
                        type="button"
                        disabled={isReordering === order.id}
                        onClick={() => handleReorder(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-700 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 text-neutral-500 ${isReordering === order.id ? 'animate-spin' : ''}`} />
                        <span>{isReordering === order.id ? 'Adicionando...' : 'Comprar Novamente'}</span>
                      </button>

                      {/* Botão Cancelar Pedido (se pendente) */}
                      {presentation.canCancelPending && (
                        <button
                          type="button"
                          onClick={() => setCancelModalOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 shadow-2xs transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          <span>Cancelar</span>
                        </button>
                      )}

                      {/* Botão Pagar Agora (se pendente) */}
                      {presentation.canPay && (
                        <button
                          type="button"
                          onClick={() => handlePayOrder(order)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17345f] hover:bg-[#102746] text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all cursor-pointer"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pagar Agora</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Detalhes Completos do Pedido */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#17345f] text-white flex items-center justify-center shadow-xs">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                    Detalhes do Pedido #{selectedOrderDetail.codigo_orcamento || selectedOrderDetail.id?.slice(0, 8)}
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-medium">
                    Realizado em {formatDate(selectedOrderDetail.data_criacao)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="h-8 w-8 rounded-full bg-neutral-200/70 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Status do Pedido */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                    Situação Atual
                  </span>
                  <span className="text-sm font-black text-neutral-900 mt-0.5 block">
                    {getPresentation(selectedOrderDetail).label}
                  </span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${getPresentation(selectedOrderDetail).tone}`}>
                  <span className={`h-2 w-2 rounded-full ${getPresentation(selectedOrderDetail).dot}`} />
                  {getPresentation(selectedOrderDetail).label}
                </div>
              </div>

              {/* Itens Comprados */}
              <div className="space-y-3">
                <h4 className="font-black text-neutral-900 uppercase tracking-wider text-[11px]">
                  Itens do Pedido ({(selectedOrderDetail.ordens_items || []).length})
                </h4>
                <div className="border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
                  {(selectedOrderDetail.ordens_items || []).map((item: any, idx: number) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-neutral-900 block">
                          {item.nome || item.descricao || item.produtos?.nome || item.assinaturas?.nome}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {item.quantidade || 1}x · {formatCurrency(item.valor_unitario || item.valor || item.produtos?.valor || 0)} cada
                        </span>
                      </div>
                      <span className="font-black text-neutral-900">
                        {formatCurrency((item.valor_unitario || item.valor || item.produtos?.valor || 0) * (item.quantidade || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discriminação Financeira Completa */}
              <div className="space-y-3">
                <h4 className="font-black text-neutral-900 uppercase tracking-wider text-[11px]">
                  Resumo Financeiro
                </h4>
                <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 space-y-2">
                  <div className="flex justify-between text-neutral-600 font-medium">
                    <span>Subtotal dos itens</span>
                    <span className="font-bold text-neutral-900">
                      {formatCurrency((selectedOrderDetail.ordens_items || []).reduce((acc: number, cur: any) => acc + (Number(cur.valor_unitario || cur.valor || 0) * Number(cur.quantidade || 1)), 0))}
                    </span>
                  </div>

                  {Number(selectedOrderDetail.taxa_entrega || 0) > 0 && (
                    <div className="flex justify-between text-neutral-600 font-medium">
                      <span>Frete / Entrega</span>
                      <span className="font-bold text-neutral-900">{formatCurrency(selectedOrderDetail.taxa_entrega)}</span>
                    </div>
                  )}

                  {Number(selectedOrderDetail.desconto || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Descontos / Cupons / PIX</span>
                      <span>- {formatCurrency(selectedOrderDetail.desconto)}</span>
                    </div>
                  )}

                  {Number(selectedOrderDetail.pontos_usados || 0) > 0 && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>Pontos VIP Utilizados ({selectedOrderDetail.pontos_usados} pts)</span>
                      <span>- {formatCurrency(selectedOrderDetail.pontos_usados * 0.01)}</span>
                    </div>
                  )}

                  {Number(selectedOrderDetail.saldo_carteira_usado || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Saldo da Carteira Abatido</span>
                      <span>- {formatCurrency(selectedOrderDetail.saldo_carteira_usado)}</span>
                    </div>
                  )}

                  <div className="border-t border-neutral-200 pt-2.5 flex items-baseline justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-900">Total Pago / Final:</span>
                    <span className="text-xl font-black text-[#17345f]">{formatCurrency(selectedOrderDetail.total || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Endereço de Entrega */}
              {selectedOrderDetail.endereco_entrega && (
                <div className="space-y-2">
                  <h4 className="font-black text-neutral-900 uppercase tracking-wider text-[11px]">
                    Destino da Entrega
                  </h4>
                  <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-neutral-900">
                        {selectedOrderDetail.endereco_entrega.logradouro}, {selectedOrderDetail.endereco_entrega.numero}
                        {selectedOrderDetail.endereco_entrega.complemento && ` - ${selectedOrderDetail.endereco_entrega.complemento}`}
                      </p>
                      <p className="text-neutral-500 mt-0.5">
                        {selectedOrderDetail.endereco_entrega.bairro} — {selectedOrderDetail.endereco_entrega.cidade}/{selectedOrderDetail.endereco_entrega.uf} · CEP: {selectedOrderDetail.endereco_entrega.cep}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-4 py-2 rounded-xl bg-white border border-neutral-300 font-bold text-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                Fechar
              </button>

              {getPresentation(selectedOrderDetail).canPay && (
                <button
                  type="button"
                  onClick={() => {
                    const orderToPay = selectedOrderDetail;
                    setSelectedOrderDetail(null);
                    handlePayOrder(orderToPay);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#17345f] text-white font-black text-xs hover:bg-[#102746] shadow-md shadow-[#17345f]/20 cursor-pointer flex items-center gap-1.5"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Pagar este Pedido</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento com Confirmação */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-neutral-900 text-sm">Cancelar Pedido</h3>
                <p className="text-xs text-neutral-500 font-medium">#{cancelModalOrder.codigo_orcamento || cancelModalOrder.id?.slice(0, 8)}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed font-medium">
              Tem certeza de que deseja cancelar este pedido? Seus cupons ou pontos resgatados serão restituídos ao seu saldo.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase block">Motivo (opcional):</label>
              <textarea
                value={cancelMotivo}
                onChange={e => setCancelMotivo(e.target.value)}
                placeholder="Ex: Desisti da compra, mudei de endereço..."
                rows={2}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Não, manter pedido
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                {isSubmittingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Avaliação de Pedido */}
      <OrderReviewModal
        isOpen={!!selectedOrderReview}
        onClose={() => setSelectedOrderReview(null)}
        order={selectedOrderReview}
      />

      {/* Modal de Pagamento PIX Instantâneo */}
      {pixModalData && (
        <CheckoutPixModal
          isOpen={pixModalOpen}
          onClose={() => setPixModalOpen(false)}
          orderId={pixModalData.orderId}
          orderCode={pixModalData.orderCode}
          total={pixModalData.total}
          pixCode={pixModalData.pixCode}
          qrCodeUrl={pixModalData.qrCodeUrl}
          checkoutUrl={pixModalData.checkoutUrl}
          onPaymentSuccess={() => {
            setPixModalOpen(false);
            fetchPurchases();
          }}
        />
      )}

    </div>
  );
}

export default PurchasesPage;
