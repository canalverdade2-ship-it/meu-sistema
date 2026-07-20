import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag,
  MessageSquare,
  BarChart3, 
  LogOut,
  Menu,
  X,
  Crown,
  Gavel,
  Settings,
  ShieldAlert,
  Landmark,
  ClipboardList,
  ChevronRight,
  Circle,
  Clock,
  Maximize,
  Minimize,
  Server,
  Receipt,
  Gift,
  Package,
  Store,
  Tags,
  Plane,
  HeartPulse
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { callAdminRpc } from '../lib/adminRpc';
import { toast } from 'react-hot-toast';

// Roteamento
import { useAppLocation } from '../routing/useAppLocation';
import { navigate } from '../routing/navigationService';
import { routes } from '../routing/routeCatalog';

import { DashboardLayout } from '../components/ui/DashboardLayout';
import { UniversalNotificationBell } from '../components/ui/UniversalNotificationBell';
import { LogoGSA } from '../components/ui/LogoGSA';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

// Modules
import { Dashboard } from '../components/admin/Dashboard';
import { CadastroModule } from '../components/admin/CadastroModule';
import { VendasModule } from '../components/admin/VendasModule';
import { FinanceiroModule } from '../components/admin/FinanceiroModule';
import { TicketsModule } from '../components/admin/TicketsModule';
import { RelatoriosModule } from '../components/admin/RelatoriosModule';
import { ConfiguracoesModule } from '../components/admin/ConfiguracoesModule';
import { AreaVIPModule } from '../components/admin/AreaVIPModule';
import { AcessosModule } from '../components/admin/AcessosModule';
import { DemandasColaboradorModule } from '../components/admin/DemandasColaboradorModule';
import { SystemMonitorModule } from '../components/admin/SystemMonitorModule';
import { FiscalModule } from '../components/admin/FiscalModule';
import { CobrancaModule } from '../components/admin/CobrancaModule';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SystemStatusIndicator } from '../components/admin/SystemStatusIndicator';
import { PromocaoQuantidadeModule } from '../components/admin/PromocaoQuantidadeModule';
import { ClassifiedsModule } from '../components/admin/ClassifiedsModule';
import { TravelAdminModule } from '../components/admin/TravelAdminModule';
import { ProtectionAdminModule } from '../components/admin/ProtectionAdminModule';

interface AdminPanelProps {
  onLogout: () => void;
  adminType: 'admin' | 'colaborador';
  colaboradorId?: string;
  colaboradorModulos: string[];
}

type Module = 'dashboard' | 'cadastro' | 'catalogo' | 'operacoes' | 'loja' | 'classificados' | 'viagens' | 'saude' | 'seguros' | 'fidelidade' | 'atendimento' | 'vendas' | 'financeiro' | 'cobranca' | 'fiscal' | 'tickets' | 'relatorios' | 'configuracoes' | 'area_vip' | 'prestadores' | 'acessos' | 'demandas' | 'sistema' | 'promocoes';

type MenuGroup = {
  label: string;
  adminOnly?: boolean;
  items: { id: string; label: string; icon: any }[];
};

const ORGANIZED_MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'cadastro', label: 'Cadastros', icon: Users },
      { id: 'catalogo', label: 'Catalogo', icon: Package },
      { id: 'operacoes', label: 'Operacoes', icon: ClipboardList },
      { id: 'loja', label: 'Loja GSA Store', icon: Store },
      { id: 'classificados', label: 'Classificados GSA', icon: Tags },
      { id: 'viagens', label: 'Viagens GSA', icon: Plane },
      { id: 'saude', label: 'GSA Saúde', icon: HeartPulse },
      { id: 'seguros', label: 'GSA Seguros', icon: ShieldAlert },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: Landmark },
    ],
  },
  {
    label: 'Relacionamento',
    items: [
      { id: 'fidelidade', label: 'Fidelidade', icon: Gift },
      { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
    ],
  },
  {
    label: 'Gestao',
    items: [
      { id: 'relatorios', label: 'Relatorios', icon: BarChart3 },
      { id: 'configuracoes', label: 'Configuracoes', icon: Settings },
    ],
  },
  {
    label: 'Acesso',
    items: [
      { id: 'acessos', label: 'Gerenciar Acessos', icon: ShieldAlert },
    ],
  },
  {
    label: 'Infraestrutura',
    items: [
      { id: 'sistema', label: 'Saude do Sistema', icon: Server },
    ],
  },
];

