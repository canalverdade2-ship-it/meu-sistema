import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  User, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  History, 
  FileText, 
  LifeBuoy, 
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Lock,
  Ticket,
  Gift,
  Tag,
  Edit2,
  TrendingUp,
  CheckCircle2,
  Star,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { PrestadorDemandas } from '../../components/prestador/PrestadorDemandas';
import { PrestadorFinanceiro } from '../../components/prestador/PrestadorFinanceiro';
import { PrestadorAgenda } from '../../components/prestador/PrestadorAgenda';
import { UniversalNotificationBell } from '../../components/ui/UniversalNotificationBell';
import { PrestadorDocumentos } from '../../components/prestador/PrestadorDocumentos';
import { PrestadorVouchers } from '../../components/prestador/PrestadorVouchers';
import { PrestadorPremios } from '../../components/prestador/PrestadorPremios';
import { PrestadorPromocoes } from '../../components/prestador/PrestadorPromocoes';
import { PrestadorSuporte } from '../../components/prestador/PrestadorSuporte';
import { Modal } from '../../components/ui/Modal';
import { useProviderNotifications } from '../../hooks/useProviderNotifications';
import { createNotification } from '../../lib/notifications';
import { logService } from '../../lib/logService';
import { maskCEP } from '../../lib/utils';

// Roteamento
import { useAppLocation } from '../../routing/useAppLocation';
import { navigate } from '../../routing/navigationService';
import { routes } from '../../routing/routeCatalog';

interface PrestadorDashboardProps {
  prestadorId: string;
  onLogout: () => void;
}

