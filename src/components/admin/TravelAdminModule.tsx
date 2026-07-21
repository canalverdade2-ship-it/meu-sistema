import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  Loader2,
  PackagePlus,
  Plane,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  Users,
  Eye,
  XCircle,
  ArrowRight,
  User,
  Mail,
  Phone,
  Calendar,
  Compass,
  Sparkles,
  Edit,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  Zap,
  Coins,
  Wallet,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';

type AdminTab = 'solicitacoes' | 'pacotes' | 'propostas' | 'transacoes';

const accommodationLabels: Record<string, string> = {
  economico: 'Econômico',
  '4_estrelas': 'Conforto (4 Estrelas)',
  '5_estrelas': 'Luxo (5 Estrelas)',
  resort_all_inclusive: 'Resort All Inclusive',
  indiferente: 'Melhor Oportunidade / Indiferente',
};

const flexibilityLabels: Record<string, string> = {
  exata: 'Datas Exatas',
  '3_dias': '± 3 Dias de flexibilidade',
  '7_dias': '± 7 Dias de flexibilidade',
  mes: 'Qualquer dia no mês',
};

function formatCurrencyInputValue(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/\./g, '').replace(',', '.'));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function handleCurrencyMask(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (!clean) return '';
  const cents = Number(clean) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents);
}

interface PagedResult {
  items: any[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 20;
const inputClass = 'w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-wider text-neutral-500';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = String(status || 'sem_status');
  const colors: Record<string, string> = {
    recebido: 'bg-blue-100 text-blue-700',
    em_analise: 'bg-amber-100 text-amber-700',
    buscando_opcoes: 'bg-violet-100 text-violet-700',
    propostas_disponiveis: 'bg-emerald-100 text-emerald-700',
    aguardando_cliente: 'bg-orange-100 text-orange-700',
    encerrado: 'bg-neutral-100 text-neutral-700',
    cancelado: 'bg-red-100 text-red-700',
    rascunho: 'bg-neutral-100 text-neutral-700',
    publicado: 'bg-emerald-100 text-emerald-700',
    disponibilidade_sob_consulta: 'bg-sky-100 text-sky-700',
    pausado: 'bg-amber-100 text-amber-700',
    esgotado: 'bg-red-100 text-red-700',
    enviada: 'bg-blue-100 text-blue-700',
    visualizada: 'bg-sky-100 text-sky-700',
    aceita: 'bg-emerald-100 text-emerald-700',
    recusada: 'bg-red-100 text-red-700',
    expirada: 'bg-neutral-100 text-neutral-600',
    pendente: 'bg-yellow-100 text-yellow-800',
    pagamento_confirmado: 'bg-blue-100 text-blue-800',
    viagem_confirmada: 'bg-emerald-100 text-emerald-800',
    concluida: 'bg-neutral-100 text-neutral-800',
    reembolso_em_analise: 'bg-amber-100 text-amber-800 border border-amber-300',
    reembolso_solicitado: 'bg-amber-100 text-amber-800 border border-amber-300',
    reembolsada: 'bg-purple-100 text-purple-800 border border-purple-200',
    reembolso_aprovado: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    reembolso_negado: 'bg-rose-100 text-rose-800 border border-rose-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${colors[value] || 'bg-neutral-100 text-neutral-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
      <p className="text-xs font-bold text-neutral-400">Página {page} de {totalPages} · {total} registros</p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-xl border border-neutral-200 p-2 text-neutral-600 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-xl border border-neutral-200 p-2 text-neutral-600 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function TravelAdminModule() {
  const [activeTab, setActiveTab] = useState<AdminTab>('solicitacoes');
  const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
    { id: 'solicitacoes', label: 'Orçamentos', icon: Users },
    { id: 'pacotes', label: 'Pacotes', icon: Plane },
    { id: 'propostas', label: 'Propostas', icon: FileText },
    { id: 'transacoes', label: 'Reservas & Transações', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-neutral-900">
          <Plane className="h-6 w-6 text-indigo-600" /> Módulo de Viagens
        </h2>
        <p className="mt-1 text-neutral-500">Operações paginadas, auditadas e executadas de forma transacional no servidor.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        {activeTab === 'solicitacoes' && <SolicitacoesTab />}
        {activeTab === 'pacotes' && <PacotesTab />}
        {activeTab === 'propostas' && <PropostasTab />}
        {activeTab === 'transacoes' && <TransacoesTab />}
      </section>
    </div>
  );
}

function usePagedTravelList(kind: AdminTab) {
  const [result, setResult] = useState<PagedResult>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc<PagedResult>('gsa_admin_travel_list', {
        p_kind: kind,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: appliedSearch || null,
      });
      setResult({
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total || 0),
        page: Number(data?.page || page),
        page_size: Number(data?.page_size || PAGE_SIZE),
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, kind, page]);

  useEffect(() => { void load(); }, [load]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  return { result, page, setPage, search, setSearch, loading, load, applySearch };
}

function Toolbar({
  title,
  subtitle,
  search,
  setSearch,
  applySearch,
  loading,
  refresh,
  action,
}: {
  title: string;
  subtitle: string;
  search: string;
  setSearch: (value: string) => void;
  applySearch: () => void;
  loading: boolean;
  refresh: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div><h3 className="text-lg font-bold">{title}</h3><p className="text-sm text-neutral-500">{subtitle}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          {action}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }} placeholder="Buscar por protocolo, cliente, origem ou destino" className={`${inputClass} pl-10`} /></div>
        <button type="button" onClick={applySearch} className="rounded-xl bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700">Buscar</button>
      </div>
    </div>
  );
}

function SolicitacoesTab() {
  const list = usePagedTravelList('solicitacoes');
  const [selected, setSelected] = useState<any>(null);
  const [detailsItem, setDetailsItem] = useState<any>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [linkingLead, setLinkingLead] = useState<any>(null);
  const [savingProposal, setSavingProposal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [proposalForm, setProposalForm] = useState({ titulo: '', valor_total: '', parcelamento_permitido: '1', validade_horas: '48', prazo_pagamento_dias: '2', condicoes: '' });

  useEffect(() => {
    if (!detailsItem) {
      setClientDetails(null);
      return;
    }

    if (detailsItem.cliente_id) {
      supabase
        .from('clientes')
        .select('id, nome, email, telefone, codigo_cliente')
        .eq('id', detailsItem.cliente_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setClientDetails(data);
        });
    } else {
      const searchEmail = detailsItem.email?.trim();
      const searchPhone = detailsItem.telefone?.trim();

      if (searchEmail || searchPhone) {
        let query = supabase.from('clientes').select('id, nome, email, telefone, codigo_cliente');
        if (searchEmail && searchPhone) {
          query = query.or(`email.eq.${searchEmail},telefone.eq.${searchPhone}`);
        } else if (searchEmail) {
          query = query.eq('email', searchEmail);
        } else if (searchPhone) {
          query = query.eq('telefone', searchPhone);
        }

        query.limit(1).maybeSingle().then(({ data }) => {
          if (data) {
            setClientDetails(data);
            callAdminRpc('gsa_admin_travel_link_lead', { p_quote_id: detailsItem.id, p_client_id: data.id })
              .then(() => {
                setDetailsItem((prev: any) => prev ? { ...prev, cliente_id: data.id } : null);
                toast.success(`Cliente ${data.nome} vinculado automaticamente ao orçamento!`);
                void list.load();
              })
              .catch(() => {});
          }
        });
      }
    }
  }, [detailsItem?.id]);

  const openProposal = (quote: any) => {
    if (['propostas_disponiveis', 'proposta_disponivel', 'aguardando_cliente'].includes(quote.status)) {
      return toast.error('Uma proposta já foi enviada para este orçamento.');
    }
    if (['cancelado', 'encerrado'].includes(quote.status)) {
      return toast.error('Não é possível gerar proposta para uma solicitação cancelada ou encerrada.');
    }
    if (!quote.cliente_id) {
      setLinkingLead(quote);
      setClientSearch(quote.email || quote.telefone || quote.nome || '');
      setClientResults([]);
      return;
    }
    setSelected(quote);
    const initialTotal = quote.viagens_pacotes?.preco_venda != null
      ? formatCurrencyInputValue(quote.viagens_pacotes.preco_venda)
      : '';
    setProposalForm({
      titulo: quote.viagens_pacotes?.titulo || `Viagem para ${quote.destino}`,
      valor_total: initialTotal,
      parcelamento_permitido: '1',
      validade_horas: '48',
      prazo_pagamento_dias: '2',
      condicoes: 'Valores sujeitos à disponibilidade até a confirmação do pagamento.',
    });
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await callAdminRpc('gsa_admin_travel_update_status', { p_entity: 'orcamento', p_id: id, p_status: status });
      toast.success('Status atualizado.');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o status.');
    }
  };

