import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  User, 
  FileText, 
  ClipboardList, 
  Wallet, 
  Ticket, 
  MessageSquare, 
  LogOut,
  ChevronRight,
  ChevronLeft,
  Pin,
  Users,
  Gift,
  ExternalLink,
  X,
  Menu,
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ArrowLeft,
  Calendar,
  Star,
  Briefcase,
  Lock,
  Info,
  CreditCard,
  AlertTriangle,
  Crown,
  Megaphone,
  Maximize,
  Minimize,
  Landmark,
  Store,
  Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Cliente, Module, Notificacao } from '../types';
import { formatCurrency, playPremiumBeep } from '../lib/utils';

// Roteamento
import { useAppLocation } from '../routing/useAppLocation';
import { navigate, replace } from '../routing/navigationService';
import { routes } from '../routing/routeCatalog';

// Modules
import { VIPLevel } from '../constants';
import { useVipLevels } from '../hooks/useVipLevels';
import { ClientDashboard } from '../components/client/ClientDashboard';
import { ClientProfile } from '../components/client/ClientProfile';
import { ClientOrcamentos } from '../components/client/ClientOrcamentos';
import { ClientServicos } from '../components/client/ClientServicos';
import { ClientFinanceiro } from '../components/client/ClientFinanceiro';
import { ClientFidelidade } from '../components/client/ClientFidelidade';
import { ClientServicosAssinaturas } from '../components/client/ClientServicosAssinaturas';
import { ClientVouchers } from '../components/client/ClientVouchers';
import { ClientSuporte } from '../components/client/ClientSuporte';
import { ClientAreaVIP } from '../components/client/ClientAreaVIP';
import { ClientIndiqueGanhe } from '../components/client/ClientIndiqueGanhe';
import { ClientPontos } from '../components/client/ClientPontos';
import { ClientProdutos } from '../components/client/ClientProdutos';
import { ClientTransferencias } from '../components/client/ClientTransferencias';
import { ClientAssinaturas } from '../components/client/ClientAssinaturas';
import { ClientPromocoes } from '../components/client/ClientPromocoes';
import ClientPremios from '../components/client/ClientPremios';
import { ClientGSAStore } from '../components/client/ClientGSAStore';
import { UniversalNotificationBell } from '../components/ui/UniversalNotificationBell';
import { processGamificationPointsManual } from '../utils/gamification';
import { useClientNotifications } from '../hooks/useClientNotifications';
import { createNotification, createWelcomeSequence } from '../lib/notifications';
import { ClientEmprestimos } from '../components/client/ClientEmprestimos';
import { logService } from '../lib/logService';
import { MarketplaceGSAStore } from '../components/client/marketplace/MarketplaceGSAStore';
import { ClientMeuCredito } from '../components/client/ClientMeuCredito';
import { callClientRpc } from '../lib/clientRpc';

interface ClientPortalProps {
  clientId: string;
  onLogout: () => void;
  initialModule?: string;
  initialStoreTab?: string;
  initialStoreItemId?: string;
}

const CLIENT_MODULE_ROUTES: Partial<Record<Module | 'gsa_store', string>> = {
  dashboard: 'dashboard',
  perfil: 'perfil',
  orcamentos: 'servicos_assinaturas',
  servicos: 'servicos_assinaturas',
  produtos: 'servicos_assinaturas',
  assinaturas: 'servicos_assinaturas',
  servicos_assinaturas: 'servicos-e-assinaturas',
  financeiro: 'financeiro',
  fidelidade: 'fidelidade',
  suporte: 'suporte',
  gsa_store: 'gsa-store'
};

const CLIENT_ROUTE_MODULES: Record<string, Module> = {
  dashboard: 'dashboard',
  perfil: 'perfil',
  orcamentos: 'orcamentos',
  servicos: 'servicos',
  produtos: 'produtos',
  assinaturas: 'assinaturas',
  'servicos-e-assinaturas': 'servicos_assinaturas',
  financeiro: 'financeiro',
  fidelidade: 'fidelidade',
  suporte: 'suporte',
  'gsa-store': 'gsa_store' as Module,
  loja: 'gsa_store' as Module,
  store: 'gsa_store' as Module,
  vouchers: 'fidelidade',
  pontos: 'fidelidade',
  promocoes: 'fidelidade',
  premios: 'fidelidade',
  'indique-ganhe': 'fidelidade',
  'area-vip': 'fidelidade',
  transferencias: 'financeiro',
  emprestimos: 'financeiro',
  'credito-loja': 'financeiro',
  credito: 'financeiro'
};

const FINANCEIRO_ROUTE_TABS: Record<string, string> = {
  faturas: 'faturas',
  'notas-fiscais': 'nf',
  nf: 'nf',
  extrato: 'extrato',
  saques: 'saques',
  credito: 'credito',
  'credito-loja': 'credito',
  emprestimos: 'emprestimos',
  transferencias: 'transferencias',
  pontos: 'pontos',
  vouchers: 'vouchers'
};

const LEGACY_FINANCEIRO_MODULE_TABS: Partial<Record<Module, string>> = {
  credito_loja: 'credito',
  emprestimos: 'emprestimos',
  transferencias: 'transferencias'
};

const SERVICOS_ASSINATURAS_ROUTE_TABS: Record<string, string> = {
  orcamentos: 'orcamentos',
  servicos: 'servicos',
  produtos: 'produtos',
  assinaturas: 'assinaturas'
};

const LEGACY_SERVICOS_ASSINATURAS_MODULE_TABS: Partial<Record<Module, string>> = {
  orcamentos: 'orcamentos',
  servicos: 'servicos',
  produtos: 'produtos',
  assinaturas: 'assinaturas'
};

const FIDELIDADE_ROUTE_TABS: Record<string, string> = {
  pontos: 'pontos',
  vouchers: 'vouchers',
  promocoes: 'promocoes',
  premios: 'premios',
  'indique-ganhe': 'indique-ganhe',
  'area-vip': 'area-vip',
  area_vip: 'area-vip'
};

const LEGACY_FIDELIDADE_MODULE_TABS: Partial<Record<Module, string>> = {
  pontos: 'pontos',
  vouchers: 'vouchers',
  promocoes: 'promocoes',
  premios: 'premios',
  'indique-ganhe': 'indique-ganhe',
  area_vip: 'area-vip'
};