export function PrestadorDashboard({ prestadorId, onLogout }: PrestadorDashboardProps) {
  const route = useAppLocation();
  const { 
    pendencies, 
    notifications, 
    unreadNotifications, 
    prestador,
    loading: providerLoading,
    markAsRead, 
    markAllAsRead, 
    refreshCounts 
  } = useProviderNotifications();
  
  // Deriva o activeTab a partir da rota de forma reativa
  const activeTab = route.module || 'dashboard';
  const activeItemId = route.itemId;
  const [moduleKey, setModuleKey] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sincroniza scroll ao topo sempre que muda de aba ou item
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab, activeItemId]);
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState(0);
  const [metrics, setMetrics] = useState({ totalGanho: 0, demandasConcluidas: 0, agendamentos: 0, documentosAprovados: 0 });



  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [perfilForm, setPerfilForm] = useState({
    telefone: '',
    cep: '',
    numero: '',
    area_servico: ''
  });

  // Profile Change Request (Locked fields)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [editingRequestField, setEditingRequestField] = useState<{ label: string, value: string } | null>(null);
  const [requestNewValue, setRequestNewValue] = useState('');
  const [requestMotivo, setRequestMotivo] = useState('');

  // Support Ticket for Blocked Users
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);

  const handleOpenSupportTicket = async () => {
    if (!prestador || isOpeningTicket) return;
    setIsOpeningTicket(true);
    
    try {
      const assunto = 'Análise de Cadastro pendente';
      const descricao = `Olá, gostaria de verificar o andamento da análise do meu cadastro.\n\nPrestador: ${prestador.nome_razao}\nDocumento: ${prestador.documento}\nE-mail: ${prestador.email || 'Não informado'}\nTelefone: ${prestador.telefone || 'Não informado'}`;
      
      const { data: existingTicket, error: checkError } = await supabase
        .from('tickets')
        .select('id')
        .eq('prestador_id', prestadorId)
        .eq('assunto', assunto)
        .neq('status', 'concluido')
        .limit(1);

      if (checkError) console.error('Erro ao verificar tickets existentes:', checkError);

      if (existingTicket && existingTicket.length > 0) {
        toast.error('Já existe um ticket de análise aberto para você. Você será redirecionado para o Suporte.');
        navigate(routes.provider.support());
        return;
      }

      const { data: newTicket, error } = await supabase.from('tickets').insert([{
        prestador_id: prestadorId,
        assunto,
        descricao,
        status: 'aberto'
      }]).select('id').single();

      if (error) throw error;

      // Request was sent successfully to Supabase. Now we notify the ADM module
      await createNotification(
        null,
        'Novo Ticket (Análise Cadastral)',
        `O prestador ${prestador.nome_razao || prestadorId} abriu um ticket sobre a aprovação do seu cadastro.`,
        'suporte',
        undefined,
        newTicket?.id
      ).catch(e => console.error('Error dispatching admin notification:', e));

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestador.nome_razao,
        acao: 'ABRIR_TICKET',
        detalhes: `Abriu um ticket de suporte: ${assunto}`
      });

      toast.success('Seu contato foi enviado! Acompanhe o status e responda no chat de Suporte.');
      navigate(routes.provider.support());
    } catch (err) {
      console.error('Erro ao abrir ticket de suporte:', err);
      toast.error('Erro ao abrir ticket de suporte. A nossa equipe já foi notificada na criação do seu cadastro.');
    } finally {
      setIsOpeningTicket(false);
    }
  };

  const handleEditRequest = (label: string, value: string) => {
    setEditingRequestField({ label, value });
    setRequestNewValue('');
    setRequestMotivo('');
    setIsRequestModalOpen(true);
  };

  const handleConfirmRequest = async () => {
    if (!editingRequestField || !requestNewValue || !requestMotivo) return;
    
    try {
      const assunto = `Solicitação de alteração: ${editingRequestField.label}`;

      // Verificação de ticket duplicado
      const { data: existingTickets, error: checkError } = await supabase
        .from('tickets')
        .select('id')
        .eq('prestador_id', prestadorId)
        .eq('assunto', assunto)
        .neq('status', 'concluido')
        .limit(1);

      if (checkError) throw checkError;

      if (existingTickets && existingTickets.length > 0) {
        toast.error('Identificamos uma solicitação anterior ainda em análise para este campo. Por favor, aguarde o retorno na aba de Suporte.');
        setIsRequestModalOpen(false);
        return;
      }

      const { error } = await supabase.from('tickets').insert([{
        prestador_id: prestadorId,
        assunto,
        descricao: `Solicitação de alteração do campo "${editingRequestField.label}".\n\nValor atual: ${editingRequestField.value}\nNovo valor solicitado: ${requestNewValue}\nMotivo: ${requestMotivo}\n\nPrazo de retorno: até 48 horas.`,
        status: 'aberto'
      }]);

      if (error) throw error;
      
      toast.success('Solicitação enviada com sucesso! Um ticket foi aberto.');
      setIsRequestModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar sua solicitação no momento. Caso o problema persista, contate o suporte administrativo.');
    }
  };

  useEffect(() => {
    if (!prestadorId) return;
    
    // fetchPrestador agora é gerenciado pelo hook useProviderNotifications
    fetchSaldo();
    fetchMetrics();

    const channel = supabase
      .channel('prestador-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_transacoes', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchSaldo();
        fetchMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_saques', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchSaldo();
        fetchMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_documentos', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestadorId]);



  const fetchSaldo = async () => {
    try {
      const { data, error } = await supabase
        .from('prestador_transacoes')
        .select('valor, tipo, status')
        .eq('prestador_id', prestadorId)
        .eq('status', 'concluido');
      
      if (!error && data) {
        const totalCreditos = data.filter(t => t.tipo === 'credito').reduce((acc, t) => acc + Number(t.valor), 0);
        const totalDebitos = data.filter(t => t.tipo === 'debito').reduce((acc, t) => acc + Number(t.valor), 0);
        setSaldo(totalCreditos - totalDebitos);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const [demandasRes, agendamentosRes, documentosRes] = await Promise.all([
        supabase.from('prestador_demandas').select('id, status, valor_final').eq('prestador_id', prestadorId),
        supabase.from('prestador_agendamentos').select('id, status').eq('prestador_id', prestadorId),
        supabase.from('prestador_documentos').select('id, status').eq('prestador_id', prestadorId)
      ]);

      const demandas = demandasRes.data || [];
      const concluidas = demandas.filter(d => ['concluida', 'finalizada', 'concluida_interna'].includes(d.status));
      const totalGanho = concluidas.reduce((acc, d) => acc + Number(d.valor_final || 0), 0);

      setMetrics({
        totalGanho,
        demandasConcluidas: concluidas.length,
        agendamentos: (agendamentosRes.data || []).filter(a => a.status === 'concluido').length,
        documentosAprovados: (documentosRes.data || []).filter(d => d.status === 'aprovado').length
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    }
  };

  useEffect(() => {
    if (prestador) {
      setPerfilForm({
        telefone: prestador.telefone || '',
        cep: prestador.cep || '',
        numero: prestador.numero || '',
        area_servico: prestador.area_servico || ''
      });
      setLoading(false);
    }
  }, [prestador]);

  const isBlocked = prestador?.status === 'pendente' || prestador?.status === 'em_analise' || prestador?.status === 'suspenso' || prestador?.status === 'desligado' || prestador?.status === 'reprovado';
  const isPending = prestador?.status === 'pendente' || prestador?.status === 'em_analise';

  const menuItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, count: 0, locked: false },
    { id: 'trabalho', label: 'Demandas', icon: Briefcase, count: pendencies.moduleDemandas + pendencies.moduleAgenda, locked: isBlocked },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, count: pendencies.moduleFinanceiro, locked: isBlocked },
    { id: 'beneficios', label: 'Beneficios', icon: Gift, count: pendencies.moduleVouchers + pendencies.modulePremios + pendencies.modulePromocoes, locked: isBlocked },
    { id: 'conta', label: 'Minha Conta', icon: User, count: pendencies.moduleDocumentos, locked: false },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy, count: pendencies.moduleSuporte, locked: false },
  ];

  const subModuleItems = [
    { id: 'demandas', label: 'Demandas', icon: Briefcase, count: pendencies.moduleDemandas, locked: isBlocked, parent: 'trabalho' },
    { id: 'agenda', label: 'Agenda', icon: Calendar, count: pendencies.moduleAgenda, locked: isBlocked, parent: 'trabalho' },
    { id: 'vouchers', label: 'Vouchers', icon: Ticket, count: pendencies.moduleVouchers, locked: isBlocked, parent: 'beneficios' },
    { id: 'premios', label: 'Premios', icon: Gift, count: pendencies.modulePremios, locked: isBlocked, parent: 'beneficios' },
    { id: 'promocoes', label: 'Promocoes', icon: Tag, count: pendencies.modulePromocoes, locked: isBlocked, parent: 'beneficios' },
    { id: 'perfil', label: 'Perfil', icon: User, count: 0, locked: false, parent: 'conta' },
    { id: 'documentos', label: 'Documentos', icon: FileText, count: pendencies.moduleDocumentos, locked: false, parent: 'conta' },
  ];

  const allNavigationItems = [...menuItems, ...subModuleItems];

  const parentByTab: Record<string, string> = subModuleItems.reduce((acc, item) => {
    acc[item.id] = item.parent;
    return acc;
  }, {} as Record<string, string>);

  const handleTabChange = (tabId: string, locked: boolean) => {
    if (locked) {
      toast.error('Módulo bloqueado. Seu cadastro está em análise.');
      return;
    }
    
    let path = routes.provider.dashboard();
    if (tabId === 'dashboard') path = routes.provider.dashboard();
    else if (tabId === 'demandas' || tabId === 'trabalho') path = routes.provider.demands();
    else if (tabId === 'agenda') path = routes.provider.agenda();
    else if (tabId === 'financeiro') path = routes.provider.financeiro();
    else if (tabId === 'documentos' || tabId === 'documents') path = routes.provider.documents();
    else if (tabId === 'vouchers' || tabId === 'premios' || tabId === 'promocoes') path = routes.provider.vouchers();
    else if (tabId === 'suporte' || tabId === 'support') path = routes.provider.support();
    
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleModuleClick = (item: any) => {
    if (!item) return;
    handleTabChange(item.id, item.locked);
  };

  const handleBack = () => {
    const parent = parentByTab[activeTab];
    let path = routes.provider.dashboard();
    if (parent === 'trabalho') path = routes.provider.demands();
    else if (parent === 'beneficios') path = routes.provider.vouchers();
    else if (parent === 'conta') path = routes.provider.dashboard();
    navigate(path);
  };

  const renderModuleHub = (
    title: string,
    subtitle: string,
    items: typeof subModuleItems,
    AccentIcon: any
  ) => (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-[#1a1a1a] p-6 text-white shadow-xl shadow-black/10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <AccentIcon className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Portal do Prestador</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <motion.button
            key={item.id}
            whileHover="hover"
            variants={{ hover: { scale: 1.02, y: -3 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleModuleClick(item)}
            className={`group relative flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-white p-4 text-center shadow-sm ring-1 ring-black/5 transition-all ${
              item.locked ? 'cursor-not-allowed opacity-60 grayscale' : 'hover:shadow-md hover:ring-black/10'
            }`}
          >
            {item.count > 0 && (
              <span className="absolute right-4 top-4 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-black text-white shadow-sm">
                {item.count}
              </span>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 transition-all group-hover:bg-[#1a1a1a]">
              <item.icon className="h-7 w-7 text-indigo-600 transition-colors group-hover:text-white" />
            </div>
            <span className="max-w-full whitespace-normal break-words text-base font-black leading-tight text-[#1a1a1a]">
              {item.label}
            </span>
            {item.locked && <Lock className="absolute bottom-4 right-4 h-4 w-4 text-neutral-400" />}
          </motion.button>
        ))}
      </div>
    </div>
  );



  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('prestadores')
        .update({
          telefone: perfilForm.telefone,
          cep: perfilForm.cep,
          numero: perfilForm.numero,
          area_servico: perfilForm.area_servico
        })
        .eq('id', prestadorId);

      if (error) throw error;
      
      toast.success('Perfil atualizado com sucesso!');
      setIsEditingProfile(false);
      
      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestador.nome_razao,
        acao: 'EDITAR_PERFIL',
        detalhes: `Atualizou informações de contato/endereço: Telefone: ${perfilForm.telefone}, CEP: ${perfilForm.cep}, Número: ${perfilForm.numero}`
      });

      refreshCounts?.(); // Isso atualizará as pendências e o prestador se eu ajustar o hook
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      toast.error('Erro ao atualizar perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f8f7f5]">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#1a1a1a]/60 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

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
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-black/5 bg-[#fdfcfb] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-24 items-center justify-between px-8">
          <span className="text-xl tracking-tight text-[#1a1a1a]">Grupo GSA</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-full p-2 hover:bg-black/5 transition-colors lg:hidden">
            <X className="h-5 w-5 text-[#1a1a1a]/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-10 flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1a1a] text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 overflow-visible">
              <p 
                className="font-bold text-[#1a1a1a] whitespace-nowrap tracking-tight"
                style={{ 
                  fontSize: (prestador?.nome_razao?.length || 0) > 24 ? '9px' : 
                            (prestador?.nome_razao?.length || 0) > 20 ? '10px' : 
                            (prestador?.nome_razao?.length || 0) > 16 ? '12px' : '14px' 
                }}
              >
                {prestador?.nome_razao}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs font-medium tracking-widest text-[#1a1a1a]/40 uppercase">Prestador</p>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                  prestador?.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                  prestador?.status === 'pendente' || prestador?.status === 'em_analise' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {prestador?.status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || parentByTab[activeTab] === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id, item.locked)}
                  className={`group flex w-full items-center justify-between rounded-full px-5 py-3.5 text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-[#1a1a1a] text-white shadow-md' 
                      : item.locked 
                        ? 'text-[#1a1a1a]/40 cursor-not-allowed'
                        : 'text-[#1a1a1a]/60 hover:bg-black/5 hover:text-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${
                      isActive 
                        ? 'text-white' 
                        : item.locked 
                          ? 'text-neutral-400'
                          : item.id === 'demandas' ? 'text-blue-600' :
                            item.id === 'agenda' ? 'text-indigo-600' :
                            item.id === 'financeiro' ? 'text-emerald-600' :
                            item.id === 'historico' ? 'text-purple-600' :
                            item.id === 'documentos' ? 'text-orange-600' :
                            item.id === 'vouchers' ? 'text-pink-600' :
                            item.id === 'premios' ? 'text-rose-600' :
                            item.id === 'promocoes' ? 'text-fuchsia-600' :
                            item.id === 'suporte' ? 'text-sky-600' :
                            'text-[#1a1a1a]/40 group-hover:text-[#1a1a1a]/60'
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.locked ? (
                      <Lock className="h-4 w-4 opacity-50" />
                    ) : (
                      <>
                        {item.count > 0 && (
                          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${isActive ? 'bg-white text-[#1a1a1a]' : 'bg-[#1a1a1a] text-white'}`}>
                            {item.count}
                          </span>
                        )}
                        {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          <button 
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-full px-5 py-3.5 text-sm font-medium text-red-600/80 transition-all hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sair do Portal
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
              {allNavigationItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <UniversalNotificationBell 
              variant="provider"
              notifications={notifications}
              unreadCount={unreadNotifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNavigate={(modulo, tab, itemId) => {
                let path = routes.provider.dashboard();
                const modStr = modulo as string;
                if (modStr === 'demandas' || modStr === 'trabalho') path = routes.provider.demands();
                else if (modStr === 'agenda') path = routes.provider.agenda();
                else if (modStr === 'financeiro') path = routes.provider.financeiro();
                else if (modStr === 'documentos') path = routes.provider.documents();
                else if (modStr === 'vouchers' || modStr === 'premios' || modStr === 'promocoes') path = routes.provider.vouchers();
                else if (modStr === 'suporte' || modStr === 'support') path = routes.provider.support();
                
                navigate(path);
              }}
            />
          </div>
        </header>

        <div className="p-6 lg:p-12">
          {activeTab !== 'dashboard' && (
            <button 
              onClick={handleBack}
              className="mb-6 flex items-center gap-2 px-4 h-10 rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-black/5 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
              <span className="text-sm font-medium text-[#1a1a1a]">Voltar</span>
            </button>
          )}

          {isPending && activeTab !== 'suporte' && (
            <div className="mb-8 rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 flex items-start gap-4 animate-pulse-subtle">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Cadastro em Análise</h3>
                <p className="mt-1 text-sm text-red-800 leading-relaxed">
                  Seu pré-cadastro está sendo avaliado por nossa equipe. Para dúvidas ou mais informações, entre em contato utilizando o botão de suporte abaixo.
                </p>
                <button
                  onClick={handleOpenSupportTicket}
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
            key={`${activeTab}-${moduleKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={activeTab === 'dashboard' ? '' : 'card-refined'}
          >
            {activeTab === 'dashboard' && (
              <div className="relative">
                  <motion.div
                    key="dashboard-content"
                    animate={{ 
                      opacity: 1,
                      filter: 'blur(0px)',
                      scale: 1
                    }}
                    transition={{ duration: 0.8 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-3xl tracking-tight text-[#1a1a1a]">
                        Olá, {prestador?.nome_razao?.split(' ')[0] || 'Prestador'}!
                      </h2>
                      <p className="mt-2 text-[#1a1a1a]/60">
                        Bem-vindo ao seu portal do prestador. O que você gostaria de acessar hoje?
                      </p>
                    </div>

                    {/* Quick Stats Cards */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <motion.div
                        whileHover="hover"
                        variants={{ hover: { scale: 1.02, y: -2 } }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleModuleClick(menuItems.find(i => i.id === 'financeiro'))}
                        className={`rounded-3xl bg-[#1a1a1a] ring-1 ring-white/10 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden group h-[5.75rem] cursor-pointer ${isBlocked ? 'opacity-90' : 'hover:shadow-xl'}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none transition-opacity group-hover:opacity-70"></div>
                        
                        <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-2.5 py-2 ${isBlocked ? 'scale-90 opacity-70' : ''}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <motion.div
                              initial={{ scale: 0, rotate: -30 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                              variants={{ hover: { rotate: [0, -15, 15, -15, 15, 0], transition: { duration: 0.4 } } }}
                            >
                              <DollarSign className="h-4 w-4 shrink-0 text-emerald-400" />
                            </motion.div>
                            <span className="text-[14px] font-black uppercase leading-none text-white/90">A receber</span>
                          </div>
                          <div className="mt-1.5 w-full min-w-0">
                            <p className="w-full truncate text-[22px] font-black leading-none text-white sm:text-3xl">
                              <span className="mr-1 text-sm opacity-70 sm:text-xl">R$</span>
                              {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        {isBlocked && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
                            <Lock className="h-12 w-12 text-red-600" />
                          </div>
                        )}
                      </motion.div>

                      <motion.div
                        whileHover="hover"
                        variants={{ hover: { scale: 1.02, y: -2 } }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleModuleClick(allNavigationItems.find(i => i.id === 'demandas'))}
                        className={`rounded-3xl bg-indigo-600 ring-1 ring-indigo-500 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden group h-[5.75rem] cursor-pointer ${isBlocked ? 'opacity-90' : 'hover:shadow-xl'}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none transition-opacity group-hover:opacity-70"></div>
                        
                        <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-2.5 py-2 ${isBlocked ? 'scale-90 opacity-80' : ''}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <motion.div
                              initial={{ scale: 0, rotate: -30 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
                              variants={{ hover: { rotate: [0, -15, 15, -15, 15, 0], transition: { duration: 0.4 } } }}
                            >
                              <Briefcase className="h-4 w-4 shrink-0 text-amber-300" />
                            </motion.div>
                            <span className="text-[14px] font-black uppercase leading-none text-indigo-50">Demandas</span>
                          </div>
                          <div className="mt-1.5 w-full min-w-0">
                            <p className="w-full truncate text-[22px] font-black leading-none text-white sm:text-3xl">
                              {pendencies.moduleDemandas} {pendencies.moduleDemandas === 1 ? 'ativa' : 'ativas'}
                            </p>
                          </div>
                        </div>
                        {isBlocked && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
                            <Lock className="h-12 w-12 text-red-600" />
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Module Grid */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {menuItems.filter(item => item.id !== 'dashboard').map((item) => (
                        <motion.button
                          key={item.id}
                          layout
                          whileHover="hover"
                          variants={{ hover: { scale: 1.02, y: -5 } }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleModuleClick(item)}
                          className={`group relative flex min-h-[7.5rem] flex-col items-start justify-between overflow-hidden rounded-3xl bg-white p-4 sm:p-6 text-left shadow-sm ring-1 ring-black/5 transition-all ${
                            item.locked 
                              ? 'opacity-60 grayscale-[0.5] cursor-not-allowed' 
                              : 'hover:shadow-md hover:ring-black/10'
                          }`}
                        >
                          <div className="flex w-full items-start justify-between">
                            <motion.div 
                              initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                              animate={{ scale: 1, rotate: 0, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                              variants={{
                                hover: { 
                                  rotate: [0, -10, 10, -10, 10, 0],
                                  scale: [1, 1.1, 1.1, 1],
                                  transition: { duration: 0.5 }
                                }
                              }}
                              className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-colors ${
                              item.locked 
                                ? 'bg-neutral-100 text-neutral-400' 
                                : 'bg-[#f8f7f5] group-hover:bg-[#1a1a1a]'
                            }`}>
                              <item.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                                item.locked 
                                  ? 'text-neutral-400' 
                                  : item.id === 'demandas' ? 'text-blue-600 group-hover:text-white' :
                                    item.id === 'agenda' ? 'text-indigo-600 group-hover:text-white' :
                                    item.id === 'financeiro' ? 'text-emerald-600 group-hover:text-white' :
                                    item.id === 'historico' ? 'text-purple-600 group-hover:text-white' :
                                    item.id === 'documentos' ? 'text-orange-600 group-hover:text-white' :
                                    item.id === 'vouchers' ? 'text-pink-600 group-hover:text-white' :
                                    item.id === 'premios' ? 'text-rose-600 group-hover:text-white' :
                                    item.id === 'promocoes' ? 'text-fuchsia-600 group-hover:text-white' :
                                    item.id === 'suporte' ? 'text-sky-600 group-hover:text-white' :
                                    'text-[#1a1a1a] group-hover:text-white'
                              }`} />
                            </motion.div>
                            
                            {item.locked ? (
                              <Lock className="h-4 w-4 text-neutral-400" />
                            ) : item.count > 0 && (
                              <span className="flex h-5 min-w-[20px] sm:h-6 sm:min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 sm:px-2 text-[10px] sm:text-xs font-bold text-white shadow-sm">
                                {item.count}
                              </span>
                            )}
                          </div>

                          <div className="mt-6 sm:mt-8 flex w-full items-center justify-between">
                            <span className={`max-w-[calc(100%-2rem)] whitespace-normal break-words text-sm font-bold leading-tight sm:text-base ${item.locked ? 'text-neutral-400' : 'text-[#1a1a1a]'}`}>{item.label}</span>
                            {!item.locked && (
                              <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#f8f7f5] text-[#1a1a1a]/40 transition-colors group-hover:bg-[#1a1a1a] group-hover:text-white shrink-0 ml-2">
                                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                              </div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>

                  </motion.div>
              </div>
            )}

            {activeTab === 'trabalho' && renderModuleHub(
              'Demandas',
              'Acompanhe demandas, agenda e entregas do dia a dia.',
              subModuleItems.filter(item => item.parent === 'trabalho'),
              Briefcase
            )}

            {activeTab === 'beneficios' && renderModuleHub(
              'Beneficios',
              'Acesse campanhas, vouchers e premios do prestador.',
              subModuleItems.filter(item => item.parent === 'beneficios'),
              Gift
            )}

            {activeTab === 'conta' && renderModuleHub(
              'Minha Conta',
              'Gerencie perfil, documentos e informacoes cadastrais.',
              subModuleItems.filter(item => item.parent === 'conta'),
              User
            )}

            {activeTab === 'perfil' && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                  <div className="flex justify-between items-start mb-6 border-b border-neutral-100 pb-4">
                    <h3 className="text-lg font-medium text-neutral-900">Suas Informações</h3>
                    {!isEditingProfile && (
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 transition-colors"
                      >
                        Editar Informações
                      </button>
                    )}
                  </div>
                  
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="space-y-6">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Static fields with Edit via Ticket */}
                        <div className="opacity-75 relative group">
                          <label className="block text-sm font-medium text-[#1a1a1a]/60 flex items-center gap-2">
                            Nome / Razão Social <Lock className="h-3 w-3" />
                          </label>
                          <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.nome_razao}</p>
                          <button 
                            type="button"
                            onClick={() => handleEditRequest('Nome / Razão Social', prestador?.nome_razao)}
                            className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                            title="Solicitar alteração (Via Ticket)"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="opacity-75 relative group">
                          <label className="block text-sm font-medium text-[#1a1a1a]/60 flex items-center gap-2">
                            Documento <Lock className="h-3 w-3" />
                          </label>
                          <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.documento}</p>
                          <button 
                            type="button"
                            onClick={() => handleEditRequest('Documento', prestador?.documento)}
                            className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="opacity-75 relative group">
                          <label className="block text-sm font-medium text-[#1a1a1a]/60 flex items-center gap-2">
                            E-mail <Lock className="h-3 w-3" />
                          </label>
                          <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.email}</p>
                          <button 
                            type="button"
                            onClick={() => handleEditRequest('E-mail', prestador?.email)}
                            className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Editable fields */}
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Telefone / WhatsApp</label>
                          <input
                            type="text"
                            required
                            value={perfilForm.telefone}
                            onChange={(e) => setPerfilForm({...perfilForm, telefone: e.target.value})}
                            className="w-full rounded-xl border-neutral-300 text-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] p-2.5 border"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">CEP (Opcional)</label>
                          <input
                            type="text"
                            value={perfilForm.cep}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '');
                              if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                              setPerfilForm({...perfilForm, cep: v});
                            }}
                            maxLength={9}
                            className="w-full rounded-xl border-neutral-300 text-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] p-2.5 border"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Número</label>
                          <input
                            type="text"
                            value={perfilForm.numero}
                            onChange={(e) => setPerfilForm({...perfilForm, numero: e.target.value})}
                            className="w-full rounded-xl border-neutral-300 text-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] p-2.5 border"
                            placeholder="Nº"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Área de Serviço / Especialidade</label>
                          <input
                            type="text"
                            value={perfilForm.area_servico}
                            onChange={(e) => setPerfilForm({...perfilForm, area_servico: e.target.value})}
                            className="w-full rounded-xl border-neutral-300 text-sm focus:border-[#1a1a1a] focus:ring-[#1a1a1a] p-2.5 border"
                            placeholder="Ex: Eletricista, Limpeza Pós-Obra..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProfile(false);
                            // Reset form to current db values
                            setPerfilForm({
                              telefone: prestador?.telefone || '',
                              cep: prestador?.cep || '',
                              numero: prestador?.numero || '',
                              area_servico: prestador?.area_servico || ''
                            });
                          }}
                          className="rounded-xl px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="rounded-xl bg-[#1a1a1a] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
                        >
                          {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="relative group">
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">Nome / Razão Social</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.nome_razao}</p>
                        <button 
                          onClick={() => handleEditRequest('Nome / Razão Social', prestador?.nome_razao)}
                          className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative group">
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">Documento</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.documento}</p>
                        <button 
                          onClick={() => handleEditRequest('Documento', prestador?.documento)}
                          className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative group">
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">E-mail</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.email}</p>
                        <button 
                          onClick={() => handleEditRequest('E-mail', prestador?.email)}
                          className="absolute top-0 right-0 p-1 text-neutral-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">Telefone</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.telefone || '-'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">Área de Serviço</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.area_servico || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">CEP</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.cep ? maskCEP(prestador.cep) : '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a]/60">Número</label>
                        <p className="mt-1 text-lg font-medium text-[#1a1a1a]">{prestador?.numero || '-'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Request Modal */}
                <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title={`Solicitar Alteração: ${editingRequestField?.label}`}>
                  <div className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                      <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Por motivos de segurança, campos sensitiveis exigem aprovação da central administrativo. Sua requisição será analisada em até 48 horas.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1 ml-1">Valor Atual</label>
                      <p className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 font-bold text-neutral-600">{editingRequestField?.value}</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1 ml-1">Novo Valor Desejado</label>
                      <input 
                        type="text"
                        placeholder={`Digite o novo ${editingRequestField?.label}`}
                        value={requestNewValue}
                        onChange={e => setRequestNewValue(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1 ml-1">Motivo da Alteração</label>
                      <textarea
                        placeholder="Explique por que deseja realizar esta alteração..."
                        value={requestMotivo}
                        onChange={e => setRequestMotivo(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium h-24 resize-none"
                      />
                    </div>

                    <button 
                      onClick={handleConfirmRequest}
                      className="w-full rounded-xl bg-indigo-600 py-4 font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                    >
                      Enviar Solicitação
                    </button>
                    
                    <button 
                      onClick={() => setIsRequestModalOpen(false)}
                      className="w-full py-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-neutral-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </Modal>
              </div>
            )}

            {activeTab === 'demandas' && <PrestadorDemandas prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'financeiro' && <PrestadorFinanceiro prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'agenda' && <PrestadorAgenda prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'documentos' && <PrestadorDocumentos prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'vouchers' && <PrestadorVouchers prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'premios' && <PrestadorPremios prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'promocoes' && <PrestadorPromocoes prestadorId={prestadorId} initialItemId={activeItemId} />}
            {activeTab === 'suporte' && <PrestadorSuporte prestadorId={prestadorId} initialItemId={activeItemId} />}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
