import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Produto, Servico, Assinatura, CupomLoja } from '../../types';
import { formatCurrency, generateCode, formatDate } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { notificationService } from '../../lib/notificationService';
import { logService } from '../../lib/logService';
import { Modal } from '../ui/Modal';
import { createNotification } from '../../lib/notifications';
import { notifyWhatsAppModal } from '../ui/WhatsAppButton';
import { avaliarPromocoes, PromoResult } from '../../lib/promocaoQuantidadeEngine';
import { VIP_LEVELS } from '../../constants';
import { getProductEffectivePrice } from '../../lib/productPricing';
import { clientOperationalWrite } from '../../lib/clientOperationalWrite';

// Roteamento
import { useAppLocation } from '../../routing/useAppLocation';
import { navigate, updateRouteQuery } from '../../routing/navigationService';
import { routes } from '../../routing/routeCatalog';

const QuantityModal = React.lazy(() => import('./store/QuantityModal'));
const StoreItemCard = React.lazy(() => import('./store/StoreItemCard'));
const CartDrawer = React.lazy(() => import('./store/CartDrawer'));
const CheckoutModal = React.lazy(() => import('./store/CheckoutModal'));
const ProductDetailsModal = React.lazy(() => import('./store/ProductDetailsModal'));
const FilterModal = React.lazy(() => import('./store/FilterModal'));
const AvailableCouponsModal = React.lazy(() => import('./store/AvailableCouponsModal'));
const SubscriptionDurationModal = React.lazy(() => import('./store/SubscriptionDurationModal'));

type Tab = 'produtos' | 'assinaturas';
type ItemType = 'produto' | 'servico' | 'assinatura';

interface CartItem {
  id: string; // from loja_carrinhos
  item_id: string; // id of the product/service/subscription
  tipo: ItemType;
  quantidade: number;
  client_levels?: any;
  item_detalhes?: Produto | Servico | Assinatura;
  prazo_meses?: number;
};

const PENDING_STORE_CHECKOUT_KEY = 'gsa_pending_store_checkout';
const PENDING_STORE_COUPONS_KEY = 'gsa_pending_store_coupons';
const GUEST_ACTIVATED_STORE_COUPONS_KEY = 'gsa_guest_activated_store_coupons';

export const mapColumnsToGallery = (item: any) => {
  if (!item) return [];
  const images = [];
  if (item.imagem_url) images.push(item.imagem_url);
  if (item.imagem_url_2) images.push(item.imagem_url_2);
  if (item.imagem_url_3) images.push(item.imagem_url_3);
  if (item.imagem_url_4) images.push(item.imagem_url_4);
  if (item.imagem_url_5) images.push(item.imagem_url_5);
  return images;
};

