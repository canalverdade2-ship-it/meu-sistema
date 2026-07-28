import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  CheckCircle2,
  Clock3,
  Eye,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
type AffiliateAdminTab = 'programas' | 'afiliados' | 'saques';

type AffiliateProgram = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  caminho_padrao?: string | null;
  base_tipo?: string | null;
  percentual: number;
  janela_atribuicao_dias: number;
  carencia_dias: number;
  saque_minimo: number;
  pontos_por_real?: number;
  ativo: boolean;
};

type AffiliateRecord = {
  id: string;
  cliente_id?: string;
  nome_divulgacao: string;
  codigo_publico?: string;
  status: string;
  pix_tipo?: string | null;
  pix_chave?: string | null;
  pix_chave_mascarada?: string | null;
  created_at?: string;
  cliques?: number;
  conversoes?: number;
  comissao_total?: number;
  saldo_disponivel?: number;
  cliente_nome_completo?: string | null;
  cliente_cpf?: string | null;
  cliente_cnpj?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  cliente_tipo_pessoa?: string | null;
};

type AffiliatePayout = {
  id: string;
  afiliado_id?: string;
  afiliado_nome?: string;
  codigo_publico?: string;
  valor: number;
  status: string;
  pix_tipo?: string | null;
  pix_chave?: string | null;
  solicitado_em?: string;
  aprovado_em?: string | null;
  pago_em?: string | null;
  notas?: string | null;
};

type AffiliateSummary = {
  afiliados_ativos: number;
  cliques: number;
  vendas_atribuidas: number;
  comissoes_pendentes: number;
  comissoes_disponiveis: number;
  saques_pendentes: number;
};

type AffiliateAdminSnapshot = {
  success?: boolean;
  summary?: Partial<AffiliateSummary>;
  programs?: AffiliateProgram[];
  affiliates?: AffiliateRecord[];
  payouts?: AffiliatePayout[];
};

