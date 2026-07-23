import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Save,
  Share2,
  Star,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import {
  cancelAffiliatePayout,
  createAffiliateLink,
  fetchAffiliateSnapshot,
  joinAffiliate,
  redeemAffiliatePoints,
  requestAffiliatePayout,
  updateAffiliateProfile,
} from '../../features/affiliates/service';
import type { AffiliateSnapshot } from '../../features/affiliates/types';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { navigate } from '../../routing/navigationService';
import { routes } from '../../routing/routeCatalog';

interface AfiliadoDashboardProps {
  clientId: string;
  onLogout: () => void;
  activeSubRoute?: string;
}

type TabType = 'dashboard' | 'links' | 'comissoes' | 'saques' | 'perfil' | 'pontos';

const EMPTY_SNAPSHOT: AffiliateSnapshot = {
  affiliate: null,
  programs: [],
  links: [],
  commissions: [],
  payouts: [],
  summary: {
    cliques: 0,
    conversoes: 0,
    totalPendente: 0,
    totalDisponivel: 0,
    totalPago: 0,
    totalSolicitado: 0,
    saqueMinimo: 50,
    pontos: 0,
    saldoCarteira: 0,
    pontosTaxa: 0.01,
    pontosMinimo: 100,
    pontosAtivo: true,
  },
};

function resolveTabFromRoute(subroute?: string): TabType {
  return ['links', 'comissoes', 'saques', 'perfil', 'pontos'].includes(subroute || '')
    ? subroute as TabType
    : 'dashboard';
}

function resolvePathFromTab(tab: TabType): string {
  if (tab === 'links') return routes.public.affiliateLinks();
  if (tab === 'comissoes') return routes.public.affiliateCommissions();
  if (tab === 'saques') return routes.public.affiliatePayouts();
  if (tab === 'perfil') return routes.public.affiliateProfile();
  if (tab === 'pontos') return routes.public.affiliatePoints();
  return routes.public.affiliateDashboard();
}

function affiliateUrl(link: { destino: string; codigo: string }) {
  const url = new URL(link.destino, window.location.origin);
  url.searchParams.set('ref', link.codigo);
  return url.toString();
}