const MODULE_ACCESS_ALIASES: Record<string, string[]> = {
  catalogo: ['cadastro'],
  operacoes: ['vendas', 'demandas'],
  loja: ['cadastro', 'vendas'],
  classificados: ['loja', 'vendas'],
  viagens: ['loja', 'vendas'],
  saude: ['loja', 'vendas'],
  seguros: ['loja', 'vendas'],
  fidelidade: ['cadastro', 'area_vip', 'promocoes'],
  atendimento: ['tickets'],
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden md:flex h-9 px-3.5 items-center justify-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-black/5 text-sm font-bold text-neutral-700 tabular-nums">
      <Clock className="h-4 w-4 text-neutral-400" />
      {time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export function AdminPanel({ onLogout, adminType, colaboradorId, colaboradorModulos }: AdminPanelProps) {
  const route = useAppLocation();
  const { pendencies, notifications, unreadNotifications, markAsRead, markAllAsRead, deleteAllNotifications } = useAdminNotifications();

  // Rotas reativas
  const activeModule = route.module as Module;
  const activeTab = route.submodule;
  const activeItemId = route.itemId;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [newCodeModal, setNewCodeModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [moduleKey, setModuleKey] = useState(0);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeModule, activeTab, activeItemId]);

  const [colaboradorNome, setColaboradorNome] = useState<string | null>(null);
  const [internalModulos, setInternalModulos] = useState<string[]>(colaboradorModulos || []);

  useEffect(() => {
    const fetchColaboradorNome = async () => {
      if (adminType === 'colaborador' && colaboradorId) {
        const { data } = await supabase.from('colaboradores').select('nome').eq('id', colaboradorId).single();
        if (data?.nome) {
          setColaboradorNome(data.nome);
          localStorage.setItem('colaboradorNome', data.nome);
        }
      }
    };
    fetchColaboradorNome();
  }, [adminType, colaboradorId]);

  const getBadgeCount = (id: string) => {
    switch(id) {
      case 'cadastro':   return pendencies.moduleCadastro;
      case 'catalogo':   return 0;
      case 'operacoes':  return pendencies.moduleVendas + pendencies.moduleDemandas;
      case 'loja':       return pendencies.moduleVendas;
      case 'fidelidade': return pendencies.cadastro_vouchers_pendentes + pendencies.cadastro_premios_pendentes + pendencies.moduleAcessos;
      case 'atendimento': return pendencies.moduleSuporte;
      case 'vendas':     return pendencies.moduleVendas;
      case 'financeiro': return pendencies.moduleFinanceiro + pendencies.moduleCobranca + pendencies.moduleFiscal;
      case 'cobranca':   return pendencies.moduleCobranca;
      case 'tickets':    return pendencies.moduleSuporte;
      case 'acessos':    return pendencies.moduleAcessos;
      case 'demandas':   return pendencies.moduleDemandas;
      case 'fiscal':     return pendencies.moduleFiscal;
      default: return 0;
    }
  };

  const allMenuItems = ORGANIZED_MENU_GROUPS.flatMap(g => g.items);
  const activeLabel = allMenuItems.find(i => i.id === activeModule)?.label ?? 'Dashboard';

  const normalizeAdminModule = (module: string): Module => {
    if (module === 'suporte' || module === 'tickets') return 'atendimento';
    if (module === 'cobranca' || module === 'fiscal') return 'financeiro';
    if (module === 'orcamentos' || module === 'servicos' || module === 'produtos' || module === 'assinaturas') return 'operacoes';
    if (module === 'prestadores' || module === 'clientes') return 'cadastro';
    if (module === 'emprestimos' || module === 'credito_loja') return 'financeiro';
    if (module === 'vouchers' || module === 'premios' || module === 'promocoes' || module === 'indique-ganhe' || module === 'area_vip') return 'fidelidade';
    return module as Module;
  };

  const canAccessMenuItem = (id: string) => {
    if (id === 'dashboard' || id === 'demandas') return true;
    if (adminType === 'admin') return true;
    const aliases = MODULE_ACCESS_ALIASES[id] || [id];
    return aliases.some(alias => internalModulos.includes(alias));
  };

  const visibleGroups = ORGANIZED_MENU_GROUPS
    .filter(g => !g.adminOnly || adminType === 'admin')
    .map(g => ({
      ...g,
      items: g.items.filter(item => canAccessMenuItem(item.id))
    }))
    .filter(g => g.items.length > 0);

  const sidebarOpen = isMobileMenuOpen || (isSidebarOpen && !isMobile) || (!isMobile && isSidebarOpen);

  return (
    <>
      <DashboardLayout
        theme="admin"
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        headerTitle={
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-neutral-300 hidden sm:block">GSA</span>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-300 hidden sm:block" />
            <span className="font-bold text-neutral-800">{activeLabel}</span>
          </nav>
        }
        headerContent={
          <>
            <div className="hidden md:flex items-center mr-2">
              <SystemStatusIndicator />
            </div>
            <LiveClock />
            <UniversalNotificationBell 
              variant="admin"
              notifications={notifications}
              unreadCount={unreadNotifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onDeleteAll={deleteAllNotifications}
              onNavigate={(module, tab, itemId) => {
                let adminModule = normalizeAdminModule(module as string) as any;
                let targetTab = tab;
                if ((module as string) === 'suporte') adminModule = 'atendimento';
                if ((module as string) === 'prestadores') adminModule = 'cadastro';
                if ((module as string) === 'orcamentos') adminModule = 'operacoes';
                if ((module as string) === 'cobranca' || (module as string) === 'fiscal') {
                  adminModule = 'financeiro';
                  targetTab = module as string;
                }
                if ((module as string) === 'emprestimos') adminModule = 'financeiro';
                if ((module as string) === 'credito_loja') {
                  adminModule = 'financeiro';
                  targetTab = 'credito';
                }
                
                setTimeout(() => {
                  let path = routes.admin.dashboard();
                  if (adminModule === 'cadastro') path = routes.admin.clients();
                  else if (adminModule === 'catalogo') path = routes.admin.products();
                  else if (adminModule === 'operacoes') path = routes.admin.orcamentos();
                  else if (adminModule === 'financeiro') path = routes.admin.financeiro();
                  else if (adminModule === 'atendimento') path = routes.admin.atendimento();
                  else if (adminModule === 'relatorios') path = routes.admin.relatorios();
                  else if (adminModule === 'configuracoes') path = routes.admin.configuracoes();
                  
                  navigate(path);
                }, 10);
              }}
            />
            <div className="h-10 w-10 rounded-xl bg-[#0F0F0F] flex items-center justify-center shadow-lg ring-1 ring-black/10">
              <span className="text-xs font-black text-white tracking-tight">
                {adminType === 'admin' ? 'AD' : 'CO'}
              </span>
            </div>
          </>
        }
        sidebarContent={
          <>
            <div className="flex h-[72px] items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <AnimatePresence mode="wait">
                {sidebarOpen ? (
                  <motion.div key="open" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="flex items-center gap-3 min-w-0">
                    <LogoGSA size="sm" variant="light" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-black text-white tracking-tight leading-none truncate">Grupo GSA</span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 leading-none mt-0.5">Gestão de Serviços</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto">
                    <LogoGSA size="sm" variant="light" />
                  </motion.div>
                )}
              </AnimatePresence>

              {!isMobile && (
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/60 transition-all shrink-0 ml-2">
                  {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              )}
              {isMobile && (
                <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/60 transition-all ml-2">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 custom-scrollbar space-y-5">
              {visibleGroups.map((group, gi) => (
                <div key={gi}>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 mb-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/20 select-none">
                        {group.label}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const badge = getBadgeCount(item.id);
                      const isActive = activeModule === item.id;
                      return (
                        <button key={item.id} onClick={() => {
                          let path = routes.admin.dashboard();
                          if (item.id === 'cadastro') path = routes.admin.clients();
                          else if (item.id === 'catalogo') path = routes.admin.products();
                          else if (item.id === 'operacoes') path = routes.admin.orcamentos();
                          else if (item.id === 'financeiro') path = routes.admin.financeiro();
                          else if (item.id === 'cobranca') path = routes.admin.cobranca();
                          else if (item.id === 'fiscal') path = routes.admin.fiscal();
                          else if (item.id === 'tickets') path = routes.admin.atendimento();
                          else if (item.id === 'relatorios') path = routes.admin.relatorios();
                          else if (item.id === 'configuracoes') path = routes.admin.configuracoes();
                          else if (item.id === 'acessos') path = routes.admin.acessos();
                          else if (item.id === 'sistema') path = routes.admin.sistema();
                          else if (item.id === 'classificados') path = '/admin/classificados';
                          else if (item.id === 'viagens') path = '/admin/viagens';
                          else if (item.id === 'saude') path = routes.admin.saude.root();
                          else if (item.id === 'seguros') path = routes.admin.seguros.root();
                          
                          navigate(path);
                          setIsMobileMenuOpen(false);
                        }} title={!isSidebarOpen && !isMobileMenuOpen ? item.label : undefined} className={`relative group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${isActive ? 'bg-white text-neutral-900 shadow-lg shadow-black/20' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-indigo-500" />}
                          <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-indigo-600' : ''}`} />
                          <AnimatePresence>
                            {sidebarOpen && (
                              <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="text-sm font-semibold flex-1 text-left truncate overflow-hidden">
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {badge > 0 && (
                            <>
                              {sidebarOpen ? (
                                <span className="shrink-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{badge > 99 ? '99+' : badge}</span>
                              ) : (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0F0F0F]" />
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="shrink-0 px-3 py-4 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {sidebarOpen && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 text-xs font-black text-white">
                    {adminType === 'admin' ? 'AD' : 'CO'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{adminType === 'admin' ? 'Administrador' : 'Colaborador'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{adminType === 'admin' ? 'Acesso Total' : 'Acesso Restrito'}</p>
                      <span className="px-1.5 py-[1px] text-[8px] font-bold rounded-full uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ativo</span>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" title="Online" />
                </div>
              )}
              <button onClick={onLogout} title="Sair com segurança" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400">
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {sidebarOpen && <span className="text-sm font-semibold">Sair com Segurança</span>}
              </button>
            </div>
          </>
        }
      >
        <div className="p-3 lg:p-5">
          <div className="rounded-[2rem] bg-white shadow-sm ring-1 ring-neutral-100 p-3 lg:p-4 min-h-[calc(100vh-140px)]">
            {activeModule === 'dashboard' && (
              <Dashboard
                adminType={adminType}
                colaboradorId={colaboradorId}
                colaboradorNome={colaboradorNome || undefined}
                colaboradorModulos={internalModulos}
                onNavigate={(module, tab) => {
                  const sourceModule = module as string;
                  let path = routes.admin.dashboard();
                  if (sourceModule === 'cadastro') path = routes.admin.clients();
                  else if (sourceModule === 'catalogo') path = routes.admin.products();
                  navigate(path);
                }}
              />
            )}
            {activeModule === 'cadastro'   && <ErrorBoundary><CadastroModule title="Cadastros" allowedTabs={['clientes', 'prestadores']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
            {activeModule === 'catalogo'   && <ErrorBoundary><CadastroModule title="Catalogo" allowedTabs={['servicos', 'produtos', 'assinaturas', 'categorias_loja']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
            {activeModule === 'operacoes'  && <ErrorBoundary><VendasModule title="Operacoes" allowedTabs={['orcamentos', 'demandas', 'os', 'produtos', 'assinaturas']} initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={(mod, tab, itemId) => {
              let path = routes.admin.dashboard();
              if (mod === 'cadastro') path = routes.admin.clients();
              else if (mod === 'catalogo') path = routes.admin.products();
              else if (mod === 'operacoes') path = routes.admin.orcamentos();
              else if (mod === 'financeiro') path = routes.admin.financeiro();
              else if (mod === 'atendimento') path = routes.admin.atendimento();
              navigate(path);
            }} /></ErrorBoundary>}
            {activeModule === 'loja'       && <ErrorBoundary><CadastroModule title="Loja GSA Store" allowedTabs={['gsa_store', 'categorias_loja']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
            {activeModule === 'fidelidade' && <ErrorBoundary><CadastroModule title="Fidelidade" allowedTabs={['indicacoes', 'vouchers', 'premios', 'promocoes']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
            {activeModule === 'atendimento' && <TicketsModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
            {activeModule === 'vendas'     && <ErrorBoundary><VendasModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={(mod, tab, itemId) => {
              let path = routes.admin.dashboard();
              if (mod === 'cadastro') path = routes.admin.clients();
              else if (mod === 'catalogo') path = routes.admin.products();
              else if (mod === 'operacoes') path = routes.admin.orcamentos();
              else if (mod === 'financeiro') path = routes.admin.financeiro();
              else if (mod === 'atendimento') path = routes.admin.atendimento();
              navigate(path);
            }} /></ErrorBoundary>}
            {activeModule === 'financeiro' && <FinanceiroModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={(mod, tab, itemId) => {
              let path = routes.admin.dashboard();
              if (mod === 'cadastro') path = routes.admin.clients();
              else if (mod === 'catalogo') path = routes.admin.products();
              else if (mod === 'operacoes') path = routes.admin.orcamentos();
              else if (mod === 'financeiro') path = routes.admin.financeiro();
              else if (mod === 'atendimento') path = routes.admin.atendimento();
              navigate(path);
            }} />}
            {activeModule === 'cobranca'   && <ErrorBoundary><CobrancaModule initialTab={activeTab} initialItemId={activeItemId} colaboradorNome={colaboradorNome} onNavigate={(mod, tab, itemId) => {
              let path = routes.admin.dashboard();
              if (mod === 'cadastro') path = routes.admin.clients();
              else if (mod === 'catalogo') path = routes.admin.products();
              else if (mod === 'operacoes') path = routes.admin.orcamentos();
              else if (mod === 'financeiro') path = routes.admin.financeiro();
              else if (mod === 'atendimento') path = routes.admin.atendimento();
              navigate(path);
            }} /></ErrorBoundary>}
            {activeModule === 'fiscal'     && <FiscalModule initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
            {activeModule === 'tickets'    && <TicketsModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
            {activeModule === 'relatorios' && <RelatoriosModule adminType={adminType} colaboradorModulos={internalModulos} />}
            {activeModule === 'configuracoes' && <ConfiguracoesModule />}
            {activeModule === 'area_vip'   && <AreaVIPModule initialItemId={activeItemId} colaboradorNome={colaboradorNome} />}
            {activeModule === 'demandas'   && <DemandasColaboradorModule colaboradorId={colaboradorId} adminType={adminType} initialItemId={activeItemId} initialTab={activeTab} colaboradorNome={colaboradorNome} />}
            {activeModule === 'acessos' && (adminType === 'admin' || internalModulos.includes('acessos')) && <AcessosModule adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} />}
            {activeModule === 'sistema' && (adminType === 'admin' || internalModulos.includes('sistema')) && <SystemMonitorModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
            {activeModule === 'promocoes' && <ErrorBoundary><PromocaoQuantidadeModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} /></ErrorBoundary>}
            {activeModule === 'classificados' && <ErrorBoundary><ClassifiedsModule initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
            {activeModule === 'viagens' && <ErrorBoundary><TravelAdminModule /></ErrorBoundary>}
            {activeModule === 'saude' && <ErrorBoundary><ProtectionAdminModule domain="saude" initialTab={activeTab} initialItemId={activeItemId} /></ErrorBoundary>}
            {activeModule === 'seguros' && <ErrorBoundary><ProtectionAdminModule domain="seguros" initialTab={activeTab} initialItemId={activeItemId} /></ErrorBoundary>}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