const EMPTY_SUMMARY: AffiliateSummary = {
  afiliados_ativos: 0,
  cliques: 0,
  vendas_atribuidas: 0,
  comissoes_pendentes: 0,
  comissoes_disponiveis: 0,
  saques_pendentes: 0,
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSnapshot(payload: AffiliateAdminSnapshot | null) {
  const summary = payload?.summary || {};
  return {
    summary: {
      afiliados_ativos: number(summary.afiliados_ativos),
      cliques: number(summary.cliques),
      vendas_atribuidas: number(summary.vendas_atribuidas),
      comissoes_pendentes: number(summary.comissoes_pendentes),
      comissoes_disponiveis: number(summary.comissoes_disponiveis),
      saques_pendentes: number(summary.saques_pendentes),
    },
    programs: payload?.programs || [],
    affiliates: payload?.affiliates || [],
    payouts: payload?.payouts || [],
  };
}

export function AffiliateAdminModule() {
  const [tab, setTab] = useState<AffiliateAdminTab>('programas');
  const [snapshot, setSnapshot] = useState(() => ({ summary: EMPTY_SUMMARY, programs: [] as AffiliateProgram[], affiliates: [] as AffiliateRecord[], payouts: [] as AffiliatePayout[] }));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateRecord | null>(null);
  const [isEditingAffiliate, setIsEditingAffiliate] = useState(false);
  const [editAffiliateForm, setEditAffiliateForm] = useState({
    nome_divulgacao: '',
    codigo_publico: '',
    pix_tipo: 'cpf',
    pix_chave: '',
  });
  const [savingAffiliateDetails, setSavingAffiliateDetails] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const confirmHook = useConfirm();

  const startEditingAffiliate = (affiliate: AffiliateRecord) => {
    setEditAffiliateForm({
      nome_divulgacao: affiliate.nome_divulgacao || '',
      codigo_publico: affiliate.codigo_publico || '',
      pix_tipo: affiliate.pix_tipo || 'cpf',
      pix_chave: affiliate.pix_chave || affiliate.pix_chave_mascarada || '',
    });
    setIsEditingAffiliate(true);
  };

  const saveAffiliateDetails = async () => {
    if (!selectedAffiliate) return;
    if (!editAffiliateForm.nome_divulgacao.trim()) {
      toast.error('Informe o nome de divulgação.');
      return;
    }
    setSavingAffiliateDetails(true);
    try {
      await callAdminRpc('gsa_admin_update_affiliate_details', {
        p_affiliate_id: selectedAffiliate.id,
        p_nome_divulgacao: editAffiliateForm.nome_divulgacao.trim(),
        p_codigo_publico: editAffiliateForm.codigo_publico.trim() || null,
        p_pix_tipo: editAffiliateForm.pix_tipo || null,
        p_pix_chave: editAffiliateForm.pix_chave.trim() || null,
      });
      toast.success('Cadastro do afiliado atualizado com sucesso.');
      setIsEditingAffiliate(false);
      setSelectedAffiliate(null);
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o cadastro do afiliado.');
    } finally {
      setSavingAffiliateDetails(false);
    }
  };

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const data = await callAdminRpc<AffiliateAdminSnapshot>('gsa_admin_affiliate_snapshot');
      setSnapshot(normalizeSnapshot(data));
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar o programa de afiliados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const filteredAffiliates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return snapshot.affiliates;
    return snapshot.affiliates.filter((affiliate) =>
      [affiliate.nome_divulgacao, affiliate.codigo_publico, affiliate.status]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query)),
    );
  }, [search, snapshot.affiliates]);

  const setAffiliateStatus = async (affiliate: AffiliateRecord, status: 'ativo' | 'suspenso' | 'encerrado') => {
    if (affiliate.status === status) return;
    const label = status === 'ativo' ? 'reativar' : status === 'suspenso' ? 'suspender' : 'encerrar';
    const ok = await confirmHook.confirm({
      title: 'Alterar status',
      message: `Deseja ${label} o afiliado ${affiliate.nome_divulgacao}?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    setWorkingId(affiliate.id);
    try {
      await callAdminRpc('gsa_admin_set_affiliate_status', {
        p_affiliate_id: affiliate.id,
        p_status: status,
        p_reason: `Alteração realizada no painel administrativo: ${status}`,
      });
      toast.success('Status do afiliado atualizado.');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar o status.');
    } finally {
      setWorkingId(null);
    }
  };

  const decidePayout = async (payout: AffiliatePayout, action: 'approve' | 'reject' | 'mark_paid') => {
    const label = action === 'approve' ? 'aprovar' : action === 'reject' ? 'rejeitar' : 'confirmar o pagamento de';
    const ok = await confirmHook.confirm({
      title: 'Confirmar ação',
      message: `Deseja ${label} ${formatCurrency(number(payout.valor))}?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;

    let notes = `Ação ${action} realizada no painel administrativo.`;
    if (action === 'reject') {
      const promptResult = await confirmHook.confirm({
        title: 'Motivo da rejeição',
        message: 'Informe o motivo da rejeição:',
        promptLabel: 'Motivo',
        promptRequired: true,
      });
      if (!promptResult) return;
      notes = (promptResult as string).trim();
    }

    setWorkingId(payout.id);
    try {
      await callAdminRpc('gsa_admin_decide_affiliate_payout', {
        p_payout_id: payout.id,
        p_action: action,
        p_notes: notes || null,
        p_paid_at: action === 'mark_paid' ? new Date().toISOString() : null,
      });
      toast.success('Solicitação de saque atualizada.');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível processar o saque.');
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-neutral-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /><span className="sr-only">Carregando afiliados</span></div>;
  }

  const cards = [
    { label: 'Afiliados ativos', value: snapshot.summary.afiliados_ativos.toLocaleString('pt-BR'), icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Vendas atribuídas', value: snapshot.summary.vendas_atribuidas.toLocaleString('pt-BR'), icon: Link2, color: 'text-sky-600 bg-sky-50' },
    { label: 'Em carência', value: formatCurrency(snapshot.summary.comissoes_pendentes), icon: Clock3, color: 'text-amber-600 bg-amber-50' },
    { label: 'Disponível', value: formatCurrency(snapshot.summary.comissoes_disponiveis), icon: Banknote, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <section className="space-y-5" aria-labelledby="affiliate-admin-title">
      <ConfirmDialog {...confirmHook} />
      <div className="rounded-[2rem] bg-gradient-to-br from-neutral-950 via-neutral-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-300">Gestão central</p><h1 id="affiliate-admin-title" className="mt-2 text-2xl font-black">Programa de Afiliados GSA</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Regras, afiliados e pagamentos conectados ao mesmo backend do portal do afiliado.</p></div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span><p className="mt-3 text-xl font-black text-neutral-950">{value}</p><p className="mt-1 text-xs font-bold text-neutral-500">{label}</p></article>)}</div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm" role="tablist">
        {([
          ['programas', 'Programas e regras', BadgePercent],
          ['afiliados', 'Afiliados', UserRoundCheck],
          ['saques', `Saques${snapshot.summary.saques_pendentes ? ` (${snapshot.summary.saques_pendentes})` : ''}`, Banknote],
        ] as const).map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black sm:flex-none ${tab === id ? 'bg-neutral-950 text-white shadow' : 'text-neutral-600 hover:bg-neutral-50'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>

      {tab === 'programas' && <div className="grid gap-4 xl:grid-cols-2">{snapshot.programs.map((program) => <ProgramEditor key={program.id} program={program} onSaved={() => load(true)} />)}{snapshot.programs.length === 0 && <EmptyState text="Nenhum programa cadastrado." />}</div>}

      {tab === 'afiliados' && (
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 p-4">
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <span className="sr-only">Buscar afiliado</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, código ou status" className="w-full rounded-xl border border-neutral-200 py-2.5 pl-10 pr-3 text-sm" />
            </label>
          </div>
          <div className="divide-y divide-neutral-100">
            {filteredAffiliates.map((affiliate) => (
              <article 
                key={affiliate.id} 
                onClick={() => setSelectedAffiliate(affiliate)}
                className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(100px,.6fr))_auto] lg:items-center cursor-pointer hover:bg-neutral-50/90 transition-colors group"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-neutral-950 group-hover:text-indigo-600 transition-colors">{affiliate.nome_divulgacao}</h3>
                    <StatusBadge status={affiliate.status} />
                  </div>
                  <p className="mt-1 text-xs font-bold text-neutral-400">Código {affiliate.codigo_publico || '—'} · {affiliate.created_at ? formatDateTime(affiliate.created_at) : '—'}</p>
                </div>
                <Metric label="Cliques" value={number(affiliate.cliques).toLocaleString('pt-BR')} />
                <Metric label="Conversões" value={number(affiliate.conversoes).toLocaleString('pt-BR')} />
                <Metric label="Disponível" value={formatCurrency(number(affiliate.saldo_disponivel))} />
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setSelectedAffiliate(affiliate); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-600 transition-colors shadow-2xs"
                  >
                    <Eye className="h-4 w-4" /> Detalhes
                  </button>
                </div>
              </article>
            ))}
            {filteredAffiliates.length === 0 && <EmptyState text="Nenhum afiliado encontrado." />}
          </div>
        </div>
      )}

      {tab === 'saques' && <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"><div className="divide-y divide-neutral-100">{snapshot.payouts.map((payout) => <article key={payout.id} className="grid gap-4 p-4 lg:grid-cols-[1.3fr_.7fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-neutral-950">{payout.afiliado_nome || 'Afiliado'}</h3><StatusBadge status={payout.status} /></div><p className="mt-1 text-xs font-bold text-neutral-400">{payout.solicitado_em ? formatDateTime(payout.solicitado_em) : '—'}</p></div><Metric label="Valor" value={formatCurrency(number(payout.valor))} /><Metric label={`PIX ${payout.pix_tipo || ''}`} value={payout.pix_chave || 'Chave protegida'} /><div className="flex flex-wrap gap-2 lg:justify-end">{payout.status === 'solicitado' && <><SmallAction disabled={workingId === payout.id} onClick={() => void decidePayout(payout, 'approve')} tone="green" label="Aprovar" icon="check" /><SmallAction disabled={workingId === payout.id} onClick={() => void decidePayout(payout, 'reject')} tone="red" label="Rejeitar" icon="x" /></>}{payout.status === 'aprovado' && <SmallAction disabled={workingId === payout.id} onClick={() => void decidePayout(payout, 'mark_paid')} tone="green" label="Confirmar PIX" icon="shield" />}</div></article>)}{snapshot.payouts.length === 0 && <EmptyState text="Nenhuma solicitação de saque." />}</div></div>}

      {/* Modal de Detalhes do Afiliado */}
      <Modal
        isOpen={Boolean(selectedAffiliate)}
        onClose={() => {
          setSelectedAffiliate(null);
          setIsEditingAffiliate(false);
        }}
        title={isEditingAffiliate ? "Editar Cadastro do Afiliado" : "Detalhes do Afiliado"}
        size="lg"
      >
        {selectedAffiliate && isEditingAffiliate && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
              <h4 className="text-sm font-black text-indigo-900 mb-1 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-indigo-600" /> Edição Cadastral do Afiliado
              </h4>
              <p className="text-xs text-indigo-700">Edite as informações cadastrais e de pagamento abaixo. As alterações serão salvas no sistema.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-neutral-700">
                Nome de Divulgação
                <input
                  type="text"
                  value={editAffiliateForm.nome_divulgacao}
                  onChange={(e) => setEditAffiliateForm(prev => ({ ...prev, nome_divulgacao: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-bold focus:border-indigo-600 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-bold text-neutral-700">
                Código de Indicação
                <input
                  type="text"
                  value={editAffiliateForm.codigo_publico}
                  onChange={(e) => setEditAffiliateForm(prev => ({ ...prev, codigo_publico: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-mono text-sm font-bold text-indigo-700 focus:border-indigo-600 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-bold text-neutral-700">
                Tipo da Chave PIX
                <select
                  value={editAffiliateForm.pix_tipo}
                  onChange={(e) => setEditAffiliateForm(prev => ({ ...prev, pix_tipo: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-bold focus:border-indigo-600 focus:outline-none"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave Aleatória</option>
                </select>
              </label>

              <label className="block text-xs font-bold text-neutral-700">
                Chave PIX (Completa)
                <input
                  type="text"
                  value={editAffiliateForm.pix_chave}
                  onChange={(e) => setEditAffiliateForm(prev => ({ ...prev, pix_chave: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-mono text-sm font-bold focus:border-indigo-600 focus:outline-none"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => setIsEditingAffiliate(false)}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingAffiliateDetails}
                onClick={() => void saveAffiliateDetails()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingAffiliateDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        )}

        {selectedAffiliate && !isEditingAffiliate && (
          <div className="space-y-6">
            {/* Header & Status Card */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Nome de Divulgação</span>
                  <h3 className="text-xl font-black text-neutral-950 mt-0.5">{selectedAffiliate.nome_divulgacao}</h3>
                  <p className="text-xs font-bold text-neutral-500 mt-1">
                    Código de Indicação: <span className="font-mono text-indigo-700 font-extrabold">{selectedAffiliate.codigo_publico || '—'}</span>
                  </p>
                </div>
                <StatusBadge status={selectedAffiliate.status} />
              </div>
              <div className="mt-4 grid gap-3 border-t border-neutral-200/80 pt-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-neutral-400 font-medium">Data de Cadastro:</span>{' '}
                  <strong className="text-neutral-800">{selectedAffiliate.created_at ? formatDateTime(selectedAffiliate.created_at) : '—'}</strong>
                </div>
                <div>
                  <span className="text-neutral-400 font-medium">ID da Conta / Cliente:</span>{' '}
                  <strong className="font-mono text-neutral-800 break-all">{selectedAffiliate.cliente_id || selectedAffiliate.id}</strong>
                </div>
              </div>
            </div>

            {/* Dados Pessoais do Titular */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <UserRoundCheck className="h-4 w-4 text-indigo-600" /> Dados Pessoais do Titular (Cliente)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">Nome Completo</span>
                  <strong className="text-neutral-900 font-bold text-sm">{selectedAffiliate.cliente_nome_completo || selectedAffiliate.nome_divulgacao}</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">CPF / CNPJ</span>
                  <strong className="text-indigo-700 font-mono font-bold text-sm">{selectedAffiliate.cliente_cpf || selectedAffiliate.cliente_cnpj || 'Não informado'}</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">E-mail</span>
                  <strong className="text-neutral-800 font-medium break-all">{selectedAffiliate.cliente_email || 'Não informado'}</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">Telefone / WhatsApp</span>
                  <strong className="text-neutral-800 font-medium">{selectedAffiliate.cliente_telefone || 'Não informado'}</strong>
                </div>
              </div>
            </div>

            {/* Performance & Financeiro */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-indigo-600" /> Desempenho & Saldo acumulado
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Cliques</p>
                  <p className="mt-1 text-lg font-black text-neutral-900">{number(selectedAffiliate.cliques).toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Conversões</p>
                  <p className="mt-1 text-lg font-black text-indigo-700">{number(selectedAffiliate.conversoes).toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Comissão Gerada</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{formatCurrency(number(selectedAffiliate.comissao_total))}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Saldo Disponível</p>
                  <p className="mt-1 text-lg font-black text-emerald-600">{formatCurrency(number(selectedAffiliate.saldo_disponivel))}</p>
                </div>
              </div>
            </div>

            {/* Dados Bancários / PIX */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600" /> Dados para Pagamento (PIX)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">Tipo de Chave</span>
                  <strong className="text-neutral-800 font-bold uppercase">{selectedAffiliate.pix_tipo || 'Não informado'}</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60">
                  <span className="block text-[10px] font-black uppercase text-neutral-400">Chave PIX</span>
                  <strong className="text-indigo-700 font-mono font-bold break-all">{selectedAffiliate.pix_chave || selectedAffiliate.pix_chave_mascarada || 'Não informada'}</strong>
                </div>
              </div>
            </div>

            {/* Gerenciamento de Status & Ações */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-500 block">Ações Administrativas</span>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startEditingAffiliate(selectedAffiliate)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
                >
                  <Pencil className="h-4 w-4" /> Editar Cadastro
                </button>
                {selectedAffiliate.status !== 'ativo' && (
                  <button
                    type="button"
                    disabled={workingId === selectedAffiliate.id}
                    onClick={async () => {
                      const aff = selectedAffiliate;
                      setSelectedAffiliate(null);
                      await setAffiliateStatus(aff, 'ativo');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Ativar Afiliado
                  </button>
                )}
                {selectedAffiliate.status === 'ativo' && (
                  <button
                    type="button"
                    disabled={workingId === selectedAffiliate.id}
                    onClick={async () => {
                      const aff = selectedAffiliate;
                      setSelectedAffiliate(null);
                      await setAffiliateStatus(aff, 'suspenso');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Suspender Afiliado
                  </button>
                )}
                {selectedAffiliate.status !== 'encerrado' && (
                  <button
                    type="button"
                    disabled={workingId === selectedAffiliate.id}
                    onClick={async () => {
                      const aff = selectedAffiliate;
                      setSelectedAffiliate(null);
                      await setAffiliateStatus(aff, 'encerrado');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Encerrar Afiliado
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAffiliate(null)}
                  className="ml-auto rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function ProgramEditor({ program, onSaved }: { key?: string; program: AffiliateProgram; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(program);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(program), [program]);

  const save = async () => {
    setSaving(true);
    try {
      await callAdminRpc('gsa_admin_update_affiliate_program', {
        p_program_id: program.id,
        p_patch: {
          descricao: draft.descricao || null,
          caminho_padrao: draft.caminho_padrao || '/',
          base_tipo: draft.base_tipo || 'venda_bruta',
          percentual: number(draft.percentual),
          janela_atribuicao_dias: number(draft.janela_atribuicao_dias),
          carencia_dias: number(draft.carencia_dias),
          saque_minimo: number(draft.saque_minimo),
          pontos_por_real: number(draft.pontos_por_real ?? 1),
          ativo: draft.ativo,
        },
      });
      toast.success(`Programa ${draft.nome} atualizado.`);
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o programa.');
    } finally {
      setSaving(false);
    }
  };

  return <article className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">{draft.codigo}</p><h3 className="mt-1 text-lg font-black text-neutral-950">{draft.nome}</h3></div><button type="button" onClick={() => setDraft((current) => ({ ...current, ativo: !current.ativo }))} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${draft.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{draft.ativo ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}{draft.ativo ? 'Ativo' : 'Pausado'}</button></div><label className="mt-4 block text-xs font-bold text-neutral-600">Descrição<textarea rows={2} value={draft.descricao || ''} onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm" /></label><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5"><NumberField label="Comissão (%)" value={draft.percentual} min={0.01} max={50} step={0.01} onChange={(value) => setDraft((current) => ({ ...current, percentual: value }))} /><NumberField label="Pontos/R$" value={draft.pontos_por_real ?? 1} min={0} max={100} step={0.1} onChange={(value) => setDraft((current) => ({ ...current, pontos_por_real: value }))} /><NumberField label="Janela" value={draft.janela_atribuicao_dias} min={1} max={365} onChange={(value) => setDraft((current) => ({ ...current, janela_atribuicao_dias: value }))} /><NumberField label="Carência" value={draft.carencia_dias} min={0} max={365} onChange={(value) => setDraft((current) => ({ ...current, carencia_dias: value }))} /><NumberField label="Saque mínimo" value={draft.saque_minimo} min={0} max={100000} onChange={(value) => setDraft((current) => ({ ...current, saque_minimo: value }))} /></div><label className="mt-3 block text-xs font-bold text-neutral-600">Caminho padrão<input value={draft.caminho_padrao || ''} onChange={(event) => setDraft((current) => ({ ...current, caminho_padrao: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 font-mono text-sm" /></label><button type="button" onClick={() => void save()} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar regras</button></article>;
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return <label className="text-xs font-bold text-neutral-600">{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-bold" /></label>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'ativo' || status === 'pago' ? 'bg-emerald-50 text-emerald-700' : status === 'rejeitado' || status === 'encerrado' ? 'bg-rose-50 text-rose-700' : status === 'aprovado' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>{status.replaceAll('_', ' ')}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 break-all text-sm font-black text-neutral-800">{value}</p></div>;
}

function SmallAction({ label, onClick, disabled, tone, icon }: { label: string; onClick: () => void; disabled?: boolean; tone: 'green' | 'amber' | 'red'; icon?: 'check' | 'x' | 'shield' }) {
  const colors = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700' };
  const Icon = icon === 'check' ? CheckCircle2 : icon === 'x' ? XCircle : icon === 'shield' ? ShieldCheck : null;
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase disabled:opacity-50 ${colors[tone]}`}>{disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</button>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="col-span-full flex min-h-40 items-center justify-center p-8 text-center text-sm font-bold text-neutral-400">{text}</div>;
}
