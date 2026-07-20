import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Gift,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plane,
  Server,
  Settings,
  ShieldAlert,
  Store,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { callAdminRpc } from '../lib/adminRpc';
import { navigate } from '../routing/navigationService';
import { useAppLocation } from '../routing/useAppLocation';
import {
  adminModulePath,
  AdminModule,
  canAccessAdminModule,
  normalizeAdminModule,
  normalizeGrantedAdminModules,
} from '../routing/adminAccess';
import { DashboardLayout } from '../components/ui/DashboardLayout';
import { UniversalNotificationBell } from '../components/ui/UniversalNotificationBell';
import { LogoGSA } from '../components/ui/LogoGSA';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
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
import { PromocaoQuantidadeModule } from '../components/admin/PromocaoQuantidadeModule';
import { ClassifiedsModule } from '../components/admin/ClassifiedsModule';
import { TravelAdminModule } from '../components/admin/TravelAdminModule';
import { ProtectionAdminModule } from '../components/admin/ProtectionAdminModule';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SystemStatusIndicator } from '../components/admin/SystemStatusIndicator';

interface AdminPanelProps {
  onLogout: () => void | Promise<void>;
  adminType: 'admin' | 'colaborador';
  colaboradorId?: string;
  colaboradorModulos: string[];
}

