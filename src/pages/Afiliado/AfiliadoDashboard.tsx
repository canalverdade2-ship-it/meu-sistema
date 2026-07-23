import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  Crown,
  Globe,
  Grid,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Package,
  Plane,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Stethoscope,
  Store,
  Tags,
  User,
  WalletCards,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { UniversalNotificationBell } from '../../components/ui/UniversalNotificationBell';
import { useClientNotifications } from '../../hooks/useClientNotifications';
import { formatCurrency, formatDate, formatDateTime, maskPhone } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../routing/navigationService';

interface AfiliadoDashboardProps {
  clientId: string;
  onLogout: () => void;
  activeSubRoute?: string;
}

type TabType = 'dashboard' | 'links' | 'comissoes' | 'saques' | 'perfil' | 'pontos';

interface AffiliateProgramData {
  codigo: string;
  nome: string;
  descricao: string;
  percentual: number;
  caminho_padrao: string;
}

const PROGRAM_ICONS: Record<string, any> = {
  loja: ShoppingBag,
  viagens: Plane,
  classificados: Tags,
  servicos: Store,
  saude: Stethoscope,
  seguros: ShieldCheck,
};

function resolveTabFromRoute(subroute?: string): TabType {
  if (subroute === 'links') return 'links';
  if (subroute === 'comissoes') return 'comissoes';
  if (subroute === 'saques') return 'saques';
  if (subroute === 'perfil') return 'perfil';
  if (subroute === 'pontos') return 'pontos';
  return 'dashboard';
}

function resolvePathFromTab(tab: TabType): string {
  if (tab === 'links') return '/afiliados/links';
  if (tab === 'comissoes') return '/afiliados/comissoes';
  if (tab === 'saques') return '/afiliados/saques';
  if (tab === 'perfil') return '/afiliados/perfil';
  if (tab === 'pontos') return '/afiliados/pontos';
  return '/afiliados/dashboard';
}

function generateRefUrl(url: string, refCode: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes(`ref=${refCode}`)) return trimmed;
  const hasQuery = trimmed.includes('?');
  return `${trimmed}${hasQuery ? '&' : '?'}ref=${refCode}`;
}