function parseClientRoute(pathname: string, search = window.location.search): { module: Module; tab?: string; itemId?: string } {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/cliente/dashboard';
  const segments = normalizedPath.split('/').filter(Boolean);
  const params = new URLSearchParams(search);
  const legacyModule = params.get('module') as Module | null;
  const legacyTab = params.get('tab') || undefined;
  const itemId = params.get('itemId') || params.get('item') || undefined;

  if (legacyModule) {
    const financeTab = LEGACY_FINANCEIRO_MODULE_TABS[legacyModule];
    const servicosTab = LEGACY_SERVICOS_ASSINATURAS_MODULE_TABS[legacyModule];
    const fidelidadeTab = LEGACY_FIDELIDADE_MODULE_TABS[legacyModule];
    return {
      module: financeTab ? 'financeiro' : servicosTab ? 'servicos_assinaturas' : fidelidadeTab ? 'fidelidade' : legacyModule,
      tab: financeTab || servicosTab || fidelidadeTab || legacyTab,
      itemId
    };
  }

  if (segments[0] !== 'cliente') {
    return { module: 'dashboard' };
  }

  const routeKey = segments[1] || 'dashboard';
  if (routeKey === 'gsa-store' || routeKey === 'loja' || routeKey === 'store') {
    const subRoute = segments[2];
    return {
      module: 'gsa_store' as Module,
      tab: subRoute || 'home',
      itemId
    };
  }

  const module = CLIENT_ROUTE_MODULES[routeKey] || 'dashboard';

  if (module === 'financeiro') {
    const tabKey = routeKey === 'financeiro' ? segments[2] : routeKey;
    return {
      module: 'financeiro',
      tab: tabKey ? FINANCEIRO_ROUTE_TABS[tabKey] || tabKey : undefined,
      itemId
    };
  }

  if (module === 'servicos_assinaturas') {
    const tabKey = routeKey === 'servicos-e-assinaturas' ? segments[2] : routeKey;
    const childTab = params.get('tab') || undefined;
    const normalizedTab = tabKey ? SERVICOS_ASSINATURAS_ROUTE_TABS[tabKey] || tabKey : undefined;
    return {
      module: 'servicos_assinaturas',
      tab: normalizedTab && childTab ? `${normalizedTab}::${childTab}` : normalizedTab,
      itemId
    };
  }

  if (module === 'fidelidade') {
    const tabKey = routeKey === 'fidelidade' ? segments[2] : routeKey;
    return {
      module: 'fidelidade',
      tab: tabKey ? FIDELIDADE_ROUTE_TABS[tabKey] || tabKey : undefined,
      itemId
    };
  }

  return {
    module,
    tab: params.get('tab') || undefined,
    itemId
  };
}