type MenuItem = {
  id: AdminModule;
  label: string;
  icon: React.ElementType;
  defaultTab?: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'cadastro', label: 'Cadastros', icon: Users, defaultTab: 'clientes' },
      { id: 'catalogo', label: 'Catálogo', icon: Package, defaultTab: 'produtos' },
      { id: 'operacoes', label: 'Operações', icon: ClipboardList, defaultTab: 'orcamentos' },
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
      { id: 'financeiro', label: 'Financeiro Geral', icon: Landmark },
      { id: 'cobranca', label: 'Cobrança', icon: ShieldAlert },
      { id: 'fiscal', label: 'Fiscal', icon: FileText },
      { id: 'emprestimos', label: 'Empréstimos', icon: Landmark },
      { id: 'credito_loja', label: 'Crédito de Loja', icon: CreditCard },
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
    label: 'Gestão',
    items: [
      { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
  {
    label: 'Acesso',
    items: [{ id: 'acessos', label: 'Gerenciar Acessos', icon: ShieldAlert }],
  },
  {
    label: 'Infraestrutura',
    items: [{ id: 'sistema', label: 'Saúde do Sistema', icon: Server }],
  },
];

type AdminContext = {
  actor_type: 'admin' | 'colaborador';
  actor_id: string;
  actor_name?: string;
  modules?: string[];
  session_id: string;
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <div className="hidden h-9 items-center justify-center gap-2 rounded-xl bg-white px-3.5 text-sm font-bold tabular-nums text-neutral-700 shadow-sm ring-1 ring-black/5 md:flex">
      <Clock className="h-4 w-4 text-neutral-400" />
      {time.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </div>
  );
}

function accessModuleForRoute(rawModule: string, submodule?: string | null): AdminModule {
  if (rawModule === 'financeiro') {
    if (submodule === 'emprestimos') return 'emprestimos';
    if (['credito', 'credito_loja', 'credito-loja'].includes(String(submodule || ''))) return 'credito_loja';
  }
  return normalizeAdminModule(rawModule);
}

export function AdminPanel({
  onLogout,
  adminType,
  colaboradorId,
  colaboradorModulos,
}: AdminPanelProps) {
  const route = useAppLocation();
  const {
    pendencies,
    notifications,
    unreadNotifications,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications,
  } = useAdminNotifications();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [colaboradorNome, setColaboradorNome] = useState<string | null>(null);
  const [internalModules, setInternalModules] = useState<string[]>(
    normalizeGrantedAdminModules(colaboradorModulos || []),
  );

  const rawModule = route.module || 'dashboard';
  const activeTab = route.submodule;
  const activeItemId = route.itemId;
  const accessModule = accessModuleForRoute(rawModule, activeTab);
  const canAccessCurrentRoute = canAccessAdminModule(adminType, internalModules, accessModule);

  useEffect(() => {
    if (adminType !== 'colaborador' || !colaboradorId) {
      setColaboradorNome(null);
      setInternalModules(normalizeGrantedAdminModules(colaboradorModulos || []));
      return;
    }

    let cancelled = false;
    let validating = false;

    const refreshCollaborator = async () => {
      if (validating) return;
      validating = true;
      try {
        const context = await callAdminRpc<AdminContext>('gsa_admin_get_context_secure');
        if (cancelled) return;
        if (
          context.actor_type !== 'colaborador' ||
          context.actor_id !== colaboradorId
        ) {
          throw new Error('A identidade da sessão administrativa foi alterada.');
        }
        setColaboradorNome(context.actor_name || null);
        setInternalModules(normalizeGrantedAdminModules(context.modules || []));
      } catch (error: any) {
        if (cancelled) return;
        toast.error(error?.message || 'Seu acesso administrativo foi revogado.');
        await onLogout();
      } finally {
        validating = false;
      }
    };

    void refreshCollaborator();

    const channel = supabase
      .channel(`admin-permissions-${colaboradorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'colaboradores', filter: `id=eq.${colaboradorId}` },
        () => void refreshCollaborator(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'colaborador_modulos', filter: `colaborador_id=eq.${colaboradorId}` },
        () => void refreshCollaborator(),
      )
      .subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCollaborator();
    }, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshCollaborator();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [adminType, colaboradorId, colaboradorModulos, onLogout]);

  useEffect(() => {
    if (!canAccessCurrentRoute) {
      toast.error('Você não possui permissão para acessar este módulo.');
      navigate(adminModulePath('dashboard'));
    }
  }, [canAccessCurrentRoute, accessModule]);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [rawModule, activeTab, activeItemId]);

  const visibleGroups = useMemo(
    () => MENU_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessAdminModule(adminType, internalModules, item.id)),
      }))
      .filter((group) => group.items.length > 0),
    [adminType, internalModules],
  );

  const activeLabel = useMemo(() => {
    const item = MENU_GROUPS.flatMap((group) => group.items).find((entry) => entry.id === accessModule);
    return item?.label || 'Dashboard';
  }, [accessModule]);

  const badgeFor = (module: AdminModule) => {
    switch (module) {
      case 'cadastro': return pendencies.moduleCadastro;
      case 'operacoes': return pendencies.moduleVendas + pendencies.moduleDemandas;
      case 'loja':
      case 'classificados':
      case 'viagens': return pendencies.moduleVendas;
      case 'fidelidade':
      case 'promocoes': return pendencies.cadastro_vouchers_pendentes + pendencies.cadastro_premios_pendentes;
      case 'atendimento': return pendencies.moduleSuporte;
      case 'financeiro': return pendencies.moduleFinanceiro;
      case 'cobranca': return pendencies.moduleCobranca;
      case 'fiscal': return pendencies.moduleFiscal;
      case 'emprestimos': return pendencies.vendas_emprestimos_pendentes;
      case 'credito_loja': return pendencies.vendas_credito_pendentes;
      case 'acessos': return pendencies.moduleAcessos;
      default: return 0;
    }
  };

  const goTo = (module: string, tab?: string, itemId?: string) => {
    const normalized = normalizeAdminModule(module);
    if (!canAccessAdminModule(adminType, internalModules, normalized)) {
      toast.error('Você não possui permissão para acessar este módulo.');
      return;
    }
    navigate(adminModulePath(normalized, tab, itemId));
    setIsMobileMenuOpen(false);
  };

  if (!canAccessCurrentRoute) return null;

  const renderModule = () => {
    const commonNavigate = (module: string, tab?: string, itemId?: string) => goTo(module, tab, itemId);

    if (rawModule === 'dashboard') {
      return <Dashboard adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || undefined} colaboradorModulos={internalModules} onNavigate={commonNavigate} />;
    }
    if (rawModule === 'cadastros' || rawModule === 'cadastro') {
      return <CadastroModule title="Cadastros" allowedTabs={['clientes', 'prestadores']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    }
    if (rawModule === 'catalogo') {
      return <CadastroModule title="Catálogo" allowedTabs={['servicos', 'produtos', 'assinaturas', 'categorias_loja']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    }
    if (rawModule === 'operacoes' || rawModule === 'vendas') {
      return <VendasModule title="Operações" allowedTabs={['orcamentos', 'demandas', 'os', 'produtos', 'assinaturas']} initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />;
    }
    if (rawModule === 'loja') {
      return <CadastroModule title="Loja GSA Store" allowedTabs={['gsa_store', 'categorias_loja']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    }
    if (rawModule === 'fidelidade') {
      return <CadastroModule title="Fidelidade" allowedTabs={['indicacoes', 'vouchers', 'premios', 'promocoes']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    }
    if (rawModule === 'atendimento' || rawModule === 'tickets') {
      return <TicketsModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    }
    if (rawModule === 'financeiro') {
      const financeTab = accessModule === 'emprestimos' ? 'emprestimos' : accessModule === 'credito_loja' ? 'credito' : activeTab;
      return <FinanceiroModule initialTab={financeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />;
    }
    if (rawModule === 'cobranca') return <CobrancaModule initialTab={activeTab} initialItemId={activeItemId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />;
    if (rawModule === 'fiscal') return <FiscalModule initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    if (rawModule === 'relatorios') return <RelatoriosModule adminType={adminType} colaboradorModulos={internalModules} />;
    if (rawModule === 'configuracoes') return <ConfiguracoesModule />;
    if (rawModule === 'area_vip') return <AreaVIPModule initialItemId={activeItemId} colaboradorNome={colaboradorNome} />;
    if (rawModule === 'demandas') return <DemandasColaboradorModule colaboradorId={colaboradorId} adminType={adminType} initialItemId={activeItemId} initialTab={activeTab} colaboradorNome={colaboradorNome} />;
    if (rawModule === 'acessos') return <AcessosModule adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} />;
    if (rawModule === 'sistema') return <SystemMonitorModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    if (rawModule === 'promocoes') return <PromocaoQuantidadeModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} />;
    if (rawModule === 'classificados') return <ClassifiedsModule initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />;
    if (rawModule === 'viagens') return <TravelAdminModule />;
    if (rawModule === 'saude') return <ProtectionAdminModule domain="saude" initialTab={activeTab} initialItemId={activeItemId} />;
    if (rawModule === 'seguros') return <ProtectionAdminModule domain="seguros" initialTab={activeTab} initialItemId={activeItemId} />;
    return <Dashboard adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || undefined} colaboradorModulos={internalModules} onNavigate={commonNavigate} />;
  };

  const sidebarExpanded = isSidebarOpen || isMobileMenuOpen;

  return (
    <DashboardLayout
      theme="admin"
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      headerTitle={
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="hidden font-semibold text-neutral-300 sm:block">GSA</span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-neutral-300 sm:block" />
          <span className="font-bold text-neutral-800">{activeLabel}</span>
        </nav>
      }
      headerContent={
        <>
          <div className="mr-2 hidden items-center md:flex"><SystemStatusIndicator /></div>
          <LiveClock />
          <UniversalNotificationBell
            variant="admin"
            notifications={notifications}
            unreadCount={unreadNotifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDeleteAll={deleteAllNotifications}
            onNavigate={goTo}
          />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F0F0F] text-xs font-black tracking-tight text-white shadow-lg ring-1 ring-black/10">
            {adminType === 'admin' ? 'AD' : 'CO'}
          </div>
        </>
      }
      sidebarContent={
        <>
          <div className="flex h-[72px] shrink-0 items-center justify-between px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <AnimatePresence mode="wait">
              {sidebarExpanded ? (
                <motion.div key="open" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex min-w-0 items-center gap-3">
                  <LogoGSA size="sm" variant="light" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-black leading-none tracking-tight text-white">Grupo GSA</span>
                    <span className="mt-0.5 block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-white/30">Gestão de Serviços</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto"><LogoGSA size="sm" variant="light" /></motion.div>
              )}
            </AnimatePresence>
            <button type="button" onClick={() => isMobileMenuOpen ? setIsMobileMenuOpen(false) : setIsSidebarOpen(!isSidebarOpen)} className="ml-2 rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white/60">
              {sidebarExpanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          <nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-4">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {sidebarExpanded && <p className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-white/20">{group.label}</p>}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const badge = badgeFor(item.id);
                    const active = accessModule === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => goTo(item.id, item.defaultTab)}
                        title={!sidebarExpanded ? item.label : undefined}
                        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? 'bg-white text-neutral-900 shadow-lg shadow-black/20' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                      >
                        {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500" />}
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-indigo-600' : ''}`} />
                        {sidebarExpanded && <span className="flex-1 truncate text-left text-sm font-semibold">{item.label}</span>}
                        {badge > 0 && (sidebarExpanded
                          ? <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{badge > 99 ? '99+' : badge}</span>
                          : <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0F0F0F]" />)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="shrink-0 space-y-1 px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {sidebarExpanded && (
              <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">{adminType === 'admin' ? 'AD' : 'CO'}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{adminType === 'admin' ? 'Administrador' : colaboradorNome || 'Colaborador'}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">{adminType === 'admin' ? 'Acesso total' : 'Acesso por módulos'}</p>
                </div>
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="Online" />
              </div>
            )}
            <button type="button" onClick={() => void onLogout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-400">
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {sidebarExpanded && <span className="text-sm font-semibold">Sair com segurança</span>}
            </button>
          </div>
        </>
      }
    >
      <div className="p-3 lg:p-5">
        <div className="min-h-[calc(100vh-140px)] rounded-[2rem] bg-white p-3 shadow-sm ring-1 ring-neutral-100 lg:p-4">
          <ErrorBoundary>{renderModule()}</ErrorBoundary>
        </div>
      </div>
    </DashboardLayout>
  );
}