export function AfiliadoDashboard({ clientId, onLogout, activeSubRoute }: AfiliadoDashboardProps) {
  const activeTab = resolveTabFromRoute(activeSubRoute);
  const { notifications, unreadNotifications, markAsRead, markAllAsRead } = useClientNotifications();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [clientData, setClientData] = useState<any>(null);
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [programs, setPrograms] = useState<AffiliateProgramData[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);

  const [saqueValor, setSaqueValor] = useState<string>('');
  const [pixChaveInput, setPixChaveInput] = useState<string>('');
  const [submittingSaque, setSubmittingSaque] = useState(false);

  const [pontosResgateInput, setPontosResgateInput] = useState<string>('');
  const [submittingResgatePontos, setSubmittingResgatePontos] = useState(false);
  const [pontosTaxa, setPontosTaxa] = useState<number>(0.01);
  const [pontosMinimo, setPontosMinimo] = useState<number>(100);

  // Links Tab States
  const [linksSubMode, setLinksSubMode] = useState<'categorias' | 'produtos' | 'personalizado'>('categorias');
  const [selectedItemCategory, setSelectedItemCategory] = useState<string | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const navigateToTab = (tab: TabType) => {
    navigate(resolvePathFromTab(tab));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Client Profile
      const { data: client, error: clientErr } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (clientErr) throw clientErr;
      setClientData(client || {});

      // 2. Fetch Affiliate Record
      let { data: affiliate, error: affErr } = await supabase
        .from('gsa_afiliados')
        .select('*')
        .eq('cliente_id', clientId)
        .maybeSingle();

      if (affErr) {
        console.warn('Erro ao buscar perfil de afiliado:', affErr);
      }

      if (!affiliate && client?.cpf) {
        const { data: affByDoc } = await supabase
          .from('gsa_afiliados')
          .select('*')
          .ilike('pix_chave', `%${client.cpf}%`)
          .maybeSingle();
        affiliate = affByDoc;
      }

      setAffiliateData(
        affiliate || {
          codigo_publico: (client?.nome || 'afiliado').toLowerCase().replace(/\s+/g, '').slice(0, 10),
          nome_divulgacao: client?.nome || 'Afiliado GSA',
          status: 'ativo',
          pix_tipo: 'cpf_cnpj',
          pix_chave: client?.cpf || client?.email || '',
        }
      );

      if (affiliate?.pix_chave) {
        setPixChaveInput(affiliate.pix_chave);
      } else if (client?.cpf || client?.email) {
        setPixChaveInput(client.cpf || client.email);
      }

      // 3. Fetch Programs
      const { data: progData } = await supabase.from('gsa_afiliado_programas').select('*').order('nome', { ascending: true });
      if (progData && progData.length > 0) {
        setPrograms(progData);
      } else {
        setPrograms([
          { codigo: 'loja', nome: 'GSA Loja', descricao: 'Produtos e assinaturas do marketplace.', percentual: 5, caminho_padrao: '/loja' },
          { codigo: 'viagens', nome: 'GSA Viagens', descricao: 'Pacotes turísticos e hotéis.', percentual: 3, caminho_padrao: '/viagens' },
          { codigo: 'classificados', nome: 'GSA Classificados', descricao: 'Anúncios de veículos e imóveis.', percentual: 2, caminho_padrao: '/classificados' },
          { codigo: 'saude', nome: 'GSA Saúde', descricao: 'Assistência médica e convênios.', percentual: 3, caminho_padrao: '/saude' },
          { codigo: 'seguros', nome: 'GSA Seguros', descricao: 'Seguros patrimoniais e vida.', percentual: 3, caminho_padrao: '/seguros' },
          { codigo: 'servicos', nome: 'Serviços GSA', descricao: 'Sistemas e soluções corporativas.', percentual: 5, caminho_padrao: '/servicos' },
        ]);
      }

      // 4. Fetch Commissions & Payouts
      if (affiliate?.id) {
        const [commRes, payoutRes] = await Promise.all([
          supabase.from('gsa_afiliado_comissoes').select('*').eq('afiliado_id', affiliate.id).order('created_at', { ascending: false }),
          supabase.from('gsa_afiliado_saques').select('*').eq('afiliado_id', affiliate.id).order('created_at', { ascending: false }),
        ]);
        setCommissions(commRes.data || []);
        setPayouts(payoutRes.data || []);
      }

      // 5. Fetch Points Settings
      const { data: sysData } = await supabase.from('system_settings').select('key, value');
      if (sysData) {
        const getSys = (key: string, fallback: string) => sysData.find((s) => s.key === key)?.value ?? fallback;
        setPontosTaxa(parseFloat(getSys('afiliado_pontos_resgate_taxa', '0.01')));
        setPontosMinimo(parseInt(getSys('afiliado_pontos_minimo_resgate', '100'), 10));
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do afiliado:', err);
      toast.error('Erro ao carregar os dados do seu painel.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadProductsList = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, servRes, assRes, catRes] = await Promise.all([
        supabase.from('produtos').select('id, nome, valor, imagem_url, categoria, categoria_id').limit(40),
        supabase.from('servicos').select('id, nome, valor, imagem_url, categoria, categoria_id').limit(40),
        supabase.from('assinaturas').select('id, nome, valor, imagem_url, categoria, categoria_id').limit(40),
        supabase.from('loja_categorias').select('id, nome').eq('status', 'ativo'),
      ]);

      const catMap = new Map((catRes.data || []).map((c: any) => [c.id, c.nome]));

      const items = [
        ...(prodRes.data || []).map((p: any) => ({
          ...p,
          preco: p.valor,
          tipo: 'Produto',
          categoria_nome: p.categoria || catMap.get(p.categoria_id) || 'Produtos Loja',
          path: `/marketplace/loja/produtos/${p.id}`,
        })),
        ...(servRes.data || []).map((s: any) => ({
          ...s,
          preco: s.valor,
          tipo: 'Serviço',
          categoria_nome: s.categoria || catMap.get(s.categoria_id) || 'Serviços GSA',
          path: `/servicos-e-assinaturas/${s.id}`,
        })),
        ...(assRes.data || []).map((a: any) => ({
          ...a,
          preco: a.valor,
          tipo: 'Assinatura',
          categoria_nome: a.categoria || catMap.get(a.categoria_id) || 'Assinaturas GSA',
          path: `/marketplace/loja/assinaturas/${a.id}`,
        })),
      ];
      setProductsList(items);
    } catch (err) {
      console.warn('Erro ao buscar produtos:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'links' && linksSubMode === 'produtos' && productsList.length === 0) {
      loadProductsList();
    }
  }, [activeTab, linksSubMode, productsList.length, loadProductsList]);

  const copyToClipboard = (text: string, label = 'Link') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const code = affiliateData?.codigo_publico || 'afiliado';
  const mainRefLink = `${window.location.origin}/?ref=${code}`;

  const saldoCarteira = Number(clientData?.saldo_carteira || 0);
  const pontosAcumulados = Number(clientData?.pontos || 0);
  const ptsInputVal = Number.parseInt(pontosResgateInput, 10) || 0;
  const valorEquivalenteResgate = ptsInputVal * pontosTaxa;
  const comissoesPendentes = commissions.filter((c) => c.status === 'pendente').reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const comissoesDisponiveis = commissions.filter((c) => c.status === 'disponivel').reduce((sum, c) => sum + Number(c.valor || 0), 0);

  const formatCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const cents = parseInt(digits, 10) / 100;
    return cents.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyInputValue = (value: string): number => {
    if (!value) return 0;
    const clean = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleSolicitarSaque = async (e: FormEvent) => {
    e.preventDefault();
    const val = parseCurrencyInputValue(saqueValor);
    if (!val || val < 50) return toast.error('O valor mínimo para solicitação de saque é de R$ 50,00.');
    if (val > (comissoesDisponiveis || saldoCarteira)) return toast.error('Saldo disponível insuficiente para este valor.');

    setSubmittingSaque(true);
    try {
      if (affiliateData?.id) {
        const { error } = await supabase.rpc('gsa_affiliate_request_payout', {
          p_afiliado_id: affiliateData.id,
          p_valor: val,
          p_pix_tipo: affiliateData.pix_tipo || 'cpf_cnpj',
          p_pix_chave: pixChaveInput || affiliateData.pix_chave || '',
        });
        if (error) throw error;
      }
      toast.success('Solicitação de saque enviada com sucesso!');
      setSaqueValor('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível enviar a solicitação de saque.');
    } finally {
      setSubmittingSaque(false);
    }
  };

  const handleResgatarPontos = async (e: FormEvent) => {
    e.preventDefault();
    const pts = parseInt(pontosResgateInput, 10);
    if (!pts || pts < pontosMinimo) {
      return toast.error(`A quantidade mínima para resgate é de ${pontosMinimo} pontos.`);
    }
    if (pts > pontosAcumulados) {
      return toast.error('Saldo de pontos insuficiente para este resgate.');
    }

    setSubmittingResgatePontos(true);
    try {
      const { error } = await supabase.rpc('gsa_affiliate_redeem_points', {
        p_cliente_id: clientId,
        p_pontos: pts,
        p_taxa: pontosTaxa,
      });

      if (error) throw error;

      const valorCredito = (pts * pontosTaxa).toFixed(2);
      toast.success(`Resgate concluído! R$ ${valorCredito.replace('.', ',')} creditados na sua carteira.`);
      setPontosResgateInput('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível resgatar seus pontos.');
    } finally {
      setSubmittingResgatePontos(false);
    }
  };

  const availableCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    productsList.forEach((item) => {
      const cat = item.categoria_nome || item.tipo;
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));
  }, [productsList]);

  const filteredProducts = useMemo(() => {
    return productsList.filter((item) => {
      const catName = item.categoria_nome || item.tipo;
      const matchesCategory =
        !selectedItemCategory ||
        selectedItemCategory === 'todas' ||
        catName === selectedItemCategory ||
        item.tipo === selectedItemCategory;
      const matchesSearch =
        !productSearchTerm ||
        String(item.nome || '').toLowerCase().includes(productSearchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [productsList, selectedItemCategory, productSearchTerm]);

  const customGeneratedUrl = customUrlInput ? generateRefUrl(customUrlInput, code) : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-28 lg:pb-8">
      {/* Top Mobile/Desktop Executive Header */}
      <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-slate-800 bg-[#0f172a] px-3.5 sm:px-6 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <button onClick={() => setSidebarOpen(true)} className="rounded-xl p-1.5 lg:hidden text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <LogoGSA size="sm" variant="light" />
          <div className="hidden sm:block border-l border-slate-700 pl-3">
            <p className="text-xs sm:text-sm font-bold tracking-tight text-white">Portal do Afiliado</p>
            <p className="text-[10px] font-medium text-slate-400 truncate max-w-40">
              {affiliateData?.nome_divulgacao || clientData?.nome || 'Gestão de Indicações'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UniversalNotificationBell
            variant="client"
            notifications={notifications}
            unreadCount={unreadNotifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigate={(mod, tab) => {
              if (tab) navigateToTab(tab as TabType);
            }}
          />

          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-600 hover:text-white"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px]">
        {/* Desktop Sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200/80 bg-white p-5 lg:block">
          <div className="mb-6 rounded-2xl bg-[#0f172a] p-4 text-white shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perfil Afiliado</span>
              <Crown className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 font-bold text-sm text-white truncate">{clientData?.nome || 'Afiliado GSA'}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-[11px] text-amber-400">
              <span className="text-slate-400">REF:</span> {code}
            </div>
          </div>
          <SidebarNav activeTab={activeTab} onSelect={navigateToTab} />
        </aside>

        {/* Mobile Slide-over Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs lg:hidden" onClick={() => setSidebarOpen(false)}>
            <aside className="h-full w-72 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Menu do Afiliado</p>
                  <p className="text-[11px] font-mono text-amber-600">REF: {code}</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-900">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav activeTab={activeTab} onSelect={(tab) => { setSidebarOpen(false); navigateToTab(tab); }} />
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* PAGE 1: EXCLUSIVE DASHBOARD ROUTE (/afiliados/dashboard) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Dashboard Welcome Header */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        Olá, {clientData?.nome?.split(' ')[0] || 'Afiliado'}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/80">
                        <CheckCircle2 className="h-3 w-3" /> Verificado
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      Visão geral do seu desempenho, atalhos rápidos e saldos.
                    </p>
                  </div>
                </div>

                {/* Dashboard Metric Cards Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1: CARTEIRA -> Navega para /afiliados/saques */}
                  <div
                    onClick={() => navigateToTab('saques')}
                    className="col-span-2 sm:col-span-1 rounded-2xl bg-[#0f172a] p-4 text-white shadow-xs flex flex-col justify-between cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Carteira</span>
                        <WalletCards className="h-4.5 w-4.5 text-amber-400" />
                      </div>
                      <p className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">{formatCurrency(saldoCarteira)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-amber-400 pt-2 border-t border-slate-800">
                      <span>Ir para Saques PIX</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Card 2: PONTOS -> Navega para /afiliados/pontos */}
                  <div
                    onClick={() => navigateToTab('pontos')}
                    className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pontos</span>
                      <Star className="h-4 w-4 text-indigo-600 fill-indigo-100" />
                    </div>
                    <p className="mt-2 font-mono text-lg sm:text-xl font-bold tracking-tight text-slate-900">{pontosAcumulados} pts</p>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-indigo-600">
                      <span>Resgatar Pontos</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Card 3: COMISSÕES PENDENTES -> Navega para /afiliados/comissoes */}
                  <div
                    onClick={() => navigateToTab('comissoes')}
                    className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Em Carência</span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="mt-2 font-mono text-lg sm:text-xl font-bold tracking-tight text-amber-600">{formatCurrency(comissoesPendentes)}</p>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-amber-600">
                      <span>Ver Extrato</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Card 4: COMISSÕES DISPONÍVEIS -> Navega para /afiliados/saques */}
                  <div
                    onClick={() => navigateToTab('saques')}
                    className="col-span-2 sm:col-span-1 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 shadow-xs flex items-center justify-between cursor-pointer hover:bg-emerald-100/60 transition"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Saldo Liberado</span>
                      <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-tight text-emerald-700">{formatCurrency(comissoesDisponiveis)}</p>
                      <p className="text-[10px] font-bold text-emerald-700 mt-1">Ir para Saque &rarr;</p>
                    </div>
                    <BadgeDollarSign className="h-7 w-7 text-emerald-600 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Main Referral Link Box */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Link Principal</span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Seu Link de Indicação Geral</h2>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                    <Link2 className="h-4.5 w-4.5" />
                  </div>
                </div>

                <p className="mt-2.5 text-xs text-slate-600 font-normal">
                  Todas as vendas originadas por este link gerarão comissões e pontos automáticos.
                </p>

                <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <input
                    readOnly
                    value={mainRefLink}
                    className="w-full font-mono text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-800 outline-none select-all focus:bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(mainRefLink, 'Link principal')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Acesse os serviços e soluções corporativas GSA pelo link oficial: ${mainRefLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>

              {/* Service Shortcuts Preview Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Links Rápidos por Categoria</h2>
                    <p className="text-[11px] text-slate-500">Comissões exclusivas para cada canal.</p>
                  </div>
                  <button onClick={() => navigateToTab('links')} className="text-xs font-bold text-slate-700 hover:underline">
                    Ver Todos os Links &rarr;
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {programs.slice(0, 3).map((prog) => {
                    const Icon = PROGRAM_ICONS[prog.codigo] || Share2;
                    const serviceUrl = `${window.location.origin}${prog.caminho_padrao || '/'}?ref=${code}`;
                    return (
                      <div key={prog.codigo} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                        <div className="flex items-start justify-between">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200/80">
                            {prog.percentual}% Comissão
                          </span>
                        </div>

                        <h3 className="mt-3 font-bold text-slate-900 text-sm">{prog.nome}</h3>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{prog.descricao}</p>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <input readOnly value={serviceUrl} className="w-full font-mono text-[10px] bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 truncate" />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(serviceUrl, prog.nome)}
                            className="rounded-lg bg-slate-900 p-2 text-white transition hover:bg-slate-800 shrink-0"
                            title="Copiar link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PAGE 2: EXCLUSIVE LINKS ROUTE (/afiliados/links) WITH ITEM & CUSTOM DEEP LINK GENERATORS */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
                <div className="border-b border-slate-100 pb-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gerador de Links de Divulgação</span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Catálogo de Links & Produtos</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Obtenha links de categorias inteiras, selecione produtos específicos ou crie deep-links personalizados.
                  </p>

                  {/* Mode Switcher Tabs */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLinksSubMode('categorias')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        linksSubMode === 'categorias' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Grid className="h-3.5 w-3.5" /> Categorias Principais
                    </button>

                    <button
                      type="button"
                      onClick={() => setLinksSubMode('produtos')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        linksSubMode === 'produtos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" /> Produto / Item Específico
                    </button>

                    <button
                      type="button"
                      onClick={() => setLinksSubMode('personalizado')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        linksSubMode === 'personalizado' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Wand2 className="h-3.5 w-3.5 text-amber-400" /> Link Personalizado (Deep Link)
                    </button>
                  </div>
                </div>

                {/* MODE 1: CATEGORIAS */}
                {linksSubMode === 'categorias' && (
                  <div className="mt-4 space-y-3">
                    {programs.map((prog) => {
                      const Icon = PROGRAM_ICONS[prog.codigo] || Share2;
                      const serviceUrl = `${window.location.origin}${prog.caminho_padrao || '/'}?ref=${code}`;
                      return (
                        <div key={prog.codigo} className="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{prog.nome}</p>
                              <p className="text-[11px] text-slate-500">Comissão de {prog.percentual}% + pontos por venda</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input readOnly value={serviceUrl} className="w-full font-mono text-xs bg-white px-3 py-2 rounded-xl border border-slate-200 text-slate-800 sm:w-80 select-all" />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(serviceUrl, prog.nome)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shrink-0"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copiar Link
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* MODE 2: PRODUTOS / ITENS ESPECÍFICOS - CATEGORIZATION FIRST */}
                {linksSubMode === 'produtos' && (
                  <div className="mt-4 space-y-4">
                    {!selectedItemCategory ? (
                      <div>
                        <div className="mb-3.5">
                          <h3 className="text-sm font-bold text-slate-900">Selecione uma Categoria Principal:</h3>
                          <p className="text-[11px] text-slate-500">Escolha uma categoria para listar os itens e gerar seus links exclusivos.</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setSelectedItemCategory('Produto')}
                            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left shadow-xs transition hover:bg-slate-100/80 hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                                <ShoppingBag className="h-5 w-5" />
                              </div>
                              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {productsList.filter((i) => i.tipo === 'Produto').length} itens
                              </span>
                            </div>
                            <div className="mt-3">
                              <h4 className="font-bold text-slate-900 text-sm">Produtos da Loja GSA</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">Roupas, alimentos, eletrônicos e produtos do marketplace.</p>
                            </div>
                            <div className="mt-3 text-xs font-bold text-slate-900 flex items-center gap-1">
                              Ver Produtos &rarr;
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedItemCategory('Serviço')}
                            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left shadow-xs transition hover:bg-slate-100/80 hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                                <Store className="h-5 w-5" />
                              </div>
                              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {productsList.filter((i) => i.tipo === 'Serviço').length} serviços
                              </span>
                            </div>
                            <div className="mt-3">
                              <h4 className="font-bold text-slate-900 text-sm">Serviços Corporativos</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">BPO financeiro, fiscal, previdência, MEI e assessoria.</p>
                            </div>
                            <div className="mt-3 text-xs font-bold text-slate-900 flex items-center gap-1">
                              Ver Serviços &rarr;
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedItemCategory('Assinatura')}
                            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left shadow-xs transition hover:bg-slate-100/80 hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                                <Crown className="h-5 w-5 text-amber-500" />
                              </div>
                              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {productsList.filter((i) => i.tipo === 'Assinatura').length} planos
                              </span>
                            </div>
                            <div className="mt-3">
                              <h4 className="font-bold text-slate-900 text-sm">Assinaturas & Planos</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">Planos mensais e anuais de serviços recorrentes.</p>
                            </div>
                            <div className="mt-3 text-xs font-bold text-slate-900 flex items-center gap-1">
                              Ver Assinaturas &rarr;
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedItemCategory('todas')}
                            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left shadow-xs transition hover:bg-slate-100/80 hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                                <Grid className="h-5 w-5" />
                              </div>
                              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {productsList.length} itens
                              </span>
                            </div>
                            <div className="mt-3">
                              <h4 className="font-bold text-slate-900 text-sm">Catálogo Completo</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">Listar todos os produtos e serviços cadastrados.</p>
                            </div>
                            <div className="mt-3 text-xs font-bold text-slate-900 flex items-center gap-1">
                              Ver Tudo &rarr;
                            </div>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Header Bar with Back Button */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemCategory(null);
                              setProductSearchTerm('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                          >
                            &larr; Voltar para Categorias
                          </button>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">
                              Categoria: {selectedItemCategory === 'Produto' ? 'Produtos da Loja' : selectedItemCategory === 'Serviço' ? 'Serviços Corporativos' : selectedItemCategory === 'Assinatura' ? 'Assinaturas' : selectedItemCategory}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              ({filteredProducts.length})
                            </span>
                          </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            placeholder="Buscar item pelo nome..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-slate-400"
                          />
                        </div>

                        {loadingProducts ? (
                          <div className="flex py-10 items-center justify-center text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
                          </div>
                        ) : filteredProducts.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {filteredProducts.map((item) => {
                              const itemUrl = `${window.location.origin}${item.path}?ref=${code}`;
                              return (
                                <div key={item.id} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase">
                                            {item.tipo}
                                          </span>
                                          {item.categoria_nome && (
                                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-200/60">
                                              {item.categoria_nome}
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="mt-1.5 font-bold text-slate-900 text-sm line-clamp-1">{item.nome}</h4>
                                      </div>
                                      {item.preco > 0 && (
                                        <span className="font-mono text-xs font-bold text-emerald-700 shrink-0">
                                          {formatCurrency(item.preco)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                                    <input
                                      readOnly
                                      value={itemUrl}
                                      className="w-full font-mono text-[10px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 truncate select-all"
                                    />
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(itemUrl, item.nome)}
                                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                                      >
                                        <Copy className="h-3 w-3" /> Copiar
                                      </button>
                                      <a
                                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira ${item.nome} no site oficial GSA: ${itemUrl}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                      >
                                        WhatsApp
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-10 text-center text-slate-400 text-xs font-medium">
                            Nenhum produto cadastrado nesta categoria.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 3: GERADOR DE DEEP LINK PERSONALIZADO */}
                {linksSubMode === 'personalizado' && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4.5 w-4.5 text-amber-700" />
                        <h3 className="text-xs font-bold text-amber-900">Gerador de Link de Qualquer Página</h3>
                      </div>
                      <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                        Cole qualquer endereço do site GSA abaixo (ex: <code>http://localhost:3000/loja/detalhes-produto</code>). Nosso sistema vai injetar automaticamente o seu código de referência <code>REF: {code}</code>.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Link Original da Página / Item
                      </label>
                      <input
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="Ex: http://localhost:3000/loja ou /servicos"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-900 outline-none focus:bg-white focus:border-slate-400"
                      />
                    </div>

                    {customGeneratedUrl && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Seu Link Personalizado Pronto:</span>
                        <input
                          readOnly
                          value={customGeneratedUrl}
                          className="w-full font-mono text-xs font-bold bg-white px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 select-all"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(customGeneratedUrl, 'Link personalizado')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar Link
                          </button>
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Acesse o link oficial: ${customGeneratedUrl}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAGE 3: EXCLUSIVE COMMISSIONS ROUTE (/afiliados/comissoes) */}
          {activeTab === 'comissoes' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
                <div className="border-b border-slate-100 pb-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Finanças de Afiliado</span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Extrato de Comissões</h2>
                  <p className="mt-1 text-xs text-slate-500">Histórico detalhado de vendas e comissões atribuídas ao seu perfil.</p>
                </div>

                {/* Financial Summary Cards inside Commissions Page */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Saldo Liberado</span>
                    <p className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatCurrency(comissoesDisponiveis)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Em Carência</span>
                    <p className="mt-1 font-mono text-lg font-bold text-amber-700">{formatCurrency(comissoesPendentes)}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Acumulado</span>
                    <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatCurrency(comissoesDisponiveis + comissoesPendentes)}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3.5 py-2.5">Data</th>
                        <th className="px-3.5 py-2.5">Descrição</th>
                        <th className="px-3.5 py-2.5">Valor Venda</th>
                        <th className="px-3.5 py-2.5">% Com.</th>
                        <th className="px-3.5 py-2.5">Comissão</th>
                        <th className="px-3.5 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {commissions.length > 0 ? (
                        commissions.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-3.5 py-2.5 text-slate-600">{formatDate(item.created_at)}</td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">{item.descricao || 'Venda de Serviço'}</td>
                            <td className="px-3.5 py-2.5 text-slate-700">{formatCurrency(item.valor_venda || 0)}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-700">{item.percentual || 5}%</td>
                            <td className="px-3.5 py-2.5 font-bold text-emerald-700">{formatCurrency(item.valor || 0)}</td>
                            <td className="px-3.5 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.status === 'disponivel' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                            Nenhuma comissão registrada até o momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 4: EXCLUSIVE PAYOUTS ROUTE (/afiliados/saques) - FINTECH EXECUTIVE DESIGN */}
          {activeTab === 'saques' && (
            <div className="space-y-4">
              {/* Executive Available Balance Header Banner */}
              <div className="rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-5 text-white shadow-md border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Resgate Financeiro PIX</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Saldo Liberado para Saque:</p>
                    <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-emerald-400">
                      {formatCurrency(comissoesDisponiveis || saldoCarteira)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] text-slate-400">Em Carência (Aguardando liberação):</p>
                    <p className="font-mono text-sm font-semibold text-amber-400 mt-0.5">{formatCurrency(comissoesPendentes)}</p>
                  </div>
                </div>
              </div>

              {/* Form & Payout Details */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Solicitar Novo Resgate</h2>
                <p className="mt-0.5 text-xs text-slate-500">Transfira os valores direto para a sua chave PIX.</p>

                <form onSubmit={handleSolicitarSaque} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Valor do Saque (R$)
                    </label>
                    <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:bg-white focus-within:border-slate-400">
                      <span className="inline-flex items-center px-3.5 bg-slate-100 text-slate-600 font-mono text-xs font-bold border-r border-slate-200">
                        R$
                      </span>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        value={saqueValor}
                        onChange={(e) => setSaqueValor(formatCurrencyInput(e.target.value))}
                        placeholder="0,00"
                        className="w-full px-3.5 py-3 font-mono text-base font-bold text-slate-900 bg-transparent outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Valor mínimo para saque: R$ 50,00</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Chave PIX de Destino
                    </label>
                    <input
                      required
                      value={pixChaveInput}
                      onChange={(e) => setPixChaveInput(e.target.value)}
                      placeholder="CPF, CNPJ, E-mail ou Telefone"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSaque}
                    className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {submittingSaque ? 'Processando...' : 'Confirmar Solicitação de Saque PIX'}
                  </button>
                </form>

                {/* Payout History Table */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Histórico de Saques Realizados</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[450px]">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3.5 py-2.5">Solicitado em</th>
                          <th className="px-3.5 py-2.5">Valor (R$)</th>
                          <th className="px-3.5 py-2.5">Chave PIX</th>
                          <th className="px-3.5 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {payouts.length > 0 ? (
                          payouts.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="px-3.5 py-2.5 text-slate-600">{formatDateTime(item.solicitado_em || item.created_at)}</td>
                              <td className="px-3.5 py-2.5 font-bold text-slate-900">{formatCurrency(item.valor || 0)}</td>
                              <td className="px-3.5 py-2.5 font-mono text-slate-700">{item.pix_chave_snapshot || 'Chave cadastrada'}</td>
                              <td className="px-3.5 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.status === 'pago' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : item.status === 'aprovado' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                              Nenhuma solicitação de saque realizada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 5: EXCLUSIVE POINTS ROUTE (/afiliados/pontos) WITH REDEMPTION TO WALLET */}
          {activeTab === 'pontos' && (
            <div className="space-y-4">
              {/* Header Card showing points and conversion banner */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-5 text-white shadow-md border border-indigo-900">
                <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-indigo-400 fill-indigo-400/30" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Programa Fidelidade Afiliados</span>
                  </div>
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                    {Math.round(1 / pontosTaxa)} pts = R$ 1,00
                  </span>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <p className="text-xs text-indigo-300 font-medium">Saldo Atual de Pontos:</p>
                    <p className="mt-1 font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                      {pontosAcumulados} <span className="text-indigo-400 text-lg font-sans">pts</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] text-indigo-300">Equivalente em Dinheiro na Carteira:</p>
                    <p className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                      {formatCurrency(pontosAcumulados * pontosTaxa)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rules & Points Redemption Form */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Rules Explanatory Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs lg:col-span-1 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Zap className="h-4.5 w-4.5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">Como Funciona?</h3>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 text-[11px]">
                        1
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Pontos por Venda Bruta</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Acumule pontos em cada venda gerada (calculado sobre o valor bruto do produto/serviço).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 text-[11px]">
                        2
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Resgate para Carteira</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cada {Math.round(1 / pontosTaxa)} pontos equivalem a R$ 1,00 liberado no seu saldo de carteira.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 text-[11px]">
                        3
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Saque via PIX</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Após resgatar para a carteira, solicite a transferência instantânea para sua chave PIX.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Redeem Form Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs lg:col-span-2">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4.5 w-4.5 text-indigo-600" />
                      <h2 className="text-base font-bold text-slate-900">Resgatar Pontos para Saldo em Carteira</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Informe a quantidade de pontos que deseja converter.</p>
                  </div>

                  <form onSubmit={handleResgatarPontos} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Quantidade de Pontos (Mínimo {pontosMinimo} pts)
                      </label>
                      <input
                        required
                        type="number"
                        min={pontosMinimo}
                        max={pontosAcumulados}
                        step="1"
                        value={pontosResgateInput}
                        onChange={(e) => setPontosResgateInput(e.target.value)}
                        placeholder="Ex: 500"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-400"
                      />
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">Atalhos:</span>
                      <button
                        type="button"
                        onClick={() => setPontosResgateInput('100')}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        100 pts
                      </button>
                      <button
                        type="button"
                        onClick={() => setPontosResgateInput('500')}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        500 pts
                      </button>
                      <button
                        type="button"
                        onClick={() => setPontosResgateInput('1000')}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        1.000 pts
                      </button>
                      <button
                        type="button"
                        onClick={() => setPontosResgateInput(String(pontosAcumulados))}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        Todos ({pontosAcumulados} pts)
                      </button>
                    </div>

                    {/* Calculation Preview */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-medium">Valor a ser creditado na carteira:</span>
                      <span className="font-mono text-base font-bold text-emerald-700">
                        + {formatCurrency(valorEquivalenteResgate)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingResgatePontos || ptsInputVal <= 0 || ptsInputVal > pontosAcumulados}
                      className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                      {submittingResgatePontos ? 'Processando Resgate...' : 'Confirmar Resgate para Carteira'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 6: EXCLUSIVE PROFILE ROUTE (/afiliados/perfil) */}
          {activeTab === 'perfil' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs max-w-2xl">
                <div className="border-b border-slate-100 pb-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dados do Cadastro</span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Perfil do Afiliado</h2>
                  <p className="mt-1 text-xs text-slate-500">Dados cadastrais e configuração da chave PIX de recebimento.</p>
                </div>

                <div className="mt-4 space-y-2.5 text-xs font-medium text-slate-800">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Nome / Razão Social:</span>
                    <strong className="text-slate-900">{clientData?.nome || affiliateData?.nome_divulgacao}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Documento:</span>
                    <strong className="text-slate-900">{clientData?.cpf || clientData?.cnpj || 'Cadastrado'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">E-mail de Contato:</span>
                    <strong className="text-slate-900">{clientData?.email || 'Cadastrado'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Telefone / WhatsApp:</span>
                    <strong className="text-slate-900">{clientData?.telefone ? maskPhone(clientData.telefone) : 'Cadastrado'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Código Afiliado (REF):</span>
                    <strong className="font-mono text-amber-700 font-bold">{code}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Chave PIX Cadastrada:</span>
                    <strong className="font-mono text-slate-900">{pixChaveInput || 'Não informada'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Fixed App Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 border-t border-slate-200 backdrop-blur-md z-40 flex items-center justify-around py-2 px-1 shadow-lg">
        <MobileNavItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateToTab('dashboard')} />
        <MobileNavItem icon={Link2} label="Links" active={activeTab === 'links'} onClick={() => navigateToTab('links')} />
        <MobileNavItem icon={BadgeDollarSign} label="Comissões" active={activeTab === 'comissoes'} onClick={() => navigateToTab('comissoes')} />
        <MobileNavItem icon={Banknote} label="Saques" active={activeTab === 'saques'} onClick={() => navigateToTab('saques')} />
        <MobileNavItem icon={User} label="Perfil" active={activeTab === 'perfil'} onClick={() => navigateToTab('perfil')} />
      </nav>
    </div>
  );
}

function SidebarNav({ activeTab, onSelect }: { activeTab: TabType; onSelect: (tab: TabType) => void }) {
  const items: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'links', label: 'Meus Links', icon: Link2 },
    { id: 'comissoes', label: 'Comissões', icon: BadgeDollarSign },
    { id: 'saques', label: 'Saques PIX', icon: Banknote },
    { id: 'pontos', label: 'Pontos Fidelidade', icon: Star },
    { id: 'perfil', label: 'Meu Perfil', icon: User },
  ];

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
              isSelected ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
        active ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'
      }`}
    >
      <div className={`p-1 rounded-lg ${active ? 'bg-slate-900 text-amber-400' : ''}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <span className="text-[10px] mt-0.5 tracking-tight">{label}</span>
    </button>
  );
}
