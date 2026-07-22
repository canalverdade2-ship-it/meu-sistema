import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Gavel,
  Gift,
  Handshake,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  MessageSquare,
  Plane,
  Receipt,
  Server,
  Settings,
  ShieldAlert,
  Store,
  Tags,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAppLocation } from '../routing/useAppLocation';
import { navigate } from '../routing/navigationService';
import { DashboardLayout } from '../components/ui/DashboardLayout';
import { UniversalNotificationBell } from '../components/ui/UniversalNotificationBell';
import { LogoGSA } from '../components/ui/LogoGSA';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import { Dashboard } from '../components/admin/Dashboard';
import { CollaboratorDashboard } from '../components/admin/CollaboratorDashboard';
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
import { PartnersAdminModule } from '../components/admin/PartnersAdminModule';
import { AdvertisingAdminModule } from '../components/admin/AdvertisingAdminModule';
import { FornecedoresModule } from '../components/admin/FornecedoresModule';
import {
  adminPathFor,
  hasAdminModuleAccess,
  normalizeAdminModule,
  normalizeCollaboratorModules,
} from '../security/collaboratorAccess';

interface AdminPanelProps {
  onLogout: () => void;
  adminType: 'admin' | 'colaborador';
  colaboradorId?: string;
  colaboradorNomeInicial?: string;
  colaboradorModulos: string[];
}

type MenuItem = { id: string; label: string; icon: typeof LayoutDashboard };
type MenuGroup = { label: string; items: MenuItem[] };

const MENU_GROUPS: MenuGroup[] = [
  { label: 'Principal', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cadastro', label: 'Cadastros', icon: Users },
    { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
    { id: 'operacoes', label: 'Operações', icon: ClipboardList },
    { id: 'demandas', label: 'Minhas Demandas', icon: ClipboardList },
    { id: 'loja', label: 'Loja GSA Store', icon: Store },
    { id: 'classificados', label: 'Classificados GSA', icon: Tags },
    { id: 'anuncios', label: 'GSA Anúncios', icon: Megaphone },
    { id: 'viagens', label: 'Viagens GSA', icon: Plane },
    { id: 'saude', label: 'GSA Saúde', icon: HeartPulse },
    { id: 'seguros', label: 'GSA Seguros', icon: ShieldAlert },
  ]},
  { label: 'Financeiro', items: [
    { id: 'financeiro', label: 'Financeiro', icon: Landmark },
    { id: 'cobranca', label: 'Cobrança', icon: Gavel },
    { id: 'fiscal', label: 'Fiscal', icon: Receipt },
    { id: 'emprestimos', label: 'Empréstimos', icon: Landmark },
    { id: 'credito_loja', label: 'Crédito da Loja', icon: CreditCard },
  ]},
  { label: 'Relacionamento', items: [
    { id: 'parceiros', label: 'Parceiros', icon: Handshake },
    { id: 'fidelidade', label: 'Fidelidade', icon: Gift },
    { id: 'promocoes', label: 'Promoções por Quantidade', icon: Tags },
    { id: 'area_vip', label: 'Área VIP', icon: Gift },
    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
  ]},
  { label: 'Gestão', items: [
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ]},
  { label: 'Acesso', items: [{ id: 'acessos', label: 'Gerenciar Acessos', icon: ShieldAlert }] },
  { label: 'Infraestrutura', items: [{ id: 'sistema', label: 'Saúde do Sistema', icon: Server }] },
];

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="hidden md:flex h-9 px-3.5 items-center justify-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-black/5 text-sm font-bold text-neutral-700 tabular-nums"><Clock className="h-4 w-4 text-neutral-400" />{time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</div>;
}