function currencyInputToNumber(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AfiliadoDashboard({ clientId: _clientId, onLogout, activeSubRoute }: AfiliadoDashboardProps) {
  const activeTab = resolveTabFromRoute(activeSubRoute);
  const [snapshot, setSnapshot] = useState<AffiliateSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [programCode, setProgramCode] = useState('');
  const [destination, setDestination] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [payoutValue, setPayoutValue] = useState('');
  const [pointsValue, setPointsValue] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePixType, setProfilePixType] = useState('cpf');
  const [profilePixKey, setProfilePixKey] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinPixKey, setJoinPixKey] = useState('');

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const data = await fetchAffiliateSnapshot();
      setSnapshot(data);
      if (data.affiliate) {
        setProfileName(data.affiliate.nomeDivulgacao);
        setProfilePixType(data.affiliate.pixTipo || 'cpf');
        setProfilePixKey(data.affiliate.pixChave || '');
      }
      if (!programCode && data.programs[0]) {
        setProgramCode(data.programs[0].codigo);
        setDestination(data.programs[0].caminhoPadrao);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar o painel do afiliado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [programCode]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    const refreshOnFocus = () => void load(true);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [load]);

  useEffect(() => {
    const selected = snapshot.programs.find((program) => program.codigo === programCode);
    if (selected && !destination) setDestination(selected.caminhoPadrao);
  }, [destination, programCode, snapshot.programs]);

  const navigateToTab = (tab: TabType) => navigate(resolvePathFromTab(tab));

  const runAction = async (action: () => Promise<AffiliateSnapshot>, success: string) => {
    setWorking(true);
    try {
      const data = await action();
      setSnapshot(data);
      toast.success(success);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a operação.');
    } finally {
      setWorking(false);
    }
  };

  const activateProfile = async (event: FormEvent) => {
    event.preventDefault();
    await runAction(() => joinAffiliate({
      nomeDivulgacao: joinName,
      pixTipo: 'cpf',
      pixChave: joinPixKey,
      termosVersao: '2026-07-22',
    }), 'Perfil de afiliado ativado.');
  };

  const createLink = async (event: FormEvent) => {
    event.preventDefault();
    const selected = snapshot.programs.find((program) => program.codigo === programCode);
    await runAction(() => createAffiliateLink({
      programaCodigo: programCode,
      destino: destination || selected?.caminhoPadrao || '/',
      titulo: linkTitle || selected?.nome || 'Link GSA',
    }), 'Link de divulgação criado.');
    setLinkTitle('');
  };

  const requestPayout = async (event: FormEvent) => {
    event.preventDefault();
    const value = currencyInputToNumber(payoutValue);
    if (value < snapshot.summary.saqueMinimo) {
      toast.error(`O valor mínimo é ${formatCurrency(snapshot.summary.saqueMinimo)}.`);
      return;
    }
    await runAction(() => requestAffiliatePayout(value, crypto.randomUUID()), 'Solicitação de saque enviada.');
    setPayoutValue('');
  };

  const redeemPoints = async (event: FormEvent) => {
    event.preventDefault();
    const points = Number(pointsValue);
    if (!Number.isFinite(points) || points < snapshot.summary.pontosMinimo) {
      toast.error(`O mínimo é ${snapshot.summary.pontosMinimo.toLocaleString('pt-BR')} pontos.`);
      return;
    }
    await runAction(() => redeemAffiliatePoints(points, crypto.randomUUID()), 'Pontos convertidos para a carteira.');
    setPointsValue('');
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    await runAction(() => updateAffiliateProfile({
      nomeDivulgacao: profileName,
      pixTipo: profilePixType,
      pixChave: profilePixKey,
    }), 'Perfil atualizado.');
  };

  const selectedProgram = snapshot.programs.find((program) => program.codigo === programCode);
  const pointsCredit = (Number(pointsValue) || 0) * snapshot.summary.pontosTaxa;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-9 w-9 animate-spin text-slate-900" /><span className="sr-only">Carregando painel</span></div>;
  }

  if (!snapshot.affiliate) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <LogoGSA size="md" variant="dark" />
          <h1 className="mt-8 text-2xl font-black text-slate-950">Ative seu perfil de afiliado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sua sessão de cliente está ativa, mas ainda não existe um perfil de afiliado vinculado a esta conta.</p>
          <form onSubmit={activateProfile} className="mt-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Nome de divulgação<input required value={joinName} onChange={(event) => setJoinName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></label>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Chave PIX<input required value={joinPixKey} onChange={(event) => setJoinPixKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></label>
            <button disabled={working} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{working ? 'Ativando...' : 'Ativar perfil'}</button>
          </form>
          <button type="button" onClick={onLogout} className="mt-4 w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">Sair</button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0f172a] px-4 text-white shadow-md sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-300 lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <LogoGSA size="sm" variant="light" />
          <div className="hidden border-l border-slate-700 pl-3 sm:block"><p className="text-sm font-bold">Portal do Afiliado</p><p className="text-[10px] text-slate-400">REF: {snapshot.affiliate.codigoPublico}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Atualizar</span></button>
          <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
          <div className="mb-6 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perfil ativo</p><p className="mt-2 truncate text-sm font-bold">{snapshot.affiliate.nomeDivulgacao}</p><p className="mt-2 font-mono text-xs text-amber-400">{snapshot.affiliate.codigoPublico}</p></div>
          <SidebarNav activeTab={activeTab} onSelect={navigateToTab} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <aside className="h-full w-72 bg-white p-5" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between"><strong>Menu do Afiliado</strong><button type="button" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button></div>
              <SidebarNav activeTab={activeTab} onSelect={(tab) => { setSidebarOpen(false); navigateToTab(tab); }} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 space-y-5 p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <>
              <section className="rounded-3xl bg-slate-950 p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Visão geral</p>
                <h1 className="mt-2 text-2xl font-black">Olá, {snapshot.affiliate.nomeDivulgacao}</h1>
                <p className="mt-2 text-sm text-slate-400">Os dados são atualizados pelo backend seguro e sincronizados periodicamente.</p>
              </section>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard label="Disponível" value={formatCurrency(snapshot.summary.totalDisponivel)} icon={WalletCards} />
                <MetricCard label="Em carência" value={formatCurrency(snapshot.summary.totalPendente)} icon={Clock3} />
                <MetricCard label="Conversões" value={snapshot.summary.conversoes.toLocaleString('pt-BR')} icon={CheckCircle2} />
                <MetricCard label="Cliques" value={snapshot.summary.cliques.toLocaleString('pt-BR')} icon={Share2} />
              </div>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><div><h2 className="font-black">Links ativos</h2><p className="text-xs text-slate-500">Use somente estes códigos para receber atribuição.</p></div><button type="button" onClick={() => navigateToTab('links')} className="text-xs font-black text-indigo-600">Gerenciar links</button></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {snapshot.links.slice(0, 4).map((link) => <LinkCard key={link.id} link={link} />)}
                  {snapshot.links.length === 0 && <Empty text="Nenhum link criado ainda." />}
                </div>
              </section>
            </>
          )}

          {activeTab === 'links' && (
            <section className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h1 className="text-xl font-black">Gerar link rastreável</h1>
                <p className="mt-1 text-sm text-slate-500">O backend valida o destino e cria um código exclusivo iniciado por L.</p>
                <form onSubmit={createLink} className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Programa<select value={programCode} onChange={(event) => { const code = event.target.value; setProgramCode(code); setDestination(snapshot.programs.find((program) => program.codigo === code)?.caminhoPadrao || ''); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{snapshot.programs.map((program) => <option key={program.id} value={program.codigo}>{program.nome} · {program.percentual}%</option>)}</select></label>
                  <label className="text-xs font-bold text-slate-600">Título<input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder={selectedProgram?.nome || 'Link GSA'} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></label>
                  <label className="text-xs font-bold text-slate-600 lg:col-span-2">Destino permitido<input required value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm" /></label>
                  <button disabled={working || !programCode} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50 lg:col-span-2">{working ? 'Criando...' : 'Criar link exclusivo'}</button>
                </form>
              </div>
              <div className="grid gap-3 md:grid-cols-2">{snapshot.links.map((link) => <LinkCard key={link.id} link={link} />)}{snapshot.links.length === 0 && <Empty text="Crie seu primeiro link acima." />}</div>
            </section>
          )}

          {activeTab === 'comissoes' && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h1 className="text-xl font-black">Comissões</h1>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><MiniMetric label="Disponível" value={formatCurrency(snapshot.summary.totalDisponivel)} /><MiniMetric label="Em carência" value={formatCurrency(snapshot.summary.totalPendente)} /><MiniMetric label="Pago" value={formatCurrency(snapshot.summary.totalPago)} /></div>
              <div className="mt-5 overflow-x-auto"><table className="min-w-[680px] w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Programa</th><th className="p-3">Base</th><th className="p-3">Percentual</th><th className="p-3">Comissão</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.commissions.map((item) => <tr key={item.id}><td className="p-3">{item.criadoEm ? formatDateTime(item.criadoEm) : '—'}</td><td className="p-3 font-bold">{item.programaNome}</td><td className="p-3">{formatCurrency(item.baseElegivel)}</td><td className="p-3">{item.percentual}%</td><td className="p-3 font-black text-emerald-700">{formatCurrency(item.valor)}</td><td className="p-3"><Status value={item.status} /></td></tr>)}</tbody></table>{snapshot.commissions.length === 0 && <Empty text="Nenhuma comissão registrada." />}</div>
            </section>
          )}

          {activeTab === 'saques' && (
            <section className="space-y-5">
              <div className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo disponível para saque</p><p className="mt-2 text-3xl font-black text-emerald-400">{formatCurrency(snapshot.summary.totalDisponivel)}</p><p className="mt-2 text-xs text-slate-400">Mínimo: {formatCurrency(snapshot.summary.saqueMinimo)} · PIX {snapshot.affiliate.pixTipo}</p></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <form onSubmit={requestPayout} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-bold text-slate-600">Valor do saque<input required value={payoutValue} onChange={(event) => setPayoutValue(formatCurrencyInput(event.target.value))} placeholder="0,00" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-base" /></label><button disabled={working || snapshot.summary.totalDisponivel < snapshot.summary.saqueMinimo} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Solicitar PIX</button></form>
              </div>
              <div className="space-y-3">{snapshot.payouts.map((payout) => <article key={payout.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"><div><p className="font-black">{formatCurrency(payout.valor)}</p><p className="mt-1 text-xs text-slate-500">{payout.solicitadoEm ? formatDateTime(payout.solicitadoEm) : '—'} · {payout.pixChaveMascarada || 'PIX protegido'}</p></div><div className="flex items-center gap-2"><Status value={payout.status} />{payout.status === 'solicitado' && <button type="button" disabled={working} onClick={() => void runAction(() => cancelAffiliatePayout(payout.id), 'Saque cancelado.')} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Cancelar</button>}</div></article>)}{snapshot.payouts.length === 0 && <Empty text="Nenhuma solicitação de saque." />}</div>
            </section>
          )}

          {activeTab === 'pontos' && (
            <section className="space-y-5">
              <div className="rounded-3xl bg-indigo-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Pontos do afiliado</p><p className="mt-2 text-4xl font-black">{snapshot.summary.pontos.toLocaleString('pt-BR')} pts</p><p className="mt-2 text-sm text-indigo-200">Carteira: {formatCurrency(snapshot.summary.saldoCarteira)} · {(1 / snapshot.summary.pontosTaxa).toLocaleString('pt-BR')} pontos = R$ 1,00</p></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><form onSubmit={redeemPoints} className="space-y-4"><label className="block text-xs font-bold text-slate-600">Quantidade de pontos<input required type="number" min={snapshot.summary.pontosMinimo} max={snapshot.summary.pontos} value={pointsValue} onChange={(event) => setPointsValue(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-base" /></label><div className="rounded-xl bg-slate-50 p-4 text-sm">Crédito previsto: <strong className="text-emerald-700">{formatCurrency(pointsCredit)}</strong></div><button disabled={working || !snapshot.summary.pontosAtivo} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Converter para carteira</button></form></div>
            </section>
          )}

          {activeTab === 'perfil' && (
            <section className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h1 className="text-xl font-black">Perfil e recebimento</h1>
              <p className="mt-1 text-sm text-slate-500">As alterações são gravadas no perfil vinculado à sua sessão.</p>
              <form onSubmit={saveProfile} className="mt-5 space-y-4"><label className="block text-xs font-bold text-slate-600">Nome de divulgação<input required value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><label className="block text-xs font-bold text-slate-600">Tipo de PIX<select value={profilePixType} onChange={(event) => setProfilePixType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option></select></label><label className="block text-xs font-bold text-slate-600">Chave PIX<input required value={profilePixKey} onChange={(event) => setProfilePixKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label><button disabled={working} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Salvar perfil</button></form>
            </section>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 px-1 py-2 backdrop-blur lg:hidden">
        <MobileNavItem icon={LayoutDashboard} label="Início" active={activeTab === 'dashboard'} onClick={() => navigateToTab('dashboard')} />
        <MobileNavItem icon={Link2} label="Links" active={activeTab === 'links'} onClick={() => navigateToTab('links')} />
        <MobileNavItem icon={BadgeDollarSign} label="Comissões" active={activeTab === 'comissoes'} onClick={() => navigateToTab('comissoes')} />
        <MobileNavItem icon={Banknote} label="Saques" active={activeTab === 'saques'} onClick={() => navigateToTab('saques')} />
        <MobileNavItem icon={User} label="Perfil" active={activeTab === 'perfil'} onClick={() => navigateToTab('perfil')} />
      </nav>
    </div>
  );
}

function SidebarNav({ activeTab, onSelect }: { activeTab: TabType; onSelect: (tab: TabType) => void }) {
  const items = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['links', 'Meus links', Link2],
    ['comissoes', 'Comissões', BadgeDollarSign],
    ['saques', 'Saques PIX', Banknote],
    ['pontos', 'Pontos', Star],
    ['perfil', 'Meu perfil', User],
  ] as const;
  return <nav className="space-y-1">{items.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => onSelect(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${activeTab === id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>;
}

function MobileNavItem({ icon: Icon, label, active, onClick }: { icon: typeof LayoutDashboard; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] ${active ? 'font-black text-slate-950' : 'text-slate-400'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof WalletCards }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></article>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function LinkCard({ link }: { key?: string; link: AffiliateSnapshot['links'][number] }) {
  const url = affiliateUrl(link);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado.');
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{link.titulo}</p><p className="mt-1 text-xs text-slate-500">{link.programaNome} · código {link.codigo}</p></div><button type="button" onClick={() => void copy()} className="rounded-lg bg-slate-950 p-2 text-white" title="Copiar link"><Copy className="h-4 w-4" /></button></div><input readOnly value={url} className="mt-3 w-full rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600" /><div className="mt-3 flex gap-4 text-xs text-slate-500"><span>{link.cliques} cliques</span><span>{link.conversoes} conversões</span><span>{formatCurrency(link.comissaoTotal)}</span></div></article>;
}

function Status({ value }: { value: string }) {
  const tone = value === 'pago' || value === 'paga' || value === 'disponivel' ? 'bg-emerald-50 text-emerald-700' : value === 'rejeitado' || value === 'cancelado' || value === 'revertida' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400">{text}</div>;
}