  const searchClients = async () => {
    const value = clientSearch.trim();
    if (value.length < 3) return toast.error('Digite pelo menos 3 caracteres.');
    setSearchingClients(true);
    try {
      const data = await callAdminRpc<any[]>('gsa_admin_search_clients', { p_search: value, p_limit: 10 });
      setClientResults(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao pesquisar clientes.');
    } finally {
      setSearchingClients(false);
    }
  };

  const linkClient = async (client: any) => {
    try {
      await callAdminRpc('gsa_admin_travel_link_lead', { p_quote_id: linkingLead.id, p_client_id: client.id });
      toast.success(`Lead vinculado a ${client.nome}.`);
      const linked = { ...linkingLead, cliente_id: client.id };
      setLinkingLead(null);
      await list.load();
      openProposal(linked);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível vincular o cliente.');
    }
  };

  const createProposal = async () => {
    const total = Number(proposalForm.valor_total.replace(/\./g, '').replace(',', '.'));
    if (!proposalForm.titulo.trim() || !Number.isFinite(total) || total <= 0) return toast.error('Informe título e valor total válidos.');
    setSavingProposal(true);
    try {
      await callAdminRpc('gsa_admin_travel_create_proposal', {
        p_quote_id: selected.id,
        p_title: proposalForm.titulo.trim(),
        p_total: total,
        p_max_installments: Number(proposalForm.parcelamento_permitido || 1),
        p_acceptance_hours: Number(proposalForm.validade_horas || 48),
        p_payment_days: Number(proposalForm.prazo_pagamento_dias || 2),
        p_conditions: proposalForm.condicoes.trim() || null,
      });
      toast.success('Proposta criada e disponibilizada ao cliente.');
      setSelected(null);
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível criar a proposta.');
    } finally {
      setSavingProposal(false);
    }
  };

  return (
    <div>
      <Toolbar title="Solicitações de orçamento" subtitle="Leads públicos e solicitações de clientes." {...list} refresh={() => void list.load()} />
      {list.loading ? <Loading /> : list.result.items.length === 0 ? <Empty text="Nenhuma solicitação encontrada." /> : (
        <div className="space-y-3">
          {list.result.items.map((quote) => (
            <article key={quote.id} className="rounded-2xl border border-neutral-200 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={quote.status} /><span className="text-xs font-bold text-neutral-400">{quote.protocolo}</span>{!quote.cliente_id && <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">Lead público</span>}</div>
                  <h4 className="truncate text-lg font-black text-neutral-900">{quote.viagens_pacotes?.titulo || `${quote.origem} → ${quote.destino}`}</h4>
                  <p className="mt-1 text-sm text-neutral-500">{quote.nome || 'Cliente cadastrado'} · {quote.email || quote.telefone || 'Contato pelo cadastro'} · {formatDate(quote.created_at)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setDetailsItem(quote)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-200">
                    <Eye className="h-4 w-4" /> Detalhes
                  </button>
                  {['propostas_disponiveis', 'proposta_disponivel', 'aguardando_cliente'].includes(quote.status) ? (
                    <button
                      type="button"
                      disabled
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-black text-emerald-700 cursor-not-allowed opacity-90"
                      title="Uma proposta já foi enviada ao cliente para este orçamento"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Proposta enviada
                    </button>
                  ) : ['cancelado', 'encerrado'].includes(quote.status) ? (
                    <button 
                      type="button" 
                      disabled
                      className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 border border-neutral-200 px-4 py-2 text-xs font-black text-neutral-400 cursor-not-allowed"
                      title="Solicitação cancelada ou encerrada"
                    >
                      Solicitação {quote.status === 'cancelado' ? 'cancelada' : 'encerrada'}
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => openProposal(quote)} 
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition"
                    >
                      {quote.cliente_id ? <Send className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                      {quote.cliente_id ? 'Gerar proposta' : 'Vincular cliente'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />

      <Modal isOpen={Boolean(linkingLead)} onClose={() => setLinkingLead(null)} title="Vincular lead a cliente" size="lg">
        {linkingLead && <div className="space-y-5">
          <div className="rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900"><strong>{linkingLead.nome}</strong><br />{linkingLead.email} · {linkingLead.telefone}</div>
          <div className="flex gap-2"><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchClients(); }} placeholder="Nome, e-mail, telefone ou código" className={inputClass} /><button type="button" onClick={() => void searchClients()} disabled={searchingClients} className="rounded-xl bg-indigo-600 px-5 font-black text-white disabled:opacity-60">{searchingClients ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buscar'}</button></div>
          <div className="space-y-2">{clientResults.map((client) => <button type="button" key={client.id} onClick={() => void linkClient(client)} className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50"><div><p className="font-black text-neutral-900">{client.nome}</p><p className="text-sm text-neutral-500">{client.email || client.telefone} · {client.codigo_cliente}</p></div><span className="text-xs font-black uppercase text-indigo-600">Selecionar</span></button>)}</div>
        </div>}
      </Modal>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Gerar proposta de viagem" size="xl">
        {selected && <div className="space-y-5">
          <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600"><strong>{selected.protocolo}</strong> · {selected.origem} → {selected.destino} · {selected.adultos || 1} adulto(s)</div>
          <label className={labelClass}>Título da proposta<input value={proposalForm.titulo} onChange={(event) => setProposalForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Valor total<input value={proposalForm.valor_total} onChange={(event) => setProposalForm((value) => ({ ...value, valor_total: handleCurrencyMask(event.target.value) }))} placeholder="0,00" className={`${inputClass} mt-2`} /></label><label className={labelClass}>Parcelamento máximo<input type="number" min="1" max="24" value={proposalForm.parcelamento_permitido} onChange={(event) => setProposalForm((value) => ({ ...value, parcelamento_permitido: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Validade do aceite (horas)<input type="number" min="1" value={proposalForm.validade_horas} onChange={(event) => setProposalForm((value) => ({ ...value, validade_horas: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Prazo para pagamento (dias)<input type="number" min="1" value={proposalForm.prazo_pagamento_dias} onChange={(event) => setProposalForm((value) => ({ ...value, prazo_pagamento_dias: event.target.value }))} className={`${inputClass} mt-2`} /></label></div>
          <label className={labelClass}>Condições<textarea rows={4} value={proposalForm.condicoes} onChange={(event) => setProposalForm((value) => ({ ...value, condicoes: event.target.value }))} className={`${inputClass} mt-2 h-auto`} /></label>
          <button type="button" onClick={() => void createProposal()} disabled={savingProposal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white hover:bg-indigo-700 disabled:opacity-60">{savingProposal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{savingProposal ? 'Criando proposta...' : 'Enviar proposta ao cliente'}</button>
        </div>}
      </Modal>

      {detailsItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailsItem(null)}>
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-neutral-100" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <header className="relative flex items-center justify-between border-b border-neutral-100 bg-slate-900 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 backdrop-blur-md">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold tracking-wider text-indigo-300 uppercase">{detailsItem.protocolo || 'SOLICITAÇÃO'}</span>
                    <StatusBadge status={detailsItem.status} />
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">Solicitação de Viagem</h2>
                </div>
              </div>
              <button 
                onClick={() => setDetailsItem(null)} 
                className="rounded-full bg-white/10 p-2 text-neutral-300 hover:bg-white/20 hover:text-white transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/50">
              {/* Route & Package Highlight Card */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white p-5 shadow-xs">
                <div className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5">
                  <Compass className="h-4 w-4" /> Rota & Destino
                </div>
                
                {detailsItem.viagens_pacotes?.titulo && (
                  <p className="text-xs font-bold text-neutral-500 mb-2">Pacote: <span className="text-neutral-900 font-extrabold">{detailsItem.viagens_pacotes.titulo}</span></p>
                )}

                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Origem</p>
                    <p className="text-lg font-black text-neutral-900">{detailsItem.origem || 'Não especificada'}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-200 shrink-0">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Destino</p>
                    <p className="text-lg font-black text-neutral-900">{detailsItem.destino || 'Não especificado'}</p>
                  </div>
                </div>

                {/* Quick Info Chips */}
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-indigo-100/60">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 border border-neutral-200/80 shadow-2xs">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{detailsItem.adultos || 1} Adulto(s)</span>
                  </div>
                  {detailsItem.criancas > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 border border-neutral-200/80 shadow-2xs">
                      <span>{detailsItem.criancas} Criança(s)</span>
                    </div>
                  )}
                  {detailsItem.bebes > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 border border-neutral-200/80 shadow-2xs">
                      <span>{detailsItem.bebes} Bebê(s)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-500 border border-neutral-200/80 shadow-2xs ml-auto">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{formatDate(detailsItem.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Contact Box */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-indigo-600" /> Informações de Contato
                  </h4>
                  {(detailsItem.cliente_id || clientDetails?.id) ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200">
                      Cliente Cadastrado {clientDetails?.codigo_cliente ? `(${clientDetails.codigo_cliente})` : ''}
                    </span>
                  ) : (
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-700 border border-cyan-200">
                      Lead Público
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <User className="h-5 w-5 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Nome Completo</p>
                      <p className="text-sm font-bold text-neutral-900">{clientDetails?.nome || detailsItem.nome || (detailsItem.cliente_id ? 'Cliente Cadastrado' : 'Cliente não identificado')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <Mail className="h-5 w-5 text-neutral-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">E-mail</p>
                      <p className="text-sm font-bold text-neutral-900 truncate">{clientDetails?.email || detailsItem.email || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3 border border-neutral-100 sm:col-span-2">
                    <Phone className="h-5 w-5 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Telefone / WhatsApp</p>
                      <p className="text-sm font-bold text-neutral-900">{clientDetails?.telefone || detailsItem.telefone || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Travel Dates & Preferences */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" /> Período & Preferências da Viagem
                </h4>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Data de Ida</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{detailsItem.data_ida ? formatDate(detailsItem.data_ida) : 'A definir'}</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Data de Volta</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{detailsItem.data_volta ? formatDate(detailsItem.data_volta) : 'A definir'}</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Flexibilidade</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{flexibilityLabels[detailsItem.flexibilidade] || detailsItem.flexibilidade || 'Exata'}</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100 sm:col-span-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Hospedagem Preferida</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{accommodationLabels[detailsItem.preferencia_hospedagem] || detailsItem.preferencia_hospedagem || 'Não especificada'}</p>
                  </div>
                </div>
              </div>

              {/* Customer Observations / Special Notes */}
              {detailsItem.observacoes && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-amber-600" /> Observações & Solicitações do Cliente
                  </h4>
                  <p className="text-sm font-medium text-neutral-800 whitespace-pre-wrap leading-relaxed">{detailsItem.observacoes}</p>
                </div>
              )}

              {/* Extra Dynamic Details */}
              {detailsItem.detalhes && Object.keys(detailsItem.detalhes).length > 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Detalhes Específicos Adicionais
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(detailsItem.detalhes).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-bold text-neutral-900 mt-0.5">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <footer className="border-t border-neutral-100 bg-white p-5 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setDetailsItem(null)} 
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50 transition"
              >
                Fechar
              </button>

              {['propostas_disponiveis', 'proposta_disponivel', 'aguardando_cliente'].includes(detailsItem.status) ? (
                <span className="flex items-center gap-2 text-xs font-black text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Proposta já enviada ao cliente
                </span>
              ) : ['cancelado', 'encerrado'].includes(detailsItem.status) ? (
                <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-4 py-2.5 rounded-xl border border-neutral-200">
                  Solicitação {detailsItem.status === 'cancelado' ? 'Cancelada' : 'Encerrada'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const quote = detailsItem;
                    setDetailsItem(null);
                    openProposal(quote);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition"
                >
                  {detailsItem.cliente_id ? <Send className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {detailsItem.cliente_id ? 'Gerar proposta agora' : 'Vincular cliente'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function PacotesTab() {
  const list = usePagedTravelList('pacotes');
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagens, setImagens] = useState<string[]>([]);
  const [form, setForm] = useState({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1' });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (imagens.length >= 5) {
      return toast.error('Você já atingiu o limite máximo de 5 imagens.');
    }

    const availableSlots = 5 - imagens.length;
    const filesToUpload = files.slice(0, availableSlots);

    if (files.length > availableSlots) {
      toast.error(`Apenas ${availableSlots} foto(s) foram selecionadas (limite máximo de 5 fotos).`);
    }

    setUploadingImage(true);
    const newUrls: string[] = [];

    try {
      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) continue;
        const fileExt = file.name.split('.').pop();
        const fileName = `pacotes/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        let publicUrl = '';
        const { error: uploadError } = await supabase.storage
          .from('gsa-store-images')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          const { error: fallbackError } = await supabase.storage
            .from('classificados-midias')
            .upload(fileName, file, { upsert: true });

          if (fallbackError) throw uploadError;

          const res = supabase.storage.from('classificados-midias').getPublicUrl(fileName);
          publicUrl = res.data.publicUrl;
        } else {
          const res = supabase.storage.from('gsa-store-images').getPublicUrl(fileName);
          publicUrl = res.data.publicUrl;
        }

        if (publicUrl) newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        setImagens((prev) => [...prev, ...newUrls].slice(0, 5));
        toast.success(`${newUrls.length} imagem(ns) enviada(s) com sucesso!`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao enviar imagens.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImagens((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const setAsCover = (indexToCover: number) => {
    setImagens((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(indexToCover, 1);
      return [item, ...copy];
    });
  };

  const openNew = () => {
    setEditingPkg(null);
    setImagens([]);
    setForm({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1' });
    setShowForm(true);
  };

  const openEdit = (pkg: any) => {
    setEditingPkg(pkg);
    const imagesList = Array.isArray(pkg.viagens_pacote_imagens)
      ? pkg.viagens_pacote_imagens.map((i: any) => i.url).filter(Boolean)
      : [];
    setImagens(imagesList.slice(0, 5));

    setForm({
      titulo: pkg.titulo || '',
      categoria: pkg.categoria || 'nacional',
      origem: pkg.origem || '',
      destino: pkg.destino || '',
      data_ida: pkg.data_ida ? pkg.data_ida.split('T')[0] : '',
      data_volta: pkg.data_volta ? pkg.data_volta.split('T')[0] : '',
      dias: pkg.dias != null ? String(pkg.dias) : '',
      noites: pkg.noites != null ? String(pkg.noites) : '',
      preco_venda: pkg.preco_venda != null ? String(pkg.preco_venda).replace('.', ',') : '',
      parcelamento_maximo: pkg.parcelamento_maximo != null ? String(pkg.parcelamento_maximo) : '1',
    });
    setShowForm(true);
  };

  const save = async () => {
    const price = Number(form.preco_venda.replace(/\./g, '').replace(',', '.'));
    if (!form.titulo.trim() || !form.destino.trim() || !Number.isFinite(price) || price <= 0) return toast.error('Informe título, destino e preço válidos.');
    setSaving(true);
    try {
      if (editingPkg) {
        const { error } = await supabase
          .from('viagens_pacotes')
          .update({
            titulo: form.titulo.trim(),
            categoria: form.categoria,
            origem: form.origem.trim() || null,
            destino: form.destino.trim(),
            data_ida: form.data_ida || null,
            data_volta: form.data_volta || null,
            dias: form.dias ? Number(form.dias) : null,
            noites: form.noites ? Number(form.noites) : null,
            preco_venda: price,
            parcelamento_maximo: Number(form.parcelamento_maximo || 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPkg.id);

        if (error) throw new Error(error.message || 'Erro ao atualizar pacote');

        await supabase
          .from('viagens_pacote_imagens')
          .delete()
          .eq('pacote_id', editingPkg.id);

        if (imagens.length > 0) {
          const toInsert = imagens.map((url, idx) => ({
            pacote_id: editingPkg.id,
            url,
            is_capa: idx === 0,
            ordem: idx,
          }));

          await supabase.from('viagens_pacote_imagens').insert(toInsert);
        }
        toast.success('Pacote atualizado com sucesso.');
      } else {
        const payload = {
          ...form,
          preco_venda: price,
          imagem_url: imagens[0] || '',
        };
        const res = await callAdminRpc<any>('gsa_admin_travel_create_package', { p_payload: payload });
        const newPkgId = res?.id;

        if (newPkgId && imagens.length > 1) {
          const remainingImages = imagens.slice(1).map((url, idx) => ({
            pacote_id: newPkgId,
            url,
            is_capa: false,
            ordem: idx + 1,
          }));

          await supabase.from('viagens_pacote_imagens').insert(remainingImages);
        }
        toast.success('Pacote criado como rascunho.');
      }

      setShowForm(false);
      setEditingPkg(null);
      setImagens([]);
      setForm({ titulo: '', categoria: 'nacional', origem: '', destino: '', data_ida: '', data_volta: '', dias: '', noites: '', preco_venda: '', parcelamento_maximo: '1' });
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar o pacote.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await callAdminRpc('gsa_admin_travel_update_status', { p_entity: 'pacote', p_id: id, p_status: status });
      toast.success('Pacote atualizado.');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o pacote.');
    }
  };

  return <div>
    <Toolbar title="Catálogo de pacotes" subtitle="Cadastre ofertas e controle a publicação." {...list} refresh={() => void list.load()} action={<button type="button" onClick={openNew} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> Novo pacote</button>} />
    {list.loading ? <Loading /> : list.result.items.length === 0 ? <Empty text="Nenhum pacote cadastrado." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.result.items.map((pkg) => {
      const images = Array.isArray(pkg.viagens_pacote_imagens) ? pkg.viagens_pacote_imagens : [];
      const cover = images.find((image: any) => image.is_capa)?.url || images[0]?.url;
      return <article key={pkg.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white flex flex-col justify-between hover:border-indigo-300 transition shadow-2xs"><div>{cover ? <img src={cover} alt={pkg.titulo} className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-neutral-100"><Plane className="h-10 w-10 text-neutral-300" /></div>}<div className="p-5"><div className="mb-2 flex items-center justify-between gap-2"><StatusBadge status={pkg.status} /><span className="text-xs font-bold uppercase text-neutral-400">{pkg.categoria}</span></div><h4 className="line-clamp-2 font-black text-neutral-900">{pkg.titulo}</h4><p className="mt-1 text-sm text-neutral-500">{pkg.destino} · {pkg.dias || '—'} dias</p><p className="mt-4 text-lg font-black text-indigo-700">{formatCurrency(pkg.preco_venda)}</p></div></div><div className="p-5 pt-0 space-y-2"><button type="button" onClick={() => openEdit(pkg)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100"><Edit className="h-4 w-4" /> Editar / Ver Detalhes</button><select value={pkg.status} onChange={(event) => void updateStatus(pkg.id, event.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700"><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="disponibilidade_sob_consulta">Sob consulta</option><option value="pausado">Pausado</option><option value="esgotado">Esgotado</option></select></div></article>;
    })}</div>}
    <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />
    <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPkg ? "Editar Pacote de Viagem" : "Novo Pacote de Viagem"} size="xl"><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Título<input value={form.titulo} onChange={(event) => setForm((value) => ({ ...value, titulo: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Categoria<select value={form.categoria} onChange={(event) => setForm((value) => ({ ...value, categoria: event.target.value }))} className={`${inputClass} mt-2`}><option value="nacional">Nacional</option><option value="internacional">Internacional</option><option value="excursao">Excursão</option></select></label><label className={labelClass}>Origem<input value={form.origem} onChange={(event) => setForm((value) => ({ ...value, origem: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Destino<input value={form.destino} onChange={(event) => setForm((value) => ({ ...value, destino: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de ida<input type="date" value={form.data_ida} onChange={(event) => setForm((value) => ({ ...value, data_ida: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Data de volta<input type="date" value={form.data_volta} onChange={(event) => setForm((value) => ({ ...value, data_volta: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Dias<input type="number" min="1" value={form.dias} onChange={(event) => setForm((value) => ({ ...value, dias: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Noites<input type="number" min="0" value={form.noites} onChange={(event) => setForm((value) => ({ ...value, noites: event.target.value }))} className={`${inputClass} mt-2`} /></label><label className={labelClass}>Preço de venda<input value={form.preco_venda} onChange={(event) => setForm((value) => ({ ...value, preco_venda: event.target.value }))} placeholder="0,00" className={`${inputClass} mt-2`} /></label><label className={labelClass}>Parcelamento máximo<input type="number" min="1" max="24" value={form.parcelamento_maximo} onChange={(event) => setForm((value) => ({ ...value, parcelamento_maximo: event.target.value }))} className={`${inputClass} mt-2`} /></label></div>
    
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelClass}>Imagens do Pacote (Até 5 Fotos)</label>
        <span className="text-xs font-bold text-neutral-400">{imagens.length} / 5 fotos</span>
      </div>

      <div className="space-y-4">
        {imagens.length < 5 && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-sm font-bold text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 transition">
            {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> : <Upload className="h-5 w-5 text-indigo-600" />}
            <span>{uploadingImage ? 'Enviando imagens...' : 'Clique para selecionar fotos (Até 5 arquivos de uma vez)'}</span>
            <input type="file" accept="image/*" multiple onChange={(e) => void handleImageUpload(e)} disabled={uploadingImage} className="hidden" />
          </label>
        )}

        {imagens.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {imagens.map((url, idx) => (
              <div key={idx} className="relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xs group">
                <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                
                {idx === 0 ? (
                  <div className="absolute left-2 top-2 rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-md">
                    CAPA
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsCover(idx)}
                    className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition hover:bg-indigo-600"
                  >
                    Definir Capa
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute right-2 top-2 rounded-md bg-red-600 p-1.5 text-white shadow-md hover:bg-red-700 transition"
                  title="Remover foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <span className="text-[10px] font-bold uppercase text-neutral-400">Ou adicione URL direta da imagem (Pressione Enter):</span>
          <input
            placeholder="https://..."
            className={`${inputClass} mt-1`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const input = e.currentTarget;
                const val = input.value.trim();
                if (val && imagens.length < 5) {
                  setImagens((prev) => [...prev, val].slice(0, 5));
                  input.value = '';
                } else if (imagens.length >= 5) {
                  toast.error('Limite máximo de 5 imagens atingido.');
                }
              }
            }}
          />
        </div>
      </div>
    </div>

    <button type="button" onClick={() => void save()} disabled={saving || uploadingImage} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}{saving ? 'Salvando...' : editingPkg ? 'Salvar Alterações' : 'Criar pacote como rascunho'}</button></div></Modal>
  </div>;
}

function PropostasTab() {
  const list = usePagedTravelList('propostas');
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [detailsProposal, setDetailsProposal] = useState<any>(null);
  const [cancelProposal, setCancelProposal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [extensionHours, setExtensionHours] = useState('48');
  const [savingExtension, setSavingExtension] = useState(false);
  const [savingCancel, setSavingCancel] = useState(false);

  const handleReactivate = async () => {
    const hours = Number(extensionHours);
    if (!Number.isFinite(hours) || hours <= 0) return toast.error('Informe uma quantidade válida de horas.');
    setSavingExtension(true);
    try {
      const newDeadline = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { error } = await supabase
        .from('viagens_propostas')
        .update({
          prazo_aceitacao: newDeadline,
          status: 'enviada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProposal.id);

      if (error) throw new Error(error.message || 'Erro ao reativar proposta.');

      toast.success(`Proposta reativada com sucesso por mais ${hours} horas!`);
      setSelectedProposal(null);
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível reativar a proposta.');
    } finally {
      setSavingExtension(false);
    }
  };

  const handleCancelProposal = async () => {
    const reason = cancelReason.trim();
    if (reason.length < 3) return toast.error('Informe o motivo do cancelamento (mínimo de 3 caracteres).');
    setSavingCancel(true);
    try {
      const { error } = await supabase
        .from('viagens_propostas')
        .update({
          status: 'cancelada',
          motivo_cancelamento: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cancelProposal.id);

      if (error) throw new Error(error.message || 'Erro ao cancelar proposta.');

      toast.success('Proposta cancelada com sucesso.');
      setCancelProposal(null);
      setCancelReason('');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cancelar a proposta.');
    } finally {
      setSavingCancel(false);
    }
  };

  return (
    <div>
      <Toolbar 
        title="Propostas enviadas" 
        subtitle="Acompanhe validade, aceite e valores enviados. Reative ou cancele propostas a qualquer momento." 
        {...list} 
        refresh={() => void list.load()} 
      />

      {list.loading ? (
        <Loading />
      ) : list.result.items.length === 0 ? (
        <Empty text="Nenhuma proposta encontrada." />
      ) : (
        <div className="space-y-3">
          {list.result.items.map((item) => {
            const isExpired = item.status === 'expirada' || (new Date(item.prazo_aceitacao).getTime() < Date.now() && !['aceita', 'cancelada'].includes(item.status));
            const isCancelled = item.status === 'cancelada';

            return (
              <article key={item.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 p-5 lg:flex-row lg:items-center hover:border-indigo-200 transition bg-white shadow-2xs">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={isExpired && !['aceita', 'cancelada'].includes(item.status) ? 'expirada' : item.status} />
                    <span className="text-xs font-bold text-neutral-400">Criado em {formatDate(item.created_at)}</span>
                  </div>
                  <h4 className="font-black text-neutral-900 text-lg truncate">{item.cliente_nome || item.snapshot_completo?.titulo || item.protocolo || 'Proposta de Viagem'}</h4>
                  <p className="text-sm font-medium text-neutral-500">
                    Validade do aceite: <strong className={isExpired && !isCancelled ? 'text-red-600 font-bold' : 'text-neutral-800'}>{formatDateTime(item.prazo_aceitacao)}</strong>
                    {isExpired && !isCancelled && <span className="ml-2 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">Expirada</span>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  {item.valor_total != null && (
                    <p className="text-xl font-black text-indigo-700 mr-2">{formatCurrency(item.valor_total)}</p>
                  )}

                  {/* Botão Detalhes */}
                  <button
                    type="button"
                    onClick={() => setDetailsProposal(item)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-black text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    <Eye className="h-4 w-4" /> Detalhes
                  </button>

                  {/* Botão Prorrogar / Reativar */}
                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProposal(item);
                        setExtensionHours('48');
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition border ${
                        isExpired
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-2xs'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <RefreshCcw className="h-4 w-4 text-amber-600" />
                      {isExpired ? 'Reativar' : 'Prorrogar'}
                    </button>
                  )}

                  {/* Botão Cancelar */}
                  {!['cancelada', 'aceita'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelProposal(item);
                        setCancelReason('');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-xs font-black text-red-700 border border-red-200 hover:bg-red-100 transition"
                    >
                      <XCircle className="h-4 w-4" /> Cancelar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />

      {/* Modal Detalhes da Proposta */}
      {detailsProposal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailsProposal(null)}>
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-neutral-100" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-neutral-100 bg-slate-900 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 backdrop-blur-md">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detailsProposal.status} />
                    <span className="text-xs font-mono font-bold tracking-wider text-indigo-300 uppercase">{detailsProposal.protocolo || 'PROPOSTA'}</span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">Detalhes da Proposta</h2>
                </div>
              </div>
              <button onClick={() => setDetailsProposal(null)} className="rounded-full bg-white/10 p-2 text-neutral-300 hover:bg-white/20 hover:text-white transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/50">
              {/* Cliente */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-indigo-600" /> Cliente Destinatário
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Nome</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{detailsProposal.cliente_nome || detailsProposal.snapshot_completo?.nome || 'Cliente Cadastrado'}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Data de Envio</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{formatDateTime(detailsProposal.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Rota & Pacote */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white p-5 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5">
                  <Compass className="h-4 w-4" /> Pacote & Viagem
                </h4>
                <p className="text-base font-black text-neutral-900 mb-3">{detailsProposal.snapshot_completo?.titulo || detailsProposal.titulo || 'Proposta de Viagem'}</p>
                
                {(detailsProposal.snapshot_completo?.origem || detailsProposal.snapshot_completo?.destino) && (
                  <div className="flex items-center justify-between gap-4 py-2 border-t border-indigo-100/60 pt-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Origem</p>
                      <p className="text-base font-black text-neutral-900">{detailsProposal.snapshot_completo?.origem || '-'}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-indigo-600 shrink-0" />
                    <div className="flex-1 text-right">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Destino</p>
                      <p className="text-base font-black text-neutral-900">{detailsProposal.snapshot_completo?.destino || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Condições Comerciais */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-indigo-600" /> Valores & Prazos
                </h4>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100">
                    <p className="text-[10px] font-bold uppercase text-indigo-500">Valor Total da Proposta</p>
                    <p className="text-xl font-black text-indigo-700 mt-0.5">{formatCurrency(detailsProposal.valor_total)}</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Parcelamento Máximo</p>
                    <p className="text-base font-black text-neutral-900 mt-0.5">Até {detailsProposal.parcelamento_permitido || 1}x sem juros</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Validade do Aceite</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{formatDateTime(detailsProposal.prazo_aceitacao)}</p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Prazo para Pagamento</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{formatDateTime(detailsProposal.prazo_pagamento)}</p>
                  </div>
                </div>

                {detailsProposal.condicoes && (
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Condições de Pagamento / Aceite</p>
                    <p className="text-xs font-medium text-neutral-700 mt-1 whitespace-pre-wrap">{detailsProposal.condicoes}</p>
                  </div>
                )}
              </div>

              {/* Motivo do Cancelamento (se houver) */}
              {detailsProposal.status === 'cancelada' && detailsProposal.motivo_cancelamento && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-red-700 mb-1 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-600" /> Motivo do Cancelamento
                  </h4>
                  <p className="text-sm font-semibold text-red-900 whitespace-pre-wrap">{detailsProposal.motivo_cancelamento}</p>
                </div>
              )}
            </div>

            <footer className="border-t border-neutral-100 bg-white p-5 flex items-center justify-end">
              <button 
                type="button" 
                onClick={() => setDetailsProposal(null)} 
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Cancelar Proposta */}
      <Modal isOpen={Boolean(cancelProposal)} onClose={() => setCancelProposal(null)} title="Cancelar Proposta de Viagem" size="md">
        {cancelProposal && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-red-50 p-4 border border-red-100 text-red-900 text-sm">
              <strong>Proposta: {cancelProposal.cliente_nome || cancelProposal.protocolo}</strong>
              <p className="text-xs text-red-700 mt-1">Ao cancelar esta proposta, o cliente não poderá mais visualizá-la nem aceitá-la.</p>
            </div>

            <label className={labelClass}>
              Motivo do Cancelamento <span className="text-red-500">*</span>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo pelo qual a proposta está sendo cancelada..."
                className={`${inputClass} mt-2 h-auto`}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCancelProposal(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => void handleCancelProposal()}
                disabled={savingCancel || !cancelReason.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50 shadow-md shadow-red-200"
              >
                {savingCancel ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {savingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Reativar Proposta */}
      <Modal isOpen={Boolean(selectedProposal)} onClose={() => setSelectedProposal(null)} title="Reativar / Prorrogar Proposta" size="md">
        {selectedProposal && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-indigo-50 p-4 border border-indigo-100">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Proposta Selecionada</p>
              <p className="text-base font-black text-neutral-900 mt-1">{selectedProposal.cliente_nome || selectedProposal.snapshot_completo?.titulo || selectedProposal.protocolo}</p>
              <p className="text-xs font-medium text-neutral-600 mt-1">Validade atual: {formatDateTime(selectedProposal.prazo_aceitacao)}</p>
            </div>

            <label className={labelClass}>
              Novo período de validade (em horas)
              <input
                type="number"
                min="1"
                max="720"
                value={extensionHours}
                onChange={(e) => setExtensionHours(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="48"
              />
              <span className="mt-1 block text-[11px] font-medium text-neutral-400">
                A proposta receberá um novo prazo contado a partir de agora (+{extensionHours || 0} horas).
              </span>
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedProposal(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleReactivate()}
                disabled={savingExtension}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60 shadow-md shadow-indigo-200"
              >
                {savingExtension ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {savingExtension ? 'Reativando...' : 'Confirmar e Reativar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TransacoesTab() {
  const list = usePagedTravelList('transacoes');
  const [detailsTx, setDetailsTx] = useState<any>(null);
  const [refundTx, setRefundTx] = useState<any>(null);
  const [denyTx, setDenyTx] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundFees, setRefundFees] = useState('0,00');
  const [refundNote, setRefundNote] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  const formatPaymentMethod = (item: any): string => {
    if (!item) return 'Pix / Cartão / Saldo GSA';

    const rawForma = String(
      item.forma_pagamento || 
      item.snapshot_completo?.forma_pagamento || 
      item.snapshot_completo?.metodo_pagamento || 
      item.snapshot_completo?.forma_pagamento_escolhida || 
      item.metodo_pagamento || 
      ''
    ).toLowerCase().trim();

    const paymentLabels: Record<string, string> = {
      pix: 'Pix',
      cartao_credito: 'Cartão de Crédito',
      cartao: 'Cartão de Crédito',
      credit_card: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      debit_card: 'Cartão de Débito',
      boleto: 'Boleto Bancário',
      credito_loja: 'Crédito GSA / Saldo da Carteira',
      credito_gsa: 'Crédito GSA',
      saldo_carteira: 'Saldo da Carteira GSA',
      credito: 'Crédito GSA',
      pontos: 'Pontos GSA',
      pontos_gsa: 'Pontos GSA',
      faturamento: 'Faturamento PJ',
      faturado: 'Faturamento PJ',
      transferencia: 'Transferência Bancária (TED/PIX)',
      deposito: 'Depósito Bancário',
    };

    const methods: string[] = [];
    const snapshot = item.snapshot_completo || {};
    const detalhes = item.detalhes || item.detalhes_pagamento || {};

    if (snapshot.usou_pontos || snapshot.pontos_utilizados || snapshot.desconto_pontos_aplicado || detalhes.pontos) {
      const pts = snapshot.pontos_utilizados || detalhes.pontos;
      methods.push(pts ? `Pontos GSA (${pts} pts)` : 'Pontos GSA');
    }

    if (snapshot.usou_saldo || snapshot.saldo_utilizado || detalhes.saldo_carteira || rawForma === 'saldo_carteira') {
      const val = snapshot.saldo_utilizado || detalhes.saldo_carteira;
      methods.push(val ? `Saldo da Carteira (${formatCurrency(Number(val))})` : 'Saldo da Carteira GSA');
    }

    if (snapshot.usou_credito || snapshot.credito_utilizado || rawForma === 'credito_loja' || rawForma === 'credito_gsa') {
      const val = snapshot.credito_utilizado;
      methods.push(val ? `Crédito GSA (${formatCurrency(Number(val))})` : 'Crédito GSA');
    }

    if (rawForma && rawForma !== 'outros' && paymentLabels[rawForma]) {
      if (!methods.includes(paymentLabels[rawForma])) {
        methods.push(paymentLabels[rawForma]);
      }
    } else if (rawForma && rawForma !== 'outros') {
      const formattedRaw = rawForma.replace(/_/g, ' ').toUpperCase();
      if (!methods.includes(formattedRaw)) {
        methods.push(formattedRaw);
      }
    }

    if (methods.length > 0) {
      return methods.join(' + ');
    }

    if (item.parcelamento_permitido || snapshot.parcelas) {
      const par = item.parcelamento_permitido || snapshot.parcelas;
      return `Cartão de Crédito (${par}x)`;
    }

    return rawForma && rawForma !== 'outros'
      ? rawForma.replace(/_/g, ' ').toUpperCase()
      : 'Pix / Cartão / Saldo GSA';
  };

  const getTransactionTotal = (item: any) => {
    const total = Number(item?.valor_total || 0);
    const paid = Number(item?.valor_pago || 0);
    const refund = Number(item?.valor_elegivel_reembolso || 0);
    const snapshotTotal = Number(item?.snapshot_completo?.valor_total || 0);
    return Math.max(total, paid, refund, snapshotTotal);
  };

  const getPaymentBreakdown = (item: any) => {
    if (!item) return [];

    const snapshot = item.snapshot_completo || {};
    const detalhes = item.detalhes || item.detalhes_pagamento || {};
    const total = getTransactionTotal(item);

    const breakdown: Array<{
      tipo: 'saldo' | 'pontos' | 'credito' | 'externo';
      titulo: string;
      valorDisplay: string;
      prazo: string;
      isSystem: boolean;
    }> = [];

    // 1. Saldo da carteira GSA
    const saldoVal = Number(snapshot.saldo_utilizado || detalhes.saldo_carteira || (item.forma_pagamento === 'saldo_carteira' ? total : 0));
    if (saldoVal > 0) {
      breakdown.push({
        tipo: 'saldo',
        titulo: 'Saldo da Carteira GSA',
        valorDisplay: formatCurrency(saldoVal),
        prazo: 'Estorno Imediato (Na hora)',
        isSystem: true,
      });
    }

    // 2. Pontos GSA
    const pontosVal = Number(snapshot.pontos_utilizados || detalhes.pontos || snapshot.desconto_pontos_aplicado || 0);
    if (pontosVal > 0) {
      breakdown.push({
        tipo: 'pontos',
        titulo: 'Pontos GSA',
        valorDisplay: `${pontosVal} pts`,
        prazo: 'Estorno Imediato (Na hora)',
        isSystem: true,
      });
    }

    // 3. Crédito GSA
    const creditoVal = Number(snapshot.credito_utilizado || detalhes.credito_gsa || (['credito_loja', 'credito_gsa'].includes(item.forma_pagamento) ? total : 0));
    if (creditoVal > 0) {
      const parcelas = item.parcelamento_permitido || snapshot.parcelas;
      const descParcelas = parcelas ? ` (em ${parcelas}x)` : '';
      breakdown.push({
        tipo: 'credito',
        titulo: `Crédito GSA${descParcelas}`,
        valorDisplay: formatCurrency(creditoVal),
        prazo: 'Estorno Imediato (Na hora)',
        isSystem: true,
      });
    }

    // 4. Pagamento Externo (Pix, Cartão, Boleto, etc)
    const systemValTotal = saldoVal + creditoVal;
    const externalVal = Math.max(0, total - systemValTotal);

    if (externalVal > 0 || breakdown.length === 0) {
      const rawForma = String(item.forma_pagamento || snapshot.forma_pagamento || 'Pix / Cartão').toLowerCase();
      let nomeExterno = 'Pagamento Externo (Pix / Cartão / Boleto)';
      if (rawForma.includes('pix')) nomeExterno = 'Pagamento via Pix';
      else if (rawForma.includes('cartao') || rawForma.includes('credit')) nomeExterno = 'Pagamento via Cartão de Crédito';
      else if (rawForma.includes('boleto')) nomeExterno = 'Pagamento via Boleto';

      const displayVal = externalVal > 0 ? externalVal : total;

      breakdown.push({
        tipo: 'externo',
        titulo: nomeExterno,
        valorDisplay: formatCurrency(displayVal),
        prazo: 'Prazo de até 72 horas',
        isSystem: false,
      });
    }

    return breakdown;
  };

  const openApproveModal = (item: any) => {
    setRefundTx(item);
    const initialVal = item.valor_elegivel_reembolso != null && item.valor_elegivel_reembolso > 0
      ? item.valor_elegivel_reembolso
      : item.valor_pago != null && item.valor_pago > 0
      ? item.valor_pago
      : getTransactionTotal(item);
    setRefundAmount(formatCurrencyInputValue(initialVal));
    setRefundFees('0,00');
    setRefundNote('Reembolso aprovado e processado pelo financeiro GSA.');
  };

  const handleApproveRefund = async () => {
    if (!refundTx) return;
    setProcessingRefund(true);
    try {
      const numericRefund = parseCurrencyString(refundAmount);
      const numericFees = parseCurrencyString(refundFees);

      const { error } = await supabase
        .from('viagens_transacoes')
        .update({
          status: 'reembolsada',
          valor_reembolsado: numericRefund,
          taxa_cancelamento: numericFees,
          resposta_admin: refundNote.trim() || 'Reembolso aprovado e concluído.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', refundTx.id);

      if (error) throw new Error(error.message || 'Erro ao atualizar transação.');

      // Atualiza tabela de cancelamentos se houver
      await supabase
        .from('viagens_cancelamentos')
        .update({
          status: 'concluido',
          valor_reembolsado: numericRefund,
          resposta_gsa: refundNote.trim() || 'Reembolso aprovado e concluído.',
          updated_at: new Date().toISOString(),
        })
        .eq('transacao_id', refundTx.id);

      toast.success('Reembolso aprovado e processado com sucesso!');
      setRefundTx(null);
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível aprovar o reembolso.');
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleDenyRefund = async () => {
    if (!denyTx) return;
    const reason = denyReason.trim();
    if (reason.length < 3) return toast.error('Informe o motivo da negação do reembolso (mínimo de 3 caracteres).');
    setProcessingRefund(true);
    try {
      const { error } = await supabase
        .from('viagens_transacoes')
        .update({
          status: 'reembolso_negado',
          resposta_admin: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', denyTx.id);

      if (error) throw new Error(error.message || 'Erro ao atualizar transação.');

      await supabase
        .from('viagens_cancelamentos')
        .update({
          status: 'reembolso_negado',
          resposta_gsa: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('transacao_id', denyTx.id);

      toast.success('Solicitação de reembolso negada e registrada.');
      setDenyTx(null);
      setDenyReason('');
      await list.load();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível recusar o reembolso.');
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div>
      <Toolbar 
        title="Reservas & Transações" 
        subtitle="Acompanhe pagamentos, solicitações de reembolso e confirmação de viagens." 
        {...list} 
        refresh={() => void list.load()} 
      />

      {list.loading ? (
        <Loading />
      ) : list.result.items.length === 0 ? (
        <Empty text="Nenhuma transação encontrada." />
      ) : (
        <div className="space-y-3">
          {list.result.items.map((item) => {
            const isPendingRefund = ['reembolso_em_analise', 'reembolso_solicitado', 'solicitado'].includes(item.status);

            return (
              <article key={item.id} className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 lg:flex-row lg:items-center transition bg-white shadow-2xs ${isPendingRefund ? 'border-amber-300 bg-amber-50/20' : 'border-neutral-200'}`}>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-xs font-bold text-neutral-400">Criado em {formatDate(item.created_at)}</span>
                    {isPendingRefund && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 animate-pulse">
                        Ação Necessária: Análise de Reembolso
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-neutral-900 text-lg truncate">{item.cliente_nome || item.snapshot_completo?.nome || item.protocolo || 'Transação de Viagem'}</h4>
                  <p className="text-sm font-medium text-neutral-500">
                    Forma de pagamento: <strong className="text-neutral-800">{formatPaymentMethod(item)}</strong>
                    {item.reserva_id && <span className="ml-2 text-xs text-neutral-400">· Reserva: {String(item.reserva_id).slice(0, 8)}</span>}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <div className="text-right mr-2">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Valor Total</p>
                    <p className="text-xl font-black text-indigo-700">{formatCurrency(getTransactionTotal(item))}</p>
                  </div>

                  {/* Botão Detalhes */}
                  <button
                    type="button"
                    onClick={() => setDetailsTx(item)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition border ${
                      isPendingRefund
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-md shadow-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Eye className="h-4 w-4" /> {isPendingRefund ? 'Analisar Reembolso' : 'Detalhes'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination page={list.page} total={list.result.total} onPage={list.setPage} />

      {/* Modal Detalhes da Transação */}
      {detailsTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailsTx(null)}>
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-neutral-100" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-neutral-100 bg-slate-900 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 backdrop-blur-md">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detailsTx.status} />
                    <span className="text-xs font-mono font-bold tracking-wider text-indigo-300 uppercase">{detailsTx.protocolo || 'TRANSAÇÃO'}</span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-0.5">Detalhes da Transação</h2>
                </div>
              </div>
              <button onClick={() => setDetailsTx(null)} className="rounded-full bg-white/10 p-2 text-neutral-300 hover:bg-white/20 hover:text-white transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/50">
              {/* Cliente */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-indigo-600" /> Cliente
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Nome</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{detailsTx.cliente_nome || detailsTx.snapshot_completo?.nome || 'Cliente Cadastrado'}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                    <p className="text-[10px] font-bold uppercase text-neutral-400">Data do Registro</p>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">{formatDateTime(detailsTx.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Informações Financeiras */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-indigo-600" /> Resumo Financeiro
                </h4>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100">
                    <p className="text-[10px] font-bold uppercase text-indigo-500">Valor Total</p>
                    <p className="text-lg font-black text-indigo-700 mt-0.5">{formatCurrency(getTransactionTotal(detailsTx))}</p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                    <p className="text-[10px] font-bold uppercase text-emerald-600">Valor Pago</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">{formatCurrency(detailsTx.valor_pago || detailsTx.valor_total)}</p>
                  </div>

                  <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
                    <p className="text-[10px] font-bold uppercase text-purple-600">Elegível Reembolso</p>
                    <p className="text-lg font-black text-purple-700 mt-0.5">{formatCurrency(detailsTx.valor_elegivel_reembolso || detailsTx.valor_pago || detailsTx.valor_total)}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Forma de Pagamento</p>
                  <p className="text-sm font-bold text-neutral-900 mt-0.5">{formatPaymentMethod(detailsTx)}</p>
                </div>
              </div>

              {/* Resposta do Admin / Histórico de Reembolso */}
              {detailsTx.resposta_admin && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-1">Parecer da Administração</h4>
                  <p className="text-sm font-semibold text-neutral-800 whitespace-pre-wrap">{detailsTx.resposta_admin}</p>
                </div>
              )}
            </div>

            <footer className="border-t border-neutral-100 bg-white p-5 flex items-center justify-between">
              <div>
                {['reembolso_em_analise', 'reembolso_solicitado', 'solicitado'].includes(detailsTx.status) && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const item = detailsTx;
                        setDetailsTx(null);
                        openApproveModal(item);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-200"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar Reembolso
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const item = detailsTx;
                        setDetailsTx(null);
                        setDenyTx(item);
                        setDenyReason('');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-red-50 px-4 py-2 text-xs font-black text-red-700 border border-red-200 hover:bg-red-100"
                    >
                      <XCircle className="h-4 w-4" /> Negar
                    </button>
                  </div>
                )}
              </div>

              <button 
                type="button" 
                onClick={() => setDetailsTx(null)} 
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Aprovar Reembolso */}
      <Modal isOpen={Boolean(refundTx)} onClose={() => setRefundTx(null)} title="Aprovar Solicitação de Reembolso" size="lg">
        {refundTx && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-emerald-900 text-sm flex items-center justify-between">
              <div>
                <strong>Cliente: {refundTx.cliente_nome || refundTx.protocolo}</strong>
                <p className="text-xs text-emerald-700 mt-0.5">Analise a composição do pagamento e escolha o valor total aprovado.</p>
              </div>
              <span className="text-sm font-black text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                Total: {formatCurrency(getTransactionTotal(refundTx))}
              </span>
            </div>

            {/* Composição do Pagamento e Prazos de Estorno */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-600" /> Composição do Valor e Prazos de Estorno
              </h4>

              <div className="space-y-2">
                {getPaymentBreakdown(refundTx).map((part, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 border border-neutral-200 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      {part.isSystem ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <Zap className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <Clock className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-neutral-900">{part.titulo}</p>
                        <p className="text-[11px] font-semibold text-neutral-500">{part.valorDisplay}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                      part.isSystem
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {part.isSystem ? <Zap className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {part.prazo}
                    </span>
                  </div>
                ))}
              </div>

              {/* Informação sobre os Prazos */}
              <div className="rounded-xl bg-indigo-50/80 p-3 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Regra de Processamento:</strong> Valores do sistema (Pontos, Saldo e Crédito GSA) são <strong>estornados na hora</strong>. Pagamentos externos via Pix/Cartão possuem um <strong>prazo de até 72 horas</strong> para compensação bancária/gateway.
                </p>
              </div>
            </div>

            {/* Ajuste do Valor Aprovado */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Valor Total Aprovado (R$) <span className="text-emerald-600">*</span>
                <input
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(handleCurrencyMask(e.target.value))}
                  className={`${inputClass} mt-2 font-black text-indigo-700`}
                  placeholder="0,00"
                />
              </label>

              <label className={labelClass}>
                Taxas / Retenções de Cancelamento (R$)
                <input
                  value={refundFees}
                  onChange={(e) => setRefundFees(handleCurrencyMask(e.target.value))}
                  className={`${inputClass} mt-2`}
                  placeholder="0,00"
                />
              </label>
            </div>

            <label className={labelClass}>
              Observações / Resposta ao Cliente
              <textarea
                rows={3}
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                className={`${inputClass} mt-2 h-auto`}
                placeholder="Insira a mensagem explicativa para o cliente..."
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRefundTx(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => void handleApproveRefund()}
                disabled={processingRefund}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200"
              >
                {processingRefund ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {processingRefund ? 'Processando...' : 'Confirmar e Processar Reembolso'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Negar Reembolso */}
      <Modal isOpen={Boolean(denyTx)} onClose={() => setDenyTx(null)} title="Negar Solicitação de Reembolso" size="md">
        {denyTx && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-red-50 p-4 border border-red-100 text-red-900 text-sm">
              <strong>Cliente: {denyTx.cliente_nome || denyTx.protocolo}</strong>
              <p className="text-xs text-red-700 mt-1">Informe a justificativa pela qual a solicitação de reembolso está sendo indeferida.</p>
            </div>

            <label className={labelClass}>
              Motivo do Indeferimento <span className="text-red-500">*</span>
              <textarea
                rows={4}
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Explique o motivo do indeferimento ao cliente..."
                className={`${inputClass} mt-2 h-auto`}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDenyTx(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-black text-neutral-600 hover:bg-neutral-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => void handleDenyRefund()}
                disabled={processingRefund || !denyReason.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50 shadow-md shadow-red-200"
              >
                {processingRefund ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {processingRefund ? 'Processando...' : 'Confirmar Indeferimento'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-neutral-500">{text}</p>;
}