export function ClientGSAStore({ clientId, initialAssinaturaId, onSuccess: onFinalSuccess, onRequireAuth, onBack }: { clientId?: string, initialAssinaturaId?: string, onSuccess?: (orderId?: string) => void, onRequireAuth?: () => void, onBack?: () => void }) {
  const route = useAppLocation();

  const [activeTab, setActiveTab] = useState<Tab>(route.submodule === 'loja-assinaturas' ? 'assinaturas' : 'produtos');
  const [search, setSearch] = useState(route.query.busca || '');
  const [isLoading, setIsLoading] = useState(true);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [clientType, setClientType] = useState<'pf' | 'pj' | null>(null);
  const [clienteAtual, setClienteAtual] = useState<any>(null);
  const [promocoesAtivas, setPromocoesAtivas] = useState<any[]>([]);
  const [promosAtivadasIds, setPromosAtivadasIds] = useState<Set<string>>(new Set());
  const [promosAplicadas, setPromosAplicadas] = useState<PromoResult[]>([]);
  const [guestCupomDescInput, setGuestCupomDescInput] = useState('');
  const [guestCupomEntInput, setGuestCupomEntInput] = useState('');
  const [guestCupomDesconto, setGuestCupomDesconto] = useState<CupomLoja | null>(null);
  const [guestCupomEntrega, setGuestCupomEntrega] = useState<CupomLoja | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(route.query.modal === 'carrinho');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(route.query.modal === 'checkout');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(route.query.modal === 'filtros');
  // Controla visibilidade do botão flutuante do carrinho — oculta quando QUALQUER modal abre
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  
  // Estados de Filtro e Ordenação
  const [selectedProdutoCategoriaId, setSelectedProdutoCategoriaId] = useState<string>(route.query.categoria || 'todas');
  const [selectedAssinaturaCategoriaId, setSelectedAssinaturaCategoriaId] = useState<string>(route.query.categoria || 'todas');
  
  // Reset selected category when switching active tab
  useEffect(() => {
    setSelectedProdutoCategoriaId('todas');
    setSelectedAssinaturaCategoriaId('todas');
  }, [activeTab]);

  const selectedCategoriaId = activeTab === 'produtos' ? selectedProdutoCategoriaId : selectedAssinaturaCategoriaId;
  const setSelectedCategoriaId = activeTab === 'produtos' ? setSelectedProdutoCategoriaId : setSelectedAssinaturaCategoriaId;
  
  // Estados de Filtro e Ordenação
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc' | 'none'>(route.query.ordenacao as any || 'none');
  const [minPrice, setMinPrice] = useState<number | ''>(route.query.precoMin ? Number(route.query.precoMin) : '');
  const [maxPrice, setMaxPrice] = useState<number | ''>(route.query.precoMax ? Number(route.query.precoMax) : '');
  
  // Refatorado para IDs para ser 100% real-time (modais atualizam se o item mudar no banco)
  const [selectedQtyId, setSelectedQtyId] = useState<{ id: string, tipo: ItemType } | null>(null);
  const [selectedDurationId, setSelectedDurationId] = useState<{ id: string, tipo: ItemType } | null>(null);
  const [selectedDetailsId, setSelectedDetailsId] = useState<{ id: string, tipo: ItemType } | null>(null);

  const [waSettings, setWaSettings] = useState({
    ativo: true,
    tamanho: 'M',
    posicao: 'direita'
  });

  // 1. Sincronizar Abas, Itens e Modais a partir da URL
  useEffect(() => {
    // Aba ativa
    const isAssinaturaTab = route.submodule === 'loja-assinaturas';
    setActiveTab(isAssinaturaTab ? 'assinaturas' : 'produtos');

    // Detalhe de Item (Produto / Assinatura)
    const targetItemId = route.itemId || route.query.item || route.query.item_id || route.query.produto;
    if (targetItemId) {
      setSelectedDetailsId({
        id: targetItemId,
        tipo: isAssinaturaTab ? 'assinatura' : 'produto'
      });
    } else {
      setSelectedDetailsId(null);
    }

    // Modais gerais
    setIsCartOpen(route.query.modal === 'carrinho');
    setIsCheckoutOpen(route.query.modal === 'checkout');
    setIsFilterModalOpen(route.query.modal === 'filtros');

    if (route.query.modal === 'quantidade' && route.itemId) {
      setSelectedQtyId({ id: route.itemId, tipo: 'produto' });
    } else {
      setSelectedQtyId(null);
    }

    if (route.query.modal === 'duracao' && route.itemId) {
      setSelectedDurationId({ id: route.itemId, tipo: 'assinatura' });
    } else {
      setSelectedDurationId(null);
    }
  }, [route.submodule, route.itemId, route.query.modal]);

  // 2. Debounce na busca de texto para evitar inundar o histórico do navegador
  useEffect(() => {
    const handler = setTimeout(() => {
      updateRouteQuery({ busca: search || null }, { replace: true });
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // 3. Sincronizar Filtros na URL
  const handleApplyFilters = (newSortBy: string, newMin: number | '', newMax: number | '') => {
    updateRouteQuery({
      ordenacao: newSortBy !== 'none' ? newSortBy : null,
      precoMin: newMin !== '' ? String(newMin) : null,
      precoMax: newMax !== '' ? String(newMax) : null,
    });
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoriaId(catId);
    updateRouteQuery({ categoria: catId !== 'todas' ? catId : null });
  };

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'produtos') {
      navigate(routes.marketplace.store.products());
    } else {
      navigate(routes.marketplace.store.subscriptions());
    }
  };

  const handleCloseItemDetails = () => {
    if (activeTab === 'produtos') {
      navigate(routes.marketplace.store.products());
    } else {
      navigate(routes.marketplace.store.subscriptions());
    }
  };

  const openCartForType = (tipo: ItemType) => {
    const storePath = tipo === 'assinatura'
      ? routes.marketplace.store.subscriptions()
      : routes.marketplace.store.products();
    navigate(`${storePath}?modal=carrinho`);
  };

  const fetchWASettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').like('key', 'whatsapp_float_%');
      if (data && data.length > 0) {
        setWaSettings({
          ativo: data.find(s => s.key === 'whatsapp_float_ativo')?.value !== 'false',
          tamanho: data.find(s => s.key === 'whatsapp_float_tamanho')?.value || 'M',
          posicao: data.find(s => s.key === 'whatsapp_float_posicao')?.value || 'direita',
        });
      }
    } catch (err) {
      console.error('Erro ao buscar settings do WhatsApp:', err);
    }
  };

  const selectedItemForQty = useMemo(() => {
    if (!selectedQtyId) return null;
    const { id, tipo } = selectedQtyId;
    let item = null;
    if (tipo === 'produto') item = produtos.find(p => p.id === id);
    else if (tipo === 'servico') item = servicos.find(s => s.id === id);
    else if (tipo === 'assinatura') item = assinaturas.find(a => a.id === id);
    return item ? { item, tipo } : null;
  }, [selectedQtyId, produtos, servicos, assinaturas]);

  const selectedItemForDuration = useMemo(() => {
    if (!selectedDurationId) return null;
    const { id, tipo } = selectedDurationId;
    let item = null;
    if (tipo === 'assinatura') item = assinaturas.find(a => a.id === id);
    return item ? { item, tipo } : null;
  }, [selectedDurationId, assinaturas]);

  const selectedItemForDetails = useMemo(() => {
    if (!selectedDetailsId) return null;
    const { id, tipo } = selectedDetailsId;
    let item = null;
    if (tipo === 'produto') item = produtos.find(p => p.id === id);
    else if (tipo === 'servico') item = servicos.find(s => s.id === id);
    else if (tipo === 'assinatura') item = assinaturas.find(a => a.id === id);
    return item ? { item, tipo } : null;
  }, [selectedDetailsId, produtos, servicos, assinaturas]);

  const buildGuestCartItem = (item: any, tipo: ItemType, quantidade = 1, prazo_meses?: number): CartItem => ({
    id: `guest-${tipo}-${item.id}`,
    item_id: item.id,
    tipo,
    quantidade,
    item_detalhes: item,
    prazo_meses
  });

  const savePendingStoreCheckout = (customItems?: CartItem[]) => {
    const itemsToSave = customItems || cartItems;
    if (!itemsToSave || itemsToSave.length === 0) return;
    const activatedCouponIds = JSON.parse(localStorage.getItem(GUEST_ACTIVATED_STORE_COUPONS_KEY) || '[]');

    localStorage.setItem(PENDING_STORE_CHECKOUT_KEY, JSON.stringify({
      items: itemsToSave.map(item => ({
        item_id: item.item_id,
        tipo: item.tipo,
        quantidade: item.quantidade,
        prazo_meses: item.prazo_meses
      })),
      createdAt: new Date().toISOString()
    }));

    localStorage.setItem(PENDING_STORE_COUPONS_KEY, JSON.stringify({
      activatedCouponIds: Array.isArray(activatedCouponIds) ? activatedCouponIds : [],
      cupomDescontoId: guestCupomDesconto?.id || null,
      cupomEntregaId: guestCupomEntrega?.id || null,
      createdAt: new Date().toISOString()
    }));
  };

  // Persistir automaticamente o carrinho de visitante no localStorage
  useEffect(() => {
    if (!clientId && cartItems.length > 0) {
      savePendingStoreCheckout(cartItems);
    }
  }, [cartItems, clientId]);

  const importPendingStoreCheckout = async () => {
    if (!clientId) return false;

    const rawCart = localStorage.getItem(PENDING_STORE_CHECKOUT_KEY);
    if (!rawCart) return false;

    try {
      const parsed = JSON.parse(rawCart);
      const pendingItems = Array.isArray(parsed?.items) ? parsed.items : [];
      if (pendingItems.length === 0) {
        localStorage.removeItem(PENDING_STORE_CHECKOUT_KEY);
        return false;
      }

      for (const pendingItem of pendingItems) {
        if (!pendingItem?.item_id || !pendingItem?.tipo) continue;

        const { data: existing } = await supabase
          .from('loja_carrinhos')
          .select('id, quantidade')
          .eq('cliente_id', clientId)
          .eq('item_id', pendingItem.item_id)
          .eq('tipo', pendingItem.tipo)
          .maybeSingle();

        const quantidade = Math.max(1, Number(pendingItem.quantidade || 1));
        const prazoMeses = pendingItem.prazo_meses ? Number(pendingItem.prazo_meses) : undefined;

        if (existing) {
          const updateData: any = {
            quantidade,
            updated_at: new Date().toISOString()
          };
          if (prazoMeses) updateData.prazo_meses = prazoMeses;

          await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', updateData, { id: existing.id });
        } else {
          const insertData: any = {
            cliente_id: clientId,
            item_id: pendingItem.item_id,
            tipo: pendingItem.tipo,
            quantidade,
            updated_at: new Date().toISOString()
          };
          if (prazoMeses) insertData.prazo_meses = prazoMeses;

          await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', insertData);
        }
      }

      const rawCoupons = localStorage.getItem(PENDING_STORE_COUPONS_KEY);
      const parsedCoupons = rawCoupons ? JSON.parse(rawCoupons) : null;
      const activatedCouponIds = Array.isArray(parsedCoupons?.activatedCouponIds) ? parsedCoupons.activatedCouponIds : [];

      for (const cupomId of activatedCouponIds) {
        if (!cupomId) continue;

        try {
          await clientOperationalWrite(clientId, 'cupons_ativados', 'insert', { cupom_id: cupomId });
        } catch (error: any) {
          console.warn('[GSAStore] Nao foi possivel ativar cupom pendente:', error);
        }
      }

      localStorage.removeItem(PENDING_STORE_CHECKOUT_KEY);
      localStorage.removeItem(GUEST_ACTIVATED_STORE_COUPONS_KEY);
      return true;
    } catch (error) {
      console.error('[GSAStore] Erro ao importar carrinho pendente:', error);
      return false;
    }
  };

  useEffect(() => {
    if (initialAssinaturaId && !isLoading) {
      setActiveTab('assinaturas');
      setSelectedDurationId({ id: initialAssinaturaId, tipo: 'assinatura' });
    }
  }, [initialAssinaturaId, isLoading]);

  useEffect(() => {
    fetchClientType();
    fetchStoreData();
    fetchCart();

    if (clientId) {
      importPendingStoreCheckout().then((imported) => {
        if (imported) {
          fetchCart();
          setIsCheckoutOpen(true);
          updateRouteQuery({ modal: 'checkout' });
          toast.success('Carrinho recuperado! Continue sua compra.');
        }
      });
    }

    const fetchAtivadas = async () => {
      try {
        const { data } = await supabase.from('promocoes_quantidade_ativadas').select('promocao_quantidade_id').eq('cliente_id', clientId);
        if (data) setPromosAtivadasIds(new Set(data.map(d => d.promocao_quantidade_id)));
      } catch (e) {
        console.error('Erro fetching promocoes_quantidade_ativadas', e);
      }
    };
    fetchAtivadas();

    // Canais da Loja (Produtos, Serviços, Assinaturas)
    const storeChannel = supabase.channel('gsa-store-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => { fetchStoreData(); fetchCart(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => { fetchStoreData(); fetchCart(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas' }, () => { fetchStoreData(); fetchCart(); })
      .subscribe();

    // Canais de Cupons
    const couponChannel = supabase.channel('gsa-store-coupons')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_loja' }, () => {
        // Se houver checkout aberto, ele vai re-renderizar e podemos validar cupons se necessário
        // Por ora, apenas garantimos que os dados estão frescos se houvesse uma lista de cupons
      })
      .subscribe();

    // Canal de Promoções Inteligentes (VIP)
    const promoChannel = supabase.channel('gsa-store-promos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promocoes_quantidade' }, async () => {
        // Re-busca as promoções ativas DIRETAMENTE no canal para evitar problemas de HMR/Closure
        const { data: promos } = await supabase.from('promocoes_quantidade')
          .select('*, produto_brinde:produtos!produto_brinde_id(*), produto_gatilho:produtos!produto_gatilho_id(nome)')
          .eq('status', 'ativa');
        if (promos) setPromocoesAtivas(promos);
      })
      .subscribe();

    const cartChannel = supabase.channel(`cart-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loja_carrinhos', filter: `cliente_id=eq.${clientId}` }, () => {
        fetchCart();
      }).subscribe();
      
    const waChannel = supabase.channel('wa-sync-store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchWASettings();
      }).subscribe();

    fetchWASettings();

    const handleOpenCart = () => {
      setIsCartOpen(true);
    };
    window.addEventListener('open-store-cart', handleOpenCart);

    // Escuta o evento global para ocultar o botão flutuante do carrinho
    const handleModalState = (e: Event) => {
      setIsAnyModalOpen((e as CustomEvent).detail.open);
    };
    window.addEventListener('whatsapp-modal-state', handleModalState);

    const handlePromoAtivada = (e: any) => {
      setPromosAtivadasIds(prev => new Set([...prev, e.detail.id]));
    };
    window.addEventListener('promo-ativada', handlePromoAtivada);

    return () => {
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(couponChannel);
      supabase.removeChannel(promoChannel);
      supabase.removeChannel(cartChannel);
      supabase.removeChannel(waChannel);
      window.removeEventListener('open-store-cart', handleOpenCart);
      window.removeEventListener('whatsapp-modal-state', handleModalState);
      window.removeEventListener('promo-ativada', handlePromoAtivada);
    };
  }, [clientId]);

  // Notifica o botão WhatsApp quando carrinho ou checkout abre/fecha (evitar sobreposição mobile)
  useEffect(() => {
    notifyWhatsAppModal(isCartOpen || isCheckoutOpen || !!selectedDetailsId);
    return () => { notifyWhatsAppModal(false); };
  }, [isCartOpen, isCheckoutOpen, selectedDetailsId]);

  // Motor Lógico de Promoções: roda sempre que o carrinho muda
  useEffect(() => {
    if (cartItems.length > 0 && clienteAtual && promocoesAtivas.length > 0) {
      const ativasFiltradas = promocoesAtivas.filter(p => promosAtivadasIds.has(p.id));
      
      avaliarPromocoes(
        cartItems.map(i => ({ produto: i.item_detalhes as any, quantidade: i.quantidade, categoria_id: i.item_detalhes?.categoria_id })), 
        clienteAtual, 
        ativasFiltradas, 
        []
      ).then(res => {
        setPromosAplicadas(res);
      });
    } else {
      setPromosAplicadas([]);
    }
  }, [cartItems, clienteAtual, promocoesAtivas, promosAtivadasIds]);

  const fetchClientType = async () => {
    try {
      const { data } = await supabase.from('clientes').select('*').eq('id', clientId).maybeSingle();
      if (data) {
        setClientType(data.tipo_pessoa as 'pf' | 'pj');
        setClienteAtual(data);
      }
      
      const { data: promos } = await supabase.from('promocoes_quantidade')
        .select('*, produto_brinde:produtos!produto_brinde_id(*), produto_gatilho:produtos!produto_gatilho_id(nome)')
        .eq('status', 'ativa');
      if (promos) setPromocoesAtivas(promos);
    } catch (err) {
      console.error('Erro ao buscar tipo de cliente:', err);
    }
  };

  const fetchStoreData = async () => {
    setIsLoading(true);
    
    // Buscar tipo de pessoa se ainda não tivermos para o filtro
    let currentType = clientType;
    if (!currentType) {
      const { data } = await supabase.from('clientes').select('tipo_pessoa').eq('id', clientId).maybeSingle();
      if (data) {
        currentType = data.tipo_pessoa as 'pf' | 'pj';
        setClientType(currentType);
      }
    }

    const types = currentType ? [currentType, 'ambos'] : ['pf', 'pj', 'ambos'];

    const [prodRes, servRes, assRes, catRes] = await Promise.all([
      supabase.from('produtos').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
      supabase.from('servicos').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
      supabase.from('assinaturas').select('*').eq('status', 'ativo').eq('visivel_na_loja', true).in('tipo_cliente', types),
      supabase.from('loja_categorias').select('*').eq('status', 'ativo').order('ordem')
    ]);

    if (prodRes.data) setProdutos(prodRes.data);
    if (servRes.data) setServicos(servRes.data);
    if (assRes.data) setAssinaturas(assRes.data);
    if (catRes.data) setCategorias(catRes.data);
    setIsLoading(false);
  };

  const fetchCart = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.from('loja_carrinhos').select('*').eq('cliente_id', clientId);
      if (error) {
        console.error('[GSAStore] Erro ao buscar carrinho:', error);
        return;
      }
      if (!data) return;

      // Group IDs by type to fetch details more efficiently
      const productIds = data.filter(c => c.tipo === 'produto').map(c => c.item_id);
      const serviceIds = data.filter(c => c.tipo === 'servico').map(c => c.item_id);
      const subscriptionIds = data.filter(c => c.tipo === 'assinatura').map(c => c.item_id);

      const [prodRes, servRes, assRes] = await Promise.all([
        productIds.length > 0 ? supabase.from('produtos').select('*').in('id', productIds) : Promise.resolve({ data: [] }),
        serviceIds.length > 0 ? supabase.from('servicos').select('*').in('id', serviceIds) : Promise.resolve({ data: [] }),
        subscriptionIds.length > 0 ? supabase.from('assinaturas').select('*').in('id', subscriptionIds) : Promise.resolve({ data: [] })
      ]);

      const enrichedCart = data.map((c: any) => {
        let itemDetails = null;
        if (c.tipo === 'produto') {
          itemDetails = prodRes.data?.find((p: any) => p.id === c.item_id);
        } else if (c.tipo === 'servico') {
          itemDetails = servRes.data?.find((s: any) => s.id === c.item_id);
        } else if (c.tipo === 'assinatura') {
          itemDetails = assRes.data?.find((a: any) => a.id === c.item_id);
        }

        if (!itemDetails) {
          console.warn(`[GSAStore] Detalhes não encontrados para item ${c.item_id} do tipo ${c.tipo}`);
        }

        return { ...c, item_detalhes: itemDetails };
      });

      // We only keep items that still exist in the database to avoid UI crashes
      // But we log when something is removed
      const validItems = enrichedCart.filter(i => i.item_detalhes);
      if (validItems.length !== data.length) {
        console.warn(`[GSAStore] ${data.length - validItems.length} itens foram removidos do carrinho por não existirem mais no banco.`);
      }

      setCartItems(validItems);
    } catch (err) {
      console.error('[GSAStore] Erro crítico em fetchCart:', err);
    }
  };

  const addToCart = async (item: any, tipo: ItemType) => {
    if (!item?.id || !tipo) {
      toast.error('NÃ£o foi possÃ­vel identificar este item.');
      return;
    }

    if (cartItems.length > 0 && cartItems[0].tipo !== tipo) {
      toast.error('Assinaturas devem ser compradas separadamente de produtos físicos.');
      return;
    }

    if (tipo === 'produto') {
      navigate(`${routes.marketplace.store.product(item.id)}?modal=quantidade`);
      return;
    }
    if (tipo === 'assinatura') {
      navigate(`${routes.marketplace.store.subscription(item.id)}?modal=duracao`);
      return;
    }

    const existing = cartItems.find(c => c.item_id === item.id);
    if (existing) {
      toast.error('Este item já está no carrinho.');
      return;
    }
    
    if (!clientId) {
      setCartItems(prev => [...prev, buildGuestCartItem(item, tipo)]);
      toast.success('Item adicionado ao carrinho!');
      openCartForType(tipo);
      return;
    }

    try {
      console.log('[GSAStore] Tentando adicionar ao carrinho:', { clientId, itemId: item.id, tipo });
      const { data: authUser } = await supabase.auth.getUser();
      console.log('[GSAStore] Usuário autenticado:', authUser?.user?.id);

      await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', { 
        item_id: item.id, 
        tipo, 
        quantidade: 1,
        updated_at: new Date().toISOString()
      });

      toast.success('Item adicionado ao carrinho!');
      fetchCart(); // Atualização manual imediata
      openCartForType(tipo);
    } catch (error: any) {
      console.error('[GSAStore] Erro ao adicionar ao carrinho:', error);
      toast.error('Erro ao adicionar ao carrinho. Verifique sua conexão.');
    }
  };

  const confirmAddToCart = async (qty: number, prazo_meses?: number) => {
    let item, tipo;
    
    if (selectedItemForQty) {
      item = selectedItemForQty.item;
      tipo = selectedItemForQty.tipo;
    } else if (selectedItemForDuration) {
      item = selectedItemForDuration.item;
      tipo = selectedItemForDuration.tipo;
    } else {
      return;
    }

    if (!clientId) {
      setCartItems(prev => {
        const existing = prev.find(c => c.item_id === item.id);
        if (existing) {
          return prev.map(c => c.item_id === item.id ? { ...c, quantidade: qty, prazo_meses } : c);
        }
        return [...prev, buildGuestCartItem(item, tipo, qty, prazo_meses)];
      });
      toast.success('Item adicionado ao carrinho!');
      setSelectedQtyId(null);
      setSelectedDurationId(null);
      openCartForType(tipo);
      return;
    }
    
    // Buscar o estado mais atual do banco para evitar race conditions
    const { data: currentCart } = await supabase.from('loja_carrinhos')
      .select('id')
      .eq('cliente_id', clientId)
      .eq('item_id', item.id)
      .maybeSingle();

    try {
      console.log('[GSAStore] Confirmando adição ao carrinho:', { clientId, itemId: item.id, qty });
      const { data: authUser } = await supabase.auth.getUser();
      console.log('[GSAStore] Usuário autenticado:', authUser?.user?.id);

      if (currentCart) {
        const updateData: any = { quantidade: qty, updated_at: new Date().toISOString() };
        if (prazo_meses) updateData.prazo_meses = prazo_meses;
        
        await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', updateData, { id: currentCart.id });
        toast.success('Carrinho atualizado.');
      } else {
        const insertData: any = { 
          item_id: item.id, 
          tipo, 
          quantidade: qty,
          updated_at: new Date().toISOString()
        };
        if (prazo_meses) insertData.prazo_meses = prazo_meses;

        await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', insertData);
        toast.success('Item adicionado ao carrinho!');
      }
      fetchCart(); // Atualização manual imediata
      openCartForType(tipo);
    } catch (e: any) {
      console.error('[GSAStore] Erro ao confirmar adição:', e);
      toast.error('Erro ao processar carrinho.');
    } finally {
      setSelectedQtyId(null);
      setSelectedDurationId(null);
    }
  };

  const updateCartQuantity = async (cartId: string, newQty: number, itemDetails: any) => {
    if (newQty < 1) return;
    if (itemDetails.controle_estoque && newQty > itemDetails.estoque_disponivel) {
      toast.error('Quantidade máxima em estoque atingida.');
      return;
    }
    
    if (!clientId) {
      setCartItems(prev => prev.map(item => item.id === cartId ? { ...item, quantidade: newQty } : item));
      return;
    }

    try {
      await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', {
        quantidade: newQty,
        updated_at: new Date().toISOString()
      }, { id: cartId });
      fetchCart();
    } catch (error) {
      console.error('[GSAStore] Erro ao atualizar quantidade:', error);
      toast.error('Erro ao atualizar quantidade.');
    }
  };

  const removeCartItem = async (cartId: string) => {
    if (!clientId) {
      setCartItems(prev => prev.filter(item => item.id !== cartId));
      toast.success('Item removido do carrinho.');
      return;
    }

    try {
      await clientOperationalWrite(clientId, 'loja_carrinhos', 'delete', {}, { id: cartId });
      
      toast.success('Item removido do carrinho.');
      fetchCart();
    } catch (error) {
      console.error('[GSAStore] Erro ao remover item:', error);
      toast.error('Erro ao remover item.');
    }
  };

  const aplicarCupomVisitante = async (codigo: string, tipo: 'desconto' | 'entrega') => {
    if (!codigo.trim()) return;

    try {
      const { data, error } = await supabase
        .from('cupons_loja')
        .select('*')
        .eq('codigo_cupom', codigo.trim().toUpperCase())
        .maybeSingle();

      if (error || !data) {
        toast.error('Cupom invalido ou nao encontrado.');
        return;
      }

      const cupom = data as CupomLoja;
      const activatedCouponIds = JSON.parse(localStorage.getItem(GUEST_ACTIVATED_STORE_COUPONS_KEY) || '[]');
      const isActivated = Array.isArray(activatedCouponIds) && activatedCouponIds.includes(cupom.id);

      if (!isActivated) {
        toast.error('Ative este cupom primeiro na area de cupons da GSA Store.');
        return;
      }

      if (cupom.status !== 'ativo') return toast.error('Este cupom nao esta mais ativo.');
      if ((cupom.total_usos || 0) >= (cupom.limite_usos || 0)) return toast.error('Limite de uso do cupom esgotado.');
      if (cupom.data_validade) {
        const [year, month, day] = String(cupom.data_validade).split('T')[0].split('-').map(Number);
        const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
        if (expiryDate < new Date()) return toast.error('Cupom expirado.');
      }
      if (cupom.cliente_id) return toast.error('Este cupom e exclusivo para cliente logado.');

      if (tipo === 'desconto' && cupom.categoria_cupom === 'entrega') return toast.error('Este e um cupom de entrega.');
      if (tipo === 'entrega' && cupom.categoria_cupom !== 'entrega') return toast.error('Este nao e um cupom de entrega.');

      if (cupom.produto_id) {
        const itemNoCarrinho = cartItems.find((c: CartItem) => c.item_id === cupom.produto_id);
        if (!itemNoCarrinho) {
          toast.error('Este cupom e exclusivo para um item especifico. Adicione o item ao carrinho.');
          return;
        }
      }

      const temProdutosNoCarrinho = cartItems.some((c: CartItem) => c.tipo === 'produto');
      const subtotalCarrinho = cartItems.reduce((acc: number, cur: CartItem) => acc + (cur.item_detalhes?.valor || 0) * cur.quantidade, 0);

      if (tipo === 'entrega') {
        if (!temProdutosNoCarrinho) return toast.error('Voce nao tem produtos fisicos no carrinho para usar cupom de entrega.');
        if (cupom.tipo_entrega === 'frete_gratis_minimo' && subtotalCarrinho < (cupom.valor_minimo_compra || 0)) {
          return toast.error(`A compra minima para este frete gratis e ${formatCurrency(cupom.valor_minimo_compra || 0)}.`);
        }
        setGuestCupomEntrega(cupom);
        setGuestCupomEntInput('');
        toast.success('Beneficio de entrega aplicado!');
      } else {
        setGuestCupomDesconto(cupom);
        setGuestCupomDescInput('');
        toast.success('Desconto aplicado com sucesso!');
      }
    } catch (error) {
      console.error('[GSAStore] Erro ao aplicar cupom visitante:', error);
      toast.error('Erro ao processar cupom.');
    }
  };

  const deferredSearch = React.useDeferredValue(search);

  const filteredItems = useMemo(() => {
    let base: any[] = [];
    let tipo: ItemType = 'produto';
    if (activeTab === 'produtos') { base = [...produtos]; tipo = 'produto'; }
    if (activeTab === 'assinaturas') { base = [...assinaturas]; tipo = 'assinatura'; }

    if (deferredSearch) {
      base = base.filter(i => i.nome.toLowerCase().includes(deferredSearch.toLowerCase()));
    }

    if (selectedCategoriaId !== 'todas') {
      base = base.filter(i => i.categoria_id === selectedCategoriaId);
    }

    // Filtrar por preço
    if (minPrice !== '') {
      base = base.filter(i => {
        const price = tipo === 'produto' ? getProductEffectivePrice(i) : i.valor;
        return price >= Number(minPrice);
      });
    }
    if (maxPrice !== '') {
      base = base.filter(i => {
        const price = tipo === 'produto' ? getProductEffectivePrice(i) : i.valor;
        return price <= Number(maxPrice);
      });
    }

    // Ordenar
    if (sortBy === 'price-asc') {
      base.sort((a, b) => {
        const pA = tipo === 'produto' ? getProductEffectivePrice(a) : a.valor;
        const pB = tipo === 'produto' ? getProductEffectivePrice(b) : b.valor;
        return pA - pB;
      });
    } else if (sortBy === 'price-desc') {
      base.sort((a, b) => {
        const pA = tipo === 'produto' ? getProductEffectivePrice(a) : a.valor;
        const pB = tipo === 'produto' ? getProductEffectivePrice(b) : b.valor;
        return pB - pA;
      });
    } else if (sortBy === 'alpha-asc') {
      base.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortBy === 'alpha-desc') {
      base.sort((a, b) => b.nome.localeCompare(a.nome));
    }

    return base.map(b => ({ 
      ...b, 
      _tipo: tipo 
    }));
  }, [activeTab, deferredSearch, produtos, servicos, assinaturas, sortBy, minPrice, maxPrice, selectedCategoriaId]);

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 pb-24 md:space-y-4 max-w-7xl mx-auto">
      {/* Título e Seletor de Abas Luxuoso */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {onBack ? (
          <button 
            onClick={onBack}
            className="self-start md:self-auto inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 sm:h-10 sm:rounded-full sm:px-4 sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span>Voltar</span>
          </button>
        ) : (
          <div className="hidden md:block w-24"></div>
        )}
        <div className="mx-auto md:mx-0 w-full max-w-2xl flex-1">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm md:flex md:rounded-[2.5rem] md:border-white md:bg-white/70 md:p-1.5 md:shadow-[0_20px_50px_rgba(79,70,229,0.08)] md:ring-1 md:ring-black/5">
            {[
              { id: 'produtos', label: 'Produtos', icon: Package, color: 'from-indigo-600 to-blue-500' },
              { id: 'assinaturas', label: 'Assinaturas', icon: Calendar, color: 'from-pink-600 to-purple-600' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTab(t.id as Tab)}
                className={`relative flex items-center justify-center gap-2 rounded-xl py-3 text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-500 md:flex-1 md:gap-3 md:rounded-full md:py-5 md:text-xs md:tracking-[0.25em] ${
                  activeTab === t.id ? 'text-white' : 'text-neutral-400 hover:text-indigo-600'
                }`}
              >
                {activeTab === t.id && (
                  <motion.div
                    layoutId="activeStoreTab"
                    className={`absolute inset-0 rounded-xl bg-gradient-to-r ${t.color} shadow-lg shadow-indigo-200 md:rounded-full md:shadow-xl`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 md:gap-3">
                  <t.icon className={`h-4 w-4 transition-transform duration-500 md:h-4.5 md:w-4.5 ${activeTab === t.id ? 'scale-110 rotate-3' : 'scale-100 opacity-50'}`} />
                  <span className="xs:inline">{t.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block w-24"></div>
      </div>



      {/* Search & Utility Bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm md:gap-3 md:rounded-[2rem] md:border-white md:bg-white/60 md:p-3 md:shadow-[0_10px_30px_rgba(0,0,0,0.02)] max-w-4xl mx-auto">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400 transition-colors group-focus-within:text-indigo-600 md:left-4" />
          <input 
            id="storeSearchInput"
            type="text" 
            placeholder="Buscar produto" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border-none bg-neutral-100/70 pl-10 pr-3 text-sm font-bold text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 md:h-auto md:rounded-2xl md:py-3.5 md:pl-12 md:pr-4"
          />
        </div>
        <button 
          onClick={() => updateRouteQuery({ modal: 'filtros' })}
          className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-md transition-all hover:shadow-indigo-500/40 md:h-12 md:w-12 md:rounded-2xl md:shadow-lg"
        >
          <SlidersHorizontal className="h-4.5 w-4.5 transition-transform duration-500 group-hover:rotate-12" />
        </button>
      </div>

      {/* Categories Bar */}
      {(() => {
        const cats = categorias.filter(c => c.tipo === activeTab);
        if (cats.length === 0) return null;
        return (
          <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 max-w-4xl mx-auto no-scrollbar">
            <button
              onClick={() => handleSelectCategory('todas')}
              className={`flex h-9 items-center justify-center rounded-xl border-2 px-4 text-xs font-black uppercase tracking-wider transition-all ${
                selectedCategoriaId === 'todas'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                  : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
              }`}
            >
              Todas
            </button>
            {cats.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`flex h-9 items-center justify-center rounded-xl border-2 px-4 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedCategoriaId === cat.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                }`}
              >
                {cat.nome}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-32"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-24 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-white/60">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-neutral-300" />
          </div>
          <h3 className="text-xl font-black text-neutral-900">Oops! Nada encontrado</h3>
          <p className="text-neutral-500 mt-2 font-medium">Tente buscar por outro termo ou mude a categoria.</p>
        </div>
      ) : (
        <React.Suspense fallback={<div className="flex justify-center py-32"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 2xl:grid-cols-5">
            {filteredItems.map(item => (
              <StoreItemCard 
                key={`${item._tipo}-${item.id}`} 
                item={item} 
                tipo={item._tipo} 
                onAdd={() => addToCart(item, item._tipo)} 
                onClick={() => navigate(item._tipo === 'produto' ? routes.marketplace.store.product(item.id) : routes.marketplace.store.subscription(item.id))}
              />
            ))}
          </div>
        </React.Suspense>
      )}

      {/* Floating Cart Button - Usando Portal para garantir que fique fixo na tela */}
      {cartItems.length > 0 && !isAnyModalOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {(() => {
            let sizeClass = 'h-[50px] w-[50px]';
            let iconSize = 'w-6 h-6';
            let bottomOffset = waSettings.ativo ? 165 : 40; 
            let badgeSize = 'w-5 h-5';
            let badgeText = 'text-[9px]';

            if (waSettings.tamanho === 'P') { 
              sizeClass = 'h-[40px] w-[40px]'; 
              iconSize = 'w-5 h-5'; 
              bottomOffset = waSettings.ativo ? 155 : 40; 
              badgeSize = 'w-4 h-4';
              badgeText = 'text-[8px]';
            }
            if (waSettings.tamanho === 'G') { 
              sizeClass = 'h-[60px] w-[60px]'; 
              iconSize = 'w-7 h-7'; 
              bottomOffset = waSettings.ativo ? 175 : 40; 
              badgeSize = 'w-6 h-6';
              badgeText = 'text-[10px]';
            }

            const isLeft = waSettings.posicao === 'esquerda';

            return (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                drag
                dragMomentum={false}
                whileDrag={{ cursor: 'grabbing', scale: 1.1, zIndex: 100000 }}
                className="fixed z-[99999] pointer-events-auto"
                style={{ 
                  bottom: `${bottomOffset}px`, 
                  [isLeft ? 'left' : 'right']: '1.5rem' 
                }}
              >
                <button 
                  onClick={() => updateRouteQuery({ modal: 'carrinho' })}
                  className={`group relative flex items-center justify-center ${sizeClass} bg-indigo-600 text-white rounded-full shadow-2xl ring-4 ring-white hover:bg-indigo-700 transition-all`}
                >
                  <ShoppingCart className={iconSize} />
                  <span className={`absolute -top-1 -right-1 flex items-center justify-center ${badgeSize} bg-red-500 text-white ${badgeText} font-black rounded-full ring-2 ring-white shadow-sm animate-bounce`}>
                    {cartItems.length}
                  </span>
                </button>
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Suspense wrapper para os modais que sofrem lazy load */}
      <React.Suspense fallback={null}>
        {/* Cart Drawer Modal */}
        <CartDrawer 
          isOpen={route.query.modal === 'carrinho'} 
          onClose={() => updateRouteQuery({ modal: null })} 
          cartItems={cartItems} 
          promosAplicadas={promosAplicadas}
          isGuest={!clientId}
          cupomDesconto={guestCupomDesconto}
          cupomEntrega={guestCupomEntrega}
          cupomDescInput={guestCupomDescInput}
          cupomEntInput={guestCupomEntInput}
          onCupomDescInputChange={setGuestCupomDescInput}
          onCupomEntInputChange={setGuestCupomEntInput}
          onApplyCoupon={aplicarCupomVisitante}
          onRemoveCoupon={(tipo: 'desconto' | 'entrega') => {
            if (tipo === 'desconto') setGuestCupomDesconto(null);
            if (tipo === 'entrega') setGuestCupomEntrega(null);
          }}
          onUpdateQuantity={updateCartQuantity} 
          onRemove={removeCartItem} 
          onCheckout={() => {
            if (!clientId) {
              savePendingStoreCheckout();
              updateRouteQuery({ modal: null });
              toast('Entre ou cadastre-se para finalizar sua compra.');
              if (onRequireAuth) onRequireAuth();
              return;
            }

            updateRouteQuery({ modal: 'checkout' });
          }}
        />

        {/* Checkout Modal */}
        <CheckoutModal 
          isOpen={route.query.modal === 'checkout'} 
          onClose={() => updateRouteQuery({ modal: null })} 
          cartItems={cartItems} 
          promosAplicadas={promosAplicadas}
          clientId={clientId} 
          onSuccess={(orderId) => { 
            updateRouteQuery({ modal: null }); 
            fetchCart(); 
            if (onFinalSuccess) onFinalSuccess(orderId);
          }}
        />

        {/* Details Modal */}
        <ProductDetailsModal 
          isOpen={!!route.itemId && !['quantidade', 'duracao'].includes(route.query.modal || '')} 
          onClose={handleCloseItemDetails} 
          item={selectedItemForDetails?.item} 
          tipo={selectedItemForDetails?.tipo as ItemType}
          onAdd={() => {
            const item = selectedItemForDetails?.item;
            const tipo = selectedItemForDetails?.tipo as ItemType;
            void addToCart(item, tipo);
          }}
        />

        {/* Quantity Modal */}
        <QuantityModal 
          isOpen={route.query.modal === 'quantidade' && !!route.itemId} 
          onClose={() => updateRouteQuery({ modal: null })} 
          item={selectedItemForQty?.item} 
          initialQty={cartItems.find(c => c.item_id === selectedItemForQty?.item?.id)?.quantidade || 1}
          onConfirm={(qty) => confirmAddToCart(qty)} 
        />

        {/* Subscription Duration Modal */}
        <SubscriptionDurationModal 
          isOpen={route.query.modal === 'duracao' && !!route.itemId} 
          onClose={() => updateRouteQuery({ modal: null })} 
          item={selectedItemForDuration?.item} 
          initialDuration={cartItems.find(c => c.item_id === selectedItemForDuration?.item?.id)?.prazo_meses || 1}
          onConfirm={(months) => confirmAddToCart(1, months)} 
        />

        {/* Filter Modal */}
        <FilterModal
          isOpen={route.query.modal === 'filtros'}
          onClose={() => {
            handleApplyFilters(sortBy, minPrice, maxPrice);
            updateRouteQuery({ modal: null });
          }}
          sortBy={sortBy}
          setSortBy={setSortBy}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
        />
      </React.Suspense>
    </div>
  );
}

// Subcomponent: Quantity Selection Modal

// Subcomponent: Store Item Card

// Subcomponent: Cart Drawer

// Subcomponent: Checkout Modal

// Subcomponent: Product Details Modal

// Subcomponent: Filter Modal

// Subcomponent: Available Coupons Modal


// Subcomponent: Subscription Duration Modal