function buildClientRoute(module: Module, tab?: string, itemId?: string) {
  const financeTab = LEGACY_FINANCEIRO_MODULE_TABS[module];
  const servicosTab = LEGACY_SERVICOS_ASSINATURAS_MODULE_TABS[module];
  const fidelidadeTab = LEGACY_FIDELIDADE_MODULE_TABS[module];
  const targetModule = financeTab ? 'financeiro' : servicosTab ? 'servicos_assinaturas' : fidelidadeTab ? 'fidelidade' : module;
  const targetTab = financeTab || servicosTab || fidelidadeTab || tab;
  const base = CLIENT_MODULE_ROUTES[targetModule as Module] || 'dashboard';
  const [routeTab, childTabFromCombined] = targetModule === 'servicos_assinaturas' && targetTab?.includes('::')
    ? targetTab.split('::')
    : [targetTab, undefined];
  
  const isGsaStore = targetModule === ('gsa_store' as Module);
  const path = (targetModule === 'financeiro' || targetModule === 'fidelidade' || targetModule === 'servicos_assinaturas') && routeTab 
    ? `/cliente/${base}/${routeTab}` 
    : isGsaStore && routeTab && routeTab !== 'home'
      ? `/cliente/${base}/${routeTab}`
      : `/cliente/${base}`;

  const params = new URLSearchParams();

  if (childTabFromCombined) params.set('tab', childTabFromCombined);
  if (targetModule === 'servicos_assinaturas' && servicosTab && tab) params.set('tab', tab);
  if (targetModule !== 'financeiro' && targetModule !== 'fidelidade' && targetModule !== 'servicos_assinaturas' && !isGsaStore && targetTab) params.set('tab', targetTab);
  if (itemId) params.set('itemId', itemId);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function ClientPortal({ clientId, onLogout, initialModule, initialStoreTab, initialStoreItemId }: ClientPortalProps) {
  const route = useAppLocation();
  const { levels } = useVipLevels();
  
  // O estado do módulo e abas é diretamente derivado da URL reativa
  const activeModule = (route.area === 'marketplace' 
    ? (route.module === 'classificados' ? 'classificados' : 'gsa_store') 
    : route.module) as Module;
  const activeTab = route.submodule;
  const activeItemId = route.itemId;
  
  const [moduleKey, setModuleKey] = useState(0);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showWelcomeBonusModal, setShowWelcomeBonusModal] = useState(false);
  const [welcomeBonusData, setWelcomeBonusData] = useState<{ type: string, value: number } | null>(null);
  const [animateBonus, setAnimateBonus] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vipModuleConfig, setVipModuleConfig] = useState({ ativo: true, oculto: false });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('client_sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('client_sidebar_pinned');
    return saved ? JSON.parse(saved) : true;
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [modalIndicacaoConfig, setModalIndicacaoConfig] = useState({
    ativo: true,
    titulo: 'Você foi indicado!',
    descricao: 'Para validar a segunda etapa da sua indicação e garantir seu bônus, siga estes passos:',
    acaoBotao: 'url',
    moduloDestino: 'orcamentos',
    urlBotao: 'https://getsemani-gsa.netlify.app/',
    textoBotao: 'Solicitar Serviços',
    tamanho: 'md'
  });
  const isCheckingBonus = useRef(false);
  const clientStatusRef = useRef<string | null>(null);
  const clientBlockedRef = useRef<boolean | null>(null);
  // Ref to always have the latest fetchCliente inside realtime callbacks (avoids stale closure)
  const fetchClienteRef = useRef<() => Promise<void>>(() => Promise.resolve());
  
  // Ref for auto-resizing client name
  const nameRef = useRef<HTMLParagraphElement>(null);

  const navigateClientModule = (module: Module, tab?: string, itemId?: string, replaceFlag = false) => {
    let path = routes.client.dashboard();

    if (module === 'dashboard') {
      path = routes.client.dashboard();
    } else if (module === 'perfil') {
      path = routes.client.perfil();
    } else if (module === 'servicos_assinaturas' || module === 'orcamentos' || module === 'servicos' || module === 'produtos' || module === 'assinaturas') {
      if (tab === 'orcamentos') path = routes.client.services.orcamentos();
      else if (tab === 'servicos') path = routes.client.services.servicos();
      else if (tab === 'produtos') path = routes.client.services.produtos();
      else if (tab === 'assinaturas') path = routes.client.services.assinaturas();
      else path = routes.client.services.root();
    } else if (module === 'financeiro') {
      path = routes.client.finance.root();
    } else if (module === 'fidelidade') {
      path = routes.client.loyalty.root();
    } else if (module === 'suporte') {
      path = routes.client.support();
    } else if ((module as string) === 'gsa_store') {
      if (tab === 'pacotes-viagem') {
        path = routes.marketplace.travelPackages.root();
      } else if (tab === 'classificados') {
        path = routes.marketplace.classifieds.root();
      } else if (tab === 'loja' || (tab && tab.startsWith('loja-'))) {
        const sub = tab.replace('loja-', '');
        if (sub === 'produtos') path = routes.marketplace.store.product(itemId || '');
        else if (sub === 'assinaturas') path = routes.marketplace.store.subscription(itemId || '');
        else path = routes.marketplace.store.root();
      } else {
        path = routes.marketplace.menu();
      }
    } else if ((module as string) === 'classificados') {
      path = routes.marketplace.classifieds.meusAnuncios();
    }

    navigate(path);
    setModuleKey(prev => prev + 1);

    // Auto collapse sidebar if not pinned on desktop
    if (!isSidebarPinned && window.innerWidth >= 1024) {
      setIsSidebarCollapsed(true);
      localStorage.setItem('client_sidebar_collapsed', JSON.stringify(true));
    }
  };

  const syncRouteToState = (replaceFlag = false) => {
    // Apenas atualiza a key do módulo para recarregar se necessário
    setModuleKey(prev => prev + 1);
  };

  useEffect(() => {
    const el = nameRef.current;
    if (!el || !cliente?.nome) return;
    const parent = el.parentElement;
    if (!parent) return;

    let lastWidth = -1;

    const resize = () => {
      const currentWidth = parent.clientWidth;
      if (currentWidth === 0 || currentWidth === lastWidth) return;
      lastWidth = currentWidth;
      
      let fontSize = 14; // 14px is text-sm
      el.style.fontSize = `${fontSize}px`;
      
      while (el.scrollWidth > parent.clientWidth && fontSize > 8) {
        fontSize -= 0.5;
        el.style.fontSize = `${fontSize}px`;
      }
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(resize);
    });
    observer.observe(parent);
    
    resize();

    return () => observer.disconnect();
  }, [cliente?.nome]);

  const { pendencies, refreshCounts, notifications, unreadNotifications, markAsRead, markAllAsRead } = useClientNotifications();

  interface MenuItem {
    id: Module;
    label: string | React.ReactNode;
    icon: any;
    count: number;
    locked: boolean;
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    const handleNavigateModule = (e: any) => {
      if (e.detail?.module) {
        navigateClientModule(e.detail.module as Module, e.detail.tab, e.detail.itemId);
      }
    };
    const handlePopState = () => syncRouteToState(true);
    window.addEventListener('navigate-module', handleNavigateModule);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('navigate-module', handleNavigateModule);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen failed:', err);
    }
  };

  useEffect(() => {
    if (cliente) {
      clientStatusRef.current = cliente.status;
      clientBlockedRef.current = cliente.bloqueado;
    }
  }, [cliente]);

  const ClientOrcamentosAny = ClientOrcamentos as any;
  const ClientServicosAny = ClientServicos as any;
  const ClientProdutosAny = ClientProdutos as any;
  const ClientAssinaturasAny = ClientAssinaturas as any;
  const ClientTransferenciasAny = ClientTransferencias as any;
  const ClientFinanceiroAny = ClientFinanceiro as any;

  useEffect(() => {
    fetchCliente();
    checkReferralStatus();
    checkWelcomeBonus();
    refreshCounts();
    fetchVipModuleConfig();
    verificarLiberacaoCreditoAgendada();

    // Channel 1: client row changes (balance, status, blocking, level IDs)
    const clientChannel = supabase
      .channel(`cliente-updates-${clientId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'clientes',
        filter: `id=eq.${clientId}`
      }, (payload) => {
        const newData = payload.new as any;
        
        // Merge flat columns from payload (no joins in realtime payload)
        setCliente(prev => prev ? { ...prev, ...newData } : null);
        
        // Fetch full data with joins to get updated level objects
        fetchClienteRef.current();
        
        if (newData.status === 'ativo' && (clientStatusRef.current === 'inativo' || !clientStatusRef.current)) {
          console.log('[Realtime] Cadastro aprovado detectado. Forçando verificação de bônus...');
          toast.success('Seu cadastro foi aprovado! Todos os módulos foram liberados.');
          navigateClientModule('dashboard', undefined, undefined, true);
          
          // Resetamos o ref de controle para garantir que a verificação de bônus execute 
          // mesmo que uma verificação anterior (feita enquanto inativo) tenha acabado de rodar
          isCheckingBonus.current = false;
          
          setTimeout(() => {
            checkWelcomeBonus();
          }, 800);
        } else if (newData.bloqueado === false && clientBlockedRef.current === true) {
          toast.success('Seu acesso foi liberado! Aproveite nossos serviços.');
          navigateClientModule('dashboard', undefined, undefined, true);
        } else if (((newData.status === 'inativo' && newData.cadastro_aprovado === false) || newData.bloqueado === true) && clientBlockedRef.current === false) {
          toast.error('Seu cadastro foi bloqueado para análise.');
          navigateClientModule('dashboard', undefined, undefined, true);
        }

        clientStatusRef.current = newData.status;
        clientBlockedRef.current = newData.bloqueado;
      })
      .subscribe();

    // Channel 2: level_history INSERT = admin changed level for this client
    // This is the most reliable trigger for level adjustments
    const levelHistoryChannel = supabase
      .channel(`level-history-${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'level_history',
        filter: `cliente_id=eq.${clientId}`
      }, () => {
        // Admin inserted a level history record — fetch updated client data
        fetchClienteRef.current();
      })
      .subscribe();

    syncRouteToState(true);

    const pendingServiceRequest = localStorage.getItem('gsa_pending_service_request');
    if (pendingServiceRequest) {
      localStorage.removeItem('gsa_pending_service_request');
      navigateClientModule('orcamentos', 'solicitar', undefined, true);
    }

    const pendingStoreCheckout = localStorage.getItem('gsa_pending_store_checkout');
    if (pendingStoreCheckout) {
      localStorage.removeItem('gsa_pending_store_checkout');
      navigateClientModule('gsa_store' as Module, 'shop', undefined, true);
    }

    const handleNavigate = () => { 
      navigateClientModule('financeiro');
    };
    window.addEventListener('navigate-to-financeiro', handleNavigate);
    window.addEventListener('voucher-redeemed', handleNavigate);
    return () => {
      window.removeEventListener('navigate-to-financeiro', handleNavigate);
      window.removeEventListener('voucher-redeemed', handleNavigate);
      supabase.removeChannel(clientChannel);
      supabase.removeChannel(levelHistoryChannel);
    };
  }, [clientId]);

  const fetchVipModuleConfig = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['modulo_area_vip_ativo', 'modulo_area_vip_oculto']);
      if (data) {
        const ativo = data.find((s: any) => s.key === 'modulo_area_vip_ativo')?.value;
        const oculto = data.find((s: any) => s.key === 'modulo_area_vip_oculto')?.value;
        setVipModuleConfig({
          ativo: ativo !== 'false',
          oculto: oculto === 'true'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar config VIP:', error);
    }
  };

  const fetchModalIndicacaoConfig = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'modal_indicacao_ativo',
          'modal_indicacao_titulo',
          'modal_indicacao_descricao',
          'modal_indicacao_acao_botao',
          'modal_indicacao_modulo_destino',
          'modal_indicacao_url_botao',
          'modal_indicacao_texto_botao',
          'modal_indicacao_tamanho'
        ]);
      if (data) {
        const get = (key: string, def: string) => data.find(s => s.key === key)?.value ?? def;
        setModalIndicacaoConfig({
          ativo: get('modal_indicacao_ativo', 'true') !== 'false',
          titulo: get('modal_indicacao_titulo', 'Você foi indicado!'),
          descricao: get('modal_indicacao_descricao', 'Para validar a segunda etapa da sua indicação e garantir seu bônus, siga estes passos:'),
          acaoBotao: get('modal_indicacao_acao_botao', 'url'),
          moduloDestino: get('modal_indicacao_modulo_destino', 'orcamentos'),
          urlBotao: get('modal_indicacao_url_botao', 'https://getsemani-gsa.netlify.app/'),
          textoBotao: get('modal_indicacao_texto_botao', 'Solicitar Serviços'),
          tamanho: get('modal_indicacao_tamanho', 'md')
        });
      }
    } catch (err) {
      console.error('Erro ao carregar config do modal de indicação:', err);
    }
  };

  // Listener realtime para sincronizar estado do módulo VIP em tempo real
  useEffect(() => {
    fetchVipModuleConfig();
    fetchModalIndicacaoConfig();
    const vipConfigChannel = supabase
      .channel(`vip-module-config-${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings',
      }, () => {
        fetchVipModuleConfig();
        fetchModalIndicacaoConfig();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(vipConfigChannel);
    };
  }, []);


  const fetchCliente = async () => {
    try {
      // First try fetching client
      let { data, error } = await supabase
        .from('clientes')
        .select('*, auto_level:client_levels!nivel_id(*), manual_level:client_levels!nivel_manual_id(*)')
        .eq('id', clientId)
        .single();
        
      if (error) {
        console.error('Error fetching cliente:', error);
        setFetchError(`Erro ao carregar dados do cliente: ${error.message}`);
        toast.error(`Erro ao carregar dados do cliente: ${error.message}`);
      }
      
      if (data) {
        setCliente(data);
        setFetchError(null);
        if (data.status === 'inativo' && data.cadastro_aprovado === false) {
          navigateClientModule('dashboard', undefined, undefined, true);
        }
      } else {
        setFetchError('Não foi possível carregar os dados do cliente.');
        toast.error('Não foi possível carregar os dados do cliente.');
      }
    } catch (err: any) {
      console.error('Exception in fetchCliente:', err);
      setFetchError(`Erro inesperado: ${err.message}`);
      toast.error(`Erro inesperado: ${err.message}`);
    }
  };
  // Always keep ref in sync with the latest fetchCliente
  fetchClienteRef.current = fetchCliente;

  const checkReferralStatus = async () => {
    const { data: client } = await supabase
      .from('clientes')
      .select('indicacao_origem_id')
      .eq('id', clientId)
      .single();

    if (client?.indicacao_origem_id) {
      const { data: indicacao } = await supabase
        .from('indicacoes')
        .select('status')
        .eq('id', client.indicacao_origem_id)
        .single();

      if (indicacao?.status === 'aberta') {
        // Check if client has any orcamentos
        const { count } = await supabase
          .from('orcamentos')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', clientId);

        if (count === 0) {
          setShowReferralModal(true);
        }
      }
    }
  };

  const checkWelcomeBonus = async () => {
    if (isCheckingBonus.current) return;
    isCheckingBonus.current = true;

    console.log('[Bonus] Verificando bônus de boas-vindas...');

    try {
      // 1. Check if client has pending bonus and is active
      const { data: clientData, error: fetchErr } = await supabase
        .from('clientes')
        .select('status, bonus_boas_vindas_pendente, saldo_pontos, saldo_carteira, indicacao_origem_id')
        .eq('id', clientId)
        .single();
      
      if (fetchErr || !clientData) {
        isCheckingBonus.current = false;
        return;
      }
      
      if (clientData.status !== 'ativo') {
        console.log('[Bonus] Cliente ainda inativo. Aguardando aprovação.');
        isCheckingBonus.current = false;
        return;
      }

      // Clientes indicados NÃO recebem o bônus de boas-vindas padrão —
      // eles já recebem o "Bônus de indicação" específico no momento do cadastro.
      if (clientData.indicacao_origem_id) {
        console.log('[Bonus] Cliente indicado — bônus de boas-vindas padrão suprimido.');
        // Garante que a flag fica limpa para não reprocessar
        if (clientData.bonus_boas_vindas_pendente) {
          await supabase.from('clientes').update({
            bonus_boas_vindas_pendente: false
          }).eq('id', clientId);
        }
        isCheckingBonus.current = false;
        return;
      }
      
      if (!clientData.bonus_boas_vindas_pendente) {
        console.log('[Bonus] Flag de bônus pendente é false. Nada a processar.');
        return;
      }

      console.log('[Bonus] Bônus pendente detectado. Processando...');

      // 1.1 Verificação de Idempotência: Checar se o bônus já foi lançado no extrato (segurança extra)
      const { data: existingBonusCheck } = await supabase
        .from('pontos_movimentacoes')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('descricao', 'Bônus de Boas-vindas')
        .maybeSingle();

      if (existingBonusCheck) {
        console.log('[Bonus] Bônus já existe no extrato. Limpando flag e exibindo.');
        await supabase.from('clientes').update({ 
          bonus_boas_vindas_pendente: false
        }).eq('id', clientId);

        const { data: settings } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['bonus_cadastro_tipo', 'bonus_cadastro_valor']);
        const bonusType = settings?.find(s => s.key === 'bonus_cadastro_tipo')?.value || 'pontos';
        const bonusValue = parseInt(settings?.find(s => s.key === 'bonus_cadastro_valor')?.value || '100');
        
        setWelcomeBonusData({ type: bonusType, value: bonusValue });
        await createWelcomeSequence(clientId, bonusValue, 'Básico');
        
        playPremiumBeep();
        setShowWelcomeBonusModal(true);
        // Atualiza dados locais sem entrar em loading
        fetchCliente();
        return;
      }

      // 2. Get system settings for bonus
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['bonus_cadastro_tipo', 'bonus_cadastro_valor']);

      const bonusType = settings?.find(s => s.key === 'bonus_cadastro_tipo')?.value || 'pontos';
      const bonusValue = parseInt(settings?.find(s => s.key === 'bonus_cadastro_valor')?.value || '100');
      
      if (isNaN(bonusValue) || bonusValue <= 0) {
        console.warn('[Bonus] Valor de bônus inválido nas configurações.');
        isCheckingBonus.current = false;
        return;
      }

      setWelcomeBonusData({ type: bonusType, value: bonusValue });
      playPremiumBeep();

      // 3. Processar bônus via RPC segura (evita erros de trigger e RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc('processar_bonus_boas_vindas_seguro', {
        p_cliente_id: clientId
      });

      if (rpcError || !rpcData?.success) {
        console.error('[Bonus] Erro ao processar bônus via RPC:', rpcError || rpcData?.message);
        isCheckingBonus.current = false;
        return;
      }

      console.log('[Bonus] Bônus processado com sucesso:', rpcData);
      
      // 4. Atualizar UI e mostrar modal
      setShowWelcomeBonusModal(true);
      fetchCliente();

    } catch (error) {
      console.error('[Bonus] Erro crítico ao verificar bônus:', error);
      isCheckingBonus.current = false;
    }
    // isCheckingBonus.current permanece true após sucesso para evitar re-trigger na mesma sessão
  };

  const verificarLiberacaoCreditoAgendada = async () => {
    try {
      const result = await callClientRpc<{ released?: number }>('gsa_client_process_scheduled_credit_release');
      if (Number(result?.released || 0) > 0) await fetchCliente();
    } catch (error) {
      console.error('Erro ao solicitar a liberação segura de crédito:', error);
    }
  };

  const handleRequestService = () => {
    window.open('https://getsemani-gsa.netlify.app/', '_blank');
  };

  const currentPoints = cliente?.pontos_totais || 0;
  
  // Resolve current level using dbId UUID matching (works immediately from realtime payload)
  // Priority: manual level (nivel_manual_id) > auto level (nivel_id) > points-based fallback
  let currentLevel = null;
  if (levels.length > 0) {
    const manualId = cliente?.nivel_manual_id;
    const autoId = cliente?.nivel_id;
    
    if (manualId) {
      // Try matching by dbId first (exact UUID match from DB)
      currentLevel = (levels as any[]).find((l: any) => l.dbId === manualId)
        // Fallback: match by joined relation object name
        || (cliente?.manual_level ? levels.find(l => l.name.toLowerCase() === (cliente.manual_level as any)?.nome_nivel?.toLowerCase()) : null);
    }
    if (!currentLevel && autoId) {
      currentLevel = (levels as any[]).find((l: any) => l.dbId === autoId)
        || (cliente?.auto_level ? levels.find(l => l.name.toLowerCase() === (cliente.auto_level as any)?.nome_nivel?.toLowerCase()) : null);
    }
    if (!currentLevel) {
      // Final fallback: calculate from points
      currentLevel = levels.find(l => currentPoints >= l.minPoints && (l.maxPoints === null || currentPoints <= l.maxPoints)) || levels[0];
    }
  }
  const currentLevelName = currentLevel?.name || '';
  
  const isVip = currentLevelName !== 'Básico';

  const isBlocked = (
    ['bloqueado', 'inativo', 'excluido'].includes(String(cliente?.status || '').toLowerCase())
    || cliente?.cadastro_aprovado === false
    || cliente?.bloqueado === true
  );
  const restrictedModules = new Set(['dashboard', 'perfil', 'suporte']);

  useEffect(() => {
    if (cliente && isBlocked && !restrictedModules.has(String(activeModule))) {
      toast.error('Este módulo não está disponível para um cadastro restrito.');
      navigateClientModule('dashboard', undefined, undefined, true);
    }
  }, [activeModule, cliente?.id, isBlocked]);

  let menuItems: MenuItem[] = [
    { id: 'perfil', label: 'Meu Perfil', icon: User, count: pendencies.modulePerfil, locked: false },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, count: 0, locked: false },
    { id: 'gsa_store' as Module, label: 'Marketplace GSA', icon: Store, count: 0, locked: isBlocked },
    { id: 'classificados' as Module, label: 'Meus Classificados', icon: Tags, count: 0, locked: isBlocked },
    { id: 'credito_loja' as Module, label: 'Meu Crédito', icon: Landmark, count: 0, locked: isBlocked },
    { id: 'servicos_assinaturas', label: 'Serviços e Assinaturas', icon: Briefcase, count: pendencies.moduleOrcamentos + pendencies.moduleServicos + pendencies.moduleProdutos + pendencies.moduleAssinaturas, locked: isBlocked },
    { id: 'orcamentos', label: 'Meus Orçamentos', icon: FileText, count: pendencies.moduleOrcamentos, locked: isBlocked },
    { id: 'servicos', label: 'Meus Serviços', icon: Briefcase, count: pendencies.moduleServicos, locked: isBlocked },
    { id: 'produtos', label: 'Meus Produtos', icon: Package, count: pendencies.moduleProdutos, locked: isBlocked },
    { id: 'assinaturas', label: 'Minhas Assinaturas', icon: Calendar, count: pendencies.moduleAssinaturas, locked: isBlocked },
    { id: 'emprestimos', label: 'Meus Empréstimos', icon: Landmark, count: pendencies.moduleEmprestimos, locked: isBlocked },
    { id: 'transferencias', label: 'Transferências', icon: ArrowLeftRight, count: 0, locked: isBlocked },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard, count: pendencies.moduleFinanceiro, locked: isBlocked },
    { id: 'fidelidade', label: 'Fidelidade', icon: Gift, count: pendencies.moduleVouchers + pendencies.moduleIndiqueGanhe + pendencies.modulePromocoes, locked: isBlocked },
    { id: 'promocoes', label: 'Promoções', icon: Megaphone, count: pendencies.modulePromocoes, locked: isBlocked },
    { id: 'premios', label: 'Meus Prêmios', icon: Gift, count: 0, locked: isBlocked },
    { id: 'vouchers', label: 'Vouchers', icon: Ticket, count: pendencies.moduleVouchers, locked: isBlocked },
    { id: 'indique-ganhe', label: 'Indique e Ganhe', icon: Users, count: pendencies.moduleIndiqueGanhe, locked: isBlocked },
    { id: 'pontos', label: 'Meus Pontos', icon: Star, count: 0, locked: isBlocked },
    // Área VIP: só inclui no menu se não estiver oculto
    ...(!vipModuleConfig.oculto ? [{ id: 'area_vip' as Module, label: 'Área VIP', icon: Crown, count: 0, locked: isBlocked || !vipModuleConfig.ativo }] : []),
    { id: 'suporte', label: 'Suporte', icon: MessageSquare, count: pendencies.moduleSuporte, locked: false },
  ];
  menuItems = menuItems.filter(item => !['classificados', 'credito_loja', 'emprestimos', 'transferencias', 'orcamentos', 'servicos', 'produtos', 'assinaturas', 'vouchers', 'pontos', 'promocoes', 'premios', 'indique-ganhe', 'area_vip'].includes(String(item.id)));

  const handleOpenTicket = async (assunto: string, descricao: string) => {
    try {
      setIsOpeningTicket(true);

      // Verificação de ticket duplicado
      const { data: existingTickets, error: checkError } = await supabase
        .from('tickets')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('assunto', assunto)
        .neq('status', 'concluido')
        .limit(1);

      if (checkError) throw checkError;

      if (existingTickets && existingTickets.length > 0) {
        toast.error('Identificamos que você já possui um atendimento em andamento sobre este assunto. Por favor, aguarde o retorno da nossa equipe no módulo de Suporte.');
        navigateClientModule('suporte');
        return;
      }

      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert([{
        cliente_id: clientId,
        assunto,
        descricao,
        status: 'aberto'
      }]).select('id').single();

      if (ticketError) throw ticketError;

      // Notify Client (Feedback)
      await createNotification(
        clientId,
        'Ticket de Suporte Aberto! 💬',
        `Seu chamado "${assunto}" foi registrado e nossa equipe retornará em breve.`,
        'suporte',
        'abertos',
        ticket.id
      );

      // Notify Admin (Alert)
      await createNotification(
        null, // destinatario_tipo = 'admin'
        'Novo Ticket de Suporte (Bloqueio)',
        `O cliente ${cliente?.nome || clientId} abriu um ticket sobre bloqueio de conta: "${assunto}"`,
        'suporte',
        'abertos',
        ticket.id,
        'sistema',
        { prioridade: 'alta' }
      );

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: clientId,
        ator_nome: cliente?.nome,
        acao: 'ABRIR_TICKET',
        detalhes: `Abriu um ticket de suporte: ${assunto}`
      });

      navigateClientModule('suporte');
      toast.success('Ticket aberto com sucesso! Prazo de retorno de até 48 horas.');
    } catch (error: any) {
      console.error('Erro ao abrir ticket:', error);
      toast.error('Não foi possível processar sua solicitação no momento. Por favor, tente novamente em instantes ou entre em contato diretamente com nosso suporte.');
    } finally {
      setIsOpeningTicket(false);
    }
  };

  if (!cliente) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f8f7f5]">
        {fetchError ? (
          <div className="text-center">
            <p className="text-red-600 font-medium mb-4">{fetchError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-black"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[#1a1a1a]/60 font-medium">Carregando...</p>
          </div>
        )}
      </div>
    );
  }

  const isEffectiveExpanded = isSidebarPinned || !isSidebarCollapsed || isSidebarHovered;

  return (
    <div className="flex min-h-screen bg-[#f8f7f5] overflow-hidden font-sans">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        onMouseEnter={() => !isMobile && setIsSidebarHovered(true)}
        onMouseLeave={() => !isMobile && setIsSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-black/5 bg-[#fdfcfb] transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 w-72' : (isMobile ? '-translate-x-full w-72' : '')
        } ${
          !isMobile ? (isEffectiveExpanded ? 'lg:w-72' : 'lg:w-20') : ''
        }`}
      >
        <div className="flex h-24 items-center justify-between px-6">
          {isEffectiveExpanded ? (
            <span className="text-xl tracking-tight text-[#1a1a1a] font-medium truncate">Grupo GSA</span>
          ) : (
            <span className="text-xl font-bold tracking-tight text-[#1a1a1a] mx-auto">GSA</span>
          )}
          
          {!isMobile && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  const newPinned = !isSidebarPinned;
                  setIsSidebarPinned(newPinned);
                  localStorage.setItem('client_sidebar_pinned', JSON.stringify(newPinned));
                  if (newPinned) {
                    setIsSidebarCollapsed(false);
                    localStorage.setItem('client_sidebar_collapsed', JSON.stringify(false));
                  }
                }}
                className={`rounded-full p-1.5 hover:bg-black/5 transition-colors ${isSidebarPinned ? 'text-indigo-600' : 'text-[#1a1a1a]/30'}`}
                title={isSidebarPinned ? "Desafixar menu" : "Fixar menu"}
              >
                <Pin className="h-3.5 w-3.5" style={{ transform: isSidebarPinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
              </button>
              <button 
                onClick={() => {
                  const newCollapsed = !isSidebarCollapsed;
                  setIsSidebarCollapsed(newCollapsed);
                  localStorage.setItem('client_sidebar_collapsed', JSON.stringify(newCollapsed));
                  if (newCollapsed) {
                    setIsSidebarPinned(false);
                    localStorage.setItem('client_sidebar_pinned', JSON.stringify(false));
                  }
                }}
                className="rounded-full p-1.5 hover:bg-black/5 transition-colors text-[#1a1a1a]/60"
                title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-full p-2 hover:bg-black/5 transition-colors lg:hidden">
            <X className="h-5 w-5 text-[#1a1a1a]/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          <div 
            onClick={() => {
              navigateClientModule('perfil');
              setIsMobileMenuOpen(false);
              if (!isSidebarPinned && !isMobile) {
                setIsSidebarCollapsed(true);
                localStorage.setItem('client_sidebar_collapsed', JSON.stringify(true));
              }
            }}
            className={`mb-8 flex items-center rounded-2xl bg-white ring-1 ring-black/5 shadow-sm cursor-pointer hover:bg-neutral-50 transition-all ${
              isEffectiveExpanded ? 'p-4 gap-4 w-full' : 'p-2 justify-center mx-auto w-12 h-12'
            }`}
            title={!isEffectiveExpanded ? cliente.nome : undefined}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-white">
              <User className="h-5 w-5" />
            </div>
            {isEffectiveExpanded && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p ref={nameRef} className="font-medium text-[#1a1a1a] whitespace-nowrap text-sm truncate">{cliente.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-medium tracking-widest text-[#1a1a1a]/40 uppercase">{cliente.codigo_cliente}</p>
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase tracking-wider ${
                    cliente.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                    cliente.status === 'inativo' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {cliente.status === 'inativo' && !cliente.cadastro_aprovado ? 'Em Análise' : cliente.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.locked) {
                    if (!vipModuleConfig.ativo && item.id === 'area_vip') {
                      toast.error('Área VIP desativada por tempo indeterminado.');
                    } else {
                      toast.error('Módulo bloqueado. Seu cadastro está em análise.');
                    }
                    return;
                  }
                  navigateClientModule(item.id as Module);
                  setIsMobileMenuOpen(false);
                }}
                className={`group relative flex items-center justify-between rounded-full transition-all ${
                  isEffectiveExpanded ? 'w-full px-5 py-3.5 text-sm font-medium' : 'w-12 h-12 px-0 justify-center mx-auto'
                } ${
                  activeModule === item.id 
                    ? 'bg-[#1a1a1a] text-white shadow-md' 
                    : item.locked 
                      ? 'text-[#1a1a1a]/40 cursor-not-allowed'
                      : 'text-[#1a1a1a]/60 hover:bg-black/5 hover:text-[#1a1a1a]'
                }`}
                title={!isEffectiveExpanded ? String(item.label) : undefined}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`h-4 w-4 shrink-0 ${
                    activeModule === item.id 
                      ? 'text-white' 
                      : item.locked 
                        ? 'text-neutral-400'
                        : item.id === 'orcamentos' ? 'text-blue-600' :
                          item.id === 'servicos' ? 'text-indigo-600' :
                          item.id === 'produtos' ? 'text-emerald-600' :
                          item.id === 'assinaturas' ? 'text-purple-600' :
                          item.id === 'transferencias' ? 'text-orange-600' :
                          item.id === 'financeiro' ? 'text-emerald-600' :
                          item.id === 'servicos_assinaturas' ? 'text-blue-600' :
                          item.id === 'fidelidade' ? 'text-indigo-600' :
                          item.id === 'promocoes' ? 'text-pink-600' :
                          item.id === 'vouchers' ? 'text-yellow-600' :
                          item.id === 'indique-ganhe' ? 'text-rose-600' :
                          item.id === 'pontos' ? 'text-amber-500' :
                          item.id === 'area_vip' ? 'text-amber-600' :
                          item.id === 'emprestimos' ? 'text-amber-600' :
                          item.id === 'suporte' ? 'text-sky-600' :
                          'text-[#1a1a1a]/40 group-hover:text-[#1a1a1a]/60'
                  }`} />
                  {isEffectiveExpanded && <span>{item.label}</span>}
                </div>
                {isEffectiveExpanded ? (
                  <div className="flex items-center gap-2">
                    {item.locked ? (
                      <Lock className="h-4 w-4 opacity-50" />
                    ) : (
                      <>
                        {item.count > 0 && (
                          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${activeModule === item.id ? 'bg-white text-[#1a1a1a]' : 'bg-[#1a1a1a] text-white'}`}>
                            {item.count}
                          </span>
                        )}
                        {activeModule === item.id && <ChevronRight className="h-4 w-4 opacity-50" />}
                      </>
                    )}
                  </div>
                ) : (
                  !item.locked && item.count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm">
                      {item.count}
                    </span>
                  )
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4">
          <button 
            onClick={onLogout}
            className={`flex items-center gap-3 rounded-full text-sm font-medium text-red-600/80 transition-all hover:bg-red-50 hover:text-red-600 ${
              isEffectiveExpanded ? 'w-full px-5 py-3.5' : 'w-12 h-12 px-0 justify-center mx-auto'
            }`}
            title={!isEffectiveExpanded ? "Sair do Portal" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {isEffectiveExpanded && <span>Sair do Portal</span>}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-24 items-center justify-between bg-[#f8f7f5]/80 px-6 backdrop-blur-md lg:px-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-full bg-white p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:bg-black/5 lg:hidden"
            >
              <Menu className="h-5 w-5 text-[#1a1a1a]" />
            </button>
            <h1 className="text-2xl tracking-tight text-[#1a1a1a] lg:text-3xl">
              {menuItems.find(i => i.id === activeModule)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFullscreen}
              className="group hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all hover:bg-black/5"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5 text-[#1a1a1a]/60 group-hover:text-[#1a1a1a]" />
              ) : (
                <Maximize className="h-5 w-5 text-[#1a1a1a]/60 group-hover:text-[#1a1a1a]" />
              )}
            </button>
            <UniversalNotificationBell 
              variant="client"
              notifications={notifications}
              unreadCount={unreadNotifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNavigate={(mod, tab, itemId) => {
                navigateClientModule(mod, tab, itemId);
              }}
            />
          </div>
        </header>
        <div className={activeModule === 'area_vip' ? '' : (activeModule as string) === 'gsa_store' ? 'p-4 lg:px-6 lg:pt-2 lg:pb-12' : 'p-6 lg:p-12'}>
          {activeModule !== 'dashboard' && (activeModule as string) !== 'gsa_store' && (activeModule as string) !== 'classificados' && activeModule !== 'financeiro' && activeModule !== 'fidelidade' && activeModule !== 'servicos_assinaturas' && (
            <button 
              onClick={() => {
                navigateClientModule('dashboard');
              }}
              className="mb-6 flex items-center gap-2 px-4 h-10 rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-black/5 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
              <span className="text-sm font-medium text-[#1a1a1a]">Voltar</span>
            </button>
          )}
          {isBlocked && (
            <div className="mb-8 rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 flex items-start gap-4 animate-pulse-subtle">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Cadastro Bloqueado</h3>
                <p className="mt-1 text-sm text-red-800 leading-relaxed">
                  Seu cadastro consta bloqueado para análise. Para mais informações, entre em contato com nosso suporte clicando no botão abaixo.
                </p>
                <button
                  onClick={() => handleOpenTicket(
                    'Informações sobre Bloqueio de Conta',
                    `Olá, gostaria de obter mais informações sobre o bloqueio do meu cadastro.\n\nCliente: ${cliente.nome}\nCódigo: ${cliente.codigo_cliente}\nCPF/CNPJ: ${cliente.tipo_pessoa === 'pf' ? cliente.cpf : cliente.cnpj}`
                  )}
                  disabled={isOpeningTicket}
                  className="mt-4 px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isOpeningTicket ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Abrindo...
                    </>
                  ) : (
                    'Suporte'
                  )}
                </button>
              </div>
            </div>
          )}

          <motion.div 
            key={`${activeModule}-${moduleKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={activeModule === 'dashboard' ? '' : activeModule === 'area_vip' ? '' : 'card-refined'}
          >
            {activeModule === 'dashboard' && (
              <ClientDashboard 
                menuItems={menuItems} 
                onNavigate={(mod) => {
                  const item = menuItems.find(i => i.id === mod);
                  if (item?.locked) {
                    if (!vipModuleConfig.ativo && mod === 'area_vip') {
                      toast.error('Área VIP desativada por tempo indeterminado.');
                    } else {
                      toast.error('Módulo bloqueado. Seu cadastro está em análise.');
                    }
                    return;
                  }
                  navigateClientModule(mod as Module);
                }} 
                cliente={cliente}
                vipModuleConfig={vipModuleConfig}
              />
            )}
            {activeModule === 'perfil' && <ClientProfile cliente={cliente} onOpenTicket={handleOpenTicket} initialTab={activeTab} initialItemId={activeItemId} />}
            {activeModule === 'orcamentos' && (
              <ClientOrcamentosAny 
                clientId={clientId} 
                initialTab={activeTab} 
                initialItemId={activeItemId} 
                onNavigate={(mod: Module, tab?: string, itemId?: string) => {
                  navigateClientModule(mod, tab, itemId);
                }}
              />
            )}
            {activeModule === 'servicos' && <ClientServicosAny clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)} />}
            {activeModule === 'produtos' && <ClientProdutosAny clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)} />}
            {activeModule === 'assinaturas' && <ClientAssinaturasAny clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)} />}
            {activeModule === 'transferencias' && <ClientTransferenciasAny clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} cliente={cliente} />}
            {activeModule === 'financeiro' && (
              <ClientFinanceiroAny
                clientId={clientId}
                initialTab={activeTab}
                initialItemId={activeItemId}
                animateOnMount={animateBonus}
                cliente={cliente}
                onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)}
              />
            )}
            {activeModule === 'servicos_assinaturas' && (
              <ClientServicosAssinaturas
                clientId={clientId}
                initialTab={activeTab}
                initialItemId={activeItemId}
                onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)}
              />
            )}
            {activeModule === 'fidelidade' && (
              <ClientFidelidade
                clientId={clientId}
                cliente={cliente}
                initialTab={activeTab}
                initialItemId={activeItemId}
                animateOnMount={animateBonus}
                vipModuleConfig={vipModuleConfig}
                onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)}
              />
            )}
            {activeModule === 'vouchers' && <ClientVouchers clientId={clientId} initialItemId={activeItemId} />}
            {activeModule === 'pontos' && <ClientPontos clienteId={clientId} animateOnMount={animateBonus} initialCliente={cliente} initialTab={activeTab} initialItemId={activeItemId} />}
            {activeModule === 'indique-ganhe' && <ClientIndiqueGanhe clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} />}
            {activeModule === 'promocoes' && <ClientPromocoes clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} />}
            {activeModule === 'premios' && <ClientPremios clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} />}
            {((activeModule as string) === 'gsa_store' || (activeModule as string) === 'classificados') && (
              <MarketplaceGSAStore 
                clientId={clientId} 
                initialTab={activeTab}
                initialItemId={activeItemId}
                onNavigate={(mod, tab, itemId) => navigateClientModule(mod as Module, tab, itemId)} 
              />
            )}
            {activeModule === 'area_vip' && (
              vipModuleConfig.ativo
                ? <ClientAreaVIP cliente={cliente} initialTab={activeTab} initialItemId={activeItemId} />
                : (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                    <div className="h-20 w-20 rounded-3xl bg-neutral-100 flex items-center justify-center mb-6">
                      <Crown className="h-10 w-10 text-neutral-300" />
                    </div>
                    <h2 className="text-2xl font-black text-neutral-900 mb-3">Área VIP Indisponível</h2>
                    <p className="text-neutral-500 max-w-sm leading-relaxed">
                      O módulo Área VIP encontra-se <strong>desativado por tempo indeterminado</strong>. 
                      Para mais informações, entre em contato com o nosso suporte.
                    </p>
                    <button
                      onClick={() => navigateClientModule('suporte')}
                      className="mt-8 px-6 py-3 bg-[#1a1a1a] text-white text-sm font-bold rounded-2xl hover:bg-black transition-all shadow-lg"
                    >
                      Ir para o Suporte
                    </button>
                  </div>
                )
            )}
            {activeModule === 'suporte' && <ClientSuporte clientId={clientId} initialItemId={activeItemId} />}
            {activeModule === 'emprestimos' && <ClientEmprestimos clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} onNavigate={(mod: Module, tab?: string, itemId?: string) => navigateClientModule(mod, tab, itemId)} />}
            {activeModule === 'credito_loja' && (
              <ClientMeuCredito 
                clientId={clientId} 
                cliente={cliente}
                onRefreshCliente={fetchCliente}
                initialTab={activeTab}
                initialItemId={activeItemId}
                onNavigate={(mod, tab, itemId) => navigateClientModule(mod as Module, tab, itemId)}
              />
            )}
          </motion.div>
        </div>
      </main>

      {/* Referral Onboarding Modal */}
      <AnimatePresence>
        {showReferralModal && modalIndicacaoConfig.ativo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className={`relative w-full overflow-hidden rounded-[2rem] bg-[#fdfcfb] shadow-2xl ring-1 ring-black/5 ${
                modalIndicacaoConfig.tamanho === 'sm' ? 'max-w-sm' :
                modalIndicacaoConfig.tamanho === 'md' ? 'max-w-lg' :
                modalIndicacaoConfig.tamanho === 'lg' ? 'max-w-xl' : 'max-w-2xl'
              }`}
            >
              <button 
                onClick={() => setShowReferralModal(false)}
                className="absolute top-6 right-6 rounded-full p-2 text-[#1a1a1a]/40 transition-colors hover:bg-black/5 hover:text-[#1a1a1a]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="p-8 sm:p-10">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1a1a] text-white shadow-lg shadow-black/10">
                  <Gift className="h-8 w-8" />
                </div>

                <h2 className="text-3xl tracking-tight text-[#1a1a1a]">
                  {modalIndicacaoConfig.titulo}
                </h2>
                
                <div className="mt-6 space-y-6">
                  <p className="text-[#1a1a1a]/70 leading-relaxed">
                    {modalIndicacaoConfig.descricao}
                  </p>
                </div>

                <div className="mt-10 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowReferralModal(false);
                      if (modalIndicacaoConfig.acaoBotao === 'modulo') {
                        navigateClientModule(modalIndicacaoConfig.moduloDestino as Module);
                      } else {
                        window.open(modalIndicacaoConfig.urlBotao, '_blank');
                      }
                    }}
                    className="btn-primary w-full py-4 text-base"
                  >
                    {modalIndicacaoConfig.textoBotao}
                    {modalIndicacaoConfig.acaoBotao === 'url' && <ExternalLink className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setShowReferralModal(false)}
                    className="btn-secondary w-full border-transparent bg-transparent hover:bg-black/5"
                  >
                    Fazer isso mais tarde
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showWelcomeBonusModal && welcomeBonusData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[2rem] bg-[#fdfcfb] shadow-2xl ring-1 ring-black/5"
            >
              <button 
                onClick={() => setShowWelcomeBonusModal(false)}
                className="absolute top-6 right-6 rounded-full p-2 text-[#1a1a1a]/40 transition-colors hover:bg-black/5 hover:text-[#1a1a1a]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="p-8 sm:p-10 text-center">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                  <Gift className="h-10 w-10" />
                </div>

                <h2 className="text-3xl tracking-tight text-[#1a1a1a]">
                  Parabéns!
                </h2>
                
                <p className="mt-4 text-lg font-medium text-emerald-600">
                  Você ganhou {welcomeBonusData.type === 'pontos' ? `${welcomeBonusData.value} pontos` : formatCurrency(welcomeBonusData.value)} de boas-vindas!
                </p>

                <div className="mt-6 space-y-4 text-[#1a1a1a]/70 leading-relaxed">
                  <p>
                    {welcomeBonusData.type === 'pontos' 
                      ? 'Use seus pontos agora mesmo como desconto na sua primeira fatura.'
                      : 'Use seu saldo na carteira para abater o valor da sua primeira fatura.'}
                  </p>
                  {welcomeBonusData.type === 'pontos' && (
                    <p className="text-sm bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100">
                      <strong>Nota:</strong> O saque em dinheiro dos pontos só estará disponível após o pagamento da sua primeira fatura no sistema.
                    </p>
                  )}
                </div>

                <div className="mt-10">
                  <button
                    onClick={() => {
                      setShowWelcomeBonusModal(false);
                      setAnimateBonus(false);
                      navigateClientModule(welcomeBonusData.type === 'pontos' ? 'pontos' as Module : 'financeiro');
                      // Reset animateBonus after a short delay so it doesn't animate again on normal navigation
                      setTimeout(() => setAnimateBonus(false), 3000);
                    }}
                    className="btn-primary w-full py-4 text-base"
                  >
                    Resgatar {welcomeBonusData.type === 'pontos' ? 'Pontos' : 'Bônus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