export function AdminPanel({ onLogout, adminType, colaboradorId, colaboradorNomeInicial, colaboradorModulos }: AdminPanelProps) {
  const route = useAppLocation();
  const { pendencies, notifications, unreadNotifications, markAsRead, markAllAsRead, deleteAllNotifications } = useAdminNotifications();
  const activeModule = route.module || 'dashboard';
  const activeTab = route.submodule;
  const activeItemId = route.itemId;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [colaboradorNome, setColaboradorNome] = useState<string | null>(colaboradorNomeInicial || null);
  const [internalModulos, setInternalModulos] = useState(() => normalizeCollaboratorModules(colaboradorModulos));

  useEffect(() => setInternalModulos(normalizeCollaboratorModules(colaboradorModulos)), [colaboradorModulos]);
  useEffect(() => { if (colaboradorNomeInicial) setColaboradorNome(colaboradorNomeInicial); }, [colaboradorNomeInicial]);
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeModule, activeTab, activeItemId]);
  useEffect(() => {
    if (adminType !== 'colaborador' || !colaboradorId || colaboradorNomeInicial) return;
    supabase.from('colaboradores').select('nome').eq('id', colaboradorId).single().then(({ data }) => {
      if (data?.nome) setColaboradorNome(data.nome);
    });
  }, [adminType, colaboradorId, colaboradorNomeInicial]);

  const canAccess = (module: string, tab?: string) => hasAdminModuleAccess(module, adminType, internalModulos, tab);
  const go = (module: string, tab?: string, itemId?: string) => {
    const normalized = normalizeAdminModule(module);
    const providerOnly = normalized === 'cadastro' && !canAccess('cadastro') && canAccess('prestadores');
    const targetModule = providerOnly ? 'prestadores' : module;
    const targetNormalized = normalizeAdminModule(targetModule);
    if (!canAccess(targetNormalized, tab)) {
      toast.error('Você não possui permissão para acessar este módulo.');
      return;
    }
    navigate(adminPathFor(targetModule, tab, itemId));
    setIsMobileMenuOpen(false);
  };

  const visibleGroups = useMemo(() => MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.id === 'cadastro' ? canAccess('cadastro') || canAccess('prestadores') : canAccess(item.id)) })).filter((group) => group.items.length > 0), [adminType, internalModulos]);
  const allItems = MENU_GROUPS.flatMap((group) => group.items);
  const normalizedActive = normalizeAdminModule(activeModule);
  const activeLabel = allItems.find((item) => item.id === normalizedActive)?.label || 'Dashboard';
  const sidebarOpen = isMobileMenuOpen || (!isMobile && isSidebarOpen);

  const badge = (id: string) => {
    if (id === 'cadastro') return pendencies.moduleCadastro;
    if (id === 'operacoes' || id === 'loja') return pendencies.moduleVendas;
    if (id === 'demandas') return pendencies.moduleDemandas;
    if (id === 'financeiro') return pendencies.moduleFinanceiro;
    if (id === 'cobranca') return pendencies.moduleCobranca;
    if (id === 'fiscal') return pendencies.moduleFiscal;
    if (id === 'atendimento') return pendencies.moduleSuporte;
    if (id === 'acessos') return pendencies.moduleAcessos;
    return 0;
  };

  const commonNavigate = (module: string, tab?: string, itemId?: string) => go(module, tab, itemId);
  const cadastroTabs = adminType === 'admin' || internalModulos.includes('cadastro') ? ['clientes', 'prestadores'] : ['prestadores'];

  return (
    <DashboardLayout
      theme="admin"
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      headerTitle={<nav className="flex items-center gap-1.5 text-sm"><span className="hidden sm:block font-semibold text-neutral-300">GSA</span><ChevronRight className="hidden sm:block h-3.5 w-3.5 text-neutral-300" /><span className="font-bold text-neutral-800">{activeLabel}</span></nav>}
      headerContent={<><div className="hidden md:flex items-center mr-2"><SystemStatusIndicator /></div><LiveClock /><UniversalNotificationBell variant="admin" notifications={notifications} unreadCount={unreadNotifications} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onDeleteAll={deleteAllNotifications} onNavigate={commonNavigate} /><div className="h-10 w-10 rounded-xl bg-neutral-950 flex items-center justify-center shadow-lg"><span className="text-xs font-black text-white">{adminType === 'admin' ? 'AD' : 'CO'}</span></div></>}
      sidebarContent={<>
        <div className="flex h-[72px] items-center justify-between px-4 shrink-0 border-b border-white/5"><AnimatePresence mode="wait">{sidebarOpen ? <motion.div key="open" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex items-center gap-3 min-w-0"><LogoGSA size="sm" variant="light" /><div className="min-w-0"><span className="block truncate text-sm font-black text-white">Grupo GSA</span><span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">Gestão de Serviços</span></div></motion.div> : <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto"><LogoGSA size="sm" variant="light" /></motion.div>}</AnimatePresence>{!isMobile ? <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/60">{isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button> : <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-1.5 text-white/30"><X className="h-4 w-4" /></button>}</div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">{visibleGroups.map((group) => <div key={group.label}>{sidebarOpen && <p className="px-3 mb-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/20">{group.label}</p>}<div className="space-y-0.5">{group.items.map((item) => { const count = badge(item.id); const isActive = normalizedActive === item.id; const Icon = item.icon; return <button key={item.id} onClick={() => go(item.id)} title={!sidebarOpen ? item.label : undefined} className={`relative group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? 'bg-white text-neutral-900 shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>{isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-indigo-500" />}<Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-indigo-600' : ''}`} />{sidebarOpen && <span className="flex-1 truncate text-left text-sm font-semibold">{item.label}</span>}{count > 0 && (sidebarOpen ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{count > 99 ? '99+' : count}</span> : <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />)}</button>; })}</div></div>)}</nav>
        <div className="shrink-0 px-3 py-4 border-t border-white/5">{sidebarOpen && <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">{adminType === 'admin' ? 'AD' : 'CO'}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{adminType === 'admin' ? 'Administrador' : colaboradorNome || 'Colaborador'}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{adminType === 'admin' ? 'Acesso total' : 'Acesso restrito'}</p></div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div>}<button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/30 hover:bg-red-500/10 hover:text-red-400"><LogOut className="h-[18px] w-[18px]" />{sidebarOpen && <span className="text-sm font-semibold">Sair com Segurança</span>}</button></div>
      </>}
    >
      <div className="p-3 lg:p-5"><div className="min-h-[calc(100vh-140px)] rounded-[2rem] bg-white p-3 lg:p-4 shadow-sm ring-1 ring-neutral-100">
        {normalizedActive === 'dashboard' && (adminType === 'colaborador' ? <CollaboratorDashboard colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || undefined} colaboradorModulos={internalModulos} onNavigate={commonNavigate} /> : <Dashboard adminType="admin" colaboradorNome="Administrador" colaboradorModulos={internalModulos} onNavigate={commonNavigate} />)}
        {normalizedActive === 'cadastro' && <ErrorBoundary><CadastroModule title="Cadastros" allowedTabs={cadastroTabs as any} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
        {normalizedActive === 'fornecedores' && <ErrorBoundary><FornecedoresModule initialTab={activeTab} /></ErrorBoundary>}
        {normalizedActive === 'parceiros' && <ErrorBoundary><PartnersAdminModule /></ErrorBoundary>}
        {normalizedActive === 'operacoes' && <ErrorBoundary><VendasModule title="Operações" allowedTabs={['orcamentos', 'demandas', 'os', 'produtos', 'assinaturas']} initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}
        {normalizedActive === 'demandas' && <DemandasColaboradorModule colaboradorId={colaboradorId} adminType={adminType} initialItemId={activeItemId} initialTab={activeTab} colaboradorNome={colaboradorNome} />}
        {normalizedActive === 'loja' && <ErrorBoundary><CadastroModule title="Loja GSA Store" allowedTabs={['produtos', 'servicos', 'pacotes', 'assinaturas', 'categorias_loja', 'gsa_store']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
        {normalizedActive === 'fidelidade' && <ErrorBoundary><CadastroModule title="Fidelidade" allowedTabs={['indicacoes', 'vouchers', 'premios', 'promocoes']} initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
        {normalizedActive === 'atendimento' && <TicketsModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
        {normalizedActive === 'financeiro' && <FinanceiroModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />}
        {normalizedActive === 'emprestimos' && <ErrorBoundary><VendasModule title="Empréstimos" allowedTabs={['emprestimos']} initialTab={activeTab || 'emprestimos'} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}
        {normalizedActive === 'credito_loja' && <ErrorBoundary><VendasModule title="Crédito da Loja" allowedTabs={['credito']} initialTab={activeTab || 'credito'} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}
        {activeModule === 'cobranca' && <ErrorBoundary><CobrancaModule initialTab={activeTab} initialItemId={activeItemId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}
        {activeModule === 'fiscal' && <FiscalModule initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
        {normalizedActive === 'relatorios' && <RelatoriosModule adminType={adminType} colaboradorModulos={internalModulos} />}
        {normalizedActive === 'configuracoes' && <ConfiguracoesModule />}
        {normalizedActive === 'area_vip' && <AreaVIPModule initialItemId={activeItemId} colaboradorNome={colaboradorNome} />}
        {normalizedActive === 'acessos' && <AcessosModule adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} />}
        {normalizedActive === 'sistema' && <SystemMonitorModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} />}
        {normalizedActive === 'promocoes' && <ErrorBoundary><PromocaoQuantidadeModule colaboradorId={colaboradorId} colaboradorNome={colaboradorNome || 'Administrador'} /></ErrorBoundary>}
        {normalizedActive === 'classificados' && <ErrorBoundary><ClassifiedsModule initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}
        {normalizedActive === 'anuncios' && <ErrorBoundary><AdvertisingAdminModule /></ErrorBoundary>}
        {normalizedActive === 'viagens' && <ErrorBoundary><TravelAdminModule /></ErrorBoundary>}
        {normalizedActive === 'saude' && <ErrorBoundary><ProtectionAdminModule domain="saude" initialTab={activeTab} initialItemId={activeItemId} /></ErrorBoundary>}
        {normalizedActive === 'seguros' && <ErrorBoundary><ProtectionAdminModule domain="seguros" initialTab={activeTab} initialItemId={activeItemId} /></ErrorBoundary>}
      </div></div>
    </DashboardLayout>
  );
}
